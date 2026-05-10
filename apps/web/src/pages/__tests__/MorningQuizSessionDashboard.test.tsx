import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import MorningQuizSessionDashboard from '../MorningQuizSessionDashboard';
import { api } from '../../lib/api';

vi.mock('../../lib/api', () => ({
  api: {
    morningQuizDashboard: vi.fn(),
  },
}));

beforeEach(() => {
  // No fake timers — the page schedules a 30s interval, but vitest fake
  // timers stall the promise that resolves the initial fetch. The test
  // tears down well before the next interval tick so real timers are fine.
  (api.morningQuizDashboard as any).mockResolvedValue({
    session: {
      id: 'sess1',
      date: '2026-05-11T00:00:00Z',
      status: 'live',
      class: { id: 'c1', name: 'G11 IELTS' },
      paper: { id: 'p1', name: 'Week 19 Quiz', totalMarksActual: 10 },
    },
    counts: { on_time: 30, late: 4, absent: 2 },
    attendances: [
      {
        id: 'a1', studentId: 'u1', status: 'on_time',
        student: { id: 'u1', name: 'Alice' },
        submission: { id: 'sub1', autoScore: 8, totalScore: 8, submittedAt: '2026-05-11T00:50:00Z' },
      },
      {
        id: 'a2', studentId: 'u2', status: 'late',
        student: { id: 'u2', name: 'Bob' },
        submission: null,
      },
      {
        id: 'a3', studentId: 'u3', status: 'absent',
        student: { id: 'u3', name: 'Carol' },
        submission: null,
      },
    ],
  });
});

function renderAt(path: string) {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <Routes>
        <Route path="/morning-quiz/sessions/:sessionId/dashboard" element={<MorningQuizSessionDashboard />} />
      </Routes>
    </MemoryRouter>,
  );
}

describe('MorningQuizSessionDashboard (R10-Bug2)', () => {
  it('renders session header, counts and per-student rows', async () => {
    renderAt('/morning-quiz/sessions/sess1/dashboard');
    await waitFor(() => screen.getByText(/G11 IELTS/));
    expect(screen.getByText('Week 19 Quiz', { exact: false })).toBeInTheDocument();
    // Counts cards
    expect(screen.getByText('30')).toBeInTheDocument();
    expect(screen.getByText('4')).toBeInTheDocument();
    expect(screen.getByText('2')).toBeInTheDocument();
    // Per-student
    expect(screen.getByText('Alice')).toBeInTheDocument();
    expect(screen.getByText('Bob')).toBeInTheDocument();
    expect(screen.getByText('Carol')).toBeInTheDocument();
    expect(api.morningQuizDashboard).toHaveBeenCalledWith('sess1');
  });

  it('shows error card on failure', async () => {
    (api.morningQuizDashboard as any).mockRejectedValueOnce(new Error('not_your_class'));
    renderAt('/morning-quiz/sessions/sess1/dashboard');
    await waitFor(() => screen.getByText('not_your_class'));
  });

  it('renders empty-state row when no students scanned', async () => {
    (api.morningQuizDashboard as any).mockResolvedValueOnce({
      session: {
        id: 'sess1', date: '2026-05-11T00:00:00Z', status: 'scheduled',
        class: { id: 'c1', name: 'G11' },
        paper: { id: 'p1', name: 'p', totalMarksActual: 10 },
      },
      counts: { on_time: 0, late: 0, absent: 0 },
      attendances: [],
    });
    renderAt('/morning-quiz/sessions/sess1/dashboard');
    await waitFor(() => screen.getByText('还没有学生扫码'));
  });
});
