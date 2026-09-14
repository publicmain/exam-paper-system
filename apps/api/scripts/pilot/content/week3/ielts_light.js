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

// ═══════════════════════════════════════════════════════════════
// 周三 —— 靠「什么都没有」保温的瓶子
//
// 核实来源：
//   · 1892 年、James Dewar（苏格兰科学家）、在伦敦 Royal Institution、为装极低温
//     液化气体而造；两层玻璃瓶套在一起、瓶颈处封接、中间抽成（部分）真空；后来加
//     镀银层反射辐射热、瓶颈做窄 —— Royal Institution 藏品页
//     rigb.org/explore-science/explore/collection/james-dewars-vacuum-flask；
//   · 真空挡住传导和对流、镀银挡辐射、热量主要从瓶颈和开口（没有真空处）散失；
//     材料有金属 / 玻璃等 —— Wikipedia「Vacuum flask」；
//   · Dewar 从未申请专利；1904 年两位德国玻璃匠（Burger、Aschenbrenner）做成
//     家用保温瓶、外加金属保护壳 —— Irish Times「Design Moment: Thermos vacuum
//     flask, 1892」、Wikipedia「Vacuum flask」、Royal Institution 藏品页。
//   不写品牌名；「几小时后还是热的」只作一般描述，不给具体时长。
// ═══════════════════════════════════════════════════════════════

const FLASK = {
  key: 'original-w3-vacuum-flask',
  title: 'A Bottle Built Around Nothing',
  passage: plain([
    'Pour hot soup into an ordinary bottle and it soon cools down. Pour the same soup into a vacuum flask, and it can still be hot hours later. The flask produces no heat of its own. Its secret is a layer of almost nothing: a narrow gap from which nearly all the air has been removed.',
    "The flask was invented in 1892 by James Dewar, a Scottish scientist working at the Royal Institution in London. Dewar was not trying to keep anyone's lunch warm. He was studying gases that become liquids only at extremely low temperatures, and he needed a container that would stop them from warming up and boiling away.",
    'His design placed one glass bottle inside another, with the two joined only at the neck. Heat normally moves in three ways. Conduction and convection both need particles of matter to carry the heat, so the empty gap between the walls blocks them almost completely. The third way, radiation, can cross empty space, so the glass was later given a thin silver coating that reflects this heat back.',
    'The same design works in both directions. It keeps the heat of a hot drink in, and it keeps the heat of the outside world away from a cold one. Its weak point is the top, where there is no vacuum in the neck or the stopper. This is where most heat is lost, which is why a narrow neck helps.',
    'Dewar never took out a patent on his flask. In 1904 two German glassblowers saw that the idea could be useful outside the laboratory, and they began selling flasks for drinks, protected by a metal case. Many modern flasks contain no glass at all, but they still depend on the same empty gap.',
  ]),
  questions: [
    {
      kind: 'tfng',
      item: 'Dewar first built the flask so that substances in his research would not heat up.',
      answer: 'TRUE',
      evidence:
        'He was studying gases that become liquids only at extremely low temperatures, and he needed a container that would stop them from warming up and boiling away.',
    },
    {
      kind: 'tfng',
      item: 'The empty gap in a flask stops radiation just as well as it stops conduction.',
      answer: 'FALSE',
      evidence:
        'The third way, radiation, can cross empty space, so the glass was later given a thin silver coating that reflects this heat back.',
    },
    {
      kind: 'tfng',
      item: 'Flasks made entirely of metal keep drinks hot for less time than glass ones.',
      answer: 'NOT GIVEN',
    },
    {
      kind: 'gapChoice',
      stem: "In Dewar's design, the inner and outer bottles were connected only at the ______.",
      answer: 'neck',
      distractors: ['base', 'side', 'middle'],
      evidence: 'His design placed one glass bottle inside another, with the two joined only at the neck.',
    },
    {
      kind: 'gapChoice',
      stem: 'To send radiated heat back, the glass was later covered with a thin layer of ______.',
      answer: 'silver',
      distractors: ['wax', 'paint', 'steel'],
      evidence:
        'The third way, radiation, can cross empty space, so the glass was later given a thin silver coating that reflects this heat back.',
    },
    {
      kind: 'gapChoice',
      stem: 'The flasks that the two glassblowers sold had an outer ______ case for protection.',
      answer: 'metal',
      distractors: ['glass', 'leather', 'plastic'],
      evidence:
        'In 1904 two German glassblowers saw that the idea could be useful outside the laboratory, and they began selling flasks for drinks, protected by a metal case.',
    },
    {
      kind: 'gapTyped',
      summary: true,
      marks: 2,
      stem: 'Most heat escapes through the top of a flask because in that part ______.',
      answer: 'there is no vacuum',
      evidence: 'Its weak point is the top, where there is no vacuum in the neck or the stopper.',
      rubric: '两分：写出「那里（瓶颈和塞子处）没有真空」给 2 分；只写「那里不隔热 / 保温差」而没说出没有真空，给 1 分。',
    },
    {
      kind: 'short',
      marks: 2,
      stem: 'Explain why the gap between the two walls stops heat moving by conduction and convection.',
      answer:
        'Both conduction and convection need particles of matter to carry heat, and the gap has almost none because nearly all the air has been removed.',
      evidence:
        'Conduction and convection both need particles of matter to carry the heat, so the empty gap between the walls blocks them almost completely.',
      rubric: '两分：写出「传导和对流都要靠物质微粒来传热」给 1 分；写出「夹层几乎是空的（空气差不多抽光了）」再给 1 分。',
    },
    {
      kind: 'short',
      marks: 1,
      stem: 'What did Dewar never do with his invention?',
      answer: 'He never took out a patent on it.',
      evidence: 'Dewar never took out a patent on his flask.',
      rubric: '一分：答出「没有申请专利」即给分。',
    },
    {
      kind: 'short',
      marks: 2,
      stem: 'How can the same flask keep a hot drink hot and a cold drink cold?',
      answer:
        'It stops the heat of a hot drink from getting out, and it stops heat from the outside world from getting in to a cold drink.',
      evidence:
        'It keeps the heat of a hot drink in, and it keeps the heat of the outside world away from a cold one.',
      rubric: '两分：热饮——里面的热量散不出去，1 分；冷饮——外面的热量进不来，1 分。不要求解释真空或镀银的原理。',
    },
  ],
};

