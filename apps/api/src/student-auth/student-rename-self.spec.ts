import { describe, expect, it, vi } from 'vitest';
import * as bcrypt from 'bcryptjs';
import { StudentAuthService } from './student-auth.service';
import { normalizeName } from './pilot-levels';
import { selfRegisterEmail } from './student-rename';

/**
 * 学生自己改登录名（2026-09-15）。
 *   · 要当前密码；输错计入与登录同一个失败计数（不能拿这里当免费试错通道）；锁定中直接拒；
 *   · 成功：姓名 / 昵称 / 注册邮箱一起改（见 student-rename.spec），这台设备换一张带新名字的票，
 *     **版本号不变**（改名不是改密码，不登出其它设备）；
 *   · 同班重名等校验失败 → 不发票。
 */

const HASH = bcrypt.hashSync('280519', 4);

function makeSvc(over: Record<string, unknown> = {}) {
  const user: any = {
    id: 'stu-1',
    role: 'student',
    name: '第一每亩',
    nickname: '第一每亩',
    email: selfRegisterEmail('c1', normalizeName('第一每亩')),
    avatar: null,
    studentAuthVersion: 2,
    pinHash: HASH,
    pinFailedCount: 0,
    pinLockedUntil: null,
    ...over,
  };
  const prisma: any = {
    user: {
      findUnique: vi.fn(async () => user),
      findMany: vi.fn(async () => (over.classmate ? [{ name: over.classmate }] : [])),
      findFirst: vi.fn(async () => null),
      update: vi.fn(async ({ data }: any) => {
        if (data?.pinFailedCount && typeof data.pinFailedCount === 'object') user.pinFailedCount += data.pinFailedCount.increment;
        else Object.assign(user, data);
        return user;
      }),
      updateMany: vi.fn(async () => ({ count: 1 })),
    },
    classEnrollment: { findMany: vi.fn(async () => [{ classId: 'c1', class: { archivedAt: null } }]) },
    auditLog: { create: vi.fn(async () => ({})) },
  };
  prisma.$transaction = vi.fn(async (fn: any) => fn(prisma));
  const jwt: any = { signAsync: vi.fn(async () => 'new-token') };
  return { svc: new StudentAuthService(prisma, jwt), prisma, jwt, user };
}

describe('renameSelf', () => {
  it('**当前密码错 → 401，失败计数 +1，一个字都不改、不发票**', async () => {
    const { svc, prisma, jwt, user } = makeSvc();
    await expect(svc.renameSelf('stu-1', '喻耀程', '999999')).rejects.toMatchObject({ status: 401, response: { code: 'invalid_credentials' } });
    expect(user.pinFailedCount).toBe(1);
    expect(prisma.user.updateMany).not.toHaveBeenCalled();
    expect(jwt.signAsync).not.toHaveBeenCalled();
  });

  it('锁定中 → 403 pin_locked，不比对密码、不改', async () => {
    const { svc, prisma } = makeSvc({ pinLockedUntil: new Date(Date.now() + 10 * 60_000) });
    await expect(svc.renameSelf('stu-1', '喻耀程', '280519')).rejects.toMatchObject({ status: 403, response: { code: 'pin_locked' } });
    expect(prisma.user.updateMany).not.toHaveBeenCalled();
  });

  it('**成功：改名并留审计；新票带新名字、版本号不变（其它设备不被登出）**', async () => {
    const { svc, prisma, jwt } = makeSvc();
    const r = await svc.renameSelf('stu-1', '喻耀程', '280519', '1.2.3.4');
    expect(prisma.user.updateMany).toHaveBeenCalledWith({
      where: { id: 'stu-1', name: '第一每亩' },
      data: { name: '喻耀程', nickname: '喻耀程', email: selfRegisterEmail('c1', normalizeName('喻耀程')) },
    });
    expect(prisma.auditLog.create).toHaveBeenCalledWith({
      data: expect.objectContaining({ action: 'student.rename', actorId: 'stu-1', actorRole: 'student', ip: '1.2.3.4', metadata: { source: 'student_self' } }),
    });
    expect(jwt.signAsync).toHaveBeenCalledWith(
      { id: 'stu-1', email: selfRegisterEmail('c1', normalizeName('喻耀程')), role: 'student', name: '喻耀程', av: 2 },
      expect.anything(),
    );
    expect(r).toEqual({ ok: true, token: 'new-token', student: { id: 'stu-1', name: '喻耀程', nickname: '喻耀程', avatar: null } });
  });

  it('同班重名 → 409，不发票', async () => {
    const { svc, jwt } = makeSvc({ classmate: '喻耀程' });
    await expect(svc.renameSelf('stu-1', '喻耀程', '280519')).rejects.toMatchObject({ status: 409, response: { code: 'name_taken_in_class' } });
    expect(jwt.signAsync).not.toHaveBeenCalled();
  });
});
