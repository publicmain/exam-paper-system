/**
 * 第三周 —— **ielts_light（雅思轻量）**档，全原创说明文。
 *
 * 两百五六十词、五段，不编号（与首发周这一档一致）。形状：
 *   3 道判断（TRUE / FALSE / NOT GIVEN 各一） · 3 道填空转四选一 ·
 *   1 道两分概括填空 · 3 道主观题（2/1/2 分）—— 满分 13。
 *
 * 事实性内容写之前核过；拿不准的数字不写（比如纸币寿命，各国差得很远，
 * 就只说「几年」而不给具体数）。
 */

'use strict';

const { buildAuthoredDay, plain } = require('../authored');
const { DATES } = require('./dates');

const LEVEL = 'ielts_light';

// ═══════════════════════════════════════════════════════════════
// 周一 —— 铅笔里没有铅
// ═══════════════════════════════════════════════════════════════

const PENCIL = {
  key: 'original-w3-pencil',
  title: 'No Lead in the Pencil',
  passage: plain([
    "Despite the name, there has never been any lead in a pencil 'lead'. The grey core is graphite, a soft form of carbon. The confusion goes back to the sixteenth century, when a large deposit of an unusually pure black mineral was found at Borrowdale in the north of England. People thought it was a kind of lead, and the name stuck.",
    'Borrowdale graphite was so pure that it could be sawn into sticks and used directly. It was also valuable enough to be guarded: the mine was opened for only a few weeks a year, and stealing from it became a serious crime. For about two hundred years, England had something close to a monopoly on good pencils.',
    'In 1795, France was at war with Britain and could not buy English graphite. A French engineer, Nicolas-Jacques Conté, was asked to find a substitute. He ground poor-quality graphite into powder, mixed it with clay and water, pressed the paste into thin rods and baked them in a kiln.',
    'The method had an advantage nobody had asked for. By changing the amount of clay, Conté could make the core harder or softer. More clay gave a hard, pale line; less clay gave a soft, dark one. This is the origin of the letters still printed on pencils today: H for hard and B for black.',
    "The Borrowdale mine closed at the end of the nineteenth century, its best graphite gone. Conté's process, however, is still the basis of almost every graphite pencil made in the world today.",
  ]),
  questions: [
    {
      kind: 'tfng',
      item: 'The core of an ordinary pencil has never contained lead.',
      answer: 'TRUE',
      evidence: "Despite the name, there has never been any lead in a pencil 'lead'.",
    },
    {
      kind: 'tfng',
      item: 'Borrowdale graphite had to be turned into powder before it could be used.',
      answer: 'FALSE',
      evidence: 'Borrowdale graphite was so pure that it could be sawn into sticks and used directly.',
    },
    {
      kind: 'tfng',
      item: 'Conté was given a large reward by the French government for his method.',
      answer: 'NOT GIVEN',
    },
    {
      kind: 'gapChoice',
      stem: 'To protect its graphite, the Borrowdale mine was opened for only a few ______ each year.',
      answer: 'weeks',
      distractors: ['days', 'months', 'hours'],
      evidence:
        'It was also valuable enough to be guarded: the mine was opened for only a few weeks a year, and stealing from it became a serious crime.',
    },
    {
      kind: 'gapChoice',
      stem: 'Conté mixed the powdered graphite with clay and ______.',
      answer: 'water',
      distractors: ['carbon', 'sand', 'oil'],
      evidence:
        'He ground poor-quality graphite into powder, mixed it with clay and water, pressed the paste into thin rods and baked them in a kiln.',
    },
    {
      kind: 'gapChoice',
      stem: 'Adding more clay produced a line that was hard and ______.',
      answer: 'pale',
      distractors: ['dark', 'soft', 'black'],
      evidence: 'More clay gave a hard, pale line; less clay gave a soft, dark one.',
    },
    {
      kind: 'gapTyped',
      summary: true,
      marks: 2,
      stem: "Graphite came to be called 'lead' because, when it was found in the sixteenth century, people ______.",
      answer: 'thought it was a kind of lead',
      evidence: 'People thought it was a kind of lead, and the name stuck.',
      rubric: '两分：写出「当时的人以为它是一种铅」给 2 分；只写「它看起来像铅 / 是黑色的矿物」给 1 分。',
    },
    {
      kind: 'short',
      marks: 2,
      stem: 'Why did France need a substitute for English graphite in 1795?',
      answer: 'France was at war with Britain, so it could not buy graphite from England.',
      evidence: 'In 1795, France was at war with Britain and could not buy English graphite.',
      rubric: '两分：写出「法国与英国交战」给 1 分；写出「因此买不到英国石墨」再给 1 分。',
    },
    {
      kind: 'short',
      marks: 1,
      stem: 'What do the letters H and B on a pencil stand for?',
      answer: 'H stands for hard and B stands for black.',
      evidence: 'This is the origin of the letters still printed on pencils today: H for hard and B for black.',
      rubric: '一分：H = hard，B = black，两个都答对才给分。',
    },
    {
      kind: 'short',
      marks: 2,
      stem: "What was the unexpected advantage of Conté's method?",
      answer:
        'The hardness of the core could be controlled, by changing how much clay was used — more clay made it harder, less made it softer.',
      evidence: 'By changing the amount of clay, Conté could make the core harder or softer.',
      rubric: '两分：写出「能调节笔芯的软硬」给 1 分；说明「靠改变黏土的多少来调」再给 1 分。',
    },
  ],
};

