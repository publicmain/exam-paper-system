/**
 * 第十周 —— ielts_authentic（雅思真题难度）档，全原创，四个教学日按日期排列。
 * 结构沿用第九周：八段 Paragraph A–H；3 道段落信息配对、3 道判断、
 * 2 道原文单词填空、2 道各两分简答，共 10 题、12 分。篇幅目标 750–800 词。
 *
 * 11-03 history：A Second Route Through the Book（历史说明文，非 GP 议论文）。
 *   选题 / 梗概：书后索引如何从手抄本时代的定位工具，发展成依赖稳定版本、概念分类
 *   和人工编辑判断的阅读基础设施。结尾：数字检索没有消除概念组织工作，索引也记录
 *   一代编辑对读者需求的理解；不写某位发明者单独带来突破的发现故事。
 *   事实把握高：欧洲活字印刷出现前已有字母索引；手抄本的分叶、版面可能不同；folio 是有正反面的
 *   一叶；同一排版的印本可共用位置参照，不同版本页码未必相同；concordance 按词定位，
 *   subject index 按概念组织。正文不设具体起源年份、首创者或普及率，亦不声称印本完全相同。
 *
 * 11-04 community：When a Community Hall Carries a Brand（GP 议论文）。
 *   选题 / 梗概：社区场馆应否用商业冠名换取活动资源；充分承认资助能降低参与门槛，
 *   再区分公开致谢与左右场馆使用权。结局：以可见条件、到期复审及保留非顾客参与权
 *   作为接受赞助的前提，而非一律拒绝或一律欢迎。
 *   事实把握高：资助与商业排他条件可能产生取舍，是合同安排的逻辑分析；陶艺房、
 *   企业标识、开放日及冠名安排全部明确设例，不冒充真实项目、调查或政策成效。
 *
 * 11-05 learning：When Speed Becomes a Grade（GP 议论文）。
 *   选题 / 梗概：学习评价应在何种情况下把速度计入成绩；权衡熟练度与同场可比性，
 *   对照需要检查推理的任务，辨别限时所测的能力。结局：速度只在明示目标要求时计分，
 *   并分别报告正确性与用时，避免用一个总分遮蔽不同能力。
 *   事实把握高：固定时间限定可完成工作量；相同表面条件不自动证明测量有效；例中
 *   未完成与答错可区分。均为测量逻辑及明确假设的课堂设例，无心理实验或人群统计。
 *
 * 11-06 culture：The Place of the Replica（GP 议论文）。
 *   选题 / 梗概：博物馆复制品可否具有独立展示价值；先为原件的物质证据辩护，再以
 *   可操作模型说明复制的解释能力，承认预算与陈列空间约束。结局：保留原件研究价值，
 *   同时按复制目的及公开说明的限度决定复制品位置，不以外观逼真代替证据。
 *   事实把握高：复制形状不等于复制材料年代和使用痕迹；可操作模型可示范运动；放大
 *   模型改变尺度。织机模型、陶器表面及展柜全为设例，没有具体馆藏、品牌、年代、统计。
 *
 * 事实仅按已有知识核对；依简报不联网。全文无人名、研究归因或不确定数字。
 * 查重：完整核对 pack-titles-1030.txt（1–9 周）及 read-titles-1030.txt；
 * 阅读第八周本档文件头、第九周本档全文，检索旧内容包及 test-fixtures 的
 * concordance / book index / subject index / indexing / replica / sponsor /
 * timed assessment / time limit / speed 与 grade 组合，未发现同主论题文章。
 * 相近处说明：旧文 What Libraries Became 讨论图书馆用途，The Library Card 是借阅故事，
 * 第九周选择篇用目录筛选说明自主选择；周二研究书内概念索引的历史与版本约束。
 * 第八周 The Test That Teaches 讨论提取对记忆的作用；周四研究评价是否应计入速度，
 * 不讲提取练习、遗忘或间隔效应。文化篇也不讲旧文 kintsugi 的陶器修补技法。
 * 四篇依次采用工具发展史、资源与使用权权衡、评价效度分析、物质证据与展示功能比较，
 * 不复用叙事桥段或第九周 GP 议题；三篇 GP 均有题目检验论证用途、让步或作者立场。
 *
 * 判断题分布：周二 F/F/NG；周三 T/NG/T；周四 NG/NG/F；周五 F/T/T。
 * 全周 TRUE 4、FALSE 4、NOT GIVEN 4；每天恰好两类，未提及不固定在最后。
 * 评分：两分简答逐分独立；接受合理同义改写；照抄相关句但未回答因果或论证层不给该分。
 * 校园安全：正文、题目、选项、解析和 rubric 均逐句复核，仅涉及阅读、社区、学习和展陈。
 */

'use strict';

const { buildAuthoredDay, lettered } = require('../authored');
const { DATES } = require('./dates');

const LEVEL = 'ielts_authentic';

