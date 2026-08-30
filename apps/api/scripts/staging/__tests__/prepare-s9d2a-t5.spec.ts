/**
 * S9D2A 当天前置准备脚本的行为测试。
 *
 * **跑的是脚本真的导出的那些函数**（七道闸门、只读前置检查、写入计划、
 * 回读校验），事务客户端是一个记录读写的假对象。**不连任何数据库**，
 * 也不声称任何 staging / 真机结论。
 *
 * 四条主线，对应合同 AC-02.13：闸门 / 范围 / 幂等 / 回滚。
 */
import { describe, it, expect, vi } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';

const requireCjs = createRequire(__filename);

/** 先剥注释、再扫代码 —— 文档里提到某个符号不该被判死。 */
function stripComments(src: string): string {
  return src.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:])\/\/.*$/gm, '$1');
}

const SCRIPT_PATH = path.resolve(__dirname, '..', 'prepare-s9d2a-t5.js');

type Prep = {
  S9D2A_STUDENT_ID: string;
  FIXTURE_STUDENT_IDS: string[];
  S9D2A_CLASS_ID: string;
  S9D2A_TEACHER_ID: string;
  S9D2A_SUBJECT_ID: string;
  S9D2A_REVIEW_WORDS: string[];
  S9D2A_OWNED_IDS: {
    paper: string;
    questions: string[];
    paperQuestions: string[];
    assignment: string;
    session: string;
  };
  S9D2A_RAILWAY: Record<string, string>;
  S9D2A_PASSAGE: string;
  S9D2A_STEMS: string[];
  PRESERVED_TABLES: string[];
  DESTRUCTIVE_CONFIRMATION: string;
  assertEnvGates(env: Record<string, string>): void;
  assertRailwayIdentity(env: Record<string, string>, expected?: Record<string, string>): void;
  singaporeDay(nowMs?: number): string;
  assertDayShape(day: string): string;
  runPreflight(tx: unknown, o: { day: string }): Promise<{ day: string; student: string }>;
  applyPreparation(tx: unknown, o: { day: string }): Promise<Record<string, unknown>>;
  verifyAfterWrite(tx: unknown, o: { day: string }): Promise<Record<string, unknown>>;
  prepareInTransaction(tx: unknown, o: { day: string }): Promise<Record<string, unknown>>;
  printReceipt(r: Record<string, unknown>, log?: (s: string) => void): void;
  reportFailure(e: unknown, log?: (s: string) => void): void;
  GENERIC_FAILURE: string;
};

const prep = requireCjs(SCRIPT_PATH) as Prep;

const DAY = '2026-08-30';

const GOOD_ENV = {
  NODE_ENV: 'development',
  ALLOW_S9D2A_T5_PREP: 'yes',
  DATABASE_URL: 'postgresql://sentinel-user:sentinel-secret@sentinel-host:6789/sentinel-db',
  S9D2A_CONFIRM: 'reset-t5-current-day',
};

const GOOD_RAILWAY = () => ({
  S9D2A_RAILWAY_PROJECT_ID: prep.S9D2A_RAILWAY.projectId,
  S9D2A_RAILWAY_ENVIRONMENT_ID: prep.S9D2A_RAILWAY.environmentId,
  S9D2A_RAILWAY_DB_SERVICE_ID: prep.S9D2A_RAILWAY.databaseServiceId,
});

// ─────────────────────────────────────────────────────────────
// 假事务客户端
// ─────────────────────────────────────────────────────────────

type Reads = Partial<{
  foreign: Array<{ id: string }>;
  student: Array<{ id: string; level: string }>;
  deps: Array<Record<string, number>>;
  notify: Array<{ enabled_configs: number; sent_logs: number }>;
  conflicts: Array<Record<string, number>>;
  verify: Array<Record<string, unknown>>;
}>;

