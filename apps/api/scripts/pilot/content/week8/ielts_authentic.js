/**
 * 第八周 —— **ielts_authentic（雅思真题难度）**档，全原创学术说明文。
 *
 * 六百词上下、八段、按 Paragraph A–H 编号。形状与第七周这一档一致：
 *   3 道段落信息配对 · 3 道判断 · 2 道原文单词填空（要拼写） ·
 *   2 道两分主观题 —— 满分 12。
 *
 * 本周选题（按主编分配的五个领域各一篇；括号里是徽章主题）：
 *   周一 history    亚马孙并不是「没人住过的原始森林」（The Forest That Was Lived In）
 *                   —— 奥雷利亚纳 1541–42 年沿河而下、随行修士记下两岸人烟稠密，后人当夸张；
 *                      Meggers 1971 年「虚假的天堂」说（土壤贫瘠养不活大社会）；人造黑土、
 *                      巴西西部伐林后露出的几何土垣、激光雷达在玻利维亚（Casarabe）与厄瓜多尔
 *                      （Upano 河谷）测出的平台、堤道；能推广到整个亚马孙多远，学界仍在讨论。
 *   周二 learning   测试效应 / 提取练习（The Test That Teaches）
 *                   —— Gates 1917、Spitzer 1939 的早期研究；Roediger & Karpicke 2006（五分钟后
 *                      重读略好、一周后反转 56% 对 42%；重读组更自信却记得最少）；Bjork「合意的
 *                      困难」；学生最常用重读、Dunlosky 2013 评级；Karpicke & Blunt 2011 胜过概念图；
 *                      反馈的作用、多选题的负面测试效应（Roediger & Marsh 2005）之争（10-14 查重后改，避开旧文 spaced repetition 的「复杂材料」论点）。
 *   周三 technology 锂离子电池的发展与代价（The Battery in Every Pocket）
 *                   —— 锂最轻、易失电子但活泼；Whittingham（Exxon、二硫化钛、锂金属枝晶短路起火）
 *                      → Goodenough 1980 钴酸锂约 4 伏 → 吉野彰 1985 碳负极 → 索尼 1991 → 2019
 *                      诺贝尔奖；价格十年降约九成；盐湖蒸发提锂与缺水之争、刚果（金）手工钴矿与童工、
 *                      热失控、回收难；磷酸铁锂等改进。
 *   周四 nature     昆虫在减少吗、减得多快（Where Have the Insects Gone?）
 *                   —— 「挡风玻璃现象」不算证据；昆虫的生态作用；Krefeld 业余昆虫学会 27 年数据
 *                      （2017：63 处保护区、季节总重降约 76%、盛夏约 82%，天气与植被解释不了）；
 *                      2019 年综述「40%」被批检索词有偏；2020 年 166 项调查：陆地约每十年降 9%、
 *                      淡水昆虫反而增加；数据缺口与「基线已移」；主要原因已知、可以行动。
 *   周五 culture    没有「左右」的语言（A World Without Left and Right）
 *                   —— Guugu Yimithirr 用东南西北描述一切位置（kangaroo 一词即出自这门语言）；
 *                      Levinson 指远方、Haviland 观察手势；转桌摆动物实验（荷兰语 vs 泽套语）；
 *                      Kuuk Thaayorre 按东→西排时间图片；Li & Gleitman 2002 质疑与 Levinson 回应；
 *                      语言与环境 / 文化难以分开；心理学被试多来自西方工业社会的提醒。
 *
 * 判断题按周看分布：T/F/NG · F/T/T · F/NG/T · NG/F/NG · NG/T/F →
 * TRUE 5 · FALSE 5 · NOT GIVEN 5；只有三天（周一、周三、周五）是各一道，
 * NOT GIVEN 不总在最后（周一在最后，周三在中间，周四在头尾，周五在最前）。
 *
 * 研究与数字只写能对上公开出处、自己有把握的（见每篇上方注释，标了把握程度），
 * 拿不准的一律不写具体数字。文章是自己写的，研究结论用自己的话转述；有争议的地方
 * 写成学界有分歧，题目不考争议本身的对错。本周写作环境不许上网，所有事实都按
 * 已有知识核对，注释里「高」= 公认、多处出处一致；「中高」= 有把握但细节可能有出入，
 * 正文已写得更含糊。
 *
 * 查重：对过内容包 1–7 周 175 篇标题、学生在旧题库读过的 383 篇标题，以及前七周本档
 * 全部题目；关键词（Amazon / lidar / terra preta / Orellana / retrieval practice /
 * testing effect / Roediger / Karpicke / lithium / cobalt / insect decline / Krefeld /
 * Guugu Yimithirr / Tzeltal / Boroditsky）在内容包与 test-fixtures 里也搜过，无重合。
 * 需要说明的四处相近：
 *   · 旧题库有「The architecture of memory: how spaced repetition works」（Ebbinghaus
 *     遗忘曲线、SuperMemo、间隔效应的几种解释）。周二讲的是「提取 / 测试本身」，
 *     不写遗忘曲线、不写间隔，选题说明里主编也点名可以写测试效应。
 *   · 第七周周四 Rapa Nui 也是「旧说法被新证据改写」。周一亚马孙讲的是「原始森林 /
 *     土壤养不活大社会」被土壤、土垣、激光雷达推翻，不讲社会崩溃；欧洲人带来的疾病
 *     只在 B 段一句带过、不出题。
 *   · 旧题库有太平洋航海（Finding the Way Without Instruments，讲星象、涌浪导航）。
 *     周五讲的是语言怎样描述空间、是否影响思维，不讲航海技术。
 *   · 同周 ielts_light 周五写了斯特鲁普效应（颜色词），所以本档周五没有选颜色词，
 *     改写空间语言，避免同周撞题。
 */

'use strict';

const { buildAuthoredDay, lettered } = require('../authored');
const { DATES } = require('./dates');

const LEVEL = 'ielts_authentic';

