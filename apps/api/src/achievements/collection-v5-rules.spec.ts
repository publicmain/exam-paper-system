import { describe, expect, it } from 'vitest';
import { COLLECTION_V5_BADGES, COLLECTION_V5_RULES_VERSION, emptyCollectionV5Facts, evaluateCollectionV5Badges,
  type CollectionV5Event, type CollectionV5Facts } from './collection-v5-rules';

const event = (i: number, extra: Partial<CollectionV5Event> = {}): CollectionV5Event => ({ key: `task-${i}`, at: new Date(Date.UTC(2025, 0, 1 + i)), sessionId: `s-${i}`, submissionId: `r-${i}`, ...extra });
const events = (n: number) => Array.from({ length: n }, (_, i) => event(i));
const badge = (facts: CollectionV5Facts, key: string) => evaluateCollectionV5Badges(facts).find((b) => b.key === key)!;

describe('Approved V5 collection rules', () => {
  it('has exactly 16 asset-matched independent medals, never the 24 legacy awards', () => {
    expect(COLLECTION_V5_RULES_VERSION).toBe(5);
    expect(COLLECTION_V5_BADGES).toHaveLength(16);
    expect(new Set(COLLECTION_V5_BADGES.map((b) => b.key)).size).toBe(16);
    for (const b of COLLECTION_V5_BADGES) expect(b.key).toBe(`v5_${b.assetId.replace(/-/g, '_')}`);
    for (const series of ['reading', 'vocabulary', 'mastery']) {
      const group = COLLECTION_V5_BADGES.filter((b) => b.series === series);
      expect(group.map((b) => b.threshold)).toEqual([15, 50, 150, 300]);
      expect(group.map((b) => b.tier)).toEqual([1, 2, 3, 4]);
    }
    expect(COLLECTION_V5_BADGES.filter((b) => b.hidden)).toHaveLength(3);
  });

  for (const [series, metric] of [['reading', 'readings'], ['vocabulary', 'learningBatches'], ['mastery', 'tests']] as const) {
    for (const [tier, threshold] of [15, 50, 150, 300].entries()) {
      it(`${series} level ${tier + 1}: below/at/above ${threshold}, independent collection and full threshold proof`, () => {
        const f = emptyCollectionV5Facts();
        f[metric] = events(threshold - 1);
        expect(badge(f, `v5_${series}_${tier + 1}`)).toMatchObject({ earned: false, current: threshold - 1 });
        f[metric].push(event(threshold - 1));
        const earned = badge(f, `v5_${series}_${tier + 1}`);
        expect(earned).toMatchObject({ earned: true, current: threshold });
        expect(earned.evidence.sessionIds).toHaveLength(threshold);
        f[metric].push(event(threshold), event(0));
        expect(badge(f, `v5_${series}_${tier + 1}`).evidence.total).toBe(threshold + 1);
        expect(evaluateCollectionV5Badges(f).filter((b) => b.series === series && b.earned)).toHaveLength(tier + 1);
      });
    }
  }

  it('cannot multiply task events by duplicates or malformed dates, and preserves first real completion date', () => {
    const f = emptyCollectionV5Facts();
    f.learningBatches = [...events(14), event(0, { at: new Date('2026-09-16') }), event(99, { at: new Date('invalid') }), event(98, { key: '' })];
    expect(badge(f, 'v5_vocabulary_1')).toMatchObject({ earned: false, current: 14 });
    f.learningBatches.push(event(14, { at: new Date('2026-09-16T16:00:00Z') }));
    expect(badge(f, 'v5_vocabulary_1').earnedOn).toBe('2026-09-17');
  });

  it('triad uses 15 distinct source dates and actual final completion for medal date, not a streak', () => {
    const f = emptyCollectionV5Facts();
    f.fullDays = events(15).map((e, i) => ({ ...e, key: `2025-01-${String(i + 1).padStart(2, '0')}`, sourceDate: `2025-01-${String(i + 1).padStart(2, '0')}`, at: new Date('2026-09-16T16:01:00Z') }));
    const got = badge(f, 'v5_hidden_triad');
    expect(got).toMatchObject({ earned: true, earnedOn: '2026-09-17' });
    expect(got.evidence.dates).toHaveLength(15);
    expect(got.evidence.dates[0]).toBe('2025-01-01');
  });

  it('worlds needs five topics with three distinct articles each, not 15 on one topic', () => {
    const f = emptyCollectionV5Facts();
    f.readings = events(15).map((e) => ({ ...e, topic: 'science' }));
    expect(badge(f, 'v5_hidden_worlds')).toMatchObject({ current: 1, earned: false });
    f.readings = events(15).map((e, i) => ({ ...e, topic: `topic-${Math.floor(i / 3)}` }));
    const got = badge(f, 'v5_hidden_worlds');
    expect(got).toMatchObject({ current: 5, earned: true });
    expect(got.evidence.articleKeys).toHaveLength(15);
    expect(got.evidence.topics).toHaveLength(5);
    f.readings[14] = { ...f.readings[14], topic: undefined };
    expect(badge(f, 'v5_hidden_worlds')).toMatchObject({ current: 4, earned: false });
  });

  it('same article cannot count for several primary topics', () => {
    const f = emptyCollectionV5Facts();
    f.readings = Array.from({ length: 5 }, (_, topic) => events(3).map((e) => ({ ...e, topic: `topic-${topic}` }))).flat();
    expect(badge(f, 'v5_hidden_worlds').earned).toBe(false);
    expect(badge(f, 'v5_reading_1').current).toBe(3);
  });

  it('starlight requires 15 actual SGT days per month, four nonconsecutive months; a day cannot duplicate', () => {
    const f = emptyCollectionV5Facts();
    f.activeDays = [0, 2, 5, 8].flatMap((month) => Array.from({ length: 15 }, (_, day) => event(day, {
      key: 'misleading-source-day', at: new Date(Date.UTC(2026, month, day + 1, 1)),
    })));
    expect(badge(f, 'v5_hidden_starlight')).toMatchObject({ earned: true, current: 4, earnedOn: '2026-09-15' });
    expect(badge(f, 'v5_hidden_starlight').evidence.dates).toHaveLength(60);
    f.activeDays.pop(); f.activeDays.push(f.activeDays[0]);
    expect(badge(f, 'v5_hidden_starlight')).toMatchObject({ earned: false, current: 3 });
  });

  it('SGT month boundary is actual activity month, makeup source date cannot change it', () => {
    const f = emptyCollectionV5Facts();
    f.activeDays = Array.from({ length: 15 }, (_, day) => event(day, { key: `2026-08-${day + 1}`, sourceDate: `2026-08-${day + 1}`, at: new Date('2026-08-31T16:01:00Z') }));
    expect(badge(f, 'v5_hidden_starlight')).toMatchObject({ current: 0, earned: false });
  });

  it('crown requires all three main IV medals, and does not require hidden medals', () => {
    const f = emptyCollectionV5Facts(); f.readings = events(300); f.learningBatches = events(300); f.tests = events(299);
    expect(badge(f, 'v5_crown')).toMatchObject({ current: 2, earned: false });
    f.tests.push(event(299));
    expect(badge(f, 'v5_crown')).toMatchObject({ current: 3, earned: true });
    expect(evaluateCollectionV5Badges(f).filter((b) => b.earned)).toHaveLength(13);
  });

  it('saved medals persist; legacy keys never unlock V5; revoked prerequisites cannot silently regrant/crown', () => {
    const f = emptyCollectionV5Facts();
    const saved = [{ badgeKey: 'v5_reading_4', earnedOn: '2026-01-15', revokedAt: null }, { badgeKey: 'v3_word_collector_l4', earnedOn: '2026-01-15', revokedAt: null }];
    expect(evaluateCollectionV5Badges(f, saved).find((b) => b.key === 'v5_reading_4')).toMatchObject({ earned: true, earnedOn: '2026-01-15', current: 300 });
    expect(evaluateCollectionV5Badges(f, saved).find((b) => b.key === 'v5_vocabulary_4')?.earned).toBe(false);
    f.readings = events(300); f.learningBatches = events(300); f.tests = events(300);
    const revoked = evaluateCollectionV5Badges(f, [{ badgeKey: 'v5_reading_1', earnedOn: '2026-01-15', revokedAt: new Date() }]);
    expect(revoked.filter((b) => b.series === 'reading').every((b) => !b.earned)).toBe(true);
    expect(revoked.find((b) => b.key === 'v5_crown')).toMatchObject({ earned: false, blockedBy: ['v5_reading_1'] });
  });

  it('evaluation is deterministic without mutating input order or facts', () => {
    const f = emptyCollectionV5Facts(); f.readings = events(16).reverse();
    const before = JSON.stringify(f), one = evaluateCollectionV5Badges(f), two = evaluateCollectionV5Badges(f);
    expect(one).toEqual(two); expect(JSON.stringify(f)).toBe(before);
  });
});
