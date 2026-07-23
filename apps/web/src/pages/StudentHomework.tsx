import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { hwApi } from '../lib/api-homework';

const STATUS_CHIP: Record<string, { text: string; cls: string }> = {
  none: { text: '待做', cls: 'bg-amber-100 text-amber-700' },
  in_progress: { text: '作答中', cls: 'bg-blue-100 text-blue-700' },
  submitted: { text: '已提交', cls: 'bg-gray-100 text-gray-600' },
  returned: { text: '已批改', cls: 'bg-green-100 text-green-700' },
};

/** 学生作业列表，按课程分组。 */
export default function StudentHomeworkPage() {
  const [items, setItems] = useState<any[] | null>(null);
  const [err, setErr] = useState('');

  useEffect(() => {
    hwApi.myHomework().then(setItems).catch((e) => setErr(e.message));
  }, []);

  if (err) return <div className="p-4 text-red-600">{err}</div>;
  if (!items) return <div className="p-4 text-gray-500">Loading…</div>;

  // group by course
  const byCourse = new Map<string, { name: string; items: any[] }>();
  for (const a of items) {
    const key = a.homework.course?.id ?? 'none';
    if (!byCourse.has(key)) byCourse.set(key, { name: a.homework.course?.name ?? 'Other', items: [] });
    byCourse.get(key)!.items.push(a);
  }

  return (
    <div>
      <h1 className="text-xl font-bold mb-4">📚 Homework</h1>
      {items.length === 0 && (
        <div className="text-gray-500 text-sm p-8 text-center bg-white rounded border">
          No homework assigned yet.
        </div>
      )}
      {[...byCourse.values()].map((group) => (
        <div key={group.name} className="mb-6">
          <h2 className="text-sm font-semibold text-gray-500 mb-2">{group.name}</h2>
          <div className="space-y-2">
            {group.items.map((a) => {
              const st = a.submission?.status ?? 'none';
              const chip = STATUS_CHIP[st] ?? STATUS_CHIP.none;
              return (
                <Link key={a.id} to={`/student/homework/${a.id}`}
                  className="block bg-white rounded border p-4 hover:border-blue-400">
                  <div className="flex items-center justify-between gap-3">
                    <div className="min-w-0">
                      <div className="font-medium truncate">{a.homework.title}</div>
                      <div className="text-xs text-gray-500 mt-1">
                        {a.dueAt ? `Due ${new Date(a.dueAt).toLocaleString()}` : 'No due date'}
                        {a.submission?.isLate && <span className="text-red-600"> · late</span>}
                      </div>
                    </div>
                    <div className="flex items-center gap-3 shrink-0">
                      {st === 'returned' && a.submission?.teacherScore != null && (
                        <span className="font-bold text-green-700">
                          {a.submission.teacherScore}{a.homework.totalMarks ? `/${a.homework.totalMarks}` : ''}
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
