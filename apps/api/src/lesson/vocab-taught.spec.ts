import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NotFoundException, BadRequestException } from '@nestjs/common';
import { LessonService } from './lesson.service';

/**
 * P5 收尾 —— 「标记教过」与「推进断点」必须同生共死。
 *
 * 守的是一个会导致**永久死锁**的窗口：cursor 前进了、firstTaughtAt 却
 * 没写上。那个词从此永远 unlearned（stage 卡在 vocab_learn），而 cursor
 * 已经越过它（学生再进来翻不到它）—— 这一天的课再也完不成。
 *
 * 测试直接断言发给 Prisma 的 where/data 与事务边界，先写后读、两次独立
 * 请求之类的实现都过不了。
 */

function makeSvc(overrides: Record<string, any> = {}, opts: { taskWords?: string[] } = {}) {
  const calls: Array<{ model: string; op: string; args: any; inTx: boolean }> = [];
  let inTx = false;
  const track = (model: string, op: string, impl: Function) => (args: any) => {
    calls.push({ model, op, args, inTx });
    return impl(args);
  };
  const base: any = {
    studentWord: {
      updateMany: track('studentWord', 'updateMany', async () => ({ count: 1 })),
      findUnique: track('studentWord', 'findUnique', async () => ({ id: 'sw1' })),
      count: async () => 0,
    },
    dailyLessonCompletion: {
      updateMany: track('dailyLessonCompletion', 'updateMany', async () => ({ count: 1 })),
      // start 里查任务行拿 id + vocabWords；推进断点时回读 vocabCursor
      findUnique: track('dailyLessonCompletion', 'findUnique', async (args: any) =>
        args?.select?.vocabWords !== undefined
          ? { id: 'dlc1', vocabWords: opts.taskWords ?? [] }
          : { vocabCursor: 3 },
      ),
      update: track('dailyLessonCompletion', 'update', async () => ({ id: 'dlc1' })),
    },
  };
  for (const [k, v] of Object.entries(overrides)) base[k] = { ...base[k], ...v };

  const prisma: any = {
    __calls: calls,
    ...base,
    $transaction: async (fn: Function) => {
      inTx = true;
      try {
        return await fn(base);
      } finally {
        inTx = false;
      }
    },
  };
  const words = { resolveStudent: vi.fn(async () => ({ id: 'stu1', name: '小明' })) } as any;
  const svc = new LessonService(prisma, words, {} as any, {} as any);
  // 走完整链路要一堆依赖 —— 这里只关心事务本身，桩掉阶段回读
  vi.spyOn(svc, 'startOrResumeToday').mockResolvedValue({ stage: 'vocab_test' } as any);
  return { svc, prisma };
}

describe('markTaughtAndAdvance —— 原子性', () => {
  beforeEach(() => vi.clearAllMocks());

  it('**两个写都在同一个事务里**', async () => {
    const { svc, prisma } = makeSvc();
    await svc.markTaughtAndAdvance({
      studentName: '小明', studentId: 'stu1', headword: 'harbour', cursor: 4,
    });
    const writes = prisma.__calls.filter((c: any) => c.op === 'updateMany');
    expect(writes).toHaveLength(2);
    expect(writes.every((w: any) => w.inTx)).toBe(true);
    expect(writes.map((w: any) => w.model)).toEqual(['studentWord', 'dailyLessonCompletion']);
  });

  it('标记是条件写入（firstTaughtAt IS NULL），且只写这一个字段', async () => {
    const { svc, prisma } = makeSvc();
    await svc.markTaughtAndAdvance({ studentName: '小明', headword: 'harbour', cursor: 4 });
    const w = prisma.__calls.find(
      (c: any) => c.model === 'studentWord' && c.op === 'updateMany',
    ).args;
    expect(w.where.firstTaughtAt).toBeNull();
    expect(w.where.headword).toBe('harbour');
    expect(Object.keys(w.data)).toEqual(['firstTaughtAt']);
  });

  it('断点是单调写入（vocabCursor < wanted）', async () => {
    const { svc, prisma } = makeSvc();
    await svc.markTaughtAndAdvance({ studentName: '小明', headword: 'harbour', cursor: 4 });
    const w = prisma.__calls.find(
      (c: any) => c.model === 'dailyLessonCompletion' && c.op === 'updateMany',
    ).args;
    expect(w.where.vocabCursor).toEqual({ lt: 4 });
  });

  it('**本子里没这个词 → 整笔回滚，cursor 绝不前进**', async () => {
    const { svc, prisma } = makeSvc({
      studentWord: {
        updateMany: async () => ({ count: 0 }),
        findUnique: async () => null,
      },
    });
    await expect(
      svc.markTaughtAndAdvance({ studentName: '小明', headword: 'ghost', cursor: 4 }),
    ).rejects.toThrow(NotFoundException);
    // 抛在推进之前 —— DLC 一次都没被写
    expect(
      prisma.__calls.filter((c: any) => c.model === 'dailyLessonCompletion' && c.op === 'updateMany'),
    ).toHaveLength(0);
  });

  it('重复提交（已标过）→ 幂等，cursor 照常推进', async () => {
    const { svc } = makeSvc({
      studentWord: {
        updateMany: async () => ({ count: 0 }),
        findUnique: async () => ({ id: 'sw1' }),
      },
    });
    const r = await svc.markTaughtAndAdvance({ studentName: '小明', headword: 'harbour', cursor: 4 });
    expect(r.alreadyTaught).toBe(true);
    expect(r.cursor).toBe(4);
  });

  it('落后的 cursor 到达 → 回读真实值，不倒退', async () => {
    const { svc } = makeSvc({
      dailyLessonCompletion: {
        updateMany: async () => ({ count: 0 }),
        findUnique: async () => ({ vocabCursor: 7 }),
      },
    });
    const r = await svc.markTaughtAndAdvance({ studentName: '小明', headword: 'harbour', cursor: 2 });
    expect(r.cursor).toBe(7);
  });

  it('没有当日记录 → 不创建 DLC，但教学照样落库', async () => {
    const { svc } = makeSvc({
      dailyLessonCompletion: {
        updateMany: async () => ({ count: 0 }),
        findUnique: async () => null,
      },
    });
    const r = await svc.markTaughtAndAdvance({ studentName: '小明', headword: 'harbour', cursor: 2 });
    expect(r.stored).toBe(false);
    expect(r.cursor).toBe(0);
    expect(r.alreadyTaught).toBe(false);
  });

  it('返回真实 stage —— 前端不自己推测', async () => {
    const { svc } = makeSvc();
    const r = await svc.markTaughtAndAdvance({ studentName: '小明', headword: 'harbour', cursor: 4 });
    expect(r.stage).toBe('vocab_test');
  });

  it('空 headword → 400，任何写之前挡住', async () => {
    const { svc, prisma } = makeSvc();
    await expect(
      svc.markTaughtAndAdvance({ studentName: '小明', headword: '  ', cursor: 1 }),
    ).rejects.toThrow(BadRequestException);
    expect(prisma.__calls.filter((c: any) => c.op === 'updateMany')).toHaveLength(0);
  });

  it('NaN cursor 不流进 SQL（按 0 处理）', async () => {
    const { svc, prisma } = makeSvc();
    await svc.markTaughtAndAdvance({
      studentName: '小明', headword: 'harbour', cursor: Number.NaN as any,
    });
    const w = prisma.__calls.find(
      (c: any) => c.model === 'dailyLessonCompletion' && c.op === 'updateMany',
    ).args;
    expect(w.where.vocabCursor).toEqual({ lt: 0 });
  });
});
