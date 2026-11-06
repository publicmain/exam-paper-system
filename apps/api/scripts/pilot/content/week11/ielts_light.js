/**
 * 第十一周 —— ielts_light（雅思轻量）档，五篇全原创说明文，均非 GP 议论文。
 * 沿用第十周：五段、不编号；3 道判断、3 道填空转四选一、1 道两分概括填空、
 * 3 道主观题（2 / 1 / 2 分），每天 10 题、满分 13 分；每篇都有 Using your own words。
 *
 * 选题、梗概、结局与徽章（按 11-09 至 11-13 排列）：
 * · 周一 culture：The Story Between the Panels。以杯子位置变化为假设例子，解释读者怎样
 *   补足未画动作、利用线索判断时间；结尾落到阅读方向也依赖文化惯例。正文与题目保持原稿。
 * · 周二 technology：Charging Across a Gap。讲感应式充电的两组线圈、变化磁场与充电电路，
 *   区分接收电能和系统输入；结尾以电动牙刷说明避免外露接点的用途，同时保留对位与损耗限制。
 * · 周三 psychology：The Groups We See。介绍格式塔接近原则，以同一组圆点横纵间距的变化
 *   说明知觉分组；结尾区分版面暗示的图文联系与实际语义关系，不把知觉分组当现实联系的证明。
 * · 周四 history：Writing Designed for Touch。讲十九世纪法国盲文从凸起印刷字母转向六点
 *   单元，兼顾阅读和写作；结尾以接收者也能成为作者概括历史意义。正文与题目保持原稿。
 * · 周五 learning：The Meaning That Fits。以 draft 的写作、气流义及动词用法说明如何利用
 *   语境、词性标签与例句筛选释义；结尾把笔记目标从抄全条目转到记录当前用法，并向新义开放。
 * 五篇骨架分别为图文推断、能量传递链、知觉分组比较、历史设计转变、词典使用与语境检验。
 * 不设人物叙事、旧物揭晓、比赛逆转或学窍门后成为能手的桥段。
 *
 * 事实核对：遵照 brief 离线完成，未联网；以下基础事实把握高，不编实验、人数或效应量。
 * · 漫画：并置画格可让读者推断省略动作；空隙宽度不固定对应时长，阅读方向有文化差异。
 *   杯子和花均为假设例子，不归属真实作品。
 * · 感应充电：发射线圈交变电流产生变化磁场，接收线圈感应产生电压；电路转换、调节电池
 *   供电。对位影响磁耦合，器件有发热等损耗，底座仍需能源。限常见近距离感应式装置，
 *   不泛指全部无线供能，不写品牌、统一距离、效率或充电时间，不涉及电池内部化学。
 * · 心理：接近原则是格式塔知觉组织的公认原则，相近元素倾向被分成一组，其他线索可竞争。
 *   圆点和图注是假设示例，不冒充正式实验；不写脑机制，不等同于注意盲视，也不把成组
 *   当作现实中有共同用途。不写习惯化、熟悉感、解释深度错觉或沉没成本。
 * · 盲文：Louis Braille 在十九世纪法国发展六点体系，单元为两列各三点，此前已有凸字书；
 *   点位组合可用于读写。不写具体发明年份、年龄或全球推广时间，不说各语言规则完全相同。
 * · 词典：多义词需依语境、词性选义，例句可显示搭配；draft 可指写作初稿、作动词指起草；
 *   气流义明确限定美式英语，英式通常写 draught。课堂指令为假设，不编教学成效或词典排序规则。
 *
 * 查重：完整读 pack-titles-1106.txt（1–10 周 240 篇）和 read-titles-1106.txt，以及同周
 * ielts_simplified / olevel_intermediate / olevel / ielts_authentic 文件头，逐项避开其他档
 * 全部已写题材。三篇完全替换电子纸、习惯化、自我解释；周一、周四的正文与全部题目不动。
 * 本地内容包及 test-fixtures 检索 induction / inductive / wireless charging / charging pad /
 * receiving coil / proximity / perceptual grouping / dictionary entry / dictionary sense /
 * lexicography / polysemy，未发现三篇同核心题材。标题清单不等于旧正文全覆盖，近邻另核：
 * · The Battery in Every Pocket 是电池化学，本周技术篇是外部能量跨间隙到接收电路；
 *   不讲电子纸、按键消抖或图像压缩。查重发现旧条形码题材后已排除该候选。
 * · The Shape of a Sound 虽提 Gestalt，核心是声音与形状配对，本周心理篇是间距影响视觉
 *   分组；不讲声音联想、词语干扰或漏看物体。也不重复周一的省略事件、时间或阅读方向推断。
 * · A Second Route Through the Book 是书后索引；本周学习篇讲找到条目后选义，不讲工具
 *   排列或检索路径，也不重复提取、间隔记忆、数学反例、除法含义、代数步骤解释或学科边界。
 * · 保留篇原有查重：Volume One 是出售漫画，Frame by Frame 是定格动画制作，均非画格
 *   省略推断；Dotted Letters 是受助后练习写字，The decipherment of Linear B 是古文字
 *   释读，均非为触觉设计编码。原稿已核唯一历史姓名 Louis Braille 未用于第九、十周各档。
 * 新三篇不设人物姓名；不写组屋或熟食中心，不使用 brief 禁用的题材与叙事套路。
 *
 * 判断题：周一 T / F / T；周二 NG / F / F；周三 T / NG / T；
 *         周四 NG / F / F；周五 NG / T / NG。
 * 全周 TRUE 5 · FALSE 5 · NOT GIVEN 5；单天只有两类答案，均非全同。
 * NOT GIVEN 分布在第一、第二、第三位；FALSE 均有直接相反的证据。
 * 两分题逐点独立给分，接受合理同义改写；照抄但没回答所问关系，不给对应层次的分。
 * 安全及朗读：逐句复核正文、题干、选项、答案、rubric；不用敏感停推词或难朗读符号。
 */

