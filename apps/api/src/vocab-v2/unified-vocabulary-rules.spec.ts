import { describe, expect, it } from 'vitest';
import { countActuallyLearned, pendingDailySessions, testableDailyItems, unseenCandidates } from './unified-vocabulary-rules';

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
});
