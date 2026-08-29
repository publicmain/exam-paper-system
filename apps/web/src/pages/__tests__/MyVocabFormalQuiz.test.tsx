import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import MyVocabQuizPage from '../MyVocabQuiz';
import { api } from '../../lib/api';

/**
 * P6 —— 正式单词测试（有成绩）在页面上的行为。
 *
 * 最要紧的一条：正式测试**不写 FSRS**。考试是量一下，不是练一次；
 * 让考试改调度等于用尺子把被量的东西压短。这条一旦回归，页面上完全
 * 看不出来 —— 只有学生的复习节奏被悄悄改掉。
 */

vi.mock('../../lib/api', () => ({
  api: {
    vocabQuiz: vi.fn(),
    vocabReview: vi.fn().mockResolvedValue({}),
    vocabQuizStart: vi.fn(),
    vocabQuizAnswer: vi.fn().mockResolvedValue({ accepted: true }),
    vocabQuizSubmit: vi.fn(),
  },
}));

const item = (headword: string, over: Partial<any> = {}) => ({
  qtype: 'word_to_meaning',
  headword,
  prompt: headword,
  options: ['n. 港口', 'n. 灯笼', 'n. 草地', 'n. 卵石'],
  correctIndex: null, // 作答前服务端不下发答案
  answer: null,
  phonetic: null,
  translation: null,
  contextSentence: null,
  studentIndex: null,
  studentAnswer: null,
  isCorrect: null,
  answeredAt: null,
  ...over,
});

function attempt(over: Partial<any> = {}) {
  return {
    attemptId: 'att1',
    status: 'in_progress',
    startedAt: '2026-08-28T02:00:00.000Z',
    submittedAt: null,
    total: 4,
    correct: 0,
    score: null,
    items: [item('harbour'), item('lantern'), item('meadow'), item('pebble')].map((it, i) => ({
      ...it,
      index: i,
    })),
    resumed: false,
    ...over,
  };
}

/**
 * 服务端作答回执（S9B0 之后的真实形状）。
 *
 * `view()` 永远把整份 items 一起回，**只有作答过的那一题是揭开的**；
 * 判定（`isCorrect` / `correctIndex`）只在这里出现 —— 前端不再自己比。
 * 旧夹具只回 `{ accepted: true }`，那是服务端从来不会返回的形状。
 */
