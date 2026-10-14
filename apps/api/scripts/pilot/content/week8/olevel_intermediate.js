/**
 * 第八周 —— **olevel_intermediate（O-Level 中级）**档，全原创。
 *
 * 四百词上下的记叙文，八段。形状与第四到第七周这一档一致：
 *   4 道情绪配对（共用八个词的词库） · 1 道短语理解四选一 · 1 道原文填空 ·
 *   4 道两分主观题 —— 满分 14。
 *
 * 选题思路：这一周按徽章主题分配五个领域，每篇在本段注释里标了徽章：
 *   周一 technology（新装的指纹门锁认不出爸爸的手指）/ 周二 learning（学抛三个球，卡在「四下」）/
 *   周三 culture（给华人同学的爷爷八十大寿送了一座钟）/ 周四 history（旧报纸里发现爸爸
 *   十一岁时为家门口那座天桥写过联名信）/ 周五 community（全班拿到卫生奖奖金，要不要分给
 *   清洁阿姨，吵了一周，最后去问她本人）。
 * 结局刻意五种各不相同，也不和第七周（干脆的胜利 / 苦乐参半的放手 / 首尾呼应 / 喜剧反转 /
 * 开放式）重样：
 *   目的反转（装锁是为了不用开门，最后天天等着开门）/ 没人看见的成功（在家人面前一个也
 *   接不住，门外有人跟着数）/ 把禁忌变成玩笑（下一年的请柬写「别带会滴答响的东西」）/
 *   平凡之物的来历（嘴上说「没什么」的爸爸在桥上停下来拍照）/ 意外的请求（阿姨不要钱，
 *   只要周五把椅子翻上桌）。
 *
 * 查重：五篇先对过内容包 1–7 周 175 篇（pack-titles-1014）和学生在旧题库读过的 383 篇
 * （read-titles-1014），再把第三到第七周五档全文开头和 test-fixtures 的题目说明逐条看过，
 * 并 grep 过 fingerprint / digital lock / juggl / overhead bridge / Cleanest / chairs up /
 * prize money / ten-cent / Deepavali / signatures 等关键词：没有同题材、同骨架、同高潮的旧文。
 * 特意避开的近邻：How They Met（祖父母各说各的相识经过 —— 周四不写「家族传说各执一词」）、
 * The Longest Day（陪穆斯林朋友斋戒 —— 周三不写斋月）、The Question Jar（饭桌问答引出父母
 * 往事 —— 周四靠的是旧报纸这个一手材料，不是聊天）、The Early Alarm / The Umbrella（学校
 * 保安、清洁工是「一个人」—— 周五的核心是全班的分歧和「先去问本人」，不是认识清洁工）、
 * Is This Yours?（魔术台上失手）—— 周二不上台，成功恰恰发生在没人看的时候。
 * 人名都没在前七周出现过：Isaac、Mr Selvam、Kai Xuan、Ms Varghese、Ong Kah Wai、
 * Mr Bala、Darius、Elaine、Mdm Kwek，也都不是普通英文单词。
 *
 * 事实核对（把握程度）：
 *   · 周一：长年做手工活的人指纹纹路会磨平，指纹锁读不出 —— 公认现象，把握高；文中借上门
 *     技师之口说，不给数字。
 *   · 周二：抛接入门的通行教法 —— 先一个球、再两个球（throw, throw, catch, catch）、抛到眼睛
 *     高度；新手会不自觉往前抛、追着球往前走；对着墙（这里是衣柜）练能把球逼成直上直下 ——
 *     把握高。
 *   · 周三：普通话「送钟」与「送终」同音（sòng zhōng），给寿星送钟是大忌；收的人回一枚小硬币，
 *     把「送」变成「买」，是新马华人常见的化解法；祝寿摆寿桃包（peach-shaped buns）；不少
 *     印度家庭递接东西只用右手 —— 都把握高，而且都是人物的做法或说法，不是说明文断言。
 *   · 周四：新加坡有可检索的旧报纸网站（国家图书馆的 NewspaperSG），文中不点名；「网站上只看得到
 *     开头几行，全文要去图书馆看」与该库较近年份的报道只能馆内阅览的做法一致（把握中等，就算细节
 *     不同也只是情节）。1995 年那篇报道、那座天桥、那封联名信都是虚构的。
 *   · 周五：「最干净课室」评比、周五放学把椅子翻到桌上方便拖地 —— 新加坡学校常见做法，情节虚构。
 *
 * 情绪配对的四个时刻都写成具体动作（「pulling the door open on Thursday」），每个时刻在本段内
 * 都有叙述者自己的反应；词库避开盲做抓到过的相邻词对（doubtful/astonished、surprised/
 * disappointed、anxious/determined、anxious/nervous），也不把同一篇里别的段明显成立的情绪
 * 放进干扰项（例如周三有 ashamed 就不放 embarrassed，周五有 frustrated 就不放 furious；周二第 7 段当众
 * 失手也能读成 frustrated，所以周二词库不放 frustrated；周五第 7 段删掉了「原来不知道有这条规矩」，
 * 免得 surprised 也说得通）。
 *
 * 叙述者的性别五篇都没有写明，题干和参考答案一律用 the writer。
 */

'use strict';

const { buildAuthoredDay, numbered } = require('../authored');
const { DATES } = require('./dates');

const LEVEL = 'olevel_intermediate';

// ═══════════════════════════════════════════════════════════════
// 周一 —— Please Try Again　　徽章：technology
// ═══════════════════════════════════════════════════════════════
//
// 梗概：作者一年丢了三次钥匙，力主家里装指纹门锁，亲手给全家录指纹 —— 唯独修了二十六年
//   空调的爸爸，十个手指试了三十次全是红灯「Please try again」。一周里爸爸每晚七点按门铃，
//   周四门铃打断了作者最爱的节目，作者开门就说「你的拇指没用」。上门技师说锁没坏，是爸爸的
//   指纹磨平了。作者第一次认真看爸爸的手，想起那句话，别过脸去。技师给爸爸设了密码；作者道歉，
//   爸爸举起手说「这双手付了锁的钱，按按门铃总可以吧」。两个月里他只用过三次密码；如今快七点
//   时，作者不看节目了，在等门铃。
// 选题理由：门锁、指纹是学生家里天天碰到的「机器」；「机器认不出人」引出「我也从没认真看过他」，
//   技术题材落到人身上。结局类型：目的反转 —— 装锁本来是为了谁都不用去开门。
// 与旧文的区别：旧题库 The Locked Door 是忘带钥匙、邻居收留；本篇没人被锁在门外，冲突在人和
//   机器之间。不是祖辈旧物，不是诈骗 / 群聊（第四、六周写过）。
// 数字自洽：爸爸修空调二十六年（第 1、6 段一致）；十个手指 × 三次 = 三十次；「下一周」里周四
//   出事、周六技师上门；两个月里用了三次密码。

