/**
 * 首页「还有单词小测没做」提醒弹窗（2026-09-09）
 *
 * 起因：首发头三天，8 个学生把十个词学完了、单词小测一次没做。首页本来就有
 * 一张橙色卡片，但它在页面下方，学生点完「开始今天的课程」就走了。改成进首页
 * 时弹一次，一天只弹一次，关掉当天不再打扰。
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { act, render, screen, fireEvent } from '@testing-library/react';
import { MemoryRouter, useLocation } from 'react-router-dom';
import App from '../App';
import { writeToken } from '../lib/identity';
import { __resetForTest } from '../lib/auth-store';

const TOKEN = 'tok-1';
const PROFILE = { id: 'stu-1', name: '小明', nickname: '小明', avatar: null, englishLevel: 'olevel' };

function jsonResponse(status: number, body: unknown) {
  return Promise.resolve({
    ok: status >= 200 && status < 300,
    status,
    json: () => Promise.resolve(body),
    text: () => Promise.resolve(JSON.stringify(body)),
  } as unknown as Response);
}

const LESSON = {
  stage: 'idle',
  segments: [{ key: 'read', status: 'done', available: true, progress: 1, target: 1 }],
  nextAction: { kind: 'no_content', label: '今天的课做完了', href: null },
};

let pendingTests: unknown[] = [];
let reqs: string[] = [];

function overview() {
  return { dailyTarget: 10, today: null, readingBacklog: [], learningBacklog: [], pendingTests };
}

beforeEach(() => {
  reqs = [];
  localStorage.clear();
  __resetForTest();
  writeToken(TOKEN);
  pendingTests = [
    { dailySessionId: 'd-0908', testSessionId: null, date: '2026-09-08', total: 10, status: 'not_started' },
    { dailySessionId: 'd-0907', testSessionId: 't-0907', date: '2026-09-07', total: 10, status: 'in_progress' },
  ];
  vi.stubGlobal(
    'fetch',
    vi.fn((url: string, init: RequestInit = {}) => {
      const path = String(url).replace(/^.*\/api/, '');
      reqs.push(`${(init.method as string) ?? 'GET'} ${path}`);
      if (path === '/student-auth/me') return jsonResponse(200, { ...PROFILE, appVersion: 'v2' });
      if (path === '/lesson/today') return jsonResponse(200, LESSON);
      if (path.startsWith('/vocab-v2/overview')) return jsonResponse(200, overview());
      if (path === '/vocab-v2/test/start') return jsonResponse(200, { id: 't-new' });
      if (path.startsWith('/vocab-v2/test'))
        return jsonResponse(200, { id: 't-0907', version: 'v1', date: '2026-09-07', type: 'formal_test', status: 'in_progress', total: 10, answered: 0, correct: null, items: [] });
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

function Where() {
  const loc = useLocation();
  return <span data-testid="loc">{loc.pathname + loc.search}</span>;
}

function mount() {
  return render(
    <MemoryRouter initialEntries={['/today']}>
      <App />
      <Where />
    </MemoryRouter>,
  );
}

describe('首页单词小测提醒', () => {
  it('有没做的小测 → 弹窗，说清是哪天的、几个词', async () => {
    mount();
    await settle();
    const box = screen.getByTestId('pending-test-reminder');
    expect(box.textContent).toContain('还有一份单词小测没做');
    // 欠得最久的先提醒：09-07 那份，不是 09-08
    expect(box.textContent).toContain('9月7日');
    expect(box.textContent).toContain('10 个词');
  });

  it('点「现在去测」→ 进测试页；已有 testSessionId 就不再新建', async () => {
    mount();
    await settle();
    fireEvent.click(screen.getByTestId('reminder-go'));
    await settle();
    expect(screen.getByTestId('loc').textContent).toBe('/coach/test?sessionId=t-0907');
    expect(reqs.some((r) => r.includes('/vocab-v2/test/start'))).toBe(false);
  });

  it('点「待会儿」→ 关掉，当天不再弹', async () => {
    const first = mount();
    await settle();
    fireEvent.click(screen.getByTestId('reminder-later'));
    await settle();
    expect(screen.queryByTestId('pending-test-reminder')).toBeNull();

    first.unmount();
    mount();
    await settle();
    expect(screen.queryByTestId('pending-test-reminder')).toBeNull();
  });

  it('没有待做的小测 → 不弹', async () => {
    pendingTests = [];
    mount();
    await settle();
    expect(screen.queryByTestId('pending-test-reminder')).toBeNull();
  });

  it('localStorage 不可用也不炸，照常弹', async () => {
    // 只让「提醒记号」这个键读不出来 —— 令牌还得能读，不然直接被路由守卫送回登录页
    const orig = Storage.prototype.getItem;
    Storage.prototype.getItem = function (key: string) {
      if (key === 'sw:vocab-test-reminded') throw new Error('denied');
      return orig.call(this, key);
    };
    try {
      mount();
      await settle();
      expect(screen.getByTestId('pending-test-reminder')).toBeTruthy();
    } finally {
      Storage.prototype.getItem = orig;
    }
  });
});
