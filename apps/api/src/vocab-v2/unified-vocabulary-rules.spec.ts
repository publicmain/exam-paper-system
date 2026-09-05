import { describe, expect, it } from 'vitest';
import {
  collectUnseenFromList,
  countActuallyLearned,
  deferredSenseIds,
  headwordKey,
  isTeachingDay,
  pendingDailySessions,
  seenHeadwordSet,
  sgtDateKey,
  teacherItemsForStudent,
  testableDailyItems,
  unseenCandidates,
} from './unified-vocabulary-rules';

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

// ── 按拼写去重（2026-09-05）──────────────────────────────────

describe('seenHeadwordSet / headwordKey', () => {
  it('大小写与首尾空白不算区别；空的丢掉', () => {
    const seen = seenHeadwordSet([{ headword: ' Plantation ' }, { headword: 'tide' }, { headword: '' }]);
    expect(seen.has(headwordKey('plantation'))).toBe(true);
    expect(seen.has('tide')).toBe(true);
    expect(seen.size).toBe(2);
  });
});

describe('collectUnseenFromList —— 凑够为止', () => {
  const list = Array.from({ length: 30 }, (_, i) => ({ rank: i + 1, headword: `w${i + 1}` }));

  it('前面一大片都见过也能凑够 10 个（老逻辑读前 100 个就会不足）', () => {
    const seen = new Set(Array.from({ length: 15 }, (_, i) => `w${i + 1}`));
    const r = collectUnseenFromList(list, 1, seen, 10);
    expect(r.picked.map((w) => w.headword)).toEqual(['w16', 'w17', 'w18', 'w19', 'w20', 'w21', 'w22', 'w23', 'w24', 'w25']);
    expect(r.exhausted).toBe(false);
  });

  it('从游标处开始读，不回头', () => {
    const r = collectUnseenFromList(list, 28, new Set(), 10);
    expect(r.picked.map((w) => w.rank)).toEqual([28, 29, 30]);
    expect(r.exhausted).toBe(true);
  });

  it('游标已越过表尾 → 空 + exhausted', () => {
    const r = collectUnseenFromList(list, 31, new Set(), 10);
    expect(r.picked).toEqual([]);
    expect(r.exhausted).toBe(true);
  });

  it('见过的按拼写比，不看它来自哪张表', () => {
    const seen = new Set(['w2']);
    const r = collectUnseenFromList(list, 1, seen, 3);
    expect(r.picked.map((w) => w.headword)).toEqual(['w1', 'w3', 'w4']);
  });
});

describe('teacherItemsForStudent', () => {
  const items = [
    { headword: 'tide', force: false },
    { headword: 'barrage', force: false },
    { headword: 'estuary', force: true },
  ];

  it('见过的跳过，force 的照给', () => {
    const r = teacherItemsForStudent(items, new Set(['tide', 'estuary']));
    expect(r.kept.map((i) => i.headword)).toEqual(['barrage', 'estuary']);
    expect(r.skipped.map((i) => i.headword)).toEqual(['tide']);
  });

  it('全见过且都不 force → kept 为空（调用方回到档位词表）', () => {
    const r = teacherItemsForStudent(items.map((i) => ({ ...i, force: false })), new Set(['tide', 'barrage', 'estuary']));
    expect(r.kept).toEqual([]);
    expect(r.skipped).toHaveLength(3);
  });

  it('没见过任何词 → 原样保序', () => {
    const r = teacherItemsForStudent(items, new Set());
    expect(r.kept).toEqual(items);
  });
});