const TRY_AGAIN = {
  key: 'original-w8-please-try-again',
  title: 'Please Try Again',
  passage: numbered([
    'This year I lost my house key three times, so when my parents talked about getting a digital lock for our front door, I was its loudest supporter. My father, who has repaired air-conditioners for twenty-six years and does not trust anything with a battery in it, pointed out that a key never needs charging. In the end, my mother decided, and the lock went in on a Saturday.',
    "I set it up myself, after reading the whole instruction booklet, which nobody in my family has ever done with anything. One by one, I pressed everyone's fingers onto the small glass square: my mother's, my sister's and my own. Each time, the lock played a cheerful tune and a green light came on. I stood back with my arms folded, like a scientist whose experiment had worked.",
    "Then it was my father's turn. He pressed his thumb onto the glass. The lock gave a low beep, a red light flashed, and a calm voice said, 'Please try again.' We tried his other thumb, then every one of his fingers. Ten fingers, thirty tries, thirty red lights. I checked the booklet twice, sure that I had missed a step. My father laughed, but he put his hands into his pockets.",
    "For the next week, everyone walked straight into the flat except my father. Every evening at seven, the doorbell rang, and someone had to get up to let him in. I tried hand cream, warm water, pressing lightly and pressing hard. Nothing worked. On Thursday, when the bell rang in the middle of my favourite programme, I pulled the door open and said, 'Your thumb is useless.'",
    "On Saturday, a technician from the lock company came. He checked the lock for a minute, and then he looked at my father's hands for much longer. 'The lock is fine,' he said. 'Your fingerprints are almost worn away. It happens to people who have worked with their hands for many years. The lines get too flat for the machine to read.'",
    "After he left, I looked at my father's hands properly, perhaps for the first time. The skin on his fingertips was hard and shiny, like the bottom of an old shoe, with thin white scars across it. For twenty-six years, he had been climbing ladders and opening hot metal boxes in other people's homes. I remembered what I had said on Thursday, and I had to look away.",
    "The technician had set up a number code for my father instead. That night, I told him I was sorry about his thumb. He laughed and held up both hands. 'These hands paid for that lock,' he said, 'so I think they are allowed to ring the bell.'",
    'That was two months ago. As far as I know, my father has used his code three times. Most evenings at seven, the bell still rings, and I am usually the one who opens the door. Now, at about five to seven, I notice that I am no longer watching my programme. I am listening for the bell.',
  ]),
  questions: [
    {
      kind: 'matchingFeelings',
      bank: ['proud', 'puzzled', 'annoyed', 'ashamed', 'jealous', 'terrified', 'lonely', 'bored'],
      items: [
        { moment: 'Paragraph 2 — standing back with arms folded after the green lights', answer: 'proud', para: 2 },
        { moment: 'Paragraph 3 — checking the booklet twice after the thirty red lights', answer: 'puzzled', para: 3 },
        { moment: 'Paragraph 4 — pulling the door open on Thursday', answer: 'annoyed', para: 4 },
        { moment: "Paragraph 6 — looking away from the father's hands", answer: 'ashamed', para: 6 },
      ],
    },
    {
      kind: 'mcq',
      stem: "In Paragraph 7, what does the father mean by 'These hands paid for that lock'?",
      answer: 'His hard work earned the money for the lock.',
      distractors: [
        'He fixed the new lock with his own hands.',
        'He paid the technician in cash that night.',
        'He wanted the writer to pay him back.',
      ],
      evidence: "'These hands paid for that lock,' he said, 'so I think they are allowed to ring the bell.'",
    },
    {
      kind: 'gapChoice',
      stem: "The skin on the father's fingertips was hard and shiny, like the bottom of an old ______.",
      answer: 'shoe',
      distractors: ['box', 'bag', 'ladder'],
      evidence:
        'The skin on his fingertips was hard and shiny, like the bottom of an old shoe, with thin white scars across it.',
    },
    {
      kind: 'short',
      marks: 2,
      stem: 'According to Paragraph 1, why did the writer want a digital lock, and what did the father say against it?',
      answer:
        'The writer had lost the house key three times that year; the father pointed out that a key never needs charging.',
      evidence: 'pointed out that a key never needs charging',
      rubric:
        '两分：写出「作者这一年丢了三次钥匙」给 1 分（写出「老丢钥匙」即可）；写出爸爸的话「钥匙从来不用充电」再给 1 分（写「锁要用电池 / 要充电，钥匙不用」也给）。只写「爸爸不信任装电池的东西」不给第二分 —— 那是他的为人，不是他说的反对理由；写「最后妈妈拍板」不给分。',
    },
    {
      kind: 'short',
      marks: 2,
      stem: "According to Paragraph 4, give TWO things the writer tried to make the lock accept the father's fingers.",
      answer: 'Hand cream, warm water, pressing lightly, pressing hard (any two).',
      evidence: 'I tried hand cream, warm water, pressing lightly and pressing hard.',
      rubric:
        '两分：任答两点，每点 1 分：① 抹护手霜；② 用温水（泡 / 洗手）；③ 轻轻按；④ 用力按。「轻轻按」和「用力按」算两点。写「换另一只拇指」「每个手指都试一遍」不给分 —— 那是第 3 段刚装好时试的，不是这一周里作者想的办法。',
    },
    {
      kind: 'short',
      marks: 2,
      stem: 'According to Paragraph 5, what did the technician say was the problem, and why does it happen?',
      answer:
        "The lock was fine, but the father's fingerprints were almost worn away; this happens to people who have worked with their hands for many years, so the lines get too flat for the machine to read.",
      evidence: 'It happens to people who have worked with their hands for many years.',
      rubric:
        '两分：写出「锁没坏，是爸爸的指纹几乎磨平了」给 1 分（只写「锁没问题」不给这 1 分，要写出指纹磨平）；写出原因「多年用手干活的人都会这样，纹路太平，机器读不出来」再给 1 分（写出「长年用手干活」或「纹路太平读不出」任一即可）。写「爸爸修了二十六年空调」可以算第二分的合理变体，但只写「技师看了他的手很久」不给分。',
    },
    {
      kind: 'short',
      marks: 2,
      stem: 'According to Paragraph 8, what does the father still do most evenings, and how has the writer changed?',
      answer:
        'He still rings the bell at seven (he has used his code only three times); the writer no longer watches the programme at that time but listens for the bell.',
      evidence: 'Now, at about five to seven, I notice that I am no longer watching my programme.',
      rubric:
        '两分：写出「爸爸大多数晚上七点还是按门铃（两个月只用过三次密码）」给 1 分；写出作者的变化「快七点时不看节目了，而是在等 / 听门铃」再给 1 分（写「作者现在愿意去开门、在等爸爸回家」也给）。只写「作者通常是去开门的那个人」不给第二分 —— 要写出和以前（第 4 段嫌门铃打断节目）不同的地方。',
    },
  ],
};

