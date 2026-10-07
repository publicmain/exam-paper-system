/**
 * 第七周 —— **ielts_simplified（O-Level 基础）**档，全原创。
 *
 * 形状与第四、五、六周这一档一致：两百词上下、八九个短段、一条线讲到底，
 *   3 道四选一 · 2 道判断 · 1 道原文填空（四选一） · 4 道主观题（1/1/2/2 分）。
 *
 * 选题思路：第六周五个领域是学校小事 / 邻里帮忙 / 动手做 / 户外自然 / 网上乌龙，
 * 这一周五天全换：**家务事 / 交通出行 / 买东西·钱 / 天气 / 运动比赛**。
 * 骨架也错开 —— 这一档前几周「遇到难题 → 学到一个窍门 → 成了」写得多
 * （补胎、拔河、蜗牛、冰棍、拍照），本周只留周五一篇是这个骨架，其余四篇分别是
 * 闯祸后反转（粉衬衫）、自以为在帮人其实是自己不知道（过马路）、绕一圈回到原点
 * （卖旧玩具）、不听劝吃亏又换个地方再吃亏（晒伤）。五个结局各不相同。
 *
 * 选题前对过学生交过卷的全部标题（.local/tmp/read-titles-0929.txt / read-titles-1007.txt）
 * 和内容包全部已发文章（pack-titles-1007.txt），并在 week2~week6 内容包与 test-fixtures
 * 里搜过 pink / washing machine / white shirt / green man / traffic light / toys / flea /
 * sunscreen / sunburn / cloud / goggles / marathon / water station，没有同一桥段：
 * 洗衣只有「邻居的衣服要淋雨」（Laundry）和仓鼠躲在洗衣机后（Hamster）；
 * 红绿灯只在 Snail Stop（带幼儿过马路，核心是蜗牛）和第三周 olevel 里当背景出现；
 * 跑步比赛都是跑的人视角（Last Lap / Relay / Last Runner），没有站补水站的。
 *
 * 照旧：两分题的两个得分点都要能在原文里找到（不靠推断）；不出否定问法；
 * 判断题改答案要改题干。全周判断题：FT / NT / TF / NF / TN → T4 F3 NG3
 * （NOT GIVEN 两天在前、一天在后）。
 */

'use strict';

const { buildAuthoredDay, numbered } = require('../authored');
const { DATES } = require('./dates');

const LEVEL = 'ielts_simplified';

// ═══════════════════════════════════════════════════════════════
// 周一 —— The Pink Shirts（家务事）
//
// 妈妈去马来西亚看姐妹，周末让作者洗衣服：「放进机器按 Start 就行」。作者把爸爸的
// 白衬衫、自己的白校服和生日收到的新红球衣一起洗，出来全粉了，只有红球衣没变；
// 网上查到新红衣服会掉色、白的和彩色的不能一起洗；再洗两遍也没用。爸爸沉默半天
// 只说「我周一要开会」，周一穿粉衬衫上班，作者穿柜子里太小的旧校服。晚上爸爸笑着
// 回来：三个人夸衬衫，老板问在哪买的。现在作者每周六洗衣、分两个篮子，爸爸说粉色
// 是他的颜色了。
// 选题理由：第一次做家务就闯祸，学生都懂；结局反转而不说教。
// 与旧文的区别：已读的洗衣故事（Laundry）是下雨帮邻居收衣服，没有串色；Ring in the
// Rice 是厨房丢戒指找戒指。本篇没有「丢了 → 找到」。
// 事实：新的深色 / 红色衣服洗时会掉色，把白衣服染粉，所以白色和彩色要分开洗 ——
// 把握高（洗衣常识）。「再洗两遍还是粉的」是故事情节，不写成「永远洗不掉」。
// ═══════════════════════════════════════════════════════════════

