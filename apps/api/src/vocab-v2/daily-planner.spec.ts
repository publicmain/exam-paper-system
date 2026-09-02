import { describe, expect, it } from 'vitest';
import { normaliseDailyTarget, planDailyTask, sourceQuota, type PlannerCandidate } from './daily-planner';

const item = (senseId: string, source: PlannerCandidate['source'], quality = 1): PlannerCandidate => ({ senseId, source, quality });

describe('Vocabulary Coach V2 daily planner', () => {
  it('accepts only the four student-configurable sizes', () => {
    expect([5, 10, 15, 20].map(normaliseDailyTarget)).toEqual([5, 10, 15, 20]);
    expect(normaliseDailyTarget(12)).toBe(10);
    expect(normaliseDailyTarget(18)).toBe(20);
  });

  it('scales the review/reading/search/list/enrichment source mix without losing the total', () => {
    for (const target of [5, 10, 15, 20]) {
      expect(Object.values(sourceQuota(target)).reduce((a, b) => a + b, 0)).toBe(target);
    }
  });

  it('deduplicates senses and fills unused quota only from publishable candidates', () => {
    const candidates = [
      item('r1', 'review'), item('r1', 'level_gap'), item('r2', 'review'),
      item('l1', 'reading_lookup'), item('e1', 'reading_error'), item('g1', 'level_gap'),
      item('s1', 'search'), item('x1', 'enrichment'), item('bad', 'review', 0.4),
    ];
    const plan = planDailyTask(candidates, 10);
    expect(new Set(plan.map((row) => row.senseId)).size).toBe(plan.length);
    expect(plan.map((row) => row.senseId)).not.toContain('bad');
    expect(plan.map((row) => row.position)).toEqual(plan.map((_, index) => index + 1));
  });

  it('returns fewer items instead of padding a weak task', () => {
    expect(planDailyTask([item('good', 'level_gap'), item('bad', 'review', 0.2)], 20)).toHaveLength(1);
  });
});
