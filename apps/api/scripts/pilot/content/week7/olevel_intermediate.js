/**
 * 第七周 —— **olevel_intermediate（O-Level 中级）**档，全原创。
 *
 * 四百词上下的记叙文，八段。形状与第四、五、六周这一档一致：
 *   4 道情绪配对（共用八个词的词库） · 1 道短语理解四选一 · 1 道原文填空 ·
 *   4 道两分主观题 —— 满分 14。
 *
 * 选题思路：第六周是运动校队 / 兄弟 / 做视频 / 网上两难 / 集体出游，这一周五天换成
 * 五个这一档还没写过的领域：
 *   音乐（学校管乐团，只有一下镲）/ 买卖（把自己攒了四年的漫画挂到二手网站上卖）/
 *   跨文化接待（日本交换生在家住一周）/ 居家推理（冰淇淋失窃案）/ 班级选举（关键一票）。
 * 结局刻意五种各不相同，也不和第六周（荒诞喜剧 / 角色互换 / 反讽 / 各执一词 / 反高潮）重样：
 *   干脆的胜利 / 苦乐参半的放手 / 首尾呼应 / 侦探就是「小偷」的喜剧反转 / 开放式（停在揭晓之前）。
 * 选题先对过内容包已发布的 161 篇（pack-titles-1007）和学生读过的标题（read-titles-0929 / 1007），
 * 再在 week2~week6 内容包和 test-fixtures 里 grep 过 cymbal / band / election / vote /
 * second-hand / manga / exchange student / sleepwalk 等关键词：没有同桥段、同骨架的旧文。
 * 也避开了旧题库的老套路（外公外婆的老物件、组屋邻居、熟食中心美食、生病去世）和
 * 前几周用过多次的「发现自己动机不纯」。
 *
 * 情绪配对的四个时刻挑「原文没有直接写出那个情绪词」的地方，每个时刻在本段内都有
 * 叙述者自己的反应（动作、表情、心里话）；每个词库避开盲做抓到过的相邻词对
 * （doubtful/astonished、surprised/disappointed、anxious/determined、anxious/nervous），
 * 也不把同一篇里另一段明显成立的情绪放进干扰项。
 *
 * 叙述者的性别五篇都没有写明，题干和参考答案一律用 the writer。
 */

'use strict';

const { buildAuthoredDay, numbered } = require('../authored');
const { DATES } = require('./dates');

const LEVEL = 'olevel_intermediate';

// ═══════════════════════════════════════════════════════════════
// 周一 —— Ninety-Six Bars
// ═══════════════════════════════════════════════════════════════
//
// 梗概：作者进了学校管乐团，只剩镲的位置，整首曲子九十六小节只在最后一小节响一下。
//   排练时数丢了拍，在长笛独奏里提前砸了一下，全团回头；打鼓的 Farah 教作者「别用脑子数，
//   用耳朵听」—— 听小号第三遍主旋律、等她的滚奏停。演出那晚又到了长笛独奏、全场安静，
//   心里冒出「就是现在」，作者闭眼听、硬是不动；等到小号第三遍、滚奏停下，一下砸准；
//   指挥像给独奏者那样请作者起立。
// 语义复核（10-07）：初稿演出夜写的是「谱子被风扇吹走 → 不知道到哪了 → 靠鼓声找回来」，
//   和旧题库 The Kompang（新手鼓手台上脑子空白、被师傅的鼓声带回来）、The Wayang（只有
//   一句台词、台上忘了被提词接上）是同一个高潮，改成「忍住」；鼓手原名 Priya 与 olevel
//   档 The Understudy 撞名，改为 Farah。
// 选题理由：音乐 / 乐团这一档从没写过；「整晚只有一个音」是学生一听就懂的反差，
//   失败 → 方法 → 真考验 → 成功的弧线干净，适合周一。
// 与旧文的区别：旧题库的音乐题（The Piano Upstairs 楼上琴声扰邻、The Kompang 组屋
//   马来鼓队）都不是学校乐团，也不是这个骨架；Sub-Twenty（比赛紧张）讲的是手速和心态，
//   这篇讲的是等待和倾听。结局类型：干脆的胜利（第六周没有）。
// 数字自洽：曲子 96 小节，前 95 小节休止，最后一小节一下镲；排练从第 61 小节重来
//   在长笛独奏之前，说得通；「三十四个人回头」只是乐团人数，不和别处冲突。

