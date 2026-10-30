/**
 * 第十周 —— olevel（O-Level 标准）档，四篇全原创，按 11-03 至 11-06 排列。
 * 沿用第九周：每篇九段；4 道情绪配对、1 道短语理解四选一、1 道原文填空、
 * 4 道两分简答；每天 10 题、自动判 6 题、人工判 4 题、满分 14。
 * 全周判断题分布：11-03 / 11-04 / 11-05 / 11-06 各 0 道；
 * TRUE 0 / FALSE 0 / NOT GIVEN 0。本档既定题型没有判断题，平衡规则不适用。
 *
 * 周二 health：Where the Light Fell（非 GP 议论文）。作者以为窗边座位最适合做校刊，
 * 却被屏幕反光困扰；拉下窗帘又影响画图的同伴。两人通过调整桌子方向分别获得
 * 合适的光线。结局：作者学会把不舒服说出来，下一次主动帮助讨论座位安排。
 * 周三 nature：A Fruit Beyond the Fence（非 GP 议论文）。作者等待鸟搬运果实，
 * 在与园丁互相留出工作空间后，看见鸟把整果带到围栏、吃果肉并留下种子。
 * 结局：观察结束时种子仍在无土的金属栏杆上，传播已发生，未来生长尚未确定。
 * 周四 history：Winter Behind the Door（非 GP 议论文，历史虚构）。天然冰仓的新记账员
 * 经历夏日称重与配送；车轮延误使已称过的冰继续融化，仓主暂存冰块并保留前后重量。
 * 结局：当天订单完成，库内损耗却没有停止；以跨季储冷的持续成本收束。
 * 周五 psychology：Praise with an Audience（GP 议论文）。学校表扬是否应当公开？
 * 正面最强理由是让有价值的具体做法成为共同范例，反面是被关注者的压力和固定标签。
 * 作者以原创课堂经历权衡，结论是先问个人偏好，再公开具体贡献，私人沟通仍需保留。
 *
 * 事实核对（把握程度）：四篇人物、活动、对话及具体安排均为原创虚构；
 * 不冒充真实案例、现行校规、历史档案或实证研究。全文不用人名，不沿用前两周人物。
 * 周二屏幕可反射窗光、改变相对位置可改变所见反光，属于基本光学常识，把握高；
 * 仅描述作者舒适感，不作诊断、不保证某种摆法适合所有人、不提供医学处方。
 * 周三鸟可先搬走肉质果实，再吃果肉并留下种子；离开母株不保证后续萌发生长，
 * 属基础种子传播知识，把握高。单籽红果、鸟的具体动作、围栏和清扫安排均为虚构；
 * 不指定物种、不把所有鸟和果实一概而论、不设传播距离或萌发率，也没有投喂或移种。
 * 周四冬季采集湖冰、保温储存供暖季使用，是天然冰贸易的基本史实，把握高；
 * 保温只能减慢热传递与融化，不能制造新冰，把握高。城镇、仓主、车轮延误、称重
 * 记录均为历史虚构；时代背景与具体情节分开，不写年代、首创者、价格或行业通行规则。
 * 周五只从所述经历论证公开表扬的作用和局限，不声称人人有相同心理反应，
 * 不引用未核实的研究比例；建议均有条件，把握高。依 brief 离线核对，未联网。
 *
 * 查重：完整对照 pack-titles-1030.txt 与 read-titles-1030.txt，并读 week10 其他四档
 * 文件头。检索内容包及 test-fixtures 的 fruit / seed dispersal / berry / icehouse /
 * ice trade / natural ice / ice blocks / ice storage，并核对相近文章。
 * 周三避开本周 An Island Until Lunchtime 的海边制图与 Before the First Line 的图形纠正；
 * 不涉及海岸、潮汐、地图或写生，不使用自信作品被纠正的骨架。The Seeds Kept for
 * Tomorrow 写种子库，The Burr on the Dog 写附着结构启发扣件，A Cone That Moves
 * Without Growing 写湿度驱动开合；本篇核心是现场跟随鸟搬果、果肉食用与种子去向。
 * 周四避开本周 Putting the Letters Back 的拆字复用、A Second Route Through the Book
 * 的索引史和 The Place of the Replica 的展陈论证；无印刷、活字、排版或博物馆工艺体验。
 * Frozen Until Spring 写林蛙耐冻，Too Cold, Too Fast 写吃冷食后的短暂头痛，
 * Why Ice Floats 写水的密度变化，三者均非天然冰的季节储运；
 * The Unremarkable Box 讲货运标准化，非存货在等待中持续融化的时间成本。
 * 周二与 Cool Pavements 的室外降温、The Slipper Test 的分类器背景不同；
 * 周五与 The Prize Money 的奖金使用、The Jellyfish Badge 的聚光灯效应不同。
 * 四篇骨架依次为空间协商 / 跟随果实的自然过程 / 历史场景中的季节储运 / 双方论证；
 * 结局分别为主动表达 / 种子前途未定 / 订单完成而损耗持续 / 有条件的立场。
 * 未使用 brief 禁用套路；重写两篇的情绪时刻、短语题、填空及四道简答全部另拟，
 * evidence 取连续逐字原文，两分题独立计点，照抄但未解释所问关系不给对应分。
 */

