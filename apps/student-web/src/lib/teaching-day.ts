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
