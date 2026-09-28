/**
 * 第五周 —— **ielts_authentic（雅思真题难度）**档，全原创学术说明文。
 *
 * 六百词上下、八段、按 Paragraph A–H 编号。形状与第四周这一档一致：
 *   3 道段落信息配对 · 3 道判断 · 2 道原文单词填空（要拼写） ·
 *   2 道两分主观题 —— 满分 12。
 *
 * 判断题按第四周外部审查的规矩：不再每天真 / 假 / 未提及各一道，按周看分布
 * （三种答案每种至少 3 道，单天不许全一样）。
 *
 * 研究与数字只写能对上公开出处的（见每篇上方注释），拿不准的一律不写
 * 具体数字。文章是自己写的，研究结论用自己的话转述。
 * 选题前对过学生读过的 225 篇标题；前两周本档写过的霉菌 / 青霉素、香蕉、
 * 邓巴数、安慰剂、蚊子、雁阵、集装箱、棉花糖、补液盐、天气预报都避开。
 */

'use strict';

const { buildAuthoredDay, lettered } = require('../authored');
const { DATES } = require('./dates');

const LEVEL = 'ielts_authentic';

// ═══════════════════════════════════════════════════════════════
// 周一 —— 旁观者效应的再审视（心理学）
//
// 出处：
// · Genovese 案：1964-03-13 在纽约皇后区遇害；两周后《纽约时报》报道称 38 名
//   邻居看到或听到袭击、案发时无人报警（标题写 37，正文 38）。
// · Darley & Latané 1968（J Pers Soc Psychol 8:377–383，对讲机「癫痫发作」实验，
//   受害者声音是录音）：以为只有自己听见的 85% 在发作声停止（受害者被切断）前去报告，
//   以为另有四人听见的只有 31%。二人当时分别在纽约大学、哥伦比亚大学。
// · Latané & Darley 1968（J Pers Soc Psychol 10:215–221，烟雾实验）：独自一人 75%
//   报告；与两名被指示无视烟雾的同伴同屋只有 10%，其余继续填问卷；没报告的人事后
//   把烟解释成蒸汽 / 空调水汽等无害之物。两种解释：多元无知（看别人反应判断是否
//   紧急）与责任分散。
// · Manning, Levine & Collins 2007（American Psychologist 62:555–562，三位英国心理
//   学家）：没有证据表明有 38 名目击者、目击者看到了谋杀或目击者无所作为；目击者
//   只听到 / 看到片段、无人看到全过程、有人以为是吵架；一名邻居从窗口朝凶手喊话，
//   另一名邻居出门去到她身边。
// · 《纽约时报》2016（凶手 Moseley 讣告）承认原报道「grossly exaggerated the number
//   of witnesses and what they had perceived」—— 文中转述，不直引。
// · Fischer 等 2011（Psychological Bulletin 137:517–537，元分析，7,700 余名参与者、
//   105 个效应量）：危险情境下旁观者效应减弱；解释为危险情境更快被认作真正的紧急
//   情况，且其他旁观者可提供身体上的支持。
// · Philpot, Liebst, Levine, Bernasco & Lindegaard 2020（American Psychologist 75:66–75）：
//   阿姆斯特丹、开普敦、兰卡斯特三城监控录像 219 起公共冲突，约九成至少一名、通常
//   多名旁观者出手（安抚手势、挡在双方之间、拉开等）；三国干预可能性相近，尽管公共
//   安全感差别很大；旁观者越多，有人出手的可能性越大；研究看的是「至少一人出手」的
//   总体概率，传统实验看的是个人出手概率。
// · 急救课教「指定某一个人、交代具体任务」（如美国心脏协会 BLS 培训）—— 常识性表述，
//   文中写「许多急救课」，不写具体机构。
// ═══════════════════════════════════════════════════════════════

