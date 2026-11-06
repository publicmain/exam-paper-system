/**
 * 第十一周 —— olevel_intermediate（O-Level 中级），五天全原创记叙文。
 * 沿用第十周：每天八段，4 道情绪配对（共用八词词库）、1 道短语理解四选一、
 * 1 道原文填空四选一、4 道两分简答；每天 10 题、14 分。
 * 本档模板没有判断题：周一至周五均 0 道，全周 TRUE 0 / FALSE 0 / NOT GIVEN 0。
 * 保留同档题型，不为通用判断题分布要求另添题。本档五篇均非 GP 议论文。
 * 每篇至少两道简答综合多段信息；逐分给出独立要点，接受合理改写。
 *
 * 11-09 history｜A Page for the Next Writer
 *   选题与梗概：历史课体验蜡板，作者先想保留最漂亮的字，再通过暂记货物、核对并清除
 *   记录，理解可重复使用的表面为何有价值；问题从怎样保存字迹变为哪些信息需要长留。
 *   结局：将需要留存的内容转写到纸上，主动清空蜡板交给下一班，以材料的继续流转收束。
 *   事实核对：古罗马使用木框内填蜡的书写板，可用笔状工具写入，再抹平蜡面重用；
 *   可用于便笺和计算，把握高。课堂工具、任务与人物全虚构，不断言蜡板是唯一书写材料，
 *   不写发明者、起源年份、普及比例或所有古代学生的生活。未联网，采用稳定的一般史实。
 *
 * 11-10 learning｜The Sixth Arrangement
 *   选题与梗概：作者以为能分成同样大小小组的物件总数必为偶数，连续摆出多个例子后，
 *   搭档用九件分成三组推翻规则；作者学习区分支持例子、反例及明确条件。
 *   结局：作者把自己找到的另一个反例送给别组检验，以主动质疑自己的猜想收束。
 *   事实核对：九件可分成三组三件；相等两组的整数总数为偶数；单个有效反例即可否定
 *   关于所有情况的断言，把握高。课堂、安排顺序和人物虚构，不声称找到一例即证明通则。
 *
 * 11-11 health｜A Walk Worth Repeating
 *   选题与梗概：作者把午间散步变成追求最长路线的日常任务，发现完成一次不等于愿意
 *   持续参与；依据自己的体验改选近处路线，并与喜欢长走的同伴保留不同选择。
 *   结局：雨天没有补足记录；第二天仍想出门，以不需偿还的空白打破完成清单的压力。
 *   事实核对：散步、疲劳感、意愿变化均为虚构人物的个人体验，把握高；不设运动处方、
 *   心率、步数目标、医学因果或疗效，不把此人的路线说成适合所有人的健康标准。
 *
 * 11-12 psychology｜The Tune I Already Knew
 *   选题与梗概：作者反复听活动间场音乐后，由嫌它普通变成偏爱它；好友初听仍更喜欢
 *   另一首。老师以单纯接触效应解释熟悉感可能影响喜好，但提醒个人经历不能证明因果。
 *   结局：作者保留个人喜好，却退出以此代表全体听众的推荐，以限定判断的适用范围收束。
 *   事实核对：单纯接触效应指重复接触可增加喜好，效果并非必然，把握高；不编实验、
 *   数字、学者或脑科学机制。两首曲子、听取过程及偏好全部虚构，不当作受控研究结论。
 *
 * 11-13 culture｜One Painting, Several Seals
 *   选题与梗概：学校展览的作者把教学画上的三方红印当成三位共同作者；查读说明后，
 *   区分画家印与两位后来收藏者的印记，发现图像旁边还留有物件流转的文化线索。
 *   结局：以较准确的短标签打开与参观学生的长对话，从数作者转向理解不同关系。
 *   事实核对：中国书画中可见作者印与后来收藏者加盖的收藏印，后者不等于共同创作，
 *   把握高。画作、印记、流转说明及展览全部为虚构教学材料，不鉴定任何真实作品；
 *   不断言每方红印都是藏印，不凭印章数量判断真伪、年代、价格或完整收藏史。
 *
 * 查重：已完整读 pack-titles-1106.txt（1–10 周 240 篇）与 read-titles-1106.txt；
 *   完整读第十周同档与第九周同档文件头。检索旧内容包和 apps/api/test-fixtures 的
 *   wax tablet / writing tablet / stylus / counterexample / conjecture / mere exposure /
 *   repeated exposure / walking group / collector seal / ownership seal 等近邻词，
 *   未找到旧文同题材、同骨架、同高潮。另核同周标题；弃用与另一档重合的包布选题。
 *   周一不是活字排版、书后索引或博物馆复制品之争，也没有家人旧物和档案媒介恢复；
 *   周二是反例与全称断言，不是提取练习、俯视制图或一窍成能手；
 *   周三是个人活动选择与持续意愿，不是换任务当休息、比赛反超、书包负担或走散会合；
 *   周四是重复接触与喜好，不是负面偏差、记忆重构、默认效应或给机器纠错；
 *   周五是书画中画家印与收藏印的区别，不是制图网格、博物馆复制品之争或家人旧物。
 *   五篇不设专有人名，避开第九、十周各档重名；不写组屋、熟食中心及禁用叙事套路。
 * 情绪题均给具体动作，词库避免同一时刻近义竞争；证据均为原文连续逐字片段。
 * 跨段推理的另一处依据在解析注明；题干、选项、答案、rubric 及正文均按校园安全复读。
 * 正文只用可朗读的文字与普通标点；不使用算式符号、罗马数字、表情或超长单句。
 */

'use strict';

const { buildAuthoredDay, numbered } = require('../authored');
const { DATES } = require('./dates');

const LEVEL = 'olevel_intermediate';

