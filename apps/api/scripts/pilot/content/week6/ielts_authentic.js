/**
 * 第六周 —— **ielts_authentic（雅思真题难度）**档，全原创学术说明文。
 *
 * 六百词上下、八段、按 Paragraph A–H 编号。形状与第五周这一档一致：
 *   3 道段落信息配对 · 3 道判断 · 2 道原文单词填空（要拼写） ·
 *   2 道两分主观题 —— 满分 12。
 *
 * 判断题按周看分布：T/NG/T · F/T/NG · NG/F/F · T/F/T · F/NG/T →
 * TRUE 6 · FALSE 5 · NOT GIVEN 4；只有两天是各一道，NOT GIVEN 不总在最后。
 *
 * 研究与数字只写能对上公开出处的（见每篇上方注释），拿不准的一律不写
 * 具体数字。文章是自己写的，研究结论用自己的话转述。
 * 选题前对过学生读过的 226 篇、内容包 125 篇标题，以及前五周本档全部题目
 * （珊瑚、冰芯、暗光走廊、冷路面、河流、雁阵、集装箱、棉花糖、补液盐、
 * 天气预报、青霉素、香蕉、邓巴数、安慰剂、蚊子、旁观者、狼、bouba/kiki、
 * 碳测年、禀赋效应），关键词在题库里也搜过，无重合。
 */

'use strict';

const { buildAuthoredDay, lettered } = require('../authored');
const { DATES } = require('./dates');

const LEVEL = 'ielts_authentic';

// ═══════════════════════════════════════════════════════════════
// 周一 —— 坏血病：治好了又丢了（医学史）
//
// 出处与把握：
// · Lind 1747 年 5 月在 HMS Salisbury 上的试验：12 名坏血病水手两两一组、六种疗法
//   （苹果酒、稀硫酸酏剂、醋、海水、橙子与柠檬、蒜芥药糊）；吃柑橘的一人六天后
//   「fit for duty」，另一人被派去照料其他病人（Lind《Treatise of the Scurvy》1753 原文，
//   James Lind Library 转载）—— 高。
// · Baron JH 2009, Nutrition Reviews 67(6):315–332「Sailors' scurvy before and after James
//   Lind – a reassessment」（原文 PDF 已下载核对）：Lind 书中病因解释混乱、同时推荐
//   多种疗法；他的「rob」是把果汁加热浓缩成糖浆，没给证据，加热破坏维生素 C；海军
//   没采纳 rob；1795 年 8 月海军部给朴次茅斯舰队配柠檬汁（Trotter、Blane 推动），
//   1796 年起海外舰船、1799 年起本土沿岸舰船都配；此后坏血病在海军中基本消失；柠檬
//   多来自地中海 —— 高。
// · Chick, Hume, Skelton & Smith 1918, Lancet 192:735–738（Zenodo 收录的原文摘要已核）：
//   新鲜酸橙汁效力约为柠檬汁的四分之一，保存过的酸橙汁防不住坏血病；海军消灭坏血病
//   时所谓「lime juice」其实是柠檬汁，西印度酸橙十九世纪下半叶才被采用；1850 年带
//   柠檬汁的 Investigator 号几乎没有坏血病，1875 年带酸橙汁的 Alert、Discovery 号
//   严重发病 —— 高。正文写「Experiments in 1918 suggested」，两次探险都写成 British。
// · 酸橙来自英国在加勒比的殖民地 —— 中高（Idle Words「Scott and Scurvy」等），正文只写
//   「limes grown in Britain's own colonies」，不写换果的动机。
// · 「坏血病是腐败罐头肉中毒」的理论、吃新鲜肉的极地探险者不发病 —— 中高（Idle Words
//   与多种科普史），正文写「some concluded」「seemed to support」。
// · Holst & Frølich 1907（挪威）：原研究鸽子的脚气病，改用豚鼠，无新鲜食物的饲料
//   致坏血病、加新鲜蔬果可防；豚鼠与人一样不能自己合成维生素 C（大鼠小鼠能）—— 高。
//   Chick 等 1918 年即用豚鼠测酸橙汁 —— 高。
// · Szent-Györgyi 1928 年分离出（己糖醛酸），1932 年与美国 King 团队各自证实就是抗
//   坏血病因子，命名 ascorbic acid；1937 年诺贝尔生理学或医学奖（部分因维生素 C）—— 高。
// ═══════════════════════════════════════════════════════════════

