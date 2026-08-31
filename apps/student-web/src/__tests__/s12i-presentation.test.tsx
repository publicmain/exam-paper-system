/**
 * S12I —— 阶段 12 首次真人验收里那九个**界面侧**缺陷的行为测试。
 *
 * 服务端那一半在 S12H 已经做完（逐题 `gradingStatus`、语义 `answerDisplay`、
 * `gradingSummary`、以及 `kind: 'drill'`）。这一份只钉**学生看到的东西**。
 *
 * 一律挂真 `App`、只在 `fetch` 打桩、路径写字面量 —— 红在行为上，不是红在
 * 「某个导出还不存在」。
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { act, render, screen, fireEvent, within } from '@testing-library/react';
import { MemoryRouter, useLocation } from 'react-router-dom';
import App from '../App';
import { writeToken } from '../lib/identity';
import { __resetForTest } from '../lib/auth-store';

const TOKEN = 's12i-token';
const PROFILE = { id: 'stu-1', name: '验收学生', nickname: '验收', avatar: null };

type Req = { path: string; method: string; body: string | null };
let reqs: Req[] = [];

function jsonResponse(status: number, body: unknown) {
  return Promise.resolve({
    ok: status >= 200 && status < 300,
    status,
    text: () => Promise.resolve(JSON.stringify(body)),
  } as Response);
}

/** 路由的当前位置 —— 守卫类断言要靠它。 */
function Here() {
  const loc = useLocation();
  return <div data-testid="here">{loc.pathname}</div>;
}

function mount(path: string) {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <App />
      <Here />
    </MemoryRouter>,
  );
}

/** 建一个按路径分发的 fetch 桩。 */
function stubFetch(routes: Array<[RegExp, () => unknown, number?]>) {
  vi.stubGlobal(
    'fetch',
    vi.fn((url: string, init?: RequestInit) => {
      const path = String(url).replace(/^https?:\/\/[^/]+/, '').replace(/^\/api/, '');
      reqs.push({
        path,
        method: (init?.method ?? 'GET').toUpperCase(),
        body: typeof init?.body === 'string' ? init.body : null,
      });
      if (/\/student-auth\/me$/.test(path)) return jsonResponse(200, PROFILE);
      for (const [re, make, status] of routes) {
        if (re.test(path)) return jsonResponse(status ?? 200, make());
      }
      return jsonResponse(404, { code: 'not_stubbed', path });
    }),
  );
}

beforeEach(() => {
  reqs = [];
  __resetForTest();
  localStorage.clear();
  writeToken(TOKEN);
});
afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

const settle = async () => {
  await act(async () => {
    await Promise.resolve();
    await Promise.resolve();
  });
};

// ─────────────────────────────────────────────────────────────
// 夹具
// ─────────────────────────────────────────────────────────────

const PASSAGE =
  'When the rooftop of the science block was finally opened to students, nobody expected it to become the busiest classroom in the school.\n\n' +
  'The first beds were built in a week, from timber salvaged from an old stage that the drama club no longer used.';

const resultItem = (over: Record<string, unknown> = {}) => ({
  paperQuestionId: 'pq-1',
  sortOrder: 1,
  marks: 1,
  questionType: 'mcq',
  snapshotContent: {
    stem: 'The garden was suggested by a student.',
    taskType: 'true_false_not_given',
    passage: PASSAGE,
    passageTitle: 'The Rooftop Garden, Two Years On',
  },
  snapshotOptions: [
    { key: 'A', text: 'TRUE' },
    { key: 'B', text: 'FALSE' },
  ],
  studentAnswer: 'A',
  correctAnswer: 'A',
  referenceAnswer: null,
  explanation: null,
  awardedMarks: 1,
  autoCorrect: true,
  isCorrect: true,
  markerComment: null,
  commentSource: null,
  // S12H 的服务端权威字段
  gradingStatus: 'auto_graded',
  answerDisplay: { primaryKind: 'correct', primaryValue: 'A' },
  ...over,
});

