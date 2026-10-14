/**
 * 第八周 —— **ielts_simplified（O-Level 基础）**档，全原创。
 *
 * 形状与第四到七周这一档一致：两百多词、九个短段、一条线讲到底，
 *   3 道四选一 · 2 道判断 · 1 道原文填空（四选一） · 4 道主观题（1/1/2/2 分）。
 *
 * 选题思路：五天按分配的领域写 —— **生活技能 / 身边的动物 / 邻里小事 / 运动习惯 /
 * 一道传统点心**（徽章依次 learning / nature / community / health / culture）。
 * 骨架互相错开：周一「被人教会 → 成了全家的修扣子的人」，周二「看到怪事 → 查明白 →
 * 自己做实验 → 实验做过头」，周三「一群陌生邻居一起做一件事 → 少了一块 → 谜底是个
 * 四岁小孩」，周四「每天记数字、一点点进步 → 弟弟从笑话到加入」，周五「自己吃亏 →
 * 学会 → 故意让爸爸也吃一次亏」。五个结局各不相同，只有周一、周四两篇有「学到办法 →
 * 做成」的成分，周四的重点在每天的数字而不是一个窍门。
 *
 * 查重：对过 .local/tmp/pack-titles-1014.txt（内容包 1–7 周 175 篇）和
 * read-titles-1014.txt（学生读过的 383 篇），并在 week2~week7 内容包与 test-fixtures 里
 * 搜过 button / sew / needle / toothpick / ants / jigsaw / puzzle / stairs / ondeh /
 * kueh / pandan / gula melaka，没有同一题材或桥段：
 *   · 缝扣子：只有 Library of Things 里提到「缝纫机」可以借，没有缝补故事；
 *   · 蚂蚁：只有雅思学术文 Collecting Ant Specimens 和 Doris Lessing 的猎人与鹿，
 *     没有「蚂蚁沿气味线走」；
 *   · 拼图：内容包里只有玩具清单里的 puzzles（上周 Toy Sale），没有拼图故事；
 *   · 爬楼梯：已读的楼梯只是场景（排队、滑倒、迷路），没有拿楼梯当锻炼的；
 *     Sub-Twenty 是魔方比赛，Last Lap / Last Runner 是比赛冲刺，本篇没有比赛名次；
 *   · ondeh-ondeh：两篇旧文里只是「有人在吃 / 摊上在卖」，没有做法和「一口吃」的桥段。
 * 避开了第四周 The Bean That Did Not Grow（浇水太多烂掉）——原本想写「全班都给班上的
 * 盆栽浇水」，和它的高潮撞了，换成拼图。人名都没在前七周出现过：Mrs Seow、Imran、
 * Meera、Mr Leong、Liyana。
 *
 * 照旧：两分题的两个得分点都要能在原文里找到（不靠推断）；不出否定问法；
 * 判断题改答案要改题干。全周判断题：NT / TF / FN / TN / FT → T4 F3 NG3
 * （NOT GIVEN 分在周一、周三、周四）。
 */

'use strict';

const { buildAuthoredDay, numbered } = require('../authored');
const { DATES } = require('./dates');

const LEVEL = 'ielts_simplified';

// ═══════════════════════════════════════════════════════════════
// 周一 —— The Fourth Button（learning · 生活小技能）
//
// 校服第四颗扣子在公交上掉了，作者揣进口袋。课间作者拿去学校书店（也卖校服）请 Mrs Seow 缝，
// 她说「不帮你缝，教你缝」：先把衬衫用别的扣子扣好，铅笔从空扣眼戳下去点个点，
// 扣子缝在点上，不然衬衫会歪；再把一根牙签横放在扣子上，隔着牙签缝，扣子就不会太紧。
// 作者针上下穿了六次，扎了两次手，抽掉牙签、线在扣子底下绕几圈、背面打结，用了
// 十八分钟。Mrs Seow 用力一拉，纹丝不动：「以后你再也用不着我了。」晚上爸爸拿出
// 三件掉了扣子的衬衫：「你妈说她不缝。」作者全缝好，一颗收一块钱；现在妈妈也攒了
// 一袋衣服等着他。
// 选题理由：缝扣子是真正用得上的小技能，两个窍门（对着扣眼点位置、隔牙签缝）都
// 具体、可以照着做；结尾「收费」不说教。
// 与旧文的区别：没有缝补故事；不是洗衣服（上周 Pink Shirts）、补胎（Flat Tyre）、
// 做冰棍（Ice Lollies）—— 那几篇的窍门是网上 / 视频查的，本篇是真人当面教。
// 事实：钉扣子先扣上衬衫、从扣眼里点出位置；隔一根牙签 / 大头针缝，抽掉后在扣子下
// 绕线做「线脚」，扣子才扣得进去；背面打结 —— 把握高（缝纫常识）。
// ═══════════════════════════════════════════════════════════════

