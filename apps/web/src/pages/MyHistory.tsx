import { useEffect, useState } from 'react';
import { BASE } from '../lib/api';

/**
 * Student-self-service history page. Type your name → see every
 * morning quiz you've submitted, ordered by date.
 *
 * Public route (no login). Backend route is IP-gated to school WiFi
 * so this is only useful from on-campus — matches the existing scan
 * flow's threat model. Same name picker semantics as scan: exact
 * match against the school roster.
 *
 * Why not require the scan token: scan tokens expire with quizEnd, so
 * a student wanting to check yesterday's score wouldn't have a valid
 * token. Asking them to "re-scan to check history" defeats the point.
 */

interface HistorySubmission {
  submissionId: string;
  sessionId: string | null;
  date: string | null;
  level: string | null;
  paperName: string;
  className: string;
  autoScore: number | null;
  totalScore: number | null;
  maxScore: number;
  submittedAt: string | null;
  status: string;
}

interface HistoryResponse {
  student: { name: string; matchedCount: number };
  submissions: HistorySubmission[];
}

const LEVEL_LABEL: Record<string, string> = {
  ielts_authentic: '雅思真题 · IELTS Authentic',
  ielts_simplified: '轻难度雅思 · Simplified IELTS',
  olevel: 'O-Level 英语',
};

export default function MyHistory() {
  // Remember the last successfully-looked-up name in localStorage so a
  // student who comes back later doesn't have to retype. Cleared on
  // explicit "switch user" via the input.
  const [name, setName] = useState<string>(() => {
    try { return localStorage.getItem('mq:history:name') ?? ''; } catch { return ''; }
  });
  const [submitted, setSubmitted] = useState(false);
  const [data, setData] = useState<HistoryResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function lookup(searchName: string) {
    const trimmed = searchName.trim();
    if (!trimmed) {
      setError('请输入姓名 · Please type your name.');
      return;
    }
    setLoading(true);
    setError(null);
    setData(null);
    try {
      // IMPORTANT: must hit the API host (VITE_API_URL), not the SPA host.
      // Both apps are deployed as separate Railway services on different
      // subdomains; a bare /api path goes to the SPA and hits the 404
      // fallback (returns index.html, which fails to parse as JSON).
      const r = await fetch(`${BASE}/api/morning-quiz/history-by-name?name=${encodeURIComponent(trimmed)}`);
      if (!r.ok) {
        const body = await r.json().catch(() => null);
        if (r.status === 404) {
          setError(`没有找到名为「${trimmed}」的学生 · No student found with this name. 请检查姓名是否完全一致（含全角符号）。`);
        } else if (r.status === 403) {
          setError('需要连接学校 WiFi · You must be on the school WiFi to view history.');
        } else {
          setError(body?.code || `查询失败 · Lookup failed (HTTP ${r.status})`);
        }
        return;
      }
      const json: HistoryResponse = await r.json();
      setData(json);
      try { localStorage.setItem('mq:history:name', trimmed); } catch {}
    } catch (e: any) {
      setError(String(e?.message ?? e));
    } finally {
      setLoading(false);
      setSubmitted(true);
    }
  }

  // Auto-look-up on first mount if name was remembered.
  useEffect(() => {
    if (name && !submitted) lookup(name);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white border-b">
        <div className="max-w-3xl mx-auto px-6 py-4">
          <h1 className="text-xl font-bold text-gray-900">📊 我的早测成绩 · My Morning Quiz History</h1>
          <p className="text-xs text-gray-500 mt-1">输入姓名查看所有提交过的早测成绩 · Type your name to see every morning quiz you've submitted.</p>
        </div>
      </header>

      <main className="max-w-3xl mx-auto px-6 py-6 space-y-6">
        <form
          onSubmit={(e) => {
            e.preventDefault();
            lookup(name);
          }}
          className="bg-white border border-gray-200 rounded-xl shadow-sm p-5 space-y-3"
        >
          <label className="block text-sm font-medium text-gray-700">
            姓名 · Name
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="mt-1 block w-full border border-gray-300 rounded-lg px-4 py-3 text-base focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-200"
              placeholder="例如：牟歌 / Alice Wong"
              autoComplete="off"
              autoFocus
            />
          </label>
          <button
            type="submit"
            disabled={loading || !name.trim()}
            className="w-full bg-blue-600 hover:bg-blue-700 active:bg-blue-800 disabled:bg-gray-300 disabled:cursor-not-allowed text-white font-semibold py-3 rounded-lg transition-colors"
          >
            {loading ? '查询中…' : '查看我的成绩 · Look up'}
          </button>
        </form>

        {error && (
          <div className="bg-rose-50 border border-rose-200 rounded-lg p-4 text-rose-800 text-sm">
            ⚠️ {error}
          </div>
        )}

        {data && (
          <section className="space-y-3">
            <header className="px-1">
              <div className="text-xs text-gray-500">
                {data.submissions.length === 0
                  ? '还没有任何提交记录 · No submissions yet'
                  : `共 ${data.submissions.length} 份已提交早测`}
                {data.student.matchedCount > 1 && (
                  <span className="ml-2 text-amber-700">
                    · 校内有 {data.student.matchedCount} 个同名学生，下表合并显示
                  </span>
                )}
              </div>
            </header>

            {data.submissions.length === 0 ? (
              <div className="bg-white border border-gray-200 rounded-lg p-6 text-center text-gray-500">
                还没有任何提交记录。下次扫码答题提交后，成绩会出现在这里。
              </div>
            ) : (
              <ul className="space-y-2">
                {data.submissions.map((s) => {
                  const score = s.totalScore ?? s.autoScore ?? 0;
                  const max = s.maxScore || 1;
                  const pct = Math.round((score / max) * 100);
                  const pctColor =
                    pct >= 80 ? 'text-emerald-700' :
                    pct >= 60 ? 'text-blue-700' :
                    pct >= 40 ? 'text-amber-700' : 'text-rose-700';
                  return (
                    <li key={s.submissionId} className="bg-white border border-gray-200 rounded-lg p-4 hover:shadow-sm transition-shadow">
                      <div className="flex items-start gap-4">
                        <div className="flex-1 min-w-0">
                          <div className="text-sm font-semibold text-gray-900 truncate">{s.paperName}</div>
                          <div className="text-xs text-gray-500 mt-0.5 flex flex-wrap gap-x-3 gap-y-0.5">
                            {s.date && <span>日期 {String(s.date).slice(0, 10)}</span>}
                            {s.level && <span>· {LEVEL_LABEL[s.level] ?? s.level}</span>}
                            <span>· {s.className}</span>
                          </div>
                          {s.submittedAt && (
                            <div className="text-[11px] text-gray-400 mt-1">
                              提交于 {new Date(s.submittedAt).toLocaleString()}
                            </div>
                          )}
                        </div>
                        <div className="text-right shrink-0">
                          <div className={`text-2xl font-bold ${pctColor}`}>
                            {score}
                            <span className="text-base text-gray-400 font-normal"> / {max}</span>
                          </div>
                          <div className={`text-xs ${pctColor}`}>{pct}%</div>
                        </div>
                      </div>
                    </li>
                  );
                })}
              </ul>
            )}
          </section>
        )}
      </main>
    </div>
  );
}
