/**
 * AC-02 / AC-06 / AC-07 / AC-08 / AC-09 —— 真页面的行为。
 *
 * 用**真的 `Reading.tsx` + 真的 `ReadingProvider` + 真的 api 客户端**，
 * 只在 `fetch` 这一层打桩。断言全部落在渲染出来的 DOM 与发出去的请求上。
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { act, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import ReadingPage from '../pages/Reading';
import { writeToken } from '../lib/identity';

const navigate = vi.fn();
vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual<typeof import('react-router-dom')>('react-router-dom');
  return { ...actual, useNavigate: () => navigate };
});

type Req = { url: string; init: RequestInit };

const SID = 'sess-1';
const SUB = 'sub-1';

function todayPayload(over: Record<string, unknown> = {}) {
  return {
    student: { id: 'x', name: 'n' },
    date: '2026-08-28',
    nextAction: { kind: 'resume_reading', label: '继续阅读', href: '/morning-quiz/legacy' },
    rulesVersion: 4,
    completed: 0,
    total: 3,
    allDone: false,
    streakDays: 0,
    targetsFrozenAt: null,
    stage: 'reading',
    stageAt: null,
    vocabCursor: 0,
    segments: [
      {
        key: 'read',
        status: 'todo',
        label: 'The Nile',
        questionCount: 2,
        typicalMinutes: 20,
        score: null,
        maxScore: null,
        scoresPending: false,
        submissionId: SUB,
        sessionId: SID,
        autoClosed: false,
      },
      { key: 'vocab', status: 'none', progress: 0, target: 0, typicalMinutes: 5, quizScore: { status: 'not_started' } },
      { key: 'drill', status: 'none', progress: 0, target: 0, typicalMinutes: 5 },
    ],
    ...over,
  };
}

function sessionWire(over: Record<string, unknown> = {}) {
  return {
    sessionId: SID,
    submissionId: SUB,
    quizEnd: new Date(Date.now() + 30 * 60_000).toISOString(),
    regularQuizEnd: new Date(Date.now() - 60_000).toISOString(),
    secondWindowToday: false,
    level: 'olevel',
    paperMode: null,
    mode: 'test',
    paperQuestions: [
      {
        id: 'q1',
        sortOrder: 1,
        marks: 1,
        questionType: 'mcq',
        snapshotContent: { stem: 'Question one' },
        snapshotOptions: [
          { key: 'A', text: 'Alpha' },
          { key: 'B', text: 'Beta' },
        ],
      },
      {
        id: 'q2',
        sortOrder: 2,
        marks: 1,
        questionType: 'mcq',
        snapshotContent: { stem: 'Question two' },
        snapshotOptions: [
          { key: 'A', text: 'Gamma' },
          { key: 'B', text: 'Delta' },
        ],
      },
    ],
    existingAnswers: {},
    ...over,
  };
}

type Route = { status?: number; body: unknown } | ((req: Req) => { status?: number; body: unknown });

let reqs: Req[] = [];
let routes: Record<string, Route> = {};

function installFetch() {
  reqs = [];
  vi.stubGlobal(
    'fetch',
    vi.fn(async (url: string, init: RequestInit) => {
      reqs.push({ url, init });
      const key = Object.keys(routes)
        .filter((k) => url.startsWith(k))
        .sort((a, b) => b.length - a.length)[0];
      const r = key ? routes[key] : undefined;
      if (!r) return { ok: false, status: 404, text: async () => '{}' } as unknown as Response;
      const res = typeof r === 'function' ? r({ url, init }) : r;
      const status = res.status ?? 200;
      return {
        ok: status >= 200 && status < 300,
        status,
        text: async () => JSON.stringify(res.body),
      } as unknown as Response;
    }),
  );
}

async function settle() {
  await act(async () => {
    for (let i = 0; i < 10; i++) await Promise.resolve();
  });
}

function mount() {
  return render(
    <MemoryRouter>
      <ReadingPage />
    </MemoryRouter>,
  );
}

const calls = (fragment: string) => reqs.filter((r) => r.url.includes(fragment));

beforeEach(() => {
  localStorage.clear();
  navigate.mockClear();
  writeToken('TK');
  installFetch();
  routes = {
    '/api/lesson/today': { body: todayPayload() },
    '/api/morning-quiz/sessions/sess-1/answer': { body: { applied: true, clientSeq: 1 } },
    '/api/morning-quiz/sessions/sess-1/submit': { body: { id: SUB, status: 'submitted' } },
    '/api/morning-quiz/sessions/sess-1': { body: sessionWire() },
  };
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.useRealTimers();
});

// ─────────────────────────────────────────────────────────────
// AC-02 资源与线缆契约
// ─────────────────────────────────────────────────────────────

describe('AC-02 资源只来自 /lesson/today', () => {
  it('**先问 /lesson/today 拿 sessionId，再按它去取会话**', async () => {
    mount();
    await settle();
    expect(reqs[0].url).toBe('/api/lesson/today');
    expect(reqs[1].url).toBe('/api/morning-quiz/sessions/sess-1');
    expect(screen.getByText('Question one')).toBeInTheDocument();
  });

  it('**URL / 查询串 / hash 里一个身份或资源参数都没有**', async () => {
    mount();
    await settle();
    for (const r of reqs) {
      expect(r.url).not.toMatch(/[?&#]/);
      expect(r.url).not.toMatch(/name=|studentId=|then=|after=/);
      const h = r.init.headers as Record<string, string>;
      expect(h.Authorization).toBe('Bearer TK');
      if (r.init.body) {
        expect(String(r.init.body)).not.toMatch(/"name"|"studentName"|"studentId"/);
      }
    }
  });

  it('**read 段没有 sessionId → replace 回 /today**', async () => {
    const t = todayPayload();
    (t.segments[0] as Record<string, unknown>).sessionId = null;
    routes['/api/lesson/today'] = { body: t };
    mount();
    await settle();
    expect(navigate).toHaveBeenCalledWith('/today', { replace: true });
    expect(calls('/morning-quiz/sessions')).toHaveLength(0);
  });

  it('**渲染需要的线缆字段全部被归一化出来**', async () => {
    routes['/api/morning-quiz/sessions/sess-1'] = {
      body: sessionWire({ level: 'ielts_authentic', paperMode: 'passage_pick', mode: 'test' }),
    };
    const { api } = await import('../lib/api');
    const r = await api.getReadingSession('TK', SID);
    expect(r.questions).toHaveLength(2);
    expect(r.level).toBe('ielts_authentic');
    expect(r.paperMode).toBe('passage_pick');
    expect(r.mode).toBe('test');
    expect(r.quizEnd).toBeTruthy();
    expect(r.regularQuizEnd).toBeTruthy();
    expect(r.secondWindowToday).toBe(false);
    expect(r.submissionId).toBe(SUB);
    expect(r.existingAnswers).toEqual({});
  });
});

// ─────────────────────────────────────────────────────────────
// AC-06 页面状态与引擎接线
// ─────────────────────────────────────────────────────────────

describe('AC-06 页面状态', () => {
  it('载入态', async () => {
    mount();
    expect(screen.getByText(/载入中/)).toBeInTheDocument();
    await settle();
  });

  it('**会话取不到 → role=alert 并可重试**', async () => {
    routes['/api/morning-quiz/sessions/sess-1'] = { status: 500, body: { message: 'boom' } };
    mount();
    await settle();
    const alert = screen.getByRole('alert');
    expect(alert).toBeInTheDocument();
    routes['/api/morning-quiz/sessions/sess-1'] = { body: sessionWire() };
    await act(async () => {
      screen.getByRole('button', { name: /重试/ }).click();
    });
    await settle();
    expect(screen.getByText('Question one')).toBeInTheDocument();
  });

  it('**离线角标**', async () => {
    mount();
    await settle();
    expect(screen.queryByText(/离线/)).not.toBeInTheDocument();
    await act(async () => {
      Object.defineProperty(navigator, 'onLine', { value: false, configurable: true });
      window.dispatchEvent(new Event('offline'));
    });
    expect(screen.getByText(/离线/)).toBeInTheDocument();
    Object.defineProperty(navigator, 'onLine', { value: true, configurable: true });
  });

  it('**保存失败 → 可见的告警，交卷被挡住**', async () => {
    vi.useFakeTimers();
    mount();
    await settle();
    routes['/api/morning-quiz/sessions/sess-1/answer'] = { status: 500, body: { message: 'nope' } };
    await act(async () => {
      (screen.getAllByRole('radio')[0] as HTMLInputElement).click();
    });
    await act(async () => {
      vi.advanceTimersByTime(700);
    });
    await settle();
    expect(screen.getByTestId('save-error')).toBeInTheDocument();
    expect((screen.getByTestId('submit') as HTMLButtonElement).disabled).toBe(true);
  });

  it('**有未落盘的写时交卷按钮是禁用的**', async () => {
    vi.useFakeTimers();
    mount();
    await settle();
    await act(async () => {
      (screen.getAllByRole('radio')[0] as HTMLInputElement).click();
    });
    expect((screen.getByTestId('submit') as HTMLButtonElement).disabled).toBe(true);
    await act(async () => {
      vi.advanceTimersByTime(700);
    });
    await settle();
    expect((screen.getByTestId('submit') as HTMLButtonElement).disabled).toBe(false);
  });

  it('**superseded → 冲突提示可关闭；重载失败 → 未证实且挡住交卷**', async () => {
    vi.useFakeTimers();
    mount();
    await settle();
    routes['/api/morning-quiz/sessions/sess-1/answer'] = {
      body: { applied: false, superseded: true, clientSeq: 9 },
    };
    routes['/api/morning-quiz/sessions/sess-1'] = {
      body: sessionWire({
        existingAnswers: { q1: { selectedOption: 'B', textAnswer: null, clientSeq: 9, flagged: false } },
      }),
    };
    await act(async () => {
      (screen.getAllByRole('radio')[0] as HTMLInputElement).click();
    });
    await act(async () => {
      vi.advanceTimersByTime(700);
    });
    await settle();
    const notice = screen.getByTestId('conflict-notice');
    expect(notice).toBeInTheDocument();
    await act(async () => {
      screen.getByRole('button', { name: /知道了/ }).click();
    });
    expect(screen.queryByTestId('conflict-notice')).not.toBeInTheDocument();
  });

  it('**重载失败 → 未证实横幅 + 交卷禁用**', async () => {
    vi.useFakeTimers();
    mount();
    await settle();
    routes['/api/morning-quiz/sessions/sess-1/answer'] = {
      body: { applied: false, superseded: true, clientSeq: 9 },
    };
    routes['/api/morning-quiz/sessions/sess-1'] = { status: 500, body: {} };
    await act(async () => {
      (screen.getAllByRole('radio')[0] as HTMLInputElement).click();
    });
    await act(async () => {
      vi.advanceTimersByTime(700);
    });
    await settle();
    expect(screen.getByTestId('unverified')).toBeInTheDocument();
    expect((screen.getByTestId('submit') as HTMLButtonElement).disabled).toBe(true);
  });

  it('**次要标签：警告 + 显式接管**', async () => {
    localStorage.setItem(
      'sw:reading:tab-owner:sess-1',
      JSON.stringify({ tabId: 'other', ts: Date.now() }),
    );
    mount();
    await settle();
    expect(screen.getByTestId('secondary-tab')).toBeInTheDocument();
    await act(async () => {
      screen.getByRole('button', { name: /在这个标签继续/ }).click();
    });
    expect(screen.queryByTestId('secondary-tab')).not.toBeInTheDocument();
  });

  it('**答案、旗标、进度、字号都走引擎**', async () => {
    vi.useFakeTimers();
    mount();
    await settle();
    await act(async () => {
      (screen.getAllByRole('radio')[0] as HTMLInputElement).click();
    });
    await act(async () => {
      vi.advanceTimersByTime(700);
    });
    await settle();
    // 答案确实发到服务端，且带 clientSeq
    const saved = JSON.parse(String(calls('/answer')[0].init.body));
    expect(saved.paperQuestionId).toBe('q1');
    expect(saved.clientSeq).toBe(1);
    // 旗标
    await act(async () => {
      screen.getAllByRole('button', { name: /Flag for review|Flagged for review/ })[0].click();
    });
    expect(screen.getByTestId('flag-count').textContent).toContain('1');
    // 字号
    await act(async () => {
      screen.getByRole('button', { name: /Increase font size/ }).click();
    });
    expect(localStorage.getItem('sw:fontScale')).toBe('1.1');
  });

  it('**页面自己不重复实现自动保存 / 序号 / 离线 / 对账**', async () => {
    const fs = await import('node:fs');
    const path = await import('node:path');
    const src = fs.readFileSync(
      path.resolve(__dirname, '..', 'pages', 'Reading.tsx'),
      'utf8',
    );
    // 页面**可以**把服务端给的序号原样递给引擎（返工 1/2 把这两个映射函数
    // 搬回本文件），但**不许对它做任何运算**，也不许自己实现防抖 / 离线 /
    // 对账。禁的是那些动作，不是字面量。
    for (const banned of [
      'superseded',
      'setTimeout(',
      'navigator.onLine',
      "addEventListener('online'",
      "addEventListener('offline'",
    ]) {
      expect(src, banned).not.toContain(banned);
    }
    // 序号只被读取与转发 —— 没有自增、没有比较、没有算术
    expect(src).not.toMatch(/clientSeq\s*(\+\+|--|[-+*/]=|=[^=]|[<>]=?|\+\s*\d)/);
  });
});

