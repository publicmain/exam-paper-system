/**
 * S12O —— 学生**自己**注册，并且自己选难度。
 *
 * 在这之前，一个学生要能进来，教师得先在花名册上把他建出来、还得替他
 * 把难度设好；`register` 干的事情是**认领**一行已经存在的空账号
 * （`student_not_found` 就是这个前提的回声）。试点要请真人进来，这个
 * 前提站不住 —— 所以这里定义两件新事：
 *
 *   · `registrationClasses`  可注册班级的最小公开列表
 *   · `selfRegister`     班级 + 姓名 + PIN + 难度 → 账号 + 在册 + 令牌
 *   · `setEnglishLevel`  已登录的学生自己改难度，身份只来自令牌
 *
 * 全部用假 Prisma，不连库。
 */

import { describe, expect, it, vi } from 'vitest';
import * as bcrypt from 'bcryptjs';
import * as fs from 'node:fs';
import * as path from 'node:path';
import { StudentAuthService } from './student-auth.service';
import { StudentAuthController } from './student-auth.controller';
import { RATE_LIMIT_KEY } from '../common/rate-limit.guard';
import { PILOT_LEVELS, isPilotLevel, levelOffered, normalizeName, normalizeClassCode } from './pilot-levels';

// ─────────────────────────────────────────────────────────────
// 假库
// ─────────────────────────────────────────────────────────────

interface FakeClass {
  id: string;
  classCode: string;
  name: string;
  archivedAt: Date | null;
  englishLevels: Array<{ level: string }>;
}

interface FakeUser {
  id: string;
  email: string;
  name: string;
  nickname?: string | null;
  avatar?: string | null;
  passwordHash: string;
  pinHash: string | null;
  role: string;
  englishLevel: string | null;
  studentAuthVersion: number;
  isActive?: boolean;
  archivedAt?: Date | null;
}

/**
 * 一个够真的假库：
 *   · `$transaction(fn)` 真的把写操作放进一个暂存区，抛错就整批丢掉；
 *   · `user.create` 真的检查 email 唯一索引，撞了就抛 P2002 ——
 *     并发双击最后拦得住拦不住，全靠这一条。
 */
