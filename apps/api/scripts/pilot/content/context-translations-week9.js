'use strict';

// 首发周例句的中文句意。key 是英文原句的 SHA-256；
// content/index.js 会逐条校验，少一条就立即报错，不能带缺口发布。
// 由 scripts/pilot/build-week2-context-translations.js 生成（Azure Translator），
// 生成后经人工复核。行尾注释是原句，方便审阅时不必回查。
module.exports = {
  '9fd9ecb8cd8d5b8b8840d0d93f361101554dc6152c60760544a2af029228b20d': "虽然韧性确实有价值，但其代价必须与所保护的功能成正比。", // While it is true that resilience has value, its price must be proportionate to
  '99ab47713866bc6f7688579ee2ab16be2de3370565f9ad08ecee9e7c738074d8': "两个控制器可能都提供调度功能，但由于使用不兼容的协议（即设备通信的约定规则）而无法交换指令。", // Two controllers may both offer scheduling, yet be unable to exchange instructi
  '3c41c51faa6a38d0ee7567bc4e178ea4b660bea31a2cc923130e4daa76e96b5e': "更合理的立场是有条件的：连接应通过有效的协调赢得其地位，而当外部服务无法接通时，关键功能应保持可用。", // The more defensible position is conditional: connection should earn its place 
  'e80a9f5e50a9c295402d46038bdd245b27d3217301194ca6a1d88b9dc07467fb': "单独的控制措施可能能充分完成每个任务，但员工必须自行协调冲突的排班。", // Separate controls might perform each individual task adequately, yet leave sta
  'b2c288a8fab3a34cf817c37601cdaa1a5fc68e621b70315916276dc1c456a4e6': "因此，关键区别在于控制权所在的位置。", // The relevant distinction is therefore where control resides.
  '269f3e03f043cef2d5ab62654ec6a60680b23c4297faf5d22671237019c80ce3': "可访问的文档和兼容的界面可以使后续更换供应商更为实用。", // Accessible documentation and compatible interfaces can make a later change of 
  '0cf285aea09381b450f6167118f141ed59f263dd7811bff9cf7533b18095a527': "本地传感器可能产生错误读数，没有远程诊断，技术人员可能需要更长时间才能发现问题。", // A local sensor can produce an incorrect reading, and without remote diagnostic
  'c3254d6c1938a7091f2f41ca34c7ce37857e41d4290d87e997912b02b8300fea': "支持者认为这种联系是高效建筑的基础;怀疑者则认为对普通物品产生了不必要的依赖。", // Supporters regard such connections as the foundation of efficient buildings; s
  '36a68b988cef5687eb9a8fcc8d9e1ce7697ce28f7a9422f1c32f19250e9e5252': "联网系统可以根据现行时间安排调整照明，报告有故障的灯具，并让技术人员无需逐间走访教室就能检查灯具的状态。", // A connected system could adjust lighting to the current schedule, report a fau
  '9edddcf27505ba3274539c8f6beab88fb83ac28c26a19b791ec8d6713d08c3ac': "直接操作灯泡的物理开关保留了普通功能，而复杂接口即使吸引人，也可能无法实现。", // A physical switch that directly operates the lamp preserves an ordinary capabi
  '30936cabcc7eed9f0672fd8d3230e8899de1e8d188c4fa98f4206d2ef16b0046': "这种演习无法建立永久的可靠性，但可以揭示在理想条件下进行的演示所隐藏的依赖关系。", // Such an exercise cannot establish permanent reliability, but it can reveal dep
  '270b5ee82123a8a1c2555d7b663a9b28df98ecc1fbeea428dd68716dbc775c5e': "诚然，支持全联网建筑的人有合理的反对意见：隔离设备并不自动可靠。", // Granted, advocates of fully networked buildings have a legitimate objection: i
  '424a4c59f9b4d534049bfc28eb6d1d5a31c32411595a6402db16f630b3870965': "要求设备保留基本本地功能，与使用网络进行诊断和协调是兼容的。", // Requiring a device to retain basic local functions is compatible with using a 
  'e2cc2feeb2874025b3a99e72dbd580ff55dd1564324d31ca6c3535291d3a4833': "将必要的运行功能与可选的便利功能区分开来，购买者就能保留重要功能，而不必花钱在每一种可能的情况下都复制完整的在线使用体验。", // Distinguishing essential operation from optional convenience allows a purchase
  'd1b5a65563ffafde0104259f578228d64e794d1311a54a142730620e09cfee16': "从经济角度看，要求为一切都提供替代方案，有一个不容忽视的反对理由。", // There is a serious economic objection to demanding alternatives for everything
  'd8482ff8f71989bcbf527cc1b403e36fb5df7c8cd61490de362e708eec16e281': "最强的系统不一定是连接最少的那个，而是用户理解这些连接带来的好处以及缺席带来的损失。", // The strongest system is not necessarily the one with the fewest connections, b
  'a4e565c4a88ace49f107532853d78a37bc4e29f3e6a52af76344bdfaca137187': "答案应是透明、可调节的策划，而非隐蔽的排斥。", // The answer should be transparent, adjustable curation rather than concealed ex
  '93b5c7fa4cef5580fe100c1fea4fc51201e93e32d2455a770fcb6cfcf5259847': "例如，增加晚间陶艺课程，可以让无法在下午参加的学习者也能参与。", // Adding an evening ceramics session, for example, could make participation poss
  '93dee704cc74c5c73e3d0fc5e9104abfdf01382b661ab01dbece3c1d17beabd7': "此外，发现一个陌生的可能性还能帮助人们发展出之前无法表达的偏好。", // Furthermore, discovering an unfamiliar possibility can help people develop pre
  '806b8b5eb69657dbd4e0628dbc83a1624c0896f9f621a1de0688eff0a16f6dc0': "因此，同一目录可以支持一个人的判断，同时又让另一个人感到沮丧。", // The same catalogue can therefore support one person's judgement while frustrat
  '23bc39941154fe732b357da6cb16c4fb378a9b9d9a4fbd93fb13e365c8a21106': "无论是无限扩展还是强制性的简单性，都无法给出令人满意的答案。", // Neither unlimited expansion nor compulsory simplicity offers a satisfactory an
  'dbec9ef826fc8fd03aa469caa2b17ea7fc31755d5e0ab3076703ed3774d30820': "对于工作坊来说，这些可能是必要的先修技能以及是否包含材料，而不是对所有可能技巧的详细说明。", // For a workshop, these might be the necessary prior skills and whether material
  'c04a4c7d774cac3f6da255ec8e1dee0f27a552b29e3de605205e065eff321a71': "有用的指导减少了无关的工作，而无需完全相同的偏好。", // Useful guidance reduces irrelevant work without requiring identical preference
  '6037b63a702689b67ace779cea21a9e93eccd346653d8b478a13b0878e63a439': "在研讨会的例子中，对持续时间、材料和先验知识的一致描述将允许比较，而较短但同样不一致的列表则无法做到。", // In the workshop example, consistent descriptions of duration, materials and pr
  '3e358851a80b61e6777fec4fbff4e9ffd8a5ab2c521cb80a14d52f88de102811': "这样的指导还能让组织的优先事项变得可见：解释为何过往经验重要，比提供一个无法被预期遵循者审视的基本标准的建议更有信息量。", // Such guidance would also make an organisation's priorities visible: explaining
  'c1fb3898bf0737380379836d828582ccf253d4de6857df1b90bbd44cec4bf51d': "组织应保留满足不同需求的替代方案，同时通过一致的信息和用户控制的过滤器使比较变得可控。", // Organisations should preserve alternatives that serve distinct needs while mak
  '18675d4baac3be8ec719f3685813fd24548646c216c9fa07a43045de56cda1c6': "由此筛选出的一小部分书，体现的是他们可以审视和修订的标准，而不是认定某些书不适合他们考虑。", // The resulting smaller selection reflects a criterion they can inspect and revi
  '4691851c04ee2a5372abcf4ab64e43d1da417efbb778377b1de1cb534cc0eead': "这种反事实的比较会让承诺变得困难。", // Such counterfactual comparison can make commitment difficult.
  'c65bed58ef5ae512fb176fc0ea536c5d165a7e0e653fefbdbcdced697358123c': "可逆性并不让每个决定都变得轻松，但它改变了这些决定所涉及的利害关系。", // Reversibility does not make every decision effortless, but it changes what is 
  '84a1faddbea857844feac72991e269331f973780ab4e6513fbd7f9a426fde269': "关于选择负担的主张应关注相关知识和信息的可比性，而非将名单的规模视为完整的解释。", // Claims about the burden of choice should attend to relevant knowledge and the 
  'd139700f34cd903f4afc4dbde5ed340376920e38c420966c3ce1155a7264406c': "关键在于现有信息、允许的时间以及重新考虑的可能性是否使这些选项真正可用。", // What matters is whether the available information, the time allowed and the po
  'dc77196585785e82cdc4d1d16834be9f811b298739c5c850c0f10696142bd748': "想象一下，当描述长度不同、价格不包含材料，且所需经验不明确时，选择一个工作坊。", // Imagine choosing a workshop when descriptions differ in length, prices exclude
  'd9d5837d1bbb9dc452de59c482c06741dacb751260179d20ab77adc9778be5a5': "然而，从名单中选择的能力不应与做出一个可以理解和认可的决定的能力混淆。", // Yet the ability to select from a list should not be confused with the ability 
  '56cdcaf7a60a68af991d06620e8a38714c879addcfb10954b294acbd707e7195': "这种对比让有意作出的安排清楚易懂：访客可以看到哪里保障了通行，哪里为落叶分解留出了空间。", // The contrast makes a deliberate arrangement legible: visitors can see where ac
  'd85299d54aabd3af1977d5a0239be5f5031d90b73bcc6d8a1dcbb818b603ce1d': "然而，集中堆肥需要收集落叶、提供场地，并在之后重新分配堆肥，而适合留在种植床里的落叶则可以就地分解。", // However, centralised composting requires collection, space and subsequent redi
  '5ff770e0610884302dbfcbb34db0f1e9d3e86eb7b8e8248845442eec1b0e05f5': "对观察者来说，这表示维护已过期;对另一些人来说，是土壤下一个循环的开始。", // To one observer they indicate overdue maintenance; to another they are the beg
  '430e552f1586b0daae461645c7c2412118cca8006a92b155a64acc4408fc1bf1': "不过，它仍能将有意采取的做法与被遗忘的维护工作区分开，让工作人员有一项具体的安排可供检查，而不是收到一句含糊的“任自然发展”的指示。", // It can, nevertheless, distinguish an intentional practice from forgotten maint
  '42b2530c40422b4fb176ea0c2f4bf10ee953314ad089c21fc0b81c3446c22ffa': "这一结论既不将所有整洁视为表面，也不赋予所有未受破坏的地表生态价值。", // That conclusion neither treats all tidiness as superficial nor grants every un
  '1c97b8bb4ecc2bb68573bae69e3c8e1277b0734086869b9f8712a686ae79ed1b': "湿叶子会让铺装小径滑，而堆积的物质则可能遮挡边缘或覆盖小植物。", // Wet leaves can make a paved path slippery, while accumulated material can obsc
  '43266e1170cf9903fe195cf98d6833cdc39863aeee4c3c65f132d34cb9c0ef0a': "支持保留落叶的人应回应这一论点，而不是把所有清理工作都视为只在意外观而加以否定。", // Advocates of retention should answer this argument rather than dismiss all cle
  '1c413df3b7f3fae1a84afe0987582807ae8d73cdc60d8b7504d0854a63475668': "支持全面清理的人可能会说，堆肥已经在整洁与养分循环之间取得了平衡。", // A supporter of comprehensive clearing might reply that composting already reco
  '9918318855164138baf029de1aa7912603f58907c9e7bb23c988dd509bbab3bc': "如果不断把落叶运出花园，再运入替代的土壤材料，那么花园可能一边花钱购买土壤材料，一边丢弃本可用来生成这些材料的部分原料。", // If leaves are continually exported and replacement soil material is then broug
  'b1b9980fad14d649625e207e8f8f858042b2983233c4051c65b0d077396b470c': "这样的界限并不能证明床况良好，标志也无法弥补不合适的条件。", // Such a boundary does not prove that the bed is functioning well, and a sign ca
  '1bdb679d00861aff20e4de4425af256e8353a1df7967a0e82e5ac8f1bc68ba27': "学生可以追踪做过标记的落叶，观察其质地变化，将保留落叶的种植床中的材料与已制成的堆肥作比较，并记录雨后地表如何变化。", // Students could follow marked leaves as their texture changes, compare material
  'f25bac549985e60a08f55921db5df86952f3d41de4d917872f837663f062a4e6': "因此，保留是位置和数量的问题，而非必须接受风产生的每一种安排。", // Retention is therefore a question of placement and quantity, not an obligation
  '101a9208066c84a27e23f73621c42789c08dd079c8ce389455065f1a655f8bf2': "这一标准要求园丁既为干预也为克制提供理由，因为如果只凭匆匆一瞥就判断后果，两者都可能变成未经审视的习惯。", // This standard asks gardeners to justify both intervention and restraint, since
  '93131da0c95a822d1709ff68a9db8f7b57ae07ddbddc68473f4de06cc4056607': "植物的需求和材料的位置比一般的干预减少指令更重要。", // The needs of the plants and the position of the material matter more than a ge
  '7b5a8c9bac0bfeeff5215e8baa7778c423ff0dec741c8b04e8a2f12e588ed39e': "花园可以有序地欢迎游客，同时让一些最重要的工作保持未完成。", // A garden can be orderly enough to welcome visitors while allowing some of its 
  '386fb7d4fcac3177189d08d58d54c9434421eb479e109c338d0b1c433964c7a9': "考虑一个学校花园，定期清理步行路线，并有一个标记好的花坛，允许落叶适度堆积。", // Consider a school garden with regularly cleared walking routes and a marked be
  'aa404cddb5a22b4eb0696ff5d03ea6ffde01d4c23e68445da8d1c936a2639573': "碘本身是1811年由法国化学家贝尔纳·库尔图瓦发现的：他注意到，正在处理的海藻灰里升起了一股紫色的蒸气。", // Iodine itself was identified in 1811 by the French chemist Bernard Courtois, w
  '20600a1ce87fc5958573dd1b43e79df27c031c61ee77d678e6b4eee5c75c0a9d': "在多山地区，以及曾被冰川覆盖的地区，融化的冰和大量降雨逐渐把土壤里的大部分碘冲走了。", // In mountainous regions, and in areas that were once covered by glaciers, melti
  '314dbb18c9ae94379158deb3f9719fa2c6495fbd28c6dd20fb98e0e0bf1fec8d': "然而，这种微量元素是不可或缺的：位于颈部前方的甲状腺利用它制造调节身体新陈代谢的激素，这些激素对大脑正常发育至关重要，尤其是在生命的早期阶段。", // Yet this trace element is indispensable: the thyroid gland, which sits at the 
  '129931ab379b537cbb272daa46a414b34849a7b2b74a402e14f159aaf3353221': "在这种土壤里种出的作物、在上面吃草的动物，含碘量也相应很少，所以依赖本地食物的社区摄入的碘可能远远不够。", // Crops grown in such soils, and animals that graze on them, contain correspondi
  '3059d07eaf59ad6f393307004c06b30680796e2026e5ef068930746f5d599bb3': "这时，甲状腺会肿大，试图从血液中摄取更多碘，于是形成一种看得见的肿块，叫作甲状腺肿。", // When this happens, the thyroid gland enlarges in an attempt to capture more of
  'b115a91dd6e980fe58ee707b75caaecf482577abda99eb0bd929f55a8c45a903': "在英国，食盐加碘从未成为强制要求，碘主要来自牛奶，而且很大程度上是偶然的：牛饲料常会添加碘，奶牛场也曾用含碘消毒剂清洁设备。", // In Britain, where iodising salt has never been compulsory, iodine has come mai
  '418f40eb7ca1fb2d21b10d87638f4a31c4cada952bb64ee65bf3c00fbca893b4': "另一个复杂因素是，由于摄入过多盐会升高血压，许多国家的卫生部门敦促人们减少盐的摄入，这似乎削弱了依赖盐来输送碘的理由。", // A further complication is that, because eating too much salt raises blood pres
  '8ce86bbed4b1bbac6ccb5e5e96db9706a115e56a36a9a5b6936ad703434ef478': "富裕国家也未能幸免。", // Nor are wealthy countries immune.
  '94692086ac6df24c2a5fea83a56a662754130ec923ca672b2e9fa17d52036b41': "对于大多数富裕国家的人来说，碘是一种容易被忽视的营养素。", // For most people in wealthy countries, iodine is the kind of nutrient that is e
  'fd78f22754a08a4f4501ba4edf124bf778f49f692c8b1f27293ef119ef818302': "不过，这项成就还没有彻底完成。", // That achievement, however, is not yet complete.
  'ba54a5f561f71513dbf83b95e06bf95a892a0cdc1f46ba5adb4c9504c43d6592': "几年之内，对当地学童的调查就显示，这种病的发病率大幅下降。", // Within a few years, surveys of schoolchildren there recorded a dramatic declin
  '66153862166d4a4a56c45dd7a9ac6415683556516e67677027cb28e9775595e9': "1840年，英国推出了便士黑邮票，这是世界上第一种粘贴邮票。", // In 1840, Britain introduced the Penny Black, the world's first adhesive postag
  '171fdc02f60975e78b73dd0f56018e02ba838131e5932689af9fdb4686331536': "它既没有加快信件运输速度，也没有教人们阅读;其独特之处在于使预付款便携、可见且易于核对。", // It neither carried letters faster nor taught people to read; its distinctive c
  'db2b2ad2407eb1db7404c411c4d36d7c8fd4e34f24dabfed4ce8711b34734085': "通常，需要付费的那个人是收信人。", // Usually, that somebody was the recipient.
  '7bea718bbfac42a0a500d344d43f71172f621f9123f092662f973204fa15dfc1': "因此，意外信件可能成为不受欢迎的开支，拒绝接收意味着邮政服务未收到款项就已投递。", // An unexpected letter could therefore be an unwelcome expense, and a refusal to
  '502882c76cf6a0317986fc6599a6b979e35810e43c9a68b8482091d391b6df14': "在这熟悉的物品背后，是一项服务销售方式的重组。", // Behind the familiar object lay a reorganisation of how a service was sold.
  '59f394d034ed2f04cb41634d5e620f2bebb53a03de68f02cbe1cad2f72afcde7': "变更后通信扩展，尽管邮票本身无法解释这次扩展。", // Correspondence expanded after the changes, although the stamp alone cannot exp
  'bc88e93984f16f46542c67d02377e97c6df5620ad2da2155cd396a92bb2b97c1': "对于寄往国内的普通轻便信件，预付一便士即可覆盖旅程，无论距离多远。", // For an ordinary light letter sent within the country, a penny paid in advance 
  'f190656294ee21d8dca4c3043d49ea71f7265e12738dea8ee6875b21743dde38': "低廉的费用和更简单的程序和那张小纸条同样重要。", // The lower charge and simpler procedures mattered alongside the small piece of 
  '57c5b9b9fa09f6c628f0baf7cdba32e18226d97be8a7177645361a66d2bb18f2': "邮票是寄件人已付款的证据，而非最终收到信封的人购买的票。", // The stamp was evidence that the sender had paid, rather than a ticket purchase
  '2d39c5259d678b63b2d6908ffd46c74d96dc2ef0304d825b7ccac5201606009c': "收集、分类和送信承担了大部分工作;沿现有路线再运送一封信件，增加的工作量相对较少。", // Collecting, sorting and delivering letters accounted for much of the work; tra
  '589f6b3054bbf7bdeb8b895995d8c8f7f1eed4402459710c67880dbcecf17665': "该提案将注意力从单一信件传播距离转向了将许多信件汇聚在一起的网络组织，使共享系统成为他推理的核心。", // The proposal shifted attention from the distance an individual letter travelle
  'd0d3efd221d1f25357fb5643f3c0bddca9945e495dc7ed2e5076c68f7d89edb4': "十九世纪初，英国信件在送达之前，必须先支付一笔根据信件距离和纸张数量的费用。", // Before a British letter could be delivered in the early nineteenth century, so
  '159f0d4eb5c11a41d8d95d9d7192af75399e90a38f69ed4384951333845abd08': "随着材料干燥，收缩使变形逆转，鳞片向外张开。", // As the material dries, contraction reverses the deformation and the scales mov
  '9568cad385e2389d3257c62f8fb83917ffb3297da5853f4616c6c767d2e4dedc': "在许多松树中，这种可逆运动调节了种子的传播，尽管负责的组织已经不再活着。", // In many pines, this reversible movement regulates seed dispersal, even though 
  '6ca18650676798fdca93a8c37ec9054e738502cef2f6128eb42070ea394da1bd': "受潮时，它们又会闭合。", // When dampened, they close again.
  '4e1ac818d17b4ab732ffe9ec48e8a984d89c2c1104d1f66b556931577d15a199': "空的松果仍含有会对湿度作出反应的分层材料。", // An empty cone still contains the layered material that responds to humidity.
  '5bec43b63231dbc9ada4fbc59a19587f41117b3a14ef9adc76fd6a52dd666a97': "许多松子有细长的翅膀，这减缓了它们的下落速度，并允许气流将它们带走。", // Many pine seeds have a thin wing, which slows their descent and allows air cur
  '7370ba208bd77187eef3c124a0fafda1e410d8506ed519652315d028e63f5f87': "对设计师来说，这提供了一种替代方案，可以取代先由传感器检测变化、再由电机产生运动的装置。", // For designers, this offers an alternative to devices in which a sensor first d
  '2a9309ae3147d65a76de1f2d81cb48784bba50160802dcf9821fe5fe3bb1afc8': "此类设计仍需适应其预期环境：在仅需特定温度移动时，对湿度的响应不合适。", // Such designs would still need to suit their intended surroundings: a response 
  'e5b0db3c5d0684d5bc96f0764067f8eb9f8edef34841b85fbbfb384055117b2d': "其持续的响应反映了持续的结构不对称，而非持续的生物活动。", // Its continued responsiveness reflects persistent structural asymmetry, rather 
  '35270d8fd3da429cce78b8dfd76302d0d608ed5fc97ae8911bd5e5f63fe30b0c': "这种被动机制不需要树的信号。", // This passive mechanism requires no signal from the tree.
  'db7d38fcd413dfdad83ae41f71bc091289fa6ce73eb0bd7f2111c1d95feb0ca9': "由于这两层材料仍彼此相连，膨胀程度的差异使整片鳞片弯曲，从而使松果在潮湿条件下闭合。", // Because they remain attached to one another, this differential expansion bends
  'bbf9b560016df755b7ebe6ace95487c6b1804106c4b33eb33404a0ecb7a8d9a8': "松果从枝条上脱离后，甚至种子散落后，这种运动仍可持续。", // The movement can persist after a cone has been detached from its branch, and e
  '757a9a2a34d019c08bbfbc9e635364eb1eaed8fe062f71c15c7f41f26a3da867': "但如果放在干燥的房间里，重叠的鳞片会逐渐散开。", // Leave it in a dry room, however, and its overlapping scales can gradually spre
  'a61e8c48821735040ed0dd7227ad1d4192b06a4102f79f451eaea78a4d84d18a': "相关的环境变化必须与设备的用途相匹配。", // The relevant environmental change must match the purpose of the device.
  '68273dde617a7731f03d6173ba1dd9af3f3c0eb3d193c502635bf4bbeb3192a1': "这种近似是不可逆的：一旦消除差异，较小的文件就不再包含原始数值的证据。", // This approximation is irreversible: once differences have been removed, the sm
  'ccab7db2994461b38040b45bf41dba5d0a00f00593560f5722937d29ae5f6717': "充满细微变化的照片更难用这种方式缩短。", // Photographs full of subtle variations are harder to shorten in this way.
  'd916a463319b6b190d25bb4b9f797fed6685ad5f3799c6408e6e90f955638db4': "因此，有损压缩接受另一种妥协：丢弃部分信息。", // Lossy compression therefore accepts a different compromise: some information i
  '319e434e0c0c03f5527d6e63a3e85f1360af8f04b8ca0b9db6831ed005c11728': "程序可以利用更简短的描述来利用这种冗余，而不是为大均匀区域的每个像素单独记录相同颜色。", // Instead of recording the same colour separately for every pixel in a large uni
  '8209ea4fe291c4c49270a556f960496f2e6555764f88468bcd51766d6fa31a71': "放大图片可以显示这些变化，但无法恢复被丢弃的信息。", // Enlarging the picture can reveal these changes, but it cannot restore the disc
  'd4c2c2caff143c3b362fa891cf4c2702d555342d9b952e33b1631eb8c9f237d5': "这被称为无损压缩，尽管节省的幅度取决于图像中可预测结构的多少。", // This is called lossless compression, although the savings depend on how much p
  '94afcac4a02f75934e0a0e2e42ae5d061b8d75669cbb98af87bac85bed5393d7': "当文件被打开时，原始值会被完全重建。", // When the file is opened, the original values are reconstructed exactly.
  'd2d884b29e14f059c29dfbbe42e93214a041ad6d14e1aef9b6d199b5dbcb9fd3': "数字图像由称为像素的微小单元组成，其颜色用数字描述。", // A digital picture consists of tiny units called pixels, whose colours are desc
  '97de2bbe51279dda8fa6bb202397693a1290a32d02d4494eb5355583c31e08f5': "较小的副本可能足以用于快速预览，而原始版本为后续编辑提供了更大的自由。", // A small copy may be adequate for a quick preview, while an original allows mor
  'd5ab9c18ea3c7741c53a49131f09a8d69fc6d99b59f267a0d9c79f440298679f': "这些畸变被称为压缩伪影。", // These distortions are known as compression artefacts.
  'abd56c4b592b6ecbd63a345165ad2c572f4a74d4dbda0cfbfe31a0f676b55b0d': "压缩改变了信息的表示方式，使得描述图像的符号更少。", // Compression changes how that information is represented, allowing fewer stored
  'd1e45140ab5a794a16190e8dc316e5eb2ec56b531fbb4d819a2268fd18f3721b': "缩小文件不一定意味着减少其宽度或高度。", // Reducing a file does not necessarily mean reducing its width or height.
  'cc936b8ff7ba56f23845258e54d62aa8818e8fe144600cac7d8e4ff87fa98ca0': "看来，目标词并没有丢失：它的意思和一部分读音都还在，只是其余部分怎么也提取不出来。", // The target word, it seemed, had not been lost: its meaning and part of its sou
  '5522c26a6acbfc89b8991689e94644c2168899bf2d9e5496c3dc13e61a969e2c': "后来的研究让这一认识更加精确。", // Later research has refined the picture.
  '4c36d99199d0548e8e0a7233239b5bdf83a019e9fb09f54ae1a5052b5d81fd1c': "这种体验早在1890年就有人描述过，但直到20世纪60年代，两位美国心理学家找到了诱发它的办法，才开始有人系统地研究它。", // Although the experience was described as early as 1890, it was not studied sys
  '399c30cbdc43569be86f1db5040520d60218765de40d0fe02fec721ed723da51': "心理学家称之为“舌尖状态”，这种状态非常普遍，以至于许多语言都用涉及舌头的表达来描述。", // Psychologists call this a tip-of-the-tongue state, and it is so prevalent that
  'bbb2b01f6777a66cb76b53e735795b254ba843ff392d9dfc4d20e57f10f594ea': "你试图回忆一个熟悉的词，虽然你确信自己认识，但它依然难以捉摸。", // You are trying to recall a familiar word, and although you are certain that yo
  '2525a347e67639f8b7228134516548308b17992e8027341aebdefb7c1c61cab7': "许多认知心理学家倾向于一种说得通的机制：一个词如果最近没用过，它的意思和读音之间的联系就会变弱，所以意思想起来了，读音却想不起来。", // One plausible mechanism, favoured by many cognitive psychologists, is that the
  '54a65f8561ee28ad9998b3e87ee1eac2994f764810043700e1990ad715d81737': "几乎每个人都知道那种令人沮丧的感觉。", // Almost everyone knows the frustrating feeling.
  '91e91a4a1f1a33a973920c07aa516f169839000c2033f22486deee66b7329776': "他们读出一些生僻词的定义，比如东亚港口里一种小船的名称，让学生说出这个词。", // They read out definitions of obscure words, such as a word for a small boat us
  'e09b86cb867572c193924f0eedeb5b848fa97d399f862666329a29d936bdec9d': "人名是最常见的原因，而会说两种语言的人报告的频率更高。", // Names of people are notably the most common cause, and people who speak two la
  '12dec1006d635c11ddd473874e9c4505137a92e3e7b2e41193d5c26ee80de788': "当答案是“舢板”时，一些学生想到了发音相似的词，而另一些则想出了其他船只的词。", // When the answer was 'sampan', some students thought of words that were phoneti
  '8fb2ced16c84127de2fabc3145d97b90150e62653a90b308dbc04e23545a554c': "处于这种状态的学生，猜出所缺单词首字母和音节数的准确率，往往远高于随便乱猜。", // Students in this state could often guess the first letter of the missing word 
  '4d8dca62e4323ab297ad500f6d447f8ad78ba9e1e12d11952974ab3c0e87d6c0': "它非常脆弱，所以我们把它放在容器里带走，并用柔软的纸保护它。", // It was so delicate that we carried it in a container, protected by soft paper.
  '05f84ddf5d9dd67d51fc2d231d1eca3376f1f13340c6b9ebcc8f690fa036f01a': "我们的社团负责人解释说，那是蝉的旧外层覆盖物。", // Our club leader explained that it was the old outer covering of a cicada.
  'eda8955f676e0172cda64d7200c785f36e8f458fc8b880c23483a3bddf97f12b': "照片上显示了翅膀，而外壳上没有。", // The picture showed wings, whereas the shell had none.
  '3c2f3745bb776133ab7e5705165e5f99b6d1f1aea3989398075b91ac645132d3': "随着昆虫生长，这种覆盖物无法膨胀，因此必须更换。", // This covering cannot expand as the insect grows, so it must be replaced.
  '90905094789b9d7593f3da30e5bdee8392558552023d6c9d28b04bb221a068be': "我们一开始走路时想找点活物;现在大家都想检查空无一物的东西。", // We had started the walk wanting to find something alive; now everyone wanted t
  'a32ca6102742fe34c0ebbfdb0bae8cfd10b459db912b1f0a407699f5b234dbaf': "自然社出去散步时，我的搭档注意到树上有一只棕色的小虫子。", // On our nature club walk, my partner noticed a small brown insect on a tree.
  '1cffb277d171934c4c2fdf4933697ec2e3ee7b1d0b80c97c10d0f5825537d69c': "我们等待着，不愿打扰它。", // We waited, reluctant to disturb it.
  '8fec37182ba4cc1dedf59d1308f09836fe3ca46c2e253d574f3cd55b7cf974e8': "我在想它是否只是睡着了。", // I wondered whether it was simply asleep.
  '0c7ce95eccaf9f745ccdcec3f930b96ccf0affb75cdd9259af8869c7419e7faa': "最后一次变形时，昆虫从背部出来，留下了旧壳。", // At the final change, the insect comes out through the back, leaving its old sh
  'bf1bd3ed72f24de64ce9c50bef1054b7a43cc39616fd91c56483d88bb07d1dc8': "渐渐地，我们的兴趣发生了变化：我们现在想了解在我们到达之前发生了什么。", // Gradually, our interest changed: we now wanted to understand what had happened
  '6ceb7bd843652678f30f3b6fadd885ec01582ba2021ee75122c3227b3e0a06f6': "通过这个，我看到里面是空的。", // Through this, I could see that the inside was empty.
  'a0c984f36756cf05b491cbf58434f9d800daf76c0a3c9f94b66e31adcbadaa4d': "拿着一张新纸，我的搭档按照修改后的说明做了一个口袋。", // With a new piece of paper, my partner followed the revised instructions and ma
  '9a32ad0a8520626dfffcabf495225d754ee383b53485afe63c7efbf2a2aff9ac': "老师让我们标记每位读者困惑的确切地点。", // Our teacher asked us to mark the exact place where each reader had become puzz
  'c5dd5cd321e1cf7d0173e9b39e55e54bc2b3b106f3920f76a6c65754a028f8f2': "在文字旁边，我加了几幅小示意图，展示纸张折叠前后的样子。", // Beside the words, I added small diagrams showing the paper before and after.
  '3fe306f9532cebafaa0543e44da7c4fc570bcb90a9c0b571554002f1678a3c60': "我很有信心，一边看着自己的页面，一边又叠了个口袋。", // Feeling confident, I folded another pocket while reading my page.
  '43804626c8a5232c47b5a30fd970fde595bef2b76bfb089534ea89104f7015bf': "在英语课上，我们被要求写下制作纸袋的说明。", // In English class, we were asked to write instructions for making a paper pocke
  '1e3b11b6064f4d1148d145cc95c6c5a6c5bbebb8ca0530ff2b7015de08172b3a': "每一步都显而易见。", // Every step seemed obvious.
  '8a72227b727796ac801c4e5f8321c4b0bb6e4399070e13d8588a09b8b632a239': "我原以为她会知道我指的是哪一边，尽管说明页上从未写明。", // I had assumed that she would know which side I meant, although the page never 
  'dbdd19ec4afb1187b20e15ee74475c40e86983759b4b28f5370d2951763f7b86': "我标出了自己写的第三行，而没有把所有内容都改掉，也没有责怪搭档。", // I marked my third line, rather than changing everything or blaming my partner.
  '7a7218cf75652934ac72e4d3c074f82fbfcac73cd5ca81b6f0956078dc027c18': "这一次，说明文字发挥了之前由我自己的已有知识发挥的作用。", // This time, my explanation had done the work that my own knowledge had done bef
  '7d8a25a529fe115688670043d08498259a84ec5298e4b72ee7fa1fa8c8a19164': "她的纸张形状不对。", // Her paper was now the wrong shape.
  '691e26606cde69a57c4ac2118636ed969082fe6ce7300a7c4338cabe9e779452': "我们的伙伴们拿到了新纸，但他们看不到我们制造的口袋。", // Our partners were given fresh paper, but they could not see the pockets we had
  '1b1a674dc5d68472d153ca34f1facea9f0f35fff7117d206d68e9b11c73b5166': "然后我们交换了指令。", // Then we exchanged instructions.
  'c2e8c122428ac60702e51615cd917e3e58d132d3f8440e4818a9f53136e1111f': "在别人尝试照着操作之前，这四行简短的文字看起来已经完整了。", // Four short lines had looked complete until someone else tried using them.
  '1c75e7de624a7924d5b86b0bc5fd5001eba913599903e9bc8f35fdd99f149fe3': "获准修改说明页时，我补充写明了该把哪一边朝中心折叠。", // When we were allowed to change our pages, I added which side to fold towards t
  '7c339784da7a250a959eccda2e183365427e577ff4a626376d5726253c3f3307': "然而，对这次展览来说，原始图像也很重要：它让访客了解我们家平常是怎样道别的。", // For this exhibition, however, the original image mattered too: it showed visit
  '71304fb03f51187dcd23530b99b85992b5fc16508a180c8cbe311e7642a12755': "临走前，她大声读了卡片，然后微笑着用普通话对我们说了那句“慢慢走”。", // Before leaving, she read the card aloud, then smiled and said the Mandarin wor
  'eb9cb0e31936da6d43770a55448d90d6eb36b7d8bc872345328b81daa9a21a64': "在展览中，我们把它放在出口旁，而不是放在行走画旁边。", // At the exhibition, we placed it by the exit instead of beside the walking pict
  'c30b6351d59c852f344cf9def6e96e66a2a40ff45b5eababcad17257e90c7618': "我把这些话按字面意思翻译了出来，但搭档觉得这张卡片该放在一张教人走路的照片旁边。", // I had translated the words directly, but my partner thought the card belonged 
  'a589c91ef36bc9446e7423174f8bd5646363c7df8e354e894909451ef526f192': "她说意思很准确，但熟悉的走路画面消失了。", // The meaning was accurate, she said, but the familiar picture of someone walkin
  '935c7252e07c8015c4937a6b91725320eddb506166ac110052fcf53f7d974a6c': "一行给出字面意思“慢慢走”，另一行解释这句话的用意：“保重。”", // One gave the direct meaning, "Walk slowly"; the other explained the intention,
  'e83ccc9245cf1e53b6a8a8d169b238cec49af26146eaeb66eee31440337fec95': "我原以为翻译只需解释信息即可。", // I had assumed that a translation needed only to explain the message.
  '989b1c739a12ad07804f2c8230b2fbe60f06955d1db24afcd6132b7bd0db24b8': "“我祝他们旅途平安，”她解释道。", // "I am wishing them a safe journey," she explained.
  'b6c5746cbab1e8013775f5b4488e69e6c2990cb3fab15c5d54e80acc51083920': "在学校语言展览中，每位学生都带来了一个家庭用的表达。", // For our school language exhibition, each student brought an expression used at
  '4b23dd322e3121708328f723c6feb44921ddb4c0cdb8b175d930eb0c68d43fda': "我选了母亲在客人离开时常用的那句普通话：“慢慢走。”", // I chose the Mandarin words my mother says when visitors leave: "Walk slowly.
  'f9a6e0c3c9369e762adeae85493f754141f8c7d84a08b89cfa77d6e644c29f93': "我母亲来参观我们的作品。", // My mother visited to see our work.
  '21c1fac007b240cb6fd477f4a35ff87fa27316be76377fd7f9aa3ce734c8769e': "至少现在没人会想象有步行课了。", // At least nobody would imagine a walking lesson now.
  '2bceee34476da478ce6cd23d4b6e43d10467c23ceb8a285766dc597f5a918ad7': "九月，居民委员会提出一项建议，想把这块地改成花园，但想先听听附近居民的意见。", // In September, the residents' committee announced a proposal to turn it into a 
  'd69e969ab54a5562fc3a85659dd402f08e24a5542fc24d49197455d89610591a': "渐渐地，我们发现了一件以前从没注意到的事：这块草地很少没人用。", // Gradually, we saw something we had never noticed: the field was rarely empty.
  '9409c40714d4f31c23be62032ab26a377885f6bd843a73eaee45a8f692e09d65': "答案显而易见。", // The answer is obvious.
  'e192ea4f669173cff0ac9e8f1ba7365c1d73477c28e0227bebb577ccbb12945a': "大多数人，也就是78人，给出了我们未曾预料的回答：“保持现状。”", // The majority, 78 people, gave an answer that we had not expected: "Leave it as
  '7989e2201325a6e0dd457cc40f2807c2f8736de05313b5fef2d26a974d898555': "我们大多数人也这么想。", // " Most of us assumed the same.
  '04b040f438c220bc5d7757d544d6fa05e4ef1ab86a522f7b2dbf17b599ef5e52': "晚饭后，有些家庭在那里打羽毛球。", // After dinner, families played badminton.
  'd4cef4447b5b61b9da91c4d9b28f0a535f73a9781c578c32a397f080dbb91f5a': "于是我们做了一张海报，贴上这块草地在不同时段的照片。", // So we made a poster with photographs of the field at different hours.
  '2149ece15a2d855e7a4c9612042e77676aa4d10e38d09fe29bb84848b339fadc': "委员会改为加装了两盏灯，让草地天黑后也能用，还装了一个水龙头。", // Instead, it added two lights, so that the field could be used after dark, and 
  '1a7e3ea889000999be14c0f7c1a3b448f00d1313066c04df1ed248427f503245': "一位老人解释了原因。", // An old man explained why.
  '8a5ba054ccf2db25175f2f56f49873b2b4c6704985b8c815d962d6003e517f3f': "然后他建议向委员会展示证据，而不仅仅是数字。", // Then he suggested showing the committee the evidence, not just the numbers.
  'ade785c3ffbf5ac1d4d3980d69db0434af91e8097072325ddd8e92804b1a1d15': "连续两个星期，我们每天早晚都站在这块草地旁，问每个人同一个问题：“你希望这块地变成什么样？”", // For two weeks, we stood by the field each morning and evening, asking everyone
  '3bb6831cbc3a6a6d5488ff15fa516856706de8a825e2b931d5d9d167b6b3f375': "那些曾经感觉像经历的知识，现在看起来却像是我积累的细节，却从未写下来。", // Knowledge that had felt like experience now looked suspiciously like a collect
  '4440faa04fb9c1b4fb996312fffacbf44dfd5207058ffbedc48e762f158d06ec': "我努力抗拒干预的冲动。", // I struggled to resist the instinct to intervene.
  'd91f17215c5c0d1da6f3bd66030a53c47fe856e29e101c2bda12fad9b4732bf9': "六个月后，我知道哪些盒子缺少零件，也知道哪个橱柜里放着备用棋子。", // After six months, I knew which boxes had missing pieces and which cupboard con
  '060eab0437716006285996f2b5395923e7e659f0b29fee39d694270361ad3e37': "不过，我们刻意让桌子的摆放保持灵活：使用带轮子的椅子的访客可能需要更多空间，而人数较多的一组人可能更喜欢把两张桌子并在一起。", // Yet we deliberately left the table arrangement flexible: a visitor using a cha
  'e0fd29c7951853edd9c36217faf5a56ffaaf506ec47193aff8c2ad48bdbd1d63': "在每个游戏标题下，我们列出了缺失内容及其替代品存放的位置。", // Under each game title, we listed anything missing and where its replacement wa
  '6868527f418a2cd8d7623e64c1d40610b8bb17125449ad88111423edee6befea': "我知道它们装在不同的盖子里，但没有标签把它们联系起来。", // I knew they were inside a different lid, but no label connected the two.
  '71082cb076eba8ef44bb6834ffd5a43371430a1f79dda386b5203dda81219f47': "每个问题都暴露出一个我没有明说的假设，而在我尝试不靠手指指点来回答之前，似乎没必要把它说清楚。", // Each question exposed an assumption I had left implicit, although it seemed un
  'ad85123b5f796847192b14f2d4998642889d38b71601fd9b367e30d34fa0feff': "每个星期六，我都会帮忙在社区中心举办一个下午的桌游活动。", // Every Saturday, I helped run an afternoon of board games at a community centre
  '060468971033b07b032cf9efe8990e98b1fc88275cc1b5fd9058ae3759bb3083': "读着这些内容，我点头称赞自己把六个月的经验高效地压缩成了三行简洁的话。", // Reading it through, I nodded at how efficiently I had reduced six months of ex
  '45a2e8677b8456e0a72272acb095b32bbf3c6d642f0e652a750af7e60adf98f2': "每次屏幕亮起，我都会检查一下，然后再吃下一口。", // Every time its screen lit up, I checked it before taking another mouthful.
  '54bf4cc7b95c5593998967b19cf2097731a6457fc4d1e58cc14b4e9fd95c4231': "我放大了照片，准备解释我的布置，这时注意到备用的零件摆在手边。", // I enlarged the picture, preparing to explain my arrangement, then noticed the 
  'bf6705d828802e00daf2a96d657264a402e2acddf41c30a787ca3d0b79f92451': "我误以为简洁是清晰。", // I mistook their brevity for clarity.
  'f07dce375163197261341a9c3ac0fb0afb345cd994f399390cee341214b4141b': "这种依赖让人安心，尽管我把“能帮上忙”与“仍然不可或缺”混为一谈。", // That dependence was reassuring, although I confused being useful with remainin
  'd2e3daa230aa0eb7d125e2d8d1d98318fb3a3cff0236cf9a04208eb0ab1d4aac': "每当志愿者有问题时，总有人指向我。", // Whenever a volunteer had a question, someone pointed towards me.
  '0971f1ad1585b09e62e503d45820d6f6a6095a18b6ee9ff78318d5c864a4baac': "那份沉默第一次感觉像是我自己帮忙制造的东西，而不是被遗忘的证据。", // For the first time, that silence felt like something I had helped create rathe
  '2240c1f259dec4bff153aeaf3bf0983a393f3da75f52f1ba5ad8ce85a7813b8f': "当哈菲扎邀请我为她的短片写英文字幕时，我毫不犹豫地答应了。", // When Hafizah asked me to write English subtitles for her short film, I accepte
  '82626f39cb764c6785a5d9aadf6f5333fc9c697d9ebfbbab5059ae076c930a48': "有些微妙之处难以用简短的文字表达。", // Some subtleties resisted compression.
  'e5afefc5be7faa2c5d614cc47f8133dc637f9ce15f854f0a404c905b2ca0c2fd': "字面上的准确似乎保证了清晰度。", // Literal accuracy seemed to guarantee clarity.
  '7f4c56a2901e69ff797dc55dd3c9a75bbdb13a02744788d02e363d448b4c2908': "这次幽默感跟着邀请而来;我最初版本中的模糊让他的回答听起来像是又一次抱怨。", // This time the humour followed the invitation; the ambiguity in my first versio
  '7f4103088506a4ad20c98d203c747c0439f14c0f463e178111e4cf129803b6f7': "她的礼貌既承认了他走来的距离，也承认了与他相伴的喜悦。", // Her courtesy acknowledged both the distance travelled and the pleasure of his 
  '8eff041b879ffc175a2599cab49d369b022317166d9cf46b1d6409aecdc2f7ae': "我曾以为翻译需要完全的确定性。", // I once thought translation required complete certainty.
  '4874e7abb670f775fddfd473d6adb743797cbfc82c5595f4cbfaeefccf1e6c2a': "接着，姑妈看到她的表亲站在门口，说：“你特地跑这么远来，就为了喝茶？”", // Then my aunt saw her cousin at the doorway and said, "You came all this way ju
  'efc9d10a988f8e3319fcfcf39dc7755c68b988c96a1ddd5530c2297a505e180f': "我盯着她看，不愿接受那种解读。", // " I stared at her, reluctant to accept that interpretation.
  'eadce9ca412b791e80759022ddb4649735a72af764a80b557994510819631f79': "开头的话很直接：把杯子放这里，再拿一把椅子来。", // The first sentences were straightforward: put the cups here, bring another cha
  '941cfa49c9237999b563221f08144afb293c284ff407987c3acc5fd318c1d465': "我能听懂两种语言;为什么传达这种微妙的欢迎感觉如此困难？", // I could understand both languages; why did conveying this subtle welcome feel 
  'b031143ea9c46b989079c2d64d44df2008bd35c73b421d39e98041f3ef21a886': "不过，单看这句话，暗示可能像是在轻视。", // Read alone, however, the implication could sound like dismissal.
  'd305544f5168e6c64aef93e6d10d505caa5e62f8919fd17a1193f031b51ae71f': "我们的下一个版本保留了这个问题，并加了一句简短的话：“你特地跑这么远来就是为了喝茶吗？", // Our next version kept the question and added a brief phrase: "You came all thi
  'a66b283ad86a5a8b6bad2ddabf50d9186674b460dc224cdee0805e34d09e7dab': "她还提醒我，观众会看到她的手朝椅子移动。", // She also reminded me that viewers would see her hands moving towards the chair
  '06d9c633b9a439b4294f3be989a50f3233bc07b5e9a36b06b793016fb48f0cc6': "当我把它简化时，所谓简洁的解释听起来像正式演讲，尽管我姑姑在笑。", // When I shortened it, the supposedly concise explanation sounded like a formal 
  '7fba5ebfdbb92bc289d4f1f2f0b67996647ce9b1d25e3fda902f511088f5d689': "用信息填满那段沉默，就会掩盖她脸上流露出的那一小段作决定的过程。", // Filling that silence with information would have hidden the small decision tak
  'bdf68a8d74e2365a866537774e274a2a903e03d38e44ae27982442296bce91da': "她说，自己当然很高兴他来了，但只写“欢迎”就会抹去她对他特意赶来的惊喜。", // She said she was happy he had come, of course, but simply writing "Welcome" wo
  '2927cbfd11ae49216aa3c453d4509898c74b16e51b951b0652bfee6899d33294': "当每个主张都需要对一本没人读过的书做详细总结时，这种集体调查就更难了。", // This collective enquiry is harder when every claim requires a lengthy summary 
  'ab141350295f0238d74c2591cdecf17c68cf415ffac3b7f93516623a59e6f72d': "虽然一本规定书确实能让讨论更简单，但简单不能成为限制自主权的理由。", // While it is true that a single prescribed book makes discussion simpler, simpl
  '94afcc73715ab01f70d986bc50fffaf9f11b1bf62af5667866dfd2f5b9912a01': "课堂上，我会保留全班共同阅读的书或选段，并加入有指导的自选阅读，让大家从都能获取的书中选择。", // For lessons, I would keep a common book or extract and add a guided choice fro
  '063e17556efe8524f8a2efe1c4612519b8ba2891e58a8d0ac91b3c69e0d65518': "当老师建议这样做时，我松开了手中的书。", // When our teacher suggested that arrangement, I relaxed my grip on my book.
  '4fa78134dd6167c387b43d65f59890288f3076a43559a8daf874e43f61450ade': "我猛地合上书，恼火的是值得讨论的部分从未达到。", // I closed the book sharply, irritated that the part worth discussing had never 
  '83bf8f4fe47fede82df858ba6f830153660fc402fb9daed3d4a11ed61845d67c': "当老师允许我们自己带一本书和班级小说时，我就认出了这个理由。", // I recognised that argument when our teacher allowed one book of our own alongs
  'fd967f0e74e7287120c5c1d24ebe136782126e7a4ab0d547fee4df8f43bb738f': "要求在更改前进行对话，既能保留真实的决定，又防止最简单的书自动成为最终选择。", // Requiring a conversation before a change would preserve a genuine decision whi
  '62b2bdbaf0f3d46658169a7d05e6f55b9ac62b377fe3827f66d00f8981584f3b': "选择还要求读者为自己的选择辩护，并承担决定责任，而不是等待被娱乐。", // Choosing also requires readers to justify their selection and accept responsib
  '92da34b1b6aeb4e465e1e449b9c4814c8da2cf9a6f449ce5f3673c8232bafcf7': "当每个人都读完了同一段文章时，每个解释都可以与全班可用的证据进行核对。", // When everyone has read the same passage, each interpretation can be checked ag
  'e43ff3a46a01164c05536c5865821d4cee99e2597f28f90bc19865800e51c1e7': "不过，这些顾虑说明需要指导和公平的资源供给，而不能据此断定学生不该作任何决定。", // However, these concerns support guidance and fair provision, rather than the c
  'ad2818e9f6928d51be760a4b4c6b4a0bb615fef7f48de4cf89116d1d0c897590': "老师可以询问角色为何保持沉默，学生们可以通过回到某句话来互相质疑解释。", // A teacher can ask why a character stayed silent, and students can challenge on
  '187f11dfd8f33544ef197f95560e1835fabeb5e201aebc55929c2ff172b5cb64': "一个对建筑设计很感兴趣的学生，可能愿意研读关于建筑师工作的较难读懂的记述，却放弃一个主题对自己没什么意义、读起来更容易的故事。", // A student fascinated by how buildings are designed might willingly examine a d
  '94b4b2520ef7ffca7775cc151e187a72b0b995f6cbf16c5b30ebb25783fc26ac': "自由选择可能让读者无限期避免陌生风格。", // Unrestricted choice might allow a reader to avoid unfamiliar styles indefinite
  'c90a16d3316f7502c2568fa0aee2e8d1336f36cb7d5aefe63c47e940d079c651': "支持选择权的人认为，当文本变得困难时，兴趣能给读者继续读下去的理由。", // Supporters of choice argue that interest gives readers a reason to continue wh
  '457ff6766639088afa71e17f108f5fba6da6dd0d0eb6b149873edad0dcdc1e96': "学校应在能够提供合适文本、获取渠道和讨论时间的情况下给予学生选择权，如果缺少这些条件，自由的承诺可能仍比它带来的学习更有吸引力。", // Schools should offer choice where suitable texts, access and time for discussi
  '2940180ef53decaae0be363665a22fad6545a167157da32ffe8dc71917b9df50': "我开始解释一封信，却把轮到自己发言的全部时间都花在描述这封信背后的旅程上。", // I began explaining a letter, but spent my entire turn describing the journey b
  '4776c915b10aa12fa374e8be66bd2a384aa20fd69a8fa074cc8080b47a58a906': "选择同一个标题的小组可以一起讨论，然后带上一段短文到课堂上。", // Groups choosing the same title could discuss it together, then bring one short
  '843329328e709dd36a94a5068911a2b86fc812944b96dd401922ba184b1960af': "我们点头，确信他在夸大其词。", // We nodded, convinced he was exaggerating.
  '08a84653831af426e921e48f87d8ea3f8c16fc5b84452f36c1def32425245694': "他告诉我们，一项著名研究的研究人员开发了一个程序，似乎能区分狼和哈士奇，结果显示它主要在寻找背景中的雪。", // Researchers in one well-known study, he told us, built a program that appeared
  '3146909710def1aed7aff34feda385ad02357cbae43c88b6a3546d17db623528': "两个数字都写上了海报，中间画着博文的拖鞋；程序这次只有52%的把握说它是易拉罐，施蕾娅说这是它在“耸肩”。", // Both numbers went on the poster, with Bowen's slipper drawn between them; the 
  '0ac092c0ebf5ce2116a9dc0eb99139ab6cce35ccd35b285e590feff43a3e0618': "于是我们把每张照片都重拍了，这次特意换了各种不同的场景：食堂地板上、书包里、别人手里、走廊的黄灯下，当然还有我家厨房的桌上，这样所有易拉罐照片唯一的共同点就只剩易拉罐本身。", // So we retook every photo, this time in deliberately varied settings: on the ca
  '2bd437cdb2cf90a3aa0f05dc8b87e603a198827ebe432554c1220a5ae3d05ccd': "原来它注意到，每张易拉罐照片里都有一张白桌子，每张瓶子照片里都有一张灰桌子，这条规律比任何关于形状或标签的规律都简单得多。", // It had noticed that every can photo contained a white table and every bottle p
  '66530204ee7fb772748a4ac9c7102ddc0a3c6d95756107fe168a26698f994691': "“别这样，”我厉声说，抢回手机。", // "Stop it," I snapped, grabbing the phone back.
  'ff341dce02b7dcc5ae739bfa3eac403b940b99f632ff42916a0a72dcf73fc936': "我花了整晚才勉强接受这意味着什么。", // It took me all evening to accept, reluctantly, what that meant.
  '8c906387a8e87d0a815139f91fe1da84892dc801d73ff6e1629775398953741d': "我把这个数字发到班级群里，后面加了三个感叹号，施蕾娅已经开始对着镜子排练我们的展示了。", // I sent the number to our class chat with three exclamation marks, and Shreya b
  '51a03662c784dc2c491302feedb07825900b1e15c2ba8d0cb147ecb2c5007366': "他把拖鞋放在厨房桌上，把我的手机举在上面。", // He put his slipper on the kitchen table and held my phone above it.
  '77a3980f061db542fc4728f661295e917ecb2a4ad06975fbbcabf75296041b43': "两周后，我为了化学考试复习，重复同样的二十道练习题，直到每道都答对。", // Two weeks later, I was revising for a chemistry test by repeating the same twe
  'bb8782bfe2e19751357c1817ee188e8a50d15564aaa62ba75081c9598e43a186': "屏幕显示：“易拉罐，97%。", // "Can," the screen announced, "97 per cent.
  'fead4e32c14c63e5dd93b5453c70f140a6fc943e1a63f668c9964841eeb433fa': "那个星期六，我八岁的弟弟博文闲得无聊，吵着也要玩一次。", // That Saturday my brother Bowen, who is eight and was bored, demanded a turn.
  'dece1b7a250d83aec1add84f207e941f98e8387fb56cad33f1848a51c4402be5': "施蕾娅是在科学实验室的灰色桌子上拍她的瓶子的，她每周三都留在那里。", // Shreya photographed her bottles on the grey desks of the science lab, where sh
  'a4f598b9af317704cd3814d4a68c4855659a5109718ea5752354dbf530279db0': "也许我学会的不是化学，而是那二十道题。", // Perhaps I had learned not chemistry but those twenty questions.
  'b47025a457b65d73f7f15fd324be13a5f5c865f2e9561bcb42c0fcb1a20b4df3': "我们98%的成绩实际上是认出我厨房的极高分数。", // Our ninety-eight per cent was, in effect, an excellent score for recognising m
  '6bb85f04251fa3f7799f962822a8e5011c152f12b99b6e357ae1c3ac8bc3706a': "我检查了两遍标签，困惑于贡献相等与负载不均之间的差异。", // I checked the labels twice, bewildered by the contrast between equal contribut
  '3f0c777a38421c9c13a5cd03e6676fee43f08a7c0650dfd0c08e8dd9fb1af382': "透明的前袋里有一个标签，写着“项目经理”。", // Inside its transparent front pocket was a label saying PROJECT MANAGER.
  '459efdd0fffb9718658702f9494f1da0c4444d2dbeededa7c82c368a2136275f': "我为他们的参与辩护，不愿将健康活动变成对我们学术工作的评估。", // I defended their participation, unwilling to turn a health activity into an as
  '95e60d168657dace727f23a4376bf854526992513e71f67f3255c864d5104845': "没有遗漏任何研究，也没人要求我放弃责任。", // No research was missing, and nobody asked me to surrender my responsibility.
  '2455deaaa7b664bc53448e28e3908b0500833483b672af4ba877afbf25bc6107': "其他人默默查看这些物品，它们正是我们日积月累的种种想当然的证据。", // The others examined this evidence of our accumulated assumptions in silence.
  '8033cf48139e8c6aa386ec5708f930888595c3a00be6a760e353a8856854e996': "在学校的健康周，我们被邀请检查每日的负担。", // During our school's health week, we were invited to inspect our daily burden.
  '8cf2c0e177890c15a2daae093c084136e8e179f926a85ef3eb8dc6cd7c1e43b2': "每项决定单独考虑时都很方便，且显然是自愿的。", // Each decision was convenient and apparently voluntary when considered separate
  '0d77476eb8bd063fa89b6e52eb9e32dbadfcb579fd81f75057f37a56c6920657': "最终，我没有责怪任何人，而是说明了问题，并提议把我们的材料集中到教室外。", // Ultimately, I explained the problem without blame and proposed assembling our 
  '0f0fbc278a49c2939eda0be490865fd8664642ff30d23bf7aa68335ead01ef96': "每当有人递给我另一件物品时，我都会调整标签，不愿让它消失。", // Whenever someone handed me another item, I adjusted the label, reluctant to le
  '4d1809af68f0a624548390e856e94139d9d88779f07b37243a2267bb26546096': "寄出前，我重写了三遍开头，还用裤子擦了擦湿的手指。", // Before sending it, I rewrote the opening three times and wiped my damp fingers
  '0d2bcdca0708bc0dfb48d48d3d374100e59c1fdce4bbe1855f6033f10a69f312': "我们在没有明确同意的情况下制造了集体负担。", // We had created a collective burden without explicit consent.
  '24df6e5352d20aac35bcdc32e9b736d43797e22846ea56f643fb94299598288c': "我们的地理展览临近，我感到对我们团队有责任感。", // Our geography exhibition was approaching, and I felt an obligation to our grou
  '398ff245ef04d4b2b3090c2cd282e622350c7720576748e3308b3422c3cfc7e1': "他们会不会觉得我退出了项目？", // Would they think I was withdrawing from the project?
  'd457789565afd8c0660f85a9d9004a3aad899c91c7319bfc12f2c4c374deea55': "然而，这些决定合在一起，已把一次主动帮忙变成了没人记得曾答应过的默认要求。", // Together, however, they had turned an offer of help into an expectation which 
  '77f1adfe9f4b22313c0795ad10bf9c138f324a08a7feeaa94ee9d8766f40e5bc': "不过，当老师建议把不必要的东西留在家里时，我解释说包里的东西都是必需品。", // Nevertheless, when the teacher suggested leaving unnecessary things at home, I
  '7a775f8d68c1d3117499400727eed99705f336510ce9ca26ca5262132f7cf7fd': "我立刻解释说他们都做过功课。", // I immediately explained that they had all done their research.
  '67a2c00944e29058264eb4ba251ecdbeb11f6f0f345665dc4ae01671fef1842a': "一个人把胶带递给我，是因为我的包敞着，另一个人则以为设备应该放在一起。", // One person had handed me the tape because my bag was open; another assumed tha
  'ce01a6e134964f8dd563f0f126d0ba79bb017c18c6043908165d598f357e8d27': "然后我们故意测试中断，断开又重新连接电缆。", // Then we tested the interruption deliberately, disconnecting and reconnecting t
  '98734f836e1d355504e21b280a41ace54efe34b932afc9173745d49853091f93': "每次重复都出现在新位置，暗示实际上进行了另一项测量。", // Each repetition appeared at a new position, suggesting that another measuremen
  '9e69bfcddea08474b86725179339529349a12ceba1bff7d6e232b01dcbd1db85': "检查设备时，我发现传感器和笔记本之间有一根松动的电缆。", // While inspecting the equipment, I discovered a loose cable between the sensor 
  '299a055c245261e3a0761ec687bf1a8d919cc2aae888acae133247a4e28f62ef': "老师解释说，只要替换线明确标注为估算，我们可以估算。", // Our teacher explained that we could estimate, provided the replacement line wa
  'f354ad3d4628936717b2db1b571201cf5521982ea9bed0924ebf9767a07c5a5b': "我调整了颜色，给图表贴上标签，满意它专业的外观。", // I adjusted the colours and labelled the graph, pleased with its professional a
  '1f0178fd26477bc0a1e49318dba7acaf08decbd6295538316066c66770877ecb': "另一个盒子显示了最新真实读数的时间。", // A separate box showed the time of the latest genuine reading.
  'e22675aa2f37cc3726b7a2bbe7c3fe660bf78809853768bd2adc98f75e9e7c2e': "我想要一个不被打扰的展示，却没考虑那种展示意味着什么。", // I had wanted an uninterrupted display, without considering what that display w
  '5aa5986091c1f9392ad4392937b5f379d3e6d39ed098e885ca697958945590c6': "检查程序时，我发现了一个自己加入的设置：每当无法获得新的测量值时，程序就会重复使用上一次的数值。", // Looking through the program, I found a setting I had included myself: whenever
  '64c2eceb8c6b8e208a7f46f50cd2d257a0484e7dffeccf6ba7329abee932ae45': "周四，这条线完全是水平的。", // On Thursday, the line was perfectly horizontal.
  'ff84a2fc758d62a7310167e3cc9680f7a452893773610a2d89ede3596e7177e9': "一个电子传感器向笔记本电脑提供测量数据，我的程序把它们变成了绿色线。", // An electronic sensor supplied measurements to a laptop, where my program turne
  'b6ff2b35ce8aa0842c969e1560a1633026f7bd6b1c3c800eb231e3cb954fde06': "显示看起来不完整，但更多地揭示了信息的可靠性。", // The display looked less complete, yet revealed more about the reliability of i
  '982ef2d194beea66ddb8cacc12f9b65188a2bf1e94bf02ed88346e85e9afa027': "在那之前，这些可能性似乎是等价的。", // Until then, those possibilities had seemed equivalent.
  '07be9cc1d6c237b90eacbce5e0d45e1c15b964976f78c1bd74275d83ff57b474': "早期的测试验证了读数的变化，但从未检查当读数停止到达时会发生什么。", // The earlier tests had verified changing readings, but never examined what happ
  '0d8a04404d737716f00268ed36d8ef837149776149abd28a8ce9a74893258084': "程序怎么会从一个不再附着的东西获取信息？", // How was the program obtaining information from something no longer attached to
  'b9e5a3339b30aea543e7e54cc0ceec1881fcf9afbbf7372223c51c05f5eed4b6': "这样就能恢复我想象中的完整图表。", // That would restore the complete graph I had imagined showing.
  '5e4b772e767330e3520755827670cb85abb5e72adb25805438b9425103131d56': "显示数字有什么难的？", // What could be difficult about displaying numbers?
  '64dcc799de4c855d9bfc29fa83dcaec1714b6938d3274d21c207bede763a3bf0': "我们让它继续运行，收集环境条件在一天中如何变化的证据，同时俱乐部准备展示的其余部分。", // We left it running to collect evidence about how conditions changed throughout
  '40cafcab109fb2361a3b70d1bcf5c9808e08266315c960a194b43ee4827e348d': "我把表格摊开在欢迎桌上，欣喜于这份集体慷慨的体现。", // I spread the forms across the welcome table, delighted by this evidence of col
  '6441e33abda0f7dd45c9382f8c150201db5470178cc13b988d5601be3d5663b9': "我们有很多愿意帮忙的人，却没有可供他们帮助的对象。", // We had plenty of willing helpers and nobody for them to help.
  'd384eb35ac52793d71695d6683d08bb4797a838ed395abe5b761d668fcf66aaf': "我原本的直线依然清晰可见，交叉得太频繁，几乎无法分隔任何东西。", // My original straight line was still visible beneath them, crossed so often tha
  '7b8032e654521fd667166fbb3e0176a701e32a2c889b65e3c96c8787bdcb860b': "该数字记录了安排，但忽略了人们认知的变化。", // The number recorded arrangements, but overlooked the change in people's assump
  '0489747e95c2f8b2674c49986684cdbb5dbfd3f55555a07a0c80e1a22d4282b2': "在家里，测量长窗帘需要配合：必须有人拿着卷尺的另一端。", // At home, measuring a long curtain required cooperation: somebody had to hold t
  'aeee566be83047fc89880df0fe9c3122f1aaf7e3d0e16577767d2452bc0ced2f': "在社区中心的第一次帮助交流中，我设计了一个包含两栏的表格：“我能提供什么”和“我需要什么”。", // For the community centre's first help exchange, I designed a form with two col
  '51763831da082400c3afaacb39188d0647db5b1f0154d7778915f002564bf8e1': "犹豫了一下，我写下了请求，并放在大家都能看的地方。", // After some hesitation, I wrote the request and placed it where everyone could 
  'e2e15f6016f5fef7816f543860a4f2af9fc68b1daab701fe088629172b4c0139': "我举起那叠厚厚的表格，作为大家参与的证明，并解释自己如何把大家能提供的帮助分到不同类别中。", // I held up the thick pile as evidence of participation, explaining my allocatio
  '80329e7b8194e78bb0b55160e30a63bb1abdcdb44869ee8676149006e88158a8': "到周六早上，工作内容包括缝纫、检查自行车轮胎和搬运花盆。", // By Saturday morning, the offers included sewing, checking bicycle tyres and mo
  '238fe6313c659a4d32ebc3fd992b69c3be16a5d7668766fdba04f35803870072': "显然，我画的那条线成了两类人之间的界限：有能力提供帮助的人，以及依赖他人帮助的接受者。", // Apparently, my line had become a boundary between two kinds of people: capable
  '4bf76468cfeead4f526feac65e7937264309076a9899fbef175677944f70898b': "把大家能提供的帮助分类，并不等同于安排互助交换。", // Sorting offers was not equivalent to arranging exchanges.
  '6f6cf73a0b10ef5fad82401e6c87edcae513860cde32013342361a4c90dd1312': "我的工作是把需求与所能提供的帮助相匹配的人联系起来，这在纸面上看似简单得令人满意。", // My job was to connect people whose requests and offers matched, which seemed s
  'af27b33786d81601598bf4a9de94991574262f2d19cf412136fe5041087374e6': "他身旁的一位女士拉过椅子，开始介绍她的植物。", // A woman beside him pulled up a chair and began describing her plants.
  'f0d965f68d01ac1c9c91263a4af1b3e47518bf6dd8319b8d674b800e3c0707d6': "第四轮结束后，我把笔扔到桌上，紧抿嘴唇。", // After the fourth round, I dropped my pen onto the table and pressed my lips to
  '61a454be64373683b6588932f83fc455fc0b04f34917bb10e9925a0ad35b9063': "我指着他帮忙补包的提议，但他摇了摇头。", // I pointed towards his offer to mend bags, but he shook his head.
  'f22a75d6f96aa6b12faf5f135c66fe103877852c06aa278a758f096fe8811c50': "我曾主动提出设计通知，同时也把自己的需求栏空着。", // I had offered to design notices, while leaving my request empty too.
  '2428377b6914506c2f43b1dbce9a6cf6b7313e3d1bd672927c716bb9cb90b6d0': "卢老师解释说，软盘的磁性表面会慢慢变弱，所以存在上面的信息可能就这样消失了。", // Mr Loh explained that the magnetic surface of a disk gradually weakens, so the
  '41680fc3da8ba7be94e435a3541b40bcd1448d8dacecd07c75ca4955a92975df': "为了庆祝建校五十周年，校长安排把一个密封的时间胶囊从旗杆旁挖出来，那是2001年一个中三班埋在那里的。", // For our school's fiftieth anniversary, the principal arranged for a sealed tim
  '5fbae04a978b96d29b5f23c89e2f881d99f6ae440db96eca6cfd2956d9e85714': "软驱像一台旧风扇一样咔嗒作响、嗡嗡低鸣，我这才发现自己正紧紧抓着桌子边缘。", // The drive clicked and groaned like an old fan, and I realised that I was gripp
  'c7f2b93c97c7acdc3e771ae2fddb74c7ec1fc9e1ad8b3af14274fdee5424a704': "每一组分到一件物品去研究，因为我和哈齐克来晚了，只剩下最不起眼的那件：一块灰色的塑料方片，上面写着“我们班 2001”。", // ' Each pair was given one object to investigate, and because Haziq and I arriv
  'b1a888ea4bbe08ce029ed4b9db669c52cc47650a3ad90d1443f76ececffbda15': "下一个星期一，卢老师拿着一个带线的黑色小盒子出现了：那是一个软驱，他承认自己“以防万一”留了将近二十年。", // The following Monday, Mr Loh appeared holding a small black box with a cable: 
  '294cad77b0d6748964b99a5af745c3bd46f5c57af781ce1c4fb1032027ef9797': "技术员卢老师笑了，不过还是勉强答应去他的储藏室找找。", // Mr Loh, the technician, laughed but reluctantly promised to search his storero
  'a24eb577f1efb9886d2115c676ab65d4d83a94e4689f4ed6937e6691f74b386e': "我不停地瞄旁边那一组，他们正在展开一张一碰就碎的旧报纸，我真希望能跟他们换。", // I kept glancing at the pair beside us, who were unfolding a fragile newspaper,
  '7aa752bfb366b9a633a783d5b1e99a70cd1c52b280fdd254c63fb739f7bb4f81': "讽刺的是，其他组在研究的手写信，在同一个盒子里放了一样久，却依然清清楚楚。", // Ironically, the handwritten letters the other pairs were studying, kept in the
  '7198fb0fe6daaea4da0480a2d199ee4f7c300e91f31a5704eeec5e7be2bf5093': "讨论了很久，我们决定放一个U盘，但也把所有重要的东西都打印出来。", // After a long debate, we agreed to include a USB stick but also to print everyt
  'b4cec53e7e1bcc59fd41297261950c1697eb279681793e1c314407ff68e6794d': "哈齐克把它大声读了两遍，读第二遍时，我们俩都忍不住笑了出来。", // ' Haziq read it aloud twice, and the second time, neither of us could keep a s
};
