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
 * 选题思路：四天依次用 history / health / technology / community：
 *   周二 history（校庆挖出 2001 年的时光胶囊，作者和搭档分到全场最没用的一张软盘）。
 *   周三 health（健康周检查书包，作者发现自己背着全组材料，重新分配后仍是项目负责人）。
 *   周四 technology（温度传感器断线，图表却不断重复旧读数；作者让缺测时段真正空出来）。
 *   周五 community（社区互助日只有「能提供什么」一栏有人填，作者用自己的具体请求打开另一栏）。
 * 后三天的梗概与选题：周三把身体负担与默认分工相连，转折来自摊开的材料清单，结尾保留
 *   负责人标签、取消独自搬运；周四区分实际测量、旧值替代和估计，转折来自拔线后图仍在画，
 *   结尾把永久缺口留在展出的图上；周五写互助如何开始，转折是请求先有人响应、帮助再传给第三人，
 *   结尾用带箭头的交流记录代替两张整齐名单。三天与周二的档案发现、留信给未来互相错开。
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
 * 后三天的事实核对（把握程度）：
 *   · 周三：健康周、书包检查、物品和分工全部虚构；肩膀的感觉只写作者个人的前后观察，
 *     不设医学上的书包重量上限，不提出治疗或预防效果。物品重新分配的数量与责任对应，把握高。
 *   · 周四：电子传感器可给程序提供温度读数；程序可被写成缺值时重复上一值，把握高；
 *     这是故事里自编程序的具体行为，不概括真实产品。断线期间没有采到的原始读数无法事后
 *     重新测得，估计须与实测区分，把握高；不写设备型号、采样周期、误差或植物适温数字。
 *   · 周五：互助日、表格、量窗帘和换盆任务全部虚构，不引用真实机构规则、社会统计或健康结论。
 * 后三天查重：读过 pack-titles-1023 与 read-titles-1023 两份完整标题清单，检索过内容包与
 *   test-fixtures 的 caption / subtitle / transcrib / bag + weigh / shared equipment /
 *   time bank / skill swap / volunteer credit / noticeboard 等词，并核对第七、八周同档。
 *   周四初选字幕，因同周 olevel 出现近邻题材而弃用；最终检索 sensor / missing data /
 *   temperature graph / weather station / data logger，未找到旧文同骨架。周三不是
 *   The Group Project 的误判搭档或 Facing the Wardrobe 的练习诀窍；周四不是
 *   The Forecast That Took Six Weeks 的天气预测，也不是周二的保存媒介与旧档案读取；
 *   周五不是 The Prize Money 的奖金处置与询问清洁工，也不是 The Red Packet 的礼物价值对比。
 *   新增三篇不设人名，避开第八周各档姓名；没有组屋、熟食中心及 brief 禁用的叙事桥段。
 * 全周判断题分布：周二至周五均为 0 道，TRUE 0 / FALSE 0 / NOT GIVEN 0；本档模板没有
 *   判断题，保留 4 情绪配对 + 1 四选一 + 1 原文填空 + 4 两分简答，不另加判断题。
 * GP 追加要求已核对：只指定 ielts_authentic 三篇与 olevel 周五，本档四天仍为记叙文。
 *
 * 情绪配对的四个时刻都写成具体动作，每个时刻在本段内都有叙述者自己的反应；词库避开盲做抓到过的
 * 相邻词对（doubtful/astonished、surprised/disappointed、anxious/determined、anxious/nervous），
 * 也不放本篇别处明显成立的情绪（第 6 段第十一个文件终于打开，relieved 说得通，所以词库不放
 * relieved；第 7 段报告引出全班讨论，proud 也说得通，所以不放 proud；第 3 段干等一周可读成
 * frustrated / disappointed，所以这两个也不放；第 7 段写了「以为全班会 bored」，所以不放 bored）。
 *
 * 新增三篇的词库同样排除近义情绪竞争：周三不并列 proud / confident、nervous / anxious、
 *   relieved / grateful；周四不放与 embarrassed 竞争的 ashamed；周五不并列 frustrated / annoyed。
 * 每篇至少两道简答综合两段信息；evidence 取原文连续片段，跨段推理在解析中写清两处依据。
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

