/**
 * 第十一周 —— olevel（O-Level 标准）档，五篇全原创，按 11-09 至 11-13 排列。
 * 沿用第十周结构：每篇九段，4 道情绪配对（共用八词词库）、1 道短语理解四选一、
 * 1 道原文填空四选一、4 道两分简答；每天 10 题、自动判 6 题、人工判 4 题、满分 14。
 * 全周判断题分布：周一至周五各 0 道，TRUE 0 / FALSE 0 / NOT GIVEN 0。
 * 本档原有题型没有判断题，按同档模板保留，通用判断题平衡要求不适用。
 *
 * 周一 learning：The Space for a Reason（非 GP 议论文）。学生在代数推导旁补写理由，
 * 区分步骤名称与成立条件，并用零检验未经限定的除法规则。结局：一道原本正确的题
 * 并未换答案，却有了可以辩护的推理；以允许向自己追问收束，不写窍门造就能手。
 * 周二 culture：Before the Cloth Goes Home（非 GP 议论文）。文化交流午餐中，作者用
 * 包礼布送书，却没有说明布也赠出；收礼人按自己家庭的习惯折好归还。结局：双方说明
 * 各自约定，布随书留下，后来成为阅读时的垫布；文化交流不是判定一种礼数正确。
 * 周三 history：Between the Canal Gates（非 GP 议论文，历史虚构）。在牵引马拉船的
 * 运河时代，少年乘客经历船闸蓄水提升，原本以为停船就是浪费时间，逐步看懂高度转换。
 * 结局：马恢复牵引，速度仍慢，货船却已抵达上一级水道；从一次通行看到运输基础设施。
 * 周四 nature：The Flowers Above the Grass（非 GP 议论文）。野外课观察禾草不起眼的
 * 花部与风中花粉，区分花粉释放与成功传粉。结局：作者改用近看与轻声描述带领后来者
 * 看花，不采摘、不摆拍，也不以一次观察宣称测出了传粉效果。
 * 周五 psychology：A Reason to Stop（GP 议论文）。学校社团是否应允许中止投入很多的
 * 项目？以公认的沉没成本效应为中心，充分论证继续练习和履行承诺的价值，区分已耗费
 * 的成本、未来收益与仍须履行的责任。结局：只有按后续价值、剩余成本和承诺审查后，
 * 中止才有根据；不是一遇困难便换项目。例证作用、回应反方和条件结论均设简答题。
 *
 * 事实核对（按简报离线进行，未联网）：
 * · 周一等式两边减去相同量可保持相等，除以同一个非零数可保持相等、零不能作除数，
 *   是基础代数，把握高。课堂、作业和学生反应全部虚构，不声称某教法必然提升成绩。
 * · 周二 furoshiki 是与日本相关的包裹、携物用布，布可解开复用，把握高；不写起源
 *   年代、词源或全国统一礼仪。是否赠布明确只由两位当事人的家庭习惯和现场约定决定，
 *   不将原创对话当作民族文化规则，也不写织造技法或折纸说明书试用。
 * · 周三历史运河上曾用岸边马匹沿牵引道拉船；船闸可让船在不同水位水道间升降；
 *   蓄水时船随水面上升，达到上级水位后可开上闸门，均把握高。地点、乘客、货物、
 *   操作顺序中的具体动作均为历史虚构；不设首创者、年份、尺寸或普遍收费规定。
 * · 周四许多禾草风媒传粉，花部可小而不鲜艳，花药释放花粉，部分禾草柱头呈羽状；
 *   花粉释放不等于已经到达同类花的柱头，把握高。不指定物种、季节、距离或成功率，
 *   不称所有草花形相同；场地、向导与动作均虚构，不冒充实测研究。
 * · 周五沉没成本效应是已不可收回的投入影响继续投入判断的公认现象，把握高；
 *   不声称人人都有同等反应、不写实验者、人数、年份或效应量。模型社经历是原创设例，
 *   继续练习、尚存承诺和后续成本属于论证条件，不冒充学校现行规定或心理实验结果。
 * 五篇均不使用人物姓名，避开第九、十周各档人物；不设组屋或熟食中心背景。
 *
 * 查重：完整对照 pack-titles-1106.txt（1–10 周 240 篇）和 read-titles-1106.txt；
 * 完整读第十周同档及 authored.js，读第九周同档与前两周其他档文件头。
 * 在本地内容包和 test-fixtures 检索 self-explanation / worked example / algebra /
 * equation / furoshiki / wrapping cloth / canal lock / lock chamber / towpath /
 * wind pollination / grass flower / sunk cost / irrecoverable 等词组，并核对可疑近邻。
 * · The Test That Teaches 写提取记忆，The Slipper Test 写误学背景；周一材料始终可见，
 *   追问的是每一步为何合法。The Longer Page 写陌生读者操作说明，周一不测试说明书。
 * · A Pattern Built Into Cloth 写经纬结构；周二处理送礼时布的归属约定，不教织造。
 *   Two Lines at a Time 与 Two Lines at the Door 写翻译，周二没有字幕或翻译误解。
 * · Keeping Time by Rail 写时间统一，The Unremarkable Box 写货运标准化；周三写
 *   船闸调节水位，非时刻表、货柜或 Winter Behind the Door 的季节储冷与损耗。
 * · Bees in the City 写城市养蜂，A Fruit Beyond the Fence 写鸟搬果实后的种子去向；
 *   周四写禾草风媒花的结构与花粉，不写动物运种、果肉、清扫协商或种子萌发。
 * · The Price of Owning 写禀赋，The Freedom to Choose Less 写选项负担；周五写不可
 *   收回投入与继续项目的理由。The Trophy on the Shelf 是隐瞒损坏的故事，非沉没成本。
 * 未检出同一核心题材或高潮；五篇骨架依次为推理自问、文化约定协商、历史运输过程、
 * 花部观察、双方论证；结局依次为理由补足、布的归属说清、抵达上级水道、带人看花、
 * 有条件中止。标题检索不等于穷尽旧文，近邻区别与事实边界均在此注明供复核。
 * 情绪时刻均给具体动作且排除近义竞争项；证据取单段内连续逐字片段，跨段另一依据
 * 在解析中注明。两分题逐点独立给分，合理改写给分，照抄而未解释所问层次不给对应分。
 */

