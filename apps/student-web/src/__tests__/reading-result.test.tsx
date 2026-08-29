/**
 * 阶段 8A —— 阅读结果页的行为。
 *
 * 和阅读页同一套打法：**真页面 + 真 api 客户端**，只在 `fetch` 那一层打桩。
 * 断言落在渲染出来的 DOM 和实际发出去的请求上，不去戳组件内部状态 ——
 * 「学生看到了什么、我们向服务端说了什么」才是这一屏的契约。
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { act, fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import ReadingResultPage, {
  percentageOf,
  questionOutcome,
  validateAppealMessage,
} from '../pages/ReadingResult';
import type { ReadingResult, ReadingResultItem } from '../lib/api';
import { readToken, writeToken } from '../lib/identity';

const navigate = vi.fn();
vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual<typeof import('react-router-dom')>('react-router-dom');
  return { ...actual, useNavigate: () => navigate };
});

type Req = { url: string; init: RequestInit };

const SID = 'sess-1';
const SUB = 'sub-1';
const RESULT_URL = `/api/morning-quiz/student-result/${SID}`;

function todayPayload(over: Record<string, unknown> = {}) {
  return {
    student: { id: 'x', name: 'n' },
    date: '2026-08-29',
    nextAction: { kind: 'reading_submitted', label: '看结果', href: '/my-history?name=x' },
    rulesVersion: 4,
    completed: 1,
    total: 3,
    allDone: false,
    streakDays: 2,
    targetsFrozenAt: null,
    stage: 'readingResult',
    stageAt: null,
    vocabCursor: 0,
    segments: [
      {
        key: 'read',
        status: 'done',
        label: 'The Nile',
        questionCount: 4,
        typicalMinutes: 20,
        score: 3,
        maxScore: 5,
        scoresPending: false,
        submissionId: SUB,
        sessionId: SID,
        autoClosed: false,
      },
      {
        key: 'vocab',
        status: 'none',
        progress: 0,
        target: 0,
        typicalMinutes: 5,
        quizScore: { status: 'not_started' },
      },
      { key: 'drill', status: 'none', progress: 0, target: 0, typicalMinutes: 5 },
    ],
    ...over,
  };
}

function item(over: Partial<ReadingResultItem> = {}): ReadingResultItem {
  return {
    paperQuestionId: 'q1',
    sortOrder: 1,
    marks: 1,
    questionType: 'mcq',
    snapshotContent: { stem: 'Question one' },
    snapshotOptions: [
      { key: 'A', text: 'Alpha' },
      { key: 'B', text: 'Beta' },
    ],
    studentAnswer: 'A',
    correctAnswer: 'A',
    referenceAnswer: null,
    explanation: 'Because Alpha.',
    awardedMarks: 1,
    autoCorrect: true,
    isCorrect: true,
    markerComment: null,
    commentSource: null,
    ...over,
  };
}

/** 四道题，把四种结局各占一格：对 / 错 / 部分 / 没答。 */
function resultPayload(over: Partial<ReadingResult> = {}): ReadingResult {
  return {
    sessionId: SID,
    paperName: 'The Nile',
    submissionId: SUB,
    status: 'submitted',
    finalSubmittedAt: '2026-08-29T01:00:00.000Z',
    autoScore: 2,
    manualScore: 1,
    totalScore: 3,
    maxScore: 5,
    submittedAt: '2026-08-29T00:55:00.000Z',
    items: [
      item(),
      item({
        paperQuestionId: 'q2',
        sortOrder: 2,
        snapshotContent: { stem: 'Question two' },
        studentAnswer: 'B',
        correctAnswer: 'A',
        awardedMarks: 0,
        autoCorrect: false,
        isCorrect: false,
        explanation: 'A is right because Nile.',
      }),
      item({
        paperQuestionId: 'q3',
        sortOrder: 3,
        marks: 2,
        questionType: 'short',
        snapshotContent: { stem: 'Question three' },
        snapshotOptions: null,
        studentAnswer: 'A long river',
        correctAnswer: null,
        referenceAnswer: 'The longest river in Africa.',
        explanation: null,
        awardedMarks: 1,
        autoCorrect: null,
        isCorrect: false,
        markerComment: '答到一半，再补一句就满分。',
        commentSource: 'teacher',
      }),
      item({
        paperQuestionId: 'q4',
        sortOrder: 4,
        snapshotContent: { stem: 'Question four' },
        studentAnswer: null,
        awardedMarks: 0,
        autoCorrect: false,
        isCorrect: false,
      }),
    ],
    scoresPending: false,
    answersPending: false,
    ...over,
  };
}

