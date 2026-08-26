import { describe, expect, it, vi } from 'vitest';
import { Prisma } from '@prisma/client';
import { createRealSubmissionSafe } from './submission-create';

/**
 * P1 答卷唯一性防线的撞墙自愈（docs/refactor-plan.md P1）。
 * 数据库侧的 partial unique 由迁移保证；这里测代码侧：并发输家撞
 * P2002 时必须拿到赢家那条而不是把 500 甩给学生。
 */

const p2002 = () =>
  new Prisma.PrismaClientKnownRequestError('unique violation', {
    code: 'P2002',
    clientVersion: 'test',
  });

const DATA = { assignmentId: 'a1', studentId: 's1', maxScore: 8 };

describe('createRealSubmissionSafe', () => {
  it('无冲突：直接创建并返回', async () => {
    const created = { id: 'new' };
    const prisma: any = {
      studentSubmission: {
        create: vi.fn().mockResolvedValue(created),
        findFirst: vi.fn(),
      },
    };
    expect(await createRealSubmissionSafe(prisma, DATA)).toBe(created);
    expect(prisma.studentSubmission.findFirst).not.toHaveBeenCalled();
  });

  it('并发输家撞 P2002 → 查出赢家返回，两路请求都成功', async () => {
    const winner = { id: 'winner' };
    const prisma: any = {
      studentSubmission: {
        create: vi.fn().mockRejectedValue(p2002()),
        findFirst: vi.fn().mockResolvedValue(winner),
      },
    };
    expect(await createRealSubmissionSafe(prisma, DATA)).toBe(winner);
    // 重查必须排除 practice —— 索引只覆盖真实答卷
    expect(prisma.studentSubmission.findFirst).toHaveBeenCalledWith({
      where: { assignmentId: 'a1', studentId: 's1', status: { not: 'practice' } },
    });
  });

  it('P2002 但重查也没有（真异常）→ 原样抛，不吞', async () => {
    const prisma: any = {
      studentSubmission: {
        create: vi.fn().mockRejectedValue(p2002()),
        findFirst: vi.fn().mockResolvedValue(null),
      },
    };
    await expect(createRealSubmissionSafe(prisma, DATA)).rejects.toMatchObject({
      code: 'P2002',
    });
  });

  it('非唯一键错误（断连等）→ 原样抛，不重查', async () => {
    const boom = new Error('connection reset');
    const prisma: any = {
      studentSubmission: {
        create: vi.fn().mockRejectedValue(boom),
        findFirst: vi.fn(),
      },
    };
    await expect(createRealSubmissionSafe(prisma, DATA)).rejects.toBe(boom);
    expect(prisma.studentSubmission.findFirst).not.toHaveBeenCalled();
  });
});
