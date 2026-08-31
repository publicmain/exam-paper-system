/**
 * S12J AC-06 / AC-07 —— **重建的杀伤半径**。
 *
 * 用户那次失败的验收在 staging 上留下了 32 行不带 `s12f_` 前缀的业务数据
 * （一条当天任务行、一份答卷、一次词汇测试、十条逐题答案、十九条复习流水）。
 * S12F 原来的闸门看到这些行会**无条件拒绝重建** —— 于是账号卡死了：
 * 既修不好，又不能重来。
 *
 * S12J 把它改成：**先把整个账号导出成一份验过哈希的证据文件，然后按
 * 学生 id 删干净**。这份 spec 钉的就是这条路径的两个边界：
 *
 *   1. 删除语句**只可能**打到验收账号自己的行与 `s12f_` 前缀上 ——
 *      t1–t8 的任何一行都匹配不到；
 *   2. 没有验过哈希的导出，闸门必须继续拒绝。
 *
 * 全部是纯函数，不连库。
 */

import { describe, expect, it } from 'vitest';

// eslint-disable-next-line @typescript-eslint/no-var-requires
const fixture = require('../prepare-s12f-acceptance-account.js');

const {
  ACCOUNT,
  OWNED_PREFIX,
  FIXTURE_STUDENT_IDS,
  CONFIRMATION,
  EXPECTED_RAILWAY,
  wipeStatements,
  exportScopes,
  redactRow,
  assertRerunSafe,
  assertEnvGates,
} = fixture as {
  ACCOUNT: { id: string };
  OWNED_PREFIX: string;
  FIXTURE_STUDENT_IDS: string[];
  CONFIRMATION: string;
  EXPECTED_RAILWAY: Record<string, string>;
  wipeStatements: (opts?: { includeStray?: boolean }) => string[];
  exportScopes: () => Array<{ table: string; kind: string; where: string }>;
  redactRow: (row: Record<string, unknown>) => Record<string, unknown>;
  assertRerunSafe: (state: Record<string, unknown>) => boolean;
  assertEnvGates: (env: Record<string, string>) => void;
};

const A = ACCOUNT.id;
const BOTH: Array<[string, string[]]> = [
  ['只删前缀', wipeStatements()],
  ['按学生 id 删干净', wipeStatements({ includeStray: true })],
];

/** 一条 DELETE 的表名。 */
function tableOf(stmt: string): string {
  const m = /^DELETE FROM "([A-Za-z]+)"/.exec(stmt);
  if (!m) throw new Error(`不是一条 DELETE：${stmt}`);
  return m[1];
}

