import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useAuth } from '../lib/auth';
import { api } from '../lib/api';

interface ScanResult {
  attendance: { id: string; status: 'on_time' | 'late' | 'absent'; scanTime: string | null };
  quizUrl: string;
  remainingMinutes: number;
}

/**
 * Landing page after a student scans the big-screen QR. URL pattern is
 * `/scan/:token`. The token IS the entire scan payload — the page POSTs it
 * to /api/attendance/scan, which runs the 5-gate check (IP allowlist, QR
 * freshness, session active, enrollment, time window). On success we
 * forward to the quiz page; on any failure we render a precise, actionable
 * Chinese message keyed off the server's error code.
 */
export default function MorningQuizScan() {
  const { token } = useParams<{ token: string }>();
  const { user, loading } = useAuth();
  const navigate = useNavigate();
  const [state, setState] = useState<
    | { kind: 'loading' }
    | { kind: 'success'; result: ScanResult }
    | { kind: 'error'; code: string; message: string }
  >({ kind: 'loading' });

  useEffect(() => {
    if (loading) return;
    if (!user) {
      // Not logged in — bounce to login, preserve return path.
      navigate(`/login?next=${encodeURIComponent(`/scan/${token}`)}`, { replace: true });
      return;
    }
    if (user.role !== 'student') {
      setState({
        kind: 'error',
        code: 'wrong_role',
        message: '只有学生账号可以扫码考勤。请用学生账号登录。',
      });
      return;
    }
    if (!token) {
      setState({ kind: 'error', code: 'no_token', message: '扫码链接缺少 token。请重新扫一次。' });
      return;
    }
    let cancelled = false;
    api
      .attendanceScan(token)
      .then((r: ScanResult) => {
        if (cancelled) return;
        setState({ kind: 'success', result: r });
        // Brief confirmation flash, then forward to quiz.
        setTimeout(() => navigate(r.quizUrl, { replace: true }), 1200);
      })
      .catch((e: any) => {
        if (cancelled) return;
        const raw = e?.message ?? String(e);
        // Map error codes to friendly Chinese messages.
        const code =
          extractCode(raw) ?? (raw.includes('Forbidden') ? 'not_on_school_wifi' : 'unknown');
        setState({ kind: 'error', code, message: friendlyMessage(code, raw) });
      });
    return () => {
      cancelled = true;
    };
  }, [token, user, loading, navigate]);

  if (state.kind === 'loading') {
    return (
      <Centered>
        <div className="text-2xl text-gray-500">正在签到…</div>
      </Centered>
    );
  }
  if (state.kind === 'success') {
    const s = state.result;
    return (
      <Centered>
        <div className="text-7xl mb-6">{s.attendance.status === 'on_time' ? '✅' : '⏱️'}</div>
        <div className="text-3xl font-semibold mb-2">
          {s.attendance.status === 'on_time' ? '签到成功' : '签到成功(迟到)'}
        </div>
        <div className="text-gray-500">即将进入早测,剩余 {s.remainingMinutes} 分钟</div>
      </Centered>
    );
  }
  return (
    <Centered>
      <div className="text-7xl mb-6">⛔</div>
      <div className="text-2xl font-semibold mb-2 text-rose-600">{state.message}</div>
      <div className="text-sm text-gray-400 mt-2 font-mono">code: {state.code}</div>
      <button
        className="mt-8 px-6 py-2 bg-gray-100 hover:bg-gray-200 rounded-md text-gray-700"
        onClick={() => navigate('/student', { replace: true })}
      >
        返回首页
      </button>
    </Centered>
  );
}

function Centered({ children }: { children: React.ReactNode }) {
  return (
    <div className="fixed inset-0 bg-white flex flex-col items-center justify-center text-center px-6">
      {children}
    </div>
  );
}

/** Pull a `code: "x_y_z"` string out of a raw Nest exception message. */
function extractCode(raw: string): string | null {
  const m = raw.match(/code["']?\s*[:=]\s*["']([a-z_]+)["']/i);
  if (m) return m[1];
  // Some exceptions stringify to JSON; try parse.
  try {
    const j = JSON.parse(raw);
    if (j?.code) return j.code as string;
  } catch {
    /* not json */
  }
  return null;
}

function friendlyMessage(code: string, raw: string): string {
  switch (code) {
    case 'not_on_school_wifi':
    case 'allowlist_unconfigured':
      return '请连接学校 WiFi 后再扫码(检测到你不在校园网内)。';
    case 'qr_expired':
    case 'qr_from_future':
      return '二维码已过期。请重新扫一次大屏上的最新二维码。';
    case 'qr_invalid':
    case 'qr_malformed':
      return '二维码无效或格式错误。请直接用手机相机扫描大屏。';
    case 'qr_session_not_found':
    case 'session_not_found':
      return '今天没有早测安排,请联系老师。';
    case 'session_not_active':
      return '早测窗口尚未开启。请等到 8:30 准时开始。';
    case 'not_enrolled':
      return '你不在该班级名单中。请确认你扫的是自己班的二维码。';
    case 'attendance_window_not_open':
      return '考勤窗口未开放。请等待大屏倒计时。';
    case 'attendance_window_closed':
      return '考勤窗口已关闭(>8:50)。请联系班主任手工补登。';
    default:
      return raw.length < 200 ? raw : '签到失败,请联系老师。';
  }
}
