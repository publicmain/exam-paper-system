/**
 * 第七周 —— **ielts_authentic（雅思真题难度）**档，全原创学术说明文。
 *
 * 六百词上下、八段、按 Paragraph A–H 编号。形状与第六周这一档一致：
 *   3 道段落信息配对 · 3 道判断 · 2 道原文单词填空（要拼写） ·
 *   2 道两分主观题 —— 满分 12。
 *
 * 本周选题（五个领域各一篇）：
 *   周一 自然科学 —— 小行星与恐龙灭绝：铱元素的线索（地质 / 古生物）
 *   周二 心理学   —— 记忆会被改写：误导信息与目击证词
 *   周三 历史与技术 —— 哈伯-博施合成氨：从空气里造肥料
 *   周四 环境     —— 复活节岛（拉帕努伊）「生态自杀」说的再审视
 *   周五 社会 / 经济 —— 默认选项的力量：养老金自动加入与器官捐献
 *
 * 判断题按周看分布：F/NG/T · T/F/T · NG/T/NG · T/F/NG · F/NG/F →
 * TRUE 5 · FALSE 5 · NOT GIVEN 5；只有两天（周一、周四）是各一道，
 * NOT GIVEN 不总在最后（周一、周五在中间，周三在头尾，周四在最后）。
 *
 * 研究与数字只写能对上公开出处的（见每篇上方注释），拿不准的一律不写
 * 具体数字。文章是自己写的，研究结论用自己的话转述；有争议的地方写成
 * 学界有分歧，题目不考争议本身的对错。
 * 选题前对过学生读过的 188 + 225 篇标题、内容包 161 篇标题，以及前六周本档
 * 全部题目（珊瑚、冰芯、暗光走廊、冷路面、河流、雁阵、集装箱、棉花糖、补液盐、
 * 天气预报、青霉素、香蕉、邓巴数、安慰剂、蚊子、旁观者、狼、bouba/kiki、
 * 碳测年、禀赋效应、坏血病、咸海、注意盲视、拥堵收费、巨石阵），关键词
 * （asteroid / iridium / Chicxulub / Loftus / eyewitness / ammonia / Haber /
 * Easter Island / Rapa Nui / organ donation / opt-out / pension）在内容包与
 * test-fixtures 里也搜过，无重合。旧题库有「间隔重复与遗忘曲线」（记忆巩固），
 * 周二讲的是记忆被误导、被植入，不是同一个主题。
 */

'use strict';

const { buildAuthoredDay, lettered } = require('../authored');
const { DATES } = require('./dates');

const LEVEL = 'ielts_authentic';

// ═══════════════════════════════════════════════════════════════
// 周一 —— 黏土里的线索：小行星与恐龙灭绝（自然科学）
//
// 出处与把握：
// · 约 6600 万年前、约四分之三的动植物物种灭绝，除鸟类祖先外的恐龙全部消失
//   —— 高（Wikipedia「Chicxulub crater」：75% of plant and animal species,
//   all non-avian dinosaurs）。
// · Walter Alvarez 1970 年代在意大利 Gubbio 研究石灰岩；界线以下有大量浮游生物
//   （有孔虫）微化石、以上几乎消失；中间一层约 1–2 厘米的黏土（正文写「about a
//   centimetre」）；他想知道这层黏土沉积用了多久 —— 高（Alvarez 1980 原文摘要、
//   Berkeley 新闻稿、EBSCO Research Starters）。
// · 父亲 Luis Alvarez（1968 年诺贝尔物理学奖）提议测铱：地壳里极少、陨石里多，
//   宇宙尘近乎恒定地落下，含量可以当「钟」；与 Frank Asaro、Helen Michel 合作 —— 高。
// · Alvarez, Alvarez, Asaro & Michel 1980, Science 208:1095–1108：意大利、丹麦、
//   新西兰的铱分别比背景高约 30、160、20 倍；提出直径约 10 公里的小行星撞击、
//   尘埃遮光、光合作用停止、食物链崩溃 —— 高（摘要原文）。
// · 古生物学界起初强烈反对；有人主张恐龙早已在缓慢衰退；「撞击坑在哪里」是主要
//   质疑之一 —— 中高（JSTOR Daily「How we know what killed the dinosaurs」、
//   LibreTexts「Controversies in the Earth Sciences」3.5），正文写「Some argued」。
// · 1978 年 Pemex 地球物理学家 Glen Penfield 航空磁测发现尤卡坦附近的环形结构；
//   Pemex 不许公开具体数据，但允许他与 Antonio Camargo 在 1981 年 SEG 年会报告；
//   撞击专家同年在另一会议，报告少有人注意；1991 年与加拿大学者 Alan Hildebrand 等
//   在 Geology 发表，称约 180 公里的埋藏撞击坑；埋在约 1 公里厚的较新沉积岩之下 ——
//   高（Wikipedia「Chicxulub crater」、Physics World 转述 1991 年论文）。今天的估计
//   多写约 200 公里，正文只写 1991 年那篇论文的说法。Pemex 不公开数据在正文只交代
//   事实，不说它是「没人注意」的原因（出处没这样说），题目也不考。
// · 冲击石英在全球界线层都有，墨西哥湾周边最集中 —— 高（LibreTexts）。
// · Fischer-Gödde et al. 2024, Science：钌同位素显示撞击体是碳质小行星、形成于木星
//   轨道以外 —— 高（论文摘要、维也纳大学与 Sci.News 报道）。
// · 德干暗色岩：印度西部大规模火山喷发与撞击同期、延续几十万年；对灭绝贡献多大
//   学界有分歧 —— 高（Wikipedia、LibreTexts）。「不同定年法对最大规模喷发的时间结论
//   不同」指 2019 年 Science 的 Schoene 等（U-Pb：四次大脉冲、第一次在撞击前）与
//   Sprain 等（Ar-Ar：大部分在撞击后）；两篇都认为主喷发期约 70–80 万年 —— 高
//   （Princeton TIMS lab 论文页、Geochronology 2021 评述摘要）。正文只写「disagree」，
//   主观题考的是「分歧在哪、为什么难定」，不考哪一方对。
// ═══════════════════════════════════════════════════════════════

