import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import Dictation, { type DictationData } from '../Dictation';
import { api } from '../../lib/api';
vi.mock('../../lib/api', () => ({ api: { dictation: vi.fn(), generateDictation: vi.fn(), saveDictation: vi.fn(), remainingDictationCorrect: vi.fn() } }));
const word = (senseId: string, headword: string) => ({ senseId, headword, translation: '中文意思' });
function data(): DictationData { return { className: '演示班', learnedDate: '2026-11-04', heldOn: '2026-11-05', sheet: { id: 'sheet', rows: ['one', 'two'].map((id) => ({ id, studentId: id, name: `学生${id}`, status: 'pending', wrongSenseIds: [], enteredAt: null, words: [word('sense1', 'receive'), word('sense2', 'achieve')] })) } }; }
function open() { return render(<MemoryRouter initialEntries={['/classes/class/dictation']}><Routes><Route path="/classes/:classId/dictation" element={<Dictation />} /></Routes></MemoryRouter>); }
beforeEach(() => { vi.clearAllMocks(); vi.mocked(api.dictation).mockResolvedValue(data()); });
afterEach(cleanup);
describe('早读默写回填', () => {
  it('默认未录入且不自动保存，默认日期交给后端教学日规则', async () => {
    open(); expect(await screen.findByText('学生one', { selector: 'h2' })).toBeInTheDocument();
    expect(screen.getByLabelText('receive')).not.toBeChecked();
    expect(api.dictation).toHaveBeenCalledWith('class', undefined, expect.stringMatching(/^\d{4}-\d{2}-\d{2}$/));
    expect(api.saveDictation).not.toHaveBeenCalled();
    expect(screen.getByText(/2 人未录入/)).toBeInTheDocument();
    expect(screen.getByLabelText('默写日期')).toHaveValue('2026-11-05');
    expect(screen.getByLabelText('默写日期')).toBeDisabled();
  });
  it('勾错保存并自动跳到下一位；默认全对使用空错词数组', async () => {
    const next = data(); next.sheet!.rows[0].status = 'entered'; next.sheet!.rows[0].wrongSenseIds = ['sense1'];
    vi.mocked(api.saveDictation).mockResolvedValue(next);
    open(); fireEvent.click(await screen.findByLabelText('receive')); fireEvent.click(screen.getByRole('button', { name: '保存（错 1 词）' }));
    await waitFor(() => expect(api.saveDictation).toHaveBeenCalledWith('class', 'sheet', 'one', expect.objectContaining({ status: 'entered', wrongSenseIds: ['sense1'], requestId: expect.any(String) })));
    expect(await screen.findByText('学生two', { selector: 'h2' })).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: '保存（全对）' }));
    await waitFor(() => expect(api.saveDictation).toHaveBeenLastCalledWith('class', 'sheet', 'two', expect.objectContaining({ status: 'entered', wrongSenseIds: [] })));
  });
  it('缺考不带错词；重选已录入的学生可以改录', async () => {
    const next = data(); next.sheet!.rows[0].status = 'absent';
    vi.mocked(api.saveDictation).mockResolvedValue(next);
    open(); fireEvent.click(await screen.findByLabelText('receive')); fireEvent.click(screen.getByRole('button', { name: '缺考' }));
    await waitFor(() => expect(api.saveDictation).toHaveBeenCalledWith('class', 'sheet', 'one', expect.objectContaining({ status: 'absent', wrongSenseIds: [] })));
    await screen.findByText('学生two', { selector: 'h2' });
    fireEvent.click(screen.getByRole('button', { name: '学生one 缺考' }));
    expect(screen.getByLabelText('receive')).not.toBeChecked();
    fireEvent.click(screen.getByRole('button', { name: '保存（全对）' }));
    await waitFor(() => expect(api.saveDictation).toHaveBeenLastCalledWith('class', 'sheet', 'one', expect.objectContaining({ status: 'entered' })));
  });
  it('弱网重试保留勾选并复用同一编号；成功后的新改录使用新编号', async () => {
    vi.mocked(api.saveDictation).mockRejectedValueOnce(new Error('network')).mockResolvedValue(data());
    open(); fireEvent.click(await screen.findByLabelText('receive')); fireEvent.click(screen.getByRole('button', { name: '保存（错 1 词）' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('没能确认保存结果');
    expect(screen.getByLabelText('receive')).toBeChecked();
    const first = vi.mocked(api.saveDictation).mock.calls[0][3].requestId;
    fireEvent.click(screen.getByRole('button', { name: '保存（错 1 词）' }));
    await waitFor(() => expect(api.saveDictation).toHaveBeenCalledTimes(2));
    expect(vi.mocked(api.saveDictation).mock.calls[1][3].requestId).toBe(first);
    await screen.findByText('已保存。');
    fireEvent.click(screen.getByRole('button', { name: '保存（全对）' }));
    await waitFor(() => expect(api.saveDictation).toHaveBeenCalledTimes(3));
    expect(vi.mocked(api.saveDictation).mock.calls[2][3].requestId).not.toBe(first);
  });
  it('保存中禁用按钮，双击不会发送第二次', async () => {
    vi.mocked(api.saveDictation).mockReturnValue(new Promise(() => {}));
    open(); const save = await screen.findByRole('button', { name: '保存（全对）' });
    fireEvent.click(save); fireEvent.click(save);
    expect(api.saveDictation).toHaveBeenCalledTimes(1);
    expect(screen.getByRole('button', { name: '正在保存…' })).toBeDisabled();
    expect(screen.getByRole('button', { name: '全班其余都全对' })).toBeDisabled();
  });
  it('全班其余都全对走批量接口，失败重试编号不变', async () => {
    vi.mocked(api.remainingDictationCorrect).mockRejectedValueOnce(new Error('network')).mockResolvedValue(data());
    open(); fireEvent.click(await screen.findByRole('button', { name: '全班其余都全对' }));
    await screen.findByRole('alert');
    fireEvent.click(screen.getByRole('button', { name: '全班其余都全对' }));
    await waitFor(() => expect(api.remainingDictationCorrect).toHaveBeenCalledTimes(2));
    expect(vi.mocked(api.remainingDictationCorrect).mock.calls[0]).toEqual(vi.mocked(api.remainingDictationCorrect).mock.calls[1]);
  });
  it('先生成再录入，不自动创建；日期和默写日期都发给后端', async () => {
    vi.mocked(api.dictation).mockResolvedValue({ ...data(), sheet: null }); vi.mocked(api.generateDictation).mockResolvedValue(data());
    open(); const generate = await screen.findByRole('button', { name: '生成默写单' });
    expect(api.generateDictation).not.toHaveBeenCalled(); fireEvent.click(generate);
    await screen.findByText('学生one', { selector: 'h2' });
    expect(api.generateDictation).toHaveBeenCalledWith('class', { learnedDate: '2026-11-04', heldOn: '2026-11-05' });
    fireEvent.change(screen.getByLabelText('默写哪天学的词'), { target: { value: '2026-11-03' } });
    await waitFor(() => expect(api.dictation).toHaveBeenLastCalledWith('class', '2026-11-03', expect.any(String)));
  });
  it('权限错误、重试、空班、无词和长名字都有可读状态', async () => {
    vi.mocked(api.dictation).mockRejectedValueOnce({ status: 403 }); open();
    expect(await screen.findByRole('alert')).toHaveTextContent('你不能查看这个班的默写。');
    const next = data(); next.sheet!.rows = []; vi.mocked(api.dictation).mockResolvedValue(next);
    fireEvent.click(screen.getByRole('button', { name: '重新加载' })); expect(await screen.findByText('这张默写单没有学生。')).toBeInTheDocument();
    next.sheet!.rows = [{ ...data().sheet!.rows[0], words: [], name: '很长的名字'.repeat(12) }];
    fireEvent.change(screen.getByLabelText('默写哪天学的词'), { target: { value: '2026-11-02' } });
    expect(await screen.findByText('这位学生当天没有学完的词，无需录入。')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '全班其余都全对' })).toBeDisabled();
  });
});
