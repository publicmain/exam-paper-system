/**
 * S7E 阅读夹具准备脚本的行为测试。
 *
 * **跑的是脚本真的导出的那些函数**（闸门、前置检查、写入计划），
 * 事务客户端是一个记录读写的假对象。**不连任何数据库**，也不声称
 * 任何 staging / 真机结论。
 */
import { describe, it, expect, beforeEach, vi } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';

const requireCjs = createRequire(__filename);

/** 先剥注释、再扫代码 —— 文档里提到某个符号不该被判死。 */
function stripComments(src: string): string {
  return src.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:])\/\/.*$/gm, '$1');
}
const SCRIPT_PATH = path.resolve(__dirname, '..', 'prepare-s7e-reading.js');
const prep = requireCjs(SCRIPT_PATH) as {
  S7E_STUDENT_IDS: string[];
  S7E_CLASS_IDS: string[];
  S7E_TEACHER_ID: string;
  S7E_OWNED_IDS: Record<string, unknown>;
  PRESERVED_TABLES: string[];
  DESTRUCTIVE_CONFIRMATION: string;
  assertEnvGates(env: Record<string, string>): void;
  singaporeDay(nowMs?: number): string;
  assertDayShape(day: string): string;
  runPreflight(tx: unknown): Promise<{ studentCount: number }>;
  applyPreparation(
    tx: unknown,
    o: { day: string },
  ): Promise<{ day: string; sessionIds: string[]; students: number }>;
  prepareInTransaction(
    tx: unknown,
    o: { day: string },
  ): Promise<{ day: string; sessionIds: string[]; students: number }>;
  printReceipt(r: { day: string; sessionIds: string[]; students: number }): void;
};

const GOOD_ENV = {
  NODE_ENV: 'development',
  ALLOW_S7E_READING_PREP: 'yes',
  DATABASE_URL: 'postgresql://sentinel-user:sentinel-secret@sentinel-host:6789/sentinel-db',
  S7E_CONFIRM_RESET: 'reset-eight-reading-progress',
};

// ─────────────────────────────────────────────────────────────
// 假事务客户端
// ─────────────────────────────────────────────────────────────

type Reads = Partial<{
  foreign: Array<{ id: string }>;
  expected: Array<{ id: string }>;
  classes: Array<{ id: string }>;
  teacher: Array<{ id: string }>;
  notify: Array<{ enabled_configs: number; sent_logs: number }>;
}>;

function fakeTx(reads: Reads = {}) {
  const queries: string[] = [];
  const writes: string[] = [];
  const r: Required<Reads> = {
    foreign: reads.foreign ?? [],
    expected: reads.expected ?? prep.S7E_STUDENT_IDS.map((id) => ({ id })),
    classes: reads.classes ?? prep.S7E_CLASS_IDS.map((id) => ({ id })),
    teacher: reads.teacher ?? [{ id: prep.S7E_TEACHER_ID }],
    notify: reads.notify ?? [{ enabled_configs: 0, sent_logs: 0 }],
  };
  return {
    queries,
    writes,
    async $queryRawUnsafe(sql: string) {
      queries.push(sql);
      if (sql.includes('s7e:foreign-students')) return r.foreign;
      if (sql.includes('s7e:expected-students')) return r.expected;
      if (sql.includes('s7e:classes-and-teacher')) return r.classes;
      if (sql.includes('s7e:teacher')) return r.teacher;
      if (sql.includes('s7e:notification-guards')) return r.notify;
      throw new Error('假客户端没有登记这条读查询：' + sql.slice(0, 80));
    },
    async $executeRawUnsafe(sql: string) {
      writes.push(sql);
      return 1;
    },
  };
}

const DAY = '2026-08-28';

// ─────────────────────────────────────────────────────────────
// 1 —— 八个 id 的白名单
// ─────────────────────────────────────────────────────────────

