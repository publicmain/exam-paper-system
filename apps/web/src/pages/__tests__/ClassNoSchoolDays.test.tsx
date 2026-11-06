import { describe, expect, it, vi, beforeEach } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import ClassNoSchoolDays from '../ClassNoSchoolDays';
import { api } from '../../lib/api';
vi.mock('../../lib/api', () => ({ api: { classNoSchoolDays: vi.fn(), addClassNoSchoolDays: vi.fn(), removeClassNoSchoolDay: vi.fn() } }));
function open() { return render(<MemoryRouter initialEntries={['/classes/c/no-school-days']}><Routes><Route path="/classes/:classId/no-school-days" element={<ClassNoSchoolDays />} /></Routes></MemoryRouter>); }
beforeEach(() => { vi.clearAllMocks(); vi.mocked(api.classNoSchoolDays).mockResolvedValue([]); vi.mocked(api.addClassNoSchoolDays).mockResolvedValue({ added: 5 }); vi.mocked(api.removeClassNoSchoolDay).mockResolvedValue({ removed: 1 }); });
describe('停课日页面', () => {
  it('日期段和原因可提交；连点保存只发一次', async () => {
    let finish!: (v: any) => void;
    vi.mocked(api.addClassNoSchoolDays).mockImplementation(() => new Promise((resolve) => { finish = resolve; }));
    open(); await screen.findByText('这段时间没有停课日。');
    expect(screen.getByText('本班停课日不排任务、不算欠账，已经做过的成绩保留。其他班仍有课的学生照常学习。')).toBeInTheDocument();
    fireEvent.change(screen.getByLabelText('开始日期'), { target: { value: '2026-11-02' } });
    fireEvent.change(screen.getByLabelText('结束日期'), { target: { value: '2026-11-06' } });
    fireEvent.change(screen.getByLabelText('原因（选填）'), { target: { value: '期中考试' } });
    fireEvent.click(screen.getByText('添加停课日')); fireEvent.submit(screen.getByText('正在保存…').closest('form')!);
    expect(api.addClassNoSchoolDays).toHaveBeenCalledTimes(1);
    expect(api.addClassNoSchoolDays).toHaveBeenCalledWith('c', { from: '2026-11-02', to: '2026-11-06', reason: '期中考试' });
    finish({ added: 5 }); expect(await screen.findByText('已添加 5 天，原有日期保留。')).toBeInTheDocument();
  });
  it('能查看过去并删除；取消确认不发请求', async () => {
    vi.mocked(api.classNoSchoolDays).mockResolvedValue([{ id: 'd', date: '2026-11-05T00:00:00.000Z', reason: '考试' }]);
    const confirm = vi.spyOn(window, 'confirm').mockReturnValue(false);
    open(); await screen.findByText('考试');
    fireEvent.click(screen.getByLabelText('删除 2026-11-05 的停课安排')); expect(api.removeClassNoSchoolDay).not.toHaveBeenCalled();
    confirm.mockReturnValue(true); fireEvent.click(screen.getByLabelText('删除 2026-11-05 的停课安排'));
    await waitFor(() => expect(api.removeClassNoSchoolDay).toHaveBeenCalledWith('c', '2026-11-05'));
    fireEvent.change(screen.getByLabelText('日期范围'), { target: { value: 'past' } });
    await waitFor(() => expect(api.classNoSchoolDays).toHaveBeenLastCalledWith('c', 'past')); confirm.mockRestore();
  });
  it('加载失败能重新加载', async () => {
    vi.mocked(api.classNoSchoolDays).mockRejectedValueOnce(new Error('network'));
    open(); expect(await screen.findByRole('alert')).toHaveTextContent('暂时没能加载');
    fireEvent.click(screen.getByText('重新加载')); expect(await screen.findByText('这段时间没有停课日。')).toBeInTheDocument();
  });
  it('保存失败不把服务端错误一概说成日期错误', async () => {
    vi.mocked(api.addClassNoSchoolDays).mockRejectedValueOnce(new Error('offline'));
    open(); await screen.findByText('这段时间没有停课日。');
    fireEvent.change(screen.getByLabelText('开始日期'), { target: { value: '2026-11-02' } });
    fireEvent.click(screen.getByText('添加停课日'));
    expect(await screen.findByRole('alert')).toHaveTextContent('没能保存，请再试一次。');
  });
});
