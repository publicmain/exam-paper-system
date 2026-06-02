import { describe, it, expect } from 'vitest';
import { validatePaperStructure } from './paper-structure-validator';

/**
 * R15-followup-23 — pin the structural checks that the 5/26 TFNG bug
 * proved my prior ad-hoc audit missed. Specifically: every taskType
 * that REQUIRES options must surface a violation when snapshotOptions
 * is empty. The previous "if has options, verify correct key" shape
 * silently passed those.
 */
describe('validatePaperStructure', () => {
  function q(over: Partial<any>): any {
    return {
      sortOrder: 1,
      snapshotOptions: [],
      snapshotContent: { stem: 'A valid stem.' },
      snapshotAnswer: {},
      question: { questionType: 'mcq' },
      ...over,
    };
  }

  it('flags TFNG with empty snapshotOptions — the 5/26 case', () => {
    const v = validatePaperStructure([
      q({
        sortOrder: 6,
        snapshotOptions: [],
        snapshotContent: { stem: 'Most carbon inventories…', taskType: 'true_false_not_given' },
        snapshotAnswer: { text: 'FALSE' },
      }),
    ]);
    expect(v).toHaveLength(1);
    expect(v[0]).toMatchObject({
      sortOrder: 6,
      taskType: 'true_false_not_given',
      code: 'EMPTY_OPTIONS',
    });
  });

  it('flags YNG with empty snapshotOptions', () => {
    const v = validatePaperStructure([
      q({ snapshotContent: { stem: 's', taskType: 'yes_no_not_given' }, snapshotAnswer: { text: 'YES' } }),
    ]);
    expect(v[0].code).toBe('EMPTY_OPTIONS');
  });

  it('flags multiple_choice with only 1 option (needs ≥2)', () => {
    const v = validatePaperStructure([
      q({
        snapshotOptions: [{ key: 'A', text: 'only one' }],
        snapshotContent: { stem: 's', taskType: 'multiple_choice' },
        snapshotAnswer: { text: 'A' },
      }),
    ]);
    expect(v[0].code).toBe('TOO_FEW_OPTIONS');
  });

  it('flags TFNG with only 2 options (needs ≥3)', () => {
    const v = validatePaperStructure([
      q({
        snapshotOptions: [{ key: 'A', text: 'TRUE' }, { key: 'B', text: 'FALSE' }],
        snapshotContent: { stem: 's', taskType: 'true_false_not_given' },
        snapshotAnswer: { text: 'TRUE' },
      }),
    ]);
    expect(v[0].code).toBe('TOO_FEW_OPTIONS');
  });

  it('passes a well-formed TFNG (3 options + canonical answer)', () => {
    const v = validatePaperStructure([
      q({
        snapshotOptions: [
          { key: 'A', text: 'TRUE', correct: true },
          { key: 'B', text: 'FALSE' },
          { key: 'C', text: 'NOT GIVEN' },
        ],
        snapshotContent: { stem: 's', taskType: 'true_false_not_given' },
        snapshotAnswer: { text: 'TRUE' },
      }),
    ]);
    expect(v).toEqual([]);
  });

  it('flags MCQ with options but NO canonical key anywhere', () => {
    const v = validatePaperStructure([
      q({
        snapshotOptions: [
          { key: 'A', text: 'a' }, { key: 'B', text: 'b' }, { key: 'C', text: 'c' },
        ],
        snapshotContent: { stem: 's', taskType: 'multiple_choice' },
        snapshotAnswer: {},
      }),
    ]);
    expect(v[0].code).toBe('NO_CANONICAL_ANSWER');
  });

  it('accepts canonical via snapshotContent.correctOption', () => {
    const v = validatePaperStructure([
      q({
        snapshotOptions: [
          { key: 'A', text: 'a' }, { key: 'B', text: 'b' }, { key: 'C', text: 'c' },
        ],
        snapshotContent: { stem: 's', taskType: 'multiple_choice', correctOption: 'B' },
        snapshotAnswer: {},
      }),
    ]);
    expect(v).toEqual([]);
  });

  it('accepts canonical via snapshotContent.acceptedKeys (relaxed/either-order MCQ)', () => {
    // Guards the acceptedKeys answer-key path (e.g. the 6/03 simplified Q8/Q9
    // "confident"/"still confident" relaxation) against the validator
    // regressing and flagging a legitimately-relaxed question.
    const v = validatePaperStructure([
      q({
        snapshotOptions: [{ key: 'A', text: 'a' }, { key: 'B', text: 'b' }, { key: 'C', text: 'c' }],
        snapshotContent: { stem: 's', taskType: 'multiple_choice', acceptedKeys: ['A', 'B'] },
        snapshotAnswer: {},
      }),
    ]);
    expect(v).toEqual([]);
  });

  it('flags empty stem regardless of taskType', () => {
    const v = validatePaperStructure([
      q({ snapshotContent: { stem: '', taskType: 'short_answer' } }),
    ]);
    expect(v.map((x) => x.code)).toContain('EMPTY_STEM');
  });

  it('does NOT flag short_answer for missing options (text-input task)', () => {
    const v = validatePaperStructure([
      q({
        snapshotOptions: [],
        snapshotContent: { stem: 's', taskType: 'short_answer' },
        snapshotAnswer: { text: 'pendulum clock' },
      }),
    ]);
    expect(v).toEqual([]);
  });

  it('catches MULTIPLE violations across a paper', () => {
    const v = validatePaperStructure([
      q({
        sortOrder: 6, snapshotOptions: [],
        snapshotContent: { stem: 's6', taskType: 'true_false_not_given' },
        snapshotAnswer: { text: 'FALSE' },
      }),
      q({
        sortOrder: 7, snapshotOptions: [],
        snapshotContent: { stem: 's7', taskType: 'yes_no_not_given' },
        snapshotAnswer: { text: 'YES' },
      }),
      q({
        sortOrder: 8,
        snapshotContent: { stem: '', taskType: 'short_answer' },
      }),
    ]);
    expect(v).toHaveLength(3);
    expect(v.map((x) => x.sortOrder).sort()).toEqual([6, 7, 8]);
  });
});
