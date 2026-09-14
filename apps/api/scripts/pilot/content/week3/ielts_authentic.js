/**
 * 第三周 —— **ielts_authentic（雅思真题难度）**档，全原创学术说明文。
 *
 * 六百词上下、八段、按 Paragraph A–H 编号（段落信息配对要靠字母）。形状：
 *   3 道段落信息配对 · 3 道判断（各一） · 2 道原文单词填空（要拼写） ·
 *   2 道两分主观题 —— 满分 12。
 *
 * 引用的研究与数字写之前逐条核过出处（见每篇上方注释）。文章是自己写的，
 * 不是摘录；研究结论用自己的话转述。
 */

'use strict';

const { buildAuthoredDay, lettered } = require('../authored');
const { DATES } = require('./dates');

const LEVEL = 'ielts_authentic';

// ═══════════════════════════════════════════════════════════════
// 周一 —— 雁阵的空气动力学
//
// 出处：Lissaman & Shollenberger 1970（Science，25 只鸟、航程约多 71%）；
// Weimerskirch 等 2001（Nature，训练白鹈鹕跟随快艇与超轻型飞机、心率更低、
// 滑翔更多）；Portugal 等 2014（Nature，隐鹮、记录每一次振翅、V 形位置同相
// 振翅、正后方反相）；Voelkl 等 2015（PNAS，成对轮流领飞）。
// ═══════════════════════════════════════════════════════════════

const V = {
  key: 'original-w3-v-formation',
  title: 'Why Birds Fly in a V',
  passage: lettered([
    'Anyone who has watched geese or cranes on migration will have noticed that large birds rarely travel in a disorderly crowd. They fly in lines or, most famously, in a V. For centuries this was explained in vague terms of leadership and discipline. The modern explanation is aerodynamic, and it has taken more than fifty years, and a great deal of ingenuity, to confirm it.',
    'The theory is straightforward. A flapping wing pushes air downwards, but at the wingtip some of that air curls up and around, creating a rotating vortex. Behind and slightly to the side of each bird, therefore, there is a region of rising air. A second bird positioned in that region gets a small, free upward push on every wingbeat, and so needs less effort to stay aloft.',
    'In 1970 two engineers, Peter Lissaman and Carl Shollenberger, applied the equations used for aircraft wings to a flock of twenty-five birds and calculated that, flying in a V, the flock could travel about seventy per cent further than a single bird on the same energy. The figure was widely quoted. It was also almost impossible to test, because nobody could measure what a wild bird\'s wings were doing in flight.',
    'The first strong evidence was indirect. In 2001 a team led by Henri Weimerskirch trained great white pelicans to fly behind a motorboat and a light aircraft, and fitted them with heart-rate monitors. Birds flying in formation had lower heart rates than birds flying alone, and they spent more of their time gliding rather than flapping. Something was clearly saving them energy, but the study could not show exactly what.',
    'The decisive experiment came in 2014. Researchers working with a conservation project that teaches young northern bald ibises to migrate behind a microlight aircraft fitted the birds with lightweight data loggers recording position and every single wingbeat. The results were striking. Birds consistently placed themselves where theory predicted the most lift, and they timed their wingbeats to match the bird in front, so that their wingtips followed the path of the rising air.',
    'The loggers also revealed something the equations had not predicted. When a bird flew directly behind another, in a zone where the air is pushed downwards rather than up, it reversed the timing of its wingbeats, apparently to reduce the penalty. The birds were not simply finding a good seat; they were continuously adjusting to the air around them, in ways that engineers have found difficult to copy with aircraft.',
    'A formation raises an obvious question of fairness. The bird at the front receives no benefit, so why would any bird agree to lead? A follow-up study of the same ibises found that they took turns. Pairs of birds swapped places repeatedly, each spending roughly as much time in front as behind the other, a pattern that biologists describe as reciprocal cooperation.',
    'None of this means that energy is the only reason for formation flight. Flying in a V may also help birds keep sight of each other and avoid collisions, and smaller birds, whose wings create much weaker vortices, often fly in loose flocks with no formation at all. But for large birds covering thousands of kilometres, the V appears to be, above all, a way of sharing the cost of the journey.',
  ]),
  questions: [
    {
      kind: 'matchingParagraphs',
      items: [
        { item: 'a possible reason why smaller birds do not usually fly in formation', letter: 'H' },
        { item: 'a calculation that could not at first be checked', letter: 'C' },
        { item: 'a finding that the theory had not anticipated', letter: 'F' },
      ],
    },
    {
      kind: 'tfng',
      item: 'The pelicans in the 2001 study flapped their wings more when flying in formation.',
      answer: 'FALSE',
      evidence:
        'Birds flying in formation had lower heart rates than birds flying alone, and they spent more of their time gliding rather than flapping.',
    },
    {
      kind: 'tfng',
      item: 'The ibises in the 2014 study carried devices that recorded each wingbeat.',
      answer: 'TRUE',
      evidence:
        'Researchers working with a conservation project that teaches young northern bald ibises to migrate behind a microlight aircraft fitted the birds with lightweight data loggers recording position and every single wingbeat.',
    },
    {
      kind: 'tfng',
      item: 'Lissaman and Shollenberger later tested their calculation on real birds.',
      answer: 'NOT GIVEN',
    },
    {
      kind: 'gapTyped',
      stem: 'At the tip of a flapping wing, air curls up and around to form a rotating ______.',
      answer: 'vortex',
      evidence:
        'A flapping wing pushes air downwards, but at the wingtip some of that air curls up and around, creating a rotating vortex.',
    },
    {
      kind: 'gapTyped',
      stem: 'Biologists describe the way pairs of ibises take turns at the front as reciprocal ______.',
      answer: 'cooperation',
      evidence:
        'Pairs of birds swapped places repeatedly, each spending roughly as much time in front as behind the other, a pattern that biologists describe as reciprocal cooperation.',
    },
    {
      kind: 'short',
      marks: 2,
      stem: 'Using your own words, explain why a bird flying behind and to the side of another needs less energy.',
      answer:
        'The wingtip of the bird in front creates a swirl of rising air; the following bird flies in that rising air, which lifts it slightly on every wingbeat, so it has to work less hard to stay up.',
      evidence:
        'A second bird positioned in that region gets a small, free upward push on every wingbeat, and so needs less effort to stay aloft.',
      rubric:
        '两分：写出「前面那只鸟的翼尖产生上升气流」给 1 分；点明「后面的鸟借这股气流被托起，所以省力」再给 1 分。只写「减少风阻」给 0 分。',
    },
    {
      kind: 'short',
      marks: 2,
      stem: 'Why is it surprising that any bird agrees to lead a formation, and how do the ibises deal with this?',
      answer:
        'The leader gets no benefit from the rising air, so leading is costly; the ibises take turns, each spending about as much time in front as behind.',
      evidence: 'The bird at the front receives no benefit, so why would any bird agree to lead?',
      rubric: '两分：写出「领头的鸟得不到任何好处」给 1 分；写出「它们轮流领飞、前后时间大致相等」再给 1 分。',
    },
  ],
};

