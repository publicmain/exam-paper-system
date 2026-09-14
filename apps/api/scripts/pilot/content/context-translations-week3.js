'use strict';

// 首发周例句的中文句意。key 是英文原句的 SHA-256；
// content/index.js 会逐条校验，少一条就立即报错，不能带缺口发布。
// 由 scripts/pilot/build-week2-context-translations.js 生成（Azure Translator），
// 生成后经人工复核。行尾注释是原句，方便审阅时不必回查。
module.exports = {
  '19565ae2a0c5b1dca6b068aa6a3eabc0fb0bdf348caff28ece3dd3904fa4be3c': "第二只鸟在该区域的每一次拍翼都会获得小幅度的自由向上推，因此保持飞行所需的力气更少。", // A second bird positioned in that region gets a small, free upward push on ever
  'b1d116dd765e2cca46b30c685888ce8d818631c5f64e4e436d15575fc3fcf760': "现代的解释是空气动力学，这一结论花了五十多年和大量巧思才得到证实。", // The modern explanation is aerodynamic, and it has taken more than fifty years,
  '86326bf1b0fdf806004a229106510af0efaf641676aa6087e40e8d84e3bbcde4': "成对鸟类反复交换位置，每对在前后停留的时间大致相当，生物学家称之为互惠合作。", // Pairs of birds swapped places repeatedly, each spending roughly as much time i
  '22b86676295ad5e5cdab22dcd60825bf0e8ff69409e34cca2ec260cc0b8c055c': "研究人员参与一个保护项目，该项目教导年轻的北秃鹮在微型飞机后方迁徙，他们为鸟类安装了轻便的数据记录仪，记录位置和每一次拍翼。", // Researchers working with a conservation project that teaches young northern ba
  'e18aea9b09ebb5e3b97a274780abed59f9ebe92d6dffc332225414f450c084fb': "以V形飞行还能帮助鸟类保持视线，避免碰撞，而体型较小的鸟类翅膀产生的涡旋较弱，通常成群松散飞行，完全没有编队。", // Flying in a V may also help birds keep sight of each other and avoid collision
  '2d539732f8ae1ca999456ad3caf26b2a7c9918203092ef784eeb9639d0d709d5': "拍打的机翼将空气向下推，但在机翼尖端，部分空气会卷曲并绕过，形成旋转的漩涡。", // A flapping wing pushes air downwards, but at the wingtip some of that air curl
  'db2925403091480fe38c579c4e33bee8a6dfb19eefad64d9c5057866562783fd': "2001年，由亨利·魏默斯基尔希领导的团队训练大白鹈鹕在快艇和轻型飞机后方飞行，并为它们安装了心率监测器。", // In 2001 a team led by Henri Weimerskirch trained great white pelicans to fly b
  '314a6edd01bbeb15b4453eb91258afc782c832fc5c1b18304372d756ce5d3ac4': "阵型引发了公平性的问题。", // A formation raises an obvious question of fairness.
  '7abf1a0cbfde7623549625da46a2fb2e9fa02afc67b193e910d58412693d60a4': "这些鸟儿不仅仅是在找到合适的座位;它们不断适应周围的空气，这种方式工程师们很难用飞机复制。", // The birds were not simply finding a good seat; they were continuously adjustin
  '4f4219c2cc3bb66d77a31b7e69b13af93f5fbefc597d78a50bbe62ce90aa2786': "美国军方在拥堵的港口难以补给部队，转而求助于麦克莱恩的公司，满载的集装箱运往越南，装满了日本电子设备准备返程。", // The United States military, struggling to supply its forces through congested 
  'c87818883bb2d1ba4bc5d753f04c1cc588ac785c98e417a525d4dcabf8d706a7': "越南战争加速了这一变化。", // The Vietnam War accelerated the change.
  '2a7b343fa617f8fe02ff992411858338572c3ad5f31ed290af28261f08df28ba': "他买了两艘旧油轮，加固了甲板，并于当年四月将其中一艘“理想X号”从新泽西运往德克萨斯，载运了58个卡车大小的集装箱。", // He bought a pair of old tankers, strengthened their decks, and in April of tha
  '77fb8118bad988080bf4243358cc14d8de55865a0ac018ca1105e55081ad1a95': "然而，研究1960年后世界贸易增长的经济学家越来越多地将其与关税削减或贸易协定同等的认可。", // Yet economists who study the growth of world trade after 1960 increasingly giv
  '9734b59a84cc4f307e13ae85d3a88f81346597a65b2843158f5367874c86888e': "在集装箱之前，货物是逐件装载的。", // Before containers, cargo was loaded piece by piece.
  '5e2ac41bee3f196177dd6269e6a93e3dee1080d236b7a8727d1cbbd2533c9051': "对港口的影响极为严重。", // The effect on ports was brutal.
  '19b975e4edbe979966364e7ab1e79a549f2a52a4dbc2edad66a1cb92d2af4876': "集装箱船需要深水、巨大的起重机和平坦的土地来堆箱，而这些是市中心旧码头无法提供的。", // Container ships needed deep water, huge cranes and acres of flat land for stac
  '7904a1d93aeb42ac6eb8ce29a16064db2aa25acc4d3d3637a70bc147a5bc34d5': "这个盒子看起来毫无特色，正因为它已成为现代生活的背景。", // The box seems unremarkable precisely because it has become the background of m
  '808d90bc384e76d5aadf03118bec2894521d6d1d6a01d13ab5a1a6b404ef8572': "袋子、桶、箱子和捆货从仓库运到码头边，用吊带吊上船，再用手工装箱装入货舱，这一过程可以让船只在海上停留的时间长短。", // Sacks, barrels, crates and bales were carried from warehouses to the quayside,
  'e50cb4b4771d0689cce9084a962d5980ec6590715906673144926d418f8aeff2': "盗窃很常见，损坏更甚，装卸费用可能占航次总成本的一半。", // Theft was common, damage more so, and loading and unloading could account for 
  '2eec6aef72a31ca3d41d3b0b7b3c13128b2a7203dee3ff5307fa7fd4e223e532': "障碍不是工程，而是协议，经过多年谈判，直到20世纪60年代末才确定国际集装箱尺寸和角装配件标准。", // The obstacle was not engineering but agreement, and it took years of negotiati
  '7b1c315484297271f193083369a0c259f481228e19c2e8830e7d829cdf8f3007': "它改变的是船只停泊期间发生的所有事情。", // What it changed was everything that happened while a ship was in port.
  '9b12f1300973a3e7df5b4bfa61f96fab373b723750929e2dabc9554ea891f69c': "根据他自己的计算，装载成本从每吨近六美元降至十六美分。", // By his own calculation, the cost of loading fell from almost six dollars a ton
  '828ef33bf234f0e1d88901f4d85e52be98737b877d795b3a448d3ca28faa9a0d': "无可争议的是，它使工厂与客户之间的距离变得不那么重要，也因此改变了生产地点。", // What is not in dispute is that it made the distance between factory and custom
  'e89e4ceed2c3e071a89046d16a59adb0fe88ab66152c6829201ea17586d8ff12': "1968年至1974年间，心理学家沃尔特·米歇尔及其同事对653名学龄前儿童进行了测试。", // Between 1968 and 1974, the psychologist Walter Mischel and his colleagues test
  'bc2daeccb0adc8c8548f5245697306a23d7a89abfc48417f4d338423efe4a007': "奖励多样：棉花糖、小椒盐卷饼棒，甚至塑料代币。", // The rewards varied: a marshmallow, a small pretzel stick or even a plastic tok
  '9d6a917241633a495d3efcf308db31d7f1df7d9fea1b259a1f65d9b4c9d2a7f8': "一旦研究人员考虑了家庭背景、早期认知能力和家庭环境，这一比例缩小了大约三分之二。", // Once the researchers took into account family background, early cognitive abil
  '6679ebc978669a146ee51de71ad48d368852808b441d540d2740929849f19dc5': "心理学中很少有实验能像棉花糖测试那样在大学外广为人知。", // Few experiments in psychology are as well known outside universities as the ma
  '2cf39f6911dfa7c63bca95e96ee8d4594c633d274a9d672bceaa4f39d6211941': "斯坦福的研究揭示了许多帮助幼儿抵抗诱惑的方法，比如将奖励藏起来或转移注意力。", // The Stanford studies revealed a great deal about what helps young children res
  'c2448486aa63b78994931c803e2fde6f1c1426967f40224fa934298cf62ef25f': "条件也一样：有时零食完全暴露在眼前，有时隐藏，一些孩子还被给出分散注意力的点子。", // So did the conditions: sometimes the treats were in full view and sometimes hi
  '59e647e5581d9f715258c2c81f645e438d97301a78cf33b9ae53326cce57121e': "他的学习始于斯坦福大学校园内的一所幼儿园。", // The studies began at a nursery school on the campus of Stanford University.
  'a4c7edbf9da387aa278718193dd68b17dd9f311360d8ba1cd2f4bb7f73324694': "事实上，情况正好相反：2000年代的儿童平均比1960年代的儿童多等待约两分钟。", // In fact, the reverse was true: children tested in the 2000s waited about two m
  '9d2e61502c582a4916f978bd87a3dc1dca016661b9599a5c5e988d52471ce2a4': "研究人员认为，一个迅速妥协的孩子，可能正在做出关于承诺是否值得信任的明智决定。", // A child who gives in quickly, the researchers argued, may be making a sensible
  '9b23684048c3cf8c590c110dc4d44d519e8a5a955a4d8f9df8cc51f81300769a': "故事很吸引人，但背后的研究要复杂得多。", // The story is appealing, but the research behind it is considerably more compli
  '1d0a803548d51e0db856e78fa5d6d8a1e4c1a9a63d1449b872586dc727663913': "四岁半时，孩子们被安排了一种等待任务，七分钟是被要求等待的最长时间，他们的学业成绩也被重新测量为十五岁。", // At the age of four and a half, the children had been given a version of the wa
  '82d0a3c92e0917265a27a224044fccddd4f531c6adca7480abc1ea6d1fd99fff': "孩子等待多久，似乎不仅取决于性格，还取决于环境：他们成长的家庭，以及周围的成年人是否守信用。", // How long a child waits, it seems, depends on circumstances as well as characte
  'f4abbc577eeab658f9b6f8d8b04dbd44099969635904a64976efc6aa0ee6a2a5': "最初的目标不是预测孩子们的未来，而是理解是什么让等待变得更容易。", // The original aim was not to forecast the children's futures but to understand 
  'bbe6dab465965edfd5863118186b22ac45e4f8985e939df9281dfad47261d77d': "分析对象超过900人，团队特别关注那些母亲未完成大学学位的儿童。", // The analysis included more than 900 children, and the team paid particular att
  '6064ad25a74c44ebf0c6d545db107da77d03a5f078eb21ac96ad3dcae5447bac': "尽管如此，许多地区的使用率仍然偏低：2023年撒哈拉以南非洲，只有37%的腹泻幼儿被给予口服补液盐。", // Even so, use remains low in many regions: in sub-Saharan Africa in 2023, only 
  'f3be2ed37dedbcc75cd2f33af576c66549958aeb847a5e8efc72ee0dcac2f5e7': "霍乱和其他腹泻性疾病传统上主要通过脱水致死：身体失去水分和盐分的速度超过了它们的补充速度。", // Cholera and other diarrhoeal diseases have traditionally killed mainly through
  'f5821650346159533c48a92b1bec42036748fb67c05cb60f82a73c64875956bc': "锌补充剂可以将发作时间缩短约四分之一，现在建议与之同时服用。", // Zinc supplements, which shorten episodes by about a quarter, are now recommend
  '4f7941148762bb193eeb37dd51a783b4f7eab4b124f36e45451d6c9d86c55282': "然而，滴注需要无菌液体、设备和受过培训的工作人员，而这些在霍乱最严重的地方往往稀缺。", // Drips, however, require sterile fluid, equipment and trained staff, all of whi
  '2bed0365be4a9d0500cde48f16d53d154ea22c2a958d191e397771878c634b22': "它认为，小肠能够同时吸收盐和糖的发现，可能是本世纪最重要的医学进展。", // The discovery that the small intestine absorbs salt and sugar together, it sug
  'fe8fdb93b1a716d6f924bb2e056dd36f0d69d5cea8279764b0c14587c6792d5c': "早在1832年，爱丁堡的一位医生就将盐溶液注射到霍乱患者的静脉中，到了20世纪，静脉输注已成为医院的标准治疗方法。", // As early as 1832, a doctor in Edinburgh injected salt solution into the veins 
  '317cdcf8368e267f98ae8c84e4519a71def59545408b6822aec36d613cc152fd': "替代方法的关键来自20世纪50年代末和60年代初的科学研究，显示肠道会同时吸收钠和葡萄糖。", // The key to an alternative came from scientific research in the late 1950s and 
  '2af228434bbdd9499931877ebc4245126f6d86628911a788985bdb5d4c055915': "当葡萄糖分子穿过小肠内壁时，钠随之移动，水则通过渗透作用跟随而来。", // When glucose molecules pass through the lining of the small intestine, sodium 
  'd40dfe25e2ce014a2d546ddfd80bf23195fed4275d74738676d75fedf0bd1a4e': "根据世卫组织的数据，每年仍有约44万名五岁以下儿童死于腹泻，而越来越多的死亡被认为并非由脱水引起，而是由体内传播的细菌感染引起。", // Diarrhoea still kills around 440,000 children under the age of five every year
  '71b743764bb200a5f9f8718a54079739474d7853439bb91f15965a4392b2f254': "自2002年以来，世卫组织建议采用较低浓度的配方，这不仅减少了腹泻的量，也减少了呕吐的量。", // Since 2002 the WHO has recommended a less concentrated formula, which reduces 
  '7571afd478c66e6e3bd971a3edf4661063d4ff3079b2d65c5a0c02ff552565ac': "大约在同一时间，印度加尔各答的研究人员报告了类似的结果。", // At around the same time, researchers working in Calcutta, in India, reported s
  '7c1e72d2f9a17d44e9e1688d9f5a2dbee07370e8f3a53b60811521f5f75a7b80': "1978年，世界卫生组织启动了控制腹泻疾病的项目，口服补液盐包装很快大量生产。", // In 1978 the World Health Organization set up a programme to control diarrhoeal
  '7d61d5c488c20bb8562df42e123f75a739c36626053a00acf75a514cd2584330': "1950年，气象学家朱尔·查尼和数学家约翰·冯·诺依曼组成的团队利用ENIAC这台最早的电子计算机之一，对未来24小时进行了四次预报。", // In 1950 a team including the meteorologist Jule Charney and the mathematician 
  '0edf5e24ee17d111872fe67c7cf849d6b5eac9d18d1feb1f29a31a697d882420': "问题出在起始数据中，包含了小不平衡，方程将这些方程转化为大气中巨大且不真实的波浪。", // The trouble lay in the starting data, which contained small imbalances that th
  '82bd29b0eb49964d709791f58f38a5ded8e520513eb8a9f27d3e9f6befcdd90d': "自1992年以来，欧洲中期天气预报中心运行“集合”：数十个从略有不同条件出发的预报，其一致性决定预测的可信度。", // Since 1992 the European Centre for Medium-Range Weather Forecasts has run 'ens
  'ca576385d2a082bb6dcbeb9a2c6e45697c26290d174b0ad6ad158bb0159cd5cd': "506，打印出来的圆角数字。", // 506, the rounded figure shown on a printout.
  '819191f869b3abcd1e6028cb72f10021e433b2ecc7bc0d003f2624803503bf37': "预报员们已经学会了接受这一限制，而不是去挑战它。", // Forecasters have learned to live with this limit rather than defeat it.
  '6f9f32775e21efc0294f4625cd6700a70b94246d86e0123f76eb73424407718e': "2006年，气象学家彼得·林奇重新计算，证明该方法本身基本是可靠的。", // In 2006 the meteorologist Peter Lynch reworked the calculation and showed that
  'a83db82ec22adf61495d7eec1431183384ae0eebeb792263f33907dfe858179a': "1961年，麻省理工学院的气象学家爱德华·洛伦兹在部分过程中重新启动了天气的计算机模拟。", // In 1961 Edward Lorenz, a meteorologist at the Massachusetts Institute of Techn
  '25e471e6829261fda26e88420490ff4acd62e56ae11584ec69ad3ac8a5b49fcd': "第一次世界大战期间，英国科学家刘易斯·弗莱·理查森在西线的救护车部队服役。", // During the First World War, the British scientist Lewis Fry Richardson served 
  '2d9898766b58390fb2c3f3548b734ae9806616c23dba3229aa6ff790bbba3b1d': "根据2015年发表在《自然》杂志上的一篇综述，过去四十年中，预测大约每十年多增加了一天的实用准确度。", // According to a review published in the journal Nature in 2015, forecasts have 
  '0cda46571b64d208ba32b613359a735bdabb581c75fa309579af045c4cbd193d': "作者称这一进展为“安静的革命”，因为它源自科学知识和计算能力的稳步积累，而非单一的重大发现。", // The authors called this progress a 'quiet revolution', because it came from a 
  '3f7ecfea29d3351a6062fc9951981c854cf9e3443f875ae8d1bef75c1adb5e40': "他推理说，大气遵循物理定律。", // The atmosphere, he reasoned, obeys the laws of physics.
  '7a254a6075a4f71d45150332f1cc9fa50994469962cfe840f1199d3f069a078b': "指挥员会在中央的平台上用光束向那些领先或落后的人发出信号。", // From a platform at the centre, a director would use a beam of light to signal 
  'f9c3bbc43dbc4e5db142182cb27cd09fcbca08e48b89b009bb02dd09a5a9adca': "光是算术就花了他大约六周的时间，而且时间长得多。", // The arithmetic alone took him about six weeks of working time, squeezed in ove
  '4121a96b9ad942d2dc5d395ceddbcf7a83ca79dd9bf72e99b12fb20b42e1c85c': "这些预测总体上是合理的，虽然绝非完美。", // The forecasts were broadly sensible, though by no means perfect.
  '8cce945d52e63f915ca58d197e5279627e53a48f530844ca230539c6185ac0e8': "在那里，他追求了一个非凡的想法：天气可以被计算，而非凭经验判断。", // While there, he pursued an extraordinary idea: that the weather could be calcu
  '7f96be32c8b5b8f8c5f04c55e57c336fe506613b495c28a0b21206bf4c899d8a': "为了验证这一想法，理查森于1910年5月20日对中欧记录的气象观测数据完全手工计算，计算接下来六小时内的天气变化。", // To test the idea, Richardson took weather observations recorded over central E
  'f26baa7947f82bf782cb7b59e07081f9d4ee556dda4cf778e3c43d46e7ed2a49': "如果能准确测量其当前状态，那么描述压力、温度和风的方程理论上可以解出，以展示其发展过程。", // If its present state could be measured accurately, then equations describing p
  '2e1af42f4a67503f057a8b3cb507a1ef90b9b0b3634758f3ae5ea991e429dc11': "他将劣质石墨研磨成粉末，混合粘土和水，压制成细棒，放入窑中烘烤。", // He ground poor-quality graphite into powder, mixed it with clay and water, pre
  '4b034a8bfbb81cdf236ece41b7625eee5c4b4f3afbe6ee8a7c98c4a9b06c5e1c': "灰色核心是石墨，是一种软碳形式。", // The grey core is graphite, a soft form of carbon.
  'b96e1df12e081af751aabb848f393cc386a2ea4ed589d37224cf9d0ed73818a0': "大约两百年来，英国几乎垄断了优质铅笔。", // For about two hundred years, England had something close to a monopoly on good
  '861f7b033c02ff0d312df55a812a6375e6191a649027c3a9f8f868303824aa05': "这就是今天铅笔上仍印有字母的起源：H代表硬，B代表黑色。", // This is the origin of the letters still printed on pencils today: H for hard a
  'f7bb85f03aa57d25bc751302e7fdfeb258aa30b3806f6df909b02c25d5ec8e56': "更多的泥土会形成坚硬的浅色线条;更少的泥土会形成柔软的暗色。", // More clay gave a hard, pale line; less clay gave a soft, dark one.
  '3828a1a12c16209de8eaae6deb5b1333b7d3dd1a096413e8d0ad4bbe7b52ce3e': "矿井价值也足够高，需要守卫：矿井每年只开放几周，盗窃成为严重犯罪。", // It was also valuable enough to be guarded: the mine was opened for only a few 
  '15f4ab34be2fd798ebde0b954662da473057408a4cce42dc53773768a0ce63be': "尽管名字如此，铅笔“铅芯”中从未出现过铅芯。", // Despite the name, there has never been any lead in a pencil 'lead'.
  'e114a87d11141d717658a86a5c3643776148115ae40815660425db15aa10f1f7': "1795年，法国与英国交战，无法购买英国石墨。", // In 1795, France was at war with Britain and could not buy English graphite.
  '0a534e432a70705cef66730f102ca2d48381f72c50d3c1c297221b43128f0688': "博罗代尔矿于十九世纪末关闭，其最好的石墨矿也已耗尽。", // The Borrowdale mine closed at the end of the nineteenth century, its best grap
  'c65eb0d4e05ff41bd9816a47c0496ac1df0cca5dd08d389a7dcd21ec4c1e0eb2': "一位法国工程师尼古拉-雅克·孔泰被要求寻找替代者。", // A French engineer, Nicolas-Jacques Conté, was asked to find a substitute.
  '3dfc483bc907704db67eddc4ee5b96be0ef223c066ae6134d3318b66399ab967': "相反，它们可以被撕碎回收制成塑料制品，如花盆。", // Instead they can be shredded and recycled into plastic products such as plant 
  'a274675503da26592bec1df75d1e687369dc378b5813a13d57ba0cf4e05cb45c': "聚合物香调的持久时间是两到三倍。", // Polymer notes last two to three times longer.
  '0d263d07ea8f16aaf6aa388fa371731acb60d3f5e8a1e07b3c13a5452b4d218a': "这张钞票是对国家央行多年来一直担忧的问题的回应：伪造。", // The note was a response to a problem that had worried the country's central ba
  'af1a5b2486df3e315d1ba4ce9b455263373ef0628f8a9fd0ce4dd655e42a6485': "尽管名字如此，纸币通常由棉纤维制成，且磨损迅速。", // Paper money, despite its name, is usually made from cotton fibre, and it wears
  '15812fc990c107d7ca1e8fb6774317e2d66fa8575bd5ce00f9667ab2930b6c15': "它不是印刷在纸上，而是在一层薄而柔性的塑料薄膜上，并且有一个小透明的窗户，任何复印机或家用打印机都无法复制。", // It was printed not on paper but on a thin, flexible plastic film, and it had a
  'f60952ab2f3d8c6b7675d509bea80a4965ca84ae83879f372fdff31a0bcf2686': "由于聚合物钞票寿命更长，印刷量减少，从而减少能源消耗和浪费。", // Because polymer notes last longer, fewer need to be printed, which reduces the
  'b98a809defa01a9137640224bd1037a73d97a21a85668e64f3e98a1e9600fcc1': "新的聚合物钞票容易粘在一起，导致数值困难，有些人抱怨纸币无法折叠放在钱包里。", // New polymer notes tended to stick together, which made them hard to count, and
  'da022671963249fb5dbb9e1c8a251e94b598901826a44f6ebadb2efa4db754dc': "价值较小的钞票每天多次易手，可能仅能使用几年，便会变得过于软弱、撕裂或脏污，无法使用。", // Notes of small value, which change hands many times a day, may last only a few
  'a8b3aff69937fb2ddce0dd58e9ffab0e92bc269b2750f5a03f8fc6f4cdfe02c9': "现在已有三十多个国家至少在部分音符中使用聚合物。", // More than thirty countries now use polymer for at least some of their notes.
  '85f842392e037e8d4b7cac2c3a3d6f1d7ce6412ae9a88ddbc681030646c9d5b1': "1988年，澳大利亚发行了一张前所未有的十美元纸币。", // In 1988 Australia issued a ten-dollar note unlike any before it.
  'faa11150892ae27fce92e8323c44d83fcfc14ba875282939ac19d8c322d78253': "尽管如此，这个想法还是传播开来了。", // Nevertheless, the idea spread.
  '5cecdf097b68db29f7550d0cf9927209b8e9c6792da15a5aaf21e0e6e649cbc4': "传导和对流都需要物质颗粒来传递热量，因此墙壁之间的空隙几乎完全阻挡了它们。", // Conduction and convection both need particles of matter to carry the heat, so 
  '70cab25cc0d10bcc8ce74cb288c242c04151a544383f0e102a53c1517d00b3bd': "把同样的汤倒进真空壶，几个小时后依然可以保持热。", // Pour the same soup into a vacuum flask, and it can still be hot hours later.
  'cf71dde217e501dfd95793cdaebb643417e90d4b44e6e4dafbf211cd7885d610': "杜瓦从未为他的酒壶申请专利。", // Dewar never took out a patent on his flask.
  '560af299ff0c45f37b16c39b06a65a03d5d42e517c1bc3cde02e1c0abb76dbb4': "1904年，两位德国吹玻璃师发现这一想法在实验室外也很有用，于是开始销售用金属盒保护的饮料瓶。", // In 1904 two German glassblowers saw that the idea could be useful outside the 
  '62bcccd827e628a6f3ca58061924df9d4d805c5ccd1a11bd625d815a55c13c09': "酒壶由苏格兰科学家詹姆斯·杜瓦于1892年发明，他当时在伦敦皇家学会工作。", // The flask was invented in 1892 by James Dewar, a Scottish scientist working at
  '437531d400e45224f224215a9e268a589fa877332f5f4d9036fb6674ad62748b': "其弱点是琴颈顶部，颈部和塞子处没有真空。", // Its weak point is the top, where there is no vacuum in the neck or the stopper
  '17cfbe5ace45150c1aaa86c7aa575becee7b86e18f99bb7fe5b1c3bc8ff928b0': "他的设计是将一个玻璃瓶装入另一个玻璃瓶中，两者仅在瓶颈处相连。", // His design placed one glass bottle inside another, with the two joined only at
  '0cef7a4590226381b85defa650f4b9639e027b27aaefdb6d462c60efebad9d71': "他研究的是只有在极低温度下才会变成液体的气体，他需要一个容器来防止它们升温和沸腾。", // He was studying gases that become liquids only at extremely low temperatures, 
  'db982a40a872d6b4965a518a71e1216eda5d96562f8128091a1a003f62ab8dd5': "把热汤倒进普通瓶子里，很快就会凉了。", // Pour hot soup into an ordinary bottle and it soon cools down.
  '3560099f6ec21ee6ec47099515bcda48e629961b65041f2daf2a3fc03c181ddd': "小鼠等小型哺乳动物会避免果实，通过它们体内的种子也不太可能生长。", // Small mammals such as mice avoid the fruit, and seeds that pass through their 
  '806a7e6c92d0bff9a2e932b786fb7532fc538244365ea00040bdb2b7afbc2cf5': "口腔中的神经细胞携带一个传感器，通常会警告身体危险的高温。", // Nerve cells in the mouth carry a sensor that normally warns the body about dan
  'f7e627b303778a4aa84716d8bb981be1028c22ce8e9cb91f09138cafd4bafb44': "牛奶效果更好，研究表明牛奶的脂肪和蛋白质都有帮助。", // Milk works better, and research suggests that both its fat and its proteins he
  'd0e10c2d45cc06afdcbce9bd1d90d7194f7ed9b7d1efdd42969f6fcf8e6c6728': "这个技巧由一种叫辣椒素的化学物质发挥作用。", // The trick is played by a chemical called capsaicin.
  '45fdbefa9b55e990538415f9ec1aa2ec7c1de4bb45cc4c2c62e44aceda4578da': "提取物稀释得越多，得分越高。", // The more the extract had to be diluted, the higher its score.
  '7a79a59f7dc4f9326eaa114b55033454093835ca2e3f1ca8c1f3918da2fdbca2': "辣椒精被反复与糖水混合，直到大多数品尝者都感觉不到灼烧感。", // Chilli extract was mixed with sugar water again and again until most of a pane
  '035b03366875b2c5cdbdcda31f0a407edd90c45681d850269071157bf156c89d': "它们吃果实，种子毫发无损地传播。", // They eat the fruit and spread the seeds unharmed.
  '34dfade6594c3cfef577d41f044a8b59d00cb62bf15152b30e26ead0d7002441': "辣椒最早生长于美洲，十六世纪时很可能由葡萄牙和西班牙商人带到亚洲。", // Chillies first grew in the Americas and were probably carried to Asia by Portu
  '9f205a7917ff8c79c6a265a1cf762c151d73e272988385a410c5b85c5babc641': "自20世纪80年代以来，实验室开始用机器测量这种化学物质，但结果仍可转换为斯科维尔单位。", // Since the 1980s, laboratories have measured the chemical with machines, but th
  'e2d58be152edbbf1a226aefedd92a636e257fdcbf38a07c4570bfda5809aac5c': "1990年代末，美国科学家大卫·朱利叶斯利用辣椒素鉴定了该传感器，这项工作后来为他赢得了诺贝尔奖。", // In the late 1990s the American scientist David Julius used capsaicin to identi
  'ed7732c48888aeea9fab1cb1bd07f0dd0af064a5708c11e52389b2c779692907': "1912年，一位美国药剂师威尔伯·斯科维尔发明了一种测量这种热量的方法。", // In 1912 an American pharmacist, Wilbur Scoville, invented a way of measuring t
  '73d4750a43f4697e30ded22ac4d4d3f4688984726aad337d74285387aace2f39': "为什么植物会产生如此令人不快的化学物质？", // Why would a plant make such an unpleasant chemical?
  '602aafb87cc583c36a7b3b4c10b3865f9e170abd21c49acfb54ef94bb4938d25': "当温度超过约43摄氏度时，它会被激活，这个温度开始受伤。", // It is switched on by temperatures above about 43 degrees Celsius, the point at
  '82d120925827352d6ee292748e050e1c5cc50411edf19ac5d7ffb2ff70e2a20f': "倾倒废水的企业被迁移，建成了完善的下水道。", // Businesses that had dumped waste into the water were moved away, and proper se
  '25793ad993d71e33cdc6bbc8ddfec25bf1295c9a6203ec7c0830a7d028745e42': "此后，水獭沿着岛上的水库、运河和海岸线扩散。", // Since then, the otters have spread along the island's reservoirs, canals and c
  '32fcf02c0f44fcb212aaac1d5ccd518094d7532c29f3a606409de01a859dec4b': "到了1970年代，野生水獭已在新加坡消失。", // By the 1970s, wild otters had disappeared from Singapore.
  'e1958eeb593aaeb55808036540b4397134e4bdb168a9fce7169f86c9ea2982c8': "只要严格遵守这些简单规则，拥挤的城市就能与邻居共享水道。", // Followed carefully, these simple rules allow a crowded city to share its water
  'ddc2ee2f9fd3c6ab7baa7e5a851b1d8988337081390ad7cf79cc8d1c02a23e62': "2015年，圣淘沙岛的房主发现水獭已经把锦鲤池里的水喝干了。", // In 2015, homeowners on Sentosa found that otters had emptied their koi ponds.
  '893651ac9e842425dfb4dbf325607dc64b491575dd6cc1e26103a1d67b8c900e': "国家公园管理局建议人们远距离观察水獭，并紧紧控制宠物。", // The National Parks Board advises people to watch otters from a distance and to
  'c74d6bc3b4f53e9a1432062e7a0429404233400a68a46e2be2d45b55c502fc0b': "邻近群体有时会为领土争斗。", // Neighbouring groups sometimes fight over territory.
  '7c0e6d71fab2394f07e1b735ab9caedf2f61605419c1b46332246bf6c45ec73a': "如今，光滑毛水獭的家庭游过滨海湾的办公楼，在运河旁休息，甚至穿越住宅区。", // Today, families of smooth-coated otters swim past the office towers of Marina 
  '0501c1bfa3ee7f0833c7f07692db56bba292348d57c20d1a04694c4523164dce': "2020年至2022年间，向国家公园管理局报告的水獭数量翻了一番多，尽管大多数只是简单描述了目击情况。", // Reports about otters sent to the National Parks Board more than doubled betwee
  'e7b68e630aeebbf78e84377c81498a4dbd8c2a5c10b3a9af3d3478f3d8b3f378': "他们的回归始于清理工作。", // Their return began with a clean-up.
  '91f9cb532048b806506e859dfd3921a2efc786c9b680920750f3468fe5ac91ed': "有些小组只有一对，而最大的小组成员超过二十人。", // Some groups are just a pair, while the largest have more than twenty members.
  'f54db6f53495029c6b2fb32410548d8aedaeeef747643958e15a7e137d170467': "2017年的一次统计发现至少有79只水獭。", // A count in 2017 found at least 79 otters.
  '0b8035a1be190598eff2ffb467ef5f1cbed866a77951872f7370171f2f878845': "有少数人被咬过，而带幼崽的水獭尤其具有保护性。", // A few people have been bitten, and otters with young can be especially protect
  'e030882d673fe3add66102a274e39e1df159ce1542fa9f16e4be5ca35d45cafa': "我们班后面有一个鱼缸。", // Our class has a fish tank at the back of the room.
  '146480349684e299bd62a2f512db7fad35476f0b0c078c18bf668a0d699fb41a': "黑鱼在城堡里，睡觉了，或者做着鱼会做的事，而不是睡觉。", // The black fish was inside the castle, asleep, or doing whatever fish do instea
  '95e7b99ccb944956722569fffe795d27b1bd33d07607dd3545cb4f550419584f': "那是去年拍的同一个水箱，角落里的小石头城堡里伸出一条小黑尾巴。", // It was the same tank, taken last year, and there was a small black tail coming
  'b1c249aaacc493ddf8dc07b4edd518259b5fe818821089c4d5b256150710a08c': "周三我数了四条鱼。", // On Wednesday I counted four fish.
  '6ab8d1019b12c17a7627520234b8adc1d4d8baebc5526025b35bf941655d5ff6': "我看了看植物后面和石头下面。", // I looked behind the plants and under the stones.
  '0b702dfb5a2fe2a5f2050683a089c170873c929d77805b84c47f3544d3cdd6cd': "周一一切都好。", // On Monday everything was fine.
  '24e4db69f8f67883fa037f22c61b01a5935c89e0c9eeaf4e763627716ed2786b': "里面有五条鱼：三条小橙色的，一条黑色的，还有一条我们叫船长的胖灰色鱼。", // There are five fish in it: three small orange ones, one black one and one fat 
  '709de39ac08d5dfb8b1899cb9aa0c9ffb18d0bac8f7f0b3ca38e0ec53a2e1a1e': "十分钟后他接了电话。", // He answered ten minutes later.
  'bba99ee35a7779540df170c97f581a480e235fd73732d848cc861ebfcb40ea4e': "现在，我数的时候总是从城堡开始。", // Now, when I count them, I always start with the castle.
  '183d30799a0586708561405b3a8ed5588d1ca0a886198376d995b79dd89e58eb': "我给它们一点食物，看着它们吃东西。", // I gave them a little food and watched them eat.
  '532b6d60188cc23082d2d6d0029d74bf6d8c74f25993077a9086d448e859c8a9': "我给他发了一条信息，附上了水族箱的照片，并写了句“我非常抱歉。", // I sent him a message with a photo of the tank and the words "I am so sorry.
  '4a7b74cfec54cedea055e8291aa53a5eb386f26a090e1618f142bcaf53145d32': "我本不想告诉谭先生，但我还是告诉了。", // I did not want to tell Mr Tan, but I did.
  'e9fe4e5d522c4bf01213786ebac12235c0018dee7558a61da6579f57de83b2cd': "看看城堡里面。", // Look inside the castle.
  '196658a8681fe459ad999a1b6903ee853a769f56c117b1fe51ab3acd86979445': "谭先生问谁可以在周一、周三和周五来喂他们。", // Mr Tan asked who could come in on Monday, Wednesday and Friday to feed them.
  'b05a969d944bc7c095a03edae1af5628dd27e8f8409b9ce40b2353ff4e8896e0': "阿里夫独自坐在食堂里，和我的盒子一起。", // Arif was sitting alone in the canteen with my box.
  '5feffa2eef9d3712d094bd1164984cbbe08c18f0ea95b505796e7843103e3b45': "它同样是蓝色和白色，但上面贴着一个小火箭的贴纸。", // It was the same blue and the same white, but there was a small sticker of a ro
  'f4f0b82fd85057ef6b94f8fbb23dbb1c83970751fa38d347c89b6203247d3811': "现在，每周二我们都会故意交换午餐盒。", // Now, every Tuesday, we swap lunch boxes on purpose.
  '9647bb3d5c85be8da7cfb9130010cdacc89e1baf1e7945d3a10f57365cbfe6c8': "直到上周二我们才知道这件事。", // We did not know this until last Tuesday.
  '54c671aba2fdc934da9ac218aba1b7f60650ca5cfdf1ec3240469c2241e26f48': "上面写着：“今天吃完所有东西，放学后有足球比赛。", // It said: "Eat everything today, you have football after school.
  'da828aafca7cf7c3e19c374ccf581f3f96afe9b40babf437624e81c09eebfc36': "我沿着走廊走着，高高举起盒子，像是在示意一个信号。", // I walked along the corridor holding the box high in the air, like a sign.
  '521ec98352e2d78e273fc01384e8e21efb2d841ddbb1f9cf2792f1be2358d6d7': "“我告诉他我也吃了他的面条，他笑得不得不把头埋在桌子上。", // " I told him I had eaten his noodles too, and he laughed so hard that he had t
  '32788e66796bba25a5fa2784026643226b6fa66a856d4c7685a7399816fe2e7e': "爱你的，妈妈。", // Love, Mum.
  '6611c4aa74f538c92627b2bb814c7bf17442db0a7d45215e46bb20be879e7eda': "午饭时我打开盒子，发现是面条。", // At lunch I opened my box and found noodles.
  '82647c7210e53754d3dc9f802549aba55cb75be7b2bd4acf7ae0aa84992e76f7': "另一个班上一个叫阿里夫的男孩也知道。", // So does a boy called Arif in the other class.
  '316f50159c651c026e88be9620f7f64f8fb0c0dacf923eaf0cec4a2da0d05aa2': "我不喜欢面条，我妈妈也知道。", // I do not like noodles, and my mother knows this.
  '74631a2fa31bfa727f3af3002747d21d233fb6c62fb50a13e37d9d5a438bab32': "两份名单贴在大厅外的公告板上。", // Two lists went up on the notice board outside the hall.
  'da60427dcc5b83a75e224bad60f1061c87960b94a3a3fff205b2131ab9217be9': "她说足球名单已经满了，但歌唱俱乐部需要更多声音。", // She said the football list was full now, but the singing club needed more voic
  'fc06dbf2f1d6f26c7bf004345639430739c5528e947d6a5a7f93e67dfdd06511': "我没明白。", // I did not understand.
  '1bc209cfaf91e69edd4cfb28f92b169dfa6f5c7db34d1e23c00c7438ff9358c8': "第二周，我们每个人都要独唱一小段。", // In the second week, we each had to sing a short part alone.
  'dc12fe079c096909aca5d3a2085fe6df9bf83af2305ad3b52f24f4e3daaaabec': "我告诉林女士那是个错误。", // I told Ms Lim it was a mistake.
  '1bd94a7e1a4ee8e9b93dc2709bae49a026ec75aa9a166748685811fa34d387c8': "我的声音很小，但没人笑。", // My voice was very small, but nobody laughed.
  'dc8fffbb832f8c385b86ca7b625db795b79bd50a44bbee696270a8713ce219f8': "明年我会先读书单上的首位。", // Next year I will read the top of the list first.
  '5f183495af11a2e1bf36fd21aecb15fb8ce970e5856ed70a60fe5140ca3e5ade': "我的名字是最后一个。", // My name was the last one on it.
  'c578ae5a095a112ba7dcea53abe20f23be96433a249f7dff71576fc1c01d3d6a': "第一次会议时，我坐在后排，没有开口。", // At the first meeting, I sat at the back and did not open my mouth.
  '3ec4aa3ca0e1e39c4c37175dfb1d7d758e1a1d84d4ec42765eadce570cca1e7d': "我甚至在家里洗澡时唱歌，直到我姐姐叫我停。", // I even sang in the shower at home, until my sister told me to stop.
  'a5d5f778f56e8d56c59da4055383f24ebe399c2d46d7339bee895c1782a1803a': "七月我们在学校音乐会上唱歌，父母坐在前排。", // In July we sang at the school concert, and my parents sat in the front row.
  '1607e47c4d9600952e89ee65257cd3de2b03cd015e6ce0086ff43c01ddc05ff9': "上面用大字写着“歌唱俱乐部”。", // It said "Singing Club" in big letters.
  '580ea655547d21cbab599e9f3c0e915c7d41c69c8200f5a691b279160c1bfb1f': "周一早上我上课迟到了，于是在看到的第一张名单上写了名字，然后跑开了。", // On Monday morning I was late for class, so I wrote my name on the first list I
  '7e0193e51a5a21dca28a903ad46f9d83ca2a4a23dc3397b95480013c0f189a7d': "我会再把名字写在歌唱名单上。", // And I will write my name on the singing list again.
  'a50bd576641c53161e3a1492aee6b8fef332fc8d95b5536a94a13965dcd3956e': "要加入社团，你必须在其中一个社团上写下你的名字。", // To join a club, you wrote your name on one of them.
  '8d0dee28cb8a9f7a252390218230167d86b46176ce63b6c46a4a07eb5c18438a': "我回去读了清单上最前面的那个。", // I went back and read the top of the list.
  '21bdeb8e6f1327cea81bb4164d6389dec10f5a6a8b3433c4a9ff3e5c4c9ad611': "我们坐在长椅上等着。", // We sat on a bench to wait.
  '337487acdf75d8e403d125db306bec93e11253d1aeae544efd08d41e9b22487e': "我给他看了火车线路的地图，我们一起数车站。", // I showed him the map of the train line, and we counted the stations together.
  'b47795018842bfae15f74dad04426fdc1beafa24b4c61f7248d835b89013765c': "在火车站，我看到一个小男孩站在大门附近。", // At the train station, I saw a small boy near the gates.
  '592b436c9e9e3891f74c7c28c1e0d1f00e02cc845d3940cbffdd004d543730b3': "许多人从他身边走过，但没有人停下脚步。", // Many people walked past him, but nobody stopped.
  '48f0f48af3614101032b9d6a74dd4f1c8bd0967db9008be63046efcb58e5bbf4': "“他母亲在下一站。", // "His mother is at the next station.
  '5917ff03ab6a1dfe693b18a42595440ab3be516c2f6c911e637a58777fc23c3c': "上周六我正要去上美术课。", // Last Saturday I was on my way to art class.
  '7b8f778dbf76d3eb3542ea7286dd50f6350a7a1b445a4b3b716180644973a015': "但我知道站里的人能帮忙，所以我牵着他的手，带他去了那里。", // But I knew the people in the station office could help, so I took his hand and
  'c84a09757b7151560a3d7ded26f00a04aea0d8a32704e55a53f3fcc7a9e833f2': "我把事情告诉了老师。", // I told my teacher what happened.
  '2fb69ae019c628324946d1e5e71e76ba7f6589ce34479a89acecba42361f318d': "她紧紧抱着拉维，一遍又一遍地对我说“谢谢你”。", // She held Ravi very tight and said "Thank you" to me again and again.
  '5438143b4dbb693da64edd1144b029524b3bd7c8ab2077c71023d1fc335bbfdf': "几分钟后，一名女子从下一班火车上跑了下来。", // A few minutes later, a woman ran off the next train.
  'e0c8dd2f1de5b587341e8900eb74f954d18968053656a3d66899a985f10fbfcf': "课程十点开始，老师不喜欢我们迟到。", // The class starts at ten, and our teacher does not like it when we are late.
  '54c6d1d38548a5f9802d1ce9ec08b9bd9a05c470fb1e6185fd9b1dd66edd33e2': "很快他就不再哭了。", // Soon he stopped crying.
  '88a2698a6ebf638057597a251c2af803b5c6601926a09983b2651bc97385bba8': "我看了看墙上的钟。", // I looked at the clock on the wall.
  '862e09d13f12078cdfa22f42e53a4b7e1d0d8f2839b2baaa216594f9d809e93f': "然后她说我可以下课后留下十分钟完成我的画。", // Then she said I could stay ten minutes after class to finish my picture.
  'c428bfeb75908174b7576d0aa4a664ca4e4c6757a15369a96ca87577d10ae35c': "请和他一起在这里等着。", // Please wait here with him.
  'f0fb22b82262adacbaa965c0a031299cb3f38de6ca8e686b053bc8ce8c235633': "“门关上了。", // "The door closed.
  '20b1b157bdbed9ac3f40f6561a4fca4462fad90405f05c045f1a56078dc7ad77': "妈妈告诉我，莉娜已经不再在学校买零食了。", // Mum told me that Lina had stopped buying snacks at school.
  'eab2a17a8ae40aced6220a3a1e8c6a9ffaa65aba8a0bde4f8add3954645be9b8': "莉娜坐在地上，把硬币放进一个旧铁盒里。", // Lina was on the floor, putting coins into an old tin.
  'c709b0bc46f7000da95c6c730d5978b8896d966de3f3b7989d06ee3d61588efe': "不久之后，我妹妹莉娜开始保守一个秘密。", // Soon after that, my little sister Lina started to keep a secret.
  '3a2a378b7839b4f6c24f11a9880366ca0ba090389df0752e23bd889fe57c6a7e': "每天放学后，她都会进自己的房间关上门。", // Every day after school, she went into her room and shut the door.
  '0d773d4b824fcfc7f9083923eb96eaa3a0da24e151e59d79b1fbea100c31743a': "它是塑料做的。", // It was made of plastic.
  '15c151943434b9054c8d7be83c3388c368de3c121be0e5e1202364809bc0e461': "早餐时，莉娜在我盘子旁边放了一个小盒子。", // At breakfast, Lina put a small box next to my plate.
  'e45ecdec349bcf40465787dc258f452c4eb9d097e82335b282f716b3bb42face': "花了十二美元。", // It cost twelve dollars.
  'd4515823848d9dfbd02fb8ed58dc791bf10fcda58a72dd06dd6ade4f9f5ad67a': "有一天晚上，我没敲门就开了她的门。", // One evening I opened her door without knocking.
  '8e36c7bac148788366b3c409f4bbef9d2724a74cb1554e268d7166ae71802040': "“她喊道。", // " she shouted.
  '282b02b54b8fe0f769f2327e65ceaecb997d03ef3f266836927b5fa55c10945f': "“我攒了六周的钱，”莉娜说。", // "I saved for six weeks," Lina said.
  'f7bd45ba08d7be86ee6f5d7cee4395d5ab02943df4119b7656b46aeb67ddec6b': "她把所有零花钱都留了下来。", // She was keeping all her pocket money.
  'ac3900d53488555b90418f9aa6ea6b4f3ed4c8635c54320a7c89d110000e02d8': "我以为她想要新玩具或者游戏。", // I thought she wanted a new toy or a game.
  '3547be98d08b5b7964687604ba5ba4773843da620de0a8e362422830e3106ee2': "“走开！", // "Go away!
  '25ef4077bc1c9f74912b18603cf66ed745b4f1b4f3a0b31695f2053435428c2a': "开幕前两天，普里娅脖子上围着围巾来排练，只能低声说话。", // Two days before the opening, Priya came to rehearsal with a scarf round her ne
  'b1909b7f75fd7e2c7d08784db30a9e7cd892ee15c93bbc338e3976ec23a8653b': "我出来时，Priya的服装后面扣不上，我知道挂钩怎么穿，因为我每周都试穿。", // When I came out, Priya's costume would not fasten at the back, and I was the o
  'f4f14c9f178374a1b7c885b0330d8f7d707670e081c88afd9928da8c0918f2a8': "之后，在走廊里，她找到了我，抓住了我的胳膊。", // Afterwards, in the corridor, she found me and held on to my arm.
  '8f9e4ae0f30fb7e711a4538058b4c3a9dd237484213a20eeab6d18a3a923ef51': "当学校音乐剧的演员名单挂在大厅外时，我的名字还在，但只是勉强。", // When the cast list for the school musical went up outside the hall, my name wa
  'b1f78196a5d31b0b4a637e0f188bfe9de93dfaf67ba50f9bd07644b422b1f41e': "六个星期里，我坐在舞台一侧，黑暗中，Priya排练，说完话后我会默念。", // For six weeks I sat at the side of the stage in the dark while Priya rehearsed
  '8ccb240d88d2ac65459ba0c9ae2eb5e1638d8e432184a668deb19abaabf8c997': "在普里娅的名字下，用较小的字写着：替身。", // Under Priya's name, in smaller letters, it said: understudy.
  '0db41a5c57cccf27ccbd3e8519097c0c00db1d1a938779a7c6a127754a834c45': "在下半场，在她最长的演讲进行到一半时，普里亚停了下来。", // In the second half, halfway through her longest speech, Priya stopped.
  '3661f67c641498fd7e4e4220952538d160ba6a080eaef0ccd62e0d962e125ef3': "她毫不犹豫地接过，继续播放，我觉得观众中没有一个人注意到。", // She picked it up without a pause and went on, and I do not think a single pers
  'e8fb0dae2f008ff16ee622a3d4b6b6039a29e7b604b72691c91a7f47c979d47f': "大厅顿时陷入完全的寂静。", // The hall went completely silent.
  '17957156c3e589e4b955d72c48e395c5359d649d0c8625f2956078c07f918d4f': "我站在浴室镜子前，轻声唱歌，声音几乎听不见，生怕吵醒任何人。", // I stood in front of the bathroom mirror and sang so quietly that my voice was 
  '28bf9459dff9928ba7648c70b3d5cde19db357293e17ec0792d05ca63918c4bf': "Koh女士把我拉到一边，让我做好准备。", // Ms Koh took me aside and told me to be ready.
  'bd01970132caebc83d951bef90350e14a0c19d4641b733b72be51514b2347754': "“一直都是。", // "The whole time.
  'e313f16a0cbd3a18933550b5cd6999dd20c9f87f44076e6347f49a4c0e8c0bb8': "我把皇冠粘回去，按管子建议的整整三十秒保持，然后把奖杯放回原位，稍微转动让裂缝朝墙。", // I glued the crown back on, held it for the full thirty seconds the tube recomm
  '136896a587cd937c1176941e567d3352e5c76dff214c91e75e46ef14b740ec29': "它击中了电视柜的边缘，国王的王冠干净利落地折断，滚到沙发下。", // It hit the edge of the television cabinet, and the king's crown snapped off cl
  'b6f43e4a104004375860c82f5c07d286b5ba12631ee56a542ec4fa5766668b2e': "我哥哥魏杰十四岁时赢得了校际国际象棋冠军，奖杯从那时起一直放在我们电视机上方的架子上：一个银色国王，底座是黑色，大约和我的前臂一样高。", // My brother Wei Jie won the inter-school chess championship when he was fourtee
  'ceeef076e290328d8e375a446be9547733b818d9918ecbdad97632f72efde3f7': "我父亲依然讲述最终游戏的故事，现在，有时由魏洁讲述王冠的故事。", // My father still tells the story of the final game, and now, sometimes, Wei Jie
  '35f08303beb2c9504653373324dba01aa67898fb85ad3c9a493c273de49cb176': "我问他为什么，他说奖杯这样更诚实。", // When I asked him why, he said that the trophy was more honest that way.
  '94604bd7a46c6d5796d6fd238bf0cf6ed3924fc0d1b28eef018a6f24717d16d2': "那天晚上他又把它胶好了，缝隙朝着房间。", // He glued it again that night, properly, with the crack facing the room.
  '3f300d778c440b371c9896272816876d8d5b9b0d66f7f8e26174df21d7cfa673': "我姑姑用两根手指夹着王冠，好像它会很烫似的。", // My aunt was holding the crown between two fingers, as if it might be hot.
  '96a36f85c2ac7fabc49d40aaa4f456a554a043ff994bcc6c2104b748ba5820d7': "无论他们是否要求，我父亲都会讲述最终游戏的故事。", // My father tells the story of the final game whether or not they ask.
  '341c7f3fd2c25038753041ed40b9099f7da86c4ea8ac1843ab8987a3d4de825e': "我发现如果不去想，就好像什么都没发生过，我惊讶于这竟然如此容易。", // I found that if I did not think about it, it was as if it had not happened, an
  '0d611c781845b5b16e04e05278598b2d4e2eb1655f3126e650fe82628c548afb': "在随之而来的沉默中，我等待父亲开始大声喊叫。", // In the silence that followed, I waited for my father to begin shouting.
  'f46bcc28b546b121d48e2772adf63b982ec81a0590d3dba96a1731df21a61c08': "它依然矗立在电视机上方。", // It still stands above the television.
  'cf3926605362c85eb8f2bfa160f1d703b4b04e8ea9153e5b56582cd06d439c99': "我低头看着路面，一直盯着，直到红灯再次变换。", // I looked down at the pavement and kept looking at it until the lights changed 
  '65f890228781db12bfd84591aee27b2686c43f5fdd8597b05617ea690127ba80': "每次拉赫曼先生开口，我的心跳加速，不得不不停地用湿漉漉的手擦裙子。", // Every time Mr Rahman opened his mouth, my heart began to beat faster, and I ha
  '5c43f8a8d78252b434a068ac809dd6adb41434fec9a3abbe38f258c66340f94b': "她现在用普通话告诉我，她已经两年来每周三晚上去社区中心上英语课。", // She told me, in Mandarin now, that for two years she had been going to English
  '30d511a7be09a16bff967451fce3ec822ae370daa46d5a06490cea03d04a3e72': "看到一半时，我发现自己坐得很挺，就像她在学校赢奖时那样。", // Halfway through, I noticed that I was sitting up very straight, the way she do
  '866fca42597b19973edc593d493c6e5258fe98b134b34c37b22f09ffd6f6d741': "她只问我为什么改了他的话，我说我不想让她失望。", // She only asked why I had changed his words, and I said I had not wanted her to
  'd02b0bf7b90baad98446d3647c70b21b35c10ec5ea1509520d4627062812173b': "“贾慧显然能干，”他说，“但这学期她太粗心了。", // "Jia Hui is clearly able," he said, "but she has been careless this term.
  'ebd6f89e73276b93a81f1a5858208ecebdff2cf0ccde21a0b83509f4f09df9fe': "他说“迟到”，我说“有时候有点慢”。", // When he said "late", I said "sometimes a bit slow".
  '49e7bf32f36bb8e09bb59f827424c170880ff24fdece59a6eeff850dfd0ab5b2': "“绿人开始闪现，然后消失，而我仍然站在路边，嘴巴张开。", // " The green man began to flash and then disappeared, and I was still standing 
  '4f9cad6b3f2b470d7cde3d0f4df9382154ad48160fefdf7404c0aa98ea1557e0': "然后她说她让我一直翻译，因为她想看看我会选择什么。", // Then she said that she had let me carry on translating, the whole way through,
  '74dc39786876fbf8244d9215c27898e6779102e885237513d9f7f4c3f1929c0d': "如果这种情况持续下去，她明年会很挣扎。", // If this continues, she will struggle next year.
  '7e1b94732753c508966cd4aa87ec38c80265274ef0c44cbe9db7dc047f944945': "她并不生气，这反而让事情变得更难。", // She was not angry, and somehow that made it harder.
  'cc849cc5ea5e141795bd43ee987034de788d0631f9f28f7090fa99d162bac112': "第二年，我母亲亲自和老师说话，语速缓慢且带着错误，我坐在她身边，除非她转向我说话，否则我什么也没说。", // The following year, my mother spoke to my teacher herself, slowly and with mis
  '6cb565c41280cb009157b1df2a7744fba2efcbb8c222ce852f2bdf95a4789047': "我的作业整个学期都迟交，有两次根本没交。", // My homework had been late all term, and twice I had not handed it in at all.
  '9d4d03c73bd8f7535dd7913a0047ac5d34fc4f74d52ebc60781d103751276ad2': "“我没听懂每一个字，”她说。", // "I did not understand every word," she said.
  '1c03e5da6502373f731bded92664d642ded6d93ab2492c4ee5c6083dfc23db7f': "拉赫曼先生和蔼但直率。", // Mr Rahman was kind but direct.
  'ba2c612c00d14d12d87a7aab30d4df1725c8f469e59f9d172b70ab99156641e6': "会议剩下的时间我也做了同样的事。", // For the rest of the meeting I did the same thing.
  'd7c533303e76a57b9b6522c83380c51a3e66465fb3469d4c84427088f2e5c037': "每次集会结束时他都气喘吁吁，头发里还有我以前从未注意到的白发。", // He was breathing hard at the end of every rally, and there was grey in his hai
  '767d9bf8c0cde6521514245457e9f079ab57b319ab5b9577dd91d33daf3d45fc': "我嘴巴干涩，弯腰捡穿梭机时，掉了两次。", // My mouth went dry, and when I bent down to pick up the shuttle, I dropped it t
  '32f85c5499aa600abe3afe513ce7269beb2efbacc0c4b0ebff205a315f6c451d': "三月的一个星期天，第一场比赛进行到一半时，我停下来看了看比分，仿佛是别人写的。", // One Sunday in March, halfway through the first game, I stopped and looked at t
  'e49a5be866be3c24745f8fd6a5fc33e57173de253e2b977755433997df785e87': "我父亲会以21比18或21比19获胜，赛后他会从门口的自动售货机买给我们俩喝冷饮，并告诉我哪些击球需要练习。", // My father would win 21-18 or 21-19, and afterwards he would buy us both a cold
  '1ee008d278e358c36706b0f3ea39410824f1878dedfc42de6b005f103536ee10': "我父亲走到网前，握了握我的手，笑了，笑得很开心，大到隔壁球场的观众都回头看了过来。", // My father walked up to the net, shook my hand and laughed, a real laugh, loud 
  'd95b0f0e9b4f3698fd4714c5a0f9ad473ae4f7dcfe05864fc3ddfd89abf5c01a': "他的声音很轻，比喊叫还要难受。", // " His voice was quiet, which was somehow worse than if he had shouted.
  '5d10b35c8bdbc74d56324c6cc2a17ba67a4a019181af6ceb8a849b4f37e71550': "“这次要正式点。", // "Properly this time.
  '744f7251d009e47d1401c2700d16cb132f966e5878a0011764dfd773bfd5e589': "我发现自己并不想打败他，至今无法解释原因。", // I found that I did not want to beat him, and I still cannot explain why.
  '30cef659a9a88a4b37a1782d5c5ff9119a921aefa6339379699bde0a5ceb41ee': "我以为输掉是为了保护他。", // I had thought that by losing I was protecting him.
  'ff566cae5b1b57c6111cce9b4bad6f6ab13aa01f3d37d5c4bf9913673386d14d': "他从不让我赢，甚至在我生日那天也不行，当我抱怨时，他说：“别人给你的一分毫无价值。", // He never let me win, not even on my birthday, and when I complained, he said, 
  '81d7ccc2cf70f8f2a690074c7462844f75a7c3c07000ca64b406276779797a18': "我假装不明白。", // I pretended not to understand.
  '5d76002b0baccc652d324a7362e3f9db21cd7fcab334478c78cbb26487a9a622': "然后，在五月的一个星期天，比分是20比19时，他打出了一个温柔的球，朝我故意留空的角落方向投去。", // Then, one Sunday in May, with the score at 20-19 to him, he hit a gentle shot 
  'fb9c0ef54e6d6062b12be6cf82e0980dd083aa2a4a4ea04c355c41bc849c6647': "多年来他赢了每一场比赛。", // For years he won every single game.
  '0a99dd27ba2ccf072fa4c0a95f630f703e1cd61f35e473c2222c8483caafb4d5': "他说他看我打球九年了，知道我射不到的球和不想碰的球的区别。", // He said that he had watched me play for nine years, and he knew the difference
  '8dc5f7ba7b9058af3db6d1bed812e47e5b4d6d48345e8ee2387e77781ce334e5': "从我七岁起，每个星期天早上，我和父亲都会在我们街区附近的体育馆打羽毛球。", // Every Sunday morning since I was seven, my father and I have played badminton 
  'f58ebda40e4b14806c5dd1f856430b274a697c3b76eb9b9f8c343d99cc2125f0': "当安贾莉上前去拿杯子时，我站着拍手，直到手都疼，直到其他人都坐下很久。", // When Anjali went up to collect the cup, I stood and clapped until my hands hur
  '563265bcaac9f25d68915e6ba01d83f009ec993583607b2f14714e2e5ebbf4f4': "我们没有备胎，因为三月份我决定备用发动机是浪费钱。", // We had no spare, because in March I had decided that a spare motor was a waste
  '822941f63d06d47995e310f535f0f032f98128907b5fc9e2a319a5f0cdf64150': "然后一双运动鞋停在我旁边。", // Then a pair of trainers stopped next to me.
  'ddf83fe06b7eaafaa0d48e3ce6b672ee5d1e422f09daf1510a7a2bd8b9ad6093': "整个学期里，娜迪娅、伊桑和我每周二晚上都在科学实验室里，组装一个大约鞋盒大小的机器人。", // For a whole term, Nadia, Ethan and I spent every Tuesday evening in the scienc
  'd6ad9b94c3f403e41c3a21fb29e02715ff46d00456ee14585e7bcf7c365ea32e': "赛后我把马达还给她时，她告诉我，在她的第一次比赛中，有个来自另一所学校的男孩借给了她的队伍一个电池。", // Afterwards, when I gave the motor back, she told me that at her first competit
  'dc4c1402f841a467cab59232a015dc6efad1ded915673375411091b0cc25811e': "当伊桑问我们打算做什么时，我告诉他别再问傻问题了。", // When Ethan asked what we were going to do, I told him to stop asking stupid qu
  '5a7f8c97062c503f03e75ee262355dca250f316aae1927a179aa3122b81d8348': "左侧电机坏了。", // The left motor had died.
  'c068c953ab410b26f64182b8ccab1d474238b4bbb4b764a28ebb9ac08e3ce34d': "我的手抖得厉害，掉了两个小螺丝，娜迪娅不得不在隔壁桌子下找到它们。", // My hands were shaking so badly that I dropped two of the tiny screws, and Nadi
  '366e081b61701cf94a1afc8d904606cb9d5fdff7b7ee2e94ebc41471fde850ec': "当我们的机器人把第一个方块放进正确的盒子时，我发现自己一直抓着桌边，手指都发白了。", // When our robot dropped its first block into the right box, I noticed that I ha
  '3cbe7a009b623ba43f16175ffe9709033963287de06158ef1629b18732bb88ae': "我们最想击败的队伍是去年夺冠的武吉崛起中队。", // The team we most wanted to beat was Bukit Rise Secondary, who had won the year
  '903743884c1eef53e49bd166d39d076095af0a2f2ed9aeac6e8b04e077119812': "她的一个队友用不满的声音叫了她的名字，她挥手示意，没有回头。", // " One of her teammates called her name in an unhappy voice, and she waved at h
  'd2fd25b3944e4807d981af58d03f75e380427492c60266ec6c77a5c3cc2c9169': "她花时间把我们当作值得帮助的人，她依然赢了。", // She had spent it seeing us as people worth helping, and she had still won.
  'c6f448a965284133717c38a1f1bf7fdf2f537c0149b0a2740995b3e7ff558070': "在顶部，我用两下划线写下：两个备用电机。", // At the top, underlined twice, I wrote: two spare motors.
  '084bd263b537823551c1384ee5df9f6aa1c705ef7731ad745171ad272b4d9da7': "我在手中反复翻看，寻找问题，问她想要什么作为回报。", // I turned it over and over in my hands, looking for something wrong with it, an
  'dc352d32e5a9a4a226dccf9cd72974a39865888f3dd548a0ed4ae67e4c87e9bc': "我们获得第三名，正如大家所料，Bukit Rise赢得了比赛。", // We finished third, and Bukit Rise won, as everyone had expected.
  '775eb5dd1775bd900a73088cfc1f8f545aee888a34188bf2a6c9e99598381f8a': "“期末考完就还给我吧。", // "Just give it back after the final.
  '6bf36f59dd1784a2ec07645b342304608ad198b7971e63266178133e3216d18a': "我知道梅玲三件事：她坐在窗边，从不举手，还有一次交了一张工作表，边缘画了一只鸟，而不是答案。", // I knew three things about Mei Ling: she sat by the window, she never put up he
  '5a656272453f5ce606b95afd5ec242fdb7ff2e7ea9bc03706b39238cd43eae79': "里面是一组画作：同一条河，从山到海，分八格，每格都用细小而工整的字迹标注着标签。", // Inside was a set of drawings: the same river, from the mountain to the sea, in
  '38be2b1708f9b27bee8d923abc0261f349c72141af3d81c286d3e6d0831f7b81': "当Rajan女士为地理项目读组时，我和Mei Ling一组。", // When Ms Rajan read out the groups for the geography project, I was put with Me
  'fa03122e7884d4b13160dbe4d47d9d73e66f539f60b82d3e791a5bde5f99896b': "她正好在拉詹老师叫我们名字时，手里拿着一个扁平的纸箱。", // She arrived at the classroom door just as Ms Rajan called our names, carrying 
  'ee01784244633190b48c97d98f34f755ac6a5cc32403e8c2fb7799d2ed8cc461': "我开始给她做一半的，甚至熬夜给河岸刷漆，粘上小纸树。", // I started doing her half as well as mine, staying up late to paint the riverba
  '73415b53dcf8e30c80d31f995ee359a2b1c9fd95c3aa4186ae5a5918bb615021': "我的胃一紧。", // My stomach tightened.
  '45575927c9e10da843d97d9164fac48ebc1173cfdbeee1fdb406a91af252da79': "最后一幕中，一只鸟站在浅水中。", // In the last one, a bird stood in the shallow water.
  '72bb1e5d4e3aa650506daa730b3a4fc07e53181aae86bfadd55bda379d7d083f': "演讲当天早晨，梅玲不在我们约定的校门口。", // On the morning of the presentation, Mei Ling was not at the school gate where 
  'cfc63fe646ff00e9f53073b86158ec68bff61ff6383c017c341f5443d39980fc': "我有模特，但没准备好代表我们俩发言，我们的谈话本该从她开始。", // I had the model, but I had not prepared to speak for both of us, and our talk 
  '1d0783c2ea3d8911a5b99c2b558a131ddbc2c14595c9c839308b5b678e215104': "第一天我列了一份需要做的所有事情清单，分给了她一半。", // On the first day I made a list of everything that needed doing and gave her ha
  '313244ccbf2c1edffd551c5dec56e645bb2fcde3d2a6e881b7dff2ebd272d27a': "我一直忙着做唯一一个忙碌的人，从没问过她在做什么。", // I had been so busy being the only one working that I had never asked what she 
  '4067130e80d10b284ce8adb791f358356486ca35625e10619527d56365c0d301': "“我以为模型无法展示时间变化，”她轻声对全班说，然后一格一格地讲解整条河流，没有看任何笔记。", // "I thought the model could not show what happens over time," she said to the c
  'e3b9a76d13cc8e91c97839deb278fb7da1be6553f24e4eb34e8391361fee7aa8': "我们有两周时间制作一个河流模型并向全班展示。", // We had two weeks to build a model of a river and present it to the class.
  '9882a8bf9ab274583db5b0db9aea5f57dcfd3d8e51904faaf821b7414b8cd786': "他把一个新盘子放在柜台上，说了句“再来一次”，然后继续切菜。", // He put a new plate on the counter, said "Again," and went on chopping.
  '49b4c5100ffd26d9c51cb817c17ae6cc9c3b1a86072193c7c57f9a9907a7a697': "我原本想象过更刺激的东西，比如烹饪节目，人们大喊大叫，火焰从锅里跳出来。", // I had imagined something more exciting, like the cooking shows where people sh
  '85e1f7622db56eaae4cd7414a434ad3465ff4763cf3a64a257ae94959020d74f': "我擦了擦台面，装满辣椒盒，把外卖盒叠成形状。", // I wiped the counter, filled the chilli containers and folded the takeaway boxe
  '84f19f5dcddee928b90a664d18c8fb55afbeac5acaf9e2e128f03c97a1d53983': "我叔叔在大巴窑的同一家小贩中心卖鸡米已经二十二年了。", // My uncle has sold chicken rice at the same hawker centre in Toa Payoh for twen
  '32bebcf57e0f6302157d8d0bf3ef18931b251dca09e991fd30af2d65947b6019': "我叔叔开始喊点单——“一份烤的，不要黄瓜，加辣椒”——我应该负责打包。", // My uncle began calling out orders — "one roasted, no cucumber, extra chilli" —
  '396e8b9f58fc70cedf17b203e581a91d083aa60773548dd21da4738cc3fc600d': "我暗自感到失望。", // I was secretly disappointed.
  'cab01d85ca76c8e3ac24be779e54c2ac1eee59474db9e92445317855a6318f08': "十二点钟，办公室工作人员到了，排队的人从两个人变成了二十人，而我折叠一个盒子的时间就足够了。", // At twelve o'clock the office workers arrived, and the queue went from two peop
  '1786d23d0eabf81cfe03f8a7a137db994f663392303871a33aaa0ff47077dc80': "当我问假期期间能不能帮忙去他的摊位时，他看着我的手，好像在检查它们是否准备好了，然后说我可以周六十点开始。", // When I asked if I could help at his stall during the holidays, he looked at my
  'be4743254140e0b7acb150661e56312754e8b7ac37bc66158304f1c21950998b': "我后来学到辣椒盒必须装到顶部下方一指，因为我叔叔说，人们信任看起来满但不贪心的容器。", // Instead I learned that the chilli containers had to be filled to one finger be
  'a4492416ac3b2d3bcb967c558b92ca52d8fd3ce0c0cbc56a0c1b5fac474f40f0': "两点时，队伍突然消失，就像来时一样。", // At two, the queue disappeared as suddenly as it had come.
  'a67c84de8cd146ca21a5490b8c7ded6c1fd54aa372c35da456417cb47c255ea1': "父亲整个下午都没和他说一句话，那晚他差点决定永远不回去。", // His father had not said a word to him for the rest of the afternoon, and that 
  '1c1780a9eb1b32dd7328add499e5f6a8eb3dc692fb93a12a1150a0d5a0d902af': "我给了一个人找了两次零钱。", // I gave a man his change twice.
  '666364ff3e6842acffd8ca45d4a387fa86a7e1b1a08a929f6b0377c9c21f6f60': "然后我把一整盘米饭都掉了。", // Then I dropped a whole plate of rice.
  'e047c670b0626de86ea6081e1c05631b330cfd72207b345147e6a3ce46b01b96': "后来我明白，这其实是他能做的最善良的事。", // Later I understood that this was the kindest thing he could have done.
  'af27478893a14b55a969aad30902cd1a0e7a0107fc78941c1282e3ef06240568': "“我一个月都没事。", // "I was not fine for a month.
  'a7254f915a3514aa2b94554d302dfb2b920266d7f4d8c2256f37d1e574a5dda1': "我的脸颊发烫，对桌布上的图案产生了浓厚兴趣。", // My face went warm, and I became very interested in the pattern on the tableclo
  '2eb15742c6bd29e7907dfb17f3ac50071e004a64c68ff6240d738b5ef85f54d3': "我父亲说“”，我哥哥说“鲨鱼”，我说“只要能让我最快脱身”，我觉得挺聪明的。", // " My father said "a tortoise", my brother said "a shark", and I said "whatever
  'dc3bec261ac5cd0019eda3d1895dca70f617740cdeb1a18e613cf218a67d48e1': "“我十二岁的哥哥呻吟着，好像被布置了额外的作业。", // " My brother, who is twelve, groaned as if he had been given extra homework.
  'a518f5f8c27dac3ef226cd9d44b9a0e74ad4998f68fb33f00e2aa1d6f2b7a537': "但下个星期六他带回了一对鼓棒，他说那只是用来敲桌子用的，方便他思考。", // But the next Saturday he came home with a pair of drumsticks, and he says they
  'a53e15010e5cca2653e6e78b7324b7034cd55f8b8dedfa080938eb6a49bc0f23': "我放下筷子，盯着他看。", // I put down my chopsticks and stared at him.
  'bf8f670becc13fa7d8df7abaa89c43f34b75b172f67aa037499e98d0b0d4520e': "我妈妈把它倒过来摇了摇，但什么都没掉出来。", // My mother turned it upside down and shook it, but nothing fell out.
  'fa5235b53eed4c18251502fc8d5cdb0bdf0ea6f9713fe5f139ada2781a19b8da': "他告诉我们乐队只在学校礼堂举办过一场演出，还有他卖掉鼓组以支付理工大学第一年的学费。", // He told us about the band, which had played exactly one concert in a school ha
  '7156d3b74fd6940cca8ab79d4499277a3e2016bdbcae3650c5bf4bc019263212': "第二个星期四，父亲用我哥哥的笔迹写出一个问题：“你青少年时想成为什么？", // On the second Thursday, my father unfolded a question in my brother's handwrit
  'bec3499c63994baabc0d8821ce898ff4e613810a0210cb12a0aca6aafc095e5c': "他一边说一边笑着，但一直用拇指在桌边摩挲。", // He laughed while he told us, but he kept rubbing his thumb along the edge of t
  'ecbd409f486618e01e8e803db7a489f653464be9c5bb7a94046d6ebc33fa39d1': "六月时，我母亲在餐桌中央放了一个空果酱罐，里面装满了折叠的小纸片。", // In June my mother put an empty jam jar in the middle of the dinner table and f
  '42bfeab9e243bf7983bb04af7b61782953f0a6a7829d7fa0a3fe0141ce898a9e': "大多数都是傻气的，比如“哪种食物你永远不会再吃，哪怕花一千美元？", // Most were silly, like "Which food would you never eat again, even for a thousa
  '43ca83bf28ec7ba2b940d9d2f5c6e8c10d6521b648951b57522089089b862454': "“你最喜欢什么颜色？", // "What is your favourite colour?
  '5a5c1e683a86da70a8704fce39cd5add7b65136ee0abfa646dd6b089cf01ff3e': "第一道题和我预想的一样糟糕。", // The first questions were as bad as I had expected.
  '4d1648c1359ab9059764ca57d45f8c752dd58cea1ada525116dc2412155ce7ed': "“我小心地折好，放在罐子顶部附近，那是我父亲通常先放手的地方。", // " I folded it carefully and put it near the top of the jar, where my father's 
  '77b55de226f93b4db63e69dff80aa80c0fbd5ba74719360d081cafdc1e93ac11': "我端着托盘走过去，还是坐在他对面。", // I carried my tray over and sat down opposite him anyway.
  'ba60e402af41bbc51139173376834cca3da079b4d874f2a9302312903f6ce358': "第二天早上，他坐在食堂的另一张桌子旁，和其他几个男孩一起。", // The next morning he sat at a different table in the canteen, with some other b
  '11ecdb322dbe070cbfa84b168a80d35bedc185d2ec821dda9bad99c263e3965f': "我删了它，但我知道其他人手机上的副本还在。", // I deleted it, but I knew that the copies on everyone else's phones were still 
  '2ef1cf7f79939b2525a7a7b925f4d89967f69ee3ec48252e3cfed1d506afec2b': "我在下面打了“睡美人”，还没发车就发到了班级群聊。", // I typed "Sleeping Beauty" underneath it and sent it to our class group chat be
  'bbe7ed040fff40e0bc769dc86dbcb9b91260eea0877583d130668b0f95839c67': "“，我读了三遍才长长地呼出一口气。", // ", and I read it three times before I let out a long breath.
  '08994421154b8ce44c839950e629d98baea0d62e1fe8aee5759fcd4632e5766b': "照片还在最上面，周围都是笑脸，现在每一张看起来都不一样了。", // The photo was still at the top, surrounded by laughing faces, and every one of
  'b1bf5928579db1d38def5472a9f5e53f34b95da5b32a303936add92d41345e93': "人们送来一排排笑脸，有人把照片做成了带有猪鼻子的贴纸。", // People sent rows of laughing faces, and someone turned the picture into a stic
  '2204a32f5b5570c117fd48d1860ecb63d809d762b2d40544e0b24c7cfbcfd8eb': "那天剩下的时间里，我不停地打开聊天又关闭。", // For the rest of the day I kept opening the chat and closing it again.
  '01166f30a4f33c618f8736be1b6f746638c657c9e285b9e257851c7da9fa1986': "我不得不咬着嘴唇保持安静，拍了张照片。", // I had to bite my lip to keep quiet while I took a photo.
  '7dcdf81d6982f793d4a6eea27f3dba5f0086d7362f513ec40e37b91d092668f4': "我想让他们觉得是他难相处。", // I wanted them to think he was the one being difficult.
  'f4ba93a5f4c61d5f8f2bbea56ff89d64abe7424d6fa636fca0532d2958ef7721': "他看了我的屏幕一会儿，轻笑了一下，回家的路上一句话也没说。", // He looked at my screen for a second, gave a small laugh, and did not say anoth
  '75a6d7ef60bc02593db991735aaf48f69ca96f3eb600b84b42be350e274ca705': "她整个班级都有。", // Her whole class has it.
  'fb7a8b3a261837faf71d0193d33a143c7b951b0f97f3cae9a8bf3df29b933a69': "然后他说我可以先让班级删除贴纸，于是那天晚上我在群聊里用自己的名字删了。", // Then he said I could start by asking the class to delete the sticker, so that 
  '979699769cf14fc1a7fc22319a53f746e330dcd10f6660624e0a7fe5ec60b3ae': "周二足球训练结束后，俊在回家的火车上睡着了，嘴巴张得大大的，头靠在窗户上。", // After football training on Tuesday, Jun fell asleep on the train home with his
  '7cc301aeb35649d7871ffa475a7d31c14997263d70c86c3038f7407a74492eb5': "周五，俊又加入了聊天。", // On Friday, Jun joined the chat again.
  '2ce9b61e4a3ec5afe50cc979fc7df695fa8101c910f609754d799df36ea1b7e5': "他端起托盘走开了，我也张着嘴坐在那里。", // " He picked up his tray and walked away, and I sat there with my own mouth ope
  '3bd75563686de9504dafa51bb853ecf5ca5f34a411d2aa2b6f055502723a3b75': "Jun醒来时，我给他读了最好的回复。", // When Jun woke up, I read the best replies out to him.
  'af849eae9428a16ec86e82a115058284f95106dcae58db2ef5cabf178fb9c9e9': "我清了清嗓子两次才问：“你能给我看看你在第一场比赛里做了什么吗？", // I had to clear my throat twice before I could ask, "Can you show me what you d
  'd6eaa979277fea5a2eb1fc8408737e617e7a78df838d5cd0bf1c3a2769cc99e8': "他只是给我看了，然后又给我看了两个他每晚解谜时学到的陷阱，整个过程中一直在谈论他的猫。", // He just showed me, and then two more traps he had learned from puzzles he did 
  '21ab880c320be69ace053367f89d1e6ba2e57a7358dd834d1ec3547248dca629': "我告诉他，也告诉所有来看我的人，我累了，没有努力，窗外的阳光照进了我的眼睛。", // I told him, and everyone who had come to watch, that I was tired, that I had n
  '470442f4efe43812d1f70e5c39bc622fe1845b51ef29370781e2976c51813807': "学期第一周，一名中学一年级的男孩伊尔凡加入了俱乐部。", // In the first week of term, a Secondary One boy called Irfan joined the club.
  'cb5e1dbcf3cfe5e3301173bd173150ecf3c03f3f5dfa7b24325cdc9a4a9d514f': "那是个简单的陷阱，我直接走进了陷阱，因为我从没相信他能设下陷阱。", // It was a simple trap, and I had walked straight into it because I had never be
  '8423c62358dc2eef7b5b2501edfbf9cfe949a5857a261a4bcf0390b8da3e5016': "我盯着棋盘，确信自己漏掉了什么，花了好一会儿才明白游戏已经结束。", // I stared at the board, sure that I had missed something, and it took me a long
  'd9e7e5f5b133d35f71279bcfe4c647d206857fc5908797c5024d0743867021d3': "我终于回去时，Irfan 正在同时对付三个年纪较小的学生，故意大声输给他们，好让他们笑。", // When I finally went back, Irfan was playing three younger students at once and
  '3caae44dc8857f6a641b20ab017c324dfd08122b2d69167cf784998b0078f983': "到了第三个晚上，我已经能清楚地看到发生了什么。", // By the third night I could see exactly what had happened.
  'b2c9dc2e60ec915612c16b970a8b9eed39082bfb9770013f52fc61729cc27c3c': "我的名字排在俱乐部名单的最前面，年轻的成员们叫我“队长”，部分是开玩笑，部分不是。", // My name was at the top of the club list, and the younger members called me "Ca
  'c2833ba477be3cfc286e4c36e9541785a7398cb1767dfde90c56758693e85813': "他一边玩一边说话——说他的猫，说他看过的一部电影——而且他走棋子的速度快到我觉得他根本没在思考。", // He talked the whole time he played — about his cat, about a film he had watche
  '8488890ec6f234e2bf9f974d53ac21ea8c7157d1539a64ff979e8f06ffaefc67': "十二步后，我的国王被困在角落里。", // Twelve moves later, my king was trapped in a corner.
  'b0129106af89ddfdf0254cac7dc9662e26ed65b3bb2ba28df19e14864d85359d': "一个月前我会反驳。", // A month ago I would have argued.
  'd06b58bfd2aa11ad50541003d84b58655e5310fc6bd0bb4ded1e9d5a2d79af77': "周三我会双手背后慢慢地在教室里走动，每到一块板子前就指出错误。", // On Wednesdays I walked slowly around the room with my hands behind my back, st
};