// ═══════════════════════════════════════════════════════════════
// 周三 —— Everyone's Things　　徽章：health
// ═══════════════════════════════════════════════════════════════

const EVERYONES_THINGS = {
  key: 'original-w9-everyones-things',
  title: "Everyone's Things",
  passage: numbered([
    "During our school's health week, we were invited to inspect our daily burden. By the time our class reached the weighing table, my shoulders were aching, as they usually did after the journey to school. Nevertheless, when the teacher suggested leaving unnecessary things at home, I explained that everything in my bag was essential. Our geography exhibition was approaching, and I felt an obligation to our group.",
    "There were four of us, although our luggage suggested otherwise. My bag contained the group's folders, measuring equipment and thick rolls of tape, besides my own books. Inside its transparent front pocket was a label saying PROJECT MANAGER. Whenever someone handed me another item, I adjusted the label, reluctant to let it disappear. I liked being the person everyone relied on: their dependence felt like recognition for my contribution.",
    "At the table, we unpacked our bags. The teacher separated my books from the exhibition materials, then invited the other three group members to stand beside me. I immediately explained that they had all done their research. I defended their participation, unwilling to turn a health activity into an assessment of our academic work. The teacher simply asked who transported it.",
    "We arranged the materials in four piles, one for each person's contribution. Every pile contained something that belonged to the project, yet almost everything had travelled inside my bag. I checked the labels twice, bewildered by the contrast between equal contributions and an unequal load. The others examined this evidence of our accumulated assumptions in silence.",
    "The explanation emerged gradually. One person had handed me the tape because my bag was open; another assumed that equipment should stay together. I had offered to collect the folders so that none would be forgotten. Each decision was convenient and apparently voluntary when considered separately. Together, however, they had turned an offer of help into an expectation which nobody remembered agreeing to. We had created a collective burden without explicit consent.",
    "That evening, I composed a message asking everyone to share the load. Before sending it, I rewrote the opening three times and wiped my damp fingers on my trousers. Would they think I was withdrawing from the project? Ultimately, I explained the problem without blame and proposed assembling our materials outside the classroom. Then I left the phone on the table, face down.",
    "The replies offered immediate reassurance: yes, of course. One classmate asked why I had never mentioned the difficulty. Another offered to bring a separate bag for the equipment. On the next morning's journey, I could sit without balancing a tower of folders against my knees. When we met, all four piles arrived. No research was missing, and nobody asked me to surrender my responsibility.",
    "By Friday, my shoulders no longer ached on arrival, and I stopped expecting a complaint whenever someone opened our group chat. The exhibition was still mine to organise, but it was no longer mine to carry. The label stayed in its pocket. Under it, there was finally enough room for my own pencil case.",
  ]),
  questions: [
    {
      kind: 'matchingFeelings',
      bank: ['proud', 'puzzled', 'nervous', 'relieved', 'jealous', 'bored', 'suspicious', 'lonely'],
      items: [
        { moment: 'Paragraph 2 — adjusting the PROJECT MANAGER label to keep it visible', answer: 'proud', para: 2 },
        { moment: 'Paragraph 4 — checking the labels twice while looking at the four piles', answer: 'puzzled', para: 4 },
        { moment: 'Paragraph 6 — rewriting the opening and wiping damp fingers before sending the message', answer: 'nervous', para: 6 },
        { moment: 'Paragraph 8 — opening the group chat without expecting a complaint', answer: 'relieved', para: 8 },
      ],
    },
    {
      kind: 'mcq',
      stem: "In Paragraph 8, what does 'it was no longer mine to carry' mean?",
      answer: 'The writer still organised the project, while the group shared the physical load.',
      distractors: [
        'The writer kept the label, while a classmate took over organising the exhibition.',
        'The writer separated the research, while the teacher marked each contribution.',
        'The writer left the materials at home, while the group displayed only its books.',
      ],
      evidence: 'The exhibition was still mine to organise, but it was no longer mine to carry.',
      explanation: '这里把 organise 与 carry 对照：作者仍负责组织，材料由组员分担搬运；第 7 段四堆材料都到齐，说明项目没有被放弃。',
    },
    {
      kind: 'gapChoice',
      stem: 'After the materials were shared out, there was room beneath the label for the writer\'s own pencil ______.',
      answer: 'case',
      distractors: ['box', 'pocket', 'bag'],
      evidence: 'Under it, there was finally enough room for my own pencil case.',
    },
    {
      kind: 'short',
      marks: 2,
      stem: 'Using Paragraphs 1–2, explain why the writer initially defended carrying all the materials. Give TWO reasons.',
      answer: 'The writer believed the materials were essential for the approaching exhibition and felt responsible as group organiser; the writer also enjoyed being the person everyone relied on.',
      evidence: 'I liked being the person everyone relied on: their dependence felt like recognition for my contribution.',
      rubric: '两分：写出「展览临近，作者作为负责人觉得这些材料必不可少 / 自己有责任保证材料齐全」给 1 分；写出「喜欢被大家依靠 / 觉得这让自己重要、有用」再给 1 分。合理同义改写均给分。只写「肩膀酸」「书包里有胶带」不给分；只把「作者是负责人」重复两遍最多 1 分。',
      explanation: '第 1 段 essential、responsible 说明实际责任；第 2 段最后一句说明作者也享受被依靠。两个层面的动机各占 1 分。',
    },
    {
      kind: 'short',
      marks: 2,
      stem: 'Read Paragraphs 3–4. What distinction was the teacher investigating, and what did the four piles reveal?',
      answer: 'The teacher was checking who carried the materials rather than who had done the research; although all four members had contributed work, almost all their materials were being carried by the writer.',
      evidence: 'Every pile contained something that belonged to the project, yet almost everything had travelled inside my bag.',
      rubric: '两分：写出「老师查的是谁搬运材料，与谁做研究 / 是否偷懒分开看」给 1 分；写出「四人都有贡献，但几乎全部材料由作者一个人背」再给 1 分。合理变体给分；只写「分成四堆」不给分；写「其他三人没做研究」与原文相反，不给对应分。',
      explanation: '第 3 段明确说所有人都做了研究，老师只问谁搬运；第 4 段把公平的工作分工与不公平的运输负担对照起来。',
    },
    {
      kind: 'short',
      marks: 2,
      stem: 'According to Paragraph 5, how did carrying the materials become an expectation? Explain TWO stages.',
      answer: 'Materials first entered the writer\'s bag through separate convenient choices and the writer\'s offer to collect folders; those choices then became an assumed arrangement without anyone explicitly agreeing to it.',
      evidence: 'Together, however, they had turned an offer of help into an expectation which nobody remembered agreeing to.',
      rubric: '两分：写出「最初是零散、图方便的决定 / 作者主动帮忙收文件」给 1 分（用书包开着、器材放一起等具体例子解释也给）；写出「这些做法累积成默认分工，大家没明确商量就认为以后也由作者背」再给 1 分。合理变体给分；只列两件物品不解释过程不给分；写「全组开会决定让作者背」不给第二分。',
    },
    {
      kind: 'short',
      marks: 2,
      stem: 'Using Paragraphs 6–8, explain how the outcome answered the writer\'s worry about sending the message. Give TWO points.',
      answer: 'The others readily agreed and helped instead of complaining or accusing the writer of withdrawing; they continued to accept the writer as organiser after the carrying was shared.',
      evidence: 'No research was missing, and nobody asked me to surrender my responsibility.',
      rubric: '两分：写出「组员爽快答应 / 主动帮忙，没有埋怨作者不参与」给 1 分；写出「作者分担搬运后仍被接受为负责人，没有失去组织职责」再给 1 分。合理变体给分；只写「肩膀不酸了」不给分，因为题目问的是发消息前对同伴反应的担心；只写「大家回复了」不给第一分，要说明接纳或支持。',
      explanation: '第 6 段怕别人认为自己退出项目；第 7 段回复支持、职责保留，第 8 段也不再担心群里有人抱怨，分别回应了担心。',
    },
  ],
};