const PINK = {
  key: 'original-w7-pink-shirts',
  title: 'The Pink Shirts',
  passage: numbered([
    'Last month, my mother went to Malaysia for the weekend to visit her sister. Before she left, she asked me to do the washing on Saturday. "It is easy," she said. "Put the clothes in the machine and press Start."',
    'On Saturday morning, I put everything from the basket into the machine: my father\'s white work shirts, my white school shirts and the new red football shirt I got for my birthday. Then I pressed Start.',
    'An hour later, I opened the machine. My school shirts were pink. My father\'s five work shirts were pink too. Only my red football shirt looked the same as before.',
    'I looked online. A new red shirt can lose some of its colour in the wash, I read. White clothes and coloured clothes should never go into the machine together.',
    'I washed the white shirts two more times. They were still pink.',
    'When my father came home, I showed him his shirts. For a long time, he said nothing. Then he said quietly, "I have a meeting on Monday."',
    'On Monday, he wore a pink shirt to work. I wore an old school shirt from the back of the cupboard. It was too small for me.',
    'That evening, my father came home with a big smile. "Three people said they liked my shirt," he said. "My boss asked me where I bought it."',
    'Now I do the washing every Saturday, with two baskets: one for white clothes and one for coloured clothes. My father still wears his pink shirts. He says pink is his colour now.',
  ]),
  questions: [
    {
      kind: 'mcq',
      stem: "What did the writer's mother ask the writer to do on Saturday?",
      answer: 'do the washing',
      distractors: ['visit her sister', 'buy a new shirt', 'clean the cupboard'],
      evidence: 'Before she left, she asked me to do the washing on Saturday.',
    },
    {
      kind: 'mcq',
      stem: "What did the writer's father say after a long silence?",
      answer: 'He had a meeting on Monday.',
      distractors: ['He liked the colour pink.', 'The writer must buy new ones.', 'The shirts were too small now.'],
      evidence: 'Then he said quietly, "I have a meeting on Monday."',
    },
    {
      kind: 'mcq',
      stem: 'What did the writer wear on Monday?',
      answer: 'an old shirt that was too small',
      distractors: ['a pink school shirt', 'the red football shirt', "one of the father's shirts"],
      evidence: 'I wore an old school shirt from the back of the cupboard. It was too small for me.',
    },
    {
      kind: 'tfng',
      item: 'Washing the shirts two more times made them white again.',
      answer: 'FALSE',
      evidence: 'I washed the white shirts two more times. They were still pink.',
    },
    {
      kind: 'tfng',
      item: "The writer's father has kept on wearing the pink shirts.",
      answer: 'TRUE',
      evidence: 'My father still wears his pink shirts.',
    },
    {
      kind: 'gapChoice',
      stem: 'In the machine there was a new red football shirt that the writer got for a ______.',
      answer: 'birthday',
      distractors: ['meeting', 'weekend', 'school'],
      evidence: 'On Saturday morning, I put everything from the basket into the machine: my father\'s white work shirts, my white school shirts and the new red football shirt I got for my birthday.',
    },
    {
      kind: 'short',
      marks: 1,
      stem: "From Paragraph 1, which country did the writer's mother go to?",
      answer: 'Malaysia.',
      evidence: 'Last month, my mother went to Malaysia for the weekend to visit her sister.',
      rubric: '一分：答「马来西亚 / Malaysia」即给分。只答「去看她的姐妹」不给分 —— 题目问的是哪个国家。',
    },
    {
      kind: 'short',
      marks: 1,
      stem: "From Paragraph 3, how many of the father's work shirts turned pink?",
      answer: 'Five.',
      evidence: "My father's five work shirts were pink too.",
      rubric: '一分：答「五件 / five / 5」即给分。答「三件」不给分 —— 那是第 8 段说喜欢衬衫的人数。',
    },
    {
      kind: 'short',
      marks: 2,
      stem: 'From Paragraph 8, what TWO things did the father say about his day at work?',
      answer: 'Three people said they liked his shirt, and his boss asked him where he bought it.',
      evidence: '"Three people said they liked my shirt," he said. "My boss asked me where I bought it."',
      rubric:
        '两分：写出「有三个人说喜欢他的衬衫」给 1 分；写出「老板问他衬衫在哪里买的」再给 1 分。只写「他笑着回家」不给分 —— 那是作者看到的，不是爸爸说的。',
    },
    {
      kind: 'short',
      marks: 2,
      stem: 'Using your own words, explain what the writer learned online about washing clothes (Paragraph 4).',
      answer: 'A new red shirt can lose some of its colour when it is washed, so white clothes and coloured clothes must be washed apart.',
      evidence: 'A new red shirt can lose some of its colour in the wash, I read. White clothes and coloured clothes should never go into the machine together.',
      rubric:
        '两分：写出「新的红衣服洗的时候会掉色」给 1 分；写出「白衣服和彩色衣服不能放在一起洗 / 要分开洗」再给 1 分。答「再洗两遍也没用」不给分 —— 那是第 5 段作者自己试的结果，不是网上看到的。用自己的简单英文说对意思即可。',
    },
  ],
};

