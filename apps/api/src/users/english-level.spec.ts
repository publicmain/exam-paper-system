import { describe, it, expect, beforeEach, vi } from 'vitest';
import { ForbiddenException, NotFoundException, BadRequestException } from '@nestjs/common';
import { UsersService } from './users.service';

/**
 * P4 —— 教师改难度的授权与副作用边界。
 *
 * 用假 Prisma，因为要断言的不是 SQL 能不能跑，而是：
 *   · 谁被允许改（班级归属）
 *   · 改了之后**只有 User 一行被写**（历史答卷 / 成绩 / 场次 / 当日任务
 *     一个都不许碰）——「改难度顺手把历史成绩也改了」是这类接口最典型
 *     的事故，必须由测试挡住，而不是靠代码评审的记忆。
 */

function makePrisma(overrides: Record<string, any> = {}) {
  const calls: Array<{ model: string; op: string; args: any }> = [];
  const track = (model: string, op: string, impl: Function) => (args: any) => {
    calls.push({ model, op, args });
    return impl(args);
  };
  const prisma: any = {
    __calls: calls,
    user: {
      findUnique: track('user', 'findUnique', async () => ({
        id: 'stu1',
        role: 'student',
        name: '小明',
        englishLevel: 'ielts_authentic',
      })),
      update: track('user', 'update', async ({ data }: any) => ({
        id: 'stu1',
        name: '小明',
        englishLevel: data.englishLevel,
      })),
    },
    classEnrollment: {
      findMany: track('classEnrollment', 'findMany', async () => [{ classId: 'c1' }]),
      // canActOnClass 用它判断老师是不是这个班的
      findUnique: track('classEnrollment', 'findUnique', async () => ({ role: 'teacher' })),
    },
    // 下面这些一旦被调用就说明越界了 —— 故意让它们爆炸
    studentSubmission: {
      update: () => { throw new Error('不该碰历史答卷'); },
      updateMany: () => { throw new Error('不该碰历史答卷'); },
      deleteMany: () => { throw new Error('不该碰历史答卷'); },
    },
    morningQuizSession: {
      update: () => { throw new Error('不该碰场次快照'); },
      updateMany: () => { throw new Error('不该碰场次快照'); },
    },
    dailyLessonCompletion: {
      update: () => { throw new Error('不该碰已生成的任务'); },
      updateMany: () => { throw new Error('不该碰已生成的任务'); },
      deleteMany: () => { throw new Error('不该碰已生成的任务'); },
    },
  };
  for (const [k, v] of Object.entries(overrides)) prisma[k] = { ...prisma[k], ...v };
  return prisma;
}

const audit = { log: vi.fn(async () => undefined) } as any;
const TEACHER = { id: 't1', role: 'teacher' };

describe('setEnglishLevel — 授权', () => {
  beforeEach(() => audit.log.mockClear());

  it('本班教师可以改', async () => {
    const prisma = makePrisma();
    const svc = new UsersService(prisma, audit);
    const r = await svc.setEnglishLevel(TEACHER, 'stu1', 'olevel');
    expect(r).toEqual({ ok: true, id: 'stu1', englishLevel: 'olevel' });
  });

  it('admin 不查班级归属也能改（全校权限）', async () => {
    const prisma = makePrisma({
      classEnrollment: {
        findUnique: async () => null, // 管理员没有任何班级 enrollment
      },
    });
    const svc = new UsersService(prisma, audit);
    const r = await svc.setEnglishLevel({ id: 'a1', role: 'admin' }, 'stu1', 'olevel');
    expect(r.ok).toBe(true);
  });

  it('**别的班的教师改不了** → not_your_class', async () => {
    const prisma = makePrisma({
      classEnrollment: {
        findMany: async () => [{ classId: 'c1' }],
        findUnique: async () => null, // 这个老师不在 c1
      },
    });
    const svc = new UsersService(prisma, audit);
    await expect(svc.setEnglishLevel(TEACHER, 'stu1', 'olevel')).rejects.toThrow(
      ForbiddenException,
    );
  });

  it('**学生自己改不了** —— role=student 连 canActOnClass 都过不去', async () => {
    const prisma = makePrisma();
    const svc = new UsersService(prisma, audit);
    await expect(
      svc.setEnglishLevel({ id: 'stu1', role: 'student' }, 'stu1', 'olevel'),
    ).rejects.toThrow(ForbiddenException);
  });

  it('目标不是学生（改到老师头上）→ student_not_found', async () => {
    const prisma = makePrisma({
      user: {
        findUnique: async () => ({ id: 't2', role: 'teacher', name: '王老师', englishLevel: null }),
      },
    });
    const svc = new UsersService(prisma, audit);
    await expect(svc.setEnglishLevel(TEACHER, 't2', 'olevel')).rejects.toThrow(NotFoundException);
  });

  it('未知等级 → 400，且在任何查询之前就挡住', async () => {
    const prisma = makePrisma();
    const svc = new UsersService(prisma, audit);
    await expect(
      svc.setEnglishLevel(TEACHER, 'stu1', 'ielts_nonexistent' as any),
    ).rejects.toThrow(BadRequestException);
    expect(prisma.__calls.length).toBe(0);
  });
});

describe('setEnglishLevel — 副作用边界', () => {
  beforeEach(() => audit.log.mockClear());

  it('**只写 User 一行**：历史答卷 / 场次 / 当日任务全程未被触碰', async () => {
    const prisma = makePrisma();
    const svc = new UsersService(prisma, audit);
    await svc.setEnglishLevel(TEACHER, 'stu1', 'ielts_simplified');

    const writes = prisma.__calls.filter((c: any) =>
      ['update', 'updateMany', 'create', 'delete', 'deleteMany'].includes(c.op),
    );
    expect(writes).toHaveLength(1);
    expect(writes[0].model).toBe('user');
    // 写进去的字段也只有难度一个
    expect(Object.keys(writes[0].args.data)).toEqual(['englishLevel']);
  });

  it('留审计：改了谁、从哪层到哪层', async () => {
    const prisma = makePrisma();
    const svc = new UsersService(prisma, audit);
    await svc.setEnglishLevel(TEACHER, 'stu1', 'olevel');
    expect(audit.log).toHaveBeenCalledWith(
      expect.objectContaining({
        action: 'user.english_level_set',
        entityType: 'User',
        entityId: 'stu1',
        diff: { englishLevel: { from: 'ielts_authentic', to: 'olevel' } },
      }),
    );
  });

  it('可以清空成 null（教师纠错 → 退回「下次扫码现选」）', async () => {
    const prisma = makePrisma();
    const svc = new UsersService(prisma, audit);
    const r = await svc.setEnglishLevel(TEACHER, 'stu1', null);
    expect(r.englishLevel).toBeNull();
  });
});
