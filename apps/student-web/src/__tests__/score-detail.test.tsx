/**
 * 阶段 11 —— 历史成绩详情（`/scores/:submissionId`）的**行为测试**。
 *
 * 挂的是**真的 `App`**，只在 `fetch` 打桩；**不 import 页面组件**，判据全是
 * 「挂到那条路由上之后做了什么」。
 *
 * 这一屏的硬规矩：
 *
 *   · **路径参数是唯一的选择器**。没有姓名查询、没有 `/lesson/today` 依赖、
 *     不读后端 `href`、不读本地存储。
 *   · **响应对不上就一个字都不显示**。`response.submissionId` 必须等于路由
 *     里的那个；不等、403、404、形状不对 —— 一律不渲染答案、不给申诉。
 *   · **不重算**。分数、对错、marks 全部照搬服务端；`scoresPending` /
 *     `answersPending` 未开时不补 0、不猜答案。
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { act, render, screen } from '@testing-library/react';
import { MemoryRouter, useLocation } from 'react-router-dom';
import App from '../App';
import { writeToken, readToken } from '../lib/identity';
import { __resetForTest } from '../lib/auth-store';
import { ROUTES } from '../routes.contract';

/** 与 `scores.test.tsx` 同理：路径写字面量，红在行为上而不是常量上。 */
const SCORES = '/scores';
const detailPath = (id: string) => `/scores/${encodeURIComponent(id)}`;

const PROFILE = { id: 't6_done', name: '测试六号', nickname: '六号', avatar: null };
const TOKEN = 'detail-token';

/** t6 自己的那份 */
const MINE = 'sub-t6';
/** t5 的那份 —— 拿它的 id 直闯，必须什么都看不到 */
const OTHERS = 'sub-t5';

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
// 夹具 —— 字段照 `getStudentResult` + `stripUnreleasedScores`
// ─────────────────────────────────────────────────────────────

const item = (over: Record<string, unknown> = {}) => ({
  paperQuestionId: 'pq-1',
  sortOrder: 1,
  marks: 1,
  questionType: 'mcq',
  snapshotContent: { stem: 'Why did the ferry stop?' },
  snapshotOptions: [
    { key: 'A', text: 'Engine trouble' },
    { key: 'B', text: 'Bad weather' },
  ],
  studentAnswer: 'A',
  correctAnswer: 'B',
  referenceAnswer: null,
  explanation: '第三段说是天气。',
  awardedMarks: 0,
  autoCorrect: false,
  isCorrect: false,
  markerComment: '再读一遍第三段。',
  commentSource: 'teacher',
  ...over,
});

const detail = (over: Record<string, unknown> = {}) => ({
  sessionId: 'sess-t6',
  paperName: 'The River Ferry',
  submissionId: MINE,
  status: 'marked',
  finalSubmittedAt: '2026-08-29T21:50:10.773Z',
  autoScore: 0,
  manualScore: null,
  totalScore: 0,
  maxScore: 4,
  submittedAt: '2026-08-29T21:50:10.773Z',
  items: [item()],
  scoresPending: false,
  answersPending: false,
  ...over,
});

// ─────────────────────────────────────────────────────────────
// 网络边界
// ─────────────────────────────────────────────────────────────

let detailReply: (submissionId: string | null) => Promise<Response>;
let appealReply: () => Promise<Response>;
let fetchMock: ReturnType<typeof vi.fn>;

