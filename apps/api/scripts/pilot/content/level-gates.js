/**
 * 每一档的篇幅与超纲词硬门槛（2026-09-11 起用于第三周及以后）。
 *
 * 数字不是拍脑袋：取首发周（09-07 ~ 09-11）五档二十五篇的实测范围，
 * 上下各留一点余量。首发周实测：
 *
 *   ielts_simplified     179–218 词   超纲 4.2%–5.9%（A2 上限）
 *   olevel_intermediate  371–451 词   超纲 4.6%–7.5%（B1 上限）
 *   olevel               386–565 词   超纲 5.0%–7.8%（B1 上限）
 *   ielts_light          239–278 词   超纲 3.2%–7.5%（B2 上限）
 *   ielts_authentic      475–733 词   不设上限
 *
 * 「词数」「超纲」都按 `src/vocab-v2/cefr-difficulty.ts` 的 difficultyProfile
 * 算：专有名词不算超纲，词表外的四字母以上词算超纲。
 *
 * 为什么只管第三周起：前两周已经发布、学生做过了，回头按新门槛挑刺
 * 改不了任何东西，只会让测试变红。
 */

'use strict';

const GATES_FROM = '2026-09-14';

const LEVEL_GATES = {
  ielts_simplified: { words: [170, 260], maxHard: 0.07 },
  olevel_intermediate: { words: [360, 490], maxHard: 0.085 },
  olevel: { words: [380, 600], maxHard: 0.09 },
  ielts_light: { words: [230, 320], maxHard: 0.085 },
  ielts_authentic: { words: [450, 800], maxHard: null },
};

module.exports = { GATES_FROM, LEVEL_GATES };
