import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { LearningReportService } from './learning-report.service';

/**
 * 学习周报的查库层（2026-09-15）：谁能看哪些班、哪些人不算、数据怎么拼成每人每天。
 * 假 prisma 只实现这个服务真实用到的查询条件；不连数据库。
 */

const d = (key: string) => new Date(`${key}T00:00:00.000Z`);
const NOW = new Date('2026-09-09T08:00:00.000Z'); // 周三 16:00（新加坡）
const TEACHER_TEST_ID = 'cmtqgmjl200u6stuq31xrad59';

type Enrollment = { classId: string; joinedAt: Date; user: { id: string; name: string; englishLevel: string | null; createdAt: Date } };

function world() {
  const classes = [
    { id: 'c-ial', name: 'IAL27W', teachers: ['t-ial'] },
    { id: 'c-sec', name: 'SEC27W', teachers: ['t-sec'] },
    { id: 'p1_class_qa', name: 'QA 盲测班', teachers: ['t-ial'] },
    { id: 'c-test', name: '【测试】作业功能测试班', teachers: [] },
  ];
  const user = (id: string, createdAt = '2026-09-01', englishLevel: string | null = 'ielts_simplified') => ({ id, name: `学生${id}`, englishLevel, createdAt: d(createdAt) });
  const enrollments: Enrollment[] = [
    { classId: 'c-sec', joinedAt: d('2026-09-01'), user: user('s1') },
    { classId: 'c-sec', joinedAt: new Date('2026-09-08T02:00:00.000Z'), user: user('s2', '2026-09-08') }, // 周二才进班
    { classId: 'c-sec', joinedAt: d('2026-09-01'), user: user(TEACHER_TEST_ID) }, // 老师测试号
    { classId: 'c-sec', joinedAt: d('2026-09-15'), user: user('s-late', '2026-09-15') }, // 这周之后才注册
    { classId: 'c-sec', joinedAt: d('2026-09-01'), user: user('s-dup') },
    { classId: 'c-ial', joinedAt: d('2026-09-01'), user: user('s-dup') }, // 两个班都在 → 只算一次
    { classId: 'c-sec', joinedAt: d('2026-09-01'), user: user('s3') }, // 周一交了两份（改档后按新档又做一遍）
    { classId: 'c-sec', joinedAt: d('2026-09-13'), user: user('s-sun', '2026-09-13') }, // 周日才注册：这周最后一个有课日是周六 → 不算
  ];
  const session = (id: string, date: string) => ({ id, date: d(date), level: 'ielts_simplified', status: 'active' });
  const sub = (studentId: string, over: Record<string, unknown> = {}) => ({
    id: `sub-${studentId}-${over.id ?? 'x'}`,
    studentId,
    status: 'marked',
    finalSubmittedAt: new Date('2026-09-07T08:30:00.000Z'),
    submitSource: 'student',
    totalScore: 8,
    maxScore: 10,
    _count: { scripts: 3 },
    ...over,
  });
  const assignments = [
    {
      id: 'pa-mon',
      classId: 'c-sec',
      paper: { name: 'The Umbrella' },
      morningQuizSession: session('ms-mon', '2026-09-07'),
      submissions: [sub('s1', { id: 'mon' }), sub('s3', { id: 'mon-simplified', totalScore: 3.3, finalSubmittedAt: new Date('2026-09-08T07:19:00.000Z') })],
    },
    {
      id: 'pa-mon-light',
      classId: 'c-sec',
      paper: { name: 'Power from the Tide' },
      morningQuizSession: { id: 'ms-mon-light', date: d('2026-09-07'), level: 'ielts_light', status: 'active' },
      submissions: [sub('s3', { id: 'mon-light', totalScore: 0.8, finalSubmittedAt: new Date('2026-09-07T08:34:00.000Z') })],
    },
    {
      id: 'pa-tue',
      classId: 'c-sec',
      paper: { name: 'The Empty Seat' },
      morningQuizSession: session('ms-tue', '2026-09-08'),
      submissions: [sub('s1', { id: 'tue', status: 'submitted', totalScore: null })],
    },
    // 周六也排了课 → 周六出现在表里；周日没课 → 不出现
    { id: 'pa-sat', classId: 'c-sec', paper: { name: 'Saturday Extra' }, morningQuizSession: session('ms-sat', '2026-09-12'), submissions: [] },
  ];
  const vocab = [
    { studentId: 's1', date: d('2026-09-07'), sessionType: 'daily_learning', status: 'completed', items: Array.from({ length: 10 }, () => ({ status: 'completed', isCorrect: null })) },
    { studentId: 's1', date: d('2026-09-07'), sessionType: 'formal_test', status: 'submitted', items: Array.from({ length: 10 }, (_, i) => ({ status: 'completed', isCorrect: i < 9 })) },
  ];
  return { classes, enrollments, assignments, vocab };
}

function fakePrisma(w = world()) {
  return {
    class: {
      findMany: vi.fn(async (args: any) => {
        const teacherId = args.where?.enrollments?.some?.userId;
        return w.classes
          .filter((c) => (teacherId ? c.teachers.includes(teacherId) : true))
          .sort((a, b) => a.name.localeCompare(b.name))
          .map(({ id, name }) => ({ id, name }));
      }),
    },
    classEnrollment: { findMany: vi.fn(async (args: any) => w.enrollments.filter((e) => args.where.classId.in.includes(e.classId))) },
    paperAssignment: {
      findMany: vi.fn(async (args: any) =>
        w.assignments
          .filter((a) => args.where.classId.in.includes(a.classId))
          .map((a) => ({ ...a, submissions: a.submissions.filter((s) => args.select.submissions.where.studentId.in.includes(s.studentId)) })),
      ),
    },
    studentLevelChange: { findMany: vi.fn(async () => []) },
    vocabularyV2Session: { findMany: vi.fn(async (args: any) => w.vocab.filter((v) => args.where.studentId.in.includes(v.studentId))) },
  };
}

