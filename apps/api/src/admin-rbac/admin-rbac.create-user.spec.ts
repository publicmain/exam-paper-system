import { describe, expect, it, vi } from 'vitest';
import * as bcrypt from 'bcryptjs';
import { AdminRbacService } from './admin-rbac.service';

/**
 * 后台新建教职工账号（2026-09-15）。
 *
 * 钉四件事：邮箱规范成登录要填的写法；密码只落 bcrypt 摘要，响应和审计里都没有；
 * 同一个邮箱不能建第二个（不分大小写，并发也不行）；学生账号不从这里建。
 */

const ACTOR = { id: 'admin-1', role: 'admin', ip: '203.0.113.1' };

function setup(existing: Array<{ id: string; email: string }> = []) {
  const users: Array<Record<string, any>> = [...existing];
  const audits: Array<{ entry: any; tx: unknown }> = [];
  const tx = {
    user: {
      create: vi.fn(async ({ data, select }: any) => {
        const row = { id: 'new-1', createdAt: new Date('2026-09-15T00:00:00Z'), lastLogin: null, ...data };
        users.push(row);
        return Object.fromEntries(Object.keys(select).map((k) => [k, (row as any)[k]]));
      }),
    },
  };
  const prisma: any = {
    user: {
      findFirst: vi.fn(async ({ where }: any) => users.find((u) => u.email.toLowerCase() === String(where.email.equals).toLowerCase()) ?? null),
    },
    $transaction: vi.fn(async (fn: (t: unknown) => unknown) => fn(tx)),
  };
  const audit: any = {
    log: vi.fn(async (entry: any, t: unknown) => {
      audits.push({ entry, tx: t });
    }),
  };
  return { svc: new AdminRbacService(prisma, audit), prisma, tx, users, audits };
}

describe('后台新建教职工账号', () => {
  it('建好：邮箱去空白转小写；密码只存摘要；响应不带摘要；审计和建号在同一个事务、不含密码', async () => {
    const { svc, tx, users, audits } = setup();
    const row = await svc.createUser({ email: '  Leader@ESIC.edu.sg ', name: ' 王校长 ', role: 'admin', password: 'long-password-1' }, ACTOR);

    expect(row).toMatchObject({ email: 'leader@esic.edu.sg', name: '王校长', role: 'admin', isActive: true });
    expect(JSON.stringify(row)).not.toMatch(/passwordHash|long-password-1/);
    expect(await bcrypt.compare('long-password-1', users[0].passwordHash)).toBe(true);

    expect(audits).toHaveLength(1);
    expect(audits[0].tx).toBe(tx);
    expect(audits[0].entry).toMatchObject({ actorId: 'admin-1', action: 'admin.rbac.user.create', entityId: 'new-1', metadata: { targetEmail: 'leader@esic.edu.sg', role: 'admin' } });
    expect(JSON.stringify(audits[0].entry)).not.toMatch(/long-password-1|\$2[aby]\$/);
  });

  it('邮箱已经有人用（不分大小写）→ 409 email_taken，一行都不建', async () => {
    const { svc, tx, audits } = setup([{ id: 'u1', email: 'leader@esic.edu.sg' }]);
    await expect(svc.createUser({ email: 'LEADER@esic.edu.sg', name: '王校长', role: 'admin', password: 'long-password-1' }, ACTOR)).rejects.toMatchObject({
      response: { code: 'email_taken' },
    });
    expect(tx.user.create).not.toHaveBeenCalled();
    expect(audits).toHaveLength(0);
  });

  it('两个人同时建同一个邮箱：唯一约束冲突也回 409，不是 500', async () => {
    const { svc, tx } = setup();
    tx.user.create.mockRejectedValueOnce(Object.assign(new Error('Unique constraint failed'), { code: 'P2002' }));
    await expect(svc.createUser({ email: 'a@b.co', name: '甲', role: 'teacher', password: 'long-password-1' }, ACTOR)).rejects.toMatchObject({
      response: { code: 'email_taken' },
    });
  });

  it('学生账号、坏邮箱、太短的密码 → 400，一行都不建', async () => {
    const { svc, tx } = setup();
    await expect(svc.createUser({ email: 'a@b.co', name: '甲', role: 'student', password: 'long-password-1' }, ACTOR)).rejects.toMatchObject({
      response: { code: 'role_not_allowed' },
    });
    await expect(svc.createUser({ email: 'not-an-email', name: '甲', role: 'teacher', password: 'long-password-1' }, ACTOR)).rejects.toMatchObject({
      response: { code: 'bad_email' },
    });
    await expect(svc.createUser({ email: 'a@b.co', name: '甲', role: 'teacher', password: 'short' }, ACTOR)).rejects.toThrow('at least 8');
    expect(tx.user.create).not.toHaveBeenCalled();
  });
});