// ═══════════════════════════════════════════════════════════════
// 周四 —— 没有火的「烫」
//
// 核实来源：
//   · 辣椒原产美洲，16 世纪大概由葡萄牙、西班牙商人带到亚洲 —— Wikipedia
//     「Chili pepper」（History 一节）；
//   · 辣椒素（capsaicin）激活神经上感受有害高温的受体 TRPV1，约 43 °C 以上被
//     激活；David Julius 用辣椒素找到这个受体（Caterina … Julius, Nature 1997），
//     2021 年与 Patapoutian 分享诺贝尔生理学或医学奖 —— UCSF 新闻稿
//     「David Julius Wins Nobel Prize for Work on Pain Sensation」、nobelprize.org
//     2021 新闻稿、Nature 389:816（1997）；
//   · 种子本身不产生辣椒素，含量最高的是连着种子的白色胎座组织；辣椒素极难溶于
//     水；鸟类 TRPV1 对辣椒素没反应 —— Wikipedia「Capsaicin」、Jordt & Julius,
//     Cell 2002；
//   · 全脂牛奶解辣明显优于水，脂肪和蛋白质都起作用 —— Penn State 新闻
//     （2024-01-31，Food Quality and Preference）；
//   · 1912 年美国药剂师 Wilbur Scoville：辣椒提取物用糖水反复稀释，直到品尝小组
//     多数人尝不出辣，稀释倍数越高分越高；1980 年代起改用高效液相色谱（仪器），
//     结果可换算成 Scoville 单位 —— Wikipedia「Scoville scale」「Wilbur Scoville」；
//   · 野生辣椒：小型哺乳动物（仙人掌鼠、林鼠）回避，经哺乳动物消化道的种子发芽率
//     下降；鸟不受影响、传播种子且不损伤发芽 —— Tewksbury & Nabhan, Nature 412:403
//     （2001）。
//   「吃多了会不怕辣」确有研究，但文中不写 —— 那是 NOT GIVEN 题。
// ═══════════════════════════════════════════════════════════════

