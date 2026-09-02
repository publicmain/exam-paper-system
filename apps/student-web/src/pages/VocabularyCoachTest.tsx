import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { api, type V2TestSession } from '../lib/api';
import { handleAuthFailure } from '../lib/auth-store';
import { readToken } from '../lib/identity';
import { ROUTES } from '../routes.contract';
import { Button, Card, Notice, Screen, TopBar } from '../ui';

type Phase = { s: 'loading' } | { s: 'error'; message: string } | { s: 'ready'; session: V2TestSession };

export default function VocabularyCoachTestPage() {
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const sessionId = params.get('sessionId') ?? '';
  const [phase, setPhase] = useState<Phase>({ s: 'loading' });
  const [value, setValue] = useState('');
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const startedAt = useRef(Date.now());

  const load = useCallback(async () => {
    const token = readToken();
    if (!token || !sessionId) { setPhase({ s: 'error', message: '没有找到这份测试。' }); return; }
    try { setPhase({ s: 'ready', session: await api.vocabV2Test(token, sessionId) }); }
    catch (error) { if (handleAuthFailure(error)) return; setPhase({ s: 'error', message: '测试没有载入，请重试。' }); }
  }, [sessionId]);
  useEffect(() => { void load(); }, [load]);

  const session = phase.s === 'ready' ? phase.session : null;
  const item = useMemo(() => session?.items.find((candidate) => candidate.status !== 'answered') ?? null, [session]);
  const answer = async (response: string | number) => {
    const token = readToken();
    if (!token || !session || !item || busy) return;
    setBusy(true); setMessage(null);
    try {
      const next = await api.vocabV2Answer(token, { sessionId: session.id, itemId: item.id, response, responseMs: Date.now() - startedAt.current });
      setPhase({ s: 'ready', session: next }); setValue(''); startedAt.current = Date.now();
    } catch (error) { if (handleAuthFailure(error)) return; setMessage('这题没有保存，请重试。'); }
    finally { setBusy(false); }
  };
  const submit = async () => {
    const token = readToken();
    if (!token || !session || busy) return;
    setBusy(true); setMessage(null);
    try { setPhase({ s: 'ready', session: await api.vocabV2Submit(token, session.id) }); }
    catch (error) { if (handleAuthFailure(error)) return; setMessage('交卷失败，请重试。'); }
    finally { setBusy(false); }
  };
  const speak = (text: string) => {
    if (!('speechSynthesis' in window)) return;
    speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = 'en-GB';
    speechSynthesis.speak(utterance);
  };
  if (phase.s === 'loading') return <Screen><p className="text-center text-slate-500">正在恢复测试…</p></Screen>;
  if (phase.s === 'error') return <Screen><Card><Notice kind="error">{phase.message}</Notice><Button onClick={() => void load()}>重试</Button></Card></Screen>;
  if (session!.status === 'submitted') return (
    <Screen center>
      <Card>
        <p className="text-center text-sm text-blue-600">测试完成</p><h1 className="mt-3 text-center text-4xl font-semibold tabular-nums">{session!.correct} / {session!.total}</h1>
        <p className="mt-3 text-center text-sm text-slate-500">{session!.type === 'custom_test' ? '这是个人练习，不进入正式成绩，也不会生成后续任务。' : '这份每日单词测试已经完成并保存。'}</p>
        <button className="app-secondary mt-6 w-full" onClick={() => navigate(ROUTES.vocab)}>回到我的单词</button>
      </Card>
    </Screen>
  );
  if (!item) return <Screen center><Card><h1 className="text-center text-2xl font-semibold">所有题都答完了</h1><p className="mt-2 text-center text-sm text-slate-500">确认交卷后才会更新记忆计划。</p>{message ? <Notice kind="error">{message}</Notice> : null}<div className="mt-6"><Button disabled={busy} onClick={() => void submit()}>交卷</Button></div></Card></Screen>;

  const q = item.question;
  return (
    <Screen>
      <TopBar title={session!.type === 'custom_test' ? '自定义抽查' : `${formatTaskDate(session!.date)}`} onBack={() => navigate(ROUTES.vocab)} backLabel="退出" right={<span className="text-sm tabular-nums text-slate-500">{session!.answered + 1} / {session!.total}</span>} />
      <div className="mx-auto w-full max-w-3xl"><div className="mb-4 h-2 overflow-hidden rounded-full bg-slate-200"><div className="h-full rounded-full bg-blue-500" style={{ width: `${(session!.answered / session!.total) * 100}%` }} /></div>
        <Card>
          <p className="text-sm text-slate-500">{q.prompt}</p>
          <QuestionCue question={q} onSpeak={speak} />
          {q.options.length ? <div className="mt-6 grid gap-3">{q.options.map((option, index) => <button key={`${index}-${option}`} disabled={busy} onClick={() => void answer(index)} className="app-secondary min-h-[58px] px-5 text-left">{option}</button>)}</div> : <><textarea autoFocus value={value} onChange={(event) => setValue(event.target.value)} onKeyDown={(event) => { if (event.key === 'Enter' && !event.shiftKey && value.trim()) { event.preventDefault(); void answer(value); } }} placeholder={q.type === 'active_use' ? '写一个包含目标词的完整英文句子' : '输入答案'} autoCapitalize="none" autoCorrect="off" spellCheck={q.type === 'active_use'} rows={q.type === 'active_use' ? 3 : 1} className="mt-5 min-h-[58px] w-full resize-none border border-slate-300 bg-white px-4 py-3 text-lg" /><button className="app-primary mt-3 w-full" disabled={!value.trim() || busy} onClick={() => void answer(value)}>提交这题</button></>}
          {message ? <p role="alert" className="mt-4 text-sm text-rose-600">{message}</p> : null}
        </Card>
      </div>
    </Screen>
  );
}

