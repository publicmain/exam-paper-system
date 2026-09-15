import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { api } from '../lib/api';

/**
 * 学习周报（2026-09-15）。
 *
 * 老师和学校领导打开就能回答：**这一周谁做了、谁没做、做得怎么样、该找谁**。
 * 以前这件事是每周一跑一次只读查询、出一份 PDF；现在后台里实时看。
 *
 *   · 选全部班级或某个班，按周翻（周一到周日）；选择记在网址里，链接发给别人打开是同一个视图；
 *   · 顶部总数 → 每天 → 各班 / 各难度档 → 需要跟进的名单 → 逐人逐天；
 *   · 点学生名字展开他每天的明细；导出 Excel（CSV）、打印 / 存 PDF。
 *
 * 数字全部由服务端 `learning-report` 算好（口径见 `apps/api/src/learning-report/weekly-report.ts`），
 * 这一页只负责摆出来，不自己再算一遍。权限也在服务端：管理员 / 班主任看全校，任课老师只看自己的班。
 */

export type ReadingCell = 'done' | 'opened' | 'auto_closed' | 'missed' | 'today' | 'future' | 'not_assigned';

export interface ReportDayCell {
  date: string;
  reading: ReadingCell;
  readPct: number | null;
  awaitingMarking: boolean;
  title: string | null;
  paperLevel: string | null;
  submittedAt: string | null;
  learning: 'done' | 'partial' | 'none';
  learnItemsDone: number;
  learnItems: number;
  test: 'done' | 'none';
  testPct: number | null;
}

export interface ReportStudent {
  id: string;
  name: string;
  classId: string;
  className: string;
  level: string | null;
  registeredOn: string;
  days: ReportDayCell[];
  readN: number;
  readDue: number;
  learnN: number;
  learnPartial: number;
  testN: number;
  readAvg: number | null;
  readMarked: number;
  testAvg: number | null;
  awaitingMarking: number;
  zeroTests: number;
  none: boolean;
  readingNoWords: boolean;
  lowReading: boolean;
  steady: boolean;
  noLevel: boolean;
}

export interface BriefStudent {
  id: string;
  name: string;
  className: string;
  level: string | null;
  readN: number;
  readDue: number;
  readAvg: number | null;
  learnPartial: number;
  zeroTests: number;
  opened: number;
}

export interface WeeklyReport {
  weekStart: string;
  weekEnd: string;
  today: string;
  /** 这一周已经过完了没有；没过完时「整周没做」说成「到目前一项没做」 */
  weekComplete: boolean;
  generatedAt: string;
  scope: { classId: string | null; className: string | null };
  classes: Array<{ id: string; name: string }>;
  excluded: { demoAccounts: number; registeredAfter: number };
  days: Array<{
    date: string;
    dow: string;
    isToday: boolean;
    future: boolean;
    assigned: number | null;
    readDone: number | null;
    readAvg: number | null;
    readMarked: number;
    learnDone: number | null;
    testDone: number | null;
    testAvg: number | null;
  }>;
  totals: {
    students: number;
    joined: number;
    none: number;
    steady: number;
    readDone: number;
    readDue: number;
    readRate: number | null;
    readAvg: number | null;
    learnDone: number;
    testDone: number;
    testAvg: number | null;
    awaitingMarking: number;
  };
  byClass: Array<{
    classId: string;
    className: string;
    students: number;
    joined: number;
    none: number;
    readDone: number;
    readDue: number;
    readRate: number | null;
    testDaysAvg: number | null;
    readAvg: number | null;
  }>;
  byLevel: Array<{ level: string; students: number; due: number; done: number; readRate: number | null; readAvg: number | null; marked: number }>;
  followUps: {
    none: BriefStudent[];
    lowReading: BriefStudent[];
    readingNoWords: BriefStudent[];
    zeroTests: BriefStudent[];
    noLevel: BriefStudent[];
  };
  students: ReportStudent[];
}

