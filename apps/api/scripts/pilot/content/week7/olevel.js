/**
 * 第七周 —— **olevel（O-Level 标准）**档，全原创。
 *
 * 四五百词、九段，人物心理更曲折，言外之意更多。形状与第三到六周这一档一致：
 *   4 道情绪配对 · 1 道短语理解四选一 · 1 道原文填空 · 4 道两分主观题 —— 满分 14。
 *
 * 选题思路：第五周这一档几篇都写成「年轻人在岗位上碰到难缠的大人」，被换掉两篇；
 * 第六周按领域先分开，效果好，这周照做，而且五个领域都避开第六周用过的
 * （祖辈 / 朋友冲突 / 学新技能 / 公共场合 / 老师式幽默反转）：
 *
 *   周一  两地与身份（回国探亲、和同龄表哥）   结局：释然，不再追问「哪个是家」
 *   周二  母女（每天早上两分钟的编辫子）       结局：无声的默契（梳子回到桌上）
 *   周三  体育（八百米的宿敌搬走了）           结局：隔空再比，又输了，却最开心
 *   周四  心理小实验（自我意识 / 聚光灯效应）  结局：落到行动上——一个人坐食堂看书
 *   周五  幽默反转（假装是乐队粉丝）           结局：喜剧循环——假戏成真，又开始假装
 *
 * 五篇没有一篇写打工 / 岗位，核心也都不是「发现自己动机不纯」。没有老物件、组屋
 * 邻居、熟食中心美食、生病去世，也没有作弊。选题前对过 pack-titles-1007（161 条）、
 * read-titles-0929 / 1007 两份学生读过的标题，读了第三到六周这一档全部、中级档与
 * 简化档第三到六周的开头，以及 The Voice Message、The Spare Motor、Twelve Moves、
 * The Orange Flame 和旧题库 Newcomer、The Uniform 的原文，确认不是同一个骨架。
 * 本周简化档同时在写（The Pink Shirts / The Extra Seconds / The Toy Sale /
 * The Cloudy Day / The Water Station），标题与内核都不撞。
 */

'use strict';

const { buildAuthoredDay, numbered } = require('../authored');
const { DATES } = require('./dates');

const LEVEL = 'olevel';

// ═══════════════════════════════════════════════════════════════
// 周一 —— Over There
//
// 作者九岁随家搬到新加坡，在学校仍是「中国来的男生」，老说「In China, we...」。
// 隔三年回东北老家过十二月，同龄表哥 Haoran 长高了、声音变了，车上聊天总接不上；
// 家宴上舅舅让他「说句英语」，全桌鼓掌，只有 Haoran 没拍手。之后他句句以
// 「In Singapore」开头，以为表哥嫉妒；第五天表哥一句「你就不能就在这儿吗」把他
// 说急了。当晚他想通：在哪儿都讲「另一个地方」，也许因为总属于别处，就没人能说
// 他不属于这里。第二天改口、问词、在冰湖上打闹；临走表哥把围巾塞给他「下次用得着」。
// 回到樟宜妈妈说「到家了」，他没再问是哪个家，满身汗还围着围巾上了出租车。
//
// 选题理由：学生就是在新加坡读书的中国孩子，「两边都像外人」是他们自己的处境，
// 言外之意多（表哥不鼓掌、围巾、「哪个家」）。
// 与旧题库 Newcomer（从怡保搬来新加坡第一天上学）只是都写「换了地方」，那篇是
// 适应新学校；这篇是回去，内核是「在两个地方之间不敢属于任何一边」。与第三周
// Speaking for My Mother（替妈妈翻译）只共用「语言」这个外壳。
// 时间线：九岁搬来、「六年后」十五岁；上次回去是三年前（十二岁）；去年十二月
// 回去两周，第二晚家宴、第五天争执、最后一天机场。东北十二月下雪、湖面结冰，
// 新加坡「三十一度」都是常识范围，没有别的事实性内容。
// ═══════════════════════════════════════════════════════════════