// ═══════════════════════════════════════════════════════════════
// 周二 —— Facing the Wardrobe　　徽章：learning
// ═══════════════════════════════════════════════════════════════
//
// 梗概：物理课上 Mr Selvam 边讲东西怎么落下边抛三个橙子，说「谁都能一周学会」。出了名爱掉
//   东西的作者借弟弟 Isaac 的三个网球，照网上教法先练一个球、再练两个；三个球却卡在三四下，
//   门背后的记录一连几天都是「四下」，第十天把球扔进柜子说老师骗人。Isaac 在作者脚尖前贴一条
//   胶带、盯着脚看：二十分钟后作者已经站到大门边，离胶带四大步 —— 原来一直在往前抛、追着球走。
//   作者脸贴衣柜站着练，往前抛的球被柜门弹回来，接球数从五到九到十五。一个周日晚上一个人数到
//   三十一，冲出去表演，在家人面前第二个球就掉，Isaac 说了声「Sure」又开了电视。三周后家人
//   还是没见过，作者每晚关着门对着衣柜数数，昨晚到五十 —— 数到四十左右，门外有个小声音跟着数。
// 选题理由：「学一样东西卡在平台期」是学生都有的体验；问题不是手，而是脚 —— 一个看得见、
//   说得清的原因，适合中级档出主观题。结局类型：没人看见的成功 + 温情尾巴。
// 与旧文的区别：Is This Yours?（魔术在才艺表演台上失手）、Sub-Twenty（比赛心态）、第七周
//   Ninety-Six Bars（演出夜成功）都落在「台上」；本篇不上台，成功恰恰只发生在没人看的时候，
//   当众表演反而失败。不是乐团 / 乐器。
// 数字自洽：第 6、8、10 天的记录；第十天放弃、第十一天贴胶带；接球数 5 → 9 → 15 → 31 → 50。