function fakeTx(reads: Reads = {}) {
  const queries: string[] = [];
  const writes: string[] = [];
  const trace: Array<{ kind: 'read' | 'write'; sql: string }> = [];
  const r = {
    foreign: reads.foreign ?? [],
    student: reads.student ?? [{ id: prep.S9D2A_STUDENT_ID, level: 'olevel' }],
    deps: reads.deps ?? [{ klass: 1, enrolled: 1, teacher: 1, subject: 1, words: 4 }],
    notify: reads.notify ?? [{ enabled_configs: 0, sent_logs: 0 }],
    conflicts: reads.conflicts ?? [
      { attendance_rows: 0, foreign_subs: 0, t5_attempts: 0, other_sessions: 0 },
    ],
    verify: reads.verify ?? [
      {
        session_day: DAY,
        session_status: 'active',
        question_count: 4,
        due_taught_words: 4,
        t5_dlc_today: 0,
      },
    ],
  };
  return {
    queries,
    writes,
    trace,
    async $queryRawUnsafe(sql: string) {
      queries.push(sql);
      trace.push({ kind: 'read', sql });
      if (sql.includes('s9d2a:foreign-students')) return r.foreign;
      if (sql.includes('s9d2a:student')) return r.student;
      if (sql.includes('s9d2a:dependencies')) return r.deps;
      if (sql.includes('s9d2a:notification-guards')) return r.notify;
      if (sql.includes('s9d2a:conflicts')) return r.conflicts;
      if (sql.includes('s9d2a:verify')) return r.verify;
      throw new Error('假客户端没有登记这条读查询：' + sql.slice(0, 80));
    },
    async $executeRawUnsafe(sql: string) {
      writes.push(sql);
      trace.push({ kind: 'write', sql });
      return 1;
    },
  };
}

/** 断言这次调用抛的是脚本自己造的、可显示的错误（不是未知异常）。 */
async function rejectsSafely(fn: () => Promise<unknown>, needle: string) {
  await expect(fn()).rejects.toThrow(needle);
  try {
    await fn();
  } catch (e) {
    expect((e as Error).name).toBe('S9d2aSafeError');
    const lines: string[] = [];
    prep.reportFailure(e, (s) => lines.push(s));
    // 安全错误走「照原样显示」那一支，不是固定文案
    expect(lines.join('\n')).not.toContain(prep.GENERIC_FAILURE);
  }
}

// ─────────────────────────────────────────────────────────────
// 1 —— 常量与身份
// ─────────────────────────────────────────────────────────────

describe('AC-02.8/09 常量：只认一个学生、所有自有 id 都带 s9d2_ 前缀', () => {
  it('**只认识 t5_review 一个写入目标**', () => {
    expect(prep.S9D2A_STUDENT_ID).toBe('t5_review');
  });

  it('八个虚构 id 只用于「指错库」这道闸，逐字与通用种子一致', () => {
    expect(prep.FIXTURE_STUDENT_IDS).toEqual([
      't1_normal',
      't2_nolevel',
      't3_noatt',
      't4_newwords',
      't5_review',
      't6_done',
      't7_nocontent',
      't8_zero',
    ]);
  });

  it('**自有资源 id 全部是 s9d2_ 前缀**，一个不漏', () => {
    const all = [
      prep.S9D2A_OWNED_IDS.paper,
      prep.S9D2A_OWNED_IDS.assignment,
      prep.S9D2A_OWNED_IDS.session,
      ...prep.S9D2A_OWNED_IDS.questions,
      ...prep.S9D2A_OWNED_IDS.paperQuestions,
    ];
    expect(all.length).toBe(11);
    for (const id of all) expect(id, id).toMatch(/^s9d2_/);
    expect(new Set(all).size).toBe(all.length);
  });

  it('沿用的既有夹具资源**没有** s9d2_ 前缀（说明是复用不是新建）', () => {
    for (const id of [prep.S9D2A_CLASS_ID, prep.S9D2A_TEACHER_ID, prep.S9D2A_SUBJECT_ID]) {
      expect(id, id).not.toMatch(/^s9d2_/);
    }
  });

  it('四个复习词逐字与通用种子的 REVIEW 一致', () => {
    expect(prep.S9D2A_REVIEW_WORDS).toEqual(['ripple', 'vessel', 'willow', 'anchor']);
  });

  it('**文章长度必须 > 200** —— 否则新端会掉到没有选项的 MCQ 壳', () => {
    // apps/student-web/src/lesson/QuestionTypeRegistry.tsx 的规则 3
    expect(prep.S9D2A_PASSAGE.length).toBeGreaterThan(200);
    expect(prep.S9D2A_STEMS).toHaveLength(4);
  });
});

// ─────────────────────────────────────────────────────────────
// 2 —— 闸门（AC-02.1 / 2 / 3 / 4）
// ─────────────────────────────────────────────────────────────