const OVER_THERE = {
  key: 'original-w7-over-there',
  title: 'Over There',
  passage: numbered([
    `My family moved to Singapore when I was nine. Six years later, I am still the boy from China at school. Whenever a teacher mentions snow or dumplings, the class turns to look at me, and I hear myself saying, "In China, we..." My mother calls our trips back "going home", and every time she says it, I want to ask her which home she means.`,
    `Last December we went back to her home town in the north-east for the first time in three years. My cousin Haoran was waiting at the airport. We were born three weeks apart and had done almost everything together until I was nine. Now he was taller than me, and his voice was deeper. He took one look at my thin jacket, laughed and wrapped his own scarf round my neck. In the car, though, our conversation kept stopping. He used words I had never heard, and I answered in short sentences.`,
    `On the second night, more than twenty of us had dinner together at a restaurant. Halfway through, my uncle asked me to say something in English. Everyone stopped eating and turned towards me. I said one sentence about the weather. They clapped as if I had done a magic trick, and my uncle called me "our little Singaporean". I smiled and stared into my bowl until they started talking again. Haoran did not clap. He just went on eating.`,
    `After that, I began almost every sentence with "In Singapore". In Singapore, I told them, it was thirty-one degrees. In Singapore nobody needed a coat. Haoran never said anything, and I decided that he was jealous.`,
    `On the fifth day, as we walked to the shop through the snow, I said that in Singapore the only ice we ever saw was in our drinks. Haoran stopped. "You keep telling us what it's like over there," he said. "You're only here for two weeks. Can't you just be here?" Then he walked on ahead. I wanted to shout after him that I was trying. Instead I kicked a lump of snow so hard that my toes hurt.`,
    `That night I lay on a mattress on Haoran's floor and thought about what he had said. Then I thought about my classroom in Singapore, where I was always saying "In China". Wherever I was, I talked about the other place. Perhaps it felt safer that way. If I always belonged somewhere else, nobody could say that I did not belong here.`,
    `The next day I tried something different. When I did not know a word, I asked Haoran instead of giving up. He laughed at me, but he explained. In the afternoon we went to the frozen lake in the park where we used to play. We slid across it in our boots until he pushed me over and I pulled him down with me, and I lay on the ice laughing until my stomach hurt.`,
    `At the airport on the last day, I tried to give back his scarf. He pushed it into my hands. "Keep it," he said. "You'll need it next time." I nodded without a word, because I was not sure what my voice would do.`,
    `When we landed at Changi, the hot, wet air wrapped itself round me like a towel, and my mother sighed and said, "Home." I did not ask her which one. I was still wearing Haoran's scarf, and although I was sweating within a minute, I kept it on all the way to the taxi.`,
  ]),
  questions: [
    {
      kind: 'matchingFeelings',
      bank: ['embarrassed', 'angry', 'joyful', 'touched', 'bored', 'frightened', 'curious', 'suspicious'],
      items: [
        { moment: 'Paragraph 3 — after the family claps for the writer', answer: 'embarrassed', para: 3 },
        { moment: 'Paragraph 5 — after Haoran walks on ahead in the snow', answer: 'angry', para: 5 },
        { moment: 'Paragraph 7 — lying on the frozen lake with Haoran', answer: 'joyful', para: 7 },
        { moment: 'Paragraph 8 — when Haoran pushes the scarf back into the writer\'s hands', answer: 'touched', para: 8 },
      ],
    },
    {
      kind: 'mcq',
      stem: 'In Paragraph 5, what does Haoran mean when he asks, "Can\'t you just be here?"',
      answer: 'He wants the writer to stop comparing everything with Singapore.',
      distractors: [
        'He wants the writer to come and live in China for good.',
        'He wants the writer to wait for him outside the shop.',
        'He wants the writer to stop following him in the snow.',
      ],
      evidence: `"You're only here for two weeks. Can't you just be here?"`,
    },
    {
      kind: 'gapChoice',
      stem: "When Haoran saw the writer's thin jacket, he wrapped his own ______ round the writer's neck.",
      answer: 'scarf',
      distractors: ['coat', 'towel', 'hat'],
      evidence: 'He took one look at my thin jacket, laughed and wrapped his own scarf round my neck.',
    },
    {
      kind: 'short',
      marks: 2,
      stem: 'According to Paragraph 2, in what TWO ways was Haoran different from the boy the writer had grown up with?',
      answer: 'He was now taller than the writer, his voice was deeper, and he used words the writer had never heard.',
      evidence: 'Now he was taller than me, and his voice was deeper.',
      rubric:
        '两分：以下三点任答两点，各 1 分：①他现在比作者高了；②他的声音变低沉了；③他说话用了很多作者从没听过的词。只写「他笑作者的外套太薄」「把自己的围巾给了作者」是他的举动，不是他变了的地方，不给分。',
    },
    {
      kind: 'short',
      marks: 2,
      stem: 'According to Paragraph 3, how did most of the family react when the writer spoke English, and what did Haoran do?',
      answer:
        'They clapped as if he had done a magic trick, and his uncle called him "our little Singaporean"; Haoran did not clap and just went on eating.',
      evidence: 'They clapped as if I had done a magic trick, and my uncle called me "our little Singaporean".',
      rubric:
        '两分：两问各 1 分。①其他家人：像看完一场魔术表演一样鼓掌（答「uncle 叫他 our little Singaporean」或「大家停下来转过身看他」也给这 1 分）。②Haoran：没有鼓掌，只是继续吃饭（写出「没鼓掌」或「继续吃」任一即可）。只写「作者说了一句关于天气的话」是作者自己做的事，不给分。',
    },
    {
      kind: 'short',
      marks: 2,
      stem: 'Using your own words, describe the habit the writer noticed in himself in Paragraph 6, and the reason he suggests for it.',
      answer:
        'Wherever he was, he kept talking about the other country, perhaps because if he always belonged somewhere else, nobody could tell him that he did not belong where he was.',
      evidence: 'If I always belonged somewhere else, nobody could say that I did not belong here.',
      rubric:
        '两分：两点各 1 分。①他发现自己不管在哪儿都在讲「另一个地方」——在新加坡说中国，在中国说新加坡（写出「总在说另一个地方」即可）。②原因：也许这样更安全——如果他总是属于别处，就没人能说他不属于这里（写出「保护自己 / 怕被人说不属于这里」的意思即可）。答「Haoran 在嫉妒他」不给分——那是第 4 段作者原来的猜测，第 6 段他想通的恰恰不是这个。',
    },
    {
      kind: 'short',
      marks: 2,
      stem: 'According to Paragraphs 8–9, what did Haoran say when the writer tried to return the scarf, and what did the writer do with it at Changi?',
      answer:
        'Haoran told him to keep it because he would need it next time; at Changi the writer kept it on all the way to the taxi, although he was sweating.',
      evidence: "I was still wearing Haoran's scarf, and although I was sweating within a minute, I kept it on all the way to the taxi.",
      rubric:
        '两分：两问各 1 分。①Haoran 说：留着吧，下次还用得着（写出「让他留着」或「下次用得着」任一即可）。②在樟宜：虽然一分钟就开始冒汗，作者还是一直围着它，直到上出租车（写出「一直围着 / 没摘下来」即可）。只写「作者没有问妈妈是哪个家」不给第二分——题目问的是他怎么处理围巾。',
    },
  ],
};

// ═══════════════════════════════════════════════════════════════
// 周二 —— Two Minutes
//
// 十年来每个上学日早上六点一刻，妈妈站在厨房椅子后面给作者编辫子，正好两分钟，
// 两人几乎不说话，是一天里唯一谁都不看手机的时候。中三三月作者用自己的积蓄去剪了
// 短发，前一晚才告诉妈妈；妈妈说「是你的头发」，一个早已洗干净的锅洗了很久。
// 理发师问要不要留下剪下的辫子，作者笑着说不要；妈妈回家第一句却问「头发给你了吗」。
// 第二天早上妈妈拿着梳子站在椅子后，愣了一下把梳子收进抽屉，改去烤吐司。
// 几周后妈妈加入了早上六点绕公园快走的一群阿姨，回来脸红红地笑——反倒是作者坐在
// 安静的厨房里，不知道那两分钟该干什么。结尾：十月，头发快到肩膀了，她跟朋友说
// 只是没空剪；昨晚下楼喝水，看见梳子放在桌上、挨着她的椅子。
//
// 选题理由：长大就要结束一些小仪式，大人的失落从不说出口；锅、辫子、梳子都是
// 让学生读言外之意的地方。妈妈不写成受害者——她先走出去了，反转在作者身上。
// 与第三周 Properly This Time（父子周日羽毛球、让球）只是都有「亲子固定仪式」的
// 外壳，那篇内核是「让着对方反而不尊重」；中级档 The Copycat 里有剪短发，但内核
// 是弟弟模仿。不写老物件、祖辈、生病。
// 时间线：十年（约五岁到十五岁）；中三三月剪发，四月妈妈开始快走，现在十月，
// 剪到耳下的短发七个月后「快到肩膀」，长度说得通。
// ═══════════════════════════════════════════════════════════════

