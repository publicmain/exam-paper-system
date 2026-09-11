import { afterEach, describe, expect, it, vi } from 'vitest';
import * as bcrypt from 'bcryptjs';
import { StudentAuthService } from './student-auth.service';
import { LOCK_MINUTES, MAX_FAILED_ATTEMPTS } from './pin';

/**
 * S07（2026-09-11 审计）—— 失败锁定对单人、同名两条登录分支一视同仁。
 *
 * ## 修之前
 *
 * 单人分支：原子递增失败计数，到第 5 次上锁 15 分钟。
 * 同名分支（多个同名学生）：只 `updateMany({ increment: 1 })`，**从不上锁**
 * —— 模拟连错 7 次，两个账号的 `pinLockedUntil` 仍是 null。于是给一个
 * 常见姓名无限次试密码，锁定形同虚设。
 *
 * ## 这里怎么测
 *
 * 内存用户表：`findMany` 返回**快照**（与真实 Prisma 一样，不是活引用），
 * `update({ increment })` 在活行上原子累加并返回新值 —— 并发用例才测得到
 * 「五个请求读到同一个旧值」那一类问题。不连任何数据库。
 */

const NAME = '王同学';
const PIN_A = 'river-3141';
const PIN_B = 'maple-2718';
const HASH_A = bcrypt.hashSync(PIN_A, 4);
const HASH_B = bcrypt.hashSync(PIN_B, 4);

type Row = Record<string, any>;

function student(over: Row): Row {
  return {
    email: `${over.id}@pilot.invalid`,
    name: NAME,
    nickname: null,
    avatar: null,
    pinFailedCount: 0,
    pinLockedUntil: null,
    studentAuthVersion: 0,
    classEnrollments: [{ class: { id: `c-${over.id}`, name: `班级-${over.id}` } }],
    ...over,
  };
}

function makeDb(users: Row[]) {
  const snap = (u: Row) => ({ ...u, classEnrollments: u.classEnrollments.map((e: Row) => ({ ...e })) });
  const prisma: any = {
    user: {
      findMany: vi.fn(async ({ where }: Row) =>
        users.filter((u) => u.name === where.name && (!where.id || u.id === where.id)).map(snap),
      ),
      findUnique: vi.fn(async ({ where }: Row) => {
        const u = users.find((x) => x.id === where.id);
        return u ? snap(u) : null;
      }),
      update: vi.fn(async ({ where, data }: Row) => {
        const u = users.find((x) => x.id === where.id)!;
        for (const [k, v] of Object.entries(data)) {
          if (v && typeof v === 'object' && 'increment' in (v as Row)) u[k] = (u[k] ?? 0) + (v as Row).increment;
          else u[k] = v;
        }
        return snap(u);
      }),
      updateMany: vi.fn(async ({ where, data }: Row) => {
        const ids: string[] = where?.id?.in ?? [];
        for (const u of users.filter((x) => ids.includes(x.id))) {
          for (const [k, v] of Object.entries(data)) {
            if (v && typeof v === 'object' && 'increment' in (v as Row)) u[k] = (u[k] ?? 0) + (v as Row).increment;
            else u[k] = v;
          }
        }
        return { count: ids.length };
      }),
    },
    pushSubscription: { deleteMany: vi.fn(async () => ({ count: 0 })) },
  };
  prisma.$transaction = vi.fn(async (fn: any) => (typeof fn === 'function' ? fn(prisma) : Promise.all(fn)));
  const jwt: any = { signAsync: vi.fn(async () => 'signed') };
  return { svc: new StudentAuthService(prisma, jwt), prisma, jwt, users };
}

async function attempt(svc: StudentAuthService, pin: string, studentId?: string) {
  try {
    const out: any = await svc.login({ name: NAME, pin, ...(studentId ? { studentId } : {}) });
    return { ok: true as const, out };
  } catch (e: any) {
    return { ok: false as const, status: e?.status, body: e?.response };
  }
}

const lockedNow = (u: Row) => u.pinLockedUntil instanceof Date && u.pinLockedUntil.getTime() > Date.now();

afterEach(() => vi.useRealTimers());

describe('S07 · 单人分支（回归：原来就对，改完不能变）', () => {
  it(`连错 ${MAX_FAILED_ATTEMPTS} 次：第 ${MAX_FAILED_ATTEMPTS} 次 pin_locked，锁 ${LOCK_MINUTES} 分钟，计数清零`, async () => {
    const { svc, users } = makeDb([student({ id: 'a', pinHash: HASH_A })]);
    const codes: string[] = [];
    for (let i = 0; i < MAX_FAILED_ATTEMPTS; i++) codes.push((await attempt(svc, 'wrong-000'))!.body?.code);
    expect(codes.slice(0, -1).every((c) => c === 'invalid_credentials')).toBe(true);
    expect(codes.at(-1)).toBe('pin_locked');
    const until = users[0].pinLockedUntil.getTime() - Date.now();
    expect(until).toBeGreaterThan((LOCK_MINUTES - 1) * 60_000);
    expect(until).toBeLessThanOrEqual(LOCK_MINUTES * 60_000);
    expect(users[0].pinFailedCount).toBe(0);
  });
});

