import { useEffect, useMemo, useState } from 'react';
import { api } from '../lib/api';
import { prettifyPaperName } from '../lib/paperName';

/**
 * Class statistics — teachers / heads / admins pick a class, and we pull
 * per-class submission completeness, mean scores, and per-topic mastery.
 *
 * The page does not call into apps/web/src/lib/api.ts directly for the
 * analytics endpoints (api.ts is owned by another agent) — instead it
 * speaks to the backend via small inline fetch helpers below.  Once the
 * api.ts owner adds the analytics methods (see MERGE_INSTRUCTIONS.md),
 * the inline helpers can be swapped out one-for-one.
 */

const BASE = (import.meta as any).env?.VITE_API_URL || '';

function authHeaders(): Record<string, string> {
  const t = localStorage.getItem('auth_token');
  return t ? { Authorization: `Bearer ${t}` } : {};
}

async function getJson<T>(path: string): Promise<T> {
  const res = await fetch(`${BASE}/api${path}`, { headers: { 'Content-Type': 'application/json', ...authHeaders() } });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(text || `GET ${path} failed: ${res.status}`);
  }
  return res.json() as Promise<T>;
}

interface Overview {
  classId: string;
  className: string;
  classCode: string;
  studentCount: number;
  paperCount: number;
  totals: {
    expectedSubmissions: number;
    submitted: number;
    marked: number;
    inProgress: number;
    missing: number;
  };
  meanAutoScorePct: number | null;
  meanTotalScorePct: number | null;
  perPaper: Array<{
    paperId: string;
    paperName: string;
    assignmentId: string;
    studentsExpected: number;
    submitted: number;
    marked: number;
    missing: number;
    meanAutoScore: number | null;
    meanTotalScore: number | null;
    maxScore: number;
  }>;
}

interface TopicMastery {
  classId: string;
  paperId: string | null;
  topics: Array<{
    topicId: string | null;
    topicCode: string | null;
    topicName: string;
    questionCount: number;
    mcqAttempts: number;
    mcqCorrect: number;
    pctCorrect: number | null;
  }>;
}

