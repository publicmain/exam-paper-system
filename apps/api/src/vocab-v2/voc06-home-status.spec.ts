/**
 * VOC06 · 正式卷生成后以冻结 items/target 为唯一事实 + 首页三项任务状态（UI13/UI14 的后端事实）。
 *
 * VOC06 原症状：首页待测卡片的 total、教师的 pendingTestWords 都从「当天学完几个新词」推算，
 * 正式卷其实是「新词 + 最多 3 个旧词抽查」—— 卷子 13 题，页面写 10。
 *
 * 首页原来只给 today（每日学词会话）+ 三个欠账列表，前端只能自己猜「阅读 / 学词 / 正式词测」
 * 各自是不适用、没生成、待做还是做完了，于是把「阅读完成 + 学词完成」当成 2/2 全部完成（UI14）。
 */
import { describe, expect, it } from 'vitest';
import { makeService, newDb, seedOfficialWords, seedStudent, sgtNoon } from './testing/vocab-fixtures';

const TEACHER = { id: 't1', role: 'admin' };
const MON = sgtNoon('2026-09-07');
const TUE = sgtNoon('2026-09-08');
const SAT = sgtNoon('2026-09-12');

function setup(dailyTarget = 5) {
  const db = newDb();
  db.seed('user', { id: 't1', email: 't1@test.invalid', name: 'T', passwordHash: 'x', role: 'admin' });
  const stu = seedStudent(db, { level: 'olevel', dailyTarget, classId: 'class-1' });
  seedOfficialWords(db, 'ngsl', 1801, 60);
  const svc = makeService(db);
  return { db, stu, svc };
}

/** 学生名下 k 个「以前学过、可以被抽查」的旧词。 */
function seedOldLearned(db: any, stu: string, k: number) {
  const words = seedOfficialWords(db, 'ngsl', 1001, k);
  for (const word of words) db.seed('studentVocabularySense', { studentId: stu, senseId: word.senseId, reps: 1, masteryStage: 3 });
}

async function learnAll(svc: any, stu: string, now: Date) {
  const session = await svc.startDailySession(stu, now);
  let last: any;
  for (const item of session.items) last = await svc.actOnLearningItem(stu, session.id, item.id, 'normal');
  return { session, last };
}

function seedReading(db: any, day: string, level = 'olevel') {
  const id = `pa-${day}-${level}`;
  db.seed('paper', { id: `paper-${id}`, name: `${day} reading` });
  db.seed('paperAssignment', { id, paperId: `paper-${id}`, classId: 'class-1', assignedById: 't1' });
  db.seed('morningQuizSession', { id: `mqs-${id}`, paperAssignmentId: id, classId: 'class-1', date: new Date(`${day}T00:00:00.000Z`), level, status: 'active' });
  return id;
}

describe('VOC06 冻结卷是唯一事实（旧词 0 / 1 / 2 / 3 个）', () => {
  for (const k of [0, 1, 2, 3]) {
    it(`学完 5 个新词 + ${k} 个旧词可抽：学完提示、试卷、首页、教师都是 ${5 + k} 题`, { timeout: 30_000 }, async () => {
      const { db, stu, svc } = setup();
      seedOldLearned(db, stu, k);
      const { last } = await learnAll(svc, stu, MON);
      expect(last.generatedTest).toEqual(expect.objectContaining({ total: 5 + k, newWords: 5, reviewWords: k }));
      const test = await svc.testSession(stu, last.generatedTestId);
      expect(test.total).toBe(5 + k);
      expect(test.items).toHaveLength(5 + k);
      const overview = await svc.overview(stu, MON);
      expect(overview.pendingTests).toEqual([expect.objectContaining({ total: 5 + k, newWords: 5, reviewWords: k, generated: true })]);
      expect(overview.home.test).toEqual(expect.objectContaining({ state: 'pending', total: 5 + k, newWords: 5, reviewWords: k }));
      const teacher = (await svc.teacherClassProgress(TEACHER, 'class-1', MON)).students[0].vocabulary;
      expect(teacher).toEqual(expect.objectContaining({ pendingTests: 1, pendingTestWords: 5 + k, todayTestQuestions: 5 + k }));
    });
  }

  it('还没生成（学完回调没来得及建卷）：不报一个猜的总数，给「预计新词 N + 最多 3 个旧词」', async () => {
    const { db, stu, svc } = setup();
    const { session } = await learnAll(svc, stu, MON);
    for (const row of db.rows('vocabularyV2Session', { sessionType: 'formal_test' })) await db.vocabularyV2Session.delete({ where: { id: row.id } });
    const overview = await svc.overview(stu, MON);
    expect(overview.pendingTests).toEqual([expect.objectContaining({ dailySessionId: session.id, generated: false, total: null, expectedNewWords: 5, reviewWordsMax: 3 })]);
    expect(overview.home.test).toEqual(expect.objectContaining({ state: 'not_generated', reason: 'ready_to_generate' }));
  });

  it('已开始 / 已交的旧卷不因后来有了更多可抽旧词而重建', async () => {
    const { db, stu, svc } = setup();
    const { session, last } = await learnAll(svc, stu, MON);
    const test = await svc.testSession(stu, last.generatedTestId);
    await svc.answerTestItem(stu, test.id, test.items[0].id, 0);
    seedOldLearned(db, stu, 3);
    const again = await svc.startFormalTest(stu, session.id);
    expect(again.id).toBe(test.id);
    expect(again.total).toBe(test.total);
    expect(db.rows('vocabularyV2SessionItem', { sessionId: test.id })).toHaveLength(test.total);
  });
});