const BARS = {
  key: 'original-w7-ninety-six-bars',
  title: 'Ninety-Six Bars',
  passage: numbered([
    "I joined the school band in Secondary Two because my friend Joel was in it. The only empty place was at the back, so Mrs Goh, our conductor, handed me a pair of cymbals. 'The cymbals play only once,' she said. 'One crash, in the very last bar. Everything before that is waiting.' I had imagined myself crashing away all evening like a rock drummer. I looked down at the cymbals, and my shoulders dropped.",
    'The piece had ninety-six bars. For ninety-five of them, I sat on a stool at the back with the cymbals on my knees and counted. By bar forty, my mind had usually wandered off to dinner or homework, and I had to whisper to Farah, who played the big drums beside me, to ask where we were.',
    "Two weeks before the concert, I lost count in the quietest part, where one flute plays alone. Sure that we had reached the end, I stood up and crashed the cymbals together. The flute stopped. Thirty-four people turned round, and one of the trumpet players laughed so much that he had to put his trumpet down. Mrs Goh waited for silence and said only, 'Bar sixty-one, everyone.' I did not lift my eyes from the floor until the practice ended.",
    "Afterwards, Farah sat down next to me. 'Everybody loses count,' she said. 'Stop counting with your head and start listening.' Near the end, she explained, the trumpets play the main tune for the third time. Straight after that, she plays a long roll on her drum. 'When my roll stops,' she said, 'that's you.'",
    'For the next two weeks, I listened to a recording of the piece every night on the bus home, with my eyes closed. I still counted, but now I listened at the same time. Soon I could hum the flute part from memory.',
    "On the night of the concert, we reached the quiet part where the flute plays alone, the very place where I had crashed too early. The hall went silent, and a voice in my head whispered, 'Now.' My hands were so wet that the cymbals nearly slipped. Then I thought of the bus and closed my eyes. The flute was only halfway through its tune. I did not move.",
    "The trumpets played the tune once, and then again. When they began it a third time, I stood up quietly. Farah's roll grew louder and louder until the whole stage seemed to shake. I lifted the cymbals. The roll stopped. I crashed them together, and the sound filled the hall and hung in the air. Then the audience began to clap.",
    "While they were still clapping, Mrs Goh did something I had only seen conductors do for soloists: she pointed at the flute player, then at the trumpets, and then straight at me. I held my cymbals up high, and I could not stop grinning. Joel says that I am the only person in our band's history to stand up for one note. I tell him it was the hardest note in the piece.",
  ]),
  questions: [
    {
      kind: 'matchingFeelings',
      bank: ['disappointed', 'embarrassed', 'nervous', 'proud', 'jealous', 'curious', 'furious', 'lonely'],
      items: [
        { moment: 'Paragraph 1 — after Mrs Goh explains what the cymbals will play', answer: 'disappointed', para: 1 },
        { moment: 'Paragraph 3 — after crashing the cymbals during the flute part', answer: 'embarrassed', para: 3 },
        { moment: 'Paragraph 6 — when the hall goes silent during the flute part', answer: 'nervous', para: 6 },
        { moment: 'Paragraph 8 — when Mrs Goh points straight at the writer', answer: 'proud', para: 8 },
      ],
    },
    {
      kind: 'mcq',
      stem: 'In Paragraph 1, what does Mrs Goh mean by "Everything before that is waiting"?',
      answer: 'The cymbal player has nothing to play until the end.',
      distractors: [
        'The band must wait for the cymbals before starting.',
        'The audience will have to wait for the concert.',
        'The cymbals should be played softly at first.',
      ],
      evidence: "'One crash, in the very last bar. Everything before that is waiting.'",
    },
    {
      kind: 'gapChoice',
      stem: 'On the night of the concert, the hall went silent when the band reached the part where the ______ plays alone.',
      answer: 'flute',
      distractors: ['trumpet', 'drum', 'piano'],
      evidence:
        'On the night of the concert, we reached the quiet part where the flute plays alone, the very place where I had crashed too early.',
    },
    {
      kind: 'short',
      marks: 2,
      stem: 'According to Paragraph 3, how did one of the trumpet players and Mrs Goh each react when the writer crashed the cymbals too early?',
      answer:
        'The trumpet player laughed so much that he had to put his trumpet down; Mrs Goh simply waited for silence and then told everyone to start again from bar sixty-one.',
      evidence: "Mrs Goh waited for silence and said only, 'Bar sixty-one, everyone.'",
      rubric:
        '两分：写出「一个吹小号的笑得太厉害，只好把小号放下」给 1 分；写出「Mrs Goh 等大家安静下来，只说了一句『从第六十一小节开始』」再给 1 分（写出「等安静」或「让大家从第六十一小节重来」即可，写「她很平静、没有骂作者」也给这 1 分）。只写「三十四个人都转过头来」不给分 —— 题目问的是这两个人各自的反应。',
    },
    {
      kind: 'short',
      marks: 2,
      stem: 'According to Paragraph 4, what TWO sounds did Farah tell the writer to listen for near the end of the piece?',
      answer:
        "The trumpets playing the main tune for the third time, and then Farah's long drum roll — the crash comes when the roll stops.",
      evidence: 'Near the end, she explained, the trumpets play the main tune for the third time.',
      rubric:
        '两分：写出「小号第三次吹主旋律」给 1 分（只写「小号吹主旋律」、没写「第三次」不给这 1 分）；写出「Farah 打一段长长的滚奏，滚奏一停就该作者了」再给 1 分（只写「鼓的滚奏」或只写「滚奏停下」都给这 1 分）。写「别用脑子数，要用耳朵听」不给分 —— 那是她的建议，不是要听的声音。',
    },
    {
      kind: 'short',
      marks: 2,
      stem: 'Using your own words, explain how the writer practised for the concert in the last two weeks (Paragraph 5).',
      answer:
        'Every night, on the bus home, the writer listened to a recording of the piece with closed eyes, and kept counting while listening at the same time.',
      evidence:
        'For the next two weeks, I listened to a recording of the piece every night on the bus home, with my eyes closed.',
      rubric:
        '两分：写出「每天晚上坐车回家时，闭着眼睛听这首曲子的录音」给 1 分；写出「还在数拍子，但同时也在听（不再只靠数）」再给 1 分。写「后来能凭记忆哼出长笛的部分」不给分 —— 那是练习的结果，不是怎么练的。',
    },
    {
      kind: 'short',
      marks: 2,
      stem: 'According to Paragraph 8, what does Joel say about the writer, and how does the writer answer him?',
      answer:
        "Joel says that the writer is the only person in the band's history to stand up for one note; the writer answers that it was the hardest note in the piece.",
      evidence: "Joel says that I am the only person in our band's history to stand up for one note.",
      rubric:
        '两分：写出 Joel 的话「作者是乐队有史以来唯一一个只奏了一个音就起立的人」给 1 分；写出作者的回答「那是整首曲子里最难的一个音」再给 1 分。写「Mrs Goh 指着作者，请作者起立」不给分 —— 题目问的是 Joel 和作者之间的对话。',
    },
  ],
};

