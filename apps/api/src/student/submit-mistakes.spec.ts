import { describe, expect, it, vi } from 'vitest';
import { StudentService } from './student.service';

function fixture(claimCount = 1) {
  const question = { id: 'pq', marks: 1, snapshotContent: { stem: 'Choose one.', passage: 'Original passage', passageTitle: 'Original title' },
    overrideContent: null, overrideAnswer: null, snapshotAnswer: { text: 'B' }, snapshotOptions: [{ key: 'A', text: 'First' }, { key: 'B', text: 'Second', correct: true }],
    question: { questionType: 'mcq', answerContent: { text: 'B' }, options: [], content: {} } };
  const sub: any = { id: 'sub', studentId: 's', status: 'in_progress', finalSubmittedAt: null, maxScore: 1,
    assignment: { paperId: 'paper', paper: { totalMarksActual: 1 }, morningQuizSession: { date: new Date('2026-11-04') } },
    scripts: [{ id: 'script', paperQuestionId: 'pq', selectedOption: 'A', textAnswer: null, awardedMarks: null, markerComment: null, paperQuestion: question }] };
  const tx: any = {
    studentSubmission: {
      updateMany: vi.fn(async ({ data }: any) => { if (claimCount) Object.assign(sub, data); return { count: claimCount }; }),
      findUnique: vi.fn(async () => sub),
    },
    answerScript: { update: vi.fn(async ({ data }: any) => Object.assign(sub.scripts[0], data)) },
    mistakeEntry: { createMany: vi.fn(async () => ({ count: 1 })) },
  };
  const db: any = { studentSubmission: { findUnique: vi.fn(async () => sub) }, paperQuestion: { findMany: vi.fn(async () => [question]) },
    questionRetraction: { findMany: vi.fn(async () => []) }, $transaction: vi.fn(async (fn: any) => fn(tx)) };
  return { service: new StudentService(db), db, tx, sub };
}

describe('formal reading submit collects mistakes in its own transaction', () => {
  it('collects objective mistakes immediately with original session date and full frozen question', async () => {
    const f = fixture();
    await f.service.finalSubmit('sub', { id: 's', role: 'student', ip: null }, { final: true, deferAi: true });
    expect(f.tx.answerScript.update).toHaveBeenCalled();
    expect(f.tx.mistakeEntry.createMany).toHaveBeenCalledWith(expect.objectContaining({ skipDuplicates: true,
      data: [expect.objectContaining({ quizDay: '2026-11-04', studentAnswer: 'A', correctAnswer: 'B',
        redoSnapshot: expect.objectContaining({ stem: 'Choose one.', passage: 'Original passage', passageTitle: 'Original title', options: f.sub.scripts[0].paperQuestion.snapshotOptions, answer: { text: 'B' } }) })] }));
    expect(f.db.$transaction).toHaveBeenCalledTimes(1);
  });
  it('provisional submit never creates a notebook entry exposing answers', async () => {
    const f = fixture();
    await f.service.finalSubmit('sub', { id: 's', role: 'student', ip: null }, { final: false, deferAi: true });
    expect(f.tx.mistakeEntry.createMany).not.toHaveBeenCalled();
  });
  it('losing a concurrent submission claim creates neither grades nor mistakes', async () => {
    const f = fixture(0);
    await expect(f.service.finalSubmit('sub', { id: 's', role: 'student', ip: null }, { final: true, deferAi: true })).rejects.toThrow();
    expect(f.tx.answerScript.update).not.toHaveBeenCalled();
    expect(f.tx.mistakeEntry.createMany).not.toHaveBeenCalled();
  });
});
