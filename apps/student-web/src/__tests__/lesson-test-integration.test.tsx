/** 统一每日单词测试：恢复、逐题保存、交卷全部绑定同一个 V2 会话。 */
import { act, fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import App from '../App';
import { __resetForTest } from '../lib/auth-store';
import { writeToken } from '../lib/identity';

type Req = { path: string; method: string; body: Record<string, unknown> | null; authorization?: string };
let reqs: Req[] = [];
let session: any;

const questionRows = () => [
  { id: 'q1', position: 1, status: 'pending', response: null, isCorrect: null, card: null, question: { type: 'meaning_choice', prompt: 'volcanic', cue: null, options: ['火山的', '平静的', '潮湿的', '狭窄的'] } },
  { id: 'q2', position: 2, status: 'pending', response: null, isCorrect: null, card: null, question: { type: 'spelling', prompt: '根据中文、词性或发音，写出英文单词。', cue: { pos: 'verb', translation: '下降；减少', audioText: 'decline' }, options: [] } },
];

function view() {
  return { ...session, answered: session.items.filter((item: any) => item.status === 'answered').length, correct: session.status === 'submitted' ? 2 : null };
}

function json(body: unknown, status = 200) {
  return Promise.resolve({ ok: status >= 200 && status < 300, status, text: async () => JSON.stringify(body) } as Response);
}

function installFetch() {
  reqs = [];
  vi.stubGlobal('fetch', vi.fn((url: string, init: RequestInit = {}) => {
    const path = String(url).replace(/^.*\/api/, '');
    const method = String(init.method ?? 'GET');
    const body = init.body ? JSON.parse(String(init.body)) : null;
    const headers = (init.headers ?? {}) as Record<string, string>;
    reqs.push({ path, method, body, authorization: headers.Authorization });
    if (path === '/student-auth/me') return json({ id: 's1', name: '测试学生', nickname: '小测', appVersion: 'v2' });
    if (path === '/vocab-v2/test?sessionId=formal-0902') return json(view());
    if (path === '/vocab-v2/test/answer') {
      session.items = session.items.map((item: any) => item.id === body.itemId
        ? { ...item, status: 'answered', response: { value: body.response }, isCorrect: true }
        : item);
      return json(view());
    }
    if (path === '/vocab-v2/test/submit') {
      session.status = 'submitted';
      return json(view());
    }
    return json({ code: 'not_stubbed', path }, 404);
  }));
}

function mount() {
  return render(<MemoryRouter initialEntries={['/coach/test?sessionId=formal-0902']}><App /></MemoryRouter>);
}

async function settle(rounds = 15) {
  await act(async () => { for (let i = 0; i < rounds; i += 1) await Promise.resolve(); });
}

beforeEach(() => {
  __resetForTest(); localStorage.clear(); writeToken('TK');
  session = { id: 'formal-0902', version: 'V2-20260902-TEST', date: '2026-09-02', type: 'formal_test', status: 'in_progress', total: 2, answered: 0, correct: null, items: questionRows() };
  installFetch();
});
afterEach(() => { vi.unstubAllGlobals(); vi.restoreAllMocks(); });

describe('统一正式单词测试整链', () => {
  it('按日期恢复、逐题保存、全部答完才可交卷', async () => {
    mount(); await settle();
    expect(screen.getByRole('heading', { name: '9月2日单词测试' })).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: '火山的' }));
    await settle();
    // 2026-09-05 盲测 P1-8：每题先给对错反馈，点「下一题」再继续
    expect(screen.getByTestId('test-feedback')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: '下一题' }));
    await settle();
    const input = screen.getByPlaceholderText('输入答案');
    fireEvent.change(input, { target: { value: 'decline' } });
    fireEvent.click(screen.getByRole('button', { name: '提交这题' }));
    await settle();
    fireEvent.click(screen.getByRole('button', { name: '看总结' }));
    await settle();
    expect(screen.getByRole('heading', { name: '所有题都答完了' })).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: '交卷' }));
    await settle();
    expect(screen.getByText('2 / 2')).toBeInTheDocument();
    expect(reqs.filter((req) => req.path === '/vocab-v2/test/answer').map((req) => req.body)).toEqual([
      { sessionId: 'formal-0902', itemId: 'q1', response: 0, responseMs: expect.any(Number) },
      { sessionId: 'formal-0902', itemId: 'q2', response: 'decline', responseMs: expect.any(Number) },
    ]);
    expect(reqs.find((req) => req.path === '/vocab-v2/test/submit')?.body).toEqual({ sessionId: 'formal-0902' });
  });

  it('刷新仍读取同一个 sessionId，不创建第二份卷子', async () => {
    session.items[0] = { ...session.items[0], status: 'answered', response: { value: 0 }, isCorrect: true };
    const first = mount(); await settle(); first.unmount();
    mount(); await settle();
    expect(screen.getByText('2 / 2')).toBeInTheDocument();
    expect(reqs.filter((req) => req.path === '/vocab-v2/test?sessionId=formal-0902')).toHaveLength(2);
    expect(reqs.some((req) => req.path === '/vocab-v2/test/start')).toBe(false);
  });

  it('所有认证请求只用 Bearer，不带学生身份参数', async () => {
    mount(); await settle();
    for (const req of reqs.filter((req) => req.path !== '/student-auth/me')) {
      expect(req.authorization).toBe('Bearer TK');
      expect(req.path).not.toMatch(/name=|studentId=/);
      expect(JSON.stringify(req.body ?? {})).not.toMatch(/studentName|studentId/);
    }
  });
});
