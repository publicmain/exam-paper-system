/**
 * 第九周 —— **olevel_intermediate（O-Level 中级）**档，全原创。
 *
 * 四百七十词上下的记叙文，八段。形状与第四到第八周这一档一致：
 *   4 道情绪配对（共用八个词的词库） · 1 道短语理解四选一 · 1 道原文填空 ·
 *   4 道两分主观题 —— 满分 14。
 *
 * 本周新要求（叶老师 10-23「内容可以整体难一点」）：篇幅从第八周的四百词提到 460–490 词，
 * 超纲率往本档上限（8.5%）写、目标 6.5–8.0%；句子多用从句、被动、非谓语和跨句指代；
 * 主观题至少两道要综合两段信息或读出反讽 / 言外之意，不再一段一问直给。
 *
 * 选题思路：叶老师要求先出周二，审完再写后三天。周二徽章 history（下面各天写好后在这里补）：
 *   周二 history（校庆挖出 2001 年的时光胶囊，作者和搭档分到全场最没用的一张软盘）。
 * 结局类型：写给未来读者的一句话（「If you can read this, paper won again.」）—— 和第七周
 * （干脆的胜利 / 苦乐参半的放手 / 首尾呼应 / 喜剧反转 / 开放式）、第八周（目的反转 / 没人
 * 看见的成功 / 把禁忌变成玩笑 / 平凡之物的来历 / 意外的请求）都不重样。
 *
 * 查重：对过内容包 1–8 周全部标题（pack-titles-1023，199 篇）和学生交过卷的全部标题
 * （read-titles-1023，215 篇），并在 pilot/content 各周文件和 test-fixtures 里 grep 过
 * time capsule / capsule / floppy：只有第二周 ielts_authentic 的「自愈水泥里的胶囊」，
 * 与本篇无关。特意避开的近邻：第八周同档 The Most Boring Bridge（也是 history 徽章 ——
 * 那篇的高潮是「旧报纸里发现爸爸」，本篇没有任何家人和亲戚，胶囊里的人一个也不认识，也不
 * 设「老师当年就是埋胶囊的学生」这种揭晓）；The Tin Under the Bed / Behind the Encyclopedias /
 * The Recipe Card（家里翻出旧物件 —— 本篇是学校公开挖出的集体档案，不是祖辈遗物）；
 * The Old Radio / The Machine from the Sea（老机器 —— 本篇的重点是「新技术反而最先读不出来」，
 * 不是修好老机器的温情）。也不是走散会合、台上卡壳、比赛反超、搬家、生病等老套路。
 * 人名：Mr Kumaran（历史老师）、Haziq（搭档）、Mr Loh（技术员）都没在前八周任何一档出现过
 * （grep 过 week1–week8），也不是普通英文单词。
 *
 * 事实核对（把握程度）：
 *   · 软盘（floppy disk）在 2001 年前后仍是在电脑之间拷文件的常见方式 —— 把握高（文中借老师
 *     之口说 had once been the ordinary way，不给年份数字）。
 *   · 现在的学校电脑普遍没有软驱；有外接的 USB 软驱可以接笔记本 —— 把握高（文中只说
 *     a small black box with a cable，不点品牌、不说接口）。
 *   · 软盘靠磁性涂层存数据，涂层会随年月衰减，二十多年的软盘常有读不出的文件 —— 公认现象，
 *     把握高；文中借技术员之口说 gradually weakens / may simply fade，不给具体年限。
 *   · 普通纸张密封在箱子里二十五年仍可读 —— 合乎常识；文中说的是「和软盘放在同一个箱子里」，
 *     不是直接埋在土里。
 *   · 校庆五十周年、2001 年埋、2026 年挖、下一个胶囊 2051 年开 —— 全部虚构，数字自洽（25 年）。
 *
 * 情绪配对的四个时刻都写成具体动作，每个时刻在本段内都有叙述者自己的反应；词库避开盲做抓到过的
 * 相邻词对（doubtful/astonished、surprised/disappointed、anxious/determined、anxious/nervous），
 * 也不放本篇别处明显成立的情绪（第 6 段第十一个文件终于打开，relieved 说得通，所以词库不放
 * relieved；第 7 段报告引出全班讨论，proud 也说得通，所以不放 proud；第 3 段干等一周可读成
 * frustrated / disappointed，所以这两个也不放；第 7 段写了「以为全班会 bored」，所以不放 bored）。
 *
 * 叙述者的性别没有写明，题干和参考答案一律用 the writer。
 */

'use strict';

const { buildAuthoredDay, numbered } = require('../authored');
const { DATES } = require('./dates');

const LEVEL = 'olevel_intermediate';

