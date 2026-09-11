import { useState, useEffect } from 'react';
import type { ExamPaper, ExamQuestion } from '../examTypes';
import { useExam, useFollowRequestedQuestion } from '../ExamContext';
import { clean } from '../shared/textUtils';
import { QuestionFlag } from '../shared/QuestionFlag';

/**
 * Sentence Transformation renderer.
 *
 * One screen per question. Two-row layout:
 *   row 1: original sentence (read-only, large serif)
 *   row 2: textarea preceded by the "starter" the student must keep
 *
 * Word count display under the textarea — examiners often impose limits
 * (≤ 12 words etc.); we show the live count so the student can self-
 * regulate without us having to gate submission.
 *
 * Data shape:
 *   snapshotContent.original     — the source sentence
 *   snapshotContent.starter      — the required opening words (optional)
 *   snapshotContent.maxWords     — soft limit (optional)
 *   snapshotContent.exampleAnswer — shown in practice-mode feedback
 */

export function OLevelSentenceTransformation({ paper }: { paper: ExamPaper }) {
  const { fontScale } = useExam();
  const [idx, setIdx] = useState(0);
  useFollowRequestedQuestion(paper?.questions, setIdx);
  const total = paper?.questions?.length ?? 0;
  if (!total) {
    return (
      <div className="max-w-xl mx-auto py-12 px-6 text-center text-warning">
        该卷尚未出题，请联系老师。
      </div>
    );
  }
  const q = paper.questions[Math.min(idx, total - 1)];
  return (
    <div className="max-w-3xl mx-auto py-3" style={{ ['--mq-fs' as any]: String(fontScale) }}>
      <TransformationCard q={q} idx={idx} total={total} />
      {/* R15-followup-9 — mb-20 keeps Prev/Next clear of the sticky 题号/交卷 footer on iPad viewports. */}
      <div className="flex items-center justify-between mt-4 mb-20 px-1">
        <button
          type="button"
          disabled={idx === 0}
          onClick={() => setIdx((n) => Math.max(0, n - 1))}
          className="px-4 py-2.5 rounded-lg border border-control text-ink-2 hover:bg-surface-2 disabled:opacity-40 touch-manipulation min-h-[44px]"
        >
          ← Prev
        </button>
        <span className="text-sm text-ink-3 tabular-nums">{idx + 1} / {total}</span>
        <button
          type="button"
          disabled={idx === total - 1}
          onClick={() => setIdx((n) => Math.min(total - 1, n + 1))}
          className="px-4 py-2.5 rounded-lg border border-accent bg-accent-fill text-accent-on hover:bg-accent-pressed disabled:opacity-40 touch-manipulation min-h-[44px]"
        >
          Next →
        </button>
      </div>
    </div>
  );
}

function TransformationCard({ q, idx, total }: { q: ExamQuestion; idx: number; total: number }) {
  const { answers, setAnswer, mode } = useExam();
  const ans = answers[q.id];
  const c = q.snapshotContent ?? {};
  const original = clean(c.original ?? c.stem ?? '');
  const starter: string = clean(c.starter ?? '');
  const maxWords: number | null = typeof c.maxWords === 'number' ? c.maxWords : null;
  const example = clean(c.exampleAnswer ?? '');

  const [text, setText] = useState(ans?.textAnswer ?? '');
  useEffect(() => { setText(ans?.textAnswer ?? ''); }, [ans?.textAnswer, q.id]);

  const wordCount = text.trim() ? text.trim().split(/\s+/).length : 0;
  const overLimit = maxWords !== null && wordCount > maxWords;

  return (
    <article id={`q-${q.id}`} className="bg-surface border border-line rounded-xl shadow-sm">
      <header className="px-5 py-3 border-b flex items-center gap-3">
        <span className="text-xs text-ink-3 uppercase tracking-wide font-semibold">Sentence Transformation</span>
        <span className="text-xs text-ink-3">·</span>
        <span className="font-mono text-sm text-ink-3 tabular-nums">Q{idx + 1} / {total}</span>
        <span className="text-[13px] text-ink-3 ml-1 tabular-nums">{q.marks} 分</span>
        <div className="flex-1" />
        <QuestionFlag qid={q.id} />
      </header>
      <div className="px-6 py-6 space-y-5">
        <section>
          <div className="text-xs text-ink-3 uppercase tracking-wide mb-1.5">Original sentence</div>
          <p className="text-lg lg:text-xl font-serif text-ink leading-relaxed border-l-4 border-control pl-4 italic">
            {original}
          </p>
        </section>
        <section>
          <div className="text-xs text-ink-3 uppercase tracking-wide mb-1.5">
            Rewrite{starter ? ' starting with the words shown' : ''}
            {maxWords !== null && (
              <span className="ml-2 normal-case text-ink-3">(max {maxWords} words)</span>
            )}
          </div>
          {starter && (
            <p className="text-base text-accent font-mono mb-2">
              {starter}<span className="text-ink-3"> …</span>
            </p>
          )}
          <textarea
        aria-label="Your rewritten sentence"
            value={text}
            onChange={(e) => {
              setText(e.target.value);
              setAnswer(q.id, { textAnswer: e.target.value });
            }}
            rows={3}
            placeholder={starter ? `Continue from "${starter}"…` : 'Write your rewritten sentence…'}
            className={`w-full border-2 rounded-lg px-4 py-3 text-base font-serif focus:outline-none focus:ring-2 ${
              overLimit
                ? 'border-danger/30 focus:border-danger focus:ring-danger/30'
                : 'border-control focus:border-accent focus:ring-accent/30'
            }`}
          />
          <div className="flex items-center justify-between mt-1.5 text-xs">
            <span className={overLimit ? 'text-danger font-semibold' : 'text-ink-3'}>
              {wordCount} word{wordCount === 1 ? '' : 's'}
              {maxWords !== null && ` / ${maxWords}`}
              {overLimit && ' — over limit'}
            </span>
            {mode === 'practice' && example && text.trim() && (
              <details className="text-ink-3">
                <summary className="cursor-pointer hover:text-accent">See example</summary>
                <span className="block mt-1 italic">{example}</span>
              </details>
            )}
          </div>
        </section>
      </div>
    </article>
  );
}
