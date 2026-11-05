import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { api } from '../lib/api';
import { writeToken } from '../lib/identity';
import { __resetForTest } from '../lib/auth-store';
import MistakesPage from '../pages/Mistakes';
const row = (id: string, resolved = false) => ({ id, resolved, quizDay: '2026-11-05', stem: `Question ${id}`, passageTitle: 'Old story', studentAnswer: 'A', correctAnswer: 'B', answerPoints: [], answerModel: '', markerComment: 'Read carefully.', legacy: true, options: [], passage: '' });
beforeEach(() => { __resetForTest(); localStorage.clear(); writeToken('test'); });
afterEach(() => vi.restoreAllMocks());
const mount = () => render(<MemoryRouter><MistakesPage /></MemoryRouter>);
describe('错题本只读开放', () => {
  it('按日期展示原答、正答和评语，旧题有说明，已做对折叠，单词只读', async () => {
    vi.spyOn(api, 'mistakeList').mockResolvedValue({ entries: [row('1'), row('2', true)], vocabulary: [{ senseId: 'v', headword: 'rain', meaning: '雨', date: '2026-11-04' }], total: 1, byTaskType: [] } as any);
    mount(); await screen.findByText('阅读错题（1 道）');
    expect(screen.getAllByText('我当时的答案：A')).toHaveLength(2);
    expect(screen.getAllByText('B')).toHaveLength(2);
    expect(screen.getAllByText('老师评语：Read carefully.')).toHaveLength(2);
    const summary = screen.getByText('已经做对的阅读错题（1 道）');
    expect(summary.closest('details')).not.toHaveAttribute('open');
    expect(screen.getByText('rain')).toBeInTheDocument();
    expect(screen.queryByText('已弄懂')).toBeNull();
  });
  it('空列表有说明，失败可重试', async () => {
    const list = vi.spyOn(api, 'mistakeList').mockRejectedValueOnce(new Error('offline')).mockResolvedValue({ entries: [], vocabulary: [], total: 0, byTaskType: [] });
    mount(); await screen.findByText('错题本没打开');
    fireEvent.click(screen.getByRole('button', { name: /重试/ }));
    await screen.findByText('暂时没有未做对的阅读错题。');
    expect(list).toHaveBeenCalledTimes(2);
  });
  it('长列表分批显示，计数与完整列表保持一致', async () => {
    vi.spyOn(api, 'mistakeList').mockResolvedValue({ entries: Array.from({ length: 30 }, (_, i) => row(String(i))), vocabulary: [], total: 30, byTaskType: [] } as any);
    mount(); await screen.findByText('阅读错题（30 道）');
    expect(screen.queryByText('Question 29')).toBeNull();
    fireEvent.click(screen.getByText('再看一些'));
    await waitFor(() => expect(screen.getByText('Question 29')).toBeInTheDocument());
  });
});