const BYSTANDER = {
  key: 'original-w5-bystander-effect',
  title: 'Safety in Numbers?',
  passage: lettered([
    `In March 1964, a young woman named Kitty Genovese was murdered outside her home in New York. Two weeks later, The New York Times reported that 38 of her neighbours had seen or heard the attack and that none of them had called the police while it was happening. The story seemed to confirm a widespread fear that people in large cities had stopped caring about one another.`,
    `Two young psychologists in New York, John Darley and Bibb Latané, suspected that the cause was not indifference but the presence of other people. In a 1968 experiment, students in separate rooms, unable to see one another, talked over an intercom, and one voice, in fact a recording, appeared to have a seizure. Of those who believed they were the only other listener, 85 per cent reported the emergency before the sounds stopped; of those who believed four others could also hear it, only 31 per cent did so.`,
    `In a second study, smoke poured through a vent into a room where students were filling in a questionnaire. Three-quarters of those working alone reported it, but when two other people in the room had been told to ignore it, only one in ten did so. Some of those who stayed silent later explained that they had decided it must be steam or something equally harmless.`,
    `The experiments suggested two explanations. First, when a situation is unclear, people look to others to decide what is happening; if nobody seems worried, each concludes that nothing is wrong, even though everyone may privately be unsure. Second, the more people are present, the less any one of them feels that helping is his or her own job, a process known as diffusion of responsibility. The pattern itself became known as the bystander effect, with the Genovese case as its textbook example.`,
    `The case itself, however, turned out to be much weaker than the story. In 2007, three British psychologists re-examined the evidence and found nothing to support the claim that 38 people had watched and done nothing. Far fewer people had witnessed the attack than had been reported, none had seen all of it, and some believed they were hearing a quarrel. One man shouted at the attacker from his window, and a neighbour went out to help the victim. In 2016 the newspaper acknowledged that it had greatly exaggerated both the number of witnesses and what they had perceived.`,
    `Doubts also arose about how well laboratory findings apply to real emergencies. A 2011 review that combined earlier studies involving more than 7,700 participants found that the effect was clear in situations that were not dangerous but much weaker in dangerous ones. Its authors suggested that obvious danger is recognised as an emergency more quickly, and that other bystanders can then be a source of physical support rather than a reason to hold back.`,
    `The strongest challenge came from real footage. In 2020, an international team examined 219 arguments and fights recorded by security cameras in Amsterdam, Cape Town and the English city of Lancaster. In about nine cases out of ten, at least one bystander, and usually several, did something to help, such as making calming gestures or stepping between the people involved. Intervention was about equally likely in all three cities, although they differ greatly in how safe their streets are thought to be. Moreover, the more bystanders were present, the more likely it was that someone would step in.`,
    `This does not necessarily mean that the laboratory studies were wrong. The experiments measured how likely each individual was to act, whereas the cameras recorded whether anyone acted at all. A person in a crowd may still hesitate, but a larger crowd also contains more potential helpers, and for someone in trouble that is what matters. The practical lesson, taught on many first-aid courses, is not to appeal to a crowd in general but to point to one particular person and give them a specific task.`,
  ]),
  questions: [
    {
      kind: 'matchingParagraphs',
      items: [
        { item: 'advice on how to get help from a group of strangers', letter: 'H' },
        { item: 'an explanation that some participants gave for not reporting a problem', letter: 'C' },
        { item: 'an admission of error by the source of a famous story', letter: 'E' },
      ],
    },
    {
      kind: 'tfng',
      item: 'In the intercom experiment, the participants could see the person who appeared to be ill.',
      answer: 'FALSE',
      evidence:
        'In a 1968 experiment, students in separate rooms, unable to see one another, talked over an intercom, and one voice, in fact a recording, appeared to have a seizure.',
    },
    {
      kind: 'tfng',
      item: 'According to the 2011 review, the presence of other people had less effect on helping when a situation was dangerous.',
      answer: 'TRUE',
      evidence:
        'A 2011 review that combined earlier studies involving more than 7,700 participants found that the effect was clear in situations that were not dangerous but much weaker in dangerous ones.',
    },
    {
      kind: 'tfng',
      item: 'The 2020 study found that bystanders in Cape Town were less willing to intervene than those in the two European cities.',
      answer: 'FALSE',
      evidence:
        'Intervention was about equally likely in all three cities, although they differ greatly in how safe their streets are thought to be.',
    },
    {
      kind: 'gapTyped',
      stem: "The idea that helping feels less like one's own job when more people are present is known as ______ of responsibility.",
      answer: 'diffusion',
      evidence:
        'Second, the more people are present, the less any one of them feels that helping is his or her own job, a process known as diffusion of responsibility.',
    },
    {
      kind: 'gapTyped',
      stem: 'In the 2020 study, bystanders helped by making calming ______ or by stepping between the people involved.',
      answer: 'gestures',
      evidence:
        'In about nine cases out of ten, at least one bystander, and usually several, did something to help, such as making calming gestures or stepping between the people involved.',
    },
    {
      kind: 'short',
      marks: 2,
      stem: 'Using your own words, explain why the Genovese case is now seen as a poor example of the bystander effect.',
      answer:
        'Far fewer people saw the attack than was claimed, none of them saw all of it and some thought it was only a quarrel, so it is not true that many people clearly watched and did nothing; in fact some neighbours did act, since one shouted at the attacker and another went out to help.',
      evidence:
        'Far fewer people had witnessed the attack than had been reported, none had seen all of it, and some believed they were hearing a quarrel.',
      rubric:
        '两分：写出以下任一点给 1 分 —— 目击者远没有报道说的那么多；没有人看到全过程；有人以为只是在吵架（即并不是清楚看见却袖手旁观）。写出「其实有人出手了：有人从窗口朝凶手喊话、有邻居出门去帮她」再给 1 分。只写「报纸报道错了」而不说错在哪里给 0 分。',
    },
    {
      kind: 'short',
      marks: 2,
      stem: 'According to the writer, why do the camera study and the laboratory experiments not necessarily contradict each other?',
      answer:
        'They measured different things: the experiments looked at how likely each individual was to act, while the cameras showed whether anyone at all acted. Each person in a crowd may still hesitate, but a bigger crowd contains more people who might help, so it is more likely that someone will.',
      evidence: 'The experiments measured how likely each individual was to act, whereas the cameras recorded whether anyone acted at all.',
      rubric:
        '两分：写出「两者测的东西不同：实验看每个人各自出手的可能性，录像看有没有任何一个人出手」给 1 分；写出「人群里的每个人也许仍会犹豫，但人越多、可能出手帮忙的人也越多」再给 1 分。只写「实验室和现实不一样」给 0 分。',
    },
  ],
};

