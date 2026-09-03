/**
 * 首发周 —— **ielts_authentic（雅思 · 真题型）**档。
 *
 * 周一周二改编自库里两篇没发到过学生手上的学术阅读；周三到周五原创，
 * 因为这一档的库存只剩那两篇。
 *
 * 原创三篇刻意都带一个「主流说法后来被质疑」的转折 —— 判断题要出得有
 * 意义，文章里就必须有可以判 FALSE 的断言和真正没写过的空白，否则
 * NOT GIVEN 只能靠编。
 *
 * 篇幅、段落编号（A–H）、题型配比都对齐库里的形状，走同一个
 * `from-ielts.js` 适配器。
 */

'use strict';

const { DATES } = require('./adapters');
const { buildDay } = require('./from-ielts');

const LEVEL = 'ielts_authentic';

const P = (...paras) => paras.map((p, i) => `Paragraph ${String.fromCharCode(65 + i)}\n${p}`).join('\n\n');

const TFNG_INSTRUCTION =
  'Do the following statements agree with the information given in the passage? Write TRUE, FALSE or NOT GIVEN.';
const MATCH_INSTRUCTION = 'Which paragraph contains the following information?';
const GAP_INSTRUCTION = 'Complete the sentence. Choose ONE WORD ONLY from the passage.';

// ═══════════════════════════════════════════════════════════════
// 原创 1 —— The Root Network
// ═══════════════════════════════════════════════════════════════

const ROOTS = {
  key: 'original-root-network',
  passageTitle: 'The Root Network',
  passage: P(
    'A teaspoon of forest soil can contain several kilometres of fungal thread. Most of it belongs to fungi that are not breaking anything down. They are attached to living roots, and the relationship is old: fossils place it earlier than roots themselves, and something like nine in ten land plants form it today. The name given to the structure, mycorrhiza, simply joins the Greek words for fungus and root.',
    'The arrangement is a trade. Fungal threads are far finer than the finest root hair, so they reach water and phosphorus held in pores a root cannot enter, and they pass a share of it to the plant. In return the plant hands over sugars it has made by photosynthesis — by some estimates as much as a fifth of everything it fixes. Neither partner can sensibly be described as being in charge.',
    'In the 1990s the picture became more interesting. Experiments using carbon labelled with a rare isotope showed that carbon could move out of one tree, through the fungal threads it shared with a neighbour, and into that neighbour. In a Canadian forest, birch and fir were found to exchange carbon in both directions, and the net flow ran towards whichever of the two was more heavily shaded at the time.',
    'Popular accounts turned this into the wood wide web: a forest as a cooperative community in which old trees feed seedlings and warn their neighbours of insect attack. The phrase spread further and faster than the evidence behind it, and for about twenty years it was repeated with very little scrutiny.',
    'The scrutiny, when it came, was uncomfortable. A review of the field found that only a minority of the published experiments had checked whether the transferred carbon ended up in the receiving plant at all, rather than remaining inside the fungus wrapped around its root. Several widely cited claims — that mature trees preferentially supply their own offspring, for instance — rested on a small number of studies in a small number of forests.',
    'There is a second difficulty. The fungus is not a wire. It is an organism with interests of its own, and under some conditions it behaves less like a partner than like a tenant that does not pay. Seedlings connected to certain networks grow more slowly than unconnected ones, which is hard to reconcile with a picture of the network as a distribution system run for the benefit of trees.',
    'What is not disputed is the scale. Plants worldwide route an enormous quantity of recently fixed carbon underground into these fungi every year, and a substantial part of the carbon held in forest soils arrives by that route rather than by leaves falling. Whatever the network is doing, it is doing it with a significant fraction of a forest’s annual production.',
    'The practical questions are about management rather than metaphor. Clear-felling removes not only mature trees but the established networks attached to them, and replanted seedlings may take years to reconnect; commercial nurseries now sell seedlings pre-inoculated with fungi for that reason. The open question is not whether the partnership matters. It is how much of the story told about it in the last two decades will survive being tested properly.',
  ),
  questions: [
    { n: 1, taskType: 'matching_information', instruction: MATCH_INSTRUCTION, item: 'a reason why the popular account was accepted for so long without checking', answer: 'D', marks: 1 },
    { n: 2, taskType: 'matching_information', instruction: MATCH_INSTRUCTION, item: 'evidence that the fungus does not always benefit the plant', answer: 'F', marks: 1 },
    { n: 3, taskType: 'matching_information', instruction: MATCH_INSTRUCTION, item: 'a change in forestry practice that follows from the research', answer: 'H', marks: 1 },
    { n: 4, taskType: 'true_false_not_given', instruction: TFNG_INSTRUCTION, item: 'The carbon measured in the 1990s experiments moved in one direction only.', answer: 'FALSE', marks: 1 },
    { n: 5, taskType: 'true_false_not_given', instruction: TFNG_INSTRUCTION, item: 'Most published experiments confirmed that transferred carbon reached the receiving plant’s own tissues.', answer: 'FALSE', marks: 1 },
    { n: 6, taskType: 'true_false_not_given', instruction: TFNG_INSTRUCTION, item: 'Pre-inoculated seedlings grow faster than seedlings inoculated after planting.', answer: 'NOT GIVEN', marks: 1 },
    { n: 7, taskType: 'sentence_completion', instruction: GAP_INSTRUCTION, item: 'The fungal threads reach water and ______ that lie in pores too small for a root.', answer: 'phosphorus', marks: 1 },
    { n: 8, taskType: 'sentence_completion', instruction: GAP_INSTRUCTION, item: 'In the Canadian forest the net flow of carbon ran towards whichever tree was more heavily ______.', answer: 'shaded', marks: 1 },
  ],
};

