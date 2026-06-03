import { useEffect, useState } from 'react';
import { Link, useParams, useSearchParams } from 'react-router-dom';
import { api } from '../lib/api';
import AppealModal, { type AppealQuestionContext } from '../components/AppealModal';
import { formatCNDateTime } from '../lib/dateCN';
import { Spinner } from '../components/AsyncState';
import { prettifyPaperName, commonStemPrefix, stripStemPrefix } from '../lib/paperName';

/**
 * Public per-submission per-question detail page. Public, IP-gated
 * (school WiFi) + name-matched on the server. Reached from /my-history.
 *
 * Mirrors the existing /student/result/:sessionId page but doesn't
 * require a fresh login — the student types their name on /my-history,
 * clicks into a row, and lands here.
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
  markerComment: string | null;
  // Source of markerComment: 'teacher' (human marker — the norm) vs 'ai'
  // (AI-grader fallback). Drives the comment label. Older API responses may
  // omit it → treated as teacher.
  commentSource?: 'teacher' | 'ai' | null;
  // Full mark-scheme text for non-MCQ review. Display-only — never affects
  // the ✓/✗ correctness rendering.
  referenceAnswer?: string | null;
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

export default function MyHistoryDetail() {
  const { submissionId } = useParams<{ submissionId: string }>();
  const [params] = useSearchParams();
  const name = params.get('name') ?? '';
  const studentId = params.get('studentId') ?? '';
  const [data, setData] = useState<ResultPayload | null>(null);
  const [error, setError] = useState<string | null>(null);
  // F10 — open AppealModal for either the whole paper (paperQuestionId
  // undefined) or one specific question (full context inlined).
  const [appealTarget, setAppealTarget] = useState<
    | { kind: 'paper' }
    | { kind: 'question'; paperQuestionId: string; ctx: AppealQuestionContext }
    | null
  >(null);

  useEffect(() => {
    if (!submissionId || !name) return;
    api
      .morningQuizHistoryDetail({ submissionId, name })
      .then((r) => setData(r as ResultPayload))
      .catch((e: any) => {
        const msg = String(e?.message ?? e);
        if (msg.includes('name_mismatch') || msg.includes('Forbidden')) {
          setError('姓名不匹配 — Name does not match this submission.');
        } else if (msg.includes('not_found') || msg.includes('Not Found')) {
          setError('找不到这份提交 / 已被删除');
        } else {
          setError(msg);
        }
      });
  }, [submissionId, name]);

  const backToHistory = `/my-history?name=${encodeURIComponent(name)}`;

  if (error) {
    return (
      <div className="min-h-screen bg-gray-50">
        <div className="max-w-2xl mx-auto py-12 px-6 text-center">
          <div className="text-rose-700 text-lg mb-4" role="alert">⚠️ {error}</div>
          <Link className="text-sm text-blue-600 underline" to={backToHistory}>← 返回我的记录</Link>
        </div>
      </div>
    );
  }
  if (!data) {
    return (
      <div className="min-h-screen bg-gray-50">
        <Spinner label="加载中…" />
      </div>
    );
  }

  // The long "Read the narrative… Qn." preamble repeats on every
  // Section-B question's stem; pull the shared part out so we can show it
  // once at the top instead of burying each question under it.
  const commonIntro = commonStemPrefix(
    data.items.map((it) => {
      const sc = it.snapshotContent ?? {};
      return typeof sc.stem === 'string'
        ? sc.stem
        : typeof sc.text === 'string'
        ? sc.text
        : '';
    }),
  );
  const score = data.totalScore ?? data.autoScore ?? 0;
  const max = data.maxScore || 1;
  const pct = Math.round((score / max) * 100);
  const pctColor =
    pct >= 80 ? 'text-emerald-700' :
    pct >= 60 ? 'text-blue-700' :
    pct >= 40 ? 'text-amber-700' : 'text-rose-700';

  return (
    <div className="min-h-screen bg-gray-50">
      <main className="max-w-3xl mx-auto px-6 py-6 space-y-4">
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <Link to={backToHistory} className="text-sm text-blue-600 hover:underline">
            ← 返回我的记录
          </Link>
          {/* F10 — whole-paper appeal entry point. The modal handles
              graceful 404 if the backend hasn't deployed /appeals yet. */}
          <button
            type="button"
            onClick={() => setAppealTarget({ kind: 'paper' })}
            className="text-xs px-3 py-1.5 rounded border border-rose-300 bg-rose-50 hover:bg-rose-100 text-rose-700 font-medium"
          >
            🚩 申诉整张卷 · Appeal whole paper
          </button>
        </div>

        <header className="bg-white rounded-xl border shadow-sm p-5">
          <div className="text-sm text-gray-500">{prettifyPaperName(data.paperName)}</div>
          <div className={`text-4xl font-bold mt-2 ${pctColor}`}>
            {score}<span className="text-2xl text-gray-400 font-normal"> / {max}</span>
            <span className={`text-base ml-2 ${pctColor}`}>({pct}%)</span>
          </div>
          {data.submittedAt && (
            <div className="text-xs text-gray-400 mt-2">
              提交时间:{formatCNDateTime(data.submittedAt)}
            </div>
          )}
        </header>

        <section className="space-y-3">
          <h2 className="text-lg font-semibold text-gray-800 px-1">逐题回顾</h2>
          {commonIntro && (
            <div className="bg-white rounded-lg border border-gray-200 p-4 text-sm text-gray-700 whitespace-pre-wrap leading-relaxed">
              <div className="text-xs font-semibold text-gray-400 mb-1">
                试卷说明 · Instructions
              </div>
              {commonIntro}
            </div>
          )}
          {data.items.map((it) => (
            <ResultRow
              key={it.paperQuestionId}
              item={it}
              commonIntro={commonIntro}
              onAppeal={(ctx) =>
                setAppealTarget({
                  kind: 'question',
                  paperQuestionId: it.paperQuestionId,
                  ctx,
                })
              }
            />
          ))}
        </section>

        {appealTarget && submissionId && (
          <AppealModal
            submissionId={submissionId}
            paperQuestionId={
              appealTarget.kind === 'question' ? appealTarget.paperQuestionId : undefined
            }
            studentName={name}
            studentId={studentId || undefined}
            questionContext={
              appealTarget.kind === 'question' ? appealTarget.ctx : undefined
            }
            onClose={() => setAppealTarget(null)}
          />
        )}
      </main>
    </div>
  );
}

