/**
 * 忘记密码 → 老师重置 → 学生自己设新密码（2026-09-08）
 *
 * 背景：老师在教师端点「重置密码」后账号的 pinHash 被清空。学生这时
 * 登录会 invalid_credentials，走「第一次使用？注册」又会 name_taken_in_class
 * （自助注册按班里同名判重）—— 页面上出不来。登录页因此补了一条通道，
 * 走 `POST /student-auth/register`（只认还没设过密码的账号）。
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { act, render, screen, fireEvent } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import App from '../App';
import { __resetForTest } from '../lib/auth-store';

const TOKEN = 'tok-new-pin';
let reqs: { path: string; method: string; body: string | null }[] = [];

function jsonResponse(status: number, body: unknown) {
  return Promise.resolve({
    ok: status >= 200 && status < 300,
    status,
    json: () => Promise.resolve(body),
    text: () => Promise.resolve(JSON.stringify(body)),
  } as unknown as Response);
}

const PROFILE = { id: 'stu-1', name: 'Starry', nickname: 'Starry', avatar: null, englishLevel: 'ielts_light' };

beforeEach(() => {
  reqs = [];
  localStorage.clear();
  __resetForTest();
  vi.stubGlobal(
    'fetch',
    vi.fn((url: string, init: RequestInit = {}) => {
      const path = String(url).replace(/^.*\/api/, '');
      reqs.push({ path, method: (init.method as string) ?? 'GET', body: init.body ? String(init.body) : null });
      if (path === '/student-auth/login') return jsonResponse(401, { code: 'invalid_credentials' });
      if (path === '/student-auth/self-register') return jsonResponse(409, { code: 'name_taken_in_class' });
      if (path === '/student-auth/register') return jsonResponse(200, { token: TOKEN, student: PROFILE });
      if (path === '/student-auth/me') return jsonResponse(200, { ...PROFILE, appVersion: 'v2' });
      if (path === '/lesson/today')
        return jsonResponse(200, { segments: [], nextAction: { kind: 'no_content', label: '今天没有课', href: null }, stage: 'idle' });
      if (path.startsWith('/vocab-v2/overview'))
        return jsonResponse(200, { dailyTarget: 10, today: null, readingBacklog: [], learningBacklog: [], pendingTests: [] });
      return jsonResponse(200, {});
    }),
  );
});
afterEach(() => vi.unstubAllGlobals());

async function settle() {
  await act(async () => {
    await Promise.resolve();
    await new Promise((r) => setTimeout(r, 0));
  });
}

function mount() {
  return render(
    <MemoryRouter initialEntries={['/login']}>
      <App />
    </MemoryRouter>,
  );
}

describe('老师重置密码后，学生自己设新密码', () => {
  it('登录页有入口，设完新密码即登录', async () => {
    mount();
    await settle();

    fireEvent.click(screen.getByTestId('forgot-password'));
    await settle();

    fireEvent.change(screen.getByLabelText('姓名'), { target: { value: 'Starry' } });
    fireEvent.change(screen.getByLabelText('新密码（6 位数字）'), { target: { value: '241860' } });
    fireEvent.change(screen.getByLabelText('再输一次新密码'), { target: { value: '241860' } });
    fireEvent.click(screen.getByRole('button', { name: '设新密码并登录' }));
    await settle();

    const call = reqs.find((r) => r.path === '/student-auth/register');
    expect(call).toBeTruthy();
    expect(JSON.parse(call!.body!)).toMatchObject({ name: 'Starry', password: '241860' });
    // 落盘的只有令牌
    expect(localStorage.getItem('sw:token')).toBe(TOKEN);
  });

  it('两次新密码不一致 → 就地报错，一个请求都不发', async () => {
    mount();
    await settle();
    fireEvent.click(screen.getByTestId('forgot-password'));
    await settle();
    fireEvent.change(screen.getByLabelText('姓名'), { target: { value: 'Starry' } });
    fireEvent.change(screen.getByLabelText('新密码（6 位数字）'), { target: { value: '241860' } });
    fireEvent.change(screen.getByLabelText('再输一次新密码'), { target: { value: '111111' } });
    fireEvent.click(screen.getByRole('button', { name: '设新密码并登录' }));
    await settle();
    expect(screen.getByRole('alert').textContent).toContain('两次输入的新密码不一样');
    expect(reqs.some((r) => r.path === '/student-auth/register')).toBe(false);
  });

  it('新密码不是 6 位数字 → 就地报错，不发请求', async () => {
    mount();
    await settle();
    fireEvent.click(screen.getByTestId('forgot-password'));
    await settle();
    fireEvent.change(screen.getByLabelText('姓名'), { target: { value: 'Starry' } });
    fireEvent.change(screen.getByLabelText('新密码（6 位数字）'), { target: { value: '12' } });
    fireEvent.change(screen.getByLabelText('再输一次新密码'), { target: { value: '12' } });
    fireEvent.click(screen.getByRole('button', { name: '设新密码并登录' }));
    await settle();
    expect(screen.getByRole('alert').textContent).toContain('6 位数字');
    expect(reqs.some((r) => r.path === '/student-auth/register')).toBe(false);
  });

  it('账号其实还有密码（老师没重置）→ 说人话，指路去登录', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn((url: string, init: RequestInit = {}) => {
        const path = String(url).replace(/^.*\/api/, '');
        reqs.push({ path, method: (init.method as string) ?? 'GET', body: init.body ? String(init.body) : null });
        if (path === '/student-auth/register') return jsonResponse(400, { code: 'already_registered' });
        return jsonResponse(200, {});
      }),
    );
    mount();
    await settle();
    fireEvent.click(screen.getByTestId('forgot-password'));
    await settle();
    fireEvent.change(screen.getByLabelText('姓名'), { target: { value: 'Starry' } });
    fireEvent.change(screen.getByLabelText('新密码（6 位数字）'), { target: { value: '241860' } });
    fireEvent.change(screen.getByLabelText('再输一次新密码'), { target: { value: '241860' } });
    fireEvent.click(screen.getByRole('button', { name: '设新密码并登录' }));
    await settle();
    expect(screen.getByRole('alert').textContent).toContain('直接去登录');
    expect(localStorage.getItem('sw:token')).toBeNull();
  });

  it('「← 回登录」能切回去', async () => {
    mount();
    await settle();
    fireEvent.click(screen.getByTestId('forgot-password'));
    await settle();
    fireEvent.click(screen.getByTestId('back-to-login'));
    await settle();
    expect(screen.getByRole('button', { name: '登录' })).toBeTruthy();
    expect(screen.queryByLabelText('再输一次新密码')).toBeNull();
  });
});
