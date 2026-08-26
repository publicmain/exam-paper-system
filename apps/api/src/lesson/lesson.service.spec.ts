import { describe, expect, it, vi } from 'vitest';
import { LessonService } from './lesson.service';

/**
 * saveVocabCursor 服务层契约（P3 合并前验证第 3 / 4 项）。
 *
 * 重点是**单调写入靠数据库条件更新**，不是先读后写 —— 所以这里断言
 * 发给 Prisma 的 where 子句本身（`vocabCursor: { lt: wanted }`）。
 * 先读后写的实现无法通过这些断言。
 */

function makeSvc(opts: { updatedCount?: number; existingRow?: { vocabCursor: number } | null } = {}) {
  const updateMany = vi.fn().mockResolvedValue({ count: opts.updatedCount ?? 1 });
  const findUnique = vi.fn().mockResolvedValue(
    opts.existingRow === undefined ? { vocabCursor: 0 } : opts.existingRow,
  );
  const prisma: any = {
    dailyLessonCompletion: { updateMany, findUnique },
  };
  const words: any = {
    resolveStudent: vi.fn().mockResolvedValue({ id: 'stu-1', name: '张三' }),
  };
  const svc = new LessonService(prisma, words, {} as any, {} as any);
  return { svc, updateMany, findUnique, words };
}

describe('saveVocabCursor —— 单调写入（数据库条件更新）', () => {
  it('合法 cursor：以 vocabCursor < wanted 为条件更新，命中即返回该值', async () => {
    const { svc, updateMany } = makeSvc({ updatedCount: 1 });
    const r = await svc.saveVocabCursor({ studentName: '张三', cursor: 4 });

    expect(r).toEqual({ ok: true, cursor: 4, stored: true });
    const arg = updateMany.mock.calls[0][0];
    // 单调性交给数据库 —— 这一句是本片的核心防线
    expect(arg.where.vocabCursor).toEqual({ lt: 4 });
    expect(arg.where.studentId).toBe('stu-1');
    expect(arg.data).toEqual({ vocabCursor: 4 });
  });

  it('**旧标签页较小 cursor 不覆盖较新进度**：匹配 0 行 → 回读真实值', async () => {
    // 库里已经是 7；旧标签页上报 3 → WHERE vocabCursor < 3 匹配不到
    const { svc, updateMany, findUnique } = makeSvc({
      updatedCount: 0,
      existingRow: { vocabCursor: 7 },
    });
    const r = await svc.saveVocabCursor({ studentName: '张三', cursor: 3 });

    expect(r).toEqual({ ok: true, cursor: 7, stored: true });
    expect(updateMany).toHaveBeenCalledTimes(1);
    expect(findUnique).toHaveBeenCalledTimes(1);
  });

  it('相等 cursor（重复上报）不写库', async () => {
    const { svc, updateMany } = makeSvc({ updatedCount: 0, existingRow: { vocabCursor: 5 } });
    const r = await svc.saveVocabCursor({ studentName: '张三', cursor: 5 });
    expect(r.cursor).toBe(5);
    // lt 条件保证相等时匹配 0 行 —— 仍然只发一条 updateMany，不做读改写
    expect(updateMany.mock.calls[0][0].where.vocabCursor).toEqual({ lt: 5 });
  });

  it('负数 / 小数 / NaN 被规整（不会写进脏值）', async () => {
    for (const [input, expected] of [
      [-3, 0],
      [2.9, 2],
      [Number.NaN, 0],
    ] as const) {
      const { svc, updateMany } = makeSvc({ updatedCount: 1 });
      await svc.saveVocabCursor({ studentName: '张三', cursor: input });
      expect(updateMany.mock.calls[0][0].data.vocabCursor).toBe(expected);
    }
  });

  it('没有当日记录（学生还没打开过课程页）→ stored:false，**不创建**', async () => {
    // 创建是 today(freeze:true) 的职责（那里才有目标冻结逻辑）
    const { svc, updateMany } = makeSvc({ updatedCount: 0, existingRow: null });
    const r = await svc.saveVocabCursor({ studentName: '张三', cursor: 4 });
    expect(r).toEqual({ ok: true, cursor: 0, stored: false });
    // 只发了条件更新，没有任何 create
    expect(updateMany).toHaveBeenCalledTimes(1);
    expect((svc as any).prisma?.dailyLessonCompletion?.create).toBeUndefined();
  });

  it('数据库报错原样抛出（不吞异常）', async () => {
    const boom = new Error('connection reset');
    const prisma: any = {
      dailyLessonCompletion: {
        updateMany: vi.fn().mockRejectedValue(boom),
        findUnique: vi.fn(),
      },
    };
    const words: any = { resolveStudent: vi.fn().mockResolvedValue({ id: 'stu-1', name: '张三' }) };
    const svc = new LessonService(prisma, words, {} as any, {} as any);
    await expect(svc.saveVocabCursor({ studentName: '张三', cursor: 1 })).rejects.toBe(boom);
  });

  it('学生解析失败（查无此人）时不写库', async () => {
    const updateMany = vi.fn();
    const prisma: any = { dailyLessonCompletion: { updateMany, findUnique: vi.fn() } };
    const words: any = {
      resolveStudent: vi.fn().mockRejectedValue(new Error('student_not_found')),
    };
    const svc = new LessonService(prisma, words, {} as any, {} as any);
    await expect(svc.saveVocabCursor({ studentName: '不存在', cursor: 3 })).rejects.toThrow(
      'student_not_found',
    );
    expect(updateMany).not.toHaveBeenCalled();
  });
});
