/**
 * 第十一周 —— ielts_authentic（雅思真题难度）档，五天全原创，按日期排列。
 * 沿用第十周：八段 Paragraph A–H；3 道段落信息配对、3 道判断、
 * 2 道原文单词填空、2 道各两分简答，共 10 题、12 分。目标每篇 750–800 词。
 *
 * 11-09 technology：A Screen That Holds Its Image（技术说明文，非 GP）。
 *   选题 / 梗概：从反射光、带电颜料移动与图像保持，解释电泳电子纸的用途及更新限制。
 *   结尾：保留的画面不证明信息仍然新鲜，设备设计必须处理显示与更新状态的区别。
 *   事实把握高：只讨论典型黑白电泳结构，不概括全部电子纸；带电粒子在电场中移动、
 *   双稳态可在不持续驱动时保留图像、前置照明及控制电路仍可耗电。刷新方式依实现而异，
 *   不写统一刷新率、电池寿命、特定产品或颜色技术；标签失联是明确假设，不是真实故障报道。
 *
 * 11-10 psychology：The Explanation We Thought We Had（心理学说明文，非 GP）。
 *   选题 / 梗概：真实、公认的解释深度错觉；区分熟悉用途、辨认部件和说明因果机制。
 *   结尾：解释失败可以让自我评价更准确，而不等于把原先掌握的知识全部丢掉。
 *   事实把握高：经典研究范式先评价理解、尝试详细解释、再评价，参与者往往下调自评；
 *   不写作者、年份、人数、效应量或所有任务均有效。拉链、脚踏机构及学习活动均为说明设例，
 *   不声称它们就是某项已发表研究的具体实验材料；机制说明用可能性限定，不宣称单一成因已定。
 *
 * 11-11 culture：When Silence Is Part of the Music（GP 议论文）。
 *   选题 / 梗概：多乐章演奏中应否允许段间掌声；认真处理连续聆听与即时回应两方的理由。
 *   结局：由演出目的决定惯例，并提前向听众说明；允许不同节目有不同约定。
 *   事实把握高：作品可有多个乐章，段间停顿不必代表整曲结束；其余为明确设想的演出安排，
 *   不追溯礼仪起源、不写音乐家或观众调查，不把一种惯例当成所有音乐文化的共同规则。
 *
 * 11-12 learning：What Subject Boundaries Are For（GP 议论文）。
 *   选题 / 梗概：学习是否应全面跨越科目边界；比较综合任务的联系价值与学科方法的严谨性。
 *   结局：用确实需要不同方法的任务连接学科，保留必要的专项学习及各自的证据标准。
 *   事实把握高：面积、容积及材料选择的基本逻辑；包装设计、教学安排与成果检查全部设例，
 *   不引用成效研究，不声称某种课程制度必然提高成绩；不讨论考试限时、共读选书或画图网格。
 *
 * 11-13 community：Agreement Without Identical Preferences（GP 议论文）。
 *   选题 / 梗概：社区项目是否每项决定都应协商一致；权衡执行意愿、参与成本和未表达的异议。
 *   结局：对承诺共同劳动的决定认真协商，并事先约定日常小事的授权范围及重新讨论条件。
 *   事实把握高：均为程序与责任的逻辑分析，工具柜、会务及暂行安排为假设，不是社会调查；
 *   不写候选人选举、政府政策或政治立场，也不写互助交换、赞助或统计参加人数的旧议题。
 *
 * 事实按已有知识核对，依 brief 不联网；不把设例当真实研究。全文无人名，避免复用九、十周人物。
 * 查重：完整阅读 pack-titles-1106.txt 和 read-titles-1106.txt；完整读第十周同档及第九周同档文件头。
 * 检索旧内容包与 test-fixtures 的 electrophore / electronic paper / e-paper / e-ink /
 * explanatory depth / illusion of understanding / interdisciplinary / consensus / unanim 等词；
 * 另查 applause / clapping，并核读近邻的第七周 Ninety-Six Bars、The Deciding Vote 与
 * 第八周 A World Without Left and Right 的相关正文，以及第九周各档选题说明。
 * 相近处：Ninety-Six Bars 是等待演出入拍的故事，本周文化篇是观演惯例的论证；
 * The Deciding Vote 是候选人选择故事，本周社区篇研究接受方案与承担执行责任的关系。
 * 电子纸不是手套触屏或电池化学；心理篇不是记忆重构、非注意盲视、选择或检索练习；
 * 学习篇不是第十周速度计分或画画网格。已避开旧文翻译与互助题材，不重复其转折及结局。
 * 五篇分别采用技术机制与边界、心理研究范式、观演礼仪权衡、学科方法比较、共同责任分析。
 *
 * 判断题：周一 F/F/NG；周二 T/NG/T；周三 NG/F/F；周四 NG/NG/T；周五 F/T/T。
 * 全周 TRUE 5、FALSE 5、NOT GIVEN 5；每天恰好两类，未提及不固定在末题。
 * 评分：两分题逐分独立，接受合理同义表达；照抄例子但没回答因果或论证层，不给对应分。
 * 校园安全及朗读：逐句复核正文、题干、答案、解析和 rubric；正文只用可正常朗读的文字标点。
 */

'use strict';

const { buildAuthoredDay, lettered } = require('../authored');
const { DATES } = require('./dates');

const LEVEL = 'ielts_authentic';

