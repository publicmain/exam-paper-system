import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { dateOnly, isTeachingDay } from '../common/school-calendar';
import { gradedVocabularyEvidence } from '../vocab-v2/mastery';
import { MistakeService, nextPracticeState } from './mistake.service';
import { freezeRedo, gradeRedo, nextTeachingDate, readingRedoState, redoSourceKey } from './reading-redo';
import { MISTAKES_FEATURE } from '../lesson/pilot-flags';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const date = '2026-11-09';
const now = new Date(`${date}T09:00:00+08:00`);
const mcq = () => freezeRedo({ stem: 'Choose one.', passage: 'Original passage.', passageTitle: 'Original title', taskType: 'multiple_choice' },
  [{ key: 'A', text: 'First', correct: false }, { key: 'B', text: 'Second', correct: true }], { text: 'B' }, 'mcq');
const entry = (id = 'm1', extra: Record<string, unknown> = {}) => ({ id, studentId: 's', submissionId: 'sub', paperQuestionId: `pq-${id}`,
  taskType: 'multiple_choice', passageTitle: 'Original title', stem: 'Choose one.', studentAnswer: 'A', correctAnswer: 'B', markerComment: '', maxMarks: 1,
  awarded: 0, reason: 'repeated_tasktype', quizDay: '2026-11-06', createdAt: new Date('2026-11-06T02:00:00Z'), redoSnapshot: mcq(),
  practiceCount: 0, correctStreak: 0, lastPracticedAt: null, resolved: false, resolvedAt: null, ...extra });

function fixture(rows: any[] = [entry()], closed: string[] = []) {
  const evidence: any[] = [];
  let lock: Promise<void> = Promise.resolve();
  const completion: any = {};
  const db: any = {
    classEnrollment: { findMany: vi.fn(async () => [{ userId: 's', classId: 'c', joinedAt: new Date('2026-01-01') }]) },
    classNoSchoolDay: { findMany: vi.fn(async () => closed.map((day) => ({ classId: 'c', date: dateOnly(day) }))) },
    studentSubmission: { findFirst: vi.fn(async () => ({ id: 'today-sub' })), findUnique: vi.fn() },
    paperQuestion: { findMany: vi.fn(() => { throw new Error('Must never read a live paper for redo'); }) },
    mistakeEntry: {
      findFirst: vi.fn(async ({ where }: any) => rows.find((r) => r.id === where.id && r.studentId === where.studentId) ?? null),
      findMany: vi.fn(async ({ where }: any) => rows.filter((r) => r.studentId === where.studentId
        && (!where.createdAt || r.createdAt < where.createdAt.lt)
        && (where.resolved === undefined || r.resolved === where.resolved)
        && (!where.OR || !r.resolved || r.resolvedAt >= where.OR[1].resolvedAt.gte))
        .sort((a, b) => a.createdAt - b.createdAt || a.id.localeCompare(b.id))),
      createMany: vi.fn(async ({ data }: any) => {
        let count = 0;
        for (const row of data) if (!rows.some((r) => r.submissionId === row.submissionId && r.paperQuestionId === row.paperQuestionId)) { rows.push({ ...entry(`new-${rows.length}`), ...row }); count++; }
        return { count };
      }),
      update: vi.fn(async ({ where, data }: any) => { const row = rows.find((r) => r.id === where.id); const { practiceCount, ...rest } = data; Object.assign(row, rest); row.practiceCount += practiceCount.increment; return row; }),
    },
    learningEvidence: {
      findUnique: vi.fn(async ({ where }: any) => evidence.find((e) => e.sourceKey === where.sourceKey) ?? null),
      findMany: vi.fn(async ({ where }: any) => evidence.filter((e) => e.studentId === where.studentId && e.subject === where.subject
        && (!where.sourceKey || where.sourceKey.in.includes(e.sourceKey)))),
      createMany: vi.fn(async ({ data }: any) => { let count = 0; for (const e of data) if (!evidence.some((r) => r.sourceKey === e.sourceKey)) { evidence.push(e); count++; } return { count }; }),
    },
    dailyLessonCompletion: { updateMany: vi.fn(async ({ data }: any) => { Object.assign(completion, data); return { count: 1 }; }) },
    vocabularySense: { findMany: vi.fn(async () => [{ id: 'word', translation: '示例', lexeme: { headword: 'example' } }]) },
  };
  db.$transaction = async (fn: any) => {
    let release: (() => void) | undefined;
    const tx = { ...db, $queryRaw: vi.fn(async () => { const prior = lock; lock = new Promise<void>((r) => { release = r; }); await prior; return []; }) };
    try { return await fn(tx); } finally { release?.(); }
  };
  return { svc: new MistakeService(db), db, rows, evidence, completion };
}
beforeEach(() => { vi.useFakeTimers(); vi.setSystemTime(now); });
afterEach(() => vi.useRealTimers());

