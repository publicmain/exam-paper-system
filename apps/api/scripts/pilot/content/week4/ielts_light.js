/**
 * 第四周 —— **ielts_light（雅思轻量）**档，全原创说明文。
 *
 * 两三百词、五段，不编号。形状与第三周这一档一致：
 *   3 道判断（TRUE / FALSE / NOT GIVEN 各一） · 3 道填空转四选一 ·
 *   1 道两分概括填空 · 3 道主观题（2/1/2 分）—— 满分 13。
 *
 * 第三周批改发现这一档有几道主观题整句抄原文就能拿满分，考不出理解。
 * 这一周每篇至少一道「Using your own words」。
 *
 * 事实只写有把握的，拿不准的年份与数字一律不写：
 *   · 条形码 —— Woodland 与 Silver、沙滩上的摩斯码、1952 年专利（直线版与圆形版都有）、
 *     激光 1960 年就有、便宜到能进商店要到 1970 年代、IBM 设计的通用产品码、
 *     1974-06-26 俄亥俄州 Troy 的超市第一次扫描（一包口香糖）；
 *   · 魔术贴 —— de Mestral、牛蒡刺果、显微镜下的小钩、棉不行尼龙行、
 *     名字来自 velours + crochet、宇航员用来固定设备；
 *   · 海水为什么咸 —— 雨水溶二氧化碳呈弱酸、风化岩石、河流搬运、蒸发留盐、
 *     氯多来自海底火山与热液口、平均每升约 35 克、死海约十倍；
 *   · 红树林 —— 缺氧的泥、向上长的呼吸根和支柱根上的气孔、拒盐与叶面排盐、
 *     护岸与幼鱼栖身、双溪布洛；
 *   · 冰为什么浮 —— 氢键把分子锁成有空隙的结构、结冰后体积约大 9%（密度约小 8%）、
 *     结冰膨胀、冰山约九成在水下、水在约 4°C 时密度最大、冰层保温。
 */

'use strict';

const { buildAuthoredDay, plain } = require('../authored');
const { DATES } = require('./dates');

const LEVEL = 'ielts_light';

// ═══════════════════════════════════════════════════════════════
// 周一 —— 沙滩上的条形码
// ═══════════════════════════════════════════════════════════════

