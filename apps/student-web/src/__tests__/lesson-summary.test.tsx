/**
 * 今日总结（`/lesson/summary`）的**行为测试**（审计 UI10）。
 *
 * 挂的是**真的 `App`**：真路由、真 auth-store、真 api 客户端，只在 `fetch`
 * 这一层打桩。判据全都是「挂到那条路由上之后，页面做了什么、显示了什么」。
 *
 * 这一屏的硬规矩：
 *
 *   · **与首页读同一份事实**：`/lesson/today` + `/vocab-v2/overview` + `/vocab-v2/tests`；
 *     不再按旧 `nextAction` / `allDone` 把人弹回首页（UI10：首页 → 总结 → 首页循环）。
 *   · **只读**。只有这三个 GET；刷新、重试、重进都不许变成写。
 *   · **不误报**。没做完就说还有几项没做完；还在判分不补 0；词测不重算百分比。
 *   · **只认 kind 与状态，不看 href**。
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { act, render, screen, within } from '@testing-library/react';
import { MemoryRouter, useLocation } from 'react-router-dom';
import App from '../App';
import { writeToken, readToken } from '../lib/identity';
import { __resetForTest } from '../lib/auth-store';
import { NEXT_ACTION_KINDS, ROUTES } from '../routes.contract';
import type { HomeTasks, V2Overview } from '../lib/api';

const PROFILE = { id: 't6_done', name: '测试六号', nickname: '六号', avatar: null };
const TOKEN = 'summary-token';

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
// 夹具
// ─────────────────────────────────────────────────────────────

const readSeg = (over: Record<string, unknown> = {}) => ({
  key: 'read', status: 'done', label: 'The River Ferry', questionCount: 4, typicalMinutes: 15,
  score: 3, maxScore: 4, scoresPending: false, submissionId: 'sub-1', sessionId: 'sess-1', autoClosed: false,
  ...over,
});
const vocabSeg = () => ({ key: 'vocab', status: 'done', progress: 4, target: 4, typicalMinutes: 2, quizScore: { status: 'not_started' } });

function lesson(over: Record<string, unknown> = {}, segs: Record<string, unknown>[] | null = null) {
  return {
    student: { id: PROFILE.id, name: PROFILE.name },
    date: '2026-08-31',
    // 后端一直下发指向旧端的 href —— 这一屏一次都不许读它
    nextAction: { kind: 'summary', label: '看今天的总结', href: '/my-lesson/summary?name=测试六号' },
    rulesVersion: 3, completed: 2, total: 2, allDone: true, streakDays: 5,
    targetsFrozenAt: null, stage: 'done', stageAt: null, vocabCursor: 4,
    segments: segs ?? [readSeg(), vocabSeg()],
    ...over,
  };
}

function home(over: Partial<HomeTasks> = {}): HomeTasks {
  return {
    date: '2026-08-31',
    teachingDay: true,
    reading: { state: 'completed', sessionId: 'sess-1', submissionId: 'sub-1', title: 'The River Ferry', level: 'olevel' },
    words: { state: 'completed', sessionId: 'd1', target: 10, learned: 9, deferred: 1, pending: 0 },
    test: { state: 'completed', dailySessionId: 'd1', testSessionId: 'ts1', total: 12, newWords: 9, reviewWords: 3, answered: 12 },
    allDone: true,
    ...over,
  };
}
function overview(over: Partial<V2Overview> = {}): V2Overview {
  return { dailyTarget: 10, today: null, readingBacklog: [], learningBacklog: [], pendingTests: [], home: home(), ...over };
}
const TESTS = { tests: [{ sessionId: 'ts1', date: '2026-08-31', total: 12, correct: 10, completedAt: '2026-08-31T08:00:00.000Z' }] };

// ─────────────────────────────────────────────────────────────
// 网络边界
// ─────────────────────────────────────────────────────────────

let todayReply: () => Promise<Response>;
let overviewReply: () => Promise<Response>;
let testsReply: () => Promise<Response>;

function installFetch() {
  reqs = [];
  vi.stubGlobal('fetch', vi.fn((url: string, init: RequestInit = {}) => {
    const path = String(url).replace(/^.*\/api/, '');
    reqs.push({ path, method: (init.method as string) ?? 'GET', headers: (init.headers as Record<string, string>) ?? {}, body: init.body ? String(init.body) : null });
    if (path === '/student-auth/me') return jsonResponse(200, { ...PROFILE, appVersion: 'v2' });
    if (path === '/lesson/today') return todayReply();
    if (path === '/vocab-v2/overview') return overviewReply();
    if (path === '/vocab-v2/tests') return testsReply();
    return jsonResponse(404, { code: 'not_stubbed', path });
  }));
}

function LocationProbe() {
  const loc = useLocation();
  return <span data-testid="loc">{loc.pathname}</span>;
}
function mount(at: string = ROUTES.summary) {
  return render(
    <MemoryRouter initialEntries={[at]}>
      <App />
      <LocationProbe />
    </MemoryRouter>,
  );
}
async function settle(rounds = 16) {
  await act(async () => {
    for (let i = 0; i < rounds; i++) await Promise.resolve();
  });
}
const at = () => screen.getByTestId('loc').textContent;
const writes = () => reqs.filter((r) => r.method !== 'GET');
const text = () => document.body.textContent ?? '';
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
  todayReply = () => jsonResponse(200, lesson());
  overviewReply = () => jsonResponse(200, overview());
  testsReply = () => jsonResponse(200, TESTS);
  installFetch();
});
afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

// ─────────────────────────────────────────────────────────────

describe('只读边界', () => {
  it('**挂载只打三个 GET**（阅读 / 单词 / 词测成绩），都带 Bearer，零身份，零写', async () => {
    mount();
    await settle();
    const data = reqs.filter((r) => r.path !== '/student-auth/me');
    expect(data.map((r) => `${r.method} ${r.path}`).sort()).toEqual(['GET /lesson/today', 'GET /vocab-v2/overview', 'GET /vocab-v2/tests']);
    for (const r of data) {
      expect(r.headers.Authorization).toBe(`Bearer ${TOKEN}`);
      expect(r.path).not.toMatch(/[?&](name|studentId)=/);
      expect(r.body).toBeNull();
    }
    expect(writes()).toHaveLength(0);
  });

  it('**永远不碰 `/lesson/start`**，重进这一屏仍然只读', async () => {
    const first = mount();
    await settle();
    first.unmount();
    mount();
    await settle();
    expect(reqs.some((r) => r.path === '/lesson/start')).toBe(false);
    expect(writes()).toHaveLength(0);
  });

  it('**后端 href 被投毒也不影响这一屏**', async () => {
    todayReply = () => jsonResponse(200, lesson({ nextAction: { kind: 'summary', label: 'x', href: 'https://evil.example/steal?name=测试六号' } }));
    mount();
    await settle();
    expect(at()).toBe(ROUTES.summary);
    for (const a of document.querySelectorAll('a')) expect(a.getAttribute('href') ?? '').not.toMatch(/evil|my-lesson|name=/);
  });
});

describe('UI10 · 与首页读同一份事实，不回跳、不误报', () => {
  it('**三项都做完**：写「今天的三项都做完了」、3 / 3、连续天数、阅读分、词测答对几题', async () => {
    mount();
    await settle();
    expect(screen.getByTestId('summary-completion').textContent).toBe('今天的三项都做完了');
    expect(screen.getByLabelText('今天完成 3 / 3')).toBeTruthy();
    expect(screen.getByTestId('summary-date').textContent).toBe('8月31日 周一');
    expect(screen.getByTestId('summary-streak').textContent).toMatch(/已连续学习 5 天/);
    expect(screen.getByTestId('read-state').textContent).toBe('The River Ferry · 3 / 4 分');
    expect(screen.getByTestId('words-state').textContent).toBe('学完 9 个 · 延后 1 个');
    expect(screen.getByTestId('quiz-state').textContent).toBe('答对 10 / 12');
    expect(text()).not.toMatch(/🎉|→/);
  });

  it('**旧字段说「还没到总结」但三项其实都做完了 → 照样渲染，不弹回首页**（循环的根源）', async () => {
    todayReply = () => jsonResponse(200, lesson({ nextAction: { kind: 'learn_vocab', label: '学习本次单词', href: null }, allDone: false, completed: 1, total: 2 }));
    mount();
    await settle();
    expect(at()).toBe(ROUTES.summary);
    expect(screen.getByTestId('summary-completion').textContent).toBe('今天的三项都做完了');
  });

  it('**没做完也能看已做的部分**：留在总结页，写「还有 1 项没做完」，不说做完', async () => {
    overviewReply = () => jsonResponse(200, overview({ home: home({ test: { state: 'pending', dailySessionId: 'd1', testSessionId: 'ts1', total: 12, newWords: 9, reviewWords: 3, answered: 0 }, allDone: false }) }));
    testsReply = () => jsonResponse(200, { tests: [] });
    mount();
    await settle();
    expect(at()).toBe(ROUTES.summary);
    expect(screen.getByTestId('summary-completion').textContent).toBe('还有 1 项没做完');
    expect(screen.getByLabelText('今天完成 2 / 3')).toBeTruthy();
    expect(screen.getByTestId('quiz-state').textContent).toBe('12 题（新词 9 + 旧词抽查 3）');
    expect(text()).not.toMatch(/三项都做完/);
    // 没做完时「回到今日」是主按钮
    expect(screen.getByTestId('back-to-today').className).toMatch(/bg-accent-fill/);
  });

  it('**全部延后**：新词写延后几个，测试「不需要」，不进分母', async () => {
    overviewReply = () => jsonResponse(200, overview({ home: home({ words: { state: 'completed', sessionId: 'd1', target: 10, learned: 0, deferred: 10, pending: 0 }, test: { state: 'not_applicable', reason: 'nothing_learned' } }) }));
    mount();
    await settle();
    expect(screen.getByTestId('words-state').textContent).toBe('学完 0 个 · 延后 10 个');
    expect(screen.getByTestId('quiz-state').textContent).toBe('今天没有学完的新词，不需要测试');
    expect(screen.getByLabelText('今天完成 2 / 2')).toBeTruthy();
  });

  it('**阅读还在判分 → 说「还在判分」，绝不显示 0 分**', async () => {
    todayReply = () => jsonResponse(200, lesson({}, [readSeg({ scoresPending: true, score: null }), vocabSeg()]));
    overviewReply = () => jsonResponse(200, overview({ home: home({ reading: { state: 'awaiting_marking', sessionId: 'sess-1', submissionId: 'sub-1' } }) }));
    mount();
    await settle();
    expect(screen.getByTestId('read-state').textContent).toContain('已交卷 · 还在判分');
    expect(screen.getByTestId('read-state').textContent).not.toMatch(/\b0\s*\/\s*4/);
  });

  it('**交了卷但没有分数 → 说「还没有分数」，绝不显示 0 分**', async () => {
    todayReply = () => jsonResponse(200, lesson({}, [readSeg({ score: null }), vocabSeg()]));
    mount();
    await settle();
    expect(screen.getByTestId('read-state').textContent).toContain('已交卷 · 还没有分数');
  });

  it('**交了卷 0 分照实显示 0**（这不是编造，是服务端说的）', async () => {
    todayReply = () => jsonResponse(200, lesson({}, [readSeg({ score: 0 }), vocabSeg()]));
    mount();
    await settle();
    expect(screen.getByTestId('read-state').textContent).toContain('0 / 4 分');
  });

  it('**今天阅读没发布**：阅读一行写没发布，不算进分母', async () => {
    todayReply = () => jsonResponse(200, lesson({ nextAction: { kind: 'no_content', label: '今天的课程还没有发布', href: null } }, [readSeg({ status: 'none', label: null, score: null, submissionId: null, sessionId: null }), vocabSeg()]));
    overviewReply = () => jsonResponse(200, overview({ home: home({ reading: { state: 'not_generated', reason: 'no_session_published' } }) }));
    mount();
    await settle();
    expect(screen.getByTestId('read-state').textContent).toBe('今天的阅读还没有发布');
    expect(screen.getByLabelText('今天完成 2 / 2')).toBeTruthy();
    expect(screen.queryByTestId('reading-analysis')).toBeNull();
  });

  it('**阅读没做完 → 说没做完**，不显示分数', async () => {
    todayReply = () => jsonResponse(200, lesson({}, [readSeg({ status: 'partial', score: null, submissionId: 'sub-1' }), vocabSeg()]));
    overviewReply = () => jsonResponse(200, overview({ home: home({ reading: { state: 'in_progress', sessionId: 'sess-1' } }) }));
    mount();
    await settle();
    expect(screen.getByTestId('read-state').textContent).toBe('The River Ferry · 还没做完');
  });

  it('**词测成绩照冻结卷的答对几题写，不重算百分比**', async () => {
    mount();
    await settle();
    expect(screen.getByTestId('quiz-state').textContent).toBe('答对 10 / 12');
    expect(screen.getByTestId('quiz-state').textContent).not.toMatch(/%/);
  });

  it('**成绩单取不到**：词测写「成绩暂时没取到」，其余照常', async () => {
    testsReply = () => jsonResponse(503, { code: 'busy' });
    mount();
    await settle();
    expect(screen.getByTestId('quiz-state').textContent).toBe('已交卷 · 成绩暂时没取到');
    expect(screen.getByTestId('summary-completion').textContent).toBe('今天的三项都做完了');
  });

  it('**连续天数为 0 时不显示**（不编一个「连续 0 天」）', async () => {
    todayReply = () => jsonResponse(200, lesson({ streakDays: 0 }));
    mount();
    await settle();
    expect(screen.queryByTestId('summary-streak')).toBeNull();
  });

  it('**暂停的错题不占一行**（IOS-04）', async () => {
    mount();
    await settle();
    expect(within(screen.getByRole('list', { name: '今天三项的结果' })).getAllByRole('listitem')).toHaveLength(3);
    expect(text()).not.toContain('错题');
  });
});

describe('出口', () => {
  it('**有答卷才给「看阅读结果」，且路径恰好是 canonical 结果页**', async () => {
    mount();
    await settle();
    expect(screen.getByTestId('reading-analysis').getAttribute('href')).toBe(ROUTES.readingResult);
  });

  it('**没有答卷就没有那条链接**', async () => {
    todayReply = () => jsonResponse(200, lesson({}, [readSeg({ status: 'todo', submissionId: null, score: null }), vocabSeg()]));
    overviewReply = () => jsonResponse(200, overview({ home: home({ reading: { state: 'pending', sessionId: 'sess-1' } }) }));
    mount();
    await settle();
    expect(screen.queryByTestId('reading-analysis')).toBeNull();
  });

  it('**顶上的返回和底部「回到今日」都恰好是 `/today`**', async () => {
    mount();
    await settle();
    expect(screen.getByTestId('top-back').getAttribute('aria-label')).toBe('返回今日');
    await click(screen.getByTestId('back-to-today'));
    expect(at()).toBe(ROUTES.today);
  });

  it('**这一屏只给已经存在的出口**', async () => {
    mount();
    await settle();
    const hrefs = [...document.querySelectorAll('main a')].map((a) => a.getAttribute('href'));
    expect(hrefs.sort()).toEqual([ROUTES.readingResult, ROUTES.scores, ROUTES.vocab].sort());
  });

  it('**没票时 `/lesson/summary` 去登录页**', async () => {
    localStorage.clear();
    __resetForTest();
    mount();
    await settle();
    expect(at()).toBe(ROUTES.login);
  });

  it('每个 kind 下都能渲染出一个明确结果，不崩、不弹回', async () => {
    for (const kind of NEXT_ACTION_KINDS) {
      __resetForTest();
      writeToken(TOKEN);
      todayReply = () => jsonResponse(200, lesson({ nextAction: { kind, label: kind, href: null } }));
      const { unmount } = mount();
      await settle();
      expect(at()).toBe(ROUTES.summary);
      expect(screen.getByTestId('summary-completion').textContent).toBeTruthy();
      unmount();
    }
  });
});

describe('载入 / 失败 / 重试', () => {
  it('**载入中说得清楚**', async () => {
    todayReply = () => new Promise(() => undefined);
    mount();
    await settle();
    expect(text()).toContain('正在整理今天做过的');
  });

  it('**单词那边失败**：阅读照常，单词两行写没加载出来并可重试；标题不说做完', async () => {
    let fail = true;
    overviewReply = () => (fail ? jsonResponse(500, { code: 'boom' }) : jsonResponse(200, overview()));
    mount();
    await settle();
    expect(screen.getByTestId('read-state').textContent).toContain('3 / 4 分');
    expect(screen.getByTestId('words-state-error')).toBeTruthy();
    expect(screen.getByTestId('summary-completion').textContent).toBe('有一项没加载出来，先看已经有的');
    fail = false;
    await click(within(screen.getByTestId('words-state-error')).getByRole('button', { name: /重试/ }));
    expect(screen.getByTestId('summary-completion').textContent).toBe('今天的三项都做完了');
    expect(writes()).toHaveLength(0);
  });

  it('**两边都失败 → 留着票、给重试**，重试成功且仍然没有写请求', async () => {
    let hit = 0;
    todayReply = () => (++hit === 1 ? Promise.reject(new TypeError('network down')) : jsonResponse(200, lesson()));
    let ovHit = 0;
    overviewReply = () => (++ovHit === 1 ? Promise.reject(new TypeError('network down')) : jsonResponse(200, overview()));
    mount();
    await settle();
    expect(text()).toContain('今天的总结没打开');
    expect(readToken()).toBe(TOKEN);
    await click(screen.getByTestId('retry'));
    expect(screen.getByTestId('summary-completion').textContent).toBe('今天的三项都做完了');
    expect(writes()).toHaveLength(0);
  });

  it('**认证失败走统一登出**：清票、回登录页', async () => {
    todayReply = () => jsonResponse(401, { code: 'token_revoked' });
    mount();
    await settle();
    expect(at()).toBe(ROUTES.login);
    expect(readToken()).toBeNull();
  });

  it('**卸载之后姗姗来迟的响应不许再往屏幕上写**', async () => {
    let release!: () => void;
    todayReply = () => new Promise((ok) => { release = () => ok(jsonResponse(200, lesson()) as unknown as Response); });
    const { unmount } = mount();
    await settle();
    unmount();
    await act(async () => { release(); });
    await settle();
    expect(document.body.textContent).toBe('');
  });
});
