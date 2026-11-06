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
  it('unresolved errors precede older due words; removed ordinary words stay out', async () => {
    const { db, id, old, svc } = setup(10, 8);
    await db.studentVocabularySense.updateMany({ where: { senseId: old[0].senseId }, data: { inNotebook: false } });
    await db.studentVocabularySense.updateMany({ where: { senseId: old[1].senseId }, data: { due: dateOnly('2026-11-03') } });
    await db.learningEvidence.updateMany({ where: { senseId: old[7].senseId }, data: { isCorrect: false } });
    const daily = await svc.startDailySession(id, sgtNoon(TODAY));
    expect(daily.settings).not.toHaveProperty('reviewItems');
    const review = db.rows('vocabularyV2Session', { id: daily.id })[0].settingsSnapshot.reviewItems;
    expect(review[0].senseId).toBe(old[7].senseId);
    expect(review[1].senseId).toBe(old[1].senseId);
    expect(review.some((i: any) => i.senseId === old[0].senseId)).toBe(false);
    expect(review.every((i: any) => i.masteryBefore === 3)).toBe(true);
  });
  it.each([5, 10, 15, 20])('T=%i: five recent errors precede the backlog, at most three enter and the total stays fixed', async (target) => {
    const { db, old, learn } = setup(target, 35);
    await db.studentVocabularySense.updateMany({ where: { senseId: { in: old.slice(0, 30).map((word) => word.senseId) } }, data: { due: dateOnly('2026-08-03') } });
    const errors = old.slice(30);
    for (const [index, word] of errors.entries()) {
      await db.learningEvidence.updateMany({ where: { senseId: word.senseId }, data: { isCorrect: false } });
      await db.studentVocabularySense.updateMany({ where: { senseId: word.senseId }, data: { due: dateOnly(['2026-11-04', '2026-11-02', '2026-11-03', TODAY, TODAY][index]) } });
    }
    const { daily, formal } = await learn();
    const reviews = db.rows('vocabularyV2Session', { id: daily.id })[0].settingsSnapshot.reviewItems;
    const count = Math.min(3, Math.floor(target / 2));
    expect(reviews.slice(0, count).map((item: any) => item.senseId)).toEqual([errors[1], errors[2], errors[0]].slice(0, count).map((word) => word.senseId));
    expect(reviews.filter((item: any) => errors.some((word) => word.senseId === item.senseId))).toHaveLength(count);
    expect(reviews).toHaveLength(Math.floor(target / 2));
    expect(new Set(reviews.map((item: any) => item.senseId)).size).toBe(reviews.length);
    expect(formal).toMatchObject({ total: target, newWords: target - reviews.length, reviewWords: reviews.length });
  });
  it.each([0, 1, 2])('only %i unresolved errors: ordinary due words fill the remaining review places in due order', async (count) => {
    const { db, id, old, svc } = setup(10, 10);
    await db.learningEvidence.updateMany({ where: { senseId: { in: old.slice(0, count).map((word) => word.senseId) } }, data: { isCorrect: false } });
    for (const [index, word] of old.entries()) {
      await db.studentVocabularySense.updateMany({ where: { senseId: word.senseId }, data: { due: new Date(`2026-11-02T0${index}:00:00Z`) } });
    }
    const daily = await svc.startDailySession(id, sgtNoon(TODAY));
    const reviews = db.rows('vocabularyV2Session', { id: daily.id })[0].settingsSnapshot.reviewItems;
    expect(reviews.map((item: any) => item.senseId)).toEqual(old.slice(0, 5).map((word) => word.senseId));
    expect(daily.items.length + reviews.length).toBe(10);
  });
  it('errors beyond three cannot re-enter as ordinary due words; fresh words fill the unused places', async () => {
    const { db, id, svc, learn } = setup(10, 5);
    await db.learningEvidence.updateMany({ data: { isCorrect: false } });
    const { daily, formal } = await learn();
    expect(daily.items).toHaveLength(7);
    expect(formal).toMatchObject({ total: 10, newWords: 7, reviewWords: 3 });
    expect((await svc.startDailySession(id, sgtNoon(TODAY))).settings.reviewWords).toBe(3);
  });
  it('mistake priority retains spelling deduplication, explicit exclusions, translation and school gates', async () => {
    const { db, id, old, svc } = setup(10, 10);
    const [schoolBlocked] = seedOfficialWords(db, 'ngsl', 1063, 1);
    const errors = [...old.slice(0, 7), schoolBlocked];
    for (const [index, word] of errors.entries()) {
      await db.studentVocabularySense.upsert({
        where: { studentId_senseId: { studentId: id, senseId: word.senseId } },
        create: { studentId: id, senseId: word.senseId, reps: 1, due: dateOnly('2026-11-02') },
        update: { due: new Date(`2026-11-02T0${index}:00:00Z`) },
      });
      db.seed('learningEvidence', { studentId: id, senseId: word.senseId, kind: 'formal_first', subject: 'vocab_sense',
        sourceKey: `mistake-${index}`, isCorrect: false, hinted: false, schoolDate: dateOnly('2026-11-03'), occurredAt: sgtNoon('2026-11-03') });
    }
    await db.vocabularySense.update({ where: { id: old[2].senseId }, data: { translation: '' } });
    const duplicate = db.rows('vocabularySense', { id: old[3].senseId })[0];
    db.seed('vocabularySense', { ...duplicate, id: 'duplicate-sense', senseKey: 'alternate' });
    db.seed('studentVocabularySense', { studentId: id, senseId: 'duplicate-sense', reps: 1, due: dateOnly('2026-08-03') });
    const reviews = await (svc as any).sampleReviewItems(id, [old[0].senseId], 5, [old[1].headword], TODAY);
    expect(reviews.slice(0, 3).map((item: any) => item.senseId)).toEqual(old.slice(3, 6).map((word) => word.senseId));
    expect(reviews).toHaveLength(5);
    expect(new Set(reviews.map((item: any) => item.contentSnapshot.headword)).size).toBe(5);
    expect(reviews.map((item: any) => item.senseId)).not.toContain('duplicate-sense');
    for (const word of [...old.slice(0, 3), old[6], schoolBlocked]) expect(reviews.some((item: any) => item.senseId === word.senseId)).toBe(false);
  });
  it('a retracted dictation error does not keep priority over other equally due words', async () => {
    const { db, id, old, svc } = setup(5, 3);
    const ordered = [...old].sort((a, b) => a.senseId.localeCompare(b.senseId));
    const word = ordered.at(-1)!;
    for (const [index, isCorrect] of [false, true].entries()) db.seed('learningEvidence', {
      studentId: id, senseId: word.senseId, kind: 'paper_dictation', subject: 'vocab_sense',
      sourceKey: `paper-amend-${index}`, isCorrect, hinted: false, schoolDate: dateOnly('2026-11-04'),
      occurredAt: new Date(`2026-11-04T0${index + 1}:00:00Z`), detail: { rowId: 'paper-row' },
    });
    const daily = await svc.startDailySession(id, sgtNoon(TODAY));
    const review = db.rows('vocabularyV2Session', { id: daily.id })[0].settingsSnapshot.reviewItems;
    expect(review.map((item: any) => item.senseId)).toEqual(ordered.slice(0, 2).map((item) => item.senseId));
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
  it.each([1, 5])('teacher-list day: %i errors take priority and share the three-word review limit', async (count) => {
    const { db, old, learn } = setup(5, 15);
    const errors = old.slice(-count);
    await db.studentVocabularySense.updateMany({ data: { due: dateOnly('2026-08-03') } });
    for (const [index, word] of errors.entries()) {
      await db.learningEvidence.updateMany({ where: { senseId: word.senseId }, data: { isCorrect: false } });
      await db.studentVocabularySense.updateMany({ where: { senseId: word.senseId }, data: { due: dateOnly(['2026-11-03', '2026-11-02', '2026-11-04', TODAY, TODAY][index]) } });
    }
    const fresh = seedOfficialWords(db, 'ngsl', 1801, 5);
    db.seed('vocabularyV2Assignment', { id: 'a', classId: 'class-1', date: dateOnly(TODAY) });
    fresh.forEach((word, index) => db.seed('vocabularyV2AssignmentItem', { assignmentId: 'a', senseId: word.senseId, position: index + 1 }));
    const { daily, formal } = await learn();
    const reviews = db.rows('vocabularyV2Session', { id: daily.id })[0].settingsSnapshot.reviewItems;
    const expected = count === 1 ? errors : [errors[1], errors[0], errors[2]];
    expect(reviews.slice(0, Math.min(3, count)).map((item: any) => item.senseId)).toEqual(expected.map((word) => word.senseId));
    expect(reviews).toHaveLength(3);
    expect(formal).toMatchObject({ total: 8, newWords: 5, reviewWords: 3 });
  });
  it.each([0, 5])('teacher list all previously seen, %i mistakes: fallback keeps the fresh quota and the shared review cap', async (count) => {
    const { db, id, old, svc } = setup(5, 8);
    const errors = count ? old.slice(-count) : [];
    await db.learningEvidence.updateMany({ where: { senseId: { in: errors.map((word) => word.senseId) } }, data: { isCorrect: false } });
    await db.studentVocabularySense.updateMany({ where: { senseId: { in: old.slice(0, 3).map((word) => word.senseId) } }, data: { due: dateOnly('2026-08-03') } });
    db.seed('vocabularyV2Assignment', { id: 'a', classId: 'class-1', date: dateOnly(TODAY) });
    db.seed('vocabularyV2AssignmentItem', { assignmentId: 'a', senseId: old[0].senseId, position: 1 });
    const daily = await svc.startDailySession(id, sgtNoon(TODAY));
    expect(daily.items).toHaveLength(5);
    expect((daily.settings as any).reviewWords).toBe(3);
    if (count) {
      const reviews = db.rows('vocabularyV2Session', { id: daily.id })[0].settingsSnapshot.reviewItems;
      expect(reviews.every((item: any) => errors.some((word) => word.senseId === item.senseId))).toBe(true);
    }
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
