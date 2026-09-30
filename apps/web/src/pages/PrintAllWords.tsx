/**
 * 一次印全部学生的单词（2026-10-01，叶老师：打印不该非得先选班级）。
 *
 * 独立页面 `/print-words`：没有后台导航栏，选一天就把所有班、每个学生那天的词各印一页，
 * 默写纸或单词表。数据还是「打印材料」同一个接口（每个班一次 /print-materials/classes/:id/date/:date），
 * 这里只负责把所有班合在一起排版。只读。
 *
 * 和「打印材料」页的单个班打印比，改了三处（09-29 体检发现的问题）：
 *   · 默认只印学生在 App 里学完的词 —— 没学到的、点了「稍后再学」的不印（可以关掉）；
 *   · 一个学生的词多了就分页，每一页都印姓名（原来第二页没有名字，一叠纸分不清是谁的）；
 *   · 答案按班集中印在最后，不再每个学生后面夹一页。
 * 测试班、验收 / 测试账号默认不印。
 */
import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../lib/api';
import { shortGloss, type PrintWord } from '../print/PrintSheets';
import '../print/print-sheet.css';
import { addDays, dayText, sgtToday, type ClassDayPrint } from './PrintMaterials';

type Kind = 'dictation' | 'list';
type ClassRow = { id: string; name: string };
type Loaded = { classId: string; className: string; data: ClassDayPrint | null; forbidden: boolean };

/** 测试 / 验收用的班，默认不勾。 */
export const TEST_CLASS = /测试|QA|e2e|试点|临时|验收/i;
/** 真实班里挂着的验收号、老师测试号，不印。 */
export const TEST_STUDENT = /验收|测试号/;
/** 一页默写纸最多几个词（超过 15 个行距自动收紧）；单词表带例句，一页少放一些。 */
export const PER_PAGE: Record<Kind, number> = { dictation: 30, list: 12 };
const DENSE_FROM = 15;

/** 往前找上一个上课日（周一到周五）。 */
export function prevTeachingDay(iso: string): string {
  let d = addDays(iso, -1);
  for (;;) {
    const [y, m, day] = d.split('-').map(Number);
    const wd = new Date(Date.UTC(y, m - 1, day)).getUTCDay();
    if (wd !== 0 && wd !== 6) return d;
    d = addDays(d, -1);
  }
}

export type StudentSheet = { key: string; className: string; name: string; levelLabel: string | null; words: PrintWord[] };

/** 所有班合在一起：按班名、班内按服务端的顺序；跳过测试账号；只印学过的词时把没学完的剔掉。 */
export function buildSheets(loaded: Loaded[], onlyLearned: boolean) {
  const sheets: StudentSheet[] = [];
  const noWords: string[] = [];
  let skippedTest = 0;
  for (const c of [...loaded].sort((a, b) => a.className.localeCompare(b.className))) {
    for (const s of c.data?.students ?? []) {
      if (TEST_STUDENT.test(s.name)) {
        skippedTest += 1;
        continue;
      }
      // learned 没给（接口还是旧版）就当学过，不误删
      const words = onlyLearned ? s.words.filter((w) => w.learned !== false) : s.words;
      if (words.length) sheets.push({ key: `${c.classId}:${s.name}`, className: c.className, name: s.name, levelLabel: s.levelLabel, words });
      else noWords.push(`${s.name}（${c.className}）`);
    }
  }
  return { sheets, noWords, skippedTest };
}

function chunk<T>(list: T[], size: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < list.length; i += size) out.push(list.slice(i, i + size));
  return out;
}

