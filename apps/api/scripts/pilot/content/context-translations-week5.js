'use strict';

// 首发周例句的中文句意。key 是英文原句的 SHA-256；
// content/index.js 会逐条校验，少一条就立即报错，不能带缺口发布。
// 由 scripts/pilot/build-week2-context-translations.js 生成（Azure Translator），
// 生成后经人工复核。行尾注释是原句，方便审阅时不必回查。
module.exports = {
  '03a2c2c94c8415685892ad334a6e88b857fbe4c77e1f5156457f6df95b2ea9a3': "其次，参与的人越多，他们中没有一个人觉得帮助是自己的责任，这一过程被称为责任分散。", // Second, the more people are present, the less any one of them feels that helpi
  '3482895b4b724470d9126e87d97ad847bae52e60b8a6a18598a81afae8c42aee': "纽约的两位年轻心理学家约翰·达利和比布·拉塔内怀疑原因并非冷漠，而是他人的存在。", // Two young psychologists in New York, John Darley and Bibb Latané, suspected th
  'fb7be42d91731cc81db38280a26a5d3241a7290826ef0baab39e48b0c4751dd1': "在第二项研究中，烟雾从通风口流入学生填写问卷的房间。", // In a second study, smoke poured through a vent into a room where students were
  'fac48aeb24bae33584ab6139a7e0cb2dec582c48d8b04ca57d743b09f563221a': "三座城市的干预可能性大致相当，尽管它们在街道安全程度上差异很大。", // Intervention was about equally likely in all three cities, although they diffe
  'ae226fc68cdf592c28cf465d033a25b6042621510de83aeb5f21c76bb6e00bdd': "1968年一项实验中，学生们分在不同房间，彼此看不见，通过对讲机交谈，其中一个声音，实际上是录音，似乎发生了癫痫发作。", // In a 1968 experiment, students in separate rooms, unable to see one another, t
  '1ad2a8347b68d352c52890cf9f0542bea6b9aa4729ecd6a4e3afc498b01f49c4': "这一模式本身被称为旁观者效应，杰诺维斯案例就是其教科书式的例子。", // The pattern itself became known as the bystander effect, with the Genovese cas
  '13678ca1c60b58cb54e0d97ab296078af11e772c302801a2b514bf9559cdf6cb': "最强的挑战来自真实画面。", // The strongest challenge came from real footage.
  '60f3b19f4a5e96a3118491ac3e77bf594a13386893b933252ae32a06456565e5': "目击袭击的人数远少于报告，没有人看到全部，有些人甚至以为听到了争吵声。", // Far fewer people had witnessed the attack than had been reported, none had see
  'da03fb7fac132431307ba6c998d6e4b5b3035035cb31f199b0e7d673f68eb35c': "一些保持沉默的人后来解释说，他们决定那一定是蒸汽或其他无害的东西。", // Some of those who stayed silent later explained that they had decided it must 
  'ac6a0bb5ab8abbdd40a15a593829ec61438c8dd3b78cd32575d2db260f37290e': "人群中的人可能仍然犹豫，但更大的人群中也藏着更多潜在的帮手，对于陷入困境的人来说，这才是最重要的。", // A person in a crowd may still hesitate, but a larger crowd also contains more 
  '19118ff007f4736c78995ce1fd3ef2f3cba63ad8c1f35ede47bc445b5519e66f': "2016年，该报承认其对目击者人数和所见情况都大加夸大。", // In 2016 the newspaper acknowledged that it had greatly exaggerated both the nu
  '9db0e5e9537cfb40c3a8a2861412dff1ace143cbe1f7a4fe2e646d06ff2fa772': "在认为自己是唯一其他听众的人中，85%的人在声音停止前报告了紧急情况;在相信另外四人也能听到的人中，只有31%的人听到了。", // Of those who believed they were the only other listener, 85 per cent reported 
  '52c1e9abdb334a2069bd62e6b2112d2a73978b27ec496359522a19124f605884': "这并不一定意味着实验室研究是错误的。", // This does not necessarily mean that the laboratory studies were wrong.
  '5887770c82819876b072bd05bd42765c331e4bbf5c9a7be282cf4497b881b7a0': "实验测量的是每个人采取行动的可能性，而摄像机则记录是否有人采取行动。", // The experiments measured how likely each individual was to act, whereas the ca
  '97b92244bd847bdbbade64d8500c6c7da3195038e552e96976e08c7895964fc9': "2020年，一个国际团队审查了阿姆斯特丹、开普敦和英国兰开斯特市监控摄像头拍摄的219起争吵和争吵。", // In 2020, an international team examined 219 arguments and fights recorded by s
  '07010cabd80c27c6958f126bd34ea3744344150c37275b669c545ba0b65ebff5': "首先，当情况不明确时，人们会看向他人来判断发生了什么;如果没人表现出担忧，大家都会得出结论认为没问题，尽管每个人私下可能都不确定。", // First, when a situation is unclear, people look to others to decide what is ha
  'e7c63b2ced8ce32fa76ea63d046a8548fbcd7eb8025ff6c00f7c70a92c66aa64': "许多急救课程中教授的实用教训不是针对一群人，而是指向某个特定个人，给他们分配具体任务。", // The practical lesson, taught on many first-aid courses, is not to appeal to a 
  'b773dece470ee1a2aa85c608194c987fd57465e1ad4e1fff291df9e128192ea9': "没有狼后，公园里的麋鹿——一种大型鹿类——变得非常多，几十年来它们的啃食阻止了年轻的柳树、白杨和棉白杨树在溪边高大生长。", // Without wolves, the park's elk, a large species of deer, became very numerous,
  '3e7e75e2d86e1fb3cf2f7b3a54681e9fa4967cd3f01f994303bba62b686d5bca': "他们将此解释为营养级联反应：一连串效应，食物网顶端的捕食者减少了食草动物的数量，使这些动物所食用的植物得以繁荣。", // They explained this as a trophic cascade: a chain of effects in which a predat
  '97edc0400bff81073fee7a6c449c83994a21d8d84bbe719f232ffad20679dc96': "溪流则增加了更多复杂性。", // Streams add a further complication.
  '9e57d730cff1d249c7e0247f021de8172ff0a0571c13965cee2cb5c7b9538ac9': "灰狼早在1920年代就被美国西部黄石国家公园消灭，这是一项有意消灭捕食者的政策。", // Grey wolves had been eliminated from Yellowstone National Park, in the western
  '81ac2e325f87ad10a3cdaed319b57055171fdeef7a0232027c948ebce3d39f53': "2022年，犹他州立大学的一个团队将这种方法与随机抽样进行了比较，得出结论：他们高估了白杨的恢复量四到七倍。", // In 2022, a team from Utah State University compared this approach with random 
  'de04ea4dde7a0ec5257200524b7f29aaddb15489e86badd7db6aa1e5256e430a': "首席作者认为，当食物网因顶级捕食者的消失而被扰动时，随之而来的变化可能在捕食者回归后仍持续很久。", // When a food web is disturbed by the removal of a top predator, the lead author
  '948585065a870076d2ebabe60dda8ae2e9d33405321315cf5f9ec6ad83407876': "狼群到来后，公园北部分布区的麋鹿数量急剧下降，十多年间大约减半，但狼并非唯一原因：公园外的猎杀以及熊和美洲狮数量的增加也起到了作用。", // Elk numbers on the park's northern range did fall sharply after the wolves arr
  '32ef4f1e5b839b6fdef180a0ec2db9a3dc067eda73b53015d0db5aca9c018e89': "对于其他地区的保护项目来说，这个教训令人警醒：带回一只失落的捕食者可能是修复生态系统的重要一步，但仅靠这一步可能还不够。", // For conservation projects elsewhere, the lesson is sobering: bringing back a l
  '488cf891eb1d289e16736ed5a11958f8f20589c025c3e7f83d47d58a2573770c': "根据这一观点，麋鹿开始避免容易被攻击的地方，形成了一个“恐惧景观”，使得处于危险区域的幼树被较少啃食，得以生长。", // According to this idea, elk began to avoid places where they could easily be a
  'd7b0b824fd6ce43ea0dbefccb93ea33c4070d641c086ecb2f5320abe0ac3950d': "2024年，同一团队结合二十多年的研究得出结论，狼的回归并未迅速恢复溪边植物群落。", // In 2024, the same team, drawing on more than two decades of work, concluded th
  '347352f2543d4a9a8ceee0b5c3a4131d9e9592ed585bde8d5e21f25e94c9a277': "多项有影响力的研究记录了每个林分中最高的五株年轻白杨。", // Several influential studies recorded only the five tallest young aspen in each
  'a497d1c478d4edb969573b73ce527b5280ffc379022b35aef183b2886ace9f7d': "年仅两岁半、尚未识字的孩子也有类似偏好。", // Children as young as two and a half, who cannot yet read, show a similar prefe
  'c87718656412abd68aee6da0b8d668f248f4bfb816d83d61bacb460fc846061e': "由于这些模式出现在不同语系和大陆的语言中，因此无法通过共同祖先来解释。", // Because these patterns appeared in languages from different families and conti
  'ca72d2b9292a6cda4a270a29396c636d867725bc56c302226c0b099d908b1fa7': "1929年，德国心理学家沃尔夫冈·科勒报告称，人们很容易将一个虚构的词“takete”与一个棱角形状相匹配，另一个后来被称为“maluma”的词则与圆角的形状相匹配。", // In 1929 the German psychologist Wolfgang Köhler reported that people readily m
  '402f357845c1d16aaa1a6aabd94286a182e6fbe20a2758ad09401298a4f986f4': "想象两幅简单的画，一幅像云朵一样圆润，另一幅像破碎的星星一样锯齿状。", // Imagine two simple drawings, one a rounded shape like a cloud and the other a 
  '21c34ce86be065681d19f9c6a3f45c7fd7fd43b1443286aa9c1150d1d1052645': "另一种观点关注声音本身，认为平滑连续的声音具有平滑轮廓，而突兀的声音则带有锐角。", // Another focuses on the sounds themselves, suggesting that smooth, continuous s
  '551f072be8dc2498e1ad68e4595b6e165dff15775ed97bc8bb4237dbc6b7e997': "在二十世纪的大部分时间里，语言学家认为词语发音与其意义之间的联系是任意的。", // For much of the twentieth century, linguists held that the link between the so
  'd1050b54c10dc9f907e6c448e43ab6c83fa3c120ee5b0162cd5fbdfbfb76d524': "任意性被视为人类语言的定义特征之一。", // Arbitrariness came to be treated as one of the defining features of human lang
  'e069fd7d8b3a11d490566a3d76e0d9aa693ef59549eda7e9a398f15927653912': "带有bouba和kiki的版本由神经科学家V于2001年推出。", // The version with bouba and kiki was introduced in 2001 by the neuroscientists 
  '20dcff2d73fa68d1a87ce08e1a2e29ddaf4566fad38acc85407f128faa760fe0': "一些研究者认为，声音与意义之间的联系可能帮助了最早的人类语言的发展，因为新词更容易猜测和记忆。", // Some researchers suggest that links between sound and meaning may have helped 
  '50ac422762e62173eea05016e54b31b346a13f8f5f4f42ba044e2bdd2d1c0680': "这一观点通常可以追溯到瑞士语言学家费迪南·德·索绪尔，他的思想于1916年出版，当时他去世三年后，通过学生讲义整理成一本书。", // The idea is usually traced to the Swiss linguist Ferdinand de Saussure, whose 
  'a481406e8a371b8a902e0219a6d9408052e11f78d4033c3e5364117832e241ac': "对于大多数词，尚未发现声音与意义之间的联系，存在的联想仅是倾向，但有许多例外。", // For most words, no link between sound and meaning has been found, and the asso
  'a4fa834b776583620b0d5ec726c4a4e2c678ab1e5c70509c66c328921b5f7cdc': "这两种解释并不排斥，研究人员尚未就各自贡献的程度达成一致。", // The two explanations do not exclude each other, and researchers have yet to ag
  '465947923e0ddbd2c7f234c718d80a527cf7b7a1a67b1aa8a44196741af207e4': "一个国际团队测试了25种语言的使用者，这些语言属于九个语系，使用十种不同的书写系统。", // An international team tested speakers of 25 languages, belonging to nine langu
  '60dd8717e02194f3b2eb57a313a9e09f8958200b84d112a1f2cff6aeffae6328': "例如，“鼻子”的词通常包含“n”音，而表示“小”的词通常包含类似“kiki”中的元音的“i”音。", // Words for "nose", for example, often contain an "n" sound, and words meaning "
  '4a559c21d60443c471c93304753e44acf7267b259a93a14a478b4024d1022e6d': "然而，声音与形状相关的证据有着悠久的历史。", // Evidence that sound and shape are connected, however, has a long history.
  '3a10143a224df495023be34c8057ef2a7b3b08745ea0b40e7061a7601100180a': "拉马钱德兰和爱德华·哈伯德报告称，95%或更多被检测的人，包括英语和泰米尔语使用者，都做出了同样的选择。", // Ramachandran and Edward Hubbard, who reported that 95 per cent or more of the 
  '92660c48902cc915abac8e9631fe87180ba9f9ea3a9baef8c10ca44e03b6b107': "因此，放射性碳结果通过校准曲线转换为日历日期。", // Radiocarbon results are therefore converted into calendar dates using a calibr
  '597e777d4ab353cb8d4f181fb8ff05c0764e2ea45b8dbc953c55ce961d3c2b4a': "燃烧它们释放大量碳，却不含碳-14，稀释空气中的物质，使生物看起来比实际年龄更老。", // Burning them releases large amounts of carbon without any carbon-14, diluting 
  'acf324ed2b49bba565875523bb5dc3769317c892ad054770fa814c32350a01b9': "很少有科学技术像放射性碳定年法那样彻底改变了一个学科。", // Few scientific techniques have transformed a discipline as completely as radio
  'd32947deac28fe8213df57463dc3ab6603d26a49e9638ca042484d0f0603b075': "在大气高处，宇宙射线引发反应，将少量氮转化为碳-14，这是一种放射性碳的形式。", // High in the atmosphere, cosmic rays set off reactions that turn a small amount
  'ae5956615c9ded65022f5e546c490853c99c44d8f5690f56cc6cea6e675de883': "碳-14的含量随着太阳活动、地球磁场和海洋活动的变化而变化。", // The level of carbon-14 has varied with changes in the activity of the Sun, the
  '09d86ae54dfc3c049da1258a390bd09e56646726a908861bc1a9df2005f34290': "2015年发表的一项研究计算出，如果排放持续上升，2050年制造的新T恤可能产生的放射性碳结果与一块约一千年前的布料相同。", // A study published in 2015 calculated that, if emissions kept rising, a new T-s
  '7c7db75e9526081ffc20e2c8f478fa1c4b12425f1df581e66324e5a2dee419f2': "第二项进展出现在20世纪70年代末，加速器质谱技术。", // A second advance came in the late 1970s with accelerator mass spectrometry.
  'e5ef2f9ebd741d0337b71446ce6f2f1e1eae9ba0a442c085eab503922ad4e9d9': "结果与预期年龄相符，足以说服许多怀疑者，1960年利比获得了诺贝尔化学奖。", // The results agreed closely enough with the expected ages to persuade many scep
  'c7deb62b73152c251a9dd0f85a1ff565395c7da87728ca11c0e7540f1ac8300f': "其主要极限由物理学设定：大约5万年后，碳-14含量仍不足以可靠测量。", // Its main limit is set by physics: after about 50,000 years, too little carbon-
  'e6507fb19fee4d7b1b5ded49d4acc5502b1115b1118504e10c34a707e30cda12': "在此之前，史前遗址的年代通常只能通过与其他地方的物品进行比较来估算，而随着距离有书面记录的地点越远，这些遗址的可靠性就越差。", // Before it, the age of a prehistoric site could usually be estimated only by co
  'f68ec2fbb035a6b4d11373f2da17e1637d162e50fc99b207459f17b0dfb082e0': "为了测试，他们测量了已知年代的样本，包括可通过历史记录定年的古埃及墓葬木材。", // To test it, they measured samples whose ages were already known, including woo
  '76fefcafb721ca88ea42fbde8bc311af63d1b7241582b6c249832c31e00810cc': "当生物死亡时，它停止吸收碳，所含碳-14缓慢衰变。", // When an organism dies, it stops taking in carbon, and the carbon-14 it contain
  '83376384207106818e531d537417f69b1c292f77956e5e5c025f7998c19501f1': "然而，这一方法仍然是测定人类过去最重要的工具之一。", // Yet the method remains one of the most important tools for dating the human pa
  'b0847a4562baac915d4506ab5b86f0e857d003e899309c2d4a3565300e5bc5ff': "1988年，牛津、苏黎世和亚利桑那的实验室分别对都灵裹尸布（一种有人认为是耶稣葬布）切割的小块进行了测年。", // In 1988, laboratories in Oxford, Zurich and Arizona each dated small pieces cu
  '11bd11ef099f9abdb3836fb3196ae2fb06b68b80d078f3ee65a8c077d8d2129e': "最常见的解释是损失厌恶，这是卡尼曼及其同事阿莫斯·特沃斯基提出的观点。", // The most common explanation is loss aversion, an idea developed by Kahneman an
  '526e2603927020e6567294a5a6c367bda2a3e98450e8750e0e0e2740aa091cf6': "人们往往对放弃一个物品的要求远高于他们愿意支付的购买价格，经济学家理查德·塞勒在1980年称之为禀赋效应。", // People tend to demand far more to give up an object than they would pay to acq
  'b9a906a39cffa128f668a6a79782e34088886327c9eca404123c4d3bc517421b': "他们的估值接近买方而非卖方。", // Their valuations were close to those of the buyers rather than the sellers.
  'd231045194fbb3db9ca04965e47d65bf2f0aa82819f21b0c975c78e96e13f885': "因为杯子是随机发放的，大约一半的杯子本应易手。", // Because the mugs had been handed out at random, about half of them would have 
  '854e198a035b9f3f3fe7008298e147353d13f6e3858c0051dcc21afd06e7541b': "生活在远离市场的偏远地区哈扎人没有天赋效应，而生活在接触现代市场更多地区的人则表现出这种效应。", // Hadza living in remote areas, far from markets, showed no endowment effect, wh
  '18f06b976468ebc6df31d9893cdd936334e614e406943f7118d8821b3cdcb032': "房主也可能比潜在买家更重视自己的房屋，这可能导致房产滞留更长时间。", // Homeowners may likewise value their houses more highly than potential buyers d
  'fb9cfe60d787fc48aeb9df07370310f2edd624d97d21f9fe5532d0342cbd2163': "有些学生拿到一个杯子，有些拿到一块巧克力，之后大家都有机会交换。", // Some students were given a mug and others a bar of chocolate, and all were lat
  '97a7ae7f8e15cf770085faaaf056f88dbf237761e5f55d4ae20ccf651b72ee2c': "这表明差距并非因为不愿付出金钱，而是因为业主不愿放弃杯子。", // This suggested that the gap was caused not by any reluctance to part with mone
  '03bd192ce85facd9be60ddd57a962740d3b9ff41b184b4f9b8f6a860a058f916': "根据这一观点，损失的感受比同等规模的收益更强烈。", // According to this idea, losses are felt more strongly than gains of the same s
  '6b4775871e467ae052f1eaefb4ea74efcb42caee260a11b33ddf733107ee3a9c': "在2003年发表的一项体育卡展交易者研究中，约翰·利斯特发现缺乏经验的交易者不愿意放弃他们收到的物品，但随着交易经验的增加，这种顾虑逐渐减少，在最有经验的交易者中消失了。", // In a study of traders at sports-card shows, published in 2003, John List found
  'd642b6e738aff4961a81dbb1aec0097900b7d7f3222563e9a9b8c914cb1730fb': "现在想象一下，你有机会购买一个一模一样的杯子。", // Now imagine that, instead, you are offered the chance to buy an identical mug.
  'd617c3a25cbd4d298766e8715e88bf372b58c829a040a1cfaec989fc0318a95b': "在康奈尔大学，班级中一半的学生会获得咖啡杯，在校园书店售卖六美元，并设有市场供业主向没有咖啡杯的学生出售。", // At Cornell University, half of the students in a class were given coffee mugs 
  '34c95e3295a0be2e6a223585ff9728abf48994fbb3dfb6eb980135c9565b1ee6': "标准经济理论预测你的两个答案应该大致相同，因为这个杯子的价值取决于它对你来说的价值。", // Standard economic theory predicts that your two answers should be roughly the 
  'ec4b39ce9b7acd1e944f6b0df62757c5cc936b0f5faff233335a16667267ade0': "两年后，另一组团队主张如果参与者被仔细培训销售流程，可以弥补杯子实验中的空白，尽管后来尝试重复该结果未成功。", // Two years later, another team argued that the gap in mug experiments could be 
  'e913b184e581cea1efd0a0a39d3c67fa494e9ab66b7821dd521a3bdfbbdca188': "当你说话时，声带会振动，声音通过两条途径传到你的内耳。", // When you speak, your vocal cords vibrate, and the sound reaches your inner ear
  'f76eddb28942f489fb453f8bf57f00057508ac03e925a67fd666fdf4fe273c23': "声音比他们预期的要高更细，有些人很难相信这真的是他们的。", // It sounds higher and thinner than they expected, and some find it hard to beli
  '2107875ccc1d86439e1dea6ecf7226c7f43bf49d67958f425edab64199cb1222': "试着把手指塞进耳朵里哼唱。", // Try putting your fingers in your ears and humming.
  'c9e43a2e89376ddddc3f7c2af4d83517f4f2e435416f47997272143dea97af3a': "这第二条路径称为骨传导。", // This second route is called bone conduction.
  'fa66d31af7e6c9704f6f4378c57a236a14db5e7f4dd401525d07122e59353794': "它们放在颧骨上，而不是遮住耳朵，这样跑步者和骑行者既能听音乐，也能听到周围的交通声。", // They rest on the cheekbones instead of covering the ears, so runners and cycli
  '86a6ba34b90198929a509e201ea0333b26c851dce28dca72c453456dd9359e0e': "但录音并没有出错。", // Yet the recording is not faulty.
  '437b2a08f4c2fdc10753735fe5afa36fcf35499fc95e01987e935812394d7ed6': "同时，振动会直接穿过你头部的骨骼和软组织。", // At the same time, the vibrations pass directly through the bones and soft tiss
  'ed3b42ff887ed81b7d30bb2fe5add29610af425c1cba9ef245ea7110696b5aa0': "普通麦克风只接收空气中的声音，录音时会漏掉声音。", // An ordinary microphone picks up only the sound in the air, so a recording miss
  'a99d8cc91c146671867eaeaecb23ab5e2e118d5f0ea0f8c02d41cea18afef22e': "至于你的录音声音，虽然听起来很奇怪，但那是你朋友们每天都能听到的声音。", // As for your recorded voice, however strange it may seem, it is the one your fr
  '154e3fc5545b141040096fc44680ff14a016c85bc2a88ac5b50eec08c970baeb': "除了通过耳机播放声音外，他们还会将一个小型振动装置按压在耳后骨骼上。", // As well as playing sounds through headphones, they press a small vibrating dev
  '12807fffe6d757fea8dbfc7323aee6f79aae62fa124f5fb6fa751c4016c4da73': "Bone比高音更能承载低音，所以这条路线让你的声音听起来更低沉、更饱满。", // Bone carries low notes better than high ones, so this route makes your voice s
  '2e156364ad3fd8dafec127cc22de873c0e37975864cc084d880e42fdfdcb12f5': "医生在听力测试中使用骨传导。", // Doctors use bone conduction in hearing tests.
  '162180f0c1841b58019d756ecd7150f046e0f4bb9a8e1b41b1a475b725db084f': "据这个著名故事，他当时站在一个磁控管旁，磁控管是雷达中产生微波的部分，突然注意到口袋里的一块巧克力棒已经融化了。", // According to the well-known story, he was standing next to a magnetron, the pa
  '04e31875721fe6b7b26d4b19b2e6a3107c96e4b7703bb80e1529059aae7f397f': "波浪只触及水面以下几厘米，而大盘的中心随着热量向内扩散而变温缓慢。", // The waves reach only a few centimetres below the surface, and the centre of a 
  'af98a92206f13d3ca9b03e98208a009a854167a0afeb575209222d5d7ed5ba45': "尖锐的金属片，如叉子，可能会引发火花。", // Pointed pieces of metal, such as a fork, can cause sparks.
  'cfe18ae51355bbcb04d6d16917ba054b3b3ebe85826170870be470b5148f642c': "20世纪40年代，一位名叫珀西·斯宾塞的美国工程师正在为一家名为雷神公司的公司从事雷达设备研发。", // In the 1940s, an American engineer named Percy Spencer was working on radar eq
  'b3b1df266725ff595a032a974f5d8eaae7686425ba175ca9cee4d1313278d8dc': "许多人认为微波炉是从内部向外烹饪食物，但事实并非如此。", // Many people believe that microwaves cook food from the inside out, but this is
  '150626e9a553803f6e0c75d688627840d193148258d6e1ea2c067a5fa16cffa8': "微波产生一个电场，每秒变化数十亿次，分子不断旋转以对齐。", // The microwaves create an electric field that changes direction billions of tim
  '1526ad8cac81ebf278f217e71d7c9a0ee34c4eaec3eb01eba10b011d7d50e86c': "这就是为什么说明书常让你在吃之前搅拌食物或静置一分钟。", // This is why instructions often tell you to stir food or let it stand for a min
  'd39c162f91b4b024bd2c7e5d44cf4d452400628d79a38df835102988039f9da7': "出于好奇，斯宾塞在磁控管附近放了一些爆米花，很快它开始爆裂。", // Curious, Spencer put some popcorn near the magnetron, and it soon began to pop
  'ae5e776c2a528830e8604ec999610ce795e03808fca0f397a1404991dbf2f019': "烤箱的金属墙壁将波束在室内，门上的金属屏风也是如此：它的孔洞能透出光线，让你能看着食物，但这些孔太小，微波炉无法通过。", // The metal walls of the oven keep the waves inside, and so does the metal scree
  'baf6aab1d371f787217dfc552eb27f81cc38ad31333bf7b425022fa7257e33bb': "他意识到微波炉能烹饪食物。", // Microwaves, he realised, could cook food.
  '8855ac004128b3eb5432613ade38fdc1af3399b38924a4d932822b40348decf9': "真正的原因是淀粉，这是面粉中的主要成分。", // The real cause is starch, the main substance in flour.
  'f14eff8399069302efc2f9db94cee24cc8c8102ec88b8f3dec483e0f82e759f1': "而在冷冻室里，这个过程几乎停止，这也是为什么面包可以冷冻数周，解冻后依然新鲜。", // In a freezer, on the other hand, the process almost stops, which is why bread 
  '0e96f0b899eff06a2075d8c5a23da85451e85eb4f464fb6ef340c2aba2b0b5b9': "大多数人认为它只是干了，但陈旧的面包可能含有的水分几乎和新鲜面包一样多。", // Most people assume that it has simply dried out, but stale bread may contain a
  '77d6940d2aab01b91d2de7dc55e2a6505eef21690ea0f11b75452a23b3e430bf': "饼皮也会变化。", // The crust changes too.
  'c0cf1fe0d97a764b7a073d29c01e0b15686c879270ccd82d6fed0d9f40726ec2': "用烤箱或烤面包机加热陈旧面包，可以融化淀粉晶体，面包又变软。", // Heating stale bread in an oven or a toaster melts the starch crystals, and the
  '3ec73f89e8a2054ae78ae319fae77cc52cce36587d0fbc5b6321acac4d74d8e6': "昨天还柔软有弹性的面包，今天可能变得结实且易碎。", // A loaf that was soft and springy yesterday can be firm and crumbly today.
  'e6160ad8da82fb90c9de51a629980e69d93d47a20c2862fd0d3b36a062e6798a': "水分从面包柔软的内侧流向酥脆的外壳，酥脆的外壳逐渐变得坚硬且有皮革感。", // Moisture moves from the soft inside of the loaf to the crisp crust, which slow
  'f59cddf159f73f4722eb64db7957870551dfe7ddfab7949b71da302d33291546': "在烘烤过程中，这些谷物会吸收面团中的水分，膨胀并失去有序结构，这也是新鲜面包变得柔软的原因。", // During baking, these grains soak up water from the dough, swell and lose their
  '75e299cb809001e7d4028b82c148eac742bba185e8c23ab5969ff82afe0dad8d': "幸运的是，陈旧的面包仍有它的用途，从面包屑到面包布丁。", // Luckily, stale bread still has its uses, from breadcrumbs to bread pudding.
  'a8fb574191bb1740375f1cbc8ac823ca0ead262cede394c0e53a7f79d949ce1a': "在小麦中，淀粉以细小、紧密排列的谷物储存。", // In wheat, starch is stored as tiny, tightly packed grains.
  '7475cb5526a210478fa667efd9ee6790ea485d669a9bee3fa5674e175fa74b0d': "即使是密封在塑料袋里、没有水分流失的面包，也会变质。", // Even a loaf sealed in a plastic bag, from which no moisture can escape, still 
  'e60554160164f9a469ad62338ced5e3c22d74645f419ff73b00e581b0a099808': "陈旧甚至可以被逆转，至少暂时如此。", // Staling can even be reversed, at least for a while.
  '201afdd7eb983f8e2504365556dd710ea2e106f4bf7e9b32397a3f4b714256f5': "然而，随着面包冷却，长长的淀粉分子会慢慢重新聚集成结实的晶状图案。", // As the loaf cools, however, the long starch molecules slowly start to pack tog
  '027eb4edc7ec48a640ff522b417ce1191c26191badf9a6df75bca3f55b027d5b': "不过这种效果不会持续太久：一旦冷却，面包很快就会变硬。", // The effect does not last, though: once it cools, the bread quickly goes stale 
  'd46b7e577c8a2b2603ab455bf2de51a4277be9eedfa0161be2e4ab36cd5d08bf': "在我们能看到的颜色中，红色波浪最长，蓝色和紫色波浪最短。", // Of the colours we can see, red has the longest waves, while blue and violet ha
  'bbbb459166589be3e33572f049a6ef7bb7afc03a169a8dad379b48dd3aa7d287': "相比之下，云看起来是白色的，因为它们的水滴远大于空气分子，且颜色分布大致均匀。", // Clouds, in contrast, look white because their water droplets are far larger th
  'ab3690156d3570916534e7c910114a7c706099fffed0b043b1df8e8de84960db': "阳光在到达地面的过程中穿过空气，而空气中主要由微小的氮和氧分子组成。", // On its way to the ground, sunlight passes through the air, which is made mostl
  'd71493ca36cf3462c5990abf797ac5372b46a059b49869ba5c3f86ae8a46b633': "在火星上，稀薄空气中的细尘使白天天空呈现黄褐色，而落日周围的天空则呈现蓝色。", // On Mars, fine dust in the thin air turns the daytime sky a yellowish brown, wh
  '2894d122462bc52364143b5ec9d11543f2fe1e3a09bb868b5ac551b2ddd88945': "月球几乎没有大气层，所以即使在白天，天空也是黑色的。", // The Moon has almost no atmosphere, so its sky is black even in the daytime.
  'c4b9dc58527ee68e966779591daa029785fec77d4a479e2f3b74181e8227e7cc': "阳光看起来是白色的，但实际上是彩虹中所有颜色的混合。", // Sunlight looks white, but it is really a mixture of all the colours of the rai
  '844b3abd45e36dbdf5437a40b82014ff7d04ef7dc8f19c2233c2a6211388dcb7': "另一个原因是我们的眼睛对蓝色更敏感。", // Another is that our eyes are much more sensitive to blue.
  'c1619bba1059e0bd96d8c4ccd88964b00a2e3c3b83733fa7b6402721e1b4ace4': "其中一个原因是阳光含有的紫色光比蓝色少。", // One reason is that sunlight contains less violet light than blue.
  '22453dd8eefbd6da34b739167534504155ac254ec8a7246f6da530551e9d896f': "这散射的蓝光从天空的各个角落射入我们的眼睛，因此整个天空看起来都是蓝色的。", // This scattered blue light reaches our eyes from every part of the sky, and so 
  '3379f5628ace027cd971c6d74cdbc47d67815768ac83d8f47b8823f8c6250511': "当太阳低垂时，光线必须穿过更多的空气才能到达我们这里，等到太阳到达时，大部分蓝色已经散开，主要只剩下橙色和红色。", // When the sun is low, its light must pass through much more air to reach us, an
  '88cd2403772d0efae0a152cad92d9b5f5683dd8f722d0a0795c7a26d8a7b8511': "其他世界则展示了空气的差异。", // Other worlds show how much depends on the air.
  'e7609ce4b22efe506b5829b9ab0cce076d9cc65734c372ff2ab038412e7a7845': "在新加坡的步道和废地上，生长着一种低矮、带刺的植物，叶子如羽毛，花朵蓬松，粉色。", // Along paths and on waste ground in Singapore grows a low, prickly plant with f
  '2c48ce8e7e36566ff137a84ff7501a38d3d085dd65fd05a2eed3cc6581cae3dc': "重新填充细胞需要更长时间，这也是叶片几分钟后才会重新展开的原因。", // Refilling the cells takes much longer, which is why a leaf reopens only after 
  'aa4ad574d05e013c241e3bf82684b79d67855dd89cc0803a113adc0181059ee4': "研究人员认为，植物已经学会了坠落无害，闭合叶片只会浪费能量。", // The researchers argued that the plants had learned that the fall was harmless,
  '04d405d6458912c0abd44bfebee75ac473bf8ba2374719d7283aa4492b907bfb': "突然的褶皱可能会吓到昆虫或甩掉它，倒下的植物看起来更小，对饥饿的动物来说也更不吸引人。", // A sudden fold may startle an insect or shake it off, and a collapsed plant loo
  'e76ba84af7d384a2a430b0ddfd2007ead14e47d06d70e0edf8b46d7f7ad02a0a': "它最初生长在热带美洲，但现在已成为全球温暖国家常见的杂草。", // It first grew in the tropical Americas but is now a common weed in warm countr
  '3c759911d237ce1dcec14809961fb20763d71d86ed6796ac3e895b4a2b989a33': "触摸一片叶子，几秒钟内它的小叶会成对折叠在一起。", // Touch a leaf, and within seconds its tiny leaflets fold together in pairs.
  'f54af80ccdb94a87345846f9232a92bce9c0bf148b71a6df7f15eea5964da706': "每片小叶基部有一个由通常充满水分的细胞组成的小肿块，这些细胞的压力使小叶保持小叶张开。", // At the base of each leaflet is a small swelling made of cells that are normall
  'da1e5a48cd6ab5774abb484959a4bf5c44de7b5f639752db41efdf2947252eec': "并非所有人都同意没有大脑的生物真的能学习，但小路旁的小植物显然比看起来复杂得多。", // Not everyone agrees that a living thing without a brain can really learn, but 
  '39a6d654cc113ccdd3e2c5e50cfdc8dba9c5a190eed33282f51c2e127d8dc1d3': "大约一个月后再次检测时，它们依然保持叶子开放。", // When they were tested again about a month later, they still kept their leaves 
  '1ee41b2af2661b586c600b4242eca5daf83a0c1d33b00d1a42447cb445ba250c': "叶片闭合时，植物接收的阳光减少，因此产生的食物也减少。", // While its leaves are closed, the plant catches less sunlight and so makes less
  '0000ba70053fb630daf473dc84b7f30c94569b7816bb551ad3fdb6e3b396c197': "很快我看到一排小气泡。", // Soon I saw a line of little bubbles.
  '4438d9e74b0dde505d149b1dbfe06cf13ec8608f0c0684cd37a5fabcd04bc7c6': "我没有特别的工具，所以用了两把旧勺子的手柄。", // I had no special tools, so I used the handles of two old spoons.
  '3b1753a5101f0efc82376ab23357d0bc820ca2784da0718d5fb5c2d0668a8b64': "视频里有个技巧。", // The video had a trick for this.
  '34d48ee5c148178f983fde80c5f6761d560ffe604e050967a5889892bd9d8af5': "然后我打开了叔叔的维修包。", // Then I opened the repair kit from my uncle.
  'ea2b055011195cbe4fff82e82896c2da1e0270fb4439c78783da9532988bd70a': "我在去海滩的路上把一切都解释了。", // I explained everything on the way to the beach.
  '3019bb3b60267a886fdf8b9015bcc5a8501a79c91edcf2c13ad5eaea776d8466': "我把管子放进一碗水里，一部分一部分。", // I put the tube into a bowl of water, one part at a time.
  '1a271993d8a7dfaf72ae98b463daa81d2036fb441c29dab9180e32030788986a': "我把管子晾干，用笔在洞口画了一个圆。", // I dried the tube and used a pen to draw a circle round the hole.
  '4feb13cb0e1a0a0495194f6d38f6a3a6b37d2e1ac87e219fa5d57f75e3d615c4': "下周五，我收到丹尼尔的信息：“我的轮胎瘪了。", // The next Friday, I got a message from Daniel: "My tyre is flat.
  'df6e8016f754422cce207ffba55fa02c6d9970436f3997569a901606346bd4e6': "“你的手怎么了？", // "What happened to your hands?
  '92b51fa03a9f82b2941f4211dae88daf1ca91ef2148d91ab7981936f3f9dda38': "十分钟后，依然很难受。", // Ten minutes later, it was still hard.
  '298f5173a1c525846d6bd5cdbb0b5306669bcea7873fd2851358fbcb2f6a8070': "我们附近的自行车店要到十一点才开门，我不想等。", // The bike shop near us does not open until eleven, and I did not want to wait.
  '9ab8348d9398769b792496c225840785d371638088f7d44b1d108a4dffced743': "我在洞口涂了胶水，等了五分钟，然后用力压了一块补丁。", // I put some glue round the hole, waited five minutes and pushed a patch down ha
  '91fa11f1ab708b0d2e0f09277d267b1cc7523d3e931f187afd23c425eb0704f7': "一周时间，我们在食堂后面的草地上课间练习。", // For a week, we practised at recess on the grass behind the canteen.
  '361444f8932c7f4a88f8315cacb5a7d4f163b91e5bc734dc0adeb4d072e17524': "绳子上的红旗越过了我们的防线，我们听到了哨声。", // The red flag on the rope went over our line, and we heard the whistle.
  'd5ff3852c48b54ee1c20159cc772fda87e121c52306d533e65f0541556f1a4d1': "首先，他们向后靠，好像坐在椅子上。", // First, they leaned back, as if they were sitting on a chair.
  'a0f6aa9b2724d0e20f40d1d518ca34630e92616146099b9e81f7e96a3be819ff': "他借了我们仓库里的一根旧绳子。", // He let us borrow an old rope from the store room.
  '23569c969f6d9a8067f42dd80b78b143aed889515b6314953ee9b98a7c629d57': "我们班级依然尖叫跳跃，仿佛赢得了奖杯。", // Our class still screamed and jumped as if we had won the cup.
  'e479f99b45c300aa4a33b06faa3731b19aaae24a5c08cf69d7d059509faf0093': "第三，没人拉，直到队长喊：“一，二，拉！", // Third, nobody pulled until their captain shouted, "One, two, PULL!
  '28f368d3d8d0b9e2e099c0f68785196f6b15dcb78ffa94ce2da60146ca1456bd': "绳子慢慢地向我们移动。", // Slowly, the rope moved towards us.
  '934685dfa3d39ec6b7fd04e7c57d4e1c81fa12fd2ba515949f6c947a175051ab': "我注意到三件事。", // I noticed three things.
  'e093b2344cd8ae2d2bbc1c0d8fd9d460aebd5793560991b10d6b4c87faa64452': "每年运动会，我们班的拔河比赛都输了。", // Every year at sports day, our class loses the tug of war.
  '616782ec5b179815579d26f15f856dbc371e8dc053f6b85719e9cada247c6c47': "等电话。", // Wait for the call.
  '7d0901227aaaf3f58a52a6e1b942aac70c9e39513fe1503b80fd89f3885bfd11': "我们和橄榄球队拉成了拉锯，他们每次都赢了。", // We pulled against the football team, and they won every time.
  'ff784688f6c692ef662fefd9c64744077ff53a2bc96e1830bf874562d6368c15': "有人笑了，但我们的体育老师拉赫曼先生很喜欢这个主意。", // Some people laughed, but our PE teacher, Mr Rahman, liked the idea.
  'c9514405f615f9eeb8dd1d37b344c1e1cea52521c6230a0184698d348aca27e8': "在第二次拉之前，我转向我的班级。", // Before the second pull, I turned to my class.
  'c2642b7e66901d0d730b9454dd17ecbdbe1d20815444045e14a4eea709d88e25': "在红绿灯处，我们三次错过了绿人。", // At the traffic lights, we missed the green man three times.
  '3a2d72e3c1eab181ec6e8c3fe78172b3351853538286a644b91ce4cb68c919e9': "俊凯一边走一边数数，我们在第一个绿人面前过了马路。", // Jun Kai walked and counted at the same time, and we crossed the road at the fi
  '5436f3936e3a8f5d0267ae45a12f646200cd13696492327bcf0ff2bd0445794b': "他必须数清每一只蜗牛，但他必须继续走。", // He had to count every snail, but he had to keep walking.
  '7382adf7eb038a5c11f5e6bb7638a5bcffcaa4968996860f54a89ceaf41866e2': "上个月早上下雨，下午去公园的小路上满是蜗牛。", // Last month, it rained in the morning, and by the afternoon the path to the par
  '11e0bfe83e79b86aabc691826499df07ce96d85695f2eb639e3d9121d021bad1': "我的工作是带五个孩子去马路对面的公园。", // My job is to walk five children to the park across the road.
  '0644c7b351cbe4d23d60f1e7c330d47ce87fcd74f6380d7e49dbf1858e9a2da5': "下周三，又下起了雨。", // The next Wednesday, it rained again.
  '83814f28794600d9fb46cfc1f9334ac7eed5cea4483ae9670bf99965c602406b': "一周后，俊凯给了我一幅画，画着一个高个子男孩和二十三只蜗牛。", // A week later, Jun Kai gave me a drawing of a tall boy and twenty-three snails.
  '2abb8c82f111deba44c82a09bba3dccce2930fbf2ad2a9a2bc3f50809942076e': "这一次，每个孩子都有工作。", // This time, every child had a job.
  '9ad347aa1b623bf2d98da8edf57a22940409027402ff6fe11cc5094cd250fb74': "但也许他可以爱他们，继续前行。", // But maybe he could love them and keep walking.
  '512960fdccb94c07cb1bd9c682737cf5e4ef0009a8c335b283e69bf6d8c97ac8': "我无法阻止纯凯爱上蜗牛。", // I could not stop Jun Kai from loving snails.
  '3c56bf7f872ae698b9712ee7ac7e88f7553563a281339be86bc9a85224a4d9e1': "我们到公园很晚，孩子们只有十分钟时间玩耍。", // We got to the park late, and the children had only ten minutes to play.
  'fdfb1c0ac60588929dc98d6a7a77b0c438e35f9d7b464d2a0e8dededee7524e6': "那天晚上我有了一个主意。", // That night I had an idea.
  'fe6c06ec51cdbc045f5b3e331e0e7735842b794b8004baf249b051e367dd45ff': "其他人数着红色车。", // The others counted red cars.
  'af3e327283104350ac9daa041df9df19c19200fb1aff79160507f7b6fafd5735': "一个男孩，Jun Kai，每到一只蜗牛前都会停下来看并打招呼。", // One boy, Jun Kai, stopped at every snail to look at it and say hello.
  '39c50f72baf2d1239f38036a4711a7452ce7875da1120327c0a90353d4ba0df6': "我的声音清晰响亮。", // My voice was loud and clear.
  'aac7e6c54b8db6ead589214fa5f17d41ccf6b16a3aed4399cb0da3097d826913': "“按黑灯按钮，等红灯，”她说。", // "Press the black button, and wait for the red light," she said.
  '9776057f8bce6189e7a454a40fee60fc6d2aff9158f388880b227ebd1aab395d': "第四次后他就睡着了。", // He was asleep after the fourth time.
  '7bb6c0a9f8319fa5341d26745195b2b01e91091e0af13b19a763f27530fec4c2': "我非常紧张。", // I was very nervous.
  'ba779868843ce472a5e79472a5a7b711499f929af97668624741e50d3f6c3a3c': "我的手在发抖，声音也很小。", // My hands were shaking, and my voice was very small.
  'f035e93eb1e90f45308ae6d5dd146053a875857b1aaa7763cdb18c24fce48f88': "每周都有一名学生在办公室用麦克风为全校读早间新闻。", // Every week, one student reads the morning news to our whole school from a micr
  '8e612159cb706f284fec226cb6a07116fb51a9801c62039ca642c9e3fab55570': "但我读完所有内容，没有一个错误。", // But I read everything without one mistake.
  '9d2687473d6c29d74aab3f9f0f610a1bcb9da72f22a7b8ad538cbc23de6bf06d': "上周一轮到我了。", // Last Monday it was my turn.
  '8533d4679c4867fa782dfa2b126883ef0b206473e1716d2e3a64ee679cfea105': "周日晚上我在弟弟面前练习了十次。", // On Sunday night I practised ten times in front of my little brother.
  '6bc308bd23deed716804b7a859540b64f4ab8d0ff526856291debc2e3e00de30': "我已经读过一次，没发生什么坏事。", // I had read it once already, and nothing bad had happened.
  '6d790876de8e3a5522a0d648f8cd888ef81ebc10e89547434b51beb19645d9c0': "图书馆周五会提前关闭，足球队赢了，有人丢了一个绿色水瓶。", // The library would close early on Friday, the football team had won, and someon
  '5dc782b9001a6380f79314b31980b8dd6f70d73c44d706c969fc760be8869628': "然后她的手机响了，她转身离开了。", // Then her phone rang, and she walked away.
  '1a9c49f7d47c9156e721c0db059310915cb67908f94bfb0773e3497adebd5625': "当我打开门时，班主任皮莱先生抬头看了我一眼。", // When I opened the door, my form teacher, Mr Pillai, looked up.
  '902cdd4791743586a2a17323861e956012260b5e369cc2404a83b301af5a7637': "七点半我开始读书。", // At seven thirty I started to read.
  'd68a071e1eb7e0e1fc6af1b4c6e8c2cbfef37c9e7c4e7f2d13ab1fe9fa6b49f3': "我弟弟哈基姆七岁，他害怕雷声。", // My little brother Hakim is seven, and he is afraid of thunder.
  '284803760df4fd34ca62ab0d0a03a6b58d78cd4ba49b2e57611d5cef5a87f78a': "光传播速度远快于声音，所以我们先看到闪电，而不是听到雷声。", // Light travels much faster than sound, so we see lightning before we hear thund
  '8ba78b132f45616506269a83209d69ffbf792450c6948d2a2aea2798df2f09af': "如果你数闪光和雷声之间的秒数，你就知道风暴有多远。", // If you count the seconds between the flash and the thunder, you know how far a
  '4933300120d7d4c14de414e7e998efaeb5d106e9758999b338990abcd028b54a': "每三秒大约一公里。", // Every three seconds is about one kilometre.
  'a2ff9562d6c703422371d5edb547b72ba6092d4007d82dce1b4d9c4fd35748da': "暴风雨来临时，他躲在毯子里，双手捂住耳朵。", // When a storm comes, he hides under his blanket and puts his hands over his ear
  '67df10f815c8fbdcff331646575877c7c002c90f4b4fad1f0ffafdb05cdacbc5': "上个月，我在科学中学到了一个小窍门。", // Last month, I learned a trick in science.
  '12b194206a38400f4053b24fdbcd51088a8c9e22e124e64961d79667b6a5a62d': "哈基姆像往常一样躲在毯子里。", // Hakim was under his blanket as usual.
  'ad7844442dc70738ad8bad1a5fe9dd48ca0284353853cb66b92e12d9e5ea0c29': "当房间变白时，开始数数。", // When the room goes white, start counting.
  '99053d40f05dfb673d5960fbe5440f4425e70e21bec8db812c6f7116e6c9334a': "我坐在他床上说：“我们来玩个游戏吧。", // I sat on his bed and said, "Let's play a game.
  'b8002460f5dfe79009a3ba0aeced5456b1779456466167d3d2a8e7e14f91fe91': "哈基姆把头从毯子里探出来。", // Hakim put his head out from the blanket.
  '5d4216849f5b2c8b5204ea61a10d997c94d67cb721fd9cd280697f5df6e581ae': "男孩背脊挺直，靠着滑板站着，头顶停在红线下方大约一指宽的地方。", // The boy stood against the board with his back very straight, and the top of hi
  '0799a024ad4ca851be500cb4baf24467696afff58de6cdd9bdb4d667448565d2': "我第一天早上，我的主管哈基姆先生敲了敲板子说：“这条线不是你们可以移动的。", // On my first morning, my supervisor, Mr Hakim, tapped the board and said, "This
  '9b554c1b72384261b405e6edfe540ff302ba4b462fe7f09a30ecce64fbb1790c': "那人走近，压低声音。", // The man came closer and lowered his voice.
  '2d262ceae08e210b8114e3dcc44ba81b9a3f56f8e0ddc918baee914eba340c4f': "他说他们排了四十分钟队，男孩在学校测量过，个子够高。", // He said they had queued for forty minutes, and that the boy had been measured 
  '93ca3380750e18c50eda39ed4ad7771893dd7bbd8938e47eed851af2b6af88fc': "我的声音颤抖，握着栏杆紧得手都疼了。", // My voice shook, and I was holding the rail so tightly that my hand hurt.
  'dd59add744afceb9302146e8522740d44b6a781f632e78599570e4e0212f72cb': "他的父亲站在楼梯底部，双臂交叉，一直注视着他。", // His father stood at the bottom with his arms folded, watching him the whole ti
  '83fb9a939652ab5c39d9f3fb3c74e7dee16342da97b9db504dddccdcd735be73': "我长长地吐了口气，意识到自己整个下午都在找他们。", // I let out a long breath and realised that I had been looking for them all afte
  'bca384d359f7321cd52a8d883344726019b5132f4943a7d126d1724fec00b675': "问题是，他并非完全错了。", // The trouble was that he was not completely wrong.
  '18af1b0f4a32c9e6a013d4e45fa0cdaa7f10e80c8ee907dbed15d800096aae8e': "然后我尽量礼貌地告诉那人，他儿子不够高。", // Then I told the man, as politely as I could, that his son was not tall enough.
  'd305fb60f7bec1b6beb8a84f48a61ae2d4ceffcace4c590bed76eb1158edd2fa': "下午剩下的时间里，滑板就不再有趣了。", // For the rest of the afternoon, the board stopped being fun.
  'f04f1911536e29bdd039dbeada844a0ed298b0f140829dde5ebe28e3500726db': "我仔细看了两遍。", // I looked twice, to be sure.
  '2c7050bd5cbb7c210b8915185a820692f0aab256eb80b68e088cba8dd6ba35a6': "我想说，当一个孩子走上板子，等我做决定的那一刻，我并不喜欢。", // I would like to say that I did not enjoy the moment when a child stepped up to
  '45c78e9861f594ffbbff017a752cbbdb4f97d07b7b1702bf2cd8db893425d1cc': "当孩子太矮时，大多数家长只是看着队伍，看着孩子，默默引导他们去看较小的幻灯片。", // When a child was too short, most parents simply looked at the line, looked at 
  'c828b8dd1bf7c77443f5a595e5839a86a5c1fd9e8bf498201d9e8c9b7a80f2fd': "头部未触及绳索的孩子无法下去。", // A child whose head did not reach the line could not go down.
  '0573f7c3385eb82492745c8b506c54250bdea83c8b57fc049831aac3bc9ba4e0': "快关门时，我看到男孩坐在公园远端的一个小滑梯上。", // Near closing time, I saw the boy on a small slide at the far end of the park.
  '479e2d2bbb76b6e21d26ce36766aa224a55ffd4933c17b911db7d4f53679491a': "我在最高的滑梯顶端工作，每个孩子都被一块画有红线的木板对比。", // I worked at the top of the tallest slide, where I checked every child against 
  '9fdb5698786d978171b145353fd7c4b2551a9aec94615a2668f7874ab7459042': "他一句话也没说，递给我备用的。", // Without a word, he passed me his spare one.
  '37dde9921566489f89060e91e3c55a5d4a51320a097361ada8382bbbd2349cc5': "那天课间我找到了达伦，告诉了他三件事。", // At recess that day I found Darren and told him three things.
  'ccf4ac0739086e445a057e4430d2ced9c6d4d67d6adf21e17243f082d4a4ba8d': "但去年，数学考试前，他看到我在包里翻找放在家里的计算器。", // But last year, before the Maths exam, he saw me searching my bag for the calcu
  '0b70cf9a1d95092666a5d758040836da1c54160991674067e7c766175e674e01': "他很快告诉我，只有几个定义，其他他都知道。", // It was only a few definitions, he told me quickly, and he knew everything else
  '7342099b0e90698309d13dd262b3e5e5cbd447c37a5890b7e603d137f81c0a19': "第四次，他把封面翻过来，我从他肩膀上看到里面塞着一小块纸，上面写着细小的蓝色字。", // The fourth time, he turned the cover over, and over his shoulder I saw a small
  '9546e410655dc66cd85ecd98c90881c7c53d368e2fc78da22eb262a1e933ae10': "它们的长度完全一样。", // They were exactly the same length.
  '34719cc789919b245b0de3ca4ffb6e6b56b9ecfa84f5a1cc4ac12ae5a09226a4': "每次她走近我们，我的手都会开始抬起。", // Each time she came towards us, my hand started to rise.
  '1853a33f007492f11ad840a2065dae1daa03aa91e6cc070c8e3c12ac3136688f': "那一周他都没和我说话。", // He did not speak to me for the rest of the week.
  'b126e745748fab5dd6864eb32a2d9f23891e246599f04956dee26f9625090ccc': "我告诉自己，这不关我的事。", // It was not my business, I told myself.
  '693cd5566675cf4a526cf8c0f998094d78a08f5b8b4c439798c6fd4e7af402f1': "有些日子我觉得我给了他第二次机会，就像他曾经没被要求就把计算器递给我一样。", // Some days I think I gave him a second chance, the way he once gave me his calc
  '50f53b23be3d9cb1d41ae1f427f340fc091d7d36bb64593aa7e0dc28421b9f50': "那天晚上我躺在床上，脑海里列着两份清单：说出来的理由和不说的理由。", // That night I lay awake making two lists in my head: reasons to tell and reason
  'df996fffcf607f6927ac2e78f0fd7c62de17305e0b4892f33040f6bb2e7768a5': "我不会举报他。", // I would not report him.
  'ea042ec6a09bfe3f63ebe4460e163f5ebfec74e13e22c70f244777f971a9afef': "负责老师钱德兰女士缓缓穿过教室。", // Mrs Chandran, the teacher in charge, walked slowly between the rows.
  'afa2a56b883fe34289e8035dc9224cbcf11c56db4bb5e3f9b1bdae54dd7f285f': "周一我走到教职工休息室门口，透过玻璃看到钱德兰夫人，躲在一堆考试卷后面。", // On Monday I went as far as the staff room door and saw Mrs Chandran through th
  '131b9e107bb82f44a94d4f70879f6a089b981ccf6e4168c2df88b3727e9167ab': "如果他再犯一次，我不会再保持沉默。", // And if he ever did it again, I would not keep quiet a second time.
  '2e824e6c86ec097f339d7d6b1983819eefb19f05bce2d25332c7431974852c3d': "他们拉着我的尾巴，还用拳头打我的肚子，看看我会不会倒下，其中一个狠狠地踢了我一脚。", // They pulled my tail and punched my stomach to see if I would fall over, and on
  '0603372d2787fdb04e4181f49592b3d73d9653c996fa1a308955bfd1472f3755': "上学期我在一个购物中心找到了周末工作，穿着熊装。", // Last term I got a weekend job at a shopping centre, wearing a bear costume.
  'b5f9f231a6e2717f1d3d01b9c6d5374ebc19ba12de5cb9f3273cda9001b2c0cd': "我的主管刘先生给了我三条规则。", // My supervisor, Mr Lau, gave me three rules.
  '013a6a25166fdc1638cc6c68ede3fbd66f270440a9dc055df3fc27b6d2287138': "小孩子们跑过来抱着我的腿，父母们则在拍照。", // Small children ran up to me and hugged my legs while their parents took photos
  '216bf55b23abc53dd865eb4f6691f0aae01322db94c654c25687c47ae6408ddb': "我的爪子里，双手握成拳头。", // Inside my paws, my hands closed into fists.
  '7c5eb0820571bfefe502e41e6d989520955c368199a0b953bff1dfbcdc86a4d9': "她坐在后排，课间时间在图书馆里。", // She sat at the back and spent recess in the library.
  'c5fda784cd4668dbf8efb8c05028b90c3cb3901469924781a62dc1ec5d5b132c': "“但她说的是对熊说的，不是对我说的，我觉得如果她知道是谁听到了，可能会觉得尴尬。", // " But she had said it to a bear, not to me, and I thought she might feel embar
  'c2acaec2563f498e20818d239dba197a2176b41b8d983c71dce56c7dded000ba': "然后她用手捂住嘴，笑得很开心，直到大家都转头看。", // Then she put her hand over her mouth and laughed, properly this time, until pe
  'bfb0aec888121909d924e5c3a5d351a752a9168d120e64eca8e19a5709b1e681': "我站得一动不动，屏住呼吸，仿佛她能透过毛发听见。", // I stood very still and held my breath, as if she could hear it through the fur
  'e01d8153759912eb46ef859303a42f5420f69923864f06429c3ebc88d7beaa03': "拍完照后，我们一起坐在长椅上，她跪着看着蛋糕盒。", // After the photo we sat down together on a bench, and she looked at the cake bo
  'a7aaa2652fe8856cf54a4b28234ce4e28ce2834c25039b882b1a0d8065856355': "她独自走着，手里提着一个小蛋糕盒，径直朝我走来。", // She was walking alone, carrying a small cake box, and she came straight toward
  '3c1425255e9956d05e8f0a6927871e20f81e0e0b6c6e10ddcf9bb2dba9e92098': "她笑了，但那并不是真正的笑。", // " She laughed, but it was not really a laugh.
  '07397e1baf1eb5b8022320741ec3cdb8b5633d9285486bf5c36e6ed3fdbf80aa': "熊不会说话，所以它必须做别的事情。", // The bear could not speak, so the bear would have to do something else.
  'b776f0ce479ce1df72bbd3d7fb6aff610eb34ab21081efedb93b0568661d848a': "有那么一瞬间，我确信她知道是我。", // For a moment I was sure she knew it was me.
  '3b28a853ef55408984b83e3d03e336bf4463e0e4a0b4f73625df200d86a45a61': "他打鼾。", // He snored.
  '786650fd297a5e61afa376dd30828d1022612b2411e29eb01a314bd741d7b979': "我看着母亲的脸越来越怀疑，我继续说。", // I watched the mother's face grow more and more doubtful, and I kept going.
  'c0793dce054204b5236e8102f357c10d626c745c993ee960fefd5ec8e1c0819d': "他吃了治疗僵硬膝盖的药，害怕雷声，讨厌猫。", // He took medicine for his stiff knees, he was afraid of thunder and he hated ca
  'a40b0c79539cff71c0658ee0ae48e3e83b0d4b44645a31a49f70d376368730c8': "“他从不对孩子吠叫。", // "He never barks at children.
  'dff8718e05011fffc5aefe4a380cea87f78c004f0b8c4b385dfce49f12706cbc': "大多数来访的家庭都会直接走过他的犬舍，直接去找小狗们。", // Most families who visited walked straight past his kennel to the puppies.
  '3f7259179ec03f6633e3c4237bcbe5d9dd1e52c8a5db828eb0eed31103c4cc45': "那时，一切都变得模糊。", // By then, everything had gone blurry.
  '9c6de04740ba2e34b7b9987eed78163f7178cff0a556bba28960d2cba0671f52': "我妈妈对狗过敏，所以我没法带他回家。", // My mother is allergic to dogs, so I could not take him home.
  '15b2904e54d745461345d97d79d642697e10618894919795cec859c9fe65d910': "下面写着：“他依然拉扯。", // Underneath they had written: "He still pulls.
  '300bf1b331a0501ed5b05f4b8980fa35ff607147045690d2e2ed30c32710278a': "我听到自己快而愉快的声音，一遍又一遍地列举着一件坏事，我明白自己在做什么。", // I heard my own voice, fast and cheerful, listing one bad thing after another, 
  '8536d1ef65f46218ba58bb818130997170a394c298fb272e9eb8dacd7db23ad5': "我大声笑了出来。", // " I laughed out loud.
  'ef45a69124401b9e05a36e849e1232d69045269cd1471568c051991dc046c2e7': "布鲁诺在动物收容所待的时间比任何其他狗都长。", // Bruno had been at the animal shelter longer than any other dog.
  '433085c364e637ab3224390092edfa64befa364d08ed716c7d5b783d8078bda7': "我对他了如指掌。", // I knew everything about him.
  '04c2b373ca4c452883eee3166556ff512e0d4d2e04cf4e599f5dd075a75e743d': "他九岁，脸色灰白，曾被收养两次，又被带回来两次。", // He was nine, with a grey face, and he had been adopted twice and brought back 
  '719e7c3007db4e2c3020f7f12ac3422990710429f1874dd12a3c77769b9f42b2': "父母互看一眼，点了点头。", // The parents looked at each other and nodded.
  'ccf7895853546e014701ef7a957b0a5bf11a9ba2e9772e46b5e6964c26e1f9a9': "字母写得又大又抖，像小学一年级的孩子写的，等我写完一行，老师已经在看下一张幻灯片了。", // The letters came out large and shaky, like a Primary One child's, and by the t
  'fd48bcf4f3ef46ca504643e4fe7df7582b45484d0f032f451313ae70eb50fe35': "“我坐在地上，一遍又一遍地读着那些字，喉咙紧绷。", // " I sat on the floor and read the words again and again, and my throat went ti
  'ecd6c07c77e23daff89921b1247a93b87005f65e7802b92f49580566731a6882': "我的手臂打了六周石膏。", // My arm went into a cast for six weeks.
  '50194c4c14c4e8f95c65090195fe07cf1bfc36ff1435bfcfab5d2c44aaff6d20': "每次有人帮我做，我都会说“谢谢”，微笑着，然后又想对着谁大喊。", // Every time someone did it for me, I said "Thanks" and smiled, and then wanted 
  '257f4600cc7fa07e5f3a0a83bf61b4166fa1d41b0808fc2d94525f32878d0509': "周四，我桌上有三页复印的历史笔记：我之前错过的。", // On Thursday there were three photocopied pages on my desk: the history notes I
  'c9ad22d21d0090045bc90eb994c90ce88204e22f4c290fac63f0e486de80b4b4': "期中考试前两周，我在科学实验室外湿滑的楼梯上滑倒，右手腕骨折。", // Two weeks before the mid-year exams, I slipped on the wet stairs outside the s
  '83439a8db1aef537bdc850ae0c779d82a7e90c8d656f793c5a42ef5cd2e1981e': "那是一页从a到z的虚线字母，用来描摹，就像小学一年级的练习册里的字母。", // It was a page of dotted letters from a to z to trace over, like the ones in a 
  '4274394236081574c62096ffee7ddbe68ca8f1ba83db57f7f73e8c31ab5e6347': "我一直做事都认真，而且总是独自一人。", // I had always done things properly, and I had always done them alone.
  'ce2e4515b3434bf646da3a69407abfe3290e1f52582d2a404f8cd5d7a2725e60': "那天晚上，第四张纸从他们之间滑落到地板上。", // That night a fourth sheet slipped out from between them onto the floor.
  'adef6f271e7f8a07f73470b92723fa6c8df9d4f41d435b711883e9e16df9d57c': "他坐在我后面，我们大概只说过两次话。", // He sat behind me, and we had spoken perhaps twice.
  '7bedeef14f12f6dcd30277a1b2d2fa541ae4d25d77e7397f254ca4203ce28f20': "我的朋友们主动提出分享他们的笔记。", // My friends offered to share their notes.
  '265b3150e2af6d0a86d6895ad6b1e30bdabcb0f5847e640e0101bc3df48d8e08': "到了第二周，我能写出别人能读懂的句子，考试时我能慢慢写整页。", // By the second week I could write a sentence that another person could read, an
  'dc60870ed2d67cbc47d3551f3a2184ab9bc723c2d41539e71336b70edd06b3cc': "三月卡维娅的手机掉进排水口后，她借了一周，从未退出过应用。", // After Kavya's phone fell into a drain in March, she had borrowed it for a week
  'ad96d67e1afa7dec0907ef07b02c490df73459f22860863a299d865aecb9e20c': "每天，我们俩都必须在午夜前完成至少一节短课，旁边还有一团橙色小火焰的数字会增加一。", // Every day, both of us had to finish at least one short lesson before midnight,
  '5e51e213f91c0f99a7897b3d7430b75ae6fdf455e7414d47e92dfac62314c874': "我关掉灯，躺在床上，盯着黑暗的天花板看了很久。", // I switched off the light, lay on my bed and stared at the dark ceiling for a l
  '5e10a1858347e902baa77fbb65ec9522f40df11f0f02739edb19fbc037648a0d': "机场的Wi-Fi坏了，手机也没有数据。", // The airport Wi-Fi had not worked, and her phone had no data.
  '2ee0e9bd709ea287f5b1429f343dd6f37d86bc0c49bc309b97d317decf317b39': "在中二时，我和朋友Kavya开始用一个叫做“朋友连锁”的应用学习韩语。", // In Secondary Two, my friend Kavya and I began learning Korean on an app that h
  '198b0e20a79218372581fb6cf246b6efeedd711acb5225190a5bf32ca8fd7020': "如果我们中任何一个人缺席一天，火焰就会熄灭，数字会回到零。", // If either of us missed a single day, the flame would go out and the number wou
  '1bbc1ffb8f7d55c119f525077164a66397c18a96f5f25b373984d0384ac94c96': "我们在公交车上、食堂排队时上课，还有一次在医院候诊室上课。", // We did lessons on buses, in the canteen queue and once in a hospital waiting r
  'a4a08e2b7517b255c7a0002005cf2c7c265b1e54b4dee27d23d81eac726e81f9': "旁边的数字从364降到0，一条欢快的信息说每一次伟大连胜都从第一天开始。", // The number beside it dropped from 364 to 0, and a cheerful message said that e
  '5fd5a538d9eff73f1fe3d128e5c7abf8044388be98bda4364778001909e8297c': "然后我想起了我的旧平板。", // Then I remembered my old tablet.
  'dc973e126d37497a667d05d93c615c1ed7348ae5b0b7ad1d101bcf730cbdf5f3': "我的拇指长时间都悬在屏幕上方。", // My thumb stayed above the screen for a long time.
  '1525df284adfa11593cc491c647115ca92500964764253cdadb4da33cb140ab0': "那天晚上十点她还没做，我发给她的消息也没送到。", // At ten that night she still had not done it, and my messages to her were not b
  '512f64d6f34ae72e1f0aa10f07249298f7204462c1828aec0ed063ff9f11e257': "她的账号还在。", // Her account was still there.
  'd560836cc337fb233dade296713af7757384569f80d308859fdf411d9974e166': "我想到当我们达到365时我会发的截图，意识到每次看到那个数字时，我都会知道其中一天是我的。", // I thought about the screenshot I would send when we reached 365, and I realise
  '7964fe5dd62729d84a4be9cc69b5548ae10dd7a8bdd3890faf53d59413199d05': "虽然数字要小得多，但每天早上查看时，我知道这件事的每一天都真实发生过。", // It is a much smaller number, but when I check it each morning, I know that eve
  '7b8856a294239be0e61cb02c98f5fdaee2606232d47947ddedafd3f3784ba11b': "他盯着我看，然后咧嘴笑了。", // He stared at me, and then he grinned.
  '37ed89edefa6792881cd58295dde1eb5cbd723ad3682a61890be9763856f9341': "第二周时，我在百科全书后面发现了一本厚厚的小说，那里没人会去。", // In my second week, I found a thick novel lying behind the encyclopedias, where
  '2c1c68acb6218d3822de55a9966dcb9223682e2ef940d49a67f885042c7b7577': "这本书是一个受欢迎的奇幻系列的最后一本。", // It was the last book of a popular fantasy series.
  '13832113d3abbc0bccaa9e45610364a198ec512ed5e32953fcef2d5c921eec33': "学期最后一天，书又回到了小说区，公交车票放在最后一页。", // On the last day of term, the book was back in the fiction section, with the bu
  '3550be76edc074c315fa44be08ff302dff30f5c2988b7f01f3ed53c000c7e574': "每周一，图书馆理事会都会有人检查每本书是否都在正确的书架上。", // Every Monday, someone from the library council checks that every book is on th
  '4adb77093565f62e4678b2c96b7b8b9819c33ebd6f8502f5aba6f9a25ac7e2e1': "“我读了两遍，然后把它放进钱包里，现在还在那儿。", // " I read it twice and put it in my wallet, where it still is.
  '181927048ff749a2364afd7bc15b2642cf2fb007bd8cca5d0bcc6027a84e6542': "这是最无聊的工作，所以总是给最新的成员。", // It is the most boring job, so it always goes to the newest member.
  '6c04c4569f18751cfcc4c7ca42c3fda2643355b6973dc095e170e4ca5e4dd84e': "我不得不捂住嘴，才忍住笑。", // I had to cover my mouth to stop myself from laughing.
  'f27f8984c97ad70adfe44370bf8e0035d1f72cd23fc3d0a1c519717a7466fbd2': "背面写着：“谢谢你。", // On the back, Hafiz had written: "Thank you.
  '31c029f9a5ba13b629d147b4a99f1f0e94eea0de8fd4165934808bf5e9a3175a': "几周后，一个中学一年级的女孩向我要了同一本书。", // A few weeks later, a Secondary One girl asked me for the same book.
  '4f066795f8df253e81ea6a598e03fc34cfac007ae2626b72f2cd2225a6615d5b': "里面有一张旧的公交车票，大约从开头开始就有五十页。", // An old bus ticket was inside it, about fifty pages from the start.
  '0ee80dab1e4087ce41e5937da246783ca319c077aae479e186ec2197c6b001dc': "十分钟后，隔壁班的哈菲兹走进来，像间谍电影里的人一样环顾教室。", // After ten minutes, Hafiz from the class next door came in and looked around th
  'fd8ef29d21751503dff66e12d24d009d3b7b2649263aabe44e424d30ea693c6e': "我知道规则。", // I knew the rules.
  'f5a20dcaf0881e597fade7cde3033df107faa0c8db59f386243305daaba2248d': "从那以后，我会先查百科全书，然后不断猜测是谁。", // From then on, I checked behind the encyclopedias before I did anything else, a
  'c91ae06b4eb831c9efe459f698fa5ba7f7c9baa8bf852794452f16d51e37a147': "我慢慢地走在小说区，假装在找，脸却越来越烫。", // I walked slowly along the fiction section, pretending to search, while my face
  '239b5c95787d01339cc4b8e15cd8b3955f2ab62547fe8db576906dd41aaab7ca': "解谜过程感觉缓慢，几乎有些懒散，当我按下计时器准备停止时，我不敢低头看。", // The solve felt slow, almost lazy, and when I slapped the timer to stop it, I d
  'b2da8982a2f953fa18937453f5936b1e60aed6209faa36ae8a5a8d93ce3d601f': "我不得不爬着去追它，而计时器还在继续运行。", // I had to crawl after it while the timer kept running.
  '819254790c8ca5020166fc982558fa3c886fb7f881d2bf2a6b9bc8e41841a2ff': "我耸耸肩。", // " I shrugged.
  '90d9a4292ff7231c31ea2e34e4194d87737b93cc48de87dff3252343fdb76422': "每次我都盯着号码，然后用拳头敲打膝盖。", // Each time, I stared at the number and hit my knee with my fist.
  '9514642163410408b7087085e44a77350059073a5e0a85fb1dbd137c49f83e10': "大多数优秀的解题者都会用全部十五个方法来规划他们的第一步。", // Most good solvers use all fifteen to plan their first moves.
  'f8ca71b664ae7f3722b2c7f3c4a4c6df3754a1986be9ff07066cff642d058145': "评委微笑着在我的记分卡上写下了时间。", // The judge smiled and wrote the time on my scorecard.
  'a2e8335098f49cca8fc9893b45baaf6de6a3298d9ab516b721b463044f1bdffc': "规则规定每位选手有十五秒时间研究混淆后的魔方，然后计时器开始。", // The rules give every competitor fifteen seconds to study the mixed-up cube bef
  '7dfa0490711c86f8697e3aba2f448d8117a1fc9f617b8f8b3e469bf602f94056': "他已经参赛三年了，他只说过一句话：“用上全部十五秒。", // He has been competing for three years, and he said only one thing: "Use all fi
  '1ccf3bed33df0d7724a7324a1b943c73dc459d17bafe570fb7157c0f273b3a21': "在最后一个解题前，我缓缓呼出一口气。", // Before my last solve, I breathed out slowly.
  '0d922c12edb8787a54acfaf2ecb8c765725c6b4550007fdb53c3f5eb91545c41': "第一次时，我的心跳得非常响，几乎听不到立方体的声音，我用了27秒就完成了。", // On my first, my heart was beating so loudly that I could hardly hear the cube,
  'c9a609678d77b5dc800358e439d8d86b90697b2d5873ddb4e4187f1edc6b58b1': "这时，魏明本该安静地等着轮到自己，却跳起来，在大厅对面大声喊我的名字。", // Then Wei Ming, who was supposed to be waiting quietly for his own turn, jumped
  '0086c3a37c9ef50b9a262d49cf0a1c632b0fa17a02d84d20c1898670adb1997b': "6秒钟，因为一旦法官站到我身边，我的手似乎就忘了所有已知的事。", // 6 seconds, because as soon as a judge stood next to me, my hands seemed to for
  'ede1084f165374385c760bfa37578b120750be4bb854429f096fe508d41d320d': "法官把计时器转向我。", // The judge turned the timer towards me.
  'ac87a09e56f5b95757cc467183c88ad8d369d6103f619a7eead4e3741bb2657d': "我总是五六点后才开始，因为我受不了坐在那里，大家都在等着。", // I always started after five or six, because I could not stand sitting there wi
  '9973c22c0715385b13f69d1347aa0627194aaf04e372aba5171ec7682c952a66': "记分卡现在贴在我办公桌上方的墙上。", // The scorecard is now stuck to the wall above my desk.
  '29f9fad46ee486ab2f506c621b28c9c153893a2b56a70c56f094ac3d855da635': "迪帕呻吟了一声。", // Deepa groaned.
  '05bc6e7a8da8ceeac6a5189f66e575dd0c8e9c2a09523788d7a323f937bc6911': "每周五放学后，Aisyah、Deepa、Shu Ting和我都会去对面商场的珍珠奶茶店。", // Every Friday after school, Aisyah, Deepa, Shu Ting and I went to the bubble te
  '0d9aee7dbf1be752d4d8f9aa94f1c7013af59e95dd7489ef60f2965cb41f4098': "七月，舒婷开始点纯绿茶，菜单上最便宜的东西。", // In July, Shu Ting started ordering plain green tea, the cheapest thing on the 
  'e838df11438cdbf9933e6bc03b0762f5e1b47ce39517cad7f40103f057d394a3': "我自己的饮料突然尝起来太甜了。", // My own drink suddenly tasted far too sweet.
  '1bfcf4f37a9eb30b6f97cd463f27dfc94a490faac704287e2ae7d7d3295c9126': "然后我想起她学期初很快说过的话，然后她转移话题：她父亲“在找工作”。", // Then I remembered something she had said at the start of term, very quickly, b
  '77a1f1ffe880d0fc401edae56409e2651d969fb6b3776d2874395e075b5f049e': "每周五六美元，相当于每月二十四美元。", // Six dollars every Friday was twenty-four dollars a month.
  'fc1e2a254a1e85878650643829a30e6b0a8f062263dba573377db6034ac56980': "我想到她每周站在菜单前，做同样的计算。", // I thought of her standing in front of the menu, doing the same sums, every sin
  'c5b6bb9544fe9e359ce6a6409699ea0bdd6947a3cf4b11fe5b39b7c9a62e74da': "我不能主动帮她付钱。", // I could not offer to pay for her.
  '50d4ee23a5003713f2a0146eb5dec6f8a62953b8e31db8188eeaabbe1ad6d88b': "几周后，其他人还在为电影争论时，舒婷给我倒了些柠檬茶，轻声说：“妈啊？", // A few weeks later, while the others were arguing about a film, Shu Ting poured
  'd8d58228c438682350144103a551cdb5eef0c69f2f5a6a3c93dae2b37279aad1': "我们从未说过原因，我希望永远不会说。", // Neither of us has ever said why, and I hope we never do.
  'a48eb1c5ea8d25ad3a9c183dc8cc3342588e6179c43d53696578232b21162c28': "我们总是坐在同一张角落的桌子，一直待到外面的天空变成橙色。", // We always took the same corner table and stayed until the sky outside turned o
  '2651754dbbb1a97fd83fbdc2867f13d897a7889bc4a919e6c13db62440653267': "所以下周五，我告诉大家我妈妈说我花太多钱了，问我们能不能改在公园见面，带家里的食物。", // So the next Friday, I told everyone that my mother said I was spending too muc
  '05db762b34dea5523d03a45ed7f6924f0d2a75bc46b077041f8c5291f4cff212': "然后艾莎打开了她母亲的粕盒，迪帕带来了一袋红毛丹，舒婷则带着一大瓶自己泡的冰柠檬茶来了。", // Then Aisyah opened a box of her mother's kuih, Deepa brought a bag of rambutan
  'd15c608ca54ebd2840cbb8c57cddf5369a2b4950f68e0dd4bb6b6eead1079b97': "没人需要一直买饮料来保住座位，所以我们一直待到天黑，看不清彼此的脸。", // Nobody had to keep buying drinks to keep our seats, so we stayed until it was 
  '6d5ced14c69e6be5aa34b0d7c2b636e7711721faa37944b07c9e32309989530a': "大家都鼓掌。", // Everyone clapped.
  'b54b29bd3d54583fbc515b614d9e96bda8ecccfb6d8f1112bb217858c631cf38': "画面中一个戴着王冠和披风的模糊身影，从窗户被一名中学一年级女孩从窗户拍摄。", // It showed a blurred figure in a crown and a cape, running across the courtyard
  '8452e521f698358795bf012a6332facf07fd3ca5d4a81574c5ae05d451ce9948': "第六个星期三，我们第一次穿着戏服排练。", // On the sixth Wednesday, we rehearsed in costume for the first time.
  'b5c7cb0c21238fadbcb9e64a8f1ea950ce7c18e659e09f85133497b071f97453': "我开始觉得自己能坚持一整年，每周三回家的路上我都笑得很开心。", // I began to think I could keep it up for the whole year, and I grinned all the 
  '94f2eb549f27c737788af546c9946efcd4a409dfb535b1e2d5d473cc84ab91bc': "然后拉赫曼先生给了我学校话剧里国王的角色，谭老师给了我们一个每周都要交的照片项目。", // Then Mr Rahman gave me the part of the king in the school play, and Ms Tan gav
  'c949e3263e010aa5f1bddb8a50a02b8cfac6f0f3c5b2e201373f311c0490004e': "我留下来看戏剧热身，告诉拉赫曼先生我有个会议，然后穿过院子跑到美术教室，最后半小时又跑回来。", // I stayed for the drama warm-up, told Mr Rahman I had a meeting, ran across the
  '94a0f8419a0a0808817043215cf2d0e84b6ec3d09fc2e028163ab16296bace1a': "看到一半，我才想起我的照片必须在谭女士的拍摄结束前交。", // Halfway through, I remembered that my photos had to be handed in before the en
  'ec1be8078d68aed577512ad61280debc955fec2a349bf7a842f1f4b8298a9407': "我在公交车上学会台词，也在床上阅读了关于摄像头设置的资料。", // I learned my lines on the bus and read about camera settings in bed.
  '8e601622a09747b02e7129ba4ace918961037ab0bb75d7236a56c116cab5e086': "我松了口气，憋了好几个星期。", // I let out a breath I had been holding for weeks.
  '5111f10ee2b68b788813b660fd5108cfce1761ee60e2002c9b636e5cff56e3f2': "两个名单的长度完全相同。", // Both lists were exactly the same length.
  'e4f073a815e1b8e49f96c04ed502e64015fa9c67aba36cb78c29d386c8c44411': "主题是“运动”。", // The topic was "movement".
  'e3f285c07797a6cffdab61dcab56eaea8ba7f05c80ba3b515b86c7287c1c5b91': "每个星期三晚上我都躺在床上，翻看所有没做的事情。", // Every Wednesday night I lay awake, going through the list of everything I had 
  '011fc952b98fe2bbc3a188159666b9dcb00e771f016bda3dd7c048cd863259c3': "下课后，她和拉赫曼先生一起等我。", // After class, she and Mr Rahman were waiting for me together.
  'c7634acec234a89dc2d17995bb61ab1c4131dd042be73d9f4de0272b2cdd47d1': "中学三年级刚开始时，我无法在戏剧社和摄影社之间做出决定。", // At the start of Secondary Three, I could not decide between Drama Club and Pho
  'b32afac5aa57e71de849dda2eceab80f14623952d539c9d6b159fc6afa2e64f8': "戏剧有国王、舞台和我大多数朋友。", // Drama had the king, the stage and most of my friends.
};