const writtenItem = (over: Record<string, unknown> = {}) =>
  resultItem({
    paperQuestionId: 'pq-2',
    sortOrder: 2,
    marks: 2,
    questionType: 'short_answer',
    snapshotOptions: null,
    snapshotContent: {
      stem: 'What did the students plant along the north wall?',
      passage: PASSAGE,
      passageTitle: 'The Rooftop Garden, Two Years On',
    },
    studentAnswer: 'hedges',
    correctAnswer: 'a row of hedges',
    referenceAnswer: 'a row of hedges',
    awardedMarks: null,
    autoCorrect: null,
    isCorrect: null,
    gradingStatus: 'pending_marking',
    answerDisplay: { primaryKind: 'reference', primaryValue: 'a row of hedges' },
    ...over,
  });

const readingResult = (over: Record<string, unknown> = {}) => ({
  sessionId: 'sess-1',
  paperName: 'The Rooftop Garden, Two Years On',
  submissionId: 'sub-1',
  status: 'submitted',
  finalSubmittedAt: '2026-08-30T00:51:00.000Z',
  autoScore: null,
  manualScore: null,
  totalScore: null,
  maxScore: 3,
  submittedAt: '2026-08-30T00:51:00.000Z',
  scoresPending: true,
  answersPending: false,
  gradingSummary: { autoGraded: 1, marked: 0, pendingMarking: 1, notAnswered: 0, total: 2 },
  items: [resultItem(), writtenItem()],
  ...over,
});

const todayPayload = (over: Record<string, unknown> = {}) => ({
  student: { id: 'stu-1', name: '验收学生' },
  date: '2026-08-31',
  nextAction: { kind: 'drill', label: '开始错题重练', href: null },
  rulesVersion: 99,
  completed: 2,
  total: 3,
  allDone: false,
  stage: 'vocab_test',
  stageAt: null,
  streakDays: 0,
  vocabCursor: 0,
  targetsFrozenAt: null,
  segments: [
    { key: 'read', status: 'done', label: '今天的文章', questionCount: 10, typicalMinutes: 15, score: null, maxScore: null, scoresPending: false, submissionId: 'sub-1', sessionId: 'sess-1', autoClosed: false },
    { key: 'vocab', status: 'done', progress: 21, target: 21, typicalMinutes: 5, quizScore: { status: 'legacy_no_queue' } },
    { key: 'drill', status: 'todo', progress: 0, target: 5, typicalMinutes: 5 },
  ],
  ...over,
});

const dueCard = (over: Record<string, unknown> = {}) => ({
  headword: 'meadow',
  surfaceForm: 'meadow',
  contextSentence: 'A meadow of wild flowers grew behind the water tanks.',
  sourcePassageTitle: 'The Rooftop Garden',
  phonetic: '/ˈmedəʊ/',
  translation: 'n. 草地，牧场',
  pos: 'n.',
  definition: 'a field of grass and flowers',
  tag: [],
  state: 'review',
  reps: 3,
  needsFirstTeaching: false,
  firstTaughtAt: '2026-08-20T00:00:00.000Z',
  sourceType: 'click',
  addedAt: '2026-08-20T00:00:00.000Z',
  ...over,
});

const mistake = (over: Record<string, unknown> = {}) => ({
  id: 'm1',
  submissionId: 'sub-a',
  paperQuestionId: 'pq-1',
  taskType: 'multiple_choice',
  passageTitle: 'The Quiet Work of Bees',
  quizDay: '2026-08-25',
  stem: 'Bees navigate mainly by scent.',
  studentAnswer: 'TRUE',
  correctAnswer: 'FALSE',
  markerComment: '第三段说的是靠太阳的位置。',
  awarded: 0,
  maxMarks: 1,
  reason: 'repeated_tasktype',
  resolved: false,
  resolvedAt: null,
  correctStreak: 0,
  practiceCount: 0,
  lastPracticedAt: null,
  answerPoints: ['靠太阳定位'],
  answerModel: '',
  explanation: '第三段末句。',
  evidence: '',
  createdAt: '2026-08-25T00:00:00.000Z',
  ...over,
});

