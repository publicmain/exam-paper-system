import { useState, useEffect } from 'react';
import type { ExamPaper, ExamQuestion } from '../types';
import { useExam } from '../ExamContext';
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
  const total = paper?.questions?.length ?? 0;
  if (!total) {
    return (
      <div className="max-w-xl mx-auto py-12 px-6 text-center text-amber-800">
        该卷尚未出题，请联系老师。
      </div>
    );
  }
  const q = paper.questions[Math.min(idx, total - 1)];
  return (
    <div className="max-w-3xl mx-auto py-3" style={{ ['--mq-fs' as any]: String(fontScale) }}>
      <TransformationCard q={q} idx={idx} total={total} />
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
    <article id={`q-${q.id}`} className="bg-white border border-gray-200 rounded-xl shadow-sm">
      <header className="px-5 py-3 border-b flex items-center gap-3">
        <span className="text-xs text-gray-500 uppercase tracking-wide font-semibold">Sentence Transformation</span>
        <span className="text-xs text-gray-400">·</span>
        <span className="font-mono text-sm text-gray-500 tabular-nums">Q{idx + 1} / {total}</span>
        <span className="text-xs text-gray-400 ml-1">{q.marks}m</span>
        <div className="flex-1" />
        <QuestionFlag qid={q.id} />
      </header>
      <div className="px-6 py-6 space-y-5">
        <section>
          <div className="text-xs text-gray-500 uppercase tracking-wide mb-1.5">Original sentence</div>
          <p className="text-lg lg:text-xl font-serif text-gray-900 leading-relaxed border-l-4 border-gray-300 pl-4 italic">
            {original}
          </p>
        </section>
        <section>
          <div className="text-xs text-gray-500 uppercase tracking-wide mb-1.5">
            Rewrite{starter ? ' starting with the words shown' : ''}
            {maxWords !== null && (
              <span className="ml-2 normal-case text-gray-400">(max {maxWords} words)</span>
            )}
          </div>
          {starter && (
            <p className="text-base text-blue-700 font-mono mb-2">
              {starter}<span className="text-gray-400"> …</span>
            </p>
          )}
          <textarea
            value={text}
            onChange={(e) => {
              setText(e.target.value);
              setAnswer(q.id, { textAnswer: e.target.value });
            }}
            rows={3}
            placeholder={starter ? `Continue from "${starter}"…` : 'Write your rewritten sentence…'}
            className={`w-full border-2 rounded-lg px-4 py-3 text-base font-serif focus:outline-none focus:ring-2 ${
              overLimit
                ? 'border-rose-300 focus:border-rose-500 focus:ring-rose-200'
                : 'border-gray-300 focus:border-blue-500 focus:ring-blue-200'
            }`}
          />
          <div className="flex items-center justify-between mt-1.5 text-xs">
            <span className={overLimit ? 'text-rose-600 font-semibold' : 'text-gray-500'}>
              {wordCount} word{wordCount === 1 ? '' : 's'}
              {maxWords !== null && ` / ${maxWords}`}
              {overLimit && ' — over limit'}
            </span>
            {mode === 'practice' && example && text.trim() && (
              <details className="text-gray-500">
                <summary className="cursor-pointer hover:text-blue-600">See example</summary>
                <span className="block mt-1 italic">{example}</span>
              </details>
            )}
          </div>
        </section>
      </div>
    </article>
  );
}