beforeEach(() => {
  vi.stubEnv('DEMO_ACCOUNT_IDS', undefined as unknown as string);
});
afterEach(() => vi.unstubAllEnvs());

describe('谁能看哪些班', () => {
  it('管理员 / 班主任：全校有英语课的班，演示 / QA 班不列', async () => {
    const prisma = fakePrisma();
    const r = await new LearningReportService(prisma as never).weekly({ id: 'admin', role: 'admin' }, {}, NOW);
    // 名字以【测试】开头的测试班、DEMO_CLASS_IDS 里的 QA 班都不列
    expect(r.classes.map((c) => c.name)).toEqual(['IAL27W', 'SEC27W']);
    const where = prisma.class.findMany.mock.calls[0][0].where;
    expect(where).toMatchObject({ archivedAt: null, morningQuizSessions: { some: {} } });
    expect(where.enrollments).toBeUndefined();
  });

  it('任课老师：只列自己教的班；点名要看别人的班 → 403 not_your_class', async () => {
    const svc = new LearningReportService(fakePrisma() as never);
    const r = await svc.weekly({ id: 't-ial', role: 'teacher' }, {}, NOW);
    expect(r.classes.map((c) => c.id)).toEqual(['c-ial']);
    await expect(svc.weekly({ id: 't-ial', role: 'teacher' }, { classId: 'c-sec' }, NOW)).rejects.toMatchObject({ response: { code: 'not_your_class' } });
  });

  it('学生 / 家长令牌进不来（控制器 @Roles 之外，服务里再挡一次）', async () => {
    const svc = new LearningReportService(fakePrisma() as never);
    await expect(svc.weekly({ id: 's1', role: 'student' }, {}, NOW)).rejects.toMatchObject({ response: { code: 'teachers_only' } });
  });
});

describe('哪些人不算、一周怎么拼', () => {
  it('老师测试号、这周之后才注册的不算；两个班都在的学生只算一次', async () => {
    const r = await new LearningReportService(fakePrisma() as never).weekly({ id: 'admin', role: 'admin' }, { weekStart: '2026-09-10' }, NOW);
    expect(r.weekStart).toBe('2026-09-07');
    // 不算的：老师测试号；9/15 注册的；周日（最后一个有课日周六之后）注册的
    expect(r.excluded).toEqual({ demoAccounts: 1, registeredAfter: 2 });
    expect(r.students.map((s) => s.id).sort()).toEqual(['s-dup', 's1', 's2', 's3']);
    expect(r.students.find((s) => s.id === 's-dup')!.className).toBe('IAL27W');
  });

  it('周一到周五总在；周末只有排了课才出现', async () => {
    const r = await new LearningReportService(fakePrisma() as never).weekly({ id: 'admin', role: 'admin' }, {}, NOW);
    expect(r.days.map((x) => x.date)).toEqual(['2026-09-07', '2026-09-08', '2026-09-09', '2026-09-10', '2026-09-11', '2026-09-12']);
  });

  it('每人每天：批完的给得分率，等批的算交了没分数；学词 / 词测按当天那一组', async () => {
    const r = await new LearningReportService(fakePrisma() as never).weekly({ id: 'admin', role: 'admin' }, { classId: 'c-sec' }, NOW);
    const s1 = r.students.find((s) => s.id === 's1')!;
    expect(s1.days[0]).toMatchObject({ reading: 'done', readPct: 80, title: 'The Umbrella', learning: 'done', test: 'done', testPct: 90 });
    expect(s1.days[1]).toMatchObject({ reading: 'done', readPct: null, awaitingMarking: true });
    expect(s1.days[2].reading).toBe('not_assigned');
    expect(s1).toMatchObject({ readN: 2, readDue: 2, readAvg: 80, awaitingMarking: 1 });
  });

  it('**按学习总表口径分配阅读**：周二才进班的学生，周一不算他的；周二没交就是没做', async () => {
    const r = await new LearningReportService(fakePrisma() as never).weekly({ id: 'admin', role: 'admin' }, { classId: 'c-sec' }, NOW);
    const s2 = r.students.find((s) => s.id === 's2')!;
    expect(s2.days[0].reading).toBe('not_assigned');
    expect(s2.days[1].reading).toBe('missed');
    expect(s2.none).toBe(true);
    // 只选了 SEC27W：两个班都在的 s-dup 这时算在 SEC27W，周一周二也没做
    expect(r.followUps.none.map((x) => x.id).sort()).toEqual(['s-dup', 's2']);
  });

  it('同一天交了两份（改档后按新档又做了一遍）：取最后交的那份', async () => {
    const r = await new LearningReportService(fakePrisma() as never).weekly({ id: 'admin', role: 'admin' }, { classId: 'c-sec' }, NOW);
    const s3 = r.students.find((s) => s.id === 's3')!;
    expect(s3.days[0]).toMatchObject({ reading: 'done', readPct: 33, title: 'The Umbrella', paperLevel: 'ielts_simplified' });
    expect(s3.readN).toBe(1);
  });

  it('只选了一个班时，只查这个班的场次和学生', async () => {
    const prisma = fakePrisma();
    await new LearningReportService(prisma as never).weekly({ id: 'admin', role: 'admin' }, { classId: 'c-ial' }, NOW);
    expect(prisma.classEnrollment.findMany.mock.calls[0][0].where.classId.in).toEqual(['c-ial']);
    expect(prisma.paperAssignment.findMany.mock.calls[0][0].where.classId.in).toEqual(['c-ial']);
  });
});