const ASTEROID = {
  key: 'original-w7-asteroid-iridium',
  title: 'The Clue in the Clay',
  passage: lettered([
    `About 66 million years ago, roughly three-quarters of the species of plants and animals on Earth disappeared in what was, in geological terms, an instant. The victims included every kind of dinosaur except the ancestors of today's birds. For decades, the cause of this mass extinction was a matter of speculation. Today, most scientists accept that the impact of an asteroid played a central part. Remarkably, the evidence that changed their minds came from an attempt to answer a much smaller question.`,
    `In the 1970s, the American geologist Walter Alvarez was studying limestone near the town of Gubbio in central Italy. The rock that had formed just before the extinction was full of the tiny fossils of plankton, but in the rock immediately above, almost all of them had vanished. Between the two lay a band of clay only about a centimetre thick. Alvarez wanted to know how long this thin layer had taken to form: a few years, or many thousands?`,
    `His father, Luis Alvarez, a physicist who had won a Nobel Prize, suggested a way to find out. The metal iridium is extremely rare in the rocks of the Earth's crust but far more common in meteorites, and dust from space settles on the planet at a fairly steady rate. The amount of iridium in the clay could therefore act as a clock: the longer the layer had taken to form, the more of this dust it should contain. Working with the chemists Frank Asaro and Helen Michel, the Alvarez team measured it. The clay at Gubbio contained about 30 times as much iridium as the rock around it, and a similar layer in Denmark contained about 160 times as much, far more than a steady fall of dust could explain.`,
    `In 1980, the team published a bold explanation. They proposed that an asteroid about 10 kilometres across had struck the Earth, throwing so much dust into the atmosphere that sunlight was blocked around the world. Without sunlight, photosynthesis would have stopped, and food chains on land and in the sea would have collapsed. Many palaeontologists were sceptical. Some argued that the dinosaurs had already been declining for millions of years, and critics pointed out that an impact of this size should have left an enormous crater, which nobody had found.`,
    `In fact, part of the answer already existed. In 1978, Glen Penfield, a geophysicist working for Mexico's state oil company, had detected a vast circular structure during an airborne survey near the Yucatán Peninsula. It is buried beneath about a kilometre of younger rock, so it cannot be seen at the surface. The company allowed Penfield and his colleague Antonio Camargo to describe it at a conference in 1981, but it would not release the detailed survey data, and their report attracted little attention, partly because many experts on impacts were attending a different meeting that year. Only in 1991 did they publish, with the Canadian scientist Alan Hildebrand and others, a paper identifying it as an impact crater about 180 kilometres wide, now named after the nearby village of Chicxulub.`,
    `Further evidence has accumulated since. Grains of quartz bearing the marks of an intense shock, of a kind associated with violent impacts, have been found in rocks of the same age around the world, and they are most common near the Gulf of Mexico. In 2024, a study of the element ruthenium in the boundary clay concluded that the asteroid belonged to a carbon-rich type that formed in the outer solar system, beyond the orbit of Jupiter.`,
    `The debate is not entirely over. At around the same time, enormous volcanic eruptions in western India were releasing gases that could have altered the climate. Scientists still disagree about how much these eruptions contributed: some believe they had already put life under severe stress before the asteroid arrived, while others think the impact alone was enough. Part of the difficulty is that the eruptions lasted for hundreds of thousands of years, before and after the impact, and studies using different dating methods have reached different conclusions about when the largest of them took place.`,
    `Walter Alvarez had set out to measure how long a layer of clay took to form, and his method did not work in the way he had intended. Yet its failure revealed something far more important: the thin clay at Gubbio recorded not a slow accumulation of dust, but a sudden catastrophe.`,
  ]),
  questions: [
    {
      kind: 'matchingParagraphs',
      items: [
        { item: 'an explanation of why an important structure cannot be seen from the ground', letter: 'E' },
        { item: 'the idea of using a chemical element to measure the passing of time', letter: 'C' },
        { item: 'a finding about the part of the solar system where the asteroid came from', letter: 'F' },
      ],
    },
    {
      kind: 'tfng',
      item: 'The clay at Gubbio contained roughly the amount of iridium that a steady fall of dust from space would produce.',
      answer: 'FALSE',
      evidence:
        'The clay at Gubbio contained about 30 times as much iridium as the rock around it, and a similar layer in Denmark contained about 160 times as much, far more than a steady fall of dust could explain.',
    },
    {
      kind: 'tfng',
      item: "The team's 1980 explanation was rejected by several journals before it was published.",
      answer: 'NOT GIVEN',
    },
    {
      kind: 'tfng',
      item: 'The structure at Chicxulub was detected years before a published paper identified it as an impact crater.',
      answer: 'TRUE',
      evidence:
        'Only in 1991 did they publish, with the Canadian scientist Alan Hildebrand and others, a paper identifying it as an impact crater about 180 kilometres wide, now named after the nearby village of Chicxulub.',
    },
    {
      kind: 'gapTyped',
      stem: "Iridium is extremely rare in the rocks of the Earth's ______.",
      answer: 'crust',
      evidence:
        "The metal iridium is extremely rare in the rocks of the Earth's crust but far more common in meteorites, and dust from space settles on the planet at a fairly steady rate.",
    },
    {
      kind: 'gapTyped',
      stem: 'According to the 1980 explanation, once sunlight was blocked, ______ would have stopped.',
      answer: 'photosynthesis',
      evidence:
        'Without sunlight, photosynthesis would have stopped, and food chains on land and in the sea would have collapsed.',
    },
    {
      kind: 'short',
      marks: 2,
      stem: 'Using your own words, explain how the Alvarez team expected iridium to show how long the clay had taken to form, and what they actually found.',
      answer:
        'Dust from space, which is rich in iridium, falls on the Earth at a fairly steady rate, so the longer the clay took to form, the more iridium it should contain. Instead they found far too much iridium, about 30 times the normal level at Gubbio and about 160 times in Denmark, more than a steady fall of dust could explain.',
      evidence:
        'The amount of iridium in the clay could therefore act as a clock: the longer the layer had taken to form, the more of this dust it should contain.',
      rubric:
        '两分：写出「来自太空的尘埃（含铱）以大致稳定的速度落到地球上，所以黏土层形成得越久，含的铱就应该越多（铱可以当作计时的钟）」给 1 分；写出「实际测到的铱远远超过稳定落尘所能解释的量（Gubbio 约为周围岩石的 30 倍、丹麦约 160 倍）」再给 1 分。只写「他们发现了小行星撞击」或「铱在陨石里很常见」给 0 分（没有说出预期的道理或实测结果）。',
    },
    {
      kind: 'short',
      marks: 2,
      stem: 'According to the passage, what do scientists disagree about concerning the eruptions in western India, and why has the question been difficult to settle?',
      answer:
        'They disagree about how much the eruptions contributed to the extinction: some think the eruptions had already put life under severe stress before the asteroid struck, while others think the impact alone was enough. It is hard to settle because the eruptions went on for hundreds of thousands of years, before and after the impact, and studies using different dating methods disagree about when the largest eruptions happened.',
      evidence:
        'Part of the difficulty is that the eruptions lasted for hundreds of thousands of years, before and after the impact, and studies using different dating methods have reached different conclusions about when the largest of them took place.',
      rubric:
        '两分：写出「分歧在于这些火山喷发对物种灭绝起了多大作用 —— 有人认为在小行星撞击前喷发已经让生物承受了严重压力，有人认为单靠撞击就足够」给 1 分；写出「难以定论是因为喷发在撞击前后持续了几十万年，而用不同定年方法的研究对最大规模的喷发发生在什么时候得出了不同结论」再给 1 分。只写「火山喷发改变了气候」给 0 分（那是喷发可能的影响，不是分歧所在）；只写「科学家不知道恐龙怎么灭绝的」也给 0 分（与原文不符）。',
    },
  ],
};

