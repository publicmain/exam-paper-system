import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../lib/api';

type Verdict = 'pass' | 'needs_review' | 'reject' | 'pending';

interface Issue {
  type: string;
  severity: 'critical' | 'high' | 'medium' | 'low';
  questionRef: string;
  description: string;
  evidence: string;
  suggestedFix: string;
}

interface PendingRow {
  id: string;
  name: string;
  qaReviewVerdict: Verdict;
  qaReviewSummary: string | null;
  qaReviewIssues: Issue[] | null;
  qaReviewedAt: string | null;
  qaReviewModel: string | null;
  qaReviewRetries: number;
  qaReviewCostUsd: number | null;
  config: any;
}

interface DetailReview {
  paper: {
    id: string;
    name: string;
    qaReviewVerdict: Verdict;
    qaReviewSummary: string | null;
    qaReviewIssues: Issue[] | null;
    qaReviewedAt: string | null;
    qaReviewModel: string | null;
    qaReviewTokens: number | null;
    qaReviewCostUsd: number | null;
    qaReviewRetries: number;
    qaTeacherAction: string | null;
    qaTeacherActionAt: string | null;
  };
  reviewable: {
    paperId: string;
    paperName: string;
    level: string;
    mode: string;
    passageRef?: string | null;
    passageText: string | null;
    questions: Array<{
      sortOrder: number;
      type: string;
      marks: number;
      stem: string;
      options: Array<{ key: string; text: string }>;
      correctAnswer: string;
    }>;
  };
}

const VERDICT_BADGE: Record<Verdict, string> = {
  pass: 'bg-green-100 text-green-700',
  needs_review: 'bg-amber-100 text-amber-800',
  reject: 'bg-rose-100 text-rose-700',
  pending: 'bg-gray-100 text-gray-700',
};

const VERDICT_LABEL: Record<Verdict, string> = {
  pass: '通过',
  needs_review: '待复核',
  reject: '驳回',
  pending: '审核中/未审核',
};

const SEV_COLOR: Record<Issue['severity'], string> = {
  critical: 'bg-rose-50 border-rose-200 text-rose-800',
  high: 'bg-amber-50 border-amber-200 text-amber-800',
  medium: 'bg-yellow-50 border-yellow-200 text-yellow-800',
  low: 'bg-blue-50 border-blue-200 text-blue-800',
};

