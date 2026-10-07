/**
 * 第七周**不教**的词（build-week2-vocab.js 读到这份表才启用排除）。
 *
 * 沿用第四到六周的教训：生成器按词典查词形，不认专有名词，也分不清词形还原
 * 是不是还原错了（sometimes → sometime、tired → tire、stared → star、
 * in charge → charge）。句中大写的词生成器会自动跳过，这里再列一遍防漏。
 * 本周生成后逐个看过主词，再往这里补。
 */

'use strict';

module.exports = [
  'sometime', 'tire', 'charge', 'madam', 'star', 'american',
  'working', 'front',
  // 第七周第一次生成后补：专有名词与词组里的词
  'spain', 'jasmine', 'state', 'course',
  // olevel 周五：door 被生成器取自乐队名 Seven Doors（专有名词）；这个词也太基础，不教。
  'door',
];
