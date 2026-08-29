import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import MyVocabQuizPage from '../MyVocabQuiz';
import { api } from '../../lib/api';

/**
 * S9B0 —— 服务端把未作答题的答案元数据遮起来之后，旧的正式测试页要跟上。
 *
 * 服务端现在对**未作答**的题只下发 `index / qtype / prompt / options`；
 * `headword` / `translation` / `phonetic` / `contextSentence` /
 * `correctIndex` / `answer` 一律是 null，作答成功的回执里才揭开这一题。
 *
 * 于是这一页有两条硬要求：
 *
 * 1. **答案回执到了才给反馈**。以前点一下选项立刻就显示对错 —— 那时它靠
 *    的是本地比较，而正式测试里本地根本没有答案，比出来的对错是假的。
 * 2. **反馈的内容来自回执里的那道题**，不是本地那份（本地那份是遮着的，
 *    音标、释义、正确拼写全是 null）。
 *
 * 自由练习那条线题目自带答案，一个字都不改 —— 最后一组用例钉住这一点。
 */

vi.mock('../../lib/api', () => ({
  api: {
    vocabQuiz: vi.fn(),
    vocabReview: vi.fn().mockResolvedValue({}),
    vocabQuizStart: vi.fn(),
    vocabQuizAnswer: vi.fn(),
    vocabQuizSubmit: vi.fn(),
  },
}));

vi.mock('../../lib/reviewQueue', () => ({
  submitReview: vi.fn().mockResolvedValue({}),
  flushPending: vi.fn().mockResolvedValue(undefined),
}));

const OPTIONS = ['n. 港口', 'n. 灯笼', 'n. 草地', 'n. 卵石'];

/** 服务端下发的**未作答**题：只有渲染题目必需的那几样。 */
const hidden = (prompt: string, index: number, over: Partial<any> = {}) => ({
  index,
  qtype: 'word_to_meaning',
  prompt,
  options: OPTIONS,
  headword: null,
  phonetic: null,
  translation: null,
  contextSentence: null,
  correctIndex: null,
  answer: null,
  studentIndex: null,
  studentAnswer: null,
  isCorrect: null,
  answeredAt: null,
  ...over,
});

/** 作答之后服务端揭开的那一题。 */
const revealed = (prompt: string, index: number, over: Partial<any> = {}) => ({
  ...hidden(prompt, index),
  headword: 'harbour',
  phonetic: 'ˈhɑːbə',
  translation: 'n. 港口',
  contextSentence: 'The ships rest in the harbour.',
  correctIndex: 0,
  studentIndex: 0,
  studentAnswer: OPTIONS[0],
  isCorrect: true,
  answeredAt: '2026-08-29T02:00:00.000Z',
  ...over,
});

function attempt(over: Partial<any> = {}) {
  return {
    attemptId: 'att1',
    status: 'in_progress',
    startedAt: '2026-08-29T02:00:00.000Z',
    submittedAt: null,
    total: 4,
    correct: 0,
    score: null,
    items: [
      hidden('harbour', 0),
      hidden('lantern', 1),
      hidden('meadow', 2),
      hidden('pebble', 3),
    ],
    resumed: false,
    ...over,
  };
}

function setup() {
  return render(
    <MemoryRouter initialEntries={['/my-vocab/quiz?name=%E5%B0%8F%E6%98%8E&studentId=stu1']}>
      <Routes>
        <Route path="/my-vocab/quiz" element={<MyVocabQuizPage />} />
        <Route path="*" element={<div>navigated-away</div>} />
      </Routes>
    </MemoryRouter>,
  );
}

/** 一个卡在半路的 promise —— 用来看「回执还没到」的那一瞬间。 */
function deferred<T>() {
  let resolve!: (v: T) => void;
  let reject!: (e: unknown) => void;
  const promise = new Promise<T>((res, rej) => { resolve = res; reject = rej; });
  return { promise, resolve, reject };
}

const FEEDBACK = /答对了|正确答案已标出|正确拼写在下面/;

