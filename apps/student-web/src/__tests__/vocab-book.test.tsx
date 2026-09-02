/** 统一“我的单词”验收：旧生词本与词汇教练不再是两套流程。 */
import { act, fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter, useLocation } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import App from '../App';
import { __resetForTest } from '../lib/auth-store';
import { writeToken } from '../lib/identity';

const TOKEN = 'unified-vocab-token';
type Req = { path: string; method: string; body: Record<string, unknown> | null; authorization?: string };
let reqs: Req[] = [];
let centerRows: Array<Record<string, unknown>> = [];
let overview: Record<string, unknown>;

const card = {
  headword: 'volcanic', phonetic: '/vɒlˈkænɪk/', pos: 'adjective', senseKey: 'volcanic:adjective:1',
  translation: '火山的', definition: 'relating to a volcano', sentence: 'Volcanic soil can be very fertile.',
  sentenceTranslation: '火山土壤可能非常肥沃。', collocations: ['volcanic soil'], wordFamily: ['volcano'],
  confusionWords: [], memoryHint: 'volcano + ic', imageUrl: null, audioText: 'volcanic', list: 'nawl', rank: 42, attribution: 'test',
};

function center() {
  return {
    stats: { total: centerRows.filter((row) => row.inNotebook !== false).length, totalLearned: centerRows.length, removed: centerRows.filter((row) => row.inNotebook === false).length, new: 1, learning: 0, mastered: 0, due: 0, weak: 0, spellingWeak: 0, listeningWeak: 0, speakingWeak: 0 },
    growth: [], filters: { sources: ['level_gap', 'reading_lookup'], stages: [], articles: [], topics: [], lists: ['nawl'] },
    total: centerRows.length, page: 1, pageSize: 30, items: centerRows,
  };
}

function json(status: number, body: unknown) {
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
    if (path === '/student-auth/me') return json(200, { id: 's1', name: '测试学生', nickname: '小测', appVersion: 'v2' });
    if (path.startsWith('/vocab-v2/center?')) return json(200, center());
    if (path === '/vocab-v2/overview') return json(200, overview);
    if (path === '/vocab-v2/custom-test/start') return json(200, { id: 'custom-1' });
    if (path === '/vocab-v2/collect') return json(200, { ok: true, action: body?.action, added: body?.action !== 'lookup_only', sense: { id: 'sense-volcanic', ...card } });
    if (path === '/vocab-v2/notebook/remove') {
      centerRows = centerRows.map((row) => row.senseId === body?.senseId ? { ...row, inNotebook: false } : row);
      return json(200, { ok: true, senseId: body?.senseId, inNotebook: false });
    }
    if (path === '/vocab-v2/notebook/relearn') {
      centerRows = centerRows.map((row) => row.senseId === body?.senseId ? { ...row, inNotebook: true } : row);
      return json(200, { ok: true, senseId: body?.senseId, inNotebook: true });
    }
    return json(404, { code: 'not_stubbed', path });
  }));
}

function Probe() {
  return <span data-testid="location">{useLocation().pathname + useLocation().search}</span>;
}

function mount(path = '/vocab') {
  return render(<MemoryRouter initialEntries={[path]}><App /><Probe /></MemoryRouter>);
}

async function settle(rounds = 18) {
  await act(async () => { for (let i = 0; i < rounds; i += 1) await Promise.resolve(); });
}

