/**
 * 第九周 —— **olevel（O-Level 标准）**档，全原创。
 *
 * 五六百词、九段。形状与第三到八周这一档一致：
 *   4 道情绪配对 · 1 道短语理解四选一 · 1 道原文填空 · 4 道两分主观题 —— 满分 14。
 *
 * 本周叶老师（10-23）要求「内容可以整体难一点」：篇幅取 560–600 词，超纲率往 7–8.5% 写，
 * 多用从句、被动、非谓语和跨句指代；题目多考综合两处信息、推断人物想法。
 * 周二保留审定稿，按日期追加周三到周五；每篇九段、10 题、14 分。
 *
 *   周二  technology   The Slipper Test   中三两人做「会分辨易拉罐和塑料瓶的智能垃圾桶」，
 *                      程序测出 98%；八岁的弟弟把拖鞋放上餐桌，程序也说是罐子 —— 原来它学会的
 *                      是「白餐桌 = 罐子」。重拍全部照片后只有 84%，两人还是把两个数都写上海报，
 *                      没得奖。结局：作者把同一个道理用到自己身上（反复刷同二十道题），考前
 *                      三天发现自己只是「认得这二十道题」。
 *
 * 查重：对过 pack-titles-1023（内容包 1–8 周全部）和 read-titles-1023（学生交过卷的全部标题），
 * 并在内容包各周 grep 过 classif / machine learning / teachable / husk / recycl：没有写「程序
 * 学错了东西」的旧文。最近的邻居是第八周中级档 Please Try Again（指纹锁认不出修空调的爸爸）——
 * 那篇是机器**认不出人**、落到「我从没认真看过爸爸的手」；这篇是机器**认得太顺、认错了理由**，
 * 落到「高分可能量的是别的东西」，骨架和高潮都不同。第六周中级档 Frame by Frame 也是学生
 * 做项目，但那篇是定格动画、算帧数。没有比赛最后反超（他们没得奖），没有台上卡壳（评委只问了
 * 一个问题），没有作弊（作者「想把旧数字放回去」但没放，题目里也不考这个当动机）。
 *
 * 人名都没在前八周出现过（grep 过整个 content 目录）：Shreya、Mr Kuah、Bowen，也都不是普通
 * 英文单词。叙述者性别原文没写明，题干和参考答案一律用 the writer。
 *
 * 事实核对（把握程度）：
 *   · 「不用写代码、给程序看每一类的照片它就自己学会区分」的免费网站确实存在（文中不点名任何
 *     产品）—— 把握高。
 *   · 狼与哈士奇：Ribeiro、Singh、Guestrin 2016 年的论文 "Why Should I Trust You?" 里，研究者
 *     有意训练了一个分类器，它看起来能分狼和哈士奇，解释工具显示它主要靠背景里的雪。原文只写
 *     "researchers built a program that appeared to tell wolves from huskies, and then showed that it
 *     was mostly looking for snow in the background"，不写年份、人名、准确率 —— 把握高。
 *   · 「程序只给出最有把握的一类和一个百分比；拿不准时会在 50% 上下」是这类分类器的正常表现 ——
 *     把握高。98%、84%、99%、52% 都是故事里的数字。
 *
 * 追加三篇的选题、梗概与结局：
 *   周三  community  The Instructions on the Lid：社区周末游戏活动一直依赖作者；作者想退出
 *                    两个周六，却发现自己写的交接单只有老手看得懂。让新志愿者实际操作后，
 *                    把隐含知识写成具体步骤，也允许对方改变布置。结局：手机没有求助消息，
 *                    作者第一次安心吃完家庭午餐；不是临时赶回去救场。
 *   周四  culture    Two Lines at a Time：作者替家庭短片写英文字幕，逐字准确的句子却让
 *                    阿姨的欢迎听起来像抱怨。保留原话、补足目的，并让字幕配合手势出现，
 *                    最后承认文化细节无法全挤进两行。结局：观众继续追问，而非一切解释完毕。
 *   周五  learning   A Choice Worth Making（GP 议论文）：学校该不该让学生自选课内读物？
 *                    先陈述自主选择带来的投入，再认真处理共同文本、难度与取得书籍的公平；
 *                    用个人课堂实例权衡两方最强论据，结论是有指导、有共同学习、人人可取得
 *                    的有限选择。短语题与两道简答考立场、例证作用及对反方的回应。
 *
 * 追加稿查重：完整对照 pack-titles-1023 / read-titles-1023，并在内容包与 test-fixtures
 * 检索 subtitle / subtitling / reading list / class reader / book choice / board.game /
 * games club / handover。未发现同题材与同高潮。相近旧文已读相关正文核对：
 *   · The Group Project 是误判安静同伴的贡献，本周三是交接隐含知识及让活动不依赖一个人；
 *     The Prize Money 是班级讨论如何感谢清洁工，本周三没有奖励、表决或请别人替自己收尾。
 *   · Speaking for My Mother 是有意修改家校谈话；To the End of the Line 是接待交换生、
 *     从地铁找到共同兴趣。本周四无隐瞒、无机器翻译笑话，冲突在字幕的语气、长度与时机。
 *   · Volume One 是舍不得出让漫画，As Grey as My Mood 是摆脱范文套句，The Test That
 *     Teaches 是提取练习。本周五讨论课内读物选择的边界，不讲记忆法、练题或作文套句，
 *     也不重复周二的「高分量错对象」。四篇结局依次为迁移反思 / 成功退场 / 留下问题 /
 *     有条件的议论结论。未采用 brief 禁用的叙事套路。
 * 新人物 Devika、Hafizah 已检索前八周内容包及旧题库，无命中；不沿用第八周人名。
 *
 * 追加稿事实核对（把握程度）：三篇的活动、人物、影片、课堂经历均为原创虚构，
 * 不冒充实证研究；周五的学校方案是作者建议，不代表任何学校现行规定。
 * 周三交接步骤只约束故事里的活动；周四「最多两行」是两人事先约定，不声称是通用标准，
 * 阿姨话里的客气只由这段影片的笑容、拉椅子与摆茶杯支持，不推广到所有家庭或语言。
 * 周五「共同文本可共同检验证据」「所选书应有适当挑战、所有人可取得」是可由例子检验的
 * 教学论证（把握高），不写学习效果比例、研究者、年份或未经核实的普遍因果结论。
 *
 * 全周四天判断题分布：周二 / 周三 / 周四 / 周五均为 0 道；TRUE 0、FALSE 0、
 * NOT GIVEN 0。本档沿用第八周结构，本来没有判断题，故判断题平衡规则不适用。
 * 徽章主题按日期：technology / community / culture / learning；仅周五为 GP 议论文，
 * 周二、周三、周四为记叙文。情绪配对均锁定叙述者的具体动作，词库不放同义情绪干扰。
 */