// ═══════════════════════════════════════════════════════════════
// 周四 —— The Gap in the Graph　　徽章：technology
// ═══════════════════════════════════════════════════════════════

const GRAPH_GAP = {
  key: 'original-w9-gap-in-the-graph',
  title: 'The Gap in the Graph',
  passage: numbered([
    "For our science club's open afternoon, I made a screen showing the temperature beside our seed boxes. An electronic sensor supplied measurements to a laptop, where my program turned them into a green line. Its continuous record looked impressive. When our teacher asked whether it would be ready by Friday, I nodded before she had finished the question. What could be difficult about displaying numbers?",
    "The initial tests supported my confidence. Holding the sensor in my hands eventually produced a higher reading; returning it to the shaded bench brought the line down again. I adjusted the colours and labelled the graph, pleased with its professional appearance. We left it running to collect evidence about how conditions changed throughout the day, while the club prepared the rest of the display.",
    "On Thursday, the line was perfectly horizontal. While inspecting the equipment, I discovered a loose cable between the sensor and laptop. I removed it, expecting the graph to stop. Instead, the line continued advancing across the screen. I checked the empty socket twice, then searched for another connection. How was the program obtaining information from something no longer attached to it?",
    "Once I reconnected the cable, the reading jumped. Our teacher asked whether the straight section represented a stable temperature or an absence of measurements. Until then, those possibilities had seemed equivalent. Looking through the program, I found a setting I had included myself: whenever a new measurement was unavailable, the previous value was repeated. I had wanted an uninterrupted display, without considering what that display would imply.",
    "The screen had presented those substitutions as observations. Each repetition appeared at a new position, suggesting that another measurement had actually been taken. I felt my face warming as the teacher read my heading, OUR TEMPERATURE RECORD. When she asked who had chosen the setting, I answered while looking down at the keyboard. The earlier tests had verified changing readings, but never examined what happened when readings stopped arriving.",
    "I proposed joining the last reliable point to the first reading after reconnection. That would restore the complete graph I had imagined showing. Our teacher explained that we could estimate, provided the replacement line was explicitly labelled as an estimate. The original measurements could not be recovered because they had never been collected. My shoulders dropped. However carefully I revised the program, that part of Thursday would remain unknown.",
    "We revised the display to leave a gap whenever measurements were missing, with a message explaining why. A separate box showed the time of the latest genuine reading. Then we tested the interruption deliberately, disconnecting and reconnecting the cable. This time, nobody could confuse an old value with fresh evidence. The display looked less complete, yet revealed more about the reliability of its information.",
    "On Friday, a visitor pointed at the blank section and asked what had happened. I explained the interruption and our correction, without pretending to know the missing temperatures. She stayed to ask about the program. Around us, the other displays were full of information. Ours included a space which told people exactly where our knowledge ended.",
  ]),
  questions: [
    {
      kind: 'matchingFeelings',
      bank: ['confident', 'puzzled', 'embarrassed', 'disappointed', 'jealous', 'grateful', 'lonely', 'bored'],
      items: [
        { moment: 'Paragraph 1 — nodding before the teacher finishes asking whether the display will be ready', answer: 'confident', para: 1 },
        { moment: 'Paragraph 3 — checking the empty socket twice and searching for another connection', answer: 'puzzled', para: 3 },
        { moment: 'Paragraph 5 — looking down at the keyboard when admitting who chose the setting', answer: 'embarrassed', para: 5 },
        { moment: 'Paragraph 6 — letting shoulders drop on learning that the original measurements cannot be recovered', answer: 'disappointed', para: 6 },
      ],
    },
    {
      kind: 'mcq',
      stem: "In Paragraph 8, what does 'a space which told people exactly where our knowledge ended' suggest?",
      answer: 'The blank section showed visitors which period had no measurements to support it.',
      distractors: [
        'The blank section showed visitors where the sensor had recorded a stable temperature.',
        'The blank section showed visitors when the club had completed testing its equipment.',
        'The blank section showed visitors how a replacement line estimated the temperature.',
      ],
      evidence: 'Ours included a space which told people exactly where our knowledge ended.',
      explanation: '空白对应断线、没有实际测量的时段；它明确呈现知识的界限。稳定温度、故障测试和估计线都曾提及，但不是这个空白所表示的内容。',
    },
    {
      kind: 'gapChoice',
      stem: 'The revised display used a separate box to show the ______ of the latest genuine reading.',
      answer: 'time',
      distractors: ['temperature', 'position', 'value'],
      evidence: 'A separate box showed the time of the latest genuine reading.',
    },
    {
      kind: 'short',
      marks: 2,
      stem: 'Read Paragraphs 2–5. What did the early tests establish, and what important situation did they leave untested?',
      answer: 'They established that the displayed reading rose and fell as the sensor experienced different temperatures; they did not check how the program behaved when no new measurements arrived.',
      evidence: 'The earlier tests had verified changing readings, but never examined what happened when readings stopped arriving.',
      rubric: '两分：写出「温度改变时读数会相应升降 / 手握变高、放回阴凉处变低」给 1 分；写出「没有测试新读数停止传来 / 传感器断线时程序怎样显示」再给 1 分。合理变体给分；只写「调整过颜色」不给第一分；写「从没测试过设备」与第 2 段相反，不给分。',
      explanation: '第 2 段验证有新读数时的响应，第 5 段指出未验证没有新读数时的行为；这是两种不同的测试条件。',
    },
    {
      kind: 'short',
      marks: 2,
      stem: 'Using Paragraphs 3–5, explain why the graph kept advancing after the sensor was disconnected, and why this was misleading.',
      answer: 'The program repeated the previous value whenever no new measurement arrived; each old value appeared in a new position as though a fresh observation had been made, hiding the absence of measurements.',
      evidence: 'Each repetition appeared at a new position, suggesting that another measurement had actually been taken.',
      rubric: '两分：写出「程序设为收不到新测量值时重复上一值，所以断线还在画」给 1 分；写出「旧值被画在新的时间位置，装成又一次实际观测，掩盖了缺测」再给 1 分。合理变体给分；只写「线一直是平的」不给分；写「传感器断线仍在测量并传给电脑」不给第一分。',
      explanation: '第 3 段呈现断线仍画图，第 4 段揭示重复旧值的设置，第 5 段解释新位置为何造成有新观测的错觉。',
    },
    {
      kind: 'short',
      marks: 2,
      stem: 'According to Paragraph 6, what did the writer hope to achieve by joining two points, and what condition did the teacher set for such a line?',
      answer: 'The writer wanted to restore the complete graph originally planned for the exhibition; the teacher required the replacement line to be clearly labelled as an estimate.',
      evidence: 'Our teacher explained that we could estimate, provided the replacement line was explicitly labelled as an estimate.',
      rubric: '两分：写出「把缺口连起来，恢复原想展出的完整图表」给 1 分；写出「必须明确标注那条替代线是估计，不是实测」再给 1 分。合理变体给分；写「老师禁止任何估计」与原文相反，不给第二分；只写「把传感器接好」不给第一分，因为那不是连接图上两点的目的。',
    },
    {
      kind: 'short',
      marks: 2,
      stem: 'Using Paragraphs 6–8, explain why revising the program did not make the graph complete, and why the writer nevertheless displayed it with the gap.',
      answer: 'The missing measurements had never been collected, so revising the program could not recover them; displaying and explaining the gap let visitors see the limit of the actual evidence instead of being misled by invented readings.',
      evidence: 'The original measurements could not be recovered because they had never been collected.',
      rubric: '两分：写出「那段时间根本没采集到测量值，改程序也不能找回不存在的原始数据」给 1 分；写出「保留并解释缺口，能如实告诉观众哪些时段没有证据，避免伪装成真实测量」再给 1 分。合理变体给分；只写「来不及修」不给第一分；只写「空白很吸引人」不给第二分；写「温度为零，所以空着」不给分。',
      explanation: '第 6 段说明数据从未采集、无法恢复，第 7 段改为显示缺测，第 8 段作者解释并承认知识边界；不完整是被诚实呈现，而非被掩盖。',
    },
  ],
};