// ═══════════════════════════════════════════════════════════════
// 周一 —— 有人住过的森林：亚马孙考古改写「原始荒野」说（history）
// 徽章主题：history
//
// 出处与把握：
// · Francisco de Orellana 1541–1542 年第一次由欧洲人沿亚马孙河全程顺流而下；随行
//   多明我会修士 Gaspar de Carvajal 的记述写两岸人烟稠密、村落连绵；后来的欧洲人
//   见到的人少得多，他的记述长期被当成夸张 —— 高（Charles Mann《1491》等多处转述）。
//   「欧洲人带来的疾病可能先一步造成人口锐减」写成「仍有争论的一种解释」—— 高。
// · Betty Meggers（美国考古学家，史密森学会）1971 年的书称亚马孙是「counterfeit
//   paradise」：雨水淋洗使多数土壤贫瘠，农业养不活大规模定居人口 —— 高。正文不写书名
//   （书名里的 Man / Paradise 等大写词会进词表）。
// · 亚马孙「黑土」（Amazonian dark earth，葡语 terra preta）：含木炭、陶片、食物残渣，
//   是人在住处附近长期堆积、低温焚烧形成的，至今比周围土壤肥沃 —— 高。正文不写葡语词。
// · 巴西西部（阿克里州）伐林放牧后露出数以百计的几何形土垣（圆形、方形壕沟），
//   不少直径一百米以上；有的约两千年 —— 中高（正文写「Some are thought to be around
//   2,000 years old」）。Watling et al. 2017（PNAS）用土壤里的植硅体判断修建者没有
//   大面积清除森林，而是逐步改造、棕榈增多 —— 中高。正文不写州名 Acre（会撞 acre）。
// · 激光雷达原理（飞行器发射激光脉冲、部分穿过树叶缝隙、按回波时间测地表）—— 高。
// · Prümers et al. 2022（Nature）：玻利维亚亚马孙 Casarabe 文化，约公元 500–1400 年，
//   平台、锥形土丘、蓄水池、笔直的高出地面的堤道延伸数公里 —— 高。
// · Rostain et al. 2024（Science）：厄瓜多尔东部 Upano 河谷，激光雷达测出 6,000 多座
//   土台、相连的道路，约公元前 500 年起有人定居 —— 中高（正文写「around 2,500 years ago」）。
// · 远离大河的一些地区土壤钻芯几乎不见耕作、焚烧痕迹（McMichael et al. 2012 等）；
//   1492 年前人口估计差别很大 —— 高。正文写成学界分歧，不归给具体某人。
// ═══════════════════════════════════════════════════════════════

const AMAZON = {
  key: 'original-w8-amazon-earthworks',
  title: 'The Forest That Was Lived In',
  passage: lettered([
    `For much of the twentieth century, the Amazon rainforest was widely regarded as a wilderness shaped almost entirely by nature. According to this view, its peoples had always lived in small, mobile groups that left little lasting mark on the land. Over the past few decades, however, discoveries by archaeologists and soil scientists, and most recently by laser surveys from the air, have challenged this picture. Many researchers now argue that parts of the forest were once home to large, settled societies that changed their surroundings in ways that can still be detected today.`,
    `The earliest European account in fact suggested something quite different. In 1541 and 1542, the Spanish explorer Francisco de Orellana led the first European journey down the length of the river, and a friar who travelled with him, Gaspar de Carvajal, described banks crowded with people and settlements that seemed to continue for many miles. Later visitors, however, found far fewer inhabitants, and for centuries Carvajal's description was dismissed as an exaggeration. One possible explanation, still debated, is that diseases brought by Europeans killed much of the population before most outsiders arrived to record it.`,
    `In the second half of the twentieth century, an influential theory seemed to explain why large societies could never have existed there. In a book published in 1971, the American archaeologist Betty Meggers argued that the lush appearance of the forest was misleading. Most of its soils are poor, because heavy rain washes nutrients out of them, and Meggers concluded that farming could not have supported large, permanent populations. The Amazon, in her phrase, was a "counterfeit paradise".`,
    `The soil itself, however, provided some of the first evidence against this view. At many places along the rivers, archaeologists have found patches of unusually dark and fertile earth, known to scientists as Amazonian dark earth. These soils contain charcoal, fragments of pottery and the remains of food, and they appear to have built up over centuries as people burned waste and organic material close to their homes. Unlike the soils around them, they remain rich in nutrients today. Their existence suggests that some communities stayed in one place for long periods and improved the land rather than exhausting it.`,
    `Further evidence appeared as the forest was cut down. In the western Brazilian Amazon, land cleared for cattle ranching in recent decades has exposed hundreds of large earthworks: ditches dug in the shape of circles and squares, some of them more than 100 metres across. Some are thought to be around 2,000 years old. A study of microscopic plant remains in the soil concluded that their builders had not cleared large areas of forest to make them. Instead, they seem to have changed the forest gradually, for example by encouraging the growth of useful palms.`,
    `The most striking discoveries, however, have come from lidar, a technique in which an aircraft fires huge numbers of laser pulses at the ground. Some of the pulses pass through gaps between the leaves, and by measuring how long they take to return, researchers can build a map of the land surface as if the trees had been removed. In a study published in 2022, a team working in the Bolivian Amazon used lidar to map settlements built by the Casarabe culture between about AD 500 and 1400. The survey revealed earthen platforms, cone-shaped mounds, reservoirs and raised roads running straight across the landscape for kilometres. A study published two years later described a survey of the Upano valley in eastern Ecuador that had revealed more than 6,000 earthen platforms connected by roads, in settlements first occupied around 2,500 years ago.`,
    `Not everyone agrees on what these findings mean for the Amazon as a whole. The region is enormous, and much of the evidence so far comes from particular areas, often close to major rivers or on better soils. In some places far from the main rivers, studies of the soil have found little sign of past farming or burning. Researchers also continue to disagree about how many people lived in the region before Europeans arrived, and estimates vary widely. The debate is therefore less about whether people shaped parts of the forest than about how far that influence extended.`,
    `Whatever the answer, the change in thinking has practical consequences. If parts of the Amazon are, in effect, landscapes that people helped to create, then the knowledge of the region's Indigenous peoples is not simply of historical interest. Their long experience of living in and managing the forest may offer lessons for protecting it, and many researchers now argue that the history of the forest cannot be separated from the history of the people who have lived in it.`,
  ]),
  questions: [
    {
      kind: 'matchingParagraphs',
      items: [
        { item: 'a description of how a surveying method works', letter: 'F' },
        { item: 'evidence that some builders altered the forest without clearing large parts of it', letter: 'E' },
        { item: 'a suggestion that local knowledge could help to protect the forest', letter: 'H' },
      ],
    },
    {
      kind: 'tfng',
      item: 'Meggers believed that the poor quality of most Amazonian soils limited the size of the populations that could live there.',
      answer: 'TRUE',
      evidence:
        'Most of its soils are poor, because heavy rain washes nutrients out of them, and Meggers concluded that farming could not have supported large, permanent populations.',
    },
    {
      kind: 'tfng',
      item: 'The dark soils found along the rivers have lost most of their nutrients over time.',
      answer: 'FALSE',
      evidence: 'Unlike the soils around them, they remain rich in nutrients today.',
    },
    {
      kind: 'tfng',
      item: 'The settlements found in Ecuador were larger than those built by the Casarabe culture.',
      answer: 'NOT GIVEN',
    },
    {
      kind: 'gapTyped',
      stem: 'In the western Brazilian Amazon, land cleared for cattle ______ has exposed hundreds of earthworks.',
      answer: 'ranching',
      evidence:
        'In the western Brazilian Amazon, land cleared for cattle ranching in recent decades has exposed hundreds of large earthworks: ditches dug in the shape of circles and squares, some of them more than 100 metres across.',
    },
    {
      kind: 'gapTyped',
      stem: 'Lidar works by measuring how long laser ______ take to return from the ground.',
      answer: 'pulses',
      evidence:
        'Some of the pulses pass through gaps between the leaves, and by measuring how long they take to return, researchers can build a map of the land surface as if the trees had been removed.',
    },
    {
      kind: 'short',
      marks: 2,
      stem: 'According to Paragraph D, how were the dark soils formed, and what does their existence suggest about the people who made them?',
      answer:
        'They built up slowly over centuries as people burned rubbish and other organic material near their homes. This suggests that some communities lived in the same place for a long time and made the land better rather than using it up.',
      evidence:
        'Their existence suggests that some communities stayed in one place for long periods and improved the land rather than exhausting it.',
      rubric:
        '两分：写出「这些黑土是人们在住处附近焚烧垃圾、有机物，几百年慢慢堆积形成的」给 1 分（写出「人在家附近烧废物 / 有机物」或「几百年积累而成」中的人为来源即可）；写出「说明有些社群在同一个地方长期定居，并且让土地变得更好（更肥沃），而不是把地力耗尽」再给 1 分（只写「长期定居」或只写「改良了土地」都算这一分）。只写「土里有木炭、陶片和食物残渣」给 0 分（那是成分，不是形成过程，也不是它说明的问题）；只写「土壤至今仍然肥沃」给 0 分。',
    },
    {
      kind: 'short',
      marks: 2,
      stem: 'According to Paragraph G, why might the evidence found so far not represent the Amazon as a whole?',
      answer:
        'The region is huge, and most of the evidence comes from particular areas, often near the big rivers or where the soil is better. In some places far from the main rivers, soil studies have found hardly any sign of past farming or burning.',
      evidence:
        'In some places far from the main rivers, studies of the soil have found little sign of past farming or burning.',
      rubric:
        '两分：写出「这片区域非常大，而目前的证据大多来自某些特定地区（常常靠近大河或土壤较好的地方）」给 1 分；写出「在一些远离主要河流的地方，土壤研究几乎没有发现过去耕作或焚烧的痕迹」再给 1 分。只写「学者们对当时有多少人口意见不一」给 0 分（那是另一项分歧，不说明证据为什么不能代表整个亚马孙）；只写「不是所有人都同意」给 0 分（没有说出理由）。',
    },
  ],
};