describe('首页三项任务的后端事实（UI13 / UI14）', () => {
  it('周末：三项都不适用', async () => {
    const { stu, svc } = setup();
    const overview = await svc.overview(stu, SAT);
    expect(overview.home).toEqual(expect.objectContaining({
      teachingDay: false,
      reading: expect.objectContaining({ state: 'not_applicable', reason: 'weekend' }),
      words: expect.objectContaining({ state: 'not_applicable', reason: 'weekend' }),
      test: expect.objectContaining({ state: 'not_applicable' }),
    }));
  });

  it('教学日开门时：阅读没发布 → 尚未生成（给原因）；每日新词还没建 → 尚未生成（给生成条件）；测试 → 学完后生成', async () => {
    const { stu, svc } = setup();
    const overview = await svc.overview(stu, MON);
    expect(overview.home.reading).toEqual(expect.objectContaining({ state: 'not_generated', reason: 'no_session_published' }));
    expect(overview.home.words).toEqual(expect.objectContaining({ state: 'not_generated', generation: expect.objectContaining({ condition: expect.any(String) }) }));
    expect(overview.home.test).toEqual(expect.objectContaining({ state: 'not_generated', reason: 'no_word_task_yet' }));
  });

  it('阅读完成 + 学词完成 + 正式词测还没交：三项分别是 待批 / 完成 / 待完成，不是全完成', async () => {
    const { db, stu, svc } = setup();
    const readingId = seedReading(db, '2026-09-07');
    const sub = db.seed('studentSubmission', { assignmentId: readingId, studentId: stu, status: 'submitted', finalSubmittedAt: new Date('2026-09-07T03:00:00.000Z'), submitSource: 'student' });
    db.seed('answerScript', { submissionId: sub.id });
    await learnAll(svc, stu, MON);
    const overview = await svc.overview(stu, MON);
    expect(overview.home.reading).toEqual(expect.objectContaining({ state: 'awaiting_marking', assignmentId: readingId }));
    expect(overview.home.words).toEqual(expect.objectContaining({ state: 'completed', learned: 5, deferred: 0 }));
    expect(overview.home.test).toEqual(expect.objectContaining({ state: 'pending' }));
    expect(overview.home.allDone).toBe(false);
  });

  it('全部稍后再学：学词阶段完成，但测试是「不适用（没有学完的词）」，不是待完成', async () => {
    const { stu, svc } = setup();
    const session = await svc.startDailySession(stu, MON);
    for (const item of session.items) await svc.actOnLearningItem(stu, session.id, item.id, 'skip');
    const overview = await svc.overview(stu, MON);
    expect(overview.home.words).toEqual(expect.objectContaining({ state: 'completed', learned: 0, deferred: 5 }));
    expect(overview.home.test).toEqual(expect.objectContaining({ state: 'not_applicable', reason: 'nothing_learned' }));
  });

  it('测试答了一半 → 进行中；交卷 → 完成', async () => {
    const { stu, svc } = setup();
    const { last } = await learnAll(svc, stu, MON);
    const test = await svc.testSession(stu, last.generatedTestId);
    await svc.answerTestItem(stu, test.id, test.items[0].id, 0);
    expect((await svc.overview(stu, MON)).home.test).toEqual(expect.objectContaining({ state: 'in_progress', answered: 1 }));
    for (const item of test.items.slice(1)) await svc.answerTestItem(stu, test.id, item.id, 0);
    await svc.submitTest(stu, test.id);
    expect((await svc.overview(stu, MON)).home.test).toEqual(expect.objectContaining({ state: 'completed' }));
  });

  it('按日期的旧待办：阅读 / 新词 / 测试分别欠多少', async () => {
    const { db, stu, svc } = setup();
    seedReading(db, '2026-09-07');
    const mon = await svc.startDailySession(stu, MON);
    await svc.actOnLearningItem(stu, mon.id, mon.items[0].id, 'normal');
    const overview = await svc.overview(stu, TUE);
    expect(overview.backlogByDate).toEqual([{ date: '2026-09-07', reading: 1, words: 1, test: 0 }]);
    expect(overview.backlogTotals).toEqual({ reading: 1, words: 1, test: 0 });
  });
});
