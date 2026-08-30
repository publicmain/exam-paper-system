/**
 * 阶段 12B —— 错题本（`/mistakes`）的**行为测试**。
 *
 * 挂真 `App`，只在 `fetch` 打桩，**不 import 页面组件**；路径写字面量，
 * 所以路由还不存在时也跑得起来，只会**红在行为上**。
 *
 * 这一屏的规矩：
 *
 *   · **一个 GET**（`/vocab/mistakes?includeResolved=1`），除此之外只在
 *     学生明确动手时才发请求；
 *   · **未销账 / 已销账两段分开**，各自保留服务端顺序；
 *   · **销账要确认**，而且 `{updated:0}` 是失败不是成功；
 *   · **写成功之后重新对账**，对不上就别把旧数字当真相；
 *   · **含糊的失败不许盲目重发** —— 先把列表读回来看看到底成没成。
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { act, render, screen } from '@testing-library/react';
import { MemoryRouter, useLocation } from 'react-router-dom';
import App from '../App';
import { writeToken, readToken } from '../lib/identity';
import { __resetForTest } from '../lib/auth-store';
import { ROUTES } from '../routes.contract';

/** 字面量 —— 红在行为上，而不是 `ROUTES.mistakes === undefined`。 */
const MISTAKES = '/mistakes';
const PRACTICE = '/mistakes/practice';

const PROFILE = { id: 't6_done', name: '测试六号', nickname: '六号', avatar: null };
const TOKEN = 'mistakes-token';

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
// 夹具 —— 字段照 `mistake.service.ts` 的 listForStudent()
// ─────────────────────────────────────────────────────────────

const entry = (over: Record<string, unknown> = {}) => ({
  id: 'm1',
  submissionId: 'sub-a',
  paperQuestionId: 'pq-1',
  taskType: 'true_false_not_given',
  passageTitle: 'The River Ferry',
  quizDay: '2026-08-29',
  stem: 'The ferry ran after dark before the bridge was built.',
  studentAnswer: 'TRUE',
  correctAnswer: 'FALSE',
  markerComment: '第三段说天黑之后就停了。',
  awarded: 0,
  maxMarks: 1,
  vocabWord: '',
  reason: 'repeated_tasktype',
  resolved: false,
  resolvedAt: null,
  correctStreak: 0,
  practiceCount: 0,
  lastPracticedAt: null,
  answerPoints: ['FALSE'],
  answerModel: '',
  explanation: '第三段最后一句直接否定了这个说法。',
  evidence: 'After dark the ferry no longer ran.',
  createdAt: '2026-08-29T02:10:00.000Z',
  ...over,
});

function list(entries: Record<string, unknown>[] = [entry()], over: Record<string, unknown> = {}) {
  const unresolved = entries.filter((e) => !e.resolved);
  return {
    student: { id: PROFILE.id, name: PROFILE.name },
    total: unresolved.length,
    byTaskType: [{ taskType: 'true_false_not_given', count: unresolved.length }],
    entries,
    ...over,
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

let listReply: () => Promise<Response>;
let resolveReply: () => Promise<Response>;

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
    if (path === '/vocab/mistakes') return listReply();
    if (path === '/vocab/mistakes/resolve') return resolveReply();
    return jsonResponse(404, { code: 'not_stubbed', path: full });
  });
  vi.stubGlobal('fetch', fetchMock);
}

function LocationProbe() {
  const loc = useLocation();
  return <span data-testid="loc">{loc.pathname}</span>;
}