// ═══════════════════════════════════════════════════════════════
// 周二 —— 集装箱
//
// 出处：Marc Levinson, The Box（2006）—— 1956 年 4 月 Ideal X 从新泽西开往
// 休斯敦、58 个集装箱、McLean 自算装卸费从每吨约 5.86 美元降到 0.16 美元；
// 国际标准 1960 年代末；越战补给与日本货的回程；伦敦、纽约老码头衰落。
// 新加坡丹戎巴葛集装箱码头 1972 年启用。
// ═══════════════════════════════════════════════════════════════

const BOX = {
  key: 'original-w3-container',
  title: 'The Unremarkable Box',
  passage: lettered([
    'Few inventions look less remarkable than the shipping container: a steel box, usually twenty or forty feet long, with doors at one end. Yet economists who study the growth of world trade after 1960 increasingly give it as much credit as tariff cuts or trade agreements. The container did not make ships faster. What it changed was everything that happened while a ship was in port.',
    'Before containers, cargo was loaded piece by piece. Sacks, barrels, crates and bales were carried from warehouses to the quayside, lifted aboard in slings and packed by hand in the hold, a process that could keep a ship in port for as long as it spent at sea. Theft was common, damage more so, and loading and unloading could account for as much as half of the total cost of a voyage.',
    'The idea of sending goods in standard boxes was not new, but in 1956 an American trucking businessman, Malcolm McLean, made it work at scale. He bought a pair of old tankers, strengthened their decks, and in April of that year sent one of them, the Ideal X, from New Jersey to Texas carrying fifty-eight truck-sized containers. By his own calculation, the cost of loading fell from almost six dollars a ton to sixteen cents.',
    'Other shipping companies were slow to follow, partly because every firm used boxes of different sizes and fittings. A container that fitted one company\'s cranes and trucks was useless to another\'s. The obstacle was not engineering but agreement, and it took years of negotiation before international standards for container dimensions and corner fittings were settled in the late 1960s.',
    "The Vietnam War accelerated the change. The United States military, struggling to supply its forces through congested ports, turned to McLean's company, and the containers that sailed full to Vietnam were filled with Japanese electronics for the return trip. The route helped connect Asian manufacturers directly to American shops.",
    "The effect on ports was brutal. Container ships needed deep water, huge cranes and acres of flat land for stacking boxes, which old city-centre docks could not provide. Within two decades the historic docks of London and New York had largely closed, and tens of thousands of dockworkers' jobs disappeared. New ports, often built on empty land far from the old harbours, took their place.",
    'Singapore was among the ports that moved early. Its first container terminal opened at Tanjong Pagar in the early 1970s, and the city later became one of the busiest container ports in the world. For countries along the main shipping routes, the question was no longer whether to build for containers, but how quickly.',
    'Historians still argue about how much of the post-war trade boom the container can explain; rising incomes and lower tariffs mattered too. What is not in dispute is that it made the distance between factory and customer far less important, and in doing so it changed where things are made. The box seems unremarkable precisely because it has become the background of modern life.',
  ]),
  questions: [
    {
      kind: 'matchingParagraphs',
      items: [
        { item: 'an example of a port that prepared for containers at an early stage', letter: 'G' },
        { item: 'a reason why the new system was slow to spread', letter: 'D' },
        { item: 'the cost of the change for people who worked at the old docks', letter: 'F' },
      ],
    },
    {
      kind: 'tfng',
      item: 'Container ships sail faster than the ships they replaced.',
      answer: 'FALSE',
      evidence: 'The container did not make ships faster.',
    },
    {
      kind: 'tfng',
      item: 'The Ideal X carried fifty-eight containers from New Jersey to Texas.',
      answer: 'TRUE',
      evidence:
        'He bought a pair of old tankers, strengthened their decks, and in April of that year sent one of them, the Ideal X, from New Jersey to Texas carrying fifty-eight truck-sized containers.',
    },
    {
      kind: 'tfng',
      item: 'McLean had worked on ships before he started his trucking business.',
      answer: 'NOT GIVEN',
    },
    {
      kind: 'gapTyped',
      stem: 'Before containers, cargo was lifted aboard ships in ______ and packed by hand.',
      answer: 'slings',
      evidence:
        'Sacks, barrels, crates and bales were carried from warehouses to the quayside, lifted aboard in slings and packed by hand in the hold, a process that could keep a ship in port for as long as it spent at sea.',
    },
    {
      kind: 'gapTyped',
      stem: 'In the late 1960s, international standards were agreed for container dimensions and corner ______.',
      answer: 'fittings',
      evidence:
        'The obstacle was not engineering but agreement, and it took years of negotiation before international standards for container dimensions and corner fittings were settled in the late 1960s.',
    },
    {
      kind: 'short',
      marks: 2,
      stem: 'Using your own words, explain what the writer means in Paragraph A by saying the container changed what happened "while a ship was in port" rather than the voyage itself.',
      answer:
        'The sea journey was no faster, but loading and unloading became far quicker and cheaper, so ships spent much less time and money in port, with less theft and damage.',
      evidence: 'What it changed was everything that happened while a ship was in port.',
      rubric:
        '两分：写出「海上航行本身并没有变快」给 1 分；点明「装卸变快、变便宜（在港时间短、少丢少损）」再给 1 分。',
    },
    {
      kind: 'short',
      marks: 2,
      stem: 'According to Paragraph E, how did the Vietnam War help to link Asian factories with American shops?',
      answer:
        'Containers that carried supplies to US forces in Vietnam were refilled with Japanese electronics for the journey back, creating a trade route from Asia to America.',
      evidence:
        "The United States military, struggling to supply its forces through congested ports, turned to McLean's company, and the containers that sailed full to Vietnam were filled with Japanese electronics for the return trip.",
      rubric:
        '两分：写出「给越南美军运补给的集装箱，返程时装上日本电子产品」给 1 分；点明「由此形成亚洲工厂直通美国商店的航线」再给 1 分。',
    },
  ],
};

