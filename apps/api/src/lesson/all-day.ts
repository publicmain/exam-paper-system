/**
 * 全天开放开关（4.0 阶段 B，PRD §5.1 / §7）。
 *
 * ## 为什么是开关而不是直接改
 *
 * 时间窗字段有 74 处引用、cron 四个职责互相咬合，一次全改的爆炸半径
 * 覆盖「学生能不能答题」这条最关键路径。而且 PRD 自己定的 B 阶段前置是
 * **A 跑满两个完整教学周**（单班 35 人一周只有 5 个数据点，一个人请假
 * 就能推动 3 个百分点，「一周无下滑」测不出任何东西）。
 *
 * 所以机制先建好、默认关着：
 *   · 全局关 → 现状（08:30–09:00 + 16:00–17:30），零行为变化
 *   · `MORNING_QUIZ_ALL_DAY=on` → 全班全天
 *   · `MORNING_QUIZ_ALL_DAY=<classId>,<classId>` → **按班灰度**
 *
 * 回滚是改一个环境变量，不用重新部署代码。
 */

const RAW = () => (process.env.MORNING_QUIZ_ALL_DAY ?? '').trim();

/** 这个班今天是不是全天开放。 */
export function allDayEnabled(classId?: string | null): boolean {
  const raw = RAW();
  if (!raw) return false;
  const lower = raw.toLowerCase();
  if (lower === 'on' || lower === 'true' || lower === 'all' || lower === '1') return true;
  if (lower === 'off' || lower === 'false' || lower === '0') return false;
  if (!classId) return false;
  return raw
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean)
    .includes(classId);
}

/**
 * P9.5 —— 全天模式下，`now` 还在这一场的那一天里吗。
 *
 * 全天 = **那一场的日历日整天**（SGT 00:00–23:59），不是「永远开着」。
 * 昨天的场次今天照样是关的，否则一份卷子会被无限期地续答下去。
 *
 * `sessionDate` 是场次的日期列（UTC 午夜存的 SGT 日历日）。
 */
export function withinAllDay(
  sessionDate: Date,
  now: Date,
  tzOffsetMin = Number(process.env.MORNING_QUIZ_TZ_OFFSET_MIN ?? 8 * 60),
): boolean {
  const dayKey = (d: Date) =>
    new Date(d.getTime() + tzOffsetMin * 60_000).toISOString().slice(0, 10);
  // 场次的 date 列本身就是日历日（UTC 午夜），直接取它的 ISO 日期；
  // now 要先折算到 SGT 再取。
  return sessionDate.toISOString().slice(0, 10) === dayKey(now);
}

/** 有没有开（任何形式）—— cron 用它决定要不要跳过第二窗自动开窗。 */
export function allDayConfigured(): boolean {
  const raw = RAW().toLowerCase();
  return raw !== '' && raw !== 'off' && raw !== 'false' && raw !== '0';
}

/**
 * P9.5 —— 当前**最终生效**的全天配置，一句话说清。
 *
 * 启动日志和 `GET /api/health` 都读它，两处必须是同一个来源 ——
 * 「我以为开了」和「它真的开了」之间的距离，是这类开关最常见的事故。
 * 原始值一并回显（`raw`），因为 `MORNING_QUIZ_ALL_DAY=ture` 这种
 * 拼写错误会静默地退回旧行为。
 */
export function allDayConfigSummary(): {
  mode: 'off' | 'all' | 'per-class';
  raw: string;
  classIds: string[];
} {
  const raw = RAW();
  const lower = raw.toLowerCase();
  if (!raw || lower === 'off' || lower === 'false' || lower === '0') {
    return { mode: 'off', raw, classIds: [] };
  }
  if (lower === 'on' || lower === 'true' || lower === 'all' || lower === '1') {
    return { mode: 'all', raw, classIds: [] };
  }
  return {
    mode: 'per-class',
    raw,
    classIds: raw.split(',').map((x) => x.trim()).filter(Boolean),
  };
}

/** 全天模式下的窗口时刻。**答题窗 = 一整天**。 */
export const ALL_DAY_ATTENDANCE_START_LOCAL = '00:00:00';
export const ALL_DAY_QUIZ_END_LOCAL = '23:59:00';

/**
 * 建场次时用哪套时刻。
 *
 * 注意 `attendanceEnd` / `lateCutoff` 在全天模式下**不再有出勤含义** ——
 * 出勤已于 2026-08-24 停用，这两列只是不再被读；保留是为了不动 schema。
 */
export function windowTimesFor(classId: string | null | undefined): {
  attendanceStartLocal: string;
  quizEndLocal: string;
  allDay: boolean;
} {
  if (allDayEnabled(classId)) {
    return {
      attendanceStartLocal: ALL_DAY_ATTENDANCE_START_LOCAL,
      quizEndLocal: ALL_DAY_QUIZ_END_LOCAL,
      allDay: true,
    };
  }
  return { attendanceStartLocal: '08:30:00', quizEndLocal: '09:00:00', allDay: false };
}
