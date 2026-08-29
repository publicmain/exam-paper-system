/**
 * AC-02 ~ AC-08 —— 正式单词测试这一屏的行为。
 *
 * 真页面 + 真 api 客户端，只在 `fetch` 那一层打桩。断言落在渲染出来的
 * DOM 和实际发出去的请求上。
 *
 * 这一屏和「课程学词」最大的不同是**它有成绩**：每一次作答都进成绩单，
 * 而且**改不了**（服务端第一次作答为准）。所以这里的规矩比学词严得多：
 * 回执没到就不说对错、答案存不上就不许往下走、退出要二次确认。
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { act, fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import LessonTestPage from '../pages/LessonTest';
import { readToken, writeToken } from '../lib/identity';
import { __resetForTest } from '../lib/auth-store';

const navigate = vi.fn();
vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual<typeof import('react-router-dom')>('react-router-dom');
  return { ...actual, useNavigate: () => navigate };
});

type Req = { url: string; init: RequestInit };

// ─────────────────────────────────────────────────────────────
// 线缆 —— 逐字对着 S9B0 之后的服务端响应
// ─────────────────────────────────────────────────────────────

function todayPayload(kind = 'vocab_test') {
  return {
    student: { id: 'x', name: 'n' },
    date: '2026-08-29',
    // href 故意塞旧端地址 —— 页面必须彻底无视它
    nextAction: { kind, label: '开始单词测试', href: '/my-vocab/quiz?name=x' },
    rulesVersion: 4,
    completed: 2, total: 3, allDone: false, streakDays: 2,
    targetsFrozenAt: null, stage: 'vocab_test', stageAt: null, vocabCursor: 4,
    segments: [
      { key: 'read', status: 'done', label: 'The Nile', questionCount: 4, typicalMinutes: 20,
        score: 4, maxScore: 5, scoresPending: false, submissionId: 'sub-1', sessionId: 'sess-1', autoClosed: false },
      { key: 'vocab', status: 'done', progress: 4, target: 4, typicalMinutes: 5, quizScore: { status: 'not_started' } },
      { key: 'drill', status: 'none', progress: 0, target: 0, typicalMinutes: 5 },
    ],
  };
}

/** 未作答的题：S9B0 之后只有 index / qtype / prompt / options。 */
const hidden = (index: number, qtype: string, prompt: string, options: string[]) => ({
  index, qtype, prompt, options,
  headword: null, phonetic: null, translation: null, contextSentence: null,
  correctIndex: null, answer: null,
  studentIndex: null, studentAnswer: null, isCorrect: null, answeredAt: null,
});

/** 四种题型各一道。 */
function baseItems() {
  return [
    hidden(0, 'word_to_meaning', 'harbour', ['n. 港口', 'n. 灯笼', 'n. 草地', 'n. 卵石']),
    hidden(1, 'meaning_to_word', 'n. 灯笼', ['harbour', 'lantern', 'meadow', 'pebble']),
    hidden(2, 'cloze', 'The ＿＿＿ was green.', ['harbour', 'lantern', 'meadow', 'pebble']),
    hidden(3, 'spelling', 'A small ＿＿＿ on the path.', []),
  ];
}

/** 作答之后服务端揭开的那一题。 */
function revealItem(index: number, over: Record<string, unknown> = {}) {
  const base = baseItems()[index];
  return {
    ...base,
    headword: ['harbour', 'lantern', 'meadow', 'pebble'][index],
    phonetic: 'ˈhɑːbə',
    translation: 'n. 港口',
    contextSentence: 'The ships rest in the harbour.',
    correctIndex: base.qtype === 'spelling' ? -1 : index === 0 ? 0 : index,
    answer: base.qtype === 'spelling' ? 'pebble' : null,
    studentIndex: base.qtype === 'spelling' ? null : 0,
    studentAnswer: base.qtype === 'spelling' ? 'pebble' : base.options[0],
    isCorrect: true,
    answeredAt: '2026-08-29T02:00:00.000Z',
    ...over,
  };
}

function attempt(over: Record<string, unknown> = {}) {
  return {
    attemptId: 'att1',
    status: 'in_progress',
    startedAt: '2026-08-29T02:00:00.000Z',
    submittedAt: null,
    total: 4,
    correct: 0,
    score: null,
    items: baseItems(),
    resumed: false,
    ...over,
  };
}