beforeEach(() => {
  __resetForTest();
  localStorage.clear();
  writeToken(TOKEN);
  centerRows = [{
    studentSenseId: 'owned-1', senseId: 'sense-volcanic', headword: 'volcanic', phonetic: card.phonetic,
    pos: card.pos, translation: card.translation, definition: card.definition, masteryStage: 2,
    due: '2026-09-02T00:00:00.000Z', source: 'level_gap', sourceTitle: null,
    firstSeenAt: '2026-09-02T00:00:00.000Z', inNotebook: true, skills: {},
    context: { sentence: card.sentence, translation: card.sentenceTranslation },
  }];
  overview = {
    dailyTarget: 12,
    today: null,
    pendingTests: [
      { dailySessionId: 'daily-0901', testSessionId: 'test-0901', date: '2026-09-01', total: 12, status: 'in_progress' },
      { dailySessionId: 'daily-0902', testSessionId: null, date: '2026-09-02', total: 10, status: 'not_started' },
    ],
  };
  installFetch();
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe('统一的我的单词', () => {
  it('只读取 V2 中心和跨日待办，所有请求都使用当前学生令牌', async () => {
    mount(); await settle();
    expect(screen.getByRole('heading', { name: '我的单词' })).toBeInTheDocument();
    expect(screen.getByText('9月1日单词测试 · 12 题')).toBeInTheDocument();
    expect(screen.getByText('9月2日单词测试 · 10 题')).toBeInTheDocument();
    expect(reqs.some((req) => req.path.startsWith('/vocab-v2/center?'))).toBe(true);
    expect(reqs.some((req) => req.path === '/vocab-v2/overview')).toBe(true);
    expect(reqs.some((req) => req.path.startsWith('/vocab/'))).toBe(false);
    for (const req of reqs.filter((req) => req.path !== '/student-auth/me')) expect(req.authorization).toBe(`Bearer ${TOKEN}`);
  });

  it('页面没有复习排期，也没有第二个词汇教练入口', async () => {
    mount(); await settle();
    expect(document.body.textContent).not.toMatch(/待复习|复习任务|FSRS|明天再考|词汇教练/);
    expect(screen.getByText('自定义抽查')).toBeInTheDocument();
  });

  it('自主抽查可选数量，并进入不记正式成绩的自定义测试', async () => {
    mount(); await settle();
    fireEvent.click(screen.getByRole('button', { name: '5' }));
    fireEvent.click(screen.getByRole('button', { name: '开始随机抽查' }));
    await settle();
    const call = reqs.find((req) => req.path === '/vocab-v2/custom-test/start');
    expect(call?.body).toEqual({ count: 5, scope: 'all' });
    expect(screen.getByTestId('location')).toHaveTextContent('/coach/test?sessionId=custom-1');
  });

  it('移出必须二次确认，成功后仍保留历史并可重新学习', async () => {
    mount(); await settle();
    fireEvent.click(screen.getByRole('button', { name: '我会了，移出' }));
    expect(reqs.some((req) => req.path === '/vocab-v2/notebook/remove')).toBe(false);
    fireEvent.click(screen.getByRole('button', { name: '确认移出' }));
    await settle();
    expect(reqs.find((req) => req.path === '/vocab-v2/notebook/remove')?.body).toEqual({ senseId: 'sense-volcanic' });
    expect(screen.getByText(/系统保留学习记录/)).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: '重新学习' }));
    await settle();
    expect(reqs.find((req) => req.path === '/vocab-v2/notebook/relearn')?.body).toEqual({ senseId: 'sense-volcanic' });
  });

  it('查词默认只查询，只有学生明确选择才加入或标记会', async () => {
    mount(); await settle();
    const input = screen.getByPlaceholderText('输入英文单词');
    fireEvent.change(input, { target: { value: 'volcanic' } });
    fireEvent.click(screen.getByRole('button', { name: '查询' }));
    await settle();
    expect(reqs.find((req) => req.path === '/vocab-v2/collect')?.body).toMatchObject({ headword: 'volcanic', action: 'lookup_only', source: 'search' });
    expect(screen.getByRole('button', { name: '加入我的单词' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '我已经会了' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '稍后再学' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '只查一下' })).toBeInTheDocument();
  });

  it('旧自由练习地址不再启动另一套流程', async () => {
    mount('/vocab/practice'); await settle();
    expect(screen.getByTestId('location')).toHaveTextContent('/vocab');
    expect(reqs.some((req) => req.path === '/vocab/due')).toBe(false);
  });
});