// ═══════════════════════════════════════════════════════════════
// 周二 —— 会教人的测试：测试效应 / 提取练习（learning）
// 徽章主题：learning
//
// 出处与把握：
// · Arthur Gates 1917「Recitation as a factor in memorizing」：让学童学短传记等材料，
//   改变「读」与「不看材料背诵」所占的时间比例，背诵比例高的一般记得更多 —— 中高
//   （正文写「generally remembered more」，不写最优比例）。
// · Herbert Spitzer 1939（J Educ Psychol）：爱荷华州数千名六年级学生读短文后在不同
//   间隔测验，越早测过一次、之后忘得越少 —— 中高（原文 3,605 人，正文写「thousands」）。
// · Roediger & Karpicke 2006, Psychological Science 17:249–255「Test-enhanced learning」：
//   华盛顿大学（圣路易斯）；读一遍后要么再读、要么自由回忆（不给反馈）；最终测验在
//   5 分钟、2 天或 1 周后；5 分钟时重读略好（约 81% 对 75%），1 周时反转（约 56% 对
//   42%）；实验二 SSSS 组对自己记忆的信心最高、一周后记得最少（STTT 最好）—— 高
//   （摘要原文：repeated studying increased students' confidence）。
// · Robert Bjork「desirable difficulties」—— 高。
// · Karpicke, Butler & Roediger 2009（Memory）：大学生调查，重读是最常报告的策略，
//   自测很少 —— 高（正文不写百分比）。
// · Dunlosky et al. 2013（Psychological Science in the Public Interest）：十种学习方法，
//   只有练习测验与分散练习评为高效用，重读、划重点评为低效用 —— 高。
// · Karpicke & Blunt 2011（Science）：提取练习胜过概念图，一周后的测验含推理题 —— 高。
// · 伊利诺伊州一所初中（Columbia Middle School）的系列课堂研究：课上低风险小测过的
//   内容在单元考里得分更高 —— 高（McDaniel、Agarwal、Roediger 等）。
// · 反馈使效果更大 —— 高；Van Gog & Sweller 2015 认为高复杂度（元素交互性）材料上
//   测试效应可能变小甚至消失，Karpicke & Aue 2015 反驳 —— 高。正文写成「仍未定论」。
// ═══════════════════════════════════════════════════════════════