const BUTTON = {
  key: 'original-w8-fourth-button',
  title: 'The Fourth Button',
  passage: numbered([
    'On Monday, the fourth button on my school shirt came off on the bus. I put it in my pocket.',
    'At recess, I took it to the school bookshop, which also sells uniforms. "Can you sew this back on?" I asked Mrs Seow, who works there.',
    '"No," she said. "But I can show you how." She gave me a needle, some white thread and a toothpick.',
    'First, she asked me to close my shirt with the other buttons. Then she pushed a pencil through the empty buttonhole and put a small dot on the cloth under it. "Sew the button on the dot," she said, "or your shirt will hang to one side."',
    'Next, she put the toothpick across the top of the button. "Sew over this," she said. "Then the button will not be too tight."',
    'I pushed the needle up and down through the holes six times. Twice, I pushed it into my thumb. Then I took out the toothpick, wrapped the thread round and round under the button and tied it at the back.',
    'It took me eighteen minutes. Mrs Seow pulled the button hard, but it did not move. "Good," she said. "Now you will never need me again."',
    'That evening, my father saw my shirt. He came back from his room with three of his work shirts. Each one had a button missing. "Your mother says she is not doing these," he said.',
    'I sewed all three, and he gave me one dollar for each button. Now my mother has a bag of clothes waiting for me too.',
  ]),
  questions: [
    {
      kind: 'mcq',
      stem: "Where did the button come off the writer's shirt?",
      answer: 'on the bus',
      distractors: ['in the bookshop', 'in the classroom', 'at the dinner table'],
      evidence: 'On Monday, the fourth button on my school shirt came off on the bus.',
    },
    {
      kind: 'mcq',
      stem: 'What did Mrs Seow say when the writer asked her to sew the button on?',
      answer: 'She would show the writer how to do it.',
      distractors: ['She was too busy at recess.', 'The writer should buy a new shirt.', 'The writer should ask a parent.'],
      evidence: '"No," she said. "But I can show you how."',
    },
    {
      kind: 'mcq',
      stem: 'What did Mrs Seow do after the writer finished?',
      answer: 'She pulled the button hard.',
      distractors: ['She sewed it on again.', 'She gave the writer a dollar.', 'She took the writer to class.'],
      evidence: 'Mrs Seow pulled the button hard, but it did not move.',
    },
    {
      kind: 'tfng',
      item: 'Mrs Seow has worked at the school bookshop for many years.',
      answer: 'NOT GIVEN',
    },
    {
      kind: 'tfng',
      item: "More than one of the father's shirts had a button missing.",
      answer: 'TRUE',
      evidence: 'He came back from his room with three of his work shirts. Each one had a button missing.',
    },
    {
      kind: 'gapChoice',
      stem: 'Mrs Seow pushed a pencil through the empty buttonhole and put a small dot on the ______ under it.',
      answer: 'cloth',
      distractors: ['thumb', 'pocket', 'seat'],
      evidence: 'Then she pushed a pencil through the empty buttonhole and put a small dot on the cloth under it.',
    },
    {
      kind: 'short',
      marks: 1,
      stem: 'From Paragraph 6, how many times did the writer push the needle up and down through the holes?',
      answer: 'Six times.',
      evidence: 'I pushed the needle up and down through the holes six times.',
      rubric: '一分：答「六次 / six / 6」即给分。答「两次 / twice」不给分 —— 那是针扎到拇指的次数。',
    },
    {
      kind: 'short',
      marks: 1,
      stem: 'From Paragraph 7, how long did it take the writer to sew the button on?',
      answer: 'Eighteen minutes.',
      evidence: 'It took me eighteen minutes.',
      rubric: '一分：答「十八分钟 / eighteen minutes / 18 minutes」即给分。只写「十八」没写单位也给分。',
    },
    {
      kind: 'short',
      marks: 2,
      stem: 'From Paragraph 4, what did Mrs Seow do with the pencil, and why did the button have to go on the dot?',
      answer: 'She pushed the pencil through the empty buttonhole and put a dot on the cloth, because if the button is not on the dot, the shirt will hang to one side.',
      evidence: 'Then she pushed a pencil through the empty buttonhole and put a small dot on the cloth under it. "Sew the button on the dot," she said, "or your shirt will hang to one side."',
      rubric:
        '两分：写出「用铅笔从空扣眼里戳下去，在下面的布上点了一个点」给 1 分（写出「用铅笔做了个记号 / 点了个点」即可）；写出「不缝在点上，衬衫会歪向一边 / 挂得不正」再给 1 分。答「扣子就不会太紧」不给分 —— 那是第 5 段牙签的作用，不是这个点的作用。',
    },
    {
      kind: 'short',
      marks: 2,
      stem: "Using your own words, explain what the writer did with the father's shirts and what the writer got for it (Paragraph 9).",
      answer: 'The writer sewed the buttons on all three shirts, and the father paid one dollar for each button.',
      evidence: 'I sewed all three, and he gave me one dollar for each button.',
      rubric:
        '两分：写出「把三件衬衫的扣子都缝好了」给 1 分；写出「爸爸每颗扣子付了一块钱 / 一共三块」再给 1 分。答「妈妈也有一袋衣服等着」不给分 —— 那是之后的事，不是爸爸的衬衫。用自己的简单英文说对意思即可。',
    },
  ],
};

