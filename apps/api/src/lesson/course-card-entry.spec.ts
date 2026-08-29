import { describe, it, expect, vi } from 'vitest';
import { LESSON_RULES_VERSION, clampStage, coursePendingOf, deriveStage } from './lesson-rules';
import { lessonCardOrder } from './rc11-rules';
import { LessonService } from './lesson.service';

/**
 * S9C2 —— **课程卡入口**：纯复习日必须先过复习卡，再进正式测试。
 *
 * ## 修的是什么
 *
 * 老判据是「当天还有没教过的新词」（`hasUnlearnedWords`）。它只看新词，
 * 于是队列全是教过的复习词时它从一开始就是 false —— 阶段从「读完」直接
 * 跳到 `vocab_test`，`/lesson/vocab` 永远进不去，那些复习卡一次都发不出来。
 * staging 上的 `t5_review` 就是这个样子（四张 `state: review` 的卡，
 * `nextAction.kind` 却是 `vocab_test`）。
 *
 * 新判据是 `coursePendingOf`：**断点走到队列尽头没有**。教学和复习推的是
 * 同一个断点，所以纯新词、纯复习、混合三种日子共用这一条。
 */

const CARDS = ['ripple', 'vessel', 'willow', 'anchor'] as const;
const OWNED = [...CARDS];

/** 课程卡事实的默认形状：四张卡、断点 0、没开考、不是旧任务行。 */
const C = {
  courseCards: [...CARDS] as readonly string[] | null,
  cursor: 0 as number | null | undefined,
  hasAttempt: false,
  legacyHasUnlearnedWords: false,
};

/** 阶段事实：读完了、背段没达成、补段没达成。 */
const stageWith = (hasPendingCourseCards: boolean) =>
  deriveStage({
    readSettled: true,
    vocabSettled: false,
    hasPendingCourseCards,
    drillSettled: false,
  });

// ─────────────────────────────────────────────────────────────
// AC-03 纯复习日
// ─────────────────────────────────────────────────────────────

describe('AC-03 纯复习日：先过复习卡，再进正式测试', () => {
  it('**读完 + 四张复习卡 + 断点 0 → 还有课程卡**（老判据这里是 false）', () => {
    expect(coursePendingOf(C)).toBe(true);
    expect(stageWith(coursePendingOf(C))).toBe('vocab_learn');
  });

  it('**不需要任何教学写入** —— 判据只看断点，不看 firstTaughtAt', () => {
    // 四张全是教过的词（复习卡），`legacyHasUnlearnedWords` 一直是 false
    expect(coursePendingOf({ ...C, legacyHasUnlearnedWords: false })).toBe(true);
  });

  it('**每推进一张，剩下的仍然够得着**', () => {
    for (const cursor of [0, 1, 2, 3]) {
      expect(coursePendingOf({ ...C, cursor }), `cursor=${cursor}`).toBe(true);
      expect(stageWith(coursePendingOf({ ...C, cursor }))).toBe('vocab_learn');
    }
  });

  it('**只有走完全部卡片才进 vocab_test**', () => {
    expect(coursePendingOf({ ...C, cursor: 4 })).toBe(false);
    expect(stageWith(coursePendingOf({ ...C, cursor: 4 }))).toBe('vocab_test');
  });
});

// ─────────────────────────────────────────────────────────────
// AC-04 纯新词与混合日
// ─────────────────────────────────────────────────────────────

