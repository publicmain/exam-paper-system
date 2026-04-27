import { describe, it, expect } from 'vitest';
import { GenerationService } from '../src/papers/generation.service';

// Lightweight tests for preflight logic that doesn't need DB.
describe('GenerationService.preflight', () => {
  // @ts-ignore — we don't need prisma for preflight
  const svc = new GenerationService(null);

  it('warns on duration much shorter than total marks', () => {
    const w = svc.preflight({
      subjectId: 'x',
      durationMin: 10,
      totalMarks: 100,
      questionMix: [{ type: 'mcq', count: 10, marksEach: 1 }],
    } as any);
    expect(w.some(s => s.includes('short'))).toBe(true);
  });

  it('warns when mix marks differ from total marks', () => {
    const w = svc.preflight({
      subjectId: 'x',
      durationMin: 60,
      totalMarks: 100,
      questionMix: [{ type: 'mcq', count: 5, marksEach: 1 }],
    } as any);
    expect(w.some(s => s.includes('mix'))).toBe(true);
  });

  it('passes for sensible config', () => {
    const w = svc.preflight({
      subjectId: 'x',
      durationMin: 60,
      totalMarks: 60,
      questionMix: [{ type: 'mcq', count: 20, marksEach: 1 }, { type: 'structured', targetMarks: 40 }],
    } as any);
    expect(w.length).toBe(0);
  });
});
