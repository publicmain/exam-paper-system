import { afterEach, expect, it, vi } from 'vitest';
import { cleanup, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import App from '../App';
import { __resetForTest } from '../lib/auth-store';
import { readToken, writeToken } from '../lib/identity';

// Reject the real dynamic import, as a lost optional chunk would on a mobile connection.
vi.mock('../components/AchievementNotifier', () => { throw new Error('Failed to fetch dynamically imported module: AchievementNotifier'); });

afterEach(() => { cleanup(); vi.unstubAllGlobals(); vi.restoreAllMocks(); __resetForTest(); });

it('可选通知模块加载失败时，账号/学习导航仍可使用，不清掉登录、不让整页崩溃', async () => {
  __resetForTest(); localStorage.clear(); writeToken('retained-token');
  const errors = vi.spyOn(console, 'error').mockImplementation(() => undefined);
  vi.stubGlobal('fetch', vi.fn(async (url: string) => {
    const me = String(url).endsWith('/student-auth/me');
    const body = me ? { id: 'isolated-student', name: '隔离验收', nickname: null, avatar: null, englishLevel: 'olevel' } : {};
    return { ok: me, status: me ? 200 : 404, text: async () => JSON.stringify(body) } as Response;
  }));
  render(<MemoryRouter initialEntries={['/account']}><App /></MemoryRouter>);
  await screen.findByTestId('account-page');
  await waitFor(() => expect(errors).toHaveBeenCalled());
  expect(screen.getByTestId('account-page')).toBeTruthy();
  expect(screen.getByTestId('open-level')).toBeTruthy();
  expect(screen.getByTestId('logout')).toBeTruthy();
  expect(screen.queryByText('页面出了点问题。')).toBeNull();
  expect(readToken()).toBe('retained-token');
});
