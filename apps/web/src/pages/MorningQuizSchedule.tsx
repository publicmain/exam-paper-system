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
  // R10 multi-level: a class registers N difficulty bands; each shows up
  // as its own row in englishLevels. The schedule UI renders one chip
  // per band per class.
  englishLevels?: Array<{ level: Level }>;
}

interface ScheduledSession {
  id: string;
  date: string;
  status: string;
  level: Level;
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
  // Default to the CURRENT week so teachers landing here on a school day
  // immediately see today's + the rest of the week's already-scheduled
  // sessions. Used to default to next Monday, which hid the current week
  // unless the user changed the date — confusing when staff just wanted to
  // double-check today's QR is live.
  const [weekStart, setWeekStart] = useState<string>(() => currentMondayIso());
  const [scheduled, setScheduled] = useState<ScheduledSession[]>([]);
  const [busy, setBusy] = useState(false);
  const [outcomes, setOutcomes] = useState<any[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  // 题库健康度: classId -> level -> {totalBank, usedRecent, remaining, depleted}.
  // Loaded once per classes refresh. Used to render "(剩 X/Y 篇)" on each
  // level chip in section 2, so the operator sees depletion BEFORE clicking
  // generate.
  const [bankStats, setBankStats] = useState<
    Record<string, Record<string, { totalBank: number; usedRecent: number; remaining: number; depleted: boolean }>>
  >({});

  async function refresh() {
    try {
      const [cls, sched] = await Promise.all([
        api.listClasses(),
        api.morningQuizScheduled(weekStart),
      ]);
      setClasses(cls);
      setScheduled(sched);
      await loadBankStats(cls);
    } catch (e: any) {
      setError(e.message ?? String(e));
    }
  }

  /** Fetch bank-health for every class that has at least one level
   *  registered. Soft-fails (logs to error state) so a stats hiccup
   *  doesn't break the whole schedule page. */
  async function loadBankStats(cls: ClassRow[]) {
    const next: typeof bankStats = {};
    await Promise.all(
      cls
        .filter((c) => (c.englishLevels?.length ?? 0) > 0)
        .map(async (c) => {
          try {
            const r = await api.morningQuizBankStats(c.id);
            const byLevel: Record<string, any> = {};
            for (const s of r.stats) byLevel[s.level] = s;
            next[c.id] = byLevel;
          } catch {
            /* per-class failure is non-fatal; chip just won't show count */
          }
        }),
    );
    setBankStats(next);
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
        await loadBankStats(cls);
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

  async function handleGenerate(opts: { force?: boolean } = {}) {
    if (selected.size === 0) {
      setError('请至少选择一个班级');
      return;
    }
    if (opts.force) {
      const confirmed = confirm(
        `强制重新生成 ${weekStart} 这周 ${selected.size} 个班级的所有早测卷？\n\n` +
          `会删除本周已存在的卷子（含学生答卷数据），然后按当前题库重新抽取一份不重复的内容。` +
          `通常在新题库刚 ingest 完想立刻让本周生效时使用。`,
      );
      if (!confirmed) return;
    }
    setBusy(true);
    setError(null);
    setOutcomes(null);
    try {
      const r = await api.morningQuizBatchGenerate({
        weekStart,
        classIds: Array.from(selected),
        force: opts.force,
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
      // R10 multi-level: setClassEnglishLevel is now ADD-not-replace.
      // The class can carry several bands at once.
      await api.setClassEnglishLevel(classId, level);
      await refresh();
    } catch (e: any) {
      setError(e.message ?? String(e));
    }
  }

  async function handleRemoveLevel(classId: string, level: Level) {
    if (!confirm(`移除该等级? 之前已生成的 ${LEVEL_LABEL[level]} 卷子保留, 之后不再生成。`)) {
      return;
    }
    try {
      await api.removeClassEnglishLevel(classId, level);
      await refresh();
    } catch (e: any) {
      setError(e.message ?? String(e));
    }
  }

  /** Open the public big-screen page in a new tab pinned to a specific
   *  session. Caller is the venue laptop hooked to the projector — they
   *  keep this tab full-screen. */
  function openDisplay(sessionId: string) {
    window.open(`/display?sessionId=${encodeURIComponent(sessionId)}`, '_blank', 'noopener,noreferrer');
  }

  /** Open the display page in "auto-resolve" mode — pinned to the class,
   *  not a specific session. The /qr/current endpoint will return today's
   *  session if it's still scheduled/active, else automatically fall
   *  through to tomorrow's. Used for the "leave the page open overnight
   *  on the projector" workflow: open this tab Mon evening, walk away,
   *  Tue morning at 8:30 the QR is already there and active. */
  function openDisplayOvernight(classIdToShow: string) {
    window.open(
      `/display?classId=${encodeURIComponent(classIdToShow)}`,
      '_blank',
      'noopener,noreferrer',
    );
  }

  /** DEV ONLY: fast-forward a session into "now-active" so we can test
   *  the scan flow off-hours. Server gates on MORNING_QUIZ_DEBUG=true env
   *  var and returns 404 when the flag is unset, so this button is
   *  harmless in production (button click surfaces a clear message).
   *  After successful activation, immediately opens the display page so
   *  the user has a visible QR to scan. */
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

  /** Inverse of handleDebugActivate — restore a dry-run session back to
   *  scheduled status with canonical 08:30 timestamps. Use this after a
   *  dry-run so tomorrow's actual cron-activation works normally. */
  async function handleRevertSession(sessionId: string) {
    setError(null);
    try {
      await api.morningQuizRevertToScheduled(sessionId);
      await refresh();
    } catch (e: any) {
      const msg = e.message ?? String(e);
      if (msg.includes('Not Found') || msg.includes('404')) {
        setError(
          '撤销激活仅在 dev 模式下开放。MORNING_QUIZ_DEBUG=true 要打开。',
        );
      } else {
        setError(msg);
      }
    }
  }

  /** One-shot: nuke every Paper / Session / Attendance / Submission
   *  derived from a retired content bank (currently: cambridge_0510 —
   *  the old OLEVEL 0510 papers that the picker stopped using after
   *  commit be96aa6's switch to Singapore 1128). Cleans student-portal
   *  noise (5/18 future-dated attendance rows from dev testing, etc.).
   *
   *  Irreversible — but it's only deleting data that hasn't been picked
   *  by the post-be96aa6 picker, so no real morning quiz is affected.
   */
  async function handleCleanupRetired() {
    const confirmed = confirm(
      `清理所有「已退役内容」(cambridge_0510) 关联的 Paper / Session /\n` +
        `考勤 / 答卷 / 答题记录?\n\n` +
        `这是 5/11 切到 Singapore 1128 之前留下的旧测试数据, 现在还污染着\n` +
        `学生 portal 的考勤记录(例如未来日期 5/18 的考勤行)。\n\n` +
        `不可撤销, 但只删 picker 已经不用的数据, 不会影响真实早测。`,
    );
    if (!confirmed) return;
    setError(null);
    try {
      const r = await api.morningQuizCleanupRetired();
      alert(
        `清理完成:\n` +
          `  · 删除 papers: ${r.papersDeleted}\n` +
          `  · 覆盖的 provenance tag: ${r.provenanceTagsCovered.join(', ')}\n\n` +
          `attendance / submission / answer scripts 通过 FK cascade 同步删除。`,
      );
      await refresh();
    } catch (e: any) {
      setError(e.message ?? String(e));
    }
  }

  /** One-shot: delete all sessions scheduled for non-school days
   *  (Mon/Sat/Sun). Use after updating batchGenerateForWeek to skip
   *  these weekdays — historical Mon sessions still sit in DB and
   *  pollute student portals. */
  async function handleCleanupNonSchoolDays() {
    const confirmed = confirm(
      `删除所有「学校无早测日」(周一、周六、周日) 的 sessions？\n\n` +
        `校历规则:周一全校无早测, 周末更没有。已存在的周一 sessions 是\n` +
        `旧逻辑「Mon-Fri 5 天」遗留的, 学生 portal 上会显示成「周一缺勤」\n` +
        `误导。\n\n` +
        `修完后, 周排程器会自动只生成 周二-周五 共 4 天。\n\n` +
        `不可撤销 (cascade 删除考勤+答卷+答题)。`,
    );
    if (!confirmed) return;
    setError(null);
    try {
      const r = await api.morningQuizCleanupNonSchoolDays();
      alert(
        `清理完成:\n` +
          `  · 扫描非校历日 sessions: ${r.sessionsConsidered}\n` +
          `  · 删除 papers: ${r.papersDeleted}\n` +
          `  · 跳过的星期: ${r.skipDays.join(', ')}\n\n` +
          `attendance / submission / answer scripts 通过 FK cascade 同步删除。`,
      );
      await refresh();
    } catch (e: any) {
      setError(e.message ?? String(e));
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
          <button
            type="button"
            onClick={handleCleanupRetired}
            className="text-sm px-2 py-1 rounded text-rose-700 hover:bg-rose-50"
            title="一次性清掉所有 cambridge_0510 (已退役内容) 的 Paper/Session/考勤/答卷, 用于消除学生 portal 上的旧测试残留"
          >
            🧹 清理旧测试数据
          </button>
          <button
            type="button"
            onClick={handleCleanupNonSchoolDays}
            className="text-sm px-2 py-1 rounded text-rose-700 hover:bg-rose-50"
            title="清掉所有周一/周末的 sessions (校历无早测日), 学生 portal 不再误显示周一缺勤"
          >
            🗓️ 清掉周一 sessions
          </button>
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
          Tue-Fri {addDays(weekStart, 1)} ~ {addDays(weekStart, 4)} (周一无早测, 跳过)
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
            {classes.map((c) => {
              const levels: Level[] = (c.englishLevels ?? []).map((e) => e.level);
              return (
              <tr key={c.id} className="border-b last:border-0">
                <td className="py-2">
                  <input
                    type="checkbox"
                    checked={selected.has(c.id)}
                    onChange={() => toggle(c.id)}
                    disabled={levels.length === 0}
                    title={levels.length > 0 ? '' : '请先添加至少一个等级'}
                  />
                </td>
                <td>
                  <span className="font-medium">{c.name}</span>
                  <span className="text-gray-400 ml-2 font-mono">{c.classCode}</span>
                </td>
                {/* R10 multi-level: render one chip per registered band.
                    Click chip × to remove. Empty = "未配置". */}
                <td>
                  <div className="flex flex-wrap gap-1.5">
                    {levels.length === 0 && (
                      <span className="text-gray-400 italic text-xs">未配置</span>
                    )}
                    {levels.map((l) => {
                      const stat = bankStats[c.id]?.[l];
                      // Color the chip by health: ≥4 remaining = blue (normal),
                      // 1-3 remaining = amber (warning), 0 = red (will recycle).
                      const tone = !stat
                        ? 'bg-blue-50 border-blue-200 text-blue-800'
                        : stat.remaining === 0
                          ? 'bg-rose-50 border-rose-300 text-rose-800'
                          : stat.remaining <= 3
                            ? 'bg-amber-50 border-amber-300 text-amber-800'
                            : 'bg-blue-50 border-blue-200 text-blue-800';
                      const closeBtnTone = !stat
                        ? 'text-blue-600 hover:text-rose-700'
                        : stat.remaining === 0
                          ? 'text-rose-600 hover:text-rose-900'
                          : stat.remaining <= 3
                            ? 'text-amber-700 hover:text-rose-700'
                            : 'text-blue-600 hover:text-rose-700';
                      return (
                        <span
                          key={l}
                          className={`inline-flex items-center gap-1 border px-2 py-0.5 rounded text-xs ${tone}`}
                          title={
                            stat
                              ? `题库总数 ${stat.totalBank} · 本班累计已用 ${stat.usedRecent} · 剩 ${stat.remaining}${stat.depleted ? ' (题库耗尽, 下次会重复最久未出的)' : ''}`
                              : ''
                          }
                        >
                          {LEVEL_LABEL[l]}
                          {stat && (
                            <span className="opacity-70 font-mono">
                              · 剩 {stat.remaining}/{stat.totalBank}
                              {stat.depleted && ' ⚠'}
                            </span>
                          )}
                          <button
                            type="button"
                            onClick={() => handleRemoveLevel(c.id, l)}
                            className={`leading-none ${closeBtnTone}`}
                            title="移除该等级"
                          >
                            ×
                          </button>
                        </span>
                      );
                    })}
                  </div>
                </td>
                <td className="py-2">
                  <select
                    value=""
                    onChange={(e) => {
                      const v = e.target.value as Level;
                      if (v) handleSetLevel(c.id, v);
                    }}
                    className="border rounded px-2 py-1 text-sm"
                  >
                    <option value="">+ 添加等级</option>
                    {(['ielts_authentic', 'ielts_simplified', 'olevel'] as Level[])
                      .filter((l) => !levels.includes(l))
                      .map((l) => (
                        <option key={l} value={l}>
                          {LEVEL_LABEL[l]}
                        </option>
                      ))}
                  </select>
                </td>
              </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <div className="bg-white border rounded-lg p-5 mb-6">
        <h2 className="font-semibold mb-3">3. 一键生成下周早测</h2>
        <div className="flex items-center gap-4 flex-wrap">
          <button
            onClick={() => handleGenerate()}
            disabled={busy || selected.size === 0}
            className="px-5 py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-300 text-white rounded font-medium"
          >
            {busy
              ? '生成中…(每张约 1-2 分钟)'
              : (() => {
                  const totalLevels = classes
                    .filter((c) => selected.has(c.id))
                    .reduce((s, c) => s + (c.englishLevels?.length ?? 0), 0);
                  return `生成 ${selected.size} 个班 × ${totalLevels} 等级 × 4 天(Tue-Fri) = ${totalLevels * 4} 张`;
                })()}
          </button>
          <button
            onClick={() => handleGenerate({ force: true })}
            disabled={busy || selected.size === 0}
            className="px-5 py-2 bg-red-600 hover:bg-red-700 disabled:bg-gray-300 text-white rounded font-medium"
            title="先删本周已有卷子（含学生答卷），再按当前题库重新抽。新题库 ingest 后用这个。"
          >
            强制重新生成本周
          </button>
          <span className="text-sm text-gray-500">
            每个等级一张 QR;雅思真题走 passage_pick,其他走 AI 生成
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
          // R10 multi-level UX fix: collapse rows by (date, classId) so
          // the teacher sees ONE QR per (day, class) regardless of how
          // many difficulty bands are running. The student-side picker
          // fans out to siblings; the teacher should only think in
          // terms of "which class on which day", not per-band QRs.
          <table className="w-full text-sm">
            <thead className="text-left text-gray-500 border-b">
              <tr>
                <th className="py-2">日期</th>
                <th>班级</th>
                <th>状态</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {(() => {
                // Group sessions by (date.slice(0,10), classId). The level
                // breakdown is hidden from the table — students pick their
                // band on the scan page anyway, so the teacher just needs
                // "which class on which day, and is it ready?".
                const groups = new Map<string, typeof scheduled>();
                for (const s of scheduled) {
                  const key = `${s.date.slice(0, 10)}::${s.class.id}`;
                  if (!groups.has(key)) groups.set(key, []);
                  groups.get(key)!.push(s);
                }
                return Array.from(groups.entries()).map(([key, group]) => {
                  // Pick the "primary" session for action buttons —
                  // any active one, else the first in the group.
                  const primary =
                    group.find((s) => s.status === 'active') ?? group[0];
                  const allStatuses = Array.from(new Set(group.map((g) => g.status)));
                  const aggregateStatus =
                    allStatuses.length === 1 ? allStatuses[0] : `${allStatuses.length} 状态`;
                  // Stash level names in the row's title so they're still
                  // discoverable on hover without taking real estate.
                  const levelsTitle = group
                    .map((s) => (s.level ? LEVEL_LABEL[s.level] : '—'))
                    .join(' · ');
                  return (
                    <tr key={key} className="border-b last:border-0 align-top" title={levelsTitle}>
                      <td className="py-2 font-mono">{primary.date.slice(0, 10)}</td>
                      <td>{primary.class.name}</td>
                      <td>
                        <span className="badge text-xs px-2 py-0.5 rounded bg-gray-100">
                          {aggregateStatus}
                        </span>
                      </td>
                      <td className="text-right whitespace-nowrap">
                        <button
                          onClick={() => openDisplay(primary.id)}
                          className="text-xs px-2 py-1 rounded bg-blue-50 hover:bg-blue-100 text-blue-700 mr-1"
                          title="一个 QR 给本班所有等级共用,学生扫码后自己选难度"
                        >
                          🖥️ 大屏 QR
                        </button>
                        <button
                          onClick={() => openDisplayOvernight(primary.class.id)}
                          className="text-xs px-2 py-1 rounded bg-indigo-50 hover:bg-indigo-100 text-indigo-700 mr-1"
                          title="开了就走 · 自动跟随班级当日 / 次日的 session。前一晚打开, 第二天 8:30 二维码自动激活"
                        >
                          🌙 留到明早
                        </button>
                        <button
                          onClick={async () => {
                            // Activate every band in the group; the
                            // backend is idempotent on already-active
                            // sessions (just refreshes the window).
                            for (const s of group) await handleDebugActivate(s.id);
                          }}
                          className="text-xs px-2 py-1 rounded bg-amber-50 hover:bg-amber-100 text-amber-700 mr-1"
                          title="DEV ONLY: 一键激活本班所有等级的 session(测试用,生产 MORNING_QUIZ_DEBUG=true 才可用)"
                        >
                          ⚡ 立即激活{group.length > 1 ? ` (${group.length})` : ''}
                        </button>
                        <button
                          onClick={async () => {
                            // Revert every band in the group back to
                            // scheduled with canonical 08:30 windows.
                            // Used after a dry-run to restore tomorrow's
                            // sessions so the real cron-activation flow
                            // takes over normally.
                            const confirmed = confirm(
                              `撤销激活本班 ${group.length} 个 level 的 session？\n\n` +
                                `会把状态从 active 改回 scheduled, 时间窗口重算回 08:30 / 09:00。\n` +
                                `不会删除考勤或答卷记录(那些用 dashboard 里的 🗑️ 按钮单独清)。`,
                            );
                            if (!confirmed) return;
                            for (const s of group) await handleRevertSession(s.id);
                          }}
                          className="text-xs px-2 py-1 rounded bg-stone-50 hover:bg-stone-100 text-stone-700 mr-1"
                          title="DEV ONLY: 撤销本班所有等级的「立即激活」(把时间窗口和状态改回 scheduled, 不删数据)"
                        >
                          ↩️ 撤销激活{group.length > 1 ? ` (${group.length})` : ''}
                        </button>
                        {/* One aggregated dashboard link per (class,
                            date). The dashboard merges all 1–3 level
                            sessions into a single roster — safe to
                            collapse because a student picks exactly
                            ONE level on the scan page, so a student
                            appears in at most one of the day's
                            sessions. Each row in the merged table
                            still carries its source sessionId + level,
                            so the per-student delete still targets
                            the right session. */}
                        <Link
                          to={`/morning-quiz/classes/${primary.class.id}/date/${primary.date.slice(0, 10)}/dashboard`}
                          className="text-blue-600 hover:underline text-xs ml-1"
                          title="进入本班当日合并考勤+答卷面板(含「清除测试数据」按钮)"
                        >
                          考勤 →
                        </Link>
                      </td>
                    </tr>
                  );
                });
              })()}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}

/** Monday of the calendar week containing today (Sun→prev Mon, Mon→same day). */
function currentMondayIso(): string {
  const d = new Date();
  const dow = d.getDay(); // Sun=0, Mon=1
  const daysSinceMon = dow === 0 ? 6 : dow - 1;
  d.setDate(d.getDate() - daysSinceMon);
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
