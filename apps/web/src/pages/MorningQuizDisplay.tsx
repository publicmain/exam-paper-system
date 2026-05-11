import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { QRCodeSVG } from 'qrcode.react';
import { api } from '../lib/api';

/**
 * Big-screen QR display for the morning attendance hall. Public route — no
 * login required so the venue laptop can show it. Polls /api/qr/current every
 * 5 seconds; the token internally rotates every 15s with 30s tolerance, so
 * a 5-second polling cadence stays well within freshness while keeping the
 * student-facing display lively.
 *
 * URL params:
 *   ?classId=<id>     resolve today's session for that class
 *   ?sessionId=<id>   pin to a specific session (multi-class venues)
 */
export default function MorningQuizDisplay() {
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const classId = params.get('classId') ?? undefined;
  const sessionId = params.get('sessionId') ?? undefined;
  const [token, setToken] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [now, setNow] = useState(new Date());
  // Session lifecycle metadata so the page can render "等待激活" overlay
  // overnight instead of a bare QR. Both fields land via /qr/current.
  const [sessionStatus, setSessionStatus] = useState<string | null>(null);
  const [attendanceStart, setAttendanceStart] = useState<Date | null>(null);

  // Back button: prefer history pop (returns to the schedule/dashboard the
  // operator came from), fall back to "/" if this was opened in a fresh tab.
  function goBack() {
    if (window.history.length > 1) navigate(-1);
    else navigate('/');
  }

  // Poll the rolling token every 5s.
  useEffect(() => {
    let cancelled = false;
    async function tick() {
      try {
        const r = await api.qrCurrent({ classId, sessionId });
        if (!cancelled) {
          setToken(r.token);
          setSessionStatus(r.sessionStatus ?? null);
          setAttendanceStart(r.attendanceStart ? new Date(r.attendanceStart) : null);
          setError(null);
        }
      } catch (e: any) {
        if (!cancelled) setError(e.message ?? String(e));
      }
    }
    tick();
    const id = setInterval(tick, 5_000);
    return () => {
      cancelled = true;
      clearInterval(id);
    };
  }, [classId, sessionId]);

  // Wall clock for the corner.
  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(id);
  }, []);

  const scanUrl = useMemo(() => {
    if (!token) return null;
    const origin = window.location.origin;
    return `${origin}/scan/${token}`;
  }, [token]);

  // When this is true, the QR is rendered but the session hasn't been
  // flipped to `active` yet by the 8:25 cron — typically the "left the
  // laptop running overnight" scenario. We render a soft countdown
  // overlay so the room knows it's intentional, not broken.
  const waitingForActivation = sessionStatus === 'scheduled' && !!attendanceStart;
  const countdownText = useMemo(() => {
    if (!waitingForActivation || !attendanceStart) return null;
    const diffMs = attendanceStart.getTime() - now.getTime();
    if (diffMs <= 0) return null; // about to flip; cron will catch up next tick
    const totalMin = Math.floor(diffMs / 60_000);
    const h = Math.floor(totalMin / 60);
    const m = totalMin % 60;
    if (h > 0) return `${h} 小时 ${m} 分钟后激活`;
    return `${m} 分钟后激活`;
  }, [waitingForActivation, attendanceStart, now]);

  // Pretty-print attendance start "tomorrow 08:30" / "today 08:30" / "Tue 08:30"
  const startTimeText = useMemo(() => {
    if (!attendanceStart) return null;
    const sameDay = attendanceStart.toDateString() === now.toDateString();
    const tomorrow = new Date(now);
    tomorrow.setDate(tomorrow.getDate() + 1);
    const isTomorrow = attendanceStart.toDateString() === tomorrow.toDateString();
    const hhmm = attendanceStart.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' });
    if (sameDay) return `今天 ${hhmm}`;
    if (isTomorrow) return `明早 ${hhmm}`;
    return `${attendanceStart.toLocaleDateString('zh-CN', { month: 'numeric', day: 'numeric', weekday: 'short' })} ${hhmm}`;
  }, [attendanceStart, now]);

  return (
    <div className="fixed inset-0 bg-white flex flex-col items-center justify-center text-gray-800 select-none">
      <div className="absolute top-6 right-8 text-2xl font-mono tabular-nums">
        {now.toLocaleTimeString('en-GB')}
      </div>
      <div className="absolute top-6 left-8 flex items-center gap-4">
        <button
          type="button"
          onClick={goBack}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-gray-300 bg-white text-gray-700 hover:bg-gray-100 active:bg-gray-200 text-sm font-medium shadow-sm transition-colors"
          aria-label="返回 · Back"
        >
          <span aria-hidden="true">←</span>
          <span>返回 · Back</span>
        </button>
        <span className="text-lg font-medium text-gray-600">Morning Quiz · ESIC</span>
      </div>

      {error ? (
        <div className="max-w-xl text-center text-rose-600 text-2xl">
          <div className="text-7xl mb-6">{isWifiError(error) ? '📡' : '⚠️'}</div>
          {isWifiError(error) ? (
            <>
              <div className="font-bold mb-3">需要连接学校 WiFi</div>
              <div className="text-lg text-gray-700 leading-relaxed">
                这个页面只能在学校网络内打开。
                <br />
                请检查电脑/手机的 WiFi 是否已切换到校园网。
              </div>
              <div className="mt-6 text-sm text-gray-400 font-mono">
                School-network only display
              </div>
            </>
          ) : error.includes('no_session_today_or_tomorrow') ? (
            <>今天和明天都没有早测安排 / No morning quiz scheduled today or tomorrow.</>
          ) : error.includes('no_session_today') || error.includes('not_found') ? (
            <>今天没有早测安排 / No morning quiz scheduled today.</>
          ) : (
            error
          )}
        </div>
      ) : !scanUrl ? (
        <div className="text-3xl text-gray-400">Loading…</div>
      ) : waitingForActivation ? (
        // Overnight "leave it open" state — QR is rendered but with a
        // friendly overlay so the room understands it's intentionally
        // waiting, not broken or stuck on yesterday's session.
        <>
          <div className="relative bg-white p-6 rounded-2xl shadow-xl border border-gray-200">
            <QRCodeSVG value={scanUrl} size={420} level="M" includeMargin={false} />
            <div className="absolute inset-0 flex items-center justify-center rounded-2xl bg-white/70 backdrop-blur-sm">
              <div className="text-7xl">🌙</div>
            </div>
          </div>
          <div className="mt-8 text-3xl font-semibold tracking-tight text-indigo-700">
            等待 {startTimeText} 自动激活
          </div>
          <div className="mt-2 text-xl text-gray-500">
            QR will go live at {startTimeText}. Leave this tab open.
          </div>
          {countdownText && (
            <div className="mt-6 text-2xl text-gray-600 font-mono tabular-nums">
              ⏳ {countdownText}
            </div>
          )}
          <div className="mt-4 text-base text-gray-400 font-mono">
            Display stays on; QR auto-refreshes every 15s after activation.
          </div>
        </>
      ) : (
        <>
          <div className="bg-white p-6 rounded-2xl shadow-xl border border-gray-200">
            <QRCodeSVG value={scanUrl} size={420} level="M" includeMargin={false} />
          </div>
          <div className="mt-8 text-3xl font-semibold tracking-tight">
            连接学校 WiFi 后扫描二维码
          </div>
          <div className="mt-2 text-xl text-gray-500">
            Connect to school WiFi, then scan the QR with your phone camera.
          </div>
          <div className="mt-6 text-base text-gray-400 font-mono">
            QR refreshes every 15s · screenshots expire in 30s
          </div>
        </>
      )}
    </div>
  );
}

/** Detect the IpAllowlistGuard rejection by inspecting the error string;
 *  the API returns a structured message mentioning either the literal
 *  "not_on_school_wifi" code or the "allowlist_unconfigured" fallback. */
function isWifiError(msg: string): boolean {
  const m = msg.toLowerCase();
  return (
    m.includes('not_on_school_wifi') ||
    m.includes('allowlist_unconfigured') ||
    m.includes('forbidden')
  );
}
