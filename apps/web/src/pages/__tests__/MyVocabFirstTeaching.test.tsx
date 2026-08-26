import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import MyVocabReviewPage from '../MyVocabReview';
import { api } from '../../lib/api';

/**
 * P5 —— 新词第一次出现是**教学**，不是考试。
 *
 * 这些测试守的是产品规则 1 的字面：第一面直接给答案，页面上不出现任何
 * 测试型控件。它们同时是回归防线 —— 「教学卡顺手复用了评分按钮」这种
 * 退化在截图上不明显，但学生的调度会被一次假评分污染。
 */

vi.mock('../../lib/api', () => ({
  api: {
    vocabDue: vi.fn(),
    vocabReview: vi.fn().mockResolvedValue({ intervalDays: 2, state: 'review', reps: 1 }),
    vocabFirstTaught: vi.fn().mockResolvedValue({ ok: true, alreadyTaught: false }),
    vocabReviewUndo: vi.fn(),
    lessonToday: vi.fn().mockResolvedValue({ vocabCursor: 0 }),
    lessonVocabCursor: vi.fn().mockResolvedValue({ ok: true, cursor: 1 }),
  },
}));

/** 新词卡（服务端判定 needsFirstTeaching=true） */
const newWord = (headword: string, extra: Record<string, unknown> = {}) => ({
  headword,
  surfaceForm: headword,
  contextSentence: `The ${headword} stood quietly by the water.`,
  sourcePassageTitle: 'Harbour Town',
  phonetic: 'ˈhɑːbə',
  pos: 'n.',
  definition: 'a place on the coast where ships may shelter',
  translation: 'n. 海港；避难所',
  tag: [],
  state: 'new',
  reps: 0,
  needsFirstTeaching: true,
  firstTaughtAt: null,
  sourceType: 'click',
  addedAt: '2026-08-26T00:00:00.000Z',
  ...extra,
});

/** 复习卡（教过了，走原有必要交互） */
const reviewWord = (headword: string) => ({
  ...newWord(headword),
  state: 'review',
  reps: 3,
  needsFirstTeaching: false,
  firstTaughtAt: '2026-08-20T00:00:00.000Z',
});

function setup(cards: unknown[]) {
  vi.mocked(api.vocabDue).mockResolvedValue({
    student: { id: 'stu1', name: '小明' },
    totalDue: cards.length,
    cards,
  } as any);
  return render(
    <MemoryRouter initialEntries={['/my-vocab/review?name=%E5%B0%8F%E6%98%8E&studentId=stu1']}>
      <Routes>
        <Route path="/my-vocab/review" element={<MyVocabReviewPage />} />
        <Route path="*" element={<div>navigated-away</div>} />
      </Routes>
    </MemoryRouter>,
  );
}

/** 首次教学面上一律不该出现的东西 */
function expectNoTestingControls() {
  expect(screen.queryByText(/显示答案/)).toBeNull();
  expect(screen.queryByText('记住了')).toBeNull();
  expect(screen.queryByText('没记住')).toBeNull();
  expect(screen.queryByText('记得')).toBeNull();
  expect(screen.queryByText('忘了')).toBeNull();
  expect(screen.queryByText('撤销')).toBeNull();
  expect(screen.queryByText(/待会儿再见/)).toBeNull();
  // 挖空的下划线：教学面不挖空
  expect(document.body.textContent).not.toMatch(/_{3,}/);
}