function formatTaskDate(date: string) {
  const [, month, day] = date.split('-').map(Number);
  return `${month}月${day}日单词测试`;
}

function QuestionCue({ question: q, onSpeak }: { question: V2TestSession['items'][number]['question']; onSpeak: (text: string) => void }) {
  if (q.type === 'meaning_choice') return <h1 className="mt-5 text-4xl font-semibold">{q.prompt}</h1>;
  if (q.type === 'spelling') return <div className="mt-5 rounded-2xl bg-slate-50 p-5"><p className="text-2xl font-semibold">{q.cue.pos}. {q.cue.translation}</p><button className="mt-3 min-h-[44px] text-sm text-blue-600" onClick={() => onSpeak(q.cue.audioText)}>▶ 播放发音</button></div>;
  if (q.type === 'word_choice') return <div className="mt-5 rounded-2xl bg-slate-50 p-5 text-2xl font-semibold">{q.cue.pos}. {q.cue.translation}</div>;
  if (q.type === 'cloze') return <div className="mt-5 rounded-2xl bg-slate-50 p-5"><p className="font-serif text-xl leading-8">{q.cue.sentence}</p>{q.cue.translation ? <p className="mt-2 text-sm text-slate-500">{q.cue.translation}</p> : null}</div>;
  if (q.type === 'listening_spelling') return <button className="app-secondary mt-5 w-full" onClick={() => onSpeak(q.cue.audioText)}>▶ 播放发音</button>;
  if (q.type === 'active_use') return <div className="mt-5 rounded-2xl bg-slate-50 p-5"><p className="text-3xl font-semibold">{q.cue.headword}</p><p className="mt-2 text-slate-500">{q.cue.translation}</p></div>;
  if (q.type === 'collocation') return <div className="mt-5 text-3xl font-semibold">{q.cue.headword}</div>;
  return <div className="mt-5 rounded-2xl bg-slate-50 p-5"><p className="text-3xl font-semibold">{q.cue.headword}</p><p className="mt-2 text-sm text-slate-500">写出另一个词族成员（{q.cue.pos}）</p></div>;
}