const BARCODE = {
  key: 'original-w4-barcode',
  title: 'Lines in the Sand',
  passage: plain([
    'Almost every packet in a supermarket carries a small block of black and white stripes. The idea behind it began in the late 1940s, when an American graduate student, Bernard Silver, overheard the head of a food-store company asking for a way to record automatically what customers bought at the checkout. Silver told his friend Joseph Woodland, and the two began to look for an answer.',
    'Woodland found one on a beach in Florida. He had learned Morse code as a Boy Scout, and while thinking about the problem, he drew its dots and dashes in the sand. Then he pulled his fingers down through them, turning each dot and dash into a line. Thin lines and thick lines, he realised, could carry information just as dots and dashes did.',
    'The pair received a patent in 1952. As well as straight lines, it described a version made of circles, like a target, so that it could be read from any direction. However, reading such a code quickly and reliably in a shop would need cheap lasers and small, affordable computers, and these would not be available for about twenty years.',
    'By the early 1970s, both had arrived. American grocery companies agreed on a single standard, the rectangular Universal Product Code, which was designed at IBM, where Woodland was then working.',
    'On 26 June 1974, at a supermarket in Troy, Ohio, a packet of chewing gum became the first product to be sold using a barcode scanner. Today barcodes are scanned billions of times a day, on everything from medicine to airline luggage.',
  ]),
  questions: [
    {
      kind: 'tfng',
      item: 'Silver and Woodland earned a large amount of money from their patent.',
      answer: 'NOT GIVEN',
    },
    {
      kind: 'tfng',
      item: 'Woodland thought of the barcode while he was working in a supermarket.',
      answer: 'FALSE',
      evidence: 'Woodland found one on a beach in Florida.',
    },
    {
      kind: 'tfng',
      item: 'Woodland already knew Morse code when he began working on the barcode.',
      answer: 'TRUE',
      evidence: 'He had learned Morse code as a Boy Scout, and while thinking about the problem, he drew its dots and dashes in the sand.',
    },
    {
      kind: 'gapChoice',
      stem: 'Silver overheard someone asking for a way to record automatically what customers ______ at the checkout.',
      answer: 'bought',
      distractors: ['paid', 'wanted', 'said'],
      evidence:
        'The idea behind it began in the late 1940s, when an American graduate student, Bernard Silver, overheard the head of a food-store company asking for a way to record automatically what customers bought at the checkout.',
    },
    {
      kind: 'gapChoice',
      stem: 'The version made of circles was meant to be read from any ______.',
      answer: 'direction',
      distractors: ['distance', 'height', 'machine'],
      evidence: 'As well as straight lines, it described a version made of circles, like a target, so that it could be read from any direction.',
    },
    {
      kind: 'gapChoice',
      stem: 'In 1974, the first product sold using a barcode scanner was a packet of ______.',
      answer: 'chewing gum',
      distractors: ['chocolate bars', 'potato chips', 'cough sweets'],
      evidence: 'On 26 June 1974, at a supermarket in Troy, Ohio, a packet of chewing gum became the first product to be sold using a barcode scanner.',
    },
    {
      kind: 'gapTyped',
      summary: true,
      marks: 2,
      stem: 'Shops could not use the barcode at first because ______.',
      answer: 'the cheap lasers and small computers needed to read it were not yet available',
      evidence:
        'However, reading such a code quickly and reliably in a shop would need cheap lasers and small, affordable computers, and these would not be available for about twenty years.',
      rubric:
        '两分：写出「在商店里读取条码要用便宜的激光和小型电脑」给 1 分；写出「当时这些都还没有 / 要再等约二十年」再给 1 分。只写「太贵了」给 1 分。',
    },
    {
      kind: 'short',
      marks: 2,
      stem: 'What made Silver and Woodland start working on the barcode?',
      answer:
        'Silver heard a food-store boss asking for a way to record automatically what customers bought at the checkout, and he told Woodland.',
      evidence:
        'The idea behind it began in the late 1940s, when an American graduate student, Bernard Silver, overheard the head of a food-store company asking for a way to record automatically what customers bought at the checkout.',
      rubric:
        '两分：写出「食品连锁店的老板想在收银台自动记录顾客买了什么」给 1 分；写出「Silver 听到后告诉了 Woodland，两人开始想办法」再给 1 分。',
    },
    {
      kind: 'short',
      marks: 1,
      stem: 'Where was the Universal Product Code designed?',
      answer: 'At IBM.',
      evidence: 'American grocery companies agreed on a single standard, the rectangular Universal Product Code, which was designed at IBM, where Woodland was then working.',
      rubric: '一分：答「在 IBM（设计的）」即给分。',
    },
    {
      kind: 'short',
      marks: 2,
      stem: 'Using your own words, explain how drawing in the sand gave Woodland his idea.',
      answer:
        'He drew Morse code in the sand and stretched the dots and dashes downwards into lines, then saw that lines of different widths could store information in the same way.',
      evidence: 'Thin lines and thick lines, he realised, could carry information just as dots and dashes did.',
      rubric:
        '两分：写出「把沙上的摩斯码点和划往下拉成了线」给 1 分；点明「粗细不同的线也能像点划一样表示信息」再给 1 分。整句照抄原文只给 1 分。',
    },
  ],
};

// ═══════════════════════════════════════════════════════════════
// 周二 —— 狗身上的刺果
// ═══════════════════════════════════════════════════════════════