// ─────────────────────────────────────────────────────────────
// AC-07 交卷序列
// ─────────────────────────────────────────────────────────────

describe('AC-07 交卷序列', () => {
  async function openConfirm() {
    await act(async () => {
      screen.getByTestId('submit').click();
    });
  }

  it('**必须二次确认；确认前不发任何 submit**', async () => {
    mount();
    await settle();
    await openConfirm();
    expect(calls('/submit')).toHaveLength(0);
    expect(screen.getByRole('dialog')).toBeInTheDocument();
  });

  it('**确认后：flush → submit(final:true) → 刷 today → 按 kind 路由**', async () => {
    routes['/api/lesson/today'] = { body: todayPayload({ nextAction: { kind: 'read_result', label: '看结果', href: '/my-history?name=x' } }) };
    mount();
    await settle();
    await openConfirm();
    await act(async () => {
      screen.getByRole('button', { name: /确认交卷/ }).click();
    });
    await settle();
    const submits = calls('/submit');
    expect(submits).toHaveLength(1);
    expect(submits[0].init.method).toBe('POST');
    expect(JSON.parse(String(submits[0].init.body))).toEqual({ final: true });
    // 交卷之后又刷了一次 today
    expect(calls('/lesson/today')).toHaveLength(2);
    expect(navigate).toHaveBeenLastCalledWith('/lesson/reading/result');
  });

  it('**后端 href 不参与导航**（today 的 href 指向旧端也不理它）', async () => {
    routes['/api/lesson/today'] = { body: todayPayload({ nextAction: { kind: 'summary', label: '总结', href: '/my-history?name=x' } }) };
    mount();
    await settle();
    await openConfirm();
    await act(async () => {
      screen.getByRole('button', { name: /确认交卷/ }).click();
    });
    await settle();
    expect(navigate).toHaveBeenLastCalledWith('/lesson/summary');
    for (const c of navigate.mock.calls) {
      expect(String(c[0])).not.toMatch(/my-history|morning-quiz/);
    }
  });

  it('**「已交过」的 400 视为已完成，仍然刷 today 并路由**', async () => {
    routes['/api/morning-quiz/sessions/sess-1/submit'] = {
      status: 400,
      body: { message: 'submission already submitted' },
    };
    mount();
    await settle();
    await openConfirm();
    await act(async () => {
      screen.getByRole('button', { name: /确认交卷/ }).click();
    });
    await settle();
    expect(calls('/lesson/today')).toHaveLength(2);
    expect(navigate).toHaveBeenCalled();
    expect(screen.queryByTestId('submit-error')).not.toBeInTheDocument();
  });

  it('**其它 400 不当成已完成 —— 报错并留在页面上**', async () => {
    routes['/api/morning-quiz/sessions/sess-1/submit'] = {
      status: 400,
      body: { code: 'quiz_window_closed' },
    };
    mount();
    await settle();
    await openConfirm();
    await act(async () => {
      screen.getByRole('button', { name: /确认交卷/ }).click();
    });
    await settle();
    expect(screen.getByTestId('submit-error')).toBeInTheDocument();
    expect(navigate).not.toHaveBeenCalled();
  });

  it('**连点确认不会发出两个 submit**', async () => {
    mount();
    await settle();
    await openConfirm();
    await act(async () => {
      const b = screen.getByRole('button', { name: /确认交卷/ });
      b.click();
      b.click();
      b.click();
    });
    await settle();
    expect(calls('/submit')).toHaveLength(1);
  });

  it('**还有未落盘 / 未证实的写时，确认也不发 submit**', async () => {
    vi.useFakeTimers();
    routes['/api/morning-quiz/sessions/sess-1/answer'] = { status: 500, body: {} };
    mount();
    await settle();
    await act(async () => {
      (screen.getAllByRole('radio')[0] as HTMLInputElement).click();
    });
    await act(async () => {
      vi.advanceTimersByTime(700);
    });
    await settle();
    expect((screen.getByTestId('submit') as HTMLButtonElement).disabled).toBe(true);
    expect(calls('/submit')).toHaveLength(0);
  });
});

