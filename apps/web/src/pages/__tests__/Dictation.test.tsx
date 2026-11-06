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
  it('未保存时禁用批量并提示；切换学生还原草稿且批量排除其他草稿', async () => {
    vi.mocked(api.remainingDictationCorrect).mockResolvedValue({ ...data(), bulk: { succeededCount: 1, failedCount: 0, skippedCount: 0 } });
    open(); fireEvent.click(await screen.findByLabelText('receive'));
    expect(screen.getByRole('button', { name: '其余未录入的学生记为全对' })).toBeDisabled();
    expect(screen.getByText('先保存这位学生')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: '学生two 未录入' }));
    expect(screen.getByLabelText('receive')).not.toBeChecked();
    fireEvent.click(screen.getByRole('button', { name: '其余未录入的学生记为全对' }));
    await waitFor(() => expect(api.remainingDictationCorrect).toHaveBeenCalledWith('class', 'sheet', expect.any(String), ['one']));
    await screen.findByText(/已保存/);
    fireEvent.click(screen.getByRole('button', { name: '学生one 未录入' }));
    expect(screen.getByLabelText('receive')).toBeChecked();
  });
  it('失败后跨学生保存再切回，草稿与重试编号都保留', async () => {
    const next = data(); next.sheet!.rows[1].status = 'entered';
    vi.mocked(api.saveDictation).mockRejectedValueOnce(new Error('network')).mockResolvedValue(next);
    open(); fireEvent.click(await screen.findByLabelText('receive'));
    fireEvent.click(screen.getByRole('button', { name: '保存（错 1 个词）' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('没保存成功，勾选还留着，请再点一次保存。');
    const first = vi.mocked(api.saveDictation).mock.calls[0][3].requestId;
    expect(screen.getByRole('button', { name: '其余未录入的学生记为全对' })).toBeDisabled();
    fireEvent.click(screen.getByRole('button', { name: '学生two 未录入' }));
    fireEvent.click(screen.getByRole('button', { name: '保存（全对）' }));
    await screen.findByText('学生one', { selector: 'h2' });
    expect(screen.getByLabelText('receive')).toBeChecked();
    fireEvent.click(screen.getByRole('button', { name: '保存（错 1 个词）' }));
    await waitFor(() => expect(api.saveDictation).toHaveBeenCalledTimes(3));
    expect(vi.mocked(api.saveDictation).mock.calls[2][3].requestId).toBe(first);
  });
  it('全对保存失败也阻止批量，取消未保存的勾选可恢复批量', async () => {
    vi.mocked(api.saveDictation).mockRejectedValue(new Error('network'));
    open(); fireEvent.click(await screen.findByLabelText('receive')); fireEvent.click(screen.getByLabelText('receive'));
    expect(screen.getByRole('button', { name: '其余未录入的学生记为全对' })).toBeEnabled();
    fireEvent.click(screen.getByRole('button', { name: '保存（全对）' }));
    await screen.findByRole('alert');
    expect(screen.getByRole('button', { name: '其余未录入的学生记为全对' })).toBeDisabled();
    fireEvent.click(screen.getByRole('button', { name: '学生two 未录入' }));
    fireEvent.click(screen.getByRole('button', { name: '学生one 未录入' }));
    expect(screen.getByRole('button', { name: '其余未录入的学生记为全对' })).toBeDisabled();
  });
  it('批量部分成功显示人数并保留编号用于补录，不谎报全部成功', async () => {
    vi.mocked(api.remainingDictationCorrect)
      .mockResolvedValueOnce({ ...data(), bulk: { succeededCount: 1, failedCount: 1, skippedCount: 0 } })
      .mockResolvedValue({ ...data(), bulk: { succeededCount: 2, failedCount: 0, skippedCount: 0 } });
    open(); fireEvent.click(await screen.findByRole('button', { name: '其余未录入的学生记为全对' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('已保存 1 人，1 人没保存成功，请再点一次批量保存。');
    fireEvent.click(screen.getByRole('button', { name: '其余未录入的学生记为全对' }));
    await waitFor(() => expect(api.remainingDictationCorrect).toHaveBeenCalledTimes(2));
    expect(vi.mocked(api.remainingDictationCorrect).mock.calls[0]).toEqual(vi.mocked(api.remainingDictationCorrect).mock.calls[1]);
    expect(await screen.findByText('已保存 2 人。')).toBeInTheDocument();
  });
  it('默认未录入且不自动保存，默认日期交给后端教学日规则', async () => {
    open(); expect(await screen.findByText('学生one', { selector: 'h2' })).toBeInTheDocument();
    expect(screen.getByLabelText('receive')).not.toBeChecked();
    expect(api.dictation).toHaveBeenCalledWith('class', undefined, expect.stringMatching(/^\d{4}-\d{2}-\d{2}$/));
    expect(api.saveDictation).not.toHaveBeenCalled();
    expect(screen.getByText('2026-11-05 默写 · 2 人未录入 · 共 2 人')).toBeInTheDocument();
    expect(screen.getByText('保存时，没勾的词记为正确；缺考请点「缺考」。保存后可以再改，没保存的学生仍是未录入。')).toBeInTheDocument();
    expect(screen.getByLabelText('默写日期')).toHaveValue('2026-11-05');
    expect(screen.getByLabelText('默写日期')).toBeDisabled();
  });
  it('勾错保存并自动跳到下一位；默认全对使用空错词数组', async () => {
    const next = data(); next.sheet!.rows[0].status = 'entered'; next.sheet!.rows[0].wrongSenseIds = ['sense1'];
    vi.mocked(api.saveDictation).mockResolvedValue(next);
    open(); fireEvent.click(await screen.findByLabelText('receive')); fireEvent.click(screen.getByRole('button', { name: '保存（错 1 个词）' }));
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
    open(); fireEvent.click(await screen.findByLabelText('receive')); fireEvent.click(screen.getByRole('button', { name: '保存（错 1 个词）' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('没保存成功，勾选还留着，请再点一次保存。');
    expect(screen.getByLabelText('receive')).toBeChecked();
    const first = vi.mocked(api.saveDictation).mock.calls[0][3].requestId;
    fireEvent.click(screen.getByRole('button', { name: '保存（错 1 个词）' }));
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
    expect(screen.getByRole('button', { name: '其余未录入的学生记为全对' })).toBeDisabled();
  });
  it('其余未录入的学生记为全对走批量接口，失败重试编号不变', async () => {
    vi.mocked(api.remainingDictationCorrect).mockRejectedValueOnce(new Error('network')).mockResolvedValue(data());
    open(); fireEvent.click(await screen.findByRole('button', { name: '其余未录入的学生记为全对' }));
    await screen.findByRole('alert');
    fireEvent.click(screen.getByRole('button', { name: '其余未录入的学生记为全对' }));
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
    expect(await screen.findByRole('alert')).toHaveTextContent('你没有这个班的查看权限。');
    const next = data(); next.sheet!.rows = []; vi.mocked(api.dictation).mockResolvedValue(next);
    fireEvent.click(screen.getByRole('button', { name: '重新加载' })); expect(await screen.findByText('这张默写单没有学生。')).toBeInTheDocument();
    next.sheet!.rows = [{ ...data().sheet!.rows[0], words: [], name: '很长的名字'.repeat(12) }];
    fireEvent.change(screen.getByLabelText('默写哪天学的词'), { target: { value: '2026-11-02' } });
    expect(await screen.findByText('这位学生当天未学完任何词，无需录入。')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '其余未录入的学生记为全对' })).toBeDisabled();
  });
  it('草稿按默写单隔离，切换日期再返回还原原来的勾选', async () => {
    const other = data(); other.sheet!.id = 'other-sheet'; other.learnedDate = '2026-11-03';
    open(); fireEvent.click(await screen.findByLabelText('receive'));
    vi.mocked(api.dictation).mockResolvedValue(other);
    fireEvent.change(screen.getByLabelText('默写哪天学的词'), { target: { value: '2026-11-03' } });
    expect(await screen.findByLabelText('receive')).not.toBeChecked();
    fireEvent.click(screen.getByLabelText('achieve'));
    vi.mocked(api.dictation).mockResolvedValue(data());
    fireEvent.change(screen.getByLabelText('默写哪天学的词'), { target: { value: '2026-11-04' } });
    expect(await screen.findByLabelText('receive')).toBeChecked();
    expect(screen.getByLabelText('achieve')).not.toBeChecked();
    expect(api.saveDictation).not.toHaveBeenCalled();
  });
});