'use strict';

const { buildAuthoredDay, numbered } = require('../authored');
const { DATES } = require('./dates');

const LEVEL = 'olevel';

// ═══════════════════════════════════════════════════════════════
// 周二 —— The Slipper Test（徽章：technology）
//
// 中三的 Applied Learning 项目，作者和 Shreya 选了以为最省事的题目：给食堂做一个能分辨易拉罐和
// 塑料瓶的「智能垃圾桶」，用一个不用写代码的免费网站，给程序看照片它就自己学。Mr Kuah 提醒
// 「难的是照片，不是程序」，两人当他夸张。分工：作者收罐子、在家里白色餐桌上拍（那里光线最好），
// Shreya 收瓶子、在科学实验室灰色桌子上拍——谁都没觉得这个细节值得说。程序测出 98%，作者在班级
// 群里发了三个感叹号，Shreya 对着镜子练开场白。周六八岁的弟弟 Bowen 无聊，把拖鞋放上餐桌——
// 「Can，97%」；勺子、橘子、手肘全是罐子。作者一把抢过手机吼他「别弄坏了」，为了证明他错，
// 把真罐子拿到灰沙发上——程序很肯定那是瓶子。作者花了一晚上才接受：程序根本没学罐子长什么样，
// 它学的是白桌子；98% 是「认得我家厨房」的满分。Mr Kuah 不意外，讲了狼和哈士奇（其实在看雪）的
// 研究：「它回答的是你真正问的问题，不一定是你想问的那个。」Shreya 说最让她后怕的是：要不是
// Bowen 无聊，他们永远发现不了。重拍：故意拍得乱——食堂地上、书包里、别人手里、走廊黄灯下，
// 也包括那张餐桌，让所有罐子照片唯一的共同点只剩罐子。三个周末，结果 84%；作者盯着数字脸一沉，
// 别组都说 99%，差点把旧数字放回海报。弟弟再测拖鞋：「Can，52%」——Shreya 说这是程序在耸肩。
// 最后两个数都上了海报，中间画着拖鞋；评委问为什么故意把成绩弄差，作者解释第一个数衡量的是程序
// 认得厨房、第二个量的是认得罐子。评委记了一笔就走了，他们没得奖。两周后作者复习化学，把同
// 二十道练习题刷到全对，忽然想到那张餐桌：也许只是认得这二十道题。请 Shreya 出五道新题，错了
// 四道——考试还有三天，作者从没这么感激一个低分。
//
// 选题理由：AI 是学生天天听到的词，这篇用一个他们自己做得出的小实验讲清「机器学到的未必是你
// 想教的」，技术细节准确、零术语；言外之意多（谁都没提背景、「程序在耸肩」、没得奖却说那个低分
// 才诚实）。结局类型：把道理转到自己身上。
// 数字自洽：一百五十个罐子 + 一百五十个瓶子 = 三百张照片；先测二十张全对，后来大测 98%；
// 重拍三个周末后 84%；化学五道新题错四道；考试在三天后。
// ═══════════════════════════════════════════════════════════════