// 周二 —— 书后索引的发展与版本约束；徽章主题：history。
const INDEX = {
  key: 'original-w10-book-index',
  title: 'A Second Route Through the Book',
  passage: lettered([
    `A book appears to prescribe a direction: begin at the front, proceed through the chapters and finish at the back. Yet a reader seeking a particular idea may need an entirely different route. The index, usually encountered among the final pages, supplies one. Its entries detach subjects from the sequence in which an author presents them and rearrange them for consultation. This apparently modest apparatus has a history that complicates the familiar association between reading and continuous attention. Long before electronic searching, books were being designed to accommodate readers who wanted to enter an argument somewhere other than its beginning.`,
    `Alphabetical indexes existed in European manuscript culture before movable-type printing arrived there. Scholars consulting substantial works needed ways to relocate passages without reading everything again, and references could direct them to a section or a particular leaf. A leaf, also called a folio, has two sides, which could be distinguished in the reference. Such arrangements depended on the physical organisation of the individual volume. Since handwritten copies of the same work could distribute their text differently, a location that served one copy might be unhelpful in another. The idea of indexed access thus preceded the convenient stability of widely reproduced page layouts.`,
    `An index should also be distinguished from a table of contents. The latter generally follows a work's sequence and displays its larger divisions; the former can assemble references scattered across those divisions. A discussion of irrigation, for instance, might occur in chapters organised around different regions rather than under a single chapter heading. An index could bring those discussions together, making a comparison possible which the chapter sequence does not itself advertise. The distinction concerns the organisation of access rather than the importance of either device: one offers an overview of the author's arrangement, while the other supports alternative enquiries.`,
    `Printing made it possible for copies produced from the same setting of type to share the locations to which an index referred. This did not mean that every printed copy was identical, or that references remained stable indefinitely. When a work was reset, expanded or issued in a different format, its pagination could change. An index to one edition cannot automatically be transferred to another. The useful innovation was therefore a relationship between a set of references and a sufficiently stable text, rather than a sequence of numbers that would identify a passage independently of how the book was made.`,
    `The difference between a concordance and a subject index reveals another layer of work. A concordance gathers occurrences of words, whereas a subject index organises references around concepts. A passage about the movement of water through fields might be relevant to irrigation without containing that particular term. Conversely, a word can appear in a passage which contributes little to the subject a reader is investigating. Locating vocabulary and identifying conceptual relevance are consequently related but distinct activities. Neither the visible frequency of a word nor its complete absence settles whether a discussion belongs under a particular subject heading.`,
    `Producing a useful subject index therefore requires decisions about terminology and relationships. The indexer must anticipate the expressions readers might try, group related discussions and provide cross-references between alternative headings. A broad entry with an undifferentiated list of pages can simply transfer the original search problem to a smaller space. Subdivisions help distinguish separate aspects of a subject, although multiplying them excessively can make the arrangement difficult to navigate. Page references must also be checked against the final layout. Intellectual organisation and material accuracy are inseparable here: a perceptive heading is of limited use if it directs the reader elsewhere.`,
    `Electronic word searching has altered the practical setting without eliminating these distinctions. A search can locate a supplied expression rapidly, but the user still has to choose that expression and interpret the resulting matches. Searching for irrigation alone would not retrieve a discussion that used only other wording. A subject index can connect those expressions through an editorial judgement about meaning. This is not evidence that human indexing is invariably superior; an index can omit a useful connection, while a search can uncover an occurrence its compiler overlooked. Their strengths differ because they organise the reader's enquiry at different levels.`,
    `Seen historically, the index belongs among the tools that changed what readers could ask of a book. It supported consultation alongside continuous reading and made dispersed material available for comparison. Its apparent impersonality should nevertheless be treated cautiously. Decisions about what deserves a heading, which terms count as equivalent and how much detail to provide reflect an interpretation of the work and its likely users. An index is therefore evidence of reading priorities as well as a means of locating information. The second route through a book has never been independent of the people who chose where its entrances should be.`,
  ]),
  questions: [
    {
      kind: 'matchingParagraphs',
      items: [
        { item: 'an explanation of why references associated with one printed edition may not work in another', letter: 'D' },
        { item: 'a comparison showing that digital searching and human indexing can each miss material', letter: 'G' },
        { item: 'evidence that indexed access was developed before printed copies offered more stable locations', letter: 'B' },
      ],
    },
    {
      kind: 'tfng',
      item: 'Alphabetical indexes first appeared in Europe only after movable-type printing arrived there.',
      answer: 'FALSE',
      evidence: 'Alphabetical indexes existed in European manuscript culture before movable-type printing arrived there.',
      explanation: 'B 段明确说欧洲活字印刷出现前的手抄本文化中已有字母索引，直接推翻题干的 only after；不能把印刷提高定位稳定性误认为印刷创造了索引，选 FALSE。',
    },
    {
      kind: 'tfng',
      item: 'References in an index remain valid automatically when the work is reset for a new edition.',
      answer: 'FALSE',
      evidence: 'When a work was reset, expanded or issued in a different format, its pagination could change. An index to one edition cannot automatically be transferred to another.',
      explanation: 'D 段说重新排版可能改变页码，而且明确否定索引可自动转用于另一版本；题干声称自动保持有效，选 FALSE。不是说所有新版都必然改变每一个位置。',
    },
    {
      kind: 'tfng',
      item: 'Commercial publishers usually paid indexers more than they paid copyists.',
      answer: 'NOT GIVEN',
      explanation: '全文没有提供索引编制者与抄写者的报酬或薪酬比较；劳动需要判断不等于报酬更高，选 NOT GIVEN。',
    },
    {
      kind: 'gapTyped',
      stem: 'The passage uses the term ______ for a tool that gathers occurrences of words.',
      answer: 'concordance',
      evidence: 'A concordance gathers occurrences of words, whereas a subject index organises references around concepts.',
    },
    {
      kind: 'gapTyped',
      stem: 'In Paragraph D, the word for the numbering of pages that could change when a work was reset is ______.',
      answer: 'pagination',
      evidence: 'When a work was reset, expanded or issued in a different format, its pagination could change. An index to one edition cannot automatically be transferred to another.',
      rubric: '一分：填原文单词 pagination（大小写不计）给分。题干限定页码编排，layout 指版面布局，不符合此义，不给分。',
    },
    {
      kind: 'short',
      marks: 2,
      stem: 'According to Paragraph E, why can searching for a subject word both miss a relevant passage and return an unhelpful one?',
      answer: 'A relevant passage may discuss the concept using other words. A passage containing the search word may contribute little to the subject being investigated.',
      evidence: 'A passage about the movement of water through fields might be relevant to irrigation without containing that particular term. Conversely, a word can appear in a passage which contributes little to the subject a reader is investigating.',
      rubric: '两分：解释「相关概念可以用别的措辞表达，因此没有检索词也可能相关」给 1 分；解释「出现检索词不代表实质讨论所查主题，因此命中也可能无用」再给 1 分。两种机制各自独立，合理同义改写均给分；只写「检索不完美」不给分。只照抄灌溉例子但没有说明用词与概念相关性的关系，不给对应分；不要求写技术性检索算法。',
    },
    {
      kind: 'short',
      marks: 2,
      stem: 'According to Paragraph H, what additional way of reading did indexes support, and why can an index itself be historical evidence about readers?',
      answer: 'Indexes enabled readers to consult selected material without following the whole sequence. The headings and level of detail record judgements about what readers were expected to seek.',
      evidence: 'It supported consultation alongside continuous reading and made dispersed material available for comparison. Its apparent impersonality should nevertheless be treated cautiously. Decisions about what deserves a heading, which terms count as equivalent and how much detail to provide reflect an interpretation of the work and its likely users.',
      rubric: '两分：说明「支持按需要查阅局部内容，而不限于从头连续阅读」给 1 分；说明「选哪些标题 / 详略等编辑决定反映当时对读者需求或阅读重点的理解」再给 1 分。合理同义改写均给分；第一点也接受说明索引让分散内容可以跨章节比较。只抄编辑决定的清单而未说明其反映读者需求，不给第二分；只说「索引很古老」不给分。',
    },
  ],
};

