import type { ExamQuestion } from '../types';
import { useExam } from '../ExamContext';

/** Bottom-anchored 3-state palette. Examplify-style: a numbered cell per
 *  question, coloured by status (answered / blank / flagged). Clicking
 *  jumps the host page to that question. Used by both IELTS and O-Level
 *  shells. */
export function QuestionNavBar({
  questions,
  currentIdx,
  onJumpTo,
}: {
  questions: ExamQuestion[];
  /** Optional — if provided, that cell gets a ring so the student knows
   *  where they are in a paged shell. Not needed for the IELTS scrollable
   *  shell (no current question). */
  currentIdx?: number;
  onJumpTo: (qid: string, idx: number) => void;
}) {
  const { answers, isFlagged } = useExam();
  // H8: Tailwind's default config tops out at grid-cols-12 — `grid-cols-13`
  // is silently dropped, leaving the cell width undefined on small screens.
  // We use inline `gridTemplateColumns` instead so the column count is
  // honoured regardless of which utilities ship in the bundle.
  // H18: status is reflected by an icon AND text (✓ / · / ⚐) in addition
  // to colour, so the palette stays usable for colour-blind students and
  // screen readers (WCAG 1.4.1).
  return (
    <div className="bg-white">
      <div
        className="px-3 py-2 grid gap-1.5"
        style={{
          // Use auto-fit so the row breaks gracefully on any viewport —
          // 10 cells per row at ~36px + gap on small phones, more on iPad.
          gridTemplateColumns: 'repeat(auto-fit, minmax(38px, 1fr))',
        }}
      >
        {questions.map((q, i) => {
          const ans = answers[q.id];
          const answered = !!(ans?.selectedOption || (ans?.textAnswer && ans.textAnswer.trim()));
          const flagged = isFlagged(q.id);
          const current = currentIdx === i;
          // U4 — three icons that are visually distinct in shape, not
          // colour: filled flag for marked-for-review, check for answered,
          // empty circle for unanswered. The shape difference passes WCAG
          // 1.4.1 (use of colour) on its own.
          const statusIcon = flagged ? '⚑' : answered ? '✓' : '○';
          const statusLabel = flagged
            ? 'flagged for review'
            : answered
            ? 'answered'
            : 'unanswered';
          // U4 contrast: the original `text-blue-100` on `bg-blue-600`
          // measured ~3.6:1 (just below WCAG AA 4.5:1). Bumped to
          // text-white (15:1 against blue-600) and text-gray-700 (>10:1
          // against gray-100). Status icon is now full-strength text
          // colour instead of a faded variant so it remains readable.
          return (
            <button
              key={q.id}
              type="button"
              onClick={() => onJumpTo(q.id, i)}
              className={`relative min-h-[44px] sm:min-h-[44px] h-11 sm:h-11 rounded font-mono text-xs sm:text-sm font-semibold transition-all duration-100 ease-out touch-manipulation flex flex-col items-center justify-center gap-0 active:scale-95
                ${answered ? 'bg-blue-600 text-white border border-blue-700 hover:bg-blue-700' : 'bg-gray-100 text-gray-700 border border-gray-300 hover:bg-gray-50'}
                ${flagged ? 'ring-2 ring-orange-500 ring-offset-1' : ''}
                ${current ? 'outline outline-2 outline-offset-1 outline-slate-900' : ''}`}
              aria-label={`Question ${i + 1}, ${statusLabel}`}
              aria-current={current ? 'step' : undefined}
              data-state={statusLabel.replace(/\s/g, '_')}
            >
              <span className="leading-none">{i + 1}</span>
              <span
                className={`text-[0.7rem] leading-none mt-0.5 ${
                  answered ? 'text-white' : 'text-gray-700'
                }`}
                aria-hidden
              >
                {statusIcon}
              </span>
              {flagged && (
                <span
                  className="absolute -top-0.5 -right-0.5 text-orange-600 text-xs leading-none"
                  aria-hidden
                >
                  ●
                </span>
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}
