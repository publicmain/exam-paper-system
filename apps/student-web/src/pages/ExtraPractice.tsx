import { useEffect, useMemo, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { api, ApiError } from '../lib/api';
import { getState, handleAuthFailure } from '../lib/auth-store';
import { readToken } from '../lib/identity';
import { timeBucket, type ExtraDrill, type ExtraRound } from '../lib/extra-practice';
import { ROUTES } from '../routes.contract';
import { Page } from '../design/Page';
import { SentenceAudioProvider } from '../lesson/shared/SentenceAudio';
import { BlocksExercise, ShadowExercise, SpellingExercise, primary, secondary } from '../components/extra/Exercises';
import { pendingExtraResults, queueExtraResult } from '../components/extra/result-queue';
import { syncExtraFor } from '../components/extra/ExtraPracticeSync';

const labels: Record<ExtraDrill, string> = { type: '拼写打字', ladder: '造句阶梯', shadow: '跟读' };
export default function ExtraPracticePage() {
  const [round, setRound] = useState<ExtraRound | null>(null);
  const [look, setLook] = useState(true);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(false);
  const [closed, setClosed] = useState(false);
  const [index, setIndex] = useState(0); const [stepIndex, setStepIndex] = useState(0);
  const [pending, setPending] = useState(0);
  const attempts = useRef<Record<string, number>>({});
  const firstCorrect = useRef<Record<string, boolean>>({});
  const started = useRef(Date.now()); const request = useRef(0);
  const active = useRef(true); const nextLock = useRef(false);
  const auth = getState(); const owner = auth.status === 'authenticated' ? auth.profile.id : '';
  const item = round?.items[index]; const step = item?.steps[stepIndex];
  const audio = useMemo(() => item?.text && item.audioUrl ? [{ passage: item.text, paragraphs: [[{ text: item.text, audioUrl: item.audioUrl }]] }] : [], [item]);
  useEffect(() => { active.current = true; return () => { active.current = false; request.current++; }; }, []);
  useEffect(() => {
    const update = () => { try { setPending(owner ? pendingExtraResults(owner) : 0); } catch { /* Exercise reports storage errors at the point of saving. */ } };
    update(); window.addEventListener('extra-results-changed', update);
    return () => window.removeEventListener('extra-results-changed', update);
  }, [owner]);
  async function load(drill: ExtraDrill, visible = true) {
    const token = readToken(); if (!token || loading || !owner) return;
    const id = ++request.current; setLoading(true); setError(false); setLook(visible);
    try {
      const data = await api.extraPracticeRound(token, drill);
      if (!active.current || id !== request.current) return;
      attempts.current = {}; firstCorrect.current = {}; started.current = Date.now();
      setRound(data); setIndex(0); setStepIndex(0);
    } catch (e) {
      if (!active.current || id !== request.current || handleAuthFailure(e)) return;
      if (e instanceof ApiError && e.status === 404) setClosed(true); else setError(true);
    } finally { if (active.current && id === request.current) setLoading(false); }
  }
  function record(isCorrect: boolean | null, hinted: boolean) {
    if (!round || !item || !step || !owner) throw new Error('extra_item_missing');
    const current = getState(); if (current.status !== 'authenticated' || current.profile.id !== owner) throw new Error('extra_owner_changed');
    const key = `${index}:${step.step}`; const number = attempts.current[key] ?? 0;
    queueExtraResult(owner, { roundId: round.roundId, roundToken: round.roundToken, drill: round.drill,
      ...(item.senseId ? { senseId: item.senseId } : { textHash: item.textHash }), step: step.step,
      attempt: number === 0 ? 'first' : 'retry', ...(number ? { retryN: number } : {}), isCorrect, hinted,
      timeBucket: timeBucket(Date.now() - started.current) });
    if (number === 0) firstCorrect.current[key] = isCorrect === true && !hinted;
    attempts.current[key] = number + 1; started.current = Date.now();
    // Upload is separate from the successful durable save, including any
    // synchronous failure while starting a background flush.
    void Promise.resolve().then(() => syncExtraFor(owner)).catch(() => {});
  }
  function next() {
    if (nextLock.current || !item) return; nextLock.current = true;
    if (stepIndex + 1 < item.steps.length) setStepIndex(s => s + 1);
    else { setIndex(i => i + 1); setStepIndex(0); }
    started.current = Date.now();
  }
  useEffect(() => { nextLock.current = false; }, [index, stepIndex]);
  const complete = round && round.items.length > 0 && index >= round.items.length;
  const once = round?.items.filter((i, at) => i.steps.every(s => firstCorrect.current[`${at}:${s.step}`])).length ?? 0;
  return <Page title={<span className="text-2xl font-semibold">加练（选做）</span>} leading={<Link to={ROUTES.today} className="inline-flex min-h-12 items-center text-base text-accent underline">回到今天</Link>}>
    <div className="mx-auto max-w-prose space-y-6 pb-8 text-ink" data-testid="extra-practice-page">
      <p className="text-sm text-ink-2">加练不影响今天的必做任务</p>
      {closed ? <p role="status" className="text-base text-ink-2">加练暂时没开放</p> : !round || complete ? <>
        {complete && <div role="status" className="space-y-2 rounded-group bg-surface p-6"><h2 className="text-xl font-semibold">这一轮练完了</h2>
          <p className="text-base">{round.drill === 'shadow' ? `练了 ${round.items.length} 句` : `练了 ${round.items.length} 个，一次就对 ${once} 个`}</p></div>}
        <p className="text-base text-ink-2">每轮约 3–5 分钟，想练哪种就点哪种</p>
        <div className="grid gap-3 sm:grid-cols-2">
          <button type="button" className={secondary} disabled={loading} onClick={() => void load('type', true)}>拼写打字</button>
          <button type="button" className={secondary} disabled={loading} onClick={() => void load('type', false)}>听写</button>
          <button type="button" className={secondary} disabled={loading} onClick={() => void load('ladder')}>造句阶梯</button>
          <button type="button" className={secondary} disabled={loading} onClick={() => void load('shadow')}>跟读</button>
        </div>
        {loading && <p role="status" className="text-base text-ink-2">正在准备…</p>}
        {error && <p role="alert" className="text-base text-danger">没打开，再点一次试试</p>}
      </> : round.items.length === 0 ? <div className="space-y-4"><p className="text-base text-ink-2">暂时没有合适的内容，学完新词或阅读后再来看看</p>
        <button type="button" className={primary} onClick={() => setRound(null)}>换一种练习</button></div> : item && step ? <>
        <div className="flex flex-wrap items-baseline justify-between gap-4"><h2 className="text-xl font-semibold">{labels[round.drill]}{round.drill === 'type' ? look ? ' · 看词打' : ' · 听写' : ''}</h2>
          <p className="text-sm tabular-nums text-ink-2">{index + 1} / {round.items.length}{round.drill === 'ladder' ? ` · 第 ${step.step} 步` : ''}</p></div>
        <section className="rounded-group bg-surface p-6" key={`${round.roundId}:${index}:${stepIndex}`}>
          {round.drill === 'shadow' ? <SentenceAudioProvider passages={audio}><ShadowExercise step={step} onAttempt={record} onNext={next} /></SentenceAudioProvider> :
            round.drill === 'ladder' && step.step === 3 ? <BlocksExercise step={step} onAttempt={record} onNext={next} /> :
              <SpellingExercise step={step} look={round.drill === 'type' && look} onAttempt={record} onNext={next} />}
        </section>
      </> : null}
      {pending > 0 && <div role="status" className="space-y-2 text-sm text-ink-2"><p>还有 {pending} 条没传好，联网后会补上</p>
        <button type="button" className={secondary} onClick={() => { void syncExtraFor(owner).catch(() => {}); }}>重试上传</button></div>}
    </div>
  </Page>;
}
