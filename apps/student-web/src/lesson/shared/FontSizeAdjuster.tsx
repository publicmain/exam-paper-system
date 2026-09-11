import { useExam } from '../ExamContext';

/**
 * 字号调节：两个 44×44 的按钮，每次 ±10%，由引擎落盘（下次打开还是这个大小）。
 * 百分比只在宽屏显示；读屏名字是中文，并念出当前字号。
 */
export function FontSizeAdjuster() {
  const { fontScale, setFontScale } = useExam();
  const pct = Math.round(fontScale * 100);
  return (
    <div role="group" aria-label={`文章字号，现在 ${pct}%`} className="inline-flex select-none items-center rounded-control bg-fill text-ink">
      <button
        type="button"
        onClick={() => setFontScale(fontScale - 0.1)}
        disabled={fontScale <= 0.7}
        className="grid h-11 w-11 place-items-center rounded-control text-callout font-semibold hover:bg-fill-strong disabled:text-ink-3"
        aria-label="缩小字号"
      >
        A−
      </button>
      <span aria-hidden="true" className="hidden w-10 text-center text-caption tabular-nums text-ink-3 sm:inline">
        {pct}%
      </span>
      <button
        type="button"
        onClick={() => setFontScale(fontScale + 0.1)}
        disabled={fontScale >= 1.6}
        className="grid h-11 w-11 place-items-center rounded-control text-body font-semibold hover:bg-fill-strong disabled:text-ink-3"
        aria-label="放大字号"
      >
        A+
      </button>
    </div>
  );
}
