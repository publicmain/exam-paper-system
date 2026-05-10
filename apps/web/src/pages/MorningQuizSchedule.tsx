import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../lib/api';

type Level = 'ielts_authentic' | 'ielts_simplified' | 'olevel';
// R10 — three ascending difficulty bands. ielts_simplified replaces the
// misnamed ielts_hard: it is the MIDDLE band (easier than authentic IELTS,
// harder than O-Level), targeting strong O-Level students stretching toward
// IELTS while keeping vocabulary in their reach.
const LEVEL_LABEL: Record<Level, string> = {
  ielts_authentic: '雅思真题 · IELTS Authentic',
  ielts_simplified: '轻难度雅思 · Simplified IELTS',
  olevel: 'O-Level 英语 · 1123',
};

interface ClassRow {
  id: string;
  name: string;
  classCode: string;
  level?: string | null;
  englishLevel?: { level: Level } | null;
}

interface ScheduledSession {
  id: string;
  date: string;
  status: string;
  class: { id: string; name: string };
  paperAssignment: { paper: { id: string; name: string; totalMarksActual: number } };
}

/**
 * Sunday-night view for English teachers. Pick a Monday → list classes that
 * have an EnglishLevel assigned → click "Generate next week" → backend runs
 * 5 days × N classes worth of QuickPaper jobs and creates MorningQuizSession
 * rows. Per-tuple failures surface in the result table without aborting the
 * whole batch.
 *
 * Also exposes the week's existing schedule (so re-clicking Generate is safe;
 * the backend skips dates that already have sessions).
 */