const practiceItem = (over: Record<string, unknown> = {}) => ({
  id: 'm1',
  taskType: 'true_false_not_given',
  reason: 'repeated_tasktype',
  passageTitle: 'The Rooftop Garden, Two Years On',
  quizDay: '2026-08-25',
  stem: 'The garden was suggested by a student.',
  myOldAnswer: 'TRUE',
  markerComment: '',
  correctAnswer: 'FALSE',
  answerPoints: [],
  answerModel: '',
  explanation: '',
  evidence: '',
  practiceKind: 'tfng',
  options: ['TRUE', 'FALSE', 'NOT GIVEN'],
  correctStreak: 0,
  passage: PASSAGE,
  submissionId: 'sub-a',
  paperQuestionId: 'pq-1',
  ...over,
});

// ─────────────────────────────────────────────────────────────
// 1. 结果页：逐题判分状态 + 答案去重 + 原文
// ─────────────────────────────────────────────────────────────

describe('S12I —— 结果页要认服务端的逐题判分', () => {
  it('整卷还在判分时，已自动判分的客观题**不许**显示「还在判分」', async () => {
    stubFetch([[/\/morning-quiz\/history-detail/, () => readingResult()]]);
    mount('/scores/sub-1');
    await settle();
    const card = screen.getByTestId('item-pq-1');
    expect(card.getAttribute('data-outcome'), '客观题被整卷 pending 盖住了').toBe('correct');
    expect(within(card).queryByText('还在判分')).toBeNull();
    expect(within(card).getByText('答对')).toBeTruthy();
  });

  it('客观题在整卷 pending 时也显示自己的得分', async () => {
    stubFetch([[/\/morning-quiz\/history-detail/, () => readingResult()]]);
    mount('/scores/sub-1');
    await settle();
    expect(screen.getByTestId('marks-pq-1').textContent).toMatch(/1\s*\/\s*1/);
  });

  it('真正等人判的主观题仍然显示「还在判分」，且不显示分数', async () => {
    stubFetch([[/\/morning-quiz\/history-detail/, () => readingResult()]]);
    mount('/scores/sub-1');
    await settle();
    const card = screen.getByTestId('item-pq-2');
    expect(card.getAttribute('data-outcome')).toBe('pending');
    expect(within(card).getByText('还在判分')).toBeTruthy();
  });

  it('服务端给了 gradingSummary 就照它说 —— 几题判完、几题等老师', async () => {
    stubFetch([[/\/morning-quiz\/history-detail/, () => readingResult()]]);
    mount('/scores/sub-1');
    await settle();
    const s = screen.getByTestId('grading-summary').textContent ?? '';
    expect(s).toMatch(/1/);
    expect(s).toMatch(/自动判分|已判/);
    expect(s).toMatch(/等|老师/);
  });

  it('「正确答案」与「参考答案」内容相同时**只渲染一行**', async () => {
    stubFetch([
      [
        /\/morning-quiz\/history-detail/,
        () =>
          readingResult({
            items: [
              writtenItem({
                correctAnswer: 'a row of hedges',
                referenceAnswer: 'A Row  of Hedges',
                answerDisplay: { primaryKind: 'reference', primaryValue: 'a row of hedges' },
              }),
            ],
            gradingSummary: { autoGraded: 0, marked: 0, pendingMarking: 1, notAnswered: 0, total: 1 },
          }),
      ],
    ]);
    mount('/scores/sub-1');
    await settle();
    const card = screen.getByTestId('item-pq-2');
    const shown = within(card).queryAllByTestId(/answer-row-/);
    expect(shown.length, '同一句话挂了两个名字').toBe(1);
  });

  it('答案与评分要点确实不同时，两行都在', async () => {
    stubFetch([
      [
        /\/morning-quiz\/history-detail/,
        () =>
          readingResult({
            items: [
              writtenItem({
                answerDisplay: {
                  primaryKind: 'reference',
                  primaryValue: 'a row of hedges',
                  rubricValue: 'MP1 wind break; MP2 north wall',
                },
              }),
            ],
            gradingSummary: { autoGraded: 0, marked: 0, pendingMarking: 1, notAnswered: 0, total: 1 },
          }),
      ],
    ]);
    mount('/scores/sub-1');
    await settle();
    const card = screen.getByTestId('item-pq-2');
    expect(within(card).queryAllByTestId(/answer-row-/).length).toBe(2);
  });
});