// ═══════════════════════════════════════════════════════════════
// 原创 2 —— Cement That Heals
// ═══════════════════════════════════════════════════════════════

const CEMENT = {
  key: 'original-cement-that-heals',
  passageTitle: 'Cement That Heals',
  passage: P(
    'Concrete is the most heavily used manufactured material on earth, and making the cement that binds it accounts for a large share of all industrial carbon emissions. It is also, in its modern form, surprisingly short-lived. A reinforced concrete structure is typically designed to last fifty years, and many do not reach that age in good condition.',
    'This is awkward, because some Roman concrete has lasted two thousand. Harbour works at Baiae and elsewhere have stood in seawater since the first century and are in places stronger now than when they were built. Seawater destroys modern marine concrete; the Roman version appears to have been improved by it.',
    'Part of the explanation has been known for a long time. The Romans mixed lime with volcanic ash, and the reaction between them produces minerals that are stable in salt water. But that chemistry does not by itself explain the survival of structures that must, over twenty centuries, have cracked.',
    'A study published in 2023 offered an answer that had been in plain sight. Roman samples are full of small white lumps of lime, which for a century were read as evidence of careless mixing. The researchers argued the opposite: that the lumps are deliberate, produced by mixing the lime while it was still hot, and that they act as a reservoir. When water penetrates a crack it dissolves lime from the nearest lump and redeposits it in the gap, sealing it.',
    'They tested the claim directly. Samples made by the hot-mixing method were deliberately cracked and then had water run through them. Within two weeks the water stopped passing; identical samples made without the lime lumps continued to leak for the length of the experiment.',
    'Modern engineers have pursued the same goal by a different route. One approach seals dormant bacteria and a food source into capsules within the mix. A crack breaks the capsules and admits water; the bacteria revive, consume the food and precipitate calcium carbonate, which closes the gap. Laboratory samples have sealed cracks up to about half a millimetre wide.',
    'The limitations are real. Bacterial concrete costs substantially more than ordinary mixes; healing works only on cracks below a certain width; and what is restored is chiefly watertightness rather than strength. That last point is less damaging than it sounds, because the usual way a reinforced structure fails is not that the concrete gives way but that water and salt reach the steel inside it and the steel corrodes.',
    'Whether any of this reaches ordinary construction is a question about incentives rather than chemistry. The party that pays for the concrete is rarely the party that pays to maintain it forty years later, and a material that is cheaper over a century but dearer on the day is a difficult thing to sell. Several national codes are being revised to allow durability, rather than initial strength alone, to be counted in design.',
  ),
  questions: [
    { n: 1, taskType: 'matching_information', instruction: MATCH_INSTRUCTION, item: 'an explanation of why restoring watertightness matters more than restoring strength', answer: 'G', marks: 1 },
    { n: 2, taskType: 'matching_information', instruction: MATCH_INSTRUCTION, item: 'a description of a feature that was misread by earlier researchers', answer: 'D', marks: 1 },
    { n: 3, taskType: 'matching_information', instruction: MATCH_INSTRUCTION, item: 'a reason why a better material may still not be adopted', answer: 'H', marks: 1 },
    { n: 4, taskType: 'true_false_not_given', instruction: TFNG_INSTRUCTION, item: 'Seawater damages Roman marine concrete in the same way it damages modern concrete.', answer: 'FALSE', marks: 1 },
    { n: 5, taskType: 'true_false_not_given', instruction: TFNG_INSTRUCTION, item: 'The 2023 researchers tested their explanation experimentally rather than only by inspection.', answer: 'TRUE', marks: 1 },
    { n: 6, taskType: 'true_false_not_given', instruction: TFNG_INSTRUCTION, item: 'Bacterial concrete has now been used in a completed bridge.', answer: 'NOT GIVEN', marks: 1 },
    { n: 7, taskType: 'sentence_completion', instruction: GAP_INSTRUCTION, item: 'The Romans combined lime with volcanic ______ to make minerals that survive in salt water.', answer: 'ash', marks: 1 },
    { n: 8, taskType: 'sentence_completion', instruction: GAP_INSTRUCTION, item: 'In bacterial concrete a crack breaks the ______ and lets water reach the dormant bacteria.', answer: 'capsules', marks: 1 },
  ],
};