// ═══════════════════════════════════════════════════════════════
// 周二 —— Volume One
// ═══════════════════════════════════════════════════════════════
//
// 梗概：作者从小五开始攒一套五十二本的日本漫画，中三时为了凑新手机的另一半钱，挂到二手
//   网站卖一百五十元。一堆「还有吗？」之后，Mr Lim 礼貌地问书全不全、第一本新不新，不还价。
//   打包那晚作者留下了第一本，打算少收五块；见面时 Mr Lim 的儿子 Nathan 蹲在地铁站数书，
//   问「第一本呢？」—— 他要从头读。作者跑回家把第一本拿来，看他坐在地上翻开第一页。
//   如今书架上只剩一道灰，Mr Lim 发来 Nathan 抱着第三十八本睡着的照片。
// 选题理由：买卖 / 钱这一档只写过朋友间的花销（The Cheapest Thing on the Menu），没写过
//   自己当卖家；「舍不得」是学生都有的体验，结局不是皆大欢喜也不是后悔，是苦乐参半的放手。
// 与旧文的区别：旧题库的 The Second-Hand Textbook 是买二手书发现前主人的笔记、
//   The Uniform 是穿表哥的旧校服 —— 都是「接手旧物」；这篇是「放手自己的东西」。
//   不是外公外婆的老物件，也不涉及组屋邻居。网站只是挂卖的地方，重点在面对面交易。
// 数字自洽：小五到中三是四年，所以写「四年前在车上读的那一页」；挂价 150 元，
//   少一本打算收 145 元，最后 Mr Lim 照付 150 元；五十二本，留一本是五十一本。

const VOLUME_ONE = {
  key: 'original-w7-volume-one',
  title: 'Volume One',
  passage: numbered([
    'Since Primary Five, I had been collecting a Japanese comic series about a boy who wants to become the best cook in Tokyo. I bought the books one at a time with my pocket money, and by Secondary Three I had all fifty-two. They stood in order on the shelf above my bed. Then my parents said they would pay for half of a new phone if I paid the other half myself. I was a hundred and fifty dollars short.',
    "So I put the whole set on a second-hand website for a hundred and fifty dollars. Within an hour I had eleven messages. Most said only, 'Is this still available?', and when I answered, I never heard from them again. One person offered forty dollars. Another asked if I would sell volume thirty-seven by itself. By the evening, I was answering with one word, and then I turned my phone face down.",
    'The next morning, a man called Mr Lim wrote to me. He asked whether all the books were there and whether the first one was in good condition. He did not ask for a lower price. We agreed to meet at the MRT station near my flat on Saturday.',
    'On Friday night, I packed the books into two bags. Before each one went in, I read a page or two. At midnight, volume one was still in my hand. Fifty-one is still a lot of comics, I told myself. I would tell Mr Lim that the first book was not included and take five dollars less. I put it back on the shelf and switched off the light.',
    "Mr Lim came with his son, Nathan, who looked about nine. Nathan knelt on the station floor and took the books out one by one, counting under his breath. Then he looked up. 'Where's number one?' he asked. Mr Lim explained that the books were Nathan's birthday present. Nathan had watched the cartoon on television, and now he wanted to read the whole story from the very beginning.",
    'I said I wanted to keep the first book. Mr Lim said that was fair and began to count out a hundred and forty-five dollars. Nathan said nothing. He picked up volume two and stared at its cover. My face went hot, and I found that I could not look at him.',
    "'Wait here,' I said. I ran home, took volume one off the shelf and ran back. When I handed it to Nathan, he sat down on the floor and opened it at once. I watched him turn the first page, the same page I had read on a bus four years before, and my throat went tight.",
    'Mr Lim paid the full hundred and fifty dollars, although I told him he did not have to. That night, the shelf above my bed was empty except for a line of dust where the books had stood. I have my phone now. Last month, Mr Lim sent me a photo of Nathan asleep with volume thirty-eight open on his chest. I looked at it for a long time before I saved it.',
  ]),
  questions: [
    {
      kind: 'matchingFeelings',
      bank: ['frustrated', 'reluctant', 'guilty', 'touched', 'terrified', 'confident', 'curious', 'hopeful'],
      items: [
        { moment: 'Paragraph 2 — turning the phone face down in the evening', answer: 'frustrated', para: 2 },
        { moment: 'Paragraph 4 — still holding volume one at midnight', answer: 'reluctant', para: 4 },
        { moment: 'Paragraph 6 — while Nathan stares at the cover of volume two', answer: 'guilty', para: 6 },
        { moment: 'Paragraph 7 — watching Nathan turn the first page', answer: 'touched', para: 7 },
      ],
    },
    {
      kind: 'mcq',
      stem: 'In Paragraph 4, what does "Fifty-one is still a lot of comics, I told myself" suggest?',
      answer: 'The writer was trying to feel better about keeping one.',
      distractors: [
        'The writer thought Mr Lim would not notice.',
        'The writer had counted the books wrongly.',
        'The writer wanted to ask for a higher price.',
      ],
      evidence: 'Fifty-one is still a lot of comics, I told myself.',
    },
    {
      kind: 'gapChoice',
      stem: 'Nathan had watched the cartoon on ______.',
      answer: 'television',
      distractors: ['phone', 'website', 'bus'],
      evidence: 'Nathan had watched the cartoon on television, and now he wanted to read the whole story from the very beginning.',
    },
    {
      kind: 'short',
      marks: 2,
      stem: 'According to Paragraph 1, how had the writer collected the comics, and why did the writer suddenly need money?',
      answer:
        "The writer had bought the books one at a time with pocket money, starting in Primary Five; the writer's parents would pay for half of a new phone only if the writer paid the other half, and the writer was $150 short.",
      evidence: 'Then my parents said they would pay for half of a new phone if I paid the other half myself.',
      rubric:
        '两分：写出「从小五开始，用零花钱一本一本地买」给 1 分（写出「用零花钱」或「一本一本买」即可）；写出「父母只出新手机一半的钱，另一半要作者自己出，作者还差一百五十元」再给 1 分（写出「要凑买新手机的钱」即可）。只写「作者有全套五十二本」不给分 —— 那不是怎么攒的。',
    },
    {
      kind: 'short',
      marks: 2,
      stem: 'According to Paragraph 2, give TWO of the replies the writer received after putting the set online.',
      answer:
        "Most people only asked 'Is this still available?' and never wrote again; one person offered forty dollars; another wanted to buy volume thirty-seven by itself.",
      evidence: 'Another asked if I would sell volume thirty-seven by itself.',
      rubric:
        '两分：任答两点，每点 1 分：① 只问一句「还有吗？」，作者回了以后就再没消息；② 有人只出四十元；③ 有人只想单买第三十七本。只写「一小时内收到十一条消息」不给分 —— 那是数量，不是回复的内容。',
    },
    {
      kind: 'short',
      marks: 2,
      stem: 'According to Paragraph 5, why was Mr Lim buying the comics, and why did Nathan want volume one?',
      answer:
        'The comics were Nathan\'s birthday present; Nathan had watched the cartoon on television and wanted to read the whole story from the very beginning.',
      evidence: "Mr Lim explained that the books were Nathan's birthday present.",
      rubric:
        '两分：写出「这些书是给 Nathan 的生日礼物」给 1 分；写出「他在电视上看过这部动画，想从最开头把整个故事读一遍」再给 1 分（写出「想从头读」即可）。写「他跪在地上一本一本地数」不给分 —— 那是他做了什么，不是原因。',
    },
    {
      kind: 'short',
      marks: 2,
      stem: 'According to Paragraph 8, what was left on the shelf that night, and what did Mr Lim send the writer last month?',
      answer:
        'Only a line of dust where the books had stood; a photo of Nathan asleep with volume thirty-eight open on his chest.',
      evidence:
        'Last month, Mr Lim sent me a photo of Nathan asleep with volume thirty-eight open on his chest.',
      rubric:
        '两分：写出「书架上只剩一道灰，是书原来立着的地方」给 1 分；写出「Mr Lim 发来一张照片：Nathan 睡着了，第三十八本摊开在胸口」再给 1 分（写出「Nathan 看书看睡着的照片」即可）。写「作者现在有手机了」不给分。',
    },
  ],
};

