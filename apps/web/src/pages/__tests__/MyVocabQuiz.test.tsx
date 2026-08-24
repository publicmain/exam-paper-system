import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import MyVocabQuizPage from '../MyVocabQuiz';
import { api } from '../../lib/api';

/**
 * 自测页的行为契约：
 * - 客观判分：选对绿、选错红并标出正确项，节奏由「继续」按钮控制（不自动跳）
 * - 错题回炉：第一遍答错的题排到队尾再考一次，但 FSRS 只按第一遍写
 * - 完成页统计的是「一次答对」，回炉答对不算
 */

vi.mock('../../lib/api', () => ({
  api: { vocabQuiz: vi.fn(), vocabReview: vi.fn().mockResolvedValue({}) },
}));

const Q = (over: Partial<any> = {}) => ({
  qtype: 'word_to_meaning',
  headword: 'axis',
  prompt: 'axis',
  options: ['n. 轴', 'n. 骨骼', 'n. 模式', 'n. 狭缝'],
  correctIndex: 0,
  phonetic: "'æksis",
  translation: 'n. 轴',
  contextSentence: null,
  ...over,
});

function renderQuiz() {
  return render(
    <MemoryRouter initialEntries={['/my-vocab/quiz?name=测试学生']}>
      <Routes>
        <Route path="/my-vocab/quiz" element={<MyVocabQuizPage />} />
      </Routes>
    </MemoryRouter>,
  );
}

beforeEach(() => vi.clearAllMocks());

describe('MyVocabQuiz', () => {
  it('答对：绿色反馈 + 继续按钮，FSRS 收到 good', async () => {
    (api.vocabQuiz as any).mockResolvedValue({
      student: { id: 's1', name: '测试学生' },
      streakDays: 3,
      totalWords: 10,
      questions: [Q()],
    });
    const u = userEvent.setup();
    renderQuiz();
    await screen.findByText('选出正确的意思');
    await u.click(screen.getByText('n. 轴'));
    expect(await screen.findByText('答对了')).toBeTruthy();
    expect(api.vocabReview).toHaveBeenCalledWith(
      expect.objectContaining({ headword: 'axis', rating: 'good' }),
    );
    await u.click(screen.getByText('继续'));
    // 只有一题 → 完成页，一次答对 1/1
    expect(await screen.findByText(/一次答对/)).toBeTruthy();
    expect(screen.getByText(/🔥 连续学习 3 天/)).toBeTruthy();
  });

  it('答错：标出正确项、错题回炉一次、FSRS 只写一次 again', async () => {
    (api.vocabQuiz as any).mockResolvedValue({
      student: { id: 's1', name: '测试学生' },
      streakDays: 0,
      totalWords: 10,
      questions: [Q()],
    });
    const u = userEvent.setup();
    renderQuiz();
    await screen.findByText('选出正确的意思');
    await u.click(screen.getByText('n. 骨骼')); // 答错
    expect(await screen.findByText('正确答案已标出')).toBeTruthy();
    expect(api.vocabReview).toHaveBeenCalledTimes(1);
    expect(api.vocabReview).toHaveBeenCalledWith(
      expect.objectContaining({ headword: 'axis', rating: 'again' }),
    );
    await u.click(screen.getByText('继续'));
    // 错题回炉：同一题再来，带「错题再试」标记
    expect(await screen.findByText(/错题再试/)).toBeTruthy();
    await u.click(screen.getByText('n. 轴')); // 这次答对
    await u.click(screen.getByText('继续'));
    // FSRS 仍然只写过第一遍那一次
    expect(api.vocabReview).toHaveBeenCalledTimes(1);
    // 完成页：一次答对 0/1，错词列出
    expect(await screen.findByText(/一次答对/)).toBeTruthy();
    expect(screen.getByText(/这几个词还不熟/)).toBeTruthy();
  });

  it('生词本为空 → 引导去攒词，而不是白屏', async () => {
    (api.vocabQuiz as any).mockResolvedValue({
      student: { id: 's1', name: '测试学生' },
      streakDays: 0,
      totalWords: 0,
      questions: [],
    });
    renderQuiz();
    expect(await screen.findByText('还出不了题')).toBeTruthy();
    expect(screen.getByText('返回生词本')).toBeTruthy();
  });

  it('选项在作答后禁用 —— 不能改答案刷正确率', async () => {
    (api.vocabQuiz as any).mockResolvedValue({
      student: { id: 's1', name: '测试学生' },
      streakDays: 0,
      totalWords: 5,
      questions: [Q()],
    });
    const u = userEvent.setup();
    renderQuiz();
    await screen.findByText('选出正确的意思');
    await u.click(screen.getByText('n. 骨骼'));
    await waitFor(() => expect(api.vocabReview).toHaveBeenCalledTimes(1));
    // 再点正确项那个按钮（反馈条里也有 "n. 轴" 文本，必须限定在按钮上）
    const correctBtn = screen
      .getAllByRole('button')
      .find((b) => b.textContent?.includes('n. 轴'))!;
    expect(correctBtn).toHaveProperty('disabled', true);
    await u.click(correctBtn).catch(() => {}); // 禁用按钮点击无效
    expect(api.vocabReview).toHaveBeenCalledTimes(1); // 不再提交
  });
});