function answerReceipt(index: number, optionIndex: number | null, over: Partial<any> = {}) {
  return {
    accepted: true,
    items: attempt().items.map((it, n) =>
      n === index
        ? {
            ...it,
            headword: it.prompt,
            translation: 'n. 港口',
            phonetic: null,
            contextSentence: null,
            correctIndex: 0,
            studentIndex: optionIndex,
            studentAnswer: optionIndex == null ? null : it.options[optionIndex],
            isCorrect: optionIndex === 0,
            answeredAt: '2026-08-28T02:01:00.000Z',
          }
        : it,
    ),
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

describe('P6 正式测试', () => {
  beforeEach(() => {
    vi.mocked(api.vocabQuizStart).mockReset();
    vi.mocked(api.vocabQuizAnswer).mockReset();
    // 默认按真实服务端的形状回执：整份 items，只有这一题揭开。
    vi.mocked(api.vocabQuizAnswer).mockImplementation(async (args: any) =>
      answerReceipt(args.index, typeof args.optionIndex === 'number' ? args.optionIndex : null) as any,
    );
    vi.mocked(api.vocabQuizSubmit).mockReset();
    vi.mocked(api.vocabReview).mockClear();
    vi.mocked(api.vocabQuiz).mockClear();
    vi.mocked(api.vocabQuizSubmit).mockResolvedValue({ total: 4, correct: 3, score: 75 } as any);
  });

  it('够格 → 进入正式测试，题目来自服务端快照', async () => {
    vi.mocked(api.vocabQuizStart).mockResolvedValue(attempt() as any);
    setup();
    await waitFor(() => expect(screen.getByText('harbour')).toBeTruthy());
    expect(api.vocabQuiz).not.toHaveBeenCalled(); // 没退回自由练习
  });

  it('**作答走成绩接口，绝不写 FSRS**', async () => {
    const user = userEvent.setup();
    vi.mocked(api.vocabQuizStart).mockResolvedValue(attempt() as any);
    setup();
    await waitFor(() => expect(screen.getByText('harbour')).toBeTruthy());

    await user.click(screen.getByText('n. 港口'));

    await waitFor(() => expect(api.vocabQuizAnswer).toHaveBeenCalled());
    expect(api.vocabQuizAnswer).toHaveBeenCalledWith(
      expect.objectContaining({ index: 0, optionIndex: 0, studentId: 'stu1' }),
    );
    // 这一条是核心
    expect(api.vocabReview).not.toHaveBeenCalled();
  });

  it('**中途退出后恢复到第一道没答的题**', async () => {
    const a = attempt();
    a.items[0] = { ...a.items[0], isCorrect: true, studentIndex: 0 };
    a.items[1] = { ...a.items[1], isCorrect: false, studentIndex: 2 };
    vi.mocked(api.vocabQuizStart).mockResolvedValue({ ...a, resumed: true } as any);
    setup();
    // 前两题答过了 → 落在第 3 题
    await waitFor(() => expect(screen.getByText('meadow')).toBeTruthy());
    expect(screen.queryByText('harbour')).toBeNull();
  });

  it('**双击提交只发一次**（服务端也幂等，这里是第一道防线）', async () => {
    const user = userEvent.setup();
    const a = attempt();
    // 只剩最后一题没答
    a.items = a.items.map((it, i) => (i < 3 ? { ...it, isCorrect: true, studentIndex: 0 } : it));
    vi.mocked(api.vocabQuizStart).mockResolvedValue({ ...a, resumed: true } as any);
    setup();
    await waitFor(() => expect(screen.getByText('pebble')).toBeTruthy());

    await user.click(screen.getByText('n. 港口'));
    await waitFor(() => expect(api.vocabQuizAnswer).toHaveBeenCalled());
    // 走到完成页
    const cont = await screen.findByText(/继续|下一题|完成|再练|去看成绩/);
    await user.click(cont);

    await waitFor(() => expect(api.vocabQuizSubmit).toHaveBeenCalled());
    expect(api.vocabQuizSubmit).toHaveBeenCalledTimes(1);
  });

  it('已交卷 → 直接显示落库的成绩，不重考', async () => {
    vi.mocked(api.vocabQuizStart).mockResolvedValue(
      attempt({
        status: 'submitted',
        submittedAt: '2026-08-28T03:00:00.000Z',
        total: 4,
        correct: 3,
        score: 75,
      }) as any,
    );
    setup();
    await waitFor(() => expect(screen.getByText(/75/)).toBeTruthy());
    // 不再出题
    expect(screen.queryByText('n. 港口')).toBeNull();
  });

  it('**不够格（not_ready）→ 退回自由练习**，老行为原样', async () => {
    vi.mocked(api.vocabQuizStart).mockRejectedValue(new Error('{"code":"not_ready"}'));
    vi.mocked(api.vocabQuiz).mockResolvedValue({
      questions: [
        {
          qtype: 'word_to_meaning',
          headword: 'axis',
          prompt: 'axis',
          options: ['n. 轴', 'n. 骨骼', 'n. 模式', 'n. 狭缝'],
          correctIndex: 0,
          phonetic: null,
          translation: 'n. 轴',
          contextSentence: null,
        },
      ],
      seenWords: 3,
      streakDays: 0,
      totalWords: 10,
    } as any);
    setup();
    await waitFor(() => expect(screen.getByText('axis')).toBeTruthy());
    expect(api.vocabQuiz).toHaveBeenCalled();
  });

  it('api 里没有这个方法（旧构建）也能退回自由练习，不白屏', async () => {
    vi.mocked(api.vocabQuizStart).mockImplementation(() => {
      throw new TypeError('api.vocabQuizStart is not a function');
    });
    vi.mocked(api.vocabQuiz).mockResolvedValue({
      questions: [
        {
          qtype: 'word_to_meaning',
          headword: 'axis',
          prompt: 'axis',
          options: ['n. 轴', 'n. 骨骼', 'n. 模式', 'n. 狭缝'],
          correctIndex: 0,
          phonetic: null,
          translation: 'n. 轴',
          contextSentence: null,
        },
      ],
      seenWords: 3,
      streakDays: 0,
      totalWords: 10,
    } as any);
    setup();
    await waitFor(() => expect(screen.getByText('axis')).toBeTruthy());
  });
});

/**
 * P6 收尾 —— 作答保存失败绝不能被当成「未作答」。
 *
 * 原来失败只被 catch 掉、照样进下一题，交卷时那一题按空白算错。学生真的
 * 选了答案，成绩单上却是空的 —— 这是分数造假，不是网络问题。
 */
describe('P6 收尾 · 作答持久化', () => {
  beforeEach(() => {
    vi.mocked(api.vocabQuizStart).mockReset();
    vi.mocked(api.vocabQuizAnswer).mockReset();
    vi.mocked(api.vocabQuizSubmit).mockResolvedValue({ total: 4, correct: 0, score: 0 } as any);
    vi.mocked(api.vocabQuizStart).mockResolvedValue(attempt() as any);
  });

  it('**保存失败 → 停在原题、选项保持选中、给明确重试**', async () => {
    const user = userEvent.setup();
    vi.mocked(api.vocabQuizAnswer).mockRejectedValueOnce(new Error('offline'));
    setup();
    await waitFor(() => expect(screen.getByText('harbour')).toBeTruthy());

    await user.click(screen.getByText('n. 港口'));

    await waitFor(() => expect(screen.getByTestId('answer-save-failed')).toBeTruthy());
    expect(screen.getByText(/这一题还没存上/)).toBeTruthy();
    // 还在第一题（答完后反馈区也会出现词，所以用 getAllByText）
    expect(screen.getAllByText('harbour').length).toBeGreaterThan(0);
    expect(screen.queryByText('lantern')).toBeNull();
    // 选项保持选中：四个选项仍在页面上且已禁用（不能改答案）
    expect(screen.getByText('n. 港口')).toBeTruthy();
    // 没有「继续」可点 —— 不能往下走
    expect(screen.queryByTestId('quiz-continue')).toBeNull();
    expect(screen.getByTestId('answer-retry')).toBeTruthy();
  });

  it('**重试成功后正常继续**，重试打的是同一个幂等接口、同样的参数', async () => {
    const user = userEvent.setup();
    vi.mocked(api.vocabQuizAnswer)
      .mockRejectedValueOnce(new Error('offline'))
      .mockResolvedValue(answerReceipt(0, 0) as any);
    setup();
    await waitFor(() => expect(screen.getByText('harbour')).toBeTruthy());

    await user.click(screen.getByText('n. 港口'));
    await waitFor(() => expect(screen.getByTestId('answer-retry')).toBeTruthy());

    await user.click(screen.getByTestId('answer-retry'));
    await waitFor(() => expect(screen.getByTestId('quiz-continue')).toBeTruthy());

    const calls = vi.mocked(api.vocabQuizAnswer).mock.calls.map((c: any) => c[0]);
    expect(calls).toHaveLength(2);
    expect(calls[0]).toEqual(calls[1]); // 同一题、同一个选项 —— 幂等重发
    await user.click(screen.getByTestId('quiz-continue'));
    await waitFor(() => expect(screen.getByText('lantern')).toBeTruthy());
  });

  it('保存失败后**不会提交**（不产生一份含空白答案的成绩）', async () => {
    const user = userEvent.setup();
    const a = attempt();
    a.items = a.items.map((it, i) => (i < 3 ? { ...it, isCorrect: true, studentIndex: 0 } : it));
    vi.mocked(api.vocabQuizStart).mockResolvedValue({ ...a, resumed: true } as any);
    vi.mocked(api.vocabQuizAnswer).mockRejectedValue(new Error('offline'));
    setup();
    await waitFor(() => expect(screen.getByText('pebble')).toBeTruthy());

    await user.click(screen.getByText('n. 港口'));
    await waitFor(() => expect(screen.getByTestId('answer-save-failed')).toBeTruthy());
    expect(api.vocabQuizSubmit).not.toHaveBeenCalled();
  });
});