// ═══════════════════════════════════════════════════════════════
// 周二 —— 黄石公园的狼：营养级联之争（生态）
//
// 出处：
// · NPS「Wolf Restoration in Yellowstone」：1920 年代狼因捕杀掠食者的政策在黄石
//   绝迹（约 70 年无狼）；1995 年 14 只（加拿大艾伯塔）、1996 年 17 只（不列颠哥伦
//   比亚）放入黄石，1997 年另有 10 只来自蒙大拿西北部；种群迅速增长。
// · NPS「The Big Scientific Debate: Trophic Cascades」：20 世纪大部分时间柳树、白杨等
//   木本植物被马鹿啃食压制；「恐惧景观」假说；马鹿减少还有公园外的管理 / 狩猎、
//   美洲狮恢复与熊增多等因素；河狸到 20 世纪中叶已基本消失（北部草场 1920 年代仍多，1950 年代基本绝迹，主编核对后更正）；「只在现有林分
//   里长高，面积没有增加」。
// · Ripple & Beschta 2012（Biological Conservation）：北部冬季牧场马鹿初冬计数
//   1994 年 19,045 → 2005 年 9,545（文中写「十来年里减半」）。
// · 2014 年短片「How Wolves Change Rivers」（George Monbiot 旁白），网上播放数百万次，
//   称狼改变了河流（河岸稳定、侵蚀减少）。
// · Kauffman, Brodie & Jules 2010（Ecology 91:2742）：在狼捕食风险高的地点，马鹿啃食
//   对白杨的影响并未减轻。
// · Brice, Larsen & MacNulty 2022（Ecology Letters 25:177，犹他州立大学）：只量每片
//   林子里最高的五棵幼白杨，比随机抽样高估恢复 4–7 倍；Painter, Beschta & Ripple 2023
//   回应：从没说那是平均水平，是「领先指标」。
// · Marshall, Hobbs & Cooper 2013（Proc R Soc B）：2001–2010 围栏 × 人工河狸坝实验；
//   十年全围栏若不同时抬高水位，柳树长不过 2 米（2 米以上马鹿够不着）；河狸没有
//   回到 1920 年代活跃过的任何一处。
// · Hobbs 等 2024（Ecological Monographs，科罗拉多州立大学，二十多年实验）：狼的回归
//   没能恢复河岸植物群落；移除顶级掠食者造成的改变不会很快逆转（Hobbs 原话大意）。
// ═══════════════════════════════════════════════════════════════

const WOLVES = {
  key: 'original-w5-yellowstone-wolves',
  title: 'What the Wolves Changed',
  passage: lettered([
    `Grey wolves had been eliminated from Yellowstone National Park, in the western United States, by the 1920s, as part of a deliberate policy of killing predators. For about seventy years the park had none. Then, in 1995 and 1996, 31 wolves captured in Canada were released there, and ten more, captured in the US state of Montana, followed in 1997. Their return has since become one of the best-known stories in ecology, and one of the most disputed.`,
    `Without wolves, the park's elk, a large species of deer, became very numerous, and for decades their browsing kept young willow, aspen and cottonwood trees from growing tall beside streams. After the wolves returned, some researchers reported that these trees were beginning to recover. They explained this as a trophic cascade: a chain of effects in which a predator at the top of a food web reduces the number of plant-eating animals, allowing the plants those animals feed on to flourish.`,
    `Some went further, arguing that wolves had changed not only the number of elk but also the way they behaved. According to this idea, elk began to avoid places where they could easily be attacked, creating a "landscape of fear" in which young trees in risky places were browsed less and could grow. In a popular short film from 2014, viewed millions of times online, the wolves even changed the rivers, as recovering plants held the banks in place.`,
    `Other researchers have found these claims harder to confirm. Elk numbers on the park's northern range did fall sharply after the wolves arrived, roughly halving in just over a decade, but wolves were not the only cause: hunting by people outside the park and rising numbers of bears and cougars also played a part. The evidence for a landscape of fear is weaker still. A study published in 2010 found that elk did just as much damage to young aspen in places where the risk from wolves was high as in places where it was low.`,
    `The way recovery has been measured has also been questioned. Several influential studies recorded only the five tallest young aspen in each stand. In 2022, a team from Utah State University compared this approach with random sampling and concluded that it had overestimated the recovery of aspen by four to seven times. The earlier authors replied that they had treated the tallest trees as early signs of change, never as typical ones.`,
    `Streams add a further complication. Beavers, whose dams keep the ground beside streams wet, largely disappeared from the area by the mid-twentieth century. Without their dams, many streams cut deeper channels and the water table beside them fell, leaving the roots of willows further from water. In an experiment that began in 2001, researchers fenced some willows against elk, raised the water around others with small artificial dams, and did both for a third group. After ten years, protection from elk alone had not allowed willows to grow taller than two metres, the height at which they escape browsing; only willows that were both protected and given raised water had done so.`,
    `In 2024, the same team, drawing on more than two decades of work, concluded that the return of the wolves had not restored the streamside plant communities, at least not quickly. When a food web is disturbed by the removal of a top predator, the lead author argued, the changes that follow can last long after the predator comes back.`,
    `None of this means that the wolves have had no effect. They have contributed to the fall in elk numbers, and in some places existing stands of willow and aspen have grown taller, although the area these trees cover does not appear to have increased. What remains in dispute is how large the effect has been and how much of it is due to fear. For conservation projects elsewhere, the lesson is sobering: bringing back a lost predator may be an important step in repairing an ecosystem, but it may not be enough on its own.`,
  ]),
  questions: [
    {
      kind: 'matchingParagraphs',
      items: [
        { item: 'a criticism of the way some measurements were made', letter: 'E' },
        { item: 'how long the park was without wolves', letter: 'A' },
        { item: 'a widely shared claim about the effect of wolves on rivers', letter: 'C' },
      ],
    },
    {
      kind: 'tfng',
      item: 'Elk prefer to feed on willow rather than on aspen.',
      answer: 'NOT GIVEN',
    },
    {
      kind: 'tfng',
      item: 'The wolves released in Yellowstone between 1995 and 1997 did not all come from the same country.',
      answer: 'TRUE',
      evidence:
        'Then, in 1995 and 1996, 31 wolves captured in Canada were released there, and ten more, captured in the US state of Montana, followed in 1997.',
    },
    {
      kind: 'tfng',
      item: 'Wolves were the only reason for the fall in elk numbers on the northern range.',
      answer: 'FALSE',
      evidence:
        "Elk numbers on the park's northern range did fall sharply after the wolves arrived, roughly halving in just over a decade, but wolves were not the only cause: hunting by people outside the park and rising numbers of bears and cougars also played a part.",
    },
    {
      kind: 'gapTyped',
      stem: 'A chain of effects in which a top predator indirectly allows plants to flourish is known as a trophic ______.',
      answer: 'cascade',
      evidence:
        'They explained this as a trophic cascade: a chain of effects in which a predator at the top of a food web reduces the number of plant-eating animals, allowing the plants those animals feed on to flourish.',
    },
    {
      kind: 'gapTyped',
      stem: 'The 2024 study concluded that the return of the wolves had not restored the ______ plant communities, at least not quickly.',
      answer: 'streamside',
      evidence:
        'In 2024, the same team, drawing on more than two decades of work, concluded that the return of the wolves had not restored the streamside plant communities, at least not quickly.',
    },
    {
      kind: 'short',
      marks: 2,
      stem: 'Using your own words, explain why keeping elk away from willows has not been enough to make them grow tall again.',
      answer:
        'Since the beavers disappeared, there have been no dams to hold the water back, so streams have cut deeper channels and the water table has fallen, leaving willow roots further from water. In the experiment, fenced willows did not grow beyond two metres unless the water level was raised as well.',
      evidence:
        'After ten years, protection from elk alone had not allowed willows to grow taller than two metres, the height at which they escape browsing; only willows that were both protected and given raised water had done so.',
      rubric:
        '两分：写出「河狸消失后没有水坝，溪流下切、河边地下水位下降，柳树根离水更远」给 1 分；写出「实验里只围栏挡住马鹿的柳树长不过两米，必须同时抬高水位才行」再给 1 分。只写「马鹿太多」给 0 分。',
    },
    {
      kind: 'short',
      marks: 2,
      stem: 'According to the writer, what have the wolves achieved, and what is still being debated?',
      answer:
        'They have helped to reduce elk numbers, and some existing stands of willow and aspen have grown taller; what is still debated is how big the effect has been and how much of it comes from elk being afraid.',
      evidence: 'What remains in dispute is how large the effect has been and how much of it is due to fear.',
      rubric:
        '两分：写出以下任一点给 1 分 —— 狼促成了马鹿数量下降；有些地方原有的柳树、白杨林长高了。写出「仍有争议的是这种作用有多大、其中有多少是因为马鹿害怕狼」再给 1 分。',
    },
  ],
};

