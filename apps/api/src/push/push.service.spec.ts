import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const sendNotification = vi.fn();
vi.mock('web-push', () => ({ sendNotification: (...args: unknown[]) => sendNotification(...args) }));

import { PushService } from './push.service';

function makePrisma(input: {
  subs?: Array<{ id: string; studentId: string; endpoint: string; p256dh?: string; auth?: string; lastSentAt?: Date | null }>;
  sessions?: Array<{ paperAssignmentId: string; studentIds: string[] }>;
  done?: string[];
}) {
  const subs = (input.subs ?? []).map((s) => ({ p256dh: 'p', auth: 'a', lastSentAt: null, ...s }));
  const prisma: any = {
    pushSubscription: {
      upsert: vi.fn().mockResolvedValue({}),
      deleteMany: vi.fn().mockResolvedValue({ count: 1 }),
      delete: vi.fn().mockResolvedValue({}),
      update: vi.fn().mockResolvedValue({}),
      findMany: vi.fn().mockImplementation(async (args: any) => {
        if (args?.where?.studentId) return subs.filter((s) => s.studentId === args.where.studentId);
        return subs;
      }),
    },
    morningQuizSession: {
      findMany: vi.fn().mockResolvedValue(
        (input.sessions ?? []).map((s) => ({
          paperAssignmentId: s.paperAssignmentId,
          class: { enrollments: s.studentIds.map((userId) => ({ userId })) },
        })),
      ),
    },
    studentSubmission: {
      findMany: vi.fn().mockResolvedValue((input.done ?? []).map((studentId) => ({ studentId }))),
    },
  };
  return prisma;
}

beforeEach(() => {
  sendNotification.mockReset();
  sendNotification.mockResolvedValue({ statusCode: 201 });
  vi.stubEnv('VAPID_PUBLIC_KEY', 'pub');
  vi.stubEnv('VAPID_PRIVATE_KEY', 'priv');
  vi.stubEnv('VAPID_SUBJECT', 'mailto:ops@example.invalid');
});
afterEach(() => vi.unstubAllEnvs());

describe('推送 —— 开关', () => {
  it('没配 VAPID 密钥 → 关着：config.enabled=false，cron 直接跳过，订阅回 503', async () => {
    vi.stubEnv('VAPID_PUBLIC_KEY', '');
    vi.stubEnv('VAPID_PRIVATE_KEY', '');
    const svc = new PushService(makePrisma({}));
    expect(svc.enabled()).toBe(false);
    expect(svc.config()).toMatchObject({ enabled: false, publicKey: null });
    await expect(svc.runDailyReminder()).resolves.toMatchObject({ skipped: 'disabled' });
    await expect(
      svc.subscribe('s1', { endpoint: 'https://push.example.invalid/x', keys: { p256dh: 'p', auth: 'a' } }),
    ).rejects.toMatchObject({ response: { code: 'push_disabled' } });
  });

  it('配好了 → config 给公钥和提醒时刻，**不给私钥**', () => {
    const svc = new PushService(makePrisma({}));
    const c = svc.config();
    expect(c).toEqual({ enabled: true, publicKey: 'pub', reminderTime: '16:30' });
    expect(JSON.stringify(c)).not.toContain('priv');
  });
});

describe('推送 —— 订阅', () => {
  it('按 endpoint upsert：同一台设备再来一次只更新，换了人登录就归新的人', async () => {
    const prisma = makePrisma({});
    const svc = new PushService(prisma);
    await svc.subscribe('s2', { endpoint: 'https://push.example.invalid/x', keys: { p256dh: 'p', auth: 'a' } }, 'UA/1');
    const call = prisma.pushSubscription.upsert.mock.calls[0][0];
    expect(call.where).toEqual({ endpoint: 'https://push.example.invalid/x' });
    expect(call.create.studentId).toBe('s2');
    expect(call.update.studentId).toBe('s2');
  });

  it('退订只删自己名下的那一行', async () => {
    const prisma = makePrisma({});
    await new PushService(prisma).unsubscribe('s1', 'https://push.example.invalid/x');
    expect(prisma.pushSubscription.deleteMany.mock.calls[0][0]).toEqual({
      where: { studentId: 's1', endpoint: 'https://push.example.invalid/x' },
    });
  });
});

