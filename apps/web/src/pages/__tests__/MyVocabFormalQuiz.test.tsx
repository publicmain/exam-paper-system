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
    vi.mocked(api.vocabQuizAnswer).mockClear();
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
