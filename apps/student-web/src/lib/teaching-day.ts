/**
 * 教学日 = 新加坡时间的周一到周五（与服务端 `isTeachingDay` 同一口径）。
 *
 * 每日新词周末不推（叶老师 2026-09-04 定的）。服务端在周末对
 * `/vocab-v2/daily/start` 回 `v2_no_task_on_weekend`；客户端拿这个函数
 * 提前把「学习今天的新词」这类入口换成说明，别把学生引到一个死胡同页。
 */
export function sgtDateKey(now: Date = new Date()): string {
  return new Date(now.getTime() + 8 * 60 * 60 * 1000).toISOString().slice(0, 10);
}

export function isTeachingDay(now: Date = new Date()): boolean {
  const key = sgtDateKey(now);
  const [y, m, d] = key.split('-').map(Number);
  const weekday = new Date(Date.UTC(y, m - 1, d)).getUTCDay();
  return weekday >= 1 && weekday <= 5;
}

export const WEEKEND_VOCAB_NOTE = '周六周日不推新词，周一再来';

/**
 * 阅读课 16:30 开始（叶老师 2026-09-21 定）。教学日 16:30 以前，首页「今日阅读」
 * 卡上显示一条醒目提示，请学生上课时再做。只是提示，不锁任何东西。
 */
export const READING_CLASS_START_MIN = 16 * 60 + 30;

/** 新加坡时间当天第几分钟 */
function sgtMinuteOfDay(now: Date): number {
  const sgt = new Date(now.getTime() + 8 * 60 * 60 * 1000);
  return sgt.getUTCHours() * 60 + sgt.getUTCMinutes();
}

export function isBeforeReadingClass(now: Date = new Date()): boolean {
  return isTeachingDay(now) && sgtMinuteOfDay(now) < READING_CLASS_START_MIN;
}

/** 离今天 16:30 还有多少毫秒（已经过了 / 周末返回 null），提示到点自动消失用。 */
export function msUntilReadingClass(now: Date = new Date()): number | null {
  if (!isBeforeReadingClass(now)) return null;
  const sgt = new Date(now.getTime() + 8 * 60 * 60 * 1000);
  const msIntoDay = ((sgt.getUTCHours() * 60 + sgt.getUTCMinutes()) * 60 + sgt.getUTCSeconds()) * 1000 + sgt.getUTCMilliseconds();
  return READING_CLASS_START_MIN * 60 * 1000 - msIntoDay;
}
