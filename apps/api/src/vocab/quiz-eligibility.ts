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
 *   3. 在**这次任务的词汇队列**里（`DailyLessonCompletion.vocabWords`）
 *
 * 第 3 条由调用方的查询执行（`headword IN 队列`），本文件只负责第 2 条
 * 和「够不够一场测试」。**任务归属不再用任何日期推断** —— 早期版本在这里
 * 还筛过一道「今天到期 或 今天教过」，纯复习日会把队列里的词全筛掉
 * （复习完 due 被推远、firstTaughtAt 又是往日的），实测 taught=4
 * eligible=0，正式测试永远开不了。那层过滤已删。
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

/**
 * 从**这次任务队列里的词**中挑出够格的那些。
 *
 * @param words 候选（调用方已按 studentId + 任务队列取好）
 *
 * 后两个参数是历史签名，现在不再使用 —— 保留是为了不动调用方，
 * 任何依赖它们做日期判断的实现都已经被删掉了。
 */
export function selectEligible(
  words: ReadonlyArray<EligibilityWord>,
  _now?: Date,
  _dayStart?: Date,
): EligibilityOutcome {
  // **任务归属已经在调用方的查询里决定了**（headword IN 这次任务的队列）。
  //
  // 这里曾经再筛一道「今天到期 或 今天教过」—— 那是任务归属还靠日期推断
  // 时留下的。队列化之后它是纯粹的有害残留：纯复习日里，学生课程内复习
  // 完，词的 due 被 FSRS 推到几天后、firstTaughtAt 又是往日的，于是**队列
  // 里的词一个都不满足**，正式测试永远开不了（实测 taught=4 eligible=0）。
  //
  // 现在这里只回答一件事：这些词够不够开一场正式测试。
  const taught = words.filter((w) => w.firstTaughtAt != null);
  if (taught.length === 0) return { kind: 'not_ready', taught: 0, eligible: 0 };
  if (taught.length < MIN_QUIZ_ITEMS) {
    return { kind: 'insufficient_items', taught: taught.length, eligible: taught.length };
  }
  return { kind: 'ok', words: taught.slice(0, MAX_QUIZ_ITEMS) };
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
