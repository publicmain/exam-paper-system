/**
 * S12M —— 发布脚本的**杀伤半径**与闸门。
 *
 * 这个脚本要往一个**已经装着真数据**的库里写：S12F 验收账号的两周历史、
 * t1–t8 八个场景夹具、59 条词典。所以它能碰什么、绝不能碰什么，必须能
 * 脱库钉死。
 *
 * 全部是纯函数，不连库、不发请求。
 */

import { describe, expect, it } from 'vitest';

// eslint-disable-next-line @typescript-eslint/no-var-requires
const prep = require('../prepare-pilot-week');
// eslint-disable-next-line @typescript-eslint/no-var-requires
const content = require('../content');

const {
  CONFIRMATION,
  PRODUCTION_CONFIRMATION,
  PREFIX,
  EXPECTED_RAILWAY,
  EXPECTED_PRODUCTION_RAILWAY,
  PUBLISHER,
  CLASS,
  REGISTRATION_CLASSES,
  ALL_CLASSES,
  QA_STUDENT,
  DAILY_WORD_TARGET,
  RESERVE_WORD_TARGET,
  PilotError,
  writeScopes,
  neverTouched,
  dayLabel,
  sgtInstant,
  idsFor,
  deliveryIdsFor,
  studentWordId,
  isManagedStudentWord,
  lessonWordPlan,
  assertPrefixed,
  assertEnvGates,
  parseDay,
  isOursToFix,
  dictDrift,
} = prep as {
  CONFIRMATION: string;
  PRODUCTION_CONFIRMATION: string;
  PREFIX: string;
  EXPECTED_RAILWAY: Record<string, string>;
  EXPECTED_PRODUCTION_RAILWAY: Record<string, string>;
  PUBLISHER: { examBoardId: string; subjectId: string; teacherId: string };
  CLASS: { id: string; name: string; classCode: string };
  REGISTRATION_CLASSES: Array<{ id: string; name: string; classCode: string }>;
  ALL_CLASSES: Array<{ id: string; name: string; classCode: string }>;
  QA_STUDENT: { id: string; name: string; level: string };
  DAILY_WORD_TARGET: number;
  RESERVE_WORD_TARGET: number;
  PilotError: new (m: string) => Error;
  writeScopes: () => Array<{ table: string; kind: string }>;
  neverTouched: () => string[];
  dayLabel: (d: string) => Date;
  sgtInstant: (d: string, t: string) => Date;
  idsFor: (level: string, day: string) => {
    paperId: string;
    assignmentId: string;
    sessionId: string;
    questionId: (n: number) => string;
    paperQuestionId: (n: number) => string;
  };
  deliveryIdsFor: (level: string, day: string, klass: { id: string }) => {
    assignmentId: string;
    sessionId: string;
  };
  studentWordId: (s: string, h: string) => string;
  isManagedStudentWord: (row: { id?: unknown }) => boolean;
  lessonWordPlan: (lesson: { passage: string; words: Array<Record<string, string>> }) => {
    primary: Array<Record<string, string>>;
    reserves: Array<Record<string, string>>;
  };
  assertPrefixed: (ids: string[]) => boolean;
  assertEnvGates: (env: Record<string, string>) => void;
  parseDay: (argv: string[]) => string;
  isOursToFix: (row: { tag?: unknown }) => boolean;
  dictDrift: (
    row: Record<string, unknown>,
    w: Record<string, unknown>,
  ) => Record<string, unknown> | null;
};

const LEVELS = Object.keys(content.LEVELS as Record<string, unknown>);
const DATES = content.DATES as string[];

// ─────────────────────────────────────────────────────────────
// 1. 杀伤半径
// ─────────────────────────────────────────────────────────────