// ═══════════════════════════════════════════════════════════════
// 周三 —— 棉花糖实验的另一面
//
// 出处：Shoda, Mischel & Peake 1990（Developmental Psychology 26:978–986，
// 1968–1974 年斯坦福 Bing 幼儿园共 653 名孩子；奖励有棉花糖、椒盐卷饼棒、
// 塑料筹码；奖励可见/遮住、教分心策略；只有 94 名孩子的家长报了 SAT；
// 约十年后经家长回访）；Stanford Magazine「Four Classic Bing Studies」
// （遮住奖励、给分心建议更容易等）；Watts, Duncan & Quan 2018（Psychological
// Science，NICHD SECCYD 出生起追踪、54 个月测、上限 7 分钟、15 岁成绩、
// n=918、重点看母亲未读完大学的孩子；相关只有原研究一半、加控制后再减三分之二、
// 差异主要在能否等满 20 秒）；Kidd, Palmeri & Aslin 2013（Cognition，罗切斯特
// 大学，28 名孩子、美术材料两次许诺、守信组平均 12 分 02 秒 vs 失信组 3 分 02 秒）；
// Carlson 等 2018（Developmental Psychology，Mischel 为合著者，840 名中高收入
// 家庭孩子、1960s/1980s/2000s 三批，2000s 比 1960s 平均多等约 2 分钟；
// 358 名美国成人调查多数预计现在的孩子等得更短）。
// ═══════════════════════════════════════════════════════════════