// ═══════════════════════════════════════════════════════════════
// 周三 —— To the End of the Line
// ═══════════════════════════════════════════════════════════════
//
// 梗概：大阪来的交换生 Kenta 在作者家住一周。第一顿饭他对什么问题都答「Yes」（连「多要饭
//   还是少要饭」也是），之后全桌没人说话。翻译 app 把道谢说成「谢谢你美味的意外」，一家人
//   笑出声。原来他的小本子里全是火车，他来新加坡的心愿是把地铁每条线坐到终点；作者陪他坐，
//   在换乘站自信满满地带他下楼，却差点坐反方向 —— Kenta 对着站牌和本子摇头：每个站牌上都有
//   两个字母加一个数字的站点代码，一个方向数字变大、另一个方向变小，他全抄在本子里，作者
//   天天路过却从没读过；两人笑到旁人侧目。最后一顿饭又没人说话，
//   但不是同一种沉默；妈妈问他还会再来吗，他说「Yes」，又让手机补一句「这个 yes 是真的」。
//   两周后寄来一本蓝本子：作者站在每个终点站站牌下的照片，最后一页是大阪的线路清单，每条旁边空着日期。
// 选题理由：跨文化接待这一档没写过；语言不通 → 找到共同话题，是国际学校学生熟悉的场面。
// 与旧文的区别：olevel 档的 Heads or Tails 是双胞胎抢一个去京都交换的名额（出去），这篇是
//   接待（进来），骨架完全不同；不是 The Newcomer 那种新同学融入。结局类型：首尾呼应 ——
//   第一顿和最后一顿饭都是沉默、都是一句「Yes」，意思反过来了。
// 事实：新加坡地铁有几条线是无人驾驶（东北线、环线、滨海市区线、汤申—东海岸线），乘客能站在
//   车头窗前看隧道，文中只说「有几条线没有司机」，没点名。站牌上的站点代码（如 EW13、NS24）
//   是两个字母（线路）加数字，沿线按顺序编号 —— 新加坡陆交局 2001 年起使用的编号法，把握高。
//   时间线：第一顿饭 → 周三看本子 → 周四放学后和周六坐车 → 周六下午换乘站 → 周六晚最后一顿饭
//   → 第二天早上飞走，一周自洽。
// 语义复核（10-07）：初稿第 5–6 段写的是「车门把两人隔开、下一站找到他」，与基础档已发的
//   The Boy by the Gates（小孩被车门和妈妈隔开、下一站会合）是同一个桥段，改成带错方向。

