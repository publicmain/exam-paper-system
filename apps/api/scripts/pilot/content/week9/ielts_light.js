/**
 * 第九周 —— **ielts_light（雅思轻量）**档，全原创说明文。
 *
 * 三百一十词上下、五段，不编号。形状与第四到八周这一档一致：
 *   3 道判断 · 3 道填空转四选一 · 1 道两分概括填空 · 3 道主观题（2/1/2 分）—— 满分 13。
 * 每篇至少一道「Using your own words」。
 *
 * 本周叶老师 10-23 要求「内容可以整体难一点」：篇幅取 300–320 词偏上段，超纲率往 6–8% 写，
 * 句子多用从句 / 被动 / 让步，信息不每段一句直给；题目多考跨句综合、指代和推断。
 *
 * 本周选题（周二保留已审定稿，按日期追加周三到周五；括号里是徽章主题）：
 *   周二 psychology  话到嘴边说不出来（A Word Just Out of Reach）
 *                    —— 「舌尖现象」：明知道某个词却想不起来，还能感觉到它多长、什么字母开头，
 *                       很多语言都用「舌头」来形容；1890 年就有人描述过，1960 年代两位美国心理学家
 *                       在实验室里「制造」出来：念出生僻词的释义让学生说词，卡住时问还能说出什么；
 *                       学生常能猜对首字母和音节数，冒出来的词有的音近、有的是别的船名（目标词 sampan）
 *                       —— 说明意思已经找到、声音只找到一部分；后来的研究：
 *                       年轻人大约一周一次、年纪越大越多，人名最常见，双语者更常见；
 *                       解释是久不用的词「意思—声音」的连接变弱；词通常过后自己冒出来，
 *                       听到同一个音开头的无关词也有帮助。
 *   周三 history     预付邮资改变寄信方式（A Penny Before the Journey）
 *                    —— 从收信人按距离和纸张数付费，转到 Hill 分析邮路共同成本、提出统一收费；
 *                       1840 年黑便士邮票让预付邮资可以提前购买、在家使用并在投递环节辨认；
 *                       结尾区分邮票、低邮资与简化手续的贡献，不把通信增加只归因于小纸片。
 *   周四 nature      松果的湿度响应结构（A Cone That Moves Without Growing）
 *                    —— 多种松树成熟球果的鳞片，各层吸湿膨胀不同而弯曲，湿闭干开帮助有翅种子传播；
 *                       空果脱离树枝后仍能响应，说明材料结构不等于活体感知；
 *                       最后讨论同一材料兼做检测与运动的部件，以及触发条件必须匹配用途的限制。
 *   周五 technology  图片压缩与信息取舍（What a Smaller Picture Leaves Out）
 *                    —— 同样像素尺寸可以有不同文件大小；无损压缩利用重复，有损压缩舍弃信息；
 *                       正常观看不明显的失真放大后可见，改存无损不能找回已删信息；
 *                       结尾落到单独保留原图，为后续编辑留余地、避免反复有损保存的进一步变化。
 * GP 追加要求已核对：指定 authentic 三篇及 olevel 周五；本档三篇仍为说明文。
 *
 * 查重：在 pack-titles-1023 / read-titles-1023 两份标题表里逐条看过，并在 week2~week8 内容包里
 * grep 过 tip of the tongue / tip-of-the-tongue / sampan：没有同题。旁及的已有篇目 ——
 * 「When Memory Rewrites Itself」（记忆被改写）、「The Test That Teaches」（提取练习）、
 * 「The architecture of memory: how spaced repetition works」（间隔重复）都讲记忆，但讲的是
 * 「记得牢不牢、记得准不准」；这篇讲「明明记得却一时提不出来」以及卡住时脑子里冒出的线索，
 * 实验、结论、骨架都不同。「Say the Colour, Not the Word」（第八周本档周五，斯特鲁普）也是
 * 心理学 + 词语，但那篇讲读词自动化干扰说颜色，这篇讲找词失败。无人物、无情节，不涉及叙事老套路。
 *
 * 新增三篇查重：完整对照 pack-titles-1023 / read-titles-1023 两份标题表，并在内容包及
 * test-fixtures 搜索 postage / postal / Penny Black / Rowland Hill / pine cone / pinecone /
 * compression / lossless / lossy / pixel，没有同题。已有「The Fifty-First Stamp」是体检盖章叙事，
 * 不讲邮资；「Keeping Time by Rail」讲时刻统一，不讲邮政支付；「The Burr on the Dog」讲倒钩与
 * 魔术贴，不讲松果鳞片吸湿形变；「The Plant That Shies Away」讲触碰触发的活体反应，
 * 不讲非活体材料被动开合；「Frame by Frame」是人物制作动画的故事，不讲图像压缩。
 * 三篇分别采用历史制度演变、自然机制与设计限制、技术分类与实际选择的骨架，结尾互不套用。
 * 新增正文不使用第八周人物；唯一具名历史人物 Rowland Hill 未见于第八周。
 *
 * 判断题全周：周二 NG / F / F · 周三 T / T / F · 周四 NG / T / T · 周五 F / NG / NG
 *   → TRUE 4 · FALSE 4 · NOT GIVEN 4；每天只用两类答案，不是三种各一，也不全同。
 *   NOT GIVEN 在第一位两次、第二位一次、第三位一次。
 * 新增选词题干扰项均取自本篇原文，使用相同词性；依据具体语境排除，不能只靠词形猜答案。
 *
 * 事实只写有把握的，拿不准的年份、数字、人名一律不写：
 *   · 舌尖现象（tip-of-the-tongue state）—— 确信知道某词却一时提取不出，常能报出部分信息
 *     （首字母、音节数）；跨语言普遍，Schwartz 1999 调查的 51 种语言里约 45 种用「舌头」类说法
 *     （文中只写 many languages）—— Wikipedia「Tip of the tongue」、Schwartz《Tip-of-the-Tongue
 *     States》。把握高。
 *   · 1890 年 William James《The Principles of Psychology》就描述过这种「有个空缺在里面活动」
 *     的感觉（文中写 as early as 1890，不写人名）—— 同上。把握高。
 *   · Roger Brown & David McNeill 1966（Harvard，Journal of Verbal Learning and Verbal Behavior）：
 *     念出生僻词的词典释义让学生说出该词；学生进入舌尖状态时，能以高于随机的准确度猜出首字母和
 *     音节数；冒出的替代词有音近的（目标词 sampan 时有 Saipan、Siam、Cheong、sarong）和义近的
 *     （barge、houseboat、junk）—— 原论文、Wikipedia 同条、多本认知心理学教材均以 sampan 为例。
 *     把握高。文中写 two American psychologists、the 1960s，不写人名、人数和替代词例子（Siam / barge 等
 *     生僻，换成「发音相近 / 别的船名」）。
 *     sampan 释义写成「a word for a small boat used in East Asian harbours」，是转述，不加引号。
 *   · 年轻人大约每周一次、随年龄增多 —— Burke, MacKay, Worthley & Wade 1991 日记研究；人名是最常见
 *     的诱因 —— 同上及多项后续研究；双语者更常发生 —— Gollan & Silverberg 2001 等。
 *     文中写 Diary studies suggest … roughly once a week。把握中高。
 *   · 解释：「传递不足 / 连接变弱」假说（transmission deficit）—— 词义能取到、语音取不全，
 *     近期少用、年龄增长时连接变弱 —— Burke 等 1991。文中写 One plausible mechanism, favoured by many cognitive psychologists。
 *     把握高（是主流解释之一，文中没说是唯一解释）。
 *   · 词通常过后自己冒出来；听到与目标词同音开头的无关词（语音启动）能帮助化解 —— James & Burke
 *     2000 等。文中写 can also help, presumably because …。把握中高。
 *     不写：替代词到底是帮忙还是挡路（「blocker」假说有争议）、具体比例、累了会不会更多
 *     （周二第 1 题 NOT GIVEN 就考这个）、手语使用者的「指尖现象」。
 *
 * 新增三篇事实核对（按要求离线进行，未联网核验；只写有把握的通行事实，不虚构研究或统计）：
 *   · 邮政史：十九世纪前期英国邮资通常按距离及纸张数计算、常由收信人支付；Rowland Hill
 *     主张统一低邮资与预付；黑便士于 1840 年成为首枚黏贴式邮票；国内普通轻信预付一便士，
 *     不按距离收费；邮戳／墨印注销已用邮票——邮政史公认记载，把握高。
 *     邮路已在运行时多运一封信的成本较低，是 Hill 的成本分析，文中明确作为其论证转述；
 *     不写具体重量门槛、信量增幅、确切发行日期、拒收故事或单一发明造成所有变化的说法。
 *   · 松果：多种松树成熟球果鳞片依湿度可逆开合；相连层的吸湿膨胀差异导致弯曲，干燥时逆转；
 *     这一材料响应在球果脱落、种子释放后仍可存在；有翅种子下降减速、利于风传播——
 *     植物结构与仿生材料通行原理，把握高。保留 many pines / many pine seeds 限定，
 *     不推广到所有松树，不写开合速度、循环次数、具体树种或温度阈值。
 *     材料兼做检测与运动部件是设计原理示例，用 could；没有声称具体产品已部署或性能已实测。
 *   · 图像压缩：像素尺寸不决定文件大小；无损编码能精确重建原数值，有损编码会舍弃信息；
 *     色带与边缘痕迹可作为压缩失真的例子；放大和改存无损均不能恢复已舍弃的信息；
 *     反复有损编辑保存可能引入进一步变化——数字图像基础原理，把握高。
 *     用 may / can 限定表现；不写某格式必然压缩多少、所有软件如何处理，或设备速度排名。
 *
 * 校园内容安全：全文只涉及词语提取、邮政史、松果结构和数字图像；正文、题干、选项、答案与
 * rubric 已逐句过停推词表与敏感题材。判断题 NG 只问未提供的比较或实际行为，不以常识补答案。
 *
 * 徽章主题：2026-10-27 psychology · 10-28 history · 10-29 nature · 10-30 technology。
 */