function makeDb(seed: { classes?: FakeClass[]; users?: FakeUser[]; enrollments?: any[] } = {}) {
  const state = {
    classes: seed.classes ?? [],
    users: seed.users ?? [],
    enrollments: seed.enrollments ?? [],
  };
  const log: string[] = [];

  function viewOf(store: typeof state) {
    return {
      class: {
        findFirst: vi.fn(async ({ where, select }: any) => {
          const c = store.classes.find(
            (x) =>
              x.id === where.id &&
              (where.archivedAt === null ? x.archivedAt === null : true),
          );
          if (!c) return null;
          void select;
          return JSON.parse(JSON.stringify(c));
        }),
        findMany: vi.fn(async () =>
          store.classes
            .filter((x) => x.archivedAt === null && x.englishLevels.length > 0)
            .sort((a, b) => a.name.localeCompare(b.name))
            .map((x) => JSON.parse(JSON.stringify(x))),
        ),
      },
      user: {
        // 两个调用点共用它：selfRegister 的重名预检（按班筛），以及
        // login/register 的姓名解析（按 name 筛，且要 pinHash 那几个
        // 字段）。假库如果只满足前者，后者会静默地一个人都查不到 ——
        // 那是假库的失真，不是产品的行为。
        findMany: vi.fn(async ({ where }: any) => {
          const inClass: string[] | null = where?.classEnrollments?.some?.classId
            ? store.enrollments
                .filter((e) => e.classId === where.classEnrollments.some.classId)
                .map((e) => e.userId)
            : null;
          return store.users
            .filter((u) => (inClass ? inClass.includes(u.id) : true))
            .filter((u) => (where?.name != null ? u.name === where.name : true))
            .filter((u) => (where?.role != null ? u.role === where.role : true))
            .filter((u) => (where?.id != null ? u.id === where.id : true))
            .map((u) => ({
              id: u.id,
              email: u.email,
              name: u.name,
              pinHash: u.pinHash,
              studentAuthVersion: u.studentAuthVersion,
              classEnrollments: store.enrollments
                .filter((e) => e.userId === u.id)
                .map((e) => ({
                  class: store.classes.find((c) => c.id === e.classId) ?? { id: e.classId, name: '' },
                })),
            }));
        }),
        findUnique: vi.fn(async ({ where }: any) => {
          const u = store.users.find((x) => x.id === where.id || x.email === where.email);
          return u ? { ...u } : null;
        }),
        create: vi.fn(async ({ data }: any) => {
          log.push(`user.create:${data.email}`);
          if (store.users.some((u) => u.email === data.email)) {
            const e: any = new Error('Unique constraint failed on the fields: (`email`)');
            e.code = 'P2002';
            e.meta = { target: ['email'] };
            throw e;
          }
          const row: FakeUser = {
            id: data.id ?? `u${store.users.length + 1}`,
            studentAuthVersion: 0,
            pinHash: null,
            englishLevel: null,
            role: 'student',
            ...data,
          };
          store.users.push(row);
          return { ...row };
        }),
        update: vi.fn(async ({ where, data }: any) => {
          log.push(`user.update:${where.id}`);
          const u = store.users.find((x) => x.id === where.id);
          if (!u) throw new Error('not found');
          Object.assign(u, data);
          return { ...u };
        }),
      },
      classEnrollment: {
        findFirst: vi.fn(async ({ where }: any) => {
          const e = store.enrollments.find(
            (x) => x.userId === where.userId && (!where.classId || x.classId === where.classId),
          );
          return e ? { ...e } : null;
        }),
        findMany: vi.fn(async ({ where }: any) => {
          const rows = store.enrollments.filter((x) => x.userId === where.userId);
          return rows.map((e) => ({
            classId: e.classId,
            class: store.classes.find((c) => c.id === e.classId) ?? null,
          }));
        }),
        create: vi.fn(async ({ data }: any) => {
          log.push(`enrollment.create:${data.userId}@${data.classId}`);
          store.enrollments.push({ ...data });
          return { ...data };
        }),
      },
    };
  }

  const prisma: any = {
    ...viewOf(state),
    $transaction: vi.fn(async (fn: any) => {
      // 快照 → 在副本上跑 → 成功才提交。抛错就一行都不留。
      const draft = JSON.parse(JSON.stringify(state));
      const out = await fn(viewOf(draft));
      state.classes = draft.classes;
      state.users = draft.users;
      state.enrollments = draft.enrollments;
      return out;
    }),
  };
  return { prisma, state, log };
}

const PILOT_CLASS: FakeClass = {
  id: 'p1_class',
  classCode: 'PILOTW1',
  name: '试点班 W1',
  archivedAt: null,
  englishLevels: [
    { level: 'olevel' },
    { level: 'ielts_simplified' },
    { level: 'ielts_authentic' },
  ],
};

function makeSvc(seed?: Parameters<typeof makeDb>[0]) {
  const db = makeDb(seed ?? { classes: [PILOT_CLASS] });
  const jwt: any = { signAsync: vi.fn(async () => 'signed-token') };
  return { svc: new StudentAuthService(db.prisma, jwt), ...db, jwt };
}

const GOOD = { classId: 'p1_class', name: '林小雨', pin: '280519', englishLevel: 'olevel' as const };

// ─────────────────────────────────────────────────────────────
// 0. 旧世界的前提 —— 这一条正是本任务要推翻的东西
// ─────────────────────────────────────────────────────────────

describe('S12O —— 教师预建这个前提', () => {
  it('老的 `register` 对一个花名册上没有的人只会说「找不到」', async () => {
    const { svc } = makeSvc({ classes: [PILOT_CLASS], users: [] });
    await expect(
      svc.register({ name: '花名册上没有的人', password: 'abc123' }),
    ).rejects.toMatchObject({ response: { code: 'student_not_found' } });
  });
});

