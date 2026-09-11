/**
 * VOC10 · 自助练习临时 session 的取消 / 过期清理与短期结果恢复（审计 2026-09-11 §5.3）。
 *
 * 原症状：开始练习就建一份 custom_test 会话，退出只是跳页 —— 永远留在库里；多次开始留下
 * 多份；交卷立刻删除，结果页一刷新 404，交卷响应丢了就再也拿不回结果。
 *
 * 现在：同一个学生同一时间只有一份进行中的练习（再开始会结束旧的）；可以主动取消；
 * 进行中 6 小时、结果 2 小时后由清理任务删除；交卷后结果在保留期内可反复读取（重复交卷
 * 幂等）；过期了给明确的 v2_practice_expired。全程不写正式成绩、学习总数、教师完成度、SRS。
 */
import { describe, expect, it, vi } from 'vitest';
import { PRACTICE_TTL } from './vocabulary-v2.service';
import { makeService, newDb, seedOfficialWords, seedStudent } from './testing/vocab-fixtures';

// 内存假库逐语句让出事件循环，整套并行跑时单个用例可能超过默认 5 秒；这里只放宽超时，不改断言。
vi.setConfig({ testTimeout: 30_000 });

const T0 = new Date('2026-09-10T02:00:00.000Z');
const later = (ms: number) => new Date(T0.getTime() + ms);

function setup() {
  const db = newDb();
  const stu = seedStudent(db, { level: 'olevel', classId: 'class-1' });
  db.seed('user', { id: 't1', email: 't1@test.invalid', name: 'T', passwordHash: 'x', role: 'admin' });
  const words = seedOfficialWords(db, 'ngsl', 1801, 12);
  for (const word of words) db.seed('studentVocabularySense', { studentId: stu, senseId: word.senseId, reps: 1, masteryStage: 3 });
  const svc = makeService(db);
  return { db, stu, svc };
}

const customSessions = (db: any, stu: string) => db.rows('vocabularyV2Session', { studentId: stu, sessionType: 'custom_test' });

async function answerAll(svc: any, stu: string, session: any, now: Date) {
  for (const item of session.items) await svc.answerTestItem(stu, session.id, item.id, 0, undefined, now);
}

describe('VOC10 自助练习的生命周期', () => {
  it('开始后退出：可以主动取消，库里不留；取消两次也不报错', async () => {
    const { db, stu, svc } = setup();
    const session = await svc.startCustomTest(stu, { count: 5, scope: 'all' }, T0);
    await expect(svc.cancelCustomTest(stu, session.id)).resolves.toEqual({ ok: true, cancelled: true });
    await expect(svc.cancelCustomTest(stu, session.id)).resolves.toEqual({ ok: true, cancelled: false });
    expect(customSessions(db, stu)).toHaveLength(0);
  });

  it('多次开始：只留最新一份进行中的；旧的那份再答题会被明确告知已结束', async () => {
    const { db, stu, svc } = setup();
    const first = await svc.startCustomTest(stu, { count: 5, scope: 'all' }, T0);
    const second = await svc.startCustomTest(stu, { count: 5, scope: 'all' }, later(60_000));
    expect(second.replacedPrevious).toBe(1);
    expect(customSessions(db, stu).map((row: any) => row.id)).toEqual([second.id]);
    await expect(svc.answerTestItem(stu, first.id, first.items[0].id, 0)).rejects.toMatchObject({ response: expect.objectContaining({ code: 'v2_test_not_found' }) });
  });

  it('交卷后刷新 / 交卷响应丢了：保留期内再读、再交都拿到同一份结果', async () => {
    const { stu, svc } = setup();
    const session = await svc.startCustomTest(stu, { count: 5, scope: 'all' }, T0);
    await answerAll(svc, stu, session, later(60_000));
    const submitted = await svc.submitTest(stu, session.id, later(120_000));
    expect(submitted).toEqual(expect.objectContaining({ status: 'submitted', practiceOnly: true }));
    expect(submitted.resultExpiresAt).toBe(later(120_000 + PRACTICE_TTL.resultMs).toISOString());
    const again = await svc.submitTest(stu, session.id, later(180_000));
    expect(again.correct).toBe(submitted.correct);
    const reread = await svc.testSession(stu, session.id, later(PRACTICE_TTL.resultMs));
    expect(reread).toEqual(expect.objectContaining({ status: 'submitted', correct: submitted.correct }));
  });

  it('过期链接：进行中超过 6 小时、结果超过 2 小时 → v2_practice_expired（GET 不写库）；清理任务删掉', async () => {
    const { db, stu, svc } = setup();
    const running = await svc.startCustomTest(stu, { count: 5, scope: 'all' }, T0);
    db.resetWrites();
    await expect(svc.testSession(stu, running.id, later(PRACTICE_TTL.inProgressMs + 1))).rejects.toMatchObject({ response: expect.objectContaining({ code: 'v2_practice_expired' }) });
    expect(db.writes).toEqual([]);
    await expect(svc.answerTestItem(stu, running.id, running.items[0].id, 0, undefined, later(PRACTICE_TTL.inProgressMs + 1))).rejects.toMatchObject({ response: expect.objectContaining({ code: 'v2_practice_expired' }) });

    const done = await svc.startCustomTest(stu, { count: 5, scope: 'all' }, T0);
    await answerAll(svc, stu, done, later(1000));
    await svc.submitTest(stu, done.id, later(2000));
    await expect(svc.testSession(stu, done.id, later(2000 + PRACTICE_TTL.resultMs + 1))).rejects.toMatchObject({ response: expect.objectContaining({ code: 'v2_practice_expired' }) });

    await expect(svc.purgeExpiredCustomTests(later(PRACTICE_TTL.inProgressMs + PRACTICE_TTL.resultMs))).resolves.toEqual({ deleted: 1 });
    expect(customSessions(db, stu)).toHaveLength(0);
  });

  it('全程不写正式成绩、学习总数、掌握度（SRS）、教师完成度，也不进历史成绩', async () => {
    const { db, stu, svc } = setup();
    const before = db.rows('studentVocabularySense', { studentId: stu }).map((row: any) => [row.masteryStage, row.reps, row.spellingSkill, row.due?.getTime?.()]);
    const teacherBefore = await svc.teacherClassProgress({ id: 't1', role: 'admin' }, 'class-1', T0);
    const session = await svc.startCustomTest(stu, { count: 'all', scope: 'all' }, T0);
    await answerAll(svc, stu, session, later(1000));
    await svc.submitTest(stu, session.id, later(2000));
    expect(db.rows('studentVocabularySense', { studentId: stu }).map((row: any) => [row.masteryStage, row.reps, row.spellingSkill, row.due?.getTime?.()])).toEqual(before);
    expect((await svc.listFormalTests(stu)).tests).toEqual([]);
    const teacherAfter = await svc.teacherClassProgress({ id: 't1', role: 'admin' }, 'class-1', T0);
    expect(teacherAfter.students[0].vocabulary).toEqual(teacherBefore.students[0].vocabulary);
    const overview = await svc.overview(stu, T0);
    expect(overview.pendingTests).toEqual([]);
  });
});
