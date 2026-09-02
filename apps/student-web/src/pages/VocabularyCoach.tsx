import { useCallback, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api, type V2Center, type V2Overview } from '../lib/api';
import { handleAuthFailure } from '../lib/auth-store';
import { readToken } from '../lib/identity';
import { ROUTES } from '../routes.contract';
import { Button, Card, Notice, Screen, TopBar } from '../ui';

const SOURCE_LABEL: Record<string, string> = {
  reading_lookup: '阅读中加入', search: '主动查词加入', teacher_list: '老师布置', level_gap: '每日新词',
};

const STAGE_LABEL: Record<string, string> = {
  '': '生词本中的全部单词', new: '待学习', learning: '学习中', mastered: '已掌握但仍保留', removed: '已经移出',
};

type Phase = { s: 'loading' } | { s: 'error'; message: string } | { s: 'ready'; data: V2Center; overview: V2Overview };

export default function VocabularyCoachPage() {
  const navigate = useNavigate();
  const [phase, setPhase] = useState<Phase>({ s: 'loading' });
  const [query, setQuery] = useState('');
  const [stage, setStage] = useState('');
  const [source, setSource] = useState('');
  const [message, setMessage] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [confirmRemove, setConfirmRemove] = useState<string | null>(null);
  const [testCount, setTestCount] = useState<5 | 10 | 20 | 'all'>(10);
  const [dictionaryQuery, setDictionaryQuery] = useState('');
  const [dictionaryResult, setDictionaryResult] = useState<Awaited<ReturnType<typeof api.vocabV2Collect>>['sense'] | null>(null);

  const load = useCallback(async () => {
    const token = readToken();
    if (!token) return;
    setPhase({ s: 'loading' });
    try {
      const [data, overview] = await Promise.all([
        api.vocabV2Center(token, { q: query, stage, source }), api.vocabV2Overview(token),
      ]);
      setPhase({ s: 'ready', data, overview });
    } catch (error) {
      if (handleAuthFailure(error)) return;
      setPhase({ s: 'error', message: '我的单词暂时没有载入，请检查网络后重试。' });
    }
  }, [query, source, stage]);

  useEffect(() => { void load(); }, [load]);

  const lookUp = async (action: 'lookup_only' | 'learn' | 'known' | 'later' = 'lookup_only') => {
    const token = readToken();
    if (!token || !dictionaryQuery.trim() || busy) return;
    setBusy(true); setMessage(null);
    try {
      const result = await api.vocabV2Collect(token, { headword: dictionaryQuery.trim(), action, source: 'search' });
      setDictionaryResult(result.sense);
      setMessage(action === 'learn' ? '已加入我的单词。' : action === 'known' ? '已标记为会，以后不会作为新词推送。' : action === 'later' ? '已加入我的单词，之后可以再学。' : null);
      if (action !== 'lookup_only') await load();
    } catch (error) {
      if (handleAuthFailure(error)) return;
      setMessage('没有查到可靠翻译，请检查拼写或稍后再试。');
    } finally { setBusy(false); }
  };

  const startPractice = async () => {
    const token = readToken();
    if (!token || busy) return;
    setBusy(true); setMessage(null);
    try {
      const session = await api.vocabV2CustomTest(token, { count: testCount, scope: 'all' });
      navigate(`${ROUTES.coachTest}?sessionId=${encodeURIComponent(session.id)}`);
    } catch (error) {
      if (handleAuthFailure(error)) return;
      setMessage('生词本里还没有足够的单词可以抽查。');
      setBusy(false);
    }
  };

  const openPendingTest = async (task: V2Overview['pendingTests'][number]) => {
    const token = readToken();
    if (!token || busy) return;
    setBusy(true);
    try {
      const test = task.testSessionId ? { id: task.testSessionId } : await api.vocabV2StartTest(token, task.dailySessionId);
      navigate(`${ROUTES.coachTest}?sessionId=${encodeURIComponent(test.id)}`);
    } catch (error) {
      if (handleAuthFailure(error)) return;
      setMessage('这份单词测试暂时打不开，请重试。');
      setBusy(false);
    }
  };

  const setMembership = async (senseId: string, inNotebook: boolean) => {
    const token = readToken();
    if (!token || busy) return;
    setBusy(true); setMessage(null);
    try {
      await api.vocabV2SetMembership(token, senseId, inNotebook);
      setConfirmRemove(null);
      setMessage(inNotebook ? '已重新加入我的单词。' : '已移出。系统保留学习记录，但不会再把它当作新词推送。');
      await load();
    } catch (error) {
      if (handleAuthFailure(error)) return;
      setMessage('操作没有保存，请重试。');
    } finally { setBusy(false); }
  };

  if (phase.s === 'loading') return <Screen><p className="text-center text-slate-500">正在整理我的单词…</p></Screen>;
  if (phase.s === 'error') return <Screen><Card><Notice kind="error">{phase.message}</Notice><Button onClick={() => void load()}>重试</Button></Card></Screen>;

  const { data, overview } = phase;
  const today = overview.today;
  return (
    <Screen>
      <TopBar title="我的单词" onBack={() => navigate(ROUTES.today)} backLabel="首页" />
      {message ? <p role="status" className="mb-4 rounded-2xl bg-blue-50 px-4 py-3 text-sm text-blue-800">{message}</p> : null}

      <section className="grid gap-3 sm:grid-cols-3" aria-label="单词统计">
        <Metric label="生词本" value={data.stats.total} note="目前保留的单词" />
        <Metric label="累计学过" value={data.stats.totalLearned} note="移出后也保留历史" />
        <Metric label="已经移出" value={data.stats.removed} note="不会作为新词推送" />
      </section>

      <section className="mt-4 grid gap-4 lg:grid-cols-[1.05fr_.95fr]">
        <Card>
          <h2 className="text-lg font-semibold">每日新词</h2>
          <p className="mt-1 text-sm leading-6 text-slate-600">每天只生成没有学过的新词。学完后，服务器会自动创建一份按日期保存的测试待办。</p>
          <button className="app-primary mt-5 w-full px-5" onClick={() => navigate(ROUTES.coachLearn)}>
            {!today ? '开始今日新词' : today.status === 'completed' ? '今日新词已学完' : `继续学习 ${today.completed} / ${today.target}`}
          </button>
        </Card>
        <Card>
          <h2 className="text-lg font-semibold">自定义抽查</h2>
          <p className="mt-1 text-sm text-slate-600">系统从生词本随机抽取，只是个人练习，不记正式成绩。</p>
          <div className="mt-4 grid grid-cols-4 gap-2">
            {([5, 10, 20, 'all'] as const).map((count) => <button key={count} aria-pressed={testCount === count} onClick={() => setTestCount(count)} className={`hit rounded-xl border text-sm ${testCount === count ? 'border-blue-500 bg-blue-50 text-blue-700' : 'border-slate-200 bg-white'}`}>{count === 'all' ? '全部' : count}</button>)}
          </div>
          <button className="app-secondary mt-3 w-full" disabled={busy || data.stats.total === 0} onClick={() => void startPractice()}>开始随机抽查</button>
        </Card>
      </section>

      {(overview.learningBacklog ?? []).length ? <Card><h2 className="text-lg font-semibold">新词补做</h2><p className="mt-1 text-sm text-slate-600">每一天的词包单独保留，从上次停下的位置继续。</p><div className="mt-4 grid gap-2 sm:grid-cols-2">{(overview.learningBacklog ?? []).map((task) => <button key={task.sessionId} onClick={() => navigate(`${ROUTES.coachLearn}?date=${encodeURIComponent(task.date)}`)} className="app-secondary flex min-h-[58px] items-center justify-between px-4 text-left"><span>{shortDate(task.date)}新词 · {task.completed}/{task.target}</span><span className="text-[#007aff]">{task.status === 'in_progress' ? '继续' : '开始'} →</span></button>)}</div></Card> : null}

      {overview.pendingTests.length ? <Card><h2 className="text-lg font-semibold">测试待办</h2><p className="mt-1 text-sm text-slate-600">没有截止时间。多天未完成时，每一天都单独保留。</p><div className="mt-4 grid gap-2 sm:grid-cols-2">{overview.pendingTests.map((task) => <button key={task.dailySessionId} disabled={busy} onClick={() => void openPendingTest(task)} className="app-secondary flex min-h-[58px] items-center justify-between px-4 text-left"><span>{taskDate(task.date)} · {task.total} 题</span><span className="text-[#007aff]">{task.status === 'in_progress' ? '继续' : '开始'} →</span></button>)}</div></Card> : null}

      <Card>
        <div className="grid gap-3 sm:grid-cols-[1fr_auto] sm:items-end"><div><h2 className="text-lg font-semibold">查词并自由选择</h2><p className="mt-1 text-sm text-slate-600">查询不会自动收藏。阅读文章里点击单词时也使用同一份数据库。</p></div><div className="flex min-w-0 gap-2"><input value={dictionaryQuery} onChange={(event) => setDictionaryQuery(event.target.value)} onKeyDown={(event) => { if (event.key === 'Enter') void lookUp(); }} placeholder="输入英文单词" className="min-h-[48px] min-w-0 flex-1 border border-slate-200 bg-white px-4 sm:w-72" /><button className="app-primary px-5" disabled={!dictionaryQuery.trim() || busy} onClick={() => void lookUp()}>查询</button></div></div>
        {dictionaryResult ? <div className="mt-4 rounded-2xl bg-slate-50 p-4"><div className="flex flex-wrap items-baseline gap-2"><span className="text-2xl font-semibold">{dictionaryResult.headword}</span><span className="text-sm text-slate-500">{dictionaryResult.phonetic}</span></div><p className="mt-2">{dictionaryResult.pos}. {dictionaryResult.translation}</p>{dictionaryResult.definition ? <p className="mt-1 text-sm text-slate-500">{dictionaryResult.definition}</p> : null}<div className="mt-4 grid grid-cols-2 gap-2 lg:grid-cols-4"><button className="app-primary" onClick={() => void lookUp('learn')}>加入我的单词</button><button className="app-secondary" onClick={() => void lookUp('known')}>我已经会了</button><button className="app-secondary" onClick={() => void lookUp('later')}>稍后再学</button><button className="app-secondary" onClick={() => { setDictionaryResult(null); setDictionaryQuery(''); }}>只查一下</button></div></div> : null}
      </Card>

      <Card>
        <div className="grid gap-3 sm:grid-cols-[1fr_220px_220px]"><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="搜索我的单词" className="min-h-[48px] border border-slate-200 bg-white px-4" /><select value={stage} onChange={(event) => setStage(event.target.value)} className="min-h-[48px] border border-slate-200 bg-white px-3">{Object.entries(STAGE_LABEL).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select><select value={source} onChange={(event) => setSource(event.target.value)} className="min-h-[48px] border border-slate-200 bg-white px-3"><option value="">全部来源</option>{data.filters.sources.filter((value) => SOURCE_LABEL[value]).map((value) => <option key={value} value={value}>{SOURCE_LABEL[value]}</option>)}</select></div>
        <p className="mt-3 text-sm text-slate-500">共 {data.total} 个单词</p>
        {data.items.length ? <ul className="mt-3 divide-y divide-slate-100">{data.items.map((item) => <li key={item.studentSenseId} className="py-4 lg:grid lg:grid-cols-[.8fr_1.25fr_auto] lg:items-center lg:gap-5"><div><span className="text-lg font-semibold">{item.headword}</span> <span className="text-sm text-slate-400">{item.phonetic}</span><p className="text-sm text-slate-700">{item.pos}. {item.translation}</p></div><div className="mt-2 text-sm leading-6 text-slate-500 lg:mt-0"><p>{item.context?.sentence || item.definition}</p>{item.context?.translation ? <p>{item.context.translation}</p> : null}<p className="mt-1 text-xs">{SOURCE_LABEL[item.source] ?? '我的单词'}</p></div><div className="mt-3 flex items-center gap-2 lg:mt-0 lg:justify-end">{item.inNotebook ? confirmRemove === item.senseId ? <><button className="app-secondary px-3 text-sm text-rose-600" disabled={busy} onClick={() => void setMembership(item.senseId, false)}>确认移出</button><button className="hit px-2 text-sm text-slate-500" onClick={() => setConfirmRemove(null)}>取消</button></> : <button className="hit px-3 text-sm text-blue-600" onClick={() => setConfirmRemove(item.senseId)}>我会了，移出</button> : <button className="app-secondary px-3 text-sm text-blue-600" disabled={busy} onClick={() => void setMembership(item.senseId, true)}>重新学习</button>}</div></li>)}</ul> : <p className="mt-5 rounded-2xl bg-slate-50 px-4 py-5 text-sm text-slate-500">这个范围还没有单词。</p>}
      </Card>
    </Screen>
  );
}

function Metric({ label, value, note }: { label: string; value: number; note: string }) {
  return <div className="app-glass rounded-[20px] px-5 py-4"><p className="text-sm text-slate-500">{label}</p><p className="mt-1 text-3xl font-semibold tabular-nums">{value}</p><p className="mt-1 text-xs text-slate-400">{note}</p></div>;
}

function taskDate(date: string) {
  return `${shortDate(date)}单词测试`;
}

function shortDate(date: string) {
  const [, month, day] = date.split('-').map(Number);
  return `${month}月${day}日`;
}