// 周一 —— 电泳电子纸的图像保持与更新边界；徽章主题：technology。
const PAPER_DISPLAY = {
  key: 'original-w11-persistent-screen',
  title: 'A Screen That Holds Its Image',
  passage: lettered([
    `An electronic label can continue displaying a price after the system responsible for changing it has stopped communicating. The persistence seems surprising only if a screen is imagined as a surface that must continually produce light. Electronic paper offers another arrangement, in which a visible image can be maintained without continuously driving the display. Its resemblance to printed paper is therefore more than a matter of appearance. Understanding that resemblance, and where it becomes misleading, requires separating the energy used to change an image from the energy used to illuminate it and operate the surrounding device.`,
    `In a common black and white electrophoretic design, differently charged pigment particles are suspended in fluid inside tiny compartments. An applied electric field moves the particles, bringing a selected colour towards the viewing surface. The visible pattern depends on which particles are presented there. Unlike an ordinary printed page, the arrangement can be rewritten electronically; unlike a light emitting display, it can be read using light reflected from its surface. The term electrophoresis describes the movement of charged particles through a fluid under an electric field. It names the operating principle rather than a particular brand or reading device.`,
    `The important additional property is bistability: the display can retain a selected visible state without a continuous electrical drive. Once a page has been formed, the pigment arrangement does not need to be repeatedly recreated simply because the reader remains on that page. This can reduce the display energy required for material that changes infrequently. It does not follow that the complete device consumes no power between updates. A processor, a wireless connection or an optional front light may still require electricity. Image retention describes the behaviour of the display, not the energy budget of every component attached to it.`,
    `Reflective operation also determines the relationship between the page and its surroundings. In adequate ambient light, illumination can come from the room or the sky rather than from the device. In darkness, however, a reflective surface cannot manufacture the light needed to read it. Some reading devices therefore provide a front light, directing illumination across the display surface. That addition does not turn the pigment layer into a light emitting screen. It supplies illumination from a separate component within the same enclosure, much as a reading lamp makes a printed page usable without changing how its ink forms letters. The distinction matters when comparing the power consumed under different reading conditions.`,
    `Changing the picture introduces a different set of compromises. Pigment particles must move, and the electrical sequence used to place them affects the transition between images. In some implementations, a thorough refresh briefly passes through conspicuous intermediate states. Faster partial updates may leave faint remnants of earlier content, commonly called ghosting, which later refreshing can reduce. These behaviours vary with the display and its control system. They help explain why a technology well suited to a stable page is not automatically the most appropriate choice for rapidly changing animation, even when both uses require equally legible individual images.`,
    `Consider a shelf label that receives a new price occasionally but displays it throughout the day. Retaining a stable image is useful because the information spends much longer being shown than being rewritten. Now consider a screen presenting continuous movement. Its value depends on frequent transitions, so the cost and quality of those transitions become central. Neither example establishes that one display technology is universally superior. The relevant comparison concerns the pattern of work: how often the image changes, what happens during each transition and which other components must remain active while the picture is being displayed.`,
    `Persistence nevertheless creates a problem of interpretation. Suppose a label loses its connection immediately after receiving an update. Its readable image would not, by itself, demonstrate that the connection still works. Nor would an unchanged display distinguish a current price from an earlier one which should have been replaced. A timestamp could help a viewer judge when information was supplied, although it would need a meaningful relation to the expected update schedule. A fresh appearance is not evidence of fresh communication. Designers must decide how an interruption becomes apparent when disappearance of the picture cannot be relied upon to reveal it.`,
    `Electronic paper consequently shifts attention from continuous illumination towards controlled change. Its advantages emerge where a persistent, reflective image matches the information being presented, while its limitations become visible when rapid movement or uncertain updates matter more. The distinction reaches beyond reading devices: retaining an output and maintaining the process behind that output are separate achievements. A display can perform the first while the second is unavailable. Judging the technology responsibly therefore involves asking both how efficiently it preserves a page and what evidence a viewer receives that the page still represents the state it is intended to describe.`,
  ]),
  questions: [
    {
      kind: 'matchingParagraphs',
      items: [
        { item: 'a warning that a readable output cannot establish whether its updating connection remains available', letter: 'G' },
        { item: 'examples of components that may still consume power while the displayed image remains unchanged', letter: 'C' },
        { item: 'an explanation linking incomplete image changes with visible traces of previous content', letter: 'E' },
      ],
    },
    {
      kind: 'tfng',
      item: 'The operating principle described in Paragraph B requires the pigment layer to produce the light by which it is read.',
      answer: 'FALSE',
      evidence: 'unlike a light emitting display, it can be read using light reflected from its surface.',
      explanation: 'B 段说明靠表面反射的光阅读，D 段也区分前置照明与颜料层自身发光；题干把反射改成必须由颜料层发光，选 FALSE。',
    },
    {
      kind: 'tfng',
      item: 'A device whose display retains an image must consume no electricity until that image changes.',
      answer: 'FALSE',
      evidence: 'It does not follow that the complete device consumes no power between updates. A processor, a wireless connection or an optional front light may still require electricity.',
      explanation: 'C 段直接否定从图像保持推出整机零耗电，其他部件仍可能用电；display 的性质不能无条件扩展到整台设备，选 FALSE。',
    },
    {
      kind: 'tfng',
      item: 'Replacing paper shelf labels with electronic ones usually recovers the purchase cost within a year.',
      answer: 'NOT GIVEN',
      explanation: 'F 段讨论显示与更新的工作模式，没有购买成本、节省金额或回本时长；能保留图像不等于已知经济回报，选 NOT GIVEN。',
    },
    {
      kind: 'gapTyped',
      stem: 'Paragraph B calls the electrically induced movement of suspended charged particles ______.',
      answer: 'electrophoresis',
      evidence: 'The term electrophoresis describes the movement of charged particles through a fluid under an electric field.',
    },
    {
      kind: 'gapTyped',
      stem: 'Faint remains of earlier content after certain updates are described in Paragraph E as ______.',
      answer: 'ghosting',
      evidence: 'Faster partial updates may leave faint remnants of earlier content, commonly called ghosting, which later refreshing can reduce.',
    },
    {
      kind: 'short',
      marks: 2,
      stem: 'Why does bistability offer an energy advantage for a stationary page, and why is that advantage insufficient to establish the whole device\'s power consumption in Paragraph C?',
      answer: 'The display need not continually recreate the pigment arrangement to keep the page visible. Other components, such as the connection or front light, may still use electricity.',
      evidence: 'Once a page has been formed, the pigment arrangement does not need to be repeatedly recreated simply because the reader remains on that page. This can reduce the display energy required for material that changes infrequently. It does not follow that the complete device consumes no power between updates. A processor, a wireless connection or an optional front light may still require electricity.',
      rubric: '两分：说明「保持静止页面无须不断重新驱动颜料排列，因此减少显示耗电」给 1 分；指出「其他部件仍可能耗电」再给 1 分，举处理器、连接或前灯任一即可。两点独立，合理同义改写均给分。只照抄部件名称而未说明其仍可能用电，不给第二分；只说省电但未说明保持图像无须持续驱动，不给第一分；声称整机零耗电不给第二分。',
    },
    {
      kind: 'short',
      marks: 2,
      stem: 'In Paragraph G, why can an electronic label\'s continued readability be misleading, and what condition would make a timestamp useful?',
      answer: 'The image can survive a lost connection, so readability does not establish that updates are still arriving. A timestamp must be interpreted against how often an update is expected.',
      evidence: 'Its readable image would not, by itself, demonstrate that the connection still works. Nor would an unchanged display distinguish a current price from an earlier one which should have been replaced. A timestamp could help a viewer judge when information was supplied, although it would need a meaningful relation to the expected update schedule.',
      rubric: '两分：解释「画面仍可读并不能证明连接或更新仍正常，旧价也能保留」给 1 分；说明「须结合预期更新频率或时间安排解读时间戳」再给 1 分。合理同义改写均给分，两点分别评分。只照抄假设中的失联事件而未说可读与新鲜度不等同，不给第一分；只说加时间戳，没有预期更新时间的条件，不给第二分。',
    },
  ],
};