// ─────────────────────────────────────────────────────────────
// AC-08 时间、导航与退出
// ─────────────────────────────────────────────────────────────

describe('AC-08 时间与退出', () => {
  it('**倒计时用 quizEnd，不是 regularQuizEnd**', async () => {
    vi.useFakeTimers();
    const end = new Date(Date.now() + 5 * 60_000).toISOString();
    routes['/api/morning-quiz/sessions/sess-1'] = {
      body: sessionWire({ quizEnd: end, regularQuizEnd: new Date(Date.now() - 3600_000).toISOString() }),
    };
    mount();
    await settle();
    expect(screen.getByTestId('timer').textContent).toMatch(/0[45]:\d\d/);
  });

  it('**secondWindowToday=false → 确认文案里没有「下午再改」**', async () => {
    mount();
    await settle();
    await act(async () => {
      screen.getByTestId('submit').click();
    });
    expect(screen.getByRole('dialog').textContent).not.toMatch(/下午|第二/);
  });

  it('**secondWindowToday=true → 确认文案提到第二作答时段**', async () => {
    routes['/api/morning-quiz/sessions/sess-1'] = { body: sessionWire({ secondWindowToday: true }) };
    mount();
    await settle();
    await act(async () => {
      screen.getByTestId('submit').click();
    });
    expect(screen.getByRole('dialog').textContent).toMatch(/第二/);
  });

  it('**题号导航可用，旗标计数会变**', async () => {
    mount();
    await settle();
    const cells = screen.getAllByRole('button', { name: /^Question \d/ });
    expect(cells).toHaveLength(2);
    await act(async () => {
      cells[1].click();
    });
    expect(screen.getByText('Question two')).toBeInTheDocument();
  });

  it('**有未保存的答案时 beforeunload 会拦**', async () => {
    vi.useFakeTimers();
    routes['/api/morning-quiz/sessions/sess-1/answer'] = { status: 500, body: {} };
    mount();
    await settle();
    await act(async () => {
      (screen.getAllByRole('radio')[0] as HTMLInputElement).click();
    });
    await act(async () => {
      vi.advanceTimersByTime(700);
    });
    await settle();
    const e = new Event('beforeunload', { cancelable: true });
    window.dispatchEvent(e);
    expect(e.defaultPrevented).toBe(true);
  });

  it('**没有未保存的东西时 beforeunload 不拦**', async () => {
    mount();
    await settle();
    const e = new Event('beforeunload', { cancelable: true });
    window.dispatchEvent(e);
    expect(e.defaultPrevented).toBe(false);
  });

  it('**安全退出回 /today，不是任何旧路由**', async () => {
    mount();
    await settle();
    await act(async () => {
      screen.getByRole('button', { name: /退出/ }).click();
    });
    expect(navigate).toHaveBeenLastCalledWith('/today');
  });

  it('**有未保存内容时退出要先确认，不静默丢弃**', async () => {
    vi.useFakeTimers();
    routes['/api/morning-quiz/sessions/sess-1/answer'] = { status: 500, body: {} };
    mount();
    await settle();
    await act(async () => {
      (screen.getAllByRole('radio')[0] as HTMLInputElement).click();
    });
    await act(async () => {
      vi.advanceTimersByTime(700);
    });
    await settle();
    navigate.mockClear();
    await act(async () => {
      screen.getByRole('button', { name: /退出/ }).click();
    });
    expect(navigate).not.toHaveBeenCalled();
    expect(screen.getByTestId('exit-confirm')).toBeInTheDocument();
  });
});

