/**
 * 共用设备上的提醒归属（审计 UI07）。
 *
 * 原症状：页面按「浏览器里有订阅」就显示已开启，而后台那条订阅可能还属于上一个账号；
 * A 开提醒 → 退出 → B 登录，B 看到「已开启」，设备继续收 A 的个人提醒。
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { pushStatus, releasePushForThisDevice } from '../lib/push';

type Sub = { endpoint: string; unsubscribe: ReturnType<typeof vi.fn>; toJSON: () => unknown };

let sub: Sub | null;
let calls: Array<{ url: string; body: unknown }>;
let statusReply: { status: number; body: unknown };

beforeEach(() => {
  calls = [];
  sub = { endpoint: 'https://push.example/abc', unsubscribe: vi.fn(async () => true), toJSON: () => ({}) };
  statusReply = { status: 200, body: { subscribed: true } };
  vi.stubGlobal('Notification', { permission: 'granted' });
  vi.stubGlobal('PushManager', function PushManager() {});
  Object.defineProperty(navigator, 'serviceWorker', {
    configurable: true,
    value: { getRegistration: async () => ({ pushManager: { getSubscription: async () => sub } }) },
  });
  vi.stubGlobal(
    'fetch',
    vi.fn(async (url: string, init: RequestInit) => {
      calls.push({ url: String(url), body: init?.body ? JSON.parse(String(init.body)) : null });
      if (String(url).endsWith('/push/status')) {
        return { ok: statusReply.status < 300, status: statusReply.status, text: async () => JSON.stringify(statusReply.body) } as Response;
      }
      return { ok: true, status: 200, text: async () => '{"ok":true}' } as Response;
    }),
  );
});
afterEach(() => {
  vi.unstubAllGlobals();
  Reflect.deleteProperty(navigator, 'serviceWorker');
});

describe('UI07 提醒状态按当前账号判断', () => {
  it('**本机有订阅、但服务端说不是这个账号的 → 显示「没开」**', async () => {
    statusReply = { status: 200, body: { subscribed: false } };
    expect(await pushStatus('TOKEN-B')).toBe('off');
    const c = calls.find((x) => x.url.endsWith('/push/status'))!;
    expect(c.body).toEqual({ endpoint: 'https://push.example/abc' });
  });

  it('本机有订阅、服务端确认是这个账号的 → 「已开」', async () => {
    expect(await pushStatus('TOKEN-A')).toBe('on');
  });

  it('老服务端没有这个接口（404）→ 退回按设备判断，不谎报「没开」', async () => {
    statusReply = { status: 404, body: {} };
    expect(await pushStatus('TOKEN-A')).toBe('on');
  });
});

describe('UI07 退出 / 令牌失效时解绑本机订阅', () => {
  it('**主动退出（有有效令牌）：先让服务端删这条订阅，再在本机退订**', async () => {
    await releasePushForThisDevice('TOKEN-A');
    const unsub = calls.find((x) => x.url.endsWith('/push/unsubscribe'));
    expect(unsub?.body).toEqual({ endpoint: 'https://push.example/abc' });
    expect(sub!.unsubscribe).toHaveBeenCalledTimes(1);
  });

  it('令牌已失效：只在本机退订（端点随之作废）', async () => {
    await releasePushForThisDevice(null);
    expect(calls.some((x) => x.url.endsWith('/push/unsubscribe'))).toBe(false);
    expect(sub!.unsubscribe).toHaveBeenCalledTimes(1);
  });

  it('没有订阅 / 不支持推送：什么都不做，也不报错', async () => {
    sub = null;
    await expect(releasePushForThisDevice('TOKEN-A')).resolves.toBeUndefined();
    expect(calls).toHaveLength(0);
  });
});