// 周二 —— 解释深度错觉及自我评价的校准；徽章主题：psychology。
const EXPLANATION = {
  key: 'original-w11-explanatory-depth',
  title: 'The Explanation We Thought We Had',
  passage: lettered([
    `Knowing what a familiar object does can feel remarkably like knowing how it works. A person may use a zip every morning, predict which way the slider should move and recognise a damaged fastener, yet struggle to explain how its parts interlock. The difficulty becomes visible only when a detailed causal account is requested. Psychologists call the gap between an initially confident sense of understanding and the understanding revealed by explanation the illusion of explanatory depth. The phenomenon concerns the assessment of knowledge, rather than the surprising claim that ordinary users should know every detail of the objects around them.`,
    `In a classic research procedure, participants first rate how well they understand familiar mechanisms. They are then asked to explain those mechanisms in detail and subsequently rate their understanding again. Ratings often decline after the attempt at explanation. This sequence matters because the participants have not simply been informed that their answers are inadequate. Producing an account can make omissions apparent to the person producing it. The contrast is between an earlier estimate and a later estimate informed by an attempted performance, not merely between people with extensive technical training and people who have never encountered the object.`,
    `One plausible contributor is the difference between recognising a successful outcome and representing the processes that generate it. Repeated use supplies abundant evidence that an action works: move the slider and the opening closes. That reliable association can support practical competence without supplying the intermediate relationships needed for a mechanical explanation. Familiarity is therefore informative, but about a narrower achievement than it may seem to certify. A user can correctly anticipate an outcome while having little basis for describing the hidden sequence. Confusing these achievements allows genuine knowledge at one level to support excessive confidence at another.`,
    `An explanation can also conceal its own gaps when the vocabulary is more complete than the reasoning. Saying that a mechanism works because its components are connected may sound satisfactory until someone asks what that connection enables. Naming the parts of a pedal mechanism, for example, does not establish how movement is transmitted between them. A labelled diagram can help organise an account, but labels alone cannot supply the missing causal links. The demand for detail changes the standard of adequacy: an answer must connect successive stages, rather than merely redescribe the final result in more technical sounding language.`,
    `The finding should nevertheless be interpreted within limits. A fall in confidence does not demonstrate that a participant knows nothing, and an incomplete explanation does not erase an ability to use the mechanism effectively. Nor does the phenomenon imply that everyone overestimates every kind of knowledge. Estimates depend on the task, the requested level of detail and the information available when a judgement is made. An expert can also acknowledge uncertainty without being less knowledgeable than a confident beginner. Confidence and understanding are related judgements, but their relationship cannot be established by treating certainty itself as a direct measure of expertise.`,
    `These distinctions suggest a careful educational application. Imagine learners being asked to explain a familiar classroom device before consulting a reference account. The first attempt could help them identify the precise transition they cannot yet explain. Reading would then answer a question they have actually encountered, rather than merely present a sequence which seems familiar. However, the activity would be poorly designed if students were expected to produce details they had never had an opportunity to learn and were then judged as generally incapable. Exposing a gap is useful when it provides direction for further enquiry, not when it becomes a label attached to the learner.`,
    `There is a corresponding responsibility for the person evaluating an explanation. A listener should ask whether the account identifies relevant relationships, while allowing more than one clear way of expressing them. Requiring specialist terminology which the task does not need may confuse verbal polish with causal understanding. Conversely, accepting a fluent description of the outcome can leave the central gap unexamined. A useful follow-up question asks what enables the next stage, or what would change if a particular connection were absent. Such questions inspect the structure of the explanation instead of rewarding either elaborate vocabulary or confidence in delivery.`,
    `The most productive result may therefore be a better calibrated question rather than an immediately complete answer. Someone who begins by claiming to understand a device may finish by distinguishing what they can operate from what they can explain. That revision is a gain in self-knowledge, even if technical knowledge has not yet increased. It makes further learning more selective because the missing relationship has become identifiable. The illusion of explanatory depth reminds us that confidence can precede inspection. Asking for an explanation creates an occasion to inspect it, provided that the resulting uncertainty is treated as information rather than as proof of general incompetence.`,
  ]),
  questions: [
    {
      kind: 'matchingParagraphs',
      items: [
        { item: 'a distinction between possessing names for components and explaining the relationships among them', letter: 'D' },
        { item: 'a research sequence in which attempting a task can revise an earlier judgement about knowledge', letter: 'B' },
        { item: 'a warning against labelling learners incapable for failing to explain details they have never had a chance to learn', letter: 'F' },
      ],
    },
    {
      kind: 'tfng',
      item: 'The passage allows that effective practical use and an inadequate account of the mechanism can occur in the same person.',
      answer: 'TRUE',
      evidence: 'an incomplete explanation does not erase an ability to use the mechanism effectively.',
      explanation: 'E 段明确保留实际操作能力，A、C 段也区分会用与会解释；题干只是说两者可同时出现，没有断言每个人都如此，选 TRUE。',
    },
    {
      kind: 'tfng',
      item: 'Participants who used a mechanism daily reduced their understanding ratings more than participants who used it weekly.',
      answer: 'NOT GIVEN',
      explanation: '正文提到熟悉和反复使用可能提供何种知识，但没有按每日或每周使用分组，也没有两组自评分下降幅度的比较，选 NOT GIVEN。',
    },
    {
      kind: 'tfng',
      item: 'A revised estimate of understanding can improve self-knowledge before additional technical knowledge has been acquired.',
      answer: 'TRUE',
      evidence: 'That revision is a gain in self-knowledge, even if technical knowledge has not yet increased.',
      explanation: 'H 段将自我评价的改善与技术知识增加分开，准确知道缺在哪里本身已有价值，选 TRUE。',
    },
    {
      kind: 'gapTyped',
      stem: 'Confusing practical success with causal understanding can lead to excessive ______, according to Paragraph C.',
      answer: 'confidence',
      evidence: 'Confusing these achievements allows genuine knowledge at one level to support excessive confidence at another.',
      rubric: '一分：填原文单词 confidence（大小写不计）给分，表示把实际操作成功混同于因果理解后产生的过度自信。use 和 familiarity 指使用或熟悉程度，不符合此处所问的结果，不给分；同义词不符合原文单词要求，不给分。',
    },
    {
      kind: 'gapTyped',
      stem: 'Paragraph D says that labels cannot replace missing causal ______ within an explanation.',
      answer: 'links',
      evidence: 'A labelled diagram can help organise an account, but labels alone cannot supply the missing causal links.',
    },
    {
      kind: 'short',
      marks: 2,
      stem: 'What does the before-and-after rating sequence in Paragraph B help distinguish, and how can attempting an explanation produce the later estimate?',
      answer: 'It distinguishes a prior estimate of understanding from one informed by an attempted explanation. Producing the account can reveal its omissions to the participant.',
      evidence: 'Producing an account can make omissions apparent to the person producing it. The contrast is between an earlier estimate and a later estimate informed by an attempted performance, not merely between people with extensive technical training and people who have never encountered the object.',
      rubric: '两分：说清「比较同一作答者解释前的估计与尝试解释后的估计」给 1 分；说明「尝试组织解释使本人发现遗漏」再给 1 分。两点独立，合理同义改写均给分。只照抄评分步骤而未说明比较的是自我评价的前后变化，不给第一分；只说因为研究者告诉他答错，或只说分数下降而未解释自我发现缺口，不给第二分。',
    },
    {
      kind: 'short',
      marks: 2,
      stem: 'Why does Paragraph G reject vocabulary alone as a sufficient evaluation criterion, and what kind of follow-up would inspect causal understanding instead?',
      answer: 'Specialist vocabulary may measure verbal polish rather than the relevant causal relationships. Asking what enables a next stage or how an absent connection would affect it tests those relationships.',
      evidence: 'Requiring specialist terminology which the task does not need may confuse verbal polish with causal understanding. Conversely, accepting a fluent description of the outcome can leave the central gap unexamined. A useful follow-up question asks what enables the next stage, or what would change if a particular connection were absent.',
      rubric: '两分：解释「术语丰富或表达漂亮不保证理解因果关系」给 1 分；提出「追问下一步为何发生，或缺少某个连接会怎样」再给 1 分，两种追问任一即可。两点独立，接受合理同义改写。只照抄术语或结果描述但没指出它们与因果理解的区别，不给第一分；只要求多用术语或表现自信，不给第二分。',
    },
  ],
};