describe('AC-02.1–4 七道闸门里的前五道', () => {
  it('全部齐备时放行', () => {
    expect(() => prep.assertEnvGates({ ...GOOD_ENV })).not.toThrow();
    expect(() => prep.assertRailwayIdentity({ ...GOOD_RAILWAY() })).not.toThrow();
  });

  it('**NODE_ENV=production 无条件拒绝**，且源码里没有任何覆盖开关', () => {
    expect(() => prep.assertEnvGates({ ...GOOD_ENV, NODE_ENV: 'production' })).toThrow(
      'NODE_ENV=production',
    );
    expect(() => prep.assertEnvGates({ ...GOOD_ENV, NODE_ENV: 'PRODUCTION' })).toThrow(
      'NODE_ENV=production',
    );
    const src = stripComments(fs.readFileSync(SCRIPT_PATH, 'utf8'));
    for (const w of ['FORCE', 'force', 'OVERRIDE', 'override', 'BYPASS', 'bypass', 'SKIP_GATE']) {
      expect(src, `出现了 ${w}`).not.toContain(w);
    }
  });

  it('缺 ALLOW_S9D2A_T5_PREP / 值不是 yes → 拒绝', () => {
    expect(() => prep.assertEnvGates({ ...GOOD_ENV, ALLOW_S9D2A_T5_PREP: '' })).toThrow(
      'ALLOW_S9D2A_T5_PREP=yes',
    );
    expect(() => prep.assertEnvGates({ ...GOOD_ENV, ALLOW_S9D2A_T5_PREP: 'true' })).toThrow(
      'ALLOW_S9D2A_T5_PREP=yes',
    );
  });

  it('**没有显式 DATABASE_URL → 拒绝**（不许回落到仓库根的 .env）', () => {
    expect(() => prep.assertEnvGates({ ...GOOD_ENV, DATABASE_URL: '' })).toThrow('DATABASE_URL');
  });

  it('确认串必须逐字相等', () => {
    expect(prep.DESTRUCTIVE_CONFIRMATION).toBe('reset-t5-current-day');
    expect(() => prep.assertEnvGates({ ...GOOD_ENV, S9D2A_CONFIRM: 'yes' })).toThrow(
      'reset-t5-current-day',
    );
    expect(() => prep.assertEnvGates({ ...GOOD_ENV, S9D2A_CONFIRM: '' })).toThrow(
      'reset-t5-current-day',
    );
  });

  it('**闸门的报错里绝不回显 DATABASE_URL 的取值**', () => {
    const sentinel = GOOD_ENV.DATABASE_URL;
    for (const bad of [
      { ...GOOD_ENV, NODE_ENV: 'production' },
      { ...GOOD_ENV, ALLOW_S9D2A_T5_PREP: '' },
      { ...GOOD_ENV, S9D2A_CONFIRM: 'no' },
    ]) {
      try {
        prep.assertEnvGates(bad);
        throw new Error('本该抛');
      } catch (e) {
        expect((e as Error).message).not.toContain(sentinel);
        expect((e as Error).message).not.toContain('sentinel-secret');
      }
    }
  });

  it('**Railway 身份三元组缺一不可**', () => {
    for (const k of [
      'S9D2A_RAILWAY_PROJECT_ID',
      'S9D2A_RAILWAY_ENVIRONMENT_ID',
      'S9D2A_RAILWAY_DB_SERVICE_ID',
    ]) {
      const env = { ...GOOD_RAILWAY(), [k]: '' };
      expect(() => prep.assertRailwayIdentity(env), k).toThrow(k);
    }
  });

  it('**三元组对不上就拒绝** —— 打到别的项目会被挡住', () => {
    for (const k of [
      'S9D2A_RAILWAY_PROJECT_ID',
      'S9D2A_RAILWAY_ENVIRONMENT_ID',
      'S9D2A_RAILWAY_DB_SERVICE_ID',
    ]) {
      const env = { ...GOOD_RAILWAY(), [k]: '00000000-0000-0000-0000-000000000000' };
      expect(() => prep.assertRailwayIdentity(env), k).toThrow(k);
    }
  });

  it('身份常量指向 staging，不是别的项目', () => {
    expect(prep.S9D2A_RAILWAY.projectName).toBe('exam-staging-manual');
    expect(prep.S9D2A_RAILWAY.environmentName).toBe('production');
    for (const k of ['projectId', 'environmentId', 'databaseServiceId']) {
      expect(prep.S9D2A_RAILWAY[k], k).toMatch(/^[0-9a-f-]{36}$/);
    }
  });

  it('日期形状被钉死成 YYYY-MM-DD', () => {
    expect(prep.assertDayShape(DAY)).toBe(DAY);
    for (const bad of ['2026-8-30', "2026-08-30'; DROP TABLE", '', 'today']) {
      expect(() => prep.assertDayShape(bad), bad).toThrow('YYYY-MM-DD');
    }
  });

  it('singaporeDay 与 API 的 lessonDayKey 同口径（UTC+8 的日历日）', () => {
    // 2026-08-29T16:00:00Z = SGT 2026-08-30 00:00 —— 翻页那一刻
    expect(prep.singaporeDay(Date.parse('2026-08-29T15:59:59Z'))).toBe('2026-08-29');
    expect(prep.singaporeDay(Date.parse('2026-08-29T16:00:00Z'))).toBe('2026-08-30');
    expect(prep.singaporeDay(Date.parse('2026-08-30T00:38:19Z'))).toBe('2026-08-30');
  });
});

