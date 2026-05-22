import { useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { QRCodeSVG } from 'qrcode.react';
import { api } from '../lib/api';

/**
 * Printable, permanent morning-quiz QR.
 *
 * Unlike /display (which polls /qr/current for a token that rotates every
 * 15s and therefore needs a laptop left running), this page fetches the
 * class's STATIC v2 token once and renders it. The token never changes,
 * so the workflow is: open this page once → print → stick the sheet on
 * the wall → done forever. No overnight laptop, no projector.
 *
 * URL param:
 *   ?classId=<id>   the class whose permanent QR to render
 */
export default function MorningQuizQrPrint() {
  const [params] = useSearchParams();
  const classId = params.get('classId') ?? undefined;
  const [token, setToken] = useState<string | null>(null);
  const [className, setClassName] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    if (!classId) {
      setError('缺少 classId 参数 / classId is required');
      return;
    }
    api
      .qrStatic(classId)
      .then((r) => {
        if (cancelled) return;
        setToken(r.token);
        setClassName(r.className);
        setError(null);
      })
      .catch((e: any) => {
        if (!cancelled) setError(e.message ?? String(e));
      });
    return () => {
      cancelled = true;
    };
  }, [classId]);

  const scanUrl = useMemo(() => {
    if (!token) return null;
    return `${window.location.origin}/scan/${token}`;
  }, [token]);

  return (
    <div className="fixed inset-0 bg-white flex flex-col items-center justify-center text-gray-800 select-none print:static">
      {error ? (
        <div className="max-w-xl text-center text-rose-600 text-2xl">
          <div className="text-7xl mb-6">⚠️</div>
          {error}
        </div>
      ) : !scanUrl ? (
        <div className="text-3xl text-gray-400">Loading…</div>
      ) : (
        <>
          {className && (
            <div className="mb-6 text-4xl font-bold tracking-tight text-center">
              {className}
            </div>
          )}
          <div className="bg-white p-6 rounded-2xl border-2 border-gray-300">
            <QRCodeSVG value={scanUrl} size={460} level="M" includeMargin={false} />
          </div>
          <div className="mt-8 text-3xl font-semibold tracking-tight">早测签到 · Morning Quiz</div>
          <div className="mt-3 text-xl text-gray-600 text-center max-w-lg">
            每天 08:30–08:40 用手机摄像头扫码签到
            <br />
            Scan with your phone camera to sign in, 08:30–08:40 daily.
          </div>
          <div className="mt-6 text-base text-gray-400 font-mono text-center">
            永久二维码 · 打印后贴墙即可 · 无需每天更换
            <br />
            Permanent QR — print once, stick on the wall.
          </div>
          <button
            type="button"
            onClick={() => window.print()}
            className="mt-8 px-6 py-2.5 rounded-lg bg-indigo-600 text-white text-base font-medium shadow-sm hover:bg-indigo-700 active:bg-indigo-800 print:hidden"
          >
            🖨 打印 · Print
          </button>
        </>
      )}
    </div>
  );
}
