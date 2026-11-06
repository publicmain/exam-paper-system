import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { useState } from 'react';
import { SentenceAudioProvider, SentencePassage } from '../lesson/shared/SentenceAudio';
import type { PassageSentenceAudio } from '../lib/api';
import { OLevelCloze } from '../lesson/questions/OLevelCloze';
import { OLevelComprehension } from '../lesson/questions/OLevelComprehension';
import { ReadingProvider } from '../lesson/ReadingProvider';
import { ExamModeProvider } from '../lesson/ExamContext';
import type { ExamPaper } from '../lesson/examTypes';

const passage = 'Hello world. No recording. Goodbye. Hello world.';
const sentences = ['Hello world.', 'No recording.', 'Goodbye.', 'Hello world.'];
const passages: PassageSentenceAudio[] = [{ passage, paragraphs: [sentences.map((text, i) => ({
  text, audioUrl: i === 1 ? null : `/api/audio/sentence/${i}.mp3`,
}))] }];
let play: ReturnType<typeof vi.spyOn>;
let pause: ReturnType<typeof vi.spyOn>;
beforeEach(() => {
  play = vi.spyOn(HTMLMediaElement.prototype, 'play').mockImplementation(function (this: HTMLMediaElement) {
    this.dispatchEvent(new Event('playing')); return Promise.resolve();
  });
  pause = vi.spyOn(HTMLMediaElement.prototype, 'pause').mockImplementation(function (this: HTMLMediaElement) {
    this.dispatchEvent(new Event('pause'));
  });
});
afterEach(() => { cleanup(); vi.restoreAllMocks(); delete (document as any).caretRangeFromPoint; window.getSelection()?.removeAllRanges(); });

function Article({ onWordTap = vi.fn() }: { onWordTap?: (word: string, range: Range) => void }) {
  const [hs, setHs] = useState([{ id: 'h1', start: 6, end: 11 }]);
  return <SentencePassage passage={passage} body={passage} highlights={hs} onChange={setHs} onWordTap={onWordTap} testId="article" />;
}
function mount(list = passages, onWordTap?: (word: string, range: Range) => void) {
  return render(<SentenceAudioProvider passages={list}><Article onWordTap={onWordTap} /></SentenceAudioProvider>);
}
const audio = () => document.querySelector('audio')!;
const sentenceButton = (n: number) => screen.getAllByRole('button', { name: '朗读这句' })[n === 1 ? 0 : n - 2];
const clickSentence = (n: number) => fireEvent.click(sentenceButton(n));