describe('S12J —— 重建的删除范围', () => {
  it.each(BOTH)('%s：每一条 DELETE 都被限定在本账号或 s12f_ 前缀上', (_label, stmts) => {
    expect(stmts.length).toBeGreaterThan(0);
    for (const stmt of stmts) {
      const scoped =
        stmt.includes(`"studentId" = '${A}'`) ||
        stmt.includes(`id LIKE '${OWNED_PREFIX}%'`) ||
        new RegExp(
          `IN \\(SELECT id FROM "[A-Za-z]+" WHERE "studentId" = '${A}'\\)`,
        ).test(stmt);
      expect(scoped, `这条 DELETE 没有被限定范围：\n${stmt}`).toBe(true);
    }
  });

  it.each(BOTH)('%s：一条都不会碰到 t1–t8', (_label, stmts) => {
    expect(FIXTURE_STUDENT_IDS.length).toBe(8);
    for (const stmt of stmts) {
      for (const other of FIXTURE_STUDENT_IDS) {
        expect(stmt.includes(other), `${other} 出现在删除语句里：\n${stmt}`).toBe(false);
      }
    }
  });

  it.each(BOTH)('%s：全部是 DELETE，没有 UPDATE / TRUNCATE / DROP', (_label, stmts) => {
    for (const stmt of stmts) {
      expect(stmt.startsWith('DELETE FROM "')).toBe(true);
      expect(/\b(UPDATE|TRUNCATE|DROP|ALTER)\b/i.test(stmt)).toBe(false);
    }
  });

  it.each(BOTH)('%s：没有一条 DELETE 是无 WHERE 的', (_label, stmts) => {
    for (const stmt of stmts) expect(stmt).toMatch(/ WHERE /);
  });

  it('按学生 id 删时，`User` 行本身不在删除范围里（账号是 upsert 的）', () => {
    for (const stmt of wipeStatements({ includeStray: true })) {
      expect(tableOf(stmt)).not.toBe('User');
    }
  });

  it('保守路径删不掉不带前缀的行 —— 这正是账号卡死的原因', () => {
    const conservative = wipeStatements();
    const byStudentOnly = conservative.filter(
      (s) => s.includes(`"studentId" = '${A}'`) && !s.includes('LIKE'),
    );
    expect(byStudentOnly).toHaveLength(0);
  });

  it('放开之后，账号名下每一张业务表都真的被按 id 清了', () => {
    const stray = wipeStatements({ includeStray: true }).map(tableOf);
    for (const t of [
      'DailyLessonCompletion',
      'StudentSubmission',
      'AnswerScript',
      'VocabQuizAttempt',
      'StudentWord',
      'WordReviewLog',
      'MistakeEntry',
      'Attendance',
      'StudentPageView',
      'GradeAppeal',
    ]) {
      expect(stray, `${t} 没被清`).toContain(t);
    }
  });

  it('删除顺序从叶到根 —— 子表排在父表前面', () => {
    const order = wipeStatements({ includeStray: true }).map(tableOf);
    const at = (t: string) => order.indexOf(t);
    const before: Array<[string, string]> = [
      ['WordReviewLog', 'StudentWord'],
      ['AnswerScript', 'StudentSubmission'],
      ['GradeAppeal', 'StudentSubmission'],
      ['MistakeEntry', 'StudentSubmission'],
      ['MistakeEntry', 'PaperQuestion'],
      ['VocabQuizAttempt', 'DailyLessonCompletion'],
      ['Attendance', 'MorningQuizSession'],
      ['MorningQuizSession', 'PaperAssignment'],
      ['PaperAssignment', 'Paper'],
      ['PaperQuestion', 'Paper'],
      ['PaperQuestion', 'Question'],
      ['StudentSubmission', 'PaperAssignment'],
    ];
    for (const [child, parent] of before) {
      expect(at(child), `${child} 应排在 ${parent} 前面`).toBeGreaterThanOrEqual(0);
      expect(at(parent), `${parent} 不在删除列表里`).toBeGreaterThanOrEqual(0);
      expect(at(child), `${child} 排在了 ${parent} 后面`).toBeLessThan(at(parent));
    }
  });
});

describe('S12J —— 导出范围与删除范围配对', () => {
  it('凡是重建会删的表，都先在导出范围里', () => {
    const exported = new Set(exportScopes().map((s) => s.table));
    for (const stmt of wipeStatements({ includeStray: true })) {
      expect(exported, `${tableOf(stmt)} 会被删，却没被导出`).toContain(tableOf(stmt));
    }
  });

  it('导出范围同样只认本账号与 s12f_ 前缀', () => {
    for (const scope of exportScopes()) {
      const scoped =
        scope.where.includes(`'${A}'`) || scope.where.includes(`LIKE '${OWNED_PREFIX}%'`);
      expect(scoped, `${scope.table} 的导出条件没有限定范围：${scope.where}`).toBe(true);
      for (const other of FIXTURE_STUDENT_IDS) {
        expect(scope.where.includes(other)).toBe(false);
      }
    }
  });

  it('导出的是账号本身与它的业务行，不是整库', () => {
    const tables = exportScopes().map((s) => s.table);
    expect(tables).toContain('User');
    expect(tables).not.toContain('DictEntry'); // 共享词典不属于这个账号
    expect(new Set(tables).size).toBe(tables.length); // 没有重复
  });
});