describe('P5 首次教学卡', () => {
  beforeEach(() => {
    localStorage.clear();
    vi.mocked(api.vocabFirstTaught).mockClear();
    vi.mocked(api.vocabReview).mockClear();
    vi.mocked(api.lessonVocabCursor).mockClear();
  });
  afterEach(() => localStorage.clear());

  it('**全新词第一次出现直接显示完整教学内容**', async () => {
    setup([newWord('harbour')]);
    await waitFor(() => expect(screen.getByText('harbour')).toBeTruthy());
    expect(screen.getByText('第一次学')).toBeTruthy();
    expect(screen.getByText('/ˈhɑːbə/')).toBeTruthy();          // 音标
    expect(screen.getByText('n.')).toBeTruthy();                  // 词性
    expect(screen.getByText(/海港/)).toBeTruthy();                // 中文释义
    expect(screen.getByText(/a place on the coast/)).toBeTruthy(); // 英文释义
    expect(screen.getByText(/stood quietly by the water/)).toBeTruthy(); // 例句
    expect(screen.getByText(/来自《Harbour Town》/)).toBeTruthy();
    expect(screen.getByTestId('teach-next')).toBeTruthy();        // 下一个
  });

  it('**教学面不出现任何测试型控件**（挖空/显示答案/认识不认识/待会儿再见/撤销）', async () => {
    setup([newWord('harbour'), newWord('lantern')]);
    await waitFor(() => expect(screen.getByText('harbour')).toBeTruthy());
    expectNoTestingControls();
  });

  it('缺音标/词性/翻译/例句时不崩，缺的行直接不显示', async () => {
    setup([
      newWord('sparse', {
        phonetic: null,
        pos: null,
        definition: null,
        translation: '',
        contextSentence: '',
        sourcePassageTitle: null,
      }),
    ]);
    await waitFor(() => expect(screen.getByText('sparse')).toBeTruthy());
    expect(screen.queryByText(/你读到的这句话/)).toBeNull();
    expect(screen.queryByText(/来自《/)).toBeNull();
    expect(screen.getByTestId('teach-next')).toBeTruthy();
  });

  it('**点「下一个」只标记教过、推进断点 —— 绝不提交评分**', async () => {
    const user = userEvent.setup();
    setup([newWord('harbour'), newWord('lantern')]);
    await waitFor(() => expect(screen.getByText('harbour')).toBeTruthy());

    await user.click(screen.getByTestId('teach-next'));

    await waitFor(() => expect(screen.getByText('lantern')).toBeTruthy());
    expect(api.vocabFirstTaught).toHaveBeenCalledWith(
      expect.objectContaining({ headword: 'harbour', studentId: 'stu1' }),
    );
    // 这一条是核心：教学不得走评分接口
    expect(api.vocabReview).not.toHaveBeenCalled();
    // 断点落库
    expect(api.lessonVocabCursor).toHaveBeenCalledWith('小明', 1, 'stu1');
  });

  it('标记接口失败也不拦学生（明天再教一次即可）', async () => {
    const user = userEvent.setup();
    vi.mocked(api.vocabFirstTaught).mockRejectedValueOnce(new Error('offline'));
    setup([newWord('harbour'), newWord('lantern')]);
    await waitFor(() => expect(screen.getByText('harbour')).toBeTruthy());
    await user.click(screen.getByTestId('teach-next'));
    await waitFor(() => expect(screen.getByText('lantern')).toBeTruthy());
  });

  it('最后一张教学卡完成后进入完成页，且不产生任何评分', async () => {
    const user = userEvent.setup();
    setup([newWord('harbour')]);
    await waitFor(() => expect(screen.getByText('harbour')).toBeTruthy());
    await user.click(screen.getByTestId('teach-next'));
    await waitFor(() => expect(screen.getByText('今日生词看完了')).toBeTruthy());
    expect(api.vocabReview).not.toHaveBeenCalled();
  });

  it('断点恢复：服务端 cursor=1 时直接落在第 2 张教学卡', async () => {
    vi.mocked(api.lessonToday).mockResolvedValueOnce({ vocabCursor: 1 } as any);
    setup([newWord('harbour'), newWord('lantern')]);
    await waitFor(() => expect(screen.getByText('lantern')).toBeTruthy());
    expect(screen.queryByText('harbour')).toBeNull();
  });
});

describe('P5 混合队列 —— 新词与复习词互不污染', () => {
  beforeEach(() => {
    vi.mocked(api.vocabFirstTaught).mockClear();
    vi.mocked(api.vocabReview).mockClear();
    vi.mocked(api.lessonToday).mockResolvedValue({ vocabCursor: 0 } as any);
  });

  it('新词走教学卡，复习词走原有的挖空 + 显示答案 + 评分', async () => {
    const user = userEvent.setup();
    setup([newWord('harbour'), reviewWord('lantern')]);

    // 第 1 张：教学
    await waitFor(() => expect(screen.getByText('harbour')).toBeTruthy());
    expect(screen.getByText('第一次学')).toBeTruthy();
    expectNoTestingControls();

    await user.click(screen.getByTestId('teach-next'));

    // 第 2 张：复习 —— 原有交互回来了
    await waitFor(() => expect(screen.getByText(/显示答案/)).toBeTruthy());
    expect(screen.queryByText('第一次学')).toBeNull();
    expect(screen.queryByTestId('teach-next')).toBeNull();
    // 复习卡正面是挖空，答案此刻不可见
    expect(screen.queryByText('lantern')).toBeNull();
    // 教学那一下没有写成评分
    expect(api.vocabReview).not.toHaveBeenCalled();
    expect(api.vocabFirstTaught).toHaveBeenCalledTimes(1);
  });

  it('复习卡不会被误判成教学卡（reps>0 且已教过）', async () => {
    setup([reviewWord('lantern')]);
    await waitFor(() => expect(screen.getByText(/显示答案/)).toBeTruthy());
    expect(screen.queryByTestId('teach-next')).toBeNull();
    expect(api.vocabFirstTaught).not.toHaveBeenCalled();
  });

  it('字段缺失时的兜底：没有 needsFirstTeaching 就按 firstTaughtAt+reps 判', async () => {
    const legacy = { ...newWord('legacy') } as Record<string, unknown>;
    delete legacy.needsFirstTeaching;
    setup([legacy]);
    await waitFor(() => expect(screen.getByTestId('teach-next')).toBeTruthy());
  });
});