const TWO_MINUTES = {
  key: 'original-w7-two-minutes',
  title: 'Two Minutes',
  passage: numbered([
    `For ten years, at a quarter past six every school morning, my mother plaited my hair. I sat on the kitchen chair eating my toast, and she stood behind me with the comb, humming songs from her own school days. It took exactly two minutes. We hardly talked. It was the only time in the day when neither of us was looking at a phone.`,
    `By Secondary Three my hair reached my waist. It took an hour to dry, it was always hot on my neck, and most of my friends had short hair. In March I booked a haircut with my own savings and told my mother the night before. She was washing a pan. "It's your hair," she said, and she went on washing the same pan for a long time after it was clean.`,
    `At the salon, the hairdresser cut off the plait in one piece and held it up like a dead snake. "Want to keep it?" she asked. I laughed and said no. My head felt so light that I kept touching the back of my neck, and I grinned at the girl in the mirror as if we had only just met.`,
    `At home my mother walked round me twice. "Very nice," she said. "Very modern." Then she asked whether the hairdresser had given me the hair. When I said no, she said, "No, of course. Why would you keep it?" and went into the kitchen. I stood in the living room with my hand on my neck, trying to work out why anyone would want a plait of cut hair.`,
    `The next morning, at a quarter past six, my mother was standing behind the kitchen chair with the comb in her hand. She looked at my hair, and then at the comb, as if she had forgotten why she was holding it. Then she put it away in a drawer and made my toast instead. I told her it was very good toast, although it was exactly the same as always, and I could not look at her while I ate it.`,
    `For the next few weeks, she still got up at a quarter past six, though there was nothing for her to do. She wiped a table that was already clean. She read the news on her phone. I told myself that mornings were better now. I could sleep two minutes longer, and nobody pulled my hair.`,
    `Then, one morning in April, the kitchen was empty. There was a note on the table: Gone walking. Toast in the oven. My mother had joined a group of women who walk round the park every morning at six. She came home with red cheeks, laughing about a woman who walks faster than everyone else and talks the whole way.`,
    `I was glad for her. I really was. But the next morning she went walking again, and I sat on the kitchen chair at a quarter past six with my toast, and the kitchen was very quiet. I found that I did not know what to do with the two minutes either. Without thinking, I reached for the back of my neck.`,
    `That was in April. It is October now, and my hair almost touches my shoulders. I tell my friends that I have just been too busy to cut it. My mother has not said a word about it, and neither have I. But last night, when I came down for a glass of water, the comb was lying on the kitchen table, next to my chair.`,
  ]),
  questions: [
    {
      kind: 'matchingFeelings',
      bank: ['thrilled', 'confused', 'guilty', 'lonely', 'frightened', 'furious', 'suspicious', 'impatient'],
      items: [
        { moment: 'Paragraph 3 — looking in the salon mirror after the plait is cut off', answer: 'thrilled', para: 3 },
        { moment: 'Paragraph 4 — after her mother asks about the cut hair', answer: 'confused', para: 4 },
        { moment: 'Paragraph 5 — eating the toast her mother has made', answer: 'guilty', para: 5 },
        { moment: 'Paragraph 8 — sitting alone in the quiet kitchen at a quarter past six', answer: 'lonely', para: 8 },
      ],
    },
    {
      kind: 'mcq',
      stem: 'In Paragraph 2, why does the mother go on washing the same pan "for a long time after it was clean"?',
      answer: 'She was more upset about the haircut than she said.',
      distractors: [
        'She thought the pan still needed more washing.',
        "She was too busy to talk about her daughter's hair.",
        'She was angry about how much the haircut cost.',
      ],
      evidence: `"It's your hair," she said, and she went on washing the same pan for a long time after it was clean.`,
    },
    {
      kind: 'gapChoice',
      stem: 'At the salon, the hairdresser held up the cut plait like a dead ______.',
      answer: 'snake',
      distractors: ['comb', 'rope', 'fish'],
      evidence: 'At the salon, the hairdresser cut off the plait in one piece and held it up like a dead snake.',
    },
    {
      kind: 'short',
      marks: 2,
      stem: 'According to Paragraph 1, what did the writer and her mother each do during the two minutes every morning?',
      answer:
        'The writer sat on the kitchen chair eating her toast, while her mother stood behind her with the comb, plaiting her hair and humming songs from her school days.',
      evidence:
        'I sat on the kitchen chair eating my toast, and she stood behind me with the comb, humming songs from her own school days.',
      rubric:
        '两分：两人各 1 分。①作者：坐在厨房的椅子上吃吐司。②妈妈：站在她身后拿梳子给她编辫子（答「一边编一边哼自己上学时的歌」也给这 1 分）。只写「两个人都没看手机」「几乎不说话」不给分——那是这段时光的特点，不是两人各自在做的事。',
    },
    {
      kind: 'short',
      marks: 2,
      stem: 'Give TWO reasons from Paragraph 2 why the writer decided to cut her hair.',
      answer: 'Her hair took an hour to dry, it was always hot on her neck, and most of her friends had short hair.',
      evidence: 'It took an hour to dry, it was always hot on my neck, and most of my friends had short hair.',
      rubric:
        '两分：以下三点任答两点，各 1 分：①头发要一个小时才干；②头发总是捂得脖子很热；③大多数朋友都是短发。只写「头发已经长到腰了」只是长度，不给分。「用自己的积蓄去剪」是怎么剪的，不是原因，不给分。',
    },
    {
      kind: 'short',
      marks: 2,
      stem: 'According to Paragraph 5, what did the mother do the morning after the haircut? Give TWO details.',
      answer:
        "She stood behind the chair with the comb, looked from the writer's hair to the comb, put the comb away in a drawer and made toast instead.",
      evidence: 'Then she put it away in a drawer and made my toast instead.',
      rubric:
        '两分：以下四点任答两点，各 1 分：①六点一刻拿着梳子站在椅子后面；②看看作者的头发、又看看梳子，像忘了为什么拿着它（「看头发」「看梳子」合起来只算一点）；③把梳子收进了抽屉；④改去给作者做吐司。作者夸吐司好吃、吃的时候不敢看妈妈，是作者的反应，不给分。',
    },
    {
      kind: 'short',
      marks: 2,
      stem: 'According to Paragraph 9, what does the writer tell her friends about her hair, and what did she see on the kitchen table last night?',
      answer: 'She tells them she has just been too busy to cut it, and she saw the comb lying on the table next to her chair.',
      evidence: 'But last night, when I came down for a glass of water, the comb was lying on the kitchen table, next to my chair.',
      rubric:
        '两分：两问各 1 分。①她跟朋友说：只是太忙，没空去剪。②她看到梳子放在厨房桌上、挨着她的椅子（写出「梳子」即可；答「一杯水」不给分——水是她下楼要喝的）。只写「头发快到肩膀了」不给第一分——那是头发的长度，不是她对朋友说的话。',
    },
  ],
};

