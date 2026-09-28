/**
 * 第五周**不教**的词（build-week2-vocab.js 读到这份表才启用排除）。
 *
 * 沿用第四周的教训：生成器按词典查词形，不认专有名词，也分不清词形还原
 * 是不是还原错了（sometimes → sometime、tired → tire、stared → star、
 * in charge → charge）。句中大写的词生成器会自动跳过，这里再列一遍防漏。
 * 本周生成后逐个看过主词，再往这里补。
 */

'use strict';

// 周一加：working（those working alone，只是 work 的分词，不值得占位）、
// front（「At 11.40」被断句器从点号切开，例句成了「40 her lesson was open in front of me」）。
module.exports = [
  'sometime', 'tire', 'charge', 'madam', 'star', 'american',
  'working', 'front',
  // 周三 Sub-Twenty：cube 只在 "Rubik's Cubes"（专有名词、句中大写）里被选作例句，内容测试不收。
  'cube',
];
