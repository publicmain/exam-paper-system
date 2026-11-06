import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import ClassToday, { reportDateContext } from '../ClassToday';
import { api } from '../../lib/api';
vi.mock('../../lib/api', () => ({ api: { classToday: vi.fn() } }));
const report = { classId: 'c', className: '演示班', date: '2026-11-05', noSchoolDay: false, totals: { unfinished: 1, pending: 1, attention: 1 }, students: [{ id: 's', name: '演示学生', noSchoolDay: false, teachingDay: true, reading: 'not_started', words: 'submitted', test: 'marked', reasons: ['阅读没交', '这周收到过提醒'], pendingSubmissions: ['sub'] }] };
function open() { return render(<MemoryRouter initialEntries={['/classes/c/today']}><Routes><Route path="/classes/:classId/today" element={<ClassToday />} /></Routes></MemoryRouter>); }
beforeEach(() => { vi.useFakeTimers({ toFake: ['Date'] }); vi.setSystemTime(new Date('2026-11-05T08:00:00Z')); vi.clearAllMocks(); vi.mocked(api.classToday).mockResolvedValue(report); });
afterEach(() => vi.useRealTimers());
describe('今天该找谁', () => {
  it.each([
    ['2026-11-05', '2026-11-04T15:59:59Z', '11月5日', true],
    ['2026-11-05', '2026-11-04T16:00:00Z', '今天', true],
    ['2026-11-01', '2026-11-01T15:59:59Z', '今天', true],
    ['2026-11-01', '2026-11-01T16:00:00Z', '11月1日', false],
    ['2026-12-31', '2027-01-03T16:00:00Z', '12月31日', false],
  ])('日期 %s 在 %s 按新加坡午夜与周一边界显示', (selected, now, label, currentWeek) => {
    expect(reportDateContext(selected, new Date(now))).toEqual({ label, currentWeek });
  });
  it('历史日期的汇总、停课和免做说明使用所选日期，提醒使用那一周', async () => {
    const student = { ...report.students[0], noSchoolDay: true, teachingDay: false, reasons: [],
      warnings: [{ id: 'w', title: '认真做', body: '请认真读完再交。', createdAt: '2026-10-30T08:00:00Z' }] };
    vi.mocked(api.classToday).mockResolvedValue({ ...report, date: '2026-10-30', noSchoolDay: true, students: [student] });
    open(); await screen.findByText('10月30日停课');
    expect(screen.getByText(/10月30日还没做完/)).toBeInTheDocument();
    expect(screen.getByText('10月30日不用做')).toBeInTheDocument();
    expect(screen.getByText(/10月30日停课。其他班/)).toBeInTheDocument();
    expect(screen.getByText('查看那一周的提醒')).toBeInTheDocument();
    expect(screen.queryByText(/今天/)).toBeNull();
  });
  it('历史休息日与无待办说明不说今天；进行中与两项列名一致', async () => {
    vi.mocked(api.classToday).mockResolvedValue({ ...report, date: '2026-11-01', students: [
      { ...report.students[0], teachingDay: false, reasons: [], reading: 'in_progress' },
      { ...report.students[0], id: 's2', name: '另一位同学', reasons: [] },
    ] });
    open(); await screen.findByText('11月1日不用上课');
    expect(screen.getByText('11月1日没有待办')).toBeInTheDocument();
    expect(screen.getByText('进行中')).toBeInTheDocument();
    expect(screen.getAllByText(/学新词/)).toHaveLength(2); expect(screen.getAllByText(/单词测试/)).toHaveLength(2);
  });
  it('提醒可展开原文，低分标签链接到原日期所在周', async () => {
    vi.mocked(api.classToday).mockResolvedValue({ ...report, students: [{ ...report.students[0], lowReadingDates: ['2026-10-30'], lowTestDates: ['2026-10-29'], reasons: ['近三个上课日有 1 天阅读得分低于 50%', '近三个上课日有 1 天单词测试正确率低于 50%', '这周收到过提醒'], warnings: [{ id: 'w', title: '认真做', body: '请认真读完再交。', createdAt: '2026-11-04T08:00:00Z' }] }] });
    open();
    fireEvent.click(await screen.findByRole('link', { name: '这周收到过提醒' }));
    expect(screen.getByText('请认真读完再交。').closest('details')).toHaveAttribute('open');
    expect(screen.getByRole('link', { name: '近三个上课日有 1 天阅读得分低于 50%' })).toHaveAttribute('href', '/learning-report?classId=c&week=2026-10-30&studentId=s#stu-s');
    expect(screen.getByRole('link', { name: '近三个上课日有 1 天单词测试正确率低于 50%' })).toHaveAttribute('href', '/learning-report?classId=c&week=2026-10-29&studentId=s#stu-s');
    expect(screen.getByText('查看本周提醒')).toBeInTheDocument();
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