const END_OF_LINE = {
  key: 'original-w7-end-of-the-line',
  title: 'To the End of the Line',
  passage: numbered([
    "In September, twenty students from Osaka spent a week at our school, staying with our families. Ours was Kenta, who carried a small blue notebook everywhere. At our first dinner, my mother asked if he was tired. 'Yes,' he said. She asked if he wanted more rice or less. 'Yes,' he said, and smiled politely. After that, nobody spoke for a long time. I wanted to say something, but every sentence I thought of sounded stupid.",
    "I tried a translation app. I spoke English into my phone, and it spoke Japanese to Kenta. He typed his answers, and it read them out in a flat voice. But when Kenta tried to thank my mother for dinner, the phone announced, 'Thank you for the delicious accident.' All three of us laughed until my father came to see what was wrong.",
    "On Wednesday, Kenta showed me his notebook. It was full of trains: numbers, colours, times and tiny drawings of the fronts of carriages. His list for Singapore was simple: our MRT. 'All lines,' he typed. 'To the end.' I take the MRT almost every day and have never once thought about it. I hid a yawn and said, 'Sure.'",
    'So on Thursday after school and all day Saturday, we rode trains. Some of our trains have no drivers, so Kenta stood at the front window, watching the tunnel rush towards him. At every last station, he took a photo of the sign and then a photo of me standing under it. Soon I was at the front window too.',
    'On Saturday afternoon, at a busy interchange, I led Kenta down to the platform without looking at a single sign. For once, I was the expert. At the bottom, Kenta opened his notebook, looked at the sign, then at his page, and shook his head politely. We were about to ride the wrong way.',
    'Then he showed me why. Every station sign has a short code, two letters and a number, and the numbers go up in one direction and down in the other. Kenta had copied them all into his notebook. I had walked past those codes for years and never once read them. Soon we were both laughing so hard that people stared.',
    "At our last dinner, nobody spoke for a long time again. But it was not the same silence. We were both too tired from the trains to talk, and nothing needed saying. Then my mother asked, 'Will you come back one day?' 'Yes,' he said. We all laughed, but he picked up his phone and typed. 'This yes,' said the flat voice, 'is a real one.'",
    'Two weeks after he flew home, a parcel arrived from Osaka. Inside was a blue notebook like his, full of photos of me under every last station sign. On the final page, he had written a list of train lines in Osaka, with an empty space beside each one for a date. I read it twice, then asked my mother how much a flight to Osaka cost.',
  ]),
  questions: [
    {
      kind: 'matchingFeelings',
      bank: ['awkward', 'confident', 'amused', 'excited', 'jealous', 'furious', 'frightened', 'lonely'],
      items: [
        { moment: 'Paragraph 1 — during the long silence at the first dinner', answer: 'awkward', para: 1 },
        { moment: 'Paragraph 5 — leading Kenta down to the platform without looking at the signs', answer: 'confident', para: 5 },
        { moment: 'Paragraph 6 — laughing with Kenta on the platform', answer: 'amused', para: 6 },
        { moment: 'Paragraph 8 — reading the list of train lines in Osaka', answer: 'excited', para: 8 },
      ],
    },
    {
      kind: 'mcq',
      stem: 'In Paragraph 7, what does "it was not the same silence" suggest?',
      answer: 'This time the quiet felt comfortable.',
      distractors: [
        'The family was angry with Kenta.',
        'The dinner was noisier than before.',
        "Kenta's phone had stopped working.",
      ],
      evidence: 'But it was not the same silence.',
    },
    {
      kind: 'gapChoice',
      stem: 'At every last station, Kenta took a photo of the ______ and then a photo of the writer.',
      answer: 'sign',
      distractors: ['train', 'tunnel', 'notebook'],
      evidence: 'At every last station, he took a photo of the sign and then a photo of me standing under it.',
    },
    {
      kind: 'short',
      marks: 2,
      stem: "According to Paragraph 2, how did the translation app work, and what went wrong when Kenta thanked the writer's mother?",
      answer:
        "The writer spoke English into the phone and it spoke Japanese to Kenta, while Kenta typed his answers and it read them out; when Kenta tried to thank the mother for dinner, it said 'Thank you for the delicious accident.'",
      evidence:
        "But when Kenta tried to thank my mother for dinner, the phone announced, 'Thank you for the delicious accident.'",
      rubric:
        '两分：写出用法「作者对手机说英语，手机说日语给 Kenta 听；Kenta 打字回答，手机读出来」给 1 分（写出其中一个方向即可）；写出出的错「Kenta 想谢谢妈妈做的晚饭，手机却说成『谢谢你美味的意外』」再给 1 分。写「三个人一直笑到爸爸出来看」不给分 —— 那是大家的反应，不是出的错。',
    },
    {
      kind: 'short',
      marks: 2,
      stem: "According to Paragraph 3, what was in Kenta's notebook, and what did he want to do in Singapore?",
      answer:
        'It was full of trains — numbers, colours, times and tiny drawings of the fronts of carriages; he wanted to ride every MRT line to the end.',
      evidence: 'It was full of trains: numbers, colours, times and tiny drawings of the fronts of carriages.',
      rubric:
        '两分：写出「本子里全是火车（编号、颜色、时间、车头的小画）」给 1 分（写出「火车」即可）；写出「他想把新加坡地铁的每一条线都坐到终点」再给 1 分（只写「坐地铁」、没写出「每条线」或「到终点」不给这 1 分）。',
    },
    {
      kind: 'short',
      marks: 2,
      stem: 'According to Paragraphs 5–6, what mistake did the writer nearly make at the interchange, and how did Kenta know?',
      answer:
        'The writer was about to take the train in the wrong direction; Kenta had copied all the station codes into his notebook and checked them against the sign, because the numbers go up in one direction and down in the other.',
      evidence: 'We were about to ride the wrong way.',
      rubric:
        '两分：写出「作者差点带着 Kenta 坐反方向」给 1 分；写出 Kenta 怎么知道的「他看了站牌、对照本子 —— 本子里抄了所有站的代码（两个字母加一个数字），一个方向数字变大、另一个方向变小」再给 1 分（写出「对照本子里的站点代码」即可）。写「作者从没读过这些代码」不给第二分 —— 那是作者的发现，不是 Kenta 怎么知道的。',
    },
    {
      kind: 'short',
      marks: 2,
      stem: 'According to Paragraph 8, what did the writer find in the parcel from Osaka?',
      answer:
        "A blue notebook like Kenta's, full of photos of the writer under every last station sign; on the final page, a list of train lines in Osaka with an empty space beside each one for a date.",
      evidence:
        'On the final page, he had written a list of train lines in Osaka, with an empty space beside each one for a date.',
      rubric:
        '两分：写出「一本和 Kenta 一样的蓝本子，里面是作者站在每个终点站站牌下的照片」给 1 分（写出「蓝本子」或「作者在终点站的照片」即可）；写出「最后一页是大阪的铁路线清单，每条旁边空着一格写日期」再给 1 分。写「作者问妈妈飞大阪要多少钱」不给分 —— 那不是包裹里的东西。',
    },
  ],
};

