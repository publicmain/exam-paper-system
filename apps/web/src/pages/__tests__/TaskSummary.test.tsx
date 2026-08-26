import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import TaskSummaryPage from '../TaskSummary';
import { api } from '../../lib/api';

/**
 * P8 —— 任务总结页。
 *
 * 两条硬边界：**纯读取**（绝不调 /lesson/start）、**不在前端算分**。
 * 还要把「0 分」和「没成绩」显示成两样东西 —— 混起来就是在骗学生。
 */

vi.mock('../../lib/api', () => ({
  api: { lessonToday: vi.fn(), lessonStart: vi.fn() },
}));

const dto = (over: Record<string, unknown> = {}) => ({
  student: { id: 'stu1', name: '小明' },
  date: '2026-08-28',
  stage: 'done',
  allDone: true,
  completed: 3,
  total: 3,
  streakDays: 2,
  segments: [
    {
      key: 'read',
      status: 'done',
      label: 'Harbour Town',
      score: 16,
      maxScore: 20,
      scoresPending: false,
      submissionId: 'sub1',
    },
    {
      key: 'vocab',
      status: 'done',
      progress: 4,
      target: 4,
      quizScore: {
        status: 'submitted',
        correct: 3,
        total: 4,
        percentage: 75,
        submittedAt: '2026-08-28T06:00:00.000Z',
      },
    },
    { key: 'drill', status: 'none' },
  ],
  ...over,
});

function setup() {
  return render(
    <MemoryRouter initialEntries={['/my-lesson/summary?name=%E5%B0%8F%E6%98%8E&studentId=stu1']}>
      <Routes>
        <Route path="/my-lesson/summary" element={<TaskSummaryPage />} />
        <Route path="*" element={<div>elsewhere</div>} />
      </Routes>
    </MemoryRouter>,
  );
}

describe('任务总结页', () => {
  beforeEach(() => {
    vi.mocked(api.lessonToday).mockReset();
    vi.mocked(api.lessonStart).mockReset();
  });

  it('**只读**：调 lessonToday，绝不调 lessonStart', async () => {
    vi.mocked(api.lessonToday).mockResolvedValue(dto() as any);
    setup();
    await waitFor(() => expect(screen.getByTestId('task-summary')).toBeTruthy());
    expect(api.lessonToday).toHaveBeenCalledTimes(1);
    expect(api.lessonStart).not.toHaveBeenCalled();
  });

  it('两项成绩分开展示，数字来自服务端', async () => {
    vi.mocked(api.lessonToday).mockResolvedValue(dto() as any);
    setup();
    await waitFor(() => expect(screen.getByTestId('summary-reading')).toBeTruthy());
    expect(screen.getByTestId('summary-reading').textContent).toContain('16/20 分');
    expect(screen.getByTestId('summary-vocab').textContent).toContain('3/4 · 75 分');
  });

  it('**词汇 0 分显示 0/4，不是「没成绩」**', async () => {
    vi.mocked(api.lessonToday).mockResolvedValue(
      dto({
        segments: [
          ...dto().segments.slice(0, 1),
          {
            key: 'vocab',
            status: 'done',
            progress: 4,
            target: 4,
            quizScore: {
              status: 'submitted', correct: 0, total: 4, percentage: 0,
              submittedAt: '2026-08-28T06:00:00.000Z',
            },
          },
          { key: 'drill', status: 'none' },
        ],
      }) as any,
    );
    setup();
    await waitFor(() => expect(screen.getByTestId('summary-vocab')).toBeTruthy());
    const t = screen.getByTestId('summary-vocab').textContent ?? '';
    expect(t).toContain('0/4 · 0 分');
    expect(t).not.toContain('还没考');
  });

  it('**没有正式成绩显示「还没考」，不是 0 分**', async () => {
    vi.mocked(api.lessonToday).mockResolvedValue(
      dto({
        segments: [
          ...dto().segments.slice(0, 1),
          { key: 'vocab', status: 'partial', progress: 2, target: 4, quizScore: { status: 'not_started' } },
          { key: 'drill', status: 'none' },
        ],
      }) as any,
    );
    setup();
    await waitFor(() => expect(screen.getByTestId('summary-vocab')).toBeTruthy());
    const t = screen.getByTestId('summary-vocab').textContent ?? '';
    expect(t).toContain('还没考');
    expect(t).not.toMatch(/0\s*\/\s*\d/);
  });

  it('旧任务有专门文案', async () => {
    vi.mocked(api.lessonToday).mockResolvedValue(
      dto({
        segments: [
          ...dto().segments.slice(0, 1),
          { key: 'vocab', status: 'partial', progress: 0, target: 4, quizScore: { status: 'legacy_no_queue' } },
          { key: 'drill', status: 'none' },
        ],
      }) as any,
    );
    setup();
    await waitFor(() => expect(screen.getByTestId('summary-vocab')).toBeTruthy());
    expect(screen.getByTestId('summary-vocab').textContent).toContain('这一天没有正式单词测试');
  });

  it('阅读待批不显示成分数', async () => {
    vi.mocked(api.lessonToday).mockResolvedValue(
      dto({
        segments: [
          { key: 'read', status: 'done', label: 'X', score: null, maxScore: 20, scoresPending: true, submissionId: 's1' },
          ...dto().segments.slice(1),
        ],
      }) as any,
    );
    setup();
    await waitFor(() => expect(screen.getByTestId('summary-reading')).toBeTruthy());
    expect(screen.getByTestId('summary-reading').textContent).toContain('等老师批改');
  });

  it('完成度与成绩分行写清楚 —— 不让学生把复习次数当分数', async () => {
    vi.mocked(api.lessonToday).mockResolvedValue(dto() as any);
    setup();
    await waitFor(() => expect(screen.getByTestId('summary-vocab')).toBeTruthy());
    expect(screen.getByTestId('summary-vocab').textContent).toContain('完成度，不是成绩');
  });
});
