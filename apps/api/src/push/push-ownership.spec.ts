import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const sendNotification = vi.fn();
vi.mock('web-push', () => ({ sendNotification: (...args: unknown[]) => sendNotification(...args) }));

import { PushService } from './push.service';
import { PushController } from './push.controller';
import { LEGACY_DEACTIVATED_PREFIX } from '../common/account-lifecycle';
import { STUDENT_TOKEN_TTL_DAYS } from '../student-auth/student-auth.service';

/**
 * UI07（后端部分，2026-09-11 审计）—— 推送订阅按**已认证账号**绑定。
 *
 * 共用设备：A 开了提醒 → 退出 → B 登录。页面按「浏览器有订阅」就显示已开启，
 * 后台那一行却可能仍属于 A —— A 的个人提醒推给了 B 手里的设备。
 *
 * 后端这边要保证的：
 *   · 订阅永远绑定当前已认证学生；同一 endpoint 被 B 订阅 → 从 A 名下转走；
 *   · 退订只能解绑自己名下的；
 *   · 新增只读查询 `POST /push/status {endpoint}` → `{ subscribed }`：
 *     「当前账号 + 本浏览器 endpoint」在库里是不是真的有这一行；
 *   · 提醒 cron 跳过停用 / 归档 / 撤销 / 凭证已过期的账号。
 *
 * 内存订阅表 + 内存用户表，不连库；web-push 被 mock，不会真的发通知。
 */

type Row = Record<string, any>;
const NOW = new Date('2026-09-10T08:30:00.000Z'); // 16:30 SGT
const DAY = 86_400_000;

function user(id: string, over: Row = {}): Row {
  return {
    id,
    role: 'student',
    isActive: true,
    archivedAt: null,
    passwordHash: '$2a$04$hash',
    lastLogin: new Date(NOW.getTime() - DAY),
    pinSetAt: new Date(NOW.getTime() - 20 * DAY),
    ...over,
  };
}

/** 只实现推送服务真实用到的 where 形状（含 student 关系过滤）。 */
function studentMatches(u: Row | undefined, w: Row | undefined): boolean {
  if (!w) return true;
  if (!u) return false;
  for (const [k, v] of Object.entries(w)) {
    if (k === 'NOT') {
      if (v?.passwordHash?.startsWith && String(u.passwordHash ?? '').startsWith(v.passwordHash.startsWith)) return false;
      continue;
    }
    if (k === 'OR') {
      const ok = (v as Row[]).some((c) =>
        Object.entries(c).every(([f, cond]: [string, any]) => u[f] instanceof Date && u[f].getTime() >= cond.gte.getTime()),
      );
      if (!ok) return false;
      continue;
    }
    if (u[k] !== v) return false;
  }
  return true;
}

function makeDb(users: Row[], subs: Row[] = []) {
  const byId = new Map(users.map((u) => [u.id, u]));
  const matches = (s: Row, where: Row = {}) =>
    (where.studentId === undefined || s.studentId === where.studentId) &&
    (where.endpoint === undefined || s.endpoint === where.endpoint) &&
    studentMatches(byId.get(s.studentId), where.student);
  const prisma: any = {
    pushSubscription: {
      upsert: vi.fn(async ({ where, create, update }: Row) => {
        const hit = subs.find((s) => s.endpoint === where.endpoint);
        if (hit) Object.assign(hit, update);
        else subs.push({ id: `sub-${subs.length + 1}`, lastSentAt: null, ...create });
        return {};
      }),
      findUnique: vi.fn(async ({ where }: Row) => subs.find((s) => s.endpoint === where.endpoint) ?? null),
      findFirst: vi.fn(async ({ where }: Row) => subs.find((s) => matches(s, where)) ?? null),
      findMany: vi.fn(async ({ where }: Row = {}) => subs.filter((s) => matches(s, where))),
      deleteMany: vi.fn(async ({ where }: Row) => {
        const before = subs.length;
        for (let i = subs.length - 1; i >= 0; i--) if (matches(subs[i], where)) subs.splice(i, 1);
        return { count: before - subs.length };
      }),
      delete: vi.fn(async ({ where }: Row) => {
        const i = subs.findIndex((s) => s.id === where.id);
        if (i >= 0) subs.splice(i, 1);
        return {};
      }),
      update: vi.fn(async ({ where, data }: Row) => Object.assign(subs.find((s) => s.id === where.id)!, data)),
    },
    morningQuizSession: {
      findMany: vi.fn(async () => [
        { paperAssignmentId: 'asg', class: { enrollments: users.map((u) => ({ userId: u.id })) } },
      ]),
    },
    studentSubmission: { findMany: vi.fn(async () => []) },
  };
  return { svc: new PushService(prisma), prisma, subs };
}

