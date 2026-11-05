import { useEffect, useRef, useState } from 'react';
import { judgeRecall, normalizeRecallSpelling, type RecallResult } from '../../../../api/src/vocab-v2/recall-spelling';
import { judgeBlocks, shuffledBlocks, type ExtraStep } from '../../lib/extra-practice';
import { sayWord } from '../../lib/speak';
import { useSentenceAudioPlayback } from '../../lesson/shared/SentenceAudio';
import { initialTyping, typingReducer } from './typing-reducer';

export const secondary = 'min-h-12 rounded-control bg-fill px-4 py-3 text-base font-semibold text-ink disabled:opacity-50';
export const primary = 'min-h-12 rounded-control bg-accent-fill px-4 py-3 text-base font-semibold text-accent-on disabled:opacity-50';
type Props = { step: ExtraStep; onAttempt(correct: boolean | null, hinted: boolean): void; onNext(): void };
function useSavedAction() {
  const action = useRef<(() => void) | null>(null);
  const [failed, setFailed] = useState(false);
  function run(next: () => void) {
    try { next(); action.current = null; setFailed(false); }
    catch { action.current = next; setFailed(true); }
  }
  return { run, failed, message: failed ? <div role="alert" className="space-y-2 text-sm text-danger"><p>这次还没保存，请先重试</p>
    <button type="button" className={secondary} onClick={() => { if (action.current) run(action.current); }}>重试保存</button></div> : null };
}
const inputClass = 'min-h-12 w-full rounded-control border-2 border-control bg-surface px-3 py-2 text-lg text-ink';

export function SpellingExercise({ step, look, onAttempt, onNext }: Props & { look: boolean }) {
  const [typing, setTyping] = useState(() => initialTyping(step.answer));
  const typingRef = useRef(typing);
  const [value, setValue] = useState('');
  const [recall, setRecall] = useState<RecallResult>();
  const [done, setDone] = useState(false);
  const composition = useRef(false);
  const [composing, setComposing] = useState(false);
  const failedOnce = useRef(false);
  const checkLock = useRef(false);
  const save = useSavedAction();
  useEffect(() => { checkLock.current = false; }, [recall, done]);
  function type(raw: string) {
    if (done || save.failed || typingRef.current.position >= typingRef.current.expected.length) return;
    let next = typingRef.current;
    const accepted = next.expected.slice(0, next.position);
    const normalized = normalizeRecallSpelling(raw);
    const suffix = normalized.startsWith(accepted) ? raw.slice(accepted.length) : raw;
    for (const key of suffix) {
      next = typingReducer(next, { type: 'KEY_PRESS', key });
      if (next.wrong) break;
    }
    const state = next;
    save.run(() => {
      if (state.wrong && !failedOnce.current) { onAttempt(false, false); failedOnce.current = true; }
      if (state.position === state.expected.length) { onAttempt(true, false); setDone(true); }
      typingRef.current = state; setTyping(state); setValue(state.expected.slice(0, state.position));
    });
  }
  function check() {
    if (done || composition.current || save.failed || checkLock.current) return;
    checkLock.current = true;
    const next = judgeRecall(normalizeRecallSpelling(step.answer), value, (recall?.attempt ?? 0) + 1, recall);
    save.run(() => { onAttempt(next.isCorrect, Boolean(recall?.hintLevel)); setRecall(next); setDone(next.isCorrect); });
  }
  return <div className="space-y-6">
    <p className="text-xl text-ink">{step.prompt}</p>
    {look && <p lang="en" className="break-words text-2xl font-semibold text-ink" data-testid="typing-letters">{Array.from(typing.expected).map((c, i) =>
      <span key={i} className={i === typing.position && typing.wrong ? 'bg-danger-soft text-danger underline' : i < typing.position ? 'text-accent' : ''}>{c}</span>)}</p>}
    <button type="button" className={secondary} onClick={() => sayWord(step.answer)}>听发音</button>
    {!look && recall?.nextPrefix && <p className="text-lg text-ink" data-testid="spelling-prefix">开头是：<span lang="en">{recall.nextPrefix}</span></p>}
    {!look && recall?.answerRevealed && <p className="text-lg text-ink" lang="en">{recall.correctSpelling}</p>}
    <form className="space-y-4" onSubmit={e => { e.preventDefault(); if (!look) check(); }}>
      <input aria-label="拼写" className={inputClass} value={value} disabled={done || save.failed} autoComplete="off" autoCorrect="off" autoCapitalize="none" spellCheck={false}
        onCompositionStart={() => { composition.current = true; setComposing(true); }}
        onCompositionEnd={e => { composition.current = false; setComposing(false); if (look) type(e.currentTarget.value); else setValue(e.currentTarget.value); }}
        onChange={e => { if (composition.current) { setValue(e.target.value); return; } if (look) type(e.target.value); else setValue(e.target.value); }} />
      {look && typing.wrong && <p role="status" className="text-sm text-danger">这个字母不对，再试一次</p>}
      {!look && recall && !recall.isCorrect && <p role="status" className="text-sm text-ink-2">再试一次</p>}
      {!done && !look && <button className={primary} disabled={composing || save.failed || !value.trim()}>检查拼写</button>}
      {done && <p role="status" className="text-base text-success">拼对了</p>}
    </form>
    {save.message}
    {done && <button type="button" className={primary} onClick={onNext}>下一个</button>}
  </div>;
}