'use strict';

const { buildAuthoredDay, plain } = require('../authored');
const { DATES } = require('./dates');

const LEVEL = 'ielts_light';

// ═══════════════════════════════════════════════════════════════
// 周二 —— 话到嘴边说不出来（psychology）
// ═══════════════════════════════════════════════════════════════

const TIP_OF_TONGUE = {
  key: 'original-w9-tip-of-tongue',
  title: 'A Word Just Out of Reach',
  passage: plain([
    'Almost everyone knows the frustrating feeling. You are trying to recall a familiar word, and although you are certain that you know it, it remains elusive. Psychologists call this a tip-of-the-tongue state, and it is so prevalent that many languages describe it with an expression involving the tongue.',
    'Although the experience was described as early as 1890, it was not studied systematically until the 1960s, when two American psychologists found a way to elicit it. They read out definitions of obscure words, such as a word for a small boat used in East Asian harbours, and asked students to name each word. Whenever a student was convinced the answer was close but could not produce it, they were asked what else they could report about it.',
    "The results were striking. Students in this state could often guess the first letter of the missing word and its number of syllables far more reliably than chance would allow. The alternative words that occurred to them were revealing, too. When the answer was 'sampan', some students thought of words that were phonetically similar, while others produced words for other kinds of boat. The target word, it seemed, had not been lost: its meaning and part of its sound were intact, but the rest remained inaccessible.",
    "Later research has refined the picture. Diary studies suggest that young adults experience the state roughly once a week, and more frequently with age. Names of people are notably the most common cause, and people who speak two languages report it more often. One plausible mechanism, favoured by many cognitive psychologists, is that the link between a word's meaning and its sound weakens when the word has not been used recently, so the meaning is retrieved while the sound is not.",
    'Fortunately, the missing word usually surfaces spontaneously once the person has stopped searching. Hearing an unrelated word that begins with the same sound can also assist retrieval, presumably because such cues strengthen the weakened link.',
  ]),
  questions: [
    {
      kind: 'tfng',
      item: 'People are more likely to experience a tip-of-the-tongue state when they are tired.',
      answer: 'NOT GIVEN',
    },
    {
      kind: 'tfng',
      item: 'The tip-of-the-tongue state was first described in the 1960s.',
      answer: 'FALSE',
      evidence:
        'Although the experience was described as early as 1890, it was not studied systematically until the 1960s, when two American psychologists found a way to elicit it.',
    },
    {
      kind: 'tfng',
      item: "The students' guesses about the first letter of the missing word were no better than random guesses.",
      answer: 'FALSE',
      evidence:
        'Students in this state could often guess the first letter of the missing word and its number of syllables far more reliably than chance would allow.',
    },
    {
      kind: 'gapChoice',
      stem: 'The state is so common that many languages describe it with an ______ involving the tongue.',
      answer: 'expression',
      distractors: ['experience', 'answer', 'explanation'],
      evidence:
        'Psychologists call this a tip-of-the-tongue state, and it is so prevalent that many languages describe it with an expression involving the tongue.',
    },
    {
      kind: 'gapChoice',
      stem: 'Students in the state could often guess the number of ______ in the missing word.',
      answer: 'syllables',
      distractors: ['letters', 'definitions', 'languages'],
      evidence:
        'Students in this state could often guess the first letter of the missing word and its number of syllables far more reliably than chance would allow.',
    },
    {
      kind: 'gapChoice',
      stem: "The link between a word's meaning and its sound weakens when the word has not been used ______.",
      answer: 'recently',
      distractors: ['reliably', 'spontaneously', 'systematically'],
      evidence:
        "One plausible mechanism, favoured by many cognitive psychologists, is that the link between a word's meaning and its sound weakens when the word has not been used recently, so the meaning is retrieved while the sound is not.",
    },
    {
      kind: 'gapTyped',
      summary: true,
      marks: 2,
      stem: "The alternative words that occurred to the students showed that the target word had not been lost, because ______.",
      answer:
        'some of those words sounded like the target word and others were close to it in meaning, so the students still had its meaning and part of its sound',
      evidence:
        "When the answer was 'sampan', some students thought of words that were phonetically similar, while others produced words for other kinds of boat. The target word, it seemed, had not been lost: its meaning and part of its sound were intact, but the rest remained inaccessible.",
      rubric:
        '两分：写出「冒出来的词有的发音和目标词相近、有的意思相近（是别的船的名字）」给 1 分（两类都要提到；只说一类不给这 1 分）；写出「说明学生还保留着这个词的意思和一部分声音（只是其余部分想不起来）」再给 1 分。写「学生其实已经想起来了」「学生说出了整个词」不给分 —— 原文说其余部分仍然想不起来。只写「因为学生很聪明」不给分。',
    },
    {
      kind: 'short',
      marks: 2,
      stem: 'Using your own words, explain why a person can know what a word means but still be unable to say it.',
      answer:
        'If a word has not been used for a while, the connection between what it means and how it sounds gets weaker. As a result, the person can find the meaning but not the sound of the word.',
      evidence:
        "One plausible mechanism, favoured by many cognitive psychologists, is that the link between a word's meaning and its sound weakens when the word has not been used recently, so the meaning is retrieved while the sound is not.",
      rubric:
        '两分：写出「一个词最近（很久）没用过，它的意思和发音之间的连接就会变弱」给 1 分（要提到「没用过」这个原因）；写出「所以能想起意思，却想不起它的声音（怎么念）」再给 1 分。写「因为年纪大了」「因为会说两种语言」不给分 —— 那是谁更容易碰上，不是为什么会卡住。',
    },
    {
      kind: 'short',
      marks: 1,
      stem: 'Apart from waiting, what can help a person to recall the missing word?',
      answer: 'Hearing an unrelated word that begins with the same sound.',
      evidence:
        'Hearing an unrelated word that begins with the same sound can also assist retrieval, presumably because such cues strengthen the weakened link.',
      rubric:
        '一分：答出「听到一个（无关的）、和要找的词开头发音相同的词」即给分；只写「听到一个开头声音一样的词」也给分。写「别再去想它」「过一会儿再想」不给分 —— 题目已经排除了等待。写「更努力地去想」「去查词典」不给分 —— 原文没这么说。',
    },
    {
      kind: 'short',
      marks: 2,
      stem: 'In the study from the 1960s, how did the researchers produce the tip-of-the-tongue state, and what did they ask students who were in it?',
      answer:
        'They read out the definitions of uncommon words and asked the students to name each word. When a student was sure the answer was close but could not say it, they asked what else the student could report about the word.',
      evidence:
        'Whenever a student was convinced the answer was close but could not produce it, they were asked what else they could report about it.',
      rubric:
        '两分：写出「念出生僻（不常见）词的释义，让学生说出是哪个词」给 1 分；写出「学生确信答案就在嘴边却说不出时，问他们关于这个词还能说出些什么」再给 1 分。写成「问他们首字母和音节数」也给第二分 —— 那是「还能说出什么」的具体内容。写「让学生看小船的图片」「让学生写日记」不给分 —— 原文没这么说，日记是后来的研究。',
    },
  ],
};

