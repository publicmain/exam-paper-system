import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { api } from '../lib/api';
import { formatCNDateTime } from '../lib/dateCN';

/**
 * F3 — student post-submit result page.
 *
 * Renders score summary at the top + per-question breakdown below.
 * Calm, exam-room-appropriate visuals (no Duolingo-style explosion):
 * green check / red X icon, the student's answer, the correct answer,
 * and a one-sentence explanation if the source question carried one.
 *
 * Server enforces the "submitted-or-window-closed" gate; this page
 * only handles the rendering of whatever the API returned.
 */

interface ResultItem {
  paperQuestionId: string;
  sortOrder: number;
  marks: number;
  questionType: string;
  snapshotContent: any;
  snapshotOptions: Array<{ key: string; text: string }> | null;
  studentAnswer: string | null;
  correctAnswer: string | null;
  explanation: string | null;
  awardedMarks: number | null;
  autoCorrect: boolean | null;
  isCorrect: boolean | null;
  // R10 follow-up — Claude AI grader's rationale for short_answer items
  // that hit the AI fallback (paraphrase / typo / non-letter input).
  // Server already stripped the `[ai-grade]` prefix before returning.
  markerComment: string | null;
}

interface ResultPayload {
  sessionId: string;
  paperName: string;
  status: string;
  autoScore: number | null;
  manualScore: number | null;
  totalScore: number | null;
  maxScore: number;
  submittedAt: string | null;
  items: ResultItem[];
}

export default function StudentResult() {
  const { sessionId } = useParams<{ sessionId: string }>();
  const navigate = useNavigate();
  const [data, setData] = useState<ResultPayload | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!sessionId) return;
    api.morningQuizStudentResult(sessionId).then(
      (r) => setData(r as ResultPayload),
      (e: any) => setError(String(e?.message ?? e)),
    );
  }, [sessionId]);

  if (error) {
    return (
      <div className="max-w-2xl mx-auto py-12 px-6 text-center">
        <div className="text-rose-700 text-lg mb-4" role="alert">
          ⚠️ {error}
        </div>
        <button
          className="text-sm text-blue-600 underline"
          onClick={() => navigate('/student')}
        >
          返回首页
        </button>
      </div>
    );
  }
  if (!data) {
    return <div className="max-w-2xl mx-auto p-6 text-gray-500">Loading…</div>;
  }

  const score = data.totalScore ?? data.autoScore ?? 0;
  const max = data.maxScore || 1;
  const pct = Math.round((score / max) * 100);
  const correctCount = data.items.filter((i) => i.isCorrect === true).length;
  const wrongCount = data.items.filter((i) => i.isCorrect === false).length;
  const ungradedCount = data.items.filter((i) => i.isCorrect === null).length;

  return (
    <div className="max-w-3xl mx-auto py-8 px-4 lg:px-6 space-y-6">
      {/* Score summary card — calm, no animation */}
      <header className="bg-white border border-gray-200 rounded-xl shadow-sm p-6 lg:p-8">
        <div className="text-sm text-gray-500 mb-1">{data.paperName}</div>
        <h1 className="text-2xl lg:text-3xl font-semibold text-gray-900 mb-4">
          已提交 · Submitted
        </h1>
        <div className="flex flex-wrap items-baseline gap-x-6 gap-y-2">
          <div>
            <div className="text-5xl lg:text-6xl font-bold text-gray-900 leading-none">
              {score}
              <span className="text-2xl text-gray-500 font-normal"> / {max}</span>
            </div>
            <div className="text-sm text-gray-500 mt-1">{pct}%</div>
          </div>
          <div className="flex gap-4 text-sm">
            <span className="text-emerald-700">
              ✓ 答对 {correctCount}
            </span>
            <span className="text-rose-700">✗ 答错 {wrongCount}</span>
            {ungradedCount > 0 && (
              <span className="text-gray-500">○ 待批改 {ungradedCount}</span>
            )}
          </div>
        </div>
        {data.submittedAt && (
          <div className="text-xs text-gray-400 mt-3">
            提交时间：{formatCNDateTime(data.submittedAt)}
          </div>
        )}
      </header>

      {/* Per-question breakdown */}
      <section className="space-y-3">
        <h2 className="text-lg font-semibold text-gray-800">逐题回顾</h2>
        {data.items.map((it) => (
          <ResultRow key={it.paperQuestionId} item={it} />
        ))}
      </section>

      {/* Intentionally NO 返回首页 button. The result page is the final
          screen on a shared classroom laptop; an exit button is a footgun
          that lets one student navigate into another student's view. */}
    </div>
  );
}