describe('AC-04 纯新词与混合日', () => {
  it('纯新词日：断点 0 → vocab_learn', () => {
    expect(stageWith(coursePendingOf({ ...C, legacyHasUnlearnedWords: true }))).toBe('vocab_learn');
  });

  it('**教完最后一张新词就进 vocab_test，哪怕一条复习流水都没有**', () => {
    // 首次教学刻意不写 FSRS，所以这里 vocabSettled 必然是 false。
    // 判据换成断点之后，它不再把人关在学词段里（P5 死锁的翻版）。
    expect(
      deriveStage({
        readSettled: true,
        vocabSettled: false, // 没有复习流水
        hasPendingCourseCards: coursePendingOf({ ...C, cursor: 4 }),
        drillSettled: false,
      }),
    ).toBe('vocab_test');
  });

  it('**混合日：只要还剩一张卡就留在学词段**，与新词旧词的先后无关', () => {
    // 队列 = 2 新 + 2 旧，顺序任意；断点 3 时仍剩 1 张
    const mixed = ['newA', 'oldB', 'newC', 'oldD'];
    for (const cursor of [0, 1, 2, 3]) {
      expect(
        coursePendingOf({ ...C, courseCards: mixed, cursor, legacyHasUnlearnedWords: false }),
        `cursor=${cursor}`,
      ).toBe(true);
    }
    expect(coursePendingOf({ ...C, courseCards: mixed, cursor: 4 })).toBe(false);
  });

  it('**刷新/恢复用落库的断点**，不会跳过剩下的复习卡', () => {
    // 断点 2：刷新之后重算，仍然是 vocab_learn（而不是"新词没了就跳段"）
    expect(stageWith(coursePendingOf({ ...C, cursor: 2 }))).toBe('vocab_learn');
  });

  it('顺序仍由服务端决定 —— 判据只用张数，不重排', () => {
    const queue = ['ripple', 'vessel', 'willow', 'anchor'];
    // 生词本里少了一个（被移除过）→ 卡少一张，判据跟着变
    const ordered = lessonCardOrder(queue, ['anchor', 'ripple', 'willow']);
    expect(ordered).toEqual(['ripple', 'willow', 'anchor']); // 队列顺序，不是 owned 的顺序
    expect(coursePendingOf({ ...C, courseCards: ordered, cursor: 3 })).toBe(false);
    expect(coursePendingOf({ ...C, courseCards: ordered, cursor: 2 })).toBe(true);
  });
});

// ─────────────────────────────────────────────────────────────
// AC-05 阶段安全
// ─────────────────────────────────────────────────────────────

describe('AC-05 阶段安全（一条都不许回归）', () => {
  it('没读完 → reading，与课程卡无关', () => {
    expect(
      deriveStage({
        readSettled: false,
        vocabSettled: false,
        hasPendingCourseCards: true,
        drillSettled: false,
      }),
    ).toBe('reading');
  });

  it('**没有内容 / 零张卡 → 不算还有卡**（不会把人扣在学词段）', () => {
    expect(coursePendingOf({ ...C, courseCards: [] })).toBe(false);
    expect(
      deriveStage({
        readSettled: true,
        vocabSettled: true,
        hasPendingCourseCards: coursePendingOf({ ...C, courseCards: [] }),
        drillSettled: true,
      }),
    ).toBe('done');
  });

  it('**旧任务行（vocabWords = NULL）沿用旧信号**，行为一个字不变', () => {
    expect(coursePendingOf({ ...C, courseCards: null, legacyHasUnlearnedWords: true })).toBe(true);
    expect(coursePendingOf({ ...C, courseCards: null, legacyHasUnlearnedWords: false })).toBe(false);
  });

  it('**已经开考就绝不拉回学词段** —— 哪怕卡还剩着', () => {
    expect(coursePendingOf({ ...C, cursor: 0, hasAttempt: true })).toBe(false);
    expect(stageWith(coursePendingOf({ ...C, cursor: 0, hasAttempt: true }))).toBe('vocab_test');
    // 旧任务行同理
    expect(
      coursePendingOf({ ...C, courseCards: null, legacyHasUnlearnedWords: true, hasAttempt: true }),
    ).toBe(false);
  });

  it('**落库的 vocab_test / done 不因这条规则倒退**（clampStage 兜底）', () => {
    const derived = stageWith(coursePendingOf(C)); // 'vocab_learn'
    expect(derived).toBe('vocab_learn');
    expect(clampStage('vocab_test', derived)).toBe('vocab_test');
    expect(clampStage('done', derived)).toBe('done');
  });

  it('交完卷仍然照旧收尾', () => {
    expect(
      deriveStage({
        readSettled: true,
        vocabSettled: true,
        hasPendingCourseCards: false,
        drillSettled: true,
      }),
    ).toBe('done');
  });

  it('**脏断点不会把人锁死**：NaN / 负数 / 超界都当成安全值', () => {
    for (const bad of [NaN, -3, null, undefined, Infinity]) {
      // 非法值一律当 0 → 还有卡（学生从头走一遍，最坏退化成今天的行为）
      expect(coursePendingOf({ ...C, cursor: bad as number }), String(bad)).toBe(true);
    }
    // 超过总数 → 走完
    expect(coursePendingOf({ ...C, cursor: 99 })).toBe(false);
  });
});