const EP = 'https://push.example.invalid/shared-ipad';
const KEYS = { p256dh: 'p', auth: 'a' };

beforeEach(() => {
  sendNotification.mockReset();
  sendNotification.mockResolvedValue({ statusCode: 201 });
  vi.stubEnv('VAPID_PUBLIC_KEY', 'pub');
  vi.stubEnv('VAPID_PRIVATE_KEY', 'priv');
});
afterEach(() => vi.unstubAllEnvs());

describe('UI07 · 订阅归属：同一台设备换人登录', () => {
  it('A 订阅 → B 在同一台设备订阅：这一行从 A 名下转给 B', async () => {
    const { svc, subs } = makeDb([user('A'), user('B')]);
    await svc.subscribe('A', { endpoint: EP, keys: KEYS });
    await svc.subscribe('B', { endpoint: EP, keys: KEYS });
    expect(subs).toHaveLength(1);
    expect(subs[0].studentId).toBe('B');
    expect(await svc.status('A', EP)).toEqual({ subscribed: false });
    expect(await svc.status('B', EP)).toEqual({ subscribed: true });
  });

  it('转走之后，A 的个人提醒不再发到这台设备', async () => {
    const { svc } = makeDb([user('A'), user('B')]);
    await svc.subscribe('A', { endpoint: EP, keys: KEYS });
    await svc.subscribe('B', { endpoint: EP, keys: KEYS });
    const r = await svc.sendToStudent('A', { title: 't', body: 'b', url: '/today', tag: 'x' });
    expect(r).toEqual({ sent: 0, dropped: 0, failed: 0 });
    expect(sendNotification).not.toHaveBeenCalled();
  });

  it('退订只能解绑自己名下的：B 拿 A 的 endpoint 退订 → A 的订阅原样保留', async () => {
    const { svc, subs } = makeDb([user('A'), user('B')]);
    await svc.subscribe('A', { endpoint: EP, keys: KEYS });
    await expect(svc.unsubscribe('B', EP)).resolves.toEqual({ ok: true });
    expect(subs.map((s) => s.studentId)).toEqual(['A']);
    await svc.unsubscribe('A', EP);
    expect(subs).toEqual([]);
  });

  it('status：只看「当前账号 + 这个 endpoint」，别人名下的一律 false，不透露是谁的', async () => {
    const { svc } = makeDb([user('A'), user('B')]);
    await svc.subscribe('A', { endpoint: EP, keys: KEYS });
    expect(await svc.status('B', EP)).toEqual({ subscribed: false });
    expect(await svc.status('A', 'https://push.example.invalid/other')).toEqual({ subscribed: false });
    expect(await svc.status('A', EP)).toEqual({ subscribed: true });
  });

  it('status 是纯读取：零写库', async () => {
    const { svc, prisma } = makeDb([user('A')]);
    await svc.status('A', EP);
    for (const op of ['upsert', 'deleteMany', 'delete', 'update']) {
      expect(prisma.pushSubscription[op], op).not.toHaveBeenCalled();
    }
  });

  it('推送没配：status 照样能答（订阅表里本来就没有这一行时是 false）', async () => {
    vi.stubEnv('VAPID_PUBLIC_KEY', '');
    const { svc } = makeDb([user('A')]);
    await expect(svc.status('A', EP)).resolves.toEqual({ subscribed: false });
  });
});