'use strict';

const { buildAuthoredDay, numbered } = require('../authored');
const { DATES } = require('./dates');

const LEVEL = 'olevel';

// 周一 —— learning；非 GP 议论文。
const THE_SPACE_FOR_A_REASON = {
  key: 'original-w11-the-space-for-a-reason',
  title: 'The Space for a Reason',
  passage: numbered([
    `Our mathematics teacher returned a page of correct solutions and asked us to leave space beside every line. Into that space, we were to put the reason why the next line followed. I tapped my pen impatiently. Since the answers had already been checked, this additional task seemed like decorating a finished building. I wanted to begin the next exercise while the method was still fresh.`,
    `Beside my first step, I wrote that a number had moved to the other side and changed its sign. That described what appeared on the page, but it did not explain why the two expressions remained equal. The teacher drew no new calculation. Instead, she asked what operation could have been performed on both sides to produce the change I had described.`,
    `I stared at the space beside the line, uncertain which explanation belonged there. Moving a number was what I had always said, and the answer was undeniably correct. Yet a description of a journey did not explain what authorised it. I tried saying the step aloud without using the word moved. For the first time that morning, my familiar sentence failed me.`,
    `Looking back at the previous line, I noticed that subtracting the same amount from both sides would produce exactly this result. Nothing had travelled across the page. The apparent movement was the visible consequence of an operation that preserved equality. I wrote that explanation beside my working, using fewer words than I had expected. The reason belonged to the relationship between the two sides.`,
    `My partner had used a different order of steps. We compared our pages without deciding that one route must replace the other. Both could be justified, although the intermediate lines looked different. This distinction mattered: a method did not become invalid merely because it differed from the example. What mattered was whether each change maintained the relationship required by the problem. Agreement about a result was not a substitute for a coherent account of how it had been obtained. Comparing the reasons also revealed a shared principle beneath the different layouts.`,
    `Further down, I had written that dividing both sides by the same number always preserved equality. Curious about that confident word, I tried including zero. My pencil hovered above the paper as I tested the claim. Division by zero was not defined, so my sentence needed a restriction. Adding nonzero did not improve the neatness of my page; it improved the precision of the rule.`,
    `The teacher asked us to separate naming an operation from explaining its justification. A label such as subtraction could identify what happened without showing why it was permitted. Likewise, copying a familiar pattern might conceal an assumption that needed checking. Our extra column was not meant to replace practice. It provided a place where the conditions behind our practice could become visible. That made the exercise an investigation of assumptions, rather than a demand for a more impressive performance.`,
    `When I reached the final line, I put a small tick beside each explanation and smiled with satisfaction. The answer at the bottom had not changed, but I could now defend the steps above it. Consistency mattered more than familiarity. Some explanations were repeated because the same principle applied again. Others needed qualifications. Their value lay in making the reasoning accessible, rather than making every sentence sound different.`,
    `I began the next exercise with space left beside the working. I did not promise to write an essay after every calculation. Where a step seemed obvious, however, I paused long enough to ask what made it legitimate. A correct answer could close a question on the page. The space beside it gave me permission to open a question about my own understanding.`,
  ]),
  questions: [
    {
      kind: 'matchingFeelings',
      bank: ['impatient', 'uncertain', 'curious', 'satisfied', 'jealous', 'homesick', 'lonely', 'guilty'],
      items: [
        { moment: 'Paragraph 1 — tapping the pen and wanting to leave the explanation task for the next exercise', answer: 'impatient', para: 1 },
        { moment: 'Paragraph 3 — staring at the empty space without knowing which explanation belongs beside the step', answer: 'uncertain', para: 3 },
        { moment: 'Paragraph 6 — testing whether the rule still works when the number used is zero', answer: 'curious', para: 6 },
        { moment: 'Paragraph 8 — ticking the explanations and smiling because the steps can now be defended', answer: 'satisfied', para: 8 },
      ],
    },
    {
      kind: 'mcq',
      stem: 'What does "a description of a journey did not explain what authorised it" suggest in Paragraph 3?',
      answer: 'Saying how the written numbers changed did not establish why the change was valid.',
      distractors: [
        'Choosing a different route through the calculation made the partner\'s answer incorrect.',
        'Leaving room beside every calculation required a longer explanation than the teacher expected.',
        'Checking the final answer made it unnecessary to compare the lines that came before it.',
      ],
      evidence: 'Yet a description of a journey did not explain what authorised it.',
      explanation: 'journey 指数字表面上移项，authorised 指变形为何成立；第 2 段问两边的操作，第 4 段用两边同减解释。干扰项借用搭档路线、留白和核答案，却不解释这层区别。',
    },
    {
      kind: 'gapChoice',
      stem: 'The operation described in Paragraph 4 preserved ______ between the two sides.',
      answer: 'equality',
      distractors: ['precision', 'justification', 'satisfaction'],
      evidence: 'The apparent movement was the visible consequence of an operation that preserved equality.',
    },
    {
      kind: 'short', marks: 2,
      stem: 'Explain why the writer initially considered the new task unnecessary and what the teacher\'s question exposed (Paragraphs 1–3).',
      answer: 'The solutions already had correct answers, so further explanation seemed pointless; the writer could describe the change but could not justify why it kept the sides equal.',
      evidence: 'That described what appeared on the page, but it did not explain why the two expressions remained equal.',
      rubric: '两分：两层各 1 分。①原题答案已经核对正确，所以作者觉得补理由多余；②教师的问题暴露作者只会描述移项，却说不出保持相等的根据。合理同义改写给分。只写「想做下一题」而未说明旧答案已对，不给第一分；照抄 moved 而未说明理由缺口，不给第二分。',
      explanation: '第 1 段给出已核对正确的判断；第 2–3 段表明动作描述不能回答两边为何仍相等。两个信息分别计分。',
    },
    {
      kind: 'short', marks: 2,
      stem: 'Using your own words, explain what the comparison with the partner established about appearance and validity (Paragraphs 4–5).',
      answer: 'Valid solutions can contain different-looking intermediate steps; a step is valid when the operation preserves the required equality.',
      evidence: 'Both could be justified, although the intermediate lines looked different.',
      rubric: '两分：两个判断各 1 分。①中间步骤外观 / 顺序不同，仍可都是有效解法；②有效性的依据是操作维持题目要求的相等关系。合理同义改写给分。只说「两人比较」不给分；只照抄 intermediate lines 而不说明不同不等于错误，不给第一分；不能把与范例长得一样当成有效标准。',
      explanation: '第 5 段承认两条路线都可成立，第 4 段与第 5 段末指出成立标准是保持相等，而非复制外观。',
    },
    {
      kind: 'short', marks: 2,
      stem: 'Why was zero a useful test of the writer\'s rule, and what qualification followed from it (Paragraph 6)?',
      answer: 'Zero revealed a case where the claim failed because division by zero is undefined; the rule had to specify a nonzero divisor.',
      evidence: 'Division by zero was not defined, so my sentence needed a restriction.',
      rubric: '两分：检验作用与修正各 1 分。①零暴露原来 always 的例外，因为除以零无定义；②规则需限定为除以同一个非零数。合理同义改写给分。只说「试了零」不解释为何有用不给第一分；只写「多加一个词」不交代非零条件不给第二分；不要求数学符号。',
    },
    {
      kind: 'short', marks: 2,
      stem: 'What TWO changes in the writer\'s understanding are shown by the unchanged answer and the newly reserved space (Paragraphs 8–9)?',
      answer: 'Getting the correct result is different from being able to defend the reasoning; space for reasons encourages the writer to examine why apparently obvious steps are allowed.',
      evidence: 'The answer at the bottom had not changed, but I could now defend the steps above it.',
      rubric: '两分：两个认识各 1 分。①结果正确与能够解释推理不是一回事，答案不变但理解加深；②留白使作者会主动追问看似显然的步骤凭什么成立。合理同义改写给分。只照抄「答案没变 / 留了空位」未解释意义不给对应分；不能说作者以后每一步必须写长篇文字。',
      explanation: '第 8 段对比结果与可辩护的步骤，第 9 段用主动追问说明空位改变了学习方式。',
    },
  ],
};

