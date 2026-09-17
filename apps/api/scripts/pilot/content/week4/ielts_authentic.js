/**
 * 第四周 —— **ielts_authentic（雅思真题难度）**档，全原创学术说明文。
 *
 * 六百词上下、八段、按 Paragraph A–H 编号。形状与第三周这一档一致：
 *   3 道段落信息配对 · 3 道判断（各一） · 2 道原文单词填空（要拼写） ·
 *   2 道两分主观题 —— 满分 12。
 *
 * 研究与数字只写能对上公开出处的（见每篇上方注释），拿不准的一律不写
 * 具体数字。文章是自己写的，研究结论用自己的话转述。
 * 选题前对过学生读过的文章：「间隔重复与遗忘曲线」「城市里的蜂」已经有了，避开。
 */

'use strict';

const { buildAuthoredDay, lettered } = require('../authored');
const { DATES } = require('./dates');

const LEVEL = 'ielts_authentic';

// ═══════════════════════════════════════════════════════════════
// 周一 —— 青霉素：被搁置的十二年
//
// 出处：Fleming 1929（Br J Exp Pathol，1928 年 9 月度假回来发现葡萄球菌平板被
// 霉菌污染）；此后十年多作为实验室里抑制杂菌的工具；Florey、Chain 1939 年在
// 牛津重启，Heatley 用牛奶桶、浴缸、便盆等土法培养提取；1940-05 八只小鼠实验；
// 1941-02 首位病人、警察 Albert Alexander，好转后药用完、从尿中回收，仍于数周后
// 去世；1941 年 Florey 赴美，Peoria 的政府实验室用玉米浸泡液提高产量、市场上
// 发霉的甜瓜提供高产菌株；1944-06 诺曼底登陆时已大量供应；1945 年诺贝尔奖授予
// Fleming、Florey、Chain，Heatley 未获；Fleming 诺奖演讲提醒滥用会产生耐药。
// ═══════════════════════════════════════════════════════════════

