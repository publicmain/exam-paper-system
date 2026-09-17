import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { frozenCollectionArticle, loadCollectionV5Facts } from './collection-v5-facts';
import { emptyCollectionV5Facts } from './collection-v5-rules';
import * as verifiedTopics from './verified-article-topics';

const NOW = new Date('2026-09-17T10:00:00Z');
const at = (day = '2026-09-01', time = '02:00:00') => new Date(`${day}T${time}Z`);
const reading = (id: string, day = '2026-09-01', extra: any = {}) => ({
  id, status: 'submitted', submitSource: 'student', finalSubmittedAt: at(day),
  scripts: [{ paperQuestionId: `q-${id}`, selectedOption: 'A', textAnswer: null }],
  assignment: { classId: 'real-class', morningQuizSession: { date: at(day, '00:00:00'), status: 'active' },
    paper: { config: {}, questions: [{ id: `q-${id}`, snapshotContent: { passage: `A unique frozen reading article ${id}.`,
      achievementArticle: { primaryTopicId: 'science', primaryTopicVerified: true } } }] } }, ...extra,
});
const card = (id: string, word = 'apple', day = '2026-09-01', extra: any = {}) => ({
  id, senseId: `sense-${word}`, source: 'level_gap', status: 'completed', completedAt: at(day), response: { action: 'normal' },
  contentSnapshot: { headword: word }, questionSnapshot: null, isCorrect: null, ...extra,
});
const daily = (id: string, items = [card('c-' + id)], day = '2026-09-01', extra: any = {}) => ({
  id, sessionKey: `${id}:daily`, sessionType: 'daily_learning', mode: 'level_gap', date: at(day, '00:00:00'), createdAt: at(day, '00:00:00'),
  status: 'completed', target: items.length, completedAt: at(day, '02:10:00'), settingsSnapshot: {}, sourceSummary: {}, items, ...extra,
});
const formal = (id: string, dailyId: string, day = '2026-09-01', extra: any = {}) => ({
  id, sessionKey: `${dailyId}:daily:formal`, sessionType: 'formal_test', mode: 'teacher_list', date: at(day, '00:00:00'), createdAt: at(day, '02:11:00'),
  status: 'submitted', target: 1, completedAt: at(day, '02:20:00'), settingsSnapshot: { dailySessionId: dailyId }, sourceSummary: {},
  items: [card(`q-${id}`, 'apple', day, { status: 'answered', completedAt: at(day, '02:19:00'), response: { value: 0 },
    questionSnapshot: { type: 'meaning_choice', options: ['a', 'b', 'c', 'd'] }, isCorrect: true })], ...extra,
});
function db(readings: any[] = [], sessions: any[] = [], user: any = { id: 'student', role: 'student' }) {
  const page = (rows: any[]) => vi.fn(async ({ cursor, take }: any) => {
    const sorted = [...rows].sort((a, b) => a.id.localeCompare(b.id));
    const start = cursor ? sorted.findIndex((row) => row.id === cursor.id) + 1 : 0;
    return sorted.slice(start, start + take);
  });
  return { user: { findUnique: vi.fn(async () => user) }, studentSubmission: { findMany: page(readings) }, vocabularyV2Session: { findMany: page(sessions) } };
}
const load = (p: ReturnType<typeof db>, id = 'student') => loadCollectionV5Facts(p as any, id, NOW);
beforeEach(() => { vi.stubEnv('BADGES_SANDBOX', ''); vi.stubEnv('DEMO_ACCOUNT_IDS', ''); vi.stubEnv('DEMO_ACCOUNT_PREFIXES', 'p1_qa_acc_'); vi.stubEnv('DEMO_CLASS_IDS', 'p1_class_qa,p1_class'); });
afterEach(() => { vi.unstubAllEnvs(); vi.restoreAllMocks(); });