// ═══════════════════════════════════════════════════════════════
// 周二 —— The Extra Seconds（交通出行）
//
// 作者每天上学过一条大马路，绿灯小人很短，总是快走。周一一位拄拐杖的老伯过得很慢，
// 走到一半小人开始闪，作者不忍丢下他，陪着慢慢走；没走完就红灯了，有个司机按喇叭，
// 作者脸都红了。第二天老伯掏出一张卡，在按钮上方的小盒子上一碰，小人亮得久多了，
// 两人从容走完。老伯说：这是乐龄卡，一碰就多几秒；昨天把卡忘在家里了。作者回头
// 一看，盒子上有个「Green Man +」的小牌子 —— 走了两年从没注意过。现在作者在路口
// 看老人手里有没有卡。
// 选题理由：新加坡学生天天过马路，却多半不知道路口的这个设计；「我以为是我在帮他，
// 其实是我不知道」这个反转适合基础档。
// 与旧文的区别：不是坐错车 / 车上丢手机 / 地铁站走失小孩 / 让座；Snail Stop 里过马路
// 只是背景（核心是蜗牛和带小孩）。没有「教老人用手机」的套路，反而是老人懂、作者不懂。
// 事实：新加坡陆交局的 Green Man+：年长者和残障人士在红绿灯杆上、行人按钮上方的读卡器
// 上拍卡，绿灯小人会多亮几秒（按路宽多 3–13 秒，文中只写「a few more seconds」）——
// 把握高。卡写成 senior card，不写具体卡名。
// ═══════════════════════════════════════════════════════════════

const SECONDS = {
  key: 'original-w7-extra-seconds',
  title: 'The Extra Seconds',
  passage: numbered([
    'There is a busy road between my home and school. Every morning, I cross it at the traffic lights. The green man there is quite short, so I always walk fast.',
    'Last Monday, an old man with a walking stick was waiting next to me. When the green man came on, he started to cross very slowly.',
    'Halfway across, the green man began to flash. The old man was still in the middle of the road. I did not want to leave him, so I walked slowly next to him.',
    'The lights turned red before we reached the other side. The cars waited for us, but one driver sounded his horn. My face went hot.',
    'The next morning, the old man was there again. He took a card out of his pocket and touched it on a small box on the pole, just above the button.',
    'This time, the green man stayed on much longer. We walked across together, and there was still time left when we reached the other side.',
    'I asked him about the card. "It is my senior card," he said. "When I touch it on the box, the green man stays on for a few more seconds. Yesterday I left it at home."',
    'I looked at the box again. It had a small sign on it: "Green Man +". I have walked past it every school day for two years, but I never noticed it.',
    'Now, when an old person is waiting next to me at those lights, I look at their hands. If I see a card, I know we will have time.',
  ]),
  questions: [
    {
      kind: 'mcq',
      stem: 'Why does the writer always walk fast at these traffic lights?',
      answer: 'The green man there is quite short.',
      distractors: ['The writer is often late for school.', "The writer's school starts early.", 'The writer wants to be first across.'],
      evidence: 'The green man there is quite short, so I always walk fast.',
    },
    {
      kind: 'mcq',
      stem: 'What did the writer do when the green man began to flash?',
      answer: 'walked slowly next to the old man',
      distractors: ['ran to the other side of the road', 'pressed the button one more time', 'waved at the cars to stop'],
      evidence: 'I did not want to leave him, so I walked slowly next to him.',
    },
    {
      kind: 'mcq',
      stem: 'Where did the old man touch his card?',
      answer: 'on a small box on the pole',
      distractors: ['on the button for the green man', 'on a box at the bus stop', 'on the screen of his phone'],
      evidence: 'He took a card out of his pocket and touched it on a small box on the pole, just above the button.',
    },
    {
      kind: 'tfng',
      item: 'The old man was on his way to the market.',
      answer: 'NOT GIVEN',
    },
    {
      kind: 'tfng',
      item: 'On the second morning, the two of them got across before the lights changed.',
      answer: 'TRUE',
      evidence: 'We walked across together, and there was still time left when we reached the other side.',
    },
    {
      kind: 'gapChoice',
      stem: 'The cars waited, but one driver sounded his ______.',
      answer: 'horn',
      distractors: ['card', 'button', 'bell'],
      evidence: 'The cars waited for us, but one driver sounded his horn.',
    },
    {
      kind: 'short',
      marks: 1,
      stem: 'From Paragraph 2, what did the old man have with him to help him walk?',
      answer: 'A walking stick.',
      evidence: 'Last Monday, an old man with a walking stick was waiting next to me.',
      rubric: '一分：答「拐杖 / a walking stick / a stick」即给分。答「一张卡」不给分 —— 卡是第二天才出现的，也不是帮他走路的。',
    },
    {
      kind: 'short',
      marks: 1,
      stem: 'From Paragraph 8, for how long has the writer walked past the box?',
      answer: 'For two years.',
      evidence: 'I have walked past it every school day for two years, but I never noticed it.',
      rubric: '一分：答「两年 / two years」即给分（写「每个上学日、两年」也给分）。',
    },
    {
      kind: 'short',
      marks: 2,
      stem: 'From Paragraph 7, give TWO things the old man told the writer about his card.',
      answer: 'It is his senior card, and when he touches it on the box, the green man stays on for a few more seconds.',
      evidence: '"It is my senior card," he said. "When I touch it on the box, the green man stays on for a few more seconds. Yesterday I left it at home."',
      rubric:
        '两分：老伯说了三件事，三点任答两点，每点 1 分：这是他的乐龄卡 / 老人卡（senior card）；把卡碰一下盒子，绿灯小人会多亮几秒；昨天他把卡忘在家里了。答「卡放在口袋里」不给分 —— 那是第 5 段作者看到的，不是老伯说的。',
    },
    {
      kind: 'short',
      marks: 2,
      stem: 'Using your own words, explain how the writer now knows that there will be enough time to cross (Paragraph 9).',
      answer: 'The writer looks at the hands of the old person waiting there, and if the person has a card, they will have time.',
      evidence: 'Now, when an old person is waiting next to me at those lights, I look at their hands. If I see a card, I know we will have time.',
      rubric:
        '两分：写出「作者会看旁边等灯的老人的手」给 1 分；写出「看到老人手里有卡，就知道时间够 / 绿灯会久一点」再给 1 分。只写「走快一点」不给分 —— 那是第 1 段作者以前的做法。用自己的简单英文说对意思即可。',
    },
  ],
};

