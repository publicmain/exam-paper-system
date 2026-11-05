/**
 * 2026-11-06 Codex 审查 P1：ExtraPracticeSync 原来对所有 storage 事件都 flush，
 * 而 flush 里 readToken() 会写存储探测键 → 另一个标签页收到 storage 事件 → 再 flush → 互相无限触发。
 * 现在只认加练队列自己的键，空队列也不读令牌。
 */
import { render } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

vi.mock('../lib/auth-store', () => ({
  getState: () => ({ status: 'authenticated', profile: { id: 'stu-1' } }),
  handleAuthFailure: vi.fn(() => false),
}));
const identity = vi.hoisted(() => ({ readToken: vi.fn(() => 'tok') }));
vi.mock('../lib/identity', async (orig) => ({ ...(await orig<typeof import('../lib/identity')>()), readToken: identity.readToken }));

import ExtraPracticeSync from '../components/extra/ExtraPracticeSync';

afterEach(() => { localStorage.clear(); identity.readToken.mockClear(); vi.unstubAllGlobals(); });

describe('加练补交只认自己的存储键', () => {
  it('队列为空时不读令牌、不发请求；别的键变化不触发', async () => {
    const fetchMock = vi.fn(); vi.stubGlobal('fetch', fetchMock);
    render(<ExtraPracticeSync owner="stu-1" />);
    window.dispatchEvent(new StorageEvent('storage', { key: '__sw_probe__' }));
    window.dispatchEvent(new StorageEvent('storage', { key: 'sw:token' }));
    await new Promise((r) => setTimeout(r, 20));
    expect(identity.readToken).not.toHaveBeenCalled();
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