'use strict';

const { buildAuthoredDay, plain } = require('../authored');
const { DATES } = require('./dates');

const LEVEL = 'ielts_light';

// 周一 —— 漫画中的省略、推断与阅读惯例（culture）
const COMIC_PANELS = {
  key: 'original-w11-comic-panels',
  title: 'The Story Between the Panels',
  passage: plain([
    'A comic can tell a continuous narrative through the juxtaposition of still pictures. Its separate frames, called panels, show selected moments rather than every movement. Readers connect these fragments through sequential reasoning, constructing events that the artist has not actually drawn. This cooperation between visible marks and active interpretation gives the space between pictures an implicit storytelling function, rather than leaving it as merely unused paper.',
    'Imagine one panel showing a cup on a desk and the next showing someone placing it on a shelf. The journey between those positions has been omitted, yet the sequence invites us to supply it. Such inference depends on contextual clues: continuity in the cup and its surroundings suggests that the pictures belong together. Without these clues, several unrelated scenes might seem equally plausible.',
    'The missing interval does not have a fixed duration. Two panels might show a flower opening, or the same plant in different seasons. Context, including changes in the scene and any written captions, helps readers reconstruct the chronology and decide how much time has elapsed. A wider blank space does not automatically represent a longer period. Spatial separation and temporal duration are not interchangeable measurements.',
    'Omission also affects emphasis. Drawing every stage of an ordinary action could slow a story without adding useful information. Leaving stages out allows attention to move towards a significant expression or decision. However, a gap can become confusing if the information needed to connect its two sides is absent. Effective storytelling therefore balances pictorial economy with sufficient evidence for the intended interpretation.',
    'Even the route across a page involves conventions. Some comics are arranged to be read from left to right, while others follow the opposite direction. A reader unfamiliar with the arrangement may connect the wrong moments despite understanding each individual drawing. Learning to read this medium consequently involves more than recognising objects. It requires noticing how a culture has organised the connections between them, including the parts that remain invisible.',
  ]),
  questions: [
    {
      kind: 'tfng',
      item: 'Comic readers can construct events which have not been shown directly.',
      answer: 'TRUE',
      evidence: 'Readers connect these fragments through sequential reasoning, constructing events that the artist has not actually drawn.',
    },
    {
      kind: 'tfng',
      item: 'Increasing the blank distance between panels necessarily increases the time represented.',
      answer: 'FALSE',
      evidence: 'A wider blank space does not automatically represent a longer period.',
    },
    {
      kind: 'tfng',
      item: 'Recognising everything inside individual panels may be insufficient to understand their sequence.',
      answer: 'TRUE',
      evidence: 'A reader unfamiliar with the arrangement may connect the wrong moments despite understanding each individual drawing.',
    },
    {
      kind: 'gapChoice',
      stem: 'Repeated objects and surroundings give the cup sequence a sense of ______.',
      answer: 'continuity',
      distractors: ['duration', 'emphasis', 'economy'],
      evidence: 'Such inference depends on contextual clues: continuity in the cup and its surroundings suggests that the pictures belong together.',
    },
    {
      kind: 'gapChoice',
      stem: 'Written ______ can help establish the time between depicted moments.',
      answer: 'captions',
      distractors: ['fragments', 'positions', 'measurements'],
      evidence: 'Context, including changes in the scene and any written captions, helps readers reconstruct the chronology and decide how much time has elapsed.',
    },
    {
      kind: 'gapChoice',
      stem: 'The direction in which panels are read depends on shared ______.',
      answer: 'conventions',
      distractors: ['objects', 'expressions', 'seasons'],
      evidence: 'Even the route across a page involves conventions. Some comics are arranged to be read from left to right, while others follow the opposite direction.',
    },
    {
      kind: 'gapTyped',
      summary: true,
      marks: 2,
      stem: 'To interpret a gap in a comic, readers work out both ______.',
      answer: 'what unshown events connect the panels and how much time passes between them',
      evidence: 'The journey between those positions has been omitted, yet the sequence invites us to supply it. Such inference depends on contextual clues: continuity in the cup and its surroundings suggests that the pictures belong together. Without these clues, several unrelated scenes might seem equally plausible.\n\nThe missing interval does not have a fixed duration. Two panels might show a flower opening, or the same plant in different seasons. Context, including changes in the scene and any written captions, helps readers reconstruct the chronology and decide how much time has elapsed.',
      rubric: '两分：①补出连接前后画格的未画事件／动作，给 1 分；②判断两格之间经过多久，给 1 分。两点独立，合理同义改写均可。只说「看图和看字」不给分；只描述杯子或花而未指出需要推断什么，不给对应分。照抄其他原句但未回答事件或时间这一层，不给对应分。',
    },
    {
      kind: 'short',
      marks: 2,
      stem: 'Using your own words, explain why leaving stages out can improve a story but can also make it unclear.',
      answer: 'It can direct attention away from routine movements towards important moments. But readers may be unable to link the pictures if necessary clues have also been left out.',
      evidence: 'Leaving stages out allows attention to move towards a significant expression or decision. However, a gap can become confusing if the information needed to connect its two sides is absent.',
      rubric: '两分：①省略普通过程可使注意力集中到重要时刻，给 1 分；②若缺少必要线索，读者无法连接前后内容，给 1 分。两点独立，合理同义改写均可。只写「画得少、更快」未说明叙事效果，不给第一分；只写「有空白」未说明缺少连接线索，不给第二分。照抄对比却没解释好处或混淆原因，不给对应层次的分。',
    },
    {
      kind: 'short',
      marks: 1,
      stem: "What does 'it' refer to in 'the sequence invites us to supply it' in the second paragraph?",
      answer: 'The omitted journey of the cup from the desk to the shelf.',
      evidence: 'The journey between those positions has been omitted, yet the sequence invites us to supply it.',
      rubric: '一分：答出杯子从桌上到架子的省略过程／移动，给 1 分，合理同义改写也可。只写「杯子」「下一张图」不给分；无需编造谁拿杯子或经过几步。',
    },
    {
      kind: 'short',
      marks: 2,
      stem: 'How do the cup example and the final paragraph show that understanding a comic goes beyond identifying separate objects?',
      answer: 'The cup example requires a reader to infer a connection between the pictures. The final paragraph requires the reader to know which order to follow across the page.',
      evidence: 'Such inference depends on contextual clues: continuity in the cup and its surroundings suggests that the pictures belong together. Without these clues, several unrelated scenes might seem equally plausible.\n\nThe missing interval does not have a fixed duration. Two panels might show a flower opening, or the same plant in different seasons. Context, including changes in the scene and any written captions, helps readers reconstruct the chronology and decide how much time has elapsed. A wider blank space does not automatically represent a longer period. Spatial separation and temporal duration are not interchangeable measurements.\n\nOmission also affects emphasis. Drawing every stage of an ordinary action could slow a story without adding useful information. Leaving stages out allows attention to move towards a significant expression or decision. However, a gap can become confusing if the information needed to connect its two sides is absent. Effective storytelling therefore balances pictorial economy with sufficient evidence for the intended interpretation.\n\nEven the route across a page involves conventions. Some comics are arranged to be read from left to right, while others follow the opposite direction. A reader unfamiliar with the arrangement may connect the wrong moments despite understanding each individual drawing.',
      rubric: '两分：①杯子例子要求推断不同画格的联系／省略动作，给 1 分；②末段要求掌握画格的阅读顺序／方向惯例，给 1 分。两点独立，合理同义改写均可。只列「杯子、左右方向」但不解释各要求读者做什么，不给对应分；照抄两处描写却没回答超出认物的能力，不给对应层次的分。',
    },
  ],
};

