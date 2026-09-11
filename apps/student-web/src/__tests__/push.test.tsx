/**
 * 浏览器推送 —— 学生端（2026-09-10）。
 *
 * 钉三件事：这台设备到底能不能开（纯判断）；账号页的开关按状态说人话；
 * 首页的一次性提示说过「不用了」就不再出现。浏览器那些 API 全部 mock 掉 ——
 * jsdom 没有 PushManager。
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { writeToken } from '../lib/identity';
import { derivePushStatus, urlBase64ToUint8Array, type PushEnv } from '../lib/push';

const pushStatusMock = vi.fn();
const enablePushMock = vi.fn();
const disablePushMock = vi.fn();
vi.mock('../lib/push', async (importOriginal) => {
  const mod = await importOriginal<typeof import('../lib/push')>();
  return {
    ...mod,
    pushStatus: () => pushStatusMock(),
    enablePush: (t: string) => enablePushMock(t),
    disablePush: (t: string) => disablePushMock(t),
  };
});

import { PushSettings } from '../push/PushSettings';
import { PushNudge } from '../push/PushNudge';

const base: PushEnv = {
  serviceWorker: true,
  pushManager: true,
  notification: true,
  permission: 'default',
  ios: false,
  standalone: false,
  subscribed: false,
};

describe('这台设备能不能开 —— derivePushStatus', () => {
  it('都支持、没拒绝、没订 → off；订了 → on', () => {
    expect(derivePushStatus(base)).toBe('off');
    expect(derivePushStatus({ ...base, subscribed: true })).toBe('on');
  });

  it('iOS 没装到主屏幕 → needs_install，**哪怕 PushManager 不存在也不说「不支持」**', () => {
    expect(derivePushStatus({ ...base, ios: true, standalone: false, pushManager: false })).toBe('needs_install');
    expect(derivePushStatus({ ...base, ios: true, standalone: true })).toBe('off');
  });

  it('缺任何一样能力 → unsupported', () => {
    expect(derivePushStatus({ ...base, serviceWorker: false })).toBe('unsupported');
    expect(derivePushStatus({ ...base, pushManager: false })).toBe('unsupported');
    expect(derivePushStatus({ ...base, notification: false })).toBe('unsupported');
  });

  it('拒绝过 → denied，网页自己没法再问', () => {
    expect(derivePushStatus({ ...base, permission: 'denied' })).toBe('denied');
    expect(derivePushStatus({ ...base, permission: 'denied', subscribed: true })).toBe('denied');
  });
});

describe('VAPID 公钥解码', () => {
  it('base64url → 字节', () => {
    expect([...urlBase64ToUint8Array('AQID')]).toEqual([1, 2, 3]);
    // 带 - 和 _ 的、不带 padding 的
    expect([...urlBase64ToUint8Array('-_8')]).toEqual([251, 255]);
  });
});

function jsonResponse(body: unknown, status = 200) {
  return Promise.resolve({
    ok: status >= 200 && status < 300,
    status,
    text: () => Promise.resolve(JSON.stringify(body)),
  } as Response);
}

let config: unknown = { enabled: true, publicKey: 'pub', reminderTime: '16:30' };

beforeEach(() => {
  localStorage.clear();
  writeToken('tok');
  pushStatusMock.mockReset();
  enablePushMock.mockReset();
  disablePushMock.mockReset();
  config = { enabled: true, publicKey: 'pub', reminderTime: '16:30' };
  vi.stubGlobal(
    'fetch',
    vi.fn((url: string) => {
      const p = String(url).replace(/^.*\/api/, '');
      if (p === '/push/config') return jsonResponse(config);
      return jsonResponse({}, 404);
    }),
  );
});
afterEach(() => {
  vi.unstubAllGlobals();
});

describe('账号页的「提醒」', () => {
  it('服务端没开 → 整节不出现，学生不会看到一个开不了的开关', async () => {
    config = { enabled: false, publicKey: null, reminderTime: '16:30' };
    pushStatusMock.mockResolvedValue('off');
    render(<PushSettings />);
    // 等 config 回来
    await new Promise((r) => setTimeout(r, 0));
    expect(screen.queryByTestId('push-box')).toBeNull();
  });

  it('能开没开 → 说清几点提醒，打开开关调 enablePush，成功后开关是「开」', async () => {
    pushStatusMock.mockResolvedValue('off');
    enablePushMock.mockResolvedValue('on');
    render(<PushSettings />);
    const sw = await screen.findByRole('switch', { name: '上课日提醒' });
    expect(sw.getAttribute('aria-checked')).toBe('false');
    expect(screen.getByTestId('push-box').textContent).toContain('16:30');
    await userEvent.click(sw);
    expect(enablePushMock).toHaveBeenCalledWith('tok');
    await waitFor(() => expect(screen.getByRole('switch', { name: '上课日提醒' }).getAttribute('aria-checked')).toBe('true'));
  });

  it('已开 → 关掉开关调 disablePush', async () => {
    pushStatusMock.mockResolvedValue('on');
    disablePushMock.mockResolvedValue(undefined);
    render(<PushSettings />);
    const sw = await screen.findByRole('switch', { name: '上课日提醒' });
    expect(sw.getAttribute('aria-checked')).toBe('true');
    await userEvent.click(sw);
    expect(disablePushMock).toHaveBeenCalledWith('tok');
    await waitFor(() => expect(screen.getByRole('switch', { name: '上课日提醒' }).getAttribute('aria-checked')).toBe('false'));
  });

  it('iOS 没装到主屏幕 → 给安装步骤，不给按钮', async () => {
    pushStatusMock.mockResolvedValue('needs_install');
    render(<PushSettings />);
    expect(await screen.findByText(/添加到主屏幕/)).toBeInTheDocument();
    expect(screen.queryByRole('switch')).toBeNull();
  });

  it('拒绝过 → 说去浏览器设置里改，不给按钮', async () => {
    pushStatusMock.mockResolvedValue('denied');
    render(<PushSettings />);
    expect(await screen.findByText(/拒绝了本站的通知/)).toBeInTheDocument();
    expect(screen.queryByRole('switch')).toBeNull();
  });

  it('开启失败 → 就地报错，不弹走', async () => {
    pushStatusMock.mockResolvedValue('off');
    enablePushMock.mockRejectedValue(new Error('boom'));
    render(<PushSettings />);
    await userEvent.click(await screen.findByRole('switch', { name: '上课日提醒' }));
    expect(await screen.findByText(/没能开启/)).toBeInTheDocument();
    // 失败后开关仍是「关」，可以再试
    expect(screen.getByRole('switch', { name: '上课日提醒' }).getAttribute('aria-checked')).toBe('false');
  });
});

describe('首页的一次性提示', () => {
  it('能开没开 → 出现；点「不用了」→ 消失，并且下次不再出现', async () => {
    pushStatusMock.mockResolvedValue('off');
    const view = render(<PushNudge />);
    expect(await screen.findByTestId('push-nudge')).toBeInTheDocument();
    await userEvent.click(screen.getByText('不用了'));
    expect(screen.queryByTestId('push-nudge')).toBeNull();
    expect(localStorage.getItem('sw:push-nudge-dismissed')).toBe('1');

    view.unmount();
    render(<PushNudge />);
    await new Promise((r) => setTimeout(r, 0));
    expect(screen.queryByTestId('push-nudge')).toBeNull();
  });

  it('已经开了 / 不支持 / 拒绝过 → 不打扰', async () => {
    for (const s of ['on', 'unsupported', 'denied'] as const) {
      pushStatusMock.mockResolvedValue(s);
      const view = render(<PushNudge />);
      await new Promise((r) => setTimeout(r, 0));
      expect(screen.queryByTestId('push-nudge'), s).toBeNull();
      view.unmount();
    }
  });

  it('点「开启提醒」→ 调 enablePush；成功后提示消失', async () => {
    pushStatusMock.mockResolvedValue('off');
    enablePushMock.mockResolvedValue('on');
    render(<PushNudge />);
    await userEvent.click(await screen.findByText('开启提醒'));
    expect(enablePushMock).toHaveBeenCalledWith('tok');
    await new Promise((r) => setTimeout(r, 0));
    expect(screen.queryByTestId('push-nudge')).toBeNull();
  });
});