describe('frozen collection', () => {
  it('collects a first objective error and partial subjective answer, skips full/blank/pending; replay preserves the snapshot', async () => {
    const f = fixture([]);
    const script = (id: string, answer: string, awarded: number | null, type = 'mcq', marks = 1) => ({ paperQuestionId: id, selectedOption: type === 'mcq' ? answer : null, textAnswer: answer, awardedMarks: awarded,
      markerComment: 'Try again.', paperQuestion: { marks, snapshotContent: { stem: 'Frozen stem', passage: 'Frozen passage', passageTitle: 'Frozen title' }, snapshotOptions: mcq().options,
        snapshotAnswer: { text: 'B' }, overrideContent: null, overrideAnswer: null, question: { questionType: type } } });
    const sub = { id: 'sub', studentId: 's', finalSubmittedAt: now, scripts: [script('wrong', 'A', 0), script('partial', 'some writing', 1, 'structured', 2), script('blank', ' ', 0), script('full', 'B', 1), script('pending', 'writing', null)] };
    f.db.studentSubmission.findUnique.mockResolvedValue(sub);
    expect(await f.svc.collectFromSubmission('sub', '2026-11-06')).toEqual({ added: 2 });
    expect(f.rows[0].redoSnapshot).toMatchObject({ stem: 'Frozen stem', passage: 'Frozen passage', options: mcq().options, answer: { text: 'B' } });
    sub.scripts[0].paperQuestion.snapshotContent.stem = 'Edited later';
    expect(await f.svc.collectFromSubmission('sub', '2026-11-06')).toEqual({ added: 0 });
    expect(f.rows[0].redoSnapshot.stem).toBe('Frozen stem');
  });
  it('does not collect a provisional submission or expose its answers', async () => {
    const f = fixture([]); f.db.studentSubmission.findUnique.mockResolvedValue({ finalSubmittedAt: null });
    expect(await f.svc.collectFromSubmission('sub', date)).toEqual({ added: 0 });
    expect(f.db.mistakeEntry.createMany).not.toHaveBeenCalled();
  });
});

describe('teaching days and stable daily cap', () => {
  it('Friday + weekend + Monday closure => Tuesday; multiple closures are skipped', () => {
    expect(nextTeachingDate('2026-11-06', (d) => isTeachingDay(d, ['2026-11-09', '2026-11-10'].includes(d)))).toBe('2026-11-11');
  });
  it.each(['2026-11-07', '2026-11-08', '2026-11-09'])('no assignment on %s (weekend or closure)', async (d) => {
    const f = fixture([entry()], ['2026-11-09']);
    const state = await readingRedoState(f.db, 's', new Date(`${d}T10:00:00+08:00`));
    expect(state.target).toBe(0);
  });
  it('oldest due first, at most three; legacy/missing ids/today collection excluded; resolved today stays', async () => {
    const f = fixture([entry('m4'), entry('m3'), entry('m2'), entry('m1'), entry('legacy', { redoSnapshot: null }), entry('gone', { paperQuestionId: null }), entry('today', { createdAt: now })]);
    let state = await f.svc.dailyState('s');
    expect(state.entries.map((e) => e.id)).toEqual(['m1', 'm2', 'm3']);
    f.rows.find((e) => e.id === 'm1').resolved = true;
    f.rows.find((e) => e.id === 'm1').resolvedAt = now;
    f.evidence.push({ studentId: 's', subject: 'reading_question', kind: 'mistake_redo', sourceKey: redoSourceKey('s', 'm1', date) });
    state = await f.svc.dailyState('s');
    expect(state.target).toBe(3); expect(state.progress).toBe(1);
    expect(state.entries.map((e) => e.id)).toEqual(['m1', 'm2', 'm3']);
  });
  it('queue withholds correct answers/options flags and is locked before today reading is submitted', async () => {
    const f = fixture();
    const queue = await f.svc.practiceQueue('s');
    expect(JSON.stringify(queue)).not.toMatch(/correctAnswer|"correct"|gradingContent|answerPoints/);
    f.db.studentSubmission.findFirst.mockResolvedValue(null);
    expect(await f.svc.practiceQueue('s')).toMatchObject({ unlocked: false, target: 1, items: [] });
    expect(f.db.paperQuestion.findMany).not.toHaveBeenCalled();
  });
});

