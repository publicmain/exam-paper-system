import { describe, it, expect } from 'vitest';
import { autoGradeScripts } from './student.service';

/**
 * R15-followup-14 — regression coverage for the MCQ grader fallback chain.
 *
 * Previously the grader only consulted `snapshotOptions.find(o => o.correct)`.
 * Cambridge IELTS classification + matching_information papers store the
 * canonical key on `snapshotContent.correctOption` / `correctAnswer` (the
 * options array is a SHARED bank across N questions, so no per-row
 * correct flag exists). That gap caused the 2026-05-14 morning quiz to
 * grade every Q23-Q26 classification answer to 0 even when students
 * picked the right letter — historyDetail had its own fallback chain so
 * the UI still showed "✓ 正确" and students complained the system was
 * lying. These tests pin the grader to the same fallback chain so they
 * never diverge again.
 */
describe('autoGradeScripts MCQ fallback chain (R15-followup-14)', () => {
  function script(over: Partial<any> = {}) {
    return {
      id: 's-1',
      selectedOption: 'C',
      textAnswer: null,
      paperQuestion: {
        marks: 1,
        snapshotOptions: null as any,
        snapshotContent: {} as any,
        question: {
          questionType: 'mcq',
          options: null as any,
          answerContent: null as any,
        },
        ...over.paperQuestion,
      },
      ...over,
    };
  }

  it('grades CORRECT via snapshotOptions[].correct (legacy IELTS Y/N/NG path)', async () => {
    const { autoScore, scriptUpdates } = await autoGradeScripts([
      script({
        paperQuestion: {
          marks: 1,
          snapshotOptions: [
            { key: 'A', text: 'YES', correct: false },
            { key: 'B', text: 'NO', correct: true },
            { key: 'C', text: 'NOT GIVEN', correct: false },
          ],
          snapshotContent: {},
          question: { questionType: 'mcq', options: null, answerContent: null },
        },
        selectedOption: 'B',
      }),
    ]);
    expect(autoScore).toBe(1);
    expect(scriptUpdates[0].autoCorrect).toBe(true);
    expect(scriptUpdates[0].awardedMarks).toBe(1);
  });

  it('grades CORRECT via snapshotContent.correctOption (Cambridge classification path) — was the 5/14 bug', async () => {
    // Shared-bank classification: options carry no per-row correct flag.
    // The canonical key lives on snapshotContent.correctOption instead.
    const sharedBank = [
      { key: 'A', text: 'Medieval Warm Period' },
      { key: 'B', text: 'Little Ice Age' },
      { key: 'C', text: 'Modern Warm Period' },
    ];
    const { autoScore, scriptUpdates } = await autoGradeScripts([
      script({
        paperQuestion: {
          marks: 1,
          snapshotOptions: sharedBank,
          snapshotContent: { correctOption: 'C' },
          question: { questionType: 'mcq', options: null, answerContent: null },
        },
        selectedOption: 'C',
      }),
    ]);
    expect(scriptUpdates[0].autoCorrect).toBe(true);
    expect(autoScore).toBe(1);
  });

  it('grades CORRECT via snapshotContent.correctAnswer (alias path)', async () => {
    const { scriptUpdates } = await autoGradeScripts([
      script({
        paperQuestion: {
          marks: 1,
          snapshotOptions: [{ key: 'A', text: 'a' }, { key: 'B', text: 'b' }, { key: 'C', text: 'c' }],
          snapshotContent: { correctAnswer: 'B' },
          question: { questionType: 'mcq', options: null, answerContent: null },
        },
        selectedOption: 'B',
      }),
    ]);
    expect(scriptUpdates[0].autoCorrect).toBe(true);
  });

  it('grades CORRECT via Question.answerContent.text (legacy 1-letter ingest path)', async () => {
    const { scriptUpdates } = await autoGradeScripts([
      script({
        paperQuestion: {
          marks: 1,
          snapshotOptions: [{ key: 'A', text: 'a' }, { key: 'B', text: 'b' }, { key: 'C', text: 'c' }],
          snapshotContent: {},
          question: { questionType: 'mcq', options: null, answerContent: { text: 'A' } },
        },
        selectedOption: 'A',
      }),
    ]);
    expect(scriptUpdates[0].autoCorrect).toBe(true);
  });

  it('grades WRONG when student selects a different option from canonical correctOption', async () => {
    const { scriptUpdates } = await autoGradeScripts([
      script({
        paperQuestion: {
          marks: 1,
          snapshotOptions: [{ key: 'A', text: 'a' }, { key: 'B', text: 'b' }, { key: 'C', text: 'c' }],
          snapshotContent: { correctOption: 'C' },
          question: { questionType: 'mcq', options: null, answerContent: null },
        },
        selectedOption: 'A',
      }),
    ]);
    expect(scriptUpdates[0].autoCorrect).toBe(false);
    expect(scriptUpdates[0].awardedMarks).toBe(0);
  });

  it('honors acceptedKeys[] even when correctOption is also present (either-order pair)', async () => {
    // Q33 of IELTS Authentic — accepts either 'A' or 'B' (or both) due to
    // mark scheme tagging "Q33 & Q34 in either order". acceptedKeys takes
    // priority over correctOption so the pair grades right even when the
    // student swapped them.
    const { scriptUpdates } = await autoGradeScripts([
      script({
        paperQuestion: {
          marks: 1,
          snapshotOptions: [{ key: 'A', text: 'a' }, { key: 'B', text: 'b' }, { key: 'C', text: 'c' }],
          snapshotContent: { correctOption: 'A', acceptedKeys: ['A', 'B'] },
          question: { questionType: 'mcq', options: null, answerContent: null },
        },
        selectedOption: 'B',
      }),
    ]);
    expect(scriptUpdates[0].autoCorrect).toBe(true);
  });

  it('returns autoCorrect=false when no correct key found anywhere (data-corruption defense)', async () => {
    const { scriptUpdates } = await autoGradeScripts([
      script({
        paperQuestion: {
          marks: 1,
          snapshotOptions: [{ key: 'A', text: 'a' }, { key: 'B', text: 'b' }],
          snapshotContent: {},
          question: { questionType: 'mcq', options: null, answerContent: null },
        },
        selectedOption: 'A',
      }),
    ]);
    expect(scriptUpdates[0].autoCorrect).toBe(false);
    expect(scriptUpdates[0].awardedMarks).toBe(0);
  });

  // R15-followup-14b — Cambridge classification stems say "Write the correct
  // letter, A, B or C." so the take page renders a TEXT INPUT, not radio
  // buttons. Student types 'C' → stored as textAnswer='C' with
  // selectedOption=null. The grader used to look only at selectedOption and
  // gave 0; the historyDetail UI fell back to textAnswer for display and
  // showed "我的答案 ✓ 正确" — a visible inconsistency 李淳 (5/14) caught.
  it('grades CORRECT when the student typed the letter into textAnswer (Cambridge "Write the letter" path)', async () => {
    const { autoScore, scriptUpdates } = await autoGradeScripts([
      script({
        paperQuestion: {
          marks: 1,
          snapshotOptions: [
            { key: 'A', text: 'Medieval Warm Period', correct: false },
            { key: 'B', text: 'Little Ice Age', correct: false },
            { key: 'C', text: 'Modern Warm Period', correct: true },
          ],
          snapshotContent: {},
          question: { questionType: 'mcq', options: null, answerContent: null },
        },
        selectedOption: null,
        textAnswer: 'C',
      }),
    ]);
    expect(scriptUpdates[0].autoCorrect).toBe(true);
    expect(autoScore).toBe(1);
  });

  it('case-insensitive textAnswer fallback ("c" still grades correctly)', async () => {
    const { scriptUpdates } = await autoGradeScripts([
      script({
        paperQuestion: {
          marks: 1,
          snapshotOptions: [
            { key: 'A', text: 'a', correct: false },
            { key: 'B', text: 'b', correct: true },
            { key: 'C', text: 'c', correct: false },
          ],
          snapshotContent: {},
          question: { questionType: 'mcq', options: null, answerContent: null },
        },
        selectedOption: null,
        textAnswer: 'b',
      }),
    ]);
    expect(scriptUpdates[0].autoCorrect).toBe(true);
  });

  it('textAnswer fallback ignores noise (long string, NOT a single letter)', async () => {
    const { scriptUpdates } = await autoGradeScripts([
      script({
        paperQuestion: {
          marks: 1,
          snapshotOptions: [
            { key: 'A', text: 'a', correct: false },
            { key: 'B', text: 'b', correct: true },
          ],
          snapshotContent: {},
          question: { questionType: 'mcq', options: null, answerContent: null },
        },
        selectedOption: null,
        textAnswer: 'this is a sentence that happens to start with B',
      }),
    ]);
    // Length > 4 → not treated as a letter pick.
    expect(scriptUpdates[0].autoCorrect).toBe(false);
  });

  it('ignores a too-long correctOption (defensive cap so a full passage in the field cannot mis-grade)', async () => {
    const veryLong = 'A'.repeat(50);
    const { scriptUpdates } = await autoGradeScripts([
      script({
        paperQuestion: {
          marks: 1,
          snapshotOptions: [{ key: 'A', text: 'a' }],
          snapshotContent: { correctOption: veryLong },
          question: { questionType: 'mcq', options: null, answerContent: null },
        },
        selectedOption: veryLong,
      }),
    ]);
    // Skipped — no key resolved, grade is wrong (defensive default).
    expect(scriptUpdates[0].autoCorrect).toBe(false);
  });
});