const PENICILLIN = {
  key: 'original-w4-penicillin',
  title: 'The Mould That Waited',
  passage: lettered([
    `The story of penicillin is usually told as a moment of luck: a scientist returns from holiday, notices mould on a forgotten dish, and changes medicine for ever. The moment was real, but it was followed by a delay of more than a decade, and the drug that eventually saved millions of lives owed as much to the people who ended that delay as to the man who made the first observation.`,
    `In September 1928, Alexander Fleming, a bacteriologist at St Mary's Hospital in London, came back from a summer break to find that one of his dishes of Staphylococcus bacteria had been contaminated by a mould. Around the mould was a clear ring where the bacteria had died. Fleming grew the mould, showed that a liquid it produced could kill a range of dangerous bacteria, and named the active substance penicillin. He published his findings in 1929.`,
    `What followed was mostly silence. Penicillin was difficult to extract and lost its strength quickly, and Fleming, who was not a chemist, could not produce it in a pure or stable form. Other researchers showed little interest. For the next decade Fleming used it mainly as a tool in the laboratory, to prevent unwanted bacteria from growing on his dishes.`,
    `The revival began in 1939 at the University of Oxford, where Howard Florey and Ernst Chain were searching for natural substances that killed bacteria. Chain came across Fleming's paper, and the team decided to try again. The practical breakthrough came from a third scientist, Norman Heatley, who designed ways to grow the mould and extract the drug using whatever equipment could be found in wartime Britain, including milk churns, bathtubs and hospital bedpans.`,
    `In May 1940, the team infected eight mice with deadly bacteria and treated four of them with penicillin. By the next morning the four untreated mice were dead, while the treated ones were still alive. The following February, the first human patient, a police officer named Albert Alexander, was given the drug for a severe infection. He improved remarkably within days, but the supply ran out, and although the team even recovered penicillin from his urine to use again, he died some weeks later.`,
    `The lesson was clear: the drug worked, but it could not yet be made in useful quantities. With Britain under attack, Florey travelled to the United States in 1941 to seek help. At a government laboratory in Peoria, Illinois, researchers found that growing the mould in a by-product of corn processing increased the yield many times over, and a mouldy melon from a local market provided a strain that produced far more of the drug than Fleming's.`,
    `American and British companies then expanded production at remarkable speed. By the time Allied forces landed in Normandy in June 1944, penicillin was available in large amounts for wounded soldiers. In 1945, Fleming, Florey and Chain shared the Nobel Prize in Physiology or Medicine. Heatley, whose methods had made the Oxford work possible, was not included.`,
    `Historians now tend to see penicillin less as a lucky accident than as a case study in how discoveries become useful. Fleming noticed something important, but noticing was not enough; it took chemistry, engineering, industrial capacity and a wartime sense of urgency to turn a ring on a dish into a medicine. Fleming himself, in his Nobel lecture, warned of a different problem that is still with us: bacteria can become resistant if the drug is used carelessly.`,
  ]),
  questions: [
    {
      kind: 'matchingParagraphs',
      items: [
        { item: 'a reason why the discoverer was unable to develop his own finding', letter: 'C' },
        { item: 'a warning that remains relevant today', letter: 'H' },
        { item: 'unusual equipment used to make the drug', letter: 'D' },
      ],
    },
    {
      kind: 'tfng',
      item: 'Albert Alexander made a full recovery after his treatment.',
      answer: 'FALSE',
      evidence:
        'He improved remarkably within days, but the supply ran out, and although the team even recovered penicillin from his urine to use again, he died some weeks later.',
    },
    {
      kind: 'tfng',
      item: 'Heatley was disappointed not to share the Nobel Prize.',
      answer: 'NOT GIVEN',
    },
    {
      kind: 'tfng',
      item: 'The mice that were given penicillin were still alive the next morning.',
      answer: 'TRUE',
      evidence: 'By the next morning the four untreated mice were dead, while the treated ones were still alive.',
    },
    {
      kind: 'gapTyped',
      stem: 'For about ten years, Fleming used penicillin mainly as a laboratory ______ to stop unwanted bacteria growing.',
      answer: 'tool',
      evidence: 'For the next decade Fleming used it mainly as a tool in the laboratory, to prevent unwanted bacteria from growing on his dishes.',
    },
    {
      kind: 'gapTyped',
      stem: 'In Peoria, growing the mould in a by-product of corn processing greatly increased the ______.',
      answer: 'yield',
      evidence:
        "At a government laboratory in Peoria, Illinois, researchers found that growing the mould in a by-product of corn processing increased the yield many times over, and a mouldy melon from a local market provided a strain that produced far more of the drug than Fleming's.",
    },
    {
      kind: 'short',
      marks: 2,
      stem: 'Using your own words, explain why the first treatment of a human patient in 1941 did not succeed.',
      answer:
        'The drug made the patient much better, showing that it worked, but there was not enough of it to finish the treatment, so the infection eventually killed him.',
      evidence:
        'He improved remarkably within days, but the supply ran out, and although the team even recovered penicillin from his urine to use again, he died some weeks later.',
      rubric:
        '两分：写出「病人用药后明显好转（说明药有效）」给 1 分；写出「药不够、用完了，他最终还是死了」再给 1 分。',
    },
    {
      kind: 'short',
      marks: 2,
      stem: 'According to the writer, why is it misleading to describe penicillin simply as a lucky accident?',
      answer:
        "Fleming's observation was only the starting point; turning it into a usable medicine took years of further work in chemistry, engineering and industry, much of it done by other people.",
      evidence:
        'Fleming noticed something important, but noticing was not enough; it took chemistry, engineering, industrial capacity and a wartime sense of urgency to turn a ring on a dish into a medicine.',
      rubric:
        '两分：写出「弗莱明的发现只是开端（之后搁置了十多年）」给 1 分；点明「真正变成药靠的是化学、工程、工业生产等后续努力，主要由别人完成」再给 1 分。只写「因为他去度假了」不给分。',
    },
  ],
};

// ═══════════════════════════════════════════════════════════════
// 周二 —— 香蕉的难题
//
// 出处：出口贸易里的香蕉几乎全是 Cavendish；栽培香蕉无籽、靠吸芽繁殖，植株
// 基因相同；20 世纪上半叶中美洲的 Gros Michel 毁于巴拿马病（尖孢镰刀菌引起的
// 枯萎病，土中存活数十年、药剂无法根除），业界弃地开荒，后改种对 1 号小种抗病的
// Cavendish；20 世纪后期亚洲出现 4 号热带小种（TR4），侵染 Cavendish，已传到
// 澳大利亚、中东、非洲，2019 年在哥伦比亚确认；靠土壤随靴子、工具、车辆、
// 灌溉水传播，农场设消毒池、清除病株、封锁病区；台湾香蕉研究所选出耐病的
// Cavendish 变异株（非完全抗病）；Dale 等 2017（Nat Commun）把野生蕉的抗病基因
// 转入 Cavendish，在病土田间试验中保持健康。
// ═══════════════════════════════════════════════════════════════