// 周二 —— culture；非 GP 议论文。
const BEFORE_THE_CLOTH_GOES_HOME = {
  key: 'original-w11-before-the-cloth-goes-home',
  title: 'Before the Cloth Goes Home',
  passage: numbered([
    `For our language exchange lunch, I wrapped a book in a square of blue cloth instead of paper. I had recently seen a demonstration using a furoshiki, a Japanese cloth used to wrap and carry things. Eager to see the parcel opened, I checked the knot twice before leaving. The wrapping seemed to offer something paper could not: another useful object after the present appeared.`,
    `The demonstrator had shown several arrangements, each suited to a different shape. She had also explained that a cloth could be used repeatedly. I remembered these practical details clearly, but had given little thought to what happened between giver and receiver. In my mind, the book and its covering had become one gift. I had not actually told our host that the cloth was hers.`,
    `At the table, she loosened the knot and lifted out the book. Then she smoothed the cloth with both hands, folded its corners together and placed the little square beside my bag. I waited for her to put it back with the book. Instead, she thanked me for the present and began asking which story I recommended. Neither of us mentioned the folded square.`,
    `When we cleared the table, she handed it to me. I half reached for it, then drew my hand back, awkwardly searching for a sentence that would not sound like a correction. Had she disliked the colour? Before I could ask, she explained that her family usually returned wrapping cloths to their owners. She had folded mine neatly so it would be ready for the journey home.`,
    `Her action had expressed care, although I had initially interpreted it as rejection. She was preserving something she understood to be borrowed. I was offering something I had never clearly offered. We had attached different expectations to the same knot. Neither expectation could be read from the fabric itself, however carefully I had tied it. A tidy parcel had concealed an unfinished conversation. The ambiguity concerned an implicit convention, not an inability to tie the cloth. Courtesy required clarification because the intention behind an action was not necessarily apparent to its recipient.`,
    `I explained that I had intended the cloth to remain with her. She asked whether I was certain, since I might want to wrap another present. We agreed that this particular cloth belonged with the book, but that a future parcel might be different. There was no need to invent a rule for every household. We only needed to make our intentions clear on this occasion.`,
    `She then brought out a plain cloth that she used to carry containers. Showing me its softened corners, she explained why she liked having it returned. I thanked her, grateful that she had explained the meaning of her action instead of simply accepting mine. The conversation had made room for her experience as well as my newly acquired enthusiasm. I was no longer the only person bringing knowledge to the table.`,
    `Back at school, I added a note to our display about wrapping traditions. It described what we had agreed, rather than announcing what all Japanese families did. A reusable object could move between people in several ways: as a present, as a temporary covering, or as something shared. Its material qualities allowed reuse; the arrangement between people determined who would use it next. A personal encounter could support an interpretation of our intentions, not a universal rule about a culture.`,
    `A week later, our host sent a photograph of the open book resting on the blue cloth. She had turned the wrapping into a small reading mat. I laughed with delight at its unexpected second job. The knot I had practised was gone, and no parcel remained. What continued was something less visible than the pattern: an agreement we had finally put into words.`,
  ]),
  questions: [
    {
      kind: 'matchingFeelings',
      bank: ['eager', 'awkward', 'grateful', 'delighted', 'jealous', 'homesick', 'lonely', 'bored'],
      items: [
        { moment: 'Paragraph 1 — checking the knot twice while looking forward to the parcel being opened', answer: 'eager', para: 1 },
        { moment: 'Paragraph 4 — reaching forward, withdrawing the hand and struggling to phrase a response', answer: 'awkward', para: 4 },
        { moment: 'Paragraph 7 — thanking the host for explaining why she usually has her own carrying cloth returned', answer: 'grateful', para: 7 },
        { moment: 'Paragraph 9 — laughing with pleasure at the photograph of the cloth being used as a reading mat', answer: 'delighted', para: 9 },
      ],
    },
    {
      kind: 'mcq',
      stem: 'In Paragraph 5, what is meant by "A tidy parcel had concealed an unfinished conversation"?',
      answer: 'The wrapping was complete, but the two people had not clarified who would keep the cloth.',
      distractors: [
        'The cloth was folded neatly, but the host still wanted advice about which story to read.',
        'The knot was firmly tied, but the writer had forgotten how the demonstrator opened it.',
        'The book was ready to read, but the school display still needed a photograph of the parcel.',
      ],
      evidence: 'A tidy parcel had concealed an unfinished conversation.',
      explanation: '第 2 段作者未明说赠布，第 4–5 段显示主人理解成借用；unfinished 指归属未谈清，不是缺少折法或阅读建议。三项干扰借用了故事、示范与展示。',
    },
    {
      kind: 'gapChoice',
      stem: 'The writer first misread the host\'s careful action as ______.',
      answer: 'rejection',
      distractors: ['enthusiasm', 'experience', 'knowledge'],
      evidence: 'Her action had expressed care, although I had initially interpreted it as rejection.',
    },
    {
      kind: 'short', marks: 2,
      stem: 'How did the writer and the host understand the ownership of the cloth differently before their conversation (Paragraphs 2–5)?',
      answer: 'The writer intended the wrapping cloth to be part of the gift; the host regarded it as the writer\'s property temporarily used to cover the book.',
      evidence: 'She was preserving something she understood to be borrowed. I was offering something I had never clearly offered.',
      rubric: '两分：双方理解各 1 分。①作者认为包布也是礼物，收礼人应留下；②主人认为布只是暂借包装，仍属作者，应归还。合理同义改写给分。只写「一人给、一人还」而未指出归属理解，不给对应分；不能说主人不喜欢颜色，原文只是作者一瞬间的猜想。',
    },
    {
      kind: 'short', marks: 2,
      stem: 'Why did folding the cloth carefully make sense to the host, and why was the writer\'s initial interpretation mistaken (Paragraphs 3–5)?',
      answer: 'The host wanted to return a borrowed item neatly for its owner\'s journey; this was considerate care rather than dislike of the gift.',
      evidence: 'She had folded mine neatly so it would be ready for the journey home.',
      rubric: '两分：目的与误读各 1 分。①折好是为了把她认为借来的布妥善还给主人 / 方便带回；②这表达体贴而非拒绝礼物，因此作者的拒绝解读不成立。合理同义改写给分。只照抄手部动作不解释目的不给第一分；只写「她喜欢布」没有说明行为表达的关照，不给第二分。',
      explanation: '第 4 段解释带回的准备，第 5 段直接对照 care 与 rejection，不能仅凭未收下布推断不喜欢礼物。',
    },
    {
      kind: 'short', marks: 2,
      stem: 'What does the agreement in Paragraph 6 settle, and what wider claim does the school display deliberately avoid (Paragraph 8)?',
      answer: 'They settle that this particular cloth is a gift to the host; the display avoids presenting their arrangement as the practice of all Japanese families.',
      evidence: 'It described what we had agreed, rather than announcing what all Japanese families did.',
      rubric: '两分：具体约定与泛化边界各 1 分。①这块布随书赠给主人；②展示不把两人的安排说成所有日本家庭的统一做法。合理同义改写给分。只说「说清楚了」不给第一分；只照抄展示便条而不指出避免文化泛化，不给第二分；不要求断定哪种习惯更正确。',
      explanation: '第 6 段明确 this particular cloth 的归属，第 8 段限定展示只记录当次约定，不能扩大为民族统一规则。',
    },
    {
      kind: 'short', marks: 2,
      stem: 'Using your own words, explain the TWO separate requirements for the reuse illustrated in Paragraphs 8–9.',
      answer: 'The material must remain suitable for another use; people must understand who is entitled to keep and use it next.',
      evidence: 'Its material qualities allowed reuse; the arrangement between people determined who would use it next.',
      rubric: '两分：物质条件与人际条件各 1 分。①布本身仍可用 / 可改作他用；②双方需明确下一次由谁保有、使用它。合理同义改写给分。只答「做阅读垫」未解释物质可复用不给第一分；只答「布很漂亮」或照抄 knot 却未回答归属约定，不给对应分。',
    },
  ],
};