beforeEach(() => {
  vi.mocked(api.vocabQuizStart).mockReset();
  vi.mocked(api.vocabQuizAnswer).mockReset();
  vi.mocked(api.vocabQuizSubmit).mockReset();
  vi.mocked(api.vocabQuiz).mockReset();
  vi.mocked(api.vocabReview).mockClear();
  vi.mocked(api.vocabQuizSubmit).mockResolvedValue({ total: 4, correct: 3, score: 75 } as any);
});

// ─────────────────────────────────────────────────────────────

describe('S9B0 正式测试：题目遮着也要能出题', () => {
  it('**初始渲染不依赖被遮起来的字段**', async () => {
    vi.mocked(api.vocabQuizStart).mockResolvedValue(attempt() as any);
    setup();
    await waitFor(() => expect(screen.getByText('harbour')).toBeTruthy());
    for (const o of OPTIONS) expect(screen.getByText(o)).toBeTruthy();
    // 还没作答 —— 一个反馈字样都不该有
    expect(screen.queryByText(FEEDBACK)).toBeNull();
    expect(screen.queryByTestId('quiz-continue')).toBeNull();
  });

  it('**拼写题的提示行少了字段也不露破绽**', async () => {
    vi.mocked(api.vocabQuizStart).mockResolvedValue(
      attempt({
        items: [
          hidden('The ＿＿＿ was green.', 0, { qtype: 'spelling', options: [] }),
          hidden('lantern', 1),
          hidden('meadow', 2),
          hidden('pebble', 3),
        ],
      }) as any,
    );
    setup();
    await waitFor(() => expect(screen.getByText('The ＿＿＿ was green.')).toBeTruthy());
    expect(screen.getByLabelText('输入这个单词的拼写')).toBeTruthy();
    // 没有答案就不能拿答案凑提示：不出现「共 N 个字母」，也不出现空的「意思：」
    expect(screen.queryByText(/共 .* 个字母/)).toBeNull();
    expect(screen.queryByText(/意思：\s*$/)).toBeNull();
  });
});