const MARSHMALLOW = {
  key: 'original-w3-marshmallow-test',
  title: 'The Trouble with the Marshmallow Test',
  passage: lettered([
    "Few experiments in psychology are as well known outside universities as the marshmallow test. A young child is left alone with a treat and told that, if they can resist eating it until an adult returns, they will receive a second one. For decades the test was presented in books and classrooms as a glimpse of a child's future: the child who could wait, it was said, would grow into a successful adult. The story is appealing, but the research behind it is considerably more complicated.",
    "The studies began at a nursery school on the campus of Stanford University. Between 1968 and 1974, the psychologist Walter Mischel and his colleagues tested 653 pre-school children. The rewards varied: a marshmallow, a small pretzel stick or even a plastic token. So did the conditions: sometimes the treats were in full view and sometimes hidden, and some children were given ideas for distracting themselves. The original aim was not to forecast the children's futures but to understand what makes waiting easier.",
    "The claim that made the test famous came later. More than ten years after the experiments, the researchers contacted the children's parents, and in 1990 Mischel and two colleagues reported that, under certain test conditions, pre-schoolers who had waited longer tended to achieve higher scores as teenagers on the SAT, a test used for admission to American universities. The finding attracted enormous attention, but it rested on a narrow base. Scores were supplied for only 94 children, and all of them had attended the same university nursery school.",
    'In 2018 Tyler Watts, Greg Duncan and Haonan Quan set out to test the claim with a larger and more diverse group. They drew on a long-running American study that had followed children from birth. At the age of four and a half, the children had been given a version of the waiting task in which seven minutes was the longest anyone was asked to wait, and their school achievement had been measured again at fifteen. The analysis included more than 900 children, and the team paid particular attention to those whose mothers had not completed a university degree.',
    'The results were mixed. The link between waiting and later achievement was still there, but it was only about half as strong as in the original studies. Once the researchers took into account family background, early cognitive ability and the home environment, it shrank by around two thirds. Moreover, most of the difference in teenage achievement lay between children who could wait for at least twenty seconds and those who could not.',
    'Other researchers questioned what the test measures in the first place. In a 2013 study at the University of Rochester, Celeste Kidd and her colleagues began by giving 28 children an art activity, twice promising them better materials if they were patient. For half of the children the adult kept both promises; for the rest, the adult came back empty-handed. When the same children then faced the marshmallow task, those who had dealt with a reliable adult waited for about twelve minutes on average, compared with about three minutes for those who had been let down. A child who gives in quickly, the researchers argued, may be making a sensible decision about whether a promise is worth trusting.',
    'Even the average ability to wait seems to shift over time. In another 2018 study, a team that included Mischel himself compared 840 children tested in the late 1960s, the 1980s and the 2000s, all from comparatively well-off families. In a survey within the same research, most American adults predicted that children now would give up sooner. In fact, the reverse was true: children tested in the 2000s waited about two minutes longer, on average, than those tested in the 1960s.',
    'None of this means that self-control does not matter, or that the original experiments were poorly done. The Stanford studies revealed a great deal about what helps young children resist temptation, such as keeping a reward out of sight or thinking about something else. What the later work questions is the popular leap from a few minutes in a nursery school to a prediction about an entire life. How long a child waits, it seems, depends on circumstances as well as character: the family they grow up in, and whether the adults around them keep their word.',
  ]),
  questions: [
    {
      kind: 'matchingParagraphs',
      items: [
        { item: 'a defence of the original investigators against a possible criticism', letter: 'H' },
        { item: 'the question that the early experiments were actually intended to answer', letter: 'B' },
        { item: 'a result that contradicted a common assumption about how children have changed', letter: 'G' },
      ],
    },
    {
      kind: 'tfng',
      item: "Kidd's findings have since been confirmed by a larger study.",
      answer: 'NOT GIVEN',
    },
    {
      kind: 'tfng',
      item: 'Watts and his colleagues found that most of the gap in later achievement lay between children who could not hold out for a third of a minute and those who could.',
      answer: 'TRUE',
      evidence:
        'Moreover, most of the difference in teenage achievement lay between children who could wait for at least twenty seconds and those who could not.',
    },
    {
      kind: 'tfng',
      item: 'The 1990 report found that waiting predicted later scores regardless of how the test had been set up.',
      answer: 'FALSE',
      evidence:
        "More than ten years after the experiments, the researchers contacted the children's parents, and in 1990 Mischel and two colleagues reported that, under certain test conditions, pre-schoolers who had waited longer tended to achieve higher scores as teenagers on the SAT, a test used for admission to American universities.",
    },
    {
      kind: 'gapTyped',
      stem: "When differences in upbringing and in children's early ______ ability were allowed for, the connection found by Watts's team became far weaker.",
      answer: 'cognitive',
      evidence:
        'Once the researchers took into account family background, early cognitive ability and the home environment, it shrank by around two thirds.',
    },
    {
      kind: 'gapTyped',
      stem: "The writer's final point is that personality alone does not decide how long a child waits: the child's ______, such as home life and whether adults can be trusted, matter too.",
      answer: 'circumstances',
      evidence:
        'How long a child waits, it seems, depends on circumstances as well as character: the family they grow up in, and whether the adults around them keep their word.',
    },
    {
      kind: 'short',
      marks: 2,
      stem: 'Give two reasons from the passage why the 1990 link between waiting and SAT scores may not apply to children in general.',
      answer:
        'Scores were available for only 94 children, which is a small group; and all of those children came from the same university nursery school, so they were not typical. (Also acceptable: the link appeared only under certain test conditions; a later, larger and more diverse study found the link only about half as strong.)',
      evidence:
        'Scores were supplied for only 94 children, and all of them had attended the same university nursery school.',
      rubric:
        '两分：以下任意两点各 1 分 ——①样本小（只有 94 名孩子提供了分数）；②孩子都来自同一所大学附属幼儿园，背景单一、不具代表性；③这种联系只在某些测试条件下才出现；④后来规模更大、更多样的研究发现这种联系只有原来的一半左右。只写「研究年代太久」或「孩子太小」给 0 分。',
    },
    {
      kind: 'short',
      marks: 2,
      stem: "How did Kidd's 2013 study challenge the idea that a short wait simply shows poor self-control?",
      answer:
        'Children who had seen an adult keep promises waited about twelve minutes, but those who had been let down waited only about three; so a child who eats the treat quickly may be sensibly judging that the promise of a second treat cannot be trusted.',
      evidence:
        'A child who gives in quickly, the researchers argued, may be making a sensible decision about whether a promise is worth trusting.',
      rubric:
        '两分：写出「之前遇到守信大人的孩子等得久（约 12 分钟），被失信的孩子只等约 3 分钟」（对比到位即可，数字可不写）给 1 分；点明「所以很快吃掉可能是在理性判断承诺靠不靠得住，而不是自控力差」再给 1 分。只写「孩子不喜欢棉花糖」给 0 分。',
    },
  ],
};

