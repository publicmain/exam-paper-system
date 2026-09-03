'use strict';

// 首发周例句的中文句意。key 是英文原句的 SHA-256；
// content/index.js 会逐条校验，少一条就立即报错，不能带缺口发布。
// 由 scripts/pilot/build-week2-context-translations.js 生成（Azure Translator），
// 生成后经人工复核。行尾注释是原句，方便审阅时不必回查。
module.exports = {
  '5bb92b9229c62a55de8ce1518d0ddc84c094dca497aa8aa1cf600648bb0a69a9': "这种垄断，以及打破它的那番努力，重塑了三大洲的农业。", // The consequences of that monopoly, and of the effort to break it, reshaped agr
  '8f7ace269c747135f2811f1a78649393cc079cc10513452068f39d162baa45cd': "F段\n由此产生的种植园建立在一个长期受到批评的劳动体系之上。", // Paragraph F The plantations that resulted were built on a labour system that h
  '3e6b55705b8b06987714314c439dce5984c090c02cc39e9c9f64a1516197f0cc': "史学界对这段时期的许多事各执一词，但对底下那笔账没有分歧：一样自己产不出、又停不下来买的商品，总得用某种方式付账。", // Historians disagree about much of this period, but not about the underlying ar
  '98c6ca3b7fc7627918b56706a21e4ecb18ab5647abfa843fd018c355dc83b7ff': "一个世纪之内，人均消费量增长了大约两百倍。", // Consumption per head rose roughly two hundredfold within a century.
  '9f5e3c8464dea367e350673f3d9bbc16e6e7d1f4e6389b6f72b014b56ae525f2': "真正让印度茶站住脚的，是福琼一并带去的另一样东西：八十名经验丰富的中国茶农与制茶师傅，他们懂得把叶子变成茶的那套工艺。", // What made Indian tea viable was something Fortune also brought: eighty experie
  '3cf4d5f5402237881d4029fc9638dd6111adfc73e9cfa5513bfe6429929c7078': "做红茶的叶子要先揉捻碰伤，再摊开接触空气；这期间酶会把赋予绿茶风味的化合物转化成颜色更深、涩味更轻的成分。", // Leaves for black tea are bruised and left exposed to air, during which enzymes
  'eefab668ace775b4dfe9009aabd92f35ce0916d034618c827f03b0fb358973a3': "A段\n茶的饮用范围比地球上任何制造饮料都大，而且茶的大部分历史都来自一个国家。", // Paragraph A Tea is drunk more widely than any manufactured beverage on earth, 
  'a58f3a249fe73a362310eabd9f7dac990285f861d98accbdf384006a920ce98b': "他把约两万株茶苗装进密封的玻璃箱运往印度；这种箱子透光又保湿，是当时的新发明——没有它，这些幼苗撑不过那趟航程。", // He shipped some twenty thousand plants to India in sealed glass cases that all
  '87e2a3c05f665adcf3f72e5694e4b93b2a2d0aa9eb1d25a4d45428b1fa374246': "后来还发现，阿萨姆本来就有一个野生品种，长期被英国植物学家看作次等货，其实比中国茶树更适应印度的气候。", // It emerged besides that a variety already growing wild in Assam, long dismisse
  '92c40656f6f0c36fbb84c827b2af0f9f8183601d8d7849238b76d00516a8a901': "茶在十七世纪中叶作为一种新奇物传入，到十八世纪末，从富人到做工的人都在喝。", // Tea arrived as a curiosity in the middle of the seventeenth century and by the
  '31abea7a8bedc464333a27a614b2099b7810b8a7977cc0a5d9b2c3059316a291': "工人从远方地区招募，由雇主承担费用运输，并受合同约束，使得期限未满前离职被视为刑事而非民事案件。", // Workers were recruited from distant districts, transported at the employer's e
  'cf091ac3b1f28db3cbfc1ca1898eef15c05591c50ca0626af095d7db90fd5edf': "种植者正在尝试种植遮荫树和为高温培育的品种，但这种植物需要多年才能成熟，这使得行业适应得较慢，因为他们今天必须决定十年后收获什么。", // Growers are experimenting with shade trees and with varieties bred for heat, b
  '99f99b1530f3d05fb326518052f6b7e448c15c8ceaa2ef66a99518975398c122': "H段\n如今，这个行业面临着创始人们从未预料到的难题。", // Paragraph H The industry now faces a difficulty its founders never anticipated
  '92761ce9b71a8510087246e423a3c93865193b8c9fd1dc24d1406220a26777e0': "同样的区别也解释了为什么两种茶的保存方式不同：红茶已经氧化，可以稳定保存多年，而绿茶几个月内就会失去特性，而且历史上很难长途运输而不变质。", // The same distinction explains why the two types keep differently: black tea, h
  'edb35d6015ba4c6962f262889b47943775fcc926a66a2934f22710927d1356df': "最终的回应是将印度种植的鸦片出售给中国，这一贸易导致了两次战争。", // The eventual response was to sell opium grown in India into China, a trade tha
  'e2721a5508b9db7af69ec38b0cc0d5f97da4611b8a5dac2ecffff7d29b3c0de1': "D段\n另一种选择是去其他地方种植茶叶，这需要植物和中国严密守护的知识。", // Paragraph D The alternative was to grow tea elsewhere, which required plants a
  'b4a2f918adf941dd984f48bc0666e66035f8e7786762abda6af4f0288e02e736': "但它所做的是表现与上个月略有不同，而喷发预测的整个学科都建立在能够察觉这种差异之上。", // What it does instead is behave slightly differently from the way it behaved la
  '0af68f70d2d9d51e24cfe763258e2f385df5ae31c739db73b6044b6860ea8b3f': "成功的关键在于识别火山何时正在远离其背景活动水平。", // The key to success is recognising when a volcano is moving away from its backg
  'db572f219f901073fa66e80f3bbe8c1f92d452387ddc00b4a7eb34ee40a2a123': "D段\n火山动荡最持续的迹象是地震活动。", // Paragraph D The most consistent sign of volcanic unrest is earthquake activity
  '6e23eb52c9fdee3ba1f07c0269b6fc0f6e208ccd3f3687d2a3326455b88f3134': "它必须在平静期测出来，在仪器什么异常都记不到的漫长而枯燥的时段里测；这样等真出现变化时，才有东西可以对照。", // It has to be measured during quiescence, over long unglamorous stretches when 
  'be8e484110d7f8579d4b7551b1972fe14d1a111b630637d33b5696cbd0afc3c6': "二氧化硫排放量上升，是岩浆在地下移动的一个特别有用的指标；测量办法是把紫外光谱仪对准火山烟柱，算出穿过烟柱的阳光被吸收了多少。", // A rising output of sulphur dioxide is a particularly useful indicator of magma
  '801c3dfcd85aa3f8ca315e7fe79f12ef8d51da72c64859df376ed4d2fac808d4': "这个要求比听上去难得多，因为它意味着：真正有价值的测量不是危机当中做的，而是在那些看上去什么都没发生的年头里做的。", // This turns out to be a harder requirement than it sounds, because it means the
  '73fdf5c2b918c3f34a00cf820ac0c86e0343fb3e61aaec560a3a6058d5192ba5': "但这些是关于侦测的陈述，而非精准。", // But these are statements about detection, not about precision.
  '6c99f0e7c120af7f8e2b5760328f5a7cb3d3afb314be1d230f69a2e5f4ec1ab8': "岩浆在岩浆房里聚积会占地方，上方的地面因此隆起——有时只鼓起几毫米，偶尔会大得多。", // Magma accumulating in a reservoir takes up room, and the ground above it swell
  '18a1578f8214a1e7f22b0d1ef0372dc7bc768c6ffc0feb6908ec1b2d29edd7a5': "深处的岩浆里溶着气体；随着岩浆上升、压力下降，这些气体从溶液中析出，经由地面和山顶火山口逸散出去。", // Magma at depth holds dissolved gases, and as it rises and the pressure falls t
  '5f8a0952f0420819bd544358bf7cfe447992c24b59cbab1f236d6f6cb1564232': "地震学家看的不只是地震次数，还有它们的性质：一群普通的脆性破裂型地震说明一回事；而由流体在裂隙中流动引起的持续低频震颤，说明的是另一回事，而且通常更紧急。", // Seismologists watch not only for the number of events but for their character:
  '47e1ae046ebc5bbc58b27551ce7fce0545745eac6af7f1caced55d2bf6bae8b4': "气体比例的变化可能与总量一样重要。", // Changes in the proportions of the gases can matter as much as the total quanti
  '5bc08404a6425033357338a918637d96f54a839157b0d41af6fab8926b39168a': "这就是为什么一个仪器装置完善的火山可以有效预测，而同类型仪器设置不佳的火山则无法，以及世界上大多数几乎没有仪器的危险火山实际上未被监测的原因。", // This is why a comprehensively instrumented volcano can be forecast usefully wh
  'bbab4d82d09cd9cc39001b2c36ceeab3f7d7fdf99de5f5405cccc250ae9a0355': "通过对早期喷发的沉积物进行测年和测量，科学家们可以确定该火山喷发的频率、规模以及其风格——无论是缓慢的熔岩流、爆炸性的火山灰柱，还是最致命的快速热气和岩石雪崩。", // By dating and measuring the deposits of well-characterised earlier eruptions, 
  '7c761765ab00a8b719ddb60a58eaf1fe01b0a3cf94a00e8fff19917581a3d25e': "地面变形通过倾斜仪、固定在侧翼的卫星定位接收器以及从轨道拍摄并与早期雷达图像进行比较来测量。", // Ground deformation is measured by tiltmeters, by satellite positioning receive
  'baa3c7e631034dfff90afea64b7f2ae1910bad97a78a1141f0836b61129d698d': "G段\n没有哪一个信号是足够的。", // Paragraph G No single one of these signals is sufficient.
  '0d06364c33bdcda587610d1bfa76a7ba5bd2f02dad13de9ad326320932be63d4': "这会告诉规划部门应准备什么样的事件，但对具体时间毫无说明。", // This tells a planning authority what kind of event to prepare for, but nothing
  '78dbb304437e2bdb0581d166e675642230bc3de33c4f3c86398e5f13d03028e7': "这个词汇传播得比证据更广、更快，大约二十年间几乎没有人加以审查地重复使用。", // The phrase spread further and faster than the evidence behind it, and for abou
  'c70b1c813fdf16e1d50a38e2c0ba5efb59c3988370c6dd92f2f5d7b5adada26b': "一些被广泛引用的说法——例如成熟树木优先为自身后代提供后代——基于少数森林中的少量研究。", // Several widely cited claims — that mature trees preferentially supply their ow
  '94805e1c1e54252c20d36e357ca5f19601d6302d88c22a5c77f4d4de4d05ae41': "它是一个有自身利益的有机体，在某些情况下，它更像不付钱的租户，而非合作伙伴。", // It is an organism with interests of its own, and under some conditions it beha
  'a70cbc6927a73fc5822332c8ef78b43d6fe9400add0bfb709e498d67c974c950': "连接到某些网络的幼苗生长速度比未连接网络的慢，这很难与网络作为为树木利益而运营的分布系统相符。", // Seedlings connected to certain networks grow more slowly than unconnected ones
  '0828dad9b6b73ebc693ae51ef8e106318c8d341cdc92c1cc917fcffef1860e32': "H段\n实际问题更多是管理层面，而非隐喻。", // Paragraph H The practical questions are about management rather than metaphor.
  'ac808f2d16649dc86263ed32feeb54f7450b8d227f7d215a2c627fa8137f49a6': "无论网络在做什么，它都用的是森林年产量的相当一部分。", // Whatever the network is doing, it is doing it with a significant fraction of a
  'e3ce948b20d0df70e5d65e06db3426224ea9a58295ae8462d097937cc6c46cc3': "全球植物每年将大量新固定碳输送到这些真菌体内，森林土壤中大量碳通过这条路径进入，而非落叶。", // Plants worldwide route an enormous quantity of recently fixed carbon undergrou
  'dcb9d1b0773e95ed04f26cf0bc6d79cf0fcd8253b8a4a1809de4cd0a30cb24eb': "对该领域的综述发现，只有少数已发表的实验检查过转移的碳是否最终进入接收植物，而非留在真菌根部内。", // A review of the field found that only a minority of the published experiments 
  'fef7cb2e36e4a6f4286b3aa19c184d12a723cf6e35a8a7378ca4a51fb9b1bce0': "使用带有稀有同位素标记的碳实验显示，碳可以从一棵树中移动，穿过它与邻居共享的真菌丝，进入那棵树。", // Experiments using carbon labelled with a rare isotope showed that carbon could
  'ba32a84b0d3000245ff31c43d98380966f5f83b5c77a7477173009bab8acdf87': "B段\n这种安排是一种交换。", // Paragraph B The arrangement is a trade.
  'b75e2f239791a8d663639991831d0adc8d93a9465bbef0bf3587884b7ad9b24d': "D段\n民间说法将此转化为“森林宽网”：森林作为合作社区，老树喂养幼苗，并警告邻近的昆虫侵扰。", // Paragraph D Popular accounts turned this into the wood wide web: a forest as a
  '469f129bd2d066072d7c6e089cbfb55e47223370358e72a3666d0054dcbab3db': "作为回报，植物通过光合作用获得糖分——据估计，这些糖分占其所修复物质的五分之一。", // In return the plant hands over sugars it has made by photosynthesis — by some 
  '7b95f59662503a6c62d5a55935e963030032d2423c218dce62d59f20d3c63127': "它们附着在活的根系上，这种关系由来已久：化石将它归根比根系本身更早，如今大约九成的陆生植物都形成了这种关系。", // They are attached to living roots, and the relationship is old: fossils place 
  '5d32cc173d5954bdcfe3665617c7e3e582215b3cac2cd6c3e60053b73162cca7': "清伐不仅会移除成熟树木，还会破坏与其相连的既有网络，重新种植的幼苗可能需要数年才能重新连接;商业苗圃现在出售已预先接种真菌的幼苗，正因如此。", // Clear-felling removes not only mature trees but the established networks attac
  '7680ac94307f18330940faf70c2bcefcafa703dfe4135ba4cd32104f21d8f04b': "A段\n混凝土是地球上使用最频繁的制造材料，而制造粘合混凝土的过程占所有工业碳排放的很大一部分。", // Paragraph A Concrete is the most heavily used manufactured material on earth, 
  'e1cbfbd26fae7a785409ebebe1b72974119e28275b51d45b9c0f561555b2984a': "一种方法是将休眠的细菌和食物源密封在混合物中的胶囊中。", // One approach seals dormant bacteria and a food source into capsules within the
  'f2b886d2a1c88f2dea220e1525e863747c7aab7ef4ee669ebe6191ab6006761e': "研究人员则持相反观点：这些块状物是刻意制造的，是通过在石灰还热时混合形成的，并且它们起到了储存作用。", // The researchers argued the opposite: that the lumps are deliberate, produced b
  'bfc03500d2da705796d4b66012dccee207da067dbb941263c1196e68e6b25f12': "裂缝会破坏胶囊并引入水分;细菌复活，消耗食物并沉淀碳酸钙，从而填补间隙。", // A crack breaks the capsules and admits water; the bacteria revive, consume the
  'ef08c4142018bff54c28929c49489e9a5140773e885846b58e9c1e7986c58d9c': "实验室样本中封闭裂纹宽度可达约半毫米。", // Laboratory samples have sealed cracks up to about half a millimetre wide.
  'ef6050dcb1ed30e26fdcfdf26b1cffbc1a81632b16c67228b91a9963127714cf': "钢筋混凝土结构通常设计寿命为五十年，许多结构未能保存良好。", // A reinforced concrete structure is typically designed to last fifty years, and
  '8ab6d2400aa02528c2ce090928dff96dd20e7bdc24a79d156b24f5c5fffa46a7': "两周内，水停止流动;实验期间，去除石灰块的相同样品持续泄漏。", // Within two weeks the water stopped passing; identical samples made without the
  'b234e5201f005d9e81b98c336b16375d9d6a40a2451eb41df4362df65c1f8fdb': "G段\n局限性确实存在。", // Paragraph G The limitations are real.
  '0ece86fef017313ef536e83498ab680a02cce6143dd67285838f5ed7642fb4cb': "罗马样品中充满了小块白色石灰，一个世纪以来被解读为粗心混合的证据。", // Roman samples are full of small white lumps of lime, which for a century were 
  'ce600b7daeb29133aadb23d375cd5e65d62f20c214810088dfa4cdf99309d0a5': "罗马人将石灰与火山灰混合，两者反应产生在盐水中稳定的矿物质。", // The Romans mixed lime with volcanic ash, and the reaction between them produce
  '9b2420b1936146095ce4547683dfc10eb7973619d9158a7bd1a1f365770877a4': "但仅凭这种化学原理，并不能解释那些二十个世纪以来必然破裂的结构依然存活。", // But that chemistry does not by itself explain the survival of structures that 
  '51d629adeada3b9a3aa5cbf058b17f5e0b3afb31ff147bf3102a363aa8c9dfde': "H段\n这些是否能达到普通建筑，更多是激励问题，而非化学反应。", // Paragraph H Whether any of this reaches ordinary construction is a question ab
  '5bb3e2fe0b06f1bb8f110249c1cc21bd52c9694984774448f64e169ebcdc7558': "F段\n现代工程师通过不同的道路追求了同样的目标。", // Paragraph F Modern engineers have pursued the same goal by a different route.
  '955066b093ce68be5fee03a4b3846e266f481b6c715613402860ab0a48ae2f8c': "付钱的混凝土方很少是四十年后维护的一方，而一个百年来价格更便宜但当天更贵的材料很难卖出去。", // The party that pays for the concrete is rarely the party that pays to maintain
  '74ff2efe8858c4a52f9c0bc4c3c41eee61dda27ffcb1396bd4c0dbd86702896c': "细菌混凝土的成本远高于普通混凝土;修复仅对宽度低于一定宽度的裂缝有效;修复的主要是防水性而非强度。", // Bacterial concrete costs substantially more than ordinary mixes; healing works
  'b53a0d0186826fe66fbabfafdca9532547a9b277a6bdf79761af9ef9ad002264': "古代DNA的保存不均，而出土大部分DNA的地区气候寒冷且考古资金充足。", // Ancient DNA survives unevenly, and the regions that have yielded most of it ar
  'cdfb190455eb91b7c7b71e8554ecd2b00883d0c1b58f01eb8046819a36cbbbcd': "C段\n基因拆解了它。", // Paragraph C Genetics dismantled it.
  'fa4d05b079ee1ae5519c6c68a4dd800104fdc853a77c73875b982ab89a40414c': "其中一种影响了与其他动物相关的基因，导致焦虑减少、对触碰的耐受性更高。", // One affects a gene associated in other animals with reduced anxiety and greate
  '58098a3569cf3aa133dc6cfefda416071e2b57dcf046f94012be14037ae1d83a': "一匹能承受体重的冷静马匹比一匹紧张但不能承重的马更有用，这两种特质似乎在血统开始扩散的那一刻都受到了强烈的选择。", // A calmer horse that can carry weight is a more useful animal than a nervous on
  '33d20ad85853dc0f90da089ed4b4db1256b89804ca96b93a781cb57bb8d458b5': "2018年发表的一项研究对博泰马进行了测序，发现它们根本不是现代家养马的祖先。", // A study published in 2018 sequenced Botai horses and found that they were not 
  '9b622ca2256d9b2668b922e6d7129290c8523627f4e5524b7d4d92d25d7f84ea': "马嘴里的马嚼头在特定牙齿上会形成独特的斜面，这种磨损会在埋藏的骨骼中保存下来。", // A bit held in a horse’s mouth wears a distinctive bevel on particular teeth, a
  'b36346aa94949f729db939789399bc21bf25220ba97657ec33e0aba005b6e49b': "公元前二千年的历史学家倾向于将马匹视为政治单位规模可能变化的一种，而非交通工具。", // Historians of the second millennium BCE tend to treat the horse less as a mean
  'b105ed915ec8302275d8a88de1d01e7f19839995e58bb61a43378420949ff62b': "一个徒步信使一天大约能走四十公里;骑马时，是那个数倍。", // A messenger on foot covers perhaps forty kilometres in a day; mounted, several
  '817696334c543fe80dc461d29381c95d2491d7a89daee66b31583876062a8052': "曾经定义行政区划或军队界限的距离，不再是界定的界限。", // Distances that had defined the limits of an administration or an army stopped 
  '2a9a5df3aa0ac97bf53f4e6bdf3e0f9829affb538d465c8719de42663171cf1a': "数千公里范围内当地马匹种群的替代大约花了三百年。", // The replacement of local horse populations across thousands of kilometres took
  'ccb7c1b47a5d65ff5f1a9ffceab07dce2cb4a2d2434a93c7ec3ba83ab28236da': "在此之前，该地区拥有多个基因上截然不同的马种群。", // Before that date the region held several genetically distinct horse population
  'f3d7a58a2e9678ec986f2d9c8b65c7c2d976a4dd72906261273f6726a6fd7b9d': "这与辐条轮和轻型战车的出现高度吻合，最经济的解读是动物和车辆作为单一技术一起传播，而非相继而行。", // It coincides closely with the appearance of the spoked wheel and the light cha
  '8f0776969e60d13c113460b5bded77ecc1a7feae70b33b084fc2862bda4d5914': "F段\n扩散速度是关键。", // Paragraph F Speed of spread is the striking part.
  'b449e7e6ab3d536a6fd91e1d3fc1ef0e669bb74fb3f03489ae817bd4a61b6001': "A段\n如今几乎所有活着的马匹，从赛马纯种马到农场小马，都属于单一家畜血统。", // Paragraph A Almost every horse alive today, from a racing thoroughbred to a fa
  '6a8207c65692de450f8eaecefa930d5cbb3d954a6cf8492fe8ddf0839a020416': "B段\n第一线证据是物理上的。", // Paragraph B The first line of evidence was physical.
  '0cd2a074510150a3e4d2fca27adc88a11e1d63d6309db7a81c7dd84093d5a19d': "潮汐这两样都不会。", // Tides do neither.
  '822a8bf6cadf2b70d22d7a8e06ebc97df60cd9ecafc170e12cef81f37ed9cea0': "潮汐发电至今仍比风电和光伏贵，商业化的场址只有寥寥数处。", // Tidal electricity remains more expensive than wind or solar, and only a handfu
  '8778d7038e352fffd910827e7eba29b685479b3337d2cc5cdf80ef0e2537bee5': "利用潮汐最简单的办法是拦河坝——一道横跨河口修建的堤坝。", // The simplest way to use a tide is a barrage — a dam built across the mouth of 
  '64d2c1b61e88a968583f51707f8369cd9b96556d46290b4985faf2b2fdfd4bbc': "涨潮时把水拦在坝后，落潮时再放水冲过涡轮机。", // Water is trapped behind it at high tide and released through turbines as the t
  'fd1a326cdbfae25cab5c8eb3abaa8bda79c47f194517b6d6609b3ff398c5a8c4': "对一个必须分分钟让供给匹配需求的电网来说，这种可预测性非常值钱。", // For an electricity grid, which must match supply to demand minute by minute, t
  '9a68047c04c8838d62df84900ecd64b123cde051463f8603b4c68d4af252788a': "最大的一座在法国，从 1966 年起一直发电，至今运转良好。", // The largest example, in France, has been generating since 1966 and still works
  '9e25d1c9c8cb945fb94fcf74964b08a513e170ca13ee9b56faf0c27f6d2e9738': "本来每天两次露出水面的泥滩会一直被淹着，靠它们觅食的鸟也就断了食物来源。", // Mudflats that are normally uncovered twice a day stay submerged, and the birds
  'b1bd9d70fa7187022de7c62ac6d2c701f09bd075e967524186bff49d7b72102c': "于是工程师转向了水下涡轮机：它们坐落在急流中的海床上，随着水流经过而转动。", // Engineers have therefore turned to underwater turbines, which sit on the seabe
  '88a38b0c42c76a94c97b69c872db59208ddbb27d9e318a268d20caa678d996d4': "它们看上去像风力发电机，原理也一样；但水的密度大约是空气的八百倍，所以小得多的叶片就能发出同样的功率。", // They look like wind turbines and work on the same principle, but water is roug
  '9f73e36128f57a8ed07d7973632e313b3f86ded0de287739cfd8bd79490bf3e9': "没有筑坝，河口原样保留。", // Nothing is dammed and the estuary is left intact.
  '29133c4df1d979df350eab401931bb1c80cd185afd9cbf5c5f114ae1fcc38f15': "海水会腐蚀机械，而修理水面以下十米处的涡轮机，远比爬上陆地上的塔架困难。", // Salt water destroys machinery, and repairing a turbine ten metres below the su
  '70e85b8603fd496539483cb6492e236926b6ab52ce101163995181b1f3f0fe00': "支持者认为，它的价格会像当年的风电那样降下来；而一个充满不可预测电源的电网，最终会愿意为一个靠得住的电源付高价。", // Its supporters argue that the price will fall as it did for wind, and that a g
  'e593c611234114c4f320d9d553b5ea92a5cf881b40bec66691b16a227b369e49': "互联网刚出现时，相当多人预言公共图书馆会关门。", // When the internet arrived, a good many people predicted that public libraries 
  '3c0405140ddc953b563556b4820e1c8b6007f4aecbbc4a33e4fdcee9c2bbdbad': "这个预测错了，但并不是因为借书量保住了。", // The prediction was wrong, but not because borrowing held up.
  '3be2673b01d50244caf149857de602e3c2937417828ced92d6ccfb34e8485219': "有些图书馆还外借工具、乐器或种子。", // Some lend tools, musical instruments or seeds.
  '2cc35f90f0485428dd697f5540fd7758282d42633e43945993f85c976f73aebe': "好几个城市的调查都发现了同一个规律。", // Surveys in several cities found the same pattern.
  'f31a4b62bc84117ff34ba50546a6e9517b078bcbdfa80c3903fcdb4c06e751ae': "用户最常提到的服务是免费上网，主要是家里没有网络的人在用——填申请表的求职者、办养老金的老人、用不熟悉的语言处理各种文件的新移民。", // The service users named most often was free internet access, used mainly by th
  '918a6eeef7c6e6498fcf9c3a70a416f8e7c6417d5651ba7219f4a2c334f61362': "图书馆也相应做出了调整。", // Libraries have adapted accordingly.
  '9e32151715f6b26decf61c4d240c6584b10faec3fe9969f49673c71bba1dd6b8': "少数图书馆聘了社工，因为他们发现最需要帮助的人本来就已经走进了门。", // A few employ social workers, having found that the people who most need help a
  '3f8ff26abc389c9081f7efd2371733e22ed67b7a425a31eec974d76065b69234': "批评者认为，图书馆是为书而设的；让它去接手国家在别处不再做的事，结果是样样都做得过得去，却没有一样做得好。", // Critics argue that a library is for books, and that asking it to absorb work t
  '3a38860ec38260b0a72a0118ba99557bcef23a4bf807d05a48b0472f525ab12e': "图书馆员往往回答说，这个角色不是他们选的；它是以那些无处可去的人的形式找上门来的，而把他们赶走从来就不是一个真正的选项。", // Librarians tend to answer that they did not choose the role; it arrived, in th
  'e2f1c158023f244164acd9eec9a65baca8ef58ce0e55d385c8d3dd4cb4aceebb': "并不是所有人都欢迎这种变化。", // Not everyone welcomes the change.
  '94e04f3a8d2e8c67de09a096ebe468054c31fa72a911126e29fc1938ec88baed': "在人类历史的大部分时间里，它都属于最贵重的交易品之一，原因很直接：在制冷出现之前，它是让食物不腐坏的主要办法。", // For most of human history it was among the most valuable substances traded, an
  '4c8f4961309aabd23bf8c3d252884ab9c2bf8b45927605e67540690cc8108af3': "船队之所以远航到遥远的海域，是因为渔获在运回来之前就能保存住。", // Fleets sailed to distant waters because the catch could be preserved before it
  '6fda5d70a9371d18400c69151b0e6a255feb26fb0cc5b0b5dd0ed1f302edd17a': "盐会把水分从肉和鱼的细胞里抽出来，也从那些本来会在里面繁殖的细菌里抽出来。", // Salt draws water out of the cells of meat and fish, and out of the bacteria th
  '67a91d9dbeba5dede2a67a107a10442113481540d97a62d0ac64a9d95d4c72e6': "一个又一个经济体都建立在这一个事实之上。", // Whole economies were built on this single fact.
  '4135583180b43ea761c493c88c55056cf3d89f10560254a499b83f010d12e14c': "在印度，英国对制盐的垄断促使甘地在 1930 年走到海边亲手制盐；这是一次蓄意的违法行为，引来了全世界的关注。", // In India, a British monopoly on salt production led Gandhi to walk to the sea 
  'd6b8a5fdd3cf6834856e0d5b5bd3bb40b52a312a049723e1242af73ea3a46c05': "在法国，盐税是 1789 年革命之前诸多民怨中的一条。", // In France the salt tax was among the grievances that preceded the revolution o
  '421b4c3af3683bcdcad8f55003d9790133da0732666a8eb59ba26c9e9660ec4a': "商队穿越撒哈拉，把一块块盐运往南方，再带着黄金回来；有好几座城市仅仅因为一条盐路经过而富裕起来。", // Caravans crossed the Sahara carrying slabs of salt southwards and returning wi
  'e64eeba539d9a5ed1ba1e89adc7a57b5d6f2a166bb8cc56380c5462f84353980': "机械制冷在十九世纪后期普及开来，食物不用任何化学物质也能保存了。", // Mechanical refrigeration spread through the late nineteenth century, and food 
  '8f7eb182b5c12ad1775d50b99a9c42c9143cc1824fefbdfaeb238875ace39597': "盐在几十年间失去了战略价值，变成了今天的样子：货架上最便宜的东西，也是大多数人唯一会吃的石头。", // Salt lost its strategic value within a few decades and became what it is today
  'c3b76c8c3a8efb0de743b9c210e8462b2af7cc2933b71f792bfe403e250bcde1': "因为人人都需要盐，产盐的地方却很少，所以它很容易征税。", // Because everyone needed salt and few places produced it, it was easy to tax.
  '9d2475e7faacdc7f6a532c563e63c8a28a09b055194eed82cc63894a1004cf9c': "在铁路出现之前，每个城镇都用自己的时间，由太阳来定。", // Before railways, every town kept its own time, set by the sun.
  '39de200cc5367eae4a99fc5226a23b3f622a4b0f4b417a1e79ef011f35c9d874': "如果「十点」在这条线上每个车站的含义都不一样，那么写着列车十点开的时刻表就毫无用处。", // A timetable that said a train left at ten o’clock was useless if ten o’clock m
  '4ff5525fb722f9364ba6871422144c872bb0ad5041f76220744f97b2cbf0c151': "更糟的是，共用一条轨道的两列火车，可能是由两只走得不一致的钟放行的；1840 年代有好几起相撞事故正是这么来的。", // Worse, two trains sharing a single track could be given clearance by clocks th
  '4527936ebeb4965273a35fcb557ebca98ddee02172a9a41aea150780b721c01f': "英国的铁路公司于是统一采用一个时间，取自格林尼治，再通过电报沿线路传下去。", // British railway companies responded by adopting a single time, taken from Gree
  '76b0ce5d09890cfb7e66fc24e8550802611f958e9f300739ab21649e97d35ea2': "有些城镇抵制了好多年：布里斯托尔的一座钟装了两根分针，一根走铁路时间，一根走本地时间。", // Some towns resisted for years: a clock in Bristol was fitted with two minute h
  'a524b246936c0298b598e38c45176b1caaa97dca3f235738650ef0bd64eb9e1c': "美国横跨五十多个经度，到 1880 年，全国铁路大约在按八十种不同的地方时间运行。", // The United States spanned more than fifty degrees of longitude, and by 1880 it
  'd69bb9596928bfbb823510fc37b79ec7b1d9ca786499eb198d6c486626959c8d': "1883 年，这些公司干脆自己商量好，把全国划成四个时区，公众也就跟着用了。", // In 1883 the companies simply agreed among themselves to divide the country int
  'cd9991e0fdd7a12ae6ca551bedde87a6fe796814cb35235fe26a38a9473912f5': "又过了三十五年，国会才把这个安排正式确认下来。", // Congress did not make the arrangement official for another thirty-five years.
  '348283914413448b8b9d933e69bdea449f7ef15dbe27de7ad30b5698380c7a27': "如今几乎没有人在定闹钟的时候，会想到这是铁路带来的发明。", // Almost nobody now setting an alarm clock thinks of it as a railway invention.
  'aa7a484c3dc27d54a12ea761694d00ddc13b3a97c7871e23a2f96302a371eac9': "一台机器制造出一个以前没人遇到过的问题，一个行业为自己方便发明了对策，而这个对策最后安排了所有人的日常生活。", // A machine creates a problem that nobody had before, an industry invents a fix 
  '305a152af3a7423e02f597263b5327cced259137dd7558e79ab8d3291fa2f15f': "这种模式在技术史上并不陌生。", // The pattern is familiar in the history of technology.
  '6d8183356d68d2e65033e950091c098ed429f4799147bce5b659ab0175cf9b8d': "这个说法并不离谱。", // The claim is not fanciful.
  '39e7fbd00ad0f73ef6513a2b7c91e7e68aafdd46bfa454b683d38b2c70d83fe6': "这种气味是真实的，已经被化学方法辨认出来，而且它确实比产生它的那场天气更早到达。", // The smell is real, it has been chemically identified, and it does travel ahead
  '4d61c62f90f7710e6b0a57099f1e78bf5ce37cba05f4f86fce2bc50ae620177a': "主要是两种物质在起作用。", // Two substances are mainly responsible.
  '87b65cfbf2f5e519a77ae3a71bea15af93178e70a735922b4feb9d1d10ba2772': "第一种是土臭素，由生活在土壤里的细菌产生。", // The first is geosmin, produced by bacteria that live in soil.
  'c77ec23979991c424bc5d38d6fe8c158f6cfed91f86e29a2a76b6bef08785441': "人对它极其敏感：浓度只要万亿分之五就能闻出来，这让鼻子对土臭素的灵敏度高过几乎其他任何东西。", // Human beings are extraordinarily sensitive to it: a concentration of five part
  '8d80e738b141f0b6ff283c6c48fd23c44c0c9e4234a187b5701ea5f629a563b4': "第二种是潮土油，一种油性混合物，植物在长期无雨时把它释放到干燥的地面上。", // The second is petrichor, an oily mixture that plants release onto dry ground d
  'c1ed20d156c2f46e2c4ada6a73f8e664a1685ad5ee7e9065ecfdfce0e289bbc4': "第一批雨滴落下时，会在自己下面困住微小的气泡。", // When the first drops land, they trap tiny bubbles of air beneath them.
  '0a8cd00cff3b21eef19147dadc0883cd1bdc0e11d1bde121bee276c7d2ca3210': "气泡向上破裂，把油质和其中的细菌抛成一层细雾送进空气，再由风把这层细雾带向前方。", // The bubbles burst upwards, throwing the oils and any bacteria into the air as 
  'd6948e52433d3f1ade655ecf83877241f80f9f69ff24f329aec5aec784c93881': "没有人是在感知天气；他们闻到的是上风处已经下过的雨。", // Nobody is sensing the weather; they are smelling rain that has already fallen 
  'bfa6116cccff12895dc7aebb8e0f885432afcc419a0769da430b7eb4fed5bb97': "有研究者认为，能闻出哪里下过雨的动物在干旱地区更有优势，而且这种反应是遗传来的，不是学来的。", // Some researchers argue that an animal able to smell where rain has fallen has 
  '1bfa3df76732202c0b5faeff533f179f56dfa08ad49b386b719f1918c3832244': "大多数人都能描述雨来之前那股气味，很多人还说自己能凭它判断暴风雨要来了。", // Most people can describe the smell that arrives just before rain, and many cla
  '97e22939d79fc3f9ab5cbd6b804e7b2bee9752717a826fe02a09ca8eae67bb3c': "我从不带伞，因为早上七点天空总是蓝色的。", // I never brought an umbrella, because the sky was always blue at seven in the m
  '721068140651fe0144918faddccdfb3103bc5b46da7cf6beb807245a49f039fd': "一位老人正在我附近的人行道上扫地。", // An old man was sweeping the walkway near me.
  '8d2d11215c465d5afab085c994e13347e7c0bb6f7e56391ac2129a60810e66a4': "一位清洁厕所的女士告诉我，他只工作到月底。", // A woman cleaning the toilets told me he only worked until the end of the month
  '7296e11b2879d58095597202576dc3bd0845413a7bdd713e0d978a334436bdca': "然后他走到一个角落，拿起一把蓝色伞，递给我。", // Then he walked to a corner, picked up a blue umbrella, and held it out to me.
  'a0ac343e1154813098cc3ac112c17c0fe90ac0254726095883159930df9402ad': "我和大约二十个学生一起站在有顶通道下等着。", // I stood under the covered walkway with about twenty other students and waited.
  '99524bd4e2eda5612385e72bc7ca183b22296fb3fb94faee47bc3b5ff3f743b2': "他们的父母来了，或者朋友们和他们一起撑伞。", // Their parents came, or their friends shared umbrellas with them.
  '94abe1754e690a91896aad57399b856968b4dbda34a35a80d7a685b2644bdf2a': "那周每天下午都在下雨。", // It rained every afternoon that week.
  '0aa019de5865cfcb3823a20907d41aea0b7eedadbef2e490f776cd7e6c5508d9': "没人回来拿。", // Nobody came back for it.
  'f900a7eb82eed924afde84393261c3bac099ae37460312f98872627eea028fdf': "“有人五月份把它落在这里了。", // 'Someone left it here in May.
  '0698ac95f4bafe6312ae7dc7dc2c21625f92744e92061752b139e0bfeeb582cf': "我从未和他说过话。", // I had never spoken to him.
  '219799f76c6796f336ca7e5b05c5cf507efdb0066ea827e92b7c69b0107e8aad': "他把它塞到我手里，然后继续扫地。", // He pushed it into my hand and went back to his sweeping.
  '18a818932430d50efa52187157955e9f4c46e1089eb28c9f7638adc6270072da': "十分钟后，大多数人都走了。", // After ten minutes most of them had gone.
  '24b22c3861c0f74f7e9e48ab522d6676b5ea55d0b8542f891ca9b49151405bcc': "我旁边的座位整个学期都空着。", // The seat beside me stayed empty for the rest of the term.
  '65bcff996a149b1e9634601f94d10debcb43d7c5647b8911522fa18fa8ae5992': "他总是有两支笔，还会不经我要求就借给我一支。", // He always had two pens and would lend me one without being asked.
  '8492482de4461943d77afd86b494d8c78ebe5c5b7b53aff1b2d6c70e7de9b460': "我还没开口，Ryan 就打开笔袋递了一支给我。", // Ryan opened his pencil case and gave me one before I asked.
  'd752db7d49818a058c1a4c3f7dc8bbc1afba4ca1de685c8e9095a1142bfaab0c': "他会笑那些不好笑的笑话，这让别人发笑。", // He laughed at jokes that were not funny, which made other people laugh.
  '68b71394dc43140d79811b9b4f81406f64faa84a789deb8793be39b43cc3e2fd': "瑞安很安静。", // Ryan was quiet.
  'a9d1f5b196a482bd6f6ca9ffc24cdf498621788533829b21551c960e0934767a': "他对鸟类了解很多，五月份我并不关心，现在却很在意。", // He knows a lot about birds, which I did not care about in May and do care abou
  '1f06da2005fa84f0b82edd48cf49dff6429ae97c46aa2ef7f7654099892320ef': "我发现自己会想念一些小事。", // I found that I missed small things.
  'f84d15ae576c7c24ff72f0c7853722a631c653494a68b347d88525649ea18d3c': "三月，他的家人搬到了柔佛。", // In March his family moved to Johor.
  '258d256e0825c2783776b9ee43d9e0f0ae6409935a6ed3364820f3e8574de732': "我们只聊足球，别的什么都不聊。", // We talked about football and nothing else.
  '9fe111f29672b6762811e13955ca393ef4f6a662f15b2c8812eeb408a1b3f673': "老师没有给任何人调座位。", // The teacher did not move anyone.
  'a7d6607120c558aa560dcaae560cf42eb6b142d5e3b46bb65130df0e927399c0': "然后有一天早上我忘了带笔。", // Then one morning I forgot my pen.
  'baee2d790df630bd87b0a4473529f5dd68fc4c60810c9e0d04e708fd93c8d34a': "我们并不是亲密的朋友。", // We were not close friends.
  '22b3a3a7bc858f1f5c67630ddbef9841165230a28346aa81a7e038b9127ff225': "我父亲每年六月都会买一颗榴莲。", // My father buys one durian every June.
  '7804bda2beb733d13561c2d96a97aa557155c6974f44d597ced6341397c2c511': "只买一个，而且总是在同一个摊位买。", // Only one, and always from the same stall.
  '5ccb7b2512685090a4f5a821781df2a8020a6d021031c959d4be658e6e5a444a': "他说他九岁时，家里买不起榴莲。", // He said that when he was nine, his family could not afford durian.
  '9be210c49efef668c3b0f67ab60b49c6e26a689acc81b42431b0b31bf6a82fb8': "他对自己许诺：等有了钱，每年都要买一个。", // He promised himself that when he had money he would buy one every year.
  '6445168e3b5e10911c70f8bbd498c384c9a8a2b6e064022ca2fcac90b79e79fc': "他和我父亲从小在同一所乡下学校念书，那时候就认识了。", // He has known my father since they were boys in the same village school.
  '47fe05b1bb4551510af6870588a53e37a2afacc82fd992a3409286b3eabf15c2': "他笑着说我父亲会为此争辩。", // He laughed and said my father would argue about it.
  'ef08c3bca959627ca88dd5030ce8fa90c8789c6cfe767b32d5cabd2521a9e55a': "我们在桌上吃，报纸摊开。", // We ate it at the table with newspaper spread out.
  '0d6784e14044dd4d3f359159967be362e5f209b4802601f98c76fde31cdab052': "我问他为什么买，因为他几乎不吃。", // I asked him why he buys it if he hardly eats it.
  '26bfbb83f9f10ac5afa1b317ba49b41cf09c52006af1b523d1bc733f676e2419': "有一年他因为价格太高，晚了两周才买。", // One year he bought it two weeks late because the price was too high.
  '4f3aa07f614cf6260f415ab500a22ff28377e7bc8701c6f7029ce8a5af993fa3': "我姐姐碰都不肯碰。", // My sister would not touch it.
  'a48f2359421f106dd1a6dd6a8b6aed99f12c94e49fe89414d347724cdd763942': "她说闻起来像煤气。", // She says it smells like gas.
  '090fd865199f77f12a5b03360cb5f7910a82da232e935f4cd2820f77fcfbc4e6': "看摊的人大家叫他 Teo 叔。", // The man at the stall is called Uncle Teo.
  '674b5460cd8d86cd983a257dcd076c118fc21633e23cdad20cbd7133f2a4e140': "他只拿一小块，然后看着我们其余人吃。", // He takes one small piece and then watches the rest of us.
  '0ed40ed7f27af939694fd7af20e844bf96fa012ed6300c06969254bfda5d0c85': "今年这个榴莲花了六十块。", // This year the durian cost sixty dollars.
  '40f8a27df9292659a18c9f3f776b1b83728bb0149943173b00f60a69e87bb788': "他会站在店外闻味道。", // He would stand outside the shop and smell it.
  '300a090b1bdf1b98f09df715a7afe7c46f8c64f60bb9ecb1a342014fd0afe9d7': "我们学校图书馆的时钟快了五分钟。", // The clock in our school library is five minutes fast.
  'e7f6bec73dcee6d76e27b42718f5afb05b0ac16b3fb8e07c286c9674c5975ea1': "我说我可以带螺丝刀。", // I said I could bring a screwdriver.
  '0e3d74547b61e876fedc266a56d0203041eb7b6d5a4a9a1582f69cbae501d63f': "但我已经不再觉得烦了。上周我听见一个中一男生抱怨那个钟，我什么也没告诉他。", // But I have stopped feeling annoyed, and last week I heard a Secondary One boy 
  '7087a156c109e9ae7aa148b594969071f22c54133881ab6bf6dfe71d4242a71a': "这让我烦躁了两年。", // For two years it annoyed me.
  '931a278bd09f8d389068b882ea45e7ba40c529b7185a67e00b0d322dae89cd78': "我在中学一年级时注意到了。", // I noticed it in Secondary One.
  '2513e76c2175d3a080466972f3325459ad6bf27572e75145f390813bb3902648': "“十四年前。", // 'Fourteen years ago.
  '2a4c2df049a50ad5d82cd16806a7b54e012abb46253f8bd1111ef9a7e1840049': "我说得很有礼貌。", // I said it politely.
  '58dc50cd7d7a434c56459f266e50c2c4c1b37723abb9f0255f1532a5386d674a': "她告诉我，图书馆六点关门，而六点才开始收拾东西的学生，六点十分还在馆里。", // She told me that the library closes at six, and that students who start packin
  '424962a4c1ad448cbb733b5ffccc186a67d48b7803e6d4d505f76bcb1fac22eb': "她说没人信任的钟也没什么用。", // She said that a clock nobody trusts is not much use either.
  '404226e84a29ffe428df3680d54b23c01734c21db9f37234eabbeed3d62b1879': "有两次我差点开口，两次都没说出来。", // Twice I nearly said something, and twice I did not.
  '3c1e60990fc492ad68c9b709f4e9b37cc76a995faa5e29882772bfd8aa2ecdc6': "我心想，一个钟表错了，比没有钟表还糟糕。", // A clock that is wrong is worse than no clock at all, I thought.
  'd1de547a5a410fead9463abc997972343730617ed5e34bd429843b567aeba86a': "她放下笔，朝我露出了我没预料到的微笑。", // She put down her pen and smiled at me in a way I did not expect.
  '2ebaa00537ef2afd3f5d8c2936ef054d6f933aaa72e27cef1637b975466bafa7': "三月份我终于告诉了前台的拉希姆女士。", // In March I finally told Mrs Rahim at the desk.
  '473207bd23175d90b613f40ebfcf0203bb1ad85707f186db05f5388953f7b0ad': "我问她为什么不直接告诉别人。", // I asked why she did not simply tell people.
  'bf65d9ae55b45a1192e70735cd703ce580746b3f921b620215efd85d7b30c367': "第九天下雨，他招手让我到他的遮阳篷下躲着，直到雨停。", // On the ninth day it rained, and he waved me under his awning until it stopped.
  'a576273677b81ca53767d0b397206f4340d108e9313c47201c5a3c8f691b1ad3': "第四天我发现，他总是把那张晃的凳子放在自己那桌。", // On the fourth day I noticed that he always put the wobbly one at his own table
  '50f3a6db5c0b575ca1322ab6635514559af39c621e286f2445545e920f69d84a': "第二天，我注意到一个男人在咖啡店外摆放塑料凳子。", // On the second day I noticed a man setting out plastic stools outside a coffee 
  '4b43e0d2679e543b1a500f93e8428ab3b5a49d64d59639a64fa05e9306c2a863': "四月他们装了围栏。", // In April they put up a fence.
  '7e2397bb97d84f00f6ddd9e76c9c60966a30635be1e8464722b9fb951e67ac65': "停车场铺得平整、灰扑扑的，还是那条近四分钟的路。", // The car park was smooth and grey and four minutes shorter.
  '5893612f99510c92450a2152e9342588838488c2b9e9a8fd70ba0ba4278386e4': "一个告示说地面正在修复。", // A sign said the ground was being repaired.
  '8824c2c6e836404458bdc877e832d3678628c5b2f7584cb006a1bff7f50e2eda': "那条远路要绕到市场后面去。", // The long way goes round the back of the market.
  '08650f23ad9f1f2486f9d0659f67405f9519d3131eb3abdb9a0d9cf8e249509e': "他数了两遍。", // He counted them twice.
  'eb6db605d39a09342be4c9310028960ff36c689b3822862ef95d10e812f79805': "早上一股鱼腥味，我还得提早出门。", // It smelled of fish in the morning, and I had to leave home earlier.
  'fb622734fe0b4eb77e56c56c44da23f84c391358c05d30eee911dec201f82c45': "这节省了四分钟。", // It saved four minutes.
  '9489b5f69403faa5888629601569c03dc2b616af31711e9bf903abe1a7cc8b83': "我所在的街区和学校之间有一个停车场。", // There is a car park between my block and the school.
  'c56bfac67d4c194858fd60df4429c0e98172537136cead011f37dce88ed86a3e': "我不确定我能不能向我妈妈解释原因，她觉得我在浪费时间。", // I am not sure I could explain why to my mother, who thinks I am wasting my tim
  '0b8a23fd719a8f2a0e8d4f595be008df96464d044485c87068e27b942765671e': "他永远是那件熨得平平整整的灰衬衫，提着那个磨旧了的皮公文包。", // He always wore the same grey shirt, ironed flat, and carried the same worn lea
  'ecf9083341dbc696fd23ddc889486625eb47e27d82508f2141c255b0ccc81efa': "吴老师用他那手工整的小字，一行一行写出演算过程。", // Mr Ng wrote out the working, line by line, in his small neat handwriting.
  '0074726c4d24f4206acc1b8f89de4496d250f46679c387bc4b41d9cede178086': "「哎，你那个吴老师很准时的哦，」她这么说过；接着门铃就响了，而她这句话其实是个她自己也不知道的小小谎言。", // 'Eh, your Mr Ng very punctual one,' she had said, and then the doorbell rang, 
  'd4a8b506d1394c23e4f866cc4300752c80d8267ed3cfd4a7d44ee253a0411021': "他略带意外地看了我一眼，然后拿起笔，从第一行重新写起。", // He looked at me with a small surprised expression, then picked up his pen and 
  'c9838fde57a7c1e8b6f430877a17f8c1a0abf9a5996b7469b6ac77257fc53c3e': "事实证明，即使是默默的善良，也并不像我想象的那样隐形。", // It turned out that being kind, even quietly, was not as invisible as I had ima
  '4be6f869b5d87c680e4a28a33bcc018d82a0bad67152818fef05ee5a05647d7a': "第三行，本该是向量 OB 减去向量 OA 的地方，他写成了加号，而不是减号。", // On the third line, where he had subtracted vector OA from vector OB, he had wr
  '91e66080135a7da8787ea2cc21990ec50e49380345fd6c9114c90bb681a2e5fc': "从下午四点到六点，他带我讲解学校抛给我的各种课程——二次方程、三角学，最近还有向量。", // From four o'clock until six, he walked me through whatever the school had thro
  'ed39fd544ca31129560efc3f381d52619c5b3ff0768f68b1164a9da68d95e6ed': "第二个小时，我们转到了一个关于位置矢量的问题。", // In the second hour, we moved on to a question about position vectors.
  '7947308bc785b0f021f073495fd3539cb66cc9e3acd292c2f02fcf10236f8f1f': "吴老师双手接过，微微欠身。", // Mr Ng accepted it with both hands and bowed slightly.
  '1603a327b192422caf45ae5f6ebf51a7a23636bb06f5a6a89cf83d63c369c474': "他只是仔细地在加号上划了一道，在上面写了个减号，然后一句话没说，接着往下讲。", // He simply drew a careful line through the plus sign, wrote a minus above it, a
  'a6ef91477ae1fb1d9a22f945818fdfe7600c1ec982e68f92579731bef6a24917': "他的声音和四点钟时一样——平静、平稳、谨慎。", // His voice was the same as it had been at four o'clock — calm, even, careful.
  'f3c67b1bf3f336610bea3dde7ad23bbf82e32f500a1f67ccd4131c4bb9b82790': "戒指戴了三十多年，留下的那圈发白的皮肤格外显眼，像一道细小的白色疤痕。", // The pale band of skin where it had sat for thirty-something years stood out li
  '2631b8e585d86759a16c28e6222ad2eedafd31c4f35b34df36ad2c393e1de7ea': "他在一张新的横线纸顶上写下工整的标题，像往常一样讲点积——很有耐心，从最简单的情形一步步搭上来，从不催我。", // He wrote a clean heading at the top of a fresh sheet of foolscap and explained
  '91a47c814c130b45196efa09a1e9c138b20ad872b5778079bb2c0885fe08819a': "两周前，母亲在厨房里压低声音告诉我，吴太太久病之后过世了。", // Two weeks earlier, my mother had told me, in a low voice in the kitchen, that 
  'ecc2fadd95dcaa67dd46842b82aac070a80b0d97ce2805f1342ca90e57b38ee9': "我本以为守灵会非常难熬。", // I expected the wake to be unbearable.
  '0e7383b44b9a5701c5c2e97692f642a7066ebb7e939cf39592a2fb22f45070d0': "他和一个陌生人的孩子在诊所等着。", // He had waited with a stranger's child at the clinic.
  'f327a5e751fa8fab7d02d59c428294c65936a85275fd0ad4759f82fd5514e11c': "他的女儿站在入口处接待宾客。", // His daughter stood by the entrance receiving people.
  '292f26e34bdbf1d52399884ff04e24947148c6ac7772430c40cc89309085f7d0': "我这辈子和 Chandran 叔大概只说过两次话——一次是我把球踢进了他家走廊，另一次是在电梯里，他问我晚上把吉他弹得那么难听的是不是我。", // I had spoken to Uncle Chandran perhaps twice in my life — once when I kicked a
  '4c922036849220d060c99051cdfd1128b699e2f3c59f4c2f02a4d89d4dae2996': "有一回，他凌晨四点开车送一位女士去柔佛，从没解释过为什么。", // He had, on one occasion, driven a woman to Johor at four in the morning and ne
  '093dd36882d73e35b7c6242caf4f144b4f315775e891322246e3b65326db0876': "我说我住在楼上。", // I said I lived upstairs.
  'b0d622af02ef7094996205034a8f8a03febea27bfb759bc9afcca57355dd2426': "Chandran 叔去世后，守灵就设在我们家正下方那层组屋架空层里。", // When Uncle Chandran died, they set up the wake in the void deck directly below
  '7711daa3c10b2bdbef306909cd11f09d690e8286fd74a1835f4ef5c66f9b713b': "一连三个晚上，白色的帐篷就搭在老人们平时下跳棋的地方；守灵的动静像天气一样，从地板底下透上来。", // For three nights the white tent stood where the old men usually played checker
  '715e9e861be836a24e229cde845ea73ae0653273ba8223abb1f3919caaf76c58': "他点点头，像是这真算个答案，然后告诉我：1988 年 Chandran 叔借给他四百块，三十六年来一直不肯让他还。", // He nodded as though this were a real answer and told me that in 1988 Uncle Cha
  '3a15069ed70b2439271963a6cc084d34cd10a9b1aa31139af39d126d407cfd62': "过了一会儿，一位六十多岁的男子坐在我身边，拿了一把花生，问我是怎么认识钱德兰的。", // After a while a man in his sixties sat down beside me, took a handful of peanu
  '98c3dc9f3e35983739a2a8229038d3bbcc6d004962f22235cb9fa5bdb7666103': "我站在边上，听一个人讲 Chandran 叔当年就在如今搭着帐篷的这块地方教他儿子骑自行车；我想起电梯、吉他，还有他说他不介意。", // I stood at the edge and listened to a man describe how Uncle Chandran had taug
  'ced03298bfffc42805f4b408d297523ab4acc2f731be4a4a5993cfee75ba5950': "中午时分，跳棋桌又回来了，两个老人正为这张桌子争论，仿佛什么都没发生过。", // By noon the checkers table was back and two old men were arguing over it as th
  'c104c906777a285ae9f3ed38648243ce88a4dc02f9948dc30e8ebe3ae1829c4f': "她当天早上才从珀斯飞回来，那趟飞行还明明白白写在她脸上。", // She had flown in from Perth that morning; you could see the flight still on he
  'd18fb40ccb5183916a8ed4e8d613a283fbc75e516a5a41d91aa104b82bd93bd7': "每来一个人，她都说同样那三句话；而每一次，她都说得像是第一次说。", // Each time somebody arrived she said the same three sentences, and each time sh
  '0aff4bed796fbde670c4b5f8d09f16413d8db4de956517b41e038529a8b7dff0': "我妈妈让我第一天晚上下去。", // My mother made me go down on the first evening.
  '29c52d28e1a33ddad28f8efc667a7716bdab662159cb6252a7460506d0acc0b7': "上面列出了九种成分，没有具体数量。", // It listed nine ingredients and no quantities.
  'd8aa2d9f44145d4d0f6bc55fee982bbf98cc41cd85affd0b70073ecb18d9ca2f': "其他一切都像家庭划分时那样小心翼翼、令人疲惫，但没人想要一张写着我奶奶咖喱食谱的泛黄纸条，所以它就自然而然地送到了我手中。", // Everything else was divided in the careful, exhausting way that families divid
  '244a930f1b20ed9d30095298f957e774e85da240d36fe03cdabd5fcc8027986e': "清单下面，是她那手斜斜的字写下的四条做法。", // Under the list, in her slanting hand, were four instructions.
  '0afebf6a2579b606d53bb810abda084214a692dbc3bff27607c3b0ce23636495': "我从未真正关注过。", // I had never once paid attention.
  '7bfedf9a82ff0147ebfebed6c6df2185b90f840430fde1151b379569c23968c4': "然后她非常缓慢地放下包，仿佛突然的动作会惊动什么。", // Then she put the bag down very slowly, as though a sudden movement might distu
  '549c8a06721c7a19e10d6dd5cf37680fe2861c5395f8c06a5de540056c04e3e5': "观察和学习是不一样的，正如我那天上午十一点站在九个打开的罐子前，完全不知道装了多少东西时，我才体会到。", // Watching is not the same as learning, as I discovered at eleven o'clock that m
  '445142598987bde2c3f7fc076bcd9cada9958877ac91532117960858922ba9a0': "严格来说，这并不是一个配方。", // It was not, strictly speaking, a recipe.
  '210c635b3cd89f1a1c26b5720ccad6361748aac33e4ab38aca8bccbe4d0ae55d': "吃到一半，母亲告诉我一件我从不知道的事：外婆这道菜是跟她婆婆学的，而那位婆婆并不喜欢她，教的时候故意漏掉了一味料。", // Halfway through, my mother told me a thing I had not known: that my grandmothe
  'd1d2265971503965e77405fc0bbdd6cf27258724182520f81ee174f110482490': "第一次做出来又稀又酸。", // The first attempt was thin and sour.
  'b8a2700556b461e9ecb56bffde775cf62cea708a749305626ed9f0128e4a15aa': "到第三次，我不再量分量，改成闻味道——我开始怀疑，这从一开始就是那条真正的做法。", // By the third I had stopped measuring and started smelling, which was, I began 
  '367bd6695412147813b353ca405ae9c00f39fd5a2f60e7373edebbba60bd26fc': "卡片现在别在炉子上方，蒸汽开始软化它的边缘。", // The card is pinned above my stove now, where the steam has begun to soften its
  '2a8295bbcf53a4e2098077eb4550b882132dbb4a90765ad0e596dfe5529710fb': "我和哥哥永汉大约三年没真正谈过话了。", // My brother Yong Han and I had not held a real conversation in about three year
  'c2a5759d9ed6f0e2c30d1c46495875a133e06aa55d9534b5855a36dc6990115f': "我明白这是他交给我的，不是拿出来讨论的。", // I understood that it had been given to me, not offered for discussion.
  'd8132477707bd713ba2198e94317e59e9cd292c02ec9cf5a2a05eb0297ab5ec8': "信装在一个棕色信封里，地址是用大写字母写的，好像他不放心自己的字迹能撑过这一路。", // It arrived in a brown envelope with the address written in capitals, as though
  'd1157bde4e284f43a82f400ff068ec8b24ce4d6b553606f6a0feb304e687eb99': "他写道，第三天晚上他累得哭了，在一间还睡着另外十一个人的房间里，很轻很轻，没有人发现；他说他为此庆幸，同时也为此羞愧。", // He wrote that on the third night he had been so tired that he had cried, quiet
  '0bb5f10c07cb48f728587577d74069fab9e9a71eec160e8df36a90a10ea728b4': "这不是争吵。", // This was not a quarrel.
  'c856195de8a74a225267ba6e7b306fa72aba76be053dac58bfcfb352364c1c42': "后来他被征召入伍，最初两周没收了他的手机，他给我写了封信。", // Then he was enlisted, and they took his phone away for the first two weeks, an
  '4bd08ce1890f1e72a18e2daf1e8227d71d80ed27e0a2d80d6a36d00d0979b8b4': "他写道，同班有个叫 Faizal 的男生，在某天早上永汉手抖得实在打不了包时，没等人开口就替他把野战背囊打好了。", // He wrote that a boy in his section named Faizal had, without being asked, pack
  'e2ea6f2f52cc809c530aecb194e8a2837ea8d52b92264da740aafd15dd7c8c07': "我没提哭泣。", // I did not mention the crying.
  '3a044caf435321ca28e9b201bee6294cecc765e93064149f0abbce65b4003787': "他第一个周末回家时，瘦了，站姿也不一样。", // When he came home on his first weekend, he was thinner and stood differently.
  '5a08c099b9fcdb54b98e61d72d721fbc839742fd5208ed1b08a0d0a06859b6a5': "然后我把信收进抽屉，没有告诉母亲——因为他没写给她；不用谁说，我也明白他为什么没写。", // Then I put it in my drawer and did not tell our mother, because he had not wri
  'ff747e98aac7bc858e5dbeaf185930f38ad167a4c326536e27ce240ba698c0a3': "然后我在沙发上又读了一遍。", // Then I read it again on the sofa.
  'a2a62130c7bbee7e867755a1960dc1e232975bb21f05bc388128ac874f5cbf04': "有那么干巴巴的一瞬间，我以为那封信是个误会，是发烧说的胡话，或者根本是别人写的。", // I thought, for one flat moment, that the letter had been a mistake, or a fever
  '552c637fb4b544cc91e36c59de9717c9adaa8d51911a84f5c8a0e73173c5cb10': "吃饭时，他还是用一贯那种三个字就打发掉的方式回答母亲。", // At dinner he answered our mother in the same three-syllable way he always had.
  '191c81ee536b5ac5e4215efe1485b755f130967b00daf86e2ab663d528fadff0': "她说这话的语气，像是在陈述一条算术规则。", // She said it in the tone of someone stating a rule of arithmetic.
  '30da69f0db3c502e019c80dcf90b150af22fb784bdca61e3aa3d50bd34127f26': "我查到，有一项调查显示五分之四的中学生上过收费补习；而收入最低那五分之一的家庭，把收入中更大的比例花在了补习上，比最高那五分之一还高。", // I learnt that in one survey four in five secondary students had received paid 
  'd45db8dc485dfd0a02c184eb9908488968491179a20710b6c80c8360d41a3e4e': "对方队伍比我们更熟细节，却更不会把整场辩论的架子搭起来；大约第八分钟，我能感觉到全场开始倒向我们这边。", // The opposing team knew the details better than we did and the shape of things 
  'f06719c6301fe5ad9f23585c44fe34d31b42681948155f867d5e30f199514845': "她没说的是：你不可能花三天把反对一件事的理由搭到最强，然后还站在原来的位置上。", // What she left out is that you cannot spend three days assembling the strongest
  'b1106ac157fca24f072f6d38fa40c48d94b38d9af0d91594aba56fb44fa15c74': "我的化学因此确实更好了，我也知道这不是小事。", // I am better at Chemistry because of it, and I know that is not nothing.
  '8d98b92290e1aa7f0a52cf9224abae4aa1d7255e571f47e68dfc20857df459b4': "我作完总结发言坐下时，场上是那种特别的安静——那种安静的意思就是「你讲得好」。", // When I sat down after my reply speech there was that particular quality of sil
  '2a053b3f29e3eaa23dec70b80a048745a09530165b1270a60d5769bac4196e12': "辩手为分到的那一方辩护；本事在于论证本身，不在于你信不信。", // A debater argues the side she is given; the skill lies in the argument, not in
  'b55f4a01c93f5677519bd08d6461713b5c276d1adca0e0fb3072dfe32f98615d': "辩论社负责人艾耶尔女士说，这完全正常。", // Mrs Iyer, who ran the debating society, said this was perfectly normal.
  '08bf24cd71436e0228796b2becb0d5b4aff6e552e87f4a06f9c53da66a427f20': "决赛前三天我拿到辩题：「本院主张禁止私人补习。", // I was given the motion three days before the final: “This House would ban priv
  '4b576365a0063c9f413f2ef6c5f6615c47c45e6ed9ec9f74bb5c383f83f4f33c': "但我不再像从前那样，把它说成我们家本来就会做的一件事。", // But I no longer describe it, as I used to, as something my family simply does.
  '1b07195859909fac35420b27868338d402a0abf17538602be7cbf3419fc4d827': "我把它描述为我家能负担得起的东西，这句话是另一种说法，也更贴切。", // I describe it as something my family can afford, which is a different sentence
  '781ad9ca95dd7b2f6e1a7bcfe31690dab56b57a6cef76a6b8dc2d4787264a17a': "那是一个棕色皮革钱包，边缘磨损。", // It was a brown leather wallet, worn at the edges.
  '4ff964adef1ba02948d846610e23d11181c7152c508b8b4eeecbcf5a6756b7fd': "里面有三样东西：八十块现金、几张 NTUC 代金券，还有一张身份证，照片上是个瘦瘦的老伯。", // Inside were three things: eighty dollars in cash, a few NTUC vouchers, and an 
  'e083577cfcc7b9560acef0327b959a470c6da62eb43437dc93e32578c2499083': "他站起来，双手捧着钱包，走向小贩中心的管理处。", // He stood up, took the wallet in both hands, and walked to the hawker centre ma
  'b33ff8650606c684b4b3e7526585afe97b4bdefd141fb8ec498f726112b9ea8a': "他想让你知道，那八十块是他这一周买药的钱。", // He wanted you to know that the eighty dollars was meant for his medicine this 
  '44ec34a3f5a04251c8fddc8e22014bf72af0ac17d76b5926dcf7c89680e3411b': "Wei 想起自己的爷爷——有一次在淡滨尼地铁站丢了钱包，整整两天没睡着。", // Wei thought about his own grandfather, who had once lost his wallet at Tampine
  'e3eec6ce1818fcbe8d715bbbc821c1ff82fb10eb434cf5db60ae6a1e2c1868a5': "她打开钱包，点了点现金，把每一样都记进一个小本子。", // She opened it, counted the cash, and wrote everything down in a small notebook
  '778ede2e7ea287b551f5caa1921b7c09848d96d35878346e39924011052b161c': "失主不见踪影。", // The owner was nowhere to be seen.
  'e37c09c866d0bf72d9a9f61826db93fb45d980bf02e7b488248fc58ab5e2d1b4': "他独自坐在角落的桌子旁，靠近面摊。", // He sat alone at a corner table, near the noodle stall.
  '9f922b93ee0de95f53837edc90cc2881c811d1276bc94b1247a74cad00a17c1c': "他弯腰看了看。", // He bent down to look.
  '2e87322664603280bdf56ae4fcfb9973672fcb91cfa8371da4946750d0e353a1': "证件上的名字是 Lim Chin Hock。", // The name on the card was Lim Chin Hock.
  'db537fc497ebb0785b6f54632e196d5f22734cc55efc4a735041e18fa06e8d93': "吃饭时，他的右脚碰到了桌下柔软的东西。", // While he was eating, his right foot bumped against something soft under the ta
  'afe17d88fb9def5d8980a89dc76ae06af8e683056b36455ebd4268a4ee17aaed': "放学后，Wei 揣着母亲早上给他的那张五块钱，去了 165 座的小贩中心。", // After school, Wei went to the hawker centre at Block 165 with the five-dollar 
  '4c05bdffeddf6e19031339bddd11d3979b019e19e7a170d12faee494b5a5378c': "他花三块钱买了一盘鸡饭，又花五毛买了一杯冰水。", // He bought a plate of chicken rice for three dollars and a cup of iced water fo
  '65b33f435e6d46bc492f7329357ca6320c6295e626a1e4ff0dc140ef1206fa92': "有了八十块，他就能买下那双惦记了半年的限量版足球鞋。", // With eighty dollars he could buy the limited-edition football boots he had wan
  '774c10d9e2860a52afce967d3f127506b7be75ab5c4b2f279e1561d3c30739b8': "我告诉妈妈，我看白板看得清清楚楚。", // I told my mother I could see the board perfectly well.
  '7113b8644e56105fb58a6bba42c1909d01fb4e8f3445f711e55ec29098688869': "那是一千片各自分开的叶子，每一片边缘都清晰锐利，在风里各动各的。", // It was a thousand separate leaves, every one of them edged and sharp, moving o
  'e5ceca631a257209a306a49ae75e643ccc9b33dd6855748ff42248a61f9ade3f': "我想象自己脸上架着两片圆玻璃走进教室，所有人都转过头来看。", // I pictured myself walking into the classroom with two circles of glass on my f
  '43fd659ed6d5e24619288fd356480f9ba66f5a3b44820ddc06f02699080f7b6e': "课间我站在走廊的窗边，望着操场上那棵大雨树。", // At recess I stood at the corridor window and looked out at the big rain tree i
  '7fc55856779c9977757418884bd463bb7998da6bb411758cfe116ee147725a51': "小学五年级大半时间，我都眯着眼看白板，把眼睛挤成一条缝，直到字迹晃成我勉强认得出的样子，剩下的就抄旁边那个女生的。", // For most of Primary Five I had been squinting at the whiteboard, screwing up m
  '965a6c31b242a7e97be7bc77576cd42cdc74ac1fcbf5a8a8631d60e74e4f16c5': "它们停在我鼻子上，奇怪而沉重，整个房间似乎都倾斜了一秒钟，随后又平静下来。", // They perched on my nose, strange and heavy, and the whole room seemed to tip f
  'b5857c6bf8076a980ee75fb1adabb9955643bd99622e07b745a89086df2c63bb': "接着老师开始在黑板上写字，我坐在原位就把每一个字都读了下来，一次都没往前凑。", // Then my teacher began writing on the board, and I read every word of it from w
  '0174606e6cae52a6e4f0fede428291ad6ef5f2c29a70728b304e2520ec07c823': "我盯着桌面，假装在书包里翻东西，恨不得地板裂开把我吞下去。", // I stared down at my desk and pretended to hunt for something in my bag, wishin
  '3dcb19c8bcb554da85e90225068dde6fe85862246a0aa05e62b2c2ee3be0531a': "那时我已经不太在意了。", // By then I had stopped minding very much.
  'c1181a480187acb9bbcf329f6a0a0349e0b297acf7b01ad2a1dd3d25d9cfa4cc': "每年中秋，我们这栋楼的走廊都挂满灯笼，而我每年提的都是一个会放尖细小曲的廉价塑料灯笼。", // Every year at the Mid-Autumn Festival the corridors of our block were hung wit
  '8a6c46048856efc5191065c959459484cb65d7e2e7394574cead2b7937138b73': "父亲在牛车水的市场给我买了一条红纸鲤鱼，配着黑纸做的鳍，肚子里点一支真蜡烛。整整一周我都把它搁在柜顶，等着提灯游行那一晚。", // My father had bought me a red paper carp from the market in Chinatown, with bl
  '9153cec52c0cd9b75c7b287bd590a199864b7bbff3c7655822a5eb9f76233a3d': "到了游乐场我再拿回来。", // I'll take it back at the playground.
  'f6b63b7924779bc4309d2d761859ea64dda136b862fc620f7def3cb42879320c': "我们沿着楼与楼之间的小路列队走，组成一条缓缓移动的小灯队伍；我走在靠前的位置，双手扶着提手，尽量端稳。", // We paraded along the path between the blocks, a slow line of small lights, and
  '1a8a29c9c1e0dfe69ff2733e396728d0fb61a1de138a20d5f352feec7318bee8': "我手里拿着一个光秃秃的、烧焦的铁丝框。", // I was left holding a bare, charred wire frame.
  'c7346cac73a6396b4e050acd0fb4b52e4766d70b40834c8fd1c47fd1636c22ed': "有一团明亮的火焰，一股烧纸的味道，然后我那条美丽的红鱼变成了地上一团灰色的灰烬。", // There was a bright curl of flame, a smell of burning paper, and then my beauti
  '7ae87c79d9aa1895d3469d1a3a8accd4dbb3c54e61b2675ee8450331865e5992': "父亲替我点上蜡烛，然后回楼上从走廊往下看；那条鲤鱼从里面透出光来，像活的一样。", // My father lit my candle for me and then went back up to our flat to watch from
  'c5bd6e24aa410dc2649cfea4b754d4e507a09feef226e07c2bfa8997fab69860': "她只是提着灯杆，把自己那盏白兔灯递过来，说：「你先拿着。", // She simply held out her white rabbit lantern by the stick and said, 'You hold 
  'd495489971939d79ae11899e6b9b13d4ad9417b647db045b11b14f8b9b0e16ad': "前头那队灯笼没停下来，继续往前走；我站在路边，手里只剩一个提手，别的什么都没有。", // Ahead of me the line of lanterns moved on without stopping, and I stood at the
  'f3c47e1ab8290592e022b4a20364b9e460b39195cc9ea292eead4433487a974f': "我眼睛一下就湿了，怕一开口声音就会发抖。", // My eyes filled and I could not trust my voice.
  '2f542886e1b6e5c43f7952f5abe3289648bb61a06d6fd96fa5a8612e14fa5e23': "我的教练谭先生是个耐心的人，声音洪亮而愉快。", // My instructor, Mr Tan, was a patient man with a loud, cheerful voice.
  'a753270b97e1902ad06b409d19d26bb3d7c752076b33b7804dc59c9082189412': "我确信自己差点溺水，尽管水甚至没到肩膀。", // I was sure I had almost drowned, though the water was not even up to my should
  '6285853d80959851a6f4148d08124353761b9298ce9f3f71ab9c547471a554cf': "我记事起就害怕水，那天早晨，在一个普通天空下的浅水池里，我终于战胜了这种恐惧。", // I had been afraid of the water for as long as I could remember, and that morni
  '4b4c52d0546c1351b54e4d60842d70c0765b26f9f72252ce057125fd1c0882a0': "他的手托着我，我又躺了回去，望着开阔的晨空，慢慢呼吸，等着那阵怕劲过去。", // With his hand holding me up, I lay back again and stared at the wide morning s
  '1f64fbfe43b4840e7aa27bd59d5be9a32884dba50f5277e381a7a47b64ed8059': "当其他孩子在水中嬉戏欢笑时，我坐在水边，脚趾几乎触不到水面。", // While the other children splashed and laughed in the water, I sat at the edge 
  'dadfa337b001f49b9a6bd762fc1c7fbf8c1d969e9c2abecaeb07197fc5895e40': "当我意识到脚下只有水时，我没有沉下去——我只是轻盈地躺在那里，像一片叶子，被水池本身支撑着。", // When I realised there was nothing beneath me but water, I did not sink — I sim
  'd12a6ed8cb808242a9b6d8dc2d388f0c0646757e7bcc482be60d57d267c112de': "我忍不住笑了出来。", // A laugh burst out of me before I could stop it.
  '83295d96362eab79b9029eca6bcf94666c1cf18829682a60d21d25c39cfef526': "水涨到胸口，冰冷而陌生。", // The water rose to my chest, cold and unfamiliar.
  '54c9e152cf3818075544be9db1661225a3ee6b9cb71df300cfde0f3365573dbf': "“今天我们漂浮，”他说，带我进入浅水区。", // 'Today we float,' he said, and led me into the shallow end.
  '586703daf2be7b83f956b7a2086a563068dae0d657eaeed8b749372f060f7d86': "我呛得直咳，胡乱去抓池边的扶手，一边咳一边眨眼，心撞得肋骨发疼。", // I spluttered and grabbed wildly for the rail, coughing and blinking, my heart 
  '50155e3e128fd1feeba9fb7fd5ecdd8a4b46f5cb105ce9f91ebdae06c210d6b5': "我往后靠，但耳朵一浸入水中，水涌入鼻腔，我慌了。", // I leaned back, but the moment my ears dipped under, water rushed into my nose 
  '5ef9496a3041c7df1a43428226d6248195329cd72ecbc56248947a417a355d21': "「我不会让你沉下去。", // 'I will not let you sink.
  '0a4386e4b512808bc41b7933cfc0a36f10065434f915a072aa75804b9ba2cf2b': "一课下来，我已经能自己浮着，甚至在浅水区笨拙地划了几下。", // By the end of the lesson I could float on my own and had even managed a few cl
  '06d0b1769bdc142b0d91b5e6d228d88af45966510ca839099986faaf5aa49c63': "“不知怎的，这几句话松开了我胸口的结。", // ' Somehow those few words loosened the knot in my chest.
  'a62a06a2e8301b80eb3015c80051cd997fe088dc7aa790483777a899a76b33dd': "每个星期六早上，父亲都带我去我们家附近的公共游泳池。", // Every Saturday morning my father took me to the public swimming pool near our 
  '045fd6d01276370591c65c12e2391ee1064d91d8672acd5fa722a0d5c30b1534': "走廊上有人这么叫我，我应；教员室外的班级名单上是这个名字；还有一次印在班际测验的奖状上，烫着金字。", // I answered to it in the corridor, on the class list outside the staff room, an
  'a5b76a3e34b6e6a69bda7d7e69f76215525caa631ffe289b0ce8237860cc2cd0': "我握着笔坐在那儿，忽然明白：从九月起我一直躲着不做的那件天大的事，在这屋里其他人看来只有四秒钟。", // I sat there with my pen in my hand and understood that the enormous act I had 
  '26efac2e3be6ca13188acb486a8eb66d1d6e47acc1dbbb41bdb2d3431eb419f5': "举手说一句「老师，其实……」在我心里是件天大的事，好像我要为四个音节大闹一场。", // Putting up my hand to say “Actually, miss” felt enormous, as though I would be
  'ed6e68bd4ee4d01bbdf4fd9690f494fe44cb493c658357f04be93ced5e375154': "让这件事收场的，是一件再平常不过的小事。", // What ended it was completely ordinary.
  'e6040d5958d96a03dfe36d74a9bbe5fa10a478de0dbfb545647ef9d7384d4203': "第一天早上，代课班主任 Chandra 老师照着点名簿念成「Nur-ha-LEE-za」，重音落错了地方，另外三十一个人就跟着她这么念。", // Our relief form teacher, Miss Chandra, read it off the register on the first m
  '3568bf18b24a15f126e3747af392688d4805d9d7adf19b021a81360e999a18fb': "我叫 Nurhaliza。整个中二这一年，学校里没有一个人把它念对过。", // My name is Nurhaliza, and for the whole of Secondary Two nobody at school said
  '29bf3316a12da5c3648ab19e0c3aa2febed691c0d41670ee09fb6a7bbebbd7b7': "她是新来的，手忙脚乱，四十五分钟里要点完名、念完消防演习通知，还要收两份表格。", // She was new, and flustered, and she had forty-five minutes in which to finish 
  'f68a311c8c95f3769974dbeb181a57579bd45a58a7e8add9b4a6b607f2aa3bbc': "我没有纠正她。", // I did not correct her.
  '5767da37d0effb66590d9d8352622b18df41abfd517bd33d924b67c72bf10c75': "我说我不想小题大做。", // I said I had not wanted to make a fuss.
  'ec3175b372782c618de8e58a3d0ce928d087687589a23b31a683539b5c8f0a56': "大约在三月左右，这个错误的名字开始扎根。", // Somewhere around March the wrong name had grown roots.
  '778b00b08a5e913b44c79b51c200a0ac4140722a870744ab890618f4c509fff5': "我母亲拿着那张证书很久，把它对着光，然后默默地放进抽屉，这比她说话还糟。", // My mother held that certificate for a long time, turning it towards the light,
};