export default function PrintAllWordsPage() {
  const [classes, setClasses] = useState<ClassRow[] | null>(null);
  const [picked, setPicked] = useState<Set<string>>(new Set());
  const [date, setDate] = useState(() => sgtToday());
  const [kind, setKind] = useState<Kind>('dictation');
  const [onlyLearned, setOnlyLearned] = useState(true);
  const [withAnswers, setWithAnswers] = useState(false);
  const [loaded, setLoaded] = useState<Loaded[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    api
      .listClasses()
      .then((cs: any) => {
        const list: ClassRow[] = (Array.isArray(cs) ? cs : [])
          .filter((c: any) => !c.archivedAt)
          .map((c: any) => ({ id: String(c.id), name: String(c.name) }))
          .sort((a: ClassRow, b: ClassRow) => a.name.localeCompare(b.name));
        setClasses(list);
        setPicked(new Set(list.filter((c) => !TEST_CLASS.test(c.name)).map((c) => c.id)));
      })
      .catch(() => {
        setClasses([]);
        setError('班级列表没读到，刷新一下再试。');
      });
  }, []);

  const pickedKey = [...picked].sort().join(',');
  useEffect(() => {
    if (!classes || !/^\d{4}-\d{2}-\d{2}$/.test(date)) return;
    const targets = classes.filter((c) => picked.has(c.id));
    let stale = false;
    setLoaded(null);
    setError(null);
    Promise.allSettled(targets.map((c) => api.printClassDay(c.id, date, false) as Promise<ClassDayPrint>)).then((results) => {
      if (stale) return;
      const rows: Loaded[] = results.map((r, i) => ({
        classId: targets[i].id,
        className: targets[i].name,
        data: r.status === 'fulfilled' ? r.value : null,
        forbidden: r.status === 'rejected' && (r.reason as any)?.status === 403,
      }));
      setLoaded(rows);
      const failed = rows.filter((r) => !r.data && !r.forbidden).map((r) => r.className);
      if (failed.length) setError(`这几个班没读到：${failed.join('、')}。刷新一下再试。`);
    });
    return () => {
      stale = true;
    };
    // pickedKey 代表勾选的班；classes 只在加载时变一次
  }, [classes, date, pickedKey]); // eslint-disable-line react-hooks/exhaustive-deps

  const { sheets, noWords, skippedTest } = useMemo(() => buildSheets(loaded ?? [], onlyLearned), [loaded, onlyLearned]);
  const forbidden = (loaded ?? []).filter((r) => r.forbidden).map((r) => r.className);
  const pageCount = sheets.reduce((n, s) => n + Math.ceil(s.words.length / PER_PAGE[kind]), 0);
  const byClass = useMemo(() => {
    const map = new Map<string, StudentSheet[]>();
    for (const s of sheets) map.set(s.className, [...(map.get(s.className) ?? []), s]);
    return [...map.entries()];
  }, [sheets]);

  // 存 PDF 时的默认文件名
  useEffect(() => {
    const before = document.title;
    document.title = `${kind === 'dictation' ? '单词默写纸' : '单词表'}-${date}`;
    return () => {
      document.title = before;
    };
  }, [kind, date]);

  const toggle = (id: string) =>
    setPicked((cur) => {
      const next = new Set(cur);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  const today = sgtToday();
  const lastTeachingDay = prevTeachingDay(today);

  return (
    <div className="ps-screen" data-testid="print-all-words">
      <div className="ps-no-print mx-auto mb-4 max-w-[210mm] space-y-3 text-sm">
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <h1 className="text-xl font-bold">打印全部学生的单词</h1>
          <Link to="/print-materials" className="text-blue-600 hover:underline">
            ← 回到打印材料
          </Link>
        </div>
        <p className="text-gray-600">选一天，所有勾选的班、每个学生那天的词各印一页。点「打印」后也可以存成 PDF。</p>

        <div className="flex flex-wrap items-center gap-3">
          <label className="flex items-center gap-2">
            日期
            <input className="input" type="date" value={date} onChange={(e) => setDate(e.target.value)} data-testid="pw-date" />
          </label>
          <div className="flex gap-1" role="group" aria-label="快速选日期">
            <button type="button" className={date === today ? 'btn btn-primary' : 'btn btn-ghost'} onClick={() => setDate(today)} data-testid="pw-today">
              今天
            </button>
            <button type="button" className={date === lastTeachingDay ? 'btn btn-primary' : 'btn btn-ghost'} onClick={() => setDate(lastTeachingDay)} data-testid="pw-last">
              上一个上课日
            </button>
          </div>
          <div className="flex gap-1" role="group" aria-label="印哪一种">
            {(
              [
                ['dictation', '默写纸'],
                ['list', '单词表'],
              ] as Array<[Kind, string]>
            ).map(([k, label]) => (
              <button key={k} type="button" className={kind === k ? 'btn btn-primary' : 'btn btn-ghost'} aria-pressed={kind === k} onClick={() => setKind(k)} data-testid={`pw-kind-${k}`}>
                {label}
              </button>
            ))}
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
          <label className="flex items-center gap-2">
            <input type="checkbox" checked={onlyLearned} onChange={(e) => setOnlyLearned(e.target.checked)} data-testid="pw-only-learned" />
            只印学完的词（没学到的、点了「稍后再学」的不印）
          </label>
          {kind === 'dictation' ? (
            <label className="flex items-center gap-2">
              <input type="checkbox" checked={withAnswers} onChange={(e) => setWithAnswers(e.target.checked)} data-testid="pw-answers" />
              最后附答案（按班一页）
            </label>
          ) : null}
        </div>

        <fieldset className="flex flex-wrap items-center gap-x-3 gap-y-1" data-testid="pw-classes">
          <legend className="mb-1 text-gray-600">班级（测试班默认不勾）</legend>
          {(classes ?? []).map((c) => (
            <label key={c.id} className="flex items-center gap-1">
              <input type="checkbox" checked={picked.has(c.id)} onChange={() => toggle(c.id)} />
              {c.name}
            </label>
          ))}
        </fieldset>

        <div className="flex flex-wrap items-center gap-3">
          <button type="button" className="btn btn-primary" disabled={!sheets.length} onClick={() => window.print()} data-testid="pw-print">
            打印 / 存 PDF
          </button>
          {loaded ? (
            <span className="text-gray-700" data-testid="pw-summary">
              {dayText(date)}：{sheets.length} 个学生，共 {pageCount} 页{withAnswers && kind === 'dictation' && byClass.length ? `，另附答案 ${byClass.length} 班` : ''}
            </span>
          ) : classes ? (
            <span className="text-gray-500">正在读取…</span>
          ) : null}
        </div>
        {noWords.length ? (
          <p className="text-gray-600" data-testid="pw-no-words">
            {onlyLearned ? '这天没有学完的词、不会打印的学生' : '这天没有单词任务、不会打印的学生'}（{noWords.length}）：{noWords.join('、')}
          </p>
        ) : null}
        {skippedTest ? <p className="text-gray-500">测试账号 {skippedTest} 个，不印。</p> : null}
        {forbidden.length ? <p className="text-gray-600">这几个班你不是任课老师，看不到：{forbidden.join('、')}</p> : null}
        {error ? (
          <p className="text-red-600" role="alert">
            {error}
          </p>
        ) : null}
      </div>

      {sheets.flatMap((s) => {
        const parts = chunk(s.words, PER_PAGE[kind]);
        return parts.map((words, pi) => (
          <StudentPage key={`${s.key}:${pi}`} sheet={s} words={words} start={pi * PER_PAGE[kind]} part={pi + 1} parts={parts.length} kind={kind} date={date} />
        ));
      })}

      {withAnswers && kind === 'dictation'
        ? byClass.map(([className, list]) => (
            <article key={`ans-${className}`} className="ps-paper" data-testid="pw-answer-page">
              <header className="ps-head">
                <div>
                  <h1 className="ps-title">默写答案 · {className}</h1>
                  <div className="ps-meta">
                    {dayText(date)} · {list.length} 人 · 题号和每人默写纸上的一致
                  </div>
                </div>
              </header>
              <table className="ps-table">
                <thead>
                  <tr>
                    <th>学生</th>
                    <th>答案</th>
                  </tr>
                </thead>
                <tbody>
                  {list.map((s) => (
                    <tr key={s.key}>
                      <td style={{ whiteSpace: 'nowrap', fontWeight: 700 }}>{s.name}</td>
                      <td className="ps-small">
                        {s.words.map((w, i) => (
                          <span key={`${w.headword}-${i}`} style={{ display: 'inline-block', marginRight: 10 }}>
                            <b>{i + 1}.</b>&nbsp;{w.headword}
                          </span>
                        ))}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </article>
          ))
        : null}
    </div>
  );
}

function StudentPage({
  sheet,
  words,
  start,
  part,
  parts,
  kind,
  date,
}: {
  sheet: StudentSheet;
  words: PrintWord[];
  start: number;
  part: number;
  parts: number;
  kind: Kind;
  date: string;
}) {
  const dictation = kind === 'dictation';
  const dense = dictation && words.length > DENSE_FROM;
  return (
    <article className={`ps-paper${dense ? ' ps-dense' : ''}`} data-testid="pw-student-page" data-student={sheet.name}>
      <header className="ps-head">
        <div>
          <h1 className="ps-title">
            {sheet.name} · {dictation ? '默写纸' : '单词表'}
            {parts > 1 ? `（${part}/${parts}）` : ''}
          </h1>
          <div className="ps-meta">{[dayText(date), sheet.className, sheet.levelLabel, `共 ${sheet.words.length} 个`].filter(Boolean).join(' · ')}</div>
        </div>
        {dictation && part === 1 ? (
          <div className="ps-fields">
            <span>
              得分 <i className="ps-blank" style={{ minWidth: '12mm' }} /> / {sheet.words.length}
            </span>
          </div>
        ) : null}
      </header>
      {dictation ? (
        <table className="ps-table">
          <thead>
            <tr>
              <th>#</th>
              <th>中文意思</th>
              <th>英文</th>
            </tr>
          </thead>
          <tbody>
            {words.map((w, i) => (
              <tr key={`${w.headword}-${i}`}>
                <td className="ps-num">{start + i + 1}</td>
                <td>{shortGloss(w.translation)}</td>
                <td className="ps-write" />
              </tr>
            ))}
          </tbody>
        </table>
      ) : (
        <table className="ps-table">
          <thead>
            <tr>
              <th>#</th>
              <th>单词</th>
              <th>中文意思</th>
              <th>例句</th>
            </tr>
          </thead>
          <tbody>
            {words.map((w, i) => (
              <tr key={`${w.headword}-${i}`}>
                <td className="ps-num">{start + i + 1}</td>
                <td>
                  <div className="ps-word">{w.headword}</div>
                  {w.phonetic ? <div className="ps-small">{w.phonetic}</div> : null}
                </td>
                <td>{shortGloss(w.translation)}</td>
                <td className="ps-small">{w.sentence ?? ''}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </article>
  );
}
