/**
 * 第九周 —— **ielts_simplified（O-Level 基础）**档，全原创。
 *
 * 形状与第四到八周这一档一致：两百多词、九个短段、一条线讲到底，
 *   3 道四选一 · 2 道判断 · 1 道原文填空（四选一） · 4 道主观题（1/1/2/2 分）。
 *
 * 本周新要求（叶老师 10-23「内容可以整体难一点」）：篇幅取 240–260 词偏上段，
 * 超纲率往 A2 上限 7% 靠（目标 6.0–6.8%），超纲词尽量是值得学的正式词
 * （reluctant / assumed / gradually / evidence / certain / committee …），
 * 不靠人名凑；句子多用从句、被动、指代跨句；题目加了指代题、人物动机题、
 * 需要把两段信息合起来的题，四选一干扰项都是原文提到过、但不回答本题的内容。
 *
 * 叶老师先审周二，审完再写周三到周五 —— 往 SPECS 里按顺序追加即可，
 * dates.js 同步加日期。
 *
 * 徽章主题：周二 community。
 *
 * 查重：对过 .local/tmp/pack-titles-1023.txt（内容包 1–8 周）和 read-titles-1023.txt
 * （学生交过卷的全部标题），并在内容包各周文件里搜过 survey / questionnaire /
 * knocked on / bench / bus stop / badminton / Farhan：
 *   · 「做调查问居民」：内容包里 survey 只出现在学术文（雅思真题档）和第二周 olevel 的
 *     补习数据里，没有学生去问居民意见的故事；
 *   · 「公共空地要改造」：olevel 的 The Bus Stop Garden 是居民自己把车站种成花园，
 *     The Rooftop Garden / The Rise of Community Gardens 也都是「种起来」；本篇骨架
 *     正好相反 —— 大家以为要花园，调查后发现最多人要「别动它」，最后不建花园；
 *   · 第八周 olevel_intermediate 的 The Most Boring Bridge 是学生请愿要一座天桥
 *     （征签名 → 建成）；本篇不是请愿，是替居委会问意见，结论是「少建」；
 *   · 没有用叙事类老套路（台上卡住、走散、祖辈旧物、搬家、误会邻居、生病、作弊、
 *     宠物走丢、最后一刻反超、学会窍门成了全家能手）。
 * 人名只有一个 Farhan，1–8 周内容包里没出现过。背景是小区旁的草地，没写组屋 /
 * 熟食中心。
 *
 * 判断题：周二 FN（FALSE 要读出 Farhan「一开始不情愿」，NOT GIVEN 是早上做操的
 * 阿姨们选了什么 —— 原文只写了人数，没写谁选了什么）。后三天补 TRUE 时注意全周配比。
 */

'use strict';

const { buildAuthoredDay, numbered } = require('../authored');
const { DATES } = require('./dates');

const LEVEL = 'ielts_simplified';

// ═══════════════════════════════════════════════════════════════
// 周二 —— Leave It as It Is（community · 社区意见）
//
// 小区后面有一块只长草的空地，居委会提出要改成花园，先想听听附近居民的意见。这件事
// 交给了作者的班。搭档 Farhan 一开始不情愿：「人人都想要花园，问什么？答案明摆着。」
// 大家也都这么以为。两周里每天早晚站在空地边，只问一个问题：你想让这块地变成什么？
// 慢慢发现空地很少是空的：早上六点一群老太太做操，晚饭后一家家打羽毛球。
// 一共问了 143 人，只有 31 人选花园，过半数（78 人）的答案出乎意料：「别动它」。一个
// 老人说：「花园好看，可没人能在花上玩。」原本最笃定的 Farhan 半天没说话，然后提议
// 别只报数字，把证据给居委会看 —— 做了一张海报，贴上不同钟点空地的照片。居委会仔细看过，
// 决定不建花园，只加两盏灯（天黑后也能用）和一个饮水龙头。上周五作者和 Farhan 在新灯下
// 打羽毛球，两人都打得不好，也没人在意。
// 选题理由：「我们以为 → 去问 → 发现正相反」，一个学生自己也可能参与的社区小事；
// 结局是「少做一点」，不说教。
// 事实：全是故事情节，没有需要核对的事实性内容；人数 143 / 31 / 78 是故事里的数字，
// 互不矛盾（其余 34 人是别的答案，文中不提）。居委会（residents' committee）、
// 班主任（form teacher）是新加坡常用说法。
// ═══════════════════════════════════════════════════════════════

