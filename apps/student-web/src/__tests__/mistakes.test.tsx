/**
 * `/mistakes` —— **试点期暂停**（S12L）。
 *
 * 原来这里有 30+ 条：两段分组、销账 / 恢复、对账、连点守卫、掉票处理。
 * 那一页整个换成了占位页，所以那些用例也随之退休 —— 它们在 Git 历史里，
 * 恢复功能时一起取回来。
 *
 * 暂停期只剩三条规矩，但每一条都重要：
 *   · **一个请求都不发**（服务端那四个端点已经 503，前端再打一次
 *     只会让学生先看到一次失败）；
 *   · **说清楚数据还在**（学生最怕的是「我的错题没了」）；
 *   · **出得去**（占位页不能是个死胡同）。
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { act, fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import MistakesPage from '../pages/Mistakes';
import { writeToken } from '../lib/identity';
import { __resetForTest } from '../lib/auth-store';

const navigate = vi.fn();
vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual<typeof import('react-router-dom')>('react-router-dom');
  return { ...actual, useNavigate: () => navigate };
});

let fetchMock: ReturnType<typeof vi.fn>;

beforeEach(() => {
  __resetForTest();
  localStorage.clear();
  writeToken('mistakes-token');
  navigate.mockReset();
  fetchMock = vi.fn(async () => {
    throw new Error('这一页不该发任何请求');
  });
  vi.stubGlobal('fetch', fetchMock);
});
afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

const mount = () =>
  render(
    <MemoryRouter>
      <MistakesPage />
    </MemoryRouter>,
  );

const settle = async () => {
  await act(async () => {
    for (let i = 0; i < 12; i++) await Promise.resolve();
  });
};

describe('S12L —— 错题本暂停', () => {
  it('**一个请求都不发**（连令牌都不用读）', async () => {
    mount();
    await settle();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('明说暂未开放', async () => {
    mount();
    await settle();
    expect(screen.getByTestId('unavailable-title').textContent).toBe('错题本暂未开放');
  });

  it('**说清楚以前的错题还在**，也说清楚不影响今天', async () => {
    mount();
    await settle();
    const text = document.body.textContent ?? '';
    expect(text).toMatch(/都还在|没有删/);
    expect(text).toContain('不影响今天的完成度');
  });

  it('出得去：回今天的课 / 去生词本', async () => {
    mount();
    await settle();
    fireEvent.click(screen.getByTestId('back-to-today'));
    expect(navigate).toHaveBeenCalledWith('/today');
    fireEvent.click(screen.getByTestId('go-vocab'));
    expect(navigate).toHaveBeenCalledWith('/vocab');
  });

  it('**不写任何本地存储**', async () => {
    const before = JSON.stringify({ ...localStorage });
    mount();
    await settle();
    expect(JSON.stringify({ ...localStorage })).toBe(before);
  });
});
