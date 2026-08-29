/**
 * AC-10 —— 正式单词测试的**整条链**，用真的 `App`。
 *
 * 真路由、真认证外壳、真 api 客户端，只在 `fetch` 那一层打桩：
 *
 * ```
 * /lesson/test → /lesson/today → 开考 → 四种题型各答一次 → 交卷
 *              → 再问一次 /lesson/today → /lesson/summary
 * ```
 *
 * 断言落在**请求序列**上：顺序、方法、请求体逐字、零身份参数、
 * 一次开考、一题一次作答、一次交卷。
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { act, fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter, useLocation } from 'react-router-dom';
import App from '../App';
import { writeToken } from '../lib/identity';
import { __resetForTest } from '../lib/auth-store';

type Req = { path: string; method: string; headers: Record<string, string>; body: string | null };

const PROFILE = { id: 'stu7', name: '测试七号', nickname: '七号', avatar: null };

const OPT_MEANING = ['n. 港口', 'n. 灯笼', 'n. 草地', 'n. 卵石'];
const OPT_WORD = ['harbour', 'lantern', 'meadow', 'pebble'];

/** 未作答的题 —— S9B0 之后只剩渲染题目必需的四样。 */
const hidden = (index: number, qtype: string, prompt: string, options: string[]) => ({
  index, qtype, prompt, options,
  headword: null, phonetic: null, translation: null, contextSentence: null,
  correctIndex: null, answer: null,
  studentIndex: null, studentAnswer: null, isCorrect: null, answeredAt: null,
});

const ITEMS = () => [
  hidden(0, 'word_to_meaning', 'harbour', OPT_MEANING),
  hidden(1, 'meaning_to_word', 'n. 灯笼', OPT_WORD),
  hidden(2, 'cloze', 'The ＿＿＿ was green.', OPT_WORD),
  hidden(3, 'spelling', 'A small ＿＿＿ on the path.', []),
];

/** 服务端揭开第 index 题。 */
function reveal(index: number, base: any) {
  const spelling = base.qtype === 'spelling';
  return {
    ...base,
    headword: OPT_WORD[index],
    phonetic: 'ˈhɑːbə',
    translation: OPT_MEANING[0],
    contextSentence: 'The ships rest in the harbour.',
    correctIndex: spelling ? -1 : 0,
    answer: spelling ? 'pebble' : null,
    studentIndex: spelling ? null : 0,
    studentAnswer: spelling ? 'pebble' : base.options[0],
    isCorrect: true,
    answeredAt: '2026-08-29T02:00:00.000Z',
  };
}

function lessonToday(kind: string) {
  return {
    student: { id: PROFILE.id, name: PROFILE.name },
    date: '2026-08-29',
    // 每一次 today 都塞一个旧端 href —— 整条链一次都不该看它
    nextAction: { kind, label: 'x', href: '/my-vocab/quiz?name=测试七号' },
    rulesVersion: 4,
    completed: 2, total: 3, allDone: false, streakDays: 3,
    targetsFrozenAt: null, stage: kind, stageAt: null, vocabCursor: 4,
    segments: [
      { key: 'read', status: 'done', label: 'The Nile', questionCount: 4, typicalMinutes: 20,
        score: 4, maxScore: 5, scoresPending: false, submissionId: 'sub-1', sessionId: 'sess-1', autoClosed: false },
      { key: 'vocab', status: 'done', progress: 4, target: 4, typicalMinutes: 5, quizScore: { status: 'not_started' } },
      { key: 'drill', status: 'none', progress: 0, target: 0, typicalMinutes: 5 },
    ],
  };
}

// ── 一个有状态的假服务端 ──────────────────────────────────
//
// 作答是**累积**的：答过的题在后续每个响应里都保持揭开，这样「刷新之后
// 从第一道没答的题接着做」才是真的在测恢复，而不是测夹具。

let reqs: Req[] = [];
let items: any[];
let status: 'in_progress' | 'submitted';
let todayKind: string;
let startCount = 0;

function attemptBody(extra: Record<string, unknown> = {}) {
  const correct = items.filter((it) => it.isCorrect === true).length;
  return {
    attemptId: 'att1',
    status,
    startedAt: '2026-08-29T02:00:00.000Z',
    submittedAt: status === 'submitted' ? '2026-08-29T02:30:00.000Z' : null,
    total: status === 'submitted' ? 4 : items.length,
    correct: status === 'submitted' ? 4 : correct,
    score: status === 'submitted' ? 100 : null,
    items,
    ...extra,
  };
}

function reply(req: Req): { status?: number; body: unknown } {
  if (req.path === '/student-auth/me') return { body: { ...PROFILE, appVersion: 'v2' } };
  if (req.path === '/lesson/today') return { body: lessonToday(todayKind) };
  if (req.path === '/vocab/quiz/attempt/start') {
    startCount += 1;
    return { body: attemptBody({ resumed: startCount > 1 }) };
  }
  if (req.path === '/vocab/quiz/attempt/answer') {
    const b = JSON.parse(req.body ?? '{}');
    items = items.map((it, n) => (n === b.index ? reveal(n, it) : it));
    return { body: attemptBody({ accepted: true, isCorrect: true }) };
  }
  if (req.path === '/vocab/quiz/attempt/submit') {
    status = 'submitted';
    todayKind = 'summary';
    return { body: attemptBody({ alreadySubmitted: false }) };
  }
  return { status: 404, body: { code: 'not_stubbed', path: req.path } };
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
      const r = reply(req);
      const st = r.status ?? 200;
      return {
        ok: st >= 200 && st < 300,
        status: st,
        text: async () => JSON.stringify(r.body),
      } as unknown as Response;
    }),
  );
}