// 周二 —— 感应式无线充电的能量传递与限制（technology）
const INDUCTIVE_CHARGING = {
  key: 'original-w11-inductive-charging',
  title: 'Charging Across a Gap',
  passage: plain([
    'A phone resting on a charging pad can receive energy without an exposed electrical connection between the two objects. The absence of a cable entering the phone does not mean that electricity simply travels through the air in its usual wired form. In a common inductive charger, energy is transferred through a changing magnetic field.',
    'The pad contains a coil of wire in which an alternating current flows. This current produces a magnetic field that continually changes. A second coil, located inside the phone, can receive energy from that field. Electromagnetic induction generates a voltage in the receiving coil. When connected to the charging circuit, this allows current to flow; the circuit converts and regulates the supply for the battery.',
    'The arrangement depends on magnetic coupling, the interaction between the two coils. Their alignment matters because the field must link them effectively. Moving the phone away from the intended position can weaken that coupling, reducing the energy received. The pad is therefore not equivalent to a room-wide source from which every nearby device can obtain unlimited power. Physical proximity alone does not ensure effective alignment.',
    'Although no cable crosses the gap, the pad itself still requires an energy source. Moreover, transmission is not perfectly efficient: some energy becomes heat in the components. The energy reaching the battery is consequently less than the energy supplied to the system. Wireless describes a missing connection at one particular point, rather than independence from electrical infrastructure or the elimination of energy losses.',
    'This design can be useful when avoiding exposed contacts is desirable, as with some rechargeable toothbrushes. The receiving components can remain enclosed while energy arrives from outside the device. Yet that advantage comes with positional constraints. A charging surface must accommodate the receiving device in an appropriate location. Evaluating the technology therefore involves following the complete energy pathway, including the connection we cannot see, rather than judging convenience solely by the disappearance of a plug.',
  ]),
  questions: [
    {
      kind: 'tfng',
      item: 'The wire in the charging pad described is made from copper.',
      answer: 'NOT GIVEN',
      explanation: '原文说底座包含线圈，没有说明导线材料；不能从一般电器常识补出铜这一材料。',
    },
    {
      kind: 'tfng',
      item: 'Any device near the pad receives unlimited power regardless of how its coil is positioned.',
      answer: 'FALSE',
      evidence: 'The pad is therefore not equivalent to a room-wide source from which every nearby device can obtain unlimited power. Physical proximity alone does not ensure effective alignment.',
    },
    {
      kind: 'tfng',
      item: 'All the energy supplied to the described charging system reaches the battery.',
      answer: 'FALSE',
      evidence: 'The energy reaching the battery is consequently less than the energy supplied to the system.',
    },
    {
      kind: 'gapChoice',
      stem: 'An alternating current flows through a ______ inside the pad.',
      answer: 'coil',
      distractors: ['battery', 'plug', 'gap'],
      evidence: 'The pad contains a coil of wire in which an alternating current flows.',
    },
    {
      kind: 'gapChoice',
      stem: 'Effective magnetic coupling depends partly on the ______ of the coils.',
      answer: 'alignment',
      distractors: ['absence', 'independence', 'disappearance'],
      evidence: 'The arrangement depends on magnetic coupling, the interaction between the two coils. Their alignment matters because the field must link them effectively.',
    },
    {
      kind: 'gapChoice',
      stem: 'During transmission, some of the supplied energy becomes ______.',
      answer: 'heat',
      distractors: ['air', 'wire', 'current'],
      evidence: 'Moreover, transmission is not perfectly efficient: some energy becomes heat in the components.',
    },
    {
      kind: 'gapTyped',
      summary: true,
      marks: 2,
      stem: 'Removing the cable that enters the phone leaves two requirements: ______.',
      answer: 'the coils must be positioned to link effectively and the pad still needs an energy source',
      evidence: 'Their alignment matters because the field must link them effectively. Moving the phone away from the intended position can weaken that coupling, reducing the energy received. The pad is therefore not equivalent to a room-wide source from which every nearby device can obtain unlimited power. Physical proximity alone does not ensure effective alignment.\n\nAlthough no cable crosses the gap, the pad itself still requires an energy source.',
      rubric: '两分：①两个线圈仍需适当对位／处于能有效耦合的位置，给 1 分；②底座仍需能源／供电，给 1 分。两点独立，合理同义改写均可。第一点只说「在同一房间」不给分；第二点说底座自己产生所有能量不给分。照抄没有电线却未说明两项要求，不给对应层次的分。',
    },
    {
      kind: 'short',
      marks: 2,
      stem: 'Using your own words, distinguish the roles of the coil in the pad and the coil in the phone.',
      answer: 'The pad coil carries a changing current that creates a changing magnetic field. The phone coil receives energy from that field through an induced voltage.',
      evidence: 'The pad contains a coil of wire in which an alternating current flows. This current produces a magnetic field that continually changes. A second coil, located inside the phone, can receive energy from that field. Electromagnetic induction generates a voltage in the receiving coil.',
      rubric: '两分：①底座线圈以交变电流产生变化磁场，给 1 分；②手机线圈通过感应产生的电压从磁场接收能量，给 1 分。两点独立，合理同义改写均可，第二点写「接收线圈被变化磁场感应而获得电能」也可。只列两个线圈的位置不给分；写电流通过裸露导线直接由底座流入手机不给分。照抄线圈名称但未区分发送与接收作用，不给对应分。',
    },
    {
      kind: 'short',
      marks: 1,
      stem: "Which benefit does 'that advantage' refer to in the toothbrush example?",
      answer: 'Allowing the receiving components to remain enclosed without exposed electrical contacts.',
      evidence: 'This design can be useful when avoiding exposed contacts is desirable, as with some rechargeable toothbrushes. The receiving components can remain enclosed while energy arrives from outside the device. Yet that advantage comes with positional constraints.',
      rubric: '一分：答出避免充电装置与设备间的外露电接点／接收部件保持封闭也能充电，给 1 分，合理同义改写也可。只说「方便」「不用电」不给分；答「无需对位」与原文相反。无需补写防水等级等原文未给资料。',
    },
    {
      kind: 'short',
      marks: 2,
      stem: 'Why does the writer distinguish energy reaching the battery from energy supplied to the system, and limit the meaning of wireless to one point?',
      answer: 'Some supplied energy is lost as heat, so delivery to the battery is not perfectly efficient. The missing connection is only between pad and phone; the pad still depends on an energy supply.',
      evidence: 'Although no cable crosses the gap, the pad itself still requires an energy source. Moreover, transmission is not perfectly efficient: some energy becomes heat in the components. The energy reaching the battery is consequently less than the energy supplied to the system. Wireless describes a missing connection at one particular point, rather than independence from electrical infrastructure or the elimination of energy losses.',
      rubric: '两分：①部分输入能量变成热，因此到达电池的能量少于系统输入，给 1 分；②无线只指底座与手机间省去接线，底座仍依赖供能，给 1 分。两点独立，合理同义改写均可。只说「有热、有底座」而不解释能量比较或无线范围，不给对应分；照抄两种能量的对比却没说明损耗，不给第一分。',
    },
  ],
};