// 周三 —— 社区场馆商业冠名；GP 议论文；徽章主题：community。
const SPONSORSHIP = {
  key: 'original-w10-community-sponsorship',
  title: 'When a Community Hall Carries a Brand',
  passage: lettered([
    `A community hall can acquire a new floor, better equipment and a company name through the same agreement. To supporters, commercial sponsorship converts an available advertising opportunity into useful facilities; to critics, it allows a shared place to become an extension of somebody's marketing. Should community organisations accept such arrangements? A reasonable answer must distinguish acknowledging a contribution from surrendering control over participation. Sponsorship deserves consideration when it expands what a community can do, but its value cannot be established merely by comparing the sponsor's payment with the cost of the improvements displayed at the entrance.`,
    `The strongest case for sponsorship concerns access. Imagine a community association whose ceramics room needs an accessible workbench and a replacement kiln. Raising the full amount through session fees could exclude some participants, whereas a company contribution might allow fees to remain lower. The sponsor receives recognition, and members receive facilities which their existing resources could not provide. There is nothing inherently improper about that exchange. Refusing every commercial association can impose its own cost on people with limited budgets, particularly when an attractive commitment to independence is sustained by charges that some neighbours cannot afford.`,
    `The objection becomes stronger when recognition expands into control. Suppose the agreement requires every activity in the hall to promote the sponsor's products, or reserves desirable sessions for its customers. The premises may remain physically open while the terms of belonging have changed. A resident now enters partly as a potential customer rather than simply as a participant. This is a different transaction from placing a modest acknowledgement beside equipment. The central concern is whether an organisation has exchanged authority over its common activities for resources, including authority which individual members reasonably assumed would remain with the association.`,
    `Defenders can reply that community activities already depend on preferences expressed through membership fees, donations and the choices of organisers. Commercial money does not introduce influence into an otherwise influence-free setting. Granted, this objection exposes an unrealistic picture of complete independence. It does not establish that every source of influence deserves the same terms. A contribution towards an activity need not carry the right to decide who may join it. The appropriate response is to examine the authority attached to a payment, rather than to treat either the presence or the absence of a company logo as decisive.`,
    `Visibility matters because participants cannot evaluate conditions they cannot discover. An association considering sponsorship could publish the proposed recognition, any exclusive privileges and the duration of the arrangement before accepting it. Members could then distinguish a named workroom from an agreement restricting the activities held inside it. Disclosure alone, however, does not make an unacceptable condition acceptable. A clearly announced requirement to purchase a product before joining an ordinary community session would still turn commercial status into a condition of participation. Transparency enables scrutiny; it does not replace a substantive judgement about the purpose of the shared space.`,
    `A further difficulty concerns proportion. A small contribution might acquire extensive visibility if organisers value the immediate payment more carefully than the continuing use of the hall's identity. Conversely, insisting on almost invisible recognition may make a worthwhile agreement unattractive to the sponsor. Neither party needs to pretend that recognition has no value. They should specify its extent, including where a name appears and when the arrangement ends. A finite term allows a later review of whether the contribution and its conditions still serve the association, instead of allowing a temporary financial need to determine the place's identity indefinitely.`,
    `Consider two possible open days in the same improved hall. In one, residents can try the new equipment, the sponsor is thanked and joining an activity requires no purchase. In the other, equipment access depends on signing up as a customer. Both occasions could attract a large audience and produce cheerful photographs. Those visible outcomes would not reveal the difference in participation rights. The comparison shows why attendance alone is an inadequate measure of community benefit: a busy event can still redefine membership through a commercial condition. Evaluators should ask what residents are entitled to do as well as how many arrive.`,
    `Community organisations should consequently accept sponsorship only where its terms preserve their ability to organise activities for residents as residents. Public acknowledgement can be proportionate, explicit and temporary; control over ordinary participation should remain with the community association. This position accepts that money can widen access while requiring more than a promise of attractive improvements. Before renewal, members should review the privileges actually granted and the opportunities actually available. A company's name on a wall need not diminish a shared place, provided that the agreement leaves its users with more opportunities and leaves the sponsor without authority to make customer status the price of belonging.`,
  ]),
  questions: [
    {
      kind: 'matchingParagraphs',
      items: [
        { item: 'a comparison showing that similar visible success can conceal different conditions of participation', letter: 'G' },
        { item: 'a warning that making an agreement public does not establish that its conditions are appropriate', letter: 'E' },
        { item: 'an argument that rejecting commercial support can itself make participation less affordable', letter: 'B' },
      ],
    },
    {
      kind: 'tfng',
      item: 'The writer accepts that refusing all commercial support can impose costs on people with limited budgets.',
      answer: 'TRUE',
      evidence: 'Refusing every commercial association can impose its own cost on people with limited budgets, particularly when an attractive commitment to independence is sustained by charges that some neighbours cannot afford.',
      explanation: 'B 段承认拒绝一切商业支持可能靠提高收费维持独立，使预算有限者受影响；这是对支持方理由的认真让步，选 TRUE。',
    },
    {
      kind: 'tfng',
      item: 'Most members of the ceramics association would prefer a higher session fee to a company name on the room.',
      answer: 'NOT GIVEN',
      explanation: '陶艺房以 Imagine 引入，是论证设例；没有会员投票、偏好比例或多数人的取舍资料，选 NOT GIVEN。不能由作者的权衡推断会员意见。',
    },
    {
      kind: 'tfng',
      item: 'The passage argues that a sponsorship payment need not give its provider the right to determine who can participate.',
      answer: 'TRUE',
      evidence: 'A contribution towards an activity need not carry the right to decide who may join it.',
      explanation: 'D 段直接区分付款支持与决定参加者的权利，题干保留了 need not 的限定，不是否认所有赞助关系都带来影响，选 TRUE。',
    },
    {
      kind: 'gapTyped',
      stem: 'The writer says that ______ enables scrutiny but cannot substitute for judging the purpose of a shared space.',
      answer: 'transparency',
      evidence: 'Transparency enables scrutiny; it does not replace a substantive judgement about the purpose of the shared space.',
    },
    {
      kind: 'gapTyped',
      stem: 'In Paragraph F, a finite term creates an opportunity for a later ______ of the arrangement.',
      answer: 'review',
      evidence: 'A finite term allows a later review of whether the contribution and its conditions still serve the association, instead of allowing a temporary financial need to determine the place\'s identity indefinitely.',
    },
    {
      kind: 'short',
      marks: 2,
      stem: 'According to Paragraph D, what point does the writer concede to defenders of sponsorship, and what distinction preserves the argument for community control?',
      answer: 'Community activities are already influenced by funding and organisers, so complete independence is unrealistic. Providing money is distinct from acquiring the right to decide who may join.',
      evidence: 'Commercial money does not introduce influence into an otherwise influence-free setting. Granted, this objection exposes an unrealistic picture of complete independence. It does not establish that every source of influence deserves the same terms. A contribution towards an activity need not carry the right to decide who may join it.',
      rubric: '两分：说明让步「社区活动本来已受资助者或组织者影响，完全不受影响的独立并不现实」给 1 分；说明回应「提供资金不等于取得决定谁能参加的权利」再给 1 分。合理同义改写均给分，两点互不捆绑；只写「赞助能买设备」未回应本段让步，不给第一分；只照抄费用、捐款的清单但未说明既有影响，不给第一分；只写「作者仍支持社区」未说清权利区别，不给第二分。',
    },
    {
      kind: 'short',
      marks: 2,
      stem: 'According to Paragraph G, why is a large audience insufficient evidence of community benefit, and what should an evaluator examine instead?',
      answer: 'A crowded event can still require customer status for access, so numbers do not show whether participation is open. An evaluator should examine residents\' participation rights, such as whether equipment can be used without a purchase or customer registration.',
      evidence: 'The comparison shows why attendance alone is an inadequate measure of community benefit: a busy event can still redefine membership through a commercial condition. Evaluators should ask what residents are entitled to do as well as how many arrive.',
      rubric: '两分：解释「人多的活动仍可附带商业准入条件，因此人数不能证明参与开放 / 社区受益」给 1 分；提出评价对象「居民实际享有的参与或设备使用权，例如是否无须购买就能使用」再给 1 分。合理同义改写均给分；两点分别评分，不要求第一点同时提出办法。只抄两场开放日的表面对比但不说明对人数指标的含义，不给第一分；只写「检查照片或人数」不给第二分。',
    },
  ],
};