describe('S12I —— 结果页要能看到原文', () => {
  it('有「查看原文」控件，展开后能看到完整原文', async () => {
    stubFetch([[/\/morning-quiz\/history-detail/, () => readingResult()]]);
    mount('/scores/sub-1');
    await settle();
    const toggle = screen.getByTestId('passage-toggle');
    expect(screen.queryByTestId('passage-body'), '原文默认就展开了').toBeNull();
    await act(async () => {
      fireEvent.click(toggle);
    });
    const body = screen.getByTestId('passage-body');
    expect(body.textContent).toContain('busiest classroom');
    await act(async () => {
      fireEvent.click(screen.getByTestId('passage-toggle'));
    });
    expect(screen.queryByTestId('passage-body'), '收不回去').toBeNull();
  });

  it('原文**整份只渲染一次**，不是每题一份', async () => {
    stubFetch([[/\/morning-quiz\/history-detail/, () => readingResult()]]);
    mount('/scores/sub-1');
    await settle();
    await act(async () => {
      fireEvent.click(screen.getByTestId('passage-toggle'));
    });
    expect(screen.queryAllByTestId('passage-body').length).toBe(1);
  });

  it('载荷里没有原文时**不造一段出来**，也不显示控件', async () => {
    stubFetch([
      [
        /\/morning-quiz\/history-detail/,
        () =>
          readingResult({
            items: [resultItem({ snapshotContent: { stem: '只有题干，没有原文' } })],
            gradingSummary: { autoGraded: 1, marked: 0, pendingMarking: 0, notAnswered: 0, total: 1 },
          }),
      ],
    ]);
    mount('/scores/sub-1');
    await settle();
    expect(screen.queryByTestId('passage-toggle')).toBeNull();
  });
});

// ─────────────────────────────────────────────────────────────
// 2. 正式测试完成文案
// ─────────────────────────────────────────────────────────────

describe('S12I —— 正式测试的完成文案随题数走', () => {
  const attempt = (n: number) => ({
    attemptId: 'att-1',
    status: 'in_progress',
    startedAt: '2026-08-31T01:00:00.000Z',
    submittedAt: null,
    total: n,
    correct: 0,
    score: null,
    resumed: false,
    items: Array.from({ length: n }, (_, i) => ({
      index: i,
      qtype: 'word_to_meaning',
      prompt: `第 ${i + 1} 题`,
      options: ['甲', '乙', '丙', '丁'],
      headword: null,
      phonetic: null,
      translation: null,
      contextSentence: null,
      correctIndex: null,
      answer: null,
      studentIndex: i,
      studentAnswer: '甲',
      // 已作答的判据是 `isCorrect != null`（见 LessonTest.isAnswered）
      isCorrect: true,
    })),
  });

  for (const n of [4, 10]) {
    it(`${n} 题的卷子全答完时说的是「${n} 道题」`, async () => {
      stubFetch([
        [/\/lesson\/today$/, () => todayPayload({ nextAction: { kind: 'vocab_test', label: '开始单词测试', href: null } })],
        [/\/vocab\/quiz\/attempt\/start/, () => attempt(n)],
      ]);
      mount('/lesson/test');
      await settle();
      const body = document.body.textContent ?? '';
      expect(body, `写死的「四道题」还在（本卷 ${n} 题）`).toContain(`${n} 道题都答完了`);
      if (n !== 4) expect(body).not.toContain('四道题都答完了');
    });
  }
});

// ─────────────────────────────────────────────────────────────
// 3. 自由练习：没教过的词先教
// ─────────────────────────────────────────────────────────────