const VELCRO = {
  key: 'original-w4-velcro',
  title: 'The Burr on the Dog',
  passage: plain([
    'One day in the 1940s, a Swiss engineer called George de Mestral came home from a walk in the countryside with his dog and found both of them covered in burrs, the small, prickly seed cases of the burdock plant. Removing them took a long time, and de Mestral, who was curious by nature, decided to look at one under his microscope.',
    'What he saw was a mass of tiny hooks. Each hook could catch on anything with a loop in it, such as the threads of his trousers or the hair of his dog. This is how the plant spreads: its seeds travel on passing animals and drop off somewhere new.',
    'De Mestral wondered whether two strips of cloth, one covered in hooks and the other in loops, could be pressed together and pulled apart again and again. Making it work took years. His first attempts used cotton, which was too soft and wore out quickly. The answer turned out to be nylon, which could be shaped into hooks that stayed strong.',
    'He received a patent in the 1950s and named his invention Velcro, from two French words: velours, meaning velvet, and crochet, meaning hook. At first, clothing makers were not interested. They thought the material looked cheap and untidy.',
    'What changed their minds was space travel. American astronauts used it to hold equipment in place in orbit, where anything left loose would float around the cabin, and once people had seen how useful it could be, it began to appear on skiwear and on children\'s shoes. Today it is so common that few people think of it as an invention at all.',
  ]),
  questions: [
    {
      kind: 'tfng',
      item: 'Cotton was the best material for making the hooks.',
      answer: 'FALSE',
      evidence: 'His first attempts used cotton, which was too soft and wore out quickly.',
    },
    {
      kind: 'tfng',
      item: 'De Mestral looked at a burr through a microscope.',
      answer: 'TRUE',
      evidence: 'Removing them took a long time, and de Mestral, who was curious by nature, decided to look at one under his microscope.',
    },
    {
      kind: 'tfng',
      item: 'It took de Mestral several years to make his idea work.',
      answer: 'TRUE',
      evidence: 'Making it work took years.',
    },
    {
      kind: 'gapChoice',
      stem: 'Burdock seeds spread by travelling on passing ______.',
      answer: 'animals',
      distractors: ['rivers', 'winds', 'cars'],
      evidence: 'This is how the plant spreads: its seeds travel on passing animals and drop off somewhere new.',
    },
    {
      kind: 'gapChoice',
      stem: 'The French word "velours" means ______.',
      answer: 'velvet',
      distractors: ['hook', 'cotton', 'loop'],
      evidence: 'He received a patent in the 1950s and named his invention Velcro, from two French words: velours, meaning velvet, and crochet, meaning hook.',
    },
    {
      kind: 'gapChoice',
      stem: 'At first, clothing makers thought the material looked cheap and ______.',
      answer: 'untidy',
      distractors: ['heavy', 'dangerous', 'old'],
      evidence: 'They thought the material looked cheap and untidy.',
    },
    {
      kind: 'gapTyped',
      summary: true,
      marks: 2,
      stem: 'De Mestral wanted to make two strips of cloth that could be ______.',
      answer: 'pressed together and pulled apart again and again',
      evidence:
        'De Mestral wondered whether two strips of cloth, one covered in hooks and the other in loops, could be pressed together and pulled apart again and again.',
      rubric: '两分：写出「能贴在一起」给 1 分；写出「还能反复拉开、再贴上」再给 1 分。',
    },
    {
      kind: 'short',
      marks: 2,
      stem: 'What did de Mestral see under the microscope, and how does this help the burdock plant?',
      answer:
        'He saw many tiny hooks that catch on loops such as threads or hair; this lets the seeds ride on animals and be carried to new places.',
      evidence: 'What he saw was a mass of tiny hooks.',
      rubric:
        '两分：写出「许多小钩子，能钩住带圈的东西（线、毛）」给 1 分；写出「种子因此能挂在动物身上被带到别处」再给 1 分。',
    },
    {
      kind: 'short',
      marks: 1,
      stem: 'Which material finally made the hooks strong enough?',
      answer: 'Nylon.',
      evidence: 'The answer turned out to be nylon, which could be shaped into hooks that stayed strong.',
      rubric: '一分：答「尼龙 / nylon」即给分。',
    },
    {
      kind: 'short',
      marks: 2,
      stem: "Using your own words, explain how space travel changed clothing makers' opinion of the material.",
      answer:
        'Astronauts used it to stop equipment floating around their spacecraft, which showed how useful it was, so it then started to be used on skiwear and children\'s shoes.',
      evidence: 'American astronauts used it to hold equipment in place in orbit, where anything left loose would float around the cabin, and once people had seen how useful it could be, it began to appear on skiwear and on children\'s shoes.',
      rubric:
        '两分：写出「宇航员在太空（失重环境）里用它固定设备，免得东西飘走」给 1 分；点明「人们因此看到了它的用处，才开始把它用到滑雪服、童鞋上」再给 1 分。整句照抄原文只给 1 分。',
    },
  ],
};

