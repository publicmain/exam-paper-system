import { describe, it, expect } from 'vitest';
import { GradeService } from './grade.service';
import { GradeResultSchema } from './grade.contract';

describe('GradeService (Phase 1 seam)', () => {
  const svc = new GradeService();

  it('grades MCQ deterministically and emits source=deterministic', () => {
    const r = svc.grade({
      questionType: 'mcq',
      maxMarks: 1,
      selectedOption: 'B',
      options: [{ key: 'A', correct: false }, { key: 'B', correct: true }],
    });
    expect(r.awardedMarks).toBe(1);
    expect(r.isCorrect).toBe(true);
    expect(r.needsHumanReview).toBe(false);
    expect(r.source).toBe('deterministic');
    // result honours its own contract
    expect(GradeResultSchema.safeParse(r).success).toBe(true);
  });

  it('honours acceptedKeys through the contract', () => {
    const r = svc.grade({
      questionType: 'mcq',
      maxMarks: 1,
      selectedOption: 'B',
      options: [{ key: 'A', correct: true }, { key: 'B' }],
      acceptedKeys: ['A', 'B'],
    });
    expect(r.isCorrect).toBe(true);
  });

  it('is full-fidelity with the batch grader: correctAnswer alias + answerContent.text', () => {
    // canonical key supplied only via correctAnswer (no option flagged correct)
    const r1 = svc.grade({
      questionType: 'mcq',
      maxMarks: 1,
      selectedOption: 'C',
      options: [{ key: 'A' }, { key: 'B' }, { key: 'C' }],
      correctAnswer: 'C',
    });
    expect(r1.isCorrect).toBe(true);
    // canonical key only via answerContent.text (legacy "ii"-style key)
    const r2 = svc.grade({
      questionType: 'mcq',
      maxMarks: 1,
      selectedOption: 'ii',
      options: [{ key: 'i' }, { key: 'ii' }],
      answerContent: { text: 'ii' },
    });
    expect(r2.isCorrect).toBe(true);
  });

  it('defers short_answer to the human marker queue (zero-API mode)', () => {
    const r = svc.grade({
      questionType: 'short_answer',
      maxMarks: 2,
      textAnswer: 'some prose',
      markScheme: 'the model answer',
    });
    expect(r.needsHumanReview).toBe(true);
    expect(r.awardedMarks).toBeNull();
    expect(r.isCorrect).toBeNull();
    expect(r.source).toBe('human_pending');
  });

  it('defers essay + structured to human too', () => {
    for (const t of ['essay', 'structured'] as const) {
      const r = svc.grade({ questionType: t, maxMarks: 5, textAnswer: 'x' });
      expect(r.needsHumanReview).toBe(true);
      expect(r.source).toBe('human_pending');
    }
  });

  it('rejects a malformed request at the boundary', () => {
    expect(() => svc.grade({ questionType: 'mcq' } as any)).toThrow(); // missing maxMarks
    expect(() => svc.grade({ questionType: 'banana', maxMarks: 1 } as any)).toThrow();
  });
});