describe('S12I —— 自由练习先教后考', () => {
  const dueWith = (cards: unknown[]) => [[/\/vocab\/due/, () => ({ totalDue: cards.length, cards })]] as any;

  it('没教过的词先出**教学卡**：词、音标、释义、来源、完整例句都摊开', async () => {
    stubFetch(
      dueWith([
        dueCard(),
        dueCard({ headword: 'trellis', surfaceForm: 'trellis', needsFirstTeaching: true, reps: 0, state: 'new', firstTaughtAt: null, contextSentence: 'They fixed a trellis to the south wall.' }),
      ]),
    );
    mount('/vocab/practice');
    await settle();
    const card = screen.getByTestId('teaching-card');
    expect(card.textContent).toContain('trellis');
    expect(card.textContent).toContain('学习');
    expect(screen.queryByTestId('review-card'), '没教过的词被直接拿来考了').toBeNull();
  });

  it('教学卡上的「我看过了」**不发任何请求**，只切到回忆模式', async () => {
    stubFetch(
      dueWith([
        dueCard({ headword: 'trellis', needsFirstTeaching: true, reps: 0, state: 'new', firstTaughtAt: null }),
      ]),
    );
    mount('/vocab/practice');
    await settle();
    const before = reqs.filter((r) => r.method === 'POST').length;
    await act(async () => {
      fireEvent.click(screen.getByTestId('teaching-ack'));
    });
    expect(reqs.filter((r) => r.method === 'POST').length, '确认看过居然写了库').toBe(before);
    expect(screen.getByTestId('review-card')).toBeTruthy();
  });

  it('复习卡带「复习」标识，且教过的词不会退回教学卡', async () => {
    stubFetch(dueWith([dueCard()]));
    mount('/vocab/practice');
    await settle();
    expect(screen.queryByTestId('teaching-card')).toBeNull();
    expect(screen.getByTestId('review-card').textContent).toContain('复习');
  });
});

// ─────────────────────────────────────────────────────────────
// 4. 错题本信息架构
// ─────────────────────────────────────────────────────────────

describe('S12I —— 错题本读得懂', () => {
  const list = (entries: unknown[]) =>
    [[/\/vocab\/mistakes\?/, () => ({ total: entries.length, byTaskType: [], entries })]] as any;

  it('内部枚举串一个都不许上屏', async () => {
    stubFetch(
      list([
        mistake({ id: 'm1', taskType: 'multiple_choice' }),
        mistake({ id: 'm2', taskType: 'matching_features' }),
        mistake({ id: 'm3', taskType: 'true_false_not_given' }),
        mistake({ id: 'm4', taskType: 'something_new_from_the_server' }),
      ]),
    );
    mount('/mistakes');
    await settle();
    const body = document.body.textContent ?? '';
    for (const raw of ['multiple_choice', 'matching_features', 'true_false_not_given', 'something_new_from_the_server']) {
      expect(body, `原始枚举 ${raw} 打到界面上了`).not.toContain(raw);
    }
    expect(body).toContain('其他题型');
  });

  it('同一份卷子的多条错题**共用一个标题头**，标题不逐条重复', async () => {
    stubFetch(
      list([
        mistake({ id: 'm1' }),
        mistake({ id: 'm2', stem: '第二题' }),
        mistake({ id: 'm3', passageTitle: '另一篇', quizDay: '2026-08-24' }),
      ]),
    );
    mount('/mistakes');
    await settle();
    const heads = screen.queryAllByTestId(/group-head-/);
    expect(heads.length, '没有按卷子分组').toBe(2);
    const body = document.body.textContent ?? '';
    const occurrences = body.split('The Quiet Work of Bees').length - 1;
    expect(occurrences, '篇目标题被逐条重复了').toBe(1);
  });

  it('默认卡片是紧凑的 —— 评语 / 解析 / 要点收在展开控件后面', async () => {
    stubFetch(list([mistake()]));
    mount('/mistakes');
    await settle();
    expect(screen.queryByText(/第三段说的是靠太阳的位置/), '评语默认就摊开了').toBeNull();
    await act(async () => {
      fireEvent.click(screen.getByTestId('detail-toggle-m1'));
    });
    expect(screen.getByText(/第三段说的是靠太阳的位置/)).toBeTruthy();
  });
});

// ─────────────────────────────────────────────────────────────
// 5. 错题重练的进度与原文定位
// ─────────────────────────────────────────────────────────────