const WARDROBE = {
  key: 'original-w8-facing-the-wardrobe',
  title: 'Facing the Wardrobe',
  passage: numbered([
    "In our first physics lesson of the year, Mr Selvam juggled three oranges while he explained how things fall. They rose and fell in perfect curves, and he never once looked at his hands. 'Anyone can learn this in a week,' he said. I am famous for dropping things: phones, lunch trays, once a whole bowl of soup in the canteen. I decided to try anyway.",
    'That evening, I borrowed three tennis balls from my brother, Isaac, who is nine. A website told me to start with one ball, throwing it from hand to hand in a curve as high as my eyes. Then I tried two: throw, throw, catch, catch. The balls hit the lamp and rolled under the sofa, but after three days, I could do two without dropping them.',
    'Three balls were different. I could make three throws, sometimes four, and then all three balls hit the floor. I kept a list on the back of my bedroom door: Day 6, four catches. Day 8, four. Day 10, three. On the tenth night, I threw the balls into my cupboard and told Isaac that Mr Selvam was a liar.',
    "The next evening, Isaac stuck a piece of tape on the living-room floor, right in front of my toes. 'Just juggle,' he said. 'I'll watch your feet.' I juggled, dropped, picked the balls up and started again for twenty minutes. When I stopped, I was standing beside the front door, four big steps from the tape. I stared at it with my mouth open.",
    'That explained everything. Without noticing, I had been throwing each ball a little forward and then walking after it, until the balls were too far away to catch. So I tried something that sounded stupid. I stood facing my wardrobe, so close that my nose almost touched it. Now, if I threw a ball forward, it hit the wardrobe and came back.',
    'The first evening, the wardrobe got hit so often that my mother shouted from the kitchen to ask what was breaking. But by the end of the week, the balls were going straight up and coming straight down. Five catches. Then nine. Then fifteen.',
    "One Sunday night, alone in my room, I stopped thinking about my hands, and the balls just kept going. I counted out loud all the way to thirty-one. Then I ran into the living room, shouting. My parents put down their phones, and Isaac turned off the television. I threw the first ball and dropped the second. I tried again, and again, and my face grew hot. Isaac watched for a while, said, 'Sure,' and turned the television back on.",
    'That was three weeks ago, and my family still has not seen me do it. But every night, I juggle facing the wardrobe with my door closed, counting out loud. Last night I reached fifty. Somewhere around forty, I heard a small voice outside my door, counting with me.',
  ]),
  questions: [
    {
      kind: 'matchingFeelings',
      bank: ['determined', 'astonished', 'embarrassed', 'touched', 'jealous', 'terrified', 'guilty', 'suspicious'],
      items: [
        { moment: 'Paragraph 1 — deciding to try juggling anyway', answer: 'determined', para: 1 },
        { moment: 'Paragraph 4 — staring at the tape from beside the front door', answer: 'astonished', para: 4 },
        { moment: "Paragraph 7 — when the writer's face grows hot in the living room", answer: 'embarrassed', para: 7 },
        { moment: 'Paragraph 8 — hearing a small voice counting outside the door', answer: 'touched', para: 8 },
      ],
    },
    {
      kind: 'mcq',
      stem: "In Paragraph 7, what does Isaac's 'Sure' suggest?",
      answer: 'He did not believe the writer had done it.',
      distractors: [
        'He was sure the writer would do it next time.',
        'He wanted to learn to juggle as well.',
        'He agreed to count the catches out loud.',
      ],
      evidence: "Isaac watched for a while, said, 'Sure,' and turned the television back on.",
    },
    {
      kind: 'gapChoice',
      stem: 'On the first evening of practising in front of the wardrobe, the writer\'s mother shouted from the ______.',
      answer: 'kitchen',
      distractors: ['bedroom', 'balcony', 'corridor'],
      evidence:
        'The first evening, the wardrobe got hit so often that my mother shouted from the kitchen to ask what was breaking.',
    },
    {
      kind: 'short',
      marks: 2,
      stem: 'According to Paragraph 1, what did Mr Selvam do in the first physics lesson, and what did he say?',
      answer:
        'He juggled three oranges while explaining how things fall, without once looking at his hands; he said that anyone can learn to juggle in a week.',
      evidence: "'Anyone can learn this in a week,' he said.",
      rubric:
        '两分：写出「他一边讲东西怎么落下，一边抛三个橙子（眼睛没看手）」给 1 分（写出「抛 / 耍三个橙子」即可）；写出他说的话「谁都能在一周内学会」再给 1 分（没写「一周」不给这 1 分）。写「作者出了名爱掉东西」不给分 —— 那是作者，不是老师。',
    },
    {
      kind: 'short',
      marks: 2,
      stem: 'According to Paragraph 2, what TWO stages did the writer practise before trying three balls?',
      answer:
        'First one ball, thrown from hand to hand in a curve as high as the eyes; then two balls — throw, throw, catch, catch.',
      evidence: 'Then I tried two: throw, throw, catch, catch.',
      rubric:
        '两分：写出第一步「先练一个球，从一只手抛到另一只手，弧线抛到眼睛那么高」给 1 分（写出「先练一个球」即可）；写出第二步「再练两个球：抛、抛、接、接」再给 1 分（写出「再练两个球」即可）。写「球砸到台灯、滚到沙发底下」不给分 —— 那是练的时候出的事，不是练习的步骤。',
    },
    {
      kind: 'short',
      marks: 2,
      stem: 'According to Paragraph 4, how did Isaac help the writer, and what did they find out?',
      answer:
        "He stuck a piece of tape on the floor in front of the writer's toes and watched the writer's feet; after twenty minutes, the writer was standing beside the front door, four big steps from the tape.",
      evidence: 'When I stopped, I was standing beside the front door, four big steps from the tape.',
      rubric:
        '两分：写出「Isaac 在作者脚尖前的地上贴了一条胶带，盯着作者的脚」给 1 分（写出「贴胶带」或「看作者的脚」即可）；写出发现「二十分钟后作者已经走到大门边，离胶带四大步 —— 作者一边抛一边在往前走」再给 1 分。写「作者在往前抛球」可以算第二分的合理变体（那是第 5 段的解释，意思对就给）。',
    },
    {
      kind: 'short',
      marks: 2,
      stem: 'Using your own words, explain how standing facing the wardrobe helped the writer (Paragraphs 5–6).',
      answer:
        'Standing very close to the wardrobe meant that any ball thrown forward hit it and came back, so the writer learned to throw the balls straight up and catch them coming straight down; the number of catches rose to five, nine and fifteen.',
      evidence: 'Now, if I threw a ball forward, it hit the wardrobe and came back.',
      rubric:
        '两分：写出「离衣柜很近，球一往前抛就撞到柜子弹回来（所以不能再往前抛 / 不会追着球走）」给 1 分；写出结果「球变成直上直下，接住的次数多了（五、九、十五下）」再给 1 分。只写「作者把鼻子贴着衣柜站」不给分 —— 要说出这样站为什么有用；写「妈妈在厨房里喊」不给分。',
    },
  ],
};

// ═══════════════════════════════════════════════════════════════
// 周三 —— Nothing That Ticks　　徽章：culture
// ═══════════════════════════════════════════════════════════════
//
// 梗概：同桌 Kai Xuan 的爷爷八十大寿，作者是唯一不是亲戚的客人。听说爷爷一辈子没迟到过（去机场
//   早三小时、喝喜酒比厨师到得还早），作者花掉大半积蓄买了一座金色表盘的木钟，包上红纸。寿宴上
//   小表弟妹抢着拆开、把钟高高举起，整桌安静，一位阿姨放下筷子。Kai Xuan 在走廊里解释：华语里
//   「送钟」和「送终」同音。爷爷把作者叫回去，往作者手里塞了一枚一毛钱硬币，大声说「现在这钟是
//   我跟你买的，不是礼物了」，阿姨笑着拿回筷子。回家后妈妈提起 Kai Xuan 第一次来过屠妖节时用
//   左手给奶奶递糖，奶奶笑着接了 ——「每个家都有没人写下来的规矩」。一毛钱放在作者笔袋里；
//   爷爷八十一岁的请柬底下手写一行：Please come. Bring nothing that ticks.
// 选题理由：不同文化的人相处，最常见的不是语言不通，而是「没人告诉你的规矩」；两边各有一次
//   失礼、各有一次大度，比单向「学别人的文化」更平衡。结局类型：把禁忌变成玩笑。
// 与旧文的区别：第七周 To the End of the Line 是接待日本交换生、靠坐地铁找到共同话题；olevel
//   The Longest Day 是陪朋友斋戒；旧题库 The Red Packet 是贪红包、The Paper Lantern 是中秋提灯。
//   本篇是送礼的禁忌和化解，不是交换生、不是节日习俗介绍、不是坐地铁。
// 数字自洽：三月做八十大寿，「上周」收到八十一岁的请柬（时间写得含糊，不点明月份）；
//   八张桌子；一毛钱硬币前后一致。

