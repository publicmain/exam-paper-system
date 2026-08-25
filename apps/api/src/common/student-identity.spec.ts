import { describe, expect, it, vi } from 'vitest';
import { StudentIdentityGuard, claimedIdentity, identityConflicts } from './student-identity.guard';

/**
 * 学生越权阻断（2026-08-25 外部审查 P0-1）。
 *
 * 修之前：身份 = 请求里的姓名字符串。知道同学姓名就能替他加词、删词、
 * 提交/撤销复习、销账错题（OWASP API1:2023 BOLA）。
 */

const me = { id: 'stu-1', name: '张三' };

describe('claimedIdentity — 从请求里取声明身份', () => {
  it('query 上的 name / studentId', () => {
    expect(claimedIdentity({ query: { name: '李四', studentId: 'x' }, body: {} } as any))
      .toEqual({ name: '李四', studentId: 'x' });
  });
  it('body 上的 studentName（vocab 写接口用这个字段名）', () => {
    expect(claimedIdentity({ query: {}, body: { studentName: '李四' } } as any).name).toBe('李四');
  });
  it('query 优先于 body', () => {
    expect(claimedIdentity({ query: { name: 'A' }, body: { name: 'B' } } as any).name).toBe('A');
  });
  it('空白与缺失都归一成 undefined', () => {
    expect(claimedIdentity({ query: { name: '   ' }, body: {} } as any).name).toBeUndefined();
    expect(claimedIdentity({ query: {}, body: {} } as any)).toEqual({ name: undefined, studentId: undefined });
  });
});

describe('identityConflicts — 拿自己的 token 操作别人必须被拦', () => {
  it('姓名不符 → 冲突', () => {
    expect(identityConflicts(me, { name: '李四' })).toBe(true);
  });
  it('studentId 不符 → 冲突', () => {
    expect(identityConflicts(me, { name: '张三', studentId: 'stu-2' })).toBe(true);
  });
  it('两者都符 → 放行', () => {
    expect(identityConflicts(me, { name: '张三', studentId: 'stu-1' })).toBe(false);
  });
  it('请求没声明身份 → 不算冲突（后端会用 token 的身份）', () => {
    expect(identityConflicts(me, {})).toBe(false);
  });
  it('姓名首尾空白不算冲突', () => {
    expect(identityConflicts(me, { name: '  张三  ' })).toBe(false);
  });
  it('同名不同人靠 studentId 区分 —— 姓名相同但 id 不同仍是冲突', () => {
    expect(identityConflicts({ id: 'stu-1', name: '孙爱迪' }, { name: '孙爱迪', studentId: 'stu-9' })).toBe(true);
  });
  it('不做模糊匹配 —— 差一个字也是冲突', () => {
    expect(identityConflicts(me, { name: '张三丰' })).toBe(true);
  });
});

// ─────────────────────────────────────────────────────────────────────
// 长期 token 的撤销（2026-08-25 复审 P0-2）
// ─────────────────────────────────────────────────────────────────────

function makeCtx(authHeader?: string, query: Record<string, any> = {}) {
  const req: any = { headers: authHeader ? { authorization: authHeader } : {}, query, body: {} };
  return {
    req,
    ctx: {
      switchToHttp: () => ({ getRequest: () => req }),
      getHandler: () => ({}),
      getClass: () => ({}),
    } as any,
  };
}

function makeGuard(payload: any, dbRow: any) {
  const jwt: any = { verifyAsync: vi.fn().mockResolvedValue(payload) };
  const prisma: any = { user: { findUnique: vi.fn().mockResolvedValue(dbRow) } };
  const reflector: any = { getAllAndOverride: vi.fn().mockReturnValue(false) };
  return { guard: new StudentIdentityGuard(jwt, reflector, prisma), prisma };
}

const ACTIVE = { studentAuthVersion: 3, isActive: true, archivedAt: null };

describe('StudentIdentityGuard — 撤销校验', () => {
  it('版本一致 → 放行，身份挂上 req', async () => {
    const { guard } = makeGuard(
      { id: 'stu-1', name: '张三', role: 'student', av: 3 },
      ACTIVE,
    );
    const { ctx, req } = makeCtx('Bearer x');
    await expect(guard.canActivate(ctx)).resolves.toBe(true);
    expect(req.studentAuth).toEqual({ id: 'stu-1', name: '张三' });
  });

  it('教师重置 PIN 后版本对不上 → 403 token_revoked（抢注者当场下线）', async () => {
    const { guard } = makeGuard(
      { id: 'stu-1', name: '张三', role: 'student', av: 3 },
      { ...ACTIVE, studentAuthVersion: 4 },
    );
    const { ctx } = makeCtx('Bearer x');
    await expect(guard.canActivate(ctx)).rejects.toMatchObject({
      response: { code: 'token_revoked' },
    });
  });

  it('账号停用 / 已归档 → 一样拒绝', async () => {
    for (const row of [
      { ...ACTIVE, isActive: false },
      { ...ACTIVE, archivedAt: new Date() },
      null,
    ]) {
      const { guard } = makeGuard({ id: 'stu-1', name: '张三', role: 'student', av: 3 }, row);
      const { ctx } = makeCtx('Bearer x');
      await expect(guard.canActivate(ctx)).rejects.toMatchObject({
        response: { code: 'token_revoked' },
      });
    }
  });

  it('撤销不能被降级成「没带 token」—— 读操作也必须拒绝', async () => {
    // catch 块若把 ForbiddenException 吞掉，这里会 resolve(true) 并放行，
    // 被作废的凭证等于还能读成绩。
    const { guard } = makeGuard(
      { id: 'stu-1', name: '张三', role: 'student', av: 3 },
      { ...ACTIVE, studentAuthVersion: 9 },
    );
    const { ctx } = makeCtx('Bearer x', { name: '张三' });
    await expect(guard.canActivate(ctx)).rejects.toMatchObject({
      response: { code: 'token_revoked' },
    });
  });

  it('扫码签发的当天 token（无 av）不查库 —— 不给每次答题加一次往返', async () => {
    const { guard, prisma } = makeGuard(
      { id: 'stu-1', name: '张三', role: 'student' },
      ACTIVE,
    );
    const { ctx } = makeCtx('Bearer x');
    await expect(guard.canActivate(ctx)).resolves.toBe(true);
    expect(prisma.user.findUnique).not.toHaveBeenCalled();
  });

  it('handoff 窄凭证不算学生身份，也不触发撤销查询', async () => {
    const { guard, prisma } = makeGuard(
      { id: 'stu-1', name: '张三', role: 'student', scope: 'mq_handoff', av: 3 },
      ACTIVE,
    );
    const { ctx, req } = makeCtx('Bearer x');
    await expect(guard.canActivate(ctx)).resolves.toBe(true);
    expect(req.studentAuth).toBeUndefined();
    expect(prisma.user.findUnique).not.toHaveBeenCalled();
  });
});