const SCURVY = {
  key: 'original-w6-scurvy',
  title: 'The Long Defeat of Scurvy',
  passage: lettered([
    `For centuries, scurvy was one of the greatest dangers of life at sea. On long voyages, sailors lived for months on salted meat and dry ship's biscuit, and many eventually became exhausted, their gums swelled and bled, their teeth loosened and old wounds opened again. Without treatment, the disease was fatal. It is now known to be caused by a lack of vitamin C, which the human body cannot make for itself. The story of how this was discovered, however, is not a simple march from ignorance to knowledge.`,
    `In May 1747, James Lind, a Scottish surgeon on the naval ship HMS Salisbury, took twelve sailors suffering from scurvy, divided them into six pairs and gave each pair a different remedy, including cider, vinegar, sea water and a daily ration of two oranges and a lemon. The pair given citrus fruit improved fastest: after six days one of them was fit to return to duty, and the other had recovered well enough to help nurse the rest. Because Lind compared several treatments at the same time, his study is often described as one of the first controlled clinical trials.`,
    `Yet Lind did not draw the conclusion that now seems obvious. In his Treatise of the Scurvy, published in 1753, his explanation of the disease was confused, and he recommended many other remedies alongside fruit. Because fresh fruit went bad on long voyages, he also proposed preserving the juice as a "rob", made by heating it until it became a thick syrup. He offered no real evidence that this worked, and heating is now known to destroy much of the vitamin C in fruit. The navy did not adopt his proposals.`,
    `Change came decades later, when two naval doctors, Gilbert Blane and Thomas Trotter, persuaded those in charge to provide lemon juice. In 1795 the Admiralty ordered it for the fleet at Portsmouth, and within a few years it was being supplied to ships both overseas and around Britain. The juice came mostly from Mediterranean lemons, and scurvy more or less disappeared from the Royal Navy.`,
    `In the second half of the nineteenth century, however, the navy began to replace these lemons with limes grown in Britain's own colonies in the Caribbean. The change was easy to overlook, since the juice had long been called "lime juice" whichever fruit it came from. But the fruit mattered. A British Arctic expedition of 1850 that carried lemon juice remained remarkably free of scurvy, whereas one of 1875, supplied with lime juice, suffered severely from it. Experiments in 1918 suggested that fresh lime juice was only about a quarter as effective as lemon juice, and that preserved lime juice gave no protection at all.`,
    `The failure led to a wider loss of confidence. With no idea that vitamins existed, doctors could not explain why a remedy that had once worked now seemed useless, and some concluded that citrus fruit had never been the real answer. The fact that polar explorers who ate fresh meat could stay healthy seemed to support a different theory: that scurvy was a form of poisoning caused by tinned meat that had gone bad.`,
    `The puzzle was finally solved partly by chance. In 1907, two Norwegian researchers, Axel Holst and Theodor Frølich, who had been studying a different disease in pigeons, decided to switch to a mammal and chose guinea pigs. On a diet without fresh food the animals developed scurvy, and adding fresh vegetables or fruit prevented it. The choice was fortunate: most mammals, including rats and mice, make their own vitamin C, but guinea pigs, like humans, cannot. For the first time, foods could be tested in the laboratory for their power to prevent scurvy, which is how lime juice was eventually shown to be so weak.`,
    `The substance itself was identified in 1932, when the Hungarian scientist Albert Szent-Györgyi and, separately, a team in the United States showed that a compound first isolated a few years earlier was the missing factor. It was named ascorbic acid, a name that refers to its power to prevent scurvy, and in 1937 Szent-Györgyi received a Nobel Prize partly for this work. Scurvy had been defeated in the 1790s by people who did not know why their remedy worked, and it returned in the nineteenth century for exactly the same reason.`,
  ]),
  questions: [
    {
      kind: 'matchingParagraphs',
      items: [
        { item: 'a proposal for which no real evidence was offered', letter: 'C' },
        { item: 'a new theory that blamed a particular kind of food', letter: 'F' },
        { item: 'a comparison between two expeditions to the Arctic', letter: 'E' },
      ],
    },
    {
      kind: 'tfng',
      item: "Both of the sailors who were given citrus fruit in Lind's trial improved.",
      answer: 'TRUE',
      evidence:
        'The pair given citrus fruit improved fastest: after six days one of them was fit to return to duty, and the other had recovered well enough to help nurse the rest.',
    },
    {
      kind: 'tfng',
      item: 'Many sailors in the 1790s complained about the taste of the lemon juice they were given.',
      answer: 'NOT GIVEN',
    },
    {
      kind: 'tfng',
      item: 'In 1932, more than one research group showed that the compound was the missing factor.',
      answer: 'TRUE',
      evidence:
        'The substance itself was identified in 1932, when the Hungarian scientist Albert Szent-Györgyi and, separately, a team in the United States showed that a compound first isolated a few years earlier was the missing factor.',
    },
    {
      kind: 'gapTyped',
      stem: "On long voyages, sailors lived for months on salted meat and dry ship's ______.",
      answer: 'biscuit',
      evidence:
        "On long voyages, sailors lived for months on salted meat and dry ship's biscuit, and many eventually became exhausted, their gums swelled and bled, their teeth loosened and old wounds opened again.",
    },
    {
      kind: 'gapTyped',
      stem: 'The anti-scurvy substance identified in 1932 was given the name ______ acid.',
      answer: 'ascorbic',
      evidence:
        'It was named ascorbic acid, a name that refers to its power to prevent scurvy, and in 1937 Szent-Györgyi received a Nobel Prize partly for this work.',
    },
    {
      kind: 'short',
      marks: 2,
      stem: 'Using your own words, explain why scurvy returned to British ships in the second half of the nineteenth century.',
      answer:
        'The navy replaced lemons with limes, and lime juice is much weaker against scurvy: fresh lime juice was only about a quarter as effective, and preserved lime juice gave no protection. The change was easy to miss, because the juice had always been called "lime juice" whichever fruit was used, and nobody yet knew about vitamins.',
      evidence:
        'Experiments in 1918 suggested that fresh lime juice was only about a quarter as effective as lemon juice, and that preserved lime juice gave no protection at all.',
      rubric:
        '两分：写出「海军把柠檬换成了酸橙，而酸橙汁防坏血病的效力弱得多（新鲜的只有柠檬汁的约四分之一，保存过的完全无效）」给 1 分；再写出以下任一点给 1 分 —— 不管用哪种水果，这种果汁一直都叫 lime juice，所以换了水果不容易被察觉；当时没人知道维生素，无从知道两种果汁不一样。只写「1875 年的北极探险队得了坏血病」（那是结果不是原因）或「船上果汁不够」给 0 分。',
    },
    {
      kind: 'short',
      marks: 2,
      stem: 'According to the passage, why was the work of Holst and Frølich so important?',
      answer:
        'They found that guinea pigs get scurvy on a diet without fresh food, because, like humans and unlike most mammals, they cannot make their own vitamin C. This gave scientists a way to test foods in the laboratory for their power to prevent scurvy, which is how lime juice was shown to be weak.',
      evidence:
        'For the first time, foods could be tested in the laboratory for their power to prevent scurvy, which is how lime juice was eventually shown to be so weak.',
      rubric:
        '两分：写出「他们找到了会得坏血病的实验动物 —— 豚鼠和人一样不能自己合成维生素 C（大多数哺乳动物能）」给 1 分；写出「从此能在实验室里检验各种食物防坏血病的能力（酸橙汁效力弱就是这样测出来的）」再给 1 分。只写「他们发现了维生素 C」给 0 分（维生素 C 是 1932 年才确认的）。',
    },
  ],
};