// ═══════════════════════════════════════════════════════════════
// 周三 —— bouba 与 kiki：声音有没有形状（语言学）
//
// 出处：
// · 索绪尔「语言符号的任意性」：Cours de linguistique générale 1916 年出版，由学生的
//   听课笔记整理，索绪尔 1913 年去世。
// · Köhler 1929（Gestalt Psychology）：takete 配尖角图形，另一个词 1929 年写作 baluma、
//   1947 年版改为 maluma，配圆形。
// · Ramachandran & Hubbard 2001（J Consciousness Studies 8(12)）：bouba/kiki，英语与
//   泰米尔语使用者 95%–98% 作同样选择。
// · Maurer, Pathman & Mondloch 2006（Developmental Science 9:316）：两岁半幼儿与成人
//   一样把圆唇元音的词配圆形。
// · Bremner 等 2013（Cognition 126:165）：纳米比亚北部辛巴人（不使用书面语）的
//   形-音配对与西方人相似。
// · Ćwiek 等 2022（Phil Trans R Soc B 377:20200390）：25 种语言、9 个语系、10 种文字；
//   跨语言普遍存在，bouba 的一致性强于 kiki；用罗马字母的人只是略微更容易出现；
//   字形更圆 / 更尖的文字效应并不更强。
// · Blasi 等 2016（PNAS）：近三分之二世界语言的基本词表，许多基本概念与特定语音
//   稳定关联、跨大洲跨谱系（nose–n，small–i）；挑战索绪尔的任意性原则。
// · 「音义联系可能帮助了最早的语言 / 让词更好猜好记」只写成「有些研究者认为」。
// ═══════════════════════════════════════════════════════════════

