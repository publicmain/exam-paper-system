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
    expect(submit).toHaveBeenCalledWith('test', { id: 'm1', date: '2026-11-09', answer: 'A', hinted: false });
    fireEvent.click(screen.getByRole('button', { name: '继续' }));
    await screen.findByText('今天的错题做完了。');
    expect(screen.getByText('继续今天的课')).toBeInTheDocument();
    expect(q).toHaveBeenCalledTimes(2);
  });
  it('主观题先写再对照，锁住原答，明确自评并保留提示标记', async () => {
    vi.spyOn(api, 'mistakePracticeQueue').mockResolvedValue(queue('self_check'));
    const reference = vi.spyOn(api, 'mistakeReference').mockResolvedValue(feedback);
    const submit = vi.spyOn(api, 'mistakePracticeResult').mockResolvedValue({ ok: true, correct: true, resolved: false, correctStreak: 1, ...feedback });
    mount(); await screen.findByLabelText('写下你的答案');
    expect(screen.getByText('对照参考答案').closest('button')).toBeDisabled();
    fireEvent.change(screen.getByLabelText('写下你的答案'), { target: { value: 'My written answer.' } });
    fireEvent.click(screen.getByText('我刚才看了答案或提示'));
    fireEvent.click(screen.getByText('对照参考答案'));
    await screen.findByText('我写对了');
    expect(screen.getByLabelText('写下你的答案')).toBeDisabled();
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
});

it('首页仍三件事：阅读交卷但错题未做完时，阅读卡未完成且能打开结果', () => {
  const read: any = { key: 'read', status: 'partial', submitted: true, redo: { target: 3, progress: 1 }, sessionId: 'sess', submissionId: 'sub' };
  const lesson: any = { segments: [read], nextAction: { kind: 'read_result' } };
  expect(readingTaskView(lesson, { state: 'completed' })).toMatchObject({ key: 'reading', done: false, action: { path: '/lesson/reading/result' } });
  expect(readingResultRef(lesson)).toEqual({ sessionId: 'sess', submissionId: 'sub' });
});