describe('S12M —— 这个脚本能碰什么', () => {
  it('每一张能写的表都有明确的限定方式', () => {
    for (const s of writeScopes()) {
      expect(['byPrefix', 'byPilotStudent', 'allowlisted'], s.table).toContain(s.kind);
    }
    expect(writeScopes().length).toBeGreaterThan(8);
  });

  it('**学生的历史一张都不在写入范围里**', () => {
    const writable = new Set(writeScopes().map((s) => s.table));
    for (const t of neverTouched()) {
      expect(writable, `${t} 竟然出现在写入范围里`).not.toContain(t);
    }
  });

  it('绝不碰的那张清单本身是齐的 —— 少一条就是一类可能被毁掉的记录', () => {
    const must = [
      'StudentSubmission',
      'AnswerScript',
      'VocabQuizAttempt',
      'WordReviewLog',
      'MistakeEntry',
      'GradeAppeal',
      'DailyLessonCompletion',
    ];
    for (const t of must) expect(neverTouched()).toContain(t);
  });

  it('发布科目与不可登录的发布者都在独立命名空间内', () => {
    expect(PUBLISHER.examBoardId.startsWith(PREFIX)).toBe(true);
    expect(PUBLISHER.subjectId.startsWith(PREFIX)).toBe(true);
    expect(PUBLISHER.teacherId.startsWith(PREFIX)).toBe(true);
    expect(writeScopes().map((s) => s.table)).toContain('ExamBoard');
    expect(writeScopes().map((s) => s.table)).toContain('Subject');
  });
});

// ─────────────────────────────────────────────────────────────
// 2. 命名空间：一切都带 p1_
// ─────────────────────────────────────────────────────────────

describe('S12M —— 命名空间', () => {
  it('前缀就是 p1_，班级 / 冒烟账号都带它', () => {
    expect(PREFIX).toBe('p1_');
    expect(CLASS.id.startsWith(PREFIX)).toBe(true);
    expect(QA_STUDENT.id.startsWith(PREFIX)).toBe(true);
  });

  it('注册页所需的九个真实班级齐全，且每个班都有独立的投放 id', () => {
    expect(REGISTRATION_CLASSES.map((klass) => klass.name)).toEqual([
      'SGCE26W', 'SEC27W', 'OL26W', 'IAL27W', 'IAL27M',
      'IAL26W', 'IAL26S2', 'IAL26S1', 'IAL28S',
    ]);
    expect(ALL_CLASSES).toHaveLength(10);
    const deliveries = ALL_CLASSES.map((klass) =>
      deliveryIdsFor('olevel', DATES[0], klass).assignmentId,
    );
    expect(new Set(deliveries).size).toBe(deliveries.length);
    expect(assertPrefixed(deliveries)).toBe(true);
  });

  it('**不复用验收班，也不复用任何夹具账号**', () => {
    expect(CLASS.id).not.toBe('s12f_class');
    expect(CLASS.classCode).not.toBe('S12FACC');
    for (const bad of ['s12f_acceptance_student', 't1_normal', 't6_done', 't8_zero']) {
      expect(QA_STUDENT.id).not.toBe(bad);
    }
  });

  it('五档两天的每一个 id 都带前缀，而且互不相同', () => {
    const all: string[] = [];
    for (const lv of LEVELS) {
      for (const d of DATES) {
        const ids = idsFor(lv, d);
        all.push(ids.paperId, ids.assignmentId, ids.sessionId);
        for (let n = 1; n <= 10; n++) all.push(ids.questionId(n), ids.paperQuestionId(n));
      }
    }
    expect(assertPrefixed(all)).toBe(true);
    expect(new Set(all).size, '有 id 撞车').toBe(all.length);
    // 五档两天 × (3 + 20)
    expect(all.length).toBe(LEVELS.length * DATES.length * 23);
  });

  it('id 是**纯函数** —— 同样的输入永远同样的 id（重跑才可能幂等）', () => {
    // 返回值里有两个生成函数，直接 deep-equal 会比到函数身份上，
    // 所以逐项比字符串（那才是真正落库的东西）。
    const flat = (lv: string, d: string) => {
      const i = idsFor(lv, d);
      return [i.paperId, i.assignmentId, i.sessionId, i.questionId(1), i.paperQuestionId(10)];
    };
    expect(flat('olevel', DATES[0])).toEqual(flat('olevel', DATES[0]));
    expect(flat('olevel', DATES[0])).not.toEqual(flat('olevel', DATES[1]));
    expect(flat('olevel', DATES[0])).not.toEqual(flat('ielts_authentic', DATES[0]));
    // 编号补零 —— 第 1 题与第 10 题排序时不能乱
    expect(idsFor('olevel', DATES[0]).questionId(1)).toMatch(/_q01$/);
    expect(idsFor('olevel', DATES[0]).questionId(10)).toMatch(/_q10$/);
  });

  it('生词的 id 带前缀，且按 (学生, 词) 唯一', () => {
    const a = studentWordId('p1_qa_student', 'rubbish');
    expect(a.startsWith(PREFIX)).toBe(true);
    expect(a).not.toBe(studentWordId('p1_qa_student', 'stiff'));
    expect(a).not.toBe(studentWordId('someone_else', 'rubbish'));
  });

  it('发布脚本只重排自己创建的词，学生自己的生词永远保留', () => {
    expect(isManagedStudentWord({ id: 'p1_w_student_word' })).toBe(true);
    expect(isManagedStudentWord({ id: 'cuid_from_lookup' })).toBe(false);
    expect(isManagedStudentWord({ id: '' })).toBe(false);
    expect(isManagedStudentWord({})).toBe(false);
  });

  it('没带前缀的 id 一律拒绝', () => {
    expect(() => assertPrefixed(['p1_ok', 's12f_bad'])).toThrow(/前缀/);
    expect(() => assertPrefixed([undefined as unknown as string])).toThrow();
  });
});