describe('V5 frozen reading sources', () => {
  it('exact-body reviewed topic fills missing metadata; conflict with a frozen verified topic fails closed', () => {
    const lookup = vi.spyOn(verifiedTopics, 'verifiedPrimaryTopicForArticleKey').mockReturnValue('nature');
    const result = frozenCollectionArticle({ passage: 'Reviewed article.', primaryTopicId: 'mutable-guess' });
    expect(lookup).toHaveBeenCalledWith(result!.key);
    expect(result?.topic).toBe('nature');
    expect(frozenCollectionArticle({ passage: 'Reviewed article.', achievementArticle: { primaryTopicVerified: true, primaryTopicId: 'nature' } })?.topic).toBe('nature');
    expect(frozenCollectionArticle({ passage: 'Reviewed article.', achievementArticle: { primaryTopicVerified: true, primaryTopicId: 'history' } })?.topic).toBeUndefined();
    lookup.mockReturnValue(undefined);
    expect(frozenCollectionArticle({ passage: 'Unknown article.', primaryTopicId: 'guess' })?.topic).toBeUndefined();
  });
  it('normalizes frozen passage identity across case/spacing/paragraph labels, rejects missing bodies and mutable topic guesses', () => {
    const a = frozenCollectionArticle({ passage: 'Paragraph A\nA real article.\nMore text.', primaryTopicId: 'guess', topic: 'guess' });
    const b = frozenCollectionArticle({ passage: { body: 'a REAL article.  More text.' } });
    expect(a?.key).toBe(b?.key); expect(a?.topic).toBeUndefined();
    expect(frozenCollectionArticle({ passage: '  ' })).toBeNull();
    expect(frozenCollectionArticle({ title: 'not an article' })).toBeNull();
    expect(frozenCollectionArticle({ passage: 'Real.', achievementArticle: { primaryTopicId: 'Science', primaryTopicVerified: false } })?.topic).toBeUndefined();
  });

  it('same article in different papers/dates/classes counts once but task activity and triad dates survive', async () => {
    const one = reading('r1'), two = reading('r2', '2026-09-02');
    two.assignment.paper.questions[0].snapshotContent.passage = one.assignment.paper.questions[0].snapshotContent.passage;
    const p = db([one, two], [daily('d1'), formal('f1', 'd1'), daily('d2', [card('c2', 'apple', '2026-09-02')], '2026-09-02'), formal('f2', 'd2', '2026-09-02')]);
    const f = await load(p);
    expect(f.readings).toHaveLength(1); expect(f.learningBatches).toHaveLength(2); expect(f.tests).toHaveLength(2); expect(f.fullDays).toHaveLength(2); expect(f.activeDays).toHaveLength(2);
  });

  it('multiple frozen articles in one paper count individually only if an article has a real answer', async () => {
    const r = reading('multi');
    r.assignment.paper.questions.push({ id: 'q2', snapshotContent: { passage: 'Second actual article.', achievementArticle: { primaryTopicId: 'culture', primaryTopicVerified: true } } });
    expect((await load(db([r]))).readings).toHaveLength(1);
    r.scripts.push({ paperQuestionId: 'q2', selectedOption: '', textAnswer: 'Wrong but attempted.' } as any);
    expect((await load(db([r]))).readings).toHaveLength(2);
  });

  it('pending marking counts without exposing grades; frozen conflicting topics are excluded', async () => {
    const a = reading('r1', undefined, { totalScore: null }), b = reading('r2', undefined, { status: 'marked', totalScore: 0 });
    b.assignment.paper.questions[0].snapshotContent.passage = a.assignment.paper.questions[0].snapshotContent.passage;
    b.assignment.paper.questions[0].snapshotContent.achievementArticle.primaryTopicId = 'culture';
    const before = JSON.stringify([a, b]), f = await load(db([a, b]));
    expect(f.readings).toHaveLength(1); expect(f.readings[0].topic).toBeUndefined();
    expect(JSON.stringify(f)).not.toMatch(/totalScore|questionSnapshot|passage|selectedOption/); expect(JSON.stringify([a, b])).toBe(before);
  });

  it('practice, empty, auto-finalized, cancelled, untraceable and future reading never counts', async () => {
    const cancel = reading('cancel'); cancel.assignment.morningQuizSession.status = 'cancelled';
    const orphan = reading('orphan'); orphan.scripts[0].paperQuestionId = 'not-on-paper';
    const rows = [cancel, orphan, reading('blank', undefined, { scripts: [] }), reading('practice', undefined, { status: 'practice' }),
      reading('system', undefined, { submitSource: 'system_eod' }), reading('future', '2026-09-18')];
    expect(await load(db(rows))).toEqual(emptyCollectionV5Facts());
  });
});