// 周一 —— history
const WAX_PAGE = {
  key: 'original-w11-page-next-writer',
  title: 'A Page for the Next Writer',
  passage: numbered([
    "For our history lesson, the teacher placed wooden writing boards on the tables. Each held a shallow layer of wax instead of paper. She explained that people in ancient Rome had used boards like these for notes and calculations. We would try a reusable modern classroom version. I immediately imagined carrying home a message that looked as though it belonged in another century.",
    "Beside each board lay a writing tool with one narrow end and one broad end. I pressed a line into the wax, then examined the unfamiliar mark. Leaning closer, I asked how a wrong letter could be removed without taking away the whole surface. The teacher invited me to try the other end, which gradually made the wax smooth again.",
    "Our first assignment was to record deliveries to an imaginary shop. While my partner called out quantities, I arranged them in careful columns. Having finished before the next delivery, I added an elaborate border. The board was becoming a decorative object rather than a temporary record. I hoped the teacher would choose mine to display after the lesson was over.",
    "Then she asked us to check the order against the goods and clear the board for another customer. I opened my mouth and stared at her. The numbers had served their purpose, but the border had taken longer than the calculation. Surely a page that required so much effort should not be expected to disappear before the afternoon ended.",
    "My partner drew attention to the scarcity of boards. If every completed order remained untouched, the next customer would need another writing surface. The teacher explained that wax boards could be reused, while information that needed to last might be copied elsewhere. I had judged the material by how well it preserved my work, overlooking its capacity for renewal. Its practical function did not require the permanent preservation of every inscription.",
    "Before the final activity, I held my board against my chest while the others passed theirs along. My partner waited with an empty hand. I wanted to join the exchange, yet kept moving my thumb away from the border whenever I considered clearing it. Understanding the reason for reuse had not made my own careful marks any easier to surrender.",
    "Eventually, I copied the completed order onto the paper record provided for the exercise. The figures would remain available even after the wax was cleared. The distinction between information and its physical container suddenly seemed essential. Then I smoothed the board and handed it over. My partner began a new calculation on the same surface, using space that my border had occupied. Nothing important about the delivery had been lost.",
    "At the end, I tested the smooth surface with a fingertip and smiled as I placed it in the next class's tray. My paper record went into my folder. The two objects now had different jobs, and both were ready for them. Reuse gave the board utility without requiring permanence. I had wanted to take an ancient-looking page home. Instead, I left a usable page for somebody whose words were still unwritten.",
  ]),
  questions: [
    {
      kind: 'matchingFeelings',
      bank: ['curious', 'astonished', 'reluctant', 'satisfied', 'jealous', 'lonely', 'grateful', 'frightened'],
      items: [
        { moment: 'Paragraph 2 — leaning closer to the wax and asking how a wrong letter could be removed', answer: 'curious', para: 2 },
        { moment: 'Paragraph 4 — opening the mouth and staring when told to clear the carefully decorated board', answer: 'astonished', para: 4 },
        { moment: 'Paragraph 6 — holding the board against the chest while the partner waits to receive it', answer: 'reluctant', para: 6 },
        { moment: 'Paragraph 8 — smiling while placing the cleared board in the tray for the next class', answer: 'satisfied', para: 8 },
      ],
    },
    {
      kind: 'mcq',
      stem: "What does 'both were ready for them' in Paragraph 8 suggest about the paper record and the board?",
      answer: 'The paper could retain the order while the cleared board could accept new writing.',
      distractors: [
        'The paper could display the border while the decorated board could go home in a folder.',
        'The paper could replace the wax while the wooden board could display the final delivery.',
        'The paper could record new customers while the filled board could preserve every calculation.',
      ],
      evidence: 'The two objects now had different jobs, and both were ready for them.',
      explanation: '第 7 段将需保留的数字转写到纸上，再清空蜡板；第 8 段 different jobs 分别指保留信息与供下一人再写，them 指这两个用途。',
    },
    {
      kind: 'gapChoice',
      stem: 'Instead of more figures, the writer added an elaborate ______ around the first record.',
      answer: 'border',
      distractors: ['column', 'surface', 'layer'],
      evidence: 'Having finished before the next delivery, I added an elaborate border.',
    },
    {
      kind: 'short', marks: 2,
      stem: 'Considering Paragraphs 1–3, why did the writer initially treat the board as something to keep rather than something to reuse? Give TWO reasons.',
      answer: 'The writer wanted an object that seemed to connect with the ancient past; the careful decoration made the board feel like a personal work worth displaying.',
      evidence: 'The board was becoming a decorative object rather than a temporary record.',
      rubric: '两分：说明「想带走有古代感觉的物件，把它看成与过去相连的纪念」给 1 分；说明「自己精心加饰，因而把它视为值得展示的个人作品」再给 1 分。合理变体给分。只照抄木板有蜡等材料介绍而未解释留存动机不给第一分；只抄画边框的动作而未说明作品价值不给第二分。',
      explanation: '第 1 段设想带回像来自另一个世纪的文字，第 3 段又加边框并希望被展示；历史纪念与个人投入是两个独立动机。',
    },
    {
      kind: 'short', marks: 2,
      stem: 'From Paragraphs 4–5, explain why the completed delivery record could be cleared and why keeping every board unchanged would cause a problem.',
      answer: 'The goods had already been checked against that order, so its immediate purpose was finished; with only a limited supply of boards, preserving every old order would leave no surface for later customers.',
      evidence: 'If every completed order remained untouched, the next customer would need another writing surface.',
      rubric: '两分：说明「货物与订单已经核对，本次暂记用途已经完成」给 1 分；说明「板的数量有限，旧单都保留会使后来的顾客缺少可写表面」再给 1 分。合理变体给分。只抄数字或顾客等词而未解释用途不给对应分；说擦掉是因为数字有错，无原文依据不给第一分。',
      explanation: '第 4 段先核对订单再清板，第 5 段提出有限材料与后续顾客的需求，表明擦除本身可以服务实际工作。',
    },
    {
      kind: 'short', marks: 2,
      stem: 'How do the actions in Paragraphs 6 and 7 show a difference between understanding reuse and accepting it personally?',
      answer: 'Even after understanding the reason, the writer protected the decorated board instead of passing it on; later the writer actually cleared it and gave the surface to the partner for a new calculation.',
      evidence: 'Understanding the reason for reuse had not made my own careful marks any easier to surrender.',
      rubric: '两分：说明「已明白重用道理，却仍护住自己的装饰、不肯交板，表现出个人不舍」给 1 分；说明「后来真正抹平并交给伙伴再算，才在行动上接受重用」再给 1 分。合理变体给分。只抄抱板或递板动作、未说明各自反映的接受程度，不给对应分；同一份不舍换说两遍最多 1 分。',
      explanation: '第 6 段理解并未消除不舍，第 7 段的清板与交接才把理解落实到自己的作品上。',
    },
    {
      kind: 'short', marks: 2,
      stem: 'What TWO ideas about preservation are demonstrated by the separate destinations of the paper and board in Paragraphs 7–8?',
      answer: 'Keeping the information did not require keeping its original marks on wax; clearing the reusable surface allowed its practical usefulness to continue for the next class.',
      evidence: 'The figures would remain available even after the wax was cleared.',
      rubric: '两分：说明「信息可转写留存，不必保留原蜡面上的那组字迹」给 1 分；说明「清板后让下一班继续使用，保存的是材料的使用价值」再给 1 分。合理变体给分。只列纸进文件夹、板进托盘而未说明两种保留含义不给分；说清板等于所有信息丢失与原文相反。',
      explanation: '第 7 段用纸保住订单数据，第 8 段把可用表面留给下一人；保留信息与延续物件用途可以同时成立。',
    },
  ],
};