const TICKS = {
  key: 'original-w8-nothing-that-ticks',
  title: 'Nothing That Ticks',
  passage: numbered([
    "Kai Xuan has sat next to me since Secondary One. In March, her grandfather turned eighty, and her family booked eight tables at a restaurant for the party. I was the only guest who was not a relative. 'Don't bring anything,' Kai Xuan said. My mother, who has never visited anyone with empty hands, said that people always say that.",
    'I thought hard about the present. Kai Xuan often joked that her grandfather had never been late for anything in his life. He reached airports three hours early and weddings before the cooks. So I spent most of my savings on a small wooden clock with a gold face, and I wrapped it in shiny red paper. It was perfect, I thought.',
    "The restaurant was loud and warm. There were plates of peach-shaped buns on every table, and relatives handed her grandfather red packets one after another. When it was my turn, two of Kai Xuan's little cousins pulled the paper off my present before anyone could stop them. One of them held the clock up high for everyone to see.",
    "The table went quiet. An aunt put down her chopsticks. Somebody whispered something in a language I did not understand, and Kai Xuan's face went pale. I looked from face to face, trying to work out what had happened.",
    "Kai Xuan pulled me out into the corridor. In Chinese, she explained, the words for 'giving a clock' sound exactly like the words for saying goodbye to someone who is dying. 'At a birthday,' she said gently, 'it's about the worst present there is.' I wanted to go straight home and never see any of her relatives again.",
    "When we went back in, her grandfather waved me over. He took a ten-cent coin from his pocket and pressed it into my hand. 'There,' he said, loudly enough for the whole table to hear. 'Now I have bought this clock from you. It is not a present any more, so nobody needs to worry.' The aunt laughed and picked up her chopsticks, and I could breathe again.",
    "That night, I told my mother everything. She laughed, and then she reminded me that when Kai Xuan first visited us at Deepavali, she had handed my grandmother a plate of sweets with her left hand. In our family, you always give and take things with your right hand. My grandmother had just smiled and taken the plate. 'Every family has rules that nobody writes down,' my mother said.",
    "The ten-cent coin now lives in my pencil case. Kai Xuan says the clock hangs in her grandfather's living room, and he tells the story to every visitor. Last week, an invitation arrived for his eighty-first birthday. At the bottom, in his own shaky handwriting, he had added: 'Please come. Bring nothing that ticks.'",
  ]),
  questions: [
    {
      kind: 'matchingFeelings',
      bank: ['confident', 'puzzled', 'ashamed', 'relieved', 'furious', 'jealous', 'bored', 'excited'],
      items: [
        { moment: 'Paragraph 2 — wrapping the clock in shiny red paper', answer: 'confident', para: 2 },
        { moment: 'Paragraph 4 — looking from face to face at the quiet table', answer: 'puzzled', para: 4 },
        { moment: 'Paragraph 5 — wishing to go straight home from the corridor', answer: 'ashamed', para: 5 },
        { moment: 'Paragraph 6 — when the aunt laughs and picks up her chopsticks', answer: 'relieved', para: 6 },
      ],
    },
    {
      kind: 'mcq',
      stem: "In Paragraph 7, what does the mother mean by 'Every family has rules that nobody writes down'?",
      answer: 'Families have customs that people learn just by living with them.',
      distractors: [
        'Families should write their rules down on paper.',
        "The writer's family has more rules than most families.",
        "Kai Xuan's family did not follow its own rules.",
      ],
      evidence: "'Every family has rules that nobody writes down,' my mother said.",
    },
    {
      kind: 'gapChoice',
      stem: 'At the restaurant, there were plates of peach-shaped ______ on every table.',
      answer: 'buns',
      distractors: ['cakes', 'sweets', 'oranges'],
      evidence:
        'There were plates of peach-shaped buns on every table, and relatives handed her grandfather red packets one after another.',
    },
    {
      kind: 'short',
      marks: 2,
      stem: "According to Paragraph 2, what present did the writer choose for Kai Xuan's grandfather, and why?",
      answer:
        'A small wooden clock with a gold face; Kai Xuan often joked that her grandfather had never been late for anything — he reached airports three hours early and weddings before the cooks.',
      evidence: 'Kai Xuan often joked that her grandfather had never been late for anything in his life.',
      rubric:
        '两分：写出「一座金色表盘的小木钟」给 1 分（写出「钟」即可）；写出原因「Kai Xuan 常开玩笑说爷爷一辈子没迟到过（去机场早三小时、喝喜酒比厨师还早）」再给 1 分（写出「他从不迟到 / 总是很早到」即可）。写「作者花了大半积蓄」「用红纸包」不给第二分 —— 那是怎么买、怎么包，不是为什么选钟。',
    },
    {
      kind: 'short',
      marks: 2,
      stem: "According to Paragraph 5, what did Kai Xuan explain about 'giving a clock'?",
      answer:
        "In Chinese, the words for 'giving a clock' sound exactly like the words for saying goodbye to someone who is dying, so at a birthday it is about the worst present there is.",
      evidence:
        "In Chinese, she explained, the words for 'giving a clock' sound exactly like the words for saying goodbye to someone who is dying.",
      rubric:
        '两分：写出「华语里『送钟』听起来和『跟快死的人道别（送终）』完全一样」给 1 分（写出「和死 / 临终有关的话同音」即可）；写出「所以在生日 / 寿宴上，这几乎是最糟的礼物」再给 1 分。只写「送钟不吉利」、没写出为什么不给第一分。',
    },
    {
      kind: 'short',
      marks: 2,
      stem: "According to Paragraph 6, what did Kai Xuan's grandfather give the writer, and what did he say it meant?",
      answer:
        'He pressed a ten-cent coin into the writer\'s hand and said that he had now bought the clock, so it was not a present any more and nobody needed to worry.',
      evidence: "'Now I have bought this clock from you. It is not a present any more, so nobody needs to worry.'",
      rubric:
        '两分：写出「他把一枚一毛钱硬币塞到作者手里」给 1 分（写出「一枚硬币」即可）；写出他说的意思「现在钟是他跟作者买的，不再是礼物，大家不用担心」再给 1 分（写出「变成买的、不是送的」即可）。写「阿姨笑了、拿起筷子」不给分 —— 那是别人的反应，不是爷爷说的话。',
    },
    {
      kind: 'short',
      marks: 2,
      stem: "According to Paragraph 7, what mistake had Kai Xuan once made at the writer's home, and how did the writer's grandmother react?",
      answer:
        "At Deepavali, Kai Xuan handed the writer's grandmother a plate of sweets with her left hand; the grandmother just smiled and took the plate.",
      evidence: 'My grandmother had just smiled and taken the plate.',
      rubric:
        '两分：写出「屠妖节去作者家时，Kai Xuan 用左手给奶奶递了一盘糖」给 1 分（要写出「用左手递」；只写「在我们家要用右手递东西」不给这 1 分 —— 那是规矩，不是她做错的事）；写出「奶奶只是笑笑，把盘子接了」再给 1 分（写「奶奶没有怪她」也给）。',
    },
  ],
};