// ═══════════════════════════════════════════════════════════════
// 周三 —— The Toy Sale（买东西 / 钱）
//
// 房间里旧玩具太多，妈妈给作者一个大箱子，让周日拿去社区中心的旧货摊卖。七岁的
// 妹妹美玲帮着装箱。摆了一个钟头，标价五块，没人买：拿起来、看看价钱、放下。旁边
// 卖旧书的阿姨说「全部一块，小孩子身上只有一点点钱」，改价后很快卖空，得二十六块。
// 作者分给美玲一半（十三块），她跑开二十分钟，抱回一个娃娃、一个球、一匹玩具马和
// 一袋塑料小动物 —— 钱全花了。箱子搬回家，几乎和早上一样满。妈妈说「下个月还有
// 一次」，美玲说「好，我需要更多钱」。
// 选题理由：定价、卖东西、分钱，数字简单（5 → 1，26 ÷ 2 = 13）；结局绕一圈回到原点，
// 本周其他四篇没有这种结局。
// 与旧文的区别：不是夜市摆摊（Night Market Stall / Pasar Malam，那是家里做生意）、
// 不是攒硬币买礼物（The Tin Under the Bed）、不是网购买多了（The Box of Pens）。
// 数字：二十六件一块钱的玩具 = 26 元；一半 = 13 元。
// ═══════════════════════════════════════════════════════════════