// ═══════════════════════════════════════════════════════════════
// 周三 —— The Back of Her Head
//
// 作者两年里十一场八百米，场场输给别校的 Kaelyn，比赛中只见过她的后脑勺和马尾。
// 两人从不说话。新赛季第一场她没来——全家搬去了台北。作者第一个念头是「终于」，
// 赢了将近四秒，成绩却是一年来最慢的 2 分 31，奖牌轻得像塑料。整个学期越跑越慢，
// 教练一句「这两年你在追她，现在你只是在跑」，她把水壶摔进包里又弹出来。当晚想通：
// Kaelyn 从来不是挡路的人，而是一直拉着她跑。托队友要来号码，删了五遍才发出
// 「你走后我场场都赢，感觉很糟」。对方十一分钟后回：一直在查成绩，你一场比一场慢，
// 真丢人（言外之意：她也一直在看着作者）；台北和新加坡同一个时间，周六早上七点
// 认真跑一次把成绩发来。周六她想着前面的马尾跑出 2:23.9，
// 生涯最好；对方回 2:23.5——她又是第二，却从没这么开心过。她没法核实对方真跑了，
// 决定相信她；下周六七点继续追那个后脑勺，总有一天要超过去。
//
// 选题理由：体育题材里写「对手其实是推着你的人」，内核是承认需要对手、放下面子先开口。
// 与第三周 The Spare Motor（对手队长借电机）、中级档 Twelve Moves（被新人赢、放下
// 架子请教）、旧题库 The Last Lap（接力决赛）都不是一个内核：这篇没有借东西、没有
// 被超越，对手根本不在场。中级档 The Orange Flame 也提到 Perth，所以这里用台北。
// 事实与数字：台北与新加坡同属 UTC+8、都不实行夏令时；两地相距约三千二百公里，
// 原文写「more than three thousand kilometres」。时间：赢那场 2:31（一年来最慢，
// 她平时在 2:25 上下，原文不写）、周六 2:23.9 是她最好成绩、对方 2:23.5，差 0.4 秒
// 「less than half a second」。十一场 / 两年说得通。
// ═══════════════════════════════════════════════════════════════