// ═══════════════════════════════════════════════════════════════
// 周四 —— The Most Boring Bridge　　徽章：history
// ═══════════════════════════════════════════════════════════════
//
// 梗概：历史课要找「家附近五百米内一个地方的故事」，作者挑了家门口横跨六车道的天桥 —— 因为
//   它最无聊，以为一个下午就能写完。老师给的旧报纸网站上搜路名，搜出 1995 年一篇短报道
//   「Pupils Get Their Bridge」：对面小学的学生每天要横穿六条车道去车站，一个男孩差点被罗厘
//   撞到后，一班十一岁的孩子收集了两百个签名写信给报社，一年后桥就建起来了。网站只显示开头，
//   作者周六一早等在图书馆门口；照片下五个名字的第三个是 Ong Kah Wai —— 爸爸的名字，耳朵和
//   一只脚外撇的站姿都对得上。晚饭时爸爸说「我全忘了」，妈妈念出报上他那句「We are tired of
//   running」，爸爸捂住脸。他慢慢想起来：信先用铅笔写、因为拼写被老师罚抄三遍，在车站拦等车的人
//   签名，「多数人签名只是想让我们走开」。作者第一次在桥中间停下往下看，想告诉每个路人这是爸爸的
//   桥。爸爸还说「没什么，就一封信」，上周日走到桥中间，却停下来拍了张照。
// 选题理由：历史不只在博物馆 —— 最不起眼的东西也有来历，而且离自己很近；用一手材料（旧报纸）
//   发现，正是历史课教的方法。结局类型：平凡之物的来历 + 嘴硬的爸爸。
// 与旧文的区别：不是祖辈的旧物件（没有铁盒、旧信、旧照片被翻出来；报纸是公开档案），不是
//   How They Met 那种「各说各的」，也不是 The Question Jar 饭桌问答；olevel 的 The Bus Stop Garden
//   是居民在车站种花，本篇的车站只是背景。
// 数字自洽：1995 年报道、爸爸当时 11 岁，到 2026 年是三十一年前；作者过这座桥「四年」（中三学生，
//   小学最后两年起就自己上学，说得通）；六车道前后一致；两百个签名、一年后建成。

const BRIDGE = {
  key: 'original-w8-most-boring-bridge',
  title: 'The Most Boring Bridge',
  passage: numbered([
    'For history this term, Ms Varghese gave us an unusual project: find the story of one place within five hundred metres of your home. Near my flat, there is a petrol station, a car park and an overhead bridge across a six-lane road. I chose the bridge because it was the most boring of the three, and I expected to finish the project in one afternoon.',
    "Ms Varghese had shown us a website where you can search old Singapore newspapers. I typed in the name of our road, expecting nothing. Instead, I found a short article from 1995 called 'Pupils Get Their Bridge', with a small grey photo of five children holding a sign. The website showed only the first few lines. On Saturday morning, I was waiting outside the library before it opened.",
    'The full article explained everything. Pupils from the primary school beside the road used to run across all six lanes to reach the bus stop, because the nearest traffic lights were far away. After a boy was nearly hit by a lorry, one class of eleven-year-olds collected two hundred signatures and wrote to the newspaper. The bridge was built a year later.',
    "Under the photo were the names of the five children. The third name was Ong Kah Wai. That is my father's name. I made the photo bigger on the screen until it was just grey squares, then smaller again. The boy in the middle had my father's ears and his way of standing, with one foot turned out. I sat there without moving until the librarian asked if I was all right.",
    "At dinner, I put a printed copy next to my father's plate. He looked at it for a long time. 'I'd forgotten all about this,' he said at last. My mother read out the words the newspaper had printed next to his name: 'We are tired of running.' My father covered his face with his hands, and I grinned so widely that my cheeks hurt.",
    "Slowly, he began to remember. The class had written the letter in pencil first, and their teacher had made them copy it out three times because of the spelling. For a week, they had stood at the bus stop every morning, asking people waiting for buses to sign. 'Most people signed just to make us go away,' he said.",
    "I have crossed that bridge almost every day for four years without once looking at it. On Monday, I stopped halfway and looked down at the cars rushing along all six lanes. Somewhere down there, thirty-one years ago, my father had run across with his school bag bouncing on his back. I had a sudden, silly wish to tell every stranger walking past that this was my father's bridge.",
    'Ms Varghese put the article up on our classroom wall. My father still says it was nothing, just a letter. But last Sunday, when we crossed it together, he stopped halfway, took out his phone and took a photo of the road underneath.',
  ]),
  questions: [
    {
      kind: 'matchingFeelings',
      bank: ['curious', 'shocked', 'amused', 'proud', 'jealous', 'furious', 'guilty', 'bored'],
      items: [
        { moment: 'Paragraph 2 — waiting outside the library before it opened', answer: 'curious', para: 2 },
        { moment: 'Paragraph 4 — sitting without moving in front of the screen', answer: 'shocked', para: 4 },
        { moment: 'Paragraph 5 — grinning at how embarrassed the father looks as he covers his face', answer: 'amused', para: 5 },
        { moment: 'Paragraph 7 — wanting to tell every stranger about the bridge', answer: 'proud', para: 7 },
      ],
    },
    {
      kind: 'mcq',
      stem: "In Paragraph 6, what does the father mean by 'Most people signed just to make us go away'?",
      answer: 'Many adults signed without really caring about the bridge.',
      distractors: [
        'Most adults refused to sign the letter at all.',
        'People were angry that the children blocked the road.',
        'People wanted the children to go back to school.',
      ],
      evidence: "'Most people signed just to make us go away,' he said.",
    },
    {
      kind: 'gapChoice',
      stem: 'The pupils wrote their letter after a boy was nearly hit by a ______.',
      answer: 'lorry',
      distractors: ['bus', 'car', 'bicycle'],
      evidence:
        'After a boy was nearly hit by a lorry, one class of eleven-year-olds collected two hundred signatures and wrote to the newspaper.',
    },
    {
      kind: 'short',
      marks: 2,
      stem: 'According to Paragraph 1, what did the history project ask students to do, and why did the writer choose the bridge?',
      answer:
        'To find the story of one place within five hundred metres of their homes; the writer chose the bridge because it was the most boring of the three places nearby and expected to finish in one afternoon.',
      evidence: 'I chose the bridge because it was the most boring of the three, and I expected to finish the project in one afternoon.',
      rubric:
        '两分：写出「找家附近五百米以内一个地方的故事」给 1 分（没写出「家附近」的意思不给这 1 分）；写出「因为桥是三样里最无聊的，作者以为一个下午就能做完」再给 1 分（写出「最无聊」或「想快点做完」任一即可）。写「家附近有加油站、停车场和天桥」不给第二分 —— 那是有哪些选择，不是为什么选桥。',
    },
    {
      kind: 'short',
      marks: 2,
      stem: 'According to Paragraph 3, why did the pupils need a bridge, and what did they do to get one?',
      answer:
        'They had to run across all six lanes to reach the bus stop because the nearest traffic lights were far away (and a boy was nearly hit by a lorry); a class of eleven-year-olds collected two hundred signatures and wrote to the newspaper.',
      evidence:
        'Pupils from the primary school beside the road used to run across all six lanes to reach the bus stop, because the nearest traffic lights were far away.',
      rubric:
        '两分：写出原因「学生要横穿六条车道去车站，最近的红绿灯太远」给 1 分（写「一个男孩差点被罗厘撞到」也给这 1 分）；写出做法「一班十一岁的学生收集了两百个签名，写信给报社」再给 1 分（写出「收集签名」或「写信给报社」任一即可）。写「一年后桥建好了」不给第二分 —— 那是结果，不是他们做的事。',
    },
    {
      kind: 'short',
      marks: 2,
      stem: 'According to Paragraph 4, give TWO things that showed the writer that one of the children was the father.',
      answer:
        "The third name under the photo was Ong Kah Wai, the father's name; the boy in the middle had the father's ears; he stood like the father, with one foot turned out (any two).",
      evidence: "The boy in the middle had my father's ears and his way of standing, with one foot turned out.",
      rubric:
        '两分：任答两点，每点 1 分：① 照片下第三个名字 Ong Kah Wai 就是爸爸的名字；② 中间那个男孩的耳朵和爸爸一样；③ 他站的姿势和爸爸一样，一只脚往外撇。写「作者把照片放大到只剩灰色方块」不给分 —— 那是作者做的事，不是认出爸爸的依据。',
    },
    {
      kind: 'short',
      marks: 2,
      stem: 'According to Paragraph 8, what does the father still say about the bridge, and what did he do last Sunday?',
      answer:
        'He still says that it was nothing, just a letter; last Sunday he stopped halfway across the bridge, took out his phone and took a photo of the road underneath.',
      evidence: 'But last Sunday, when we crossed it together, he stopped halfway, took out his phone and took a photo of the road underneath.',
      rubric:
        '两分：写出「他还是说那没什么，只是一封信」给 1 分；写出「上周日走到桥中间停下来，拿出手机拍了一张桥下马路的照片」再给 1 分（写出「在桥上拍照」即可）。写「老师把报道贴在教室墙上」不给分 —— 那不是爸爸说的或做的。',
    },
  ],
};

