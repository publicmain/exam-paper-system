/**
 * P6 —— 正式单词测试的**出题资格**（纯函数，无 IO）。
 *
 * ## 未学先考的根因
 *
 * 出题从来只按「到期」和「加入时间」挑词，从不问「教过没有」——
 * 因为 P5 之前**根本没有「教过」这个事实**（唯一的近似是 FSRS 的 reps，
 * 而它只在评分时前进）。于是 `vocab-quiz.service` 里长出了两层兜底：
 *
 *   ① 到期词不够 → 捞 `reps = 0` 的词（从没学过的）
 *   ② 还不够   → 捞**任意**词（连到期都不要求）
 *
 * 短文层的词表是建场时推给学生的，他从没见过；一进本子 `due` 就是
 * `now()`。两层兜底叠在一起的结果是：学生第一次打开自测，考的全是他
 * 没读过的词，全错；而答错还会回写 FSRS，把这批词标成「困难」，往后
 * 天天来烦他。**「凑够题数」这个目标压倒了「只考教过的东西」。**
 *
 * ## 资格规则
 *
 * 一个词能进正式测试，当且仅当：
 *   1. 是这个学生自己的词（不跨学生）
 *   2. `firstTaughtAt != null` —— **教过**。刚教完、`reps` 还是 0 的词
 *      完全合格，这正是「先学后测」要考的那批
 *   3. 属于**当天这次任务**：今天该练的（`due <= now`），或今天刚教过的
 *      （`firstTaughtAt >= 当日零点` —— 哪怕它的 due 被别的动作挪走了）
 *
 * 不够题就**明说不够**（`insufficient_items`），绝不为凑数放宽任何一条：
 * 不放宽到未教过的词，不放宽到别的任务的词，更不看 `User.englishLevel`
 * 重新算一批。宁可今天不考，也不考他没学过的东西。
 */

/** 一份正式测试至少要几道题才算得上一次测试 */
export const MIN_QUIZ_ITEMS = 4;
/** 一份正式测试最多几道题 —— 与自测同量级，保证几分钟做得完 */
export const MAX_QUIZ_ITEMS = 10;

export interface EligibilityWord {
  headword: string;
  firstTaughtAt: Date | string | null | undefined;
  due: Date | string;
}

export type EligibilityOutcome =
  /** 一个教过的词都没有 —— 学生还没走到「该考」这一步 */
  | { kind: 'not_ready'; taught: 0; eligible: 0 }
  /** 教过一些，但今天这次任务里够格的不足 MIN_QUIZ_ITEMS */
  | { kind: 'insufficient_items'; taught: number; eligible: number }
  | { kind: 'ok'; words: EligibilityWord[] };

function ts(v: Date | string | null | undefined): number | null {
  if (v == null) return null;
  const d = v instanceof Date ? v : new Date(v);
  const n = d.getTime();
  return Number.isFinite(n) ? n : null;
}

/**
 * 从「学生今天的词」里挑出够格的那些。
 *
 * @param words     候选（调用方已按 studentId 取好，不做跨学生的事）
 * @param now       当前时刻
 * @param dayStart  当日零点（SGT），用于「今天刚教过」的判定
 */
export function selectEligible(
  words: ReadonlyArray<EligibilityWord>,
  now: Date,
  dayStart: Date,
): EligibilityOutcome {
  const nowMs = now.getTime();
  const dayMs = dayStart.getTime();

  const taught = words.filter((w) => ts(w.firstTaughtAt) != null);
  if (taught.length === 0) return { kind: 'not_ready', taught: 0, eligible: 0 };

  const eligible = taught.filter((w) => {
    const dueMs = ts(w.due);
    const taughtMs = ts(w.firstTaughtAt)!;
    const dueToday = dueMs != null && dueMs <= nowMs;
    const taughtToday = taughtMs >= dayMs;
    return dueToday || taughtToday;
  });

  if (eligible.length < MIN_QUIZ_ITEMS) {
    return { kind: 'insufficient_items', taught: taught.length, eligible: eligible.length };
  }
  return { kind: 'ok', words: eligible.slice(0, MAX_QUIZ_ITEMS) };
}

/** 一份 items 快照算分 —— 展示层不重算，改词库也不影响历史成绩。 */
export function scoreOf(items: ReadonlyArray<{ isCorrect?: boolean | null }>): {
  total: number;
  correct: number;
  score: number;
} {
  const total = items.length;
  const correct = items.filter((it) => it.isCorrect === true).length;
  const score = total > 0 ? Math.round((correct / total) * 1000) / 10 : 0;
  return { total, correct, score };
}