describe('AC-02/AC-08.1 只认识这八个虚构 id', () => {
  it('**恰好八个，逐字相等**', () => {
    expect(prep.S7E_STUDENT_IDS).toEqual([
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

  it('**每一条写语句都只提到这八个 id，没有别人**', async () => {
    const tx = fakeTx();
    await prep.applyPreparation(tx, { day: DAY });
    const others = /'(?!t1_normal|t2_nolevel|t3_noatt|t4_newwords|t5_review|t6_done|t7_nocontent|t8_zero)([a-z]\d?_[a-z_]+)'/g;
    for (const sql of tx.writes) {
      // 只在带 studentId 条件的语句里查 —— 别的语句里的 id 是夹具自有资源
      if (!sql.includes('"studentId"')) continue;
      const hits = [...sql.matchAll(others)].map((m) => m[1]);
      expect(hits, sql.slice(0, 120)).toEqual([]);
    }
  });

  it('**通用种子脚本未被本任务改动**（内容里没有 S7E 的痕迹）', () => {
    const seed = fs.readFileSync(path.resolve(__dirname, '..', 'seed-eight-test-accounts.js'), 'utf8');
    expect(seed).not.toContain('S7E');
    expect(seed).not.toContain('ALLOW_S7E_READING_PREP');
  });

  it('没有真实学生标识：邮箱域与 id 都是虚构的', () => {
    const src = fs.readFileSync(SCRIPT_PATH, 'utf8');
    expect(src).not.toMatch(/@(gmail|qq|163|outlook|esic)\./i);
    for (const id of prep.S7E_STUDENT_IDS) expect(id).toMatch(/^t\d_[a-z]+$/);
  });
});

// ─────────────────────────────────────────────────────────────
// 2–5 —— 环境闸门
// ─────────────────────────────────────────────────────────────

describe('AC-04/AC-08.2-5 四道环境闸门', () => {
  it('齐全时放行', () => {
    expect(() => prep.assertEnvGates(GOOD_ENV)).not.toThrow();
  });

  it('**NODE_ENV=production → 拒绝**（大小写不敏感）', () => {
    expect(() => prep.assertEnvGates({ ...GOOD_ENV, NODE_ENV: 'production' })).toThrow(/production/);
    expect(() => prep.assertEnvGates({ ...GOOD_ENV, NODE_ENV: 'PRODUCTION' })).toThrow(/production/);
  });

  it('**缺 ALLOW_S7E_READING_PREP → 拒绝**；写别的值也拒绝', () => {
    expect(() => prep.assertEnvGates({ ...GOOD_ENV, ALLOW_S7E_READING_PREP: '' })).toThrow(
      /ALLOW_S7E_READING_PREP/,
    );
    expect(() => prep.assertEnvGates({ ...GOOD_ENV, ALLOW_S7E_READING_PREP: 'true' })).toThrow(
      /ALLOW_S7E_READING_PREP/,
    );
  });

  it('**没有显式 DATABASE_URL → 拒绝**', () => {
    expect(() => prep.assertEnvGates({ ...GOOD_ENV, DATABASE_URL: '' })).toThrow(/DATABASE_URL/);
  });

  it('**破坏性确认缺失 / 写错 → 拒绝**', () => {
    expect(() => prep.assertEnvGates({ ...GOOD_ENV, S7E_CONFIRM_RESET: '' })).toThrow(/S7E_CONFIRM_RESET/);
    expect(() => prep.assertEnvGates({ ...GOOD_ENV, S7E_CONFIRM_RESET: 'yes' })).toThrow(/S7E_CONFIRM_RESET/);
    expect(() => prep.assertEnvGates({ ...GOOD_ENV, S7E_CONFIRM_RESET: 'reset-eight-reading-progress ' })).toThrow(
      /S7E_CONFIRM_RESET/,
    );
    expect(prep.DESTRUCTIVE_CONFIRMATION).toBe('reset-eight-reading-progress');
  });

  it('**没有任何 force / override / bypass 开关**', () => {
    const src = fs.readFileSync(SCRIPT_PATH, 'utf8');
    expect(src).not.toMatch(/process\.env\.(FORCE|OVERRIDE|BYPASS|SKIP_)/);
    expect(src).not.toMatch(/--force|--yes-i-know|allowProduction/);
  });

  it('**闸门在加载 Prisma 之前** —— 文件顶层不 require @prisma/client', () => {
    // 先剥注释：文档里**提到** require 是有价值的解释，禁的是顶层真的 require。
    const src = stripComments(fs.readFileSync(SCRIPT_PATH, 'utf8'));
    const topLevel = src.split('async function main()')[0];
    expect(topLevel).not.toContain("require('@prisma/client')");
    // 而且它只出现一次（就在 main 里）
    expect(src.match(/require\('@prisma\/client'\)/g) ?? []).toHaveLength(1);
    // 闸门调用排在 require 之前
    const body = src.split('async function main()')[1];
    expect(body.indexOf('assertEnvGates()')).toBeLessThan(body.indexOf("require('@prisma/client')"));
  });

  it('**只 require 脚本本身不会建立任何连接**（模块加载是纯的）', () => {
    // 上面 requireCjs 已经加载过；能跑到这里说明加载期没有连库、没有抛错
    expect(typeof prep.main).toBe('function');
  });
});

// ─────────────────────────────────────────────────────────────
// 6–9 —— 数据库前置检查
// ─────────────────────────────────────────────────────────────

describe('AC-05/AC-08.6-9 前置检查', () => {
  it('全部满足时通过，且**一条写语句都没发**', async () => {
    const tx = fakeTx();
    await expect(prep.runPreflight(tx)).resolves.toEqual({ studentCount: 8 });
    expect(tx.writes).toEqual([]);
    expect(tx.queries.length).toBeGreaterThanOrEqual(5);
  });

  it('**库里有别的在读学生 → 拒绝**', async () => {
    const tx = fakeTx({ foreign: [{ id: 'real_student_001' }] });
    await expect(prep.runPreflight(tx)).rejects.toThrow(/不属于本夹具的在读学生/);
    expect(tx.writes).toEqual([]);
  });

  it('**八个账号缺一 → 拒绝**', async () => {
    const tx = fakeTx({ expected: prep.S7E_STUDENT_IDS.slice(1).map((id) => ({ id })) });
    await expect(prep.runPreflight(tx)).rejects.toThrow(/t1_normal/);
    expect(tx.writes).toEqual([]);
  });

  it('**缺夹具班级 → 拒绝**', async () => {
    const tx = fakeTx({ classes: [{ id: 'tc1' }] });
    await expect(prep.runPreflight(tx)).rejects.toThrow(/tc2/);
  });

  it('**缺夹具班主任 → 拒绝**', async () => {
    const tx = fakeTx({ teacher: [] });
    await expect(prep.runPreflight(tx)).rejects.toThrow(/t_stgteacher/);
  });

  it('**有启用的 NotificationConfig → 拒绝**', async () => {
    const tx = fakeTx({ notify: [{ enabled_configs: 2, sent_logs: 0 }] });
    await expect(prep.runPreflight(tx)).rejects.toThrow(/NotificationConfig/);
    expect(tx.writes).toEqual([]);
  });

  it('**已有 NotificationLog → 拒绝**', async () => {
    const tx = fakeTx({ notify: [{ enabled_configs: 0, sent_logs: 1 }] });
    await expect(prep.runPreflight(tx)).rejects.toThrow(/NotificationLog/);
    expect(tx.writes).toEqual([]);
  });
});

// ─────────────────────────────────────────────────────────────
// 10–13 —— 写入计划
// ─────────────────────────────────────────────────────────────

describe('AC-03/AC-08.10-13 写入计划', () => {
  let tx: ReturnType<typeof fakeTx>;

  beforeEach(async () => {
    tx = fakeTx();
    await prep.applyPreparation(tx, { day: DAY });
  });

  it('**tc1 与 tc2 都拿到当天的场次**', async () => {
    const inserts = tx.writes.filter((s) => s.includes('INSERT INTO "MorningQuizSession"'));
    expect(inserts).toHaveLength(2);
    for (const cls of ['tc1', 'tc2']) {
      const one = inserts.find((s) => s.includes(`'${cls}'`));
      expect(one, cls).toBeTruthy();
      expect(one).toContain(`'s7e_sess_${cls}'`);
      expect(one).toContain(`'${DAY}T00:00:00Z'`); // 当天（SGT 日历日）
      expect(one).toContain("'active'");
    }
  });

  it('返回两个场次 id 与账号数', async () => {
    const fresh = fakeTx();
    const out = await prep.applyPreparation(fresh, { day: DAY });
    expect(out).toEqual({ day: DAY, sessionIds: ['s7e_sess_tc1', 's7e_sess_tc2'], students: 8 });
  });

  it('**按外键倒序删**：AnswerScript → VocabQuizAttempt → StudentSubmission → DailyLessonCompletion', () => {
    const order = ['AnswerScript', 'VocabQuizAttempt', 'StudentSubmission', 'DailyLessonCompletion'].map(
      (t) => tx.writes.findIndex((s) => s.trim().startsWith(`DELETE FROM "${t}"`)),
    );
    expect(order.every((i) => i >= 0)).toBe(true);
    expect(order).toEqual([...order].sort((a, b) => a - b));
  });

  it('**四类删除都限定在这八个 id 上**', () => {
    for (const t of ['VocabQuizAttempt', 'StudentSubmission', 'DailyLessonCompletion']) {
      const sql = tx.writes.find((s) => s.trim().startsWith(`DELETE FROM "${t}"`))!;
      expect(sql, t).toContain('"studentId" IN (');
      for (const id of prep.S7E_STUDENT_IDS) expect(sql, `${t}/${id}`).toContain(`'${id}'`);
    }
    const ans = tx.writes.find((s) => s.includes('"AnswerScript"'))!;
    expect(ans).toContain('"studentId" IN (');
  });

  it('**不给任何账号预置阅读答卷** —— 一条 StudentSubmission 的 INSERT 都没有', () => {
    expect(tx.writes.filter((s) => s.includes('INSERT INTO "StudentSubmission"'))).toEqual([]);
    expect(tx.writes.filter((s) => s.includes('INSERT INTO "AnswerScript"'))).toEqual([]);
  });

  it('**凭据 / 令牌版本 / 分级 / 班级关系 / 生词本一个都不写**', () => {
    for (const table of prep.PRESERVED_TABLES) {
      const touched = tx.writes.filter(
        (s) => /^(INSERT|UPDATE)/.test(s.trim()) && s.includes(`"${table}"`),
      );
      expect(touched, `${table} 被写了`).toEqual([]);
    }
    const all = tx.writes.join('\n');
    for (const field of ['pinHash', 'passwordHash', 'studentAuthVersion', 'englishLevel']) {
      expect(all, field).not.toContain(field);
    }
  });

  it('**新建的记录全部在 s7e_ 保留前缀下**', () => {
    const ids = tx.writes
      .filter((s) => s.trim().startsWith('INSERT INTO'))
      .flatMap((s) => [...s.matchAll(/VALUES \(('([^']*)')/g)].map((m) => m[2]));
    expect(ids.length).toBeGreaterThan(0);
    for (const id of ids) expect(id.startsWith('s7e_'), id).toBe(true);
  });

  it('**重复执行收敛到同一个功能态**：两次跑出来的语句逐字相同', async () => {
    const a = fakeTx();
    const b = fakeTx();
    await prep.applyPreparation(a, { day: DAY });
    await prep.applyPreparation(b, { day: DAY });
    expect(a.writes).toEqual(b.writes);
    // 而且每一条要么是删除、要么是幂等插入（ON CONFLICT / 先删后插）
    for (const sql of a.writes) {
      const t = sql.trim();
      const idempotent =
        t.startsWith('DELETE') ||
        t.includes('ON CONFLICT') ||
        t.includes('INSERT INTO "PaperAssignment"') ||
        t.includes('INSERT INTO "MorningQuizSession"');
      expect(idempotent, t.slice(0, 90)).toBe(true);
    }
    // 先删后插的那两张表：DELETE 必须排在 INSERT 前面
    for (const table of ['PaperAssignment', 'MorningQuizSession']) {
        const del = a.writes.findIndex((s) => s.trim().startsWith(`DELETE FROM "${table}"`));
      const ins = a.writes.findIndex((s) => s.includes(`INSERT INTO "${table}"`));
      expect(del, table).toBeGreaterThanOrEqual(0);
      expect(del, table).toBeLessThan(ins);
    }
  });

  it('**日期只接受 YYYY-MM-DD**，别的形状直接拒绝（SQL 里唯一的动态量）', async () => {
    expect(() => prep.assertDayShape('2026-08-28')).not.toThrow();
    for (const bad of ["2026-08-28'; DROP TABLE \"User\"; --", '2026/08/28', '', 'today']) {
      expect(() => prep.assertDayShape(bad), bad).toThrow();
    }
    await expect(prep.applyPreparation(fakeTx(), { day: "x'; DROP TABLE" })).rejects.toThrow();
  });

  it('新加坡日历日按 UTC+8 取', () => {
    // 2026-08-28T17:00:00Z → 新加坡已是 8-29
    expect(prep.singaporeDay(Date.parse('2026-08-28T17:00:00Z'))).toBe('2026-08-29');
    expect(prep.singaporeDay(Date.parse('2026-08-28T15:59:00Z'))).toBe('2026-08-28');
  });
});

// ─────────────────────────────────────────────────────────────
// 11 —— 事务边界
// ─────────────────────────────────────────────────────────────

describe('AC-06/AC-08.11 事务与失败处理', () => {
  it('**只有一个事务，前置检查与写入都在里面**', () => {
    const src = fs.readFileSync(SCRIPT_PATH, 'utf8');
    expect(src.match(/\$transaction\(/g) ?? []).toHaveLength(1);
    const body = src.split('$transaction(')[1].split('printReceipt')[0];
    // 事务体是单独导出的 `prepareInTransaction` —— 它内部先检查后写入，
    // 由上面「事务体的真实组合」那一组用**行为**证明，不是靠这里扫字符串。
    expect(body).toContain('prepareInTransaction(tx');
    const fn = src.split('async function prepareInTransaction')[1].split('\n}')[0];
    expect(fn).toContain('runPreflight(tx)');
    expect(fn).toContain('applyPreparation(tx');
    // 事务回调之外没有任何写
    expect(src).not.toMatch(/prisma\.\$executeRaw/);
  });

  it('**断开连接写在 finally 里**', () => {
    const src = fs.readFileSync(SCRIPT_PATH, 'utf8');
    const finallyBlock = src.split('} finally {')[1] ?? '';
    expect(finallyBlock).toContain('$disconnect()');
  });

  it('**写入中途失败会向外抛**（由事务整体回滚）', async () => {
    const tx = fakeTx();
    let n = 0;
    tx.$executeRawUnsafe = async (sql: string) => {
      n += 1;
      if (n === 3) throw new Error('boom');
      tx.writes.push(sql);
      return 1;
    };
    await expect(prep.applyPreparation(tx, { day: DAY })).rejects.toThrow('boom');
    expect(tx.writes.length).toBeLessThan(5); // 后面的语句没继续发
  });

  it('**不安全 SQL 里只有仓库常量**：没有模板插值进来的外部输入', () => {
    const src = stripComments(fs.readFileSync(SCRIPT_PATH, 'utf8'));
    // 只看**带 SQL 关键字的模板串**里的插值 —— 那才是会拼进 SQL 的地方。
    const sqlTemplates = [...src.matchAll(/`([^`]*)`/g)]
      .map((m) => m[1])
      .filter((t) => /(INSERT INTO|DELETE FROM|SELECT|UPDATE)/.test(t));
    expect(sqlTemplates.length).toBeGreaterThan(5);
    const interpolations = sqlTemplates.flatMap((t) =>
      [...t.matchAll(/\$\{([^}]+)\}/g)].map((m) => m[1].trim()),
    );
    expect(interpolations.length).toBeGreaterThan(5);
    // 允许的只有：L()/J() 包装的本文件常量、ID_LIST、已校验的 day/dayStart、
    // at() 时刻辅助、循环下标，以及三个本文件里算出来的固定 id。
    const allowed = /^(L\(|J\(|ID_LIST$|dayStart$|at\('|i \+ 1$|S7E_CLASS_IDS\.map\(L\))/;
    for (const expr of interpolations) {
      expect(allowed.test(expr), `未登记的插值：${expr}`).toBe(true);
    }
    // 而 L()/J() 内部对外部输入做了转义
    expect(src).toContain(`replace(/'/g, "''")`);
  });
});

// ─────────────────────────────────────────────────────────────
// 14 —— 输出与密钥卫生
// ─────────────────────────────────────────────────────────────

describe('AC-07/AC-08.14 输出里不许出现任何密钥', () => {
  it('**回执只有日期 / 账号数 / 场次 id / 一句警告**，且不含哨兵密钥', () => {
    const lines: string[] = [];
    const spy = vi.spyOn(console, 'log').mockImplementation((...a: unknown[]) => {
      lines.push(a.map(String).join(' '));
    });
    prep.printReceipt({ day: DAY, sessionIds: ['s7e_sess_tc1', 's7e_sess_tc2'], students: 8 });
    spy.mockRestore();
    const out = lines.join('\n');
    expect(out).toContain(DAY);
    expect(out).toContain('8');
    expect(out).toContain('s7e_sess_tc1');
    expect(out).toMatch(/重置/);
    for (const secret of [
      'sentinel-secret',
      'sentinel-user',
      'sentinel-host',
      '6789',
      GOOD_ENV.DATABASE_URL,
      'postgresql://',
    ]) {
      expect(out, secret).not.toContain(secret);
    }
  });

  it('**闸门的报错信息里也不回显取值**', () => {
    for (const bad of [
      { ...GOOD_ENV, ALLOW_S7E_READING_PREP: 'sentinel-secret' },
      { ...GOOD_ENV, S7E_CONFIRM_RESET: 'sentinel-secret' },
    ]) {
      try {
        prep.assertEnvGates(bad);
        throw new Error('应该抛才对');
      } catch (e) {
        expect(String((e as Error).message)).not.toContain('sentinel-secret');
      }
    }
    // DATABASE_URL 缺失时也不回显任何连接串片段
    try {
      prep.assertEnvGates({ ...GOOD_ENV, DATABASE_URL: '' });
    } catch (e) {
      expect(String((e as Error).message)).not.toContain('postgresql://');
    }
  });

  it('**源码里没有任何口令 / 密钥 / PIN**，也不读 PIN', () => {
    const src = fs.readFileSync(SCRIPT_PATH, 'utf8');
    expect(src).not.toMatch(/STAGING_SEED_PIN|pinHash|passwordHash|bcrypt/);
    expect(src).not.toMatch(/postgres(ql)?:\/\/[^\s'"]*:[^\s'"]*@/);
    expect(src).not.toMatch(/\bpassword\s*[:=]\s*['"]/i);
  });

  it('**前置检查的报错不回显学生姓名**，只回显 id', async () => {
    const tx = fakeTx({ foreign: [{ id: 'real_student_001' }] });
    await expect(prep.runPreflight(tx)).rejects.toThrow(/real_student_001/);
    const q = tx.queries.find((s) => s.includes('s7e:foreign-students'))!;
    expect(q).not.toContain('u.name');
  });
});

// ─────────────────────────────────────────────────────────────
// 事务体的**真实组合** —— 不靠扫源码，跑真的那段代码
// ─────────────────────────────────────────────────────────────

describe('AC-06/AC-08.11 事务体：先检查、后写入', () => {
  it('**第一条写语句出现在所有前置读之后**', async () => {
    const order: string[] = [];
    const base = fakeTx();
    const tx = {
      ...base,
      async $queryRawUnsafe(sql: string) {
        order.push('READ');
        return base.$queryRawUnsafe(sql);
      },
      async $executeRawUnsafe(sql: string) {
        order.push('WRITE');
        return base.$executeRawUnsafe(sql);
      },
    };
    const out = await prep.prepareInTransaction(tx, { day: DAY });
    expect(out.sessionIds).toEqual(['s7e_sess_tc1', 's7e_sess_tc2']);
    const firstWrite = order.indexOf('WRITE');
    const lastRead = order.lastIndexOf('READ');
    expect(firstWrite).toBeGreaterThan(-1);
    expect(lastRead).toBeLessThan(firstWrite); // 所有读都排在第一条写之前
  });

  it('**前置检查不过 → 一条写都不发**（真的组合，不是源码断言）', async () => {
    const tx = fakeTx({ notify: [{ enabled_configs: 1, sent_logs: 0 }] });
    await expect(prep.prepareInTransaction(tx, { day: DAY })).rejects.toThrow(/NotificationConfig/);
    expect(tx.writes).toEqual([]);
  });

  it('**重复跑两次事务体，写语句序列逐字相同**（功能幂等）', async () => {
    const a = fakeTx();
    const b = fakeTx();
    await prep.prepareInTransaction(a, { day: DAY });
    await prep.prepareInTransaction(b, { day: DAY });
    expect(a.writes).toEqual(b.writes);
  });
});
