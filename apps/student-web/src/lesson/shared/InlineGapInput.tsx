import { useEffect, useRef, useState } from 'react';

/** A single inline blank for cloze / completion. Renders as an underlined
 *  text input that grows with the answer length. Uses local state with a
 *  blur-flush so a fast typist never loses chars to debounced re-renders.
 *  Tab key falls through to the next input naturally. */
export function InlineGapInput({
  value,
  onCommit,
  index,
  width = '5rem',
  ariaLabel,
  practiceFeedback,
  autoFocus = false,
}: {
  value: string;
  onCommit: (v: string) => void;
  index: number;
  width?: string;
  ariaLabel?: string;
  /** When set, shows a green ring (correct) or red ring (incorrect). Used
   *  in practice mode after the student has moved on from the input. */
  practiceFeedback?: 'correct' | 'incorrect' | null;
  autoFocus?: boolean;
}) {
  const [local, setLocal] = useState(value);
  const ref = useRef<HTMLInputElement | null>(null);
  useEffect(() => { setLocal(value); }, [value]);
  useEffect(() => { if (autoFocus) ref.current?.focus(); }, [autoFocus]);

  // Round-3 H20 — onChange now also commits (debounced by ExamProvider).
  // Previously only onBlur fired the commit, so a student who left a
  // question via Timer-auto-submit OR the QuestionPalette without
  // tabbing/clicking out would lose the latest characters.
  const commitTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  function scheduleCommit(next: string) {
    if (commitTimer.current) clearTimeout(commitTimer.current);
    commitTimer.current = setTimeout(() => {
      commitTimer.current = null;
      if (next !== value) onCommit(next);
    }, 200);
  }
  useEffect(() => {
    return () => { if (commitTimer.current) clearTimeout(commitTimer.current); };
  }, []);

  const ring =
    practiceFeedback === 'correct'
      ? 'ring-2 ring-green-400 bg-green-50 border-green-500'
      : practiceFeedback === 'incorrect'
      ? 'ring-2 ring-rose-400 bg-rose-50 border-rose-500'
      : 'border-gray-400 focus:border-blue-500 focus:ring-2 focus:ring-blue-200';
  return (
    <span className="inline-flex items-baseline align-baseline">
      <span className="text-xs font-mono text-gray-400 mr-0.5 select-none">{index})</span>
      <input
        ref={ref}
        type="text"
        value={local}
        onChange={(e) => {
          const v = e.target.value;
          setLocal(v);
          scheduleCommit(v);
        }}
        onBlur={() => {
          // Clear any scheduled commit and flush immediately.
          if (commitTimer.current) {
            clearTimeout(commitTimer.current);
            commitTimer.current = null;
          }
          if (local !== value) onCommit(local);
        }}
        onKeyDown={(e) => {
          if (e.key === 'Enter') (e.target as HTMLInputElement).blur();
        }}
        aria-label={ariaLabel ?? `Blank ${index}`}
        autoCorrect="off"
        spellCheck={false}
        // H16 — increase touch height (min-h-[44px]) and font-size to give
        // a real touch target on iPad while keeping the inline look.
        className={`inline-block px-2 min-h-[44px] py-1 mx-0.5 border-0 border-b-2 bg-transparent text-base font-medium text-gray-900 focus:outline-none touch-manipulation ${ring}`}
        style={{ width, minWidth: '4rem' }}
      />
    </span>
  );
}