// 周三 —— 多乐章演出的段间掌声；GP 议论文；徽章主题：culture。
const APPLAUSE = {
  key: 'original-w11-between-movements',
  title: 'When Silence Is Part of the Music',
  passage: lettered([
    `A musical movement ends, the performers remain in position and somebody begins to applaud. Whether that response feels welcome or disruptive depends partly on what listeners believe the pause means. In some concert settings, audiences are expected to reserve applause until a complete work has ended. Should that expectation be maintained? The strongest answer cannot be obtained by calling one audience knowledgeable and another enthusiastic. Both continuity and spontaneous response can contribute to a performance. The question is how a shared convention can serve the particular music without turning an unfamiliar convention into an unnecessary condition of belonging.`,
    `The case for waiting deserves more than a description of good manners. A work comprising several movements may create relationships between contrasting sections, and the silence separating them can remain part of the listener's attention to the whole. Applause introduces another sound and a different social activity into that interval. A quiet ending followed by an energetic movement may be experienced differently if a prolonged public response intervenes. Supporters of restraint can therefore argue that waiting protects an artistic relationship, rather than merely preserving a rule because earlier audiences happened to observe it. Their concern is what becomes harder to hear.`,
    `Supporters of freer applause have an equally substantial point. A performance is a meeting between musicians and listeners, not simply the delivery of a finished object to silent recipients. An immediate response can acknowledge a striking passage and make participation visible. Someone encountering an unfamiliar programme may also reasonably interpret an apparent ending as an invitation to respond. If the only explanation arrives through disapproving looks afterwards, the event has taught a convention through discomfort rather than communication. Organisers who want new listeners cannot assume that every worthwhile form of attention already includes knowledge of the venue's expectations.`,
    `Granted, welcoming newcomers does not require abandoning every shared arrangement. Listeners with different preferences still occupy the same acoustic space, so one person's response affects what another can hear. Yet this practical interdependence supports explaining a convention, rather than treating it as self-evident. A brief introduction can identify a work's separate movements and say whether applause is invited between them. Such guidance supplies information before a decision is made. It respects the audience's capacity to cooperate, whereas correcting people afterwards assumes that knowledge of the convention was available to everyone from the beginning.`,
    `There are also limits to what guidance can establish. Naming the movements tells a listener where the structural divisions occur; it does not prove that silence is artistically preferable in every interval. That judgement depends on the work and the performance being offered. Imagine an introductory concert in which musicians discuss each section before playing the next. The continuity has already been deliberately altered to make room for explanation. Inviting applause there need not undermine a structure the event is actually trying to preserve. The relevant standard is consistency with the announced artistic purpose, not conformity to every feature of a different concert format.`,
    `A contrasting example clarifies the boundary. Suppose an ensemble presents a complete work as a continuous listening experience, asking the audience to consider the relationship between its movements. Reserving applause could then support that stated purpose. This does not make the audience more cultivated than the audience at the introductory concert. It means that the same behaviour can have different consequences in differently organised events. Comparing the formats therefore challenges a universal rule in either direction: compulsory silence and an unrestricted right to interrupt both overlook the particular relationship which performers and listeners have gathered to explore.`,
    `An objection remains that advance explanations can make a concert feel excessively managed. Listeners may want an immediate encounter with music rather than a lesson in procedure. This concern is reasonable, particularly if guidance becomes lengthy or patronising. However, a concise invitation need not prescribe what anybody should feel. It can simply clarify when collective response will fit the planned experience. Programmes can also make structural information available without requiring everyone to study it. Communication should be proportionate to the uncertainty it resolves, preserving room for personal interpretation while making the practical terms of listening together easier to understand.`,
    `Concerts should consequently choose conventions that fit their purposes and communicate them without ranking listeners by prior familiarity. Waiting between movements can protect continuity; responding immediately can belong to an event designed around exchange. Neither benefit establishes a universal obligation for all performances. Where a particular silence matters, musicians can explain its role before asking an audience to preserve it. Where responses are welcomed, that invitation can be equally explicit. A convention earns its place by helping people hear and participate in what is offered, rather than by allowing those who already know it to decide who deserves to feel at home.`,
  ]),
  questions: [
    {
      kind: 'matchingParagraphs',
      items: [
        { item: 'an argument that an unexplained expectation can make an unfamiliar audience feel unwelcome', letter: 'C' },
        { item: 'a comparison rejecting the idea that audiences following different conventions must differ in cultural worth', letter: 'F' },
        { item: 'an example in which applause changes the experience of a quiet ending followed by an energetic movement', letter: 'B' },
      ],
    },
    {
      kind: 'tfng',
      item: 'Most first-time concert visitors prefer structural guidance in a printed programme to a spoken introduction.',
      answer: 'NOT GIVEN',
      explanation: 'D、G 段提供口头介绍与节目单信息的可能安排，但没有首次到场听众的偏好调查或人数比较，选 NOT GIVEN。',
    },
    {
      kind: 'tfng',
      item: 'The writer presents identifying the divisions within a work as sufficient proof that each interval should remain silent.',
      answer: 'FALSE',
      evidence: 'Naming the movements tells a listener where the structural divisions occur; it does not prove that silence is artistically preferable in every interval.',
      explanation: 'E 段明确区分知道结构与判断每段间隔是否应安静，结构说明本身不提供普遍艺术结论，选 FALSE。',
    },
    {
      kind: 'tfng',
      item: 'According to the passage, advance guidance must determine listeners\' emotional reactions in order to be useful.',
      answer: 'FALSE',
      evidence: 'However, a concise invitation need not prescribe what anybody should feel. It can simply clarify when collective response will fit the planned experience.',
      explanation: 'G 段直接说简短说明无须规定感受，只需说明集体回应与安排的关系；程序沟通不等于控制情绪，选 FALSE。',
    },
    {
      kind: 'gapTyped',
      stem: 'Paragraph D identifies practical ______ as the fact that listeners sharing acoustic space affect one another.',
      answer: 'interdependence',
      evidence: 'Yet this practical interdependence supports explaining a convention, rather than treating it as self-evident.',
    },
    {
      kind: 'gapTyped',
      stem: 'In Paragraph G, the amount of communication should be ______ to the uncertainty it removes.',
      answer: 'proportionate',
      evidence: 'Communication should be proportionate to the uncertainty it resolves, preserving room for personal interpretation while making the practical terms of listening together easier to understand.',
    },
    {
      kind: 'short',
      marks: 2,
      stem: 'How does Paragraph D concede part of the argument for shared conventions while changing the way the expectation should be established?',
      answer: 'It concedes that listeners share an acoustic space, so an individual response affects others. It argues for explaining the expectation in advance rather than assuming everybody already knows it.',
      evidence: 'Listeners with different preferences still occupy the same acoustic space, so one person\'s response affects what another can hear. Yet this practical interdependence supports explaining a convention, rather than treating it as self-evident. A brief introduction can identify a work\'s separate movements and say whether applause is invited between them.',
      rubric: '两分：说清让步「个人发声会影响同一空间里其他人听到的内容，因此有协调需要」给 1 分；说清回应「应提前解释惯例，不能假定人人本来知道」再给 1 分。两点独立，合理同义改写均给分。只照抄听众偏好不同，没有说明相互影响，不给第一分；只写让新人守规矩而未提出提前说明，不给第二分。',
    },
    {
      kind: 'short',
      marks: 2,
      stem: 'What principle does the comparison of concert formats in Paragraph F support, and why does it undermine a universal rule about applause?',
      answer: 'A convention should be judged against the purpose of the particular event. The same audience behaviour can have different consequences when events are organised for different listening experiences.',
      evidence: 'It means that the same behaviour can have different consequences in differently organised events. Comparing the formats therefore challenges a universal rule in either direction: compulsory silence and an unrestricted right to interrupt both overlook the particular relationship which performers and listeners have gathered to explore.',
      rubric: '两分：概括「惯例须相对于具体演出目的或要建立的聆听关系判断」给 1 分；解释「同一行为在不同安排下后果不同，不能用一种规则概括全部演出」再给 1 分。两点独立，接受合理同义改写。只照抄两种演出的行为对比却不指出目的这一评价原则，不给第一分；只说作者喜欢自由而未解释后果随场景变化，不给第二分。',
    },
  ],
};