const TESTING = {
  key: 'original-w8-testing-effect',
  title: 'The Test That Teaches',
  passage: lettered([
    `For most students, a test is something that comes at the end of learning: a way of finding out how much has been remembered. A substantial body of research suggests that this view overlooks something important. The act of retrieving information from memory does not merely measure learning; it also appears to strengthen it. Psychologists call this the testing effect, or retrieval practice, and it is among the most consistently supported findings in the study of how people learn.`,
    `The idea has a long history. In 1917, the American psychologist Arthur Gates asked schoolchildren to learn short passages, such as brief life stories, and varied how much of their study time they spent reading and how much they spent trying to recite the material from memory. Those who spent a larger share of the time reciting generally remembered more. In 1939, Herbert Spitzer reported a study of thousands of schoolchildren in the American state of Iowa, who read short articles and were then tested at different intervals. Those who took a test soon after reading forgot less over the following weeks than those who were tested for the first time later.`,
    `Despite these early results, the effect received relatively little attention from educators until the 2000s. In an influential study published in 2006, Henry Roediger and Jeffrey Karpicke of Washington University in St Louis asked students to read short prose passages. After reading a passage once, the students either read it again or tried to write down as much of it as they could remember, without being told whether what they had written was correct. When a final test was given five minutes later, rereading produced slightly better results. When it was given a week later, however, the pattern was reversed: after practising recall, students remembered about 56 per cent of the ideas in a passage, compared with about 42 per cent after rereading.`,
    `A second experiment revealed a further twist. Students who had read a passage four times were more confident that they would remember it than students who had read it once and then tested themselves three times, yet a week later the confident group remembered the least. Rereading seems to create a sense of familiarity: the material looks increasingly recognisable, and this is easily mistaken for knowing it. Recalling information without looking is harder and feels less successful, but this effort appears to be what makes the memory last. The psychologist Robert Bjork has described conditions of this kind as "desirable difficulties": they make learning feel slower in the short term but improve it in the long term.`,
    `Students, however, rarely study in this way. In a survey of American university students published in 2009, rereading notes or textbooks was by far the most commonly reported study strategy, while relatively few students said that they regularly tested themselves. In 2013, a team of psychologists led by John Dunlosky reviewed the evidence for ten popular learning techniques. Practice testing was one of only two that they rated as highly useful, whereas rereading and highlighting were both judged to be of low usefulness.`,
    `The benefits do not seem to be limited to simple facts. In a 2011 study, Karpicke and Janell Blunt compared retrieval practice with concept mapping, a technique in which students draw diagrams showing how the ideas in a text are connected. A week later, students who had practised recalling a science text performed better than those who had drawn concept maps, even on questions that required them to draw conclusions the text had not stated directly. Studies in a middle school in the American state of Illinois have also found that pupils did better in their end-of-unit examinations on material that had appeared in short, low-stakes quizzes during lessons.`,
    `Researchers continue to debate the limits of the effect. Feedback seems to matter: when learners are told the correct answers after a test, they can correct their mistakes instead of remembering them, and the benefits are generally larger. Multiple-choice tests raise a further concern. In a study published in 2005, Henry Roediger and Elizabeth Marsh found that students who had taken such a test sometimes later remembered wrong options they had read as if they were true, although later research found that this effect was much smaller when feedback was given. How much it matters in real classrooms has not been settled.`,
    `For teachers and students, the practical lesson is fairly simple. Closing the book and trying to recall what has just been read, answering practice questions or explaining a topic from memory are all likely to be more effective than reading the same pages again, even though they feel harder. The research suggests that tests are most useful not as a final judgement but as a regular part of learning, provided that they carry low stakes, so that a wrong answer is treated as useful information rather than as a failure.`,
  ]),
  questions: [
    {
      kind: 'matchingParagraphs',
      items: [
        { item: 'an early study involving a large number of children', letter: 'B' },
        { item: 'a comparison with a technique that involves drawing diagrams', letter: 'F' },
        { item: 'the importance of learners being told the correct answers', letter: 'G' },
      ],
    },
    {
      kind: 'tfng',
      item: 'In the 2006 study, students who tried to recall a passage were told whether their answers were correct.',
      answer: 'FALSE',
      evidence:
        'After reading a passage once, the students either read it again or tried to write down as much of it as they could remember, without being told whether what they had written was correct.',
    },
    {
      kind: 'tfng',
      item: 'The 2009 survey found that rereading was the study strategy that students reported most often.',
      answer: 'TRUE',
      evidence:
        'In a survey of American university students published in 2009, rereading notes or textbooks was by far the most commonly reported study strategy, while relatively few students said that they regularly tested themselves.',
    },
    {
      kind: 'tfng',
      item: 'The writer suggests that a wrong answer in a test can be of value to a learner.',
      answer: 'TRUE',
      evidence:
        'The research suggests that tests are most useful not as a final judgement but as a regular part of learning, provided that they carry low stakes, so that a wrong answer is treated as useful information rather than as a failure.',
    },
    {
      kind: 'gapTyped',
      stem: 'Robert Bjork has called conditions that make learning feel slower at first but improve it later "desirable ______".',
      answer: 'difficulties',
      evidence:
        'The psychologist Robert Bjork has described conditions of this kind as "desirable difficulties": they make learning feel slower in the short term but improve it in the long term.',
    },
    {
      kind: 'gapTyped',
      stem: 'In a middle school in Illinois, pupils did better on material that had appeared in short, low-stakes ______ during lessons.',
      answer: 'quizzes',
      evidence:
        'Studies in a middle school in the American state of Illinois have also found that pupils did better in their end-of-unit examinations on material that had appeared in short, low-stakes quizzes during lessons.',
    },
    {
      kind: 'short',
      marks: 2,
      stem: 'According to Paragraph D, why do students who reread often feel confident, and what makes recalling information more effective?',
      answer:
        'Rereading makes the material look more and more familiar, and students mistake this familiarity for actually knowing it. Recalling without looking is harder and feels less successful, but it is exactly this effort that makes the memory last.',
      evidence:
        'Rereading seems to create a sense of familiarity: the material looks increasingly recognisable, and this is easily mistaken for knowing it.',
      rubric:
        '两分：写出「重读让材料看起来越来越眼熟，学生把这种熟悉感误当成真的掌握了」给 1 分（要说到「熟悉感被当成会了」，只写「读的遍数多」不给这一分）；写出「不看书回忆更难、感觉没那么顺，但正是这份费力让记忆保持得更久」再给 1 分（写「费力 / 困难反而让记忆更牢」即可；只写「这是合意的困难」而没说费力有什么用，不给这一分）。只写「因为测试比重读好」给 0 分（没有解释原因）。',
    },
    {
      kind: 'short',
      marks: 2,
      stem: 'Using your own words, describe how the results of the 2006 study depended on when the final test was taken.',
      answer:
        'When the final test came five minutes after studying, the students did slightly better after rereading. When it came a week later, the result was reversed: after practising recall they remembered about 56 per cent of the ideas, compared with about 42 per cent after rereading.',
      evidence:
        'When it was given a week later, however, the pattern was reversed: after practising recall, students remembered about 56 per cent of the ideas in a passage, compared with about 42 per cent after rereading.',
      rubric:
        '两分：写出「五分钟后就考，重读的效果略好」给 1 分；写出「一周后再考，结果反过来，练习回忆的记得更多（约 56% 对 42%）」再给 1 分（不写数字也给分，但要说清是回忆练习更好）。只写「测试比重读好」而不分时间给 0 分（题目问的是结果怎样随时间变化）；把两个时间点的结果说反的，对应那一分不给。',
    },
  ],
};

// ═══════════════════════════════════════════════════════════════
// 周三 —— 每个口袋里的电池：锂离子电池的发展与代价（technology）
// 徽章主题：technology
//
// 出处与把握：
// · 锂是最轻的金属、易失去电子，单位重量储能高；化学性质活泼、难以安全使用 —— 高
//   （2019 年诺贝尔化学奖科普材料）。1970 年代石油危机推动储能研究 —— 高。
// · Stanley Whittingham（英国出生）在 Exxon 做出二硫化钛正极 + 金属锂负极的可充电
//   电池；反复充电后金属锂长出细丝（枝晶）造成短路、起火，不能大规模销售 —— 高。
// · John Goodenough 1980 年在牛津大学用钴酸锂正极，约 4 伏（Whittingham 的设计略高于
//   2 伏，正文写「roughly twice」）—— 高。吉野彰 1985 年用碳基材料（石油焦）作负极、
//   不含金属锂、安全得多 —— 高。索尼 1991 年商用 —— 高。2019 年三人共获诺贝尔化学奖，
//   Goodenough 97 岁、史上最年长的诺奖得主 —— 高。正文称他「American scientist」，
//   不写 physicist / chemist（他的学科身份各处写法不一）。
// · 电池包均价 2010–2020 年降约 89%（BloombergNEF 年度调查）—— 高；正文写「one widely
//   cited industry survey」「roughly 90 per cent」。
// · 南美高原盐湖抽卤水、晒池蒸发提锂；当地社区担心缺水，影响多大科学界有分歧 —— 高。
//   澳大利亚从矿石提锂、产量最大 —— 高，所以正文写「A large share」不写「most」。
// · 刚果（金）供应全球大部分钴（约七成）；部分为手工开采，有童工（国际特赦组织 2016
//   等报告）—— 高。
// · 热失控 —— 高；三星 2016 年召回一款手机（Galaxy Note 7）—— 高。回收难、设计五花
//   八门、回收率估计差别很大 —— 高（正文不写数字）。
// · 磷酸铁锂电池不含钴，能量密度稍低、更便宜更安全 —— 高。
// ═══════════════════════════════════════════════════════════════

