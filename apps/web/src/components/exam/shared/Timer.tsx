import { useEffect, useState } from 'react';

/** Live countdown to `endsAt`. Goes red in the last 5 minutes — matches the
 *  IELTS Computer-Delivered colour cue. Calls `onTimeUp` exactly once when
 *  the remaining time hits zero so the host page can auto-submit. */
export function Timer({
  endsAt,
  onTimeUp,
}: {
  endsAt: string;
  onTimeUp?: () => void;
}) {
  const [now, setNow] = useState(Date.now());
  const [fired, setFired] = useState(false);

  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, []);

  const remainingMs = Math.max(0, new Date(endsAt).getTime() - now);
  useEffect(() => {
    if (remainingMs === 0 && !fired) {
      setFired(true);
      onTimeUp?.();
    }
  }, [remainingMs, fired, onTimeUp]);

  const mm = String(Math.floor(remainingMs / 60_000)).padStart(2, '0');
  const ss = String(Math.floor((remainingMs % 60_000) / 1000)).padStart(2, '0');
  const danger = remainingMs < 5 * 60_000;
  const warn = !danger && remainingMs < 10 * 60_000;

  return (
    <div
      className={`font-mono tabular-nums text-2xl lg:text-3xl ${
        danger ? 'text-rose-600' : warn ? 'text-amber-600' : 'text-gray-700'
      }`}
      aria-live={danger ? 'polite' : 'off'}
      aria-label={`Remaining time ${mm}:${ss}`}
    >
      {mm}:{ss}
    </div>
  );
}