const SLIPPER_TEST = {
  key: 'original-w9-the-slipper-test',
  title: 'The Slipper Test',
  passage: numbered([
    `For our Applied Learning project in Secondary Three, Shreya and I chose what we assumed was the easy option: a "smart bin" that could tell drink cans from plastic bottles. A free website would do the hard part: shown enough photographs of each kind of object, the program gradually worked out the difference for itself. Mr Kuah, our teacher, warned that the photos would be harder than the program. We nodded, convinced he was exaggerating.`,
    `We divided the work in the obvious way. I photographed a hundred and fifty cans at home on our white kitchen table, because the light there was better than anywhere else in the flat. Shreya photographed her bottles on the grey desks of the science lab, where she stayed back every Wednesday. Neither of us considered this detail worth mentioning.`,
    `After studying our three hundred photos for less than a minute, the program was tested on a larger set it had never seen and was accurate ninety-eight per cent of the time. I sent the number to our class chat with three exclamation marks, and Shreya began rehearsing our presentation in front of her mirror.`,
    `That Saturday my brother Bowen, who is eight and was bored, demanded a turn. He put his slipper on the kitchen table and held my phone above it. "Can," the screen announced, "97 per cent." A spoon, an orange and his elbow were, apparently, cans too. "Stop it," I snapped, grabbing the phone back. Then, to prove him wrong, I carried a real can to our grey sofa. The program was quite certain it was looking at a bottle.`,
    `It took me all evening to accept, reluctantly, what that meant. The program had never learned what a can looked like. It had noticed that every can photo contained a white table and every bottle photo a grey desk, a rule far simpler than anything about shapes or labels. Our ninety-eight per cent was, in effect, an excellent score for recognising my kitchen.`,
    `Mr Kuah was not surprised. Researchers in one well-known study, he told us, built a program that appeared to tell wolves from huskies, then showed that it was mostly looking for snow in the background. "It answers the question you actually asked," he said, "which is not always the one you meant to ask." Shreya later admitted what worried her most: without a bored eight-year-old, we would never have found out.`,
    `So we retook every photo, this time in deliberately varied settings: on the canteen floor, inside school bags, in people's hands, under yellow corridor lights and, of course, on my kitchen table, so that the only thing all the can photos shared was the can. It took three weekends, and the new program was right eighty-four times out of a hundred. I stared at the number with a sinking heart. Other groups were claiming ninety-nine, and I was tempted to put our old result back.`,
    `Both numbers went on the poster, with Bowen's slipper drawn between them; the program now called it a can with only fifty-two per cent confidence, which Shreya called its way of shrugging. When a judge asked why we had made our result worse on purpose, I explained that the first number measured how well the program knew my kitchen, and the second how well it knew cans. She wrote something down and moved on. We did not win.`,
    `Two weeks later, I was revising for a chemistry test by repeating the same twenty practice questions until I got every one right. Then I thought of the kitchen table. Perhaps I had learned not chemistry but those twenty questions. I asked Shreya to write five new ones and got four wrong. With the test still three days away, I have never been so grateful for a bad score.`,
  ]),
  questions: [
    {
      kind: 'matchingFeelings',
      bank: ['proud', 'irritated', 'disappointed', 'grateful', 'homesick', 'lonely', 'sleepy', 'sympathetic'],
      items: [
        { moment: 'Paragraph 3 — sending the ninety-eight per cent to the class chat with three exclamation marks', answer: 'proud', para: 3 },
        { moment: 'Paragraph 4 — snapping "Stop it" at Bowen and grabbing the phone back', answer: 'irritated', para: 4 },
        { moment: 'Paragraph 7 — staring at the new result of eighty-four out of a hundred', answer: 'disappointed', para: 7 },
        { moment: 'Paragraph 9 — realising that the four wrong answers had exposed the problem while there were still three days to fix it', answer: 'grateful', para: 9 },
      ],
    },
    {
      kind: 'mcq',
      stem: 'In Paragraph 6, what does Mr Kuah mean when he says the program "answers the question you actually asked, which is not always the one you meant to ask"?',
      answer: 'It finds whatever difference separates the photos, even one its users never had in mind.',
      distractors: [
        'It can only be trusted after it has been shown many more photos.',
        'It works better on animals such as wolves than on cans and bottles.',
        'It would have been more accurate if the pair had written their own code.',
      ],
      evidence: '"It answers the question you actually asked," he said, "which is not always the one you meant to ask."',
    },
    {
      kind: 'gapChoice',
      stem: 'In the study Mr Kuah described, the program was mostly looking for ______ in the background.',
      answer: 'snow',
      distractors: ['wolves', 'huskies', 'trees'],
      evidence: 'built a program that appeared to tell wolves from huskies, then showed that it was mostly looking for snow in the background.',
    },
    {
      kind: 'short',
      marks: 2,
      stem: 'According to Paragraph 2, where did the writer and Shreya each photograph their objects, and why did the writer choose that particular place?',
      answer:
        'The writer photographed the cans on the white kitchen table at home and Shreya photographed the bottles on the grey desks in the science lab; the writer chose the kitchen table because the light there was better than anywhere else in the flat.',
      evidence:
        'I photographed a hundred and fifty cans at home on our white kitchen table, because the light there was better than anywhere else in the flat.',
      rubric:
        '两分：两问各 1 分。①地点：两人的地点都要写出才给这 1 分——作者在家里的白色餐桌上拍罐子，Shreya 在科学实验室的灰色桌子上拍瓶子（「家里的桌子 / 实验室的桌子」即可，颜色不要求）。只写出一个人的地点不给这 1 分。②原因：那里的光线比家里别处都好。答「因为 Shreya 每周三都留校」不给第二分——那是 Shreya 在实验室拍的原因，题目问的是作者。答「为了让程序分清背景」不给分——两人当时根本没想到背景（原文：Neither of us considered this detail worth mentioning）。',
    },
    {
      kind: 'short',
      marks: 2,
      stem: 'Using your own words, explain what the program had really learned, and what the writer did that showed this (Paragraphs 4–5).',
      answer:
        'It had learned to tell the two backgrounds apart — a white table meant "can" and a grey desk meant "bottle" — rather than what a can looks like; the writer put a real can on the grey sofa and the program said it was a bottle.',
      evidence:
        'It had noticed that every can photo contained a white table and every bottle photo a grey desk, a rule far simpler than anything about shapes or labels.',
      rubric:
        '两分：两问各 1 分。①学到的：它学会的是背景 / 桌子的颜色（白桌子就是罐子、灰桌子就是瓶子），而不是罐子本身的样子（写出「它在认桌子 / 背景」或「它认得的是作者家的厨房」即可）。只写「它没学会罐子长什么样」不给第一分——只说了没学会什么，题目问的是学会了什么。②作者做了什么：把一个真罐子拿到灰色沙发上拍，程序说那是瓶子（要写出「真罐子放在灰色的东西上被认成瓶子」）。答「弟弟把拖鞋放在餐桌上，被认成罐子」不给第二分——那是 Bowen 做的，题目问的是作者自己做的。',
    },
    {
      kind: 'short',
      marks: 2,
      stem: 'According to Paragraph 7, how did the writer and Shreya take their new photos differently, and what were they trying to achieve?',
      answer:
        'They photographed the cans and bottles in many different places on purpose (the canteen floor, school bags, people\'s hands, the corridor, the kitchen table), so that the can itself would be the only thing all the can photos had in common.',
      evidence:
        'so that the only thing all the can photos shared was the can.',
      rubric:
        '两分：两问各 1 分。①做法：故意在很多不同的地方 / 背景下拍（写出「换很多背景」，或举出两个以上地点——食堂地上、书包里、别人手里、走廊黄灯下、作者家餐桌——即可）。只写「把照片全部重拍了一遍」不给第一分——题目问的是怎么拍得不一样。②目的：让所有罐子照片唯一的共同点只剩罐子本身（写出「让程序只能靠罐子本身来认 / 背景不再起作用」也给分）。答「为了让分数更高」不给第二分——重拍后分数反而降了。',
    },
    {
      kind: 'short',
      marks: 2,
      stem: 'What did the writer tell the judge about the two numbers on the poster (Paragraph 8), and what did the writer fear might be true about the chemistry revision (Paragraph 9)?',
      answer:
        'The first number showed how well the program knew the writer\'s kitchen, and the second how well it knew cans; the writer feared that repeating the same twenty questions had taught only those twenty questions, not chemistry.',
      evidence: 'Perhaps I had learned not chemistry but those twenty questions.',
      rubric:
        '两分：两问各 1 分。①对评委说的：第一个数衡量的是程序认不认得作者家的厨房，第二个数衡量的是认不认得罐子（两层意思都要有；写出「第一个数只说明它认得厨房」并点出第二个才是真认罐子即可）。只写「我们故意把成绩弄差」不给第一分——那是评委的问题，不是作者的回答。②担心的：自己可能根本没学会化学，只是记住 / 认得那二十道题（写出「只会做那二十道练习题」即可）。答「怕考试来不及复习」不给第二分——原文说离考试还有三天，作者反而庆幸。',
    },
  ],
};

