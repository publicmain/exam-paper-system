import { useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { BASE } from '../lib/api';

/**
 * Student self-service portal — typed-name lookup gives one page with
 *   - 出勤记录 (attendance: date / level / status / scan time)
 *   - 历史成绩 (submissions: paper / level / score, each row links to a
 *     per-question detail view at /my-history/submission/:id?name=...)
 *
 * Public route, IP-gated to school WiFi (same threat model as the scan
 * flow). After a student submits the morning quiz, MorningQuizTake.tsx
 * navigates here with ?name=<student.name> so the page auto-loads.
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

interface AttendanceRow {
  id: string;
  sessionId: string;
  date: string;
  level: string | null;
  className: string;
  paperName: string;
  status: 'on_time' | 'late' | 'absent';
  scanTime: string | null;
  source: string;
  correctedNote: string | null;
}

interface HistoryResponse {
  student: { name: string; matchedCount: number; classes: string[] };
  submissions: HistorySubmission[];
  attendances: AttendanceRow[];
}

interface DisambigCandidate {
  studentId: string;
  name: string;
  classes: Array<{ id: string; name: string; classCode: string }>;
}

interface DisambigResponse {
  needDisambiguation: true;
  candidates: DisambigCandidate[];
}

type LookupResponse = HistoryResponse | DisambigResponse;

const LEVEL_LABEL: Record<string, string> = {
  ielts_authentic: '雅思真题 · IELTS Authentic',
  ielts_simplified: '轻难度雅思 · Simplified IELTS',
  olevel: 'O-Level 英语',
};
const LEVEL_SHORT: Record<string, string> = {
  ielts_authentic: '强',
  ielts_simplified: '中',
  olevel: '基',
};

const STATUS_BADGE: Record<AttendanceRow['status'], string> = {
  on_time: 'bg-emerald-100 text-emerald-800',
  late: 'bg-amber-100 text-amber-800',
  absent: 'bg-rose-100 text-rose-800',
};
const STATUS_LABEL: Record<AttendanceRow['status'], string> = {
  on_time: '按时',
  late: '迟到',
  absent: '缺勤',
};

export default function MyHistory() {
  const [params, setParams] = useSearchParams();
  // URL ?name=... wins on first mount (used by post-submit redirect);
  // otherwise fall back to remembered localStorage value.
  const [name, setName] = useState<string>(() => {
    const fromUrl = params.get('name');
    if (fromUrl) return fromUrl;
    try { return localStorage.getItem('mq:history:name') ?? ''; } catch { return ''; }
  });
  const [submitted, setSubmitted] = useState(false);
  const [data, setData] = useState<HistoryResponse | null>(null);
  const [disambig, setDisambig] = useState<DisambigCandidate[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function lookup(searchName: string, studentId?: string) {
    const trimmed = searchName.trim();
    if (!trimmed) {
      setError('请输入姓名 · Please type your name.');
      return;
    }
    setLoading(true);
    setError(null);
    setData(null);
    setDisambig(null);
    try {
      const url = new URL(`${BASE}/api/morning-quiz/history-by-name`);
      url.searchParams.set('name', trimmed);
      if (studentId) url.searchParams.set('studentId', studentId);
      const r = await fetch(url.toString());
      if (!r.ok) {
        const body = await r.json().catch(() => null);
        if (r.status === 404) {
          setError(`没有找到名为「${trimmed}」的学生 · No student found with this name. 请检查姓名是否完全一致(含全角符号)。`);
        } else if (r.status === 403) {
          setError('需要连接学校 WiFi · You must be on the school WiFi to view history.');
        } else {
          setError(body?.code || `查询失败 · Lookup failed (HTTP ${r.status})`);
        }
        return;
      }
      const json: LookupResponse = await r.json();
      // Bug 5: 同名学生 — backend signals with needDisambiguation: true
      // and returns the candidates. Show a picker; once student selects,
      // we re-fetch with the chosen studentId locked in.
      if ('needDisambiguation' in json && json.needDisambiguation) {
        setDisambig(json.candidates);
        return;
      }
      setData(json as HistoryResponse);
      try { localStorage.setItem('mq:history:name', trimmed); } catch {/* */}
      if (studentId) {
        try { localStorage.setItem('mq:history:studentId', studentId); } catch {/* */}
      }
      // Keep URL in sync so a refresh keeps the same student loaded.
      if (params.get('name') !== trimmed) {
        params.set('name', trimmed);
        setParams(params, { replace: true });
      }
    } catch (e: any) {
      setError(String(e?.message ?? e));
    } finally {
      setLoading(false);
      setSubmitted(true);
    }
  }

  // Auto-look-up on first mount if name was remembered or in URL.
  useEffect(() => {
    if (name && !submitted) lookup(name);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const attCounts = (() => {
    const c = { on_time: 0, late: 0, absent: 0 };
    for (const a of data?.attendances ?? []) c[a.status]++;
    return c;
  })();

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white border-b">
        <div className="max-w-4xl mx-auto px-6 py-4 flex items-start justify-between gap-4">
          <div>
            <h1 className="text-xl font-bold text-gray-900">📊 我的早测记录 · My Morning Quiz Portal</h1>
            <p className="text-xs text-gray-500 mt-1">
              输入姓名即可查看本人考勤 + 答题历史 · Type your name to see your attendance & quiz history.
            </p>
          </div>
          {/* Shared-laptop scenario: the previous student leaves the page
              loaded with their name; the next student needs a clean
              starting point. This button clears localStorage + the URL
              query, then reloads. */}
          {(name || data) && (
            <button
              type="button"
              onClick={() => {
                try { localStorage.removeItem('mq:history:name'); } catch {/* */}
                setName('');
                setData(null);
                setSubmitted(false);
                setError(null);
                params.delete('name');
                setParams(params, { replace: true });
              }}
              className="shrink-0 text-xs px-3 py-1.5 rounded-md border border-gray-300 bg-white hover:bg-gray-100 text-gray-700"
              title="清空记住的姓名, 让下一位学生查自己的"
            >
              ↺ 换学生 · Switch
            </button>
          )}
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-6 py-6 space-y-6">
        <form
          onSubmit={(e) => { e.preventDefault(); lookup(name); }}
          className="bg-white border border-gray-200 rounded-xl shadow-sm p-5 space-y-3"
        >
          <label className="block text-sm font-medium text-gray-700">
            姓名 · Name
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="mt-1 block w-full border border-gray-300 rounded-lg px-4 py-3 text-base focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-200"
              placeholder="例如:牟歌 / Alice Wong"
              autoComplete="off"
              autoFocus
            />
          </label>
          <button
            type="submit"
            disabled={loading || !name.trim()}
            className="w-full bg-blue-600 hover:bg-blue-700 active:bg-blue-800 disabled:bg-gray-300 disabled:cursor-not-allowed text-white font-semibold py-3 rounded-lg transition-colors"
          >
            {loading ? '查询中…' : '查看我的记录 · Look up'}
          </button>
        </form>

        {error && (
          <div className="bg-rose-50 border border-rose-200 rounded-lg p-4 text-rose-800 text-sm">
            ⚠️ {error}
          </div>
        )}

        {/* Bug 5: 同名学生 picker. Backend returns candidates when
            multiple students match the typed name; show a list and let
            the student tap the matching class entry. We use the chosen
            studentId to scope all subsequent lookups (and the URL keeps
            ?name=... so a refresh shows the picker again rather than
            silently merging strangers' records). */}
        {disambig && disambig.length > 0 && (
          <div className="bg-white border border-amber-200 rounded-xl shadow-sm p-5 space-y-3">
            <div className="text-sm">
              校内有 <b>{disambig.length}</b> 个名叫「{name.trim()}」的学生，请选你所在的班级:
            </div>
            <div className="grid gap-2">
              {disambig.map((c) => (
                <button
                  key={c.studentId}
                  type="button"
                  onClick={() => lookup(name, c.studentId)}
                  className="w-full text-left border border-gray-200 hover:border-blue-400 bg-gray-50 hover:bg-blue-50 rounded-lg px-4 py-3 transition-colors"
                >
                  <div className="text-base font-semibold text-gray-900">{c.name}</div>
                  <div className="text-xs text-gray-500 mt-0.5">
                    {c.classes.length === 0
                      ? '(未注册任何班级)'
                      : c.classes.map((cls) => `${cls.name} (${cls.classCode})`).join(' · ')}
                  </div>
                </button>
              ))}
            </div>
          </div>
        )}

        {data && (
          <>
            {/* Student summary card */}
            <section className="bg-white border border-gray-200 rounded-xl shadow-sm p-5">
              <div className="flex items-baseline gap-3 flex-wrap">
                <div className="text-lg font-semibold">{data.student.name}</div>
                {data.student.classes.length > 0 && (
                  <div className="text-sm text-gray-500">班级:{data.student.classes.join('、')}</div>
                )}
                {data.student.matchedCount > 1 && (
                  <div className="text-xs text-amber-700">
                    ⚠️ 校内有 {data.student.matchedCount} 个同名学生，下面合并显示
                  </div>
                )}
              </div>
              <div className="mt-3 grid grid-cols-2 md:grid-cols-4 gap-2 text-sm">
                <Stat label="按时到" value={attCounts.on_time} tint="emerald" />
                <Stat label="迟到" value={attCounts.late} tint="amber" />
                <Stat label="缺勤" value={attCounts.absent} tint="rose" />
                <Stat label="已交卷" value={data.submissions.length} tint="blue" />
              </div>
            </section>

            {/* Attendance section */}
            <section className="bg-white border border-gray-200 rounded-xl shadow-sm">
              <div className="px-5 py-3 border-b font-semibold">📅 出勤记录 · Attendance</div>
              {data.attendances.length === 0 ? (
                <div className="p-6 text-center text-gray-500 text-sm">还没有任何出勤记录</div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="text-left border-b text-xs text-gray-500">
                        <th className="py-2 px-4">日期</th>
                        <th className="py-2 px-4">Level</th>
                        <th className="py-2 px-4">考勤</th>
                        <th className="py-2 px-4">扫码时间</th>
                        <th className="py-2 px-4">备注</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y">
                      {data.attendances.map((a) => (
                        <tr key={a.id}>
                          <td className="py-2 px-4 font-mono">{String(a.date).slice(0, 10)}</td>
                          <td className="py-2 px-4">
                            <span className="inline-flex items-center px-2 py-0.5 rounded text-xs border border-gray-200 bg-gray-50 text-gray-700"
                              title={a.level ? (LEVEL_LABEL[a.level] ?? a.level) : '—'}>
                              {a.level ? (LEVEL_SHORT[a.level] ?? '?') : '—'}
                            </span>
                          </td>
                          <td className="py-2 px-4">
                            <span className={`text-xs px-2 py-0.5 rounded ${STATUS_BADGE[a.status]}`}>
                              {STATUS_LABEL[a.status]}
                            </span>
                            {a.source === 'manual_correction' && (
                              <span className="ml-1 text-xs text-gray-400">(老师补登)</span>
                            )}
                          </td>
                          <td className="py-2 px-4 text-xs text-gray-500">
                            {a.scanTime ? new Date(a.scanTime).toLocaleTimeString() : '—'}
                          </td>
                          <td className="py-2 px-4 text-xs text-gray-500">{a.correctedNote ?? '—'}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </section>

            {/* History section */}
            <section className="bg-white border border-gray-200 rounded-xl shadow-sm">
              <div className="px-5 py-3 border-b font-semibold">📝 答题历史 · Quiz History</div>
              {data.submissions.length === 0 ? (
                <div className="p-6 text-center text-gray-500 text-sm">
                  还没有任何提交记录。下次扫码答题提交后，成绩会出现在这里。
                </div>
              ) : (
                <ul className="divide-y">
                  {data.submissions.map((s) => {
                    const score = s.totalScore ?? s.autoScore ?? 0;
                    const max = s.maxScore || 1;
                    const pct = Math.round((score / max) * 100);
                    const pctColor =
                      pct >= 80 ? 'text-emerald-700' :
                      pct >= 60 ? 'text-blue-700' :
                      pct >= 40 ? 'text-amber-700' : 'text-rose-700';
                    return (
                      <li key={s.submissionId}>
                        <Link
                          to={`/my-history/submission/${s.submissionId}?name=${encodeURIComponent(data.student.name)}`}
                          className="block p-4 hover:bg-gray-50 transition-colors"
                        >
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
                              <div className="text-[11px] text-blue-600 mt-1">查看每题详情 →</div>
                            </div>
                          </div>
                        </Link>
                      </li>
                    );
                  })}
                </ul>
              )}
            </section>
          </>
        )}
      </main>
    </div>
  );
}

function Stat({
  label, value, tint,
}: { label: string; value: number; tint: 'emerald' | 'amber' | 'rose' | 'blue' }) {
  const cls = {
    emerald: 'bg-emerald-50 text-emerald-800 border-emerald-200',
    amber: 'bg-amber-50 text-amber-800 border-amber-200',
    rose: 'bg-rose-50 text-rose-800 border-rose-200',
    blue: 'bg-blue-50 text-blue-800 border-blue-200',
  }[tint];
  return (
    <div className={`border rounded-md p-3 ${cls}`}>
      <div className="text-xs uppercase tracking-wide">{label}</div>
      <div className="text-2xl font-bold mt-1">{value}</div>
    </div>
  );
}
