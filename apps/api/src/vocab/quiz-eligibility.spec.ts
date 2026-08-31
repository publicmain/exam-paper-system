import { describe, it, expect } from 'vitest';
import { MIN_QUIZ_ITEMS, scoreOf, selectEligible } from './quiz-eligibility';

/**
 * P6 —— 出题资格。守的是「绝不考没教过的词」这一条。
 *
 * 这些是纯函数测试。之所以把资格从出题服务里摘出来单独钉死：原来的
 * 两层「凑题数」兜底（reps=0、任意词）就是藏在选词那一大段 SQL 里的，
 * 读代码时看起来只是几个 fallback，实际后果是学生第一次自测全错。
 */

const D = (iso: string) => new Date(iso);
const NOW = D('2026-08-28T02:00:00.000Z');     // SGT 10:00
const DAY_START = D('2026-08-27T16:00:00.000Z'); // SGT 当日零点

const w = (headword: string, o: Partial<{ firstTaughtAt: Date | null; due: Date }> = {}) => ({
  headword,
  firstTaughtAt: o.firstTaughtAt === undefined ? D('2026-08-28T00:30:00.000Z') : o.firstTaughtAt,
  due: o.due ?? D('2026-08-28T01:00:00.000Z'),
});

describe('selectEligible —— 资格', () => {
  it('一个教过的词都没有 → not_ready（不是「凑不齐」，是还没到该考的时候）', () => {
    const r = selectEligible(
      [w('a', { firstTaughtAt: null }), w('b', { firstTaughtAt: null })],
      NOW, DAY_START,
    );
    expect(r.kind).toBe('not_ready');
  });

  it('**未教过的词绝不入选** —— 哪怕它到期了、哪怕凑不够题', () => {
    const r = selectEligible(
      [
        w('taught1'), w('taught2'), w('taught3'),
        w('never1', { firstTaughtAt: null }),
        w('never2', { firstTaughtAt: null }),
        w('never3', { firstTaughtAt: null }),
      ],
      NOW, DAY_START,
    );
    // S12L —— 下限降到 1 之后，3 个教过的词是一份合法的卷子；
    // 不变的是**未教过的三个一个都不许混进来**。
    expect(r.kind).toBe('ok');
    if (r.kind === 'ok') {
      expect(r.words.map((x) => x.headword)).toEqual(['taught1', 'taught2', 'taught3']);
    }
  });

  it('**刚教完、reps=0 的词正常入选** —— 这正是「先学后测」要考的那批', () => {
    const justTaught = Array.from({ length: 5 }, (_, i) =>
      w('fresh' + i, { firstTaughtAt: D('2026-08-28T01:50:00.000Z') }),
    );
    const r = selectEligible(justTaught, NOW, DAY_START);
    expect(r.kind).toBe('ok');
    if (r.kind === 'ok') expect(r.words).toHaveLength(5);
  });

  it('due 被挪到未来的词仍然入选（due 与资格无关）', () => {
    const words = Array.from({ length: 4 }, (_, i) =>
      w('x' + i, {
        firstTaughtAt: D('2026-08-28T01:00:00.000Z'),
        due: D('2026-09-05T00:00:00.000Z'), // 被挪走了
      }),
    );
    const r = selectEligible(words, NOW, DAY_START);
    expect(r.kind).toBe('ok');
  });

  // 「不属于这次任务的词不入选」这条**已经上移到调用方的查询**
  // （headword IN 任务队列，见 vocab-quiz-attempt.spec.ts）。这里曾经
  // 再筛一道日期，纯复习日会把队列里的词全筛掉 —— 那层已删。
  it('本函数**不再按日期筛**：往日教过、due 在未来的词照样入选', () => {
    const words = [
      ...Array.from({ length: 4 }, (_, i) => w('today' + i)),
      w('old', { firstTaughtAt: D('2026-08-01T00:00:00.000Z'), due: D('2026-09-09T00:00:00.000Z') }),
    ];
    const r = selectEligible(words, NOW, DAY_START);
    expect(r.kind).toBe('ok');
    if (r.kind === 'ok') {
      // 纯复习日就是这个形状：复习完 due 被推远、firstTaughtAt 是往日的
      expect(r.words.map((x) => x.headword)).toContain('old');
      expect(r.words).toHaveLength(5);
    }
  });

  it('刚好 MIN 个 → ok；一个都没教过 → not_ready', () => {
    const mk = (n: number) => Array.from({ length: n }, (_, i) => w('w' + i));
    expect(selectEligible(mk(MIN_QUIZ_ITEMS), NOW, DAY_START).kind).toBe('ok');
    expect(selectEligible([], NOW, DAY_START).kind).toBe('not_ready');
  });

  // S12L —— **不再封顶**。教了几个就考几个：`taught.slice(0, 10)` 是一个
  // 静默的产品谎言（学了 21 个词只考 10 道，界面上一个字都没说）。
  // 队列长度本身已经在 `COURSE_QUEUE_MAX` 那里封过顶了。
  it('教了多少就考多少 —— 不截断', () => {
    const r = selectEligible(Array.from({ length: 40 }, (_, i) => w('w' + i)), NOW, DAY_START);
    expect(r.kind).toBe('ok');
    if (r.kind === 'ok') expect(r.words).toHaveLength(40);
  });

  it('ISO 字符串形态的时间同样能判（跨 API 边界后是字符串）', () => {
    const words = Array.from({ length: 4 }, (_, i) => ({
      headword: 's' + i,
      firstTaughtAt: '2026-08-28T00:30:00.000Z',
      due: '2026-08-28T01:00:00.000Z',
    }));
    expect(selectEligible(words, NOW, DAY_START).kind).toBe('ok');
  });
});