export function BlocksExercise({ step, onAttempt, onNext }: Props) {
  const [blocks] = useState(() => shuffledBlocks(step.answer));
  const [selected, setSelected] = useState<number[]>([]);
  const [errors, setErrors] = useState(0);
  const [wrongBlock, setWrongBlock] = useState<number>();
  const [done, setDone] = useState(false);
  const checkLock = useRef(false);
  const save = useSavedAction();
  useEffect(() => { checkLock.current = false; }, [errors, done]);
  function check() {
    if (done || save.failed || checkLock.current) return;
    checkLock.current = true;
    const result = judgeBlocks(step.answer, selected.map(i => blocks[i]));
    save.run(() => { onAttempt(result.correct, errors > 0); setDone(result.correct);
      if (!result.correct) { setErrors(n => n + 1); setWrongBlock(result.wrongBlock); } });
  }
  return <div className="space-y-6">
    <p className="text-xl text-ink">{step.prompt}</p><p className="text-sm text-ink-2">点词块，排成一句话；点上面的词块可以放回</p>
    <div aria-label="排好的句子" className="flex min-h-24 flex-wrap gap-2 rounded-control bg-surface-2 p-4">
      {selected.map((i, at) => <button key={i} type="button" className={secondary} disabled={done || save.failed}
        onClick={() => setSelected(s => s.filter((_, n) => n !== at))}>{blocks[i]}</button>)}
    </div>
    <div aria-label="可选词块" className="flex flex-wrap gap-2">{blocks.map((word, i) => !selected.includes(i) &&
      <button key={i} type="button" className={secondary} disabled={done || save.failed} onClick={() => setSelected(s => [...s, i])}>{word}</button>)}</div>
    {wrongBlock && !done && <p role="status" className="text-sm text-danger">从第 {wrongBlock} 块开始不对</p>}
    {errors >= 2 && <p data-testid="ladder-answer" lang="en" className="text-lg text-ink">{step.answer}</p>}
    {save.message}
    {done ? <><p role="status" className="text-base text-success">排对了</p><button type="button" className={primary} onClick={onNext}>下一个</button></> :
      <div className="flex flex-wrap gap-3"><button type="button" className={primary} disabled={selected.length !== blocks.length || save.failed} onClick={check}>检查顺序</button>
        <button type="button" className={secondary} disabled={save.failed} onClick={() => { setSelected([]); setWrongBlock(undefined); }}>重新排</button></div>}
  </div>;
}