// 周三 —— 格式塔接近原则与知觉分组（psychology）
const PERCEPTUAL_GROUPING = {
  key: 'original-w11-perceptual-grouping',
  title: 'The Groups We See',
  passage: plain([
    'Place several identical dots along a line, leaving a small distance within each pair and a larger distance between pairs. Viewers will often see a series of pairs rather than a collection of unrelated marks. Nothing has been drawn around the pairs to join them. Their apparent organisation illustrates proximity, a well-established principle of perceptual grouping described in Gestalt psychology.',
    'According to this principle, elements that are closer to one another tend to be perceived as belonging together. The visual system does more than register individual positions: it organises them into units. This grouping can occur without a deliberate instruction to count or classify the dots. The relevant factor is relative spacing, not a universal distance at which every pair of marks becomes a group.',
    'Now imagine the same dots arranged in a rectangular array. If the horizontal gaps are smaller than the vertical ones, rows may become more apparent. Reversing that relationship can make columns more prominent, although the number, colour and shape of the dots remain unchanged. The comparison isolates spatial arrangement as a possible influence on perceived structure, rather than attributing the change to different objects.',
    'Proximity is not the only grouping cue. Similar colours, shared movement and other relationships can also influence perception, sometimes competing with nearness. Consequently, the principle describes a tendency rather than an inflexible rule. It does not establish that neighbouring objects share a purpose in the physical world. Perceived unity and actual connection are distinct claims, even when the first makes the second seem intuitively plausible.',
    'The distinction matters when reading a page of information. A caption placed nearer one photograph than another may appear to describe the nearer image. That impression could guide a reader correctly, but it cannot establish what the writer intended. Checking the wording remains necessary. A designer can use this tendency, but readers still need semantic evidence. Understanding proximity helps explain how an arrangement suggests relationships; it does not make every relationship suggested by that arrangement reliable.',
  ]),
  questions: [
    {
      kind: 'tfng',
      item: 'Viewers may group the dots without being deliberately asked to classify them.',
      answer: 'TRUE',
      evidence: 'This grouping can occur without a deliberate instruction to count or classify the dots.',
    },
    {
      kind: 'tfng',
      item: 'The proximity principle has a stronger effect on younger viewers than on older viewers.',
      answer: 'NOT GIVEN',
      explanation: '全文没有比较年龄组或效应强弱；例子中的 viewers 没有给出年龄。',
    },
    {
      kind: 'tfng',
      item: 'Nearness can compete with other relationships that influence visual grouping.',
      answer: 'TRUE',
      evidence: 'Similar colours, shared movement and other relationships can also influence perception, sometimes competing with nearness.',
    },
    {
      kind: 'gapChoice',
      stem: 'The visual system organises separate positions into ______.',
      answer: 'units',
      distractors: ['captions', 'colours', 'claims'],
      evidence: 'The visual system does more than register individual positions: it organises them into units.',
    },
    {
      kind: 'gapChoice',
      stem: 'Reducing vertical gaps relative to horizontal ones can make ______ more prominent.',
      answer: 'columns',
      distractors: ['rows', 'colours', 'captions'],
      evidence: 'If the horizontal gaps are smaller than the vertical ones, rows may become more apparent. Reversing that relationship can make columns more prominent, although the number, colour and shape of the dots remain unchanged.',
    },
    {
      kind: 'gapChoice',
      stem: 'The fourth paragraph distinguishes actual connection from perceived ______.',
      answer: 'unity',
      distractors: ['movement', 'distance', 'wording'],
      evidence: 'Perceived unity and actual connection are distinct claims, even when the first makes the second seem intuitively plausible.',
    },
    {
      kind: 'gapTyped',
      summary: true,
      marks: 2,
      stem: 'In the third paragraph, changing the gaps produces two possible groupings: ______.',
      answer: 'smaller horizontal gaps can suggest rows, while smaller vertical gaps can suggest columns',
      evidence: 'If the horizontal gaps are smaller than the vertical ones, rows may become more apparent. Reversing that relationship can make columns more prominent, although the number, colour and shape of the dots remain unchanged.',
      rubric: '两分：①横向间距比纵向小，容易看成横行，给 1 分；②纵向间距比横向小，容易看成纵列，给 1 分。两点独立，合理同义改写均可。两点都需说明间距与分组方向的对应，不能只列 rows 和 columns。反转对应关系不给对应分；照抄圆点未变而没有回答两种分组，不给分。',
    },
    {
      kind: 'short',
      marks: 2,
      stem: 'Using your own words, explain why a fixed distance between two marks would be an unreliable rule for predicting whether they appear grouped.',
      answer: 'Grouping depends on distances relative to other gaps, rather than one universal measurement. Other cues, such as colour or shared movement, may also compete with proximity.',
      evidence: 'The relevant factor is relative spacing, not a universal distance at which every pair of marks becomes a group.\n\nNow imagine the same dots arranged in a rectangular array. If the horizontal gaps are smaller than the vertical ones, rows may become more apparent. Reversing that relationship can make columns more prominent, although the number, colour and shape of the dots remain unchanged. The comparison isolates spatial arrangement as a possible influence on perceived structure, rather than attributing the change to different objects.\n\nProximity is not the only grouping cue. Similar colours, shared movement and other relationships can also influence perception, sometimes competing with nearness.',
      rubric: '两分：①分组取决于与其他间隔比较的相对间距，并非固定绝对距离，给 1 分；②颜色／共同运动等其他线索也会影响或竞争，给 1 分。两点独立，合理同义改写均可。只说「每个人不同」原文无据，不给分；照抄几个线索名称而没有解释固定距离为何不够，不给对应层次的分。',
    },
    {
      kind: 'short',
      marks: 1,
      stem: "What specific association is meant by 'That impression' in the final paragraph?",
      answer: 'The impression that the caption describes the photograph nearer to it.',
      evidence: 'A caption placed nearer one photograph than another may appear to describe the nearer image. That impression could guide a reader correctly, but it cannot establish what the writer intended.',
      rubric: '一分：答出图注似乎说明离它更近的照片，给 1 分，合理同义改写也可。只写「图注」「读者印象」不给分；必须说清文字与哪张照片的关联，不要求复述作者意图的限制。',
    },
    {
      kind: 'short',
      marks: 2,
      stem: 'What does the unchanged set of dots demonstrate about organisation, and why does the caption example still require checking the words?',
      answer: 'Changing spacing can alter perceived grouping without changing the objects themselves. A visually suggested caption link does not prove which photograph the writer intended to describe.',
      evidence: 'Reversing that relationship can make columns more prominent, although the number, colour and shape of the dots remain unchanged. The comparison isolates spatial arrangement as a possible influence on perceived structure, rather than attributing the change to different objects.\n\nProximity is not the only grouping cue. Similar colours, shared movement and other relationships can also influence perception, sometimes competing with nearness. Consequently, the principle describes a tendency rather than an inflexible rule. It does not establish that neighbouring objects share a purpose in the physical world. Perceived unity and actual connection are distinct claims, even when the first makes the second seem intuitively plausible.\n\nThe distinction matters when reading a page of information. A caption placed nearer one photograph than another may appear to describe the nearer image. That impression could guide a reader correctly, but it cannot establish what the writer intended. Checking the wording remains necessary.',
      rubric: '两分：①物件本身不变，改变间距仍可改变看到的分组，给 1 分；②版面暗示的关联不等于作者实际要说明的照片，需核对文字意思，给 1 分。两点独立，合理同义改写均可。只列「圆点、图注」不给分；第一点仅抄颜色数量没变却未说明间距影响组织，不给分；第二点把靠近当成语义关系的充分证据不给分。',
    },
  ],
};