/** 五档从易到难，与学生端 levels.ts 一致。 */
export const LEVEL_ORDER = ['ielts_simplified', 'olevel_intermediate', 'olevel', 'ielts_light', 'ielts_authentic'];
export const LEVEL_LABELS: Record<string, string> = {
  ielts_simplified: 'O-Level 基础',
  olevel_intermediate: 'O-Level 中级',
  olevel: 'O-Level 标准',
  ielts_light: '雅思轻量',
  ielts_authentic: '雅思 · 真题型',
};
export const levelLabel = (l: string | null | undefined) => (l ? LEVEL_LABELS[l] ?? l : '未选');

export function shiftWeek(weekStart: string, days: number): string {
  const d = new Date(`${weekStart}T00:00:00.000Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

const md = (key: string) => `${Number(key.slice(5, 7))}月${Number(key.slice(8, 10))}日`;
const mdShort = (key: string) => `${Number(key.slice(5, 7))}/${Number(key.slice(8, 10))}`;
export const weekLabel = (start: string, end: string) => `${md(start)} – ${md(end)}`;
const pct = (v: number | null | undefined) => (v == null ? '—' : `${v}%`);
const sgtTime = (iso: string | null) =>
  iso
    ? new Date(iso).toLocaleString('zh-CN', { timeZone: 'Asia/Singapore', month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit', hour12: false })
    : '';

export function readingText(c: ReportDayCell): string {
  switch (c.reading) {
    case 'done':
      return c.awaitingMarking ? '待判' : c.readPct == null ? '已交' : `${c.readPct}%`;
    case 'opened':
      return '没交';
    case 'auto_closed':
      return '系统收卷';
    case 'missed':
      return '没做';
    case 'today':
      return '今天';
    case 'future':
      return '';
    default:
      return '—';
  }
}

export function wordsText(c: ReportDayCell): string {
  const words = c.learning === 'done' ? '词✓' : c.learning === 'partial' ? `词${c.learnItemsDone}/${c.learnItems}` : '';
  const test = c.test === 'done' ? `测${c.testPct ?? ''}` : '';
  return [words, test].filter(Boolean).join(' ');
}

const CELL_STYLE: Record<ReadingCell, string> = {
  done: 'bg-green-50 text-green-700',
  opened: 'bg-amber-50 text-amber-700',
  auto_closed: 'bg-amber-50 text-amber-700',
  missed: 'bg-red-50 text-red-600',
  today: 'text-gray-500',
  future: 'text-gray-300',
  not_assigned: 'text-gray-300',
};

/** Excel 直接打开的 CSV（带 BOM）。姓名以 = + - @ 开头时加前缀，防止被当成公式执行。 */
export function reportCsv(r: WeeklyReport): string {
  const head = ['班级', '姓名', '难度档', '注册日期'];
  for (const d of r.days) head.push(`${d.dow}${mdShort(d.date)} 阅读`, `${d.dow} 单词`, `${d.dow} 单词测试`);
  head.push('交阅读', '应交阅读', '学完新词天数', '单词测试次数', '阅读平均得分率', '单词测试平均分', '整周没做');
  const rows = r.students.map((s) => {
    const row = [s.className, s.name, levelLabel(s.level), s.registeredOn];
    for (const c of s.days) {
      row.push(
        readingText(c),
        c.learning === 'done' ? '学完' : c.learning === 'partial' ? `${c.learnItemsDone}/${c.learnItems}` : '',
        c.test === 'done' ? (c.testPct == null ? '交了' : String(c.testPct)) : '',
      );
    }
    row.push(String(s.readN), String(s.readDue), String(s.learnN), String(s.testN), s.readAvg == null ? '' : `${s.readAvg}%`, s.testAvg == null ? '' : String(s.testAvg), s.none ? '是' : '');
    return row;
  });
  const cell = (v: string) => {
    const safe = /^[=+\-@]/.test(v) ? `'${v}` : v;
    return /[",\r\n]/.test(safe) ? `"${safe.replace(/"/g, '""')}"` : safe;
  };
  return '﻿' + [head, ...rows].map((row) => row.map(cell).join(',')).join('\r\n');
}

function downloadText(filename: string, text: string) {
  const blob = new Blob([text], { type: 'text/csv;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

function describeError(e: any): string {
  const code = e?.body?.code ?? e?.body?.message?.code;
  if (e?.status === 403 && code === 'not_your_class') return '这个班不是你任教的班，看不了。管理员和班主任可以看全校。';
  if (e?.status === 403 || e?.status === 401) return '没有权限看学习周报。请用老师、班主任或管理员账号登录。';
  return `没读到周报：${String(e?.message ?? e)}`;
}

export default function LearningReportPage() {
  const [params, setParams] = useSearchParams();
  const classId = params.get('classId') ?? '';
  const week = params.get('week') ?? '';
  const [report, setReport] = useState<WeeklyReport | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [openId, setOpenId] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const r = (await api.learningReportWeek({ weekStart: week || undefined, classId: classId || undefined })) as WeeklyReport;
      setReport(r);
    } catch (e) {
      setError(describeError(e));
    } finally {
      setLoading(false);
    }
  }, [week, classId]);

  useEffect(() => {
    void load();
  }, [load]);

  const update = (next: Record<string, string>) => {
    const p = new URLSearchParams(params);
    for (const [k, v] of Object.entries(next)) {
      if (v) p.set(k, v);
      else p.delete(k);
    }
    setParams(p, { replace: true });
  };

  const isCurrentWeek = Boolean(report && report.weekStart <= report.today && report.today <= report.weekEnd);
  const scopeName = report?.scope.className ?? '全部班级';

  const groups = useMemo(() => {
    const out: Array<{ className: string; students: ReportStudent[] }> = [];
    for (const s of report?.students ?? []) {
      const last = out[out.length - 1];
      if (last && last.className === s.className) last.students.push(s);
      else out.push({ className: s.className, students: [s] });
    }
    return out;
  }, [report]);

  const jumpTo = (id: string) => {
    setOpenId(id);
    requestAnimationFrame(() => document.getElementById(`stu-${id}`)?.scrollIntoView?.({ behavior: 'smooth', block: 'center' }));
  };

  const levels = useMemo(
    () => [...(report?.byLevel ?? [])].sort((a, b) => LEVEL_ORDER.indexOf(a.level) - LEVEL_ORDER.indexOf(b.level)),
    [report],
  );

  return (
    <div className="mx-auto max-w-7xl space-y-6" data-testid="learning-report">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-[#2D3B45]">学习周报</h1>
          <p className="mt-1 text-sm text-gray-500">
            {scopeName} · {report ? weekLabel(report.weekStart, report.weekEnd) : '—'}
            {report ? ` · 数据截至 ${sgtTime(report.generatedAt)}（新加坡时间）` : ''}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2 print:hidden">
          <button type="button" className="btn btn-ghost" onClick={() => void load()} disabled={loading}>
            {loading ? '正在读取…' : '刷新'}
          </button>
          <button
            type="button"
            className="btn btn-ghost"
            data-testid="export-csv"
            disabled={!report || !report.students.length}
            onClick={() => report && downloadText(`学习周报_${report.weekStart}_${scopeName}.csv`, reportCsv(report))}
          >
            导出 Excel
          </button>
          <button type="button" className="btn btn-ghost" onClick={() => window.print()} disabled={!report}>
            打印 / 存 PDF
          </button>
        </div>
      </header>

      <div className="flex flex-wrap items-center gap-3 print:hidden">
        <label className="text-sm text-gray-600">
          班级
          <select
            data-testid="class-select"
            value={classId}
            onChange={(e) => {
              setOpenId(null);
              update({ classId: e.target.value });
            }}
            className="ml-2 rounded-md border px-3 py-2"
          >
            <option value="">全部班级</option>
            {(report?.classes ?? []).map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
        </label>
        <div className="flex items-center gap-1">
          <button type="button" data-testid="prev-week" className="btn btn-ghost" disabled={!report} onClick={() => report && update({ week: shiftWeek(report.weekStart, -7) })}>
            ← 上一周
          </button>
          <span className="px-2 text-sm font-medium tabular-nums" data-testid="week-label">
            {report ? weekLabel(report.weekStart, report.weekEnd) : '—'}
          </span>
          <button type="button" data-testid="next-week" className="btn btn-ghost" disabled={!report || isCurrentWeek} onClick={() => report && update({ week: shiftWeek(report.weekStart, 7) })}>
            下一周 →
          </button>
          {report && !isCurrentWeek ? (
            <button type="button" className="btn btn-ghost" onClick={() => update({ week: '' })}>
              回到本周
            </button>
          ) : null}
        </div>
        <Link to="/lesson-board" className="text-sm text-blue-600 underline">
          只看今天的完成度
        </Link>
      </div>

      {error ? (
        <div role="alert" className="rounded border border-red-200 bg-red-50 p-3 text-sm text-red-700" data-testid="report-error">
          {error}
        </div>
      ) : null}

      {!report && loading ? <p className="text-sm text-gray-500">正在读取…</p> : null}

      {report && report.classes.length === 0 ? (
        <p className="card text-sm text-gray-600" data-testid="no-classes">
          你还没有任教的英语班。管理员和班主任可以看全校。
        </p>
      ) : null}

      {report && report.classes.length > 0 ? (
        <>
          <section className="grid grid-cols-2 gap-3 md:grid-cols-5" data-testid="totals">
            <Kpi label="在读学生" value={report.totals.students} />
            <Kpi label="做过至少一项" value={report.totals.joined} hint={report.totals.students ? `${Math.round((report.totals.joined / report.totals.students) * 100)}%` : undefined} />
            <Kpi label="阅读完成率" value={pct(report.totals.readRate)} hint={`交了 ${report.totals.readDone} / 应交 ${report.totals.readDue}`} />
            <Kpi label="单词测试" value={report.totals.testDone} hint={`学完新词 ${report.totals.learnDone} 次`} />
            <Kpi label={report.weekComplete ? '整周没做' : '本周到目前一项没做'} value={report.totals.none} tone={report.totals.none ? 'bad' : undefined} hint={report.totals.awaitingMarking ? `另有 ${report.totals.awaitingMarking} 份待判` : undefined} />
          </section>

          <section className="card overflow-x-auto" data-testid="daily">
            <h2 className="mb-2 font-semibold">每天</h2>
            <table className="w-full min-w-[640px] text-sm tabular-nums">
              <thead>
                <tr className="text-left text-xs text-gray-500">
                  <th className="py-1.5 pr-3" />
                  {report.days.map((d) => (
                    <th key={d.date} className={`py-1.5 text-right ${d.isToday ? 'text-blue-700' : ''}`}>
                      {d.dow}
                      <span className="ml-1 font-normal">{mdShort(d.date)}</span>
                      {d.isToday ? <span className="ml-1 font-normal">（今天）</span> : null}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                <DayRow label="交了阅读" days={report.days} render={(d) => (d.assigned == null ? '' : `${d.readDone} / ${d.assigned}`)} />
                <DayRow label="阅读平均得分率" days={report.days} render={(d) => (d.future ? '' : `${pct(d.readAvg)}${d.readMarked > 0 && d.readMarked < 5 ? `（${d.readMarked} 份）` : ''}`)} />
                <DayRow label="学完当天新词" days={report.days} render={(d) => (d.learnDone == null ? '' : String(d.learnDone))} />
                <DayRow label="单词测试" days={report.days} render={(d) => (d.testDone == null ? '' : String(d.testDone))} />
                <DayRow label="单词测试平均分" days={report.days} render={(d) => (d.future ? '' : pct(d.testAvg))} />
              </tbody>
            </table>
            <p className="mt-2 text-xs text-gray-500">「交了 / 应交」里的应交是分配到那天阅读的人数；补交的算在原来那天；今天的数字会随学生提交实时变化。</p>
          </section>

          <div className="grid gap-4 lg:grid-cols-2">
            {!report.scope.classId ? (
              <section className="card overflow-x-auto" data-testid="by-class">
                <h2 className="mb-2 font-semibold">各班</h2>
                <table className="w-full text-sm tabular-nums">
                  <thead>
                    <tr className="text-left text-xs text-gray-500">
                      <th className="py-1.5">班级</th>
                      <th className="py-1.5 text-right">在读</th>
                      <th className="py-1.5 text-right">做过</th>
                      <th className="py-1.5 text-right">阅读完成率</th>
                      <th className="py-1.5 text-right">人均词测</th>
                      <th className="py-1.5 text-right">阅读均分</th>
                      <th className="py-1.5 text-right">{report.weekComplete ? '整周没做' : '到目前没做'}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {report.byClass.map((c) => (
                      <tr key={c.classId} className="border-t">
                        <td className="py-1.5">
                          <button type="button" className="font-medium text-blue-700 hover:underline" onClick={() => update({ classId: c.classId })}>
                            {c.className}
                          </button>
                        </td>
                        <td className="py-1.5 text-right">{c.students}</td>
                        <td className="py-1.5 text-right">{c.joined}</td>
                        <td className="py-1.5 text-right">{pct(c.readRate)}</td>
                        <td className="py-1.5 text-right">{c.testDaysAvg ?? '—'}</td>
                        <td className="py-1.5 text-right">{pct(c.readAvg)}</td>
                        <td className={`py-1.5 text-right ${c.none ? 'font-semibold text-red-600' : ''}`}>{c.none || '—'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </section>
            ) : null}

            <section className="card overflow-x-auto" data-testid="by-level">
              <h2 className="mb-2 font-semibold">各难度档</h2>
              <table className="w-full text-sm tabular-nums">
                <thead>
                  <tr className="text-left text-xs text-gray-500">
                    <th className="py-1.5">难度档</th>
                    <th className="py-1.5 text-right">学生</th>
                    <th className="py-1.5 text-right">交了 / 应交</th>
                    <th className="py-1.5 text-right">完成率</th>
                    <th className="py-1.5 text-right">阅读均分</th>
                  </tr>
                </thead>
                <tbody>
                  {levels.map((l) => (
                    <tr key={l.level} className="border-t">
                      <td className="py-1.5">{levelLabel(l.level)}</td>
                      <td className="py-1.5 text-right">{l.students}</td>
                      <td className="py-1.5 text-right">
                        {l.done} / {l.due}
                      </td>
                      <td className="py-1.5 text-right">{pct(l.readRate)}</td>
                      <td className="py-1.5 text-right">{pct(l.readAvg)}</td>
                    </tr>
                  ))}
                  {!levels.length ? (
                    <tr>
                      <td colSpan={5} className="py-3 text-center text-gray-400">
                        这一周还没有阅读任务
                      </td>
                    </tr>
                  ) : null}
                </tbody>
              </table>
              <p className="mt-2 text-xs text-gray-500">按那份卷子的档位算：周中改过档的学生，卷子各归各档。</p>
            </section>
          </div>

          <section data-testid="follow-ups">
            <h2 className="mb-2 font-semibold">需要跟进</h2>
            <div className="grid gap-3 md:grid-cols-2">
              <FollowUp
                testId="followup-none"
                title={report.weekComplete ? '整周没做' : '本周到目前一项没做'}
                hint={report.weekComplete ? '这周有该交的阅读，但阅读、学词、词测一样都没做。' : '这周已经过去的日子里有该交的阅读，到现在一样都没做（今天的不算）。'}
                items={report.followUps.none}
                detail={(s) => (s.opened ? `打开过阅读 ${s.opened} 天` : '一次都没打开')}
                onPick={jumpTo}
              />
              <FollowUp
                testId="followup-low"
                title="阅读平均得分率低于 30%"
                hint="可能难度档偏高，建议复核后调档。"
                items={report.followUps.lowReading}
                detail={(s) => `${levelLabel(s.level)} · 交了 ${s.readN} 天 · 平均 ${pct(s.readAvg)}`}
                onPick={jumpTo}
              />
              <FollowUp
                testId="followup-nowords"
                title="交了阅读，单词一个没学"
                hint="连一部分都没学过，多半是单词页打不开或不知道要学，先问一下设备。"
                items={report.followUps.readingNoWords}
                detail={(s) => `交了阅读 ${s.readN} 天`}
                onPick={jumpTo}
              />
              <FollowUp
                testId="followup-zero"
                title="单词测试得 0 分"
                hint="可能是随手点完就交，建议问一下。"
                items={report.followUps.zeroTests}
                detail={(s) => `${s.zeroTests} 次 0 分`}
                onPick={jumpTo}
              />
              {report.followUps.noLevel.length ? (
                <FollowUp testId="followup-nolevel" title="还没选难度档" hint="没选档就不会分配阅读。" items={report.followUps.noLevel} detail={() => ''} onPick={jumpTo} />
              ) : null}
            </div>
          </section>

          <section className="card overflow-x-auto" data-testid="roster">
            <div className="mb-2 flex flex-wrap items-baseline justify-between gap-2">
              <h2 className="font-semibold">逐人逐天</h2>
              <div className="flex flex-wrap gap-3 text-xs text-gray-500">
                <span><b className="rounded bg-green-50 px-1 text-green-700">80%</b> 交了（得分率）/ 待判</span>
                <span><b className="rounded bg-amber-50 px-1 text-amber-700">没交</b> 打开了没交</span>
                <span><b className="rounded bg-red-50 px-1 text-red-600">没做</b> 分配了没看</span>
                <span><b className="text-gray-400">—</b> 那天没有他的阅读</span>
                <span>下一行：词✓ 学完新词 · 词3/10 学了一部分 · 测90 单词测试得分</span>
              </div>
            </div>
            {groups.length === 0 ? <p className="py-4 text-sm text-gray-500">这一周这个范围里没有学生。</p> : null}
            {groups.map((g) => (
              <div key={g.className} className="mb-4 break-inside-avoid">
                <h3 className="mb-1 text-sm font-semibold text-gray-700">
                  {g.className}
                  <span className="ml-2 font-normal text-gray-500">{g.students.length} 人</span>
                </h3>
                <table className="w-full min-w-[760px] table-fixed text-xs tabular-nums">
                  <colgroup>
                    <col className="w-36" />
                    <col className="w-24" />
                    {report.days.map((d) => (
                      <col key={d.date} />
                    ))}
                    <col className="w-16" />
                    <col className="w-16" />
                    <col className="w-16" />
                  </colgroup>
                  <thead>
                    <tr className="border-b text-gray-500">
                      <th className="py-1 text-left">姓名</th>
                      <th className="py-1 text-left">难度档</th>
                      {report.days.map((d) => (
                        <th key={d.date} className={`py-1 text-center ${d.isToday ? 'text-blue-700' : ''}`}>
                          {d.dow}
                          <div className="font-normal">{mdShort(d.date)}</div>
                        </th>
                      ))}
                      <th className="py-1 text-center">交阅读</th>
                      <th className="py-1 text-center">单词测试</th>
                      <th className="py-1 text-center">阅读均分</th>
                    </tr>
                  </thead>
                  <tbody>
                    {g.students.map((s) => (
                      <StudentRows key={s.id} s={s} open={openId === s.id} onToggle={() => setOpenId(openId === s.id ? null : s.id)} dayCount={report.days.length} />
                    ))}
                  </tbody>
                </table>
              </div>
            ))}
          </section>

          <details className="text-xs text-gray-500">
            <summary className="cursor-pointer">这些数怎么算的</summary>
            <ul className="mt-2 list-disc space-y-1 pl-5">
              <li>交了阅读 = 学生自己（或老师代）最终交卷；系统到点收卷不算。等老师批的算交了，但没有分数。</li>
              <li>应交 = 已经过去的、分配给他的阅读（入班以后、按那天的档位）；今天还没交不算欠。与学生首页、「生词」页同一个口径。</li>
              <li>阅读得分率只算已批完的卷子；单词测试得分 = 答对题数 ÷ 总题数。</li>
              <li>
                不计入：测试 / 演示账号{report.excluded.demoAccounts ? `（${report.excluded.demoAccounts} 个）` : ''}，这周之后才注册的学生
                {report.excluded.registeredAfter ? `（${report.excluded.registeredAfter} 个）` : ''}。
              </li>
            </ul>
          </details>
        </>
      ) : null}
    </div>
  );
}

function Kpi({ label, value, hint, tone }: { label: string; value: string | number; hint?: string; tone?: 'bad' }) {
  return (
    <div className="card">
      <div className={`text-2xl font-bold tabular-nums ${tone === 'bad' ? 'text-red-600' : 'text-[#2D3B45]'}`}>{value}</div>
      <div className="text-xs text-gray-500">{label}</div>
      {hint ? <div className="mt-0.5 text-xs text-gray-400">{hint}</div> : null}
    </div>
  );
}

function DayRow({ label, days, render }: { label: string; days: WeeklyReport['days']; render: (d: WeeklyReport['days'][number]) => string }) {
  return (
    <tr className="border-t">
      <td className="whitespace-nowrap py-1.5 pr-3 font-medium text-gray-700">{label}</td>
      {days.map((d) => (
        <td key={d.date} className={`py-1.5 text-right ${d.future ? 'text-gray-300' : ''}`}>
          {render(d)}
        </td>
      ))}
    </tr>
  );
}

function FollowUp({
  testId,
  title,
  hint,
  items,
  detail,
  onPick,
}: {
  testId: string;
  title: string;
  hint: string;
  items: BriefStudent[];
  detail: (s: BriefStudent) => string;
  onPick: (id: string) => void;
}) {
  return (
    <div className="card" data-testid={testId}>
      <h3 className="font-medium">
        {title}
        <span className={`ml-2 text-sm ${items.length ? 'text-red-600' : 'text-gray-400'}`}>{items.length} 人</span>
      </h3>
      <p className="mb-2 text-xs text-gray-500">{hint}</p>
      {items.length ? (
        <ul className="space-y-1 text-sm">
          {items.map((s) => (
            <li key={s.id} className="flex flex-wrap items-baseline gap-x-2">
              <button type="button" className="font-medium text-blue-700 hover:underline" onClick={() => onPick(s.id)}>
                {s.name}
              </button>
              <span className="rounded bg-gray-100 px-1.5 text-xs text-gray-600">{s.className}</span>
              <span className="text-xs text-gray-500">{detail(s)}</span>
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-sm text-gray-400">没有</p>
      )}
    </div>
  );
}

function StudentRows({ s, open, onToggle, dayCount }: { s: ReportStudent; open: boolean; onToggle: () => void; dayCount: number }) {
  return (
    <>
      <tr id={`stu-${s.id}`} className={`border-b ${open ? 'bg-blue-50/40' : ''}`}>
        <td className="py-1 pr-1">
          <button
            type="button"
            data-testid={`student-${s.id}`}
            aria-expanded={open}
            onClick={onToggle}
            className={`text-left font-medium hover:underline ${s.none ? 'text-red-600' : 'text-gray-900'}`}
          >
            {s.name}
          </button>
        </td>
        <td className="py-1 text-gray-500">{levelLabel(s.level)}</td>
        {s.days.map((c) => (
          <td key={c.date} className={`py-1 text-center ${CELL_STYLE[c.reading]}`}>
            <div className="font-semibold">{readingText(c)}</div>
            <div className="text-[10px] text-gray-500">{wordsText(c) || ' '}</div>
          </td>
        ))}
        <td className="py-1 text-center">
          {s.readN}
          <span className="text-gray-400">/{s.readDue}</span>
        </td>
        <td className="py-1 text-center">{s.testN}</td>
        <td className="py-1 text-center">{pct(s.readAvg)}</td>
      </tr>
      {open ? (
        <tr className="border-b bg-blue-50/40" data-testid={`detail-${s.id}`}>
          <td colSpan={dayCount + 5} className="px-2 py-2">
            <ul className="space-y-1 text-xs text-gray-700">
              {s.days
                .filter((c) => c.reading !== 'future')
                .map((c) => (
                  <li key={c.date}>
                    <span className="inline-block w-20 font-medium">{md(c.date)}</span>
                    阅读：
                    {c.title ? `《${c.title}》` : '没有分配'}
                    {c.reading === 'done'
                      ? ` · ${c.submittedAt ? `${sgtTime(c.submittedAt)} 交卷` : '已交'} · ${c.awaitingMarking ? '等老师批' : c.readPct == null ? '无分数' : `得分率 ${c.readPct}%`}`
                      : c.title
                        ? ` · ${readingText(c)}`
                        : ''}
                    　单词：{c.learning === 'done' ? '学完' : c.learning === 'partial' ? `学了 ${c.learnItemsDone}/${c.learnItems}` : '没学'}
                    　单词测试：{c.test === 'done' ? (c.testPct == null ? '交了' : `${c.testPct} 分`) : '没做'}
                  </li>
                ))}
            </ul>
            <p className="mt-1 text-xs text-gray-500">
              注册于 {md(s.registeredOn)}
              {s.awaitingMarking ? ` · ${s.awaitingMarking} 份等老师批` : ''}
            </p>
          </td>
        </tr>
      ) : null}
    </>
  );
}