describe('V5 final daily manifests and first formal scores', () => {
  it('one whole task is one batch regardless of word count, deferrals or target; final replacement is learned, old word is not', async () => {
    const items = [card('one', 'apple', undefined, { response: { action: 'normal', replacedFrom: [{ headword: 'old-word' }] } }),
      card('two', 'banana', undefined, { status: 'skipped', response: { action: 'skip' } }), card('three', 'pear', undefined, { response: { action: 'mastered' } })];
    const f = await load(db([], [daily('d', items, undefined, { target: 21 })]));
    expect(f.learningBatches).toHaveLength(1); expect(f.learningBatches[0].itemIds).toEqual(['one']);
    expect(f.activeDays).toHaveLength(1);
  });

  it('pending, empty, all deferred/known, invalid timestamps and malformed completed cards cannot award a completed batch', async () => {
    const rows = [daily('empty', []), daily('skip', [card('s', 'a', undefined, { status: 'skipped', response: { action: 'skip' } })]),
      daily('known', [card('k', 'a', undefined, { response: { action: 'mastered' } })]), daily('pending', [card('p', 'a', undefined, { status: 'pending' })]),
      daily('status', undefined, undefined, { status: 'in_progress' }), daily('timestamp', [card('t', 'a', undefined, { completedAt: null })]),
      daily('after', [card('a', 'a', undefined, { completedAt: at('2026-09-02') })]), daily('blank', [card('b', ' ')]),
      daily('replaced', [card('r', 'a', undefined, { response: { action: 'replace' } })]),
      daily('chronology', undefined, undefined, { createdAt: at('2026-09-02') }),
      daily('not-word', [card('n', 'a', undefined, { contentSnapshot: { headword: 123 } })])];
    expect(await load(db([], rows))).toEqual(emptyCollectionV5Facts());
  });

  it('uses stored grading exactly at 80%, never client percentage nor recalculated answer keys', async () => {
    const words = ['a', 'b', 'c', 'd', 'e'];
    const d = daily('d', words.map((w) => card('c-' + w, w)));
    const t = formal('t', 'd', undefined, { target: 5, scorePercent: 100 });
    t.items = words.map((w, i) => card('q-' + w, w, undefined, { status: 'answered', completedAt: at('2026-09-01', '02:19:00'), response: { value: 'not-the-key' }, questionSnapshot: { type: 'spelling', answer: 'secret' }, isCorrect: i < 4 }));
    expect((await load(db([], [d, t]))).tests).toHaveLength(1);
    t.items[3].isCorrect = false;
    expect((await load(db([], [d, t]))).tests).toHaveLength(0);
    expect((await load(db([reading('r')], [d, t]))).fullDays).toHaveLength(1);
    t.items[3].isCorrect = null;
    expect((await load(db([], [d, t]))).tests).toHaveLength(0);
  });

  it('later passed clone or retry never replaces a failed first formal attempt', async () => {
    const failed = formal('z-original', 'd'), passed = formal('a-later', 'd', undefined, { createdAt: at('2026-09-01', '03:00:00'), completedAt: at('2026-09-01', '03:30:00') });
    failed.items[0].isCorrect = false;
    const f = await load(db([], [daily('d'), passed, failed, formal('retry', 'd', undefined, { sessionType: 'retry' }), formal('practice', 'd', undefined, { sessionType: 'custom_test' })]));
    expect(f.tests).toEqual([]); expect(f.activeDays).toHaveLength(1);
  });

  it('invalid or unfinished first attempt is not ignored in favor of a second valid passed session', async () => {
    const first = formal('first', 'd', undefined, { status: 'in_progress', completedAt: null });
    const second = formal('second', 'd', undefined, { createdAt: at('2026-09-01', '03:00:00') });
    const f = await load(db([reading('r')], [daily('d'), first, second]));
    expect(f.tests).toEqual([]); expect(f.fullDays).toEqual([]);
  });

  it('test must match final actually learned manifest; replaced/deferred words and foreign/orphan dates cannot count', async () => {
    const original = formal('wrong', 'd'); original.items[0].contentSnapshot.headword = 'old-replaced-word';
    const f = await load(db([reading('r')], [daily('d'), original, formal('orphan', 'other-student-daily'), formal('foreign-day', 'd', '2026-09-02')]));
    expect(f.tests).toEqual([]); expect(f.fullDays).toEqual([]);
  });

  it('known historical review-sample questions stay part of official first score, not new learned words', async () => {
    const t = formal('t', 'd'); t.target = 2;
    t.items.push(card('review-question', 'older', undefined, { source: 'review', status: 'answered', response: { value: 'older' }, questionSnapshot: { type: 'spelling' }, isCorrect: true }));
    expect((await load(db([], [daily('d'), t]))).tests).toHaveLength(1);
  });

  it('full task activity uses completion date, not individual card dates; makeups preserve source-date triad', async () => {
    const finish = at('2026-09-16', '16:01:00'), f = await load(db([reading('r', '2026-09-01', { finalSubmittedAt: finish })], [
      daily('d', [card('c', 'apple')], '2026-09-01', { completedAt: finish }), formal('t', 'd', '2026-09-01', { completedAt: finish }),
    ]));
    expect(f.fullDays).toEqual([expect.objectContaining({ key: '2026-09-01', at: finish })]);
    expect(f.activeDays.map((e) => e.key)).toEqual(['2026-09-17']);
  });

  it('SGT actual month changes at 16:00 UTC', async () => {
    const early = new Date('2026-08-31T15:59:00Z'), late = new Date('2026-08-31T16:00:00Z');
    const f = await load(db([], [daily('d1', [card('c1', 'a', '2026-08-01')], '2026-08-01', { completedAt: early }), daily('d2', [card('c2', 'b', '2026-08-02')], '2026-08-02', { completedAt: late })]));
    expect(f.activeDays.map((e) => e.key)).toEqual(['2026-08-31', '2026-09-01']);
  });
});

