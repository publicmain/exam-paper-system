import { describe, it, expect } from 'vitest';
import { pickRenderer } from '../QuestionTypeRegistry';
import type { ExamPaper } from '../types';
import { IELTSReadingPassage } from '../questions/IELTSReadingPassage';
import { OLevelComprehension } from '../questions/OLevelComprehension';
import { OLevelCloze } from '../questions/OLevelCloze';
import { OLevelVocabInContext } from '../questions/OLevelVocabInContext';
import { OLevelSentenceTransformation } from '../questions/OLevelSentenceTransformation';
import { OLevelMcqList } from '../questions/OLevelMcqList';
import { EmptyPaperCard } from '../QuestionTypeRegistry';

function paper(over: Partial<ExamPaper>): ExamPaper {
  return {
    sessionId: 's1',
    quizEnd: new Date(Date.now() + 10 * 60_000).toISOString(),
    level: 'olevel',
    paperMode: null,
    questions: [],
    ...over,
  };
}

describe('pickRenderer', () => {
  it('routes passage_pick papers to IELTS', () => {
    const p = paper({
      paperMode: 'passage_pick',
      questions: [
        { id: '1', sortOrder: 1, marks: 1, questionType: 'mcq', snapshotContent: { stem: 'q' }, snapshotOptions: [] },
      ],
    });
    expect(pickRenderer(p)).toBe(IELTSReadingPassage);
  });

  it('routes IELTS taskType regardless of paperMode', () => {
    const p = paper({
      level: 'ielts_authentic',
      questions: [
        {
          id: '1', sortOrder: 1, marks: 1, questionType: 'mcq',
          snapshotContent: { taskType: 'true_false_not_given', stem: 'q' },
          snapshotOptions: [{ key: 'A', text: 'TRUE' }, { key: 'B', text: 'FALSE' }],
        },
      ],
    });
    expect(pickRenderer(p)).toBe(IELTSReadingPassage);
  });

  it('routes uiKind=cloze to OLevelCloze', () => {
    const p = paper({
      questions: [
        { id: '1', sortOrder: 1, marks: 1, questionType: 'short_answer', snapshotContent: { uiKind: 'cloze', passage: 'a [BLANK] b' }, snapshotOptions: null },
      ],
    });
    expect(pickRenderer(p)).toBe(OLevelCloze);
  });

  it('routes uiKind=vocab to OLevelVocabInContext', () => {
    const p = paper({
      questions: [
        { id: '1', sortOrder: 1, marks: 1, questionType: 'mcq', snapshotContent: { uiKind: 'vocab', stem: 'q', targetWord: 'frugal' }, snapshotOptions: [] },
      ],
    });
    expect(pickRenderer(p)).toBe(OLevelVocabInContext);
  });

  it('routes uiKind=transformation to OLevelSentenceTransformation', () => {
    const p = paper({
      questions: [
        { id: '1', sortOrder: 1, marks: 1, questionType: 'short_answer', snapshotContent: { uiKind: 'transformation', original: 'He is tall.' }, snapshotOptions: null },
      ],
    });
    expect(pickRenderer(p)).toBe(OLevelSentenceTransformation);
  });

  it('routes long-passage MCQs to OLevelComprehension', () => {
    const longPassage = 'A '.repeat(150);
    const p = paper({
      questions: [
        { id: '1', sortOrder: 1, marks: 1, questionType: 'mcq', snapshotContent: { passage: longPassage, stem: 'q' }, snapshotOptions: [] },
        { id: '2', sortOrder: 2, marks: 1, questionType: 'mcq', snapshotContent: { passage: longPassage, stem: 'q' }, snapshotOptions: [] },
      ],
    });
    expect(pickRenderer(p)).toBe(OLevelComprehension);
  });

  it('falls back to OLevelMcqList for plain MCQ', () => {
    const p = paper({
      questions: [
        { id: '1', sortOrder: 1, marks: 1, questionType: 'mcq', snapshotContent: { stem: 'q' }, snapshotOptions: [{ key: 'A', text: 'A' }] },
      ],
    });
    expect(pickRenderer(p)).toBe(OLevelMcqList);
  });

  // R15-followup-13 — OLEVEL Section-B comprehension papers (library_card,
  // ndp_orchid, senior_sister) carry a short "Refer to the same narrative
  // above…" backref pseudo-passage on the MCQ sub-section. That used to
  // trip uniquePassages.size > 1 → paged OLevelComprehension shell with
  // the section-intro preamble repeated inside every question card. The
  // backref filter strips it so single-real-passage papers route to the
  // IELTS shell, which groups by taskType + instruction and renders the
  // preamble once per group.
  it('treats a "Refer to the same narrative" pseudo-passage as a non-passage and routes to IELTS', () => {
    const realPassage = 'Hui Min took bus 168 to the Bedok library every Tuesday after school...'.repeat(8);
    const backref = 'Refer to the same narrative in Exercise 1 above. The narrator\'s feelings shift over two days.';
    const p = paper({
      questions: [
        // Q1-Q6 short_answer share the real passage
        { id: '1', sortOrder: 1, marks: 1, questionType: 'short_answer', snapshotContent: { taskType: 'short_answer', passage: realPassage, stem: 'Q1. ...' }, snapshotOptions: null },
        { id: '2', sortOrder: 2, marks: 1, questionType: 'short_answer', snapshotContent: { taskType: 'short_answer', passage: realPassage, stem: 'Q2. ...' }, snapshotOptions: null },
        // Q7-Q10 multi_match carry only the backref summary
        { id: '7', sortOrder: 7, marks: 1, questionType: 'mcq', snapshotContent: { taskType: 'multi_match', passage: backref, stem: 'Q7(i). ...' }, snapshotOptions: [{ key: 'A', text: 'worried' }] },
        { id: '8', sortOrder: 8, marks: 1, questionType: 'mcq', snapshotContent: { taskType: 'multi_match', passage: backref, stem: 'Q7(ii). ...' }, snapshotOptions: [{ key: 'A', text: 'worried' }] },
      ],
    });
    expect(pickRenderer(p)).toBe(IELTSReadingPassage);
  });

  it('still routes genuinely-multi-passage OLEVEL papers (Q1-7 + Q8-15) to paged OLevelComprehension', () => {
    const passageA = 'The Babylonians were the first civilisation to develop a number system.'.repeat(5);
    const passageB = 'The Industrial Revolution transformed European agriculture in profound ways.'.repeat(5);
    const p = paper({
      questions: [
        { id: '1', sortOrder: 1, marks: 1, questionType: 'mcq', snapshotContent: { taskType: 'short_answer', passage: passageA, stem: 'q1' }, snapshotOptions: [] },
        { id: '8', sortOrder: 8, marks: 1, questionType: 'mcq', snapshotContent: { taskType: 'short_answer', passage: passageB, stem: 'q8' }, snapshotOptions: [] },
      ],
    });
    expect(pickRenderer(p)).toBe(OLevelComprehension);
  });

  it('routes empty paper to EmptyPaperCard, not a question renderer (round-3 C3)', () => {
    expect(pickRenderer(paper({ questions: [] }))).toBe(EmptyPaperCard);
  });

  it('routes nullish/undefined questions to EmptyPaperCard without crashing', () => {
    // Defensive — pickRenderer must not throw if a future caller hands us
    // a half-loaded paper with `questions` missing.
    expect(pickRenderer({ ...paper({ questions: [] }), questions: undefined as any })).toBe(EmptyPaperCard);
    expect(pickRenderer(undefined as any)).toBe(EmptyPaperCard);
  });
});