// 周二 —— learning
const SIXTH = {
  key: 'original-w11-sixth-arrangement',
  title: 'The Sixth Arrangement',
  passage: numbered([
    "During a mathematics workshop, our group received a box of counters and an unusual instruction: propose a mathematical rule, then try to make it fail. We were investigating totals that could be divided into equal groups, with more than one counter in each group and more than one group. I expected the second part to be unnecessary once a sensible rule had been found.",
    "I arranged six counters in two equal rows, then tried eight, ten and twelve. Each total allowed an arrangement and each was even. Four worked too. I placed the five examples in a neat line and invited my partner to inspect them. Surely so many successful arrangements deserved an approving nod. I had already begun writing my assumption as a confident statement.",
    "My partner asked whether an odd total might work. I pushed the box towards the middle of the table and told her to find one. Nothing happened immediately. Having checked five cases, I considered her question an obstacle to finishing rather than a useful challenge. My fingers tapped beside the heading while she selected more counters from the box.",
    "She placed nine counters in three groups of three. I counted every group twice, then moved the counters into rows and counted again. The total remained odd; the groups remained equal. I frowned at my line of successful examples. None contained a mistake, yet together they had somehow failed to protect the rule I had built upon them.",
    "The instructor asked which word in my claim made nine such a problem. I read it aloud: every total that permits equal groups must be even. Nine met our conditions but contradicted that conclusion. The earlier examples showed that the claim sometimes worked. They could not establish that it always worked, whereas this single counterexample was enough to show that it did not. This was a misconception about inference, rather than a mistake in the original arrangements.",
    "I began testing a narrower claim: every total divided into two equal groups is even. This time, I could explain why. One whole number of counters was matched by another group of exactly the same size, so the total was twice a whole number. Three equal groups were outside this claim. The change was a restriction on its scope, not a correction to nine. The revised statement was less ambitious, but its justification no longer depended on collecting examples.",
    "For our final evaluation, each group exchanged a fresh claim with another table. Before passing ours over, I chose a potentially awkward total and asked whether it might expose another weakness. I kept rearranging the counters after my partner began packing. Finding a failure now seemed worth the effort, even when it meant giving up a sentence I had written myself.",
    "Our new claim still needed discussion, but I carried one useful example to the neighbouring table. Their generalisation had the same weakness as my first one. Instead of showing them my five successful arrangements, I placed nine counters between us. For once, I was pleased to offer something that would prevent a confident conclusion rather than help it sound convincing.",
  ]),
  questions: [
    {
      kind: 'matchingFeelings',
      bank: ['proud', 'impatient', 'puzzled', 'determined', 'grateful', 'lonely', 'frightened', 'jealous'],
      items: [
        { moment: 'Paragraph 2 — displaying five neat examples and inviting an approving inspection', answer: 'proud', para: 2 },
        { moment: 'Paragraph 3 — tapping fingers beside the heading while the partner selects more counters', answer: 'impatient', para: 3 },
        { moment: 'Paragraph 4 — recounting the nine counters and frowning at the earlier successful examples', answer: 'puzzled', para: 4 },
        { moment: 'Paragraph 7 — continuing to rearrange counters after the partner starts packing', answer: 'determined', para: 7 },
      ],
    },
    {
      kind: 'mcq',
      stem: "In Paragraph 6, what is meant by 'a restriction on its scope'?",
      answer: 'The revised claim applies only to two equal groups, rather than all permitted arrangements.',
      distractors: [
        'The revised claim applies only to the five totals, rather than examples at another table.',
        'The revised claim applies only to neat rows, rather than counters placed in separate groups.',
        'The revised claim applies only to the final challenge, rather than the earlier investigation.',
      ],
      evidence: 'Three equal groups were outside this claim.',
      explanation: '原断言覆盖一切符合条件的等分，第 6 段缩到恰好两组；九分成三组仍然有效，只是不属于新断言的范围。',
    },
    {
      kind: 'gapChoice',
      stem: 'The single arrangement that disproved the first rule is described as a ______.',
      answer: 'counterexample',
      distractors: ['statement', 'restriction', 'conclusion'],
      evidence: 'whereas this single counterexample was enough to show that it did not.',
    },
    {
      kind: 'short', marks: 2,
      stem: 'Drawing on Paragraphs 1–3, why did the writer at first dismiss the partner\'s question, and how did this conflict with the workshop instruction?',
      answer: 'The five working cases made the writer feel that the rule was already secure; treating a search for failure as a delay conflicted with the instruction to try to make the proposed rule fail.',
      evidence: 'Having checked five cases, I considered her question an obstacle to finishing rather than a useful challenge.',
      rubric: '两分：说明「五个例子都成功使作者以为规则已经可靠，无须再查」给 1 分；说明「把寻找失败当阻碍，违背了任务本来要求主动检验、尝试推翻规则」再给 1 分。合理变体给分。只照抄敲手指、递盒子而未解释轻视问题的原因不给第一分；只写不耐烦而未联系任务目的不给第二分。',
      explanation: '第 2、3 段显示成功例子带来过早确信；第 1 段明确要求 try to make it fail，伙伴的挑战正服务于该任务。',
    },
    {
      kind: 'short', marks: 2,
      stem: 'Explain TWO different logical roles played by the five original examples and the arrangement of nine in Paragraphs 4–5.',
      answer: 'The five cases showed that some totals with equal groups were even, without covering every case; nine satisfied the grouping conditions while being odd, so it disproved the claim about every such total.',
      evidence: 'The earlier examples showed that the claim sometimes worked. They could not establish that it always worked, whereas this single counterexample was enough to show that it did not.',
      rubric: '两分：说明「原五例只说明部分情况符合，不能推出所有情况都符合」给 1 分；说明「九符合分组条件却是奇数，所以足以否定覆盖所有情况的规则」再给 1 分。合理变体给分。只列五个偶数与一个奇数、未解释它们对通则的作用不给对应分；说原五例算错与原文相反。',
      explanation: '第 4 段五例本身无错却保不住规则；第 5 段区分支持性例子与反例对全称断言的不同作用。',
    },
    {
      kind: 'short', marks: 2,
      stem: 'Why can the narrower statement in Paragraph 6 be justified without rejecting the partner\'s arrangement? Give TWO points.',
      answer: 'Exactly two equal groups make a total twice a whole number, which must be even; nine was arranged in three groups, so it remains valid but does not fall under the narrower statement.',
      evidence: 'One whole number of counters was matched by another group of exactly the same size, so the total was twice a whole number.',
      rubric: '两分：解释「两组同样多的整数个数相加是整数的两倍，因此总数为偶数」给 1 分；说明「九分三组依然正确，只是不在限定为两组的新规则范围内」再给 1 分。合理变体给分。只抄 two equal groups 而不解释偶数原因不给第一分；说九不能等分或必须改成偶数不给第二分。',
      explanation: '第 6 段对新规则给出一般理由，同时明确三组属于范围之外，无须把有效反例改成错误例子。',
    },
    {
      kind: 'short', marks: 2,
      stem: 'Compare Paragraph 2 with Paragraphs 7–8. How have the writer\'s method of checking a claim and purpose in sharing an example changed?',
      answer: 'The writer now deliberately searches for awkward cases that could defeat a personal claim instead of collecting only support; the example is offered to help others avoid a false conclusion rather than win approval for a convincing display.',
      evidence: 'For once, I was pleased to offer something that would prevent a confident conclusion rather than help it sound convincing.',
      rubric: '两分：说明「检验方法从只积累支持例子变为主动找可能推翻自己规则的情况」给 1 分；说明「分享目的从求赞同、显得有说服力变为帮助别人避免错误结论」再给 1 分。合理变体给分。只照抄摆九个或摆五例等动作而未解释方法或目的不给对应分；重复说作者更认真不能自动得两分。',
      explanation: '第 2 段摆好例子期待点头，第 7 段肯放弃自己的句子找弱点，第 8 段又用反例帮别组停止过早定论。',
    },
  ],
};