describe('V5 isolation and lifetime evidence', () => {
  it('known demo account/source excluded even if a sandbox flag leaks into the release environment', async () => {
    const r = reading('r'); r.assignment.paper.config = { achievementSandbox: true };
    const d = daily('d', undefined, undefined, { settingsSnapshot: { achievementSandbox: true } });
    const t = formal('t', 'd', undefined, { settingsSnapshot: { dailySessionId: 'd', achievementSandbox: true } });
    expect(await load(db([r], [d, t]))).toEqual(emptyCollectionV5Facts());
    const demoDb = db([reading('real')]); expect(await load(demoDb, 'p1_qa_acc_demo')).toEqual(emptyCollectionV5Facts());
    expect(demoDb.studentSubmission.findMany).not.toHaveBeenCalled();
    vi.stubEnv('BADGES_SANDBOX', 'local-only');
    const f = await load(db([r], [d, t]), 'p1_qa_acc_demo');
    expect(f).toEqual(emptyCollectionV5Facts());
    vi.stubEnv('NODE_ENV', 'production');
    expect(await load(db([r], [d, t]))).toEqual(emptyCollectionV5Facts());
  });

  it('demo class excluded without student-name heuristics and unknown student rejects', async () => {
    const r = reading('r'); r.assignment.classId = 'p1_class_qa';
    expect((await load(db([r]))).readings).toEqual([]);
    const p = db([], [], null); await expect(load(p)).rejects.toMatchObject({ status: 404 });
    expect(p.studentSubmission.findMany).not.toHaveBeenCalled();
    expect(await load(db([reading('r')], [], { role: 'teacher', id: 'student' }))).toEqual(emptyCollectionV5Facts());
  });

  it('cursor pages every lifetime reading/session without 400/600 truncation', async () => {
    const reads = Array.from({ length: 601 }, (_, i) => reading(`r-${String(i).padStart(4, '0')}`));
    const sessions = Array.from({ length: 701 }, (_, i) => daily(`d-${String(i).padStart(4, '0')}`));
    const p = db(reads, sessions), f = await load(p);
    expect(f.readings).toHaveLength(601); expect(f.learningBatches).toHaveLength(701);
    expect(p.studentSubmission.findMany).toHaveBeenCalledTimes(3); expect(p.vocabularyV2Session.findMany).toHaveBeenCalledTimes(3);
    for (const [query] of p.studentSubmission.findMany.mock.calls) expect(query).toMatchObject({ where: { studentId: 'student' }, orderBy: { id: 'asc' }, take: 250 });
    for (const [query] of p.vocabularyV2Session.findMany.mock.calls) expect(query).toMatchObject({ where: { studentId: 'student' }, orderBy: { id: 'asc' }, take: 250 });
  });
});