'use strict';

const { buildAuthoredDay, numbered } = require('../authored');
const { DATES } = require('./dates');

const LEVEL = 'olevel';

// 周二 —— health；非 GP 议论文。
const WHERE_THE_LIGHT_FELL = {
  key: 'original-w10-where-the-light-fell',
  title: 'Where the Light Fell',
  passage: numbered([
    `The first afternoon we used the new room for our school magazine, I claimed the desk facing the windows. Beyond the glass, trees framed a patch of blue sky; inside, the other desks faced a plain wall. I put my bag on the best chair and sent my friend a photograph, adding that I had found the perfect place to work.`,
    `By the time we began arranging photographs on our screens, the sun had reached the opposite building. Its reflection filled my screen with a pale rectangle. Whenever I leaned sideways to read a sentence, the rectangle moved with me. I increased the screen's brightness, but still found myself bending forward, trying to distinguish the words beneath the reflected windows.`,
    `Our editor asked why I had placed the same photograph twice. I removed it and said I had been distracted. Beside me, my friend was drawing a cover on paper, apparently without difficulty. I looked down, wishing nobody remembered my message about the perfect desk. Having announced that I had chosen the best desk, I was reluctant to explain why working there had become uncomfortable.`,
    `At our next session, I pulled the blind down before opening my file. The rectangle disappeared. Then my friend held her drawing towards the ceiling, searching for enough light to compare two shades of green. I reached for the lamp, but its cable would not reach her desk. With an impatient sigh, I lowered my hands. My solution had simply moved the inconvenience across the table.`,
    `She suggested exchanging seats, which sounded reasonable until we tried it. Her paper received less light, while the window remained visible in my screen from its new position. We stood between the chairs, looking from one unfinished page to the other. Neither of us wanted an advantage at the other's expense. The disagreement concerned competing requirements, not anyone's willingness to cooperate. What we needed was not a winner in the argument but a different arrangement.`,
    `With the editor's permission, we moved the desks away from the wall and turned mine so that the window was beside it. We checked the screen from my usual sitting position before deciding where to stop. My friend kept her paper nearer the daylight. The blind could remain partly open, and a clear passage was left behind our chairs. We marked their positions with tape so that the arrangement could be restored after cleaning. Nothing new had been purchased.`,
    `I could now sit comfortably and read without continually searching for an angle. When the editor returned, I explained both the reflection and my earlier silence. She asked why I had not mentioned it sooner. I admitted that I had treated discomfort as a failure to work hard enough. The room's suitability could only be assessed through actual use. Saying that aloud made the original mistake sound much less important than the effort spent concealing it.`,
    `At the next meeting, I read a whole page before remembering the window. I leaned back and smiled: neither the words nor my chair needed constant adjustment. My friend was comparing her greens beside the glass. We had not proved that daylight was good or bad; we had found different ways of using it for different tasks, within the same small room.`,
    `A younger member later asked which desk was best. I began pointing towards mine, then stopped. Instead, I asked whether the member would be drawing on paper or working on a screen, and where the afternoon light fell. We tried a chair together, checking the position before making any commitment. For once, admitting that an answer depended on the circumstances felt more useful than having an immediate recommendation.`,
  ]),
  questions: [
    {
      kind: 'matchingFeelings',
      bank: ['confident', 'embarrassed', 'frustrated', 'relieved', 'homesick', 'jealous', 'lonely', 'bored'],
      items: [
        { moment: 'Paragraph 1 — sending a photograph and announcing that the perfect workplace has been found', answer: 'confident', para: 1 },
        { moment: 'Paragraph 3 — looking down and wishing nobody remembered the message about the perfect desk', answer: 'embarrassed', para: 3 },
        { moment: 'Paragraph 4 — sighing impatiently and lowering the hands when the lamp cannot solve the new problem', answer: 'frustrated', para: 4 },
        { moment: 'Paragraph 8 — leaning back and smiling after reading without continually adjusting the chair', answer: 'relieved', para: 8 },
      ],
    },
    {
      kind: 'mcq',
      stem: 'In Paragraph 4, what does "moved the inconvenience across the table" mean?',
      answer: 'The writer had made the screen easier to read by making the friend\'s drawing harder to see.',
      distractors: [
        'The writer had exchanged chairs with the friend to gain a better view of the trees.',
        'The writer had brought a lamp nearer the window to compare the two shades of green.',
        'The writer had moved both desks away from the wall to leave room behind the chairs.',
      ],
      evidence: 'My solution had simply moved the inconvenience across the table.',
      explanation: '结合本段拉下窗帘后反光消失、同伴却看不清颜色可知，作者把自己的困难转给了同伴；另外三项混入后文换座位、移动桌子及未能使用的台灯。',
    },
    {
      kind: 'gapChoice',
      stem: 'After the desks were moved, a clear ______ remained behind the chairs.',
      answer: 'passage',
      distractors: ['rectangle', 'reflection', 'recommendation'],
      evidence: 'The blind could remain partly open, and a clear passage was left behind our chairs.',
    },
    {
      kind: 'short', marks: 2,
      stem: 'Using your own words, explain the TWO reasons why the writer kept the problem hidden (Paragraphs 3–7).',
      answer: 'The writer did not want to admit that the desk previously praised as perfect was unsuitable; the writer also believed that discomfort meant insufficient personal effort.',
      evidence: 'I admitted that I had treated discomfort as a failure to work hard enough.',
      rubric: '两分：两个心理原因各 1 分。①已经夸过座位最好，不愿承认自己选错 / 推翻先前评价；②把不舒服归咎于自己不够努力。合理同义改写给分。只写「屏幕反光 / 出现重复照片」是问题或后果，不是隐瞒原因；照抄原文但未回答原因这一层不给分。两点可分别得分，不要求提到编辑的提问。',
    },
    {
      kind: 'short', marks: 2,
      stem: 'Why did lowering the blind fail to meet the friend\'s needs, and why did exchanging seats fail to meet the writer\'s needs (Paragraphs 4–5)?',
      answer: 'Lowering the blind left the friend without enough light to compare the colours; exchanging seats still left the window reflected in the writer\'s screen.',
      evidence: 'Her paper received less light, while the window remained visible in my screen from its new position.',
      rubric: '两分：每个办法的独立失败原因各 1 分。①拉下窗帘后，同伴画画 / 比较颜色的光线不足；②换座后作者屏幕仍反射窗户。合理同义改写给分。换座后纸面更暗可补充，但不能替代第二点所问的屏幕问题；只列出「拉窗帘、换座」或照抄动作而不解释失败不给分。',
    },
    {
      kind: 'short', marks: 2,
      stem: 'Explain how the TWO separate working needs were met by the arrangement in Paragraph 6.',
      answer: 'The writer\'s desk was turned with the window to the side and checked from the sitting position to avoid the troublesome reflection; the friend\'s paper remained close to the daylight for drawing.',
      evidence: 'My friend kept her paper nearer the daylight.',
      rubric: '两分：每人的需要如何被满足各 1 分。①作者：改变桌子方向，让窗在侧面 / 在坐姿下检查反光，从而更容易看屏幕；写出调整与看清屏幕的联系即可。②同伴：让画纸靠近自然光，便于画画 / 看颜色。合理同义改写给分。只写「把桌子搬了」不解释作用不给第一分；通道畅通、没有购买物品不回答两人的工作需要，不给分。',
    },
    {
      kind: 'short', marks: 2,
      stem: 'Using Paragraphs 8–9, explain why the writer asks about the younger member\'s task and why they try a chair together.',
      answer: 'Different tasks need different uses of light, so one desk cannot simply be recommended to everyone; trying the chair checks whether the actual position works for that member.',
      evidence: 'For once, admitting that an answer depended on the circumstances felt more useful than having an immediate recommendation.',
      rubric: '两分：两个目的各 1 分。①询问任务：画纸与屏幕的光线需要不同，不能把自己的最佳位置直接推荐给所有人；②试坐：实际检查该成员在那个位置工作是否合适。合理同义改写给分。只写「问是画画还是用屏幕 / 试了椅子」是照抄动作，未解释问题所问的目的，不给对应分；说作者保证该座位适合每个人不给分。',
    },
  ],
};