/** 作答回执：整份 items，只有第 index 题揭开。 */
function receipt(index: number, itemOver: Record<string, unknown> = {}, over: Record<string, unknown> = {}) {
  return {
    ...attempt(),
    items: baseItems().map((it, n) => (n === index ? revealItem(index, itemOver) : it)),
    accepted: true,
    ...over,
  };
}

type Reply = { status?: number; body: unknown } | Error;

let reqs: Req[] = [];
let routes: Record<string, (req: Req) => Reply | Promise<Reply>>;

function installFetch() {
  reqs = [];
  vi.stubGlobal(
    'fetch',
    vi.fn(async (url: string, init: RequestInit = {}) => {
      reqs.push({ url, init });
      const key = Object.keys(routes)
        .filter((k) => url.startsWith(k))
        .sort((a, b) => b.length - a.length)[0];
      const r = key ? await routes[key]({ url, init }) : { status: 404, body: { code: 'not_stubbed' } };
      if (r instanceof Error) throw r;
      const status = r.status ?? 200;
      return {
        ok: status >= 200 && status < 300,
        status,
        text: async () => JSON.stringify(r.body),
      } as unknown as Response;
    }),
  );
}

async function settle() {
  await act(async () => {
    for (let i = 0; i < 12; i++) await Promise.resolve();
  });
}

const mount = () =>
  render(
    <MemoryRouter>
      <LessonTestPage />
    </MemoryRouter>,
  );

const calls = (frag: string) => reqs.filter((r) => r.url.includes(frag));
const bodyOf = (r: Req) => JSON.parse(String(r.init.body)) as Record<string, unknown>;

function deferred<T>() {
  let resolve!: (v: T) => void;
  const promise = new Promise<T>((res) => { resolve = res; });
  return { promise, resolve };
}

/** 判定字样 —— 这几个词只在服务端回执之后才允许出现。 */
const VERDICT = /答对了|答错了/;

