/**
 * 第六周 —— **ielts_simplified（O-Level 基础）**档，全原创。
 *
 * 形状与第四、五周这一档一致：两百词上下、八九个短段、一条线讲到底，
 *   3 道四选一 · 2 道判断 · 1 道原文填空（四选一） · 4 道主观题（1/1/2/2 分）。
 *
 * 选题前对过学生交过卷的 226 篇（.local/tmp/read-titles-0929.txt）和内容包全部
 * 125 篇（pack-titles-0929.txt），并在各周内容包与 test-fixtures 里搜过 class photo /
 * blink / gecko / lizard / lolly / freezer / monkey / Bukit Timah / ordered / parcel，
 * 没有同一桥段。五天领域：学校小事 / 邻里帮忙 / 动手做 / 户外自然 / 网上乌龙。
 *
 * 照旧：两分题的两个得分点都要能在原文里找到（不靠推断）；不出否定问法；
 * 判断题改答案要改题干。全周判断题：TN / NF / FT / TF / NF → T3 F4 NG3。
 */

'use strict';

const { buildAuthoredDay, numbered } = require('../authored');
const { DATES } = require('./dates');

const LEVEL = 'ielts_simplified';

// ═══════════════════════════════════════════════════════════════
// 周一 —— The Class Photo
//
// 作者从小一到中一的七张班级照全闭着眼，妈妈把它们挂成一排。今年拍照拼命瞪眼，
// 瞪到流泪，摄影师以为他在哭；摄影师教全班「先闭眼，数到三再睁开」。照片发下来
// 作者第一次睁着眼 —— 坐在前排的班主任却闭上了。
// 不是广播 / 早会 / 考试 / 代课 / 新同学；与 The Photograph on the MRT、Just a Joke
// （群里发糗照）不同：没有社交出糗，是自己的小毛病 + 一个拍照小窍门。
// 「先闭眼、数到三一起睁开」是摄影师拍集体照常用的办法，不写成科学结论。
// ═══════════════════════════════════════════════════════════════

