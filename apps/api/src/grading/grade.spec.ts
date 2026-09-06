import { describe, it, expect } from 'vitest';
import { gradeMcq } from './grade';

/**
 * Pins the deterministic MCQ semantics that used to live inline in
 * autoGradeScripts (R15-followup-10 / -14 / -14b). If any of these change,
 * the batch grader's behaviour changed too — that's the point of the shared
 * core. These are the exact tricky cases that caused production incidents.
 */
describe('gradeMcq (deterministic core)', () => {
  const base = {
    marks: 1,
    selectedOption: null as string | null,
    textAnswer: null as string | null,
    snapshotOptions: null as unknown,
    snapshotContent: undefined as unknown,
    questionOptions: null as unknown,
    answerContent: null as unknown,
  };

  it('marks a correct single-correct option right, a wrong one 0', () => {
    const opts = [
      { key: 'A', correct: false },
      { key: 'B', correct: true },
    ];
    expect(gradeMcq({ ...base, selectedOption: 'B', snapshotOptions: opts }).awardedMarks).toBe(1);
    expect(gradeMcq({ ...base, selectedOption: 'A', snapshotOptions: opts }).isCorrect).toBe(false);
    expect(gradeMcq({ ...base, selectedOption: 'A', snapshotOptions: opts }).awardedMarks).toBe(0);
  });

  it('acceptedKeys accepts ANY listed key (either-order / relaxed pairs)', () => {
    const opts = [{ key: 'A', correct: true }, { key: 'B' }, { key: 'C' }];
    const sc = { acceptedKeys: ['A', 'B'] };
    // canonical correct is A, but B is explicitly accepted → correct
    expect(gradeMcq({ ...base, selectedOption: 'B', snapshotOptions: opts, snapshotContent: sc }).isCorrect).toBe(true);
    expect(gradeMcq({ ...base, selectedOption: 'A', snapshotOptions: opts, snapshotContent: sc }).isCorrect).toBe(true);
    expect(gradeMcq({ ...base, selectedOption: 'C', snapshotOptions: opts, snapshotContent: sc }).isCorrect).toBe(false);
  });

  it('falls back to snapshotContent.correctOption / correctAnswer when no option is flagged', () => {
    const opts = [{ key: 'A' }, { key: 'B' }, { key: 'C' }]; // none flagged correct
    expect(gradeMcq({ ...base, selectedOption: 'C', snapshotOptions: opts, snapshotContent: { correctOption: 'C' } }).isCorrect).toBe(true);
    expect(gradeMcq({ ...base, selectedOption: 'A', snapshotOptions: opts, snapshotContent: { correctAnswer: 'C' } }).isCorrect).toBe(false);
  });

  it('falls back to answerContent.text as the last-resort canonical key', () => {
    const opts = [{ key: 'i' }, { key: 'ii' }];
    expect(gradeMcq({ ...base, selectedOption: 'ii', snapshotOptions: opts, answerContent: { text: 'ii' } }).isCorrect).toBe(true);
  });

  it('grades a typed letter in textAnswer when selectedOption is null (R15-followup-14b)', () => {
    const opts = [{ key: 'A', correct: false }, { key: 'B', correct: true }, { key: 'C' }];
    expect(gradeMcq({ ...base, selectedOption: null, textAnswer: 'b', snapshotOptions: opts }).isCorrect).toBe(true);
  });

  it('is case/whitespace tolerant', () => {
    const opts = [{ key: 'A', correct: true }];
    expect(gradeMcq({ ...base, selectedOption: '  a ', snapshotOptions: opts }).isCorrect).toBe(true);
  });

  it('falls back to questionOptions when snapshotOptions is absent', () => {
    const opts = [{ key: 'A', correct: true }, { key: 'B' }];
    expect(gradeMcq({ ...base, selectedOption: 'A', snapshotOptions: null, questionOptions: opts }).isCorrect).toBe(true);
  });

  it('awards 0 / not-correct when nothing matches', () => {
    const opts = [{ key: 'A', correct: true }];
    const r = gradeMcq({ ...base, selectedOption: null, snapshotOptions: opts });
    expect(r.isCorrect).toBe(false);
    expect(r.awardedMarks).toBe(0);
  });
});

describe('gradeMcq —— 文本框里填了选项文字（2026-09-06 复测 P0）', () => {
  const opts = [
    { key: 'A', text: 'briefcase', correct: true },
    { key: 'B', text: 'umbrella', correct: false },
    { key: 'C', text: 'folder', correct: false },
    { key: 'D', text: 'notebook', correct: false },
  ];
  it('填的词等于正确选项的文字 → 算选了它，给分', () => {
    const r = gradeMcq({ marks: 1, selectedOption: null, textAnswer: 'Briefcase.', snapshotOptions: opts, snapshotContent: {}, questionOptions: null, answerContent: null } as any);
    expect(r.isCorrect).toBe(true);
    expect(r.awardedMarks).toBe(1);
  });
  it('填的词等于错误选项的文字 → 0 分', () => {
    const r = gradeMcq({ marks: 1, selectedOption: null, textAnswer: 'umbrella', snapshotOptions: opts, snapshotContent: {}, questionOptions: null, answerContent: null } as any);
    expect(r.isCorrect).toBe(false);
  });
  it('填的词哪个选项都不是 → 0 分，不猜', () => {
    const r = gradeMcq({ marks: 1, selectedOption: null, textAnswer: 'bag', snapshotOptions: opts, snapshotContent: {}, questionOptions: null, answerContent: null } as any);
    expect(r.isCorrect).toBe(false);
  });
});