// ═══════════════════════════════════════════════════════════════
// 周二 —— Paper Won Again　　徽章：history
// ═══════════════════════════════════════════════════════════════
//
// 梗概：校庆五十周年，学校挖出 2001 年中三学生埋在旗杆旁的时光胶囊；历史老师 Mr Kumaran
//   争取让同样是中三的作者班「像历史学家一样」先研究里面的东西，每组一件。作者和 Haziq 迟到，
//   分到全场最不起眼的一件：一张写着 OUR CLASS 2001 的灰色软盘。全校没有一台电脑读得了，
//   别组都在报告发现，他俩一周无话可报。技术员 Mr Loh 翻出一个「以防万一」留了近二十年
//   的外接软驱；十一个文件一个接一个打不开 —— 磁性涂层会慢慢衰减；而同一个箱子里别组在读的
//   手写信，一封封都读得清清楚楚。最后一个文件打开了：当年的「班级秘书」写着「我们把最好的作品
//   存在软盘里，因为纸太老土、留不久」。两人笑得绷不住。报告引出全学期最长的讨论 —— 老师说她
//   不傻，只是像我们一样相信了当时最新的技术，并问：今天存的东西，哪些到 2051 年还读得出？
//   新胶囊里放了 U 盘，但重要的东西都打印出来；作者写了一封纸信解释软盘是什么，末尾一句：
//   「If you can read this, paper won again.」
// 选题理由：历史课最核心的问题之一 ——「我们凭什么知道过去」：史料本身会消失，而且越新的
//   载体未必越长久。学生天天把东西存在手机和云端，这个反讽离他们很近。
// 数字自洽：2001 年埋、2026 年挖（二十五年，与校庆五十周年不冲突）；十一个文件、第十一个打开；
//   Mr Loh 留了「将近二十年」（原文 almost two decades）；新胶囊二十五年后、2051 年开（第 7、8 段一致）。

