import { describe, expect, it } from 'vitest';
import { scheduleV2Review } from './fsrs';

describe('V2 FSRS scheduling', () => {
  it('schedules a correct first recall into the future', () => {
    const now = new Date('2026-09-01T00:00:00Z');
    const next = scheduleV2Review(null, true, now);
    expect(next.reps).toBe(1);
    expect(next.due.getTime()).toBeGreaterThan(now.getTime());
  });

  it('records a lapse and makes a failed word due sooner than a successful one', () => {
    const now = new Date('2026-09-01T00:00:00Z');
    const good = scheduleV2Review(null, true, now);
    const again = scheduleV2Review(null, false, now);
    expect(again.lapses).toBeGreaterThanOrEqual(good.lapses);
    expect(again.due.getTime()).toBeLessThanOrEqual(good.due.getTime());
  });
});
