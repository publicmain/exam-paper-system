import { describe, expect, it } from 'vitest';
import { dateOnly } from '../common/school-calendar';
import { dailyVocabularyComposition } from './daily-planner';
import { makeService, newDb, seedOfficialWords, seedStudent, sgtNoon } from './testing/vocab-fixtures';

const TODAY = '2026-11-05';
function setup(target = 5, dueCount = 0) {
  const db = newDb(); const id = seedStudent(db, { dailyTarget: target });
  seedOfficialWords(db, 'ngsl', 1801, 50);
  const old = seedOfficialWords(db, 'ngsl', 1001, dueCount);
  old.forEach((word, i) => {
    db.seed('studentVocabularySense', { studentId: id, senseId: word.senseId, masteryStage: 3, reps: 1,
      due: dateOnly(TODAY), lastReview: dateOnly('2026-11-02'), stability: 1, difficulty: 5 });
    db.seed('learningEvidence', { studentId: id, senseId: word.senseId, kind: 'formal_first', subject: 'vocab_sense',
      sourceKey: `old-${i}`, isCorrect: true, hinted: false, schoolDate: dateOnly('2026-11-02'), occurredAt: sgtNoon('2026-11-02') });
  });
  const svc = makeService(db);
  const learn = async (action: 'normal' | 'skip' = 'normal') => {
    const daily = await svc.startDailySession(id, sgtNoon(TODAY));
    let last: any;
    for (const item of daily.items) last = await svc.actOnLearningItem(id, daily.id, item.id, action);
    return { daily, last, formal: await svc.testSession(id, last.generatedTestId) };
  };
  return { db, id, old, svc, learn };
}

