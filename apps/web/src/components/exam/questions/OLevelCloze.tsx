import { Fragment, useMemo } from 'react';
import type { ExamPaper, ExamQuestion } from '../types';
import { useExam } from '../ExamContext';
import { clean } from '../shared/textUtils';
import { InlineGapInput } from '../shared/InlineGapInput';
import { QuestionFlag } from '../shared/QuestionFlag';

/**
 * Cloze (gap-fill) renderer.
 *
 * The data shape we render: every question is one blank, but the host
 * page emits them as a contiguous group whose stems all reference parts
 * of the SAME passage. For each blank we strip the passage prefix that
 * the upstream PDF parser leaves on the stem ("…and the (4) ___ which…")
 * and render an InlineGapInput where the [BLANK] marker would be.
 *
 * Layout:
 *  - The full article appears as continuous prose
 *  - Each blank is replaced by an inline numbered input
 *  - A title bar at the top + a chip strip for "current" blank
 *
 * To keep the render simple, we expect the data to carry a top-level
 * `passage` field on the first question's snapshotContent and a per-
 * question `blankIndex` (the 1-based number of the blank in the passage).
 *
 * If `passage` is missing (older data) we fall back to a list of items —
 * each input prefixed with the question stem text.
 */

export function OLevelCloze({ paper }: { paper: ExamPaper }) {
  const { fontScale, answers, setAnswer, mode } = useExam();
  const passageContent = paper.questions[0]?.snapshotContent ?? {};
  const passage = clean(passageContent.passage ?? '');

  // The cloze passage uses [BLANK] markers for each gap; split on them and
  // interleave with input boxes. The N-th blank corresponds to question N.
  const segments = useMemo(() => {
    if (!passage) return null;
    return passage.split(/\[BLANK\]/i);
  }, [passage]);

  if (segments && segments.length - 1 === paper.questions.length) {
    return (
      <article className="max-w-3xl mx-auto bg-white border border-gray-200 rounded-lg shadow-sm" style={{ fontSize: `${fontScale}rem` }}>
        <header className="px-5 lg:px-6 py-4 border-b">
          <h2 className="font-semibold text-xl lg:text-2xl">{clean(passageContent.passageTitle ?? 'Cloze Passage')}</h2>
          <p className="text-xs text-gray-500 mt-1">
            填空题 · Fill each blank with one word. Tab to move to the next.
          </p>
        </header>
        <div className="px-5 lg:px-8 py-6 text-[1.0625rem] lg:text-lg leading-[2] font-serif text-gray-900 whitespace-pre-wrap">
          {segments.map((seg, i) => (
            <Fragment key={i}>
              {seg}
              {i < segments.length - 1 && (() => {
                const q = paper.questions[i];
                const ans = answers[q.id];
                const correct = q.snapshotContent?.correctAnswer;
                const cur = (ans?.textAnswer ?? '').trim();
                const fb =
                  mode === 'practice' && cur && typeof correct === 'string'
                    ? cur.toLowerCase() === correct.toLowerCase()
                      ? 'correct'
                      : 'incorrect'
                    : null;
                return (
                  <InlineGapInput
                    index={i + 1}
                    value={ans?.textAnswer ?? ''}
                    onCommit={(v) => setAnswer(q.id, { textAnswer: v })}
                    practiceFeedback={fb}
                    ariaLabel={`Blank ${i + 1}`}
                  />
                );
              })()}
            </Fragment>
          ))}
        </div>
        <footer className="px-5 py-3 border-t text-xs text-gray-500 flex flex-wrap items-center gap-3">
          <span>Tip: Tab → next blank · Shift-Tab ← previous</span>
          <span className="ml-auto flex items-center gap-2">
            {paper.questions.map((q, i) => (
              <span
                key={q.id}
                className={`inline-flex items-center justify-center w-6 h-6 rounded text-xs font-mono ${
                  (answers[q.id]?.textAnswer ?? '').trim()
                    ? 'bg-blue-600 text-white'
                    : 'bg-gray-100 text-gray-500 border border-gray-200'
                }`}
                aria-hidden
              >
                {i + 1}
              </span>
            ))}
          </span>
        </footer>
      </article>
    );
  }

  // Fallback — list per item.
  return (
    <ol className="space-y-3 max-w-3xl mx-auto" style={{ fontSize: `${fontScale}rem` }}>
      {paper.questions.map((q, i) => (
        <ClozeRowFallback key={q.id} q={q} idx={i + 1} />
      ))}
    </ol>
  );
}

function ClozeRowFallback({ q, idx }: { q: ExamQuestion; idx: number }) {
  const { answers, setAnswer } = useExam();
  const ans = answers[q.id];
  const stem = clean(q.snapshotContent?.stem ?? '');
  return (
    <li className="bg-white border border-gray-200 rounded-lg p-4 flex items-start gap-3">
      <span className="font-mono text-sm text-gray-500 w-8 shrink-0 mt-1">{idx}.</span>
      <div className="flex-1">
        <p className="text-base text-gray-900 mb-2 leading-relaxed whitespace-pre-wrap">
          {stem.split(/\[BLANK\]/i).map((part, i) => (
            <Fragment key={i}>
              {part}
              {i === 0 && (
                <input
                  type="text"
                  value={ans?.textAnswer ?? ''}
                  onChange={(e) => setAnswer(q.id, { textAnswer: e.target.value })}
                  className="inline-block px-2 py-0.5 mx-1 border-0 border-b-2 border-gray-400 bg-transparent text-base font-medium text-gray-900 focus:outline-none focus:border-blue-500 min-w-[6rem]"
                />
              )}
            </Fragment>
          ))}
        </p>
      </div>
      <QuestionFlag qid={q.id} compact />
    </li>
  );
}
