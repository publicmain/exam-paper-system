/**
 * S7D —— 阅读全链本地集成验证。
 *
 * 挂的是**真的 `App`**：真路由、真 auth-store（含 bootstrap）、真 Today 页、
 * 真 Reading 页、真 API 客户端、真 ReadingProvider、真渲染器注册表。
 * 只有 `fetch` 这一层是打桩的，内容来自**仓库里已提交的真实阅读夹具**。
 *
 * 本地只播下一个 `sw:token` —— 身份不从 props、URL 或请求体注入。
 *
 * 证据层级：jsdom 里的整应用 + 模拟的浏览器 / 网络事件。
 * **不声称**真实浏览器、真实 API、staging、数据库或真机。
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { act, render, screen } from '@testing-library/react';
import { MemoryRouter, useLocation } from 'react-router-dom';
import App from '../App';
import { adoptSession, __resetForTest } from '../lib/auth-store';
import { writeToken } from '../lib/identity';
import {
  READING_FIXTURE_PATH,
  TEACHER_ONLY_KEYS,
  fixtureToWireQuestions,
  loadFixture,
} from './fixtures/readingFixture';

const TOKEN = 'integration-token';
const PROFILE = { id: 's7', name: '测试七号', nickname: '七号', avatar: null };
const SESSION_ID = 'sess-integration';
const SUBMISSION_ID = 'sub-integration';

const FX = loadFixture();
const WIRE_QUESTIONS = fixtureToWireQuestions(FX);

const ANSWERS_KEY = `sw:reading:answers:${SESSION_ID}:${SUBMISSION_ID}`;
const SEQS_KEY = `sw:reading:seqs:${SESSION_ID}:${SUBMISSION_ID}`;

// ─────────────────────────────────────────────────────────────
// 网络边界
// ─────────────────────────────────────────────────────────────

type Req = { path: string; method: string; headers: Record<string, string>; body: string | null };

let reqs: Req[] = [];

/** `/lesson/today` 的当前回答 —— 链路推进时它会变。 */
let todayBody: Record<string, unknown>;
/** 每条路由的处理器；返回 null 表示「用默认」。 */
let overrides: Record<string, (req: Req) => { status?: number; body: unknown } | null>;

function readSegment(over: Record<string, unknown> = {}) {
  return {
    key: 'read',
    status: 'todo',
    label: FX.passageTitle,
    questionCount: WIRE_QUESTIONS.length,
    typicalMinutes: 20,
    score: null,
    maxScore: null,
    scoresPending: false,
    submissionId: null,
    sessionId: null,
    autoClosed: false,
    ...over,
  };
}

function lessonToday(over: Record<string, unknown> = {}, readOver: Record<string, unknown> = {}) {
  return {
    student: { id: PROFILE.id, name: PROFILE.name },
    date: '2026-08-28',
    nextAction: { kind: 'ready_to_start', label: '开始今天的课程', href: null },
    rulesVersion: 4,
    completed: 0,
    total: 3,
    allDone: false,
    streakDays: 0,
    targetsFrozenAt: null,
    stage: 'ready_to_start',
    stageAt: null,
    vocabCursor: 0,
    segments: [
      readSegment(readOver),
      { key: 'vocab', status: 'todo', progress: 0, target: 4, typicalMinutes: 2, quizScore: { status: 'not_started' } },
      { key: 'drill', status: 'none', progress: 0, target: 0, typicalMinutes: 2 },
    ],
    ...over,
  };
}

/** 会话载荷 —— 用**真实夹具**转出来的题目，且不带任何老师侧字段。 */
function sessionWire(over: Record<string, unknown> = {}) {
  return {
    sessionId: SESSION_ID,
    submissionId: SUBMISSION_ID,
    quizEnd: new Date(Date.now() + 40 * 60_000).toISOString(),
    regularQuizEnd: new Date(Date.now() - 60_000).toISOString(),
    secondWindowToday: false,
    level: FX.level,
    paperMode: 'passage_pick',
    mode: 'test',
    paperQuestions: WIRE_QUESTIONS,
    existingAnswers: {},
    ...over,
  };
}

