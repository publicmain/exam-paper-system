/**
 * S12L —— 小范围试点要修的东西（界面这一半）。
 *
 * 每一条都对着一个真学生会撞到的东西：
 *
 *   · 今天那三张卡点了没反应；
 *   · 错题本还在发请求、还算今天的完成度；
 *   · 课程里教过的词被翻成挖空复习卡；
 *   · 拼写题只给一句挖空的句子，看不出考的是哪个词；
 *   · 自测直接开考，题量不由自己定；
 *   · 生词本 50 个词一条列表铺到底，没有搜索也没有筛选；
 *   · iPad / 电脑上正文永远只有 448px；
 *   · 历史成绩详情在宽屏也只有一列，看不了原文对题。
 *
 * 真页面 + 真 api 客户端，只在 `fetch` 打桩；断言落在渲染出来的 DOM
 * 与发出去的请求上。
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { act, fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import TodayPage from '../pages/Today';
import MistakesPage from '../pages/Mistakes';
import MistakePracticePage from '../pages/MistakePractice';
import LessonVocabPage from '../pages/LessonVocab';
import LessonTestPage from '../pages/LessonTest';
import VocabBookPage from '../pages/VocabBook';
import VocabSelfTestPage from '../pages/VocabSelfTest';
import ScoreDetailPage from '../pages/ScoreDetail';
import { writeToken } from '../lib/identity';
import { __resetForTest } from '../lib/auth-store';

const navigate = vi.fn();
vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual<typeof import('react-router-dom')>('react-router-dom');
  return {
    ...actual,
    useNavigate: () => navigate,
    useParams: () => ({ submissionId: 'sub-1' }),
  };
});

type Req = { url: string; init: RequestInit };
let reqs: Req[] = [];
let routes: Record<string, (req: Req) => { status?: number; body: unknown }>;

function installFetch() {
  reqs = [];
  vi.stubGlobal(
    'fetch',
    vi.fn(async (url: string, init: RequestInit = {}) => {
      reqs.push({ url, init });
      const key = Object.keys(routes)
        .filter((k) => url.includes(k))
        .sort((a, b) => b.length - a.length)[0];
      const r = key ? routes[key]({ url, init }) : { status: 404, body: { code: 'not_stubbed' } };
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

beforeEach(() => {
  __resetForTest();
  localStorage.clear();
  writeToken('s12l-token');
  navigate.mockReset();
  routes = {};
  installFetch();
});
afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

// ─────────────────────────────────────────────────────────────
// 夹具
// ─────────────────────────────────────────────────────────────

function today(over: Record<string, unknown> = {}) {
  return {
    student: { id: 's', name: '林思远' },
    date: '2026-08-31',
    nextAction: { kind: 'learn_vocab', label: '学习本次单词', href: null },
    rulesVersion: 4,
    completed: 1,
    total: 2,
    allDone: false,
    streakDays: 9,
    targetsFrozenAt: null,
    stage: 'vocab_learn',
    stageAt: null,
    vocabCursor: 3,
    segments: [
      {
        key: 'read', status: 'done', label: 'The Rooftop Garden', questionCount: 10,
        typicalMinutes: 15, score: 6, maxScore: 8, scoresPending: false,
        submissionId: 'sub-1', sessionId: 'sess-1', autoClosed: false, available: true,
      },
      {
        key: 'vocab', status: 'partial', progress: 3, target: 21, typicalMinutes: 5,
        quizScore: { status: 'not_started' }, available: true,
      },
      {
        key: 'drill', status: 'none', progress: 0, target: 0, typicalMinutes: 2,
        available: false, unavailableReason: '错题重练暂未开放 · 不计入今日完成',
      },
    ],
    ...over,
  };
}

const card = (over: Record<string, unknown> = {}) => ({
  headword: 'nile', surfaceForm: 'Nile', contextSentence: 'The Nile is the longest river.',
  sourcePassageTitle: 'Rivers', phonetic: 'naɪl', translation: '尼罗河', pos: 'n.',
  definition: 'A river in Africa.', tag: [], state: 'review', reps: 2,
  needsFirstTeaching: false, firstTaughtAt: '2026-08-01T00:00:00.000Z',
  sourceType: 'passage', addedAt: '2026-08-01T00:00:00.000Z', ...over,
});

const spellingItem = {
  index: 0,
  qtype: 'spelling',
  prompt: 'The passage says that the ＿＿＿ became clear only after the second season.',
  options: [],
  // 服务端作答前遮蔽的那一批
  headword: null, phonetic: null, translation: null, contextSentence: null,
  correctIndex: null, answer: null,
  studentIndex: null, studentAnswer: null, isCorrect: null, answeredAt: null,
};

// ─────────────────────────────────────────────────────────────
// 1. 今天的课：卡片要能点
// ─────────────────────────────────────────────────────────────

describe('S12L —— 今天的课是仪表盘', () => {
  beforeEach(() => {
    routes = { '/lesson/today': () => ({ body: today() }) };
  });

  it('阅读卡可点 —— 已完成就去结果页', async () => {
    render(<MemoryRouter><TodayPage /></MemoryRouter>);
    await settle();
    const readCard = screen.getByTestId('segment-card-read');
    expect(readCard.tagName === 'BUTTON' || readCard.tagName === 'A').toBe(true);
    fireEvent.click(readCard);
    expect(navigate).toHaveBeenCalledWith('/lesson/reading/result');
  });

  it('单词卡可点 —— 还没学完就去课程学词', async () => {
    render(<MemoryRouter><TodayPage /></MemoryRouter>);
    await settle();
    fireEvent.click(screen.getByTestId('segment-card-vocab'));
    expect(navigate).toHaveBeenCalledWith('/coach/learn');
  });

  it('错题卡明说暂未开放，也说清不计入今天', async () => {
    render(<MemoryRouter><TodayPage /></MemoryRouter>);
    await settle();
    const drill = screen.getByTestId('segment-card-drill');
    expect(drill.textContent).toContain('暂未开放');
    expect(drill.textContent).toContain('不计入');
  });

  it('分母照服务端的 total 显示（今天是 2）', async () => {
    render(<MemoryRouter><TodayPage /></MemoryRouter>);
    await settle();
    expect(screen.getByTestId('lesson-progress').textContent).toContain('1 / 2');
  });
});

// ─────────────────────────────────────────────────────────────
// 2. 错题本暂停
// ─────────────────────────────────────────────────────────────

describe('S12L —— 错题本暂停', () => {
  it('/mistakes 显示「错题本暂未开放」且一个错题请求都不发', async () => {
    routes = {};
    render(<MemoryRouter><MistakesPage /></MemoryRouter>);
    await settle();
    expect(screen.getByText(/错题本暂未开放/)).toBeTruthy();
    expect(reqs.filter((r) => r.url.includes('/mistakes'))).toHaveLength(0);
    expect(reqs).toHaveLength(0);
  });

  it('/mistakes/practice 显示「错题重练暂未开放」且不发任何请求', async () => {
    routes = {};
    render(<MemoryRouter><MistakePracticePage /></MemoryRouter>);
    await settle();
    expect(screen.getByText(/错题重练暂未开放/)).toBeTruthy();
    expect(reqs).toHaveLength(0);
  });
});

// ─────────────────────────────────────────────────────────────
// 3. 课程学词只教不测
// ─────────────────────────────────────────────────────────────

describe('S12L —— 课程学词只教不测', () => {
  it('教过的词在课程里也是教学卡，不是挖空复习卡', async () => {
    routes = {
      '/lesson/today': () => ({ body: today({ nextAction: { kind: 'learn_vocab', label: '学', href: null } }) }),
      '/vocab/lesson-cards': () => ({
        body: { lessonContext: true, cursor: 0, totalDue: 2, cards: [card(), card({ headword: 'silt', translation: '淤泥' })] },
      }),
    };
    render(<MemoryRouter><LessonVocabPage /></MemoryRouter>);
    await settle();
    expect(screen.getByTestId('teaching-card')).toBeTruthy();
    expect(screen.queryByTestId('reveal')).toBeNull();
    expect(screen.queryByTestId('rate-good')).toBeNull();
  });

  it('往下翻只打 vocab-taught，绝不写复习流水', async () => {
    routes = {
      '/lesson/today': () => ({ body: today() }),
      '/vocab/lesson-cards': () => ({
        body: { lessonContext: true, cursor: 0, totalDue: 2, cards: [card(), card({ headword: 'silt' })] },
      }),
      '/lesson/vocab-taught': () => ({ body: { ok: true, cursor: 1 } }),
    };
    render(<MemoryRouter><LessonVocabPage /></MemoryRouter>);
    await settle();
    fireEvent.click(screen.getByTestId('taught-next'));
    await settle();
    expect(reqs.filter((r) => r.url.includes('/vocab/review'))).toHaveLength(0);
    expect(reqs.filter((r) => r.url.includes('/lesson/vocab-taught')).length).toBeGreaterThan(0);
  });
});

// ─────────────────────────────────────────────────────────────
// 4/5. 正式测试：题数与安全线索
// ─────────────────────────────────────────────────────────────

describe('S12L —— 正式测试', () => {
  beforeEach(() => {
    routes = {
      '/lesson/today': () => ({ body: today({ nextAction: { kind: 'vocab_test', label: '正式测试', href: null }, stage: 'vocab_test' }) }),
      '/vocab/quiz/attempt/start': () => ({
        body: {
          id: 'att-1', date: '2026-08-31', status: 'in_progress', total: 21, correct: null,
          score: null, submittedAt: null,
          items: [{ ...spellingItem, cue: { pos: 'vt.', translation: '实现，完成；取得', definition: 'to succeed in reaching a goal' } }],
          resumed: false,
        },
      }),
    };
  });

  it('开考前就说清今天学了几个词、这次考几题', async () => {
    render(<MemoryRouter><LessonTestPage /></MemoryRouter>);
    await settle();
    expect(screen.getByTestId('quiz-intro').textContent).toMatch(/今天学习 21 个词，本次测试 21 题/);
  });

  it('拼写题给得出安全线索：词性 + 中文释义 + 该做什么', async () => {
    render(<MemoryRouter><LessonTestPage /></MemoryRouter>);
    await settle();
    const cue = screen.getByTestId('question-cue');
    expect(cue.textContent).toContain('实现，完成；取得');
    expect(cue.textContent).toContain('vt.');
    // 线索里绝不能出现答案本身
    expect(cue.textContent?.toLowerCase()).not.toContain('achieve');
  });

  it('进度显示 current / N', async () => {
    render(<MemoryRouter><LessonTestPage /></MemoryRouter>);
    await settle();
    expect(screen.getByTestId('quiz-progress').textContent).toMatch(/1\s*\/\s*21/);
  });
});

// ─────────────────────────────────────────────────────────────
// 6. 生词本 MVP
// ─────────────────────────────────────────────────────────────

describe('S12L —— 生词本 MVP', () => {
  beforeEach(() => {
    routes = {
      '/vocab/words': () => ({
        body: {
          total: 3, dueCount: 2,
          words: [
            { headword: 'achieve', phonetic: '/əˈtʃiːv/', translation: '实现', state: 'learning', sourceType: 'click', due: '2026-08-30T00:00:00.000Z', contextSentence: 'a' },
            { headword: 'blossom', phonetic: null, translation: '开花', state: 'new', sourceType: 'click', due: '2026-09-10T00:00:00.000Z', contextSentence: 'b' },
            { headword: 'canopy', phonetic: null, translation: '树冠', state: 'known', sourceType: 'click', due: '2026-08-29T00:00:00.000Z', contextSentence: 'c' },
          ],
        },
      }),
      '/vocab/stats': () => ({
        body: { total: 3, byState: { learning: 1, new: 1, known: 1, review: 0 }, totalDue: 2, reviewedToday: 0,
                progress: { mastered: 1, learning: 1, untouched: 1 }, streakDays: 4 },
      }),
    };
  });

  it('有搜索框，按词头筛得动', async () => {
    render(<MemoryRouter><VocabBookPage /></MemoryRouter>);
    await settle();
    const box = screen.getByTestId('vocab-search') as HTMLInputElement;
    fireEvent.change(box, { target: { value: 'blos' } });
    await settle();
    expect(screen.queryByTestId('word-row-blossom')).toBeTruthy();
    expect(screen.queryByTestId('word-row-achieve')).toBeNull();
  });

  it('有状态筛选：全部 / 学习中 / 到期 / 已掌握', async () => {
    render(<MemoryRouter><VocabBookPage /></MemoryRouter>);
    await settle();
    fireEvent.click(screen.getByTestId('vocab-filter-mastered'));
    await settle();
    expect(screen.queryByTestId('word-row-canopy')).toBeTruthy();
    expect(screen.queryByTestId('word-row-achieve')).toBeNull();
  });

  it('筛空了有明确的空态', async () => {
    render(<MemoryRouter><VocabBookPage /></MemoryRouter>);
    await settle();
    fireEvent.change(screen.getByTestId('vocab-search'), { target: { value: 'zzzz' } });
    await settle();
    expect(screen.getByTestId('vocab-filter-empty')).toBeTruthy();
  });
});

// ─────────────────────────────────────────────────────────────
// 7. 自测先选题量
// ─────────────────────────────────────────────────────────────

describe('S12L —— 自测先选题量', () => {
  it('进来先是设置，不是第一题', async () => {
    routes = {
      '/vocab/stats': () => ({ body: { total: 50, totalDue: 21, byState: {}, reviewedToday: 0 } }),
      '/vocab/quiz': () => ({ body: { questions: [] } }),
    };
    render(<MemoryRouter><VocabSelfTestPage /></MemoryRouter>);
    await settle();
    expect(screen.getByTestId('selftest-setup')).toBeTruthy();
    expect(screen.getByTestId('selftest-count-5')).toBeTruthy();
    expect(screen.getByTestId('selftest-count-10')).toBeTruthy();
    expect(screen.getByTestId('selftest-count-20')).toBeTruthy();
    expect(screen.getByTestId('selftest-count-all')).toBeTruthy();
    // 还没选就不该出题
    expect(reqs.filter((r) => r.url.includes('/vocab/quiz'))).toHaveLength(0);
  });
});

// ─────────────────────────────────────────────────────────────
// 8. 宽屏用得上宽度
// ─────────────────────────────────────────────────────────────

describe('S12L —— iPad / 电脑不再只有一条 448px', () => {
  it('今天的课：正文容器带响应式宽度断点', async () => {
    routes = { '/lesson/today': () => ({ body: today() }) };
    const { container } = render(<MemoryRouter><TodayPage /></MemoryRouter>);
    await settle();
    const main = container.querySelector('main');
    expect(main).toBeTruthy();
    expect(main!.className, `正文容器仍是固定窄栏：${main!.className}`).toMatch(/(md|lg|xl):max-w-/);
  });

  it('历史成绩详情：宽屏用左原文 / 右题目', async () => {
    routes = {
      '/morning-quiz/history-detail': () => ({
        body: {
          submissionId: 'sub-1', sessionId: 'sess-1', paperName: 'Paper, Ink and Memory',
          status: 'marked', finalSubmittedAt: '2026-08-26T00:51:00.000Z',
          submittedAt: '2026-08-26T00:51:00.000Z', autoScore: 3, manualScore: 1,
          totalScore: 4, maxScore: 8, scoresPending: false, answersPending: false,
          gradingSummary: { autoGraded: 3, marked: 3, pendingMarking: 0, notAnswered: 0, total: 6 },
          items: [
            {
              paperQuestionId: 'pq-1', sortOrder: 1, marks: 1, questionType: 'mcq',
              snapshotContent: { stem: 'Q1', passage: 'A sheet of good paper can last five hundred years.', taskType: 'true_false_not_given', passageTitle: 'Paper, Ink and Memory' },
              snapshotOptions: [{ key: 'A', text: 'TRUE' }],
              studentAnswer: 'A', correctAnswer: 'TRUE', explanation: null,
              awardedMarks: 1, autoCorrect: true, isCorrect: true, markerComment: null,
              commentSource: null, referenceAnswer: null, gradingStatus: 'auto_graded',
              answerDisplay: { primaryKind: 'option', primaryValue: 'TRUE' },
            },
          ],
        },
      }),
    };
    render(<MemoryRouter><ScoreDetailPage /></MemoryRouter>);
    await settle();
    expect(screen.getByTestId('result-split')).toBeTruthy();
  });

  it('历史成绩详情：不再直出 `marked` 与 ISO 时间戳', async () => {
    routes = {
      '/morning-quiz/history-detail': () => ({
        body: {
          submissionId: 'sub-1', sessionId: 'sess-1', paperName: 'P', status: 'marked',
          finalSubmittedAt: '2026-08-26T00:51:00.000Z', submittedAt: '2026-08-26T00:51:00.000Z',
          autoScore: 3, manualScore: 1, totalScore: 4, maxScore: 8,
          scoresPending: false, answersPending: false,
          gradingSummary: { autoGraded: 1, marked: 0, pendingMarking: 0, notAnswered: 0, total: 1 },
          items: [],
        },
      }),
    };
    const { container } = render(<MemoryRouter><ScoreDetailPage /></MemoryRouter>);
    await settle();
    const text = container.textContent ?? '';
    expect(text).not.toContain('marked');
    expect(text).not.toContain('2026-08-26T00:51:00.000Z');
    expect(text).toContain('已批改');
  });
});
