'use strict';

// 首发周例句的中文句意。key 是英文原句的 SHA-256；
// content/index.js 会逐条校验，少一条就立即报错，不能带缺口发布。
// 由 scripts/pilot/build-week2-context-translations.js 生成（Azure Translator），
// 生成后经人工复核。行尾注释是原句，方便审阅时不必回查。
module.exports = {
  '8c29619ee87523ba3382022f2d373589dcf97ae32a0683ba0ccf6b6816017e7d': "弗莱明本人在诺贝尔奖演讲中警告了一个至今仍存在的问题：如果药物使用不当，细菌可能会产生耐药性。", // Fleming himself, in his Nobel lecture, warned of a different problem that is s
  '8ee18f59926873e094a851b08e1f6121baf844729283ae3a4da9166d30ebe1e1': "弗莱明注意到了一件重要的事情，但仅仅注意到还不够;要将一枚餐盘上的戒指变成药物，需要化学、工程、工业能力和战时紧迫感。", // Fleming noticed something important, but noticing was not enough; it took chem
  '51ee10317b1f0158a9fbf9de2f8e6f4bda58893c4ed51232c6a0679e1b0a937d': "1928年9月，伦敦圣玛丽医院的细菌学家亚历山大·弗莱明从暑假归来，发现他制作的一道葡萄球菌菜肴被霉菌污染。", // In September 1928, Alexander Fleming, a bacteriologist at St Mary's Hospital i
  '5124fda295069d76bb935b00e8ceb549719badeddfe3b58bb3de59ecfbb9def4': "实际突破来自第三位科学家诺曼·希特利，他设计了利用战时英国能找到的各种设备（包括牛奶搅拌机、浴缸和医院便盆）培养和提取药物的方法。", // The practical breakthrough came from a third scientist, Norman Heatley, who de
  'a716beb223f12d5576ce03e5cf9e2e2d03bfa90258beac5ecf12dd5f499b10fd': "在伊利诺伊州皮奥里亚的一家政府实验室，研究人员发现，在玉米加工副产品中培养霉菌能使产量提升数倍，而来自本地市场的霉瓜菌株，产生了远超弗莱明的品种。", // At a government laboratory in Peoria, Illinois, researchers found that growing
  '030cd1cd00293011184c0533b06c771ac4f1b1835f46e1aed3434be54cccc924': "他在几天内状况显著好转，但供应耗尽，尽管团队甚至从他的尿液中提取了青霉素以供使用，但他几周后去世。", // He improved remarkably within days, but the supply ran out, and although the t
  'b922883ebf20edf38b1e6c83f7402abc4c4e2f036bc91090a11784b6aab540ae': "青霉素的故事通常被描述为一个幸运时刻：一位科学家度假归来，发现一道被遗忘的菜肴上有霉斑，从此彻底改变了医学。", // The story of penicillin is usually told as a moment of luck: a scientist retur
  '9e33038887013c76273d806c20342a5704c6859d465968c81e6fffb82e123b09': "1940年5月，团队用致命细菌感染了八只小鼠，并用青霉素治疗了其中四只。", // In May 1940, the team infected eight mice with deadly bacteria and treated fou
  'c66b31ca3ca42db0d488505706f426ae133423affa61144e4778426628f1d8db': "复兴始于1939年牛津大学，当时霍华德·弗洛里和恩斯特·蔡恩正在寻找能杀死细菌的天然物质。", // The revival began in 1939 at the University of Oxford, where Howard Florey and
  'f51a8aecf89e3c5eafec7d23263d2220e127b17631895221db85b9c6046706eb': "青霉素难以提取且强度迅速下降，而弗莱明并非化学家，无法将其制成纯净或稳定的形式。", // Penicillin was difficult to extract and lost its strength quickly, and Fleming
  '23d929c65004a32619211b08822bb9b8bba0201e067c3cadbecd4b95609f54aa': "希特利的方法使牛津工作成为可能，但未被纳入。", // Heatley, whose methods had made the Oxford work possible, was not included.
  'c9835ccb23d3e4d7756c20adb555914423005aacf018cb067729f5a3ab29c454': "其他研究人员兴趣不大。", // Other researchers showed little interest.
  '501239b5d6cbc88e96fc55f44cc727ab4b778c41becdd60abdd430e74c7786f5': "次年二月，首位人类患者——一名名叫阿尔伯特·亚历山大的警察——因严重感染被给予该药。", // The following February, the first human patient, a police officer named Albert
  '283a9d49b93c9c4c1772de66bfcaed05ffecc02777b76624d0f93a29f8af6a3a': "英国遭受攻击时，弗洛里于1941年前往美国寻求帮助。", // With Britain under attack, Florey travelled to the United States in 1941 to se
  '2ab820b74363a87728539f793da6b13fb4728384cc5f05f55df33eb21e550ccf': "这种统一性对种植者、运输商和超市来说非常方便，他们可以依赖果实在任何地方成熟、运输且外观一致。", // This uniformity is convenient for growers, shippers and supermarkets, which ca
  '0de7f37365c1bfb5986e1e1ced5fb37131d787d20785f706933402b47d58e367': "中美洲的大米歇尔种植园被巴拿马病摧毁，这是一种由土壤中真菌引起的枯萎病。", // Gros Michel plantations in Central America were destroyed by Panama disease, a
  'ddf97d2f8bd7aa49d2b8811a2b05a05245b1af97dd06dc69d68891aef0c0db32': "最终，行业转向卡文迪许，虽然部分客户不太喜欢，但对摧毁大米歇尔的真菌具有抵抗力。", // Eventually the industry switched to the Cavendish, which was less popular with
  '8487f7eaa92a54f91c3937827b56ebd0a44751512d4ceb6f1938fbb00cc978d5': "许多种植园现在要求工人和访客消毒鞋子，受感染的植物被摧毁，周边区域被封闭。", // Many plantations now require workers and visitors to disinfect their footwear,
  '2664b28576ed1a92b85efff94e6e7edae008b7b23bfcffcaf2931619f5213c93': "它可以在土壤中存活数十年，且没有任何化学处理能可靠地杀死它。", // It can survive in soil for decades, and no chemical treatment reliably kills i
  'a328ca8353b42891a431bcb85a59a0d14eaa5a7261d600ab95bc3588c87da05c': "台湾育种者选择了耐病性较佳的卡文迪许植物，尽管它们并非完全抗病。", // Breeders in Taiwan have selected Cavendish plants that tolerate the disease be
  'd89090c27cc5c3fa718ade92162f081262e95f7ef3f2c4d693b5c718dbad22dc': "直到20世纪中叶，大多数西方商店的香蕉都是另一种品种——Gros Michel，许多记得它的人都形容它味道更丰富。", // Until the middle of the twentieth century, the banana in most Western shops wa
  'fdafc60a6351a11ac3f85d065032336beb1a889b12a4c3417e469eda90108b4f': "种植者通过放弃受感染的土地和新森林来应对，但疾病还是跟了上去。", // Growers responded by abandoning infected land and clearing new forest, but the
  '00d87ec258060e6a3f53dcbcc56df78bf99b501f04374f2825475ac5f30c2bc1': "香蕉是世界上贸易最广泛的水果之一，几乎所有国际贸易中的香蕉都属于一个品种——卡文迪许。", // The banana is one of the most traded fruits in the world, and almost every ban
  'ec8bec4478d45140111884b1370ccbcca94fc9f6a3bf7313748c4118a80c003c': "与早期形式不同，它攻击卡文迪许。", // Unlike the earlier form, it attacks the Cavendish.
  'd6ce691ec0148ae58b22e399ac0018cfcb1db1f2f942d1afa247742149b7cea5': "许多植物科学家认为，真正的答案不是单一的替代品，而是更大的品种。", // Many plant scientists believe that the real answer is not a single replacement
  '416cd78004094a358c64e6b9f9094531941e79085b62b3825021ae19533a96eb': "生活在更大群体中的灵长类动物，相较于大脑其他部分，通常拥有更大的新皮层，即参与复杂思维的大脑外层。", // Primates that live in larger groups tend to have a larger neocortex, the outer
  '131e8bec5c1c6c60931bf25e005ded61e361590b7ef95e5e4969a4ad863aee3c': "2021年，斯德哥尔摩大学的一个团队重复了邓巴之前使用的分析方法，利用了关于灵长类动物大脑的新数据和多种统计方法。", // In 2021, a team at Stockholm University repeated the kind of analysis Dunbar h
  '477847f84508106186694365ef563a01ea24e27b14bc6c137fc4576f5897becc': "较少争议的是，亲密关系需要时间维持，而时间是有限的。", // What is less disputed is the underlying observation that close relationships t
  'c04d7ca7c19465ddcd4067b5592334e2ece5a8315e4bbaeb5f56a6cc7bd3a922': "邓巴后来对社交媒体用户的研究发现，尽管许多人拥有数百个在线联系人，但在危机中他们觉得只能依赖少数几个联系人。", // A later study by Dunbar of social media users found that, although many had hu
  '9601e7eb689e6382d8b5def5e936936fe4964f1b05a5b50a684ce30ea70dbdff': "1990年代初，英国人类学家罗宾·邓巴提出，这一差距不仅是时间或努力的问题，更是生物学问题：人脑只能记录有限数量的有意义关系，而这个限制大约只有150种。", // In the early 1990s, the British anthropologist Robin Dunbar proposed that this
  '3d968fa8e2538f164321d686f5780f8f37c48eccd09807f9f44858e1e0101f97': "邓巴拒绝了斯德哥尔摩的研究，认为其方法不适合该问题。", // Dunbar has rejected the Stockholm study, arguing that its methods were unsuita
  '5d44a12419895327e9e827bc4ca8a0e00c1ce1b6bd9d6c62222f7f09b487627c': "在一项研究中，邓巴和同事让人们列出他们寄送季节性贺卡的所有人，这些网络的平均规模接近150个。", // In one study, Dunbar and a colleague asked people to list everyone to whom the
  '1f7222e5e24452bfb5f5aeba24daa5d85e0314d6f41f3519e221ae07e5eb863d': "限制是否恰好是150，可能比提醒大家没有人能亲近所有人更重要。", // Whether the limit is exactly 150 may matter less than the reminder that no one
  '587f2d02235f13f5a9bc462131ea1c63eee3939518974e60722a37904c06a8fd': "这一理念产生了极大的影响。", // The idea has been remarkably influential.
  '4ba0a1047c2ee35801f3132535b10fc47b17cd80323525771f6fe85953cf710b': "北美一些宗教农业社区在发展远超此地后会有意分裂。", // Some religious farming communities in North America deliberately divide once t
  'f67f28143398967c0c378bc68a26c8cc88f79e659a8e801bc5e833878fb263e1': "通过将人类置于描述其他灵长类动物的同一条线上，他得出了我们物种的预测群体规模约为150只。", // By placing humans on the same line that described other primates, he arrived a
  '412a7e6f858b46ac94b8539f74c2faba35c23d92a173c5d02d00e0ea250d1ce7': "批评者还指出，人们维持的关系数量差异很大，文化、性格和环境都起着作用。", // Critics also point out that people differ greatly in how many relationships th
  'b96100998e0cb60d63a57aebf66b9121def0f92f81297738ae0c2c5c3ab19ec4': "一些公司用它来决定一个办公室或部门的规模，然后才会被划分，这也被用来解释为什么网络联系人不会简单地成为朋友。", // Some companies have used it to decide how large a single workplace or departme
  '4ecc594a50732b733024efbbea60b3267d8ff38df6aefbbb73741ed664898873': "邓巴认为，新皮层设定了动物能够理解和社会跟踪个体数量的上限。", // Dunbar suggested that the neocortex sets an upper limit on the number of indiv
  '9b5f07c3ea8a9088ea07a5d88768da19215769128390755cdf222e6502922e4e': "他们招募了80名患有肠易激综合征的人，这是一种长期的肠道疼痛疾病。", // They recruited 80 people with irritable bowel syndrome, a painful long-term co
  '5e4b6530127e3f03882fef808539599e24f8794afa826d826084dd9ed5bce200': "大多数医学规范认为这种欺骗是不可接受的。", // Most medical codes regard such deception as unacceptable.
  '616b7e99d4e19bd1e7a4823ffd8d74a1d6e9c8790d977580d719a165e8f69828': "即使安慰剂有帮助，在研究之外使用安慰剂也会带来伦理问题。", // Even where placebos help, using them outside research raises an ethical proble
  '4ebd0c62340568519acd8f38171e55c82341391eda897d9a8880c99646ecc288': "自1955年美国麻醉医生亨利·比彻发表一篇有影响力的论文后，安慰剂作为一种独立力量的关注度上升，该论文显示大约三分之一的患者在服用安慰剂后情况有所改善。", // Interest in the placebo as a force in its own right grew after 1955, when the 
  'bebd939534f31e673fa814a9e6af5f991741c358dd9419563efbbfdf64fe68f0': "而治疗过程中伴随的同情心临床医生的关注，已知会影响患者的感受。", // And the attention of a sympathetic clinician, which comes with the treatment, 
  'eed474a7875ccc14a86bcf0dd8d32100358736c21dddb2f63373e1b51329872a': "每天服用一颗药丸的习惯本身就可能让人安心。", // The routine of taking a pill each day may itself be reassuring.
  '03f4b8b75d13981372a157fe6328102a350bb0dde8d4f4afada503811bd63834': "这种治疗方法，通常是糖丸，被称为安慰剂，在现代医学中具有非常实用的作用：当新药被测试时，会将其与安慰剂进行比较，以便研究人员判断药物本身带来的多少改善。", // Such a treatment, usually a sugar pill, is called a placebo, and in modern med
  '2549153efee1074dba5a37ec0b64861ad5777193eb89b65e4ca4cf91b2e8fbbe': "安慰剂似乎主要作用于疼痛或疲劳等症状;目前没有充分证据表明它们能缩小肿瘤或治愈感染。", // Placebos also appear to act mainly on symptoms such as pain or tiredness; ther
  '3bcfc6a4e862bff2f15923b3b53f0a127107141c0daa1c3077fb6d2fa1382f37': "许多疾病会随着时间自然好转，患者通常在症状最严重时被招募参与研究，因此无论如何都会有一些改善。", // Many illnesses improve naturally with time, and patients are often recruited i
  'ce5e5bf8e34e1e1bd8821fe57da9a1d3ce0f8688810620da1d57aed9ff5af992': "2001年，丹麦团队比较了接受安慰剂和未接受治疗的患者，发现整体效果显著，尽管对疼痛和患者自述症状似乎有适度益处。", // When a Danish team in 2001 compared patients given placebos with patients give
  '3e3724455fdb262a05f941ff2c11bdbf4e8b67fe8c073360590b5f2f512eb120': "另一位则被注射了明显标注为安慰剂的瓶子，成员们坦诚告知这些药丸不含药物，尽管类似的药片曾在研究中帮助过其他患者。", // The other was given pills in a bottle clearly labelled as a placebo, and its m
  '12a53da7f51423cab8bf531ef37dc322ed231f14ce76f82a05b46dcfa76a4015': "几十年来，这一数字被引用为大脑能够产生强大物理效应的证据。", // For decades the figure was quoted as evidence that the mind could produce powe
  'f31edc28bbc0c84eee3a0abaf7360f41863fb16b36ae1ae0ede24892cfc212cc': "如果一颗药丸即使患者知道它不含任何东西也能帮助他们，那么其益处可能不在于欺骗，而在于被护理的体验，而有些研究者认为医学应更重视这一点。", // If a pill can help some patients even when they know it contains nothing, the 
  '05f878a740c6ff9ee835a3e9f80b48ec416bbe98f803094807b028cadc618d7f': "三周后，接受公开描述安慰剂组报告显著改善。", // After three weeks, the group taking the openly described placebo reported sign
  '5715365a592ccae0a3f2b10e1ed2a8712cc19292bd7ad0a4b9bbfda49b75c56b': "第一个问题涉及繁殖。", // The first concerns reproduction.
  '58b4495f827acc0a7980d4d5ee9443be7698bc81d37e95f398f1f0230317d3d7': "然而，近年来，科学家们开始与一个令人惊讶的伙伴——一种名为沃尔巴奇亚的细菌——共同对抗蚊子。", // In recent years, however, scientists have begun to fight the mosquito with a s
  '4c7d6b0324d02c898fd04b7f72a0ba31ea0443468890ccebfd9a5eab72358568': "登革热每年感染数百万人，而在新加坡，这一威胁十分熟悉：2020年爆发了该国有史以来最大规模的疫情。", // Dengue fever infects millions of people every year, and in Singapore it is a f
  '013820499d3e765b270d2901758e8636f0f6711de10d16639cba86470e9a0935': "几十年来，主要应对措施是清除繁殖地和喷洒杀虫剂。", // For decades the main response has been to remove breeding sites and to spray i
  '714e00576743770b6c77c40ddd6a593b9ec1463a1baad959965d48d226157712': "携带该细菌的蚊子中，登革热病毒繁殖困难更大，因此昆虫传播的可能性大大降低。", // In mosquitoes that carry the bacterium, the dengue virus has much more difficu
  'dd9e72af11d620f4d4e6b4fceaf70dc46015e0f88f380311041f48932b4ce063': "这两种方法都不能完全消除对普通预防的需求，而且每种方法适用于不同的情况。", // Neither method removes the need for ordinary prevention, and each suits differ
  '9dd8eca6d50c3b575eb061ab49e42c0970409126cddd3c24f999ce5e7eb37b70': "因此，在数百万昆虫中准确区分性别是该项目最大的技术挑战之一，有些项目还会增加低剂量辐射，以防止任何通过的雌虫繁殖。", // Separating the sexes accurately, among millions of insects, is therefore one o
  '112b1a930b38a82085901fb6dc5210cd750f0d3b96de66a469109d52aee7af98': "当携带沃尔巴奇亚的雄蚊与未携带沃尔巴奇亚的雌蚊交配时，其卵不会孵化。", // When a male mosquito carrying Wolbachia mates with a female that does not carr
  '4676bb5d4ba62b081ee4d714bfd9e5078de1de312afa526ec048839c79306e14': "雄蚊不会咬人，因此释放的蚊子对居民没有直接风险，野生雌蚊与它们交配时产卵却无果。", // Male mosquitoes do not bite, so the releases pose no direct risk to residents,
  '5b504b971a7a4bb1c93016224001cb2d518aff4e2d015b4e8dff32da02e311ee': "减少蚊子数量可以在拥挤的城市中带来快速缓解，但需要持续努力;而替代蚊子数量建立较慢，但可能自行持续。", // Reducing the mosquito population can bring quick relief in a crowded city but 
  '1185cc6c8b911581da40bb3dffe57e8a370ff9871ce969ab7f752331d98fce3f': "自2016年以来，它在部分住宅区释放了大量携带沃尔巴奇亚病毒的雄蚊。", // Since 2016 it has released large numbers of male mosquitoes carrying Wolbachia
  '0f6377e26b77cdb26ad6f2ed7d0fef94a220d6679998640b40504d01a1c20731': "该病毒主要通过一种蚊子——埃及伊蚊（Aedes aegypti）在家庭周围的少量积水中繁殖，在人与人之间传播。", // The virus is carried from person to person mainly by one species of mosquito, 
  'b4e46732dfcbd3b26d46b9686f3fd0885aa3ac88ca6722a3de2c00e8c806024d': "国际研究组织世界蚊虫计划因此释放携带沃尔巴奇亚的雄性和雌蚊，目的是使该细菌在当地人群中传播，直到大多数蚊子携带它。", // The World Mosquito Program, an international research group, therefore release
  '3a6bd24424b84ff19c02a7ee086272fbba9bc0e7e9436e33f9da9b71b02f6307': "如果携带该细菌的雌性也逃脱，沃尔巴克亚可能会在野外种群中扎根，未来的释放将失效。", // If females carrying the bacterium escaped as well, Wolbachia could become esta
  '0101f3f81a82e7f18083e8329609c0aaec5737ed4f1fd0ac48ec7f546b9e1af3': "这对组合于1952年获得了专利。", // The pair received a patent in 1952.
  '79b001db1cca628ace292fd5b1dd1ecdc6279baa5e1ac65df6476839ff823270': "美国杂货公司达成了统一标准——矩形通用产品规范，该规范由伍德兰当时工作的IBM设计。", // American grocery companies agreed on a single standard, the rectangular Univer
  '72848268215ba1438cee4f4f36d8e7e358f84f8dfa772d8cfa87a825eb5defa8': "然而，要在车间快速且可靠地读取这样的代码，需要廉价的激光器和小型、经济实惠的计算机，而这些设备大约二十年后才会问世。", // However, reading such a code quickly and reliably in a shop would need cheap l
  '186ebc018424c07fd9c59069659287332f54218107585938546abee21f09620f': "1974年6月26日，在俄亥俄州特洛伊的一家超市，一包口香糖成为首个使用条码扫描器销售的产品。", // On 26 June 1974, at a supermarket in Troy, Ohio, a packet of chewing gum becam
  'be950e70eb780c0d6a161d4ea721e45635829ce9537738c01fb24ea0072246ae': "他作为童子军学过摩尔斯电码，思考这个问题时，他在沙地上画出了点和划线。", // He had learned Morse code as a Boy Scout, and while thinking about the problem
  'de7b33281c5588ea4950f095bba3741e02b7a38899a8c0021d41d27f49f51d20': "超市里几乎每个包装上都带有一小块黑白条纹。", // Almost every packet in a supermarket carries a small block of black and white 
  '62af1e0c7eeec54973347543de257112dacb0a7a77b48b8d525b7f786d8f064e': "他意识到，细线和粗线，都能像点和划线一样传递信息。", // Thin lines and thick lines, he realised, could carry information just as dots 
  'f95cc49d645e062ff92214d3b750e93af992d3273aa1235a98cfca6f056b10ae': "如今，条形码每天被扫描数十亿次，涵盖从药品到航空行李的各种物品。", // Today barcodes are scanned billions of times a day, on everything from medicin
  '6d2badccde2c00146226908362a2de297f1735cdec619b5689e238d2b015c96e': "除了直线，它还描述了由圆形组成的版本，类似靶子，因此可以从任何方向读取。", // As well as straight lines, it described a version made of circles, like a targ
  '1c73a639df07363387f4a1f48c114ec5b8d0a9cbd0aa7a0ea186451e489744e7': "其理念始于20世纪40年代末，当时一位美国研究生伯纳德·西尔弗无意中听到一家食品店公司的负责人询问如何自动记录顾客在结账时购买的商品。", // The idea behind it began in the late 1940s, when an American graduate student,
  'f1c80bc9aa3bc26e1783be5c37d3fded2d24b7a1bec5c976cae95be38bee21ae': "到1970年代初，两者都已到来。", // By the early 1970s, both had arrived.
  '621c9b2eb759d34c73422e54514e11b8aab6067bb6d411773bb6e54a11fc042e': "答案是尼龙，可以做成坚固的钩子。", // The answer turned out to be nylon, which could be shaped into hooks that staye
  'e67ee98f8f1378a7458e84749dd4fa5a17dbaa039eba8a6877acfee2743be433': "他在20世纪50年代获得了一项专利，并将他的发明命名为魔术贴，取自法语单词“velours”（天鹅绒）和钩针（crochet）两个词。", // He received a patent in the 1950s and named his invention Velcro, from two Fre
  '5bbac5fa78ca1feb7e2efa0a0dc8c0a3166cac9ff87033dca643c0299a74aaa9': "每个钩子都能勾住任何带环的东西，比如裤子的线头或狗的毛。", // Each hook could catch on anything with a loop in it, such as the threads of hi
  '975292bc6f8e136c7f9b46e06080a177462ede07a37f924014202bc97e2e99e3': "20世纪40年代的一天，一位名叫乔治·德·梅斯特拉尔的瑞士工程师带着他的狗在乡间散步回家，发现两只狗都被刺刺覆盖，这些刺果是牛蒡植物的刺状小壳。", // One day in the 1940s, a Swiss engineer called George de Mestral came home from
  'e5aec3fa2a8d49b4dee30617e946acbd04fb19a4487c10263cd251b7a513c10d': "取出这些花了很长时间，天性好奇的德·梅斯特拉尔决定用显微镜观察其中一颗。", // Removing them took a long time, and de Mestral, who was curious by nature, dec
  '6afd230ad04b38d861fa8363739d05a6f1d3327e4e306832e2aaebb777d73be0': "他看到的是一团细小的钩子。", // What he saw was a mass of tiny hooks.
  'aa5bd1ad56541004291b964ee7a414c81b5b09ee5eb78a26fc0c3785879bbeab': "德·梅斯特拉尔想知道两条布条，一条挂钩，一条环绕，是否能被反复压合又拉开。", // De Mestral wondered whether two strips of cloth, one covered in hooks and the 
  'c7a44db67b988f8d1c74cba502542031931dfed797b745cae03be7214e9be0b4': "他最初尝试用的是棉布，但太软且很快就磨损。", // His first attempts used cotton, which was too soft and wore out quickly.
  '8e007bab136347f4a20c5be95858ed06de2fb1e3e540f2e05de41a53ee0f80ad': "当雨水落下时，它会从空气中吸收少量二氧化碳，使其呈微弱的酸性。", // As rain falls, it takes in a little carbon dioxide from the air, which makes i
  '40312a33ce88e7dbb1e3c4d4ecde9483f5fc6a663dac597c1486e05c969d2e6a': "太阳加热地表，水分蒸发，但盐分会被留在地面。", // The sun heats the surface and water evaporates, but the salt is left behind.
  'f96b66c99add350821e404f318a0031640d1aa6c0f4084c02872343c29c4538d': "当它落在岩石上时，这种弱酸会慢慢分解岩石，释放出微量矿物质，包括钠。", // When it lands on rocks, this weak acid slowly breaks them down, freeing tiny a
  'b41688a30b887cbe4180259cec8e7372717bfc88f4a85c331822f9e730108b3a': "蒸发后的水随后以雨水形式落过更多岩石，并带回更多矿物质。", // The evaporated water later falls as rain, runs over more rocks and carries mor
  '6450229dc4a92d3404d0a5c3d9bc395df711d58b014d0496590122054444d79f': "海盐中的大部分氯化物被认为来自水下火山和海底的热开口，岩石加热的水溶解矿物质并将其释放到海洋中。", // Much of the chloride in sea salt is thought to come from underwater volcanoes 
  '70be3f98175d05c667ed8aa4b4ef22f4a89cba4679ff5e9205b434af2f6a01f7': "河流味道清新，但流入的海洋却是咸的。", // Rivers taste fresh, yet the sea they flow into is salty.
  '8e636d9c29a0bcd0e89dfbd558d65d4ddd7837b38e586e2ff1d6d6d1f5acfed2': "这个水平长期保持相当稳定，因为盐分也会被移除，例如当盐分成为海底泥土的一部分时。", // This level has stayed fairly steady for a very long time, because salt is also
  '61634ee614d6446d9e3276ecc1b5ffd3dda9a372346a8c7828689020b6278ea2': "矿物一旦到达海洋，大多数会留在那里。", // Once the minerals reach the ocean, most of them stay there.
  '2b7674db36f5164f5ebe62cbf5914709d728e4f87c89cf3de6084f6ba02734d5': "溪流和河流将这些溶解矿物带入大海。", // Streams and rivers carry these dissolved minerals to the sea.
  '44aed736b9afed19b68e972759e0c61cd0056bef1641b7f2adcf149ab8bc74bc': "任何一杯河水中的水量都太少，无法尝到味道，但河流已经这样做了数亿年。", // The amount in any glass of river water is far too small to taste, but rivers h
  '10f0952d41b11bf41a03056489aa4c4bda2583adb8cb8c7637dfd0d333b983cf': "它们纠结的根部减缓波浪，固定泥土，保护海岸，而它们之间平静阴凉的水域则是幼鱼的安全栖息地。", // Their tangled roots slow down waves and hold the mud in place, protecting the 
  '052b484df30fc1444b625095dc011d8801b108ba2ee5f4e0a5519cd86d57c462': "有些则吸收盐分后通过叶片排出;干燥日子时，叶面有时会看到小白晶体。", // Others take the salt in and then push it out through their leaves; on a dry da
  'b10886f4e7ff74d0fac59d3f4aea5e6b1680ee46bfbca6120c9678ec61630d19': "红树林正生活在这些环境下，沿着泥泞的热带海岸，包括新加坡北部双溪布洛。", // Mangrove trees live in exactly these conditions, along muddy tropical coasts, 
  '07b7fc0511c6fbce3bc1ca2c61eabf291b07eabde8210c9d81c698516de8fa51': "其他红树林则生长在弯曲的根系上，这些根从树干伸出，将树木托在泥土之上，有点像桌子的腿。", // Other mangroves stand on curved roots that grow out from the trunk and hold th
  '969cf1fa8903546b89ca9a035df9b9f32a6cccb23c564b8504afe2299ce089f2': "大多数树木如果根系站在每天上下两次的咸水中，就会死亡。", // Most trees would die if their roots stood in salty water that rose and fell tw
  '31944f3e43643f122a042e68a2398889cf180bcde659e8aa6214fb2583c37820': "树根周围，数百根细长的树根从泥中向上生长，像竖立的铅笔。", // Around the base of the tree, hundreds of thin roots grow upwards out of the mu
  '424eb8553263ff0ed0580fdb12331f21cdadf2c2cba2d26ca0bcbb39a0b38345': "退潮时，它们吸入空气，空气随后传入埋藏在下面的根部。", // When the tide goes out, they take in air, which then passes down to the roots 
  'f0c9a372ec7c0ac40186b244992709704c41129a96a4a20202e42f6916c9d40c': "盐的处理主要有两种方式。", // Salt is handled in two main ways.
  '523fafdcd1a85504d54f5177fdfdab62ca9fac4e86f7463c018c813820cf8ba4': "红树林生长的泥土软、湿且缺氧，根部和叶子一样需要氧气。", // The mud where mangroves grow is soft, wet and low in oxygen, and roots need ox
  'eddc5e25e43dfede4e7fa70f280ed4414eea7ec7ca74a456465c8772642910b7': "有些品种会在根部停止大部分盐分，所以到达叶片的水几乎是新鲜的。", // Some kinds stop most of the salt at their roots, so the water that reaches the
  'a3306301fa08892c3ef6110dd361357ea6e1dd586765cf2ef9c6082b6064decb': "这也解释了为什么只有大约十分之一的冰山露出海面。", // It also explains why only about a tenth of an iceberg shows above the sea.
  '7ba1182a15c281367fda3c07f6b7527b60682b70d39a1accac62972ae04f3fbc': "水结冰时，这些植物会形成规律的模式，中间有空隙，就像蜂巢结构一样。", // As water freezes, they lock into a regular pattern with open spaces in it, rat
  'd4e7f2b9ab4b063f9df882491cc9f9a258e0e309da7d543ccc0ef7dbe21040c2': "这就是为什么一瓶完整的玻璃瓶放在冰箱里可能会开裂，也解释了寒冷国家的水管冬天可能爆裂的原因。", // This is why a full glass bottle left in a freezer may crack, and why water pip
  '6bdbf8666a5219eafd90822308cec5314eafc537f8bb2ed87a630d9e6243c0c4': "大多数物质也是如此：固态以其大小来说比液体更重。", // The same is true of most substances: the solid form is heavier, for its size, 
  'c83aca0172cdf3d18996b449e1b5f2fae31b2e0978213e26970526b6a424aca2': "水是著名的例外。", // Water is a famous exception.
  'c6da1cc53f1b824df66309277d8c9609144f56f653e154e5092b6b5203c27811': "在液态水中，它们不断运动并紧密堆积在一起。", // In liquid water, they are constantly moving and packing closely together.
  '98d60fbb31b5b26dcfd0bf99530efc658a10e3a0a7262a599c74b3ac9745f2d2': "原因在于水分子之间的相互依赖。", // The reason lies in the way water molecules hold on to each other.
  '3873b6085018e985455d81ec7a34ef93ab7e37faeb28e7ccc594a6e7385ba966': "当湖泊冬季冷却时，较冷的表层水会下沉，直到整个湖面温度达到四度。", // When a lake cools in winter, the colder surface water sinks until the whole la
  'f93cec3b17cd2fbbc59458f35a2b68ca1e93719407193dbd0714d485eefc01d4': "之后，最冷的水会留在水面上，最终变成冰。", // After that, the coldest water stays on top and eventually turns to ice.
  '4b986e7d48b581cf27946d3b32859dd5e982766d45699e9d75b193b4bbe69c6c': "同样数量的分子现在占据的空间更大：冰比同等量的液态水多占约9%的空间，这使得冰体积较小更轻。", // The same number of molecules now takes up more room: ice fills about nine per 
  '42a5c1ed950426a55af6394e4cf3818e54a898fb75a91e52875021d5056e0c4c': "冰会漂浮，这种异常行为比表面看起来更重要。", // Ice floats, and this unusual behaviour matters far more than it might seem.
  'f1f712e2fd2626e3790757ebe84061f8bcb04521953f1db30635e10107418361': "如果冰沉下去，湖泊将从底部向上结冰，生活将更加艰难。", // If ice sank, lakes would freeze from the bottom up, and life in them would be 
  'f8ff0df7dc554383fe42a5ca0405e39ce114318adcf4bb57791743ec775327d4': "那层冰就像盖子一样，减缓了下面水体热量的流失。", // That layer of ice acts like a lid, slowing down the loss of heat from the wate
  '7d3a333459888c819335808344563ef1664cff2be774513e1704b51c569ffbcd': "李先生微笑着，又慢慢地做了一次。", // Mr Lee smiled and did it again, more slowly.
  '899ea65fb295120f6a17c7e4b3e561e52222caf53ed45bc80cb68a110c9bbdd1': "这次他用了更小的数字，我能理解。", // This time he used smaller numbers, and I understood it.
  '6d8a661fbf6904941b6ec4d6aee1e98fd9313752f006fc929f404c2be8475ac2': "周一的数学课上，李先生在黑板上写了一大笔钱，并很快解释了。", // In maths on Monday, Mr Lee put a long sum on the board and explained it very q
  'e2d49542cc08fb44638e9c14db09f6d910a5d9959f1fb271b0db860a45642bea': "我完全不理解第三步。", // I did not understand the third step at all.
  '96d0ab821630125795d14e9b492c4dc1ea28e9eec5fc8d23bd0d8ade654ebd82': "然后坐在我旁边的法拉举起了手。", // Then Farah, who sits next to me, put up her hand.
  'c294550b96db1b67b43192cfb8185d90c8ca6ecc3768187f74588c0bc8388bc3': "然后发生了一件令人惊讶的事。", // Then something surprising happened.
  '82f8a1ec420393dda8fa4541328451c4331ff22056cb4f87614f17a5b2d15d47': "现在我有个规则。", // Now I have a rule.
  '30f61cdab820c888b7237dea217facf24e8e868f44aa3cde3fed76d1cea48f35': "但房间里非常安静，其他人都在写东西。", // But the room was very quiet, and everyone else was writing.
  '1d3691f6be1f0077c7f56aca2fbf72ade84ed068cbdec7cb4781b2152b384c1e': "我的脸感觉很烫。", // My face felt hot.
  'd0c743d04c42704e2e99f9541347500656226ec03285368575c0380a27af0d0f': "于是我把这个数字抄进了我的书里，什么也没说。", // So I copied the sum into my book and said nothing.
  'd19bd59bfcc37eafce95498d5ecc73a8dde251cb3f4fc62dfa86d50121f6ae09': "我以为他们都理解，我不想成为唯一一个。", // I thought they all understood, and I did not want to be the only one.
  '6bcf1082493e1b9033d257f064375b3501cea320d36771329ec638292d21eedd': "我想再请他解释一遍。", // I wanted to ask him to explain it again.
  '396931e29098bb351f441efe7ed4761c40a9ac4b7695492f16ed9ac9f6912541': "我洗了澡，穿上了校服，在厨房吃了一根香蕉。", // I washed, put on my uniform and ate a banana in the kitchen.
  '514d75d3830992194940422004059b35dea137f1b00836c3d7796f2b709fe5b0': "周四闹钟响了，我猛地从床上跳了起来。", // On Thursday my alarm rang, and I jumped out of bed.
  'ff92e55517a33b67a176d3d3e7a09bbbffa220dd159c0527d6f58df6845b452c': "当我到达校门口时，门锁着。", // When I got to the school gate, it was locked.
  'd72f62e83787daf3174538142a01726f385e893729003630e2299137733dfd0b': "警卫拉姆先生拿着手电筒从他的小办公室里走出来。", // The guard, Mr Ramu, came out of his little office with a torch.
  '2a3e458d0bbd1855b4c16c157f16a03ab6016dec393a58a0eda93cf0389a06e1': "没有其他人醒着。", // Nobody else was awake.
  'ad4792272a093be89af6435fa4a10f427bd272f645c3522f412cf5ea86391ed7': "前一晚，我弟弟玩了我的闹钟，还改了时间。", // The night before, my little brother had played with my alarm clock, and he had
  'fa1b685db6c75d739ba9a61031dbfe8b9c1d1cda2235a87433dad90b0e930531': "我以为家人只是懒惰。", // I thought my family was just being lazy.
  'c8d4efec857c8dd8d553f376d3ddc12b010ef0c332c5935825ee24e42e24b33f': "房间很暗，但我起床时通常很暗，所以我没多想。", // The room was dark, but it is often dark when I get up, so I did not think abou
  'a8f3ed7edca13c7257102a43a18dc252dc3ace3e15b64747ff175e5328c94532': "我看了看他办公室墙上的时钟。", // I looked at the clock on the wall of his office.
  '3291b1820a3053792f4b624ce098248ed202526a51d736cc87c36097fd88b25b': "“现在是五点半。", // "It is half past five.
  '7b3e239c344a977fd4e09e6e64cf6cb87ecfc9c283de0d19faeb33e74032f19c': "我很快走到学校。", // I walked to school quickly.
  '87e0b20eb28031e14d06daedca9d62bda5779978271dc2bb0acc83c5910efa59': "公交车站没有其他学生，商店也都关门了。", // There were no other students at the bus stop, and the shops were all closed.
  'f30803029cc4e0be20d7c895219fa5f03867ed5952e7fb17f273856bf7901979': "他给我倒了一杯热茶，还给我看了他孙辈的照片。", // He gave me a cup of hot tea and showed me photos of his grandchildren.
  '013d8aa3ed740f2a4c1487543f0c6773b42a42347d253bb424086690dd1a86e3': "我每天都跟拉姆先生说早上好。", // And I say good morning to Mr Ramu every day.
  'f8c9ce5beacd13a57ef8a21dec1497ebadef9ac65be8aa1eeb040762c935e234': "翁女士给了我们每人一颗豆子、一块土和一个写有我们名字的杯子。", // Ms Ong gave each of us one bean, some soil and a cup with our name on it.
  '6109652cf04273e8fd1415eebf74482e308940cd601d5b032d286eb93fe292e8': "八天后，有些植物长到和我的手指一样高。", // After eight days, some plants were as tall as my finger.
  'fbbe9e024de796d71f819fb06d454484d0dcf87ee0533f92c9249e53eee4d288': "第十天，翁小姐帮我用勺子挖出豆子。", // On the tenth day, Ms Ong helped me to dig up my bean with a spoon.
  '484387ef6056b10089d7ce08010185a45a4a1699ee24dbc4345800d768a700c4': "“种子需要水，但也需要空气。", // "A seed needs water, but it also needs air.
  'af747635486bc549641ce783f9785321ecbdfeb5ab1ae1ec1b3a08fce32194fe': "它柔软而暗淡，味道难闻。", // It was soft and dark, and it smelled bad.
  '35885b5776e4855ca2a60b26a46bff521b4fdcff45ba6453bd7d90ff1adb8054': "五天后，几乎每个杯子都长出了小绿芽。", // After five days, small green shoots came up in almost every cup.
  '2ac6e1e19a0940b17aa40e2bb7e5e2941cfceb3251393cb955ce5e617a356ed0': "科学课上，我班上每个人都得在纸杯里种豆苗。", // For science, everyone in my class had to grow a bean plant in a paper cup.
  'c658bbd155f086e2715811e239a3c1bcba601786312851988cc81bf846f685f3': "我甚至趁没人注意时轻声和它说话。", // I even talked to it quietly when nobody was looking.
  'aff9e371fb6cb9abe5da5edb02d987a8c3df16b2329cf2351ee9b744e77351d4': "我的是棕色且扁平的。", // Mine stayed brown and flat.
  '5729d51f8639da7983714b6c7efec1b5eeef3a5d74699432832ac2dfed9a82e4': "六天后，一株绿色芽生出。", // Six days later, a green shoot came up.
  'b76ee2e4592e28f6f0b60b24a558c2dc7feca8b0b92f1edc51a99c33e2dc9f86': "它比别人都短，但我最喜欢它。", // It is shorter than everyone else's, but I like it the most.
  '38f2353c23554a6bf0b4b04572ad7838f0a4a5aafd08e148e78e97a76a1f69e1': "我已经努力过了，而问题出在我身上。", // I had tried so hard, and my trying was the problem.
  'd00557f6f688976de81f354be4c4f377be042bdbe85258dedb3aa6e8b27a3b4c': "我们把杯子排成一长排，放在窗边。", // We put the cups in a long line next to the window.
  '7d3854405bb2b5f191367f28731f606c81785e4bb2b851662c846a9f73443924': "我把它搬到了最阳光充足的地方。", // I moved it to the sunniest place.
  'a34e2dfadbc9e1afec746849ce9f3c2505587d7c1419a66820c13ce327190e28': "我们的新邻居有一只叫可可的灰色鹦鹉。", // Our new neighbours have a grey parrot called Coco.
  '3d82157d894c4da77763c05efacd746eb650b8ffcf7b2d41b8d30121beea842b': "她住在家门口附近的一个大笼子里，所以每次经过都能看到她。", // She lives in a big cage near their front door, so we see her every time we wal
  'ff32dcc68c50f4b81495c2cb05e0d4961065bb35fd15f48ed1c00d19f73fc2a4': "我感到困惑，也有点自豪。", // I was confused, and a little proud.
  'd47435f7310db10129bafcbdb024d3f3ca7ae06cdd4c30a653eb4a8e82026a36': "她说“你好”和“再见”，还能完美模仿电话的声音。", // She says "Hello" and "Bye bye", and she can copy the sound of a phone perfectl
  'fd0f89dbddfdc1904d13f4a2a8e720d1f658b9c12fbe2340fe7c9097fb703d3d': "现在可可叫我的名字，然后用我奶奶的声音说：“鞋子！", // Now Coco says my name, and then, in my grandmother's voice, "Shoes!
  'c449d26c73efa3a64eb6e06e223dee3c0559efd14ebc8df70f77f28916a7a22d': "她花了一周才明白那是可可。", // It took her a week to understand that it was Coco.
  'c5a033329660c032d6576b2cf81c90e3ed770fd457ead09056539fd58b0e9aac': "每天下午，我放学回家，她都会喊“君威！", // Every afternoon, when I came home from school, she shouted "Jun Wei!
  '76f61dc7a5d57f85300ba83e30cb14c0c8ca057de617db6c6e4891257cf4ab6d': "上个月我妈妈一直跑去接电话，但电话从未响过。", // Last month my mother kept running to answer her phone, but it was never ringin
  'd081c2c6216628ab878f59c1cf2be487be34b12f4871c9d4adcf4c9a65099009': "即使其中一个是鹦鹉，也很难同时对两个人说不。", // It is hard to say no to two people at once, even when one of them is a parrot.
  '22ef1efbb57803bb0b002073552bef8695abf013e623fbb08ba0cab92bac5d48': "每天下午，奶奶都会开门叫我们：“君威！", // Every afternoon, my grandmother opens our door and calls "Jun Wei!
  '278e00af01e526b3d76e8460aec69ebf01c18f58d1e7a130272349f5fe43f1a6': "“那是我的名字。", // " That is my name.
  'db21b23a72dc9f47aa8f35b1105af3023a8a01dc1e1f677f27bda9f7f370bf89': "可可大概能说二十个字。", // Coco can say about twenty words.
  '45cad87862c30e6c23a2eebc3a6cab6906277b9f64c56a1514b5e280c7372605': "我父亲把垃圾袋里的东西全拿出来又放回去。", // My father took everything out of the rubbish bag and put it back again.
  '2e2427a15c34bda9cd06579c7f62f7b3420fb39f21fb302846df64b90b93cda7': "他把手指放进嘴里，掏出了什么东西。", // He put his fingers in his mouth and took something out.
  '4a87b71b66f0a18991ddaec9ee7ce69afaae75b3e45e0d8bf665b0d7023f187b': "我看了桌子底下和冰箱。", // I looked under the table and the fridge.
  '019093c2d2241a863211aa8ba1568c3b4d1fdfce11f6794a50a183a47812afdf': "凯吃饭前仔细看了每一勺米饭。", // And Kai looks carefully at every spoon of rice before he eats it.
  '231224ba639db973bb6c27ae1c4465be235a9c07fbaf481a57dcc70bf9920579': "我妹妹检查了水槽。", // My sister checked the sink.
  '8eef3c4f4b6e3df8a928ded407e4375ea645847bcaff7fa7c40ca22a3165a225': "那是我父亲在他们结婚前送给她的戒指。", // It was the ring my father gave her before they were married.
  '634def941921a577cd5bd8008a24bca2b1e540272e4d5d72d55ff3a8a37c0ff9': "反正晚餐还是吃了米饭，还有鸡蛋和蔬菜。", // We had the rice for dinner anyway, with egg and vegetables.
  '49afb45d59f687167cc6e529161d69b236c0dbca635164109e635a5c00afaf48': "它一直都在米锅里。", // It had been in the rice pot the whole time.
  'fef3aaa35b3e336845edb8b0d3acd7548989844a8406f6ec0c13a87962b147ef': "她把它放进炉子旁边的一个小蓝色碗里。", // She puts it in a small blue bowl next to the cooker.
  '18c05e024d93f4ae7a1ba1c9bc34037d79adaf5dc599940887e13f3278dafb9e': "吃到一半，我弟弟凯就不吃了。", // Halfway through, my little brother Kai stopped eating.
  '70a669d1764c5c0d343a2c89e77e74aea88bcc02f9de1872fcc625cb80fdbeda': "我父亲说凯是家里最会找人的人。", // My father said Kai was the best finder in the family.
  '4a4fd8852336ad4545b7cfc9168bb82575e82b8ba2e992e1a68a1cb818131207': "现在我妈妈洗米饭前会摘下戒指。", // Now my mother takes off her ring before she washes the rice.
  '2fb036bf1625d663514edb6f5c8f739faaeedcad70f00c757eed9e1f3a8b6c26': "我弟弟俊昊有口吃。", // My younger brother, Jun Hao, has a stammer.
  '24b373de1b459215e16cfc6c157a007cded0f189194a0192659dec850301afed': "三月份，我们的父母带他去看了言语治疗师，叫佩雷拉女士，有一个星期六我也去了，因为她要求全家都来。", // In March our parents took him to a speech therapist, Ms Pereira, and one Satur
  '5e568fe1c8aaa26f1b0d5882e0f50c3c2385d406bf39d596a31f0c8f974cc082': "他看起来很惊讶，然后继续讲述了他如何扑出点球的故事。", // He looked surprised, and then he carried on with the story, which turned out t
  '9207ac8013a1e121fc83dd62871ee5deecfa4e9a6189a0f4f571b64a3e975424': "我有些自豪地说，作为他的姐姐，我帮他完成了话语，这样他就不用挣扎了。", // I said, a little proudly, that as his big sister I finished his words so that 
  'a39490680108e9a7f9371edb0583b90ac62e133966086aa95db3eff1f8f9e951': "这样更快，我告诉自己这帮他免于尴尬。", // It was faster, and I told myself it saved him from the embarrassing part.
  '1499be48539cf1ff791564de6661b70ae0a7069bd3b57d7265a5b5d2a07b56cc': "我脸颊发烫，看着地毯。", // My face felt hot, and I looked at the carpet.
  '77eaf8f3f8957f8db0c41429d465679b58c4dfb8f95f203790e63aa8650c7ea0': "我母亲说她让他深呼吸。", // My mother said she told him to take a deep breath.
  '9678801661c4c154edeaa9fe125d48f6141829822b58aed8641e9aecf21080d5': "她说，帮助她的是普通的倾听：持续观察对方，不要催促他们，让他们自己说出自己的话，即使需要更长时间。", // What helps, she said, is ordinary listening: keep looking at the person, do no
  '946f2f553de035e59955918f456b097266f5531e179d016df7b37a0b8aed3ddf': "我抿紧嘴唇，继续看着他。", // I pressed my lips together and kept looking at him.
  '5d1bf04b9ee469ddd5e8ea914097d8248a62725635dc099182977f8be2a38e22': "卡住时，他闭上眼睛，肩膀耸起，第一个声音一遍又一遍地重复。", // When it gets stuck, his eyes close, his shoulders rise, and the first sound re
  '9e8e4f0eb13f948428b68e0e8adc2bc2e61338934a98e896ed7cbc425981df8e': "第二天晚上，俊昊跟我讲学校的一场比赛，卡在“守门员”这个词上。", // The next evening, Jun Hao was telling me about a game at school, and he got st
  'e901275f8c5f72dc11a62c458c0ece02b677a8c2fdd0e965e672169c7a7726b9': "我现在明白了，我是在帮自己节省几秒钟的尴尬，然后用他的声音来做这件事。", // I understand now that I was saving myself from a few uncomfortable seconds, an
  'd0b7797e1c56ee54a7c33f2179fc8c4e4fe162238045694dba3cd352a41b7428': "大约只花了八秒钟。", // It took perhaps eight seconds.
  'a5188f185be82a41c5a196753aaa5dad2ff1f8e12899683f8b5b57ff7ed63c0e': "有些日子他能说一个小时毫无困难，有些天无论他怎么逼都一句话都说不出来。", // Some days he talks for an hour without any trouble, and some days a single wor
  '2c1f9a74ba4fe96f7d0966119f61064ef456263ea38ffba209e06c3a7f6e6eb8': "全队鼓掌。", // The team clapped.
  'fe57836f3c51a6f0effff6489f270ed15d1b5216e438427ea74a7fc10fcb06f9': "他比我们其他人更快，进了我们大部分进球，从中学一年级起就戴着黄色臂章，仿佛那是为他的手臂量身打造的。", // He was faster than the rest of us, he scored most of our goals, and he had wor
  '96dfd2e59f3680c2ca916c1ae15c1951f4b529dd4b70a710f5fef9c0932062d8': "我知道我应该说点什么，而所有人，包括阿琼，都在等着听他说什么。", // I knew that I was supposed to say something, and that everyone, including Arju
  '577c4d9e17c3115973a7b9a09f61c6de472636f5adebbc40b284f9dd31464476': "所以当萨利教练念出新赛季队长的名字，是我时，我觉得他犯了个错误。", // So when Coach Salleh read out the captain for the new season and it was my nam
  '2579373fc6aac36996bf723c7b8bf1dc78ad61e0ba3c8b9da8b2b722fd64930a': "但我现在明白教练的意思了。", // But I understand now what the coach meant.
  'f08d50ef2f51a2294e9a17099ab3663fd2da631b75cace846fe984cf794e302e': "带领团队并不意味着比阿尔君更重要。", // Leading the team did not mean being more important than Arjun.
  'de0e7c17447b1ef463687dd4119a704588f403eebadb2290312eded717231bc8': "我们本赛季的第一场比赛是对阵一所去年两次击败我们的学校。", // Our first match of the season was against a school that had beaten us twice th
  '5c247d88bfed6b8ace20cec667dd47c168d6184cf21225d41e6b5f426364194d': "当我给他发消息说客场比赛时，他回复说：“好的，队长。", // When I sent him a message about the away match, he replied, "OK, captain.
  'de18e45d120940d3dfa99ea99796eb8b3e6e5c0c3720b32533af8c8a30d94f5c': "然后我转向阿尔君，当着所有人的面问他是否同意。", // Then I turned to Arjun and asked him, in front of everyone, whether he agreed.
  '0e4770144e625aefc6689b5be1c69c058d619412935db5cf5e12854c3ae5ed91': "他说队长不是最好的球员，而是别人听从的那个，他注意到年轻男孩们难过时会找谁。", // He said that a captain is not the best player but the one the others listen to
  '277fc635a8bb8b24efccdfb65a79ae78ef078a61e8a911872d9c9c7b32eeaab9': "“我反复读了那两个字，试图弄清他到底是什么意思。", // " I read those two words many times, trying to decide how he had meant them.
  '527d33140cc49217bca8178238607c6077493183de0ac16300a4c6c215137c3d': "这不是给他袖标的理由。", // That is not a reason to give him the armband.
  '8f24ac58fc2f129b0641ba796cb16811d5d0fdef98403763d1e6b52045baf676': "我说我们传球给阿尔君太快了，还没等他有空位，下半场我们应该控球时间更长，让他自己选择时机。", // I said that we had been passing to Arjun too quickly, before he had space, and
  '58db3087b3a27ae8c00b98340e45646d8d32985e6482f1a7bc9b4b008f05f819': "阿尔君也鼓掌，跟着其他人鼓掌片刻，然后他看向草地。", // Arjun clapped too, a moment after everyone else, and then he looked at the gra
  'bcb9734117f46ab237d86caa5468f4339fe4f7f55bf5342b57ed7edb2828cbb5': "这意味着确保每个人，包括他自己，都有继续玩的理由。", // It meant making sure that everyone, including him, had a reason to keep playin
  '0b6dd7e6fa43287dbf094cf1efc68985ca149e778885e8327164d2e2a89e6d4d': "两年来，阿尔君一直是我们16岁以下足球队的队长，从未有人质疑过这一点。", // For two years, Arjun had been the captain of our under-sixteen football team, 
  '7129b992f6d95d7e43bd77fcd0357bd785fa3ad29b950a792f754403af1874a6': "他妈妈邀请我周五过夜，这样我就能和他们一起吃萨胡尔，那顿饭是在黎明前。", // His mother invited me to sleep over on the Friday so that I could eat sahur wi
  '7314dd17bd463e1335ff9b4a1c867fd337e1ca09e5da06e87c5003a30ed6070a': "当伊尔凡问我数学问题时，我对他发火了。", // I snapped at Irfan when he asked me a question about maths.
  '81a2dd5b9c0195a5e8a7c20f2be8d4a6248b1875ab8fcceba24ce7f5e636548b': "七点刚过，全家人围坐在桌旁，端着枣子、一壶玫瑰糖浆饮料和奶奶从下午开始做的饭菜。", // Just after seven, the whole family sat around the table, with dates, a jug of 
  '9cb48950a2a32e14837d13e6f12c8535138a861be31fa60b3046548560638df3': "他课间休息时仍然踢足球。", // He still played football at recess.
  '2375645c845f20e76daa72c23e1addf763c7a54c03880335ad61887f2cdc633e': "最难受的不是饥饿，而是口渴：我的嘴巴像纸一样沉重，每家卖冷饮的店铺似乎都开着冰箱门。", // The worst part was not hunger but thirst: my mouth felt like paper, and every 
  '545427831acf435167b991ef72d2b2425e39667fb223aff27775492eee873c01': "每年斋月期间，我最好的朋友伊尔凡从日出前到日落期间都不吃不喝。", // Every year during Ramadan, my best friend Irfan eats and drinks nothing from b
  '3162af3bc4aac606b0be3699917889973bd7a5bbc2d34465db53fc4ba530217b': "然后，五点半刚过，黎明祈祷的呼唤响起，直到傍晚前的饮食就此结束。", // Then, a little after half past five, the call to the dawn prayer sounded, and 
  '7233d3664bc12df544a4d785d88c3c9765fc3e76c6f26c782837003a409c247d': "我大半辈子都像看待他的身高一样看待这个事实：一个关于他的事实，短暂有趣，随后便被遗忘。", // For most of my life I had thought of this the way I thought about his height: 
  '500432488678fbb5d8cd8a613c42a3da5ead3fa19b3857f1da3a3479ce7bb548': "我吃了两个鸡蛋、一碗燕麦和一大杯水，感觉自己在为长途旅行储蓄燃料。", // I ate two eggs, a bowl of oats and a large glass of water, with the feeling th
  '7d3472df8ac9fbec61ebc59e06a5eb90f643e5fe4fa497b6a5f56e2b3eb788d6': "我多年来一直以为他觉得事情很简单，因为他从不抱怨。", // I had spent years assuming that something was easy for him because he never co
  'fcb04c44a7d772a57cb064e04e1b0666f2a4c12f6ea54bb69f85e885ef4378bf': "他说：“那就别为了证明什么而做。", // He said, "Then don't do it to prove something.
  'df28a92c87cdc0c2ee9c0b0d27e913cdecf2ca9dcc648e041b8629eb406e381b': "我说我想理解。", // I said I wanted to understand.
  'b9fa97782c24f62ab974c15e71edc500c5c7b5cff108b6c22ee4da8d6131e2e8': "我记不得有哪一天像那个柔软甜美的约会，以及之后那杯冰水。", // I cannot remember any of them as clearly as that single date, soft and very sw
  'f26fc7fd282e475b594a7a8a475df4673fccd3dc2577af8502cdc381819ff7cf': "一天的时间足以让我明白，一个只是坚持下去的人背后能隐藏多少努力。", // One day was enough to show me how much effort can hide behind a person who sim
  '2e6ccf20881484514e8a7baf8690d1e3b82234a111c56a7ca48934ec81472ccc': "我本以为他会高兴。", // I expected him to be pleased.
  'dafbc9ce23c596210ece83aab3183cb8039dcbce2e606544b0723b3cf4aa6059': "“我问他怎么能坚持整整一个月。", // " I asked how he could do this for a whole month.
  'b68d86d49f051e7de6af413e1d43fa6c5b61c6ed8ebbc2ebeda19f8ab6057811': "我按人说的捏紧手中的橡胶球，数着。", // I squeezed the rubber ball in my hand, as I had been told, and counted.
  'c30875a4fdf541b48f843ffd0e5c524586c27efacf5ab3f9d7893a3f5ac43183': "他们把椅背放低，直到他的脚高过头，给他脖子盖上冷毛巾，平静地和他说话，直到他再次睁开眼睛。", // They lowered the back of his chair until his feet were higher than his head, p
  '4a0f5e1efa6a45aa84aab1f8b3645fe03d92ad429859f08248a63dbb4c7320f9': "它比我预想的要大，房间似乎一时倾斜。", // It was larger than I had expected, and for a moment the room seemed to tilt.
  '412460eac2d7a87b646785d22416c24a09b45fa8b550279ae76f55d300773173': "他感到尴尬。", // He was embarrassed.
  'f874d9b4ad77f905950803ff85cc3b60653c711f8125c95c8ab2715d7acc6bd6': "之后，我们坐在一起，喝着橙汁和饼干。", // Afterwards, we sat together with orange juice and biscuits.
  '64da183c6f6437383931da5ffea4a3ea3199296bc19077fd1b4a97df4a3c1991': "他比了个大拇指，告诉我不要看针头。", // He gave me a thumbs-up and told me not to look at the needle.
  'f3e6a6c7e01508810a8ce9651aae7ddd21b7cf721dac5bce53c2558866e71549': "护士量了我的体重，检测了我手指上的一滴血，还问了我一长串问题，其中一些让我脸红了。", // The nurse checked my weight, tested a drop of blood from my finger and asked m
  '3d26eeee4aef29914e48a4cacc007524ec02c4338c6b37ce62d13d004ee6905f': "我不得不咬着嘴唇忍住笑，父亲假装没听见。", // " I had to bite my lip to stop myself from laughing, and my father pretended n
  'f0cfea14f04d8ddc4a5bff578c829e2e6f61d9a0029d322e3e420b9c636db2b3': "在我十六岁生日后的那个星期六，我们一起去了血库。", // On the Saturday after my sixteenth birthday, we went to the blood bank togethe
  'db5df20382695da388cf346dcdf16ca5d62eb0498061c512dd498443cd25ffc2': "我望向对面，他的脸色和墙壁一样。", // When I looked across, his face was the colour of the wall.
  'fa9267a56d52858264c75a5a6160a9301f28ab06daa93bf17e2a3c9f968b1057': "在新加坡，如果父母签字，十六岁时可以献血，我已经倒数一年了。", // In Singapore you can give blood at sixteen if a parent signs the form, and I h
  'b5d7db56b06342948cc66b741c9c21f6825a190d46edbffcf3a27a9c4efe6573': "他说以前从未发生过，是因为敬酒，我不能告诉我妈妈。", // He said it had never happened before, that it was because of the toast, and th
  '652c2a9f2e2c9e2a35fe7815f65fcdf89a85a90b549dc98a76897c405260115d': "我记事起，父亲每六个月献血一次。", // My father has given blood every six months for as long as I can remember.
  'e4c23d6fd2a4ccb2a28a8943231b9a32cf98a25a5371893f6f2051f9a77e28a1': "她走进我们的房间，轻轻地关上门，在我们家，这声音比砰地关门还大。", // She went to our room and shut the door very quietly, which in our family is mu
  'a9c566c94a347c92d90135da1fc190be348abcf5ae04190f0edea3f8953b6d5c': "它落在反面，这意味着我赢了。", // It had landed on tails, which meant that I had won.
  'c4bcc1a8760866c43cec916eb47e4a2c550718b939699f61a4382630ccd9ef9b': "那里满是日本庭园的画作：石径、枫树，还有一座从不同方向反复绘制的小木桥。", // It was full of drawings of Japanese gardens: stone paths, maple trees, a small
  'cfe219f260775dab9942e1bb07383b04a61870235411adf50928fcf33786013c': "父亲扔了硬币，接住了，然后翻到手背上。", // Our father tossed the coin, caught it and turned it onto the back of his hand.
  'fc7f7c6d36216c861cdd60f6b4bc10481fc3439cef5462b224d4c5ce64240b83': "我和我的双胞胎妹妹琳恩，十五年来几乎共享了所有东西：一个卧室、一个生日、我们大部分的衣服，还有在四年级那个糟糕的月份，水痘。", // My twin sister, Lynn, and I have shared almost everything for fifteen years: a
  '6d378fb6aebcd97e43f8d5bc8a6d0246a40b1ecd986dc1f0529a0113352fa017': "所以当学校提供两周的京都交换旅行，而父母说他们能负担得起只派我们中的一个人去时，我们都知道没有公平的决定。", // So when our school offered a two-week exchange trip to Kyoto and our parents s
  '9f429b9cbdb3f944aa4d0f74718c1c843b2bf0ec07881767dcba51d821abfd34': "我本以为会感觉美妙，果然，持续了大约十秒钟。", // I expected to feel wonderful, and I did, for about ten seconds.
  '54eb781b9038918b25f972ce65ffd9f382f46e5992f46b6741d2aa994c204f20': "妈妈建议我们好好谈谈，我们就这样聊了一整晚，直到我们不再真正说话，只是声音越来越大地重复。", // Our mother suggested that we talk it over, which we did, for a whole evening, 
  '003a612d8b59df141e021558820af6befc8e6f883b8a5194072c28e29f68c6b0': "第一页她写下了日期，那是一年前，远在有人提起旅行之前。", // On the first page she had written the date, and it was a year earlier, long be
  '58d9d2b54e80d1f0d8b9fc5edf440c1136b51d1f8ec0f4f1b249d28734daa7c5': "然后，我找充电器，打开了她床下的抽屉。", // Then, looking for a charger, I opened the drawer under her bed.
  '8f49da6e3f8a49b3451ef1eb51e1afab37cdc4572af2e2529b16f5e8ffa9fc21': "我妈妈问我是否确定。", // My mother asked if I was sure.
  '3613788d6a73c275de64787ea9afd9d75fc2f3409735dc69826d06db7072b224': "我按下麦克风键给艾莎发语音消息，说出了我心里想的话。", // I pressed the microphone button to send a voice message to Aisha, and I said e
  '67e98d65972c6cca535700690200134ff5856137dc1e97b1694882047ae17690': "我盯着消息旁边的小灰色勾号。", // I stared at the small grey tick beside the message.
  '108a2d9b174764b12d1b5ef32cdf4e73cb1b9de2f4a3a8a784e1e9e4ba9fc83c': "有办法为所有人删除一条消息，我也做到了，但“此消息已被删除”这几个字依然留在那里，就像一个指向我所做之事的标志。", // There is a way to delete a message for everyone, and I did it, but the words "
  '74eaa6ad0178e185868e08b98ec3c0aed4796c0c694b272c9ec14c03c5cf19b7': "我握手机握得很紧，拇指都变白了，我看着第二个滴答声出现。", // I held the phone so tightly that my thumb went white, and I watched the second
  '7c68fa8c20b55b89896bb5ba56e0ccebf138614d4c76e18dd643e15e1b11586c': "她答应帮我练习法语考试的口语部分，但一小时前她取消了，说作业太多。", // She had promised to help me practise for the speaking part of our French exam,
  '76361dee2836ba234d68d2dc36677ffe0f52ae5c02e749c237ca4368410878a2': "说出来感觉很好。", // It felt good to say it out loud.
  '8a2b3fefbe54137904de787165aad34061dc628afb6b387fb86bf3efb572d7e6': "我们现在每周二还一起练习法语。", // We still practise French together on Tuesdays.
  'fea36829e1a9a73cdc8909bf33d510504202cafe7badad4a05cff6832bc6764d': "我本来已经准备好在按下按钮的时间里相信她最坏的一面。", // I had been ready to believe the worst about her in the time it takes to press 
  '17f04f88785a8b66c6032c845393768cc68ef6158472cc1522247c3fcd744c2d': "二十分钟后，她发了一张电影院的照片。", // Twenty minutes later, she posted a photo from the cinema.
  '5c46b9a16d2b24edeb672adc27452fb671fa2885932b227274f246b412fa2bec': "他们的聊天记录在我的列表中相邻，我点错了。", // Their chats were next to each other in my list, and I had tapped the wrong one
  '79b919d2e714a2db479543b5952a20b970b28d1e29911be550e6b59f8bd859b6': "现在我生气时，会等到早上，然后当面说，或者根本不说。", // When I am angry with someone now, I wait until the morning, and then I say it 
  'f070a7df34a9bf85cc9725ead1ef530af30b82f5cf74b12f022cb53f4f08eed9': "然后我看到屏幕顶部的名字。", // Then I saw the name at the top of the screen.
  'f1bd6b3cf9beb6fac5a6fe4ad3adf98f0d2ca968196247f25795d3e1693446f3': "马库斯等我把地图放下。", // Marcus waited until I lowered the map.
  '0a412d83663d665a138b418efe1642eb5370cc2dcd886614ae08098096527158': "在我们学校营地的第二天，每组四人都会拿到一张地图、一个指南针和公园里隐藏的六个检查点清单。", // On the second day of our school camp, each group of four was given a map, a co
  '578b89df985c0fa61d64cff42822cc8849901b36c42e8a6342b6cb57bb3de30a': "他说得就像你告诉别人鞋带松了一样。", // He said it the way you tell someone that their shoelace is undone.
  'fcac7044a8c9368ffc73c5e96c38ac7489ca1b23cd0c7ea3c0bd4be8efb07db9': "然后他指出我从第三个检查点开始就一直倒着拿着它。", // Then he pointed out that I had been holding it upside down since the third che
  '71acca43a408823c026fd1a6e18f27a972d755b8ba6ef6aaa924cdfe1c9d53d6': "另外三个是德夫、莎拉和一个安静的男孩马库斯，他那学期加入了我们的班级。", // The other three were Dev, Sarah and a quiet boy called Marcus, who had joined 
  '1600527db0eab7466bc229ca25a0424ec5f027c039551d402dadf625ed6fe9c7': "德夫坐在地上，说他的腿已经不动了。", // Dev sat down on the ground and said his legs had stopped working.
  'c042fe5e55cc9642c398d5cb790d14d02f97e1f28fcdd8af8c0e1795b4d5f432': "我看了地图，转了两圈，说我们应该往右走。", // I looked at the map, turned it round twice, and said we should go right.
  'cc463ecb02bf0f0fcc391920a307979b797154d36b9d58af5b8a0654618f3cf4': "我是组长。", // I was the group leader.
  '9a6ae5299d5831fef010cf28559d3b0dda4a771c5f3aa5a148b9caba72163f00': "第一个找到全部六个并返回大厅的小组将赢得一盒巧克力，更重要的是，赢得最后一晚选择电影的权利。", // The first group to find all six and return to the hall would win a box of choc
  '7ce3edf35210790e455b58b6abd318144a4ad30dc3ebf78fbf56b3b5e6359440': "从那以后，我一直把定向旅行的故事藏在心里。", // I have kept my orienteering stories to myself since then.
  '2298e685f9d97ef07274e0cd8d36855aedf7c0088e6d728b86634981384dd09d': "我是领头，听起来非常自信。", // I was the leader, and I sounded very sure.
  '9c53d7c7ee0b470e5e55b383489e03c87b213b7818845961ff913112fe8fcf05': "我的脸烧得发烫。", // My face was burning.
  '2092d3460cc24ef8b9341e0dd2277c683e0c82e7df8c16058e0fa1a82dbdd346': "“他带我们回山上，一句话都没说我的错误，我们四十分钟内找到了最后三个检查点。", // " He took us back up the hill without saying a word about my mistake, and we f
  'b7567f6f713480bc764fbdddbcab435aa53583b6cfd3d9455615209d0371f470': "右边的小路下山，穿过一座小桥，进入公园内一个地图上似乎根本没有的区域。", // The right-hand path went down a hill, across a small bridge and into a part of
  '5f085112558c999bfad695be345d09540838565c29bccc6a711435dbc919f93a': "那人缓缓拍了拍手，然后继续前行。", // The man clapped once, slowly, and walked on.
  'b18f97683735e4cc8a2d261648b261a20ef8bb13115062f2d1edb7fd3befa3d4': "我借了叔叔的旧自行车，把座椅调到最低，周六一大早带父亲去了一个空荡荡的篮球场，那时其他人还没醒。", // I borrowed my uncle's old bicycle, lowered the seat as far as it would go, and
  'ba2c2d0623421e7ca3248a54e5ce4f3f00d26a9d1cac91db250ada039f214796': "我是在三月份发现这一点的，当时我问我们家是否可以在周日沿着公园连接线骑行。", // I found this out in March, when I asked if our family could ride along the par
  'c8087066a1c72a048fac54ad850d228a28efabd75c64f40edbf161a897a813f4': "我父亲握着车把，仿佛自行车会跑掉一样。", // My father held the handlebars as if the bicycle might run away.
  '7b779a3a662e4d998978e87a5dce0f2a0ae0136af5ac8f7155b74c8aca174ce3': "他在父母店铺楼上的一套公寓里长大，那是一条繁忙的路上，没有安全的地方可以学习。", // He grew up in a flat above his parents' shop, on a busy road, and there was no
  '3aff3b7e8b8d2d7e47c98a2aa712d2dc1d9942c1328e0c85c12650658067c9d1': "我一直以为他只是不喜欢骑自行车。", // I had always thought he simply did not like cycling.
  '586fee22a244c7cc0f1361028789f5ed2eb6978dfc9f2f2b2df5ce7ac6feeedb': "第三个星期六，一位老人停在球场边缘观看。", // On the third Saturday, an old man stopped at the edge of the court to watch.
  'ad2751d55325acfaf8fcba812b6eaff86415cc42d12f27d116aff46f15e972f8': "我父亲看到他，立刻下了自行车。", // My father saw him and got off the bicycle immediately.
  'f5c06101b375cf5105102a5ef438067d5dc7fcd6802aa9a48022701050c5ed40': "一个小时后，他总共走了大约十米，看起来比我下班后见过的任何时候都更疲惫。", // After an hour he had travelled about ten metres in total, and he looked more t
  'd6df01b7b7e13c2ef98ffc4f3239fb1f61e3a9dd1baa7908ae80aa311524db60': "我以前以为父母已经什么都知道了。", // I used to think that parents already knew how to do everything.
  '4e19a9ba497fe057be5588a156143af1a185e4c4d799fbe8de01c609c6b84a68': "我父亲是最慢的，他对我们经过的每个人都按铃。", // My father is the slowest, and he rings his bell at every single person we pass
  '4b1686a9502ff618c8ce1bdc73945f1b08701fab4c7908fac1d06bbabc443aed': "他说，等他学会时，他已经太忙、太老了，人们会嘲笑他。", // By the time he could have learned, he said, he was too busy and too old, and p
  '27dcd1325acceef73966d440183fe811ae566e1291e7da862b83beda40f63c11': "两个星期六后，我松开了球场中间的座位，父亲没有注意到。", // Two Saturdays later, I let go of the seat near the middle of the court, and my
  '506ffddb32784b8f9e5de7c048205afc7542961718743fec730c4d5ae51adb2a': "轮到我时，我请求帮手。", // When my turn came, I asked for a helper.
  '2c9184f9eddf6c607d72deffd71610269843fe90efb84a1610e51abe238e109c': "当他们在走廊里经过我时，我发现自己一点也不介意。", // " when they passed me in the corridor, and I found that I did not mind at all.
  '6cfa832da5d30d90f952632b99571226e71c32bced9facc2286948ac21e7125b': "舞团的男孩们事后告诉我，这是下午最棒的表演，我分不清他们是不是在开玩笑。", // The boys in the dance group told me afterwards that it was the best act of the
  '3585a65cd1c3f3d7647bde182ac637d4668b303821a501c3e34d759e877c15af': "我把硬币展示给大厅，假装用左手握住它，同时偷偷把它放进右袖，这就是这个把戏的用法。", // I showed the coin to the hall and pretended to close my left hand around it, w
  '4339420b4e1967258c653fd99b1b6139417ef0495533f07c740c9217e63527d9': "拉小提琴的女孩赢了，她应得的。", // The girl with the violin won, as she deserved to.
  '5bbdd51554eb269ab79c3b0c1e91667448541dd150828ae76a791b3c1d923798': "就在这时，硬币从袖子里滑出，落在舞台上，缓缓滚到前方，最后从桌边掉落，落在校长脚下。", // As I did, the coin slipped out of my sleeve, fell onto the stage and rolled, v
  '83da1b55a2ad35b7fd19ecaae56864efc994329c1ff10eb943c7dab7fd00333d': "但学期剩下的时间里，一些我不认识的人说：“这是你的吗？", // But for the rest of the term, people I did not know said "Is this yours?
  '17e494c28a38d5397a789bbbbd0963b4c31933b9ea26ef73b0331fc992ba5968': "我在名单上排第六，排在一个拉小提琴很漂亮的女孩之后，还有一群男孩跳了一个月舞会。", // I was sixth on the list, after a girl who played the violin beautifully and be
  'ac7975c1ee6c6cf8feee0e09fe46a6ec89afe01b5debd17271b8fd3f2229dffb': "我妹妹看了四十遍，仍然不明白它是怎么运作的。", // My younger sister had watched it forty times and still could not see how it wo
  'c86a0f0d6c6a382800c700a53386dffb2d0a0260ee6d89e4dd7ba3758048f20d': "然后我伸手去摸蔡先生的耳朵。", // Then I reached towards Mr Chua's ear.
  '0dcbbaf821aada0e21c458eb4458b1de8e8754e5a813ae9137860779aa064dfb': "我在浴室镜子前练习了三周：左手拿着的硬币消失，然后从观众的耳朵里流出来。", // I had practised it for three weeks in front of the bathroom mirror: a coin hel
  'cd8f825af28454bc6e12fb04f68dc4289694219764ded848aef686d1d3be5469': "大厅里又笑了，但这次是另一种笑声。", // " The hall laughed again, but this time it was a different kind of laugh.
  'efe7b9275a0e4195fe0c5675d306181d61d12ac47cacb158d8e8c59195936d9c': "我说：“谢谢你。", // I said, "Thank you.
  'bbb97ab0b58e3e8acc501ac8642b4ec62f862ca9ff702c3518e7b1bdb77712e3': "美术老师蔡先生走上了舞台，这并不是我预料中的。", // Mr Chua, the art teacher, came up on stage, which I had not planned for.
  '1f81cceff5fd3352192acaae3af51d404320c17f97d8508b10d97562a68e0f3b': "表演在学校礼堂举行，整个中学二年级的学生都在那里。", // The show was in the school hall, and the whole of Secondary Two was there.
  'a562ed6eac7381ae791de402fcfac15dfa2fcdbf2d4ccdc0901e71364da50aec': "我得伸手去摸他的耳朵，手臂一直都在光线下。", // I would have to reach up to his ear, and my arm would be in the light the whol
  'ee546302dda6c41b8d42dda19ce552313ff308f0a12bc04c897674798485baee': "黄太太一个个地从三楼走廊上丢下了设计图。", // Mrs Wong dropped the designs one by one from the third-floor corridor.
  '55a8cf748c88e24adb0cf0c186bb45eaa9d85fd84af43ca962138925b945b509': "考试前一天，她还坐在桌前，平静地把纸张折成细长的条。", // On the day before the test, she was still sitting at her desk, calmly folding 
  '7d9279445ba6f1d798d2cf5c28705a26bb817496acb1efc07362cb728cc667dc': "黄太太用扫帚把它弄下来。", // Mrs Wong had to get it down with a broom.
  '1fb85482b86a257abe3a412ceea4acf1c850cff145d720e48ffa2f7d651f0374': "然后一阵微风吹起它，把它吹到树枝上，停留在那里。", // Then a light wind caught it and carried it sideways, into the branches of a tr
  'a882da77fc9e689ed12ace7c7986055cca959120e37b2d4827fdac166f125a6b': "我最终的设计是一个纸笼中置于纸笼中，蛋挂在中间，挂在八根绳子上，降落伞由两个袋子组成。", // My final design had a paper cage inside a paper cage, with the egg hanging in 
  'b64e61d55dc8817a6620a9a6de42d16a3c3f4fb1031fd56135a3bd088ba7cb04': "它直直落下，重重摔在地上，弹了两下，滚到了墙上。", // It fell straight down, hit the ground hard, bounced twice and rolled against t
  '5e017303592374f16b5874d10a28d8de782da90269dd019f8e3a0d60a33eb552': "我们的物理老师黄太太给了我们一个挑战：保护一颗生鸡蛋，这样它才能从科学楼三楼掉落而不破碎。", // Our physics teacher, Mrs Wong, gave us a challenge: protect a raw egg so that 
  '60991a4f1254595872364903c67a6f9c0127163c3fb10c112e836706eb953b3d': "我读过汽车设计是为了在事故中保护人员，并绘制了设计图。", // I read about how cars are designed to protect people in crashes, and I drew pl
  '2f14242990e809dcb1eaadbfab00b0bf6ed9b460f04b146661f4b02924987294': "降落伞完美打开，两秒钟内它正好按计划缓缓下降。", // The parachute opened beautifully, and for two seconds it floated down exactly 
  'a738a984212b72a0589a60b7169eaa7dec0602a258801f046e73e9766e396279': "坐在我旁边的娜迪娅说她有自己的想法，但似乎并没有怎么努力去做。", // Nadia, who sits next to me, said she had her own idea, but she did not seem to
  'b735a771b141cbe703e4314d22a026d7f3d00228d534c5685d092a46f1d3bd81': "我的设计如今不那么美观了，但我会先在现实中测试，然后才相信它们。", // My designs are less beautiful these days, but I test them in the real world be
  'b01f45fe447b9a4c15fffee8f71aaa545a584e07b31103f0e116db45f4cae129': "考试当天早晨，星期二，全班同学站在停车场，抬头望去。", // On the morning of the test, a Tuesday, the whole class stood in the car park a
};