describe('注册页班级列表', () => {
  it('只给 id、名称和允许学生选择的难度，不泄露班级码', async () => {
    const { svc } = makeSvc({
      classes: [
        PILOT_CLASS,
        { ...PILOT_CLASS, id: 'legacy', name: '旧档班', classCode: 'SECRET', englishLevels: [{ level: 'ielts_light' }] },
      ],
    });
    const out: any = await svc.registrationClasses();
    expect(out.classes).toEqual([{
      id: 'p1_class',
      name: '试点班 W1',
      levels: ['olevel', 'ielts_simplified', 'ielts_authentic'],
    }]);
    expect(JSON.stringify(out)).not.toContain('PILOTW1');
    expect(JSON.stringify(out)).not.toContain('SECRET');
  });

  it('归档班和没有开放难度的班不出现', async () => {
    const { svc } = makeSvc({
      classes: [
        { ...PILOT_CLASS, id: 'archived', archivedAt: new Date('2026-01-01') },
        { ...PILOT_CLASS, id: 'closed', englishLevels: [] },
      ],
    });
    await expect(svc.registrationClasses()).resolves.toEqual({ classes: [] });
  });
});

// ─────────────────────────────────────────────────────────────
// 1. 自助注册的正路
// ─────────────────────────────────────────────────────────────

describe('S12O —— 自助注册', () => {
  it('班级 + 姓名 + PIN + 难度 → 建账号、入班、存难度、发令牌', async () => {
    const { svc, state, jwt } = makeSvc();
    const out: any = await svc.selfRegister(GOOD);

    expect(out.token).toBe('signed-token');
    expect(out.student.name).toBe('林小雨');
    expect(out.englishLevel).toBe('olevel');

    expect(state.users).toHaveLength(1);
    expect(state.users[0].englishLevel).toBe('olevel');
    expect(state.users[0].role).toBe('student');
    expect(state.enrollments).toEqual([
      expect.objectContaining({ classId: 'p1_class', role: 'student' }),
    ]);

    // 令牌是学生令牌，且带撤销版本号 —— 与 login/register 同构
    const claims = jwt.signAsync.mock.calls[0][0];
    expect(claims.role).toBe('student');
    expect(claims.id).toBe(state.users[0].id);
    expect(typeof claims.av).toBe('number');
  });

  it('PIN 用既有的机制哈希 —— 库里不留明文，而且能验回来', async () => {
    const { svc, state } = makeSvc();
    await svc.selfRegister(GOOD);
    const u = state.users[0];
    expect(u.pinHash).toBeTruthy();
    expect(u.pinHash).not.toBe('280519');
    expect(JSON.stringify(u)).not.toContain('280519');
    expect(bcrypt.compareSync('280519', u.pinHash!)).toBe(true);
  });

  it('教师端的密码位放的是**不可用**的随机哈希 —— 学生走不了教师登录', async () => {
    const { svc, state } = makeSvc();
    await svc.selfRegister(GOOD);
    const u = state.users[0];
    expect(u.passwordHash).toBeTruthy();
    expect(bcrypt.compareSync('280519', u.passwordHash)).toBe(false);
    expect(bcrypt.compareSync('', u.passwordHash)).toBe(false);
  });

  it('姓名前后空白与中间的连续空白都归一，但**显示的是他自己写的**', async () => {
    const { svc, state } = makeSvc();
    await svc.selfRegister({ ...GOOD, name: '  林 小雨  ' });
    expect(state.users[0].name).toBe('林 小雨');
  });

  it('班级由服务端 id 精确选择', async () => {
    const { svc, state } = makeSvc();
    await svc.selfRegister({ ...GOOD, classId: 'p1_class' });
    expect(state.enrollments[0].classId).toBe('p1_class');
  });

  it('注册成功之后，能用同一个 PIN 正常登录 —— 老登录路一点没变', async () => {
    const { svc } = makeSvc();
    await svc.selfRegister(GOOD);
    const out: any = await svc.login({ name: '林小雨', pin: '280519' });
    expect(out.token).toBe('signed-token');
  });
});

// ─────────────────────────────────────────────────────────────
// 2. 拒绝的每一种，而且**一行都不留**
// ─────────────────────────────────────────────────────────────

