import { describe, expect, it, vi } from 'vitest';
import { loadTieredAchievementFacts, validFormalResponse } from './achievement-facts';
const NOW = new Date('2026-09-15T04:00:00Z');
const at = (day: string, time = '02:00:00') => new Date(day + 'T' + time + 'Z');
const reading = (id: string, day = '2026-09-01', over: any = {}) => ({
  id, status: 'submitted', submitSource: 'student', finalSubmittedAt: at(day),
  assignment: { paperId: 'paper-' + id, morningQuizSession: { date: at(day, '00:00:00'), status: 'active' } },
  scripts: [{ selectedOption: 'A', textAnswer: null }], ...over,
});
const card = (id: string, word: string, day = '2026-09-01', over: any = {}) => ({
  id, status: 'completed', completedAt: at(day), response: { action: 'normal' }, contentSnapshot: { headword: word },
  questionSnapshot: null, sense: { lexeme: { headword: word } }, ...over,
});
const daily = (id: string, items: any[], day = '2026-09-01', over: any = {}) => ({
  id, sessionKey: id, sessionType: 'daily_learning', date: at(day, '00:00:00'), status: 'completed', target: items.length,
  completedAt: at(day, '02:10:00'), settingsSnapshot: {}, items, ...over,
});
const formal = (id: string, dailyId: string, day = '2026-09-01', over: any = {}) => ({
  id, sessionKey: dailyId + ':formal', sessionType: 'formal_test', date: at(day, '00:00:00'), status: 'submitted', target: 1,
  completedAt: at(day, '02:20:00'), settingsSnapshot: { dailySessionId: dailyId },
  items: [{ ...card('q-' + id, 'word', day), status: 'answered', response: { value: 0 }, questionSnapshot: { type: 'meaning_choice', options: ['甲', '乙', '丙', '丁'] } }], ...over,
});
function db(readings: any[] = [], sessions: any[] = []) {
  const page = (rows: any[]) => vi.fn(async ({ cursor, take }: any) => {
    const start = cursor ? rows.findIndex((row) => row.id === cursor.id) + 1 : 0;
    return rows.slice(start, start + take);
  });
  return { user: { findUnique: vi.fn(async () => ({ id: 'student' })) }, studentSubmission: { findMany: page(readings) }, vocabularyV2Session: { findMany: page(sessions) } };
}
describe('Lifetime server evidence only', () => {
  it('numeric choice zero is a real answer, but blank/invalid/out-of-range values are not', () => {
    const q = { type: 'meaning_choice', options: ['a', 'b', 'c', 'd'] };
    for (const value of [0, 3, '0', ' 2 ']) expect(validFormalResponse(q, { value })).toBe(true);
    for (const value of ['', ' ', null, -1, 4, 1.5, true, {}, NaN, Infinity]) expect(validFormalResponse(q, { value })).toBe(false);
    expect(validFormalResponse({ type: 'spelling' }, { value: 'wrong-but-attempted' })).toBe(true);
    expect(validFormalResponse({ type: 'spelling' }, { value: '  ' })).toBe(false);
  });
  it('pending grading and missing legacy metadata do not erase an actually submitted reading or alter its score', async () => {
    const pending = reading('pending', undefined, { totalScore: null, meta: null });
    const released = reading('released', undefined, { status: 'marked', totalScore: 3, meta: undefined });
    const original = JSON.stringify([pending, released]);
    const p = db([pending, released]);
    const f = await loadTieredAchievementFacts(p as any, 'student', NOW);
    expect(f.readings.map((event) => event.submissionId)).toEqual(['pending', 'released']);
    expect(JSON.stringify([pending, released])).toBe(original);
    expect(JSON.stringify(f)).not.toMatch(/totalScore|meta|awardedMarks/);
  });
  it('same paper in multiple classes counts one reading but both genuinely completed task dates remain', async () => {
    const first = reading('a'), second = reading('b', '2026-09-02'); second.assignment.paperId = first.assignment.paperId;
    const p = db([first, second], [daily('d1', [card('c1', 'Apple')]), formal('t1', 'd1'), daily('d2', [card('c2', ' apple ', '2026-09-02')], '2026-09-02'), formal('t2', 'd2', '2026-09-02')]);
    const f = await loadTieredAchievementFacts(p as any, 'student', NOW);
    expect(f.readings).toHaveLength(1); expect(f.words).toHaveLength(1); expect(f.tests).toHaveLength(2); expect(f.fullDays).toHaveLength(2); expect(f.activeDays).toHaveLength(2);
  });
  it('teacher-forced repeated headword on another day is activity again but never a second collected word', async () => {
    const p = db([], [
      daily('d1', [card('first', 'Apple')]),
      daily('d2', [card('forced', ' apple ', '2026-09-02')], '2026-09-02', { settingsSnapshot: { force: true } }),
      daily('d3', [card('known', 'APPLE', '2026-09-03', { response: { action: 'mastered' } }), card('skip', 'apple', '2026-09-03', { response: { action: 'skip' } })], '2026-09-03'),
    ]);
    const f = await loadTieredAchievementFacts(p as any, 'student', NOW);
    expect(f.words.map((event) => event.key)).toEqual(['apple']);
    expect(f.activeDays.map((event) => event.key)).toEqual(['2026-09-01', '2026-09-02']);
    expect(f.tests).toEqual([]); expect(f.fullDays).toEqual([]);
  });
  it('skip/mastered/replace, empty reading, practice, system EOD, cancelled and empty formal do not manufacture activity', async () => {
    const cancelled = reading('cancel'); cancelled.assignment.morningQuizSession.status = 'cancelled';
    const cards = ['skip', 'mastered', 'replace'].map((action, i) => card(String(i), 'word' + i, '2026-09-01', { response: { action } }));
    const p = db([reading('blank', undefined, { scripts: [{ selectedOption: ' ', textAnswer: '' }] }), reading('practice', undefined, { status: 'practice' }), reading('auto', undefined, { submitSource: 'system_eod' }), cancelled],
      [daily('d1', cards), formal('t1', 'd1'), formal('custom', 'd1', undefined, { sessionType: 'custom_test' }), formal('empty', 'd1', undefined, { items: [], target: 0 })]);
    const f = await loadTieredAchievementFacts(p as any, 'student', NOW);
    expect(f).toEqual({ readings: [], words: [], tests: [], fullDays: [], activeDays: [] });
  });
  it('all-skipped daily is not a full day; wrong but nonempty answers count effort; test dedup uses its daily session', async () => {
    const p = db([reading('a')], [daily('d1', [card('sk', 'skip', undefined, { status: 'skipped', response: { action: 'skip' } })]),
      daily('d2', [card('w', 'learned')]), formal('t1', 'd2'), formal('t2', 'd2')]);
    const f = await loadTieredAchievementFacts(p as any, 'student', NOW);
    expect(f.words).toHaveLength(1); expect(f.tests).toHaveLength(1); expect(f.fullDays).toHaveLength(1);
  });
  it('one unanswered/blank formal item, wrong linked daily, and future timestamps are excluded', async () => {
    const valid = formal('valid', 'd');
    const blank = formal('blank', 'd'); blank.items[0].response = { value: '' };
    const p = db([], [daily('d', [card('c', 'word')]), blank, formal('orphan', 'foreign-student-daily'), formal('future', 'd', undefined, { completedAt: at('2026-09-16') }), valid]);
    const f = await loadTieredAchievementFacts(p as any, 'student', NOW);
    expect(f.tests.map((event) => event.sessionId)).toEqual(['valid']);
  });
  it('catch-up awards use actual finish time, not a retroactive task date; active days are SGT calendar days', async () => {
    const lateAt = new Date('2026-09-14T16:01:00Z');
    const p = db([reading('r', '2026-09-01', { finalSubmittedAt: lateAt })], [daily('d', [card('c', 'word', '2026-09-01', { completedAt: lateAt })], '2026-09-01', { completedAt: lateAt }), formal('t', 'd', '2026-09-01', { completedAt: lateAt })]);
    const f = await loadTieredAchievementFacts(p as any, 'student', NOW);
    expect(f.fullDays[0]).toMatchObject({ key: '2026-09-01', at: lateAt }); expect(f.activeDays.map((event) => event.key)).toEqual(['2026-09-15']);
  });
  it('pages past400 readings/600 sessions and preserves first-ever word learning rather than a recent window', async () => {
    const reads = Array.from({ length: 601 }, (_, i) => reading('r' + String(i).padStart(4, '0')));
    const sessions = Array.from({ length: 701 }, (_, i) => daily('d' + String(i).padStart(4, '0'), [card('c' + i, 'word' + i)]));
    const p = db(reads, sessions), f = await loadTieredAchievementFacts(p as any, 'student', NOW);
    expect(f.readings).toHaveLength(601); expect(f.words).toHaveLength(701);
    expect(p.studentSubmission.findMany).toHaveBeenCalledTimes(3); expect(p.vocabularyV2Session.findMany).toHaveBeenCalledTimes(3);
    for (const [query] of p.studentSubmission.findMany.mock.calls) expect(query).toMatchObject({ where: { studentId: 'student' }, take: 250 });
  });
  it('missing user rejects without scanning another account', async () => {
    const p = db(); p.user.findUnique.mockResolvedValue(null as any);
    await expect(loadTieredAchievementFacts(p as any, 'no-such-user', NOW)).rejects.toMatchObject({ status: 404 });
    expect(p.studentSubmission.findMany).not.toHaveBeenCalled();
  });
});
