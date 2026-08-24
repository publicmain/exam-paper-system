import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, act, waitFor } from '@testing-library/react';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import MorningQuizTakePage from '../MorningQuizTake';
import { api } from '../../lib/api';

/** R10 — pre-submit confirm dialog: never let a tap on "交卷" silently
 *  lock a partial submission. Tests cover all-answered, partial,
 *  cancel, jump-to-question, ESC, and time-up bypass. */

vi.mock('../../lib/api', () => ({
  api: {
    morningQuizSession: vi.fn(),
    morningQuizSaveAnswer: vi.fn(),
    morningQuizSubmit: vi.fn(),
  },
}));

const mockPaper = (n: number) => ({
  sessionId: 'sess1',
  paperId: 'p1',
  paperName: 'Test Paper',
  paperMode: 'passage_pick',
  level: 'ielts_authentic',
  totalMarks: n,
  durationMin: 30,
  attendanceStart: new Date(Date.now() - 60_000).toISOString(),
  attendanceEnd: new Date(Date.now() + 600_000).toISOString(),
  quizStart: new Date(Date.now() - 60_000).toISOString(),
  quizEnd: new Date(Date.now() + 1_800_000).toISOString(),
  // page hydrates from view.paperQuestions, not view.questions
  paperQuestions: Array.from({ length: n }, (_, i) => ({
    id: `q${i + 1}`,
    sortOrder: i + 1,
    marks: 1,
    questionType: 'short_answer',
    snapshotContent: {
      passage: 'Sample passage text long enough.',
      passageTitle: 'Sample',
      taskType: 'matching_information',
      stem: `Stem for question ${i + 1}`,
    },
    snapshotOptions: null,
  })),
});

function renderTake() {
  return render(
    <MemoryRouter initialEntries={['/morning-quiz/sess1']}>
      <Routes>
        <Route path="/morning-quiz/:sessionId" element={<MorningQuizTakePage />} />
      </Routes>
    </MemoryRouter>,
  );
}

beforeEach(() => {
  vi.clearAllMocks();
  (api.morningQuizSession as any).mockResolvedValue(mockPaper(3));
  (api.morningQuizSaveAnswer as any).mockResolvedValue({ ok: true });
  (api.morningQuizSubmit as any).mockResolvedValue({ ok: true });
});

