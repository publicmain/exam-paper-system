import { describe, expect, it } from 'vitest';
import { buildFormalQuestion } from './formal-test';
import { makeService, newDb, seedOfficialWords, seedStudent } from './testing/vocab-fixtures';

const NOW = new Date('2026-11-05T04:00:00.000Z');
const DAY = new Date('2026-11-05T00:00:00.000Z');

function testFixture(type = 'formal_test', count = 1) {
  const db = newDb();
  const studentId = seedStudent(db);
  const words = seedOfficialWords(db, 'ngsl', 1801, count);
  const sessionId = 'test';
  db.seed('vocabularyV2Session', {
    id: sessionId, sessionKey: 'test-key', studentId, date: DAY, sessionType: type,
    mode: 'teacher_list', version: 'v2', target: count, startedAt: NOW, settingsSnapshot: {}, sourceSummary: {},
  });
  const items = words.map((word, index) => {
    const card = { headword: word.headword, pos: 'noun', translation: `词义${index}`, definition: '', audioText: word.headword, sentence: null };
    const id = `item-${index}`;
    db.seed('vocabularyV2SessionItem', {
      id, sessionId, senseId: word.senseId, position: index + 1, source: 'level_gap', masteryBefore: 3,
      contentVersion: 1, contentSnapshot: card, questionSnapshot: buildFormalQuestion(card, 0, [card]),
    });
    return { id, ...word };
  });
  const svc = makeService(db);
  return { db, svc, studentId, sessionId, items };
}

function learningFixture() {
  const db = newDb();
  const studentId = seedStudent(db, { dailyTarget: 5 });
  seedOfficialWords(db, 'ngsl', 1801, 20);
  return { db, studentId, svc: makeService(db) };
}

