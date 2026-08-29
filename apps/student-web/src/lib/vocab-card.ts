/**
 * 课程学词的纯逻辑（阶段 9A）—— 遮词、断点钳制、停留判定。
 *
 * 单独拆出来是因为这三件事都**只能靠单测证明**：遮词漏一个变位就等于把
 * 答案印在题面上，断点钳错一次就是学生的进度倒退，而停留判定错了会让
 * 服务端把一次诚实的复习判成「秒选」。
 */
import { MAX_ELAPSED_MS } from './review-queue';

/**
 * 与服务端 `MIN_HONEST_DWELL_MS` 同一个数。
 *
 * 服务端那边是兜底（拦脚本、拦旧缓存前端），这里是**产品行为**：答案露出
 * 之后 1.5 秒内不给评分，逼着人真的看一眼。两边同一个阈值，UI 才不会
 * 放行一个必然被服务端判成 `tooFast` 的评分。
 */
export const MIN_DWELL_MS = 1500;

export { MAX_ELAPSED_MS };

/**
 * 把断点钳成一个能用的下标。
 *
 * 服务端已经钳过一次，但响应可能被中间件改坏、也可能是老版本，
 * `NaN` / 负数 / 超界一旦进了数组下标，页面直接白屏。**宁可从头开始，
 * 不要崩**。
 */
export function clampCursor(raw: unknown, total: number): number {
  const n = Number(raw);
  if (!Number.isFinite(n)) return 0;
  return Math.max(0, Math.min(Math.floor(n), Math.max(0, total)));
}

/**
 * 断点只进不退。
 *
 * 两个来源会给出更小的值：另一个标签页落后的上报、以及服务端在「当日
 * 任务行不存在」时回读到的 0。任何一个都不该把学生已经走到的位置拽回去。
 */
export function advanceCursor(current: number, next: number, total: number): number {
  return Math.max(current, clampCursor(next, total));
}

/** 上报给服务端的停留时长：从答案露出算起，封顶 10 分钟。 */
export function elapsedFrom(revealedAt: number, now: number): number {
  return Math.max(0, Math.min(Math.floor(now - revealedAt), MAX_ELAPSED_MS));
}

export function dwellSatisfied(revealedAt: number | null, now: number): boolean {
  return revealedAt != null && now - revealedAt >= MIN_DWELL_MS;
}

/**
 * 把例句里的目标词遮掉。
 *
 * ## 为什么不能只替换 headword
 *
 * 生词本里存的是**原形**（`headword`），文章里出现的常常是变位形式
 * （`surfaceForm`）：`run` / `running`、`city` / `cities`。只替换原形，
 * 例句里那个 `running` 原样留着 —— 复习卡的正面直接把答案印出来了。
 *
 * ## 兜底比聪明更重要
 *
 * 这里替换 `headword` / `surfaceForm` 以及常见的屈折后缀，但**不假装能
 * 穷尽英语的形态学**。替换完之后再查一遍：只要句子里还能找到原形或
 * 原文形式的**子串**（不区分大小写），就判定「遮不干净」，整句不显示。
 * 少给一句例句，好过泄题。
 */
export function concealTarget(
  sentence: string | null | undefined,
  headword: string,
  surfaceForm?: string | null,
): { text: string | null; masked: boolean } {
  const raw = (sentence ?? '').trim();
  if (!raw) return { text: null, masked: false };

  const forms = [surfaceForm, headword]
    .map((f) => (f ?? '').trim())
    .filter((f) => f.length > 0)
    // 先长后短：先遮 `running` 再遮 `run`，否则前者会被拆成 `___ning`。
    .sort((a, b) => b.length - a.length);
  if (forms.length === 0) return { text: raw, masked: false };

  let out = raw;
  for (const f of forms) {
    // 词形 + 常见屈折后缀。`\w*` 会把 `runaway` 也吃掉，所以只放行确实
    // 属于屈折的那几个，其余交给下面的兜底检查。
    const re = new RegExp(`\\b${escapeRe(f)}(?:s|es|ed|ing|d|ies)?\\b`, 'gi');
    out = out.replace(re, BLANK);
  }

  for (const f of forms) {
    if (out.toLowerCase().includes(f.toLowerCase())) {
      // 遮不干净（连字符、所有格、复合词…）—— 整句不给。
      return { text: null, masked: true };
    }
  }
  return { text: out, masked: out !== raw };
}

export const BLANK = '______';

function escapeRe(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}
