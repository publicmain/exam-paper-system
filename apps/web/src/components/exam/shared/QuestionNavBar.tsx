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
          const statusIcon = flagged ? '⚐' : answered ? '✓' : '·';
          const statusLabel = flagged
            ? 'flagged for review'
            : answered
            ? 'answered'
            : 'unanswered';
          return (
            <button
              key={q.id}
              type="button"
              onClick={() => onJumpTo(q.id, i)}
              className={`relative min-h-[44px] sm:min-h-[44px] h-11 sm:h-11 rounded font-mono text-xs sm:text-sm font-semibold transition-colors touch-manipulation flex flex-col items-center justify-center gap-0
                ${answered ? 'bg-blue-600 text-white border border-blue-700' : 'bg-gray-100 text-gray-700 border border-gray-200 hover:bg-gray-50'}
                ${flagged ? 'ring-2 ring-orange-400 ring-offset-1' : ''}
                ${current ? 'outline outline-2 outline-offset-1 outline-slate-900' : ''}`}
              aria-label={`Question ${i + 1}, ${statusLabel}`}
            >
              <span className="leading-none">{i + 1}</span>
              <span
                className={`text-[0.55rem] leading-none mt-0.5 ${
                  answered ? 'text-blue-100' : 'text-gray-400'
                }`}
                aria-hidden
              >
                {statusIcon}
              </span>
              {flagged && (
                <span
                  className="absolute -top-0.5 -right-0.5 text-orange-500 text-xs leading-none"
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