/** 拼写半产出题（2026-08-24 研究性分析 #2）。 */
describe('MyVocabQuiz — 拼写题', () => {
  const SPELL = {
    qtype: 'spelling',
    headword: 'latch',
    prompt: 'I did not check the ＿＿＿.',
    options: [],
    correctIndex: -1,
    phonetic: null,
    translation: 'n. 门闩',
    contextSentence: 'I did not check the latch.',
    answer: 'latch',
    hint: 'l',
  };

  it('输对（含大小写/空白归一）：绿反馈，FSRS 收 good', async () => {
    (api.vocabQuiz as any).mockResolvedValue({
      student: { id: 's1', name: '测试学生' },
      streakDays: 0,
      totalWords: 9,
      seenWords: 5,
      questions: [SPELL],
    });
    const u = userEvent.setup();
    renderQuiz();
    await screen.findByText('把缺的词拼出来——');
    await u.type(screen.getByRole('textbox'), '  Latch ');
    await u.click(screen.getByText('提交'));
    expect(await screen.findByText('答对了')).toBeTruthy();
    expect(api.vocabReview).toHaveBeenCalledWith(
      expect.objectContaining({ headword: 'latch', rating: 'good' }),
    );
    await u.click(screen.getByText('继续'));
    expect(await screen.findByText(/一次答对/)).toBeTruthy();
  });

  it('「不会写」= 按答错记 + 回炉再试一次，FSRS 只写第一遍', async () => {
    (api.vocabQuiz as any).mockResolvedValue({
      student: { id: 's1', name: '测试学生' },
      streakDays: 0,
      totalWords: 9,
      seenWords: 5,
      questions: [SPELL],
    });
    const u = userEvent.setup();
    renderQuiz();
    await screen.findByText('把缺的词拼出来——');
    await u.click(screen.getByText('不会写'));
    expect(await screen.findByText('正确拼写在下面')).toBeTruthy();
    expect(api.vocabReview).toHaveBeenCalledTimes(1);
    expect(api.vocabReview).toHaveBeenCalledWith(
      expect.objectContaining({ headword: 'latch', rating: 'again' }),
    );
    await u.click(screen.getByText('继续'));
    // 回炉：同一题再来，输入框已清空
    expect(await screen.findByText(/错题再试/)).toBeTruthy();
    expect((screen.getByRole('textbox') as HTMLInputElement).value).toBe('');
    await u.type(screen.getByRole('textbox'), 'latch');
    await u.click(screen.getByText('提交'));
    expect(await screen.findByText('答对了')).toBeTruthy();
    expect(api.vocabReview).toHaveBeenCalledTimes(1); // 回炉不重复写
  });

  it('输错：显示正确拼写与我写的，计入错词', async () => {
    (api.vocabQuiz as any).mockResolvedValue({
      student: { id: 's1', name: '测试学生' },
      streakDays: 0,
      totalWords: 9,
      seenWords: 5,
      questions: [SPELL],
    });
    const u = userEvent.setup();
    renderQuiz();
    await screen.findByText('把缺的词拼出来——');
    await u.type(screen.getByRole('textbox'), 'lacth');
    await u.click(screen.getByText('提交'));
    expect(await screen.findByText('正确拼写在下面')).toBeTruthy();
    expect(screen.getByText('lacth')).toBeTruthy(); // 我写的（划线展示）
    expect(api.vocabReview).toHaveBeenCalledWith(
      expect.objectContaining({ rating: 'again' }),
    );
  });
});
