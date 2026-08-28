import { useExam } from '../ExamContext';

/** Quiet network-down indicator. Shown only when navigator reports offline.
 *  Wording reassures the student their work is safe — fear of lost answers
 *  is the single biggest source of WhatsApp complaints to teachers. */
export function OfflineBadge() {
  const { isOffline } = useExam();
  if (!isOffline) return null;
  return (
    <div
      role="status"
      aria-live="polite"
      className="fixed top-2 left-1/2 -translate-x-1/2 z-30 bg-amber-500 text-white text-xs font-medium px-3 py-1.5 rounded-full shadow-lg flex items-center gap-2"
    >
      <span className="w-2 h-2 rounded-full bg-white animate-pulse" />
      离线 · Offline — answers saved locally, will sync on reconnect.
    </div>
  );
}