const BOUBA = {
  key: 'original-w5-bouba-kiki',
  title: 'The Shape of a Sound',
  passage: lettered([
    `Imagine two simple drawings, one a rounded shape like a cloud and the other a jagged shape like a broken star. One is called "bouba" and the other "kiki". Which is which? Most people answer without hesitation that the rounded shape is bouba and the jagged one is kiki, even though neither word exists in their language. This puzzle, known as the bouba/kiki effect, raises a much larger question about how words get their meanings.`,
    `For much of the twentieth century, linguists held that the link between the sound of a word and its meaning is arbitrary. The idea is usually traced to the Swiss linguist Ferdinand de Saussure, whose ideas were published in 1916, three years after his death, in a book compiled from his students' lecture notes. Nothing about the sound of the English word "dog" resembles a dog, and other languages use entirely different words for the same animal. Arbitrariness came to be treated as one of the defining features of human language.`,
    `Evidence that sound and shape are connected, however, has a long history. In 1929 the German psychologist Wolfgang Köhler reported that people readily matched an invented word, "takete", with an angular figure and another, later given as "maluma", with a rounded one. The version with bouba and kiki was introduced in 2001 by the neuroscientists V. S. Ramachandran and Edward Hubbard, who reported that 95 per cent or more of the people they tested, including speakers of both English and Tamil, made the same choice.`,
    `An obvious objection is that the effect might come from writing rather than from sound. In the Roman alphabet the letter B is rounded and K is angular, so readers may simply be matching the shapes of letters. Two findings make this unlikely. Children as young as two and a half, who cannot yet read, show a similar preference. And in 2013, a study of the Himba, a people in northern Namibia who do not use a written language, found that they matched the words and shapes in much the same way as Western participants.`,
    `A much larger test was published in 2022. An international team tested speakers of 25 languages, belonging to nine language families and using ten different writing systems. The effect appeared across the languages, although it was stronger for bouba than for kiki: the rounded shape was matched with bouba more consistently than the jagged shape was matched with kiki. Speakers of languages written in the Roman alphabet were only slightly more likely to show the effect, and in scripts where the two written words happened to look rounder or spikier, the effect was no stronger.`,
    `Why should sounds suggest shapes at all? One explanation focuses on the mouth: saying "bouba" requires rounded lips, whereas "kiki" spreads the lips and contains a sudden, hard consonant. Another focuses on the sounds themselves, suggesting that smooth, continuous sounds share something with smooth outlines, and abrupt sounds with sharp angles. The two explanations do not exclude each other, and researchers have yet to agree on how much each contributes.`,
    `Similar patterns appear in real vocabulary. A 2016 study of basic word lists from nearly two-thirds of the world's languages found that certain sounds are used for certain meanings far more often than chance would predict. Words for "nose", for example, often contain an "n" sound, and words meaning "small" often contain an "i" sound like the vowel in "kiki". Because these patterns appeared in languages from different families and continents, they cannot easily be explained by shared ancestry.`,
    `None of this means that Saussure was simply wrong. For most words, no link between sound and meaning has been found, and the associations that do exist are tendencies with many exceptions. But language is evidently not entirely arbitrary either. Some researchers suggest that links between sound and meaning may have helped the earliest human languages to develop, by making new words easier to guess and to remember.`,
  ]),
  questions: [
    {
      kind: 'matchingParagraphs',
      items: [
        { item: 'the source of the traditional view that sound and meaning are unrelated', letter: 'B' },
        { item: 'a possible role for sound-meaning links in the early development of language', letter: 'H' },
        { item: 'two explanations that could both be correct', letter: 'F' },
      ],
    },
    {
      kind: 'tfng',
      item: 'In the 2022 study, participants agreed more about which shape was bouba than about which shape was kiki.',
      answer: 'TRUE',
      evidence:
        'The effect appeared across the languages, although it was stronger for bouba than for kiki: the rounded shape was matched with bouba more consistently than the jagged shape was matched with kiki.',
    },
    {
      kind: 'tfng',
      item: 'The Himba took longer than Western participants to match the words with the shapes.',
      answer: 'NOT GIVEN',
    },
    {
      kind: 'tfng',
      item: 'According to the 2016 study, languages that are not related to one another often use similar sounds for the same meanings.',
      answer: 'TRUE',
      evidence:
        'Because these patterns appeared in languages from different families and continents, they cannot easily be explained by shared ancestry.',
    },
    {
      kind: 'gapTyped',
      stem: 'Most people match the two invented words with the two shapes without ______.',
      answer: 'hesitation',
      evidence:
        'Most people answer without hesitation that the rounded shape is bouba and the jagged one is kiki, even though neither word exists in their language.',
    },
    {
      kind: 'gapTyped',
      stem: 'Köhler found that people matched the invented word "takete" with an ______ figure.',
      answer: 'angular',
      evidence:
        'In 1929 the German psychologist Wolfgang Köhler reported that people readily matched an invented word, "takete", with an angular figure and another, later given as "maluma", with a rounded one.',
    },
    {
      kind: 'short',
      marks: 2,
      stem: 'Using your own words, explain why the bouba/kiki effect is probably not caused by the shapes of written letters.',
      answer:
        'Very young children who cannot read yet show the same tendency, and the Himba, who have no written language, match the words and shapes in the same way as Western people. (Also acceptable: in the 2022 study, people using the Roman alphabet were only slightly more likely to show the effect, and scripts with rounder or spikier written forms did not make it stronger.)',
      evidence: 'Children as young as two and a half, who cannot yet read, show a similar preference.',
      rubric:
        '两分：以下任意两点各 1 分 —— ①两岁半、还不识字的幼儿也有同样倾向；②不使用文字的辛巴人（Himba）配得和西方人差不多；③2022 年的研究里，用罗马字母的人只是略微更容易出现这种效应；④字形碰巧更圆或更尖的文字，效应并没有更强。只写「因为这是天生的」给 0 分。',
    },
    {
      kind: 'short',
      marks: 2,
      stem: "What is the writer's conclusion about Saussure's claim that the link between sound and meaning is arbitrary?",
      answer:
        'The claim is still largely true, since most words show no such link and the links that have been found are only tendencies with many exceptions; but language is not completely arbitrary, because some links between sound and meaning do exist.',
      evidence:
        'For most words, no link between sound and meaning has been found, and the associations that do exist are tendencies with many exceptions.',
      rubric:
        '两分：写出「大体仍然成立：大多数词的发音和意义没有联系，已发现的联系也只是倾向、例外很多」给 1 分；写出「但语言也并非完全任意，确实存在一些音义联系」再给 1 分。',
    },
  ],
};