describe('S9B0 正式测试：回执到了才给反馈', () => {
  it('**保存还没回来 → 不显示对错**，选项保持选中且不能改', async () => {
    const user = userEvent.setup();
    const d = deferred<any>();
    vi.mocked(api.vocabQuizStart).mockResolvedValue(attempt() as any);
    vi.mocked(api.vocabQuizAnswer).mockReturnValue(d.promise as any);
    setup();
    await waitFor(() => expect(screen.getByText('harbour')).toBeTruthy());

    await user.click(screen.getByText('n. 港口'));
    await waitFor(() => expect(api.vocabQuizAnswer).toHaveBeenCalled());

    // 这一瞬间：请求在路上，**页面不许说对错**
    expect(screen.queryByText(FEEDBACK)).toBeNull();
    // 但学生的选择还在，而且不能再改
    expect((screen.getByText('n. 灯笼').closest('button') as HTMLButtonElement).disabled).toBe(true);
    expect(screen.getByTestId('quiz-continue')).toBeDisabled();

    d.resolve({ accepted: true, items: [revealed('harbour', 0), hidden('lantern', 1)] });
    await waitFor(() => expect(screen.getByText('答对了')).toBeTruthy());
  });

  it('**反馈内容来自回执里的那道题**：音标、释义、原句都显示出来', async () => {
    const user = userEvent.setup();
    vi.mocked(api.vocabQuizStart).mockResolvedValue(attempt() as any);
    vi.mocked(api.vocabQuizAnswer).mockResolvedValue({
      accepted: true,
      items: [
        revealed('harbour', 0, {
          isCorrect: false,
          studentIndex: 1,
          studentAnswer: OPTIONS[1],
        }),
        hidden('lantern', 1),
      ],
    } as any);
    setup();
    await waitFor(() => expect(screen.getByText('harbour')).toBeTruthy());

    await user.click(screen.getByText('n. 灯笼'));
    await waitFor(() => expect(screen.getByText('正确答案已标出')).toBeTruthy());
    // 这些字段在本地那份里全是 null，只能来自回执
    const fb = within(screen.getByTestId('quiz-feedback'));
    expect(fb.getByText('harbour')).toBeTruthy();
    expect(fb.getByText(/ˈhɑːbə/)).toBeTruthy();
    expect(fb.getByText(/n\. 港口/)).toBeTruthy();
    expect(fb.getByText('The ships rest in the harbour.')).toBeTruthy();
    // 正确项按服务端的 correctIndex 标出
    expect(screen.getByRole('button', { name: /n\. 港口/ }).textContent).toContain('✓');
  });

  it('**判定以服务端为准**：本地看着像对的，服务端说错就是错', async () => {
    const user = userEvent.setup();
    vi.mocked(api.vocabQuizStart).mockResolvedValue(attempt() as any);
    vi.mocked(api.vocabQuizAnswer).mockResolvedValue({
      accepted: true,
      items: [revealed('harbour', 0, { isCorrect: false, correctIndex: 2 }), hidden('lantern', 1)],
    } as any);
    setup();
    await waitFor(() => expect(screen.getByText('harbour')).toBeTruthy());
    await user.click(screen.getByText('n. 港口'));
    await waitFor(() => expect(screen.getByText('正确答案已标出')).toBeTruthy());
    expect(screen.queryByText('答对了')).toBeNull();
    expect(screen.getByRole('button', { name: /n\. 草地/ }).textContent).toContain('✓');
  });

  it('**拼写题显示回执里的正确拼写**', async () => {
    const user = userEvent.setup();
    vi.mocked(api.vocabQuizStart).mockResolvedValue(
      attempt({
        items: [
          hidden('The ＿＿＿ was green.', 0, { qtype: 'spelling', options: [] }),
          hidden('lantern', 1),
        ],
      }) as any,
    );
    vi.mocked(api.vocabQuizAnswer).mockResolvedValue({
      accepted: true,
      items: [
        {
          ...revealed('The ＿＿＿ was green.', 0),
          qtype: 'spelling',
          options: [],
          correctIndex: -1,
          answer: 'meadow',
          headword: 'meadow',
          translation: 'n. 草地',
          isCorrect: false,
          studentIndex: null,
          studentAnswer: 'medow',
        },
        hidden('lantern', 1),
      ],
    } as any);
    setup();
    await waitFor(() => expect(screen.getByText('The ＿＿＿ was green.')).toBeTruthy());

    await user.type(screen.getByLabelText('输入这个单词的拼写'), 'medow');
    await user.click(screen.getByRole('button', { name: '提交' }));

    await waitFor(() => expect(screen.getByText('正确拼写在下面')).toBeTruthy());
    const fb = within(screen.getByTestId('quiz-feedback'));
    expect(fb.getAllByText(/meadow/).length).toBeGreaterThan(0);
    expect(fb.getByText(/medow/)).toBeTruthy(); // 学生写错的那个划掉给他看
  });
});

