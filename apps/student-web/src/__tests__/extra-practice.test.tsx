import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor, act } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import ExtraPracticePage from '../pages/ExtraPractice';
import { initialTyping, typingReducer } from '../components/extra/typing-reducer';
import { flushExtraResults, pendingExtraResults, queueExtraResult } from '../components/extra/result-queue';
import { judgeBlocks, timeBucket, type ExtraResult, type ExtraRound } from '../lib/extra-practice';
import { writeToken } from '../lib/identity';
import { api, ApiError } from '../lib/api';
import ExtraPracticeSync from '../components/extra/ExtraPracticeSync';
import { BlocksExercise, SpellingExercise } from '../components/extra/Exercises';
vi.mock('../lib/auth-store', () => ({ getState: () => ({ status: 'authenticated', profile: { id: 'student' } }), handleAuthFailure: () => false }));
const item = { senseId: 's', headword: 'care', translation: '小心', steps: [{ step: 1, prompt: '小心', answer: 'care', translation: '小心' }] };
const round: ExtraRound = { roundId: 'r', roundToken: 'signed', drill: 'type', items: [item] };
const result: ExtraResult = { roundId: 'r', roundToken: 'signed', drill: 'type', senseId: 's', step: 1,
  attempt: 'first', isCorrect: true, hinted: false, timeBucket: 'normal' };
const shadow: ExtraRound = { ...round, drill: 'shadow', items: [{ textHash: 'hash', text: 'We take care.', audioUrl: '/api/audio/sentence/hash.mp3',
  steps: [{ step: 1, prompt: 'We take care.', answer: 'We take care.', translation: '' }] }] };
