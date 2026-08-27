import { describe, it, expect, vi, beforeEach } from 'vitest';
import { LessonService } from './lesson.service';

/**
 * P7 收尾 —— **读取不得有副作用**。
 *
 * 之前 today() 无论 freeze 与否都会写三样东西：进度快照、阶段、词汇队列。
 * 教师看板走的正是 today(freeze:false) —— 于是教师看一眼就改了全班学生的
 * 数据，而队列内容还被「教师什么时候看的」决定（学生做完词、due 被 FSRS
 * 推远之后再补，补进来的不是他上午做过的那批）。
 *
 * 这些测试直接数发给 Prisma 的写调用。任何一次回归都会当场变红。
 */

const WRITE_OPS = ['create', 'update', 'updateMany', 'delete', 'deleteMany', 'upsert'];

const dlcRow = (over: Record<string, unknown> = {}) => ({
  id: 'dlc1',
  studentId: 'stu1',
  stage: 'reading',
  vocabWords: ['a', 'b'],
  readTarget: 1,
  vocabTarget: 4,
  drillTarget: 0,
  rulesVersion: 999,
  vocabCursor: 0,
  readProgress: 0,
  vocabProgress: 0,
  drillProgress: 0,
  readDoneAt: null,
  vocabDoneAt: null,
  drillDoneAt: null,
  readSource: null,
  ...over,
});

function makeSvc(opts: { dlc?: any } = {}) {
  const calls: Array<{ model: string; op: string; args: any }> = [];
  const rec = (model: string, op: string, impl: Function) => (args: any) => {
    calls.push({ model, op, args });
    return impl(args);
  };
  const dlc = opts.dlc === undefined ? dlcRow() : opts.dlc;

  const prisma: any = {
    __calls: calls,
    dailyLessonCompletion: {
      findUnique: rec('dlc', 'findUnique', async () => dlc),
      findMany: rec('dlc', 'findMany', async () => []),
      create: rec('dlc', 'create', async ({ data }: any) => ({ ...dlcRow(), ...data })),
      update: rec('dlc', 'update', async ({ data }: any) => ({ ...dlcRow(), ...data })),
      updateMany: rec('dlc', 'updateMany', async () => ({ count: 1 })),
    },
    studentWord: {
      count: rec('studentWord', 'count', async () => 0),
      findMany: rec('studentWord', 'findMany', async () => [
        { headword: 'a' },
        { headword: 'b' },
        { headword: 'c' },
      ]),
    },
    wordReviewLog: { count: rec('wordReviewLog', 'count', async () => 0) },
    vocabQuizAttempt: { findFirst: rec('attempt', 'findFirst', async () => null) },
    mistakeEntry: { count: rec('mistakeEntry', 'count', async () => 0) },
    studentSubmission: {
      findFirst: rec('sub', 'findFirst', async () => null),
      findMany: rec('sub', 'findMany', async () => []),
    },
    morningQuizSession: {
      findFirst: rec('sess', 'findFirst', async () => null),
      findMany: rec('sess', 'findMany', async () => []),
    },
    // P9：认人（按 id）与读长期难度都走 user 表。两者都是**读**，
    // 所以不列进 WRITE_OPS —— 只读不变量照旧成立。
    user: {
      findFirst: rec('user', 'findFirst', async () => ({ id: 'stu1', name: '小明' })),
      findUnique: rec('user', 'findUnique', async () => ({ englishLevel: 'olevel' })),
      updateMany: rec('user', 'updateMany', async () => ({ count: 0 })),
    },
    paperQuestion: { count: rec('pq', 'count', async () => 0) },
    classEnrollment: { findMany: rec('enr', 'findMany', async () => []) },
  };
  const words = { resolveStudent: vi.fn(async () => ({ id: 'stu1', name: '小明' })) } as any;
  const review = { streakDays: vi.fn(async () => 0) } as any;
  const mistakes = { practiceQueue: vi.fn(async () => ({ items: [] })) } as any;
  // 构造顺序：prisma, words, review, mistakes
  const svc = new LessonService(prisma, words, review, mistakes);
  const writes = () => calls.filter((c) => WRITE_OPS.includes(c.op));
  const queueWrites = () =>
    calls.filter((c) => c.op === 'update' && c.args?.data?.vocabWords !== undefined);
  return { svc, prisma, writes, queueWrites };
}