const BATTERY = {
  key: 'original-w8-lithium-ion',
  title: 'The Battery in Every Pocket',
  passage: lettered([
    `Few technologies have spread as quietly, or as widely, as the lithium-ion battery. It powers mobile phones, laptops and electric cars, and it is increasingly used to store electricity generated by solar panels and wind turbines. Its development took several decades and the work of many scientists, and its success has created problems that the world is still learning to manage.`,
    `Lithium is in many ways an ideal material for batteries. It is the lightest of all metals and gives up electrons easily, which means that a lithium battery can store a large amount of energy for its weight. However, it is also highly reactive, and this has always made it difficult to use safely. Serious interest in the problem began in the 1970s, when a sharp rise in the price of oil encouraged research into new ways of storing energy.`,
    `In the mid-1970s, the British chemist Stanley Whittingham, working for the oil company Exxon, built a rechargeable battery in which lithium ions moved into and out of layers of a compound called titanium disulphide. The battery worked, but one of its electrodes was made of pure lithium metal. After repeated charging, fine threads of metal could grow from this electrode, causing short circuits and, in some cases, fires. The design was not safe enough to be sold widely.`,
    `Two further advances made the battery practical. In 1980, the American scientist John Goodenough, then working at the University of Oxford, showed that an electrode made of cobalt oxide containing lithium could produce about four volts, roughly twice as much as Whittingham's design. Then, in 1985, the Japanese chemist Akira Yoshino replaced the pure lithium at the other electrode with a carbon-based material that could hold lithium ions within its structure. Because the battery no longer contained lithium metal, it was far safer. The Japanese company Sony began selling lithium-ion batteries in 1991, and in 2019 the three scientists shared the Nobel Prize in Chemistry. At 97, Goodenough became the oldest person ever to receive a Nobel Prize.`,
    `Since then, lithium-ion batteries have become steadily cheaper and better. According to one widely cited industry survey, the average price of battery packs fell by roughly 90 per cent between 2010 and 2020. This fall has been central to the growth of electric vehicles, and it has made it practical to store electricity from solar and wind power for use when the sun is not shining or the wind is not blowing.`,
    `The raw materials for these batteries, however, come at a cost. A large share of the world's lithium is extracted from salty water pumped from beneath the high deserts of South America, where it is left in vast ponds to evaporate. Because these are among the driest places on Earth, local communities have raised concerns about the effect on scarce water supplies, although scientists disagree about how serious the impact is. Cobalt raises different problems. Most of the world's supply comes from the Democratic Republic of the Congo, where a share is dug by hand in small, dangerous mines, and human rights organisations have reported children working in some of them.`,
    `Safety and waste remain concerns as well. If a battery is damaged, badly made or overheated, reactions inside it can produce more heat, which speeds up the reactions further, leading to fires that are difficult to put out. In 2016, Samsung had to recall a model of smartphone after some of its batteries caught fire. Used batteries also contain valuable metals, but recovering them is complicated, partly because batteries are built in many different designs, and estimates of how many are currently recycled vary widely.`,
    `Researchers are working to reduce these costs. Some newer batteries use iron and phosphate instead of cobalt, accepting slightly less energy for their weight in exchange for lower cost and greater safety, and many groups are developing better ways of recycling. Others are working on entirely new kinds of battery. Whatever eventually replaces it, the lithium-ion battery shows that even a technology that makes cleaner energy possible carries costs of its own, and that these costs are often paid far from the places where the benefits are enjoyed.`,
  ]),
  questions: [
    {
      kind: 'matchingParagraphs',
      items: [
        { item: 'an economic event that encouraged research into storing energy', letter: 'B' },
        { item: 'a process in which heat leads to the production of still more heat', letter: 'G' },
        { item: 'the age at which one scientist received an award', letter: 'D' },
      ],
    },
    {
      kind: 'tfng',
      item: "Whittingham's battery was sold in large numbers soon after it was developed.",
      answer: 'FALSE',
      evidence: 'The design was not safe enough to be sold widely.',
    },
    {
      kind: 'tfng',
      item: "Goodenough's electrode was cheaper to manufacture than the one used in Whittingham's battery.",
      answer: 'NOT GIVEN',
    },
    {
      kind: 'tfng',
      item: "Yoshino's design was safer because it did not contain lithium in the form of a metal.",
      answer: 'TRUE',
      evidence: 'Because the battery no longer contained lithium metal, it was far safer.',
    },
    {
      kind: 'gapTyped',
      stem: 'After repeated charging, threads of metal could grow from the lithium electrode and cause short ______.',
      answer: 'circuits',
      evidence:
        'After repeated charging, fine threads of metal could grow from this electrode, causing short circuits and, in some cases, fires.',
    },
    {
      kind: 'gapTyped',
      stem: 'Recovering metals from used batteries is complicated partly because batteries are built in many different ______.',
      answer: 'designs',
      evidence:
        'Used batteries also contain valuable metals, but recovering them is complicated, partly because batteries are built in many different designs, and estimates of how many are currently recycled vary widely.',
    },
    {
      kind: 'short',
      marks: 2,
      stem: 'Using your own words, explain why lithium is attractive for making batteries, and what has made it difficult to use.',
      answer:
        'It is the lightest metal and gives up electrons easily, so a lithium battery can hold a lot of energy for how much it weighs. But it is very reactive, which makes it hard to use safely; in early batteries, for example, threads of lithium metal grew and caused short circuits and fires.',
      evidence:
        'It is the lightest of all metals and gives up electrons easily, which means that a lithium battery can store a large amount of energy for its weight.',
      rubric:
        '两分：写出「锂是最轻的金属、容易失去电子，所以按重量算能储存很多能量」给 1 分（写出「最轻」或「易失电子」并落到「单位重量储能多」即可）；写出「锂化学性质很活泼，难以安全使用」再给 1 分（写 Whittingham 电池里金属锂长出细丝、造成短路起火，也给这一分）。只写「锂很便宜」给 0 分（原文没有这样说）；只写「锂能充电」给 0 分（没有说出优点的原因）。',
    },
    {
      kind: 'short',
      marks: 2,
      stem: 'According to Paragraph F, what problems are associated with obtaining lithium and cobalt?',
      answer:
        'Much lithium comes from salty water left to evaporate in some of the driest places on Earth, so local people worry that it affects their scarce water supplies. Most cobalt comes from the Democratic Republic of the Congo, where some of it is dug by hand in small, dangerous mines, and children have been reported working in some of them.',
      evidence:
        'Because these are among the driest places on Earth, local communities have raised concerns about the effect on scarce water supplies, although scientists disagree about how serious the impact is.',
      rubric:
        '两分：写出锂的问题 ——「在世界上最干旱的地方抽卤水晒池蒸发提锂，当地社区担心本来就稀缺的水源受影响」给 1 分（只写「用晒池提锂」而没说到缺水担忧，不给这一分）；写出钴的问题 ——「大部分来自刚果（金），一部分在又小又危险的矿里手工开采，有报告说有儿童在矿里干活」再给 1 分（写出「危险的手工矿」或「童工」任一即可）。只写「电池会着火」或「电池难回收」给 0 分（那是 Paragraph G 讲的使用和废弃问题，不是获取原料的问题）。',
    },
  ],
};