// ═══════════════════════════════════════════════════════════════
// 周二 —— 被改写的记忆：误导信息与目击证词（心理学）
//
// 出处与把握：
// · Loftus & Palmer 1974, J Verbal Learning & Verbal Behavior 13:585–589（原文 PDF 已核）：
//   实验一 45 名学生看 7 段车祸短片，动词 smashed 40.8 / collided 39.3 / bumped 38.1 /
//   hit 34.0 / contacted 31.8 英里每小时；实验二 150 人，一周后问有没有看到碎玻璃
//   （片中没有），smashed 组 16/50、hit 组 7/50、未问车速的对照组 6/50 说有；作者
//   认为后来的信息与原记忆融合 —— 高。正文写「about 41」「about 32」。
// · Loftus & Pickrell 1995（Psychiatric Annals）：24 人，三件真事 + 一件「五岁左右在
//   商场走失」的假事，说是亲属提供；约四分之一部分或完整地「记起」了假事件 —— 高。
// · Wade, Garry, Read & Lindsay 2002（Psychonomic Bull & Rev）：PS 过的童年热气球
//   照片，相当一部分人形成了假记忆 —— 高（正文不写比例，只写「many of them」）。
// · Murphy et al. 2023, Memory 31(6):818–830（UCC 机构库摘要已核）：爱尔兰团队预注册
//   重复「商场走失」，123 人，35% 被判为有假记忆；Andrews & Brewin 重新分析认为多数
//   只是模糊、零碎的，清楚记得的人很少（Scientific American 报道）—— 高；正文写成
//   「仍有争议」，题目不考哪方对。
// · Innocence Project「DNA Exonerations in the United States (1989–2020)」：375 名经 DNA
//   洗冤者中约 69% 涉及目击者认错人 —— 高。
// · Wixted & Wells 2017, Psychological Science in the Public Interest：只有在「干净」
//   条件下（双盲列队、首次辨认时立即记录信心）信心才是准确度的好指标；到庭审时
//   信心可能因重复、暗示、正面反馈而膨胀 —— 高（APS 新闻稿与论文摘要）。
// · 「研究影响了许多警方的辨认程序」—— 中高（美国司法部 2017 年采纳双盲等程序，
//   APS Observer 报道），正文写「has influenced」。
// ═══════════════════════════════════════════════════════════════

const MEMORY = {
  key: 'original-w7-false-memory',
  title: 'When Memory Rewrites Itself',
  passage: lettered([
    `Most people think of memory as a kind of recording: an event happens, it is stored, and later it can be played back. Decades of research suggest that this picture is misleading. Remembering seems to involve rebuilding an event from fragments each time, and information picked up afterwards can become mixed into the result. The consequences are most serious in courtrooms, where the memory of a single witness may decide whether a person goes to prison.`,
    `One of the best-known demonstrations was published in 1974 by the American psychologists Elizabeth Loftus and John Palmer. Students watched short films of traffic accidents and were then asked how fast the cars had been going when they "hit" each other. For other groups, the verb was replaced with words such as "contacted" or "smashed". The wording made a clear difference: those who heard "smashed" gave the highest estimates, averaging about 41 miles an hour, while those who heard "contacted" gave the lowest, at about 32.`,
    `A second experiment went further. A week after watching a film of a crash, participants were asked whether they had seen any broken glass. There had been none. Yet 16 of the 50 people who had earlier been asked about cars that "smashed" into each other said that they had, compared with 7 of the 50 in the "hit" group and 6 of the 50 who had not been asked about speed at all. The researchers concluded that the question had not merely influenced the answer given at the time; it seemed to have changed what people later remembered.`,
    `Later studies asked whether entire events could be added to memory. In a study published in 1995, Loftus and Jacqueline Pickrell gave 24 adults short descriptions of four events from their childhood, supposedly provided by their relatives. Three were true, but the fourth, about being lost in a shopping centre at around the age of five, had never happened. Over a series of interviews, about a quarter of the participants came to remember the invented event, either partly or in detail. In a later study by other researchers, participants were shown a doctored photograph of themselves as children in the basket of a hot-air balloon, and many of them came to recall a flight that had never taken place.`,
    `How easily such false memories form is still debated. In 2023, a team in Ireland repeated the shopping-centre study with 123 participants and reported false memories in 35 per cent of them. Other researchers who re-examined the data argued that many of these memories were vague or partial, and that very few participants clearly remembered the invented event. The disagreement depends partly on what should count as a genuine memory, and it has not been settled.`,
    `Outside the laboratory, the risks are real. The Innocence Project, an American organisation, has examined 375 cases from 1989 to 2020 in which people convicted of crimes were later cleared by DNA evidence. In about 69 per cent of them, a mistaken identification by an eyewitness had played a part. Such witnesses were not necessarily lying: a person can be honestly certain of a memory that is wrong.`,
    `This does not mean that witnesses should simply be ignored. In 2017, the psychologists John Wixted and Gary Wells reviewed the evidence and concluded that a witness's confidence can be a useful guide to accuracy, but only at the moment of the first identification, and only if the procedure is fair. The person running the line-up should not know which of its members is the suspect, and the witness's level of confidence should be recorded immediately. By the time of a trial, months later, confidence may have grown through repetition and encouragement, and it then says much less about whether the witness is right.`,
    `The research has influenced the way many police forces carry out identifications, and it offers a broader lesson. Memory is not a fixed record but a reconstruction, and the questions people are asked, the photographs they see and the stories they hear can all leave their mark on it. The feeling of remembering something clearly is not, on its own, proof that it happened.`,
  ]),
  questions: [
    {
      kind: 'matchingParagraphs',
      items: [
        { item: 'advice about when a witness\'s certainty should be measured', letter: 'G' },
        { item: 'a study in which participants were told that the information came from their families', letter: 'D' },
        { item: 'a disagreement about how to decide whether a memory is genuine', letter: 'E' },
      ],
    },
    {
      kind: 'tfng',
      item: 'In the 1974 study, the verb used in the question affected how fast people said the cars had been going.',
      answer: 'TRUE',
      evidence:
        'The wording made a clear difference: those who heard "smashed" gave the highest estimates, averaging about 41 miles an hour, while those who heard "contacted" gave the lowest, at about 32.',
    },
    {
      kind: 'tfng',
      item: 'Some broken glass could be seen in the film of the crash shown in the second experiment.',
      answer: 'FALSE',
      evidence: 'There had been none.',
    },
    {
      kind: 'tfng',
      item: "A witness's confidence at a trial is a less reliable guide to accuracy than their confidence at the first identification.",
      answer: 'TRUE',
      evidence:
        'By the time of a trial, months later, confidence may have grown through repetition and encouragement, and it then says much less about whether the witness is right.',
    },
    {
      kind: 'gapTyped',
      stem: 'In a later study, participants were shown a ______ photograph of themselves as children in a hot-air balloon.',
      answer: 'doctored',
      evidence:
        'In a later study by other researchers, participants were shown a doctored photograph of themselves as children in the basket of a hot-air balloon, and many of them came to recall a flight that had never taken place.',
    },
    {
      kind: 'gapTyped',
      stem: 'Researchers who re-examined the 2023 data argued that many of the reported memories were vague or ______.',
      answer: 'partial',
      evidence:
        'Other researchers who re-examined the data argued that many of these memories were vague or partial, and that very few participants clearly remembered the invented event.',
    },
    {
      kind: 'short',
      marks: 2,
      stem: 'Using your own words, explain what the broken-glass experiment suggested about the effect of a question on memory.',
      answer:
        'People who had been asked about cars that "smashed" into each other were much more likely to say a week later that they had seen broken glass, although there was none (16 of 50, against 7 and 6 of 50 in the other groups). This suggests that the question did not just affect the answer given at the time but actually changed what people later remembered.',
      evidence:
        'The researchers concluded that the question had not merely influenced the answer given at the time; it seemed to have changed what people later remembered.',
      rubric:
        '两分：写出「一周后，之前被问到 smashed（猛撞）的人更多地说自己看到了碎玻璃，而片中根本没有（50 人中 16 人，对比另两组 7 人、6 人）」给 1 分；写出「说明提问不只影响当时的回答，还改变了人们之后记住的内容（记忆本身被改写了）」再给 1 分。只写「人们估计的车速不同」给 0 分（那是第一个实验的结果）。',
    },
    {
      kind: 'short',
      marks: 2,
      stem: "According to the passage, under what conditions can a witness's confidence be a useful guide to whether the identification is correct?",
      answer:
        'Confidence is useful only when it is measured at the first identification, recorded immediately before it can grow through repetition and encouragement, and only when the procedure is fair, for example when the person running the line-up does not know which member is the suspect.',
      evidence:
        "In 2017, the psychologists John Wixted and Gary Wells reviewed the evidence and concluded that a witness's confidence can be a useful guide to accuracy, but only at the moment of the first identification, and only if the procedure is fair.",
      rubric:
        '两分：写出「必须是第一次辨认的时候（信心要当场立即记录下来，到庭审时已经不可靠）」给 1 分；写出「辨认程序必须公平（例如主持列队辨认的人不知道谁是嫌疑人）」再给 1 分。只写「证人很有把握的时候」给 0 分（没有说出条件）。',
    },
  ],
};

