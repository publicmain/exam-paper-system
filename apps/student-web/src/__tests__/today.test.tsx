import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { act, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import App from '../App';
import { OWNED_STORAGE_KEYS, readToken, writeToken } from '../lib/identity';
import { __resetForTest } from '../lib/auth-store';
import { NEXT_ACTION_KINDS, type NextActionKind } from '../routes.contract';

/**
 * 今天的课 —— **行为测试**。
 *
 * 真组件 + 真 auth-store + 真 API 客户端，只把 `fetch` 打桩。
 * 判据是「跑起来做了什么」：请求里有没有身份、点了按钮发出什么、
 * 最后停在哪条路由 —— 不是「源码里有没有某个字符串」。
 */

const PROFILE = { id: 's7', name: '测试七号', nickname: '七号', avatar: null };
const TOKEN = 'test-token';

function jsonResponse(status: number, body: unknown) {
  return Promise.resolve({
    ok: status >= 200 && status < 300,
    status,
    text: () => Promise.resolve(JSON.stringify(body)),
  } as Response);
}
const route = (url: string) => url.replace(/^.*\/api/, '');

/** 一份最小但字段齐全的 `/lesson/today` 响应。 */
function lesson(over: Partial<Record<string, unknown>> = {}) {
  return {
    student: { id: PROFILE.id, name: PROFILE.name },
    date: '2026-08-28',
    nextAction: { kind: 'ready_to_start', label: '开始今天的课程', href: null },
    rulesVersion: 2,
    completed: 0,
    total: 3,
    allDone: false,
    streakDays: 0,
    targetsFrozenAt: null,
    stage: 'ready_to_start',
    stageAt: null,
    vocabCursor: 0,
    segments: [
      { key: 'read', status: 'todo', label: '晨读 A', questionCount: 5, typicalMinutes: 15,
        score: null, maxScore: 5, scoresPending: false, submissionId: null, sessionId: null, autoClosed: false },
      { key: 'vocab', status: 'todo', progress: 0, target: 4, typicalMinutes: 2,
        quizScore: { status: 'not_started' } },
      { key: 'drill', status: 'none', progress: 0, target: 0, typicalMinutes: 2 },
    ],
    ...over,
  };
}
const withKind = (kind: NextActionKind, label: string, over = {}) =>
  lesson({ nextAction: { kind, label, href: null }, ...over });

let fetchMock: ReturnType<typeof vi.fn>;

beforeEach(() => {
  __resetForTest();
  localStorage.clear();
  writeToken(TOKEN);
  fetchMock = vi.fn();
  vi.stubGlobal('fetch', fetchMock);
});
afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

/** 已登录会话：`/student-auth/me` 通过，`/lesson/today` 返回给定内容。 */
function session(todayBody: unknown, extra?: (r: string, init?: RequestInit) => unknown) {
  fetchMock.mockImplementation((url: string, init?: RequestInit) => {
    const r = route(url);
    const custom = extra?.(r, init);
    if (custom) return custom;
    if (r === '/student-auth/me') return jsonResponse(200, { ...PROFILE, appVersion: 'v1' });
    if (r === '/lesson/today') return jsonResponse(200, todayBody);
    return jsonResponse(404, { code: 'not_stubbed', r });
  });
}

const renderAt = (path: string) =>
  render(
    <MemoryRouter initialEntries={[path]}>
      <App />
    </MemoryRouter>,
  );

const callsTo = (r: string) => fetchMock.mock.calls.filter((c) => route(c[0] as string) === r);

/**
 * 阶段 7C 起 `/lesson/reading` 是**真页面**，不再是占位页。
 *
 * 它一挂载就自己去问一次 `/lesson/today` 要 sessionId —— 所以「第二次
 * today 请求」就是「确实落到了阅读页」的可观测证据。这些用例里的
 * `read` 段没有 sessionId，阅读页随后会 replace 回 `/today`，
 * 那是它应有的行为，与本文件要测的路由映射无关。
 */
async function landedOnReading(before: number) {
  await waitFor(() => expect(callsTo('/lesson/today').length).toBeGreaterThan(before));
}

/**
 * 阶段 8A 起 `/lesson/reading/result` 同样是**真页面**。
 *
 * 它的资源链路和阅读页一样：先问 `/lesson/today` 拿 sessionId，再去取结果。
 * 所以这里得把 `read` 段填上 sessionId、并把结果端点也桩上，页面才走得完
 * 一整条链 —— 否则它会（正确地）replace 回 `/today`，路由断言就落空了。
 */
const RESULT_SID = 'sess-result';

function resultLesson(kind: NextActionKind = 'read_result', label = '看阅读结果') {
  const l = lesson({ nextAction: { kind, label, href: null } });
  Object.assign(l.segments[0] as Record<string, unknown>, {
    status: 'done',
    sessionId: RESULT_SID,
    submissionId: 'sub-result',
  });
  return l;
}

const RESULT_BODY = {
  sessionId: RESULT_SID,
  paperName: '晨读 A',
  submissionId: 'sub-result',
  status: 'submitted',
  finalSubmittedAt: '2026-08-28T01:00:00.000Z',
  autoScore: 4,
  manualScore: 0,
  totalScore: 4,
  maxScore: 5,
  submittedAt: '2026-08-28T01:00:00.000Z',
  items: [],
  scoresPending: false,
  answersPending: false,
};

const stubResult = (r: string) =>
  r === `/morning-quiz/student-result/${RESULT_SID}` ? jsonResponse(200, RESULT_BODY) : null;

const V2_CARD = {
  headword: 'delta', phonetic: '/ˈdeltə/', pos: 'noun', senseKey: 'delta:noun:1', translation: '三角洲',
  definition: 'land at a river mouth', sentence: 'A delta forms here.', sentenceTranslation: '这里形成三角洲。',
  collocations: ['river delta'], wordFamily: [], confusionWords: [], memoryHint: null, imageUrl: null,
  audioText: 'delta', list: 'ngsl', rank: 100, attribution: 'test',
};
const V2_DAILY = {
  id: 'daily-v2', version: 'V2-test', date: '2026-08-28', type: 'daily_learning', mode: 'level_gap',
  status: 'in_progress', target: 1, cursor: 0, completed: 0, learned: 0, sourceSummary: { level_gap: 1 },
  settings: { audioAccent: 'en-GB' }, deferredUntil: null,
  items: [{ id: 'v2-item', position: 1, source: 'level_gap', masteryBefore: 1, status: 'pending', card: V2_CARD }],
};
const V2_CENTER = {
  stats: { total: 1, totalLearned: 1, removed: 0 }, growth: [],
  filters: { sources: ['level_gap'], stages: [], articles: [], topics: [], lists: ['ngsl'] },
  total: 1, page: 1, pageSize: 30,
  items: [{ studentSenseId: 'owned', senseId: 'sense-delta', headword: 'delta', phonetic: '/ˈdeltə/', pos: 'noun', translation: '三角洲', definition: 'land at a river mouth', masteryStage: 1, due: '2026-08-28T00:00:00.000Z', source: 'level_gap', sourceTitle: null, firstSeenAt: '2026-08-28T00:00:00.000Z', inNotebook: true, skills: {}, context: { sentence: 'A delta forms here.', translation: '这里形成三角洲。' } }],
};
const stubUnifiedCenter = (r: string) => {
  if (r.startsWith('/vocab-v2/center?')) return jsonResponse(200, V2_CENTER);
  if (r === '/vocab-v2/overview') return jsonResponse(200, { dailyTarget: 12, today: V2_DAILY, pendingTests: [] });
  return null;
};
const stubUnifiedLearning = (r: string) => r === '/vocab-v2/daily' ? jsonResponse(200, V2_DAILY) : null;

// ─────────────────────────────────────────────────────────────

describe('1–2. 载入与请求卫生', () => {
  it('载入中 → 成功渲染 `/lesson/today`', async () => {
    // 把 /lesson/today 挂起，确保「载入中」确实是 Today 自己的加载态，
    // 而不是 App 在 bootstrap 阶段的那一个
    let release!: () => void;
    const gate = new Promise<void>((res) => { release = res; });
    session(lesson(), (r) =>
      r === '/lesson/today' ? gate.then(() => jsonResponse(200, lesson())) : null);
    renderAt('/today');
    await waitFor(() => expect(callsTo('/lesson/today')).toHaveLength(1));
    expect(screen.getByText('载入中…')).toBeTruthy();
    await act(async () => { release(); });
    expect(await screen.findByRole('heading', { name: /你好，七号/ })).toBeTruthy();
    expect(screen.getByText(/今天完成/)).toBeTruthy();
  });

  it('**请求带 Bearer 令牌，且零身份参数**', async () => {
    session(lesson());
    renderAt('/today');
    await screen.findByRole('heading', { name: /你好，七号/ });
    const [url, init] = callsTo('/lesson/today')[0] as [string, RequestInit];
    expect(url).not.toMatch(/[?&](name|studentId)=/);
    expect((init.headers as Record<string, string>).Authorization).toBe(`Bearer ${TOKEN}`);
    expect(init.body).toBeUndefined();
    expect(init.method).toBe('GET');
  });
});

describe('3–5. 开始今天的课', () => {
  // S12L —— 三段现在是**可点的卡片**（导航，不推进状态），所以页面上
  // 不再只有一个按钮。规矩变成：**主行动区仍然只有一个**，而且它的
  // 文案来自服务端的 `nextAction.label`。
  it('`ready_to_start` 主行动区只有一个按钮', async () => {
    session(lesson());
    renderAt('/today');
    await screen.findByRole('heading', { name: /你好，七号/ });
    const buttons = screen.getAllByRole('button');
    const cards = buttons.filter((b) => b.getAttribute('data-testid')?.startsWith('segment-card-'));
    const primary = buttons.filter((b) => !b.getAttribute('data-testid')?.startsWith('segment-card-'));
    expect(cards).toHaveLength(3);
    expect(primary).toHaveLength(1);
    expect(primary[0].textContent).toBe('开始今天的课程');
  });

  it('**开始发送的请求体恰好是 `{begin:true}`**', async () => {
    session(lesson(), (r) =>
      r === '/lesson/start' ? jsonResponse(201, withKind('resume_reading', '继续做题')) : null);
    renderAt('/today');
    await screen.findByRole('heading', { name: /你好，七号/ });
    await userEvent.click(screen.getByRole('button', { name: '开始今天的课程' }));
    await waitFor(() => expect(callsTo('/lesson/start')).toHaveLength(1));
    const [url, init] = callsTo('/lesson/start')[0] as [string, RequestInit];
    expect(JSON.parse(init.body as string)).toEqual({ begin: true });
    expect(url).not.toMatch(/[?&](name|studentId)=/);
    expect(init.body as string).not.toMatch(/"(name|studentName|studentId)"/);
  });

  it('**双击只发一次 start**', async () => {
    let release!: (v: unknown) => void;
    const pending = new Promise((res) => { release = res; });
    session(lesson(), (r) =>
      r === '/lesson/start'
        ? pending.then(() => jsonResponse(201, withKind('resume_reading', '继续做题')))
        : null);
    renderAt('/today');
    await screen.findByRole('heading', { name: /你好，七号/ });
    const btn = screen.getByRole('button', { name: '开始今天的课程' });
    await userEvent.click(btn);
    await userEvent.click(btn);        // 第二下：按钮此时已 disabled
    expect(callsTo('/lesson/start')).toHaveLength(1);
    // 放行并等它落定 —— 否则状态更新会掉在 act 之外
    const before = callsTo('/lesson/today').length;
    await act(async () => { release(null); });
    await landedOnReading(before);
  });
});

describe('单词测试待办', () => {
  it('打开失败时给出提示，按钮不会像死了一样', async () => {
    session(lesson(), (r) => {
      if (r === '/vocab-v2/overview') {
        return jsonResponse(200, {
          dailyTarget: 10,
          today: null,
          readingBacklog: [],
          learningBacklog: [],
          pendingTests: [{ dailySessionId: 'd-0907', testSessionId: null, date: '2026-09-07', total: 3, status: 'not_started' }],
        });
      }
      if (r === '/vocab-v2/test/start') return jsonResponse(503, { code: 'v2_unavailable' });
      return null;
    });
    renderAt('/today');
    await screen.findByRole('heading', { name: /你好，七号/ });
    await userEvent.click(screen.getByRole('button', { name: /9月7日 · 3 个词/ }));
    expect(await screen.findByText(/这份单词测试暂时打不开/)).toBeTruthy();
    expect(callsTo('/vocab-v2/test/start')).toHaveLength(1);
  });
});

describe('6–7. 路由映射只认契约', () => {
  it('`summary` → 落到**真的今日总结页**（阶段 10 起不再是占位页）', async () => {
    // S12I —— 总结页现在要求 `kind` / `allDone` / `completed === total`
    // 三者同时同意。只给 kind 的一天会被退回 `/today` —— 那正是用户
    // 验收时看到的那个缺陷（`2 / 3` 却能看总结）。
    session(withKind('summary', '看今日总结', { allDone: true, completed: 3, total: 3 }));
    renderAt('/today');
    await screen.findByRole('heading', { name: /你好，七号/ });
    await userEvent.click(screen.getByRole('button', { name: '看今日总结' }));
    expect(await screen.findByRole('heading', { name: '今日总结' })).toBeTruthy();
    expect(screen.getByTestId('summary-date')).toBeTruthy();
    expect(screen.getByTestId('back-to-today')).toBeTruthy();
    expect(screen.queryByText(/还没有做好/)).toBeNull();
  });

  it('`vocab_test` → 落到统一“我的单词”待办中心', async () => {
    session(withKind('vocab_test', '开始单词测试'), stubUnifiedCenter);
    renderAt('/today');
    await screen.findByRole('heading', { name: /你好，七号/ });
    await userEvent.click(screen.getByRole('button', { name: '去做单词小测' }));
    expect(await screen.findByRole('heading', { name: '我的单词' })).toBeTruthy();
    expect(screen.queryByText(/还没有做好/)).toBeNull();
  });

  it('`learn_vocab` → 落到统一的新词学习页', async () => {
    session(withKind('learn_vocab', '学习本次单词'), stubUnifiedLearning);
    renderAt('/today');
    await screen.findByRole('heading', { name: /你好，七号/ });
    await userEvent.click(screen.getByRole('button', { name: '学习本次单词' }));
    expect(await screen.findByRole('heading', { name: 'delta' })).toBeTruthy();
    // 占位页的字样不该再出现
    expect(screen.queryByText(/还没有做好/)).toBeNull();
  });

  it('`read_result` → 落到**真的结果页**（阶段 8A 起不再是占位页）', async () => {
    session(resultLesson(), stubResult);
    renderAt('/today');
    await screen.findByRole('heading', { name: /你好，七号/ });
    await userEvent.click(screen.getByRole('button', { name: '看阅读结果' }));
    expect(await screen.findByTestId('summary')).toBeTruthy();
    expect(screen.getByTestId('score').textContent).toBe('4');
    // 占位页的字样不该再出现
    expect(screen.queryByText(/还没有做好/)).toBeNull();
  });

  it('`resume_reading` → 落到**真的阅读页**（阶段 7C 起不再是占位页）', async () => {
    session(withKind('resume_reading', '继续做题'));
    renderAt('/today');
    await screen.findByRole('heading', { name: /你好，七号/ });
    const before = callsTo('/lesson/today').length;
    await userEvent.click(screen.getByRole('button', { name: '继续做题' }));
    await landedOnReading(before);
    // 占位页的字样不该再出现
    expect(screen.queryByText(/还没有做好/)).toBeNull();
  });

  it('**后端塞来的恶意 / 旧版 `href` 一律被忽略**', async () => {
    session(lesson({
      nextAction: { kind: 'resume_reading', label: '继续做题', href: '/my-history?name=测试七号' },
    }));
    renderAt('/today');
    await screen.findByRole('heading', { name: /你好，七号/ });
    const before = callsTo('/lesson/today').length;
    await userEvent.click(screen.getByRole('button', { name: '继续做题' }));
    // 去的是契约路由，不是 href
    await landedOnReading(before);
    expect(screen.queryByText(/my-history/)).toBeNull();
  });
});

describe('8–10. 停留态与摘要', () => {
  const stays: [NextActionKind, string][] = [
    ['no_content', '今天的课程还没有发布'],
    ['level_not_set', '还没有分配难度 —— 找老师设置一下'],
    ['window_closed', '今天的作答时间已经结束了'],
    ['none', '今天没有要做的事'],
  ];
  for (const [kind, label] of stays) {
    it(`\`${kind}\` 停在 /today，且没有课程主按钮`, async () => {
      session(withKind(kind, label));
      renderAt('/today');
      expect(await screen.findByText(label)).toBeTruthy();
      // S12L —— 停留态下三张卡也不是按钮（`aria-disabled`，点不动），
      // 所以整页仍然一个按钮都没有。
      expect(screen.queryAllByRole('button')).toHaveLength(0);
      for (const k of ['read', 'vocab', 'drill']) {
        expect(screen.getByTestId(`segment-card-${k}`).getAttribute('aria-disabled')).toBe('true');
      }
      expect(screen.getByText(/今天完成/)).toBeTruthy();  // 仍在 /today
    });
  }

  it('**`no_content` + `allDone:true` 不得渲染成「完成」**', async () => {
    session(withKind('no_content', '今天的课程还没有发布', {
      allDone: true, completed: 0, total: 3,
      segments: [
        { key: 'read', status: 'none', label: null, questionCount: null, typicalMinutes: 15,
          score: null, maxScore: null, scoresPending: false, submissionId: null, sessionId: null, autoClosed: false },
        { key: 'vocab', status: 'none', progress: 0, target: 0, typicalMinutes: 2, quizScore: { status: 'not_started' } },
        { key: 'drill', status: 'none', progress: 0, target: 0, typicalMinutes: 2 },
      ],
    }));
    renderAt('/today');
    expect(await screen.findByText('今天的课程还没有发布')).toBeTruthy();
    expect(screen.queryByText(/完成了|🎉|恭喜/)).toBeNull();
    expect(screen.getByText(/今天完成/).textContent).toMatch(/0\s*\/\s*3/);
  });

  it('**交卷后的词汇成绩按真实 DTO 渲染，0 分不是「没有」**', async () => {
    // 用后端真实形状：percentage + submittedAt，没有 score 字段。
    // 0 分是**有成绩**，不能因为它是假值就当成缺失渲染成别的东西。
    session(lesson({
      segments: [
        { key: 'read', status: 'done', label: '晨读 A', questionCount: 5, typicalMinutes: 15,
          score: 4, maxScore: 5, scoresPending: false, submissionId: 'sub1', sessionId: 'ses1', autoClosed: false },
        {
          key: 'vocab', status: 'done', progress: 4, target: 4, typicalMinutes: 2,
          quizScore: {
            status: 'submitted',
            correct: 0,
            total: 4,
            percentage: 0,
            submittedAt: '2026-08-28T01:00:00.000Z',
          },
        },
        { key: 'drill', status: 'none', progress: 0, target: 0, typicalMinutes: 2 },
      ],
    }));
    renderAt('/today');
    await screen.findByRole('heading', { name: /你好，七号/ });
    const items = screen.getAllByRole('listitem').map((li) => li.textContent ?? '');
    expect(items[1]).toContain('单词');
    expect(items[1]).toContain('测试 0 / 4');
    // 不得退化成「还没考」或进度分数
    expect(items[1]).not.toContain('0 / 4 ·');
    expect(items[1]).not.toMatch(/未开始|还没/);
  });

  it('段落摘要**保持服务端顺序与取值**', async () => {
    session(lesson({
      streakDays: 4,
      completed: 1,
      segments: [
        { key: 'read', status: 'done', label: '晨读 A', questionCount: 5, typicalMinutes: 15,
          score: 4, maxScore: 5, scoresPending: false, submissionId: 'sub1', sessionId: 'ses1', autoClosed: false },
        { key: 'vocab', status: 'partial', progress: 2, target: 4, typicalMinutes: 2, quizScore: { status: 'not_started' } },
        { key: 'drill', status: 'none', progress: 0, target: 0, typicalMinutes: 2 },
      ],
    }));
    renderAt('/today');
    await screen.findByRole('heading', { name: /你好，七号/ });
    const items = screen.getAllByRole('listitem').map((li) => li.textContent ?? '');
    expect(items).toHaveLength(3);
    expect(items[0]).toContain('阅读');
    expect(items[0]).toContain('4 / 5 分');
    expect(items[1]).toContain('单词');
    expect(items[1]).toContain('2 / 4');
    expect(items[2]).toContain('错题');
    expect(items[2]).toContain('今天没有');
    expect(screen.getByText(/连续学习 4 天/)).toBeTruthy();
  });
});

describe('11–14. 故障路径', () => {
  it('**GET 网络故障：留着票，重试可成功**', async () => {
    let hit = 0;
    fetchMock.mockImplementation((url: string) => {
      const r = route(url);
      if (r === '/student-auth/me') return jsonResponse(200, { ...PROFILE, appVersion: 'v1' });
      if (r === '/lesson/today') {
        hit++;
        if (hit === 1) return Promise.reject(new TypeError('network down'));
        return jsonResponse(200, lesson());
      }
      return jsonResponse(404, {});
    });
    renderAt('/today');
    expect(await screen.findByRole('alert')).toBeTruthy();
    expect(readToken()).toBe(TOKEN);   // 票还在
    await userEvent.click(screen.getByRole('button', { name: '重试' }));
    expect(await screen.findByRole('heading', { name: /你好，七号/ })).toBeTruthy();
  });

  it('**GET 认证失败：清票，回登录页**', async () => {
    session(lesson(), (r) =>
      r === '/lesson/today' ? jsonResponse(401, { code: 'token_revoked' }) : null);
    renderAt('/today');
    await waitFor(() => expect(screen.getByRole('button', { name: '登录' })).toBeTruthy());
    for (const k of OWNED_STORAGE_KEYS) expect(localStorage.getItem(k)).toBeNull();
  });

  it('**POST 失败：停在 /today，仍可重试**', async () => {
    let hit = 0;
    session(lesson(), (r) => {
      if (r !== '/lesson/start') return null;
      hit++;
      return hit === 1
        ? Promise.reject(new TypeError('network down'))
        : jsonResponse(201, withKind('resume_reading', '继续做题'));
    });
    renderAt('/today');
    await screen.findByRole('heading', { name: /你好，七号/ });
    await userEvent.click(screen.getByRole('button', { name: '开始今天的课程' }));
    expect(await screen.findByRole('alert')).toBeTruthy();
    expect(screen.getByText(/今天完成/)).toBeTruthy();          // 还在 /today
    const btn = screen.getByRole('button', { name: '开始今天的课程' });
    expect(btn.hasAttribute('disabled')).toBe(false);          // 按钮已恢复
    const before = callsTo('/lesson/today').length;
    await userEvent.click(btn);
    await landedOnReading(before);
  });

  it('**POST 认证失败：清票，回登录页**', async () => {
    session(lesson(), (r) =>
      r === '/lesson/start' ? jsonResponse(401, { code: 'token_revoked' }) : null);
    renderAt('/today');
    await screen.findByRole('heading', { name: /你好，七号/ });
    await userEvent.click(screen.getByRole('button', { name: '开始今天的课程' }));
    await waitFor(() => expect(screen.getByRole('button', { name: '登录' })).toBeTruthy());
    for (const k of OWNED_STORAGE_KEYS) expect(localStorage.getItem(k)).toBeNull();
  });
});

describe('15–16. 路由兜底与占位页', () => {
  it('**`/lesson/reading` 是真页面**：没有 sessionId 时 replace 回 /today', async () => {
    session(lesson()); // read 段的 sessionId 是 null
    renderAt('/lesson/reading');
    await waitFor(() => expect(callsTo('/lesson/today').length).toBeGreaterThan(0));
    expect(await screen.findByRole('heading', { name: /你好，七号/ })).toBeTruthy();
    expect(screen.queryByText(/还没有做好/)).toBeNull();
  });

  it('已登录访问未知深层 URL → 回 `/today`', async () => {
    session(lesson());
    renderAt('/deep/unknown/route');
    expect(await screen.findByRole('heading', { name: /你好，七号/ })).toBeTruthy();
  });

  // 阶段 10 起**五条课程路由一条占位页都不剩了**。
  it('**直接打开 `/lesson/summary` 也走完整链路**（阶段 10 起不是占位页）', async () => {
    // S12I —— 总结页现在要求 `kind` / `allDone` / `completed === total`
    // 三者同时同意。只给 kind 的一天会被退回 `/today` —— 那正是用户
    // 验收时看到的那个缺陷（`2 / 3` 却能看总结）。
    session(withKind('summary', '看今日总结', { allDone: true, completed: 3, total: 3 }));
    renderAt('/lesson/summary');
    expect(await screen.findByRole('heading', { name: '今日总结' })).toBeTruthy();
    expect(screen.queryByText(/还没有做好/)).toBeNull();
    // 状态从服务端来，不从 URL 来；而且这一屏**只读**
    expect(callsTo('/lesson/today')).toHaveLength(1);
    expect(callsTo('/lesson/start')).toHaveLength(0);
  });

  it('**直接打开旧 `/lesson/test` 会进入统一待办中心**', async () => {
    session(withKind('vocab_test', '开始单词测试'), stubUnifiedCenter);
    renderAt('/lesson/test');
    expect(await screen.findByRole('heading', { name: '我的单词' })).toBeTruthy();
    expect(screen.queryByText(/还没有做好/)).toBeNull();
    expect(callsTo('/vocab/quiz/attempt/start')).toHaveLength(0);
  });

  it('**直接打开旧 `/lesson/vocab` 会进入统一学习页**', async () => {
    session(withKind('learn_vocab', '学习本次单词'), stubUnifiedLearning);
    renderAt('/lesson/vocab');
    expect(await screen.findByRole('heading', { name: 'delta' })).toBeTruthy();
    expect(screen.queryByText(/还没有做好/)).toBeNull();
    // 队列从服务端来，不从 URL 来
    expect(callsTo('/vocab-v2/daily')).toHaveLength(1);
    expect(callsTo('/lesson/start')).toHaveLength(0);
    expect(callsTo('/vocab/due')).toHaveLength(0);
  });

  it('**直接打开 `/lesson/reading/result` 也走完整链路**（阶段 8A 起不是占位页）', async () => {
    session(resultLesson(), stubResult);
    renderAt('/lesson/reading/result');
    expect(await screen.findByTestId('summary')).toBeTruthy();
    expect(screen.queryByText(/还没有做好/)).toBeNull();
    // 资源从服务端来，不从 URL 来
    expect(callsTo('/lesson/today')).toHaveLength(1);
    expect(callsTo('/lesson/start')).toHaveLength(0);
  });
});

describe('跨日欠交任务', () => {
  it('旧阅读和旧新词同时保留，并且不会被今天的任务覆盖', async () => {
    const overview = {
      dailyTarget: 12,
      today: V2_DAILY,
      pendingTests: [],
      readingBacklog: [{
        assignmentId: 'assignment-old', sessionId: 'reading-old', submissionId: null,
        date: '2026-08-27', title: '旧阅读', status: 'not_started',
      }],
      learningBacklog: [{
        sessionId: 'words-old', date: '2026-08-27', completed: 5, target: 12, status: 'in_progress',
      }],
    };
    session(lesson(), (r) => {
      if (r === '/vocab-v2/overview') return jsonResponse(200, overview);
      if (r === '/morning-quiz/sessions/reading-old/open') return jsonResponse(201, { id: 'submission-old' });
      return null;
    });
    renderAt('/today');

    expect(await screen.findByRole('heading', { name: /你好，七号/ })).toBeTruthy();
    expect(screen.getByRole('region', { name: '待补做任务' })).toBeTruthy();
    expect(screen.getByText('8月27日阅读')).toBeTruthy();
    expect(screen.getByText('8月27日新词')).toBeTruthy();
    expect(screen.getByText('5 / 12')).toBeTruthy();

    await userEvent.click(screen.getByRole('button', { name: /8月27日新词/ }));
    await waitFor(() => expect(callsTo('/vocab-v2/daily?date=2026-08-27')).toHaveLength(1));
  });
});

describe('映射穷尽性 —— 十个 kind 页面都能处理', () => {
  it('每个 kind 都能渲染出一个明确结果，不崩、不空白', async () => {
    for (const kind of NEXT_ACTION_KINDS) {
      __resetForTest();
      writeToken(TOKEN);
      fetchMock.mockClear();
      session(withKind(kind, `标签-${kind}`));
      const { unmount } = renderAt('/today');
      expect(await screen.findByRole('heading', { name: /你好，七号/ })).toBeTruthy();
      unmount();
    }
  });
});
