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
};
