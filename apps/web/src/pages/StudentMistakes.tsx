import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { hwApi } from '../lib/api-homework';

/**
 * v2 错题本 — 已批改作业里所有失分题，按课程 → 知识点聚合。
 * 数据全部来自 HomeworkGrade（智学网式：批改即采集，错题自动归集）。
 */
export default function StudentMistakesPage() {
  const [items, setItems] = useState<any[] | null>(null);
  const [err, setErr] = useState('');
  const [courseFilter, setCourseFilter] = useState<string>('all');

  useEffect(() => {
    hwApi.myMistakes().then(setItems).catch((e) => setErr(e.message));
  }, []);

  const courses = useMemo(
    () => [...new Set((items ?? []).map((m) => m.course ?? '其他'))],
    [items],
  );
  const shown = useMemo(
    () => (items ?? []).filter((m) => courseFilter === 'all' || (m.course ?? '其他') === courseFilter),
    [items, courseFilter],
  );
  // group by topic
  const byTopic = useMemo(() => {
    const map = new Map<string, any[]>();
    for (const m of shown) {
      const key = m.topic || '未分类';
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(m);
    }
    return [...map.entries()].sort((a, b) => b[1].length - a[1].length);
  }, [shown]);

  if (err) return <div className="p-4 text-red-600">{err}</div>;
  if (!items) return <div className="p-4 text-gray-500">加载中…</div>;

  return (
    <div className="max-w-3xl mx-auto">
      <div className="flex items-baseline justify-between mb-1">
        <h1 className="text-2xl font-bold text-[#2D3B45]">📕 错题本</h1>
        <span className="text-sm text-[#6B7780]">{items.length} 道失分题</span>
      </div>
      <p className="text-sm text-[#6B7780] mb-4">已批改作业中没拿满分的题，按知识点归类。复习就从最多错的开始。</p>

      {courses.length > 1 && (
        <div className="flex gap-1.5 mb-4 flex-wrap">
          <button className={`px-3 py-1 rounded-full text-sm border ${courseFilter === 'all' ? 'bg-[#0374B5] text-white border-[#0374B5]' : 'bg-white border-[#C7CDD1]'}`}
            onClick={() => setCourseFilter('all')}>全部</button>
          {courses.map((c) => (
            <button key={c}
              className={`px-3 py-1 rounded-full text-sm border ${courseFilter === c ? 'bg-[#0374B5] text-white border-[#0374B5]' : 'bg-white border-[#C7CDD1]'}`}
              onClick={() => setCourseFilter(c)}>{c}</button>
          ))}
        </div>
      )}

      {shown.length === 0 && (
        <div className="bg-white border border-[#C7CDD1] rounded-lg p-10 text-center text-[#6B7780]">
          🎉 没有错题 — 已批改的作业全部满分，或还没有批改返回的作业。
        </div>
      )}

      {byTopic.map(([topic, list]) => (
        <section key={topic} className="mb-6">
          <h2 className="text-sm font-semibold text-[#6B7780] uppercase tracking-wide mb-2 flex items-baseline gap-2">
            {topic}
            <span className="text-xs font-normal normal-case text-[#9AA5AF]">{list.length} 题</span>
          </h2>
          <div className="space-y-2">
            {list.map((m) => {
              const lost = m.maxMarks - (m.awarded ?? 0);
              return (
                <Link key={m.gradeId} to={`/student/homework/${m.assignmentId}`}
                  className="block bg-white border border-[#C7CDD1] rounded-lg p-4 hover:border-[#0374B5] transition">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="inline-flex items-center justify-center min-w-8 h-6 px-1.5 rounded bg-gray-800 text-white text-xs font-semibold">
                      {m.label}
                    </span>
                    <span className="text-sm text-[#6B7780] truncate">{m.homework}</span>
                    <span className={`ml-auto text-sm font-bold ${(m.awarded ?? 0) === 0 ? 'text-[#E0061F]' : 'text-amber-600'}`}>
                      {m.awarded} / {m.maxMarks}
                      <span className="text-xs font-normal text-[#9AA5AF] ml-1">−{lost}</span>
                    </span>
                  </div>
                  {m.criteria && (
                    <div className="text-xs text-[#6B7780] mt-2 bg-[#F5F8FA] rounded px-2 py-1.5">📌 要点：{m.criteria}</div>
                  )}
                  {m.comment && (
                    <div className="text-sm text-[#2D3B45] mt-1.5">💬 {m.comment}</div>
                  )}
                  {m.rationale && (
                    <div className="text-xs text-purple-700 mt-1">🤖 {m.rationale}</div>
                  )}
                </Link>
              );
            })}
          </div>
        </section>
      ))}
    </div>
  );
}