// 周四 —— 速度是否应计入学习成绩；GP 议论文；徽章主题：learning。
const SPEED = {
  key: 'original-w10-speed-and-assessment',
  title: 'When Speed Becomes a Grade',
  passage: lettered([
    `A student who solves a problem accurately after careful consideration may receive fewer marks than one who completes several routine problems before the bell. That result can be defensible, but only if speed belongs among the abilities being assessed. Should schools routinely reward rapid performance? The question concerns what a grade is allowed to mean. If a score is presented as evidence of understanding while being strongly determined by the quantity completed within a short interval, it may conceal an additional requirement. The case for timing is strongest when that requirement is explicit and relevant to the learning objective.`,
    `Supporters have a substantial educational argument. Fluent performance can free attention for a more complex task: a learner who readily calculates familiar quantities need not reconstruct every elementary procedure while examining a larger problem. A short exercise may therefore reveal something worth knowing about readiness. Moreover, a common deadline gives a class a manageable shared activity, preventing an assessment from expanding indefinitely. Neither advantage should be dismissed as mere administrative convenience. Education involves using knowledge as well as possessing it, and some uses require a response within an interval that the learner cannot simply extend at will.`,
    `The opposing case concerns interpretation. Imagine a geometry assessment intended to evaluate whether students can justify a construction. One learner checks an assumption carefully, while another applies a familiar pattern quickly without examining its limits. If the deadline rewards the second approach, the resulting score may favour completion over the reasoning named in the objective. This does not prove that slower work is better. It shows that a timing condition can select for an additional characteristic whose contribution must be justified. A grade cannot be interpreted responsibly by looking only at the topic printed above the questions.`,
    `The defence that everyone receives the same number of minutes is therefore incomplete. Uniform conditions make one feature of an assessment consistent; they do not establish that this feature measures the intended ability. Two rulers can be equally long without being suitable for weighing materials. Likewise, identical deadlines do not by themselves establish the validity of an inference about understanding. The relevant question is whether differences in completion time are part of the competence being claimed. Equal treatment of the clock cannot settle that question, although a clearly explained time condition may still be entirely appropriate for a particular objective.`,
    `Granted, removing all time constraints would create difficulties of its own. A teacher cannot indefinitely postpone feedback while waiting for every possible revision, and an open-ended task may require supervision that a school cannot provide. Yet there is a distinction between using a deadline to organise work and using speed to rank the quality of understanding. An assessment can have a practical finishing point without awarding extra credit for finishing substantially earlier. Where some work remains unfinished, a teacher can distinguish unattempted questions from incorrect answers when describing the evidence, rather than treating every missing response as the same kind of gap.`,
    `A more informative arrangement would separate measures that a single score tends to combine. Consider an exercise assessing accurate calculations and the time taken to complete them. Reporting accuracy and completion time separately would show whether a learner's immediate need concerns errors or fluency. This is a proposed interpretation of the results, not evidence that a particular reporting system improves learning. It also requires appropriate tasks: recording two numbers does not rescue an exercise whose questions fail to represent the intended skill. Better reporting makes the claim more inspectable, but it cannot supply missing evidence about what was actually assessed.`,
    `Students also need to know which kind of performance an activity invites. A routine fluency check can legitimately encourage efficient procedures, whereas an unfamiliar investigation may require time for reconsideration. If both are introduced simply as tests of being good at mathematics, learners receive little guidance about why checking is rewarded in one setting and rapid production in another. Clear purposes allow them to practise the relevant capability without treating hesitation as a general measure of competence. The educational value lies in making the relationship between task and judgement visible, rather than praising either speed or deliberation regardless of context.`,
    `Schools should consequently include speed in a grade when timely performance is an explicit, defensible part of the objective, while gathering other evidence when the aim is considered explanation. Practical deadlines can remain, provided that conclusions drawn from unfinished work are appropriately limited. Where both fluency and accuracy matter, separate reporting can preserve information which an overall rank would obscure. This approach neither promises unlimited time nor makes rapid work automatically suspect. It asks teachers to defend the inference attached to a score: what has this learner demonstrated, under which conditions, and how far beyond those conditions can the conclusion reasonably travel?`,
  ]),
  questions: [
    {
      kind: 'matchingParagraphs',
      items: [
        { item: 'a proposed way of reporting results that distinguishes different immediate learning needs', letter: 'F' },
        { item: 'a reason why rapid performance of basic procedures may help with more complex work', letter: 'B' },
        { item: 'an analogy challenging the claim that identical conditions guarantee an appropriate measurement', letter: 'D' },
      ],
    },
    {
      kind: 'tfng',
      item: 'In the geometry example, most students chose to check assumptions before applying a familiar pattern.',
      answer: 'NOT GIVEN',
      explanation: 'C 段设想两种作答方式，没有提供真实班级数据，更没有哪一种占多数的信息；两个人的对照不能推成大多数学生的选择，选 NOT GIVEN。',
    },
    {
      kind: 'tfng',
      item: 'Schools using separate accuracy and time reports have recorded higher learning gains than schools using a single score.',
      answer: 'NOT GIVEN',
      explanation: 'F 段明确限定自己提出的是结果解读办法，并未提供某种报告制度提升学习的证据；这不等于已有证据证明它无效，也不能推出校际成效比较，选 NOT GIVEN。',
    },
    {
      kind: 'tfng',
      item: 'The writer treats a practical finishing point as inseparable from awarding additional marks for earlier completion.',
      answer: 'FALSE',
      evidence: 'An assessment can have a practical finishing point without awarding extra credit for finishing substantially earlier.',
      explanation: 'E 段直接说可以有实际截止点而不奖励明显提前完成，推翻题干所说的不可分；管理时间与把速度计分是两件可分的事，选 FALSE。',
    },
    {
      kind: 'gapTyped',
      stem: 'Paragraph D identifies the ______ of an inference about understanding as something identical deadlines do not establish.',
      answer: 'validity',
      evidence: 'Likewise, identical deadlines do not by themselves establish the validity of an inference about understanding.',
    },
    {
      kind: 'gapTyped',
      stem: 'In Paragraph F, a learner whose calculations are correct but slow may need to develop ______ rather than correct errors.',
      answer: 'fluency',
      evidence: 'Reporting accuracy and completion time separately would show whether a learner\'s immediate need concerns errors or fluency.',
    },
    {
      kind: 'short',
      marks: 2,
      stem: 'According to Paragraph D, what does a common deadline establish, and why is that insufficient to justify interpreting a score as evidence of understanding?',
      answer: 'It establishes consistency in the time available. It does not show that completion speed belongs to the intended competence, so the meaning of the score still requires justification.',
      evidence: 'Uniform conditions make one feature of an assessment consistent; they do not establish that this feature measures the intended ability. Two rulers can be equally long without being suitable for weighing materials. Likewise, identical deadlines do not by themselves establish the validity of an inference about understanding. The relevant question is whether differences in completion time are part of the competence being claimed.',
      rubric: '两分：写出「让可用时间这一条件一致」给 1 分；解释「条件一致不证明速度属于要测的理解能力 / 不证明分数能有效代表该能力」再给 1 分。合理同义改写均给分，两点独立。只抄尺子一样长却不能称重的比喻，不说明它对应测量效度的论点，不给第二分；只写「这样公平」但未指出何种条件一致，不给第一分；声称共同截止必然无效，不给第二分。',
    },
    {
      kind: 'short',
      marks: 2,
      stem: 'According to Paragraph F, why would separate accuracy and time reports be useful, and what limitation would remain even after separating them?',
      answer: 'They would distinguish a need to address errors from a need to improve fluency. They would not compensate for questions that fail to represent the skill the assessment claims to measure.',
      evidence: 'Reporting accuracy and completion time separately would show whether a learner\'s immediate need concerns errors or fluency. This is a proposed interpretation of the results, not evidence that a particular reporting system improves learning. It also requires appropriate tasks: recording two numbers does not rescue an exercise whose questions fail to represent the intended skill.',
      rubric: '两分：说明「可分辨当前需要改正错误还是提高熟练度」给 1 分；说明「若题目没有代表目标技能，分开报告仍不能补救」再给 1 分。合理同义改写均给分，各点单独可得；只写「能看到两个数字」未说明诊断用途，不给第一分；只照抄题目设置但没说仍须匹配目标技能，不给第二分；声称原文已证明提高成绩，不给对应分。',
    },
  ],
};

