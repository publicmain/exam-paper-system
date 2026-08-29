import { describe, it, expect } from 'vitest';
import { LESSON_RULES_VERSION, clampStage, coursePendingOf, deriveStage } from './lesson-rules';
import { lessonCardOrder } from './rc11-rules';

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
