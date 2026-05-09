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
        onChange={(e) => setLocal(e.target.value)}
        onBlur={() => { if (local !== value) onCommit(local); }}
        onKeyDown={(e) => {
          if (e.key === 'Enter') (e.target as HTMLInputElement).blur();
        }}
        aria-label={ariaLabel ?? `Blank ${index}`}
        autoCorrect="off"
        spellCheck={false}
        className={`inline-block px-2 py-0.5 mx-0.5 border-0 border-b-2 bg-transparent text-base font-medium text-gray-900 focus:outline-none ${ring}`}
        style={{ width, minWidth: '4rem' }}
      />
    </span>
  );
}