// 周五 —— 博物馆复制品的展示价值；GP 议论文；徽章主题：culture。
const REPLICAS = {
  key: 'original-w10-museum-replicas',
  title: 'The Place of the Replica',
  passage: lettered([
    `A visitor enters a museum expecting an encounter with something that has travelled through time. Discovering that a displayed object is a replica can therefore feel like a reduction in what the visit offers. Yet a reproduction may reveal a feature which an original, preserved behind glass, leaves difficult to understand. Should museums give replicas a substantial place in their galleries? The answer depends on what is being represented and what visitors are invited to learn. Replicas can possess explanatory value of their own, provided that this value is distinguished from the material evidence carried by the objects they reproduce.`,
    `The strongest argument for originals concerns evidence rather than prestige. An old ceramic vessel can preserve traces of manufacture and use in its surface, material and repairs. A newly made copy, even if its outline is convincing, has not undergone the same processes. Researchers examining the original may therefore ask questions which the replica cannot answer. For visitors, too, encountering surviving material can establish a connection with past activity that a newly produced likeness does not provide. Advocates of reproductions should acknowledge this difference instead of treating attachment to original objects as merely a preference for expensive or celebrated things.`,
    `Nevertheless, preserving material and explaining activity are different tasks. Consider a working model of a loom which visitors can operate under guidance. The movement of its parts could make the relationship between threads more intelligible than a stationary original that cannot be handled. In this example, the model would be constructed to demonstrate a process, not to provide ancient material for analysis. Its usefulness comes from the relationship it makes observable. Comparing it with the original only in terms of age would overlook the educational purpose for which the model was made and by which its accuracy should be judged.`,
    `Critics may respond that an entertaining demonstration can encourage visitors to substitute immediate experience for careful interpretation. A smooth modern mechanism might make a demanding historical task appear effortless, particularly if differences in materials or working conditions are left unexplained. This objection is substantial. A working replica does not automatically reproduce the experience of the people who used an earlier object. Its maker has selected which properties to reconstruct and which to simplify. Museums should identify those selections, allowing visitors to distinguish what the demonstration establishes from what remains outside it. Explanation should accompany participation rather than be displaced by it.`,
    `An enlarged model makes this principle especially clear. Magnification can expose details that are hard to see on a small object, but it changes the relationship between that object and the person examining it. The altered scale is useful precisely because it is an alteration. A display can explain both the feature being revealed and the property that has been changed to reveal it. This is not a concession that makes the model educationally worthless. It shows that accuracy is relative to a stated purpose: representing the shape of a small component is different from representing its original size or weight.`,
    `Labels consequently need to do more than attach the word replica to an otherwise unexplained object. They should identify what has been reproduced, the evidence on which the reconstruction depends and any important uncertainty. If a surface colour is conjectural, presenting it as a confident restoration would obscure the boundary between surviving evidence and interpretation. Conversely, a clearly explained uncertainty can invite visitors to consider how historical knowledge is assembled. A reproduction then becomes an opportunity to examine a reasoned proposal, rather than a device for making incomplete knowledge disappear beneath an apparently finished and authoritative surface.`,
    `There remains a practical objection about resources. Gallery space, maintenance and interpretation all have costs, and an elaborate model can occupy room that might otherwise display original material. While it is true that participation has value, novelty alone cannot justify that displacement. A museum should ask what understanding the model adds which its existing objects and explanations do not already provide. Sometimes a diagram would answer the question adequately; elsewhere, movement or handling may be essential to the explanation. The case must be made for the particular reproduction, rather than inferred from a general enthusiasm for interactive experiences.`,
    `Museums should therefore use replicas where a specified explanatory gain warrants the space and resources required, while preserving the distinct evidential status of originals. A useful gallery might place a working model near surviving material and explain how their contributions differ. Neither needs to pretend to perform the other's task. The original can support enquiries into material history; the model can expose a relationship that preservation prevents visitors from testing directly. Under these conditions, a replica need not be a disappointing substitute. It can make the grounds and limits of an interpretation more visible, enlarging what a museum encounter allows its visitors to understand.`,
  ]),
  questions: [
    {
      kind: 'matchingParagraphs',
      items: [
        { item: 'an argument that the value of a reproduction must justify what it displaces', letter: 'G' },
        { item: 'an example showing that a deliberate departure from an original property can help reveal another feature', letter: 'E' },
        { item: 'a concession that a demonstration may misrepresent historical experience unless its selections are explained', letter: 'D' },
      ],
    },
    {
      kind: 'tfng',
      item: 'The writer argues that operating a working replica automatically recreates the experience of earlier users.',
      answer: 'FALSE',
      evidence: 'A working replica does not automatically reproduce the experience of the people who used an earlier object.',
      explanation: 'D 段直接否定自动还原使用体验，并解释制作者会选择重建哪些性质、简化哪些性质；可操作不等于完整重现历史体验，选 FALSE。',
    },
    {
      kind: 'tfng',
      item: 'The writer accepts that a model can accurately represent shape without preserving an object\'s original size.',
      answer: 'TRUE',
      evidence: 'It shows that accuracy is relative to a stated purpose: representing the shape of a small component is different from representing its original size or weight.',
      explanation: 'E 段说明放大虽改变尺度，仍可准确呈现形状；准确性须相对于声明的目的判断，不是要求每个性质都相同，选 TRUE。',
    },
    {
      kind: 'tfng',
      item: 'The passage accepts that making an uncertainty explicit can help visitors examine how knowledge about the past is constructed.',
      answer: 'TRUE',
      evidence: 'Conversely, a clearly explained uncertainty can invite visitors to consider how historical knowledge is assembled.',
      explanation: 'F 段直接肯定公开说明不确定性可引导观众理解历史知识的形成；并非必须把推测表现成确定事实才有教学价值，选 TRUE。',
    },
    {
      kind: 'gapTyped',
      stem: 'Paragraph E uses ______ to name the process that makes small details easier to see by increasing their apparent scale.',
      answer: 'magnification',
      evidence: 'Magnification can expose details that are hard to see on a small object, but it changes the relationship between that object and the person examining it.',
    },
    {
      kind: 'gapTyped',
      stem: 'Paragraph F describes a proposed surface colour based on uncertain reconstruction as ______.',
      answer: 'conjectural',
      evidence: 'If a surface colour is conjectural, presenting it as a confident restoration would obscure the boundary between surviving evidence and interpretation.',
    },
    {
      kind: 'short',
      marks: 2,
      stem: 'According to Paragraph C, which claim does the loom example support, and what criterion should determine the model\'s accuracy?',
      answer: 'It supports the claim that a reproduction can explain a process which a stationary original cannot demonstrate through handling. Its accuracy should be judged by how faithfully it shows the relationship or process it was designed to explain.',
      evidence: 'The movement of its parts could make the relationship between threads more intelligible than a stationary original that cannot be handled. In this example, the model would be constructed to demonstrate a process, not to provide ancient material for analysis. Its usefulness comes from the relationship it makes observable. Comparing it with the original only in terms of age would overlook the educational purpose for which the model was made and by which its accuracy should be judged.',
      rubric: '两分：概括论点「复制品可通过操作说明原件无法直接演示的过程，因此有解释价值」给 1 分；指出准确性标准「是否忠实呈现声明要解释的过程 / 线之间的关系，而非材料是否古老」再给 1 分。合理同义改写均给分，两点分别评分。只照抄线和零件会移动，没有说明例子支持复制品的解释功能，不给第一分；只写「好玩 / 受欢迎」不给分；用年代老或价格高作为准确性标准，不给第二分。',
    },
    {
      kind: 'short',
      marks: 2,
      stem: 'According to Paragraph G, why is novelty insufficient to justify an elaborate model, and what question should a museum ask before allocating space to it?',
      answer: 'The model uses resources or space that could serve other displays, so being new or interactive alone does not justify the displacement. The museum should ask what additional understanding the model provides beyond its existing objects and explanations.',
      evidence: 'Gallery space, maintenance and interpretation all have costs, and an elaborate model can occupy room that might otherwise display original material. While it is true that participation has value, novelty alone cannot justify that displacement. A museum should ask what understanding the model adds which its existing objects and explanations do not already provide.',
      rubric: '两分：解释「模型占用本可用于原件展示等用途的空间或资源，有机会成本」给 1 分（空间或维护等资源任一即可，不要求合并两层）；提出判断问题「相比现有物品和说明，增加了什么理解」再给 1 分。合理同义改写均给分；只说模型贵但未说明资源或空间的取舍，不给第一分；只照抄图解与运动的例子但未说明额外解释收益，不给第二分；只问是否新奇或互动，不给第二分。',
    },
  ],
};

const SPECS = [INDEX, SPONSORSHIP, SPEED, REPLICAS];

module.exports = {
  LEVEL,
  SPECS,
  DAYS: DATES.slice(0, SPECS.length).map((date, i) => buildAuthoredDay(SPECS[i], date)),
};
