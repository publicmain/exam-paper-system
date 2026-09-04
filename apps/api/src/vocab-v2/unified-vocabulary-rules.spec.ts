import { describe, expect, it } from 'vitest';
import { countActuallyLearned, deferredSenseIds, isTeachingDay, pendingDailySessions, sgtDateKey, testableDailyItems, unseenCandidates } from './unified-vocabulary-rules';

describe('unified vocabulary rules', () => {
  it('tests only actually learned words', () => {
    const items = [
      { senseId: 'learned-a', status: 'completed' },
      { senseId: 'later', status: 'skipped' },
      { senseId: 'replaced-away', status: 'replaced' },
      { senseId: 'learned-b', status: 'completed' },
    ];
    expect(testableDailyItems(items).map((item) => item.senseId)).toEqual(['learned-a', 'learned-b']);
  });

  it('globally excludes every previously encountered sense from new-word pushes', () => {
    const candidates = ['new', 'article-added', 'removed', 'mastered'].map((senseId) => ({ senseId }));
    expect(unseenCandidates(candidates, new Set(['article-added', 'removed', 'mastered']))).toEqual([{ senseId: 'new' }]);
  });

  it('counts only words with a completed learning action', () => {
    expect(countActuallyLearned([{ reps: 0 }, { reps: 1 }, { reps: 3 }])).toBe(2);
  });

  it('keeps multiple unfinished dates and removes only submitted dates', () => {
    const daily = [
      { sessionKey: 'v2:s:2026-09-01:daily' },
      { sessionKey: 'v2:s:2026-09-02:daily' },
      { sessionKey: 'v2:s:2026-09-03:daily' },
    ];
    const statuses = new Map([
      ['v2:s:2026-09-01:daily:formal', 'in_progress'],
      ['v2:s:2026-09-02:daily:formal', 'submitted'],
    ]);
    expect(pendingDailySessions(daily, statuses).map((item) => item.sessionKey)).toEqual([
      'v2:s:2026-09-01:daily',
      'v2:s:2026-09-03:daily',
    ]);
  });

  it('a finished day on which no word was actually learned has no test to list', () => {
    // 全点「稍后再学」：会话 completed，但一个 completed 项都没有。
    // 原来它会变成首页一条「0 个词 · 开始」，点了只会 400。
    const daily = [
      { sessionKey: 'v2:s:2026-09-07:daily', items: [{ status: 'skipped' }, { status: 'skipped' }] },
      { sessionKey: 'v2:s:2026-09-08:daily', items: [{ status: 'completed' }, { status: 'skipped' }] },
    ];
    expect(pendingDailySessions(daily, new Map()).map((item) => item.sessionKey)).toEqual(['v2:s:2026-09-08:daily']);
    // 没带 items 的调用方保持原行为（只看正式测试交没交）。
    expect(pendingDailySessions([{ sessionKey: 'k' }], new Map())).toHaveLength(1);
  });

  it('daily word tasks exist on school days only (Singapore calendar)', () => {
    expect(isTeachingDay('2026-09-07')).toBe(true);  // 周一
    expect(isTeachingDay('2026-09-11')).toBe(true);  // 周五
    expect(isTeachingDay('2026-09-05')).toBe(false); // 周六
    expect(isTeachingDay('2026-09-06')).toBe(false); // 周日
    // 周六 SGT 02:00 = 周五 UTC 18:00 —— 星期必须按新加坡算。
    expect(sgtDateKey(new Date('2026-09-04T18:00:00.000Z'))).toBe('2026-09-05');
    expect(isTeachingDay(sgtDateKey(new Date('2026-09-04T18:00:00.000Z')))).toBe(false);
  });

  it('deferred ("稍后再学") senses come back until the student actually finishes them', () => {
    const items = [
      { senseId: 'later-a', status: 'skipped' },
      { senseId: 'later-then-learned', status: 'skipped' },
      { senseId: 'later-then-learned', status: 'completed' },
      { senseId: 'learned', status: 'completed' },
      { senseId: 'later-a', status: 'skipped' }, // 第二次又点稍后，仍只回来一次
      { senseId: 'pending', status: 'pending' },
    ];
    expect(deferredSenseIds(items)).toEqual(['later-a']);
  });
});
