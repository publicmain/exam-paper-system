import { describe, it, expect } from 'vitest';
import { resolveItemMarks } from './homework.service';

/**
 * v2 grading arithmetic — the one function saveGrades and the retroactive
 * item re-score both call. If this is right, clicked-item scoring and
 * mid-grading rubric edits stay consistent for every submission.
 */
describe('resolveItemMarks (rubric-item scoring)', () => {
  const items = [
    { id: 'a', delta: 2 },   // 方法正确 +2
    { id: 'b', delta: 1 },   // 结果正确 +1
    { id: 'c', delta: -1 },  // 漏写单位 -1
  ];

  it('sums positive deltas', () => {
    expect(resolveItemMarks(items, ['a', 'b'], 5)).toBe(3);
  });

  it('applies negative deltas', () => {
    expect(resolveItemMarks(items, ['a', 'b', 'c'], 5)).toBe(2);
  });

  it('clamps to maxMarks (over-award impossible)', () => {
    expect(resolveItemMarks(items, ['a', 'b'], 2)).toBe(2);
  });

  it('clamps at zero (deductions cannot go negative)', () => {
    expect(resolveItemMarks(items, ['c'], 5)).toBe(0);
  });

  it('ignores unknown item ids (item deleted mid-grading)', () => {
    expect(resolveItemMarks(items, ['a', 'ghost'], 5)).toBe(2);
  });

  it('empty selection scores zero', () => {
    expect(resolveItemMarks(items, [], 5)).toBe(0);
  });

  it('retroactive edit: changing a delta changes the same applied set', () => {
    const before = resolveItemMarks(items, ['a', 'b'], 5); // 3
    const edited = items.map((x) => (x.id === 'a' ? { ...x, delta: 3 } : x));
    const after = resolveItemMarks(edited, ['a', 'b'], 5); // 4
    expect(before).toBe(3);
    expect(after).toBe(4);
  });
});