const SALE = {
  key: 'original-w7-toy-sale',
  title: 'The Toy Sale',
  passage: numbered([
    'My room was full of old toys. Last month, my mother gave me a big box. "Fill it," she said. "There is a sale of old things at the community centre on Sunday. You can sell your toys there."',
    'My little sister, Mei Ling, is seven. She wanted to help, so we filled the box together. We put in cars, puzzles, a robot and lots of soft toys.',
    'On Sunday morning, we put everything on a small table at the sale. I wrote the prices on pieces of paper. Most things were five dollars.',
    'For an hour, nobody bought anything. People picked up our toys, looked at the prices and put them down again.',
    'The woman at the next table was selling old books. "Make everything one dollar," she told us. "Children only have a little money."',
    'So I changed all the prices. After that, the toys sold very fast. By twelve o\'clock, the box was empty, and we had twenty-six dollars.',
    'I gave Mei Ling half of the money. She looked at the thirteen dollars in her hand for a moment. Then she ran off.',
    'Twenty minutes later, she came back with her arms full: a doll, a ball, a toy horse and a bag of small plastic animals. She had spent all her money at the other tables.',
    'We put her new toys in the box and carried it home. It was almost as full as in the morning. My mother looked inside. "There is another sale next month," she said. "Good," said Mei Ling. "I need more money."',
  ]),
  questions: [
    {
      kind: 'mcq',
      stem: 'Where was the sale of old things?',
      answer: 'at the community centre',
      distractors: ["at the writer's school", 'in a big shopping centre', "outside the writer's block"],
      evidence: 'There is a sale of old things at the community centre on Sunday.',
    },
    {
      kind: 'mcq',
      stem: 'What did people do with the toys during the first hour?',
      answer: 'They looked at the prices and put them down.',
      distractors: ['They bought only the soft toys.', 'They asked for lower prices.', 'They walked past without looking.'],
      evidence: 'People picked up our toys, looked at the prices and put them down again.',
    },
    {
      kind: 'mcq',
      stem: 'Why did the woman at the next table say to make everything one dollar?',
      answer: 'Children only have a little money.',
      distractors: ['All her books were one dollar.', 'The sale was nearly over.', 'The toys were too old.'],
      evidence: '"Make everything one dollar," she told us. "Children only have a little money."',
    },
    {
      kind: 'tfng',
      item: 'Mei Ling helped the writer to fill the box.',
      answer: 'TRUE',
      evidence: 'She wanted to help, so we filled the box together.',
    },
    {
      kind: 'tfng',
      item: 'The woman at the next table told them to make everything five dollars.',
      answer: 'FALSE',
      evidence: '"Make everything one dollar," she told us.',
    },
    {
      kind: 'gapChoice',
      stem: 'At first, most things on the table were ______ dollars.',
      answer: 'five',
      distractors: ['one', 'thirteen', 'ten'],
      evidence: 'Most things were five dollars.',
    },
    {
      kind: 'short',
      marks: 1,
      stem: 'From Paragraph 2, how old is Mei Ling?',
      answer: 'Seven.',
      evidence: 'My little sister, Mei Ling, is seven.',
      rubric: '一分：答「七岁 / seven / 7」即给分。',
    },
    {
      kind: 'short',
      marks: 1,
      stem: 'From Paragraph 7, how much money did the writer give Mei Ling?',
      answer: 'Thirteen dollars (half of the money).',
      evidence: 'She looked at the thirteen dollars in her hand for a moment.',
      rubric:
        '一分：答「十三块 / 13 dollars」或「一半的钱 / half of the money」即给分。答「二十六块」不给分 —— 那是两人一共卖到的钱。',
    },
    {
      kind: 'short',
      marks: 2,
      stem: 'From Paragraph 8, how long was Mei Ling away, and how much of her money did she spend?',
      answer: 'Twenty minutes, and she spent all of her money.',
      evidence: 'Twenty minutes later, she came back with her arms full: a doll, a ball, a toy horse and a bag of small plastic animals. She had spent all her money at the other tables.',
      rubric:
        '两分：写出「二十分钟」给 1 分；写出「钱全部花光了 / all of it / 十三块全花了」再给 1 分。只写「一半」不给分 —— 那是作者分给她的，不是她花掉的。',
    },
    {
      kind: 'short',
      marks: 2,
      stem: 'Using your own words, explain what happened after the writer changed the prices (Paragraph 6).',
      answer: 'The toys sold very quickly, and by twelve o\'clock they were all gone and the children had twenty-six dollars.',
      evidence: 'After that, the toys sold very fast. By twelve o\'clock, the box was empty, and we had twenty-six dollars.',
      rubric:
        '两分：以下三点任答两点，每点 1 分：玩具卖得很快；到十二点箱子空了 / 全卖完了；他们一共得到二十六块钱。答「一个小时没人买」不给分 —— 那是第 4 段、改价以前的事。用自己的简单英文说对意思即可。',
    },
  ],
};