// 周四 —— 跨学科课程与学科方法；GP 议论文；徽章主题：learning。
const SUBJECTS = {
  key: 'original-w11-subject-boundaries',
  title: 'What Subject Boundaries Are For',
  passage: lettered([
    `A practical problem rarely arrives with a school subject written above it. Designing a package can require geometry, knowledge of materials and decisions about visual communication. It is therefore tempting to conclude that separate subjects are artificial barriers which education should remove. Yet the fact that a problem draws on several disciplines does not establish that those disciplines have become unnecessary. Should schools organise learning mainly around tasks that cross subject boundaries? The case depends on whether the arrangement helps learners connect distinct ways of thinking, or merely conceals those differences beneath the appearance of a unified activity.`,
    `The strongest argument for integration concerns use. A student who calculates the area of a shape on a worksheet may not immediately recognise the same relationship when estimating the cardboard required for a package. A design task can make the calculation consequential: an incorrect estimate affects the available material. Bringing the disciplines together can reveal why an abstract relationship matters and where another kind of knowledge becomes necessary. Geometry can describe a container's dimensions without determining whether the chosen material is sufficiently rigid. The boundary becomes visible as a limit to what a particular method can answer, rather than a timetable division.`,
    `Defenders of separate subjects nevertheless have a serious objection. Each discipline provides more than a collection of useful facts. It also develops standards for deciding whether a claim is justified. A geometrical relationship can be established through deduction, while a claim about the performance of a material may require observation or testing under specified conditions. If a project presents these contributions as interchangeable opinions, it loses the intellectual resources that made their combination worthwhile. A finished package might look convincing while resting on an unsupported calculation or an untested assumption. Coherence in the final product does not guarantee soundness in every contributing argument.`,
    `Granted, subject teaching can itself become disconnected from the situations in which its methods are useful. Defending disciplinary rigour is not a defence of keeping every lesson isolated. The better response is to make the connection explicit while retaining the standards by which each contribution is evaluated. In the packaging example, students could explain which conclusion follows from their measurements and which still depends on a material test. That distinction would integrate the enquiry without pretending that every question can be answered in the same way. The disciplines would meet through a shared problem, while their methods remained available for inspection.`,
    `There is also a question of sequence. Beginners cannot necessarily recognise a useful connection before learning the concepts which make it meaningful. A task that simultaneously introduces unfamiliar geometry, material properties and design conventions may demand more coordination than its participants can manage. Separate instruction can prepare a component for later use within an integrated task. Conversely, encountering a practical difficulty can reveal why a further period of focused study is needed. This suggests movement between concentration and combination, rather than a once-and-for-all choice between them. The appropriate sequence depends on what learners can already bring to the problem.`,
    `Supporters may reply that a compelling project motivates students to acquire whatever knowledge they need along the way. That is possible, but motivation does not identify every missing prerequisite. A learner may improve the appearance of a package without noticing that its calculated capacity is mistaken. Teachers still need opportunities to inspect particular contributions and provide focused explanation. These checks need not fragment the final activity into unrelated exercises. Their purpose is to establish whether the apparent success rests on understanding which the learner could recognise and use again, rather than on a fortunate combination of unexamined choices.`,
    `Practical constraints deserve equal attention. Coordinating teachers and materials across subjects requires time, and a weak connection can consume effort without adding understanding. Suppose a lesson combines a calculation with a decorative activity that neither uses nor questions its result. Their presence in the same timetable slot does not create a meaningful intellectual relationship. Integration should instead be justified by a dependency: one contribution should inform, constrain or revise another. This criterion allows some ambitious projects while also allowing a focused lesson to remain focused. An activity need not involve several subjects to have a clear and worthwhile educational purpose.`,
    `Schools should therefore connect subjects where the enquiry requires their different methods, while preserving opportunities to learn those methods carefully. The packaging task would earn its place if measurements informed the design, material tests revised it and students could explain those relationships. It would not earn its place merely by producing attractive objects bearing several subject labels. Subject boundaries are useful when they make standards and limitations visible; they become obstacles when they prevent a relevant contribution from being considered. Education should teach learners both to recognise a boundary and to cross it for an intelligible reason, rather than treating its removal as an achievement in itself.`,
  ]),
  questions: [
    {
      kind: 'matchingParagraphs',
      items: [
        { item: 'an argument that prior knowledge can determine when separate instruction should precede an integrated task', letter: 'E' },
        { item: 'an example in which a practical design makes an abstract calculation consequential', letter: 'B' },
        { item: 'an example of a calculation paired with decoration that neither uses nor questions the result', letter: 'G' },
      ],
    },
    {
      kind: 'tfng',
      item: 'Students in schools organised around cross-subject projects obtain higher mathematics results than students in other schools.',
      answer: 'NOT GIVEN',
      explanation: '全文论证课程组织的理由与限制，没有比较两类学校的数学成绩，也没有实证成效数据，选 NOT GIVEN。',
    },
    {
      kind: 'tfng',
      item: 'Teachers need more preparation time for the packaging task than for every other integrated task mentioned in the passage.',
      answer: 'NOT GIVEN',
      explanation: 'G 段只说跨科协调需要时间，没有各任务的备课时长，更没有包装任务最长的比较，选 NOT GIVEN。',
    },
    {
      kind: 'tfng',
      item: 'The writer accepts that focused instruction can prepare knowledge for later use in a task involving several disciplines.',
      answer: 'TRUE',
      evidence: 'Separate instruction can prepare a component for later use within an integrated task.',
      explanation: 'E 段明确允许先专项学习再综合运用；这支持按已有知识安排顺序，而不是每一课都必须同时跨科，选 TRUE。',
    },
    {
      kind: 'gapTyped',
      stem: 'Paragraph C identifies ______ as a way of establishing a geometrical relationship.',
      answer: 'deduction',
      evidence: 'A geometrical relationship can be established through deduction, while a claim about the performance of a material may require observation or testing under specified conditions.',
    },
    {
      kind: 'gapTyped',
      stem: 'In Paragraph F, the missing knowledge that motivation alone may fail to identify is described as a ______.',
      answer: 'prerequisite',
      evidence: 'That is possible, but motivation does not identify every missing prerequisite.',
    },
    {
      kind: 'short',
      marks: 2,
      stem: 'In Paragraph D, which criticism of isolated subjects does the writer accept, and how is the proposed response compatible with disciplinary rigour?',
      answer: 'The writer accepts that subject teaching can become disconnected from situations where its methods are useful. The response connects the enquiry while retaining each discipline\'s standards for evaluating its contribution.',
      evidence: 'Granted, subject teaching can itself become disconnected from the situations in which its methods are useful. Defending disciplinary rigour is not a defence of keeping every lesson isolated. The better response is to make the connection explicit while retaining the standards by which each contribution is evaluated.',
      rubric: '两分：指出让步「分科可能脱离方法的实际使用情境」给 1 分；说明回应「明确建立联系，同时保留各贡献的学科评价标准」再给 1 分。两点独立，接受合理同义改写。只照抄包装任务却没说明它回应脱节与保留标准的关系，不给对应分；只说所有科目合并而不保留方法标准，不给第二分。',
    },
    {
      kind: 'short',
      marks: 2,
      stem: 'Why is the decorative activity in Paragraph G insufficient evidence of integration, and what relationship would make the combination intellectually useful?',
      answer: 'It neither uses nor questions the calculation, so simultaneous participation alone establishes no intellectual connection. One contribution should inform, constrain or revise another.',
      evidence: 'Suppose a lesson combines a calculation with a decorative activity that neither uses nor questions its result. Their presence in the same timetable slot does not create a meaningful intellectual relationship. Integration should instead be justified by a dependency: one contribution should inform, constrain or revise another.',
      rubric: '两分：解释「装饰没有使用或检验计算结果，活动同时出现不等于有知识联系」给 1 分；说明有用关系「一个部分的信息应影响、限制或修正另一个部分」再给 1 分，三种作用任一即可。两点独立，接受合理同义改写。只照抄计算加装饰的对比但未说明缺少相互关系，不给第一分；只说更好看、更热闹或增加科目数，不给第二分。',
    },
  ],
};