const BANANA = {
  key: 'original-w4-banana',
  title: 'The Banana Problem',
  passage: lettered([
    `The banana is one of the most traded fruits in the world, and almost every banana sold in international trade belongs to a single variety, the Cavendish. This uniformity is convenient for growers, shippers and supermarkets, which can rely on fruit that ripens, travels and looks the same wherever it is grown. It is also, many scientists argue, a serious risk.`,
    `The risk comes from the way bananas are grown. The wild ancestors of the banana are full of hard seeds, but the varieties that people eat have almost none. They cannot be grown from seed, so new plants are produced from shoots that grow at the base of existing ones. Every Cavendish plant is therefore, in effect, a copy of every other, with the same genes and the same weaknesses.`,
    `This has happened before. Until the middle of the twentieth century, the banana in most Western shops was a different variety, the Gros Michel, which many people who remember it describe as richer in flavour. Gros Michel plantations in Central America were destroyed by Panama disease, a wilt caused by a fungus that lives in the soil. Because every plant was genetically alike, a disease that could kill one could kill them all.`,
    `The fungus was impossible to remove. It can survive in soil for decades, and no chemical treatment reliably kills it. Growers responded by abandoning infected land and clearing new forest, but the disease followed them. Eventually the industry switched to the Cavendish, which was less popular with some customers but resistant to the form of the fungus that had destroyed the Gros Michel.`,
    `For several decades the switch appeared to have solved the problem. Then, in the late twentieth century, a new form of the fungus, known as Tropical Race 4, emerged in Asia. Unlike the earlier form, it attacks the Cavendish. It has since spread to Australia, the Middle East and Africa, and in 2019 it was confirmed in Colombia, bringing it to the Latin American countries that supply much of the world's export trade.`,
    `Because the fungus travels in soil, it can be carried on boots, tools and vehicles, and even in the water used on farms. Many plantations now require workers and visitors to disinfect their footwear, and infected plants are destroyed and the surrounding area closed off. These measures can slow the spread, but they cannot stop it entirely.`,
    `Scientists are pursuing several longer-term solutions. Breeders in Taiwan have selected Cavendish plants that tolerate the disease better, although they are not fully resistant. Researchers in Australia have added a gene from a wild banana to the Cavendish, producing plants that remained healthy in field trials on infected soil. Other teams are trying to breed entirely new varieties, a slow process when the plants being crossed produce so few seeds.`,
    `Many plant scientists believe that the real answer is not a single replacement but greater variety. Hundreds of kinds of banana are grown by small farmers around the world, and wild relatives in Southeast Asia contain genetic material that could help future crops resist disease. Relying on one clone, they argue, simply repeats the mistake that ended the Gros Michel.`,
  ]),
  questions: [
    {
      kind: 'matchingParagraphs',
      items: [
        { item: 'precautions that farm workers are asked to take', letter: 'F' },
        { item: 'an explanation of why all Cavendish plants share the same weaknesses', letter: 'B' },
        { item: 'the view that growing only one variety should be avoided', letter: 'H' },
      ],
    },
    {
      kind: 'tfng',
      item: 'Most banana farmers in Colombia have now stopped growing the Cavendish.',
      answer: 'NOT GIVEN',
    },
    {
      kind: 'tfng',
      item: 'Bananas grown for food are normally produced from shoots rather than seeds.',
      answer: 'TRUE',
      evidence: 'They cannot be grown from seed, so new plants are produced from shoots that grow at the base of existing ones.',
    },
    {
      kind: 'tfng',
      item: 'The Cavendish replaced the Gros Michel because customers preferred its taste.',
      answer: 'FALSE',
      evidence:
        'Eventually the industry switched to the Cavendish, which was less popular with some customers but resistant to the form of the fungus that had destroyed the Gros Michel.',
    },
    {
      kind: 'gapTyped',
      stem: 'Panama disease is a wilt caused by a ______ that lives in the soil.',
      answer: 'fungus',
      evidence: 'Gros Michel plantations in Central America were destroyed by Panama disease, a wilt caused by a fungus that lives in the soil.',
    },
    {
      kind: 'gapTyped',
      stem: 'Breeders in Taiwan have found Cavendish plants that ______ the disease better, although they are not fully resistant.',
      answer: 'tolerate',
      evidence: 'Breeders in Taiwan have selected Cavendish plants that tolerate the disease better, although they are not fully resistant.',
    },
    {
      kind: 'short',
      marks: 2,
      stem: 'Using your own words, explain why a single disease was able to destroy the Gros Michel plantations.',
      answer:
        'All the plants were genetic copies of one another, so none had any protection that the others lacked; a disease that could kill one plant could kill every plant.',
      evidence: 'Because every plant was genetically alike, a disease that could kill one could kill them all.',
      rubric:
        '两分：写出「所有植株基因相同（彼此是复制品）」给 1 分；点明「能害死一株的病就能害死全部，没有哪一株能幸免」再给 1 分。',
    },
    {
      kind: 'short',
      marks: 2,
      stem: 'According to Paragraph D, why did moving to new land fail to solve the problem for Gros Michel growers?',
      answer:
        'The fungus survives in the soil for decades and cannot be reliably killed with chemicals, and the disease reached the newly cleared land as well.',
      evidence: 'Growers responded by abandoning infected land and clearing new forest, but the disease followed them.',
      rubric:
        '两分：写出「真菌能在土里存活几十年、化学药剂杀不死」给 1 分；写出「新开垦的地也被病害追上了」再给 1 分。',
    },
  ],
};

