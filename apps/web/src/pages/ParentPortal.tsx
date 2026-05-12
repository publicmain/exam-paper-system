import { useEffect, useState, useCallback } from 'react';
import { useParams } from 'react-router-dom';
import { formatCNDateTime, formatCNTime } from '../lib/dateCN';

/**
 * Feature 14 — Parent portal (read-only).
 *
 * Route: /parent/:token (registered by FE-Admin in App.tsx).
 *
 * Off-campus link given to parents. The token (32-char from ParentLink)
 * authenticates the request; we deliberately render NO admin nav / teacher
 * chrome so a forwarded link can't be confused with a logged-in session.
 *
 * Notes:
 * - We do NOT import lib/api.ts (FE-Admin owns it). Raw fetch only.
 * - All fields are best-effort: if the API hasn't shipped a field yet, we
 *   render '—' rather than crash. This lets BE land in any order.
 */

interface ParentClass {
  id: string;
  name: string;
  code: string;
}

interface ParentAttendance {
  sessionId: string;
  date: string;
  status: 'on_time' | 'late' | 'absent';
  scanTime: string | null;
  paperName: string;
  level: string | null;
}

interface ParentSubmission {
  id: string;
  paperName: string;
  level: string | null;
  autoScore: number;
  maxScore: number;
  percentage: number;
  submittedAt: string;
}

interface ParentSummary {
  onTimeRate: number | null;
  avgScore: number | null;
  lastQuizDate: string | null;
  totalQuizzes: number | null;
}

interface ParentPortalResponse {
  student: { id: string; name: string; archivedAt: string | null };
  classes: ParentClass[];
  recentAttendance: ParentAttendance[];
  recentSubmissions: ParentSubmission[];
  summary: ParentSummary;
}

type LoadState =
  | { kind: 'loading' }
  | { kind: 'ok'; data: ParentPortalResponse }
  | { kind: 'revoked' } // 401 / 410
  | { kind: 'notfound' } // 404
  | { kind: 'neterr' };

function statusBadge(status: ParentAttendance['status']) {
  // Color + text both, so screen-readers and color-blind users both get it.
  if (status === 'on_time') {
    return (
      <span className="inline-block px-2 py-0.5 rounded text-xs font-medium bg-green-100 text-green-800">
        按时
      </span>
    );
  }
  if (status === 'late') {
    return (
      <span className="inline-block px-2 py-0.5 rounded text-xs font-medium bg-amber-100 text-amber-800">
        迟到
      </span>
    );
  }
  return (
    <span className="inline-block px-2 py-0.5 rounded text-xs font-medium bg-red-100 text-red-800">
      缺勤
    </span>
  );
}

function fmtPct(n: number | null | undefined): string {
  if (n == null || isNaN(n as number)) return '—';
  // Backend may send either 0.85 or 85; treat <=1 as a fraction.
  const pct = (n as number) <= 1 ? (n as number) * 100 : (n as number);
  return `${pct.toFixed(1)}%`;
}

function fmtNum(n: number | null | undefined, digits = 1): string {
  if (n == null || isNaN(n as number)) return '—';
  return (n as number).toFixed(digits);
}

