import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import UserAdminPage from '../UserAdmin';

/**
 * 后台「新建账号」（2026-09-15）：管理员给学校领导 / 新老师开账号。
 * 钉三件事：提交的内容对（邮箱转小写）、邮箱被占用时说人话、密码太短不发请求。
 */

let calls: Array<{ method: string; url: string; body: any }>;
let createReply: { status: number; body: unknown };

beforeEach(() => {
  calls = [];
  createReply = { status: 201, body: { id: 'new-1', email: 'leader@esic.edu.sg', name: '王校长', role: 'admin', isActive: true } };
  vi.stubGlobal(
    'fetch',
    vi.fn(async (url: string, init?: RequestInit) => {
      const method = init?.method ?? 'GET';
      calls.push({ method, url: String(url), body: init?.body ? JSON.parse(String(init.body)) : null });
      const reply = (status: number, body: unknown) =>
        ({ ok: status < 300, status, json: async () => body, text: async () => JSON.stringify(body) }) as Response;
      if (String(url).includes('/auth/me')) return reply(200, { id: 'admin-1', role: 'admin' });
      if (method === 'POST' && String(url).endsWith('/admin-rbac/users')) return reply(createReply.status, createReply.body);
      return reply(200, { users: [], total: 0, page: 1, pageSize: 20, totalPages: 1 });
    }),
  );
});
afterEach(() => vi.unstubAllGlobals());

async function openAndFill(over: { email?: string; name?: string; role?: string; password?: string } = {}) {
  render(<UserAdminPage />);
  fireEvent.click(await screen.findByTestId('open-create-user'));
  fireEvent.change(screen.getByLabelText(/登录邮箱/), { target: { value: over.email ?? '  Leader@ESIC.edu.sg ' } });
  fireEvent.change(screen.getByLabelText(/姓名/), { target: { value: over.name ?? '王校长' } });
  fireEvent.change(screen.getByLabelText(/角色/), { target: { value: over.role ?? 'admin' } });
  fireEvent.change(screen.getByLabelText(/初始密码/), { target: { value: over.password ?? 'long-password-1' } });
  fireEvent.click(screen.getByTestId('create-user-submit'));
}

describe('后台新建账号', () => {
  it('填好提交 → POST /admin-rbac/users（邮箱去空白转小写）；成功后关掉并提示把账号交给对方', async () => {
    await openAndFill();
    await waitFor(() => expect(screen.queryByTestId('create-user-form')).toBeNull());
    const post = calls.find((c) => c.method === 'POST');
    expect(post?.body).toEqual({ email: 'leader@esic.edu.sg', name: '王校长', role: 'admin', password: 'long-password-1' });
    expect(screen.getByTestId('create-user-notice').textContent).toContain('leader@esic.edu.sg');
    expect(screen.getByTestId('create-user-notice').textContent).toContain('管理员');
  });

  it('邮箱已经有账号 → 就地说清楚，面板不关', async () => {
    createReply = { status: 409, body: { code: 'email_taken' } };
    await openAndFill();
    expect((await screen.findByRole('alert')).textContent).toContain('这个邮箱已经有账号了');
    expect(screen.getByTestId('create-user-form')).toBeInTheDocument();
  });

  it('密码不到 8 位 → 不发请求', async () => {
    await openAndFill({ password: 'short' });
    expect((await screen.findByRole('alert')).textContent).toContain('至少 8 位');
    expect(calls.some((c) => c.method === 'POST')).toBe(false);
  });
});