describe('UI07 · 提醒 cron 跳过停用 / 归档 / 撤销 / 凭证过期的账号', () => {
  const cases: Array<[string, Row]> = [
    ['停用（isActive=false）', { isActive: false }],
    ['归档', { archivedAt: new Date('2026-09-01T00:00:00Z') }],
    ['旧版停用标记', { passwordHash: `${LEGACY_DEACTIVATED_PREFIX}$2a$04$hash` }],
    [
      `${STUDENT_TOKEN_TTL_DAYS} 天内没有签发过任何长期令牌（登录 / 注册 / 改密码都没有）`,
      { lastLogin: new Date(NOW.getTime() - (STUDENT_TOKEN_TTL_DAYS + 1) * DAY), pinSetAt: null },
    ],
  ];
  for (const [label, over] of cases) {
    it(`${label} → 不推`, async () => {
      const { svc } = makeDb(
        [user('ok'), user('off', over)],
        [
          { id: 's-ok', studentId: 'ok', endpoint: 'https://push.example.invalid/ok', p256dh: 'p', auth: 'a', lastSentAt: null },
          { id: 's-off', studentId: 'off', endpoint: 'https://push.example.invalid/off', p256dh: 'p', auth: 'a', lastSentAt: null },
        ],
      );
      const r = await svc.runDailyReminder(NOW);
      expect(r).toMatchObject({ targets: 1, sent: 1 });
      expect(sendNotification.mock.calls.map((c: any[]) => c[0].endpoint)).toEqual(['https://push.example.invalid/ok']);
    });
  }

  it('只注册过（没单独登录过）的学生照常推：注册即签发令牌，算有效凭证', async () => {
    const { svc } = makeDb(
      [user('fresh', { lastLogin: null, pinSetAt: new Date(NOW.getTime() - 2 * DAY) })],
      [{ id: 's', studentId: 'fresh', endpoint: 'https://push.example.invalid/f', p256dh: 'p', auth: 'a', lastSentAt: null }],
    );
    expect(await svc.runDailyReminder(NOW)).toMatchObject({ targets: 1, sent: 1 });
  });

  it('发送时再兜一层：直接对停用账号 sendToStudent 也发不出去', async () => {
    const { svc } = makeDb(
      [user('off', { isActive: false })],
      [{ id: 's', studentId: 'off', endpoint: 'https://push.example.invalid/x', p256dh: 'p', auth: 'a', lastSentAt: null }],
    );
    const r = await svc.sendToStudent('off', { title: 't', body: 'b', url: '/today', tag: 'x' }, NOW);
    expect(r).toEqual({ sent: 0, dropped: 0, failed: 0 });
    expect(sendNotification).not.toHaveBeenCalled();
  });
});

describe('UI07 · POST /push/status 控制器契约', () => {
  it('endpoint 放在请求体里（不进 URL / 日志）；身份只取令牌', async () => {
    const svc: any = { status: vi.fn(async () => ({ subscribed: true })) };
    const c = new PushController(svc);
    const req: any = { studentAuth: { id: 'A', name: 'A' } };
    await expect(c.status(req, { endpoint: EP })).resolves.toEqual({ subscribed: true });
    expect(svc.status).toHaveBeenCalledWith('A', EP);
  });

  it('坏请求体 → 400 bad_subscription；多余字段（比如想塞 studentId）也拒', async () => {
    const svc: any = { status: vi.fn() };
    const c = new PushController(svc);
    const req: any = { studentAuth: { id: 'A', name: 'A' } };
    await expect(c.status(req, { endpoint: 'not-a-url' })).rejects.toMatchObject({ response: { code: 'bad_subscription' } });
    await expect(c.status(req, { endpoint: EP, studentId: 'B' })).rejects.toMatchObject({ response: { code: 'bad_subscription' } });
    expect(svc.status).not.toHaveBeenCalled();
  });
});
