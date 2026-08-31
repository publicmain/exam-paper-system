/**
 * 试点第一周的课程内容 —— **三档 × 两天**。
 *
 * ## 为什么是三档
 *
 * staging 里**没有**试点班，也没有任何一个班配好了分级可以直接接这一周
 * （唯一配了分级的是 S12F 验收班，不能复用）。用户的决定是：
 * **三档全做**，学生按自己的水平各读各的。
 *
 * 引擎本来就支持这件事：一个班可以挂多个 `ClassEnglishLevel`，同一天
 * 每一档各开一场 `MorningQuizSession`，`pickTodaySession` 按学生的
 * `User.englishLevel` 挑他那一场。所以三档共用一个试点班。
 *
 * ## 为什么只有周一周二
 *
 * 用户的决定：**先做今天和明天**。周三到周五的内容按同一形状追加即可 ——
 * 每一档的 `DAYS` 数组多两三项，其余（脚本、测试、发布流程）一个字不用改。
 *
 * ## 一天的形状（三档一致）
 *
 *   · 一篇原创原文；
 *   · 十道题 = 六道 `mcq`（服务端当场判） + 四道 `short_answer`（等老师批）；
 *   · 二十一个目标词，每个都真的出现在当天那篇原文里。
 *
 * 六 / 四这个比例来自 `GradeService`：零 AI 模式下只有 `mcq` 有确定性
 * 判定，其余一律 `needsHumanReview`。六道保证学生交卷立刻看得到东西，
 * 四道保证老师每人每天只批四题。
 */

'use strict';

const olevel = require('./olevel');
const simplified = require('./ielts_simplified');
const authentic = require('./ielts_authentic');

/** 三档的内容包。key 就是 `EnglishLevel` 枚举值。 */
const LEVELS = {
  [olevel.LEVEL]: olevel.DAYS,
  [simplified.LEVEL]: simplified.DAYS,
  [authentic.LEVEL]: authentic.DAYS,
};

/** 这一周实际发布的日期（新加坡日历日）。 */
const DATES = ['2026-08-31', '2026-09-01'];

/** 每天的目标词数 —— 学习卡与正式测试的题数都等于它。 */
const WORDS_PER_DAY = 21;

/** 每天的题数与自动 / 人工判分的配比。 */
const QUESTIONS_PER_DAY = 10;
const MIN_AUTO_PER_DAY = 6;
const MAX_HUMAN_PER_DAY = 4;

/** 取某一档某一天。找不到返回 null —— 调用方必须自己决定怎么办。 */
function lessonFor(level, date) {
  return (LEVELS[level] ?? []).find((d) => d.date === date) ?? null;
}

/** 这一周用到的全部词条（跨档跨天去重），给词典补录用。 */
function allWords() {
  const byHead = new Map();
  for (const days of Object.values(LEVELS)) {
    for (const d of days) {
      for (const w of d.words) {
        // 同一个 headword 在不同档 / 不同天可能重复出现（比如 stiff、
        // rubbish）。词典只要一条，取第一次见到的那份释义。
        if (!byHead.has(w.headword)) byHead.set(w.headword, w);
      }
    }
  }
  return [...byHead.values()];
}

module.exports = {
  LEVELS,
  DATES,
  WORDS_PER_DAY,
  QUESTIONS_PER_DAY,
  MIN_AUTO_PER_DAY,
  MAX_HUMAN_PER_DAY,
  lessonFor,
  allWords,
};
