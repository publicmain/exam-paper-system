import { describe, it, expect } from 'vitest';
import { AiQuestionGeneratorService } from './ai-question-generator.service';

/**
 * Pure-function tests for parseResponse + validateEnglishContract.
 * No Prisma / no Anthropic SDK calls — the service is constructed with
 * a null prisma + null audit and the parse/validate methods run offline.
 */

function makeService(): AiQuestionGeneratorService {
  // Both deps unused by the methods under test.
  return new AiQuestionGeneratorService(null as any, null as any);
}

describe('AiQuestionGeneratorService — B5 uiKind contract', () => {
  it('parseResponse extracts uiKind when AI emits it', () => {
    const svc = makeService();
    const text = JSON.stringify([
      {
        stem: 'Choose the correct option.',
        totalMarks: 1,
        suggestedDifficulty: 2,
        questionType: 'mcq',
        uiKind: 'multiple_choice',
      },
    ]);
    const parsed = (svc as any).parseResponse(text);
    expect(parsed).toHaveLength(1);
    expect(parsed[0].uiKind).toBe('multiple_choice');
  });

  it('parseResponse drops invalid uiKind to undefined', () => {
    const svc = makeService();
    const text = JSON.stringify([
      {
        stem: 's',
        totalMarks: 1,
        suggestedDifficulty: 2,
        questionType: 'mcq',
        uiKind: 'something_invented',
      },
    ]);
    const parsed = (svc as any).parseResponse(text);
    expect(parsed[0].uiKind).toBeUndefined();
  });

  it('validateEnglishContract throws when IELTS question lacks uiKind', () => {
    const svc = makeService();
    const parsed = [
      {
        stem: 's',
        totalMarks: 1,
        suggestedDifficulty: 2,
        questionType: 'short_answer' as const,
        // uiKind missing
      },
    ];
    expect(() => svc.validateEnglishContract('IELTS', parsed as any)).toThrow(
      /missing uiKind/,
    );
  });

  it('validateEnglishContract throws when 1123 question lacks uiKind', () => {
    const svc = makeService();
    const parsed = [
      {
        stem: 's',
        totalMarks: 1,
        suggestedDifficulty: 2,
        questionType: 'mcq' as const,
      },
    ];
    expect(() => svc.validateEnglishContract('1123', parsed as any)).toThrow(
      /missing uiKind/,
    );
  });

  it('validateEnglishContract is a no-op for non-English subjects (Physics)', () => {
    const svc = makeService();
    const parsed = [
      {
        stem: 's',
        totalMarks: 1,
        suggestedDifficulty: 2,
        questionType: 'mcq' as const,
      },
    ];
    expect(() => svc.validateEnglishContract('9702', parsed as any)).not.toThrow();
  });

  it('validateEnglishContract passes when every question has uiKind', () => {
    const svc = makeService();
    const parsed = [
      { stem: 's1', totalMarks: 1, suggestedDifficulty: 2, questionType: 'mcq' as const, uiKind: 'multiple_choice' as const },
      { stem: 's2', totalMarks: 1, suggestedDifficulty: 2, questionType: 'mcq' as const, uiKind: 'vocab_in_context' as const },
    ];
    expect(() => svc.validateEnglishContract('IELTS', parsed as any)).not.toThrow();
  });
});

