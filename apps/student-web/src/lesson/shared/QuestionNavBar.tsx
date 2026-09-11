import { useEffect, useRef } from 'react';
import type { ExamQuestion } from '../examTypes';
import { useExam } from '../ExamContext';

/**
 * 题号条（IOS-05）—— 一行，横向滚动，和「交卷」放在同一条底栏里。
 *
 * 原来是自动折行的网格：手机上 10 题折成两行，底栏占掉 130px。现在固定一行，
 * 每个题号 44×44（审计 IOS-03 命中区），多了就横向滑。
 *
 * 状态靠**形状**区分，不只靠颜色（WCAG 1.4.1）：
 *   · 已作答 —— 实色底 + 对勾
 *   · 未作答 —— 描边空心
 *   · 已标记 —— 橙色外圈 + 右上角小旗
 * 读屏名字是中文：「第 3 题，已作答」。
 */
export function QuestionNavBar({
  questions,
  currentIdx,
  onJumpTo,
}: {
  questions: ExamQuestion[];
  /** 分页式外壳用：当前那一题加一圈；IELTS 滚动式外壳不传。 */
  currentIdx?: number;
  onJumpTo: (qid: string, idx: number) => void;
}) {
  const { answers, isFlagged } = useExam();
  const rowRef = useRef<HTMLDivElement | null>(null);

  // 当前题滚进可见范围（分页式外壳翻页时）
  useEffect(() => {
    if (currentIdx == null) return;
    const el = rowRef.current?.querySelector<HTMLElement>(`[data-idx="${currentIdx}"]`);
    el?.scrollIntoView?.({ block: 'nearest', inline: 'nearest' });
  }, [currentIdx]);

  return (
    <div ref={rowRef} role="group" aria-label="题号" className="scroll-contain -mx-1 flex min-w-0 gap-1.5 overflow-x-auto px-1 py-1">
      {questions.map((q, i) => {
        const ans = answers[q.id];
        const answered = !!(ans?.selectedOption || (ans?.textAnswer && ans.textAnswer.trim()));
        const flagged = isFlagged(q.id);
        const current = currentIdx === i;
        const statusLabel = flagged ? '已标记' : answered ? '已作答' : '未作答';
        return (
          <button
            key={q.id}
            type="button"
            data-idx={i}
            onClick={() => onJumpTo(q.id, i)}
            className={`relative flex h-11 min-w-[44px] shrink-0 items-center justify-center gap-0.5 rounded-control px-2 text-callout font-semibold tabular-nums touch-manipulation ${
              answered ? 'bg-accent-fill text-accent-on' : 'border border-control bg-surface text-ink-2 hover:bg-surface-2'
            } ${flagged ? 'ring-2 ring-warning ring-offset-1 ring-offset-surface' : ''} ${
              current ? 'outline outline-2 outline-offset-2 outline-ink-3' : ''
            }`}
            aria-label={`第 ${i + 1} 题，${statusLabel}`}
            aria-current={current ? 'step' : undefined}
            data-state={flagged ? 'flagged_for_review' : answered ? 'answered' : 'unanswered'}
          >
            <span className="leading-none">{i + 1}</span>
            {answered ? (
              <svg aria-hidden="true" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3.2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M5 12.5l4.5 4.5L19 7.5" />
              </svg>
            ) : null}
            {flagged ? (
              <svg aria-hidden="true" className="absolute -right-1 -top-1 text-warning" width="14" height="14" viewBox="0 0 24 24" fill="currentColor" stroke="none">
                <path d="M5 3h2v18H5zM7 4h11l-2.5 4.5L18 13H7z" />
              </svg>
            ) : null}
          </button>
        );
      })}
    </div>
  );
}
