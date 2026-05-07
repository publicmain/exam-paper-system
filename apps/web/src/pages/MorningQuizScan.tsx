import { useEffect, useMemo, useState } from 'react';
import { useParams } from 'react-router-dom';
import { api } from '../lib/api';

interface RosterStudent {
  id: string;
  name: string;
}
interface RosterResponse {
  sessionId: string;
  sessionStatus: string;
  className: string;
  students: RosterStudent[];
}
interface ScanResult {
  attendance: { id: string; status: 'on_time' | 'late' | 'absent'; scanTime: string | null };
  student: { id: string; name: string };
  scanToken: string;
  quizUrl: string;
  remainingMinutes: number;
}

/**
 * Landing page after a student scans the big-screen QR. URL pattern is
 * `/scan/:token`. The flow is now LOGIN-FREE — instead of bouncing through
 * /login, the page fetches the session's class roster (a public endpoint
 * gated by school WiFi + a valid QR token) and lets the student tap their
 * own name. The server returns a short-lived "scan token" which we drop
 * into auth_token so subsequent /morning-quiz/* calls authenticate as that
 * student via the existing AuthGuard. Token expires at session.quizEnd, so
 * it's useless after 9:00.
 */
export default function MorningQuizScan() {
  const { token } = useParams<{ token: string }>();
  const [roster, setRoster] = useState<RosterResponse | null>(null);
  const [error, setError] = useState<{ code: string; message: string } | null>(null);
  const [search, setSearch] = useState('');
  const [submittingId, setSubmittingId] = useState<string | null>(null);

  // Fetch the class roster on mount.
  useEffect(() => {
    if (!token) {
      setError({ code: 'no_token', message: '扫码链接缺少 token,请重新扫一次大屏二维码。' });
      return;
    }
    let cancelled = false;
    api
      .attendanceScanRoster(token)
      .then((r: RosterResponse) => {
        if (cancelled) return;
        setRoster(r);
      })
      .catch((e: any) => {
        if (cancelled) return;
        const raw = e?.message ?? String(e);
        const code = extractCode(raw) ?? (raw.includes('Forbidden') ? 'not_on_school_wifi' : 'unknown');
        setError({ code, message: friendlyMessage(code, raw) });
      });
    return () => {
      cancelled = true;
    };
  }, [token]);

  async function handlePick(student: RosterStudent) {
    if (submittingId || !token) return;
    setSubmittingId(student.id);
    setError(null);
    try {
      const r: ScanResult = await api.attendanceScan(token, student.id);
      // Replace whatever auth_token is in storage (admin/teacher session, or
      // none) with the freshly minted scan token.
      localStorage.setItem('auth_token', r.scanToken);
      // Full page reload to the quiz URL. We chose window.location over
      // react-router's navigate() because the SPA-internal route change
      // races with zustand's auth-state update + React's re-render of
      // App.tsx's auth-gated routes; in some browsers the navigate() call
      // ended up as a no-op while the route table swapped underneath it.
      // A full reload sidesteps the race entirely — the take page boots
      // cleanly with the new auth_token already in place.
      window.location.replace(r.quizUrl);
    } catch (e: any) {
      const raw = e?.message ?? String(e);
      const code = extractCode(raw) ?? (raw.includes('Forbidden') ? 'not_on_school_wifi' : 'unknown');
      setError({ code, message: friendlyMessage(code, raw) });
      setSubmittingId(null);
    }
  }

  // Filter roster by search input. Matches by name substring.
  const filtered = useMemo(() => {
    if (!roster) return [];
    const q = search.trim();
    if (!q) return roster.students;
    return roster.students.filter((s) => s.name.includes(q));
  }, [roster, search]);

  if (error) {
    return (
      <Centered>
        <div className="text-7xl mb-6">⛔</div>
        <div className="text-2xl font-semibold mb-2 text-rose-600">{error.message}</div>
        <div className="text-xs text-gray-400 mt-2 font-mono">code: {error.code}</div>
      </Centered>
    );
  }

  if (!roster) {
    return (
      <Centered>
        <div className="text-2xl text-gray-500">加载班级名单中…</div>
      </Centered>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 px-4 py-6">
      <div className="max-w-2xl mx-auto">
        <header className="mb-4">
          <h1 className="text-2xl font-bold">{roster.className}</h1>
          <p className="text-sm text-gray-500">点你的名字签到 · {roster.students.length} 人</p>
        </header>
        <div className="sticky top-2 z-10 bg-gray-50 pb-3">
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="🔍 搜索你的名字"
            className="w-full px-4 py-3 text-lg border-2 border-gray-200 focus:border-blue-500 rounded-lg outline-none"
            autoFocus
          />
        </div>
        {filtered.length === 0 ? (
          <div className="text-center text-gray-400 mt-12">没找到匹配的名字</div>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 mt-3">
            {filtered.map((s) => (
              <button
                key={s.id}
                onClick={() => handlePick(s)}
                disabled={submittingId !== null}
                className={`px-4 py-4 text-lg font-medium rounded-lg border-2 transition-colors ${
                  submittingId === s.id
                    ? 'bg-blue-600 text-white border-blue-600'
                    : submittingId !== null
                      ? 'bg-gray-100 text-gray-400 border-gray-200 cursor-not-allowed'
                      : 'bg-white border-gray-200 hover:border-blue-500 hover:bg-blue-50 active:bg-blue-100'
                }`}
              >
                {submittingId === s.id ? '签到中…' : s.name}
              </button>
            ))}
          </div>
        )}
        <footer className="mt-6 text-center text-xs text-gray-400">
          Morning Quiz · ESIC · 找不到自己的名字?请联系老师
        </footer>
      </div>
    </div>
  );
}

function Centered({ children }: { children: React.ReactNode }) {
  return (
    <div className="fixed inset-0 bg-white flex flex-col items-center justify-center text-center px-6">
      {children}
    </div>
  );
}

function extractCode(raw: string): string | null {
  const m = raw.match(/code["']?\s*[:=]\s*["']([a-z_]+)["']/i);
  if (m) return m[1];
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
      return '早测窗口尚未开启或已结束。';
    case 'invalid_student':
      return '学生身份校验失败。请联系老师。';
    case 'not_enrolled':
      return '你不在该班级名单中。请确认你扫的是自己班的二维码。';
    case 'attendance_window_not_open':
      return '考勤窗口未开放,请等待大屏倒计时。';
    case 'attendance_window_closed':
      return '考勤窗口已关闭(>8:50)。请联系班主任手工补登。';
    default:
      return raw.length < 200 ? raw : '签到失败,请联系老师。';
  }
}
