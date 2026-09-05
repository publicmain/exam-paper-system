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
    pinClaimOpenUntil: null,
    classEnrollments: [{ class: { id: 'c1', name: 'G11', pinClaimOpenUntil: null } }],
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
      updateMany: vi.fn().mockResolvedValue({ count: 0 }),
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
    expect(out.student).toEqual({
      id: 'stu-1',
      name: '张三',
      nickname: '张三',
      avatar: null,
    });
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

  it('同名多人、密码只对得上一个 → 直接登录那一个，不露班级（2026-09-05）', async () => {
    const other = bcrypt.hashSync('999999', 4);
    const { svc, jwt } = makeSvc([
      makeStudent({ id: 'a', pinHash: other }),
      makeStudent({ id: 'b', classEnrollments: [{ class: { id: 'c2', name: 'G12' } }] }),
    ]);
    const out: any = await svc.login({ name: '张三', pin: '280519' });
    expect(out.needDisambiguation).toBeUndefined();
    expect(out.student.id).toBe('b');
    expect(jwt.signAsync).toHaveBeenCalled();
  });

  it('同名多人、密码一个都不对 → invalid_credentials，不列班级', async () => {
    const { svc, prisma } = makeSvc([
      makeStudent({ id: 'a' }),
      makeStudent({ id: 'b', classEnrollments: [{ class: { id: 'c2', name: 'G12' } }] }),
    ]);
    await expect(svc.login({ name: '张三', pin: '000000' })).rejects.toMatchObject({
      response: { code: 'invalid_credentials' },
    });
    expect(prisma.user.updateMany).toHaveBeenCalled(); // 失败计入每个同名账号
  });

  it('同名多人、密码碰巧都对 → 只列对得上的候选让他挑', async () => {
    const { svc } = makeSvc([
      makeStudent({ id: 'a' }),
      makeStudent({ id: 'b', classEnrollments: [{ class: { id: 'c2', name: 'G12' } }] }),
      makeStudent({ id: 'c', pinHash: bcrypt.hashSync('999999', 4) }),
    ]);
    const out: any = await svc.login({ name: '张三', pin: '280519' });
    expect(out.needDisambiguation).toBe(true);
    expect(out.candidates.map((c: any) => c.studentId)).toEqual(['a', 'b']);
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

describe('register —— 网站式注册（2026-08-26）', () => {
  const fresh = () =>
    makeStudent({ pinHash: null, role: 'student', isActive: true });

  it('首次注册：写哈希+昵称+头像，返回带 av 的 token（成功即登录）', async () => {
    const users = [fresh()];
    const { svc, jwt, updates } = makeSvc(users);
    const out: any = await svc.register({
      name: '张三',
      password: 'abc123',
      nickname: '小张',
      avatar: 'emoji:🦊',
    });
    expect(out.token).toBe('signed-token');
    expect(out.student).toEqual({ id: 'stu-1', name: '张三', nickname: '小张', avatar: 'emoji:🦊' });
    expect(bcrypt.compareSync('abc123', updates[0].data.pinHash)).toBe(true);
    expect(updates[0].data.nickname).toBe('小张');
    expect(jwt.signAsync).toHaveBeenCalledWith(
      expect.objectContaining({ id: 'stu-1', role: 'student', av: 0 }),
      { expiresIn: '30d' },
    );
  });

  it('昵称缺省 = 真名；头像可选不写库', async () => {
    const { svc, updates } = makeSvc([fresh()]);
    const out: any = await svc.register({ name: '张三', password: 'abc123' });
    expect(out.student.nickname).toBe('张三');
    expect('avatar' in updates[0].data).toBe(false);
  });

  it('已注册 → already_registered（捡到链接的人不能覆盖别人密码）', async () => {
    const { svc } = makeSvc([makeStudent()]); // 带 HASH
    await expect(
      svc.register({ name: '张三', password: 'abc123' }),
    ).rejects.toMatchObject({ response: { code: 'already_registered' } });
  });

  it('弱密码拒（123456 顺子 / aaaaaa 全同）', async () => {
    const { svc } = makeSvc([fresh()]);
    await expect(svc.register({ name: '张三', password: '123456' })).rejects.toMatchObject({
      response: { code: 'password_too_weak' },
    });
    await expect(svc.register({ name: '张三', password: 'aaaaaa' })).rejects.toMatchObject({
      response: { code: 'password_too_weak' },
    });
  });

  it('同名多人 → 返回候选，不写任何东西', async () => {
    const { svc, prisma } = makeSvc([
      fresh(),
      makeStudent({ id: 'b', pinHash: null, classEnrollments: [{ class: { id: 'c2', name: 'G12', pinClaimOpenUntil: null } }] }),
    ]);
    const out: any = await svc.register({ name: '张三', password: 'abc123' });
    expect(out.needDisambiguation).toBe(true);
    expect(prisma.user.update).not.toHaveBeenCalled();
  });

  it('非法头像拒；超大头像拒', async () => {
    const { svc } = makeSvc([fresh()]);
    await expect(
      svc.register({ name: '张三', password: 'abc123', avatar: 'javascript:x' }),
    ).rejects.toMatchObject({ response: { code: 'avatar_invalid' } });
    const big = 'data:image/jpeg;base64,' + 'A'.repeat(91_000);
    await expect(
      svc.register({ name: '张三', password: 'abc123', avatar: big }),
    ).rejects.toMatchObject({ response: { code: 'avatar_too_large' } });
  });
});

describe('registrationStatus —— 打开 app 要不要弹卡', () => {
  it('未注册 → registered:false；已注册 → true', async () => {
    const a = makeSvc([makeStudent({ pinHash: null })]);
    expect(((await a.svc.registrationStatus({ name: '张三' })) as any).registered).toBe(false);
    const b = makeSvc([makeStudent()]);
    expect(((await b.svc.registrationStatus({ name: '张三' })) as any).registered).toBe(true);
  });

  it('查无此人 → found:false 不弹卡不报错（输错名字是常态）', async () => {
    const { svc } = makeSvc([]);
    const r: any = await svc.registrationStatus({ name: '不存在' });
    expect(r.found).toBe(false);
    expect(r.registered).toBe(false);
  });
});
