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
  return (
    <div className="bg-white">
      <div className="px-3 py-2 grid grid-cols-10 sm:grid-cols-13 gap-1.5">
        {questions.map((q, i) => {
          const ans = answers[q.id];
          const answered = !!(ans?.selectedOption || (ans?.textAnswer && ans.textAnswer.trim()));
          const flagged = isFlagged(q.id);
          const current = currentIdx === i;
          return (
            <button
              key={q.id}
              type="button"
              onClick={() => onJumpTo(q.id, i)}
              className={`relative h-9 sm:h-10 rounded font-mono text-xs sm:text-sm font-semibold transition-colors touch-manipulation
                ${answered ? 'bg-blue-600 text-white border border-blue-700' : 'bg-gray-100 text-gray-700 border border-gray-200 hover:bg-gray-50'}
                ${flagged ? 'ring-2 ring-orange-400 ring-offset-1' : ''}
                ${current ? 'outline outline-2 outline-offset-1 outline-slate-900' : ''}`}
              aria-label={`Question ${i + 1}${answered ? ' answered' : ' unanswered'}${flagged ? ' flagged' : ''}`}
            >
              {i + 1}
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
