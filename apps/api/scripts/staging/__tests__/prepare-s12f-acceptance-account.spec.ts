/**
 * S12F 验收账号夹具的行为测试。
 *
 * 跑的是脚本**真的导出的那些函数**：闸门、数据计划、分布断言、只读前置、
 * 写入、回读。事务客户端是一个记录读写顺序的假对象 —— **不连任何数据库**，
 * 也不声称任何 staging 结论。
 *
 * 模块缺失时整套仍然要能收集并执行：每条用例各自红，而不是整份文件炸掉。
 * 这正是 AC-02 要求的「结构性 RED 也必须是量出来的」。
 */
import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';

const requireCjs = createRequire(__filename);
const SCRIPT_PATH = path.resolve(__dirname, '..', 'prepare-s12f-acceptance-account.js');

type Plan = {
  todayIso: string;
  readingDays: any[];
  lessonDays: any[];
  attempts: any[];
  words: any[];
  reviewLogs: any[];
  mistakes: any[];
  appeals: any[];
  today: any;
};

type Prep = {
  CONFIRMATION: string;
  OWNED_PREFIX: string;
  EXPECTED_RAILWAY: Record<string, string>;
  FIXTURE_STUDENT_IDS: string[];
  REUSED: { teacherId: string; subjectId: string };
  ACCOUNT: Record<string, string>;
  RESERVED_LOOKUP_WORD: string;
  FILL_TARGET_SORT_ORDER: number;
  CANDIDATE_WORDS: string[];
  TODAY_PASSAGE: string;
  validateAcceptancePin(pin: unknown): string | null;
  assertEnvGates(env: Record<string, string>): void;
  singaporeDay(nowMs?: number): string;
  dayMinus(iso: string, n: number): string;
  sgtInstant(iso: string, hhmmss: string): Date;
  dayBefore(todayIso: string, daysAgo: number, hhmmss: string): Date;
  ownedIdsOf(plan: Plan): string[];
  assertOwnedPrefix(ids: string[]): boolean;
  buildPlan(input: { todayIso: string; words: string[] }): Plan;
  distributionsOf(plan: Plan): Record<string, number>;
  assertDistributions(plan: Plan): Record<string, number>;
  currentDayViolations(counts: Record<string, number>): string[];
  assertCurrentDayPristine(counts: Record<string, number>, where: string): boolean;
  assertRerunSafe(state: any): boolean;
  runPreflight(tx: any, plan: Plan): Promise<any>;
  selectWords(tx: any): Promise<string[]>;
  wipeOwned(tx: any): Promise<void>;
  writeAll(tx: any, plan: Plan, pinHash: string, pw: string): Promise<void>;
  verifyAfterWrite(tx: any, plan: Plan): Promise<any>;
};

let loadError: unknown = null;
let loaded: Prep | null = null;
try {
  loaded = requireCjs(SCRIPT_PATH) as Prep;
} catch (e) {
  loadError = e;
}

/** 模块不在就在**用例内部**红，整套仍然收集得起来。 */
function mod(): Prep {
  if (!loaded) {
    throw new Error(
      `S12F 夹具模块尚未实现：${path.relative(process.cwd(), SCRIPT_PATH)} 无法加载` +
        (loadError instanceof Error ? `（${loadError.message.split('\n')[0]}）` : ''),
    );
  }
  return loaded;
}

function sourceText(): string {
  if (!fs.existsSync(SCRIPT_PATH)) throw new Error('S12F 夹具脚本文件不存在，无法做源码扫描');
  return fs.readFileSync(SCRIPT_PATH, 'utf8');
}

function stripComments(src: string): string {
  return src.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:])\/\/.*$/gm, '$1');
}

// ─────────────────────────────────────────────────────────────
// 假事务客户端 —— 记录每一次读、每一次写，以及它们的先后
// ─────────────────────────────────────────────────────────────

type Ev = { kind: 'read' | 'write'; what: string; args?: any };

function fakeTx(overrides: Record<string, any[]> = {}) {
  const events: Ev[] = [];
  const reads: Record<string, any[]> = {
    dictionary: (loaded?.CANDIDATE_WORDS ?? []).slice(0, 60).map((w) => ({ word: w })),
    'reserved-word': [{ word: loaded?.RESERVED_LOOKUP_WORD ?? 'blossom' }],
    'notification-guards': [{ enabled_configs: 0, sent_logs: 0 }],
    'student-roster': (loaded?.FIXTURE_STUDENT_IDS ?? []).map((id) => ({ id })),
    'reused-resources': [{ teacher: 1, subject: 1 }],
    'current-day': [
      {
        dlcToday: 0,
        submissionsToday: 0,
        scriptsToday: 0,
        attendanceToday: 0,
        attemptsToday: 0,
        reviewLogsToday: 0,
        mistakePracticeToday: 0,
        appealsToday: 0,
      },
    ],
    'stray-rows': [{ foreignOwnedRows: 0 }],
    readback: [{}],
    ...overrides,
  };

  const tagOf = (sql: string): string => {
    const m = /\/\* s12f:([a-z-]+) \*\//.exec(sql);
    return m ? m[1] : 'untagged';
  };

  const modelProxy = (model: string) =>
    new Proxy(
      {},
      {
        get: (_t, op: string) => (args: any) => {
          events.push({ kind: 'write', what: `${model}.${op}`, args });
          return Promise.resolve({});
        },
      },
    );

  const tx: any = new Proxy(
    {
      $queryRawUnsafe: (sql: string) => {
        const tag = tagOf(sql);
        events.push({ kind: 'read', what: tag, args: sql });
        return Promise.resolve(reads[tag] ?? []);
      },
      $executeRawUnsafe: (sql: string) => {
        events.push({ kind: 'write', what: `sql:${tagOf(sql)}`, args: sql });
        return Promise.resolve(0);
      },
    },
    {
      get: (t: any, prop: string) => {
        if (prop in t) return t[prop];
        if (typeof prop !== 'string' || prop.startsWith('$')) return undefined;
        return modelProxy(prop);
      },
    },
  );

  return { tx, events };
}

