import { useState } from 'react';
import type { ExamPaper, ExamQuestion } from '../types';
import { useExam } from '../ExamContext';
import { clean } from '../shared/textUtils';
import { QuestionFlag } from '../shared/QuestionFlag';

/**
 * Generic O-Level MCQ list (grammar, vocabulary multi-choice that doesn't
 * fit the vocab-in-context layout, or any standalone-MCQ paper). One
 * question per screen — calmer than scrolling 20 stacked questions on a
 * phone, and the bottom QuestionNavBar gives random access. */
export function OLevelMcqList({ paper }: { paper: ExamPaper }) {
  const { fontScale, answers, setAnswer, mode } = useExam();
  const [idx, setIdx] = useState(0);
  const total = paper?.questions?.length ?? 0;
  if (!total) {
    return (
      <div className="max-w-xl mx-auto py-12 px-6 text-center text-amber-800">
        该卷尚未出题，请联系老师。
      </div>
    );
  }
  const q = paper.questions[Math.min(idx, total - 1)];
  const ans = answers[q.id];
  const c = q.snapshotContent ?? {};
  const stem = clean(c.stem ?? '');
  const correctKey = typeof c.correctOption === 'string' ? c.correctOption : null;
  const showFeedback = mode === 'practice' && ans?.selectedOption && correctKey;
  const isCorrect = showFeedback && ans.selectedOption === correctKey;

  return (
    <div className="max-w-2xl mx-auto py-3" style={{ ['--mq-fs' as any]: String(fontScale) }}>
      <article id={`q-${q.id}`} className="bg-white border border-gray-200 rounded-xl shadow-sm">
        <header className="px-5 py-3 border-b flex items-center gap-3">
          <span className="font-mono text-sm text-gray-500 tabular-nums">Q{idx + 1} / {total}</span>
          <span className="text-xs text-gray-400">{q.marks}m</span>
          <div className="flex-1" />
          <QuestionFlag qid={q.id} />
        </header>
        <div className="px-6 py-6">
          <p className="text-base lg:text-lg text-gray-900 leading-relaxed mb-5 whitespace-pre-wrap">
            {stem}
          </p>
          {q.snapshotOptions && q.snapshotOptions.length > 0 ? (
            <ul className="space-y-2">
              {q.snapshotOptions.map((opt) => {
                const checked = ans?.selectedOption === opt.key;
                const isThisCorrect = showFeedback && opt.key === correctKey;
                const isThisWrong = showFeedback && checked && opt.key !== correctKey;
                return (
                  <li key={opt.key}>
                    <label
                      className={`flex gap-3 items-center p-3 rounded-lg border cursor-pointer transition-all duration-100 ease-out touch-manipulation min-h-[48px] hover:shadow-sm active:scale-[0.99] ${
                        isThisCorrect
                          ? 'border-green-500 bg-green-50'
                          : isThisWrong
                          ? 'border-rose-500 bg-rose-50'
                          : checked
                          ? 'border-blue-500 bg-blue-50'
                          : 'border-gray-200 hover:bg-gray-50'
                      }`}
                    >
                      <input
                        type="radio"
                        name={`q-${q.id}`}
                        checked={checked}
                        onChange={() => setAnswer(q.id, { selectedOption: opt.key })}
                        className="w-5 h-5"
                        data-testid={`mcq-${q.id}-${opt.key}`}
                      />
                      <span className="font-mono text-gray-500 text-base w-6">{opt.key}.</span>
                      <span className="flex-1 text-base">{clean(opt.text)}</span>
                      {/* U9 — quiet correctness icon (practice review only).
                          No sound, no explosion — exam-room appropriate. */}
                      {isThisCorrect && (
                        <span aria-label="correct" className="text-green-700 text-lg" role="img">
                          ✓
                        </span>
                      )}
                      {isThisWrong && (
                        <span aria-label="incorrect" className="text-rose-700 text-lg" role="img">
                          ✗
                        </span>
                      )}
                    </label>
                  </li>
                );
              })}
            </ul>
          ) : (
            <textarea
              value={ans?.textAnswer ?? ''}
              onChange={(e) => setAnswer(q.id, { textAnswer: e.target.value })}
              placeholder="Your answer…"
              rows={4}
              className="w-full border rounded-lg px-4 py-3 text-base"
            />
          )}
          {showFeedback && (
            <div className={`mt-3 text-sm font-medium ${isCorrect ? 'text-green-700' : 'text-rose-700'}`}>
              {isCorrect ? '✓ Correct' : `✗ Correct: ${correctKey}`}
              {c.explanation && !isCorrect && (
                <span className="block text-gray-700 font-normal mt-1">{clean(c.explanation)}</span>
              )}
            </div>
          )}
        </div>
      </article>
      <div className="flex items-center justify-between mt-4 px-1">
        <button
          type="button"
          disabled={idx === 0}
          onClick={() => setIdx((n) => Math.max(0, n - 1))}
          className="px-4 py-2.5 rounded-lg border border-gray-300 text-gray-700 hover:bg-gray-50 disabled:opacity-40 touch-manipulation min-h-[44px]"
        >
          ← Prev
        </button>
        <span className="text-sm text-gray-500 tabular-nums">{idx + 1} / {total}</span>
        <button
          type="button"
          disabled={idx === total - 1}
          onClick={() => setIdx((n) => Math.min(total - 1, n + 1))}
          className="px-4 py-2.5 rounded-lg border border-blue-500 bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-40 touch-manipulation min-h-[44px]"
        >
          Next →
        </button>
      </div>
    </div>
  );
}

/** Exposed so other shells can reuse the question card if needed. */
export { OLevelMcqList as OLevelMcqListView };
export type { ExamQuestion };