const BACK_OF_HER_HEAD = {
  key: 'original-w7-the-back-of-her-head',
  title: 'The Back of Her Head',
  passage: numbered([
    `For two years I came second to Kaelyn in every 800-metre race I ran. Eleven races. She was from another school, a head taller than me, with a long black ponytail that swung from side to side as she ran. I never once saw her face during a race. I knew the back of her head better than I knew my own.`,
    `We never spoke. At the start line she stared straight ahead, and at the finish she shook my hand without looking at me. At night I used to lie in bed and imagine passing her on the last bend, so clearly that I could hear the crowd.`,
    `At the first race of this season, she was not there. In the warm-up area, a girl from her school told me that Kaelyn's family had moved to Taipei in the holidays. My first thought, which I am not proud of, was: finally. It felt as if someone had lifted a heavy bag off my back.`,
    `I won by almost four seconds. People cheered, and Mr Rahman, our coach, patted me on the back. But my time was two minutes thirty-one, the slowest I had run in a year. Standing on the top step with the medal round my neck, I kept looking back at the time on the board, and the medal felt as light as plastic.`,
    `It got worse. All term my times went up instead of down. In the last two hundred metres, where I used to dig in, there was nothing in front of me to chase, and my legs seemed to know it. After one slow training run, Mr Rahman looked at his stopwatch and said, "For two years you ran after her. Now you're just running." I threw my water bottle into my bag so hard that it bounced out again.`,
    `That night I understood that Kaelyn had never been in my way. She had been pulling me along. Jasmine, on our team, had been at primary school with her and still had her number. I wrote a message and deleted it five times, my heart pounding as if I were on the last bend. In the end I sent: "This is the girl who always came second. I have won every race since you left. It feels terrible."`,
    `Her reply came eleven minutes later. "I know," she had written. "I've been checking the results. You're getting slower every race. It's embarrassing." Then: "Taipei is on the same time as Singapore. Saturday, 7 a.m. Run it properly and send me your time." I laughed so loudly that my brother shouted at me from the next room.`,
    `On Saturday at seven, the school track was empty except for me and Mr Rahman, who was yawning and holding his stopwatch. I stood at the start line and pictured a black ponytail a few metres ahead. On the last bend I could almost see it swinging, and I ran after it with everything I had. When I crossed the line, Mr Rahman stared at the stopwatch. Two minutes twenty-three point nine. My best time ever.`,
    `I sent it to her. Ten minutes later she replied: "2:23.5. Same time next Saturday?" So I came second again, by less than half a second, to a girl more than three thousand kilometres away. I have no way of knowing whether she really ran. I have decided to believe her. Next Saturday at seven, I am going to chase the back of her head again, and one day I am going to pass it.`,
  ]),
  questions: [
    {
      kind: 'matchingFeelings',
      bank: ['relieved', 'frustrated', 'nervous', 'amused', 'bored', 'grateful', 'suspicious', 'jealous'],
      items: [
        { moment: 'Paragraph 3 — hearing that Kaelyn has moved away', answer: 'relieved', para: 3 },
        { moment: "Paragraph 5 — after Mr Rahman's comment at training", answer: 'frustrated', para: 5 },
        { moment: 'Paragraph 6 — writing the message to Kaelyn', answer: 'nervous', para: 6 },
        { moment: "Paragraph 7 — reading Kaelyn's reply", answer: 'amused', para: 7 },
      ],
    },
    {
      kind: 'mcq',
      stem: 'In Paragraph 5, what does Mr Rahman mean by "For two years you ran after her. Now you\'re just running"?',
      answer: 'She ran faster when there was someone ahead to chase.',
      distractors: [
        'She should find someone new to train with at school.',
        'She had been copying the way Kaelyn ran in races.',
        'She was running too fast at the start of each race.',
      ],
      evidence: `"For two years you ran after her. Now you're just running."`,
    },
    {
      kind: 'gapChoice',
      stem: 'Kaelyn had a long black ______ that swung from side to side as she ran.',
      answer: 'ponytail',
      distractors: ['medal', 'ribbon', 'towel'],
      evidence:
        'She was from another school, a head taller than me, with a long black ponytail that swung from side to side as she ran.',
    },
    {
      kind: 'short',
      marks: 2,
      stem: 'According to Paragraph 2, how did Kaelyn behave towards the writer at the start line and at the finish?',
      answer: "At the start line she stared straight ahead, and at the finish she shook the writer's hand without looking at her.",
      evidence: 'At the start line she stared straight ahead, and at the finish she shook my hand without looking at me.',
      rubric:
        '两分：两问各 1 分。①起跑线上：她一直盯着正前方（不看作者）。②终点：她跟作者握手，但眼睛不看作者。只写「两人从来不说话」不给分——题目问的是她在起点和终点各自怎么做。',
    },
    {
      kind: 'short',
      marks: 2,
      stem: 'According to Paragraph 4, give TWO details which show that the writer was unhappy with her win.',
      answer:
        'Her time of two minutes thirty-one was her slowest in a year, she kept looking back at the time on the board, and the medal felt as light as plastic.',
      evidence: 'But my time was two minutes thirty-one, the slowest I had run in a year.',
      rubric:
        '两分：以下三点任答两点，各 1 分：①成绩是 2 分 31 秒，是她一年来跑得最慢的一次；②站在领奖台上，她一直回头看计时牌上的成绩；③奖牌轻得像塑料做的。只写「领先将近四秒赢了」「大家欢呼、教练拍她的背」不给分——这些说的是赢了，不是她不满意。',
    },
    {
      kind: 'short',
      marks: 2,
      stem: 'In Paragraph 6, how does the writer now see the part Kaelyn played in her races? Answer in your own words.',
      answer: 'Kaelyn had never been an obstacle stopping her from winning; instead, chasing Kaelyn had made her run faster.',
      evidence: 'That night I understood that Kaelyn had never been in my way. She had been pulling me along.',
      rubric:
        '两分：两点各 1 分。①Kaelyn 从来不是挡在她前面、害她赢不了的人（写出「不是挡路的 / 不是障碍」即可）。②恰恰相反，是 Kaelyn 一直在带着她跑、让她跑得更快（写出「追着她才跑得快」即可）。只写「她给 Kaelyn 发了信息」是她接下来做的事，不给分。',
    },
    {
      kind: 'short',
      marks: 2,
      stem: "What was the writer's time on Saturday, and how did it compare with Kaelyn's (Paragraphs 8–9)?",
      answer:
        "She ran two minutes twenty-three point nine, her best time ever, but Kaelyn's time was 2:23.5, so the writer came second again by less than half a second.",
      evidence: 'So I came second again, by less than half a second, to a girl more than three thousand kilometres away.',
      rubric:
        '两分：两问各 1 分。①她的成绩：2 分 23 秒 9（写出这个时间即可；只写「是她有史以来最好的成绩」也给这 1 分）。②和 Kaelyn 比：Kaelyn 跑了 2 分 23 秒 5，她又是第二，差不到半秒（写出「又输了 / 又是第二」即可）。只写「Kaelyn 在三千多公里外」不给第二分——题目问的是两人成绩的比较。',
    },
  ],
};

// ═══════════════════════════════════════════════════════════════
// 周四 —— The Jellyfish Badge
//
// 作者（男生）特别在意别人怎么看自己：进教室前照门玻璃、排队前先练好要说的话、
// 中一演讲破音后一个月每晚重放。科学课要「检验一个想法」，他挑了图书馆书里的实验：
// 美国大学生穿着印尴尬图案的 T 恤进屋，以为大约一半人注意到了，其实少得多——
// 大多数人忙着想自己。他一个字都不信，于是给自己五天、每天改一处：周一换头发分边、
// 周二表戴右手、周三手背画蓝星星——三天零个人发现，连同桌好友 Desmond 都没看见，
// 他「几乎有点被冒犯」。周四别上妹妹在水族馆买的「ASK ME ABOUT JELLYFISH」徽章，
// 只有一个中一女生问了，反过来给他讲了三个水母知识，最后一个是「水母没有脑子」，
// 没等他想明白是不是在说他就走了。周五最难：Desmond 练乐队，他平时宁可饿着去图书馆，
// 这回端着面坐到食堂正中间看书——起初脸发烫，以为人人都在看「没朋友的男生」；
// 结果二十分钟没人多看一眼，他看完四十页。汇报时说学到的是「几乎没人在看我——
// 是好消息，也有点没礼貌」；Desmond 说他注意到一件事：他不再对着门照自己了。
// 结尾：每周五他都坐在食堂中间看书。
//
// 选题理由：中学生最普遍的心理负担之一，用一个小实验写出来，有笑点（水母），
// 也有反转（不被注意反倒有点失落；朋友注意到的不是外表）。领域是心理 / 科学，
// 不是朋友冲突。
// 与中级档 Lucky Socks（不成对的袜子、迷信）、简化档 The Class Photo（照片里总
// 闭眼）只是都碰到「外表」，内核不同；没有写眼镜（避开旧题库 The New Glasses）。
// 事实：Gilovich 等人 2000 年在康奈尔做的「尴尬 T 恤」实验——穿的人估计约一半人
// 注意到，实际约四分之一。原文只写「about half」和「far fewer」，不写具体数字。
// 「水母没有脑子」：水母只有神经网、没有集中的脑，是通行说法。
// 时间线：周一到周五五天；Desmond「三天」坐他旁边没发现（周一到周三）；下周一汇报。
// ═══════════════════════════════════════════════════════════════

