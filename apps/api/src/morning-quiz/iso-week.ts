/**
 * ISO 周标签（'2026-W35'）—— 每周主线词表的键。
 *
 * 为什么带年份：只用 W35 的话，明年同周号的词表文件会与今年的主线
 * 词在前端撞标题（前端按 sourcePassageTitle 精确匹配本周），去年的
 * 词会被算进今年的进度。
 *
 * 与 apps/web/src/lib/isoWeek.ts 逐字镜像（cloze.ts 同款约定）。
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

/** 服务端入口：任意时刻 → 新加坡挂钟日期所在的 ISO 周。 */
export function isoWeekSGT(d: Date): string {
  const sgt = new Date(d.getTime() + 8 * 3600_000);
  return isoWeekOfYMD(sgt.getUTCFullYear(), sgt.getUTCMonth(), sgt.getUTCDate());
}