describe('getToday() —— 纯读取（P8 收口后的查询入口）', () => {
  beforeEach(() => vi.clearAllMocks());

  it('**一次写都不发**（教师看板走的就是这条路）', async () => {
    const { svc, writes } = makeSvc();
    await svc.getToday({ studentName: '小明', studentId: 'stu1' });
    expect(writes()).toHaveLength(0);
  });

  it('连续读三次仍然零写入', async () => {
    const { svc, writes } = makeSvc();
    for (let i = 0; i < 3; i++) {
      await svc.getToday({ studentName: '小明', studentId: 'stu1' });
    }
    expect(writes()).toHaveLength(0);
  });

  it('**vocabWords=NULL 的旧任务读完仍是 NULL**（不自动自愈）', async () => {
    const { svc, writes } = makeSvc({ dlc: dlcRow({ stage: 'vocab_learn', vocabWords: null }) });
    const t = await svc.getToday({ studentName: '小明', studentId: 'stu1' });
    expect(writes()).toHaveLength(0);
    const vocab = t.segments.find((x: any) => x.key === 'vocab') as any;
    expect(vocab.quizScore.status).toBe('legacy_no_queue');
  });

  it('没有当日任务行时也不创建（教师看一眼不给全班建记录）', async () => {
    const { svc, writes } = makeSvc({ dlc: null });
    await svc.getToday({ studentName: '小明', studentId: 'stu1' });
    expect(writes()).toHaveLength(0);
  });

  it('阶段该前进也不落库 —— 只在返回值里给出推导结果', async () => {
    const { svc, prisma, writes } = makeSvc();
    const t = await svc.getToday({ studentName: '小明', studentId: 'stu1' });
    expect(writes()).toHaveLength(0);
    expect(prisma.__calls.some((c: any) => c.model === 'dlc' && c.op === 'updateMany')).toBe(false);
    expect(typeof t.stage).toBe('string');
  });
});

describe('startOrResumeToday() —— 明确的学生命令才写', () => {
  beforeEach(() => vi.clearAllMocks());

  it('会对齐进度与阶段，且只写任务行', async () => {
    const { svc, writes } = makeSvc();
    await svc.startOrResumeToday({ studentName: '小明', studentId: 'stu1' });
    expect(writes().length).toBeGreaterThan(0);
    expect(writes().every((w: any) => w.model === 'dlc')).toBe(true);
  });

  it('**已经进行中的旧任务（vocabWords=NULL）不在这里自愈**', async () => {
    const { svc, queueWrites } = makeSvc({
      dlc: dlcRow({ stage: 'vocab_learn', vocabWords: null }),
    });
    await svc.startOrResumeToday({ studentName: '小明', studentId: 'stu1' });
    expect(queueWrites()).toHaveLength(0);
  });

  it('**走到 vocab_test 之后队列不再扩充**', async () => {
    const { svc, queueWrites } = makeSvc({ dlc: dlcRow({ stage: 'vocab_test', vocabWords: ['a'] }) });
    await svc.startOrResumeToday({ studentName: '小明', studentId: 'stu1' });
    expect(queueWrites()).toHaveLength(0);
  });

  it('**已经有 attempt 之后队列不再扩充**', async () => {
    const { svc, prisma, queueWrites } = makeSvc();
    prisma.vocabQuizAttempt.findFirst = async () => ({
      status: 'in_progress', submittedAt: null, total: 4, correct: 0, score: 0, items: [],
    });
    await svc.startOrResumeToday({ studentName: '小明', studentId: 'stu1' });
    expect(queueWrites()).toHaveLength(0);
  });

  it('还没开始（stage=reading）且队列有值 → 并入新到期的词（只增不减）', async () => {
    const { svc, queueWrites } = makeSvc();
    await svc.startOrResumeToday({ studentName: '小明', studentId: 'stu1' });
    const w = queueWrites();
    expect(w).toHaveLength(1);
    expect(w[0].args.data.vocabWords).toEqual(['a', 'b', 'c']);
  });

  it('没有任务行 → 创建，并用当前到期队列初始化', async () => {
    const { svc, prisma } = makeSvc({ dlc: null });
    await svc.startOrResumeToday({ studentName: '小明', studentId: 'stu1' });
    const created = prisma.__calls.find((c: any) => c.model === 'dlc' && c.op === 'create');
    expect(created).toBeTruthy();
    expect(created.args.data.vocabWords).toEqual(['a', 'b', 'c']);
  });
});