const JELLYFISH_BADGE = {
  key: 'original-w7-the-jellyfish-badge',
  title: 'The Jellyfish Badge',
  passage: numbered([
    `Before I walk into a classroom, I check my reflection in the glass of the door. I practise what I am going to say before I reach the front of the canteen queue. In Secondary One my voice cracked in the middle of a presentation, and for a month afterwards I heard that crack every night before I fell asleep.`,
    `So when our science teacher, Mr Fong, asked each of us to test an idea and report back, I chose one from a library book. In an experiment in America, university students had to walk into a room wearing a T-shirt with an embarrassing picture on it. Afterwards they guessed that about half the people in the room had noticed. In fact, far fewer had. Most people, the book said, are too busy thinking about themselves to look closely at anyone else. I did not believe a word of it.`,
    `I gave myself five school days and one change a day, and I kept a tally at the back of my notebook. On Monday I parted my hair on the other side. On Tuesday I wore my watch on my right wrist. On Wednesday I drew a small blue star on the back of my hand. Each evening I wrote down how many people had said anything. Monday: nobody. Tuesday: nobody. Wednesday: nobody.`,
    `I should have been pleased. Instead I felt something I had not expected. My best friend, Desmond, had sat beside me for three days and noticed nothing, not even the star, which I had made quite large by Wednesday afternoon. I had spent years afraid that everyone was watching me. Now I had proof that they were not, and I was almost offended.`,
    `On Thursday I pinned my little sister's badge from the aquarium to my school bag. It said ASK ME ABOUT JELLYFISH in bright pink letters, and I knew nothing at all about jellyfish. Only one person asked: a Secondary One girl in the canteen queue. She read the badge, waited, and then told me three facts about jellyfish herself. The last one was that they have no brain. She walked off before I could decide whether she meant me, and I burst out laughing in the middle of the queue.`,
    `Friday was the test I had been dreading. Desmond has band practice on Fridays, and on those days I usually skip lunch and sit in the library, because I would rather be hungry than be seen eating alone. This time I bought a plate of noodles, carried it to a table in the middle of the canteen and opened a book. For the first few minutes my face burned, and the words on the page would not stay still. I was sure that everyone could see the boy with no friends.`,
    `Nobody was looking. I checked. In twenty minutes, not one person looked at me for longer than they would look at a chair. Slowly the words on the page settled down. By the end of the break I had finished my noodles and forty pages, and when the bell rang, I did not want to close the book.`,
    `On Monday I showed the class my results. When I got to the jellyfish, everyone laughed, and I laughed with them. Mr Fong asked what I had learned. I said that almost nobody was looking at me, which was good news and also a little bit rude. That got the biggest laugh of all. Afterwards Desmond told me that he had noticed one thing that week: I had stopped checking myself in the classroom door.`,
    `I still check sometimes. But on Fridays, when Desmond is at band practice, I eat lunch in the middle of the canteen with a book. Nobody looks, and the book is usually very good.`,
  ]),
  questions: [
    {
      kind: 'matchingFeelings',
      bank: ['doubtful', 'amused', 'self-conscious', 'relaxed', 'jealous', 'guilty', 'furious', 'homesick'],
      items: [
        { moment: 'Paragraph 2 — reading about the experiment in the library book', answer: 'doubtful', para: 2 },
        { moment: 'Paragraph 5 — after the Secondary One girl walks off', answer: 'amused', para: 5 },
        { moment: 'Paragraph 6 — the first few minutes at the table in the middle of the canteen', answer: 'self-conscious', para: 6 },
        { moment: 'Paragraph 7 — as the words on the page settle down', answer: 'relaxed', para: 7 },
      ],
    },
    {
      kind: 'mcq',
      stem: 'In Paragraph 5, what does "before I could decide whether she meant me" suggest?',
      answer: 'He wondered if she was hinting that he had no brain.',
      distractors: [
        'He was not sure which boy she was talking to.',
        'He could not decide whether to follow her.',
        'He did not know whether she was in his class.',
      ],
      evidence: 'She walked off before I could decide whether she meant me, and I burst out laughing in the middle of the queue.',
    },
    {
      kind: 'gapChoice',
      stem: 'On Wednesday, the writer drew a small blue ______ on the back of his hand.',
      answer: 'star',
      distractors: ['badge', 'watch', 'heart'],
      evidence: 'On Wednesday I drew a small blue star on the back of my hand.',
    },
    {
      kind: 'short',
      marks: 2,
      stem: 'According to Paragraph 1, give TWO examples of the writer worrying about how he looks or sounds to other people.',
      answer:
        'He checks his reflection in the classroom door before going in, he practises what to say before he reaches the front of the canteen queue, and after his voice cracked in a presentation he heard it every night for a month.',
      evidence: 'Before I walk into a classroom, I check my reflection in the glass of the door.',
      rubric:
        '两分：以下三点任答两点，各 1 分：①进教室前要在门玻璃上照一照自己；②在食堂排队、还没轮到就先练好要说的话；③中一演讲时破了音，之后一个月每晚睡前都在脑子里重放那一声。只写「他在中一做过一次演讲」不给分——要写出他之后一直放不下。',
    },
    {
      kind: 'short',
      marks: 2,
      stem: 'Using your own words, explain what the experiment in the library book showed, and the reason the book gave for it (Paragraph 2).',
      answer:
        'The students believed that far more people had noticed their T-shirt than really had, because most people are too busy thinking about themselves to pay close attention to others.',
      evidence: 'Most people, the book said, are too busy thinking about themselves to look closely at anyone else.',
      rubric:
        '两分：两问各 1 分。①实验结果：穿尴尬 T 恤的学生以为大约一半的人注意到了，其实注意到的人少得多（写出「以为很多人注意、实际少得多」即可）。②书给的原因：大多数人忙着想自己的事，顾不上仔细看别人。只写「作者一个字都不信」不给分——那是作者的态度，不是实验结果或原因。',
    },
    {
      kind: 'short',
      marks: 2,
      stem: 'According to Paragraph 6, what did the writer usually do at lunch on Fridays, and why?',
      answer:
        'He usually skipped lunch and sat in the library, because Desmond was at band practice and he would rather be hungry than be seen eating alone.',
      evidence:
        'Desmond has band practice on Fridays, and on those days I usually skip lunch and sit in the library, because I would rather be hungry than be seen eating alone.',
      rubric:
        '两分：两问各 1 分。①平时的做法：不吃午饭，去图书馆坐着（写出「不吃饭」或「去图书馆」任一即可）。②原因：宁可饿着，也不想被人看见自己一个人吃饭。只写「Desmond 周五要练乐队」、没有说出他怕被人看见一个人吃饭，不给这 1 分——Desmond 不在只是背景。「这一次他端着面坐到食堂中间」是这一次的做法，不是平时的，不给分。',
    },
    {
      kind: 'short',
      marks: 2,
      stem: 'According to Paragraph 8, what did the writer tell Mr Fong he had learned, and what had Desmond noticed?',
      answer:
        'He said that almost nobody was looking at him, which was good news and also a little bit rude; Desmond had noticed that he had stopped checking himself in the classroom door.',
      evidence: 'Afterwards Desmond told me that he had noticed one thing that week: I had stopped checking myself in the classroom door.',
      rubric:
        '两分：两问各 1 分。①他对 Mr Fong 说：几乎没有人在看他——是好消息，也有点没礼貌（写出「几乎没人在看他」即可）。②Desmond 注意到：他不再对着教室门照自己了。只写「全班讲到水母时都笑了」不给分——那是同学的反应，不是题目问的两件事。',
    },
  ],
};