const CHILLI = {
  key: 'original-w3-chilli-burn',
  title: 'A Burn Without a Flame',
  passage: plain([
    'Chillies first grew in the Americas and were probably carried to Asia by Portuguese and Spanish traders in the sixteenth century. Yet the burning feeling they cause is a kind of trick, because nothing in a chilli is actually hot. The trick is played by a chemical called capsaicin.',
    'Nerve cells in the mouth carry a sensor that normally warns the body about dangerous heat. It is switched on by temperatures above about 43 degrees Celsius, the point at which heat starts to hurt. Capsaicin switches on the same sensor, so the brain reacts as if the mouth were being burned. In the late 1990s the American scientist David Julius used capsaicin to identify this sensor, work that later won him a Nobel Prize.',
    'The seeds do not produce capsaicin; the highest amounts are found in the white tissue to which the seeds are attached. The chemical also dissolves very poorly in water, which is why a glass of water does little to stop the burning. Milk works better, and research suggests that both its fat and its proteins help.',
    'In 1912 an American pharmacist, Wilbur Scoville, invented a way of measuring this heat. Chilli extract was mixed with sugar water again and again until most of a panel of tasters could no longer feel any burning. The more the extract had to be diluted, the higher its score. Since the 1980s, laboratories have measured the chemical with machines, but the results can still be converted into Scoville units.',
    'Why would a plant make such an unpleasant chemical? Small mammals such as mice avoid the fruit, and seeds that pass through their bodies are less likely to grow. Birds, on the other hand, cannot feel capsaicin at all. They eat the fruit and spread the seeds unharmed. The burn, it seems, keeps away the animals that the plant does not need.',
  ]),
  questions: [
    {
      kind: 'tfng',
      item: 'The white tissue inside a chilli contains more capsaicin than its seeds do.',
      answer: 'TRUE',
      evidence: 'The seeds do not produce capsaicin; the highest amounts are found in the white tissue to which the seeds are attached.',
    },
    {
      kind: 'tfng',
      item: 'Water is one of the most effective drinks for calming the burning feeling.',
      answer: 'FALSE',
      evidence:
        'The chemical also dissolves very poorly in water, which is why a glass of water does little to stop the burning.',
    },
    {
      kind: 'tfng',
      item: 'People who eat chillies often become less sensitive to the burning over time.',
      answer: 'NOT GIVEN',
    },
    {
      kind: 'gapChoice',
      stem: "The mouth's heat sensor is triggered once something becomes hot enough to ______.",
      answer: 'hurt',
      distractors: ['sting', 'spread', 'rise'],
      evidence: 'It is switched on by temperatures above about 43 degrees Celsius, the point at which heat starts to hurt.',
    },
    {
      kind: 'gapChoice',
      stem: 'According to research, milk calms the burning better than water thanks to its fat and its ______.',
      answer: 'proteins',
      distractors: ['sugars', 'vitamins', 'minerals'],
      evidence: 'Milk works better, and research suggests that both its fat and its proteins help.',
    },
    {
      kind: 'gapChoice',
      stem: 'For several decades, laboratories have relied on ______ to measure capsaicin.',
      answer: 'machines',
      distractors: ['tasters', 'doctors', 'farmers'],
      evidence:
        'Since the 1980s, laboratories have measured the chemical with machines, but the results can still be converted into Scoville units.',
    },
    {
      kind: 'gapTyped',
      summary: true,
      marks: 2,
      stem: 'Capsaicin fools the brain by activating a sensor in the mouth which, in ordinary situations, ______.',
      answer: 'warns the body about dangerous heat',
      evidence: 'Nerve cells in the mouth carry a sensor that normally warns the body about dangerous heat.',
      rubric: '两分：写出「提醒身体注意危险的高温」给 2 分；只写「感觉到热 / 感知温度」，没有「危险、发出警告」的意思，给 1 分。',
    },
    {
      kind: 'short',
      marks: 2,
      stem: "How did Scoville's test decide how hot a chilli was?",
      answer:
        'The chilli extract was diluted with sugar water again and again until most tasters felt no burning; the more it had to be diluted, the higher the score.',
      evidence: 'The more the extract had to be diluted, the higher its score.',
      rubric: '两分：写出「用糖水一遍遍稀释，直到大多数品尝者尝不出辣」给 1 分；写出「要稀释得越多，分数越高」再给 1 分。',
    },
    {
      kind: 'short',
      marks: 1,
      stem: 'What did David Julius use capsaicin to do?',
      answer: 'He used it to identify the heat sensor on nerve cells in the mouth.',
      evidence:
        'In the late 1990s the American scientist David Julius used capsaicin to identify this sensor, work that later won him a Nobel Prize.',
      rubric: '一分：答出「找到 / 识别出（神经细胞上）感受危险高温的那个感受器」即给分。',
    },
    {
      kind: 'short',
      marks: 2,
      stem: 'How does capsaicin help the chilli plant?',
      answer:
        'It keeps away small mammals such as mice, which make the seeds less likely to grow, while birds cannot feel it, so they eat the fruit and spread the seeds unharmed.',
      evidence: 'Birds, on the other hand, cannot feel capsaicin at all.',
      rubric: '两分：写出「赶走老鼠等小型哺乳动物（经它们消化的种子不容易发芽）」给 1 分；写出「鸟感觉不到辣，会吃果子并把种子完好地传播出去」再给 1 分。',
    },
  ],
};