const FIELD = {
  key: 'original-w9-leave-it',
  title: 'Leave It as It Is',
  passage: numbered([
    "Behind our estate is a field with nothing on it but grass. In September, the residents' committee announced a proposal to turn it into a garden, but first it wanted to hear from people nearby.",
    'Our class was given the job of asking. My partner, Farhan, was reluctant at first. "Everyone wants a garden," he said. "Why ask? The answer is obvious." Most of us assumed the same.',
    'For two weeks, we stood by the field each morning and evening, asking everyone one question: "What would you like this field to become?"',
    'Gradually, we saw something we had never noticed: the field was rarely empty. At six in the morning, a group of old ladies did exercises there. After dinner, families played badminton.',
    'By the end, we had spoken to 143 people, and only 31 chose a garden. The majority, 78 people, gave an answer that we had not expected: "Leave it as it is."',
    'An old man explained why. "A garden is nice to look at," he said, "but nobody can play games on flowers."',
    'Farhan, who had been so certain, was quiet for a long time. Then he suggested showing the committee the evidence, not just the numbers. So we made a poster with photographs of the field at different hours.',
    'The committee studied it carefully. In the end, it decided not to build the garden. Instead, it added two lights, so that the field could be used after dark, and a water tap.',
    'Last Friday, Farhan and I played badminton there under the new lights. We are both bad at it, but nobody seemed to mind.',
  ]),
  questions: [
    {
      kind: 'mcq',
      stem: 'Why did Farhan think that asking people was not needed?',
      answer: 'He believed that everyone wanted a garden.',
      distractors: [
        'He thought that the field was always empty.',
        'He knew that the committee had already decided.',
        'He thought that people would not stop to answer.',
      ],
      evidence: '"Everyone wants a garden," he said. "Why ask? The answer is obvious."',
    },
    {
      kind: 'mcq',
      stem: 'What did the old man mean when he talked about flowers?',
      answer: 'A garden would take away the space people used for games.',
      distractors: [
        'Flowers in a garden would be hard to look after.',
        'The garden should have more flowers than grass.',
        'Walking in the evening is better than playing games.',
      ],
      evidence: '"A garden is nice to look at," he said, "but nobody can play games on flowers."',
    },
    {
      kind: 'mcq',
      stem: 'Why did the committee add two lights to the field?',
      answer: 'so that the field could be used after dark',
      distractors: [
        'so that the photographs could be taken at night',
        'so that the old man could walk there safely',
        'so that the old ladies could exercise at six',
      ],
      evidence: 'Instead, it added two lights, so that the field could be used after dark, and a water tap.',
    },
    {
      kind: 'tfng',
      item: 'Farhan agreed from the beginning that the class should ask people what they wanted.',
      answer: 'FALSE',
      evidence: 'My partner, Farhan, was reluctant at first. "Everyone wants a garden," he said. "Why ask? The answer is obvious."',
    },
    {
      kind: 'tfng',
      item: 'The committee had planned to plant fruit trees in the garden.',
      answer: 'NOT GIVEN',
    },
    {
      kind: 'gapChoice',
      stem: 'The class made a poster with ______ of the field at different hours.',
      answer: 'photographs',
      distractors: ['numbers', 'lights', 'flowers'],
      evidence: 'So we made a poster with photographs of the field at different hours.',
    },
    {
      kind: 'short',
      marks: 1,
      stem: 'From Paragraph 5, what answer did the majority of people give?',
      answer: '"Leave it as it is."',
      evidence: 'The majority, 78 people, gave an answer that we had not expected: "Leave it as it is."',
      rubric:
        '一分：答「Leave it as it is / 保持原样 / 不要改动这块地 / 让它保持现在的样子」即给分，意思对就行。答「a garden / 花园」不给分 —— 只有 31 人选花园，不是最多的。只写数字「78」没写答案内容不给分。',
    },
    {
      kind: 'short',
      marks: 1,
      stem: 'In Paragraph 8, who or what does the word "it" refer to in "it decided not to build the garden"?',
      answer: "The residents' committee.",
      evidence: 'The committee studied it carefully. In the end, it decided not to build the garden.',
      rubric:
        "一分：答「the (residents') committee / 居委会 / 委员会」即给分。答「the poster / 海报」不给分 —— 前一句「studied it」里的 it 才是海报，做决定的是委员会。答「the field」「the class」也不给分。",
    },
    {
      kind: 'short',
      marks: 2,
      stem: 'Read Paragraph 7, and look back at Paragraph 2 and Paragraph 5. Why was Farhan quiet for a long time, and what did he suggest after that?',
      answer:
        'He had been sure that everyone wanted a garden, but the answers showed he was wrong (only 31 of 143 people chose a garden). He suggested showing the committee the evidence instead of only telling them the numbers.',
      evidence:
        'Farhan, who had been so certain, was quiet for a long time. Then he suggested showing the committee the evidence, not just the numbers.',
      rubric:
        '两分：写出「他原来很确定人人都想要花园，结果发现自己错了 / 大多数人并不想要花园」给 1 分（写出「结果和他想的不一样 / 他想错了」即可；只写「他很惊讶」「他很难过」而没说出想错了什么，不给这 1 分）；写出「建议把证据拿给委员会看，而不只是报数字」再给 1 分（写「做一张有照片的海报给委员会看」也给分）。答「他建议建花园」不给分 —— 原文没有这样说。用自己的简单英文说对意思即可。',
    },
    {
      kind: 'short',
      marks: 2,
      stem: 'Using your own words, explain what people did on the field in the morning and after dinner (Paragraph 4).',
      answer:
        'In the morning, a group of old ladies did exercises there. After dinner, families played badminton there.',
      evidence:
        'At six in the morning, a group of old ladies did exercises there. After dinner, families played badminton.',
      rubric:
        '两分：写出「早上（六点）一群老太太 / 年纪大的女士在那里做运动 / 做操」给 1 分；写出「晚饭后一家家人在那里打羽毛球」再给 1 分（只写「有人打羽毛球」也给分）。早上和晚饭后写反了只给 1 分。答「作者和 Farhan 在新灯下打羽毛球」不给晚饭后这 1 分 —— 那是第 9 段装灯以后的事，不是第 4 段调查时看到的。用自己的简单英文说对意思即可。',
    },
  ],
};

const SPECS = [FIELD];

module.exports = {
  LEVEL,
  SPECS,
  DAYS: DATES.slice(0, SPECS.length).map((date, i) => buildAuthoredDay(SPECS[i], date)),
};