// ═══════════════════════════════════════════════════════════════
// 周五 —— Seven Doors
//
// 中三开学第一天，新同桌 Rachel 指着贴满七个男生脸的笔袋问「你喜欢 Seven Doors 吗」，
// 作者从没听说过，答「I love them」。当晚上粉丝网站背名字、生日、爱吃的东西，挑了
// 名字最短的 Jay 当「本命」；Rachel 半夜发歌，作者回三个爱心不听就睡；问新歌就说
// 「第二段主歌最好听」，屡试不爽。到六月心里越来越虚，却越来越难开口。八月 Rachel
// 生日收到两张演唱会门票，选了作者——三周后要在几千个真粉丝里跟唱韩语。只好三周里
// 认真听每一首，结果「可怕的事发生了」：真喜欢上了，刷牙都哼最慢那首，第二段
// 主歌确实最好听。演唱会上作者哭了，转头一看 Rachel 在看手机——回家的地铁上 Rachel
// 给作者看一只翠鸟：六月起每周六六点起床去看鸟，「我还喜欢他们，只是没你那么喜欢」。
// 现在作者成了真粉丝，Rachel 半夜发鸟的照片，作者回三个爱心不看就睡。周六 Rachel 带
// 作者六点去公园看鸟，问喜不喜欢鸟——「I love them」。望远镜已经借好，有种不妙的
// 预感：自己又要喜欢上了。原文没有交代作者的性别，题干、答案、评分标准一律写
// 「the writer / 作者」。
//
// 选题理由：轻松的喜剧，笑点是「假戏成真」加「对方已经换了爱好」的双重反讽，
// 结尾回到开头那句话形成循环；言外之意是朋友之间互相「借」热爱。
// 与第六周 How They Met（两人都把好听的版本让给对方）不是同一个骨架：这里 Rachel
// 从没为作者假装，她只是换了爱好；也不是「主人公自己搞错」（The Early Alarm /
// The Wrong List）的笑点。中级档 Two Places at Once 是同时报两个社团撒谎，内核不同。
// 乐队名 Seven Doors 是虚构的。新加坡学年一月开学；翠鸟在新加坡公园常见。
// 时间线：一月开学说谎 → 六月 → 八月生日拿票、三周后演唱会 → 现在（十月）。
// ═══════════════════════════════════════════════════════════════

