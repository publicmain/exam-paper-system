/**
 * 单词测试挪到第二天早读 + 每天多学一些词（2026-09-29，叶老师）。两个开关都在环境变量里，
 * 不设就是原来的行为（当天学完当天考、每天按各人设置 10 个），撤回只要删变量：
 *
 *   · VOCAB_MORNING_TEST_FROM=2026-09-29 —— 这一天及以后学的词，正式单词测试在**下一个教学日**
 *     （周一到周五，周五学的就是下周一）早上 8:30（新加坡时间）才开考，早读 8:30–9:00 在课上
 *     统一做。8:30 之前生成不了卷子；8:30 之后一直能做（不设结束时间，没考的照旧进「还有测试
 *     没做」）。已经生成过的卷子不受影响。当天首页只剩阅读 + 学新词两项。
 *   · VOCAB_SCHOOL_DAILY_TARGET=30 —— 每天的新词学校统一定 30 个，不看各人存的设置。已经排好的
 *     当天任务不动，从下一次排词起生效。
 */

import { isTeachingDay } from './unified-vocabulary-rules';

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const OPEN_AT_SGT = '08:30:00';
const DAY_MS = 86_400_000;

/** 从哪一天学的词开始「第二天早上考」；没设（或格式不对）就是 null = 原来的当天考。 */
export function nextMorningTestFrom(): string | null {
  const raw = process.env.VOCAB_MORNING_TEST_FROM?.trim();
  return raw && DATE_RE.test(raw) ? raw : null;
}

/** 学校统一的每天新词数；没设就是 null = 按各人设置（默认 10）。 */
export function schoolDailyTarget(): number | null {
  const n = Number(process.env.VOCAB_SCHOOL_DAILY_TARGET);
  return Number.isInteger(n) && n > 0 ? n : null;
}

/** 某天（新加坡日期）学的词，正式测试几点开考；不受这条规则管的日子返回 null。 */
export function formalTestOpensAt(dailyDateKey: string): Date | null {
  const from = nextMorningTestFrom();
  if (!from || !DATE_RE.test(dailyDateKey) || dailyDateKey < from) return null;
  let t = Date.parse(`${dailyDateKey}T00:00:00.000Z`);
  let key: string;
  do {
    t += DAY_MS;
    key = new Date(t).toISOString().slice(0, 10);
  } while (!isTeachingDay(key));
  return new Date(`${key}T${OPEN_AT_SGT}+08:00`);
}

/** 现在还不能开考吗（只管还没生成的卷子）。 */
export function formalTestLocked(dailyDateKey: string, now: Date): boolean {
  const at = formalTestOpensAt(dailyDateKey);
  return at != null && now.getTime() < at.getTime();
}
