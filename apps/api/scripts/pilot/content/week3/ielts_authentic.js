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

const SPECS = [V, BOX];

module.exports = {
  LEVEL,
  SPECS,
  DAYS: SPECS.map((spec, i) => buildAuthoredDay(spec, DATES[i])),
};