// ═══════════════════════════════════════════════════════════════
// 周五 —— The Prize Money　　徽章：community
// ═══════════════════════════════════════════════════════════════
//
// 梗概：全班第一次拿到「最干净课室」奖，奖金一百五十元；班主任 Mr Bala 定了规矩：三十五个人
//   全都同意才花一分钱。大多数人要开披萨派对，作者却知道全班只在检查那一周认真打扫过，平时都是
//   清洁工 Mdm Kwek 收拾（作者见过她跪着用刀刮椅子腿上的口香糖），于是提议把钱给她。全班炸开：
//   Darius 说她本来就领工资，也有人说奖是我们挣的；平时很少说话的 Elaine 说她妈妈晚上打扫办公室，
//   要是一群孩子塞给她一信封钱，她会难受 —— 会觉得人家可怜她。作者从没想到这一层。一周三百多条
//   群消息谈不拢，作者关机塞到枕头下。Elaine 说「那就去问她本人」。两人在楼梯边储物间找到 Mdm Kwek；
//   她笑着说不能收学生的钱，只求一件事：别的班周五都把椅子翻到桌上方便她冲地，就你们班从来不翻。
//   星期一全班两分钟就同意：披萨，外加每周五翻椅子；最大一块披萨留给她，她包起来带回去给孙子。
//   三个月后，每周五一点半，三十五把椅子十一秒翻上桌。
// 选题理由：集体里的分歧，好心的提议也会被另一种好心挡住（Elaine 的话）；解决办法不是投票，
//   而是去问当事人 —— 答案出乎所有人意料。结局类型：意外的请求。
// 与旧文的区别：第七周 The Deciding Vote 是选举、平票、关键一票；本篇没有投票，规矩是「全体同意」，
//   转折来自当事人本人。ielts_simplified 的 The Umbrella / The Early Alarm 写的是「认识清洁工 /
//   保安这个人」；本篇写的是全班怎么做决定。The Cheapest Thing on the Menu 是朋友迁就囊中羞涩的人，
//   也不是这个骨架。
// 数字自洽：一百五十元；全班三十五人（第 1、8 段一致）；吵了一周（周三晚作者关机，周五去问，
//   下周一定案）；三个月后。