// ═══════════════════════════════════════════════════════════════
// 周三 —— 邓巴数
//
// 出处：Dunbar 1992（J Hum Evol）灵长类新皮层比例与群体规模、推算人类约 150；
// 新石器农村、北美哈特派社区超过规模会分裂；Hill & Dunbar 2003（Hum Nat）
// 圣诞贺卡名单平均约 150；5/15/50/150 分层、每层约三倍；W. L. Gore 等企业按
// 150 人规划工厂；Dunbar 2016（R Soc Open Sci）社交媒体上可依靠的只有少数几人；
// Lindenfors 等 2021（Biol Lett，斯德哥尔摩大学）用新数据与多种统计方法重做，
// 估计值从个位数到数百人不等，认为推不出一个确定的数；Dunbar 撰文反驳其方法。
// ═══════════════════════════════════════════════════════════════

const DUNBAR = {
  key: 'original-w4-dunbar-number',
  title: 'A Limit on Friendship?',
  passage: lettered([
    `Most people have hundreds of names stored in their phones, yet few would claim to know all of those people well. In the early 1990s, the British anthropologist Robin Dunbar proposed that this gap is not only a matter of time or effort, but of biology: that the human brain can keep track of only a limited number of meaningful relationships, and that the limit is about 150.`,
    `Dunbar's argument began with monkeys and apes. Primates that live in larger groups tend to have a larger neocortex, the outer layer of the brain involved in complex thinking, relative to the rest of the brain. Dunbar suggested that the neocortex sets an upper limit on the number of individuals an animal can understand and keep track of socially. By placing humans on the same line that described other primates, he arrived at a predicted group size for our species of around 150.`,
    `He then looked for evidence in human societies, and found numbers of about this size appearing repeatedly. Many farming villages in the distant past seem to have held roughly this many people. Some religious farming communities in North America deliberately divide once they grow much beyond it. In one study, Dunbar and a colleague asked people to list everyone to whom they sent seasonal greeting cards, and the average size of these networks came close to 150.`,
    `Dunbar also argued that relationships are arranged in layers. At the centre are around five very close people, then about fifteen good friends, fifty friends and 150 meaningful contacts, with each layer roughly three times the size of the one inside it. Keeping someone in an inner layer, he suggested, requires regular time and attention, which is why the inner layers remain small.`,
    `The idea has been remarkably influential. Some companies have used it to decide how large a single workplace or department should be before it is divided, and it has been offered as an explanation of why online contacts do not simply become friends. A later study by Dunbar of social media users found that, although many had hundreds of online contacts, they felt they could depend on only a handful of them in a crisis.`,
    `Not everyone is convinced. In 2021, a team at Stockholm University repeated the kind of analysis Dunbar had used, with newer data on primate brains and a range of statistical methods. Their estimates for human group size varied enormously, from a handful of people to several hundred, and they concluded that the data could not support any single number.`,
    `Critics also point out that people differ greatly in how many relationships they maintain, and that culture, personality and circumstances all play a part. A figure that describes an average, they argue, may say little about any particular person.`,
    `Dunbar has rejected the Stockholm study, arguing that its methods were unsuitable for the question. The debate remains open. What is less disputed is the underlying observation that close relationships take time to maintain, and that time is limited. Whether the limit is exactly 150 may matter less than the reminder that no one can be close to everyone.`,
  ]),
  questions: [
    {
      kind: 'matchingParagraphs',
      items: [
        { item: 'an example of the theory being used by employers', letter: 'E' },
        { item: 'a description of how the original prediction was calculated', letter: 'B' },
        { item: 'a reason why an average may not describe individuals well', letter: 'G' },
      ],
    },
    {
      kind: 'tfng',
      item: 'According to Dunbar, each layer of relationships is roughly three times larger than the layer inside it.',
      answer: 'TRUE',
      evidence:
        'At the centre are around five very close people, then about fifteen good friends, fifty friends and 150 meaningful contacts, with each layer roughly three times the size of the one inside it.',
    },
    {
      kind: 'tfng',
      item: "Dunbar's greeting-card study was carried out in several different countries.",
      answer: 'NOT GIVEN',
    },
    {
      kind: 'tfng',
      item: 'The Stockholm researchers agreed that humans can maintain about 150 relationships.',
      answer: 'FALSE',
      evidence:
        'Their estimates for human group size varied enormously, from a handful of people to several hundred, and they concluded that the data could not support any single number.',
    },
    {
      kind: 'gapTyped',
      stem: "Dunbar's theory is based on the size of the ______, the outer layer of the brain.",
      answer: 'neocortex',
      evidence:
        'Primates that live in larger groups tend to have a larger neocortex, the outer layer of the brain involved in complex thinking, relative to the rest of the brain.',
    },
    {
      kind: 'gapTyped',
      stem: 'Some religious farming communities in North America ______ once they grow much larger than 150 people.',
      answer: 'divide',
      evidence: 'Some religious farming communities in North America deliberately divide once they grow much beyond it.',
    },
    {
      kind: 'short',
      marks: 2,
      stem: 'Using your own words, explain how Dunbar used other primates to predict the size of human groups.',
      answer:
        'He found that primates with a relatively larger neocortex live in larger groups, and then applied the same pattern to the human brain to estimate a human group size of about 150.',
      evidence:
        'By placing humans on the same line that described other primates, he arrived at a predicted group size for our species of around 150.',
      rubric:
        '两分：写出「灵长类里新皮层相对越大，群体就越大」给 1 分；写出「把人类放进同一规律里，推算出约 150 人」再给 1 分。',
    },
    {
      kind: 'short',
      marks: 2,
      stem: 'What did the study of social media users suggest about online contacts?',
      answer:
        'Although people had hundreds of online contacts, they could rely on only a few of them in a crisis, so having many contacts does not mean having many close friends.',
      evidence:
        'A later study by Dunbar of social media users found that, although many had hundreds of online contacts, they felt they could depend on only a handful of them in a crisis.',
      rubric:
        '两分：写出「很多人网上联系人有几百个」给 1 分；写出「真正遇到困难时能依靠的只有少数几个（联系人多不等于朋友多）」再给 1 分。',
    },
  ],
};

