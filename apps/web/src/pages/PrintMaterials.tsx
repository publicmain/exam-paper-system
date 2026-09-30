/**
 * 打印材料（2026-09-22，叶老师要的）。
 *
 * 选班级和日期：
 *   · 阅读 —— 这个班这天每个档位一份（可只印其中一档），可附答案页；
 *   · 单词表 / 默写纸 —— 每个学生一页，印他自己那天的词（每人的词按档位和进度推，
 *     各不相同，没法全班共用一张）；默写纸可附答案页。
 *
 * 2026-09-29（庞校长的早读默写）：加「一整周」—— 每个学生周一到周五的词合成一份，按天分段；
 * 当天 App 单词测试里答错过的词标 ★。默认印上一周（每周一早上默写上周学过的词）。
 * 每天的词是当天早上才按进度排的，所以只能印已经过去（或当天）的日子。
 *
 * 数据由服务端排好（/print-materials/classes/:classId/date/:date 与 /week/:monday），这里只排 A4 版。只读。
 */
import { useCallback, useEffect, useMemo, useState } from 'react';
import { api } from '../lib/api';
import { ReadingSheet, WeekWordsSheet, WordsSheet, type PrintWord, type ReadingPrint } from '../print/PrintSheets';

export type ClassDayPrint = {
  classId: string;
  className: string;
  date: string;
  withAnswers: boolean;
  readings: Array<{ sessionId: string; date: string; level: string; levelLabel: string; reading: ReadingPrint }>;
  students: Array<{ name: string; level: string | null; levelLabel: string | null; words: PrintWord[] }>;
};
export type ClassWeekPrint = {
  classId: string;
  className: string;
  from: string;
  to: string;
  dates: string[];
  students: Array<{
    name: string;
    level: string | null;
    levelLabel: string | null;
    /** learned：那天学生在 App 里把新词学完了没有（没学完的日子纸上注明） */
    days: Array<{ date: string; learned: boolean; words: PrintWord[] }>;
    total: number;
    testWrong: number;
  }>;
};
type Kind = 'reading' | 'list' | 'dictation';
type Scope = 'day' | 'week';

export function sgtToday(now = Date.now()): string {
  return new Date(now + 8 * 60 * 60 * 1000).toISOString().slice(0, 10);
}

const WEEK = ['周日', '周一', '周二', '周三', '周四', '周五', '周六'];
export function dayText(iso: string): string {
  const [y, m, d] = iso.split('-').map(Number);
  if (!y || !m || !d) return iso;
  return `${m}月${d}日 ${WEEK[new Date(Date.UTC(y, m - 1, d)).getUTCDay()]}`;
}

/** 这一天所在那一周的周一（YYYY-MM-DD）。 */
export function mondayOf(iso: string): string {
  const [y, m, d] = iso.split('-').map(Number);
  if (!y || !m || !d) return iso;
  const t = Date.UTC(y, m - 1, d);
  const offset = (new Date(t).getUTCDay() + 6) % 7;
  return new Date(t - offset * 86_400_000).toISOString().slice(0, 10);
}

/** 往前 / 往后挪 n 天（按日历日，跨月跨年都对）。 */
export function addDays(iso: string, n: number): string {
  const [y, m, d] = iso.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, d) + n * 86_400_000).toISOString().slice(0, 10);
}

/** 往前 / 往后挪 n 周。 */
export function shiftWeeks(iso: string, n: number): string {
  return addDays(iso, n * 7);
}

type Load =
  | { s: 'idle' }
  | { s: 'loading' }
  | { s: 'error'; text: string }
  | { s: 'ready'; scope: 'day'; data: ClassDayPrint }
  | { s: 'ready'; scope: 'week'; data: ClassWeekPrint };