// ═══════════════════════════════════════════════════════════════
// 周二 —— The Ant Road（nature · 身边的动物）
//
// 周日晚上作者在厨房吃蛋糕，掉了一小块在地上，懒得捡。第二天早上地上有一条细细
// 的黑线，从窗下的小洞一直到蛋糕，是几百只小蚂蚁。蛋糕扔了，放学回家蚂蚁还沿着
// 同一条线走，线的尽头已经什么都没有。妈妈在湿抹布上抹了肥皂，只在一个地方横着
// 擦了一下：走到湿处的蚂蚁停下、打转、走错方向，线断成两截。作者上网查：蚂蚁找到
// 吃的，回窝路上在地上留下气味，别的蚂蚁顺着气味走；肥皂把气味擦掉了。周二作者
// 在阳台的盘子上滴一滴蜂蜜：二十分钟后一只蚂蚁找到、匆匆走掉，再过十分钟一条线从
// 阳台边连到盘子。第二天早上，新的一条线从阳台通进了厨房 —— 妈妈把湿抹布递给他。
// 选题理由：家家都见过蚂蚁排队，却少有人知道它们是闻着走的；有一个擦一下就断线的
// 画面，还有一个学生自己能做的小实验。
// 与旧文的区别：不是壁虎（Gecko）、鸟（Birds on the Eleventh Floor）、蜗牛（Snail Stop）、
// 鹦鹉、猴子；也不是 Collecting Ant Specimens（学术文，采标本）。结局是实验做过头，
// 不是「我学到了」。
// 事实：很多蚂蚁（包括家里常见的小蚂蚁）找到食物后，在回窝的路上留下气味（信息素）
// 路线，同窝的蚂蚁顺着它找到食物；用肥皂水擦过的地方气味被抹掉，蚂蚁会在断口处
// 打转、走散 —— 把握高（昆虫学常识，也是常见的家庭驱蚁办法）。文中不写「信息素」，
// 只写 smell；时间（二十分钟、十分钟）是故事情节。
// ═══════════════════════════════════════════════════════════════