describe('reading sentence player', () => {
  it.each(['mouse', 'touch'])('O-Level %s selection stays selected while sentence playback remains available', async (gesture) => {
    const text = 'Hello world. Goodbye.';
    const paper: ExamPaper = { sessionId: 'comprehension', quizEnd: null, level: 'olevel', paperMode: null, mode: 'test', questions: [
      { id: 'q1', sortOrder: 1, marks: 1, questionType: 'short_answer', snapshotOptions: null, snapshotContent: { passage: text, stem: 'Who?' } },
    ] };
    const view = render(<ReadingProvider sessionId="comprehension" submissionId="sub" deps={{ saveAnswer: vi.fn(async () => ({ applied: true, clientSeq: 1 })), loadSession: vi.fn() }}>
      <ExamModeProvider mode="test"><SentenceAudioProvider passages={[{ passage: text, paragraphs: [[
        { text: 'Hello world.', audioUrl: '/hello.mp3' }, { text: 'Goodbye.', audioUrl: '/bye.mp3' },
      ]] }]}><OLevelComprehension paper={paper} /></SentenceAudioProvider></ExamModeProvider>
    </ReadingProvider>);
    const root = view.container.querySelector('aside .whitespace-pre-wrap')!;
    const node = document.createTreeWalker(root, NodeFilter.SHOW_TEXT).nextNode()!;
    const range = document.createRange(); range.setStart(node, 0); range.setEnd(node, 5);
    window.getSelection()!.removeAllRanges(); window.getSelection()!.addRange(range);
    expect(window.getSelection()!.toString()).toBe('Hello');
    if (gesture === 'mouse') fireEvent.mouseUp(root, { button: 0 });
    else await act(async () => {
      fireEvent.touchEnd(root); document.dispatchEvent(new Event('selectionchange'));
      await new Promise((resolve) => setTimeout(resolve, 300));
    });
    expect(window.getSelection()!.toString()).toBe('Hello');
    expect(root.querySelector('mark')).toBeNull();
    fireEvent.click(screen.getAllByRole('button', { name: '朗读这句' })[0]);
    expect(audio().getAttribute('src')).toBe('/hello.mp3');
    expect(play).toHaveBeenCalledOnce();
  });
  it('does not autoplay, reuses one audio element and only exposes recorded sentences', () => {
    mount();
    expect(play).not.toHaveBeenCalled();
    expect(document.querySelectorAll('audio')).toHaveLength(1);
    expect(screen.getAllByRole('button', { name: '朗读这句' })).toHaveLength(3);
    clickSentence(3);
    expect(play).toHaveBeenCalledTimes(1);
    expect(audio().getAttribute('src')).toBe('/api/audio/sentence/2.mp3');
    expect(sentenceButton(3)).toHaveAttribute('aria-pressed', 'true');
    fireEvent.click(screen.getByRole('button', { name: '暂停' }));
    expect(pause).toHaveBeenCalled();
    fireEvent.click(screen.getByRole('button', { name: '播放' }));
    expect(play).toHaveBeenCalledTimes(2);
    expect(document.querySelectorAll('audio')).toHaveLength(1);
  });
  it('updates speed on the same media element and keeps it for the next sentence', () => {
    mount(); clickSentence(1);
    fireEvent.click(screen.getByRole('button', { name: '慢速' }));
    expect(audio().playbackRate).toBe(0.75);
    expect(screen.getByText('0.75×')).toBeInTheDocument();
    clickSentence(3); expect(audio().playbackRate).toBe(0.75);
    fireEvent.click(screen.getByRole('button', { name: '慢速' }));
    expect(audio().playbackRate).toBe(1);
  });
  it('single sentence loop has priority, and switching it off permits continuous play', () => {
    mount();
    fireEvent.click(screen.getByRole('button', { name: '往下连读' }));
    fireEvent.click(screen.getByRole('button', { name: '单句循环' }));
    clickSentence(1);
    expect(audio().loop).toBe(true);
    fireEvent.ended(audio());
    expect(audio().getAttribute('src')).toBe('/api/audio/sentence/0.mp3');
    fireEvent.click(screen.getByRole('button', { name: '单句循环' }));
    expect(audio().loop).toBe(false);
    fireEvent.ended(audio());
    expect(audio().getAttribute('src')).toBe('/api/audio/sentence/2.mp3');
  });
  it('continuous play skips unavailable audio, handles repeated sentences, and stops at the end', () => {
    mount(); fireEvent.click(screen.getByRole('button', { name: '往下连读' })); clickSentence(1);
    fireEvent.ended(audio()); expect(audio().getAttribute('src')).toBe('/api/audio/sentence/2.mp3');
    fireEvent.ended(audio()); expect(audio().getAttribute('src')).toBe('/api/audio/sentence/3.mp3');
    expect(sentenceButton(4)).toHaveAttribute('aria-pressed', 'true');
    const calls = play.mock.calls.length;
    fireEvent.ended(audio()); expect(play).toHaveBeenCalledTimes(calls);
    expect(screen.getByRole('button', { name: '播放' })).toBeInTheDocument();
  });
  it('does not continue to another article or automatically play when toggling options', () => {
    mount([...passages, { passage: 'Another.', paragraphs: [[{ text: 'Another.', audioUrl: '/other.mp3' }]] }]);
    fireEvent.click(screen.getByRole('button', { name: '往下连读' }));
    expect(play).not.toHaveBeenCalled();
    clickSentence(4); fireEvent.ended(audio()); expect(play).toHaveBeenCalledTimes(1);
  });
  it('no audio hides both player and speakers and preserves the article', () => {
    mount([{ passage, paragraphs: [sentences.map((text) => ({ text, audioUrl: null }))] }]);
    expect(screen.queryByTestId('sentence-player')).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /朗读/ })).not.toBeInTheDocument();
    expect(screen.getByTestId('article').textContent).toBe(passage);
    expect(document.querySelector('audio')).toBeNull();
  });
  it('quick sentence switches ignore an earlier rejected play request; failures allow retry', async () => {
    let reject!: (e: Error) => void;
    play.mockImplementationOnce(() => new Promise<void>((_ok, no) => { reject = no; }));
    mount(); clickSentence(1); clickSentence(3);
    await act(async () => reject(new Error('aborted')));
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
    fireEvent.error(audio()); expect(screen.getByRole('alert')).toHaveTextContent('这句暂时播放不了');
    clickSentence(1); expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });
  it('word taps and removal of highlights remain independent of speaker buttons', () => {
    const lookup = vi.fn(); mount(passages, lookup);
    const root = screen.getByTestId('article');
    const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
    let text: Node | null = null;
    while ((text = walker.nextNode())) if (text.textContent?.includes('Goodbye')) break;
    (document as any).caretRangeFromPoint = () => {
      const r = document.createRange(); r.setStart(text!, 2); r.collapse(true); return r;
    };
    fireEvent.pointerDown(text!.parentElement!, { clientX: 1, clientY: 1 });
    fireEvent.pointerUp(text!.parentElement!, { clientX: 1, clientY: 1 });
    expect(lookup).toHaveBeenCalledWith('Goodbye', expect.anything());
    lookup.mockClear();
    fireEvent.click(root.querySelector('mark')!);
    expect(root.querySelector('mark')).toBeNull();
    clickSentence(1); expect(lookup).not.toHaveBeenCalled();
    expect(root.textContent).toBe(passage);
  });
  it('selection across a sentence speaker keeps original character offsets', () => {
    mount();
    const root = screen.getByTestId('article');
    const nodes: Text[] = [];
    const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
    let node: Node | null;
    while ((node = walker.nextNode())) nodes.push(node as Text);
    const first = nodes[0]; const last = nodes.find((n) => n.textContent?.includes('Goodbye'))!;
    const range = document.createRange(); range.setStart(first, 0); range.setEnd(last, last.textContent!.length);
    window.getSelection()!.addRange(range); fireEvent.mouseUp(root, { button: 0 });
    expect(root.querySelector('mark')!.textContent).toBe('Hello world.');
    expect(root.textContent).toBe(passage);
  });
  it('unmount pauses playback', () => {
    const view = mount(); clickSentence(1); pause.mockClear(); view.unmount(); expect(pause).toHaveBeenCalledTimes(1);
  });
  it('a delayed ended event cannot restart playback after pause', () => {
    mount(); fireEvent.click(screen.getByRole('button', { name: '往下连读' })); clickSentence(1);
    fireEvent.click(screen.getByRole('button', { name: '暂停' }));
    const calls = play.mock.calls.length;
    fireEvent.ended(audio()); expect(play).toHaveBeenCalledTimes(calls);
  });
  it('cloze sentences spanning a blank keep the existing input working', () => {
    const text = 'They eat [BLANK] daily. Then they rest.';
    const paper: ExamPaper = { sessionId: 'cloze', quizEnd: null, level: 'olevel', paperMode: null, mode: 'test', questions: [
      { id: 'q1', sortOrder: 1, marks: 1, questionType: 'short_answer', snapshotOptions: null, snapshotContent: { passage: text } },
    ] };
    render(<ReadingProvider sessionId="cloze" submissionId="sub" deps={{ saveAnswer: vi.fn(async () => ({ applied: true, clientSeq: 1 })), loadSession: vi.fn() }}>
      <ExamModeProvider mode="test">
        <SentenceAudioProvider passages={[{ passage: text, paragraphs: [[{ text: 'They eat [BLANK] daily.', audioUrl: '/cloze.mp3' }, { text: 'Then they rest.', audioUrl: null }]] }]}>
          <OLevelCloze paper={paper} />
        </SentenceAudioProvider>
      </ExamModeProvider>
    </ReadingProvider>);
    const input = screen.getByRole('textbox', { name: 'Blank 1' });
    fireEvent.change(input, { target: { value: 'fruit' } });
    clickSentence(1);
    expect(audio().getAttribute('src')).toBe('/cloze.mp3');
    expect(input).toHaveValue('fruit');
    expect(screen.getAllByRole('textbox')).toHaveLength(1);
  });
});