// ─────────────────────────────────────────────────────────────
// 3 —— 只读前置检查（AC-02.5 / 6，九项）
// ─────────────────────────────────────────────────────────────

describe('AC-02.5/6 只读前置检查', () => {
  it('九项全过时返回当天与学生', async () => {
    const tx = fakeTx();
    await expect(prep.runPreflight(tx, { day: DAY })).resolves.toEqual({
      day: DAY,
      student: 't5_review',
    });
    expect(tx.writes).toEqual([]); // 前置检查**一条都不写**
  });

  it('**库里有别的在读学生 → 拒绝**（指错库的硬拦截）', async () => {
    const tx = fakeTx({ foreign: [{ id: 'real_student_1' }] });
    await rejectsSafely(() => prep.runPreflight(tx, { day: DAY }), 'DATABASE_URL 指错了库');
  });

  it('t5 不在 / 不是在读学生 → 拒绝', async () => {
    const tx = fakeTx({ student: [] });
    await rejectsSafely(() => prep.runPreflight(tx, { day: DAY }), 't5_review');
  });

  it('**t5 的分级不是 olevel → 拒绝**（否则服务端会挑到别的层）', async () => {
    const tx = fakeTx({ student: [{ id: 't5_review', level: 'ielts_authentic' }] });
    await rejectsSafely(() => prep.runPreflight(tx, { day: DAY }), 'olevel');
  });

  it('缺班级 / 注册 / 班主任 / 科目 / 四个词 → 各自拒绝', async () => {
    const base = { klass: 1, enrolled: 1, teacher: 1, subject: 1, words: 4 };
    const cases: Array<[string, Record<string, number>, string]> = [
      ['班级', { ...base, klass: 0 }, 'tc1'],
      ['注册', { ...base, enrolled: 0 }, '学生注册'],
      ['班主任', { ...base, teacher: 0 }, 't_stgteacher'],
      ['科目', { ...base, subject: 0 }, 'stg_sub'],
      ['复习词', { ...base, words: 3 }, '四个复习词'],
    ];
    for (const [label, deps, needle] of cases) {
      const tx = fakeTx({ deps: [deps] });
      await expect(prep.runPreflight(tx, { day: DAY }), label).rejects.toThrow(needle);
    }
  });

  it('**通知没关（config 或 log 非 0）→ 拒绝**', async () => {
    await rejectsSafely(
      () => prep.runPreflight(fakeTx({ notify: [{ enabled_configs: 1, sent_logs: 0 }] }), { day: DAY }),
      'NotificationConfig',
    );
    await rejectsSafely(
      () => prep.runPreflight(fakeTx({ notify: [{ enabled_configs: 0, sent_logs: 2 }] }), { day: DAY }),
      'NotificationLog',
    );
  });

  it('**夹具场次上有考勤行 → 拒绝**（说明这个 id 被别的流程用过）', async () => {
    const tx = fakeTx({
      conflicts: [{ attendance_rows: 1, foreign_subs: 0, t5_attempts: 0, other_sessions: 0 }],
    });
    await rejectsSafely(() => prep.runPreflight(tx, { day: DAY }), '考勤行');
  });

  it('**作业单上有别人的答卷 → 拒绝**（写入范围只有 t5）', async () => {
    const tx = fakeTx({
      conflicts: [{ attendance_rows: 0, foreign_subs: 2, t5_attempts: 0, other_sessions: 0 }],
    });
    await rejectsSafely(() => prep.runPreflight(tx, { day: DAY }), '别人');
  });

  it('**t5 当天已有正式测试 → 拒绝，绝不删它**', async () => {
    const tx = fakeTx({
      conflicts: [{ attendance_rows: 0, foreign_subs: 0, t5_attempts: 1, other_sessions: 0 }],
    });
    await rejectsSafely(() => prep.runPreflight(tx, { day: DAY }), '成绩证据');
    expect(tx.writes).toEqual([]);
  });

  it('**当天同班还有别的场次 → 拒绝**（两场 active 时服务端会挑错）', async () => {
    const tx = fakeTx({
      conflicts: [{ attendance_rows: 0, foreign_subs: 0, t5_attempts: 0, other_sessions: 1 }],
    });
    await rejectsSafely(() => prep.runPreflight(tx, { day: DAY }), '别的');
  });
});

