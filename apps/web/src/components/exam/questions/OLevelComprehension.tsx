import { useMemo, useState } from 'react';
import type { ExamPaper, ExamQuestion } from '../types';
import { useExam } from '../ExamContext';
import { clean, reflowPassage } from '../shared/textUtils';
import { QuestionFlag } from '../shared/QuestionFlag';

/**
 * O-Level English Reading Comprehension shell.
 *
 * Less heavy than the IELTS shell:
 *  - Default 50/50 split, NOT draggable. Comprehension passages are short
 *    enough that sizing it differently doesn't help, and removing the
 *    handle keeps the UI calm — under exam pressure students kept
 *    accidentally jolting the divider.
 *  - No highlighter / sticky notes — the passages are typically 200-400
 *    words, well below the threshold where annotation pays for itself.
 *  - One paged question at a time so the student isn't overwhelmed.
 *  - Prev / Next + the global QuestionNavBar gives random access.
 *
 * The host page renders this on a paper where every question carries the
 * same shared passage (snapshotContent.passage). Heuristic detection in
 * the registry routes here vs OLevelMcqList depending on whether the
 * first question has a `passage` field.
 */

export function OLevelComprehension({ paper }: { paper: ExamPaper }) {
  // All hooks must run on every render — round-7 C-E1. Previously the
  // empty-paper early return sat between useState and useMemo, so the
  // first non-empty render after a refetch produced a different hook
  // count and React threw "Rules of Hooks" violations.
  const { fontScale } = useExam();
  const [idx, setIdx] = useState(0);
  const total = paper?.questions?.length ?? 0;
  // R15-Audit#3 — multi-passage OLEVEL papers (e.g.
  // `cambridge_0510_s23/Paper12` has 2 passages: Q1-7 vs Q8-15)
  // were rendering the Q1 passage for ALL questions. Students reading
  // Q8-15 saw a totally unrelated article on the left pane and could
  // not answer. Switch to the CURRENT question's passage; if that
  // question's snapshotContent has no `passage` field, fall back to
  // the most recent earlier question that did (the typical IELTS-
  // style "shared passage" case still works — Q2+ inherit Q1's).
  const currentQ = paper?.questions?.[Math.min(idx, total - 1)];
  const passageSource = useMemo(() => {
    const qs = paper?.questions ?? [];
    if (qs.length === 0) return {};
    // Walk backwards from the current question to find the most recent
    // question that carries a passage; that's the one this question
    // belongs to. Matches how OLEVEL papers chunk multi-passage runs.
    const startIdx = Math.min(idx, qs.length - 1);
    for (let i = startIdx; i >= 0; i--) {
      const sc = qs[i]?.snapshotContent;
      if (sc && typeof sc.passage === 'string' && sc.passage.length > 0) {
        return sc;
      }
    }
    // No passage anywhere — last-resort fall back to Q1's snapshot so
    // the title still renders.
    return qs[0]?.snapshotContent ?? {};
  }, [paper?.questions, idx]);
  const passageTitle = clean(passageSource.passageTitle ?? 'Passage');
  // R15-Bug A — production 2026-05-12: students saw only the first
  // paragraph of an OLEVEL comprehension passage. Root cause: the
  // passage was rendered as one big `whitespace-pre-wrap` block inside
  // an `lg:max-h-[calc(100dvh-9rem)] lg:overflow-auto` aside. On iPad
  // the inner scroll bar is too thin to notice — students thought the
  // passage was truncated. Fix: split paragraphs on `\n\n` and render
  // each as its own `<p>` with explicit margin, AND remove the inner
  // overflow so the whole page scrolls (single source of scroll
  // location for the student).
  const passageParagraphs = useMemo(
    () =>
      reflowPassage(clean(passageSource.passage ?? ''))
        .split(/\n\s*\n/)
        .map((p) => p.trim())
        .filter(Boolean),
    [passageSource.passage],
  );
  void currentQ; // kept above for the q-render path below; reuse `q` instead.
  if (!total) {
    return (
      <div className="max-w-xl mx-auto py-12 px-6 text-center text-amber-800">
        该卷尚未出题，请联系老师。
      </div>
    );
  }
  const q = paper.questions[Math.min(idx, total - 1)];

  return (
    <div
      className="lg:flex lg:gap-4 lg:max-w-7xl lg:mx-auto lg:py-3"
      style={{ ['--mq-fs' as any]: String(fontScale) }}
    >
      {/* R15-Bug A: removed lg:max-h + lg:overflow-auto on this aside.
          The hidden inner scrollbar was making students think the
          passage was truncated. Now the whole document scrolls. */}
      <aside className="lg:w-1/2 bg-white lg:rounded-lg lg:border lg:shadow-sm">
        <div className="px-5 py-5 lg:px-6 lg:py-6">
          <h2 className="font-semibold text-xl lg:text-2xl mb-4">{passageTitle}</h2>
          <div
            className="text-gray-800 font-serif select-text"
            style={{ fontSize: `calc(1.125rem * var(--mq-fs, 1))` }}
          >
            {passageParagraphs.map((para, i) => (
              <p
                key={i}
                className="leading-[1.75] mb-4 last:mb-0 whitespace-pre-wrap"
              >
                {para}
              </p>
            ))}
            {passageParagraphs.length === 0 && (
              <p className="text-amber-700 italic">
                (该卷未携带阅读段落，请联系老师重新生成此卷)
              </p>
            )}
          </div>
        </div>
      </aside>
      <div className="lg:w-1/2 px-3 py-3 lg:px-0 lg:py-0">
        <ComprehensionQuestionCard q={q} idx={idx} total={total} />
        <div className="flex items-center justify-between gap-2 mt-4">
          <button
            type="button"
            disabled={idx === 0}
            onClick={() => setIdx((n) => Math.max(0, n - 1))}
            className="px-4 py-2.5 rounded-lg border border-gray-300 text-gray-700 hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed touch-manipulation min-h-[44px]"
          >
            ← Prev
          </button>
          <span className="text-sm text-gray-500 tabular-nums">
            {idx + 1} / {total}
          </span>
          <button
            type="button"
            disabled={idx === total - 1}
            onClick={() => setIdx((n) => Math.min(total - 1, n + 1))}
            className="px-4 py-2.5 rounded-lg border border-blue-500 bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-40 disabled:cursor-not-allowed touch-manipulation min-h-[44px]"
          >
            Next →
          </button>
        </div>
      </div>
    </div>
  );
}