function installFetch() {
  reqs = [];
  fetchMock = vi.fn((url: string, init: RequestInit = {}) => {
    const full = String(url).replace(/^.*\/api/, '');
    const path = full.split('?')[0];
    reqs.push({
      path: full,
      method: (init.method as string) ?? 'GET',
      headers: (init.headers as Record<string, string>) ?? {},
      body: init.body ? String(init.body) : null,
    });
    if (path === '/student-auth/me') return jsonResponse(200, { ...PROFILE, appVersion: 'v2' });
    if (path === '/morning-quiz/history-by-name') {
      return jsonResponse(200, { student: { name: PROFILE.name, matchedCount: 1, classes: [] }, submissions: [] });
    }
    if (path === '/vocab/quiz/attempts') return jsonResponse(200, { attempts: [] });
    if (path === '/morning-quiz/history-detail') {
      const q = new URLSearchParams(full.split('?')[1] ?? '');
      return detailReply(q.get('submissionId'));
    }
    if (path === '/morning-quiz/appeals') return appealReply();
    return jsonResponse(404, { code: 'not_stubbed', path: full });
  });
  vi.stubGlobal('fetch', fetchMock);
}

function LocationProbe() {
  const loc = useLocation();
  return <span data-testid="loc">{loc.pathname}</span>;
}

function mount(at: string = detailPath(MINE)) {
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
const detailCalls = () => calls('/morning-quiz/history-detail');
const appealCalls = () => calls('/morning-quiz/appeals');

async function click(el: HTMLElement) {
  await act(async () => {
    el.click();
  });
  await settle();
}

async function type(el: HTMLTextAreaElement, value: string) {
  const setter = Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, 'value')!.set!;
  await act(async () => {
    setter.call(el, value);
    el.dispatchEvent(new Event('input', { bubbles: true }));
  });
}

/** 「一个字的答案材料都没有」—— 这一屏最重要的那条判据。 */
function expectNoAnswerContent() {
  expect(screen.queryByTestId('items')).toBeNull();
  expect(screen.queryByTestId('appeal-whole-open')).toBeNull();
  expect(text()).not.toContain('Why did the ferry stop?');
  expect(text()).not.toContain('Engine trouble');
  expect(text()).not.toContain('再读一遍第三段');
}