// ═══════════════════════════════════════════════════════════════
// 周四 —— 昆虫去哪儿了：昆虫减少有多快（nature）
// 徽章主题：nature
//
// 出处与把握：
// · 「windscreen phenomenon」—— 高（多处科普与论文引言都提到，只是轶事）。
// · 已描述的昆虫约一百万种、还有很多没命名 —— 高。
// · Hallmann et al. 2017, PLOS ONE「More than 75 percent decline over 27 years in total
//   flying insect biomass in protected areas」：Krefeld 昆虫学会的业余昆虫学家用马氏网
//   （帐篷状诱捕器）在德国自然保护区采样称重；63 处、1989–2016；季节总生物量降约 76%，
//   盛夏约 82%；天气、土地利用、生境特征的变化解释不了总体下降；作者推测周边农业
//   集约化（含农药）可能有关，但数据不能确定原因；只称总重、不分物种 —— 高。
//   正文写「almost three decades」（27 年）。
// · Sánchez-Bayo & Wyckhuys 2019（Biological Conservation）：40% 以上的昆虫物种在减少、
//   可能几十年内大量灭绝；媒体广泛报道为「insect apocalypse」；被批评检索时用了
//   「declin*」一词，偏向只收到下降的研究 —— 高。正文写「widely reported ... as evidence
//   of an "insect apocalypse"」，不说这个词是这篇综述之后才出现的（2018 年已有）。
// · van Klink et al. 2020（Science）：166 项长期调查（1,676 个样点）；陆地昆虫数量约每
//   十年降 9%，淡水昆虫反而增加（约每十年 11%），可能因水体变干净；地区差异大 —— 高。
//   正文只写「roughly 9 per cent per decade」和「increasing」，不写 11%。
// · 长期数据集中在欧洲、北美，热带极少而物种多在热带；年际波动大；监测开始前可能
//   已在下降（基线问题）—— 高。
// · 主要原因：生境丧失、农药化肥、气候变化、夜间人工光 —— 高（多数综述一致）。
// ═══════════════════════════════════════════════════════════════

