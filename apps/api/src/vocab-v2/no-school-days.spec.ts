import { describe, expect, it, vi } from 'vitest';
import { makeService, newDb, seedOfficialWords, seedStudent, sgtNoon } from './testing/vocab-fixtures';
import { dateOnly } from '../common/school-calendar';
import { VocabularyV2DailyTaskCron } from './daily-task.cron';

function setup() {
  const db = newDb(); const id = seedStudent(db); seedOfficialWords(db, 'ngsl', 1801, 30);
  const svc = makeService(db);
  const close = (date: string, classId = 'class-1') => db.seed('classNoSchoolDay', { classId, date: dateOnly(date), createdById: 't' });
  return { db, id, svc, close };
}
describe('停课日词汇任务', () => {
  it('并发开始均不建任务、不推进游标，随后上课日照常排', async () => {
    const { db, svc, id, close } = setup(); close('2026-11-05');
    const results = await Promise.allSettled([svc.startDailySession(id, sgtNoon('2026-11-05')), svc.startDailySession(id, sgtNoon('2026-11-05'))]);
    expect(results.every((r) => r.status === 'rejected')).toBe(true);
    expect(db.rows('studentVocabularyCursor')).toHaveLength(0); expect(db.rows('vocabularyV2Session')).toHaveLength(0);
    await svc.startDailySession(id, sgtNoon('2026-11-06'));
    expect(db.rows('vocabularyV2Session')).toHaveLength(1);
  });
  it('已有未完任务和阅读免欠，已做照样保留，可重复读取', async () => {
    const { db, svc, id, close } = setup();
    const task = await svc.startDailySession(id, sgtNoon('2026-11-05')); close('2026-11-05');
    const cursor = db.rows('studentVocabularyCursor');
    const again = await svc.startDailySession(id, sgtNoon('2026-11-05'));
    expect(again.id).toBe(task.id); expect(db.rows('studentVocabularyCursor')).toEqual(cursor);
    db.seed('paper', { id: 'p' }); db.seed('paperAssignment', { id: 'pa', classId: 'class-1', paperId: 'p' });
    db.seed('morningQuizSession', { classId: 'class-1', paperAssignmentId: 'pa', date: dateOnly('2026-11-05') });
    const home = await svc.overview(id, sgtNoon('2026-11-05'));
    expect(home.home).toMatchObject({ noSchoolDay: true, teachingDay: false, reading: { state: 'not_applicable' }, words: { state: 'not_applicable' }, test: { state: 'not_applicable' }, allDone: true });
    const later = await svc.overview(id, sgtNoon('2026-11-06'));
    expect(later.backlogTotals).toEqual({ reading: 0, words: 0, test: 0 });
    expect(db.rows('vocabularyV2Session')).toHaveLength(1);
  });
  it('已经学完但没词测的停课日也不提醒；已交成绩不变', async () => {
    const { db, svc, id, close } = setup(); const task = await svc.startDailySession(id, sgtNoon('2026-11-05'));
    await db.vocabularyV2Session.update({ where: { id: task.id }, data: { status: 'completed' } });
    await db.vocabularyV2SessionItem.updateMany({ where: { sessionId: task.id }, data: { status: 'completed' } });
    close('2026-11-05');
    expect((await svc.overview(id, sgtNoon('2026-11-06'))).pendingTests).toEqual([]);
    expect((await svc.overview(id, sgtNoon('2026-11-05'))).home.words.state).toBe('completed');
  });
  it('多班有一个没停课仍生成；定时任务略过全部停课学生', async () => {
    const { db, svc, id, close } = setup(); close('2026-11-05');
    vi.stubEnv('STUDENT_APP_V2', 'on');
    try {
      const startDailySession = vi.fn(); const cron = new VocabularyV2DailyTaskCron(db as never, { startDailySession } as never);
      await cron.provision(sgtNoon('2026-11-05')); expect(startDailySession).not.toHaveBeenCalled();
      db.seed('class', { id: 'second' }); db.seed('classEnrollment', { classId: 'second', userId: id, joinedAt: dateOnly('2026-11-01') });
      await svc.startDailySession(id, sgtNoon('2026-11-05')); expect(db.rows('vocabularyV2Session')).toHaveLength(1);
    } finally { vi.unstubAllEnvs(); }
  });
});