export default function ClassStatsPage() {
  const [classes, setClasses] = useState<any[] | null>(null);
  const [classId, setClassId] = useState<string>('');
  const [paperId, setPaperId] = useState<string>('');
  const [overview, setOverview] = useState<Overview | null>(null);
  const [mastery, setMastery] = useState<TopicMastery | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    api.listClasses().then((cs: any[]) => {
      setClasses(cs);
      if (cs.length > 0 && !classId) setClassId(cs[0].id);
    }).catch((e) => setErr(String(e)));
  }, []);

  useEffect(() => {
    if (!classId) return;
    setLoading(true);
    setErr(null);
    setOverview(null);
    setMastery(null);
    setPaperId('');
    Promise.all([
      getJson<Overview>(`/analytics/class/${classId}/overview`),
      getJson<TopicMastery>(`/analytics/class/${classId}/topic-mastery`),
    ])
      .then(([o, m]) => { setOverview(o); setMastery(m); })
      .catch((e) => setErr(String(e)))
      .finally(() => setLoading(false));
  }, [classId]);

  // Refetch topic mastery when paperId filter changes
  useEffect(() => {
    if (!classId) return;
    const url = paperId
      ? `/analytics/class/${classId}/topic-mastery?paperId=${encodeURIComponent(paperId)}`
      : `/analytics/class/${classId}/topic-mastery`;
    getJson<TopicMastery>(url).then(setMastery).catch((e) => setErr(String(e)));
  }, [paperId, classId]);

  const maxBarPct = useMemo(() => {
    if (!mastery || mastery.topics.length === 0) return 100;
    return Math.max(100, ...mastery.topics.map(t => t.pctCorrect ?? 0));
  }, [mastery]);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">班级统计</h1>
        <div className="flex items-center gap-2">
          <label className="text-sm text-gray-600">班级:</label>
          <select
            className="select w-64"
            value={classId}
            onChange={(e) => setClassId(e.target.value)}
            disabled={!classes}
          >
            {!classes && <option>加载中…</option>}
            {classes && classes.length === 0 && <option value="">— 暂无班级 —</option>}
            {classes?.map(c => (
              <option key={c.id} value={c.id}>{c.name} ({c.classCode})</option>
            ))}
          </select>
        </div>
      </div>

      {err && <div className="card text-red-700">{err}</div>}
      {loading && <div className="text-gray-500">加载中…</div>}

      {overview && (
        <>
          <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
            <StatCard label="学生数" value={overview.studentCount} />
            <StatCard label="已布置卷子" value={overview.paperCount} />
            {/* Fix #6: include in-progress in the hint so the math reads
                consistently. Before: "1 / 57 ... 55 missing" left readers
                wondering where the 57th student went (the one who started
                but didn't submit). */}
            <StatCard
              label="已交"
              value={`${overview.totals.submitted} / ${overview.totals.expectedSubmissions}`}
              hint={
                overview.totals.inProgress > 0
                  ? `${overview.totals.inProgress} 进行中 · ${overview.totals.missing} 缺交`
                  : `${overview.totals.missing} 缺交`
              }
            />
            <StatCard
              label="平均自动分"
              value={overview.meanAutoScorePct == null ? '—' : `${overview.meanAutoScorePct}%`}
            />
            <StatCard
              label="平均总分"
              value={overview.meanTotalScorePct == null ? '—' : `${overview.meanTotalScorePct}%`}
              hint="(仅已批)"
            />
          </div>

          <div className="card">
            <div className="flex items-center justify-between mb-3">
              <h2 className="font-semibold">各卷表现</h2>
            </div>
            {overview.perPaper.length === 0 ? (
              <div className="text-sm text-gray-500 py-3">暂无布置的卷子。</div>
            ) : (
              <>
                <PaperMeanChart papers={overview.perPaper} />
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead className="text-left text-gray-600 border-b">
                      <tr>
                        <th className="py-2 pr-3">卷子</th>
                        <th className="py-2 pr-3 text-right">已交</th>
                        <th className="py-2 pr-3 text-right">已批</th>
                        <th className="py-2 pr-3 text-right">缺交</th>
                        <th className="py-2 pr-3 text-right">平均自动分</th>
                        <th className="py-2 pr-3 text-right">平均总分</th>
                        <th className="py-2 pr-3 text-right">满分</th>
                        <th className="py-2 pr-3"></th>
                      </tr>
                    </thead>
                    <tbody className="divide-y">
                      {overview.perPaper.map(p => (
                        <tr key={p.assignmentId}>
                          <td className="py-2 pr-3 font-medium" title={p.paperName}>{prettifyPaperName(p.paperName)}</td>
                          <td className="py-2 pr-3 text-right">{p.submitted}/{p.studentsExpected}</td>
                          <td className="py-2 pr-3 text-right">{p.marked}</td>
                          <td className="py-2 pr-3 text-right">{p.missing}</td>
                          <td className="py-2 pr-3 text-right">{fmtScore(p.meanAutoScore)}</td>
                          <td className="py-2 pr-3 text-right">{fmtScore(p.meanTotalScore)}</td>
                          <td className="py-2 pr-3 text-right">{p.maxScore}</td>
                          <td className="py-2 pr-3 text-right">
                            <button
                              className="btn btn-ghost text-xs"
                              onClick={() => setPaperId(p.paperId)}
                            >
                              知识点掌握
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </>
            )}
          </div>

          <div className="card">
            <div className="flex items-center justify-between mb-3">
              <h2 className="font-semibold">
                知识点掌握 {paperId && <span className="text-xs text-gray-500">(已筛选到单张卷子)</span>}
              </h2>
              {paperId && (
                <button className="btn btn-ghost text-xs" onClick={() => setPaperId('')}>清除筛选</button>
              )}
            </div>
            {!mastery || mastery.topics.length === 0 ? (
              <div className="text-sm text-gray-500 py-3">暂无已批改的选择题数据。</div>
            ) : (
              <div className="space-y-2">
                {mastery.topics.map(t => (
                  <TopicBar
                    key={(t.topicId ?? '__u__') + (t.topicCode ?? '')}
                    name={t.topicName}
                    code={t.topicCode}
                    pct={t.pctCorrect}
                    attempts={t.mcqAttempts}
                    questionCount={t.questionCount}
                    maxPct={maxBarPct}
                  />
                ))}
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}

function StatCard({ label, value, hint }: { label: string; value: string | number; hint?: string }) {
  return (
    <div className="card">
      <div className="text-xs text-gray-500">{label}</div>
      <div className="text-2xl font-semibold mt-1">{value}</div>
      {hint && <div className="text-xs text-gray-500 mt-1">{hint}</div>}
    </div>
  );
}

function TopicBar({
  name, code, pct, attempts, questionCount, maxPct,
}: { name: string; code: string | null; pct: number | null; attempts: number; questionCount: number; maxPct: number }) {
  const w = pct == null ? 0 : Math.max(0, Math.min(100, (pct / Math.max(maxPct, 1)) * 100));
  const colour = pct == null ? '#cbd5e1' : pct < 40 ? '#dc2626' : pct < 70 ? '#d97706' : '#16a34a';
  return (
    <div>
      <div className="flex items-baseline justify-between text-sm">
        <div className="font-medium truncate pr-3">
          {code && <span className="text-xs text-gray-500 mr-2">{code}</span>}
          {name}
        </div>
        <div className="text-xs text-gray-600 whitespace-nowrap">
          {pct == null ? '无选择题数据' : `${pct}%`}
          <span className="text-gray-400 ml-2">({attempts} 次作答 · {questionCount} 题)</span>
        </div>
      </div>
      <svg width="100%" height="14" className="mt-1 block">
        <rect x="0" y="0" width="100%" height="14" fill="#f3f4f6" rx="3" />
        <rect x="0" y="0" width={`${w}%`} height="14" fill={colour} rx="3" />
      </svg>
    </div>
  );
}

function fmtScore(v: number | null): string {
  if (v == null) return '—';
  return (Math.round(v * 10) / 10).toString();
}

/**
 * 各卷平均总分对比 — 纯 SVG 横向条形图（与 ScoreTrendChart / TopicBar 一致，
 * 不引入图表库）。条形长度按「平均总分 ÷ 满分」的百分比绘制；缺平均总分或
 * 满分为 0 的卷子不计入，全部缺失时整个图表不渲染。
 */
function PaperMeanChart({
  papers,
}: {
  papers: Array<{ assignmentId: string; paperName: string; meanTotalScore: number | null; maxScore: number }>;
}) {
  const bars = papers
    .map((p) => ({
      id: p.assignmentId,
      name: prettifyPaperName(p.paperName),
      rawName: p.paperName,
      pct:
        p.meanTotalScore != null && p.maxScore > 0
          ? Math.max(0, Math.min(100, (p.meanTotalScore / p.maxScore) * 100))
          : null,
    }))
    .filter((b) => b.pct != null) as Array<{ id: string; name: string; rawName: string; pct: number }>;

  if (bars.length === 0) return null;

  const rowH = 26;
  const labelW = 160;
  const trackX = labelW + 8;
  const W = 560;
  const trackW = W - trackX - 44; // 右侧留出百分比文字空间
  const H = bars.length * rowH + 8;

  const colourFor = (pct: number) => (pct < 40 ? '#dc2626' : pct < 70 ? '#d97706' : '#16a34a');

  return (
    <div className="mb-4 overflow-x-auto">
      <div className="text-xs text-gray-500 mb-1">各卷平均总分对比</div>
      <svg viewBox={`0 0 ${W} ${H}`} width="100%" height={H} role="img" aria-label="各卷平均总分对比">
        {bars.map((b, i) => {
          const y = i * rowH + 4;
          const barW = (b.pct / 100) * trackW;
          return (
            <g key={b.id}>
              <text x={labelW} y={y + 14} fontSize={11} fill="#374151" textAnchor="end">
                <title>{b.rawName}</title>
                {b.name.length > 22 ? b.name.slice(0, 21) + '…' : b.name}
              </text>
              <rect x={trackX} y={y + 4} width={trackW} height={12} fill="#f3f4f6" rx={3} />
              <rect x={trackX} y={y + 4} width={barW} height={12} fill={colourFor(b.pct)} rx={3} />
              <text x={trackX + trackW + 6} y={y + 14} fontSize={11} fill="#6b7280" textAnchor="start">
                {Math.round(b.pct)}%
              </text>
            </g>
          );
        })}
      </svg>
    </div>
  );
}
