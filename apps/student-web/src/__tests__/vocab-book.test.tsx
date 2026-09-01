/**
 * 阶段 12A —— 生词本（`/vocab`）的**行为测试**。
 *
 * 挂真 `App`，只在 `fetch` 打桩，**不 import 页面组件** —— 判据全是「挂到
 * 那条路由上之后发了什么请求、显示了什么」，所以路由不存在时也跑得起来，
 * 只会**红在行为上**。
 *
 * 这一屏的规矩：
 *
 *   · **只读两个 GET**（`/vocab/words` + `/vocab/stats`），零查询串、零请求体；
 *   · **统计挂了不许连累词表** —— 词表已经拿到了就照常显示，
 *     统计那一块单独说「暂时取不到」，绝不把缺失当成 0；
 *   · **移出要有一次明确确认**，而且**服务端成功之后才**把那一行拿掉。
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { act, render, screen } from '@testing-library/react';
import { MemoryRouter, useLocation } from 'react-router-dom';
import App from '../App';
import { writeToken, readToken } from '../lib/identity';
import { __resetForTest } from '../lib/auth-store';
import { ROUTES } from '../routes.contract';

/** 路径写字面量，红在行为上而不是 `ROUTES.vocab === undefined` 上。 */
const VOCAB = '/vocab';
const PRACTICE = '/vocab/practice';
const SELFTEST = '/vocab/selftest';

const PROFILE = { id: 't6_done', name: '测试六号', nickname: '六号', avatar: null };
const TOKEN = 'vocab-token';

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
// 夹具 —— 字段照 `student-word.service.ts` 的 listWords()
// 与 `vocab-review.service.ts` 的 stats()
// ─────────────────────────────────────────────────────────────

const word = (over: Record<string, unknown> = {}) => ({
  headword: 'ferry',
  surfaceForm: 'ferries',
  sourceType: 'auto_wrong_answer',
  sourcePassageTitle: 'The River Ferry',
  contextSentence: 'The ferries stopped running after dark.',
  contextTranslation: '天黑以后，渡船就停运了。',
  state: 'learning',
  reps: 2,
  lapses: 0,
  due: '2026-08-30T00:00:00.000Z',
  createdAt: '2026-08-28T02:10:00.000Z',
  phonetic: '/ˈferi/',
  translation: '渡船',
  tag: ['O-Level'],
  ...over,
});

const words = (rows: Record<string, unknown>[] = [word()], over: Record<string, unknown> = {}) => ({
  student: { id: PROFILE.id, name: PROFILE.name },
  total: rows.length,
  dueCount: rows.length,
  words: rows,
  ...over,
});

const stats = (over: Record<string, unknown> = {}) => ({
  student: { id: PROFILE.id, name: PROFILE.name },
  total: 12,
  byState: { learning: 8, known: 4 },
  bySource: { auto_wrong_answer: 12 },
  totalReviews: 40,
  totalDue: 3,
  reviewedToday: 5,
  knownCount: 4,
  streakDays: 6,
  progress: { mastered: 4, learning: 5, untouched: 3 },
  ...over,
});

const lessonToday = {
  student: { id: PROFILE.id, name: PROFILE.name },
  date: '2026-08-30',
  nextAction: { kind: 'summary', label: '看今天的总结', href: '/my-lesson/summary' },
  rulesVersion: 3,
  completed: 3,
  total: 3,
  allDone: true,
  streakDays: 5,
  targetsFrozenAt: null,
  stage: 'done',
  stageAt: null,
  vocabCursor: 4,
  segments: [
    {
      key: 'read', status: 'done', label: 'The River Ferry', questionCount: 4,
      typicalMinutes: 15, score: 3, maxScore: 4, scoresPending: false,
      submissionId: 'sub-a', sessionId: 'sess-a', autoClosed: false,
    },
    {
      key: 'vocab', status: 'done', progress: 4, target: 4, typicalMinutes: 2,
      quizScore: { status: 'submitted', correct: 4, total: 4, percentage: 100, submittedAt: '2026-08-30T05:55:27.181Z' },
    },
    { key: 'drill', status: 'none', progress: 0, target: 0, typicalMinutes: 2 },
  ],
};

// ─────────────────────────────────────────────────────────────
// 网络边界
// ─────────────────────────────────────────────────────────────