describe('AC-06 规则版本', () => {
  it('**阶段语义变了，版本必须 +1**', () => {
    expect(LESSON_RULES_VERSION).toBe(3);
  });
});

// ─────────────────────────────────────────────────────────────
// 返工 1/2 —— **队列与 owned 必须同源**（service 级）
//
// 上一版在 `today()` 里把两份快照拼在了一起：`vocabState()` 跑在可能的
// 创建 / 重新冻结**之前**，而课程卡张数却用写入**之后**的 `vocabWords`。
// 当日任务行还不存在时，前者看到的队列是 null → owned 是空数组 → 与刚
// 创建出来的四词队列一交集，算出 **0 张卡** → 阶段直接落成 `vocab_test`。
// 而 `clampStage` 是单调的，学生再也回不到学词段。
//
// 这些用例走的是**真的 `LessonService.today()`**，只把 Prisma 换成一个
// 有状态的假实现 —— 单测那一层看不出这个缺陷，因为它根本不经过写入。
// ─────────────────────────────────────────────────────────────

type Row = {
  id: string;
  studentId: string;
  date: Date;
  stage: string;
  vocabCursor: number;
  rulesVersion: number;
  vocabWords: string[] | null;
  readTarget: number;
  vocabTarget: number;
  drillTarget: number;
  targetsFrozenAt: Date | null;
  stageAt: Date | null;
};

/**
 * 有状态的假 Prisma。
 *
 * 只建模这条链真正依赖的东西：任务行的生命周期、学生拥有的词、
 * 当日的正式测试。没有阅读场次 → 读段 target 0 → 读段算「完成」，
 * 于是阶段判定完全落在课程卡这一条上，正是我们要测的。
 */
function makeToday(opts: {
  row?: Partial<Row> | null;
  owned: Array<{ headword: string; firstTaughtAt: Date | null; reps: number }>;
  attempt?: { status: string } | null;
  /** 创建 / reconcile 时服务端会想要的队列（模拟到期词） */
  desired?: string[];
}) {
  const day = new Date('2026-08-28T16:00:00.000Z');
  let row: Row | null = opts.row === null || opts.row === undefined
    ? null
    : {
        id: 'dlc1', studentId: 'stu-1', date: day, stage: 'reading', vocabCursor: 0,
        rulesVersion: LESSON_RULES_VERSION, vocabWords: null,
        readTarget: 0, vocabTarget: 4, drillTarget: 0,
        targetsFrozenAt: new Date(), stageAt: null,
        ...opts.row,
      };
  const owned = opts.owned;
  const matches = (w: (typeof owned)[number], where: any): boolean => {
    if (where?.headword?.in && !where.headword.in.includes(w.headword)) return false;
    if (where?.firstTaughtAt === null && w.firstTaughtAt !== null) return false;
    if (where?.firstTaughtAt?.not === null && w.firstTaughtAt === null) return false;
    if (where?.reps === 0 && w.reps !== 0) return false;
    return true;
  };
  const prisma: any = {
    user: {
      findUnique: async () => ({ englishLevel: 'olevel' }),
      findFirst: async () => null,
      updateMany: async () => ({ count: 0 }),
    },
    morningQuizSession: { findMany: async () => [] },
    studentSubmission: { findFirst: async () => null },
    mistakeEntry: { count: async () => 0 },
    wordReviewLog: { findMany: async () => [] },
    vocabQuizAttempt: { findFirst: async () => opts.attempt ?? null },
    studentWord: {
      findMany: async ({ where }: any) =>
        owned.filter((w) => matches(w, where)).map((w) => ({ headword: w.headword })),
      count: async ({ where }: any) => owned.filter((w) => matches(w, where)).length,
    },
    dailyLessonCompletion: {
      findUnique: async () => (row ? { ...row } : null),
      findMany: async () => [],
      create: async ({ data }: any) => {
        row = {
          id: 'dlc1', studentId: 'stu-1', date: day, stage: data.stage ?? 'reading',
          vocabCursor: data.vocabCursor ?? 0,
          rulesVersion: data.rulesVersion ?? LESSON_RULES_VERSION,
          vocabWords: data.vocabWords ?? null,
          readTarget: data.readTarget ?? 0, vocabTarget: data.vocabTarget ?? 0,
          drillTarget: data.drillTarget ?? 0,
          targetsFrozenAt: new Date(), stageAt: null,
        };
        return { ...row };
      },
      update: async ({ data }: any) => {
        row = { ...(row as Row), ...data };
        return { ...(row as Row) };
      },
      updateMany: async ({ data }: any) => {
        if (!row) return { count: 0 };
        row = { ...row, ...data };
        return { count: 1 };
      },
    },
  };
  const words: any = { resolveStudent: vi.fn(async () => ({ id: 'stu-1', name: '测试五号' })) };
  const review: any = {};
  const mistakes: any = { practiceQueue: async () => ({ items: [] }) };
  const svc = new LessonService(prisma, words, review, mistakes);
  return { svc, storedRow: () => row };
}