const ANTS = {
  key: 'original-w8-ant-road',
  title: 'The Ant Road',
  passage: numbered([
    'On Sunday night, I ate some cake in the kitchen. A small piece fell on the floor, but I was too tired to pick it up.',
    'In the morning, there was a thin black line on the floor. It started at a small hole under the window and ended at the cake. The line was made of hundreds of tiny ants.',
    'I threw the cake away and went to school. When I got home, the ants were still walking along the same line, but there was nothing at the end of it.',
    'My mother put some soap on a wet cloth and wiped across the line, in one place only.',
    'The ants that reached the wet place stopped. They walked in small circles and went the wrong way. Soon the line was broken in two.',
    'That evening, I read about ants online. When an ant finds food, it leaves a smell on the ground on its way back to the nest. Other ants follow the smell to the food. The soap had wiped the smell away, so the ants did not know where to go.',
    'I wanted to see this for myself. On Tuesday, I put one drop of honey on a plate on our balcony.',
    'After twenty minutes, one ant found the honey. It stayed for a short time and then hurried away. Ten minutes later, there was a line of ants from the edge of the balcony to the plate.',
    'The next morning, there was a new line. It went from the balcony into the kitchen. My mother handed me the wet cloth.',
  ]),
  questions: [
    {
      kind: 'mcq',
      stem: 'Why did the writer leave the piece of cake on the floor?',
      answer: 'The writer was too tired.',
      distractors: ['The writer did not see it.', 'The writer wanted to feed the ants.', 'The mother said to leave it.'],
      evidence: 'A small piece fell on the floor, but I was too tired to pick it up.',
    },
    {
      kind: 'mcq',
      stem: 'What did the ants do when they reached the wet place?',
      answer: 'They walked in small circles.',
      distractors: ['They climbed over the cloth.', 'They ate some of the soap.', 'They waited for it to dry.'],
      evidence: 'They walked in small circles and went the wrong way.',
    },
    {
      kind: 'mcq',
      stem: 'What did the writer put on the plate on the balcony?',
      answer: 'one drop of honey',
      distractors: ['a small piece of cake', 'some sugar and water', 'a little bread'],
      evidence: 'On Tuesday, I put one drop of honey on a plate on our balcony.',
    },
    {
      kind: 'tfng',
      item: 'The ants kept walking along the line after the cake was gone.',
      answer: 'TRUE',
      evidence: 'When I got home, the ants were still walking along the same line, but there was nothing at the end of it.',
    },
    {
      kind: 'tfng',
      item: "The writer's mother wiped the whole kitchen floor.",
      answer: 'FALSE',
      evidence: 'My mother put some soap on a wet cloth and wiped across the line, in one place only.',
    },
    {
      kind: 'gapChoice',
      stem: 'The black line started at a small hole under the ______.',
      answer: 'window',
      distractors: ['plate', 'table', 'nest'],
      evidence: 'It started at a small hole under the window and ended at the cake.',
    },
    {
      kind: 'short',
      marks: 1,
      stem: 'From Paragraph 2, what was the thin black line made of?',
      answer: 'Hundreds of tiny ants.',
      evidence: 'The line was made of hundreds of tiny ants.',
      rubric: '一分：答「（几百只）小蚂蚁 / ants」即给分。答「蛋糕」不给分 —— 蛋糕是线的尽头，不是线本身。',
    },
    {
      kind: 'short',
      marks: 1,
      stem: 'From Paragraph 8, how long did it take for the first ant to find the honey?',
      answer: 'Twenty minutes.',
      evidence: 'After twenty minutes, one ant found the honey.',
      rubric: '一分：答「二十分钟 / twenty minutes / 20 minutes」即给分。答「十分钟」不给分 —— 那是之后排成一条线又用的时间。',
    },
    {
      kind: 'short',
      marks: 2,
      stem: 'From Paragraph 6, what does an ant do when it finds food, and what do the other ants do?',
      answer: 'It leaves a smell on the ground on its way back to the nest, and the other ants follow the smell to the food.',
      evidence: 'When an ant finds food, it leaves a smell on the ground on its way back to the nest. Other ants follow the smell to the food.',
      rubric:
        '两分：写出「找到吃的那只蚂蚁在回窝的路上往地上留下气味」给 1 分（写出「留下气味」即可）；写出「别的蚂蚁顺着气味找到吃的」再给 1 分。答「肥皂把气味擦掉了」不给分 —— 那是作者家里发生的事，不是蚂蚁找吃的办法。',
    },
    {
      kind: 'short',
      marks: 2,
      stem: "Using your own words, explain what the writer saw the next morning and what the writer's mother did (Paragraph 9).",
      answer: 'There was a new line of ants going from the balcony into the kitchen, and the mother handed the writer the wet cloth.',
      evidence: 'The next morning, there was a new line. It went from the balcony into the kitchen. My mother handed me the wet cloth.',
      rubric:
        '两分：写出「有一条新的蚂蚁线，从阳台一直进到厨房」给 1 分（只写「又有一条线」也给分）；写出「妈妈把湿抹布递给了作者 / 让作者去擦」再给 1 分。答「妈妈自己擦掉了」不给分 —— 原文是她把抹布交给作者。用自己的简单英文说对意思即可。',
    },
  ],
};

// ═══════════════════════════════════════════════════════════════
// 周三 —— A Thousand Pieces（community · 邻里小事）
//
// 两周前，楼里电梯旁多了一张小桌子，上面是一千片的拼图和一张纸条：「路过请放一片」。
// 没人知道是谁放的。第一天有人拼好四个角，第三天整圈边拼完。清洁工每天上班前拼几片，
// 送货员放一片、笑着跑回摩托车。放学后作者和住五楼的 Imran 拼天空 —— 全是一样的蓝，
// 最难；两人住同一栋楼，以前从没说过话。晚上桌边常站着五六个人。
// 第十一天，画（蓝海上的一条红船）差不多拼完，偏偏船正中缺一片，谁也找不到。第二天
// 晚上一个四岁左右的小女孩跟爸爸从电梯出来，从口袋里掏出那一片按了进去。爸爸说：
// 「Meera 第一天就拿走了，她想放最后一片。」大家鼓掌，她躲到爸爸腿后面。第二天早上
// 桌上换成了两千片的新盒子和一张纸条：「来个更大的？」到现在还没人知道是谁放的。
// 选题理由：一群互不认识的邻居被一件小事连起来，没有说教；「缺的那片在小孩口袋里」
// 是基础档读得懂的小谜底。
// 与旧文的区别：不是义卖（Toy Sale）、让座 / 给老人让路、补水站、Library of Things
// （借东西）、Bus Stop Garden（种花）、The Void Deck（灵堂）；没有找失物 —— 那一片
// 不是丢了，是小孩故意留着。没有事实性内容。
// ═══════════════════════════════════════════════════════════════

