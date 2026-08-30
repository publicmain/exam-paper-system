/**
 * 阶段 11 —— 历史成绩列表（`/scores`）的**行为测试**。
 *
 * 挂的是**真的 `App`**：真路由、真 auth-store、真 api 客户端，只在 `fetch`
 * 这一层打桩。整份文件**不 import 页面组件** —— 判据全是「挂到那条路由上
 * 之后，页面发了什么请求、显示了什么」，所以路由不存在时它照样跑得起来，
 * 只会**红在行为上**。
 *
 * 这一屏的硬规矩：
 *
 *   · **两段分开**。阅读成绩与正式单词测试成绩来自两个互不相干的端点，
 *     **绝不按日期拼成一条**「今天的成绩」—— 那是在替服务端造关联。
 *   · **只读**。两个 GET，此外一个请求都不发；没有练习、没有趋势、
 *     没有能力画像、没有姓名查询。
 *   · **服务端说了算**。分数照搬：说「还在判分」就说还在判分，
 *     **绝不补一个 0**；真的 0 分要如实显示成 0。
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { act, render, screen } from '@testing-library/react';
import { MemoryRouter, useLocation } from 'react-router-dom';
import App from '../App';
import { writeToken, readToken } from '../lib/identity';
import { __resetForTest } from '../lib/auth-store';
import { ROUTES } from '../routes.contract';

/**
 * 路径写成**字面量**，不从 `ROUTES` 取。
 *
 * 这样这份测试在契约还没加这两条时也能真的挂上去 —— 红在「页面没有 /
 * 请求没发 / 内容没渲染」，而不是红在 `ROUTES.scores === undefined`
 * 把 MemoryRouter 弄崩。契约常量本身另有一条断言单独钉。
 */
const SCORES = '/scores';

const PROFILE = { id: 't6_done', name: '测试六号', nickname: '六号', avatar: null };
const TOKEN = 'scores-token';

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
// 夹具 —— 字段照 `morning-quiz.controller.ts` 的 historyByName 与
// `vocab-quiz-attempt.service.ts` 的 history() 逐字写
// ─────────────────────────────────────────────────────────────

/** 阅读一行。`date` 是 `@db.Date`，序列化成 UTC 零点 —— 与线上一致。 */
const sub = (over: Record<string, unknown> = {}) => ({
  submissionId: 'sub-a',
  answersPending: false,
  reopenable: false,
  sessionId: 'sess-a',
  date: '2026-08-29T00:00:00.000Z',
  level: 'ielts',
  paperName: 'The River Ferry',
  className: 'TC1',
  autoScore: 3,
  totalScore: 3,
  maxScore: 4,
  submittedAt: '2026-08-29T00:31:00.000Z',
  status: 'marked',
  scoresPending: false,
  ...over,
});

const attempt = (over: Record<string, unknown> = {}) => ({
  id: 'att-1',
  date: '2026-08-30',
  submittedAt: '2026-08-30T05:55:27.181Z',
  total: 4,
  correct: 0,
  score: 0,
  ...over,
});

function history(rows: Record<string, unknown>[]) {
  return {
    student: { name: PROFILE.name, matchedCount: 1, classes: ['TC1'] },
    submissions: rows,
  };
}

const lessonToday = {
  student: { id: PROFILE.id, name: PROFILE.name },
  date: '2026-08-30',
  nextAction: { kind: 'summary', label: '看今天的总结', href: '/my-lesson/summary' },
  rulesVersion: 3,
  completed: 3,
  total: 3,
  allDone: true,
  streakDays: 5,
  targetsFrozenAt: '2026-08-30T05:48:46.068Z',
  stage: 'done',
  stageAt: '2026-08-30T05:55:27.187Z',
  vocabCursor: 4,
  segments: [
    {
      key: 'read', status: 'done', label: 'The River Ferry', questionCount: 4,
      typicalMinutes: 15, score: 3, maxScore: 4, scoresPending: false,
      submissionId: 'sub-a', sessionId: 'sess-a', autoClosed: false,
    },
    {
      key: 'vocab', status: 'done', progress: 4, target: 4, typicalMinutes: 2,
      quizScore: { status: 'submitted', correct: 0, total: 4, percentage: 0, submittedAt: '2026-08-30T05:55:27.181Z' },
    },
    { key: 'drill', status: 'none', progress: 0, target: 0, typicalMinutes: 2 },
  ],
};

// ─────────────────────────────────────────────────────────────
// 网络边界
// ─────────────────────────────────────────────────────────────

