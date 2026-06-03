import { useEffect, useState } from 'react';
import { api } from '../lib/api';
import { prettifyPaperName } from '../lib/paperName';

/**
 * Wrong-answer dashboard — pick a paper, see which questions students
 * struggled with most.  Sorted worst-first by % correct.
 *
 * Like ClassStats.tsx, this page does not modify apps/web/src/lib/api.ts;
 * it talks directly to the analytics endpoints via tiny inline helpers.
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

interface WrongAnswerRow {
  paperQuestionId: string;
  questionId: string;
  sortOrder: number;
  questionType: string;
  marks: number;
  stemSnippet: string;
  totalSubmissions: number;
  answered: number;
  unanswered: number;
  correct: number | null;
  pctCorrect: number | null;
  topDistractor: { key: string; count: number; text: string | null } | null;
  pctMarkedNonZero: number | null;
}

interface Dashboard {
  paperId: string;
  paperName: string;
  totalSubmissions: number;
  rows: WrongAnswerRow[];
}

export default function WrongAnswerDashboardPage() {
  const [papers, setPapers] = useState<any[] | null>(null);
  const [paperId, setPaperId] = useState<string>('');
  const [dash, setDash] = useState<Dashboard | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    api.listPapers().then((ps: any[]) => {
      setPapers(ps);
      if (ps.length > 0 && !paperId) setPaperId(ps[0].id);
    }).catch((e) => setErr(String(e)));
  }, []);

  useEffect(() => {
    if (!paperId) return;
    setLoading(true);
    setErr(null);
    setDash(null);
    getJson<Dashboard>(`/analytics/paper/${paperId}/wrong-answers`)
      .then(setDash)
      .catch((e) => setErr(String(e)))
      .finally(() => setLoading(false));
  }, [paperId]);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">错题分析</h1>
        <div className="flex items-center gap-2">
          <label className="text-sm text-gray-600">卷子:</label>
          <select
            className="select w-80"
            value={paperId}
            onChange={(e) => setPaperId(e.target.value)}
            disabled={!papers}
          >
            {!papers && <option>加载中…</option>}
            {papers && papers.length === 0 && <option value="">— 暂无卷子 —</option>}
            {papers?.map(p => (
              <option key={p.id} value={p.id} title={p.name}>{prettifyPaperName(p.name)}</option>
            ))}
          </select>
        </div>
      </div>

      {err && <div className="card text-red-700">{err}</div>}
      {loading && <div className="text-gray-500">加载中…</div>}

      {dash && (
        <>
          <div className="grid grid-cols-3 gap-3">
            <div className="card">
              <div className="text-xs text-gray-500">卷子</div>
              <div className="text-lg font-semibold mt-1 truncate" title={dash.paperName}>{prettifyPaperName(dash.paperName)}</div>
            </div>
            <div className="card">
              <div className="text-xs text-gray-500">计入的作答数</div>
              <div className="text-2xl font-semibold mt-1">{dash.totalSubmissions}</div>
              <div className="text-xs text-gray-500 mt-1">已交 / 已批 / 已发回</div>
            </div>
            <div className="card">
              <div className="text-xs text-gray-500">题目数</div>
              <div className="text-2xl font-semibold mt-1">{dash.rows.length}</div>
              <div className="text-xs text-gray-500 mt-1">按正确率从低到高排序</div>
            </div>
          </div>

          <div className="card">
            {dash.rows.length === 0 ? (
              <div className="text-sm text-gray-500 py-3">这张卷子没有题目。</div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="text-left text-gray-600 border-b">
                    <tr>
                      <th className="py-2 pr-2 w-10">#</th>
                      <th className="py-2 pr-2 w-16">题型</th>
                      <th className="py-2 pr-3">题干</th>
                      <th className="py-2 pr-3 text-right w-24">正确率</th>
                      <th className="py-2 pr-3 text-right w-20">已作答</th>
                      <th className="py-2 pr-3 text-right w-20">未作答</th>
                      <th className="py-2 pr-3 w-44">最常见错误项</th>
                      <th className="py-2 pr-3 text-right w-20">分值</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y">
                    {dash.rows.map(r => (
                      <tr key={r.paperQuestionId} className={r.pctCorrect != null && r.pctCorrect < 40 ? 'bg-red-50' : ''}>
                        <td className="py-2 pr-2 text-gray-600">{r.sortOrder + 1}</td>
                        <td className="py-2 pr-2"><span className="badge text-xs">{r.questionType}</span></td>
                        <td className="py-2 pr-3 max-w-md">
                          <div className="line-clamp-2 text-gray-800">{r.stemSnippet || '(无题干)'}</div>
                        </td>
                        <td className="py-2 pr-3 text-right">
                          <PctBadge pct={r.pctCorrect} />
                        </td>
                        <td className="py-2 pr-3 text-right">{r.answered}/{r.totalSubmissions}</td>
                        <td className="py-2 pr-3 text-right">{r.unanswered}</td>
                        <td className="py-2 pr-3">
                          {r.topDistractor ? (
                            <span className="text-xs">
                              <span className="badge mr-1">{r.topDistractor.key}</span>
                              <span className="text-gray-600">×{r.topDistractor.count}</span>
                              {r.topDistractor.text && (
                                <span className="block text-gray-500 truncate max-w-[10rem]" title={r.topDistractor.text}>
                                  {r.topDistractor.text}
                                </span>
                              )}
                            </span>
                          ) : (
                            <span className="text-xs text-gray-400">—</span>
                          )}
                        </td>
                        <td className="py-2 pr-3 text-right">{r.marks}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}

function PctBadge({ pct }: { pct: number | null }) {
  if (pct == null) return <span className="text-xs text-gray-400">暂无</span>;
  const cls =
    pct < 40 ? 'badge-error' :
    pct < 70 ? 'badge-warn' :
    'badge-success';
  return <span className={`badge ${cls}`}>{pct}%</span>;
}