// ═══════════════════════════════════════════════════════════════
// 周四 —— 口服补液盐
//
// 出处：Lancet 1978 社论（葡萄糖与钠在小肠耦合吸收「可能是本世纪最重要的
// 医学进展」）；WHO 腹泻病情况说明（ORS=清洁水+盐+糖、每次几美分；每年约
// 443,832 名五岁以下儿童死于腹泻；锌缩短病程约 25%；过去主要死于脱水、如今
// 败血性细菌感染占比上升）；Asterisk Magazine「Salt, Sugar, Water, Zinc」
// （1832 年爱丁堡 Latta 静脉注射盐水；1950s 末–60s 初发现钠-葡萄糖共转运；
// 1962 年马尼拉 Phillips 试验死亡）；Clinical Infectious Diseases 2002
// Phillips 传记文（1962 试验数名病人死亡、令他放弃口服疗法）；Our World in Data
// （静脉输液需医院与训练有素的人员；1978 WHO 腹泻病控制规划；ORS 不能止泻）；
// Nalin, Cash 等 1968（Lancet，Dacca 霍乱研究实验室，重症成人可省去四分之三以上
// 静脉输液）；Pierce 等 1969（Annals of Internal Medicine，加尔各答类似结果）；
// Mahalanabis 讣告（National Medical Journal of India 2023，Bangaon 营地几乎无
// 静脉液、市场买葡萄糖/盐/小苏打分装小袋、教家属用杯喂、营地死亡率 3.6%、约为
// 别处 30% 的十分之一、数年后才被普遍接受）；PMC11244720（葡萄糖形成渗透梯度带动
// 钠与水吸收）；WHO/UNICEF 2004 联合声明（2002 年起推荐低渗配方，排便量与呕吐
// 减少）；UNICEF Data（撒哈拉以南非洲 2023 年 ORS 覆盖率 37%）。
// ═══════════════════════════════════════════════════════════════