// 周三 —— health
const WALK = {
  key: 'original-w11-walk-worth-repeating',
  title: 'A Walk Worth Repeating',
  passage: numbered([
    "When our school opened its grounds for lunchtime walking, I drew the longest possible route around the buildings. I wanted my new habit to demonstrate perseverance from the beginning. The notice offered a chance to enjoy moving outdoors, without setting a distance. Nevertheless, I brought a notebook in which each completed route would receive a large tick beside the date.",
    "On Monday, I returned from the far gate while my friends were still sitting beneath the covered entrance. I held up my completed route and described every building I had passed. Their shorter circuit suddenly seemed a modest achievement beside mine. Although my legs felt tired, I made certain that they noticed the tick before I put the notebook away.",
    "By Wednesday, anticipation of the long route was reducing my incentive to go outside. I had enough time to walk, and the weather was pleasant. Yet the thought of the distant gate made me delay putting on my shoes until the opportunity had nearly passed. I had completed the longest route twice. That success was making the next walk less attractive rather than more likely.",
    "I finally went out, but stopped beside the library instead of continuing towards the gate. Looking between the nearby path and my notebook, I could not decide whether a shorter circuit would count. The school had supplied no numerical target. The demand came entirely from a rule I had added, although I had begun treating it as part of the activity itself. An invitation had quietly become an obligation, a transformation for which I was responsible.",
    "Under the trees, a friend was walking the smaller circuit for a second time. She explained that she sometimes did one circuit and sometimes several, depending on how she felt and what time remained. I joined her for one. We returned with time for a leisurely conversation. For the first afternoon that week, I found myself hoping that tomorrow's weather would allow another walk.",
    "I could not generalise from this that her route was best for everyone. Another friend enjoyed going all the way to the gate and had no difficulty looking forward to it. For me, however, the manageable route removed the pressure that had been keeping me inside. A plan completed once was different from a habit I actually wanted to repeat during an ordinary school week. Sustainability, in this personal sense, mattered more than an impressive maximum.",
    "On Thursday, I chose the trees without consulting the route drawing. Back at the entrance, I stretched my legs comfortably and stayed to finish a conversation, no longer calculating how much further I could have gone. The walk felt like something I had chosen rather than something still owed. I left the notebook in my bag throughout the afternoon.",
    "Friday brought steady rain, so I remained indoors. There was no extra circuit to repay on Monday and no unfinished total waiting in the notebook. When a friend asked about next week, I agreed to meet beneath the trees if the weather allowed. One date had been left blank. Strangely, the blank had done nothing to reduce my wish to begin again.",
  ]),
  questions: [
    {
      kind: 'matchingFeelings',
      bank: ['proud', 'reluctant', 'uncertain', 'contented', 'jealous', 'grateful', 'frightened', 'lonely'],
      items: [
        { moment: 'Paragraph 2 — holding up the completed route and making sure friends see the large tick', answer: 'proud', para: 2 },
        { moment: 'Paragraph 3 — delaying putting on shoes despite having time and pleasant weather', answer: 'reluctant', para: 3 },
        { moment: 'Paragraph 4 — looking between the nearby path and the notebook without deciding whether a shorter walk counts', answer: 'uncertain', para: 4 },
        { moment: 'Paragraph 7 — stretching comfortably and finishing a conversation without calculating a missing distance', answer: 'contented', para: 7 },
      ],
    },
    {
      kind: 'mcq',
      stem: "What does 'something still owed' in Paragraph 7 refer to?",
      answer: 'A distance the writer felt obliged to complete under a personally imposed rule.',
      distractors: [
        'A conversation the writer had promised to finish beside the covered entrance.',
        'A notebook the writer was expected to give back after drawing the longest route.',
        'A circuit the writer had been instructed to add whenever a friend walked further.',
      ],
      evidence: 'The walk felt like something I had chosen rather than something still owed.',
      explanation: '第 4 段说明距离要求来自作者自定规则，第 7 段不再计算还能多走多少；owed 指把自定距离视为必须偿清的任务，不是真借了物件。',
    },
    {
      kind: 'gapChoice',
      stem: 'On Thursday, the writer chose the trees without ______ the route drawing.',
      answer: 'consulting',
      distractors: ['continuing', 'calculating', 'completing'],
      evidence: 'On Thursday, I chose the trees without consulting the route drawing.',
    },
    {
      kind: 'short', marks: 2,
      stem: 'What contrast emerges between the purpose on the school notice and the writer\'s personal measure of success in Paragraphs 1–2?',
      answer: 'The school offered enjoyable outdoor movement without a set distance; the writer measured success by completing the longest route and having that achievement recognised.',
      evidence: 'The notice offered a chance to enjoy moving outdoors, without setting a distance.',
      rubric: '两分：写出「学校提供享受户外活动的机会，不设距离」给 1 分；说明「作者却以最长路线完成记录、让人看见成绩来衡量成功」再给 1 分。合理变体给分。只照抄带笔记本、经过楼房等细节但不说明成功标准不给第二分；把最长路线说成学校规定不给第一分。',
      explanation: '第 1 段学校目的与自加路线形成对照，第 2 段展示大勾并看轻短路线，把个人量化标准表现出来。',
    },
    {
      kind: 'short', marks: 2,
      stem: 'Why did completing the long route twice fail to establish a lasting habit, and what made the hesitation beside the library unnecessary? Use Paragraphs 3–4.',
      answer: 'Anticipating the demanding route discouraged the writer from going out again; the shorter walk did not violate any school requirement because the minimum distance existed only in the writer\'s own rule.',
      evidence: 'The demand came entirely from a rule I had added, although I had begun treating it as part of the activity itself.',
      rubric: '两分：说明「一想到长路线就拖延、不愿再出门，完成过两次并没有带来持续意愿」给 1 分；说明「学校没有最低距离，短走没有违反活动要求，犹豫来自自定规则」再给 1 分。合理变体给分。只抄完成两次而未说明它对下次意愿的影响不给第一分；说时间或天气不允许，与原文相反。',
      explanation: '第 3 段排除没时间和天气差，直接呈现预想长路线的阻力；第 4 段揭示所谓门槛是自己加的。',
    },
    {
      kind: 'short', marks: 2,
      stem: 'How does the comparison between the two friends in Paragraphs 5–6 support a personal conclusion without establishing one ideal route for everybody?',
      answer: 'Trying the shorter circuit made the writer look forward to walking again, showing that it suited this writer\'s continuing participation; the other friend still enjoyed the long route, showing that the writer\'s preference was not a universal standard.',
      evidence: 'Another friend enjoyed going all the way to the gate and had no difficulty looking forward to it.',
      rubric: '两分：说明「作者短走后开始期待明天，支持这条路线更适合作者持续参与」给 1 分；说明「另一朋友仍乐于长走，表明不能把作者的选择推广成人人最佳」再给 1 分。合理变体给分。只列有人走短有人走长、不说明各自支持的判断不给对应分；宣称短走对所有人最健康无依据。',
      explanation: '第 5 段给作者恢复意愿的具体表现，第 6 段用仍爱长走的朋友限定结论范围，避免把个人适合当成普遍处方。',
    },
    {
      kind: 'short', marks: 2,
      stem: 'What do leaving the notebook in the bag and accepting Friday\'s blank date reveal about the writer\'s changed attitude in Paragraphs 7–8? Give TWO points.',
      answer: 'The writer no longer needed a recorded distance to make a chosen walk feel worthwhile; missing a rainy day no longer created a debt or prevented the writer from wanting to return.',
      evidence: 'One date had been left blank. Strangely, the blank had done nothing to reduce my wish to begin again.',
      rubric: '两分：说明「不再靠距离打勾来认可一次自主选择的散步」给 1 分；说明「雨天缺一次不再意味着欠账，也不破坏下周继续的意愿」再给 1 分。合理变体给分。只照抄本子在包里或下雨等事实而未解释态度改变不给对应分；说作者彻底放弃散步与结尾相反。',
      explanation: '第 7 段不算缺多少距离、不拿记录本，第 8 段接受空白却仍约下周，表明活动已从完成债务变回愿意继续的选择。',
    },
  ],
};