// 周四 —— 六点盲文的历史设计转向（history）
const TACTILE_WRITING = {
  key: 'original-w11-tactile-writing',
  title: 'Writing Designed for Touch',
  passage: plain([
    'Before braille became available, some books for blind readers used embossed versions of ordinary printed letters. A finger could follow their outlines, but a shape designed to be recognised by sight was not necessarily legible by touch. The historical problem was therefore not simply how to lift writing above a page. It was how to organise writing for a different sense.',
    'In nineteenth-century France, Louis Braille developed a system built around a compact cell of six possible raised dots, arranged in two columns of three. Different configurations of dots represented different characters. Instead of tracing the full outline of a typographic character, readers could distinguish patterns within this small framework. The system changed the structure of the symbol rather than merely enlarging an existing visual form.',
    'The dots were positions in a code, not miniature pictures of the things being described. Their meaning depended on agreed encoding rules. Languages could use the framework according to their own writing conventions, so sharing a basic cell did not require every language to have identical rules. Decoding these patterns still required learning, just as learning ordinary print requires more than seeing marks.',
    'Writing was another important part of the development. Raised letters could be prepared for readers, but producing their complicated outlines was difficult with simple hand tools. Embossing dot patterns required pressing points into paper with a suitable tool and guide. Recipients were consequently able to produce their own correspondence. The distinction was between receiving an accessible text and having an accessible means of authorship.',
    'Braille did not replace the need for teaching, suitable materials or opportunities to read. Its significance lay in a different design principle: the familiar appearance of print was no longer treated as the necessary starting point. A successful writing system could preserve language while changing the physical form through which it was encountered. The criterion was functional literacy rather than resemblance to conventional print: what could users read and create?',
  ]),
  questions: [
    {
      kind: 'tfng',
      item: 'The earliest raised-letter books described in the passage were more expensive than the first braille books.',
      answer: 'NOT GIVEN',
      explanation: '原文比较凸起字母和点位编码的形状、读写方式，没有比较两类书的售价或制作成本。',
    },
    {
      kind: 'tfng',
      item: 'Each braille cell copies the complete outline of an ordinary printed letter.',
      answer: 'FALSE',
      evidence: 'Instead of tracing the full outline of a typographic character, readers could distinguish patterns within this small framework.',
    },
    {
      kind: 'tfng',
      item: 'Using the same six-dot framework requires all languages to follow identical writing rules.',
      answer: 'FALSE',
      evidence: 'Languages could use the framework according to their own writing conventions, so sharing a basic cell did not require every language to have identical rules.',
    },
    {
      kind: 'gapChoice',
      stem: 'The basic cell arranges its six possible dots in two ______.',
      answer: 'columns',
      distractors: ['outlines', 'characters', 'combinations'],
      evidence: 'In nineteenth-century France, Louis Braille developed a system built around a compact cell of six possible raised dots, arranged in two columns of three.',
    },
    {
      kind: 'gapChoice',
      stem: 'The dot positions form a ______ instead of pictures of the objects described.',
      answer: 'code',
      distractors: ['tool', 'guide', 'sense'],
      evidence: 'The dots were positions in a code, not miniature pictures of the things being described.',
    },
    {
      kind: 'gapChoice',
      stem: 'Making messages independently gave readers a means of ______.',
      answer: 'authorship',
      distractors: ['sight', 'appearance', 'enlargement'],
      evidence: 'Recipients were consequently able to produce their own correspondence. The distinction was between receiving an accessible text and having an accessible means of authorship.',
    },
    {
      kind: 'gapTyped',
      summary: true,
      marks: 2,
      stem: 'Braille supported both reading and authorship because ______.',
      answer: 'readers could recognise compact dot patterns instead of tracing printed outlines, and they could produce their own messages with simple tools',
      evidence: 'Instead of tracing the full outline of a typographic character, readers could distinguish patterns within this small framework. The system changed the structure of the symbol rather than merely enlarging an existing visual form.\n\nThe dots were positions in a code, not miniature pictures of the things being described. Their meaning depended on agreed encoding rules. Languages could use the framework according to their own writing conventions, so sharing a basic cell did not require every language to have identical rules. Decoding these patterns still required learning, just as learning ordinary print requires more than seeing marks.\n\nWriting was another important part of the development. Raised letters could be prepared for readers, but producing their complicated outlines was difficult with simple hand tools. Embossing dot patterns required pressing points into paper with a suitable tool and guide. Recipients were consequently able to produce their own correspondence.',
      rubric: '两分：①阅读从追踪印刷字母轮廓转为辨认点位组合，给 1 分；②读者能用工具自己制作点字信息／不只是接收文字，给 1 分。两点独立，合理同义改写均可。第二点只说有书读而不说能写，不给分；第一点说把字母放得更大，不给分。照抄工具或点数句却没解释读写方式的改变，不给对应层次的分。',
    },
    {
      kind: 'short',
      marks: 2,
      stem: 'Using your own words, explain why the earlier raised-letter approach did not fully solve the problems of reading and producing text by touch.',
      answer: 'The letter shapes had been designed for vision and could be inconvenient to distinguish with a finger. Their complicated outlines were also difficult to produce using simple hand tools.',
      evidence: 'A finger could follow their outlines, but a shape designed to be recognised by sight was not necessarily legible by touch. The historical problem was therefore not simply how to lift writing above a page. It was how to organise writing for a different sense.\n\nIn nineteenth-century France, Louis Braille developed a system built around a compact cell of six possible raised dots, arranged in two columns of three. Different configurations of dots represented different characters. Instead of tracing the full outline of a typographic character, readers could distinguish patterns within this small framework. The system changed the structure of the symbol rather than merely enlarging an existing visual form.\n\nThe dots were positions in a code, not miniature pictures of the things being described. Their meaning depended on agreed encoding rules. Languages could use the framework according to their own writing conventions, so sharing a basic cell did not require every language to have identical rules. Decoding these patterns still required learning, just as learning ordinary print requires more than seeing marks.\n\nWriting was another important part of the development. Raised letters could be prepared for readers, but producing their complicated outlines was difficult with simple hand tools.',
      rubric: '两分：①为视觉设计的字形不一定便于触觉辨别，给 1 分；②复杂轮廓难以用简单手工具制作，给 1 分。两点独立，合理同义改写均可。只说旧书不好或盲人看不到不给分；照抄新旧形式的差别却没解释触读或制作上的困难，不给对应层次的分。',
    },
    {
      kind: 'short',
      marks: 1,
      stem: "In the final paragraph, what design decision is described by 'a different design principle'?",
      answer: 'Designing writing for touch instead of treating the appearance of ordinary print as essential.',
      evidence: 'Its significance lay in a different design principle: the familiar appearance of print was no longer treated as the necessary starting point.',
      rubric: '一分：说明按触觉使用需要设计，不再必须仿照普通印刷外观，给 1 分，合理同义改写也可。只答「用了六点」「设计不同」不给分；写成放弃语言或不再需要学习不给分。照抄原则一词但未说明什么原则，不给分。',
    },
    {
      kind: 'short',
      marks: 2,
      stem: 'Why does the writer describe both a shared cell framework and continuing language-specific rules?',
      answer: 'The same physical dot arrangement can support different languages. However, users still need to learn the particular conventions by which their language uses that arrangement.',
      evidence: 'Languages could use the framework according to their own writing conventions, so sharing a basic cell did not require every language to have identical rules. Decoding these patterns still required learning, just as learning ordinary print requires more than seeing marks.',
      rubric: '两分：①同一基础点位结构可服务不同语言，给 1 分；②实际读者仍需学本语言怎样使用该结构／其规则，给 1 分。两点独立，合理同义改写均可。只列「相同结构、不同语言」而未解释通用结构与学习规则的关系，不给对应层次的分；说学会一种便自动通读所有语言不给第二分。',
    },
  ],
};