// ─────────────────────────────────────────────────────────────
// 4 —— 写入范围（AC-02.9 / 10 / 11）
// ─────────────────────────────────────────────────────────────

describe('AC-02.9/10/11 写入范围：只有 t5 和自己的 s9d2_ 资源', () => {
  const OTHER_STUDENTS = [
    't1_normal',
    't2_nolevel',
    't3_noatt',
    't4_newwords',
    't6_done',
    't7_nocontent',
    't8_zero',
  ];

  it('**每一条写语句都不提另外七个学生**', async () => {
    const tx = fakeTx();
    await prep.applyPreparation(tx, { day: DAY });
    expect(tx.writes.length).toBeGreaterThan(0);
    for (const sql of tx.writes) {
      for (const id of OTHER_STUDENTS) {
        expect(sql.includes(`'${id}'`), `${id} 出现在：${sql.slice(0, 120)}`).toBe(false);
      }
    }
  });

  it('**凡是带 studentId 条件的写，条件都恰好是 t5_review**', async () => {
    const tx = fakeTx();
    await prep.applyPreparation(tx, { day: DAY });
    const scoped = tx.writes.filter((s) => s.includes('"studentId"'));
    expect(scoped.length).toBeGreaterThanOrEqual(4);
    for (const sql of scoped) {
      expect(sql, sql.slice(0, 120)).toMatch(/"studentId"\s*=\s*'t5_review'/);
    }
  });

  it('**PRESERVED_TABLES 一张都不写**', async () => {
    const tx = fakeTx();
    await prep.applyPreparation(tx, { day: DAY });
    expect(prep.PRESERVED_TABLES).toEqual([
      'User',
      'Class',
      'ClassEnrollment',
      'WordReviewLog',
      'DictEntry',
      'Attendance',
      'VocabQuizAttempt',
    ]);
    for (const table of prep.PRESERVED_TABLES) {
      for (const sql of tx.writes) {
        const touched = new RegExp(`(INSERT INTO|UPDATE|DELETE FROM)\\s+"${table}"`).test(sql);
        expect(touched, `写到了 ${table}：${sql.slice(0, 120)}`).toBe(false);
      }
    }
  });

  it('**从不创建任务行，更不会创建 stage=vocab_test 的任务行**', async () => {
    const tx = fakeTx();
    await prep.applyPreparation(tx, { day: DAY });
    for (const sql of tx.writes) {
      expect(/INSERT INTO\s+"DailyLessonCompletion"/.test(sql), sql.slice(0, 120)).toBe(false);
      expect(/UPDATE\s+"DailyLessonCompletion"/.test(sql), sql.slice(0, 120)).toBe(false);
      expect(sql, sql.slice(0, 120)).not.toContain('vocab_test');
      expect(sql, sql.slice(0, 120)).not.toContain('vocab_learn');
    }
    // 任务行只被**删**（当天那一条），从不被写出来
    const dlc = tx.writes.filter((s) => s.includes('"DailyLessonCompletion"'));
    expect(dlc).toHaveLength(1);
    expect(dlc[0]).toMatch(/^DELETE FROM "DailyLessonCompletion"/);
  });

  it('**整个脚本源码里没有 VocabQuizAttempt 的写语句**', () => {
    const src = stripComments(fs.readFileSync(SCRIPT_PATH, 'utf8'));
    expect(/INSERT INTO\s+"VocabQuizAttempt"/.test(src)).toBe(false);
    expect(/DELETE FROM\s+"VocabQuizAttempt"/.test(src)).toBe(false);
    expect(/UPDATE\s+"VocabQuizAttempt"/.test(src)).toBe(false);
  });

  it('**复习词的 UPDATE 只圈定那四个 headword**，且不 INSERT 新词', async () => {
    const tx = fakeTx();
    await prep.applyPreparation(tx, { day: DAY });
    const wordWrites = tx.writes.filter((s) => s.includes('"StudentWord"'));
    expect(wordWrites).toHaveLength(1);
    const sql = wordWrites[0];
    expect(sql).toMatch(/^UPDATE "StudentWord"/);
    expect(sql).toContain(`'ripple','vessel','willow','anchor'`);
    expect(sql).toMatch(/"firstTaughtAt" = timezone\('UTC',now\(\)\) - interval '9 days'/);
    expect(sql).toMatch(/due = timezone\('UTC',now\(\)\) - interval '1 hour'/);
  });

  it('删除顺序按外键倒序：答案 → 答卷 → 作业单', async () => {
    const tx = fakeTx();
    await prep.applyPreparation(tx, { day: DAY });
    const idx = (needle: string) => tx.writes.findIndex((s) => s.includes(needle));
    expect(idx('DELETE FROM "AnswerScript"')).toBeGreaterThanOrEqual(0);
    expect(idx('DELETE FROM "AnswerScript"')).toBeLessThan(idx('DELETE FROM "StudentSubmission"'));
    expect(idx('DELETE FROM "StudentSubmission"')).toBeLessThan(
      idx('DELETE FROM "PaperAssignment"'),
    );
    // 场次引用作业单 —— 必须先删场次
    expect(idx('DELETE FROM "MorningQuizSession"')).toBeLessThan(
      idx('DELETE FROM "PaperAssignment"'),
    );
  });

  it('**场次以 active 建出来**（服务端只把 active 当「已发布」）', async () => {
    const tx = fakeTx();
    await prep.applyPreparation(tx, { day: DAY });
    const ins = tx.writes.find((s) => s.startsWith('INSERT INTO "MorningQuizSession"'))!;
    expect(ins).toBeTruthy();
    expect(ins).toContain(`'active'`);
    expect(ins).toContain(`'olevel'`);
    expect(ins).toContain(`'${DAY}T00:00:00Z'`);
  });
});