// 周四 —— psychology
const TUNE = {
  key: 'original-w11-tune-already-knew',
  title: 'The Tune I Already Knew',
  passage: numbered([
    "Our arts club needed a short piece of music between activities at its open afternoon. I volunteered to trim the recordings, believing that listening carefully would make me an impartial judge. We had two original pieces, both played softly on a piano. I intended to recommend whichever seemed more enjoyable, although nobody had asked me to speak for the visitors.",
    "The first piece had a simple repeated phrase. I rested my chin on my hand and waited for it to end, wondering whether the afternoon would feel equally dull. The second piece changed direction more often and immediately held my attention. I put a star beside it, certain that the first recording would be useful only for practising the editing controls.",
    "Over several afternoons, I replayed the first piece while finding a suitable beginning and end. I heard its opening whenever I checked a new edit, gradually learning where each note would lead. By the time the finished recording was ready, I was humming along. When my friend arrived, I played it again and waited eagerly for her to share my growing enthusiasm.",
    "She preferred the second piece. I replayed both, checking that I had opened the correct files. The first now seemed pleasantly balanced to me, while she described it as rather ordinary. I tilted my head and asked which part had failed to interest her. We were hearing the same notes, yet the attractive qualities I expected her to perceive were apparently missing from her experience.",
    "Our teacher suggested that familiarity might explain part of the difference. Psychologists describe a mere exposure effect, in which repeated encounters can increase liking. Something need not acquire new features for our response to it to change. Familiarity could influence preference without supplying evidence of superior musical quality. She added that this was a tendency, not a promise: repetition does not make every sound pleasant, and people can also grow tired of things.",
    "I looked at my recommendation, which called the first piece the obvious favourite for visitors. My face warmed, and I turned the page over before my friend could read further. I had compared my response after many hearings with hers after an introduction. The music was unchanged, but our listening histories differed. My subjective enjoyment did not establish what an unfamiliar audience would prefer.",
    "Nor could my editing experience prove that repetition alone had caused the change. I had also spent time working on the recording and wanting the result to succeed. The teacher's explanation was plausible, but our afternoon was not a controlled study. Understanding a recognised effect meant considering it as a possibility, rather than treating a plausible inference as an established cause. That distinction prevented an attractive interpretation from becoming an unsupported assertion.",
    "I rewrote the recommendation: this was the piece I preferred after working with it. The club would hear both before choosing, and I would explain my extra listening instead of presenting myself as a typical visitor. On the way home, I found myself humming the familiar opening again. I could still enjoy it without asking that enjoyment to settle the choice for everybody else.",
  ]),
  questions: [
    {
      kind: 'matchingFeelings',
      bank: ['confident', 'bored', 'puzzled', 'embarrassed', 'lonely', 'grateful', 'frightened', 'jealous'],
      items: [
        { moment: 'Paragraph 1 — volunteering to edit while believing careful listening will make the writer a reliable judge', answer: 'confident', para: 1 },
        { moment: 'Paragraph 2 — resting the chin on a hand and waiting for the first piece to end', answer: 'bored', para: 2 },
        { moment: 'Paragraph 4 — checking both files and asking why the friend does not recognise the expected qualities', answer: 'puzzled', para: 4 },
        { moment: 'Paragraph 6 — feeling the face warm and turning the recommendation over before the friend reads on', answer: 'embarrassed', para: 6 },
      ],
    },
    {
      kind: 'mcq',
      stem: "What is implied by 'asking that enjoyment to settle the choice' in Paragraph 8?",
      answer: 'Treating the writer\'s personal liking as sufficient reason to choose music for everyone.',
      distractors: [
        'Treating the friend\'s first reaction as sufficient reason to stop editing the recordings.',
        'Treating the familiar opening as sufficient reason to shorten both original piano pieces.',
        'Treating the teacher\'s explanation as sufficient reason to replay music between activities.',
      ],
      evidence: 'I could still enjoy it without asking that enjoyment to settle the choice for everybody else.',
      explanation: '第 6 段认识到个人多次听后的喜好不能代表陌生听众；第 8 段保留喜好但撤去代表性，settle the choice 指据此替所有人定案。',
    },
    {
      kind: 'gapChoice',
      stem: 'The teacher calls the effect a ______ rather than a promise that every sound will become pleasant.',
      answer: 'tendency',
      distractors: ['direction', 'recording', 'phrase'],
      evidence: 'She added that this was a tendency, not a promise:',
    },
    {
      kind: 'short', marks: 2,
      stem: 'Linking Paragraphs 2–3 with Paragraph 5, explain the change in the writer\'s response and how the teacher\'s suggestion could account for it.',
      answer: 'The writer moved from waiting impatiently for the first piece to end to humming it with enjoyment; repeated editing made it familiar, which could increase liking even though the notes themselves had not changed.',
      evidence: 'Something need not acquire new features for our response to it to change.',
      rubric: '两分：写出「从觉得第一首乏味、等它结束变为喜欢并跟着哼」给 1 分；解释「反复剪辑使它熟悉，熟悉可能增加喜好，不必是曲子本身变好」再给 1 分。合理变体给分。只抄多听了几次而未解释熟悉感与喜好关系不给第二分；说反复听必定喜欢，不符合老师的限定。',
      explanation: '第 2、3 段给出前后反应，第 5 段提出重复接触可增好感的可能解释，并未证明这个人的变化只有该原因。',
    },
    {
      kind: 'short', marks: 2,
      stem: 'Why does the disagreement in Paragraphs 4–6 undermine the phrase "obvious favourite for visitors"? Explain TWO points.',
      answer: 'The writer and friend had different amounts of experience with the piece, so the writer was not judging as a new visitor would; the friend actually preferred the other piece, providing a direct example against treating the writer\'s preference as obvious to everyone.',
      evidence: 'I had compared my response after many hearings with hers after an introduction.',
      rubric: '两分：说明「作者多次听、朋友初听，作者的熟悉程度不能代表新访客」给 1 分；说明「朋友实际更喜欢另一首，直接显示此喜好并非对人人显然」再给 1 分。合理变体给分。只照抄同一音符或听取次数而未解释代表性不给第一分；只写意见不同而未联系不能替众人定最爱不给第二分。',
      explanation: '第 4 段给出相反偏好，第 6 段指出接触史不同；一项关乎判断条件，一项是实际反例，分别削弱原推荐。',
    },
    {
      kind: 'short', marks: 2,
      stem: 'What TWO limits should be placed on the explanation of the writer\'s experience, according to Paragraphs 5–7?',
      answer: 'Repeated exposure is a tendency rather than a guarantee of greater liking; this uncontrolled experience also involved effort and wanting success, so it cannot establish repetition as the sole cause.',
      evidence: 'I had also spent time working on the recording and wanting the result to succeed.',
      rubric: '两分：说明「重复接触只是可能增加喜好的倾向，不保证每次有效，亦可能生厌」给 1 分；说明「个人经历还有投入劳动或希望成功等因素，未经控制，不能认定重复是唯一原因」再给 1 分。合理变体给分。只抄 not a controlled study 而未说明不能推出单一因果不给第二分；否认公认效应存在，不是原文结论。',
      explanation: '第 5 段限制现象的一般适用性，第 7 段限制这个具体故事能够提供的因果证据，两者不能混成同一个限制。',
    },
    {
      kind: 'short', marks: 2,
      stem: 'How does Paragraph 8 distinguish being honest about a preference from abandoning it? Give TWO aspects of the writer\'s response.',
      answer: 'The writer qualifies the recommendation by explaining the extra listening instead of claiming a typical visitor\'s preference; the writer continues to enjoy and hum the first piece rather than rejecting the personal preference.',
      evidence: 'The club would hear both before choosing, and I would explain my extra listening instead of presenting myself as a typical visitor.',
      rubric: '两分：说明「交代自己的额外听取经历，明确这只是自身条件下的偏好，不冒充典型访客」给 1 分；说明「仍喜欢、仍哼第一首，限定代表性不等于放弃个人喜好」再给 1 分。合理变体给分。只抄改写了推荐却不说明改写的判断范围不给第一分；说作者改为喜欢第二首与原文相反。',
      explanation: '结尾改变的是个人喜好在集体决定中的权重，而非喜好本身；公开判断条件与保留个人感受是不同层面。',
    },
  ],
};

