/**
 * S08 配合 · 词汇模块的 GET 必须真的只读（审计 2026-09-11 §5.1 S08）。
 *
 * 教师只读学生视角要放开这些 GET，前提是「完整浏览零写库」。原来
 * `GET /vocab-v2/profile` 和 `GET /vocab-v2/overview` 都会 upsert 一行
 * StudentVocabularyProfile —— 教师看一眼就在学生名下写了库。
 *
 * 做法：先用正常的写接口把各种状态搭出来（进行中的学词、学完待测、已交的正式卷、
 * 进行中的自助练习、生词本、阅读欠账），清空写日志，再把**每一个 GET 背后的
 * 服务方法**都调一遍，写日志必须是空的。以后谁往 GET 里加了写，这里会红。
 */
import { describe, expect, it } from 'vitest';
import { makeService, newDb, seedOfficialWords, seedStudent, sgtNoon } from './testing/vocab-fixtures';

const MON = sgtNoon('2026-09-07');
const TUE = sgtNoon('2026-09-08');

async function populated() {
  const db = newDb();
  const stu = seedStudent(db, { level: 'olevel', dailyTarget: 5, classId: 'class-1' });
  seedOfficialWords(db, 'ngsl', 1801, 40);
  db.seed('wordAudio', { headword: 'x', bytes: new Uint8Array([1, 2, 3]) });
  db.seed('paper', { id: 'paper-1', name: 'Mon reading' });
  db.seed('paperAssignment', { id: 'pa-1', paperId: 'paper-1', classId: 'class-1', assignedById: 't1' });
  db.seed('morningQuizSession', { id: 'mqs-1', paperAssignmentId: 'pa-1', classId: 'class-1', date: new Date('2026-09-07T00:00:00.000Z'), level: 'olevel' });
  const svc = makeService(db);
  // 周一：学完 → 正式卷 → 交卷
  const mon = await svc.startDailySession(stu, MON);
  let last: any;
  for (const item of mon.items) last = await svc.actOnLearningItem(stu, mon.id, item.id, 'normal');
  const test = await svc.testSession(stu, last.generatedTestId);
  for (const item of test.items) await svc.answerTestItem(stu, test.id, item.id, 0);
  await svc.submitTest(stu, test.id);
  // 周二：学了一半
  const tue = await svc.startDailySession(stu, TUE);
  await svc.actOnLearningItem(stu, tue.id, tue.items[0].id, 'normal');
  // 自助练习进行中
  const custom = await svc.startCustomTest(stu, { count: 5, scope: 'all' });
  // 老师
  db.seed('user', { id: 't1', email: 't1@test.invalid', name: 'T', passwordHash: 'x', role: 'admin' });
  // 故意删掉 StudentVocabularyProfile（写接口会建它）：原来 GET 会顺手再建出来
  db.tables.get('studentVocabularyProfile')!.clear();
  return { db, svc, stu, testId: test.id, customId: custom.id, customItemId: custom.items[0].id };
}

describe('S08 词汇 GET 零写库', () => {
  it('学生端每个 GET 背后的服务方法：都不写库（profile 不存在也不建）', async () => {
    const { db, svc, stu, testId, customId, customItemId } = await populated();
    db.resetWrites();
    const profile = await svc.profile(stu);
    expect(profile.dailyTarget).toBe(10);
    await svc.overview(stu, TUE);
    await svc.vocabularyCenter(stu, {});
    await svc.vocabularyCenter(stu, { source: 'level_gap', stage: 'learning', page: 2, pageSize: 5 });
    await svc.search(stu, 'a');
    await svc.dailySession(stu, TUE);
    await svc.dailySession(stu, TUE, '2026-09-07');
    await svc.listFormalTests(stu);
    await svc.testSession(stu, testId);
    await svc.testSession(stu, customId);
    await svc.testItemAudio(stu, customId, customItemId).catch(() => null);
    svc.sourceMeta();
    expect(db.writes).toEqual([]);
    expect(db.rows('studentVocabularyProfile', { studentId: stu })).toHaveLength(0);
  });

  it('教师端 GET（布置列表、班级进度）也不写库', async () => {
    const { db, svc } = await populated();
    db.resetWrites();
    await svc.teacherAssignments({ id: 't1', role: 'admin' }, 'class-1');
    await svc.teacherClassProgress({ id: 't1', role: 'admin' }, 'class-1', TUE);
    expect(db.writes).toEqual([]);
  });
});