const PUZZLE = {
  key: 'original-w8-thousand-pieces',
  title: 'A Thousand Pieces',
  passage: numbered([
    'Two weeks ago, a small table appeared by the lifts in our block. On it was a jigsaw puzzle with a thousand pieces and a note: "Please add one piece when you pass by."',
    'We did not know who put it there. On the first day, someone did the four corners. By the third day, the whole edge was done.',
    'Then more people stopped. The cleaner did a few pieces every morning before work. A delivery man put in one piece, laughed and ran back to his bike.',
    'After school, a boy called Imran and I worked on the sky. It was all the same blue, so it was the hardest part. Imran lives on the fifth floor. We live in the same block, but we had never talked before.',
    'In the evenings, five or six people often stood around the table.',
    'After eleven days, the picture was nearly finished: a red boat on a blue sea. But one piece was missing, right in the middle of the boat. Nobody could find it.',
    'The next evening, a little girl of about four came out of the lift with her father. She took a piece out of her pocket and pushed it into the hole.',
    'Her father smiled. "My daughter Meera took it on the first day," he said. "She wanted to put in the last piece." Everybody clapped, and Meera hid behind his legs.',
    'The next morning, there was a new box on the table, with two thousand pieces and a note: "Ready for a bigger one?" We still do not know who leaves them.',
  ]),
  questions: [
    {
      kind: 'mcq',
      stem: 'What did the note on the table ask people to do?',
      answer: 'add one piece when they pass by',
      distractors: ['finish the puzzle in two weeks', 'write their names on the note', 'take the puzzle home at night'],
      evidence: 'On it was a jigsaw puzzle with a thousand pieces and a note: "Please add one piece when you pass by."',
    },
    {
      kind: 'mcq',
      stem: 'Why was the sky the hardest part?',
      answer: 'It was all the same blue.',
      distractors: ['Some of its pieces were lost.', 'It was at the edge of the puzzle.', 'Imran did not like the colour.'],
      evidence: 'It was all the same blue, so it was the hardest part.',
    },
    {
      kind: 'mcq',
      stem: 'What did the picture in the puzzle show?',
      answer: 'a red boat on a blue sea',
      distractors: ['a tall block of flats', 'a girl and her father', 'a man on a bike'],
      evidence: 'After eleven days, the picture was nearly finished: a red boat on a blue sea.',
    },
    {
      kind: 'tfng',
      item: 'The writer and Imran often talked to each other before they worked on the puzzle.',
      answer: 'FALSE',
      evidence: 'We live in the same block, but we had never talked before.',
    },
    {
      kind: 'tfng',
      item: "The cleaner lives in the writer's block.",
      answer: 'NOT GIVEN',
    },
    {
      kind: 'gapChoice',
      stem: 'One piece was missing, right in the middle of the ______.',
      answer: 'boat',
      distractors: ['table', 'lift', 'note'],
      evidence: 'But one piece was missing, right in the middle of the boat.',
    },
    {
      kind: 'short',
      marks: 1,
      stem: 'From Paragraph 4, which floor does Imran live on?',
      answer: 'The fifth floor.',
      evidence: 'Imran lives on the fifth floor.',
      rubric: '一分：答「五楼 / the fifth floor / 5th floor」即给分。只答「和作者住同一栋楼」不给分 —— 题目问的是哪一层。',
    },
    {
      kind: 'short',
      marks: 1,
      stem: 'From Paragraph 6, after how many days was the picture nearly finished?',
      answer: 'Eleven days.',
      evidence: 'After eleven days, the picture was nearly finished: a red boat on a blue sea.',
      rubric: '一分：答「十一天 / eleven / 11」即给分。答「两周」不给分 —— 那是第 1 段说桌子出现到现在的时间。',
    },
    {
      kind: 'short',
      marks: 2,
      stem: 'From Paragraph 3, what did the cleaner and the delivery man each do?',
      answer: 'The cleaner did a few pieces every morning before work, and the delivery man put in one piece and ran back to his bike.',
      evidence: 'The cleaner did a few pieces every morning before work. A delivery man put in one piece, laughed and ran back to his bike.',
      rubric:
        '两分：写出「清洁工每天早上上班前拼几片」给 1 分；写出「送货员放了一片（笑着跑回车上）」再给 1 分。两人写反了不给分。答「拼了四个角」不给分 —— 那是第 2 段不知道是谁做的。',
    },
    {
      kind: 'short',
      marks: 2,
      stem: 'Using your own words, explain why the last piece was missing, according to Meera\'s father (Paragraph 8).',
      answer: 'Meera took the piece on the first day, because she wanted to be the one who put in the last piece.',
      evidence: '"My daughter Meera took it on the first day," he said. "She wanted to put in the last piece."',
      rubric:
        '两分：写出「Meera（那个小女孩）第一天就把这一片拿走了」给 1 分；写出「她想自己放最后一片」再给 1 分。只写「在她口袋里」给 1 分（相当于第一点）。答「掉到桌子底下了」不给分 —— 原文说大家都没找到。用自己的简单英文说对意思即可。',
    },
  ],
};

