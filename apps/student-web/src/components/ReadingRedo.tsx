import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react';
import { api, type MistakePracticeQueue, type MistakePracticeResult, type RedoFeedback } from '../lib/api';
import { handleAuthFailure } from '../lib/auth-store';
import { readToken } from '../lib/identity';
import { Button } from '../design/Button';
import { InlineStatus } from '../design/Status';

// Calm schoolwork: neutral surfaces, one primary action, short direct wording.
export function ReadingRedo({ children }: { children?: ReactNode }) {
  const [queue, setQueue] = useState<MistakePracticeQueue | null>(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const lock = useRef(false);
  const [answer, setAnswer] = useState('');
  const [hinted, setHinted] = useState(false);
  const [reference, setReference] = useState<RedoFeedback | null>(null);
  const [result, setResult] = useState<MistakePracticeResult | null>(null);
  const load = useCallback(async () => {
    const token = readToken();
    if (!token) return false;
    setError(''); setLoading(true);
    try { setQueue(await api.mistakePracticeQueue(token)); return true; }
    catch (e) { if (!handleAuthFailure(e)) setError('错题没能打开，请重试。'); return false; }
    finally { setLoading(false); }
  }, []);
  useEffect(() => { void load(); }, [load]);

  const item = queue?.items[0];
  const submit = async (selfCorrect?: boolean) => {
    const token = readToken();
    if (!token || !item || !queue || lock.current || !answer.trim()) return;
    lock.current = true; setBusy(true); setError('');
    try {
      if (item.practiceKind === 'self_check' && selfCorrect === undefined) {
        setReference(await api.mistakeReference(token, { id: item.id, date: queue.date, answer }));
      } else {
        setResult(await api.mistakePracticeResult(token, { id: item.id, date: queue.date, answer, hinted, ...(selfCorrect === undefined ? {} : { selfCorrect }) }));
      }
    } catch (e) { if (!handleAuthFailure(e)) setError('没能保存，请重试。答案还在。'); }
    finally { lock.current = false; setBusy(false); }
  };

  const next = async () => {
    if (lock.current) return;
    lock.current = true; setBusy(true);
    try {
      if (await load()) { setResult(null); setReference(null); setAnswer(''); setHinted(false); }
    } finally { lock.current = false; setBusy(false); }
  };

  // With no due mistakes the result page retains its existing continuation.
  if (queue?.target === 0 && !error) return <>{children}</>;

  return <section aria-label="今天的错题" className="mt-6 space-y-4 text-base leading-relaxed">
    <h2 className="text-xl font-semibold text-ink">今天的错题{queue ? `（${queue.target} 道）` : ''}</h2>
    {error ? <div role="alert"><InlineStatus tone="warning">{error}</InlineStatus></div> : null}
    {!queue ? loading ? <p role="status" className="text-ink-2">正在打开错题…</p> : <Button variant="secondary" busy={busy} onClick={() => void load()}>重新打开错题</Button>
      : !queue.unlocked ? <p className="text-ink-2">先交今天的阅读，再来做错题。</p>
      : result ? <div className="space-y-4">
        <p className="font-semibold text-ink">{result.correct ? (result.resolved ? '做对了，这道错题消掉了。' : '这次做对了，之后再独立试一次。') : '这次还没做对，之后再试。'}</p>
        <Feedback value={result} />
        <Button block busy={busy} onClick={() => void next()}>继续</Button>
      </div>
      : item ? <div className="space-y-4" key={item.id}>
        <p className="text-sm text-ink-2">已做 {queue.progress} / {queue.target} 道 · {item.passageTitle}</p>
        {item.passage ? <details className="rounded-control bg-fill p-4"><summary className="min-h-12 cursor-pointer font-semibold">阅读原文</summary><p className="max-w-prose whitespace-pre-wrap break-words text-ink">{item.passage}</p></details> : null}
        <p className="max-w-prose whitespace-pre-wrap break-words font-semibold text-ink">{item.stem}</p>
        {item.options.length ? <fieldset disabled={busy || !!reference} className="space-y-2"><legend className="sr-only">选择答案</legend>
          {item.options.map((option) => <label key={option.key} className={`flex min-h-12 cursor-pointer items-start gap-3 rounded-control p-3 ${answer === option.key ? 'bg-accent-soft text-accent' : 'bg-fill text-ink'}`}>
            <input type="radio" name={`redo-${item.id}`} value={option.key} checked={answer === option.key} onChange={() => setAnswer(option.key)} className="mt-1" />
            <span className="min-w-0 break-words">{option.key} {option.text === option.key ? '' : option.text}</span>
          </label>)}
        </fieldset> : <label className="block space-y-2"><span className="text-ink-2">写下你的答案</span>
          <textarea aria-label="写下你的答案" className="min-h-32 w-full rounded-control border border-control bg-surface p-3 text-base text-ink" value={answer} onChange={(e) => setAnswer(e.target.value)} disabled={busy || !!reference} maxLength={10000} autoComplete="off" autoCorrect="off" autoCapitalize="off" spellCheck={false} />
        </label>}
        {!reference ? <>
          <label className="flex min-h-12 items-center gap-3 text-sm text-ink-2"><input type="checkbox" checked={hinted} onChange={(e) => setHinted(e.target.checked)} />我刚才看了答案或提示</label>
          <Button block disabled={!answer.trim()} busy={busy} onClick={() => void submit()}>{item.practiceKind === 'self_check' ? '对照参考答案' : '提交答案'}</Button>
        </> : <div className="space-y-4"><Feedback value={reference} />
          <p className="text-ink-2">对照一下：你刚才写对了吗？</p>
          <div className="flex flex-wrap gap-3"><Button busy={busy} onClick={() => void submit(true)}>我写对了</Button><Button variant="secondary" busy={busy} onClick={() => void submit(false)}>还没对</Button></div>
        </div>}
      </div> : <><p className="text-ink-2">今天的错题做完了。</p>{children}</>}
    {error && queue ? <Button variant="plain" onClick={() => void load()}>重新打开错题</Button> : null}
  </section>;
}

export function Feedback({ value }: { value: RedoFeedback }) {
  return <div className="space-y-3 rounded-control bg-fill p-4 text-ink">
    <h3 className="font-semibold">参考答案</h3>
    <p className="max-w-prose whitespace-pre-wrap break-words">{value.answerModel || value.answerPoints.join('\n') || value.correctAnswer}</p>
    {value.markerComment ? <p className="max-w-prose whitespace-pre-wrap break-words">老师评语：{value.markerComment}</p> : null}
    {value.explanation ? <p className="max-w-prose whitespace-pre-wrap break-words">{value.explanation}</p> : null}
  </div>;
}
