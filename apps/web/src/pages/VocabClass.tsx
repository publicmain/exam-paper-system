import { useCallback, useEffect, useState } from 'react';
import { api } from '../lib/api';

/**
 * 班级生词看板（生词本 P4，教师端）。
 *
 * 回答老师每天早上真正关心的问题：**今天该讲哪几个词**。
 * 数据来自学生自己的生词本，其中 wrong_answer 是判分时自动收录的
 * 确凿失分证据（权重更高），不是猜的。
 */

interface TopItem {
  headword: string;
  studentCount: number;
  wrongAnswer: number;
  clicked: number;
  mastered: number;
  contextSentence: string;
  passages: string[];
  phonetic: string | null;
  translation: string;
  tag: string[];
}

export default function VocabClassPage() {
  const [classes, setClasses] = useState<Array<{ id: string; name: string }>>([]);
  const [classId, setClassId] = useState('');
  const [days, setDays] = useState(30);
  const [data, setData] = useState<{ totalDistinctWords: number; items: TopItem[] } | null>(null);
  const [stats, setStats] = useState<any>(null);
  const [err, setErr] = useState('');
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [pushing, setPushing] = useState(false);
  const [pushMsg, setPushMsg] = useState('');

  useEffect(() => {
    api
      .listClasses()
      .then((r: any) => {
        const list = (r?.items ?? r ?? []).map((c: any) => ({ id: c.id, name: c.name }));
        setClasses(list);
        if (list.length && !classId) setClassId(list[0].id);
      })
      .catch((e: any) => setErr(String(e?.message ?? e)));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const load = useCallback(() => {
    if (!classId) return;
    setErr('');
    api
      .vocabClassTop(classId, { days, limit: 40 })
      .then((r: any) => setData(r))
      .catch((e: any) => setErr(String(e?.message ?? e)));
    api
      .vocabClassStats(classId)
      .then((r: any) => setStats(r))
      .catch(() => setStats(null));
  }, [classId, days]);

  useEffect(load, [load]);

  const togglePick = (w: string) =>
    setSelected((prev) => {
      const n = new Set(prev);
      if (n.has(w)) n.delete(w);
      else n.add(w);
      return n;
    });

  const push = async () => {
    if (!selected.size || !classId) return;
    setPushing(true);
    setPushMsg('');
    try {
      const r: any = await api.vocabPush({ classId, words: [...selected] });
      setPushMsg(
        `已推送给 ${r.students} 名学生:新增 ${r.created} 条,跳过 ${r.skipped} 条(已在本子里)` +
          (r.notFound?.length ? `;词典未收录:${r.notFound.join('、')}` : ''),
      );
      setSelected(new Set());
      load();
    } catch (e: any) {
      setPushMsg('推送失败:' + String(e?.message ?? e));
    } finally {
      setPushing(false);
    }
  };

  return (
    <div className="max-w-4xl mx-auto space-y-4">
      <div>
        <h1 className="text-2xl font-bold text-[#2D3B45]">📒 班级生词</h1>
        <p className="text-sm text-gray-500 mt-1">
          学生生词本的汇总。<strong>答错自动收录</strong>的词是确凿的失分证据 —— 优先讲这些。
        </p>
      </div>

      <div className="flex flex-wrap gap-3 items-center">
        <select
          value={classId}
          onChange={(e) => setClassId(e.target.value)}
          className="border rounded-md px-3 py-2 text-sm"
        >
          {classes.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </select>
        <select
          value={days}
          onChange={(e) => setDays(Number(e.target.value))}
          className="border rounded-md px-3 py-2 text-sm"
        >
          <option value={7}>最近 7 天</option>
          <option value={30}>最近 30 天</option>
          <option value={90}>最近 90 天</option>
        </select>
        {selected.size > 0 && (
          <button
            type="button"
            onClick={push}
            disabled={pushing}
            className="px-4 py-2 rounded-md bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white text-sm font-medium"
          >
            {pushing ? '推送中…' : `推送选中的 ${selected.size} 个词给全班`}
          </button>
        )}
      </div>

      {pushMsg && (
        <div className="text-sm rounded-lg bg-blue-50 border border-blue-200 text-blue-800 px-3 py-2">
          {pushMsg}
        </div>
      )}
      {err && (
        <div className="text-sm rounded-lg bg-rose-50 border border-rose-200 text-rose-800 px-3 py-2">
          ⚠️ {err}
        </div>
      )}

      {stats && (
        <div className="bg-white border rounded-xl p-4 text-sm">
          <div className="flex gap-6 flex-wrap">
            <div>
              <div className="text-gray-500 text-xs">学生数</div>
              <div className="text-xl font-bold">{stats.students}</div>
            </div>
            <div>
              <div className="text-gray-500 text-xs">累计复习次数</div>
              <div className="text-xl font-bold">{stats.totalReviews}</div>
            </div>
            <div>
              <div className="text-gray-500 text-xs">不同生词数</div>
              <div className="text-xl font-bold">{data?.totalDistinctWords ?? '—'}</div>
            </div>
          </div>
        </div>
      )}

      <div className="bg-white border rounded-xl divide-y">
        {(data?.items ?? []).map((it) => (
          <label
            key={it.headword}
            className="flex items-start gap-3 p-4 cursor-pointer hover:bg-gray-50"
          >
            <input
              type="checkbox"
              checked={selected.has(it.headword)}
              onChange={() => togglePick(it.headword)}
              className="mt-1.5"
            />
            <div className="min-w-0 flex-1">
              <div className="flex items-baseline gap-2 flex-wrap">
                <span className="text-lg font-bold text-gray-900">{it.headword}</span>
                {it.phonetic && <span className="text-xs text-gray-500">/{it.phonetic}/</span>}
                {it.tag.includes('ielts') && (
                  <span className="text-[11px] px-1.5 py-0.5 rounded bg-purple-100 text-purple-700 font-semibold">
                    雅思
                  </span>
                )}
                <span className="text-xs text-gray-500">{it.studentCount} 名学生</span>
                {it.wrongAnswer > 0 && (
                  <span className="text-[11px] px-1.5 py-0.5 rounded bg-rose-50 text-rose-700 border border-rose-200">
                    答错 {it.wrongAnswer}
                  </span>
                )}
                {it.mastered > 0 && (
                  <span className="text-[11px] px-1.5 py-0.5 rounded bg-emerald-50 text-emerald-700 border border-emerald-200">
                    已掌握 {it.mastered}
                  </span>
                )}
              </div>
              <div className="text-sm text-gray-700 mt-0.5">
                {it.translation.split('\n')[0]}
              </div>
              {it.contextSentence && (
                <div className="text-xs text-gray-500 mt-1 line-clamp-2">{it.contextSentence}</div>
              )}
              {it.passages.length > 0 && (
                <div className="text-[11px] text-gray-400 mt-1">
                  出自:{it.passages.map((p) => `《${p}》`).join(' ')}
                </div>
              )}
            </div>
          </label>
        ))}
        {data && data.items.length === 0 && (
          <div className="p-8 text-center text-sm text-gray-500">
            该时间段内还没有生词。学生在成绩页点词、或判分后自动收录后就会出现在这里。
          </div>
        )}
      </div>
    </div>
  );
}