// ═══════════════════════════════════════════════════════════════
// 周四 —— The Cloudy Day（天气）
//
// 周日全家去东海岸公园海滩，天阴、云多、不太热。妈妈拿出防晒霜让大家擦，作者说
// 「今天没太阳，你看这些云」，妈妈说阴天太阳一样会晒伤人，作者不听，戴上泳镜就下海，
// 在海里泡了一下午、堆沙堡，泳镜一直没摘。晚上脸发烫，镜子里满脸通红，只有
// 眼睛周围两个白圈。妹妹笑到从沙发上掉下来：「像熊猫，可是颜色反了！」周一全班、
// 连别班同学都来看，班主任给了一条冷湿毛巾。红五天退了，白圈留了快三个星期。昨天
// 又去海滩，又是阴天，这回作者没等妈妈开口就擦了脸、手臂和腿 —— 忘了耳朵。
// 选题理由：「阴天也会晒伤」是有用的常识，熊猫白圈画面感强，基础档读得懂。
// 与旧文的区别：本档天气篇写过打雷（Counting the Thunder）、热天做冰棍（Ice Lollies）；
// 已读的还有暴雨被困、雨伞、雨后的气味、收衣服。没有写过晒太阳。结局是换个地方
// 再吃一次小亏，不是「我学到了」。
// 事实：云挡不住大部分紫外线（世卫组织：薄云最多能透过约八成），阴天一样会晒伤；
// 泳镜遮住的皮肤不会晒红，留下白圈；晒伤的红几天就退，晒黑的印子要留更久 ——
// 把握高。文中不写百分比。
// ═══════════════════════════════════════════════════════════════

const CLOUDY = {
  key: 'original-w7-cloudy-day',
  title: 'The Cloudy Day',
  passage: numbered([
    'Last Sunday, my family went to the beach at East Coast Park. The sky was grey and full of clouds, and it was not very hot.',
    'When we got there, my mother got out the sunscreen. "Everyone, put some on," she said.',
    '"There is no sun today," I said. "Look at the clouds." My mother told me that the sun can still burn you on a cloudy day. I did not listen. I put on my swimming goggles and ran into the sea.',
    'I stayed in the sea for most of the afternoon. Then my sister and I built a big sandcastle. I had my goggles on the whole time.',
    'That evening, my face started to feel hot. When I looked in the mirror, it was bright red. But there were two white circles around my eyes, where the goggles had been.',
    'My sister laughed so much that she fell off the sofa. "You look like a panda," she said, "but in the wrong colours!"',
    'At school on Monday, everybody wanted to see my face. By lunchtime, even students from other classes came to look. My form teacher gave me a cold, wet towel to put on it.',
    'The red went away after five days. But the white circles stayed for nearly three weeks.',
    'Yesterday we went to the beach again, and it was cloudy again. This time, I put sunscreen on my face, my arms and my legs before my mother said anything. But I forgot my ears. Today they are bright red.',
  ]),
  questions: [
    {
      kind: 'mcq',
      stem: 'What was the sky like when the family went to the beach?',
      answer: 'grey and full of clouds',
      distractors: ['blue and very sunny', 'dark with heavy rain', 'clear but very windy'],
      evidence: 'The sky was grey and full of clouds, and it was not very hot.',
    },
    {
      kind: 'mcq',
      stem: 'What did the writer tell the mother at the beach?',
      answer: 'There was no sun that day.',
      distractors: ['It was too hot to swim.', 'The writer had some sunscreen on.', 'The goggles were enough.'],
      evidence: '"There is no sun today," I said. "Look at the clouds."',
    },
    {
      kind: 'mcq',
      stem: "What did the writer's sister do when she saw the writer's face?",
      answer: 'She laughed and fell off the sofa.',
      distractors: ['She gave the writer a cold towel.', 'She took a photo of the face.', 'She called their mother over.'],
      evidence: 'My sister laughed so much that she fell off the sofa.',
    },
    {
      kind: 'tfng',
      item: 'The family drove to East Coast Park.',
      answer: 'NOT GIVEN',
    },
    {
      kind: 'tfng',
      item: 'The white circles went away at the same time as the red.',
      answer: 'FALSE',
      evidence: 'The red went away after five days. But the white circles stayed for nearly three weeks.',
    },
    {
      kind: 'gapChoice',
      stem: 'In the mirror, the writer saw two white ______ around the eyes.',
      answer: 'circles',
      distractors: ['clouds', 'colours', 'lines'],
      evidence: 'But there were two white circles around my eyes, where the goggles had been.',
    },
    {
      kind: 'short',
      marks: 1,
      stem: "From Paragraph 1, where did the writer's family go last Sunday?",
      answer: 'To the beach at East Coast Park.',
      evidence: 'Last Sunday, my family went to the beach at East Coast Park.',
      rubric: '一分：答「海滩 / the beach」或「东海岸公园 / East Coast Park」即给分。',
    },
    {
      kind: 'short',
      marks: 1,
      stem: 'From Paragraph 4, what did the writer and the sister build?',
      answer: 'A big sandcastle.',
      evidence: 'Then my sister and I built a big sandcastle.',
      rubric: '一分：答「（大）沙堡 / a sandcastle」即给分。',
    },
    {
      kind: 'short',
      marks: 2,
      stem: 'From Paragraph 7, give TWO things that happened at school on Monday.',
      answer: 'Everybody wanted to see the writer\'s face, and students from other classes came to look.',
      evidence: 'At school on Monday, everybody wanted to see my face. By lunchtime, even students from other classes came to look. My form teacher gave me a cold, wet towel to put on it.',
      rubric:
        '两分：以下三点任答两点，每点 1 分：大家都想看作者的脸；连别的班的同学都来看；班主任给了作者一条冷的湿毛巾。答「妹妹笑他像熊猫」不给分 —— 那是第 6 段在家里的事。',
    },
    {
      kind: 'short',
      marks: 2,
      stem: 'Using your own words, explain what the writer did better on the second beach trip, and what still went wrong (Paragraph 9).',
      answer: 'The writer put sunscreen on the face, arms and legs before the mother said anything, but forgot the ears, so they are red now.',
      evidence: 'This time, I put sunscreen on my face, my arms and my legs before my mother said anything. But I forgot my ears. Today they are bright red.',
      rubric:
        '两分：写出「这次妈妈还没开口，作者就自己在脸、手臂和腿上擦了防晒霜」给 1 分（写出「自己主动擦了防晒霜」即可）；写出「忘了擦耳朵，耳朵晒红了」再给 1 分。只写「又是阴天」不给分 —— 那是天气，不是作者做的事。用自己的简单英文说对意思即可。',
    },
  ],
};