export default function PrintMaterialsPage() {
  const [classes, setClasses] = useState<Array<{ id: string; name: string }>>([]);
  const [classId, setClassId] = useState('');
  const [scope, setScope] = useState<Scope>('day');
  const [date, setDate] = useState(() => sgtToday());
  const [kind, setKind] = useState<Kind>('reading');
  const [withAnswers, setWithAnswers] = useState(false);
  const [level, setLevel] = useState('all');
  const [load, setLoad] = useState<Load>({ s: 'idle' });

  useEffect(() => {
    api
      .listClasses()
      .then((cs: any) => {
        const list = (Array.isArray(cs) ? cs : []).filter((c: any) => !c.archivedAt).map((c: any) => ({ id: String(c.id), name: String(c.name) }));
        setClasses(list);
        if (list.length) setClassId((cur) => cur || list[0].id);
      })
      .catch(() => setClasses([]));
  }, []);

  const monday = mondayOf(date);
  const fetchData = useCallback(async () => {
    if (!classId || !/^\d{4}-\d{2}-\d{2}$/.test(date)) return;
    setLoad({ s: 'loading' });
    try {
      if (scope === 'week') {
        const data = (await api.printClassWeek(classId, monday)) as ClassWeekPrint;
        setLoad({ s: 'ready', scope: 'week', data });
      } else {
        const data = (await api.printClassDay(classId, date, withAnswers)) as ClassDayPrint;
        setLoad({ s: 'ready', scope: 'day', data });
      }
    } catch (e: any) {
      setLoad({ s: 'error', text: e?.status === 403 ? '你不是这个班的任课老师，看不到这个班的材料。' : '没读取到，稍后再试。' });
    }
  }, [classId, date, monday, scope, withAnswers]);
  useEffect(() => {
    void fetchData();
  }, [fetchData]);

  const switchScope = (next: Scope) => {
    if (next === scope) return;
    setScope(next);
    if (next === 'week') {
      // 默认印上一周：每周一早上默写上周学过的词
      setDate(shiftWeeks(mondayOf(sgtToday()), -1));
      if (kind === 'reading') setKind('dictation');
    }
  };

  const dayData = load.s === 'ready' && load.scope === 'day' ? load.data : null;
  const weekData = load.s === 'ready' && load.scope === 'week' ? load.data : null;
  useEffect(() => setLevel('all'), [classId, date]);
  const readings = useMemo(() => (dayData ? dayData.readings.filter((r) => level === 'all' || r.level === level) : []), [dayData, level]);
  const withWords = useMemo(() => (dayData ? dayData.students.filter((s) => s.words.length > 0) : []), [dayData]);
  const weekWithWords = useMemo(() => (weekData ? weekData.students.filter((s) => s.total > 0) : []), [weekData]);
  const noWords = useMemo(() => {
    if (dayData) return dayData.students.filter((s) => s.words.length === 0).map((s) => s.name);
    if (weekData) return weekData.students.filter((s) => s.total === 0).map((s) => s.name);
    return [];
  }, [dayData, weekData]);
  const canPrint =
    scope === 'week' ? weekWithWords.length > 0 : kind === 'reading' ? readings.length > 0 : withWords.length > 0;
  const kinds: Array<[Kind, string]> =
    scope === 'week'
      ? [
          ['list', '单词表（每人一份）'],
          ['dictation', '默写纸（每人一份）'],
        ]
      : [
          ['reading', '阅读'],
          ['list', '单词表（每人一页）'],
          ['dictation', '默写纸（每人一页）'],
        ];
  const thisMonday = mondayOf(sgtToday());

  return (
    <div className="ps-screen" data-testid="print-materials">
      <div className="ps-no-print mx-auto mb-4 max-w-[210mm] space-y-3">
        <div>
          <div className="flex flex-wrap items-baseline justify-between gap-2">
            <h1 className="text-xl font-bold">打印材料</h1>
            <a href="/print-words" target="_blank" rel="noopener" className="text-blue-600 hover:underline" data-testid="print-all-link">
              一次印全部学生的单词 →
            </a>
          </div>
          <p className="text-sm text-gray-600">
            选班级和日期，印阅读文章和题目，或者每个学生自己的单词表 / 默写纸。选「一整周」可以把每个学生一周的词印成一份（早读默写用）。点「打印」后也可以存成 PDF。
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-3 text-sm">
          <label className="flex items-center gap-2">
            班级
            <select className="input" value={classId} onChange={(e) => setClassId(e.target.value)} data-testid="print-class">
              {classes.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </label>
          <div className="flex gap-1" role="group" aria-label="印一天还是一整周">
            {(
              [
                ['day', '一天'],
                ['week', '一整周'],
              ] as Array<[Scope, string]>
            ).map(([s, label]) => (
              <button
                key={s}
                type="button"
                className={scope === s ? 'btn btn-primary' : 'btn btn-ghost'}
                aria-pressed={scope === s}
                data-testid={`print-scope-${s}`}
                onClick={() => switchScope(s)}
              >
                {label}
              </button>
            ))}
          </div>
          <label className="flex items-center gap-2">
            {scope === 'week' ? '那一周里的任意一天' : '日期'}
            <input className="input" type="date" value={date} onChange={(e) => setDate(e.target.value)} data-testid="print-date" />
          </label>
          {scope === 'week' ? (
            <div className="flex gap-1" role="group" aria-label="快速选周">
              <button
                type="button"
                className={monday === shiftWeeks(thisMonday, -1) ? 'btn btn-primary' : 'btn btn-ghost'}
                data-testid="print-week-last"
                onClick={() => setDate(shiftWeeks(thisMonday, -1))}
              >
                上周
              </button>
              <button
                type="button"
                className={monday === thisMonday ? 'btn btn-primary' : 'btn btn-ghost'}
                data-testid="print-week-this"
                onClick={() => setDate(thisMonday)}
              >
                本周
              </button>
            </div>
          ) : null}
          <div className="flex gap-1" role="group" aria-label="打印哪一种">
            {kinds.map(([k, label]) => (
              <button
                key={k}
                type="button"
                className={kind === k ? 'btn btn-primary' : 'btn btn-ghost'}
                aria-pressed={kind === k}
                data-testid={`print-kind-${k}`}
                onClick={() => setKind(k)}
              >
                {label}
              </button>
            ))}
          </div>
          {scope === 'day' && kind === 'reading' && dayData && dayData.readings.length > 1 ? (
            <label className="flex items-center gap-2">
              档位
              <select className="input" value={level} onChange={(e) => setLevel(e.target.value)} data-testid="print-level">
                <option value="all">全部（每档一份）</option>
                {dayData.readings.map((r) => (
                  <option key={r.level} value={r.level}>
                    {r.levelLabel}
                  </option>
                ))}
              </select>
            </label>
          ) : null}
          {kind !== 'list' ? (
            <label className="flex items-center gap-2">
              <input type="checkbox" checked={withAnswers} onChange={(e) => setWithAnswers(e.target.checked)} data-testid="print-answers" />
              附答案页
            </label>
          ) : null}
          <button type="button" className="btn btn-primary" disabled={!canPrint} onClick={() => window.print()} data-testid="print-now">
            打印 / 存 PDF
          </button>
        </div>
        {scope === 'week' ? (
          <p className="text-sm text-gray-600" data-testid="print-week-range">
            {dayText(monday)} – {dayText(addDays(monday, 4))}。每天的词是当天早上才排的，还没到的日子印不出来。
          </p>
        ) : null}
        {load.s === 'loading' ? <p className="text-sm text-gray-500">正在读取…</p> : null}
        {load.s === 'error' ? (
          <p className="text-sm text-red-600" role="alert">
            {load.text}
          </p>
        ) : null}
        {(dayData || weekData) && (scope === 'week' || kind !== 'reading') && noWords.length ? (
          <p className="text-sm text-gray-600" data-testid="print-no-words">
            {scope === 'week' ? '这一周没有单词任务、不会打印的学生' : '这天没有单词任务、不会打印的学生'}：{noWords.join('、')}
          </p>
        ) : null}
        {dayData && kind === 'reading' && dayData.readings.length === 0 ? (
          <p className="text-sm text-gray-600" data-testid="print-no-reading">
            {dayData.className} 在 {dayText(dayData.date)} 没有阅读。
          </p>
        ) : null}
      </div>

      {dayData && kind === 'reading'
        ? readings.map((r) => (
            <ReadingSheet
              key={r.sessionId}
              reading={r.reading}
              meta={[r.levelLabel, dayText(r.date), dayData.className].filter(Boolean).join(' · ')}
              showAnswers={withAnswers}
            />
          ))
        : null}
      {dayData && kind !== 'reading'
        ? withWords.map((s) => (
            <WordsSheet
              key={s.name}
              words={s.words}
              mode={kind === 'dictation' ? 'dictation' : 'list'}
              title={`${s.name} · ${kind === 'dictation' ? '默写纸' : '单词表'}`}
              meta={[dayText(dayData.date), dayData.className, s.levelLabel, `共 ${s.words.length} 个`].filter(Boolean).join(' · ')}
              showAnswers={withAnswers}
            />
          ))
        : null}
      {weekData && kind !== 'reading'
        ? weekWithWords.map((s) => (
            <WeekWordsSheet
              key={s.name}
              days={s.days.map((d) => ({ ...d, label: dayText(d.date), note: d.learned ? undefined : '（App 里没学完）' }))}
              mode={kind === 'dictation' ? 'dictation' : 'list'}
              title={`${s.name} · ${kind === 'dictation' ? '一周默写纸' : '一周单词表'}`}
              meta={[
                `${dayText(weekData.from)} – ${dayText(weekData.to)}`,
                weekData.className,
                s.levelLabel,
                `共 ${s.total} 个`,
                s.testWrong ? `★ ${s.testWrong} 个` : null,
              ]
                .filter(Boolean)
                .join(' · ')}
              showAnswers={withAnswers}
            />
          ))
        : null}
    </div>
  );
}
