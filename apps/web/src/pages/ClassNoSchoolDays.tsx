import { useEffect, useRef, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { api } from '../lib/api';

type Day = { id: string; date: string; reason: string | null };
export default function ClassNoSchoolDays() {
  const { classId = '' } = useParams();
  const [days, setDays] = useState<Day[]>([]);
  const [period, setPeriod] = useState('future');
  const [from, setFrom] = useState(''); const [to, setTo] = useState(''); const [reason, setReason] = useState('');
  const [loading, setLoading] = useState(true); const [busy, setBusy] = useState(false);
  const [error, setError] = useState(''); const [message, setMessage] = useState(''); const [reload, setReload] = useState(0);
  const saving = useRef(false);
  useEffect(() => {
    let active = true; setLoading(true); setError(''); setDays([]);
    api.classNoSchoolDays(classId, period).then((r) => { if (active) setDays(r); })
      .catch(() => { if (active) setError('暂时没能加载，请再试一次。'); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [classId, period, reload]);
  async function change(action: () => Promise<{ added?: number; removed?: number }>) {
    if (saving.current) return;
    saving.current = true; setBusy(true); setError(''); setMessage('');
    try { const result = await action(); setMessage(result.added !== undefined ? `已添加 ${result.added} 天，原有日期保留。` : '已删除。'); setReload((n) => n + 1); }
    catch { setError('没能保存，请检查日期后再试。'); }
    finally { saving.current = false; setBusy(false); }
  }
  const inputClass = 'min-h-12 w-full rounded-lg border border-slate-300 bg-white px-3 text-base text-slate-900 focus:outline-blue-600';
  return <main className="mx-auto max-w-3xl space-y-6 text-slate-900">
    <Link to="/classes" className="inline-flex min-h-12 items-center text-sm text-blue-700 hover:underline">返回班级</Link>
    <header className="space-y-3"><h1 className="text-2xl font-semibold leading-tight">停课日</h1><p className="max-w-prose text-sm leading-relaxed text-slate-600">停课当天不用做任务，也不会打断连续学习。已经做过的成绩会保留。</p></header>
    <form className="space-y-6 rounded-lg bg-white p-4 sm:p-6" onSubmit={(e) => { e.preventDefault(); if (from && to && to >= from) void change(() => api.addClassNoSchoolDays(classId, { from, to, reason })); else setError('请检查开始和结束日期。'); }}>
      <div className="grid gap-4 sm:grid-cols-2"><label className="space-y-2 text-sm text-slate-600"><span className="block">开始日期</span><input required type="date" value={from} onChange={(e) => { setFrom(e.target.value); if (!to) setTo(e.target.value); }} className={inputClass} /></label><label className="space-y-2 text-sm text-slate-600"><span className="block">结束日期</span><input required type="date" min={from} value={to} onChange={(e) => setTo(e.target.value)} className={inputClass} /></label></div>
      <label className="block space-y-2 text-sm text-slate-600"><span className="block">原因（选填）</span><input value={reason} maxLength={200} placeholder="如：期中考试" onChange={(e) => setReason(e.target.value)} className={inputClass} /></label>
      <button disabled={busy} className="min-h-12 rounded-lg bg-blue-700 px-6 text-sm font-semibold text-white hover:bg-blue-800 disabled:bg-slate-500">{busy ? '正在保存…' : '添加停课日'}</button>
    </form>
    {error && <div role="alert" className="rounded-lg bg-red-50 p-4 text-sm text-red-900">{error}<button className="ml-4 min-h-12 underline" onClick={() => setReload((n) => n + 1)}>重新加载</button></div>}
    {message && <p role="status" className="text-sm text-green-900">{message}</p>}
    <section className="space-y-4"><div className="flex flex-wrap items-center justify-between gap-4"><h2 className="text-lg font-semibold">已安排的日期</h2><select aria-label="日期范围" value={period} onChange={(e) => setPeriod(e.target.value)} className="min-h-12 rounded-lg border border-slate-300 bg-white px-3 text-base"><option value="future">今天及以后</option><option value="past">过去</option><option value="all">全部</option></select></div>
      {loading ? <p role="status" className="py-8 text-slate-600">正在加载…</p> : !days.length ? <p className="rounded-lg bg-slate-50 p-8 text-slate-600">这段时间没有停课日。</p> : <ul className="divide-y divide-slate-200 rounded-lg bg-white px-4 sm:px-6">{days.map((d) => <li key={d.id} className="flex items-center justify-between gap-4 py-4"><div className="min-w-0 space-y-2"><p className="font-semibold tabular-nums">{d.date.slice(0, 10)}</p>{d.reason && <p className="break-all text-sm text-slate-600">{d.reason}</p>}</div><button disabled={busy} aria-label={`删除 ${d.date.slice(0, 10)}`} className="min-h-12 shrink-0 px-3 text-sm text-slate-600 hover:text-red-700 hover:underline" onClick={() => { if (window.confirm(`删除 ${d.date.slice(0, 10)} 的停课安排？`)) void change(() => api.removeClassNoSchoolDay(classId, d.date.slice(0, 10))); }}>删除</button></li>)}</ul>}
    </section>
  </main>;
}