// ═══════════════════════════════════════════════════════════════
// 周五 —— 写字楼旁的水獭
//
// 核实来源：
//   · 新加坡的水獭到 1970 年代已消失 —— Malay Mail 2026-02-18 水獭普查报道
//     （NUS N Sivasothi 主持）；原因是水道污染、岸线退化，清理水道后重新出现，
//     平时主要吃鱼，会经过公园、住宅区走陆路 —— NParks 动物及兽医服务署（AVS）
//     水獭页 avs.nparks.gov.sg/wildlife/encountering-wildlife/otters/；
//   · 1977 年定下十年目标：让新加坡河与加冷河干净到可以钓鱼；迁走污染源、建排污
//     设施，工程大体在 1977–1987 年完成 —— NLB Infopedia「Clean-up of Singapore
//     River and Kallang Basin」；
//   · 1998 年平滑毛皮水獭在西北部重新出现，多半是从柔佛海峡（马来西亚一侧）游过
//     来；2017 年普查至少 79 只、11 群；2021 年约 170 只、17 群，每群 2–24 只；
//     2015 年圣淘沙（Sentosa Cove）锦鲤池被吃空；家族之间打斗（2020 Bishan 与
//     Marina 两群）；被咬事件 —— Wikipedia「Otters in Singapore」（引 Khoo 2020、
//     Shivram et al. 2023 Journal of Mammalogy 等）、National Geographic「Cheeky
//     otters are thriving in Singapore」、Mothership 2026-01 NParks 报道（至少 170 只、
//     17 群）；
//   · 给 NParks 的水獭相关反馈：2020 年 208 条 → 2022 年前 11 个月约 450 条，多数是
//     目击报告 —— Mothership 2026-01 引 NParks；
//   · 公众守则（远观、宠物牵绳拉紧、不摸不追不喂、不大声、不开闪光灯）与「喂野生
//     动物违法（Wildlife Act）」—— NParks AVS 水獭页。
//   迁移、绝育等管理措施涉及政策讨论，文中不写。
// ═══════════════════════════════════════════════════════════════