// ═══════════════════════════════════════════════════════════════
// 周四 —— Caught on Camera
// ═══════════════════════════════════════════════════════════════
//
// 梗概：家里规定一桶芒果冰淇淋吃一周、每人晚饭后一勺，可三月里连着三周到星期二就空了。
//   作者当起侦探：爸爸说在节食却半夜站在冰柜前，妹妹 Jia Hui 偷吃过整个蛋糕顶；早餐桌成了法庭。
//   作者偷偷把旧手机架在微波炉上对着冰柜录了一夜，第二天召集全家看录像：凌晨 2:47，一个穿睡衣
//   的人慢吞吞地走进来，抱着桶吃，吃完盖好盖、洗了勺、关灯走人 —— 是作者自己。妈妈说作者六岁
//   时就梦游过，还把鞋放进冰箱。如今冰淇淋藏在冻鱼后面、厨房门挂了铃，妹妹每周五拿走作者那一勺当封口费。
// 选题理由：轻松的推理喜剧，放在一周的第四天调节节奏；侦探就是「小偷」是一个干净的反转，
//   学生读到第 6 段会笑。
// 与旧文的区别：ielts_simplified 的 The Fish That Went Missing 是鱼躲进假山（东西没丢），
//   这篇是真被吃了、而且是查案的人自己吃的；不是「发现自己动机不纯」—— 作者是睡着了，
//   没有任何动机问题。家里只是场景，故事的骨架是推理，和第六周的兄弟模仿不同。
//   结局类型：喜剧反转（侦探就是小偷）。
// 数字自洽：每周五买一桶，三周都在周二吃空；周日晚上架手机，周一早上看录像；梦游没有
//   写成病，也没有医学说法，只是妈妈的一句回忆。

const CAMERA = {
  key: 'original-w7-caught-on-camera',
  title: 'Caught on Camera',
  passage: numbered([
    'Every Friday, my mother buys one big tub of mango ice cream, and it has to last the whole week. The rule is one scoop each after dinner, and there are four of us: my parents, my sister Jia Hui, who is twelve, and me. In March, something went wrong. Three weeks in a row, the tub was empty by Tuesday.',
    'I decided to find the thief. In the back of my maths exercise book, I made a list of everyone who could have done it. My father said he was on a diet, but I had seen him standing at the open freezer at ten o\'clock at night. Jia Hui had once eaten the whole top off a birthday cake when nobody was looking. Every morning there was a spoon in the sink. At breakfast, I watched my father over my cereal and wrote down everything he said.',
    'Breakfast soon became a courtroom. My father said that he had only been looking at the ice cream, not eating it. Jia Hui said I should be ashamed of myself for accusing my own sister. My mother said she did not care who it was, as long as it stopped. Nobody admitted anything.',
    'So on Sunday night, after everyone had gone to bed, I set up my old phone on top of the microwave, pointed it at the freezer and pressed record. I told no one, not even my mother. I went to bed smiling, already picturing the guilty face at breakfast.',
    'In the morning, the tub was nearly empty again. Before anyone could leave for school, I called everyone to the dining table and played the video. For a long time, nothing happened. Then, at 2.47 a.m., the kitchen light came on.',
    'A figure in pyjamas walked slowly into the picture, as if it were moving underwater. It opened the freezer, took out the tub and ate straight from it with a big spoon. Then it put the lid back on carefully, washed the spoon, switched off the light and walked out. It was me. My mouth fell open, and I played the video again, sure that the phone had made a mistake.',
    "Jia Hui laughed so hard that she slid off her chair. My father said, 'I told you it wasn't me,' about six times. Then my mother said quietly that I used to walk in my sleep when I was six, and that once she had found me putting my shoes in the fridge. I put my head down on the table and covered it with both arms.",
    'These days, the ice cream lives on the top shelf of the freezer, behind the frozen fish, and there is a small bell on the kitchen door. Jia Hui has kept the video. Every Friday, she takes my scoop as well as her own, and in return, she does not send the video to our cousins. It was the fastest case I have ever solved. I just wish I had liked the answer.',
  ]),
  questions: [
    {
      kind: 'matchingFeelings',
      bank: ['suspicious', 'confident', 'shocked', 'embarrassed', 'lonely', 'grateful', 'bored', 'jealous'],
      items: [
        { moment: 'Paragraph 2 — watching the father over breakfast', answer: 'suspicious', para: 2 },
        { moment: 'Paragraph 4 — going to bed after setting up the phone', answer: 'confident', para: 4 },
        { moment: 'Paragraph 6 — recognising the figure in the video', answer: 'shocked', para: 6 },
        { moment: "Paragraph 7 — after hearing the mother's story about the shoes", answer: 'embarrassed', para: 7 },
      ],
    },
    {
      kind: 'mcq',
      stem: 'In Paragraph 3, what does "Breakfast soon became a courtroom" suggest?',
      answer: 'Family members accused one another and defended themselves.',
      distractors: [
        'The family ate breakfast in complete silence.',
        'A judge was invited to the flat for breakfast.',
        'Everyone argued about who should cook breakfast.',
      ],
      evidence: 'Breakfast soon became a courtroom.',
    },
    {
      kind: 'gapChoice',
      stem: 'The writer set up the old phone on top of the ______.',
      answer: 'microwave',
      distractors: ['freezer', 'fridge', 'table'],
      evidence:
        'So on Sunday night, after everyone had gone to bed, I set up my old phone on top of the microwave, pointed it at the freezer and pressed record.',
    },
    {
      kind: 'short',
      marks: 2,
      stem: "According to Paragraph 1, what is the family's rule about the ice cream, and what kept happening in March?",
      answer:
        'Everyone has one scoop after dinner, so that one tub lasts the whole week; but three weeks in a row, the tub was empty by Tuesday.',
      evidence: 'Three weeks in a row, the tub was empty by Tuesday.',
      rubric:
        '两分：写出规矩「每人晚饭后一勺，一桶要吃一整个星期」给 1 分（写出「每人一勺」或「一桶吃一周」即可）；写出「三月里连着三个星期，到星期二桶就空了」再给 1 分。只写「妈妈每周五买一桶芒果冰淇淋」不给第一分 —— 那是买冰淇淋，不是吃的规矩。',
    },
    {
      kind: 'short',
      marks: 2,
      stem: 'According to Paragraph 2, why did the writer suspect the father, and why did the writer suspect Jia Hui?',
      answer:
        'The father said he was on a diet, but the writer had seen him standing at the open freezer at ten at night; Jia Hui had once eaten the whole top off a birthday cake when nobody was looking.',
      evidence: 'Jia Hui had once eaten the whole top off a birthday cake when nobody was looking.',
      rubric:
        '两分：写出怀疑爸爸的理由「他说在节食，作者却看见他晚上十点站在开着的冰柜前」给 1 分（写出「晚上十点站在开着的冰柜前」即可）；写出怀疑 Jia Hui 的理由「她以前趁没人看，把整个生日蛋糕的顶层吃掉了」再给 1 分。写「每天早上水槽里有一把勺子」不给分 —— 那是线索，不是怀疑某一个人的理由。',
    },
    {
      kind: 'short',
      marks: 2,
      stem: 'Give TWO things the figure in the video did after eating the ice cream (Paragraph 6).',
      answer: 'It put the lid back on carefully, washed the spoon, and switched off the light before walking out.',
      evidence: 'Then it put the lid back on carefully, washed the spoon, switched off the light and walked out.',
      rubric:
        '两分：任答两点，每点 1 分：① 小心地把盖子盖回去；② 把勺子洗了；③ 关了灯（走出去）。写「打开冰柜」「抱着桶直接用大勺子吃」不给分 —— 题目问的是吃完以后做的事。',
    },
    {
      kind: 'short',
      marks: 2,
      stem: 'According to Paragraph 8, what does Jia Hui take every Friday, and what does she agree not to do in return?',
      answer:
        "She takes the writer's scoop of ice cream as well as her own; in return, she does not send the video to their cousins.",
      evidence:
        'Every Friday, she takes my scoop as well as her own, and in return, she does not send the video to our cousins.',
      rubric:
        '两分：写出「每周五把作者那一勺也拿去吃（她吃两勺）」给 1 分；写出「作为交换，她不把录像发给表兄弟姐妹」再给 1 分。写「冰淇淋放到了冷冻层最上面、冻鱼后面」或「厨房门上挂了铃」不给分 —— 那是家里的改变，不是 Jia Hui 做的事。',
    },
  ],
};