describe('S12I —— 错题重练说得清「这一轮」和「总共」', () => {
  const queue = (items: unknown[], remaining: number) =>
    [[/\/vocab\/mistakes\/practice-queue/, () => ({ remaining, items })]] as any;

  it('分开显示「本轮第 N / M 题」与「错题本仍有 K 题」', async () => {
    stubFetch(queue([practiceItem(), practiceItem({ id: 'm2' })], 16));
    mount('/mistakes/practice');
    await settle();
    expect(screen.getByTestId('round-progress').textContent).toMatch(/本轮第\s*1\s*\/\s*2\s*题/);
    expect(screen.getByTestId('book-remaining').textContent).toMatch(/16/);
  });

  it('有「查看原文并定位」，默认收起', async () => {
    stubFetch(queue([practiceItem()], 1));
    mount('/mistakes/practice');
    await settle();
    expect(screen.getByTestId('locate-toggle')).toBeTruthy();
    expect(screen.queryByTestId('locate-body')).toBeNull();
  });

  it('证据句是原文里的**精确子串** → 高亮那一处', async () => {
    stubFetch(
      queue(
        [practiceItem({ evidence: 'timber salvaged from an old stage' })],
        1,
      ),
    );
    mount('/mistakes/practice');
    await settle();
    await act(async () => {
      fireEvent.click(screen.getByTestId('locate-toggle'));
    });
    const mark = screen.getByTestId('evidence-mark');
    expect(mark.textContent).toBe('timber salvaged from an old stage');
  });

  it('没有证据句 → 给完整原文并**如实说明**定位没有存下来，绝不瞎标', async () => {
    stubFetch(queue([practiceItem({ evidence: '' })], 1));
    mount('/mistakes/practice');
    await settle();
    await act(async () => {
      fireEvent.click(screen.getByTestId('locate-toggle'));
    });
    expect(screen.queryByTestId('evidence-mark'), '凭空标了一处高亮').toBeNull();
    expect(screen.getByTestId('locate-body').textContent).toContain('busiest classroom');
    expect(screen.getByTestId('locate-note').textContent).toMatch(/没有|未/);
  });

  it('证据句不是原文的精确子串 → 同样不标，只如实说明', async () => {
    stubFetch(queue([practiceItem({ evidence: '这句话原文里根本没有' })], 1));
    mount('/mistakes/practice');
    await settle();
    await act(async () => {
      fireEvent.click(screen.getByTestId('locate-toggle'));
    });
    expect(screen.queryByTestId('evidence-mark')).toBeNull();
    expect(screen.getByTestId('locate-note')).toBeTruthy();
  });

  it('作答之前，答案材料一个字都不在 DOM 里', async () => {
    stubFetch(queue([practiceItem({ explanation: '第三段末句。' })], 1));
    mount('/mistakes/practice');
    await settle();
    await act(async () => {
      fireEvent.click(screen.getByTestId('locate-toggle'));
    });
    const body = document.body.textContent ?? '';
    expect(body).not.toContain('第三段末句。');
  });
});

// ─────────────────────────────────────────────────────────────
// 6. drill 路由 + 总结页守卫
// ─────────────────────────────────────────────────────────────

describe('S12I —— drill 要能落到错题重练', () => {
  it('主页的主行动是 drill 时，点它去 /mistakes/practice', async () => {
    stubFetch([
      [/\/lesson\/today$/, () => todayPayload()],
      [/\/vocab\/mistakes\/practice-queue/, () => ({ remaining: 5, items: [practiceItem()] })],
    ]);
    mount('/today');
    await settle();
    const btn = screen.getByRole('button', { name: /错题重练/ });
    await act(async () => {
      fireEvent.click(btn);
    });
    expect(screen.getByTestId('here').textContent).toBe('/mistakes/practice');
  });

  it('后端的 href 一律不用', async () => {
    stubFetch([
      [/\/lesson\/today$/, () => todayPayload({ nextAction: { kind: 'drill', label: '开始错题重练', href: '/my-mistakes/practice' } })],
      [/\/vocab\/mistakes\/practice-queue/, () => ({ remaining: 5, items: [practiceItem()] })],
    ]);
    mount('/today');
    await settle();
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: /错题重练/ }));
    });
    expect(screen.getByTestId('here').textContent).toBe('/mistakes/practice');
  });
});

