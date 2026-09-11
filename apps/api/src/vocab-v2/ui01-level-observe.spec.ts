/**
 * UI01 · 档位记录的兜底（教师在花名册改档、首次落定都不经过 student-auth）。
 *
 * 词汇 cron 每 10 分钟对一次「记录里最后的档位」和「现在的档位」：
 *   · 从没记录过 → baseline；
 *   · 不一样 → observed（fromLevel = 记录里最后那档，时间 = 发现时刻）；
 *   · 学生自己改档已同步写了记录 → 一致，不重复。
 */
import { afterEach, describe, expect, it, vi } from 'vitest';
import { VocabularyV2DailyTaskCron } from './daily-task.cron';
import { makeService, newDb, seedStudent, sgtNoon } from './testing/vocab-fixtures';

const originalFlag = process.env.STUDENT_APP_V2;
afterEach(() => {
  if (originalFlag === undefined) delete process.env.STUDENT_APP_V2;
  else process.env.STUDENT_APP_V2 = originalFlag;
});

function setup() {
  const db = newDb();
  const stu = seedStudent(db, { id: 'stu-a', level: 'olevel', classId: 'class-1' });
  seedStudent(db, { id: 'stu-null', level: null, classId: 'class-1' });
  const svc = makeService(db);
  return { db, stu, svc };
}

describe('UI01 档位记录兜底', () => {
  it('第一次：给有档位的在册学生写 baseline；没定档的不写', async () => {
    const { db, svc } = setup();
    const at = new Date('2026-09-11T02:00:00.000Z');
    await expect(svc.observeStudentLevels(at)).resolves.toEqual({ baseline: 1, observed: 0 });
    expect(db.rows('studentLevelChange', {})).toEqual([expect.objectContaining({ studentId: 'stu-a', fromLevel: null, toLevel: 'olevel', source: 'baseline' })]);
    await expect(svc.observeStudentLevels(at)).resolves.toEqual({ baseline: 0, observed: 0 });
  });

  it('教师在花名册改了档（没写记录）：下一轮补记 observed；学生自己改的（已记录）不重复', async () => {
    const { db, stu, svc } = setup();
    await svc.observeStudentLevels(new Date('2026-09-11T02:00:00.000Z'));
    await db.user.update({ where: { id: stu }, data: { englishLevel: 'ielts_light' } });
    await expect(svc.observeStudentLevels(new Date('2026-09-11T03:00:00.000Z'))).resolves.toEqual({ baseline: 0, observed: 1 });
    expect(db.rows('studentLevelChange', { source: 'observed' })[0]).toEqual(expect.objectContaining({ fromLevel: 'olevel', toLevel: 'ielts_light' }));
    // 学生自己改：student-auth 同步写了记录
    await db.user.update({ where: { id: stu }, data: { englishLevel: 'olevel' } });
    db.seed('studentLevelChange', { studentId: stu, fromLevel: 'ielts_light', toLevel: 'olevel', source: 'student_self', changedAt: new Date('2026-09-11T04:00:00.000Z') });
    await expect(svc.observeStudentLevels(new Date('2026-09-11T05:00:00.000Z'))).resolves.toEqual({ baseline: 0, observed: 0 });
  });

  it('补记之后，过去没开始的日子仍按改档前的档位', async () => {
    const { db, stu, svc } = setup();
    db.seed('paper', { id: 'p1', name: 'Mon olevel' });
    db.seed('paperAssignment', { id: 'pa-olevel', paperId: 'p1', classId: 'class-1', assignedById: 't1' });
    db.seed('morningQuizSession', { id: 'm1', paperAssignmentId: 'pa-olevel', classId: 'class-1', date: new Date('2026-09-07T00:00:00.000Z'), level: 'olevel' });
    db.seed('paper', { id: 'p2', name: 'Mon light' });
    db.seed('paperAssignment', { id: 'pa-light', paperId: 'p2', classId: 'class-1', assignedById: 't1' });
    db.seed('morningQuizSession', { id: 'm2', paperAssignmentId: 'pa-light', classId: 'class-1', date: new Date('2026-09-07T00:00:00.000Z'), level: 'ielts_light' });
    await svc.observeStudentLevels(new Date('2026-09-06T16:00:00.000Z')); // 周一 00:00 SGT 的 baseline
    await db.user.update({ where: { id: stu }, data: { englishLevel: 'ielts_light' } });
    await svc.observeStudentLevels(new Date('2026-09-09T02:00:00.000Z'));
    const overview = await svc.overview(stu, sgtNoon('2026-09-10'));
    expect(overview.readingBacklog.map((row: any) => row.assignmentId)).toEqual(['pa-olevel']);
  });

  it('cron：V2 没开不跑；开了就跑，失败只记日志不抛', async () => {
    const observeStudentLevels = vi.fn().mockResolvedValue({ baseline: 2, observed: 0 });
    const cron = new VocabularyV2DailyTaskCron({} as never, { observeStudentLevels } as never);
    delete process.env.STUDENT_APP_V2;
    await cron.observeLevels();
    expect(observeStudentLevels).not.toHaveBeenCalled();
    process.env.STUDENT_APP_V2 = 'on';
    await cron.observeLevels(new Date('2026-09-12T02:00:00.000Z'));
    expect(observeStudentLevels).toHaveBeenCalledOnce();
    observeStudentLevels.mockRejectedValueOnce(new Error('db down'));
    await expect(cron.observeLevels()).resolves.toBeUndefined();
  });
});
