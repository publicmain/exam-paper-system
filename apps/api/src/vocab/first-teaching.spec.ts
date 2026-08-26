import { describe, it, expect, vi } from 'vitest';
import { NotFoundException, BadRequestException } from '@nestjs/common';
import { needsFirstTeaching, needsReviewInteraction } from './first-teaching';
import { VocabReviewService } from './vocab-review.service';

/**
 * P5 —— 「教过没有」的判据，以及首次教学**只写一个字段**这件事。
 *
 * 第二组测试是本片最重要的防线：教学一旦顺手写了评分 / 流水 / due，
 * 「学」就又变回「测」了，而那种回归在页面上看不出来 —— 学生照样看到
 * 教学卡，只是他的调度被一次假评分污染了。
 */

describe('needsFirstTeaching —— 判据', () => {
  it('从没评过分、也没教过 → 该教', () => {
    expect(needsFirstTeaching({ firstTaughtAt: null, reps: 0 })).toBe(true);
  });

  it('**教过了就不再教**（哪怕 reps 仍是 0）—— 否则天天教同一批词', () => {
    expect(needsFirstTeaching({ firstTaughtAt: new Date(), reps: 0 })).toBe(false);
  });

  it('存量词：评过分（reps>0）但没有 firstTaughtAt → 当复习词，不需要回填', () => {
    expect(needsFirstTeaching({ firstTaughtAt: null, reps: 3 })).toBe(false);
  });

  it('字段缺失（老代码路径没 select 到）按 0 处理，不会误判成已教', () => {
    expect(needsFirstTeaching({ firstTaughtAt: undefined, reps: undefined })).toBe(true);
  });

  it('ISO 字符串形态的 firstTaughtAt 同样算已教（跨 API 边界后是字符串）', () => {
    expect(needsFirstTeaching({ firstTaughtAt: '2026-08-27T00:00:00.000Z', reps: 0 })).toBe(false);
  });

  it('两条分支互斥且穷尽', () => {
    const cases = [
      { firstTaughtAt: null, reps: 0 },
      { firstTaughtAt: null, reps: 5 },
      { firstTaughtAt: new Date(), reps: 0 },
      { firstTaughtAt: new Date(), reps: 5 },
    ];
    for (const c of cases) {
      expect(needsFirstTeaching(c)).toBe(!needsReviewInteraction(c));
    }
  });
});

function makeSvc(overrides: Record<string, any> = {}) {
  const calls: Array<{ model: string; op: string; args: any }> = [];
  const track = (model: string, op: string, impl: Function) => (args: any) => {
    calls.push({ model, op, args });
    return impl(args);
  };
  const prisma: any = {
    __calls: calls,
    studentWord: {
      updateMany: track('studentWord', 'updateMany', async () => ({ count: 1 })),
      findUnique: track('studentWord', 'findUnique', async () => ({ firstTaughtAt: new Date() })),
      // 教学绝不许碰这些
      update: () => { throw new Error('教学不得改写 FSRS 字段'); },
    },
    wordReviewLog: {
      create: () => { throw new Error('教学不得写复习流水'); },
      findUnique: () => { throw new Error('教学不得读写复习流水'); },
    },
    $transaction: () => { throw new Error('教学不需要事务，也不该走评分那条路'); },
  };
  for (const [k, v] of Object.entries(overrides)) prisma[k] = { ...prisma[k], ...v };
  const words = { resolveStudent: vi.fn(async () => ({ id: 'stu1', name: '小明' })) } as any;
  const svc = new VocabReviewService(prisma, words);
  return { svc, prisma };
}

describe('markFirstTaught —— 只写一个字段', () => {
  it('**只写 firstTaughtAt，不碰任何 FSRS 字段、不写复习流水**', async () => {
    const { svc, prisma } = makeSvc();
    const r = await svc.markFirstTaught({ studentName: '小明', headword: 'harbour' });
    expect(r).toEqual({ ok: true, headword: 'harbour', firstTaught: true, alreadyTaught: false });

    const writes = prisma.__calls.filter((c: any) =>
      ['update', 'updateMany', 'create', 'delete', 'deleteMany'].includes(c.op),
    );
    expect(writes).toHaveLength(1);
    expect(writes[0].model).toBe('studentWord');
    // 写进去的字段只有 firstTaughtAt 一个
    expect(Object.keys(writes[0].args.data)).toEqual(['firstTaughtAt']);
  });

  it('**条件写入**：where 里带 firstTaughtAt: null —— 已教过的不会被改写', async () => {
    const { svc, prisma } = makeSvc();
    await svc.markFirstTaught({ studentName: '小明', headword: 'harbour' });
    const w = prisma.__calls.find((c: any) => c.op === 'updateMany').args.where;
    expect(w.firstTaughtAt).toBeNull();
    expect(w.studentId).toBe('stu1');
    expect(w.headword).toBe('harbour');
  });

  it('重复提交（已教过）→ 幂等 no-op，返回 alreadyTaught', async () => {
    const { svc } = makeSvc({ studentWord: { updateMany: async () => ({ count: 0 }) } });
    const r = await svc.markFirstTaught({ studentName: '小明', headword: 'harbour' });
    expect(r.alreadyTaught).toBe(true);
    expect(r.firstTaught).toBe(true);
  });

  it('本子里没这个词 → 404，不静默成功', async () => {
    const { svc } = makeSvc({
      studentWord: { updateMany: async () => ({ count: 0 }), findUnique: async () => null },
    });
    await expect(
      svc.markFirstTaught({ studentName: '小明', headword: 'nosuchword' }),
    ).rejects.toThrow(NotFoundException);
  });

  it('空 headword → 400，且在任何写操作之前挡住', async () => {
    const { svc, prisma } = makeSvc();
    await expect(svc.markFirstTaught({ studentName: '小明', headword: '   ' })).rejects.toThrow(
      BadRequestException,
    );
    expect(prisma.__calls.filter((c: any) => c.op === 'updateMany')).toHaveLength(0);
  });
});
