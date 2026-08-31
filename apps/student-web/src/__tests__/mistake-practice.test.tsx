/**
 * `/mistakes/practice` —— **试点期暂停**（S12L）。理由与用例说明见
 * `mistakes.test.tsx`。补段（`drill`）在服务端也一并关掉了，所以没有
 * 任何一条流程会把学生导到这一页；它只是深链接与旧书签的落点。
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { act, fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import MistakePracticePage from '../pages/MistakePractice';
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
  writeToken('practice-token');
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

const settle = async () => {
  await act(async () => {
    for (let i = 0; i < 12; i++) await Promise.resolve();
  });
};

describe('S12L —— 错题重练暂停', () => {
  it('**一个请求都不发**', async () => {
    render(<MemoryRouter><MistakePracticePage /></MemoryRouter>);
    await settle();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('明说暂未开放，并说清今天只有两段', async () => {
    render(<MemoryRouter><MistakePracticePage /></MemoryRouter>);
    await settle();
    expect(screen.getByTestId('unavailable-title').textContent).toBe('错题重练暂未开放');
    expect(document.body.textContent).toContain('阅读');
    expect(document.body.textContent).toContain('单词');
  });

  it('出得去', async () => {
    render(<MemoryRouter><MistakePracticePage /></MemoryRouter>);
    await settle();
    fireEvent.click(screen.getByTestId('back-to-today'));
    expect(navigate).toHaveBeenCalledWith('/today');
  });
});