// ─────────────────────────────────────────────────────────────
// AC-09 可访问性与移动端下限
// ─────────────────────────────────────────────────────────────

describe('AC-09 可访问性', () => {
  it('**每个可编辑输入都有无障碍名字**', async () => {
    routes['/api/morning-quiz/sessions/sess-1'] = {
      body: sessionWire({
        paperQuestions: [
          {
            id: 'q1',
            sortOrder: 1,
            marks: 1,
            questionType: 'short_answer',
            snapshotContent: { stem: 'Write a lot' },
            snapshotOptions: [],
          },
        ],
      }),
    };
    mount();
    await settle();
    for (const el of screen.getAllByRole('textbox')) {
      const name =
        el.getAttribute('aria-label') ??
        (el.getAttribute('id')
          ? document.querySelector(`label[for="${el.getAttribute('id')}"]`)?.textContent
          : null);
      expect(name, el.outerHTML.slice(0, 120)).toBeTruthy();
    }
  });

  it('**错误用 role=alert**', async () => {
    routes['/api/morning-quiz/sessions/sess-1'] = { status: 500, body: {} };
    mount();
    await settle();
    expect(screen.getByRole('alert')).toBeInTheDocument();
  });

  it('**焦点可见 + 44px 触控目标写在样式里**', async () => {
    const fs = await import('node:fs');
    const path = await import('node:path');
    const css = fs.readFileSync(path.resolve(__dirname, '..', 'index.css'), 'utf8');
    expect(css).toMatch(/:focus-visible/);
    expect(css).toMatch(/44px/);
    expect(css).toMatch(/overflow-x\s*:\s*hidden/);
  });

  it('**主要交互控件都带 44px 下限的类**', async () => {
    mount();
    await settle();
    const submit = screen.getByTestId('submit');
    expect(submit.className).toMatch(/min-h-\[44px\]|hit/);
  });
});

