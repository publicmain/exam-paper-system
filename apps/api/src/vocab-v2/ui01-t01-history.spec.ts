/**
 * UI01 · 改当前难度不重算历史欠阅读 + T01 · 教师统计排除已取消场次（审计 2026-09-11）。
 *
 * 原症状：
 *   · 学生首页 readingBacklog 和教师 teacherClassProgress 都拿**现在的** englishLevel 去
 *     匹配过去的场次：A 档未做 / 做一半的欠账一改到 B 档就消失，又冒出当时没分配过的 B 档欠账；
 *   · 教师统计不排除 cancelled 场次，学生端排除 —— 学生做不了的卷在老师那里算欠交。
 *
 * 口径（level-timeline.ts）：有答卷 = 事实；没答卷按「那天结束时的档位」（改档记录）；
 * 今天按现在的档位；取消未交不算、已交留档；入班前不算。学生和教师共用同一个函数。
 */
import { describe, expect, it, vi } from 'vitest';
import { makeService, newDb, seedStudent, sgtNoon } from './testing/vocab-fixtures';

// 内存假库逐语句让出事件循环，整套并行跑时单个用例可能超过默认 5 秒；这里只放宽超时，不改断言。
vi.setConfig({ testTimeout: 30_000 });

const TEACHER = { id: 't1', role: 'admin' };
const A = 'olevel';
const B = 'ielts_authentic';
const DAYS = ['2026-09-07', '2026-09-08', '2026-09-09', '2026-09-10', '2026-09-11'];

function seedReadings(db: any, classId = 'class-1', levels = [A, B], days = DAYS) {
  for (const day of days) {
    for (const level of levels) {
      const id = `pa-${classId}-${day}-${level}`;
      db.seed('paper', { id: `paper-${id}`, name: `${day} ${level}` });
      db.seed('paperAssignment', { id, paperId: `paper-${id}`, classId, assignedById: 't1' });
      db.seed('morningQuizSession', { id: `mqs-${id}`, paperAssignmentId: id, classId, date: new Date(`${day}T00:00:00.000Z`), level, status: 'active' });
    }
  }
}
const pa = (day: string, level: string, classId = 'class-1') => `pa-${classId}-${day}-${level}`;

function setup(input: { joinedAt?: Date } = {}) {
  const db = newDb();
  db.seed('user', { id: 't1', email: 't1@test.invalid', name: 'T', passwordHash: 'x', role: 'admin' });
  const stu = seedStudent(db, { level: A, classId: 'class-1', joinedAt: input.joinedAt ?? new Date('2026-08-31T00:00:00.000Z') });
  seedReadings(db);
  const svc = makeService(db);
  return { db, stu, svc };
}

/** 模拟学生在账号设置里改档（student-auth setEnglishLevel 做的两件事）。 */
async function changeLevel(db: any, stu: string, to: string, at: Date) {
  const before = db.rows('user', { id: stu })[0].englishLevel;
  await db.user.update({ where: { id: stu }, data: { englishLevel: to } });
  db.seed('studentLevelChange', { studentId: stu, fromLevel: before, toLevel: to, source: 'student_self', changedAt: at });
}

function submission(db: any, stu: string, assignmentId: string, kind: 'in_progress' | 'final' | 'submitted_final') {
  const row = db.seed('studentSubmission', {
    assignmentId,
    studentId: stu,
    status: kind === 'submitted_final' ? 'submitted' : kind === 'final' ? 'marked' : 'in_progress',
    finalSubmittedAt: kind === 'in_progress' ? null : new Date('2026-09-09T05:00:00.000Z'),
    submitSource: kind === 'in_progress' ? null : 'student',
  });
  db.seed('answerScript', { submissionId: row.id });
  return row;
}

const backlogIds = (overview: any) => overview.readingBacklog.map((row: any) => row.assignmentId);
/** 历史事实本身（依据 levelBasis 可以随记录变化，事实不能） */
const facts = (overview: any) => overview.readingBacklog.map(({ assignmentId, sessionId, submissionId, date, title, status, level }: any) => ({ assignmentId, sessionId, submissionId, date, title, status, level }));