// ═══════════════════════════════════════════════════════════════
// 周三 —— 从空气里造面包：哈伯-博施合成氨（历史与技术）
//
// 出处与把握：
// · 空气约 78% 是氮，以三键结合的 N₂ 分子存在，植物不能直接利用；豆科根瘤菌与
//   闪电能固氮 —— 高（Erisman et al. 2008 原文、教科书常识）。
// · 十九世纪依赖秘鲁鸟粪（guano）与智利硝石 —— 高（Erisman 2008：「Peruvian guano,
//   Chilean saltpeter」）。1898 年 William Crookes 在英国科学促进会会长演讲中警告
//   小麦供应将赶不上人口、呼吁固定空气中的氮 —— 高（《The Wheat Problem》1898/1899）。
// · Haber 在 Karlsruhe 用高温高压 + 催化剂（锇）使氮氢合成氨；1909-07-02 向 BASF 演示
//   连续产氨的台式装置，「一滴一滴」—— 高（Science Museum Group 藏品「Sample of
//   Haber's synthetic ammonia, 2 July 1909」、Wikipedia「Haber process」）。正文不写
//   具体压力、温度（各处 175–200 bar、500–600°C 说法不一）。
// · Carl Bosch 在 BASF 放大到工业规模；锇太稀少昂贵，Alwin Mittasch 团队做了数以千计
//   的试验，找到廉价的铁基催化剂；高压氢气使钢壁变脆（氢脆）；1913 年 Oppau 工厂投产
//   —— 高（国际肥料协会 HABER.pdf、Wikipedia）。正文写「thousands of tests」，不写
//   具体次数（两万次等说法不一）。
// · 一战：英国封锁切断智利硝石，合成氨保住德国炸药生产；Haber 主持德国毒气研制；
//   1918 年度诺贝尔化学奖（1919 年颁发）引发强烈批评；Bosch 1931 年获诺贝尔奖 ——
//   高（Erisman 2008、Nobel Prize 官网）。
// · Smil：二十世纪末约 40% 世界人口靠化肥氮生产的粮食；Erisman 2008：2008 年约 48%
//   （「around half of humanity」）；精确数字难算，因为育种、耕作方式也提高了产量 ——
//   高（Erisman 2008 原文 PDF 已核）。
// · 二战后化肥产量大增 —— 高（Smil、Erisman 图 1）。
// · Erisman 2008：2005 年约 100 Tg N 用于农业，人类经由食物只吃进约 17 Tg N；多余氮
//   进入水体、大气，导致藻华、水质下降、陆地生物多样性下降、温室气体（N₂O）—— 高。
//   正文写「Much of the rest escapes」（原文说约 40% 损失的氮反硝化回到大气，并非全部
//   造成污染）。
// · 合成氨耗能大、主要用天然气 —— 高（Wikipedia：占全球天然气消费 3–5%，正文不写数字）。
// ═══════════════════════════════════════════════════════════════