// 周三 —— history；非 GP 议论文，历史虚构。
const BETWEEN_THE_CANAL_GATES = {
  key: 'original-w11-between-the-canal-gates',
  title: 'Between the Canal Gates',
  passage: numbered([
    `On the morning I first travelled with my aunt's cargo boat, I counted the same distant chimneys until counting became boring. We had stopped between stone walls, although the canal ahead looked empty. Along the bank, our tow horse waited beside its handler. In those days, horses still pulled loaded boats along this canal, and I had expected a journey to consist mainly of moving forward.`,
    `My aunt carried sacks of grain to a mill on a higher stretch of water. The canal did not rise in one continuous slope that a boat could simply follow. Instead, level stretches were joined by chambers called locks. The mechanism depended on gates at both ends. We had entered one from the lower stretch, and the lower gates had closed behind us.`,
    `I watched the upper gates remain shut while the keeper adjusted an opening that admitted water from above. Water stirred beside the boat, but we made no progress towards the mill. I frowned, puzzled that more water was being let into a place we already wanted to leave. My aunt pointed to a dark mark on the wall, just above the place where my shoulder had been.`,
    `The mark was now lower in relation to me. Our boat was rising with the water, although the stone chamber had not moved. I had been measuring progress only along the canal. The keeper was changing another part of our position: our elevation. The upper gates separated two different water levels, and the chamber between them allowed the boat to pass from one to the other.`,
    `As the wall seemed to sink beside us, the upper bank gradually came into view. I stared in amazement at a basket that had previously been above my head and was now almost beside me. Nothing had lifted the grain sacks individually. The water supported the loaded boat throughout its ascent. I could see why unloading everything and carrying it up the bank was unnecessary.`,
    `When the chamber reached the upper water level, the keeper opened the upper gates. Only then could we leave towards the mill. The waiting horse was brought forward, and the tow rope was arranged again. The animal supplied the pull along the canal; the lock had supplied vertical movement. Those were distinct functions within the same transport infrastructure.`,
    `A boat waiting above would make the opposite passage after us. It would enter from the upper stretch, and water would be released towards the lower one to bring it down. The chamber could therefore serve traffic in either direction. Its gates were not simply obstacles interrupting a route. Their controlled opening made the connection between different stretches possible without turning the whole canal into a flowing slope. Coordinating those operations demanded maintenance and a reliable sequence, qualities less visible to a passenger than the horse's strength.`,
    `Outside the lock, my aunt passed me a piece of bread. I settled comfortably against a folded cover, content to watch the tow horse resume its steady walk. The sacks remained where they had been loaded, and the distant chimneys still seemed reluctant to approach. Yet the mill now lay on our level. Our pause between the walls had accomplished something that a faster horse could not.`,
    `Later, when someone asked whether canal travel had been slow, I said that it had. I also described the walls that appeared to move downwards while we stood still. Looking only at the horse would have left out an essential part of the transport system. Some of the journey's most important work had occurred precisely where I thought the journey had stopped. What had appeared to be inactivity was a necessary adjustment to the structure of the route.`,
  ]),
  questions: [
    {
      kind: 'matchingFeelings',
      bank: ['bored', 'puzzled', 'amazed', 'content', 'jealous', 'homesick', 'guilty', 'embarrassed'],
      items: [
        { moment: 'Paragraph 1 — repeatedly counting the unchanged distant chimneys while the boat waits', answer: 'bored', para: 1 },
        { moment: 'Paragraph 3 — frowning because admitting water seems unrelated to leaving the chamber', answer: 'puzzled', para: 3 },
        { moment: 'Paragraph 5 — staring at the basket that has apparently come down to the writer\'s height', answer: 'amazed', para: 5 },
        { moment: 'Paragraph 8 — settling comfortably with bread and enjoying the horse\'s steady pace', answer: 'content', para: 8 },
      ],
    },
    {
      kind: 'mcq',
      stem: 'What does "measuring progress only along the canal" mean in Paragraph 4?',
      answer: 'The writer had considered forward movement while overlooking a necessary change in height.',
      distractors: [
        'The writer had counted the sacks instead of checking how far the chimneys were from the boat.',
        'The writer had watched the horse instead of finding out which mill would receive the grain.',
        'The writer had expected the upper gates to stay open while a second boat entered from below.',
      ],
      evidence: 'I had been measuring progress only along the canal. The keeper was changing another part of our position: our elevation.',
      explanation: 'along 与 height 构成水平、垂直的对比。第 2 段目的地在更高水道，第 4 段船在原位升高，因此停着仍在推进运输任务。其余项混入货物、马和闸门。',
    },
    {
      kind: 'gapChoice',
      stem: 'Water supported the loaded boat during its ______ inside the lock.',
      answer: 'ascent',
      distractors: ['passage', 'connection', 'pause'],
      evidence: 'The water supported the loaded boat throughout its ascent.',
    },
    {
      kind: 'short', marks: 2,
      stem: 'Why was the lock needed on this journey, and why could ordinary forward pulling not replace it (Paragraphs 2–4)?',
      answer: 'The grain had to reach a higher level stretch of canal; pulling forward alone could not raise the boat between the separated water levels.',
      evidence: 'The upper gates separated two different water levels, and the chamber between them allowed the boat to pass from one to the other.',
      rubric: '两分：运输需要与牵引局限各 1 分。①磨坊所在水道比出发水道高，需要转换水位；②单靠沿岸向前拉不能把船升到另一级水位。合理同义改写给分。只说「有门」未解释高度差不给第一分；只照抄「马在等」没有说明牵引不能完成升高，不给第二分。',
      explanation: '第 2 段给出磨坊处于较高水道，第 4 段说明船闸在水平前进之外改变高度。',
    },
    {
      kind: 'short', marks: 2,
      stem: 'Explain what the wall mark revealed and why the observation of the sacks mattered (Paragraphs 3–5).',
      answer: 'The fixed wall mark appeared lower because the whole boat was rising; the sacks could stay aboard, so changing levels did not require unloading the cargo.',
      evidence: 'I could see why unloading everything and carrying it up the bank was unnecessary.',
      rubric: '两分：两个观察的意义各 1 分。①墙上固定标记相对变低，说明船整体随水面上升；②粮袋不用离船，说明升高无须把货卸下搬上岸。合理同义改写给分。只说「墙在下降」而当作墙真的移动，不给第一分；照抄有粮袋却未解释避免卸货，不给第二分。',
      explanation: '第 3–4 段的固定标记提供相对高度证据，第 5 段通过货物一直受船和水支撑解释船闸对运输的价值。',
    },
    {
      kind: 'short', marks: 2,
      stem: 'How did water movement differ for the writer\'s passage and the waiting boat\'s planned passage (Paragraphs 3–7)?',
      answer: 'Water entered the chamber from the upper stretch to raise the writer\'s boat; water would leave towards the lower stretch to lower the waiting boat.',
      evidence: 'It would enter from the upper stretch, and water would be released towards the lower one to bring it down.',
      rubric: '两分：两个方向各 1 分。①作者船：由上级水道向闸室进水，使船上升；②等候船：向下级水道放水，使船下降。合理同义改写给分，每点需水的方向与升降对应。只写「一上一下」不给分；不能说用马把船从水里提起来。',
      explanation: '第 3–4 段描述进水上升，第 7 段描述反向通行时放水下降；这里比较的是水位变化而非马的走向。',
    },
    {
      kind: 'short', marks: 2,
      stem: 'What TWO ideas about transport are supported by the contrast between the slow horse and the completed pause (Paragraphs 6–9)?',
      answer: 'Horizontal pulling and level changing are different necessary functions; a period without forward motion can still perform essential work towards the destination.',
      evidence: 'Our pause between the walls had accomplished something that a faster horse could not.',
      rubric: '两分：两层认识各 1 分。①牵引负责沿水道前进，船闸负责转换高度，功能不同；②没有水平位移的暂停也可能在完成到达目的地所需的工作。合理同义改写给分。只列「马很慢 / 船停了」是照抄对比，未解释其支持的认识，不给对应分；不能概括为运河运输其实很快。',
      explanation: '第 6 段区分两种功能，第 8–9 段把暂停解释为有效运输环节，而非否认行程确实缓慢。',
    },
  ],
};