const taught = (headword: string) => ({ headword, firstTaughtAt: new Date('2026-08-01'), reps: 4 });
const QUEUE4 = ['ripple', 'vessel', 'willow', 'anchor'];

describe('返工 1/2 —— today() 必须用同一份快照算课程卡', () => {
  it('**当日任务行还不存在的纯复习日：开课要落成 vocab_learn，不是 vocab_test**', async () => {
    // 这是 B-1 最狠的一种：vocabState 跑在创建之前 → owned 为空 → 0 张卡
    const { svc, storedRow } = makeToday({ row: null, owned: QUEUE4.map(taught) });
    const t: any = await svc.startOrResumeToday({ studentName: '测试五号' });

    expect(t.stage).toBe('vocab_learn');
    expect(t.nextAction.kind).toBe('learn_vocab');
    // 落库的也必须是 vocab_learn —— clampStage 单调，落错就再也回不来
    expect(storedRow()!.stage).toBe('vocab_learn');
  });

  it('**reconcile 扩了队列而 cursor 停在旧张数：新加的那张卡要把人留住**', async () => {
    // 旧队列 3 张、cursor 3（按旧队列算已走完）；rulesVersion 落后 → 触发 reconcile
    const { svc } = makeToday({
      row: { vocabWords: ['ripple', 'vessel', 'willow'], vocabCursor: 3, rulesVersion: 1, stage: 'reading' },
      owned: QUEUE4.map(taught), // 学生现在拥有四个词
    });
    const t: any = await svc.startOrResumeToday({ studentName: '测试五号' });
    // 队列被扩到 4 张之后，cursor=3 仍然差一张
    expect(t.stage).toBe('vocab_learn');
    expect(t.nextAction.kind).toBe('learn_vocab');
  });

  it('**走完最后一张仍然推进到 vocab_test**', async () => {
    const { svc } = makeToday({
      row: { vocabWords: QUEUE4, vocabCursor: 4, stage: 'reading' },
      owned: QUEUE4.map(taught),
    });
    const t: any = await svc.startOrResumeToday({ studentName: '测试五号' });
    expect(t.stage).toBe('vocab_test');
    expect(t.nextAction.kind).toBe('vocab_test');
  });

  it('**已经开考的任务不会被拉回学词段**', async () => {
    const { svc } = makeToday({
      row: { vocabWords: QUEUE4, vocabCursor: 0, stage: 'vocab_test' },
      owned: QUEUE4.map(taught),
      attempt: { status: 'in_progress' },
    });
    const t: any = await svc.startOrResumeToday({ studentName: '测试五号' });
    expect(t.stage).toBe('vocab_test');
  });

  it('**落库的 vocab_test / done 不会因为这条规则倒退**', async () => {
    for (const stored of ['vocab_test', 'done'] as const) {
      const { svc } = makeToday({
        row: { vocabWords: QUEUE4, vocabCursor: 0, stage: stored },
        owned: QUEUE4.map(taught),
      });
      const t: any = await svc.startOrResumeToday({ studentName: '测试五号' });
      expect(t.stage, stored).toBe(stored);
    }
  });
});