function ResultRow({
  item,
  onAppeal,
  commonIntro,
}: {
  item: ResultItem;
  onAppeal: (ctx: AppealQuestionContext) => void;
  commonIntro: string;
}) {
  const sc = item.snapshotContent ?? {};
  const rawStem: string =
    typeof sc.stem === 'string' ? sc.stem :
    typeof sc.text === 'string' ? sc.text : '';
  const stem = stripStemPrefix(rawStem, commonIntro);
  const isMcq = item.questionType === 'mcq';
  const isCorrect = item.isCorrect ?? item.autoCorrect;
  const awarded = item.awardedMarks;
  const showAwarded = awarded != null;
  // F10 — appeal eligibility: any row where the auto-grader said wrong OR
  // where the student scored less than full marks. Also enabled for null
  // (manual-mark-pending) so students can still flag a misgraded short
  // answer once it gets a score they disagree with.
  const canAppeal =
    item.autoCorrect === false ||
    (awarded != null && awarded < item.marks);
  const correctTone =
    isCorrect === true ? 'border-emerald-300 bg-emerald-50' :
    isCorrect === false ? 'border-rose-300 bg-rose-50' :
    'border-gray-200 bg-white';
  const icon = isCorrect === true ? '✓' : isCorrect === false ? '✗' : '—';
  const iconColor = isCorrect === true ? 'text-emerald-700' : isCorrect === false ? 'text-rose-700' : 'text-gray-400';

  return (
    <div className={`border rounded-lg p-4 ${correctTone}`}>
      <div className="flex items-start gap-3">
        <div className={`text-2xl font-bold ${iconColor} shrink-0`}>{icon}</div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 text-xs text-gray-500 mb-2">
            <span>Q{item.sortOrder}</span>
            <span className="px-1.5 py-0.5 bg-gray-100 rounded">{item.questionType}</span>
            <span>[{item.marks} mark{item.marks !== 1 ? 's' : ''}]</span>
            {showAwarded && (
              <span className="font-mono">得分:{awarded} / {item.marks}</span>
            )}
          </div>
          {stem && <div className="text-sm text-gray-800 whitespace-pre-wrap mb-3">{stem}</div>}
          {isMcq && item.snapshotOptions && (
            <div className="text-xs text-gray-600 mb-2 grid grid-cols-1 sm:grid-cols-2 gap-1">
              {item.snapshotOptions.map((o) => {
                const isSelected = String(item.studentAnswer ?? '').trim().toLowerCase() === String(o.key).toLowerCase();
                const isCorrectOpt = String(item.correctAnswer ?? '').trim().toLowerCase() === String(o.key).toLowerCase();
                return (
                  <div
                    key={o.key}
                    className={`px-2 py-1 rounded ${
                      isCorrectOpt ? 'bg-emerald-100 text-emerald-800' :
                      isSelected ? 'bg-rose-100 text-rose-800' : 'bg-white border'
                    }`}
                  >
                    <span className="font-mono mr-1">{o.key}.</span>
                    {o.text}
                    {isSelected && ' ← 我的答案'}
                    {isCorrectOpt && ' ✓ 正确'}
                  </div>
                );
              })}
            </div>
          )}
          {!isMcq && (
            <div className="text-xs text-gray-600 space-y-1">
              <div>
                <span className="text-gray-400">我的答案:</span>{' '}
                <span className="text-gray-800">
                  {item.studentAnswer ? item.studentAnswer : <em className="text-gray-400">(空答)</em>}
                </span>
              </div>
              {(item.referenceAnswer ?? item.correctAnswer) && (
                <div>
                  <span className="text-gray-400">参考答案:</span>{' '}
                  <span className="text-gray-800 whitespace-pre-wrap">
                    {item.referenceAnswer ?? item.correctAnswer}
                  </span>
                </div>
              )}
            </div>
          )}
          {item.markerComment && (
            <div className="mt-2 text-xs text-blue-700 bg-blue-50 border border-blue-200 rounded p-2">
              <span className="font-semibold">
                {item.commentSource === 'ai' ? 'AI 评语' : '老师评语'}:
              </span>{' '}
              {item.markerComment}
            </div>
          )}
          {item.explanation && (
            <div className="mt-2 text-xs text-gray-600 italic">{item.explanation}</div>
          )}
          {/* F10 — per-question appeal. Shown only where the row was
              marked wrong or partial; "submit" path goes through the
              shared AppealModal, which gracefully degrades on 404. */}
          {canAppeal && (
            <div className="mt-3">
              <button
                type="button"
                onClick={() =>
                  onAppeal({
                    sortOrder: item.sortOrder,
                    stem,
                    studentAnswer: item.studentAnswer,
                    correctAnswer: item.correctAnswer,
                    marks: item.marks,
                    awardedMarks: item.awardedMarks,
                  })
                }
                className="text-xs px-2 py-1 rounded border border-rose-300 bg-rose-50 hover:bg-rose-100 text-rose-700 font-medium"
              >
                🚩 申诉这题 · Appeal
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