// ═══════════════════════════════════════════════════════════════
// 周五 —— The Deciding Vote
// ═══════════════════════════════════════════════════════════════
//
// 梗概：班长七月转学，班上重选。候选人一个是作者从小二起的好朋友 Brandon（演讲最好笑，
//   许诺每学期办派对、课间放音乐，还发贴着「投 Brandon」的糖），一个是去年才来、课间独自
//   看书的 Wen Xin（念稿时手抖得纸哗哗响，三条主意：作业截止日公告板、值日表、给校务处写信修
//   后排从三月就坏了的风扇）。投票那天作者在外参加数学比赛，结果十七比十七，只剩作者一票。
//   一周里糖被塞进笔袋，Brandon 先发「没压力哈哈，你知道该怎么做」，一小时后又发「说真的，
//   投你觉得更好的那个」。作者意识到最后一票根本不是秘密 —— 谁赢，全班都知道是作者选的。
//   星期一在教师办公室写下名字、对折两次；走出来时两个人都在走廊看作者的脸。名字是谁，文章没说。
// 选题理由：班级选举这一档没写过；两边都写得有道理，让学生自己判断，结局类型是开放式。
// 与旧文的区别：olevel 档的 The Armband（足球队长袖标）是队长之位被质疑，不是投票；
//   The Leak 里出现过班长，只是嫌疑人之一。第六周 Forwarded Many Times 的结局是
//   「各执一词」（母子吵完没定论），这篇是作者自己做了决定、但读者不知道 —— 不同的收法。
// 数字自洽：十七比十七共三十四票，加上作者全班三十五人，所以「三十四张脸看着我」；
//   风扇三月坏的，选举在七月后，说得通；「第一节课后出结果」和「四十分钟后大家就知道」一致。

