import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { api } from '../lib/api';

type State = 'not_started' | 'in_progress' | 'submitted' | 'marked' | 'not_assigned';
const labels: Record<State, string> = { not_started: '没开始', in_progress: '进行中', submitted: '已交', marked: '已批', not_assigned: '未安排' };
export type TodayReport = {
  classId: string; className: string; date: string; noSchoolDay: boolean;
  totals: { unfinished: number; pending: number; attention: number };
  students: Array<{ id: string; name: string; noSchoolDay: boolean; teachingDay: boolean; reading: State; words: State; test: State; reasons: string[]; pendingSubmissions: string[]; lowReadingDates?: string[]; lowTestDates?: string[]; warnings?: Array<{ id: string; title: string; body: string; createdAt: string }> }>;
};

export function reportDateContext(selected: string, now = new Date()) {
  const parts = new Intl.DateTimeFormat('en', { timeZone: 'Asia/Singapore', year: 'numeric', month: '2-digit', day: '2-digit' }).formatToParts(now);
  const part = (type: string) => parts.find((p) => p.type === type)!.value;
  const today = `${part('year')}-${part('month')}-${part('day')}`;
  const date = selected || today;
  const monday = (key: string) => {
    const d = new Date(`${key}T00:00:00Z`);
    d.setUTCDate(d.getUTCDate() - (d.getUTCDay() + 6) % 7);
    return d.toISOString().slice(0, 10);
  };
  return { label: date === today ? '今天' : `${Number(date.slice(5, 7))}月${Number(date.slice(8, 10))}日`, currentWeek: monday(date) === monday(today) };
}