// ─────────────────────────────────────────────────────────────
// 5 —— 顺序：读 → 写 → 回读（AC-02.7）
// ─────────────────────────────────────────────────────────────

describe('AC-02.7 一个事务里的三段顺序', () => {
  it('**第一条写出现在所有前置读之后，回读出现在所有写之后**', async () => {
    const tx = fakeTx();
    await prep.prepareInTransaction(tx, { day: DAY });
    const firstWrite = tx.trace.findIndex((t) => t.kind === 'write');
    const lastWrite = tx.trace.map((t) => t.kind).lastIndexOf('write');
    const verifyAt = tx.trace.findIndex((t) => t.sql.includes('s9d2a:verify'));
    expect(firstWrite).toBeGreaterThan(0);
    for (const t of tx.trace.slice(0, firstWrite)) expect(t.kind).toBe('read');
    expect(verifyAt).toBeGreaterThan(lastWrite);
  });

  it('**前置检查失败时一条写都没发出去**', async () => {
    const tx = fakeTx({ foreign: [{ id: 'real_student_1' }] });
    await expect(prep.prepareInTransaction(tx, { day: DAY })).rejects.toThrow();
    expect(tx.writes).toEqual([]);
  });

  it('源码里的事务显式给了超时预算（Prisma 默认 5 秒不够）', () => {
    const src = stripComments(fs.readFileSync(SCRIPT_PATH, 'utf8'));
    expect(src).toMatch(/\$transaction\(/);
    expect(src).toMatch(/timeout:\s*60_000/);
    expect(src).toMatch(/maxWait:\s*10_000/);
  });
});

// ─────────────────────────────────────────────────────────────
// 6 —— 回读校验 / 回滚（AC-02.7、ROLLBACK）
// ─────────────────────────────────────────────────────────────

describe('ROLLBACK 回读校验：写完了也可能整体回滚', () => {
  const V = {
    session_day: DAY,
    session_status: 'active',
    question_count: 4,
    due_taught_words: 4,
    t5_dlc_today: 0,
  };

  it('全部对得上时返回观测值', async () => {
    await expect(prep.verifyAfterWrite(fakeTx(), { day: DAY })).resolves.toEqual({
      sessionDay: DAY,
      sessionStatus: 'active',
      questionCount: 4,
      dueTaughtWords: 4,
      dlcToday: 0,
    });
  });

  it('**场次落到了别的日历日 → 回滚**（差一天 = 今天没有课）', async () => {
    const tx = fakeTx({ verify: [{ ...V, session_day: '2026-08-29' }] });
    await rejectsSafely(() => prep.verifyAfterWrite(tx, { day: DAY }), '回滚');
  });

  it('场次不是 active → 回滚', async () => {
    const tx = fakeTx({ verify: [{ ...V, session_status: 'scheduled' }] });
    await rejectsSafely(() => prep.verifyAfterWrite(tx, { day: DAY }), 'active');
  });

  it('题数不是四道 → 回滚', async () => {
    const tx = fakeTx({ verify: [{ ...V, question_count: 3 }] });
    await rejectsSafely(() => prep.verifyAfterWrite(tx, { day: DAY }), '道题');
  });

  it('**到期且教过的复习词不是四个 → 回滚**', async () => {
    const tx = fakeTx({ verify: [{ ...V, due_taught_words: 2 }] });
    await rejectsSafely(() => prep.verifyAfterWrite(tx, { day: DAY }), '复习词');
  });

  it('**当天居然留下了任务行 → 回滚**（阶段必须由学生走出来）', async () => {
    const tx = fakeTx({ verify: [{ ...V, t5_dlc_today: 1 }] });
    await rejectsSafely(() => prep.verifyAfterWrite(tx, { day: DAY }), '走出来');
  });
});

// ─────────────────────────────────────────────────────────────
// 7 —— 幂等（AC-02.8）
// ─────────────────────────────────────────────────────────────

describe('AC-02.8 场景层面幂等', () => {
  it('**同一天跑两次，发出的 SQL 序列逐字相同**', async () => {
    const a = fakeTx();
    const b = fakeTx();
    await prep.applyPreparation(a, { day: DAY });
    await prep.applyPreparation(b, { day: DAY });
    expect(b.writes).toEqual(a.writes);
  });

  it('**自有资源的 INSERT 都带 ON CONFLICT DO NOTHING**（卷子不会翻倍）', async () => {
    const tx = fakeTx();
    await prep.applyPreparation(tx, { day: DAY });
    for (const sql of tx.writes) {
      if (!sql.startsWith('INSERT INTO')) continue;
      const table = /INSERT INTO "(\w+)"/.exec(sql)![1];
      // 作业单与场次走「先删后建」，不需要 ON CONFLICT
      if (table === 'PaperAssignment' || table === 'MorningQuizSession') {
        expect(tx.writes.some((s) => s.startsWith(`DELETE FROM "${table}"`)), table).toBe(true);
        continue;
      }
      expect(sql, `${table} 的 INSERT 少了 ON CONFLICT`).toContain('ON CONFLICT (id) DO NOTHING');
    }
  });

  it('每个自有 id 恰好被一条 INSERT 建出来', async () => {
    const tx = fakeTx();
    await prep.applyPreparation(tx, { day: DAY });
    const inserts = tx.writes.filter((s) => s.startsWith('INSERT INTO'));
    const all = [
      prep.S9D2A_OWNED_IDS.paper,
      prep.S9D2A_OWNED_IDS.assignment,
      prep.S9D2A_OWNED_IDS.session,
      ...prep.S9D2A_OWNED_IDS.questions,
      ...prep.S9D2A_OWNED_IDS.paperQuestions,
    ];
    for (const id of all) {
      expect(inserts.filter((s) => s.includes(`'${id}'`)).length, id).toBeGreaterThanOrEqual(1);
    }
    expect(inserts).toHaveLength(1 /* paper */ + 4 /* q */ + 4 /* pq */ + 1 /* asg */ + 1 /* sess */);
  });
});

// ─────────────────────────────────────────────────────────────
// 8 —— 失败上报 fail-closed / 回执
// ─────────────────────────────────────────────────────────────

describe('失败上报默认什么都不说', () => {
  it('**未知错误只输出固定文案**，不回显 message / stack', () => {
    const leak = 'postgresql://u:secret@host:5432/db';
    const lines: string[] = [];
    prep.reportFailure(new Error(leak), (s) => lines.push(s));
    const out = lines.join('\n');
    expect(out).toContain(prep.GENERIC_FAILURE);
    expect(out).not.toContain(leak);
    expect(out).not.toContain('secret');
  });

  it('**伪造 name / 标记字段骗不过名册**', () => {
    const leak = 'postgresql://u:secret@host:5432/db';
    const hostile = Object.assign(new Error(leak), { name: 'S9d2aSafeError', s9d2aSafe: true });
    const lines: string[] = [];
    prep.reportFailure(hostile, (s) => lines.push(s));
    expect(lines.join('\n')).not.toContain(leak);
  });

  it('非对象（字符串 / null / 数字）也走固定文案', () => {
    for (const e of ['boom', null, 42, undefined]) {
      const lines: string[] = [];
      prep.reportFailure(e, (s) => lines.push(s));
      expect(lines.join('\n')).toContain(prep.GENERIC_FAILURE);
    }
  });

  it('**回执里只有日期、学生、夹具 id 和词数**，没有连接串', () => {
    const lines: string[] = [];
    prep.printReceipt(
      {
        day: DAY,
        student: 't5_review',
        sessionId: prep.S9D2A_OWNED_IDS.session,
        assignmentId: prep.S9D2A_OWNED_IDS.assignment,
        paperId: prep.S9D2A_OWNED_IDS.paper,
        reviewWords: 4,
      },
      (s) => lines.push(s),
    );
    const out = lines.join('\n');
    expect(out).toContain(DAY);
    expect(out).toContain('t5_review');
    expect(out).toContain(prep.S9D2A_OWNED_IDS.session);
    for (const bad of ['postgres', 'PIN', 'Bearer', 'password', '@']) {
      expect(out, bad).not.toContain(bad);
    }
  });
});

// ─────────────────────────────────────────────────────────────
// 9 —— 反向夹具：证明这些守卫真的会红
// ─────────────────────────────────────────────────────────────

describe('反向夹具 —— 守卫必须抓得住', () => {
  it('**把别的学生写进 UPDATE 会被范围断言抓到**', () => {
    const hostile = `UPDATE "StudentWord" SET due = now() WHERE "studentId" = 't1_normal'`;
    expect(/"studentId"\s*=\s*'t5_review'/.test(hostile)).toBe(false);
    expect(hostile.includes(`'t1_normal'`)).toBe(true);
  });

  it('**建一条 stage=vocab_test 的任务行会被抓到**', () => {
    const hostile = `INSERT INTO "DailyLessonCompletion"(stage) VALUES ('vocab_test')`;
    expect(/INSERT INTO\s+"DailyLessonCompletion"/.test(hostile)).toBe(true);
    expect(hostile).toContain('vocab_test');
  });

  it('**删一份正式测试会被源码断言抓到**', () => {
    const hostile = `DELETE FROM "VocabQuizAttempt" WHERE "studentId" = 't5_review'`;
    expect(/DELETE FROM\s+"VocabQuizAttempt"/.test(hostile)).toBe(true);
  });

  it('**加一个 force 覆盖开关会被抓到**', () => {
    const hostile = `if (process.env.S9D2A_FORCE === '1') return;`;
    expect(hostile).toContain('FORCE');
  });

  it('注释里提到这些名字不算违规（守卫剥注释）', () => {
    expect(stripComments('// 我们不写 VocabQuizAttempt，也没有 force 开关\nconst a = 1;')).not.toContain(
      'force',
    );
  });
});

// ─────────────────────────────────────────────────────────────
// 10 —— 这一份不许碰运行期代码
// ─────────────────────────────────────────────────────────────

describe('脚本是夹具，不是运行期代码', () => {
  it('**不 import 任何 src/ 下的模块**', () => {
    const src = stripComments(fs.readFileSync(SCRIPT_PATH, 'utf8'));
    for (const m of src.matchAll(/require\(\s*['"]([^'"]+)['"]\s*\)/g)) {
      expect(m[1], m[1]).toBe('@prisma/client');
    }
    expect(src).not.toContain('../src/');
    expect(src).not.toContain('../../src/');
  });

  it('**@prisma/client 的 require 出现在闸门之后**（不让 dotenv 抢先填 DATABASE_URL）', () => {
    // 必须在**剥掉注释之后**比位置：文件头的长注释里就解释了这条规则，
    // 里面照原样写着 `require('@prisma/client')`，按原文找会命中注释。
    const src = stripComments(fs.readFileSync(SCRIPT_PATH, 'utf8'));
    const gateAt = src.indexOf('assertEnvGates();');
    const requireAt = src.indexOf("require('@prisma/client')");
    expect(gateAt).toBeGreaterThan(0);
    expect(requireAt).toBeGreaterThan(gateAt);
    // 顶层没有任何 require
    const topLevel = src.slice(0, src.indexOf('async function main()'));
    expect(/^\s*const\s*\{[^}]*\}\s*=\s*require\(/m.test(topLevel)).toBe(false);
  });

  it('**不加载、不执行另外两个夹具脚本**（提到名字是给人看的提示，不是调用）', () => {
    const src = stripComments(fs.readFileSync(SCRIPT_PATH, 'utf8'));
    for (const other of ['seed-eight-test-accounts', 'prepare-s7e-reading']) {
      expect(new RegExp(`require\\([^)]*${other}`).test(src), other).toBe(false);
      expect(new RegExp(`import\\([^)]*${other}`).test(src), other).toBe(false);
    }
    // 也不通过子进程绕过去
    for (const m of ['child_process', 'execSync', 'spawn', 'fork(']) {
      expect(src, m).not.toContain(m);
    }
  });
});