// ═══════════════════════════════════════════════════════════════
// 周四 —— 放射性碳测年（考古科学）
//
// 出处：
// · 原理：宇宙射线产生中子，与大气中的氮-14 反应生成碳-14；生物活着时体内比例与
//   大气相当，死后停止吸收、碳-14 衰变；半衰期约 5,730 年；可测约 5 万年以内。
// · Libby 在芝加哥大学于 1940 年代末建立此法；Arnold & Libby 1949（Science，
//   「Checks with Samples of Known Age」，含埃及 Djoser、Sneferu 墓中木料等已知年代
//   样品，结果落在已知年代的统计范围内）；Libby 1960 年获诺贝尔化学奖。
// · 1960 年代用树轮对比（Suess 等）发现放射性碳年龄与日历年龄可差几个世纪；碳-14
//   产量随太阳活动、地磁场与海洋碳循环而变；IntCal20（2020 年发布）校正曲线回溯到
//   55,000 年，材料包括树轮、湖泊与海洋沉积、洞穴沉积物（石笋等）、珊瑚。
// · 加速器质谱（AMS）1970 年代末起用，直接数碳-14 原子，样品约为衰变计数法的
//   千分之一。
// · 都灵裹尸布：1988 年牛津、苏黎世、亚利桑那三家 AMS 实验室；Damon 等 1989（Nature）
//   合并结果 95% 置信度为公元 1260–1390 年。
// · 核试验「炸弹峰」：1963 年部分禁止核试验条约生效前的大气核试验使北半球大气碳-14
//   接近翻倍，其后被海洋和生物圈吸收而下降；Spalding & Frisén 2005（Cell，瑞典卡罗林
//   斯卡学院）用它测定人体细胞的「出生」年代。
// · Graven 2015（PNAS）：化石燃料不含碳-14，稀释大气；若排放持续增长，2050 年的新
//   T 恤测出来与约一千年前的织物相同。
// ═══════════════════════════════════════════════════════════════

const CARBON = {
  key: 'original-w5-radiocarbon-dating',
  title: 'Reading the Carbon Clock',
  passage: lettered([
    `Few scientific techniques have transformed a discipline as completely as radiocarbon dating transformed archaeology. Before it, the age of a prehistoric site could usually be estimated only by comparing its objects with those found elsewhere, which became less reliable the further one moved from places with written records. Radiocarbon dating offered, for the first time, a way of measuring age directly from the remains themselves.`,
    `The method rests on a simple piece of physics. High in the atmosphere, cosmic rays set off reactions that turn a small amount of nitrogen into carbon-14, a radioactive form of carbon. This mixes with ordinary carbon in the air and is taken up by plants, and by the animals that eat them, so that every living thing contains it in roughly the same proportion as the atmosphere. When an organism dies, it stops taking in carbon, and the carbon-14 it contains slowly decays. Half of it disappears in about 5,730 years, so by measuring how much remains, scientists can calculate how long ago the organism died.`,
    `The technique was developed in the late 1940s by the American chemist Willard Libby and his colleagues at the University of Chicago. To test it, they measured samples whose ages were already known, including wood from ancient Egyptian tombs that could be dated from historical records. The results agreed closely enough with the expected ages to persuade many sceptics, and in 1960 Libby was awarded the Nobel Prize in Chemistry.`,
    `Libby's method, however, depended on an assumption: that the amount of carbon-14 in the atmosphere had always been the same. It has not. In the 1960s, researchers compared radiocarbon results with the ages of tree rings, which can be counted year by year, and found that the two could differ by several centuries. The level of carbon-14 has varied with changes in the activity of the Sun, the Earth's magnetic field and the oceans. Radiocarbon results are therefore converted into calendar dates using a calibration curve. The version published in 2020 reaches back 55,000 years.`,
    `A second advance came in the late 1970s with accelerator mass spectrometry. Instead of waiting to detect the radiation given off as carbon-14 atoms decay, this method counts the atoms directly, and it needs a sample around a thousand times smaller. In 1988, laboratories in Oxford, Zurich and Arizona each dated small pieces cut from the Shroud of Turin, a linen cloth that some believe to be the burial cloth of Jesus. Their combined results indicated, with 95 per cent confidence, that the linen dated from between 1260 and 1390.`,
    `Human activity has also left its mark on the carbon clock. Nuclear weapons tests in the 1950s and early 1960s nearly doubled the amount of carbon-14 in the atmosphere of the Northern Hemisphere. After a treaty banning such tests in the atmosphere took effect in 1963, the level began to fall as the extra carbon-14 passed into the oceans and living things. This "bomb pulse" has proved useful: because the level changed so quickly, it can show when recent material was formed to within a few years, and scientists in Sweden have used it to measure the age of cells in the human body.`,
    `Another human influence is less welcome. Coal, oil and gas formed from organisms that died millions of years ago, so they contain no carbon-14 at all. Burning them releases large amounts of carbon without any carbon-14, diluting what is in the air and making living things appear older than they are. A study published in 2015 calculated that, if emissions kept rising, a new T-shirt made in 2050 could give the same radiocarbon result as a piece of cloth about a thousand years old.`,
    `Radiocarbon dating, then, is not the simple clock it once seemed. Its results must be corrected, its samples chosen with care and recent material interpreted with caution. Yet the method remains one of the most important tools for dating the human past. Its main limit is set by physics: after about 50,000 years, too little carbon-14 remains to be measured reliably.`,
  ]),
  questions: [
    {
      kind: 'matchingParagraphs',
      items: [
        { item: 'the reason why very old material cannot be dated by this method', letter: 'H' },
        { item: 'an object that was dated using very small samples', letter: 'E' },
        { item: 'an honour given to the scientist who developed the method', letter: 'C' },
      ],
    },
    {
      kind: 'tfng',
      item: 'Before radiocarbon dating, archaeologists could measure the age of prehistoric remains directly.',
      answer: 'FALSE',
      evidence: 'Radiocarbon dating offered, for the first time, a way of measuring age directly from the remains themselves.',
    },
    {
      kind: 'tfng',
      item: 'The Egyptian wood gave the most accurate results of all the samples that Libby tested.',
      answer: 'NOT GIVEN',
    },
    {
      kind: 'tfng',
      item: "Libby's original method allowed for changes in the level of carbon-14.",
      answer: 'FALSE',
      evidence:
        "Libby's method, however, depended on an assumption: that the amount of carbon-14 in the atmosphere had always been the same.",
    },
    {
      kind: 'gapTyped',
      stem: 'High in the atmosphere, cosmic rays set off reactions that turn a small amount of ______ into carbon-14.',
      answer: 'nitrogen',
      evidence:
        'High in the atmosphere, cosmic rays set off reactions that turn a small amount of nitrogen into carbon-14, a radioactive form of carbon.',
    },
    {
      kind: 'gapTyped',
      stem: 'Radiocarbon results are turned into calendar dates by means of a ______ curve.',
      answer: 'calibration',
      evidence:
        'Radiocarbon results are therefore converted into calendar dates using a calibration curve.',
    },
    {
      kind: 'short',
      marks: 2,
      stem: 'Using your own words, explain how the amount of carbon-14 in the remains of a plant or animal shows how long ago it died.',
      answer:
        'While it is alive, it keeps taking in carbon, so its level of carbon-14 matches the air; after death no new carbon-14 is taken in and what is there decays at a known rate, halving about every 5,730 years, so the amount left shows how much time has passed.',
      evidence: 'When an organism dies, it stops taking in carbon, and the carbon-14 it contains slowly decays.',
      rubric:
        '两分：写出「活着时不断吸收碳，体内碳-14 的比例和大气差不多；死后就不再吸收」给 1 分；写出「碳-14 按已知速度衰变（约 5,730 年减少一半），测出还剩多少就能算出死了多久」再给 1 分。',
    },
    {
      kind: 'short',
      marks: 2,
      stem: 'How have nuclear weapons tests and the burning of fossil fuels affected radiocarbon dating in different ways?',
      answer:
        'Nuclear tests added a large amount of carbon-14, and because the level then rose and fell so quickly, recent material can be dated to within a few years; burning fossil fuels releases carbon with no carbon-14, which dilutes it and makes new material look older than it really is.',
      evidence:
        'Burning them releases large amounts of carbon without any carbon-14, diluting what is in the air and making living things appear older than they are.',
      rubric:
        '两分：写出「核试验让大气碳-14 猛增后又回落，变化很快，反而能把近几十年的材料定年到几年之内（有用）」给 1 分；写出「烧化石燃料释放不含碳-14 的碳，把大气里的碳-14 冲淡，新东西测起来显得更老（添乱）」再给 1 分。',
    },
  ],
};