// ═══════════════════════════════════════════════════════════════
// 周四 —— Ten Floors Up（health · 运动小习惯）
//
// 作者家住十楼，以前连下楼都坐电梯。上学期体育课跑 2.4 公里，停下来走了三次，
// 差点最后一名。体育老师 Mr Leong 说：「你不用去健身房，家里有楼梯，还不要钱。」
// 作者定了一条规矩：每天放学走楼梯上楼，只算上楼，下楼不算。第一天四楼腿就疼，
// 七楼坐在台阶上歇了五分钟，剩下的坐电梯。冰箱上贴张纸，每天记第一次停下的楼层；
// 两周后一口气走到十楼。之后用手机计时：第一次两分四十秒，一个月后一分五十秒。
// 弟弟笑他「电梯只要三十秒」，跟着走了一次，五楼就坐电梯了。这学期再跑 2.4 公里，
// 一次没停；Mr Leong 看看表又看看他：「楼梯？」现在弟弟也走楼梯，电梯门一开两人就
// 冲楼梯 —— 通常是电梯先到，但不总是。
// 选题理由：家住高楼的学生天天能做的运动小习惯；每天记数字，题目有可算的进步。
// 与旧文的区别：不是比赛冲刺（Last Lap / Last Runner / Relay）、不是运动会拔河（Tug of
// War）、不是补水站（Water Station）；没有名次和最后一刻反超，没有电梯故障被困
// （Between Floors 一类）。
// 事实：新加坡中学体育课的体能测试（NAPFA）有 2.4 公里跑 —— 把握高；文中只写
// 「a 2.4-kilometre run in PE」，不写测试名称和及格时间。爬楼梯是好的日常锻炼放在
// 老师嘴里，不写成数字结论；所有时间都是故事里的。
// ═══════════════════════════════════════════════════════════════

const STAIRS = {
  key: 'original-w8-ten-floors-up',
  title: 'Ten Floors Up',
  passage: numbered([
    'My family lives on the tenth floor. I used to take the lift every time, even to go down.',
    'Last term, we did a 2.4-kilometre run in PE. I had to stop and walk three times, and I came nearly last. Our PE teacher, Mr Leong, said, "You do not need a gym. You have stairs at home, and they are free."',
    'So I made one rule: every day after school, I walk up the stairs to our flat. I only walk up. Going down does not count.',
    'On the first day, my legs hurt by the fourth floor. At the seventh floor, I sat down on the steps for five minutes. Then I took the lift.',
    'I put a piece of paper on the fridge. Every day, I wrote down the floor where I first stopped. After two weeks, I reached the tenth floor without stopping.',
    'Then I started to time myself with my phone. The first time, it took two minutes and forty seconds. A month later, it took one minute and fifty seconds.',
    'My younger brother laughed at me. "The lift takes thirty seconds," he said. But one day he came with me. He stopped at the fifth floor and took the lift.',
    'This term, we did the 2.4-kilometre run again. I did not stop once. At the end, Mr Leong looked at his watch, then at me. "Stairs?" he asked. I nodded.',
    'Now my brother takes the stairs too. When the lift door opens, we look at each other and run for the stairs. The lift usually gets there first. But not always.',
  ]),
  questions: [
    {
      kind: 'mcq',
      stem: 'What happened to the writer in the first 2.4-kilometre run?',
      answer: 'The writer had to stop and walk three times.',
      distractors: ['The writer fell and hurt a leg.', 'The writer came first in the class.', 'The writer ran with Mr Leong.'],
      evidence: 'I had to stop and walk three times, and I came nearly last.',
    },
    {
      kind: 'mcq',
      stem: 'What did the writer write on the paper on the fridge every day?',
      answer: 'where the writer first stopped',
      distractors: ['how many steps there were', 'how long the lift took', 'where the brother stopped'],
      evidence: 'Every day, I wrote down the floor where I first stopped.',
    },
    {
      kind: 'mcq',
      stem: 'What did Mr Leong do at the end of the second run?',
      answer: 'He looked at his watch and then at the writer.',
      distractors: ['He gave the writer a prize.', 'He told the class to clap.', 'He asked the writer to run again.'],
      evidence: 'At the end, Mr Leong looked at his watch, then at me.',
    },
    {
      kind: 'tfng',
      item: "The writer's rule was only about walking up the stairs, not down.",
      answer: 'TRUE',
      evidence: 'I only walk up. Going down does not count.',
    },
    {
      kind: 'tfng',
      item: 'Mr Leong lives in the same block as the writer.',
      answer: 'NOT GIVEN',
    },
    {
      kind: 'gapChoice',
      stem: 'At the seventh floor, the writer sat down on the ______ for five minutes.',
      answer: 'steps',
      distractors: ['fridge', 'phone', 'paper'],
      evidence: 'At the seventh floor, I sat down on the steps for five minutes.',
    },
    {
      kind: 'short',
      marks: 1,
      stem: "From Paragraph 1, which floor does the writer's family live on?",
      answer: 'The tenth floor.',
      evidence: 'My family lives on the tenth floor.',
      rubric: '一分：答「十楼 / the tenth floor / 10th floor」即给分。答「七楼」「五楼」不给分 —— 那是作者和弟弟第一次停下的楼层。',
    },
    {
      kind: 'short',
      marks: 1,
      stem: "From Paragraph 7, how long did the writer's brother say the lift takes?",
      answer: 'Thirty seconds.',
      evidence: '"The lift takes thirty seconds," he said.',
      rubric: '一分：答「三十秒 / thirty seconds / 30 seconds」即给分。答「一分五十秒」「两分四十秒」不给分 —— 那是作者走楼梯的时间。',
    },
    {
      kind: 'short',
      marks: 2,
      stem: 'From Paragraph 6, how long did it take the writer to walk up the first time, and how long did it take a month later?',
      answer: 'Two minutes and forty seconds the first time, and one minute and fifty seconds a month later.',
      evidence: 'The first time, it took two minutes and forty seconds. A month later, it took one minute and fifty seconds.',
      rubric:
        '两分：写出「第一次两分四十秒」给 1 分；写出「一个月后一分五十秒」再给 1 分。写阿拉伯数字（2:40 / 1:50）也给分；两个时间写反了只给 1 分。答「三十秒」不给分 —— 那是弟弟说的电梯时间。',
    },
    {
      kind: 'short',
      marks: 2,
      stem: 'Using your own words, explain what Mr Leong told the writer after the first run (Paragraph 2).',
      answer: 'He said the writer did not need a gym, because the writer had stairs at home and they cost nothing.',
      evidence: '"You do not need a gym. You have stairs at home, and they are free."',
      rubric:
        '两分：写出「作者不需要去健身房」给 1 分；写出「家里就有楼梯，而且不要钱」再给 1 分（写出「家里有楼梯」即可）。答「电梯只要三十秒」不给分 —— 那是第 7 段弟弟说的。用自己的简单英文说对意思即可。',
    },
  ],
};

