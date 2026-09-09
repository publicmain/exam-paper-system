/**
 * 简答题下面的写作自查提示（2026-09-09 接入 LanguageTool）。
 *
 * 三条界限在这里钉死：只讲英文对不对不讲答得对不对、只提示不代改、
 * 服务不可用时完全静默不挡答题。
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { act, render, screen, fireEvent } from '@testing-library/react';
import { WritingHints, __resetWritingCheckCache, useWritingCheckEnabled } from '../lesson/shared/WritingHints';
import { writeToken } from '../lib/identity';

const TOKEN = 'tok-1';
let posted: string[] = [];
let reply: unknown = { issues: [] };
let statusReply: unknown = { enabled: true };

function jsonResponse(status: number, body: unknown) {
  return Promise.resolve({
    ok: status >= 200 && status < 300,
    status,
    json: () => Promise.resolve(body),
    text: () => Promise.resolve(JSON.stringify(body)),
  } as unknown as Response);
}

beforeEach(() => {
  posted = [];
  reply = { issues: [] };
  statusReply = { enabled: true };
  localStorage.clear();
  writeToken(TOKEN);
  __resetWritingCheckCache();
  vi.useFakeTimers();
  vi.stubGlobal(
    'fetch',
    vi.fn((url: string, init: RequestInit = {}) => {
      const path = String(url).replace(/^.*\/api/, '');
      if (path === '/writing-check/status') return jsonResponse(200, statusReply);
      if (path === '/writing-check') {
        posted.push(JSON.parse(String(init.body)).text);
        return jsonResponse(200, reply);
      }
      return jsonResponse(200, {});
    }),
  );
});
afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

async function settle(ms = 1500) {
  await act(async () => {
    vi.advanceTimersByTime(ms);
    await Promise.resolve();
    await Promise.resolve();
  });
}

const SPELLING = {
  issues: [
    { offset: 13, length: 6, text: 'wirter', kind: 'spelling', message: '拼写', suggestions: ['writer', 'winter'] },
  ],
};

describe('写作自查提示', () => {
  it('停下来一会儿才查，把拼错的词和建议显示出来', async () => {
    reply = SPELLING;
    render(<WritingHints text="he away give wirter pen" enabled />);
    // 还没到静默时间：一个请求都没发
    await act(async () => { vi.advanceTimersByTime(500); });
    expect(posted).toHaveLength(0);

    await settle();
    expect(posted).toEqual(['he away give wirter pen']);
    const box = screen.getByTestId('writing-hints');
    expect(box.textContent).toContain('wirter');
    expect(box.textContent).toContain('writer');
    // 说清楚它不判内容
    expect(box.textContent).toContain('不判断答得对不对');
  });

  it('没有问题 → 什么都不显示', async () => {
    reply = { issues: [] };
    render(<WritingHints text="The sky was clear when she left home." enabled />);
    await settle();
    expect(screen.queryByTestId('writing-hints')).toBeNull();
  });

  it('太短不查 —— 一两个词的填空题没有语法可言', async () => {
    render(<WritingHints text="blue" enabled />);
    await settle();
    expect(posted).toHaveLength(0);
  });

  it('功能关着 → 一个请求都不发', async () => {
    reply = SPELLING;
    render(<WritingHints text="he away give wirter pen" enabled={false} />);
    await settle();
    expect(posted).toHaveLength(0);
    expect(screen.queryByTestId('writing-hints')).toBeNull();
  });

  it('服务查不了 → 静默，绝不弹错误', async () => {
    vi.stubGlobal('fetch', vi.fn(() => Promise.reject(new Error('offline'))));
    render(<WritingHints text="he away give wirter pen" enabled />);
    await settle();
    expect(screen.queryByTestId('writing-hints')).toBeNull();
    expect(screen.queryByRole('alert')).toBeNull();
  });

  it('同一段文字不重复查', async () => {
    reply = SPELLING;
    const view = render(<WritingHints text="he away give wirter pen" enabled />);
    await settle();
    expect(posted).toHaveLength(1);
    view.rerender(<WritingHints text="he away give wirter pen" enabled />);
    await settle();
    expect(posted).toHaveLength(1);
  });

  it('提示里不出现任何「改一下就对了」的按钮 —— 只提示不代改', async () => {
    reply = SPELLING;
    render(<WritingHints text="he away give wirter pen" enabled />);
    await settle();
    expect(screen.queryByRole('button')).toBeNull();
  });
});

function EnabledProbe() {
  const on = useWritingCheckEnabled();
  return <span data-testid="on">{on ? 'yes' : 'no'}</span>;
}

describe('功能开关', () => {
  it('服务端说开着 → 开', async () => {
    statusReply = { enabled: true };
    render(<EnabledProbe />);
    await settle(0);
    expect(screen.getByTestId('on').textContent).toBe('yes');
  });

  it('服务端说关着 / 问不到 → 关', async () => {
    statusReply = { enabled: false };
    render(<EnabledProbe />);
    await settle(0);
    expect(screen.getByTestId('on').textContent).toBe('no');
  });
});
