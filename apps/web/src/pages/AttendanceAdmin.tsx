import { useEffect, useState } from 'react';
import { useSearchParams, Navigate } from 'react-router-dom';
import { api } from '../lib/api';

type Status = 'on_time' | 'late' | 'absent';

interface ClassRow {
  id: string;
  name: string;
  classCode: string;
}

interface AttendanceRow {
  id: string;
  status: Status;
  scanTime: string | null;
  sourceIp: string | null;
  source: 'qr_scan' | 'manual_correction';
  correctedNote: string | null;
  student: { id: string; name: string };
  session: { id: string; date: string; status: string };
}

const STATUS_BADGE: Record<Status, string> = {
  on_time: 'bg-green-100 text-green-700',
  late: 'bg-amber-100 text-amber-700',
  absent: 'bg-rose-100 text-rose-700',
};

/**
 * Class teacher / admin view of attendance history with the manual override
 * flow. Filter by class + date range, see who scanned vs who got an absent
 * row from the 9:00 cron, click "fix" to upsert a manual_correction (with
 * mandatory note) — every change goes to AuditLog.
 */
export default function AttendanceAdmin() {
  const [params] = useSearchParams();
  // Bug 10: when external callers pass ?sessionId=... (e.g. older links),
  // redirect to the new merged class-day dashboard which actually drives
  // off the session. Without this redirect the page silently ignored the
  // sessionId and just showed the last-7-days range — confusing.
  const sessionIdParam = params.get('sessionId');
  const [redirectTo, setRedirectTo] = useState<string | null>(null);
  useEffect(() => {
    if (!sessionIdParam) return;
    // Look up the session's classId + date via the dashboard endpoint
    // and bounce. If the session isn't found, stay on this page (legacy
    // history view is still useful as a fallback).
    api.morningQuizDashboard(sessionIdParam)
      .then((d: any) => {
        const cid = d?.session?.class?.id;
        const dateStr = d?.session?.date ? String(d.session.date).slice(0, 10) : null;
        if (cid && dateStr) {
          setRedirectTo(`/morning-quiz/classes/${cid}/date/${dateStr}/dashboard`);
        }
      })
      .catch(() => {/* fall through to range view */});
  }, [sessionIdParam]);
  if (redirectTo) return <Navigate to={redirectTo} replace />;

  const [classes, setClasses] = useState<ClassRow[]>([]);
  const [classId, setClassId] = useState<string>('');
  const [from, setFrom] = useState<string>(() => {
    const d = new Date();
    d.setDate(d.getDate() - 7);
    return d.toISOString().slice(0, 10);
  });
  const [to, setTo] = useState<string>(() => new Date().toISOString().slice(0, 10));
  const [rows, setRows] = useState<AttendanceRow[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [editing, setEditing] = useState<{ row: AttendanceRow; status: Status; note: string } | null>(null);

  useEffect(() => {
    api
      .listClasses()
      .then((cs: ClassRow[]) => {
        setClasses(cs);
        if (cs.length > 0 && !classId) setClassId(cs[0].id);
      })
      .catch((e: any) => setError(e.message));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function refresh() {
    if (!classId) return;
    try {
      const r = await api.attendanceHistory({ classId, from, to });
      setRows(r);
    } catch (e: any) {
      setError(e.message ?? String(e));
    }
  }

  useEffect(() => {
    refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [classId, from, to]);

  async function handleSaveCorrection() {
    if (!editing) return;
    if (!editing.note.trim()) {
      setError('请填写补登原因');
      return;
    }
    try {
      await api.attendanceCorrect({
        sessionId: editing.row.session.id,
        studentId: editing.row.student.id,
        status: editing.status,
        note: editing.note.trim(),
      });
      setEditing(null);
      await refresh();
    } catch (e: any) {
      setError(e.message ?? String(e));
    }
  }

  const counts = rows.reduce(
    (acc, r) => {
      acc[r.status] = (acc[r.status] ?? 0) + 1;
      return acc;
    },
    {} as Record<Status, number>,
  );

  return (
    <div>
      <h1 className="text-2xl font-bold mb-4">考勤记录 · Attendance</h1>

      {error && (
        <div className="mb-4 px-4 py-2 bg-rose-50 border border-rose-200 text-rose-700 rounded text-sm">
          {error}
        </div>
      )}

      <div className="bg-white border rounded-lg p-4 mb-4 flex flex-wrap items-center gap-4">
        <label className="text-sm">
          班级
          <select
            value={classId}
            onChange={(e) => setClassId(e.target.value)}
            className="ml-2 border rounded px-2 py-1"
          >
            {classes.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
        </label>
        <label className="text-sm">
          从
          <input
            type="date"
            value={from}
            onChange={(e) => setFrom(e.target.value)}
            className="ml-2 border rounded px-2 py-1"
          />
        </label>
        <label className="text-sm">
          到
          <input
            type="date"
            value={to}
            onChange={(e) => setTo(e.target.value)}
            className="ml-2 border rounded px-2 py-1"
          />
        </label>
        <div className="ml-auto text-sm flex gap-3">
          <span className="text-green-700">✓ {counts.on_time ?? 0}</span>
          <span className="text-amber-700">迟 {counts.late ?? 0}</span>
          <span className="text-rose-700">缺 {counts.absent ?? 0}</span>
        </div>
      </div>

      <table className="w-full bg-white border rounded-lg text-sm">
        <thead className="text-left text-gray-500 border-b">
          <tr>
            <th className="px-4 py-2">日期</th>
            <th>学生</th>
            <th>状态</th>
            <th>扫码时间</th>
            <th>来源</th>
            <th>备注</th>
            <th></th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.id} className="border-b last:border-0 hover:bg-gray-50">
              <td className="px-4 py-2 font-mono">{r.session.date.slice(0, 10)}</td>
              <td>{r.student.name}</td>
              <td>
                <span className={`badge text-xs px-2 py-0.5 rounded ${STATUS_BADGE[r.status]}`}>
                  {r.status}
                </span>
              </td>
              <td className="font-mono text-xs">
                {r.scanTime ? new Date(r.scanTime).toLocaleTimeString('en-GB') : '—'}
              </td>
              <td className="text-xs text-gray-500">
                {r.source === 'qr_scan' ? `QR ${r.sourceIp ?? ''}` : '👤 手工'}
              </td>
              <td className="text-xs text-gray-600">{r.correctedNote ?? ''}</td>
              <td className="text-right pr-4">
                <button
                  className="text-blue-600 hover:underline text-xs"
                  onClick={() =>
                    setEditing({ row: r, status: r.status, note: r.correctedNote ?? '' })
                  }
                >
                  补登
                </button>
              </td>
            </tr>
          ))}
          {rows.length === 0 && (
            <tr>
              <td colSpan={7} className="px-4 py-8 text-center text-gray-400">
                所选范围内没有记录
              </td>
            </tr>
          )}
        </tbody>
      </table>

      {editing && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg shadow-xl p-6 max-w-md w-full">
            <h3 className="font-semibold mb-3">手工补登</h3>
            <div className="text-sm text-gray-600 mb-4">
              {editing.row.student.name} · {editing.row.session.date.slice(0, 10)}
            </div>
            <label className="text-sm block mb-3">
              新状态
              <select
                value={editing.status}
                onChange={(e) =>
                  setEditing({ ...editing, status: e.target.value as Status })
                }
                className="ml-2 border rounded px-2 py-1"
              >
                <option value="on_time">on_time</option>
                <option value="late">late</option>
                <option value="absent">absent</option>
              </select>
            </label>
            <label className="text-sm block">
              补登原因(必填,会写入审计日志)
              <textarea
                value={editing.note}
                onChange={(e) => setEditing({ ...editing, note: e.target.value })}
                className="mt-1 w-full border rounded px-2 py-1 min-h-[80px]"
                placeholder="如:学生 8:33 到校,地铁延误"
              />
            </label>
            <div className="mt-4 flex justify-end gap-3">
              <button
                className="px-4 py-1.5 text-gray-600 hover:bg-gray-100 rounded"
                onClick={() => setEditing(null)}
              >
                取消
              </button>
              <button
                className="px-4 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded"
                onClick={handleSaveCorrection}
              >
                保存
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