describe('S12I —— 总结页只在真的做完时才渲染', () => {
  it('kind 是 drill → replace 回 /today，且**不闪一下总结**', async () => {
    stubFetch([
      [/\/lesson\/today$/, () => todayPayload()],
      [/\/vocab\/mistakes\/practice-queue/, () => ({ remaining: 5, items: [] })],
    ]);
    mount('/lesson/summary');
    await settle();
    expect(screen.getByTestId('here').textContent).toBe('/today');
    expect(screen.queryByTestId('summary-completion')).toBeNull();
  });

  it('kind 是 summary 但 completed 与 total 对不上 → 也回 /today', async () => {
    stubFetch([
      [
        /\/lesson\/today$/,
        () =>
          todayPayload({
            nextAction: { kind: 'summary', label: '看今天的总结', href: null },
            allDone: false,
            completed: 2,
            total: 3,
          }),
      ],
    ]);
    mount('/lesson/summary');
    await settle();
    expect(screen.getByTestId('here').textContent).toBe('/today');
  });

  it('三个字段都同意时正常渲染总结', async () => {
    stubFetch([
      [
        /\/lesson\/today$/,
        () =>
          todayPayload({
            nextAction: { kind: 'summary', label: '看今天的总结', href: null },
            allDone: true,
            completed: 3,
            total: 3,
            segments: [
              { key: 'read', status: 'done', label: '今天的文章', questionCount: 10, typicalMinutes: 15, score: 8, maxScore: 10, scoresPending: false, submissionId: 'sub-1', sessionId: 'sess-1', autoClosed: false },
              { key: 'vocab', status: 'done', progress: 21, target: 21, typicalMinutes: 5, quizScore: { status: 'legacy_no_queue' } },
              { key: 'drill', status: 'done', progress: 5, target: 5, typicalMinutes: 5 },
            ],
          }),
      ],
    ]);
    mount('/lesson/summary');
    await settle();
    expect(screen.getByTestId('here').textContent).toBe('/lesson/summary');
    expect(screen.getByTestId('summary-completion')).toBeTruthy();
  });
});

// ─────────────────────────────────────────────────────────────
// 7. 返工 1/2 —— B-1：判分摘要不许把人判的说成机器判的
//
// 第一版把 `autoGraded + marked` 合并成「已自动判分 N 题」。只要
// `marked > 0`，那句话就是假的：老师亲手批的题被说成自动判分。
// 原来的用例恰好用 `marked: 0`，所以照不出这个缺陷。
// ─────────────────────────────────────────────────────────────

describe('S12I/1 —— 判分摘要如实分开说', () => {
  const withSummary = (s: Record<string, number>) =>
    stubFetch([
      [
        /\/morning-quiz\/history-detail/,
        () => readingResult({ gradingSummary: s }),
      ],
    ]);

  it('全是老师批的（autoGraded 0 · marked 2）→ **一个字都不许说「自动判分」**', async () => {
    withSummary({ autoGraded: 0, marked: 2, pendingMarking: 0, notAnswered: 0, total: 2 });
    mount('/scores/sub-1');
    await settle();
    const s = screen.getByTestId('grading-summary').textContent ?? '';
    expect(s, '老师批的题被说成自动判分了').not.toContain('自动判分');
    expect(s.replace(/\s+/g, '')).toContain('老师已批改2题');
  });

  it('四种都有时，四件事分开说，互不吞并', async () => {
    withSummary({ autoGraded: 3, marked: 2, pendingMarking: 4, notAnswered: 1, total: 10 });
    mount('/scores/sub-1');
    await settle();
    const s = (screen.getByTestId('grading-summary').textContent ?? '').replace(/\s+/g, '');
    expect(s).toContain('已自动判分3题');
    expect(s).toContain('老师已批改2题');
    expect(s).toContain('4题等老师批改');
    expect(s).toContain('1题没作答');
    // 合并过的话会出现 5 —— 那正是第一版的错法
    expect(s).not.toContain('已自动判分5题');
  });

  it('只有「没作答」时，开头不许挂一个分隔符', async () => {
    withSummary({ autoGraded: 0, marked: 0, pendingMarking: 0, notAnswered: 2, total: 2 });
    mount('/scores/sub-1');
    await settle();
    const s = (screen.getByTestId('grading-summary').textContent ?? '').trim();
    expect(s.startsWith('·'), `摘要以分隔符开头：${JSON.stringify(s)}`).toBe(false);
    expect(s.endsWith('·')).toBe(false);
    expect(s.replace(/\s+/g, '')).toBe('2题没作答');
  });

  it('计数为 0 的那几项整段不出现', async () => {
    withSummary({ autoGraded: 2, marked: 0, pendingMarking: 0, notAnswered: 0, total: 2 });
    mount('/scores/sub-1');
    await settle();
    const s = screen.getByTestId('grading-summary').textContent ?? '';
    expect(s).not.toContain('老师已批改');
    expect(s).not.toContain('等老师批改');
    expect(s).not.toContain('没作答');
  });
});

