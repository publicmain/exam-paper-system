import { describe, expect, it, vi } from 'vitest';
import * as bcrypt from 'bcryptjs';
import { AdminRbacService } from './admin-rbac.service';
import { AuditService } from '../audit/audit.service';
import { StudentAuthService } from '../student-auth/student-auth.service';
import { assertTokenLive, LEGACY_DEACTIVATED_PREFIX } from '../common/account-lifecycle';

/**
 * S04（2026-09-11 审计）—— 后台「停用」与学生真实登录状态一致。
 *
 * ## 修之前
 *
 * `AdminRbacService.update({ isActive:false })` 只在 `passwordHash` 前面加
 * 一个 `!DEACTIVATED!:` 前缀。教职工密码登录因此失败 —— 可学生登录用的是
 * `pinHash`，`isActive` 列没动、`studentAuthVersion` 没动：后台列表显示
 * 「已停用」，学生照样能用密码登录，手里 30 天的令牌照样能用。
 *
 * ## 这里怎么测
 *
 * 一份**内存用户表**同时喂给真实的 AdminRbacService、真实的
 * StudentAuthService（登录）和真实的令牌生命周期判据（现有会话）：
 * 停用之后「库、列表、新登录、现有会话」四处看到的必须是同一个事实。
 * 不连任何数据库。
 */

const PIN = 'lotus-2718';
const PIN_HASH = bcrypt.hashSync(PIN, 4);
const STAFF_HASH = bcrypt.hashSync('staff-password', 4);

type Row = Record<string, any>;

function userRow(over: Row = {}): Row {
  return {
    id: 'stu-1',
    email: 's1@pilot.invalid',
    name: '甲同学',
    role: 'student',
    isActive: true,
    archivedAt: null,
    studentAuthVersion: 0,
    passwordHash: STAFF_HASH,
    pinHash: PIN_HASH,
    pinFailedCount: 0,
    pinLockedUntil: null,
    nickname: null,
    avatar: null,
    createdAt: new Date('2026-09-01T00:00:00Z'),
    lastLogin: null,
    classEnrollments: [{ class: { id: 'c1', name: 'IAL26W' } }],
    ...over,
  };
}

/** where 求值：只实现这几个服务真实用到的条件。 */
function matches(row: Row, where: Row | undefined): boolean {
  if (!where) return true;
  for (const [k, v] of Object.entries(where)) {
    if (k === 'classEnrollments') continue; // 假定都在读
    if (k === 'NOT') {
      const not = v as Row;
      if (not.passwordHash?.startsWith != null && String(row.passwordHash ?? '').startsWith(not.passwordHash.startsWith)) return false;
      continue;
    }
    if (k === 'OR') {
      const ok = (v as Row[]).some((c) =>
        Object.entries(c).some(([f, cond]: [string, any]) =>
          String(row[f] ?? '').toLowerCase().includes(String(cond.contains ?? '').toLowerCase()),
        ),
      );
      if (!ok) return false;
      continue;
    }
    if (v && typeof v === 'object' && 'in' in (v as Row)) {
      if (!(v as Row).in.includes(row[k])) return false;
      continue;
    }
    if (row[k] !== v) return false;
  }
  return true;
}

function apply(row: Row, data: Row) {
  for (const [k, v] of Object.entries(data)) {
    if (v && typeof v === 'object' && 'increment' in (v as Row)) row[k] = (row[k] ?? 0) + (v as Row).increment;
    else row[k] = v;
  }
}

function makeDb(users: Row[], subs: Row[] = []) {
  const audits: Row[] = [];
  const writes: string[] = [];
  const prisma: any = {
    user: {
      findUnique: vi.fn(async ({ where }: Row) => users.find((u) => u.id === where.id) ?? null),
      findFirst: vi.fn(async ({ where }: Row) => users.find((u) => matches(u, where)) ?? null),
      findMany: vi.fn(async ({ where }: Row = {}) => users.filter((u) => matches(u, where))),
      count: vi.fn(async ({ where }: Row = {}) => users.filter((u) => matches(u, where)).length),
      update: vi.fn(async ({ where, data }: Row) => {
        writes.push('user.update');
        const u = users.find((x) => x.id === where.id);
        if (!u) throw new Error('not found');
        apply(u, data);
        return { ...u };
      }),
      updateMany: vi.fn(async ({ where, data }: Row) => {
        writes.push('user.updateMany');
        const hit = users.filter((u) => matches(u, where));
        for (const u of hit) apply(u, data);
        return { count: hit.length };
      }),
    },
    pushSubscription: {
      deleteMany: vi.fn(async ({ where }: Row) => {
        writes.push('pushSubscription.deleteMany');
        const before = subs.length;
        for (let i = subs.length - 1; i >= 0; i--) if (subs[i].studentId === where.studentId) subs.splice(i, 1);
        return { count: before - subs.length };
      }),
    },
    auditLog: {
      create: vi.fn(async ({ data }: Row) => {
        writes.push('auditLog.create');
        audits.push(data);
        return data;
      }),
    },
    classEnrollment: { findFirst: vi.fn(async () => ({ classId: 'c1' })) },
  };
  prisma.$transaction = vi.fn(async (fn: any) => (typeof fn === 'function' ? fn(prisma) : Promise.all(fn)));
  const jwt: any = { signAsync: vi.fn(async (p: Row) => JSON.stringify(p)) };
  const rbac = new AdminRbacService(prisma, new AuditService(prisma));
  const auth = new StudentAuthService(prisma, jwt);
  return { prisma, rbac, auth, jwt, users, subs, audits, writes };
}