describe('Due review replaces new words in a fixed daily budget', () => {
  it.each([[5, 0, 5, 0], [5, 1, 4, 1], [5, 8, 3, 2], [10, 9, 5, 5], [15, 99, 8, 7]])(
    'T=%i due=%i -> new=%i review=%i', (total, due, fresh, review) => {
      expect(dailyVocabularyComposition(total, due)).toEqual({ fresh, review });
    });
  it.each([0, 1, 2, 8])('due=%i: frozen quota, exact total and no extra todo', async (count) => {
    const { db, id, svc, learn } = setup(5, count);
    const { daily, formal } = await learn();
    const review = Math.min(count, 2);
    expect(daily.items).toHaveLength(5 - review);
    expect(formal).toMatchObject({ total: 5, newWords: 5 - review, reviewWords: review });
    expect(db.rows('vocabularyV2SessionItem', { sessionId: formal.id }).slice(5 - review).every((i) => i.source === 'review')).toBe(true);
    expect((await svc.overview(id, sgtNoon(TODAY))).home.test).toMatchObject({ total: 5, newWords: 5 - review, reviewWords: review });
    expect((await svc.teacherClassProgress({ id: 'admin', role: 'admin' }, 'class-1', sgtNoon(TODAY))).students[0].vocabulary.pendingTestWords).toBe(5);
  });
  it('unlearned words or words not due yet do not enter the test', async () => {
    const { db, id, old, svc } = setup(5, 2);
    await db.learningEvidence.deleteMany({ where: { senseId: old[0].senseId } });
    await db.studentVocabularySense.updateMany({ where: { senseId: old[0].senseId }, data: { reps: 0, lastReview: null } });
    await db.studentVocabularySense.updateMany({ where: { senseId: old[1].senseId }, data: { due: dateOnly('2026-11-06') } });
    expect((await svc.startDailySession(id, sgtNoon(TODAY))).items).toHaveLength(5);
  });
  it('legacy learned word returns for its first formal recall without fabricated history or a prebuilt card', async () => {
    const { db, id, old, svc, learn } = setup(5, 1);
    await db.learningEvidence.deleteMany({});
    await db.studentVocabularySense.updateMany({ where: { senseId: old[0].senseId }, data: { reps: 70, lastReview: null, stability: 0 } });
    const { formal } = await learn();
    expect(formal).toMatchObject({ total: 5, newWords: 4, reviewWords: 1 });
    expect(db.rows('learningEvidence')).toHaveLength(0);
    expect(db.rows('studentVocabularySense', { senseId: old[0].senseId })[0].lastReview).toBeNull();
    const question = db.rows('vocabularyV2SessionItem', { sessionId: formal.id, senseId: old[0].senseId })[0];
    await svc.answerTestItem(id, formal.id, question.id, question.questionSnapshot.type === 'spelling' ? old[0].headword : question.questionSnapshot.answer,
      undefined, sgtNoon(TODAY));
    expect(db.rows('learningEvidence')).toHaveLength(1);
    expect(db.rows('studentVocabularySense', { senseId: old[0].senseId })[0]).toMatchObject({ reps: 1, lastReview: dateOnly(TODAY) });
  });
  it('due order first, unresolved errors break ties; removed and blocked words stay out', async () => {
    const { db, id, old, svc } = setup(10, 8);
    await db.studentVocabularySense.updateMany({ where: { senseId: old[0].senseId }, data: { inNotebook: false } });
    await db.studentVocabularySense.updateMany({ where: { senseId: old[1].senseId }, data: { due: dateOnly('2026-11-03') } });
    await db.learningEvidence.updateMany({ where: { senseId: old[7].senseId }, data: { isCorrect: false } });
    const daily = await svc.startDailySession(id, sgtNoon(TODAY));
    expect(daily.settings).not.toHaveProperty('reviewItems');
    const review = db.rows('vocabularyV2Session', { id: daily.id })[0].settingsSnapshot.reviewItems;
    expect(review[0].senseId).toBe(old[1].senseId);
    expect(review[1].senseId).toBe(old[7].senseId);
    expect(review.some((i: any) => i.senseId === old[0].senseId)).toBe(false);
    expect(review.every((i: any) => i.masteryBefore === 3)).toBe(true);
  });
  it('teacher list keeps every fresh word and adds at most 3 due words', async () => {
    const { db, id, learn } = setup(5, 8);
    const fresh = seedOfficialWords(db, 'ngsl', 1801, 5);
    db.seed('vocabularyV2Assignment', { id: 'a', classId: 'class-1', date: dateOnly(TODAY) });
    fresh.forEach((word, index) => db.seed('vocabularyV2AssignmentItem', { assignmentId: 'a', senseId: word.senseId, position: index + 1 }));
    const { daily, formal } = await learn();
    expect(daily.items).toHaveLength(5);
    expect(formal).toMatchObject({ total: 8, newWords: 5, reviewWords: 3 });
    expect(new Set(db.rows('vocabularyV2SessionItem', { sessionId: formal.id }).map((i) => i.senseId)).size).toBe(8);
    expect(db.rows('vocabularyV2Session', { studentId: id, sessionType: 'daily_learning' })).toHaveLength(1);
  });
  it('even when the teacher list is all previously seen, fallback new-word quota is not reduced', async () => {
    const { db, id, old, svc } = setup(5, 8);
    db.seed('vocabularyV2Assignment', { id: 'a', classId: 'class-1', date: dateOnly(TODAY) });
    db.seed('vocabularyV2AssignmentItem', { assignmentId: 'a', senseId: old[0].senseId, position: 1 });
    const daily = await svc.startDailySession(id, sgtNoon(TODAY));
    expect(daily.items).toHaveLength(5);
    expect((daily.settings as any).reviewWords).toBe(3);
  });
  it('weekend and closure create no task; an existing plan survives without adding reviews', async () => {
    const { db, id, svc } = setup(5, 3);
    db.seed('classNoSchoolDay', { classId: 'class-1', date: dateOnly(TODAY) });
    await expect(svc.startDailySession(id, sgtNoon(TODAY))).rejects.toThrow();
    await expect(svc.startDailySession(id, sgtNoon('2026-11-07'))).rejects.toThrow();
    expect(db.rows('vocabularyV2Session')).toHaveLength(0);
    await db.classNoSchoolDay.deleteMany({});
    const daily = await svc.startDailySession(id, sgtNoon(TODAY));
    db.seed('classNoSchoolDay', { classId: 'class-1', date: dateOnly(TODAY) });
    await svc.startDailySession(id, sgtNoon(TODAY));
    for (const item of daily.items) await svc.actOnLearningItem(id, daily.id, item.id, 'normal');
    const formal = await svc.startFormalTest(id, daily.id);
    expect(formal.reviewWords).toBe(0);
  });
  it('due on a newly closed Friday returns Monday without rescheduling penalty', async () => {
    const { db, id, old, svc } = setup(5, 1);
    await db.studentVocabularySense.updateMany({ where: { senseId: old[0].senseId }, data: { due: dateOnly('2026-11-06') } });
    db.seed('classNoSchoolDay', { classId: 'class-1', date: dateOnly('2026-11-06') });
    const before = db.rows('studentVocabularySense')[0];
    expect((await svc.startDailySession(id, sgtNoon(TODAY))).settings.reviewWords).toBe(0);
    expect((await svc.startDailySession(id, sgtNoon('2026-11-09'))).settings.reviewWords).toBe(1);
    expect(db.rows('studentVocabularySense')[0]).toEqual(before);
  });
  it('concurrent daily generation and formal generation each freeze exactly one copy', async () => {
    const { db, id, svc } = setup(5, 5);
    const [a, b] = await Promise.all([svc.startDailySession(id, sgtNoon(TODAY)), svc.startDailySession(id, sgtNoon(TODAY))]);
    expect(a.id).toBe(b.id); expect(a.settings).toEqual(b.settings);
    for (const item of a.items) await svc.actOnLearningItem(id, a.id, item.id, 'normal');
    const [x, y] = await Promise.all([svc.startFormalTest(id, a.id), svc.startFormalTest(id, a.id)]);
    expect(x.id).toBe(y.id); expect(x.total).toBe(5);
    expect(db.rows('vocabularyV2Session', { sessionType: 'formal_test' })).toHaveLength(1);
  });
  it('all fresh words deferred still leaves the planned reviews in the existing test task', async () => {
    const { id, svc, learn } = setup(5, 5);
    const { formal, last } = await learn('skip');
    expect(formal).toMatchObject({ newWords: 0, reviewWords: 2, total: 2 });
    expect(last.testNeeded).toBe(true);
    expect((await svc.overview(id, sgtNoon(TODAY))).pendingTests).toHaveLength(1);
  });
  it('self-reported removal cannot clear an unresolved formal mistake', async () => {
    const { db, id, old, svc } = setup(5, 1);
    await db.studentVocabularySense.updateMany({ where: { senseId: old[0].senseId }, data: { inNotebook: false, removedAt: sgtNoon('2026-11-02'), masteryStage: 8 } });
    await db.learningEvidence.updateMany({ where: { senseId: old[0].senseId }, data: { isCorrect: false } });
    const daily = await svc.startDailySession(id, sgtNoon(TODAY));
    expect(daily.items).toHaveLength(4);
    expect(daily.settings.reviewWords).toBe(1);
  });
  it('due timestamps use the Singapore day on both sides of UTC midnight', async () => {
    const { db, id, old, svc } = setup(5, 2);
    await db.studentVocabularySense.updateMany({ where: { senseId: old[0].senseId }, data: { due: new Date('2026-11-04T23:59:59Z') } });
    await db.studentVocabularySense.updateMany({ where: { senseId: old[1].senseId }, data: { due: new Date('2026-11-05T00:00:01Z') } });
    const daily = await svc.startDailySession(id, new Date('2026-11-04T23:59:59Z'));
    expect(daily.date).toBe(TODAY);
    expect(daily.settings.reviewWords).toBe(2);
    expect((await svc.startDailySession(id, new Date('2026-11-05T00:00:01Z'))).id).toBe(daily.id);
  });
  it('a newly closed day with every fresh word deferred does not generate an empty test or fail the final action', async () => {
    const { db, id, svc } = setup(5, 2);
    const daily = await svc.startDailySession(id, sgtNoon(TODAY));
    db.seed('classNoSchoolDay', { classId: 'class-1', date: dateOnly(TODAY) });
    let last: any;
    for (const item of daily.items) last = await svc.actOnLearningItem(id, daily.id, item.id, 'skip');
    expect(last).toMatchObject({ status: 'completed', testNeeded: false, generatedTest: null });
    expect(db.rows('vocabularyV2Session', { sessionType: 'formal_test' })).toHaveLength(0);
  });
});
