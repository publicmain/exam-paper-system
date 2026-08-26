import { useCallback, useEffect, useState } from 'react';
import { api } from '../lib/api';
import { vocabScoreShort, type VocabScoreView } from '../lib/vocabScore';

/**
 * 完成度看板（4.0 阶段 A，PRD §4）。
 *
 * 替换原来的出勤视图（出勤 2026-08-24 已停用，那块正好空出来）。
 *
 * 教师每天要在这里找两种人：
 *   · **三个 ○** —— 一点没动，这是要找的人
 *   · **读✓ 背○** —— 卷子做了词没背，明天早读点名
 *
 * 分数保留但退居末列：**完成度是过程指标，分数是结果指标**，两个都要，
 * 但每天盯的是前者。
 */

type SegStatus = 'done' | 'partial' | 'todo' | 'none' | 'auto_closed';

interface Row {
  studentId: string;
  name: string;
  read: SegStatus;
  vocab: SegStatus;
  drill: SegStatus;
  completed: number;
  total: number;
  allDone: boolean;
  score: number | null;
  maxScore: number | null;
  scoresPending: boolean;
  /** P7：正式词汇成绩，与上面的阅读分**分开一列** */
  vocabScore?: VocabScoreView | null;
}

function Mark({ s }: { s: SegStatus }) {
  const map: Record<SegStatus, { t: string; c: string; title: string }> = {
    done: { t: '✓', c: 'text-emerald-600', title: '完成' },
    none: { t: '–', c: 'text-gray-300', title: '今天没有这一段（计入完成）' },
    partial: { t: '◐', c: 'text-amber-500', title: '做了一部分' },
    todo: { t: '○', c: 'text-gray-300', title: '未开始' },
    auto_closed: { t: '◍', c: 'text-gray-400', title: '开了卷没自己交，被系统收卷（不算完成）' },
  };
  const m = map[s];
  return (
    <span className={`${m.c} text-lg`} title={m.title}>
      {m.t}
    </span>
  );
}

export default function LessonBoardPage() {
  const [classes, setClasses] = useState<{ id: string; name: string }[]>([]);
  const [classId, setClassId] = useState('');
  const [data, setData] = useState<any>(null);
  const [err, setErr] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    void (async () => {
      try {
        const list = await api.listClasses();
        const arr = (Array.isArray(list) ? list : list?.items ?? []) as any[];
        setClasses(arr.map((c) => ({ id: c.id, name: c.name })));
        if (arr.length) setClassId((prev) => prev || arr[0].id);
      } catch (e: any) {
        setErr(e?.message ?? String(e));
      }
    })();
  }, []);

  const refresh = useCallback(async () => {
    if (!classId) return;
    setLoading(true);
    try {
      setData(await api.lessonBoard(classId));
      setErr(null);
    } catch (e: any) {
      setErr(e?.message ?? String(e));
    } finally {
      setLoading(false);
    }
  }, [classId]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const rows: Row[] = data?.students ?? [];

  return (
    <div className="p-6 max-w-4xl mx-auto">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <h1 className="text-2xl font-bold text-gray-900">完成度看板</h1>
        <div className="flex items-center gap-2">
          <select
            className="border rounded-lg px-3 py-2"
            value={classId}
            onChange={(e) => setClassId(e.target.value)}
          >
            {classes.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
          <button
            onClick={() => void refresh()}
            disabled={loading}
            className="px-3 py-2 rounded-lg border text-gray-700 disabled:text-gray-300"
          >
            {loading ? '刷新中…' : '刷新'}
          </button>
        </div>
      </div>

      <p className="mt-2 text-sm text-gray-500 leading-relaxed">
        「三个 ○」是今天一点没动的人；「读 ✓ 背 ○」是卷子做了词没背的人。
        <span className="text-gray-400">
          ◍ 表示开了卷但没自己交、被系统收卷 —— 不算完成。
        </span>
      </p>

      {err && <div className="mt-3 text-sm text-rose-600">{err}</div>}

      {data && (
        <>
          <div className="mt-4 flex items-baseline gap-5">
            <div className="text-3xl font-bold text-gray-900">
              {data.allDoneCount}
              <span className="text-gray-400 text-xl"> / {data.total}</span>
            </div>
            <div className="text-sm text-gray-500">
              三段全完成 · 其中{' '}
              <strong className="text-gray-800">{data.untouchedCount}</strong> 人一点没动
            </div>
          </div>

          <table className="mt-4 w-full text-left">
            <thead>
              <tr className="text-[13px] text-gray-500 border-b">
                <th className="py-2 font-medium">姓名</th>
                <th className="py-2 font-medium text-center w-14">读</th>
                <th className="py-2 font-medium text-center w-14">背</th>
                <th className="py-2 font-medium text-center w-14">补</th>
                {/* P7：两项成绩分开成两列 —— 「分数」这个含糊的表头
                    正是它们被混为一谈的地方 */}
                <th className="py-2 font-medium text-right w-20">阅读</th>
                <th className="py-2 font-medium text-right w-20">单词测试</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr
                  key={r.studentId}
                  className={`border-b last:border-0 ${
                    r.completed === 0 ? 'bg-amber-50/50' : ''
                  }`}
                >
                  <td className="py-2 text-gray-900">{r.name}</td>
                  <td className="py-2 text-center">
                    <Mark s={r.read} />
                  </td>
                  <td className="py-2 text-center">
                    <Mark s={r.vocab} />
                  </td>
                  <td className="py-2 text-center">
                    <Mark s={r.drill} />
                  </td>
                  <td className="py-2 text-right text-[13px] text-gray-500">
                    {r.scoresPending ? '待批' : r.score != null ? `${r.score}/${r.maxScore}` : '—'}
                  </td>
                  {/* P7：词汇成绩独立一列。0 分显示 0/8，没考显示「未考」 */}
                  <td
                    className={`py-2 text-right text-[13px] ${
                      r.vocabScore?.status === 'submitted' ? 'text-blue-700 font-medium' : 'text-gray-400'
                    }`}
                    data-testid="board-vocab-score"
                  >
                    {vocabScoreShort(r.vocabScore)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </>
      )}
    </div>
  );
}
