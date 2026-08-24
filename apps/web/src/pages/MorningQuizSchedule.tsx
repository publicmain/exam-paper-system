import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../lib/api';

type Level =
  | 'ielts_authentic'
  | 'ielts_light'
  | 'olevel'
  | 'olevel_intermediate'
  | 'ielts_simplified';
// R10 — three ascending difficulty bands. ielts_simplified replaces the
// misnamed ielts_hard: it is the MIDDLE band (easier than authentic IELTS,
// harder than O-Level), targeting strong O-Level students stretching toward
// IELTS while keeping vocabulary in their reach.
const LEVEL_LABEL: Record<Level, string> = {
  ielts_authentic: '雅思真题 · IELTS Authentic',
  ielts_light: '雅思轻量 · IELTS Light',
  olevel_intermediate: 'O-Level 进阶 · Intermediate',
  ielts_simplified: 'O-Level 基础 · O-Level Basic',
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
  // ROUND 14 — Feature 9: one-off session creation modal toggle.
  const [creatingOneOff, setCreatingOneOff] = useState(false);
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
      // Bug 2 — fetch concrete delete counts BEFORE the confirm so the
      // operator sees what they're about to nuke. Without this, the
      // generic warning let people accidentally wipe today's real
      // morning quiz (19 student submissions, ~250 answer scripts).
      let impactText = '';
      try {
        const impact = await api.morningQuizBatchGenerateImpact({
          weekStart,
          classIds: Array.from(selected),
        });
        impactText =
          `\n\n本周将被删除的数据:\n` +
          `  · ${impact.sessions} 个 sessions\n` +
          `  · ${impact.attendances} 条考勤\n` +
          `  · ${impact.submissions} 份学生提交\n` +
          `  · ${impact.answerScripts} 条答题记录\n`;
      } catch {
        impactText = '\n\n(无法预读删除数量, 请谨慎确认)';
      }
      const confirmed = confirm(
        `⚠️ 强制重新生成 ${weekStart} 这周 ${selected.size} 个班级的所有早测卷？\n` +
          impactText +
          `\n不可撤销。仅在新题库刚 ingest 完想立刻让本周生效, 且接受清空已交卷数据时使用。`,
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
  async function handleDebugActivate(sessionId: string, opts: { sessionStatus?: string; alreadyConfirmed?: boolean } = {}) {
    setError(null);
    // Strong warning when activating an ALREADY-LOCKED session (i.e.
    // the morning quiz already ran today). Re-activating it will:
    //   - overwrite the canonical 08:30 timestamps to "now"-based values
    //   - re-open scan window → students could scan again and overwrite
    //     today's real attendance/submission rows
    // Block this with an extra confirm so test clicks don't nuke real data.
    if (opts.sessionStatus === 'locked' && !opts.alreadyConfirmed) {
      const confirmed = confirm(
        `⚠️ 这场 session 已经 locked (今早 quiz 已结束)\n\n` +
          `再次「立即激活」会:\n` +
          `  · 把时间窗口改成「现在」(覆盖原 08:30 的 attendanceStart)\n` +
          `  · 把 status 改回 active, 学生可以重新扫码 → 覆盖今早真实数据\n` +
          `  · 今早学生的考勤+答卷会被新一轮扫码覆盖\n\n` +
          `确定要继续? (一般只在测试环境点)`,
      );
      if (!confirmed) return;
    }
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

  /** 「立即激活」整组（本班当日所有等级）。locked 场次要二次确认 ——
   *  重新激活会覆盖今早真实数据（Bug 8 的强警告路径）。 */
  async function activateGroup(group: ScheduledSession[]) {
    const anyLocked = group.some((s) => s.status === 'locked');
    if (anyLocked) {
      const ok = confirm(
        `⚠️ 本班 ${group.length} 场 session 中至少有 1 场已 locked.

` +
          `再次「立即激活」会**覆盖今早真实数据**(timestamps + status), ` +
          `学生可重新扫码污染原成绩。

` +
          `测试 / 演示场景才点。生产请用「撤销激活」恢复 08:30 窗口。

` +
          `确认要全部激活?`,
      );
      if (!ok) return;
      for (const s of group) {
        await handleDebugActivate(s.id, { sessionStatus: s.status, alreadyConfirmed: true });
      }
    } else {
      for (const s of group) {
        await handleDebugActivate(s.id, { sessionStatus: s.status });
      }
    }
  }

  /** 撤销整组激活 —— 状态改回 scheduled，窗口重算回 08:30/09:00。 */
  async function revertGroup(group: ScheduledSession[]) {
    const confirmed = confirm(
      `撤销激活本班 ${group.length} 个 level 的 session？

` +
        `会把状态从 active 改回 scheduled, 时间窗口重算回 08:30 / 09:00。
` +
        `不会删除考勤或答卷记录(那些用 dashboard 里的 🗑️ 按钮单独清)。`,
    );
    if (!confirmed) return;
    for (const s of group) await handleRevertSession(s.id);
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
      {/* 2026-08-14 重构 —— 排课/生成/清理由 Claude 在会话里代办，
          页面职责变成「老师看今天和本周的状态」：
            ① 今天 —— 场次状态 + 考勤汇总 + 待判数 + 补考窗（主视觉）
            ② 本周 —— 排课一览，操作按钮全部收进每行的 ⋯ 菜单
            ③ 排课与配置 —— 原 1/2/3 节整体折叠，默认收起
          头部只留一个 ⋯ 更多（一次性场次/导出/审核/历史/维护）。 */}
      <div className="flex items-center justify-between mb-4">
        <h1 className="text-2xl font-bold">早测 · Morning Quiz</h1>
        <MoreMenu
          weekStart={weekStart}
          onCreateOneOff={() => setCreatingOneOff(true)}
          onCleanupRetired={handleCleanupRetired}
          onCleanupNonSchoolDays={handleCleanupNonSchoolDays}
        />
      </div>

      {error && (
        <div className="mb-4 px-4 py-3 bg-rose-50 border border-rose-200 text-rose-700 rounded">
          {error}
        </div>
      )}

      <TodayCard classes={classes} scheduled={scheduled} />

      <WeekTable
        scheduled={scheduled}
        onOpenDisplay={openDisplay}
        onOpenOvernight={openDisplayOvernight}
        onActivateGroup={activateGroup}
        onRevertGroup={revertGroup}
        onRefresh={refresh}
      />

      <details className="bg-white border rounded-lg mb-6 group">
        <summary className="cursor-pointer select-none px-5 py-3.5 font-semibold text-gray-700 hover:bg-gray-50 rounded-lg flex items-center gap-2">
          <span className="text-gray-400 transition-transform group-open:rotate-90">▸</span>
          排课与配置
          <span className="text-xs font-normal text-gray-400 ml-1">
            选周 · 班级等级 · 生成下周（周常操作，平时由 Claude 代办）
          </span>
        </summary>
        <div className="px-5 pb-5 pt-2 space-y-6 border-t">

      <div>
        <h2 className="font-semibold mb-3 mt-3">1. 选目标周(周一日期)</h2>
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

      <div>
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
                  <a
                    href={`/qr-print?classId=${encodeURIComponent(c.id)}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-xs text-indigo-600 hover:underline ml-2"
                    title="打开可打印的永久二维码 — 打印后贴墙，每天直接扫，无需开电脑"
                  >
                    🖨 墙贴 QR
                  </a>
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
                    {/* ielts_simplified：2026-07-24 曾以「轻雅思」停用；2026-08-14
                        按校方新政以「O-Level 基础」重新上架（枚举值不变，内容走
                        ai_authored_olevel_1128_simplified 库）。题库备足 5 篇并过
                        审计之前，先别给真实班级加这个等级。 */}
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

      <div>
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
        <div>
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

        </div>
      </details>

      {creatingOneOff && (
        <OneOffSessionModal
          classes={classes}
          onClose={() => setCreatingOneOff(false)}
          onCreated={async () => {
            setCreatingOneOff(false);
            await refresh();
          }}
        />
      )}
    </div>
  );
}

/** ROUND 14 — Feature 9: one-off session creator. Picks (class, date,
 *  level, optional paperId) and calls createMorningQuizSession. Used
 *  for补测 / 特殊场次 outside the weekly batch flow. */
function OneOffSessionModal({
  classes,
  onClose,
  onCreated,
}: {
  classes: ClassRow[];
  onClose: () => void;
  onCreated: () => void;
}) {
  const [classId, setClassId] = useState('');
  const [date, setDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [level, setLevel] = useState<Level>('ielts_authentic');
  const [paperId, setPaperId] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose();
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  async function handleCreate() {
    if (!classId) {
      setErr('请选择班级');
      return;
    }
    if (!date) {
      setErr('请选择日期');
      return;
    }
    const dow = new Date(date + 'T00:00:00Z').getUTCDay();
    if (dow === 0 || dow === 6) {
      setErr('周六周日不排早测 · No morning quiz on weekends');
      return;
    }
    setBusy(true);
    setErr(null);
    try {
      await api.createMorningQuizSession({
        classId,
        date,
        level,
        paperId: paperId.trim() || undefined,
      });
      onCreated();
    } catch (e: any) {
      setErr(String(e?.message ?? e));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div
      className="fixed inset-0 bg-black/40 flex items-center justify-center z-50"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
    >
      <div
        className="bg-white rounded-lg shadow-xl p-5 max-w-md w-full space-y-3"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between">
          <h3 className="font-bold text-lg">+ 一次性 session</h3>
          <button className="text-xl text-gray-500 hover:text-gray-700" onClick={onClose}>
            ×
          </button>
        </div>

        <label className="block text-sm">
          <span className="text-xs text-gray-500">班级</span>
          <select
            value={classId}
            onChange={(e) => setClassId(e.target.value)}
            className="border rounded px-2 py-1 w-full mt-1"
          >
            <option value="">— 选择班级 —</option>
            {classes.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name} ({c.classCode})
              </option>
            ))}
          </select>
        </label>

        <label className="block text-sm">
          <span className="text-xs text-gray-500">日期</span>
          <input
            type="date"
            value={date}
            onChange={(e) => setDate(e.target.value)}
            className="border rounded px-2 py-1 w-full mt-1"
          />
        </label>

        <label className="block text-sm">
          <span className="text-xs text-gray-500">难度等级</span>
          <select
            value={level}
            onChange={(e) => setLevel(e.target.value as Level)}
            className="border rounded px-2 py-1 w-full mt-1"
          >
            <option value="ielts_authentic">{LEVEL_LABEL.ielts_authentic}</option>
            {/* 2026-08-14 重新上架为「O-Level 基础」 */}
            <option value="ielts_simplified">{LEVEL_LABEL.ielts_simplified}</option>
            <option value="olevel">{LEVEL_LABEL.olevel}</option>
          </select>
        </label>

        <label className="block text-sm">
          <span className="text-xs text-gray-500">
            paperId (可选 — 留空则用现有题库自动生成)
          </span>
          <input
            type="text"
            value={paperId}
            onChange={(e) => setPaperId(e.target.value)}
            className="border rounded px-2 py-1 w-full mt-1 font-mono text-xs"
            placeholder="paper UUID"
          />
        </label>

        {err && <div className="text-sm text-rose-700">{err}</div>}

        <div className="flex justify-end gap-2 pt-2">
          <button className="btn" onClick={onClose} disabled={busy}>
            取消
          </button>
          <button className="btn btn-primary" onClick={handleCreate} disabled={busy}>
            {busy ? '创建中…' : '创建 session'}
          </button>
        </div>
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

/* ────────────────────────────────────────────────────────────────────
 * 2026-08-14 重构新增的四个组件。
 * 页面职责：老师看「今天怎么样、要做什么」；操作全部收进菜单。
 * ──────────────────────────────────────────────────────────────────── */

/** 新加坡今天（YYYY-MM-DD）。挂钟约定与后端一致。 */
function sgtTodayIso(): string {
  return new Date(Date.now() + 8 * 3600_000).toISOString().slice(0, 10);
}

const STATUS_ZH: Record<string, { label: string; cls: string }> = {
  scheduled: { label: '未开始', cls: 'bg-gray-100 text-gray-600' },
  active: { label: '进行中', cls: 'bg-emerald-100 text-emerald-800' },
  locked: { label: '已收卷', cls: 'bg-blue-100 text-blue-800' },
  cancelled: { label: '已取消', cls: 'bg-rose-100 text-rose-700' },
};
function StatusBadge({ status }: { status: string }) {
  const s = STATUS_ZH[status] ?? { label: status, cls: 'bg-gray-100 text-gray-600' };
  return <span className={`text-xs px-2 py-0.5 rounded ${s.cls}`}>{s.label}</span>;
}

/** 自动补考场生效日（与 morning-quiz.cron.ts 的 AUTO_MAKEUP_EFFECTIVE_FROM 一致）。 */
const AUTO_MAKEUP_FROM = '2026-08-18';

/**
 * ① 今天卡 —— 页面主视觉。
 *
 * 回答三个问题：今天的场次怎么样了（状态/考勤）、有多少份等判、
 * 下午补考窗会不会开。数据三路：本周 scheduled 里过滤出今天 +
 * 每班一次 class-day dashboard（考勤计数与补考窗）+ marker 队列
 * 总数。任何一路失败只影响自己那块，绝不整卡报错。
 */
function TodayCard({ classes, scheduled }: { classes: ClassRow[]; scheduled: ScheduledSession[] }) {
  const todayIso = sgtTodayIso();
  const weekdayZh = '日一二三四五六'[new Date(`${todayIso}T00:00:00Z`).getUTCDay()];
  const todays = scheduled.filter((s) => s.date.slice(0, 10) === todayIso && s.status !== 'cancelled');
  const byClass = new Map<string, ScheduledSession[]>();
  for (const s of todays) {
    if (!byClass.has(s.class.id)) byClass.set(s.class.id, []);
    byClass.get(s.class.id)!.push(s);
  }
  const classIdsKey = Array.from(byClass.keys()).sort().join(',');

  const [dash, setDash] = useState<Record<string, {
    counts: { on_time: number; late: number; absent: number; makeup: number };
    sessions: Array<{ id: string; level: Level; status: string; makeupOpen: boolean }>;
  }>>({});
  const [pendingMarks, setPendingMarks] = useState<number | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const next: Record<string, any> = {};
      await Promise.all(
        classIdsKey.split(',').filter(Boolean).map(async (cid) => {
          try {
            next[cid] = await api.morningQuizClassDayDashboard(cid, todayIso);
          } catch { /* 单班失败只缺那一块 */ }
        }),
      );
      if (!cancelled) setDash(next);
      try {
        const q = await api.markerQueue({ page: 1, pageSize: 1 });
        if (!cancelled) setPendingMarks(typeof q?.total === 'number' ? q.total : null);
      } catch { if (!cancelled) setPendingMarks(null); }
    })();
    return () => { cancelled = true; };
  }, [classIdsKey, todayIso]);

  return (
    <div className="bg-white border rounded-lg p-5 mb-6">
      <div className="flex items-center justify-between flex-wrap gap-2 mb-3">
        <h2 className="font-semibold text-lg">
          今天 <span className="font-mono text-gray-500 text-base">{todayIso}</span>
          <span className="text-gray-500 text-base"> · 周{weekdayZh}</span>
        </h2>
        {pendingMarks != null && (
          <span
            className={`text-sm px-3 py-1 rounded-full border ${
              pendingMarks > 0
                ? 'bg-amber-50 border-amber-300 text-amber-800'
                : 'bg-emerald-50 border-emerald-200 text-emerald-700'
            }`}
            title="人工判分队列 —— 在会话里对 Claude 说「判分」即可排空"
          >
            {pendingMarks > 0 ? `📝 待判 ${pendingMarks} 份 · 找 Claude 判分` : '✓ 判分已清空'}
          </span>
        )}
      </div>

      {byClass.size === 0 ? (
        <div className="text-sm text-gray-500 py-4">
          今天没有早测场次{new Date(`${todayIso}T00:00:00Z`).getUTCDay() === 1 ? '（周一无早测）' : ''}。
        </div>
      ) : (
        <div className="space-y-4">
          {Array.from(byClass.entries()).map(([cid, group]) => {
            const cls = classes.find((c) => c.id === cid);
            const d = dash[cid];
            const counts = d?.counts;
            const makeupOpen = d?.sessions?.some((x) => x.makeupOpen) ?? false;
            const absentPending = counts ? counts.absent - counts.makeup : null;
            const allLocked = group.every((s) => s.status === 'locked');
            let makeupLine: string;
            if (makeupOpen) {
              makeupLine = '🟢 补考窗开着（16:30–17:00），缺席学生扫墙贴码即可补考';
            } else if (todayIso < AUTO_MAKEUP_FROM) {
              makeupLine = `自动补考场 ${AUTO_MAKEUP_FROM.slice(5)}（周二）起生效，今天不开`;
            } else if (!allLocked) {
              makeupLine = '正式场结束后，16:30 视缺席情况自动开补考窗';
            } else if (absentPending == null) {
              makeupLine = '16:30–17:00 视缺席情况自动开补考窗';
            } else if (absentPending > 0) {
              makeupLine = `16:30 将自动开补考窗 —— ${absentPending} 人缺席待补`;
            } else {
              makeupLine = '无人待补考，今天不开补考窗';
            }
            return (
              <div key={cid} className="border rounded-lg p-4 bg-gray-50/60">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="font-semibold">{cls?.name ?? group[0].class.name}</span>
                  {group.map((s) => (
                    <span key={s.id} className="inline-flex items-center gap-1.5 text-xs bg-white border rounded px-2 py-0.5">
                      {LEVEL_LABEL[s.level]?.split(' · ')[0] ?? s.level}
                      <StatusBadge status={s.status} />
                    </span>
                  ))}
                </div>
                <div className="mt-2.5 flex items-center gap-x-5 gap-y-1 flex-wrap text-sm">
                  {counts ? (
                    <span className="font-mono">
                      <span className="text-emerald-700">到 {counts.on_time}</span>
                      <span className="text-amber-700 ml-3">迟 {counts.late}</span>
                      <span className="text-rose-700 ml-3">缺 {counts.absent}</span>
                      {counts.makeup > 0 && <span className="text-blue-700 ml-3">已补考 {counts.makeup}</span>}
                    </span>
                  ) : (
                    <span className="text-gray-400 text-xs">考勤加载中…</span>
                  )}
                  <span className="text-xs text-gray-600">{makeupLine}</span>
                </div>
                <div className="mt-2.5 flex gap-4 text-sm">
                  <Link
                    to={`/morning-quiz/classes/${cid}/date/${todayIso}/dashboard`}
                    className="text-blue-600 hover:underline"
                  >
                    考勤明细 →
                  </Link>
                  <Link to={`/morning-quiz/classes/${cid}/skills`} className="text-blue-600 hover:underline">
                    技能诊断 →
                  </Link>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

/**
 * ② 本周表 —— 原「本周已排课表」瘦身版。
 * 行 = (日期, 班级)；今天高亮；激活/大屏等操作全部收进行尾 ⋯ 菜单
 * （日常不点它们 —— 贴墙码常驻、激活由 cron 干）。
 */
function WeekTable({
  scheduled,
  onOpenDisplay,
  onOpenOvernight,
  onActivateGroup,
  onRevertGroup,
  onRefresh,
}: {
  scheduled: ScheduledSession[];
  onOpenDisplay: (sessionId: string) => void;
  onOpenOvernight: (classId: string) => void;
  onActivateGroup: (group: ScheduledSession[]) => void;
  onRevertGroup: (group: ScheduledSession[]) => void;
  onRefresh: () => void;
}) {
  const todayIso = sgtTodayIso();
  const groups = new Map<string, ScheduledSession[]>();
  for (const s of scheduled) {
    const key = `${s.date.slice(0, 10)}::${s.class.id}`;
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key)!.push(s);
  }
  return (
    <div className="bg-white border rounded-lg p-5 mb-6">
      <div className="flex items-center justify-between mb-3">
        <h2 className="font-semibold">本周 ({scheduled.length} 场)</h2>
        <button type="button" onClick={onRefresh} className="text-xs text-blue-600 hover:underline">
          ↻ 刷新
        </button>
      </div>
      {groups.size === 0 ? (
        <div className="text-gray-500 text-sm">本周还没有排课</div>
      ) : (
        <table className="w-full text-sm">
          <thead className="text-left text-gray-500 border-b">
            <tr>
              <th className="py-2">日期</th>
              <th>班级</th>
              <th>等级 · 状态</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {Array.from(groups.entries()).map(([key, group]) => {
              const primary = group.find((s) => s.status === 'active') ?? group[0];
              const dateIso = primary.date.slice(0, 10);
              const isToday = dateIso === todayIso;
              return (
                <tr
                  key={key}
                  className={`border-b last:border-0 align-top ${isToday ? 'bg-blue-50/50' : ''}`}
                >
                  <td className="py-2.5 font-mono whitespace-nowrap">
                    {dateIso.slice(5)}
                    {isToday && <span className="ml-1.5 text-[10px] text-blue-700 font-sans font-semibold">今天</span>}
                  </td>
                  <td className="py-2.5">{primary.class.name}</td>
                  <td className="py-2.5">
                    <div className="flex gap-1.5 flex-wrap">
                      {group.map((s) => (
                        <span key={s.id} className="inline-flex items-center gap-1 text-xs">
                          <span className="text-gray-500">{LEVEL_LABEL[s.level]?.split(' · ')[0] ?? s.level}</span>
                          <StatusBadge status={s.status} />
                        </span>
                      ))}
                    </div>
                  </td>
                  <td className="py-2 text-right whitespace-nowrap">
                    <Link
                      to={`/morning-quiz/classes/${primary.class.id}/date/${dateIso}/dashboard`}
                      className="text-blue-600 hover:underline text-xs"
                    >
                      考勤 →
                    </Link>
                    <Link
                      to={`/morning-quiz/classes/${primary.class.id}/skills`}
                      className="text-blue-600 hover:underline text-xs ml-3"
                    >
                      技能诊断 →
                    </Link>
                    <RowActionsMenu
                      group={group}
                      onOpenDisplay={() => onOpenDisplay(primary.id)}
                      onOpenOvernight={() => onOpenOvernight(primary.class.id)}
                      onActivate={() => onActivateGroup(group)}
                      onRevert={() => onRevertGroup(group)}
                    />
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      )}
    </div>
  );
}

/** 行尾 ⋯ 菜单 —— 大屏 QR / 留到明早 / 立即激活 / 撤销激活。
 *  这四个是投影仪时代和测试用的操作，贴墙码 + cron 之后日常不再点。 */
function RowActionsMenu({
  group,
  onOpenDisplay,
  onOpenOvernight,
  onActivate,
  onRevert,
}: {
  group: ScheduledSession[];
  onOpenDisplay: () => void;
  onOpenOvernight: () => void;
  onActivate: () => void;
  onRevert: () => void;
}) {
  const [open, setOpen] = useState(false);
  const wrapRef = useRef<HTMLDivElement | null>(null);
  useEffect(() => {
    if (!open) return;
    function onDocClick(e: MouseEvent) {
      if (!wrapRef.current?.contains(e.target as Node)) setOpen(false);
    }
    function onEsc(e: KeyboardEvent) {
      if (e.key === 'Escape') setOpen(false);
    }
    document.addEventListener('mousedown', onDocClick);
    document.addEventListener('keydown', onEsc);
    return () => {
      document.removeEventListener('mousedown', onDocClick);
      document.removeEventListener('keydown', onEsc);
    };
  }, [open]);
  const n = group.length;
  const item = 'w-full text-left px-3 py-2 hover:bg-gray-50';
  return (
    <div className="relative inline-block ml-2" ref={wrapRef}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        aria-haspopup="menu"
        className="text-xs px-2 py-1 rounded text-gray-500 hover:bg-gray-100 border border-transparent hover:border-gray-200"
        title="投影 / 激活等不常用操作"
      >
        ⋯
      </button>
      {open && (
        <div role="menu" className="absolute right-0 mt-1 w-56 bg-white border border-gray-200 rounded-md shadow-lg z-30 py-1 text-sm text-left">
          <button type="button" role="menuitem" className={item} onClick={() => { setOpen(false); onOpenDisplay(); }}>
            🖥️ 大屏 QR
            <div className="text-xs text-gray-500">投影仪展示轮转码（贴墙码时代很少用）</div>
          </button>
          <button type="button" role="menuitem" className={item} onClick={() => { setOpen(false); onOpenOvernight(); }}>
            🌙 留到明早
            <div className="text-xs text-gray-500">投影页自动跟随当日/次日场次</div>
          </button>
          <div className="border-t my-1" />
          <button type="button" role="menuitem" className={`${item} text-amber-700`} onClick={() => { setOpen(false); onActivate(); }}>
            ⚡ 立即激活{n > 1 ? ` (${n})` : ''}
            <div className="text-xs text-gray-500">DEV：测试用，locked 场次会二次确认</div>
          </button>
          <button type="button" role="menuitem" className={`${item} text-stone-700`} onClick={() => { setOpen(false); onRevert(); }}>
            ↩️ 撤销激活{n > 1 ? ` (${n})` : ''}
            <div className="text-xs text-gray-500">恢复 08:30 窗口与 scheduled 状态</div>
          </button>
        </div>
      )}
    </div>
  );
}

/** 头部唯一的菜单 —— 一次性场次 / 导出 / 审核 / 历史 / 一次性维护。 */
function MoreMenu({
  weekStart,
  onCreateOneOff,
  onCleanupRetired,
  onCleanupNonSchoolDays,
}: {
  weekStart: string;
  onCreateOneOff: () => void;
  onCleanupRetired: () => void;
  onCleanupNonSchoolDays: () => void;
}) {
  const [open, setOpen] = useState(false);
  const [exporting, setExporting] = useState(false);
  const wrapRef = useRef<HTMLDivElement | null>(null);
  useEffect(() => {
    if (!open) return;
    function onDocClick(e: MouseEvent) {
      if (!wrapRef.current?.contains(e.target as Node)) setOpen(false);
    }
    function onEsc(e: KeyboardEvent) {
      if (e.key === 'Escape') setOpen(false);
    }
    document.addEventListener('mousedown', onDocClick);
    document.addEventListener('keydown', onEsc);
    return () => {
      document.removeEventListener('mousedown', onDocClick);
      document.removeEventListener('keydown', onEsc);
    };
  }, [open]);

  /** 原 ExportAttendanceButton 的 Blob 下载逻辑，原样搬进菜单项。 */
  async function exportWeek() {
    if (exporting) return;
    setExporting(true);
    const from = weekStart;
    const to = addDays(weekStart, 4);
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
      setExporting(false);
    }
  }

  const item = 'w-full text-left px-3 py-2 hover:bg-gray-50';
  return (
    <div className="relative" ref={wrapRef}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        aria-haspopup="menu"
        className="text-sm px-3 py-1.5 rounded-md border border-gray-200 text-gray-600 hover:bg-gray-100"
      >
        ⋯ 更多
      </button>
      {open && (
        <div role="menu" className="absolute right-0 mt-1 w-64 bg-white border border-gray-200 rounded-md shadow-lg z-30 py-1 text-sm">
          <button type="button" role="menuitem" className={`${item} text-emerald-700`} onClick={() => { setOpen(false); onCreateOneOff(); }}>
            + 一次性 session
            <div className="text-xs text-gray-500">补测 / 特殊场次，不进周排程</div>
          </button>
          <button type="button" role="menuitem" className={item} onClick={() => { setOpen(false); exportWeek(); }} disabled={exporting}>
            📥 {exporting ? '导出中…' : '导出本周 Excel'}
            <div className="text-xs text-gray-500">考勤 + 成绩 + 缺勤汇总</div>
          </button>
          <Link to="/morning-quiz/qa-review" role="menuitem" className={`block ${item} text-amber-700`} onClick={() => setOpen(false)}>
            🤖 AI 审核待复核 →
          </Link>
          <Link to="/admin/attendance" role="menuitem" className={`block ${item}`} onClick={() => setOpen(false)}>
            🗂 历史考勤 →
            <div className="text-xs text-gray-500">按日期范围跨场次查询</div>
          </Link>
          <div className="border-t my-1" />
          <button type="button" role="menuitem" className={`${item} text-rose-700`} onClick={() => { setOpen(false); onCleanupRetired(); }}>
            🧹 清理旧测试数据
            <div className="text-xs text-gray-500">删退役内容残留（一次性）</div>
          </button>
          <button type="button" role="menuitem" className={`${item} text-rose-700`} onClick={() => { setOpen(false); onCleanupNonSchoolDays(); }}>
            🗓️ 清掉周一 sessions
            <div className="text-xs text-gray-500">删非上学日误排（一次性）</div>
          </button>
        </div>
      )}
    </div>
  );
}