const OTTERS = {
  key: 'original-w3-city-otters',
  title: 'Otters Among the Office Towers',
  passage: plain([
    'By the 1970s, wild otters had disappeared from Singapore. Its rivers were badly polluted, and the shores where the animals once hunted had been damaged. Today, families of smooth-coated otters swim past the office towers of Marina Bay, rest beside canals and even cross housing estates.',
    'Their return began with a clean-up. In 1977 Singapore set itself a ten-year goal: to make the Singapore River and the Kallang River clean enough for people to fish in. Businesses that had dumped waste into the water were moved away, and proper sewers were built. The work was largely finished by 1987. In 1998, otters were seen again in the north-west of the island, probably after swimming across from Malaysia.',
    "Since then, the otters have spread along the island's reservoirs, canals and coasts. A count in 2017 found at least 79 otters. By 2021 there were about 170, living in 17 family groups. Some groups are just a pair, while the largest have more than twenty members. Neighbouring groups sometimes fight over territory.",
    'Living so close to people causes problems. Smooth-coated otters feed mainly on fish, and they will also take fish from private ponds. In 2015, homeowners on Sentosa found that otters had emptied their koi ponds. A few people have been bitten, and otters with young can be especially protective. Reports about otters sent to the National Parks Board more than doubled between 2020 and 2022, although most simply described sightings.',
    'The National Parks Board advises people to watch otters from a distance and to keep pets on a tight leash. People should not touch, chase or feed the animals, and should avoid talking loudly or using flash photography. Feeding any wildlife is, in fact, against the law. Followed carefully, these simple rules allow a crowded city to share its waterways with wild neighbours.',
  ]),
  questions: [
    {
      kind: 'tfng',
      item: 'The majority of the otter reports sent to the National Parks Board only mentioned that otters had been seen.',
      answer: 'TRUE',
      evidence:
        'Reports about otters sent to the National Parks Board more than doubled between 2020 and 2022, although most simply described sightings.',
    },
    {
      kind: 'tfng',
      item: 'The otter family groups in Singapore are all of a similar size.',
      answer: 'FALSE',
      evidence: 'Some groups are just a pair, while the largest have more than twenty members.',
    },
    {
      kind: 'tfng',
      item: 'Singapore now has more otters than it did before its rivers became polluted.',
      answer: 'NOT GIVEN',
    },
    {
      kind: 'gapChoice',
      stem: 'As part of the clean-up, polluting businesses were relocated and new ______ were put in.',
      answer: 'sewers',
      distractors: ['canals', 'bridges', 'fences'],
      evidence: 'Businesses that had dumped waste into the water were moved away, and proper sewers were built.',
    },
    {
      kind: 'gapChoice',
      stem: 'Otter groups that live near each other occasionally have fights about ______.',
      answer: 'territory',
      distractors: ['food', 'shelter', 'pups'],
      evidence: 'Neighbouring groups sometimes fight over territory.',
    },
    {
      kind: 'gapChoice',
      stem: 'In 2015, otters cleared out the ______ ponds of some homeowners on Sentosa.',
      answer: 'koi',
      distractors: ['lotus', 'duck', 'frog'],
      evidence: 'In 2015, homeowners on Sentosa found that otters had emptied their koi ponds.',
    },
    {
      kind: 'gapTyped',
      summary: true,
      marks: 2,
      stem: 'The otters spotted in 1998 had most likely reached the island by ______.',
      answer: 'swimming across from Malaysia',
      evidence:
        'In 1998, otters were seen again in the north-west of the island, probably after swimming across from Malaysia.',
      rubric: '两分：写出「从马来西亚游过来」给 2 分；只写「游过来 / 自己回来的」而没提马来西亚，给 1 分。',
    },
    {
      kind: 'short',
      marks: 2,
      stem: 'What TWO problems had made Singapore unsuitable for otters by the 1970s?',
      answer: 'Its rivers were badly polluted, and the shores where otters hunted had been damaged.',
      evidence:
        'Its rivers were badly polluted, and the shores where the animals once hunted had been damaged.',
      rubric: '两分：河流污染严重 1 分；水獭捕食的岸边遭到破坏 1 分。',
    },
    {
      kind: 'short',
      marks: 1,
      stem: 'Roughly how many otters were living in Singapore in 2021?',
      answer: 'About 170.',
      evidence: 'By 2021 there were about 170, living in 17 family groups.',
      rubric: '一分：答「约 170 只」即给分；写成 17（那是家族群数）不给分。',
    },
    {
      kind: 'short',
      marks: 2,
      stem: 'Give TWO pieces of advice that the National Parks Board gives to people who see otters.',
      answer:
        'Any two of: watch them from a distance; keep pets on a tight leash; do not touch, chase or feed them; do not talk loudly or use flash photography.',
      evidence:
        'The National Parks Board advises people to watch otters from a distance and to keep pets on a tight leash.',
      rubric: '两分：以下任意两点，每点 1 分（不摸、不追、不喂各算一点；写「喂野生动物违法」按「不喂」算）：远距离观看；宠物牵绳拉紧；不摸；不追；不喂；不大声说话；不用闪光灯。',
    },
  ],
};

const SPECS = [PENCIL, NOTES, FLASK, CHILLI, OTTERS];

module.exports = {
  LEVEL,
  SPECS,
  DAYS: SPECS.map((spec, i) => buildAuthoredDay(spec, DATES[i])),
};