beforeEach(() => {
  localStorage.clear();
  __resetForTest();
  navigate.mockClear();
  writeToken('TK');
  installFetch();
  routes = {
    '/api/lesson/today': () => ({ body: todayPayload() }),
    '/api/vocab/quiz/attempt/start': () => ({ body: attempt() }),
    '/api/vocab/quiz/attempt/answer': ({ init }) => ({
      body: receipt(Number(JSON.parse(String(init.body)).index)),
    }),
    '/api/vocab/quiz/attempt/submit': () => ({
      body: { ...attempt({ status: 'submitted', submittedAt: 'x', total: 4, correct: 3, score: 75 }), alreadySubmitted: false },
    }),
  };
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

// ─────────────────────────────────────────────────────────────
// AC-02 / AC-03 入口与恢复
// ─────────────────────────────────────────────────────────────

describe('AC-03 入口只认 /lesson/today 的 kind', () => {
  it('**先问今天的课，再开考**；请求体精确为 {}', async () => {
    mount();
    await settle();
    expect(reqs[0].url).toBe('/api/lesson/today');
    const s = calls('/quiz/attempt/start');
    expect(s).toHaveLength(1);
    expect(s[0].init.method).toBe('POST');
    expect(bodyOf(s[0])).toEqual({});
    expect(screen.getByTestId('question')).toBeInTheDocument();
  });

  it('**每条请求都零身份**：没有查询串、没有 hash，令牌走 Authorization', async () => {
    mount();
    await settle();
    for (const r of reqs) {
      expect(r.url).not.toMatch(/[?&#]/);
      expect(r.url).not.toMatch(/name=|studentId=|then=|after=/);
      expect((r.init.headers as Record<string, string>).Authorization).toBe('Bearer TK');
      if (r.init.body) expect(String(r.init.body)).not.toMatch(/"name"|"studentName"|"studentId"/);
    }
  });

  it('**kind=summary → replace 到今日总结**，不开考', async () => {
    routes['/api/lesson/today'] = () => ({ body: todayPayload('summary') });
    mount();
    await settle();
    expect(navigate).toHaveBeenCalledWith('/lesson/summary', { replace: true });
    expect(calls('/quiz/attempt/start')).toHaveLength(0);
  });

  it('**其它 kind → replace 回 /today**，不开考', async () => {
    routes['/api/lesson/today'] = () => ({ body: todayPayload('learn_vocab') });
    mount();
    await settle();
    expect(navigate).toHaveBeenCalledWith('/today', { replace: true });
    expect(calls('/quiz/attempt/start')).toHaveLength(0);
  });

  it('**恢复：落到第一道没答的题**，答过的不重发', async () => {
    routes['/api/vocab/quiz/attempt/start'] = () => ({
      body: attempt({
        resumed: true,
        items: baseItems().map((it, n) => (n < 2 ? revealItem(n) : it)),
      }),
    });
    mount();
    await settle();
    expect(screen.getByTestId('progress').textContent).toContain('3 / 4');
    expect(screen.getByTestId('question').textContent).toContain('The ＿＿＿ was green.');
    expect(calls('/quiz/attempt/answer')).toHaveLength(0);
  });

  it('**全答完但还没交卷 → 直接进交卷步骤**', async () => {
    routes['/api/vocab/quiz/attempt/start'] = () => ({
      body: attempt({ resumed: true, items: baseItems().map((_, n) => revealItem(n)) }),
    });
    mount();
    await settle();
    expect(screen.getByTestId('submit')).toBeInTheDocument();
    expect(screen.queryByTestId('question')).toBeNull();
  });

  it('**已交卷 → 直接给成绩，绝不再开一份**', async () => {
    routes['/api/vocab/quiz/attempt/start'] = () => ({
      body: attempt({
        status: 'submitted', submittedAt: 'x', total: 4, correct: 3, score: 75, resumed: true,
        items: baseItems().map((_, n) => revealItem(n)),
      }),
    });
    mount();
    await settle();
    expect(screen.getByTestId('score').textContent).toContain('75');
    expect(calls('/quiz/attempt/submit')).toHaveLength(0);
    expect(screen.queryByTestId('question')).toBeNull();
  });

  it('**no_task → 回 /today**', async () => {
    routes['/api/vocab/quiz/attempt/start'] = () => ({ status: 409, body: { code: 'no_task' } });
    mount();
    await settle();
    expect(navigate).toHaveBeenCalledWith('/today', { replace: true });
  });

  it('**stage_not_ready → 回 /today**', async () => {
    routes['/api/vocab/quiz/attempt/start'] = () => ({ status: 409, body: { code: 'stage_not_ready' } });
    mount();
    await settle();
    expect(navigate).toHaveBeenCalledWith('/today', { replace: true });
  });

  for (const code of ['not_ready', 'insufficient_items'] as const) {
    it(`**${code} → 说清楚考不了，只给回今天的课**，绝不退回自由练习`, async () => {
      routes['/api/vocab/quiz/attempt/start'] = () => ({ status: 409, body: { code } });
      mount();
      await settle();
      expect(screen.getByTestId('unavailable')).toBeInTheDocument();
      expect(screen.getByTestId('back-to-today')).toBeInTheDocument();
      expect(navigate).not.toHaveBeenCalled();
      // 自由练习的端点是 `GET /vocab/quiz`（正式测试那三条都在
      // `/vocab/quiz/attempt/*` 下）—— 精确比对路径，别把自己也算进去。
      expect(reqs.filter((r) => /\/api\/vocab\/quiz(\?|$)/.test(r.url))).toHaveLength(0);
      expect(document.body.textContent).not.toContain('自由练习');
    });
  }

  it('**网络坏了：停在这一页，给重试**', async () => {
    routes['/api/vocab/quiz/attempt/start'] = () => new Error('offline');
    mount();
    await settle();
    expect(screen.getByTestId('retry-load')).toBeInTheDocument();
    expect(navigate).not.toHaveBeenCalled();
    routes['/api/vocab/quiz/attempt/start'] = () => ({ body: attempt() });
    fireEvent.click(screen.getByTestId('retry-load'));
    await settle();
    expect(screen.getByTestId('question')).toBeInTheDocument();
  });

  it('**令牌失效 → 走既有登出**', async () => {
    routes['/api/lesson/today'] = () => ({ status: 401, body: { code: 'token_revoked' } });
    mount();
    await settle();
    expect(readToken()).toBeNull();
  });
});

// ─────────────────────────────────────────────────────────────
// AC-04 四种题型
// ─────────────────────────────────────────────────────────────

describe('AC-04 四种题型都渲染，且只用服务端给的材料', () => {
  it('**一次只出一道**，带「计入成绩」和进度', async () => {
    mount();
    await settle();
    expect(screen.getAllByTestId('question')).toHaveLength(1);
    expect(screen.getByTestId('scored-badge').textContent).toContain('计入成绩');
    expect(screen.getByTestId('progress').textContent).toContain('1 / 4');
  });

  it('三种选择题：题干 + 四个选项', async () => {
    mount();
    await settle();
    expect(screen.getByTestId('question').textContent).toContain('harbour');
    expect(screen.getAllByTestId(/^option-/)).toHaveLength(4);
  });

  it('**拼写题是自由文本，不给任何提示**', async () => {
    routes['/api/vocab/quiz/attempt/start'] = () => ({
      body: attempt({ items: baseItems().map((_, n) => (n < 3 ? revealItem(n) : baseItems()[3])) }),
    });
    mount();
    await settle();
    expect(screen.getByTestId('spelling-input')).toBeInTheDocument();
    expect(screen.queryAllByTestId(/^option-/)).toHaveLength(0);
    const text = document.body.textContent ?? '';
    for (const w of ['首字母', '个字母', '意思：', '提示']) {
      expect(text, `拼写题上出现了「${w}」`).not.toContain(w);
    }
  });

  it('**作答前不显示任何被遮起来的东西**', async () => {
    mount();
    await settle();
    const text = document.body.textContent ?? '';
    // 这些只出现在回执里
    expect(text).not.toContain('ˈhɑːbə');
    expect(text).not.toContain('The ships rest in the harbour.');
    expect(screen.queryByText(VERDICT)).toBeNull();
  });
});

// ─────────────────────────────────────────────────────────────
// AC-05 作答：服务端说了算
// ─────────────────────────────────────────────────────────────

describe('AC-05 作答', () => {
  it('**一次作答一个请求**，请求体精确', async () => {
    mount();
    await settle();
    fireEvent.click(screen.getByTestId('option-0'));
    await settle();
    const a = calls('/quiz/attempt/answer');
    expect(a).toHaveLength(1);
    expect(a[0].init.method).toBe('POST');
    expect(bodyOf(a[0])).toEqual({ index: 0, optionIndex: 0 });
  });

  it('**拼写题发 text**，请求体精确', async () => {
    routes['/api/vocab/quiz/attempt/start'] = () => ({
      body: attempt({ items: baseItems().map((_, n) => (n < 3 ? revealItem(n) : baseItems()[3])) }),
    });
    mount();
    await settle();
    fireEvent.change(screen.getByTestId('spelling-input'), { target: { value: ' pebble ' } });
    fireEvent.click(screen.getByTestId('spelling-submit'));
    await settle();
    expect(bodyOf(calls('/quiz/attempt/answer')[0])).toEqual({ index: 3, text: 'pebble' });
  });

  it('**回执没到就不说对错**，也不许往下走', async () => {
    const d = deferred<Reply>();
    routes['/api/vocab/quiz/attempt/answer'] = () => d.promise;

    mount();
    await settle();
    fireEvent.click(screen.getByTestId('option-0'));
    await settle();
    expect(screen.queryByText(VERDICT)).toBeNull();
    expect(screen.queryByTestId('next')).toBeNull();
    expect((screen.getByTestId('option-1') as HTMLButtonElement).disabled).toBe(true);

    d.resolve({ body: receipt(0) });
    await settle();
    expect(screen.getByText('答对了')).toBeInTheDocument();
  });

  it('**答对：反馈来自回执**（音标 / 释义 / 原句都只可能来自它）', async () => {
    mount();
    await settle();
    fireEvent.click(screen.getByTestId('option-0'));
    await settle();
    const fb = screen.getByTestId('feedback');
    expect(fb.textContent).toContain('答对了');
    expect(fb.textContent).toContain('harbour');
    expect(fb.textContent).toContain('ˈhɑːbə');
    expect(screen.getByTestId('option-0').textContent).toContain('✓');
  });

  it('**答错：按回执的 correctIndex 标出正确项**', async () => {
    routes['/api/vocab/quiz/attempt/answer'] = () => ({
      body: receipt(0, { isCorrect: false, studentIndex: 1, studentAnswer: 'n. 灯笼', correctIndex: 2 }),
    });
    mount();
    await settle();
    fireEvent.click(screen.getByTestId('option-1'));
    await settle();
    expect(screen.getByTestId('feedback').textContent).toContain('答错了');
    expect(screen.getByTestId('option-2').textContent).toContain('✓');
  });

  it('**拼写题答错：显示回执里的正确拼写**', async () => {
    routes['/api/vocab/quiz/attempt/start'] = () => ({
      body: attempt({ items: baseItems().map((_, n) => (n < 3 ? revealItem(n) : baseItems()[3])) }),
    });
    routes['/api/vocab/quiz/attempt/answer'] = () => ({
      body: receipt(3, { isCorrect: false, studentAnswer: 'peble', answer: 'pebble' }),
    });
    mount();
    await settle();
    fireEvent.change(screen.getByTestId('spelling-input'), { target: { value: 'peble' } });
    fireEvent.click(screen.getByTestId('spelling-submit'));
    await settle();
    expect(screen.getByTestId('feedback').textContent).toContain('答错了');
    expect(screen.getByTestId('feedback').textContent).toContain('pebble');
  });

  it('**连点两下只发一个作答请求**', async () => {
    mount();
    await settle();
    const btn = screen.getByTestId('option-0');
    fireEvent.click(btn);
    fireEvent.click(screen.getByTestId('option-1'));
    await settle();
    expect(calls('/quiz/attempt/answer')).toHaveLength(1);
  });

  it('**失败：留住选择、停在原题、给重试、不自己判、不许往下走**', async () => {
    routes['/api/vocab/quiz/attempt/answer'] = () => new Error('offline');
    mount();
    await settle();
    fireEvent.click(screen.getByTestId('option-1'));
    await settle();
    expect(screen.getByTestId('answer-failed')).toBeInTheDocument();
    expect(screen.queryByText(VERDICT)).toBeNull();
    expect(screen.queryByTestId('next')).toBeNull();
    expect(screen.getByTestId('progress').textContent).toContain('1 / 4');
    expect(screen.getByTestId('option-1').getAttribute('data-chosen')).toBe('true');
  });

  it('**重试打的是一模一样的载荷**，成功后按回执给反馈', async () => {
    let n = 0;
    routes['/api/vocab/quiz/attempt/answer'] = ({ init }) =>
      ++n === 1 ? new Error('offline') : { body: receipt(Number(JSON.parse(String(init.body)).index)) };
    mount();
    await settle();
    fireEvent.click(screen.getByTestId('option-0'));
    await settle();
    fireEvent.click(screen.getByTestId('answer-retry'));
    await settle();
    const bodies = calls('/quiz/attempt/answer').map(bodyOf);
    expect(bodies).toHaveLength(2);
    expect(bodies[0]).toEqual(bodies[1]);
    expect(screen.getByTestId('feedback').textContent).toContain('答对了');
  });

  it('**already_answered：照回执里第一次存下的答案显示**，继续正常往下', async () => {
    routes['/api/vocab/quiz/attempt/answer'] = () => ({
      body: receipt(0, { isCorrect: false, studentIndex: 3, studentAnswer: 'n. 卵石', correctIndex: 0 },
        { accepted: false, reason: 'already_answered' }),
    });
    mount();
    await settle();
    fireEvent.click(screen.getByTestId('option-1'));
    await settle();
    expect(screen.getByTestId('feedback').textContent).toContain('答错了');
    expect(screen.getByTestId('option-0').textContent).toContain('✓');
    expect(screen.getByTestId('next')).toBeInTheDocument();
  });

  it('**作答时令牌失效 → 走既有登出**', async () => {
    routes['/api/vocab/quiz/attempt/answer'] = () => ({ status: 401, body: { code: 'token_revoked' } });
    mount();
    await settle();
    fireEvent.click(screen.getByTestId('option-0'));
    await settle();
    expect(readToken()).toBeNull();
  });
});

// ─────────────────────────────────────────────────────────────
// AC-06 退出二次确认
// ─────────────────────────────────────────────────────────────

describe('AC-06 考试中退出要二次确认', () => {
  it('**点退出 → 弹确认**；取消留在原地', async () => {
    mount();
    await settle();
    fireEvent.click(screen.getByTestId('exit'));
    expect(screen.getByRole('dialog')).toBeInTheDocument();
    fireEvent.click(screen.getByTestId('exit-cancel'));
    expect(screen.queryByRole('dialog')).toBeNull();
    expect(navigate).not.toHaveBeenCalled();
    expect(screen.getByTestId('question')).toBeInTheDocument();
  });

  it('**确认 → 回 /today，且不交卷**', async () => {
    mount();
    await settle();
    fireEvent.click(screen.getByTestId('exit'));
    fireEvent.click(screen.getByTestId('exit-confirm'));
    expect(navigate).toHaveBeenCalledWith('/today');
    expect(calls('/quiz/attempt/submit')).toHaveLength(0);
  });

  it('**浏览器返回键触发同一个确认**，只弹一次', async () => {
    mount();
    await settle();
    await act(async () => { window.dispatchEvent(new PopStateEvent('popstate')); });
    expect(screen.getAllByRole('dialog')).toHaveLength(1);
    expect(navigate).not.toHaveBeenCalled();
  });

  it('**装了 beforeunload**，交卷之后卸掉', async () => {
    const add = vi.spyOn(window, 'addEventListener');
    const remove = vi.spyOn(window, 'removeEventListener');
    routes['/api/vocab/quiz/attempt/start'] = () => ({
      body: attempt({ resumed: true, items: baseItems().map((_, n) => revealItem(n)) }),
    });
    mount();
    await settle();
    expect(add.mock.calls.some((c) => c[0] === 'beforeunload')).toBe(true);

    fireEvent.click(screen.getByTestId('submit'));
    fireEvent.click(screen.getByTestId('submit-confirm'));
    await settle();
    expect(remove.mock.calls.some((c) => c[0] === 'beforeunload')).toBe(true);
  });

  it('**卸载时把监听拆干净**', async () => {
    const remove = vi.spyOn(window, 'removeEventListener');
    const view = mount();
    await settle();
    view.unmount();
    for (const ev of ['beforeunload', 'popstate']) {
      expect(remove.mock.calls.some((c) => c[0] === ev), ev).toBe(true);
    }
  });

  it('**交卷之后退出不再拦**', async () => {
    routes['/api/vocab/quiz/attempt/start'] = () => ({
      body: attempt({
        status: 'submitted', submittedAt: 'x', total: 4, correct: 3, score: 75,
        items: baseItems().map((_, n) => revealItem(n)),
      }),
    });
    mount();
    await settle();
    expect(screen.queryByTestId('exit')).toBeNull();
  });
});

// ─────────────────────────────────────────────────────────────
// AC-07 交卷与完成
// ─────────────────────────────────────────────────────────────

describe('AC-07 交卷', () => {
  function allAnswered() {
    routes['/api/vocab/quiz/attempt/start'] = () => ({
      body: attempt({ resumed: true, items: baseItems().map((_, n) => revealItem(n)) }),
    });
  }

  it('**没答完就没有交卷入口**', async () => {
    mount();
    await settle();
    expect(screen.queryByTestId('submit')).toBeNull();
  });

  it('**交卷要二次确认**，说清楚交完改不了', async () => {
    allAnswered();
    mount();
    await settle();
    fireEvent.click(screen.getByTestId('submit'));
    expect(screen.getByRole('dialog').textContent).toMatch(/改不了|不能再改/);
    expect(calls('/quiz/attempt/submit')).toHaveLength(0);
    fireEvent.click(screen.getByTestId('submit-confirm'));
    await settle();
    expect(calls('/quiz/attempt/submit')).toHaveLength(1);
    expect(bodyOf(calls('/quiz/attempt/submit')[0])).toEqual({});
  });

  it('**连点确认只发一个提交**', async () => {
    allAnswered();
    mount();
    await settle();
    fireEvent.click(screen.getByTestId('submit'));
    const btn = screen.getByTestId('submit-confirm');
    fireEvent.click(btn);
    fireEvent.click(btn);
    await settle();
    expect(calls('/quiz/attempt/submit')).toHaveLength(1);
  });

  it('**提交失败：停在这一页，给重试**', async () => {
    allAnswered();
    routes['/api/vocab/quiz/attempt/submit'] = () => new Error('offline');
    mount();
    await settle();
    fireEvent.click(screen.getByTestId('submit'));
    fireEvent.click(screen.getByTestId('submit-confirm'));
    await settle();
    expect(screen.getByTestId('submit-failed')).toBeInTheDocument();
    expect(navigate).not.toHaveBeenCalled();
  });

  it('**成绩取落库的 correct / total / score**', async () => {
    allAnswered();
    mount();
    await settle();
    fireEvent.click(screen.getByTestId('submit'));
    fireEvent.click(screen.getByTestId('submit-confirm'));
    await settle();
    expect(screen.getByTestId('score').textContent).toContain('75');
    expect(screen.getByTestId('score-detail').textContent).toContain('3 / 4');
  });

  it('**alreadySubmitted 也照样显示成绩**', async () => {
    allAnswered();
    routes['/api/vocab/quiz/attempt/submit'] = () => ({
      body: { ...attempt({ status: 'submitted', submittedAt: 'x', total: 4, correct: 2, score: 50 }), alreadySubmitted: true },
    });
    mount();
    await settle();
    fireEvent.click(screen.getByTestId('submit'));
    fireEvent.click(screen.getByTestId('submit-confirm'));
    await settle();
    expect(screen.getByTestId('score').textContent).toContain('50');
  });

  it('**完成后重新问 today**：summary → 今日总结', async () => {
    allAnswered();
    mount();
    await settle();
    fireEvent.click(screen.getByTestId('submit'));
    fireEvent.click(screen.getByTestId('submit-confirm'));
    await settle();
    routes['/api/lesson/today'] = () => ({ body: todayPayload('summary') });
    fireEvent.click(screen.getByTestId('finish'));
    await settle();
    expect(navigate).toHaveBeenCalledWith('/lesson/summary', { replace: true });
  });

  it('**其它 kind → 回 /today**，且从头到尾没去过别的地方（G4）', async () => {
    allAnswered();
    mount();
    await settle();
    fireEvent.click(screen.getByTestId('submit'));
    fireEvent.click(screen.getByTestId('submit-confirm'));
    await settle();
    routes['/api/lesson/today'] = () => ({ body: todayPayload('all_done') });
    fireEvent.click(screen.getByTestId('finish'));
    await settle();
    expect(navigate).toHaveBeenCalledWith('/today', { replace: true });
    for (const c of navigate.mock.calls) {
      expect(['/today', '/lesson/summary']).toContain(String(c[0]));
    }
  });
});

// ─────────────────────────────────────────────────────────────
// AC-08 与自由练习彻底分开
// ─────────────────────────────────────────────────────────────

describe('AC-08 只有正式测试这一条写路径', () => {
  it('**全程只打这四个端点**', async () => {
    routes['/api/vocab/quiz/attempt/start'] = () => ({
      body: attempt({ resumed: true, items: baseItems().map((_, n) => revealItem(n)) }),
    });
    mount();
    await settle();
    fireEvent.click(screen.getByTestId('submit'));
    fireEvent.click(screen.getByTestId('submit-confirm'));
    await settle();
    const paths = [...new Set(reqs.map((r) => r.url.replace('/api', '')))].sort();
    expect(paths).toEqual([
      '/lesson/today',
      '/vocab/quiz/attempt/start',
      '/vocab/quiz/attempt/submit',
    ]);
  });

  it('**一次都不碰自由练习 / 复习 / 学词写入**', async () => {
    mount();
    await settle();
    fireEvent.click(screen.getByTestId('option-0'));
    await settle();
    for (const bad of ['/vocab/due', '/vocab/quiz?', '/vocab/review', '/vocab/mistakes',
                       '/vocab/lesson-cards', '/lesson/vocab-taught', '/lesson/vocab-cursor']) {
      expect(calls(bad), bad).toHaveLength(0);
    }
  });

  it('**没有错题回炉、没有「再练一轮」、没有不计分模式**', async () => {
    mount();
    await settle();
    const text = document.body.textContent ?? '';
    for (const w of ['再练一轮', '不计分', '错题', '回炉', '自由练习', '自测']) {
      expect(text, `出现了「${w}」`).not.toContain(w);
    }
  });
});