describe('scoreOf —— 分数在提交时算一次', () => {
  it('全对 100，全错 0', () => {
    expect(scoreOf([{ isCorrect: true }, { isCorrect: true }])).toEqual({ total: 2, correct: 2, score: 100 });
    expect(scoreOf([{ isCorrect: false }, { isCorrect: false }])).toEqual({ total: 2, correct: 0, score: 0 });
  });

  it('未作答按答错计入总数 —— 考试就是这样', () => {
    expect(scoreOf([{ isCorrect: true }, { isCorrect: null }, { isCorrect: null }])).toEqual({
      total: 3, correct: 1, score: 33.3,
    });
  });

  it('空卷不除以 0', () => {
    expect(scoreOf([])).toEqual({ total: 0, correct: 0, score: 0 });
  });
});

/**
 * P6 收尾 —— 资格条件的**反向测试**。
 *
 * 教学判据（P5）是 `firstTaughtAt IS NULL AND reps = 0`，
 * 考试资格（P6）是 `firstTaughtAt IS NOT NULL`。两条相邻、方向相反，
 * 读文档时极易看串 —— 所以正反两面都各钉一条。
 */
describe('资格条件正反面（P6 收尾）', () => {
  it('**firstTaughtAt = null 绝不出题**：全是 null 时 not_ready，一题都不给', () => {
    const words = Array.from({ length: 20 }, (_, i) =>
      w('never' + i, { firstTaughtAt: null }),
    );
    const r = selectEligible(words, NOW, DAY_START);
    expect(r.kind).toBe('not_ready');
    expect((r as any).eligible).toBe(0);
  });

  it('**firstTaughtAt = null 绝不出题**：与够格的词混在一起时也只取够格的', () => {
    const words = [
      ...Array.from({ length: 5 }, (_, i) => w('ok' + i)),
      ...Array.from({ length: 15 }, (_, i) => w('never' + i, { firstTaughtAt: null })),
    ];
    const r = selectEligible(words, NOW, DAY_START);
    expect(r.kind).toBe('ok');
    if (r.kind === 'ok') {
      expect(r.words).toHaveLength(5);
      expect(r.words.every((x) => x.firstTaughtAt != null)).toBe(true);
      expect(r.words.map((x) => x.headword).some((h) => h.startsWith('never'))).toBe(false);
    }
  });

  it('**firstTaughtAt != null 且 reps = 0 → 可以出题**（刚教完就考，正是设计意图）', () => {
    // reps 根本不在资格判据里 —— 这条测试同时证明它没有被偷偷加回去
    const justTaught = Array.from({ length: 6 }, (_, i) =>
      w('fresh' + i, { firstTaughtAt: D('2026-08-28T01:30:00.000Z') }),
    );
    const r = selectEligible(justTaught, NOW, DAY_START);
    expect(r.kind).toBe('ok');
    if (r.kind === 'ok') expect(r.words).toHaveLength(6);
  });
});