// ═══════════════════════════════════════════════════════════════
// 周三 —— 海水里的盐从哪里来
// ═══════════════════════════════════════════════════════════════

const SALT = {
  key: 'original-w4-salty-sea',
  title: 'Where the Salt Comes From',
  passage: plain([
    'Rivers taste fresh, yet the sea they flow into is salty. The explanation begins with rain. As rain falls, it takes in a little carbon dioxide from the air, which makes it very slightly acidic. When it lands on rocks, this weak acid slowly breaks them down, freeing tiny amounts of minerals, including sodium.',
    'Streams and rivers carry these dissolved minerals to the sea. The amount in any glass of river water is far too small to taste, but rivers have been doing this for hundreds of millions of years.',
    'Once the minerals reach the ocean, most of them stay there. The sun heats the surface and water evaporates, but the salt is left behind. The evaporated water later falls as rain, runs over more rocks and carries more minerals back. In this way, the sea has slowly collected its salt.',
    'Rivers are not the only source. Much of the chloride in sea salt is thought to come from underwater volcanoes and from hot openings in the sea floor, where water heated by the rocks below dissolves minerals and releases them into the ocean.',
    'On average, a litre of seawater contains about 35 grams of salt. This level has stayed fairly steady for a very long time, because salt is also removed, for example when it becomes part of the mud on the sea floor. In some lakes with no way out to the sea, however, water leaves only by evaporating, and the salt builds up. The Dead Sea is nearly ten times saltier than the ocean.',
  ]),
  questions: [
    {
      kind: 'tfng',
      item: 'Rain becomes slightly acidic before it reaches the ground.',
      answer: 'TRUE',
      evidence: 'As rain falls, it takes in a little carbon dioxide from the air, which makes it very slightly acidic.',
    },
    {
      kind: 'tfng',
      item: 'Scientists first measured how salty the sea is in the nineteenth century.',
      answer: 'NOT GIVEN',
    },
    {
      kind: 'tfng',
      item: 'The minerals in a glass of river water are easy to taste.',
      answer: 'FALSE',
      evidence: 'The amount in any glass of river water is far too small to taste, but rivers have been doing this for hundreds of millions of years.',
    },
    {
      kind: 'gapChoice',
      stem: 'As rain falls, it takes in a little ______ from the air.',
      answer: 'carbon dioxide',
      distractors: ['oxygen', 'salt', 'dust'],
      evidence: 'As rain falls, it takes in a little carbon dioxide from the air, which makes it very slightly acidic.',
    },
    {
      kind: 'gapChoice',
      stem: 'When seawater evaporates, the ______ stays behind.',
      answer: 'salt',
      distractors: ['sand', 'mud', 'rain'],
      evidence: 'The sun heats the surface and water evaporates, but the salt is left behind.',
    },
    {
      kind: 'gapChoice',
      stem: 'On average, a litre of seawater contains about ______ grams of salt.',
      answer: '35',
      distractors: ['3.5', '10', '350'],
      evidence: 'On average, a litre of seawater contains about 35 grams of salt.',
    },
    {
      kind: 'gapTyped',
      summary: true,
      marks: 2,
      stem: 'Some lakes become much saltier than the sea because ______.',
      answer: 'water can leave them only by evaporating, so the salt builds up',
      evidence: 'In some lakes with no way out to the sea, however, water leaves only by evaporating, and the salt builds up.',
      rubric:
        '两分：写出「湖没有流向大海的出口，水只能靠蒸发离开」给 1 分；写出「所以盐越积越多」再给 1 分。',
    },
    {
      kind: 'short',
      marks: 2,
      stem: 'According to the third paragraph, how has the sea slowly collected its salt?',
      answer:
        'Evaporation takes away only the water and leaves the salt behind, and the water later falls as rain and brings more minerals back to the sea.',
      evidence: 'The evaporated water later falls as rain, runs over more rocks and carries more minerals back.',
      rubric:
        '两分：写出「蒸发带走的只是水，盐留在海里」给 1 分；写出「水变成雨又冲刷岩石，把更多矿物带回海里」再给 1 分。',
    },
    {
      kind: 'short',
      marks: 1,
      stem: 'Apart from rivers, name ONE source of the minerals in the sea.',
      answer: 'Underwater volcanoes.',
      evidence:
        'Much of the chloride in sea salt is thought to come from underwater volcanoes and from hot openings in the sea floor, where water heated by the rocks below dissolves minerals and releases them into the ocean.',
      rubric: '一分：答「海底火山」或「海底的热水出口」任一即给分。',
    },
    {
      kind: 'short',
      marks: 2,
      stem: 'Using your own words, explain why the ocean has not kept getting saltier.',
      answer:
        'Salt is taken out of the water as well as added — for example, it becomes part of the mud on the sea floor — so the amount stays roughly the same.',
      evidence:
        'This level has stayed fairly steady for a very long time, because salt is also removed, for example when it becomes part of the mud on the sea floor.',
      rubric:
        '两分：写出「海里的盐也会被移走」给 1 分；举出方式（变成海底泥的一部分）或点明「进来和移走的差不多，所以大致不变」再给 1 分。整句照抄原文只给 1 分。',
    },
  ],
};

