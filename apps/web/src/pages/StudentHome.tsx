import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../lib/api';
import { formatCNDateTime } from '../lib/dateCN';
import { Spinner, ErrorState } from '../components/AsyncState';

/**
 * Student home — list assignments visible to the logged-in student.
 * Each assignment shows the paper name, status, and a CTA to open / resume
 * the submission.
 */
export default function StudentHomePage() {
  const [assignments, setAssignments] = useState<any[] | null>(null);
  const [err, setErr] = useState<string | null>(null);

  const load = useCallback(() => {
    setErr(null);
    setAssignments(null);
    api
      .studentAssignments()
      .then(setAssignments)
      .catch((e) => setErr(String(e)));
  }, []);

  useEffect(() => { load(); }, [load]);

  if (err) return <ErrorState message={err} onRetry={load} />;
  if (!assignments) return <Spinner label="加载中…" />;
  if (assignments.length === 0) {
    return (
      <div className="card text-center py-12">
        <div className="text-4xl mb-3">📭</div>
        <div className="text-gray-700">You have no assigned papers yet.</div>
      </div>
    );
  }

  return (
    <div className="space-y-3">
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
              <div className="font-semibold">{a.paper?.name ?? 'Untitled paper'}</div>
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
