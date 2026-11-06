import { describe, expect, it } from 'vitest';
import { dateOnly } from '../common/school-calendar';
import { officialList, officialListVersion } from './official-wordlists';
import { makeService, newDb, seedOfficialWords, seedStudent, sgtNoon } from './testing/vocab-fixtures';

const TODAY = '2026-11-05';
const NOW = sgtNoon(TODAY);

function setup(dueCount = 8, exhausted = true) {
  const db = newDb();
  const id = seedStudent(db, { dailyTarget: 10 });
  const old = seedOfficialWords(db, 'ngsl', 1001, dueCount);
  for (const word of old) db.seed('studentVocabularySense', {
    studentId: id, senseId: word.senseId, reps: 1, lastReview: null, due: dateOnly(TODAY),
  });
  if (exhausted) for (const listName of ['ngsl', 'nawl'] as const) db.seed('studentVocabularyCursor', {
    studentId: id, listName, listVersion: officialListVersion(listName), nextRank: officialList(listName).length + 1,
  });
  return { db, id, old, svc: makeService(db) };
}

describe('No fresh words, due reviews remain', () => {
  it.each(['exhausted', 'unpublishable'] as const)('%s new words: finish zero-card learning and generate a review-only formal test', async (reason) => {
    const { db, id, svc } = setup(8, reason === 'exhausted');
    if (reason === 'unpublishable') seedOfficialWords(db, 'ngsl', 1801, 15, { publishable: false });
    const daily = await svc.startDailySession(id, NOW);
    expect(daily).toMatchObject({ status: 'completed', target: 0, learned: 0, pending: 0, learningPhase: 'finished',
      testNeeded: true, items: [], settings: { reviewWords: 5 }, generatedTest: { total: 5, newWords: 0, reviewWords: 5 } });
    expect(daily.settings).not.toHaveProperty('reviewItems');
    expect(db.rows('vocabularyV2Session', { id: daily.id })[0].completedAt).toBeInstanceOf(Date);
    const formal = await svc.startFormalTest(id, daily.id);
    expect(formal).toMatchObject({ total: 5, newWords: 0, reviewWords: 5 });
    expect(daily).toMatchObject({ generatedTestId: formal.id });
    const overview = await svc.overview(id, NOW);
    expect(overview.today).toMatchObject({ target: 0, learned: 0, pending: 0, learningPhase: 'finished', items: [] });
    expect(overview.home.words).toMatchObject({ state: 'completed', target: 0, learned: 0, pending: 0 });
    expect(overview.home.test).toMatchObject({ state: 'pending', total: 5, newWords: 0, reviewWords: 5 });
    expect(overview.pendingTests).toHaveLength(1);
    const review = await svc.reviewDailySession(id, NOW, TODAY);
    expect(review).toMatchObject({ learned: 0, recite: [], test: { generated: true, total: 5, newWords: 0, reviewWords: 5 } });
  });

  it('fresh candidates taken after the snapshot still allow the planned reviews', async () => {
    const { db, id, svc } = setup(8, false);
    const fresh = seedOfficialWords(db, 'ngsl', 1801, 15);
    const transact = db.$transaction;
    db.$transaction = (run: any) => transact(async (tx: any) => {
      // Approximate another day claiming the fresh candidates after the outer
      // snapshot, before takenSinceSnapshot rechecks under the student lock.
      for (const word of fresh) await tx.studentVocabularySense.upsert({
        where: { studentId_senseId: { studentId: id, senseId: word.senseId } },
        create: { studentId: id, senseId: word.senseId }, update: {},
      });
      return run(tx);
    });
    const daily = await svc.startDailySession(id, NOW);
    expect(daily).toMatchObject({ status: 'completed', items: [], generatedTest: { newWords: 0, reviewWords: 5 } });
  });

  it('concurrent starts, retries and paper creation keep one frozen plan and one test', async () => {
    const { db, id, svc } = setup();
    const [a, b] = await Promise.all([svc.startDailySession(id, NOW), svc.startDailySession(id, NOW)]);
    expect(a.id).toBe(b.id);
    const [paper] = db.rows('vocabularyV2Session', { sessionType: 'formal_test' });
    expect(a).toMatchObject({ generatedTestId: paper.id });
    expect(b).toMatchObject({ generatedTestId: paper.id });
    const retry = await svc.startDailySession(id, NOW);
    expect(retry).toMatchObject({ id: a.id, generatedTestId: paper.id });
    const [x, y] = await Promise.all([svc.startFormalTest(id, a.id), svc.startFormalTest(id, a.id)]);
    expect(x.id).toBe(paper.id);
    expect(y.id).toBe(x.id);
    expect(db.rows('vocabularyV2Session', { sessionType: 'daily_learning' })).toHaveLength(1);
    expect(db.rows('vocabularyV2Session', { sessionType: 'formal_test' })).toHaveLength(1);
    expect(db.rows('learningEvidence')).toHaveLength(0);
    expect(db.rows('studentVocabularySense').every((card) => card.reps === 1 && card.lastReview === null)).toBe(true);
  });

  it('retry recovers paper generation after learning was saved but the first paper write failed', async () => {
    const { db, id, svc } = setup();
    const create = db.vocabularyV2Session.create;
    db.vocabularyV2Session.create = async (args: any) => {
      if (args.data.sessionType === 'formal_test') throw new Error('paper write failed');
      return create(args);
    };
    await expect(svc.startDailySession(id, NOW)).rejects.toThrow('paper write failed');
    expect(db.rows('vocabularyV2Session', { sessionType: 'daily_learning' })).toHaveLength(1);
    db.vocabularyV2Session.create = create;
    const retry = await svc.startDailySession(id, NOW);
    expect(retry).toMatchObject({ status: 'completed', generatedTest: { total: 5, newWords: 0, reviewWords: 5 } });
    expect(db.rows('vocabularyV2Session', { sessionType: 'formal_test' })).toHaveLength(1);
  });

  it('a review-only formal answer still uses the existing first-answer and submission flow', async () => {
    const { db, id, svc } = setup(1);
    const daily = await svc.startDailySession(id, NOW);
    const formal = await svc.startFormalTest(id, daily.id);
    const question = db.rows('vocabularyV2SessionItem', { sessionId: formal.id })[0];
    await svc.answerTestItem(id, formal.id, question.id, question.questionSnapshot.answer, undefined, NOW);
    await svc.submitTest(id, formal.id, NOW);
    expect((await svc.overview(id, NOW)).home.test).toMatchObject({ state: 'completed', total: 1, newWords: 0, reviewWords: 1 });
    expect(db.rows('learningEvidence')).toHaveLength(1);
  });

  it.each([false, true])('no new words and no due reviews (future=%s) still returns 503 without an empty task', async (future) => {
    const { db, id, svc } = setup(future ? 1 : 0);
    if (future) await db.studentVocabularySense.updateMany({ data: { due: dateOnly('2026-11-06') } });
    await expect(svc.startDailySession(id, NOW)).rejects.toMatchObject({ status: 503, response: { code: 'no_publishable_vocabulary' } });
    expect(db.rows('vocabularyV2Session')).toHaveLength(0);
  });
});
