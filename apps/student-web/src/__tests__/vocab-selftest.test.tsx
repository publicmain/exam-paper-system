import { act, render, screen } from '@testing-library/react';
import { MemoryRouter, useLocation } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import App from '../App';
import { __resetForTest } from '../lib/auth-store';
import { writeToken } from '../lib/identity';

function Probe() { const location = useLocation(); return <span data-testid="loc">{location.pathname}</span>; }

describe('旧自测入口退役', () => {
  beforeEach(() => {
    __resetForTest(); localStorage.clear(); writeToken('token');
    vi.stubGlobal('fetch', vi.fn(async (url: string) => {
      const path = String(url).replace(/^.*\/api/, '');
      const body = path === '/student-auth/me'
        ? { id: 's1', name: '学生', appVersion: 'v2' }
        : path.startsWith('/vocab-v2/center?')
          ? { stats: { total: 0, totalLearned: 0, removed: 0 }, growth: [], filters: { sources: [], stages: [], articles: [], topics: [], lists: [] }, total: 0, page: 1, pageSize: 30, items: [] }
          : { dailyTarget: 12, today: null, pendingTests: [] };
      return { ok: true, status: 200, text: async () => JSON.stringify(body) } as Response;
    }));
  });
  it('/vocab/selftest 只作为兼容地址跳回统一中心', async () => {
    render(<MemoryRouter initialEntries={['/vocab/selftest']}><App /><Probe /></MemoryRouter>);
    await act(async () => { for (let i = 0; i < 12; i += 1) await Promise.resolve(); });
    expect(screen.getByTestId('loc')).toHaveTextContent('/vocab');
    expect(fetch).not.toHaveBeenCalledWith(expect.stringContaining('/vocab/quiz'), expect.anything());
  });
});