const PAPER_WON = {
  key: 'original-w9-paper-won-again',
  title: 'Paper Won Again',
  passage: numbered([
    "For our school's fiftieth anniversary, the principal arranged for a sealed time capsule to be dug up from beside the flagpole, where a Secondary Three class had buried it in 2001. Mr Kumaran, our history teacher, persuaded her to let our class examine the contents before they went on display. 'Historians do not just read about the past,' he told us. 'They handle it.' Each pair was given one object to investigate, and because Haziq and I arrived late, we were left with the least impressive item: a square of grey plastic labelled OUR CLASS 2001.",
    "It was a floppy disk which, according to Mr Kumaran, had once been the ordinary way to carry files between computers. I kept glancing at the pair beside us, who were unfolding a fragile newspaper, and wished we could swap. Haziq turned our disk over and remarked that we had been given the only object that could not tell us anything.",
    'He was nearly right. Not a single computer in the school had a slot for a disk, and the librarian assumed we were joking. Mr Loh, the technician, laughed but reluctantly promised to search his storeroom. For a week, while the others presented their discoveries, we had nothing to report.',
    "The following Monday, Mr Loh appeared holding a small black box with a cable: a disk drive which, he admitted, he had kept 'just in case' for almost two decades. He connected it to a laptop and slid the disk in. The drive clicked and groaned like an old fan, and I realised that I was gripping the edge of the desk.",
    'Eleven files appeared. Haziq cheered, but one after another, the first ten refused to open. Mr Loh explained that the magnetic surface of a disk gradually weakens, so the information stored on it may simply fade. Ironically, the handwritten letters the other pairs were studying, kept in the same box for as long, remained perfectly readable.',
    "The eleventh file opened. It was a single page, signed only 'Class Secretary'. 'We are putting our best work on this disk,' she had written, 'because paper is old-fashioned and will not last.' Haziq read it aloud twice, and the second time, neither of us could keep a straight face.",
    'I had expected our presentation to bore everyone. Instead, it started the longest discussion of the term, and I kept looking at Haziq as if to check that it was really happening. Mr Kumaran pointed out that the Class Secretary had not been foolish; she had simply trusted the newest technology of her time, exactly as we do. Then he asked a question nobody could answer: which of the things we save today will still be readable in 2051?',
    "Our class is now preparing its own capsule, to be opened in twenty-five years. After a long debate, we agreed to include a USB stick but also to print everything that matters. My contribution is a letter explaining what a floppy disk was, in case nobody remembers, and at the bottom I have added a line for whoever opens it: 'If you can read this, paper won again.'",
  ]),
  questions: [
    {
      kind: 'matchingFeelings',
      bank: ['jealous', 'nervous', 'amused', 'surprised', 'guilty', 'lonely', 'furious', 'grateful'],
      items: [
        { moment: 'Paragraph 2 — glancing at the pair beside them who are unfolding the newspaper', answer: 'jealous', para: 2 },
        { moment: 'Paragraph 4 — gripping the edge of the desk while the drive clicks and groans', answer: 'nervous', para: 4 },
        { moment: "Paragraph 6 — failing to keep a straight face at the Class Secretary's words", answer: 'amused', para: 6 },
        { moment: 'Paragraph 7 — looking at Haziq when the presentation starts a long discussion', answer: 'surprised', para: 7 },
      ],
    },
    {
      kind: 'mcq',
      stem: "In Paragraph 7, what does Mr Kumaran suggest by saying that the Class Secretary 'had simply trusted the newest technology of her time, exactly as we do'?",
      answer: 'People today could be making the same mistake that she made.',
      distractors: [
        'She was foolish to save her best work on a floppy disk.',
        'Paper will always last longer than files on any computer.',
        'The class should save its work with the newest technology too.',
      ],
      evidence:
        'Mr Kumaran pointed out that the Class Secretary had not been foolish; she had simply trusted the newest technology of her time, exactly as we do.',
    },
    {
      kind: 'gapChoice',
      stem: 'When Mr Loh slid the disk in, the drive clicked and groaned like an old ______.',
      answer: 'fan',
      distractors: ['car', 'door', 'clock'],
      evidence: 'The drive clicked and groaned like an old fan, and I realised that I was gripping the edge of the desk.',
    },
    {
      kind: 'short',
      marks: 2,
      stem: 'According to Paragraph 1, what did Mr Kumaran persuade the principal to do, and why were the writer and Haziq given the disk?',
      answer:
        "He persuaded her to let the writer's class examine the contents of the time capsule before they went on display; the writer and Haziq arrived late, so they were left with the least impressive item.",
      evidence:
        'Each pair was given one object to investigate, and because Haziq and I arrived late, we were left with the least impressive item',
      rubric:
        '两分：写出「让作者的班在展出之前先研究时光胶囊里的东西」给 1 分（写出「让我们班先看 / 研究胶囊里的东西」即可；只写「把胶囊挖出来」不给 —— 挖胶囊是校长安排的，不是老师说服她做的）；写出「因为作者和 Haziq 迟到了，只剩下最不起眼的那件」再给 1 分（要写出「迟到」；只写「每组分一件东西」不给这 1 分）。',
    },
    {
      kind: 'short',
      marks: 2,
      stem: 'Using information from Paragraphs 3 and 4, explain why the writer and Haziq had nothing to report for a week, and how the problem was finally solved.',
      answer:
        'Not a single computer in the school had a slot for a disk, so they could not read it and had to wait while Mr Loh searched his storeroom; the following Monday, Mr Loh brought a disk drive he had kept for almost twenty years and connected it to a laptop.',
      evidence: 'Not a single computer in the school had a slot for a disk, and the librarian assumed we were joking.',
      rubric:
        '两分：写出原因「学校里没有一台电脑能放软盘 / 读得了软盘，只能等 Mr Loh 去储物间找」给 1 分（写出「没有电脑读得了」即可；只写「图书管理员以为他们在开玩笑」或「Mr Loh 笑了」不给 —— 那是别人的反应，不是读不了的原因）；写出解决办法「下周一 Mr Loh 拿来一个他留了将近二十年的（外接）软驱，接到笔记本上」再给 1 分（写出「Mr Loh 找到 / 拿来一个软驱」即可）。',
    },
    {
      kind: 'short',
      marks: 2,
      stem: "Read Paragraphs 5 and 6. Why did the writer and Haziq find the Class Secretary's message so funny?",
      answer:
        'She had saved the best work on the disk because she believed paper was old-fashioned and would not last; in fact, the files on the disk refused to open one after another, while the handwritten letters kept in the same box were still perfectly readable.',
      evidence:
        'Ironically, the handwritten letters the other pairs were studying, kept in the same box for as long, remained perfectly readable.',
      rubric:
        '两分：写出「她说把最好的作品存进软盘，是因为纸太老土、留不久」给 1 分；写出「结果正好相反：软盘上的文件大多坏了 / 打不开，而同一个箱子里写在纸上的信还读得清清楚楚」再给 1 分（要写出「纸反而留下来了」或「软盘反而坏了」这个对比的意思，两者答出其一即可）。只写「Haziq 读了两遍」或「那是唯一打开的文件」不给分 —— 那不是好笑的原因。',
    },
    {
      kind: 'short',
      marks: 2,
      stem: "According to Paragraph 8, what did the class agree to put in its own capsule, and what does the writer's last line suggest?",
      answer:
        'A USB stick, but they would also print everything that matters; the last line suggests that the writer expects paper to last longer than the digital files once again, as it did with the floppy disk.',
      evidence: "at the bottom I have added a line for whoever opens it: 'If you can read this, paper won again.'",
      rubric:
        '两分：写出「放一个 U 盘，但重要的东西也都打印出来」给 1 分（只写「U 盘」或只写「打印出来」都不给这 1 分 —— 两样都要有）；写出最后一句的意思「作者估计到时候纸又会比电子文件留得更久 / 纸又一次赢了，就像这次纸信比软盘留得久」再给 1 分（写出「纸会比 U 盘 / 电子文件更长久」即可）。只写「作者写了一封信解释软盘是什么」不给第二分 —— 那是信的内容，不是最后一句的言外之意。',
    },
  ],
};

const SPECS = [PAPER_WON];

module.exports = {
  LEVEL,
  SPECS,
  DAYS: DATES.slice(0, SPECS.length).map((date, i) => buildAuthoredDay(SPECS[i], date)),
};