describe('UI01 改档不重算历史', () => {
  it('A 档未做 / 做一半 / 已完成各一份：改到 B 后，文章、档位、草稿、状态都不变；教师与学生欠账一致', async () => {
    const { db, stu, svc } = setup();
    submission(db, stu, pa('2026-09-08', A), 'in_progress');
    submission(db, stu, pa('2026-09-09', A), 'final');
    const THU = sgtNoon('2026-09-10');
    const before = await svc.overview(stu, THU);
    expect(backlogIds(before)).toEqual([pa('2026-09-07', A), pa('2026-09-08', A)]);

    await changeLevel(db, stu, B, new Date('2026-09-10T02:00:00.000Z'));
    const after = await svc.overview(stu, THU);
    expect(facts(after)).toEqual(facts(before));
    expect(after.readingBacklog.map((row: any) => [row.level, row.status])).toEqual([[A, 'not_started'], [A, 'in_progress']]);

    const teacher = (await svc.teacherClassProgress(TEACHER, 'class-1', THU)).students[0].reading;
    expect(teacher.overdue).toBe(after.readingBacklog.length);
    expect(teacher.completed).toBe(1);
    // 今天（周四）还没开始 → 按现在的档位，是 B 档那份
    expect(after.home.reading).toEqual(expect.objectContaining({ state: 'pending', assignmentId: pa('2026-09-10', B), level: B }));
  });

  it('改档当天没开始的那份，从第二天起按改档后的档位欠（下次新分配为 B），改档前的日子仍是 A', async () => {
    const { db, stu, svc } = setup();
    await changeLevel(db, stu, B, new Date('2026-09-09T03:00:00.000Z')); // 周三 11:00 SGT
    const fri = await svc.overview(stu, sgtNoon('2026-09-11'));
    expect(backlogIds(fri)).toEqual([pa('2026-09-07', A), pa('2026-09-08', A), pa('2026-09-09', B), pa('2026-09-10', B)]);
    expect(fri.readingBacklog.map((row: any) => row.levelBasis)).toEqual(['before_first_record', 'before_first_record', 'level_log', 'level_log']);
  });

  it('入班前的场次不算；从来没有改档记录时按现在的档位（旧口径，标 current）', async () => {
    const { stu, svc } = setup({ joinedAt: new Date('2026-09-08T01:00:00.000Z') });
    const fri = await svc.overview(stu, sgtNoon('2026-09-11'));
    expect(backlogIds(fri)).toEqual([pa('2026-09-08', A), pa('2026-09-09', A), pa('2026-09-10', A)]);
    expect(new Set(fri.readingBacklog.map((row: any) => row.levelBasis))).toEqual(new Set(['current']));
    const teacher = (await svc.teacherClassProgress(TEACHER, 'class-1', sgtNoon('2026-09-11'))).students[0].reading;
    expect(teacher.overdue).toBe(3);
  });

  it('改档前在 B 档那份卷上已经有答卷（先改到 B 做了一半又改回 A）：那天认答卷，不另算 A 档', async () => {
    const { db, stu, svc } = setup();
    submission(db, stu, pa('2026-09-08', B), 'in_progress');
    const thu = await svc.overview(stu, sgtNoon('2026-09-10'));
    expect(backlogIds(thu)).toEqual([pa('2026-09-07', A), pa('2026-09-08', B), pa('2026-09-09', A)]);
    expect(thu.readingBacklog[1]).toEqual(expect.objectContaining({ levelBasis: 'submission', status: 'in_progress' }));
  });
});

describe('T01 取消的场次', () => {
  it('取消且没做：学生和教师都不算欠；取消前已交：教师留档算完成、不算欠；两边欠账数相同', async () => {
    const { db, stu, svc } = setup();
    db.rows('morningQuizSession', { paperAssignmentId: pa('2026-09-07', A) });
    await db.morningQuizSession.update({ where: { id: `mqs-${pa('2026-09-07', A)}` }, data: { status: 'cancelled' } });
    submission(db, stu, pa('2026-09-08', A), 'final');
    await db.morningQuizSession.update({ where: { id: `mqs-${pa('2026-09-08', A)}` }, data: { status: 'cancelled' } });
    const THU = sgtNoon('2026-09-10');
    const student = await svc.overview(stu, THU);
    expect(backlogIds(student)).toEqual([pa('2026-09-09', A)]);
    const teacher = (await svc.teacherClassProgress(TEACHER, 'class-1', THU)).students[0].reading;
    expect(teacher).toEqual(expect.objectContaining({ overdue: 1, completed: 1, cancelledArchived: 1 }));
    expect(teacher.overdue).toBe(student.readingBacklog.length);
  });
});
