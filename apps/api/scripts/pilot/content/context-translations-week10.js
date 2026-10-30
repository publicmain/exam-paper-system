'use strict';

// 首发周例句的中文句意。key 是英文原句的 SHA-256；
// content/index.js 会逐条校验，少一条就立即报错，不能带缺口发布。
// 由 scripts/pilot/build-week2-context-translations.js 生成（Azure Translator），
// 生成后经人工复核。行尾注释是原句，方便审阅时不必回查。
module.exports = {
  'dfd03378903caa4aa6c2d8dab6d5ceb01c2e8b5502c6f73d85764408cd3ad537': "一个包含无差异化页面列表的宽义条目可以简单地将原始搜索问题转移到更小的空间。", // A broad entry with an undifferentiated list of pages can simply transfer the o
  'ef6133927cf820a9d32868b32514bd85485fb8432189fabf44da7e77607a4122': "在这里，内容组织与位置标注的准确性密不可分：即使一个条目标题能准确概括内容，若把读者指向别处，用处也很有限。", // Intellectual organisation and material accuracy are inseparable here: a percep
  'cecc9e9c3205ad186af40b1c978b0a4680834cf13216a5220dc6d52dabedcd9e': "因此，制作有用的主题索引需要在术语和关系上做出决策。", // Producing a useful subject index therefore requires decisions about terminolog
  '3cec0e87291d6fa7e48f1f66f600fec2835feeab650fbbe39d2d125bf7858972': "例如，关于灌溉的讨论可以在不同区域组织的章节中进行，而不是单一章节标题下。", // A discussion of irrigation, for instance, might occur in chapters organised ar
  'acf6e8a0b74a7f308bd01ae4e6516dffdbc06dff847e7a8776690d4f90d079d5': "因此，定位词汇与判断概念上的相关性，是相互关联但不同的活动。", // Locating vocabulary and identifying conceptual relevance are consequently rela
  '6923f1b8b8db42ff4e7dcd7d784fd2c3fb71ad9969c01ce7fedba8dde466cfe4': "这种看似简陋的装置有着复杂的历史，使阅读与持续注意力之间的熟悉联系变得复杂。", // This apparently modest apparatus has a history that complicates the familiar a
  '9e9e2ce663cfaafc094ef412f5976557ba1975d654c7d9e192065b02b55c0722': "在欧洲手稿文化中，早于活字印刷传入之前，字母索引就已存在。", // Alphabetical indexes existed in European manuscript culture before movable-typ
  '7c57ca629ac3ab0b0b224f0d830227c759b27ae55aebb4c843832ec1d03b833c': "索引访问的理念因此早于广泛复制页面布局的便利稳定性。", // The idea of indexed access thus preceded the convenient stability of widely re
  '8137cb4f87e7d20bfb18d69684ad2166c427f3f28a01d69288a56e48cc582664': "词汇索引收集词汇出现，而主题索引则围绕概念组织引用。", // A concordance gathers occurrences of words, whereas a subject index organises 
  '6e623ae7475fb6270c75b35fe020127ff039e4ed5996eb874fe9aabfb883c678': "这并不证明人工编制的索引总是更好，索引可能遗漏有用的联系，而搜索可能发现索引编制者忽略的某次词语出现。", // This is not evidence that human indexing is invariably superior; an index can 
  'c18dd6406d797e6abb715673689d5da9bebbb889612f544724c630d5b8c492bc': "早在电子搜索出现之前，书籍的设计就已开始照顾那些希望从论证中途而非开头读起的读者的需要。", // Long before electronic searching, books were being designed to accommodate rea
  '86cba758b47c47b3195f9dbf29d2ec3a351ca37696b5fa3d7e071360ea4ae459': "关于哪些术语应标注标题、哪些术语被视为等价以及提供多少细节的决定，反映了对作品及其潜在使用者的解读。", // Decisions about what deserves a heading, which terms count as equivalent and h
  '2b1cdd9aff3a8d20aef27f6bd2bb36f6687c15e0195d3f48c83245d09e7e4e28': "当一部作品重新排版、增补内容或以不同开本发行时，其页码编排可能发生变化。", // When a work was reset, expanded or issued in a different format, its paginatio
  'f9e20e914728ef1869d1c7d0fff28a9f0337c927e27688cf3c68085b172f9228': "不过，对于索引表面上的客观性，仍应谨慎看待。", // Its apparent impersonality should nevertheless be treated cautiously.
  'f149eaae9b064d9018c671fdea50a3e9ed83fb50a3911f42963af210d4f85d2e': "穿过一本书的第二条路径从未独立于选择入口位置的人。", // The second route through a book has never been independent of the people who c
  '347abcc3af8acb42be3e42bed0a9a44501383c09bfdeb7ee910bd628ce6441f9': "因此，索引既是阅读优先级的证据，也是定位信息的手段。", // An index is therefore evidence of reading priorities as well as a means of loc
  'bba688c934758ea5fbd443d17aadeaac002812bf3092c5aa14b70ba2d993424b': "学者查阅篇幅较长的著作时，需要能重新找到某段文字的方法，而不必重读全部内容，索引中的指引可以把他们带到某个章节或某一叶。", // Scholars consulting substantial works needed ways to relocate passages without
  '41e3a1b469acd488d37bf15c60d24989ddb32269d92f8d4d388ddc469ecd4c53': "词的出现频率或完全缺席，都不能决定讨论是否属于某个主题。", // Neither the visible frequency of a word nor its complete absence settles wheth
  '5ab788aa2d3c07ad27b750c6c4fca2d0d8976a996c8ff4c131d4c8f5f723add1': "想象一个社区协会，其陶瓷室需要一个无障碍的工作台和一个替换窑炉。", // Imagine a community association whose ceramics room needs an accessible workbe
  'bc8b150269e1e298f0bd29fcd452113b4596f508060c5aafd213ecbf8a26bfb8': "有限期限允许事后审查该贡献及其条件是否仍服务于协会，而非允许临时的经济需求无限期确定该地的身份。", // A finite term allows a later review of whether the contribution and its condit
  '5427f1203488b9d13ed3b3e8d50fe9a25fa1383292334cbda57f1c12d89683c3': "可见性很重要，因为参与者无法评估他们无法发现的条件。", // Visibility matters because participants cannot evaluate conditions they cannot
  '3fa3a54ef483465ad4df7002445f1db27f990dd7db8552a009c8a6ae03285778': "透明度促进了审查;但它并不取代对共享空间目的的实质性判断。", // Transparency enables scrutiny; it does not replace a substantive judgement abo
  '1d5959cd35ad9b3d5dd927f85cc9ad8c54ec33ac7503eae0036f31403fb81c6a': "续期前，成员应审查实际授予的特权和实际可用的机会。", // Before renewal, members should review the privileges actually granted and the 
  '417f0a03e3f2af9809bba67df5bf2409ff7d7f46768d2665641ca63eacdd558a': "公司名称出现在墙上，并不一定会损害共享场所的价值，只要协议给予用户更多机会，并使赞助商无权将客户身份作为归属的代价。", // A company's name on a wall need not diminish a shared place, provided that the
  '59f72e55fd8ac05c9eaaa3ea5276abdd1170b11f24987aef56bee42698b5f81b': "公开承认可以是相称的、明确的和临时的;对普通参与的控制应保留在社区协会手中。", // Public acknowledgement can be proportionate, explicit and temporary; control o
  '64e0b52c7e299453f4b1d0ac2b4327a9b1ae4c89fdf4bed8de5d82119afdd810': "考虑赞助的协会可以在接受前公布拟议的认可、任何独家特权及安排的期限。", // An association considering sponsorship could publish the proposed recognition,
  'fe58910f3d7fbe1f93300bd32e45375150b47ddb6084e94c3abe4b284813aca5': "场所可能仍对外开放，但参与其中的条件已经改变。", // The premises may remain physically open while the terms of belonging have chan
  '0c44fb3d508391a831a45f4722aa043b26c60bd61071af411ae589b7d1c0793b': "这与在设备旁放置一个适度的赞助鸣谢标识，是性质不同的安排。", // This is a different transaction from placing a modest acknowledgement beside e
  'ba345507b2e383802067a6c552a9895075d914c7d727c9d3da2c994fe70cad4b': "成员们可以区分一个有名称的工作室与限制其内活动的协议。", // Members could then distinguish a named workroom from an agreement restricting 
  '52d9616e20d5749bfffbcb8338a80e375d6471729e370f913ebc1c5e5ec57a3c': "评估员应询问居民有权做什么以及有多少人到场。", // Evaluators should ask what residents are entitled to do as well as how many ar
  '54b94bcc46c8f840ad6330b7bf126bfb1458b8811c41fd1de0cf587c15cce5c1': "诚然，这一反对意见暴露了完全独立的不切实际图景。", // Granted, this objection exposes an unrealistic picture of complete independenc
  '5a04e7f04361bc32ef5fae3ace3911b5fd458704cffc4f2aa902cf81a0824dc2': "社区大厅可以通过同一协议获得新地板、更好的设备和公司名称。", // A community hall can acquire a new floor, better equipment and a company name 
  '9dabd19fb4b409c31287aa289fc962f9a247e5bc8f837a407fae84677c78a14d': "想象一下，一个几何评估旨在评估学生是否能够证明某个构造的合理性。", // Imagine a geometry assessment intended to evaluate whether students can justif
  'c8a24fda1c48009b141ec8b6c8dcd6ebcbf07f7f5e7cf60abde1a00699af4286': "流利的表现可以将注意力集中到更复杂的任务中：一个能够轻松计算熟悉量的学习者，无需在研究更大问题时重构所有基本程序。", // Fluent performance can free attention for a more complex task: a learner who r
  'c2a08ca5ee6008905fcaa21464e5862f85f2b0375664db119500b4f8f23797fe': "因此，仅以每个人都获得相同的作答时间来辩护，理由还不充分。", // The defence that everyone receives the same number of minutes is therefore inc
  '9af641aa064d65fc445c9ea010ce0765e4e8a50e85eafd725268130b3c546cbb': "在流利度和准确性都很重要时，单独报告可以保留整体排名所掩盖的信息。", // Where both fluency and accuracy matter, separate reporting can preserve inform
  'd469f9e40cca2362bc4c3cafce0b0b42576d24d00bb9680994819964e3ae53b3': "同样，相同的截止日期本身也不能证明对理解推论的有效性。", // Likewise, identical deadlines do not by themselves establish the validity of a
  '5fc757847a32497571b34c1640f5c312082dc26dc707697dc92c2a99774ccc17': "当限时要求明确且与学习目标相关时，支持限时测评的理由最为充分。", // The case for timing is strongest when that requirement is explicit and relevan
  '911d0f3a5da2dd8f54581439ff1e687d1d4b193a812ce20d35237d187de64db2': "当然，取消所有时间限制也会带来新的困难。", // Granted, removing all time constraints would create difficulties of its own.
  '2b649c7524fa08c66d3148992f7ca01e135eab030a558113143daf96b703f719': "这个结果可以辩护，但前提是速度属于评估能力之一。", // That result can be defensible, but only if speed belongs among the abilities b
  '07ff93d81a98170340b5140dee1b5d90722775c48191b75399fe59f7d150f62a': "此外，共同的截止日期为班级提供了可管理的共享活动，防止评估无限期扩展。", // Moreover, a common deadline gives a class a manageable shared activity, preven
  'c2a8bdea70e8f2225ffb239d1af444e2c05a2c6acccfb87322a84187a76e2f9b': "当部分工作未完成时，教师可以在描述证据时区分未尝试的问题和错误答案，而不是把每个缺失的回答都当作同一种空白。", // Where some work remains unfinished, a teacher can distinguish unattempted ques
  '84bec2bd89f4afaff57a98cf2ed0b21aa8e3965645d1a5078a4324c2fbe43b53': "教育价值在于让任务与判断之间的关系变得可见，而不是无论情境如何都赞扬速度或深思熟虑。", // The educational value lies in making the relationship between task and judgeme
  '23e560b5cd3ac4231a6a935e810a11148955125d5f283bd841ac6d3af30a9ee5': "因此，一项简短练习可能揭示一些值得了解的准备程度信息。", // A short exercise may therefore reveal something worth knowing about readiness.
  '883fa50dcb023f62cbb87a87c04f31d43c7ab28cd2cf752f319fbe080b313e69': "这种做法既不保证无限时间，也不会自动让人怀疑快速工作。", // This approach neither promises unlimited time nor makes rapid work automatical
  'd9d2c56f288b7b18bbc5cfe1f2696c30e5d36e2698c4fdc32d97da48558f3921': "教师不能无限期推迟反馈，等待每一次可能的修改，而开放式任务可能需要学校无法提供的监督。", // A teacher cannot indefinitely postpone feedback while waiting for every possib
  '2df72912a6fde080b9ce29a66f594575c3ad2b8224b65905179bee5223e69a9b': "经过仔细考虑后准确解题的学生，得分可能低于在铃声响前完成多个例行题的学生。", // A student who solves a problem accurately after careful consideration may rece
  '85d08c9492a3a39a9b014410639fe2e5fca08ff83371bb1960453a5d2f1cf87d': "这表明，限时条件可能使测评额外偏重某种特征，而把这种特征计入评价必须有合理依据。", // It shows that a timing condition can select for an additional characteristic w
  '10c4e9288596d7898734f8ff3bdc650bb4b4c503dd266f91ac56ead54ddcc962': "如果表面颜色只是推测出来的，却把它当作确定可靠的复原结果来呈现，就会模糊现存证据与解释之间的界限。", // If a surface colour is conjectural, presenting it as a confident restoration w
  'f3b31f726c3f4b83d25207f96c3d4a40e98bcbeccd52f2768827d69d8e0a2c89': "与不能触碰或操作的静止原件相比，模型部件的运动能让人更容易理解织线之间的关系。", // The movement of its parts could make the relationship between threads more int
  '2503d93caae8d8a1ed0c53df63bf8806e244c0053749139a45ba89ab148e25fe': "虽然参与确实有价值，但仅凭新颖性，不足以说明这种取代是合理的。", // While it is true that participation has value, novelty alone cannot justify th
  '1f298d23d79fc73cfe8d3f16f631a60f7df39c98bcca53eabc3d72eca01eb139': "旧陶瓷器皿的表面、材料和修复部分可以保留制造和使用痕迹。", // An old ceramic vessel can preserve traces of manufacture and use in its surfac
  '625de22802c2c629899829c0bb4b3bb4f60932ed5ec06f7408256b8efdb9c086': "其创作者选择了哪些属性要重建，哪些要简化。", // Its maker has selected which properties to reconstruct and which to simplify.
  'fe0df6128f875eeaf279d73c03cf635769c09e952b64b86756520e54dfdba451': "复制则成为审视有理性提案的机会，而非让不完整知识隐藏在看似完成且权威的表面之下的工具。", // A reproduction then becomes an opportunity to examine a reasoned proposal, rat
  'd5d74cd5cb76ad891c299567f7f93dcc859dd860eb3378fcddb9946adf8d34b3': "放大模型使这一原则尤为清晰。", // An enlarged model makes this principle especially clear.
  '4b18d76b94dd88ba18642fd16a6d1c518d42816a406141a9c3ca9943931f9263': "因此，博物馆应在某项明确的讲解收益足以证明所需空间和资源的投入合理时使用复制品，同时保留原件在证据方面的独特地位。", // Museums should therefore use replicas where a specified explanatory gain warra
  'd96e1f99be091f83c335aa51e90a4647585b9f416fdf61846b24185a04fccf0b': "设想一个可以运转的织布机模型，参观者能在指导下操作它。", // Consider a working model of a loom which visitors can operate under guidance.
  '19400fed56eebbb8f1862fedb3854c45532626508e02142be2693eb0ea05fc97': "展品标签应注明复制了哪些内容、复原所依据的证据，以及任何重要的不确定之处。", // They should identify what has been reproduced, the evidence on which the recon
  '3b1158131aba587928a2cb13d9d6a8861a931725b51ddae0aa6299d2a57e479e': "然而，复制品可能会揭示出一个原件在玻璃后保存后难以理解的特征。", // Yet a reproduction may reveal a feature which an original, preserved behind gl
  '544e8873243e8770aec6907a16d522ec9a7f2776c9139604c754119366bf9c67': "展厅空间、维护和解读都需要成本，而精美的模型可以占据本可能展示原始材料的空间。", // Gallery space, maintenance and interpretation all have costs, and an elaborate
  'c54ed8fdbaf6afc86459bb2d3090c16410e7e7b0284480328df3551eabd5365d': "改变后的比例之所以有用，恰恰是因为比例发生了变化。", // The altered scale is useful precisely because it is an alteration.
  'a87daf25477a3682fccadfc7ddaff30e480ad72b70c5802414948c04a515c631': "批评者可能会回应说，有趣的演示可以鼓励观众以直接体验取代细致解读。", // Critics may respond that an entertaining demonstration can encourage visitors 
  '711e58742d149fc7ea41d575166e604a8208f8fe71d92b005475043be2b883b9': "运转顺畅的现代机械装置，可能让过去某项费力的劳动显得毫不费力，尤其是在没有说明材料或工作条件差异的情况下。", // A smooth modern mechanism might make a demanding historical task appear effort
  '48c5be482b3c4476b25749ff807341ea863727f71d40d9a2eeeae0ca5dac92ed': "这些就是经线。", // These are the warp.
  '4533b231e4df3bd71d706b9d2fc4302bf31fb8e3733735e20bc93aae5edb3055': "这种协调包括通过练习获得的隐性知识。", // Such coordination includes tacit knowledge, acquired through practice.
  '52ad1bbaee7fb57b2946c753198830e7ce95e153de3fc4bd5dd63060a2557993': "刺绣的运作方式不同：在已有的布料中插入额外的针脚。", // Embroidery works differently: additional stitches are placed in cloth that alr
  '859b6c76a696e4206604b95ce308dd3018c09eab1a5c7094d4fd7b53480f4356': "如果纬线拉得太紧，边缘可能会向内拉;张力不均匀还可能破坏图案的规律性。", // If the weft is pulled too tightly, the edges may be drawn inwards; uneven tens
  '7d3f949a7c5aa9fe7f6dd19ddf6e20849693b75d78b171b31ab5ccefbeac5933': "在织机上，一组线沿着未来布料的长度保持拉力。", // On a loom, one set of threads is held under tension along the length of the fu
  '78b9e3c55e1c4318e29e415220c9ede04fb7ba63719d6a66a8ecbfde02879d3e': "更复杂的织造排列方式，可以让部分纱线跨过几个交织点后仍显露在外。", // More elaborate configurations allow some threads to remain visible across seve
  'e3b4be07285dcb5cc66d09a7e93fa7af23ca6e6bd1d7f2ed88e691576feae1d3': "这有助于解释为什么保存纺织传统不仅仅是收藏吸引人的样品。", // This helps explain why preserving a textile tradition involves more than stori
  '41a31bde689cd8ebc157389ba9a52d915b6edd7d81c6d99e3e5c648a93569763': "其外观因此取决于线的结构排列，而不仅仅是后续施加的标记。", // Its appearance then depends on the structural arrangement of threads, rather t
  '29799c90431740a31b18efca56b2cb06673f84594e43dce871dc06f0ff840a95': "因此，观察熟练的制作者调整纱线，能让人了解到成品本身不会直接显示的知识。", // Watching experienced practitioners adjust the threads therefore reveals knowle
  '6a44f6aa332aa7148a101913d293965deb6a411fa1ac429c60fc71628263f4ab': "另一根线，纬线，穿过它们。", // Another thread, the weft, travels across them.
  '090860f7aa24585a4070060172815894bc7e74aeec46ef18f74f9e0ee89bd086': "在平纹织法中，纬线交替从单根经线的上方和下方穿过，下一排的上下顺序则相反。", // In a plain weave, it passes alternately over and under individual warp threads
  '973e9bcc7a7a7e8e065903bcd9641edca1f8d318984ecdbdb75ee1b34f65dca0': "即使实现该工艺所需的实际知识不再传承，收藏仍能保留工艺的可见成果。", // A collection can retain the visible result of a craft even when the practical 
  'eadbaafe1686795e8030c5e1445e27b29c1c8165dd5af773512ea2674915b4b2': "结合颜色的变化，这些变化可以产生重复形状，而无需印刷在表面上。", // Together with changes of colour, these variations can produce repeated shapes 
  '1d47aafb12803abac94c2a711d27e418d98bf7771da7cc853e627750642f151f': "区别在于设计的制作方式，而非哪种方法更有价值或更具文化意义。", // The distinction concerns how a design is made, not whether one method is more 
  'a049bace0f5725d00f48d0b3ad5e07fe8c7e69eb9d95a364f2c3cb961a407d88': "地球仪可以模拟地球的整体形状;页面无法在不修改的情况下再现其所有几何和空间关系。", // A globe can model the overall shape of Earth; a page cannot reproduce all its 
  'd72ab602c2264e32a2701a46eb5cf087e81c6df2c217cfe86e0c33c2307663c9': "难度始于在平面片上表示球面。", // The difficulty begins with representing a spherical surface on a flat sheet.
  '69727eb203b8412405a6bf98fbac8edf3233865becf98abb30cf29699b21eeeb': "将二维地图与地球仪进行比较，问题变得可见：熟悉的矩形是世界的一种表示，而非用来评判世界的标准。", // Comparing a two-dimensional map with a globe makes the problem visible: the fa
  'd0e5c733805ee1424c365b907d71750254eb8aba294c78e4f96bd9e2b06a1db2': "障碍在于几何，而不是缺乏细节。", // The obstacle is geometry, not a lack of detail.
  'f44eb8a8fd8d474024d4314ac63b878ddf83df92e1fa0dd5690ecd0a70118c18': "这个类比并不完全贴切，因为地图是通过计算生成的，而不是把曲面实际压平，但它说明了背后的限制。", // The analogy is imperfect, since a map is calculated rather than physically fla
  '4f7b9fadfd0fd419042e23d5a0f21b3603a53b7331d3087e3d771820e1f57388': "如果学生比较不同区域的森林范围，大幅扩大某一区域的投影可能会造成误导性的视觉比较。", // If students compare the extent of forests in different regions, a projection t
  'c8ddeb99cdac7a48a6cf685ff9111186f812fb06f795be655a02f1e2d36056de': "比例关系比熟悉的形状更重要。", // Proportional relationships matter more than familiar shapes for this compariso
  '49f2d9525dba4dfadd8a554b7469eabbca1dd50bdce4e00a4f2cec83665d3044': "相等面积应占据相等的纸张面积：这种等价性在这里至关重要。", // Equal areas should occupy equal amounts of paper: this equivalence is essentia
  '107714ff6e47ea12b51a326ca6830ba731b38ad0b0097e55688359b764a1ce44': "它必须分裂、拉伸或重叠。", // It must split, stretch or overlap.
  'ecb44f80a712e841b4ddfe903f70ae5840e285eb2e07f3fce3f16219bc40ffbc': "每次投影都涉及一定的扭曲。", // Every projection involves some distortion.
  'f3088480db3b9bfb469ce1df5a96d1aa67105bbe2d76f2b6f9cf1bd76da78c42': "想象一下剥橙皮，试图把整片橙皮压平。", // Imagine peeling an orange and trying to press the complete skin flat.
  '2a936c25d2b1b892fad9300d17cf1511af0ea17d0adf467696e9b304772f54d7': "地图投影是一种系统地将曲面位置转移到平面的方法。", // A map projection is a systematic way of transferring positions from a curved s
  '124670b5c9d767c2ada31ec0404ae7021ebb21dc86c12e6e3d7b5de47e673dda': "当地图成为课程中的证据时，这些区别尤为重要。", // These distinctions matter when maps become evidence in a lesson.
  'bcdc8537398fb20b8156ead43bf7a6595d9c537a377cd6aab905dba96aa3548e': "光线首先通过弯曲的前表面——角膜，角膜提供了大部分所需的折射。", // Light first passes through the curved front surface, the cornea, which provide
  '8c828f9a1bd0743493a759b79bfceccf34afae12f27d21381a9b6968edb8862c': "这减少了纤维的拉力，使晶状体因其自身的弹性而变得更圆润。", // This reduces the pull of the fibres, allowing the lens to become rounder throu
  '9f3780bdf023be5e0324065c7b47234f2168f53b8c2f55561ffb6f66163b667a': "晶状体具有弹性，由细纤维（称为韧带）悬挂，这些纤维与一圈肌肉相连。", // The lens is elastic and is suspended by fine fibres, called ligaments, connect
  'cda7e35ef71cad98b017f733bf00f239f7978fcb8622827dc6d3298da2d1a938': "远观时，放松的肌肉使这些纤维相对紧绷，使晶状体更平坦。", // For distant viewing, the relaxed muscle leaves these fibres relatively tight, 
  '80009cfc64ab18016f81e8d4e1ff287bb6a35cc1261d9621b279c1c7b4691a7c': "这一过程称为调节，包含一个看似令人惊讶的关系：肌肉收缩会减少支撑纤维的张力。", // This process, called accommodation, contains a relationship that can seem surp
  '87b2434e244040a6fd7387666b0e699e43516f133382e0e123ece18e3fb3310a': "然而，来自不同距离物体的光无法通过完全相同的光学排列来达到清晰图像。", // Yet light from objects at different distances cannot be brought to a sharp ima
  'e0ebf8cad4be241f9052bd107c089754229d69e94012bf72d6a1e778a332fc13': "一个距离的清晰度并不要求同时在其他距离的清晰度也同样清晰。", // Clarity at one distance does not require equal clarity at every other distance
  'f03967880a556b702b6d0863f1ec2de69f453da177552257327f1d56f0fcbc07': "位于角膜后方的晶状体会进一步调节，使光线在视网膜上形成清晰的像，视网膜是眼球后部的感光层。", // The lens behind it makes further adjustments so that light forms a focused ima
  'ada0a5b6ddb835d9a6e708a7e77f0bf747c22f978d1d4ce7d32cff0f2d69c486': "这种区分很重要，因为把调焦简单描述成肌肉使晶状体变厚，会遗漏促成这一变化的间接机制。", // The distinction matters because describing focusing simply as a muscle making 
  '81f24107c8882c3f835419b43a415d9c976a1c7294566c7cdcdc53b8e4c0c06c': "阅读时，人们可能会发现远处背景显得模糊不清。", // While reading, a person may find that the distant background looks indistinct.
  'e86702d90c9d1ea56be3f446565194eb5db9d36c7829eb972970bdbd796f5dad': "瞳孔，即晶状体前方的开口，在明亮条件下可以变小，但调整开口和改变晶状体曲率是不同的操作。", // The pupil, the opening in front of the lens, can become smaller in bright cond
  '047e6caea7b8953acaf5b43fe4846840650d85cd81d2ad651d4127174d67baa1': "眼前的景象可能很快就变得清晰，以至于人们没有察觉到调节过程。", // The scene may become clear so quickly that the adjustment passes unnoticed.
  '1e69d87c50a57a6017d08cb57dbf06ccac850491ceaada825fc1654b690d9930': "在典型健康年轻的眼睛中，聚焦涉及改变眼睛内部透明结构的形状。", // In a typical healthy young eye, focusing involves changing the shape of a tran
  '0669fcc1ebbf78e35fa6bee997178a003ac45530a86ae208e870174b4fac456e': "一种指标描述了反复参与;另一种衡量的是接触的广度。", // One measure describes repeated involvement; another describes the breadth of c
  'f5746c203dba8823043edc02179827a718cf7d017dda777ff2ab5e26a2a2d4fb': "因此，透明报告可以同时显示累计访问量和不同参与者，说明时间范围。", // A transparent report could therefore show both cumulative visits and distinct 
  'f40c50063a798b60fdaa33b53b7943f0c1238928fe09367c42df7273ba307c85': "再次参加活动的人可以共同推进一个项目，不过，仅凭参与者留存率，并不能提供他们喜欢每次活动的定性证据。", // Returning participants can develop a shared project, although retention alone 
  'ee8f5446ddc3abef7ed4a02f877fa5959d9c2f8b71700cc24ea5d1ca224e3c9e': "社区中心可能把总出席人次作为参与情况的证据。", // A community centre may report aggregate attendance as evidence of participatio
  'a0b9b63d621983d8b8bf4c9d332708405dc4b1d443304f68a9637949364dc743': "这种一致性使得可比性成为可能。", // Such consistency enables comparability.
  '3240517b6ce9981acf705140e3aa529ee03a296189b4558776d5f6e949e0e0f7': "第一个项目为持续合作提供连续性。", // The first programme provides continuity for sustained collaboration.
  '637c06d9bc815d7e9405ab625fe53f34a633142ef511420f957bf35b8b00723d': "算术可以是正确的，而统计解释仍然不确定。", // The arithmetic can be correct while the statistical interpretation remains unc
  '25b30bbc78fe264443de92b0c1aedec23294b100a267edae22b93edd33ea4ecf': "如果不区分重复出席与不同个人的出席，同一个总数可以描述与社区的不同关系。", // Without distinguishing repeated attendance from attendance by distinct individ
  '5bd6ba8e6cfd519841f51d95416e449b2ec96d8057fe01922aee1c2ab3792b46': "这些是不同的标准，不是可以互换的成就。", // These are distinct criteria, not interchangeable achievements.
  'fe8b9a1e8f15bb190493f6730c55f50bbdfcea4530a4bf4757e0a92740aa9208': "这一区分决定了哪种标准是相关的。", // This distinction determines which criterion is relevant.
  '1a2d80390f3f073e8a5a38d6efc579b5f5fc2478ededdb56ec2221744dbad522': "这种数字上的相同掩盖了不同的参与模式。", // This numerical equivalence conceals different patterns of engagement.
  '66829ec5196f4e8a819dec897c27f89fdd0f20ece2716e0be34dac37e25d289f': "设想两个项目，每个项目都安排三次活动。", // Consider two hypothetical programmes, each offering three sessions.
  '790a6f227ac653259879b01a0c818746a4f62747533cc2a84f2d6c1048f3a38b': "两个项目的总出席人次相同，但第一个项目覆盖了十名不同的参与者，第二个则覆盖了三十名。", // The totals are identical, but the first programme has reached ten individuals 
  '01b43f5417a4ccbb6204e598742a69c281543b82806c4f8b98fa8af8a1bc1c1e': "这部分需要耐心。", // This part needed patience.
  'e4846e9f1ad8bd7ea6ea34a94cdd23818fed9db808c8604e3e93e5f78ecce160': "导游在凸起的表面上涂墨，然后用纸张压在上面。", // The guide put ink on the raised surfaces and pressed paper against them.
  '687dc90e8c319c1d90d1a9b74f4ea4a1f32cd455585f1a99986e703d946e986a': "空出来的排字框已经可以用来排印新内容，并不意味着之前白费了力气：正是拆散这一页的排版，才让新一页能够开始。", // The empty frame was ready for something new, rather than a sign of wasted effo
  '2cb129bf61ca29166d0aa5ab0d6807990def4722bd81e0b0eef376e0d9d21ad5': "当她掀开它时，我们的信息就出现了。", // When she lifted it, our message appeared.
  'bbcba82afc09fd941c643067cf48e24d0ffed3e705ba843ab16e3b25c12cf62c': "在电脑出现之前，人们可以排列这样的字母字块，印出供人们在家阅读的一页文字。", // Before computers, letters like these could be arranged to print a page that pe
  '2c3298cddcf1d9603e537e72cfc1c4dc1342003839253eabf1b58fd95f3c7494': "制作另一份副本无需新安排。", // Making another copy required no new arrangement.
  'ff644c73cb6e658960e7482be54cf5e6b9651fef8d54a9853804e300032974e0': "然后导游开始拆除方块。", // Then the guide started removing the blocks.
  'e61e4f5c567ea7e34b8222d40c789312982e63d416066efbc400f2e37cfe2962': "它们似乎值得保留下来，作为我们付出努力的记录。", // They seemed worth keeping as a record of our effort.
  '50892393a8ed5a7a875d441c6bf333a9771185adb14594026ad47414eb591b31': "她补充说，对于过去的印刷工来说，这种重复利用字母的能力非常重要。", // For printers in the past, she added, this ability to reuse letters mattered.
  '209e97b90b44e7b28489db3f3d40ff19d083844c3c74ac628146e674be7ae08f': "在一家印刷博物馆里，我们班拿到了一些小木块，每个木块上都有一个凸起的字母。", // At a printing museum, our class was given small wooden blocks, each carrying a
  '48410a83d4832dedf76ee0dd99729d24ce433db92085fc07ab998676baf526e8': "我们的句子渐渐从框中消失，尽管旁边的纸张依然承载着我们所有的话语。", // Our sentence gradually disappeared from the frame, although the paper beside i
  '2c01f824a2dcd52afb76661d8ac430d6c703916077418a4585e9966b62b6286f': "我们一起把积木放进一个框架里，做了一个简短的信息。", // Together, we placed the blocks in a frame to make a short message.
  '6daf40bbf46f533c2c949e571abd39f0c1cf6963fed012c9597c5ddfabf4018e': "我们自豪地向她展示了各种不同的工作，期待她称赞我们整个下午都避免做同一件事。", // We proudly showed her the variety of jobs, expecting her to praise the way we 
  'c20d5ccb826915430d0a5099876caa8e18b8b1c7e05cbcdd86f645f87b1a27b2': "我的搭档礼貌地拒绝了，因为那样会把休息变成另一项工作。", // My partner refused politely: that would turn the pause into another job.
  '97161be1625ab09cc880e5997cf580d767e32dfd7110a4433fdb5cb12914e489': "老师让我们检查计划。", // Our teacher asked us to examine the plan.
  'a7f7997fe2685dbf832cd4ec18ec0077497151816f52cadbe3cd4ce870ae51e7': "在这些休息时间里，我们可以离开桌子，在房间里走动，不必匆匆忙忙。", // During these, we could leave the table and walk around the room without rushin
  '5b7ce5b9bfd768d55ee10a43fad6f4a1c87be36e3a3620dcf7644ae6b86b8d41': "画完道路后，我们剪出屋顶部件，再把墙面连接起来。", // After drawing roads, we cut roofs and then joined walls.
  'f74bf6bd9ff79c69fd485fbafede7d61477d7f57dbddc540f63645c804d217c9': "老师并没有承诺，短暂休息会让我们的模型小镇做得更好，或帮助我们更快完成制作。", // Our teacher did not promise that breaks would make the town better or help us 
  '45158abdda4fc8a9d1970504c702107f7d8cd6a1e7876e1c8e9c0ddd7ecb18d7': "我们想在学校展览会前完成，所以计划把每一分钟都安排在一份有用的工作上。", // We wanted to finish before the school exhibition, so our plan filled every min
  'd393f5b3c89581d81e753d8a97f6a8a55ef8c6fecad181f25e404847e9719789': "换了手的动作几乎没改变我们的坐姿。", // Changing what our hands were doing had hardly changed how we sat.
  '2de64e07035350fdfda435d57ce1ebfee68104ff9fb72a0fb01f5b31a98877ea': "我们一起在各制作阶段之间安排短暂休息，无论一栋模型建筑是否完工。", // Together, we added short breaks between stages, whether a building was complet
  '4ceea85ebd0b287e7cdfc0a4f82aaafd7a01ee9724722dda50d16dc52df2a0f7': "它们的目的是让我们在坐着的下午有机会活动。", // Their purpose was to give us chances to move during a seated afternoon.
  '580527dbd4874d819f4c6b2c7e6d0c67f1c11f3436fcb691fe76ae56ebb3c949': "然而，每栋建筑的施工时间都比预期更长，而且总有一面墙看起来快要准备好了。", // However, each building took longer than expected, and there was always one mor
  'a443c5dc7dd64ad9b3ed2e6bff450f79338a5bcc290773235eabbe3ba844a7e9': "我们在完成一栋建筑后给自己留了个休息时间。", // We had allowed ourselves a break after finishing a building.
  '3bb85693d25b1f688b520e18459282fc7ddb28d48f79076378c85764be7d8ae3': "为了让差异更明显，我们复制了原版海报文件，创建了另一个海报文件。", // To make the difference visible, we created another poster file by copying the 
  '848696de385f74808711e93c78acfbd88b042da24f1ab9f37d18b7bc62cfd328': "我选择了创建快捷方式的命令，并将新图标重命名为“First Version”。", // I chose the command to create a shortcut and renamed the new icon "First Versi
  'c0f6be6c709dd11f656e1239e9dea0bd8160d9956d3d7d373e0b3e15a75f0e75': "快捷方式只是指向该文件的链接;给链接换个名字并没有产生独立内容。", // The shortcut was only a link to that file; giving the link a different name ha
  'babcedc0aef12763f7a7ccb444440fc94fba8749cfe0f06ed684f99c5a7b13db': "两者都指向我们俱乐部文件夹中的同一个文件。", // Both led to the same file in our club folder.
  'af9f52ccbfda004311e37234b632b995617292c7f691b57718e07956cc73a8c7': "我以为电脑已经自动复制了我的更改。", // I thought the computer had copied my changes automatically.
  '40c950d93b903a336200644b64de0dfe24b336dbae8ed5aa72ec237f1c1e5b2d': "我满怀信心地打开新建的快捷方式，修改标题并保存了作品。", // Feeling confident, I opened the new one, changed the heading and saved my work
  '8eb1f37e2c6882b93d6e46fc6c189857ea52f4c6a98b19479718ec6eee1b998c': "数图标似乎已经够了;现在我想要证据证明更改一个文件会让另一个不动。", // Counting icons had seemed enough; now I wanted evidence that changing one file
  '5b95e508bb9e1d4b11c0bea7c647172c3816edeba71a547a7191729ff97538be': "屏幕上现在出现了两个图标。", // There were now two icons on the screen.
  '42e3eee897e442ccdc7a8f1f93af6d66cb1f2d4e07309cdd4bc7ff0dab0c1488': "它有助于快速获取海报，但在编辑同一张海报时，无法保存早期版本。", // It was useful for reaching the poster quickly, but it could not keep an earlie
  '36a274e23573d6734ca3654adf3342e00689df7b9bb9b1b017565216491cce45': "后来，我的搭档提出把旧标题与新标题作比较。", // Later, my partner asked to compare the old heading with the new one.
  '752c8232a3ad713062a09b07b581caba10efc5085fee6a23f64ad45d4a1471de': "照片和会面细节保持不变。", // The picture and the meeting details stayed the same.
  '45120dac56c6089cd82471de768d2675c675d4c05957adde61dec54c2436b800': "老师建议先看看每个图标打开了什么，再去猜测发生了什么。", // Our teacher suggested checking what each icon opened before making any more gu
  '937d13699597f90dc48941e04000ac5640c8842ee432ed59c0bf0a61a900430b': "问题中出现的数字并不自动成为答案的可靠线索。", // A number placed in a question is not automatically a reliable clue to the answ
  '24c1f6454f2428b169992cffbf15494c94edd580ebda8b356574a37a04f23785': "老师解释说，早一点的数字即使没有提供有用的证据，也能影响后续的判断。", // Our teacher explained that an earlier number can influence a later judgement, 
  '0e63792bc1ccb9a14a63df25c3c910866d754ab28163979a91be741c5afa8bee': "老师要求我们只透过玻璃观察，估算罐子里有多少颗珠子。", // We were asked to estimate how many were inside just by looking through the gla
  'd0ed9d2960a339bf18a24b5d54ed2fd8a995ac39842661132c7e7e06406717cf': "虽然不正确，但我不想失去一个有用的问题：为什么那个特定的数字对我来说合理？", // It was not correct, but I did not want to lose a useful question: why had that
  '2eff86ae7f3829963838810dde3066788dbfd4f1db3220b7479c4aabfbd49125': "老师对结论很谨慎。", // The teacher was careful about the conclusion.
  '37a76accc6f6db589f45ca0ff1c1be2c8befba0a62f29480df11e2fbc14de53f': "其内容在各组之间没有变化。", // Its contents had not changed between groups.
  'f074fa8aae378ed1559b0606f82ea977dc911be21f96acedc5748cfa06eb3558': "我注意到二十看起来太低了，所以当我选了一个高于它的数字时，我以为自己很独立。", // I had noticed that twenty looked too low, so I thought I was being independent
  'c8fe76fe584a091d968873b9ba77762e0d5a159dad0ba0a058642c0d7e2ec698': "比较估计结果时，先得到“八十”这个参照数字的小组，总体上选了更大的数字。", // When the estimates were compared, the group given eighty generally chose large
  '6193611e19eefa7092929406b10b949c20b15960badc308e17f61e732c37ba47': "这个小活动无法证明每个人都受到了影响，或者某个特定答案是由第一个问题引起的。", // This small activity could not prove that every person was influenced, or that 
  '5da66e03e39792704f49b0452a5d99f4ebcb96491fefc7258119c2aab0a2d197': "我把第一次的估计记录放在解释旁边。", // I put my first estimate beside the explanation.
  '129c5593032907599f454256c6cb357e5a404c731aef2036420062d3aa8c2604': "现在我在想，那个第一个数字是否仍然影响了我的答案。", // Now I wondered if that first figure had still shaped my answer.
  '6685cbecce9fd7d6cd8bd6df260b8c65f54056c074b384dc7e86b45d00fe8f6e': "她让我们先考虑起始号码的来源，再决定是否信任它。", // She asked us to consider where a starting number comes from before trusting it
  '5b8711b235f00bb3c5d1db81c6342084e06243264f9ebeb3e62e40476b4416f1': "我把它删掉，说我刚才分心了。", // I removed it and said I had been distracted.
  'fa73fcf8cc3d032e41d37b46fe22a9ccd3f7e1e82b75c09f83da7816af18aa53': "分歧是关于相互竞争的需求，而非任何人是否愿意合作。", // The disagreement concerned competing requirements, not anyone's willingness to
  '348e6e68c12bea5f3154591a5154ce4c284d6a70c491ade2a02c285ec8580ca1': "说出来让原本的错误听起来远不如隐藏它的努力重要。", // Saying that aloud made the original mistake sound much less important than the
  '8df3cef3d27c17180aebe15ecde4c1d3c35bd8d95649635d1431106c86b38b65': "在宣布我选了最好的办公桌后，我不太愿意解释为什么在那里工作变得不舒服。", // Having announced that I had chosen the best desk, I was reluctant to explain w
  'b7eb924bc57640cae9efa68c4eb291ad7b844791583628b251c66bc5517bcced': "我靠在椅背上微笑：无论是文字还是椅子，都不需要不断调整。", // I leaned back and smiled: neither the words nor my chair needed constant adjus
  'ae94723e1de7f03a1cf1408a31464e106df3be00f9323379c960fe867ea90dac': "玻璃之外，树木环绕着一片蓝天;屋内，其他办公桌都面向一面普通的墙。", // Beyond the glass, trees framed a patch of blue sky; inside, the other desks fa
  '7b5cd7f86c4b1100280c41cdb9e02748dfe7b4a2535dd76103899788c616fe3f': "接着，我的朋友朝天花板方向举起她的画，想借助足够的光线比较两种深浅不同的绿色。", // Then my friend held her drawing towards the ceiling, searching for enough ligh
  '24460d95bc17a45a6a114fcf61285a4ef61cbc442c90e1a543c453d00c854112': "这一次，承认答案取决于具体情况，比立刻给出推荐更有用。", // For once, admitting that an answer depended on the circumstances felt more use
  'a6c98cb2207ef3a013bc1aea6f70eb8c520a99baaa3d025874b256936260ad1c': "没有购买任何新东西。", // Nothing new had been purchased.
  '6433f125ba64b31f0984a6f7e08fa0600b0dc72ef212313751c769e21521312a': "我不耐烦地叹了口气，放下了手。", // With an impatient sigh, I lowered my hands.
  '357705fa2a64a517f6d92db2d849a075e076706a44d1b5470ed13fd2f1f1d283': "我伸手去拿台灯，但灯的线缆无法接到她的书桌。", // I reached for the lamp, but its cable would not reach her desk.
  '5f23d4664869dbb500b446be40b1c769d3d257d708f16871af6c2ed81b8935cb': "房间的适用性只能通过实际使用来评估。", // The room's suitability could only be assessed through actual use.
  '812346f09ce9f54afb6419688d8ab39f831b5bdfb536702680a191b2f9cf33c5': "我现在可以舒适地坐着阅读，而不必不断寻找角度。", // I could now sit comfortably and read without continually searching for an angl
  '32746a7f6180c0461577ad70ba86a995f935645b6155dfead2e7af9eb3fe7dcf': "她的纸张光线减少了，而窗户从新位置依然能在我的屏幕上看到。", // Her paper received less light, while the window remained visible in my screen 
  '52eea4dd50cf557d5e8d84f0d7fa4ef558d5b8df6912443193ceca9fc559bba2': "我们一起试了椅子，先确认位置后再做出任何承诺。", // We tried a chair together, checking the position before making any commitment.
  '867d910b9ec01b10668d37625901e09d68e5df8bf3d100a996c566e7b3ffa3a0': "小块状物消失在它的喙中;一颗浅色的种子逐渐冒出。", // Small pieces disappeared into its beak; a pale seed gradually emerged.
  '34f365e34265407ceae9abec782373a3c9e8d2a83f57ce2062b6ec6cbae9091e': "一侧是铺路石，另一侧是树篱。", // Beneath it were paving stones on one side and a hedge on the other.
  '4d784de84a44359db78669ce6d8d18a2a389dbd299addf58d8ffd66a810e1846': "鸟的进食需求与种子的传播需求部分一致，但鸟吃了一顿，并不一定就能把种子送到合适的地方。", // Their interests overlapped, but a meal did not automatically provide the seed 
  'd3832282a0ff37d0fb0ca532b135c81938b53c522bc88d2cd96150992688901a': "我选了一株靠近篱笆的灌木，小路上方挂着红色浆果。", // I chose a shrub beside a fence, where red berries hung above the path.
  'b9b6846f5fe8d6d7825d54d89c9fcaf3a82ce7d73120b78a6b788a8871276416': "这时，一位园丁拿着扫帚走了过来。", // Then a gardener approached with a broom.
  '60f497900493178c0ea0af80e695a5f53d49f4c21f89b92459dcbcd97fbb3f1c': "这种区分将区分独立观察与蓄意干预。", // That distinction would separate independent observation from deliberate interv
  'f3537f9c409a06b382ee15e21b47d648eefdf4e753595b4c52a890c4acf0bf13': "他继续清理小路，我们则把椅子归还，未去扰动树篱下的植被。", // He resumed clearing the path while we returned our chairs, leaving the vegetat
  'ae14c5589e91feb56f5343c31b4a8da112ea3c5ece85af4fa9ebe99d1cb25dc3': "我紧握笔记本，担心有人近距离工作时鸟儿会躲开。", // I gripped my notebook, worried that birds would stay away while somebody worke
  '8e8c0ebd3d41dbbbcd625701090505ee24acf3efde98eb13a9d899a5a4d67450': "它破开的外皮露出了柔软的果肉，果肉包着一颗坚硬的种子。", // Its torn outer skin exposed soft flesh around a single hard seed.
  'fadc00627f4f0bfbf4c7cecb384c9b451b13dc51c78e130a2ce615b34bad7f28': "当鸟儿消失在树叶间时，我放下相机叹了口气。", // When the bird disappeared among the leaves, I lowered my camera and sighed.
  '562ecf66cfb00d24ec18f1f74a21540327cae960e1f14eba4382afc7a291a18b': "在我们的观察记录中，我们区分了实际看到的种子移动与种子成功定植的可能性。", // In our account, we distinguished observed movement from the prospect of succes
  '605d8501c798a157c2e5beac78f7dc0d6a78b9cca92efd6412c2c20ace0aadfc': "它们的生态关系可能影响植物的分布，尽管仅靠成功扩散并不保证发芽。", // Their ecological relationship could influence the distribution of plants, alth
  'ebf21fa8d1518c49041b2dcfef3d23e5da73a38a3ab558dc56937397e8bb14f9': "到达新地点只是一个阶段;生存仍取决于适合发芽的条件。", // Reaching a new location was only one stage; survival remained contingent on co
  '49f644a3f4a28929c27c2ff8cf9f54380883583345ea31a84ff9e7a8f1799073': "我们把椅子往后挪，让他能继续在别处工作。", // We moved our chairs back so that he could continue working elsewhere.
  'dd48c734bb5fa58f7fde54a7dcacea2490aba6f51bdf0552999f880c4f02449c': "外面，店主们推着有盖的手推车等待。", // Outside, shopkeepers waited with covered carts.
  'ae135202eaa02768e6adac82d6de8a2c74d83a98e19740178261b244b25f5ffc': "里面没有制造新的冰;所有可用的冰块都已经储存好。", // Nothing inside was manufacturing new ice; everything available had already bee
  'b9ae3a647241709745c9bd8829300c867c9094e341bc9c9e669d49d331dba3eb': "水从冰堆下方流走。", // Water drained away beneath the stack.
  '9193fe0f40dcd6bc21640f31f3baa2dd1587a43970c91f5eca07d5f07ca9a309': "她说话时，我能听见融水流动的声音，它轻轻提醒着我：即使无人下单，冰的库存也在变化。", // I could hear it running while she spoke, a quiet reminder that the stock was c
  'd6f71ce7bbb39b18fdddefd5be89bbcaa926bdf4f790d1b3b703a893b5de5603': "冰库管理员抬起沉重的门，凉气扑到我脸上。", // The keeper lifted the heavy door, and cool air reached my face.
  'd6c6850069898871ea98259d12fd8fd269897edf0f0446658faaad9780e8fb6f': "我放下笔记本，伸展手指，庆幸没人等我忘记写的那个重量。", // I put down the notebook and stretched my fingers, relieved that nobody remaine
  '7dff7c6f1e0176ac215ccab3077f8e02aafb8464692b6fe5114d51ce91a54f6c': "墙壁和填充材料可以延缓融化，却不能彻底阻止它。", // They could delay melting, not abolish it.
  '223191d284bdfe7a7c2a22874f54144bef536b44ddf9cb0cfbe607bdfcc5ffc2': "面包师把他的布套放回推车上，帮忙清理门口附近的一个空位。", // The baker returned his covering to the cart and helped clear a space near the 
  '0b504d20101aafab42959bc155fd1bf038de2eb6cc67c55030202668466afa87': "第二次称得的重量更小。", // The second weight was lower.
  'bbbcd69f5ae6ef0197b6d16219b76e36632d33bd259eee84d51067b05d5da311': "我看了看秤，又看了看先前的记录，拿不准该保留哪个数字。", // I looked from the scales to my earlier entry, unsure which figure to keep.
  '17ed2a37621f886f61ff8e190c60b229be8fcbcc22d5ca3b3c938b7772bf6997': "这里电冰箱仍然不普及，夏季贸易依赖工人几个月前收集并储存的冰块。", // Electric refrigerators were still uncommon here, so the summer trade depended 
  '7df484ad9465ccc767a3fbb873adf7e045da428961c772456bbe3d9d4f1d9e5c': "冬天，工人们采集了当时供应充足的东西；夏天，他们量出剩下的。", // During winter, the workers had gathered something plentiful; in summer, they m
  'd1021f3f27c0d477e732d66b6e531135205979098c8ff4185d6d58f908ccb07d': "我还能听到店里轻微的水声。", // I could still hear the store's quiet trickle.
  '8b9f47f53c80e3497d92635a7205000794f3f1528597eb664f61de1559820281': "回到家，我冲洗手上的灰尘，看着水消失。", // At home, I rinsed the dust from my hands and watched the water disappear.
  'dcdd8f236585bef7302193f265eb8f624455bc5858fc26d0a9201674a2e1de79': "冰块紧密堆放在锯末下面，只有在需要取冰的地方，才会把锯末扫开。", // Blocks lay packed together beneath sawdust, which was brushed aside only where
  'a0a386f7d88fedcf2ad4681965a38879be9eb670835a112d65578fc2b5eff79e': "听着他们的请求，我开始注意到这家店提供的服务价值取决于门外发生的事情。", // Listening to their requests, I began to notice that the store supplied a servi
  '4e07ddd9f5542b1f216742c952ea9e39db55ad8b7d38543d08423596b39a1a02': "我的任务是在每块冰被取走时记录它的重量。", // My task was to record the weight of each block as it left.
  '5faa07e77943cd5b3d88508721d8a95858df659b781b5aba7e24018df5830f19': "诚然，询问偏好需要时间，匿名例子在没人知道讨论的是谁的工作时会失去一些信息。", // Granted, asking about preferences takes time, and anonymous examples lose some
  '5f7eed18390d4f2a658d254d39b265b344b2fe2459e372f75f77f75fffcf4498': "一位同学曾要求以书面形式获得反馈，因为当众受到注视和评议，使这位同学难以专注于反馈的具体内容。", // A classmate once asked for feedback in writing because public scrutiny made it
  '4aafd6a39656ef8a5bf04f56111834caddb131d9821a173cf163418da5501c13': "我紧握铅笔，担心自己画出的东西会很普通。", // I gripped my pencil, anxious about producing anything ordinary.
  '5dce78d8d4aec4fbf49bc3d56f7c2737ff786d7317adfc7f143ed45911c42102': "当老师展示我那幅标注清楚的示意图时，我看到了公开表扬的这种作用。", // I saw this when our teacher displayed my diagram with its clear labels.
  '64e7f645c0e9ed7e33dcc83e26429d6d1086b618e6e76d49b09d566150513a17': "即使赞美背后的意图是慷慨的，同意和敏感度依然重要。", // Consent and sensitivity matter even when the intention behind the praise is ge
  '1cfa995d886e33b56961bab7ccf8a24ebf771a4098caec73eb74f144b7ff1273': "当认可意味着维护声誉的义务时，它可能成为负担。", // Recognition can become a burden when it implies an obligation to preserve a re
  'ecf996707d5f377ddc05552562042f3ebcdf7fdc7eed5badc20e6a222b6744d9': "当公开表扬准确指出实际贡献，并尊重被表扬者的偏好时，这种表扬就是合理的。", // Public praise is justified when it identifies a contribution accurately and re
  '6e7a8906fe76a1d5e8af9d962bebfebfbf783b2386386cc417c16f28415a4f24': "对一页成功作品的赞美，已经成了对永恒卓越期望的期待。", // A compliment about one successful page had become an expectation of perpetual 
  'c132d2b06cb02fdcbdcbc46779e1a54ad9ce3202113f5890a19b054a97b1632f': "因此，公开认可不仅能教会标准，也能奖励达到标准的人。", // Public recognition can therefore teach a standard as well as reward the person
  '6a2f5cf1002fb5747fcc0cba1228952119ef78985314d4b424b7f4e6155d0b28': "重要的是她识别出的具体特征。", // What mattered was the specific feature she identified.
  '21f0eb9694e52baa68d1f767af5937f9f4ea66ebcfade2174a20bf85b5c51a18': "但受邀讨论某个具体决定，与被要求一直按某种固定身份来表现，是两回事。", // But being invited to discuss a particular decision differs from being required
  'bde43b2efc85a04a9f20ca9c141518178daea7cbb84c886ff2cbf2f11c7fe837': "他们应区分分享一个有用的例子，与将其创作者塑造成所谓完美无瑕的人。", // They should distinguish sharing a useful example from turning its maker into a
  '0a432a18fab995d2d02a457d0b8c05333fca400a019ee56c2cd2e11c441356a0': "学生们可能合理地希望自己的贡献被认可。", // Students may reasonably want their contribution acknowledged.
  'a7b420056283866054965a7ba9903973047f76162fdbf05051317cd7b3179ec3': "一位老师解释学生如何检查一个难题，给班级提供了有用的模仿对象。", // A teacher who explains how a student checked a difficult calculation gives the
  'a07f640805293b11c2502a97ed67e51ae28337dbe192f0dc4917ad5e71d60c40': "细致入微的判断必须兼顾方法和意图。", // A nuanced judgement must consider both method and intention.
  'eaf35ece7c0207a49827cc9c645d17785ba99241e28ee0b2d164137fac56a9a9': "这是保持自主权的理由，先请求，并使拒绝成为可能，但不应视为未能欣赏这份赞美。", // It is a reason to preserve autonomy by asking first, and to make a refusal pos
  'a1e3f5ed5791309da08a35383839e2bfa84fe5066777fd1f9c7c7b714de17d77': "我研究了他们的首次尝试，好奇他们会如何调整间距。", // I studied their first attempts, curious about how they would adapt the spacing
  '166b7ca2b833ba1e3818a087ee849edbc21a055996e5586c3bb5c8c30b0888d5': "然而，最强烈的反对意见是赞美将行为转化为身份时会发生什么。", // The strongest objection, however, concerns what happens when praise turns an a
  'ca0f38bca50a414d86b7d01e9f671dfe65779fada7384c5939b567103bcc3a46': "景观拒绝配合我整齐排列的线条和标签。", // The landscape refused to cooperate with my neat arrangement of lines and label
  '64905269752921ef923e5bc98bfefd798c4ea77b05f6449d8cbb08fdbbd5f336': "我保留了最后的轮廓，开始第二幅画，把石头放在相同的位置。", // I kept my last outline and began a second drawing, placing the rocks in identi
  '0abca3fa63ae8741c7d5a274ae21c55965aec47be65f5b7dbc54f5e208bded93': "它连接着岛屿和海滩，没有人搬运一粒沙子。", // It joined the island to the beach without anyone carrying over a single grain 
  'ab01927d849d5974fd8904c39368fdf3aca5a5d64fab30ccf17a2e3ae95358f9': "第三次尝试后，我把橡皮擦用力按在纸上，猛地合上笔记本。", // After the third attempt, I pressed the eraser into the page and closed my note
  '7f36c78ed976fb36a2a7c88debc4366b2598b258c283bc806e319e988bd59248': "我以附近树的一个树杈为参照来核对观察视角，意识到是水在退去，而不是沙地在向我们移动。", // Using a fork in a nearby tree to check my view, I realised that the water was 
  '9d77e8b448c08e7fcce01ad3825970cae5d657374a2345ad0453f1c060559b23': "它的孤立是暂时的;我的理解取决于水的高度。", // Its isolation had been temporary; my interpretation depended on the height of 
  '52fd8b7cd129e5e9314387578f11ce34b8385144ca30549fce070439082f3eb7': "我快速翻阅着书页，张开嘴巴盯着那片未曾中断的沙滩。", // I turned rapidly between my pages, then stared with my mouth open at the unbro
  'c0276d7efbab19e3b38ef605f17836c14950516f7d0c554f965460bd587b2d22': "我读的时候并没有把这些信息和我刚在纸上划下的永久界限联系起来。", // I read it without connecting that information to the permanent boundary I had 
  'bb055f79fdcb2d999ade8d9a8abaf0e50085afd6336da80098796c9056e567d8': "午餐放在我身边，包装还没有打开。", // Lunch remained unopened beside me.
  'fd2a5a178204c83199821b276b83e90ed131d8d74afc82df43166990cffce6a1': "在我们自然俱乐部的海岸徒步中，我自愿从木制步道上绘制风景。", // On our nature club's coastal walk, I volunteered to draw the view from the woo
  'f0a303037bbbf9557b224dad4a2bea346d394cf8509fdd6951056059a9a4502f': "其他人从包里取出午餐时，我举起笔记本，让大家欣赏画中精确的轮廓。", // While the others unpacked their lunches, I held up my notebook so that everyon
  'ac394fc2aa4f38be71f5236304d6a83aeccda5c52787404576c88b5aa9785dad': "这些固定参照点让比较成为可能，而我先前反复修改反倒妨碍了比较。", // These fixed points allowed a comparison which my repeated corrections had prev
  '53c94ace937053a60ef8c8a16463bf88f4a47a78de2edbffce670e2e7cd9ee17': "后来的人可能在水再次包围沙地时到达，并觉得我最后一幅画同样令人费解。", // The next person might arrive when water surrounded the sand again and find my 
  '96bd367d06dc39c79f6c0c659a7e758c56c6a1a6acdd210aed16b42817a3639c': "我们的任务是整个上午观察海滩，但我的贡献看起来已经完成了。", // Our task was to observe the beach throughout the morning, but my contribution 
  '822417bfa18b914daabd9113a3487bbce44de595cafb65d129ab8a4b4c9d4041': "我的岛屿出现了一个条件：它依赖于海洋。", // My island had acquired a condition: it depended on the sea.
  'ff2e6bc0f2fb8b9f282bead6e03d9c28334efc481f9abc77d1d0d5ea791e4a0f': "然而岩石的位置并未改变。", // Yet the rocks had not changed position.
  '320f33d2c830bba07dc94350d87f134f8c801bbaebc8dfad3ad97ba7a86cc247': "水果篮适合咖啡馆的帮手们;小剧场给孩子们安排角色表演。", // The fruit basket suited the cafe helpers; the little theatre gave the children
  'ab7153b62a192864e03377a178d2052269523ee12fbd24cd2a2a65ca244f8a73': "我以为这意味着要找出最准确的讲述版本，并去掉不必要的重复。", // I assumed that this meant identifying the most accurate one and removing unnec
  '306c49091a376126e53862d694825c9df8791b294d1d45000c9f9362213be665': "她的听众们，园丁们在整理户外植物后休息，随着她描述下午的炎热，挥舞着节目单。", // Her listeners, gardeners resting after arranging the outdoor plants, waved the
  '8d13bd5bb37f14d6f14ca62183fa1f4d3e19cbcff71a79a8306363ca0e41b74b': "这些都是针对特定听众的刻意调整，而不是因为没记住同一个认可的固定版本而出的差错。", // These were deliberate adaptations to particular listeners, rather than failure
  '9fdbfb7cec4bf79b81dcac8639e540d1e5f147eb7298457b3f9da31ea9f862de': "再次聆听时，我注意到了一些联系，而先前一味寻找错误让我忽略了它们。", // Listening again, I noticed connections which my search for errors had conceale
  '0aedc66cabcf964ea0d7efa6718183615b9a97ab31e1e0f283f223ac3235a6e7': "我问提交三段录音是否能完成我的作业。", // I asked whether submitting three recordings would fulfil my assignment.
  '7dce6d4efa6572e90473ce9405d8682d508c249bfcca906c05e10e60d5a670fc': "始终如一的是，旅行者总能为这个笨拙的物品找到另一种用途。", // What stayed constant was the traveller finding another use for an awkward obje
  '1a6a92a82a2967ec5db6fab5332d2c3a5a5fa76d46a4d005963a52d8dbe4db75': "旅行者、纸张和那顶超大的帽子都还在故事里。", // The traveller, the paper and the oversized hat were all there.
  '7e84c9cc7d34dfb62794e15f6d9d3b4ecc1959c894cfcd24bdeb90fb71f1a065': "坐在他椅子旁的孩子们为这些人物发出声音。", // Children sitting near his chair supplied the figures' voices.
  'b508536428f9ca03bb26eae7248b3b1ae200f592bd45ba4f0230908def50b103': "我停止了录像，重播开头，确认自己是否混淆了两个不同的故事。", // I stopped my recording and replayed the opening, checking whether I had confus
  '14cdbf7c1aceaa66e4471a541ddd35a40868292e4c5eb3a89fc4f160c0c44c00': "协调员过来时，我问是哪个讲述员讲错了故事。", // When the coordinator came over, I asked which teller had got the story wrong.
  '9bd6558af7f4b681fd3e0a58c319c2686ff1560101096470e47f4eab841b26d2': "我无法理解为什么篮子会完全消失。", // I could not understand why the basket had disappeared completely.
  '83d312d112f10e25595a84599c33cccd02f204624a4251e3e881872b3d153d8b': "没有官方结论。", // There was no official conclusion.
  '200efa3b37b7a31ffc70ada9b81ef72954cf6dd92c2332fcb18231e8e02b15ed': "第一个讲故事的人描述了一位旅行者制作了一个巨大的纸帽，后来发现它会滑落在戴者的眼睛上。", // The first storyteller described a traveller who made an enormous paper hat, th
  'b34746386cbfe33173bffd79dddd001d6d2a63b040b53ab322a077269ef907f6': "在家里，我妹妹问起那顶帽子的事。", // At home, my younger sister asked about the hat.
  '2899fb20f5d1529dc89b40abe300bdb8d1a4df798ccd6305de4216522e2a39e5': "我也否定了那些反驳这一假设的证据。", // I had also dismissed the evidence which contradicted that assumption.
  'ee2577532b74cc336a0f6866c984a49951cb79b45db13c9dce7009f50af20759': "我过度反应把建设性建议变成了对一切的拒绝。", // My disproportionate reaction had turned a constructive suggestion into a rejec
  'e135ab3ba63464144f08b8351a858608f08fa019ac9a2153aa7359d818bcbda4': "在发送之前，我按照她的要求总结了反馈：哪些应该保留，哪些应该改变，以及为什么。", // Before sending it, I summarised the feedback as she had requested: what should
  '45e2012b90866cd0fd7413c2fd0183cfa34b13610dd0a2c4e7ed25e5bb87dd6a': "我把一张写着正面评价的反馈卡举向光线，想找出其中是否藏着什么保留意见。", // I held one positive card towards the light, looking for some hidden qualificat
  '5ae24e1c573e5d16af9e9ea25fe03db7952a0e4e47eb6df0e4b122152fe38a61': "为了更公平地评估反馈，我写了两个独立标题：保留和变革。", // To evaluate the feedback more fairly, I wrote two separate headings: KEEP and 
  '86cf4f6a7c12048f86a81b2cfdba0466254d312678c78d6a22f75d731838eb8f': "我立刻接受了这是下午唯一可靠的视角。", // I accepted it immediately as the only reliable perspective on the afternoon.
  '3664f78985cc1eb311eaa48c0c46a2fccde6edb73fa52b7ef4bd0858b831ff0e': "我收集了他们的卡片，期待的是建设性的建议，而不是评估我是否还要设计任何东西。", // I collected their cards, expecting constructive suggestions rather than an ass
  '85cc53fc1d2c22c0f1f44217467850d5dad9e380bb6978f55d24c8c3e43063dc': "下一次试玩时，玩家可以在等待轮到自己时考虑下一步行动。", // For the next trial, players would consider their next move while waiting for a
  'ca935fd15806284c2533074f0cff6c0c93a46348a58f7ca49720e8270a79cb0d': "这条评论指出了一个弱点，而那些正面评价并不能消除这个弱点。", // The comment identified a weakness which the positive cards did not remove.
  'db390675dab1f04f661aba3d392fd83622f260354ca6c2b826e282323380a7ad': "当朋友提到那些愉快的评论时，我仔细观察它们是否有礼貌的迹象。", // When my friend mentioned the cheerful comments, I examined them for signs of p
  '5337e8fa2a01a3db66b41e2ef20f791589b16b78362f8b2bf35d836976256edc': "当我将这些细节与取消消息进行对比时，脸颊微微发烫。", // My face warmed as I compared these details with the cancellation message.
  '61c0757767fed75c31e57c417c744cf5e35d582b07db32da8a7269bc19b3bb8f': "我读了这句话两遍，然后抄写在笔记本顶部。", // I read that sentence twice, then copied it across the top of my notebook.
  'abd7bd3889fed296f666cff26f2ae102a0009563075ae9395b046337c28e2888': "也许玩家们之所以称赞这些规则，只是因为他们知道我花时间写这些规则。", // Perhaps the players had praised the rules only because they knew I had spent t
  'f7d7536cce7a4231fd292f2db485e1dc23e2e0406cb842f3cdf72cb052791db7': "从门口重叠的物品现在占据了不同的空间。", // Objects which had overlapped from the doorway now occupied separate spaces.
  'db19c4e190b4b1235886154c239ae4609d62aa846a9f0fadf5f98bf0e1f89ed2': "我画出房间的画面，就像我站在门口一样。", // I drew the room as though I were standing in its doorway.
  '2e01a430260b1bf82bae1a5f52b8777962e9623d7a38ab1a3a3c97277502d81a': "在再划一条线之前，我标记了观察者站的位置，并考虑从那里能看到什么。", // Before making another line, I marked where the observer would stand and consid
  '37b34600a2cf967be8f36a650fa434523bd691aa801eaddda1cf08a80824e2c6': "她把两个模型放在一起时，我垂下了眼睛。", // I lowered my eyes when she placed the two models together.
  '8b8699971e0822dc5a7cb3c10c737264abf898b6071b62250fc2ca2d51aee035': "椅脚消失在座位下;橱柜顶部变成了普通的矩形。", // The chair legs disappeared beneath their seats; the tops of the cupboards beca
  '2685e6600b64bc57d7b8ca03536d930adcb006552a5b6921d9e5f0ca7d5bdbb6': "在学校里，我因细致的绘画获得赞誉，于是我选了一张干净的纸，把每一支铅笔都削了。", // Having won praise for my detailed drawings at school, I selected a clean sheet
  'b46377b49fbd018f3ed4af34e4e179812bd6478a5dfe97080901682d5b04ec5b': "我把纸转向侧面，又转回原来的方向，皱着眉头仔细看着那一排。", // I turned the paper sideways, then turned it back, studying the row with a frow
  '311acebb389df9ac4a93d86e19e138d93277d113d658c161967fef67ccede473': "我在废纸上画了粗略的形状，记录每个物体占据的地面空间，而不是试图展示它拥有的每一个表面。", // I drew rough shapes on scrap paper, recording the floor space each object occu
  'b8f3518c4330eb99bd5c071c8182be2b5c4680068ca708463ac311a4e1c7822d': "我开始收起铅笔，但老师转动了我的平面图，问现在左边会出现哪个门口。", // I began putting away my pencils, but the instructor rotated my plan and asked 
  'dff515b73de1c58ac081935b28dec11162c25234d6e98b40d2a2633d51cbc193': "我用网格比较距离，并添加了一个小图例来说明我们使用的符号。", // I used a grid to compare distances and added a small key explaining our symbol
  'ba1c8947c07d1fa042984965dc6c48564f014e5e24f1c7a65d05fbf4335dedc2': "我们掀开模型可拆卸的屋顶，从正上方向里面看。", // We lifted the model's removable roof and looked directly down into it.
  'db6158d99f3aa6fdc17cbb374ac2a5f5ffc5489a2fc625257ad80cbe13db0ac8': "我细致的工作看起来很有启发性，却仍让她不得不自己猜测最关键的关系。", // My careful work had looked informative while leaving her to invent the most im
  '749f93ae0db80e6f18ad6a94e5b510ab1b288e4cd35eebd3dac950a3785549d1': "每把椅子都有腿，每个橱柜都有把手，窗户映出想象中的云朵。", // Each chair had legs, each cupboard had handles, and the windows reflected imag
  '3eb7ea3ae9dbc975559c81cd7ca8239782b9ed1e2314a1962a618b4b4aff7c0d': "我没有去揭开它，而是打开新的页面，开始处理变更，准备在其他人收拾行李后留下来。", // Rather than uncovering it, I opened a fresh page and began working through the
  '9498823fc90951df0b43c1a1853b2a8da4b0f584b9e5ed126ccf0e0461d75dc0': "我们的合作伙伴会用这些图纸在屏风后重建房间。", // Our partners would use the plans to rebuild the room behind a screen.
  'a51c0d9a4346e42e7706bb5727f138f0dd9e724e9117b84a776a610efe68e96e': "这些标记看起来不像家具，但更清楚地说明了它们的排列。", // These marks looked less like furniture, yet provided clearer information about
  '4ee39e74757ae5eb82791555753663e9fe84524463fe710ea9de98ef796750e2': "第一个任务已经完成;但新问题还没完成。", // The first task had been completed; the new question had not.
  'f51fe0c643629f30823d97f797a836722085302e33a5a750fc6ce315cf1d7b22': "我原本以为难点是让家具看起来逼真。", // I expected the difficult part to be making the furniture look convincing.
};
