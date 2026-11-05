import { describe, expect, it, vi, beforeEach } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import ClassToday from '../ClassToday';
import { api } from '../../lib/api';
vi.mock('../../lib/api', () => ({ api: { classToday: vi.fn() } }));
const report = { classId: 'c', className: '演示班', date: '2026-11-05', noSchoolDay: false, totals: { unfinished: 1, pending: 1, attention: 1 }, students: [{ id: 's', name: '演示学生', noSchoolDay: false, teachingDay: true, reading: 'not_started', words: 'submitted', test: 'marked', reasons: ['阅读没交', '本周被提醒过'], pendingSubmissions: ['sub'] }] };
function open() { return render(<MemoryRouter initialEntries={['/classes/c/today']}><Routes><Route path="/classes/:classId/today" element={<ClassToday />} /></Routes></MemoryRouter>); }
beforeEach(() => { vi.clearAllMocks(); vi.mocked(api.classToday).mockResolvedValue(report); });
describe('今天该找谁', () => {
  it('提醒可展开原文，低分标签链接到原日期所在周', async () => {
    vi.mocked(api.classToday).mockResolvedValue({ ...report, students: [{ ...report.students[0], lowReadingDates: ['2026-10-30'], reasons: ['近三个上课日有 1 天阅读不到一半', '本周被提醒过'], warnings: [{ id: 'w', title: '认真做', body: '请认真读完再交。', createdAt: '2026-11-04T08:00:00Z' }] }] });
    open();
    fireEvent.click(await screen.findByRole('link', { name: '本周被提醒过' }));
    expect(screen.getByText('请认真读完再交。').closest('details')).toHaveAttribute('open');
    expect(screen.getByRole('link', { name: '近三个上课日有 1 天阅读不到一半' })).toHaveAttribute('href', '/learning-report?classId=c&week=2026-10-30&studentId=s#stu-s');
  });
  it('显示汇总、原因和已有成绩 / 批改入口', async () => {
    open(); expect(await screen.findByText('阅读没交')).toBeInTheDocument();
    expect(screen.getByText(/今天还没做完/)).toHaveTextContent('今天还没做完 1 人 · 待批 1 份 · 需要关注 1 人');
    expect(screen.getByRole('link', { name: '演示学生' })).toHaveAttribute('href', '/learning-report?classId=c&week=2026-11-05&studentId=s#stu-s');
    expect(screen.getByRole('link', { name: '批改第 1 份答卷' })).toHaveAttribute('href', '/marker/submission/sub');
  });
  it('停课显示不用做，保留已交状态', async () => {
    vi.mocked(api.classToday).mockResolvedValue({ ...report, noSchoolDay: true, students: [{ ...report.students[0], noSchoolDay: true, teachingDay: false, reasons: [] }] });
    open(); expect(await screen.findByText('今天停课')).toBeInTheDocument();
    expect(screen.getByText('今天不用做')).toBeInTheDocument(); expect(screen.getByText('已交')).toBeInTheDocument();
    expect(screen.queryByText('阅读没交')).toBeNull();
  });
  it('空班和加载失败都能处理；日期选择发给API', async () => {
    vi.mocked(api.classToday).mockResolvedValue({ ...report, students: [] });
    open(); expect(await screen.findByText('这个班还没有学生。')).toBeInTheDocument();
    vi.mocked(api.classToday).mockRejectedValueOnce(new Error('network'));
    fireEvent.change(screen.getByLabelText('查看日期'), { target: { value: '2026-11-04' } });
    expect(await screen.findByRole('alert')).toHaveTextContent('暂时没能加载');
    fireEvent.click(screen.getByRole('button', { name: '重新加载' }));
    await waitFor(() => expect(api.classToday).toHaveBeenLastCalledWith('c', '2026-11-04'));
    expect(await screen.findByText('这个班还没有学生。')).toBeInTheDocument();
  });
});