/** 改写今天的课里的 `read` 段 —— 两个标识和状态都从这里来。 */
function todayWithRead(over: Record<string, unknown>) {
  const t = todayPayload();
  Object.assign(t.segments[0] as Record<string, unknown>, over);
  return t;
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
      <ReadingResultPage />
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
    [RESULT_URL]: { body: resultPayload() },
    '/api/morning-quiz/appeals': { body: { appealId: 'ap-1', status: 'open' } },
  };
});

afterEach(() => {
  vi.unstubAllGlobals();
});

// ─────────────────────────────────────────────────────────────
// AC-03 资源链路
// ─────────────────────────────────────────────────────────────

describe('AC-03 资源只来自 /lesson/today，URL 不带身份', () => {
  it('**先问今天的课拿 sessionId，再按它取结果**', async () => {
    mount();
    await settle();
    expect(reqs[0].url).toBe('/api/lesson/today');
    expect(reqs[1].url).toBe(RESULT_URL);
    expect(screen.getByText('The Nile')).toBeInTheDocument();
  });

  it('**每条请求都零身份**：没有查询串、没有 hash、令牌走 Authorization', async () => {
    mount();
    await settle();
    for (const r of reqs) {
      expect(r.url).not.toMatch(/[?&#]/);
      expect(r.url).not.toMatch(/name=|studentId=|then=|after=/);
      expect((r.init.headers as Record<string, string>).Authorization).toBe('Bearer TK');
      if (r.init.body) {
        expect(String(r.init.body)).not.toMatch(/"name"|"studentName"|"studentId"/);
      }
    }
  });

  it('**read 段没有 sessionId → replace 回 /today**，不去取结果', async () => {
    routes['/api/lesson/today'] = { body: todayWithRead({ sessionId: null }) };
    mount();
    await settle();
    expect(navigate).toHaveBeenCalledWith('/today', { replace: true });
    expect(calls('student-result')).toHaveLength(0);
  });

  it('**服务端说没有答卷 → 回 /today**，不是停在报错页', async () => {
    routes[RESULT_URL] = { status: 404, body: { code: 'no_submission' } };
    mount();
    await settle();
    expect(navigate).toHaveBeenCalledWith('/today', { replace: true });
  });

  it('**会话不存在（换了一天 / 卷子被撤）→ 回 /today**', async () => {
    routes[RESULT_URL] = { status: 404, body: { code: 'session_not_found' } };
    mount();
    await settle();
    expect(navigate).toHaveBeenCalledWith('/today', { replace: true });
  });

  it('**还没交卷就来看结果 → 明确提示，不跳旧页**', async () => {
    routes[RESULT_URL] = { status: 403, body: { code: 'result_locked_until_submit' } };
    mount();
    await settle();
    expect(screen.getByTestId('locked')).toBeInTheDocument();
    expect(navigate).not.toHaveBeenCalled();
  });

  it('**网络坏了是可重试的**：给重试按钮，按下去真的再取一次', async () => {
    routes[RESULT_URL] = () => {
      throw new Error('offline');
    };
    mount();
    await settle();
    expect(screen.getByText(/网络不太好/)).toBeInTheDocument();

    routes[RESULT_URL] = { body: resultPayload() };
    fireEvent.click(screen.getByText('重试'));
    await settle();
    expect(screen.getByTestId('summary')).toBeInTheDocument();
  });

  it('**令牌失效 → 走既有的登出**（清票，不去姓名页）', async () => {
    routes[RESULT_URL] = { status: 401, body: { code: 'student_token_required' } };
    mount();
    await settle();
    expect(readToken()).toBeNull();
    expect(navigate).not.toHaveBeenCalledWith('/my-history', expect.anything());
  });

  it('**从头到尾没有写操作**：不存答案、不交卷、不开课', async () => {
    mount();
    await settle();
    expect(calls('/answer')).toHaveLength(0);
    expect(calls('/submit')).toHaveLength(0);
    expect(calls('/lesson/start')).toHaveLength(0);
    for (const r of reqs) expect(r.init.method === 'PATCH').toBe(false);
  });
});

// ─────────────────────────────────────────────────────────────
// AC-03（返工 1/2）—— 两个标识都必须来自认证过的 /lesson/today，
// 并且必须和结果响应对得上。
//
// 这一组的共同点：**失败一律 fail-closed** —— 回 `/today`，不取结果、
// 不渲染任何答卷内容、不给申诉入口。申诉是写操作，它认的 submissionId
// 只能来自这条链，不能来自结果响应自己。
// ─────────────────────────────────────────────────────────────

describe('AC-03 资源标识必须成对且经过核对', () => {
  const noResultUi = () => {
    expect(screen.queryByTestId('summary')).toBeNull();
    expect(screen.queryByTestId('items')).toBeNull();
    expect(screen.queryByTestId('appeal-whole-open')).toBeNull();
  };

  it('**read 段没有 submissionId → 回 /today**，不去取结果', async () => {
    routes['/api/lesson/today'] = { body: todayWithRead({ submissionId: null }) };
    mount();
    await settle();
    expect(navigate).toHaveBeenCalledWith('/today', { replace: true });
    expect(calls('student-result')).toHaveLength(0);
    noResultUi();
  });

  it('**根本没有 read 段 → 回 /today**', async () => {
    const t = todayPayload();
    t.segments = t.segments.filter((seg) => (seg as { key: string }).key !== 'read');
    routes['/api/lesson/today'] = { body: t };
    mount();
    await settle();
    expect(navigate).toHaveBeenCalledWith('/today', { replace: true });
    expect(calls('student-result')).toHaveLength(0);
  });

  // 还在做题 / 今天没有阅读 —— 这三种状态下没有可回顾的答卷。
  for (const status of ['todo', 'partial', 'none'] as const) {
    it(`**read 段还是 \`${status}\` → 回 /today**，不去取结果`, async () => {
      routes['/api/lesson/today'] = { body: todayWithRead({ status }) };
      mount();
      await settle();
      expect(navigate).toHaveBeenCalledWith('/today', { replace: true });
      expect(calls('student-result')).toHaveLength(0);
      noResultUi();
    });
  }

  // 真正做完只有两种：自己交的，和窗口关闭时被系统收走的。
  for (const status of ['done', 'auto_closed'] as const) {
    it(`**read 段是 \`${status}\` → 放行**，结果正常显示`, async () => {
      routes['/api/lesson/today'] = { body: todayWithRead({ status }) };
      mount();
      await settle();
      expect(calls('student-result')).toHaveLength(1);
      expect(screen.getByTestId('summary')).toBeInTheDocument();
      expect(navigate).not.toHaveBeenCalled();
    });
  }

  it('**响应的 sessionId 对不上 → 回 /today**，一个字都不显示', async () => {
    routes[RESULT_URL] = { body: resultPayload({ sessionId: 'sess-somebody-else' }) };
    mount();
    await settle();
    expect(navigate).toHaveBeenCalledWith('/today', { replace: true });
    noResultUi();
  });

  it('**响应的 submissionId 对不上 → 回 /today**，也不给申诉入口', async () => {
    routes[RESULT_URL] = { body: resultPayload({ submissionId: 'sub-somebody-else' }) };
    mount();
    await settle();
    expect(navigate).toHaveBeenCalledWith('/today', { replace: true });
    noResultUi();
    expect(calls('/appeals')).toHaveLength(0);
  });

  it('**核对通过之后，申诉用的是这条链上的 submissionId**', async () => {
    // 两边一致，但换成一个与默认值不同的 id —— 证明发出去的确实是取回来的
    // 那一个，不是测试里恰好写死的常量。
    const verified = 'sub-verified';
    routes['/api/lesson/today'] = { body: todayWithRead({ submissionId: verified }) };
    routes[RESULT_URL] = { body: resultPayload({ submissionId: verified }) };
    mount();
    await settle();
    fireEvent.click(screen.getByTestId('appeal-whole-open'));
    fireEvent.change(screen.getByTestId('appeal-whole-input'), {
      target: { value: '核对之后再申诉' },
    });
    fireEvent.click(screen.getByTestId('appeal-whole-submit'));
    await settle();
    const sent = calls('/appeals');
    expect(sent).toHaveLength(1);
    expect(JSON.parse(String(sent[0].init.body))).toEqual({
      submissionId: verified,
      message: '核对之后再申诉',
    });
  });
});

// ─────────────────────────────────────────────────────────────
// AC-04 总览
// ─────────────────────────────────────────────────────────────

describe('AC-04 成绩总览按服务端的两道门显示', () => {
  it('分数放出来了 → 显示得分 / 满分 / 百分比', async () => {
    mount();
    await settle();
    expect(screen.getByTestId('score').textContent).toBe('3');
    expect(screen.getByTestId('summary').textContent).toContain('/ 5 分');
    expect(screen.getByTestId('percentage').textContent).toBe('60%');
  });

  it('**还在判分 → 说「还在判分」，绝不补一个 0 分**', async () => {
    routes[RESULT_URL] = {
      body: resultPayload({
        scoresPending: true,
        autoScore: null,
        manualScore: null,
        totalScore: null,
        maxScore: null,
        items: [item({ awardedMarks: null, isCorrect: null, autoCorrect: null })],
      }),
    };
    mount();
    await settle();
    expect(screen.getByTestId('scores-pending')).toBeInTheDocument();
    expect(screen.queryByTestId('score')).toBeNull();
    expect(screen.queryByTestId('percentage')).toBeNull();
    expect(screen.getByTestId('summary').textContent).not.toMatch(/\b0\b/);
  });

  it('**答案没放出来 → 明说没放，且一个字的答案材料都不渲染**（哪怕夹具里有）', async () => {
    routes[RESULT_URL] = {
      body: resultPayload({
        answersPending: true,
        // 故意把三样答案材料塞进夹具 —— 真服务端会置空，这里要证明**前端自己
        // 也挡得住**，不是靠上游好心。
        items: [
          item({ correctAnswer: 'A', explanation: 'LEAKED-EXPLANATION' }),
          item({
            paperQuestionId: 'q3',
            snapshotContent: { stem: 'Question three' },
            snapshotOptions: null,
            questionType: 'short',
            referenceAnswer: 'LEAKED-REFERENCE',
          }),
        ],
      }),
    };
    mount();
    await settle();
    expect(screen.getByTestId('answers-pending')).toBeInTheDocument();
    expect(screen.queryByTestId('correct-answer-q1')).toBeNull();
    expect(screen.queryByTestId('explanation-q1')).toBeNull();
    expect(screen.queryByTestId('reference-q3')).toBeNull();
    expect(document.body.textContent).not.toContain('LEAKED-EXPLANATION');
    expect(document.body.textContent).not.toContain('LEAKED-REFERENCE');
  });

  it('显示状态与交卷时间', async () => {
    mount();
    await settle();
    expect(screen.getByTestId('status').textContent).toBe('submitted');
    expect(screen.getByTestId('submitted-at').textContent).toBe('2026-08-29T00:55:00.000Z');
  });

  it('**措辞是账号制的** —— 不出现扫码 / 考勤 / 早测窗 / 姓名查询那一套', async () => {
    mount();
    await settle();
    const text = document.body.textContent ?? '';
    for (const w of ['扫码', '二维码', '考勤', '出勤', '早测窗', '补考', '输入姓名', '查成绩']) {
      expect(text, `措辞里出现了「${w}」`).not.toContain(w);
    }
  });
});

// ─────────────────────────────────────────────────────────────
// AC-05 逐题回顾
// ─────────────────────────────────────────────────────────────

describe('AC-05 逐题回顾', () => {
  it('**按服务端给的顺序渲染**，不自己排', async () => {
    mount();
    await settle();
    const stems = [...document.querySelectorAll('[data-testid^="item-"]')].map((el) =>
      el.textContent?.includes('Question one')
        ? 1
        : el.textContent?.includes('Question two')
          ? 2
          : el.textContent?.includes('Question three')
            ? 3
            : 4,
    );
    expect(stems).toEqual([1, 2, 3, 4]);
  });

  it('选择题：题干、选项、学生答案、正确答案、解析都在，且**选项是只读的**', async () => {
    mount();
    await settle();
    expect(screen.getByText('Question one')).toBeInTheDocument();
    expect(screen.getByTestId('options-q1').textContent).toContain('Alpha');
    expect(screen.getByTestId('student-answer-q1').textContent).toBe('A');
    expect(screen.getByTestId('correct-answer-q1').textContent).toBe('A');
    expect(screen.getByTestId('explanation-q1').textContent).toContain('Because Alpha.');
    // 只读 = 选项里没有任何可勾选的控件
    expect(screen.getByTestId('options-q1').querySelectorAll('input,button')).toHaveLength(0);
  });

  it('简答题：显示参考答案与老师评语', async () => {
    mount();
    await settle();
    expect(screen.getByTestId('reference-q3').textContent).toContain('The longest river');
    expect(screen.getByTestId('comment-q3').textContent).toContain('答到一半');
    expect(screen.getByTestId('comment-q3').textContent).toContain('老师评语');
  });

  it('四种结局各就各位：对 / 错 / 部分 / 没答', async () => {
    mount();
    await settle();
    const outcome = (id: string) =>
      screen.getByTestId(`item-${id}`).getAttribute('data-outcome');
    expect(outcome('q1')).toBe('correct');
    expect(outcome('q2')).toBe('incorrect');
    expect(outcome('q3')).toBe('partial');
    expect(outcome('q4')).toBe('unanswered');
    expect(screen.getByTestId('student-answer-q4').textContent).toBe('（空着）');
  });

  it('**等人工判分的题不显示 0 分**，显示破折号', async () => {
    routes[RESULT_URL] = {
      body: resultPayload({
        items: [
          item({
            paperQuestionId: 'q3',
            questionType: 'short',
            marks: 2,
            snapshotOptions: null,
            studentAnswer: 'something',
            awardedMarks: null,
            autoCorrect: null,
            isCorrect: null,
          }),
        ],
      }),
    };
    mount();
    await settle();
    expect(screen.getByTestId('item-q3').getAttribute('data-outcome')).toBe('pending');
    expect(screen.getByTestId('marks-q3').textContent).toBe('— / 2 分');
  });

  it('分数没放出来时**逐题分数整块不显示**', async () => {
    routes[RESULT_URL] = {
      body: resultPayload({
        scoresPending: true,
        totalScore: null,
        maxScore: null,
        items: [item({ awardedMarks: null, isCorrect: null })],
      }),
    };
    mount();
    await settle();
    expect(screen.queryByTestId('marks-q1')).toBeNull();
    expect(screen.getByTestId('item-q1').getAttribute('data-outcome')).toBe('pending');
  });
});

// ─────────────────────────────────────────────────────────────
// AC-06 申诉
// ─────────────────────────────────────────────────────────────

describe('AC-06 申诉', () => {
  const bodyOf = (r: Req) => JSON.parse(String(r.init.body)) as Record<string, unknown>;

  async function openAndSend(testId: string, text: string) {
    fireEvent.click(screen.getByTestId(`${testId}-open`));
    fireEvent.change(screen.getByTestId(`${testId}-input`), { target: { value: text } });
    fireEvent.click(screen.getByTestId(`${testId}-submit`));
    await settle();
  }

  it('**整份答卷可以申诉**，请求体只有 submissionId + message', async () => {
    mount();
    await settle();
    await openAndSend('appeal-whole', '  这次判分我有疑问  ');
    const sent = calls('/appeals');
    expect(sent).toHaveLength(1);
    expect(sent[0].init.method).toBe('POST');
    // 去掉首尾空白后发出
    expect(bodyOf(sent[0])).toEqual({ submissionId: SUB, message: '这次判分我有疑问' });
    expect(screen.getByTestId('appeal-whole-sent')).toBeInTheDocument();
  });

  it('**判错 / 部分得分的题才给申诉入口**，判对和没答的不给', async () => {
    mount();
    await settle();
    expect(screen.queryByTestId('appeal-q-q2-open')).toBeInTheDocument();
    expect(screen.queryByTestId('appeal-q-q3-open')).toBeInTheDocument();
    expect(screen.queryByTestId('appeal-q-q1-open')).toBeNull();
    expect(screen.queryByTestId('appeal-q-q4-open')).toBeNull();
  });

  it('**逐题申诉带上 paperQuestionId**，其余字段一个不多', async () => {
    mount();
    await settle();
    await openAndSend('appeal-q-q2', '这题我选的应该也对');
    expect(bodyOf(calls('/appeals')[0])).toEqual({
      submissionId: SUB,
      paperQuestionId: 'q2',
      message: '这题我选的应该也对',
    });
  });

  it('**空内容本地就挡下**，不发请求', async () => {
    mount();
    await settle();
    fireEvent.click(screen.getByTestId('appeal-whole-open'));
    fireEvent.change(screen.getByTestId('appeal-whole-input'), { target: { value: '   ' } });
    fireEvent.click(screen.getByTestId('appeal-whole-submit'));
    await settle();
    expect(screen.getByTestId('appeal-whole-invalid')).toBeInTheDocument();
    expect(calls('/appeals')).toHaveLength(0);
  });

  it('**连点两下只发一条**（同一帧里的第二下要被压掉）', async () => {
    // 两下点击都发生在**同一个 tick**，第二下看到的 React 状态还是上一帧的
    // `idle` —— 光靠 state 挡不住，必须有同步生效的闸门。
    mount();
    await settle();
    fireEvent.click(screen.getByTestId('appeal-whole-open'));
    fireEvent.change(screen.getByTestId('appeal-whole-input'), {
      target: { value: '重复提交测试' },
    });
    const btn = screen.getByTestId('appeal-whole-submit');
    fireEvent.click(btn);
    fireEvent.click(btn);
    await settle();
    expect(calls('/appeals')).toHaveLength(1);
  });

  it('**提交成功之后不再给重复入口**', async () => {
    mount();
    await settle();
    await openAndSend('appeal-whole', '第一次申诉');
    expect(screen.queryByTestId('appeal-whole-submit')).toBeNull();
    expect(screen.queryByTestId('appeal-whole-open')).toBeNull();
  });

  it('**提交失败是可重试的**：给错误提示，再点一次能成功', async () => {
    routes['/api/morning-quiz/appeals'] = { status: 500, body: { code: 'oops' } };
    mount();
    await settle();
    await openAndSend('appeal-whole', '第一次会失败');
    expect(screen.getByTestId('appeal-whole-error')).toBeInTheDocument();
    expect(calls('/appeals')).toHaveLength(1);

    routes['/api/morning-quiz/appeals'] = { body: { appealId: 'ap-2', status: 'open' } };
    fireEvent.click(screen.getByTestId('appeal-whole-submit'));
    await settle();
    expect(screen.getByTestId('appeal-whole-sent')).toBeInTheDocument();
    expect(calls('/appeals')).toHaveLength(2);
  });

  it('**申诉时令牌失效 → 走既有的登出**', async () => {
    routes['/api/morning-quiz/appeals'] = { status: 401, body: { code: 'token_revoked' } };
    mount();
    await settle();
    await openAndSend('appeal-whole', '令牌已经过期了');
    expect(readToken()).toBeNull();
  });

  it('**结果页不做趋势 / 重练 / 能力画像**', async () => {
    mount();
    await settle();
    const text = document.body.textContent ?? '';
    for (const w of ['趋势', '重练', '错题本', '能力', '雷达']) {
      expect(text, `结果页越界做了「${w}」`).not.toContain(w);
    }
  });
});

// ─────────────────────────────────────────────────────────────
// 纯逻辑
// ─────────────────────────────────────────────────────────────

describe('结局判定与得分率', () => {
  it('没答过优先于一切 —— 哪怕判了 0 分也先说「没作答」', () => {
    expect(questionOutcome(item({ studentAnswer: null }), false)).toBe('unanswered');
    expect(questionOutcome(item({ studentAnswer: '   ' }), false)).toBe('unanswered');
  });

  it('分数没放出来就是 pending，**不是「错」**', () => {
    expect(questionOutcome(item({ isCorrect: null, awardedMarks: null }), true)).toBe('pending');
  });

  it('部分得分：0 < 得分 < 满分', () => {
    expect(questionOutcome(item({ marks: 2, awardedMarks: 1, isCorrect: false }), false)).toBe(
      'partial',
    );
  });

  it('满分与零分', () => {
    expect(questionOutcome(item({ isCorrect: true }), false)).toBe('correct');
    expect(questionOutcome(item({ isCorrect: false, awardedMarks: 0 }), false)).toBe('incorrect');
  });

  it('得分率：分数没放出来 / 没有满分基数 → 不算', () => {
    expect(percentageOf(resultPayload())).toBe(60);
    expect(percentageOf(resultPayload({ scoresPending: true }))).toBeNull();
    expect(percentageOf(resultPayload({ maxScore: 0 }))).toBeNull();
    expect(percentageOf(resultPayload({ totalScore: null }))).toBeNull();
  });
});

describe('申诉正文的本地校验', () => {
  it('空白 / 太短 → 挡下', () => {
    expect(validateAppealMessage('   ').ok).toBe(false);
    expect(validateAppealMessage('嗯').ok).toBe(false);
  });

  it('正常内容 → 放行并去掉首尾空白', () => {
    const r = validateAppealMessage('  这题判错了  ');
    expect(r.ok).toBe(true);
    expect(r.value).toBe('这题判错了');
  });

  it('超过 4000 字 → 挡下（后端也会拒，别浪费一次往返）', () => {
    expect(validateAppealMessage('字'.repeat(4001)).ok).toBe(false);
  });
});