// ═══════════════════════════════════════════════════════════════
// 周三 —— 预付邮资改变寄信方式（history）
// ═══════════════════════════════════════════════════════════════

const PENNY_POST = {
  key: 'original-w9-penny-post',
  title: 'A Penny Before the Journey',
  passage: plain([
    'Before a British letter could be delivered in the early nineteenth century, somebody had to pay a charge that depended on its distance and number of sheets. Usually, that somebody was the recipient. An unexpected letter could therefore be an unwelcome expense, and a refusal to accept it meant that the postal service had carried it without receiving payment.',
    'The reformer Rowland Hill argued that this complicated arrangement misunderstood where the costs arose. Collecting, sorting and delivering letters accounted for much of the work; transporting one more letter along an existing route added relatively little. A uniform charge, he proposed, would reduce the calculations required for each item, making a cheaper service more practical. The proposal shifted attention from the distance an individual letter travelled to the organisation of the network that carried many letters together, making the shared system central to his reasoning.',
    'In 1840, Britain introduced the Penny Black, the world\'s first adhesive postage stamp. For an ordinary light letter sent within the country, a penny paid in advance covered the journey regardless of distance. The stamp was evidence that the sender had paid, rather than a ticket purchased by whoever eventually received the envelope. Payment could now be separated from delivery.',
    'Stamps also allowed people to buy the service before they actually needed it. Having purchased several, a writer could prepare a letter at home instead of arranging payment for every individual journey at a counter. Postal workers cancelled used stamps with ink marks, ensuring that a stamp already accepted as payment could not simply be used again.',
    'Correspondence expanded after the changes, although the stamp alone cannot explain that expansion. The lower charge and simpler procedures mattered alongside the small piece of paper. It neither carried letters faster nor taught people to read; its distinctive contribution was to make advance payment portable, visible and easy to check. Behind the familiar object lay a reorganisation of how a service was sold.',
  ]),
  questions: [
    {
      kind: 'tfng',
      item:
        'Under Hill\'s proposed scheme, working out the charge for an individual letter would require less calculation.',
      answer: 'TRUE',
      evidence:
        'The reformer Rowland Hill argued that this complicated arrangement misunderstood where the costs arose. Collecting, sorting and delivering letters accounted for much of the work; transporting one more letter along an existing route added relatively little. A uniform charge, he proposed, would reduce the calculations required for each item, making a cheaper service more practical.',
    },
    {
      kind: 'tfng',
      item:
        'A Penny Black on an ordinary light domestic letter indicated that its sender had already paid for the journey.',
      answer: 'TRUE',
      evidence:
        'In 1840, Britain introduced the Penny Black, the world\'s first adhesive postage stamp. For an ordinary light letter sent within the country, a penny paid in advance covered the journey regardless of distance. The stamp was evidence that the sender had paid, rather than a ticket purchased by whoever eventually received the envelope. Payment could now be separated from delivery.',
    },
    {
      kind: 'tfng',
      item: 'The author attributes the expansion of correspondence entirely to the stamp itself.',
      answer: 'FALSE',
      evidence: 'Correspondence expanded after the changes, although the stamp alone cannot explain that expansion.',
    },
    {
      kind: 'gapChoice',
      stem: 'Hill proposed a uniform ______ to reduce the calculations required for each item.',
      answer: 'charge',
      distractors: ['recipient', 'route', 'envelope'],
      evidence:
        'A uniform charge, he proposed, would reduce the calculations required for each item, making a cheaper service more practical.',
    },
    {
      kind: 'gapChoice',
      stem: 'The stamp served as ______ that the sender had already paid.',
      answer: 'evidence',
      distractors: ['refusal', 'expense', 'correspondence'],
      evidence:
        'The stamp was evidence that the sender had paid, rather than a ticket purchased by whoever eventually received the envelope.',
    },
    {
      kind: 'gapChoice',
      stem: 'To prevent reuse, postal workers ______ used stamps with ink marks.',
      answer: 'cancelled',
      distractors: ['purchased', 'delivered', 'received'],
      evidence:
        'Postal workers cancelled used stamps with ink marks, ensuring that a stamp already accepted as payment could not simply be used again.',
    },
    {
      kind: 'gapTyped',
      summary: true,
      marks: 2,
      stem: 'Hill considered a cheaper postal service practical because ______.',
      answer:
        'carrying an extra letter on an existing route added relatively little to the cost, and a uniform charge reduced the calculations needed for each letter',
      evidence:
        'The reformer Rowland Hill argued that this complicated arrangement misunderstood where the costs arose. Collecting, sorting and delivering letters accounted for much of the work; transporting one more letter along an existing route added relatively little. A uniform charge, he proposed, would reduce the calculations required for each item, making a cheaper service more practical. The proposal shifted attention from the distance an individual letter travelled to the organisation of the network that carried many letters together, making the shared system central to his reasoning.',
      rubric:
        '两分：写出「在已有路线中多运一封信，增加的成本相对很少」给 1 分；写出「统一收费减少了每封信所需的计费计算」再给 1 分。合理同义改写也给分。只写「信件一起运送」而没说明增量成本低，不给第一分；只写「邮票小、容易携带」「收信人不付钱」不给分——没有解释 Hill 对成本和计费工作的分析。',
    },
    {
      kind: 'short',
      marks: 2,
      stem:
        'Using your own words, explain TWO ways in which stamps made paying for postage more convenient for a writer who had bought several.',
      answer:
        'The writer could buy postage before a particular letter needed to be sent, and could then prepare that letter at home rather than arrange payment for each journey at a counter.',
      evidence:
        'Stamps also allowed people to buy the service before they actually needed it. Having purchased several, a writer could prepare a letter at home instead of arranging payment for every individual journey at a counter.',
      rubric:
        '两分：写出「可以先买好邮资／邮票，留待以后需要寄信时用」给 1 分；写出「之后能在家备好信，不必每寄一封都到柜台安排付费」再给 1 分。合理同义改写也给分；第二点答「不用每封信都在柜台缴费」也可。只写「更便宜」「信送得更快」不给分——前者不是本段所说的便利，后者被结尾排除。两点整句照抄原文最多给 1 分。',
    },
    {
      kind: 'short',
      marks: 1,
      stem: 'Why could a recipient\'s refusal to accept a letter leave the postal service unpaid?',
      answer:
        'Because the recipient was usually the person expected to pay, so refusing the letter meant that payment was not collected.',
      evidence:
        'Before a British letter could be delivered in the early nineteenth century, somebody had to pay a charge that depended on its distance and number of sheets. Usually, that somebody was the recipient. An unexpected letter could therefore be an unwelcome expense, and a refusal to accept it meant that the postal service had carried it without receiving payment.',
      rubric: '一分：答出「通常应由收信人付费，收信人拒收就收不到这笔钱」即给分；合理同义改写也给分。只写「寄信太贵」「邮路太长」不给分——没有说明拒收与未收款的关系。',
    },
    {
      kind: 'short',
      marks: 2,
      stem: 'What TWO changes, besides the stamp itself, does the author link to the expansion of correspondence?',
      answer: 'The lower charge and simpler procedures.',
      evidence:
        'Correspondence expanded after the changes, although the stamp alone cannot explain that expansion. The lower charge and simpler procedures mattered alongside the small piece of paper.',
      rubric:
        '两分：①邮资更低／寄信费用减少；②手续更简单／办事程序简化——每项 1 分，合理同义改写也给分。只写「有了邮票」不给分，题目已排除邮票本身；写「送信更快」「人人都学会读写」不给分——结尾明确没有把这些归功于邮票。',
    },
  ],
};