function mount(r = round) {
  vi.spyOn(api, 'extraPracticeRound').mockResolvedValue(r);
  render(<MemoryRouter><ExtraPracticePage /></MemoryRouter>);
}
beforeEach(() => { localStorage.clear(); writeToken('token'); vi.spyOn(api, 'extraPracticeResult').mockResolvedValue({ ok: true });
  vi.spyOn(HTMLMediaElement.prototype, 'pause').mockImplementation(() => {});
  vi.spyOn(HTMLMediaElement.prototype, 'play').mockResolvedValue();
});
afterEach(() => { cleanup(); vi.restoreAllMocks(); vi.unstubAllGlobals(); });
describe('extra practice', () => {
  it('stops spelling audio on question changes and unmount; late playback failure stays silent', async () => {
    const instances: Array<{ pause: ReturnType<typeof vi.fn>; fail(): void; error(): void }> = [];
    const speak = vi.fn(); const cancel = vi.fn();
    vi.stubGlobal('speechSynthesis', { speak, cancel });
    vi.stubGlobal('Audio', class {
      pause = vi.fn(); error = () => {}; fail = () => {};
      constructor() { instances.push(this); }
      addEventListener(name: string, handler: () => void) { if (name === 'error') this.error = handler; }
      play() { return new Promise<void>((_resolve, reject) => { this.fail = () => reject(new Error('late failure')); }); }
    });
    const props = { step: item.steps[0], look: true, onAttempt: vi.fn(), onNext: vi.fn() };
    const view = render(<SpellingExercise {...props} />);
    fireEvent.click(screen.getByRole('button', { name: '听发音' }));
    view.rerender(<SpellingExercise {...props} step={{ ...props.step, answer: 'next' }} />);
    expect(instances[0].pause).toHaveBeenCalled();
    fireEvent.click(screen.getByRole('button', { name: '听发音' }));
    view.unmount(); expect(instances[1].pause).toHaveBeenCalled();
    await act(async () => { for (const instance of instances) { instance.fail(); instance.error(); } });
    expect(speak).not.toHaveBeenCalled(); expect(cancel).toHaveBeenCalled();
  });
  it('single-letter blocks keep a 48px minimum width in both block lists', () => {
    render(<BlocksExercise step={{ step: 3, prompt: '我', answer: 'I am I', translation: '我' }} onAttempt={vi.fn()} onNext={vi.fn()} />);
    const blocks = screen.getAllByRole('button', { name: 'I' });
    expect(blocks).toHaveLength(2);
    for (const block of blocks) expect(block).toHaveClass('min-w-12');
    fireEvent.click(blocks[0]);
    for (const block of screen.getAllByRole('button', { name: 'I' })) expect(block).toHaveClass('min-w-12');
  });
  it('handles loading, empty rounds and disabled API', async () => {
    mount({ ...round, items: [] }); await userEvent.click(screen.getByRole('button', { name: '造句练习' }));
    expect(await screen.findByText('暂时没有合适的内容，学完新词或做完阅读后再来看看')).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: '换一种练习' }));
    vi.mocked(api.extraPracticeRound).mockRejectedValueOnce(new ApiError(404, {}));
    await userEvent.click(screen.getByRole('button', { name: '拼写打字' }));
    expect(await screen.findByText('加练暂时没开放')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: '跟读' })).toBeNull();
  });
  it('a clean first answer counts once and double next does not skip another item', async () => {
    mount({ ...round, items: [item, { ...item, senseId: 's2' }] });
    await userEvent.click(screen.getByRole('button', { name: '拼写打字' }));
    fireEvent.change(await screen.findByRole('textbox', { name: '拼写' }), { target: { value: 'care' } });
    expect(screen.getByRole('heading', { name: '拼写打字 · 看词输入' })).toBeInTheDocument();
    const next = screen.getByRole('button', { name: '下一个' });
    act(() => { fireEvent.click(next); fireEvent.click(next); });
    expect(screen.getByText('2 / 2')).toBeInTheDocument();
    fireEvent.change(screen.getByRole('textbox', { name: '拼写' }), { target: { value: 'care' } });
    await userEvent.click(screen.getByRole('button', { name: '下一个' }));
    expect(screen.getByText('练了 2 个词，2 个一次做对')).toBeInTheDocument();
  });
  it('typing reducer stays on wrong character and normalizes full-width input', () => {
    const wrong = typingReducer(initialTyping('care'), { type: 'KEY_PRESS', key: 'x' });
    expect(wrong.position).toBe(0); expect(wrong.wrong).toBe(true);
    expect(typingReducer(wrong, { type: 'KEY_PRESS', key: 'Ｃ' }).position).toBe(1);
  });
  it('matches repeated blocks by final text, and classifies time boundaries', () => {
    expect(judgeBlocks('We see what we see.', ['We', 'see', 'what', 'we', 'see.']).correct).toBe(true);
    expect(judgeBlocks('a a b', ['a', 'a', 'b']).correct).toBe(true);
    expect(judgeBlocks('a a b', ['a', 'b', 'a']).wrongBlock).toBe(2);
    expect([2999, 3000, 30000, 30001].map(timeBucket)).toEqual(['fast', 'normal', 'normal', 'slow']);
  });
  it('look typing marks mistakes without advancing; completion uses result-only payloads', async () => {
    mount(); await userEvent.click(screen.getByRole('button', { name: '拼写打字' }));
    const input = await screen.findByRole('textbox', { name: '拼写' });
    fireEvent.change(input, { target: { value: 'x' } });
    expect(screen.getByTestId('typing-letters')).toHaveTextContent('care');
    expect(screen.getByText('这个字母不对，再试一次')).toBeInTheDocument();
    fireEvent.change(input, { target: { value: 'care' } });
    await userEvent.click(screen.getByRole('button', { name: '下一个' }));
    expect(await screen.findByText('练了 1 个词，0 个一次做对')).toBeInTheDocument();
    expect(screen.getByText('加练不影响今天的必做任务')).toBeInTheDocument();
    expect(JSON.stringify(localStorage)).not.toContain('typed');
  });
  it('dictation reveals prefixes; composition never submits early', async () => {
    mount(); await userEvent.click(screen.getByRole('button', { name: '听写' }));
    const input = await screen.findByRole('textbox', { name: '拼写' });
    expect(screen.queryByText('care')).toBeNull();
    fireEvent.compositionStart(input); fireEvent.change(input, { target: { value: 'x' } });
    fireEvent.submit(input.closest('form')!); expect(pendingExtraResults('student')).toBe(0);
    fireEvent.compositionEnd(input, { data: 'x' });
    await userEvent.click(screen.getByRole('button', { name: '检查拼写' }));
    expect(screen.getByTestId('spelling-prefix')).toHaveTextContent('c');
    // 给字母格子（长度提示），打错后清空输入框、开头露在格子里
    expect(screen.getByTestId('spelling-slots').children).toHaveLength(4);
    expect(screen.getAllByTestId('spelling-prefix-letter').map((s) => s.textContent).join('')).toBe('c');
    expect(input).toHaveValue('');
    expect(screen.getByRole('status')).toHaveTextContent('还没拼对，已帮你露出开头，再试一次。');
    expect(input).toHaveAttribute('autocorrect', 'off'); expect(input).toHaveAttribute('autocapitalize', 'none');
  });
  it('ladder reveals original only after two wrong checks; can finish correct blocks', async () => {
    mount({ ...round, drill: 'ladder', items: [{ ...item, steps: [{ step: 3, prompt: '我们会小心。', answer: 'We take care.', translation: '我们会小心。' }] }] });
    await userEvent.click(screen.getByRole('button', { name: '造句练习' }));
    await screen.findByText('我们会小心。');
    for (const word of ['care.', 'take', 'We']) await userEvent.click(screen.getByRole('button', { name: word }));
    await userEvent.click(screen.getByRole('button', { name: '检查顺序' }));
    expect(screen.queryByTestId('ladder-answer')).toBeNull();
    expect(screen.getByText('从第 1 块开始不对')).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: '检查顺序' }));
    expect(screen.getByTestId('ladder-answer')).toHaveTextContent('We take care.');
    await userEvent.click(screen.getByRole('button', { name: '重新排' }));
    for (const word of ['We', 'take', 'care.']) await userEvent.click(screen.getByRole('button', { name: word }));
    await userEvent.click(screen.getByRole('button', { name: '检查顺序' }));
    await userEvent.click(screen.getByRole('button', { name: '下一个' }));
    expect(screen.getByText('练了 1 个词，0 个一次做对')).toBeInTheDocument();
  });
  it('shadow fallback records a repetition with null correctness and renders one audio', async () => {
    vi.stubGlobal('MediaRecorder', undefined);
    mount({ ...round, drill: 'shadow', items: [{ textHash: 'hash', text: 'We take care.', audioUrl: '/api/audio/sentence/hash.mp3',
      steps: [{ step: 1, prompt: 'We take care.', answer: 'We take care.', translation: '' }] }] });
    await userEvent.click(screen.getByRole('button', { name: '跟读' }));
    expect(await screen.findByText('这台设备录不了音，可以听一句、跟着读一句')).toBeInTheDocument();
    expect(document.querySelectorAll('audio')).toHaveLength(1);
    await userEvent.click(screen.getByRole('button', { name: '我跟读了一遍' }));
    await waitFor(() => expect(api.extraPracticeResult).toHaveBeenCalledWith('token', expect.objectContaining({ isCorrect: null })));
    await userEvent.click(screen.getByRole('button', { name: '下一个' }));
    expect(screen.getByText('练了 1 句')).toBeInTheDocument();
  });
  it('microphone denial falls back and pending permission is closed on unmount', async () => {
    vi.stubGlobal('MediaRecorder', class {});
    const getUserMedia = vi.fn().mockRejectedValueOnce(new Error('denied'));
    vi.stubGlobal('navigator', new Proxy(navigator, { get(target, key) { return key === 'mediaDevices' ? { getUserMedia } : Reflect.get(target, key, target); } }));
    mount(shadow); fireEvent.click(screen.getByRole('button', { name: '跟读' }));
    fireEvent.click(await screen.findByRole('button', { name: '开始录音' }));
    expect(await screen.findByText('这台设备录不了音，可以听一句、跟着读一句')).toBeInTheDocument();
    cleanup(); const stop = vi.fn(); let allow!: (stream: unknown) => void;
    getUserMedia.mockImplementationOnce(() => new Promise(resolve => { allow = resolve; }));
    mount(shadow); fireEvent.click(screen.getByRole('button', { name: '跟读' }));
    fireEvent.click(await screen.findByRole('button', { name: '开始录音' })); cleanup();
    await act(async () => { allow({ getTracks: () => [{ stop }] }); }); expect(stop).toHaveBeenCalledOnce();
    expect(api.extraPracticeResult).not.toHaveBeenCalled();
  });
  it('records supported mp4 in memory, shares playback and releases tracks/blob URLs', async () => {
    const stop = vi.fn(); const createObjectURL = vi.fn(() => 'blob:local-recording'); const revokeObjectURL = vi.fn();
    vi.stubGlobal('navigator', new Proxy(navigator, { get(target, key) { return key === 'mediaDevices'
      ? { getUserMedia: vi.fn(async () => ({ getTracks: () => [{ stop }] })) } : Reflect.get(target, key, target); } }));
    vi.stubGlobal('URL', class extends URL { static createObjectURL = createObjectURL; static revokeObjectURL = revokeObjectURL; });
    let instance: any;
    class Recorder {
      static isTypeSupported = (mime: string) => mime === 'audio/mp4';
      mimeType: string; state = 'inactive'; ondataavailable?: (e: any) => void; onstop?: () => void;
      constructor(_stream: unknown, options: { mimeType: string }) { this.mimeType = options.mimeType; instance = this; }
      start() { this.state = 'recording'; }
      stop() { this.state = 'inactive'; this.ondataavailable?.({ data: new Blob(['recording'], { type: this.mimeType }) }); this.onstop?.(); }
    }
    vi.stubGlobal('MediaRecorder', Recorder);
    mount(shadow); fireEvent.click(screen.getByRole('button', { name: '跟读' }));
    fireEvent.click(await screen.findByRole('button', { name: '开始录音' }));
    fireEvent.click(await screen.findByRole('button', { name: '读完了，停止' }));
    expect(instance.mimeType).toBe('audio/mp4'); expect(stop).toHaveBeenCalled();
    fireEvent.click(screen.getByRole('button', { name: '听我的录音' }));
    expect(document.querySelector('audio')).toHaveAttribute('src', 'blob:local-recording');
    fireEvent.click(screen.getByRole('button', { name: '听原句' }));
    expect(document.querySelector('audio')?.getAttribute('src')).toContain('/api/audio/sentence/hash.mp3');
    expect(document.querySelectorAll('audio')).toHaveLength(1);
    expect(screen.getByText('这句练了 1 遍')).toBeInTheDocument();
    expect(Object.values(localStorage).join()).not.toContain('recording');
    cleanup(); expect(revokeObjectURL).toHaveBeenCalledWith('blob:local-recording');
  });
  it('storage failure keeps the answer on screen until the same result saves', async () => {
    mount(); await userEvent.click(screen.getByRole('button', { name: '听写' }));
    const input = await screen.findByRole('textbox', { name: '拼写' }); fireEvent.change(input, { target: { value: 'care' } });
    const storage = vi.spyOn(Storage.prototype, 'setItem').mockImplementationOnce(() => { throw new Error('full'); });
    fireEvent.click(screen.getByRole('button', { name: '检查拼写' }));
    expect(screen.getByText('这次还没保存，请先重试')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: '下一个' })).toBeNull(); storage.mockRestore();
    fireEvent.click(screen.getByRole('button', { name: '重试保存' }));
    expect(screen.getByRole('button', { name: '下一个' })).toBeInTheDocument();
    await waitFor(() => expect(api.extraPracticeResult).toHaveBeenCalledTimes(1));
    expect(vi.mocked(api.extraPracticeResult).mock.calls[0][1].attempt).toBe('first');
  });
  it('queues offline, replays exact first result once, retains failed responses', async () => {
    vi.spyOn(navigator, 'onLine', 'get').mockReturnValue(false);
    queueExtraResult('student', result); queueExtraResult('student', { ...result, isCorrect: false });
    await flushExtraResults('student', () => true); expect(api.extraPracticeResult).not.toHaveBeenCalled();
    vi.spyOn(navigator, 'onLine', 'get').mockReturnValue(true);
    vi.mocked(api.extraPracticeResult).mockRejectedValueOnce(new Error('offline'));
    await expect(flushExtraResults('student', () => true)).rejects.toThrow();
    expect(pendingExtraResults('student')).toBe(1);
    await act(() => flushExtraResults('student', () => true)); expect(pendingExtraResults('student')).toBe(0);
    expect(vi.mocked(api.extraPracticeResult).mock.calls.at(-1)?.[1]).toEqual(result);
  });
  it('queue cannot send or recreate results after account switch', async () => {
    queueExtraResult('student', result);
    await flushExtraResults('student', () => false); expect(api.extraPracticeResult).not.toHaveBeenCalled();
    let owner = true; let finish!: (r: { ok: true }) => void;
    vi.mocked(api.extraPracticeResult).mockImplementationOnce(() => new Promise(resolve => { finish = resolve; }));
    const pending = flushExtraResults('student', () => owner); owner = false; localStorage.clear(); finish({ ok: true });
    await pending; expect(localStorage.length).toBe(0);
  });
  it('parallel flushes share one worker and retain results added during an upload', async () => {
    queueExtraResult('student', result); let finish!: (r: { ok: true }) => void;
    vi.mocked(api.extraPracticeResult).mockImplementationOnce(() => new Promise(resolve => { finish = resolve; }));
    const pending = flushExtraResults('student', () => true);
    expect(flushExtraResults('student', () => true)).toBe(pending);
    queueExtraResult('student', { ...result, senseId: 's2' });
    expect(pendingExtraResults('student')).toBe(2);
    finish({ ok: true }); await pending;
    expect(api.extraPracticeResult).toHaveBeenCalledTimes(2); expect(pendingExtraResults('student')).toBe(0);
  });
  it('the app-wide worker automatically flushes when the online event arrives', async () => {
    const online = vi.spyOn(navigator, 'onLine', 'get').mockReturnValue(false);
    queueExtraResult('student', result); render(<ExtraPracticeSync owner="student" />);
    expect(api.extraPracticeResult).not.toHaveBeenCalled();
    online.mockReturnValue(true); act(() => { window.dispatchEvent(new Event('online')); });
    await waitFor(() => expect(pendingExtraResults('student')).toBe(0));
    expect(api.extraPracticeResult).toHaveBeenCalledWith('token', result);
  });
});