// 周五 —— 依语境、词性与例句选择词典义项（learning）
const DICTIONARY_SENSES = {
  key: 'original-w11-dictionary-senses',
  title: 'The Meaning That Fits',
  passage: plain([
    'Looking up an unfamiliar word does not end when its spelling has been found. A dictionary entry may contain several senses, each describing a different use. Selecting the first definition without scrutiny can therefore produce a grammatical sentence with an inappropriate meaning. Effective dictionary use involves lexical disambiguation, guided by contextual evidence rather than the sequence of definitions. The difficulty is semantic: the definition must preserve the coherence of this particular message.',
    'Consider an invented instruction asking students to revise a draft before handing in their work. A draft can be an unfinished version of a piece of writing. In American English, it can also be a current of air. Both senses are legitimate. Here, the references to revision and submitted work make the writing sense coherent, whereas the air sense fails to explain the surrounding activity.',
    "Grammatical categorisation narrows the search further. In an instruction to draft a letter, the word functions as a verb, so a definition labelled as a noun cannot directly explain its role. Labels identify that distinction, while example sentences demonstrate typical combinations of words, known as collocations. These examples need not reproduce the learner's sentence exactly; they provide evidence about patterns that can be recognised in a new context.",
    'After choosing a sense, the learner should return to the complete sentence and test the provisional interpretation. Substituting a brief paraphrase can reveal a mismatch which seemed harmless when the word was considered alone. This contextual verification is especially useful when the most familiar sense was selected automatically. Familiarity with one use does not establish its relevance to every occurrence of the same spelling.',
    'A useful vocabulary note consequently records a word alongside the sense needed, a phrase showing its use and relevant grammatical information. It need not copy the entire entry. Keeping every definition may increase the quantity of notes without improving their semantic precision or contextual applicability. The aim is a usable record of a particular encounter, while leaving room for additional senses when later reading supplies a reason to learn them.',
  ]),
  questions: [
    {
      kind: 'tfng',
      item: 'Looking up a word electronically is usually faster than using a printed dictionary.',
      answer: 'NOT GIVEN',
      explanation: '全文讲找到条目后怎样选择释义，没有比较电子词典与纸质词典的查询速度。',
    },
    {
      kind: 'tfng',
      item: 'A dictionary example can be useful even when it does not exactly reproduce the sentence a learner is reading.',
      answer: 'TRUE',
      evidence: "These examples need not reproduce the learner's sentence exactly; they provide evidence about patterns that can be recognised in a new context.",
    },
    {
      kind: 'tfng',
      item: 'Most dictionaries place the most frequently used sense first.',
      answer: 'NOT GIVEN',
      explanation: '原文提醒不能只按释义出现的顺序选义，但没有说明多数词典按使用频率排序，也没有提供比例。',
    },
    {
      kind: 'gapChoice',
      stem: 'The passage calls the different uses within a dictionary entry ______.',
      answer: 'senses',
      distractors: ['patterns', 'labels', 'combinations'],
      evidence: 'A dictionary entry may contain several senses, each describing a different use.',
    },
    {
      kind: 'gapChoice',
      stem: 'References to revision and submitted work make the writing sense ______.',
      answer: 'coherent',
      distractors: ['unfinished', 'unfamiliar', 'harmless'],
      evidence: 'Here, the references to revision and submitted work make the writing sense coherent, whereas the air sense fails to explain the surrounding activity.',
    },
    {
      kind: 'gapChoice',
      stem: 'Copying every definition can enlarge vocabulary notes without improving their ______.',
      answer: 'precision',
      distractors: ['quantity', 'spelling', 'order'],
      evidence: 'Keeping every definition may increase the quantity of notes without improving their semantic precision or contextual applicability.',
    },
    {
      kind: 'gapTyped',
      summary: true,
      marks: 2,
      stem: 'Labels and example sentences provide different kinds of help: ______.',
      answer: 'labels indicate grammatical roles such as noun or verb, while examples show typical combinations of words',
      evidence: 'In an instruction to draft a letter, the word functions as a verb, so a definition labelled as a noun cannot directly explain its role. Labels identify that distinction, while example sentences demonstrate typical combinations of words, known as collocations.',
      rubric: '两分：①标签标明名词、动词等语法类别／词性，给 1 分；②例句显示常见词语组合／搭配，给 1 分。两点独立，合理同义改写均可。只写「标签短、例句长」不给分；第二点只说例句必须与原句相同不给分。照抄两个工具名称但没有分别说明用途，不给对应分。',
    },
    {
      kind: 'short',
      marks: 2,
      stem: 'Using your own words, explain why finding a legitimate definition is insufficient, and how returning to the complete sentence helps.',
      answer: 'A genuine meaning may belong to a different use and be inappropriate in this context. Testing an explanation in the whole sentence can expose a mismatch that was not obvious from the isolated word.',
      evidence: 'After choosing a sense, the learner should return to the complete sentence and test the provisional interpretation. Substituting a brief paraphrase can reveal a mismatch which seemed harmless when the word was considered alone. This contextual verification is especially useful when the most familiar sense was selected automatically. Familiarity with one use does not establish its relevance to every occurrence of the same spelling.',
      rubric: '两分：①真实存在的词义也可能不适合当前用法／语境，给 1 分；②放回整句检验能暴露单看词语时没发现的意义不合，给 1 分。两点独立，合理同义改写均可。只说「词典会错」不给第一分；只说「再读一次」而未解释怎样发现不合，不给第二分。照抄两个词义却没回答适用性或检验作用，不给对应层次的分。',
    },
    {
      kind: 'short',
      marks: 1,
      stem: "Which two meanings are included in 'Both senses' in the second paragraph?",
      answer: 'An unfinished version of a piece of writing and a current of air.',
      evidence: 'A draft can be an unfinished version of a piece of writing. In American English, it can also be a current of air. Both senses are legitimate.',
      rubric: '一分：答出「写作初稿」和「气流／穿堂风」两义，给 1 分，合理同义改写均可。只写其中一个义项不给分；答名词和动词不给分，因为此处 Both senses 指前两句的两个名词义。',
    },
    {
      kind: 'short',
      marks: 2,
      stem: 'Why should the vocabulary note be selective now while still allowing later additions?',
      answer: 'It should preserve a usable account of the particular meaning encountered, rather than collect irrelevant definitions. Later reading may supply a relevant new use that is worth adding.',
      evidence: 'A useful vocabulary note consequently records a word alongside the sense needed, a phrase showing its use and relevant grammatical information. It need not copy the entire entry. Keeping every definition may increase the quantity of notes without improving their semantic precision or contextual applicability. The aim is a usable record of a particular encounter, while leaving room for additional senses when later reading supplies a reason to learn them.',
      rubric: '两分：①当前笔记应准确保留本次遇到的用法，抄全不一定增加实用性，给 1 分；②之后阅读可能遇到值得补充的新义项，给 1 分。两点独立，合理同义改写均可，第一点写「记录当前需要的义项而非无关释义」即可。只说「省时间」「越短越好」不给第一分；说一个词永远只学一个意思不给第二分。照抄笔记内容清单但没说明选择或扩充的理由，不给对应层次的分。',
    },
  ],
};

const SPECS = [COMIC_PANELS, INDUCTIVE_CHARGING, PERCEPTUAL_GROUPING, TACTILE_WRITING, DICTIONARY_SENSES];

module.exports = {
  LEVEL,
  SPECS,
  DAYS: DATES.slice(0, SPECS.length).map((date, i) => buildAuthoredDay(SPECS[i], date)),
};
