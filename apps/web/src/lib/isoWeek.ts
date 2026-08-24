/**
 * ISO 周标签 —— 与 apps/api/src/morning-quiz/iso-week.ts 的核心函数
 * 逐字镜像（cloze.ts 同款约定）。前端用它匹配「本周主线」的
 * sourcePassageTitle（『每周主线 2026-W35』）。
 */

/** 纯核心：给定日历年月日（月从 0 起）→ ISO 周标签。 */
export function isoWeekOfYMD(year: number, month0: number, day: number): string {
  const date = new Date(Date.UTC(year, month0, day));
  const dayNum = (date.getUTCDay() + 6) % 7; // 周一=0
  date.setUTCDate(date.getUTCDate() - dayNum + 3); // 本周的周四决定 ISO 年
  const isoYear = date.getUTCFullYear();
  const jan4 = new Date(Date.UTC(isoYear, 0, 4));
  const week =
    1 +
    Math.round(
      ((date.getTime() - jan4.getTime()) / 86_400_000 - 3 + ((jan4.getUTCDay() + 6) % 7)) / 7,
    );
  return `${isoYear}-W${String(week).padStart(2, '0')}`;
}

/** 学生设备本地日历（新加坡）今天所在的 ISO 周。 */
export function currentIsoWeekLabel(now = new Date()): string {
  return isoWeekOfYMD(now.getFullYear(), now.getMonth(), now.getDate());
}

/** 本周主线词的 sourcePassageTitle。 */
export function weeklyTrackTitle(now = new Date()): string {
  return `每周主线 ${currentIsoWeekLabel(now)}`;
}
