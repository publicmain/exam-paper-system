'use strict';

// 首发周例句的中文句意。key 是英文原句的 SHA-256；
// content/index.js 会逐条校验，少一条就立即报错，不能带缺口发布。
// 由 scripts/pilot/build-week2-context-translations.js 生成（Azure Translator），
// 生成后经人工复核。行尾注释是原句，方便审阅时不必回查。
module.exports = {
  'f7c0559906d98cc12df056a9154115ff706fcee75e7035d3a5f34bde5bbd6f4c': "用她的话说，亚马逊是“假的天堂”。", // The Amazon, in her phrase, was a "counterfeit paradise".
  'eb1bf400902173b2c3f0b9cad7d7edb6bcc27c5a717d8c0c6d453a7b614b246d': "在巴西西部亚马逊，近几十年为牧场开垦的土地暴露出数百处大型土方工程：挖掘成圆形和方形的沟渠，有些直径超过100米。", // In the western Brazilian Amazon, land cleared for cattle ranching in recent de
  'e11a9a4fcc9ddb86f91bc4ef8bf5e0c3690a4d452556005b98b0889165965f79': "在河流沿线的许多地方，考古学家发现了异常深色且肥沃的土壤斑块，科学家称之为亚马逊暗土。", // At many places along the rivers, archaeologists have found patches of unusuall
  '2f22a6ad8c42e62198aa1883bcc8418c1ca1c2a0a230bde026ef5214454dcf92': "这些土壤含有木炭、陶器碎片和食物残余，似乎是几个世纪以来人们在家附近焚烧废弃物和有机物时积累而成。", // These soils contain charcoal, fragments of pottery and the remains of food, an
  '5fb12177620a2d8b4468624256034d1940203779d0a69b5507f39d49c738ef79': "调查显示了土质平台、锥形土丘、水库和直线穿越景观数公里的高架道路。", // The survey revealed earthen platforms, cone-shaped mounds, reservoirs and rais
  'd4b113c3d632b74f4ade39a1bd7738dcdba6f9fc437e12d6044491ec9d3610ce': "然而，最引人注目的发现来自激光雷达技术，这是一种飞机向地面发射大量激光脉冲的技术。", // The most striking discoveries, however, have come from lidar, a technique in w
  '91b16e7b7b3985590aca0635a574166825734983611b115b2c8bb27e2cc7831c': "事实上，最早的欧洲记载暗示了完全不同的情况。", // The earliest European account in fact suggested something quite different.
  '62c7d879b74b1faba3531a324de7888405bd355805a73c92827b4ec4922332be': "1541年和1542年，西班牙探险家弗朗西斯科·德·奥雷利亚纳率领欧洲人首次沿河而下，同行的修士加斯帕尔·德·卡瓦哈尔描述了河岸上挤满了人，定居点似乎延续数英里。", // In 1541 and 1542, the Spanish explorer Francisco de Orellana led the first Eur
  '89f78d532ce31f4043e2f0a345769a39696e8a6de962fec2b35e3862da30f2c8': "在二十世纪的大部分时间里，亚马逊雨林被广泛认为几乎完全由自然塑造的荒野。", // For much of the twentieth century, the Amazon rainforest was widely regarded a
  '35dd4a8b11da6342e0dd3189e05a1a4782b4fde7c8d5c3a989ab18e2beddf514': "根据这一观点，当地人民一直生活在小型、流动的群体中，几乎没有在土地上留下持久的痕迹。", // According to this view, its peoples had always lived in small, mobile groups t
  '99599423426fc68b844e835e1001c8dd1f3bfa71e6f47317fbaa538bd14e02db': "对土壤中微观植物遗骸的研究得出结论，建造者并未清理大片森林以制造这些植物。", // A study of microscopic plant remains in the soil concluded that their builders
  'b99f4e4e7c75b3654f2d765db752e96c884aaf42df4ff7b69d1c9440143c8e89': "然而，后来的访客发现居民远少于此，几个世纪以来，卡瓦哈尔的描述被当作夸大其词而轻描淡写。", // Later visitors, however, found far fewer inhabitants, and for centuries Carvaj
  '7729716e05de960d18947ec1bfcada9af22894818b66674c1033c1506efa088e': "他们长期生活和管理森林的经验，或许能为保护森林提供经验，许多研究者现在认为，森林的历史无法与曾生活在其中的人们的历史分开。", // Their long experience of living in and managing the forest may offer lessons f
  '91feb82411801b23e1bee32345fe9b63081bb67a3f25a8a2f7f1a4dfee4bdf91': "它们的存在表明，有些社区长期停留在一个地方，改善了土地，而非枯竭。", // Their existence suggests that some communities stayed in one place for long pe
  '99ca1b86f0b12dfab89ca4a16952cae5afbd0b324355c80b2f10ff6a63841aef': "一种可能的解释（至今仍有争议）是，欧洲人带来的疾病在大多数外来者到来记录之前就已经杀死了大部分人口。", // One possible explanation, still debated, is that diseases brought by Europeans
  '1dd729ca63a9a3ac05adae68e72807ab55c2ba0e67650cf68e2a714e1f9b18b7': "五分钟后进行了最后一次测试，重新阅读后结果稍好一些。", // When a final test was given five minutes later, rereading produced slightly be
  'e85f3c4bf3f3072f321db5f167165848ad876a3b49905089cf1ad1e028f57523': "练习测试是他们评为极有价值的两个项目之一，而重读和标记则被评为低效。", // Practice testing was one of only two that they rated as highly useful, whereas
  '9ac56a7cff872060d8a223459be9defdbf30a991eab4c0b96dd763fc8ddf65d8': "反复阅读似乎会产生一种熟悉感：这些材料看起来越来越熟悉，这很容易被误认为是熟悉它。", // Rereading seems to create a sense of familiarity: the material looks increasin
  '12e9e4d993fe961869cd9f1c25bf1f9bba69c14cc742c1f17cd0e6a894074c6a': "心理学家称之为测试效应或回溯实践，这是研究人们学习方式中最有一致性支持的发现之一。", // Psychologists call this the testing effect, or retrieval practice, and it is a
  '854b64e3e4a5d3d843e509fc8ede8f0376a0f8913ce8661033b7152db2b076e4': "2006年，圣路易斯华盛顿大学的亨利·罗迪格和杰弗里·卡皮克发表了一项有影响力的研究，邀请学生阅读短篇散文。", // In an influential study published in 2006, Henry Roediger and Jeffrey Karpicke
  '28c374e7087a1c66fb57af0e4dcbcfe40ff40f4055b8369d56dd95fb7d9f6d13': "从记忆中提取信息的行为不仅衡量学习;它似乎也在强化学习。", // The act of retrieving information from memory does not merely measure learning
  'ba232df7b739929a582b90714656a397c33babadb881832073937f1ee1ed7dc0': "反馈似乎很重要：当考试后告诉学习者正确答案时，他们可以纠正错误而不是记忆错误，而且通常带来的好处更大。", // Feedback seems to matter: when learners are told the correct answers after a t
  '450711316c5987c3da39ec043ab3e96af1ad1f5839e1f6d062c2e5d98dc824f7': "心理学家罗伯特·比约克将此类状况描述为“理想困难”：它们使学习在短期内感觉变慢，但从长远来看会改善。", // The psychologist Robert Bjork has described conditions of this kind as "desira
  '17cc478a57cd900381dcc7fc29e24024536df3c385688cae2df7617da8dd341f': "然而，一周后发放时，情况反转：练习回忆后，学生记住了一篇文章中约56%的观点，而重读后约为42%。", // When it was given a week later, however, the pattern was reversed: after pract
  '995690130710495179381d9ed102434075f87d38edabb7cb2893cf3ea1a11daf': "大量研究表明，这种观点忽视了一个重要事实。", // A substantial body of research suggests that this view overlooks something imp
  'be5564f93926fb7fba21b007bcb188685b16313fe47848ff645188030ead5d38': "研究表明，测试最有用的不是作为最终判断，而是作为学习的常规组成部分，前提是它们的利害关系较低，使错误答案被视为有用信息而非失败。", // The research suggests that tests are most useful not as a final judgement but 
  'e006091886a79bb952404c6f9176e58f0fea70f8f852bbff61135ba6b3e785fc': "尽管有这些早期成果，直到2000年代，教育者对这一效应的关注仍然相对有限。", // Despite these early results, the effect received relatively little attention f
  '580356891f444fc6f1ee1eea229701349ff128aca7b131091bcb1640950f118d': "研究人员仍在争论该效应的极限。", // Researchers continue to debate the limits of the effect.
  '3bf144e3dc126db088221f0bd36886b912e8e4621ffdce1f973e11de4ba4abde': "全球大部分矿源来自刚果民主共和国，那里有部分矿井是人工开采的，人权组织报告称部分矿井中有儿童在矿井工作。", // Most of the world's supply comes from the Democratic Republic of the Congo, wh
  '75ffe71206f5fd4b53a4058ad29c979d3f2dd05d3791cd949b023337ba8b8b0b': "1980年，当时在牛津大学工作的美国科学家约翰·古德纳夫展示了由含锂的氧化钴制成的电极可以产生约四伏特的电压，大约是惠廷汉姆设计的两倍。", // In 1980, the American scientist John Goodenough, then working at the Universit
  'efd8a8e8979aa54c9214447a9d80b4cc3cb04c7485ed86929c29a8ab959e186e': "电池能工作，但其中一个电极是纯锂金属制成的。", // The battery worked, but one of its electrodes was made of pure lithium metal.
  'd38bdb85c0547969ae04c55abf61669c3ff089ec7e858d01df01c3c140467b78': "全球大部分锂来自南美高原沙漠地下抽取的咸水，这些盐水被留在巨大的池塘中蒸发。", // A large share of the world's lithium is extracted from salty water pumped from
  '410c339e020eaa62a44c8a95bfcc7106aa11d2a75e8dd3e0b50dad6982e055e4': "它为手机、笔记本电脑和电动汽车供电，并且越来越多地用于储存由太阳能电池板和风力涡轮机产生的电力。", // It powers mobile phones, laptops and electric cars, and it is increasingly use
  '56a5d70a44531bdfc288a45e9fe6d95e915a46e68db1e8c6adc1563911c6b61f': "由于这些地区是地球上最干燥的地方之一，当地社区对稀缺水源的影响表示担忧，尽管科学家们对影响的严重程度存在分歧。", // Because these are among the driest places on Earth, local communities have rai
  'ab9196d7a723e338fc82e83c4c9d32b7d7e6448b60027a543e4d1753a125fdfd': "20世纪70年代中期，英国化学家斯坦利·惠廷汉姆在埃克森石油公司工作时，制造了一种可充电电池，锂离子能够在一种叫做二硫钛的化合物层中流动。", // In the mid-1970s, the British chemist Stanley Whittingham, working for the oil
  '1fb81d1fcf8c907565db7d5e5dd96676bc2175bce9b306b01e6149c9719a0c1a': "如果电池受损、制造不良或过热，内部反应会产生更多热量，进一步加速反应，导致难以扑灭的火灾。", // If a battery is damaged, badly made or overheated, reactions inside it can pro
  '069fd7f192da95d79c6907378b39664de4753a8b2c4bc1aadcdda610f4c03f04': "锂在很多方面都是电池的理想材料。", // Lithium is in many ways an ideal material for batteries.
  'c654a1d1c46ae0bb371867323f158bd10e33ff6a771ec866a630646ade10782c': "然而，它也非常敏感，这一直使得安全使用变得困难。", // However, it is also highly reactive, and this has always made it difficult to 
  '4541f4980d35339833584ca8322cf5ac1c2d59bbc6279e59527f1d9b2441c786': "一些新型电池使用铁和磷酸盐代替钴，以较低的成本和更高的安全性换取较低的能量，许多团体正在开发更好的回收方法。", // Some newer batteries use iron and phosphate instead of cobalt, accepting sligh
  'b8be35fae64661fc82570dcbf679ec3e136688b8b35a2b84978d5dabefe3786b': "根据一项广泛引用的行业调查，2010年至2020年间电池组的平均价格下降了约90%。", // According to one widely cited industry survey, the average price of battery pa
  '8affb23f3af5be1f9af16155ae5f64f4d90d0a7a38777654bf3de5cd04cb6200': "经过多次充电，细金属丝可能从该电极长出，导致短路，有时甚至引发火灾。", // After repeated charging, fine threads of metal could grow from this electrode,
  '45a9dfc0ee6789528aea0ad2d2f2403e1f7673c68893ce25b6f7b2e8b3250af9': "其开发历时数十年，许多科学家共同努力，其成功也带来了世界仍在学习如何应对的问题。", // Its development took several decades and the work of many scientists, and its 
  '6faaab82fc42e1925eacef18973543a3f017d03298738de7287b02775e358e99': "它们为许多农作物和野生植物授粉，分解死物并将养分回归土壤，是鸟类、蝙蝠、鱼类及许多其他动物的重要食物来源。", // They pollinate many crops and wild plants, break down dead material and return
  'bcf8fe369aa218ca888f1844057103fc83d7c1ba3b4da256f933a98e8728b68d': "昆虫数量也随着天气变化每年急剧上升或下降，因此一项仅持续几年的研究可能会误认为自然波动是长期趋势。", // Insect numbers also rise and fall sharply from year to year, depending on the 
  '01dffedea6e0edf9d983f718deeb7cd24aab594e413ff80422746a07044ba5f6': "他们提出，周边地区的农业活动，包括农药的使用，可能部分导致了这一问题，但数据未能确定原因。", // They suggested that farming in the surrounding landscape, including the use of
  '51aad3ae137be1fbd65fc2e67e8c26b4dd77912c978c3dce9f399d728b165161': "近三十年来，德国克雷费尔德市一个协会的业余昆虫学家们在自然保护区搭建了类似帐篷的陷阱，收集飞行昆虫并称重捕获物。", // For almost three decades, amateur entomologists belonging to a society in the 
  'd3c466249c54300560e3d589821b94a04c7967afb93f9439d0d4437706d448be': "2019年发表的一项综述显示，超过40%的昆虫物种正在减少，许多物种可能在几十年内消失，全球报纸广泛报道此事，视为“昆虫末日”的证据。", // A review published in 2019 suggested that more than 40 per cent of insect spec
  '6d8d3fb7670f7c3ead4acd93cce69e5e7049856a41cce24babbe4def78503526': "在仲夏，昆虫通常最为丰富，数量下降约为82%。", // In midsummer, when insects are usually most abundant, the decline was about 82
  'c5fa36d2c232a7373e4f77d3e88aaa02e738ce83eafb08f1c6320dde689302c7': "大多数昆虫来自欧洲和北美，而热带地区极少，那里生活着大多数昆虫物种。", // Most come from Europe and North America, while very few exist for the tropics,
  'd92ab7f4adb0b516a2d04ed7bf01bf0c3fc9e5410dfb120d89d79032e0d8f004': "此外，许多下降可能在监测开始前就已开始，因此即使是长记录也可能低估损失的量。", // In addition, many declines may have begun before any monitoring started, so ev
  '3f88883aa6c6849e26882f6d8e9ad02914eaf31e987b2e39db3d274d13f5cef6': "不同地区结果差异较大。", // The results also varied considerably from one region to another.
  '5aa4eb1e70ffe6d8ac969fb9b93d44fd2eab59adc4775895fa87a79bb3143f11': "许多科学家认为，优先事项既是基于已知数据采取行动，也应建立更好的长期监测，这样未来的变化不会在变化严重时才被察觉。", // Many scientists argue that the priority is both to act on what is already know
  '1faa42a38791ee491be49a0a0234089a0e4c32140433d3111d0329406759d5fb': "报告估计陆地上昆虫数量每十年下降约9%：这是一个严重的损失，但远比早期一些说法所暗示的要慢得多。", // It estimated that the number of insects living on land was falling by roughly 
  '2edfa75a3bb6a73eec38f907bed46e69a63db4fb1ce3283fcaa551785f86eca0': "大约有一百万种昆虫已被描述，科学家们认为还有更多尚未被命名。", // Around a million species of insect have been described, and scientists believe
  '8939d087c1b4bd1491ab89a06607430a479bac16049e1ebe6a467a86e6791682': "许多在乡间公路上开车几十年的人表示，他们注意到了变化：经过一次夏季旅行后，被挡风玻璃压扁的昆虫比过去少得多。", // Many people who have driven along country roads for several decades say they h
  '552d3eaf5de7d9ebaa6bd817a98111a76049ca4bdc05a1dfc0c8c110f406865e': "尽管存在这些不确定性，大多数研究者都认为许多昆虫种群正面临压力，主要原因已经明了：栖息地因农业和建筑而丧失、农药和化肥的大量使用、气候变化以及某些地方的夜间人工照明。", // Despite these uncertainties, most researchers agree that many insect populatio
  'cb0fbaec6ac9890e2105f5637a22a0c0468b9fc1ab914bdf50cd9b0110d1fc52': "相反，他们使用指南针的方向。", // Instead, they use the points of the compass.
  '8e68f62055a6bf2ca8e5e0b7302789541bd19715cef6b2a836b59b53d7323a39': "2002年，心理学家Peggy Li和Lila Gleitman报告称，英语使用者在轮换任务中所做的选择可以通过改变测试情境的特征，比如是否可见熟悉的地标来改变。", // In 2002, the psychologists Peggy Li and Lila Gleitman reported that the choice
  '81702911d0fd94b4164cb6af30fbec940871effcc43491af17934e1c8bd50c99': "使用指南针方向的社区通常生活在景观中，遵循生活方式，而方向非常重要，因此很难将语言的影响与环境和文化区分开来。", // Communities that use compass directions often live in landscapes, and follow w
  '3cf8a505bb275f8b5f2f4ee5d0d8fa74bb560138d96864dc01aad664c6070160': "采尔塔尔语使用者，这是一种墨西哥南部的玛雅语言，用“上坡”和“下坡”等词来描述空间，但他们通常保持地景的顺序固定，这意味着相对于他们的身体是相反的。", // Speakers of Tzeltal, a Mayan language of southern Mexico that describes space 
  '901e3bda14ecf8bf20da8c5ddd95d69757e0792af2bbd15cf6af577169b7f728': "语言学家斯蒂芬·莱文森发现，古古·伊米蒂尔语使用者能够以惊人的准确度指向他们看不见的遥远地点。", // The linguist Stephen Levinson found that Guugu Yimithirr speakers could point 
  'cf22f72e0d6b86e6cd5873dcc1a88159a7d373f94abda6c8da31e1c9084ed450': "它是欧洲人最早记录下来的澳大利亚语言之一：1770年，詹姆斯·库克探险队成员在附近修理船只时，记录了一个当地对大型动物的称呼，并将其引入英语中称为“kangaroo”。", // It was one of the first Australian languages to be noted down by Europeans: in
  'c8b014d93bfc7eeada8542c0cb7204d38f17e90ec572d35147d88f9620130974': "他们认为，“以相同方式”排列动物的指令存在模糊性，参与者只是选择了对他们来说最自然的解释。", // They argued that the instruction to arrange the animals "in the same way" was 
  'b4e47d29b4dfb40e811f552d2c48e3978444c6d88c0e2f998fa6955f018f3363': "多年来，大多数心理学实验参与者都来自西方工业化社会，而他们的思维方式常被当作普通人来对待。", // For many years, most participants in psychology experiments have come from Wes
  '73a13ed3387482e357a6e9027c8184ae6f80f3776111c7ce3830f347cfceccfa': "另一位语言学家约翰·哈维兰注意到，讲述故事时，他们的手势往往指向事件发生的实际方向，无论当时讲述者面向哪个方向。", // Another linguist, John Haviland, noticed that when speakers told stories, thei
  '8653e49b7e7aa9f879de4c61456fa6617f295dc03007b6cf76191afda13602e6': "莱文森及其同事回应称，这无法解释社区之间强烈且持续的差异，争议尚未完全解决。", // Levinson and his colleagues replied that this could not explain the strong and
  '82cbaa0a7ec7103f5cc78d874152c4d7a2efac6bc2285ef3cf694b3b62eeb13c': "然而，过去几十年的研究显示，有些语言描述空间的方式截然不同，这也引发了一个问题：这是否会影响使用者的思维方式。", // Yet research over the past few decades has shown that some languages describe 
  '7cb15a318aca81dcfec6ba023aafdc8beb342bdb659fefbfbac3a430ec6b38a8': "其中最著名的例子之一是Guugu Yimithirr，这是一种来自澳大利亚昆士兰北部的土著语言。", // One of the best-known examples is Guugu Yimithirr, an Aboriginal language of n
  '296fa38ea2be806048ba3dde178579cfee8d2868ae72eef64320f6cfc6461776': "用于移植的人体心脏或肾脏只能在体外保存有限时间，冷冻会破坏其细胞。", // A human heart or kidney given for a transplant can be kept outside the body fo
  'b9a82f3eef08fe2b8b56a16e6deee6b981479b0d6ae8d66e767d884e993343d9': "它会沉入森林地面落叶下的浅洞，当温度降至零度以下时，它会结冰。", // It settles into a shallow hole under fallen leaves on the forest floor, and wh
  '1155056c54fa0df7a06c2cd18cb266332db11a348488df2a0d342b4c75f8bf67': "当人体微小细胞内的水分结冰时，锋利的冰晶会撕裂细胞。", // When the water inside the body's tiny cells freezes, sharp ice crystals can te
  '9d4dd5d9784b4f778de610123679aa858a32362ef19e39f04c58cf00c986874a': "糖分进入细胞，起作用类似于防冻剂，阻止细胞内的水分结冰。", // The sugar enters the cells and works rather like antifreeze, stopping the wate
  'b761c18cdbf568e96dacda5c71e9be78dce324b7ea8e4942b121d11040218447': "春天来临时，冰层融化，青蛙的心脏重新跳动，开始呼吸。", // When spring comes and the ice melts, the frog's heart starts to beat again and
  '05b881c621548af37269a20ca7af5a81f38ee501dd65f810df16eab9c01eabfa': "一旦皮肤开始结冰，肝脏就会开始向血液注入糖分。", // As soon as ice begins to form on its skin, its liver starts to pour sugar into
  'fcd27ddf3947d5eaf6ff68a0270aceb532d871630899f8aaf6208f1d4df88dda': "一些研究人员希望木蛙有一天能帮助医生更长时间地保存器官。", // Some researchers hope that the wood frog could one day help doctors to store o
  '233a883b88d967b85d48ab114778629ceaeccdb6979af5c06f61f18254346125': "任何捡起它的人都会觉得它又硬又冰冷，几乎肯定会以为它已经死了。", // Anyone who picked it up would find it hard and cold, and would almost certainl
  '4536cf6cdb8ed2009f0856dcd5391e85b924b8ee63f3263b17d84b0f7f90d2ac': "它的心脏停止跳动，停止呼吸。", // Its heart stops beating, and it stops breathing.
  '7c0d028f06522f41da4ea3023444384f8b9a19c56bf487820aeba2d977ecd420': "冰首先在青蛙的皮肤上形成，然后慢慢扩散到体内。", // Ice first forms on the frog's skin and then slowly spreads into its body.
  '0e0eadcf13e8efceca06ad87831194c6a27caeeeea8e11fd404ea9b42744b9c4': "最终，它体内多达三分之二的水分可能变成冰。", // In the end, as much as two-thirds of the water in its body can turn to ice.
  '1549635b3d6329328eb8b4e934deab6a0f33de2dfac58733f2e3b7bb1a5dbfc9': "很快它就会跳到池塘里繁殖。", // Soon it is hopping off to a pond to breed.
  '6a7dc557cadd99b2d64eb9948719372a24218ed5aac66b34f6fd3b912e806543': "许多青蛙能在地下深处或池塘底部存活，那里的水不会结冰。", // Many frogs survive it deep in the ground or at the bottom of ponds, where the 
  '9b8a8d153c1796f9bf3167c8e2387473e3abfb1badc57c1de73172105c36f4f6': "在寒冷的早晨，你戴上羊毛手套，掏出手机，轻点屏幕。", // On a cold morning, you put on woollen gloves, take out your phone and tap the 
  '58aad0af23c4cb991fecf5437924c576dd307fe813bdf71d6cf81e1e2b0c45d4': "为手机用户设计的手套指尖有特殊线条以传递电流，而为这些屏幕设计的笔尖则是类似材质的软质笔尖。", // Gloves made for phone users have special threads in the fingertips that carry 
  '6af971d82ae9ba2df4cd550a1d7d8120bced4bf25349b185eea5c3c684449975': "玻璃下方是由一种承载电流材料制成的极细线网格。", // Under the glass is a grid of extremely thin lines made of a material that carr
  '60efbb1f1436a1b320acf1b3980de1c200a5a45aa4d006e2436b418607d04907': "原因是大多数现代触摸屏根本感觉不到手指的推力。", // The reason is that most modern touchscreens do not feel the push of a finger a
  '6d131e1943004cc8f9c9c9b0abdf8e2c6dc75bb9c42232430ae0dd4a8acb3728': "人体也很好地传递了电力，因为人体含有大量含盐水。", // The human body also carries electricity well, because it contains a great deal
  '02bce5d79dd41d0ee0a7361a66b47eab20d7605a9c2ebd4c403f21b448925002': "这些屏幕可以用钢笔、指甲或戴手套的手使用，但必须按压。", // These screens could be used with a pen, a fingernail or a gloved hand, but the
  '89b9432be5c47545f1ad07001afd6d5ae34be92cbbc133f7bb8c86f8bd660e29': "一些老式触摸屏确实依赖压力。", // Some older touchscreens did rely on pressure.
  '8163ae86ca48c7a22bee2c9862a2ab9ff26cb90beb4b9ef57523f2ecba2069dc': "手机每秒多次检查电极，注意到电荷变化，并计算手指的位置。", // The phone checks the grid many times a second, notices where the charge has ch
  '10942f013dc1985d379707f21a99c1d1328ab3a4d24cd648a598c39c71dc607f': "羊毛和皮革不带电，屏幕无法感知手指在其中。", // Wool and leather do not carry electricity, so the screen cannot sense the fing
  'cf807cb1cf0352e58fef086d1745515fbe31d617803637f4b51540fb78401719': "当手指靠近屏幕时，会在那个点抽走一点电荷。", // When a finger comes close to the screen, it draws away a little of the charge 
  'b376371049bdb73f837852003c75d36df3979df3c1d20329764e94e6373aa581': "按下屏幕，将最上层的部分向下推，直到接触到下面的层，设备才确定了它们相遇的位置。", // Pressing the screen pushed the top layer down until it touched the one below, 
  '7e8430208f4269cc55ee7cf0e37905675b824142f0e0811e6c1bc5305c5067d5': "现代升降机更先进，但大多数仍配备安全制动器，若升降机移动过快，该制动器能抓住轨道。", // Modern lifts are far more advanced, but most still carry a safety brake that g
  'c851a478f65ebfd55b7cb87a3496dcbeb975f1a99a0f8017c7bb37e93f0fd401': "他们的弱点显而易见：如果绳索断裂，平台和上面的所有东西都会沉入底部。", // Their weakness was obvious: if the rope broke, the platform and everything on 
  'd77ab252f759f501946685363ab69afc113588bb47936cac3dfecbb913bfc956': "奥蒂斯于1861年去世，但他的儿子们继续经营家业。", // Otis died in 1861, but his sons carried on the business.
  'b7cfec18b8cfa2fce2fe294eafe177f31d523c0af113b21214cd851d3d4369b4': "弹簧上方固定着一个坚固的钢制弹簧，吊绳连接在弹簧上。", // A strong steel spring was fixed above it, and the lifting rope was attached to
  '294eee260ec80d9c9d0256b725fe183f320d8922b50ab5efd2da8bfc8ab21bd1': "在此之前，很少有建筑超过五六层，顶层楼梯最多，最不受欢迎。", // Before it, few buildings had more than five or six floors, and the top floors,
  '4714a64217fb2cf615e90dd5955adf11fa9a13a7e77050f9735923bc55fb6765': "19世纪50年代初，一位名叫伊莱沙·奥蒂斯的美国机械师设计了一种不会坠落的平台。", // In the early 1850s, an American mechanic named Elisha Otis designed a platform
  '89787f19b6b41046dafb3a157175f395c5769ae75b1d8b98eebdefc8bdc8768f': "一旦人们能够安全乘坐，建筑物可以建得更高，顶层也成为最受欢迎的部分。", // Once people could ride up safely, buildings could rise much higher, and the to
  '64a0e401e4f7127edc676ed8972ab4e7c6f68193f967237cd26727bb00a860b3': "订单很快陆续到来。", // Orders soon began to arrive.
  'a0ce15e2f0bd95273bec3bba686a67689696ab124b600f6f2dc46e2a14a3a23d': "起初人们并不相信这个想法，所以奥蒂斯决定向他们展示。", // People did not trust the idea at first, so Otis decided to show them.
  '2db12a4748b757e729104c5fb585f6e95ba7293169c5cad86d8ba8c2be5ae34b': "这些卡在两侧铁轨上的一排排齿状物中，站台几乎立刻停下。", // These caught in rows of teeth along the rails on either side, and the platform
  '29a6d1e77847d4ce0ba8928d7db4bcd179a670605e4cf752ba9a4f6902702e61': "1854年，在纽约一次大型展览会上，他站在人群之上高处的讲台上，命令割断固定绳索。", // In 1854, at a large exhibition in New York, he stood on a platform high above 
  '3003374a0c44ee9c2c45b58132533ff6c239769c4f0b172d72d78cec6e36ce65': "据说奥蒂斯喊道：“各位先生，一切平安。", // Otis is said to have called out, 'All safe, gentlemen, all safe.
  '504bedd89c9fb663c9a81fabb959cbdb4658ebf8034d9d7ca5e9481cff4a673d': "很少有人愿意乘坐这辆车。", // Few people were willing to ride on one.
  '05ccc6c2428e029d08ee82331a3c9a64d4e46c8b9995a0cbebd6e4bbb16f9493': "研究人员认为，这种突如其来的血液涌动可能提高了颅内压力，而颅骨内几乎没有多余的血液空间，这导致了疼痛。", // The researchers suggested that this sudden rush of blood may raise the pressur
  '587bc6deff1bd28610378a36dd5598199b1c6b935f414ff6ceba4a8fb7917545': "与此同时，他们利用超声波测量大脑中的血液流动。", // Meanwhile, they used ultrasound to measure the flow of blood in the brain.
  'e8e5cafe4253e7b1f3ce1ecfb386c1bf1e7d172b535219da6baf72d8648a9c51': "脑冷冻无害，而且很容易停止。", // Brain freeze is harmless, and it is easy to stop.
  '8c73a887ac08a1555b1d8972f3abc5e3716cf9469d31de2da1bcf23b673e5fa7': "许多研究者认为，当非常冷的东西触碰口腔顶部或喉咙后部时，那里的血管先变窄，然后为了加热该区域，突然又变宽。", // Many researchers believe that when something very cold touches the roof of the
  'c5864b41fb70ba47429122ad9affca0c48d725685f28b97b011e689d26ff793b': "疼痛一开始，供应大脑前部的血管血流急剧增加。", // As soon as the pain began, the flow through a blood vessel supplying the front
  '004060b2f5cd736377673701585d9e820c326860ba2edd1f325a84b6e37ce68f': "这种快速变化被一条大神经接收，该神经也传递面部和额头的感觉。", // This rapid change is picked up by a large nerve that also carries feelings fro
  'e95b1634737c29e6de0bc833ddb887146c408a11da4b752a0707fbf2de6a0b8f': "如果吃了一大口冰淇淋或喝冰饮料太快，你可能会感到额头突然剧烈疼痛。", // Take a big bite of ice cream or drink something icy too quickly, and you may f
  'eca5a47ad782f357a858e230441569af509e75f9bc2127629fe8a9cf3dccf1f4': "通常一两分钟内就会消失，来得快。", // It usually goes away within a minute or two, as quickly as it came.
  '0503c8e89851819362df2f1dee6fac191061c7e3565b005e5e5419df64237445': "更好的是，吃冷食可以慢慢让口腔适应，疼痛可能永远不会开始。", // Better still, eating cold food slowly gives the mouth time to adjust, and the 
  'a88d7861937be981d071c7181743a0e8f61b472dc3089fc2db1b5ac854c5240b': "他们请一小群成年志愿者用吸管抵住口腔顶部，啜饮冰水。", // They asked a small group of adult volunteers to sip ice-cold water through a s
  'fdb0adeeae60579b6cafcda476fa6e9f6ef7e5b228baf7b9781dd87b6b0738b1': "2012年，美国一组研究人员研究了大脑内部发生的事情。", // In 2012, a team of researchers in the United States looked at what happens ins
  'd440f1d995b0082d27a5084ed7af93754834eeac1621e3b00649715674d32711': "尚未学会阅读的孩子几乎不会受到这些词语的影响。", // Children who have not yet learned to read are hardly affected by the words.
  '23f17c927fed79d587170adbbc2db3d7c56c029f51bf799b5595c410810d02bb': "因为它展示了一个人忽视干扰并专注于任务的能力，医生和研究人员利用这种方法来研究注意力，例如在脑损伤患者身上。", // Because it shows how well a person can ignore a distraction and stay focused o
  'de28f00fa9244a5c7546b833c149349995ed9a1363e4d315ccea437c9cc5d739': "斯特鲁普测试后来成为心理学中最著名的实验之一。", // The Stroop test has since become one of the best-known experiments in psycholo
  'a82926cf43001833957d8d8a493bfd4adc1969bb9bbb59f715a0b9a84c8c2cd0': "然而，上述描述的效应是以美国心理学家约翰·里德利·斯特鲁普命名的，他在1935年发表的一系列实验中对此进行了仔细研究。", // However, the effect described above is named after the American psychologist J
  '92d426b48ec95630fdb20e0ffdec69dd61661cdecbf5d0f89868c1b9ebf9969b': "你会看到用绿色墨水打印的“红色”一词，并被要求尽快说出墨水的颜色。", // You are shown the word RED printed in green ink and asked to name the colour o
  '31fa6c364961dbaa43fe362e41249c2f1e008f73a1853184778e42d2d643b0ae': "给他们一整串这样的词汇，每个字都用与其含义不符的颜色印刷，几乎所有人都会放慢速度并犯错。", // Give them a whole list of such words, each printed in a colour that does not m
  'b7ee058e4c27544aeb2b272be78b0d3cf10aa79f117f75039aa2852ccdff9424': "心理学家早在1880年代就注意到，人们朗读颜色单词的速度比他们说出颜色的名字还快。", // Psychologists noticed as early as the 1880s that people can read colour words 
  '970a5f2a50c59ac1fd4b9c23a2b351c29338fcf9d0cf4b1ce74e2d29d1aeb6ce': "这里有一个简单的测试。", // Here is a simple test.
  'b852ffe47d8ed19623836aa9615ee0f12bf03b292d8d4296223bd22722c6018d': "我两次把它塞进了拇指。", // Twice, I pushed it into my thumb.
  'f676c3a989e43b8877dad3621339a80986651d4d497344ba7486a479b6291698': "她给了我一根针、一根白线和一根牙签。", // " She gave me a needle, some white thread and a toothpick.
  '59f5d3e950ca0ed7fb11b46697ae91919297d4ad6459ccf3b5409b988b8e7996': "然后我拿出牙签，把线绕到扣子下面，然后在后面绑好。", // Then I took out the toothpick, wrapped the thread round and round under the bu
  '9536fc36b8e778abc962019e1ccc20981c6df072d5729afe34349e8fdbbcc344': "“把纽扣缝好，”她说，“否则你的衬衫会挂到一边。", // "Sew the button on the dot," she said, "or your shirt will hang to one side.
  '291e1e12ab22e32b581a310629231c2814f70f41699dc7a1ce068e6b0180896a': "课间休息时，我把它带到学校书店，那里也卖校服。", // At recess, I took it to the school bookshop, which also sells uniforms.
  '223ea148475a7f2b20d2540f37beade0d2d43aaab826fbdaca7d3a7ba16e7dde': "然后她把铅笔伸进空着的扣眼，在下面的布上画了一个小点。", // Then she pushed a pencil through the empty buttonhole and put a small dot on t
  '090c8691cf3935e5cbe2142eaffe360c5823a2342c7ae25e1508eece8c7c1709': "徐太太用力拉了扣子，但按钮没有动。", // Mrs Seow pulled the button hard, but it did not move.
  '8c88e8d7d1ccefda792294876735d45dd8138a2ba6e93167160389b48da65f03': "接着，她用牙签划过扣子顶部。", // Next, she put the toothpick across the top of the button.
  '002507749da83bc030bfbc49d3849457219945a43c52dd307975f2abfa0ef4aa': "我缝了三个纽扣，他每颗扣子给我一美元。", // I sewed all three, and he gave me one dollar for each button.
  'de8d93706e9046c7087d4766763d5fb0903b3af8eaa4f4ca252978fffdd22c43': "他从房间回来时带了三件工作衬衫。", // He came back from his room with three of his work shirts.
  'd738780a2082c744bc25c62b5eb1ad4ab4cd652e69542174bc84041212067826': "“但我可以教你怎么做。", // "But I can show you how.
  '3cfb17a5e3ba18da3492eb9672cb814eeb940159c332c5965456b33597698a68': "“现在你再也不需要我了。", // "Now you will never need me again.
  '3a97e693ccc8693180fcd8d95c28d26558664a5f103493826ee3c60f7dd64885': "这条线由数百只小蚂蚁组成。", // The line was made of hundreds of tiny ants.
  'abdcf3a3368518c2dcdb8d0cdc2039a4706c6a24b3fc28a73e02d446816e808f': "十分钟后，从阳台边缘到盘子上排起了一排蚂蚁。", // Ten minutes later, there was a line of ants from the edge of the balcony to th
  'eaf7851b927c740e785b591593ed44fe33e71ec046a005dbdf19aabea2454833': "星期二，我在阳台上的盘子里放了一滴蜂蜜。", // On Tuesday, I put one drop of honey on a plate on our balcony.
  '82b358244336922e51dcb53953100b006921c2bfe597cfb81b8279785a221c72': "我妈妈用湿布擦了点肥皂，擦拭了一根线，只擦了一处。", // My mother put some soap on a wet cloth and wiped across the line, in one place
  '55a1ecd444ece28e25c3578c781d9c90e93560db06c056bf5b5566a21c11f9ca': "到达湿润地方的蚂蚁停了下来。", // The ants that reached the wet place stopped.
  '896edebbd1b6dbbdd885da6dabd26ebaabe59dab259c748c81dfd063da36385a': "其他蚂蚁则会顺着气味找到食物。", // Other ants follow the smell to the food.
  '9f255e8e8db39dd69279ae83140915835b29a4d182dd97b2887100a0d8ff69f1': "我想亲眼看看。", // I wanted to see this for myself.
  '26dc53780275efbb7c3829ab02aada074d48f0af171afddc4c6bcfe4eaaff10d': "第二天早上，出现了新的排队。", // The next morning, there was a new line.
  'b742a59c89b6fa4a0acac7df825e9a53b1cd83108e96fea5a252e7a0a7c15c20': "很快，防线被一分为二。", // Soon the line was broken in two.
  '24121e1f044ba2b40f3c0da607c4be8207a96cc3d5989262a6ffef9293f8e95f': "它停留了一会儿，然后匆匆离开。", // It stayed for a short time and then hurried away.
  'c5978f0f458ba5922813077efecec3f41aaef3ebc0898881bd43aef78d99cb1a': "当蚂蚁找到食物时，会在返回巢穴的路上留下气味。", // When an ant finds food, it leaves a smell on the ground on its way back to the
  '77acab43749e5a02fb428ec6e7c17555f634436a11dfead9e61192279debe1df': "他们绕着小圈走，走错了方向。", // They walked in small circles and went the wrong way.
  '15dc7f1caa6eb15d130b7ea90aa13c28cdf98ebaeb4528f21aed8315e1ad1750': "那天晚上，我在网上读到关于蚂蚁的资料。", // That evening, I read about ants online.
  '0df3aaa5c7f5d60603b903231a57aa723c056f6c56555060802e43efd4537c5e': "早晨，地板上有一道细细的黑线。", // In the morning, there was a thin black line on the floor.
  '9d867b760a766882bce4bf1ff9fcb1e336320fb8878c48e57b74c3b31b2e4d82': "我把蛋糕扔了，去上学了。", // I threw the cake away and went to school.
  '98425a8d2e356881c2ce826476a823a9fd6c138171c97dfa1567a477a65711db': "它从窗户下的一个小洞开始，一直延伸到蛋糕。", // It started at a small hole under the window and ended at the cake.
  '304a9814d6b2ef3ec73be11b052486bcf5db8bb7df16ee2f06c5de1102733e87': "上面有一块拼图，上面有千块拼图，旁边有一张纸条：“路过时请加一块。", // On it was a jigsaw puzzle with a thousand pieces and a note: "Please add one p
  '51ca9890d540b2564ce3ff29766d930e712f8039bca99a3ec0162377a6bd8652': "一名送货员完整地装好，笑着跑回他的自行车旁。", // A delivery man put in one piece, laughed and ran back to his bike.
  'd054e38bbd3ecc8ad8b7b52b3f931e1e81794c74f7a9f18390290ff31ab6b4c3': "两周前，我们楼区的电梯旁出现了一张小桌子。", // Two weeks ago, a small table appeared by the lifts in our block.
  'ea3e7d4599865fd04b5170adf7927e930984ec93a5bd86305dd262b8fabf8a7f': "到了第三天，整个边界都被磨破了。", // By the third day, the whole edge was done.
  '00c73f5f7f80090bfd60b4de2bb4a7c2162e3840a5af2a550bc5247e302cf649': "清洁工每天早上上班前都会做几件。", // The cleaner did a few pieces every morning before work.
  'a9543169edac0e78cea2f000cbd56d64bf055fed71524fcc8229d9e9f761332b': "十一天后，画面几乎完成了：一艘红色船只漂浮在蓝色的海洋上。", // After eleven days, the picture was nearly finished: a red boat on a blue sea.
  'df82e28206efdfe70ce2915851a500d3532506fea6d71db563d4899b80d1e33b': "都是同样的蓝色，所以这是最难的部分。", // It was all the same blue, so it was the hardest part.
  '33e6830232ee9a649c5a5de43c95ced723b5abf76e0707c9c53edaf7d265ea52': "没人能找到它。", // Nobody could find it.
  '3b51c2382b2f979dcc343d9834bd3daaf5d5beb01c1e727cde95d0ae84fa56d9': "第二天晚上，一个大约四岁的小女孩和她的父亲一起从电梯出来。", // The next evening, a little girl of about four came out of the lift with her fa
  '25de1474d84e71ee314e3562f96f14603dbe0de528d521c2355948d70853d4ee': "“她想放最后一块。", // "She wanted to put in the last piece.
  '3329cd8af3e47802b50a7fcd1ffbc6f62d1b1d2661517ba05d83ef876214363b': "“我女儿米拉第一天就参加了，”他说。", // "My daughter Meera took it on the first day," he said.
  'cbf31c927a71e0535fac9b484301f838bcd11c1f938908559ea48cda6e3d80e3': "晚上，常常有五六个人围坐在桌旁。", // In the evenings, five or six people often stood around the table.
  '2ca449bd476da4e09f82d2531e923fe6201f5b41260c7f0ae882861532e3b2fd': "放学后，我和一个叫伊姆兰的男孩一起研究天空。", // After school, a boy called Imran and I worked on the sky.
  '39cf902c4555d0a2bee901590fcec6a7f3fb8a03ba9395a30b08e8af656adf69': "我以前每次都坐电梯，甚至下去也一样。", // I used to take the lift every time, even to go down.
  '4064823d36180a90d9f93cb690bea35ddd4c040343607e5d579906f412c5a9f7': "上学期我们上了2。", // Last term, we did a 2.
  '2ae3dc95c5654576d77ef4b5696fbd454fb25da56aa7293881dd7369156071c4': "我在冰箱上放了张纸。", // I put a piece of paper on the fridge.
  '20c72517028a393c115139865aa5a9c185a1afad8dd2a5321b90454c31f6a475': "体育课4公里跑。", // 4-kilometre run in PE.
  '8e37daf21c77966b92082abdf81bd3c6be285fb48ca186e9623897e8971a77a0': "你家有楼梯，而且是免费的。", // You have stairs at home, and they are free.
  '3d9077799a9fe7caa594d4d36b9ae429c3a8798c6e4ed82b1a61ed90bbd5b64c': "下去不算数。", // Going down does not count.
  '3a5c639baf9f47be83c6324d8d36589f479248dde02bfbef4f621ded49727bb2': "我不得不停下来走了三次，几乎是最后一名。", // I had to stop and walk three times, and I came nearly last.
  'b59365b8836644adba742fd8ab0da21aeb8a2accdcb4fe5fcaa58632faaa81f0': "两周后，我未曾停留地到达了十楼。", // After two weeks, I reached the tenth floor without stopping.
  '7c810e7f2de89bda7e8c741a7eea88406729366fda39805fd73bd07536583a4f': "然后我开始用手机计时。", // Then I started to time myself with my phone.
  '7420aa60d41321508eb2eb8f384ad0bdd49b42ca30af134f8ab736bb3e4e9021': "我弟弟笑我。", // My younger brother laughed at me.
  '64f56ab32480d6ed6e1cda3d7ff5b81f0658ea8a2b762d71ed05a88900fd9ca6': "我家人住在十楼。", // My family lives on the tenth floor.
  'a4cf0a7e0ff1089e6473cc7c7283c21d5ef7a5a1c79b7476dfe7bdb930f89608': "一个月后，花了一分五十秒。", // A month later, it took one minute and fifty seconds.
  'e943378009ec4a166720fb93f002b0f3c92549453241271f25665a2f0c82ce16': "在七楼，我在台阶上坐了五分钟。", // At the seventh floor, I sat down on the steps for five minutes.
  '59c7f6d6183d5f6fb5ac56b67e81e34d1c2515506b6e157c85916376c5578202': "所以我定了一个规则：每天放学后，我走上楼梯回到我们的公寓。", // So I made one rule: every day after school, I walk up the stairs to our flat.
  '50d9c0e2c6423e2e87a6d8c0152da3d43b9df238cdd8fdda6f205d34f05e8982': "电梯门打开时，我们对视一眼，然后冲向楼梯。", // When the lift door opens, we look at each other and run for the stairs.
  'c6772f8b89a75a012d323fc37942cedd94188e232ada85e3cf05ee427c037138': "Ondeh-ondeh是用糯米粉制成的小绿球。", // Ondeh-ondeh are small green balls of sticky rice flour.
  '735f8474a85bcba51f9326eb04c4f6c2dfbc840bde40e31a6bfe4366d438c559': "每个球内都含有一块棕色棕榈糖，称为gula Melaka。", // Inside each ball, there is a piece of brown palm sugar called gula Melaka.
  '1fbf13694ad8cb67fcbeec22163f15615dfb0ec2e2e9dc50021512515680a9ac': "我们把一小块面团压平，中间放点糖，然后把面团包起来。", // We pressed a small piece of dough flat, put some sugar in the middle and close
  'bc5f30a77ebe238ceb6a470c189af789efa55fae79b6a99f056b0d422330fd6b': "莉亚娜的姑妈把球放进了沸水中。", // Liyana's aunt put the balls into boiling water.
  '3538703c183e9337564dbe93dca97d8ef44be641c0a035a14c8dda217e1525cd': "“一口吃完，”她说。", // "Eat it in one bite," she said.
  '5a88bf39834ba4ec505482bba13d61995eb57592384b7f59e06eabdb1788cb25': "然后我们把它揉成一团。", // Then we rolled it into a ball between our hands.
  '3bdeca5d804819f1f0ec3fa27f67f417ab3c4b3ff94bc77b5568866361ab2ece': "我朋友莉亚娜的姑姑在我们学校附近的市场卖畠粿。", // My friend Liyana's aunt sells kueh at a market near our school.
  'c5910b26d268017aea78658d2a73b0a594c5ff0727821926bc11d3590163bf91': "上周六，她向Liyana和我展示了如何在她的厨房里做ondeh-ondeh。", // Last Saturday, she showed Liyana and me how to make ondeh-ondeh in her kitchen
  '9f1ced2445c443b94163facb999fe6223090663a2529fbce34d9433dd6c51ce2': "绿色来自香兰叶汁。", // The green colour comes from the juice of pandan leaves.
  'db2a515fc8e077b715965bedc4d3f51fb7d576c9c3b541d912a8bc2f848c970e': "几分钟后，他们一个接一个地开始出现。", // A few minutes later, they started to come up, one by one.
  '9e4ffcc1b8918fbf119886e417b95857f758b19ec1c554dc442cfac4fe3d6759': "厨房墙上还有些糖。", // There is still some sugar on our kitchen wall.
  '1e3067bbd6d05e5a5b0961f301c48ff3406df9371b6d5c3870516bd2a099a1cf': "现在我父亲也知道规则：一口。", // Now my father knows the rule too: one bite.
  'ca63983eb27d49ee1aa1bd513afcec4253b3f8bc919e533ac0add002add94049': "我咬成两半，温热的糖浆喷洒在莉亚娜的眼镜上。", // I bit it in half, and warm sugar shot out all over Liyana's glasses.
  'd1b7455730a07a70718441e1c9b57f05281f0e9bf453736874fc83b3801d4e00': "我的两个在水里破开了，糖分掉出来了。", // Two of mine broke open in the water, and the sugar came out.
  '59cff280249b0e3bd2acad2cb88aeeb5f23a2ae18b374ecdbc726ee915b70a01': "“当他们爬到顶端时，他们就准备好了，”她说。", // "When they come up to the top, they are ready," she said.
  '04099a356e9f53613c4cab96dea4ab838b45b3ca4c38ea94c210f7361a81fdb7': "更像是别人包里手机震动：无法忽视，也无法接听。", // It was more like a phone buzzing in somebody else's bag: impossible to ignore,
  'd5da38e78d90c5a74eec813b6cd2e8ec161a9198bb015016022b84001b447082': "里面没有什么好用的短语，只有我注意到的几件事：公交车上那个女人把橘子一长块剥开，我父亲不听时说“OK， OK， OK”时说得越来越快。", // There are no good phrases in it, only things I have noticed: the woman on the 
  'adac7fc1d2b6c7ae34513cdaf5898d76cce5d8088a45af159838ce0fe74f2630': "每周导师都会给我十句模范作曲册中的句子，我都能背下来：“天空和我的心情一样灰暗。", // Every week my tutor gave me ten sentences from a book of model compositions, a
  'f9bfe8cf251b1fa9227f03c42b7f98409ba40868b704cb920ae36ffb343625c3': "我的分数比平时低，因为翁女士写道，我的段落顺序很奇怪。", // My mark was lower than usual, because, Mrs Ong wrote, my paragraphs were in a 
  '6b76709ea40f97284d7b96695051ba3f552cddcec1ae24fa9580e29f0a4cfc3c': "“到了中二，我能把五六个故事放进去，就像拼图一样拼合，成绩一直很好。", // " By Secondary Two I could fit five or six of them into any story, the way you
  '85e176021aa86f5be311dd982c4a99653d70314686e43604d00a3f91185baca6': "长椅上，每位家长都以同样方式握着毛巾，折叠在一只手臂上，每当有孩子游过时，毛巾都会稍微升起。", // Along the bench, every parent held a towel the same way, folded over one arm, 
  '4d42af00cae91bb405ed7b5751afdeacebf7ab500afa6800c42b43dccf212a6c': "从小学四年级开始，我就一直记着一本好短语的笔记本。", // Since Primary Four I have kept a notebook of good phrases.
  'ffae22bf6f2093be64538493f8bbc1611535ec86b660d11b9351ac8417ef5baa': "“我读过那条评论的次数比读过任何标记还多。", // " I have read that comment more times than I have ever read a mark.
  'ac71e28e4a7417dad5cf1671eef22e9b196afe1a3da52546ab9648aa30e334eb': "“我的心跳得像鼓一样。", // " "My heart was beating like a drum.
  '09c64b1658d6b6a6024a24ce4e60ff02ae313988e2f2993cfa114a01b2739e82': "“我没明白你的问题。", // " I did not understand the question.
  '5ba6385a4eab20e204b23e81c7a6bf32a512852bebdd65dbcdb5203733486152': "第二天晚上，我像往常一样坐在泳池外，听弟弟的游泳课。", // The next evening I sat outside the pool during my younger brother's swimming l
  'a5335c832b313f1efcf82ea7558e61b27840affdb4bdcaec9a3358a521bdebe9': "她读出了其中三行的开头，却没有说出是谁的。", // Instead she read out the first lines of three of them, without saying whose th
  '07dd7285bccec49e4299d5062d2eade9dec6c98299104434ecbd24dcf6fa1279': "我无意中开始放慢脚步看待事物，仿佛有人以后会问起。", // Without meaning to, I have started to look at things more slowly, as if someon
  'ac001f0edeedb50267ea96afeff582037b0eaacaaae011a8c01a828e09b01c8d': "我只能写我亲眼见过的东西。", // I could only write about things I had seen for myself.
  'c3452beea13c53da7f4050e11945468f35d2abe7020047c42de6a5bf953496c4': "但每次就诊，毫无例外，最后都是在诊所旁边的咖喱泡芙店结束，直到今天，“牙医”这个词让我想起咖喱泡芙。", // But every visit, without exception, ended at the curry puff shop next to the c
  '4ff3c038e4a03623f61e30b4dc2c672c535a4ac94efadb91694842ed23dec672': "答案是在一节关于考试压力的课上，我们的班主任告诉我们心理学家丹尼尔·卡尼曼及其同事们做的一个实验。", // The answer came in a lesson about exam stress, when our form teacher told us a
  '1853d117d98ac6896bd1097892831b7fa4d98be34df8a15984f67a01991b115a': "在另一项试验中，他们让水泡了一分半钟，但在最后半分钟，水温稍微降低了一些。", // In another trial, they kept it in for a minute and a half, but during the last
  'd87d556b7ed15f965874454df99de58c282d9d67d01ac2b19f040510e5945db9': "他九岁，听到我打开他的练习册时，他开始躲到桌子底下。", // He was nine, and he had started hiding under the table when he heard me open h
  '49291cd413951c9dfcae4802efdf34441635baa5667b3ff75ee8799cd4eae2e9': "晚餐时，我向母亲讲述了整个实验，用冷水、著名心理学家和恐龙，用筷子在空中画图。", // At dinner I explained the whole experiment to my mother, with the cold water a
  '81a3d78fc57477088c6642c79934d026dc3f5e371ac72829c9fd8a08295d55c4': "我差点也答应了，直到我想起了果酱、烟雾缭绕的房间和雨。", // I nearly agreed too, before I remembered the jam, the smoky room and the rain.
  '78d387342dcb1bcd1cbb0fdeb28596b28162bb55e26e71f11a6d6cadcb3c395c': "最后一个晚上，我们跑进一家小店躲雨，点了Cendol，父亲告诉我们他第一次和母亲约会时掉进鱼塘。", // On the last evening, we ran into a tiny shop to escape the rain and ordered ce
  'eb013944b2819303f3db49e6a32c4bb6f84022a88a029f20fc4f9567e4e1dd33': "他答错了一个问题，我大声叹气，敲了敲纸页，他扔了铅笔，妈妈从厨房对我们俩大喊。", // He got a question wrong, I sighed loudly and tapped the page, he threw his pen
  'd1a2520aa140db27ea742b9d9320e82909d80e73dba745987c9770d6590961fd': "每天晚上我都会写下这次会谈的结束。", // Every night I wrote down how the session had ended.
  'e9dc833fbc2f4fd742aeb792221ac123102cb0ba88f93cfd573bb9ee029d29e4': "老师说：“我们不会记得每一次经历都一分钟一分一秒。”", // We do not remember an experience minute by minute, our teacher said.
  '1f94d6614969fabb1faf2acef79e0b920752fee50a40931951f2c9620d90e569': "六月假期，我家人开车去马六甲待了三天，几乎一切都出了问题。", // In the June holidays my family drove up to Malacca for three days, and almost 
  'bf90e909a7b72c6668f33686a3d5841df916194108a4563b64a7ddb1e5bf1636': "我弟弟杰登也同意。", // My little brother, Jayden, agreed.
  '5d14321675c70715220dba7996a06e2d149df4ff8b4fc313406c4666aeb5b15e': "但我留了最后三分钟做个简单的事：一个我确定他能回答的问题，然后给他画一幅我作为恐龙的糟糕画作让他涂色。", // But I kept the last three minutes for something easy: one question I was sure 
  '84b91d612da36e1c6c1da828335b3471cabd643d4068565531dd59b2d924cf15': "我开始笑，停不下来。", // I started to laugh, and I could not stop.
  '6900ab3aeada2bdb6f083275acbf12c0fbe1d57618d74e0722b17943bede7b34': "她在我们冰箱里只有一个架子，上面用整齐的大写字母贴着标签：MARICEL，谢谢你！", // She had one shelf in our fridge, with a label on it in neat capitals: MARICEL,
  '4e6b59f75bf956aa75c4dce8defb5512621fa0215aaf69063061460cbf39eff5': "一月份，我父母决定把我们的空房间出租。", // In January my parents decided to rent out our spare room.
  'b731615ce0757677d07a4f4c9cd1c96b7af767c1fa94a6fe3339b6ba81324997': "第一个月我只见过她两次，都是在走廊里，我们挤过去时都说了对不起。", // In the first month I saw her only twice, both times in the corridor, both time
  'c5735e75ba130a305a050d361da5769273ac0c7bd806b7a39c5a81e8c3e9b031': "二月的一个早晨，半睡半醒时，我从冰箱拿出一块芒果酸奶，吃了大部分后才看到它是从哪个架子拿出来的。", // One morning in February, half asleep, I took a mango yoghurt from the fridge a
  '4f5b7fc81ae4eaa5552fef852ab8b59b4ba9192d558b3a3c17721a6a6d9e5564': "她在下面画着婴儿，皱着眉头看着这个世界。", // " Underneath she had drawn the baby, frowning at the world.
  '610319382a81632c3e024ad5032bf935a056260bdabf755f8db9f0770db5fdef': "第二天早上，牛奶上贴着一封小圆字的回复。", // The next morning there was a reply stuck to the milk, in small round handwriti
  'eefa3bb437a6a7d675f402e5e6b826b916a965a1232c458115c34bfbae6d66bd': "然后我在便利贴上写道：“抱歉，我不小心吃了你的酸奶。", // Then I wrote on a sticky note: "Sorry, I ate your yoghurt by mistake.
  '3ac71f20287d0b44f9b705335330604c475dd98e27fd324bebd6738ee1e3950d': "然后，有一天星期天，她下班了，我们在厨房碰面，两人同时伸手去烧水。", // Then, one Sunday, she was off work, and we met in the kitchen, both reaching f
  'a985376585579ae85e700d2fd69a077d6c6bccd5e29e4765174e029945c6d03f': "我在厨房桌旁大笑出声。", // I laughed out loud at the kitchen table.
  '67cb2fd33449c330e7f8f2de1c2137c157e6fc73d7890ad06e850313d1cc0b8d': "玛丽塞尔是一名来自菲律宾的护士，夜班在婴儿出生的病房工作。", // Maricel was a nurse from the Philippines who worked nights in the ward where b
  '597ca8183b6f559f4b6db23c398ba64c8eb331170baebf157602e01a288c1020': "她告诉我有双胞胎出生时间相隔七分钟，还有一个哭声比宝宝还大的父亲。", // She told me about twins born seven minutes apart, and a father who cried loude
  '21dae44f7516b4c0d77d6c1e0265cb397322955cdc61d08ba2e2bb80257a5a33': "芒果是最好的，所以我理解。", // Mango is the best one, so I understand.
  'fd2e9a200c5fd2298f36a8564c8b3d889506f40cbcf32673eeb8addc360d255c': "但有些晚上，在玛丽塞尔上班前的那个小时，我们一起坐在厨房的桌子旁，她吃着晚饭，我做作业，几乎一句话都不说。", // But some evenings, in the hour before Maricel leaves for work, we sit at the k
  '7da70b8e6d920392a1429f9c33e960e673cf8c002ef5a40f6a58d990cec96394': "九个月里，我们大概只大声说了大约十五分钟。", // In nine months we have probably spoken out loud for about fifteen minutes in t
  '52ee80418e57eba5f1647d676afedb15edc5d46ab971fffced9c754ba765cd96': "那天下午我买了两块芒果酸奶，每人一份，并留下了一个问题：工作中发生过最奇怪的事情是什么？", // That afternoon I bought two mango yoghurts, one for each of us, and left a que
  '11cc978f6610523ed219c5ee5172978e8691e76f364bc7494a6117814bf57239': "店主们问。", // Shopkeepers ask.
  '769ea769f4661358107fc53f14c36cd3029acfcfb7053be790a9e89b1f7a3243': "他们一路争论到停车场，我跟在他们后面，笑着。", // They argued about it all the way to the car park, and I walked behind them, gr
  '060abc35a380ceff222006c0cb0df780e4caf181384cd1f9b46c52dff7f624b3': "接下来的三周，我把脸上涂成小块。", // For the next three weeks I painted my face in small patches.
  'b9a0316a3a6183ab2f53d1dff54c9ab433c116aa3a5f4264e1bc102c029afa9a': "家长节时，画像会挂在走廊里。", // On Parents' Day the portraits were hung in the corridor.
  'a9ec456ac4d45c2608271a82450ad26f454eba5779b5d2324c52ca9515dffa09': "在美术教室后面那个旧的彩色铅笔盒里，有一支铅笔标着“皮肤”。", // In the old box of colour pencils at the back of the art room, there was one pe
  'd74849a0f60b77043fab395bdf70c682f0664b5000352652cad57ecb9a139b80': "在中学三年级时，我们的美术老师Tay先生给了我们本学期的项目：一幅用颜料画的自画像，从镜子前完成。", // In Secondary Three, our art teacher, Mr Tay, gave us the project for the term:
  '2988c33a80c561666762b80b78842f0053b9e5632cc85f57e99b36405c40cdce': "昨天我把它取出来，削了一下，然后在标签上写了一个小词，就在“SKIN”前面，然后才放回去。", // Yesterday I took it out, sharpened it, and wrote one small word on the label, 
  'e7636e5dc8b92f1ddee2c25f175cbda540e5e86669c7a7ea3656d60e045fab40': "四十分钟后，我手里有一盘失败的棕色，纸上出现了一个看起来不像我认识的人的脸，还有强烈的渴望把纸撕成两半。", // After forty minutes I had a palette full of failed browns, a face on the paper
  'd18a2303e352b4a4a5ce8f511be778101dfbd49cd9c9237bf96c0d6354ccf786': "有些斑块是黄色的，有些在阴影中几乎呈绿色，还有一个在我鼻子旁边，我只能称之为奶茶色。", // Some patches were yellow, some were almost green in the shadows, and one, besi
  '1c053a92404a8093bdb05f9ecdd7eeb9cfc3c0add4b5f7b689035a20e292f432': "“大多数同学都发出了呻吟。", // " Most of the class groaned.
  'd0047d4046933d55272a8fabebc621f9c489efc2adaf9965b2b05574b5970419': "阿基拉从旁边的画架探过来。", // Aqilah leaned over from the next easel.
  '7dfc5073f7ca6d77766cb39ee6f81642964686a261b34df1e8424844dc22b309': "我的手掌更粉红，指关节颜色更深。", // My palm was pinker and my knuckles were darker.
  '86ca5c9ae121035559fa09fec3aaaf79189c65ca04ffc71b265a8dfb3cac0047': "那是草莓牛奶的淡粉色。", // It was the pale pink of strawberry milk.
  '812dedcdfe05e44956e74ae15d45ba205456b465767bb79ed88883995c910ddd': "她让我先看手背，再看手掌，告诉她颜色是否相同。", // Instead she told me to look at the back of my hand and then at my palm, and to
  'c2f33625145f6c4d30d9fd8e26edaf8b63324e9c49c01f6e1a14af8d6608ae7c': "我先用了棕色和白色，看起来像泥巴。", // I started with brown and white, and it looked like mud.
  '08db995dad2c1c67216e7492e0c29b1a1a8ec145b91a0370f994e824127dca42': "第一个问题是颜色。", // The first problem was colour.
  '6f70043ee9718a634834f5280ffb1b3e5d724e16358a77d92d1b20c2472b53e8': "这和我们任何人，桌上的任何人都不匹配。", // It did not match either of us, or anyone else at our table.
  '2a6e8eb316fe332b4706400a47a4f2fcc5698414e7a07b3a6df8ed8608522154': "到最后，我在一张脸上用了十一种颜色，看自己的时间比以往任何时候都长。", // By the end I had used eleven colours on a single face, and I had looked at mys
  'ae84f45eb1202b570627de24c3c4ab702f8be9719250ff3c523b2112745f3518': "乒乓球是毫米的运动，两年来我的手一直知道球会落在哪里。", // Table tennis is a game of millimetres, and for two years my hands had always k
  'a1b7fad50e38e9eb7058e2e92d93cb1919c1d7c1edc9b9ba874ffdd0d3a449ef': "我为他鼓掌，而且我大部分时间是认真的。", // I clapped for him, and I meant it, mostly.
  '18192ac90b789a35deb440f1638758dae8121c270fa8ea64cc3da14294cb411a': "每天晚上，我都要站在家里的镜子前十分钟，慢动作地打球，没有球，全程盯着自己的手臂。", // Every evening, for ten minutes, I was to stand in front of the mirror at home 
  'f50da05b7153e22266da4791064e258c3c6b35581a0c970546879ea68b8e0bcf': "“几周来第一次，我松开了拳头。", // " For the first time in weeks, I unclenched my fists.
  'e5670d2303d2b6813e55856c0facf4315dcc3b9263caa5d2595820541569a7d6': "在我十四岁和十五岁生日之间，我长高了九厘米。", // Between my fourteenth and fifteenth birthdays, I grew nine centimetres.
  'd8ccca11b7e1caf150139212e89b0105539f8fde8187d827878c26111f9e9d89': "我的肩膀很疼。", // My shoulder ached.
  '3cae3639204dda4f5006708cac34d7ac4a61edcbf3c0f7abcba37821e3e001ca': "回家的公交车上，我把长腿盘在前面座椅上，一路望着窗外。", // On the bus home I sat with my long legs folded against the seat in front and s
  '84946123357be5d4fc8b4c2d2ff0a7b884cf0f85fefb2b71d686f5a16ab11d1a': "四月份，我妈妈把厨房台面上的一个玻璃杯撞掉了。", // In April, my mother knocked a glass off the kitchen counter.
  'f528786c5acf31ef935b4e601ca010ac105345f988a22660f91ac7d78e77811f': "但上周，几个月来第一次，我打完整场比赛时一次都没有被自己手臂的长度惊讶。", // But last week, for the first time in months, I played a whole match without on
  'a32493c27e299857207c8709aa46d9d01b202710b57788133d3d330c0d73f21a': "我的双脚似乎比身体其他部分早了一瞬间到达。", // My feet seemed to arrive everywhere a moment before the rest of me.
  'c5f7e2358dc8d32cbb545c420af2054e8a441485dc9bfd2b2aef11abc99d6449': "然后我尝试用我解决一切的方式来解决问题：做更多。", // Then I tried to fix the problem the way I fix everything: by doing more.
  'ed0aa68e809f13b4935f6647caaff11375822dc19235942735e3e6ab95e198eb': "每隔几个月，我妈妈都会把我靠在厨房墙上，用铅笔在我头顶画一条线，到了十二月，线条间隔得太远，我妹妹说那看起来像楼梯。", // Every few months my mother stood me against the kitchen wall and drew a line i
  'b0ae596714ba449e12f8001fe9d5f73dcea7b7b32f35e9a1b8697e1502627a54': "他赢得了前两场比赛。", // He won his first two matches.
  '09d08fde793c6dfae6a742946ea18bb7b4053cb7a78f3466dbac11e1c5ed2bd0': "从中一开始，我就是学校乒乓球队里最棒的选手。", // Since Secondary One I had been the best player in the school table tennis team
  '90d83938e38e570cad2ff0e748ecaa1360d19f6e1477dff01e313e44390b103b': "一周后，张教练发现我独自一人在大厅墙边击球。", // A week later, Coach Teo found me hitting balls alone against the wall of the h
  '4e4d00a12bc4a736856bf479b120570c5d9b6cdc3926902b6c37d64519000bf1': "我自己设置的，之前看过整本说明书，我家里没人用过。", // I set it up myself, after reading the whole instruction booklet, which nobody 
  '02c902904fd9876c5d63dc7534d456086d5de391db4fd3a4ffaf5c8602c9df19': "指尖的皮肤坚硬闪亮，像旧鞋底，布满细细的白色疤痕。", // The skin on his fingertips was hard and shiny, like the bottom of an old shoe,
  '3743f97ea43a1071ea46032acf8cbd3a037e81a5ee1f0229c553be3464b859ff': "周六，锁公司的一名技术员来了。", // On Saturday, a technician from the lock company came.
  '2a175b4bd039a85353f9a27a5050eb41de1473297735309489feebb10d3f75e2': "锁发出低沉的哔声，红灯闪烁，一个平静的声音说：“请再试一次。", // The lock gave a low beep, a red light flashed, and a calm voice said, 'Please 
  'd9c0cc46839cfb82f595ff6f0ba8ed35c9a26543c9760ae7245c640718568834': "每天晚上七点，门铃响，总得有人起床让他进来。", // Every evening at seven, the doorbell rang, and someone had to get up to let hi
  'd73615ac6263da868ff045ffc6da8a73b5f7d90bf0bc79d2e9189e0a6479e44d': "“你的指纹几乎都快被磨蚀了。", // 'Your fingerprints are almost worn away.
  '21090fea794bb0f25191e6c7062236c669a8e30942cbdb3b75f81e499d0e8308': "每次锁都会播放欢快的曲调，绿灯亮起。", // Each time, the lock played a cheerful tune and a green light came on.
  'ca4ca0510a594b3c81a692819414e201cc86f961654c571ec249b846d33f5b36': "周四，当我最喜欢的节目中铃响时，我拉开门说：“你的拇指没用了。", // On Thursday, when the bell rang in the middle of my favourite programme, I pul
  'a9c983622012e0bd48ffc13dbd8679224b36f29291426f5badbf97a8649c8645': "二十六年来，他一直在别人家里爬梯子、打开热金属箱。", // For twenty-six years, he had been climbing ladders and opening hot metal boxes
  '22ec02c94d1962c6b2ee4b51e6fe3d53843c220cba92ffea66a6646c91d9640c': "他用拇指按在玻璃上。", // He pressed his thumb onto the glass.
  'd8cb6563c72450513aa6d7bd5d0732666502617acb303253c82fd12bfabdf9f0': "我站在后面，双臂交叉，像个实验成功的科学家。", // I stood back with my arms folded, like a scientist whose experiment had worked
  '7c773f48a03a58c2a20e9141f4e935260d75165e1c23fa16107c595815c1bc47': "我试过护手霜、温水、轻轻按压、用力按压。", // I tried hand cream, warm water, pressing lightly and pressing hard.
  '3df00b449767a2e361caa76d78f688752ee78c21f2b4a81923be9c2e77b09ed1': "我反复查看手册，确信自己漏掉了步骤。", // I checked the booklet twice, sure that I had missed a step.
  'cc5b0e82c2c83148f137383de8a326f976968bb00163b12791df1ef14c6d9e2c': "我一个接一个地把每个人的手指按在那个小玻璃方块上：我母亲的、我姐姐的和我自己的。", // One by one, I pressed everyone's fingers onto the small glass square: my mothe
  '7230154fb359c734be7d781bd8e8fdf53890e19a4fa6ba56b77d2c5a73410968': "他离开后，我认真看了父亲的手，也许是第一次。", // After he left, I looked at my father's hands properly, perhaps for the first t
  '91bc69306a0ecee89a159c626aefb8566231c4bc00dd61accbaf2e67252b0fb7': "我以掉东西闻名：手机、午餐托盘，甚至有一次在食堂掉了一整碗汤。", // I am famous for dropping things: phones, lunch trays, once a whole bowl of sou
  '823a9533cc794dcd1d91e3502f2f5af21024f4a8120f5db10d260f3198cbb1d1': "在我们今年的第一节物理课中，塞尔瓦姆先生一边抛弄三个橘子，一边讲解物体如何落下。", // In our first physics lesson of the year, Mr Selvam juggled three oranges while
  'b3c0fa9d246083484c5d23da758dceeb5555bfafba973867becc6c5b6e7bfbf7': "第十个晚上，我把球扔进壁橱，告诉艾萨克塞尔瓦姆先生是个骗子。", // On the tenth night, I threw the balls into my cupboard and told Isaac that Mr 
  '172b78c2c7105abcd8fcb5e5f3d4ea7795e2ac48306eb9c82557cafafdd0e340': "我站在衣柜前，近到鼻子几乎碰到它。", // I stood facing my wardrobe, so close that my nose almost touched it.
  '8ef8ac958edc064a540c6e023048fa9e50680afd9d08a60daf5e2237411651c7': "我一路数到三十一。", // I counted out loud all the way to thirty-one.
  '1ef897585b62c75b5e75aa53a70f58beca38c98ef537a8c0da38e34958cebdac': "所以我尝试了一个听起来很傻的办法。", // So I tried something that sounded stupid.
  '3cdd0599fd1c5020dce1cead6bfe6b674a72b9d60b9bf7fd0c1045a763d16393': "它们曲线完美地起伏，他从未看过自己的手。", // They rose and fell in perfect curves, and he never once looked at his hands.
  '207c87e2d9650a8312d6274fb8b57b28d5b0ce90135381b983aaa8fb4c3eaba7': "这解释了一切。", // That explained everything.
  'c1cdaf576bc13a1fffb6f74f8e5cf0c4d667b4fced89bb39d111a6d7a663abbb': "那天晚上，我从我九岁的哥哥艾萨克那里借了三个网球。", // That evening, I borrowed three tennis balls from my brother, Isaac, who is nin
  '26e0ce5da9371f7569ff9e2a86f10136deba66e05945a1d1a2a75703e74a8c40': "我父母放下手机，艾萨克关掉了电视。", // My parents put down their phones, and Isaac turned off the television.
  'd130c2c3dced21a121760ac79c3b799cfd40693b12983bf1024e549c0092d6f0': "那是三周前的事了，我的家人到现在还没见过我做这件事。", // That was three weeks ago, and my family still has not seen me do it.
  '1900cae4b7d3e2724273c0befd2d946b263b79e02b9559632408f6c544b0eaa1': "“任何人一周都能学会，”他说。", // 'Anyone can learn this in a week,' he said.
  'fee6747b232de22b811657da4b1a9a273297dcf52e7f203c40f425bd7ed3efbb': "第一天晚上，衣柜被撞得太频繁，我妈妈从厨房大声问我到底坏了什么。", // The first evening, the wardrobe got hit so often that my mother shouted from t
  '59143ac211dfef217630d067c9c30e9a380fd10a2f775cefc2459310f0badfc1': "我在卧室门后面写了一张清单：第6天，四项捕获。", // I kept a list on the back of my bedroom door: Day 6, four catches.
  '6f0e440314e9b9fd9798a54fa129e43b46a6317b80a8144c7cc9bfac303b327f': "有个网站告诉我先用一颗球开始，从一只手扔到另一只手，曲线和眼睛一样高。", // A website told me to start with one ball, throwing it from hand to hand in a c
  '9ad5d24323a0cef384116bb0106ae249f18418278257d912c953670e5b6b1558': "当我停下时，我站在前门旁，离录像带有四大步。", // When I stopped, I was standing beside the front door, four big steps from the 
  'b51262b4656c40b2bee6e22e0bcce15e018aa3b6fc6ef580b65057fa05dd7fac': "我张着嘴盯着它看。", // I stared at it with my mouth open.
  'fab4889aaf5a30b3760c972c5bfe5e3a2a643214ab84469267849c6485c18269': "在底部，他用自己颤抖的字迹写道：“请进。", // At the bottom, in his own shaky handwriting, he had added: 'Please come.
  'f9c14b481c976f6f87d98d4876c456088bf7b3e7608fffae03412d9bac59721b': "她解释说，中文中“送钟”的词听起来就像是向临终者告别的词。", // In Chinese, she explained, the words for 'giving a clock' sound exactly like t
  '007bcfb3ea6f2b0f8872d1b3064cf62ad1aa02344949ba2eef42a943115694c7': "每张桌子上都有桃子形的包子盘，亲戚们一个接一个地递给她祖父红包。", // There were plates of peach-shaped buns on every table, and relatives handed he
  '21e97778e11dbc1c280c8b083a7cfe0b1d46427369aef747e6dc72006998a5af': "凯玄拉我走到走廊里。", // Kai Xuan pulled me out into the corridor.
  'e44aae4fcc8ba6645c39d66f9e48a01f3c573296534add36a6e7885c1f1553e9': "“生日那天，”她温柔地说，“这大概是最糟糕的礼物了。", // 'At a birthday,' she said gently, 'it's about the worst present there is.
  '2bcc25825eb54de6b1dbbc13b12642d1d1f4850494f2baa8e39c48e02b675b80': "所以我把大部分积蓄都花在了一个带有金色表盘的小木制钟表上，并用闪亮的红色纸包好它。", // So I spent most of my savings on a small wooden clock with a gold face, and I 
  'e864fb159e2ac613f45d09302318e8eeac6b87538855b3e9ef56e69c47a7a606': "一位阿姨放下筷子。", // An aunt put down her chopsticks.
  'ed8b5b6976ebe65fa980faad2f8dc0bbf74c77dd37bc7034f8785317d847c0a0': "别带任何能动的东西。", // Bring nothing that ticks.
  '6209ff6ef23203e2aa42b190bc97e218132f253cf7b8d41e23f6f2781b32f435': "上周，他收到了八十一岁生日的邀请函。", // Last week, an invitation arrived for his eighty-first birthday.
  '202e86fc088e7f933e6baa175899db03b4d8d3396922fac243d329410b93f280': "餐厅里吵闹又温暖。", // The restaurant was loud and warm.
  'a5d0cf96c884bbf31db4f58566f6da1fcd9c8a0ae41ab04ec495b575c2c5c46a': "有人用我听不懂的语言低声说了些什么，凯轩的脸色顿时变得苍白。", // Somebody whispered something in a language I did not understand, and Kai Xuan'
  '64f535417861173f4e06f1fc17ae2999c3a0c707d21f15c9ce34883cf573fc3e': "我是唯一一位不是亲属的客人。", // I was the only guest who was not a relative.
  'd35560e1ab59dbe10db75279971949094bba4c0c7dca9dc6f4e5c0565966836c': "那天晚上，我把一切都告诉了我妈妈。", // That night, I told my mother everything.
  'f9b913d3b0e110b4313b2729463ce782a55d77f9a829b5911554dadb7f2568f5': "我母亲从未空手去看过任何人，她说人们总是这么说。", // My mother, who has never visited anyone with empty hands, said that people alw
  '0119d59a08dd9749491e2738f330b04f12dfb14c796e43eea0bb3ead3945167a': "我张望着两张脸，试图弄清发生了什么。", // I looked from face to face, trying to work out what had happened.
  'c419ce346c7b93f05aa8de5e34ad7624e5e7f685b2fff4cd1d0c6eff16a4fa22': "我父亲用手捂住脸，我笑得脸颊都疼了。", // ' My father covered his face with his hands, and I grinned so widely that my c
  'd3a41569368532e3c4481bf28eadf3621ba7796c45b3e16eeb5538f26c750a33': "本学期历史课，瓦尔吉斯女士给了我们一个不同寻常的项目：找到离你家五百米以内的一个地方的故事。", // For history this term, Ms Varghese gave us an unusual project: find the story 
  '4196ecbb9485ecf0e8e51fe7b0057f7a5fb5472ee50167a2a0e1d17299e8d093': "相反，我找到了一篇1995年的短文，题为《学生们要搭桥》，附有一张小灰色照片，照片中五个孩子手持标语牌。", // Instead, I found a short article from 1995 called 'Pupils Get Their Bridge', w
  'cfd266cc1b633a6fc349889cf75cce061613e393c68dda6332482c523f11e7b4': "我公寓附近有加油站、停车场和一座横跨六车道道路的天桥。", // Near my flat, there is a petrol station, a car park and an overhead bridge acr
  '85ef4466635f5484eae53221b338239125babf3da078f212e5285e0b40eb4ca0': "周一，我停在半路上，低头看着沿着六条车道飞驰的车辆。", // On Monday, I stopped halfway and looked down at the cars rushing along all six
  '29db7130ab6ec5cd82efc9c5b19893e5219f3914741d49f20d63e0955ebd4f61': "但上周日，我们一起过河时，他半路停下，掏出手机拍了下路面的照片。", // But last Sunday, when we crossed it together, he stopped halfway, took out his
  '1b84ad864a7a5e7ffab5775a9b2fd7097a8e8220085595b788a5b859b12b8353': "我坐在那里一动不动，直到图书管理员问我是否还好。", // I sat there without moving until the librarian asked if I was all right.
  '84facd55a61edf01b7d032ad3fd2b40632838e47f4cbf218d5ceb462db651b82': "三十一年前，我父亲背着书包跑过那里。", // Somewhere down there, thirty-one years ago, my father had run across with his 
  'efd4745cd31f46b3729792814200a3e582f0ea3343d370b3c3894578905b1d95': "一名男孩差点被卡车撞后，一班十一岁的学生收集了两百个签名并写信给报纸。", // After a boy was nearly hit by a lorry, one class of eleven-year-olds collected
  'b8f9bcf70f27c3237687352c0d800fc1df712027c79465a4b1bec242591ef056': "中间的男孩有我父亲的耳朵和站姿，一只脚向外。", // The boy in the middle had my father's ears and his way of standing, with one f
  '5256d4291586196138ddbe4f77054d666418cdd957afb66abc267d82e113e815': "完整文章解释了一切。", // The full article explained everything.
  '178912a02bdb7731103e01138eab0abfb30ab74ca1501d9b7837badc3149bc07': "班级先用铅笔写了信，老师因为拼写问题让他们复印了三遍。", // The class had written the letter in pencil first, and their teacher had made t
  '0717b702f12126ec9b834249ccf9440883b6f6ec1c17265131b6ebf1f953cba4': "我选择桥梁是因为它三者中最无聊，我期望一个下午内完成项目。", // I chose the bridge because it was the most boring of the three, and I expected
  '86e8b30234d8a5203ecd82aa055087c99967b9ba506979aad99ac42d908b50d0': "路边小学的学生们过去会穿过六条车道去公交车站，因为最近的红绿灯距离很远。", // Pupils from the primary school beside the road used to run across all six lane
  '7ba43e1751a0e44d5e1bd92f5f8f8c3aea0694f3f33add199e3fcc3f08e09f19': "有一次，我待得很晚，看到她跪着，用刀刮掉我们椅子腿上的旧口香糖。", // Once, when I stayed late, I had seen her on her knees, scraping old chewing gu
  '0454ad7a70042cdfc72fd16657c1b58996e13eca957604f4ea3838c546a567cb': "周五放学后，我们俩在楼梯旁的小储藏室里找到了奎克女士，她正在装水桶。", // ' After school on Friday, the two of us found Mdm Kwek in the small storeroom 
  'b38d0279b652d881d3e6b7c7f2aedb0787fd76e9bff4077e63af22caa5d10542': "不到一分钟，达里乌斯就在白板上写下了配料清单，班上半个学生都在争论菠萝。", // Within a minute, Darius had written a list of toppings on the whiteboard, and 
  '8ffd7bdf7dd609edd7de9effec3dcdd0500d6c1f9ea8e46acc8632583e8df832': "周三晚上，我关掉手机，把它塞到枕头下面。", // On Wednesday night, I switched off my phone and pushed it under my pillow.
  '4a4a432fda4274e3615cf3aee20ff8ed5b72fef49c4406826c6a389a203611e8': "我们正好清洁了一周：检查的那一周。", // We had cleaned properly for exactly one week: the week of the inspections.
  '82969ef21f3501df3115d0d567bb8d43949bb0527a2fbfc15a798d163ca30a9f': "在聚会上，我们把最大的一块留给了郭女士，她用餐巾纸包好带回家给她的孙子。", // At the party, we saved the biggest slice for Mdm Kwek, and she wrapped it in a
  '198f761f9f1e20d6da450d21115f000f5ae41e229a2c8dd34e4afc92f5a7bd95': "最后，伊莱恩说了句显而易见的话：“我们为什么不直接问她呢？", // In the end, Elaine said the obvious thing: 'Why don't we just ask her?
  '8ae1b81eabfbd1aa42540c4630e9cda86ebc21b39aa017453850efc139b759d6': "我转过身盯着她看。", // ' I turned round in my seat to stare at her.
  '3cf21814a89ce3015de071029b9baeef11903a2ef9546d7c60abd386dead6623': "我敲开着的门时心跳加速，解释得很糟糕。", // My heart was beating fast as I knocked on the open door, and I explained about
  'ce7fedd13c514999a54fa9670f09b7d5426373cbe9ba57630d399656ca118e87': "每周五一点半，三十五把椅子会被摆到三十五张桌子上。", // Every Friday at half past one, thirty-five chairs go up onto thirty-five desks
  'b4d9d1c489100d59813e641f1a6740ecb95794a41247a26abd5868ed733a5afd': "奖金是一百五十美元。", // The prize was a hundred and fifty dollars.
  '227c4eaf5888c267e2c573e2ebe54038a06308f92365aa8735ee0b561849e2ac': "我们的班主任巴拉先生说这笔钱是我们的，但他有一条规则：在我们三十五个人都同意如何使用之前，他一分钱都不花。", // Our form teacher, Mr Bala, said that the money belonged to us, but he had one 
  '5a5852b9aa75854882addf268295ffd6e5e1edcd364dc775ae8a0ce13b928d90': "然后，伊莱恩几乎不在课堂上说话，她母亲晚上打扫办公室。", // Then Elaine, who hardly ever speaks in class, said quietly that her mother cle
  'b05999bd5aadd923030b895d74404a9d27fdd865ad66199ffeaf04e6ae0a65e4': "一周内，我们无法达成一致。", // For a week, we could not agree.
};