// ─────────────────────────────────────────────────────────────
// 3. 日期：新加坡日历日
// ─────────────────────────────────────────────────────────────

describe('S12M —— 日期', () => {
  it('`dayLabel` 是那个新加坡日历日对应的 UTC 午夜', () => {
    // 2026-08-31 的 SGT 日历日，落库的 key 是 UTC 的 08-31 00:00
    expect(dayLabel('2026-08-31').toISOString()).toBe('2026-08-31T00:00:00.000Z');
  });

  it('`sgtInstant` 把新加坡的墙上时间换成真实 UTC 时刻', () => {
    // 新加坡 00:05 = UTC 前一天 16:05
    expect(sgtInstant('2026-08-31', '00:05:00').toISOString()).toBe('2026-08-30T16:05:00.000Z');
    expect(sgtInstant('2026-08-31', '23:59:00').toISOString()).toBe('2026-08-31T15:59:00.000Z');
  });

  it('作答窗覆盖一整天 —— 试点是全天开放的', () => {
    const start = sgtInstant('2026-08-31', '00:05:00').getTime();
    const end = sgtInstant('2026-08-31', '23:59:00').getTime();
    expect(end - start).toBeGreaterThan(23 * 3600_000);
  });

  it('`--day` 只认公布过的那几天', () => {
    for (const d of DATES) expect(parseDay([`--day=${d}`])).toBe(d);
    expect(() => parseDay(['--day=2026-09-05'])).toThrow(/--day/);
    expect(() => parseDay([])).toThrow(/--day/);
    expect(() => parseDay(['--day='])).toThrow(/--day/);
    // 不许一次发一整周 —— 那正是「周一的词把周二挤爆」的来源
    expect(() => parseDay(['--all'])).toThrow();
  });
});

// ─────────────────────────────────────────────────────────────
// 4. 环境闸门
// ─────────────────────────────────────────────────────────────