function installFetch() {
  reqs = [];
  vi.stubGlobal(
    'fetch',
    vi.fn(async (url: string, init: RequestInit = {}) => {
      const path = url.replace(/^.*\/api/, '');
      const req: Req = {
        path,
        method: (init.method as string) ?? 'GET',
        headers: (init.headers as Record<string, string>) ?? {},
        body: init.body ? String(init.body) : null,
      };
      reqs.push(req);
      const custom = overrides[path]?.(req);
      const reply = custom ?? defaultReply(req);
      if (reply instanceof Error) throw reply;
      const status = reply.status ?? 200;
      return {
        ok: status >= 200 && status < 300,
        status,
        text: async () => JSON.stringify(reply.body),
      } as unknown as Response;
    }),
  );
}

function defaultReply(req: Req): { status?: number; body: unknown } {
  if (req.path === '/student-auth/me') return { body: { ...PROFILE, appVersion: 'v2' } };
  if (req.path === '/lesson/today') return { body: todayBody };
  if (req.path === '/lesson/start') {
    // 服务端建卷 —— 之后 today 的 read 段就带上 sessionId / submissionId
    todayBody = lessonToday(
      { nextAction: { kind: 'resume_reading', label: '继续阅读', href: '/morning-quiz/legacy' } },
      { sessionId: SESSION_ID, submissionId: SUBMISSION_ID, status: 'partial' },
    );
    return { body: todayBody };
  }
  if (req.path === `/morning-quiz/sessions/${SESSION_ID}`) return { body: sessionWire() };
  if (req.path === `/morning-quiz/sessions/${SESSION_ID}/answer`) {
    const seq = JSON.parse(req.body ?? '{}').clientSeq;
    return { body: { applied: true, clientSeq: seq } };
  }
  if (req.path === `/morning-quiz/sessions/${SESSION_ID}/submit`) {
    return { body: { id: SUBMISSION_ID, status: 'submitted' } };
  }
  return { status: 404, body: { code: 'not_stubbed', path: req.path } };
}

// ─────────────────────────────────────────────────────────────
// 挂载真应用
// ─────────────────────────────────────────────────────────────

function LocationProbe() {
  const loc = useLocation();
  return <span data-testid="loc">{loc.pathname}</span>;
}

function mountApp(at = '/today') {
  return render(
    <MemoryRouter initialEntries={[at]}>
      <App />
      <LocationProbe />
    </MemoryRouter>,
  );
}

const at = () => screen.getByTestId('loc').textContent;
const paths = (p: string) => reqs.filter((r) => r.path === p);
const authed = () => reqs.filter((r) => r.path !== '/student-auth/login');

async function settle(rounds = 12) {
  await act(async () => {
    for (let i = 0; i < rounds; i++) await Promise.resolve();
  });
}
async function tick(ms: number) {
  await act(async () => {
    vi.advanceTimersByTime(ms);
    await Promise.resolve();
  });
}
async function click(el: HTMLElement) {
  await act(async () => {
    el.click();
  });
  await settle();
}

/** 走完「登录态启动 → /today → 开始上课 → 阅读页渲染完」。 */
async function openReading() {
  mountApp('/today');
  await settle();
  await click(screen.getByRole('button', { name: '开始今天的课程' }));
  await settle();
}

beforeEach(() => {
  __resetForTest();
  localStorage.clear();
  vi.useFakeTimers();
  Object.defineProperty(navigator, 'onLine', { value: true, configurable: true });
  todayBody = lessonToday();
  overrides = {};
  installFetch();
  // **只播一个令牌** —— 身份不从别处来
  writeToken(TOKEN);
});

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