describe('S12O —— 注册的拒绝路径都是零副作用', () => {
  const bad: Array<[string, any, string]> = [
    ['班级不存在', { classId: 'NOPE' }, 'class_not_available'],
    ['班级为空', { classId: '' }, 'class_not_available'],
    ['难度不是这三档之一', { englishLevel: 'ielts_light' }, 'level_not_allowed'],
    ['难度是瞎编的', { englishLevel: 'wizard' }, 'level_not_allowed'],
    ['PIN 不是 6 位', { pin: '12345' }, 'pin_must_be_6_digits'],
    ['PIN 带字母', { pin: '12a456' }, 'pin_must_be_6_digits'],
    ['PIN 太好猜', { pin: '123456' }, 'pin_too_weak'],
    ['姓名是空的', { name: '   ' }, 'name_required'],
  ];
  for (const [label, patch, code] of bad) {
    it(`拒绝：${label} —— 且 User / ClassEnrollment 都是 0 行`, async () => {
      const { svc, state } = makeSvc();
      await expect(svc.selfRegister({ ...GOOD, ...patch })).rejects.toMatchObject({
        response: { code },
      });
      expect(state.users).toHaveLength(0);
      expect(state.enrollments).toHaveLength(0);
    });
  }

  it('班级归档了 = 班级不可注册', async () => {
    const { svc, state } = makeSvc({
      classes: [{ ...PILOT_CLASS, archivedAt: new Date('2026-01-01') }],
    });
    await expect(svc.selfRegister(GOOD)).rejects.toMatchObject({
      response: { code: 'class_not_available' },
    });
    expect(state.users).toHaveLength(0);
  });

  it('这个班没开这一档 → `level_not_offered`，不建号', async () => {
    const { svc, state } = makeSvc({
      classes: [{ ...PILOT_CLASS, englishLevels: [{ level: 'olevel' }] }],
    });
    await expect(
      svc.selfRegister({ ...GOOD, englishLevel: 'ielts_authentic' }),
    ).rejects.toMatchObject({ response: { code: 'level_not_offered' } });
    expect(state.users).toHaveLength(0);
    expect(state.enrollments).toHaveLength(0);
  });

  it('班级一档都没开 → `class_not_open`', async () => {
    const { svc } = makeSvc({ classes: [{ ...PILOT_CLASS, englishLevels: [] }] });
    await expect(svc.selfRegister(GOOD)).rejects.toMatchObject({
      response: { code: 'class_not_open' },
    });
  });

  it('**普通失败之后重来是安全的** —— PIN 打错一次不会占掉名字', async () => {
    const { svc, state } = makeSvc();
    await expect(svc.selfRegister({ ...GOOD, pin: '1234' })).rejects.toBeTruthy();
    expect(state.users).toHaveLength(0);
    const out: any = await svc.selfRegister(GOOD);
    expect(out.token).toBe('signed-token');
    expect(state.users).toHaveLength(1);
    expect(state.enrollments).toHaveLength(1);
  });

  it('入班那一步炸了 → 账号也不留（整批回滚）', async () => {
    const { svc, prisma, state } = makeSvc();
    prisma.$transaction.mockImplementationOnce(async () => {
      throw new Error('boom');
    });
    await expect(svc.selfRegister(GOOD)).rejects.toBeTruthy();
    expect(state.users).toHaveLength(0);
    expect(state.enrollments).toHaveLength(0);
  });
});

// ─────────────────────────────────────────────────────────────
// 3. 重名与双击
// ─────────────────────────────────────────────────────────────