describe('grading, resolution and evidence', () => {
  it('server grades frozen MCQ, not a client correctness claim; a later independent success clears in one try', async () => {
    const f = fixture();
    expect(await f.svc.practiceResult('s', 'm1', { date, answer: 'B' })).toMatchObject({ correct: true, resolved: true });
    expect(f.rows[0].practiceCount).toBe(1);
    expect(f.evidence[0]).toMatchObject({ kind: 'mistake_redo', subject: 'reading_question', paperQuestionId: 'pq-m1', isCorrect: true, detail: { selfChecked: false } });
    expect(f.completion).toMatchObject({ drillTarget: 1, drillProgress: 1, drillDoneAt: now });
    expect(f.db.paperQuestion.findMany).not.toHaveBeenCalled();
  });
  it('wrong still finishes today assignment but remains unresolved tomorrow', async () => {
    const f = fixture();
    expect(await f.svc.practiceResult('s', 'm1', { date, answer: 'A' })).toMatchObject({ correct: false, resolved: false });
    expect(f.completion.drillProgress).toBe(1);
    vi.setSystemTime(new Date('2026-11-10T01:00:00Z'));
    expect((await f.svc.practiceQueue('s')).items).toHaveLength(1);
  });
  it('same-day correction and hinted success do not resolve (SGT midnight boundary included)', async () => {
    const f = fixture([entry('m1', { createdAt: now })]);
    expect(await f.svc.practiceResult('s', 'm1', { date, answer: 'B' })).toMatchObject({ correct: true, resolved: false });
    const old = fixture();
    expect(await old.svc.practiceResult('s', 'm1', { date, answer: 'B', hinted: true })).toMatchObject({ resolved: false });
    expect(nextPracticeState({ createdAt: new Date('2026-11-08T16:00:00Z') }, true, now).resolved).toBe(false);
    expect(nextPracticeState({ createdAt: new Date('2026-11-08T15:59:59Z') }, true, now).resolved).toBe(true);
  });
  it('subjective comparison requires writing; self-check is marked, never counted as vocabulary mastery', async () => {
    const snapshot = freezeRedo({ stem: 'Explain why.', passage: 'Original.' }, [], { text: 'Because of the rain.' }, 'structured');
    const f = fixture([entry('m1', { redoSnapshot: snapshot })]);
    await expect(f.svc.referenceAnswer('s', 'm1', ' ', date)).rejects.toThrow();
    expect(await f.svc.referenceAnswer('s', 'm1', 'My answer.', date)).toMatchObject({ correctAnswer: 'Because of the rain.' });
    await f.svc.practiceResult('s', 'm1', { date, answer: 'My answer.', selfCorrect: true });
    expect(f.evidence[0].detail.selfChecked).toBe(true);
    expect(gradedVocabularyEvidence(f.evidence[0])).toBe(false);
  });
  it('objective self-check, blank, stale dates, legacy, other student and fourth due item are rejected', async () => {
    const f = fixture([entry('m1'), entry('m2'), entry('m3'), entry('m4'), entry('legacy', { redoSnapshot: null })]);
    for (const [student, id, input] of [
      ['s', 'm1', { date, answer: 'B', selfCorrect: true }], ['s', 'm1', { date, answer: ' ' }],
      ['s', 'm1', { date: '2026-11-08', answer: 'B' }], ['s', 'legacy', { date, answer: 'B' }],
      ['someone', 'm1', { date, answer: 'B' }], ['s', 'm4', { date, answer: 'B' }],
    ] as const) await expect(f.svc.practiceResult(student, id, input)).rejects.toThrow();
    await expect(f.svc.resolve('s', 'm1', true)).rejects.toThrow();
    expect(f.evidence).toHaveLength(0);
  });
  it('preserves accepted-key/typed-option grading semantics', () => {
    const snapshot = mcq(); snapshot.gradingContent.acceptedKeys = ['A', 'B'];
    expect(gradeRedo(snapshot, 'a')).toBe(true);
    expect(gradeRedo(mcq(), 'Second')).toBe(true);
    const tfng = freezeRedo({ taskType: 'true_false_not_given', stem: 'Statement', passage: 'Original' }, [], { text: 'A' }, 'short_answer');
    expect(gradeRedo(tfng, 'TRUE')).toBe(true);
    expect(freezeRedo({ taskType: 'sentence_completion' }, [], { text: 'rain' }, 'short_answer').objective).toBe(true);
  });
});

