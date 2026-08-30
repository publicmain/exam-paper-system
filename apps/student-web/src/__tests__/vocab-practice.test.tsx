/**
 * 阶段 12A —— 生词本自由练习（`/vocab/practice`）的**行为测试**。
 *
 * 挂真 `App`，只在 `fetch` 打桩，**不 import 页面组件**。
 *
 * 这一屏的规矩：
 *
 *   · **只吃 `/vocab/due`**。拿不到卡就说拿不到，**绝不**退回课程队列
 *     （`/vocab/lesson-cards`）、自测（`/vocab/quiz`）或正式测试 ——
 *     那是 G-9A 记下来的旧端病：学生以为在练自己的生词本，其实在刷别的词表。
 *   · **不碰课程进度**。一次 `/lesson/vocab-cursor` 都不许有：自由练习
 *     推进课程完成度，等于把「今天的课」刷没了。
 *   · **`requestId` 在第一次尝试之前就定好，重发一直用同一个**，
 *     而且**没成功就不翻页**。
 *   · **回执照搬**：服务端说 `tooFast` / `duplicate` 就照说，不假装成功。
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { act, render, screen } from '@testing-library/react';
import { MemoryRouter, useLocation } from 'react-router-dom';
import App from '../App';
import { writeToken, readToken } from '../lib/identity';
import { __resetForTest } from '../lib/auth-store';
import { ROUTES } from '../routes.contract';

const VOCAB = '/vocab';
const PRACTICE = '/vocab/practice';

const PROFILE = { id: 't6_done', name: '测试六号', nickname: '六号', avatar: null };
const TOKEN = 'practice-token';

type Req = { path: string; method: string; headers: Record<string, string>; body: string | null };
let reqs: Req[] = [];

function jsonResponse(status: number, body: unknown) {
  return Promise.resolve({
    ok: status >= 200 && status < 300,
    status,
    text: () => Promise.resolve(JSON.stringify(body)),
  } as Response);
}

// ─────────────────────────────────────────────────────────────
// 夹具 —— 字段照 `vocab-review.service.ts` 的 due()
// ─────────────────────────────────────────────────────────────

const card = (over: Record<string, unknown> = {}) => ({
  headword: 'ferry',
  surfaceForm: 'ferries',
  contextSentence: 'The ferries stopped running after dark.',
  sourcePassageTitle: 'The River Ferry',
  phonetic: '/ˈferi/',
  translation: '渡船',
  pos: 'n.',
  definition: 'a boat that carries people across water',
  tag: ['O-Level'],
  state: 'learning',
  reps: 2,
  needsFirstTeaching: false,
  firstTaughtAt: '2026-08-28T02:10:00.000Z',
  sourceType: 'auto_wrong_answer',
  addedAt: '2026-08-28T02:10:00.000Z',
  ...over,
});

const due = (cards: Record<string, unknown>[] = [card()], over: Record<string, unknown> = {}) => ({
  student: { id: PROFILE.id, name: PROFILE.name },
  totalDue: cards.length,
  cards,
  ...over,
});

const receipt = (over: Record<string, unknown> = {}) => ({
  headword: 'ferry',
  state: 'review',
  due: '2026-09-02T00:00:00.000Z',
  intervalDays: 3,
  reps: 3,
  ...over,
});

// ─────────────────────────────────────────────────────────────
// 网络边界
// ─────────────────────────────────────────────────────────────

let dueReply: () => Promise<Response>;
let reviewReply: () => Promise<Response>;
let undoReply: () => Promise<Response>;

function installFetch() {
  reqs = [];
  const fetchMock = vi.fn((url: string, init: RequestInit = {}) => {
    const full = String(url).replace(/^.*\/api/, '');
    const path = full.split('?')[0];
    reqs.push({
      path: full,
      method: (init.method as string) ?? 'GET',
      headers: (init.headers as Record<string, string>) ?? {},
      body: init.body ? String(init.body) : null,
    });
    if (path === '/student-auth/me') return jsonResponse(200, { ...PROFILE, appVersion: 'v2' });
    if (path === '/vocab/due') return dueReply();
    if (path === '/vocab/review') return reviewReply();
    if (path === '/vocab/review/undo') return undoReply();
    return jsonResponse(404, { code: 'not_stubbed', path: full });
  });
  vi.stubGlobal('fetch', fetchMock);
}

function LocationProbe() {
  const loc = useLocation();
  return <span data-testid="loc">{loc.pathname}</span>;
}

function mount(at: string = PRACTICE) {
  return render(
    <MemoryRouter initialEntries={[at]}>
      <App />
      <LocationProbe />
    </MemoryRouter>,
  );
}

async function settle(rounds = 14) {
  await act(async () => {
    for (let i = 0; i < rounds; i++) await Promise.resolve();
  });
}

const at = () => screen.getByTestId('loc').textContent;
const text = () => document.body.textContent ?? '';
const calls = (p: string) => reqs.filter((r) => r.path.split('?')[0] === p);
const bodies = (p: string) => calls(p).map((c) => JSON.parse(c.body ?? '{}'));

async function click(el: HTMLElement) {
  await act(async () => {
    el.click();
  });
  await settle();
}

/** 揭开答案 → 评一个分。评分按钮四个：again / hard / good / easy。 */
async function reveal() {
  await click(screen.getByTestId('reveal'));
}