const SEVEN_DOORS = {
  key: 'original-w7-seven-doors',
  title: 'Seven Doors',
  passage: numbered([
    `On the first day of Secondary Three, the new girl next to me, Rachel, pointed at her pencil case. It was covered in the faces of seven young men with perfect hair. "Do you like Seven Doors?" she asked, and she looked at me as if the rest of the year depended on my answer. I had never heard of them. "I love them," I said. That was in January.`,
    `That evening I learned the seven names from a fan website, along with their birthdays and favourite foods. I chose a favourite, Jay, because his name was the shortest. When Rachel sent me songs at midnight, I replied with three hearts and went to sleep without listening. When she asked what I thought of a new song, I said that the second verse was the best part. It worked every time.`,
    `By June I could talk about Seven Doors for ten minutes without knowing a single song. Sometimes, when Rachel's eyes shone as she explained a dance, I had to look down at my desk. But every week it seemed harder to tell her the truth, and easier to send three more hearts.`,
    `Then, in August, Rachel's parents gave her two concert tickets for her birthday, and she chose me. The concert was in three weeks. Thousands of real fans would be singing every word, in Korean, and I would be standing among them with my mouth shut. That night I lay awake, imagining Rachel turning to look at me in the middle of the first song.`,
    `So for three weeks I did what I should have done in January. I listened to every song properly, with the words on my screen, on the bus, in bed and in the shower. Then something terrible happened. I started to like them. By the second week I was humming their slowest song while I brushed my teeth, without even trying. I had to admit it: the second verse really was the best part.`,
    `At the concert I sang every word. When Jay sang the slow song alone, with one white light on him, I cried real tears in front of eight thousand people. I turned to Rachel, expecting her to be crying too. She was looking at her phone.`,
    `On the train home, she showed me what she had been looking at: a photo of a small blue bird on a branch. It was a kingfisher, she said. She had seen one in the park in June, and since then she had been getting up at six every Saturday to look for birds. "I still like Seven Doors," she said kindly. "Just not as much as you do." I opened my mouth, and then I closed it again.`,
    `So now I am the Seven Doors fan. I watch their videos alone in my room. Rachel sends me photos of birds at midnight, and I reply with three hearts and go to sleep without looking.`,
    `On Saturday she is taking me to the park at six in the morning. "Do you like birds?" she asked me yesterday. "I love them," I said. I have already borrowed my uncle's binoculars, and last night I learned the names of ten birds from a website. I have a terrible feeling that I am going to like them too.`,
  ]),
  questions: [
    {
      kind: 'matchingFeelings',
      bank: ['guilty', 'worried', 'moved', 'astonished', 'furious', 'impatient', 'suspicious', 'proud'],
      items: [
        { moment: "Paragraph 3 — when Rachel's eyes shine as she explains a dance", answer: 'guilty', para: 3 },
        { moment: 'Paragraph 4 — lying awake on the night Rachel chooses the writer', answer: 'worried', para: 4 },
        { moment: 'Paragraph 6 — when Jay sings the slow song alone', answer: 'moved', para: 6 },
        { moment: 'Paragraph 7 — hearing Rachel say that she likes Seven Doors less than the writer does', answer: 'astonished', para: 7 },
      ],
    },
    {
      kind: 'mcq',
      stem: 'In Paragraph 2, what does "It worked every time" suggest?',
      answer: 'Rachel never realised that the writer had not listened.',
      distractors: [
        "The second verse was always the writer's favourite.",
        "Rachel's songs always had the same second verse.",
        'The writer had listened to every song more than once.',
      ],
      evidence: 'When she asked what I thought of a new song, I said that the second verse was the best part. It worked every time.',
    },
    {
      kind: 'gapChoice',
      stem: 'The writer chose Jay as a favourite member because his name was the ______.',
      answer: 'shortest',
      distractors: ['slowest', 'easiest', 'longest'],
      evidence: 'I chose a favourite, Jay, because his name was the shortest.',
    },
    {
      kind: 'short',
      marks: 2,
      stem: 'According to Paragraph 2, give TWO things the writer did to make Rachel believe that the writer was a fan.',
      answer:
        'The writer learned the seven names, birthdays and favourite foods from a fan website, chose Jay as a favourite, replied to the songs with three hearts, and said that the second verse was the best part.',
      evidence: 'That evening I learned the seven names from a fan website, along with their birthdays and favourite foods.',
      rubric:
        '两分：以下四点任答两点，各 1 分：①上粉丝网站背下七个人的名字（以及生日、爱吃的东西）；②挑了一个「最喜欢的」成员 Jay；③Rachel 半夜发来歌，作者回三个爱心（其实没听）；④被问到新歌时，总说第二段主歌最好听。只写「作者说 I love them」不给分——那是第 1 段的事，不在第 2 段。',
    },
    {
      kind: 'short',
      marks: 2,
      stem: 'According to Paragraph 4, what present did Rachel get for her birthday, and what did the writer imagine would happen at the concert?',
      answer:
        'Her parents gave her two concert tickets, and the writer imagined standing silent among thousands of fans who were singing every word in Korean, with Rachel turning to look.',
      evidence: 'Thousands of real fans would be singing every word, in Korean, and I would be standing among them with my mouth shut.',
      rubric:
        '两分：两问各 1 分。①礼物：爸妈送的两张演唱会门票（只写「门票」也给分）。②作者想象：成千上万的真粉丝用韩语跟唱每一句，自己站在中间张不开嘴（答「第一首歌唱到一半 Rachel 转过头来看作者」也给这 1 分）。只写「Rachel 选了作者一起去」不给第二分——那是已经发生的事，不是她的想象。',
    },
    {
      kind: 'short',
      marks: 2,
      stem: 'Using your own words, explain what happened when the writer finally listened to the songs properly (Paragraph 5).',
      answer: 'The writer began to like the band for real, and was soon humming their slowest song without meaning to.',
      evidence: 'By the second week I was humming their slowest song while I brushed my teeth, without even trying.',
      rubric:
        '两分：两点各 1 分。①作者真的开始喜欢这个乐队了（不再是假装）。②证据：第二周刷牙时不知不觉就哼起了他们最慢的那首歌（答「不得不承认第二段主歌确实最好听」也给这 1 分）。只写「在巴士上、床上、洗澡时都在听」是怎么听的，不是听了以后发生的事，不给分。',
    },
    {
      kind: 'short',
      marks: 2,
      stem: 'According to Paragraph 7, what had Rachel been doing since June, and what did she say about Seven Doors?',
      answer:
        'She had been getting up at six every Saturday to look for birds, and she said that she still liked Seven Doors, just not as much as the writer did.',
      evidence: `"I still like Seven Doors," she said kindly. "Just not as much as you do."`,
      rubric:
        '两分：两问各 1 分。①从六月起，她每个周六早上六点起床去找鸟 / 看鸟（写出「看鸟」即可）。②她说她还是喜欢 Seven Doors，只是没有作者那么喜欢了。只写「她在公园里看到一只翠鸟」不给第一分——那是一次，题目问的是她这几个月一直在做什么。',
    },
  ],
};

const SPECS = [OVER_THERE, TWO_MINUTES, BACK_OF_HER_HEAD, JELLYFISH_BADGE, SEVEN_DOORS];

module.exports = {
  LEVEL,
  SPECS,
  DAYS: DATES.slice(0, SPECS.length).map((date, i) => buildAuthoredDay(SPECS[i], date)),
};
