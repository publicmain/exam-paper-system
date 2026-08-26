/**
 * P5 —— 「这个词教过没有」的**唯一判据**（纯函数，无 IO）。
 *
 * ## 为什么需要一个新字段
 *
 * 在此之前，系统里唯一能表示「学生见过这个词」的东西是 `reps` ——
 * FSRS 的复习次数。而 `reps` 只有在**提交一次评分**（记得 / 忘了）时
 * 才前进。于是「把新词标记成已教」这件事，除了让学生对一个他从没见过
 * 的词打分之外没有别的做法：教学被迫长成考试的样子（挖空 → 显示答案
 * → 认识/不认识），而那一评分又会被 FSRS 当成真实信号写进调度。
 *
 * 「学」和「测」混在一起的根源就是这一个缺失的字段。补上它之后，
 * 首次教学可以只做教学：不评分、不写复习流水、不动 FSRS 的任何字段。
 *
 * ## 判据
 *
 *   needsFirstTeaching = firstTaughtAt === null && reps === 0
 *
 * 两个条件缺一不可，而且**都不需要回填**：
 * - 存量里 `reps > 0` 的词，学生一定评过分（见过了）→ 当复习词处理
 * - 存量里 `reps = 0` 的词，从来没被评过分 → 本来就该补一次教学
 *
 * `firstTaughtAt` 只增不减、只写一次（条件写入 WHERE firstTaughtAt IS
 * NULL），它记录的是「教过」这个事实本身，**不是成绩、不是熟练度、
 * 也不参与调度**。P6 的词汇测试成绩是另一件事，不挂在这里。
 */

export interface FirstTeachingFacts {
  /** 首次教学完成的时刻；null = 从未完成 */
  firstTaughtAt: Date | string | null | undefined;
  /** FSRS 复习次数 */
  reps: number | null | undefined;
}

/** 这个词现在该走「首次教学卡」吗？ */
export function needsFirstTeaching(w: FirstTeachingFacts): boolean {
  if (w.firstTaughtAt != null) return false;
  return (w.reps ?? 0) === 0;
}

/**
 * 反过来：该走复习交互（挖空 / 显示答案 / 评分）吗？
 *
 * 单独写出来是为了让「两条分支互斥且穷尽」这件事可以被测试直接断言，
 * 而不是散在页面的 if 里靠读代码确认。
 */
export function needsReviewInteraction(w: FirstTeachingFacts): boolean {
  return !needsFirstTeaching(w);
}