// ═══════════════════════════════════════════════════════════════
// 周五 —— The Water Station（运动 / 比赛）
//
// 周日城里办长跑比赛，作者全班去一个补水站帮忙，早上六点到。活儿听起来简单：倒水、
// 把杯子递出去、跑的人不停步接过去。第一个来拿作者杯子的是个戴帽子和墨镜的高个子，
// 作者捏着杯口递，被他一碰，水全洒在鞋上；第二个人干脆没拿到。干了十年的义工
// 蔡太太过来教：杯子只倒一半、捏住杯底、手臂伸直、别动，让跑的人自己拿。照做以后
// 一个穿黄衣服的女跑者不减速就接走了，喝几口、剩下的浇在头上，喊「谢谢」。到十点
// 作者递出三百多杯，一杯没掉。周一体育老师林老师走路很慢：「我昨天跑了，经过你们
// 补水站。」「我没看见您。」「我就是那个戴帽子的。你的鞋，不好意思。」
// 选题理由：从义工的角度写比赛，学生多半没想过；结尾一句话把第 3 段的人对上号。
// 与旧文的区别：已读的跑步故事都是跑的人自己（Last Lap / Relay / Last Runner），
// Tug of War 是运动会；本篇主角不比赛。本周只有这一篇是「学到窍门 → 做成」的骨架。
// 事实：补水站的常见做法 —— 杯子别倒满免得洒、捏住杯子下半截、手臂伸直别动，
// 让跑者从上面抓 —— 把握高（各大马拉松义工须知都这么写）。「第一个来拿作者杯子的人」
// 不是全场领跑者，所以体育老师出现在那里说得通。
// ═══════════════════════════════════════════════════════════════