// ═══════════════════════════════════════════════════════════════
// 周二 —— 洗不坏的钱
// ═══════════════════════════════════════════════════════════════

const NOTES = {
  key: 'original-w3-polymer-notes',
  title: 'Money That Survives the Wash',
  passage: plain([
    'In 1988 Australia issued a ten-dollar note unlike any before it. It was printed not on paper but on a thin, flexible plastic film, and it had a small clear window that no photocopier or home printer could reproduce. The note was a response to a problem that had worried the country\'s central bank for years: forgery.',
    'Paper money, despite its name, is usually made from cotton fibre, and it wears out quickly. Notes of small value, which change hands many times a day, may last only a few years before they become too soft, torn or dirty to use. Polymer notes last two to three times longer. They can survive being left in a pocket and put through the washing machine, which paper notes generally cannot.',
    'The new material brought problems of its own. New polymer notes tended to stick together, which made them hard to count, and some people complained that they would not stay folded in a wallet. Machines that accepted paper notes, such as ticket machines, had to be adjusted.',
    'Nevertheless, the idea spread. More than thirty countries now use polymer for at least some of their notes. Singapore prints several of its notes on polymer, and Britain, which had printed money on cotton paper for more than three hundred years, began replacing its paper notes in 2016.',
    'Because polymer notes last longer, fewer need to be printed, which reduces the energy used and the waste produced. When they are finally taken out of use, they do not have to be burned or buried like old paper notes. Instead they can be shredded and recycled into plastic products such as plant pots.',
  ]),
  questions: [
    {
      kind: 'tfng',
      item: 'The first polymer note had a feature that ordinary printers could not copy.',
      answer: 'TRUE',
      evidence:
        'It was printed not on paper but on a thin, flexible plastic film, and it had a small clear window that no photocopier or home printer could reproduce.',
    },
    {
      kind: 'tfng',
      item: 'Paper money is normally made from wood.',
      answer: 'FALSE',
      evidence: 'Paper money, despite its name, is usually made from cotton fibre, and it wears out quickly.',
    },
    {
      kind: 'tfng',
      item: 'Each polymer note costs less to produce than a paper note.',
      answer: 'NOT GIVEN',
    },
    {
      kind: 'gapChoice',
      stem: 'Some people complained that polymer notes would not stay ______ in a wallet.',
      answer: 'folded',
      distractors: ['clean', 'flat', 'dry'],
      evidence:
        'New polymer notes tended to stick together, which made them hard to count, and some people complained that they would not stay folded in a wallet.',
    },
    {
      kind: 'gapChoice',
      stem: 'Britain began replacing its paper notes with polymer in ______.',
      answer: '2016',
      distractors: ['1988', '2006', '2012'],
      evidence:
        'Singapore prints several of its notes on polymer, and Britain, which had printed money on cotton paper for more than three hundred years, began replacing its paper notes in 2016.',
    },
    {
      kind: 'gapChoice',
      stem: 'Old polymer notes can be recycled into plastic products such as plant ______.',
      answer: 'pots',
      distractors: ['seeds', 'boxes', 'bags'],
      evidence: 'Instead they can be shredded and recycled into plastic products such as plant pots.',
    },
    {
      kind: 'gapTyped',
      summary: true,
      marks: 2,
      stem: 'Paper notes of small value wear out quickly because they ______.',
      answer: 'change hands many times a day',
      evidence:
        'Notes of small value, which change hands many times a day, may last only a few years before they become too soft, torn or dirty to use.',
      rubric: '两分：写出「一天要换很多次手」给 2 分；只写「用得多 / 常被使用」给 1 分。',
    },
    {
      kind: 'short',
      marks: 2,
      stem: 'What problem was the first polymer note designed to solve, and which feature helped to solve it?',
      answer: 'Forgery; the clear window, which photocopiers and home printers could not reproduce.',
      evidence: "The note was a response to a problem that had worried the country's central bank for years: forgery.",
      rubric: '两分：伪钞问题 1 分；透明小窗（复印机、家用打印机印不出来）1 分。',
    },
    {
      kind: 'short',
      marks: 1,
      stem: 'How much longer do polymer notes last than paper notes?',
      answer: 'Two to three times longer.',
      evidence: 'Polymer notes last two to three times longer.',
      rubric: '一分：答「两到三倍」即给分。',
    },
    {
      kind: 'short',
      marks: 2,
      stem: 'Give TWO ways in which polymer notes are better for the environment.',
      answer:
        'Fewer need to be printed, which saves energy and reduces waste; and old notes can be recycled instead of being burned or buried.',
      evidence: 'Because polymer notes last longer, fewer need to be printed, which reduces the energy used and the waste produced.',
      rubric: '两分：少印（省能源、少废料）、可以回收再利用（不用烧掉或填埋），每点 1 分。',
    },
  ],
};

const SPECS = [PENCIL, NOTES];

module.exports = {
  LEVEL,
  SPECS,
  DAYS: SPECS.map((spec, i) => buildAuthoredDay(spec, DATES[i])),
};