/**
 * R15-followup-20 — batched short-answer grading + deferAi.
 *
 * Pins: (a) all of a submission's AI-needed short answers go through ONE
 * evaluateBatch call, not one per item; (b) deferAi parks them pending
 * without any AI call (the morning-quiz finalSubmit path); (c) a failed
 * or incomplete batch never silently grades 0 — it parks pending so the
 * marker queue / regrade picks it up.
 */
describe('autoGradeScripts — batched short-answer grading (R15-followup-20)', () => {
  function saScript(id: string, textAnswer: string | null, markScheme: string, over: any = {}) {
    return {
      id,
      selectedOption: null,
      textAnswer,
      paperQuestion: {
        marks: 2,
        snapshotOptions: null,
        snapshotContent: {},
        question: {
          questionType: 'short_answer',
          options: null,
          answerContent: { text: markScheme },
          content: { stem: `stem ${id}`, passage: 'Shared reading passage.' },
        },
        ...over,
      },
    };
  }

  it('routes every AI-needed short answer through ONE evaluateBatch call', async () => {
    const calls: any[] = [];
    const grader = {
      async evaluateBatch(input: any) {
        calls.push(input);
        return new Map(input.items.map((it: any) => [it.id, { awardedMarks: 2, reasoning: 'ok', confident: true }]));
      },
    };
    const { autoScore, scriptUpdates } = await autoGradeScripts(
      [
        saScript('a', 'a long paraphrased answer', 'the canonical long mark scheme prose answer here'),
        saScript('b', 'another long answer', 'a different long canonical mark scheme answer text'),
        saScript('c', 'third long answer', 'yet another long canonical mark scheme answer text'),
      ],
      grader as any,
    );
    // One batched call carrying all three items — not three calls.
    expect(calls).toHaveLength(1);
    expect(calls[0].items).toHaveLength(3);
    expect(calls[0].passage).toBe('Shared reading passage.');
    expect(autoScore).toBe(6);
    expect(scriptUpdates.every((u) => u.autoCorrect === true)).toBe(true);
  });

  it('deferAi parks short answers pending WITHOUT calling the grader', async () => {
    let called = false;
    const grader = {
      async evaluateBatch() {
        called = true;
        return null;
      },
    };
    const { autoScore, scriptUpdates } = await autoGradeScripts(
      [saScript('a', 'some long student answer', 'a long canonical mark scheme prose answer')],
      grader as any,
      { deferAi: true },
    );
    expect(called).toBe(false);
    expect(autoScore).toBe(0);
    expect(scriptUpdates[0].autoCorrect).toBeNull();
    expect(scriptUpdates[0].awardedMarks).toBeNull();
    expect(scriptUpdates[0].aiReason).toContain('ai-pending');
  });

  it('a failed batch (evaluateBatch → null) parks pending, never grades 0', async () => {
    const grader = { async evaluateBatch() { return null; } };
    const { autoScore, scriptUpdates } = await autoGradeScripts(
      [saScript('a', 'some long student answer', 'a long canonical mark scheme prose answer')],
      grader as any,
    );
    expect(autoScore).toBe(0);
    expect(scriptUpdates[0].autoCorrect).toBeNull();
    expect(scriptUpdates[0].awardedMarks).toBeNull();
    expect(scriptUpdates[0].aiReason).toContain('AI-ERROR');
  });

  it('an id missing from the batch result is parked pending (no-verdict)', async () => {
    const grader = {
      async evaluateBatch(input: any) {
        // Return a verdict for the first item only — drop the second.
        return new Map([[input.items[0].id, { awardedMarks: 2, reasoning: 'ok', confident: true }]]);
      },
    };
    const { scriptUpdates } = await autoGradeScripts(
      [
        saScript('a', 'first long answer', 'a long canonical mark scheme answer one'),
        saScript('b', 'second long answer', 'a long canonical mark scheme answer two'),
      ],
      grader as any,
    );
    const byId = Object.fromEntries(scriptUpdates.map((u) => [u.id, u]));
    expect(byId['a'].autoCorrect).toBe(true);
    expect(byId['b'].autoCorrect).toBeNull();
    expect(byId['b'].aiReason).toContain('AI-NO-VERDICT');
  });

  it('MCQ is still graded inline even when deferAi parks short answers', async () => {
    const grader = { async evaluateBatch() { return null; } };
    const { autoScore, scriptUpdates } = await autoGradeScripts(
      [
        {
          id: 'mcq1',
          selectedOption: 'B',
          textAnswer: null,
          paperQuestion: {
            marks: 1,
            snapshotOptions: [
              { key: 'A', text: 'x', correct: false },
              { key: 'B', text: 'y', correct: true },
            ],
            snapshotContent: {},
            question: { questionType: 'mcq', options: null, answerContent: null },
          },
        },
        saScript('sa1', 'a long answer needing AI', 'a long canonical mark scheme answer'),
      ],
      grader as any,
      { deferAi: true },
    );
    // MCQ scored now (1), short answer deferred (0 for now).
    expect(autoScore).toBe(1);
    const byId = Object.fromEntries(scriptUpdates.map((u) => [u.id, u]));
    expect(byId['mcq1'].autoCorrect).toBe(true);
    expect(byId['sa1'].autoCorrect).toBeNull();
  });
});