// ═══════════════════════════════════════════════════════════════
// 周三 —— The Instructions on the Lid（徽章：community；非 GP 议论文）
// 不是教一个小窍门，而是把独占的活动知识交出去；退场后事情仍能继续，才算交接完成。
// ═══════════════════════════════════════════════════════════════

const INSTRUCTIONS_ON_THE_LID = {
  key: 'original-w9-instructions-on-the-lid',
  title: 'The Instructions on the Lid',
  passage: numbered([
    `Every Saturday, I helped run an afternoon of board games at a community centre. Anyone could join, although the regular visitors usually arrived before we had finished arranging the tables. After six months, I knew which boxes had missing pieces and which cupboard contained the spare counters. Whenever a volunteer had a question, someone pointed towards me. I secretly enjoyed being the person everyone needed. That dependence was reassuring, although I confused being useful with remaining essential.`,
    `Then my parents arranged two Saturday lunches with relatives, and I asked to take those afternoons off. Devika, another volunteer, agreed to open the room. Before handing over the key, I wrote a page of instructions: set up as usual, check the games, welcome newcomers. Reading it through, I nodded at how efficiently I had reduced six months of experience to three concise lines. I mistook their brevity for clarity.`,
    `During our practice session, Devika opened the cupboard and immediately stopped. Which tables were usual? Did checking mean counting every piece? Were newcomers supposed to register somewhere? Each question exposed an assumption I had left implicit, although it seemed unnecessary until I tried answering without pointing. My page offered no explicit guidance to readers who lacked my experience. I turned it face down, wishing I had written rather less confidently.`,
    `We started again, with Devika doing the work while I watched. When she reached for a box, I almost told her to choose another, then made myself wait. She discovered that its instructions were missing. I knew they were inside a different lid, but no label connected the two. Knowledge that had felt like experience now looked suspiciously like a collection of details I had accumulated but never bothered to write down.`,
    `The new guide included photographs of the cupboards and a drawing showing where tables could go without blocking the entrance. Under each game title, we listed anything missing and where its replacement was kept. Yet we deliberately left the table arrangement flexible: a visitor using a chair with wheels might need more space, and a large group might prefer two tables together. Clear instructions, Devika argued, should explain decisions while leaving room for discretion.`,
    `On the first Saturday away, I kept my phone beside my plate. Every time its screen lit up, I checked it before taking another mouthful. Nothing came from the centre. Eventually I sent a message asking whether they needed help, then stared at the little clock beside it. I imagined the cupboard open, the tables empty and Devika too busy to reply. I struggled to resist the instinct to intervene.`,
    `Her answer arrived with a photograph. People were playing beside the windows, where I had never put the tables because the cupboard was farther away. She had moved them for better light. I enlarged the picture, preparing to explain my arrangement, then noticed the spare pieces laid out within reach. The problem I was about to mention had already been solved without me.`,
    `The following week, I found our guide attached inside the largest box lid, with a pencil beside it for corrections. Someone had added a suggestion for welcoming people who arrived alone: offer a place in a game before asking whether they knew anyone. Devika had also shown a third volunteer how to open the room. I asked who had added the suggestion, but neither of us knew.`,
    `At the second family lunch, my phone stayed in my bag. When we reached dessert, I realised I had eaten the whole meal without checking it once, and let out a long breath. Later, there were still no questions waiting for me. For the first time, that silence felt like something I had helped create rather than evidence that I had been forgotten.`,
  ]),
  questions: [
    {
      kind: 'matchingFeelings',
      bank: ['proud', 'embarrassed', 'anxious', 'relieved', 'jealous', 'bored', 'amused', 'homesick'],
      items: [
        { moment: 'Paragraph 2 — nodding after reducing six months of experience to three lines', answer: 'proud', para: 2 },
        { moment: 'Paragraph 3 — turning the page face down after trying to answer Devika without pointing', answer: 'embarrassed', para: 3 },
        { moment: 'Paragraph 6 — checking every screen light and imagining Devika unable to reply', answer: 'anxious', para: 6 },
        { moment: 'Paragraph 9 — reaching dessert without checking the phone and letting out a long breath', answer: 'relieved', para: 9 },
      ],
    },
    {
      kind: 'mcq',
      stem: 'In Paragraph 9, what does the writer mean by calling the silence "something I had helped create"?',
      answer: 'The writer had helped others run the activity without needing to ask for help.',
      distractors: [
        'The writer had arranged to keep the phone in a bag until the family lunch ended.',
        'The writer had asked visitors to choose quieter games near the windows.',
        'The writer had persuaded volunteers to leave all corrections inside a box lid.',
      ],
      evidence: 'For the first time, that silence felt like something I had helped create rather than evidence that I had been forgotten.',
      explanation: '结合第 8 段第三名志愿者也已会开门与第 9 段没有求助消息，可知 silence 指活动已能独立运作；并非手机设置、游戏音量或修改位置。',
    },
    {
      kind: 'gapChoice',
      stem: 'To make the guide easier to improve, a ______ was left beside it inside the box lid.',
      answer: 'pencil',
      distractors: ['key', 'counter', 'plate'],
      evidence: 'The following week, I found our guide attached inside the largest box lid, with a pencil beside it for corrections.',
    },
    {
      kind: 'short',
      marks: 2,
      stem: 'Using your own words, explain why the first guide was inadequate, and how the practice session exposed this (Paragraph 3).',
      answer: 'It relied on knowledge that only experienced volunteers had; Devika could not tell which tables to use, what checking involved or how to welcome newcomers without asking the writer.',
      evidence: 'My page offered no explicit guidance to readers who lacked my experience.',
      rubric: '两分：两问各 1 分。①缺陷：说明单默认读者已经知道应当解释的背景 / 只有老手才懂的做法；合理同义改写给分。只说「太短 / 三行」不给第一分，须指出缺少让新人独立操作的信息。②暴露方式：Devika 对照单子仍要询问桌子如何摆、检查包括什么、或新来者是否登记，任举一例并点出不能独立判断即给分。只说「她打开了柜子」不给第二分。',
    },
    {
      kind: 'short',
      marks: 2,
      stem: 'According to Paragraphs 4–5, identify ONE problem with finding game materials and explain how the revised guide addressed it.',
      answer: 'Instructions or other pieces could be missing from their expected box, with no label showing where to find them; the revised guide recorded what each game lacked and where its replacement was kept.',
      evidence: 'Under each game title, we listed anything missing and where its replacement was kept.',
      rubric: '两分：①问题 1 分：游戏说明不在原盒里、在别的盒盖中又无标签指引，或材料缺失且存放处只有作者知道；合理同义改写给分。只说「桌子摆错」不给此分。②对应改法 1 分：按游戏列出缺什么以及替代材料放在哪里，两层都要有；只说「拍柜子照片 / 写得详细」不足以回答缺失材料的对应办法。两点可写在同一句中，不重复计分。',
    },
    {
      kind: 'short',
      marks: 2,
      stem: 'Why was the table arrangement left flexible in Paragraph 5, and what does Devika\'s later arrangement show about this decision (Paragraph 7)?',
      answer: 'Different visitors might need different amounts of space or joined tables; Devika was able to improve the light by moving tables while keeping spare pieces within reach.',
      evidence: 'She had moved them for better light.',
      rubric: '两分：两问各 1 分。①保留灵活性的原因：不同来客需要不同布置；答轮椅使用者需要更多空间，或大组需要拼桌，任一即给分。只说「为了靠近柜子」不给第一分。②后来证明：Devika 能自己调整布置、改善采光，同时仍让备用材料便于取用；写出改善采光和材料可及两层才给此分，合理改写给分。只说「她照原样摆桌」不给分，原文明确换了位置。',
    },
    {
      kind: 'short',
      marks: 2,
      stem: 'Give TWO details from Paragraph 8 showing that responsibility for the activity was spreading beyond the writer and Devika.',
      answer: 'Another person had added a suggestion about welcoming people arriving alone, and Devika had trained a third volunteer to open the room.',
      evidence: 'Devika had also shown a third volunteer how to open the room. I asked who had added the suggestion, but neither of us knew.',
      rubric: '两分：两个独立细节各 1 分。①另有人在交接单上补充如何接待独自来的人（作者与 Devika 都不知道是谁加的，表明来自他人）。②第三名志愿者也被教会如何开门 / 开场。合理同义改写均给分。只说「单子贴在盒盖上 / 旁边有铅笔」不给分，那只是允许参与的工具，不是已有其他人承担责任的细节；两个写法都在描述同一条接待建议只给 1 分。',
    },
  ],
};