describe('S07 · 同名分支：与单人分支同一套失败计数 / 锁定', () => {
  const pair = () => [student({ id: 'a', pinHash: HASH_A }), student({ id: 'b', pinHash: HASH_B })];

  it(`连错 ${MAX_FAILED_ATTEMPTS} 次：两个同名账号都锁上（修之前永远锁不上）`, async () => {
    const { svc, users } = makeDb(pair());
    const results = [];
    for (let i = 0; i < MAX_FAILED_ATTEMPTS; i++) results.push(await attempt(svc, 'wrong-000'));
    expect(users.every(lockedNow)).toBe(true);
    expect(results.at(-1)!.body?.code).toBe('pin_locked');
  });

  it('连错 7 次（审计原复现）：锁定时间非空，而且不会越锁越久', async () => {
    const { svc, users } = makeDb(pair());
    for (let i = 0; i < 7; i++) await attempt(svc, 'wrong-000');
    for (const u of users) {
      expect(u.pinLockedUntil).toBeInstanceOf(Date);
      expect(u.pinLockedUntil.getTime() - Date.now()).toBeLessThanOrEqual(LOCK_MINUTES * 60_000);
    }
  });

  it('锁定期内，即使输入某个账号的正确密码：pin_locked，不签发令牌（锁着的账号不比对密码，不给猜中信号）', async () => {
    const { svc, jwt } = makeDb(pair());
    for (let i = 0; i < MAX_FAILED_ATTEMPTS; i++) await attempt(svc, 'wrong-000');
    const r = await attempt(svc, PIN_B);
    expect(r.ok).toBe(false);
    expect(r.body).toMatchObject({ code: 'pin_locked' });
    expect(r.body.retryAfterSec).toBeGreaterThan(0);
    expect(jwt.signAsync).not.toHaveBeenCalled();
  });

  it('只锁了一个：另一个照常按密码判；失败只记在没锁的那个身上', async () => {
    const users = pair();
    users[0].pinLockedUntil = new Date(Date.now() + 10 * 60_000);
    const { svc } = makeDb(users);
    const wrong = await attempt(svc, 'wrong-000');
    expect(wrong.body?.code).toBe('invalid_credentials');
    expect(users[0].pinFailedCount).toBe(0);
    expect(users[1].pinFailedCount).toBe(1);
    const right = await attempt(svc, PIN_B);
    expect(right.ok).toBe(true);
    expect(right.out.student.id).toBe('b');
  });

  it('并发：7 个同时到达的错误请求 → 两个账号都锁上（计数由库原子递增）', async () => {
    const { svc, users } = makeDb(pair());
    await Promise.all(Array.from({ length: 7 }, () => attempt(svc, 'wrong-000')));
    expect(users.every(lockedNow)).toBe(true);
  });

  it(`解锁：${LOCK_MINUTES} 分钟后用正确密码登录成功，计数与锁一并清掉`, async () => {
    vi.useFakeTimers({ now: new Date('2026-09-11T08:00:00Z') });
    const { svc, users } = makeDb(pair());
    for (let i = 0; i < MAX_FAILED_ATTEMPTS; i++) await attempt(svc, 'wrong-000');
    expect((await attempt(svc, PIN_A)).body?.code).toBe('pin_locked');
    vi.setSystemTime(new Date(Date.now() + LOCK_MINUTES * 60_000 + 1_000));
    const r = await attempt(svc, PIN_A);
    expect(r.ok).toBe(true);
    expect(r.out.student.id).toBe('a');
    expect(users[0].pinFailedCount).toBe(0);
    expect(users[0].pinLockedUntil).toBeNull();
  });

  it('无正确密码不能枚举班级候选：错误与锁定的响应体里只有错误码（锁定另带剩余秒数）', async () => {
    const { svc } = makeDb(pair());
    const bodies = [];
    for (let i = 0; i < MAX_FAILED_ATTEMPTS + 1; i++) bodies.push((await attempt(svc, 'wrong-000')).body);
    for (const b of bodies) {
      expect(Object.keys(b).sort()).toEqual(b.code === 'pin_locked' ? ['code', 'retryAfterSec'] : ['code']);
      expect(JSON.stringify(b)).not.toMatch(/班级|candidates|classes|stu|c-a|c-b/);
    }
  });

  it('带 studentId 选定了其中一个：走单人分支，同一套锁定', async () => {
    const { svc, users } = makeDb(pair());
    for (let i = 0; i < MAX_FAILED_ATTEMPTS; i++) await attempt(svc, 'wrong-000', 'a');
    expect(lockedNow(users[0])).toBe(true);
    expect(lockedNow(users[1])).toBe(false);
  });
});

describe('S07 · 改密码的旧密码校验：同一套锁定', () => {
  it(`旧密码连错 ${MAX_FAILED_ATTEMPTS} 次 → 锁；锁定期内旧密码对了也 pin_locked`, async () => {
    const { svc, users } = makeDb([student({ id: 'a', pinHash: HASH_A })]);
    const codes: string[] = [];
    for (let i = 0; i < MAX_FAILED_ATTEMPTS; i++) {
      codes.push(await svc.changePin('a', 'wrong-000', '823190').catch((e: any) => e?.response?.code));
    }
    expect(codes.every((c) => c === 'invalid_credentials' || c === 'pin_locked')).toBe(true);
    expect(lockedNow(users[0])).toBe(true);
    await expect(svc.changePin('a', PIN_A, '823190')).rejects.toMatchObject({ response: { code: 'pin_locked' } });
  });
});