// ═══════════════════════════════════════════════════════════════
// 周二 —— 咸海：救回了一半（环境）
//
// 出处与把握：
// · 1960 年世界第四大湖、约 68,000 平方公里，位于哈萨克斯坦与乌兹别克斯坦之间；
//   阿姆河、锡尔河携带远方山地融雪；无出口湖，入水与蒸发平衡 —— 高（NASA Earth
//   Observatory「World of Change: Shrinking Aral Sea」、Wikipedia / Britannica）。
// · 渔业「据一项估计」占苏联渔获六分之一 —— 中高（National Geographic；正文带
//   「by one estimate」）。
// · 1960 年代起苏联大规模引两河水灌溉沙漠、主要种棉花；许多水渠没有衬砌，大量的水
//   渗漏蒸发；湖面下降逐年代加速 —— 高（NASA；Wikipedia 引 Micklin：卡拉库姆运河
//   30–75% 的水损失）。
// · 1987 年分裂为北（小）咸海与南（大）咸海；盐度上升、大多数本地鱼类消失；渔业
//   高峰约 4 万人就业、1980 年代后期商业捕捞归零；Moynaq、Aralsk 两港离水很远、
//   船只搁浅 —— 高。
// · 裸露湖床成为 Aralkum 沙漠，盐与农药化肥残留随沙尘暴扩散，与当地呼吸道疾病
//   有关；失去水体调节后气温年较差变大（夏更热冬更冷）—— 中高，正文写
//   「has been linked」「are reported to have」。
// · 1990 年代哈萨克斯坦两次用沙筑堤、两次被冲垮（1992 / 1998–99）—— 中高，正文
//   只写「more than once」。
// · 2005 年 8 月 Kok-Aral 坝完工（约 13 公里，世界银行贷款，另有锡尔河工程）；北咸海
//   水位一年内明显回升、快于预期，盐度大幅下降，淡水鱼从河里回来，渔获逐年增加；
//   岸线向 Aralsk 回退但未回到城边；哈方讨论过进一步工程 —— 高 / 中高（World Bank
//   「Saving a Corner of the Aral Sea」、Wikipedia Dike Kokaral、Eurasianet）。
// · 坝同时大大减少了北湖流向南湖的水（坝有泄水闸，北湖满时仍向南放水，正文只写
//   「greatly reduced」）；2014 年 8 月卫星图像显示南咸海东湖盆完全干涸，
//   Micklin 称「可能是六百年来第一次」；剩下的西湖盆又窄又深、比海水咸得多 —— 高
//   （NASA、National Geographic 2014）。
// ═══════════════════════════════════════════════════════════════

const ARAL = {
  key: 'original-w6-aral-sea',
  title: 'The Sea That Shrank',
  passage: lettered([
    `In 1960, the Aral Sea, which lies between Kazakhstan and Uzbekistan in Central Asia, was the fourth-largest lake in the world, covering about 68,000 square kilometres. Although it lay in a desert, it was kept full by two great rivers, the Amu Darya and the Syr Darya, which carried melted snow down from distant mountains. The lake had no outlet: the water that flowed in was balanced by the water that evaporated from its surface. Its fisheries were so productive that, by one estimate, it supplied a sixth of all the fish caught in the Soviet Union.`,
    `That balance was broken deliberately. From the early 1960s, Soviet planners greatly expanded the use of the two rivers to irrigate the surrounding desert, above all for growing cotton. Long canals were dug, many of them without any lining, so that a large proportion of their water soaked into the sand or evaporated before it reached the fields. Less and less water arrived at the lake, and its level began to fall, slowly at first and then faster with each decade.`,
    `By 1987, the shrinking lake had split into two: a small northern part, fed by the Syr Darya, and a much larger southern part, fed by the Amu Darya. As the water retreated, what remained became steadily saltier, and most of the native fish disappeared. The commercial fishing industry, which had once employed tens of thousands of people, had collapsed by the late 1980s. Former fishing ports such as Moynaq in Uzbekistan and Aralsk in Kazakhstan were left many kilometres from the water, with rusting boats stranded on the sand.`,
    `The exposed seabed created problems of its own. It has become a new desert, now known as the Aralkum, covered in salt and in the remains of fertilisers and pesticides that drained from farms into the lake. Strong winds lift this material into dust storms that spread it across the region, and the dust has been linked to breathing problems among local people. Without a large body of water to moderate temperatures, summers near the former shore are reported to have become hotter and winters colder.`,
    `For many years the sea was regarded as lost. In the 1990s, however, Kazakhstan tried to save at least the northern part by building a barrier of sand across the channel through which its water drained into the lower southern lake. The barrier was washed away more than once. A lasting solution came in 2005, when a dam about 13 kilometres long was completed at Kok-Aral with a loan from the World Bank, along with work on the Syr Darya to bring more of its water to the lake.`,
    `The results came faster than expected. Within a year the northern lake had risen considerably. Its salt levels then fell sharply, and freshwater fish returned from the river. Fishing began again, and catches grew year after year. The shoreline has moved back towards Aralsk, although the water has not yet returned to the town itself, and Kazakhstan has discussed further work to bring it closer still.`,
    `The southern part has had no such recovery. The dam that saved the north also greatly reduced the flow of water from the northern lake into the southern one, and little of the Amu Darya's water now reaches the sea. In 2014, satellite images showed that the eastern basin of the southern lake had dried up completely, according to one expert probably for the first time in about six hundred years. What remains is a narrow, deep western basin whose water is far saltier than the ocean.`,
    `Restoring the whole sea would require giving back much of the water now used for farming, something the region's economies, which still depend heavily on irrigated crops, are unlikely to do. The Aral Sea is therefore often described as one of the worst environmental disasters of the twentieth century. Yet its northern part offers a more hopeful lesson: a damaged lake can recover surprisingly quickly once water is allowed to return.`,
  ]),
  questions: [
    {
      kind: 'matchingParagraphs',
      items: [
        { item: 'an early attempt to hold back water that failed', letter: 'E' },
        { item: 'an estimate of when part of the sea was last completely dry', letter: 'G' },
        { item: 'the revival of an industry in one part of the sea', letter: 'F' },
      ],
    },
    {
      kind: 'tfng',
      item: 'The dust storms from the old seabed carry salt but no chemicals from farms.',
      answer: 'FALSE',
      evidence:
        'It has become a new desert, now known as the Aralkum, covered in salt and in the remains of fertilisers and pesticides that drained from farms into the lake. Strong winds lift this material into dust storms that spread it across the region',
    },
    {
      kind: 'tfng',
      item: 'The Kok-Aral dam reduced the flow of water into the southern lake.',
      answer: 'TRUE',
      evidence:
        "The dam that saved the north also greatly reduced the flow of water from the northern lake into the southern one, and little of the Amu Darya's water now reaches the sea.",
    },
    {
      kind: 'tfng',
      item: 'Scientists expect the western basin of the southern lake to dry up within twenty years.',
      answer: 'NOT GIVEN',
    },
    {
      kind: 'gapTyped',
      stem: 'In former fishing ports, rusting boats were left ______ on the sand.',
      answer: 'stranded',
      evidence:
        'Former fishing ports such as Moynaq in Uzbekistan and Aralsk in Kazakhstan were left many kilometres from the water, with rusting boats stranded on the sand.',
    },
    {
      kind: 'gapTyped',
      stem: 'Near the former shore, there is no longer a large body of water to ______ temperatures.',
      answer: 'moderate',
      evidence:
        'Without a large body of water to moderate temperatures, summers near the former shore are reported to have become hotter and winters colder.',
    },
    {
      kind: 'short',
      marks: 2,
      stem: 'Using your own words, explain why the Aral Sea kept roughly the same size before the 1960s but began to shrink afterwards.',
      answer:
        'Before the 1960s, the water brought in by the two rivers was equal to the water lost by evaporation, since the lake had no outlet. After that, much of the rivers\' water was taken to irrigate farmland in the desert, especially for cotton, so less reached the lake while it kept losing water to evaporation.',
      evidence:
        'The lake had no outlet: the water that flowed in was balanced by the water that evaporated from its surface.',
      rubric:
        '两分：写出「此前两条河流入的水量和湖面蒸发掉的水量相当（湖没有出口），所以大小稳定」给 1 分；写出「1960 年代起河水被大量引去灌溉沙漠里的农田（主要种棉花），流进湖里的水越来越少」再给 1 分（提到水渠渗漏蒸发浪费了大量的水可作补充，不另给分）。只写「天气变热、蒸发变多」给 0 分（原文没有这么说）。',
    },
    {
      kind: 'short',
      marks: 2,
      stem: 'According to the writer, what does the northern part of the sea show, and what would restoring the whole sea require?',
      answer:
        'It shows that a damaged lake can recover surprisingly quickly once water is allowed back, as the northern lake rose, became less salty and got its fish back. Restoring the whole sea would mean giving back much of the water now used for farming, which the region is unlikely to do because its economies depend on irrigated crops.',
      evidence:
        'Yet its northern part offers a more hopeful lesson: a damaged lake can recover surprisingly quickly once water is allowed to return.',
      rubric:
        '两分：写出「北咸海说明受损的湖只要水能回来，就能出乎意料地快速恢复」给 1 分（写出水位回升、盐度下降、鱼回来了等具体表现也可）；写出「要恢复整个咸海，就得把现在用于农业灌溉的大量用水还给它（而当地经济依赖灌溉农业，不太可能这样做）」再给 1 分。只写「再修一座坝」给 0 分。',
    },
  ],
};