// ═══════════════════════════════════════════════════════════════
// 周四 —— Two Lines at a Time（徽章：culture；非 GP 议论文）
// 两行限制是这次短片的内部约定；人物的客气与欢迎由画面证据支持，不概括整个文化。
// ═══════════════════════════════════════════════════════════════

const TWO_LINES_AT_A_TIME = {
  key: 'original-w9-two-lines-at-a-time',
  title: 'Two Lines at a Time',
  passage: numbered([
    `When Hafizah asked me to write English subtitles for her short film, I accepted without hesitation. She had filmed my aunt preparing tea for a family visit, with permission to use it at our school film afternoon. My aunt spoke Mandarin, which I used at home. I sent Hafizah a cheerful message promising to finish before dinner, pleased that someone finally needed a skill I already possessed.`,
    `We agreed that each subtitle would occupy no more than two lines, so people could watch the picture as well as read. The first sentences were straightforward: put the cups here, bring another chair. Then my aunt saw her cousin at the doorway and said, "You came all this way just for tea?" I typed exactly that. Literal accuracy seemed to guarantee clarity.`,
    `Reading the subtitles without sound, Hafizah paused the film. "Does she wish they hadn't come?" I stared at her, reluctant to accept that interpretation. In the picture, my aunt was pulling out a chair with a broad smile. Nothing in the English sentence explained why a question about an unnecessary journey accompanied such an eager welcome. I played the scene again, no longer certain what I had translated.`,
    `I tried making the intention explicit: she was delighted that her cousin had made the journey and wanted to acknowledge the trouble taken. The sentence filled four lines. When I shortened it, the supposedly concise explanation sounded like a formal speech, although my aunt was laughing. After an hour, I pushed the keyboard away. I could understand both languages; why did conveying this subtle welcome feel impossible?`,
    `At home, I asked my aunt what she meant. She said she was happy he had come, of course, but simply writing "Welcome" would remove her surprise at his effort. Her courtesy acknowledged both the distance travelled and the pleasure of his company. Read alone, however, the implication could sound like dismissal. She also reminded me that viewers would see her hands moving towards the chair. I had been translating as though the words had to carry the whole visit by themselves.`,
    `Our next version kept the question and added a brief phrase: "You came all this way just for tea? How lovely!" We let it appear as she pulled the chair out, rather than before the gesture began. Hafizah watched, then laughed when the cousin replied that he expected biscuits too. This time the humour followed the invitation; the ambiguity in my first version had made his reply sound like another complaint.`,
    `Some subtleties resisted compression. Our constraints involved more than space. My aunt used a family nickname for the cousin, but its elaborate history would have covered the screen. We kept the nickname and put a short explanation in the programme. We also retained a pause while she considered which cup to give him. Filling that silence with information would have hidden the small decision taking place in her face.`,
    `At the film afternoon, I watched the row in front of me instead of the screen. When the chair moved and the subtitle appeared, a student smiled; at the biscuit reply, several people laughed. I stopped twisting the programme in my lap. They were following the exchange without looking towards me for an explanation, and I could finally sit back and watch my aunt pour the tea.`,
    `Afterwards, someone asked about the nickname, and another wanted to know why she had chosen the smaller cup. We had explained the first in the programme; I would have to ask my aunt about the second. I once thought translation required complete certainty. Now I was glad that these had left people curious about the visit. I could preserve her voice without claiming an exact equivalent for every nuance.`,
  ]),
  questions: [
    {
      kind: 'matchingFeelings',
      bank: ['confident', 'puzzled', 'frustrated', 'relieved', 'jealous', 'homesick', 'bored', 'ashamed'],
      items: [
        { moment: 'Paragraph 1 — promising in a cheerful message to finish the subtitles before dinner', answer: 'confident', para: 1 },
        { moment: 'Paragraph 3 — staring at Hafizah and replaying the welcome, uncertain what has been translated', answer: 'puzzled', para: 3 },
        { moment: 'Paragraph 4 — pushing the keyboard away after an hour of unsuccessful revisions', answer: 'frustrated', para: 4 },
        { moment: 'Paragraph 8 — stopping twisting the programme and sitting back as viewers follow the exchange', answer: 'relieved', para: 8 },
      ],
    },
    {
      kind: 'mcq',
      stem: 'In Paragraph 5, what does the writer mean by saying that "the words had to carry the whole visit by themselves"?',
      answer: 'The writer had tried to explain everything verbally instead of also using the picture.',
      distractors: [
        'The writer had put the family nickname into the programme instead of onto the screen.',
        'The writer had expected two lines to explain the history of every member of the family.',
        'The writer had kept the pause while the aunt decided which cup to give her cousin.',
      ],
      evidence: 'She also reminded me that viewers would see her hands moving towards the chair. I had been translating as though the words had to carry the whole visit by themselves.',
      explanation: 'carry 在这里指承担传意的工作。阿姨提醒作者观众也看得到动作，因此字幕不必独自解释全部含义；其他选项是后续保留细节的方法或夸大后的两行限制。',
    },
    {
      kind: 'gapChoice',
      stem: 'Viewers could find the explanation of the family nickname in the ______.',
      answer: 'programme',
      distractors: ['subtitle', 'message', 'question'],
      evidence: 'We kept the nickname and put a short explanation in the programme.',
    },
    {
      kind: 'short',
      marks: 2,
      stem: 'Using your own words, explain why Hafizah\'s reading of the question did not fit the picture in Paragraph 3.',
      answer: 'The English question made the visit sound unwanted or unnecessary, whereas the aunt was smiling broadly and pulling out a chair to welcome the cousin.',
      evidence: 'Nothing in the English sentence explained why a question about an unnecessary journey accompanied such an eager welcome.',
      rubric: '两分：两个相反的信息各 1 分。①文字使 Hafizah 以为阿姨不希望来客出现 / 嫌对方没必要跑这一趟；②画面里阿姨笑着拉出椅子、热情欢迎（写出笑或拉椅子，并表明欢迎即可）。合理同义改写给分。只说「阿姨讲普通话、Hafizah 读英文」不解释理解冲突，不给分；写「阿姨实际不想让他来」不给第二分。',
    },
    {
      kind: 'short',
      marks: 2,
      stem: 'What TWO problems did the writer encounter when revising the subtitle in Paragraph 4?',
      answer: 'The full explanation was four lines long and exceeded their agreed limit; shortening it made the aunt sound formally serious even though she was laughing.',
      evidence: 'The sentence filled four lines. When I shortened it, the supposedly concise explanation sounded like a formal speech, although my aunt was laughing.',
      rubric: '两分：两项问题各 1 分。①完整说明占四行 / 超过约定的两行限制；②缩短后像正式演讲、不合阿姨笑着说话的语气。合理同义改写给分。只写「花了一个小时」或「懂两种语言」不给分；把两项都写成「太长 / 超两行」视为同一点，只给 1 分。',
    },
    {
      kind: 'short',
      marks: 2,
      stem: 'According to Paragraphs 5–6, what did the added phrase clarify, and how did the timing help the revised subtitle work?',
      answer: '"How lovely!" clarified that the aunt was pleased and welcoming rather than complaining; showing it as she pulled out the chair let the visible welcome support the words.',
      evidence: 'We let it appear as she pulled the chair out, rather than before the gesture began.',
      rubric: '两分：两问各 1 分。①补充短语的作用：表明阿姨很高兴、是在欢迎，不是在抱怨路远（写出欢迎 / 高兴即可）。只照抄 How lovely 而不解释作用不给第一分。②时机的作用：在拉椅子动作出现时出字幕，让画面的欢迎手势支持 / 澄清话意；须点出动作与字幕同步的联系，合理改写给分。只说「更早出现 / 字更少」不给第二分。',
    },
    {
      kind: 'short',
      marks: 2,
      stem: 'Using Paragraphs 7–9, explain how the nickname and the smaller cup left the writer with different kinds of questions to answer.',
      answer: 'The nickname was understood by the writer but explained in the programme because its history would take too much screen space; the reason for choosing the smaller cup was still unknown to the writer and would have to be checked with the aunt.',
      evidence: 'We had explained the first in the programme; I would have to ask my aunt about the second.',
      rubric: '两分：两个不同情形各 1 分。①昵称：作者知道其来历，只因字幕放不下而转到节目单解释；须写出已知并另有说明的意思，合理同义改写给分。②小杯：作者自己仍不知道选择理由，须再问阿姨。只写「观众问了两个问题」不给分；把小杯理由猜成某种传统、或说节目单也解释了杯子，不给第二分。',
    },
  ],
};

