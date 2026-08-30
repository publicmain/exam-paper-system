/**
 * 阶段 10 —— 今日总结（`/lesson/summary`）的**行为测试**。
 *
 * 挂的是**真的 `App`**：真路由、真 auth-store、真 api 客户端，只在 `fetch`
 * 这一层打桩。整份文件**不 import 页面组件** —— 判据全都是「挂到那条路由
 * 上之后，页面做了什么、显示了什么」，所以它对占位页同样跑得起来，
 * 只会**红在行为上**，而不是红在「文件不存在」。
 *
 * 这一屏的三条硬规矩：
 *
 *   · **只读**。除了一次 `GET /lesson/today`，不发任何请求；刷新、重试、
 *     重进都不许变成写。
 *   · **服务端说了算**。分数、完成度、百分比一律照搬，绝不本地重算 ——
 *     尤其不许在服务端说「还在判分 / 没有分数」时补一个 0。
 *   · **只认 kind，不看 href**。后端的 `nextAction.href` 指向旧端，
 *     塞了脏值也不许影响导航。
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { act, render, screen } from '@testing-library/react';
import { MemoryRouter, useLocation } from 'react-router-dom';
import App from '../App';
import { writeToken, readToken } from '../lib/identity';
import { __resetForTest } from '../lib/auth-store';
import { NEXT_ACTION_KINDS, ROUTES, type NextActionKind } from '../routes.contract';

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
// 夹具：一份字段齐全的 `/lesson/today`
// ─────────────────────────────────────────────────────────────

const readSeg = (over: Record<string, unknown> = {}) => ({
  key: 'read',
  status: 'done',
  label: 'The River Ferry',
  questionCount: 4,
  typicalMinutes: 15,
  score: 3,
  maxScore: 4,
  scoresPending: false,
  submissionId: 'sub-1',
  sessionId: 'sess-1',
  autoClosed: false,
  ...over,
});

const vocabSeg = (over: Record<string, unknown> = {}) => ({
  key: 'vocab',
  status: 'done',
  progress: 4,
  target: 4,
  typicalMinutes: 2,
  quizScore: { status: 'submitted', correct: 3, total: 4, percentage: 75, submittedAt: '2026-08-30T05:55:27.181Z' },
  ...over,
});

const drillSeg = (over: Record<string, unknown> = {}) => ({
  key: 'drill',
  status: 'none',
  progress: 0,
  target: 0,
  typicalMinutes: 2,
  ...over,
});

function lesson(over: Record<string, unknown> = {}, segs: Record<string, unknown>[] | null = null) {
  return {
    student: { id: PROFILE.id, name: PROFILE.name },
    date: '2026-08-30',
    // 后端一直下发指向旧端的 href —— 这一屏一次都不许读它
    nextAction: { kind: 'summary', label: '看今天的总结', href: '/my-lesson/summary?name=测试六号' },
    rulesVersion: 3,
    completed: 3,
    total: 3,
    allDone: true,
    streakDays: 5,
    targetsFrozenAt: '2026-08-30T05:48:46.068Z',
    stage: 'done',
    stageAt: '2026-08-30T05:55:27.187Z',
    vocabCursor: 4,
    segments: segs ?? [readSeg(), vocabSeg(), drillSeg()],
    ...over,
  };
}

// ─────────────────────────────────────────────────────────────
// 网络边界
// ─────────────────────────────────────────────────────────────

let todayReply: () => Promise<Response>;
let fetchMock: ReturnType<typeof vi.fn>;

function installFetch() {
  reqs = [];
  fetchMock = vi.fn((url: string, init: RequestInit = {}) => {
    const path = String(url).replace(/^.*\/api/, '');
    reqs.push({
      path,
      method: (init.method as string) ?? 'GET',
      headers: (init.headers as Record<string, string>) ?? {},
      body: init.body ? String(init.body) : null,
    });
    if (path === '/student-auth/me') return jsonResponse(200, { ...PROFILE, appVersion: 'v2' });
    if (path === '/lesson/today') return todayReply();
    return jsonResponse(404, { code: 'not_stubbed', path });
  });
  vi.stubGlobal('fetch', fetchMock);
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

async function settle(rounds = 14) {
  await act(async () => {
    for (let i = 0; i < rounds; i++) await Promise.resolve();
  });
}

const at = () => screen.getByTestId('loc').textContent;
const lessonTodayCalls = () => reqs.filter((r) => r.path === '/lesson/today');
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
  installFetch();
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

// ─────────────────────────────────────────────────────────────
// AC-03 —— 只读边界
// ─────────────────────────────────────────────────────────────

describe('AC-03 只读边界', () => {
  it('**挂载只打一次 `GET /lesson/today`**，带 Bearer，零身份，零写', async () => {
    mount();
    await settle();

    const calls = lessonTodayCalls();
    expect(calls).toHaveLength(1);
    expect(calls[0].method).toBe('GET');
    expect(calls[0].headers.Authorization).toBe(`Bearer ${TOKEN}`);
    expect(calls[0].path).toBe('/lesson/today');           // 没有查询串
    expect(calls[0].body).toBeNull();

    // 整页**一个写请求都没有**
    expect(writes()).toEqual([]);
    for (const r of reqs) {
      expect(r.path).not.toMatch(/[?&#]/);
      expect(r.path).not.toMatch(/name=|studentId=|then=|after=/);
      if (r.body) expect(r.body).not.toMatch(/"name"|"studentName"|"studentId"/);
    }
  });

  it('**永远不碰 `/lesson/start`**，也不碰任何业务写端点', async () => {
    mount();
    await settle();
    for (const r of reqs) {
      expect(r.path).not.toBe('/lesson/start');
      expect(r.path).not.toMatch(/vocab\/quiz\/attempt|vocab\/review|vocab-cursor|vocab-taught/);
      expect(r.path).not.toMatch(/\/answer$|\/submit$|appeals/);
    }
  });

  it('**重进这一屏仍然只读**（刷新等价于重新挂载）', async () => {
    const first = mount();
    await settle();
    first.unmount();
    reqs = [];
    mount();
    await settle();
    expect(lessonTodayCalls()).toHaveLength(1);
    expect(writes()).toEqual([]);
  });

  it('**后端 href 被投毒也不影响这一屏**', async () => {
    todayReply = () =>
      jsonResponse(200, lesson({
        nextAction: { kind: 'summary', label: 'x', href: 'javascript:alert(1)' },
      }));
    mount();
    await settle();
    expect(at()).toBe(ROUTES.summary);
    expect(text()).not.toContain('javascript:');
    for (const a of Array.from(document.querySelectorAll('a'))) {
      expect(a.getAttribute('href') ?? '').not.toMatch(/javascript:|my-lesson|my-history/);
    }
  });
});

// ─────────────────────────────────────────────────────────────
// AC-04 —— 渲染
// ─────────────────────────────────────────────────────────────

describe('AC-04 总结渲染', () => {
  it('**完整的一天**：日期、完成度、连续天数、阅读分、词汇分、三段状态', async () => {
    mount();
    await settle();

    expect(screen.getByTestId('summary-date').textContent).toContain('2026-08-30');
    expect(screen.getByTestId('summary-completion').textContent).toMatch(/3\s*\/\s*3/);
    expect(screen.getByTestId('summary-streak').textContent).toMatch(/5/);
    // 「今天的课完成了」这个状态要说出来
    expect(text()).toMatch(/完成/);

    // 阅读：标题 + 服务端给的分
    expect(screen.getByTestId('read-state').textContent).toContain('The River Ferry');
    expect(screen.getByTestId('read-state').textContent).toMatch(/3\s*\/\s*4/);

    // 正式词汇测试：服务端给的 correct / total / percentage
    const quiz = screen.getByTestId('quiz-state').textContent ?? '';
    expect(quiz).toMatch(/3\s*\/\s*4/);
    expect(quiz).toContain('75');

    // 课程学词进度与错题段
    expect(screen.getByTestId('vocab-progress').textContent).toMatch(/4\s*\/\s*4/);
    expect(screen.getByTestId('drill-state')).toBeInTheDocument();
  });

  it('**阅读还在判分 → 说「还在判分」，绝不显示 0 分**', async () => {
    todayReply = () =>
      jsonResponse(200, lesson({}, [
        readSeg({ scoresPending: true, score: null, maxScore: 4 }),
        vocabSeg(),
        drillSeg(),
      ]));
    mount();
    await settle();
    const s = screen.getByTestId('read-state').textContent ?? '';
    expect(s).toMatch(/判分/);
    expect(s).not.toMatch(/(^|[^\d])0\s*\/\s*4/);
    expect(s).not.toMatch(/0\s*分/);
  });

  it('**交了卷但没有分数 → 说「还没有分数」，绝不显示 0 分**', async () => {
    todayReply = () =>
      jsonResponse(200, lesson({}, [
        readSeg({ scoresPending: false, score: null, maxScore: null }),
        vocabSeg(),
        drillSeg(),
      ]));
    mount();
    await settle();
    const s = screen.getByTestId('read-state').textContent ?? '';
    expect(s).toMatch(/没有分数|暂无分数/);
    expect(s).not.toMatch(/0\s*分/);
  });

  it('**今天没有阅读**', async () => {
    todayReply = () =>
      jsonResponse(200, lesson({}, [
        readSeg({ status: 'none', label: null, submissionId: null, sessionId: null, score: null, maxScore: null, questionCount: null }),
        vocabSeg(),
        drillSeg(),
      ]));
    mount();
    await settle();
    expect(screen.getByTestId('read-state').textContent).toMatch(/没有阅读|今天没有/);
    expect(screen.queryByTestId('reading-analysis')).toBeNull();
  });

  it('**阅读没做完 → 说没做完**，不显示分数', async () => {
    todayReply = () =>
      jsonResponse(200, lesson({}, [
        readSeg({ status: 'partial', score: null, maxScore: null }),
        vocabSeg(),
        drillSeg(),
      ]));
    mount();
    await settle();
    const s = screen.getByTestId('read-state').textContent ?? '';
    expect(s).toMatch(/没做完|没有做完|未完成/);
    expect(s).not.toMatch(/\d\s*\/\s*\d\s*分/);
  });

  it('**词汇测试的四种状态**各自说人话', async () => {
    const cases: Array<[Record<string, unknown>, RegExp]> = [
      [{ status: 'legacy_no_queue' }, /没有单词测试|没有测试/],
      [{ status: 'not_started' }, /还没开始|没有开始/],
      [{ status: 'in_progress', answered: 2, total: 4 }, /2\s*\/\s*4/],
      [{ status: 'submitted', correct: 0, total: 4, percentage: 0, submittedAt: 'x' }, /0\s*\/\s*4/],
    ];
    for (const [quizScore, want] of cases) {
      todayReply = () => jsonResponse(200, lesson({}, [readSeg(), vocabSeg({ quizScore }), drillSeg()]));
      const view = mount();
      await settle();
      expect(screen.getByTestId('quiz-state').textContent, JSON.stringify(quizScore)).toMatch(want);
      view.unmount();
    }
  });

  it('**交了卷 0 分照实显示 0**（这不是编造，是服务端说的）', async () => {
    todayReply = () =>
      jsonResponse(200, lesson({}, [
        readSeg(),
        vocabSeg({ quizScore: { status: 'submitted', correct: 0, total: 4, percentage: 0, submittedAt: 'x' } }),
        drillSeg(),
      ]));
    mount();
    await settle();
    const q = screen.getByTestId('quiz-state').textContent ?? '';
    expect(q).toMatch(/0\s*\/\s*4/);
    expect(q).toContain('0');
  });

  it('**百分比照搬服务端**，不拿 correct/total 重算', async () => {
    // 故意让 percentage 与 correct/total 对不上：1/4 本该是 25%，服务端说 42%
    todayReply = () =>
      jsonResponse(200, lesson({}, [
        readSeg(),
        vocabSeg({ quizScore: { status: 'submitted', correct: 1, total: 4, percentage: 42, submittedAt: 'x' } }),
        drillSeg(),
      ]));
    mount();
    await settle();
    const q = screen.getByTestId('quiz-state').textContent ?? '';
    expect(q).toContain('42');
    expect(q).not.toContain('25');
  });

  it('**连续天数为 0 时不显示**（不编一个「连续 0 天」）', async () => {
    todayReply = () => jsonResponse(200, lesson({ streakDays: 0 }));
    mount();
    await settle();
    expect(screen.queryByTestId('summary-streak')).toBeNull();
  });

  it('**错题段照实显示状态与进度**', async () => {
    todayReply = () =>
      jsonResponse(200, lesson({}, [readSeg(), vocabSeg(), drillSeg({ status: 'partial', progress: 1, target: 3 })]));
    mount();
    await settle();
    expect(screen.getByTestId('drill-state').textContent).toMatch(/1\s*\/\s*3/);
  });
});

// ─────────────────────────────────────────────────────────────
// AC-05 —— 路由与守卫
// ─────────────────────────────────────────────────────────────

describe('AC-05 路由与守卫', () => {
  it('**kind=summary 时渲染这一屏**（占位页已经不在了）', async () => {
    mount();
    await settle();
    expect(at()).toBe(ROUTES.summary);
    expect(screen.getByTestId('summary-date')).toBeInTheDocument();
    // 占位页那句话必须消失
    expect(text()).not.toContain('这一段还没有做好');
  });

  it('**除 summary 外的每一个 kind 都 replace 回 `/today`**', async () => {
    const others = NEXT_ACTION_KINDS.filter((k) => k !== 'summary');
    expect(others).toHaveLength(9);
    for (const kind of others as NextActionKind[]) {
      todayReply = () => jsonResponse(200, lesson({ nextAction: { kind, label: 'x', href: '/my-lesson/summary' } }));
      const view = mount();
      await settle();
      expect(at(), kind).toBe(ROUTES.today);
      view.unmount();
    }
  });

  it('**有答卷才给「看阅读解析」，且路径恰好是 canonical 结果页**', async () => {
    mount();
    await settle();
    const link = screen.getByTestId('reading-analysis');
    await click(link);
    expect(at()).toBe(ROUTES.readingResult);
  });

  it('**没有答卷就没有那条链接**', async () => {
    todayReply = () =>
      jsonResponse(200, lesson({}, [readSeg({ submissionId: null }), vocabSeg(), drillSeg()]));
    mount();
    await settle();
    expect(screen.queryByTestId('reading-analysis')).toBeNull();
  });

  it('**「回到今天的课」恰好是 `/today`**', async () => {
    mount();
    await settle();
    await click(screen.getByTestId('back-to-today'));
    expect(at()).toBe(ROUTES.today);
  });

  it('**这一屏不给任何还没实现的出口**（阶段 11/12 的路由一个都没有）', async () => {
    mount();
    await settle();
    const hrefs = Array.from(document.querySelectorAll('a')).map((a) => a.getAttribute('href') ?? '');
    const allowed = [ROUTES.today, ROUTES.readingResult];
    for (const h of hrefs) {
      expect(allowed, `出现了不该有的出口 ${h}`).toContain(h);
    }
    for (const h of hrefs) {
      expect(h).not.toMatch(/my-history|my-vocab|my-mistakes|my-lesson|scan|\/scores|\/history/);
    }
  });

  it('**未知路由与登录守卫没变**：没票时 `/lesson/summary` 去登录页', async () => {
    localStorage.clear();
    __resetForTest();
    mount();
    await settle();
    expect(at()).toBe(ROUTES.login);
    expect(lessonTodayCalls()).toHaveLength(0);
  });
});

// ─────────────────────────────────────────────────────────────
// AC-06 —— 载入、失败、重试
// ─────────────────────────────────────────────────────────────

describe('AC-06 载入 / 失败 / 重试', () => {
  it('**载入中说得清楚**', async () => {
    let release: ((v: Response) => void) | null = null;
    todayReply = () => new Promise<Response>((res) => { release = res; });
    mount();
    await settle();
    expect(text()).toMatch(/载入中/);
    await act(async () => {
      release?.({ ok: true, status: 200, text: () => Promise.resolve(JSON.stringify(lesson())) } as Response);
    });
    await settle();
    expect(screen.getByTestId('summary-date')).toBeInTheDocument();
  });

  it('**服务端故障 → 留着票、给重试**，重试成功且仍然没有写请求', async () => {
    let fail = true;
    todayReply = () => (fail ? jsonResponse(500, { message: 'boom' }) : jsonResponse(200, lesson()));
    mount();
    await settle();

    expect(readToken()).toBe(TOKEN);           // 票没被清掉
    const retry = screen.getByTestId('retry');
    expect(retry).toBeInTheDocument();

    fail = false;
    await click(retry);
    expect(screen.getByTestId('summary-date')).toBeInTheDocument();
    expect(writes()).toEqual([]);
    expect(lessonTodayCalls().length).toBe(2);  // 首次 + 重试，没有别的
  });

  it('**认证失败走统一登出**：清票、回登录页', async () => {
    todayReply = () => jsonResponse(401, { code: 'token_revoked' });
    mount();
    await settle();
    expect(readToken()).toBeNull();
    expect(at()).toBe(ROUTES.login);
  });

  it('**卸载之后姗姗来迟的响应不许再往屏幕上写**', async () => {
    const resolvers: Array<(v: Response) => void> = [];
    todayReply = () => new Promise<Response>((res) => { resolvers.push(res); });
    const view = mount();
    await settle();
    expect(resolvers).toHaveLength(1);

    // 学生等不及走了 —— 组件卸载，**之后**那个响应才回来
    view.unmount();
    const errors: unknown[] = [];
    const spy = vi.spyOn(console, 'error').mockImplementation((...a) => { errors.push(a); });
    const stale = lesson({ date: '1999-01-01' });
    await act(async () => {
      resolvers[0]({ ok: true, status: 200, text: () => Promise.resolve(JSON.stringify(stale)) } as Response);
    });
    await settle();
    spy.mockRestore();

    // 既没有把 1999 画出来，也没有对着已卸载的树 setState
    expect(text()).not.toContain('1999-01-01');
    expect(errors.map(String).join(' ')).not.toMatch(/unmounted|not wrapped in act/i);
    // 迟到的那一个也没有引出第二次请求
    expect(lessonTodayCalls()).toHaveLength(1);

    // 重新进来看到的是新数据，不是那份过期的
    todayReply = () => jsonResponse(200, lesson());
    mount();
    await settle();
    expect(screen.getByTestId('summary-date').textContent).toContain('2026-08-30');
    expect(text()).not.toContain('1999-01-01');
  });
});