// ─────────────────────────────────────────────────────────────
// AC-02 / AC-03 / AC-04 / AC-10 —— 整链 + 真实夹具 + 请求卫生
// ─────────────────────────────────────────────────────────────

describe('AC-02/03/04/10 全链：启动 → today → 开课 → 阅读页 → 真实夹具', () => {
  it('**完整链路跑通，请求顺序与方法逐条对上**', async () => {
    await openReading();

    expect(at()).toBe('/lesson/reading');
    const trace = reqs.map((r) => `${r.method} ${r.path}`);
    expect(trace.slice(0, 5)).toEqual([
      'GET /student-auth/me',
      'GET /lesson/today',
      'POST /lesson/start',
      'GET /lesson/today',
      `GET /morning-quiz/sessions/${SESSION_ID}`,
    ]);
    // `/lesson/start` 的请求体**恰好**是 { begin: true }
    expect(JSON.parse(paths('/lesson/start')[0].body!)).toEqual({ begin: true });
  });

  it('**每个认证后请求都带 Bearer，且零身份 / 零旧参数**', async () => {
    await openReading();
    expect(authed().length).toBeGreaterThan(3);
    for (const r of authed()) {
      expect(r.headers.Authorization, r.path).toBe(`Bearer ${TOKEN}`);
      expect(r.path).not.toMatch(/[?&#]/);
      expect(r.path).not.toMatch(/name=|studentId=|then=|after=|adoptHandoff/);
      if (r.body) {
        expect(r.body, r.path).not.toMatch(/"name"|"studentName"|"studentId"/);
      }
    }
  });

  it('**真实夹具经真注册表渲染出来**：段落 / 指令 / 题数都在', async () => {
    await openReading();
    // 标题与正文首段
    expect(screen.getByText(FX.passageTitle)).toBeInTheDocument();
    expect(screen.getByText(/sponge divers sheltering from a storm/)).toBeInTheDocument();
    // 四类任务的分组标题
    for (const title of ['Matching Information', 'True / False / Not Given', 'Sentence Completion']) {
      expect(screen.getAllByText(new RegExp(title, 'i')).length, title).toBeGreaterThan(0);
    }
    // 题号条的格子数 === 夹具题数
    expect(screen.getAllByRole('button', { name: /^Question \d+,/ })).toHaveLength(
      WIRE_QUESTIONS.length,
    );
    expect(WIRE_QUESTIONS).toHaveLength(13);
  });

  it('**学生响应里没有任何老师侧字段**（答案键在测试侧就被剥掉了）', async () => {
    await openReading();
    const raw = JSON.stringify(sessionWire());
    for (const k of TEACHER_ONLY_KEYS) {
      expect(raw, k).not.toContain(`"${k}"`);
    }
    // 夹具本体确实带着这些 —— 证明上面的断言不是空的
    const fixtureRaw = JSON.stringify(FX);
    expect(fixtureRaw).toContain('"answer"');
    expect(fixtureRaw).toContain('"correct"');
    expect(READING_FIXTURE_PATH).toMatch(/test-fixtures[\\/]ielts-authored-2026-v3/);
  });

  it('**test 模式：屏幕上没有答案键、没有对错反馈**', async () => {
    await openReading();
    const text = document.body.textContent ?? '';
    expect(text).not.toMatch(/Correct answer|✓ Correct|✗ Correct/);
    // 夹具里 Q5 的正确答案是 FALSE —— 但不该有任何「这是答案」的标注
    expect(screen.queryByText(/正确答案|correct: true/i)).not.toBeInTheDocument();
  });

  it('**每个可编辑控件都有无障碍名字**', async () => {
    await openReading();
    const boxes = screen.getAllByRole('textbox');
    expect(boxes.length).toBeGreaterThan(0);
    for (const el of boxes) {
      const label =
        el.getAttribute('aria-label') ??
        (el.getAttribute('id')
          ? document.querySelector(`label[for="${el.getAttribute('id')}"]`)?.textContent
          : null);
      expect(label, el.outerHTML.slice(0, 120)).toBeTruthy();
    }
    for (const radio of screen.getAllByRole('radio')) {
      expect(radio.closest('label')?.textContent?.trim()).toBeTruthy();
    }
  });

  it('**全程没有打过任何查词 / 姓名 / 旧端端点**', async () => {
    await openReading();
    for (const r of reqs) {
      expect(r.path).not.toMatch(/\/vocab\/|my-history|\/scan|student-lookup|history-by-name/);
    }
  });
});

// ─────────────────────────────────────────────────────────────
// AC-05 —— 作答与自动保存的接缝
// ─────────────────────────────────────────────────────────────

describe('AC-05 作答 → 自动保存', () => {
  const answerCalls = () => paths(`/morning-quiz/sessions/${SESSION_ID}/answer`);

  it('**填空 + 选项各答一题：字段、序号、去重都对**', async () => {
    await openReading();

    // ① 填空题（Q9，sentence_completion）
    const box = screen.getAllByRole('textbox')[0] as HTMLInputElement;
    await act(async () => {
      const setter = Object.getOwnPropertyDescriptor(
        window.HTMLInputElement.prototype,
        'value',
      )!.set!;
      setter.call(box, 'divers');
      box.dispatchEvent(new Event('input', { bubbles: true }));
    });
    await tick(700);
    await settle();

    expect(answerCalls()).toHaveLength(1);
    const first = JSON.parse(answerCalls()[0].body!);
    expect(first.paperQuestionId).toMatch(/^pq-\d+$/);
    expect(first.textAnswer).toBe('divers');
    expect(first.selectedOption).toBeNull();
    expect(first.clientSeq).toBe(1);

    // ② 选项题（TFNG）—— 双写 selectedOption + textAnswer
    await act(async () => {
      (screen.getAllByRole('radio')[0] as HTMLInputElement).click();
    });
    await tick(700);
    await settle();

    expect(answerCalls()).toHaveLength(2);
    const second = JSON.parse(answerCalls()[1].body!);
    expect(second.selectedOption).toBe('A');
    expect(second.textAnswer).toBe('TRUE');
    expect(second.clientSeq).toBe(1); // 另一题，自己的序号从 1 起
    expect(second.paperQuestionId).not.toBe(first.paperQuestionId);

    // ③ 落定之后没有待办 —— 交卷按钮可用
    expect((screen.getByTestId('submit') as HTMLButtonElement).disabled).toBe(false);

    // ④ 同一题再改一次 → 序号单调递增
    await act(async () => {
      (screen.getAllByRole('radio')[1] as HTMLInputElement).click();
    });
    await tick(700);
    await settle();
    const third = JSON.parse(answerCalls()[2].body!);
    expect(third.paperQuestionId).toBe(second.paperQuestionId);
    expect(third.clientSeq).toBe(2);

    // ⑤ 没有重复请求：再推进时间也不会凭空多发
    await tick(5000);
    expect(answerCalls()).toHaveLength(3);
  });
});

// ─────────────────────────────────────────────────────────────
// AC-06 —— 离线 / 重连的接缝
// ─────────────────────────────────────────────────────────────

describe('AC-06 离线编辑 → 重连补传', () => {
  const answerCalls = () => paths(`/morning-quiz/sessions/${SESSION_ID}/answer`);

  it('**断网时答案已落盘、交卷被挡；重连只补传最新的那次，序号不变**', async () => {
    await openReading();

    // ① 先成功保存一次
    await act(async () => {
      (screen.getAllByRole('radio')[0] as HTMLInputElement).click();
    });
    await tick(700);
    await settle();
    expect(answerCalls()).toHaveLength(1);
    const qid = JSON.parse(answerCalls()[0].body!).paperQuestionId;

    // ② 断网：保存请求按网络故障失败
    overrides[`/morning-quiz/sessions/${SESSION_ID}/answer`] = () => {
      throw new TypeError('Failed to fetch');
    };
    await act(async () => {
      Object.defineProperty(navigator, 'onLine', { value: false, configurable: true });
      window.dispatchEvent(new Event('offline'));
    });
    expect(screen.getByText(/离线/)).toBeInTheDocument();

    // ③ 断网期间再改一次
    await act(async () => {
      (screen.getAllByRole('radio')[1] as HTMLInputElement).click();
    });
    await tick(700);
    await settle();
    const failedAt = answerCalls().length;

    // ④ 最新答案与序号**已经在本地**
    expect(JSON.parse(localStorage.getItem(ANSWERS_KEY)!)[qid]).toEqual({
      selectedOption: 'B',
      textAnswer: 'FALSE',
    });
    expect(JSON.parse(localStorage.getItem(SEQS_KEY)!)[qid]).toBe(2);

    // ⑤ 交卷被挡住
    expect((screen.getByTestId('submit') as HTMLButtonElement).disabled).toBe(true);
    expect(screen.getByTestId('save-error')).toBeInTheDocument();

    // ⑥ 没有无限重试
    await tick(120_000);
    expect(answerCalls()).toHaveLength(failedAt);

    // ⑦ 重连 → 只补传最新那次，且沿用同一个序号
    delete overrides[`/morning-quiz/sessions/${SESSION_ID}/answer`];
    await act(async () => {
      Object.defineProperty(navigator, 'onLine', { value: true, configurable: true });
      window.dispatchEvent(new Event('online'));
    });
    await settle();

    expect(answerCalls()).toHaveLength(failedAt + 1);
    const replay = JSON.parse(answerCalls()[failedAt].body!);
    expect(replay.paperQuestionId).toBe(qid);
    expect(replay.selectedOption).toBe('B');
    expect(replay.clientSeq).toBe(2);

    // ⑧ 补传被确认之后，报错与待办才清掉
    expect(screen.queryByTestId('save-error')).not.toBeInTheDocument();
    expect((screen.getByTestId('submit') as HTMLButtonElement).disabled).toBe(false);
  });
});

// ─────────────────────────────────────────────────────────────
// AC-07 —— 刷新 / 续答的接缝
// ─────────────────────────────────────────────────────────────

describe('AC-07 本地更新的草稿在重新进入后仍然赢', () => {
  const answerCalls = () => paths(`/morning-quiz/sessions/${SESSION_ID}/answer`);

  it('**服务端更旧 → 本地赢并补传；换账号后别人继承不到**', async () => {
    // ① 先在本地留一份「比服务端新」的草稿
    const qid = WIRE_QUESTIONS[4].id; // Q5，TFNG
    localStorage.setItem(ANSWERS_KEY, JSON.stringify({ [qid]: { selectedOption: 'C', textAnswer: 'NOT GIVEN' } }));
    localStorage.setItem(SEQS_KEY, JSON.stringify({ [qid]: 9 }));

    // ② 服务端手里是更旧的那份
    overrides[`/morning-quiz/sessions/${SESSION_ID}`] = () => ({
      body: sessionWire({
        existingAnswers: {
          [qid]: { content: 'A', selectedOption: 'A', textAnswer: 'TRUE', clientSeq: 3, flagged: false },
        },
      }),
    });
    todayBody = lessonToday(
      { nextAction: { kind: 'resume_reading', label: '继续阅读', href: null } },
      { sessionId: SESSION_ID, submissionId: SUBMISSION_ID, status: 'partial' },
    );

    // ③ 直接从 /lesson/reading 进（相当于刷新 / 重新打开）
    const { unmount } = mountApp('/lesson/reading');
    await settle();

    // 本地那份赢了：选中的是 NOT GIVEN，不是服务端的 TRUE
    const radios = screen.getAllByRole('radio') as HTMLInputElement[];
    const checked = radios.filter((r) => r.checked);
    expect(checked).toHaveLength(1);
    expect(checked[0].closest('label')?.textContent).toMatch(/NOT GIVEN/);

    // ④ 而且被补传上去，序号沿用本地的 9
    await settle();
    expect(answerCalls()).toHaveLength(1);
    const sent = JSON.parse(answerCalls()[0].body!);
    expect(sent.paperQuestionId).toBe(qid);
    expect(sent.selectedOption).toBe('C');
    expect(sent.clientSeq).toBe(9);

    // ⑤ 换账号 —— 走真实的身份替换路径
    unmount();
    expect(localStorage.getItem(ANSWERS_KEY)).not.toBeNull();
    act(() => {
      adoptSession('another-students-token', { id: 's8', name: '测试八号', nickname: '八号', avatar: null });
    });
    expect(localStorage.getItem(ANSWERS_KEY)).toBeNull();
    expect(localStorage.getItem(SEQS_KEY)).toBeNull();
    expect(Object.keys(localStorage)).toEqual(['sw:token']);
  });
});

// ─────────────────────────────────────────────────────────────
// AC-08 —— 交卷与路由的接缝
// ─────────────────────────────────────────────────────────────

describe('AC-08 交卷 → 刷 today → 按 kind 路由', () => {
  const submitCalls = () => paths(`/morning-quiz/sessions/${SESSION_ID}/submit`);

  it('**二次确认 → 一个 submit → 刷 today → 落到结果页占位**', async () => {
    await openReading();

    // 先答一题并落盘 —— 页面在有待办写入时**根本不让点交卷**（按钮 disabled），
    // 所以「先落盘、后交卷」这条顺序在 UI 层是硬约束，下面再用请求顺序钉一次。
    await act(async () => {
      (screen.getAllByRole('radio')[0] as HTMLInputElement).click();
    });
    expect((screen.getByTestId('submit') as HTMLButtonElement).disabled).toBe(true);
    await tick(700);
    await settle();
    expect((screen.getByTestId('submit') as HTMLButtonElement).disabled).toBe(false);

    await click(screen.getByTestId('submit'));
    expect(submitCalls()).toHaveLength(0); // 只是弹确认，还没发
    expect(screen.getByRole('dialog')).toBeInTheDocument();

    // 交卷后 today 改口：去看结果，且塞一个恶意 href
    todayBody = lessonToday(
      {
        nextAction: { kind: 'read_result', label: '看结果', href: '/my-history?name=测试七号' },
      },
      { sessionId: SESSION_ID, submissionId: SUBMISSION_ID, status: 'done' },
    );

    const beforeToday = paths('/lesson/today').length;
    await click(screen.getByRole('button', { name: /确认交卷/ }));

    // flush 先把那题落了盘，再发 submit
    const answerIdx = reqs.findIndex((r) => r.path.endsWith('/answer'));
    const submitIdx = reqs.findIndex((r) => r.path.endsWith('/submit'));
    expect(answerIdx).toBeGreaterThan(-1);
    expect(answerIdx).toBeLessThan(submitIdx);

    expect(submitCalls()).toHaveLength(1);
    expect(submitCalls()[0].method).toBe('POST');
    expect(JSON.parse(submitCalls()[0].body!)).toEqual({ final: true });

    // 交卷之后又刷了一次 today
    expect(paths('/lesson/today').length).toBe(beforeToday + 1);

    // 按 kind 路由 —— href 被忽略
    expect(at()).toBe('/lesson/reading/result');
    expect(screen.getByRole('heading', { name: '阅读结果' })).toBeInTheDocument();
    for (const r of reqs) {
      expect(r.path).not.toMatch(/my-history|scan/);
    }
  });

  it('**连点确认只发一个 submit**', async () => {
    await openReading();
    await click(screen.getByTestId('submit'));
    const btn = screen.getByRole('button', { name: /确认交卷/ });
    await act(async () => {
      btn.click();
      btn.click();
      btn.click();
    });
    await settle();
    expect(submitCalls()).toHaveLength(1);
  });

  it('**还有没保存好的答案时，连确认按钮都点不到**（交卷被禁用）', async () => {
    await openReading();
    overrides[`/morning-quiz/sessions/${SESSION_ID}/answer`] = () => ({ status: 500, body: {} });
    await act(async () => {
      (screen.getAllByRole('radio')[0] as HTMLInputElement).click();
    });
    await tick(700);
    await settle();
    expect((screen.getByTestId('submit') as HTMLButtonElement).disabled).toBe(true);
    expect(submitCalls()).toHaveLength(0);
  });
});

// ─────────────────────────────────────────────────────────────
// AC-09 —— 故障边界
// ─────────────────────────────────────────────────────────────

describe('AC-09 故障边界', () => {
  it('**令牌被撤销 → 走既有登出路径，回登录页并清票**', async () => {
    overrides['/lesson/today'] = () => ({ status: 401, body: { code: 'token_revoked' } });
    mountApp('/today');
    await settle();
    expect(at()).toBe('/login');
    expect(localStorage.getItem('sw:token')).toBeNull();
  });

  it('**会话加载失败 → 页面上可重试并恢复**', async () => {
    todayBody = lessonToday(
      { nextAction: { kind: 'resume_reading', label: '继续阅读', href: null } },
      { sessionId: SESSION_ID, submissionId: SUBMISSION_ID },
    );
    overrides[`/morning-quiz/sessions/${SESSION_ID}`] = () => ({ status: 500, body: {} });
    mountApp('/lesson/reading');
    await settle();
    expect(screen.getByRole('alert')).toBeInTheDocument();

    delete overrides[`/morning-quiz/sessions/${SESSION_ID}`];
    await click(screen.getByRole('button', { name: /重试/ }));
    expect(screen.getByText(FX.passageTitle)).toBeInTheDocument();
    expect(at()).toBe('/lesson/reading');
  });

  it('**保存失败：挡住交卷，但看得见的答案与本地缓存都还在**', async () => {
    await openReading();
    overrides[`/morning-quiz/sessions/${SESSION_ID}/answer`] = () => ({ status: 500, body: {} });
    await act(async () => {
      (screen.getAllByRole('radio')[0] as HTMLInputElement).click();
    });
    await tick(700);
    await settle();
    const radios = screen.getAllByRole('radio') as HTMLInputElement[];
    expect(radios[0].checked).toBe(true); // 屏幕上还在
    expect(localStorage.getItem(ANSWERS_KEY)).not.toBeNull(); // 本地也还在
    expect((screen.getByTestId('submit') as HTMLButtonElement).disabled).toBe(true);
  });

  it('**交卷报别的错 → 留在阅读页并报错，不跳走**', async () => {
    await openReading();
    overrides[`/morning-quiz/sessions/${SESSION_ID}/submit`] = () => ({
      status: 400,
      body: { code: 'quiz_window_closed' },
    });
    await click(screen.getByTestId('submit'));
    await click(screen.getByRole('button', { name: /确认交卷/ }));
    expect(at()).toBe('/lesson/reading');
    expect(screen.getByTestId('submit-error')).toBeInTheDocument();
  });

  it('**「已经交过了」→ 视为完成，继续按 today 路由**', async () => {
    await openReading();
    overrides[`/morning-quiz/sessions/${SESSION_ID}/submit`] = () => ({
      status: 400,
      body: { message: 'submission already submitted' },
    });
    todayBody = lessonToday(
      { nextAction: { kind: 'read_result', label: '看结果', href: null } },
      { sessionId: SESSION_ID, submissionId: SUBMISSION_ID, status: 'done' },
    );
    await click(screen.getByTestId('submit'));
    await click(screen.getByRole('button', { name: /确认交卷/ }));
    expect(at()).toBe('/lesson/reading/result');
    expect(screen.queryByTestId('submit-error')).not.toBeInTheDocument();
  });
});