const AMMONIA = {
  key: 'original-w7-haber-bosch',
  title: 'Bread from the Air',
  passage: lettered([
    `Every living thing needs nitrogen. It is an essential part of proteins and of DNA, and for crops it is often the nutrient in shortest supply. The irony is that nitrogen is everywhere: it makes up about 78 per cent of the air. However, almost all of it exists as pairs of atoms held together by an extremely strong bond, in a form that plants cannot use. In nature, only certain bacteria, including those that live in the roots of peas, beans and clover, and, to a lesser extent, lightning can convert it into a usable form.`,
    `For most of history, farmers maintained the nitrogen in their soil by growing such plants and by spreading manure. In the nineteenth century, as populations grew, Europe began to import nitrogen from much further away, first as guano, the accumulated droppings of seabirds, from islands off the coast of Peru, and later as saltpetre mined in the deserts of Chile. These supplies were limited. In 1898, the British scientist William Crookes warned that the world's production of wheat would soon fail to keep up with its growing population unless chemists found a way to capture nitrogen from the air.`,
    `The German chemist Fritz Haber found a way to do so. Working at Karlsruhe, he made nitrogen from the air react with hydrogen to form ammonia, a compound from which fertilisers can be made. The reaction required very high pressure and temperature, together with a catalyst to speed it up. In July 1909, Haber demonstrated a small apparatus to the chemical company BASF that produced ammonia continuously, drop by drop.`,
    `Turning this laboratory success into an industry was a different problem, and it was solved largely by Carl Bosch, a chemist and engineer at BASF. Haber's catalyst, the rare metal osmium, was far too scarce and expensive for large-scale use, so a team led by Alwin Mittasch carried out thousands of tests before settling on a cheap catalyst based on iron. Bosch also had to build vessels strong enough to hold hot gases at enormous pressure; at first, the hydrogen attacked the steel walls and made them brittle. The first factory, using the iron catalyst, began production at Oppau in 1913.`,
    `The process soon had a darker use. Ammonia can be converted into nitric acid, a starting material for explosives. During the First World War, a British naval blockade cut Germany off from Chilean saltpetre, and the new factories allowed it to continue making munitions. Haber himself also directed Germany's development of poison gas, and when he was awarded the Nobel Prize in Chemistry for 1918, the decision was strongly criticised. Bosch received a Nobel Prize of his own in 1931.`,
    `Yet the greatest effect has been on food. After the Second World War, fertiliser production expanded enormously, and crop yields rose around the world. Researchers have tried to estimate how many people depend on this nitrogen. The scientist Vaclav Smil estimated that by the end of the twentieth century about 40 per cent of the world's population relied on it for their food, and a study published in 2008 put the figure at nearly half. Such numbers are difficult to calculate precisely, because yields have also been raised by better crop varieties and farming methods, but there is little doubt that billions of people have been fed as a result.`,
    `This success has come at a cost. Much of the nitrogen spread on fields is never taken up by crops. According to the same 2008 study, of roughly 100 million tonnes of nitrogen from the process used in agriculture in 2005, only about 17 million tonnes was eaten by people in their food. Much of the rest escapes into rivers, coastal waters and the air. There it can feed blooms of algae that leave water short of oxygen, reduce the variety of plant life on land and form nitrous oxide, a powerful greenhouse gas. Making ammonia also consumes large amounts of energy, most of it from natural gas.`,
    `More than a century after Crookes's warning, the problem has in a sense been reversed. The challenge is no longer to find enough usable nitrogen but to use it more carefully: applying fertiliser more precisely, reducing waste and finding cleaner ways to make ammonia. Haber's invention helped to feed a growing world. Learning to manage its side effects may prove just as difficult.`,
  ]),
  questions: [
    {
      kind: 'matchingParagraphs',
      items: [
        { item: 'the search for a material cheap enough to be used in factories', letter: 'D' },
        { item: 'a reason why a figure is hard to calculate exactly', letter: 'F' },
        { item: 'a prediction that food supplies would fall behind population growth', letter: 'B' },
      ],
    },
    {
      kind: 'tfng',
      item: "Most scientists of the time dismissed Crookes's warning about wheat.",
      answer: 'NOT GIVEN',
    },
    {
      kind: 'tfng',
      item: 'The catalyst used in the first factories was cheaper than the one Haber had used in his laboratory.',
      answer: 'TRUE',
      evidence:
        "Haber's catalyst, the rare metal osmium, was far too scarce and expensive for large-scale use, so a team led by Alwin Mittasch carried out thousands of tests before settling on a cheap catalyst based on iron.",
    },
    {
      kind: 'tfng',
      item: 'Farmers in Europe now use nitrogen fertiliser more efficiently than farmers in other parts of the world.',
      answer: 'NOT GIVEN',
    },
    {
      kind: 'gapTyped',
      stem: 'Guano consists of the accumulated ______ of seabirds.',
      answer: 'droppings',
      evidence:
        'In the nineteenth century, as populations grew, Europe began to import nitrogen from much further away, first as guano, the accumulated droppings of seabirds, from islands off the coast of Peru, and later as saltpetre mined in the deserts of Chile.',
    },
    {
      kind: 'gapTyped',
      stem: 'In the early vessels, hydrogen attacked the steel walls and made them ______.',
      answer: 'brittle',
      evidence:
        'Bosch also had to build vessels strong enough to hold hot gases at enormous pressure; at first, the hydrogen attacked the steel walls and made them brittle.',
    },
    {
      kind: 'short',
      marks: 2,
      stem: 'Using your own words, explain why crops are often short of nitrogen even though there is so much of it in the air.',
      answer:
        'Almost all the nitrogen in the air is in pairs of atoms joined by a very strong bond, and plants cannot use it in that form. It has to be changed into a usable form first, and in nature only certain bacteria, such as those in the roots of peas and beans, and lightning can do this.',
      evidence:
        'However, almost all of it exists as pairs of atoms held together by an extremely strong bond, in a form that plants cannot use.',
      rubric:
        '两分：写出「空气中的氮几乎都是两个原子以极强的键结合在一起，植物无法直接利用这种形态」给 1 分；写出「在自然界里只有某些细菌（如豌豆、豆子、三叶草根部的细菌）和闪电能把它变成可用的形态」再给 1 分。只写「土壤里的氮不够」或「农民没有施肥」给 0 分（没有解释空气中的氮为什么用不上）。',
    },
    {
      kind: 'short',
      marks: 2,
      stem: 'According to the passage, what happens to much of the nitrogen fertiliser that is spread on fields, and why is this a problem?',
      answer:
        'Much of it is never taken up by crops: of about 100 million tonnes used in 2005, only about 17 million tonnes ended up in the food people ate, and much of the rest escapes into rivers, coastal waters and the air. There it causes harm, for example by feeding blooms of algae that leave water short of oxygen, reducing the variety of plants on land, or forming nitrous oxide, a powerful greenhouse gas.',
      evidence: 'Much of the rest escapes into rivers, coastal waters and the air.',
      rubric:
        '两分：写出「大量的氮没有被作物吸收，而是流失到河流、近海和大气里（2005 年约 1 亿吨用于农业，只有约 1700 万吨进入人吃的食物）」给 1 分；写出以下任一种危害再给 1 分 —— 引起藻类大量繁殖、使水体缺氧；使陆地植物种类减少；生成强效温室气体一氧化二氮。只写「生产合成氨很耗能」给 0 分（那说的是生产过程，不是施到田里的氮的去向）。',
    },
  ],
};