// ═══════════════════════════════════════════════════════════════
// 原创 3 —— The Horse Before the Wheel
// ═══════════════════════════════════════════════════════════════

const HORSE = {
  key: 'original-horse-before-wheel',
  passageTitle: 'The Horse Before the Wheel',
  passage: P(
    'Almost every horse alive today, from a racing thoroughbred to a farm pony, belongs to a single domestic lineage. Working out where and when that lineage began has taken archaeologists the better part of a century, and the answer has changed twice in the last twenty years.',
    'The first line of evidence was physical. A bit held in a horse’s mouth wears a distinctive bevel on particular teeth, and the wear survives in buried skeletons. In the 1990s such wear was reported from Botai in northern Kazakhstan, at a site more than five thousand years old, together with pottery carrying traces of mare’s milk. The case for Botai as the birthplace of the domestic horse looked strong.',
    'Genetics dismantled it. A study published in 2018 sequenced Botai horses and found that they were not the ancestors of modern domestic horses at all. They were instead the ancestors of Przewalski’s horse, an animal that had spent the twentieth century being described as the last truly wild horse. The wild horse turned out to be feral: descended from an early domestication that left no lasting line.',
    'That left the question open until 2021, when a large survey of ancient genomes located the source of the modern lineage in the steppe between the lower Volga and the Don, at around four thousand two hundred years ago. Before that date the region held several genetically distinct horse populations. Within a few centuries afterwards, one of them had replaced almost all the others across Eurasia.',
    'Two genetic changes stand out in that lineage. One affects a gene associated in other animals with reduced anxiety and greater tolerance of handling. The other is linked to the strength of the back. A calmer horse that can carry weight is a more useful animal than a nervous one that cannot, and both traits appear to have been under strong selection at exactly the moment the lineage began to spread.',
    'Speed of spread is the striking part. The replacement of local horse populations across thousands of kilometres took perhaps three hundred years. It coincides closely with the appearance of the spoked wheel and the light chariot, and the most economical reading is that the animal and the vehicle spread together as a single technology rather than one following the other.',
    'What that technology altered was distance. A messenger on foot covers perhaps forty kilometres in a day; mounted, several times that. Distances that had defined the limits of an administration or an army stopped defining them. Historians of the second millennium BCE tend to treat the horse less as a means of transport than as a change in the size of the political unit that was possible.',
    'The caution that applies to all of this is about sampling. Ancient DNA survives unevenly, and the regions that have yielded most of it are those where the climate is cold and the archaeology well funded. A population that has not been sampled cannot be ruled out, and the 2021 result is best read as the strongest current account rather than a closed case.',
  ),
  questions: [
    { n: 1, taskType: 'matching_information', instruction: MATCH_INSTRUCTION, item: 'a warning that the current conclusion may be incomplete', answer: 'H', marks: 1 },
    { n: 2, taskType: 'matching_information', instruction: MATCH_INSTRUCTION, item: 'a description of physical evidence left on bone', answer: 'B', marks: 1 },
    { n: 3, taskType: 'matching_information', instruction: MATCH_INSTRUCTION, item: 'an argument that two innovations spread as one', answer: 'F', marks: 1 },
    { n: 4, taskType: 'true_false_not_given', instruction: TFNG_INSTRUCTION, item: 'Przewalski’s horse had never been domesticated at any point in its history.', answer: 'FALSE', marks: 1 },
    { n: 5, taskType: 'true_false_not_given', instruction: TFNG_INSTRUCTION, item: 'Several genetically distinct horse populations existed in the region before the modern lineage spread.', answer: 'TRUE', marks: 1 },
    { n: 6, taskType: 'true_false_not_given', instruction: TFNG_INSTRUCTION, item: 'The Botai people rode their horses as well as milking them.', answer: 'NOT GIVEN', marks: 1 },
    { n: 7, taskType: 'sentence_completion', instruction: GAP_INSTRUCTION, item: 'A ______ held in a horse’s mouth leaves distinctive wear on particular teeth.', answer: 'bit', marks: 1 },
    { n: 8, taskType: 'sentence_completion', instruction: GAP_INSTRUCTION, item: 'One of the two genetic changes is linked to the strength of the horse’s ______.', answer: 'back', marks: 1 },
  ],
};