describe('S9B0 正式测试：保存失败与重试', () => {
  it('**失败：留住选择、给重试、不往下走、不自己判对错**', async () => {
    const user = userEvent.setup();
    vi.mocked(api.vocabQuizStart).mockResolvedValue(attempt() as any);
    vi.mocked(api.vocabQuizAnswer).mockRejectedValue(new Error('offline'));
    setup();
    await waitFor(() => expect(screen.getByText('harbour')).toBeTruthy());

    await user.click(screen.getByText('n. 港口'));
    await waitFor(() => expect(screen.getByTestId('answer-save-failed')).toBeTruthy());

    expect(screen.queryByText(FEEDBACK)).toBeNull();
    expect(screen.queryByTestId('quiz-continue')).toBeNull();
    // 还停在这一题
    expect(screen.getByText('harbour')).toBeTruthy();
  });

  it('**重试成功 → 反馈以服务端回执为准**', async () => {
    const user = userEvent.setup();
    vi.mocked(api.vocabQuizStart).mockResolvedValue(attempt() as any);
    vi.mocked(api.vocabQuizAnswer).mockRejectedValueOnce(new Error('offline')).mockResolvedValue({
      accepted: true,
      items: [revealed('harbour', 0), hidden('lantern', 1)],
    } as any);
    setup();
    await waitFor(() => expect(screen.getByText('harbour')).toBeTruthy());
    await user.click(screen.getByText('n. 港口'));
    await waitFor(() => expect(screen.getByTestId('answer-retry')).toBeTruthy());

    await user.click(screen.getByTestId('answer-retry'));
    await waitFor(() => expect(screen.getByText('答对了')).toBeTruthy());
    expect(within(screen.getByTestId('quiz-feedback')).getByText(/ˈhɑːbə/)).toBeTruthy();
    expect(screen.queryByTestId('answer-save-failed')).toBeNull();
  });

  it('**already_answered：照回执里已存的那次答案显示**', async () => {
    const user = userEvent.setup();
    vi.mocked(api.vocabQuizStart).mockResolvedValue(attempt() as any);
    vi.mocked(api.vocabQuizAnswer).mockResolvedValue({
      accepted: false,
      reason: 'already_answered',
      items: [
        revealed('harbour', 0, { isCorrect: false, studentIndex: 3, studentAnswer: OPTIONS[3] }),
        hidden('lantern', 1),
      ],
    } as any);
    setup();
    await waitFor(() => expect(screen.getByText('harbour')).toBeTruthy());

    await user.click(screen.getByText('n. 港口'));
    // 服务端说这一题早就答过、而且答错了 —— 照它说的显示
    await waitFor(() => expect(screen.getByText('正确答案已标出')).toBeTruthy());
    expect(screen.queryByText('答对了')).toBeNull();
    expect(screen.getByRole('button', { name: /n\. 港口/ }).textContent).toContain('✓');
  });
});

describe('S9B0 自由练习：一个字都没改', () => {
  const freeQ = {
    qtype: 'word_to_meaning',
    headword: 'harbour',
    prompt: 'harbour',
    options: OPTIONS,
    correctIndex: 0,
    phonetic: 'ˈhɑːbə',
    translation: 'n. 港口',
    contextSentence: 'The ships rest in the harbour.',
  };

  it('**题目自带答案 → 点一下立刻判、立刻给反馈**，不等任何回执', async () => {
    const user = userEvent.setup();
    vi.mocked(api.vocabQuizStart).mockRejectedValue({ body: { code: 'insufficient_items' } });
    vi.mocked(api.vocabQuiz).mockResolvedValue({
      questions: [freeQ, { ...freeQ, headword: 'lantern', prompt: 'lantern', correctIndex: 1 }],
      seenWords: 2, streakDays: 0, totalWords: 2,
    } as any);
    setup();
    await waitFor(() => expect(screen.getByText('harbour')).toBeTruthy());

    await user.click(screen.getByText('n. 港口'));
    expect(screen.getByText('答对了')).toBeTruthy();
    // 自由练习不打成绩接口
    expect(api.vocabQuizAnswer).not.toHaveBeenCalled();
  });

  it('**自由练习照旧写 FSRS**（正式测试才不写）', async () => {
    const user = userEvent.setup();
    const { submitReview } = await import('../../lib/reviewQueue');
    vi.mocked(submitReview).mockClear();
    vi.mocked(api.vocabQuizStart).mockRejectedValue({ body: { code: 'insufficient_items' } });
    vi.mocked(api.vocabQuiz).mockResolvedValue({
      questions: [freeQ], seenWords: 1, streakDays: 0, totalWords: 1,
    } as any);
    setup();
    await waitFor(() => expect(screen.getByText('harbour')).toBeTruthy());
    await user.click(screen.getByText('n. 港口'));
    await waitFor(() =>
      expect(submitReview).toHaveBeenCalledWith(
        expect.objectContaining({ headword: 'harbour', rating: 'good' }),
      ),
    );
  });
});
