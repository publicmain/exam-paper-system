import { useEffect, useRef, useState } from 'react';

/** Live countdown to `endsAt`. Goes red in the last 5 minutes — matches the
 *  IELTS Computer-Delivered colour cue. Calls `onTimeUp` exactly once when
 *  the remaining time hits zero so the host page can auto-submit.
 *
 *  Stale-link guard: if `endsAt` is already in the past at mount (e.g. a
 *  student opens an expired QR link, or hits browser-back into a finished
 *  session) we used to fire `onTimeUp` immediately on the first render,
 *  which silently auto-submitted a blank attempt scored 0. We now:
 *    1. Gate `onTimeUp` behind a 1500ms post-mount delay, so a stale-at-
 *       mount link can never trigger an instant blank submit.
 *    2. Optionally surface `onAlreadyExpired` to the parent so it can swap
 *       in a friendly "时间已过期，请联系老师" UI instead of submitting.
 *  If `onAlreadyExpired` is omitted, behaviour falls back to the gated
 *  `onTimeUp` path so existing call sites are unaffected. */
export function Timer({
  endsAt,
  onTimeUp,
  onAlreadyExpired,
}: {
  endsAt: string;
  onTimeUp?: () => void;
  onAlreadyExpired?: () => void;
}) {
  const [now, setNow] = useState(Date.now());
  const [fired, setFired] = useState(false);
  const mountTimeRef = useRef(Date.now());
  const expiredAtMount = new Date(endsAt).getTime() - mountTimeRef.current < 0;
  const [expiredNotified, setExpiredNotified] = useState(false);
  // Transient "time is running out" toast. Fires once when the countdown
  // crosses below 2 minutes and again below 30 seconds. Self-service
  // students have no teacher calling out the time, so these on-screen
  // nudges are the only warning they get. Purely presentational — this
  // never touches the onTimeUp / auto-submit path below.
  const [toast, setToast] = useState<null | 'two' | 'thirty'>(null);
  const warnedTwoRef = useRef(false);
  const warnedThirtyRef = useRef(false);

  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, []);

  // Notify parent once on mount if the link was already expired when the
  // component appeared. This lets Take.tsx (or any other host) render its
  // own "expired" branch instead of receiving a phantom `onTimeUp`.
  useEffect(() => {
    if (expiredAtMount && !expiredNotified) {
      setExpiredNotified(true);
      onAlreadyExpired?.();
    }
  }, [expiredAtMount, expiredNotified, onAlreadyExpired]);

  const remainingMs = Math.max(0, new Date(endsAt).getTime() - now);
  useEffect(() => {
    if (remainingMs !== 0 || fired) return;
    // Stale-link guard: only fire onTimeUp if we've been mounted long
    // enough that hitting zero represents a genuine countdown finish,
    // not an at-mount stale `endsAt`. Without this, opening an already-
    // expired link would auto-submit a blank attempt on the first render.
    if (Date.now() - mountTimeRef.current <= 1500) return;
    // If the parent opted into the friendlier expired-at-mount path,
    // suppress the auto-submit entirely once we've notified it.
    if (expiredAtMount && onAlreadyExpired) return;
    setFired(true);
    onTimeUp?.();
  }, [remainingMs, fired, onTimeUp, expiredAtMount, onAlreadyExpired]);

  // Cross-below-threshold warnings. Kept separate from the onTimeUp effect
  // so a bug here can never affect auto-submit. Each threshold fires at most
  // once (ref guard). Suppressed entirely on a stale/expired-at-mount link.
  useEffect(() => {
    if (expiredAtMount) return;
    if (remainingMs <= 0) return;
    if (remainingMs <= 30_000 && !warnedThirtyRef.current) {
      warnedThirtyRef.current = true;
      warnedTwoRef.current = true; // never downgrade back to the 2-min toast
      setToast('thirty');
    } else if (remainingMs <= 120_000 && !warnedTwoRef.current) {
      warnedTwoRef.current = true;
      setToast('two');
    }
  }, [remainingMs, expiredAtMount]);

  // Auto-dismiss the toast a few seconds after it appears. The 30-second
  // toast intentionally lingers a little longer (8s) so it's still visible
  // as the clock runs out.
  useEffect(() => {
    if (!toast) return;
    const ttl = toast === 'thirty' ? 8000 : 6000;
    const id = setTimeout(() => setToast(null), ttl);
    return () => clearTimeout(id);
  }, [toast]);

  // When the link was already expired at mount AND the parent provided a
  // dedicated handler, render an inline notice instead of the running
  // countdown — the parent will swap its own UI shortly, but this avoids
  // showing a confusing "00:00" in red for one paint.
  if (expiredAtMount && onAlreadyExpired) {
    return (
      <div
        className="text-sm lg:text-base text-rose-600 font-medium"
        role="status"
      >
        时间已过期，请联系老师
      </div>
    );
  }

  const mm = String(Math.floor(remainingMs / 60_000)).padStart(2, '0');
  const ss = String(Math.floor((remainingMs % 60_000) / 1000)).padStart(2, '0');
  const danger = remainingMs < 5 * 60_000;
  const warn = !danger && remainingMs < 10 * 60_000;

  const atZero = remainingMs === 0;
  return (
    <>
      <div
        className={`font-mono tabular-nums text-2xl lg:text-3xl ${
          danger ? 'text-rose-600' : warn ? 'text-amber-600' : 'text-gray-700'
        }`}
        aria-live={danger ? 'polite' : 'off'}
        aria-label={`Remaining time ${mm}:${ss}`}
      >
        {mm}:{ss}
      </div>

      {/* At zero, a brief "time's up" cue before the host auto-submits and
          navigates away. Fixed overlay, so it never disturbs header layout. */}
      {atZero && (
        <div
          className="fixed inset-x-0 top-3 z-[60] flex justify-center px-4 pointer-events-none"
          role="status"
        >
          <div className="rounded-full bg-rose-600 text-white text-sm font-semibold px-4 py-2 shadow-lg">
            ⏰ 时间到 · Time's up
          </div>
        </div>
      )}

      {/* Running-out warning toast. Tap to dismiss early; auto-hides too. */}
      {!atZero && toast && (
        <div
          className="fixed inset-x-0 top-3 z-[60] flex justify-center px-4"
          role="status"
          aria-live="polite"
          onClick={() => setToast(null)}
        >
          <div
            className={`rounded-full text-white text-sm font-semibold px-4 py-2 shadow-lg cursor-pointer ${
              toast === 'thirty' ? 'bg-rose-600' : 'bg-amber-500'
            }`}
          >
            {toast === 'thirty'
              ? '⏰ 最后 30 秒 · 30 seconds left'
              : '⏰ 时间快到了 · Less than 2 minutes left'}
          </div>
        </div>
      )}
    </>
  );
}