// ═══════════════════════════════════════════════════════════════
// 周四 —— 明说的安慰剂
//
// 出处：Beecher 1955（JAMA，"The Powerful Placebo"，约三分之一患者好转）；
// Hróbjartsson & Gøtzsche 2001（NEJM，丹麦团队比较安慰剂与不治疗，总体未见大的
// 效果，疼痛与自评症状可能有小幅获益）；Kaptchuk 等 2010（PLoS ONE，80 名肠易激
// 综合征患者，一组不治疗，另一组服用标明「安慰剂」的药丸并被如实告知，三周后
// 自评改善明显更多）；此后慢性腰痛等开放标签研究结果相近；医患互动本身影响
// 感受（Kaptchuk 2008）。
// ═══════════════════════════════════════════════════════════════

const PLACEBO = {
  key: 'original-w4-open-label-placebo',
  title: 'The Pill With Nothing in It',
  passage: lettered([
    `Doctors have long known that patients sometimes feel better after taking a treatment that contains no active ingredient. Such a treatment, usually a sugar pill, is called a placebo, and in modern medicine it has a very practical role: when a new drug is tested, it is compared with a placebo, so that researchers can tell how much of any improvement is caused by the drug itself.`,
    `Interest in the placebo as a force in its own right grew after 1955, when the American anaesthetist Henry Beecher published an influential paper suggesting that roughly a third of patients improved when given a placebo. For decades the figure was quoted as evidence that the mind could produce powerful physical effects.`,
    `Later researchers were more cautious. Many illnesses improve naturally with time, and patients are often recruited into studies when their symptoms are at their worst, so some improvement would have happened anyway. When a Danish team in 2001 compared patients given placebos with patients given no treatment at all, they found little evidence of large effects in general, although there did appear to be modest benefits for pain and for symptoms that patients report themselves.`,
    `Even where placebos help, using them outside research raises an ethical problem. It has usually been assumed that a placebo works only if the patient believes it is a real medicine, which would mean that a doctor must mislead the patient. Most medical codes regard such deception as unacceptable.`,
    `In 2010, a team led by Ted Kaptchuk at Harvard tested that assumption directly. They recruited 80 people with irritable bowel syndrome, a painful long-term condition of the gut. One group received no treatment. The other was given pills in a bottle clearly labelled as a placebo, and its members were told honestly that the pills contained no medicine, although similar pills had helped other patients in studies. After three weeks, the group taking the openly described placebo reported significantly greater improvement.`,
    `Later studies of this "open-label" approach, including trials on long-term back pain, have reported similar findings. Researchers suggest several reasons. Expectation may still play a part, even when the patient knows the truth. The routine of taking a pill each day may itself be reassuring. And the attention of a sympathetic clinician, which comes with the treatment, is known to affect how patients feel.`,
    `The findings have clear limits. The studies are mostly small, and because the patients know which group they are in, their reports of how they feel may be influenced by what they hope to find. Placebos also appear to act mainly on symptoms such as pain or tiredness; there is no good evidence that they can shrink a tumour or cure an infection.`,
    `Nevertheless, open-label placebos have changed a long-standing question. If a pill can help some patients even when they know it contains nothing, the benefit may lie less in deception than in the experience of being cared for, a possibility that some researchers believe medicine should take more seriously.`,
  ]),
  questions: [
    {
      kind: 'matchingParagraphs',
      items: [
        { item: 'several suggested reasons why honest placebos might work', letter: 'F' },
        { item: 'the natural course of an illness as another explanation for improvement', letter: 'C' },
        { item: 'kinds of illness that placebos do not appear to affect', letter: 'G' },
      ],
    },
    {
      kind: 'tfng',
      item: 'The patients in the 2010 study were told that their pills contained medicine.',
      answer: 'FALSE',
      evidence:
        'The other was given pills in a bottle clearly labelled as a placebo, and its members were told honestly that the pills contained no medicine, although similar pills had helped other patients in studies.',
    },
    {
      kind: 'tfng',
      item: 'In drug trials, placebos help researchers measure the real effect of a new medicine.',
      answer: 'TRUE',
      evidence:
        'Such a treatment, usually a sugar pill, is called a placebo, and in modern medicine it has a very practical role: when a new drug is tested, it is compared with a placebo, so that researchers can tell how much of any improvement is caused by the drug itself.',
    },
    {
      kind: 'tfng',
      item: "Kaptchuk's team later repeated the 2010 study with a larger group of patients.",
      answer: 'NOT GIVEN',
    },
    {
      kind: 'gapTyped',
      stem: 'Most medical codes regard the ______ of patients as unacceptable.',
      answer: 'deception',
      evidence: 'Most medical codes regard such deception as unacceptable.',
    },
    {
      kind: 'gapTyped',
      stem: 'In the 2010 study, the pills were given in a bottle clearly ______ as a placebo.',
      answer: 'labelled',
      evidence:
        'The other was given pills in a bottle clearly labelled as a placebo, and its members were told honestly that the pills contained no medicine, although similar pills had helped other patients in studies.',
      rubric: '一分：只认原文里的 “labelled”（大小写不计；美式拼法 labeled 也给分）。同义词不给分 —— 题目要求用原文的词。',
    },
    {
      kind: 'short',
      marks: 2,
      stem: 'Using your own words, explain why using placebos outside research has been seen as an ethical problem.',
      answer:
        'It was assumed that a placebo only works if the patient thinks it is a real medicine, so a doctor would have to lie to the patient, which medical rules do not allow.',
      evidence:
        'It has usually been assumed that a placebo works only if the patient believes it is a real medicine, which would mean that a doctor must mislead the patient.',
      rubric:
        '两分：写出「过去认为只有病人相信是真药，安慰剂才起作用」给 1 分；点明「这就意味着医生得骗病人，而医疗准则不允许欺骗」再给 1 分。',
    },
    {
      kind: 'short',
      marks: 2,
      stem: 'Give TWO reasons why the results of open-label placebo studies should be treated with caution.',
      answer:
        'The studies are mostly small, and the patients know which group they are in, so their reports may be affected by their hopes; the pills also seem to act mainly on symptoms rather than on the illness itself.',
      evidence:
        'The studies are mostly small, and because the patients know which group they are in, their reports of how they feel may be influenced by what they hope to find.',
      rubric:
        '两分：以下任意两点各 1 分：研究大多规模很小；病人知道自己在哪一组，自我报告可能受期望影响；安慰剂主要作用于疼痛、疲劳等症状，治不了肿瘤、感染。',
    },
  ],
};

