import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { act, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import App from '../App';
import { readToken, writeToken } from '../lib/identity';
import { __resetForTest } from '../lib/auth-store';
import { NEXT_ACTION_KINDS, type NextActionKind } from '../routes.contract';
import type { HomeTasks, V2Overview } from '../lib/api';

/**
 * 今日 —— **行为测试**（审计 IOS-04 / UI05 / UI13 / UI14）。
 *
 * 真组件 + 真 auth-store + 真 API 客户端，只把 `fetch` 打桩。
 * 判据是「跑起来做了什么」：请求里有没有身份、点了按钮发出什么、
 * 最后停在哪条路由、完成度按什么算 —— 不是「源码里有没有某个字符串」。
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
    total: 2,
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
    ],
    ...over,
  };
}
const withKind = (kind: NextActionKind, label: string, over = {}) =>
  lesson({ nextAction: { kind, label, href: null }, ...over });

/** 服务端 overview 的 `home` 三项（新契约）。 */
function home(over: Partial<HomeTasks> = {}): HomeTasks {
  return {
    date: '2026-08-28',
    teachingDay: true,
    reading: { state: 'pending', sessionId: 'ses1', title: '晨读 A', level: 'olevel' },
    words: { state: 'not_generated' },
    test: { state: 'not_generated', reason: 'no_word_task_yet' },
    allDone: false,
    ...over,
  };
}
function overview(over: Partial<V2Overview> = {}): V2Overview {
  return {
    dailyTarget: 10,
    today: null,
    readingBacklog: [],
    learningBacklog: [],
    pendingTests: [],
    home: home(),
    backlogByDate: [],
    backlogTotals: { reading: 0, words: 0, test: 0 },
    ...over,
  };
}

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

/**
 * 已登录会话：`/student-auth/me` 通过，`/lesson/today` 与 `/vocab-v2/overview` 返回给定内容。
 * `ov` 传 `null` = overview 这条没桩（404，相当于老服务端或下游故障）。
 */
function session(todayBody: unknown, extra?: (r: string, init?: RequestInit) => unknown, ov: V2Overview | null = overview()) {
  fetchMock.mockImplementation((url: string, init?: RequestInit) => {
    const r = route(url);
    const custom = extra?.(r, init);
    if (custom) return custom;
    if (r === '/student-auth/me') return jsonResponse(200, { ...PROFILE, appVersion: 'v1' });
    if (r === '/lesson/today') return jsonResponse(200, todayBody);
    if (r === '/vocab-v2/overview' && ov) return jsonResponse(200, ov);
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
const onToday = () => screen.findByRole('heading', { name: '今日', level: 1 });
/** 等三张卡都有了结论（不再是载入中） */
async function settled() {
  await onToday();
  await waitFor(() => {
    for (const k of ['reading', 'words', 'test']) expect(screen.getByTestId(`task-${k}`).getAttribute('data-state')).not.toBe('loading');
  });
}

/**
 * 阶段 7C 起 `/lesson/reading` 是**真页面**：一挂载就再问一次 `/lesson/today` 要 sessionId ——
 * 「第二次 today 请求」就是「确实落到了阅读页」的可观测证据。
 */
async function landedOnReading(before: number) {
  await waitFor(() => expect(callsTo('/lesson/today').length).toBeGreaterThan(before));
}

const RESULT_SID = 'sess-result';
function resultLesson(kind: NextActionKind = 'read_result', label = '看阅读结果') {
  const l = lesson({ nextAction: { kind, label, href: null } });
  Object.assign(l.segments[0] as Record<string, unknown>, { status: 'done', sessionId: RESULT_SID, submissionId: 'sub-result', score: 4 });
  return l;
}
const RESULT_BODY = {
  sessionId: RESULT_SID, paperName: '晨读 A', submissionId: 'sub-result', status: 'submitted',
  finalSubmittedAt: '2026-08-28T01:00:00.000Z', autoScore: 4, manualScore: 0, totalScore: 4, maxScore: 5,
  submittedAt: '2026-08-28T01:00:00.000Z', items: [], scoresPending: false, answersPending: false,
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
  items: [{ id: 'v2-item', position: 1, source: 'level_gap', masteryBefore: 1, status: 'pending', action: null, card: V2_CARD }],
};
const V2_CENTER = {
  stats: { total: 1, totalLearned: 1, removed: 0 }, growth: [],
  filters: { sources: ['level_gap'], stages: [], articles: [], topics: [], lists: ['ngsl'] },
  total: 1, page: 1, pageSize: 30,
  items: [{ studentSenseId: 'owned', senseId: 'sense-delta', headword: 'delta', phonetic: '/ˈdeltə/', pos: 'noun', translation: '三角洲', definition: 'land at a river mouth', masteryStage: 1, due: '2026-08-28T00:00:00.000Z', source: 'level_gap', sourceTitle: null, firstSeenAt: '2026-08-28T00:00:00.000Z', inNotebook: true, skills: {}, context: { sentence: 'A delta forms here.', translation: '这里形成三角洲。' } }],
};
const stubUnifiedCenter = (r: string) => (r.startsWith('/vocab-v2/center?') ? jsonResponse(200, V2_CENTER) : null);
const stubLearning = (r: string) =>
  r === '/vocab-v2/daily' || r === '/vocab-v2/daily/start' ? jsonResponse(200, V2_DAILY) : null;

// ─────────────────────────────────────────────────────────────

describe('载入与请求卫生', () => {
  it('载入中 → 三张卡各自出结论', async () => {
    let release!: () => void;
    const gate = new Promise<void>((res) => { release = res; });
    session(lesson(), (r) => (r === '/lesson/today' ? gate.then(() => jsonResponse(200, lesson())) : null));
    renderAt('/today');
    await onToday();
    expect(screen.getByTestId('task-reading').getAttribute('data-state')).toBe('loading');
    await act(async () => { release(); });
    await settled();
    expect(screen.getByTestId('lesson-progress').textContent).toMatch(/今天完成/);
  });

  it('**两条请求都带 Bearer 令牌，且零身份参数**', async () => {
    session(lesson());
    renderAt('/today');
    await settled();
    for (const r of ['/lesson/today', '/vocab-v2/overview']) {
      const [url, init] = callsTo(r)[0] as [string, RequestInit];
      expect(url).not.toMatch(/[?&](name|studentId)=/);
      expect((init.headers as Record<string, string>).Authorization).toBe(`Bearer ${TOKEN}`);
      expect(init.body).toBeUndefined();
      expect(init.method).toBe('GET');
    }
  });

  it('页头有日期和身份入口（点了去账号）', async () => {
    session(lesson({ streakDays: 4 }));
    renderAt('/today');
    await settled();
    expect(screen.getByTestId('today-date').textContent).toBe('8月28日 周五');
    expect(screen.getByText(/已连续学习 4 天/)).toBeTruthy();
    const chip = screen.getByRole('link', { name: /^七号，今天阅读的难度 .+，打开账号$/ });
    await userEvent.click(chip);
    expect(await screen.findByRole('heading', { name: '账号', level: 1 })).toBeTruthy();
  });
});

describe('UI13 · 每张卡只启动它自己', () => {
  it('**今天的课还没开始，也能直接学词：不调 lesson/start，不开阅读**', async () => {
    session(lesson(), stubLearning);
    renderAt('/today');
    await settled();
    await userEvent.click(screen.getByTestId('task-words-action'));
    expect(await screen.findByRole('heading', { name: 'delta' })).toBeTruthy();
    expect(callsTo('/lesson/start')).toHaveLength(0);
  });

  it('**没有阅读内容（no_content）也能学词、也能开测试**', async () => {
    const ov = overview({
      home: home({
        reading: { state: 'not_generated', reason: 'no_session_published' },
        words: { state: 'completed', sessionId: 'd1', target: 10, learned: 10, deferred: 0, pending: 0 },
        test: { state: 'not_generated', reason: 'ready_to_generate', dailySessionId: 'd1', expectedNewWords: 10, reviewWordsMax: 3 },
      }),
    });
    session(withKind('no_content', '今天的课程还没有发布', {
      segments: [{ key: 'read', status: 'none', label: null, questionCount: null, typicalMinutes: 15, score: null, maxScore: null, scoresPending: false, submissionId: null, sessionId: null, autoClosed: false }],
    }), (r) => (r === '/vocab-v2/test/start' ? jsonResponse(201, { id: 'ts-1', total: 13, items: [] }) : null), ov);
    renderAt('/today');
    await settled();
    expect(screen.getByTestId('task-reading').getAttribute('data-state')).toBe('not_applicable');
    expect(screen.getByTestId('task-reading-detail').textContent).toContain('今天的阅读还没有发布');
    expect(screen.getByTestId('task-test-detail').textContent).toBe('预计 10 个新词，另有最多 3 个旧词抽查');
    await userEvent.click(screen.getByTestId('task-test-action'));
    await waitFor(() => expect(callsTo('/vocab-v2/test/start')).toHaveLength(1));
    expect(JSON.parse((callsTo('/vocab-v2/test/start')[0][1] as RequestInit).body as string)).toEqual({ dailySessionId: 'd1' });
    expect(callsTo('/lesson/start')).toHaveLength(0);
  });

  it('**反过来先阅读：只发 lesson/start `{begin:true}`，不碰单词接口**', async () => {
    session(lesson(), (r) => (r === '/lesson/start' ? jsonResponse(201, withKind('resume_reading', '继续做题')) : null));
    renderAt('/today');
    await settled();
    const before = callsTo('/lesson/today').length;
    await userEvent.click(screen.getByTestId('task-reading-action'));
    await waitFor(() => expect(callsTo('/lesson/start')).toHaveLength(1));
    const [url, init] = callsTo('/lesson/start')[0] as [string, RequestInit];
    expect(JSON.parse(init.body as string)).toEqual({ begin: true });
    expect(url).not.toMatch(/[?&](name|studentId)=/);
    expect(init.body as string).not.toMatch(/"(name|studentName|studentId)"/);
    await landedOnReading(before);
    expect(fetchMock.mock.calls.filter((c) => /\/vocab-v2\/(daily\/start|test\/start)/.test(route(c[0] as string)))).toHaveLength(0);
  });

  it('**双击「开始阅读」只发一次 start**', async () => {
    let release!: (v: unknown) => void;
    const pending = new Promise((res) => { release = res; });
    session(lesson(), (r) =>
      r === '/lesson/start' ? pending.then(() => jsonResponse(201, withKind('resume_reading', '继续做题'))) : null);
    renderAt('/today');
    await settled();
    const btn = screen.getByTestId('task-reading-action');
    await userEvent.click(btn);
    await userEvent.click(btn); // 第二下：按钮此时已 disabled
    expect(callsTo('/lesson/start')).toHaveLength(1);
    const before = callsTo('/lesson/today').length;
    await act(async () => { release(null); });
    await landedOnReading(before);
  });

  it('start 之后服务端说阅读进不去 → 留在今日，不把人送去学词', async () => {
    session(lesson(), (r) => (r === '/lesson/start' ? jsonResponse(201, withKind('learn_vocab', '学习本次单词')) : null));
    renderAt('/today');
    await settled();
    await userEvent.click(screen.getByTestId('task-reading-action'));
    await waitFor(() => expect(callsTo('/lesson/start')).toHaveLength(1));
    expect(screen.getByRole('heading', { name: '今日', level: 1 })).toBeTruthy();
    expect(callsTo('/vocab-v2/daily')).toHaveLength(0);
  });

  it('推荐的下一项用主按钮，其余次按钮 —— 但都能点', async () => {
    session(lesson(), undefined, overview({ home: home({ words: { state: 'pending', sessionId: 'd1', target: 10, learned: 0, deferred: 0, pending: 10 } }) }));
    renderAt('/today');
    await settled();
    expect(screen.getByTestId('task-reading-action').className).toMatch(/bg-accent-fill/);
    expect(screen.getByTestId('task-words-action').className).not.toMatch(/bg-accent-fill/);
    expect(screen.getByTestId('task-words-action').hasAttribute('disabled')).toBe(false);
  });
});

describe('UI14 · 完成度按三项的适用性算', () => {
  it('**阅读已交卷待批 + 学词完成 + 正式测试没做 → 2 / 3，不是全部完成**', async () => {
    const l = lesson({ nextAction: { kind: 'summary', label: '看今日总结', href: null } });
    Object.assign(l.segments[0] as Record<string, unknown>, { status: 'done', scoresPending: true, sessionId: 'ses1', submissionId: 'sub1', releasedScore: { earned: 3, max: 4, count: 4 } });
    session(l, undefined, overview({
      home: home({
        reading: { state: 'awaiting_marking', sessionId: 'ses1', submissionId: 'sub1', title: '晨读 A', level: 'olevel' },
        words: { state: 'completed', sessionId: 'd1', target: 10, learned: 10, deferred: 0, pending: 0 },
        test: { state: 'pending', dailySessionId: 'd1', testSessionId: 'ts1', total: 13, newWords: 10, reviewWords: 3, answered: 0 },
      }),
      pendingTests: [{ dailySessionId: 'd1', testSessionId: 'ts1', date: '2026-08-28', total: 13, newWords: 10, reviewWords: 3, answered: 0, generated: true, status: 'not_started' }],
    }));
    localStorage.setItem('sw:vocab-test-reminded', localKey()); // 今天提醒过了，免得弹窗挡住断言
    renderAt('/today');
    await settled();
    expect(screen.getByTestId('lesson-progress').getAttribute('aria-label')).toBe('今天完成 2 / 3');
    expect(screen.getByTestId('lesson-progress').textContent).not.toMatch(/全部做完/);
    expect(screen.getByTestId('task-reading-badge').textContent).toBe('已交卷，待老师批');
    expect(screen.getByTestId('task-reading-detail').textContent).toContain('客观题 3 / 4');
    expect(screen.getByTestId('task-test-detail').textContent).toBe('13 题（新词 10 + 旧词抽查 3）');
    expect(screen.queryByTestId('open-summary')).toBeNull();
  });

  it('**新词全部延后：学词写「都延后了」（不是学完），测试「不需要」不进分母**', async () => {
    session(resultLesson(), undefined, overview({
      home: home({
        reading: { state: 'completed', sessionId: RESULT_SID, title: '晨读 A' },
        words: { state: 'completed', sessionId: 'd1', target: 10, learned: 0, deferred: 10, pending: 0 },
        test: { state: 'not_applicable', reason: 'nothing_learned' },
      }),
    }));
    renderAt('/today');
    await settled();
    expect(screen.getByTestId('task-words-badge').textContent).toBe('都延后了');
    expect(screen.getByTestId('task-test-badge').textContent).toBe('不需要');
    expect(screen.getByTestId('task-test').getAttribute('data-state')).toBe('not_applicable');
    expect(screen.getByTestId('lesson-progress').getAttribute('aria-label')).toBe('今天完成 2 / 2');
    // 三项真做完才给总结入口
    expect(screen.getByTestId('open-summary')).toBeTruthy();
  });

  it('测试还没生成（学到一半）：写生成条件，不算完成，没有按钮', async () => {
    session(lesson(), undefined, overview({
      home: home({
        words: { state: 'in_progress', sessionId: 'd1', target: 10, learned: 3, deferred: 1, pending: 6 },
        test: { state: 'not_generated', reason: 'learning_unfinished' },
      }),
    }));
    renderAt('/today');
    await settled();
    expect(screen.getByTestId('task-words-detail').textContent).toBe('学完 3 · 延后 1 · 还剩 6');
    expect(screen.getByTestId('task-test-detail').textContent).toContain('学完今天的新词后自动生成');
    expect(screen.queryByTestId('task-test-action')).toBeNull();
    expect(screen.getByTestId('lesson-progress').getAttribute('aria-label')).toBe('今天完成 0 / 3');
  });

  it('**周末：三项都不适用 → 「今天没有要完成的任务」，不是完成**', async () => {
    session(withKind('no_content', '今天的课程还没有发布', {
      segments: [{ key: 'read', status: 'none', label: null, questionCount: null, typicalMinutes: 15, score: null, maxScore: null, scoresPending: false, submissionId: null, sessionId: null, autoClosed: false }],
    }), undefined, overview({
      home: home({
        teachingDay: false,
        reading: { state: 'not_applicable', reason: 'weekend' },
        words: { state: 'not_applicable', reason: 'weekend' },
        test: { state: 'not_applicable', reason: 'weekend' },
        allDone: true,
      }),
    }));
    renderAt('/today');
    await settled();
    expect(screen.getByTestId('task-reading-detail').textContent).toMatch(/周六周日没有阅读/);
    expect(screen.getByTestId('task-words-detail').textContent).toMatch(/周六周日不推新词/);
    expect(screen.getByTestId('lesson-progress').textContent).toBe('今天没有要完成的任务');
    expect(screen.queryByTestId('open-summary')).toBeNull();
    expect(screen.queryByText(/完成了|🎉|恭喜/)).toBeNull();
  });

  it('**`no_content` + 旧字段 `allDone:true` 不得渲染成「完成」**（老服务端没有 home）', async () => {
    session(withKind('no_content', '今天的课程还没有发布', {
      allDone: true, completed: 0, total: 3,
      segments: [
        { key: 'read', status: 'none', label: null, questionCount: null, typicalMinutes: 15, score: null, maxScore: null, scoresPending: false, submissionId: null, sessionId: null, autoClosed: false },
        { key: 'vocab', status: 'none', progress: 0, target: 0, typicalMinutes: 2, quizScore: { status: 'not_started' } },
      ],
    }), undefined, overview({ home: undefined, today: null }));
    renderAt('/today');
    await settled();
    expect(screen.queryByTestId('open-summary')).toBeNull();
    expect(screen.queryByText(/完成了|🎉|恭喜|全部做完/)).toBeNull();
  });

  it('系统已收卷的阅读算这一项结束（与服务端 allDone 同口径）', async () => {
    const l = resultLesson();
    Object.assign(l.segments[0] as Record<string, unknown>, { status: 'auto_closed', autoClosed: true });
    session(l, undefined, overview({
      home: home({
        reading: { state: 'auto_closed', sessionId: RESULT_SID },
        words: { state: 'completed', sessionId: 'd1', target: 10, learned: 10, deferred: 0, pending: 0 },
        test: { state: 'completed', dailySessionId: 'd1', testSessionId: 'ts1', total: 13, newWords: 10, reviewWords: 3, answered: 13 },
        allDone: true,
      }),
    }));
    renderAt('/today');
    await settled();
    expect(screen.getByTestId('task-reading-badge').textContent).toBe('系统已收卷');
    expect(screen.getByTestId('lesson-progress').getAttribute('aria-label')).toBe('今天完成 3 / 3');
    expect(screen.getByTestId('open-summary')).toBeTruthy();
  });
});

describe('UI05 · 模块各自加载、各自恢复', () => {
  it('**阅读成功而 overview 500：阅读可用；单词两张卡写失败并可重试；不报全部完成**', async () => {
    let fail = true;
    session(resultLesson(), (r) => {
      if (r === '/vocab-v2/overview' && fail) return jsonResponse(500, { code: 'boom' });
      return stubResult(r);
    }, overview({
      home: home({
        reading: { state: 'completed', sessionId: RESULT_SID },
        words: { state: 'completed', sessionId: 'd1', target: 10, learned: 10, deferred: 0, pending: 0 },
        test: { state: 'pending', dailySessionId: 'd1', testSessionId: 'ts1', total: 13, newWords: 10, reviewWords: 3, answered: 0 },
      }),
      readingBacklog: [{ assignmentId: 'a-old', sessionId: 'reading-old', submissionId: null, date: '2026-08-27', title: '旧阅读', status: 'not_started' }],
    }));
    renderAt('/today');
    await settled();
    expect(screen.getByTestId('task-reading').getAttribute('data-state')).toBe('done');
    expect(screen.getByTestId('task-words-error').textContent).toMatch(/没加载出来.*不代表今天没有任务/);
    expect(screen.getByTestId('task-test-error')).toBeTruthy();
    expect(screen.getByTestId('backlog-error')).toBeTruthy();
    expect(screen.getByTestId('lesson-progress').textContent).toBe('有一项没加载出来，完成度先不算');
    expect(screen.queryByTestId('open-summary')).toBeNull();
    expect(screen.queryByText('之前的任务都做完了。')).toBeNull();
    // 阅读这一块照常能用
    expect(screen.getByTestId('task-reading-action').textContent).toBe('看结果');
    // 恢复后重试：单词两张卡与旧待办一起回来
    fail = false;
    await userEvent.click(screen.getByTestId('task-words-retry'));
    await waitFor(() => expect(screen.getByTestId('task-test').getAttribute('data-state')).toBe('todo'));
    expect(screen.getByTestId('backlog-day-2026-08-27')).toBeTruthy();
  });

  it('**overview 恢复后，各类待办重新出现**', async () => {
    let hit = 0;
    session(lesson(), (r) => {
      if (r !== '/vocab-v2/overview') return null;
      hit += 1;
      return hit === 1 ? Promise.reject(new TypeError('network down')) : jsonResponse(200, overview({
        learningBacklog: [{ sessionId: 'w-old', date: '2026-08-27', completed: 5, learned: 4, deferred: 1, pending: 7, target: 12, status: 'in_progress' }],
      }));
    });
    renderAt('/today');
    await settled();
    expect(screen.getByTestId('backlog-error')).toBeTruthy();
    await userEvent.click(within(screen.getByTestId('backlog')).getByRole('button', { name: /重试/ }));
    expect(await screen.findByTestId('backlog-day-2026-08-27')).toBeTruthy();
    expect(screen.getByRole('button', { name: '8月27日 周四新词补做，还剩 7 个' })).toBeTruthy();
  });

  it('**阅读失败而 overview 成功：单词照常可用，阅读卡写失败并可重试**', async () => {
    let hit = 0;
    session(lesson(), (r) => {
      if (r !== '/lesson/today') return stubLearning(r);
      hit += 1;
      return hit === 1 ? jsonResponse(503, { code: 'busy' }) : jsonResponse(200, lesson());
    });
    renderAt('/today');
    await settled();
    expect(screen.getByTestId('task-reading-error')).toBeTruthy();
    expect(readToken()).toBe(TOKEN); // 票还在
    expect(screen.getByTestId('task-words-action')).toBeTruthy();
    await userEvent.click(screen.getByTestId('task-reading-retry'));
    await waitFor(() => expect(screen.getByTestId('task-reading').getAttribute('data-state')).toBe('todo'));
  });

  it('**两边都失败：整页一个出错态，留着票，重试可成功**', async () => {
    let hit = 0;
    fetchMock.mockImplementation((url: string) => {
      const r = route(url);
      if (r === '/student-auth/me') return jsonResponse(200, { ...PROFILE, appVersion: 'v1' });
      if (r === '/lesson/today' || r === '/vocab-v2/overview') {
        hit += 1;
        if (hit <= 2) return Promise.reject(new TypeError('network down'));
        return jsonResponse(200, r === '/lesson/today' ? lesson() : overview());
      }
      return jsonResponse(404, {});
    });
    renderAt('/today');
    expect(await screen.findByText('今天的任务没加载出来')).toBeTruthy();
    expect(readToken()).toBe(TOKEN);
    await userEvent.click(screen.getByRole('button', { name: '重试' }));
    await settled();
  });

  it('**GET 认证失败：清票，回登录页**', async () => {
    session(lesson(), (r) => (r === '/lesson/today' ? jsonResponse(401, { code: 'token_revoked' }) : null));
    renderAt('/today');
    await waitFor(() => expect(screen.getByRole('button', { name: '登录' })).toBeTruthy());
    expect(localStorage.getItem('sw:token')).toBeNull(); // 草稿归属摘要按 UI15 留给同一个人
  });

  it('**开始阅读失败：停在今日，卡上写原因，按钮恢复可重试**', async () => {
    let hit = 0;
    session(lesson(), (r) => {
      if (r !== '/lesson/start') return null;
      hit += 1;
      return hit === 1 ? Promise.reject(new TypeError('network down')) : jsonResponse(201, withKind('resume_reading', '继续做题'));
    });
    renderAt('/today');
    await settled();
    await userEvent.click(screen.getByTestId('task-reading-action'));
    expect(await within(screen.getByTestId('task-reading')).findByRole('alert')).toBeTruthy();
    const btn = screen.getByTestId('task-reading-action');
    expect(btn.hasAttribute('disabled')).toBe(false);
    const before = callsTo('/lesson/today').length;
    await userEvent.click(btn);
    await landedOnReading(before);
  });

  it('**开始阅读认证失败：清票，回登录页**', async () => {
    session(lesson(), (r) => (r === '/lesson/start' ? jsonResponse(401, { code: 'token_revoked' }) : null));
    renderAt('/today');
    await settled();
    await userEvent.click(screen.getByTestId('task-reading-action'));
    await waitFor(() => expect(screen.getByRole('button', { name: '登录' })).toBeTruthy());
    expect(localStorage.getItem('sw:token')).toBeNull();
  });
});

describe('跳转只认契约', () => {
  it('阅读已完成 → 「看结果」落到**真的结果页**', async () => {
    session(resultLesson(), stubResult, overview({ home: home({ reading: { state: 'completed', sessionId: RESULT_SID } }) }));
    renderAt('/today');
    await settled();
    expect(screen.getByTestId('task-reading-detail').textContent).toContain('4 / 5 分');
    await userEvent.click(screen.getByTestId('task-reading-action'));
    expect(await screen.findByTestId('summary')).toBeTruthy();
    expect(screen.getByTestId('score').textContent).toBe('4');
  });

  it('阅读做了一半 → 「继续阅读」落到**真的阅读页**', async () => {
    const l = withKind('resume_reading', '继续做题');
    Object.assign(l.segments[0] as Record<string, unknown>, { status: 'partial' });
    session(l, undefined, overview({ home: home({ reading: { state: 'in_progress', sessionId: 'ses1' } }) }));
    renderAt('/today');
    await settled();
    const before = callsTo('/lesson/today').length;
    await userEvent.click(screen.getByRole('button', { name: '继续阅读' }));
    await landedOnReading(before);
  });

  it('**后端塞来的恶意 / 旧版 `href` 一律被忽略**', async () => {
    const l = lesson({ nextAction: { kind: 'resume_reading', label: '继续做题', href: '/my-history?name=测试七号' } });
    Object.assign(l.segments[0] as Record<string, unknown>, { status: 'partial' });
    session(l, undefined, overview({ home: home({ reading: { state: 'in_progress', sessionId: 'ses1' } }) }));
    renderAt('/today');
    await settled();
    const before = callsTo('/lesson/today').length;
    await userEvent.click(screen.getByTestId('task-reading-action'));
    await landedOnReading(before);
    expect(screen.queryByText(/my-history/)).toBeNull();
  });

  it('正式测试进行中 → 按冻结卷的 id 打开，不再生成一份', async () => {
    session(lesson(), (r) => (r.startsWith('/vocab-v2/test?') ? jsonResponse(200, { id: 'ts1', version: 'v2', date: '2026-08-28', type: 'formal_test', status: 'in_progress', total: 13, answered: 4, correct: null, items: [] }) : null), overview({
      home: home({ words: { state: 'completed', sessionId: 'd1', target: 10, learned: 10, deferred: 0, pending: 0 }, test: { state: 'in_progress', dailySessionId: 'd1', testSessionId: 'ts1', total: 13, newWords: 10, reviewWords: 3, answered: 4 } }),
    }));
    renderAt('/today');
    await settled();
    expect(screen.getByTestId('task-test-badge').textContent).toBe('做到 4 / 13');
    await userEvent.click(screen.getByTestId('task-test-action'));
    await waitFor(() => expect(callsTo('/vocab-v2/test?sessionId=ts1').length).toBeGreaterThan(0));
    expect(callsTo('/vocab-v2/test/start')).toHaveLength(0);
  });
});

describe('旧待办 · 按日期、有限展开', () => {
  const OLD = overview({
    readingBacklog: ['2026-08-24', '2026-08-25', '2026-08-26'].map((d, i) => ({ assignmentId: `a-${d}`, sessionId: `r-${d}`, submissionId: null, date: d, title: `阅读 ${d}`, status: i === 1 ? 'in_progress' as const : 'not_started' as const, level: 'olevel' })),
    learningBacklog: [{ sessionId: 'w-0825', date: '2026-08-25', completed: 5, learned: 4, deferred: 1, pending: 5, target: 10, status: 'in_progress' }],
    pendingTests: [
      { dailySessionId: 'd-0826', testSessionId: null, date: '2026-08-26', total: null, generated: false, expectedNewWords: 8, reviewWordsMax: 3, answered: 0, status: 'not_started' },
      { dailySessionId: 'd-0827', testSessionId: 'ts-0827', date: '2026-08-27', total: 12, newWords: 10, reviewWords: 2, generated: true, answered: 0, status: 'not_started' },
    ],
  });

  it('**默认只展开最早两天，写清每天欠几项；「查看全部待办」展开其余**', async () => {
    localStorage.setItem('sw:vocab-test-reminded', localKey());
    session(lesson(), undefined, OLD);
    renderAt('/today');
    await settled();
    const section = screen.getByTestId('backlog');
    expect(within(section).getByText('之前没做完的（4 天）')).toBeTruthy();
    expect(screen.getByTestId('backlog-day-2026-08-24')).toBeTruthy();
    expect(within(screen.getByTestId('backlog-day-2026-08-25')).getByText('欠 阅读 1 · 新词 1')).toBeTruthy();
    expect(screen.queryByTestId('backlog-day-2026-08-26')).toBeNull();
    const more = screen.getByTestId('backlog-more');
    expect(more.textContent).toBe('查看全部待办（还有 2 天）');
    expect(more.getAttribute('aria-expanded')).toBe('false');
    await userEvent.click(more);
    expect(screen.getByTestId('backlog-day-2026-08-27')).toBeTruthy();
    // 卷子没生成的旧测试：不编题数
    expect(screen.getByRole('button', { name: '8月26日 周三单词测试，预计 8 个新词，另有最多 3 个旧词抽查，开始' })).toBeTruthy();
  });

  it('**旧待办在今天三项之后，不挡先做今天**', async () => {
    localStorage.setItem('sw:vocab-test-reminded', localKey());
    session(lesson(), undefined, OLD);
    renderAt('/today');
    await settled();
    const tasks = screen.getByRole('list', { name: '今天的三项任务' });
    const backlog = screen.getByTestId('backlog');
    expect(tasks.compareDocumentPosition(backlog) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(screen.getByTestId('task-reading-action').hasAttribute('disabled')).toBe(false);
  });

  it('补做旧新词 → 打开那一天的学习；补做旧阅读 → 先 open 再进阅读页', async () => {
    localStorage.setItem('sw:vocab-test-reminded', localKey());
    session(lesson(), (r) => {
      if (r === '/morning-quiz/sessions/r-2026-08-24/open') return jsonResponse(201, { id: 'sub-old' });
      if (r === '/vocab-v2/daily?date=2026-08-25') return jsonResponse(200, { ...V2_DAILY, date: '2026-08-25' });
      return null;
    }, OLD);
    renderAt('/today');
    await settled();
    await userEvent.click(screen.getByRole('button', { name: '8月25日 周二新词补做，还剩 5 个' }));
    await waitFor(() => expect(callsTo('/vocab-v2/daily?date=2026-08-25')).toHaveLength(1));
  });

  it('没有旧待办：写「之前的任务都做完了」（与没加载出来分开）', async () => {
    session(lesson());
    renderAt('/today');
    await settled();
    expect(screen.getByTestId('backlog-empty').textContent).toBe('之前的任务都做完了。');
  });

  it('打开旧测试失败时给出提示，按钮不会像死了一样', async () => {
    localStorage.setItem('sw:vocab-test-reminded', localKey());
    session(lesson(), (r) => (r === '/vocab-v2/test/start' ? jsonResponse(503, { code: 'v2_unavailable' }) : null), overview({
      pendingTests: [{ dailySessionId: 'd-0826', testSessionId: null, date: '2026-08-26', total: null, generated: false, expectedNewWords: 3, reviewWordsMax: 3, answered: 0, status: 'not_started' }],
    }));
    renderAt('/today');
    await settled();
    await userEvent.click(screen.getByRole('button', { name: /8月26日 周三单词测试/ }));
    expect(await within(screen.getByTestId('backlog')).findByText(/这份单词测试暂时打不开/)).toBeTruthy();
    expect(callsTo('/vocab-v2/test/start')).toHaveLength(1);
  });
});

describe('路由兜底', () => {
  it('**`/lesson/reading` 是真页面**：没有 sessionId 时 replace 回今日', async () => {
    session(lesson());
    renderAt('/lesson/reading');
    await waitFor(() => expect(callsTo('/lesson/today').length).toBeGreaterThan(0));
    expect(await onToday()).toBeTruthy();
  });

  it('已登录访问未知深层 URL → 回今日', async () => {
    session(lesson());
    renderAt('/deep/unknown/route');
    expect(await onToday()).toBeTruthy();
  });

  it('**直接打开旧 `/lesson/test` 会进入统一「我的单词」**', async () => {
    session(withKind('vocab_test', '开始单词测试'), stubUnifiedCenter);
    renderAt('/lesson/test');
    expect(await screen.findByRole('heading', { name: '我的单词', level: 1 })).toBeTruthy();
    expect(callsTo('/vocab/quiz/attempt/start')).toHaveLength(0);
  });

  it('**直接打开旧 `/lesson/vocab` 会进入统一学习页**', async () => {
    session(withKind('learn_vocab', '学习本次单词'), stubLearning);
    renderAt('/lesson/vocab');
    expect(await screen.findByRole('heading', { name: 'delta' })).toBeTruthy();
    expect(callsTo('/lesson/start')).toHaveLength(0);
    expect(callsTo('/vocab/due')).toHaveLength(0);
  });

  it('**直接打开 `/lesson/reading/result` 也走完整链路**', async () => {
    session(resultLesson(), stubResult);
    renderAt('/lesson/reading/result');
    expect(await screen.findByTestId('summary')).toBeTruthy();
    expect(callsTo('/lesson/start')).toHaveLength(0);
  });
});

describe('映射穷尽性 —— 每个 kind 页面都能处理', () => {
  it('每个 kind 都能渲染出三张卡，不崩、不空白', async () => {
    for (const kind of NEXT_ACTION_KINDS) {
      __resetForTest();
      writeToken(TOKEN);
      fetchMock.mockClear();
      session(withKind(kind, `标签-${kind}`));
      const { unmount } = renderAt('/today');
      await settled();
      expect(screen.getAllByRole('listitem').filter((li) => li.getAttribute('data-testid')?.startsWith('task-'))).toHaveLength(3);
      unmount();
    }
  });
});

function localKey(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}