// ═══════════════════════════════════════════════════════════════
// 周五 —— A Choice Worth Making（徽章：learning；GP 议论文）
// 论题：学校是否应让学生自选课内读物。个人课堂例证服务于论证，不当作普遍研究结论；
// 九段依次：论题与暂定立场 / 自主的最强理由 / 例证与限度 / 共同文本的最强理由 /
// 反例与让步 / 难度、取得机会的公平 / 有指导的选择 / 可行方案与作者反应 / 条件性结论。
// ═══════════════════════════════════════════════════════════════

const CHOICE_WORTH_MAKING = {
  key: 'original-w9-a-choice-worth-making',
  title: 'A Choice Worth Making',
  passage: numbered([
    `Should students choose their books for English lessons? When our class reading list appeared last year, I waved it at a friend, certain that I could choose more wisely than our teacher. An approved book seemed less like an invitation than an instruction. I still believe students should have some choice, although the strongest argument for it is more demanding than simply letting everyone read whatever they fancy.`,
    `Supporters of choice argue that interest gives readers a reason to continue when a text becomes difficult. A student fascinated by how buildings are designed might willingly examine a demanding account of an architect's work, while abandoning an easier story about a subject that means little to them. Choosing also requires readers to justify their selection and accept responsibility for a decision, rather than waiting to be entertained.`,
    `I recognised that argument when our teacher allowed one book of our own alongside the class novel. I chose a collection of travel letters and kept reading past the assigned time, smiling when the bell interrupted me halfway through a page. Yet pleasure alone proves little. My enthusiasm showed that choice could encourage attention; it did not demonstrate that every book I liked would develop the skills our lessons were intended to teach.`,
    `Those who defend a common text have a powerful response. When everyone has read the same passage, each interpretation can be checked against evidence available to the whole class. A teacher can ask why a character stayed silent, and students can challenge one another's explanations by returning to a particular sentence. This collective enquiry is harder when every claim requires a lengthy summary of a book that nobody else has read.`,
    `Our first discussion of our separate books exposed that difficulty. I began explaining a letter, but spent my entire turn describing the journey behind it. When a classmate finally asked about the writer's tone, our time was up. I closed the book sharply, irritated that the part worth discussing had never been reached. Granted, a common text would have saved that explanation. Freedom had given me something to say without giving us enough common ground to examine it.`,
    `There are other objections worth taking seriously. Unrestricted choice might allow a reader to avoid unfamiliar styles indefinitely. Nor is a choice fair if some books must be bought while others can be borrowed. However, these concerns support guidance and fair provision, rather than the conclusion that students should make no decisions. A teacher could offer several suitable books already available in the school library and discuss each student's reasons for choosing.`,
    `Guidance should also leave room for revision. If the opening pages are unappealing, a student could first explain the difficulty: is the subject uninteresting, or is an unfamiliar voice making the reading slower? Those are different problems. Requiring a conversation before a change would preserve a genuine decision while preventing the easiest book from automatically becoming the final choice. It would also give teachers a chance to suggest help.`,
    `For lessons, I would keep a common book or extract and add a guided choice from books everyone can obtain. Groups choosing the same title could discuss it together, then bring one short passage to the class. When our teacher suggested that arrangement, I relaxed my grip on my book. We would still have something worth comparing, and I would no longer need to explain a whole journey before anyone could question my reading.`,
    `Choice deserves a place in school reading when it expands both personal interest and shared understanding. While it is true that a single prescribed book makes discussion simpler, simplicity cannot justify restricting autonomy. Schools should offer choice where suitable texts, access and time for discussion can be provided; without those conditions, the promise of freedom may remain more attractive than the learning it produces.`,
  ]),
  questions: [
    {
      kind: 'matchingFeelings',
      bank: ['confident', 'delighted', 'frustrated', 'relieved', 'guilty', 'homesick', 'lonely', 'sleepy'],
      items: [
        { moment: 'Paragraph 1 — waving the list at a friend, certain of being able to choose more wisely than the teacher', answer: 'confident', para: 1 },
        { moment: 'Paragraph 3 — reading beyond the assigned time and smiling when the bell interrupts a page', answer: 'delighted', para: 3 },
        { moment: 'Paragraph 5 — closing the book sharply when time runs out before the discussion reaches the tone', answer: 'frustrated', para: 5 },
        { moment: 'Paragraph 8 — relaxing the grip on the book when the teacher suggests the combined arrangement', answer: 'relieved', para: 8 },
      ],
    },
    {
      kind: 'mcq',
      stem: 'In Paragraph 5, what does "without giving us enough common ground to examine it" suggest about the writer\'s position?',
      answer: 'Choice is valuable, but discussion also needs material that participants can share.',
      distractors: [
        'Reading beyond the assigned time is enough to show that a chosen book is suitable.',
        'Keeping one common text is enough to remove the need for students to make choices.',
        'Choosing a book about travel is enough to make its background clear to the class.',
      ],
      evidence: 'Freedom had given me something to say without giving us enough common ground to examine it.',
      explanation: 'GP 立场题：作者承认自选书带来表达内容，也接受共同文本便于检验证据这一反方理由，故主张有共同基础的有限选择；其余选项把文中提到的一项条件当成充分条件。',
    },
    {
      kind: 'gapChoice',
      stem: 'Before changing a book, the writer proposes requiring a ______ to explore the reason for the difficulty.',
      answer: 'conversation',
      distractors: ['summary', 'journey', 'decision'],
      evidence: 'Requiring a conversation before a change would preserve a genuine decision while preventing the easiest book from automatically becoming the final choice.',
    },
    {
      kind: 'short',
      marks: 2,
      stem: 'Using your own words, explain the TWO arguments for student choice made in Paragraph 2.',
      answer: 'Interest can motivate students to persist with difficult reading, and making a choice requires them to explain their selection and take responsibility instead of passively expecting entertainment.',
      evidence: 'Choosing also requires readers to justify their selection and accept responsibility for a decision, rather than waiting to be entertained.',
      rubric: '两分：两条论据各 1 分。①兴趣能让学生愿意继续读困难文本 / 不轻易放弃；须体现持续投入，单写「喜欢建筑」不给此分。②作选择使学生说明选择理由并主动为决定负责（写出有理由地自主选择 / 承担责任的意思即可）。合理同义改写给分。把两点都写成「更有趣 / 更喜欢」只算第一点，最多 1 分；答「所有喜欢的书都能提升目标技能」不给分，后文明确限制这一推论。',
    },
    {
      kind: 'short',
      marks: 2,
      stem: 'What objection to choice does the common-text argument raise in Paragraph 4, and how does the writer\'s example in Paragraph 5 support it?',
      answer: 'With different books, classmates lack shared evidence and must spend time learning the background before examining an interpretation; the writer used the whole turn explaining a journey, leaving no time to discuss the letter writer\'s tone.',
      evidence: 'I began explaining a letter, but spent my entire turn describing the journey behind it. When a classmate finally asked about the writer\'s tone, our time was up.',
      rubric: '两分：GP 反方论据与例证各 1 分。①反方理由：各读不同书时缺少共同可检查的文本证据 / 要先花时间交代背景，难以深入讨论；合理同义改写给分。只说「老师喜欢同一本书」不给此分。②例子如何支持：作者整段发言都用来介绍旅程，来不及讨论书信语气；须写出背景说明耗尽时间与讨论未展开的联系。只说「作者生气 / 铃响」不给第二分。',
    },
    {
      kind: 'short',
      marks: 2,
      stem: 'How does the writer respond to the objections about unfamiliar styles and unequal access in Paragraphs 6–7?',
      answer: 'The writer proposes guidance, including discussing why a student wants to change a book so unfamiliar writing is not simply avoided, and offering suitable books that everyone can borrow rather than requiring purchases.',
      evidence: 'A teacher could offer several suitable books already available in the school library and discuss each student\'s reasons for choosing.',
      rubric: '两分：两项回应各 1 分。①难度 / 陌生文体：老师指导选择，换书前谈原因、区分不感兴趣与不熟悉的写法，以免一直躲开挑战；写出有针对性的指导或先谈换书原因即可。②机会公平：提供所有人都可从校图书馆借到的合适书籍 / 不要求自费购买。合理同义改写给分。只列出「有的书难、有的书贵」是在复述问题，不给分；说「因此完全取消学生选择」与作者回应相反，不给分。',
    },
    {
      kind: 'short',
      marks: 2,
      stem: 'Using your own words, state the writer\'s proposed arrangement in Paragraph 8 and the conditions placed on choice in Paragraph 9.',
      answer: 'Combine a shared book or extract with guided personal choices, allowing same-title groups to bring a short passage for class discussion; offer choice where suitable books, equal access and discussion time can be provided.',
      evidence: 'Schools should offer choice where suitable texts, access and time for discussion can be provided;',
      rubric: '两分：两问各 1 分。①方案：共同书籍 / 节选与有指导的自选读物结合，两部分都要写出；分组和带节选讨论可补充但不能代替这两个核心。②结论的条件：书籍合适、人人可取得、留有讨论时间，三项都要有才给这 1 分；合理同义改写均给分。只写「支持自由选择 / 自选能提高兴趣」不给第二分，题目问的是边界条件；答「每人随便读、不需要共同材料」不给第一分。',
    },
  ],
};

// 周二那篇（10-27 未发）挪到下周一 11-02，所以排在最后（叶老师 10-27 晚）。
const SPECS = [INSTRUCTIONS_ON_THE_LID, TWO_LINES_AT_A_TIME, CHOICE_WORTH_MAKING, SLIPPER_TEST];

module.exports = {
  LEVEL,
  SPECS,
  DAYS: DATES.slice(0, SPECS.length).map((date, i) => buildAuthoredDay(SPECS[i], date)),
};