beforeEach(() => {
  __resetForTest();
  localStorage.clear();
  writeToken(TOKEN);
  dueReply = () => jsonResponse(200, due());
  reviewReply = () => jsonResponse(200, receipt());
  undoReply = () => jsonResponse(200, { headword: 'ferry', undone: true, reps: 2, state: 'learning' });
  installFetch();
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

// ─────────────────────────────────────────────────────────────
// AC-05 —— 只吃 /vocab/due
// ─────────────────────────────────────────────────────────────

describe('AC-05 只吃 /vocab/due', () => {
  it('**挂载只打一个 GET /vocab/due**，零查询串、零请求体、零写', async () => {
    mount();
    await settle();
    expect(at()).toBe(PRACTICE);
    expect(calls('/vocab/due')).toHaveLength(1);
    const c = calls('/vocab/due')[0];
    expect(c.method).toBe('GET');
    expect(c.headers.Authorization).toBe(`Bearer ${TOKEN}`);
    expect(c.path).toBe('/vocab/due');
    expect(c.body).toBeNull();
    expect(reqs.filter((r) => r.method !== 'GET')).toEqual([]);
  });

  it('**没卡时也绝不退回课程队列 / 自测 / 正式测试**', async () => {
    dueReply = () => jsonResponse(200, due([], { totalDue: 0 }));
    mount();
    await settle();
    expect(screen.getByTestId('practice-empty')).toBeTruthy();
    for (const r of reqs) {
      expect(r.path).not.toMatch(/lesson-cards|vocab\/quiz|quiz\/attempt|mistakes/);
    }
  });

  it('**一次 `/lesson/*` 都不碰**（课程进度与自由练习无关）', async () => {
    mount();
    await settle();
    await reveal();
    await click(screen.getByTestId('rate-good'));
    for (const r of reqs) expect(r.path).not.toMatch(/^\/lesson\//);
  });

  it('**零身份参数**', async () => {
    mount();
    await settle();
    await reveal();
    await click(screen.getByTestId('rate-good'));
    for (const r of reqs) {
      expect(r.path).not.toMatch(/name=|studentName=|studentId=/);
      if (r.body) expect(r.body).not.toMatch(/"name"|"studentName"|"studentId"/);
    }
  });

  it('**服务端发卡顺序原样保留**', async () => {
    dueReply = () =>
      jsonResponse(200, due([card({ headword: 'zebra' }), card({ headword: 'apple' })]));
    mount();
    await settle();
    expect(screen.getByTestId('card-headword').textContent).toContain('zebra');
    await reveal();
    await click(screen.getByTestId('rate-good'));
    expect(screen.getByTestId('card-headword').textContent).toContain('apple');
  });

  it('**没票时进来去登录页，不发任何词汇请求**', async () => {
    localStorage.clear();
    __resetForTest();
    mount();
    await settle();
    expect(at()).toBe(ROUTES.login);
    expect(calls('/vocab/due')).toHaveLength(0);
  });
});

// ─────────────────────────────────────────────────────────────
// AC-05 —— 评分、跳过、撤销
// ─────────────────────────────────────────────────────────────

describe('AC-05 评分与跳过', () => {
  it('**跳过不写任何东西**，直接下一张', async () => {
    dueReply = () => jsonResponse(200, due([card({ headword: 'zebra' }), card({ headword: 'apple' })]));
    mount();
    await settle();
    await click(screen.getByTestId('skip'));
    expect(calls('/vocab/review')).toHaveLength(0);
    expect(screen.getByTestId('card-headword').textContent).toContain('apple');
  });

  it('**四个评分档位都在**，都只发一条 review', async () => {
    for (const rating of ['again', 'hard', 'good', 'easy']) {
      __resetForTest();
      localStorage.clear();
      writeToken(TOKEN);
      installFetch();
      dueReply = () => jsonResponse(200, due());
      reviewReply = () => jsonResponse(200, receipt());
      const view = mount();
      await settle();
      await reveal();
      await click(screen.getByTestId(`rate-${rating}`));
      expect(calls('/vocab/review'), rating).toHaveLength(1);
      expect(bodies('/vocab/review')[0].rating).toBe(rating);
      view.unmount();
    }
  });

  it('**请求体恰好四个字段**：headword / rating / elapsedMs / requestId', async () => {
    mount();
    await settle();
    await reveal();
    await click(screen.getByTestId('rate-good'));
    const b = bodies('/vocab/review')[0];
    expect(Object.keys(b).sort()).toEqual(['elapsedMs', 'headword', 'rating', 'requestId']);
    expect(b.headword).toBe('ferry');
    expect(typeof b.elapsedMs).toBe('number');
    expect(typeof b.requestId).toBe('string');
    expect(b.requestId.length).toBeGreaterThan(0);
  });

  it('**失败时不翻页**，重试用**同一个 requestId**', async () => {
    dueReply = () => jsonResponse(200, due([card({ headword: 'zebra' }), card({ headword: 'apple' })]));
    reviewReply = () => jsonResponse(500, { code: 'boom' });
    mount();
    await settle();
    await reveal();
    await click(screen.getByTestId('rate-good'));

    // 还在原地
    expect(screen.getByTestId('card-headword').textContent).toContain('zebra');
    expect(screen.getByTestId('rating-error')).toBeTruthy();
    const first = bodies('/vocab/review')[0].requestId;

    reviewReply = () => jsonResponse(200, receipt({ headword: 'zebra' }));
    await click(screen.getByTestId('retry-rating'));
    const second = bodies('/vocab/review')[1].requestId;
    expect(second).toBe(first);
    expect(screen.getByTestId('card-headword').textContent).toContain('apple');
  });

  it('**连点两下只发一条**', async () => {
    mount();
    await settle();
    await reveal();
    const btn = screen.getByTestId('rate-good');
    await act(async () => {
      btn.click();
      btn.click();
    });
    await settle();
    expect(calls('/vocab/review')).toHaveLength(1);
  });

  it('**服务端说 tooFast 就照说**，不假装记上了', async () => {
    reviewReply = () => jsonResponse(200, receipt({ tooFast: true }));
    mount();
    await settle();
    await reveal();
    await click(screen.getByTestId('rate-good'));
    expect(screen.getByTestId('rating-receipt').textContent).toContain('太快');
  });

  it('**服务端说 duplicate 也照说**', async () => {
    reviewReply = () => jsonResponse(200, receipt({ duplicate: true }));
    mount();
    await settle();
    await reveal();
    await click(screen.getByTestId('rate-good'));
    expect(screen.getByTestId('rating-receipt').textContent).toContain('已经记过');
  });

  it('**回执里的状态与间隔照搬服务端**', async () => {
    reviewReply = () => jsonResponse(200, receipt({ intervalDays: 7, state: 'review' }));
    mount();
    await settle();
    await reveal();
    await click(screen.getByTestId('rate-good'));
    expect(screen.getByTestId('rating-receipt').textContent).toContain('7');
  });

  it('**撤销发一条 undo，成功之后才把卡放回来**', async () => {
    dueReply = () => jsonResponse(200, due([card({ headword: 'zebra' }), card({ headword: 'apple' })]));
    reviewReply = () => jsonResponse(200, receipt({ headword: 'zebra' }));
    mount();
    await settle();
    await reveal();
    await click(screen.getByTestId('rate-good'));
    expect(screen.getByTestId('card-headword').textContent).toContain('apple');

    await click(screen.getByTestId('undo'));
    const c = calls('/vocab/review/undo')[0];
    expect(c.method).toBe('POST');
    expect(Object.keys(JSON.parse(c.body ?? '{}'))).toEqual(['headword']);
    expect(JSON.parse(c.body ?? '{}').headword).toBe('zebra');
    expect(screen.getByTestId('card-headword').textContent).toContain('zebra');
  });

  it('**撤销失败时卡不回退**，还能再试', async () => {
    dueReply = () => jsonResponse(200, due([card({ headword: 'zebra' }), card({ headword: 'apple' })]));
    reviewReply = () => jsonResponse(200, receipt({ headword: 'zebra' }));
    undoReply = () => jsonResponse(500, { code: 'boom' });
    mount();
    await settle();
    await reveal();
    await click(screen.getByTestId('rate-good'));
    await click(screen.getByTestId('undo'));
    expect(screen.getByTestId('card-headword').textContent).toContain('apple');
    expect(screen.getByTestId('undo-error')).toBeTruthy();

    undoReply = () => jsonResponse(200, { headword: 'zebra', undone: true, reps: 2, state: 'learning' });
    await click(screen.getByTestId('undo'));
    expect(calls('/vocab/review/undo')).toHaveLength(2);
    expect(screen.getByTestId('card-headword').textContent).toContain('zebra');
  });
});

// ─────────────────────────────────────────────────────────────
// AC-08 —— 进度 / 完成 / 失败 / 刷新
// ─────────────────────────────────────────────────────────────

describe('AC-08 进度、完成与失败', () => {
  it('**进度照服务端的卡数**', async () => {
    dueReply = () => jsonResponse(200, due([card({ headword: 'a' }), card({ headword: 'b' })]));
    mount();
    await settle();
    expect(screen.getByTestId('practice-progress').textContent).toContain('1 / 2');
  });

  it('**评完最后一张进完成页**', async () => {
    mount();
    await settle();
    await reveal();
    await click(screen.getByTestId('rate-good'));
    expect(screen.getByTestId('practice-done')).toBeTruthy();
  });

  it('完成页能回生词本', async () => {
    mount();
    await settle();
    await reveal();
    await click(screen.getByTestId('rate-good'));
    await click(screen.getByTestId('back-to-vocab'));
    expect(at()).toBe(VOCAB);
  });

  it('先显示载入中', async () => {
    let release: (() => void) | null = null;
    dueReply = () =>
      new Promise<Response>((res) => {
        release = () => res({ ok: true, status: 200, text: () => Promise.resolve(JSON.stringify(due())) } as Response);
      });
    mount();
    await settle();
    expect(text()).toContain('载入中');
    await act(async () => {
      release?.();
    });
    await settle();
    expect(screen.getByTestId('card-headword')).toBeTruthy();
  });

  it('**载入失败 → 错误态 + 重试，票不丢**', async () => {
    dueReply = () => jsonResponse(500, { code: 'boom' });
    mount();
    await settle();
    expect(screen.getByTestId('retry')).toBeTruthy();
    expect(readToken()).toBe(TOKEN);
    dueReply = () => jsonResponse(200, due());
    await click(screen.getByTestId('retry'));
    expect(screen.getByTestId('card-headword')).toBeTruthy();
  });

  it('**401 清票回登录页**', async () => {
    dueReply = () => jsonResponse(401, { code: 'token_revoked' });
    mount();
    await settle();
    expect(readToken()).toBeNull();
    expect(at()).toBe(ROUTES.login);
  });

  it('**评分时掉票 → 清票回登录页**', async () => {
    reviewReply = () => jsonResponse(401, { code: 'token_revoked' });
    mount();
    await settle();
    await reveal();
    await click(screen.getByTestId('rate-good'));
    expect(readToken()).toBeNull();
    expect(at()).toBe(ROUTES.login);
  });

  it('**卸载之后回来的响应画不上去**', async () => {
    let release: ((v: Response) => void) | null = null;
    dueReply = () => new Promise<Response>((res) => { release = res; });
    const view = mount();
    await settle();
    view.unmount();
    await act(async () => {
      release?.({ ok: true, status: 200, text: () => Promise.resolve(JSON.stringify(due())) } as Response);
    });
    await settle();
    expect(document.body.textContent).not.toContain('渡船');
  });

  it('**刷新（重新挂载）只重新拉一次 due，不补写**', async () => {
    const first = mount();
    await settle();
    first.unmount();
    reqs = [];
    mount();
    await settle();
    expect(calls('/vocab/due')).toHaveLength(1);
    expect(reqs.filter((r) => r.method !== 'GET')).toEqual([]);
  });
});