export default function MorningQuizQaReview() {
  const [rows, setRows] = useState<PendingRow[]>([]);
  const [selected, setSelected] = useState<string | null>(null);
  const [detail, setDetail] = useState<DetailReview | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function refresh() {
    setError(null);
    try {
      const r = await api.qaReviewPending();
      setRows(r);
    } catch (e: any) {
      setError(e.message ?? String(e));
    }
  }

  async function loadDetail(paperId: string) {
    setSelected(paperId);
    setDetail(null);
    try {
      const r = await api.qaReviewDetail(paperId);
      setDetail(r);
    } catch (e: any) {
      setError(e.message ?? String(e));
    }
  }

  useEffect(() => {
    refresh();
  }, []);

  async function approve(paperId: string) {
    setBusy(true);
    setError(null);
    try {
      await api.qaReviewApprove(paperId);
      setSelected(null);
      setDetail(null);
      await refresh();
    } catch (e: any) {
      setError(e.message ?? String(e));
    } finally {
      setBusy(false);
    }
  }

  async function teacherReject(paperId: string) {
    const reason = prompt('请输入驳回原因(可选)') ?? undefined;
    setBusy(true);
    setError(null);
    try {
      await api.qaReviewTeacherReject(paperId, reason);
      setSelected(null);
      setDetail(null);
      await refresh();
    } catch (e: any) {
      setError(e.message ?? String(e));
    } finally {
      setBusy(false);
    }
  }

  async function rerun(paperId: string, strict = false) {
    setBusy(true);
    setError(null);
    try {
      await api.qaReviewRerun(paperId, strict);
      await loadDetail(paperId);
      await refresh();
    } catch (e: any) {
      setError(e.message ?? String(e));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <h1 className="text-2xl font-bold">Morning Quiz · AI 审核待复核队列</h1>
        <Link to="/morning-quiz/schedule" className="text-sm text-blue-600 hover:underline">
          ← 返回排课
        </Link>
      </div>

      {error && (
        <div className="mb-4 px-4 py-3 bg-rose-50 border border-rose-200 text-rose-700 rounded">
          {error}
        </div>
      )}

      <div className="grid grid-cols-3 gap-4">
        {/* Left column: pending list */}
        <div className="col-span-1 bg-white border rounded-lg p-4 max-h-[80vh] overflow-y-auto">
          <h2 className="font-semibold mb-3">
            待复核 ({rows.length})
          </h2>
          {rows.length === 0 ? (
            <div className="text-gray-500 text-sm">所有卷子都已通过 AI 审核 ✨</div>
          ) : (
            <ul className="space-y-2">
              {rows.map((r) => (
                <li
                  key={r.id}
                  className={`border rounded p-3 cursor-pointer hover:bg-gray-50 ${
                    selected === r.id ? 'ring-2 ring-blue-400' : ''
                  }`}
                  onClick={() => loadDetail(r.id)}
                >
                  <div className="flex items-center justify-between gap-2">
                    <span
                      className={`text-xs px-2 py-0.5 rounded ${VERDICT_BADGE[r.qaReviewVerdict]}`}
                    >
                      {VERDICT_LABEL[r.qaReviewVerdict]}
                    </span>
                    {r.qaReviewRetries > 0 && (
                      <span className="text-xs text-gray-500">
                        重试 {r.qaReviewRetries}×
                      </span>
                    )}
                  </div>
                  <div className="font-medium text-sm mt-1 truncate" title={r.name}>
                    {r.name}
                  </div>
                  {r.qaReviewSummary && (
                    <div className="text-xs text-gray-600 mt-1 line-clamp-2">
                      {r.qaReviewSummary}
                    </div>
                  )}
                  <div className="text-xs text-gray-400 mt-1">
                    {r.qaReviewedAt && new Date(r.qaReviewedAt).toLocaleString()}
                    {r.qaReviewCostUsd != null && ` · $${r.qaReviewCostUsd.toFixed(4)}`}
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>

        {/* Right column: detail */}
        <div className="col-span-2 bg-white border rounded-lg p-5 max-h-[80vh] overflow-y-auto">
          {!selected && (
            <div className="text-gray-500 text-sm">从左侧选一份卷子查看详细审核结果</div>
          )}
          {selected && !detail && <div className="text-gray-500 text-sm">加载中…</div>}
          {detail && (
            <div>
              <div className="flex items-center gap-3 mb-3 flex-wrap">
                <span
                  className={`text-xs px-2 py-0.5 rounded ${VERDICT_BADGE[detail.paper.qaReviewVerdict]}`}
                >
                  {VERDICT_LABEL[detail.paper.qaReviewVerdict]}
                </span>
                <h2 className="text-lg font-semibold">{detail.paper.name}</h2>
              </div>

              {detail.paper.qaReviewSummary && (
                <div className="bg-gray-50 border rounded p-3 mb-4 text-sm">
                  <div className="font-medium text-gray-700 mb-1">AI 摘要</div>
                  <div>{detail.paper.qaReviewSummary}</div>
                  <div className="text-xs text-gray-400 mt-2">
                    模型 {detail.paper.qaReviewModel} ·{' '}
                    {detail.paper.qaReviewTokens} tokens · $
                    {(detail.paper.qaReviewCostUsd ?? 0).toFixed(4)}
                    {detail.paper.qaReviewRetries > 0 &&
                      ` · 自动重试 ${detail.paper.qaReviewRetries} 次`}
                  </div>
                </div>
              )}

              {/* Action buttons */}
              <div className="flex gap-2 mb-5">
                <button
                  disabled={busy}
                  onClick={() => approve(detail.paper.id)}
                  className="px-4 py-2 bg-green-600 hover:bg-green-700 disabled:bg-gray-300 text-white rounded text-sm font-medium"
                  title="批准这张卷子,学生可以正常作答"
                >
                  ✓ 批准放行
                </button>
                <button
                  disabled={busy}
                  onClick={() => teacherReject(detail.paper.id)}
                  className="px-4 py-2 bg-rose-600 hover:bg-rose-700 disabled:bg-gray-300 text-white rounded text-sm font-medium"
                  title="把卷子归档,不放给学生"
                >
                  ✕ 驳回
                </button>
                <button
                  disabled={busy}
                  onClick={() => rerun(detail.paper.id, false)}
                  className="px-4 py-2 bg-blue-50 hover:bg-blue-100 text-blue-700 border border-blue-200 rounded text-sm"
                >
                  🔄 重新审核 (Sonnet)
                </button>
                <button
                  disabled={busy}
                  onClick={() => rerun(detail.paper.id, true)}
                  className="px-4 py-2 bg-purple-50 hover:bg-purple-100 text-purple-700 border border-purple-200 rounded text-sm"
                  title="升级到 Opus,做更严格的审核"
                >
                  🔬 严格审核 (Opus)
                </button>
              </div>

              {/* Issues */}
              {detail.paper.qaReviewIssues && detail.paper.qaReviewIssues.length > 0 && (
                <div className="mb-5">
                  <h3 className="font-semibold mb-2">
                    发现 {detail.paper.qaReviewIssues.length} 处问题
                  </h3>
                  <ul className="space-y-3">
                    {detail.paper.qaReviewIssues.map((iss, i) => (
                      <li
                        key={i}
                        className={`border rounded p-3 ${SEV_COLOR[iss.severity]}`}
                      >
                        <div className="flex items-center justify-between gap-2 mb-1">
                          <span className="text-xs font-mono uppercase">
                            {iss.severity} · {iss.type}
                          </span>
                          <span className="text-xs font-mono">{iss.questionRef}</span>
                        </div>
                        <div className="text-sm font-medium">{iss.description}</div>
                        {iss.evidence && (
                          <div className="text-xs mt-1 italic opacity-80">
                            原文: "{iss.evidence}"
                          </div>
                        )}
                        {iss.suggestedFix && (
                          <div className="text-xs mt-1 opacity-90">
                            建议: {iss.suggestedFix}
                          </div>
                        )}
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {/* Passage */}
              {detail.reviewable.passageText && (
                <div className="mb-5">
                  <h3 className="font-semibold mb-2">原文</h3>
                  <div className="bg-gray-50 border rounded p-3 text-sm whitespace-pre-wrap">
                    {detail.reviewable.passageText}
                  </div>
                </div>
              )}

              {/* Questions */}
              <div>
                <h3 className="font-semibold mb-2">题目 ({detail.reviewable.questions.length})</h3>
                <ol className="space-y-3">
                  {detail.reviewable.questions.map((q) => (
                    <li
                      key={q.sortOrder}
                      className="border rounded p-3 text-sm"
                    >
                      <div className="font-medium">
                        Q{q.sortOrder}.{' '}
                        <span className="text-xs text-gray-500 ml-1">
                          ({q.type}, {q.marks}m)
                        </span>
                      </div>
                      <div className="mt-1 whitespace-pre-wrap">{q.stem}</div>
                      {q.options.length > 0 && (
                        <ul className="mt-2 space-y-0.5">
                          {q.options.map((o) => (
                            <li
                              key={o.key}
                              className={
                                o.key === q.correctAnswer
                                  ? 'font-medium text-green-700'
                                  : ''
                              }
                            >
                              {o.key}) {o.text}
                            </li>
                          ))}
                        </ul>
                      )}
                      <div className="text-xs text-green-700 mt-1">
                        Correct: {q.correctAnswer}
                      </div>
                    </li>
                  ))}
                </ol>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