const PHOTO = {
  key: 'original-w6-class-photo',
  title: 'The Class Photo',
  passage: numbered([
    'I had seven class photos, from Primary One to Secondary One. In every one of them, my eyes were closed. My mother put them all in a line on the living room wall.',
    'This year I wanted a good photo. The night before, I practised in front of the mirror. I kept my eyes open for as long as I could.',
    'On Tuesday, we stood on benches in the school hall. The tall students were at the back, and I was in the middle of the second row. Our form teacher, Mr Yusof, sat in the front row.',
    'The photographer said, "One, two, three!" I kept my eyes open very wide. Soon they started to hurt, and there were tears on my face. He took three photos and looked at the small screen on his camera.',
    '"Why is the boy in the middle crying?" he asked. Everyone turned round to look at me. My face turned red.',
    'I told him about my seven photos. He smiled. "I have a trick," he said. "Everyone, close your eyes. When I say three, open them and smile."',
    'We all closed our eyes. "One, two, three!" We opened them, and he took the photo.',
    'A week later, Mr Yusof gave us the photos. I looked at the second row first. My eyes were open, and I was smiling!',
    'That evening, my mother put the new photo at the end of the line. Then she looked at it again and started to laugh. In the front row, Mr Yusof\'s eyes were closed.',
  ]),
  questions: [
    {
      kind: 'mcq',
      stem: 'What did the writer do the night before the class photo?',
      answer: 'practised in front of the mirror',
      distractors: ['looked at the old class photos', 'asked Mr Yusof for some help', 'went to bed very early'],
      evidence: 'The night before, I practised in front of the mirror.',
    },
    {
      kind: 'mcq',
      stem: 'Why did everyone turn round to look at the writer?',
      answer: 'The photographer asked why he was crying.',
      distractors: ['His eyes were closed in the photos.', 'He fell off the bench in the hall.', 'He started to laugh very loudly.'],
      evidence: '"Why is the boy in the middle crying?" he asked. Everyone turned round to look at me.',
    },
    {
      kind: 'mcq',
      stem: "Where did the writer's mother put the new photo?",
      answer: 'at the end of the line',
      distractors: ['in the middle of the line', 'on the door of the fridge', "in the writer's bedroom"],
      evidence: 'That evening, my mother put the new photo at the end of the line.',
    },
    {
      kind: 'tfng',
      item: 'In the new photo, Mr Yusof had his eyes closed.',
      answer: 'TRUE',
      evidence: "In the front row, Mr Yusof's eyes were closed.",
    },
    {
      kind: 'tfng',
      item: "Mr Yusof is also the writer's maths teacher.",
      answer: 'NOT GIVEN',
    },
    {
      kind: 'gapChoice',
      stem: 'For the photo, the writer was in the middle of the ______ row.',
      answer: 'second',
      distractors: ['front', 'back', 'third'],
      evidence: 'The tall students were at the back, and I was in the middle of the second row.',
    },
    {
      kind: 'short',
      marks: 1,
      stem: 'From Paragraph 1, how many class photos did the writer have before this year?',
      answer: 'Seven.',
      evidence: 'I had seven class photos, from Primary One to Secondary One.',
      rubric: '一分：答「七张 / seven / 7」即给分。答「八张」不给分 —— 那是加上今年这张。',
    },
    {
      kind: 'short',
      marks: 1,
      stem: 'From Paragraph 8, how long after the photo day did the class get the photos?',
      answer: 'A week later.',
      evidence: 'A week later, Mr Yusof gave us the photos.',
      rubric: '一分：答「一周后 / a week」即给分。',
    },
    {
      kind: 'short',
      marks: 2,
      stem: 'From Paragraph 6, give TWO things the photographer told the class to do.',
      answer: 'Close their eyes, and open them and smile when he said three.',
      evidence: '"Everyone, close your eyes. When I say three, open them and smile."',
      rubric:
        '两分：摄影师说了三件事，三点任答两点，每点 1 分：先闭上眼睛；听到「三」时睁开眼睛；睁眼时微笑。答第 4 段的「把眼睛睁得很大」不给分 —— 那是作者自己的做法，不是摄影师说的。',
    },
    {
      kind: 'short',
      marks: 2,
      stem: "Using your own words, explain why there were tears on the writer's face (Paragraph 4).",
      answer: 'He kept his eyes open very wide for a long time, so they started to hurt.',
      evidence: 'I kept my eyes open very wide. Soon they started to hurt, and there were tears on my face.',
      rubric:
        '两分：写出「作者一直把眼睛睁得很大（不敢闭眼）」给 1 分；写出「眼睛开始疼 / 发酸」再给 1 分。答「因为难过 / 伤心才哭」不给分 —— 摄影师以为他在哭，其实不是。用自己的简单英文说对意思即可。',
    },
  ],
};

// ═══════════════════════════════════════════════════════════════
// 周二 —— The Gecko
//
// 周五晚上十点，八月刚搬来的邻居 Miss Tay 敲门：卧室墙上有只壁虎，她不敢睡。
// 父母去喝喜酒了，作者（自己也不喜欢壁虎）拿塑料盒和旧练习本封面去扣，第三次才
// 扣住；壁虎断尾，尾巴在床上还在动，邻居尖叫。作者把壁虎放到走廊花盆里。
// 周日晚上又敲门：「它回来了，就是没尾巴那只。」
// 不是老人的老物件 / 送吃的 / 熟食中心 / 走失小孩，结尾也没有送吃的答谢；
// 与本档第四周 The Parrot Next Door（鹦鹉学名字的谜底）内核不同。
// 事实：家里常见的壁虎遇到危险会断尾自保，断下的尾巴还会动一阵，之后会再长出
// 一条 —— 把握高（动物学常识，断尾 autotomy + 再生）。不写具体要几天几周。
// ═══════════════════════════════════════════════════════════════