// 周四 —— nature；非 GP 议论文。
const THE_FLOWERS_ABOVE_THE_GRASS = {
  key: 'original-w11-the-flowers-above-the-grass',
  title: 'The Flowers Above the Grass',
  passage: numbered([
    `Our field class had been promised flowers, so I brought pencils in every bright colour I owned. The guide stopped beside a patch of tall grass beyond the playing field. I lowered my pencil case, disappointed that we had apparently arrived before the interesting part. No broad petals stood above the leaves. The whole patch seemed to offer almost nothing that my coloured pencils were meant to record.`,
    `The guide asked us to look along the upper stems. There, tiny structures hung from delicate threads, while other parts spread out like miniature feathers. These belonged to flowers, although they did not resemble the large blooms I had expected. Many grasses rely on wind to move their pollen. For them, attracting an insect with a colourful display is not the central requirement of reproduction. The guide held the stem where everyone could see it, without taking it away from the plant.`,
    `Through a hand lens, I could distinguish the hanging anthers from the feathery structures that the guide identified as stigmas. Fascinated, I kept turning the lens to examine their shapes from different angles. The anthers released pollen; a suitable stigma could receive it. Their separation made the arrangement easier to see than it had been when every small part looked like another piece of grass.`,
    `A breeze passed through the patch. The stems bent together, and a faint dust drifted from the flowers nearest us. Pollen released into moving air could travel beyond the flower that produced it. Much would settle elsewhere, without reaching a suitable flower. The large quantity released did not make every grain effective. It made sense in a system whose transport was not directed towards a particular destination.`,
    `I began writing that the cloud proved the flowers had been pollinated, then stopped with my pencil suspended above the page. I hesitated because we had seen pollen leave, but had not observed it reach a suitable stigma. The guide nodded at my unfinished sentence. Release and successful arrival were different events. A visible cloud could establish the first without establishing the second.`,
    `We compared these flowers with a photograph of a broad, bright bloom visited by an insect. The contrast was not between proper flowers and unfinished ones. Different arrangements could serve the same reproductive process. In many grasses, exposed anthers let pollen enter the air, while feathery stigmas offered a surface on which airborne grains might settle. Small flowers could therefore have specialised structures without elaborate petals.`,
    `The guide did not suggest that all grasses looked identical, or that insects never visited them. We were examining one patch and using it to understand a common pattern. I added these limits beside my sketch. Naming the pattern helped organise what we had seen, but it did not remove the need to examine the particular plant in front of us. A useful explanation could include exceptions.`,
    `As we packed away, another class approached with a box of magnifiers. I waved them closer and pointed to the upper stems, delighted that I could now show someone where to look. Instead of pulling off a flower, I held my drawing beside the living stem. The comparison left the small structures in place for the next observer. My brightest pencils were still almost untouched.`,
    `On the classroom board, I displayed the sketch without adding imaginary petals to make it attractive. Its few pale lines showed parts I would once have dismissed as insignificant. Visitors had to come close before they could follow the drawing. That seemed appropriate. The flowers had been present before I recognised them; what changed was the kind of attention I was prepared to give.`,
  ]),
  questions: [
    {
      kind: 'matchingFeelings',
      bank: ['disappointed', 'fascinated', 'hesitant', 'delighted', 'jealous', 'homesick', 'guilty', 'lonely'],
      items: [
        { moment: 'Paragraph 1 — lowering the pencil case because the grass seems to lack the flowers expected', answer: 'disappointed', para: 1 },
        { moment: 'Paragraph 3 — repeatedly adjusting the hand lens to examine the tiny flower parts', answer: 'fascinated', para: 3 },
        { moment: 'Paragraph 5 — suspending the pencil after questioning whether the claim about pollination is justified', answer: 'hesitant', para: 5 },
        { moment: 'Paragraph 8 — waving the arriving class over with pleasure at being able to show them the flowers', answer: 'delighted', para: 8 },
      ],
    },
    {
      kind: 'mcq',
      stem: 'What does the contrast between "proper flowers and unfinished ones" reject in Paragraph 6?',
      answer: 'The assumption that flowers lacking showy petals are incomplete versions of insect-visited blooms.',
      distractors: [
        'The observation that the writer had brought bright pencils but had barely used them during the visit.',
        'The distinction between pollen leaving an anther and pollen reaching a suitable receiving surface.',
        'The suggestion that a closer view was needed to distinguish the tiny parts at the tops of the stems.',
      ],
      evidence: 'The contrast was not between proper flowers and unfinished ones.',
      explanation: '第 6 段说明不同花部安排服务同一生殖过程；没有醒目花瓣并不代表没有发育完整。其余项是文中可成立的观察或区别，却不是这句话否定的误解。',
    },
    {
      kind: 'gapChoice',
      stem: 'The flower structures that released pollen were the ______.',
      answer: 'anthers',
      distractors: ['stigmas', 'petals', 'stems'],
      evidence: 'The anthers released pollen; a suitable stigma could receive it.',
    },
    {
      kind: 'short', marks: 2,
      stem: 'Using your own words, explain the contrasting functions of exposed anthers and feathery stigmas (Paragraphs 3–6).',
      answer: 'Exposed anthers allow pollen to be released into moving air; feathery stigmas provide a surface where airborne pollen can be received.',
      evidence: 'In many grasses, exposed anthers let pollen enter the air, while feathery stigmas offered a surface on which airborne grains might settle.',
      rubric: '两分：两个花部功能各 1 分。①外露花药让花粉进入空气 / 随风释放；②羽状柱头提供接收空中花粉的表面。合理同义改写给分。只照抄两种形状不解释功能不给对应分；把释放与接收功能对调不给分；不要求额外术语或保证每粒花粉被接收。',
    },
    {
      kind: 'short', marks: 2,
      stem: 'Why could the visible cloud support only part of the writer\'s original claim, and what was still unobserved (Paragraphs 4–5)?',
      answer: 'The cloud showed that pollen had been released; the group had not observed pollen reaching a suitable stigma.',
      evidence: 'Release and successful arrival were different events. A visible cloud could establish the first without establishing the second.',
      rubric: '两分：已证明与未观察各 1 分。①可见粉尘表明花粉已经释放；②未观察到花粉到达适合的柱头。合理同义改写给分。只说「有风」未指出释放证据不给第一分；只照抄 different events 不解释缺少到达证据不给第二分；不能说看见粉尘就证明传粉成功，也不要求判定自花或异花。',
    },
    {
      kind: 'short', marks: 2,
      stem: 'Explain how Paragraphs 6–7 balance a general explanation with attention to individual plants.',
      answer: 'A common wind-pollination pattern explains the functions of the observed structures; variation and possible insect visits mean each plant still needs to be examined rather than assumed identical.',
      evidence: 'Naming the pattern helped organise what we had seen, but it did not remove the need to examine the particular plant in front of us.',
      rubric: '两分：概括作用与限定各 1 分。①风媒传粉这一常见模式把所见花部及其功能组织为解释；②草类仍有差异 / 可能有昆虫来访，不能用模式代替观察每株植物。合理同义改写给分。只说「所有草一样」不给第二分；只照抄 common pattern 却未解释它帮助理解花部作用，不给第一分。',
    },
    {
      kind: 'short', marks: 2,
      stem: 'What does the writer\'s choice of drawing over picking achieve, and what does leaving out imaginary petals reveal (Paragraphs 8–9)?',
      answer: 'Using the drawing leaves the living flower structures available to later observers; omitting invented petals shows that the writer now values and represents the flowers as they actually are.',
      evidence: 'The comparison left the small structures in place for the next observer.',
      rubric: '两分：行为作用与认识各 1 分。①不用采摘而用图对照，让花部仍在原处供下一批人看；②不补画想象的花瓣，表明作者认可并如实呈现草花原有形态。合理同义改写给分。只说「画画 / 没用彩笔」未解释作用或认识，不给对应分；不能说现场完全没有花。',
      explanation: '第 8 段说明留在原处的作用，第 9 段不以想象花瓣美化，呼应开头只重鲜艳花的期待发生变化。',
    },
  ],
};