// ═══════════════════════════════════════════════════════════════
// 周四 —— 松果的湿度响应结构（nature）
// ═══════════════════════════════════════════════════════════════

const PINE_CONES = {
  key: 'original-w9-pine-cone-scales',
  title: 'A Cone That Moves Without Growing',
  passage: plain([
    'A mature pine cone brought indoors may look as fixed as a piece of furniture. Leave it in a dry room, however, and its overlapping scales can gradually spread apart. When dampened, they close again. In many pines, this reversible movement regulates seed dispersal, even though the tissues responsible are no longer living.',
    'The explanation lies in the structure of each scale. Its layers absorb moisture and swell unequally. Because they remain attached to one another, this differential expansion bends the whole scale, closing the cone in damp conditions. As the material dries, contraction reverses the deformation and the scales move outwards. This passive mechanism requires no signal from the tree.',
    'This timing has a practical advantage. Many pine seeds have a thin wing, which slows their descent and allows air currents to carry them away. In wet conditions, their wings become damp and dispersal is less effective. Keeping the scales closed retains the seeds until conditions become more favourable, although an open cone does not guarantee a strong breeze.',
    'The movement can persist after a cone has been detached from its branch, and even after its seeds have gone. An empty cone still contains the layered material that responds to humidity. Its continued responsiveness reflects persistent structural asymmetry, rather than ongoing biological activity. No new growth is needed for this mechanism to function. An object can therefore respond to its surroundings without sensing them as an animal does. Visible movement alone is insufficient evidence of a living process.',
    'For designers, this offers an alternative to devices in which a sensor first detects a change and a motor then produces movement. A suitably arranged material could perform both roles, adjusting its shape as moisture changes without an external power supply. Such designs would still need to suit their intended surroundings: a response to humidity would be inappropriate where movement was required only at a particular temperature. The relevant environmental change must match the purpose of the device.',
  ]),
  questions: [
    {
      kind: 'tfng',
      item: 'A cone detached from its branch opens and closes faster than one still attached to the tree.',
      answer: 'NOT GIVEN',
      explanation: '原文说离开树枝后的松果仍能开合，但没有比较脱落与仍在树上的松果的开合速度，因此选 NOT GIVEN。',
    },
    {
      kind: 'tfng',
      item: 'The scales can open even when there is no strong breeze.',
      answer: 'TRUE',
      evidence:
        'Keeping the scales closed retains the seeds until conditions become more favourable, although an open cone does not guarantee a strong breeze.',
    },
    {
      kind: 'tfng',
      item: 'An empty cone can continue reacting to moisture after it has left the tree.',
      answer: 'TRUE',
      evidence:
        'The movement can persist after a cone has been detached from its branch, and even after its seeds have gone. An empty cone still contains the layered material that responds to humidity.',
    },
    {
      kind: 'gapChoice',
      stem: 'In many pines, the reversible movement of scales ______ seed dispersal.',
      answer: 'regulates',
      distractors: ['detects', 'retains', 'contains'],
      evidence:
        'In many pines, this reversible movement regulates seed dispersal, even though the tissues responsible are no longer living.',
    },
    {
      kind: 'gapChoice',
      stem: 'A damp scale bends because its attached layers undergo differential ______.',
      answer: 'expansion',
      distractors: ['descent', 'dispersal', 'humidity'],
      evidence:
        'Its layers absorb moisture and swell unequally. Because they remain attached to one another, this differential expansion bends the whole scale, closing the cone in damp conditions.',
    },
    {
      kind: 'gapChoice',
      stem: 'The layered material remaining in an empty cone responds to ______.',
      answer: 'humidity',
      distractors: ['temperature', 'currents', 'growth'],
      evidence: 'An empty cone still contains the layered material that responds to humidity.',
    },
    {
      kind: 'gapTyped',
      summary: true,
      marks: 2,
      stem: 'Changes in moisture move a cone\'s scales because ______.',
      answer:
        'the attached layers expand unequally as they absorb moisture, bending the scales closed, while drying reverses the change and moves them outwards',
      evidence:
        'The explanation lies in the structure of each scale. Its layers absorb moisture and swell unequally. Because they remain attached to one another, this differential expansion bends the whole scale, closing the cone in damp conditions. As the material dries, contraction reverses the deformation and the scales move outwards. This passive mechanism requires no signal from the tree.',
      rubric:
        '两分：写出「吸水后相连的各层膨胀程度不同，使鳞片弯曲闭合」给 1 分（要有不等量膨胀和闭合的关系）；写出「干燥时收缩使变化逆转，鳞片向外张开」再给 1 分。合理同义改写也给分。只写「湿了就关、干了就开」而没有说明材料形变的原因，最多给第二点的 1 分；写「树发出指令」「鳞片重新长大」不给分。',
    },
    {
      kind: 'short',
      marks: 2,
      stem: 'Using your own words, explain why the author compares a responsive material with a sensor and a motor.',
      answer:
        'In an ordinary device, one part detects the change and another makes the movement. The material can do both jobs itself by changing shape with moisture, without an outside power source.',
      evidence:
        'For designers, this offers an alternative to devices in which a sensor first detects a change and a motor then produces movement. A suitably arranged material could perform both roles, adjusting its shape as moisture changes without an external power supply.',
      rubric:
        '两分：写出「通常的装置由传感部分发现环境变化，再由马达产生运动」给 1 分（须分清检测和运动两种作用）；写出「合适的材料本身能随湿度改变形状，同时完成两种作用，不需外部电源」再给 1 分。合理同义改写也给分。只写「它们都会动」不给分；写「松果里装有传感器和马达」不给分。两点整句照抄原文最多给 1 分。',
    },
    {
      kind: 'short',
      marks: 1,
      stem: 'What does the thin wing do to a pine seed as it falls?',
      answer: 'It slows the seed\'s descent.',
      evidence: 'Many pine seeds have a thin wing, which slows their descent and allows air currents to carry them away.',
      rubric: '一分：答出「减慢种子下落速度／让种子落得更慢」即给分；合理同义改写也给分。只写「让种子变轻」「令种子向上飞」不给分——原文没有这样说；只写「接触水分」不给分。',
    },
    {
      kind: 'short',
      marks: 2,
      stem: 'How do the seed\'s wing and the cone\'s response to damp conditions each help dispersal?',
      answer:
        'The wing slows the seed\'s fall so air currents can carry it away. Closing the cone in damp conditions keeps the seeds inside until conditions for dispersal improve.',
      evidence:
        'This timing has a practical advantage. Many pine seeds have a thin wing, which slows their descent and allows air currents to carry them away. In wet conditions, their wings become damp and dispersal is less effective. Keeping the scales closed retains the seeds until conditions become more favourable, although an open cone does not guarantee a strong breeze.',
      rubric:
        '两分：写出「薄翅减慢下落，使气流能带走种子」给 1 分；写出「潮湿时松果闭合留住种子，等更利于传播的条件」再给 1 分。合理同义改写也给分；第二点答「湿翅传播效果差，所以先把种子留在里面」也给分。只写「鳞片吸水膨胀」不给分——这是开合原理，没有回答怎样帮助传播；写「一打开就一定有强风」不给分。',
    },
  ],
};

