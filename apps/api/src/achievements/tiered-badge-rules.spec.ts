import { describe, expect, it } from 'vitest';
import { emptyTieredFacts, evaluateTieredBadges, tieredBadgeKey, TIERED_BADGES, TIERED_BADGE_RULES_VERSION, type Tier, type ThemeId, type TieredAchievementFacts } from './tiered-badge-rules';

const events = (count: number) => Array.from({ length: count }, (_, i) => ({ key: String(i), at: new Date(Date.UTC(2020, 0, 1 + i, 2)), submissionId: 'sub-' + i, sessionId: 'session-' + i }));
const full = (): TieredAchievementFacts => ({ readings: events(100), words: events(1000), tests: events(100), fullDays: events(100), activeDays: events(100) });
describe('Six physical medal themes, four deterministic tiers', () => {
  it('has exactly24 stable unique keys, bounded DB key length and public difficulty labels', () => {
    expect(TIERED_BADGES).toHaveLength(24); expect(new Set(TIERED_BADGES.map((b) => b.key)).size).toBe(24);
    for (const badge of TIERED_BADGES) { expect(badge.key.length).toBeLessThanOrEqual(40); expect(badge.title).not.toMatch(/雅思\s*[5-9]|词汇大师|排名/); }
    expect(TIERED_BADGES.slice(0, 4).map((b) => b.difficulty)).toEqual(['简单', '适中', '难', '非常难']);
  });
  const metrics: Array<[ThemeId, keyof TieredAchievementFacts, number[]]> = [
    ['first-chapter', 'fullDays', [15, 30, 60, 100]], ['reading-explorer', 'readings', [15, 30, 60, 100]],
    ['word-collector', 'words', [15, 50, 200, 1000]], ['quiz-milestone', 'tests', [15, 30, 60, 100]],
    ['steady-effort', 'activeDays', [15, 30, 60, 100]],
  ];
  it('version 3 starts every activity theme at 15 and keeps higher tiers strictly increasing', () => {
    expect(TIERED_BADGE_RULES_VERSION).toBe(3);
    for (const [theme, , thresholds] of metrics) {
      expect(TIERED_BADGES.filter((badge) => badge.themeId === theme).map((badge) => badge.threshold)).toEqual(thresholds);
      expect(thresholds[0]).toBe(15);
      for (let i = 1; i < thresholds.length; i++) expect(thresholds[i]).toBeGreaterThan(thresholds[i - 1]);
    }
  });
  for (const [theme, metric, thresholds] of metrics) for (const tier of [1, 2, 3, 4] as Tier[]) {
    it(theme + ' L' + tier + ' exact threshold and threshold-minus-one', () => {
      const threshold = thresholds[tier - 1], key = tieredBadgeKey(theme, tier);
      const below = { ...emptyTieredFacts(), [metric]: events(threshold - 1) };
      expect(evaluateTieredBadges(below).find((b) => b.key === key)).toMatchObject({ earned: false, current: threshold - 1 });
      const hit = { ...emptyTieredFacts(), [metric]: events(threshold) };
      expect(evaluateTieredBadges(hit).find((b) => b.key === key)).toMatchObject({ earned: true, current: threshold });
    });
  }
  it('high cumulative evidence fills all lower tiers once; all five prerequisites grant each school tier', () => {
    const result = evaluateTieredBadges(full());
    expect(result.every((b) => b.earned)).toBe(true);
    expect(result.filter((b) => b.themeId === 'school-edition').map((b) => b.current)).toEqual([5, 5, 5, 5]);
  });
  it('duplicates and invalid timestamps do not inflate counters', () => {
    const repeated = Array.from({ length: 1000 }, () => ({ key: 'same-word', at: new Date('2026-09-15T02:00:00Z') }));
    const result = evaluateTieredBadges({ ...emptyTieredFacts(), words: [...repeated, { key: 'bad', at: new Date('invalid') }] });
    expect(result.find((b) => b.key === 'v3_word_collector_l1')).toMatchObject({ current: 1, earned: false });
  });
  it('revoked lower tier blocks new higher tiers and composite; existing higher award is retained but cannot derive a new composite', () => {
    const rows = [
      { badgeKey: 'v3_reading_explorer_l1', earnedOn: '2020-01-01', revokedAt: new Date() },
      { badgeKey: 'v3_reading_explorer_l4', earnedOn: '2020-06-01', revokedAt: null },
    ];
    const result = evaluateTieredBadges(full(), rows);
    expect(result.find((b) => b.key === 'v3_reading_explorer_l2')?.earned).toBe(false);
    expect(result.find((b) => b.key === 'v3_reading_explorer_l4')?.earned).toBe(true);
    expect(result.filter((b) => b.themeId === 'school-edition').every((b) => !b.earned && b.current === 4)).toBe(true);
    expect(evaluateTieredBadges(full(), rows.map((row) => ({ ...row, revokedAt: null }))).every((b) => b.earned)).toBe(true);
  });
  it('school tier uses saved prerequisite awards even if underlying history later changes', () => {
    const rows = TIERED_BADGES.filter((b) => b.tier === 1 && b.themeId !== 'school-edition').map((b) => ({ badgeKey: b.key, earnedOn: '2026-09-10', revokedAt: null }));
    const result = evaluateTieredBadges(emptyTieredFacts(), rows);
    expect(result.find((b) => b.key === 'v3_school_edition_l1')).toMatchObject({ current: 5, earned: true, earnedOn: '2026-09-10' });
  });
  it('14 events grant no first-tier medals; the 15th event grants all five themes and their collection', () => {
    const at14 = Object.fromEntries(Object.keys(emptyTieredFacts()).map((metric) => [metric, events(14)])) as unknown as TieredAchievementFacts;
    const at15 = Object.fromEntries(Object.keys(emptyTieredFacts()).map((metric) => [metric, events(15)])) as unknown as TieredAchievementFacts;
    expect(evaluateTieredBadges(at14).every((badge) => !badge.earned)).toBe(true);
    const earned = evaluateTieredBadges(at15).filter((badge) => badge.earned);
    expect(earned).toHaveLength(6);
    expect(earned.every((badge) => badge.tier === 1 && badge.earnedOn === '2020-01-15')).toBe(true);
  });
});