// 周三 —— nature；非 GP 议论文。
const A_FRUIT_BEYOND_THE_FENCE = {
  key: "original-w10-a-fruit-beyond-the-fence",
  title: "A Fruit Beyond the Fence",
  passage: numbered([
    "At the field centre, our group had been asked to watch what happened to ripe fruit rather than collect it. I chose a shrub beside a fence, where red berries hung above the path. Somewhere among those leaves, a bird was calling. I moved my chair into the shade and leaned forward, eager to discover whether I could follow a fruit after it left its branch.",
    "A fallen berry lay close enough for us to examine without touching it. Its torn outer skin exposed soft flesh around a single hard seed. Our guide explained that these were different rewards for different participants: the flesh could feed an animal, while the seed might gain transport. Their interests overlapped, but a meal did not automatically provide the seed with a suitable destination. Their ecological relationship could influence the distribution of plants, although successful dispersal alone did not ensure germination.",
    "The first visitor was a small bird that stayed inside the shrub. It removed pieces of flesh from a berry without taking the fruit away. The loosened seed dropped straight onto the soil below. When the bird disappeared among the leaves, I lowered my camera and sighed. I had waited through several empty intervals, and now the only feeding I had seen had left the seed directly beneath the parent plant. My hoped-for journey had barely begun.",
    "Then a gardener approached with a broom. He began clearing leaves from the path directly beneath our shrub. I gripped my notebook, worried that birds would stay away while somebody worked so close. Having heard what we were watching, he agreed to leave the narrow strip beside the fence until our session finished. We moved our chairs back so that he could continue working elsewhere.",
    "A larger bird arrived while we were settling down again. It pulled a whole berry free, held it briefly, then flew towards the fence. I followed its movement with my eyes, keeping my chair still. When it landed on the horizontal rail, I raised one finger towards my partner. The fruit had crossed the space between shrub and fence without either of us carrying it.",
    "Holding the berry against the rail, the bird pulled at the flesh. Small pieces disappeared into its beak; a pale seed gradually emerged. I pressed my partner's sleeve and pointed, unable to keep a broad smile from my face. The bird eventually flew away, leaving the seed on the metal. We had witnessed dispersal without swallowing: carrying a fruit elsewhere before eating it had also moved its seed.",
    "The rail, however, offered no soil. Beneath it were paving stones on one side and a hedge on the other. A further movement towards either surface could have very different consequences. I asked whether we should put the seed under the hedge. The guide reminded us that our purpose was observation. Moving it ourselves would replace the next natural event with a decision made by visitors. That distinction would separate independent observation from deliberate intervention.",
    "Before leaving, we thanked the gardener for letting us finish. He nodded towards the untouched strip and smiled. I felt grateful that he had made room for our quiet activity without abandoning his own. He resumed clearing the path while we returned our chairs, leaving the vegetation beneath the hedge undisturbed. Our temporary place for watching became an ordinary entrance again.",
    "In our account, we distinguished observed movement from the prospect of successful establishment. Reaching a new location was only one stage; survival remained contingent on conditions suitable for germination. At the gate, I looked back at its pale shape on the rail. The bird had finished its meal, and our session was over. For the seed, neither event amounted to an ending."
  ]),
  questions: [
    {
      kind: "matchingFeelings",
      bank: [
        "eager",
        "disappointed",
        "anxious",
        "grateful",
        "jealous",
        "homesick",
        "guilty",
        "bored"
      ],
      items: [
        {
          moment: "Paragraph 1 — leaning forward, wanting to discover where a fruit goes after leaving its branch",
          answer: "eager",
          para: 1
        },
        {
          moment: "Paragraph 3 — lowering the camera and sighing when the hoped-for journey has barely begun",
          answer: "disappointed",
          para: 3
        },
        {
          moment: "Paragraph 4 — gripping the notebook, worried that nearby work will keep birds away",
          answer: "anxious",
          para: 4
        },
        {
          moment: "Paragraph 8 — thanking the gardener for making room for the group's activity",
          answer: "grateful",
          para: 8
        }
      ]
    },
    {
      kind: "mcq",
      stem: "In Paragraph 9, what does \"neither event amounted to an ending\" suggest?",
      answer: "The seed's future remained unsettled after the bird and the observers had left.",
      distractors: [
        "The gardener still had to finish sweeping the path before the group could leave.",
        "The bird would have to return to the shrub to complete the meal it had begun.",
        "The group would have to carry the seed away to finish the observation properly."
      ],
      evidence: "The bird had finished its meal, and our session was over. For the seed, neither event amounted to an ending.",
      explanation: "鸟吃完、观察结束并不代表种子已落在能生长的地方；结合第 7 段金属栏杆无土、第 9 段生长条件尚未落实可知，种子的后续仍未确定。其余项混入清扫、进食和搬动种子，却不解释 ending 对种子的意义。"
    },
    {
      kind: "gapChoice",
      stem: "After the bird finished feeding on the rail, it left a pale ______ there.",
      answer: "seed",
      distractors: [
        "berry",
        "broom",
        "sleeve"
      ],
      evidence: "The bird eventually flew away, leaving the seed on the metal."
    },
    {
      kind: "short",
      marks: 2,
      stem: "Using your own words, explain the different benefits that the animal and the seed might gain from the fruit (Paragraph 2).",
      answer: "The animal can obtain food from the soft flesh; the seed may be carried to a different place.",
      evidence: "the flesh could feed an animal, while the seed might gain transport.",
      rubric: "两分：两个参与者的不同收益各 1 分。①动物吃果肉，获得食物；②种子可能借动物搬运到别处。接受合理同义改写。只说「双方都有好处」或照抄 rewards 却不说明收益不给分；说种子必定发芽不给第二分，原文仅说可能得到运输。"
    },
    {
      kind: "short",
      marks: 2,
      stem: "Why did the first bird disappoint the writer, and how did the larger bird produce the hoped-for result (Paragraphs 3–6)?",
      answer: "The first bird ate where the fruit grew and left the seed beneath the parent plant; the larger bird carried a whole fruit to the fence before leaving its seed there.",
      evidence: "carrying a fruit elsewhere before eating it had also moved its seed.",
      rubric: "两分：两个鸟的结果各 1 分。①第一只：原地进食，种子仍留在母株下，没有实现期待的远离母株；②较大的鸟：先把果实带到围栏再吃，因而把种子一并带走。接受合理同义改写。只答「鸟大 / 鸟小」不给分；只照抄作者叹气或微笑而未解释种子位置的变化，不给对应分。"
    },
    {
      kind: "short",
      marks: 2,
      stem: "Using Paragraphs 7–9, explain why reaching the fence did not establish that the seed would grow, and why moving it under the hedge would change the nature of the group's account.",
      answer: "The seed lay on metal without soil, so suitable growing conditions had not been established; moving it would make its next destination a human choice rather than an observed natural event.",
      evidence: "Moving it ourselves would replace the next natural event with a decision made by visitors.",
      rubric: "两分：两问各 1 分。①未证明能生长：栏杆是无土的金属面，种子尚未到有适宜生长条件的地方；写出缺少适宜条件并结合金属 / 无土即可。②搬动的影响：下一步地点会由观察者决定，记录将包含人为干预，不能再当作自然发生的后续。接受合理同义改写。只列 paving stones / hedge 而不解释条件，或只照抄 observation 而不说明干预，不给对应分；不要求猜种子最终命运。"
    },
    {
      kind: "short",
      marks: 2,
      stem: "What TWO details show how the group's observation and the gardener's work were accommodated (Paragraphs 4–8)?",
      answer: "The gardener temporarily left the strip beside the shrub until the session ended; the group moved their chairs back to let him work elsewhere.",
      evidence: "We moved our chairs back so that he could continue working elsewhere.",
      rubric: "两分：双方各自的安排各 1 分。①园丁暂缓清理围栏旁窄条，让学生不受附近清扫干扰地观察至活动结束；②学生后移椅子，给园丁继续在别处工作留空间。接受合理同义改写。只答「互相帮助 / 说谢谢」不给分；只照抄椅子移动却不交代让工作继续的作用，不给第二分。两点独立计分，不要求写感谢或园丁微笑。"
    }
  ],
};