function ResultRow({ item }: { item: ResultItem }) {
  const sc = item.snapshotContent ?? {};
  const stem: string =
    typeof sc.stem === 'string'
      ? sc.stem
      : typeof sc === 'string'
      ? sc
      : '';
  const isMcq = item.questionType === 'mcq';

  // Status icon — three states: correct ✓, wrong ✗, pending ○.
  const status = item.isCorrect === true
    ? { icon: '✓', label: '答对', cls: 'bg-emerald-100 text-emerald-700 border-emerald-200' }
    : item.isCorrect === false
    ? { icon: '✗', label: '答错', cls: 'bg-rose-100 text-rose-700 border-rose-200' }
    : { icon: '○', label: '待批改', cls: 'bg-gray-100 text-gray-600 border-gray-200' };

  return (
    <article
      className="bg-white border border-gray-200 rounded-lg p-4 lg:p-5"
      data-testid={`result-row-${item.sortOrder}`}
    >
      <div className="flex items-start gap-3 mb-3">
        <span
          className={`shrink-0 inline-flex items-center justify-center w-8 h-8 rounded-full border ${status.cls} text-base font-semibold`}
          aria-label={status.label}
          title={status.label}
        >
          {status.icon}
        </span>
        <div className="flex-1 min-w-0">
          <div className="text-xs text-gray-500 mb-0.5">
            Q{item.sortOrder} · {item.marks} 分
          </div>
          <div className="text-sm lg:text-base text-gray-900 whitespace-pre-wrap leading-relaxed">
            {stem}
          </div>
        </div>
      </div>

      {isMcq && Array.isArray(item.snapshotOptions) && (
        <ul className="space-y-1 ml-11">
          {item.snapshotOptions.map((o) => {
            const isStudent = item.studentAnswer === o.key;
            const isAnswer = item.correctAnswer === o.key;
            return (
              <li
                key={o.key}
                className={
                  isAnswer
                    ? 'text-emerald-700'
                    : isStudent
                    ? 'text-rose-700'
                    : 'text-gray-700'
                }
              >
                <span className="font-mono mr-2">({o.key})</span>
                {o.text}
                {isStudent && <span className="ml-2 text-xs">← 你的答案</span>}
                {isAnswer && !isStudent && (
                  <span className="ml-2 text-xs">← 正确答案</span>
                )}
              </li>
            );
          })}
        </ul>
      )}

      {!isMcq && (
        <div className="ml-11 space-y-1 text-sm">
          <div>
            <span className="text-gray-500">你的答案：</span>
            <span className={item.isCorrect === false ? 'text-rose-700' : 'text-gray-900'}>
              {item.studentAnswer || '(空)'}
            </span>
          </div>
          {item.correctAnswer && (
            <div>
              <span className="text-gray-500">正确答案：</span>
              <span className="text-emerald-700">{item.correctAnswer}</span>
            </div>
          )}
        </div>
      )}

      {item.explanation && (
        <div className="ml-11 mt-3 p-3 bg-gray-50 rounded text-sm text-gray-700 italic leading-relaxed">
          {item.explanation}
        </div>
      )}

      {item.markerComment && (
        <div
          className="ml-11 mt-3 p-3 bg-blue-50 border border-blue-100 rounded text-sm text-blue-900 leading-relaxed"
          data-testid={`ai-rationale-${item.sortOrder}`}
        >
          <span className="text-xs font-semibold text-blue-700 mr-2">AI 判分理由</span>
          {item.markerComment}
        </div>
      )}
    </article>
  );
}