// 周五 —— culture
const SEALS = {
  key: 'original-w11-painting-several-seals',
  title: 'One Painting, Several Seals',
  passage: numbered([
    "For our school's exhibition of Chinese painting, I volunteered to caption a teaching reproduction. The teacher had supplied an invented landscape with an account of its history, so we could practise reading the marks around an image. I expected the assignment to take minutes. The title was clear, and the red seals seemed an obvious way to count the artists involved.",
    "One seal stood beside the painter's writing, while two others occupied corners of the image. Each was a separate red impression containing characters I could not yet read. I wrote a label describing the landscape as a collaboration between three artists. Since the caption had to be brief, counting marks seemed more efficient than working through the accompanying explanation of the picture's history.",
    "My partner asked whether the seals might have been added at different times. I moved my finger between the river and the hills, unable to decide which supposed artist had contributed each part. Then I counted the seals again, as though another inspection might resolve the puzzle. Three marks were certainly visible. Why did they not reveal three separate contributions to the landscape?",
    "The teaching account supplied an answer. One painter had created the landscape; two later collectors had added seals while the work belonged to them. Our teacher explained that collectors have sometimes placed their own seals on Chinese paintings they owned. These marks could record ownership rather than authorship. Their presence did not mean that the collectors had helped paint the original image.",
    "I turned my label face down when the teacher came over, feeling my face grow warm. I had presented an assumption as an identification. The marks recorded different relationships with the painting, rather than equal shares of creative work. My quick calculation had converted a history of possession into a claim about collaboration, simply because every impression happened to use red ink.",
    "We replaced the label but kept the full reproduction. Removing the extra seals would conceal part of the painting's passage between owners. Keeping them visible also allowed visitors to examine the evidence themselves, rather than depend entirely on our caption. The revised text distinguished the painter from the collectors, without pretending that a short label could reconstruct every detail of the object's journey.",
    "I asked to see another teaching image, leaning forward to examine its margins and asking what journey its marks might suggest. This time, I opened the explanatory notes before counting anything. I was no longer hoping for a quicker method of labelling. I wanted to explore which relationships the marks revealed and what remained unknown, without treating every mark as an artist's signature.",
    "When the exhibition opened, a younger student pointed to the three seals and asked how many people had painted the landscape. I gave the answer from my corrected caption, then invited her to consider what the other marks could tell us. We traced their different roles together. The label now named fewer makers, but it had opened a much longer conversation.",
  ]),
  questions: [
    {
      kind: 'matchingFeelings',
      bank: ['confident', 'puzzled', 'embarrassed', 'curious', 'jealous', 'lonely', 'frightened', 'bored'],
      items: [
        { moment: 'Paragraph 1 — volunteering to write the caption while expecting the assignment to take only minutes', answer: 'confident', para: 1 },
        { moment: 'Paragraph 3 — counting the seals again while failing to identify three separate contributions', answer: 'puzzled', para: 3 },
        { moment: 'Paragraph 5 — turning the label face down as the teacher approaches and feeling the face grow warm', answer: 'embarrassed', para: 5 },
        { moment: 'Paragraph 7 — asking for another image and leaning forward to explore the journeys suggested by its marks', answer: 'curious', para: 7 },
      ],
    },
    {
      kind: 'mcq',
      stem: "What does 'converted a history of possession into a claim about collaboration' mean in Paragraph 5?",
      answer: 'The writer mistook signs of later ownership for evidence that several people made the painting.',
      distractors: [
        'The writer mistook the painter\'s writing for evidence that the red impressions formed the landscape.',
        'The writer mistook different corners for evidence that the collectors could read all the characters.',
        'The writer mistook the accompanying account for evidence that the visitors had created the reproduction.',
      ],
      evidence: 'My quick calculation had converted a history of possession into a claim about collaboration, simply because every impression happened to use red ink.',
      explanation: '第 4 段说明两方印记录后来收藏，第 5 段指出作者却把它们算成共同创作的证据；possession 与 collaboration 指拥有关系和创作关系的误换。',
    },
    {
      kind: 'gapChoice',
      stem: 'The writer initially called the work a ______ between three artists.',
      answer: 'collaboration',
      distractors: ['contribution', 'calculation', 'conversation'],
      evidence: 'I wrote a label describing the landscape as a collaboration between three artists.',
    },
    {
      kind: 'short', marks: 2,
      stem: 'Using Paragraphs 1–2, explain why the seals seemed a convenient shortcut and what visual feature encouraged the writer\'s mistaken assumption.',
      answer: 'The writer wanted a brief caption without spending time reading the historical account; the separate impressions all used red marks, encouraging the assumption that each represented the same role of artist.',
      evidence: 'Since the caption had to be brief, counting marks seemed more efficient than working through the accompanying explanation of the picture\'s history.',
      rubric: '两分：说明「想快速写简短标签，不愿先读流转说明，数印看似省时」给 1 分；说明「各方印虽分开却同为红色印记，被作者误视为同一种作者标记」再给 1 分。合理变体给分。只抄标签短、印在角落等事实而未解释省时或同类视觉印象不给对应分；说作者读懂了所有印文与原文相反。',
      explanation: '第 1 段预期几分钟完成，第 2 段把数印当阅读的捷径；各印同为红色的表面相似，被错误延伸为功能相同。',
    },
    {
      kind: 'short', marks: 2,
      stem: 'How does the teaching account in Paragraph 4 clarify who created the image and what the other two seals recorded?',
      answer: 'One painter created the landscape, so the three seals did not establish joint authorship; the other two were added by later collectors and recorded periods of ownership rather than contributions to the painting.',
      evidence: 'One painter had created the landscape; two later collectors had added seals while the work belonged to them.',
      rubric: '两分：说明「山水由一位画家创作，三方印不代表三人共同作画」给 1 分；说明「另两方是后来的收藏者所加，记录拥有关系而非作画分工」再给 1 分。合理变体给分。只照抄一人、两人等数字而未区分创作与收藏不给对应分；将收藏印说成后来修画的证据无依据。',
      explanation: '教学说明分别确定原作创作者和后加印者的身份，解释不同印在这张画里留下的两类关系。',
    },
    {
      kind: 'short', marks: 2,
      stem: 'Why were the collectors\' seals worth leaving visible after the label was corrected in Paragraph 6? Give TWO reasons.',
      answer: 'They preserved signs of the painting passing between owners, which cropping would hide; leaving them visible let visitors inspect the evidence for themselves instead of relying entirely on the caption.',
      evidence: 'Removing the extra seals would conceal part of the painting\'s passage between owners. Keeping them visible also allowed visitors to examine the evidence themselves, rather than depend entirely on our caption.',
      rubric: '两分：解释「藏印保留流转或拥有史的线索，裁掉会隐去这部分」给 1 分；解释「留下可见证据，让参观者自己查看，不必完全依赖标签概括」再给 1 分。合理变体给分。只抄 kept the full reproduction 而未解释历史信息或读者核看作用不给对应分；说印越多价值越高无依据。',
      explanation: '第 6 段把保留历史线索与允许读者自行看证据分开说明，是内容价值和核看机会两个独立理由。',
    },
    {
      kind: 'short', marks: 2,
      stem: 'Drawing on Paragraphs 4–8, explain why the final label names fewer makers yet leads to a longer conversation.',
      answer: 'It correctly distinguishes the one creator from later collectors instead of inventing additional artists; recognising the different relationships opens questions about the painting\'s ownership and journey beyond the count of its makers.',
      evidence: 'The label now named fewer makers, but it had opened a much longer conversation.',
      rubric: '两分：说明「正确把一位创作者与后来收藏者分开，不再虚增共同作者」给 1 分；说明「不同身份让谈话转向收藏、流转等关系，超出数几个作者」再给 1 分。合理变体给分。只抄 fewer makers 或 longer conversation 而未解释准确性及新增话题不给对应分；说最后认定所有印都是画家签名与原文相反。',
      explanation: '第 7 段兴趣转向不同人的关系与物件旅程，第 8 段从作画人数追问其他印的作用；更准确的短标签反而引出更多文化理解。',
    },
  ],
};

const SPECS = [WAX_PAGE, SIXTH, WALK, TUNE, SEALS];

module.exports = {
  LEVEL,
  SPECS,
  DAYS: DATES.slice(0, SPECS.length).map((date, i) => buildAuthoredDay(SPECS[i], date)),
};
