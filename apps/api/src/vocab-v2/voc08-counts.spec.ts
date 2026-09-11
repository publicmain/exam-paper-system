/**
 * VOC08 · 全延后 / 部分延后 / 全换词，计数不混；0 个实际学完不生成空卷、
 * 不留永久待测，教师不等不存在的卷（审计 2026-09-11 §5.3）。
 *
 * 原症状：10 个全部「稍后再学」→ 会话 completed、completed=10、learned=0，
 * 没有正式卷；教师端 todayTest 仍报 pending（等一份永远不会有的考试）；学生端
 * 只看 completed 就宣传「已学 10 个」。
 */
import { describe, expect, it } from 'vitest';
import { makeService, newDb, seedOfficialWords, seedStudent, sgtNoon } from './testing/vocab-fixtures';

const MON = sgtNoon('2026-09-07');
const TEACHER = { id: 't1', role: 'admin' };

async function setup() {
  const db = newDb();
  const stu = seedStudent(db, { level: 'olevel', dailyTarget: 5, classId: 'class-1' });
  db.seed('user', { id: 't1', email: 't1@test.invalid', name: 'T', passwordHash: 'x', role: 'admin' });
  seedOfficialWords(db, 'ngsl', 1801, 40);
  const svc = makeService(db);
  const session = await svc.startDailySession(stu, MON);
  return { db, stu, svc, session };
}

describe('VOC08 学习阶段的计数各是各的', () => {
  it('全部延后：学习阶段结束，但 learned=0、deferred=5，不需要也不生成正式卷；学生和教师都不等卷', async () => {
    const { db, stu, svc, session } = await setup();
    let last: any;
    for (const item of session.items) last = await svc.actOnLearningItem(stu, session.id, item.id, 'skip');
    expect(last.status).toBe('completed');
    expect(last).toEqual(expect.objectContaining({ learned: 0, deferred: 5, processed: 5, pending: 0, replaced: 0, testNeeded: false }));
    expect(last.generatedTest).toBeNull();
    expect(db.rows('vocabularyV2Session', { studentId: stu, sessionType: 'formal_test' })).toHaveLength(0);
    await expect(svc.startFormalTest(stu, session.id)).rejects.toMatchObject({ response: expect.objectContaining({ code: 'v2_no_testable_items' }) });
    const overview = await svc.overview(stu, MON);
    expect(overview.pendingTests).toEqual([]);
    const progress = await svc.teacherClassProgress(TEACHER, 'class-1', MON);
    const row = progress.students[0];
    expect(row.vocabulary.todayTest).toBe('not_needed');
    expect(row.vocabulary.pendingTests).toBe(0);
    expect(row.vocabulary.todayLearned).toBe(0);
    expect(row.vocabulary.todayDeferred).toBe(5);
  });

  it('部分延后：learned=3、deferred=2；正式卷只考这 3 个新词', async () => {
    const { db, stu, svc, session } = await setup();
    let last: any;
    for (const [index, item] of session.items.entries()) last = await svc.actOnLearningItem(stu, session.id, item.id, index < 3 ? 'normal' : 'skip');
    expect(last).toEqual(expect.objectContaining({ learned: 3, deferred: 2, processed: 5, testNeeded: true }));
    expect(last.generatedTest.newWords).toBe(3);
    const formal = db.rows('vocabularyV2Session', { studentId: stu, sessionType: 'formal_test' })[0];
    const newSenses = db.rows('vocabularyV2SessionItem', { sessionId: formal.id }).filter((row: any) => row.source !== 'review').map((row: any) => row.senseId).sort();
    expect(newSenses).toEqual(session.items.slice(0, 3).map((row: any) => row.senseId).sort());
  });

  it('全换词后学完：learned=5、replaced=5；卷里是换上来的新词，不是被换掉的', async () => {
    const { db, stu, svc, session } = await setup();
    const originals = new Set(session.items.map((row: any) => row.senseId));
    for (const item of session.items) await svc.replaceDailyItem(stu, session.id, item.id);
    const replaced = await svc.dailySession(stu, MON);
    let last: any;
    for (const item of replaced!.items) last = await svc.actOnLearningItem(stu, session.id, item.id, 'normal');
    expect(last).toEqual(expect.objectContaining({ learned: 5, replaced: 5, deferred: 0 }));
    const formal = db.rows('vocabularyV2Session', { studentId: stu, sessionType: 'formal_test' })[0];
    const tested = db.rows('vocabularyV2SessionItem', { sessionId: formal.id }).filter((row: any) => row.source !== 'review');
    expect(tested.some((row: any) => originals.has(row.senseId))).toBe(false);
  });

  it('只学了一部分：仍在学习阶段，教师看到剩几个词，不说待测', async () => {
    const { stu, svc, session } = await setup();
    await svc.actOnLearningItem(stu, session.id, session.items[0].id, 'normal');
    const last = await svc.actOnLearningItem(stu, session.id, session.items[1].id, 'skip');
    expect(last).toEqual(expect.objectContaining({ status: 'in_progress', learned: 1, deferred: 1, pending: 3 }));
    const progress = await svc.teacherClassProgress(TEACHER, 'class-1', MON);
    expect(progress.students[0].vocabulary).toEqual(expect.objectContaining({ unfinishedWords: 3, todayTest: 'locked', pendingTests: 0 }));
  });
});