describe('S12O —— 同一个班里的重名', () => {
  it('班里已经有这个名字 → 明确报重名，让他去登录', async () => {
    const { svc, state } = makeSvc();
    await svc.selfRegister(GOOD);
    await expect(svc.selfRegister(GOOD)).rejects.toMatchObject({
      response: { code: 'name_taken_in_class' },
    });
    expect(state.users).toHaveLength(1);
    expect(state.enrollments).toHaveLength(1);
  });

  it('大小写、前后空白、中间空白不同也算同一个名字', async () => {
    const { svc, state } = makeSvc();
    await svc.selfRegister({ ...GOOD, name: 'Amy Tan' });
    for (const n of ['amy tan', '  Amy   Tan ', 'AMY TAN']) {
      await expect(svc.selfRegister({ ...GOOD, name: n })).rejects.toMatchObject({
        response: { code: 'name_taken_in_class' },
      });
    }
    expect(state.users).toHaveLength(1);
  });

  it('教师早先建过同名的人，也算占用 —— 让他走登录/认领，不另起一个号', async () => {
    const { svc, state } = makeSvc({
      classes: [PILOT_CLASS],
      users: [
        {
          id: 'old1',
          email: 'old1@school.local',
          name: '林小雨',
          passwordHash: 'x',
          pinHash: null,
          role: 'student',
          englishLevel: null,
          studentAuthVersion: 0,
        },
      ],
      enrollments: [{ classId: 'p1_class', userId: 'old1', role: 'student' }],
    });
    await expect(svc.selfRegister(GOOD)).rejects.toMatchObject({
      response: { code: 'name_taken_in_class' },
    });
    expect(state.users).toHaveLength(1);
    expect(state.enrollments).toHaveLength(1);
  });

  it('**双击只会建出一个号** —— 两个请求同时打进来也一样', async () => {
    const { svc, state } = makeSvc();
    const results = await Promise.allSettled([
      svc.selfRegister(GOOD),
      svc.selfRegister(GOOD),
    ]);
    expect(results.filter((r) => r.status === 'fulfilled')).toHaveLength(1);
    expect(state.users).toHaveLength(1);
    expect(state.enrollments).toHaveLength(1);
  });

  it('不同班的同名互不影响', async () => {
    const other = { ...PILOT_CLASS, id: 'c2', classCode: 'OTHER' };
    const { svc, state } = makeSvc({ classes: [PILOT_CLASS, other] });
    await svc.selfRegister(GOOD);
    await svc.selfRegister({ ...GOOD, classId: 'c2' });
    expect(state.users).toHaveLength(2);
    expect(state.enrollments).toHaveLength(2);
  });
});

// ─────────────────────────────────────────────────────────────
// 4. 客户端说了不算
// ─────────────────────────────────────────────────────────────

describe('S12O —— 身份不由客户端决定', () => {
  it('`selfRegister` 的入参里**没有** studentId 这类东西', async () => {
    const { svc, state } = makeSvc();
    await svc.selfRegister({ ...GOOD, studentId: 'someone_else' } as any);
    // 传了也没用：新账号的 id 由库生成，不会是它说的那个
    expect(state.users[0].id).not.toBe('someone_else');
  });

  it('新账号的 email 不是学生给的，也不是能猜出别人的东西', async () => {
    const { svc, state } = makeSvc();
    await svc.selfRegister(GOOD);
    const email = state.users[0].email;
    expect(email).not.toContain('林小雨');
    expect(email.endsWith('@pilot.invalid')).toBe(true);
  });
});

// ─────────────────────────────────────────────────────────────
// 5. 自己改难度
// ─────────────────────────────────────────────────────────────

function seededStudent(level: string | null = 'olevel') {
  return makeSvc({
    classes: [PILOT_CLASS],
    users: [
      {
        id: 'stu1',
        email: 'stu1@pilot.invalid',
        name: '林小雨',
        passwordHash: 'x',
        pinHash: bcrypt.hashSync('280519', 4),
        role: 'student',
        englishLevel: level,
        studentAuthVersion: 3,
        isActive: true,
        archivedAt: null,
      },
    ],
    enrollments: [{ classId: 'p1_class', userId: 'stu1', role: 'student' }],
  });
}