const GECKO = {
  key: 'original-w6-gecko',
  title: 'The Gecko',
  passage: numbered([
    'Last Friday, at ten at night, someone knocked on our door. My parents were out at a wedding dinner, so I opened it. It was Miss Tay, who moved into the flat next to ours in August.',
    '"There is a gecko on my bedroom wall," she said. "I cannot sleep with it there. Can you help me?"',
    'I do not like geckos much either, but I wanted to help. I took a plastic box from our kitchen and the cover of an old exercise book.',
    'The gecko was on the wall above her bed. I stood on the bed and moved the box towards it very slowly. It ran away. I tried again, and it ran again. The third time, I got it under the box.',
    'I pushed the cover under the box. But when I took the box off the wall, something dropped on the bed. It was the tail, and it was still moving.',
    'Miss Tay screamed. I nearly dropped the box. "It is OK," I said quickly. "Geckos can drop their tails when they are in danger. This one will grow a new tail."',
    'I carried the box out to the plants in the corridor and let the gecko go. Then I walked back in and picked up the tail with a tissue. Miss Tay watched from the door.',
    'She thanked me again and again. She wanted to sleep with the light on that night.',
    'On Sunday night, there was another knock. Miss Tay was at the door again. "It is back," she said. "The one with no tail."',
  ]),
  questions: [
    {
      kind: 'mcq',
      stem: 'Why did the writer open the door that night?',
      answer: "The writer's parents were out.",
      distractors: ['Miss Tay called through the door.', 'The writer was waiting for a friend.', 'The knock woke the writer up.'],
      evidence: 'My parents were out at a wedding dinner, so I opened it.',
    },
    {
      kind: 'mcq',
      stem: 'What did the writer use to catch the gecko?',
      answer: 'a plastic box and a book cover',
      distractors: ['a tissue and a plastic bag', 'a cup and a piece of paper', 'a towel from the bathroom'],
      evidence: 'I took a plastic box from our kitchen and the cover of an old exercise book.',
    },
    {
      kind: 'mcq',
      stem: 'Where did the writer let the gecko go?',
      answer: 'among the plants in the corridor',
      distractors: ["out of Miss Tay's window", 'in the kitchen of the flat', 'at the bottom of the block'],
      evidence: 'I carried the box out to the plants in the corridor and let the gecko go.',
    },
    {
      kind: 'tfng',
      item: "The writer's parents came home before eleven.",
      answer: 'NOT GIVEN',
    },
    {
      kind: 'tfng',
      item: 'Miss Tay picked up the tail herself.',
      answer: 'FALSE',
      evidence: 'Then I walked back in and picked up the tail with a tissue. Miss Tay watched from the door.',
    },
    {
      kind: 'gapChoice',
      stem: 'The gecko was on the wall above her ______.',
      answer: 'bed',
      distractors: ['door', 'window', 'table'],
      evidence: 'The gecko was on the wall above her bed.',
    },
    {
      kind: 'short',
      marks: 1,
      stem: 'From Paragraph 1, at what time did someone knock on the door?',
      answer: 'At ten at night.',
      evidence: 'Last Friday, at ten at night, someone knocked on our door.',
      rubric: '一分：答「晚上十点 / 10 pm」即给分。',
    },
    {
      kind: 'short',
      marks: 1,
      stem: 'From Paragraph 4, how many tries did it take the writer to get the gecko under the box?',
      answer: 'Three.',
      evidence: 'The third time, I got it under the box.',
      rubric: '一分：答「三次 / three / the third time」即给分。',
    },
    {
      kind: 'short',
      marks: 2,
      stem: 'From Paragraph 6, give TWO things the writer told Miss Tay about geckos.',
      answer: 'Geckos can drop their tails when they are in danger, and this one will grow a new tail.',
      evidence: '"Geckos can drop their tails when they are in danger. This one will grow a new tail."',
      rubric:
        '两分：写出「壁虎遇到危险时会把尾巴断掉」给 1 分；写出「这只会再长出一条新尾巴」再给 1 分。只写「没事 / It is OK」不给分 —— 那不是关于壁虎的内容。',
    },
    {
      kind: 'short',
      marks: 2,
      stem: 'Using your own words, explain what Miss Tay told the writer on Sunday night (Paragraph 9).',
      answer: 'The gecko had come back to her flat, and it was the same one, the one without a tail.',
      evidence: '"It is back," she said. "The one with no tail."',
      rubric:
        '两分：写出「壁虎又回来了」给 1 分；写出「就是原来那只 / 没有尾巴的那只」再给 1 分。用自己的简单英文说对意思即可。',
    },
  ],
};