describe('推送 —— 发送', () => {
  it('推送服务回 410 → 这台设备的订阅删掉；回 500 → 保留、只记失败', async () => {
    const prisma = makePrisma({
      subs: [
        { id: 'gone', studentId: 's1', endpoint: 'https://push.example.invalid/gone' },
        { id: 'flaky', studentId: 's1', endpoint: 'https://push.example.invalid/flaky' },
        { id: 'ok', studentId: 's1', endpoint: 'https://push.example.invalid/ok' },
      ],
    });
    sendNotification.mockImplementation(async (sub: any) => {
      if (sub.endpoint.endsWith('/gone')) throw Object.assign(new Error('gone'), { statusCode: 410 });
      if (sub.endpoint.endsWith('/flaky')) throw Object.assign(new Error('boom'), { statusCode: 500 });
      return { statusCode: 201 };
    });
    const r = await new PushService(prisma).sendToStudent('s1', { title: 't', body: 'b', url: '/today', tag: 'x' });
    expect(r).toEqual({ sent: 1, dropped: 1, failed: 1 });
    expect(prisma.pushSubscription.delete).toHaveBeenCalledWith({ where: { id: 'gone' } });
    expect(prisma.pushSubscription.update).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: 'ok' } }),
    );
  });

  it('发出去的东西：带 VAPID、TTL 一小时、内容就是那几个字段', async () => {
    const prisma = makePrisma({ subs: [{ id: 'a', studentId: 's1', endpoint: 'https://push.example.invalid/a' }] });
    await new PushService(prisma).sendToStudent('s1', { title: '每日英语', body: 'x', url: '/today', tag: 'daily-reminder' });
    const [sub, body, opts] = sendNotification.mock.calls[0];
    expect(sub).toEqual({ endpoint: 'https://push.example.invalid/a', keys: { p256dh: 'p', auth: 'a' } });
    expect(JSON.parse(body)).toEqual({ title: '每日英语', body: 'x', url: '/today', tag: 'daily-reminder' });
    expect(opts).toMatchObject({ TTL: 3600, vapidDetails: { publicKey: 'pub', privateKey: 'priv' } });
  });
});

describe('推送 —— 每日提醒', () => {
  // 2026-09-10 16:30 SGT
  const NOW = new Date('2026-09-10T08:30:00.000Z');

  it('只推给「订阅了 + 今天有课 + 没交卷 + 今天没提醒过」的人', async () => {
    const prisma = makePrisma({
      subs: [
        { id: '1', studentId: 'todo', endpoint: 'https://push.example.invalid/1' },
        { id: '2', studentId: 'done', endpoint: 'https://push.example.invalid/2' },
        { id: '3', studentId: 'noclass', endpoint: 'https://push.example.invalid/3' },
        // 今天 08:00 SGT 已经推过
        { id: '4', studentId: 'already', endpoint: 'https://push.example.invalid/4', lastSentAt: new Date('2026-09-10T00:00:00.000Z') },
        // 昨天推过的不算
        { id: '5', studentId: 'yesterday', endpoint: 'https://push.example.invalid/5', lastSentAt: new Date('2026-09-09T08:30:00.000Z') },
      ],
      sessions: [{ paperAssignmentId: 'asg', studentIds: ['todo', 'done', 'already', 'yesterday', 'unsubscribed'] }],
      done: ['done'],
    });
    const r = await new PushService(prisma).runDailyReminder(NOW);
    expect(r).toMatchObject({ skipped: null, targets: 2, sent: 2 });
    const pushed = sendNotification.mock.calls.map((c: any[]) => c[0].endpoint);
    expect(pushed.sort()).toEqual(['https://push.example.invalid/1', 'https://push.example.invalid/5']);
  });

  it('查的是今天（新加坡日）的 active 场次', async () => {
    const prisma = makePrisma({});
    await new PushService(prisma).runDailyReminder(NOW);
    const where = prisma.morningQuizSession.findMany.mock.calls[0][0].where;
    expect(where.status).toBe('active');
    expect(where.date.toISOString()).toBe('2026-09-10T00:00:00.000Z');
  });

  it('已交卷 = 非练习卷且有最终提交时间', async () => {
    const prisma = makePrisma({ sessions: [{ paperAssignmentId: 'asg', studentIds: ['a'] }] });
    await new PushService(prisma).runDailyReminder(NOW);
    const where = prisma.studentSubmission.findMany.mock.calls[0][0].where;
    expect(where).toEqual({
      assignmentId: { in: ['asg'] },
      status: { not: 'practice' },
      finalSubmittedAt: { not: null },
    });
  });

  it('归档账号不推', async () => {
    const prisma = makePrisma({});
    await new PushService(prisma).runDailyReminder(NOW);
    expect(prisma.pushSubscription.findMany.mock.calls[0][0].where).toEqual({ student: { archivedAt: null } });
  });
});
