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
 *   · 12–21 个候选词，每个都真的出现在当天原文；发布时前 12 个是今日
 *     主词，其余是学生点「这个词我会了」时的同文备用词。
 *
 * 六 / 四这个比例来自 `GradeService`：零 AI 模式下只有 `mcq` 有确定性
 * 判定，其余一律 `needsHumanReview`。六道保证学生交卷立刻看得到东西，
 * 四道保证老师每人每天只批四题。
 */

'use strict';

const { createHash } = require('node:crypto');

const olevel = require('./olevel');
const simplified = require('./ielts_simplified');
const authentic = require('./ielts_authentic');
const olevelRemaining = require('./olevel_remaining');
const simplifiedRemaining = require('./ielts_simplified_remaining');
const authenticRemaining = require('./ielts_authentic_remaining');
const { IELTS_LIGHT_DAYS, OLEVEL_INTERMEDIATE_DAYS } = require('./fixture-levels');
const contextTranslations = {
  ...require('./context-translations-ielts_simplified'),
  ...require('./context-translations-olevel_intermediate'),
  ...require('./context-translations-olevel'),
  ...require('./context-translations-ielts_light'),
  ...require('./context-translations-ielts_authentic'),
};

function contextDigest(sentence) {
  return createHash('sha256').update(sentence, 'utf8').digest('hex');
}

/**
 * 每一张学习卡在发布前就必须有中文句意。这里故意 fail closed：以后内容
 * 编辑者改了英文原句却忘记同步翻译，测试和发布脚本都会立即失败。
 */
function withContextTranslations(days, level) {
  return days.map((day) => ({
    ...day,
    words: day.words.map((word) => {
      const contextTranslation = contextTranslations[contextDigest(word.context)];
      if (!contextTranslation || !/[\u3400-\u9fff]/u.test(contextTranslation)) {
        throw new Error(`missing_context_translation:${level}:${day.date}:${word.headword}`);
      }
      return { ...word, contextTranslation };
    }),
  }));
}

/** 五档的内容包。key 就是 `EnglishLevel` 枚举值。 */
const LEVELS = {
  [simplified.LEVEL]: withContextTranslations([...simplified.DAYS, ...simplifiedRemaining.DAYS], simplified.LEVEL),
  olevel_intermediate: withContextTranslations(OLEVEL_INTERMEDIATE_DAYS, 'olevel_intermediate'),
  [olevel.LEVEL]: withContextTranslations([...olevel.DAYS, ...olevelRemaining.DAYS], olevel.LEVEL),
  ielts_light: withContextTranslations(IELTS_LIGHT_DAYS, 'ielts_light'),
  [authentic.LEVEL]: withContextTranslations([...authentic.DAYS, ...authenticRemaining.DAYS], authentic.LEVEL),
};

/** 这一周实际发布的日期（新加坡日历日）。 */
const DATES = ['2026-08-31', '2026-09-01', '2026-09-02', '2026-09-03', '2026-09-04'];

/** 内容包每天提供的候选词范围；发布脚本从中切主词与备用词。 */
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