describe('S12M —— 环境闸门', () => {
  const env = () => ({
    ...EXPECTED_RAILWAY,
    DATABASE_PUBLIC_URL: 'postgresql://u:p@proxy.example.test:41234/railway',
    RAILWAY_TCP_PROXY_DOMAIN: 'proxy.example.test',
    RAILWAY_TCP_PROXY_PORT: '41234',
    P1_CONFIRM: CONFIRMATION,
  });

  it('给全了就过', () => {
    expect(() => assertEnvGates(env())).not.toThrow();
  });

  it('只有指定生产项目加生产专用确认串才能过', () => {
    const production = {
      ...env(),
      ...EXPECTED_PRODUCTION_RAILWAY,
      P1_CONFIRM: PRODUCTION_CONFIRMATION,
    };
    expect(() => assertEnvGates(production)).not.toThrow();
    expect(() => assertEnvGates({ ...production, P1_CONFIRM: CONFIRMATION })).toThrow();
    expect(() => assertEnvGates({ ...production, RAILWAY_PROJECT_ID: 'wrong' })).toThrow();
  });

  const cases: Array<[string, Record<string, string>]> = [
    ['项目 id 不对', { RAILWAY_PROJECT_ID: '00000000-0000-0000-0000-000000000000' }],
    ['项目名不对', { RAILWAY_PROJECT_NAME: 'exam-paper-system' }],
    ['环境不对', { RAILWAY_ENVIRONMENT_NAME: 'staging' }],
    ['服务不对', { RAILWAY_SERVICE_NAME: 'stg-api' }],
    ['代理主机名不对', { RAILWAY_TCP_PROXY_DOMAIN: 'somewhere.else.example' }],
    ['代理端口不对', { RAILWAY_TCP_PROXY_PORT: '1' }],
    ['缺确认串', { P1_CONFIRM: '' }],
    ['确认串写错', { P1_CONFIRM: 'yes' }],
    ['连接串畸形', { DATABASE_PUBLIC_URL: 'not-a-url' }],
    ['连接串没有端口', { DATABASE_PUBLIC_URL: 'postgresql://u:p@proxy.example.test/railway' }],
  ];
  for (const [label, patch] of cases) {
    it(`拒绝：${label}`, () => {
      expect(() => assertEnvGates({ ...env(), ...patch })).toThrow();
    });
  }

  it('拒绝时**不回显任何取值** —— 连接串、主机、端口都不许出现在错误里', () => {
    let msg = '';
    try {
      assertEnvGates({ ...env(), RAILWAY_TCP_PROXY_PORT: '1' });
    } catch (e) {
      msg = String((e as Error).message);
    }
    expect(msg).not.toContain('proxy.example.test');
    expect(msg).not.toContain('41234');
    expect(msg).not.toContain('postgresql://');
  });

  it('不能只改项目名就绕过 staging 闸门', () => {
    expect(EXPECTED_RAILWAY.RAILWAY_PROJECT_NAME).toBe('exam-staging-manual');
    expect(() =>
      assertEnvGates({ ...env(), RAILWAY_PROJECT_NAME: 'glorious-motivation' }),
    ).toThrow();
  });
});

// ─────────────────────────────────────────────────────────────
// 5. 与内容包的契约
// ─────────────────────────────────────────────────────────────

describe('S12M —— 脚本与内容包对得上', () => {
  it('脚本认识的档就是内容包里的五档', () => {
    expect(LEVELS.sort()).toEqual(['ielts_authentic', 'ielts_light', 'ielts_simplified', 'olevel', 'olevel_intermediate']);
  });

  it('冒烟账号的分级必须真有内容，否则它进去看到的是空的一天', () => {
    expect(LEVELS).toContain(QA_STUDENT.level);
    expect(content.lessonFor(QA_STUDENT.level, DATES[0])).toBeTruthy();
  });

  it('要补录的词条数是**可数的**，不是把整本词典搬过来', () => {
    const n = content.allWords().length;
    // 上限按内容包**实际有多少天**算，不能写死。原来钉的是 525
    // （五档 × 五天 × 每天 21 个词位）；内容包按周累加之后，第二周一并进来
    // 就会撞上这个数字 —— 而它拦的本来是「有人把整本词典塞进来」，不是
    // 「内容包变长了」。
    const ceiling = (content.MAX_WORDS_PER_DAY as number) * DATES.length * LEVELS.length;
    expect(n).toBeGreaterThan(70 * LEVELS.length);
    expect(n).toBeLessThanOrEqual(ceiling);
  });

  it('每一档每天都是 12 个主词，备用词只来自同一篇文章', () => {
    expect(DAILY_WORD_TARGET).toBe(12);
    expect(RESERVE_WORD_TARGET).toBe(12);
    for (const level of LEVELS) {
      for (const date of DATES) {
        const lesson = content.lessonFor(level, date);
        const plan = lessonWordPlan(lesson);
        expect(plan.primary, `${level}/${date}`).toHaveLength(12);
        expect(plan.reserves.length, `${level}/${date}`).toBeGreaterThanOrEqual(9);
        const primary = new Set(plan.primary.map((w) => w.headword));
        for (const word of plan.reserves) {
          expect(primary.has(word.headword), `${level}/${date}/${word.headword}`).toBe(false);
          expect(lesson.passage.toLowerCase()).toContain(word.surfaceForm.toLowerCase());
          expect(lesson.passage.replace(/\bParagraph\s+\d+\s*/gi, '')).toContain(word.context);
        }
      }
    }
  });

  it('PilotError 是自己的错误类型 —— 好让 main 只回显它的话', () => {
    const e = new PilotError('x');
    expect(e).toBeInstanceOf(Error);
    expect(e.name).toBe('PilotError');
  });
});