// ─────────────────────────────────────────────────────────────
// 返工 1/2 —— B1：页面**恒定**用 test 模式
// ─────────────────────────────────────────────────────────────

describe('B1 页面恒定 test 模式', () => {
  const keyedWire = (mode: string) =>
    sessionWire({
      mode,
      paperQuestions: [
        {
          id: 'q1',
          sortOrder: 1,
          marks: 1,
          questionType: 'mcq',
          snapshotContent: { stem: 'Question one', correctOption: 'B', explanation: '因为 B 最合适' },
          snapshotOptions: [
            { key: 'A', text: 'Alpha' },
            { key: 'B', text: 'Beta' },
          ],
        },
      ],
    });

  it('**线缆说 mode:practice，页面也不给对错反馈与解析**', async () => {
    routes['/api/morning-quiz/sessions/sess-1'] = { body: keyedWire('practice') };
    mount();
    await settle();
    await act(async () => {
      (screen.getAllByRole('radio')[0] as HTMLInputElement).click();
    });
    await settle();
    expect(screen.queryByText(/因为 B 最合适/)).not.toBeInTheDocument();
    expect(screen.queryByText(/Correct/)).not.toBeInTheDocument();
  });

  it('**线缆里 mode 是垃圾值也一样**（不是靠 ?? 兜底才成立）', async () => {
    routes['/api/morning-quiz/sessions/sess-1'] = { body: keyedWire('whatever') };
    mount();
    await settle();
    await act(async () => {
      (screen.getAllByRole('radio')[0] as HTMLInputElement).click();
    });
    await settle();
    expect(screen.queryByText(/因为 B 最合适/)).not.toBeInTheDocument();
  });
});

