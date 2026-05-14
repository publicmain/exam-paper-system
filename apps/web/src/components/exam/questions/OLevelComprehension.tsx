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
    // R15-followup-10 — OLEVEL flowchart sub-parts (Q11(i)..(iv) in the
    // senior_sister fixture, internally Q13-Q16) carry a SUMMARY passage
    // that begins with "Refer to the same 'Senior Sister' narrative in
    // Exercise 1 above. The narrator's feelings shift over the days…".
    // It is a back-reference, NOT the actual passage students need:
    // those sub-parts ask "What best describes the narrator's feeling in
    // Paragraph 5…", and Paragraph 5 lives in the ORIGINAL narrative —
    // the one Q1-Q12 carry. The previous "walk backwards, stop at first
    // passage" loop landed on this summary and blocked students from
    // answering Q13-Q16 because the paragraph they needed wasn't on
    // screen.
    //
    // Two-pass selection:
    //   1. Walk backwards skipping any passage that looks like a back-
    //      reference (starts with "Refer to" / "See passage above" / is
    //      a brief recap). Land on a "real" passage if one exists earlier.
    //   2. If pass 1 finds nothing, fall back to the original loop's
    //      most-recent-passage behaviour (legacy multi-passage papers
    //      that genuinely chunk Q1-7 vs Q8-15 with two real passages
    //      still work — neither chunk's passage begins with "Refer to").
    const looksLikeBackref = (s: string): boolean => {
      const t = s.trim().toLowerCase();
      if (!t) return false;
      return (
        t.startsWith('refer to') ||
        t.startsWith('see passage') ||
        t.startsWith('see the passage') ||
        t.startsWith('using the passage above') ||
        t.startsWith('see exercise') ||
        t.startsWith('based on the same') ||
        t.startsWith('with reference to the')
      );
    };
    const startIdx = Math.min(idx, qs.length - 1);
    // R15-followup-11 — Pass 0: paragraph-reference-aware selection.
    // If the current question text mentions "Paragraph N" / "para N",
    // prefer the earliest passage that ACTUALLY CONTAINS that paragraph
    // marker. This handles cases the backref heuristic misses (e.g. a
    // summary passage that doesn't start with "Refer to" but still
    // isn't the real source). Today's senior_sister Q11 sub-parts ask
    // about Paragraph 5, but the Q11 summary passage on the question
    // itself doesn't have paragraph 5 — only the main narrative does.
    const currentStem = (() => {
      const sc = qs[startIdx]?.snapshotContent as any;
      return typeof sc?.stem === 'string' ? (sc.stem as string) : '';
    })();
    const paraRef = (() => {
      const m = /paragraph\s+(\d+)/i.exec(currentStem);
      return m ? parseInt(m[1], 10) : null;
    })();
    if (paraRef != null) {
      const paraToken = new RegExp(`paragraph\\s*${paraRef}\\b`, 'i');
      // Look earliest-first so the canonical first-passage wins over a
      // later summary that might also contain "paragraph N" verbatim.
      for (let i = 0; i < qs.length; i++) {
        const sc = qs[i]?.snapshotContent as any;
        if (sc && typeof sc.passage === 'string' && sc.passage.length > 0 && paraToken.test(sc.passage)) {
          return sc;
        }
      }
    }
    // Pass 1 — prefer a non-back-reference passage walking backwards
    // from the current question (preserves multi-passage chunk grouping).
    for (let i = startIdx; i >= 0; i--) {
      const sc = qs[i]?.snapshotContent;
      if (sc && typeof sc.passage === 'string' && sc.passage.length > 0 && !looksLikeBackref(sc.passage)) {
        return sc;
      }
    }
    // Pass 2 — legacy fallback: any passage, even back-reference, to
    // avoid a blank left pane when the data is unusual.
    for (let i = startIdx; i >= 0; i--) {
      const sc = qs[i]?.snapshotContent;
      if (sc && typeof sc.passage === 'string' && sc.passage.length > 0) {
        return sc;
      }
    }
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
        {/* R15-followup-9 — on iPad-sized viewports the Prev/Next strip
            below the textarea got tucked underneath the page's sticky
            footer (题号 + 交卷). The host `pb-24` reserves 96 px of room
            from the page bottom, but the sticky toolbar floats over that
            zone — so a button sitting in the last ~40 px of the content
            area renders behind it and is unclickable. mb-20 + min-h-screen
            chrome together push these out of the footer's shadow on every
            viewport including 1024×1366 iPads in portrait. */}
        <div className="flex items-center justify-between gap-2 mt-4 mb-20">
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

  // R15-followup-11 — surface the paper-native question label (Q9, Q11(ii),
  // Q6(b)) in the header so students/teachers can distinguish identical-
  // looking flowchart sub-parts. The label can appear ANYWHERE in the
  // stem (the section intro at the top mentions "Q1-Q10" parenthetically,
  // and the real question prefix follows after a newline). We pick the
  // LAST occurrence of "Q<digits><optional (sub)>." followed by a space —
  // that's the actual question prefix, not the parenthetical reference in
  // the section intro.
  const labelRe = /\bQ(\d+)(\([a-z]+\))?\.\s/gi;
  let lastLabelMatch: RegExpExecArray | null = null;
  for (let m: RegExpExecArray | null; (m = labelRe.exec(stem)); ) {
    lastLabelMatch = m;
  }
  const originalLabel = lastLabelMatch
    ? `Q${lastLabelMatch[1]}${lastLabelMatch[2] ? lastLabelMatch[2].toLowerCase() : ''}`
    : null;
  // Strip everything up to (and including) the label so the body only
  // shows the actual question text — drops the section-intro preamble
  // that today renders identically on every question.
  const stemWithoutLabel = lastLabelMatch
    ? stem.slice((lastLabelMatch.index ?? 0) + lastLabelMatch[0].length).trim()
    : stem;

  return (
    <article id={`q-${q.id}`} className="bg-white border border-gray-200 rounded-lg shadow-sm">
      <header className="px-5 py-3 border-b border-gray-100 flex items-center gap-3">
        <span className="inline-flex items-center justify-center min-w-[32px] h-8 px-2.5 rounded-md bg-gray-100 text-gray-700 font-mono text-sm font-semibold tabular-nums">
          {idx + 1}
        </span>
        <span className="text-xs text-gray-400">of {total}</span>
        {originalLabel && (
          <span className="text-xs font-mono font-semibold text-blue-700 ml-1 px-1.5 py-0.5 rounded bg-blue-50 border border-blue-200">
            {originalLabel}
          </span>
        )}
        <span className="text-xs text-gray-400 ml-1">· {q.marks}m</span>
        <div className="flex-1" />
        <QuestionFlag qid={q.id} />
      </header>
      <div className="px-5 py-5">
        <p
          className="text-gray-900 leading-relaxed mb-4 whitespace-pre-wrap"
          style={{ fontSize: `calc(1.125rem * var(--mq-fs, 1))` }}
        >
          {originalLabel && <span className="font-mono font-semibold text-blue-700 mr-2">{originalLabel}.</span>}
          {stemWithoutLabel}
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
