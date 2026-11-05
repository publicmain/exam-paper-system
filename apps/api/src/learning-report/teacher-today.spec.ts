import { describe, expect, it, vi } from 'vitest';
import { LearningReportService } from './learning-report.service';
import { newDb, seedStudent } from '../vocab-v2/testing/vocab-fixtures';
import { dateOnly } from '../common/school-calendar';
import { freezeRedo, redoSourceKey } from '../vocab/reading-redo';

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

describe('当天阅读重做和词测适用性', () => {
  const date = '2026-11-05';
  function learned(db: ReturnType<typeof newDb>, studentId = 's', statuses = ['completed'], reviewWords = 0, status = 'completed') {
    const session = db.seed('vocabularyV2Session', { studentId, date: dateOnly(date), sessionType: 'daily_learning', status, settingsSnapshot: { reviewWords } });
    for (const itemStatus of statuses) db.seed('vocabularyV2SessionItem', { sessionId: session.id, status: itemStatus });
  }
  function redos(db: ReturnType<typeof newDb>, studentId: string, count: number, done: number) {
    for (let i = 0; i < count; i++) {
      const id = `${studentId}-redo-${i}`;
      db.seed('mistakeEntry', { id, studentId, paperQuestionId: `pq-${id}`, createdAt: new Date('2026-11-04T01:00:00Z'),
        redoSnapshot: freezeRedo({ stem: 'Choose.', passage: 'Original.' }, [], { text: 'B' }, 'mcq'),
        resolved: i < done, resolvedAt: i < done ? NOW : null });
      if (i < done) db.seed('learningEvidence', { studentId, subject: 'reading_question', kind: 'mistake_redo',
        sourceKey: redoSourceKey(studentId, id, date), schoolDate: dateOnly(date), isCorrect: true });
    }
  }

  it.each([[0, 0], [3, 0], [3, 1], [3, 3]])('原卷已交，重做 %i 道、完成 %i 道', async (required, done) => {
    const { db, svc, reading } = setup(); reading(date, 80); learned(db, 's', ['skipped']); redos(db, 's', required, done);
    const row = (await svc.today(admin, 'class-1', date, NOW)).students[0];
    const unfinished = done < required;
    expect(row).toMatchObject({ reading: unfinished ? 'in_progress' : 'marked', test: 'not_assigned', unfinished, needsAttention: unfinished,
      reasons: unfinished ? ['阅读错题没重做完'] : [] });
    // 周报仍按原卷交卷统计，不把重做状态写回原卷事实。
    expect((await svc.weekly(admin, { classId: 'class-1' }, NOW)).students[0].readN).toBe(1);
  });

  it('原卷未交时保留「阅读没交」，没有阅读分配时不单独追重做', async () => {
    const { db, svc, reading } = setup(); learned(db, 's', ['skipped']); redos(db, 's', 3, 1);
    expect((await svc.today(admin, 'class-1', date, NOW)).students[0]).toMatchObject({ reading: 'not_assigned', unfinished: false, reasons: [] });
    reading(date);
    expect((await svc.today(admin, 'class-1', date, NOW)).students[0]).toMatchObject({ reading: 'not_started', reasons: ['阅读没交'] });
  });

  it('待批原卷也须完成重做；待批题数继续独立保留', async () => {
    const { db, svc, reading } = setup(); reading(date, undefined, true); learned(db, 's', ['skipped']); redos(db, 's', 3, 1);
    expect((await svc.today(admin, 'class-1', date, NOW)).students[0]).toMatchObject({ reading: 'in_progress', pendingSubjective: 1,
      reasons: ['阅读错题没重做完', '待批 1 题'] });
  });

  it('停课日不追重做，也不追需要但没开始的词测', async () => {
    const { db, svc, reading, close } = setup(); reading(date, 80); learned(db); redos(db, 's', 3, 1); close(date);
    expect((await svc.today(admin, 'class-1', date, NOW)).students[0]).toMatchObject({ noSchoolDay: true, reading: 'marked', unfinished: false, needsAttention: false, reasons: [] });
  });

  it.each([
    { statuses: ['skipped', 'replaced'], reviews: 0, status: 'completed', test: 'not_assigned', missing: false },
    { statuses: [], reviews: 0, status: 'completed', test: 'not_assigned', missing: false },
    { statuses: ['completed'], reviews: 0, status: 'completed', test: 'not_started', missing: true },
    { statuses: ['skipped'], reviews: 1, status: 'completed', test: 'not_started', missing: true },
    { statuses: ['skipped', 'pending'], reviews: 0, status: 'in_progress', test: 'not_started', missing: true },
  ])('词测区分已免除、实际学词、计划复习和未学完：$statuses / $reviews / $status', async ({ statuses, reviews, status, test, missing }) => {
    const { db, svc } = setup(); learned(db, 's', statuses, reviews, status);
    const row = (await svc.today(admin, 'class-1', date, NOW)).students[0];
    expect(row.test).toBe(test);
    expect(row.reasons.includes('词测没交')).toBe(missing);
    expect(row.unfinished).toBe(missing);
  });

  it('尚未建立学词任务时仍需词测；已有词测提交保留', async () => {
    const { db, svc } = setup();
    expect((await svc.today(admin, 'class-1', date, NOW)).students[0].test).toBe('not_started');
    learned(db, 's', ['skipped']);
    db.seed('vocabularyV2Session', { studentId: 's', date: dateOnly(date), sessionType: 'formal_test', status: 'submitted' });
    expect((await svc.today(admin, 'class-1', date, NOW)).students[0].test).toBe('marked');
  });

  it('按指定日期统计重做，不能误用服务器当前日期', async () => {
    const { db, svc, reading } = setup(); reading(date, 80); learned(db, 's', ['skipped']); redos(db, 's', 3, 1);
    expect((await svc.today(admin, 'class-1', date, new Date('2026-11-06T08:00:00Z'))).students[0].reasons).toEqual(['阅读错题没重做完']);
  });

  it('班级由 1 人增加到 12 人时查询次数不变，且查询有学生、日期和分页限制', async () => {
    const counts: number[] = [];
    for (const size of [1, 12]) {
      const { db, svc, reading } = setup(); reading(date, 80); learned(db, 's', ['skipped']); redos(db, 's', 3, 1);
      for (let i = 1; i < size; i++) {
        const studentId = seedStudent(db, { id: `s-${i}` }); learned(db, studentId, ['skipped']); redos(db, studentId, 3, 1);
        db.seed('studentSubmission', { assignmentId: `pa-${date}`, studentId, status: 'marked', totalScore: 80, maxScore: 100, finalSubmittedAt: NOW, submitSource: 'student' });
      }
      const mistakes = vi.spyOn(db.mistakeEntry, 'findMany');
      const evidence = vi.spyOn(db.learningEvidence, 'findMany');
      const sessions = vi.spyOn(db.vocabularyV2Session, 'findMany');
      const report = await svc.today(admin, 'class-1', date, NOW);
      expect(report.students.every((row) => row.reasons.includes('阅读错题没重做完'))).toBe(true);
      expect(mistakes).toHaveBeenCalledTimes(1);
      expect(mistakes.mock.calls[0][0]).toMatchObject({ where: { studentId: { in: expect.any(Array) }, createdAt: { lt: new Date(`${date}T00:00:00+08:00`) } }, take: 500 });
      const redoCalls = evidence.mock.calls.filter(([args]) => (args as any).where.subject === 'reading_question');
      expect(redoCalls).toHaveLength(1);
      expect(redoCalls[0][0]).toMatchObject({ where: { studentId: { in: expect.any(Array) }, schoolDate: dateOnly(date) }, take: 500 });
      counts.push(mistakes.mock.calls.length + evidence.mock.calls.length + sessions.mock.calls.length);
    }
    expect(counts[0]).toBe(counts[1]);
  });
});