// 周五 —— psychology；GP 议论文。
const A_REASON_TO_STOP = {
  key: 'original-w11-a-reason-to-stop',
  title: 'A Reason to Stop',
  passage: numbered([
    `Should a school club be allowed to abandon an unfinished project after investing weeks of work? When our model railway station lost its planned place in an exhibition, I immediately said no. I pressed my notebook flat, determined to protect what we had started. Stopping seemed to make all those afternoons meaningless. Yet effort already spent and effort still required raise different questions about responsibility.`,
    `Psychologists describe a sunk-cost effect: people may continue an activity partly because they have already invested resources they cannot recover. Previous effort feels like a reason to add more. However, another afternoon cannot bring back an afternoon already used. The relevant comparison concerns what continuing would now achieve and what it would still require, rather than how impressive the history of the project sounds.`,
    `The strongest argument for stopping is that future resources remain available for useful alternatives. Our remaining materials could support a small working model for younger pupils, even though the exhibition building would stay unfinished. I leaned over the sketch, curious about how visitors might operate it. This alternative would not recover our earlier hours. It offered a different use for the hours and materials we still controlled.`,
    `The strongest argument for continuing deserves equal attention. Difficult projects provide practice in cooperation and patience, which a quick replacement may not offer. Moreover, other people may have made plans around an agreement. A club that abandons work whenever its original excitement fades could become unreliable. These are genuine future consequences, not merely emotional attachments to a pile of cardboard. Persistence can have educational and social value.`,
    `Granted, that value cannot be judged by the number of afternoons already recorded. If finishing the station would teach construction skills that members still wanted, continuation might be justified. If younger pupils had been promised the finished building, their expectation would also count. The reasoning would concern benefits and obligations that remained ahead. It would not require pretending that every earlier decision had been wise.`,
    `Our club checked what had actually been promised. The exhibition organiser had released us from supplying the station, and no other group was expecting it. I put down my pen, relieved that changing direction would not leave someone waiting for an agreed display. We then compared the remaining tasks with the learning each option offered. Reconsideration became possible because the question had changed from defending yesterday to choosing tomorrow.`,
    `This does not mean that the past has no value. Work already completed may reveal which techniques succeed, and reusable parts can reduce future costs. Such evidence should inform the decision. But knowledge gained from earlier effort is different from an obligation to keep repeating it. Nor should an unused object automatically be called worthless: its possible use elsewhere belongs in the comparison as well.`,
    `We decided to build the smaller model, retaining the station's roof for another activity. As we listed the jobs still needed, I sat back with satisfaction: I could explain our choice without pointing to the hours already spent. We had not proved that stopping was always sensible. We had established a reason for stopping this project, while acknowledging that a different promise could have changed the conclusion.`,
    `Clubs should therefore permit withdrawal after a serious review of future benefits, remaining costs and existing commitments. They should also require an explanation, so that disappointment alone does not become a substitute for judgement. Finishing is valuable when something worth achieving remains to be done. Continuing merely to make previous effort feel justified can turn an understandable attachment into a poor use of what is still available.`,
  ]),
  questions: [
    {
      kind: 'matchingFeelings',
      bank: ['determined', 'curious', 'relieved', 'satisfied', 'jealous', 'homesick', 'bored', 'lonely'],
      items: [
        { moment: 'Paragraph 1 — pressing the notebook flat and firmly insisting that the existing project should continue', answer: 'determined', para: 1 },
        { moment: 'Paragraph 3 — leaning over the alternative sketch to explore how visitors might operate the model', answer: 'curious', para: 3 },
        { moment: 'Paragraph 6 — putting the pen down after confirming that nobody is waiting for the promised station', answer: 'relieved', para: 6 },
        { moment: 'Paragraph 8 — sitting back, pleased to be able to justify the revised choice without counting past hours', answer: 'satisfied', para: 8 },
      ],
    },
    {
      kind: 'mcq',
      stem: 'What is meant by changing "from defending yesterday to choosing tomorrow" in Paragraph 6?',
      answer: 'Assessing the value of the next steps instead of treating past effort as a command to continue.',
      distractors: [
        'Returning the exhibition organiser\'s materials instead of retaining the station roof for later use.',
        'Counting the afternoons recorded in the notebook instead of comparing the two available models.',
        'Keeping the original display promise instead of checking whether anyone was still expecting it.',
      ],
      evidence: 'Reconsideration became possible because the question had changed from defending yesterday to choosing tomorrow.',
      explanation: 'yesterday 指已投入、无法收回的努力；tomorrow 指剩余工作与未来收益。第 6 段先核承诺再比较后续学习价值，回应第 2 段沉没成本效应。干扰项混入材料、记时及承诺，却颠倒了论证方向。',
    },
    {
      kind: 'gapChoice',
      stem: 'In the concluding paragraph, disappointment must not replace ______.',
      answer: 'judgement',
      distractors: ['withdrawal', 'attachment', 'construction'],
      evidence: 'They should also require an explanation, so that disappointment alone does not become a substitute for judgement.',
    },
    {
      kind: 'short', marks: 2,
      stem: 'Identify the argument supported by the smaller-model example and explain how the example supports it (Paragraph 3).',
      answer: 'Stopping can release future resources for a useful alternative; the remaining time and materials can create a model that younger pupils can operate.',
      evidence: 'It offered a different use for the hours and materials we still controlled.',
      rubric: '两分：GP 论点与例证作用各 1 分。①论点：中止可让尚可支配的资源转到有用替代项目；②例证：剩余时间材料可做供低年级学生操作的小模型，展示后续资源确有用途。合理同义改写给分。只说「做小模型」未概括资源转用论点，不给第一分；只照抄有草图却未联系剩余资源的具体用途，不给第二分。',
    },
    {
      kind: 'short', marks: 2,
      stem: 'What TWO forward-looking reasons for persistence does the writer recognise in Paragraphs 4–5?',
      answer: 'Completing demanding work can still develop useful skills; continuing may be necessary to honour commitments that other people still rely on.',
      evidence: 'These are genuine future consequences, not merely emotional attachments to a pile of cardboard.',
      rubric: '两分：两个继续理由各 1 分。①继续困难项目仍可带来技能 / 合作耐心等学习收益；②应考虑别人仍依赖的承诺，保持可靠。合理同义改写给分，两点独立。只答「已花很多时间」是沉没成本，不能替代任何一点；只照抄 cardboard 或列合作一词而不说明未来学习收益，不给对应分。',
      explanation: '第 4 段先提出学习与可靠性两项最强反方理由，第 5 段承认两者在仍属未来收益或义务时成立，作者没有主张随时放弃。',
    },
    {
      kind: 'short', marks: 2,
      stem: 'How does Paragraph 7 answer the objection that reconsidering a project ignores the past? Give TWO distinct ways earlier work can matter.',
      answer: 'Experience from completed work can show which techniques are effective; reusable parts from that work can reduce the cost of a future activity.',
      evidence: 'Work already completed may reveal which techniques succeed, and reusable parts can reduce future costs.',
      rubric: '两分：GP 回应的两项依据各 1 分。①已有工作提供哪些技术有效的经验 / 证据；②已有部件可复用，降低后续成本。合理同义改写给分。只说「过去有价值」不给分；只照抄保留屋顶而不解释复用的成本价值，不给第二分；不能把已经花掉的时间本身当成必须继续的理由。',
    },
    {
      kind: 'short', marks: 2,
      stem: 'Using Paragraphs 6–9, explain why the decision about the station does not justify stopping every difficult project.',
      answer: 'The club had confirmed that no outstanding promise required this station; the decision also depended on comparing the future learning and remaining work of the available options.',
      evidence: 'We had established a reason for stopping this project, while acknowledging that a different promise could have changed the conclusion.',
      rubric: '两分：两个条件各 1 分。①本次已确认没有别人仍等待履行的供展承诺，别的项目可能仍有；②本次比较了后续学习收益与剩余工作 / 成本，别的比较可能支持继续。合理同义改写给分。只说「不要总放弃」不给分；只照抄 this project 不说明条件为何限制推广不给对应分；情绪失落、过去投入多少均不能单独构成中止理由。',
      explanation: '第 6 段确认已解除承诺并比较后续任务，第 8 段明确不同承诺可能改变结论，第 9 段归纳为有条件的审查原则。',
    },
  ],
};

const SPECS = [THE_SPACE_FOR_A_REASON, BEFORE_THE_CLOTH_GOES_HOME, BETWEEN_THE_CANAL_GATES, THE_FLOWERS_ABOVE_THE_GRASS, A_REASON_TO_STOP];

module.exports = {
  LEVEL,
  SPECS,
  DAYS: DATES.slice(0, SPECS.length).map((date, i) => buildAuthoredDay(SPECS[i], date)),
};
