import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, waitFor, act } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import MyVocabReviewPage from '../MyVocabReview';
import { api } from '../../lib/api';

/**
 * 最小停留锁（2026-08-25 上线首日实测后加）。
 *
 * 真机数据：每张卡停留中位数 5.1s → 1.6s、21 次评分 100%「记住了」，
 * 一名学生 25 秒刷完 10 张。两档评分把绿色按钮钉死在右边，闭眼连点
 * 的成本比四档时代还低 —— 复习退化成了「下一张」按钮。
 *
 * 契约：显示答案后 1.5 秒内评分按钮禁用，并说明原因；到点才亮。
 *
 * ⚠️ 用假时钟推进那 1.5 秒，不真等 —— 本仓库的 web 测试在并发满载时
 * 会集体超时（既有 flake），三个测试真等 4.5 秒会把它推得更糟。
 * userEvent 必须配 advanceTimers，否则它内部的延迟会永远等不到。
 */

vi.mock('../../lib/api', () => ({
  api: {
    vocabDue: vi.fn(),
    vocabReview: vi.fn().mockResolvedValue({ intervalDays: 2, state: 'review', reps: 1 }),
    // P3 断点恢复：翻卡页会读 today() 拿 vocabCursor、评分后上报 cursor。
    // 两者都是 best-effort（失败不打扰学生），这里给出成功的空档回应。
    lessonToday: vi.fn().mockResolvedValue({ vocabCursor: 0 }),
    lessonVocabCursor: vi.fn().mockResolvedValue({ ok: true, cursor: 1 }),
  },
}));

const card = (over: Partial<any> = {}) => ({
  headword: 'latch',
  surfaceForm: 'latch',
  contextSentence: 'I did not check the latch.',
  sourcePassageTitle: 'Snowy',
  phonetic: null,
  translation: 'n. 门闩',
  tag: [],
  state: 'learning',
  reps: 2,
  sourceType: 'click',
  addedAt: '2026-08-20T00:00:00.000Z',
  ...over,
});

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

/** 越过最小停留窗口 */
async function passDwell() {
  await act(async () => {
    vi.advanceTimersByTime(1600);
  });
}

beforeEach(() => {
  vi.clearAllMocks();
  localStorage.clear();
  // shouldAdvanceTime：假时钟仍随真实时间走，waitFor 的轮询才不会被冻住；
  // advanceTimersByTime 依然能一步跳过那 1.5 秒。
  vi.useFakeTimers({ shouldAdvanceTime: true });
});
afterEach(() => vi.useRealTimers());

describe('翻卡最小停留锁', () => {
  it('显示答案后按钮先禁用并给出原因，1.5 秒后亮起', async () => {
    (api.vocabDue as any).mockResolvedValue({ cards: [card(), card({ headword: 'sigh' })] });
    const u = setup();
    await waitFor(() => expect(screen.getByText(/显示答案/)).toBeInTheDocument());
    await u.click(screen.getByText(/显示答案/));

    const forgot = screen.getByRole('button', { name: /忘了/ });
    const got = screen.getByRole('button', { name: /记得/ });
    expect(forgot).toBeDisabled();
    expect(got).toBeDisabled();
    expect(screen.getByText('先读一遍上面的意思…')).toBeInTheDocument();

    // 锁定期内点下去不产生任何提交
    await u.click(got).catch(() => {});
    expect(api.vocabReview).not.toHaveBeenCalled();

    await passDwell();
    expect(got).toBeEnabled();
    expect(forgot).toBeEnabled();
  });

  it('解锁后正常评分并进入下一张（新卡重新上锁）', async () => {
    (api.vocabDue as any).mockResolvedValue({ cards: [card(), card({ headword: 'sigh' })] });
    const u = setup();
    await waitFor(() => expect(screen.getByText(/显示答案/)).toBeInTheDocument());
    await u.click(screen.getByText(/显示答案/));
    await passDwell();
    await u.click(screen.getByRole('button', { name: /记得/ }));
    await waitFor(() => expect(api.vocabReview).toHaveBeenCalledTimes(1));
    // 第二张卡回到未翻面状态
    await waitFor(() => expect(screen.getByText(/显示答案/)).toBeInTheDocument());
    expect(screen.getByText(/今日生词/).textContent).toContain('2');
  });

  it('服务端判定太快时如实告知，且不给撤销入口', async () => {
    (api.vocabDue as any).mockResolvedValue({ cards: [card(), card({ headword: 'sigh' })] });
    (api.vocabReview as any).mockResolvedValue({
      headword: 'latch', state: 'learning', due: '2026-08-25T00:00:00.000Z',
      intervalDays: 4, reps: 2, tooFast: true,
    });
    const u = setup();
    await waitFor(() => expect(screen.getByText(/显示答案/)).toBeInTheDocument());
    await u.click(screen.getByText(/显示答案/));
    await passDwell();
    await u.click(screen.getByRole('button', { name: /记得/ }));
    await waitFor(() => expect(screen.getByText(/太快了，这次不算/)).toBeInTheDocument());
    expect(screen.queryByRole('button', { name: '撤销' })).toBeNull();
  });
});