const GOOD_ENV = () => ({
  ...mod().EXPECTED_RAILWAY,
  DATABASE_PUBLIC_URL: 'postgresql://sentinel-user:sentinel-secret@proxy.sentinel.example:47111/railway',
  RAILWAY_TCP_PROXY_DOMAIN: 'proxy.sentinel.example',
  RAILWAY_TCP_PROXY_PORT: '47111',
  S12F_CONFIRM: mod().CONFIRMATION,
  S12F_ACCEPTANCE_PIN: '40718253',
});

const DAY = '2026-09-01';

function planOf(): Plan {
  const p = mod();
  return p.buildPlan({ todayIso: DAY, words: p.CANDIDATE_WORDS.slice(0, 50) });
}

// ─────────────────────────────────────────────────────────────
// 1. 模块存在（结构性 RED 的第一条）
// ─────────────────────────────────────────────────────────────

describe('S12F —— 夹具模块', () => {
  it('存在，且导出闸门 / 计划 / 前置 / 写入这四组能力', () => {
    const p = mod();
    for (const fn of [
      'assertEnvGates',
      'validateAcceptancePin',
      'buildPlan',
      'assertDistributions',
      'ownedIdsOf',
      'assertOwnedPrefix',
      'runPreflight',
      'wipeOwned',
      'writeAll',
      'verifyAfterWrite',
      'assertRerunSafe',
      'assertCurrentDayPristine',
    ]) {
      expect(typeof (p as any)[fn], `缺少导出 ${fn}`).toBe('function');
    }
  });

  it('脚本本身在闸门通过之前不 require @prisma/client', () => {
    const src = stripComments(sourceText());
    const idx = src.indexOf("require('@prisma/client')");
    expect(idx, '根本没有加载 Prisma？').toBeGreaterThan(0);
    // 顶层 require 会在 import 时就连库。必须在 main() 里、assertEnvGates 之后。
    expect(src.slice(0, idx)).toContain('assertEnvGates()');
    expect(/^const .*require\('@prisma\/client'\)/m.test(src)).toBe(false);
  });
});

// ─────────────────────────────────────────────────────────────
// 2. 环境闸门
// ─────────────────────────────────────────────────────────────

describe('S12F —— 环境与确认闸门', () => {
  it('全部满足时放行', () => {
    expect(() => mod().assertEnvGates(GOOD_ENV())).not.toThrow();
  });

  const cases: Array<[string, Record<string, string>]> = [
    ['项目 id 不对', { RAILWAY_PROJECT_ID: '00000000-0000-0000-0000-000000000000' }],
    ['项目名不对', { RAILWAY_PROJECT_NAME: 'exam-paper-system' }],
    ['环境不对', { RAILWAY_ENVIRONMENT_NAME: 'staging' }],
    ['服务不对', { RAILWAY_SERVICE_NAME: 'stg-api' }],
    ['代理主机名不对', { RAILWAY_TCP_PROXY_DOMAIN: 'somewhere.else.example' }],
    ['代理端口不对', { RAILWAY_TCP_PROXY_PORT: '1' }],
    ['缺确认串', { S12F_CONFIRM: '' }],
    ['确认串写错', { S12F_CONFIRM: 'yes' }],
    ['连接串畸形', { DATABASE_PUBLIC_URL: 'not-a-postgres-url' }],
    ['连接串没有端口', { DATABASE_PUBLIC_URL: 'postgresql://u:p@proxy.sentinel.example/railway' }],
    ['连接串没有库名', { DATABASE_PUBLIC_URL: 'postgresql://u:p@proxy.sentinel.example:47111/' }],
  ];
  for (const [label, patch] of cases) {
    it(`拒绝：${label}`, () => {
      expect(() => mod().assertEnvGates({ ...GOOD_ENV(), ...patch })).toThrow();
    });
  }

  it('拒绝时不回显任何取值（连接串 / 主机 / 端口 / PIN 都不出现）', () => {
    const env = { ...GOOD_ENV(), RAILWAY_TCP_PROXY_PORT: '1' };
    let msg = '';
    try {
      mod().assertEnvGates(env);
    } catch (e) {
      msg = (e as Error).message;
    }
    expect(msg.length).toBeGreaterThan(0);
    for (const secret of [
      'sentinel-user',
      'sentinel-secret',
      'proxy.sentinel.example',
      '47111',
      '40718253',
      env.DATABASE_PUBLIC_URL,
    ]) {
      expect(msg, `错误信息里泄漏了 ${secret}`).not.toContain(secret);
    }
  });
});

// ─────────────────────────────────────────────────────────────
// 3. PIN
// ─────────────────────────────────────────────────────────────