// ─────────────────────────────────────────────────────────────
// 返工 1/2 —— B3：浏览器返回键
//
// 只挂 `beforeunload` 挡不住 SPA 的返回 —— 那不是页面卸载，是路由切换。
// 学生用返回键退出考试是最常见的动作之一，必须与「退出」按钮同一套判据。
// ─────────────────────────────────────────────────────────────

describe('B3 浏览器返回键', () => {
  const back = async () => {
    await act(async () => {
      window.dispatchEvent(new PopStateEvent('popstate'));
    });
  };

  it('**有未保存内容时返回 → 留在阅读页并弹确认，不导航**', async () => {
    vi.useFakeTimers();
    routes['/api/morning-quiz/sessions/sess-1/answer'] = { status: 500, body: {} };
    mount();
    await settle();
    await act(async () => {
      (screen.getAllByRole('radio')[0] as HTMLInputElement).click();
    });
    await act(async () => {
      vi.advanceTimersByTime(700);
    });
    await settle();
    navigate.mockClear();
    await back();
    expect(navigate).not.toHaveBeenCalled();
    expect(screen.getByTestId('exit-confirm')).toBeInTheDocument();
    // 题目还在 —— 学生没被踢走
    expect(screen.getByText('Question one')).toBeInTheDocument();
  });

  it('**确认之后才去 /today**', async () => {
    vi.useFakeTimers();
    routes['/api/morning-quiz/sessions/sess-1/answer'] = { status: 500, body: {} };
    mount();
    await settle();
    await act(async () => {
      (screen.getAllByRole('radio')[0] as HTMLInputElement).click();
    });
    await act(async () => {
      vi.advanceTimersByTime(700);
    });
    await settle();
    navigate.mockClear();
    await back();
    await act(async () => {
      screen.getByRole('button', { name: /仍然退出/ }).click();
    });
    expect(navigate).toHaveBeenLastCalledWith('/today');
  });

  it('**没有未保存内容时返回 → 直接安全回 /today**', async () => {
    mount();
    await settle();
    navigate.mockClear();
    await back();
    expect(navigate).toHaveBeenLastCalledWith('/today');
    expect(screen.queryByTestId('exit-confirm')).not.toBeInTheDocument();
  });

  it('**返回键永远不去旧路由**', async () => {
    mount();
    await settle();
    navigate.mockClear();
    await back();
    for (const c of navigate.mock.calls) {
      expect(String(c[0])).not.toMatch(/my-history|morning-quiz|scan|student\//);
    }
  });

  it('**卸载后不再响应 popstate**（监听器要摘干净）', async () => {
    const { unmount } = mount();
    await settle();
    unmount();
    navigate.mockClear();
    await back();
    expect(navigate).not.toHaveBeenCalled();
  });
});
