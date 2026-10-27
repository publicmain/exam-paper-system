'use strict';

// 首发周例句的中文句意。key 是英文原句的 SHA-256；
// content/index.js 会逐条校验，少一条就立即报错，不能带缺口发布。
// 由 scripts/pilot/build-week2-context-translations.js 生成（Azure Translator），
// 生成后经人工复核（第九周 10-27：GPT 全审标出的误译已手工改写）。行尾注释是原句，方便审阅时不必回查。
module.exports = {
  'aa404cddb5a22b4eb0696ff5d03ea6ffde01d4c23e68445da8d1c936a2639573': "碘本身是1811年由法国化学家贝尔纳·库尔图瓦发现的：他注意到，正在处理的海藻灰里升起了一股紫色的蒸气。", // Iodine itself was identified in 1811 by the French chemist Bernard Courtois, w
  '20600a1ce87fc5958573dd1b43e79df27c031c61ee77d678e6b4eee5c75c0a9d': "在多山地区，以及曾被冰川覆盖的地区，融化的冰和大量降雨逐渐把土壤里的大部分碘冲走了。", // In mountainous regions, and in areas that were once covered by glaciers, melti
  '314dbb18c9ae94379158deb3f9719fa2c6495fbd28c6dd20fb98e0e0bf1fec8d': "然而，这种微量元素是不可或缺的：位于颈部前方的甲状腺利用它制造调节身体新陈代谢的激素，这些激素对大脑正常发育至关重要，尤其是在生命的早期阶段。", // Yet this trace element is indispensable: the thyroid gland, which sits at the 
  '129931ab379b537cbb272daa46a414b34849a7b2b74a402e14f159aaf3353221': "在这种土壤里种出的作物、在上面吃草的动物，含碘量也相应很少，所以依赖本地食物的社区摄入的碘可能远远不够。", // Crops grown in such soils, and animals that graze on them, contain correspondi
  '3059d07eaf59ad6f393307004c06b30680796e2026e5ef068930746f5d599bb3': "这时，甲状腺会肿大，试图从血液中摄取更多碘，于是形成一种看得见的肿块，叫作甲状腺肿。", // When this happens, the thyroid gland enlarges in an attempt to capture more of
  'b115a91dd6e980fe58ee707b75caaecf482577abda99eb0bd929f55a8c45a903': "在英国，碘盐从未被强制要求，碘主要来自牛奶，且大多是偶然：牛饲料常被添加碘，碘基消毒剂也曾用于奶牛场的设备清洁。", // In Britain, where iodising salt has never been compulsory, iodine has come mai
  '418f40eb7ca1fb2d21b10d87638f4a31c4cada952bb64ee65bf3c00fbca893b4': "另一个复杂因素是，由于摄入过多盐会升高血压，许多国家的卫生部门敦促人们减少盐的摄入，这似乎削弱了依赖盐来输送碘的理由。", // A further complication is that, because eating too much salt raises blood pres
  '8ce86bbed4b1bbac6ccb5e5e96db9706a115e56a36a9a5b6936ad703434ef478': "富裕国家也未能幸免。", // Nor are wealthy countries immune.
  '94692086ac6df24c2a5fea83a56a662754130ec923ca672b2e9fa17d52036b41': "对于大多数富裕国家的人来说，碘是一种容易被忽视的营养素。", // For most people in wealthy countries, iodine is the kind of nutrient that is e
  'fd78f22754a08a4f4501ba4edf124bf778f49f692c8b1f27293ef119ef818302': "不过，这项成就还没有彻底完成。", // That achievement, however, is not yet complete.
  'ba54a5f561f71513dbf83b95e06bf95a892a0cdc1f46ba5adb4c9504c43d6592': "几年之内，对当地学童的调查就显示，这种病的发病率大幅下降。", // Within a few years, surveys of schoolchildren there recorded a dramatic declin
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
  '2bceee34476da478ce6cd23d4b6e43d10467c23ceb8a285766dc597f5a918ad7': "九月，居民委员会提出一项建议，想把这块地改成花园，但想先听听附近居民的意见。", // In September, the residents' committee announced a proposal to turn it into a 
  'd69e969ab54a5562fc3a85659dd402f08e24a5542fc24d49197455d89610591a': "渐渐地，我们发现了一件以前从没注意到的事：这块草地很少没人用。", // Gradually, we saw something we had never noticed: the field was rarely empty.
  '9409c40714d4f31c23be62032ab26a377885f6bd843a73eaee45a8f692e09d65': "答案显而易见。", // The answer is obvious.
  'e192ea4f669173cff0ac9e8f1ba7365c1d73477c28e0227bebb577ccbb12945a': "多数人，78人，给出了我们未曾预料的回答：“保持现状。", // The majority, 78 people, gave an answer that we had not expected: "Leave it as
  '7989e2201325a6e0dd457cc40f2807c2f8736de05313b5fef2d26a974d898555': "“我们大多数人都这么想。", // " Most of us assumed the same.
  '04b040f438c220bc5d7757d544d6fa05e4ef1ab86a522f7b2dbf17b599ef5e52': "晚饭后，有些家庭在那里打羽毛球。", // After dinner, families played badminton.
  'd4cef4447b5b61b9da91c4d9b28f0a535f73a9781c578c32a397f080dbb91f5a': "于是我们做了一张海报，贴上这块草地在不同时段的照片。", // So we made a poster with photographs of the field at different hours.
  '2149ece15a2d855e7a4c9612042e77676aa4d10e38d09fe29bb84848b339fadc': "委员会改为加装了两盏灯，让草地天黑后也能用，还装了一个水龙头。", // Instead, it added two lights, so that the field could be used after dark, and 
  '1a7e3ea889000999be14c0f7c1a3b448f00d1313066c04df1ed248427f503245': "一位老人解释了原因。", // An old man explained why.
  '8a5ba054ccf2db25175f2f56f49873b2b4c6704985b8c815d962d6003e517f3f': "然后他建议向委员会展示证据，而不仅仅是数字。", // Then he suggested showing the committee the evidence, not just the numbers.
  'ade785c3ffbf5ac1d4d3980d69db0434af91e8097072325ddd8e92804b1a1d15': "整整两个星期，我们每天早晚都站在草地边，问每个人同一个问题：“你希望这块地变成什么？", // For two weeks, we stood by the field each morning and evening, asking everyone
  '843329328e709dd36a94a5068911a2b86fc812944b96dd401922ba184b1960af': "我们点头，确信他在夸大其词。", // We nodded, convinced he was exaggerating.
  '08a84653831af426e921e48f87d8ea3f8c16fc5b84452f36c1def32425245694': "他告诉我们，一项著名研究的研究人员开发了一个程序，似乎能区分狼和哈士奇，结果显示它主要在寻找背景中的雪。", // Researchers in one well-known study, he told us, built a program that appeared
  '3146909710def1aed7aff34feda385ad02357cbae43c88b6a3546d17db623528': "两个数字都写上了海报，中间画着博文的拖鞋；程序这次只有52%的把握说它是易拉罐，施蕾娅说这是它在“耸肩”。", // Both numbers went on the poster, with Bowen's slipper drawn between them; the 
  '0ac092c0ebf5ce2116a9dc0eb99139ab6cce35ccd35b285e590feff43a3e0618': "于是我们把每张照片都重拍了，这次特意换了各种不同的场景：食堂地板上、书包里、别人手里、走廊的黄灯下，当然还有我家厨房的桌上，这样所有易拉罐照片唯一的共同点就只剩易拉罐本身。", // So we retook every photo, this time in deliberately varied settings: on the ca
  '2bd437cdb2cf90a3aa0f05dc8b87e603a198827ebe432554c1220a5ae3d05ccd': "原来它注意到，每张易拉罐照片里都有一张白桌子，每张瓶子照片里都有一张灰桌子，这条规律比任何关于形状或标签的规律都简单得多。", // It had noticed that every can photo contained a white table and every bottle p
  '66530204ee7fb772748a4ac9c7102ddc0a3c6d95756107fe168a26698f994691': "“别这样，”我厉声说，抢回手机。", // "Stop it," I snapped, grabbing the phone back.
  'fce52139840be2477602982d3612b4b0d71cf57e84ccb3424f6ca2013fe5a061': "中三的应用学习项目，我和施蕾娅选了一个我们以为最简单的题目：一个能分辨饮料罐和塑料瓶的“智能垃圾桶”。", // For our Applied Learning project in Secondary Three, Shreya and I chose what w
  'ff341dce02b7dcc5ae739bfa3eac403b940b99f632ff42916a0a72dcf73fc936': "我花了整晚才勉强接受这意味着什么。", // It took me all evening to accept, reluctantly, what that meant.
  '8c906387a8e87d0a815139f91fe1da84892dc801d73ff6e1629775398953741d': "我把这个数字发到班级群里，后面加了三个感叹号，施蕾娅已经开始对着镜子排练我们的展示了。", // I sent the number to our class chat with three exclamation marks, and Shreya b
  '51a03662c784dc2c491302feedb07825900b1e15c2ba8d0cb147ecb2c5007366': "他把拖鞋放在厨房桌上，把我的手机举在上面。", // He put his slipper on the kitchen table and held my phone above it.
  '77a3980f061db542fc4728f661295e917ecb2a4ad06975fbbcabf75296041b43': "两周后，我为了化学考试复习，重复同样的二十道练习题，直到每道都答对。", // Two weeks later, I was revising for a chemistry test by repeating the same twe
  'bb8782bfe2e19751357c1817ee188e8a50d15564aaa62ba75081c9598e43a186': "屏幕显示：“易拉罐，97%。", // "Can," the screen announced, "97 per cent.
  'fead4e32c14c63e5dd93b5453c70f140a6fc943e1a63f668c9964841eeb433fa': "那个星期六，我八岁的弟弟博文闲得无聊，吵着也要玩一次。", // That Saturday my brother Bowen, who is eight and was bored, demanded a turn.
  'dece1b7a250d83aec1add84f207e941f98e8387fb56cad33f1848a51c4402be5': "施蕾娅是在科学实验室的灰色桌子上拍她的瓶子的，她每周三都留在那里。", // Shreya photographed her bottles on the grey desks of the science lab, where sh
  'a4f598b9af317704cd3814d4a68c4855659a5109718ea5752354dbf530279db0': "也许我学会的不是化学，而是那二十道题。", // Perhaps I had learned not chemistry but those twenty questions.
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
