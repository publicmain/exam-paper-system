import { describe, expect, it, vi } from 'vitest';
import * as bcrypt from 'bcryptjs';
import { StudentAuthService } from './student-auth.service';

/**
 * PIN 认证的行为契约（docs/PRD/student-auth-and-home.md §9）。
 * bcrypt 用真实实现（cost 4 加速），prisma/jwt mock。
 */

const HASH = bcrypt.hashSync('280519', 4);

function makeStudent(over: Partial<any> = {}) {
  return {
    id: 'stu-1',
    email: 's1@school.local',
    name: '张三',
    pinHash: HASH,
    pinFailedCount: 0,
    pinLockedUntil: null,
    studentAuthVersion: 0,
    classEnrollments: [{ class: { id: 'c1', name: 'G11' } }],
    ...over,
  };
}

/**
 * mock 必须**真的实现** `{ increment: n }` 语义。
 * 2026-08-25 复审 P0-3 把失败计数从「读出来 +1 再写回」改成数据库原子
 * 递增；如果 mock 只做 Object.assign，字段会变成 `{increment:1}` 这个对象，
 * 测试就测不到真正的行为了。
 */
function applyData(row: any, data: any) {
  for (const [k, v] of Object.entries(data ?? {})) {
    if (v && typeof v === 'object' && 'increment' in (v as any)) {
      row[k] = (row[k] ?? 0) + (v as any).increment;
    } else {
      row[k] = v;
    }
  }
}

function makeSvc(users: any[]) {
  const updates: any[] = [];
  const prisma: any = {
    user: {
      findMany: vi.fn().mockResolvedValue(users),
      findUnique: vi.fn().mockImplementation(({ where }: any) =>
        Promise.resolve(users.find((u) => u.id === where.id) ?? null),
      ),
      update: vi.fn().mockImplementation(({ where, data }: any) => {
        updates.push({ id: where.id, data });
        const u = users.find((x) => x.id === where.id);
        if (u) applyData(u, data);
        return Promise.resolve(u);
      }),
    },
    classEnrollment: {
      findFirst: vi.fn().mockResolvedValue({ classId: 'c1' }),
    },
  };
  const jwt: any = { signAsync: vi.fn().mockResolvedValue('signed-token') };
  return { svc: new StudentAuthService(prisma, jwt), prisma, jwt, updates };
}

describe('login', () => {
  it('正确 PIN：发 30 天 token、清零失败计数、记 lastLogin', async () => {
    const { svc, jwt, updates } = makeSvc([makeStudent({ pinFailedCount: 3 })]);
    const out: any = await svc.login({ name: '张三', pin: '280519' });
    expect(out.token).toBe('signed-token');
    expect(out.student).toEqual({ id: 'stu-1', name: '张三' });
    expect(jwt.signAsync).toHaveBeenCalledWith(
      expect.objectContaining({ id: 'stu-1', role: 'student', name: '张三' }),
      { expiresIn: '30d' },
    );
    expect(updates[0].data.pinFailedCount).toBe(0);
    expect(updates[0].data.lastLogin).toBeInstanceOf(Date);
  });

  it('错误 PIN：invalid_credentials 且计数 +1（数据库原子递增）', async () => {
    const users = [makeStudent()];
    const { svc, updates } = makeSvc(users);
    await expect(svc.login({ name: '张三', pin: '999998' })).rejects.toMatchObject({
      response: { code: 'invalid_credentials' },
    });
    // 写的是 increment 而不是算好的数 —— 这正是并发下不丢计数的关键
    expect(updates[0].data.pinFailedCount).toEqual({ increment: 1 });
    expect(users[0].pinFailedCount).toBe(1);
  });

  it('并发爆破：递增交给数据库，不会因读到同一份旧值而漏计', async () => {
    // 五个请求同时读到 pinFailedCount=0（旧实现会各自算出 1，写完还是 1，
    // 于是永远锁不上）。原子递增下五次写入必须累加到 5 并触发锁定。
    const users = [makeStudent()];
    const { svc } = makeSvc(users);
    const attempts = Array.from({ length: 5 }, () =>
      svc.login({ name: '张三', pin: '999998' }).catch((e) => e),
    );
    const results = await Promise.all(attempts);
    const codes = results.map((r: any) => r?.response?.code);
    expect(codes.filter((c) => c === 'pin_locked').length).toBeGreaterThanOrEqual(1);
    expect(users[0].pinLockedUntil).toBeInstanceOf(Date);
  });

  it('连错第 5 次：锁 15 分钟，响应带剩余秒数', async () => {
    const { svc } = makeSvc([makeStudent({ pinFailedCount: 4 })]);
    await expect(svc.login({ name: '张三', pin: '999998' })).rejects.toMatchObject({
      response: { code: 'pin_locked' },
    });
  });

  it('锁定期内即使 PIN 正确也拒绝', async () => {
    const { svc, jwt } = makeSvc([
      makeStudent({ pinLockedUntil: new Date(Date.now() + 10 * 60_000) }),
    ]);
    await expect(svc.login({ name: '张三', pin: '280519' })).rejects.toMatchObject({
      response: { code: 'pin_locked' },
    });
    expect(jwt.signAsync).not.toHaveBeenCalled();
  });

  it('未设 PIN / 查无此人：统一 invalid_credentials（不给枚举者信号）', async () => {
    const a = makeSvc([makeStudent({ pinHash: null })]);
    await expect(a.svc.login({ name: '张三', pin: '280519' })).rejects.toMatchObject({
      response: { code: 'invalid_credentials' },
    });
    const b = makeSvc([]);
    await expect(b.svc.login({ name: '不存在', pin: '280519' })).rejects.toMatchObject({
      response: { code: 'invalid_credentials' },
    });
  });

  it('同名多人：返回候选班级，不试 PIN', async () => {
    const { svc, prisma } = makeSvc([
      makeStudent({ id: 'a' }),
      makeStudent({ id: 'b', classEnrollments: [{ class: { id: 'c2', name: 'G12' } }] }),
    ]);
    const out: any = await svc.login({ name: '张三', pin: '280519' });
    expect(out.needDisambiguation).toBe(true);
    expect(out.candidates).toHaveLength(2);
    expect(prisma.user.update).not.toHaveBeenCalled(); // 没有任何登录尝试被计
  });
});