// ─────────────────────────────────────────────────────────────
// 8. 返工 1/2 —— B-2：错题本要**全局**按卷子 + 日期分组
//
// 第一版只合并**相邻**的同组。而服务端是按天倒序、同天按收录原因排的，
// **不是按卷子排** —— 于是同一份卷子的两条错题中间夹着别的卷子时，
// 标题会重复出现，分组等于没做。
// ─────────────────────────────────────────────────────────────

describe('S12I/1 —— 分组是全局的，不是只合并相邻', () => {
  /** 交错的服务端顺序：A/day1、B/day1、A/day1、A/day2 */
  const INTERLEAVED = [
    mistake({ id: 'a1', passageTitle: 'Paper A', quizDay: '2026-08-25', stem: 'A-1' }),
    mistake({ id: 'b1', passageTitle: 'Paper B', quizDay: '2026-08-25', stem: 'B-1' }),
    mistake({ id: 'a2', passageTitle: 'Paper A', quizDay: '2026-08-25', stem: 'A-2' }),
    mistake({ id: 'a3', passageTitle: 'Paper A', quizDay: '2026-08-24', stem: 'A-3' }),
  ];

  const mountList = () => {
    stubFetch([
      [/\/vocab\/mistakes\?/, () => ({ total: INTERLEAVED.length, byTaskType: [], entries: INTERLEAVED })],
    ]);
    return mount('/mistakes');
  };

  it('**恰好三组**：A/day1、B/day1、A/day2', async () => {
    mountList();
    await settle();
    const section = screen.getByTestId('unresolved-section');
    expect(within(section).queryAllByTestId(/^group-head-/).length).toBe(3);
  });

  it('A/day1 的标题**只出现一次**', async () => {
    mountList();
    await settle();
    const heads = within(screen.getByTestId('unresolved-section'))
      .queryAllByTestId(/^group-head-/)
      .map((h) => h.textContent ?? '');
    const aDay1 = heads.filter((h) => h.includes('Paper A') && h.includes('08-25'));
    expect(aDay1.length, 'Paper A / 8-25 的标题重复了').toBe(1);
  });

  it('A/day1 里是 A-1 在前、A-2 在后（组内保持服务端顺序）', async () => {
    mountList();
    await settle();
    const stems = within(screen.getByTestId('unresolved-section'))
      .queryAllByTestId(/^stem-/)
      .map((n) => n.textContent ?? '');
    expect(stems.indexOf('A-1')).toBeLessThan(stems.indexOf('A-2'));
  });

  it('组的顺序按**首次出现**：A/day1 → B/day1 → A/day2', async () => {
    mountList();
    await settle();
    const heads = within(screen.getByTestId('unresolved-section'))
      .queryAllByTestId(/^group-head-/)
      .map((h) => (h.textContent ?? '').replace(/\s+/g, ''));
    expect(heads[0]).toContain('PaperA');
    expect(heads[0]).toContain('08-25');
    expect(heads[1]).toContain('PaperB');
    expect(heads[2]).toContain('PaperA');
    expect(heads[2]).toContain('08-24');
  });

  it('一条都不许丢 —— 四条错题全在', async () => {
    mountList();
    await settle();
    for (const id of ['a1', 'b1', 'a2', 'a3']) {
      expect(screen.getByTestId(`entry-${id}`), `${id} 不见了`).toBeTruthy();
    }
  });

  it('标题相同但**不同天**的绝不合并', async () => {
    mountList();
    await settle();
    const heads = within(screen.getByTestId('unresolved-section')).queryAllByTestId(/^group-head-/);
    const aHeads = heads.filter((h) => (h.textContent ?? '').includes('Paper A'));
    expect(aHeads.length, '两天的 Paper A 被并成了一组').toBe(2);
  });
});
