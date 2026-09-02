import { useCallback, useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api, type V2LearningSession } from '../lib/api';
import { handleAuthFailure } from '../lib/auth-store';
import { readToken } from '../lib/identity';
import { ROUTES } from '../routes.contract';
import { Button, Card, Notice, Screen, TopBar } from '../ui';

const SOURCE_LABEL: Record<string, string> = {
  teacher_list: '老师布置', level_gap: '每日新词',
};

type Phase = { s: 'loading' } | { s: 'error'; message: string } | { s: 'ready'; session: V2LearningSession };

export default function VocabularyCoachLearnPage() {
  const navigate = useNavigate();
  const [phase, setPhase] = useState<Phase>({ s: 'loading' });
  const [screen, setScreen] = useState<0 | 1>(0);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const startedAt = useRef(Date.now());

  const load = useCallback(async () => {
    const token = readToken();
    if (!token) return;
    setPhase({ s: 'loading' });
    try {
      const current = await api.vocabV2Daily(token);
      // Nest serializes a missing daily session as an empty 200 response.  The
      // shared client intentionally parses an empty success body as `{}`, so a
      // nullish-only check would mistake that object for a real session and the
      // render path would crash on `session.items.find(...)`.
      const session = current && Array.isArray(current.items)
        ? current
        : await api.vocabV2StartDaily(token);
      if (session.status === 'completed') {
        navigate(ROUTES.today, { replace: true });
        return;
      }
      setPhase({ s: 'ready', session });
      setScreen(0);
      startedAt.current = Date.now();
    } catch (error) {
      if (handleAuthFailure(error)) return;
      setPhase({ s: 'error', message: '今天的词汇任务暂时无法生成。系统不会用低质量词凑数，请稍后重试。' });
    }
  }, [navigate]);
  useEffect(() => { void load(); }, [load]);

  if (phase.s === 'loading') return <Screen><p className="text-center text-slate-500">正在按你的进度准备词汇…</p></Screen>;
  if (phase.s === 'error') return <Screen><Card><Notice kind="error">{phase.message}</Notice><Button onClick={() => void load()}>重试</Button></Card></Screen>;

  const session = phase.session;
  const item = session.items.find((candidate) => candidate.status === 'pending');
  const update = async (action: 'mastered' | 'normal' | 'hard' | 'skip') => {
    const token = readToken();
    if (!token || !item || busy) return;
    setBusy(true); setMessage(null);
    try {
      const next = await api.vocabV2LearnAction(token, { sessionId: session.id, itemId: item.id, action, responseMs: Date.now() - startedAt.current });
      if (next.status === 'completed') {
        navigate(ROUTES.today, { replace: true, state: { vocabTaskCreated: true } });
        return;
      }
      setPhase({ s: 'ready', session: next });
      setScreen(0); startedAt.current = Date.now();
    } catch (error) {
      if (handleAuthFailure(error)) return;
      setMessage('进度没有保存，请再试一次。');
    } finally { setBusy(false); }
  };
  const replace = async () => {
    const token = readToken();
    if (!token || !item || busy) return;
    setBusy(true); setMessage(null);
    try {
      const next = await api.vocabV2Replace(token, { sessionId: session.id, itemId: item.id });
      setPhase({ s: 'ready', session: next });
      setScreen(0); startedAt.current = Date.now();
      setMessage(`“${next.replacement.oldHeadword}”已标记为会，换成“${next.replacement.newHeadword}”。总数不变。`);
    } catch (error) {
      if (handleAuthFailure(error)) return;
      setMessage('没有找到符合等级和质量要求的新词，原词没有被移除。');
    } finally { setBusy(false); }
  };
  const speak = (text: string) => {
    if (!('speechSynthesis' in window)) return;
    speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = String(session.settings.audioAccent ?? 'en-GB');
    speechSynthesis.speak(utterance);
  };
  if (!item) return (
    <Screen center>
      <Card>
        <p className="text-center text-sm text-blue-600">{session.completed} / {session.target}</p>
        <h1 className="mt-3 text-center text-2xl font-semibold">今天的词都学完了</h1>
        <p className="mt-2 text-center text-sm text-slate-500">对应的单词测试已经自动加入首页待办。</p>
        {message ? <p role="status" className="mt-4 text-center text-sm text-slate-600">{message}</p> : null}
        <Button onClick={() => navigate(ROUTES.today, { replace: true })}>返回首页查看待办</Button>
      </Card>
    </Screen>
  );

  const card = item.card;
  return (
    <Screen>
      <TopBar title="今天的新词" onBack={() => navigate(ROUTES.vocab)} backLabel="我的单词" right={<span className="text-sm tabular-nums text-slate-500">{session.completed + 1} / {session.target}</span>} />
      <div className="mx-auto w-full max-w-4xl">
        <div className="mb-4 h-2 overflow-hidden rounded-full bg-slate-200"><div className="h-full rounded-full bg-blue-500 transition-all" style={{ width: `${((session.completed + screen / 2) / session.target) * 100}%` }} /></div>
        <Card>
          <div className="flex items-center justify-between"><span className="rounded-full bg-blue-50 px-3 py-1 text-xs font-medium text-blue-700">{SOURCE_LABEL[item.source] ?? item.source}</span><span className="text-xs text-slate-400">第 {item.masteryBefore} 阶段</span></div>
          {screen === 0 ? (
            <section className="mt-6">
              <p className="text-xs font-medium uppercase tracking-wider text-slate-400">先理解</p>
              <div className="mt-3 flex flex-wrap items-baseline gap-3"><h1 className="text-4xl font-semibold tracking-tight sm:text-5xl">{card.headword}</h1><button className="hit rounded-full bg-blue-50 px-3 text-blue-700" onClick={() => speak(card.audioText)} aria-label="播放发音">▶</button><span className="text-slate-500">{card.phonetic}</span></div>
              <p className="mt-5 text-xl">{card.pos}. {card.translation}</p><p className="mt-2 text-base leading-7 text-slate-600">{card.definition}</p>
              <div className="mt-5 rounded-2xl bg-slate-50 p-5"><p className="font-serif text-lg leading-8">{card.sentence}</p><p className="mt-3 text-sm leading-6 text-slate-500">{card.sentenceTranslation}</p></div>
            </section>
          ) : (
            <section className="mt-6">
              <p className="text-xs font-medium uppercase tracking-wider text-slate-400">在语境里理解</p>
              <h1 className="mt-3 text-3xl font-semibold">{card.headword}</h1>
              <div className="mt-5 rounded-2xl bg-slate-50 p-5"><p className="font-serif text-lg leading-8">{card.sentence}</p><p className="mt-3 text-sm leading-6 text-slate-500">{card.sentenceTranslation}</p></div>
              {card.imageUrl ? <img src={card.imageUrl} alt={`${card.headword} 的辅助图片`} className="mt-5 max-h-56 w-full rounded-2xl object-cover" /> : null}
              <div className="mt-5 grid gap-3 sm:grid-cols-2">
                <Connection label="常见搭配" value={card.collocations.join(' · ')} />
                <Connection label="词族" value={card.wordFamily.join(' · ')} />
                <Connection label="易混词" value={card.confusionWords.join(' · ')} />
                <Connection label="记忆提示" value={card.memoryHint ?? ''} />
              </div>
            </section>
          )}
          {message ? <p role="status" className="mt-4 text-sm text-slate-600">{message}</p> : null}
          {screen === 0 ? <button className="app-primary mt-7 w-full" onClick={() => setScreen(1)}>查看用法</button> : <button className="app-primary mt-7 w-full" disabled={busy} onClick={() => void update('normal')}>学完这个词</button>}
          <div className="mt-3 grid grid-cols-2 gap-2"><button className="min-h-[44px] text-sm text-slate-500" disabled={busy} onClick={() => void update('skip')}>稍后再学</button><button className="min-h-[44px] text-sm text-blue-600" disabled={busy} onClick={() => void replace()}>这个词我会了，换一个</button></div>
        </Card>
      </div>
    </Screen>
  );
}

function Connection({ label, value }: { label: string; value: string }) {
  return <div className="rounded-2xl bg-slate-50 p-4"><p className="text-xs font-medium text-slate-400">{label}</p><p className="mt-2 text-sm leading-6 text-slate-700">{value || '这一项暂时没有可靠内容'}</p></div>;
}