// ═══════════════════════════════════════════════════════════════
// 周五 —— One Bite（culture · 一道传统点心）
//
// 朋友 Liyana 的阿姨在学校附近的市场卖 kueh，上周六在家教两人做 ondeh-ondeh：
// 糯米粉做的绿色小球，绿色来自班兰叶汁，里面包一块椰糖（gula Melaka），外面滚椰丝。
// 阿姨先给作者一个尝：「一口吃。」作者不听，咬了一半，热糖浆喷了 Liyana 一眼镜。
// 自己做：面团按扁、放糖、包起来、在手心搓圆；阿姨放进开水锅：「浮上来就熟了。」
// 几分钟后一个个浮起来。作者有两个在水里破了、糖漏出来 ——「你的皮太薄」，Liyana
// 一边说一边还在擦眼镜。煮好滚上椰丝装盒带回家。晚上作者给爸爸一个，什么也没说，
// 爸爸咬了一半。厨房墙上现在还有糖，爸爸也知道规矩了：一口。
// 选题理由：新加坡学生都吃过、不一定会做的一道娘惹 / 马来点心；「一口吃」是真的吃法，
// 吃亏、学会、再让别人吃亏，结局一个来回。
// 与旧文的区别：已读的做吃的是鸡米饭、米粉、生日蛋糕、冰棍、食谱卡；ondeh-ondeh 只在
// 两篇旧文里被吃、被卖，没有做法和喷糖的桥段。不是祖辈教手艺、不是旧物件。
// 事实：ondeh-ondeh 用糯米粉加班兰叶汁揉成绿色面团，包入椰糖（gula Melaka），下开水
// 煮到浮起即熟，再滚椰丝；椰糖遇热化成糖浆，所以要整个放进嘴里，一咬就会喷 ——
// 把握高（新马常见糕点做法）。文中「sticky rice flour」即糯米粉。
// ═══════════════════════════════════════════════════════════════

