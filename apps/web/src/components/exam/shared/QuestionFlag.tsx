import { useExam } from '../ExamContext';

/** Per-question "mark for review" toggle. Bookmark icon + state colour
 *  follows the IELTS Computer-Delivered convention (no text label needed
 *  but we keep one for accessibility / first-time users). */
export function QuestionFlag({ qid, compact = false }: { qid: string; compact?: boolean }) {
  const { isFlagged, toggleFlag } = useExam();
  const flagged = isFlagged(qid);
  return (
    <button
      type="button"
      onClick={(e) => {
        e.stopPropagation();
        toggleFlag(qid);
      }}
      className={`inline-flex items-center gap-1 rounded-md text-xs font-medium border transition-colors touch-manipulation min-h-[36px] ${
        compact ? 'px-2 py-1' : 'px-2.5 py-1.5'
      } ${
        flagged
          ? 'bg-orange-100 border-orange-300 text-orange-800'
          : 'border-gray-200 text-gray-500 hover:bg-gray-50 active:bg-gray-100'
      }`}
      title={flagged ? '取消标记 · Unflag' : '标记复习 · Flag for review'}
      aria-pressed={flagged}
      aria-label={flagged ? 'Flagged for review' : 'Flag for review'}
    >
      <svg className="w-4 h-4" viewBox="0 0 20 20" fill="currentColor" aria-hidden>
        <path d="M4 3a1 1 0 011-1h11l-2 4 2 4H5v8H3V3a0 0 0 011 0z" />
      </svg>
      {!compact && (flagged ? '已标记' : '标记')}
    </button>
  );
}
