/**
 * 「这句有问题？」（2026-10-20）。
 *
 * 真组件 + 真 api 客户端，只在 fetch 打桩。学生点一下：两步确认，发 POST /vocab-v2/report
 * 带上题目 id；服务端回 hidden=true 时告诉学生这句已经先下架。
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ReportSentence } from '../components/vocab/ReportSentence';
import { writeToken } from '../lib/identity';

const TOKEN = 'student-token-report';

function response(body: unknown, status = 200) {
  return Promise.resolve({ ok: status >= 200 && status < 300, status, text: () => Promise.resolve(JSON.stringify(body)) } as Response);
}

beforeEach(() => {
  localStorage.clear();
  writeToken(TOKEN);
});
afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe('这句有问题？', () => {
  it('点一下先确认，不会误触就发出去', async () => {
    const fetchMock = vi.fn(() => response({ ok: true, hidden: true }));
    vi.stubGlobal('fetch', fetchMock);
    render(<ReportSentence itemId="item-7" />);
    await userEvent.click(screen.getByTestId('report-sentence'));
    expect(screen.getByTestId('report-sentence-confirm')).toHaveTextContent('告诉老师后，这句会先下架');
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('确认后按题目 id 报，带本人令牌；服务端下架了就告诉学生', async () => {
    const fetchMock = vi.fn((_url: string, _init?: RequestInit) => response({ ok: true, hidden: true }));
    vi.stubGlobal('fetch', fetchMock);
    render(<ReportSentence itemId="item-7" />);
    await userEvent.click(screen.getByTestId('report-sentence'));
    await userEvent.click(screen.getByRole('button', { name: '告诉老师' }));
    await waitFor(() => expect(screen.getByTestId('report-sentence-done')).toHaveTextContent('这句已经先下架'));
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toMatch(/\/vocab-v2\/report$/);
    expect(init?.method).toBe('POST');
    expect(JSON.parse(String(init?.body))).toEqual({ itemId: 'item-7' });
    expect(JSON.stringify(init?.headers)).toContain(TOKEN);
  });

  it('课程文章原句没被自动下架：只说老师会看', async () => {
    vi.stubGlobal('fetch', vi.fn(() => response({ ok: true, hidden: false })));
    render(<ReportSentence itemId="item-7" />);
    await userEvent.click(screen.getByTestId('report-sentence'));
    await userEvent.click(screen.getByRole('button', { name: '告诉老师' }));
    await waitFor(() => expect(screen.getByTestId('report-sentence-done')).toHaveTextContent('收到了，老师会看'));
    expect(screen.getByTestId('report-sentence-done')).not.toHaveTextContent('下架');
  });

  it('「算了」回到原样，什么都不发', async () => {
    const fetchMock = vi.fn(() => response({ ok: true, hidden: true }));
    vi.stubGlobal('fetch', fetchMock);
    render(<ReportSentence itemId="item-7" />);
    await userEvent.click(screen.getByTestId('report-sentence'));
    await userEvent.click(screen.getByRole('button', { name: '算了' }));
    expect(screen.getByTestId('report-sentence')).toBeInTheDocument();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('没发出去：说清楚，可以再试', async () => {
    vi.stubGlobal('fetch', vi.fn(() => response({ code: 'rate_limited' }, 429)));
    render(<ReportSentence itemId="item-7" />);
    await userEvent.click(screen.getByTestId('report-sentence'));
    await userEvent.click(screen.getByRole('button', { name: '告诉老师' }));
    await waitFor(() => expect(screen.getByTestId('report-sentence-confirm')).toHaveTextContent('没发出去，再试一次'));
    expect(screen.getByRole('button', { name: '告诉老师' })).toBeEnabled();
  });
});