// ═══════════════════════════════════════════════════════════════
// 周五 —— 图片压缩与信息取舍（technology）
// ═══════════════════════════════════════════════════════════════

const IMAGE_COMPRESSION = {
  key: 'original-w9-image-compression',
  title: 'What a Smaller Picture Leaves Out',
  passage: plain([
    'Two photographs can occupy exactly the same area on a screen while requiring very different amounts of storage. Reducing a file does not necessarily mean reducing its width or height. A digital picture consists of tiny units called pixels, whose colours are described by numbers. Compression changes how that information is represented, allowing fewer stored symbols to describe the image.',
    'One approach preserves all the original information. Instead of recording the same colour separately for every pixel in a large uniform area, a program can use a shorter description that exploits this redundancy. When the file is opened, the original values are reconstructed exactly. This is called lossless compression, although the savings depend on how much predictable structure the image contains.',
    'Photographs full of subtle variations are harder to shorten in this way. Lossy compression therefore accepts a different compromise: some information is discarded. Similar shades may be represented as the same colour, or fine variations may be simplified. Because viewers do not notice every detail equally, a carefully chosen reduction can produce a substantial saving without an obvious difference at normal viewing size. This approximation is irreversible: once differences have been removed, the smaller file no longer contains evidence of their original values.',
    'The compromise becomes apparent when compression is pushed further. A smooth sky may acquire visible bands, and edges may be surrounded by irregular marks. These distortions are known as compression artefacts. Enlarging the picture can reveal these changes, but it cannot restore the discarded information. Saving a damaged copy in a lossless format will preserve that copy faithfully; it will not recover the original photograph.',
    'This distinction matters when choosing what to keep. A small copy may be adequate for a quick preview, while an original allows more freedom for later editing. Repeatedly editing and saving a picture with lossy compression can introduce further changes. Keeping an original separately therefore preserves future options, even when the version shared today appears perfectly acceptable on a small display.',
  ]),
  questions: [
    {
      kind: 'tfng',
      item: 'Saving a lossy copy in a lossless format restores the information removed earlier.',
      answer: 'FALSE',
      evidence:
        'Saving a damaged copy in a lossless format will preserve that copy faithfully; it will not recover the original photograph.',
    },
    {
      kind: 'tfng',
      item: 'Compressing a photograph of the same scene takes longer on a phone than on a computer.',
      answer: 'NOT GIVEN',
      explanation: '原文讨论存储量、压缩方法和图像变化，没有比较手机与电脑完成压缩的速度，因此选 NOT GIVEN。',
    },
    {
      kind: 'tfng',
      item: 'Most people keep an original version of every photograph they share.',
      answer: 'NOT GIVEN',
      explanation: '结尾解释单独保留原图的好处，但没有提供大多数人实际是否这样做的信息；建议和用途不能当成行为调查，因此选 NOT GIVEN。',
    },
    {
      kind: 'gapChoice',
      stem: 'The tiny units of a digital picture whose colours are described by numbers are called ______.',
      answer: 'pixels',
      distractors: ['symbols', 'values', 'bands'],
      evidence:
        'A digital picture consists of tiny units called pixels, whose colours are described by numbers.',
    },
    {
      kind: 'gapChoice',
      stem:
        'A lossless program can exploit ______ instead of recording an identical colour separately for every pixel.',
      answer: 'redundancy',
      distractors: ['compromise', 'storage', 'distinction'],
      evidence:
        'Instead of recording the same colour separately for every pixel in a large uniform area, a program can use a shorter description that exploits this redundancy.',
    },
    {
      kind: 'gapChoice',
      stem: 'Visible bands and irregular marks caused by compression are called compression ______.',
      answer: 'artefacts',
      distractors: ['values', 'symbols', 'pixels'],
      evidence:
        'A smooth sky may acquire visible bands, and edges may be surrounded by irregular marks. These distortions are known as compression artefacts.',
    },
    {
      kind: 'gapTyped',
      summary: true,
      marks: 2,
      stem: 'Lossless and lossy compression differ in that ______.',
      answer:
        'lossless compression allows the original values to be reconstructed exactly, whereas lossy compression discards some information so those values cannot all be recovered from that file',
      evidence:
        'One approach preserves all the original information. Instead of recording the same colour separately for every pixel in a large uniform area, a program can use a shorter description that exploits this redundancy. When the file is opened, the original values are reconstructed exactly. This is called lossless compression, although the savings depend on how much predictable structure the image contains.\n\nPhotographs full of subtle variations are harder to shorten in this way. Lossy compression therefore accepts a different compromise: some information is discarded. Similar shades may be represented as the same colour, or fine variations may be simplified. Because viewers do not notice every detail equally, a carefully chosen reduction can produce a substantial saving without an obvious difference at normal viewing size. This approximation is irreversible: once differences have been removed, the smaller file no longer contains evidence of their original values.',
      rubric:
        '两分：写出「无损压缩保留全部原始信息，能精确重建原来的数值」给 1 分；写出「有损压缩舍弃部分信息，不能仅靠压缩文件完全恢复原始数值」再给 1 分。合理同义改写也给分。只把两者写成「文件大小不同」不给分；写「无损不压缩」「有损一定减少像素数量」不给分——前者仍压缩，后者并非必要。',
    },
    {
      kind: 'short',
      marks: 2,
      stem:
        'Using your own words, explain why a photograph saved with lossy compression may appear unchanged at normal viewing size but look different when enlarged.',
      answer:
        'Compression can remove details that viewers hardly notice at an ordinary size. Enlargement can make the resulting bands and marks visible, although the missing information is still absent.',
      evidence:
        'Photographs full of subtle variations are harder to shorten in this way. Lossy compression therefore accepts a different compromise: some information is discarded. Similar shades may be represented as the same colour, or fine variations may be simplified. Because viewers do not notice every detail equally, a carefully chosen reduction can produce a substantial saving without an obvious difference at normal viewing size. This approximation is irreversible: once differences have been removed, the smaller file no longer contains evidence of their original values.\n\nThe compromise becomes apparent when compression is pushed further. A smooth sky may acquire visible bands, and edges may be surrounded by irregular marks. These distortions are known as compression artefacts. Enlarging the picture can reveal these changes, but it cannot restore the discarded information. Saving a damaged copy in a lossless format will preserve that copy faithfully; it will not recover the original photograph.',
      rubric:
        '两分：写出「有些被简化／删除的细节在通常观看大小下不易被人察觉」给 1 分；写出「放大后可能看出压缩造成的色带或不规则痕迹」再给 1 分。第二点答「放大显露之前不明显的压缩失真」也可，合理同义改写也给分。只写「屏幕更大了」不给分；写「放大就能找回被删的信息」不给第二分。两点整句照抄原文最多给 1 分。',
    },
    {
      kind: 'short',
      marks: 1,
      stem: 'What does \'that copy\' refer to in the fourth paragraph?',
      answer: 'The already damaged copy being saved in a lossless format.',
      evidence:
        'Saving a damaged copy in a lossless format will preserve that copy faithfully; it will not recover the original photograph.',
      rubric: '一分：答出「已经有损／受损、随后以无损格式保存的那份副本」即给分；合理同义改写也给分。只写「一张图片」不给分——没有锁定所指对象；写「未受损的原图」「重新恢复的原图」不给分。',
    },
    {
      kind: 'short',
      marks: 2,
      stem: 'What TWO reasons does the writer give for keeping an original separately from a shared copy?',
      answer:
        'It leaves more freedom for later editing and protects the original information from further changes that repeated lossy editing and saving can introduce.',
      evidence:
        'This distinction matters when choosing what to keep. A small copy may be adequate for a quick preview, while an original allows more freedom for later editing. Repeatedly editing and saving a picture with lossy compression can introduce further changes. Keeping an original separately therefore preserves future options, even when the version shared today appears perfectly acceptable on a small display.',
      rubric:
        '两分：写出「给以后的编辑保留更多余地／选项」给 1 分；写出「避免反复有损编辑保存所带来的进一步变化，保住原始信息」再给 1 分。合理同义改写也给分；第二点答「有损副本越改越可能失真，因此另留原图」也可。只重复「以后还有选择」不给两分；写「原图一定占空间最少」「无损能把以前删掉的信息找回来」不给分。',
    },
  ],
};

// 周二那篇（10-27 未发）挪到下周一 11-02，所以排在最后（叶老师 10-27 晚）。
const SPECS = [PENNY_POST, PINE_CONES, IMAGE_COMPRESSION, TIP_OF_TONGUE];

module.exports = {
  LEVEL,
  SPECS,
  DAYS: DATES.slice(0, SPECS.length).map((date, i) => buildAuthoredDay(SPECS[i], date)),
};
