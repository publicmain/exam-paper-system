import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../lib/api';
import { hwApi } from '../lib/api-homework';
import { formatCNDateTime } from '../lib/dateCN';
import { Spinner, ErrorState } from '../components/AsyncState';
import { prettifyPaperName } from '../lib/paperName';

/**
 * Student home — list assignments visible to the logged-in student.
 * Each assignment shows the paper name, status, and a CTA to open / resume
 * the submission.
 *
 * P0 (UX round 1): pending HOMEWORK surfaces here too. Students land on
 * this page after login and previously had no idea homework existed until
 * they clicked the nav — new homework was invisible.
 */
export default function StudentHomePage() {
  const [assignments, setAssignments] = useState<any[] | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [pendingHw, setPendingHw] = useState<any[]>([]);

  const load = useCallback(() => {
    setErr(null);
    setAssignments(null);
    api
      .studentAssignments()
      .then(setAssignments)
      .catch((e) => setErr(String(e)));
    // Homework is a secondary fetch — failure must not break the papers list.
    hwApi
      .myHomework()
      .then((items: any[]) =>
        setPendingHw(
          items
            .filter((a) => !a.submission || a.submission.status === 'in_progress')
            .sort((a, b) => {
              const da = a.dueAt ? new Date(a.dueAt).getTime() : Infinity;
              const db = b.dueAt ? new Date(b.dueAt).getTime() : Infinity;
              return da - db;
            }),
        ),
      )
      .catch(() => {});
  }, []);

  useEffect(() => { load(); }, [load]);

  if (err) return <ErrorState message={err} onRetry={load} />;
  if (!assignments) return <Spinner label="加载中…" />;

  const homeworkBanner = pendingHw.length > 0 && (
    <div className="bg-amber-50 border-2 border-amber-300 rounded-lg p-4 mb-4">
      <div className="flex items-center justify-between mb-2">
        <span className="font-semibold text-amber-800">📚 你有 {pendingHw.length} 项作业待完成</span>
        <Link to="/student/homework" className="text-sm text-blue-600 hover:underline">全部作业 →</Link>
      </div>
      <div className="space-y-1">
        {pendingHw.slice(0, 3).map((a) => (
          <Link key={a.id} to={`/student/homework/${a.id}`}
            className="flex items-center justify-between text-sm bg-white rounded border px-3 py-2 hover:border-amber-400">
            <span className="truncate">{a.homework.title}</span>
            <span className="text-xs text-gray-500 shrink-0 ml-2">
              {a.dueAt ? `截止 ${new Date(a.dueAt).toLocaleString()}` : '无截止'}
            </span>
          </Link>
        ))}
      </div>
    </div>
  );

  if (assignments.length === 0) {
    return (
      <div>
        {homeworkBanner}
        <div className="card text-center py-12">
          <div className="text-4xl mb-3">📭</div>
          <div className="text-gray-700">暂无试卷 · No assigned papers yet.</div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {homeworkBanner}
      <h1 className="text-2xl font-bold mb-4">My Papers</h1>
      {assignments.map((a) => {
        const sub = a.mySubmission;
        const ctaLabel = !sub
          ? 'Start'
          : sub.status === 'in_progress'
          ? 'Resume'
          : sub.status === 'submitted'
          ? 'Submitted — view'
          : sub.status === 'marked' || sub.status === 'returned'
          ? `Score: ${Math.round(sub.totalScore ?? sub.autoScore ?? 0)} / ${sub.maxScore}`
          : 'Open';
        const closed = a.dueAt && new Date(a.dueAt) < new Date();
        return (
          <div key={a.id} className="card flex items-start justify-between gap-4">
            <div className="flex-1 min-w-0">
              <div className="font-semibold">{prettifyPaperName(a.paper?.name) || 'Untitled paper'}</div>
              <div className="text-xs text-gray-600 mt-1">
                Class: {a.class?.name} ({a.class?.classCode})
                {a.durationMin || a.paper?.durationMin ? ` · ${a.durationMin ?? a.paper?.durationMin} min` : ''}
                {a.paper?.totalMarksActual ? ` · ${a.paper.totalMarksActual} marks` : ''}
              </div>
              {a.dueAt && (
                <div className="text-xs text-gray-500 mt-0.5">
                  Due: {formatCNDateTime(a.dueAt)}
                  {closed && <span className="ml-2 text-red-700">closed</span>}
                </div>
              )}
            </div>
            <Link
              to={`/student/take/${a.id}`}
              className={`btn ${sub?.status === 'submitted' || sub?.status === 'marked' || sub?.status === 'returned' ? 'btn-ghost' : 'btn-primary'}`}
            >
              {ctaLabel}
            </Link>
          </div>
        );
      })}
    </div>
  );
}
