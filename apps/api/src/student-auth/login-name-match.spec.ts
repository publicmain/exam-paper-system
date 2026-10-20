import { describe, expect, it, vi } from 'vitest';
import * as bcrypt from 'bcryptjs';
import { StudentAuthService } from './student-auth.service';
import { normalizeName } from './pilot-levels';

/**
 * 登录的姓名比对要和**注册时**同一套规则（2026-10-20）。
 *
 * ## 修之前
 *
 * 注册查重走 `normalizeName`（去首尾、并连续空白、转小写），登录却是
 * `where: { name }` —— 精确、区分大小写。于是注册时写 `Austin` 的学生
 * 打 `austin` 进不来，拿到的还是「姓名或密码不对」。学生的说法是
 * 「密码明明是对的」，老师只能去后台重置，重置也修不好（名字没对上）。
 *
 * 生产数据佐证：真实班级 40 人里 13 人从没登录成功过（lastLogin 为空），
 * 而他们都在用 App —— 靠注册时拿到的那次会话，一直没再登录过。
 *
 * ## 这里测什么
 *
 * 大小写 / 首尾空格 / 中间连续空格都要能登进去；归一之后**不同**的名字
 * 仍然进不来；同名分支（归一后撞一起）照旧先验密码再给候选。
 */

const PIN = 'river-3141';
const HASH = bcrypt.hashSync(PIN, 4);

type Row = Record<string, any>;

function student(over: Row): Row {
  return {
    email: `${over.id}@pilot.invalid`,
    nickname: null,
    avatar: null,
    pinHash: HASH,
    pinFailedCount: 0,
    pinLockedUntil: null,
    studentAuthVersion: 0,
    classEnrollments: [{ class: { id: `c-${over.id}`, name: `班级-${over.id}` } }],
    ...over,
  };
}

/** 只实现登录用到的那几个查询；`mode: 'insensitive'` 按 Postgres 的语义模拟。 */
function makeDb(users: Row[]) {
  const snap = (u: Row) => ({ ...u, classEnrollments: u.classEnrollments.map((e: Row) => ({ ...e })) });
  const nameMatches = (stored: string, where: Row) => {
    const w = where.name;
    if (typeof w === 'string') return stored === w;
    return w?.mode === 'insensitive' ? stored.toLowerCase() === String(w.equals).toLowerCase() : stored === w?.equals;
  };
  const prisma: any = {
    user: {
      findMany: vi.fn(async ({ where }: Row) =>
        users.filter((u) => nameMatches(u.name, where) && (!where.id || u.id === where.id)).map(snap),
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
      updateMany: vi.fn(async () => ({ count: 0 })),
    },
    pushSubscription: { deleteMany: vi.fn(async () => ({ count: 0 })) },
  };
  prisma.$transaction = vi.fn(async (fn: any) => (typeof fn === 'function' ? fn(prisma) : Promise.all(fn)));
  const jwt: any = { signAsync: vi.fn(async () => 'signed') };
  return { svc: new StudentAuthService(prisma, jwt), users };
}

const login = async (svc: StudentAuthService, name: string, pin = PIN) => {
  try {
    return { ok: true as const, out: (await svc.login({ name, pin })) as any };
  } catch (e: any) {
    return { ok: false as const, code: e?.response?.code };
  }
};

describe('登录的姓名比对 = 注册时那一套', () => {
  it.each([
    ['大小写不同', 'Austin', 'austin'],
    ['全小写登录全大写注册', 'SAMMY', 'sammy'],
    ['首尾空格', 'Jason', '  Jason  '],
    ['中间连续空格', 'Zhou Zixin', 'Zhou   Zixin'],
    ['中文原样', '郑稀瑜', '郑稀瑜'],
  ])('%s：照样能登进去', async (_label, stored, typed) => {
    const { svc } = makeDb([student({ id: 'a', name: stored })]);
    const r = await login(svc, typed);
    expect(r.ok).toBe(true);
    expect(r.ok && r.out.student.name).toBe(stored);
  });

  it('归一之后仍然不同的名字（同音不同字）进不来', async () => {
    const { svc } = makeDb([student({ id: 'a', name: '郑稀瑜' })]);
    const r = await login(svc, '郑希瑜');
    expect(r).toEqual({ ok: false, code: 'invalid_credentials' });
  });

  it('密码错了还是 invalid_credentials，并记一次失败', async () => {
    const { svc, users } = makeDb([student({ id: 'a', name: 'Austin' })]);
    const r = await login(svc, 'austin', 'wrong-000');
    expect(r).toEqual({ ok: false, code: 'invalid_credentials' });
    expect(users[0].pinFailedCount).toBe(1);
  });

  it('归一后同名、密码也一样：仍然先验密码再列候选', async () => {
    const { svc } = makeDb([
      student({ id: 'a', name: 'Austin' }),
      student({ id: 'b', name: 'austin' }),
    ]);
    const r = await login(svc, 'AUSTIN');
    expect(r.ok).toBe(true);
    expect(r.ok && r.out.needDisambiguation).toBe(true);
    expect(r.ok && r.out.candidates.map((c: Row) => c.studentId).sort()).toEqual(['a', 'b']);
  });

  it('归一后同名但密码只对上一个：直接登录那个，不泄露另一个', async () => {
    const { svc } = makeDb([
      student({ id: 'a', name: 'Austin' }),
      student({ id: 'b', name: 'austin', pinHash: bcrypt.hashSync('maple-2718', 4) }),
    ]);
    const r = await login(svc, 'AUSTIN');
    expect(r.ok).toBe(true);
    expect(r.ok && r.out.needDisambiguation).toBeUndefined();
    expect(r.ok && r.out.student.id).toBe('a');
  });

  it('normalizeName 本身：登录与注册用的是同一个函数', () => {
    expect(normalizeName('  Austin ')).toBe('austin');
    expect(normalizeName('Zhou   Zixin')).toBe('zhou zixin');
    expect(normalizeName('郑稀瑜')).not.toBe(normalizeName('郑希瑜'));
  });
});
