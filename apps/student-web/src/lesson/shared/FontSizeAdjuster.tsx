import { useExam } from '../ExamContext';

/** Two compact buttons that step the exam font scale ±10%. Persisted in
 *  localStorage by the provider so the setting survives between sessions —
 *  many of our students re-take papers across days, and getting reading
 *  size right once should stick. */
export function FontSizeAdjuster() {
  const { fontScale, setFontScale } = useExam();
  const pct = Math.round(fontScale * 100);
  return (
    <div
      className="inline-flex items-center gap-1 rounded-md border border-line bg-surface text-ink-2 text-sm select-none"
      role="group"
      aria-label="Font size"
    >
      <button
        type="button"
        onClick={() => setFontScale(fontScale - 0.1)}
        disabled={fontScale <= 0.7}
        className="hit press px-3 hover:bg-surface-2 disabled:text-ink-3 disabled:cursor-not-allowed rounded-md"
        aria-label="Decrease font size"
      >
        A−
      </button>
      <span className="text-xs text-ink-3 tabular-nums w-9 text-center">{pct}%</span>
      <button
        type="button"
        onClick={() => setFontScale(fontScale + 0.1)}
        disabled={fontScale >= 1.6}
        className="hit press px-3 hover:bg-surface-2 disabled:text-ink-3 disabled:cursor-not-allowed rounded-md"
        aria-label="Increase font size"
      >
        A+
      </button>
    </div>
  );
}