describe('S12J —— 凭据不落盘', () => {
  it('遮掉密码 / PIN / 令牌 / 二维码密钥，其余字段原样保留', () => {
    const row = redactRow({
      id: 's12f_acceptance_student',
      name: '林清和',
      passwordHash: '$2a$10$abcdefghijklmnopqrstuv',
      pinHash: '$2a$10$zyxwvutsrqponmlkjihgfe',
      qrSecret: 's12f-fixture-qr-secret-not-used',
      resetToken: 'abc123',
      studentAuthVersion: 3,
      totalScore: 7,
    });
    expect(row.passwordHash).toBe('[redacted]');
    expect(row.pinHash).toBe('[redacted]');
    expect(row.qrSecret).toBe('[redacted]');
    expect(row.resetToken).toBe('[redacted]');
    expect(row.name).toBe('林清和');
    expect(row.studentAuthVersion).toBe(3);
    expect(row.totalScore).toBe(7);
  });

  it('空的凭据字段保持为 null，不会变成字符串 `[redacted]`', () => {
    expect(redactRow({ pinHash: null }).pinHash).toBeNull();
  });

  it('bigint 转成字符串（JSON 序列化不了 bigint）', () => {
    expect(redactRow({ n: BigInt(9007199254740993n) }).n).toBe('9007199254740993');
  });
});

describe('S12J —— 没有验过哈希的导出就不许删', () => {
  const clean = {
    dlcToday: 0,
    submissionsToday: 0,
    scriptsToday: 0,
    attendanceToday: 0,
    attemptsToday: 0,
    reviewLogsToday: 0,
    mistakePracticeToday: 0,
    appealsToday: 0,
  };
  const base = { accountExists: true, foreignOwnedRows: 32, currentDay: clean };
  const goodExport = { verified: true, sha256: 'a'.repeat(64), accountRows: 640 };

  it('有用户造的行、却没有导出 —— 拒绝', () => {
    expect(() => assertRerunSafe({ ...base })).toThrow(/没被导出|不带 s12f_ 前缀/);
  });

  it('导出没通过读回校验 —— 拒绝', () => {
    expect(() =>
      assertRerunSafe({ ...base, evidenceExport: { ...goodExport, verified: false } }),
    ).toThrow(/没被导出/);
  });

  it('哈希长度不对 —— 拒绝', () => {
    expect(() =>
      assertRerunSafe({ ...base, evidenceExport: { ...goodExport, sha256: 'deadbeef' } }),
    ).toThrow(/没被导出/);
  });

  it('导出的行数少于要删的行数 —— 拒绝', () => {
    expect(() =>
      assertRerunSafe({ ...base, evidenceExport: { ...goodExport, accountRows: 3 } }),
    ).toThrow(/少于要删的/);
  });

  it('导出齐了 —— 放行', () => {
    expect(assertRerunSafe({ ...base, evidenceExport: goodExport })).toBe(true);
  });

  it('本来就没有用户造的行时，不需要导出也能重跑', () => {
    expect(
      assertRerunSafe({ accountExists: true, foreignOwnedRows: 0, currentDay: clean }),
    ).toBe(true);
  });

  it('当天已经被动过 —— 无论导出与否都拒绝', () => {
    expect(() =>
      assertRerunSafe({
        ...base,
        evidenceExport: goodExport,
        currentDay: { ...clean, dlcToday: 1 },
      }),
    ).toThrow();
  });
});

describe('S12J —— 导出目录是一道闸门', () => {
  const env = () => ({
    ...EXPECTED_RAILWAY,
    DATABASE_PUBLIC_URL: 'postgresql://u:p@proxy.example.test:41234/railway',
    RAILWAY_TCP_PROXY_DOMAIN: 'proxy.example.test',
    RAILWAY_TCP_PROXY_PORT: '41234',
    S12F_EXPORT_DIR: 'C:/tmp/s12j',
    S12F_CONFIRM: CONFIRMATION,
    S12F_ACCEPTANCE_PIN: '40718293',
  });

  it('给全了就过', () => {
    expect(() => assertEnvGates(env())).not.toThrow();
  });

  it('没给导出目录就拒绝执行', () => {
    const e = env();
    delete (e as Record<string, unknown>).S12F_EXPORT_DIR;
    expect(() => assertEnvGates(e)).toThrow(/S12F_EXPORT_DIR/);
  });

  it('导出目录是空串也拒绝', () => {
    expect(() => assertEnvGates({ ...env(), S12F_EXPORT_DIR: '' })).toThrow(/S12F_EXPORT_DIR/);
  });

  it('这道闸排在确认串之前 —— 目录缺了就不会先报确认串的错', () => {
    const e = env();
    delete (e as Record<string, unknown>).S12F_EXPORT_DIR;
    delete (e as Record<string, unknown>).S12F_CONFIRM;
    expect(() => assertEnvGates(e)).toThrow(/S12F_EXPORT_DIR/);
  });
});