describe('P1A 首答与正式交卷', () => {
  it('同题并发不同答案：只有首个转换成功，首答、当前答案与唯一记录一致；重试不加次数', async () => {
    const { db, svc, studentId, sessionId, items: [item] } = testFixture();
    await Promise.all([
      svc.answerTestItem(studentId, sessionId, item.id, 'wrong', 25, NOW),
      svc.answerTestItem(studentId, sessionId, item.id, item.headword, 35, new Date(NOW.getTime() + 1)),
    ]);
    const first = db.rows('vocabularyV2SessionItem', { id: item.id })[0];
    expect(first.attempts).toBe(1);
    expect(first.firstResponse).toEqual(first.response);
    expect(first.firstIsCorrect).toBe(first.isCorrect);
    expect(first.firstAnsweredAt).toEqual(first.completedAt);
    const records = db.rows('learningEvidence');
    expect(records).toHaveLength(1);
    expect(records[0]).toMatchObject({
      kind: 'formal_first', subject: 'vocab_sense', studentId, sessionItemId: item.id, senseId: item.senseId,
      sourceKey: `v2item:${item.id}:formal_first`, isCorrect: first.firstIsCorrect, hinted: false, schoolDate: DAY,
      occurredAt: first.firstAnsweredAt,
    });
    await svc.answerTestItem(studentId, sessionId, item.id, item.headword, undefined, NOW);
    expect(db.rows('vocabularyV2SessionItem', { id: item.id })[0]).toEqual(first);
    expect(db.rows('learningEvidence')).toEqual(records);
  });

  it('不同题同时作答，游标只前进，每题各留一条记录', async () => {
    const { db, svc, studentId, sessionId, items } = testFixture('formal_test', 2);
    await Promise.all([...items].reverse().map((item) => svc.answerTestItem(studentId, sessionId, item.id, item.headword, undefined, NOW)));
    expect(db.rows('vocabularyV2Session')[0].cursor).toBe(2);
    expect(db.rows('learningEvidence')).toHaveLength(2);
  });

  it('并发和重复交卷返回相同结果，能力更新每题只执行一次，完成时间不变', async () => {
    const { db, svc, studentId, sessionId, items } = testFixture('formal_test', 2);
    for (const item of items) await svc.answerTestItem(studentId, sessionId, item.id, item.headword, undefined, NOW);
    db.resetWrites();
    const results = await Promise.all([
      svc.submitTest(studentId, sessionId, NOW),
      svc.submitTest(studentId, sessionId, new Date(NOW.getTime() + 1000)),
    ]);
    expect(results[0]).toEqual(results[1]);
    expect(results[0]).toMatchObject({ status: 'submitted', correct: 2, retry: null });
    expect(db.writes.filter((write) => write.model === 'studentVocabularySense')).toHaveLength(2);
    const saved = db.rows('vocabularyV2Session')[0];
    const again = await svc.submitTest(studentId, sessionId, new Date(NOW.getTime() + 2000));
    expect(again).toEqual(results[0]);
    expect(db.rows('vocabularyV2Session')[0]).toEqual(saved);
    expect(db.writes.filter((write) => write.model === 'studentVocabularySense')).toHaveLength(2);
    expect(db.rows('learningEvidence')).toHaveLength(2);
  });

  it('模拟订正重新打开一题：当前答案可变，首答、正式分数、能力与历史不变', async () => {
    const { db, svc, studentId, sessionId, items: [item] } = testFixture();
    await svc.answerTestItem(studentId, sessionId, item.id, 'wrong', undefined, NOW);
    const original = db.rows('vocabularyV2SessionItem')[0];
    await db.vocabularyV2SessionItem.update({ where: { id: item.id }, data: { status: 'pending', hintLevel: 3 } });
    await svc.answerTestItem(studentId, sessionId, item.id, item.headword, undefined, new Date(NOW.getTime() + 1000));
    const corrected = db.rows('vocabularyV2SessionItem')[0];
    expect(corrected).toMatchObject({ response: { value: item.headword }, isCorrect: true, attempts: 2,
      firstResponse: original.firstResponse, firstIsCorrect: false, firstAnsweredAt: NOW });
    expect(db.rows('learningEvidence')).toHaveLength(1);
    expect(db.rows('learningEvidence')[0]).toMatchObject({ isCorrect: false, hinted: false });
    const result = await svc.submitTest(studentId, sessionId, new Date(NOW.getTime() + 2000));
    expect(result.correct).toBe(0);
    expect(result.items[0]).toMatchObject({ response: { value: 'wrong' }, isCorrect: false });
    expect(db.rows('studentVocabularySense')[0]).toMatchObject({ masteryStage: 2, spellingSkill: 0, recallSkill: 0 });
    expect((await svc.listFormalTests(studentId)).tests[0].correct).toBe(0);
  });

  it('旧题没有首答字段时继续用原成绩，不伪造历史首答或记录', async () => {
    const { db, svc, studentId, sessionId, items: [item] } = testFixture();
    await db.vocabularyV2SessionItem.update({ where: { id: item.id }, data: {
      status: 'answered', response: { value: item.headword }, isCorrect: true, completedAt: NOW, attempts: 1,
    } });
    expect((await svc.submitTest(studentId, sessionId, NOW)).correct).toBe(1);
    expect((await svc.listFormalTests(studentId)).tests[0].correct).toBe(1);
    expect(db.rows('vocabularyV2SessionItem')[0].firstAnsweredAt).toBeNull();
    expect(db.rows('learningEvidence')).toEqual([]);
  });

  it('未答完或已取消的测试不能交卷，其他学生不能作答或交卷', async () => {
    const { db, svc, studentId, sessionId, items: [item] } = testFixture();
    await expect(svc.submitTest(studentId, sessionId, NOW)).rejects.toMatchObject({ response: { code: 'v2_test_incomplete', remaining: 1 } });
    await expect(svc.answerTestItem('other', sessionId, item.id, item.headword, undefined, NOW)).rejects.toThrow();
    await expect(svc.submitTest('other', sessionId, NOW)).rejects.toThrow();
    await db.vocabularyV2Session.update({ where: { id: sessionId }, data: { status: 'cancelled' } });
    await expect(svc.submitTest(studentId, sessionId, NOW)).rejects.toMatchObject({ response: { code: 'v2_session_closed' } });
    expect(db.rows('studentVocabularySense')).toEqual([]);
    expect(db.rows('learningEvidence')).toEqual([]);
  });

  it('写记录失败时首答一起回滚，重试能正常保存', async () => {
    const { db, svc, studentId, sessionId, items: [item] } = testFixture();
    const transact = db.$transaction;
    db.$transaction = (run: any) => transact(async (tx: any) => {
      tx.learningEvidence.createMany = async () => { throw new Error('save failed'); };
      return run(tx);
    });
    await expect(svc.answerTestItem(studentId, sessionId, item.id, item.headword, undefined, NOW)).rejects.toThrow('save failed');
    expect(db.rows('vocabularyV2SessionItem')[0]).toMatchObject({ status: 'pending', firstAnsweredAt: null, attempts: 0 });
    expect(db.rows('learningEvidence')).toEqual([]);
    db.$transaction = transact;
    await svc.answerTestItem(studentId, sessionId, item.id, item.headword, undefined, NOW);
    expect(db.rows('learningEvidence')).toHaveLength(1);
  });

  it('能力更新失败时交卷状态一起回滚，重试只完成一次', async () => {
    const { db, svc, studentId, sessionId, items: [item] } = testFixture();
    await svc.answerTestItem(studentId, sessionId, item.id, item.headword, undefined, NOW);
    const scheduled = db.rows('studentVocabularySense');
    const transact = db.$transaction;
    db.$transaction = (run: any) => transact(async (tx: any) => {
      tx.studentVocabularySense.upsert = async () => { throw new Error('skill failed'); };
      return run(tx);
    });
    await expect(svc.submitTest(studentId, sessionId, NOW)).rejects.toThrow('skill failed');
    expect(db.rows('vocabularyV2Session')[0]).toMatchObject({ status: 'in_progress', completedAt: null });
    expect(db.rows('studentVocabularySense')).toEqual(scheduled);
    db.$transaction = transact;
    expect((await svc.submitTest(studentId, sessionId, NOW)).correct).toBe(1);
  });

  it('已有相同来源键时跳过重复插入，不改写已有记录，也不使事务失败', async () => {
    const { db, svc, studentId, sessionId, items: [item] } = testFixture();
    db.seed('learningEvidence', {
      studentId, kind: 'formal_first', subject: 'vocab_sense', senseId: item.senseId, sessionItemId: item.id,
      sourceKey: `v2item:${item.id}:formal_first`, isCorrect: true, hinted: false, schoolDate: DAY, occurredAt: NOW,
    });
    const original = db.rows('learningEvidence');
    await svc.answerTestItem(studentId, sessionId, item.id, item.headword, undefined, NOW);
    expect(db.rows('learningEvidence')).toEqual(original);
    expect(db.rows('vocabularyV2SessionItem')[0]).toMatchObject({ status: 'answered', firstIsCorrect: true, attempts: 1 });
  });

  it.each([
    ['2026-11-04T15:59:59.999Z', '2026-11-04'],
    ['2026-11-04T16:00:00.000Z', '2026-11-05'],
    ['2026-11-04T23:59:59.999Z', '2026-11-05'],
    ['2026-11-05T00:00:00.000Z', '2026-11-05'],
  ])('教学日用作答时的新加坡日期：%s → %s（含补做旧任务）', async (instant, date) => {
    const { db, svc, studentId, sessionId, items: [item] } = testFixture();
    await db.vocabularyV2Session.update({ where: { id: sessionId }, data: { date: new Date('2026-10-30T00:00:00Z') } });
    await db.vocabularyV2SessionItem.update({ where: { id: item.id }, data: { hintLevel: 2 } });
    await svc.answerTestItem(studentId, sessionId, item.id, item.headword, undefined, new Date(instant));
    expect(db.rows('learningEvidence')[0]).toMatchObject({ schoolDate: new Date(`${date}T00:00:00Z`), hinted: true });
  });

  it('自助练习并发作答和交卷保持幂等，不写正式记录也不改能力', async () => {
    const { db, svc, studentId, sessionId, items: [item] } = testFixture('custom_test');
    await Promise.all([1, 2].map(() => svc.answerTestItem(studentId, sessionId, item.id, item.headword, undefined, NOW)));
    const [a, b] = await Promise.all([1, 2].map(() => svc.submitTest(studentId, sessionId, NOW)));
    expect(a).toEqual(b);
    expect(a).toMatchObject({ correct: 1, practiceOnly: true });
    expect(db.rows('learningEvidence')).toEqual([]);
    expect(db.rows('studentVocabularySense')).toEqual([]);
    expect(db.rows('vocabularyV2SessionItem')[0]).toMatchObject({ attempts: 1, firstAnsweredAt: null });
  });
});