// ═══════════════════════════════════════════════════════════════
// 周四 —— 会呼吸的根
// ═══════════════════════════════════════════════════════════════

const MANGROVE = {
  key: 'original-w4-mangrove-roots',
  title: 'Roots That Breathe',
  passage: plain([
    'Most trees would die if their roots stood in salty water that rose and fell twice a day. Mangrove trees live in exactly these conditions, along muddy tropical coasts, including the northern shore of Singapore at Sungei Buloh. To survive there, they have had to solve two problems: salt and a lack of air.',
    'The mud where mangroves grow is soft, wet and low in oxygen, and roots need oxygen just as leaves do. Some mangroves deal with this in a surprising way. Around the base of the tree, hundreds of thin roots grow upwards out of the mud, like pencils standing on end. These roots have tiny openings in their surface. When the tide goes out, they take in air, which then passes down to the roots buried below.',
    'Other mangroves stand on curved roots that grow out from the trunk and hold the tree above the mud, rather like the legs of a table. These roots also have openings that take in air when the water is low.',
    'Salt is handled in two main ways. Some kinds stop most of the salt at their roots, so the water that reaches the leaves is almost fresh. Others take the salt in and then push it out through their leaves; on a dry day, small white crystals can sometimes be seen on the leaf surface.',
    'These features make mangroves valuable. Their tangled roots slow down waves and hold the mud in place, protecting the coast, and the calm, shady water between them is a safe home for young fish. Yet mangroves are easily cleared for building, and many that once lined the coast of Singapore have gone.',
  ]),
  questions: [
    {
      kind: 'tfng',
      item: 'Mangroves grow faster than most other kinds of tree.',
      answer: 'NOT GIVEN',
    },
    {
      kind: 'tfng',
      item: "Sungei Buloh has more mangroves than any other part of Singapore's coast.",
      answer: 'NOT GIVEN',
    },
    {
      kind: 'tfng',
      item: 'The mud where mangroves grow contains plenty of oxygen.',
      answer: 'FALSE',
      evidence: 'The mud where mangroves grow is soft, wet and low in oxygen, and roots need oxygen just as leaves do.',
    },
    {
      kind: 'gapChoice',
      stem: 'The roots that grow up out of the mud look like ______ standing on end.',
      answer: 'pencils',
      distractors: ['needles', 'fingers', 'candles'],
      evidence: 'Around the base of the tree, hundreds of thin roots grow upwards out of the mud, like pencils standing on end.',
    },
    {
      kind: 'gapChoice',
      stem: 'Curved roots hold some mangroves above the mud, rather like the ______ of a table.',
      answer: 'legs',
      distractors: ['top', 'edges', 'drawers'],
      evidence:
        'Other mangroves stand on curved roots that grow out from the trunk and hold the tree above the mud, rather like the legs of a table.',
    },
    {
      kind: 'gapChoice',
      stem: 'On a dry day, small white ______ can sometimes be seen on the leaves.',
      answer: 'crystals',
      distractors: ['flowers', 'insects', 'spots'],
      evidence: 'Others take the salt in and then push it out through their leaves; on a dry day, small white crystals can sometimes be seen on the leaf surface.',
    },
    {
      kind: 'gapTyped',
      summary: true,
      marks: 2,
      stem: 'The roots that grow up out of the mud help the tree because, when the tide goes out, they ______.',
      answer: 'take in air, which then passes down to the roots buried below',
      evidence: 'When the tide goes out, they take in air, which then passes down to the roots buried below.',
      rubric: '两分：写出「吸进空气」给 1 分；写出「空气再往下传到埋在泥里的根」再给 1 分。',
    },
    {
      kind: 'short',
      marks: 2,
      stem: 'According to the first paragraph, what TWO problems do mangroves have to solve?',
      answer: 'Salt in the water, and a lack of air in the mud.',
      evidence: 'To survive there, they have had to solve two problems: salt and a lack of air.',
      rubric: '两分：「盐 / 咸水」「泥里缺空气、缺氧」各 1 分。',
    },
    {
      kind: 'short',
      marks: 1,
      stem: 'How do mangroves help young fish?',
      answer: 'The calm, shady water between their roots gives young fish a safe home.',
      evidence: 'Their tangled roots slow down waves and hold the mud in place, protecting the coast, and the calm, shady water between them is a safe home for young fish.',
      rubric: '一分：答出「根之间平静、背阴的水是小鱼安全的栖身之处」即给分。',
    },
    {
      kind: 'short',
      marks: 2,
      stem: 'Using your own words, describe the TWO ways in which mangroves deal with salt.',
      answer:
        'Some keep most of the salt out at their roots, so the water reaching the leaves is almost fresh; others let the salt in and get rid of it through their leaves.',
      evidence: 'Some kinds stop most of the salt at their roots, so the water that reaches the leaves is almost fresh.',
      rubric: '两分：「在根部挡住大部分盐」「吸进盐再从叶子排出去」各 1 分。',
    },
  ],
};