export default function MorningQuizSchedule() {
  const [classes, setClasses] = useState<ClassRow[]>([]);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [weekStart, setWeekStart] = useState<string>(() => nextMondayIso());
  const [scheduled, setScheduled] = useState<ScheduledSession[]>([]);
  const [busy, setBusy] = useState(false);
  const [outcomes, setOutcomes] = useState<any[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function refresh() {
    try {
      const [cls, sched] = await Promise.all([
        api.listClasses(),
        api.morningQuizScheduled(weekStart),
      ]);
      setClasses(cls);
      setScheduled(sched);
    } catch (e: any) {
      setError(e.message ?? String(e));
    }
  }

  useEffect(() => {
    // Round-7 H21 unmount guard. weekStart toggles fire fresh fetches
    // while the previous one is still in flight; without the cancel
    // flag the slower response can clobber the user's newer selection.
    let cancelled = false;
    (async () => {
      try {
        const [cls, sched] = await Promise.all([
          api.listClasses(),
          api.morningQuizScheduled(weekStart),
        ]);
        if (cancelled) return;
        setClasses(cls);
        setScheduled(sched);
      } catch (e: any) {
        if (!cancelled) setError(e.message ?? String(e));
      }
    })();
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [weekStart]);

  function toggle(id: string) {
    const next = new Set(selected);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    setSelected(next);
  }

  async function handleGenerate() {
    if (selected.size === 0) {
      setError('请至少选择一个班级');
      return;
    }
    setBusy(true);
    setError(null);
    setOutcomes(null);
    try {
      const r = await api.morningQuizBatchGenerate({
        weekStart,
        classIds: Array.from(selected),
      });
      setOutcomes(r.outcomes);
    } catch (e: any) {
      // R10-Bug5: previously the catch branch did NOT refresh — so when
      // batch-generate partially succeeded (e.g. 3 of 5 papers committed
      // before an AI rate-limit error aborted the rest), the user saw
      // the error but the schedule list still showed empty. They had to
      // hit F5 to discover the partial completion. Move refresh() to
      // the finally block so the list always reflects DB state.
      setError(e.message ?? String(e));
    } finally {
      // Always pull the latest schedule, even on partial failure, so any
      // papers that DID commit are immediately visible.
      try { await refresh(); } catch (e: any) { /* refresh error already shown via setError */ void e; }
      setBusy(false);
    }
  }

  // R10-Bug5: progressive auto-refresh while a batch is in flight.
  // Each paper takes 60–90s to generate (AI + QA review loop); for a
  // 5-day × N-class batch that's 5–8 minutes total. Without polling,
  // the user sees a spinner the whole time and no per-paper progress.
  // Refreshing scheduled[] every 15s surfaces papers as they commit.
  useEffect(() => {
    if (!busy) return;
    const t = setInterval(() => { refresh(); }, 15_000);
    return () => clearInterval(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [busy, weekStart]);

  async function handleSetLevel(classId: string, level: Level) {
    try {
      await api.setClassEnglishLevel(classId, level);
      await refresh();
    } catch (e: any) {
      setError(e.message ?? String(e));
    }
  }

  /** Open the public big-screen page in a new tab. Caller is the venue
   *  laptop hooked to the projector — they keep this tab full-screen. */
  function openDisplay(sessionId: string) {
    window.open(`/display?sessionId=${encodeURIComponent(sessionId)}`, '_blank', 'noopener,noreferrer');
  }

  /** DEV ONLY: fast-forward a session into "now-active" so we can test the
   *  scan flow off-hours. Server gates on MORNING_QUIZ_DEBUG=true env var
   *  and returns 404 when the flag is unset, so this button is harmless in
   *  production. After successful activation, immediately opens the display
   *  page so the user has a visible QR to scan. */
  async function handleDebugActivate(sessionId: string) {
    setError(null);
    try {
      await api.morningQuizDebugActivate(sessionId);
      await refresh();
      openDisplay(sessionId);
    } catch (e: any) {
      const msg = e.message ?? String(e);
      if (msg.includes('Not Found') || msg.includes('404')) {
        setError(
          '立即激活仅在 dev 模式下开放。如需上线前测试,请联系管理员把 MORNING_QUIZ_DEBUG=true 加到 Railway env。',
        );
      } else {
        setError(msg);
      }
    }
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <h1 className="text-2xl font-bold">Morning Quiz · 周排课</h1>
        <div className="flex items-center gap-3">
          <ExportAttendanceButton weekStart={weekStart} />
          <Link to="/morning-quiz/qa-review" className="text-sm text-amber-700 hover:underline">
            🤖 AI 审核待复核 →
          </Link>
          <Link to="/admin/attendance" className="text-sm text-blue-600 hover:underline">
            考勤记录 →
          </Link>
        </div>
      </div>

      {error && (
        <div className="mb-4 px-4 py-3 bg-rose-50 border border-rose-200 text-rose-700 rounded">
          {error}
        </div>
      )}

      <div className="bg-white border rounded-lg p-5 mb-6">
        <h2 className="font-semibold mb-3">1. 选目标周(周一日期)</h2>
        <input
          type="date"
          value={weekStart}
          onChange={(e) => setWeekStart(e.target.value)}
          className="border rounded px-3 py-1.5"
        />
        <span className="text-sm text-gray-500 ml-3">
          Mon-Fri {weekStart} ~ {addDays(weekStart, 4)}
        </span>
      </div>

      <div className="bg-white border rounded-lg p-5 mb-6">
        <h2 className="font-semibold mb-3">2. 配置每个班级的英语等级</h2>
        <table className="w-full text-sm">
          <thead className="text-left text-gray-500 border-b">
            <tr>
              <th className="py-2 w-8"></th>
              <th>班级</th>
              <th>当前等级</th>
              <th>切换</th>
            </tr>
          </thead>
          <tbody>
            {classes.map((c) => (
              <tr key={c.id} className="border-b last:border-0">
                <td className="py-2">
                  <input
                    type="checkbox"
                    checked={selected.has(c.id)}
                    onChange={() => toggle(c.id)}
                    disabled={!c.englishLevel}
                    title={c.englishLevel ? '' : '请先配置等级'}
                  />
                </td>
                <td>
                  <span className="font-medium">{c.name}</span>
                  <span className="text-gray-400 ml-2 font-mono">{c.classCode}</span>
                </td>
                <td>
                  {c.englishLevel ? (
                    <span className="badge bg-blue-100 text-blue-700 px-2 py-0.5 rounded text-xs">
                      {LEVEL_LABEL[c.englishLevel.level]}
                    </span>
                  ) : (
                    <span className="text-gray-400 italic">未配置</span>
                  )}
                </td>
                <td className="py-2">
                  <select
                    value={c.englishLevel?.level ?? ''}
                    onChange={(e) => handleSetLevel(c.id, e.target.value as Level)}
                    className="border rounded px-2 py-1 text-sm"
                  >
                    <option value="" disabled>
                      Set level
                    </option>
                    <option value="ielts_authentic">雅思真题 · IELTS Authentic</option>
                    <option value="ielts_simplified">轻难度雅思 · Simplified IELTS</option>
                    <option value="olevel">O-Level 英语 · 1123</option>
                  </select>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="bg-white border rounded-lg p-5 mb-6">
        <h2 className="font-semibold mb-3">3. 一键生成下周 5 套早测</h2>
        <div className="flex items-center gap-4">
          <button
            onClick={handleGenerate}
            disabled={busy || selected.size === 0}
            className="px-5 py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-300 text-white rounded font-medium"
          >
            {busy ? '生成中…(可能需要 1-2 分钟)' : `生成 ${selected.size} 个班 × 5 天`}
          </button>
          <span className="text-sm text-gray-500">
            将调用 AI 题目生成器,每张 paper ~18 题
          </span>
        </div>
      </div>

      {outcomes && (
        <div className="bg-white border rounded-lg p-5 mb-6">
          <h2 className="font-semibold mb-3">4. 本次生成结果</h2>
          <div className="text-sm">
            ✅ 成功 {outcomes.filter((o) => o.ok).length} ·
            ⚠️ 失败 {outcomes.filter((o) => !o.ok).length}
          </div>
          <div className="mt-3 max-h-64 overflow-y-auto text-xs">
            {outcomes.map((o, i) => (
              <div
                key={i}
                className={`px-2 py-1 ${o.ok ? 'text-green-700' : 'text-rose-700 bg-rose-50'}`}
              >
                {o.date} · class {o.classId.slice(0, 8)} ·{' '}
                {o.ok ? `OK paper=${o.paperId.slice(0, 8)}` : `FAIL ${o.code}`}
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="bg-white border rounded-lg p-5">
        <div className="flex items-center justify-between mb-3">
          <h2 className="font-semibold">本周已排课表 ({scheduled.length})</h2>
          {/* R10-Bug5: explicit refresh — for the case where the user
              wants to check progress mid-batch or after closing+reopening
              this tab, without re-mounting the whole page. */}
          <button
            type="button"
            onClick={() => refresh()}
            className="text-xs text-blue-600 hover:underline"
            title="重新拉取本周排课列表"
          >
            ↻ 刷新
          </button>
        </div>
        {scheduled.length === 0 ? (
          <div className="text-gray-500 text-sm">本周还没有排课</div>
        ) : (
          <table className="w-full text-sm">
            <thead className="text-left text-gray-500 border-b">
              <tr>
                <th className="py-2">日期</th>
                <th>班级</th>
                <th>试卷</th>
                <th>状态</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {scheduled.map((s) => (
                <tr key={s.id} className="border-b last:border-0">
                  <td className="py-2 font-mono">{s.date.slice(0, 10)}</td>
                  <td>{s.class.name}</td>
                  <td>{s.paperAssignment.paper.name}</td>
                  <td>
                    <span className="badge text-xs px-2 py-0.5 rounded bg-gray-100">
                      {s.status}
                    </span>
                  </td>
                  <td className="text-right whitespace-nowrap">
                    <button
                      onClick={() => openDisplay(s.id)}
                      className="text-xs px-2 py-1 rounded bg-blue-50 hover:bg-blue-100 text-blue-700 mr-1"
                      title="新标签页打开大屏 QR(投影用)"
                    >
                      🖥️ 大屏 QR
                    </button>
                    <button
                      onClick={() => handleDebugActivate(s.id)}
                      className="text-xs px-2 py-1 rounded bg-amber-50 hover:bg-amber-100 text-amber-700 mr-1"
                      title="DEV ONLY: 强制把 session 切到 active(测试用,生产开下线)"
                    >
                      ⚡ 立即激活
                    </button>
                    {/* Round-7 H22: previous link pointed at
                        /morning-quiz/dashboard/:id which has never been
                        registered as a route — clicking always landed on
                        the home redirect. No per-session dashboard page
                        exists yet (planned v9). Until then route to the
                        attendance admin which surfaces this session's
                        attendance + submission roll-up. */}
                    <Link
                      to={`/admin/attendance?sessionId=${s.id}`}
                      className="text-blue-600 hover:underline text-xs ml-1"
                    >
                      考勤 →
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}

function nextMondayIso(): string {
  const d = new Date();
  const dow = d.getDay(); // Sun=0, Mon=1
  const daysUntilNextMon = (8 - dow) % 7 || 7;
  d.setDate(d.getDate() + daysUntilNextMon);
  return d.toISOString().slice(0, 10);
}

function addDays(iso: string, n: number): string {
  const d = new Date(iso);
  d.setDate(d.getDate() + n);
  return d.toISOString().slice(0, 10);
}

/** Export-attendance button used in the page header. Lazy-instantiates
 *  a hidden anchor so we can name the .xlsx file without a navigation
 *  trip — the API streams a Blob which we hand to URL.createObjectURL. */
function ExportAttendanceButton({ weekStart }: { weekStart: string }) {
  const [busy, setBusy] = useState(false);
  const from = weekStart;
  const to = addDays(weekStart, 4);
  async function download() {
    if (busy) return;
    setBusy(true);
    try {
      const blob = await api.morningQuizExportAttendance({ from, to });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `morning-quiz-${from}-to-${to}.xlsx`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (e: any) {
      alert(`导出失败: ${e?.message ?? e}`);
    } finally {
      setBusy(false);
    }
  }
  return (
    <button
      type="button"
      onClick={download}
      disabled={busy}
      className="text-sm px-3 py-1.5 rounded-md border border-emerald-300 bg-emerald-50 hover:bg-emerald-100 text-emerald-800 disabled:opacity-60 touch-manipulation"
      title={`导出 ${from} ~ ${to} 的考勤+成绩+缺勤汇总 Excel`}
    >
      📥 {busy ? '生成中…' : '导出 Excel'}
    </button>
  );
}
