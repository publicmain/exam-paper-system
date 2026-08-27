import { describe, it, expect } from 'vitest';
// **测的是生产代码本身** —— 在测试里另抄一份判断，改回旧口径也不会红。
import {
  vocabTargetOf,
  vocabProgressOf,
  lessonCardOrder,
  shouldRevealAnswer,
  stageAfterSubmit,
  hasAnyTask,
  progressForDisplay,
} from './rc11-rules';

/**
 * RC1.1 —— staging 人工测试抓到的六个 P1/P2，每个至少一条鉴别性测试。
 *
 * 这些是**纯规则**层面的钉子。端到端的证据在隔离库的复现脚本里
 * （修复前 11 红 / 修复后 19 绿），这里钉的是"规则本身"，改回旧口径
 * 就会红。
 */

// ─────────────────────────────────────────────────────────────
// B —— 自由练习不得改变正式课程的目标与范围
// ─────────────────────────────────────────────────────────────

describe('B. 自由练习与正式课程的隔离', () => {
  it('**自由练习做掉一张，目标数不变**（旧口径：4 → 3）', () => {
    const before = vocabTargetOf({ frozenQueue: null, dueNow: 4, reviewedTodayCount: 0 });
    // 复习一张：它不再"此刻到期"，但今天确实到期过
    const after = vocabTargetOf({ frozenQueue: null, dueNow: 3, reviewedTodayCount: 1 });
    expect(before).toBe(4);
    expect(after).toBe(4);
  });

  it('**自由练习不推进正式进度**（没有任务就没有正式进度）', () => {
    expect(vocabProgressOf({ frozenQueue: null, reviewedTodayWords: ['ripple'] })).toBe(0);
  });

  it('任务冻结后，只有队列内的词算进度', () => {
    const queue = ['a', 'b', 'c', 'd'];
    // 学生今天复习了队列里的 a、b，还在自由练习里做了个 zzz
    expect(vocabProgressOf({ frozenQueue: queue, reviewedTodayWords: ['a', 'b', 'zzz'] })).toBe(2);
  });

  it('**目标数以冻结队列为准，不因 due 变化而浮动**', () => {
    const queue = ['a', 'b', 'c', 'd'];
    expect(vocabTargetOf({ frozenQueue: queue, dueNow: 0, reviewedTodayCount: 0 })).toBe(4);
    expect(vocabTargetOf({ frozenQueue: queue, dueNow: 99, reviewedTodayCount: 9 })).toBe(4);
  });
});

// ─────────────────────────────────────────────────────────────
// C —— 课程词卡来自固定队列
// ─────────────────────────────────────────────────────────────

describe('C. 词卡固定队列', () => {
  const queue = ['harbour', 'lantern', 'meadow', 'pebble'];

  it('**发卡顺序 = 任务队列顺序**（旧口径按 due/createdAt 排，实测是倒序）', () => {
    expect(lessonCardOrder(queue, ['pebble', 'meadow', 'lantern', 'harbour'])).toEqual(queue);
  });

  it('**教掉一张后再取，顺序和张数都不变**', () => {
    const first = lessonCardOrder(queue, queue);
    // 教学写了 firstTaughtAt / 复习改了 due —— 队列不受影响
    const afterTeaching = lessonCardOrder(queue, queue);
    expect(afterTeaching).toEqual(first);
    expect(afterTeaching).toHaveLength(4);
  });

  it('**分母不因复习而缩小**（实测：2/3 刷新后变 2/2）', () => {
    expect(lessonCardOrder(queue, queue)).toHaveLength(queue.length);
  });

  it('队列里的词被移出生词本 → 跳过它，其余顺序不动', () => {
    expect(lessonCardOrder(queue, ['harbour', 'meadow', 'pebble'])).toEqual([
      'harbour', 'meadow', 'pebble',
    ]);
  });
});

// ─────────────────────────────────────────────────────────────
// D —— 正式测试的即时判定
// ─────────────────────────────────────────────────────────────

describe('D. 即时判定与答案下发', () => {
  it('**未作答的题不下发答案**（下发了等于把答案放进 devtools）', () => {
    expect(shouldRevealAnswer({ submitted: false, answered: false })).toBe(false);
  });

  it('**已作答的那一题下发答案** —— 前端才标得出正确项', () => {
    // 旧行为：作答后 correctIndex 仍是 null，前端拿它比对，
    // 于是每个选项都"不等于正确答案"，正确选择被标成 ✗
    expect(shouldRevealAnswer({ submitted: false, answered: true })).toBe(true);
  });

  it('提交之后整份都下发（结果页逐题回看）', () => {
    expect(shouldRevealAnswer({ submitted: true, answered: false })).toBe(true);
  });
});

// ─────────────────────────────────────────────────────────────
// E —— 提交后阶段推进
// ─────────────────────────────────────────────────────────────

describe('E. 正式提交后阶段推进', () => {
  it('**submitted 之后阶段必须是 done**（实测：仍停在 vocab_test）', () => {
    expect(stageAfterSubmit('vocab_test', true)).toBe('done');
  });

  it('重复提交幂等：已经是 done 就不动', () => {
    expect(stageAfterSubmit('done', false)).toBe('done');
    expect(stageAfterSubmit('done', true)).toBe('done');
  });

  it('**不越级**：还没走到 vocab_test 的不会被这一步推成 done', () => {
    expect(stageAfterSubmit('reading', true)).toBe('reading');
    expect(stageAfterSubmit('vocab_learn', true)).toBe('vocab_learn');
  });
});

// ─────────────────────────────────────────────────────────────
// F —— 无内容日
// ─────────────────────────────────────────────────────────────

describe('F. 无内容日', () => {
  it('**三段目标全 0 → 今天没有任务**（不建任务行、不算完成、不进连续天数）', () => {
    expect(hasAnyTask({ hasSession: false, vocabTarget: 0, drillTarget: 0 })).toBe(false);
  });

  it('只要有一段有内容就是有任务', () => {
    expect(hasAnyTask({ hasSession: true, vocabTarget: 0, drillTarget: 0 })).toBe(true);
    expect(hasAnyTask({ hasSession: false, vocabTarget: 4, drillTarget: 0 })).toBe(true);
    expect(hasAnyTask({ hasSession: false, vocabTarget: 0, drillTarget: 2 })).toBe(true);
  });

  it('**无任务时完成度报 0，而不是 3/3**', () => {
    // 三段"都完成"是没有目标的副产物 —— 实测：无内容账号看到
    // 「🎉 今天的课完成了 · 连续 1 天」
    const raw = { completed: 3, total: 3 };
    const noTask = hasAnyTask({ hasSession: false, vocabTarget: 0, drillTarget: 0 });
    expect(progressForDisplay(raw, noTask)).toEqual({ completed: 0, total: 3 });
  });

  it('有任务时完成度原样显示', () => {
    const raw = { completed: 2, total: 3 };
    const anyTask = hasAnyTask({ hasSession: true, vocabTarget: 4, drillTarget: 0 });
    expect(progressForDisplay(raw, anyTask)).toEqual(raw);
  });
});
