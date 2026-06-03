import { useEffect, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { BASE } from '../lib/api';
import {
  createPracticeClone,
  fetchTrend,
  fetchUpcomingForName,
  type TrendResponse,
  type UpcomingSession,
} from '../lib/api-student';
import ScoreTrendChart from '../components/ScoreTrendChart';
import { formatCNDateTime, formatCNTime } from '../lib/dateCN';
import { prettifyPaperName } from '../lib/paperName';

/**
 * Student self-service portal — typed-name lookup gives one page with
 *   - 出勤记录 (attendance: date / level / status / scan time)
 *   - 历史成绩 (submissions: paper / level / score, each row links to a
 *     per-question detail view at /my-history/submission/:id?name=...)
 *
 * Public route, rate-limited per IP (same threat model as the scan
 * flow — names are not a secret within the school). After a student
 * submits the morning quiz, MorningQuizTake.tsx navigates here with
 * ?name=<student.name> so the page auto-loads.
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
  /** R15-Audit#3 — short disambiguator (school email local-part, e.g.
   *  "s003", or fallback to studentId last-4-chars) so two same-name
   *  same-class candidates aren't visually identical. */
  hint?: string;
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
  const navigate = useNavigate();
  // Bug 2 — shared-laptop PII leak: previously, on mount we'd seed `name`
  // from localStorage and auto-fetch. Student B opening /my-history then
  // immediately saw student A's grades. New rule: ONLY auto-fetch when the
  // URL carries ?name=... (post-submit redirect or explicit link). The
  // input field still seeds from localStorage for convenience after a
  // refresh, but the fetch waits for an explicit "Look up" click.
  const urlName = params.get('name') ?? '';
  const [name, setName] = useState<string>(() => {
    if (urlName) return urlName;
    try { return localStorage.getItem('mq:history:name') ?? ''; } catch { return ''; }
  });
  const [submitted, setSubmitted] = useState(false);
  const [data, setData] = useState<HistoryResponse | null>(null);
  const [disambig, setDisambig] = useState<DisambigCandidate[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  // Bug 2 — one-tap confirmation for the "Switch student" button. Mobile
  // thumb-taps on this button used to nuke session state immediately.
  const [confirmSwitch, setConfirmSwitch] = useState(false);
  // F2 — upcoming (today's) morning-quiz sessions for this student.
  // Hidden when the backend isn't deployed yet (null) or there's nothing
  // scheduled (empty array).
  const [upcoming, setUpcoming] = useState<UpcomingSession[] | null>(null);
  const [chosenStudentId, setChosenStudentId] = useState<string | null>(null);
  // F17 — weekly trend, fetched in parallel with the main lookup.
  const [trend, setTrend] = useState<TrendResponse | null>(null);
  // F16 — per-row "practice again" pending state.
  const [practicePending, setPracticePending] = useState<string | null>(null);
  // Countdown re-render tick — bumped every 30s so the T-minus label updates.
  const [, setTick] = useState(0);

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
      // BASE may be empty in local dev (relative path); URL constructor
      // throws "Invalid URL" on bare paths, so build the query string by
      // hand. encodeURIComponent on every param so 中文 names round-trip.
      const qs =
        '?name=' + encodeURIComponent(trimmed) +
        (studentId ? '&studentId=' + encodeURIComponent(studentId) : '');
      const r = await fetch(`${BASE}/api/morning-quiz/history-by-name${qs}`);
      if (!r.ok) {
        const body = await r.json().catch(() => null);
        if (r.status === 404) {
          setError(`没有找到名为「${trimmed}」的学生 · No student found with this name. 请检查姓名是否完全一致(含全角符号)。`);
        } else if (r.status === 429) {
          setError('查询太频繁,请稍后再试 · Too many lookups, please wait a moment.');
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
      setChosenStudentId(studentId ?? null);
      try { localStorage.setItem('mq:history:name', trimmed); } catch {/* */}
      if (studentId) {
        try { localStorage.setItem('mq:history:studentId', studentId); } catch {/* */}
      }
      // Keep URL in sync so a refresh keeps the same student loaded.
      if (params.get('name') !== trimmed) {
        params.set('name', trimmed);
        setParams(params, { replace: true });
      }
      // F2 + F17 — fire-and-forget side fetches. Both are non-critical;
      // failures (incl. 404 = backend not deployed) silently hide the
      // affordance via the null-on-404 pattern in api-student.
      fetchUpcomingForName({ name: trimmed, studentId })
        .then((r) => {
          if (!r) { setUpcoming(null); return; }
          if ('needDisambiguation' in r) {
            // Trend/upcoming hit disambig — silently skip; the main
            // history call would also have hit it and is handled above.
            setUpcoming(null);
            return;
          }
          setUpcoming(r.upcoming ?? []);
        })
        .catch(() => setUpcoming(null));
      fetchTrend({ name: trimmed, studentId, weeks: 12 })
        .then((r) => setTrend(r))
        .catch(() => setTrend(null));
    } catch (e: any) {
      setError(String(e?.message ?? e));
    } finally {
      setLoading(false);
      setSubmitted(true);
    }
  }

  // Bug 2 — auto-look-up ONLY when ?name=... is in the URL (post-submit
  // redirect or shared link). Never auto-fetch from a localStorage-seeded
  // value — that's how student A's grades leaked to student B on the
  // shared classroom laptop. The localStorage value still seeds the
  // input for the same-user refresh convenience case, but loading data
  // requires an explicit button click.
  useEffect(() => {
    if (urlName && !submitted) lookup(urlName);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // F2 — re-render every 30s so the countdown label stays fresh. Stops
  // when there are no upcoming sessions to count down to.
  useEffect(() => {
    if (!upcoming || upcoming.length === 0) return;
    const t = setInterval(() => setTick((n) => n + 1), 30_000);
    return () => clearInterval(t);
  }, [upcoming]);

  // F16 — POST to /practice/:submissionId, then navigate to the new
  // practice-mode page. Graceful 404 → toast in setError.
  async function handlePracticeAgain(submissionId: string, studentNameForUrl: string) {
    if (practicePending) return;
    setPracticePending(submissionId);
    setError(null);
    try {
      const r = await createPracticeClone(submissionId, {
        studentName: studentNameForUrl,
        studentId: chosenStudentId ?? undefined,
      });
      if (r === null) {
        setError('练习模式暂未开放 · Practice mode not yet available.');
        return;
      }
      const qs =
        '?name=' + encodeURIComponent(studentNameForUrl) +
        (chosenStudentId ? '&studentId=' + encodeURIComponent(chosenStudentId) : '');
      navigate(`/practice/${r.practiceSubmissionId}${qs}`);
    } catch (e: any) {
      setError(String(e?.message ?? e));
    } finally {
      setPracticePending(null);
    }
  }

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
              starting point. Two-step confirm (Bug 2) — accidental thumb
              taps on mobile used to nuke state immediately. Also clears
              the dead mq:history:studentId key alongside mq:history:name. */}
          {(name || data) && !confirmSwitch && (
            <button
              type="button"
              onClick={() => setConfirmSwitch(true)}
              className="shrink-0 text-sm px-4 py-2 rounded-md border border-gray-300 bg-white hover:bg-gray-100 active:bg-gray-200 text-gray-700 font-medium touch-manipulation"
              title="清空记住的姓名, 让下一位学生查自己的"
            >
              ↺ 换学生 · Switch
            </button>
          )}
          {confirmSwitch && (
            <div className="shrink-0 flex items-center gap-2 text-sm">
              <span className="text-gray-700">确认换学生?</span>
              <button
                type="button"
                onClick={() => {
                  try { localStorage.removeItem('mq:history:name'); } catch {/* */}
                  try { localStorage.removeItem('mq:history:studentId'); } catch {/* */}
                  setName('');
                  setData(null);
                  setSubmitted(false);
                  setError(null);
                  setConfirmSwitch(false);
                  params.delete('name');
                  setParams(params, { replace: true });
                }}
                className="px-3 py-1.5 rounded-md border border-rose-300 bg-rose-50 hover:bg-rose-100 text-rose-700 font-medium touch-manipulation"
              >
                是
              </button>
              <button
                type="button"
                onClick={() => setConfirmSwitch(false)}
                className="px-3 py-1.5 rounded-md border border-gray-300 bg-white hover:bg-gray-100 text-gray-700 font-medium touch-manipulation"
              >
                否
              </button>
            </div>
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
              {disambig.map((c) => {
                // R15-Bug B: defensive — even though the backend now
                // filters out 0-enrollment candidates, the network may
                // race during a class transfer. If a ghost slips
                // through, render it disabled so the student doesn't
                // pick it and hit a 500 downstream.
                const unregistered = c.classes.length === 0;
                if (unregistered) {
                  return (
                    <div
                      key={c.studentId}
                      className="w-full text-left border border-rose-200 bg-rose-50 rounded-lg px-4 py-3 cursor-not-allowed opacity-70"
                      aria-disabled="true"
                    >
                      <div className="text-base font-semibold text-gray-900">{c.name}</div>
                      <div className="text-xs text-rose-700 mt-0.5">
                        未注册任何班级 · 请联系老师
                      </div>
                    </div>
                  );
                }
                return (
                  <button
                    key={c.studentId}
                    type="button"
                    onClick={() => lookup(name, c.studentId)}
                    className="w-full text-left border border-gray-200 hover:border-blue-400 bg-gray-50 hover:bg-blue-50 rounded-lg px-4 py-3 transition-colors"
                  >
                    <div className="flex items-baseline gap-2">
                      <span className="text-base font-semibold text-gray-900">{c.name}</span>
                      {c.hint && (
                        <span className="font-mono text-xs text-blue-700 bg-blue-50 border border-blue-200 rounded px-1.5 py-0.5">
                          {c.hint}
                        </span>
                      )}
                    </div>
                    <div className="text-xs text-gray-500 mt-0.5">
                      {c.classes.map((cls) => `${cls.name} (${cls.classCode})`).join(' · ')}
                    </div>
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {/* F2 — Today's upcoming morning quizzes. Hidden when the backend
            hasn't deployed the endpoint (upcoming === null) or when
            nothing is scheduled (empty array). */}
        {data && upcoming && upcoming.length > 0 && (
          <UpcomingTile sessions={upcoming} />
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
                        <th className="py-2 px-4 hidden sm:table-cell">扫码时间</th>
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
                          <td className="py-2 px-4 text-xs text-gray-500 hidden sm:table-cell">
                            {a.scanTime ? formatCNTime(a.scanTime) : '—'}
                          </td>
                          <td className="py-2 px-4 text-xs text-gray-500">{a.correctedNote ?? '—'}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </section>

            {/* F17 — score trend chart. Hidden when we have <2 data
                points (insufficient signal) or when backend hasn't
                deployed the endpoint (trend === null). */}
            {trend && trend.weeks && trend.weeks.length >= 2 && (
              <section className="bg-white border border-gray-200 rounded-xl shadow-sm">
                <div className="px-5 py-3 border-b font-semibold">📈 成绩趋势 · Trend</div>
                <div className="p-4">
                  <ScoreTrendChart data={trend} />
                </div>
              </section>
            )}

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
                    // R15-followup-7: practice rows are visually marked
                    // and link to the practice REVIEW page (/practice/:id)
                    // instead of the official submission detail. Without
                    // this, students who came from the practice result
                    // page got dumped to a 0/13 'original submission'
                    // detail and had no entry point back to their 13/13.
                    const isPractice = s.status === 'practice';
                    const detailHref = isPractice
                      ? `/practice/${s.submissionId}?name=${encodeURIComponent(data.student.name)}`
                      : `/my-history/submission/${s.submissionId}?name=${encodeURIComponent(data.student.name)}`;
                    const rowBg = isPractice
                      ? 'bg-violet-50/40 hover:bg-violet-50'
                      : 'hover:bg-gray-50';
                    return (
                      <li key={s.submissionId} className={`p-4 ${rowBg} transition-colors`}>
                        <div className="flex items-start gap-4">
                          <Link to={detailHref} className="flex-1 min-w-0 block">
                            <div className="text-sm font-semibold text-gray-900 truncate flex items-center gap-2 flex-wrap">
                              <span className="truncate">{prettifyPaperName(s.paperName)}</span>
                              {isPractice && (
                                <span className="shrink-0 text-[10px] font-semibold uppercase tracking-wide px-1.5 py-0.5 rounded bg-violet-100 text-violet-800 border border-violet-200">
                                  练习 · Practice
                                </span>
                              )}
                            </div>
                            <div className="text-xs text-gray-500 mt-0.5 flex flex-wrap gap-x-3 gap-y-0.5">
                              {s.date && <span>日期 {String(s.date).slice(0, 10)}</span>}
                              {s.level && <span>· {LEVEL_LABEL[s.level] ?? s.level}</span>}
                              <span>· {s.className}</span>
                              {isPractice && <span className="text-violet-700">· 不计入成绩</span>}
                            </div>
                            {s.submittedAt && (
                              <div className="text-[11px] text-gray-400 mt-1">
                                提交于 {formatCNDateTime(s.submittedAt)}
                              </div>
                            )}
                          </Link>
                          <div className="text-right shrink-0 flex flex-col items-end gap-2">
                            <Link to={detailHref} className="block">
                              <div className={`text-2xl font-bold ${pctColor}`}>
                                {score}
                                <span className="text-base text-gray-400 font-normal"> / {max}</span>
                              </div>
                              <div className={`text-xs ${pctColor}`}>{pct}%</div>
                              <div className="text-[11px] text-blue-600 mt-1">
                                {isPractice ? '查看练习卷 →' : '查看每题详情 →'}
                              </div>
                            </Link>
                            {/* F16 — clone this submission into a practice
                                run. Hidden on practice rows themselves —
                                you can't make a clone of a clone (the
                                schema's @@unique([assignmentId, studentId])
                                would also block it; surfacing a button
                                that 409s would be a worse UX than hiding
                                the affordance). */}
                            {!isPractice && (
                              <button
                                type="button"
                                onClick={() => handlePracticeAgain(s.submissionId, data.student.name)}
                                disabled={practicePending === s.submissionId}
                                className="text-[11px] px-2 py-1 rounded border border-emerald-300 bg-emerald-50 hover:bg-emerald-100 text-emerald-800 font-medium disabled:opacity-50"
                              >
                                {practicePending === s.submissionId ? '创建中…' : '🔄 重做 · Practice'}
                              </button>
                            )}
                          </div>
                        </div>
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

/** F2 — yellow "today's quiz(zes)" card. Per-session row shows time
 *  range + paper name + class label + a live T-minus countdown. The
 *  parent re-renders this every 30s so the label stays fresh. */
function UpcomingTile({ sessions }: { sessions: UpcomingSession[] }) {
  return (
    <section className="bg-amber-50 border-2 border-amber-300 rounded-xl shadow-sm p-5">
      <div className="font-semibold text-amber-900 mb-2">
        📅 今天的早测 · Today
      </div>
      <ul className="space-y-2">
        {sessions.map((s) => {
          const countdown = formatCountdown(s.quizStart);
          const levelLabel = s.level ? (LEVEL_LABEL[s.level] ?? s.level) : '';
          return (
            <li
              key={s.sessionId}
              className="bg-white border border-amber-200 rounded-lg px-3 py-2 text-sm"
            >
              <div className="flex flex-wrap items-baseline gap-x-2">
                <span className="font-mono text-amber-900">{formatCNTime(s.quizStart).slice(0, 5)}</span>
                <span className="text-gray-400">—</span>
                <span className="font-semibold text-gray-900">{prettifyPaperName(s.paperName)}</span>
              </div>
              <div className="text-xs text-gray-500 mt-0.5 flex flex-wrap gap-x-2 gap-y-0.5">
                <span>{s.className}</span>
                {levelLabel && <span>· {levelLabel}</span>}
                <span className="text-amber-700 font-medium">· {countdown}</span>
              </div>
            </li>
          );
        })}
      </ul>
    </section>
  );
}

/** Returns a humanised T-minus label or "进行中" / "已结束". */
function formatCountdown(target: string): string {
  const t = new Date(target).getTime();
  if (!Number.isFinite(t)) return '';
  const diffMs = t - Date.now();
  if (diffMs <= -60_000) return '已结束';
  if (diffMs <= 60_000 && diffMs > -60_000) return '正在开始 · starting now';
  const totalMin = Math.floor(diffMs / 60_000);
  if (totalMin < 60) return `T-minus ${totalMin} minutes`;
  const h = Math.floor(totalMin / 60);
  const m = totalMin % 60;
  return `T-minus ${h}h ${m}m`;
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
