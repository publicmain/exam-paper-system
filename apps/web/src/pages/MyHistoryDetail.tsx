import { useEffect, useState } from 'react';
import { Link, useParams, useSearchParams } from 'react-router-dom';
import { api } from '../lib/api';

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
  const [data, setData] = useState<ResultPayload | null>(null);
  const [error, setError] = useState<string | null>(null);

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
        <div className="max-w-2xl mx-auto p-6 text-gray-500">Loading…</div>
      </div>
    );
  }

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
        <div>
          <Link to={backToHistory} className="text-sm text-blue-600 hover:underline">
            ← 返回我的记录
          </Link>
        </div>

        <header className="bg-white rounded-xl border shadow-sm p-5">
          <div className="text-sm text-gray-500">{data.paperName}</div>
          <div className={`text-4xl font-bold mt-2 ${pctColor}`}>
            {score}<span className="text-2xl text-gray-400 font-normal"> / {max}</span>
            <span className={`text-base ml-2 ${pctColor}`}>({pct}%)</span>
          </div>
          {data.submittedAt && (
            <div className="text-xs text-gray-400 mt-2">
              提交时间:{new Date(data.submittedAt).toLocaleString()}
            </div>
          )}
        </header>

        <section className="space-y-3">
          <h2 className="text-lg font-semibold text-gray-800 px-1">逐题回顾</h2>
          {data.items.map((it) => (
            <ResultRow key={it.paperQuestionId} item={it} />
          ))}
        </section>
      </main>
    </div>
  );
}

function ResultRow({ item }: { item: ResultItem }) {
  const sc = item.snapshotContent ?? {};
  const stem: string =
    typeof sc.stem === 'string' ? sc.stem :
    typeof sc.text === 'string' ? sc.text : '';
  const isMcq = item.questionType === 'mcq';
  const isCorrect = item.isCorrect ?? item.autoCorrect;
  const awarded = item.awardedMarks;
  const showAwarded = awarded != null;
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
              {item.correctAnswer && (
                <div>
                  <span className="text-gray-400">参考答案:</span>{' '}
                  <span className="text-gray-800">{item.correctAnswer}</span>
                </div>
              )}
            </div>
          )}
          {item.markerComment && (
            <div className="mt-2 text-xs text-blue-700 bg-blue-50 border border-blue-200 rounded p-2">
              <span className="font-semibold">AI 评语:</span> {item.markerComment}
            </div>
          )}
          {item.explanation && (
            <div className="mt-2 text-xs text-gray-600 italic">{item.explanation}</div>
          )}
        </div>
      </div>
    </div>
  );
}
