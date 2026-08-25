import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import MePage from '../Me';
import { api } from '../../lib/api';

/**
 * 个人主页 /me（docs/PRD/student-auth-and-home.md §9）。
 *
 * 契约：
 *   · 无 token → 登录卡（姓名 + 6 位 PIN）
 *   · 登录成功 → 存 token、渲染「今天的课」三段
 *   · pin_locked → 显示剩余分钟数
 *   · 同名 → 班级候选按钮
 */

vi.mock('../../lib/api', async () => {
  return {
    BASE: '',
    api: {
      studentLogin: vi.fn(),
      studentAuthMe: vi.fn().mockResolvedValue({ id: 's1', name: '张三', pinSet: true }),
      studentChangePin: vi.fn(),
    },
  };
});

// /me 的三段数据用裸 fetch（带 BASE 前缀）—— 全局 mock 掉
const fetchMock = vi.fn();
vi.stubGlobal('fetch', fetchMock);

function jsonResponse(data: any) {
  return Promise.resolve({ json: () => Promise.resolve(data) });
}

function renderMe() {
  return render(
    <MemoryRouter initialEntries={['/me']}>
      <Routes>
        <Route path="/me" element={<MePage />} />
        <Route path="*" element={<div>OTHER</div>} />
      </Routes>
    </MemoryRouter>,
  );
}

beforeEach(() => {
  vi.clearAllMocks();
  localStorage.clear();
  fetchMock.mockImplementation((url: string) => {
    const u = String(url);
    if (u.includes('history-by-name')) return jsonResponse({ submissions: [] });
    if (u.includes('upcoming-for-name')) return jsonResponse({ upcoming: [] });
    if (u.includes('vocab/stats'))
      return jsonResponse({ totalDue: 8, reviewedToday: 0, streakDays: 3 });
    if (u.includes('practice-queue')) return jsonResponse({ items: [{ id: 'm1' }] });
    return jsonResponse({});
  });
});

describe('/me 未登录', () => {
  it('显示登录卡；PIN 未满 6 位时登录按钮禁用', async () => {
    renderMe();
    expect(screen.getByText('我的每日英语')).toBeTruthy();
    const btn = screen.getByRole('button', { name: '登录' });
    expect(btn).toBeDisabled();
  });

  it('登录成功：存 token、进入「今天的课」', async () => {
    (api.studentLogin as any).mockResolvedValue({
      token: 'tok-abc',
      student: { id: 's1', name: '张三' },
    });
    const u = userEvent.setup();
    renderMe();
    await u.type(screen.getByPlaceholderText('姓名'), '张三');
    await u.type(screen.getByPlaceholderText('6 位 PIN'), '280519');
    await u.click(screen.getByRole('button', { name: '登录' }));
    await waitFor(() => expect(screen.getByText('你好，张三')).toBeTruthy());
    expect(localStorage.getItem('auth_token')).toBe('tok-abc');
    // 三段渲染
    await waitFor(() => expect(screen.getByText(/今日词汇/)).toBeTruthy());
    expect(screen.getByText(/8 个词在等你/)).toBeTruthy();
    expect(screen.getByText(/1 道待练/)).toBeTruthy();
    expect(screen.getByText(/🔥 连续学习 3 天/)).toBeTruthy();
  });

  it('锁定：显示剩余分钟', async () => {
    (api.studentLogin as any).mockRejectedValue(
      Object.assign(new Error('locked'), { status: 403, body: { code: 'pin_locked', retryAfterSec: 600 } }),
    );
    const u = userEvent.setup();
    renderMe();
    await u.type(screen.getByPlaceholderText('姓名'), '张三');
    await u.type(screen.getByPlaceholderText('6 位 PIN'), '280519');
    await u.click(screen.getByRole('button', { name: '登录' }));
    await waitFor(() => expect(screen.getByText(/已锁定 —— 10 分钟后再试/)).toBeTruthy());
  });

  it('同名：渲染班级候选，点选后带 studentId 重试', async () => {
    (api.studentLogin as any)
      .mockResolvedValueOnce({
        needDisambiguation: true,
        candidates: [
          { studentId: 'a', name: '张三', classes: ['G11'] },
          { studentId: 'b', name: '张三', classes: ['G12'] },
        ],
      })
      .mockResolvedValueOnce({ token: 'tok-b', student: { id: 'b', name: '张三' } });
    const u = userEvent.setup();
    renderMe();
    await u.type(screen.getByPlaceholderText('姓名'), '张三');
    await u.type(screen.getByPlaceholderText('6 位 PIN'), '280519');
    await u.click(screen.getByRole('button', { name: '登录' }));
    await waitFor(() => expect(screen.getByText(/2 位同名同学/)).toBeTruthy());
    await u.click(screen.getByText(/G12/));
    await waitFor(() => expect(localStorage.getItem('auth_token')).toBe('tok-b'));
    expect((api.studentLogin as any).mock.calls[1][0]).toMatchObject({ studentId: 'b' });
  });
});

/** btoa 只吃 Latin-1 —— 中文名要先过 UTF-8 编码（与生产 decodeJwt 的逆操作对齐） */
function fakeJwt(payload: Record<string, unknown>): string {
  const bytes = new TextEncoder().encode(JSON.stringify(payload));
  const b64 = btoa(String.fromCharCode(...bytes))
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');
  return `x.${b64}.y`;
}

describe('/me 已有 token', () => {
  it('token 有效（role=student、未过期）→ 直接进主页不再要求登录', async () => {
    localStorage.setItem(
      'auth_token',
      fakeJwt({ id: 's1', name: '张三', role: 'student', exp: Math.floor(Date.now() / 1000) + 3600 }),
    );
    renderMe();
    await waitFor(() => expect(screen.getByText('你好，张三')).toBeTruthy());
  });

  it('过期 token → 回登录卡', () => {
    localStorage.setItem(
      'auth_token',
      fakeJwt({ id: 's1', name: '张三', role: 'student', exp: Math.floor(Date.now() / 1000) - 60 }),
    );
    renderMe();
    expect(screen.getByText('我的每日英语')).toBeTruthy();
  });
});