// ═══════════════════════════════════════════════════════════════
// 周四 —— 重新认识拉帕努伊（复活节岛）（环境）
//
// 出处与把握：
// · 距智利本土约 3,512 公里、近千尊 moai；荷兰人 Jacob Roggeveen 1722 年复活节
//   （4 月 5 日）抵达 —— 高（Wikipedia「Easter Island」）。十八世纪来访者看到的是
//   几乎没有树的岛 —— 中高（Roggeveen、Cook 的记述被多处转引），正文写「largely
//   treeless」。
// · Diamond 2005《Collapse》：「生态自杀」叙事 —— 砍光树林（部分为运输、竖立石像），
//   无木造远洋独木舟、水土流失、饥荒与战争，欧洲人到来前社会已崩溃 —— 高。
//   湖泊沉积物花粉显示岛上曾有森林，含一种已灭绝的巨型棕榈 —— 高（Flenley & King
//   1984 Nature 等；Wikipedia）。
// · Hunt & Lipo 2006, Science「Late colonization of Easter Island」：放射性碳定年显示
//   约公元 1200 年才有人定居，比原先估计晚几百年；出土大量被老鼠啃过的棕榈种子；
//   太平洋鼠无天敌、吃种子阻碍森林再生；岛民以石块覆盖的「石头园」种植适应环境
//   —— 高（Mongabay、Live Science 2006 报道；Hunt & Lipo 2011《The Statues That
//   Walked》）。石头园保湿防风 —— 中高（Davis 2024 论文引言）。
// · DiNapoli et al. 2020, Journal of Archaeological Science：石像平台（ahu）建造在
//   1722 年欧洲人到来后仍在继续 —— 高（Binghamton 大学新闻稿、Phys.org）。
// · Davis et al. 2024, Science Advances：卫星影像 + 机器学习绘制石头园，可养活约
//   3,900 人（含渔获），远少于以往一万多人的估计 —— 高，正文写「only a few thousand」。
// · Moreno-Mayar et al. 2024, Nature：15 名生活于 1670–1950 年间的岛民全基因组，
//   没有十七世纪人口骤降的遗传信号 —— 高（哥本哈根大学新闻稿）。
// · 1862–63 年秘鲁奴隶贩子掳走约 1,500 人（约三分之一），被送回的幸存者带回天花；
//   1877 年仅剩 111 名原住民 —— 高（Wikipedia、Moreno-Mayar 2024 新闻稿「a third」）。
// · 第七段「森林确实消失了；峰值人口多少、失去树林后果多严重，学界仍有分歧」写成
//   分歧，不归给具体某人；题目不考哪方对。
// ═══════════════════════════════════════════════════════════════

const RAPA_NUI = {
  key: 'original-w7-rapa-nui',
  title: 'Rethinking Rapa Nui',
  passage: lettered([
    `Rapa Nui, also known as Easter Island, is one of the most remote inhabited places on Earth, lying more than 3,500 kilometres west of Chile. It is famous for its moai, nearly a thousand giant stone figures carved by the Polynesian people who settled it. The first European to reach the island, the Dutch explorer Jacob Roggeveen, arrived on Easter Sunday in 1722. Visitors in the following decades described a largely treeless landscape, and many later observers wondered how its inhabitants could have moved such enormous statues.`,
    `For many readers, the answer was supplied by the geographer Jared Diamond in his 2005 book Collapse. Pollen preserved in the island's lake sediments had shown that it was once covered by forest, including a giant palm that no longer exists. According to Diamond, the islanders cut the trees down, partly to transport and raise the statues, until almost none were left. Without timber they could no longer build canoes for fishing far out at sea, the exposed soil was eroded, and the society fell into famine and warfare before Europeans ever arrived. The island became a famous warning about what happens when people destroy their own environment.`,
    `Since the early 2000s, this account has been increasingly challenged. In 2006, the archaeologists Terry Hunt and Carl Lipo published new radiocarbon dates suggesting that people had first settled the island around AD 1200, several centuries later than had been thought. This meant that everything the older story described, from the clearing of the forest to the carving of the statues, had to fit into a much shorter period.`,
    `Hunt and Lipo also pointed to another culprit. The settlers brought with them the Pacific rat, which had no predators on the island. Many of the palm seeds that archaeologists have recovered show signs of having been gnawed by rats, and on this view the rats, by eating the seeds, prevented the forest from regrowing, so people were not the only cause of its loss. The two researchers further argued that the islanders adapted to the changing landscape, for example by growing crops in gardens covered with stones, which helped to keep the soil moist and protect plants from the wind.`,
    `More recent studies have added further evidence. A 2020 analysis of the stone platforms on which many of the statues stand found that their construction continued after Europeans arrived in 1722, which is difficult to reconcile with a society that had already collapsed. In 2024, researchers used satellite images to map the stone gardens and concluded that they could have fed only a few thousand people, far fewer than earlier estimates of the island's peak population. In the same year, an analysis of DNA from 15 islanders who lived between the seventeenth and twentieth centuries found no sign of a sharp fall in population before European contact.`,
    `The most dramatic decline came later, and from outside. In 1862 and 1863, slave raiders from Peru carried off around 1,500 islanders, roughly a third of the population, and returning survivors brought smallpox, which spread rapidly. By 1877, only 111 Rapa Nui people remained on the island.`,
    `Not everyone accepts the new account in full. All sides agree that the forest disappeared, but researchers still disagree about how large the population was at its peak and about how serious the loss of the trees was for the people who lived there. The argument is partly about evidence and partly about interpretation, since the same facts can be fitted into a story of collapse or into one of adaptation.`,
    `Whatever the final verdict, the way the island is described has changed. It was once presented as a society that destroyed itself through its own carelessness. Increasingly, it is seen as one that survived for centuries in a difficult and changing environment, only to be devastated by outsiders. The case also shows how a compelling story can spread widely before the evidence for it has been fully tested.`,
  ]),
  questions: [
    {
      kind: 'matchingParagraphs',
      items: [
        { item: 'an estimate of how many people the land could have supported', letter: 'E' },
        { item: 'the part played by an animal in the loss of the forest', letter: 'D' },
        { item: 'the evidence that the island had once been covered by trees', letter: 'B' },
      ],
    },
    {
      kind: 'tfng',
      item: 'The dates published by Hunt and Lipo suggested that people reached the island later than previously believed.',
      answer: 'TRUE',
      evidence:
        'In 2006, the archaeologists Terry Hunt and Carl Lipo published new radiocarbon dates suggesting that people had first settled the island around AD 1200, several centuries later than had been thought.',
    },
    {
      kind: 'tfng',
      item: 'The 2020 study found that the building of statue platforms had stopped before Europeans arrived.',
      answer: 'FALSE',
      evidence:
        'A 2020 analysis of the stone platforms on which many of the statues stand found that their construction continued after Europeans arrived in 1722, which is difficult to reconcile with a society that had already collapsed.',
    },
    {
      kind: 'tfng',
      item: 'The slave raiders from Peru also took away several of the stone statues.',
      answer: 'NOT GIVEN',
    },
    {
      kind: 'gapTyped',
      stem: 'Many of the palm seeds found by archaeologists show signs of having been ______ by rats.',
      answer: 'gnawed',
      evidence:
        'Many of the palm seeds that archaeologists have recovered show signs of having been gnawed by rats, and on this view the rats, by eating the seeds, prevented the forest from regrowing, so people were not the only cause of its loss.',
    },
    {
      kind: 'gapTyped',
      stem: 'In Diamond\'s account, once the trees had gone, the exposed soil was ______.',
      answer: 'eroded',
      evidence:
        'Without timber they could no longer build canoes for fishing far out at sea, the exposed soil was eroded, and the society fell into famine and warfare before Europeans ever arrived.',
    },
    {
      kind: 'short',
      marks: 2,
      stem: 'According to Hunt and Lipo, what else besides people contributed to the loss of the forest, and how did the islanders respond to the changed landscape?',
      answer:
        'The settlers brought the Pacific rat, which had no predators on the island and ate the palm seeds, so the forest could not grow back. The islanders adapted, for example by growing crops in gardens covered with stones, which kept the soil moist and protected plants from the wind.',
      evidence:
        'The two researchers further argued that the islanders adapted to the changing landscape, for example by growing crops in gardens covered with stones, which helped to keep the soil moist and protect plants from the wind.',
      rubric:
        '两分：写出「定居者带来的太平洋鼠（岛上没有天敌）吃掉了棕榈种子，使森林无法重新长起来」给 1 分；写出「岛民适应了变化，例如在铺满石块的园子里种庄稼，石头能保持土壤湿润、替作物挡风」再给 1 分。只写「岛民砍树造独木舟」给 0 分（那是 Diamond 的说法，不是 Hunt 和 Lipo 的）。',
    },
    {
      kind: 'short',
      marks: 2,
      stem: "Using your own words, explain what caused the most dramatic fall in the island's population.",
      answer:
        'In 1862 and 1863, slave raiders from Peru took away about 1,500 islanders, around a third of the population. Then survivors who returned brought smallpox with them, and it spread quickly, so that by 1877 only 111 Rapa Nui people were left.',
      evidence:
        'In 1862 and 1863, slave raiders from Peru carried off around 1,500 islanders, roughly a third of the population, and returning survivors brought smallpox, which spread rapidly.',
      rubric:
        '两分：写出「1862–1863 年秘鲁的奴隶贩子掳走了约 1,500 名岛民（约占人口三分之一）」给 1 分；写出「被送回来的幸存者带回了天花，迅速传播开来」再给 1 分。只写「岛民砍光了森林、发生饥荒」给 0 分（文章说最剧烈的人口下降来自外部，而且发生得更晚）。',
    },
  ],
};

