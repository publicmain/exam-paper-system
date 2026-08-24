/**
 * 第二作答窗（2026-08-20 校方新政）：16:00–17:30 SGT。
 *
 * 这不是「补考场」的改名 —— 它取代了补考场，服务对象也变了：
 *   · 早上没来的、来了没答完的、答完想再改的，都能进
 *   · 学生任意选择在哪个窗作答，也可以修改早上写下的答案
 *   · 早测自此不再记录出勤，「几点到校」不再是这套系统回答的问题
 *
 * 常量和判定单独成模块，是因为 cron 和 service 都要用：cron 决定几点
 * 开窗、几点收尾，service 要在发卷时告诉前端今天有没有这个窗。让 cron
 * 从 service 反向 import 会成环（service 已经被 cron 依赖）。
 *
 * 时间存成 SGT 挂钟字符串，经 combineLocal 转 UTC —— 与正式窗口字段
 * 同一套时区约定。
 */

export const SECOND_WINDOW_START_LOCAL = '16:00:00';
export const SECOND_WINDOW_END_LOCAL = '17:30:00';

/** 第二作答窗自 2026-08-24（下周一）起生效 —— 8/17 那周是考试周，改动
 *  不在考试周中途切换。周一无早测，实际第一次生效是 8/25 周二。 */
export const SECOND_WINDOW_EFFECTIVE_FROM = '2026-08-24';

/**
 * 今天这个日子适不适用第二作答窗。纯函数，可测。
 *
 * **早上 09:00 收卷时必须问这个问题**：适用 → 收成「暂存提交」，把答案
 * 扣住、把下午继续改的权利留着；不适用（开关关了 / 生效日之前 / 周末）
 * → 收成「最终提交」，当场公布答案，就是第二窗上线前的老行为。
 *
 * 漏掉这个判断的后果很具体：学生早上被收卷，下午的窗又永远不开，于是
 * 他停在暂存状态，答案一辈子看不到。
 */
export function secondWindowAppliesTo(input: {
  secondWindowEnv: string | undefined;
  dateIsoLocal: string;
  weekdayLocal: number; // 0=Sun..6=Sat
}): boolean {
  if (input.secondWindowEnv === 'off') return false;
  if (input.dateIsoLocal < SECOND_WINDOW_EFFECTIVE_FROM) return false;
  if (input.weekdayLocal === 0 || input.weekdayLocal === 6) return false;
  return true;
}

/**
 * 今天这场要不要自动开第二作答窗。纯函数，可测。
 *
 * 只在满足全部条件时开：
 *   - 这个日子适用第二窗（见 secondWindowAppliesTo）
 *   - 当前 SGT 时刻已进入 16:00–17:30（cron 每分钟跳一次，第一跳开窗，
 *     之后 makeupStart 非空即跳过 —— 幂等）
 *   - 场次已 locked（正式场 09:00 收过卷）。仍 active 的场次说明当天流程
 *     异常，不叠加第二窗
 *   - **今天没开过**（makeupStart 为空）。老师手动开过的当天不再自动开
 *     —— 手动操作优先
 *
 * 2026-08-20 起**不再看缺席人数**。旧的补考场只服务无故缺席的学生，所以
 * 「没人缺席就不开」是对的；现在这是所有学生都能进的常规窗口，早上答完
 * 但想再改的、答了一半的都算数，按缺席数决定开不开会把绝大多数该开的
 * 日子挡掉。
 */
export function shouldAutoOpenSecondWindow(input: {
  secondWindowEnv: string | undefined;
  /** SGT 当天日期 YYYY-MM-DD —— 生效日之前一律不开 */
  dateIsoLocal: string;
  nowLocalHHMMSS: string;
  weekdayLocal: number; // 0=Sun..6=Sat
  sessionStatus: string;
  makeupStart: Date | null;
}): boolean {
  if (
    !secondWindowAppliesTo({
      secondWindowEnv: input.secondWindowEnv,
      dateIsoLocal: input.dateIsoLocal,
      weekdayLocal: input.weekdayLocal,
    })
  ) {
    return false;
  }
  if (input.nowLocalHHMMSS < SECOND_WINDOW_START_LOCAL) return false;
  if (input.nowLocalHHMMSS >= SECOND_WINDOW_END_LOCAL) return false;
  if (input.sessionStatus !== 'locked') return false;
  if (input.makeupStart != null) return false;
  return true;
}