// ═══════════════════════════════════════════════════════════════
// 周三 —— 视而不见：非注意盲视（心理学）
//
// 出处与把握：
// · Simons & Chabris 1999, Perception 28:1059–1074「Gorillas in our midst」：数一队的传球；
//   意外人物是打伞女子或穿大猩猩服的人；192 名观察者约 46% 没发现；任务越难（分开数
//   击地传球与空中传球）发现的越少；意外物与所盯对象越相似越容易被发现（黑色大猩猩，
//   盯黑队的人更常看到）—— 高（多份教材与论文综述一致）。
// · Mack & Rock 1998 年出版《Inattentional Blindness》命名该现象 —— 高。
// · Drew, Võ & Wolfe 2013, Psychological Science 24:1848–1853：24 名放射科医生查肺部
//   CT 结节，插入的大猩猩是平均结节的 48 倍，20 人（83%）没报告；眼动显示多数漏看者
//   直接看过那个位置 —— 高。
// · Kenny Conley：1995 年波士顿警员追嫌犯时跑过同事殴打一名男子的现场，称没看见，
//   被判伪证 / 妨碍司法，后上诉推翻 —— 高。Chabris, Weinberger, Fontaine & Simons 2011
//   （i-Perception 2:150–153）：跟跑并数研究者摸头次数，路旁模拟打斗；夜里 35% 注意到，
//   白天 56% —— 高（正文只写夜里 35%、「白天也有很多人没看到」）。
// · Hyman 等 2010, Applied Cognitive Psychology 24:597–607（原文 PDF 已核）：校园广场上
//   骑独轮车的小丑；被直接问到时，打电话者 25% 看到，独行 51%，听音乐 61%，结伴 71% —— 高。
// · Simons 2010, i-Perception 1:3–6：新视频另有幕布变色、一名队员离场；知道大猩猩视频的
//   人都看到了大猩猩，但注意到另外两个变化的可能性略低 —— 高。
// · 末段「设计不依赖一个人看到一切的制度」是作者观点，不归给具体研究。
// ═══════════════════════════════════════════════════════════════