// ═══════════════════════════════════════════════════════════════
// 周三 —— The Ice Lollies
//
// 周六下午三点妹妹的三个朋友要来，天很热，作者十点做橙汁冰棍：五个纸杯各插一根
// 木棍。十分钟后棍子全倒了，照网上的办法在杯口蒙锡纸、从中间戳进去才立住。等不及
// 老开冰箱，妈妈说一开门热空气就进去、冻得更慢；两点四十五分冻好，撕掉纸杯。
// 朋友问还能再吃一根吗 —— 「五个小时后再来」。
// 不是补胎 / 种豆 / 风筝 / 生日蛋糕，朋友来玩也不是生日会；已读的做吃的都是熟食。
// 事实：蒙锡纸固定冰棍棍是常见家庭做法；冰箱开门会进热空气、冻得更慢 —— 把握高。
// 五个小时是故事里的时间（十点做、快三点才好），不当科学结论写。
// ═══════════════════════════════════════════════════════════════

const LOLLIES = {
  key: 'original-w6-ice-lollies',
  title: 'The Ice Lollies',
  passage: numbered([
    'On Saturday, three of my little sister Hui Wen\'s friends were coming to play at three o\'clock. It was a very hot day, so I said I would make ice lollies for them.',
    'At ten o\'clock, I poured orange juice into five paper cups, one for each of us. I put a wooden stick into each cup and carefully put the cups in the freezer.',
    'Ten minutes later, I opened the freezer. Every stick was lying on its side. The juice was too soft to hold them up.',
    'I found a trick online. I covered each cup with a piece of foil and pushed the stick through the middle. Now the sticks stood up straight.',
    'Then I waited. At eleven, I opened the freezer. The juice was still soft. At half past eleven, I opened it again. At twelve, I opened it again.',
    'My mother was watching me. "Every time you open the door, warm air goes in," she said. "They will take longer to get hard."',
    'So I stopped. I did my homework, and I tried not to think about the freezer.',
    'At a quarter to three, I opened it. The lollies were hard! I tore off the paper cups and put the lollies on a plate just as the doorbell rang.',
    'The children loved them. Then one of Hui Wen\'s friends asked, "Can we have another one?" I looked at the clock. "Yes," I said. "Come back in five hours."',
  ]),
  questions: [
    {
      kind: 'mcq',
      stem: 'Why did the writer decide to make ice lollies?',
      answer: 'It was a very hot day.',
      distractors: ['Hui Wen asked for them.', 'There was no ice cream at home.', "It was Hui Wen's birthday."],
      evidence: 'It was a very hot day, so I said I would make ice lollies for them.',
    },
    {
      kind: 'mcq',
      stem: 'What was wrong ten minutes after the writer first put the cups in the freezer?',
      answer: 'The sticks were lying on their sides.',
      distractors: ['The paper cups had fallen over.', 'The juice was all over the freezer.', 'The juice had already gone hard.'],
      evidence: 'Every stick was lying on its side.',
    },
    {
      kind: 'mcq',
      stem: 'How did the writer get the lollies out of the cups?',
      answer: 'by tearing off the paper cups',
      distractors: ['by putting the cups in warm water', 'by pulling hard on the sticks', 'by cutting the cups with scissors'],
      evidence: 'I tore off the paper cups and put the lollies on a plate just as the doorbell rang.',
    },
    {
      kind: 'tfng',
      item: 'The writer made the ice lollies in plastic cups.',
      answer: 'FALSE',
      evidence: "At ten o'clock, I poured orange juice into five paper cups, one for each of us.",
    },
    {
      kind: 'tfng',
      item: 'While the writer was waiting, the writer did some homework.',
      answer: 'TRUE',
      evidence: 'I did my homework, and I tried not to think about the freezer.',
    },
    {
      kind: 'gapChoice',
      stem: 'After ten minutes, the juice was too ______ to hold the sticks up.',
      answer: 'soft',
      distractors: ['hard', 'cold', 'full'],
      evidence: 'The juice was too soft to hold them up.',
    },
    {
      kind: 'short',
      marks: 1,
      stem: "From Paragraph 1, at what time were Hui Wen's friends coming to play?",
      answer: "At three o'clock.",
      evidence: "On Saturday, three of my little sister Hui Wen's friends were coming to play at three o'clock.",
      rubric: '一分：答「三点 / 3 o\'clock」即给分。答「十点」不给分 —— 那是作者开始做冰棍的时间。',
    },
    {
      kind: 'short',
      marks: 1,
      stem: 'From Paragraph 2, how many paper cups did the writer fill with juice?',
      answer: 'Five.',
      evidence: "At ten o'clock, I poured orange juice into five paper cups, one for each of us.",
      rubric: '一分：答「五个 / five / 5」即给分。答「三个」不给分 —— 那是来玩的朋友人数。',
    },
    {
      kind: 'short',
      marks: 2,
      stem: 'From Paragraph 4, explain what the writer did with the foil.',
      answer: 'The writer covered each cup with a piece of foil and pushed the stick through the middle of it.',
      evidence: 'I covered each cup with a piece of foil and pushed the stick through the middle.',
      rubric:
        '两分：写出「用锡纸把每个杯子盖住」给 1 分；写出「把棍子从锡纸中间插进去」再给 1 分。答「棍子站直了 / 立起来了」（本段最后一句 Now the sticks stood up straight）不给分 —— 那是结果，不是作者的做法。',
    },
    {
      kind: 'short',
      marks: 2,
      stem: "Using your own words, explain what the writer's mother said about opening the freezer door (Paragraph 6).",
      answer: 'Each time the door opened, warm air went in, so the lollies would need more time to get hard.',
      evidence: '"Every time you open the door, warm air goes in," she said. "They will take longer to get hard."',
      rubric:
        '两分：写出「每次开门，热空气都会进去」给 1 分；写出「冰棍要更久才冻硬」再给 1 分。用自己的简单英文说对意思即可。',
    },
  ],
};

