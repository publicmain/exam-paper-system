/**
 * 第九周 —— **olevel（O-Level 标准）**档，全原创。
 *
 * 五六百词、九段。形状与第三到八周这一档一致：
 *   4 道情绪配对 · 1 道短语理解四选一 · 1 道原文填空 · 4 道两分主观题 —— 满分 14。
 *
 * 本周叶老师（10-23）要求「内容可以整体难一点」：篇幅取 560–600 词，超纲率往 7–8.5% 写，
 * 多用从句、被动、非谓语和跨句指代；题目多考综合两处信息、推断人物想法。
 * 这一轮只写周二，后三天审完再往 SPECS 里追加。
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
 * 徽章主题：technology。
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
// 最后两个数都上了海报，中间画着拖鞋；评委问为什么故意把成绩弄差，作者解释第一个数量的是程序
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

const SPECS = [SLIPPER_TEST];

module.exports = {
  LEVEL,
  SPECS,
  DAYS: DATES.slice(0, SPECS.length).map((date, i) => buildAuthoredDay(SPECS[i], date)),
};