const ONDEH = {
  key: 'original-w8-one-bite',
  title: 'One Bite',
  passage: numbered([
    "My friend Liyana's aunt sells kueh at a market near our school. Last Saturday, she showed Liyana and me how to make ondeh-ondeh in her kitchen.",
    'Ondeh-ondeh are small green balls of sticky rice flour. The green colour comes from the juice of pandan leaves. Inside each ball, there is a piece of brown palm sugar called gula Melaka. The outside is covered in white coconut.',
    'First, Liyana\'s aunt gave me one to try. "Eat it in one bite," she said. I did not listen. I bit it in half, and warm sugar shot out all over Liyana\'s glasses.',
    'Then we tried it ourselves. We pressed a small piece of dough flat, put some sugar in the middle and closed the dough around it. Then we rolled it into a ball between our hands.',
    'Liyana\'s aunt put the balls into boiling water. "When they come up to the top, they are ready," she said. A few minutes later, they started to come up, one by one.',
    'Two of mine broke open in the water, and the sugar came out. "Your dough is too thin," said Liyana. She was still cleaning her glasses.',
    'When the balls were cooked, we rolled them in the coconut and put them in boxes to take home.',
    'That evening, I gave one to my father. I did not tell him anything. He bit it in half.',
    'There is still some sugar on our kitchen wall. Now my father knows the rule too: one bite.',
  ]),
  questions: [
    {
      kind: 'mcq',
      stem: "Where does Liyana's aunt sell kueh?",
      answer: 'at a market near the school',
      distractors: ['at a shop in her block', 'in the school canteen', 'outside a train station'],
      evidence: "My friend Liyana's aunt sells kueh at a market near our school.",
    },
    {
      kind: 'mcq',
      stem: 'What gives ondeh-ondeh their green colour?',
      answer: 'the juice of pandan leaves',
      distractors: ['the sticky rice flour', 'the brown palm sugar', 'the white coconut'],
      evidence: 'The green colour comes from the juice of pandan leaves.',
    },
    {
      kind: 'mcq',
      stem: "According to Liyana's aunt, how can you tell that the balls are ready?",
      answer: 'They come up to the top of the water.',
      distractors: ['They turn brown in the pot.', 'They break open in the water.', 'They become very soft.'],
      evidence: '"When they come up to the top, they are ready," she said.',
    },
    {
      kind: 'tfng',
      item: 'The writer ate the first ondeh-ondeh in one bite.',
      answer: 'FALSE',
      evidence: 'I did not listen. I bit it in half, and warm sugar shot out all over Liyana\'s glasses.',
    },
    {
      kind: 'tfng',
      item: "There is still sugar on the wall of the writer's kitchen.",
      answer: 'TRUE',
      evidence: 'There is still some sugar on our kitchen wall.',
    },
    {
      kind: 'gapChoice',
      stem: "When the writer bit the first ball in half, warm sugar shot out all over Liyana's ______.",
      answer: 'glasses',
      distractors: ['boxes', 'leaves', 'fingers'],
      evidence: 'I bit it in half, and warm sugar shot out all over Liyana\'s glasses.',
    },
    {
      kind: 'short',
      marks: 1,
      stem: 'From Paragraph 2, what is the brown palm sugar inside the balls called?',
      answer: 'Gula Melaka.',
      evidence: 'Inside each ball, there is a piece of brown palm sugar called gula Melaka.',
      rubric: '一分：答「gula Melaka」即给分（拼写小错、大小写不计）。答「pandan」不给分 —— 那是给面团上色的叶子。',
    },
    {
      kind: 'short',
      marks: 1,
      stem: 'From Paragraph 7, what did they roll the cooked balls in?',
      answer: 'The coconut.',
      evidence: 'When the balls were cooked, we rolled them in the coconut and put them in boxes to take home.',
      rubric: '一分：答「椰丝 / 椰子 / coconut」即给分。答「糖」不给分 —— 糖是包在里面的。',
    },
    {
      kind: 'short',
      marks: 2,
      stem: 'From Paragraph 4, give TWO things the writer and Liyana did to make each ball.',
      answer: 'They pressed a small piece of dough flat and put some sugar in the middle.',
      evidence: 'We pressed a small piece of dough flat, put some sugar in the middle and closed the dough around it. Then we rolled it into a ball between our hands.',
      rubric:
        '两分：以下四点任答两点，每点 1 分：把一小块面团按扁；在中间放糖；把面团包起来、封住糖；在两手之间搓成球。答「把球放进开水里煮」不给分 —— 那是第 5 段阿姨做的。',
    },
    {
      kind: 'short',
      marks: 2,
      stem: "Using your own words, explain what went wrong with two of the writer's balls, and why (Paragraph 6).",
      answer: 'They broke open in the water and the sugar came out, because the dough was too thin.',
      evidence: 'Two of mine broke open in the water, and the sugar came out. "Your dough is too thin," said Liyana.',
      rubric:
        '两分：写出「在水里破了，糖漏出来」给 1 分（写出「破了」即可）；写出「因为面皮太薄」再给 1 分。答「没有一口吃 / 咬了一半」不给分 —— 那是第 3 段吃的时候的事，不是煮的时候。用自己的简单英文说对意思即可。',
    },
  ],
};

const SPECS = [BUTTON, ANTS, PUZZLE, STAIRS, ONDEH];

module.exports = {
  LEVEL,
  SPECS,
  DAYS: DATES.slice(0, SPECS.length).map((date, i) => buildAuthoredDay(SPECS[i], date)),
};