// ═══════════════════════════════════════════════════════════════
// 周五 —— The Blank Column　　徽章：community
// ═══════════════════════════════════════════════════════════════

const BLANK_COLUMN = {
  key: 'original-w9-blank-column',
  title: 'The Blank Column',
  passage: numbered([
    "For the community centre's first help exchange, I designed a form with two columns: WHAT I CAN OFFER and WHAT I NEED. Residents could contribute a skill or ask for assistance with an ordinary task. No money would change hands. My job was to connect people whose requests and offers matched, which seemed satisfyingly simple on paper.",
    "By Saturday morning, the offers included sewing, checking bicycle tyres and moving plant pots. I spread the forms across the welcome table, delighted by this evidence of collective generosity. The centre manager asked how many exchanges we had arranged. I held up the thick pile as evidence of participation, explaining my allocation of offers to separate categories.",
    "Then we examined the other column. Almost every space was blank. I carried the forms from table to table, repeating that requests were welcome, but each returned with another offer. After the fourth round, I dropped my pen onto the table and pressed my lips together. We had plenty of willing helpers and nobody for them to help. My tidy system had nothing to connect. Sorting offers was not equivalent to arranging exchanges.",
    "One visitor studied the empty spaces before putting his form down. Asking for help, he said, would make him feel as though he had arrived with nothing to contribute. I pointed towards his offer to mend bags, but he shook his head. That went on the giving side. Apparently, my line had become a boundary between two kinds of people: capable contributors and dependent recipients.",
    "I looked at my own form. I had offered to design notices, while leaving my request empty too. At home, measuring a long curtain required cooperation: somebody had to hold the other end of the tape. I knew exactly what to write. Nevertheless, my face grew warm when the manager looked over my shoulder, and I covered the blank space with my hand.",
    "After some hesitation, I wrote the request and placed it where everyone could read it. The visitor who mended bags offered to help after lunch. Before he left the table, he asked whether anyone could help him move a large plant into a new pot. A woman beside him pulled up a chair and began describing her plants. I reached for my pen, following the conversation more quickly than I could record it.",
    "Soon the woman asked about her bicycle tyres, and somebody from another table came across. Seeing people both request and offer help, other visitors began filling in their empty spaces. I fetched extra paper, wondering which connection would appear next. Instead of sorting people into two separate groups, I drew arrows between their names. Some arrows led back; others continued towards someone else across the room.",
    "At closing time, the manager repeated her question. The number recorded arrangements, but overlooked the change in people's assumptions. I showed her the arrows instead. My original straight line was still visible beneath them, crossed so often that it scarcely separated anything. We left the page on the table for the next gathering, with room for more names.",
  ]),
  questions: [
    {
      kind: 'matchingFeelings',
      bank: ['proud', 'frustrated', 'embarrassed', 'curious', 'jealous', 'suspicious', 'lonely', 'bored'],
      items: [
        { moment: 'Paragraph 2 — holding up the thick pile of forms to answer the manager', answer: 'proud', para: 2 },
        { moment: 'Paragraph 3 — dropping the pen and pressing lips together after the fourth round', answer: 'frustrated', para: 3 },
        { moment: 'Paragraph 5 — covering the blank request space when the manager looks over', answer: 'embarrassed', para: 5 },
        { moment: 'Paragraph 7 — fetching paper and wondering which connection will appear next', answer: 'curious', para: 7 },
      ],
    },
    {
      kind: 'mcq',
      stem: "In Paragraph 4, what does 'a boundary between two kinds of people' refer to?",
      answer: 'Visitors saw offering and needing help as identities that should remain separate.',
      distractors: [
        'Visitors saw sewing and moving plants as skills requiring separate categories.',
        'Visitors saw the welcome table and other tables as places for separate activities.',
        'Visitors saw paid work and the help exchange as services needing separate forms.',
      ],
      evidence: 'That went on the giving side. Apparently, my line had become a boundary between two kinds of people: capable contributors and dependent recipients.',
      explanation: '访客已有修包的贡献，却仍觉得提出需求等于没有贡献；giving side 表明他把「提供帮助的人」与「需要帮助的人」当成互斥身份。',
    },
    {
      kind: 'gapChoice',
      stem: 'The writer connected people on the page by drawing ______ between their names.',
      answer: 'arrows',
      distractors: ['columns', 'circles', 'squares'],
      evidence: 'Instead of sorting people into two separate groups, I drew arrows between their names.',
    },
    {
      kind: 'short',
      marks: 2,
      stem: 'Using Paragraphs 1–3, explain why the pile of completed forms did not show that the exchange was working. Give TWO points.',
      answer: 'The purpose was to match offers with requests, rather than merely collect offers; the request columns were almost empty, so the writer had no requests to match with the many helpers.',
      evidence: 'We had plenty of willing helpers and nobody for them to help. My tidy system had nothing to connect.',
      rubric: '两分：写出「活动要把需求与能提供的帮助配起来，收集很多表格 / 很多提议本身不算完成互助」给 1 分；写出「几乎没人填需求，所以虽有许多帮助者也配不成」再给 1 分。合理变体给分；只写「表格很厚」「按类别整理」不给分；写「没有任何人愿意帮忙」与原文相反，不给第二分。',
      explanation: '第 1 段定义匹配需求和提议的任务，第 2 段用表格厚度代替成果，第 3 段揭示缺少需求，必须把目的与实际情况合起来回答。',
    },
    {
      kind: 'short',
      marks: 2,
      stem: 'Read Paragraphs 4–5. What concern did the visitor express, and how did the writer\'s own behaviour reveal the same concern?',
      answer: 'He felt that asking for help would make him appear to have nothing to contribute; although the writer had a real task requiring assistance, the writer left the request blank and hid it when the manager looked.',
      evidence: 'Nevertheless, my face grew warm when the manager looked over my shoulder, and I covered the blank space with my hand.',
      rubric: '两分：写出「访客觉得求助会让自己显得没东西可贡献 / 只会接受帮助」给 1 分；写出「作者明明需要别人帮量窗帘，却也空着需求栏，并因不好意思遮住它」再给 1 分（写出实际有需求却不肯填或遮住这一行为即可）。合理变体给分；只写「两人都想帮别人」不给分；写「作者不会设计告示」无依据，不给分。',
      explanation: '第 4 段说出顾虑，第 5 段作者的真实需求、空栏和遮挡动作呈现同样的顾虑；不是因为没有事情需要帮助。',
    },
    {
      kind: 'short',
      marks: 2,
      stem: 'Using Paragraphs 6–7, explain TWO ways in which the first request helped other exchanges begin.',
      answer: 'It gave the bag-mending visitor a specific task to respond to, after which he made his own request and drew another helper into the conversation; seeing people both offer and ask for help encouraged other visitors to fill their empty request spaces.',
      evidence: 'Seeing people both request and offer help, other visitors began filling in their empty spaces.',
      rubric: '两分：写出「作者的具体请求得到修包访客响应，接着他也提出换盆需求，把其他人接进来」给 1 分（写清一个具体请求引出下一次联系即可）；写出「旁人看到同一个人既能帮忙也能求助，便开始填写自己的需求」再给 1 分。合理变体给分；只列「窗帘、花盆、自行车」而不说明联系或示范作用不给分；写「大家必须立即回报同一个人」不给分。',
      explanation: '第 6 段是一项请求带出下一项请求的实际链条；第 7 段则是这个示范让更多人愿意填写需求。',
    },
    {
      kind: 'short',
      marks: 2,
      stem: 'According to Paragraphs 7–8, what TWO features of the exchange did the arrows show better than the writer\'s original dividing line?',
      answer: 'People could both give and receive help rather than belong to separate groups; help could pass onwards to a different person instead of always returning directly to the first helper.',
      evidence: 'Some arrows led back; others continued towards someone else across the room.',
      rubric: '两分：写出「同一人能同时提供和接受帮助，不应分成固定两类」给 1 分；写出「帮助可以继续传给第三个人，不必都是两人之间直接互换」再给 1 分。合理变体给分；只写「箭头越过直线」「名字变多」不给分，因为没有解释其含义；只写「作者画得更乱」不给分。',
      explanation: '第 7 段先否定把人固定分为两组，再说明有些箭头返回、有些延伸到别人；第 8 段直线被反复穿过，将这两种联系保留下来。',
    },
  ],
};

// 周二那篇（10-27 未发）挪到下周一 11-02，所以排在最后（叶老师 10-27 晚）。
const SPECS = [EVERYONES_THINGS, GRAPH_GAP, BLANK_COLUMN, PAPER_WON];

module.exports = {
  LEVEL,
  SPECS,
  DAYS: DATES.slice(0, SPECS.length).map((date, i) => buildAuthoredDay(SPECS[i], date)),
};