// ─────────────────────────────────────────────────────────────
// 6. 词典：能纠自己的错，碰不到别人的
// ─────────────────────────────────────────────────────────────

describe('S12M —— 词典改写的边界', () => {
  const ours = { word: 'complaint', tag: ['pilot_w1'] };

  it('只有自己打过 `pilot_w1` 的行才允许改写', () => {
    expect(isOursToFix(ours)).toBe(true);
  });

  it('**staging 原有的 59 条一条都碰不到** —— 它们不带这个标签', () => {
    expect(isOursToFix({ tag: [] })).toBe(false);
    expect(isOursToFix({ tag: ['ecdict'] })).toBe(false);
    expect(isOursToFix({ tag: ['pilot_w2'] })).toBe(false);
    expect(isOursToFix({})).toBe(false);
    expect(isOursToFix({ tag: null })).toBe(false);
    // 字符串不是数组 —— 不能靠 `includes` 在字符串上误判成真
    expect(isOursToFix({ tag: 'pilot_w1' as unknown })).toBe(false);
  });

  it('一模一样就不写 —— 幂等重跑不会产生一次多余的 UPDATE', () => {
    const w = { phonetic: '/a/', pos: 'n.', translation: 'n. 投诉', definition: 'd' };
    expect(dictDrift({ ...w }, w)).toBeNull();
  });

  it('只把**真的变了的那几个字段**放进 patch', () => {
    const w = { phonetic: '/a/', pos: 'n.', translation: 'n. 投诉，抱怨', definition: 'd' };
    const patch = dictDrift({ ...w, translation: 'n. 投诉，抄怨' }, w);
    expect(patch).toEqual({ translation: 'n. 投诉，抱怨' });
  });

  it('`word` 与 `tag` 永远不在 patch 里 —— 主键和归属不由这条路径改', () => {
    const w = {
      phonetic: '/b/',
      pos: 'v.',
      translation: 't',
      definition: 'd',
      headword: 'x',
      tag: ['whatever'],
    };
    const patch = dictDrift({ phonetic: null, pos: null, translation: null, definition: null }, w);
    expect(Object.keys(patch as object).sort()).toEqual([
      'definition',
      'phonetic',
      'pos',
      'translation',
    ]);
  });

  it('那两个错别字确实已经从内容包里消失了', () => {
    const all = content.allWords() as Array<{ translation: string }>;
    expect(all.filter((w) => /抄怨|浹死/.test(w.translation))).toHaveLength(0);
  });
});

// ─────────────────────────────────────────────────────────────
// 排词批量化（2026-09-11）：09-14 发布整笔超时回滚后改的
// ─────────────────────────────────────────────────────────────

/**
 * 一个只记账的假事务：记下每一次调用，按给定的已有行回答 findMany。
 * 真库一次往返约 0.44 秒，所以「调用了几次」就是这一步的耗时。
 */
