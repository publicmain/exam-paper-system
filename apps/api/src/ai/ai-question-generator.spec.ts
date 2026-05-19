import { describe, it, expect } from 'vitest';
import { AiQuestionGeneratorService } from './ai-question-generator.service';

/**
 * Pure-function tests for parseResponse + validateEnglishContract.
 * No Prisma / no Anthropic SDK calls — the service is constructed with
 * a null prisma + null audit and the parse/validate methods run offline.
 */

function makeService(): AiQuestionGeneratorService {
  // All deps unused by the methods under test.
  return new AiQuestionGeneratorService(null as any, null as any, null as any);
}

describe('AiQuestionGeneratorService — repairJsonish (R15-followup-15b)', () => {
  const svc = makeService();
  const repair = (s: string) => (svc as any).repairJsonish(s) as string;

  it('escapes a single backslash from raw LaTeX so JSON.parse succeeds', () => {
    // What Claude actually emits when it gets sloppy: "stem": "compute $\sqrt{2}$"
    // with a single backslash. `\s` is NOT a legal JSON string escape, so
    // JSON.parse rejects it at the first occurrence.
    const broken = '[{"stem":"compute $\\sqrt{2}$ at x=1"}]';
    expect(() => JSON.parse(broken)).toThrow(); // baseline: parser rejects
    const repaired = repair(broken);
    const parsed = JSON.parse(repaired);
    expect(parsed[0].stem).toContain('\\sqrt');
  });

  it('escapes raw newlines inside a string value', () => {
    const broken = '[{"stem":"line one\nline two"}]';
    expect(() => JSON.parse(broken)).toThrow();
    const parsed = JSON.parse(repair(broken));
    expect(parsed[0].stem).toBe('line one\nline two');
  });

  it('drops trailing comma before closing brace', () => {
    const broken = '[{"stem":"foo", "marks": 3,}]';
    expect(() => JSON.parse(broken)).toThrow();
    const parsed = JSON.parse(repair(broken));
    expect(parsed[0].marks).toBe(3);
  });

  it('leaves valid JSON untouched modulo identity-equivalence', () => {
    const good = '[{"stem":"f","marks":3,"esc":"\\\\n"}]';
    expect(JSON.parse(repair(good))).toEqual(JSON.parse(good));
  });
});

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

describe('AiQuestionGeneratorService — F5 weeklyFocus injection', () => {
  it('buildPrompt includes weeklyFocus when supplied', () => {
    const svc = makeService();
    const { userText } = (svc as any).buildPrompt({
      syllabus: '1123',
      topicCode: 'EL.1',
      topicName: 'English Grammar',
      componentCode: null,
      count: 4,
      multiPart: false,
      fewShot: [],
      weeklyFocus: '本周重点 matching headings + collocation',
    });
    expect(userText).toContain('matching headings');
    expect(userText).toContain('Bias questions to exercise the focus areas');
    expect(userText).toContain("Teacher's weekly focus");
  });

  it('buildPrompt omits weeklyFocus block when null/empty', () => {
    const svc = makeService();
    const { userText } = (svc as any).buildPrompt({
      syllabus: '1123',
      topicCode: 'EL.1',
      topicName: 'English Grammar',
      componentCode: null,
      count: 4,
      multiPart: false,
      fewShot: [],
      weeklyFocus: null,
    });
    expect(userText).not.toContain("Teacher's weekly focus");
  });

  it('buildPrompt caps weeklyFocus at 600 chars', () => {
    const svc = makeService();
    const huge = 'a'.repeat(2000);
    const { userText } = (svc as any).buildPrompt({
      syllabus: '1123',
      topicCode: 'EL.1',
      topicName: 'English Grammar',
      componentCode: null,
      count: 4,
      multiPart: false,
      fewShot: [],
      weeklyFocus: huge,
    });
    // The 'a'-block in the prompt is the only one with that pattern; count
    // its length and ensure ≤ 600.
    const m = userText.match(/a{600,}/);
    if (m) expect(m[0].length).toBe(600);
  });
});