// ═══════════════════════════════════════════════════════════════
// 周五 —— 禀赋效应（行为经济学）
//
// 出处：
// · Thaler 1980（J Econ Behav Organ，「Toward a positive theory of consumer choice」）
//   命名 endowment effect。
// · Kahneman, Knetsch & Thaler 1990（J Polit Econ 98:1325，原文已下载核对）：康奈尔
//   大学，隔座发康奈尔咖啡杯（校内书店售 6 美元）；随机分配下预期约一半成交，实际
//   成交很少；其中一个实验中位数估价：卖方 7.12 美元、「选择者」3.12 美元、买方 2.87
//   美元，「买方与选择者接近，说明人们并不怎么舍不得花钱」。
// · Knetsch 1989（AER 79:1277）：直接选择组 56% 选杯子、44% 选巧克力；先拿到杯子的
//   89% 不换，先拿到巧克力的 90% 不换。
// · 损失厌恶：Kahneman & Tversky 的前景理论（1979），损失比同等收益感受更强。
// · List 2003（QJE，「Does Market Experience Eliminate Market Anomalies?」）：体育卡片 /
//   徽章交易会上，缺乏经验的交易者不愿换，随交易经验下降，最有经验者没有。
// · Plott & Zeiler 2005（AER 95:530）：充分训练估价程序后 WTA–WTP 差距消失；2015 年
//   European Economic Review 有一项重复未成功。
// · Apicella, Azevedo, Christakis & Fowler 2014（AER 104:1793）：坦桑尼亚哈扎人，远离
//   市场的没有禀赋效应，接触市场多的有；可能是市场社会里习得的「思维习惯」。
// · 免费试用 / 宽松退货、房主高估房价：文中都写「may」，属常见推论，不写具体研究。
// ═══════════════════════════════════════════════════════════════

