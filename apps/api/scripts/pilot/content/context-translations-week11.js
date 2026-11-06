'use strict';

// 首发周例句的中文句意。key 是英文原句的 SHA-256；
// content/index.js 会逐条校验，少一条就立即报错，不能带缺口发布。
// 由 scripts/pilot/build-week2-context-translations.js 生成（Azure Translator），
// 生成后经人工复核。行尾注释是原句，方便审阅时不必回查。
module.exports = {
  '6ed5f65a6eee3780f33b865ec8094245b7800265e7a0d0ef8f3aa49f2ec41625': "它们帮助解释了为何适合稳定页面的技术并不自动成为快速变化动画的最佳选择，即使两者都需要同样清晰的单个图像。", // They help explain why a technology well suited to a stable page is not automat
  '67721b1af8ced80ef998a71c2814eaaea8d2f0b11f24706b01d2f4eca0a1a652': "在充足的环境光下，照明可以来自房间或天空，而非设备本身。", // In adequate ambient light, illumination can come from the room or the sky rath
  '1c5919cd562e01c498b335a220e65d5f2f4bde174e96a7266f1053c1ae1b37e5': "在常见的黑白电泳设计中，不同电荷的颜料颗粒悬浮在微小的腔室内的流体中。", // In a common black and white electrophoretic design, differently charged pigmen
  'd727911ecf6a0c268edbb1c665cfe73b0506428da650d89edd76136e4f778b11': "它通过同一机箱内的独立组件提供照明，就像阅读灯让印刷页面可用而不改变其墨水形成字母的方式一样。", // It supplies illumination from a separate component within the same enclosure, 
  '5589d3a757a542ba1267d8f6a0f94d76bcf0132db902a84ec50aed1347e3ae05': "图像保留描述的是显示器的行为，而非连接其上的每个组件的能量预算。", // Image retention describes the behaviour of the display, not the energy budget 
  'f61ae5114a5afd1de37eb606d799b05169017735c5e8407dde5b04a3c1733bbb': "在某些实现中，彻底刷新会短暂地通过显眼的中间状态。", // In some implementations, a thorough refresh briefly passes through conspicuous
  'dd84125fa40e539743e47134ac46851d1ae8fd67d96522b316bddc652bee6408': "因此，它与印刷纸张的相似度不仅仅是外观问题。", // Its resemblance to printed paper is therefore more than a matter of appearance
  '7f001b7daadad0c0235ef494ca6d72bcacc9fae47c9dc47079e35d0d8ecadd19': "较快的部分更新可能会留下早期内容的淡淡残留，通常称为“重影”，而后续刷新可以减少这种残留。", // Faster partial updates may leave faint remnants of earlier content, commonly c
  '9e2c18c56ca4bfd18f9afc6a58e2ee80bf731111dd005e3c21ea1e4d5cf78c9c': "与普通印刷页面不同，这种排列可以通过电子方式重新写入;与发光显示不同，它可以通过表面反射的光线来读取。", // Unlike an ordinary printed page, the arrangement can be rewritten electronical
  'a5e8f002b8ac9f78cdcdb7ab9203c5d7c2aa2bff6bef3ac6a858ae948f3835d5': "处理器、无线连接或可选的前灯仍可能需要电力。", // A processor, a wireless connection or an optional front light may still requir
  'b2dc0027933d9c80b71a8123fe6f3ca211d2b8911f729b142707e8eff3f86597': "电泳一词描述了带电粒子在流体中电场下的运动。", // The term electrophoresis describes the movement of charged particles through a
  'f6a19c05395704b3034f2beb03cadc35ec3259fd22d14c1443fad98515a6f9db': "仅凭可读图像并不能证明连接仍然有效。", // Its readable image would not, by itself, demonstrate that the connection still
  '27cfc2adff17d86b395838cf185c693ec876ae121eeb5843a06442ec2aca069a': "一旦页面形成，颜料排列就不必反复重现，因为读者仍停留在该页面。", // Once a page has been formed, the pigment arrangement does not need to be repea
  'cd5083140d9dc2e0c1dd38d58cbdeeb2110365f927ee097ab1fef52a29ecbbc4': "保持稳定的图像很有用，因为信息被展示的时间远远超过重写。", // Retaining a stable image is useful because the information spends much longer 
  '38501913a82793e2009e6804e2002bf9a30e9d352cdb70631c8efb9354cf7fbd': "反射作用还决定了页面与周围环境之间的关系。", // Reflective operation also determines the relationship between the page and its
  'ec6d91586183102ab7ea1ce9470517bd2216f4b47b19c5447a5c6cb7a6930e58': "这并不意味着整个设备在更新之间完全不耗电。", // It does not follow that the complete device consumes no power between updates.
  'dd3e7b083301d384ed0aa2cf6c2cc50b1084bdd0e1e314b21b4b0bce7ddb8e0c': "在比较不同读取条件下的功耗时，这种区别非常重要。", // The distinction matters when comparing the power consumed under different read
  '006d4dd9dfd78b409e78ebeb8baea26ddd107cddebd34401f2eb60c2984046a6': "这使得进一步学习更具选择性，因为缺失的关系已经变得可识别。", // It makes further learning more selective because the missing relationship has 
  'ad1af1f31103615f013dbf579442f08372b9485c29a04c68f879ecd9870aa730': "专家也能承认不确定性，但不会比自信的新手知识不足。", // An expert can also acknowledge uncertainty without being less knowledgeable th
  '15f3d73c05ffacfa379837322553c485023e55e4e8aa450c0d3b9c26681f4a18': "需要专业术语而任务本身不需要，可能会使口头修饰与因果理解混淆。", // Requiring specialist terminology which the task does not need may confuse verb
  '50a3db8347bd7e78d0c129b1c2fd623c1433cf3cb485eb626ec0db857ed3ae30': "信心下降并不意味着参与者一无所知，不完整的解释也不会抹杀有效使用该机制的能力。", // A fall in confidence does not demonstrate that a participant knows nothing, an
  '28e38534f0874d0b05fc67976dd0c6f19bf1f0fafc39d3e2b17ed92869f883c7': "一个可能的原因在于，识别成功的结果与在头脑中描绘产生这一结果的过程存在差别。", // One plausible contributor is the difference between recognising a successful o
  'fc7a124dce6ef9aaacfe8284153871721eeb31062364d4c83accba6c56ee72f7': "然而，如果学生被要求提出他们从未学过的细节，然后又被评为普遍不具备能力，那该活动设计就很糟糕。", // However, the activity would be poorly designed if students were expected to pr
  '74e19d422ee1561dfd5b933cec6444cc5a6be1341110f415c6432a65152e786c': "只有在被要求作出详细的因果解释时，这一困难才会显现。", // The difficulty becomes visible only when a detailed causal account is requeste
  '815849d94b9397423e0f3d63f4d98cff35b2e2dea4635314110dce81781b8633': "这类问题关注的是解释的结构，而不是奖励复杂的词汇或表达自信。", // Such questions inspect the structure of the explanation instead of rewarding e
  '5353643f58c8511287c8723e5963f622512a7066d05f57e781a19b307d009168': "心理学家称最初自信的理解感与通过解释揭示的理解之间的差距为解释深度的错觉。", // Psychologists call the gap between an initially confident sense of understandi
  'd2bdc4a182a462a5af11838d0387eaa82198b579b15f16684c8c69434c4d6a56': "信心和理解是相关的判断，但不能仅将确定性本身视为专业的直接衡量标准来建立它们的关系。", // Confidence and understanding are related judgements, but their relationship ca
  'f104a593e2cf105a1ab2b32deac4516bfedee0c946556791d0cfbf7d5a878cc9': "随后，他们被要求详细解释这些机制，并再次评估他们的理解。", // They are then asked to explain those mechanisms in detail and subsequently rat
  '5a36d3a90a7d2dcea4015a45c23fe2620271bd6eeee99fa9bd53c5821b1f3821': "在经典的研究过程中，参与者首先评估他们对熟悉机制的理解程度。", // In a classic research procedure, participants first rate how well they underst
  '1b24291b2db008b936f8174a5648ff403cd53a6a2b9a0daab662711915473edd': "一个人每天早上可能用拉链，预测滑块应该往哪个方向移动，并识别损坏的紧固件，但却难以解释其部件如何相互咬合。", // A person may use a zip every morning, predict which way the slider should move
  '1161b00f766bdede0769a7d0edbb14184ecaf642bc663013457108646c909d9d': "因此，最有成效的结果可能是提出更精准的问题，而非立即完整的答案。", // The most productive result may therefore be a better calibrated question rathe
  'a4563138a514c861c4cbd302773b7feaf4990d012f70c70ef102091af4fd6891': "对细节的要求改变了充分性标准：答案必须连接后续阶段，而不仅仅是用更专业的语言重新描述最终结果。", // The demand for detail changes the standard of adequacy: an answer must connect
  '2c594b9e5ef35e0ff97d72bef3182555ff6f4a911a7c32806a931d039cbbf325': "估算取决于任务、要求的细节程度以及做出判断时可用的信息。", // Estimates depend on the task, the requested level of detail and the informatio
  'ef863a4b1a0b040bee739beb19be07c24660e6b363a5fe8d40c687942074507a': "当词汇比推理更完整时，解释也可能掩盖自身的空白。", // An explanation can also conceal its own gaps when the vocabulary is more compl
  'f64faff9a9c63ca9ae894f716ab27df32a258e22d3ff65d3b69e349fd0cffc75': "一个一开始声称自己理解某个装置的人，可能会最终区分自己能操作的和能解释的。", // Someone who begins by claiming to understand a device may finish by distinguis
  'a2fd76850a5a0ecf5a45be08b3e6ec67320f542b2429ca58c3eb9dbcf1066a58': "因此，比较这两种形式挑战了一种普遍规则：强制安静和无限制打断权，都忽视了表演者和听众聚集在一起探索的特殊关系。", // Comparing the formats therefore challenges a universal rule in either directio
  'ecc44eb3dbca4931774113bce373caf1aba1ff70bbb00969abfb3b52fd450712': "然而，这种实际的相互依存支持解释一个惯例，而不是将其视为不言自明。", // Yet this practical interdependence supports explaining a convention, rather th
  'f8e3ac7d5b9f3c100e4e9788abf7795bc9bf8ed981ed0ff91cffa4f5a412c912': "然而，简明的邀请不必规定任何人应有的感受。", // However, a concise invitation need not prescribe what anybody should feel.
  'b66077bd645a0450fa50d51e2c305b885f8a3f4570e70316143b950a3d11a95b': "相关标准是与所宣称的艺术目的保持一致，而非完全符合不同音乐会形式的每一项特征。", // The relevant standard is consistency with the announced artistic purpose, not 
  '428cd273b846dc10fa2ec3979301f04e6a4d6bc1c2dddd1d15fddbd540e9d67f': "这种回应是受欢迎还是干扰，部分取决于听众对停顿的理解。", // Whether that response feels welcome or disruptive depends partly on what liste
  '7433940d3e74e55064d590813200f9c1086de39fec72eeb205e5f2bd01a1f4f0': "仅仅把一类听众称为知识渊博、另一类称为热情，并不能得出最有说服力的答案。", // The strongest answer cannot be obtained by calling one audience knowledgeable 
  '9458cbbbeab150123339671a164c90f3bbd394f502d529c4f1cd0802282f148e': "连续性和自发反应都能为表演做出贡献。", // Both continuity and spontaneous response can contribute to a performance.
  '17e957ea0c5633b7c80caf614ba388c8084b5f64759d881468eb859ec7e5788f': "假设一个合奏团将整部作品呈现为连续的聆听体验，邀请观众思考其乐章之间的关系。", // Suppose an ensemble presents a complete work as a continuous listening experie
  '9ebe16b29529f64b0b80f3aac9f3c5a2042bbbf1b7cc4d13f0509241ebb9c900': "因此，主张克制的人可以认为，等待维护的是艺术上的联系，而不是仅因过去的观众碰巧遵守某条规则就继续保留它。", // Supporters of restraint can therefore argue that waiting protects an artistic 
  'acc700a3597cad8197188daba733aadc24e4ab6d8fbf52b85cef8693348926d6': "如果安静的结尾与随后充满活力的乐章之间，夹着观众持续较久的回应，听众的体验可能会有所不同。", // A quiet ending followed by an energetic movement may be experienced differentl
  '3d8cf310221c32598531550414875ea8ec13f9138146b3336d0ff54a00a990d7': "表演是音乐家与听众之间的相遇，而不仅仅是将完成品递给沉默的接收者。", // A performance is a meeting between musicians and listeners, not simply the del
  'e27398ea175cecfc66d7e6207fd75e348d07debcf392ab580f83de712d4c96c5': "欢迎回应，邀请同样可以明确。", // Where responses are welcomed, that invitation can be equally explicit.
  '72ff1dbbe12ac29376e0fcef619a957fbabf56ad00a2f41881d579492b58e6b7': "在那个环节邀请观众鼓掌，不一定会破坏活动真正想要维护的结构。", // Inviting applause there need not undermine a structure the event is actually t
  '41a1c49f04dcbab59fe9809663e1b7268e93745c9641b806f6ff9b568d076917': "它只需明确何时集体响应适合计划中的体验。", // It can simply clarify when collective response will fit the planned experience
  '2e15724a7a4cd883fe95387d268ccf8b02c31821babd318403d2768d411ad5a5': "此类指导在做出决策前提供信息。", // Such guidance supplies information before a decision is made.
  '0a44c7c09acc66b8b4b528fa4dc4e916d9be45da101af5efa14fd5e760f01971': "沟通的程度应与它所消除的不确定性相称，既为个人理解保留空间，也让共同聆听时的实际安排更容易理解。", // Communication should be proportionate to the uncertainty it resolves, preservi
  'ca74bf746d551eb5da102aecbcda1dc6bf11cbd82091b4ac1676fdeebe262169': "在某些音乐会场合，观众被期望在完整作品结束后才给予掌声。", // In some concert settings, audiences are expected to reserve applause until a c
  'e03a16f8cbe9334ec5eb34d42e7e2a93282598cd0c9d76d7208e4f55afa571a8': "几何关系可以通过推理建立，而关于材料性能的主张可能需要在特定条件下观察或测试。", // A geometrical relationship can be established through deduction, while a claim
  '6a413f9e0893fa37225f9f770895c52ff2fe9d2c3d968dd6d7c7abfdb238870d': "教育应教导学习者识别界限，并因合理的理由跨越界限，而非将其消除视为一种成就。", // Education should teach learners both to recognise a boundary and to cross it f
  '781aa97d17b88269cbee5a271e5db82176a18334053f8db9108cc8db21a5d14f': "这是有可能的，但有学习动机并不意味着能找出所有欠缺的先备条件。", // That is possible, but motivation does not identify every missing prerequisite.
  '36d1b4dd898c2b2150bc18dd3fa5ffe6b8536d97277d9dcd26de2def62526779': "维护学科的严谨性，并不意味着主张让每一节课都与其他学科隔绝。", // Defending disciplinary rigour is not a defence of keeping every lesson isolate
  'fb0d45ffa1efce67f6c0fc45ac11bad2f295d86806f2c8eb86555862ac200da4': "设计一个包装可能需要几何知识、材料知识，以及关于视觉传达的决策。", // Designing a package can require geometry, knowledge of materials and decisions
  'b06c758d0c2a291be07ed58ef2589e32ebd056833052f81e4be24fd5ad781a6a': "一项同时引入陌生的几何知识、材料性质和设计惯例的任务，所需的协调程度可能超出参与者的应对能力。", // A task that simultaneously introduces unfamiliar geometry, material properties
  'f261fa415ab68ecb6a20f17f72c66860fb97506c6330e35a0b6e7362f7051eeb': "整合应以依赖关系为依据：一个贡献应为另一个贡献提供信息、限制或修正。", // Integration should instead be justified by a dependency: one contribution shou
  '424371d2f2add27121ae9d3d24d17abce067409ba57343d3abb93e13dd43b41d': "支持者可能会回应说，一个引人入胜的项目能激励学生在过程中获得所需的知识。", // Supporters may reply that a compelling project motivates students to acquire w
  '8f6a52a9389c633b6bc4b1ec1aa9123a6e7f8f415b8c9b2d2c0ffb0789eb7ca0': "协调教师和教材跨学科需要时间，而连接薄弱会消耗精力而不增加理解。", // Coordinating teachers and materials across subjects requires time, and a weak 
  '6c3ee7dbe613b23c144c67b36bdddd414506f67f45d7a84c77b24920532238b1': "几何学可以描述容器的尺寸，但不确定所选材料是否足够刚性。", // Geometry can describe a container's dimensions without determining whether the
  'd4a37ef605b58bae30af55c18bc8c42eaa0d7f7413df665bb021667360553a6d': "更好的做法是明确表达联系，同时保留评估每个贡献的标准。", // The better response is to make the connection explicit while retaining the sta
  'cb7a991924f878439edadec8e37acb286129490f7ac78a47616f4a6b59b7410b': "实际限制也应得到同等重视。", // Practical constraints deserve equal attention.
  '3eefee4c60a44ade3a294253d54fc5d371a63ba140984b06b476ea84ed2904fc': "这一主张是否成立，取决于这种安排是帮助学习者联系不同的思维方式，还是仅用统一活动的表象掩盖这些差异。", // The case depends on whether the arrangement helps learners connect distinct wa
  'c0fb8974f680818653dfeedb567f6f962bde537069b75703d58a21b8fe8bf9f9': "学校是否应该主要围绕跨学科任务组织学习？", // Should schools organise learning mainly around tasks that cross subject bounda
  '2087eb6bc713979e951f9e781f200c0ba5a382e5d58293209128ae79cca025d6': "诚然，学科教学本身也可能与其方法有用的情境脱节。", // Granted, subject teaching can itself become disconnected from the situations i
  'eb6754d19b59372930e323a9142bfb25718534f76ee62c34ffbc9a934f207317': "将这些学科结合起来，可以揭示为什么抽象关系很重要，以及在哪些方面需要另一种知识。", // Bringing the disciplines together can reveal why an abstract relationship matt
  '26d3797247807c1abbac37d913eb20feaf0cb06f3df4690cd123df3a43238110': "这并不保证意见一致，但能让分歧更清晰。", // This does not guarantee agreement, but it makes the disagreement more intellig
  'af017dc7c44ecdcf39d8a47c0caf38f93b7f3c596980d56982861537dc97899d': "选择最受欢迎的地点并不能决定谁能打开它、检查物品或安排维护。", // Choosing the most popular location would not settle who can open it, check the
  '242466af588a56660d800cff4a117e40a54a2616b9da4d7d812e9f61001f8750': "诚然，直接请大家提出保留意见可能会延长会议时间。", // Granted, asking directly for reservations can prolong a meeting.
  'd7b42f51e8aa0037f62841c53e27da8e5c1436c295ebb6318b609dc3c3a56400': "将每一项保留都视为等价，会掩盖寻求协议的根本原因。", // Treating every reservation as equivalent obscures the reasons for seeking agre
  '527a5066f354bec81bf6df29f97efa97d3590e1d0d5ba8b1233ef14e70cb1b65': "如果一个小组反复推迟关于橱柜标签的常规决定，讨论可能会花费比决定所需的更多精力。", // If a group repeatedly postpones a routine decision about cupboard labels, the 
  '636070fb749cfda4c5403962be2571e523dd202ebdf78de3b339ea26cfa1b468': "另一种回应是在常规选择出现前就授权范围达成一致。", // A further response is to agree on the scope of delegation before routine choic
  '9c4f44c9886e0ba26fd7327f0f4e6e00362acd9f5303b10c7fdcfe4c47f408c4': "在仍无法达成一致时，如实说明这一局限，比宣称达成了无人仔细审视过的一致更有用。", // Where agreement remains unavailable, describing that limit honestly is more us
  '25d13771d0ed6dd35d0be16f44917992e5516f29128a9ac34bc92d296a6ad9c2': "支持更快程序的人也有充分理由。", // Advocates of a quicker procedure have substantial reasons too.
  '99d1d6d945d162b5876b225ad8cf33422d1ae6c3b1e5e178e8a413f307983b89': "他们需要一个程序，使保留意见清晰表达，将讨论与选择的后果相匹配，并明确谁接受了相关工作。", // They need a procedure that makes reservations expressible, matches discussion 
  '803488c10ee35ba8f7dd704524992562bebe8386be03cd7b8584cf00c1a3400c': "试行可以减少在讨论中解决所有不确定性的必要，但实际上能否恢复原状，不能只是一句让人安心的话。", // A trial can reduce the need to settle every uncertainty in discussion, but its
  'bdd43e8cb5ba2c99e41b9f08fcc0cf2a311897ff7cb80f7705657a83ffeed241': "仅仅因为没人打断就宣布同意的主席，可能会误以为对程序的不确定性是支持。", // A chairperson who announces agreement merely because nobody interrupts may mis
  '430f3de4465ffb2863d95cd5c5609366992c1979cfd27f461a89908ed5158c91': "临时安排可以让成员在作出较长期的承诺前，观察拟议的开放时间安排是否可行。", // A temporary arrangement may allow members to observe whether a proposed openin
  '87654bd330ad6d4fce3511e6d2970ed99305ee6346fb17ed3c9f36c99e172778': "该选项仅在安排可现实改变且审查条件明确时才有用。", // This option is useful only when the arrangement can realistically be changed a
  '482903f65a2ba983d41f6ed965c483c9cfa63a2bdbb1fd886c6647790dd17354': "因此，一套旨在纳入各种观点的程序，可能因其对参会和留到会议结束的要求，而把一些人排除在外。", // A procedure designed to include every perspective can therefore become selecti
  '1952f61489174f951057ff395d7f297207349ec4c52cac7037a07b97d2b0d6a9': "在这里，争取大家认可很有用，因为参与者各自掌握着实际职责的不同信息。", // Here, seeking acceptance is useful because information about practical respons
  'b1e97518687ac912ac7b17e9493cbf43b2f4ff4cf0f04026332275034dee30ed': "社区团体可能在会议结束时有既定计划，却发现没有人愿意执行。", // A community group can finish a meeting with an accepted plan and still discove
  '2a677f4fb3833160b48a1769bbafa4e18d468488bcdc4e43b7beb8f36c2f338a': "上下文，包括场景变化和任何书面说明，帮助读者重建时间顺序并判断时间经过了多少。", // Context, including changes in the scene and any written captions, helps reader
  'ae9acd2cce5cc801410e449ccee3cb44d248ea57f854bfcba5fddebc2c130657': "漫画可以通过静态画面的并置讲述一个连贯的叙事。", // A comic can tell a continuous narrative through the juxtaposition of still pic
  '57078b111f7a2331fd7c17b687d9d11d4be62a9c0e44d5bbdb5879470e844a6c': "空间分离和时间持续时间不是可以互换的测量。", // Spatial separation and temporal duration are not interchangeable measurements.
  'd5f16e87452b8e9c49cb1acb2a60e71a6ab26edd7819320144159649a3e6cbbe': "没有这些线索，几个无关场景看起来同样合理。", // Without these clues, several unrelated scenes might seem equally plausible.
  '40a3b1dd8e9d80889e1bfb79163fcf85e9cbeea2fb2375ba8a58ae3a588887ea': "这种可见痕迹与主动解读的合作，赋予画面间空间隐含的叙事功能，而非仅仅作为闲置的纸张。", // This cooperation between visible marks and active interpretation gives the spa
  '210d66dc7ecdbee4a541bb6d4b48ec7df82e09a0a3701d16d96804bde6d732b7': "这种推断依赖于上下文线索：杯子及其周围的连续性表明这些图片属于一体。", // Such inference depends on contextual clues: continuity in the cup and its surr
  '60e835c331ffe2c3a38d139001fcec866fe0745523d4aa583c92849102fa784b': "这些位置之间的旅程被省略了，但序列邀请我们补充它。", // The journey between those positions has been omitted, yet the sequence invites
  '6ec8fa4beeb2898e5c3bff3c8b9968f150d0ba32bcca476063bc42164b5123b9': "缺失的区间没有固定的持续时间。", // The missing interval does not have a fixed duration.
  '5082099f958209a6fbdfa6c62fd064b62c01a257d084e7d099f347746de800c0': "读者通过顺序推理连接这些碎片，构建艺术家未曾绘制的事件。", // Readers connect these fragments through sequential reasoning, constructing eve
  '0efb41637e39ed4e36e6fd2d19bed85dec3060020a10b66699a57f34b65461ee': "因此，有效的叙事应在画面简洁与充分证据支持预期解读之间取得平衡。", // Effective storytelling therefore balances pictorial economy with sufficient ev
  '65c27bde0434706477949699800df5f1b02b426a553c98c2b0e92f8218ea292a': "省略也会影响重点。", // Omission also affects emphasis.
  'b467a9150379e4abbcff27f0b3aff4fb9d00a2290eb76e184bf3d9ff19a7f1d9': "绘制普通动作的每一个阶段可能会拖慢故事节奏，却没有增加有用的信息。", // Drawing every stage of an ordinary action could slow a story without adding us
  '6f237f5910f62a9ffef30abd75413b5a98b4c3a7aa18f26dd503d2e59905db9f': "电磁感应在接收线圈中产生电压。", // Electromagnetic induction generates a voltage in the receiving coil.
  '4fe9f687f1afe8163fee3d4940dde0564e146db34712e2cc0f2e7457db435ff2': "充电底座内有一组导线绕成的线圈，交流电流在其中流动。", // The pad contains a coil of wire in which an alternating current flows.
  '29c12ff5b36906ba235d79c4cdcb311096863c46aa8aed82880c7e7a61fd9b50': "它们的对齐很重要，因为场域必须有效地将它们连接起来。", // Their alignment matters because the field must link them effectively.
  'f4766b3765b7d473517f8ba3af38ae70bfbb4097922030ac3b30230dfe806796': "“无线”描述的是某个特定环节省去了连接线，并不意味着不再依赖电力基础设施，也不意味着消除了能量损耗。", // Wireless describes a missing connection at one particular point, rather than i
  '8e18d61dd241a807999a265cb077bee9918c5d01bcd6419849a71232bbbc5395': "因此，评估这项技术需要沿着完整的能量路径，包括我们看不见的连接，而不是仅凭插头的消失来判断便利性。", // Evaluating the technology therefore involves following the complete energy pat
  'def9e1ed8a26183bfcc6d6efeb5ec38da4ab810f3694e89ce3fef8e6d40be67b': "在常见的电磁感应式充电器中，能量通过变化的磁场传递。", // In a common inductive charger, energy is transferred through a changing magnet
  '4a0521c9eae02e30746ed32a99f0a417e92417bfda8f19fcbabd378610716e3d': "充电面必须在合适的位置容纳接收设备。", // A charging surface must accommodate the receiving device in an appropriate loc
  '81fb1630575ada0814218d4f96556b02765636c448f7aee41d9bb767a845ad8e': "因此，充电底座并不等同于覆盖整个房间、可供附近所有设备无限取电的电源。", // The pad is therefore not equivalent to a room-wide source from which every nea
  'e050e4c404cd75a6949922f117e47da2b92340664c3166dff3655d57849bd602': "然而，这种优势也伴随着位置上的限制。", // Yet that advantage comes with positional constraints.
  '6968ffca4ece6288a33d2f385425b4521f62155ab1be5e3434a764b171cf89ea': "将手机移离预期位置会削弱该耦合，减少接收到的能量。", // Moving the phone away from the intended position can weaken that coupling, red
  '06a70aa54fcce94c8b6e38cfe2f1b4db770aa665a1bb519b400fef4f09303bc5': "因此，该原则描述的是趋势，而非僵化的规则。", // Consequently, the principle describes a tendency rather than an inflexible rul
  '6abfee3ef0bb221514666f366ba228d150712c8b78444594f79bbe4b04921566': "它们表面上的组织方式说明了邻近性，这是格式塔心理学中描述的感知分组的一种成熟原则。", // Their apparent organisation illustrates proximity, a well-established principl
  '29faf52dbfb7ef98477030ba9b95f68a8214879dd66a49ee7d8b8f3e56719c32': "感知的统一性和实际联系是不同的主张，即使前者让后者在直觉上显得合理。", // Perceived unity and actual connection are distinct claims, even when the first
  'fb5cdb35a6139cf1b03ef7ec969634277e995e63aae14c90c236ec871b2fbb05': "比较将空间排列视为对感知结构可能的影响因素，而非将变化归因于不同物体。", // The comparison isolates spatial arrangement as a possible influence on perceiv
  '65d94bbbf725fa8c90cd04f8961302ec00803ff127da2d45e22447dca304bc08': "如果水平间隙比垂直间隙小，行状可能更明显。", // If the horizontal gaps are smaller than the vertical ones, rows may become mor
  '64835d2ccb5ce24bb69f0f618008bdbea7533442023ecc4ee3c584d7351d8ee9': "现在想象同样的点排列成一个矩形阵列。", // Now imagine the same dots arranged in a rectangular array.
  'c037d964096838d9a4f658ccb949238ab0bfce84489d7712e5a05fa59fb187e4': "相似的颜色、共同的运动及其他关系也会影响感知，有时甚至会与空间上的接近程度相互竞争。", // Similar colours, shared movement and other relationships can also influence pe
  '778925464050bf7819061da817281ef65bcc1dd03b75d146fd589413886b3f66': "设计者可以利用这种倾向，但读者仍然需要语义证据。", // A designer can use this tendency, but readers still need semantic evidence.
  '2157b279fcd9346c77264466205c156a4d70f36a76ce8ab8b624a9f2e53a517b': "根据这一原则，彼此较近的元素往往被感知为属于一体。", // According to this principle, elements that are closer to one another tend to b
  'ebc10435b07bb36210a04ba0e5c81cc1efe361a02e4b5964b30dee38ec768b9a': "一段图注如果离一张照片比另一张更近，就可能看起来是在说明较近的那张照片。", // A caption placed nearer one photograph than another may appear to describe the
  'cc2859488a30cab182f8813a5b65d493e424b2c51c5baaa9af229f9f22724f8a': "在阅读一页信息时，这种区分非常重要。", // The distinction matters when reading a page of information.
  'c6a25be0079c95ea9cbc237624d490900441ffef2025219b05fa42ce3778dbce': "视觉系统不仅仅是记录单个位置：它将它们组织成单元。", // The visual system does more than register individual positions: it organises t
  '97db89c7dd81f4aca81c82ccd70aa09068ebcd07e8469f8640e2cdcab9524ab0': "在盲文出现并可供使用之前，一些供盲人阅读的书籍使用普通印刷字母的凸印形式。", // Before braille became available, some books for blind readers used embossed ve
  '63fc2d3109ad66d3b09b99ea154477d92ad2aa2ede037be37d0b585dae781676': "手指可以沿着轮廓滑动，但设计成肉眼识别的形状，触觉未必能辨认。", // A finger could follow their outlines, but a shape designed to be recognised by
  'f30473a51bb7cc6edd3dcbc89df8b40d26a45ce77cbccd447ff926e93860cc23': "标准是功能性素养，而非与传统印刷品的相似度：用户能阅读和创造什么？", // The criterion was functional literacy rather than resemblance to conventional 
  'bc02009d0907ddac3e2cc6c8bcdef394157c1cc7c033d0bbd2bfccafcb6b59bb': "不同点的配置代表不同的字符。", // Different configurations of dots represented different characters.
  'aa600aceace52ddb1c0a633d6cbf63c134405a4c7e338fe0224387dbcd7984e3': "19世纪的法国，路易·布莱叶发展出一种系统，围绕一个紧凑的单元格，由六个可能的凸点组成，排列成两列，每列三个。", // In nineteenth-century France, Louis Braille developed a system built around a 
  'b7396e8ce40748705ce5b754a1397e612ee79144fe338045938cb62344cc0722': "因此，这些读者也能自己书写信件。", // Recipients were consequently able to produce their own correspondence.
  '0cf243b515f483a248704fca4da9524ecab3f6c96c50583be37bea6bc98f87e1': "读者无需描摹排版字符的完整轮廓，而是能在这个小框架内辨别出图案。", // Instead of tracing the full outline of a typographic character, readers could 
  '39ee7465448412fd1c0cb3df2acddcfa75997fe525440838c5bc8480d6f3eeea': "该系统改变了符号的结构，而不仅仅是扩大已有的视觉形式。", // The system changed the structure of the symbol rather than merely enlarging an
  '3324a654552060c6ec32de2f315a24757b6e8b146cdd8e23d000ca3d2e9faf87': "它们的含义取决于公认的编码规则。", // Their meaning depended on agreed encoding rules.
  '815128def9819c2fce931a74d0dabaa976a6899462dbfcc0bb1e210b0104fad2': "解码这些图案仍然需要学习，就像学习普通印刷需要的不仅仅是看标记一样。", // Decoding these patterns still required learning, just as learning ordinary pri
  'd7c1d780d8b5a4e8036fd0122108667d07c8654c411adf33c358482d7eed5752': "区别在于，是只能获得可供触读的文本，还是也拥有便于自己写作的手段。", // The distinction was between receiving an accessible text and having an accessi
  '8b900fb7c4efe2bcb63690529874de929558e9d8067b2bab82e7fbff66b796a9': "语言可以根据自身的写作惯例使用该框架，因此共享一个基本单元并不要求所有语言都有相同的规则。", // Languages could use the framework according to their own writing conventions, 
  '94d90e140c922cdf43ef2af81c2120056e4ed26d4491c1b3dcbc9c390be34711': "写作是发展过程中另一个重要部分。", // Writing was another important part of the development.
  '4e409c8a918837b2bcbdce00f8c5ffb61fec84b5bf3954bae64ad715c15fe3c7': "凸起字母可以为读者准备，但用简单的手工工具制作复杂的轮廓非常困难。", // Raised letters could be prepared for readers, but producing their complicated 
  '891f532ced426d3fcb9a45d7a1b718e06aade1d67204169203afd9378686d026': "这些点是代码中的位置，而不是描述事物的微型图片。", // The dots were positions in a code, not miniature pictures of the things being 
  'f68866c440f8a932eed8cb16a93d746d853601564ab69c20f397b0f6fd56dc45': "用简短的释义替换原词，可以发现一处不匹配，而在孤立看待这个词时，这种不匹配原本似乎无伤大雅。", // Substituting a brief paraphrase can reveal a mismatch which seemed harmless wh
  '6a67230af56a7e9ef6e3dbf19fd578b3c07f0e37259d45fb45a46be7bf2a33aa': "选择意义后，学习者应返回完整句子并检验临时解释。", // After choosing a sense, the learner should return to the complete sentence and
  'cb4eb7282b2b7f120ba45590b6dda83de17a9d3346500d123b813d1a6adf730b': "因此，不加审查就选用第一个释义，可能得到一个合乎语法却意义不当的句子。", // Selecting the first definition without scrutiny can therefore produce a gramma
  '20dea74b9658d8650884c43ca850d5277031d92769ba01c83f20b25981d42509': "保留所有释义可能只会增加笔记数量，却未必提高其语义准确性或语境适用性。", // Keeping every definition may increase the quantity of notes without improving 
  '71e12b045f97a8ff18f4d8b18ea36735f5a2a85727568be23946728477f3e45e': "熟悉一种用法并不意味着它与每次相同拼写的出现都相关。", // Familiarity with one use does not establish its relevance to every occurrence 
  'bf480a090515d93cadc0cd615c1e3845a53005339653aeea9618fd31db6bbd36': "目标是为某次具体阅读中遇到的用法留下可用记录，同时留出余地，在以后的阅读需要时再学习更多词义。", // The aim is a usable record of a particular encounter, while leaving room for a
  'e95a23f809f3763c58f49ce300335953b9ce0e2824581ade8720fa9c41288440': "有效的词典使用涉及词汇消歧，依据上下文证据而非定义顺序。", // Effective dictionary use involves lexical disambiguation, guided by contextual
  'fc5397568cbe7ab74674f78d3da17fc221ae242066c7c5b6e34363fd56b280b2': "当最熟悉的意义被自动选择时，这种上下文验证尤其有用。", // This contextual verification is especially useful when the most familiar sense
  'cb1fcdb629d8bd15c1305eb3114192ef873f718e8a54defdaa86884073b001e2': "草稿可以是一篇写作的未完成版本。", // A draft can be an unfinished version of a piece of writing.
  '642684a301d2ab15b316288ba0f38770bb87f33fb44f752bebf03a5346ddd2d2': "有用的词汇笔记因此会记录一个词及其意义，短语展示其用法和相关语法信息。", // A useful vocabulary note consequently records a word alongside the sense neede
  '22f5791040f47b5af8a78b665eb9112e416a15933f5c6b672768217aa9ea09cf': "词典条目可能包含多个意义，每个词义描述不同的用法。", // A dictionary entry may contain several senses, each describing a different use
  '24005251d9f1bfc935a8040c92358a9daba8f1a22d9ba35d6472efe92412eb0c': "回来时，我立刻注意到咔嗒声，然后随着阅读逐渐变得不那么明显。", // On returning, I noticed the clicks immediately, before they gradually became l
  'bd17a1f9c89a440593d63dcb5bd34f5bfd8e4c63d2db85ff6fb95cd5085fd0e6': "这一次，我能分辨出房间更安静的迹象，还是我注意力转移的迹象。", // This time, I could distinguish between evidence of a quieter room and evidence
  'ba7952b42fd7cd6b9720fd37b44ee222c6a763f47bad10d145ac2e6a6a922294': "在笔记里，我划掉了“无声”，改成了“较少被注意到”。", // In my notes, I crossed out "silent" and put "less noticed" instead.
  '9927c47c6547ec052b35dba7ce670225a9ee46155746111ade6e804d06c40841': "我仍坐在原位，每当声音打断我的专注时，就回到同一句重新阅读。", // I stayed where I was, returning to the same sentence when the sound broke my c
  '60d5d39356a2dee309d354fe1ba46a6f6becf6310ad076230fa5f121ac4cd891': "她没注意到声音的音量有变化，虽然我的反应似乎不同。", // She had noticed no change in its volume, although my response seemed different
  '25a36f002e655989f5c78a409be0b47b751310372c3555e38e19b469801dafe0': "在我第一次进入阅览室的下午，桌旁的钟似乎无法忽视。", // On my first afternoon in the reading room, the clock beside my table seemed im
  '43558f605bf3929ec7dba160780761873094a6e0aa5367759b37b2131cb6c5c9': "我的朋友一直坐在我旁边。", // My friend had been sitting beside me throughout.
  '76549ce6430bef1082671b48a38112103325f83f344fc41b011deee10d9ce1e7': "老师解释说，已经减弱的反应，在离开一段时间后可能会恢复。", // The teacher explained that a reduced response may return after time away.
  '037751cf32161c95772fa02d743ec6c224de4772dbda6d727e4a4cbb528a9124': "我们的老师称之为习惯化：当某件事重复且不需行动时，反应会变得更弱。", // Our teacher called this habituation: a response can become weaker when somethi
  '9a5320f2825a05af35a7e90b1cd5ca4b61dd4b92152fefd356fbaee5e18a1aa1': "这并不意味着声音本身发生了变化，或者我们听不到它。", // This does not mean that the sound itself has changed or that we are not able t
  '803ebb2ffda1084ba990137db0f91b732c88589240c3aa68b8ccc57dee8cbbe3': "每一下有规律的咔嗒声，都会把我的注意力从老师让我们阅读的故事上拉开。", // Each regular click pulled my attention away from the story that we had been as
  '4eb16482eb5b870d856d43df9eae498c5e377e3bdee4333336e7c57835f8a6ac': "渐渐地，我开始专注于故事，不再等着每一下咔嗒声。", // Gradually, I started following the story instead of waiting for each click.
  '45f385fa8bf97036a47a44a55743865a13d2f97b724cfbc97cb3f979ece24704': "时钟没有被调整。", // The clock had not been adjusted.
  '7adefa7835731f108e6ecf56d26679b6e1e5c4f42f501f33deecc65e62b0f9b5': "第一个词描述了这个房间;第二个词描述了我的经历。", // The first word described the room; the second described my experience.
  '42e81ac24f1b4d17cd18ffb4592433315a349b3be25a437599144d41af164438': "当朋友问起钟时，我形容它更安静。", // When my friend asked about the clock, I described it as quieter.
  'e583ebbeb6ceee932b28d8952c31ccef3b011d4058b08ec0eab2a6ed2c8b3738': "其他座位都有人使用，所以我无法换到别的桌子。", // Changing tables was not possible because the other seats were in use.
  '7e710d7b74a2f2afbd1388436cc64bfbe0b73cbbe02e2f34ad0078ccdb037fc9': "这种安排让书留在固定地点供人阅读，但并没有消除所有因书本数量有限而产生的问题。", // The arrangement preserved availability in one place without eliminating every 
  'c899682fa16e446d0747de1409ea9a33491dbdb716cdb2803d8ab44a20fe43ae': "相反，它被固定在封面上，长度足够让书本摊开在桌上。", // Instead, it was attached to the cover and long enough for the book to lie open
  '1262e78f89befad32c8630b807e4d0bb10b98ba29c53b778b2c9b556a81da5de': "老师补充说，该模型没有提供关于进入特定图书馆的历史规则的证据。", // The teacher added that this model provided no evidence about historical rules 
  '7333b55053e44a030c7986c3446d5ae71a9e0636dd8f1f3a6352b8e7bc87dc8c': "我们的任务是为小组策划一次阅读活动。", // Our task was to plan a reading session for the group.
  '7e7185453519a69ede693c6c1f06e5c50013f1c22e7c59d4ad25cf25a173d8f5': "它限制了书的移动，却没有阻止读者阅读书中的文字。", // It limited movement rather than stopping access to the words.
  '807169dfc79c33e02411021ea1b3af644232dae2f03057e23cd5e7dda10ae618': "这本书是一个现代模型，展示了欧洲一些图书馆过去曾采用的安排。", // The book was a modern model of an arrangement once used in some European libra
  '4262910cb83f552c762b7eae4efa343b91d9d3599d34ff2425fd286b68028089': "在书籍多以手工抄写的年代，制作另一份副本需要相当的时间和技巧。", // At a time when books were copied by hand, making another copy required conside
  'd4a9a22ab7580bd5e93a7aa57082eab51558fe165aeb7dd0cedd518ff82e1522': "在一次历史活动中，我们小组看到一本大书被拴在木桌上。", // During a history activity, our group saw a large book chained to a wooden desk
  '3372f32074c668efbaee5fc0b2e066efdb7e1a92b63d677e48d25ecce4b86cac': "那样每个人不在时，桌子就会空着。", // That would leave the desk empty while each person was away.
  'dbe654aa3efcb8679695cb38d0e4d9d607d11c07bcc95e5fc3afe80c8995f6f1': "我原以为链条会让书的封面一直合拢。", // I thought the chain would keep the cover shut.
  '0d72b4b62a2a9547139eb3de6b9531e23fdf9b602ccfa9afc84bc786c2b16acd': "书留在原处，第一位读者离开后，另一位读者就可以使用，不必等书从借阅者家中归还。", // With the book in place, another reader could use it when the first reader left
  '8340b316b193e5f09df25a598511e4f9d743510e2ecd7dc7fa25c5d59758ddea': "我翻了好几页，链条还系着。", // I turned several pages with the chain still attached.
  '19093334e5558eedc2e5367190bc68055d9e5f2877796f1145fbfb36619a7232': "这些都显示了我的理解，尽管算术没有变化。", // These showed my interpretation, although the arithmetic remained unchanged.
  'add64a31bed003ca304ba30c7cfb8d8925e654c3ff5b33e9d38954547fbb5b88': "这个问题需要比单纯读出数字更长时间来回答。", // That question needed more time to answer than simply reading the number aloud.
  'af133ff04a7dd0e69daa1d26978fb03540eb00200cb233e51121709dff0a7b6e': "数学课上，我通常通过重新计算来验证答案。", // In maths, I usually checked an answer by doing the calculation again.
  '5e7cfe57e2eae3d2c7c35ae2eca9c3c89339c035522148456be24773a14522b8': "计算方式没有变化，但答案表示的量不同了：前者是每桌的卡片张数，后者是包数。", // The calculation had not changed, but the quantity represented by its answer ha
  '6eaa3ee8fd44beabb9c77689deae8397d589c40a776b3920d84e324ede4f4136': "我们用纸质卡片来分析这种区别。", // We used paper cards to examine this distinction.
  '153d2c2074354d60eee6cb6dce81ce8f40f4ba1d86983b8f3c0259e493905746': "在检查解题过程之前，我先问这个答案表示的是什么量。", // Before checking the working, I asked what it measured.
  '93eb887eff7578dec41ce762bdd74294e7b7afde1b8955ba18e0339e96fab8d8': "解释统计内容需要我们回到问题本身。", // Explaining what was being counted required us to return to the question itself
  '2fbbcf24b59cbd6008ee7db3f5c65041f74d0f22f2e80699fafab4328a0608b1': "在第一道题中，卡片被平均分给六桌。", // In the first, they were shared equally among six tables.
  'e051f34a2218d5dbc2ffde52d6e0c7f740624a2fa386289cef28929f8baa8a23': "如果数字保持不变，我有信心能解释问题和方法。", // If the number stayed the same, I was confident that I could explain the questi
  'a1de2eab5e21181650bb024cee97567d19d434e04c1d398f94baa25690f3d6cf': "在第二道题中，卡片按每包六张装好。", // In the second, the cards were put into packs with six cards each.
  '56d85afdf735c63f1f3fbe95ff8bab82dedea35eb54b37e0fd0d5dbd98b27d2d': "我又把24除以6。", // I divided 24 by six again.
  '8ba9bb4bf1a445bc97a7c977926fbc4ee9333f081c952d963be335b2443cd337': "我的搭档问，第二道题中我写的数字4表示数了什么。", // My partner asked what my second four counted.
  'f822a9e6632b2c7f7091cd747c2ca8aced66c3698d89f5c878acd723cc2c1655': "后来，我的搭档给我看了另一个答案。", // Later, my partner showed me another answer.
  'b66a3bde43873b68e7b059392147a13ebf23c2da48862f2e51f9f0cc2c63be18': "第一个问题，我们创建了六组，并在他们之间分享卡片。", // For the first problem, we created six groups and shared the cards between them
  'f9d9915a809e544ef9bd29745ba1b19bf3bd08a65cbc59f4240127d0876296bb': "布料显示的是他们的轮廓，而不是上面涂的颜色。", // The cloth showed their outlines rather than the colours painted on them.
  '1daf199cf15d8d3f07e15ee52cc7f2c1ea89b974f0c7780fa120979ecfeb6053': "猫在走到树前停下了脚步。", // The cat paused before reaching the tree.
  '8c0d09e0d33339ebee127ab3a73a20e3f5ea6a521c070dae898dff9e267fb6a4': "叙述者坐在一旁，观察他们的动作，同时讲述故事。", // The narrator sat nearby, watching their actions while telling the story.
  'd63806c4ec3ffcb5672e95d350672a932409841faa94b2662692da1e24dcb139': "知道有杆子并没有减少我的兴趣。", // Knowing about the rods did not remove my interest.
  '1cb814c66a70f130ede97ccca3044d5cfd5840f39e94a4334e8d8373c2aa7942': "他们的配合形成了一种节奏，而我之前还以为那只是一个简单的动作。", // Their cooperation created a rhythm that had seemed like one simple movement.
  'daffe395434b5340e32c9ce17dcd6aea2d5dfb22b33e6be3ae1e5069dca638c2': "它平稳地经过一棵树，伴随着一个声音描述了旅程。", // It moved smoothly past a tree while a voice described the journey.
  '11c12913d02d28dff35ba083fac7801486a0f641901de9cb159786e4777ef6c5': "一块白布横挂在房间中，后面放着一盏灯，前面摆着椅子。", // A white cloth was placed across the room, with a lamp behind it and chairs in 
  '8c0895ed8f34c6f2c57550952005ff12f4cca6cac6715f683ced933ff6363eaf': "现在每一个流畅的动作都暗示着那份无形的细致工作。", // Now every smooth movement suggested the careful work that remained invisible.
  '645d43f3a4bb10fb290d432a59ed2a2ccbb636737ed1b5882be2e94915bd3c23': "布料被放下后，我留下来看着那些人物被收拾。", // When the cloth was lowered, I stayed to watch the figures being packed away.
  'e4265b6291fb2cfafbae59c701bc3ea34bc2915348b35aa26ee56daa3b3d891d': "在一个艺术中心，我观看了一个影子剧团准备一个短篇故事。", // At an arts centre, I watched a shadow theatre group prepare a short story.
  '93530eda4a33b8a939b054e1b38603e18d17b83fb2e130993dbe834955ca1e06': "从观众席看，这些调整都看不见了，眼前只留下故事所需的影像。", // From the chairs, these adjustments disappeared, leaving only the shapes needed
  '69ce7fd179016a63f2d57b6e877d63b49cef21e3450976db23978c85b3693370': "排练时，团队邀请我们到布后面，我本以为会看到一幅巨大的画在灯前掠过。", // When the group invited us behind the cloth during rehearsal, I expected to fin
  '17b8d8fa9ec9973a5396837d8a7fa8fdc4e223cb43676a8d7a50925d1ad16004': "取而代之的是，不同的人物被固定在杆上。", // Instead, separate figures were being held on rods.
  '0e7a7c08d2997d69241e154a8f6c115c8318fa4219af90bd1a58cabb9123b2cc': "故事已经结束，幕布上的最后一个影像也已消失，但大家共同完成的幕后工作仍在继续。", // The story had finished, but the shared work continued beyond the final shape o
  '08049e69c0065792eb6bceb6c7bd5409c8f677d003554f2eb24e0f46c8bf6452': "从背后我看到人们换了手的位置，彼此让开。", // From behind, I could see hands changing position and people making room for ea
  'dc2f22b3c2fee41b6d9749a93bdb4117d4c381b2193ab42b891df380819dadf8': "在我们的机械按钮内，按下时两个金属触点相遇。", // Inside our mechanical button, two metal contacts met when it was pushed.
  '4ae4a402d073e3f7295aca828045a91ff4e9d357815b0c1f4cfd012309529e8d': "我们在报告中包含了计数器及其限制。", // We included the counter and its limitation in our report.
  'ab19c97e7dc611ada250e41788340fb685c94bffb376d2e3b1b36c53fa99f61d': "我们的电脑俱乐部制作了一个简单的计数器，配有一个按钮和一个小屏幕。", // Our computer club created a simple counter with a button and a small screen.
  'f64ca006ad57db37ab26a278a8060f7639170275af4a6477f4eb828d8a490ec3': "我们修改了规则，要求新的输入状态先稳定保持一小段时间，才予以接受。", // We changed the rule so that a new state had to remain stable for a short perio
  '1153d6e778d6affc12b2870f25bf8a0ac42d25d46de758333cd266e34d93e0de': "按钮并不能保证这一点。", // The button did not guarantee this.
  'eaf3a15ba362caf32d6abb734a238c03fb97fd549aa96df66078df01d675d945': "我们曾假设一个人为的行为总会产生一个干净的信号。", // We had assumed that one human action would always produce one clean signal.
  '27a159153b532021dd71fa829e05ca1a5f54ee6476895d6be89a2c4b551b5a6b': "一次按压即可快速完成多次连接。", // A single press could produce several quick connections.
  'bcff051ec4a3e97824c9e1add2a99b95ddeda6e2f490861334affca6c1db2245': "修改规则后，每次正常按键都会让计数值增加1。", // After the change, each ordinary press added one to the number.
  'a72273d04c4958aac842fea6cdfce154f9dacb5a1c7c4c26964d19c03c31abdf': "短暂的状态变化会被忽略，而不会立即计入总数。", // Short changes were ignored rather than added to the count at once.
  'ce39b70a192db8a8e503dca85c830db380141950bfa1d7dcc73ecd80099cfad8': "每按一次本应让计数值增加1，但它却可能一下增加好几个。", // Each press should add one, but the number could increase by several instead.
  '9bf51ea233778007c4f7df9ecee986521312d1667ba2fdbdb9adcc7694d6e748': "虽然我只按了一次按钮，两个金属触点却可能短暂分离后再次接触，随后才保持接通。", // They could briefly separate and meet again before staying together, although I
  'f9407d804bf9b4ab565f1813c05841e050a681872278e2467f535141a1d6358d': "老师解释说，这个程序是按照我们的规则正确执行的。", // The teacher explained that the program was following our rule correctly.
  '0d3c072eeb1bfac8906b295c4a6ed5d764546586c48a51d3da737e5d43fe0d7d': "因此，等待更长时间不一定是更好的选择。", // More waiting was therefore not automatically a better choice.
  'dbf53cc6d6b513cfb174507a689875fdedc8f64cd2bcee567e585b52965b826a': "我们的程序将每一次新连接作为单独请求，以增加数量。", // Our program counted each new connection as a separate request to increase the 
  '5e08cfaeac73d565f8e62b3d71db04b2b7a683a603055225ce22019e687c5da9': "我把责任归咎于显示屏，虽然数字显示得很清楚。", // I blamed the display, although it showed numbers clearly.
  '33492fefb584d51a6aeea4815e9af6439c05e1cb11323b9a66c4702eb4b921bc': "我们把这些变化都记录在电脑上。", // We recorded these changes on the computer.
  '438abbc729e864bd264121fb113d593c8d2e96669c3f27ce12109467999f5560': "回看上一行，我发现等式两边减去相同的数值，恰好就会得到这个结果。", // Looking back at the previous line, I noticed that subtracting the same amount 
  '2c6d39969fbac999883ec44159873063acbf10854f17729869a4cf538a7fa351': "对结果的共识不能替代对结果如何获得的连贯叙述。", // Agreement about a result was not a substitute for a coherent account of how it
  '6dc6a097c5dfddef3297e23b531a51e36ff91a5b9f50ea918bd0d3caec3b49fa': "我的铅笔悬在纸上方，测试着这个说法。", // My pencil hovered above the paper as I tested the claim.
  '32bc7ad506c880072ee377566933eee8ad0d34c678a7457b0daa01c4cc705f2d': "同样，复制熟悉的模式可能掩盖需要检查的假设。", // Likewise, copying a familiar pattern might conceal an assumption that needed c
  '772091c473ba0d475e41881875badf28541167f1bc13911ded3b9038421bc9b5': "既然答案已经核对过，这个额外的任务看起来就像是在装饰一栋完工的建筑。", // Since the answers had already been checked, this additional task seemed like d
  'ec124197f20ae42b070b41e83e503a4dfca22eb1ff5ed2e135093a99c9f30d4a': "然而，当某个步骤看起来显而易见时，我停下来问，是什么让它合法。", // Where a step seemed obvious, however, I paused long enough to ask what made it
  'cca110a7541dc8d4694dbb1b8617227b91a193874a9ae76a14b863b80bdf9fa6': "像减法这样的标签可以说明发生了什么，但却无法说明为什么允许这样做。", // A label such as subtraction could identify what happened without showing why i
  'd5e8007abc800bf1d60452d0b2cc14ec73cc437ff008f95bd03a23f24a6f3e75': "另一些解释则需要加上限定条件。", // Others needed qualifications.
  'b0bf31d034f10c014caa24a39e1345d0946af20122b493e308f9b16cb1e4cc47': "除以零没有定义，所以我的那句话需要加上限定条件。", // Division by zero was not defined, so my sentence needed a restriction.
  '8b4c9b9ef4a410aa6b196d65b85b5f1482a0d66ffcf31af1863018a6074a7eec': "两种解法都有充分依据，尽管中间的演算步骤看起来不同。", // Both could be justified, although the intermediate lines looked different.
  '20711488b48a91225cd5603eadc081e73e5b9c5ff70cafbe17a5bc2565fb03c9': "我们比较了各自的解题过程，并没有认为必须用一种解法取代另一种。", // We compared our pages without deciding that one route must replace the other.
  '6beb69757e010eab0e83ebbe11c9898870549e2b130d5211025355ea4849d78a': "然而，对旅程的描述并未说明是什么授权了它。", // Yet a description of a journey did not explain what authorised it.
  '43ec72feeb1871c11ebd3e851928f76267cb67585fee1f65243a187425e7aed0': "她转而问，对等式两边做了什么运算，才会产生我所描述的变化。", // Instead, she asked what operation could have been performed on both sides to p
  '786e6f793b1abf0d13f8ede5fca8edc35834c2b9a466b476f5c9add95f7f7f1a': "它提供了一个让我们实践背后的条件得以显现的空间。", // It provided a place where the conditions behind our practice could become visi
  '2780914401f4b067a3a2b00f895596370f626e99b26438ced56a975e90f5dc8d': "这描述了页面上呈现的内容，却没有解释这两个表达式的值为什么仍然相等。", // That described what appeared on the page, but it did not explain why the two e
  '956a827c315676c129e000d5fea3c1f07b168a59a83ba0af07a79183a3c6156c': "这一区分很重要：方法不会因为与示例不同而失效。", // This distinction mattered: a method did not become invalid merely because it d
  'd1a5387c86094b8bf43ac9ff1290b51c86f5936e8cb032842ddd05bf6ceb8a1c': "这种模糊性涉及隐含的惯例，而非无法系好布料。", // The ambiguity concerned an implicit convention, not an inability to tie the cl
  '2561634f3c0cd80abdd5b9149d93e0846cd6f36e466ddd6a0cbd4cd1ffdbd426': "礼貌需要澄清，因为行为背后的意图对接收方来说不一定明显。", // Courtesy required clarification because the intention behind an action was not
  '06a28bf13ffae5f227aca54f29333da9e3947bbc15d0e03dd79f087d52fddeec': "我急切地想看到包裹被打开，离开前检查了两遍结。", // Eager to see the parcel opened, I checked the knot twice before leaving.
  '978d01abb3dd2ccbabadd801f9173b007b7a0a7652a02e7ddaab6f47ec1848e8': "她的举动表达了关心，虽然我最初把它解读为拒绝。", // Her action had expressed care, although I had initially interpreted it as reje
  '1492e030d9749d17619002c262cd0ba612668d9ae3279fd01043796985cc1b0f': "一个整齐的包裹藏着未完成的对话。", // A tidy parcel had concealed an unfinished conversation.
  '4a38842c5828fa932fb24f9eb3623044ce8235c8cc3dc7333ab2268f63b2eb76': "无论我绑得多么小心，织物本身都看不出这两种期待。", // Neither expectation could be read from the fabric itself, however carefully I 
  'f0df6f9ba537fb1a5cba6989247abb56ba3506e2388ea42b43ba3e8c45c5282e': "个人相遇可以支持对我们意图的解读，而非对文化的普遍规则。", // A personal encounter could support an interpretation of our intentions, not a 
  '0ddf7b524ff39daed5754aee6d228c2ef9bc4d1679cff33c41d6c41e7a8a3ff4': "我们对同一个结抱有不同的期待。", // We had attached different expectations to the same knot.
  '0f591c7a3985c4e86f5156c8a51aeeabf6763f79a84f643118004a767d2e8746': "我们一致认为，这块包布应随这本书一起送给主人，但以后的包裹未必也这样处理。", // We agreed that this particular cloth belonged with the book, but that a future
  '14e06ae22c4dad5fb6c4679234b35d7359a1bc7b6fd56c2170fd0c0bb2257d00': "她把我的包布叠得整整齐齐，让我可以带它回家。", // She had folded mine neatly so it would be ready for the journey home.
  '3d3ad80f83960745bf2e0e528b4192c4a5cc91ce72f3470dcba649926aed443e': "在桌边，她松开了结，拿起了书。", // At the table, she loosened the knot and lifted out the book.
  'e2a036f9ad00e64acc3f16b93062323b75488843fd607862dbe344d783b11cba': "这段对话为她的经历腾出了空间，也表达了我新获得的热情。", // The conversation had made room for her experience as well as my newly acquired
  'fe038fe42da6dfb4737bb9835c534135ee908a568f848b89c93302618e96b90b': "它描述的是我们达成的协议，而不是宣布所有日本家庭的做法。", // It described what we had agreed, rather than announcing what all Japanese fami
  '9f008eee164c46e5e47c011cae47f7aca188d6436c408f949ce8f4e07935802c': "然后她用双手抚平布料，把角折合在一起，把小方块放在我的包旁边。", // Then she smoothed the cloth with both hands, folded its corners together and p
  '9e16a72beedc15f202b7716452109fdea5b58d05a24444929bed372cfa65a315': "我惊讶地盯着一个篮子：它原先的位置高过我的头，现在却几乎就在我身旁。", // I stared in amazement at a basket that had previously been above my head and w
  'a6d0701d52cb7667936ce4a000442fd37ef7d95574212415b2294c2709b0c596': "我明白了，为什么没必要把所有货物卸下再搬上河岸。", // I could see why unloading everything and carrying it up the bank was unnecessa
  '3b2b9ba91c8e3b7897d08df9e9c378d363e4f2b234571d29cee365cd6c6d18a3': "我第一次和姑妈的货船一起旅行的早晨，我数着远处的烟囱，直到数得无聊。", // On the morning I first travelled with my aunt's cargo boat, I counted the same
  'a075b3a021be16b0ea881ed6c11ae9091f6688000aad3a6dde1dd7e355489333': "我姑妈把一袋袋谷物运往位于较高一级水道上的磨坊。", // My aunt carried sacks of grain to a mill on a higher stretch of water.
  '08f0c1a81387b035cf5608de6cd76e63efd9433703cc8640745184384c22dc70': "我看着上游闸门保持关闭，船闸管理员则调整进水口，让水从较高处流入。", // I watched the upper gates remain shut while the keeper adjusted an opening tha
  'af6d4a29e25445bec01e0213a8f6a00de201f17240aa602838876e726a4a56bb': "我舒服地靠着折好的盖布，满足地看着拉船的马重新迈出稳健的步伐。", // I settled comfortably against a folded cover, content to watch the tow horse r
  'a8206ee97fb37ac8e6a7661dba76bd62cfe6f687e862bf067c9dbe350302c715': "麻袋依旧放在装载的地方，远处的烟囱似乎仍不愿靠近。", // The sacks remained where they had been loaded, and the distant chimneys still 
  '4d31f0c74c8ae038b0538632df58b05ca8336895f0f2158c5dd8c0a00d2eca4e': "看似停滞不动的状态，实际上是为适应水道结构而进行的必要高度调整。", // What had appeared to be inactivity was a necessary adjustment to the structure
  '6e245f8f67d6d22b6ff08cb09dbe1198bf1c6e72065c2d7930243f1ccee7a673': "我们从下游进入了一道，下层的闸门在我们身后关闭。", // We had entered one from the lower stretch, and the lower gates had closed behi
  '7fc391cec1859dbd3a433000c64aec57b5078dc794a18207c4f3b133bfaaae00': "它的门不仅仅是阻碍路线的障碍物。", // Its gates were not simply obstacles interrupting a route.
  'a848ec960d1fdba14eb2e839e913c9c57335b93bff49721e853ee15cd2968785': "旅程中最重要的工作之一，恰好发生在我以为旅程停靠的地方。", // Some of the journey's most important work had occurred precisely where I thoug
  '05f7a4a0fd330025e2ed7b5f5166f3167e92f17074113dde1c235d1ab7af0af7': "水流支撑着满载船只的整个上升过程。", // The water supported the loaded boat throughout its ascent.
  '3de8aa5bc8b314af199d0afe91e814357480ba731481c3cbd1f26dfed09dd0cc': "协调这些操作需要维护和可靠的顺序，这些品质对乘客来说不如马匹的力量显而易见。", // Coordinating those operations demanded maintenance and a reliable sequence, qu
  'dd6a06eab76259ffdfdf3f880bfeee67197910f6963016ceea9290adda7e0f48': "我还描述了那些在我们静止时似乎向下移动的墙壁。", // I also described the walls that appeared to move downwards while we stood stil
  'ad685adec6dd3dd6f332154de756d3d7f4f06ec1ab5a0461e4c81993c4e5a7d7': "那里，微小的结构悬挂在细线上，其他部分则像迷你羽毛般展开。", // There, tiny structures hung from delicate threads, while other parts spread ou
  '8ff53cb61d6a8b73edaa54ff2978174c1c6215724db4a86d50b5449d4bceff2f': "我把这些限制加在草图旁边。", // I added these limits beside my sketch.
  '132d6a556e1b30e327240ce54e2ae45c0c058013b55f3a0d1097c16b64f09706': "导游并没有说所有草看起来都一样，或者昆虫从未来过它们。", // The guide did not suggest that all grasses looked identical, or that insects n
  '6192e5c1652a39a98abcd06386597575ad2d3279283ca47caf57c5bf7c5d3869': "花粉释放量大，并不意味着每一粒都能有效传粉。", // The large quantity released did not make every grain effective.
  '7b7f7f2821f7f69ecf43fb9acc6978b8c9f4ac5bc0cf6ff00cfbacf36a608cf4': "我开始写下“这团花粉证明花朵已经完成授粉”，随后却停了下来，铅笔悬在纸页上方。", // I began writing that the cloud proved the flowers had been pollinated, then st
  'fb262d89c338137ee0fd1d760054a4dab10c537129174f227454c165104bb505': "导游停在操场外一片高草旁。", // The guide stopped beside a patch of tall grass beyond the playing field.
  'ae200bbda6e8e4abb992c392793562767f5d4759379363e79bcd77a644f09d86': "比较后，小结构就在原地，供下一位观察者使用。", // The comparison left the small structures in place for the next observer.
  'a2539b00b322a9553516d36899a6804dc88b21bf19acd119fea8ba2972c7467e': "它那几条苍白的线条展现了我曾经会视为微不足道的部分。", // Its few pale lines showed parts I would once have dismissed as insignificant.
  '9247b0c5cbd76416def7fd12d81203a44defd71285ffe20a6c8e1fa7198e6a0c': "我放下笔袋，失望地发现我们显然比有趣的部分还早到了。", // I lowered my pencil case, disappointed that we had apparently arrived before t
  'faa3c12d0c2c8039eee5997db640bea78fa8d0d3740e9805a972733d106fc9d4': "一个有用的解释可以包括例外情况。", // A useful explanation could include exceptions.
  '457660ff6d1a3c4160eab6ae89d1bb88e46d46411056f724777939cf9f31fdd3': "透过手持放大镜，我能分辨出悬垂的花药，以及导游认定为柱头的羽毛状结构。", // Through a hand lens, I could distinguish the hanging anthers from the feathery
  'c2afbb337937027af32e1d422ff9bd16c43bc4f86a75fee856b84dd3fc6f16d8': "在一个运输目标不指向特定目的地的系统中，这很合理。", // It made sense in a system whose transport was not directed towards a particula
  '9fdbfd0076aba13c0c1f28684f694520b4b8e259788b90d92e43e0d224fd00ec': "许多草依赖风力来传播花粉。", // Many grasses rely on wind to move their pollen.
  '3573efec31c14c772ecaa870b39fc95b1d94d43327877f36c9cba3eff43e5386': "叶子上没有宽大的花瓣。", // No broad petals stood above the leaves.
  'b593b7bbb22160bdd29bff2173b19977920bba08bac461b08de62337c81fa209': "我们在观察一小片草地，并借此理解一种常见的模式。", // We were examining one patch and using it to understand a common pattern.
  '4e46c62738f6730d92b5786fdda5f4e1ea468b8987e861666226abc4fb2728cd': "茎秆一齐弯下，离我们最近的花朵中飘出一层淡淡的粉尘。", // The stems bent together, and a faint dust drifted from the flowers nearest us.
  'e7c4849c1cf7fd0f29a421c1be11a00e51d60f30ace59fad21b01d4fe94fde0b': "花药会释放花粉;合适的柱头可以接收花粉。", // The anthers released pollen; a suitable stigma could receive it.
  'd7699c4ce1d97f1289f8388e36120d98a0c7df9bf67fb9029ba838b8dbfad833': "未使用的物品也不应自动被认为无价值：它可能在其他地方的用途也应纳入比较范围。", // Nor should an unused object automatically be called worthless: its possible us
  '7178b307398d788f1f39bdfdba643e9b94d2265cd7442911c052078c2e5ba06e': "一个俱乐部一旦失去原有的热情就放弃工作，可能会变得不可靠。", // A club that abandons work whenever its original excitement fades could become 
  'da2bbb2dabe897652afe24d5bf102f517cfbc6d273462faab108c688d57b3b39': "坚持可以带来教育和社会价值。", // Persistence can have educational and social value.
  'f0aefc0f10010933eec45a00927d5c3bbfe0e54cbb85e56dead2f9c0429282ed': "我俯身看着素描，好奇游客会如何操作它。", // I leaned over the sketch, curious about how visitors might operate it.
  'bdf635f9792480b0f63d5928d8b5e0658ad6887c6386009e829a1849de171adb': "我放下笔，松了口气，因为改变方向不会让别人等着约定的展示。", // I put down my pen, relieved that changing direction would not leave someone wa
  'ad6d8425a2bd4bf6e708de05cf9c8f38886d75863c71364549401d8224a9066b': "因此，社团应在认真审视未来的收益、余下的成本及已有承诺后，允许退出项目。", // Clubs should therefore permit withdrawal after a serious review of future bene
  'e9ba7213c65979c60fc6b74bf4a1a85b4b399bb3f5c726badfde4a2e911daf33': "我们并没有证明停下来总是明智的。", // We had not proved that stopping was always sensible.
  '939ea71b1613d5b98a49600cb3b6f3d6f014ce2c62e7606dfe1df9ecc088a351': "困难的项目能培养合作与耐心，而快速替代可能无法提供这些。", // Difficult projects provide practice in cooperation and patience, which a quick
  'df1ebff77ce6cb5de9771974d23948b3cd52a9f28c76684219e2beec9d46b8cd': "这些都是真实的未来后果，而不仅仅是对一堆纸板的情感依附。", // These are genuine future consequences, not merely emotional attachments to a p
  '7bfac4410048cbf4f07db3ea4d7ffe59557304c0dfb7d2ccc433b6959b9d9d7a': "理由涉及未来的利益和义务。", // The reasoning would concern benefits and obligations that remained ahead.
  'db3f6fa39fb7613fe71c42388adb5e9e68973702d7939f507cd6aba51d3c51f4': "如果完成车站能教会成员们仍然渴望的施工技能，继续建造或许是合理的。", // If finishing the station would teach construction skills that members still wa
  'e9e5c68604991aad8884b2386aa30ca759b45720e6fad0f9f87d9e1803c72fd1': "如果曾向低年级学生承诺提供做好的建筑模型，那么他们的期待也应纳入考虑。", // If younger pupils had been promised the finished building, their expectation w
  '0bbe64b321bea45d82554f96d2c79c62e340bb9c89524bce614b6c7a3813ba16': "相关的比较重点是继续推进现在能达到什么，以及仍然需要什么，而不是项目历史的辉煌程度。", // The relevant comparison concerns what continuing would now achieve and what it
  'a4de225704d9688e889fb3ac5ce3c5dadf10a92d0760ebb1d2b85765e05b9f6a': "学校俱乐部在投入数周努力后，是否应该被允许放弃未完成的项目？", // Should a school club be allowed to abandon an unfinished project after investi
  '168ffde92b6f6f7a8803ec8e2bdb3f6b99be2859e60fac702ad02e2f1e395b73': "已完成的工作可能揭示哪些技术成功，可重复使用的部件也能降低未来成本。", // Work already completed may reveal which techniques succeed, and reusable parts
  '5b85011b6442f91738332409eb90ac86a59dbe7d3606a3de992fe9aa050ce289': "心理学家描述了沉没成本效应：人们可能部分因为已经投入了无法回收的资源而继续某项活动。", // Psychologists describe a sunk-cost effect: people may continue an activity par
  'c6bfdde5ba2d48544dfe8844e9a49da571b2982a7f20ea8ffbaad083ebd18574': "这块板子正逐渐变成装饰品，而非临时记录。", // The board was becoming a decorative object rather than a temporary record.
  'f9a95daf519ca6c201943e94a87d2acec4ef50e84026422f94fa569b7f29bd27': "理解重复使用的原因并没有让我自己更易放下那些细致的标记。", // Understanding the reason for reuse had not made my own careful marks any easie
  '0815133500a755e316356a2322b87b0c2672f13a5416ddcf8c8e8c3351fd32c5': "最后，我用指尖试了试光滑的表面，微笑着把它放进下一节课的托盘。", // At the end, I tested the smooth surface with a fingertip and smiled as I place
  '8666fe2b4c3c9593d61c1db2868da16f6dfcf2eedb8da8f4de930d5eb687831b': "我曾根据材料对我作品的保存程度来评判，忽视了它更新的可能性。", // I had judged the material by how well it preserved my work, overlooking its ca
  'd48d8545c9a87ec5aa889472b558dbbab48494df2284b04b69a7a83ea49b81f7': "重复使用赋予了蜡板实用价值，而不要求它永久保留写下的内容。", // Reuse gave the board utility without requiring permanence.
  '54125981035fe6ec8f92b251ffce097931432ec48055ba68f2ac4c642c6f8d7a': "我们会尝试一个可重复使用的现代课堂版本。", // We would try a reusable modern classroom version.
  '30e5b199985ca81cabac75dcb907e297d22473cb11f7cfa22deb005e9fa70831': "我在蜡面上刻出一道线，然后仔细查看这道陌生的刻痕。", // I pressed a line into the wax, then examined the unfamiliar mark.
  '51be11a3b7899972965db6a1f80b04362577ce67dc9a821f97410d057df9dd62': "我的搭档提醒我注意，写字板的数量有限。", // My partner drew attention to the scarcity of boards.
  'bd0967e0fee65fc67f9a3a060eb54297ab7cde01723048802f2120b0ece40013': "如果每份已完成的订单记录都原样保留、不擦除，下一位顾客就需要另一个书写面。", // If every completed order remained untouched, the next customer would need anot
  '78dcd536efe68be75285bd50af8c12dce718813e9ec3f075a2f2268df2e2c02a': "在下一次送货前完成后，我加了一个精致的边框。", // Having finished before the next delivery, I added an elaborate border.
  '16f869c749f1a0dc328e9c3ae599f3b1ca7c460ce52f8bf4448b7a2aa3174fec': "相反，我留了一个可用的页面，给那些话还没写出来的人。", // Instead, I left a usable page for somebody whose words were still unwritten.
  '81de9aca0a880cb417edb1674b356b7e20d2ee68b9d91207b02426311f109792': "老师解释说，蜡板可以重复使用，而需要保存的信息可能会被复制到别处。", // The teacher explained that wax boards could be reused, while information that 
  'ce0da2cc28525b3666fb2c6571ff9bb544d55519307714be85708c7b7dc27741': "关于这次送货的重要信息，一点也没有丢失。", // Nothing important about the delivery had been lost.
  '09b3f0af7b25a56ddb275e35f5d793b7f021b41df66f1fad321e09b799f16300': "在我们的历史课上，老师在桌上放了木质写字板。", // For our history lesson, the teacher placed wooden writing boards on the tables
  'f5a6789d893f2eb39f770acaf8abaac50ec8d26b87679888f2495077efa08d91': "这其实是关于推理的误解，而不是最初安排中的错误。", // This was a misconception about inference, rather than a mistake in the origina
  '718ffb7a986baf4f74c74fb669aeeb72acbfcff5a49068a4733b2f934c9d69b9': "九个符合我们的条件，但与这个结论相矛盾。", // Nine met our conditions but contradicted that conclusion.
  '369ab989dc08f32d8d9705499c2535f8f2d35e972c3212e9c0a25eec42e09bd1': "在一次数学工作坊中，我们小组拿到了一盒计数片和一项不同寻常的任务：提出一条数学规则，再尝试找出它不成立的情况。", // During a mathematics workshop, our group received a box of counters and an unu
  'bf6924cb19634bf91c55f5867b07fe7c056adb3c4f2161017a1bab13d39f19fe': "我把这五个例子整齐地排成一行，邀请搭档一起检查。", // I placed the five examples in a neat line and invited my partner to inspect th
  'dd10ad34beb0924b317fa808b7828cc5b11b46dc3de085e5748a30cb897c7776': "我原以为一旦找到合理的规则，第二部分就没必要了。", // I expected the second part to be unnecessary once a sensible rule had been fou
  '955825cfad91ac034842eff22cef152109aa6a1f60721a072a97393abe7e597f': "在最后的评估活动中，每组都与另一桌交换了一条新的数学断言。", // For our final evaluation, each group exchanged a fresh claim with another tabl
  'c44a0c61951ab2406e1d5964bb9bf516ccf2c766b03d509dc10369757774ffd7': "这一修改限制的是规则的适用范围，而不是把数字9这个反例改掉。", // The change was a restriction on its scope, not a correction to nine.
  '230d12def1f28584f04d8473e55b554e3ca26e54a129481b9544b90d14690faa': "我们研究的是能分成若干相等组的总数，要求每组不止一个计数片，而且不止一组。", // We were investigating totals that could be divided into equal groups, with mor
  '0b3f87684ad0560a95e9703dce88cc4abac9bdedf397b026459223f083dc9ebf': "我已经开始把我的假设写成一个自信的陈述。", // I had already begun writing my assumption as a confident statement.
  '5573a7dbc44747b42150c3c6f9989c6827cf9122370fc85c239678eb5f2c8cb5': "这些例子无法证明规则始终成立，而这一个反例就足以证明它并非总是成立。", // They could not establish that it always worked, whereas this single counterexa
  '9b8b555e7a1f8d96359391b5ba473621019152ff7e58c610cf0ef35587e1c9a0': "他们的泛化和我第一个观点有同样的弱点。", // Their generalisation had the same weakness as my first one.
  '67d0f3cf178b193699aa307b3e3dfec45093c7d5e964afe097983ff7353fb02b': "在把本组的断言递给另一组之前，我选了一个可能难处理的总数，想看看它会不会暴露出另一个漏洞。", // Before passing ours over, I chose a potentially awkward total and asked whethe
  '42c5245f996e826c274b1d916c3415b926f6842503180b14f2764df9c3281088': "我皱眉看着自己一连串成功的例子。", // I frowned at my line of successful examples.
  '16c47f96602e63e82e4882afecccf6be4668bbbbd651051ccd348bc9acb4c679': "修订后的声明野心较小，但其理由不再依赖于收集实例。", // The revised statement was less ambitious, but its justification no longer depe
  '661353ba33eb7548188f91ff5c393fc6b01db6e1df2ea7b0d8b36dcfb76dbaeb': "没有一个包含错误，但它们却不知怎的未能守护我建立在它们上的规则。", // None contained a mistake, yet together they had somehow failed to protect the 
  '0ae07638ccf239d26f3b4476211396240ce3af1d1944f9d00c75b386cf380fe0': "我把每一组都数了两遍，又将计数片排成行重新数了一遍。", // I counted every group twice, then moved the counters into rows and counted aga
  'de0fa1e7bf78e1230024be81ef2a9984e46a19786916e12034295b2db6bb0184': "我希望我的新习惯从一开始就展现出坚持不懈。", // I wanted my new habit to demonstrate perseverance from the beginning.
  '7e049e420eca1a379f883a4556976ef0dbce04f6fb8b11238ce5f598a96436b6': "我们及时回来，悠闲地聊了聊。", // We returned with time for a leisurely conversation.
  'c738804af09a3d4363921c9a7c84091af21ea16f6c2536f7446e019fd431339b': "学校没有提供任何数字目标。", // The school had supplied no numerical target.
  '8ab923cf2195769cc922a84f02eac7ac2e9d59c5330479683de9fe5cf1cced74': "到了周三，一想到要走那条长路线，我出门的动力就减弱了。", // By Wednesday, anticipation of the long route was reducing my incentive to go o
  'fb889dc85710c3deef91c187a523945ad6445a7841d38b0d93e22c10f8e2eea3': "和我走过的路线相比，他们走的那一小圈突然显得不算什么成绩了。", // Their shorter circuit suddenly seemed a modest achievement beside mine.
  'f9bb96e7f4ba4f527db87d64bfe8f67b3a5b7c52e35a83942dd1025b4e52cd7e': "周四，我没有看路线图就选了树。", // On Thursday, I chose the trees without consulting the route drawing.
  '36d56bb72dbc71458831767438c1ff210037828717a0e19e0ab8115c44834ce7': "邀请悄然变成了一种义务，而这种转变是我自己造成的。", // An invitation had quietly become an obligation, a transformation for which I w
  'd03182dffa23d8c0a12549382c3fa70c78626b0c20d01d852b1f9138ef9eafb2': "当我们学校开放午休散步时，我画了绕建筑最长的路线。", // When our school opened its grounds for lunchtime walking, I drew the longest p
  'e74d95a68744f5c7f43f45bfc736f41d1e2d0025c66ff37a12cbe1141c1c2e0d': "我不能从中概括她的路线对所有人都是最好的。", // I could not generalise from this that her route was best for everyone.
  'c48954c3fdcd9e9cd55e919be6c7c49211a6aec00838e96486d0c785f2c46e5e': "回到入口处，我舒服地伸展双腿，留下来把话聊完，不再计算自己本来还可以再走多远。", // Back at the entrance, I stretched my legs comfortably and stayed to finish a c
  '718f1272807df281029c2493abda721268fed835b6be6dba598333f3ce56adea': "但对我来说，这条容易走完的路线消除了那种一直让我不愿出门的压力。", // For me, however, the manageable route removed the pressure that had been keepi
  'e2cec0b027aa5070fafda0ffdc43449465f5d0cd355c89c90fb0ecbf48ab37b1': "从个人角度看，可持续性比一个令人印象深刻的最大标准更重要。", // Sustainability, in this personal sense, mattered more than an impressive maxim
  '9505bd174a3116027c200010b6410503e8cbef8840b6fe77e107b2b1fa463298': "到了周一，我不必补走额外的一圈，笔记本里也没有未完成的总数等着补足。", // There was no extra circuit to repay on Monday and no unfinished total waiting 
  'b744a65afed010d79bc642d9f4d6ca8fdd4049c819313fafd06969cb3f895fce': "不过，我带了一本笔记本，每条完成的路线都会在日期旁边加一个大大的勾。", // Nevertheless, I brought a notebook in which each completed route would receive
  '069648c820127a090a254717e1bcac51366d1f422dfcde49cdeda421ec8464b8': "我举起完成的路线，描述了经过的每一栋建筑。", // I held up my completed route and described every building I had passed.
  '9a2301ec7c5d4080b50f42dfedc8a9d437672b107c79dbb93942480ce3ff8b94': "我已经完成了最长的路线两遍。", // I had completed the longest route twice.
  'b739bba7b06f2aee83db078defaf32535968f5ec317d5ae693f2b38031179026': "我自愿剪辑录音，认为仔细聆听能让我成为公正的评判者。", // I volunteered to trim the recordings, believing that listening carefully would
  '29da83527b7be0b1b96b311645a991ea268316c27e3ffd5fed36a5b2280e19d1': "理解一个已认可的效应意味着将其视为一种可能性，而非将一个合理的推断视为既定原因。", // Understanding a recognised effect meant considering it as a possibility, rathe
  'b0615a5337304211ca73d60f5ad0c64bdcde36e367a6ba5db9d80418c350aecd': "她补充说，这是一种倾向，而非承诺：重复并不意味着每个声音都令人愉悦，人们也会对某些事物感到厌倦。", // She added that this was a tendency, not a promise: repetition does not make ev
  'f16d264cbedff5ff2ecedf2404eeb729af9a92411bb66b422da222be0bc8da63': "我在旁边加了一颗星，确信第一段录音只能用来练习剪辑操作。", // I put a star beside it, certain that the first recording would be useful only 
  '9ea90ba1b07a234385fafaa1f8ede06505f1322a50ab16f74676fe947739eed0': "我看了自己写的推荐文字，里面把第一首曲子称作“显然是访客最喜欢的一首”。", // I looked at my recommendation, which called the first piece the obvious favour
  '9a112e5e1d872f396c6d436160e53e853040f39bf3795c4fd72e1d0da71f04ec': "我们听到的是相同的音调，但我期待她感受到的那些吸引人的特质显然在她的经历中缺失了。", // We were hearing the same notes, yet the attractive qualities I expected her to
  'f8f12e5f6723598c5e24a71ab287238f63aa374b497e05b7796a8d11f5e4c23d': "这一区分防止了一个有吸引力的解释变成无根据的断言。", // That distinction prevented an attractive interpretation from becoming an unsup
  '1420e0c5751ba397f150832cf0eadb6e0b045d8790904f5ce991698557d219e3': "我个人主观上的喜爱，并不能证明初次听这些曲子的听众会更喜欢哪一首。", // My subjective enjoyment did not establish what an unfamiliar audience would pr
  '7abad3b88cf9adaa9a313b730b8d5b794feb5afb41e18c510586c1459b425137': "音乐没有变，但我们此前的聆听经历不同。", // The music was unchanged, but our listening histories differed.
  '3fc86a4d8afe2d68e9611893993506fa14a2369a8e6631d1a756d27cd749e251': "老师的解释很合理，但我们那个下午的经历并不是一次控制条件的研究。", // The teacher's explanation was plausible, but our afternoon was not a controlle
  'c9ccf0cc8ea1b79547760cff611715c371845a8e1ad2a6e69593eb5378566de4': "我歪着头问她哪一部分没引起她的兴趣。", // I tilted my head and asked which part had failed to interest her.
  '7e16a1eb9ec9fb496edc2f1b52e1bf9bb85f8860e8a4fb6d184578d7cd0564f3': "心理学家描述了一种暴露效应，即反复接触会增加好感。", // Psychologists describe a mere exposure effect, in which repeated encounters ca
  'eebc1eabe598385b3508276559666fbbcff4a795f5be41c8ee78961cc6798790': "当录音完成时，我已经开始哼唱了。", // By the time the finished recording was ready, I was humming along.
  '8abfd920cfaaac77d8c8b7493415eaa6d082b44313e813fb690313822f09b92f': "几个下午里，我反复播放第一首曲子的录音，寻找合适的开头和结尾。", // Over several afternoons, I replayed the first piece while finding a suitable b
  'ea3658bed775600554142d6575f1f43944245a7d784f7b9559cb353095f30275': "现在，第一首曲子在我听来均衡而悦耳，她却觉得它相当普通。", // The first now seemed pleasantly balanced to me, while she described it as rath
  'fe27e0dec7747b602aa0930f7df2326a1d001993c1610a91d5049b9a68e2adf3': "在学校的中国画展中，我自愿为一幅教学用复制画配写说明文字。", // For our school's exhibition of Chinese painting, I volunteered to caption a te
  '9bce424aeb0e62fc648dad578b7b70014b42380f3545a87fa15769924723f580': "标题很明确，红色印章似乎是统计参与艺术家的明显方式。", // The title was clear, and the red seals seemed an obvious way to count the arti
  '0357b17754d7d8cf46a5a5e391c33bfa594f4bb8089a11f8fba5715c5143b185': "去掉多出的收藏印，会掩盖这幅画在不同收藏者之间流传的部分历史。", // Removing the extra seals would conceal part of the painting's passage between 
  '12fcef06af62c73156d74773a72cf6fe56810030f388f70441633ac304e4d2a7': "我提出了一个假设作为身份识别。", // I had presented an assumption as an identification.
  '026db433b74f8d6d4532a9d07a6ddc5ccea54e4fbb517e0c55c0c280f8734c8b': "我请求看另一张教学图像，俯身检查其边缘，询问其痕迹可能暗示的何种旅程。", // I asked to see another teaching image, leaning forward to examine its margins 
  'aafea8a1f5acc5cdbccd346ebd1ecddbe4ddddda4140145c3a326443823c7959': "我写了一张说明标签，把这幅山水画描述成三位艺术家合作的作品。", // I wrote a label describing the landscape as a collaboration between three arti
  '398255e064c83113bdee09abac933a6502f62f085d4b2ad15f85712ee2b989df': "我快速计算，把持有历史变成了合作的说法，仅仅因为每一张印记都用的是红色墨水。", // My quick calculation had converted a history of possession into a claim about 
  '31c1a6559f1399d3d50c9b44f78d78ef0e13f2e0235c201a07a6062c337f7062': "一位画家创作了这幅风景;后来的两位收藏家在作品属于他们时添加了印章。", // One painter had created the landscape; two later collectors had added seals wh
  '48dfec946b61fd938a556c2ff931cd15fa906f9f15c510dd393a050596517fda': "修订后的文字将画家与收藏家区分开来，同时也没有假装一个简短的标签能重现物品旅程的每一个细节。", // The revised text distinguished the painter from the collectors, without preten
  '2cef613f87952a5fefd533805bfae4763b6d8515ea7d1321462b500624019ad6': "这些印记可能记录的是所有权，而非作者身份。", // These marks could record ownership rather than authorship.
  '46b29417043cf57959787bbea525f3cdd0a7b3e7afac045a23d2debd9a71fdc2': "这次，我在数东西之前就打开了说明笔记。", // This time, I opened the explanatory notes before counting anything.
  'bf6138667d0e62ff2cad01df9d0a2059e31614d253077c7764e09cf956714b54': "我根据修正后的说明给出了答案，然后邀请她考虑其他标记能告诉我们什么。", // I gave the answer from my corrected caption, then invited her to consider what
  '7fcbe622217ed3ac0cf161095acf57f82087a00403dfb04c197394a6814a1d7c': "我们一起追溯了他们不同的角色。", // We traced their different roles together.
  '7cc26d081b8c4887e4a3ef31f26a328dae83d04d1390ff75425430363939378d': "老师提供了一幅虚构的风景画及其历史介绍，让我们练习如何看懂图像周围的标记。", // The teacher had supplied an invented landscape with an account of its history,
};