const PRIZE = {
  key: 'original-w8-prize-money',
  title: 'The Prize Money',
  passage: numbered([
    'In August, our class won the school\'s Cleanest Classroom competition for the first time. The prize was a hundred and fifty dollars. Our form teacher, Mr Bala, said that the money belonged to us, but he had one rule: he would not spend a single cent until all thirty-five of us agreed on how to use it.',
    'Most people wanted a pizza party. Within a minute, Darius had written a list of toppings on the whiteboard, and half the class was arguing about pineapple. I kept quiet, because I knew something that made the prize feel strange. We had cleaned properly for exactly one week: the week of the inspections.',
    'Every other afternoon, it was Mdm Kwek who cleaned up after us. Once, when I stayed late, I had seen her on her knees, scraping old chewing gum off the legs of our chairs with a knife. So when Mr Bala asked for other ideas, I put up my hand and said that we should give the money to Mdm Kwek.',
    "For a moment, nobody spoke. Then Darius said that she was already paid to clean. Someone else said that it was our prize, and we had earned it. Then Elaine, who hardly ever speaks in class, said quietly that her mother cleans offices at night. 'If a group of kids gave her an envelope of money, she would hate it,' she said. 'She would feel that they were sorry for her.' I turned round in my seat to stare at her. I had never heard her say so much.",
    'For a week, we could not agree. Our class chat filled up with more than three hundred messages, and every one seemed to make things worse. Some people wanted to split the money. Some stopped replying. On Wednesday night, I switched off my phone and pushed it under my pillow.',
    "In the end, Elaine said the obvious thing: 'Why don't we just ask her?' After school on Friday, the two of us found Mdm Kwek in the small storeroom by the stairs, filling her bucket. My heart was beating fast as I knocked on the open door, and I explained about the prize very badly.",
    "Mdm Kwek laughed and shook her head. She could not take money from students, she said, and anyway, it was our prize. Then she thought for a moment. 'But you can do one thing for me,' she said. 'On Friday afternoons, every other class puts their chairs up on the desks, so I can wash the floor. Your class never does.' My face went red, and Elaine stared hard at the floor.",
    'On Monday, the class agreed in less than two minutes: pizza, and chairs up every Friday. At the party, we saved the biggest slice for Mdm Kwek, and she wrapped it in a napkin to take home to her grandson. That was three months ago. Every Friday at half past one, thirty-five chairs go up onto thirty-five desks. It takes us eleven seconds.',
  ]),
  questions: [
    {
      kind: 'matchingFeelings',
      bank: ['surprised', 'frustrated', 'nervous', 'embarrassed', 'jealous', 'lonely', 'proud', 'delighted'],
      items: [
        { moment: 'Paragraph 4 — turning round in the seat to stare at Elaine', answer: 'surprised', para: 4 },
        { moment: 'Paragraph 5 — pushing the phone under the pillow on Wednesday night', answer: 'frustrated', para: 5 },
        { moment: "Paragraph 6 — knocking on the storeroom's open door", answer: 'nervous', para: 6 },
        { moment: 'Paragraph 7 — going red in the storeroom', answer: 'embarrassed', para: 7 },
      ],
    },
    {
      kind: 'mcq',
      stem: "In Paragraph 8, what does 'It takes us eleven seconds' suggest?",
      answer: 'Putting the chairs up has become a quick, easy habit.',
      distractors: [
        'The class is trying to win another prize.',
        'Mdm Kwek checks the time every Friday.',
        'Mr Bala gives the class a reward for speed.',
      ],
      evidence: 'Every Friday at half past one, thirty-five chairs go up onto thirty-five desks. It takes us eleven seconds.',
    },
    {
      kind: 'gapChoice',
      stem: 'The writer had once seen Mdm Kwek scraping old chewing gum off the legs of the chairs with a ______.',
      answer: 'knife',
      distractors: ['spoon', 'brush', 'ruler'],
      evidence:
        'Once, when I stayed late, I had seen her on her knees, scraping old chewing gum off the legs of our chairs with a knife.',
    },
    {
      kind: 'short',
      marks: 2,
      stem: "According to Paragraph 1, what did the class win, and what was Mr Bala's rule about the money?",
      answer:
        "A hundred and fifty dollars, for winning the school's Cleanest Classroom competition; he would not spend any of it until all thirty-five students agreed on how to use it.",
      evidence:
        'he would not spend a single cent until all thirty-five of us agreed on how to use it',
      rubric:
        '两分：写出「赢了学校『最干净课室』比赛，奖金一百五十元」给 1 分（写出「一百五十元」或「最干净课室奖」任一即可）；写出规矩「全班三十五个人都同意怎么用，他才肯花一分钱」再给 1 分（只写「钱归全班」不给这 1 分 —— 要写出「全体同意」）。',
    },
    {
      kind: 'short',
      marks: 2,
      stem: 'According to Paragraphs 2–3, why did the prize feel strange to the writer?',
      answer:
        'The class had cleaned properly for only one week, the week of the inspections; every other afternoon, it was Mdm Kwek who cleaned up after them.',
      evidence: 'Every other afternoon, it was Mdm Kwek who cleaned up after us.',
      rubric:
        '两分：写出「全班只在检查那一周认真打扫过」给 1 分；写出「其余每天下午都是 Mdm Kwek 在替他们收拾」再给 1 分（写「作者见过她跪着刮椅子上的口香糖」也给这 1 分）。写「大多数人想开披萨派对」不给分 —— 那不是奖让作者觉得奇怪的原因。',
    },
    {
      kind: 'short',
      marks: 2,
      stem: 'According to Paragraph 4, give TWO reasons that classmates gave against giving the money to Mdm Kwek.',
      answer:
        'She was already paid to clean; it was the class\'s prize and they had earned it; Elaine said that a cleaner would hate being given an envelope of money by kids, because she would feel that they were sorry for her (any two).',
      evidence: "'She would feel that they were sorry for her.'",
      rubric:
        '两分：任答两点，每点 1 分：① 她本来就有工资（Darius）；② 奖是全班的、是大家挣来的；③ Elaine：一群孩子塞给她一信封钱，她会很难受 / 会觉得人家可怜她。写「Elaine 的妈妈晚上打扫办公室」单独不给分 —— 要写出 Elaine 由此说出的理由。',
    },
    {
      kind: 'short',
      marks: 2,
      stem: 'According to Paragraph 7, what did Mdm Kwek say about the money, and what did she ask the class to do?',
      answer:
        'She said she could not take money from students and that it was their prize anyway; she asked them to put their chairs up on the desks on Friday afternoons so that she could wash the floor.',
      evidence:
        "'On Friday afternoons, every other class puts their chairs up on the desks, so I can wash the floor.",
      rubric:
        '两分：写出「她不能收学生的钱（而且那是他们自己的奖）」给 1 分（写出任一半即可）；写出「请全班每周五下午把椅子翻到桌上，好让她冲洗地板」再给 1 分（只写「帮她做一件事」不给这 1 分）。写「全班星期一两分钟就同意了」不给分 —— 那是后来的事。',
    },
  ],
};

const SPECS = [TRY_AGAIN, WARDROBE, TICKS, BRIDGE, PRIZE];

module.exports = {
  LEVEL,
  SPECS,
  DAYS: DATES.slice(0, SPECS.length).map((date, i) => buildAuthoredDay(SPECS[i], date)),
};