describe('S12O —— 账号设置里改难度', () => {
  it('改成班里开着的另一档 —— 写下去，并回一个可以显示的回执', async () => {
    const { svc, state } = seededStudent();
    const out: any = await svc.setEnglishLevel('stu1', 'ielts_authentic');
    expect(out.englishLevel).toBe('ielts_authentic');
    expect(state.users[0].englishLevel).toBe('ielts_authentic');
  });

  it('刷新之后还在 —— `me` 读得到', async () => {
    const { svc } = seededStudent();
    await svc.setEnglishLevel('stu1', 'ielts_simplified');
    const me: any = await svc.me('stu1');
    expect(me.englishLevel).toBe('ielts_simplified');
  });

  it('连改几次，最后一次说了算', async () => {
    const { svc, state } = seededStudent();
    await svc.setEnglishLevel('stu1', 'ielts_simplified');
    await svc.setEnglishLevel('stu1', 'ielts_authentic');
    await svc.setEnglishLevel('stu1', 'olevel');
    expect(state.users[0].englishLevel).toBe('olevel');
  });

  it('还没定过难度的人也能定下来', async () => {
    const { svc, state } = seededStudent(null);
    await svc.setEnglishLevel('stu1', 'olevel');
    expect(state.users[0].englishLevel).toBe('olevel');
  });

  it('不是这三档之一 → 拒绝，且不写库', async () => {
    const { svc, state } = seededStudent();
    for (const bad of ['ielts_light', 'olevel_intermediate', 'wizard', '']) {
      await expect(svc.setEnglishLevel('stu1', bad as any)).rejects.toMatchObject({
        response: { code: 'level_not_allowed' },
      });
    }
    expect(state.users[0].englishLevel).toBe('olevel');
  });

  it('班里没开这一档 → 拒绝，且不写库', async () => {
    const { svc, state } = makeSvc({
      classes: [{ ...PILOT_CLASS, englishLevels: [{ level: 'olevel' }] }],
      users: [
        {
          id: 'stu1', email: 'e', name: 'n', passwordHash: 'x', pinHash: 'h',
          role: 'student', englishLevel: 'olevel', studentAuthVersion: 0,
        },
      ],
      enrollments: [{ classId: 'p1_class', userId: 'stu1', role: 'student' }],
    });
    await expect(svc.setEnglishLevel('stu1', 'ielts_authentic')).rejects.toMatchObject({
      response: { code: 'level_not_offered' },
    });
    expect(state.users[0].englishLevel).toBe('olevel');
  });

  it('**改难度不动令牌** —— `studentAuthVersion` 不变，学生不会被踢出去', async () => {
    const { svc, state } = seededStudent();
    await svc.setEnglishLevel('stu1', 'ielts_authentic');
    expect(state.users[0].studentAuthVersion).toBe(3);
  });

  it('**只改 englishLevel 一个字段** —— 历史数据不在这条路径的射程内', async () => {
    const { svc, prisma } = seededStudent();
    await svc.setEnglishLevel('stu1', 'ielts_authentic');
    const call = prisma.user.update.mock.calls.at(-1)![0];
    expect(Object.keys(call.data)).toEqual(['englishLevel']);
    expect(call.where).toEqual({ id: 'stu1' });
  });

  it('没在任何班里 → 说不清该开哪几档，拒绝', async () => {
    const { svc } = makeSvc({
      classes: [PILOT_CLASS],
      users: [
        {
          id: 'stu1', email: 'e', name: 'n', passwordHash: 'x', pinHash: 'h',
          role: 'student', englishLevel: null, studentAuthVersion: 0,
        },
      ],
      enrollments: [],
    });
    await expect(svc.setEnglishLevel('stu1', 'olevel')).rejects.toMatchObject({
      response: { code: 'class_not_open' },
    });
  });
});

// ─────────────────────────────────────────────────────────────
// 6. 纯函数
// ─────────────────────────────────────────────────────────────