const BLINDNESS = {
  key: 'original-w6-inattentional-blindness',
  title: 'Looking Without Seeing',
  passage: lettered([
    `In a well-known experiment published in 1999, the psychologists Daniel Simons and Christopher Chabris asked people to watch a short video in which two teams, one in white shirts and one in black, passed basketballs among themselves, and to count the passes made by one of the teams. Partway through, an unexpected figure crossed the scene: in some versions a woman carrying an umbrella, in others a person in a gorilla suit. Across all the versions, nearly half of the observers did not notice it. Many were astonished when the video was played again.`,
    `The phenomenon had been named inattentional blindness a year earlier by the psychologists Arien Mack and Irvin Rock. It is not a problem with the eyes. The light reaches them, but attention works like a filter: when people concentrate hard on one task, much of what falls outside it never reaches conscious awareness. This allows the brain to cope with an enormous amount of visual information, but it also means that people can miss things that seem, afterwards, impossible to overlook.`,
    `The 1999 study also showed what makes such failures more likely. When the counting task was made harder, by asking observers to keep separate counts of two kinds of pass, fewer of them noticed the unexpected event. What people were watching mattered too: the gorilla, which was dark, was noticed more often by those counting the passes of the team in black than by those following the team in white. People seem to notice most readily whatever resembles the things they are already looking for.`,
    `Expertise offers less protection than might be expected. In a study published in 2013, 24 radiologists, doctors trained to read medical images, searched a series of lung scans for small growths. In one set of images, the researchers had inserted a picture of a gorilla 48 times the size of a typical growth. Twenty of the radiologists, or 83 per cent, did not report it, and eye-tracking equipment showed that most of those who missed it had looked directly at the place where it appeared.`,
    `The consequences can be serious. In 1995, a Boston police officer named Kenny Conley was chasing a suspect when he ran past a place where other officers were violently beating a man. He said that he had not seen the attack, was not believed, and was convicted of lying under oath, although the conviction was later overturned. In 2011, Chabris and his colleagues asked volunteers to run behind a researcher while counting how often he touched his head, along a route that passed a staged fight. At night, only 35 per cent noticed the fight; even in daylight, many did not.`,
    `Everyday life offers similar examples. In a study published in 2010, researchers arranged for a clown to ride a unicycle around a busy square on a university campus. When asked afterwards, only a quarter of the people who had crossed the square while talking on a mobile phone said they had seen the clown, compared with about half of those walking alone and more than two-thirds of those walking in pairs. A phone conversation appears to use up attention that would otherwise be available for the surroundings.`,
    `It might be expected that knowing about the effect would protect people from it. In 2010, Simons showed a new video to people who had and had not heard of the gorilla experiment. This time, as well as a gorilla, there were two other unexpected events: a curtain in the background changed colour, and one of the players left the game. Those who already knew about such videos consistently spotted the gorilla, but they were slightly less likely than the others to notice the other changes.`,
    `For hospitals, police forces and drivers, the lesson is not that people should simply try harder, since concentrating hard on one task is exactly what produces the blindness. A more realistic approach is to design systems that do not depend on one person noticing everything, for example by having important images checked by a second reader or by making warnings hard to ignore. Most people who hear about these studies are sure that they would have seen the gorilla. The research suggests that such confidence is often misplaced.`,
  ]),
  questions: [
    {
      kind: 'matchingParagraphs',
      items: [
        { item: 'a case in which someone was punished after saying he had not seen an event', letter: 'E' },
        { item: 'a comparison between people using a phone and people who were not', letter: 'F' },
        { item: 'evidence that experts can look straight at something without seeing it', letter: 'D' },
      ],
    },
    {
      kind: 'tfng',
      item: 'Most of the observers in the 1999 study counted the passes correctly.',
      answer: 'NOT GIVEN',
    },
    {
      kind: 'tfng',
      item: 'According to the writer, inattentional blindness happens because the eyes fail to receive the information.',
      answer: 'FALSE',
      evidence: 'It is not a problem with the eyes.',
    },
    {
      kind: 'tfng',
      item: 'People who already knew about the gorilla experiment were better than others at noticing the other unexpected events.',
      answer: 'FALSE',
      evidence:
        'Those who already knew about such videos consistently spotted the gorilla, but they were slightly less likely than the others to notice the other changes.',
    },
    {
      kind: 'gapTyped',
      stem: 'Afterwards, the things that people missed can seem impossible to ______.',
      answer: 'overlook',
      evidence:
        'This allows the brain to cope with an enormous amount of visual information, but it also means that people can miss things that seem, afterwards, impossible to overlook.',
    },
    {
      kind: 'gapTyped',
      stem: 'When the 1999 video was played again, many observers were ______.',
      answer: 'astonished',
      evidence: 'Many were astonished when the video was played again.',
    },
    {
      kind: 'short',
      marks: 2,
      stem: 'Using your own words, explain what the 1999 study showed about the conditions that make people more likely to miss an unexpected event.',
      answer:
        'People missed it more often when their task was more demanding, for example when they had to keep two separate counts, and when the unexpected thing looked different from what they were watching: the dark gorilla was missed more by people following the white team.',
      evidence:
        'When the counting task was made harder, by asking observers to keep separate counts of two kinds of pass, fewer of them noticed the unexpected event.',
      rubric:
        '两分：写出「任务越难（例如要分开数两种传球），越容易漏看」给 1 分；写出「意外出现的东西和正在盯着看的东西不像时更容易漏看（深色的大猩猩，盯白队的人更少看到）」再给 1 分。只写「将近一半人没看到」给 0 分（那是结果，不是条件）。',
    },
    {
      kind: 'short',
      marks: 2,
      stem: 'According to the writer, what is a more realistic way to reduce the dangers of inattentional blindness, and why?',
      answer:
        'Systems should be designed so that they do not rely on a single person noticing everything, for example by having a second person check important images or by making warnings hard to ignore. This is because trying harder does not help: concentrating hard on one task is what causes the blindness in the first place.',
      evidence:
        'A more realistic approach is to design systems that do not depend on one person noticing everything, for example by having important images checked by a second reader or by making warnings hard to ignore.',
      rubric:
        '两分：写出「设计不依赖某一个人看到一切的制度」给 1 分（写原则或举一个例子都可：重要影像由第二个人再看一遍、把警示做得很难被忽略）；写出「因为光靠更努力没用 —— 全神贯注于一件事正是造成视而不见的原因」再给 1 分。只写「要更专心」给 0 分（与原文意思相反）。',
    },
  ],
};