describe('S12F —— PIN', () => {
  it('只接受八位数字', () => {
    const p = mod();
    expect(p.validateAcceptancePin('40718253')).toBeNull();
    expect(p.validateAcceptancePin('4071825')).toBe('pin_must_be_8_digits');
    expect(p.validateAcceptancePin('407182534')).toBe('pin_must_be_8_digits');
    expect(p.validateAcceptancePin('4071825a')).toBe('pin_must_be_8_digits');
    expect(p.validateAcceptancePin('')).toBe('pin_must_be_8_digits');
    expect(p.validateAcceptancePin(undefined)).toBe('pin_must_be_8_digits');
  });

  it('挡住全同与顺子', () => {
    const p = mod();
    expect(p.validateAcceptancePin('11111111')).toBe('pin_too_weak');
    expect(p.validateAcceptancePin('12345678')).toBe('pin_too_weak');
    expect(p.validateAcceptancePin('87654321')).toBe('pin_too_weak');
  });

  it('缺 PIN / PIN 不合格时环境闸门拒绝', () => {
    expect(() => mod().assertEnvGates({ ...GOOD_ENV(), S12F_ACCEPTANCE_PIN: '' })).toThrow();
    expect(() => mod().assertEnvGates({ ...GOOD_ENV(), S12F_ACCEPTANCE_PIN: '1234567' })).toThrow();
    expect(() => mod().assertEnvGates({ ...GOOD_ENV(), S12F_ACCEPTANCE_PIN: '12345678' })).toThrow();
  });

  it('源码里没有默认 PIN、没有八位数字字面量、没有 bcrypt 摘要', () => {
    const src = stripComments(sourceText());
    expect(/\b\d{8}\b/.test(src), '源码里出现了八位数字字面量').toBe(false);
    expect(/\$2[aby]\$/.test(src), '源码里出现了 bcrypt 摘要').toBe(false);
    expect(/S12F_ACCEPTANCE_PIN\s*\|\|\s*['"][^'"]/.test(src), '给 PIN 留了默认值').toBe(false);
  });

  it('回执里不插值任何 PIN 相关的东西', () => {
    const src = stripComments(sourceText());
    const logs = src.match(/console\.log\([\s\S]*?\n\s*\);/g) ?? [];
    expect(logs.length).toBeGreaterThan(0);
    for (const block of logs) {
      const interps = block.match(/\$\{[^}]*\}/g) ?? [];
      for (const i of interps) {
        expect(/pin/i.test(i), `回执插值了 ${i}`).toBe(false);
      }
    }
  });
});

// ─────────────────────────────────────────────────────────────
// 4. 拥有的 id —— 前缀隔离
// ─────────────────────────────────────────────────────────────

describe('S12F —— 拥有的资源', () => {
  it('计划里每一个待写 id 都带 s12f_ 前缀', () => {
    const p = mod();
    const ids = p.ownedIdsOf(planOf());
    expect(ids.length).toBeGreaterThan(200);
    expect(() => p.assertOwnedPrefix(ids)).not.toThrow();
    expect(ids.every((id) => id.startsWith(p.OWNED_PREFIX))).toBe(true);
  });

  it('id 全局唯一 —— 不会自己撞自己', () => {
    const ids = mod().ownedIdsOf(planOf());
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('混进一个没有前缀的 id 就拒绝', () => {
    const p = mod();
    expect(() => p.assertOwnedPrefix([...p.ownedIdsOf(planOf()), 't6_done'])).toThrow();
  });

  it('计划是确定性的 —— 同样输入两次结果一致', () => {
    expect(JSON.stringify(planOf())).toBe(JSON.stringify(planOf()));
  });

  it('删除语句只打自己的前缀，一个 t1–t8 的 id 都不出现', async () => {
    const p = mod();
    const { tx, events } = fakeTx();
    await p.wipeOwned(tx);
    const sqls = events.filter((e) => e.kind === 'write').map((e) => String(e.args));
    expect(sqls.length).toBeGreaterThan(5);
    for (const s of sqls) {
      expect(/^\s*\/\* s12f:wipe \*\/\s*DELETE/.test(s), `不是受控的 DELETE：${s}`).toBe(true);
      expect(s).toContain(p.OWNED_PREFIX);
      for (const id of p.FIXTURE_STUDENT_IDS) expect(s).not.toContain(id);
    }
  });
});

// ─────────────────────────────────────────────────────────────
// 5. 账号身份与普通登录
// ─────────────────────────────────────────────────────────────

describe('S12F —— 账号身份', () => {
  it('固定 id / 姓名 / example.invalid 邮箱 / ielts_authentic', () => {
    const a = mod().ACCOUNT;
    expect(a.id).toBe('s12f_acceptance_student');
    expect(a.name).toBe('验收学生林思远');
    expect(a.email.endsWith('@example.invalid')).toBe(true);
    expect(a.englishLevel).toBe('ielts_authentic');
  });

  it('写出来的是学生、在读、未归档、authVersion 归零，且带 pinHash', async () => {
    const p = mod();
    const { tx, events } = fakeTx();
    await p.writeAll(tx, planOf(), 'HASH-PLACEHOLDER', 'PW-PLACEHOLDER');
    const userWrite = events.find((e) => e.what.startsWith('user.'));
    expect(userWrite, '没有写 User').toBeTruthy();
    const create = userWrite!.args.create;
    expect(create.id).toBe(p.ACCOUNT.id);
    expect(create.role).toBe('student');
    expect(create.isActive).toBe(true);
    expect(create.archivedAt).toBeUndefined();
    expect(create.studentAuthVersion).toBe(0);
    expect(create.pinHash).toBe('HASH-PLACEHOLDER');
    expect(create.passwordHash).toBe('PW-PLACEHOLDER');
    expect(create.passwordHash).not.toBe(create.pinHash);
  });

  it('进了一个专属的、未归档的班，角色是 student', async () => {
    const p = mod();
    const { tx, events } = fakeTx();
    await p.writeAll(tx, planOf(), 'H', 'P');
    const cls = events.find((e) => e.what.startsWith('class.'));
    expect(cls!.args.create.id).toBe(p.ACCOUNT.classId);
    const enroll = events.find((e) => e.what.startsWith('classEnrollment.'));
    expect(enroll!.args.create.role).toBe('student');
    expect(enroll!.args.create.userId).toBe(p.ACCOUNT.id);
    const level = events.find((e) => e.what.startsWith('classEnglishLevel.'));
    expect(level!.args.create.level).toBe('ielts_authentic');
  });

  it('不给这个账号开任何免密 / 特殊路由：源码里没有 staging-fixture 相关字样', () => {
    const src = stripComments(sourceText());
    for (const bad of ['staging-fixture', 'stagingFixture', 'STAGING_FIXTURE', 'passwordless']) {
      expect(src, `脚本里出现了 ${bad}`).not.toContain(bad);
    }
    expect(src).not.toContain("role: 'teacher'");
    expect(src).not.toContain("role: 'admin'");
  });
});

// ─────────────────────────────────────────────────────────────
// 6. 历史分布与分数自洽
// ─────────────────────────────────────────────────────────────

describe('S12F —— 历史数据分布', () => {
  it('满足合同里的每一条「至少」', () => {
    expect(() => mod().assertDistributions(planOf())).not.toThrow();
  });

  it('阅读：12 份答卷 / 10 判完 / 2 待判 / 标题各不相同', () => {
    const d = mod().distributionsOf(planOf());
    expect(d.readingSubmissions).toBeGreaterThanOrEqual(10);
    expect(d.markedSubmissions).toBeGreaterThanOrEqual(8);
    expect(d.pendingSubmissions).toBeGreaterThanOrEqual(2);
    expect(d.distinctTitles).toBe(d.readingSubmissions);
    expect(d.zeroScore).toBeGreaterThanOrEqual(1);
    expect(d.highScore).toBeGreaterThanOrEqual(1);
    expect(d.midScore).toBeGreaterThanOrEqual(1);
  });

  it('逐题答案四种形态齐全（对 / 半对 / 错但非空 / 少量空白）', () => {
    const d = mod().distributionsOf(planOf());
    expect(d.scriptsCorrect).toBeGreaterThanOrEqual(1);
    expect(d.scriptsPartial).toBeGreaterThanOrEqual(1);
    expect(d.scriptsWrong).toBeGreaterThanOrEqual(1);
    expect(d.scriptsBlank).toBeGreaterThanOrEqual(1);
    // 空白只能是少数
    const total = d.readingSubmissions * 6;
    expect(d.scriptsBlank).toBeLessThan(total * 0.15);
  });

  it('分数自洽：逐题得分之和 == totalScore，且不超过满分', () => {
    for (const day of planOf().readingDays) {
      const sum = day.scripts.reduce((a: number, s: any) => a + (s.awarded || 0), 0);
      if (day.marked) {
        expect(sum, `${day.title} 的逐题得分之和对不上`).toBe(day.totalScore);
        expect(day.totalScore).toBeLessThanOrEqual(day.maxScore);
      } else {
        expect(day.totalScore).toBeNull();
      }
    }
  });

  it('历史日期都在昨天或更早，且各不相同', () => {
    const plan = planOf();
    const days = plan.readingDays.map((d: any) => d.dayIso);
    expect(new Set(days).size).toBe(days.length);
    for (const d of days) expect(d < DAY).toBe(true);
    for (const l of plan.lessonDays) expect(l.dayIso < DAY).toBe(true);
  });

  it('正式测试：≥10 次、四种题型齐、有 0 分有满分、都挂在任务行上、今天没有', () => {
    const d = mod().distributionsOf(planOf());
    expect(d.attempts).toBeGreaterThanOrEqual(10);
    expect(d.attemptQTypes).toBe(4);
    expect(d.attemptZero).toBeGreaterThanOrEqual(1);
    expect(d.attemptFull).toBeGreaterThanOrEqual(1);
    expect(d.attemptMid).toBeGreaterThanOrEqual(1);
    expect(d.attemptsLinked).toBe(d.attempts);
    expect(d.attemptToday).toBe(0);
  });

  it('答卷写库时不编造百分比字段', async () => {
    const p = mod();
    const { tx, events } = fakeTx();
    await p.writeAll(tx, planOf(), 'H', 'P');
    const subs = events.filter((e) => e.what === 'studentSubmission.create');
    expect(subs.length).toBeGreaterThanOrEqual(10);
    for (const s of subs) {
      expect(Object.keys(s.args.data)).not.toContain('percentage');
      expect(Object.keys(s.args.data)).not.toContain('percent');
    }
  });
});

// ─────────────────────────────────────────────────────────────
// 7. 生词与错题分布
// ─────────────────────────────────────────────────────────────

describe('S12F —— 生词本', () => {
  it('50 个词，五种状态的量都够', () => {
    const d = mod().distributionsOf(planOf());
    expect(d.words).toBe(50);
    expect(d.wordsNew).toBeGreaterThanOrEqual(8);
    expect(d.wordsLearning).toBeGreaterThanOrEqual(8);
    expect(d.wordsReview).toBeGreaterThanOrEqual(10);
    expect(d.wordsRelearning).toBeGreaterThanOrEqual(4);
    expect(d.wordsKnown).toBeGreaterThanOrEqual(6);
  });

  it('到期 ≥15、将来 ≥10、来源不止一种', () => {
    const d = mod().distributionsOf(planOf());
    expect(d.wordsDue).toBeGreaterThanOrEqual(15);
    expect(d.wordsFuture).toBeGreaterThanOrEqual(10);
    expect(d.wordSources).toBeGreaterThanOrEqual(2);
    expect(d.wordsDue + d.wordsFuture).toBe(50);
  });

  it('每个词都有语境句，且句子里真的含有那个词形', () => {
    for (const w of planOf().words) {
      expect(w.contextSentence.length).toBeGreaterThan(20);
      expect(new RegExp(`\\b${w.surfaceForm}\\b`, 'i').test(w.contextSentence)).toBe(true);
      expect(w.sourcePassageTitle.length).toBeGreaterThan(3);
      expect(w.surfaceForm).toBe(w.headword);
    }
  });

  it('今天开得出四种题型的正式测试：教过 + 到期 + reps>0 + 可拼写可挖空 ≥4', () => {
    const d = mod().distributionsOf(planOf());
    expect(d.wordsTaughtAndDue).toBeGreaterThanOrEqual(4);
    expect(d.wordsQuizCapable).toBeGreaterThanOrEqual(4);
  });

  it('复习流水跨 ≥10 天、评分不止一种、用时各不相同', () => {
    const d = mod().distributionsOf(planOf());
    expect(d.reviewLogs).toBeGreaterThanOrEqual(50);
    expect(d.reviewLogDays).toBeGreaterThanOrEqual(10);
    expect(d.reviewRatings).toBeGreaterThanOrEqual(3);
    const elapsed = new Set(planOf().reviewLogs.map((r: any) => r.elapsedMs));
    expect(elapsed.size).toBeGreaterThan(5);
  });

  it('没教过的词不带 firstTaughtAt，教过的都带', () => {
    for (const w of planOf().words) {
      if (w.state === 'new') expect(w.firstTaughtDaysAgo).toBeNull();
      else expect(w.firstTaughtDaysAgo).toBeGreaterThan(0);
    }
  });
});

describe('S12F —— 错题本', () => {
  it('20 条、题型 ≥5 种、三种原因齐、销账与未销账都有', () => {
    const d = mod().distributionsOf(planOf());
    expect(d.mistakes).toBe(20);
    expect(d.mistakeTaskTypes).toBeGreaterThanOrEqual(5);
    expect(d.mistakeReasons).toBe(3);
    expect(d.mistakesResolved).toBeGreaterThanOrEqual(1);
    expect(d.mistakesUnresolved).toBeGreaterThanOrEqual(5);
  });

  it('练习次数 0–3 都有，连对次数 0 和 1 都有，且有从没练过的', () => {
    const plan = planOf();
    const counts = new Set(plan.mistakes.map((m: any) => m.practiceCount));
    for (const n of [0, 1, 2, 3]) expect(counts.has(n), `缺少 practiceCount=${n}`).toBe(true);
    const streaks = new Set(plan.mistakes.map((m: any) => m.correctStreak));
    expect(streaks.has(0)).toBe(true);
    expect(streaks.has(1)).toBe(true);
    expect(plan.mistakes.some((m: any) => m.practiceCount === 0 && m.practicedDaysAgo == null)).toBe(true);
  });

  it('每条错题都指向真实存在的历史答卷与卷题，且组合唯一', () => {
    const plan = planOf();
    const subs = new Set(plan.readingDays.map((d: any) => d.submissionId));
    const pqs = new Set(plan.readingDays.flatMap((d: any) => d.questions.map((q: any) => q.paperQuestionId)));
    const seen = new Set<string>();
    for (const m of plan.mistakes) {
      expect(subs.has(m.submissionId)).toBe(true);
      expect(pqs.has(m.paperQuestionId)).toBe(true);
      const key = `${m.submissionId}|${m.paperQuestionId}`;
      expect(seen.has(key), `重复的 (答卷, 卷题) 组合：${key}`).toBe(false);
      seen.add(key);
      // 错题的 quizDay 必须就是那份答卷那一天
      const day = plan.readingDays.find((d: any) => d.submissionId === m.submissionId);
      expect(m.quizDay).toBe(day.dayIso);
    }
  });

  it('写库时学生答案非空、有正确答案、有评语，且评语是合成的', async () => {
    const p = mod();
    const { tx, events } = fakeTx();
    await p.writeAll(tx, planOf(), 'H', 'P');
    const rows = events.filter((e) => e.what === 'mistakeEntry.create');
    expect(rows.length).toBe(20);
    for (const r of rows) {
      const d = r.args.data;
      expect(String(d.studentAnswer).trim().length).toBeGreaterThan(0);
      expect(String(d.correctAnswer).trim().length).toBeGreaterThan(0);
      expect(String(d.markerComment).trim().length).toBeGreaterThan(0);
      expect(d.studentId).toBe(p.ACCOUNT.id);
    }
  });

  it('最多两条合成申诉，且都明确标注是 staging 合成数据', async () => {
    const p = mod();
    const { tx, events } = fakeTx();
    await p.writeAll(tx, planOf(), 'H', 'P');
    const rows = events.filter((e) => e.what === 'gradeAppeal.create');
    expect(rows.length).toBeLessThanOrEqual(2);
    expect(rows.length).toBeGreaterThanOrEqual(1);
    for (const r of rows) {
      expect(r.args.data.studentMessage).toContain('STAGING SYNTHETIC');
      expect(r.args.data.reviewerNote).toContain('STAGING SYNTHETIC');
    }
  });
});

// ─────────────────────────────────────────────────────────────
// 8. 今天必须是干净的 + IELTS 卷子形状
// ─────────────────────────────────────────────────────────────

describe('S12F —— 当天必须干净', () => {
  it('计划里今天没有任务行 / 答卷 / 正式测试 / 考勤', async () => {
    const p = mod();
    const plan = planOf();
    expect(plan.lessonDays.some((l: any) => l.dayIso === DAY)).toBe(false);
    expect(plan.readingDays.some((d: any) => d.dayIso === DAY)).toBe(false);
    expect(plan.attempts.some((a: any) => a.dayIso === DAY)).toBe(false);
    const { tx, events } = fakeTx();
    await p.writeAll(tx, plan, 'H', 'P');
    expect(events.some((e) => e.what.startsWith('attendance.'))).toBe(false);
    expect(events.some((e) => e.what.startsWith('studentPageView.'))).toBe(false);
  });

  it('任一类当天数据不为零就拒绝', () => {
    const p = mod();
    const clean = {
      dlcToday: 0, submissionsToday: 0, scriptsToday: 0, attendanceToday: 0,
      attemptsToday: 0, reviewLogsToday: 0, mistakePracticeToday: 0, appealsToday: 0,
    };
    expect(p.currentDayViolations(clean)).toEqual([]);
    for (const k of Object.keys(clean)) {
      expect(p.currentDayViolations({ ...clean, [k]: 1 })).toEqual([k]);
      expect(() => p.assertCurrentDayPristine({ ...clean, [k]: 1 }, 'x')).toThrow();
    }
  });

  it('前置检查发现当天已有任务行 → 在任何写之前中止', async () => {
    const p = mod();
    const { tx, events } = fakeTx({
      'current-day': [
        { dlcToday: 1, submissionsToday: 0, scriptsToday: 0, attendanceToday: 0,
          attemptsToday: 0, reviewLogsToday: 0, mistakePracticeToday: 0, appealsToday: 0 },
      ],
      'student-roster': [...mod().FIXTURE_STUDENT_IDS, mod().ACCOUNT.id].map((id) => ({ id })),
    });
    await expect(p.runPreflight(tx, planOf())).rejects.toThrow();
    expect(events.some((e) => e.kind === 'write')).toBe(false);
  });
});

describe('S12F —— 今天那份 IELTS 阅读', () => {
  it('rendererKey=ielts_reading 且 config.mode=passage_pick', async () => {
    const p = mod();
    const plan = planOf();
    const { tx, events } = fakeTx();
    await p.writeAll(tx, plan, 'H', 'P');
    const paper = events.find((e) => e.what === 'paper.create' && e.args.data.id === plan.today.paperId);
    expect(paper, '没有写今天的卷子').toBeTruthy();
    expect(paper!.args.data.rendererKey).toBe('ielts_reading');
    expect(paper!.args.data.config.mode).toBe('passage_pick');
    expect(String(paper!.args.data.config.passageTitle).length).toBeGreaterThan(5);
  });

  it('≥8 题、多种 IELTS 任务类型、首题带 taskType、答案在服务端', () => {
    const t = planOf().today;
    expect(t.questions.length).toBeGreaterThanOrEqual(8);
    expect(new Set(t.questions.map((q: any) => q.taskType)).size).toBeGreaterThanOrEqual(3);
    expect(t.questions[0].taskType).toBe('true_false_not_given');
    for (const q of t.questions) {
      expect(String(q.answer).trim().length).toBeGreaterThan(0);
      expect(String(q.stem).trim().length).toBeGreaterThan(10);
      expect(q.marks).toBeGreaterThan(0);
    }
  });

  it('原文足够长，且含有留给用户查词的那个词', () => {
    const t = planOf().today;
    expect(t.passage.length).toBeGreaterThan(1500);
    expect(new RegExp(`\\b${t.reservedWord}\\b`, 'i').test(t.passage)).toBe(true);
  });

  it('留给查词的词不是任何一道题的答案，也不在生词本里', () => {
    const p = mod();
    const plan = planOf();
    const word = plan.today.reservedWord;
    for (const q of plan.today.questions) {
      expect(String(q.answer).toLowerCase()).not.toContain(word.toLowerCase());
    }
    expect(plan.words.map((w: any) => w.headword)).not.toContain(word);
    expect(p.CANDIDATE_WORDS.slice(0, 50)).not.toContain(word);
  });

  it('指定的那道填空题存在，且是单行填空（渲染成输入框）', () => {
    const p = mod();
    const t = planOf().today;
    const q = t.questions.find((x: any) => x.sortOrder === p.FILL_TARGET_SORT_ORDER);
    expect(q, '找不到指定的填空题').toBeTruthy();
    expect(q.taskType).toBe('sentence_completion');
    expect(q.questionType).toBe('short_answer');
    expect(q.options).toBeNull();
  });

  it('今天的场次是 active，且作答窗开一整天（不依赖环境变量）', async () => {
    const p = mod();
    const plan = planOf();
    const { tx, events } = fakeTx();
    await p.writeAll(tx, plan, 'H', 'P');
    const sess = events.find((e) => e.what === 'morningQuizSession.create' && e.args.data.id === plan.today.sessionId);
    expect(sess!.args.data.status).toBe('active');
    expect(sess!.args.data.level).toBe('ielts_authentic');
    const end: Date = sess!.args.data.quizEnd;
    const start: Date = sess!.args.data.quizStart;
    expect(end.getTime() - start.getTime()).toBeGreaterThan(23 * 3600_000);
    // 历史场次不能是 active，否则会被 today 挑走
    const hist = events.filter((e) => e.what === 'morningQuizSession.create' && e.args.data.id !== plan.today.sessionId);
    expect(hist.length).toBeGreaterThanOrEqual(10);
    for (const h of hist) expect(h.args.data.status).toBe('locked');
  });
});

// ─────────────────────────────────────────────────────────────
// 9. 重跑保护
// ─────────────────────────────────────────────────────────────

describe('S12F —— 重跑保护', () => {
  const clean = {
    dlcToday: 0, submissionsToday: 0, scriptsToday: 0, attendanceToday: 0,
    attemptsToday: 0, reviewLogsToday: 0, mistakePracticeToday: 0, appealsToday: 0,
  };

  it('账号还不存在 → 允许', () => {
    expect(mod().assertRerunSafe({ accountExists: false, foreignOwnedRows: 0, currentDay: clean })).toBe(true);
  });

  it('账号存在、全部是自己造的行、今天还干净 → 允许重建', () => {
    expect(mod().assertRerunSafe({ accountExists: true, foreignOwnedRows: 0, currentDay: clean })).toBe(true);
  });

  it('用户已经开始上课（当天有任务行）→ 拒绝', () => {
    expect(() =>
      mod().assertRerunSafe({ accountExists: true, foreignOwnedRows: 0, currentDay: { ...clean, dlcToday: 1 } }),
    ).toThrow();
  });

  it('用户交了卷 / 做了测试 / 练了错题 → 都拒绝', () => {
    for (const k of ['submissionsToday', 'attemptsToday', 'mistakePracticeToday', 'reviewLogsToday']) {
      expect(() =>
        mod().assertRerunSafe({ accountExists: true, foreignOwnedRows: 0, currentDay: { ...clean, [k]: 1 } }),
      ).toThrow();
    }
  });

  it('账号名下出现不带前缀的行（用户自己造的）→ 拒绝', () => {
    expect(() =>
      mod().assertRerunSafe({ accountExists: true, foreignOwnedRows: 3, currentDay: clean }),
    ).toThrow();
  });
});

// ─────────────────────────────────────────────────────────────
// 10. 前置检查：t1–t8 保全 + 读写顺序
// ─────────────────────────────────────────────────────────────

describe('S12F —— 前置检查与事务顺序', () => {
  it('八个夹具都在、没有外来学生时通过，且全程只读', async () => {
    const p = mod();
    const { tx, events } = fakeTx();
    const r = await p.runPreflight(tx, planOf());
    expect(r.accountExists).toBe(false);
    expect(events.every((e) => e.kind === 'read'), '前置检查里出现了写').toBe(true);
    expect(events.map((e) => e.what)).toContain('notification-guards');
    expect(events.map((e) => e.what)).toContain('student-roster');
    expect(events.map((e) => e.what)).toContain('current-day');
    expect(events.map((e) => e.what)).toContain('stray-rows');
  });

  it('通知没关干净 → 拒绝', async () => {
    const p = mod();
    const a = fakeTx({ 'notification-guards': [{ enabled_configs: 1, sent_logs: 0 }] });
    await expect(p.runPreflight(a.tx, planOf())).rejects.toThrow();
    const b = fakeTx({ 'notification-guards': [{ enabled_configs: 0, sent_logs: 4 }] });
    await expect(p.runPreflight(b.tx, planOf())).rejects.toThrow();
  });

  it('库里有第九个不认识的学生 → 拒绝（指错库的硬拦截）', async () => {
    const p = mod();
    const { tx, events } = fakeTx({
      'student-roster': [...p.FIXTURE_STUDENT_IDS, 'real_school_student_001'].map((id) => ({ id })),
    });
    await expect(p.runPreflight(tx, planOf())).rejects.toThrow();
    expect(events.some((e) => e.kind === 'write')).toBe(false);
  });

  it('八个夹具缺一个 → 拒绝', async () => {
    const p = mod();
    const { tx } = fakeTx({
      'student-roster': p.FIXTURE_STUDENT_IDS.slice(1).map((id) => ({ id })),
    });
    await expect(p.runPreflight(tx, planOf())).rejects.toThrow();
  });

  it('沿用的教师 / 科目不在 → 拒绝', async () => {
    const p = mod();
    const { tx } = fakeTx({ 'reused-resources': [{ teacher: 0, subject: 1 }] });
    await expect(p.runPreflight(tx, planOf())).rejects.toThrow();
  });

  it('词典撑不起 50 个词 → 拒绝', async () => {
    const p = mod();
    const { tx } = fakeTx({ dictionary: p.CANDIDATE_WORDS.slice(0, 20).map((w) => ({ word: w })) });
    await expect(p.selectWords(tx)).rejects.toThrow();
  });

  it('留给查词的词不在词典里 → 拒绝', async () => {
    const p = mod();
    const { tx } = fakeTx({ 'reserved-word': [] });
    await expect(p.selectWords(tx)).rejects.toThrow();
  });

  it('所有前置读都排在第一次写之前', async () => {
    const p = mod();
    const plan = planOf();
    const { tx, events } = fakeTx();
    await p.selectWords(tx);
    await p.runPreflight(tx, plan);
    await p.wipeOwned(tx);
    await p.writeAll(tx, plan, 'H', 'P');
    const firstWrite = events.findIndex((e) => e.kind === 'write');
    const preflightTags = ['dictionary', 'reserved-word', 'notification-guards', 'student-roster', 'reused-resources', 'current-day', 'stray-rows'];
    const lastPreflightRead = events.reduce(
      (acc, e, i) => (e.kind === 'read' && preflightTags.includes(e.what) ? i : acc),
      -1,
    );
    expect(firstWrite).toBeGreaterThan(lastPreflightRead);
    expect(lastPreflightRead).toBeGreaterThan(-1);
  });

  it('整个写入过程一次都没提到 t1–t8', async () => {
    const p = mod();
    const { tx, events } = fakeTx();
    await p.writeAll(tx, planOf(), 'H', 'P');
    const blob = JSON.stringify(events.map((e) => e.args));
    for (const id of p.FIXTURE_STUDENT_IDS) {
      expect(blob, `写入过程里出现了 ${id}`).not.toContain(id);
    }
    // 写到的每一个 studentId 都只能是验收账号
    for (const e of events) {
      const sid = e.args?.data?.studentId ?? e.args?.create?.id;
      if (typeof sid === 'string' && sid.startsWith('t') && /^t\d_/.test(sid)) {
        throw new Error(`写到了夹具账号 ${sid}`);
      }
    }
  });

  it('回读校验：数目对不上就抛（事务将回滚）', async () => {
    const p = mod();
    const plan = planOf();
    const { tx } = fakeTx({ readback: [{ submissions: 0 }] });
    await expect(p.verifyAfterWrite(tx, plan)).rejects.toThrow();
  });

  it('回读校验：数目全对时通过', async () => {
    const p = mod();
    const plan = planOf();
    const d = p.distributionsOf(plan);
    const { tx } = fakeTx({
      readback: [
        {
          submissions: d.readingSubmissions,
          marked: d.markedSubmissions,
          pending: d.pendingSubmissions,
          scripts: d.readingSubmissions * 6,
          dlc: d.lessonDays,
          attempts: d.attempts,
          words: d.words,
          words_due: 21,
          words_quizzable: 19,
          review_logs: d.reviewLogs,
          mistakes: d.mistakes,
          mistakes_open: d.mistakesUnresolved,
          appeals: d.appeals,
          dlc_today: 0,
          attempts_today: 0,
          logs_today: 0,
          practice_today: 0,
          lastreview_today: 0,
          attendance: 0,
          today_session: 1,
          today_questions: d.todayQuestions,
        },
      ],
    });
    await expect(p.verifyAfterWrite(tx, plan)).resolves.toBeTruthy();
  });
});

// ─────────────────────────────────────────────────────────────
// 11. 历史时间戳必须落在过去的日历日里
//
// 2026-08-30 22:18 SGT 的 staging 实跑抓到的缺陷：所有「N 天前」都是按
// `now - N*24h` 算的，那是个**相对此刻**的瞬刻。晚上跑脚本时
// `now - 1 天 + 3 小时` 落在昨天 17:18Z，而今天的 SGT 零点是昨天 16:00Z
// —— 14 条复习流水因此落进了「今天」，学生还没动手就会看到
// 「今天复习 14 次」，那些词还会被拉进今天的队列。
// ─────────────────────────────────────────────────────────────

describe('S12F —— 历史时间戳的日历日归属', () => {
  /** 今天的 SGT 零点对应的真实 UTC 瞬刻。 */
  const sgtMidnight = (todayIso: string) => Date.parse(`${todayIso}T00:00:00.000Z`) - 8 * 3600_000;

  it('dayBefore 永远落在指定的那个过去日历日里', () => {
    const p = mod();
    for (const n of [1, 2, 5, 14]) {
      const t = p.dayBefore(DAY, n, '19:00:00');
      expect(t.getTime()).toBeLessThan(sgtMidnight(DAY));
      expect(t.toISOString()).toBe(p.sgtInstant(p.dayMinus(DAY, n), '19:00:00').toISOString());
    }
  });

  it('复习流水没有一条落在今天（这条就是实跑抓到的那个缺陷）', async () => {
    const p = mod();
    const plan = planOf();
    const { tx, events } = fakeTx();
    await p.writeAll(tx, plan, 'H', 'P');
    const rows = events.filter((e) => e.what === 'wordReviewLog.create');
    expect(rows.length).toBe(198);
    const cutoff = sgtMidnight(DAY);
    for (const r of rows) {
      const t: Date = r.args.data.reviewedAt;
      expect(t.getTime(), `复习流水 ${r.args.data.id} 落在了今天`).toBeLessThan(cutoff);
    }
    // 而且要真的散布在多天上，不是全挤在一天
    const days = new Set(rows.map((r) => (r.args.data.reviewedAt as Date).toISOString().slice(0, 10)));
    expect(days.size).toBeGreaterThanOrEqual(10);
  });

  it('生词的 lastReview / firstTaughtAt 也都在今天之前', async () => {
    const p = mod();
    const { tx, events } = fakeTx();
    await p.writeAll(tx, planOf(), 'H', 'P');
    const cutoff = sgtMidnight(DAY);
    for (const e of events.filter((x) => x.what === 'studentWord.create')) {
      const { lastReview, firstTaughtAt, due } = e.args.data;
      if (lastReview) expect(lastReview.getTime(), `${e.args.data.headword} 的 lastReview 落在今天`).toBeLessThan(cutoff);
      if (firstTaughtAt) expect(firstTaughtAt.getTime()).toBeLessThan(cutoff);
      // `due` 是调度字段，**故意**允许落在今天甚至将来
      expect(due instanceof Date).toBe(true);
    }
  });

  it('错题的 lastPracticedAt / resolvedAt / createdAt 都在今天之前', async () => {
    const p = mod();
    const { tx, events } = fakeTx();
    await p.writeAll(tx, planOf(), 'H', 'P');
    const cutoff = sgtMidnight(DAY);
    for (const e of events.filter((x) => x.what === 'mistakeEntry.create')) {
      const { lastPracticedAt, resolvedAt, createdAt } = e.args.data;
      if (lastPracticedAt) expect(lastPracticedAt.getTime()).toBeLessThan(cutoff);
      if (resolvedAt) expect(resolvedAt.getTime()).toBeLessThan(cutoff);
      expect(createdAt.getTime()).toBeLessThan(cutoff);
    }
  });

  it('申诉的时间也在今天之前，且批注晚于提交', async () => {
    const p = mod();
    const { tx, events } = fakeTx();
    await p.writeAll(tx, planOf(), 'H', 'P');
    const cutoff = sgtMidnight(DAY);
    for (const e of events.filter((x) => x.what === 'gradeAppeal.create')) {
      const { createdAt, reviewedAt } = e.args.data;
      expect(createdAt.getTime()).toBeLessThan(cutoff);
      expect(reviewedAt.getTime()).toBeLessThan(cutoff);
      expect(reviewedAt.getTime()).toBeGreaterThan(createdAt.getTime());
    }
  });

  it('回读校验会拦住「自己把历史写进了今天」', async () => {
    const p = mod();
    const plan = planOf();
    const d = p.distributionsOf(plan);
    const good = {
      submissions: d.readingSubmissions, marked: d.markedSubmissions, pending: d.pendingSubmissions,
      scripts: d.readingSubmissions * 6, dlc: d.lessonDays, attempts: d.attempts, words: d.words,
      words_due: 21, words_quizzable: 19, review_logs: d.reviewLogs, mistakes: d.mistakes,
      mistakes_open: d.mistakesUnresolved, appeals: d.appeals, dlc_today: 0, attempts_today: 0,
      logs_today: 0, practice_today: 0, lastreview_today: 0, attendance: 0, today_session: 1,
      today_questions: d.todayQuestions,
    };
    for (const k of ['logs_today', 'practice_today', 'lastreview_today']) {
      const { tx } = fakeTx({ readback: [{ ...good, [k]: 1 }] });
      await expect(p.verifyAfterWrite(tx, plan), `${k} 不为零却没被拦住`).rejects.toThrow();
    }
  });

  it('前置检查把「夹具自己的当天行」和「用户造的当天行」分开看', () => {
    const src = fs.readFileSync(
      path.resolve(__dirname, '..', 'prepare-s12f-acceptance-account.js'),
      'utf8',
    );
    // 当天的复习流水 / 错题重练这两项要排除 s12f_ 前缀的行 ——
    // 否则夹具一旦自己写错时间，它就再也修不好自己。
    expect(src).toContain('l.id NOT LIKE');
    expect(src).toContain('AND id NOT LIKE');
  });
});