function mount(at: string = MISTAKES) {
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
const calls = (p: string) => reqs.filter((r) => r.path.split('?')[0] === p);
const bodies = (p: string) => calls(p).map((c) => JSON.parse(c.body ?? '{}'));

async function click(el: HTMLElement) {
  await act(async () => {
    el.click();
  });
  await settle();
}

/** 手动控制的 resolve 响应 —— 测试自己决定什么时候回、回什么。 */
function heldResolve() {
  let resolve!: (v: Response) => void;
  let reject!: (e: unknown) => void;
  const p = new Promise<Response>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  resolveReply = () => p;
  return {
    ok: (body: unknown = { updated: 1 }) =>
      resolve({ ok: true, status: 200, text: () => Promise.resolve(JSON.stringify(body)) } as Response),
    fail: () => reject(new TypeError('network down')),
  };
}

beforeEach(() => {
  __resetForTest();
  localStorage.clear();
  writeToken(TOKEN);
  listReply = () => jsonResponse(200, list());
  resolveReply = () => jsonResponse(200, { updated: 1 });
  installFetch();
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

// ─────────────────────────────────────────────────────────────
// AC-03 —— 路由与入口
// ─────────────────────────────────────────────────────────────

describe('AC-03 路由与入口', () => {
  it('**契约里有两条错题本路由**，且没有 `/app` 前缀', () => {
    const R = ROUTES as Record<string, string>;
    expect(R.mistakes).toBe('/mistakes');
    expect(R.mistakePractice).toBe('/mistakes/practice');
    for (const p of [R.mistakes, R.mistakePractice]) {
      expect(String(p).startsWith('/app/')).toBe(false);
    }
  });

  it('**`/today` 上有错题本入口**', async () => {
    mount(ROUTES.today);
    await settle();
    await click(screen.getByTestId('go-mistakes'));
    expect(at()).toBe(MISTAKES);
  });

  it('**今日总结上也有错题本入口**', async () => {
    mount(ROUTES.summary);
    await settle();
    await click(screen.getByTestId('go-mistakes'));
    expect(at()).toBe(MISTAKES);
  });

  it('**没票时进 `/mistakes` 去登录页，且一个错题请求都不发**', async () => {
    localStorage.clear();
    __resetForTest();
    mount();
    await settle();
    expect(at()).toBe(ROUTES.login);
    expect(calls('/vocab/mistakes')).toHaveLength(0);
  });

  it('**重练入口链到 `/mistakes/practice`**', async () => {
    mount();
    await settle();
    expect((screen.getByTestId('go-practice') as HTMLAnchorElement).getAttribute('href')).toBe(PRACTICE);
  });

  it('**页面上没有任何旧端路由**', async () => {
    mount();
    await settle();
    for (const a of document.querySelectorAll('a')) {
      expect(a.getAttribute('href') ?? '').not.toMatch(/my-mistakes|my-history|my-vocab|my-lesson|scan/);
    }
  });
});

// ─────────────────────────────────────────────────────────────
// AC-04 —— 请求边界
// ─────────────────────────────────────────────────────────────

describe('AC-04 请求边界', () => {
  it('**恰好一个 GET**，查询串里只有 includeResolved=1', async () => {
    mount();
    await settle();
    expect(calls('/vocab/mistakes')).toHaveLength(1);
    const c = calls('/vocab/mistakes')[0];
    expect(c.method).toBe('GET');
    expect(c.headers.Authorization).toBe(`Bearer ${TOKEN}`);
    expect(c.body).toBeNull();
    const q = new URLSearchParams(c.path.split('?')[1] ?? '');
    expect([...q.keys()]).toEqual(['includeResolved']);
    expect(q.get('includeResolved')).toBe('1');
  });

  it('**零身份参数**，URL 与请求体都没有', async () => {
    mount();
    await settle();
    await click(screen.getByTestId('resolve-m1'));
    await click(screen.getByTestId('confirm-resolve-m1'));
    for (const r of reqs) {
      expect(r.path).not.toMatch(/[?&](name|studentName|studentId)=/);
      if (r.body) expect(r.body).not.toMatch(/"name"|"studentName"|"studentId"/);
    }
  });

  it('**不碰课程线 / 生词本 / 成绩线 / 正式测试 / 埋点**', async () => {
    mount();
    await settle();
    for (const r of reqs) {
      expect(r.path).not.toMatch(/^\/lesson\//);
      expect(r.path).not.toMatch(/vocab\/(words|due|review|quiz)/);
      expect(r.path).not.toMatch(/history-by-name|quiz\/attempt|page-view/);
    }
  });

  it('**一个存储键都不写**', async () => {
    const before = Object.keys(localStorage).sort();
    mount();
    await settle();
    expect(Object.keys(localStorage).sort()).toEqual(before);
  });
});

// ─────────────────────────────────────────────────────────────
// AC-05 —— 列表
// ─────────────────────────────────────────────────────────────

describe('AC-05 两段与字段', () => {
  it('**未销账 / 已销账分成两段，各自保留服务端顺序**', async () => {
    listReply = () =>
      jsonResponse(200, list([
        entry({ id: 'u1', quizDay: '2026-08-29' }),
        entry({ id: 'u2', quizDay: '2026-08-28' }),
        entry({ id: 'r1', resolved: true, resolvedAt: '2026-08-28T00:00:00.000Z' }),
        entry({ id: 'r2', resolved: true, resolvedAt: '2026-08-27T00:00:00.000Z' }),
      ]));
    mount();
    await settle();

    const un = screen.getByTestId('unresolved-section');
    const re = screen.getByTestId('resolved-section');
    expect(un.contains(re)).toBe(false);
    expect([...un.querySelectorAll('[data-entry-id]')].map((e) => e.getAttribute('data-entry-id')))
      .toEqual(['u1', 'u2']);
    expect([...re.querySelectorAll('[data-entry-id]')].map((e) => e.getAttribute('data-entry-id')))
      .toEqual(['r1', 'r2']);
  });

  it('**总数与题型统计照搬服务端**，不本地重算', async () => {
    listReply = () =>
      jsonResponse(200, list([entry()], {
        total: 17,
        byTaskType: [
          { taskType: 'true_false_not_given', count: 9 },
          { taskType: 'short_answer', count: 8 },
        ],
      }));
    mount();
    await settle();
    expect(screen.getByTestId('mistakes-total').textContent).toContain('17');
    const by = screen.getByTestId('by-tasktype').textContent ?? '';
    expect(by).toContain('9');
    expect(by).toContain('8');
  });

  it('一条错题的**每个字段都来自服务端**', async () => {
    mount();
    await settle();
    const row = screen.getByTestId('entry-m1');
    expect(row.textContent).toContain('The River Ferry');
    expect(row.textContent).toContain('2026-08-29');
    expect(screen.getByTestId('stem-m1').textContent).toContain('The ferry ran after dark');
    expect(screen.getByTestId('old-answer-m1').textContent).toContain('TRUE');
    expect(screen.getByTestId('correct-answer-m1').textContent).toContain('FALSE');
    expect(screen.getByTestId('marks-m1').textContent).toContain('0 / 1');
    expect(screen.getByTestId('comment-m1').textContent).toContain('第三段说天黑之后就停了');
    expect(screen.getByTestId('points-m1').textContent).toContain('FALSE');
    expect(screen.getByTestId('explanation-m1').textContent).toContain('第三段最后一句');
    expect(screen.getByTestId('evidence-m1').textContent).toContain('After dark the ferry');
    expect(screen.getByTestId('streak-m1').textContent).toContain('0');
  });

  it('**缺的字段就不显示**，不编空评语 / 空解析 / 空范文', async () => {
    listReply = () =>
      jsonResponse(200, list([
        entry({ markerComment: '', explanation: '', evidence: '', answerModel: '', answerPoints: [] }),
      ]));
    mount();
    await settle();
    expect(screen.queryByTestId('comment-m1')).toBeNull();
    expect(screen.queryByTestId('explanation-m1')).toBeNull();
    expect(screen.queryByTestId('evidence-m1')).toBeNull();
    expect(screen.queryByTestId('model-m1')).toBeNull();
    expect(screen.queryByTestId('points-m1')).toBeNull();
  });

  it('**长答题的范文与要点都显示**', async () => {
    listReply = () =>
      jsonResponse(200, list([
        entry({ id: 'm2', taskType: 'short_answer', maxMarks: 3, awarded: 1,
                answerPoints: ['提到渡船停运', '提到桥建成'], answerModel: '桥建成之后渡船就停了。' }),
      ]));
    mount();
    await settle();
    expect(screen.getByTestId('points-m2').textContent).toContain('提到渡船停运');
    expect(screen.getByTestId('model-m2').textContent).toContain('桥建成之后渡船就停了');
    expect(screen.getByTestId('marks-m2').textContent).toContain('1 / 3');
  });

  it('**有 submissionId 才给成绩详情入口**，而且走编码后的路径', async () => {
    listReply = () =>
      jsonResponse(200, list([
        entry({ id: 'withsub', submissionId: 'sub a/b' }),
        entry({ id: 'nosub', submissionId: null }),
      ]));
    mount();
    await settle();
    const link = screen.getByTestId('detail-link-withsub') as HTMLAnchorElement;
    expect(link.getAttribute('href')).toBe(`/scores/${encodeURIComponent('sub a/b')}`);
    expect(link.getAttribute('href')).not.toMatch(/[?#]/);
    expect(screen.queryByTestId('detail-link-nosub')).toBeNull();
  });

  it('**服务端文本当纯文本渲染**，不解释成 HTML', async () => {
    listReply = () =>
      jsonResponse(200, list([entry({ stem: '<img src=x onerror="alert(1)">题干' })]));
    mount();
    await settle();
    expect(screen.getByTestId('stem-m1').textContent).toContain('<img src=x');
    expect(document.querySelectorAll('img')).toHaveLength(0);
  });

  it('**两段各自的空态**', async () => {
    listReply = () => jsonResponse(200, list([entry({ id: 'r1', resolved: true })]));
    mount();
    await settle();
    expect(screen.getByTestId('unresolved-empty')).toBeTruthy();
    expect(screen.queryByTestId('resolved-empty')).toBeNull();

    listReply = () => jsonResponse(200, list([entry()]));
    await click(screen.getByTestId('back-to-today'));
    mount();
    await settle();
    expect(screen.getByTestId('resolved-empty')).toBeTruthy();
  });

  it('载入中 / 失败重试 / 401 / 卸载后不画', async () => {
    listReply = () => jsonResponse(500, { code: 'boom' });
    const v1 = mount();
    await settle();
    expect(screen.getByTestId('retry')).toBeTruthy();
    expect(readToken()).toBe(TOKEN);
    listReply = () => jsonResponse(200, list());
    await click(screen.getByTestId('retry'));
    expect(screen.getByTestId('entry-m1')).toBeTruthy();
    v1.unmount();

    listReply = () => jsonResponse(401, { code: 'token_revoked' });
    mount();
    await settle();
    expect(readToken()).toBeNull();
    expect(at()).toBe(ROUTES.login);
  });

  it('**卸载之后回来的响应画不上去**', async () => {
    let release: ((v: Response) => void) | null = null;
    listReply = () => new Promise<Response>((res) => { release = res; });
    const view = mount();
    await settle();
    view.unmount();
    await act(async () => {
      release?.({ ok: true, status: 200, text: () => Promise.resolve(JSON.stringify(list())) } as Response);
    });
    await settle();
    expect(document.body.textContent).not.toContain('The River Ferry');
  });
});

// ─────────────────────────────────────────────────────────────
// AC-05 —— 销账 / 恢复
// ─────────────────────────────────────────────────────────────

describe('AC-05 销账与恢复', () => {
  it('**要先确认才会发请求**，请求体恰好两个字段', async () => {
    mount();
    await settle();
    await click(screen.getByTestId('resolve-m1'));
    expect(calls('/vocab/mistakes/resolve')).toHaveLength(0);

    listReply = () => jsonResponse(200, list([entry({ resolved: true })]));
    await click(screen.getByTestId('confirm-resolve-m1'));
    const b = bodies('/vocab/mistakes/resolve')[0];
    expect(Object.keys(b).sort()).toEqual(['id', 'resolved']);
    expect(b.id).toBe('m1');
    expect(b.resolved).toBe(true);
  });

  it('**取消什么都不发**', async () => {
    mount();
    await settle();
    await click(screen.getByTestId('resolve-m1'));
    await click(screen.getByTestId('cancel-resolve-m1'));
    expect(calls('/vocab/mistakes/resolve')).toHaveLength(0);
    expect(screen.getByTestId('entry-m1')).toBeTruthy();
  });

  it('**成功之后重新取权威列表**，两段才跟着变', async () => {
    mount();
    await settle();
    expect(screen.getByTestId('unresolved-section').querySelector('[data-entry-id="m1"]')).toBeTruthy();
    reqs = [];
    listReply = () => jsonResponse(200, list([entry({ resolved: true, resolvedAt: '2026-08-30T00:00:00.000Z' })]));
    await click(screen.getByTestId('resolve-m1'));
    await click(screen.getByTestId('confirm-resolve-m1'));
    expect(calls('/vocab/mistakes')).toHaveLength(1);
    expect(screen.getByTestId('resolved-section').querySelector('[data-entry-id="m1"]')).toBeTruthy();
    expect(screen.getByTestId('unresolved-section').querySelector('[data-entry-id="m1"]')).toBeNull();
  });

  it('**`{updated:0}` 是失败**，行不许动', async () => {
    resolveReply = () => jsonResponse(200, { updated: 0 });
    mount();
    await settle();
    await click(screen.getByTestId('resolve-m1'));
    await click(screen.getByTestId('confirm-resolve-m1'));
    expect(screen.getByTestId('resolve-error-m1')).toBeTruthy();
    expect(screen.getByTestId('unresolved-section').querySelector('[data-entry-id="m1"]')).toBeTruthy();
    // **不许**因此重新拉列表当成成功
    expect(calls('/vocab/mistakes')).toHaveLength(1);
  });

  it('**同一 tick 连点两下只发一条**', async () => {
    mount();
    await settle();
    await click(screen.getByTestId('resolve-m1'));
    const btn = screen.getByTestId('confirm-resolve-m1');
    await act(async () => {
      btn.click();
      btn.click();
    });
    await settle();
    expect(calls('/vocab/mistakes/resolve')).toHaveLength(1);
  });

  it('**已销账那一段可以恢复**（resolved:false）', async () => {
    listReply = () => jsonResponse(200, list([entry({ resolved: true })]));
    mount();
    await settle();
    listReply = () => jsonResponse(200, list([entry({ resolved: false })]));
    await click(screen.getByTestId('restore-m1'));
    const b = bodies('/vocab/mistakes/resolve')[0];
    expect(b).toEqual({ id: 'm1', resolved: false });
    expect(screen.getByTestId('unresolved-section').querySelector('[data-entry-id="m1"]')).toBeTruthy();
  });

  it('**写成功但对账失败 → 明说要刷新，不拿旧数字当真相**', async () => {
    mount();
    await settle();
    listReply = () => jsonResponse(500, { code: 'boom' });
    await click(screen.getByTestId('resolve-m1'));
    await click(screen.getByTestId('confirm-resolve-m1'));
    expect(screen.getByTestId('reconcile-notice')).toBeTruthy();
    expect(screen.queryByTestId('mistakes-total')).toBeNull();
    expect(readToken()).toBe(TOKEN);
  });

  it('**销账时掉票 → 清票回登录页**', async () => {
    resolveReply = () => jsonResponse(401, { code: 'token_revoked' });
    mount();
    await settle();
    await click(screen.getByTestId('resolve-m1'));
    await click(screen.getByTestId('confirm-resolve-m1'));
    expect(readToken()).toBeNull();
    expect(at()).toBe(ROUTES.login);
  });
});

// ─────────────────────────────────────────────────────────────
// AC-05 —— 含糊失败的对账（POST 没有幂等键，不许盲目重发）
// ─────────────────────────────────────────────────────────────

describe('AC-05 含糊失败不许盲目重发', () => {
  it('**读回来发现已经是目标状态 → 当成成功**，不再写第二次', async () => {
    mount();
    await settle();
    const held = heldResolve();
    await click(screen.getByTestId('resolve-m1'));
    await click(screen.getByTestId('confirm-resolve-m1'));
    // 读回来时服务端其实已经写成功了
    listReply = () => jsonResponse(200, list([entry({ resolved: true })]));
    await act(async () => {
      held.fail();
    });
    await settle();

    expect(calls('/vocab/mistakes/resolve')).toHaveLength(1); // **没有第二次写**
    expect(screen.getByTestId('resolved-section').querySelector('[data-entry-id="m1"]')).toBeTruthy();
    expect(screen.queryByTestId('resolve-error-m1')).toBeNull();
  });

  it('**读回来还是老状态 → 允许重试**（但重试也得是学生点的）', async () => {
    mount();
    await settle();
    const held = heldResolve();
    await click(screen.getByTestId('resolve-m1'));
    await click(screen.getByTestId('confirm-resolve-m1'));
    listReply = () => jsonResponse(200, list([entry({ resolved: false })]));
    await act(async () => {
      held.fail();
    });
    await settle();

    expect(calls('/vocab/mistakes/resolve')).toHaveLength(1); // 仍然只有那一次
    expect(screen.getByTestId('resolve-error-m1')).toBeTruthy();
    expect(screen.getByTestId('unresolved-section').querySelector('[data-entry-id="m1"]')).toBeTruthy();

    resolveReply = () => jsonResponse(200, { updated: 1 });
    listReply = () => jsonResponse(200, list([entry({ resolved: true })]));
    await click(screen.getByTestId('confirm-resolve-m1'));
    expect(calls('/vocab/mistakes/resolve')).toHaveLength(2);
    expect(screen.getByTestId('resolved-section').querySelector('[data-entry-id="m1"]')).toBeTruthy();
  });

  it('**读回来也失败 → 停在失败闭锁态，绝不自动再写一次**', async () => {
    mount();
    await settle();
    const held = heldResolve();
    await click(screen.getByTestId('resolve-m1'));
    await click(screen.getByTestId('confirm-resolve-m1'));
    listReply = () => jsonResponse(500, { code: 'boom' });
    await act(async () => {
      held.fail();
    });
    await settle();

    expect(calls('/vocab/mistakes/resolve')).toHaveLength(1);
    expect(screen.getByTestId('reconcile-notice')).toBeTruthy();
  });
});