// ═══════════════════════════════════════════════════════════════
// 周四 —— The Plastic Bag
//
// 一家人周六早上爬武吉知马山。全家只有作者没背包，把香蕉和面包装在塑料袋里拎着。
// 入口牌子写着「别喂猴子，食物别露在外面」，作者没在意。半路一只猴子从栏杆上
// 跳下来抢走袋子，在树上吃光香蕉、带走面包、把空袋子留在树枝上；弟弟想扔树枝，
// 妈妈拦住。到了山顶，爸爸从背包里拿出四包饼干：「猴子没看见这些。」
// 没有喂猴的情节，靠「塑料袋 / 背包」的对照收尾，不写「我学到了」。
// 不是打雷 / 蜗牛 / 暴雨被困 / 宠物；已读的自然故事没有「被野生动物抢东西」。
// 事实：武吉知马山是新加坡最高的山（自然高点约 163 米，文中不写数字）；那里有
// 长尾猕猴，国家公园局提醒游客别喂猴子、别把食物和塑料袋露在外面 —— 把握高。
// ═══════════════════════════════════════════════════════════════

const BAG = {
  key: 'original-w6-plastic-bag',
  title: 'The Plastic Bag',
  passage: numbered([
    'Last Saturday, my family got up at six to climb Bukit Timah Hill. It is the highest hill in Singapore, and my father wanted to have breakfast at the top.',
    'Everyone had a backpack except me. I carried our bananas and bread in a plastic bag, because it was easier.',
    'At the start of the path, there was a sign: "Do not feed the monkeys. Keep your food out of sight." I read it, but I did not think about it much.',
    'Halfway up, we stopped to drink some water. A monkey was sitting on the railing next to the path. It was looking at my bag.',
    'Before I could move, it jumped down, pulled the bag out of my hand and ran up a tree. It all happened in about two seconds.',
    'From a high branch, the monkey opened the bag and ate the bananas one by one. My little brother Ashwin wanted to throw a stick at it, but my mother stopped him.',
    'Then the monkey went away with the bread. It left the empty bag on the branch.',
    'We walked to the top with nothing to eat. My stomach made loud noises all the way up.',
    'At the top, my father opened his backpack and took out four packets of biscuits. "The monkeys did not see these," he said.',
  ]),
  questions: [
    {
      kind: 'mcq',
      stem: 'Why did the writer carry the food in a plastic bag?',
      answer: 'It was easier.',
      distractors: ['All the backpacks were full.', 'The sign told everyone to.', "The writer's father said so."],
      evidence: 'I carried our bananas and bread in a plastic bag, because it was easier.',
    },
    {
      kind: 'mcq',
      stem: 'Where was the monkey when the family stopped to drink water?',
      answer: 'on the railing next to the path',
      distractors: ['on a high branch of a tree', 'on the sign at the start of the path', 'on the ground at the top'],
      evidence: 'A monkey was sitting on the railing next to the path.',
    },
    {
      kind: 'mcq',
      stem: 'What did the monkey eat on the high branch?',
      answer: 'the bananas',
      distractors: ['the biscuits', 'the plastic bag', 'some leaves from the tree'],
      evidence: 'From a high branch, the monkey opened the bag and ate the bananas one by one.',
    },
    {
      kind: 'tfng',
      item: "The writer's family got up at six that Saturday.",
      answer: 'TRUE',
      evidence: 'Last Saturday, my family got up at six to climb Bukit Timah Hill.',
    },
    {
      kind: 'tfng',
      item: "The writer's mother let Ashwin throw a stick at the monkey.",
      answer: 'FALSE',
      evidence: 'My little brother Ashwin wanted to throw a stick at it, but my mother stopped him.',
    },
    {
      kind: 'gapChoice',
      stem: 'The sign said: "Keep your food out of ______."',
      answer: 'sight',
      distractors: ['hand', 'water', 'time'],
      evidence: 'Keep your food out of sight.',
    },
    {
      kind: 'short',
      marks: 1,
      stem: "From Paragraph 1, where did the writer's father want to have breakfast?",
      answer: 'At the top of the hill.',
      evidence: 'It is the highest hill in Singapore, and my father wanted to have breakfast at the top.',
      rubric: '一分：答「在山顶 / at the top」即给分。',
    },
    {
      kind: 'short',
      marks: 1,
      stem: 'From Paragraph 5, how long did it take the monkey to get the bag and run up the tree?',
      answer: 'About two seconds.',
      evidence: 'It all happened in about two seconds.',
      rubric: '一分：答「（大约）两秒 / 2 seconds」即给分。',
    },
    {
      kind: 'short',
      marks: 2,
      stem: 'From Paragraph 7, what did the monkey take away, and what did it leave on the branch?',
      answer: 'It took the bread away and left the empty bag on the branch.',
      evidence: 'Then the monkey went away with the bread. It left the empty bag on the branch.',
      rubric:
        '两分：写出「带走了面包」给 1 分；写出「把空袋子留在树枝上」再给 1 分。答「吃了香蕉」不给分 —— 那是第 6 段，不是它带走的东西。',
    },
    {
      kind: 'short',
      marks: 2,
      stem: "Using your own words, explain how the father's biscuits stayed safe (Paragraph 9).",
      answer: 'They were inside his backpack, so the monkeys could not see them.',
      evidence: 'At the top, my father opened his backpack and took out four packets of biscuits. "The monkeys did not see these," he said.',
      rubric:
        '两分：写出「饼干放在爸爸的背包里」给 1 分；写出「猴子没看见它们」再给 1 分。用自己的简单英文说对意思即可。',
    },
  ],
};

