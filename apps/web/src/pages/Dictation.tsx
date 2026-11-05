import { useEffect, useRef, useState } from 'react';
import { Link, useParams, useSearchParams } from 'react-router-dom';
import { api } from '../lib/api';
import { sgtToday } from './PrintMaterials';

type Row = { id: string; studentId: string; name: string; status: 'pending' | 'entered' | 'absent'; wrongSenseIds: string[];
  enteredAt: string | null; words: Array<{ senseId: string; headword: string; translation: string }> };
export type DictationData = { className: string; learnedDate: string; heldOn: string; sheet: { id: string; rows: Row[] } | null };
const statusText = (row: Row) => !row.words.length ? '没有学完的词' : row.status === 'pending' ? '未录入' : row.status === 'absent' ? '缺考' : row.wrongSenseIds.length ? `错 ${row.wrongSenseIds.length} 词` : '全对';
const secondary = 'inline-flex min-h-12 items-center justify-center rounded-lg bg-gray-100 px-4 text-sm font-semibold text-gray-900 hover:bg-gray-200 disabled:opacity-50';
const requestId = () => Array.from(crypto.getRandomValues(new Uint32Array(4))).map((v) => v.toString(16)).join('_');

// Calm school administration: neutral sans, slate/blue scales, 8px corners, one primary save action.
export default function DictationPage() {
  const { classId = '' } = useParams();
  const [search] = useSearchParams();
  const [learnedDate, setLearnedDate] = useState(() => search.get('learnedDate') ?? '');
  const [heldOn, setHeldOn] = useState(sgtToday);
  const [data, setData] = useState<DictationData | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [refresh, setRefresh] = useState(0);
  const [selected, setSelected] = useState('');
  const [wrong, setWrong] = useState<string[]>([]);
  const intent = useRef<{ signature: string; requestId: string } | null>(null);
  const saving = useRef(false);

  function choose(row?: Row) { setSelected(row?.studentId ?? ''); setWrong(row?.wrongSenseIds ?? []); }
  useEffect(() => {
    let stale = false;
    setLoading(true); setError(''); setNotice(''); setData(null);
    api.dictation(classId, learnedDate || undefined, heldOn).then((next: DictationData) => {
      if (stale) return;
      setData(next);
      choose(next.sheet?.rows.find((r) => r.status === 'pending' && r.words.length) ?? next.sheet?.rows[0]);
    }).catch((e) => { if (!stale) setError(e?.status === 403 ? '你不能查看这个班的默写。' : '暂时没能加载，请重试。'); })
      .finally(() => { if (!stale) setLoading(false); });
    return () => { stale = true; };
  }, [classId, learnedDate, heldOn, refresh]);

  const rows = data?.sheet?.rows ?? [];
  const row = rows.find((r) => r.studentId === selected);
  const pending = rows.filter((r) => r.status === 'pending' && r.words.length);

  async function generate() {
    if (!data || saving.current) return;
    saving.current = true; setBusy(true); setError('');
    try {
      const next = await api.generateDictation(classId, { learnedDate: data.learnedDate, heldOn: data.heldOn }) as DictationData;
      setData(next); choose(next.sheet?.rows.find((r) => r.words.length) ?? next.sheet?.rows[0]);
    } catch { setError('没能生成默写单，请重试。'); }
    finally { saving.current = false; setBusy(false); }
  }

  async function save(status: 'entered' | 'absent' | 'remaining') {
    if (!data?.sheet || saving.current || (status !== 'remaining' && !row)) return;
    const wrongSenseIds = status === 'entered' ? [...wrong].sort() : [];
    const signature = JSON.stringify([data.sheet.id, status === 'remaining' ? null : row!.studentId, status, wrongSenseIds]);
    if (intent.current?.signature !== signature) intent.current = { signature, requestId: requestId() };
    saving.current = true; setBusy(true); setError(''); setNotice('');
    try {
      const next = (status === 'remaining'
        ? await api.remainingDictationCorrect(classId, data.sheet.id, intent.current.requestId)
        : await api.saveDictation(classId, data.sheet.id, row!.studentId, { status, wrongSenseIds, requestId: intent.current.requestId })) as DictationData;
      setData(next); intent.current = null;
      choose(next.sheet?.rows.find((r) => r.status === 'pending' && r.words.length && r.studentId !== selected)
        ?? next.sheet?.rows.find((r) => r.studentId === selected));
      setNotice('已保存。');
    } catch { setError('没能确认保存结果，请保持选择后重试。'); }
    finally { saving.current = false; setBusy(false); }
  }

  return <main className="mx-auto max-w-3xl space-y-6 p-4 text-gray-900 sm:p-6">
    <header className="space-y-2">
      <Link className="inline-flex min-h-12 items-center text-sm text-blue-700 hover:underline" to="/classes">← 班级</Link>
      <h1 className="break-words text-2xl font-semibold">早读默写回填{data ? ` · ${data.className}` : ''}</h1>
      <p className="max-w-prose text-sm leading-relaxed text-gray-600">只勾错的词，不勾就是全对。保存后可以再改；没保存的学生仍是未录入。</p>
    </header>
    <div className="flex flex-wrap items-end gap-4">
      <label className="space-y-2 text-sm"><span className="block font-semibold">默写哪天学的词</span><input aria-label="默写哪天学的词" className="block min-h-12 max-w-full rounded-lg border border-gray-300 bg-white px-3 text-base" type="date" max={heldOn} value={learnedDate || data?.learnedDate || ''} disabled={busy} onChange={(e) => setLearnedDate(e.target.value)} /></label>
      <label className="space-y-2 text-sm"><span className="block font-semibold">默写日期</span><input aria-label="默写日期" className="block min-h-12 max-w-full rounded-lg border border-gray-300 bg-white px-3 text-base" type="date" max={sgtToday()} value={data?.sheet ? data.heldOn : heldOn} disabled={busy || !!data?.sheet} onChange={(e) => setHeldOn(e.target.value)} /></label>
    </div>
    {loading ? <p role="status" className="text-sm text-gray-600">正在读取…</p> : null}
    {error ? <div role="alert" className="space-y-2 rounded-lg bg-red-50 p-4 text-sm text-red-900"><p>{error}</p>{!data ? <button className={secondary} onClick={() => setRefresh((n) => n + 1)}>重新加载</button> : null}</div> : null}
    {notice ? <p role="status" className="text-sm text-green-700">{notice}</p> : null}
    {data && !data.sheet ? <section className="space-y-4 rounded-lg bg-gray-50 p-6"><p className="text-sm text-gray-600">这一天还没有默写单。生成时只收每位学生当天实际学完的词，之后不会增加。</p><button className="min-h-12 rounded-lg bg-blue-700 px-4 text-sm font-semibold text-white hover:bg-blue-800 disabled:opacity-50" disabled={busy} onClick={generate}>{busy ? '正在生成…' : '生成默写单'}</button></section> : null}
    {data?.sheet ? <>
      <div className="flex flex-wrap items-center justify-between gap-4"><p className="text-sm text-gray-600">{data.heldOn} 默写 · {pending.length} 人未录入 · {rows.length} 人{rows.some((r) => !r.words.length) ? '（没有学完的词的学生无需录入）' : ''}</p><button className={secondary} disabled={busy || !pending.length} onClick={() => void save('remaining')}>全班其余都全对</button></div>
      {!rows.length ? <p className="rounded-lg bg-gray-50 p-6 text-sm text-gray-600">这张默写单没有学生。</p> : <div className="grid items-start gap-6 md:grid-cols-[256px_minmax(0,1fr)]">
        <nav aria-label="选择学生" className="max-h-96 space-y-2 overflow-y-auto rounded-lg bg-gray-50 p-3">
          {rows.map((r) => <button key={r.id} disabled={busy} aria-pressed={selected === r.studentId} onClick={() => choose(r)} className={`flex min-h-12 w-full flex-wrap items-center justify-between gap-2 rounded-lg px-3 py-3 text-left text-sm ${selected === r.studentId ? 'bg-blue-100 font-semibold text-blue-900' : 'text-gray-900 hover:bg-gray-100'}`}><span className="min-w-0 break-all">{r.name}</span><span className={selected === r.studentId ? 'text-blue-900' : 'text-gray-600'}>{statusText(r)}</span></button>)}
        </nav>
        {row ? <section aria-label="录入错词" className="min-w-0 space-y-4">
          <div className="space-y-2"><h2 className="break-all text-xl font-semibold">{row.name}</h2><p className="text-sm text-gray-600">{statusText(row)} · {row.words.length} 个词</p></div>
          {!row.words.length ? <p className="text-sm text-gray-600">这位学生当天没有学完的词，无需录入。</p> : <>
            <fieldset disabled={busy} className="grid gap-2 sm:grid-cols-2"><legend className="mb-3 text-sm font-semibold">勾选写错的词</legend>{row.words.map((word, i) => <label key={word.senseId} className={`flex min-h-12 min-w-0 cursor-pointer items-start gap-3 rounded-lg p-3 ${wrong.includes(word.senseId) ? 'bg-amber-100 text-amber-900' : 'bg-gray-50 text-gray-900'}`}><input type="checkbox" aria-label={word.headword} className="mt-1 h-4 w-4 shrink-0" checked={wrong.includes(word.senseId)} onChange={(e) => setWrong((old) => e.target.checked ? [...old, word.senseId] : old.filter((id) => id !== word.senseId))} /><span className="min-w-0 break-words text-base"><span className="font-semibold">{i + 1}. {word.headword}</span><span className="block text-sm">{word.translation}</span></span></label>)}</fieldset>
            <div className="flex flex-wrap gap-3"><button className="min-h-12 rounded-lg bg-blue-700 px-4 text-sm font-semibold text-white hover:bg-blue-800 disabled:opacity-50" disabled={busy} onClick={() => void save('entered')}>{busy ? '正在保存…' : wrong.length ? `保存（错 ${wrong.length} 词）` : '保存（全对）'}</button><button className={secondary} disabled={busy} onClick={() => void save('absent')}>缺考</button></div>
          </>}
        </section> : null}
      </div>}
    </> : null}
  </main>;
}