// ═══════════════════════════════════════════════════════════════
// 周四 —— 为道路付费：拥堵收费（经济 / 城市）
//
// 出处与把握：
// · Vickrey：1950 年代提出按需求定价（1952 年纽约地铁高峰加价，后推及道路）；1996 年
//   诺贝尔经济学奖（获奖理由主要是信息不对称下的激励理论，不是拥堵定价，正文写
//   「mainly for other work」）—— 高（Columbia 讣告、vtpi.org）。
// · 新加坡 ALS：World Bank Staff Working Paper 281（Watson & Holland 1978，原文 PDF 已下载
//   核对）—— 1975-06-02 开始；早高峰进入限制区的私家车须买贴纸质许可证，日票 3 新元；
//   公交、商用车、摩托车免，四人以上合乘免（「回应只有富人才开得进市中心的批评」）；
//   首创、费率只能凭判断定；政府目标早高峰入区车流减 25–30%；1975 年 3 月到 10 月
//   7:30–10:15 入区汽车减少 73%，合乘车占比由不到 10% 升到 44%；区内车速升约 20%；
//   观察者认为定价过高、区内道路利用不足；收费原为 7:30–9:30，9:30 后形成新高峰，
//   几周后延到 10:15；7:30 前半小时入区汽车增 23%；环路车速降约 20%；外围停车场 +
//   接驳巴士几乎没人用 —— 高。
// · 1998 年改为电子道路收费（ERP），经过龙门架自动扣费，费率随时段与地点变化 —— 高
//   （世界银行档案展 2006 与 LTA 公开说明；正文不写任何费率与速度区间）。
// · 伦敦 2003 年、纽约 2025 年 1 月开征 —— 高。
// · 斯德哥尔摩：Eliasson 2014「The Stockholm congestion charges: an overview」（CTS 2014:7，
//   原文 PDF 已核）—— 2006 年 1 月起试行、7 月 31 日结束，之后公投；试行前支持率 34%；
//   过线车流稳定在约 -22%（目标 10–15%），拥堵 / 排队时间减少 30–50%；试行开始后
//   支持率升到 53%；9 月公投有效票 53% 赞成保留；2007 年 8 月永久恢复；2007-12 支持
//   65%、2013 年末 72%；「familiarity breeds acceptability」—— 高。
// · 末段批评（固定收费对穷人负担更重、商户担心客流）与支持者回应是常见论点，写成
//   「may」与「supporters reply」，不归给具体研究。
// ═══════════════════════════════════════════════════════════════

const ROAD = {
  key: 'original-w6-road-pricing',
  title: 'Paying for the Road',
  passage: lettered([
    `Every driver who joins a crowded road slows everyone else down a little, yet pays nothing for the delay this causes. In the 1950s, the American economist William Vickrey argued that this was the real cause of congestion: road space at busy times was valuable but free, so it was overused. His solution was to charge for roads and other transport according to demand, with the highest prices at the busiest times. Vickrey later received a Nobel Prize in economics, although mainly for other work.`,
    `The first city to put the idea into practice was Singapore. From 2 June 1975, drivers of private cars entering a Restricted Zone in the city centre during the morning rush hour had to buy and display a paper licence costing three Singapore dollars a day. Buses, commercial vehicles and motorcycles were exempt, and so were cars carrying at least four people, partly to answer the objection that only the rich would be able to drive into the centre. Because no other city had tried such a scheme, the fee had to be set by judgement.`,
    `The results, studied closely by the World Bank, were more dramatic than planned. The government's aim was to reduce morning traffic entering the zone by 25 to 30 per cent. In fact, total traffic entering during the charging hours fell by more than 40 per cent, and between March and October 1975 the number of cars fell by 73 per cent; among the cars that still came in, the share carrying four or more people rose from under a tenth to 44 per cent. Speeds inside the zone increased by about a fifth. Some observers concluded that the fee had been set too high, leaving roads in the centre underused.`,
    `Drivers also responded in ways the planners had not intended. The charge first applied from 7.30 to 9.30 a.m., but so much traffic arrived just after it ended that a new jam formed, and within a few weeks the charging period was extended to 10.15. The number of cars entering in the half hour before 7.30 rose by almost a quarter as people set out earlier, and speeds on the ring road around the zone fell as traffic went round the centre rather than through it. A network of car parks at the edge of the centre, linked to it by shuttle buses, was hardly used.`,
    `In 1998, Singapore replaced its paper licences with Electronic Road Pricing, under which charges are deducted automatically as vehicles pass under gantries, and the amount varies with the time and place. Other cities were slower to follow, largely because such charges tend to be unpopular before they are introduced. London began charging drivers to enter its centre in 2003, and New York followed in January 2025.`,
    `The experience of Stockholm shows how quickly opinion can change. In January 2006, the Swedish capital began a trial in which drivers were charged for crossing a ring around the inner city, with a referendum to follow once it had ended. Just before the trial started, only about a third of residents supported the charge. Yet traffic across the ring fell by about a fifth, more than the planners had aimed for, and queuing times fell by between 30 and 50 per cent. Support rose once the benefits could be seen, and in the referendum that September, 53 per cent of valid votes were in favour of keeping the charge.`,
    `Switched off when the trial ended, the charge was reintroduced permanently in 2007, and support continued to grow, reaching around 70 per cent in later surveys. Researchers have summed up the pattern as "familiarity breeds acceptability": opposition is strongest before a charge exists, when its costs are easy to imagine and its benefits are not. Once it is in place, shorter journeys become part of daily experience, and the inconvenience may prove smaller than many had feared.`,
    `Road pricing still has critics. A fixed daily charge takes a larger share of a poor driver's income than of a rich one's, and shops inside a charging zone may fear that customers will stay away. Supporters reply that buses also benefit from emptier roads, and that the money raised can be used to improve public transport. What Singapore's first experiment shows most clearly, however, is that everything depends on the level of the price: set too low, it achieves little; set too high, it leaves valuable road space empty.`,
  ]),
  questions: [
    {
      kind: 'matchingParagraphs',
      items: [
        { item: 'a problem caused by the time at which a charge ended', letter: 'D' },
        { item: 'a phrase used to describe how attitudes to a charge develop', letter: 'G' },
        { item: 'a reason for letting some private cars in free', letter: 'B' },
      ],
    },
    {
      kind: 'tfng',
      item: 'Vickrey believed that the price of using a road should be highest when it is busiest.',
      answer: 'TRUE',
      evidence:
        'His solution was to charge for roads and other transport according to demand, with the highest prices at the busiest times.',
    },
    {
      kind: 'tfng',
      item: "Traffic inside Singapore's Restricted Zone moved more slowly after the charge was introduced.",
      answer: 'FALSE',
      evidence: 'Speeds inside the zone increased by about a fifth.',
    },
    {
      kind: 'tfng',
      item: 'Supporters of road pricing argue that buses also benefit from emptier roads.',
      answer: 'TRUE',
      evidence:
        'Supporters reply that buses also benefit from emptier roads, and that the money raised can be used to improve public transport.',
    },
    {
      kind: 'gapTyped',
      stem: 'Vickrey argued that because road space at busy times was valuable but free, it was ______.',
      answer: 'overused',
      evidence:
        'In the 1950s, the American economist William Vickrey argued that this was the real cause of congestion: road space at busy times was valuable but free, so it was overused.',
    },
    {
      kind: 'gapTyped',
      stem: "Under Singapore's electronic system, charges are deducted automatically as vehicles pass under ______.",
      answer: 'gantries',
      evidence:
        'In 1998, Singapore replaced its paper licences with Electronic Road Pricing, under which charges are deducted automatically as vehicles pass under gantries, and the amount varies with the time and place.',
    },
    {
      kind: 'short',
      marks: 2,
      stem: "Using your own words, explain why some observers believed that Singapore's original fee was too high.",
      answer:
        'Traffic fell far more than the government had aimed for: the target was a cut of 25 to 30 per cent, but total traffic fell by more than 40 per cent and the number of cars by 73 per cent, so roads in the centre were left partly empty.',
      evidence: 'Some observers concluded that the fee had been set too high, leaving roads in the centre underused.',
      rubric:
        '两分：写出「车流降幅远远超过政府目标（目标是减少 25%–30%，实际总车流减少四成以上、汽车减少 73%）」给 1 分；写出「结果市中心的道路空着、没有被充分利用」再给 1 分。只写「很多人付不起」给 0 分（原文没有这么说）。',
    },
    {
      kind: 'short',
      marks: 2,
      stem: "According to the passage, why did support for Stockholm's charge grow after it was introduced?",
      answer:
        'The trial let people see real benefits, since traffic fell by about a fifth and queuing times were cut by 30 to 50 per cent. Before a charge exists, its costs are easy to imagine but its benefits are not; once it is in place, shorter journeys become part of daily life and the inconvenience may be smaller than feared ("familiarity breeds acceptability").',
      evidence:
        'Researchers have summed up the pattern as "familiarity breeds acceptability": opposition is strongest before a charge exists, when its costs are easy to imagine and its benefits are not.',
      rubric:
        '两分：写出「试行让人们亲眼看到了好处：过线车流少了约五分之一、排队时间缩短 30%–50%」给 1 分；写出「收费开始前，人们容易想象代价、却想象不到好处；实行后更短的行程成了日常体验，不便也许比担心的小（即「越熟悉越能接受」）」再给 1 分。只写「因为公投通过了」给 0 分（公投是支持上升的结果，不是原因）。',
    },
  ],
};

