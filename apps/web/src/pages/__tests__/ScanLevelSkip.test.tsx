import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import MorningQuizScan from '../MorningQuizScan';
import { api } from '../../lib/api';

/**
 * P4 —— 已经定过难度的学生，扫码时**不该再看到难度选择器**。
 *
 * 这条是学生每天都会碰到的那一次多余点击，也是章程「不同难度不应拥有
 * 不同的身份、页面或任务流程」的直接体现：难度是他的属性，不是每天现
 * 挑的临时输入。
 */

vi.mock('../../lib/api', () => ({
  api: {
    attendanceScanRoster: vi.fn(),
    attendanceScan: vi.fn(),
    studentAuthMe: vi.fn(),
  },
}));

const ROSTER = {
  sessionId: 'sess_auth_x',
  sessionStatus: 'active',
  className: 'G11',
  level: 'ielts_authentic',
  siblingSessions: [
    { sessionId: 'sess_auth_x', level: 'ielts_authentic' },
    { sessionId: 'sess_olevel_x', level: 'olevel' },
    { sessionId: 'sess_basic_x', level: 'ielts_simplified' },
  ],
  students: [{ id: 'u1', name: '小明' }],
};

/** 造一个不会过期的学生 token（只有 payload 被读，签名不验） */
function studentToken(name = '小明') {
  const b64 = (o: unknown) =>
    btoa(String.fromCharCode(...new TextEncoder().encode(JSON.stringify(o))))
      .replace(/\+/g, '-')
      .replace(/\//g, '_')
      .replace(/=+$/, '');
  return [
    b64({ alg: 'HS256', typ: 'JWT' }),
    b64({ id: 'u1', role: 'student', name, exp: Math.floor(Date.now() / 1000) + 86400 }),
    'sig',
  ].join('.');
}

function renderScan() {
  return render(
    <MemoryRouter initialEntries={['/scan/v2.c1.abc']}>
      <Routes>
        <Route path="/scan/:token" element={<MorningQuizScan />} />
      </Routes>
    </MemoryRouter>,
  );
}

describe('扫码页 · 难度选择器（P4）', () => {
  beforeEach(() => {
    localStorage.clear();
    vi.mocked(api.attendanceScanRoster).mockResolvedValue(ROSTER as any);
    vi.mocked(api.studentAuthMe).mockReset();
  });
  afterEach(() => localStorage.clear());

  it('**已定难度的学生：不显示选择器，直接进签到**', async () => {
    localStorage.setItem('auth_token', studentToken());
    vi.mocked(api.studentAuthMe).mockResolvedValue({
      id: 'u1',
      name: '小明',
      nickname: '小明',
      avatar: null,
      pinSet: true,
      englishLevel: 'olevel',
    } as any);

    renderScan();

    // 签到界面出现 = 已经越过选择器
    await waitFor(() => expect(screen.getByText(/我是 小明/)).toBeTruthy());
    expect(screen.queryByText('请先选择难度')).toBeNull();
    expect(screen.queryByTestId('level-pick-olevel')).toBeNull();
  });

  it('未定难度（englishLevel=null）：仍然显示选择器', async () => {
    localStorage.setItem('auth_token', studentToken());
    vi.mocked(api.studentAuthMe).mockResolvedValue({
      id: 'u1',
      name: '小明',
      nickname: '小明',
      avatar: null,
      pinSet: true,
      englishLevel: null,
    } as any);

    renderScan();

    await waitFor(() => expect(screen.getByText('请先选择难度')).toBeTruthy());
    expect(screen.getByTestId('level-pick-olevel')).toBeTruthy();
  });

  it('没登录（查不到自己是谁）：退回选择器，不卡住', async () => {
    // 无 token —— 前端连问都不问，直接按未落定处理
    renderScan();

    await waitFor(() => expect(screen.getByText('请先选择难度')).toBeTruthy());
    expect(api.studentAuthMe).not.toHaveBeenCalled();
  });

  it('/me 请求失败（离线/token 过期）：退回选择器，不白屏', async () => {
    localStorage.setItem('auth_token', studentToken());
    vi.mocked(api.studentAuthMe).mockRejectedValue(new Error('offline'));

    renderScan();

    await waitFor(() => expect(screen.getByText('请先选择难度')).toBeTruthy());
  });

  it('难度那层今天没开 → 仍显示选择器（不能把人卡在没有的场次上）', async () => {
    localStorage.setItem('auth_token', studentToken());
    vi.mocked(api.studentAuthMe).mockResolvedValue({
      id: 'u1',
      name: '小明',
      nickname: '小明',
      avatar: null,
      pinSet: true,
      englishLevel: 'ielts_light', // 今天三场里没有这层
    } as any);

    renderScan();

    await waitFor(() => expect(screen.getByText('请先选择难度')).toBeTruthy());
  });
});
