import { describe, it, expect } from 'vitest';
import { pickRenderer } from '../QuestionTypeRegistry';
import type { ExamPaper } from '../types';
import { IELTSReadingPassage } from '../questions/IELTSReadingPassage';
import { OLevelComprehension } from '../questions/OLevelComprehension';
import { OLevelCloze } from '../questions/OLevelCloze';
import { OLevelVocabInContext } from '../questions/OLevelVocabInContext';
import { OLevelSentenceTransformation } from '../questions/OLevelSentenceTransformation';
import { OLevelMcqList } from '../questions/OLevelMcqList';

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

  it('does not crash on empty paper', () => {
    expect(pickRenderer(paper({ questions: [] }))).toBe(OLevelMcqList);
  });
});
