import { describe, it, expect, vi, beforeEach } from 'vitest';
import { AttendanceService } from './attendance.service';

/**
 * P7 收尾 —— 扫码推词并入当前任务，但要守同一条冻结规矩。
 *
 * 这是 `vocabWords` 四个合法写入口之一（另外三个：创建任务、课程内教学、
 * 学生自己打开课程页的 reconcile）。它必须：
 *   · 明确关联当前 DLC
 *   · 幂等、只增不减
 *   · **旧任务（NULL）不复活**、走到「该考」或已开卷之后不再扩充
 */

function makeSvc(dlc: any, attempts = 0) {
  const calls: Array<{ op: string; args: any }> = [];
  const prisma: any = {
    __calls: calls,
    dailyLessonCompletion: {
      findUnique: async () => dlc,
      update: (args: any) => {
        calls.push({ op: 'update', args });
        return Promise.resolve({});
      },
    },
    vocabQuizAttempt: { count: async () => attempts },
  };
  const svc = new AttendanceService(prisma, {} as any, {} as any, {} as any, {} as any);
  return { svc, calls };
}

/** attachWordsToTodayTask 是私有的 —— 从实例上取，测的是真实现而不是复制品 */
const attach = (svc: AttendanceService, words: string[]) =>
  (svc as any).attachWordsToTodayTask('stu1', words);

const dlcRow = (over: Record<string, unknown> = {}) => ({
  id: 'dlc1',
  vocabWords: ['a', 'b'],
  stage: 'vocab_learn',
  ...over,
});

describe('attachWordsToTodayTask', () => {
  beforeEach(() => vi.clearAllMocks());

  it('把推入的词并进当前任务的队列（只增不减、去重、小写归一）', async () => {
    const { svc, calls } = makeSvc(dlcRow());
    await attach(svc, ['C', ' d ', 'a']);
    expect(calls).toHaveLength(1);
    expect(calls[0].args.where.id).toBe('dlc1');
    expect(calls[0].args.data.vocabWords).toEqual(['a', 'b', 'c', 'd']);
  });

  it('全都已经在队列里 → 不写库（幂等 no-op）', async () => {
    const { svc, calls } = makeSvc(dlcRow());
    await attach(svc, ['a', 'b']);
    expect(calls).toHaveLength(0);
  });

  it('没有当日任务行 → 不写（冻结时会一起快照进去）', async () => {
    const { svc, calls } = makeSvc(null);
    await attach(svc, ['c']);
    expect(calls).toHaveLength(0);
  });

  it('**旧任务 vocabWords=NULL 不在这里复活**', async () => {
    const { svc, calls } = makeSvc(dlcRow({ vocabWords: null }));
    await attach(svc, ['c']);
    expect(calls).toHaveLength(0);
  });

  it('**stage 已到 vocab_test → 不再扩充**', async () => {
    const { svc, calls } = makeSvc(dlcRow({ stage: 'vocab_test' }));
    await attach(svc, ['c']);
    expect(calls).toHaveLength(0);
  });

  it('**stage 已 done → 不再扩充**', async () => {
    const { svc, calls } = makeSvc(dlcRow({ stage: 'done' }));
    await attach(svc, ['c']);
    expect(calls).toHaveLength(0);
  });

  it('**已存在 attempt → 不再扩充**', async () => {
    const { svc, calls } = makeSvc(dlcRow(), 1);
    await attach(svc, ['c']);
    expect(calls).toHaveLength(0);
  });

  it('空词表直接返回', async () => {
    const { svc, calls } = makeSvc(dlcRow());
    await attach(svc, []);
    expect(calls).toHaveLength(0);
  });

  it('数据库出错只记日志，不把扫码带崩', async () => {
    const { svc } = makeSvc(dlcRow());
    (svc as any).prisma.dailyLessonCompletion.findUnique = async () => {
      throw new Error('db down');
    };
    await expect(attach(svc, ['c'])).resolves.toBeUndefined();
  });
});