// ═══════════════════════════════════════════════════════════════
// 周五 —— 冰为什么浮在水上
// ═══════════════════════════════════════════════════════════════

const ICE = {
  key: 'original-w4-floating-ice',
  title: 'Why Ice Floats',
  passage: plain([
    'If you drop a piece of solid wax into melted wax, it sinks. The same is true of most substances: the solid form is heavier, for its size, than the liquid. Water is a famous exception. Ice floats, and this unusual behaviour matters far more than it might seem.',
    'The reason lies in the way water molecules hold on to each other. In liquid water, they are constantly moving and packing closely together. As water freezes, they lock into a regular pattern with open spaces in it, rather like a honeycomb. The same number of molecules now takes up more room: ice fills about nine per cent more space than the same amount of liquid water, which makes it lighter for its size.',
    'One result is that water expands when it freezes. This is why a full glass bottle left in a freezer may crack, and why water pipes in cold countries can burst in winter. It also explains why only about a tenth of an iceberg shows above the sea.',
    'Water has another unusual property: it is at its densest at about four degrees Celsius. When a lake cools in winter, the colder surface water sinks until the whole lake reaches four degrees. After that, the coldest water stays on top and eventually turns to ice.',
    'That layer of ice acts like a lid, slowing down the loss of heat from the water beneath it. As a result, most lakes do not freeze solid, and fish and other animals can survive the winter in the liquid water below. If ice sank, lakes would freeze from the bottom up, and life in them would be far harder.',
  ]),
  questions: [
    {
      kind: 'tfng',
      item: 'A piece of solid wax floats in melted wax.',
      answer: 'FALSE',
      evidence: 'If you drop a piece of solid wax into melted wax, it sinks.',
    },
    {
      kind: 'tfng',
      item: 'Fish in frozen lakes eat less food during the winter.',
      answer: 'NOT GIVEN',
    },
    {
      kind: 'tfng',
      item: 'Water takes up more space as ice than it does as a liquid.',
      answer: 'TRUE',
      evidence: 'The same number of molecules now takes up more room: ice fills about nine per cent more space than the same amount of liquid water, which makes it lighter for its size.',
    },
    {
      kind: 'gapChoice',
      stem: 'When water freezes, its molecules form a pattern rather like a ______.',
      answer: 'honeycomb',
      distractors: ['ladder', 'circle', 'net'],
      evidence: 'As water freezes, they lock into a regular pattern with open spaces in it, rather like a honeycomb.',
    },
    {
      kind: 'gapChoice',
      stem: 'Only about a ______ of an iceberg can be seen above the sea.',
      answer: 'tenth',
      distractors: ['half', 'quarter', 'third'],
      evidence: 'It also explains why only about a tenth of an iceberg shows above the sea.',
    },
    {
      kind: 'gapChoice',
      stem: 'Liquid water is at its densest at about ______ degrees Celsius.',
      answer: 'four',
      distractors: ['zero', 'nine', 'ten'],
      evidence: 'Water has another unusual property: it is at its densest at about four degrees Celsius.',
    },
    {
      kind: 'gapTyped',
      summary: true,
      marks: 2,
      stem: 'A full glass bottle left in a freezer may crack because ______.',
      answer: 'the water inside expands when it freezes',
      evidence: 'This is why a full glass bottle left in a freezer may crack, and why water pipes in cold countries can burst in winter.',
      rubric: '两分：写出「水结冰时体积变大、膨胀」给 2 分；只写「水结成了冰」给 1 分；只写「太冷了」不给分。',
    },
    {
      kind: 'short',
      marks: 2,
      stem: 'Using your own words, explain why ice is less dense than liquid water.',
      answer:
        'When water freezes, its molecules fix themselves into a pattern with gaps in it, so the same amount of water needs more space.',
      evidence: 'As water freezes, they lock into a regular pattern with open spaces in it, rather like a honeycomb.',
      rubric:
        '两分：写出「结冰时分子排成有空隙的固定结构」给 1 分；写出「同样多的分子占的地方更大，所以更轻」再给 1 分。整句照抄原文只给 1 分。',
    },
    {
      kind: 'short',
      marks: 1,
      stem: 'What can happen to water pipes in cold countries in winter?',
      answer: 'They can burst.',
      evidence: 'This is why a full glass bottle left in a freezer may crack, and why water pipes in cold countries can burst in winter.',
      rubric: '一分：答「会冻裂 / 爆裂（burst）」即给分。',
    },
    {
      kind: 'short',
      marks: 2,
      stem: 'Why are fish able to survive the winter in most lakes?',
      answer:
        'The ice on top works like a lid that slows the loss of heat from the water below, so the lake does not freeze solid and fish can live in the liquid water underneath.',
      evidence: 'That layer of ice acts like a lid, slowing down the loss of heat from the water beneath it.',
      rubric:
        '两分：写出「上面的冰像盖子一样，让下面的水不容易散热」给 1 分；写出「湖不会冻透，鱼在下面的水里活下来」再给 1 分。',
    },
  ],
};

const SPECS = [BARCODE, VELCRO, SALT, MANGROVE, ICE];

module.exports = {
  LEVEL,
  SPECS,
  DAYS: SPECS.map((spec, i) => buildAuthoredDay(spec, DATES[i])),
};
