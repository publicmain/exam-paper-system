import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { ReadingRedo } from '../components/ReadingRedo';
import { api, type MistakePracticeQueue } from '../lib/api';
import { __resetForTest } from '../lib/auth-store';
import { writeToken } from '../lib/identity';
import { readingTaskView } from '../pages/Today';
import { readingResultRef } from '../pages/ReadingResult';

const feedback = { correctAnswer: 'B', answerPoints: [], answerModel: '', markerComment: '', explanation: '', evidence: '' };
const queue = (kind: 'objective' | 'self_check' = 'objective'): MistakePracticeQueue => ({ date: '2026-11-09', target: 1, progress: 0, remaining: 1, unlocked: true,
  items: [{ id: 'm1', taskType: 'mcq', passageTitle: 'Original title', quizDay: '2026-11-06', stem: 'Choose an answer.', passage: 'Original passage.',
    options: kind === 'objective' ? [{ key: 'A', text: 'First' }, { key: 'B', text: 'Second' }] : [], practiceKind: kind }] });
beforeEach(() => { __resetForTest(); localStorage.clear(); writeToken('test'); });
afterEach(() => vi.restoreAllMocks());
const mount = () => render(<ReadingRedo><p>继续今天的课</p></ReadingRedo>);

describe('阅读结果后接今天的错题', () => {
  it('客观题按选择交答案，保存前没有反馈；做完才显示继续课程', async () => {
    const q = vi.spyOn(api, 'mistakePracticeQueue').mockResolvedValueOnce(queue()).mockResolvedValue({ date: '2026-11-09', target: 1, progress: 1, remaining: 0, unlocked: true, items: [] });
    const submit = vi.spyOn(api, 'mistakePracticeResult').mockResolvedValue({ ok: true, correct: false, correctStreak: 0, resolved: false, ...feedback });
    mount(); await screen.findByText('Choose an answer.');
    expect(screen.queryByText('参考答案')).toBeNull();
    expect(screen.queryByText('继续今天的课')).toBeNull();
    fireEvent.click(screen.getByLabelText('A First'));
    fireEvent.click(screen.getByText('提交答案'));
    await screen.findByText('这次还没做对，之后再试。');
    expect(screen.getByRole('status')).toHaveTextContent('这次还没做对');
    await waitFor(() => expect(screen.getByRole('status')).toHaveFocus());
    expect(submit).toHaveBeenCalledWith('test', { id: 'm1', date: '2026-11-09', answer: 'A', hinted: false });
    fireEvent.click(screen.getByRole('button', { name: '继续' }));
    await screen.findByText('今天的错题做完了。');
    expect(screen.getByText('继续今天的课')).toBeInTheDocument();
    expect(q).toHaveBeenCalledTimes(2);
  });
  it('主观题先写再对照，锁住原答，明确自评并保留提示标记', async () => {
    vi.spyOn(api, 'mistakePracticeQueue').mockResolvedValue(queue('self_check'));
    const reference = vi.spyOn(api, 'mistakeReference').mockResolvedValue({ ...feedback, frozenAnswer: 'My written answer.' });
    const submit = vi.spyOn(api, 'mistakePracticeResult').mockResolvedValue({ ok: true, correct: true, resolved: false, correctStreak: 1, ...feedback });
    mount(); await screen.findByLabelText('写下你的答案');
    expect(screen.getByText('对照参考答案').closest('button')).toBeDisabled();
    fireEvent.change(screen.getByLabelText('写下你的答案'), { target: { value: 'My written answer.' } });
    fireEvent.click(screen.getByText('我刚才看了答案或提示'));
    fireEvent.click(screen.getByText('对照参考答案'));
    await screen.findByText('我写对了');
    expect(screen.getByLabelText('写下你的答案')).toHaveAttribute('readonly');
    expect(screen.getByText('还没写对')).toBeInTheDocument();
    expect(reference).toHaveBeenCalledWith('test', { id: 'm1', date: '2026-11-09', answer: 'My written answer.' });
    fireEvent.click(screen.getByText('我写对了'));
    await waitFor(() => expect(submit).toHaveBeenCalledWith('test', expect.objectContaining({ selfCorrect: true, hinted: true, answer: 'My written answer.' })));
  });
  it('快速连点只发一次，失败保留答案，同一日期和题目安全重试', async () => {
    vi.spyOn(api, 'mistakePracticeQueue').mockResolvedValue(queue());
    let reject!: (reason: unknown) => void;
    const submit = vi.spyOn(api, 'mistakePracticeResult').mockImplementationOnce(() => new Promise((_, r) => { reject = r; })).mockResolvedValue({ ok: true, correct: true, resolved: true, correctStreak: 1, ...feedback });
    mount(); await screen.findByText('Choose an answer.');
    fireEvent.click(screen.getByLabelText('B Second'));
    const button = screen.getByText('提交答案'); fireEvent.click(button); fireEvent.click(button);
    expect(submit).toHaveBeenCalledTimes(1);
    await act(async () => reject(new Error('offline')));
    expect(screen.getByLabelText('B Second')).toBeChecked();
    fireEvent.click(button);
    await screen.findByText('做对了，这道错题消掉了。');
    expect(submit.mock.calls[0]).toEqual(submit.mock.calls[1]);
  });
  it('没有到期题按原流程继续；未交阅读时不开题', async () => {
    const q = vi.spyOn(api, 'mistakePracticeQueue').mockResolvedValue({ ...queue(), target: 0, remaining: 0, items: [] });
    const { unmount } = mount(); await screen.findByText('继续今天的课');
    expect(screen.queryByRole('region', { name: '今天的错题' })).toBeNull();
    expect(screen.getByText('继续今天的课')).toBeInTheDocument();
    unmount(); q.mockResolvedValue({ ...queue(), unlocked: false, items: [] });
    mount(); await screen.findByText('先交今天的阅读，再来做错题。');
    expect(screen.queryByText('继续今天的课')).toBeNull();
  });

  it.each(['self_check', 'objective'] as const)('丢失提交响应后重新打开另一道 %s：清空原答、参考答案、提示和结果', async (kind) => {
    const second = queue(kind); second.items[0].id = 'm2'; second.items[0].stem = 'Second question.';
    vi.spyOn(api, 'mistakePracticeQueue').mockResolvedValueOnce(queue('self_check')).mockResolvedValue(second);
    vi.spyOn(api, 'mistakeReference').mockResolvedValue({ ...feedback, frozenAnswer: 'First answer.' });
    const submit = vi.spyOn(api, 'mistakePracticeResult').mockRejectedValueOnce(new Error('response lost'))
      .mockResolvedValue({ ok: true, correct: false, correctStreak: 0, resolved: false, ...feedback });
    mount(); await screen.findByLabelText('写下你的答案');
    fireEvent.change(screen.getByLabelText('写下你的答案'), { target: { value: 'First answer.' } });
    fireEvent.click(screen.getByText('我刚才看了答案或提示'));
    fireEvent.click(screen.getByText('对照参考答案')); await screen.findByText('我写对了');
    fireEvent.click(screen.getByText('我写对了')); await screen.findByRole('alert');
    fireEvent.click(screen.getByText('重新打开错题')); await screen.findByText('Second question.');
    expect(screen.queryByText('参考答案')).toBeNull();
    expect(screen.queryByText('我写对了')).toBeNull();
    expect(screen.getByRole('checkbox')).not.toBeChecked();
    if (kind === 'self_check') {
      expect(screen.getByLabelText('写下你的答案')).toHaveValue('');
      expect(screen.getByLabelText('写下你的答案')).not.toHaveAttribute('readonly');
    } else {
      expect(screen.getByLabelText('A First')).not.toBeChecked();
      expect(screen.getByLabelText('B Second')).not.toBeChecked();
      fireEvent.click(screen.getByLabelText('B Second')); fireEvent.click(screen.getByText('提交答案'));
      await waitFor(() => expect(submit).toHaveBeenLastCalledWith('test', expect.objectContaining({ id: 'm2', answer: 'B', hinted: false })));
    }
  });

  it('同题同日重新打开保留原答和提示，换日期清空', async () => {
    const tomorrow = { ...queue('self_check'), date: '2026-11-10' };
    vi.spyOn(api, 'mistakePracticeQueue').mockResolvedValueOnce(queue('self_check')).mockResolvedValueOnce(queue('self_check')).mockResolvedValue(tomorrow);
    vi.spyOn(api, 'mistakeReference').mockRejectedValue(new Error('offline'));
    mount(); await screen.findByLabelText('写下你的答案');
    fireEvent.change(screen.getByLabelText('写下你的答案'), { target: { value: 'Keep this answer.' } });
    fireEvent.click(screen.getByText('我刚才看了答案或提示'));
    fireEvent.click(screen.getByText('对照参考答案')); await screen.findByRole('alert');
    fireEvent.click(screen.getByText('重新打开错题')); await waitFor(() => expect(screen.queryByRole('alert')).toBeNull());
    expect(screen.getByLabelText('写下你的答案')).toHaveValue('Keep this answer.');
    expect(screen.getByRole('checkbox')).toBeChecked();
    fireEvent.click(screen.getByText('对照参考答案')); await screen.findByRole('alert');
    fireEvent.click(screen.getByText('重新打开错题')); await waitFor(() => expect(screen.getByLabelText('写下你的答案')).toHaveValue(''));
    expect(screen.getByRole('checkbox')).not.toBeChecked();
  });

  it('同题重试保留参考答案和原答，继续刷新拿到同题也保留结果', async () => {
    const queries = vi.spyOn(api, 'mistakePracticeQueue').mockResolvedValue(queue('self_check'));
    vi.spyOn(api, 'mistakeReference').mockResolvedValue({ ...feedback, frozenAnswer: 'Keep this answer.' });
    vi.spyOn(api, 'mistakePracticeResult').mockRejectedValueOnce(new Error('offline'))
      .mockResolvedValue({ ok: true, correct: false, correctStreak: 0, resolved: false, ...feedback });
    mount(); await screen.findByLabelText('写下你的答案');
    fireEvent.change(screen.getByLabelText('写下你的答案'), { target: { value: 'Keep this answer.' } });
    fireEvent.click(screen.getByText('对照参考答案')); await screen.findByText('我写对了');
    fireEvent.click(screen.getByText('还没写对')); await screen.findByRole('alert');
    fireEvent.click(screen.getByText('重新打开错题')); await waitFor(() => expect(screen.queryByRole('alert')).toBeNull());
    expect(screen.getByLabelText('写下你的答案')).toHaveValue('Keep this answer.');
    expect(screen.getByLabelText('写下你的答案')).toHaveAttribute('readonly');
    expect(screen.getByText('参考答案')).toBeInTheDocument();
    fireEvent.click(screen.getByText('还没写对')); await screen.findByText('这次还没做对，之后再试。');
    fireEvent.click(screen.getByText('继续'));
    await waitFor(() => expect(queries).toHaveBeenCalledTimes(3));
    await waitFor(() => expect(screen.getByRole('button', { name: '继续' })).toBeEnabled());
    expect(screen.getByText('这次还没做对，之后再试。')).toBeInTheDocument();
  });

  it('已显示结果后继续切题，也清空结果和参考答案', async () => {
    const second = queue(); second.items[0].id = 'm2'; second.items[0].stem = 'Second question.';
    vi.spyOn(api, 'mistakePracticeQueue').mockResolvedValueOnce(queue()).mockResolvedValue(second);
    vi.spyOn(api, 'mistakePracticeResult').mockResolvedValue({ ok: true, correct: false, correctStreak: 0, resolved: false, ...feedback });
    mount(); await screen.findByText('Choose an answer.');
    fireEvent.click(screen.getByLabelText('B Second')); fireEvent.click(screen.getByText('提交答案'));
    await screen.findByText('这次还没做对，之后再试。'); fireEvent.click(screen.getByText('继续'));
    await screen.findByText('Second question.');
    expect(screen.queryByText('这次还没做对，之后再试。')).toBeNull();
    expect(screen.queryByText('参考答案')).toBeNull();
    expect(screen.getByLabelText('B Second')).not.toBeChecked();
  });

  it('队列和参考答案响应都以服务端冻结原答为准，只读显示，刷新恢复后仍交原答', async () => {
    const frozen = { ...feedback, frozenAnswer: 'Server original answer.' };
    const q = queue('self_check'); Object.assign(q.items[0], { reference: frozen });
    vi.spyOn(api, 'mistakePracticeQueue').mockResolvedValueOnce(queue('self_check')).mockResolvedValue(q);
    vi.spyOn(api, 'mistakeReference').mockResolvedValue(frozen);
    const submit = vi.spyOn(api, 'mistakePracticeResult').mockRejectedValueOnce(new Error('offline'))
      .mockResolvedValue({ ok: true, correct: true, correctStreak: 1, resolved: true, ...feedback });
    const { unmount } = mount(); await screen.findByLabelText('写下你的答案');
    fireEvent.change(screen.getByLabelText('写下你的答案'), { target: { value: 'Changed local answer.' } });
    fireEvent.click(screen.getByText('对照参考答案')); await screen.findByText('我写对了');
    expect(screen.getByLabelText('写下你的答案')).toHaveValue(frozen.frozenAnswer);
    unmount(); mount(); await screen.findByText('我写对了');
    expect(screen.getByLabelText('写下你的答案')).toHaveValue(frozen.frozenAnswer);
    expect(screen.getByLabelText('写下你的答案')).toHaveAttribute('readonly');
    expect(screen.getByText('你刚才写的：')).toBeInTheDocument();
    fireEvent.click(screen.getByText('我写对了')); await screen.findByRole('alert');
    fireEvent.click(screen.getByText('我写对了')); await screen.findByText('做对了，这道错题消掉了。');
    expect(submit).toHaveBeenLastCalledWith('test', expect.objectContaining({ answer: frozen.frozenAnswer }));
  });
});

it('首页仍三件事：阅读交卷但错题未做完时，阅读卡未完成且能打开结果', () => {
  const read: any = { key: 'read', status: 'partial', submitted: true, redo: { target: 3, progress: 1 }, sessionId: 'sess', submissionId: 'sub' };
  const lesson: any = { segments: [read], nextAction: { kind: 'read_result' } };
  expect(readingTaskView(lesson, { state: 'completed' })).toMatchObject({ key: 'reading', done: false, action: { path: '/lesson/reading/result' } });
  expect(readingResultRef(lesson)).toEqual({ sessionId: 'sess', submissionId: 'sub' });
});