// ═══════════════════════════════════════════════════════════════
// 周五 —— 巨石阵的石头从哪里来（考古）
//
// 出处与把握：
// · 巨石阵约公元前 3000 年起分阶段建造；大砂岩（sarsen）典型重约 20 吨、原有约 80 块、
//   现存 52 块；青石每块几吨 —— 高（English Heritage）。
// · 1923 年地质学家 H. H. Thomas 把部分青石对应到威尔士西部 Preseli 山，直线二百多
//   公里 —— 高。Parker Pearson 等 2015、2019（Antiquity）在 Carn Goedog 与 Craig
//   Rhos-y-felin 两处露头发现史前采石痕迹 —— 中高，正文写「what appear to be」。
//   少数地质学家主张冰川搬运 —— 高（正文写「A few geologists」）。
// · 大砂岩长期被认为来自北面的 Marlborough Downs，但没找到确切产地 —— 高。
// · Nash 等 2020, Science Advances 6(31):eabc0133：1958 年修缮时从开裂的 58 号石钻芯
//   以插金属杆加固；约 1.08 米长的一根岩芯作为纪念品给了钻探公司员工 Robert Phillips，
//   他带去美国，几十年后归还 English Heritage（归还年份各处说法不一，正文不写）；
//   便携仪器测 52 块中 50 块成分相近；岩芯做破坏性分析，与英国南部各地砂岩比对，
//   最匹配 Marlborough Downs 南缘的 West Woods，约在巨石阵以北 25 公里 —— 高
//   （English Heritage 2020 新闻稿、Current Archaeology、Live Science）。
// · 祭坛石：约 6 吨灰绿色砂岩，部分压在两块倒下的石头下；过去认为来自南威尔士；
//   Bevins 等 2023（J Archaeol Sci: Reports）认为它大概率不是威尔士老红砂岩 —— 高。
//   Clarke 等 2024, Nature 632:570–575（Curtin 大学博士生 Anthony Clarke 领衔）：测锆石、
//   金红石、磷灰石颗粒的年龄，得出来自苏格兰东北 Orcadian Basin，700 多公里 —— 研究
//   本身高；此后有学者质疑合并样本的做法，正文按主编要求写「the study concluded」，
//   不写成定论。
// · 运输方式未知（海运 / 陆运都有人主张）—— 高。
// · 2025 年 Journal of Archaeological Science：1924 年在南入口出土、约公元前 2995–2900 年
//   的牛下颌骨，牙齿同位素指向古生代岩区（与威尔士西部相似），为「牛帮忙运青石」提供
//   一些支持 —— 中高（UCL、BGS 新闻稿），正文写「lending some support」。
// · 「远方石头因来历而被看重、可能用来团结不同群体」写成「Some archaeologists suggest」
//   （Parker Pearson 的统一说；English Heritage 新闻稿提到与 Preseli 的神圣联系）。
// ═══════════════════════════════════════════════════════════════