// ═══════════════════════════════════════════════════════════════
// 周五 —— The Box of Pens
//
// 美术课要买一盒彩色笔，妈妈让作者用她的手机网购：一盒十二支、三块钱。作者以为
// 「How many?」问的是几支，填了 12 —— 三天后到货十二盒，一百四十四支，花了
// 三十六块。妈妈没发火，只说要还钱。美术老师 Mrs Pereira 笑到坐下，给美术室买了
// 八盒（二十四块）；作者把这二十四块加上十二块零花钱还给妈妈，自己留一盒、三盒
// 送朋友。上周弟弟要买一把尺，妈妈自己下的单。
// 数字：12 × 12 = 144 支；12 × 3 = 36 元；8 × 3 = 24 元；24 + 12 = 36 元；
// 8 + 1 + 3 = 12 盒。不是语音发错人 / 群里发糗照 / 坐错车。
// ═══════════════════════════════════════════════════════════════

const PENS = {
  key: 'original-w6-box-of-pens',
  title: 'The Box of Pens',
  passage: numbered([
    'For art, Mrs Pereira asked us to buy a box of coloured pens. My mother let me order them online with her phone.',
    'The pens were easy to find. One box had twelve pens in it, and it cost three dollars.',
    'Next to the picture, there was a small box that said "How many?" I thought it meant the number of pens, so I typed 12. Then I pressed "Buy".',
    'Three days later, a big parcel came to our door. My mother opened it and looked at me. Inside, there were twelve boxes of pens.',
    'That was 144 pens. I had spent 36 dollars, not three.',
    'My mother did not shout. But she said I had to pay her back.',
    'The next day, I carried the parcel to school and showed it to Mrs Pereira. She laughed so much that she had to sit down.',
    'Then she had an idea. The art room needed new pens, so she bought eight boxes from me, for three dollars each.',
    'I gave my mother the 24 dollars, and 12 more from my pocket money. I kept one box and gave the other three to my friends. Last week, my brother needed a new ruler. My mother ordered it herself.',
  ]),
  questions: [
    {
      kind: 'mcq',
      stem: 'Why did the writer need to buy coloured pens?',
      answer: 'Mrs Pereira asked the class to buy them.',
      distractors: ["The writer's old pens were lost.", "The writer's mother wanted some.", "The writer's brother needed some."],
      evidence: 'For art, Mrs Pereira asked us to buy a box of coloured pens.',
    },
    {
      kind: 'mcq',
      stem: 'Why did the writer type 12?',
      answer: 'The writer thought it meant the number of pens.',
      distractors: ['Mrs Pereira said to buy twelve boxes.', 'The writer wanted pens for the whole class.', 'The phone typed the number by itself.'],
      evidence: 'I thought it meant the number of pens, so I typed 12.',
    },
    {
      kind: 'mcq',
      stem: "What did the writer's mother do when she opened the parcel?",
      answer: 'She looked at the writer.',
      distractors: ['She shouted at the writer.', 'She laughed very loudly.', 'She sent it back to the shop.'],
      evidence: 'My mother opened it and looked at me.',
    },
    {
      kind: 'tfng',
      item: 'Mrs Pereira had bought pens from the same shop before.',
      answer: 'NOT GIVEN',
    },
    {
      kind: 'tfng',
      item: 'Each box of pens cost twelve dollars.',
      answer: 'FALSE',
      evidence: 'One box had twelve pens in it, and it cost three dollars.',
    },
    {
      kind: 'gapChoice',
      stem: 'Mrs Pereira laughed so much that she had to ______ down.',
      answer: 'sit',
      distractors: ['lie', 'look', 'slow'],
      evidence: 'She laughed so much that she had to sit down.',
    },
    {
      kind: 'short',
      marks: 1,
      stem: 'From Paragraph 1, whose phone did the writer use to order the pens?',
      answer: "The writer's mother's phone.",
      evidence: 'My mother let me order them online with her phone.',
      rubric: '一分：答「妈妈的手机 / his or her mother\'s」即给分。',
    },
    {
      kind: 'short',
      marks: 1,
      stem: 'From Paragraph 4, how many days later did the parcel come?',
      answer: 'Three days later.',
      evidence: 'Three days later, a big parcel came to our door.',
      rubric: '一分：答「三天 / three days」即给分。',
    },
    {
      kind: 'short',
      marks: 2,
      stem: 'From Paragraph 5, how many pens did the writer get, and how much money had the writer spent?',
      answer: '144 pens and 36 dollars.',
      evidence: 'That was 144 pens. I had spent 36 dollars, not three.',
      rubric:
        '两分：写出「一百四十四支笔 / 144」给 1 分；写出「三十六块钱 / 36 dollars」再给 1 分。答「十二盒（每盒十二支）」也给这 1 分；只写「12」不给分 —— 分不清是盒还是支。答「三块钱」不给分 —— 那是原本想花的钱。',
    },
    {
      kind: 'short',
      marks: 2,
      stem: 'Using your own words, explain how Mrs Pereira helped the writer (Paragraph 8).',
      answer: 'She bought eight boxes of the pens for the art room, and she paid three dollars for each box.',
      evidence: 'The art room needed new pens, so she bought eight boxes from me, for three dollars each.',
      rubric:
        '两分：以下三点任答两点，每点 1 分：从作者那里买下八盒笔；买来给美术室用（美术室正需要新笔）；每盒付三块钱。答第 7 段的「她笑了」不给分。用自己的简单英文说对意思即可。',
    },
  ],
};

const SPECS = [PHOTO, GECKO, LOLLIES, BAG, PENS];

module.exports = {
  LEVEL,
  SPECS,
  DAYS: DATES.slice(0, SPECS.length).map((date, i) => buildAuthoredDay(SPECS[i], date)),
};
