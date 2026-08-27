import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, waitFor, act } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import MyVocabReviewPage from '../MyVocabReview';
import { api } from '../../lib/api';

/**
 * P3 翻卡断点恢复（docs/refactor-plan.md P3）。
 *
 * 契约：学生翻到第 N 张退出/刷新/换设备重登，回来从第 N 张继续，
 * 而不是从头再翻一遍。断点存在**服务端**（DailyLessonCompletion
 * .vocabCursor）—— 所以换设备、重新登录同样有效，这是它不放
 * localStorage 的原因。
 *
 * 同时守两条兜底：拿不到断点不打扰学生（从头翻）、断点越界回 0
 * （卡片列表随 FSRS 调度会变短）。
 */

vi.mock('../../lib/api', () => ({
  api: {
    // RC1.1：翻卡页先问课程队列（/vocab/lesson-cards）。这几个用例测的
    // 是自由练习口径，所以让它回 lessonContext:false —— 页面按设计
    // 退回 vocabDue，原有断言原样成立。
    vocabLessonCards: vi.fn(),
    vocabDue: vi.fn(),
    vocabReview: vi.fn().mockResolvedValue({ intervalDays: 2, state: 'review', reps: 1 }),
    lessonToday: vi.fn(),
    lessonVocabCursor: vi.fn().mockResolvedValue({ ok: true, cursor: 1 }),
  },
}));

const card = (headword: string) => ({
  headword,
  surfaceForm: headword,
  contextSentence: `A sentence with ${headword} inside.`,
  sourcePassageTitle: 'Snowy',
  phonetic: null,
  translation: 'n. 测试',
  tag: [],
  state: 'learning',
  reps: 2,
  sourceType: 'click',
  addedAt: '2026-08-20T00:00:00.000Z',
});

const FIVE = ['alpha', 'bravo', 'charlie', 'delta', 'echo'].map(card);

function setup() {
  const u = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
  render(
    <MemoryRouter initialEntries={['/my-vocab/review?name=%E5%BC%A0%E4%B8%89']}>
      <Routes>
        <Route path="/my-vocab/review" element={<MyVocabReviewPage />} />
        <Route path="/my-vocab" element={<div>VOCAB HOME</div>} />
        <Route path="/my-history" element={<div>HISTORY</div>} />
      </Routes>
    </MemoryRouter>,
  );
  return u;
}

beforeEach(() => {
  vi.clearAllMocks();
  // shouldAdvanceTime：假时钟仍随真实时间走，waitFor 的轮询才不会被冻住
  vi.useFakeTimers({ shouldAdvanceTime: true });
  (api.vocabLessonCards as any).mockResolvedValue({ lessonContext: false, cards: [] });
  (api.vocabDue as any).mockResolvedValue({ cards: FIVE });
});
afterEach(() => {
  vi.useRealTimers();
});

describe('P3 翻卡断点恢复', () => {
  it('正常进入（无断点）→ 从第 1 张开始', async () => {
    (api.lessonToday as any).mockResolvedValue({ vocabCursor: 0 });
    setup();
    await waitFor(() => expect(screen.getByText(/今日生词/)).toBeInTheDocument());
    expect(screen.getByText(/今日生词/).textContent).toContain('1');
  });

  it('**刷新/重新登录恢复**：断点 3 → 从第 4 张继续', async () => {
    // 断点来自服务端，不是本机 —— 换设备、重新登录同样恢复
    (api.lessonToday as any).mockResolvedValue({ vocabCursor: 3 });
    setup();
    await waitFor(() => {
      expect(screen.getByText(/今日生词/).textContent).toContain('4');
    });
    // 正面是挖空句（词被挖掉），断言句子的其余部分而不是词本身
    expect(screen.getByText(/A sentence with/)).toBeInTheDocument();
  });

  it('**翻卡中退出**：评分推进后上报断点', async () => {
    (api.lessonToday as any).mockResolvedValue({ vocabCursor: 0 });
    const u = setup();
    await waitFor(() => expect(screen.getByText(/显示答案/)).toBeInTheDocument());
    await u.click(screen.getByText(/显示答案/));
    await act(async () => {
      vi.advanceTimersByTime(1600); // 越过最小停留锁
    });
    await u.click(screen.getByText(/记住了|记得/));
    await waitFor(() => {
      expect(api.lessonVocabCursor).toHaveBeenCalledWith('张三', 1, undefined);
    });
  });

  it('断点越界（列表变短）→ 回第 1 张，不卡死', async () => {
    (api.lessonToday as any).mockResolvedValue({ vocabCursor: 99 });
    setup();
    await waitFor(() => expect(screen.getByText(/今日生词/)).toBeInTheDocument());
    expect(screen.getByText(/今日生词/).textContent).toContain('1');
  });

  it('拿不到断点（接口失败）→ 从头翻，不打扰学生', async () => {
    (api.lessonToday as any).mockRejectedValue(new Error('offline'));
    setup();
    await waitFor(() => expect(screen.getByText(/今日生词/)).toBeInTheDocument());
    expect(screen.getByText(/今日生词/).textContent).toContain('1');
    expect(screen.getByText(/显示答案/)).toBeInTheDocument();
  });
});