export default function ParentPortal() {
  const { token } = useParams<{ token: string }>();
  const [state, setState] = useState<LoadState>({ kind: 'loading' });

  const load = useCallback(async () => {
    if (!token) {
      setState({ kind: 'notfound' });
      return;
    }
    setState({ kind: 'loading' });
    try {
      const res = await fetch(
        `/api/parent/portal?token=${encodeURIComponent(token)}`,
      );
      if (res.status === 401 || res.status === 410) {
        setState({ kind: 'revoked' });
        return;
      }
      if (res.status === 404) {
        setState({ kind: 'notfound' });
        return;
      }
      if (!res.ok) {
        setState({ kind: 'neterr' });
        return;
      }
      const data = (await res.json()) as ParentPortalResponse;
      setState({ kind: 'ok', data });
    } catch {
      setState({ kind: 'neterr' });
    }
  }, [token]);

  useEffect(() => {
    void load();
  }, [load]);

  if (state.kind === 'loading') {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
        <div className="text-gray-500 text-sm">加载中…</div>
      </div>
    );
  }

  if (state.kind === 'revoked') {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
        <div className="max-w-md w-full bg-white rounded-lg shadow p-6 text-center">
          <div className="text-3xl mb-3">🚫</div>
          <div className="text-lg font-semibold text-gray-800 mb-2">
            链接已撤销或过期
          </div>
          <div className="text-sm text-gray-600">
            请联系老师重新生成。
          </div>
        </div>
      </div>
    );
  }

  if (state.kind === 'notfound') {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
        <div className="max-w-md w-full bg-white rounded-lg shadow p-6 text-center">
          <div className="text-3xl mb-3">🔍</div>
          <div className="text-lg font-semibold text-gray-800 mb-2">
            链接无效
          </div>
          <div className="text-sm text-gray-600">
            请联系老师确认链接是否正确。
          </div>
        </div>
      </div>
    );
  }

  if (state.kind === 'neterr') {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
        <div className="max-w-md w-full bg-white rounded-lg shadow p-6 text-center">
          <div className="text-3xl mb-3">⚠️</div>
          <div className="text-lg font-semibold text-gray-800 mb-2">
            网络异常
          </div>
          <div className="text-sm text-gray-600 mb-4">请稍后重试。</div>
          <button
            type="button"
            onClick={() => void load()}
            className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm rounded"
          >
            重试
          </button>
        </div>
      </div>
    );
  }

  // OK branch — pull fields defensively so partial backends don't crash UI.
  const data = state.data;
  const studentName = data.student?.name ?? '—';
  const summary = data.summary ?? ({} as ParentSummary);
  const attendance = Array.isArray(data.recentAttendance)
    ? data.recentAttendance
    : [];
  const submissions = Array.isArray(data.recentSubmissions)
    ? data.recentSubmissions
    : [];
  const classes = Array.isArray(data.classes) ? data.classes : [];

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-4xl mx-auto px-4 py-6 sm:py-8">
        {/* Header */}
        <header className="mb-6">
          <h1 className="text-xl sm:text-2xl font-bold text-gray-900">
            👨‍👩‍👧 {studentName} 的家长查看
          </h1>
          {classes.length > 0 && (
            <div className="mt-1 text-sm text-gray-600">
              班级：{classes.map((c) => c.name).join('、')}
            </div>
          )}
        </header>

        {/* Section 1 — summary stat cards */}
        <section className="mb-6">
          <h2 className="text-sm font-semibold text-gray-700 mb-2">
            本月考勤统计
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div
              className="bg-white rounded-lg shadow-sm p-4"
              aria-label={`按时到课率 ${fmtPct(summary.onTimeRate)}`}
            >
              <div className="text-xs text-gray-500 mb-1">按时到课率</div>
              <div className="text-2xl font-bold text-green-700">
                {fmtPct(summary.onTimeRate)}
              </div>
            </div>
            <div
              className="bg-white rounded-lg shadow-sm p-4"
              aria-label={`平均得分 ${fmtNum(summary.avgScore)}`}
            >
              <div className="text-xs text-gray-500 mb-1">平均得分</div>
              <div className="text-2xl font-bold text-blue-700">
                {fmtNum(summary.avgScore)}
              </div>
            </div>
            <div
              className="bg-white rounded-lg shadow-sm p-4"
              aria-label={`最近一次测试 ${summary.lastQuizDate ?? '—'}`}
            >
              <div className="text-xs text-gray-500 mb-1">最近一次测试</div>
              <div className="text-2xl font-bold text-gray-800">
                {summary.lastQuizDate ?? '—'}
              </div>
            </div>
          </div>
        </section>

        {/* Section 2 — recent attendance */}
        <section className="mb-6">
          <h2 className="text-sm font-semibold text-gray-700 mb-2">
            最近 30 天考勤
          </h2>
          <div className="bg-white rounded-lg shadow-sm overflow-x-auto">
            {attendance.length === 0 ? (
              <div className="p-6 text-center text-sm text-gray-500">
                暂无考勤记录
              </div>
            ) : (
              <table className="w-full text-sm">
                <thead className="bg-gray-50 border-b border-gray-200">
                  <tr>
                    <th
                      scope="col"
                      className="text-left px-3 py-2 font-medium text-gray-600"
                    >
                      日期
                    </th>
                    <th
                      scope="col"
                      className="text-left px-3 py-2 font-medium text-gray-600"
                    >
                      级别
                    </th>
                    <th
                      scope="col"
                      className="text-left px-3 py-2 font-medium text-gray-600"
                    >
                      状态
                    </th>
                    <th
                      scope="col"
                      className="text-left px-3 py-2 font-medium text-gray-600"
                    >
                      扫码时间
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {attendance.map((a) => (
                    <tr
                      key={a.sessionId + a.date}
                      className="border-b border-gray-100 last:border-0"
                    >
                      <td className="px-3 py-2 text-gray-800">
                        {a.date ?? '—'}
                      </td>
                      <td className="px-3 py-2 text-gray-600">
                        {a.level ?? '—'}
                      </td>
                      <td className="px-3 py-2">{statusBadge(a.status)}</td>
                      <td className="px-3 py-2 text-gray-600 font-mono text-xs">
                        {a.scanTime ? formatCNTime(a.scanTime) : '—'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </section>

        {/* Section 3 — recent submissions */}
        <section className="mb-6">
          <h2 className="text-sm font-semibold text-gray-700 mb-2">
            最近 20 次考试
          </h2>
          <div className="bg-white rounded-lg shadow-sm overflow-x-auto">
            {submissions.length === 0 ? (
              <div className="p-6 text-center text-sm text-gray-500">
                暂无考试记录
              </div>
            ) : (
              <table className="w-full text-sm">
                <thead className="bg-gray-50 border-b border-gray-200">
                  <tr>
                    <th
                      scope="col"
                      className="text-left px-3 py-2 font-medium text-gray-600"
                    >
                      试卷
                    </th>
                    <th
                      scope="col"
                      className="text-left px-3 py-2 font-medium text-gray-600"
                    >
                      得分
                    </th>
                    <th
                      scope="col"
                      className="text-left px-3 py-2 font-medium text-gray-600"
                    >
                      百分比
                    </th>
                    <th
                      scope="col"
                      className="text-left px-3 py-2 font-medium text-gray-600"
                    >
                      提交时间
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {submissions.map((s) => (
                    <tr
                      key={s.id}
                      className="border-b border-gray-100 last:border-0"
                    >
                      <td className="px-3 py-2 text-gray-800">
                        {s.paperName ?? '—'}
                      </td>
                      <td className="px-3 py-2 text-gray-700 font-mono text-xs">
                        {s.autoScore != null && s.maxScore != null
                          ? `${s.autoScore} / ${s.maxScore}`
                          : '—'}
                      </td>
                      <td className="px-3 py-2 text-gray-700">
                        {fmtPct(s.percentage)}
                      </td>
                      <td className="px-3 py-2 text-gray-600 font-mono text-xs">
                        {formatCNDateTime(s.submittedAt)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </section>

        {/* Footer note */}
        <footer className="mt-8 text-xs text-gray-400 text-center">
          本页仅供查看，不能修改。链接安全请勿外传。
        </footer>
      </div>
    </div>
  );
}