const INSECTS = {
  key: 'original-w8-insect-decline',
  title: 'Where Have the Insects Gone?',
  passage: lettered([
    `Many people who have driven along country roads for several decades say they have noticed a change: after a summer journey, far fewer insects end up crushed against the car's windscreen than in the past. This observation, sometimes called the "windscreen phenomenon", is not reliable evidence. Cars have changed shape, roads have changed, and memories are easily mistaken. Yet it reflects a question that has become one of the most widely discussed in ecology: are the world's insects disappearing, and if so, how quickly?`,
    `Insects matter far more than their size suggests. They pollinate many crops and wild plants, break down dead material and return nutrients to the soil, and are a major source of food for birds, bats, fish and many other animals. Around a million species of insect have been described, and scientists believe that many more have not yet been named. For the great majority of them, however, there is no long-term record of how numerous they are.`,
    `One study, published in 2017, did more than any other to bring the issue to public attention. For almost three decades, amateur entomologists belonging to a society in the German city of Krefeld had set up tent-like traps in nature reserves, collecting flying insects and weighing the catch. When scientists analysed the records, which covered 63 sites between 1989 and 2016, they found that the total weight of insects caught over the season had fallen by about 76 per cent. In midsummer, when insects are usually most abundant, the decline was about 82 per cent.`,
    `The findings were alarming for two reasons. First, the sites were protected areas, where insects might have been expected to be relatively safe. Second, the researchers found that changes in the weather and in the plants growing at the sites could not explain most of the decline. They suggested that farming in the surrounding landscape, including the use of pesticides, might be partly responsible, but their data could not identify the cause. Because the study measured only the total weight of insects, it also could not show which species were declining.`,
    `Some later claims went much further. A review published in 2019 suggested that more than 40 per cent of insect species were declining and that many could disappear within a few decades, and it was widely reported in newspapers around the world as evidence of an "insect apocalypse". Other scientists criticised the review, pointing out that its authors had searched for earlier studies using the word "decline", which made it more likely that studies finding stable or growing populations would be left out.`,
    `A larger analysis, published in 2020, combined data from 166 long-term surveys around the world. It estimated that the number of insects living on land was falling by roughly 9 per cent per decade: a serious loss, but far slower than some earlier claims had implied. More surprisingly, insects that spend their early lives in fresh water appeared to be increasing in many places, possibly because rivers and lakes had become cleaner in recent decades. The results also varied considerably from one region to another.`,
    `Part of the difficulty is that good long-term data are rare. Most come from Europe and North America, while very few exist for the tropics, where the majority of insect species live. Insect numbers also rise and fall sharply from year to year, depending on the weather, so a study that lasts only a few years may mistake a natural fluctuation for a long-term trend. In addition, many declines may have begun before any monitoring started, so even long records may underestimate how much has been lost.`,
    `Despite these uncertainties, most researchers agree that many insect populations are under pressure, and that the main causes are already known: the loss of habitat to farming and building, the heavy use of pesticides and fertilisers, climate change and, in some places, artificial light at night. Because these threats can be reduced, there is reason for hope. Many scientists argue that the priority is both to act on what is already known and to establish better long-term monitoring, so that future changes are not noticed only when they have already become severe.`,
  ]),
  questions: [
    {
      kind: 'matchingParagraphs',
      items: [
        { item: 'a reason why an everyday observation should be treated with caution', letter: 'A' },
        { item: 'a group of insects that seemed to be doing better', letter: 'F' },
        { item: 'a reason for optimism', letter: 'H' },
      ],
    },
    {
      kind: 'tfng',
      item: 'The Krefeld society began collecting insects because farmers had reported smaller harvests.',
      answer: 'NOT GIVEN',
    },
    {
      kind: 'tfng',
      item: 'The 2017 study identified the cause of the decline.',
      answer: 'FALSE',
      evidence:
        'They suggested that farming in the surrounding landscape, including the use of pesticides, might be partly responsible, but their data could not identify the cause.',
    },
    {
      kind: 'tfng',
      item: 'Most of the 166 surveys used in the 2020 analysis were carried out by volunteers.',
      answer: 'NOT GIVEN',
    },
    {
      kind: 'gapTyped',
      stem: 'The data for the 2017 study were collected by amateur ______ from a society in Krefeld.',
      answer: 'entomologists',
      evidence:
        'For almost three decades, amateur entomologists belonging to a society in the German city of Krefeld had set up tent-like traps in nature reserves, collecting flying insects and weighing the catch.',
    },
    {
      kind: 'gapTyped',
      stem: 'The 2019 review was widely reported in newspapers as evidence of an insect ______.',
      answer: 'apocalypse',
      evidence:
        'A review published in 2019 suggested that more than 40 per cent of insect species were declining and that many could disappear within a few decades, and it was widely reported in newspapers around the world as evidence of an "insect apocalypse".',
    },
    {
      kind: 'short',
      marks: 2,
      stem: 'According to Paragraph D, why were the findings of the 2017 study so alarming?',
      answer:
        'The traps were in protected areas, where insects should have been fairly safe. Also, changes in the weather and in the plants at the sites could not explain most of the fall in numbers.',
      evidence:
        'Second, the researchers found that changes in the weather and in the plants growing at the sites could not explain most of the decline.',
      rubric:
        '两分：写出「采样地点是保护区，昆虫在那里本应比较安全」给 1 分；写出「天气和样地植物的变化解释不了大部分下降」再给 1 分。只写「昆虫减少了约 76%」给 0 分（那是 Paragraph C 的数字，不是这一段说的令人担忧的原因）；只写「可能是农药造成的」给 0 分（那是作者的推测，而且数据不能证实）。',
    },
    {
      kind: 'short',
      marks: 2,
      stem: 'Give TWO reasons from Paragraph G why it is difficult to know how quickly insect numbers are changing.',
      answer:
        'Good long-term records are rare: most come from Europe and North America and very few from the tropics, where most insect species live. Insect numbers go up and down a lot from year to year with the weather, so a short study can mistake a natural change for a long-term trend. Also, many declines may have started before anyone was monitoring, so even long records may underestimate the losses.',
      evidence:
        'Insect numbers also rise and fall sharply from year to year, depending on the weather, so a study that lasts only a few years may mistake a natural fluctuation for a long-term trend.',
      rubric:
        '两分，下面三点任写两点，每点 1 分：①好的长期数据很少，大多来自欧洲和北美，热带（大多数昆虫物种生活的地方）几乎没有；②昆虫数量随天气年年大起大落，只做几年的研究可能把自然波动误当成长期趋势；③很多下降可能在监测开始前就已经发生，所以即使是很长的记录也可能低估损失。两句说的是同一点只算 1 分。只写「昆虫种类太多」给 0 分（这一段没有这样说）。',
    },
  ],
};

// ═══════════════════════════════════════════════════════════════
// 周五 —— 没有「左右」的语言：空间语言与思维（culture）
// 徽章主题：culture
//
// 出处与把握：
// · Guugu Yimithirr：澳大利亚昆士兰北部（Hope Vale 一带）的原住民语言；1770 年库克船队
//   在附近（今 Cooktown 的 Endeavour River）修船时记下 gangurru，进入英语成为 kangaroo
//   —— 高。描述物体位置时不用前后左右、用东南西北，室内小范围也一样 —— 高
//   （Haviland、Levinson 的研究；Deutscher 2010 科普）。正文写「traditionally」。
// · Stephen Levinson 测试说话人指向看不见的远处地点，非常准 —— 中高（正文不写误差度数）。
//   John Haviland 观察到讲故事时手势指向事件发生的真实方位、不随说话人朝向变 —— 高。
// · 转桌摆动物实验（Max Planck 心理语言学研究所，Levinson 等）：看第一张桌上三只玩具
//   动物的排列，转身到第二张桌照样摆；荷兰语者保持相对身体的左右，泽套语
//   （Tzeltal，墨西哥南部恰帕斯州的玛雅语，用「上坡 / 下坡」描述方位）使用者保持
//   相对地形的方向、相对身体就反了 —— 高。
// · Boroditsky & Gaby 2010（Psychological Science「Remembrances of times east」）：
//   Kuuk Thaayorre（昆士兰 Pormpuraaw）按东→西排列表示时间顺序的图片（人变老等），
//   面朝南是左→右、面朝北是右→左；英语者一律左→右 —— 高。
// · Li & Gleitman 2002（Cognition「Turning the tables」）：英语者在转桌任务中的选择
//   会随测试情境（是否看得到地标等）改变；认为「照样摆」这一指令有歧义；Levinson 等
//   2002 年撰文反驳 —— 高（「地标」细节中高，正文写「such as whether familiar landmarks
//   were visible」）。正文写成「争论没有完全解决」。
// · 「语言训练注意的习惯而非限制思维」是目前常见的折中看法 —— 高（写成「Many
//   researchers now suggest」）。Guugu Yimithirr 使用者今天多兼说英语 —— 高。
// · 心理学被试多来自西方工业化社会（Henrich, Heine & Norenzayan 2010 等）—— 高；
//   正文不写 WEIRD 缩写（weird 会进词表）。
// ═══════════════════════════════════════════════════════════════