async function settle() {
  await act(async () => {
    for (let i = 0; i < 15; i++) await Promise.resolve();
  });
}

function LocationProbe() {
  const loc = useLocation();
  return <span data-testid="loc">{loc.pathname}</span>;
}

function mountApp(at = '/lesson/test') {
  return render(
    <MemoryRouter initialEntries={[at]}>
      <App />
      <LocationProbe />
    </MemoryRouter>,
  );
}

const at = () => screen.getByTestId('loc').textContent;
const paths = (p: string) => reqs.filter((r) => r.path === p);

beforeEach(() => {
  localStorage.clear();
  __resetForTest();
  writeToken('TK');
  items = ITEMS();
  status = 'in_progress';
  todayKind = 'vocab_test';
  startCount = 0;
  installFetch();
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

/** 答掉当前这一道题（四种题型都能用）。 */
async function answerCurrent() {
  const q = screen.getByTestId('question');
  if (q.getAttribute('data-qtype') === 'spelling') {
    fireEvent.change(screen.getByTestId('spelling-input'), { target: { value: 'pebble' } });
    fireEvent.click(screen.getByTestId('spelling-submit'));
  } else {
    fireEvent.click(screen.getByTestId('option-0'));
  }
  await settle();
}

// ─────────────────────────────────────────────────────────────

describe('AC-10 全链：进考场 → 四种题型 → 交卷 → 今日总结', () => {
  it('**一条链走完，请求序列逐条对得上**', async () => {
    mountApp();
    await settle();
    expect(at()).toBe('/lesson/test');

    // 四道题，每道各答一次
    for (const qtype of ['word_to_meaning', 'meaning_to_word', 'cloze', 'spelling']) {
      expect(screen.getByTestId('question').getAttribute('data-qtype')).toBe(qtype);
      await answerCurrent();
      expect(screen.getByTestId('feedback')).toBeInTheDocument();
      fireEvent.click(screen.getByTestId('next'));
      await settle();
    }

    // 交卷（二次确认）
    fireEvent.click(screen.getByTestId('submit'));
    fireEvent.click(screen.getByTestId('submit-confirm'));
    await settle();
    expect(screen.getByTestId('score').textContent).toContain('100');

    // 完成 → 重新问 today → 今日总结
    fireEvent.click(screen.getByTestId('finish'));
    await settle();
    expect(at()).toBe('/lesson/summary');

    // ── 请求序列 ──
    const seq = reqs.filter((r) => r.path !== '/student-auth/me').map((r) => `${r.method} ${r.path}`);
    expect(seq).toEqual([
      'GET /lesson/today',
      'POST /vocab/quiz/attempt/start',
      'POST /vocab/quiz/attempt/answer',
      'POST /vocab/quiz/attempt/answer',
      'POST /vocab/quiz/attempt/answer',
      'POST /vocab/quiz/attempt/answer',
      'POST /vocab/quiz/attempt/submit',
      'GET /lesson/today',
    ]);

    // ── 请求体逐字 ──
    expect(JSON.parse(paths('/vocab/quiz/attempt/start')[0].body!)).toEqual({});
    expect(paths('/vocab/quiz/attempt/answer').map((r) => JSON.parse(r.body!))).toEqual([
      { index: 0, optionIndex: 0 },
      { index: 1, optionIndex: 0 },
      { index: 2, optionIndex: 0 },
      { index: 3, text: 'pebble' },
    ]);
    expect(JSON.parse(paths('/vocab/quiz/attempt/submit')[0].body!)).toEqual({});

    // 一次开考、一题一次作答、一次交卷
    expect(paths('/vocab/quiz/attempt/start')).toHaveLength(1);
    expect(paths('/vocab/quiz/attempt/answer')).toHaveLength(4);
    expect(paths('/vocab/quiz/attempt/submit')).toHaveLength(1);

    // ── 零身份 ──
    for (const r of reqs) {
      expect(r.path).not.toMatch(/[?&#]/);
      expect(r.path).not.toMatch(/name=|studentId=|then=|after=/);
      expect(r.headers.Authorization).toBe('Bearer TK');
      if (r.body) expect(r.body).not.toMatch(/"name"|"studentName"|"studentId"/);
    }
    // 整条链一次都没去过旧端
    for (const r of reqs) expect(r.path).not.toMatch(/my-vocab|my-history|scan/);
  });

  it('**刷新之后恢复同一份考试**，不会开出第二份', async () => {
    const first = mountApp();
    await settle();
    await answerCurrent();       // 答掉第 0 题
    fireEvent.click(screen.getByTestId('next'));
    await settle();
    await answerCurrent();       // 答掉第 1 题
    await settle();
    first.unmount();

    // 「刷新」：整个 App 重新挂载
    reqs = [];
    mountApp();
    await settle();

    // 幂等开考：又打了一次 start，但服务端回的是同一份（resumed）
    expect(paths('/vocab/quiz/attempt/start')).toHaveLength(1);
    expect(startCount).toBe(2);
    // 落到第一道没答的题（第 2 题，cloze），且没有重发任何作答
    expect(screen.getByTestId('progress').textContent).toContain('3 / 4');
    expect(screen.getByTestId('question').getAttribute('data-qtype')).toBe('cloze');
    expect(paths('/vocab/quiz/attempt/answer')).toHaveLength(0);
  });

  it('**已交卷的那份再进来，直接看成绩，不重考也不重交**', async () => {
    items = ITEMS().map((it, n) => reveal(n, it));
    status = 'submitted';
    mountApp();
    await settle();
    expect(screen.getByTestId('score').textContent).toContain('100');
    expect(paths('/vocab/quiz/attempt/submit')).toHaveLength(0);
    expect(screen.queryByTestId('question')).toBeNull();
  });
});