// Calm school administration: neutral sans, one rounded family, slate + blue.
export default function ClassToday() {
  const { classId = '' } = useParams();
  const [date, setDate] = useState('');
  const [report, setReport] = useState<TodayReport | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [retry, setRetry] = useState(0);
  useEffect(() => {
    let active = true;
    setLoading(true); setError(''); setReport(null);
    api.classToday(classId, date || undefined).then((r) => { if (active) setReport(r); })
      .catch(() => { if (active) setError('暂时没能加载，请再试一次。'); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [classId, date, retry]);
  const { label: dayLabel, currentWeek } = reportDateContext(report?.date || date);
  return <main className="mx-auto max-w-3xl space-y-6 text-slate-900">
    <Link to="/classes" className="inline-flex min-h-12 items-center text-sm text-blue-700 hover:underline">返回班级</Link>
    <header className="flex flex-wrap items-end justify-between gap-4">
      <div className="space-y-2"><p className="text-sm text-slate-600">{report?.className || '班级学习'}</p><h1 className="text-2xl font-semibold leading-tight">{dayLabel}该找谁</h1></div>
      <label className="space-y-2 text-sm text-slate-600"><span className="block">查看日期</span><input aria-label="查看日期" type="date" value={date || report?.date || ''} onChange={(e) => setDate(e.target.value)} className="min-h-12 max-w-full rounded-lg border border-slate-300 bg-white px-3 text-base text-slate-900 focus:outline-blue-600" /></label>
    </header>
    {loading && <p role="status" className="py-8 text-slate-600">正在加载…</p>}
    {error && <div role="alert" className="space-y-3 rounded-lg bg-red-50 p-4 text-red-900"><p>{error}</p><button className="min-h-12 rounded-lg border border-red-300 px-4 text-sm" onClick={() => setRetry((n) => n + 1)}>重新加载</button></div>}
    {report && <>
      {report.noSchoolDay && <p className="rounded-lg bg-blue-50 p-4 text-blue-900">{dayLabel}停课。其他班还有课的同学，仍按自己的安排学习。</p>}
      <p className="text-lg leading-relaxed">{dayLabel}还没做完 <strong className="font-semibold tabular-nums">{report.totals.unfinished}</strong> 人 · 待批 <strong className="font-semibold tabular-nums">{report.totals.pending}</strong> 份 · 需要关注 <strong className="font-semibold tabular-nums">{report.totals.attention}</strong> 人</p>
      {!report.students.length ? <div className="space-y-3 rounded-lg bg-slate-50 p-8"><p>这个班还没有学生。</p><Link to="/classes" className="inline-flex min-h-12 items-center text-blue-700 underline">去班级页添加学生</Link></div> : <ul className="divide-y divide-slate-200 rounded-lg bg-white px-4 sm:px-6">
        {report.students.map((s) => <li key={s.id} className="flex flex-col gap-3 py-6 lg:flex-row lg:items-center lg:justify-between lg:gap-6">
          <div className="min-w-0 flex-1 space-y-3">
            <Link to={`/learning-report?classId=${encodeURIComponent(classId)}&week=${report.date}&studentId=${encodeURIComponent(s.id)}#stu-${encodeURIComponent(s.id)}`} className="inline-flex min-h-12 items-center break-all text-lg font-semibold text-blue-700 hover:underline">{s.name}</Link>
            <div className="flex flex-wrap gap-2 text-sm">
              {s.noSchoolDay && <span className="rounded bg-blue-50 px-3 py-2 text-blue-900">{dayLabel}停课</span>}
              {!s.teachingDay && !s.noSchoolDay && <span className="rounded bg-slate-100 px-3 py-2 text-slate-700">{dayLabel}不用上课</span>}
              {s.reasons.map((reason) => {
                const sourceDate = reason.includes('阅读得分低于') ? s.lowReadingDates?.[0] : reason.includes('单词测试正确率低于') ? s.lowTestDates?.[0] : report.date;
                if (reason === '这周收到过提醒' && s.warnings?.length) return <a key={reason} href={`#warnings-${s.id}`} onClick={() => document.getElementById(`warnings-${s.id}`)?.setAttribute('open', '')} className="inline-flex min-h-12 items-center rounded bg-amber-100 px-3 py-2 text-amber-900 hover:underline">{reason}</a>;
                const href = reason === '这周收到过提醒' ? `#warnings-${s.id}` : reason.startsWith('待批') && s.pendingSubmissions[0] ? `/marker/submission/${encodeURIComponent(s.pendingSubmissions[0])}` : `/learning-report?classId=${encodeURIComponent(classId)}&week=${sourceDate || report.date}&studentId=${encodeURIComponent(s.id)}#stu-${encodeURIComponent(s.id)}`;
                return <Link key={reason} to={href} className="inline-flex min-h-12 items-center rounded bg-amber-100 px-3 py-2 text-amber-900 hover:underline">{reason}</Link>;
              })}
              {!s.reasons.length && s.teachingDay && <span className="rounded bg-green-100 px-3 py-2 text-green-900">{dayLabel}没有待办</span>}
            </div>
            {s.pendingSubmissions.map((id, i) => <Link key={id} to={`/marker/submission/${encodeURIComponent(id)}`} className="mr-4 inline-flex min-h-12 items-center text-sm text-blue-700 underline">批改第 {i + 1} 份答卷</Link>)}
            {Boolean(s.warnings?.length) && <details id={`warnings-${s.id}`} className="max-w-prose text-sm text-slate-600"><summary className="min-h-12 cursor-pointer py-3">{currentWeek ? '查看本周提醒' : '查看那一周的提醒'}</summary>{s.warnings!.map((w) => <div key={w.id} className="space-y-2 py-3"><p className="text-slate-900">{w.title}</p><p className="whitespace-pre-wrap break-words leading-relaxed">{w.body}</p><p>{new Date(w.createdAt).toLocaleString('zh-CN', { timeZone: 'Asia/Singapore' })}</p></div>)}</details>}
          </div>
          <div className="flex flex-wrap gap-x-6 gap-y-2 text-sm text-slate-600">
            {(['reading', 'words', 'test'] as const).map((key, i) => <span key={key}>{['阅读', '学新词', '单词测试'][i]} <span className="text-slate-900">{s.noSchoolDay && ['not_started', 'in_progress'].includes(s[key]) ? `${dayLabel}不用做` : labels[s[key]]}</span></span>)}
          </div>
        </li>)}
      </ul>}
    </>}
  </main>;
}