describe('S12O —— 试点难度的定义', () => {
  it('恰好三档，顺序从易到难', () => {
    expect(PILOT_LEVELS).toEqual(['olevel', 'ielts_simplified', 'ielts_authentic']);
  });

  it('别的档一律不算 —— 包括库里真实存在的那两个', () => {
    expect(isPilotLevel('ielts_light')).toBe(false);
    expect(isPilotLevel('olevel_intermediate')).toBe(false);
    expect(isPilotLevel('')).toBe(false);
    expect(isPilotLevel(undefined as any)).toBe(false);
  });

  it('`levelOffered` 看的是班级实际开的那几档', () => {
    expect(levelOffered('olevel', ['olevel', 'ielts_authentic'])).toBe(true);
    expect(levelOffered('ielts_simplified', ['olevel'])).toBe(false);
    expect(levelOffered('olevel', [])).toBe(false);
  });

  it('姓名归一：去首尾、并连续空白；大小写只在**比较**时忽略', () => {
    expect(normalizeName('  Amy   Tan ')).toBe('amy tan');
    expect(normalizeName('林 小雨')).toBe('林 小雨');
    expect(normalizeName('\t张三\n')).toBe('张三');
    expect(normalizeName('   ')).toBe('');
  });

  it('班级码归一：去空白、转大写', () => {
    expect(normalizeClassCode(' pilotw1 ')).toBe('PILOTW1');
    expect(normalizeClassCode('PILOTW1')).toBe('PILOTW1');
    expect(normalizeClassCode('  ')).toBe('');
  });
});

// ─────────────────────────────────────────────────────────────
// 7. 说明书跟着改
// ─────────────────────────────────────────────────────────────

describe('S12O —— 试点说明书讲的是自助注册', () => {
  const DOC = path.resolve(__dirname, '../../../../docs/pilot/s12m-launch.md');
  const read = () => fs.readFileSync(DOC, 'utf8');

  it('说明书在', () => {
    expect(fs.existsSync(DOC)).toBe(true);
  });

  it('学生自己选班级、自己设 PIN、自己选难度', () => {
    const t = read();
    expect(t).toMatch(/选择.*班级/);
    expect(t).toMatch(/自己选|自己挑/);
    expect(t).toMatch(/账号设置/);
  });

  it('**不再要求教师预建账号或替学生设难度**', () => {
    const t = read();
    expect(t).not.toContain('并给他设好分级');
    expect(t).not.toContain('分级不能空');
    expect(t).not.toMatch(/教师端把这个学生加进/);
  });
});

// ─────────────────────────────────────────────────────────────
// 8. 端点上的闸
// ─────────────────────────────────────────────────────────────

describe('S12O —— 两个新端点各自带着自己的闸', () => {
  const rl = (m: string) =>
    Reflect.getMetadata(RATE_LIMIT_KEY, (StudentAuthController.prototype as any)[m]) as
      | { limit: number; windowSec: number; scope: string }
      | undefined;

  it('自助注册**限流**，而且比只改一行的 `register` 更紧', () => {
    const self = rl('selfRegister')!;
    const claim = rl('register')!;
    expect(self).toBeTruthy();
    expect(self.scope).toBe('ip');
    expect(self.windowSec).toBeLessThanOrEqual(60);
    // 这条路会**建行**，claim 那条只改一行已经存在的
    expect(self.limit).toBeLessThan(claim.limit);
  });

  it('改难度也限流', () => {
    const r = rl('setEnglishLevel')!;
    expect(r).toBeTruthy();
    expect(r.limit).toBeGreaterThan(0);
  });

  it('改难度**不给教师的只读视角开口子**', () => {
    const src = fs.readFileSync(path.resolve(__dirname, 'student-auth.controller.ts'), 'utf8');
    const at = src.indexOf('async setEnglishLevel(');
    const body = src.slice(at, src.indexOf('\n  }', at));
    expect(body).toContain('this.requireStudent(req)');
    // allowTeacherView 一旦出现在这里，教师借来的视角就能改学生的层
    expect(body).not.toContain('allowTeacherView');
  });

  it('两个端点的请求体都是 `.strict()` —— 多一个字段就是 400', () => {
    const src = fs.readFileSync(path.resolve(__dirname, 'student-auth.controller.ts'), 'utf8');
    for (const fn of ['async selfRegister(', 'async setEnglishLevel(']) {
      const at = src.indexOf(fn);
      const body = src.slice(at, src.indexOf('\n  }', at));
      expect(body, `${fn} 没有 .strict()`).toContain('.strict()');
    }
  });
});