const WATER = {
  key: 'original-w7-water-station',
  title: 'The Water Station',
  passage: numbered([
    'Last Sunday, there was a big running race in the city. My class helped at one of the water stations. We got there at six in the morning, before the first runners came.',
    'Our job sounded easy. We filled paper cups with water and held them out. The runners took the cups without stopping.',
    'The first runner who came to my cup was a tall man in a cap and dark glasses. I held the cup out by the top. He hit my hand, and the water went all over my shoes. The second runner missed my cup completely.',
    'Then an older helper, Mrs Chua, came over. She had helped at this race for ten years.',
    '"Fill the cups only halfway, so they do not spill," she said. "Hold each cup at the bottom, with your arm straight out. Then keep still and let the runner take it."',
    'I tried it. A woman in a yellow shirt took my cup without slowing down. She drank some, poured the rest over her head and shouted, "Thank you!"',
    'After that, I did not drop a single cup. By ten o\'clock, my arm was tired and my shoes were still wet, but I had given out more than three hundred cups.',
    'On Monday, our PE teacher, Mr Lim, was walking very slowly. "I ran in the race yesterday," he told us. "I passed your water station."',
    '"I did not see you," I said. He smiled. "I was the man in the cap," he said. "Sorry about your shoes."',
  ]),
  questions: [
    {
      kind: 'mcq',
      stem: 'When did the class get to the water station?',
      answer: 'at six in the morning',
      distractors: ['at ten in the morning', 'at half past seven', 'after the first runners came'],
      evidence: 'We got there at six in the morning, before the first runners came.',
    },
    {
      kind: 'mcq',
      stem: 'What did the woman in the yellow shirt do with the rest of her water?',
      answer: 'She poured it over her head.',
      distractors: ['She gave it back to the writer.', 'She threw it on the road.', 'She gave it to another runner.'],
      evidence: 'She drank some, poured the rest over her head and shouted, "Thank you!"',
    },
    {
      kind: 'mcq',
      stem: "Who was the first runner who came to the writer's cup?",
      answer: 'Mr Lim, the PE teacher',
      distractors: ['the woman in the yellow shirt', "Mrs Chua's son", "a boy from the writer's class"],
      evidence: '"I was the man in the cap," he said.',
    },
    {
      kind: 'tfng',
      item: 'Mrs Chua had helped at this race in other years.',
      answer: 'TRUE',
      evidence: 'She had helped at this race for ten years.',
    },
    {
      kind: 'tfng',
      item: 'Mr Lim ran in the race with some other teachers.',
      answer: 'NOT GIVEN',
    },
    {
      kind: 'gapChoice',
      stem: 'Mrs Chua told the writer to fill the cups only ______.',
      answer: 'halfway',
      distractors: ['once', 'straight', 'still'],
      evidence: '"Fill the cups only halfway, so they do not spill," she said.',
    },
    {
      kind: 'short',
      marks: 1,
      stem: 'From Paragraph 7, about how many cups had the writer given out by ten o\'clock?',
      answer: 'More than three hundred.',
      evidence: 'By ten o\'clock, my arm was tired and my shoes were still wet, but I had given out more than three hundred cups.',
      rubric: '一分：答「三百多杯 / more than 300」即给分；题目问「大约」，只写「三百 / 300」也给分。只答「十」不给分 —— 那是同一段里的时间（十点）。',
    },
    {
      kind: 'short',
      marks: 1,
      stem: 'From Paragraph 8, how was Mr Lim walking on Monday?',
      answer: 'Very slowly.',
      evidence: 'On Monday, our PE teacher, Mr Lim, was walking very slowly.',
      rubric: '一分：答「（走得）很慢 / very slowly / slowly」即给分。',
    },
    {
      kind: 'short',
      marks: 2,
      stem: 'From Paragraph 5, give TWO things Mrs Chua said about how to hold the cup.',
      answer: 'Hold it at the bottom with the arm straight out, and keep still so the runner can take it.',
      evidence: '"Hold each cup at the bottom, with your arm straight out. Then keep still and let the runner take it."',
      rubric:
        '两分：以下三点任答两点，每点 1 分：捏住杯子的底部；手臂伸直；别动 / 让跑的人自己拿走。答「杯子只倒一半水」不给分 —— 那是怎么倒水，不是怎么拿杯子。',
    },
    {
      kind: 'short',
      marks: 2,
      stem: "Using your own words, explain what went wrong with the writer's first two runners (Paragraph 3).",
      answer: 'The first runner hit the writer\'s hand and the water went all over the writer\'s shoes, and the second runner did not get the cup at all.',
      evidence: 'He hit my hand, and the water went all over my shoes. The second runner missed my cup completely.',
      rubric:
        '两分：写出「第一个人撞到作者的手，水洒了（洒在鞋上）」给 1 分；写出「第二个人根本没拿到杯子」再给 1 分。答「作者捏着杯口递」本身不给分 —— 那是原因，题目问的是出了什么事。用自己的简单英文说对意思即可。',
    },
  ],
};

const SPECS = [PINK, SECONDS, SALE, CLOUDY, WATER];

module.exports = {
  LEVEL,
  SPECS,
  DAYS: DATES.slice(0, SPECS.length).map((date, i) => buildAuthoredDay(SPECS[i], date)),
};