function fakeTx(existing: Array<Record<string, unknown>>, parkedCount = 0) {
  const calls: Array<{ op: string; args: any }> = [];
  const tx = {
    studentWord: {
      findMany: async (args: any) => {
        calls.push({ op: 'findMany', args });
        const heads = new Set(args.where.headword.in);
        return existing.filter((r) => r.studentId === args.where.studentId && heads.has(r.headword));
      },
      findUnique: async (args: any) => {
        calls.push({ op: 'findUnique', args });
        return null;
      },
      create: async (args: any) => {
        calls.push({ op: 'create', args });
        return args.data;
      },
      createMany: async (args: any) => {
        calls.push({ op: 'createMany', args });
        return { count: args.data.length };
      },
      update: async (args: any) => {
        calls.push({ op: 'update', args });
        return args.data;
      },
      updateMany: async (args: any) => {
        calls.push({ op: 'updateMany', args });
        return { count: parkedCount };
      },
    },
  };
  return { tx, calls };
}

describe('排词 —— 一个学生固定几次往返，判断规则不变', () => {
  const scheduleWordsFor = prep.scheduleWordsFor as (
    tx: unknown,
    student: { id: string; englishLevel: string | null },
    day: string,
    report: unknown,
  ) => Promise<void>;
  const makeReport = prep.makeReport as () => {
    bump: (k: string, n?: number) => void;
    note: (s: string) => void;
    counts: Record<string, number>;
    notes: string[];
  };
  const PARK_UNTIL = prep.PARK_UNTIL as string;
  const LEVEL = 'olevel';
  const DAY = DATES[DATES.length - 1];
  const student = { id: 'stu_batch_1', englishLevel: LEVEL };
  const lesson = content.lessonFor(LEVEL, DAY);
  const { primary } = lessonWordPlan(lesson);
  const dueAt = sgtInstant(DAY, '00:05:00');

  it('新学生：一次读、一次批量建、一次让路 —— 不逐词往返', async () => {
    const { tx, calls } = fakeTx([], 37);
    const report = makeReport();
    await scheduleWordsFor(tx, student, DAY, report);

    expect(calls.map((c) => c.op)).toEqual(['findMany', 'createMany', 'updateMany']);
    const rows = calls[1].args.data as Array<Record<string, any>>;
    expect(rows).toHaveLength(DAILY_WORD_TARGET);
    expect(rows.map((r) => r.headword)).toEqual(primary.map((w) => w.headword));
    for (const r of rows) {
      expect(r.id).toBe(studentWordId(student.id, r.headword));
      expect(r.id.startsWith(`${PREFIX}w_`)).toBe(true);
      expect(r.due.getTime()).toBe(dueAt.getTime());
      expect(r.state).toBe('new');
      expect(r.sourceType).toBe('teacher_push');
    }
    expect(report.counts).toEqual({ 'StudentWord.created': DAILY_WORD_TARGET, 'StudentWord.parked': 37 });
  });

  it('让路的条件与原来逐行版一模一样：只动脚本自己的、不是今天的、到期的、没复习过的', async () => {
    const { tx, calls } = fakeTx([]);
    await scheduleWordsFor(tx, student, DAY, makeReport());
    const park = calls.find((c) => c.op === 'updateMany')!.args;
    expect(park.where.studentId).toBe(student.id);
    expect(park.where.id).toEqual({ startsWith: `${PREFIX}w_` });
    expect([...park.where.headword.notIn].sort()).toEqual(primary.map((w) => w.headword).sort());
    expect(park.where.due.lte.getTime()).toBe(sgtInstant(DAY, '23:59:59').getTime());
    expect(park.where.reviews).toEqual({ none: {} });
    expect(park.data).toEqual({ due: sgtInstant(PARK_UNTIL, '00:05:00') });
  });

  it('已有的词：该改期的改期、该补翻译的补、学生自己的不碰、其余不动；只对这两行单独 update', async () => {
    const [a, b, c, d] = primary;
    const earlier = sgtInstant('2026-09-01', '00:05:00');
    const existing = [
      // 脚本自己的、到期不对 → 改期
      { id: studentWordId(student.id, a.headword), studentId: student.id, headword: a.headword, due: earlier, contextSentence: a.context, contextTranslation: a.contextTranslation },
      // 脚本自己的、到期对、同一句的翻译旧了 → 只补翻译
      { id: studentWordId(student.id, b.headword), studentId: student.id, headword: b.headword, due: dueAt, contextSentence: b.context, contextTranslation: '旧翻译' },
      // 学生自己查的词，恰好同名 → 一个字不动
      { id: 'own_lookup_1', studentId: student.id, headword: c.headword, due: earlier, contextSentence: 'mine', contextTranslation: '我的' },
      // 脚本自己的、什么都对 → 不动
      { id: studentWordId(student.id, d.headword), studentId: student.id, headword: d.headword, due: dueAt, contextSentence: d.context, contextTranslation: d.contextTranslation },
    ];
    const { tx, calls } = fakeTx(existing);
    const report = makeReport();
    await scheduleWordsFor(tx, student, DAY, report);

    const updates = calls.filter((u) => u.op === 'update').map((u) => u.args);
    expect(updates).toHaveLength(2);
    expect(updates[0].where.id).toBe(existing[0].id);
    expect(updates[0].data.due.getTime()).toBe(dueAt.getTime());
    expect(updates[1]).toEqual({ where: { id: existing[1].id }, data: { contextTranslation: b.contextTranslation } });
    expect(updates.some((u) => u.where.id === 'own_lookup_1')).toBe(false);

    const created = calls.find((u) => u.op === 'createMany')!.args.data as Array<{ headword: string }>;
    expect(created.map((r) => r.headword)).toEqual(primary.slice(4).map((w) => w.headword));
    expect(calls.some((u) => u.op === 'findUnique' || u.op === 'create')).toBe(false);
    expect(report.counts).toEqual({
      'StudentWord.rescheduled': 1,
      'StudentWord.translationBackfilled': 1,
      'StudentWord.personalKept': 1,
      'StudentWord.unchanged': 1,
      'StudentWord.created': DAILY_WORD_TARGET - 4,
    });
  });

  it('今天的词全都已经有了：不发空的 createMany', async () => {
    const existing = primary.map((w) => ({
      id: studentWordId(student.id, w.headword),
      studentId: student.id,
      headword: w.headword,
      due: dueAt,
      contextSentence: w.context,
      contextTranslation: w.contextTranslation,
    }));
    const { tx, calls } = fakeTx(existing);
    const report = makeReport();
    await scheduleWordsFor(tx, student, DAY, report);
    expect(calls.map((u) => u.op)).toEqual(['findMany', 'updateMany']);
    expect(report.counts).toEqual({ 'StudentWord.unchanged': DAILY_WORD_TARGET });
  });

  it('没设分级的学生：一次库都不碰，只记一条备注', async () => {
    const { tx, calls } = fakeTx([]);
    const report = makeReport();
    await scheduleWordsFor(tx, { id: 'stu_nolevel', englishLevel: null }, DAY, report);
    expect(calls).toHaveLength(0);
    expect(report.notes).toHaveLength(1);
  });

  it('85 个学生、新的一天：往返总数是学生数的三倍，不再随往日词数增长', async () => {
    let total = 0;
    for (let i = 0; i < 85; i += 1) {
      const { tx, calls } = fakeTx([], 32);
      await scheduleWordsFor(tx, { id: `stu_${i}`, englishLevel: LEVEL }, DAY, makeReport());
      total += calls.length;
    }
    // 0.44 秒一次往返 × 255 ≈ 两分钟；原来逐行版在 09-14 要四千多次
    expect(total).toBe(85 * 3);
  });

  it('report.bump(k, 0) 不在报表里留一个 0', () => {
    const r = makeReport();
    r.bump('StudentWord.parked', 0);
    r.bump('StudentWord.created');
    r.bump('StudentWord.created', 3);
    expect(r.counts).toEqual({ 'StudentWord.created': 4 });
  });
});