const ADMIN = { id: 'adm-1', role: 'admin', ip: '10.0.0.1' };

/** 现有会话：一张在停用前签发的 30 天令牌（与 login 同构）。 */
const tokenOf = (u: Row, av = u.studentAuthVersion) => ({ id: u.id, role: 'student', name: u.name, av });

async function loginCode(auth: StudentAuthService, name = '甲同学', pin = PIN) {
  try {
    await auth.login({ name, pin });
    return 'ok';
  } catch (e: any) {
    return e?.response?.code ?? String(e);
  }
}

async function sessionCode(prisma: any, payload: Row) {
  try {
    await assertTokenLive(prisma, payload);
    return 'live';
  } catch (e: any) {
    return e?.response?.code ?? String(e);
  }
}

describe('S04 · 停用：库、列表、新登录、现有会话四处一致', () => {
  it('停用学生：isActive=false、版本号 +1、推送订阅清掉、密码摘要不再被改写', async () => {
    const db = makeDb([userRow()], [{ id: 'sub-1', studentId: 'stu-1' }, { id: 'sub-2', studentId: 'other' }]);
    const before = db.users[0].passwordHash;
    const out = await db.rbac.update('stu-1', { isActive: false }, ADMIN);
    expect(out.isActive).toBe(false);
    expect(db.users[0].isActive).toBe(false);
    expect(db.users[0].studentAuthVersion).toBe(1);
    expect(db.users[0].passwordHash).toBe(before);
    expect(db.subs.map((s) => s.id)).toEqual(['sub-2']);
  });

  it('停用之后：列表显示已停用，新登录失败，停用前签发的令牌当场失效', async () => {
    const db = makeDb([userRow()]);
    const old = tokenOf(db.users[0]);
    expect(await loginCode(db.auth)).toBe('ok');
    expect(await sessionCode(db.prisma, old)).toBe('live');

    await db.rbac.update('stu-1', { isActive: false }, ADMIN);

    const list = await db.rbac.listUsers({});
    expect(list.users.find((u: Row) => u.id === 'stu-1')?.isActive).toBe(false);
    expect(await loginCode(db.auth)).toBe('invalid_credentials');
    expect(await sessionCode(db.prisma, old)).toBe('token_revoked');
  });

  it('恢复启用：能重新登录，但停用前的旧令牌**不会复活**', async () => {
    const db = makeDb([userRow()]);
    const old = tokenOf(db.users[0]);
    await db.rbac.update('stu-1', { isActive: false }, ADMIN);
    const back = await db.rbac.update('stu-1', { isActive: true }, ADMIN);
    expect(back.isActive).toBe(true);
    expect(db.users[0].isActive).toBe(true);
    expect(db.users[0].studentAuthVersion).toBe(1); // 恢复不回退版本号
    expect(await sessionCode(db.prisma, old)).toBe('token_revoked');
    expect(await loginCode(db.auth)).toBe('ok');
    expect(await sessionCode(db.prisma, tokenOf(db.users[0]))).toBe('live');
  });

  it('防自我停用仍在：管理员停用自己 → 400，零写库', async () => {
    const db = makeDb([userRow({ id: 'adm-1', role: 'admin', pinHash: null })]);
    await expect(db.rbac.update('adm-1', { isActive: false }, ADMIN)).rejects.toMatchObject({ status: 400 });
    expect(db.writes).toEqual([]);
    expect(db.users[0].isActive).toBe(true);
  });

  it('操作审计：停用 / 恢复各留一条，diff 写的是真实的前后状态，操作人是当前管理员', async () => {
    const db = makeDb([userRow()]);
    await db.rbac.update('stu-1', { isActive: false }, ADMIN);
    await db.rbac.update('stu-1', { isActive: true }, ADMIN);
    expect(db.audits).toHaveLength(2);
    expect(db.audits[0]).toMatchObject({
      actorId: 'adm-1',
      actorRole: 'admin',
      action: 'admin.rbac.user.update',
      entityId: 'stu-1',
      diff: { isActive: { from: true, to: false } },
      ip: '10.0.0.1',
    });
    expect(db.audits[1].diff).toMatchObject({ isActive: { from: false, to: true } });
  });

  it('重复停用是 no-op：不再递增版本号、不再写审计', async () => {
    const db = makeDb([userRow()]);
    await db.rbac.update('stu-1', { isActive: false }, ADMIN);
    const writes = db.writes.length;
    await db.rbac.update('stu-1', { isActive: false }, ADMIN);
    expect(db.writes.length).toBe(writes);
    expect(db.users[0].studentAuthVersion).toBe(1);
  });

  it('停用教职工：旧令牌 401 token_revoked，密码登录由 isActive 拦（摘要不动）', async () => {
    const db = makeDb([userRow({ id: 't-1', role: 'teacher', pinHash: null })]);
    await db.rbac.update('t-1', { isActive: false }, ADMIN);
    expect(db.users[0].isActive).toBe(false);
    expect(await sessionCode(db.prisma, { id: 't-1', role: 'teacher' })).toBe('token_revoked');
  });
});