const SPACE = {
  key: 'original-w8-spatial-language',
  title: 'A World Without Left and Right',
  passage: lettered([
    `Ask an English speaker where something is, and the answer will often depend on the speaker's own body: the cup is to the left of the plate, the bag is behind the chair. These words seem so natural that it is easy to assume every language must have them. Yet research over the past few decades has shown that some languages describe space in a very different way, and it has raised the question of whether this affects how their speakers think.`,
    `One of the best-known examples is Guugu Yimithirr, an Aboriginal language of northern Queensland in Australia. It was one of the first Australian languages to be noted down by Europeans: in 1770, members of James Cook's expedition, whose ship was being repaired nearby, recorded a local word for a large animal, and it entered English as "kangaroo". What makes the language remarkable, however, is that its speakers have traditionally not used words like "left", "right", "in front of" or "behind" to describe where things are. Instead, they use the points of the compass. A speaker might say that a cup is to the north of a plate, or ask someone to move a little to the east, even inside a small room.`,
    `Speaking in this way requires a constant awareness of direction. The linguist Stephen Levinson found that Guugu Yimithirr speakers could point with remarkable accuracy to distant places that they could not see. Another linguist, John Haviland, noticed that when speakers told stories, their gestures tended to point in the actual compass directions in which the events had happened, regardless of which way the speakers were facing at the time.`,
    `Levinson and his colleagues then designed experiments to test whether such differences extended beyond language. In one, participants looked at three toy animals arranged in a row on a table. They were then turned around to face a second table and asked to arrange the animals in the same way. Dutch speakers generally kept the order relative to their own bodies, so that the animal that had been on their left stayed on their left. Speakers of Tzeltal, a Mayan language of southern Mexico that describes space using words meaning "uphill" and "downhill", generally kept the order fixed in the landscape instead, which meant that it was reversed relative to their bodies.`,
    `Similar patterns have been reported for time. In 2010, Lera Boroditsky and Alice Gaby asked speakers of Kuuk Thaayorre, another Aboriginal language of northern Australia, to arrange sets of pictures showing a sequence of events, such as a man growing older. English speakers placed the pictures from left to right, the direction in which English is read. Kuuk Thaayorre speakers arranged them from east to west, whichever way they happened to be facing: from left to right if they faced south, but from right to left if they faced north.`,
    `Not everyone accepts that these results reveal deep differences in thought. In 2002, the psychologists Peggy Li and Lila Gleitman reported that the choices made by English speakers in the rotation task could be shifted by changing features of the testing situation, such as whether familiar landmarks were visible. They argued that the instruction to arrange the animals "in the same way" was ambiguous, and that participants were simply choosing the interpretation that seemed most natural to them. Levinson and his colleagues replied that this could not explain the strong and consistent differences between communities, and the dispute has not been fully resolved.`,
    `There is also the question of cause. Communities that use compass directions often live in landscapes, and follow ways of life, in which orientation matters a great deal, so it is difficult to separate the influence of language from that of environment and culture. It is also clear that a language does not prevent its speakers from thinking in other ways: many Guugu Yimithirr speakers today also speak English and use its words for left and right. Many researchers now suggest that language does not limit thought but trains habits of attention, making some ways of thinking about space more automatic than others.`,
    `The research also carries a wider warning. For many years, most participants in psychology experiments have come from Western, industrialised societies, and the ways in which they think have often been treated as if they were simply human. Studies of languages such as Guugu Yimithirr suggest that some of what seems natural may, in fact, be learned, and that understanding the human mind requires studying it in the full range of places where people live.`,
  ]),
  questions: [
    {
      kind: 'matchingParagraphs',
      items: [
        { item: 'the origin of a word now used in English', letter: 'B' },
        { item: 'an experiment in which participants were turned to face the opposite way', letter: 'D' },
        { item: 'a difficulty in separating the effects of language from those of surroundings', letter: 'G' },
      ],
    },
    {
      kind: 'tfng',
      item: "Levinson's tests showed that older speakers pointed more accurately than younger ones.",
      answer: 'NOT GIVEN',
    },
    {
      kind: 'tfng',
      item: 'In the 2010 study, English speakers arranged the pictures in the direction in which their language is read.',
      answer: 'TRUE',
      evidence:
        'English speakers placed the pictures from left to right, the direction in which English is read.',
    },
    {
      kind: 'tfng',
      item: 'Speaking Guugu Yimithirr makes it impossible to think in terms of left and right.',
      answer: 'FALSE',
      evidence:
        'It is also clear that a language does not prevent its speakers from thinking in other ways: many Guugu Yimithirr speakers today also speak English and use its words for left and right.',
    },
    {
      kind: 'gapTyped',
      stem: "Haviland noticed that speakers' ______ pointed in the real compass directions of the events they described.",
      answer: 'gestures',
      evidence:
        'Another linguist, John Haviland, noticed that when speakers told stories, their gestures tended to point in the actual compass directions in which the events had happened, regardless of which way the speakers were facing at the time.',
    },
    {
      kind: 'gapTyped',
      stem: 'Many researchers now believe that, rather than limiting thought, language shapes habits of ______.',
      answer: 'attention',
      evidence:
        'Many researchers now suggest that language does not limit thought but trains habits of attention, making some ways of thinking about space more automatic than others.',
    },
    {
      kind: 'short',
      marks: 2,
      stem: 'According to Paragraph E, in what order did Kuuk Thaayorre speakers arrange the pictures, and why did this order look different depending on which way they were facing?',
      answer:
        'They always arranged the pictures from east to west. Because the order was fixed to the compass rather than to their bodies, it ran from left to right when they faced south but from right to left when they faced north.',
      evidence:
        'Kuuk Thaayorre speakers arranged them from east to west, whichever way they happened to be facing: from left to right if they faced south, but from right to left if they faced north.',
      rubric:
        '两分：写出「他们总是按从东到西的顺序排」给 1 分；写出「顺序跟着方位走、不跟着身体走，所以面朝南时是从左到右，面朝北时是从右到左」再给 1 分（举出朝南 / 朝北其中一个例子并说清左右方向即可）。只写「从左到右」给 0 分（那是英语者的排法）；把东西方向说反的，第一分不给。',
    },
    {
      kind: 'short',
      marks: 2,
      stem: 'According to Paragraph F, what did Li and Gleitman argue about the rotation task, and how did Levinson and his colleagues respond?',
      answer:
        "Li and Gleitman argued that the instruction to arrange the animals 'in the same way' could be understood in more than one way, so people were just choosing the meaning that felt most natural; English speakers' choices even changed with the testing situation, such as whether landmarks could be seen. Levinson and his colleagues replied that this could not explain the strong and consistent differences between the communities.",
      evidence:
        'Levinson and his colleagues replied that this could not explain the strong and consistent differences between communities, and the dispute has not been fully resolved.',
      rubric:
        '两分：写出 Li 和 Gleitman 的观点 ——「『照样摆』这个指令有歧义，被试只是选了自己觉得最自然的理解（英语者的选择会随测试情境，如能否看到熟悉的地标而改变），所以结果不能说明思维有深层差异」给 1 分（写出「指令有歧义」或「选择会随测试情境改变」任一并说到这一点即可）；写出 Levinson 等人的回应 ——「这解释不了不同群体之间强烈而一致的差异」再给 1 分。只写「他们意见不同」给 0 分（没有说出各自的观点）。',
    },
  ],
};

const SPECS = [AMAZON, TESTING, BATTERY, INSECTS, SPACE];

module.exports = {
  LEVEL,
  SPECS,
  DAYS: DATES.slice(0, SPECS.length).map((date, i) => buildAuthoredDay(SPECS[i], date)),
};
