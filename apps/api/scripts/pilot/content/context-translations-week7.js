'use strict';

// 首发周例句的中文句意。key 是英文原句的 SHA-256；
// content/index.js 会逐条校验，少一条就立即报错，不能带缺口发布。
// 由 scripts/pilot/build-week2-context-translations.js 生成（Azure Translator），
// 生成后经人工复核。行尾注释是原句，方便审阅时不必回查。
module.exports = {
  'c869b34d261f27ad76f71c3d1bae75f178f84e69de2a579d069850dfa911add5': "灭绝前形成的岩石里布满了浮游生物的微小化石，但在上方的岩石中，几乎全部消失了。", // The rock that had formed just before the extinction was full of the tiny fossi
  'd99563194f9c33a13f0cf4331d3d852eb04d96fccc002a27cb8bb65d78d2a96a': "没有阳光，光合作用将停止，陆地和海洋的食物链也会崩溃。", // Without sunlight, photosynthesis would have stopped, and food chains on land a
  '83ef2c3ae198b5829ae45e97c3cfe8241ff91fc4b2fe4e4d871a96974cda6110': "在全球同龄岩石中发现了带有强烈冲击痕迹的石英颗粒，这种冲击与剧烈撞击有关，最常见于墨西哥湾附近。", // Grains of quartz bearing the marks of an intense shock, of a kind associated w
  'ab248675a4581e44e6e7db3e5f604d9487b99bd665ddb5b6920a921898edc0e6': "金属铱在地壳岩石中极为罕见，但在陨石中更为常见，太空尘埃以相当稳定的速度沉降在地球上。", // The metal iridium is extremely rare in the rocks of the Earth's crust but far 
  'f7fffa745dc6547edfde4d7efaf73d5c4ebf59b1d1ae71201cfb78e0c9f7f929': "大约在同一时期，印度西部发生了巨大的火山喷发，释放出可能改变气候的气体。", // At around the same time, enormous volcanic eruptions in western India were rel
  '145291506c9247d8bb0d34182089d7d8e5be51d5515f55118ca07b4fca061c49': "1978年，墨西哥国家石油公司的地球物理学家格伦·彭菲尔德在尤卡坦半岛附近的空中勘测中发现了一个巨大的圆形结构。", // In 1978, Glen Penfield, a geophysicist working for Mexico's state oil company,
  'c8d5cdaded2cd3aba17262bd0b4584673ef438d81917edbaf0b20642feb7766b': "许多古生物学家持怀疑态度。", // Many palaeontologists were sceptical.
  '950dd50ab022ff55a85a8fd7a283993e4b9082cf53e61c25960ed8b7b85f5507': "20世纪70年代，美国地质学家沃尔特·阿尔瓦雷斯在意大利中部古比奥镇附近研究石灰岩。", // In the 1970s, the American geologist Walter Alvarez was studying limestone nea
  '5fbb4035593be02932ea22c7bff2f896c39b422c95b50d3eaf50c825a64802a4': "如今，大多数科学家都认为小行星撞击起到了核心作用。", // Today, most scientists accept that the impact of an asteroid played a central 
  'b7bdea57ad702be2690d4cc4b8893143bef66d50cd9a272b7c7630dc9385731b': "然而，它的失效揭示了一个更重要的事实：古比奥的薄粘土记录的不是缓慢积累的尘埃，而是一场突如其来的灾难。", // Yet its failure revealed something far more important: the thin clay at Gubbio
  'f6bf26d2af0671a44264e2b88c36c8e2291648099573038e2c7a608186fcaf97': "他的父亲路易斯·阿尔瓦雷斯是一位获得诺贝尔奖的物理学家，提出了一个方法来验证。", // His father, Luis Alvarez, a physicist who had won a Nobel Prize, suggested a w
  '56ad785ba72de1dbe7c76e7e2fb3e324f4516dcc82687deff57d8cab120ecf8e': "两者之间是一条约一厘米厚的泥带。", // Between the two lay a band of clay only about a centimetre thick.
  'b460a847b49e10affcbe2667460e9b3a787c350df5276996f5d4a6e71d23e210': "几十年来，这场大规模灭绝的原因一直是推测。", // For decades, the cause of this mass extinction was a matter of speculation.
  'b4d278830251e2aeb690e342e369e0d7da811c6d15e890bfc0666e1bc2a3144f': "2024年，对边界粘土中钌元素的研究得出结论，该小行星属于一种富含碳的类型，形成于外太阳系，位于木星轨道之外。", // In 2024, a study of the element ruthenium in the boundary clay concluded that 
  '36f62f4ec4d21992264310e65ed4124942773bdd3c92502aebbe2820d9690c37': "公司允许彭菲尔德和他的同事安东尼奥·卡马戈在1981年的一次会议上描述该现象，但未公开详细的调查数据，且他们的报告几乎没有引起关注，部分原因是当年许多影响专家参加了不同的会议。", // The company allowed Penfield and his colleague Antonio Camargo to describe it 
  'fbd20531fc3606b3a2a37ce2a8861583c8443a7e50a498a765ecdb2a5e661d86': "令人惊讶的是，改变他们看法的证据来自于试图回答一个更小的问题。", // Remarkably, the evidence that changed their minds came from an attempt to answ
  'af4827fec51eb14c35e65cb2546e8960c2fdc11e916aadfc9b835087576b4b04': "在其他研究人员的后续研究中，参与者被展示了一张经过篡改的照片，照片中他们小时候躺在热气球篮子里，许多人开始回忆起一次从未发生过的飞行经历。", // In a later study by other researchers, participants were shown a doctored phot
  '06c7c7fe0c8305a76fd6fedc7389c41cdc0c5012f5f9e6c3c51675791769fbb1': "其中约69%的案件中，目击者误认是原因之一。", // In about 69 per cent of them, a mistaken identification by an eyewitness had p
  '0d35a9d11b52a82c10fd04f173156fde57528deb64e42384f65ec75a17db9aa6': "记忆不是固定的记录，而是重建，人们被问的问题、看到的照片和听到的故事都能在记忆上留下印记。", // Memory is not a fixed record but a reconstruction, and the questions people ar
  '37790f86bb65f17143f616b81386d91c6451dd97d09c19398f9faab2a60800b8': "美国组织“无辜项目”审查了1989年至2020年间375起被定罪者后来通过DNA证据洗清的案件。", // The Innocence Project, an American organisation, has examined 375 cases from 1
  'a91ad052214a2cd66e24858a47e7fe2cbad6fc06839eacfb5a9514445c37989f': "这些证人不一定在撒谎：一个人可以诚实地确定记忆是错误的。", // Such witnesses were not necessarily lying: a person can be honestly certain of
  '1871ce0f93b253ad235a08e35e954763bf475006800df37663a4e3f191f630ec': "后果在法庭上最为严重，单个证人的记忆可能决定一个人是否入狱。", // The consequences are most serious in courtrooms, where the memory of a single 
  'b94c00d854c0fa6f3ef60b6b8cbb69f5cc0cc7f94919740622564693bfeb2c74': "到几个月后的审判时，信心可能通过反复和鼓励而增长，但这对证人是否正确的判断就大大减少了。", // By the time of a trial, months later, confidence may have grown through repeti
  '2d79ea4cf2d089301b3c2b14d10ba363b25f2f45cc679a0acbe3d2eb6ac0bad2': "对于其他群体，动词被替换为“contacted”或“smashed”等词。", // For other groups, the verb was replaced with words such as "contacted" or "sma
  '9f6d7eaa4a04f515c68747561b30503ed50331f79c202a337fe6ab0e84b4e04c': "分歧部分取决于什么才算是真正的记忆，而这个问题尚未解决。", // The disagreement depends partly on what should count as a genuine memory, and 
  '3bc4362d9e95e829f40bea657d7915541e8df486903090405ed836dac578cb23': "2017年，心理学家约翰·维克斯特和加里·韦尔斯审查了证据，得出结论：证人的信心可以作为准确性的有用参考，但仅限于首次识别时，且程序公正。", // In 2017, the psychologists John Wixted and Gary Wells reviewed the evidence an
  '872e704f67f2b2f630721051ea9e88e0d180c2eddde957985659e723431f1815': "数十年的研究表明，这一形象具有误导性。", // Decades of research suggest that this picture is misleading.
  '6317758f9e5c2fdd704dedee7f442f345ad068e9f481ca70d44687c452a76ea0': "其他重新审视数据的研究者认为，许多记忆模糊或部分，且极少参与者清楚记得虚构事件。", // Other researchers who re-examined the data argued that many of these memories 
  '259b7a121178799da0ce5edfb78973a4d6459e5ea4080e4060da7a5f39ab2c07': "记忆似乎每次都从片段中重建事件，之后收集的信息可能会混入结果中。", // Remembering seems to involve rebuilding an event from fragments each time, and
  'd1c3a0a5e0e01638d22a651a3a8a22b8c276d975ac0a55eb835f12ce540b0d57': "负责辨认的人不应知道其中谁是嫌疑人，证人的信任程度应立即记录。", // The person running the line-up should not know which of its members is the sus
  '38aad92932701228004f26c21ac4397ab09c4a321ed50c166f7125451261aa50': "在大部分历史时期，农民通过种植这些植物和撒肥来维持土壤中的氮。", // For most of history, farmers maintained the nitrogen in their soil by growing 
  '26f3d46d4cdd347331b2b992fb93451e3be04d2e3d7a028ee91f8b416eeadade': "在那里，它能滋养藻类大量藻类，导致水源缺氧，减少陆地上植物的多样性，并形成一氧化二氮，这是一种强效的温室气体。", // There it can feed blooms of algae that leave water short of oxygen, reduce the
  '57de4f4e404c24700434ab08a9078426cc718370b14c623eadfee42b45295eeb': "博世还必须建造足够坚固的容器，以承受高压高温气体;起初，氢气会侵蚀钢墙，使其变得脆弱。", // Bosch also had to build vessels strong enough to hold hot gases at enormous pr
  '766e07716c2d46159a92ac23e5593c9eb140eac0f21ecadeec21114c14d4a171': "哈伯的催化剂——稀有金属锇——由于稀缺且昂贵，无法大规模使用，因此由阿尔温·米塔施领导的团队进行了数千次测试，最终确定了一种基于铁的廉价催化剂。", // Haber's catalyst, the rare metal osmium, was far too scarce and expensive for 
  '4e16257f9d25b8a4721f5ab5de2b3b77c5919938472c8c1ee5b606e28b9889b4': "每个生物都需要氮。", // Every living thing needs nitrogen.
  'c6ad64c0079c777f11c4bc6ab40221635c2bf652986c0617fab103ca4cfafcb0': "1909年7月，哈伯向化工公司巴斯夫演示了一种小型装置，能够连续一滴地生产氨。", // In July 1909, Haber demonstrated a small apparatus to the chemical company BAS
  '806ff79e1b265dff565f81221a3d2c8c9d39dbade3edc05fb1e1d5d021c48355': "在卡尔斯鲁厄工作时，他使空气中的氮气与氢反应生成氨，氨是一种可以制备肥料的化合物。", // Working at Karlsruhe, he made nitrogen from the air react with hydrogen to for
  '18111b5b8e6a1eb5fe79775888ded1a2269c9572bdabdcc6f3cc444617a0feb8': "讽刺的是，氮气无处不在：它大约占空气的78%。", // The irony is that nitrogen is everywhere: it makes up about 78 per cent of the
  '7c9870ba993c3cbe117876dea8c3c32afc7cd474a8ed5608c5ab689c6d3a0716': "在自然界中，只有某些细菌，包括生活在豌豆、豆类和三叶草根部的细菌，以及在较小程度上的闪电，才能将其转化为可用的形态。", // In nature, only certain bacteria, including those that live in the roots of pe
  '62d8be68637511fa3e632586a1bdb69596c58ba3ca15de4feb8b935c1a6cd696': "它是蛋白质和DNA的重要组成部分，对于作物来说，它往往是供应最短缺的养分。", // It is an essential part of proteins and of DNA, and for crops it is often the 
  '1b618a243090217d034fe04a870f30561bd700c710cb77bcfdb9ec8290add8e2': "十九世纪，随着人口增长，欧洲开始从更远的地方进口氮，最初是鸟粪（海鸟粪便）来自秘鲁海岸附近的岛屿，后来则作为智利沙漠开采的硝石。", // In the nineteenth century, as populations grew, Europe began to import nitroge
  '66ffda80924738f0008edfe04641e6bdc1c45f0dec0e9b034638da09130783a7': "氨可以转化为硝酸，硝酸是炸药的起始原料。", // Ammonia can be converted into nitric acid, a starting material for explosives.
  'd8d893ca1de0df9379dbc458e708bc62a4a5cfd6511cad49099fb40d916eaf11': "哈伯本人还负责德国毒气的研发，当他于1918年获得诺贝尔化学奖时，这一决定遭到了强烈批评。", // Haber himself also directed Germany's development of poison gas, and when he w
  '10f583e97b4362ccb184f3119677912bb860f4d4e2ff0b8dd29b6078859d6e45': "这些数字难以精确计算，因为更好的作物品种和耕作方法也提高了产量，但毫无疑问，数十亿人因此得以养活。", // Such numbers are difficult to calculate precisely, because yields have also be
  'dcaf59040599e1fc23a08708c7869faf2c061624e04bb6cdf6c9f6edaa4d19fa': "该反应需要极高的压力和高温，并配合催化剂加速。", // The reaction required very high pressure and temperature, together with a cata
  '0f88d9d4875679860b6ab8713f85d1c86420f8744614470d0803c4659232ce40': "将实验室成功转化为产业则是另一回事，主要由巴斯夫的化学家兼工程师卡尔·博世解决。", // Turning this laboratory success into an industry was a different problem, and 
  'e7c957577190adb1698e8a463248214324e7cade3c51ae609472bbab3815a43d': "第一次世界大战期间，英国的海上封锁切断了德国与智利硝石的联系，新建的工厂使其得以继续生产军火。", // During the First World War, a British naval blockade cut Germany off from Chil
  '64ff7bf536885ee46b71e98c11e170b6adb6a35e72fb58e155f0d0ce4608c63b': "考古学家发现的许多棕榈种子显示出被老鼠啃咬的痕迹，从这个角度看，老鼠通过吃掉种子阻止了森林再生，因此人类并非森林消失的唯一原因。", // Many of the palm seeds that archaeologists have recovered show signs of having
  '8d30ef4f7afad7e5847787a7be402c8803d66a06ddbafd7931cb697ca705a7a1': "岛上湖泊沉积物中保存的花粉表明，岛上曾被森林覆盖，包括一棵现已不存在的巨棕榈树。", // Pollen preserved in the island's lake sediments had shown that it was once cov
  'c05be5dc5b5d00cc0366d496facb19888fd4eba22070dd84d58f74765087eef9': "没有木材后，他们无法再造独木舟远海捕鱼，裸露的土壤被侵蚀，社会在欧洲人到来之前就陷入饥荒和战争。", // Without timber they could no longer build canoes for fishing far out at sea, t
  '77aa50ebbd61b629d53d2e5cf0829ccfd20699db52b1f2c72e6af9b5b368909a': "两位研究者进一步认为，岛民适应了不断变化的地形，例如在覆盖石头的花园中种植作物，这有助于保持土壤湿润，保护植物免受风侵袭。", // The two researchers further argued that the islanders adapted to the changing 
  'fc4e18d5a76e18d54317bbb6353696a8b063895fbc40a9c3135e1dc792fcb8b7': "2020年对许多雕像所立石台的分析发现，这些石台的建造在欧洲人于1722年到来后仍继续，这与当时已经崩溃的社会形成了矛盾。", // A 2020 analysis of the stone platforms on which many of the statues stand foun
  '23067b5359db38457c0e29236552ca5e6d70469f5c24c35496471838222af747': "这个论点部分关乎证据，部分关乎解释，因为同样的事实可以套入崩溃的故事或适应的故事中。", // The argument is partly about evidence and partly about interpretation, since t
  '564359dfc036b56a3b78b79f4c1244593ad03f41d67e11f918cd41dfa6193c37': "此案还展示了一个引人入胜的故事如何在证据尚未充分检验之前广泛传播。", // The case also shows how a compelling story can spread widely before the eviden
  '34fde80e425e2be0a13fa3a1d8bc63daede9fb737aac70b2b3c1f0806751065a': "定居者带来了太平洋鼠，岛上没有天敌。", // The settlers brought with them the Pacific rat, which had no predators on the 
  '2e2e630d80d4346201c9be2b5c6aadfb54261601b67acc94ad0332fb8e9c4bde': "无论最终结果如何，岛屿的描述已经发生了变化。", // Whatever the final verdict, the way the island is described has changed.
  'd9aedf425b0142c8861737592b196cec04dd3acd99d39ac99c097e06e6190be2': "随后几十年的访客描述了这里几乎无树的景观，许多后来的观察者都好奇其居民如何移动如此巨大的雕像。", // Visitors in the following decades described a largely treeless landscape, and 
  '6931014f83be59fca8be6ea888994e3d8489287efe1477394fa4d9f28e90d9c9': "2006年，考古学家特里·亨特和卡尔·利波发表了新的放射性碳测年，表明人类最早定居于公元1200年左右，比人们认为的晚了几个世纪。", // In 2006, the archaeologists Terry Hunt and Carl Lipo published new radiocarbon
  '917127b717d14af5bbbc80c5c4df296c6a4a4b954c5efb605670129389b7b0d1': "这意味着旧故事中描述的一切，从清理森林到雕像雕刻，都必须在更短的时间内完成。", // This meant that everything the older story described, from the clearing of the
  '17e1f042a94f1e23b37648acd9923e4fbafde5b1d0640e9fe273f91979177be7': "Madrian和Shea提出了两种解释：惯性，因为改变安排需要付出努力;以及倾向于将公司选择的选项视为一种建议。", // Madrian and Shea suggested two explanations: inertia, since changing the arran
  '78f89c215c519a00e0e1d86a9901fb646b99a67c947c000ad858321c50821cb8': "每个表格、合同和电脑设置都有默认选项：当个人没有主动选择时适用的选项。", // Every form, contract and computer setting has a default: the option that appli
  '2956e288ef62c21b0872b065c5c30221e43ad3396085a56aca1fa3560ca549ee': "西班牙拥有世界上最高的捐赠率之一，1979年引入了推定同意，但其捐赠率直到1989年成立国家移植组织后才开始上升。", // Spain, which has one of the highest donation rates in the world, introduced pr
  '100d7235e6c113b03ee9a29f22231c75540319899f91a779fe8485458c36e05b': "尽管存在这些复杂因素，违约已成为公共政策的常见工具。", // Despite these complications, defaults have become a common tool of public poli
  '523d00c41264513e1d6926b297217f33c678c64997821a7bfe0db21d3cf1cf46': "有些地方，只有登记成为捐赠者才算捐赠者;在另一些地方，除非登记异议，否则所有人都被假定同意。", // In some, people are donors only if they register to be one; in others, everyon
  '15970ef07d974d61cd423eb332c7ff23106bed955cba356d2366622ec16f9944': "在英国，自2012年起，雇主逐步被要求将大部分员工自动登记为工作场所养老金，符合条件的员工储蓄比例从2012年的55%上升到2018年的87%。", // In the United Kingdom, employers were gradually required, from 2012 onwards, t
  '24ab733335d9a1823db94541afce7ed6394be464e1d7934be57af3f35ecce2c0': "而违约通常代表的是人们不愿放弃的现状，因为损失在心中比同等收益更为重要。", // And the default usually represents the existing situation, which people are re
  '62874aaa90bce0d056dcb9fb1bb359ab008225fc3e46c5fda064483d89728bf9': "器官捐献则是一个更为显著的案例。", // Organ donation provides an even more striking case.
  '54bb4279ce4475f5f68f941d85c6933af4bf544014c7d24fe0fc37e5c2b5c80e': "在使用第一种系统的德国，约有12%的人同意捐献，而邻国奥地利采用第二种方式，这一数字为99人。", // In Germany, which used the first system, about 12 per cent of people had agree
  '687b719e49a32145a85f3f9c16cf6d13d8a04c0f3e22ab6b7829ca56a58e44c2': "此前，新员工必须自行注册该计划;之后，除非他们选择离职，否则会自动注册。", // Previously, new employees had to sign up for the plan themselves; afterwards, 
  '569c43bb3a13a60effd77d453a167227e327dbab3f4686dd1c4f2c03acba8061': "2019年对35个富裕国家的比较发现，两者在死后捐献方面无显著差异，且采用推定同意的国家活体捐献者较少。", // A 2019 comparison of 35 wealthy countries found no significant difference betw
  '7d7a0ceed9b54e62a42dc0bab0c2ce90c612c63c8501e40ab01a536fd2a502bf': "约翰逊和戈德斯坦自己的分析发现，推定同意与实际捐款增加约16%相关，远小于同意率差距。", // Johnson and Goldstein's own analysis found that presumed consent was associate
  '598135477daa9592669d0107c51f706b6fdbe28be2e35e412521ea0f32fd1439': "传统经济理论假设，拥有明确偏好的人会轻易改变任何不适合自己的选项。", // Traditional economic theory assumed that people with clear preferences would s
  'c44864d38effa45b81520134c2571ea2d4060cf59726f60bf233a5917eb66df8': "然而，大量研究表明，提前选择的选项对人们最终拥有的选择有着强大影响。", // Yet a large body of research shows that the option chosen in advance has a pow
  '03aa9e947c89daa2a63c7e9c7e8dd0dc9a173da1d24ccae62128b1d9dd1e8f34': "一个著名的例子来自美国的退休储蓄，许多雇主提供一种称为401（k）的储蓄计划。", // A well-known example comes from retirement savings in the United States, where
  'f2d819aa031dbf5d62d933dd4eef3912d72021e049415ba80d5b3e767293bf55': "2001年，经济学家布丽吉特·马德里安和丹尼斯·谢伊发表了一项关于一家于1998年4月更改规则的大公司的研究。", // In 2001, the economists Brigitte Madrian and Dennis Shea published a study of 
  'f0fbb1ec62135bf968ddba311d409b169af103a63b0866844856daece23e177e': "用手指吃炸鸡后，你可以把手放在水龙头下多久都行，手还是会觉得油腻。", // After eating fried chicken with your fingers, you can hold your hands under th
  'bb595e6f603b6ba9d29e361604f078c92d3924bbeb0f19a096a04ce0e7ec385e': "水只是从润滑脂上流走，因为油和水不混合。", // Water simply runs off the grease, because oil and water do not mix.
  'd10f5987d478143c4c0b5fc11aae1a0b21c79908aa354c95010f7393ee58a399': "因此，健康专家建议人们用肥皂洗手至少20秒，时间大约相当于哼唱两次“生日快乐”。", // Health experts therefore advise people to scrub their hands with soap for at l
  '6f79437cde3df7d1593f9b7b9ecb4aea1eaeaa91fa8bd62143d2cb7863b30e13': "因为每滴水的外侧朝向水面，水滴不再粘附在皮肤上，冲洗时会把水滴带走。", // Because the outside of each drop now faces the water, the drops no longer stic
  'aa139c0b0a91c8488af1b5038b303b38b935a9d339dd488889cdeb4ed305a2e9': "然而，根据美国疾病控制与预防中心的数据，水温似乎不会影响去除细菌的数量，而较温的水可能会对皮肤造成更多刺激。", // However, according to the US Centers for Disease Control and Prevention, the t
  '981a314032ba806b2ddb8c0d0e5725e0bc5c02f7d07ea428ccf1653f1b530fbf': "揉搓也有帮助，因为它能把皮肤上的污垢和细菌带走。", // Rubbing helps here too, because it lifts dirt and germs off the skin.
  '8403246c8e018d6e18e3c1a002ce14c60a40bb8537892ec2b0d640f4c6af65f2': "另一端，即尾巴，避开水，但容易附着于油脂。", // The other end, the tail, avoids water but attaches easily to oil and fat.
  '0533794e8db4c7a98d9d7235a45617fa85937480f9ce2acef80f6431dc30227a': "搓手会把油脂打碎成细小的滴子，每一滴都覆盖着肥皂分子，它们的尾巴朝内，头朝外。", // Rubbing your hands together breaks the grease into tiny drops, and each drop b
  '9b767247268e676660792ac253f2f80e45695f3df550c6dc0e6a9b5a8144e62f': "许多病毒，包括引起流感和新冠病毒的病毒，都包裹在一层薄薄的脂肪中。", // Many viruses, including those that cause flu and COVID-19, are wrapped in a th
  '63d72ba4222baa87c35acf736e27db7a2415e05e336010a94d5efc52218ee172': "许多人认为热水是洗手的必要条件。", // Many people believe that hot water is needed to get hands properly clean.
  'd377b4ccab47d0e3c1583134a178f45b8dfc3d151777aa78553bc555435a6afa': "肥皂分子的尾巴可以强行进入这一层，将其打开，使病毒分解。", // The tails of soap molecules can force their way into this layer and break it o
  'e3f82fb535e4041a74d2251f623fc07af5a144d824bad5a2e03f8f584038c811': "最重要的是肥皂，以及你花在刷洗上的时间。", // What matters most is the soap, and the time you spend scrubbing.
  '1e88569162b13f23f998f85ac2e382caeb35148fcc0299a3ee652017f7e2629c': "洗手时，手尾会钻进油脂里，而手头会留在水中。", // When you wash greasy hands, the tails push their way into the grease while the
  'ca660dfe30d442f76ade792876d9510c39ab232b3852f23a0cb747df4d8206eb': "莱内克的听诊器只有一个耳机。", // Laennec's stethoscope had only one earpiece.
  'f99e34632ef934b10c1732b923c46e173c5f0cc60bca352b15040ca08dd97cd5': "莱内克很快用一根约25厘米长的空心木管取代了纸张，并将他的发明命名为听诊器，源自希腊语中意为“胸膛”和“检查”的两个词。", // Laennec soon replaced the paper with a hollow wooden tube about 25 centimetres
  '4da607193d23789cd4b7898d37b001e370a443501bced5fb9df82c5352228ff7': "他于1826年因肺结核去世，享年45岁。", // He died of tuberculosis, a disease of the lungs, in 1826, at the age of 45.
  'ab5b9ee0ad8ba4db9a4d1e0010ea48543274917a1a03fcd26b4f6b764d441e0f': "19世纪50年代初，爱尔兰和美国的医生开发了带有两个耳机的版本，分别对应一只耳朵，类似于今天医生使用的耳机。", // In the early 1850s, doctors in Ireland and the United States developed version
  '393d40ad7283f949e9cb2639d0291471c5146a4c1e5ceb94f0def10a857369a2': "令他惊讶的是，他能比单凭耳朵听到的更清晰地听到她的心跳。", // To his surprise, he could hear her heart more clearly than he had ever heard o
  '9a0def11e3f20a5b95c7ecbcfa76d173de3d25dfad373c157ff1ecbb460ef75f': "1816年，一位名叫雷内·拉内克的法国医生在巴黎一家医院工作时，被要求检查一名有心脏病迹象的年轻女性。", // In 1816, a French doctor called René Laennec was working at a hospital in Pari
  '9a69565148bcd5d2519f70d198b069d7296cc899e34dfefd3b4e83ae1e168c8b': "1819年，他出版了一本描述健康与病态心脏及肺部发出声音的书。", // In 1819, he published a book describing the sounds made by healthy and disease
  '6b40c6e8d25f1fa47a263845453ec1ea3c26a86e83e3cc68e88537e46e2ac827': "他可以轻敲胸口，听听声音，或者直接把耳朵贴在病人身上。", // He could tap the chest and listen to the sound it made, or he could press his 
  '6f64dc1b7dcc61925ecfe3ce19bcb39d214e081c9a359548415b0e57e4ae8c8b': "第二种方法对双方来说常常不舒服，而且效果并不总是好。", // The second method was often uncomfortable for both people, and it did not alwa
  'fbb9c0e65f1923ce209a92276eac340347d1e6b69155497ed66d2b25af70f483': "然而，他这个简单的想法至今仍每天在医院和诊所中被使用。", // Yet his simple idea is still used in hospitals and clinics every day.
  '4c2384e3da41b666c986dc3aea4fbede92bd4a492bbb3ffb7076f799adf90129': "然后他想起了一个关于声音的简单事实。", // Then he remembered a simple fact about sound.
  '0dc79db97d80f9a66dacfb003c02a74ffba090f2672eba0d7e4e9f0335d0806f': "问别人骆驼驼峰里藏什么，很多人会说是水。", // Ask people what a camel keeps in its hump, and many will say water.
  '8908a9e6409a7de6eb76e49c675b18aedacce2af9874d413c6ebe8ac87b0e154': "它的身体还能应对大多数其他哺乳动物会致命的环境。", // Its body can also cope with conditions that would kill most other mammals.
  '822f0b06d7f2175e5d158dec9c2c8af2446829bc481543213da6951723b9672c': "骆驼会产生非常干燥的粪便和浓稠的尿液。", // A camel produces very dry droppings and thick urine.
  '0a236d37c35845f0a46e88a62cfcca200bf77f3a24945184c32280367949257d': "它的红细胞呈椭圆形而非圆形，这有助于在身体缺水时保持血流，骆驼可以减掉四分之一体重的水分而存活。", // Its red blood cells are oval rather than round, which helps them keep flowing 
  'c3c20d59b54d62a8c338899e40967acd42ed9bc1d6dea73d65b9d9bebd527375': "脂肪是食物难以获得时的能量来源。", // The fat is a supply of energy for times when food is hard to find.
  '1ba04a365add098f9aae54601fcc1ecde56385724b5b3af612bfb9ca4a422160': "如果骆驼长时间不进食，它会消耗脂肪，驼峰会变小并下垂。", // If a camel goes a long time without eating, it uses up the fat, and the hump b
  'c8e9c454209c6e0e05bf1625c596a4afcd7ba94f5eb452d0e81296db49f01486': "骆驼不会出汗来保持凉爽，而是让体温在白天上升，从清晨约34°C升至约40°C。", // Instead of sweating to stay cool, a camel allows its body temperature to rise 
  'eaf14db224abae12303629020ca1a8331cc25c2fea9fc7573c9275909ad4b5db': "骆驼在处理热量的方式上也节省了水分。", // Camels also save water in the way they deal with heat.
  'd475663dd54c8d873c72524ac1722739b15930b4e62a1323a536dc4ab933d5b6': "这是一个容易犯的错误。", // It is an easy mistake to make.
  '7f8ba9363f3f61e7b3a4fe905ea9f170fd4f2cc0fd57c24f33a41e762ac118c0': "大多数其他哺乳动物在失去大约一半后就会死亡。", // Most other mammals would die after losing about half as much.
  'aac4aced6135d904a5a5724cbd3e863a9071e209c0416103f909b5a5806530a1': "答案很大程度上在于它们流失的水分有多少。", // Much of the answer lies in how little water they lose.
  '7610c5cdfefbf8755bc079dbae6dbef5e2d3a6eaaecd40fc6a89d27c6b2cb113': "呼气时，呼气中的大部分水分被鼻子捕获并带回体内。", // When it breathes out, much of the water in its breath is caught in its nose an
  'a93951bf1140d71ef1ea7aee742173f63be84b96e55c34472abfd63cf8724254': "另一种方法是闭嘴，捏住鼻子，轻轻吹气。", // Another method is to close your mouth, pinch your nose and blow gently.
  '9a89baa77528e11700c433b25d795beca608d28fffcccbdc7901e6368af4b719': "每个鼓膜后面有一个充满空气的小空间，称为中耳。", // Behind each eardrum is a small space filled with air, called the middle ear.
  '3fbf5a9f7bd07d3a4cfc0d45e0a5129ef5b9ea538f1a2ebb9fced0d54813a5eb': "随着舱内压力再次上升，鼓膜被推向内侧，管子往往被挤压。", // As the pressure in the cabin rises again, the eardrum is pushed inwards, and t
  '37b456a70ffb049952e9694068dbd1316a78062d2adce70a316d4e7e3d09b79d': "大多数时候，这个管子会闭合，但吞咽或打哈欠时会短暂打开。", // Most of the time this tube stays closed, but it opens briefly when we swallow 
  'a05d18fbd62d552910ae1d895a35b32e23ddac738751c1eab7ce71406104d5b7': "吞咽、打哈欠和嚼口香糖都有助于打开管子。", // Swallowing, yawning and chewing gum all help to open the tube.
  'fa94819cab2669e4f8788582984d7c608666461483071b26bf817f541a4e384c': "婴儿可以被喂奶吸吮，因为吸吮会让他们吞咽。", // Babies can be given a bottle to suck, since sucking makes them swallow.
  'b62a283ef54c51df73cdc2bc2d19276a5282103df2ee4a6362e7e2884b6705d4': "当飞机爬升或下降时，你的耳朵会被堵塞，声音似乎很远，然后伴随着一声轻响，一切又恢复正常。", // As the plane climbs or comes down, your ears feel blocked, sounds seem far awa
  '14ec6a87664ae20933ea906951803dbdda1043b0e42c5a179b3504fbdd4ebb89': "原因是气压的变化。", // The cause is a change in air pressure.
  '6840e573a19483d33ab8ecba645dbd124fbc2ced8eddf35fae61a4c84069e005': "感冒会堵塞管道，导致情况更糟，婴儿管较窄，常常在飞机降落时哭泣。", // A cold can make things worse by blocking the tube, and babies, whose tubes are
  'eeeda3b7cee1aad4db1efee08082cd6eeeb6b59bb6d4ef62d46c7741484cc68b': "空气只有在管道打开时才能回到中耳，这也是为什么着陆时通常比起飞时更不舒服。", // Air can only get back into the middle ear if the tube is opened, which is why 
  '40c4e8e3916808f87009c1806b09a4e49c8a24bcfdf69b390196a3c4b5c39b01': "医生还建议乘客在起降过程中不要睡觉，以便在感受到压力升高时立即使用这些方法。", // Doctors also advise passengers not to sleep during take-off and landing, so th
  '6654712df602df20d9d73327405a2a6866c2114ca70551f5ccd50c0be1a30dde': "飞机内部的空气压力高于外部稀薄空气，但没有地面空气那么高。", // The air inside a plane is kept at a higher pressure than the thin air outside,
  '93f7f9cad4050224689fe8e7aeef5ae8c21bf4c3997dedee4321e10b1c0dd522': "用火把照进石灰岩洞穴，你可能会看到天花板上悬挂着数百个石尖，像冰柱一样。", // Shine a torch into a limestone cave and you may see hundreds of stony points h
  'd900e55a581137b8130a8efbd3f15a6aceaa17f74e8cc6d3a2c087128d556cc3': "雨水从空气和土壤中吸收二氧化碳，使其变成弱酸。", // Rainwater picks up carbon dioxide from the air and the soil, which turns it in
  'fc0b1301a8980eae94f900fe72984955312a0b6b2b43d246d8a223ac71fb7e81': "如果吸管内部堵塞，水会从外部流下，钟乳石逐渐变厚成锥形。", // If the inside of the straw becomes blocked, water starts to run down the outsi
  'dd0f8960e5c7d65856da969893508264b8ce7fcee635839e477c48633dc1fe63': "落到地面的水滴也会留下矿物，形成向上生长的石笋。", // Drops that fall to the floor leave mineral there too, building stalagmites tha
  '4e007af08b30db1edae5cddecef3709dc741e355f98ca192c05ea363e4f1e5ff': "这些是钟乳石，其名称来源于希腊语，意为“滴落”。", // These are stalactites, and their name comes from a Greek word meaning "drippin
  'b66073fde7c53a406a5762bb587a19105fbbc4aade11b061926e7221aefad47e': "每年13毫米，所以增加一厘米可能需要七十年以上。", // 13 millimetres a year, so adding a single centimetre can take more than sevent
  '01cb360604788a9ea8bc70a95ae295fabbd163bdfe033652c6a1cf150980c5d6': "一滴滴，这些环逐渐堆积成一根细长的空心管，称为汽水吸管。", // Drop after drop, these rings build up into a thin, hollow tube known as a soda
  '8c12f0d5ffacfb1b9f00f822c1de8b3b74b9037338ff47b3823eab23b37f690f': "当它渗透石灰岩裂缝时，会慢慢溶解部分岩石。", // As it soaks down through cracks in limestone, it slowly dissolves some of the 
  'b701bf4c9446a30c3c5929498521f2dc6f2df924a70effb278e4500a4ebbe44f': "长时间下来，这会扩大洞穴的裂缝。", // Over a very long time, this can widen the cracks into caves.
  '5056f051d742c7ffbc6bb91445cf4b4418293091afd354b40353d481fe0e5b5d': "水里现在带着溶解的岩石。", // The water now carries dissolved rock with it.
  '87e03f67d830d599ebb848eba0ba4110a3b843340e4010bb5bf0d3ed29d37895': "故事从地面上开始。", // The story starts above ground.
  '52139f467abb90b20a6ec32e066ba4500af2ab74e6b786ab2887daf4ac9f34fe': "“把衣服放进机器，然后按开始。", // "Put the clothes in the machine and press Start.
  'e6b97a9df337693d07235b604618e563cbcfc0905bb79862dbfdfbe3bec98b31': "我穿了一件从橱柜后面拿来的老式衬衫。", // I wore an old school shirt from the back of the cupboard.
  '7bb84e728dc8a8e00230e963219f28bbcfb6d71da0b00de6264e195e3b30c8bc': "“我老板问我在哪儿买的。", // "My boss asked me where I bought it.
  '93c8ca33fa8c40483883b8f38be98ba949e3560acff64a1e320a179b0ec80490': "我读过，一件新的红衬衫洗过后可能会失去一些颜色。", // A new red shirt can lose some of its colour in the wash, I read.
  '2528409afe99bb6e0041a7b95ea03f98351b9dd9a551bbf2929d932de1d1a4b2': "周六早上，我把篮子里的所有东西都放进了洗衣机：我父亲的白色工作衬衫、我的白色校服衬衫，还有我生日收到的新红色橄榄球衬衫。", // On Saturday morning, I put everything from the basket into the machine: my fat
  '4d82b18671ee56eda5a4f4ab9ba5dad2e893ba35d18fd95efb2a12e380c56bc0': "然后他轻声说：“我周一有个会议。", // Then he said quietly, "I have a meeting on Monday.
  '9ab5f168b44260fd421501f280f7bf8398fab2cc05905a040021e1f667aefe6f': "上个月，我母亲去马来西亚周末看望她的姐姐。", // Last month, my mother went to Malaysia for the weekend to visit her sister.
  '08bc8e41efde930473bc0496a62f22ccd6278057af7c371c8130841db25bd127': "白衣和彩色衣服绝不能同时进入机器。", // White clothes and coloured clothes should never go into the machine together.
  'ce093f76b7d60da118d0bf63be5dd0a0c1bef0b8a47ccfd33f46f4892a8c8392': "一个小时后，我打开了机器。", // An hour later, I opened the machine.
  'e33bdd47b1f2695719a96ddd12c01a253e903577e2ec818f3b147f55657c82c0': "“很简单，”她说。", // "It is easy," she said.
  'edef9ae4a9db82910ac24c3c1e6a791b94aa56b8abdb213ff75a303228c150c6': "我父亲回家时，我给他看了他的衬衫。", // When my father came home, I showed him his shirts.
  '3cfbbcc2443aa1a642e6aea5b565c6be02dd89ec1f43426af3147ee404fbaa27': "车子在等我们，但有一位司机按了喇叭。", // The cars waited for us, but one driver sounded his horn.
  '575aa692ce27c789187b22f9eddaaf0885b8b0e750a8f0399706bec9f835c035': "走到一半时，绿人开始闪烁。", // Halfway across, the green man began to flash.
  'c8587b539535fdd9cbb4800b84f2c45ab649b0cb3ea7d0fbb0f84a38019a1722': "他从口袋里掏出一张卡片，轻触了点按钮上方杆子上的一个小盒子。", // He took a card out of his pocket and touched it on a small box on the pole, ju
  '0fc47c0e1d0d047f81bbec9ecc5e8cd1473c65f488ac323bad5c5d85c131f280': "上周一，一位拿着拐杖的老人在我旁边等着。", // Last Monday, an old man with a walking stick was waiting next to me.
  '7190fc5a09f478c0a0912672d12cd418e46caece087eaf705377d3fed47ea659': "每天早上，我都会在红绿灯处穿过它。", // Every morning, I cross it at the traffic lights.
  '7c57f48d3f4b42a2726d4bafbbab700c0b8045dba170f73fb98aab2ddfbd435c': "绿衣人上场后，开始非常缓慢地过马路。", // When the green man came on, he started to cross very slowly.
  'fc8572d38cc779176e48ec0eb6e8c2f7d96c0acb33a90ce6153543088d2b86bf': "“这是我的毕业卡，”他说。", // "It is my senior card," he said.
  '18ec7799051d512b7c6a3e39dcffeb8d97d5919f5e8744b0f5035f79454500c6': "两年来我每天上学日都会经过它，但我从未注意到它。", // I have walked past it every school day for two years, but I never noticed it.
  '0850317079580421be159b885874de61800a5af3bc2f747476b354a4284b98ca': "我们到达对面时，红灯就变红了。", // The lights turned red before we reached the other side.
  '1a83b9fdf6559d6028b1cce79f8a59e9c2f4a21180f0bdaf30a6cd65ddbf4886': "我家和学校之间有一条繁忙的道路。", // There is a busy road between my home and school.
  '41fcfb6d74141eb2f171e2c7dac81cfe3c412d59a49f23cbbf230c72190f4563': "那里的绿人个子很矮，所以我总是走得很快。", // The green man there is quite short, so I always walk fast.
  '869af13a09740d442de7587053fcdd97a97eebf032da167beed3f5cf8b3289ae': "我们一起走过去，到了对岸时还有时间。", // We walked across together, and there was still time left when we reached the o
  '3947bff7070c68ef9f6c07178597fff2a9164759a9992c6672a37d4f9175b4d2': "上面挂着一个小牌子：“绿人+”。", // It had a small sign on it: "Green Man +".
  'a2cbeb3f49c2b799d2f108fd89a9321a15d543ebab9609f02d7f1e6b6b8c15dc': "这次，绿人坚持得更久。", // This time, the green man stayed on much longer.
  'e9d93788a05c44f161da807e5bbf978baa91c6a53d29cdeaf62eae886b2ecec3': "我脸都烫了。", // My face went hot.
  'a2b3b5b157de4424d621cb51e36eed2c42418788b3b8ee6912f77be31a6970b2': "我们放进了汽车、拼图、机器人和许多毛绒玩具。", // We put in cars, puzzles, a robot and lots of soft toys.
  '060a4842bc1e94dba9126d782e2ced98e982642087e2d72489c2d0a29b696ee4': "到十二点，盒子已经空了，我们有二十六美元。", // By twelve o'clock, the box was empty, and we had twenty-six dollars.
  'db6aa75a325bd389e1c07f5264742b80ff10e799756644808c045a1e83de11ea': "二十分钟后，她抱着满满的手回来：一个洋娃娃、一个球、一匹玩具马和一袋小塑料动物。", // Twenty minutes later, she came back with her arms full: a doll, a ball, a toy 
  '0fc7f5bd06e7e0cde37c69a68605bd8138edbcf038e87578406b2c02ce467029': "一个小时里，没人买东西。", // For an hour, nobody bought anything.
  '39389d28cbc12f629c7ec65477e221a30a8b130a268a280bfdffef0ff841c8fd': "隔壁桌的女士正在卖旧书。", // The woman at the next table was selling old books.
  '1f8f1696d7d896d31c3dbe92fcca9a30ddb6a15192741325c6c5b4b5d5b03b16': "上个月，我妈妈送了我一个大盒子。", // Last month, my mother gave me a big box.
  '88678a58f0ff4970ef898fed67c42b70a0502f912e9452c45ddc6c00106f2830': "周日早上，我们在拍卖会上把所有东西都放在一张小桌子上。", // On Sunday morning, we put everything on a small table at the sale.
  'f2a58cae322925f5f5026c51d102fbb32a9fa2e05addef1164606743f356348f': "大多数东西五美元。", // Most things were five dollars.
  'f3c5d6379085ba4ed9e465a894a845db631072de7fbd0777190845a8f3ba7150': "“社区中心周日有旧东西义卖会。", // "There is a sale of old things at the community centre on Sunday.
  'f771d0648d4bd177cf79caf72da4a4a727ffb7c4adac75fb4c75336461a46999': "她想帮忙，于是我们一起装满了盒子。", // She wanted to help, so we filled the box together.
  '1196ddc16e42e706e064e5514d3acb86037376c1fb9886721251967a462f30e9': "我妹妹梅玲七岁。", // My little sister, Mei Ling, is seven.
  'aa91f70f3e6d0fec67fe4e9b97cb14b7e41ed923a25a1135d495866a2d15463b': "我把价格写在纸上。", // I wrote the prices on pieces of paper.
  '0d2a58d16f05415f2c8fa3d2655862cbe8bb35ba59ab1e51690270a7bd2f1be9': "“孩子们只有一点钱。", // "Children only have a little money.
  '2e906d638a62f3ddab757dbe375e54d42352d5767a72ccc39333c7784d29bc06': "我把一半钱给了梅玲。", // I gave Mei Ling half of the money.
  'c6935f615e17ef758e0d8d26fc9ea851c5800109e18b28479572bc515044fc2e': "当我照镜子时，它已经是鲜红的。", // When I looked in the mirror, it was bright red.
  'b56ed3b384baa7ff843ae6d8f6f654ae50e3c1d7e969751fbf6d79b42e4e3c34': "“我妈妈告诉我，阴天太阳依然会灼伤你。", // " My mother told me that the sun can still burn you on a cloudy day.
  '239a7c2da3cf146d467abbcd05429d4cb7f844c03a1080cd35832e555ef5e8eb': "但白色圆圈持续了将近三周。", // But the white circles stayed for nearly three weeks.
  '08f808469e5611fe90083a5206444de132d9fd6f6ed8d524639240a6358f6cfd': "我全程都戴着护目镜。", // I had my goggles on the whole time.
  '9a89e05f5f3631686928686f1d0cfb60e3eddd0c5ba881ec68486c50d835aff5': "到了午餐时间，连其他班的学生也来观看。", // By lunchtime, even students from other classes came to look.
  '816c16b37ee82d32364180fc5e7295a9c96cb5ce3b19b41595135ec61c6b5d93': "上周日，我家人去了东海岸公园的海滩。", // Last Sunday, my family went to the beach at East Coast Park.
  '13ebee9fc3af48b4410291fa4763ff37967cb7aced0d73f4a3a115d53f40d9f5': "天空灰蒙蒙，布满云朵，天气并不热。", // The sky was grey and full of clouds, and it was not very hot.
  '6014a3921e03206ad73084d665baf2ff60a926bd88ba9c674e53b2b1ab2b4d61': "然后我和妹妹堆了一个大沙堡。", // Then my sister and I built a big sandcastle.
  'a507efd7344bdc107fffa0cfcf581032517a0456795adaeb380c674ee66c15e6': "“你看起来像只熊猫，”她说，“但颜色不对！", // "You look like a panda," she said, "but in the wrong colours!
  '48100c55de394c2698c4db3b3b79902956280027f884067800435d7548f133c2': "我大部分下午都待在海里。", // I stayed in the sea for most of the afternoon.
  '655bdf4835428d73bd03a333da6a5dfeedc2836e90b0419219e79664b7510654': "那天晚上，我的脸开始发烫。", // That evening, my face started to feel hot.
  '26795ec2345a884bb860f5bc7f64f4bc38b502001472829a4d9b6228b43a2ac9': "红色在五天后消失了。", // The red went away after five days.
  '1ca951a2d979fd2cf3572be36ea7972c90b4634d4ebaffd876e5f1b824ca51f7': "“看看那些云。", // "Look at the clouds.
  '64d22891fd12d06b42545920411af79329fe84b66eaf5bc4342b4c0b7e1c934c': "但眼睛周围有两个白眼圈，那是护目镜所在的位置。", // But there were two white circles around my eyes, where the goggles had been.
  '98f7c8bfc5349e48abbbdafc3d09d3d778f8b201b5976ef454d7ca5bf0abc414': "第二个跑者完全没碰到我的杯子。", // The second runner missed my cup completely.
  '9ed9bb59688e3c501ae31a08b8fdd14772875be0961eb1fd3b05cba7df2202ee': "她喝了一口，把剩下的倒在头上，喊道：“谢谢！", // She drank some, poured the rest over her head and shouted, "Thank you!
  '7007aacfcb46b3a1af94d3a7835a73dce19ab8f2ff4494e094582c7c0df8b4db': "我们早上六点到达，赶在第一批跑者到来之前。", // We got there at six in the morning, before the first runners came.
  '21c681ec801cd1c35d7aa2b6494a614bd83c2279ca5fe924d3362dc2be43fade': "“杯子只装到一半，别洒出来，”她说。", // "Fill the cups only halfway, so they do not spill," she said.
  '15867a7e40e2e00f249a8926a887a233a39b4cc0133604d2d30372d12f9c3326': "周一，我们的体育老师林先生走得非常慢。", // On Monday, our PE teacher, Mr Lim, was walking very slowly.
  'ed3c9e0818684d34934f0927aa78d357bccd623e49bd573c5eeb511bce5785f4': "我们的工作听起来很简单。", // Our job sounded easy.
  '0c1301953ae0e2c077404540dd5a5590953ef3a067a9cb279d50bfd4d2ac7c16': "之后，我一滴咖啡都没掉。", // After that, I did not drop a single cup.
  '577b62d029d10a620b3387ae29ae88df5eed8802f67843549d3770680a20dd5d': "“我路过你的饮水站。", // "I passed your water station.
  '14fde18dee650958edb9ccd78676692bdeee616a4ea00588ad00ff58417e9b72': "上周日，城市里举办了一场大型跑步比赛。", // Last Sunday, there was a big running race in the city.
  'f220b9739401f41b9e6899a3763fe7da6a1de3e95ecd8e628c9ffbdfcdbf4f2f': "一个穿黄色衬衫的女人毫不拖慢速度地接过我的杯子。", // A woman in a yellow shirt took my cup without slowing down.
  '9fb31cd65014313031754aa45f11f4baaa1e784bf9ed835ce990f1c55f51ea86': "我们装满纸杯水，递给他们。", // We filled paper cups with water and held them out.
  'cc95137b35432845b9b4e5c5c3a885f1687ab8d6b47ee0b7a3005b08dc2ab327': "我把杯子从杯口递了出来。", // I held the cup out by the top.
  '30f954bfc1121e21a1604448ab461a5d7177db96b19c3c12895db3cbfcda88cb': "然后保持静止，让跑者接手。", // Then keep still and let the runner take it.
  '76b46c375d0907b16ccdde2b183b3054fa98e335e5407e356972d29fb6f4eb0c': "他打了我的手，水溅到我的鞋子上。", // He hit my hand, and the water went all over my shoes.
  '95bf221256279d5688973250133baf57aa895a7fff542449a8b6fa036e06d8d9': "“把每个杯子都放在底部，手臂伸直。", // "Hold each cup at the bottom, with your arm straight out.
  'ca4dc4c5e94c616836059b0cb3533553c0146c4a5de3895b16813fb6bc9b84b9': "他们鼓掌，好像我表演了魔术一样，我叔叔还叫我“我们的小新加坡人”。", // They clapped as if I had done a magic trick, and my uncle called me "our littl
  '98569620de4e544b92573e58c3a85b6395f4040e083ea2cc80ff32ea68dc65db': "结果我踢了一团雪，踢得脚趾都疼了。", // Instead I kicked a lump of snow so hard that my toes hurt.
  '7570f35fc1e5aee94ff5db03d8fada122bc60bd55de11e6f5ecd781f3fb2cee6': "每当老师提到雪或饺子时，全班都会转头看我，我听见自己说：“在中国，我们。", // Whenever a teacher mentions snow or dumplings, the class turns to look at me, 
  '4d8eb9c59e01f684ea2dec7d1719489da81d042f4c88ea1e5bd4756370a937a8': "那天晚上我躺在浩然地板上的床垫上，思考着他说的话。", // That night I lay on a mattress on Haoran's floor and thought about what he had
  'beea05f1bb7379cbf6ff580d49534ddd9be545af94c529cbf382d908669ede60': "说到一半时，我叔叔让我用英语说点什么。", // Halfway through, my uncle asked me to say something in English.
  '104ea938ebce1fcb56fc45653183251b2ead283160d74bbc3e327030213dbae1': "浩然从未说过什么，我决定他是嫉妒。", // Haoran never said anything, and I decided that he was jealous.
  '51585ad54dec0b51e08cca18e6d38fb1be0d213d1ac57d008013958cbad8a107': "当我们降落樟宜时，炎热潮湿的空气像毛巾一样包裹着我，我母亲叹了口气说：“回家。", // When we landed at Changi, the hot, wet air wrapped itself round me like a towe
  '592ac248f8c389d8f2a3bdaf9437647aed831a72078c4fb212edb20b67efd8ac': "我们穿着靴子滑过冰面，直到他推我倒下，我拉着他一起倒下，我躺在冰面上笑到肚子疼。", // We slid across it in our boots until he pushed me over and I pulled him down w
  '83b1f1dc8017caf66cebb9efbb8a7d88ad222708b779611f8bca20792a397b89': "他一看到我那件薄外套，笑了，然后把自己的围巾围在我脖子上。", // He took one look at my thin jacket, laughed and wrapped his own scarf round my
  '986763015fc2304a23e42e6fde31055d23ec1ce535a23e0257368637350de2b4': "我们出生相差三周，直到我九岁之前几乎什么都一起做。", // We were born three weeks apart and had done almost everything together until I
  '02ed9d97f1e75188180ab0a9455e9941690fe8da8dd44307d36fdae2bc59d465': "大家都停下了吃饭，转头看向我。", // Everyone stopped eating and turned towards me.
  '7dd669495a861bd67cc04753c9908a33a425f83f0495ead322c326f18ab79b36': "也许这样感觉更安全。", // Perhaps it felt safer that way.
  '8cd9d795ad4e56780753ac59980d43ab85973c03f4bbddea4e9877b5d8e9047e': "我还戴着昊然的围巾，虽然一分钟内就开始出汗，但我一直戴着它直到打车。", // I was still wearing Haoran's scarf, and although I was sweating within a minut
  'f428fba19e4b6f107e74d0586cd03953f13253577db17495a7e99f9902133694': "我九岁时全家搬到了新加坡。", // My family moved to Singapore when I was nine.
  '37a3448d86d4968d2a50c949ff63eedfa18f7296a83953dd46ccf9e639815358': "六年后，我依然是学校里那个来自中国的男孩。", // Six years later, I am still the boy from China at school.
  '6fe59ffdfd92ea978e00c9833faaf3aa244fb23bf082ffe7010a754dbf972033': "如果我一直属于别的地方，没人能说我不属于这里。", // If I always belonged somewhere else, nobody could say that I did not belong he
  '0e79c48ae96bda6a7f0a8dde7cb6531e04a2a5af3dc4803a3b45834a70834ee1': "去年十二月，我们三年来第一次回到她东北部的家乡。", // Last December we went back to her home town in the north-east for the first ti
  '57841ac6a1480365af67f538489066c069507bbb64afa923f063ad913c150d17': "到了中学三年级，我的头发已经长到腰部。", // By Secondary Three my hair reached my waist.
  'fba0193d05f1249d328043b950d35388cfeaa597febb3888b2659c607d04c7cf': "我头脑轻飘飘的，不停摸着脖子后面，对着镜中的女孩咧嘴笑，仿佛我们才刚认识一样。", // My head felt so light that I kept touching the back of my neck, and I grinned 
  '0f9af88a855cd4d491d32f0633ecfe0d059d8396ccfa9e2cf4271bf8fd26790b': "她擦了擦已经干净的桌子。", // She wiped a table that was already clean.
  '6311c684b12e38641834b04e6b606e5b42b15e7e30a3ea6aa8c3ecba08f5a62f': "三月份我用自己的积蓄预约了理发，前一晚告诉了我妈妈。", // In March I booked a haircut with my own savings and told my mother the night b
  'c26db86fef862dcc0f20c3de49bb6c9e27626a88b8b5bf7537180fc519d03213': "在沙龙，理发师把辫子剪成一整块，像死蛇一样举起来。", // At the salon, the hairdresser cut off the plait in one piece and held it up li
  '0fb80796ef1ffddbe7d3e0c0260853a2773c9aef850c2ca0f2dd6a0b0e740151': "我母亲加入了一群每天早上六点在公园散步的女性。", // My mother had joined a group of women who walk round the park every morning at
  'decad9563ae511d5cff0cc18ee36dda8d59da598564701d4bdaeef4fe39dcd28': "我坐在厨房的椅子上吃吐司，她站在我身后，拿着梳子，哼着她自己学校时期的歌。", // I sat on the kitchen chair eating my toast, and she stood behind me with the c
  '9320315f2509878b25619d31562717f2373a082dee3d4f72bd7d4bb62251cf53': "十年来，每天早上六点一刻，我妈妈都会帮我编辫子。", // For ten years, at a quarter past six every school morning, my mother plaited m
  'ddb94759783ea9f298b22e6bcad77626123126f1c17e2fec978af9a507367129': "但昨晚我下来喝水时，梳子就放在厨房桌子上，椅子旁边。", // But last night, when I came down for a glass of water, the comb was lying on t
  '502529ee4ae8d97922f28e8467f4a4650a99a9f6a6ef27b9ddaedb262879fb7c': "在家里，我妈妈绕着我走了两次。", // At home my mother walked round me twice.
  'ca924938ae703417c47f48dedf90ba59400439d4f8f476df112ce8bcad2f810a': "她脸颊通红地回家，笑着说一个走得比别人快、一路上话不停的女人。", // She came home with red cheeks, laughing about a woman who walks faster than ev
  'e627c870d9d569af484b24b52164cb72b98b106d82dfda6fcac50958777bcd20': "她用手机看新闻。", // She read the news on her phone.
  '1c10727719256d3ddf0e2a37835715aa61d0b223f803c29271c274eaa02bd366': "周六七点，学校跑道上除了我和拉赫曼先生外空无一人，他打着哈欠，手里拿着秒表。", // On Saturday at seven, the school track was empty except for me and Mr Rahman, 
  '49eafef0eea0773784e6f545a5366d0f35604fc369ed10c3551c1625678a4d0b': "最后一个弯道时，我几乎能看到它在摆动，我拼尽全力追了上去。", // On the last bend I could almost see it swinging, and I ran after it with every
  'e97425bf1237ab8881dd6403a95c5a3524a1892ae87570fd0ac7296acb4adfd5': "经过一次缓慢的训练跑后，拉赫曼先生看了看计时表说：“你追了她两年。", // After one slow training run, Mr Rahman looked at his stopwatch and said, "For 
  'c4e68534123f65cf9e462a4779cbb907e10fa9f0e861644ab4793e3dbf2cefb6': "她来自另一所学校，比我高一个头，留着一条长长的黑色马尾，跑动时左右摆动。", // She was from another school, a head taller than me, with a long black ponytail
  '2ac3a8974bcfb40e5fab55e277450f649fcb198d00eae0dc20679f2d918209bf': "真尴尬。", // It's embarrassing.
  'd095e8399b4233f2a6c5424442a4bcd23c5fc3125b91729b475676664a13f3ab': "我写了条消息又删了五次，心跳得像快到最后一刻一样。", // I wrote a message and deleted it five times, my heart pounding as if I were on
  'c2ed5be3b69367ad1b50593f369a44829ab6afdddd31b3df0e105d74aa9884ee': "我把水瓶扔进包里，力道大到又弹了出来。", // " I threw my water bottle into my bag so hard that it bounced out again.
  '9a8f0fec8825be6bf04bf709dabe9cb998b183a1685a5e226200d8e36e8845bb': "最后两百米，我以前会咬紧牙关，前方没有什么可追的，我的双腿似乎知道这一点。", // In the last two hundred metres, where I used to dig in, there was nothing in f
  'dc673047924958843e207f920e71fc6b82151585132250042a7e97f0b5087bb5': "我第一个念头，虽然我并不自豪，是：终于。", // My first thought, which I am not proud of, was: finally.
  'bc4755b63946df7879074559b6526b8d1971ab667122ddf815375b6cbe5aeaa7': "请好好运行，然后把你的时间发给我。", // Run it properly and send me your time.
  'd8d0753068e6d3a6014014aa544701d0ce73ca82282a9adc15f6b481713aabf1': "感觉就像有人把我背上的重袋从我背上拿走了。", // It felt as if someone had lifted a heavy bag off my back.
  '9da95d4ad55b4f8d9e661cba96dc5055ab4a5d9bc418bc8a00f8253029744c9f': "本赛季的第一场比赛，她未出席。", // At the first race of this season, she was not there.
  '0d37e8bc8d74c376d7b7eb2af76ca426c948a69efbfa02b8e22e9def45bdaec8': "整个学期我的成绩都在提升，而不是下降。", // All term my times went up instead of down.
  '207c9ea5952d8ab13c2f20372033ee6c9e3f124e9d0090db35af7b2f98ae3582': "我笑得很大声，哥哥从隔壁房间对我大喊。", // " I laughed so loudly that my brother shouted at me from the next room.
  'fcc0252d26b1539027f531906f972a8bb2aee138162d740518a43feca08d390f': "我决定相信她。", // I have decided to believe her.
  'e09c431ea1c11f3f0b9ade5da4fb4a697a61e7b6c9bb6e5b3b0e99bd118bb45d': "在热身区，她学校的一个女孩告诉我，凯琳的家人假期期间搬到了台北。", // In the warm-up area, a girl from her school told me that Kaelyn's family had m
  '71b612d3399c2080e577e55d5dd942a56372f0032ba7155cd9ab6751b9d45a99': "十一分钟后她回复了。", // Her reply came eleven minutes later.
  'a77260e189bfa35da58f8b7a9318bb1bdabc71035d466675d9823ad3b88db2d5': "两分二十三点九秒。", // Two minutes twenty-three point nine.
  '6d7089aed7297469b94843a91ccafbd89f55acef24861581b5bf8e0ab1aa100b': "周五是我一直害怕的考试。", // Friday was the test I had been dreading.
  'eeca35364d35da3d6fc704d417a732496d995c37b0c43c973906abae8dd5eda8': "周四，我把我妹妹从水族箱上的徽章别在书包上。", // On Thursday I pinned my little sister's badge from the aquarium to my school b
  'd124ba8b12e7fcd1302cbc5b014e4974e124e6c147bd81aab2e9829940fcabe6': "现在我有了证据证明他们不是，我几乎感到被冒犯了。", // Now I had proof that they were not, and I was almost offended.
  '5f3b97debf4b45e2806f9c4971988c42689510ec19816985318e12a422dbe3b2': "德斯蒙德周五有乐队排练，那几天我通常不吃午饭，坐在图书馆，因为我宁愿饿着也不愿被看到一个人吃饭。", // Desmond has band practice on Fridays, and on those days I usually skip lunch a
  '6ab2025747334293585f5502a8f0fdc6216aa2fbc8b1e048ff6d0654fa474585': "在中学一年级时，我的声音在演讲中途会哽咽，之后一个月里，我每晚入睡前都能听到那声音。", // In Secondary One my voice cracked in the middle of a presentation, and for a m
  '2c525f05f7ef2e1c68012a9704e72ebc9492ad8d49016f78d92794a5847ded17': "我给自己定了五天上学日，每天换一次，笔记本后面还记着。", // I gave myself five school days and one change a day, and I kept a tally at the
  'cef0349e0d2c223545e7c0de187100db37fd3d3878ccfe20d8ad43e9ad7cf419': "这次我买了一盘面条，端到食堂中央的桌子上，翻开一本书。", // This time I bought a plate of noodles, carried it to a table in the middle of 
  '062848445b62e131b98956c3dffdcec8baa91fe11c0866b1efff43e8d362ee12': "在美国的一个实验中，大学生必须穿着印有尴尬照片的T恤走进一个房间。", // In an experiment in America, university students had to walk into a room weari
  '1c29effb10aa1cdbdb71822cdc01579ab6349b193ef72f8d68efb192e95c0e87': "我在排到食堂队伍前面之前练习了要说的话。", // I practise what I am going to say before I reach the front of the canteen queu
  '264c19550139c23eb93c1ef03bd936f3e9dfbaf597809213ad281467ed84b4a1': "星期二我把手表戴在右手腕上。", // On Tuesday I wore my watch on my right wrist.
  '1abaef3dd4b3a23a99c94e9f20abaf0bced66d870a1b352495d69a5477141e0e': "她走开了，我还没来得及判断她是不是指我，我在队伍中间忍不住大笑起来。", // She walked off before I could decide whether she meant me, and I burst out lau
  'bf7c150a4e35d4ce5251db239d8fe274faa5a8e29c7bc77690baf4df6bd5eea8': "我一句话都不信。", // I did not believe a word of it.
  'ad6d3426a520bd8528dc788fecaeed804a7877d9032fd7ffd1c69c619e72d0d4': "上面用鲜艳的粉色字母写着“问我关于水母”，而我对水母一无所知。", // It said ASK ME ABOUT JELLYFISH in bright pink letters, and I knew nothing at a
  '1cb774060354f2e935d7a4db57c0a2f93c0b58d7b93362b7c22a414e26aeae56': "这引来了最大的笑声。", // That got the biggest laugh of all.
  '7a3c5bd7ac06e92eb23f455cef843fd0af05ecdab8a396cc3ea8cc0a074b9f2c': "但我感受到了一种意想不到的东西。", // Instead I felt something I had not expected.
  'ed5f003d4158dcfdf63413951faccb74712c557f112775d67b5b6d6968e127db': "当她问我对新歌的看法时，我说第二段歌词是最棒的部分。", // When she asked what I thought of a new song, I said that the second verse was 
  '533069596a78485e687c7a8b9779f20be6ba71241a1c16a84c022721521c49d2': "到了第二周，我刷牙时哼着他们最慢的歌，甚至不费力气。", // By the second week I was humming their slowest song while I brushed my teeth, 
  '3d20e24d00b074acafa033a9ad169aaa1a5b51b597126ddc66de764b95c9534c': "她说那是一只翠鸟。", // It was a kingfisher, she said.
  '9505993454efa37b11ae93ef9f5d7ed18df91fe424b5c6405e3193f90af13fab': "我已经借了我叔叔的望远镜，昨晚我还从一个网站上学到了十只鸟的名字。", // I have already borrowed my uncle's binoculars, and last night I learned the na
  'e77ce2bf718c4e889625a2adc9bd34213789545e29f95256aaabd7585a7681d3': "我认真听每首歌，无论是在公交车上、在床上还是在淋浴时，屏幕上都听着歌词。", // I listened to every song properly, with the words on my screen, on the bus, in
  '61458b0ab5e84c8691350e1cee3bb65c42bdf53663153b3b29d0e3966d33aad0': "“她问道，看着我，仿佛这一年剩下的人生都取决于我的回答。", // " she asked, and she looked at me as if the rest of the year depended on my an
  '750ca00ad5aab0414dc5cacbc34684543e0aa9b40dcd256561d9ab5af0650b16': "到了六月，我可以说七扇门十分钟，却一首歌都不会。", // By June I could talk about Seven Doors for ten minutes without knowing a singl
  'afd0329deb83fdf73e143addf87e2de8d538c755329123d2c0e0eedc1da5195e': "然后，在八月，瑞秋的父母送了她两张生日演唱会门票，她选择了我。", // Then, in August, Rachel's parents gave her two concert tickets for her birthda
  'aa04e2bcbdcc6862825cd16354ba02ca98c1e22c0e78ab230b2425cb1ee984b8': "然后发生了可怕的事情。", // Then something terrible happened.
  '39940a132b58f7180da085c5e710728793ffa067049b4c2faab986256fa9570f': "脸上布满了七个头发完美年轻男子的脸庞。", // It was covered in the faces of seven young men with perfect hair.
  '66478b6ff3f6f3ae32617b05fdb11c06922bec1d83f6daadf59ed00a218c9b7a': "“我爱他们，”我说。", // "I love them," I said.
  '54d8d08bf9f9e002caa2bff5cb04cde5056d7b1b66e228a596f94bfc6359fbb9': "那天晚上，我从一个粉丝网站上得知了七个名字，还有他们的生日和最喜欢的食物。", // That evening I learned the seven names from a fan website, along with their bi
  '582067bc5adedef5305ed2e49caf9d50d75fb9e9bfd5ad78a761ee7d23897669': "但每周告诉她真相似乎越来越难，发三颗心也更容易。", // But every week it seemed harder to tell her the truth, and easier to send thre
  '674fbf9b0ea42975ee4c88a58b10763aaf02a8670d2ff135e48480e7dcc26d89': "中学三年级的第一天，我旁边的新女孩瑞秋指着她的铅笔盒。", // On the first day of Secondary Three, the new girl next to me, Rachel, pointed 
  'cfc97f01d17b2ac406476613f63aa8c6ea43a3e486fd16b9954db4a95463e4a4': "“我张开嘴，又闭上了。", // " I opened my mouth, and then I closed it again.
  '559ed0cd9b1d70b0ebd3faf87487df53f54f63c6bd55a9e98eca3abab6eed4d3': "成千上万的真正粉丝会用韩语唱每一个字，而我会站在他们中间，嘴巴闭着。", // Thousands of real fans would be singing every word, in Korean, and I would be 
  'ee9ecae3c76b9ffb19cbd0946a5afbdbe665b56dc779d87bb2904326a02ac24a': "我选了最喜欢的名字，Jay，因为他的名字最短。", // I chose a favourite, Jay, because his name was the shortest.
  'a896e4f1b60a2307dc961aca3935cbc26dc5aa430d561de19cbd6e38299546dc': "我一个人在房间里看他们的视频。", // I watch their videos alone in my room.
  'f0b38c31a005038aefc1b8471638ef5352bd111ac40cc9d4d7ce8af5c88f9f91': "随后观众开始鼓掌。", // Then the audience began to clap.
  '0b3098e60f1b28a9de6125fd76032a82895c784ef422c6b7e933fd5730857851': "唯一空位是后面，所以我们的指挥高太太递给我一对钹。", // The only empty place was at the back, so Mrs Goh, our conductor, handed me a p
  '2d7171bdae59077a85d6580239cc1ea64198082cc4d341261e07ed42c4f30c27': "其中九十五首，我坐在后排的凳子上，膝盖上放着钹数着。", // For ninety-five of them, I sat on a stool at the back with the cymbals on my k
  'ca9e88d6692d07610234761c2a1a502d3c10daf30e62c349e7f24af2260089a9': "我高举镲片，笑容忍不住。", // I held my cymbals up high, and I could not stop grinning.
  '29b49c5bd8c246fc2c425e60cc1153518d81d94b2c34283edac459b4b9f5a994': "当他们还在鼓掌时，吴太太做了一件我只见过指挥为独奏者做的事：她先指向长笛手，然后指向小号，最后直指我。", // While they were still clapping, Mrs Goh did something I had only seen conducto
  '9c9e0158d7da8beab7d9faf3567ac3faf24147860d46cb98d5ab66c15ce30238': "我整晚都想象自己像摇滚鼓手一样崩溃。", // ' I had imagined myself crashing away all evening like a rock drummer.
  'cf777c4483d1255d049dbfd194948221df2e767dfbc613a9ce2adfcab90086a8': "长笛才吹到一半。", // The flute was only halfway through its tune.
  'e4114411ece6d669dbae1162a15b11533f2ccc8540c3932374c230d04d206388': "三十四个人转过身来，其中一位小号手笑得不得不放下小号。", // Thirty-four people turned round, and one of the trumpet players laughed so muc
  'cac2c7a7ef3b3ce73683bfc55ffdb04ded2c49e8e90292f6e225b13a7bb5c384': "之后，法拉坐在我旁边。", // Afterwards, Farah sat down next to me.
  'f576248d9c31bc62cd2bfda993414e5822e16935ed84a3abd96e6c70e0a19f91': "“最后一个酒吧里，就撞了一声。", // 'One crash, in the very last bar.
  'd226cbfc152a34dd798f7f1a8488e33111afc03466a1e55b1fb27c96b9e94431': "到了第四十小节，我的思绪通常已经飘到晚餐或作业上，我不得不悄声问法拉，她在我身边打大鼓，问我们在哪里。", // By bar forty, my mind had usually wandered off to dinner or homework, and I ha
  'c691f1b4177f09546f736337ed15718f875dc4017064e137646aaa8da1a4a0a6': "大厅顿时安静下来，脑海中有个声音低语：“现在。", // The hall went silent, and a voice in my head whispered, 'Now.
  'ca7d593558f71de82b31c7fc431c65270969cc9c54c91229e2c5a94a59b373ac': "“我的手湿得镲片差点滑落。", // ' My hands were so wet that the cymbals nearly slipped.
  'fabba4bab434e90c65eb4193d484d8b8540f2e98c4c07085cc130b1796307058': "直到练习结束，我才抬起眼睛。", // ' I did not lift my eyes from the floor until the practice ended.
  'c43d9537583e9a0ec23f62608f36ec2c9056923c55c47d727c9941830c1d2025': "之前的一切都在等待。", // Everything before that is waiting.
  '3965782b5fb78aea66e6d4c7f570cc07004f6fe7ad5529a23fef1e3cb71c9b47': "确定我们已经结束了，我站起来，把钹敲在一起。", // Sure that we had reached the end, I stood up and crashed the cymbals together.
  '3c630fa63ae33f20ff40a8c203b101f1375352f3b19cd00bedc08f592e8e12fa': "Joel说我是我们乐队历史上唯一一个为一个音站出来的人。", // Joel says that I am the only person in our band's history to stand up for one 
  'bf05fc911d5bc3860bba17ed01dc7ae291d3a92954e7d05b6fa905baa7235bb9': "法拉的滚滚声越来越大，直到整个舞台似乎都在震动。", // Farah's roll grew louder and louder until the whole stage seemed to shake.
  '36b3dc4f776a3eb895dacc85de1f50dc7b37dfc1b907a76c41c5e585aaef7e25': "我看着他翻开第一页，那是我四年前在公交车上读过的同一页，喉咙一紧。", // I watched him turn the first page, the same page I had read on a bus four year
  '72d959118eaf465f091eec8f6098ee4777f60031c48db23ed10e93c4dcc1bd75': "他没有要求降低价格。", // He did not ask for a lower price.
  'aa09e1031ea5abc7b848868b3d8456c2fb10c7e875b46cbce20ab8e4b4610499': "我把它放回架子上，关掉了灯。", // I put it back on the shelf and switched off the light.
  '30b9711e3a8d9bce9771d992153e148d1aca9f237b4d4cb8717b40b724933f36': "内森跪在车站地板上，一本一本地拿出书，低声数着。", // Nathan knelt on the station floor and took the books out one by one, counting 
  '12bd136f297719ca6fe2182f3fc2d6969ff83cc55983d6a38fd2b426a0f205bd': "还有人问我是否愿意单独卖第三十七卷。", // Another asked if I would sell volume thirty-seven by itself.
  'a4631766750302189775d9716ceeea18e895cd46f6e9e5c50c7bc51ebf666522': "从小学五年级开始，我就一直在收集一部关于一个男孩想成为东京最棒厨师的日本漫画系列。", // Since Primary Five, I had been collecting a Japanese comic series about a boy 
  '5270df770a0d7b73ce23a476964830d31877e1aeea2a75b555c4bc8a180a8b4f': "我差一百五十美元。", // I was a hundred and fifty dollars short.
  'c4eb906b5b7263ce20c2423c36bf5e5577880b65faff194d2c51dfe62ab603c6': "他问所有书是否都在，第一本是否状况良好。", // He asked whether all the books were there and whether the first one was in goo
  'daa78a7c1d01e4e9825eabdd8acbda78922ae0766b40e7ba068e857138c2b1d6': "然后我父母说如果我自己付另一半，他们就付一半新手机的钱。", // Then my parents said they would pay for half of a new phone if I paid the othe
  '4b94da3a2e07dcbf30a4ee5818026834a4592af3aee204c638969d79d3b750d7': "不到一小时，我收到了十一条消息。", // Within an hour I had eleven messages.
  '65eefa8cc2c7a376a5b88fbcc98764b3a2a390f56a88bbf1bda41c709722e6e6': "他拿起第二卷，盯着封面看。", // He picked up volume two and stared at its cover.
  '305982209504d24ca153ee5f80d57045eaf4a025e395ee89d5195c690224b047': "于是我把整套装子放到二手网站上，花了一百五十美元。", // So I put the whole set on a second-hand website for a hundred and fifty dollar
  '1b25fed996264ee20fadf28e76b6e59c6e07dfb5ed7e17fc63660a500100d9b6': "有个人出价四十美元。", // One person offered forty dollars.
  'bacc2015b353e2bbd4908a973b336a5f87b08265b3966b12993ce3c55cc498e5': "我看了很久才把它保存下来。", // I looked at it for a long time before I saved it.
  'd52c705403a51fa640f81c4adaf2107ab62dfdc5d3a82cbec279842bc6346629': "内森在电视上看过动画片，现在他想从头读完整个故事。", // Nathan had watched the cartoon on television, and now he wanted to read the wh
  '854647b030758d3878a4c276015af8b4b91807ebfcb57b0bf7fa555a57b96434': "我用零花钱一本一本买了书，到了中学三年级时，我已经买齐了全部五十二本。", // I bought the books one at a time with my pocket money, and by Secondary Three 
  'c0d79e1ed025e94ec7ea81b09e4b700099e8b4e4611159bed22df4b7b5419e5a': "上个月，林先生给我发了一张内森睡着的照片，胸前摊开着第三十八卷。", // Last month, Mr Lim sent me a photo of Nathan asleep with volume thirty-eight o
  'd1d677a6bf4f9069b5c13f441e504e89117171098def7e62049c25d989e269d4': "每写一本前，我都会读一两页。", // Before each one went in, I read a page or two.
  '4f4cb5ecd30d7ad123c15690dde7d751a3573b24de2f845c44b6407dc45a8c94': "我忍住打了个哈欠，说：“当然。", // I hid a yawn and said, 'Sure.
  '3d1de6b1fb01f3310f93a776f844671350be7333cf71397f846fdb7a1395a075': "我试过翻译应用。", // I tried a translation app.
  '73c8e05988cbc8bc18b90035fa8761435a309321de070cfa0c451029ea29643c': "有些列车没有司机，健太站在前窗，看着隧道向他冲来。", // Some of our trains have no drivers, so Kenta stood at the front window, watchi
  '910b59ef3622d4a79cc3d7056798614a89123d9cc241c68b58935e36fa412526': "周六下午，在一个繁忙的换乘站，我带着健太走到站台，连一块路牌都没看。", // On Saturday afternoon, at a busy interchange, I led Kenta down to the platform
  '3cbe2a1eb319f9b4769048c4b0948ad5579f4bb4e3b74f85651a69db5df5206d': "他飞回家两周后，一个来自大阪的包裹到了。", // Two weeks after he flew home, a parcel arrived from Osaka.
  'dba84f8476b49332875244ba01cf16c803da787385b599736125af256ba28d79': "车厢里满是火车：编号、颜色、时间和车厢前端的小图。", // It was full of trains: numbers, colours, times and tiny drawings of the fronts
  '8ee30cfd53aa23b134fd75f1ebdf803565beb8958dfb857e454c9d2c05caab09': "我想说点什么，但想到的每句话都显得愚蠢。", // I wanted to say something, but every sentence I thought of sounded stupid.
  'fc486bd0f2613f75481faad5c241d3ef4141d303e1cbe9df6bc2733340fb1e61': "但当健太试图感谢我妈妈请她吃饭时，电话却响起：“谢谢你带来的美味意外。", // But when Kenta tried to thank my mother for dinner, the phone announced, 'Than
  '2d3b9541c11aaf1429c032fb4ebbe9ccbba371e1cea8cb03d00382c5023fdd23': "“是的，”他说，礼貌地微笑。", // 'Yes,' he said, and smiled politely.
  '8c2768e966e2a3eff6b81a83533a02ecd72788ea0410857a0495a2eb4b8e2602': "我读了两遍，然后问妈妈飞大阪的机票多少钱。", // I read it twice, then asked my mother how much a flight to Osaka cost.
  '248485864d31a87ec0d7ea42a48e9c19e58fe563a4cf881bd58d92dceee750ca': "每个车站标志上有一个简短的代码、两个字母和一个数字，数字向一个方向向上，向下向下。", // Every station sign has a short code, two letters and a number, and the numbers
  '2a73cb28c2da4d3e079999b23fa7dbc24ccfc79639698a94735119823fccd557': "在最后一页，他写下了大阪的列车线路，旁边空着一个日期。", // On the final page, he had written a list of train lines in Osaka, with an empt
  'ce652985382effcae3bfc71e0b987b269f12febccbf710b6c14bbf5ad0caf29a': "九月，二十名来自大阪的学生在我们学校度过了一周，住在我们的家人家中。", // In September, twenty students from Osaka spent a week at our school, staying w
  'bc335b5eeb1a3129a4bc30d4f12096a9788e3c1cc71683a82980b049fb676e79': "每到一个站点，他都会拍下招牌的照片，然后拍我站在牌子下的照片。", // At every last station, he took a photo of the sign and then a photo of me stan
  'acef54ca488404cb5cc96ff6a05def438a0b8303ae008cc65b983918a1b936fd': "他对新加坡的清单很简单：我们的地铁。", // His list for Singapore was simple: our MRT.
  '5d10f4707c70cd95d320c29ca63a35133d2aac76693337b109a864d7ca343b49': "一个穿着睡衣的人缓缓走进画面，仿佛在水下移动。", // A figure in pyjamas walked slowly into the picture, as if it were moving under
  'a06ce74a2b22deb3898c7fd94ae0997e80c1457246bd9918d868e12e0cc25d19': "所以周日晚上，大家都睡了，我把旧手机放在微波炉上，对着冰箱，按下录音键。", // So on Sunday night, after everyone had gone to bed, I set up my old phone on t
  '7845b30d4a0d30514fbad55b35b745053cfbf077e44f0ec0d7ba882a6c44e8a7': "每个星期五，我妈妈都会买一大桶芒果冰淇淋，而且必须撑一整周。", // Every Friday, my mother buys one big tub of mango ice cream, and it has to las
  'a667cb9d76838fa37b653764053d1c78475693aec38d5ea62183f70b2aacd1db': "规矩是晚饭后各一勺，我们四个人：父母、十二岁的妹妹嘉慧和我。", // The rule is one scoop each after dinner, and there are four of us: my parents,
  '5063bad3b7f38b69c2e1f404997efd0e27838fa692a52c4317cde85fc6ff6b6f': "在大家准备去上学之前，我叫大家到餐桌旁，播放了视频。", // Before anyone could leave for school, I called everyone to the dining table an
  'e309aa79db0f67bb04f0a4047019a4d7fd6ffb1d87be3e6dcc53c2228ec40974': "早餐很快变成了法庭。", // Breakfast soon became a courtroom.
  '0b8c158e4c06b9359944250deff67da5cb131f82b77a85a5ab59760367db8d0f': "嘉辉说我应该为指责亲姐姐感到羞愧。", // Jia Hui said I should be ashamed of myself for accusing my own sister.
  '59ac043cc57b6d06c4a349ed7ae9474a5f8f470df780f6637fc02290ade26f5e': "我带着微笑上床睡觉，脑海里已经浮现出早餐时那张愧疚的脸。", // I went to bed smiling, already picturing the guilty face at breakfast.
  '589a9b5bc6c20bedffae42e84a9d4372a607ff816b1180cd96c9610c0835e01a': "然后它小心地盖上盖子，洗了勺子，关了灯，走了出去。", // Then it put the lid back on carefully, washed the spoon, switched off the ligh
  '90d3bca706963769b8d4b5fa2e35cdbfd5042eeafd07b314c106b152cd710582': "我父亲说他在节食，但我曾看到他晚上十点站在开放式冷冻柜前。", // My father said he was on a diet, but I had seen him standing at the open freez
  'c60790bbce43d115e3bf9ae12c4fa75d0d3f64f21d663a0e63c09638d3b15e7a': "早餐时，我看着父亲吃麦片，把他说的每一句话都记下来。", // At breakfast, I watched my father over my cereal and wrote down everything he 
  '43e16d65d64606c3f7dee02a28f65c85446c229d2e833fa17e1559491735874c': "每周五，她不仅拿走自己的独家新闻，还会把视频发给我们的表兄弟姐妹。", // Every Friday, she takes my scoop as well as her own, and in return, she does n
  '481efdca32eb6ab0e79d1a66d36b1f82533db720e9b6df62b840c9cb8a109cc5': "很长一段时间，什么都没发生。", // For a long time, nothing happened.
  '5107982cb7f3ad7f3329d12524e8bf8435f84747abebc7db9317b21dbb15d804': "温心从一张纸上朗读她的演讲稿，手抖得纸张都震动起来。", // Wen Xin read her speech from a sheet of paper, and her hands shook so much tha
  '7a004bf626ba260662f1643185d5d1b2b31d60383d82a9fb3fd63d7e6d28923a': "我出来时，布兰登和温信站在走廊里，相距几米。", // When I came out, Brandon and Wen Xin were standing in the corridor, a few metr
  '8e7f1204cd3c64fff95eb7b2ae149d0e94156982ff9d8942eec6d767d6134092': "有两位候选人。", // There were two candidates.
  '4be8945cc574ea36aed595d0f553e59b267d356ef65830eaef92dfefc795fff2': "当我们的班长在七月调到另一所学校时，班主任库马尔先生说我们会投票支持新班长。", // When our class chairperson moved to another school in July, our form teacher, 
  '58b9190025a1b1f975e3bb89753bb62b0cce5f7a500cbcb8172201fad33b8b84': "一小时后他又发来一条：“说真的，投票给你认为更好的人。", // ' An hour later he sent another: 'Seriously, vote for whoever you think is bet
  '7fcfbbeb8cd951f2398d79ad8dc6ba642f584ad7f7b59042d43ca59b9e82cb2e': "她有三个想法：教室后面放一块显示所有作业截止日期的板子，一张清洁时间表，避免同五个人总是留下，还有给学校办公室写一封关于后排风扇的信，那扇风扇自三月以来就坏了。", // She had three ideas: a board at the back of the room showing every homework de
  '3d62239be6677597a4e009f48fe4d3221e7798aa525917254d990344848b8ed6': "我迅速写下一个名字，还没来得及多想，然后把纸折了两下。", // I wrote a name quickly, before I could think again, and folded the paper twice
  'cb2222de5f41aac897ec4b3f7fed77a3cb2037a642e4db068ca0c97089671ff9': "他承诺每学期结束时举办班级聚会，课间有音乐。", // He promised a class party at the end of every term and music in the classroom 
  'bbb0197b98d85b3e93c125c5400fc86374be3da52c4b2dbdc9c745b01edc86c8': "然后他给每个人发了一颗贴着“投票布兰登”贴纸的糖果。", // Then he gave everyone a sweet with a 'Vote Brandon' sticker on it.
  'daf2a57f13b46bec2628771e5298f2d8a0b9fcb5e3bfbb0ba152005c9db9ded7': "接下来的一周，人们对我奇怪地友好，周四我在铅笔盒里发现了三颗“投票给布兰登”的糖果。", // For the rest of the week, people were strangely kind to me, and on Thursday I 
  '49552d3e537ad0ecbb29236c2682fab65cddd86b25be7e25ba1c164baf54d937': "第二条消息让一切变得更加艰难。", // That second message made everything harder.
  '7ca004ef0c950aec93256c648b26852d845e5713c29b5ef8be26ea5414169245': "周五晚上，Brandon给我发了条消息：“别有压力，哈哈。", // On Friday night, Brandon sent me a message: 'No pressure, haha.
  'aba1ecb28ea5fa69e0b380dfbad6729b3e51c1b481ee4f72daba3884be32acba': "布兰登让大家都笑，温昕刚到时，他是唯一和她说话的人。", // Brandon makes everyone laugh, and when Wen Xin first arrived, he was the only 
};