// 周四 —— history；非 GP 议论文，历史虚构。
const WINTER_BEHIND_THE_DOOR = {
  key: "original-w10-winter-behind-the-door",
  title: "Winter Behind the Door",
  passage: numbered([
    "On my first summer morning at the town's ice store, I was given a notebook and a place beside the weighing scales. Outside, shopkeepers waited with covered carts. Behind a thick door lay ice gathered from frozen lakes during winter. Electric refrigerators were still uncommon here, so the summer trade depended on ice that workers had collected and stored several months earlier.",
    "The keeper lifted the heavy door, and cool air reached my face. Blocks lay packed together beneath sawdust, which was brushed aside only where ice had to be removed. I stepped closer, staring at the pale surfaces stretching into the dim room. It seemed extraordinary that winter could remain within reach while sunlight warmed the yard. Nothing inside was manufacturing new ice; everything available had already been stored.",
    "The keeper explained that the walls and packing slowed the passage of heat. They could delay melting, not abolish it. Water drained away beneath the stack. I could hear it running while she spoke, a quiet reminder that the stock was changing even when nobody placed an order. A full store represented a reserve, but not a permanent one.",
    "My task was to record the weight of each block as it left. Before weighing, the workers brushed off its packing; afterwards, they covered it for the journey. One customer wanted a smaller piece because his cart had little room. Another asked for several blocks together. Listening to their requests, I began to notice that the store supplied a service whose usefulness depended on what happened beyond its door.",
    "Near midday, a baker arrived with a cart whose wheel needed attention. His ice had been weighed, but he could not depart. I tapped my pencil against the notebook, irritated as a small pool spread beside the covered block. The quantity written on my page stood still while the quantity beside the cart diminished. Neither the customer nor the keeper could recover the time already lost.",
    "While another worker attended to the wheel, the keeper arranged for the block to wait inside the cool store. The baker returned his covering to the cart and helped clear a space near the doorway. Nobody claimed that these precautions would stop all loss. They reduced unnecessary exposure while the practical obstacle was dealt with. Once the cart was ready, the block was weighed again before departure.",
    "The second weight was lower. I looked from the scales to my earlier entry, unsure which figure to keep. The keeper asked me to retain both and note the delay between them. Our record needed to distinguish what had first been taken from storage from what actually left the yard. The difference was part of the delivery's cost, although it could not be loaded onto a cart.",
    "By the afternoon, every order that could be supplied that day had gone. I put down the notebook and stretched my fingers, relieved that nobody remained waiting for a weight I had forgotten to write. Behind the closed door, however, water continued draining. Tomorrow's supply would be smaller even if no customer returned. Keeping a reserve required work between deliveries as well as during them.",
    "At home, I rinsed the dust from my hands and watched the water disappear. I could still hear the store's quiet trickle. During winter, the workers had gathered something plentiful; in summer, they measured out what remained. I had spent the day writing numbers beside customers' requests, yet the place was also occupied with a longer transaction: carrying cold from one season into another, with a little less arriving each day."
  ]),
  questions: [
    {
      kind: "matchingFeelings",
      bank: [
        "amazed",
        "irritated",
        "uncertain",
        "relieved",
        "jealous",
        "homesick",
        "lonely",
        "ashamed"
      ],
      items: [
        {
          moment: "Paragraph 2 — stepping closer and staring at the ice that has lasted into the summer",
          answer: "amazed",
          para: 2
        },
        {
          moment: "Paragraph 5 — tapping the pencil impatiently while the delayed block loses ice",
          answer: "irritated",
          para: 5
        },
        {
          moment: "Paragraph 7 — looking between the scales and the earlier entry, unsure which figure to keep",
          answer: "uncertain",
          para: 7
        },
        {
          moment: "Paragraph 8 — putting down the notebook, relieved that no waiting customer's weight has been omitted",
          answer: "relieved",
          para: 8
        }
      ]
    },
    {
      kind: "mcq",
      stem: "In Paragraph 9, what is meant by \"a longer transaction\"?",
      answer: "The store preserved winter's ice for summer use while gradually losing some of it.",
      distractors: [
        "The baker needed extra time to repair his cart before taking his order away.",
        "The keeper retained both weights to explain the difference in one delivery.",
        "The customers ordered different block sizes to suit the space in their carts."
      ],
      evidence: "carrying cold from one season into another, with a little less arriving each day.",
      explanation: "longer transaction 把跨季保存比作交易：冬天取得的天然冰被留到夏天使用，但持续融化。它统摄第 1–3 段的冬采夏储与第 8 段的静置损耗；其余项都是当天单笔配送的细节。"
    },
    {
      kind: "gapChoice",
      stem: "The ice blocks were packed beneath ______, which workers brushed aside before removing them.",
      answer: "sawdust",
      distractors: [
        "sunlight",
        "storage",
        "stock"
      ],
      evidence: "Blocks lay packed together beneath sawdust, which was brushed aside only where ice had to be removed."
    },
    {
      kind: "short",
      marks: 2,
      stem: "Using your own words, explain what the packing achieved and what evidence showed its limitation (Paragraphs 2–3).",
      answer: "The packing reduced how quickly heat reached the ice and slowed melting; the water running from beneath the stack showed that ice was still being lost.",
      evidence: "They could delay melting, not abolish it. Water drained away beneath the stack.",
      rubric: "两分：作用与局限证据各 1 分。①包装阻缓热量进入 / 使融化较慢；②堆下仍有水流出，证明冰继续融化 / 数量仍在减少。接受合理同义改写。只答「有木屑 / 有厚门」未解释作用不给第一分；只照抄流水声却不说明它证明持续损耗，不给第二分。答包装制造冷气或完全阻止融化不给分。"
    },
    {
      kind: "short",
      marks: 2,
      stem: "Using Paragraphs 4–6, explain why the baker's delay reduced the usefulness of the earlier weight, and identify how the keeper reduced further loss while he waited.",
      answer: "The ice continued melting after its first weighing, so that figure no longer represented the amount available to depart; the keeper moved the block back into the cool store while the cart was repaired.",
      evidence: "The quantity written on my page stood still while the quantity beside the cart diminished.",
      rubric: "两分：两问各 1 分。①旧重量的局限：称重后仍融化，原数字不再代表即将运走的实际冰量；②减少后续损耗：把冰块移回凉的储藏室暂放，减少等车时的热暴露。接受合理同义改写。只说「车轮坏了 / 太慢」不解释重量为何失去代表性，不给第一分；只说修车而未指出冰如何保管，不给第二分。"
    },
    {
      kind: "short",
      marks: 2,
      stem: "Why did the keeper want BOTH weights recorded rather than only the second one (Paragraph 7)?",
      answer: "The first weight documented the amount originally removed from storage; the second documented the amount that actually departed after the delay.",
      evidence: "Our record needed to distinguish what had first been taken from storage from what actually left the yard.",
      rubric: "两分：两个数字的记录意义各 1 分。①第一数记录最初从库中取出的冰量；②第二数记录延误后实际离开院子的冰量。接受合理同义改写，各点独立给分。只说「两个数不同 / 第一个大」未解释所代表的不同阶段，不给分；照抄 retain both 而不解释为何保留，不给分；不要求推算损耗数值，原文未提供。"
    },
    {
      kind: "short",
      marks: 2,
      stem: "Using Paragraphs 2–3 and 8, explain the TWO reasons why finishing the day's deliveries did not settle the problem of future supply.",
      answer: "Ice remaining inside still melted, reducing tomorrow's supply even without sales; the store did not produce new ice to replace what was lost.",
      evidence: "Nothing inside was manufacturing new ice; everything available had already been stored.",
      rubric: "两分：两个独立限制各 1 分。①未卖出的库存也持续融化，即使没有顾客也减少未来可用量；②仓库只保存已有天然冰，不制造新冰补回损耗。接受合理同义改写。只答「明天还有人来买」不给分，题目问未来供应为何未获保证；只照抄水继续流而不解释库存减少，不给第一分；不要求猜下次采冰日期。"
    }
  ],
};

