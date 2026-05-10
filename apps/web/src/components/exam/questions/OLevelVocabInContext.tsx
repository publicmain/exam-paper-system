import { useState } from 'react';
import type { ExamPaper, ExamQuestion } from '../types';
import { useExam } from '../ExamContext';
import { clean } from '../shared/textUtils';
import { QuestionFlag } from '../shared/QuestionFlag';

/**
 * Vocabulary-in-Context renderer.
 *
 * One card per screen, exam-paper feel — white card on grey background,
 * the target word emphasised in the centre, four MCQ options below.
 * Deliberately stripped of decoration: no emoji, no animation. Students
 * have told us anything more than this distracts them on a real test.
 *
 * The data shape we expect:
 *   snapshotContent.contextSentence  // the sentence containing the target
 *   snapshotContent.targetWord       // emphasised word
 *   snapshotOptions                  // 4 MCQs
 * Falls back to using `stem` if the structured fields aren't there.
 */

export function OLevelVocabInContext({ paper }: { paper: ExamPaper }) {
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
    <div className="max-w-2xl mx-auto py-3" style={{ ['--mq-fs' as any]: String(fontScale) }}>
      <VocabCard q={q} idx={idx} total={total} />
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

function VocabCard({ q, idx, total }: { q: ExamQuestion; idx: number; total: number }) {
  const { answers, setAnswer, mode } = useExam();
  const ans = answers[q.id];
  const c = q.snapshotContent ?? {};
  const stem = clean(c.stem ?? '');
  const contextSentence = clean(c.contextSentence ?? stem);
  const targetWord = clean(c.targetWord ?? '');
  const correctKey = typeof c.correctOption === 'string' ? c.correctOption : null;
  const showFeedback = mode === 'practice' && ans?.selectedOption && correctKey;
  const isCorrect = showFeedback && ans.selectedOption === correctKey;

  // If we have a target word, render the sentence with the word bolded.
  const sentenceNode = targetWord
    ? renderWithEmphasis(contextSentence, targetWord)
    : <span>{contextSentence}</span>;

  return (
    <article id={`q-${q.id}`} className="bg-white border border-gray-200 rounded-xl shadow-sm">
      <header className="px-5 py-3 border-b flex items-center gap-3">
        <span className="text-xs text-gray-500 uppercase tracking-wide font-semibold">Vocabulary in Context</span>
        <span className="text-xs text-gray-400">·</span>
        <span className="font-mono text-sm text-gray-500 tabular-nums">Q{idx + 1} / {total}</span>
        <span className="text-xs text-gray-400 ml-1">{q.marks}m</span>
        <div className="flex-1" />
        <QuestionFlag qid={q.id} />
      </header>
      <div className="px-6 py-8">
        <p className="text-lg lg:text-xl text-gray-800 leading-[1.9] font-serif text-center">
          {sentenceNode}
        </p>
        {targetWord && (
          <p className="text-center text-sm text-gray-500 mt-3 italic">
            What is the meaning of <strong className="not-italic font-semibold">{targetWord}</strong> in this sentence?
          </p>
        )}
        <ul className="space-y-2 mt-6 max-w-md mx-auto">
          {(q.snapshotOptions ?? []).map((opt) => {
            const checked = ans?.selectedOption === opt.key;
            const isThisCorrect = showFeedback && opt.key === correctKey;
            const isThisWrong = showFeedback && checked && opt.key !== correctKey;
            return (
              <li key={opt.key}>
                <label
                  className={`flex gap-3 items-center p-3 rounded-lg border cursor-pointer transition-colors touch-manipulation min-h-[48px] ${
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
                    name={`v-${q.id}`}
                    checked={checked}
                    onChange={() => setAnswer(q.id, { selectedOption: opt.key })}
                    className="w-5 h-5"
                  />
                  <span className="font-mono text-gray-500 text-base w-6">{opt.key}.</span>
                  <span className="flex-1 text-base">{clean(opt.text)}</span>
                </label>
              </li>
            );
          })}
        </ul>
        {showFeedback && (
          <div className={`mt-4 text-sm text-center font-medium ${isCorrect ? 'text-green-700' : 'text-rose-700'}`}>
            {isCorrect ? '✓ Correct' : `✗ Correct: ${correctKey}`}
          </div>
        )}
      </div>
    </article>
  );
}

function renderWithEmphasis(sentence: string, target: string): React.ReactNode {
  const i = sentence.toLowerCase().indexOf(target.toLowerCase());
  if (i === -1) return <span>{sentence}</span>;
  return (
    <>
      <span>{sentence.slice(0, i)}</span>
      <strong className="font-bold underline decoration-2 decoration-amber-400 underline-offset-4">
        {sentence.slice(i, i + target.length)}
      </strong>
      <span>{sentence.slice(i + target.length)}</span>
    </>
  );
}
