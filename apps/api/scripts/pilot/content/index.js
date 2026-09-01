/**
 * 试点第一周的课程内容 —— **五档 × 五天**。
 *
 * 学生先选班，再独立选择五档中的任意一档；班级不替学生决定难度。
 *
 * 引擎本来就支持这件事：一个班可以挂多个 `ClassEnglishLevel`，同一天
 * 每一档各开一场 `MorningQuizSession`，`pickTodaySession` 按学生的
 * `User.englishLevel` 挑他那一场。所以五档共用一个试点班。
 *
 * ## 一天的形状（五档一致）
 *
 *   · 一篇原创原文；
 *   · 十道题 = 六道 `mcq`（服务端当场判） + 四道 `short_answer`（等老师批）；
 *   · 12–21 个目标词，每个都真的出现在当天那篇原文里。
 *
 * 六 / 四这个比例来自 `GradeService`：零 AI 模式下只有 `mcq` 有确定性
 * 判定，其余一律 `needsHumanReview`。六道保证学生交卷立刻看得到东西，
 * 四道保证老师每人每天只批四题。
 */

'use strict';

const olevel = require('./olevel');
const simplified = require('./ielts_simplified');
const authentic = require('./ielts_authentic');
const olevelRemaining = require('./olevel_remaining');
const simplifiedRemaining = require('./ielts_simplified_remaining');
const authenticRemaining = require('./ielts_authentic_remaining');
const { IELTS_LIGHT_DAYS, OLEVEL_INTERMEDIATE_DAYS } = require('./fixture-levels');

/** 五档的内容包。key 就是 `EnglishLevel` 枚举值。 */
const LEVELS = {
  [simplified.LEVEL]: [...simplified.DAYS, ...simplifiedRemaining.DAYS],
  olevel_intermediate: OLEVEL_INTERMEDIATE_DAYS,
  [olevel.LEVEL]: [...olevel.DAYS, ...olevelRemaining.DAYS],
  ielts_light: IELTS_LIGHT_DAYS,
  [authentic.LEVEL]: [...authentic.DAYS, ...authenticRemaining.DAYS],
};

/** 这一周实际发布的日期（新加坡日历日）。 */
const DATES = ['2026-08-31', '2026-09-01', '2026-09-02', '2026-09-03', '2026-09-04'];

/** 每天的目标词范围 —— 学习卡与正式测试都使用当天完整词表。 */
const MIN_WORDS_PER_DAY = 12;
const MAX_WORDS_PER_DAY = 21;

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
  MIN_WORDS_PER_DAY,
  MAX_WORDS_PER_DAY,
  QUESTIONS_PER_DAY,
  MIN_AUTO_PER_DAY,
  MAX_HUMAN_PER_DAY,
  lessonFor,
  allWords,
};