describe('P1A 学习卡自报', () => {
  it('跨 UTC 午夜的我会了和换词都按同一新加坡日期记录', async () => {
    const { db, svc, studentId } = learningFixture();
    const daily = await svc.startDailySession(studentId, NOW);
    await svc.actOnLearningItem(studentId, daily.id, daily.items[0].id, 'mastered', undefined, new Date('2026-11-04T23:59:59.999Z'));
    await svc.replaceDailyItem(studentId, daily.id, daily.items[1].id, {}, new Date('2026-11-05T00:00:00.000Z'));
    expect(db.rows('learningEvidence').map((row) => row.schoolDate)).toEqual([DAY, DAY]);
  });
  it('我会了并发双击及重试只记一次，不改变现有阶段和队列行为', async () => {
    const { db, svc, studentId } = learningFixture();
    const daily = await svc.startDailySession(studentId, NOW);
    const item = daily.items[0];
    const [a, b] = await Promise.all([1, 2].map(() => svc.actOnLearningItem(studentId, daily.id, item.id, 'mastered', undefined, NOW)));
    expect([a.replayed, b.replayed].sort()).toEqual([false, true]);
    await svc.actOnLearningItem(studentId, daily.id, item.id, 'mastered', undefined, NOW);
    expect(db.rows('learningEvidence')).toHaveLength(1);
    expect(db.rows('learningEvidence')[0]).toMatchObject({ kind: 'self_report', isCorrect: null, hinted: false,
      senseId: item.senseId, sessionItemId: item.id, detail: { action: 'mastered' }, schoolDate: DAY });
    expect(db.rows('studentVocabularySense', { senseId: item.senseId })[0]).toMatchObject({ masteryStage: 8, reps: 1 });
    expect(db.rows('vocabularyV2SessionItem', { id: item.id })[0].status).toBe('completed');
  });

  it('同卡并发换词及旧词重试只记一次；之后再换新词或点我会了仍各记一条', async () => {
    const { db, svc, studentId } = learningFixture();
    const daily = await svc.startDailySession(studentId, NOW);
    const item = daily.items[0];
    const options = { expectedSenseId: item.senseId };
    await Promise.all([1, 2].map(() => svc.replaceDailyItem(studentId, daily.id, item.id, options, NOW)));
    await svc.replaceDailyItem(studentId, daily.id, item.id, options, NOW);
    expect(db.rows('learningEvidence')).toHaveLength(1);
    const replacement = db.rows('vocabularyV2SessionItem', { id: item.id })[0];
    expect(replacement.senseId).not.toBe(item.senseId);
    expect(db.rows('learningEvidence')[0]).toMatchObject({ senseId: item.senseId, kind: 'self_report', isCorrect: null, detail: { action: 'replace', replacementSenseId: replacement.senseId } });
    expect(db.rows('studentVocabularySense', { senseId: item.senseId })[0]).toMatchObject({ masteryStage: 8, inNotebook: false });
    await svc.replaceDailyItem(studentId, daily.id, item.id, { expectedSenseId: replacement.senseId }, NOW);
    await svc.actOnLearningItem(studentId, daily.id, item.id, 'mastered', undefined, NOW);
    expect(db.rows('learningEvidence')).toHaveLength(3);
    expect(new Set(db.rows('learningEvidence').map((row) => row.sourceKey)).size).toBe(3);
    expect(db.rows('vocabularyV2SessionItem', { sessionId: daily.id })).toHaveLength(daily.target);
  });

  it('无词可换时没有自报记录，原词和队列保留', async () => {
    const db = newDb();
    const studentId = seedStudent(db, { dailyTarget: 5 });
    seedOfficialWords(db, 'ngsl', 1801, 5);
    const svc = makeService(db);
    const daily = await svc.startDailySession(studentId, NOW);
    const before = db.rows('vocabularyV2SessionItem');
    await expect(svc.replaceDailyItem(studentId, daily.id, daily.items[0].id)).rejects.toMatchObject({ response: { code: 'v2_replacement_exhausted' } });
    expect(db.rows('learningEvidence')).toEqual([]);
    expect(db.rows('vocabularyV2SessionItem')).toEqual(before);
  });

  it('普通学完、有点难、稍后再学都不冒充自报或正式作答', async () => {
    const { db, svc, studentId } = learningFixture();
    const daily = await svc.startDailySession(studentId, NOW);
    for (const [index, action] of (['normal', 'hard', 'skip'] as const).entries()) {
      await svc.actOnLearningItem(studentId, daily.id, daily.items[index].id, action, undefined, NOW);
    }
    expect(db.rows('learningEvidence')).toEqual([]);
  });
});