// ═══════════════════════════════════════════════════════════════
// 周五 —— 什么都不做的力量：默认选项（社会 / 经济）
//
// 出处与把握：
// · Madrian & Shea 2001, QJE「The Power of Suggestion」（NBER w7682 原文 PDF 已核）：
//   美国一家大公司 1998-04-01 起新员工自动加入 401(k)、可退出（同日还取消了一年等待期，
//   正文没写）；公司配款规则与投资选项不变；
//   工龄 3–15 个月的可比人群参加率 37%（旧规则）对 86%（自动加入）；默认缴费率 3%、
//   全部投货币市场基金，61% 的新员工完全停在默认上，而改革前入职的人很少选这个组合；
//   解释为惰性与把默认当作公司的投资建议 —— 高。正文「most of them stayed」对应 61%。
// · Johnson & Goldstein 2003, Science 302:1338–1339「Do Defaults Save Lives?」（原文 PDF
//   已核）：哥伦比亚大学决策科学中心；在线实验 161 人，opt-in 42%、opt-out 82%、无默认
//   79%；有效同意率德国 12%、奥地利 99.98%；默认起作用的三个原因：当作政策制定者的
//   推荐、接受默认不费力（而作决定令人不快）、默认代表现状 + 损失厌恶；回归分析显示
//   推定同意使实际捐献增加约 16.3%（每百万 14.1 → 16.4）—— 高。
// · Arshad, Anderson & Sharif 2019, Kidney International 95(6):1453–1460：35 个 OECD
//   国家（17 opt-out、18 opt-in），死后捐献者每百万人 20.3 对 15.4、差异不显著；
//   opt-out 国家活体捐献显著更少（4.8 对 15.7）—— 高（摘要）。
// · 西班牙 1979 年立推定同意法，捐献率直到 1989 年成立国家移植组织（ONT）后才上升；
//   捐献率世界领先 —— 高（Matesanz 向北爱尔兰议会的书面材料、ONT 资料）。
// · 「很多国家医生仍会征询家属意见、家属可以拒绝」—— 高（Johnson & Goldstein 原文
//   列「families' objections」；西班牙模式家属同意为准；Thaler 的评论），正文写「In many
//   countries」。
// · 英国自动加入职业养老金：2012 年 10 月起按雇主规模分批实施；合资格雇员参加比例
//   2012 年 55% → 2018 年 87% —— 高（DWP「Automatic Enrolment evaluation report 2019」）。
// · 末段「默认从来不是中立的、选错默认会让人在不知不觉中吃亏」写成批评者 / 作者
//   观点，不归给具体研究。
// ═══════════════════════════════════════════════════════════════