beforeEach(() => {
  __resetForTest();
  localStorage.clear();
  writeToken(TOKEN);
  detailReply = () => jsonResponse(200, detail());
  appealReply = () => jsonResponse(201, { appealId: 'ap-1', status: 'open' });
  installFetch();
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

// ─────────────────────────────────────────────────────────────
// AC-04 —— API 与身份边界
// ─────────────────────────────────────────────────────────────

describe('AC-04 API 与身份边界', () => {
  it('**恰好一次 GET history-detail**，查询串里只有 submissionId', async () => {
    mount();
    await settle();

    expect(detailCalls()).toHaveLength(1);
    const c = detailCalls()[0];
    expect(c.method).toBe('GET');
    expect(c.headers.Authorization).toBe(`Bearer ${TOKEN}`);
    expect(c.body).toBeNull();
    const q = new URLSearchParams(c.path.split('?')[1] ?? '');
    expect([...q.keys()]).toEqual(['submissionId']);
    expect(q.get('submissionId')).toBe(MINE);
  });

  it('**不依赖 `/lesson/today`**，也不打列表那两个端点', async () => {
    mount();
    await settle();
    expect(calls('/lesson/today')).toHaveLength(0);
    expect(calls('/morning-quiz/history-by-name')).toHaveLength(0);
    expect(calls('/vocab/quiz/attempts')).toHaveLength(0);
  });

  it('**URL 里没有身份参数**，请求体也没有', async () => {
    mount();
    await settle();
    for (const r of reqs) {
      expect(r.path).not.toMatch(/[?&](name|studentName|studentId)=/);
      if (r.body) expect(r.body).not.toMatch(/"name"|"studentName"|"studentId"/);
    }
  });

  it('**submissionId 走 URL 编码**，特殊字符不许裸奔', async () => {
    const weird = 'sub a/b&c';
    detailReply = () => jsonResponse(200, detail({ submissionId: weird }));
    mount(detailPath(weird));
    await settle();
    const c = detailCalls()[0];
    expect(c.path).toContain(encodeURIComponent(weird));
    expect(c.path.split('?')[1]).toBe(`submissionId=${encodeURIComponent(weird)}`);
  });

  it('**路径参数是唯一的选择器** —— 换一个路由就换一个请求', async () => {
    detailReply = (id) => jsonResponse(200, detail({ submissionId: id }));
    mount(detailPath('sub-zzz'));
    await settle();
    expect(new URLSearchParams(detailCalls()[0].path.split('?')[1]).get('submissionId')).toBe('sub-zzz');
  });

  it('**不碰练习 / 趋势 / 能力画像 / 埋点**，也不写任何东西（除了申诉）', async () => {
    mount();
    await settle();
    for (const r of reqs) {
      expect(r.path).not.toMatch(/trend|weak|skill|upcoming|page-view|practice/);
      if (r.method !== 'GET') expect(r.path.split('?')[0]).toBe('/morning-quiz/appeals');
    }
    expect(appealCalls()).toHaveLength(0);
  });
});

// ─────────────────────────────────────────────────────────────
// AC-06 / AC-07 —— 归属与失败闭合
// ─────────────────────────────────────────────────────────────

describe('AC-06 归属校验', () => {
  it('**响应的 submissionId 对不上就什么都不渲染**', async () => {
    detailReply = () => jsonResponse(200, detail({ submissionId: 'sub-somebody-else' }));
    mount();
    await settle();
    expectNoAnswerContent();
    // 停在安全空态而不是**悄悄跳走** —— 跳走会让人以为「点错了」，
    // 而这里真正发生的是「这份不是你的」。出口另有一条按钮。
    expect(screen.getByTestId('detail-denied')).toBeTruthy();
    expect(screen.queryByTestId('retry')).toBeNull();
  });

  it('**拿 t5 的 submissionId 直闯**：服务端回 403，一个字都看不到', async () => {
    detailReply = (id) =>
      id === OTHERS ? jsonResponse(403, { code: 'name_mismatch' }) : jsonResponse(200, detail());
    mount(detailPath(OTHERS));
    await settle();
    expectNoAnswerContent();
    expect(screen.getByTestId('detail-denied')).toBeTruthy();
    expect(readToken()).toBe(TOKEN); // 403 不是掉票
  });

  it('**即使服务端错发了 t5 的那一份**，路由对不上也不渲染', async () => {
    detailReply = () => jsonResponse(200, detail({ submissionId: OTHERS, paperName: '别人的卷子' }));
    mount(detailPath(MINE));
    await settle();
    expectNoAnswerContent();
    expect(text()).not.toContain('别人的卷子');
  });

  it('**submission 不存在** → 安全的空态，不回落到姓名查询', async () => {
    detailReply = () => jsonResponse(404, { code: 'submission_not_found' });
    mount();
    await settle();
    expectNoAnswerContent();
    expect(screen.getByTestId('detail-denied')).toBeTruthy();
    for (const r of reqs) expect(r.path).not.toMatch(/name=/);
  });

  it('**响应形状不对**（少 submissionId / items 不是数组）也不渲染', async () => {
    detailReply = () => jsonResponse(200, { paperName: 'x', items: 'nope' });
    mount();
    await settle();
    expectNoAnswerContent();
  });

  it('**401 清票回登录页**', async () => {
    detailReply = () => jsonResponse(401, { code: 'token_revoked' });
    mount();
    await settle();
    expect(readToken()).toBeNull();
    expect(at()).toBe(ROUTES.login);
  });

  it('网络故障 → 留在这一页给一个重试，**票不丢**', async () => {
    detailReply = () => jsonResponse(500, { code: 'boom' });
    mount();
    await settle();
    expect(screen.getByTestId('retry')).toBeTruthy();
    expect(readToken()).toBe(TOKEN);

    detailReply = () => jsonResponse(200, detail());
    await click(screen.getByTestId('retry'));
    expect(screen.getByTestId('items')).toBeTruthy();
  });
});

// ─────────────────────────────────────────────────────────────
// AC-06 —— 逐题回顾，全部照搬服务端
// ─────────────────────────────────────────────────────────────

describe('AC-06 逐题回顾', () => {
  it('题干 / 我的答案 / 正确答案 / 得分 / 评语**都来自响应**', async () => {
    mount();
    await settle();
    expect(text()).toContain('The River Ferry');
    expect(text()).toContain('Why did the ferry stop?');
    expect(screen.getByTestId('student-answer-pq-1').textContent).toBe('A');
    expect(screen.getByTestId('answer-row-correct-pq-1').textContent).toContain('B');
    expect(screen.getByTestId('marks-pq-1').textContent).toContain('0 / 1');
    expect(screen.getByTestId('comment-pq-1').textContent).toContain('再读一遍第三段');
    expect(screen.getByTestId('explanation-pq-1').textContent).toContain('第三段说是天气');
  });

  it('**分数照搬**：0 分就是 0 分，不重算', async () => {
    mount();
    await settle();
    expect(screen.getByTestId('score').textContent).toBe('0');
    expect(text()).toContain('/ 4 分');
  });

  /**
   * 返工 1/2 —— B-1。
   *
   * `history-detail` **不返回百分比**（服务端只给 totalScore / maxScore）。
   * 那么这一页就不能显示百分比：显示出来的那个数是前端自己除出来的，
   * 服务端从没说过。今日总结那一屏为此立过同一条规矩（用服务端的
   * `percentage`，不拿 `correct / total` 重算），历史成绩不能例外。
   *
   * 交完卷那一屏（`/lesson/reading/result`）的既有行为**不动** ——
   * 那是冻结过的，`reading-result.test.tsx` 仍然断言它显示 60%。
   */
  it('**不显示任何自己算出来的百分比**（服务端没给，就没有）', async () => {
    detailReply = () =>
      jsonResponse(200, detail({
        // 故意让 1/4 这个比例好算 —— 真去除的话屏幕上会冒出 25%
        totalScore: 1,
        autoScore: 1,
        maxScore: 4,
        items: [item({ awardedMarks: 1, isCorrect: true, studentAnswer: 'B' })],
      }));
    mount();
    await settle();

    // 服务端给的两个数照常显示
    expect(screen.getByTestId('score').textContent).toBe('1');
    expect(text()).toContain('/ 4 分');
    // 派生出来的那个数一个都不许出现
    expect(screen.queryByTestId('percentage')).toBeNull();
    expect(text()).not.toContain('25%');
    expect(text()).not.toMatch(/\d+\s*%/);
  });

  it('**分数还没放出来时同样没有百分比**', async () => {
    detailReply = () =>
      jsonResponse(200, detail({ scoresPending: true, totalScore: null, autoScore: null }));
    mount();
    await settle();
    expect(screen.queryByTestId('percentage')).toBeNull();
    expect(text()).not.toMatch(/\d+\s*%/);
  });

  it('**还在判分**：不显示分数、不补 0、不显示 marks', async () => {
    detailReply = () =>
      jsonResponse(200, detail({
        scoresPending: true,
        totalScore: null,
        autoScore: null,
        manualScore: null,
        items: [item({ awardedMarks: null, isCorrect: null, autoCorrect: null, markerComment: null })],
      }));
    mount();
    await settle();
    expect(screen.getByTestId('scores-pending')).toBeTruthy();
    expect(screen.queryByTestId('score')).toBeNull();
    expect(screen.queryByTestId('marks-pq-1')).toBeNull();
  });

  it('**答案还没公布**：一个答案字段都不显示', async () => {
    detailReply = () =>
      jsonResponse(200, detail({
        answersPending: true,
        items: [item({ correctAnswer: null, referenceAnswer: null, explanation: null })],
      }));
    mount();
    await settle();
    expect(screen.getByTestId('answers-pending')).toBeTruthy();
    expect(screen.queryByTestId('answer-row-correct-pq-1')).toBeNull();
    expect(screen.queryByTestId('explanation-pq-1')).toBeNull();
  });
});

// ─────────────────────────────────────────────────────────────
// AC-06 —— 申诉
// ─────────────────────────────────────────────────────────────

describe('AC-06 申诉', () => {
  async function openWholeAppeal() {
    mount();
    await settle();
    await click(screen.getByTestId('appeal-whole-open'));
    return screen.getByTestId('appeal-whole-input') as HTMLTextAreaElement;
  }

  it('**整卷申诉的请求体恰好两个字段**，submissionId 来自校验过的那条链', async () => {
    const box = await openWholeAppeal();
    await type(box, '这次判分我有疑问，请老师复核。');
    await click(screen.getByTestId('appeal-whole-submit'));

    expect(appealCalls()).toHaveLength(1);
    const body = JSON.parse(appealCalls()[0].body ?? '{}');
    expect(Object.keys(body).sort()).toEqual(['message', 'submissionId']);
    expect(body.submissionId).toBe(MINE);
    expect(appealCalls()[0].path).toBe('/morning-quiz/appeals'); // 没有查询串
    expect(screen.getByTestId('appeal-whole-sent')).toBeTruthy();
  });

  it('**空内容不发请求**', async () => {
    const box = await openWholeAppeal();
    await type(box, '   ');
    await click(screen.getByTestId('appeal-whole-submit'));
    expect(appealCalls()).toHaveLength(0);
    expect(screen.getByTestId('appeal-whole-invalid')).toBeTruthy();
  });

  it('**连点两下只发一条**', async () => {
    const box = await openWholeAppeal();
    await type(box, '同一 tick 连点两下，只能有一条。');
    const btn = screen.getByTestId('appeal-whole-submit');
    await act(async () => {
      btn.click();
      btn.click();
    });
    await settle();
    expect(appealCalls()).toHaveLength(1);
  });

  it('**逐题申诉带上 paperQuestionId**', async () => {
    mount();
    await settle();
    await click(screen.getByTestId('appeal-q-pq-1-open'));
    await type(screen.getByTestId('appeal-q-pq-1-input') as HTMLTextAreaElement, '这题我觉得判错了。');
    await click(screen.getByTestId('appeal-q-pq-1-submit'));
    const body = JSON.parse(appealCalls()[0].body ?? '{}');
    expect(Object.keys(body).sort()).toEqual(['message', 'paperQuestionId', 'submissionId']);
    expect(body.paperQuestionId).toBe('pq-1');
    expect(body.submissionId).toBe(MINE);
  });

  it('申诉失败之后可以再试一次', async () => {
    appealReply = () => jsonResponse(500, { code: 'boom' });
    const box = await openWholeAppeal();
    await type(box, '先失败一次，再成功一次。');
    await click(screen.getByTestId('appeal-whole-submit'));
    expect(screen.getByTestId('appeal-whole-error')).toBeTruthy();

    appealReply = () => jsonResponse(201, { appealId: 'ap-2', status: 'open' });
    await click(screen.getByTestId('appeal-whole-submit'));
    expect(appealCalls()).toHaveLength(2);
    expect(screen.getByTestId('appeal-whole-sent')).toBeTruthy();
  });

  it('**申诉时掉票 → 清票回登录页**', async () => {
    appealReply = () => jsonResponse(401, { code: 'token_revoked' });
    const box = await openWholeAppeal();
    await type(box, '掉票的时候不该假装提交成功。');
    await click(screen.getByTestId('appeal-whole-submit'));
    expect(readToken()).toBeNull();
    expect(at()).toBe(ROUTES.login);
  });
});

// ─────────────────────────────────────────────────────────────
// AC-03 / AC-07 —— 出口与旧路由
// ─────────────────────────────────────────────────────────────

describe('AC-03 出口', () => {
  it('**回历史成绩**', async () => {
    mount();
    await settle();
    await click(screen.getByTestId('back-to-scores'));
    expect(at()).toBe(SCORES);
  });

  it('拒绝态下也有一条回历史成绩的出口', async () => {
    detailReply = () => jsonResponse(403, { code: 'name_mismatch' });
    mount(detailPath(OTHERS));
    await settle();
    await click(screen.getByTestId('back-to-scores'));
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