const ORS = {
  key: 'original-w3-oral-rehydration',
  title: 'A Cure Mixed in a Cup',
  passage: lettered([
    'In 1978 the medical journal The Lancet made a striking claim. The discovery that the small intestine absorbs salt and sugar together, it suggested, was potentially the most important medical advance of the century. The treatment built on that discovery involves no expensive drug or machine. Oral rehydration solution is simply clean water mixed with carefully measured amounts of salt and sugar, and a single treatment costs only a few cents. Its story, however, involves failure and doubt as well as success.',
    'Cholera and other diarrhoeal diseases have traditionally killed mainly through dehydration: the body loses water and salts faster than they can be replaced. As early as 1832, a doctor in Edinburgh injected salt solution into the veins of cholera patients, and by the twentieth century intravenous drips had become the standard hospital treatment. Drips, however, require sterile fluid, equipment and trained staff, all of which tend to be scarce where cholera strikes hardest. For much of the world, the most effective treatment was therefore out of reach.',
    'The key to an alternative came from scientific research in the late 1950s and early 1960s, which showed that the gut absorbs sodium and glucose together. When glucose molecules pass through the lining of the small intestine, sodium travels with them, and water follows by osmosis. Turning this knowledge into a treatment was not straightforward, however. An early trial in Manila in 1962 went badly wrong: several patients died, and the doctor in charge concluded that treatment by mouth would not work.',
    'The breakthrough came in Dhaka, then part of East Pakistan, at a laboratory devoted to cholera research. In 1968 two American doctors, David Nalin and Richard Cash, gave adult cholera patients a drink containing glucose and salt. Their results, published in The Lancet that year, showed that among the most seriously ill, the drink cut the amount of intravenous fluid needed by more than three-quarters. At around the same time, researchers working in Calcutta, in India, reported similar results.',
    "The treatment faced its greatest test in 1971. During the war that led to the independence of Bangladesh, millions of refugees crossed into India, and cholera spread rapidly through the crowded camps. At Bangaon, near the border, the Indian doctor Dilip Mahalanabis had nowhere near enough intravenous fluid. He bought glucose, salt and baking soda in local markets, packed them into small bags and taught patients' relatives to give the solution with a cup. In the camp where he worked, the death rate was 3.6 per cent, about a tenth of the 30 per cent recorded elsewhere.",
    'Even so, it took several years for the findings to be generally accepted. In 1978 the World Health Organization set up a programme to control diarrhoeal diseases, and packets of oral rehydration salts were soon being manufactured in vast numbers. The recipe itself has also been improved. Since 2002 the WHO has recommended a less concentrated formula, which reduces both the volume of diarrhoea and the amount of vomiting compared with the original version.',
    "Yet the treatment has an obvious weakness from a parent's point of view: it does not stop diarrhoea. It replaces the water and salts that the body loses, but the illness still has to run its course, which may make the solution seem less impressive than a medicine that appears to work straight away. Zinc supplements, which shorten episodes by about a quarter, are now recommended alongside it. Even so, use remains low in many regions: in sub-Saharan Africa in 2023, only 37 per cent of young children with diarrhoea were given oral rehydration salts.",
    'Diarrhoea still kills around 440,000 children under the age of five every year, according to the WHO, and a growing share of these deaths are thought to be caused not by dehydration but by bacterial infections that spread through the body. Oral rehydration cannot solve every problem. But its history offers a lesson that reaches beyond medicine: the hardest part of a simple cure is often not discovering it, but persuading people to trust it and use it.',
  ]),
  questions: [
    {
      kind: 'matchingParagraphs',
      items: [
        { item: 'a period of hesitation that followed a dramatic success', letter: 'F' },
        { item: 'independent support for a result obtained in another city', letter: 'D' },
        { item: 'a possible reason why families may doubt that the treatment is working', letter: 'G' },
      ],
    },
    {
      kind: 'tfng',
      item: 'Intravenous treatment for cholera was first attempted in the twentieth century.',
      answer: 'FALSE',
      evidence:
        'As early as 1832, a doctor in Edinburgh injected salt solution into the veins of cholera patients, and by the twentieth century intravenous drips had become the standard hospital treatment.',
    },
    {
      kind: 'tfng',
      item: 'Most of the patients treated at Bangaon were children.',
      answer: 'NOT GIVEN',
    },
    {
      kind: 'tfng',
      item: 'The formula the WHO recommends today is more dilute than its original formula.',
      answer: 'TRUE',
      evidence:
        'Since 2002 the WHO has recommended a less concentrated formula, which reduces both the volume of diarrhoea and the amount of vomiting compared with the original version.',
    },
    {
      kind: 'gapTyped',
      stem: 'A drip cannot be given without skilled personnel, the right apparatus and a supply of ______ fluid.',
      answer: 'sterile',
      evidence:
        'Drips, however, require sterile fluid, equipment and trained staff, all of which tend to be scarce where cholera strikes hardest.',
    },
    {
      kind: 'gapTyped',
      stem: 'An increasing proportion of child deaths from diarrhoea are now believed to result from ______ infections rather than from a loss of fluid.',
      answer: 'bacterial',
      evidence:
        'Diarrhoea still kills around 440,000 children under the age of five every year, according to the WHO, and a growing share of these deaths are thought to be caused not by dehydration but by bacterial infections that spread through the body.',
    },
    {
      kind: 'short',
      marks: 2,
      stem: 'Using information from the passage, explain how drinking a solution of salt and sugar can save the life of someone with cholera.',
      answer:
        'Cholera kills mainly through dehydration, because the body loses water and salts faster than they are replaced; in the solution, glucose carries sodium through the lining of the small intestine and water follows, so the lost fluid and salts are put back.',
      evidence:
        'When glucose molecules pass through the lining of the small intestine, sodium travels with them, and water follows by osmosis.',
      rubric:
        '两分：写出「霍乱主要靠脱水致死（失水失盐比补得快）」给 1 分；写出「葡萄糖带着钠穿过小肠壁、水随之被吸收，从而补回失去的水和盐」再给 1 分。只写「喝水就能补水」而没提葡萄糖与钠一起被吸收，第二分不给；写「能杀死细菌」给 0 分。',
    },
    {
      kind: 'short',
      marks: 2,
      stem: 'Why was oral rehydration particularly well suited to the situation at Bangaon, and what shows that it worked there?',
      answer:
        'Drips need sterile fluid, equipment and trained staff, and the camp had nowhere near enough intravenous fluid, whereas the oral solution could be made from glucose, salt and baking soda bought in local markets and given by relatives with a cup; the death rate in the camp was 3.6 per cent, about a tenth of the 30 per cent elsewhere.',
      evidence:
        'In the camp where he worked, the death rate was 3.6 per cent, about a tenth of the 30 per cent recorded elsewhere.',
      rubric:
        '两分：答出以下任一点给 1 分——营地的静脉输液远远不够；原料便宜、在当地市场就能买到并自己配；家属用杯子就能喂、不需要受过训练的人员。写出「营地死亡率 3.6%，约为别处 30% 的十分之一」再给 1 分，只写「死亡率下降」而无数字或对比不给这一分。只写「用静脉输液」给 0 分。',
    },
  ],
};