const ENDOWMENT = {
  key: 'original-w5-endowment-effect',
  title: 'The Price of Owning',
  passage: lettered([
    `Imagine being given a coffee mug and then asked how much money you would accept to sell it. Now imagine that, instead, you are offered the chance to buy an identical mug. Standard economic theory predicts that your two answers should be roughly the same, since the mug is worth whatever it is worth to you. In experiments, however, they are often very different. People tend to demand far more to give up an object than they would pay to acquire it, a pattern that the economist Richard Thaler named the endowment effect in 1980.`,
    `The best-known demonstration was published in 1990 by Daniel Kahneman, Jack Knetsch and Thaler. At Cornell University, half of the students in a class were given coffee mugs that sold for six dollars in the campus bookstore, and markets were set up in which owners could sell to students without one. Because the mugs had been handed out at random, about half of them would have been expected to change hands. In fact, very few did. In one version, the typical owner would not sell for less than about seven dollars, while the typical buyer would pay less than three.`,
    `The same study included a revealing third group. These "choosers" were not given a mug but were asked to decide, at a range of prices, whether they would rather have a mug or the cash. Their valuations were close to those of the buyers rather than the sellers. This suggested that the gap was caused not by any reluctance to part with money, but by owners' reluctance to part with the mug.`,
    `A simpler experiment, reported by Knetsch in 1989, made the same point. Some students were given a mug and others a bar of chocolate, and all were later offered the chance to swap. When a separate group was simply asked to choose between the two, their preferences were fairly evenly divided. Yet about nine in ten of those who had been given a mug kept it, and about nine in ten of those given chocolate kept the chocolate.`,
    `The most common explanation is loss aversion, an idea developed by Kahneman and his colleague Amos Tversky. According to this idea, losses are felt more strongly than gains of the same size. Once an object belongs to someone, giving it up feels like a loss, while acquiring it would only have been a gain, so an owner needs more money to be persuaded to let it go.`,
    `Not all economists accept that the effect is as general as it first appeared. In a study of traders at sports-card shows, published in 2003, John List found that inexperienced traders were reluctant to part with items they had been given, but that this reluctance declined with trading experience and disappeared among the most experienced traders. Two years later, another team argued that the gap in mug experiments could be removed if participants were carefully trained in how the selling procedure worked, although a later attempt to repeat that result did not succeed.`,
    `Culture may matter as well. In 2014, researchers studied the Hadza, a hunter-gatherer people in Tanzania. Hadza living in remote areas, far from markets, showed no endowment effect, whereas those living in a region with more exposure to modern markets did show it. The researchers suggested that the effect may not be a fixed part of human nature but a habit of mind that people learn in societies organised around buying and selling.`,
    `Whatever its origins, the effect has practical consequences. Businesses that offer free trials or generous return policies may benefit from it, since customers who have started to feel that a product is theirs may be less willing to give it back. Homeowners may likewise value their houses more highly than potential buyers do, which can leave properties unsold for longer. Knowing about the effect will not make it disappear, but it may help people notice when they are demanding a price simply because something is already theirs.`,
  ]),
  questions: [
    {
      kind: 'matchingParagraphs',
      items: [
        { item: 'evidence that trading experience can weaken the effect', letter: 'F' },
        { item: 'the origin of the name of the effect', letter: 'A' },
        { item: 'an experiment in which people could swap one item for another', letter: 'D' },
      ],
    },
    {
      kind: 'tfng',
      item: 'In the Cornell experiment, about half of the mugs were sold.',
      answer: 'FALSE',
      evidence: 'In fact, very few did.',
    },
    {
      kind: 'tfng',
      item: 'The most common explanation suggests that losing twenty dollars would upset a person more than finding twenty dollars would please them.',
      answer: 'TRUE',
      evidence: 'According to this idea, losses are felt more strongly than gains of the same size.',
    },
    {
      kind: 'tfng',
      item: 'Companies that offer free trials usually give a discount to customers who return the product.',
      answer: 'NOT GIVEN',
    },
    {
      kind: 'gapTyped',
      stem: 'The most common explanation of the endowment effect is loss ______.',
      answer: 'aversion',
      evidence: 'The most common explanation is loss aversion, an idea developed by Kahneman and his colleague Amos Tversky.',
    },
    {
      kind: 'gapTyped',
      stem: 'Because homeowners may value their houses more highly than potential buyers do, properties can be left ______ for longer.',
      answer: 'unsold',
      evidence:
        'Homeowners may likewise value their houses more highly than potential buyers do, which can leave properties unsold for longer.',
    },
    {
      kind: 'short',
      marks: 2,
      stem: 'Using your own words, explain what the "choosers" in the Cornell study revealed.',
      answer:
        "Their valuations were similar to the buyers', not the sellers', so the gap did not come from people being unwilling to spend money but from owners being unwilling to give up the mug.",
      evidence:
        "This suggested that the gap was caused not by any reluctance to part with money, but by owners' reluctance to part with the mug.",
      rubric:
        '两分：写出「「选择者」给出的估价和买方接近、和卖方差得远」给 1 分；点明「所以差距不是因为人们舍不得花钱，而是拥有者舍不得放手」再给 1 分。',
    },
    {
      kind: 'short',
      marks: 2,
      stem: 'What did the 2014 study of the Hadza suggest about where the endowment effect comes from?',
      answer:
        'Hadza living far from markets showed no endowment effect while those with more contact with markets did, which suggests that the effect is not a fixed part of human nature but is learned in societies based on buying and selling.',
      evidence:
        'The researchers suggested that the effect may not be a fixed part of human nature but a habit of mind that people learn in societies organised around buying and selling.',
      rubric:
        '两分：写出「远离市场的哈扎人没有禀赋效应，接触市场多的哈扎人有」给 1 分；写出「说明这种效应可能不是人性里固定的，而是在以买卖为中心的社会里学来的」再给 1 分。',
    },
  ],
};

const SPECS = [BYSTANDER, WOLVES, BOUBA, CARBON, ENDOWMENT];

module.exports = {
  LEVEL,
  SPECS,
  DAYS: DATES.slice(0, SPECS.length).map((date, i) => buildAuthoredDay(SPECS[i], date)),
};