describe('AiQuestionGeneratorService — B6 cloze [BLANK] contract', () => {
  it('cloze passes when [BLANK] count equals question count', () => {
    const svc = makeService();
    const parsed = [
      {
        stem: 'Blank 1:',
        totalMarks: 1,
        suggestedDifficulty: 2,
        questionType: 'short_answer' as const,
        uiKind: 'cloze' as const,
        passage: 'Apples are [BLANK] but oranges are [BLANK] and lemons are [BLANK].',
      },
      { stem: 'Blank 2:', totalMarks: 1, suggestedDifficulty: 2, questionType: 'short_answer' as const, uiKind: 'cloze' as const },
      { stem: 'Blank 3:', totalMarks: 1, suggestedDifficulty: 2, questionType: 'short_answer' as const, uiKind: 'cloze' as const },
    ];
    expect(() => svc.validateEnglishContract('1123', parsed as any)).not.toThrow();
  });

  it('cloze rejects when [BLANK] count is wrong', () => {
    const svc = makeService();
    const parsed = [
      {
        stem: 's', totalMarks: 1, suggestedDifficulty: 2, questionType: 'short_answer' as const,
        uiKind: 'cloze' as const,
        passage: 'Only one [BLANK] here.',
      },
      { stem: 's', totalMarks: 1, suggestedDifficulty: 2, questionType: 'short_answer' as const, uiKind: 'cloze' as const },
      { stem: 's', totalMarks: 1, suggestedDifficulty: 2, questionType: 'short_answer' as const, uiKind: 'cloze' as const },
    ];
    expect(() => svc.validateEnglishContract('1123', parsed as any)).toThrow(
      /1 \[BLANK\] markers but 3 questions/,
    );
  });

  it('cloze rejects when first question has no passage', () => {
    const svc = makeService();
    const parsed = [
      { stem: 's', totalMarks: 1, suggestedDifficulty: 2, questionType: 'short_answer' as const, uiKind: 'cloze' as const },
    ];
    expect(() => svc.validateEnglishContract('1123', parsed as any)).toThrow(
      /must carry a `passage` field/,
    );
  });

  it('cloze rejects mixing cloze with other uiKind in same batch', () => {
    const svc = makeService();
    const parsed = [
      {
        stem: 's', totalMarks: 1, suggestedDifficulty: 2, questionType: 'short_answer' as const,
        uiKind: 'cloze' as const,
        passage: 'one [BLANK] two [BLANK]',
      },
      { stem: 's', totalMarks: 1, suggestedDifficulty: 2, questionType: 'mcq' as const, uiKind: 'multiple_choice' as const },
    ];
    expect(() => svc.validateEnglishContract('1123', parsed as any)).toThrow(
      /every question in the batch must be uiKind=cloze/,
    );
  });

  it('cloze rejects nested [[BLANK markers', () => {
    const svc = makeService();
    const parsed = [
      {
        stem: 's', totalMarks: 1, suggestedDifficulty: 2, questionType: 'short_answer' as const,
        uiKind: 'cloze' as const,
        passage: 'a [[BLANK]wrong[BLANK]] b',
      },
    ];
    expect(() => svc.validateEnglishContract('1123', parsed as any)).toThrow(
      /nested \[BLANK\] markers/,
    );
  });

  it('cloze case-insensitive [BLANK] match', () => {
    const svc = makeService();
    const parsed = [
      {
        stem: 's', totalMarks: 1, suggestedDifficulty: 2, questionType: 'short_answer' as const,
        uiKind: 'cloze' as const,
        passage: 'one [blank] two [BLANK] three [Blank]',
      },
      { stem: 's', totalMarks: 1, suggestedDifficulty: 2, questionType: 'short_answer' as const, uiKind: 'cloze' as const },
      { stem: 's', totalMarks: 1, suggestedDifficulty: 2, questionType: 'short_answer' as const, uiKind: 'cloze' as const },
    ];
    expect(() => svc.validateEnglishContract('1123', parsed as any)).not.toThrow();
  });

  it('parseResponse extracts passage when present', () => {
    const svc = makeService();
    const text = JSON.stringify([
      {
        stem: 'Blank 1:',
        totalMarks: 1,
        suggestedDifficulty: 2,
        questionType: 'short_answer',
        uiKind: 'cloze',
        passage: 'a [BLANK] b [BLANK]',
      },
    ]);
    const parsed = (svc as any).parseResponse(text);
    expect(parsed[0].passage).toBe('a [BLANK] b [BLANK]');
    expect(parsed[0].uiKind).toBe('cloze');
  });
});

describe('AiQuestionGeneratorService — prompt schema documents new fields', () => {
  it('LAYER_OUTPUT mentions uiKind and cloze contract', () => {
    const svc = makeService();
    const out = (svc as any).LAYER_OUTPUT as string;
    expect(out).toContain('uiKind');
    expect(out).toContain('multiple_choice');
    expect(out).toContain('cloze');
    expect(out).toContain('[BLANK]');
    expect(out).toContain('REQUIRED for English');
    expect(out).toContain('Cloze paper contract');
  });
});