const STONEHENGE = {
  key: 'original-w6-stonehenge-stones',
  title: 'The Stones That Travelled',
  passage: lettered([
    `Stonehenge, on Salisbury Plain in southern England, was built in several stages over many centuries, beginning around 3000 BC. Its builders used two main kinds of stone: huge blocks of a hard sandstone called sarsen, typically weighing around 20 tonnes, and much smaller "bluestones" of a few tonnes each. For about a hundred years researchers have tried to work out where these stones came from, and in recent years methods borrowed from geology have produced some surprising answers.`,
    `The bluestones were the first to be traced. In 1923, the geologist Herbert Thomas matched several of them with rocks in the Preseli Hills of west Wales, more than 200 kilometres away. Most archaeologists believe that people moved them, and more recent excavations at two rocky outcrops in the hills have found what appear to be traces of prehistoric quarrying. A few geologists, however, have argued that glaciers carried the stones most of the way long before the monument was built.`,
    `The sarsens were long assumed to have come from the Marlborough Downs to the north, where similar stones still lie scattered on the ground, but no exact source had ever been identified. Part of the difficulty was that sarsen from different places looks very much alike, and taking samples from a protected monument is rarely allowed.`,
    `An unexpected object solved the problem. During repair work in 1958, cylinders of rock were drilled out of one of the sarsens, which was cracked, so that metal rods could be inserted to strengthen it. One of these cores, about a metre long, was given as a souvenir to Robert Phillips, who worked for the drilling company. He kept it for decades, taking it with him when he moved to the United States, before finally returning it to English Heritage. This gave researchers a rare chance to carry out tests that would destroy part of a sample from the monument itself.`,
    `In 2020, a team led by the geographer David Nash first measured the chemistry of the surviving sarsens with a portable instrument and found that most of them had a similar composition, suggesting a common origin. The team then compared the core with sarsen boulders from across southern Britain. The closest match was with West Woods, an area on the southern edge of the Marlborough Downs about 25 kilometres north of Stonehenge. Most of the great stones, it seems, were brought from a single place.`,
    `The most surprising result concerns the Altar Stone, a six-tonne block of greenish sandstone at the centre of the monument, partly buried beneath two fallen stones. For decades it was thought to have come from south Wales, but a study published in 2023 found that its composition did not match Welsh rocks. In 2024, a team led by Anthony Clarke, a doctoral student at Curtin University in Australia, measured the ages of tiny mineral grains inside it. Because the grains in a sandstone are worn from older rocks, the mixture of their ages differs from one region to another and acts like a fingerprint. On this evidence, the study concluded that the stone came from north-east Scotland, more than 700 kilometres away.`,
    `How such a stone could have been moved so far is unknown. It might have been carried by sea around the coast or dragged overland, and either route would have required a great deal of organisation. Other evidence also points to wide connections: in 2025, analysis of a cow's tooth found at Stonehenge in 1924, and dating from around the time the monument was begun, suggested that the animal had lived in an area of rocks like those of west Wales, lending some support to the idea that cattle helped to haul the bluestones.`,
    `These findings have changed how Stonehenge is understood. It was not simply a local monument built from whatever stones lay nearby, but a project that drew materials, and presumably people, from across Britain. Some archaeologists suggest that the distant stones were valued precisely because of where they came from, perhaps as a way of uniting different communities. For now, that remains an interpretation rather than a finding: the rocks can reveal where they came from, but not why anyone went to such trouble to move them.`,
  ]),
  questions: [
    {
      kind: 'matchingParagraphs',
      items: [
        { item: 'evidence from an animal that may be linked to moving the stones', letter: 'G' },
        { item: 'reasons why the source of the large stones was hard to find', letter: 'C' },
        { item: 'the view that natural forces moved some of the stones', letter: 'B' },
      ],
    },
    {
      kind: 'tfng',
      item: 'The sarsens at Stonehenge are lighter than the bluestones.',
      answer: 'FALSE',
      evidence:
        'Its builders used two main kinds of stone: huge blocks of a hard sandstone called sarsen, typically weighing around 20 tonnes, and much smaller "bluestones" of a few tonnes each.',
    },
    {
      kind: 'tfng',
      item: 'The 2020 study also identified where the sarsens with a different composition came from.',
      answer: 'NOT GIVEN',
    },
    {
      kind: 'tfng',
      item: 'For many years, the Altar Stone was believed to have come from Wales.',
      answer: 'TRUE',
      evidence:
        'For decades it was thought to have come from south Wales, but a study published in 2023 found that its composition did not match Welsh rocks.',
    },
    {
      kind: 'gapTyped',
      stem: 'Robert Phillips was given one of the 1958 cores as a ______.',
      answer: 'souvenir',
      evidence: 'One of these cores, about a metre long, was given as a souvenir to Robert Phillips, who worked for the drilling company.',
    },
    {
      kind: 'gapTyped',
      stem: 'Because the ages of the grains in a sandstone vary from region to region, they act like a ______.',
      answer: 'fingerprint',
      evidence:
        'Because the grains in a sandstone are worn from older rocks, the mixture of their ages differs from one region to another and acts like a fingerprint.',
    },
    {
      kind: 'short',
      marks: 2,
      stem: 'Using your own words, explain why the core returned by Robert Phillips was so valuable to researchers.',
      answer:
        'Samples can rarely be taken from the monument, so the core gave scientists an unusual chance to cut up and destroy part of a real Stonehenge sarsen in their tests. This let them compare its chemistry in detail with sarsen from other places, and it matched West Woods.',
      evidence: 'This gave researchers a rare chance to carry out tests that would destroy part of a sample from the monument itself.',
      rubric:
        '两分：写出「巨石阵是受保护的古迹，平时很少允许取样；这根岩芯让研究者难得能做会毁掉样品的检测」给 1 分；写出「因此能把它的化学成分和英国南部各地的砂岩逐一比对，找到了相符的产地 West Woods」再给 1 分。只写「因为岩芯很长」或「因为它在美国放了几十年」给 0 分。',
    },
    {
      kind: 'short',
      marks: 2,
      stem: 'What does the writer mean by saying that the rocks "can reveal where they came from, but not why anyone went to such trouble to move them"?',
      answer:
        "Scientific tests can show where the stones came from, such as Wales, West Woods and Scotland, but they cannot show the builders' reasons. Ideas such as the stones being valued for their origin, or being used to unite communities, are only interpretations, not proven findings.",
      evidence:
        'For now, that remains an interpretation rather than a finding: the rocks can reveal where they came from, but not why anyone went to such trouble to move them.',
      rubric:
        '两分：写出「科学检测能查出石头的产地（如威尔士、West Woods、苏格兰）」给 1 分；写出「但查不出建造者为什么费这么大力气搬运 ——「看重石头的来历」「借此团结不同群体」这类说法只是推测，不是证实了的结论」再给 1 分。只写「石头不会说话」而不作解释给 0 分。',
    },
  ],
};

const SPECS = [SCURVY, ARAL, BLINDNESS, ROAD, STONEHENGE];

module.exports = {
  LEVEL,
  SPECS,
  DAYS: DATES.slice(0, SPECS.length).map((date, i) => buildAuthoredDay(SPECS[i], date)),
};