// ═══════════════════════════════════════════════════════════════
// 周五 —— 天气预报的一百年
//
// 出处：Bauer, Thorpe & Brunet 2015（Nature 525，「quiet revolution」，过去
// 四十年预报技巧约每十年提高一天）；Lynch 2022「Richardson's Forecast: the Dream
// and the Fantasy」（arXiv 2210.01674，1916 年加入 Friends Ambulance Unit 赴法国；
// 1910-05-20 中欧观测、6 小时、预报气压变化 145 hPa、大两个数量级、实际几乎不变；
// 1922 年 Weather Prediction by Numerical Process 附完整算例；64,000 人的
// 「预报工厂」、墙上画全球地图、中央指挥用光束示意超前/落后；Lynch 2006 数字滤波
// 初始化后得到合理结果，根源是初始资料里的重力波失衡；1950 ENIAC 四个「合理但
// 远非完美」的预报）；英国气象局「Celebrating 100 years of scientific
// forecasting」（六周多、救护队、64,000 人）；Richardson 本人「best part of six
// weeks」（前后跨时约两年，见 Lynch）；Charney, Fjørtoft & von Neumann 1950
// （Tellus，24 小时预报约算 24 小时，「just keep pace with the weather」）；
// MIT Technology Review 2011「When the Butterfly Effect Took Flight」（1961 年
// Lorenz 在 MIT，把 0.506127 输成打印稿上的 0.506，结果面目全非；两周预报极限）；
// ECMWF「30 years of ensemble forecasting」（1992 年起集合预报）；Lam 等 2023
// （Science，GraphCast 以 1979–2019 年 ERA5 再分析资料训练，90% 指标优于 HRES）。
// ═══════════════════════════════════════════════════════════════