const VOTE = {
  key: 'original-w7-deciding-vote',
  title: 'The Deciding Vote',
  passage: numbered([
    'When our class chairperson moved to another school in July, our form teacher, Mr Kumar, said we would vote for a new one. There were two candidates. One was Brandon, who has been my best friend since Primary Two. The other was Wen Xin, who joined our school last year and still spends most breaks reading on her own.',
    "Brandon's speech was the funniest I have ever heard. He promised a class party at the end of every term and music in the classroom during break. Then he gave everyone a sweet with a 'Vote Brandon' sticker on it. Even Mr Kumar laughed.",
    'Wen Xin read her speech from a sheet of paper, and her hands shook so much that the paper rattled. She had three ideas: a board at the back of the room showing every homework deadline, a cleaning timetable so that the same five people did not always stay behind, and a letter to the school office about the fan above the back row, which had been broken since March. I found myself nodding at every one.',
    "Voting took place on a Tuesday, when I was away at a maths competition. On Wednesday, Mr Kumar called me to his desk. The votes were seventeen each. 'You're the only one who hasn't voted,' he said. 'Do it in the staff room on Monday, before class.' When I turned round, thirty-four faces were looking at me. I walked back to my seat as if the floor were made of ice, and I could not swallow.",
    "For the rest of the week, people were strangely kind to me, and on Thursday I found three 'Vote Brandon' sweets in my pencil case. I dropped them into the bin without looking at them and wished everyone would leave me alone. On Friday night, Brandon sent me a message: 'No pressure, haha. You know what to do.' An hour later he sent another: 'Seriously, vote for whoever you think is better. I mean it.'",
    "That second message made everything harder. All weekend I sat with a sheet of paper, Brandon's name on one side and Wen Xin's on the other, changing my mind every hour. Brandon makes everyone laugh, and when Wen Xin first arrived, he was the only one who talked to her. But her ideas would really change things. Worse, because mine was the last vote, it would not be secret at all. Whoever won, everybody would know that I had chosen them.",
    "On Monday morning, in the staff room, Mr Kumar gave me a small square of paper and a pen. I wrote a name quickly, before I could think again, and folded the paper twice. He dropped it into the box without looking. 'Results after the first lesson,' he said.",
    'When I came out, Brandon and Wen Xin were standing in the corridor, a few metres apart. Neither of them said anything. They were both looking at my face, trying to read it, and I kept it as still as I could. In forty minutes, everybody would know. Until then, the name on that paper belonged only to me.',
  ]),
  questions: [
    {
      kind: 'matchingFeelings',
      bank: ['impressed', 'nervous', 'annoyed', 'torn', 'jealous', 'bored', 'lonely', 'relieved'],
      items: [
        { moment: "Paragraph 3 — listening to Wen Xin's three ideas", answer: 'impressed', para: 3 },
        { moment: 'Paragraph 4 — walking back to the seat after hearing about the votes', answer: 'nervous', para: 4 },
        { moment: 'Paragraph 5 — finding the sweets in the pencil case', answer: 'annoyed', para: 5 },
        { moment: 'Paragraph 6 — spending the weekend with the two names on a sheet of paper', answer: 'torn', para: 6 },
      ],
    },
    {
      kind: 'mcq',
      stem: 'In Paragraph 8, what does "trying to read it" mean?',
      answer: "They hoped to guess the result from the writer's face.",
      distractors: [
        'They wanted to read the list the writer had made.',
        'They were reading a notice on the corridor wall.',
        'They wanted to see the paper inside the box.',
      ],
      evidence: 'They were both looking at my face, trying to read it, and I kept it as still as I could.',
    },
    {
      kind: 'gapChoice',
      stem: 'Wen Xin wanted to write a letter to the school office about the ______.',
      answer: 'fan',
      distractors: ['board', 'timetable', 'canteen'],
      evidence:
        'She had three ideas: a board at the back of the room showing every homework deadline, a cleaning timetable so that the same five people did not always stay behind, and a letter to the school office about the fan above the back row, which had been broken since March.',
    },
    {
      kind: 'short',
      marks: 2,
      stem: 'According to Paragraph 2, what TWO things did Brandon promise in his speech?',
      answer: 'A class party at the end of every term, and music in the classroom during break.',
      evidence: 'He promised a class party at the end of every term and music in the classroom during break.',
      rubric:
        '两分：写出「每学期末办一次班级派对」给 1 分；写出「课间在教室里放音乐」再给 1 分。写「给每人发一颗贴着『投 Brandon』的糖」不给分 —— 那是他做的事，不是他许的诺。',
    },
    {
      kind: 'short',
      marks: 2,
      stem: 'According to Paragraph 4, why had the writer not voted yet, and where was the writer told to vote?',
      answer:
        "On voting day, the writer was away at a maths competition; Mr Kumar told the writer to vote in the staff room on Monday, before class.",
      evidence: 'Voting took place on a Tuesday, when I was away at a maths competition.',
      rubric:
        '两分：写出「投票那天（星期二）作者去参加数学比赛了」给 1 分；写出「在教师办公室投（星期一上课前）」再给 1 分（只写「星期一上课前」、没写地点不给这 1 分）。写「票数是十七比十七」不给分 —— 那不是作者没投票的原因。',
    },
    {
      kind: 'short',
      marks: 2,
      stem: "According to Paragraph 5, what did Brandon say in each of his two messages on Friday night?",
      answer:
        "In the first, he said 'No pressure, haha. You know what to do'; in the second, he told the writer seriously to vote for whoever the writer thought was better, and said that he meant it.",
      evidence: "An hour later he sent another: 'Seriously, vote for whoever you think is better. I mean it.'",
      rubric:
        '两分：写出第一条「没压力哈哈，你知道该怎么做」给 1 分（照抄英文原话也给）；写出第二条「说真的，投你认为更好的那个人，我是认真的」再给 1 分。只写「他发了两条消息」、没写内容不给分；写「笔袋里有三颗『投 Brandon』的糖」不给分 —— 那不是 Brandon 说的话。',
    },
    {
      kind: 'short',
      marks: 2,
      stem: "Using your own words, explain why the writer's vote would not be secret (Paragraph 6).",
      answer:
        "The writer's vote was the last one, so it would decide the result; whoever won, the whole class would know that the writer had chosen that person.",
      evidence: 'Worse, because mine was the last vote, it would not be secret at all.',
      rubric:
        '两分：写出「作者的是最后一票（两边十七比十七，这一票定输赢）」给 1 分；写出「不管谁赢，全班都会知道作者选的是谁」再给 1 分。写「Brandon 是作者最好的朋友」或「Wen Xin 的主意更好」不给分 —— 那是作者为难的地方，不是投票不保密的原因。',
    },
  ],
};

const SPECS = [BARS, VOLUME_ONE, END_OF_LINE, CAMERA, VOTE];

module.exports = {
  LEVEL,
  SPECS,
  DAYS: DATES.slice(0, SPECS.length).map((date, i) => buildAuthoredDay(SPECS[i], date)),
};