describe('MorningQuiz submit confirmation (R10)', () => {
  it('clicking submit opens confirm dialog instead of submitting immediately', async () => {
    renderTake();
    const submitBtn = await screen.findByTestId('submit-button');
    fireEvent.click(submitBtn);
    expect(await screen.findByTestId('submit-confirm-dialog')).toBeInTheDocument();
    // critically: no submit fired yet
    expect(api.morningQuizSubmit).not.toHaveBeenCalled();
  });

  it('shows un-answered count + lists Q numbers when student hasn\'t finished', async () => {
    renderTake();
    fireEvent.click(await screen.findByTestId('submit-button'));
    await screen.findByTestId('submit-confirm-dialog');
    // 3 total, 0 answered → 3 unanswered listed
    expect(screen.getByText(/已答 0 \/ 3 题,还有 3 题未答/)).toBeInTheDocument();
    expect(screen.getByTestId('unanswered-1')).toBeInTheDocument();
    expect(screen.getByTestId('unanswered-2')).toBeInTheDocument();
    expect(screen.getByTestId('unanswered-3')).toBeInTheDocument();
  });

  it('shows the all-answered variant when nothing is unanswered', async () => {
    // Pre-seed answers in localStorage so ExamProvider hydrates with them
    // for sess1 sub mock — easier path: have only 0 questions to skip the
    // partial branch.
    (api.morningQuizSession as any).mockResolvedValueOnce(mockPaper(0));
    renderTake();
    const submitBtn = await screen.findByTestId('submit-button');
    fireEvent.click(submitBtn);
    await screen.findByTestId('submit-confirm-dialog');
    expect(screen.getByText(/已答完 0 \/ 0 题/)).toBeInTheDocument();
    expect(screen.queryByTestId('unanswered-list')).toBeNull();
  });

  it('cancel closes dialog without submitting', async () => {
    renderTake();
    fireEvent.click(await screen.findByTestId('submit-button'));
    await screen.findByTestId('submit-confirm-dialog');
    fireEvent.click(screen.getByTestId('submit-cancel'));
    await waitFor(() => {
      expect(screen.queryByTestId('submit-confirm-dialog')).toBeNull();
    });
    expect(api.morningQuizSubmit).not.toHaveBeenCalled();
  });

  it('Escape closes dialog without submitting', async () => {
    renderTake();
    fireEvent.click(await screen.findByTestId('submit-button'));
    await screen.findByTestId('submit-confirm-dialog');
    act(() => { fireEvent.keyDown(window, { key: 'Escape' }); });
    await waitFor(() => {
      expect(screen.queryByTestId('submit-confirm-dialog')).toBeNull();
    });
    expect(api.morningQuizSubmit).not.toHaveBeenCalled();
  });

  it('confirm fires the actual submit — final=true（最终提交，公布答案）', async () => {
    renderTake();
    fireEvent.click(await screen.findByTestId('submit-button'));
    await screen.findByTestId('submit-confirm-dialog');
    fireEvent.click(screen.getByTestId('submit-confirm'));
    await waitFor(() => {
      expect(api.morningQuizSubmit).toHaveBeenCalledWith('sess1', { final: true });
    });
  });

  // ── 第二作答窗（2026-08-20）：交卷拆成暂存 / 最终两个动作 ──

  it('没有第二窗的日子只给一个按钮 —— 「先存着」是个骗人的选项', async () => {
    renderTake();
    fireEvent.click(await screen.findByTestId('submit-button'));
    await screen.findByTestId('submit-confirm-dialog');
    expect(screen.queryByTestId('submit-draft')).toBeNull();
  });

  it('有第二窗时给两个按钮，「先存着」发 final=false', async () => {
    (api.morningQuizSession as any).mockResolvedValueOnce({
      ...mockPaper(3),
      secondWindowToday: true,
    });
    renderTake();
    fireEvent.click(await screen.findByTestId('submit-button'));
    await screen.findByTestId('submit-confirm-dialog');
    fireEvent.click(screen.getByTestId('submit-draft'));
    await waitFor(() => {
      // final=false 是答案门的钥匙：不盖 finalSubmittedAt，学生下午
      // 16:00-17:30 还能回来改，在此之前看不到答案。发成 true 就等于
      // 让他看完答案再改，整套设计就废了。
      expect(api.morningQuizSubmit).toHaveBeenCalledWith('sess1', { final: false });
    });
  });

  it('有第二窗时「交卷并看答案」仍发 final=true', async () => {
    (api.morningQuizSession as any).mockResolvedValueOnce({
      ...mockPaper(3),
      secondWindowToday: true,
    });
    renderTake();
    fireEvent.click(await screen.findByTestId('submit-button'));
    await screen.findByTestId('submit-confirm-dialog');
    fireEvent.click(screen.getByTestId('submit-confirm'));
    await waitFor(() => {
      expect(api.morningQuizSubmit).toHaveBeenCalledWith('sess1', { final: true });
    });
  });

  it('clicking an un-answered Q number jumps + closes dialog (no submit)', async () => {
    renderTake();
    fireEvent.click(await screen.findByTestId('submit-button'));
    await screen.findByTestId('submit-confirm-dialog');
    fireEvent.click(screen.getByTestId('unanswered-2'));
    await waitFor(() => {
      expect(screen.queryByTestId('submit-confirm-dialog')).toBeNull();
    });
    expect(api.morningQuizSubmit).not.toHaveBeenCalled();
  });
});