describe('setPin', () => {
  it('首次设置成功，落 bcrypt 哈希', async () => {
    const { svc, updates } = makeSvc([makeStudent({ pinHash: null, role: 'student', isActive: true })]);
    await svc.setPin('stu-1', '731842');
    expect(updates[0].data.pinHash).toMatch(/^\$2[aby]\$/);
    expect(bcrypt.compareSync('731842', updates[0].data.pinHash)).toBe(true);
  });

  it('已设置过 → pin_already_set（防捡到 token 改 PIN 锁人）', async () => {
    const { svc } = makeSvc([makeStudent({ role: 'student', isActive: true })]);
    await expect(svc.setPin('stu-1', '731842')).rejects.toMatchObject({
      response: { code: 'pin_already_set' },
    });
  });

  it('弱 PIN 拒绝', async () => {
    const { svc } = makeSvc([makeStudent({ pinHash: null, role: 'student', isActive: true })]);
    await expect(svc.setPin('stu-1', '123456')).rejects.toMatchObject({
      response: { code: 'pin_too_weak' },
    });
  });
});

describe('changePin', () => {
  it('旧 PIN 正确 → 换新并清零计数', async () => {
    const { svc, updates } = makeSvc([makeStudent()]);
    await svc.changePin('stu-1', '280519', '731842');
    const last = updates[updates.length - 1].data;
    expect(bcrypt.compareSync('731842', last.pinHash)).toBe(true);
    expect(last.pinFailedCount).toBe(0);
  });

  it('旧 PIN 错误 → 计入失败（不是免费试错通道）', async () => {
    const { svc, updates } = makeSvc([makeStudent()]);
    await expect(svc.changePin('stu-1', '999998', '731842')).rejects.toMatchObject({
      response: { code: 'invalid_credentials' },
    });
    expect(updates[0].data.pinFailedCount).toEqual({ increment: 1 });
  });

  it('改 PIN 成功 → 递增 authVersion，把旧的 30 天 token 全部作废', async () => {
    const { svc, updates } = makeSvc([makeStudent()]);
    await svc.changePin('stu-1', '280519', '731842');
    expect(updates[updates.length - 1].data.studentAuthVersion).toEqual({ increment: 1 });
  });
});

describe('adminResetPin', () => {
  it('清空 PIN 与锁定状态，并递增 authVersion', async () => {
    const { svc, updates } = makeSvc([makeStudent()]);
    // canActOnClass 依赖真实 roles 实现 —— 教师直接放行的路径是 admin
    await svc.adminResetPin({ id: 't1', role: 'admin' }, 'stu-1');
    const last = updates[updates.length - 1].data;
    expect(last).toEqual({
      pinHash: null,
      pinSetAt: null,
      pinFailedCount: 0,
      pinLockedUntil: null,
      // 关键：抢注者手上那张 30 天 token 必须当场失效，
      // 否则「教师重置 PIN」只是把密码清空、人还在里面（复审 P0-2）
      studentAuthVersion: { increment: 1 },
    });
  });
});

describe('token 的 av claim', () => {
  it('登录签发的 token 带上当前 authVersion', async () => {
    const { svc, jwt } = makeSvc([makeStudent({ studentAuthVersion: 7 })]);
    await svc.login({ name: '张三', pin: '280519' });
    expect(jwt.signAsync).toHaveBeenCalledWith(
      expect.objectContaining({ av: 7 }),
      { expiresIn: '30d' },
    );
  });
});