// ═══════════════════════════════════════════════════════════════
// 周五 —— 以蚊治蚊
//
// 出处：登革热主要由埃及伊蚊传播；新加坡 2020 年暴发规模为历年最大；沃尔巴克氏体
// 存在于许多昆虫体内，埃及伊蚊天然不带；带菌雄蚊与不带菌雌蚊交配，卵不能孵化
// （细胞质不亲和）；新加坡国家环境局（NEA）Project Wolbachia 自 2016 年起在部分
// 组屋区投放带菌雄蚊，雄蚊不叮人；须只放雄蚊，否则细菌在野生种群扎根后投放失效，
// 部分项目加低剂量辐射使漏网雌蚊不育；投放区蚊子与病例明显下降，但须每周持续投放。
// World Mosquito Program 投放雌雄两性、让细菌在种群中扩散，病毒在带菌蚊体内难以
// 复制；Utarini 等 2021（NEJM，印尼日惹整群随机试验）有症状登革热约减少 77%，
// 住院减少更多；细菌扎根后可自我维持。
// ═══════════════════════════════════════════════════════════════

const WOLBACHIA = {
  key: 'original-w4-wolbachia',
  title: 'Mosquitoes Against Mosquitoes',
  passage: lettered([
    `Dengue fever infects millions of people every year, and in Singapore it is a familiar threat: 2020 brought the largest outbreak the country had recorded. The virus is carried from person to person mainly by one species of mosquito, Aedes aegypti, which breeds in small amounts of standing water around homes. For decades the main response has been to remove breeding sites and to spray insecticides. In recent years, however, scientists have begun to fight the mosquito with a surprising partner: a bacterium called Wolbachia.`,
    `Wolbachia lives inside the cells of many insect species, including some butterflies, flies and other mosquitoes, but it is not normally found in Aedes aegypti. Researchers learned to introduce it into this mosquito in the laboratory, and discovered that it has two effects that can be used against dengue.`,
    `The first concerns reproduction. When a male mosquito carrying Wolbachia mates with a female that does not carry it, her eggs do not hatch. Singapore's National Environment Agency has based its programme on this effect. Since 2016 it has released large numbers of male mosquitoes carrying Wolbachia in selected housing estates. Male mosquitoes do not bite, so the releases pose no direct risk to residents, and the wild females that mate with them lay eggs that come to nothing.`,
    `The approach depends on releasing males only. If females carrying the bacterium escaped as well, Wolbachia could become established in the wild population, and future releases would stop working. Separating the sexes accurately, among millions of insects, is therefore one of the programme's biggest technical challenges, and some projects add a low dose of radiation so that any females that slip through cannot breed.`,
    `In the areas where releases have taken place, the results have been encouraging, with sharp falls in both mosquito numbers and dengue cases. The method has a practical cost, though: because the released males leave no lasting population, they must be released week after week, in very large numbers, for the effect to continue.`,
    `The second effect of Wolbachia leads to a different strategy. In mosquitoes that carry the bacterium, the dengue virus has much more difficulty multiplying, so the insects are far less likely to pass it on. The World Mosquito Program, an international research group, therefore releases both male and female mosquitoes carrying Wolbachia, with the aim of making the bacterium spread through the local population until most mosquitoes carry it.`,
    `The strongest evidence for this approach comes from the Indonesian city of Yogyakarta, which was divided into areas that did or did not receive Wolbachia mosquitoes. In a trial published in 2021, the treated areas had about 77 per cent fewer cases of dengue that caused symptoms, and an even larger reduction in hospital admissions. Once established, the bacterium maintains itself, so releases can eventually stop.`,
    `Neither method removes the need for ordinary prevention, and each suits different situations. Reducing the mosquito population can bring quick relief in a crowded city but requires continuous effort, while replacing the population is slower to establish but may then last on its own. Together, they suggest that one of the best tools against a dangerous insect may be the insect itself.`,
  ]),
  questions: [
    {
      kind: 'matchingParagraphs',
      items: [
        { item: 'a comparison of the strengths and weaknesses of two approaches', letter: 'H' },
        { item: 'a mistake that could make one method stop working', letter: 'D' },
        { item: 'a reason why one method needs constant effort', letter: 'E' },
      ],
    },
    {
      kind: 'tfng',
      item: 'Singapore plans to release mosquitoes in every housing estate by 2030.',
      answer: 'NOT GIVEN',
    },
    {
      kind: 'tfng',
      item: 'Aedes aegypti mosquitoes naturally carry Wolbachia.',
      answer: 'FALSE',
      evidence:
        'Wolbachia lives inside the cells of many insect species, including some butterflies, flies and other mosquitoes, but it is not normally found in Aedes aegypti.',
    },
    {
      kind: 'tfng',
      item: 'Male mosquitoes are not a direct danger to people because they do not bite.',
      answer: 'TRUE',
      evidence: 'Male mosquitoes do not bite, so the releases pose no direct risk to residents, and the wild females that mate with them lay eggs that come to nothing.',
    },
    {
      kind: 'gapTyped',
      stem: 'When a male carrying Wolbachia mates with a female that does not carry it, her eggs do not ______.',
      answer: 'hatch',
      evidence: 'When a male mosquito carrying Wolbachia mates with a female that does not carry it, her eggs do not hatch.',
    },
    {
      kind: 'gapTyped',
      stem: 'In the Yogyakarta trial, the treated areas also saw an even larger reduction in hospital ______.',
      answer: 'admissions',
      evidence:
        'In a trial published in 2021, the treated areas had about 77 per cent fewer cases of dengue that caused symptoms, and an even larger reduction in hospital admissions.',
    },
    {
      kind: 'short',
      marks: 2,
      stem: 'Using your own words, explain how releasing male mosquitoes reduces the number of mosquitoes.',
      answer:
        'Wild females that mate with the released males produce eggs that do not hatch, so fewer new mosquitoes are born and the population gets smaller.',
      evidence:
        'Male mosquitoes do not bite, so the releases pose no direct risk to residents, and the wild females that mate with them lay eggs that come to nothing.',
      rubric:
        '两分：写出「野生雌蚊与放出的雄蚊交配后，卵孵不出来」给 1 分；点明「新生的蚊子越来越少，蚊子总数因此下降」再给 1 分。',
    },
    {
      kind: 'short',
      marks: 2,
      stem: 'How do the two strategies differ in how long the releases must continue?',
      answer:
        'Releasing only males has to be repeated every week because it leaves no lasting population, whereas releasing both sexes can stop once Wolbachia has spread, because the bacterium then maintains itself.',
      evidence: 'Once established, the bacterium maintains itself, so releases can eventually stop.',
      rubric:
        '两分：写出「只放雄蚊的方法要每周不停地放」给 1 分；写出「雌雄都放的方法在细菌扩散开后能自我维持，可以停止投放」再给 1 分。',
    },
  ],
};

const SPECS = [PENICILLIN, BANANA, DUNBAR, PLACEBO, WOLBACHIA];

module.exports = {
  LEVEL,
  SPECS,
  DAYS: SPECS.map((spec, i) => buildAuthoredDay(spec, DATES[i])),
};
