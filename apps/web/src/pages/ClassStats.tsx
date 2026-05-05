import { useEffect, useMemo, useState } from 'react';
import { api } from '../lib/api';

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
        <h1 className="text-2xl font-bold">Class Statistics</h1>
        <div className="flex items-center gap-2">
          <label className="text-sm text-gray-600">Class:</label>
          <select
            className="select w-64"
            value={classId}
            onChange={(e) => setClassId(e.target.value)}
            disabled={!classes}
          >
            {!classes && <option>Loading…</option>}
            {classes && classes.length === 0 && <option value="">— no classes —</option>}
            {classes?.map(c => (
              <option key={c.id} value={c.id}>{c.name} ({c.classCode})</option>
            ))}
          </select>
        </div>
      </div>

      {err && <div className="card text-red-700">{err}</div>}
      {loading && <div className="text-gray-500">Loading…</div>}

      {overview && (
        <>
          <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
            <StatCard label="Students" value={overview.studentCount} />
            <StatCard label="Papers assigned" value={overview.paperCount} />
            <StatCard
              label="Submitted"
              value={`${overview.totals.submitted} / ${overview.totals.expectedSubmissions}`}
              hint={`${overview.totals.missing} missing`}
            />
            <StatCard
              label="Mean auto-score"
              value={overview.meanAutoScorePct == null ? '—' : `${overview.meanAutoScorePct}%`}
            />
            <StatCard
              label="Mean total score"
              value={overview.meanTotalScorePct == null ? '—' : `${overview.meanTotalScorePct}%`}
              hint="(graded only)"
            />
          </div>

          <div className="card">
            <div className="flex items-center justify-between mb-3">
              <h2 className="font-semibold">Per-paper performance</h2>
            </div>
            {overview.perPaper.length === 0 ? (
              <div className="text-sm text-gray-500 py-3">No assignments yet.</div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="text-left text-gray-600 border-b">
                    <tr>
                      <th className="py-2 pr-3">Paper</th>
                      <th className="py-2 pr-3 text-right">Submitted</th>
                      <th className="py-2 pr-3 text-right">Marked</th>
                      <th className="py-2 pr-3 text-right">Missing</th>
                      <th className="py-2 pr-3 text-right">Mean auto</th>
                      <th className="py-2 pr-3 text-right">Mean total</th>
                      <th className="py-2 pr-3 text-right">Max</th>
                      <th className="py-2 pr-3"></th>
                    </tr>
                  </thead>
                  <tbody className="divide-y">
                    {overview.perPaper.map(p => (
                      <tr key={p.assignmentId}>
                        <td className="py-2 pr-3 font-medium">{p.paperName}</td>
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
                            Filter mastery
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          <div className="card">
            <div className="flex items-center justify-between mb-3">
              <h2 className="font-semibold">
                Topic mastery {paperId && <span className="text-xs text-gray-500">(filtered to one paper)</span>}
              </h2>
              {paperId && (
                <button className="btn btn-ghost text-xs" onClick={() => setPaperId('')}>Clear filter</button>
              )}
            </div>
            {!mastery || mastery.topics.length === 0 ? (
              <div className="text-sm text-gray-500 py-3">No graded MCQ data yet.</div>
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
          {pct == null ? 'no MCQ data' : `${pct}%`}
          <span className="text-gray-400 ml-2">({attempts} attempts · {questionCount} q)</span>
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
