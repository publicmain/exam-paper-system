/**
 * 第四周**不教**的词（build-week2-vocab.js 读到这份表才启用排除，前三周没有这份表，行为不变）。
 *
 * 生成器按词典查词形：不认专有名词，也分不清词形还原是不是还原错了。
 * 第四周第一次生成时，主词里出现了这些（第三周也发出去过 dewar、richardson、
 * 「sometime：改天」）：
 *
 *   · 人名 / 地名被当成生词：Fleming →「佛兰芒人」、Woodland →「林地」、
 *     Gros Michel 的 Gros →「横棱绸」、Jasmine →「茉莉」、Sarah；
 *     句中大写的词生成器现在会自动跳过，这里再列一遍防漏。
 *   · 词形还原错了：sometimes → sometime（改天）；tired → tire（多数学生会想到轮胎）；
 *     in charge → charge（给出的是「指控，费用」）。
 *   · 称呼：Madam 只是称谓，不值得占一个主词。
 *   · stared 被还原成 star（星星）—— 生成器先试「去掉 -ed」再试「去掉 -d」。
 */

'use strict';

module.exports = [
  'fleming', 'woodland', 'gros', 'jasmine', 'sarah', 'american',
  'sometime', 'tire', 'charge', 'madam', 'star',
];