it('front and back feature gates both say available', () => {
  expect(MISTAKES_FEATURE).toBe('available');
  const frontend = readFileSync(resolve(__dirname, '../../../student-web/src/routes.contract.ts'), 'utf8');
  expect(frontend).toMatch(/export const MISTAKES_FEATURE[^\n]*= 'available'/);
});

describe('duplicate and concurrent submissions', () => {
  it('concurrent double submit and retry with a changed answer return the first committed result once', async () => {
    const f = fixture();
    const results = await Promise.all([f.svc.practiceResult('s', 'm1', { date, answer: 'A' }), f.svc.practiceResult('s', 'm1', { date, answer: 'B' })]);
    expect(results.every((r) => !r.correct)).toBe(true);
    expect(f.evidence).toHaveLength(1); expect(f.rows[0].practiceCount).toBe(1);
    vi.setSystemTime(new Date('2026-11-10T01:00:00Z'));
    expect(await f.svc.practiceResult('s', 'm1', { date, answer: 'B' })).toMatchObject({ correct: false });
    expect(f.evidence).toHaveLength(1);
  });
  it('three concurrent answers finish exactly the allocated three and never replace them with a fourth', async () => {
    const f = fixture([entry('m1'), entry('m2'), entry('m3'), entry('m4')]);
    await Promise.all(['m1', 'm2', 'm3'].map((id) => f.svc.practiceResult('s', id, { date, answer: 'B' })));
    expect(f.evidence).toHaveLength(3); expect(f.completion.drillProgress).toBe(3);
    expect(await f.svc.practiceQueue('s')).toMatchObject({ target: 3, progress: 3, items: [] });
  });
});

it('notebook preserves old rows without reading PaperQuestion and reuses the 2A unresolved word rule', async () => {
  const f = fixture([entry('legacy', { redoSnapshot: null })]);
  const wordEvidence = (key: string, correct: boolean, day: string, hinted = false) => ({ studentId: 's', senseId: 'word', subject: 'vocab_sense', kind: 'formal_first', isCorrect: correct, hinted, sourceKey: key, schoolDate: dateOnly(day), occurredAt: now });
  f.evidence.push(wordEvidence('wrong', false, '2026-11-06'), wordEvidence('same-day', true, '2026-11-06'));
  expect(await f.svc.listForStudent('s')).toMatchObject({ entries: [{ legacy: true, correctAnswer: 'B' }], vocabulary: [{ headword: 'example' }] });
  f.evidence.push(wordEvidence('later-hinted', true, date, true));
  expect((await f.svc.listForStudent('s')).vocabulary).toHaveLength(1);
  f.evidence.push(wordEvidence('later-independent', true, date));
  expect((await f.svc.listForStudent('s')).vocabulary).toHaveLength(0);
  expect(f.db.paperQuestion.findMany).not.toHaveBeenCalled();
});