let historyReply: () => Promise<Response>;
let attemptsReply: () => Promise<Response>;
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
    if (path === '/lesson/today') return jsonResponse(200, lessonToday);
    if (path.split('?')[0] === '/morning-quiz/history-by-name') return historyReply();
    if (path.split('?')[0] === '/vocab/quiz/attempts') return attemptsReply();
    return jsonResponse(404, { code: 'not_stubbed', path });
  });
  vi.stubGlobal('fetch', fetchMock);
}

function LocationProbe() {
  const loc = useLocation();
  return <span data-testid="loc">{loc.pathname}</span>;
}

function mount(at: string = SCORES) {
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
  historyReply = () => jsonResponse(200, history([sub()]));
  attemptsReply = () => jsonResponse(200, { attempts: [attempt()] });
  installFetch();
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

// ─────────────────────────────────────────────────────────────
// AC-04 —— API 与身份边界
// ─────────────────────────────────────────────────────────────

describe('AC-03 路由契约', () => {
  it('**契约里有 `/scores` 与 `/scores/:submissionId`**，且没有 `/app` 前缀', () => {
    expect((ROUTES as Record<string, string>).scores).toBe('/scores');
    expect((ROUTES as Record<string, string>).scoreDetail).toBe('/scores/:submissionId');
  });
});

describe('AC-04 API 与身份边界', () => {
  it('**恰好两个 GET**：history-by-name 与 vocab/quiz/attempts，各一次', async () => {
    mount();
    await settle();

    expect(at()).toBe(SCORES);
    expect(calls('/morning-quiz/history-by-name')).toHaveLength(1);
    expect(calls('/vocab/quiz/attempts')).toHaveLength(1);
    for (const p of ['/morning-quiz/history-by-name', '/vocab/quiz/attempts']) {
      const c = calls(p)[0];
      expect(c.method).toBe('GET');
      expect(c.headers.Authorization).toBe(`Bearer ${TOKEN}`);
      expect(c.path).toBe(p); // 没有查询串
      expect(c.body).toBeNull(); // 没有请求体
    }
  });

  it('**零身份参数**，URL 与请求体都没有 name / studentId', async () => {
    mount();
    await settle();
    for (const r of reqs) {
      expect(r.path).not.toMatch(/name=|studentName=|studentId=|then=|after=/);
      if (r.body) expect(r.body).not.toMatch(/"name"|"studentName"|"studentId"/);
    }
  });

  it('**一个写请求都没有**，也不碰趋势 / 能力画像 / 练习 / 上课预告 / 埋点', async () => {
    mount();
    await settle();
    expect(writes()).toEqual([]);
    for (const r of reqs) {
      expect(r.path).not.toMatch(/trend|weak|skill|upcoming|page-view|practice/);
      expect(r.path).not.toMatch(/lesson\/start|attempt\/|vocab\/review|vocab-cursor|vocab-taught|appeals/);
      expect(r.path).not.toMatch(/history-detail/);
    }
  });

  it('**不读 `/lesson/today`** —— 历史成绩与今天的课无关', async () => {
    mount();
    await settle();
    expect(calls('/lesson/today')).toHaveLength(0);
  });

  it('**不碰 `mq:` 之类的旧存储键**', async () => {
    mount();
    await settle();
    for (const k of Object.keys(localStorage)) expect(k.startsWith('mq:')).toBe(false);
  });
});

// ─────────────────────────────────────────────────────────────
// AC-05 —— 列表行为
// ─────────────────────────────────────────────────────────────

describe('AC-05 两段分开渲染', () => {
  it('阅读段与正式测试段是**两个独立区块**，不按日期拼成一条', async () => {
    historyReply = () => jsonResponse(200, history([sub({ date: '2026-08-30T00:00:00.000Z' })]));
    mount();
    await settle();

    const reading = screen.getByTestId('reading-section');
    const quiz = screen.getByTestId('quiz-section');
    // 同一天的两条记录**各自待在自己的区块里**，谁也不含着谁
    expect(reading.contains(quiz)).toBe(false);
    expect(quiz.contains(reading)).toBe(false);
    expect(reading.textContent).toContain('The River Ferry');
    expect(quiz.textContent).not.toContain('The River Ferry');
  });

  it('**多行按服务端顺序渲染**，不重排', async () => {
    historyReply = () =>
      jsonResponse(200, history([
        sub({ submissionId: 'sub-new', paperName: '第二篇', date: '2026-08-29T00:00:00.000Z' }),
        sub({ submissionId: 'sub-old', paperName: '第一篇', date: '2026-08-28T00:00:00.000Z' }),
      ]));
    mount();
    await settle();

    const rows = [...screen.getByTestId('reading-section').querySelectorAll('[data-row-id]')];
    expect(rows.map((r) => r.getAttribute('data-row-id'))).toEqual(['sub-new', 'sub-old']);
  });

  it('**practice 行一条都不显示**（旧端才需要它们）', async () => {
    historyReply = () =>
      jsonResponse(200, history([
        sub({ submissionId: 'sub-real', paperName: '正式那一篇' }),
        sub({ submissionId: 'sub-prac', paperName: '练习那一篇', status: 'practice' }),
      ]));
    mount();
    await settle();

    expect(text()).toContain('正式那一篇');
    expect(text()).not.toContain('练习那一篇');
    expect(screen.queryByTestId('reading-row-sub-prac')).toBeNull();
  });

  it('日期与卷名**都来自 API**', async () => {
    historyReply = () =>
      jsonResponse(200, history([sub({ date: '2026-08-27T00:00:00.000Z', paperName: 'A Bridge Too Far' })]));
    mount();
    await settle();
    const row = screen.getByTestId('reading-row-sub-a');
    expect(row.textContent).toContain('2026-08-27');
    expect(row.textContent).toContain('A Bridge Too Far');
  });

  it('**还在判分时绝不补 0**', async () => {
    historyReply = () =>
      jsonResponse(200, history([
        sub({ scoresPending: true, autoScore: null, totalScore: null, status: 'submitted' }),
      ]));
    mount();
    await settle();
    const row = screen.getByTestId('reading-row-sub-a');
    expect(row.textContent).toContain('还在判分');
    expect(row.textContent).not.toMatch(/\b0\s*\//);
  });

  it('**真的 0 分就显示 0**', async () => {
    historyReply = () => jsonResponse(200, history([sub({ autoScore: 0, totalScore: 0, maxScore: 4 })]));
    mount();
    await settle();
    expect(screen.getByTestId('reading-score-sub-a').textContent).toContain('0 / 4');
  });

  it('**分数放出来了但服务端没给数**，也不编一个 0', async () => {
    historyReply = () =>
      jsonResponse(200, history([
        sub({ scoresPending: false, autoScore: null, totalScore: null, maxScore: null }),
      ]));
    mount();
    await settle();
    const row = screen.getByTestId('reading-row-sub-a');
    expect(row.textContent).toContain('没有分数');
    expect(row.textContent).not.toMatch(/\b0\s*\//);
  });

  it('完成状态只由 status / answersPending / reopenable 推出，不造「今天全完成」', async () => {
    historyReply = () =>
      jsonResponse(200, history([
        sub({ submissionId: 'sub-open', answersPending: true, reopenable: true, scoresPending: true, totalScore: null }),
        sub({ submissionId: 'sub-lock', answersPending: true, reopenable: false, scoresPending: true, totalScore: null }),
      ]));
    mount();
    await settle();
    expect(screen.getByTestId('reading-state-sub-open').textContent).toContain('还能回去改');
    expect(screen.getByTestId('reading-state-sub-lock').textContent).not.toContain('还能回去改');
    expect(text()).not.toContain('今天全部完成');
  });

  it('**正式测试分数照搬服务端的 `score`，不用 correct/total 重算**', async () => {
    attemptsReply = () => jsonResponse(200, { attempts: [attempt({ id: 'att-x', total: 4, correct: 2, score: 99 })] });
    mount();
    await settle();
    const row = screen.getByTestId('quiz-row-att-x');
    expect(row.textContent).toContain('2 / 4');
    expect(screen.getByTestId('quiz-score-att-x').textContent).toContain('99');
    expect(row.textContent).not.toContain('50');
  });

  it('**正式测试的 0 分不许藏起来**', async () => {
    attemptsReply = () => jsonResponse(200, { attempts: [attempt({ id: 'att-0', total: 4, correct: 0, score: 0 })] });
    mount();
    await settle();
    const row = screen.getByTestId('quiz-row-att-0');
    expect(row.textContent).toContain('0 / 4');
    expect(screen.getByTestId('quiz-score-att-0').textContent).toContain('0');
  });

  it('两段**各自的空状态**互不影响', async () => {
    historyReply = () => jsonResponse(200, history([]));
    mount();
    await settle();
    expect(screen.getByTestId('reading-empty')).toBeTruthy();
    expect(screen.queryByTestId('quiz-empty')).toBeNull();
    expect(screen.getByTestId('quiz-row-att-1')).toBeTruthy();
  });

  it('正式测试为空时只有那一段空', async () => {
    attemptsReply = () => jsonResponse(200, { attempts: [] });
    mount();
    await settle();
    expect(screen.getByTestId('quiz-empty')).toBeTruthy();
    expect(screen.queryByTestId('reading-empty')).toBeNull();
  });

  it('**没有出勤 / 趋势 / 能力画像 / 练习 / 姓名查询的界面**', async () => {
    mount();
    await settle();
    const t = text();
    for (const banned of ['出勤', '迟到', '缺勤', '趋势', '能力', '再练一次', '输入姓名']) {
      expect(t, `不该出现「${banned}」`).not.toContain(banned);
    }
    expect(document.querySelectorAll('input')).toHaveLength(0);
  });
});

// ─────────────────────────────────────────────────────────────
// AC-05 —— 载入 / 失败 / 重试 / 掉票 / 过期响应
// ─────────────────────────────────────────────────────────────

describe('AC-05 载入与失败', () => {
  it('先显示载入中', async () => {
    let release: (() => void) | null = null;
    historyReply = () =>
      new Promise<Response>((res) => {
        release = () =>
          res({
            ok: true,
            status: 200,
            text: () => Promise.resolve(JSON.stringify(history([sub()]))),
          } as Response);
      });
    mount();
    await settle();
    expect(text()).toContain('载入中');
    await act(async () => {
      release?.();
    });
    await settle();
    expect(screen.getByTestId('reading-row-sub-a')).toBeTruthy();
  });

  it('任一端点失败 → 错误态 + 重试，**票不丢**', async () => {
    attemptsReply = () => jsonResponse(500, { code: 'boom' });
    mount();
    await settle();
    expect(screen.getByTestId('retry')).toBeTruthy();
    expect(readToken()).toBe(TOKEN);
    expect(at()).toBe(SCORES);

    attemptsReply = () => jsonResponse(200, { attempts: [attempt()] });
    await click(screen.getByTestId('retry'));
    expect(screen.getByTestId('quiz-row-att-1')).toBeTruthy();
  });

  it('**401 清票并回登录页**', async () => {
    historyReply = () => jsonResponse(401, { code: 'student_token_required' });
    mount();
    await settle();
    expect(readToken()).toBeNull();
    expect(at()).toBe(ROUTES.login);
  });

  it('**卸载之后回来的响应画不上去**', async () => {
    let release: ((v: Response) => void) | null = null;
    historyReply = () =>
      new Promise<Response>((res) => {
        release = res;
      });
    const view = mount();
    await settle();
    view.unmount();
    await act(async () => {
      release?.({
        ok: true,
        status: 200,
        text: () => Promise.resolve(JSON.stringify(history([sub()]))),
      } as Response);
    });
    await settle();
    expect(document.body.textContent).not.toContain('The River Ferry');
  });
});

// ─────────────────────────────────────────────────────────────
// AC-03 —— 入口与出口
// ─────────────────────────────────────────────────────────────

describe('AC-03 入口与出口', () => {
  it('**每一行都链到 `/scores/:submissionId`**', async () => {
    mount();
    await settle();
    const link = screen.getByTestId('reading-link-sub-a');
    expect(link.getAttribute('href')).toBe('/scores/sub-a');
  });

  it('正式测试那一段**没有详情入口**（这一版没有逐题回顾）', async () => {
    mount();
    await settle();
    expect(screen.getByTestId('quiz-section').querySelectorAll('a')).toHaveLength(0);
  });

  it('回到今天的课', async () => {
    mount();
    await settle();
    await click(screen.getByTestId('back-to-today'));
    expect(at()).toBe(ROUTES.today);
  });

  it('**`/today` 上有历史成绩入口**', async () => {
    mount(ROUTES.today);
    await settle();
    await click(screen.getByTestId('go-scores'));
    expect(at()).toBe(SCORES);
  });

  it('**今日总结上也有历史成绩入口**', async () => {
    mount(ROUTES.summary);
    await settle();
    await click(screen.getByTestId('go-scores'));
    expect(at()).toBe(SCORES);
  });

  it('**页面上没有任何旧端路由**', async () => {
    mount();
    await settle();
    for (const a of document.querySelectorAll('a')) {
      const href = a.getAttribute('href') ?? '';
      expect(href).not.toMatch(/my-history|my-lesson|my-vocab|my-mistakes|scan/);
    }
  });
});
