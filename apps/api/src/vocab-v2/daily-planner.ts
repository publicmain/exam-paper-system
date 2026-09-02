export type V2Source = 'review' | 'reading_lookup' | 'reading_error' | 'search' | 'level_gap' | 'enrichment';

export interface PlannerCandidate {
  senseId: string;
  source: V2Source;
  quality: number;
  dueAt?: Date | null;
  rank?: number | null;
}

export interface PlannedItem extends PlannerCandidate {
  position: number;
}

const ALLOWED_TARGETS = new Set([5, 10, 15, 20]);

export function normaliseDailyTarget(raw: number): 5 | 10 | 15 | 20 {
  const n = Number.isFinite(raw) ? Math.floor(raw) : 10;
  if (ALLOWED_TARGETS.has(n)) return n as 5 | 10 | 15 | 20;
  return [5, 10, 15, 20].reduce((best, value) => Math.abs(value - n) < Math.abs(best - n) ? value : best, 10) as 5 | 10 | 15 | 20;
}

/** Default 8-minute mix from the product contract, scaled to the selected size. */
export function sourceQuota(target: number): Record<V2Source, number> {
  const total = normaliseDailyTarget(target);
  const weights: Record<V2Source, number> = {
    review: 4,
    reading_lookup: 3,
    reading_error: 2,
    search: 1,
    level_gap: 2,
    enrichment: 1,
  };
  const weightTotal = Object.values(weights).reduce((sum, weight) => sum + weight, 0);
  const exact = Object.entries(weights).map(([source, weight]) => ({
    source: source as V2Source,
    base: Math.floor((weight / weightTotal) * total),
    remainder: ((weight / weightTotal) * total) % 1,
  }));
  let assigned = exact.reduce((sum, item) => sum + item.base, 0);
  exact.sort((a, b) => b.remainder - a.remainder || b.base - a.base);
  for (let index = 0; assigned < total; index = (index + 1) % exact.length) {
    exact[index].base += 1;
    assigned += 1;
  }
  return Object.fromEntries(exact.map((item) => [item.source, item.base])) as Record<V2Source, number>;
}

function candidateOrder(a: PlannerCandidate, b: PlannerCandidate) {
  const dueA = a.dueAt?.getTime() ?? Number.POSITIVE_INFINITY;
  const dueB = b.dueAt?.getTime() ?? Number.POSITIVE_INFINITY;
  return dueA - dueB || b.quality - a.quality || (a.rank ?? Number.MAX_SAFE_INTEGER) - (b.rank ?? Number.MAX_SAFE_INTEGER) || a.senseId.localeCompare(b.senseId);
}

/**
 * Selects only high-quality, distinct senses. It deliberately returns fewer
 * than target when the pools do not contain enough publishable items; random
 * filler is the failure mode V2 exists to remove.
 */
export function planDailyTask(candidates: readonly PlannerCandidate[], requestedTarget: number): PlannedItem[] {
  const target = normaliseDailyTarget(requestedTarget);
  const quota = sourceQuota(target);
  const chosen: PlannerCandidate[] = [];
  const used = new Set<string>();

  const take = (source: V2Source, count: number) => {
    candidates
      .filter((item) => item.source === source && item.quality >= 0.8 && !used.has(item.senseId))
      .sort(candidateOrder)
      .slice(0, count)
      .forEach((item) => { used.add(item.senseId); chosen.push(item); });
  };

  (Object.keys(quota) as V2Source[]).forEach((source) => take(source, quota[source]));

  // Reallocate unused quota to other *high-quality* candidates. This keeps the
  // task useful without fabricating filler just to reach a cosmetic number.
  candidates
    .filter((item) => item.quality >= 0.8 && !used.has(item.senseId))
    .sort(candidateOrder)
    .slice(0, target - chosen.length)
    .forEach((item) => { used.add(item.senseId); chosen.push(item); });

  return chosen.slice(0, target).map((item, index) => ({ ...item, position: index + 1 }));
}
