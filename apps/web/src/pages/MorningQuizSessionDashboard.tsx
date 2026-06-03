import { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { api } from '../lib/api';
import { Spinner, ErrorState } from '../components/AsyncState';
import { prettifyPaperName } from '../lib/paperName';

/**
 * R10-Bug2 — `/morning-quiz/sessions/:id/dashboard` was a server-only
 * endpoint with no front-end consumer; round-9 found the URL fell
 * through to the wildcard. This page renders the live per-session view
 * teachers want during the 8:30–9:00 quiz window: who scanned, who
 * submitted, who's still missing, and the auto-graded score line.
 */
export default function MorningQuizSessionDashboard() {
  const { sessionId } = useParams<{ sessionId: string }>();
  const [data, setData] = useState<any | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [clearingStudent, setClearingStudent] = useState<string | null>(null);

  async function reload() {
    if (!sessionId) return;
    setErr(null);
    try {
      const d = await api.morningQuizDashboard(sessionId);
      setData(d);
    } catch (e: any) {
      setErr(String(e?.message ?? e));
    } finally {
      setLoading(false);
    }
  }

  /** Wipe one student's attendance + submission + scripts on this session.
   *  Used after a teacher-led dry-run (e.g. "I tested with 刘思璇 — clean
   *  her test data so tomorrow's real morning dashboard starts clean"). */
  async function handleClearStudent(studentId: string, studentName: string) {
    if (!sessionId) return;
    const confirmed = confirm(
      `清除 ${studentName} 在本场 session 的测试数据？\n\n` +
        `会删除:\n` +
        `  · 考勤记录(attendance)\n` +
        `  · 答卷提交记录(submission)\n` +
        `  · 所有答题记录(answer scripts)\n\n` +
        `不会影响这场 session 本身或其他学生的数据。不可撤销。`,
    );
    if (!confirmed) return;
    setClearingStudent(studentId);
    try {
      const r = await api.morningQuizClearStudentTestData(sessionId, studentId);
      alert(
        `已清除 ${studentName}:\n` +
          `  · attendance: ${r.attendanceDeleted}\n` +
          `  · submission: ${r.submissionDeleted}\n` +
          `  · answer scripts: ${r.scriptDeleted}`,
      );
      await reload();
    } catch (e: any) {
      setErr(String(e?.message ?? e));
    } finally {
      setClearingStudent(null);
    }
  }

  useEffect(() => {
    reload();
    // Auto-refresh every 30s while the page is open so the teacher sees
    // scans land in near-real-time without manual reload.
    const t = setInterval(reload, 30_000);
    return () => clearInterval(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sessionId]);

  if (!sessionId) return <div className="p-6">missing :sessionId</div>;
  if (loading) return <Spinner label="加载早测面板…" />;
  if (err) return (
    <div className="p-6">
      <ErrorState message={err} onRetry={reload} />
      <Link to="/morning-quiz/schedule" className="text-blue-600 text-sm mt-3 block text-center">← back to schedule</Link>
    </div>
  );
  if (!data) return null;

  const { session, counts, attendances } = data;
  const total = (counts?.on_time ?? 0) + (counts?.late ?? 0) + (counts?.absent ?? 0);
  const submitted = (attendances ?? []).filter((a: any) => a.submission?.submittedAt).length;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div>
          <h1 className="text-2xl font-bold">{session?.class?.name} — 早测实时面板</h1>
          <div className="text-sm text-gray-500">
            {prettifyPaperName(session?.paper?.name)} · {new Date(session?.date).toISOString().slice(0, 10)} · status: {session?.status}
          </div>
        </div>
        <button className="btn btn-ghost text-xs" onClick={reload}>↻ 刷新</button>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Stat label="按时" value={counts?.on_time ?? 0} tint="green" />
        <Stat label="迟到" value={counts?.late ?? 0} tint="yellow" />
        <Stat label="缺勤" value={counts?.absent ?? 0} tint="red" />
        <Stat label="已交卷" value={`${submitted} / ${total}`} tint="blue" />
      </div>

      <div className="card">
        <h2 className="font-semibold mb-2">学生明细</h2>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left border-b">
                <th className="py-2 pr-2">学生</th>
                <th className="py-2 pr-2">考勤</th>
                <th className="py-2 pr-2">扫码时间</th>
                <th className="py-2 pr-2">已交卷</th>
                <th className="py-2 pr-2">分数 (auto)</th>
                <th className="py-2 pr-2">答题结束时间</th>
                <th className="py-2 pr-2 text-right"></th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {(attendances ?? []).length === 0 && (
                <tr><td colSpan={7} className="py-4 text-center text-gray-500">还没有学生扫码</td></tr>
              )}
              {(attendances ?? []).map((a: any) => {
                const sid = a.studentId ?? a.student?.id;
                const sname = a.student?.name ?? sid;
                const isClearing = clearingStudent === sid;
                return (
                  <tr key={a.id ?? sid}>
                    <td className="py-2 pr-2">{sname}</td>
                    <td className="py-2 pr-2"><StatusBadge status={a.status} /></td>
                    <td className="py-2 pr-2 text-xs text-gray-500">
                      {a.scanTime ? new Date(a.scanTime).toLocaleTimeString() : '—'}
                    </td>
                    <td className="py-2 pr-2">{a.submission?.submittedAt ? '✓' : '—'}</td>
                    <td className="py-2 pr-2">{a.submission?.totalScore ?? a.submission?.autoScore ?? '—'}</td>
                    <td className="py-2 pr-2 text-xs text-gray-500">
                      {a.submission?.submittedAt ? new Date(a.submission.submittedAt).toLocaleTimeString() : '—'}
                    </td>
                    <td className="py-2 pr-2 text-right">
                      <button
                        onClick={() => handleClearStudent(sid, sname)}
                        disabled={isClearing}
                        className="text-xs px-2 py-1 rounded text-rose-600 hover:bg-rose-50 disabled:opacity-50"
                        title="清除该学生在本场 session 的测试数据(考勤+答卷, 不影响 session 本身)"
                      >
                        {isClearing ? '清除中…' : '🗑️ 清除测试数据'}
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      <div>
        <Link to="/morning-quiz/schedule" className="text-blue-600 text-sm">← back to schedule</Link>
      </div>
    </div>
  );
}

function Stat({ label, value, tint }: { label: string; value: number | string; tint: 'green' | 'yellow' | 'red' | 'blue' }) {
  const cls = {
    green: 'bg-green-50 text-green-800 border-green-200',
    yellow: 'bg-yellow-50 text-yellow-800 border-yellow-200',
    red: 'bg-red-50 text-red-800 border-red-200',
    blue: 'bg-blue-50 text-blue-800 border-blue-200',
  }[tint];
  return (
    <div className={`border rounded-md p-3 ${cls}`}>
      <div className="text-xs uppercase tracking-wide">{label}</div>
      <div className="text-2xl font-bold mt-1">{value}</div>
    </div>
  );
}

function StatusBadge({ status }: { status: string }) {
  const map: Record<string, string> = {
    on_time: 'bg-green-100 text-green-800',
    late: 'bg-yellow-100 text-yellow-800',
    absent: 'bg-red-100 text-red-800',
  };
  const cls = map[status] ?? 'bg-gray-100 text-gray-700';
  const label = ({ on_time: '按时', late: '迟到', absent: '缺勤' } as Record<string, string>)[status] ?? status;
  return <span className={`text-xs px-2 py-0.5 rounded ${cls}`}>{label}</span>;
}
