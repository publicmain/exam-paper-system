/**
 * 打印材料（2026-09-22，叶老师要的）。
 *
 * 选班级和日期：
 *   · 阅读 —— 这个班这天每个档位一份（可只印其中一档），可附答案页；
 *   · 单词表 / 默写纸 —— 每个学生一页，印他自己那天的词（每人的词按档位和进度推，
 *     各不相同，没法全班共用一张）；默写纸可附答案页。
 * 数据由服务端排好（/print-materials/classes/:classId/date/:date），这里只排 A4 版。只读。
 */
import { useCallback, useEffect, useMemo, useState } from 'react';
import { api } from '../lib/api';
import { ReadingSheet, WordsSheet, type PrintWord, type ReadingPrint } from '../print/PrintSheets';

export type ClassDayPrint = {
  classId: string;
  className: string;
  date: string;
  withAnswers: boolean;
  readings: Array<{ sessionId: string; date: string; level: string; levelLabel: string; reading: ReadingPrint }>;
  students: Array<{ name: string; level: string | null; levelLabel: string | null; words: PrintWord[] }>;
};
type Kind = 'reading' | 'list' | 'dictation';

export function sgtToday(now = Date.now()): string {
  return new Date(now + 8 * 60 * 60 * 1000).toISOString().slice(0, 10);
}

const WEEK = ['周日', '周一', '周二', '周三', '周四', '周五', '周六'];
export function dayText(iso: string): string {
  const [y, m, d] = iso.split('-').map(Number);
  if (!y || !m || !d) return iso;
  return `${m}月${d}日 ${WEEK[new Date(Date.UTC(y, m - 1, d)).getUTCDay()]}`;
}

type Load = { s: 'idle' } | { s: 'loading' } | { s: 'error'; text: string } | { s: 'ready'; data: ClassDayPrint };

export default function PrintMaterialsPage() {
  const [classes, setClasses] = useState<Array<{ id: string; name: string }>>([]);
  const [classId, setClassId] = useState('');
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

  const fetchDay = useCallback(async () => {
    if (!classId || !/^\d{4}-\d{2}-\d{2}$/.test(date)) return;
    setLoad({ s: 'loading' });
    try {
      const data = (await api.printClassDay(classId, date, withAnswers)) as ClassDayPrint;
      setLoad({ s: 'ready', data });
    } catch (e: any) {
      setLoad({ s: 'error', text: e?.status === 403 ? '你不是这个班的任课老师，看不到这个班的材料。' : '没读取到，稍后再试。' });
    }
  }, [classId, date, withAnswers]);
  useEffect(() => {
    void fetchDay();
  }, [fetchDay]);

  const data = load.s === 'ready' ? load.data : null;
  useEffect(() => setLevel('all'), [classId, date]);
  const readings = useMemo(() => (data ? data.readings.filter((r) => level === 'all' || r.level === level) : []), [data, level]);
  const withWords = useMemo(() => (data ? data.students.filter((s) => s.words.length > 0) : []), [data]);
  const noWords = useMemo(() => (data ? data.students.filter((s) => s.words.length === 0).map((s) => s.name) : []), [data]);
  const canPrint = kind === 'reading' ? readings.length > 0 : withWords.length > 0;

  return (
    <div className="ps-screen" data-testid="print-materials">
      <div className="ps-no-print mx-auto mb-4 max-w-[210mm] space-y-3">
        <div>
          <h1 className="text-xl font-bold">打印材料</h1>
          <p className="text-sm text-gray-600">选班级和日期，印阅读文章和题目，或者每个学生自己的单词表 / 默写纸。点「打印」后也可以存成 PDF。</p>
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
          <label className="flex items-center gap-2">
            日期
            <input className="input" type="date" value={date} onChange={(e) => setDate(e.target.value)} data-testid="print-date" />
          </label>
          <div className="flex gap-1" role="group" aria-label="打印哪一种">
            {(
              [
                ['reading', '阅读'],
                ['list', '单词表（每人一页）'],
                ['dictation', '默写纸（每人一页）'],
              ] as Array<[Kind, string]>
            ).map(([k, label]) => (
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
          {kind === 'reading' && data && data.readings.length > 1 ? (
            <label className="flex items-center gap-2">
              档位
              <select className="input" value={level} onChange={(e) => setLevel(e.target.value)} data-testid="print-level">
                <option value="all">全部（每档一份）</option>
                {data.readings.map((r) => (
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
        {load.s === 'loading' ? <p className="text-sm text-gray-500">正在读取…</p> : null}
        {load.s === 'error' ? (
          <p className="text-sm text-red-600" role="alert">
            {load.text}
          </p>
        ) : null}
        {data && kind !== 'reading' && noWords.length ? (
          <p className="text-sm text-gray-600" data-testid="print-no-words">
            这天没有单词任务、不会打印的学生：{noWords.join('、')}
          </p>
        ) : null}
        {data && kind === 'reading' && data.readings.length === 0 ? (
          <p className="text-sm text-gray-600" data-testid="print-no-reading">
            {data.className} 在 {dayText(data.date)} 没有阅读。
          </p>
        ) : null}
      </div>

      {data && kind === 'reading'
        ? readings.map((r) => (
            <ReadingSheet
              key={r.sessionId}
              reading={r.reading}
              meta={[r.levelLabel, dayText(r.date), data.className].filter(Boolean).join(' · ')}
              showAnswers={withAnswers}
            />
          ))
        : null}
      {data && kind !== 'reading'
        ? withWords.map((s) => (
            <WordsSheet
              key={s.name}
              words={s.words}
              mode={kind === 'dictation' ? 'dictation' : 'list'}
              title={`${s.name} · ${kind === 'dictation' ? '默写纸' : '单词表'}`}
              meta={[dayText(data.date), data.className, s.levelLabel, `共 ${s.words.length} 个`].filter(Boolean).join(' · ')}
              showAnswers={withAnswers}
            />
          ))
        : null}
    </div>
  );
}