const DEFAULTS = {
  key: 'original-w7-defaults',
  title: 'The Power of Doing Nothing',
  passage: lettered([
    `Every form, contract and computer setting has a default: the option that applies if a person makes no active choice. Defaults might seem a minor technical detail. Traditional economic theory assumed that people with clear preferences would simply change any option that did not suit them. Yet a large body of research shows that the option chosen in advance has a powerful influence on what people end up with.`,
    `A well-known example comes from retirement savings in the United States, where many employers offer a savings plan known as a 401(k). In 2001, the economists Brigitte Madrian and Dennis Shea published a study of a large company that had changed its rules in April 1998. Previously, new employees had to sign up for the plan themselves; afterwards, they were enrolled automatically unless they chose to leave. The money that the company added to workers' savings and the choice of investments stayed the same. Among workers who had been employed for a similar length of time, the share taking part rose from 37 per cent under the old rules to 86 per cent under the new ones.`,
    `The default affected more than participation. Workers who were enrolled automatically had 3 per cent of their pay placed in a low-risk money market fund, and most of them stayed with this arrangement, even though very few employees hired before the change had chosen it. Madrian and Shea suggested two explanations: inertia, since changing the arrangement required effort, and a tendency to treat the company's chosen option as a form of advice. The default could therefore keep some people saving less than they would otherwise have chosen.`,
    `Organ donation provides an even more striking case. In 2003, Eric Johnson and Daniel Goldstein, two researchers at Columbia University, compared European countries with different rules. In some, people are donors only if they register to be one; in others, everyone is presumed to consent unless they register an objection. In Germany, which used the first system, about 12 per cent of people had agreed to donate, whereas in neighbouring Austria, which used the second, the figure was 99.98 per cent. In an online experiment, 42 per cent of participants agreed to be donors when they had to opt in, compared with 82 per cent when they had to opt out.`,
    `Johnson and Goldstein proposed three reasons why defaults are so powerful. People may treat the default as a recommendation from whoever designed the system. Accepting it requires no effort, whereas changing it means making a decision that may be unpleasant to think about. And the default usually represents the existing situation, which people are reluctant to give up, because losses weigh more heavily in the mind than equivalent gains.`,
    `However, agreeing to donate is not the same as donating. In many countries, doctors still consult the families of people who have died, and a family may refuse. Johnson and Goldstein's own analysis found that presumed consent was associated with an increase in actual donations of around 16 per cent, far smaller than the gap in consent rates. A 2019 comparison of 35 wealthy countries found no significant difference between the two systems in donations after death, and countries using presumed consent had fewer living donors. Spain, which has one of the highest donation rates in the world, introduced presumed consent in 1979, but its rates began to rise only after it created a national transplant organisation in 1989.`,
    `Despite these complications, defaults have become a common tool of public policy. In the United Kingdom, employers were gradually required, from 2012 onwards, to enrol most of their workers automatically in a workplace pension, and the share of eligible employees saving in one rose from 55 per cent in 2012 to 87 per cent in 2018. The approach appeals to governments because it changes behaviour while leaving people free to choose otherwise.`,
    `Critics point out, however, that a default is never neutral: someone has to decide what it should be, and a poorly chosen default can leave people worse off without their noticing. The research suggests that the real question for policy-makers is not whether to have a default, since every system has one, but which default to choose, and whether changing it is enough on its own to achieve the intended result.`,
  ]),
  questions: [
    {
      kind: 'matchingParagraphs',
      items: [
        { item: 'a country whose success depended on more than a change in the law', letter: 'F' },
        { item: 'the idea that people feel losses more strongly than gains', letter: 'E' },
        { item: 'a comparison between employees who had worked for a company for a similar time', letter: 'B' },
      ],
    },
    {
      kind: 'tfng',
      item: "When it introduced automatic enrolment, the company also increased the amount it added to workers' savings.",
      answer: 'FALSE',
      evidence: "The money that the company added to workers' savings and the choice of investments stayed the same.",
    },
    {
      kind: 'tfng',
      item: "Most of the participants in Johnson and Goldstein's online experiment were university students.",
      answer: 'NOT GIVEN',
    },
    {
      kind: 'tfng',
      item: 'The 2019 comparison found that countries using presumed consent had more living donors than other countries.',
      answer: 'FALSE',
      evidence:
        'A 2019 comparison of 35 wealthy countries found no significant difference between the two systems in donations after death, and countries using presumed consent had fewer living donors.',
    },
    {
      kind: 'gapTyped',
      stem: 'One explanation Madrian and Shea gave for workers keeping the default arrangement was ______.',
      answer: 'inertia',
      evidence:
        "Madrian and Shea suggested two explanations: inertia, since changing the arrangement required effort, and a tendency to treat the company's chosen option as a form of advice.",
    },
    {
      kind: 'gapTyped',
      stem: 'Under presumed consent, everyone is treated as a donor unless they register an ______.',
      answer: 'objection',
      evidence:
        'In some, people are donors only if they register to be one; in others, everyone is presumed to consent unless they register an objection.',
    },
    {
      kind: 'short',
      marks: 2,
      stem: 'Using your own words, explain why the large gap in consent rates between countries may exaggerate the effect of defaults on organ donation.',
      answer:
        'Agreeing to donate is not the same as donating, because doctors often still ask the family of the person who has died, and the family can say no. When actual donations are measured, the effect is much smaller: Johnson and Goldstein found an increase of only about 16 per cent, and a 2019 study of 35 countries found no significant difference in donations after death.',
      evidence: 'However, agreeing to donate is not the same as donating.',
      rubric:
        '两分：写出「同意捐献不等于真的捐献 —— 很多国家医生仍会征求逝者家属的意见，家属可以拒绝」给 1 分；写出「按实际捐献数量看，效果小得多（Johnson 和 Goldstein 自己算出只增加约 16%；2019 年对 35 个国家的比较发现死后捐献没有显著差别；西班牙的捐献率在 1989 年建立全国移植机构后才上升）」再给 1 分，写出其中任一项事实即可。只写「德国是 12%，奥地利是 99.98%」给 0 分（那是同意率本身，不是夸大的原因）。',
    },
    {
      kind: 'short',
      marks: 2,
      stem: 'Why are defaults attractive to governments, and what objection do critics raise?',
      answer:
        'Governments like them because they change how people behave while still leaving everyone free to choose a different option. Critics say a default is never neutral: someone has to decide what it is, and a badly chosen default can leave people worse off without them realising it.',
      evidence:
        'The approach appeals to governments because it changes behaviour while leaving people free to choose otherwise.',
      rubric:
        '两分：写出「默认选项能改变人们的行为，同时仍让每个人可以自由地选择别的选项」给 1 分；写出「批评者认为默认从来不是中立的 —— 总得有人决定默认是什么，选得不好的默认会让人在不知不觉中吃亏」再给 1 分。只写「默认选项很省钱」给 0 分（原文没有这样说）。',
    },
  ],
};

const SPECS = [ASTEROID, MEMORY, AMMONIA, RAPA_NUI, DEFAULTS];

module.exports = {
  LEVEL,
  SPECS,
  DAYS: DATES.slice(0, SPECS.length).map((date, i) => buildAuthoredDay(SPECS[i], date)),
};