// 周五 —— 社区项目的协商、授权与执行责任；GP 议论文；徽章主题：community。
const CONSENSUS = {
  key: 'original-w11-community-consensus',
  title: 'Agreement Without Identical Preferences',
  passage: lettered([
    `A community group can finish a meeting with an accepted plan and still discover that nobody is willing to carry it out. The difficulty suggests a difference between selecting a proposal and securing the cooperation on which it depends. Some groups therefore seek consensus, continuing discussion until members can accept a course of action even if it is not everybody's preferred option. Should this be the normal requirement for community decisions? Consensus offers a serious account of shared responsibility, but its value depends on how agreement is established and how much discussion a particular decision can reasonably require.`,
    `The strongest argument concerns implementation. Imagine residents planning a shared tool cupboard which several volunteers must maintain. Choosing the most popular location would not settle who can open it, check the contents or arrange its upkeep. Discussion may reveal that an initially attractive position is inconvenient for the people expected to do those tasks. Revising the proposal could make cooperation more realistic. Here, seeking acceptance is useful because information about practical responsibilities is distributed among participants. The meeting does more than collect preferences: it allows those preferences to be reconsidered in light of what implementing the proposal would actually involve.`,
    `Advocates of a quicker procedure have substantial reasons too. Volunteers possess limited time, and not every choice requires an extended search for a plan that everyone can accept. If a group repeatedly postpones a routine decision about cupboard labels, the discussion may consume more effort than the decision warrants. Participation also has an opportunity cost: a long evening meeting can exclude people who would contribute willingly but cannot remain until its conclusion. A procedure designed to include every perspective can therefore become selective through the demands it places on attendance. More discussion does not automatically mean that more people are effectively represented.`,
    `Consensus must also be distinguished from identical preferences. A member may prefer a different location while accepting the proposed one because it adequately meets the group's needs. Such acceptance does not require pretending that the original preference has disappeared. Equally, silence cannot safely be interpreted as acceptance when members have not been given a clear opportunity to express reservations. A chairperson who announces agreement merely because nobody interrupts may mistake uncertainty about the procedure for support. The quality of consensus depends on whether members can state their position, including a willingness to proceed despite a remaining personal preference.`,
    `Granted, asking directly for reservations can prolong a meeting. Yet a concern about carrying out essential maintenance has a different significance from a minor preference about the colour of a label. Treating every reservation as equivalent obscures the reasons for seeking agreement in the first place. A group can ask what practical consequence follows from a concern and whether a revision could address it. This does not guarantee agreement, but it makes the disagreement more intelligible. Members can examine what the proposal requires, rather than interpreting every objection as an equally decisive reason to begin the discussion again from the beginning.`,
    `A further response is to agree on the scope of delegation before routine choices arise. Members might authorise a small team to select cupboard labels within an agreed budget, while requiring broader discussion before anyone takes on a continuing maintenance role. Delegation would then follow a shared understanding of responsibility rather than replace it. The team would know which decisions it could make and when it should return to the group. This arrangement accepts the argument for efficiency without treating speed as permission to assign obligations to people who have not accepted them. Agreement concerns the procedure as well as the immediate proposal.`,
    `Some decisions can also be made provisionally. A temporary arrangement may allow members to observe whether a proposed opening schedule is workable before making a longer commitment. This option is useful only when the arrangement can realistically be changed and the review conditions are understood. Describing a decision as temporary while purchasing equipment that makes alternatives impractical would offer little meaningful flexibility. The group should identify what it expects to learn and what evidence would justify reconsideration. A trial can reduce the need to settle every uncertainty in discussion, but its practical reversibility must be more than a reassuring phrase.`,
    `Community groups should consequently seek genuine acceptance where cooperation or continuing responsibilities are at stake, while agreeing in advance how routine decisions can be delegated or revised. They need neither identical preferences nor endless meetings. They need a procedure that makes reservations expressible, matches discussion to the consequences of the choice and clarifies who has accepted the work involved. Where agreement remains unavailable, describing that limit honestly is more useful than announcing a unity that nobody has examined. A workable common plan is one people can support through their actions, even while retaining different views about which alternative they would personally have chosen.`,
  ]),
  questions: [
    {
      kind: 'matchingParagraphs',
      items: [
        { item: 'an example of accepting a proposed location while still preferring a different one', letter: 'D' },
        { item: 'an example of delegating label selection within a budget while reserving continuing maintenance roles for broader discussion', letter: 'F' },
        { item: 'a reason why prolonged participation requirements can reduce effective inclusion', letter: 'C' },
      ],
    },
    {
      kind: 'tfng',
      item: 'The passage treats the absence of interruptions as reliable proof of acceptance even when members have no clear chance to express reservations.',
      answer: 'FALSE',
      evidence: 'Equally, silence cannot safely be interpreted as acceptance when members have not been given a clear opportunity to express reservations.',
      explanation: 'D 段明确否定没有表达机会时可把沉默当同意；没有打断还可能是不了解程序，而非支持，选 FALSE。',
    },
    {
      kind: 'tfng',
      item: 'The writer accepts that an agreed procedure can authorise a smaller team to make some choices without consulting the full group each time.',
      answer: 'TRUE',
      evidence: 'Members might authorise a small team to select cupboard labels within an agreed budget, while requiring broader discussion before anyone takes on a continuing maintenance role.',
      explanation: 'F 段允许事先约定范围内的小组授权，同时把长期责任留给更广泛讨论；题干限定为部分选择，选 TRUE。',
    },
    {
      kind: 'tfng',
      item: 'A temporary trial can leave fewer uncertainties to be resolved through discussion if changing the arrangement remains practicable.',
      answer: 'TRUE',
      evidence: 'A trial can reduce the need to settle every uncertainty in discussion, but its practical reversibility must be more than a reassuring phrase.',
      explanation: 'G 段肯定试行可减少事先必须谈清的不确定性，但保留实际可改的条件；题干保留该条件，选 TRUE。',
    },
    {
      kind: 'gapTyped',
      stem: 'Paragraph F names the advance allocation of authority to a smaller team as ______.',
      answer: 'delegation',
      evidence: 'A further response is to agree on the scope of delegation before routine choices arise.',
    },
    {
      kind: 'gapTyped',
      stem: 'For a trial to offer meaningful flexibility, Paragraph G requires practical ______.',
      answer: 'reversibility',
      evidence: 'A trial can reduce the need to settle every uncertainty in discussion, but its practical reversibility must be more than a reassuring phrase.',
    },
    {
      kind: 'short',
      marks: 2,
      stem: 'How does the meeting-length example in Paragraph C challenge the claim that more discussion necessarily produces broader inclusion?',
      answer: 'An extended meeting may prevent willing contributors with limited time from staying until the conclusion. The procedure can therefore filter out perspectives through its participation demands despite its inclusive intention.',
      evidence: 'a long evening meeting can exclude people who would contribute willingly but cannot remain until its conclusion. A procedure designed to include every perspective can therefore become selective through the demands it places on attendance. More discussion does not automatically mean that more people are effectively represented.',
      rubric: '两分：指出具体机制「有意贡献但时间有限的人可能无法留到会议结束」给 1 分；推出论证含义「参加条件会筛掉部分观点，因此讨论更多不保证代表更广」再给 1 分。两点独立，接受合理同义改写。只照抄长会议这一例子而未说明对有效代表性的含义，不给第二分；只说大家不喜欢开会而未指出时间限制，不给第一分。',
    },
    {
      kind: 'short',
      marks: 2,
      stem: 'What does the writer concede to advocates of efficiency in Paragraph F, and which limit prevents that concession from removing members\' control over their own commitments?',
      answer: 'Routine choices can be delegated within an agreed scope. Efficiency does not authorise assigning continuing obligations to people who have not accepted them.',
      evidence: 'A further response is to agree on the scope of delegation before routine choices arise. Members might authorise a small team to select cupboard labels within an agreed budget, while requiring broader discussion before anyone takes on a continuing maintenance role. Delegation would then follow a shared understanding of responsibility rather than replace it. The team would know which decisions it could make and when it should return to the group. This arrangement accepts the argument for efficiency without treating speed as permission to assign obligations to people who have not accepted them. Agreement concerns the procedure as well as the immediate proposal.',
      rubric: '两分：概括让步「约定范围内的日常选择可授权小组处理」给 1 分；说清界限「效率不能成为给未同意的人分派责任的许可」再给 1 分。两点独立，接受合理同义改写。第一分可结合本段开头授权设例理解；只照抄标签和维护的对比而未说明授权原则，不给第一分；只说仍需大家参与而未指出责任须本人接受，不给第二分。',
    },
  ],
};

const SPECS = [PAPER_DISPLAY, EXPLANATION, APPLAUSE, SUBJECTS, CONSENSUS];

module.exports = {
  LEVEL,
  SPECS,
  DAYS: DATES.slice(0, SPECS.length).map((date, i) => buildAuthoredDay(SPECS[i], date)),
};
