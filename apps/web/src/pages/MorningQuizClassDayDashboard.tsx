import { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { api } from '../lib/api';

/**
 * Aggregated dashboard for one (classId, date). A class can have 1–3
 * sessions per day (one per registered EnglishLevel) and a student picks
 * exactly ONE level on the scan page — meaning a student appears in at
 * most one of the day's sessions. Showing 1–3 separate dashboards forces
 * the teacher to hop between pages just to answer "who scanned today";
 * this page merges them into one roster.
 *
 * Each attendance row keeps its source `sessionId` + `level` so the
 * per-student 🗑️ 清除测试数据 button still calls the right session
 * endpoint, AND the level column shows which band the student took.
 */

const LEVEL_LABEL_SHORT: Record<string, string> = {
  ielts_authentic: '强',
  ielts_simplified: '中',
  olevel: '基',
};

const LEVEL_LABEL_FULL: Record<string, string> = {
  ielts_authentic: '强班 · IELTS Authentic',
  ielts_simplified: '中班 · Simplified',
  olevel: '基础班 · O-Level',
};

export default function MorningQuizClassDayDashboard() {
  const { classId, date } = useParams<{ classId: string; date: string }>();
  const [data, setData] = useState<any | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [clearing, setClearing] = useState<string | null>(null);
  const [regrading, setRegrading] = useState(false);
  const [editingAttendance, setEditingAttendance] = useState<string | null>(null);

  async function reload() {
    if (!classId || !date) return;
    setErr(null);
    try {
      const d = await api.morningQuizClassDayDashboard(classId, date);
      setData(d);
    } catch (e: any) {
      setErr(String(e?.message ?? e));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    reload();
    // Auto-refresh every 30s while the page is open.
    const t = setInterval(reload, 30_000);
    return () => clearInterval(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [classId, date]);

  /** Re-run auto-grading on every session in this (classId, date) group.
   *  Used when the cron locked submissions before a grader fix landed
   *  (e.g. the >80-char skip bug that left long-mark-scheme answers
   *  un-scored). The endpoint is idempotent — running it again on an
   *  already-correctly-graded session is a no-op. */
  async function handleRegrade() {
    if (!data || regrading) return;
    const confirmed = confirm(
      `重新对本班 ${data.sessions.length} 个 level (${data.attendances.filter((a: any) => a.submission?.id).length} 份已交卷) 跑一次自动评分？\n\n` +
        `· MCQ 题: 直接重算\n` +
        `· short_answer 题: 先按字符串匹配, 不中走 Claude AI 评分\n` +
        `· 老师手改的分数(manualScore)不动\n` +
        `· 答题记录(textAnswer)不动\n\n` +
        `适用场景: 前端发现 Marks 框是空的、AI 没评分等。`,
    );
    if (!confirmed) return;
    setRegrading(true);
    let totalSubs = 0;
    let totalScripts = 0;
    let totalDelta = 0;
    try {
      for (const s of data.sessions) {
        const r = await api.morningQuizRegradeSession(s.id);
        totalSubs += r.submissionsRegraded ?? 0;
        totalScripts += r.scriptsUpdated ?? 0;
        totalDelta += r.autoScoreDelta ?? 0;
      }
      alert(
        `重新评分完成:\n` +
          `  · 提交记录处理: ${totalSubs}\n` +
          `  · 答题记录更新: ${totalScripts}\n` +
          `  · auto-score 总分变化: ${totalDelta >= 0 ? '+' : ''}${totalDelta}`,
      );
      await reload();
    } catch (e: any) {
      setErr(String(e?.message ?? e));
    } finally {
      setRegrading(false);
    }
  }

  /** Admin override of a single student's attendance status on the
   *  session they're tied to (or NO session if they were absent — then
   *  the dashboard still shows them under their best-fit session via
   *  the merged-roster dedupe). Writes manual_correction source + a
   *  mandatory note via /api/attendance/correct (audit-logged). */
  async function handleEditAttendance(
    sessionId: string,
    studentId: string,
    studentName: string,
    currentStatus: 'on_time' | 'late' | 'absent',
  ) {
    const STATUS_LABEL: Record<string, string> = {
      on_time: '按时',
      late: '迟到',
      absent: '缺勤',
    };
    const choice = prompt(
      `修改 ${studentName} 的考勤状态\n\n` +
        `当前: ${STATUS_LABEL[currentStatus]}\n\n` +
        `输入新状态:\n` +
        `  1 = 按时\n` +
        `  2 = 迟到\n` +
        `  3 = 缺勤\n\n` +
        `(直接关闭/取消则不改)`,
    );
    if (!choice) return;
    const map: Record<string, 'on_time' | 'late' | 'absent'> = {
      '1': 'on_time',
      '2': 'late',
      '3': 'absent',
      'on_time': 'on_time',
      'late': 'late',
      'absent': 'absent',
    };
    const newStatus = map[choice.trim()];
    if (!newStatus) {
      alert(`无效输入: ${choice}。请输入 1/2/3 或 on_time/late/absent。`);
      return;
    }
    if (newStatus === currentStatus) return;
    const note = prompt(
      `修改原因(必填):\n例如「学生迟到但已到校」「医生证明缺勤」「补充签到」`,
      '',
    );
    if (!note || !note.trim()) {
      alert('原因必填, 操作已取消');
      return;
    }
    setEditingAttendance(studentId);
    try {
      await api.attendanceCorrect({
        sessionId,
        studentId,
        status: newStatus,
        note: note.trim(),
      });
      await reload();
    } catch (e: any) {
      setErr(String(e?.message ?? e));
    } finally {
      setEditingAttendance(null);
    }
  }

  /** Wipe one student's data on the session where they actually
   *  scanned (carried in the row as sessionId). */
  async function handleClearStudent(
    sessionId: string,
    studentId: string,
    studentName: string,
  ) {
    const confirmed = confirm(
      `清除 ${studentName} 在本场 session 的测试数据？\n\n` +
        `会删除:\n` +
        `  · 考勤记录(attendance)\n` +
        `  · 答卷提交记录(submission)\n` +
        `  · 所有答题记录(answer scripts)\n\n` +
        `不会影响这场 session 本身或其他学生的数据。不可撤销。`,
    );
    if (!confirmed) return;
    setClearing(studentId);
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
      setClearing(null);
    }
  }

  if (!classId || !date) return <div className="p-6">missing :classId or :date</div>;
  if (loading) return <div className="p-6 text-gray-500">Loading dashboard…</div>;
  if (err)
    return (
      <div className="p-6">
        <div className="card text-sm text-red-700">{err}</div>
        <Link to="/morning-quiz/schedule" className="text-blue-600 text-sm mt-2 inline-block">
          ← back to schedule
        </Link>
      </div>
    );
  if (!data) return null;

  const { className, sessions, counts, attendances } = data;
  const total = (counts?.on_time ?? 0) + (counts?.late ?? 0) + (counts?.absent ?? 0);
  const submitted = (attendances ?? []).filter((a: any) => a.submission?.submittedAt).length;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div>
          <h1 className="text-2xl font-bold">{className} — 早测实时面板</h1>
          <div className="text-sm text-gray-500">
            {date} · {sessions.length} 个 level
            {sessions.map((s: any, i: number) => (
              <span key={s.id} className="ml-2">
                {i > 0 && '·'}{' '}
                <span className="font-medium">
                  {LEVEL_LABEL_FULL[s.level] ?? s.level}
                </span>{' '}
                <span className="text-gray-400">({s.status})</span>
              </span>
            ))}
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={handleRegrade}
            disabled={regrading}
            className="text-xs px-3 py-1.5 rounded bg-indigo-50 hover:bg-indigo-100 text-indigo-700 disabled:opacity-50"
            title="重新跑自动评分(MCQ 重算 + short_answer 走 Claude AI), 用于救回因 grader bug 没评上的答卷"
          >
            {regrading ? '评分中…' : '🔄 重新评分'}
          </button>
          <button className="btn btn-ghost text-xs" onClick={reload}>
            ↻ 刷新
          </button>
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Stat label="按时" value={counts?.on_time ?? 0} tint="green" />
        <Stat label="迟到" value={counts?.late ?? 0} tint="yellow" />
        <Stat label="缺勤" value={counts?.absent ?? 0} tint="red" />
        <Stat label="已交卷" value={`${submitted} / ${total}`} tint="blue" />
      </div>

      <div className="card">
        <h2 className="font-semibold mb-2">学生明细(合并 {sessions.length} 个 level)</h2>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left border-b">
                <th className="py-2 pr-2">学生</th>
                <th className="py-2 pr-2">选择的 level</th>
                <th className="py-2 pr-2">考勤</th>
                <th className="py-2 pr-2">已交卷</th>
                <th className="py-2 pr-2">分数 (auto)</th>
                <th className="py-2 pr-2">提交时间</th>
                <th className="py-2 pr-2 text-right"></th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {(attendances ?? []).length === 0 && (
                <tr>
                  <td colSpan={7} className="py-4 text-center text-gray-500">
                    还没有学生扫码
                  </td>
                </tr>
              )}
              {(attendances ?? []).map((a: any) => {
                const sid = a.studentId ?? a.student?.id;
                const sname = a.student?.name ?? sid;
                const isClearing = clearing === sid;
                const lvShort = LEVEL_LABEL_SHORT[a.level] ?? '?';
                const lvFull = LEVEL_LABEL_FULL[a.level] ?? a.level;
                return (
                  <tr key={a.id ?? `${a.sessionId}:${sid}`}>
                    <td className="py-2 pr-2">{sname}</td>
                    <td className="py-2 pr-2">
                      <span
                        className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs border border-gray-200 bg-gray-50 text-gray-700"
                        title={lvFull}
                      >
                        {lvShort}
                      </span>
                    </td>
                    <td className="py-2 pr-2">
                      <button
                        type="button"
                        onClick={() => handleEditAttendance(a.sessionId, sid, sname, a.status)}
                        disabled={editingAttendance === sid}
                        className="hover:ring-2 hover:ring-blue-300 rounded transition-shadow disabled:opacity-50"
                        title="点击修改考勤状态(管理员)"
                      >
                        <StatusBadge status={a.status} />
                      </button>
                    </td>
                    <td className="py-2 pr-2">{a.submission?.submittedAt ? '✓' : '—'}</td>
                    <td className="py-2 pr-2">
                      {a.submission?.totalScore ?? a.submission?.autoScore ?? '—'}
                    </td>
                    <td className="py-2 pr-2 text-xs text-gray-500">
                      {a.submission?.submittedAt
                        ? new Date(a.submission.submittedAt).toLocaleTimeString()
                        : '—'}
                    </td>
                    <td className="py-2 pr-2 text-right whitespace-nowrap">
                      {a.submission?.id && (
                        <Link
                          to={`/marker/submission/${a.submission.id}`}
                          className="text-xs px-2 py-1 rounded text-blue-600 hover:bg-blue-50 mr-1"
                          title="逐题查看该学生的答案 / 自动评分 / AI 评语, 也可手动改分"
                        >
                          📝 查看答题
                        </Link>
                      )}
                      <button
                        onClick={() => handleClearStudent(a.sessionId, sid, sname)}
                        disabled={isClearing}
                        className="text-xs px-2 py-1 rounded text-rose-600 hover:bg-rose-50 disabled:opacity-50"
                        title="清除该学生在所选 level 的测试数据(考勤+答卷, 不影响 session 本身)"
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
        <Link to="/morning-quiz/schedule" className="text-blue-600 text-sm">
          ← back to schedule
        </Link>
      </div>
    </div>
  );
}

function Stat({
  label,
  value,
  tint,
}: {
  label: string;
  value: number | string;
  tint: 'green' | 'yellow' | 'red' | 'blue';
}) {
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
  const label =
    ({ on_time: '按时', late: '迟到', absent: '缺勤' } as Record<string, string>)[status] ??
    status;
  return <span className={`text-xs px-2 py-0.5 rounded ${cls}`}>{label}</span>;
}
