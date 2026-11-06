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
        && (typeof where.kind !== 'string' || e.kind === where.kind)
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
    const attempt = f.evidence.find((e) => e.kind === 'mistake_redo');
    expect(attempt.detail.selfChecked).toBe(true);
    expect(gradedVocabularyEvidence(attempt)).toBe(false);
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
  it('completion redo honours the frozen accept list (twelve litres / 12 litres)', () => {
    const s = freezeRedo({ taskType: 'sentence_completion', stem: 'The bottle model collected ______.', passage: 'P' }, [],
      { text: 'twelve litres', accept: ['twelve litres', '12 litres'] }, 'short_answer');
    expect(gradeRedo(s, '12 litres')).toBe(true);
    expect(gradeRedo(s, '  Twelve   Litres ')).toBe(true);
    expect(gradeRedo(s, '13 litres')).toBe(false);
    expect(gradeRedo(s, '')).toBe(false);
    const noAccept = freezeRedo({ taskType: 'sentence_completion', stem: 'x', passage: 'P' }, [], { text: 'rain' }, 'short_answer');
    expect(gradeRedo(noAccept, 'Rain')).toBe(true);
    expect(gradeRedo(noAccept, '')).toBe(false);
  });
});

describe('subjective first answer before reference', () => {
  const subjective = (extra: Record<string, unknown> = {}) => entry('m1', {
    redoSnapshot: freezeRedo({ stem: 'Explain why.', passage: 'Original.' }, [], { text: 'Because of the rain.' }, 'structured'), ...extra,
  });
  const refKey = (day = date) => `reading-redo-ref:s:m1:${day}`;

  it('freezes the normalized answer once, returns it on every reference, without recording completion or scheduling', async () => {
    const f = fixture([subjective()]);
    expect(await f.svc.referenceAnswer('s', 'm1', '  Ｍy\n answer.  ', date)).toMatchObject({ frozenAnswer: 'My answer.' });
    expect(await f.svc.referenceAnswer('s', 'm1', 'Because of the rain.', date)).toMatchObject({ frozenAnswer: 'My answer.' });
    expect(f.evidence).toHaveLength(1);
    expect(f.evidence[0]).toMatchObject({ sourceKey: refKey(), studentId: 's', kind: 'practice_first', subject: 'reading_question',
      paperQuestionId: 'pq-m1', isCorrect: null, schoolDate: dateOnly(date), detail: { mistakeId: 'm1', answer: 'My answer.' } });
    expect(f.rows[0]).toMatchObject({ practiceCount: 0, resolved: false });
    expect(f.db.dailyLessonCompletion.updateMany).not.toHaveBeenCalled();
    expect(await f.svc.dailyState('s')).toMatchObject({ target: 1, progress: 0 });
    expect(await f.svc.practiceQueue('s')).toMatchObject({ progress: 0, items: [{ id: 'm1', reference: { frozenAnswer: 'My answer.', correctAnswer: 'Because of the rain.' } }] });
  });

  it('two concurrent reference requests return the first committed answer, including on retry', async () => {
    const f = fixture([subjective()]);
    const responses = await Promise.all([
      f.svc.referenceAnswer('s', 'm1', 'First answer.', date), f.svc.referenceAnswer('s', 'm1', 'Second answer.', date),
    ]);
    expect(responses).toEqual([expect.objectContaining({ frozenAnswer: 'First answer.' }), expect.objectContaining({ frozenAnswer: 'First answer.' })]);
    expect(f.evidence).toHaveLength(1);
    expect(await f.svc.referenceAnswer('s', 'm1', 'Retry answer.', date)).toMatchObject({ frozenAnswer: 'First answer.' });
  });

  it.each([true, false])('reference and submission racing (reference first=%s) cannot clear a changed answer', async (referenceFirst) => {
    const f = fixture([subjective()]);
    const reference = () => f.svc.referenceAnswer('s', 'm1', 'Original answer.', date);
    const submit = () => f.svc.practiceResult('s', 'm1', { date, answer: 'Because of the rain.', selfCorrect: true, hinted: false });
    const operations = referenceFirst ? [reference(), submit()] : [submit(), reference()];
    const responses = await Promise.allSettled(operations);
    expect(f.rows[0].resolved).toBe(false);
    if (referenceFirst) expect(responses[1]).toMatchObject({ status: 'fulfilled', value: { resolved: false } });
    else expect(responses[0]).toMatchObject({ status: 'rejected', reason: { response: { code: 'reference_required' } } });
    expect(f.evidence.filter((e) => e.kind === 'practice_first')).toHaveLength(1);
  });

  it('a changed answer cannot resolve; duplicate and concurrent submits record one hinted attempt', async () => {
    const f = fixture([subjective()]);
    await f.svc.referenceAnswer('s', 'm1', 'My original answer.', date);
    const input = { date, answer: 'Because of the rain.', selfCorrect: true, hinted: false };
    const responses = await Promise.all([f.svc.practiceResult('s', 'm1', input), f.svc.practiceResult('s', 'm1', input)]);
    expect(responses.every((r) => !r.resolved)).toBe(true);
    expect(await f.svc.practiceResult('s', 'm1', { ...input, answer: 'My original answer.' })).toMatchObject({ resolved: false });
    expect(f.rows[0]).toMatchObject({ resolved: false, practiceCount: 1 });
    expect(f.evidence.filter((e) => e.kind === 'mistake_redo')).toEqual([expect.objectContaining({ hinted: true, detail: expect.objectContaining({ answer: input.answer }) })]);
    expect(await f.svc.dailyState('s')).toMatchObject({ progress: 1 });
  });

  it.each([true, false])('rejects self-check=%s without today reference and makes no writes', async (selfCorrect) => {
    const f = fixture([subjective()]);
    await expect(f.svc.practiceResult('s', 'm1', { date, answer: 'My answer.', selfCorrect })).rejects.toMatchObject({ response: { code: 'reference_required' } });
    expect(f.evidence).toHaveLength(0);
    expect(f.db.mistakeEntry.update).not.toHaveBeenCalled();
    expect(f.db.dailyLessonCompletion.updateMany).not.toHaveBeenCalled();
  });

  it('normalization permits whitespace and fullwidth equivalents; later-day unhinted self-check can resolve', async () => {
    const f = fixture([subjective()]);
    await f.svc.referenceAnswer('s', 'm1', 'Ｍy  answer.', date);
    expect(await f.svc.practiceResult('s', 'm1', { date, answer: ' My\nanswer. ', selfCorrect: true })).toMatchObject({ correct: true, resolved: true });
    expect(f.evidence.find((e) => e.kind === 'mistake_redo').hinted).toBe(false);
  });

  it('same-day subjective correction can compare and self-check but cannot resolve', async () => {
    const f = fixture([subjective({ createdAt: now })]);
    await f.svc.referenceAnswer('s', 'm1', 'My answer.', date);
    expect(await f.svc.practiceResult('s', 'm1', { date, answer: 'My answer.', selfCorrect: true })).toMatchObject({ resolved: false });
  });

  it.each([{ selfCorrect: true, hinted: true }, { selfCorrect: false, hinted: false }])('matching original still respects self-check and hints: %j', async (input) => {
    const f = fixture([subjective()]);
    await f.svc.referenceAnswer('s', 'm1', 'My answer.', date);
    expect(await f.svc.practiceResult('s', 'm1', { date, answer: 'My answer.', ...input })).toMatchObject({ correct: input.selfCorrect, resolved: false });
    expect(f.evidence.find((e) => e.kind === 'mistake_redo')).toMatchObject({ hinted: input.hinted });
  });

  it('a new Singapore date needs a new reference and freezes its own first answer', async () => {
    const f = fixture([subjective()]);
    await f.svc.referenceAnswer('s', 'm1', 'Yesterday.', date);
    const tomorrow = '2026-11-10'; vi.setSystemTime(new Date(`${tomorrow}T00:00:00+08:00`));
    expect(await f.svc.practiceQueue('s')).toMatchObject({ items: [expect.not.objectContaining({ reference: expect.anything() })] });
    await expect(f.svc.practiceResult('s', 'm1', { date: tomorrow, answer: 'Today.', selfCorrect: true })).rejects.toMatchObject({ response: { code: 'reference_required' } });
    expect(await f.svc.referenceAnswer('s', 'm1', 'Today.', tomorrow)).toMatchObject({ frozenAnswer: 'Today.' });
    expect(f.evidence.map((e) => e.sourceKey)).toEqual([refKey(), refKey(tomorrow)]);
  });

  it('reference rejects blank, other student, stale date, objective and unavailable questions without freezing', async () => {
    const f = fixture([subjective(), entry('m2'), entry('m3'), entry('m4')]);
    for (const [student, id, answer, day] of [
      ['s', 'm1', ' ', date], ['other', 'm1', 'My answer.', date], ['s', 'm1', 'My answer.', '2026-11-08'],
      ['s', 'm2', 'B', date], ['s', 'm4', 'My answer.', date],
    ]) await expect(f.svc.referenceAnswer(student, id, answer, day)).rejects.toThrow();
    f.db.studentSubmission.findFirst.mockResolvedValue(null);
    await expect(f.svc.referenceAnswer('s', 'm1', 'My answer.', date)).rejects.toThrow();
    expect(f.evidence).toHaveLength(0);
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
