import { describe, expect, it, vi } from 'vitest';
import { UsersService } from './users.service';

/**
 * 老师在班级名单里改学生登录名（2026-09-15）。
 *   · 任课老师只能改自己班的学生；管理员 / 班主任全校；
 *   · 与学生自己改走同一个函数：姓名 + 昵称一起改、同班查重、写审计（细节见 student-rename.spec）；
 *   · 旧的管理员通用改名接口改到学生头上时，也走同一个函数 —— 不再只改 name。
 */

function makePrisma(opts: { role?: string; teacherOfClass?: boolean; enrollments?: any[] } = {}) {
  const student = { id: 'stu1', role: opts.role ?? 'student', name: '小明', nickname: '小明', email: 'x@school.local', avatar: null, studentAuthVersion: 0 };
  const prisma: any = {
    user: {
      findUnique: vi.fn(async () => student),
      findMany: vi.fn(async () => []),
      findFirst: vi.fn(async () => null),
      updateMany: vi.fn(async () => ({ count: 1 })),
      update: vi.fn(async () => {
        throw new Error('学生改名不该走只改 name 的旧写法');
      }),
    },
    classEnrollment: {
      findMany: vi.fn(async () => opts.enrollments ?? [{ classId: 'c1', class: { archivedAt: null } }]),
      // canActOnClass 用它判断老师是不是这个班的
      findUnique: vi.fn(async () => (opts.teacherOfClass === false ? null : { role: 'teacher' })),
    },
    auditLog: { create: vi.fn(async () => ({})) },
  };
  prisma.$transaction = vi.fn(async (fn: any) => fn(prisma));
  return prisma;
}

const audit: any = { log: vi.fn(async () => undefined) };

describe('老师改学生登录名', () => {
  it('任课老师改自己班的学生：姓名昵称一起改，审计记是谁从名单里改的', async () => {
    const prisma = makePrisma();
    const svc = new UsersService(prisma, audit);
    const r = await svc.renameStudent({ id: 't1', role: 'teacher' }, 'stu1', '小明明');
    expect(prisma.user.updateMany).toHaveBeenCalledWith({ where: { id: 'stu1', name: '小明' }, data: { name: '小明明', nickname: '小明明' } });
    expect(prisma.auditLog.create).toHaveBeenCalledWith({ data: expect.objectContaining({ actorId: 't1', actorRole: 'teacher', metadata: { source: 'teacher_roster' } }) });
    expect(r).toEqual({ id: 'stu1', name: '小明明', nickname: '小明明', previousName: '小明' });
  });

  it('**不是自己班的学生 → 403，不改**', async () => {
    const prisma = makePrisma({ teacherOfClass: false });
    const svc = new UsersService(prisma, audit);
    await expect(svc.renameStudent({ id: 't2', role: 'teacher' }, 'stu1', '小明明')).rejects.toMatchObject({ status: 403, response: { code: 'not_your_class' } });
    expect(prisma.user.updateMany).not.toHaveBeenCalled();
  });

  it('班主任 / 管理员不看班级归属（学生没有在读班也能改）', async () => {
    const prisma = makePrisma({ enrollments: [] });
    const svc = new UsersService(prisma, audit);
    await svc.renameStudent({ id: 'h1', role: 'head_teacher' }, 'stu1', '小明明');
    expect(prisma.user.updateMany).toHaveBeenCalled();
  });

  it('不是学生账号 → 404', async () => {
    const prisma = makePrisma({ role: 'teacher' });
    const svc = new UsersService(prisma, audit);
    await expect(svc.renameStudent({ id: 'a1', role: 'admin' }, 'stu1', '新名字')).rejects.toMatchObject({ status: 404 });
  });

  it('**旧的管理员通用改名接口改到学生头上 → 走同一个函数**（姓名昵称一起改、写审计）', async () => {
    const prisma = makePrisma();
    const svc = new UsersService(prisma, audit);
    await svc.updateProfile('stu1', { name: '小明明' }, { id: 'a1', role: 'admin' });
    expect(prisma.user.updateMany).toHaveBeenCalledWith({ where: { id: 'stu1', name: '小明' }, data: { name: '小明明', nickname: '小明明' } });
    expect(prisma.auditLog.create).toHaveBeenCalled();
  });
});
