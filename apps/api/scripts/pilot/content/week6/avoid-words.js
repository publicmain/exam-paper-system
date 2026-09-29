/**
 * 第六周**不教**的词（build-week2-vocab.js 读到这份表才启用排除）。
 *
 * 沿用第四、五周的教训：生成器按词典查词形，不认专有名词，也分不清词形还原
 * 是不是还原错了（sometimes → sometime、tired → tire、stared → star、
 * in charge → charge）。句中大写的词生成器会自动跳过，这里再列一遍防漏。
 * 本周生成后逐个看过主词，再往这里补。
 */

'use strict';

module.exports = [
  'sometime', 'tire', 'charge', 'madam', 'star', 'american',
  'working', 'front',
  // 中级 Frame by Frame：vroom 是拟声词（汽车声），不值得教。
  'vroom',
  // easy：本周有一处例句只有一个词 "Easy."，而且太基础，不教。
  'easy',
];