// 周五 —— psychology；GP 议论文。
const PRAISE_WITH_AN_AUDIENCE = {
  key: 'original-w10-praise-with-an-audience',
  title: 'Praise with an Audience',
  passage: numbered([
    `Should schools praise students in front of everyone, or give encouragement privately? I used to regard the public version as obviously better. When my teacher read out a comment about my work, I sat straighter, delighted that the class could hear it. Yet being pleased on that occasion does not mean that an audience always improves praise. A nuanced judgement must consider both method and intention.`,
    `The strongest argument for public praise is that it can make an example available to others. A teacher who explains how a student checked a difficult calculation gives the class something useful to imitate. Quietly thanking that student would acknowledge the effort, but would not share the method. Public recognition can therefore teach a standard as well as reward the person who has met it.`,
    `I saw this when our teacher displayed my diagram with its clear labels. She explained how the spacing helped readers follow the process, and several classmates examined it afterwards. I studied their first attempts, curious about how they would adapt the spacing. What mattered was the specific feature she identified. The attention allowed an effective decision to become useful beyond the page where I had made it.`,
    `The strongest objection, however, concerns what happens when praise turns an action into an identity. Later, someone introduced me to a new group as "the person who always gets diagrams right". When our next task involved drawing, every sheet came towards me. I gripped my pencil, anxious about producing anything ordinary. A compliment about one successful page had become an expectation of perpetual excellence.`,
    `Supporters might respond that students should learn to accept attention rather than avoid it. There is some force in this: explaining successful work can be valuable practice. But being invited to discuss a particular decision differs from being required to perform a fixed identity. Refusing the second demand need not mean rejecting the first opportunity. Recognition can become a burden when it implies an obligation to preserve a reputation. Encouragement should leave room for a tentative, imperfect attempt.`,
    `Nor should a teacher assume that everyone welcomes the same audience. A classmate once asked for feedback in writing because public scrutiny made it difficult to consider the actual comments. The teacher still discussed the useful method with the class, using an unnamed example with permission. The learning was shared without making personal visibility the price of receiving encouragement. That distinction protects participation rather than reducing it.`,
    `Granted, asking about preferences takes time, and anonymous examples lose something when nobody knows whose work is being discussed. Students may reasonably want their contribution acknowledged. This is not an argument for removing names from every display. It is a reason to preserve autonomy by asking first, and to make a refusal possible without treating it as a failure to appreciate the compliment. Consent and sensitivity matter even when the intention behind the praise is generous.`,
    `When our teacher next asked to show my work, she offered me a choice about speaking. I agreed to display the page but asked her to explain it herself. My grip on the pencil loosened. I could accept recognition without promising a performance. Another day I might choose to speak; having that possibility mattered more than being assigned a permanent role as the class expert.`,
    `Public praise is justified when it identifies a contribution accurately and respects the recipient's preferences. Private encouragement should remain available, especially when an audience would obscure the feedback itself. Its purpose is constructive, proportionate feedback, not the imposition of a label. Schools need not choose one method forever. They should distinguish sharing a useful example from turning its maker into an example of a supposedly flawless person. The first invites further effort; the second may make ordinary learning harder.`,
  ]),
  questions: [
    {
      kind: 'matchingFeelings',
      bank: ['delighted', 'curious', 'anxious', 'relieved', 'guilty', 'homesick', 'bored', 'lonely'],
      items: [
        { moment: 'Paragraph 1 — sitting straighter with pleasure as the teacher reads a positive comment aloud', answer: 'delighted', para: 1 },
        { moment: 'Paragraph 3 — studying classmates\' first attempts to find out how they will adapt the spacing', answer: 'curious', para: 3 },
        { moment: 'Paragraph 4 — gripping the pencil and worrying about producing an ordinary diagram after being labelled an expert', answer: 'anxious', para: 4 },
        { moment: 'Paragraph 8 — loosening the grip when accepting recognition no longer requires speaking to the class', answer: 'relieved', para: 8 },
      ],
    },
    {
      kind: 'mcq',
      stem: 'In Paragraph 6, what does "making personal visibility the price of receiving encouragement" mean?',
      answer: 'Expecting someone to accept public attention in order to receive positive feedback.',
      distractors: [
        'Expecting someone to explain the spacing before a diagram can be displayed.',
        'Expecting someone to prepare a rough version before checking a calculation.',
        'Expecting someone to name the class expert before choosing a useful example.',
      ],
      evidence: 'The learning was shared without making personal visibility the price of receiving encouragement.',
      explanation: 'price 指附加条件而非金钱：学生不应只有接受公开关注才能得到鼓励。匿名例子仍分享方法，回应了公开表扬才能全班受益的论据；其余项混合了文中细节，却不解释此短语。',
    },
    {
      kind: 'gapChoice',
      stem: 'In Paragraph 5, encouragement should leave room for a ______, imperfect attempt.',
      answer: 'tentative',
      distractors: ['flawless', 'permanent', 'anonymous'],
      evidence: 'Encouragement should leave room for a tentative, imperfect attempt.',
    },
    {
      kind: 'short', marks: 2,
      stem: 'Using Paragraphs 2–3, identify the argument supported by the diagram example and explain why the teacher\'s comment supports it.',
      answer: 'Public praise can teach other students a useful method; identifying how the diagram\'s spacing helped readers gave classmates a specific technique they could examine and use.',
      evidence: 'She explained how the spacing helped readers follow the process, and several classmates examined it afterwards.',
      rubric: '两分：GP 论点与例证作用各 1 分。①论点：公开表扬能把有效方法分享给其他学生 / 教会全班某种标准；②作用：教师点明间距如何帮助读者理解，给同学一个可检查 / 学习的具体做法。合理同义改写给分。只说作者高兴或图被展示，不回答论点不给第一分；只照抄同学看图而未解释他们可从具体评论中学到什么，不给第二分。',
    },
    {
      kind: 'short', marks: 2,
      stem: 'Using Paragraphs 4–5, explain the contrast between praising an action and assigning an identity.',
      answer: 'Praising an action recognises a particular successful decision or piece of work; assigning an identity creates pressure to keep performing perfectly in future.',
      evidence: 'A compliment about one successful page had become an expectation of perpetual excellence.',
      rubric: '两分：对比两端各 1 分。①具体行为的表扬只认可某次作品 / 某个有效决定；②身份标签要求今后一直出色，给被表扬者持续压力。合理同义改写给分。只写「action 与 identity 不同」不给分；只照抄人称标签而未解释固定期待的含义不给第二分；不能把两点都写成笼统的「让人高兴」。',
    },
    {
      kind: 'short', marks: 2,
      stem: 'How does the example in Paragraph 6 answer the argument for public praise, and what limitation of unnamed examples does the writer concede in Paragraph 7?',
      answer: 'A useful method can still be shared publicly without identifying its maker; unnamed examples may fail to give contributors the personal credit they want.',
      evidence: 'Students may reasonably want their contribution acknowledged.',
      rubric: '两分：GP 回应与让步各 1 分。①回应：匿名展示仍能让全班学到方法，不必以公开个人为条件；②让步：匿名可能使希望被认出贡献者得不到署名认可 / 个人荣誉。合理同义改写给分。只说同学喜欢书面反馈，未说明怎样保留公共学习价值，不给第一分；只说询问偏好费时，不回答题目指定的匿名例子局限，不给第二分。',
    },
    {
      kind: 'short', marks: 2,
      stem: 'What TWO conditions does the writer place on justified public praise in Paragraph 9?',
      answer: 'It should describe the actual contribution accurately; it should respect how the person prefers to receive recognition.',
      evidence: 'Public praise is justified when it identifies a contribution accurately and respects the recipient\'s preferences.',
      rubric: '两分：两项条件各 1 分。①准确指出实际贡献 / 有根据地评价具体做法；②尊重被表扬者对接受认可方式的偏好。合理同义改写给分，两个条件分别计分。只答「公开或私人都可以」未给条件，不给分；只照抄 flawless person 而不解释应避免固定完美身份，不给对应分；不能把作者立场说成一律取消公开表扬。',
    },
  ],
};

const SPECS = [WHERE_THE_LIGHT_FELL, A_FRUIT_BEYOND_THE_FENCE, WINTER_BEHIND_THE_DOOR, PRAISE_WITH_AN_AUDIENCE];

module.exports = {
  LEVEL,
  SPECS,
  DAYS: DATES.slice(0, SPECS.length).map((date, i) => buildAuthoredDay(SPECS[i], date)),
};