const FORECAST = {
  key: 'original-w3-weather-forecast',
  title: 'The Forecast That Took Six Weeks',
  passage: lettered([
    "A five-day weather forecast has become so ordinary that few people stop to consider how remarkable it is. According to a review published in the journal Nature in 2015, forecasts have gained roughly one extra day of useful accuracy every ten years over the past four decades. The authors called this progress a 'quiet revolution', because it came from a steady build-up of scientific knowledge and computing power rather than from any single dramatic discovery. Its beginnings, however, were anything but quiet.",
    'During the First World War, the British scientist Lewis Fry Richardson served with an ambulance unit on the Western Front. While there, he pursued an extraordinary idea: that the weather could be calculated rather than judged from experience. The atmosphere, he reasoned, obeys the laws of physics. If its present state could be measured accurately, then equations describing pressure, temperature and wind could in principle be solved to show how it would develop.',
    'To test the idea, Richardson took weather observations recorded over central Europe on 20 May 1910 and, working entirely by hand, calculated how conditions would change over the following six hours. The arithmetic alone took him about six weeks of working time, squeezed in over a far longer period. The result was a disaster. He predicted that air pressure would rise by 145 hectopascals in six hours, a change about a hundred times too large to be realistic, when in fact the pressure had hardly altered at all.',
    'Richardson did not hide his failure. He set out the whole calculation in his 1922 book, Weather Prediction by Numerical Process, alongside a remarkable vision of how such forecasts might one day be produced in time to be useful. He imagined a vast round hall with a map of the globe painted on its walls, in which 64,000 human calculators would work together. From a platform at the centre, a director would use a beam of light to signal to those who were getting ahead of the others or falling behind.',
    'The vision became practical only with electronic computers. In 1950 a team including the meteorologist Jule Charney and the mathematician John von Neumann used ENIAC, one of the earliest electronic computers, to produce four forecasts for 24 hours ahead. The forecasts were broadly sensible, though by no means perfect. Yet each one took about 24 hours to compute, so the machine could only just keep up with the weather it was trying to predict.',
    "The reason for Richardson's failure was finally confirmed more than eighty years after his book appeared. In 2006 the meteorologist Peter Lynch reworked the calculation and showed that the method itself had been essentially sound. The trouble lay in the starting data, which contained small imbalances that the equations turned into huge, unrealistic waves in the atmosphere. Once these were smoothed away, the calculation produced a realistic result.",
    'Yet the starting point turned out to matter in an even deeper way. In 1961 Edward Lorenz, a meteorologist at the Massachusetts Institute of Technology, restarted a computer simulation of the weather part of the way through. Instead of the number 0.506127 stored in the machine, he typed in 0.506, the rounded figure shown on a printout. He expected the new run to repeat the old one. Instead, the two slowly separated until they looked completely different.',
    "Lorenz concluded that tiny errors in measuring the atmosphere grow until they overwhelm a forecast, which makes detailed prediction more than about two weeks ahead impossible. Forecasters have learned to live with this limit rather than defeat it. Since 1992 the European Centre for Medium-Range Weather Forecasts has run 'ensembles': dozens of forecasts that start from slightly different conditions and whose level of agreement shows how far a prediction can be trusted. Newer machine-learning models, trained on decades of past weather, are now challenging traditional methods, but they too rely on accurate observations of the present, the lesson Richardson learned the hard way.",
  ]),
  questions: [
    {
      kind: 'matchingParagraphs',
      items: [
        { item: 'an explanation of why an early attempt produced an absurd result', letter: 'F' },
        { item: 'the claim that improvements have come gradually rather than suddenly', letter: 'A' },
        { item: 'an imagined solution to the problem of slow calculation', letter: 'D' },
      ],
    },
    {
      kind: 'tfng',
      item: 'The 1950 machine produced its predictions well ahead of the events they described.',
      answer: 'FALSE',
      evidence:
        'Yet each one took about 24 hours to compute, so the machine could only just keep up with the weather it was trying to predict.',
    },
    {
      kind: 'tfng',
      item: "Richardson's method depended on having precise knowledge of the current condition of the atmosphere.",
      answer: 'TRUE',
      evidence:
        'If its present state could be measured accurately, then equations describing pressure, temperature and wind could in principle be solved to show how it would develop.',
    },
    {
      kind: 'tfng',
      item: "Lynch used a modern computer to repeat Richardson's calculation.",
      answer: 'NOT GIVEN',
    },
    {
      kind: 'gapTyped',
      stem: "ENIAC's 1950 forecasts were the work of a group that included both a weather scientist and a ______.",
      answer: 'mathematician',
      evidence:
        'In 1950 a team including the meteorologist Jule Charney and the mathematician John von Neumann used ENIAC, one of the earliest electronic computers, to produce four forecasts for 24 hours ahead.',
    },
    {
      kind: 'gapTyped',
      stem: "The shortened figure that Lorenz entered had been copied from a ______ rather than taken from the computer's memory.",
      answer: 'printout',
      evidence: 'Instead of the number 0.506127 stored in the machine, he typed in 0.506, the rounded figure shown on a printout.',
    },
    {
      kind: 'short',
      marks: 2,
      stem: "Compare the time needed to produce Richardson's forecast with the time needed for the 1950 ENIAC forecasts, taking into account how far ahead each one looked.",
      answer:
        'Richardson needed about six weeks of calculation to forecast just six hours ahead, whereas ENIAC took about 24 hours to produce a forecast for 24 hours ahead - far faster, although it could still only just keep pace with the weather.',
      evidence:
        'The arithmetic alone took him about six weeks of working time, squeezed in over a far longer period.',
      rubric:
        '两分：写出「Richardson 手算一个只看 6 小时的预报用了约六周」（写成「前后花了远比六周长的时间」也算）给 1 分；写出「ENIAC 算一个 24 小时的预报约需 24 小时（快得多，但也只是勉强跟上天气）」再给 1 分。只写「电脑比人快」而没有具体对比给 0 分。',
    },
    {
      kind: 'short',
      marks: 2,
      stem: 'Why is there a limit to how far ahead detailed weather forecasts can be made, and how have forecasters adapted to it?',
      answer:
        'Tiny errors in measuring the starting state of the atmosphere grow until they overwhelm the forecast, as Lorenz found when a rounded number changed his simulation completely, so detail beyond about two weeks is impossible; forecasters now run ensembles of many forecasts from slightly different starting conditions and use how closely they agree to judge how far a prediction can be trusted.',
      evidence:
        'Lorenz concluded that tiny errors in measuring the atmosphere grow until they overwhelm a forecast, which makes detailed prediction more than about two weeks ahead impossible.',
      rubric:
        '两分：写出「初始测量中的微小误差会不断放大、最终压倒预报（约两周以上的细节预报做不到）」给 1 分；写出「用集合预报：从略有不同的初始条件做几十个预报，看它们是否一致来判断可信度」再给 1 分。只写「电脑算力不够」给 0 分。',
    },
  ],
};

const SPECS = [V, BOX, MARSHMALLOW, ORS, FORECAST];

module.exports = {
  LEVEL,
  SPECS,
  DAYS: SPECS.map((spec, i) => buildAuthoredDay(spec, DATES[i])),
};