export function ShadowExercise({ step, onAttempt, onNext }: Props) {
  const playback = useSentenceAudioPlayback();
  const [fallback, setFallback] = useState(() => typeof MediaRecorder === 'undefined' || !navigator.mediaDevices?.getUserMedia);
  const [recording, setRecording] = useState(false);
  const [starting, setStarting] = useState(false);
  const [url, setUrl] = useState<string | null>(null);
  const [count, setCount] = useState(0);
  const alive = useRef(true); const busy = useRef(false);
  const recorder = useRef<MediaRecorder | null>(null); const stream = useRef<MediaStream | null>(null);
  const localUrl = useRef<string | null>(null);
  const stopTimer = useRef<ReturnType<typeof setTimeout>>();
  const save = useSavedAction();
  function repetition() { save.run(() => { onAttempt(null, false); setCount(c => c + 1); }); }
  useEffect(() => { alive.current = true; return () => {
    alive.current = false;
    clearTimeout(stopTimer.current);
    if (recorder.current) {
      recorder.current.ondataavailable = null; recorder.current.onstop = null; recorder.current.onerror = null;
      if (recorder.current.state !== 'inactive') recorder.current.stop();
    }
    stream.current?.getTracks().forEach(t => t.stop());
    if (localUrl.current) URL.revokeObjectURL(localUrl.current);
  }; }, []);
  async function start() {
    if (busy.current || save.failed) return; busy.current = true; setStarting(true);
    try {
      const media = await navigator.mediaDevices.getUserMedia({ audio: true });
      if (!alive.current) { media.getTracks().forEach(t => t.stop()); return; }
      stream.current = media;
      const mimeType = ['audio/mp4', 'audio/webm;codecs=opus', 'audio/webm'].find(m => MediaRecorder.isTypeSupported?.(m));
      const r = new MediaRecorder(media, mimeType ? { mimeType } : undefined); recorder.current = r;
      const chunks: Blob[] = []; let failed = false;
      r.ondataavailable = e => { if (alive.current && e.data.size) chunks.push(e.data); };
      r.onstop = () => {
        clearTimeout(stopTimer.current);
        media.getTracks().forEach(t => t.stop()); busy.current = false;
        if (!alive.current) return; setRecording(false);
        if (failed || !chunks.length) { setFallback(true); return; }
        if (localUrl.current) URL.revokeObjectURL(localUrl.current);
        const next = URL.createObjectURL(new Blob(chunks, { type: r.mimeType || chunks[0].type }));
        localUrl.current = next; setUrl(next); repetition();
      };
      r.onerror = () => { failed = true; clearTimeout(stopTimer.current); media.getTracks().forEach(t => t.stop()); busy.current = false; if (alive.current) { setRecording(false); setFallback(true); } };
      r.start(); setRecording(true);
      stopTimer.current = setTimeout(() => { if (r.state !== 'inactive') r.stop(); }, 60000);
    } catch { stream.current?.getTracks().forEach(t => t.stop()); busy.current = false; if (alive.current) setFallback(true); }
    finally { if (alive.current) setStarting(false); }
  }
  return <div className="space-y-6">
    <p lang="en" className="text-xl leading-relaxed text-ink">{step.answer}</p>
    <p className="text-sm text-ink-2">先听原句，再读一遍。录音只在这页回放，离开就没了。</p>
    {!fallback && <p className="text-sm text-ink-2">每次最多录 1 分钟</p>}
    <button type="button" className={secondary} onClick={playback.playOriginal} disabled={recording}>听原句</button>
    {fallback ? <><p className="text-base text-ink-2">这台设备录不了音，可以听一句、跟着读一句</p>
      <button type="button" className={count ? secondary : primary} disabled={save.failed} onClick={repetition}>我跟读了一遍</button></> :
      <div className="flex flex-wrap gap-3"><button type="button" className={count ? secondary : primary} disabled={starting || save.failed}
        onClick={() => { if (recording) recorder.current?.stop(); else void start(); }}>{starting ? '正在打开麦克风…' : recording ? '读完了，停止' : '开始录音'}</button>
        {url && <button type="button" className={secondary} disabled={recording} onClick={() => playback.playRecording(url)}>听我的录音</button>}</div>}
    {count > 0 && <p className="text-sm text-ink-2">这句练了 {count} 遍</p>}{save.message}
    <p className="text-sm text-ink-2">跟读不打分</p>
    {count > 0 && <button type="button" className={primary} disabled={recording || starting || save.failed} onClick={onNext}>下一个</button>}
  </div>;
}
