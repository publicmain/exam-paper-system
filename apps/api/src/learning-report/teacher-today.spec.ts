import { describe, expect, it } from 'vitest';
import { LearningReportService } from './learning-report.service';
import { newDb, seedStudent } from '../vocab-v2/testing/vocab-fixtures';
import { dateOnly } from '../common/school-calendar';

const admin = { id: 'a', role: 'admin' }; const NOW = new Date('2026-11-05T08:00:00Z');
function setup() {
  const db = newDb(); const id = seedStudent(db, { id: 's', name: '演示学生' });
  db.seed('classEnrollment', { classId: 'class-1', userId: 't', role: 'class_teacher' });
  const svc = new LearningReportService(db as never);
  function reading(date: string, score?: number, pending = false) {
    const paperId = `paper-${date}`; const assignmentId = `pa-${date}`;
    db.seed('paper', { id: paperId, name: '练习阅读' });
    db.seed('paperAssignment', { id: assignmentId, paperId, classId: 'class-1' });
    db.seed('morningQuizSession', { paperAssignmentId: assignmentId, classId: 'class-1', date: dateOnly(date), level: 'olevel' });
    if (score !== undefined || pending) {
      const submissionId = `sub-${date}`;
      db.seed('studentSubmission', { id: submissionId, assignmentId, studentId: id, status: pending ? 'submitted' : 'marked', totalScore: score ?? null, maxScore: 100, finalSubmittedAt: NOW, submitSource: 'student' });
      if (pending) {
        db.seed('question', { id: 'q', questionType: 'short_answer' });
        db.seed('paperQuestion', { id: 'pq', paperId, questionId: 'q' });
        db.seed('answerScript', { submissionId, paperQuestionId: 'pq' });
      }
    }
  }
  function close(date: string, classId = 'class-1') { db.seed('classNoSchoolDay', { classId, date: dateOnly(date), createdById: 't' }); }
  return { db, id, svc, reading, close };
}
describe('老师今天该找谁（共用周报事实）', () => {
  it('他班老师和学生不可读；本班任课 / 班主任可读', async () => {
    const { svc } = setup();
    for (const role of ['teacher', 'student']) await expect(svc.today({ id: 'outsider', role }, 'class-1', undefined, NOW)).rejects.toMatchObject({ status: 403 });
    expect((await svc.today({ id: 't', role: 'teacher' }, 'class-1', undefined, NOW)).students).toHaveLength(1);
  });
  it('三项状态、历史待批题数和份数、严格低于50%、本周提醒均取真实记录', async () => {
    const { db, svc, reading } = setup();
    reading('2026-10-15', undefined, true); // pending older than recent three teaching days
    reading('2026-11-03', 49.99); reading('2026-11-04', 50); reading('2026-11-05');
    db.seed('vocabularyV2Session', { studentId: 's', date: dateOnly('2026-11-05'), sessionType: 'daily_learning', status: 'completed' });
    const test = db.seed('vocabularyV2Session', { studentId: 's', date: dateOnly('2026-11-05'), sessionType: 'formal_test', status: 'submitted' });
    for (let i = 0; i < 2; i++) db.seed('vocabularyV2SessionItem', { sessionId: test.id, isCorrect: i === 0 });
    db.seed('notification', { userId: 's', type: 'effort_warning', createdAt: new Date('2026-11-01T16:00:00Z') });
    const r = await svc.today(admin, 'class-1', undefined, NOW);
    expect(r.students[0]).toMatchObject({ reading: 'not_started', words: 'submitted', test: 'marked', lowReadingCount: 1, lowTestCount: 0, warnedThisWeek: true, pendingSubjective: 1 });
    expect(r.totals).toEqual({ unfinished: 1, pending: 1, attention: 1 });
    expect(r.students[0].pendingSubmissions).toEqual(['sub-2026-10-15']);
  });
  it('停课日免除三项待办；历史分数保留、周报分母剔除', async () => {
    const { svc, reading, close } = setup();
    reading('2026-11-03', 80); close('2026-11-03'); reading('2026-11-04'); close('2026-11-04'); reading('2026-11-05'); close('2026-11-05');
    const r = await svc.today(admin, 'class-1', undefined, NOW);
    expect(r).toMatchObject({ noSchoolDay: true, totals: { unfinished: 0 } });
    expect(r.students[0]).toMatchObject({ noSchoolDay: true, lowReadingCount: 0, reasons: [] });
    const week = await svc.weekly(admin, { classId: 'class-1' }, NOW);
    expect(week.students[0]).toMatchObject({ readDue: 0, readN: 1, readAvg: null });
    expect(week.totals.readRate).toBeNull();
    expect(week.byLevel[0]).toMatchObject({ due: 0, done: 0, readAvg: null, readRate: null });
    expect(week.followUps.readingNoWords).toEqual([]);
  });
  it('多班有一个正常上课就仍需做；其他班停课后才免除', async () => {
    const { db, svc, reading, close } = setup(); reading('2026-11-05'); close('2026-11-05');
    db.seed('class', { id: 'other' }); db.seed('classEnrollment', { classId: 'other', userId: 's', joinedAt: dateOnly('2026-11-01') });
    expect((await svc.today(admin, 'class-1', undefined, NOW)).students[0]).toMatchObject({ noSchoolDay: false, unfinished: true });
    close('2026-11-05', 'other');
    expect((await svc.today(admin, 'class-1', undefined, NOW)).students[0]).toMatchObject({ noSchoolDay: true, unfinished: false });
  });
  it('新加坡午夜日期、本周提醒边界；空班返回零', async () => {
    const { db, svc } = setup();
    db.seed('notification', { userId: 's', type: 'effort_warning', createdAt: new Date('2026-11-01T15:59:59Z') });
    expect((await svc.today(admin, 'class-1', undefined, new Date('2026-11-04T15:59:59Z'))).date).toBe('2026-11-04');
    const r = await svc.today(admin, 'class-1', undefined, new Date('2026-11-04T16:00:00Z'));
    expect(r.date).toBe('2026-11-05'); expect(r.students[0].warnedThisWeek).toBe(false);
    db.seed('class', { id: 'empty' });
    expect(await svc.today(admin, 'empty', undefined, NOW)).toMatchObject({ students: [], totals: { unfinished: 0, pending: 0, attention: 0 } });
    await expect(svc.today(admin, 'class-1', '2026-02-30', NOW)).rejects.toMatchObject({ status: 400 });
  });
  it('最近三个教学日可跨长假，不把停课低分算进去', async () => {
    const { svc, reading, close } = setup();
    reading('2026-10-29', 20); reading('2026-10-30', 20); reading('2026-11-02', 20);
    for (const d of ['2026-11-02', '2026-11-03', '2026-11-04', '2026-11-05']) close(d);
    const r = await svc.today(admin, 'class-1', undefined, NOW);
    expect(r.students[0].lowReadingDates).toEqual(['2026-10-30', '2026-10-29']);
  });
});
