import { useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
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
  const [params] = useSearchParams();
  const classId = params.get('classId') ?? undefined;
  const sessionId = params.get('sessionId') ?? undefined;
  const [token, setToken] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [now, setNow] = useState(new Date());

  // Poll the rolling token every 5s.
  useEffect(() => {
    let cancelled = false;
    async function tick() {
      try {
        const r = await api.qrCurrent({ classId, sessionId });
        if (!cancelled) {
          setToken(r.token);
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

  return (
    <div className="fixed inset-0 bg-white flex flex-col items-center justify-center text-gray-800 select-none">
      <div className="absolute top-6 right-8 text-2xl font-mono tabular-nums">
        {now.toLocaleTimeString('en-GB')}
      </div>
      <div className="absolute top-6 left-8 text-lg font-medium text-gray-600">
        Morning Quiz · ESIC
      </div>

      {error ? (
        <div className="max-w-xl text-center text-rose-600 text-2xl">
          <div className="text-7xl mb-6">⚠️</div>
          {error.includes('no_session_today') || error.includes('not_found')
            ? '今天没有早测安排 / No morning quiz scheduled today.'
            : error}
        </div>
      ) : !scanUrl ? (
        <div className="text-3xl text-gray-400">Loading…</div>
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