function ComprehensionQuestionCard({
  q,
  idx,
  total,
}: {
  q: ExamQuestion;
  idx: number;
  total: number;
}) {
  const { answers, setAnswer, mode } = useExam();
  const ans = answers[q.id];
  const stem = clean(q.snapshotContent?.stem ?? '');
  const correctKey =
    typeof q.snapshotContent?.correctOption === 'string' ? q.snapshotContent.correctOption : null;
  const showFeedback = mode === 'practice' && ans?.selectedOption && correctKey;
  const isCorrect = showFeedback && ans.selectedOption === correctKey;

  return (
    <article id={`q-${q.id}`} className="bg-white border border-gray-200 rounded-lg shadow-sm">
      <header className="px-5 py-3 border-b border-gray-100 flex items-center gap-3">
        <span className="inline-flex items-center justify-center min-w-[32px] h-8 px-2.5 rounded-md bg-gray-100 text-gray-700 font-mono text-sm font-semibold tabular-nums">
          {idx + 1}
        </span>
        <span className="text-xs text-gray-400">of {total}</span>
        <span className="text-xs text-gray-400 ml-1">· {q.marks}m</span>
        <div className="flex-1" />
        <QuestionFlag qid={q.id} />
      </header>
      <div className="px-5 py-5">
        <p
          className="text-gray-900 leading-relaxed mb-4 whitespace-pre-wrap"
          style={{ fontSize: `calc(1.125rem * var(--mq-fs, 1))` }}
        >
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
                    className={`flex gap-3 items-start p-3 rounded-lg border cursor-pointer transition-colors touch-manipulation min-h-[48px] ${
                      isThisCorrect
                        ? 'border-green-500 bg-green-50'
                        : isThisWrong
                        ? 'border-rose-500 bg-rose-50'
                        : checked
                        ? 'border-blue-500 bg-blue-50'
                        : 'border-gray-200 hover:bg-gray-50 active:bg-blue-50'
                    }`}
                    style={{ fontSize: `calc(1rem * var(--mq-fs, 1))` }}
                  >
                    <input
                      type="radio"
                      name={`q-${q.id}`}
                      checked={checked}
                      onChange={() => setAnswer(q.id, { selectedOption: opt.key })}
                      className="mt-1 w-5 h-5"
                    />
                    <span className="font-mono text-gray-500 w-6">{opt.key}.</span>
                    <span className="flex-1 leading-snug">{clean(opt.text)}</span>
                  </label>
                </li>
              );
            })}
          </ul>
        ) : (
          <FreeTextAnswer
            value={ans?.textAnswer ?? ''}
            onChange={(v) => setAnswer(q.id, { textAnswer: v })}
          />
        )}
        {showFeedback && (
          <div className={`mt-3 text-sm font-medium ${isCorrect ? 'text-green-700' : 'text-rose-700'}`}>
            {isCorrect ? '✓ Correct' : `✗ Correct: ${correctKey}`}
            {q.snapshotContent?.explanation && !isCorrect && (
              <span className="block text-gray-700 font-normal mt-1">
                {clean(q.snapshotContent.explanation)}
              </span>
            )}
          </div>
        )}
      </div>
    </article>
  );
}

function FreeTextAnswer({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  return (
    <textarea
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder="Write your answer here…"
      rows={4}
      className="w-full border rounded-lg px-4 py-3 text-base min-h-[100px] focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-200"
    />
  );
}