// ═══════════════════════════════════════════════════════════════
// 五天
// ═══════════════════════════════════════════════════════════════

const SPECS = [
  {
    source: 'p06-tea-trade.json',
    dir: 'ielts-authored-aug2026',
    matching: [2, 3, 4],
    tfng: [
      { n: 5, evidence: 'Most of those plants died anyway.' },
      { n: 6, evidence: 'It emerged besides that a variety already growing wild in Assam, long dismissed by British botanists as inferior, was better suited to the Indian climate than the Chinese plant.' },
      { n: 8, evidence: '' },
    ],
    completion: [9, 11],
    shortAnswers: [
      {
        stem: 'Using your own words, explain why tea spread to working people in Britain as well as to the wealthy.',
        answer: 'It was made with boiled water, which made it safer than most other drinks, and it was taken with sugar, which was a cheap source of calories for people working long hours.',
        evidence:
          'Tea is made with boiled water, which made it safer than much of what was otherwise drunk, and it was taken with sugar, which supplied calories cheaply to people working long hours.',
        rubric: '两分：安全（开水）与热量（加糖）两点各 1 分。只答「好喝」或「流行」不给分 —— 原文明确说 “not only taste”。',
      },
      {
        stem: 'Explain why the plants Robert Fortune shipped were not, on their own, enough to establish the Indian industry.',
        answer: 'Most of the plants died, and what actually made Indian tea work was the eighty Chinese growers he also brought, who knew the processing, together with the Assam variety that suited the climate.',
        evidence:
          'What made Indian tea viable was something Fortune also brought: eighty experienced Chinese growers and manufacturers, who understood the processing that turns a leaf into tea.',
        rubric: '两分：指出「大部分植株死了」给 1 分；指出真正起作用的是带去的中国技工（或阿萨姆变种）再给 1 分。',
      },
    ],
  },
  {
    source: 'test2-passage1.json',
    dir: 'ielts-adapted-2026-v5',
    matching: [2, 3, 4],
    tfng: [
      {
        n: 5,
        evidence:
          'It has to be measured during quiescence, over long unglamorous stretches when the instruments record nothing remarkable, so that when a change does occur there is something to compare it against.',
      },
      {
        n: 6,
        evidence: 'This tells a planning authority what kind of event to prepare for, but nothing whatever about when.',
      },
      { n: 8, evidence: '' },
    ],
    completion: [9, 10],
    shortAnswers: [
      {
        stem: 'Using your own words, explain why a volcano’s background level of activity cannot be worked out once unrest has begun.',
        answer: 'The background level describes what the volcano does when nothing is happening, so it has to be recorded over long quiet periods; once unrest starts there is no undisturbed record left to compare the new readings against.',
        evidence:
          'That phrase carries the whole difficulty: a background level is not something that can be established after the unrest begins.',
        rubric: '两分：指出必须在平静期长期测量给 1 分，说明骚动开始后就没有可比的基准再给 1 分。',
      },
      {
        stem: 'Explain the comparison the writer draws in the final paragraph between forecasting a volcano and forecasting an illness.',
        answer: 'Like an illness, the signs can be read with growing confidence as the event nears, but neither yields a precise date — unlike an eclipse, which can be calculated exactly.',
        evidence:
          'Forecasting a volcano is closer to forecasting an illness than to forecasting an eclipse: the signs can be read with growing confidence as the event approaches, and the date is not among the things they give you.',
        rubric: '两分：写出「越接近越有把握」给 1 分，点明「仍给不出确切日期 / 不像日食可精确推算」再给 1 分。',
      },
    ],
  },
  {
    key: 'original-root-network',
    inline: ROOTS,
    matching: [1, 2, 3],
    tfng: [
      { n: 4, evidence: 'In a Canadian forest, birch and fir were found to exchange carbon in both directions, and the net flow ran towards whichever of the two was more heavily shaded at the time.' },
      { n: 5, evidence: 'A review of the field found that only a minority of the published experiments had checked whether the transferred carbon ended up in the receiving plant at all, rather than remaining inside the fungus wrapped around its root.' },
      { n: 6, evidence: '' },
    ],
    completion: [7, 8],
    shortAnswers: [
      {
        stem: 'Using your own words, explain what each partner gives to the other in this relationship.',
        answer: 'The fungus reaches water and phosphorus in pores too small for roots and passes some to the plant; the plant gives back sugars it has made by photosynthesis.',
        evidence:
          'Fungal threads are far finer than the finest root hair, so they reach water and phosphorus held in pores a root cannot enter, and they pass a share of it to the plant. In return the plant hands over sugars it has made by photosynthesis — by some estimates as much as a fifth of everything it fixes.',
        rubric: '两分：真菌给水与磷、植物给糖，两个方向各 1 分。只写「互相帮助」不给分。',
      },
      {
        stem: 'Explain why the behaviour described in Paragraph F is difficult to reconcile with the popular account.',
        answer: 'Seedlings joined to some networks grow more slowly than unconnected ones, which does not fit a picture of the network as a distribution system run for the trees’ benefit.',
        evidence:
          'Seedlings connected to certain networks grow more slowly than unconnected ones, which is hard to reconcile with a picture of the network as a distribution system run for the benefit of trees.',
        rubric: '两分：写出「连上网络的幼苗反而长得更慢」给 1 分，点明这与「网络为树服务」的说法矛盾再给 1 分。',
      },
    ],
  },
  {
    key: 'original-cement-that-heals',
    inline: CEMENT,
    matching: [1, 2, 3],
    tfng: [
      { n: 4, evidence: 'Seawater destroys modern marine concrete; the Roman version appears to have been improved by it.' },
      { n: 5, evidence: 'Samples made by the hot-mixing method were deliberately cracked and then had water run through them.' },
      { n: 6, evidence: '' },
    ],
    completion: [7, 8],
    shortAnswers: [
      {
        stem: 'Using your own words, explain how the lime lumps are said to repair a crack.',
        answer: 'Water entering a crack dissolves lime from the nearest lump and lays it down again inside the gap, which closes the crack.',
        evidence:
          'When water penetrates a crack it dissolves lime from the nearest lump and redeposits it in the gap, sealing it.',
        rubric: '两分：水溶解石灰给 1 分，石灰在裂缝中重新结晶封住裂缝再给 1 分。',
      },
      {
        stem: 'Explain why the writer says that healing only watertightness is ‘less damaging than it sounds’.',
        answer: 'Reinforced structures usually fail because water and salt reach the steel inside and corrode it, not because the concrete itself gives way, so keeping water out addresses the real cause.',
        evidence:
          'That last point is less damaging than it sounds, because the usual way a reinforced structure fails is not that the concrete gives way but that water and salt reach the steel inside it and the steel corrodes.',
        rubric: '两分：指出真正的失效原因是内部钢筋锈蚀给 1 分，说明挡住水就挡住了这个原因再给 1 分。',
      },
    ],
  },
  {
    key: 'original-horse-before-wheel',
    inline: HORSE,
    matching: [1, 2, 3],
    tfng: [
      { n: 4, evidence: 'The wild horse turned out to be feral: descended from an early domestication that left no lasting line.' },
      { n: 5, evidence: 'Before that date the region held several genetically distinct horse populations.' },
      { n: 6, evidence: '' },
    ],
    completion: [7, 8],
    shortAnswers: [
      {
        stem: 'Using your own words, explain why the two genetic changes would have made a horse more useful.',
        answer: 'One made the animal calmer and easier to handle and the other strengthened its back, so it could be managed and could carry weight — a nervous horse that cannot carry loads is of little use.',
        evidence:
          'A calmer horse that can carry weight is a more useful animal than a nervous one that cannot, and both traits appear to have been under strong selection at exactly the moment the lineage began to spread.',
        rubric: '两分：性情温顺易驾驭、背部更能负重，两点各 1 分。',
      },
      {
        stem: 'Explain the writer’s reason for calling the 2021 result ‘the strongest current account rather than a closed case’.',
        answer: 'Ancient DNA survives unevenly and has been collected mainly where the climate is cold and archaeology is well funded, so an unsampled population cannot be ruled out.',
        evidence:
          'Ancient DNA survives unevenly, and the regions that have yielded most of it are those where the climate is cold and the archaeology well funded.',
        rubric: '两分：古 DNA 保存与采样不均给 1 分，因此不能排除尚未取样的种群再给 1 分。',
      },
    ],
  },
];

module.exports = {
  LEVEL,
  SPECS,
  DAYS: SPECS.map((spec, i) => buildDay(spec, DATES[i])),
};