describe('S04 · 旧版停用标记（passwordHash 前缀）的存量行', () => {
  const legacy = () => userRow({ passwordHash: LEGACY_DEACTIVATED_PREFIX + STAFF_HASH });

  it('数据修复之前：列表、新登录、现有会话都按「已停用」处理', async () => {
    const db = makeDb([legacy()]);
    const list = await db.rbac.listUsers({});
    expect(list.users[0].isActive).toBe(false);
    expect(await loginCode(db.auth)).toBe('invalid_credentials');
    expect(await sessionCode(db.prisma, tokenOf(db.users[0]))).toBe('token_revoked');
  });

  it('恢复启用：去掉前缀、isActive=true，可以登录；旧办法停用前签发的令牌**不会**因去掉前缀而复活', async () => {
    // 旧办法停用时版本号没动过：停用前签发的令牌只是被前缀判据挡着
    const db = makeDb([legacy()], [{ id: 'sub-legacy', studentId: 'stu-1' }]);
    const beforeLegacyDeactivation = tokenOf(db.users[0]);
    const out = await db.rbac.update('stu-1', { isActive: true }, ADMIN);
    expect(out.isActive).toBe(true);
    expect(db.users[0].passwordHash).toBe(STAFF_HASH);
    expect(db.users[0].studentAuthVersion).toBe(1);
    expect(db.subs).toEqual([]);
    expect(await sessionCode(db.prisma, beforeLegacyDeactivation)).toBe('token_revoked');
    expect(await loginCode(db.auth)).toBe('ok');
    expect(db.audits[0].metadata).toMatchObject({ legacyDeactivationNormalised: true, sessionsRevoked: true });
  });

  it('再次停用：规范成 isActive=false + 版本号 +1，同时去掉旧前缀', async () => {
    const db = makeDb([legacy()]);
    await db.rbac.update('stu-1', { isActive: false }, ADMIN);
    expect(db.users[0].isActive).toBe(false);
    expect(db.users[0].studentAuthVersion).toBe(1);
    expect(db.users[0].passwordHash).toBe(STAFF_HASH);
  });
});

describe('S04 / S03 · 后台重置密码 = 登出所有设备', () => {
  it('重置后：旧令牌失效、推送订阅清掉；停用状态保持不变；审计不含明文与摘要', async () => {
    const db = makeDb([userRow({ isActive: false })], [{ id: 'sub-1', studentId: 'stu-1' }]);
    const old = tokenOf(db.users[0]);
    await db.rbac.resetPassword('stu-1', 'new-password-123', ADMIN);
    expect(db.users[0].studentAuthVersion).toBe(1);
    expect(db.users[0].isActive).toBe(false);
    expect(bcrypt.compareSync('new-password-123', db.users[0].passwordHash)).toBe(true);
    expect(db.subs).toEqual([]);
    expect(await sessionCode(db.prisma, old)).toBe('token_revoked');
    const audit = JSON.stringify(db.audits);
    expect(audit).not.toContain('new-password-123');
    expect(audit).not.toContain(db.users[0].passwordHash);
  });

  it('旧版前缀行重置密码：规范成 isActive=false，摘要不再带前缀', async () => {
    const db = makeDb([userRow({ passwordHash: LEGACY_DEACTIVATED_PREFIX + STAFF_HASH })]);
    await db.rbac.resetPassword('stu-1', 'new-password-123', ADMIN);
    expect(db.users[0].isActive).toBe(false);
    expect(db.users[0].passwordHash.startsWith(LEGACY_DEACTIVATED_PREFIX)).toBe(false);
  });
});