let wordsReply: () => Promise<Response>;
let statsReply: () => Promise<Response>;
let removeReply: () => Promise<Response>;
let stateReply: () => Promise<Response>;

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
    if (path === '/lesson/today') return jsonResponse(200, lessonToday);
    if (path === '/vocab/words') return wordsReply();
    if (path === '/vocab/stats') return statsReply();
    if (path === '/vocab/words/remove') return removeReply();
    if (path === '/vocab/words/state') return stateReply();
    return jsonResponse(404, { code: 'not_stubbed', path: full });
  });
  vi.stubGlobal('fetch', fetchMock);
}

function LocationProbe() {
  const loc = useLocation();
  return <span data-testid="loc">{loc.pathname}</span>;
}

function mount(at: string = VOCAB) {
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
const writes = () => reqs.filter((r) => r.method !== 'GET');

async function click(el: HTMLElement) {
  await act(async () => {
    el.click();
  });
  await settle();
}

beforeEach(() => {
  __resetForTest();
  localStorage.clear();
  writeToken(TOKEN);
  wordsReply = () => jsonResponse(200, words());
  statsReply = () => jsonResponse(200, stats());
  removeReply = () => jsonResponse(200, { deleted: 1 });
  stateReply = () => jsonResponse(200, { updated: true, headword: 'ferry', state: 'known', due: '2100-01-01T00:00:00.000Z' });
  installFetch();
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

// ─────────────────────────────────────────────────────────────
// AC-03 —— 路由契约与入口
// ─────────────────────────────────────────────────────────────

describe('AC-03 路由与入口', () => {
  it('**契约里有三条生词本路由**，且没有 `/app` 前缀', () => {
    const R = ROUTES as Record<string, string>;
    expect(R.vocab).toBe('/vocab');
    expect(R.vocabPractice).toBe('/vocab/practice');
    expect(R.vocabSelfTest).toBe('/vocab/selftest');
    for (const p of [R.vocab, R.vocabPractice, R.vocabSelfTest]) {
      expect(String(p).startsWith('/app/')).toBe(false);
    }
  });

  it('**`/today` 上有生词本入口**', async () => {
    mount(ROUTES.today);
    await settle();
    await click(screen.getByTestId('go-vocab'));
    expect(at()).toBe(VOCAB);
  });

  it('**今日总结上也有生词本入口**', async () => {
    mount(ROUTES.summary);
    await settle();
    await click(screen.getByTestId('go-vocab'));
    expect(at()).toBe(VOCAB);
  });

  it('**没票时进 `/vocab` 去登录页，而且一个词汇请求都不发**', async () => {
    localStorage.clear();
    __resetForTest();
    mount();
    await settle();
    expect(at()).toBe(ROUTES.login);
    expect(calls('/vocab/words')).toHaveLength(0);
    expect(calls('/vocab/stats')).toHaveLength(0);
  });

  it('两条自由练习的入口**各自独立**', async () => {
    mount();
    await settle();
    expect((screen.getByTestId('go-practice') as HTMLAnchorElement).getAttribute('href')).toBe(PRACTICE);
    expect((screen.getByTestId('go-selftest') as HTMLAnchorElement).getAttribute('href')).toBe(SELFTEST);
  });

  it('**页面上没有任何旧端路由**', async () => {
    mount();
    await settle();
    for (const a of document.querySelectorAll('a')) {
      expect(a.getAttribute('href') ?? '').not.toMatch(/my-vocab|my-history|my-mistakes|my-lesson|scan/);
    }
  });
});

// ─────────────────────────────────────────────────────────────
// AC-04 —— 请求边界
// ─────────────────────────────────────────────────────────────

describe('AC-04 请求边界', () => {
  it('**恰好两个 GET**，带 Bearer、零查询串、零请求体', async () => {
    mount();
    await settle();
    expect(calls('/vocab/words')).toHaveLength(1);
    expect(calls('/vocab/stats')).toHaveLength(1);
    for (const p of ['/vocab/words', '/vocab/stats']) {
      const c = calls(p)[0];
      expect(c.method).toBe('GET');
      expect(c.headers.Authorization).toBe(`Bearer ${TOKEN}`);
      expect(c.path).toBe(p);
      expect(c.body).toBeNull();
    }
    expect(writes()).toEqual([]);
  });

  it('**零身份参数**', async () => {
    mount();
    await settle();
    for (const r of reqs) {
      expect(r.path).not.toMatch(/name=|studentName=|studentId=/);
      if (r.body) expect(r.body).not.toMatch(/"name"|"studentName"|"studentId"/);
    }
  });

  it('**不碰课程线、正式测试、错题本、埋点**', async () => {
    mount();
    await settle();
    for (const r of reqs) {
      expect(r.path).not.toMatch(/lesson-cards|vocab-taught|vocab-cursor|lesson\/(today|start)/);
      expect(r.path).not.toMatch(/quiz\/attempt|mistakes|page-view|history-by-name/);
    }
  });

  it('**不碰 `mq:` 存储键**', async () => {
    mount();
    await settle();
    for (const k of Object.keys(localStorage)) expect(k.startsWith('mq:')).toBe(false);
  });
});

// ─────────────────────────────────────────────────────────────
// AC-04 —— 列表与统计
// ─────────────────────────────────────────────────────────────

describe('AC-04 列表与统计', () => {
  it('**服务端顺序原样保留**', async () => {
    wordsReply = () =>
      jsonResponse(200, words([
        word({ headword: 'zebra' }),
        word({ headword: 'apple' }),
        word({ headword: 'ferry' }),
      ]));
    mount();
    await settle();
    const rows = [...document.querySelectorAll('[data-word-id]')].map((e) => e.getAttribute('data-word-id'));
    expect(rows).toEqual(['zebra', 'apple', 'ferry']);
  });

  it('一行里**词形 / 音标 / 释义 / 状态 / 来源 / 例句 / 到期**都来自服务端', async () => {
    mount();
    await settle();
    const row = screen.getByTestId('word-row-ferry');
    expect(row.textContent).toContain('ferry');
    expect(row.textContent).toContain('/ˈferi/');
    expect(row.textContent).toContain('渡船');
    expect(screen.getByTestId('word-context-ferry').textContent).toContain('The ferries stopped running after dark.');
    expect(screen.getByTestId('word-context-translation-ferry').textContent).toContain('天黑以后，渡船就停运了。');
    expect(screen.getByTestId('word-state-ferry').textContent).toBeTruthy();
    expect(screen.getByTestId('word-due-ferry').textContent).toContain('2026-08-30');
  });

  it('**总数与待复习数照搬服务端**', async () => {
    wordsReply = () => jsonResponse(200, words([word()], { total: 137, dueCount: 9 }));
    mount();
    await settle();
    expect(screen.getByTestId('vocab-total').textContent).toContain('137');
    expect(screen.getByTestId('vocab-due-count').textContent).toContain('9');
  });

  it('**统计缺字段就不显示那一项**，不补 0', async () => {
    statsReply = () => jsonResponse(200, { total: 12, progress: { mastered: 4, learning: 5, untouched: 3 } });
    mount();
    await settle();
    expect(screen.queryByTestId('vocab-streak')).toBeNull();
    expect(screen.queryByTestId('vocab-reviewed-today')).toBeNull();
    expect(text()).not.toMatch(/连续学习\s*0\s*天/);
  });

  it('**统计挂了不连累词表**', async () => {
    statsReply = () => jsonResponse(500, { code: 'boom' });
    mount();
    await settle();
    expect(screen.getByTestId('word-row-ferry')).toBeTruthy();
    expect(screen.getByTestId('stats-error')).toBeTruthy();
    expect(at()).toBe(VOCAB);
    expect(readToken()).toBe(TOKEN);
  });

  it('**空生词本有明确的空态**', async () => {
    wordsReply = () => jsonResponse(200, words([], { total: 0, dueCount: 0 }));
    mount();
    await settle();
    expect(screen.getByTestId('vocab-empty')).toBeTruthy();
    expect(screen.queryByTestId('word-row-ferry')).toBeNull();
  });

  it('先显示载入中', async () => {
    let release: (() => void) | null = null;
    wordsReply = () =>
      new Promise<Response>((res) => {
        release = () =>
          res({ ok: true, status: 200, text: () => Promise.resolve(JSON.stringify(words())) } as Response);
      });
    mount();
    await settle();
    expect(text()).toContain('载入中');
    await act(async () => {
      release?.();
    });
    await settle();
    expect(screen.getByTestId('word-row-ferry')).toBeTruthy();
  });

  it('**词表失败 → 错误态 + 重试，票不丢**', async () => {
    wordsReply = () => jsonResponse(500, { code: 'boom' });
    mount();
    await settle();
    expect(screen.getByTestId('retry')).toBeTruthy();
    expect(readToken()).toBe(TOKEN);
    wordsReply = () => jsonResponse(200, words());
    await click(screen.getByTestId('retry'));
    expect(screen.getByTestId('word-row-ferry')).toBeTruthy();
  });

  it('**401 清票回登录页**', async () => {
    wordsReply = () => jsonResponse(401, { code: 'token_revoked' });
    mount();
    await settle();
    expect(readToken()).toBeNull();
    expect(at()).toBe(ROUTES.login);
  });

  it('**卸载之后回来的响应画不上去**', async () => {
    let release: ((v: Response) => void) | null = null;
    wordsReply = () => new Promise<Response>((res) => { release = res; });
    const view = mount();
    await settle();
    view.unmount();
    await act(async () => {
      release?.({ ok: true, status: 200, text: () => Promise.resolve(JSON.stringify(words())) } as Response);
    });
    await settle();
    expect(document.body.textContent).not.toContain('渡船');
  });

  it('**重进这一屏仍然只有那两个 GET**', async () => {
    const first = mount();
    await settle();
    first.unmount();
    reqs = [];
    mount();
    await settle();
    expect(calls('/vocab/words')).toHaveLength(1);
    expect(calls('/vocab/stats')).toHaveLength(1);
    expect(writes()).toEqual([]);
  });
});

// ─────────────────────────────────────────────────────────────
// AC-04 —— 移出
// ─────────────────────────────────────────────────────────────

describe('AC-04 移出生词本', () => {
  it('**要先确认才会发请求**', async () => {
    mount();
    await settle();
    await click(screen.getByTestId('remove-ferry'));
    expect(calls('/vocab/words/remove')).toHaveLength(0);
    expect(screen.getByTestId('confirm-remove-ferry')).toBeTruthy();

    await click(screen.getByTestId('confirm-remove-ferry'));
    expect(calls('/vocab/words/remove')).toHaveLength(1);
  });

  it('**取消就什么都不发，行还在**', async () => {
    mount();
    await settle();
    await click(screen.getByTestId('remove-ferry'));
    await click(screen.getByTestId('cancel-remove-ferry'));
    expect(calls('/vocab/words/remove')).toHaveLength(0);
    expect(screen.getByTestId('word-row-ferry')).toBeTruthy();
  });

  it('**请求体恰好只有 headword**', async () => {
    mount();
    await settle();
    await click(screen.getByTestId('remove-ferry'));
    await click(screen.getByTestId('confirm-remove-ferry'));
    const c = calls('/vocab/words/remove')[0];
    expect(c.method).toBe('POST');
    expect(c.path).toBe('/vocab/words/remove');
    expect(c.headers.Authorization).toBe(`Bearer ${TOKEN}`);
    expect(Object.keys(JSON.parse(c.body ?? '{}'))).toEqual(['headword']);
    expect(JSON.parse(c.body ?? '{}').headword).toBe('ferry');
  });

  it('**服务端成功之后才把行拿掉**，并且重新取一次权威数字', async () => {
    mount();
    await settle();
    reqs = [];
    wordsReply = () => jsonResponse(200, words([], { total: 0, dueCount: 0 }));
    statsReply = () => jsonResponse(200, stats({ total: 11, totalDue: 2 }));
    await click(screen.getByTestId('remove-ferry'));
    await click(screen.getByTestId('confirm-remove-ferry'));
    expect(screen.queryByTestId('word-row-ferry')).toBeNull();
    // 删完**重新对一次账**：总数 / 待复习数 / 统计都不许停在删之前那一份
    expect(calls('/vocab/words')).toHaveLength(1);
    expect(calls('/vocab/stats')).toHaveLength(1);
  });

  it('**失败时行原样留着，还能再试**', async () => {
    removeReply = () => jsonResponse(500, { code: 'boom' });
    mount();
    await settle();
    await click(screen.getByTestId('remove-ferry'));
    await click(screen.getByTestId('confirm-remove-ferry'));
    expect(screen.getByTestId('word-row-ferry')).toBeTruthy();
    expect(screen.getByTestId('remove-error-ferry')).toBeTruthy();

    removeReply = () => jsonResponse(200, { deleted: 1 });
    // 删成功之后页面会重新对账 —— 权威快照里那个词已经没了
    wordsReply = () => jsonResponse(200, words([], { total: 0, dueCount: 0 }));
    await click(screen.getByTestId('confirm-remove-ferry'));
    expect(calls('/vocab/words/remove')).toHaveLength(2);
    expect(screen.queryByTestId('word-row-ferry')).toBeNull();
  });

  it('**连点两下只发一条**', async () => {
    mount();
    await settle();
    await click(screen.getByTestId('remove-ferry'));
    const btn = screen.getByTestId('confirm-remove-ferry');
    await act(async () => {
      btn.click();
      btn.click();
    });
    await settle();
    expect(calls('/vocab/words/remove')).toHaveLength(1);
  });

  it('**移出时掉票 → 清票回登录页**', async () => {
    removeReply = () => jsonResponse(401, { code: 'token_revoked' });
    mount();
    await settle();
    await click(screen.getByTestId('remove-ferry'));
    await click(screen.getByTestId('confirm-remove-ferry'));
    expect(readToken()).toBeNull();
    expect(at()).toBe(ROUTES.login);
  });
});

describe('成熟生词本：掌握状态与长列表', () => {
  it('“我已经会了”只发送 headword + state，成功后重新取权威词表', async () => {
    mount();
    await settle();
    reqs = [];
    wordsReply = () => jsonResponse(200, words([word({ state: 'known', due: '2100-01-01T00:00:00.000Z' })]));
    await click(screen.getByTestId('state-ferry'));

    expect(calls('/vocab/words/state')).toHaveLength(1);
    expect(JSON.parse(calls('/vocab/words/state')[0].body!)).toEqual({ headword: 'ferry', state: 'known' });
    expect(calls('/vocab/words')).toHaveLength(1);
    expect(screen.getByTestId('word-state-ferry').textContent).toContain('已掌握');
    expect(screen.getByTestId('state-ferry').textContent).toContain('重新学习');
  });

  it('长列表先显示 20 个，学生需要时再展开下一批', async () => {
    const rows = Array.from({ length: 21 }, (_, i) => word({
      headword: `word${String(i).padStart(2, '0')}`,
      createdAt: new Date(Date.UTC(2026, 7, 1, 0, i)).toISOString(),
    }));
    wordsReply = () => jsonResponse(200, words(rows));
    mount();
    await settle();
    expect(screen.getAllByTestId(/^word-row-/)).toHaveLength(20);
    await click(screen.getByTestId('vocab-show-more'));
    expect(screen.getAllByTestId(/^word-row-/)).toHaveLength(21);
  });
});

// ─────────────────────────────────────────────────────────────
// 返工 1/2 B-3 —— 统计那一次单独掉票
//
// 词表成功、统计 401，说明令牌**在这两次请求之间失效了**（老师重置了 PIN、
// 学生在另一台设备登出）。把它和「统计服务抖了一下」当成同一件事吞掉，
// 学生就会停在一个**看着正常、其实已经登出**的页面上，直到下一次交互
// 才莫名其妙被踢走。掉票必须立刻走统一登出。
// ─────────────────────────────────────────────────────────────

describe('B-3 统计单独失败的两种含义', () => {
  it('**统计 401 → 清票回登录页**（不许当成「统计抖了一下」）', async () => {
    statsReply = () => jsonResponse(401, { code: 'token_revoked' });
    mount();
    await settle();
    expect(readToken()).toBeNull();
    expect(at()).toBe(ROUTES.login);
  });

  it('**统计 401（student_token_required）同样清票**', async () => {
    statsReply = () => jsonResponse(401, { code: 'student_token_required' });
    mount();
    await settle();
    expect(readToken()).toBeNull();
    expect(at()).toBe(ROUTES.login);
  });

  it('**统计 500 → 词表照常显示，票不丢**', async () => {
    statsReply = () => jsonResponse(500, { code: 'boom' });
    mount();
    await settle();
    expect(screen.getByTestId('word-row-ferry')).toBeTruthy();
    expect(screen.getByTestId('stats-error')).toBeTruthy();
    expect(readToken()).toBe(TOKEN);
    expect(at()).toBe(VOCAB);
  });

  it('**统计网络故障 → 同样只是少几个数字**', async () => {
    statsReply = () => Promise.reject(new TypeError('network down'));
    mount();
    await settle();
    expect(screen.getByTestId('word-row-ferry')).toBeTruthy();
    expect(screen.getByTestId('stats-error')).toBeTruthy();
    expect(readToken()).toBe(TOKEN);
  });
});

// ─────────────────────────────────────────────────────────────
// 返工 1/2 B-4 —— 删完之后屏幕上的数字必须还是真的
//
// 删掉一个词，`total` 变了，`dueCount` 和统计却停在删之前那一份。
// 「还有 9 个待复习」而实际只剩 8 个，是学生**没法察觉**的错 ——
// 他不会去数，只会照着那个数字安排自己。
// ─────────────────────────────────────────────────────────────

describe('B-4 删除之后的聚合数字', () => {
  const twoWords = () =>
    words(
      [
        word({ headword: 'ferry', due: '2026-08-01T00:00:00.000Z' }),   // 早就到期
        word({ headword: 'lighthouse', due: '2099-01-01T00:00:00.000Z' }), // 还没到期
      ],
      { total: 2, dueCount: 1 },
    );

  it('**删掉一个到期词 → 待复习数跟着降**', async () => {
    wordsReply = () => jsonResponse(200, twoWords());
    mount();
    await settle();
    expect(screen.getByTestId('vocab-due-count').textContent).toContain('1');

    // 服务端删掉之后的权威快照
    wordsReply = () =>
      jsonResponse(200, words([word({ headword: 'lighthouse', due: '2099-01-01T00:00:00.000Z' })], { total: 1, dueCount: 0 }));
    await click(screen.getByTestId('remove-ferry'));
    await click(screen.getByTestId('confirm-remove-ferry'));

    expect(screen.getByTestId('vocab-total').textContent).toContain('1');
    expect(screen.getByTestId('vocab-due-count').textContent).toContain('0');
  });

  it('**删掉一个没到期的词 → 待复习数不许乱降**', async () => {
    wordsReply = () => jsonResponse(200, twoWords());
    mount();
    await settle();

    wordsReply = () =>
      jsonResponse(200, words([word({ headword: 'ferry', due: '2026-08-01T00:00:00.000Z' })], { total: 1, dueCount: 1 }));
    await click(screen.getByTestId('remove-lighthouse'));
    await click(screen.getByTestId('confirm-remove-lighthouse'));

    expect(screen.getByTestId('vocab-total').textContent).toContain('1');
    expect(screen.getByTestId('vocab-due-count').textContent).toContain('1');
  });

  it('**统计也跟着刷新**，不停在删之前那一份', async () => {
    mount();
    await settle();
    expect(screen.getByTestId('vocab-progress').textContent).toContain('已掌握 4');

    wordsReply = () => jsonResponse(200, words([], { total: 0, dueCount: 0 }));
    statsReply = () => jsonResponse(200, stats({ progress: { mastered: 3, learning: 5, untouched: 3 }, streakDays: 6 }));
    await click(screen.getByTestId('remove-ferry'));
    await click(screen.getByTestId('confirm-remove-ferry'));
    expect(screen.getByTestId('vocab-progress').textContent).toContain('已掌握 3');
  });

  it('**对不上账时宁可不显示**：删成功了但重新取数失败 → 数字藏起来', async () => {
    mount();
    await settle();
    wordsReply = () => jsonResponse(500, { code: 'boom' });
    await click(screen.getByTestId('remove-ferry'));
    await click(screen.getByTestId('confirm-remove-ferry'));

    // 那一行确实没了（服务端已经删了），但旧数字**不许**继续挂着
    expect(screen.queryByTestId('word-row-ferry')).toBeNull();
    expect(screen.getByTestId('aggregates-stale')).toBeTruthy();
    expect(screen.queryByTestId('vocab-due-count')).toBeNull();
    expect(screen.queryByTestId('vocab-stats')).toBeNull();
    expect(readToken()).toBe(TOKEN);
  });

  it('**删除失败时行与数字都不动**', async () => {
    wordsReply = () => jsonResponse(200, twoWords());
    removeReply = () => jsonResponse(500, { code: 'boom' });
    mount();
    await settle();
    reqs = [];
    await click(screen.getByTestId('remove-ferry'));
    await click(screen.getByTestId('confirm-remove-ferry'));

    expect(screen.getByTestId('word-row-ferry')).toBeTruthy();
    expect(screen.getByTestId('vocab-total').textContent).toContain('2');
    expect(screen.getByTestId('vocab-due-count').textContent).toContain('1');
    expect(screen.getByTestId('remove-error-ferry')).toBeTruthy();
    // 失败不该触发对账
    expect(calls('/vocab/words')).toHaveLength(0);
    expect(calls('/vocab/stats')).toHaveLength(0);
  });
});
