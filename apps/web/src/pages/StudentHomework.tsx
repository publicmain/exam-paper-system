import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { hwApi } from '../lib/api-homework';

const STATUS_CHIP: Record<string, { text: string; cls: string }> = {
  none: { text: '待做', cls: 'bg-amber-100 text-amber-700' },
  in_progress: { text: '作答中', cls: 'bg-blue-100 text-blue-700' },
  submitted: { text: '待批改', cls: 'bg-gray-100 text-gray-600' },
  returned: { text: '已批改', cls: 'bg-green-100 text-green-700' },
};

/** 排序权重：待做/作答中(按截止时间近的在前) → 待批改 → 已批改。 */
function sortWeight(a: any): number {
  const st = a.submission?.status ?? 'none';
  if (st === 'none' || st === 'in_progress') return 0;
  if (st === 'submitted') return 1;
  return 2;
}

export default function StudentHomeworkPage() {
  const [items, setItems] = useState<any[] | null>(null);
  const [err, setErr] = useState('');

  useEffect(() => {
    hwApi.myHomework().then(setItems).catch((e) => setErr(e.message));
  }, []);

  if (err) return <div className="p-4 text-red-600">{err}</div>;
  if (!items) return <div className="p-4 text-gray-500">加载中…</div>;

  const sorted = [...items].sort((a, b) => {
    const w = sortWeight(a) - sortWeight(b);
    if (w !== 0) return w;
    const da = a.dueAt ? new Date(a.dueAt).getTime() : Infinity;
    const db = b.dueAt ? new Date(b.dueAt).getTime() : Infinity;
    return da - db;
  });

  // group by course, preserving sorted order
  const byCourse = new Map<string, { name: string; items: any[] }>();
  for (const a of sorted) {
    const key = a.homework.course?.id ?? 'none';
    if (!byCourse.has(key)) byCourse.set(key, { name: a.homework.course?.name ?? '其他', items: [] });
    byCourse.get(key)!.items.push(a);
  }

  const pendingCount = sorted.filter((a) => sortWeight(a) === 0).length;

  return (
    <div>
      <div className="flex items-baseline justify-between mb-4">
        <h1 className="text-xl font-bold">📚 我的作业</h1>
        {pendingCount > 0 && <span className="text-sm text-amber-700">{pendingCount} 项待完成</span>}
      </div>
      {items.length === 0 && (
        <div className="text-gray-500 text-sm p-8 text-center bg-white rounded border">
          还没有布置作业
        </div>
      )}
      {[...byCourse.values()].map((group) => (
        <div key={group.name} className="mb-6">
          <h2 className="text-sm font-semibold text-gray-500 mb-2">{group.name}</h2>
          <div className="space-y-2">
            {group.items.map((a) => {
              const st = a.submission?.status ?? 'none';
              const chip = STATUS_CHIP[st] ?? STATUS_CHIP.none;
              const due = a.dueAt ? new Date(a.dueAt) : null;
              const overdueSoon = due && st !== 'returned' && st !== 'submitted' &&
                due.getTime() - Date.now() < 24 * 36e5 && due.getTime() > Date.now();
              return (
                <Link key={a.id} to={`/student/homework/${a.id}`}
                  className="block bg-white rounded border p-4 hover:border-blue-400">
                  <div className="flex items-center justify-between gap-3">
                    <div className="min-w-0">
                      <div className="font-medium truncate">{a.homework.title}</div>
                      <div className="text-xs text-gray-500 mt-1">
                        {due ? (
                          <span className={overdueSoon ? 'text-red-600 font-medium' : ''}>
                            截止 {due.toLocaleString()}{overdueSoon && ' ⏰ 快到了'}
                          </span>
                        ) : '无截止时间'}
                        {a.submission?.isLate && <span className="text-red-600"> · 迟交</span>}
                      </div>
                    </div>
                    <div className="flex items-center gap-3 shrink-0">
                      {st === 'returned' && a.submission?.teacherScore != null && (
                        <span className="font-bold text-green-700">
                          {a.submission.teacherScore}{a.homework.totalMarks ? `/${a.homework.totalMarks}` : ''} 分
                        </span>
                      )}
                      <span className={`px-2 py-0.5 rounded text-xs ${chip.cls}`}>{chip.text}</span>
                    </div>
                  </div>
                </Link>
              );
            })}
          </div>
        </div>
      ))}
    </div>
  );
}
