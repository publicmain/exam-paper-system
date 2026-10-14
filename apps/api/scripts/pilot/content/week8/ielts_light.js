/**
 * 第八周 —— **ielts_light（雅思轻量）**档，全原创说明文。
 *
 * 两三百词、五段，不编号。形状与第四到七周这一档一致：
 *   3 道判断 · 3 道填空转四选一 · 1 道两分概括填空 · 3 道主观题（2/1/2 分）—— 满分 13。
 * 每篇至少一道「Using your own words」。
 *
 * 本周选题（按主编分配的五个领域各一篇；括号里是徽章主题）：
 *   周一 nature      林蛙冬天把自己冻住、开春再活过来（Frozen Until Spring）
 *                    —— 林蛙在落叶下过冬，身体里多达三分之二的水结冰、心跳呼吸停止；
 *                       肝脏往血里放糖、糖进细胞像防冻液，冰只结在细胞外面；开春化冻复苏；
 *                       研究者希望借此延长移植器官的保存时间。
 *   周二 technology  手机触屏为什么隔着手套不灵（Why Your Phone Ignores Your Gloves）
 *                    —— 老式触屏靠按压两层接触；现在的电容屏靠手指导电、带走网格上的一点电荷；
 *                       所以毛线 / 皮手套、指甲、普通塑料笔都不行，专用手套和触控笔指尖导电；
 *                       能同时感到几根手指（两指放大），雨水也会改变电荷、造成误触。
 *   周三 history     奥的斯的安全电梯（A Lift You Could Trust）
 *                    —— 1850 年代前的升降平台绳断就掉；奥的斯在平台上装弹簧，绳断弹簧松开、
 *                       把卡子顶进导轨上的齿；1854 年在纽约展会上当众砍绳；1857 年第一部装
 *                       安全装置的载客电梯进了纽约一家五层商店；电梯让楼越盖越高、顶层由冷变热。
 *   周四 health      吃冰太快为什么脑门疼（Too Cold, Too Fast）
 *                    —— 冷东西碰上颚，那里的血管先收缩再猛地扩张；神经也管额头，大脑分不清
 *                       信号来源，疼在额头；2012 年美国研究让志愿者用吸管顶着上颚喝冰水、
 *                       超声测脑血流：疼起来时前脑一条血管血流猛增、血管收回去疼就停；
 *                       舌头顶上颚、喝口温水能止，慢慢吃能防。
 *   周五 psychology  斯特鲁普效应（Say the Colour, Not the Word）
 *                    —— 用绿墨水写 RED、让人说墨水颜色，人会卡一下；1880 年代就有人发现读词比
 *                       说颜色快；Stroop 1935 年的两组对比实验：读词时墨色几乎没影响，说墨色时
 *                       比说色块慢得多；解释是熟练读者读词是自动的、词义来捣乱；还不识字的孩子
 *                       几乎不受影响；现在用来研究注意力（如脑损伤病人）。
 *
 * 查重：在 week2~week7 内容包、test-fixtures、pack-titles-1014 / read-titles-1014 两份标题表里
 * 搜过 wood frog / frozen / antifreeze / touchscreen / capacitive / Otis / elevator / lift 安全 /
 * brain freeze / ice cream headache / Stroop：没有同题。旁及的已有篇目 ——
 * 「A Burn Without a Flame」（辣椒骗过热感受器）也讲「神经骗大脑」，但周四讲的是血管和牵涉痛，
 * 不提感受器；「Looking Without Seeing」（隐形大猩猩，注意力过滤）和周五同属注意力，但那篇讲
 * 「没看见」，这篇讲「自动读词干扰」，实验与结论都不同；「Why We Yawn」「Why Ears Pop」是另外的
 * 身体现象；「The Frog at MacRitchie」是故事，不讲林蛙；「Keeping Time by Rail」与电梯无关。
 * 周二、周三都和「从前 / 现在」对比，但一个讲原理、一个讲来历，骨架不同。
 *
 * 判断题全周：周一 F / T / NG · 周二 T / NG / F · 周三 NG / T / T · 周四 F / NG / F · 周五 NG / T / F
 *   → TRUE 5 · FALSE 5 · NOT GIVEN 5。三天「各一」、两天不是；单天不全一样；
 *   NOT GIVEN 在第一位两次、第二位两次、第三位一次。
 * 选词题每道至少一个干扰项是「原文出现过、放这里不对」的词。
 *
 * 事实只写有把握的，拿不准的年份、数字、人名一律不写：
 *   · 林蛙（wood frog）—— 分布到阿拉斯加和加拿大北部（北美最北的两栖类）；冬天不钻深土、
 *     不沉塘底，就在林地落叶下的浅坑里过冬，气温到零下就冻住；冰从皮肤开始往里长；心跳、
 *     呼吸停止；冰只结在细胞外（体腔、皮下、器官周围），细胞内不结冰；一碰到冰，肝脏就把储存的
 *     糖原转成葡萄糖大量放进血液，葡萄糖进细胞起防冻作用 —— Wikipedia「Wood frog」、
 *     Storey & Storey（Carleton University）的综述与科普介绍。把握高。
 *     「多达三分之二的体内水结冰」：各处写 up to 65% / about two-thirds / 70%，
 *     文中写 as much as two-thirds，落在通行说法里。把握中高。
 *     开春化冻后心跳、呼吸恢复，去水塘产卵；林蛙是春天最早产卵的蛙之一，有时水面还有冰 ——
 *     Wikipedia 同条、多家自然保护机构的物种介绍。把握高。
 *     研究始于 1980 年代初（Schmid 1982 Science、Storey 1984）；研究者希望借此改进器官冷冻保存，
 *     移植器官离体只能保存有限时间 —— Storey 实验室介绍、医学常识。文中用 hope / could one day。
 *     不写：化冻要几小时、最低能扛多少度、冻多少天（阿拉斯加种群数据只见一项研究）、尿素、
 *     林蛙秋天吃不吃得多（周一第 3 题 NOT GIVEN 就考这个）。
 *   · 触屏 —— 老式电阻屏：两层之间有极小的空隙，按下去上层碰到下层、算出位置，笔、指甲、戴手套
 *     都能用，但要按下去；现在手机平板多用电容屏：玻璃下是透明导电材料（ITO）排成的网格，带着
 *     微弱电荷 / 电场；人体含大量盐水、导电，手指靠近会带走一点电荷，控制器每秒扫描多次、找到
 *     变化的位置；能同时感到多点（两指缩放）；毛线、皮革、指甲、普通塑料笔不导电所以不灵；
 *     触屏手套指尖织进导电线，电容笔笔尖是导电材料；水滴也会改变网格上的电荷、造成误触 ——
 *     Wikipedia「Touchscreen」「Capacitive sensing」「Resistive touchscreen」、Explain That Stuff
 *     「Touchscreens」。物理常识，把握高。
 *     不写：电容屏的发明人和年份、具体扫描频率、香肠能不能点屏、贴膜、触屏手套的价格（周二第 2 题
 *     NOT GIVEN）。
 *   · 奥的斯安全电梯 —— 1850 年代以前工厂、仓库、矿井就有吊绳升降的货运平台，绳断即坠，没人敢坐；
 *     Elisha Otis（美国机械工）1852 年前后在纽约州 Yonkers 的工厂设计安全装置：平台顶上装一片
 *     钢板弹簧（wagon spring），吊绳拉着它；绳一断弹簧松开，把两侧的卡子（pawl）顶进导轨上的
 *     齿条，平台立刻卡住 —— Wikipedia「Elisha Otis」「Elevator」。把握高。
 *     1854 年纽约水晶宫展会（Exhibition of the Industry of All Nations）站在高处平台上让人砍断
 *     吊绳，平台只掉了几英寸就停住；「All safe, gentlemen, all safe」是流传的说法（文中写
 *     is said to have）—— 同上、Otis 公司史。把握高（年份有写 1853 的，主流写 1854）。
 *     1857 年纽约百老汇 E.V. Haughwout 大楼（五层商店）装了第一部带安全装置的载客电梯（文中不写
 *     楼名和街名）；Otis 1861 年去世，儿子 Charles、Norton 接手 —— 同上。把握高。
 *     电梯出现前多数楼只有五六层、顶层最不受欢迎，之后楼越盖越高、顶层变成最抢手 —— 建筑史通行
 *     说法（Smithsonian、多家建筑史读物），文中写 few … more than five or six、some of the most
 *     desired。把握中高。现代电梯仍有限速器触发的安全钳卡导轨 —— 电梯常识。把握高。
 *     不写：工厂名、展会全名、平台升到多高、砍绳用的是斧还是刀、电动电梯（周三第 1 题 NOT GIVEN）。
 *   · 冰激凌头痛 —— 冷东西碰到上颚或喉咙后部引起额头突发锐痛，一般一两分钟内自己消失，无害；
 *     通行解释：局部血管先收缩、再为了回暖迅速扩张，变化被三叉神经接收，这条神经也管额头面部，
 *     大脑把疼「放」到额头（牵涉痛）—— Cleveland Clinic「Brain Freeze」、Wikipedia
 *     「Cold-stimulus headache」。文中写 Many researchers believe。把握高。
 *     2012 年 Serrador 等（Harvard Medical School / 美国退伍军人事务部）在 Experimental Biology
 *     年会报告：13 名健康成人用吸管顶着上颚喝冰水，经颅多普勒超声测脑血流，疼起来时大脑前动脉
 *     血流骤增，动脉一收缩疼就消退；推测颅骨空间封闭、血流涌入使颅内压升高致痛，希望帮助理解
 *     偏头痛等头痛 —— FASEB / Experimental Biology 2012 新闻稿、多家媒体报道。把握中高
 *     （会议报告，文中写 a small group of adult volunteers，不写人数和人名；用 suggested / may）。
 *     舌头顶上颚、喝口温水止痛，慢慢吃预防 —— Cleveland Clinic 同条。把握高。
 *     不写：医学全名（太长且超纲）、2002 年 BMJ 学生吃冰激凌试验的具体比例、偏头痛患者更容易
 *     犯不犯、天热是不是更容易犯（周四第 2 题 NOT GIVEN）。
 *   · 斯特鲁普效应 —— J. Ridley Stroop 1935 年《Journal of Experimental Psychology》
 *     「Studies of interference in serial verbal reactions」：实验一，读颜色词（印成冲突的颜色）
 *     与读黑字比，几乎没差别；实验二，说冲突颜色词的墨水颜色与说色块的颜色比，慢得多（约慢 74%，
 *     文中只写 far longer）—— Wikipedia「Stroop effect」、MacLeod 1991 综述。把握高。
 *     Cattell 1886 年就发现读词比说出颜色 / 物体名称快 —— 同上（文中写 as early as the 1880s，
 *     不写人名）。把握高。
 *     「熟练读者读词是自动的」是通行解释（automaticity），文中写 The usual explanation；
 *     还不会读书的孩子不受词义干扰 —— 发展研究与逻辑都成立，文中写 hardly affected。把握高。
 *     临床和研究用各种版本测注意力 / 执行功能，包括脑外伤病人 —— 同上。把握高。
 *     不写：「实验二用的是色块还是卍字」（文中写 simple coloured shapes，两种都对得上）、
 *     练习能不能消除干扰、情绪 Stroop、Stroop 用没用别的语言（周五第 1 题 NOT GIVEN）。
 */

'use strict';

const { buildAuthoredDay, plain } = require('../authored');
const { DATES } = require('./dates');

const LEVEL = 'ielts_light';

// ═══════════════════════════════════════════════════════════════
// 周一 —— 林蛙冬天把自己冻住（nature）
// ═══════════════════════════════════════════════════════════════

const WOOD_FROG = {
  key: 'original-w8-wood-frog',
  title: 'Frozen Until Spring',
  passage: plain([
    'Winter in the forests of Alaska and northern Canada is long and very cold. Many frogs survive it deep in the ground or at the bottom of ponds, where the water does not freeze solid. The wood frog does something much stranger. It settles into a shallow hole under fallen leaves on the forest floor, and when the temperature drops below zero, it freezes.',
    "Ice first forms on the frog's skin and then slowly spreads into its body. In the end, as much as two-thirds of the water in its body can turn to ice. Its heart stops beating, and it stops breathing. Anyone who picked it up would find it hard and cold, and would almost certainly think it was dead.",
    "For most animals, this would be the end. When the water inside the body's tiny cells freezes, sharp ice crystals can tear the cells apart. The wood frog prevents this. As soon as ice begins to form on its skin, its liver starts to pour sugar into the blood. The sugar enters the cells and works rather like antifreeze, stopping the water inside them from freezing. The ice forms only in the spaces between the cells, such as under the skin and around the organs.",
    "When spring comes and the ice melts, the frog's heart starts to beat again and it begins to breathe. Soon it is hopping off to a pond to breed. Wood frogs are among the first frogs to lay their eggs each year, sometimes while there is still ice on the water.",
    'Scientists have studied the wood frog since the 1980s, partly because of what it might teach us. A human heart or kidney given for a transplant can be kept outside the body for only a limited time, and freezing it would destroy its cells. Some researchers hope that the wood frog could one day help doctors to store organs for much longer.',
  ]),
  questions: [
    {
      kind: 'tfng',
      item: 'The wood frog spends the winter at the bottom of a pond.',
      answer: 'FALSE',
      evidence:
        'It settles into a shallow hole under fallen leaves on the forest floor, and when the temperature drops below zero, it freezes.',
    },
    {
      kind: 'tfng',
      item: "Ice forms on the frog's skin before it spreads into the rest of its body.",
      answer: 'TRUE',
      evidence: "Ice first forms on the frog's skin and then slowly spreads into its body.",
    },
    {
      kind: 'tfng',
      item: 'Wood frogs eat more than usual in the autumn to prepare for winter.',
      answer: 'NOT GIVEN',
    },
    {
      kind: 'gapChoice',
      stem: 'The wood frog spends the winter in a shallow hole under fallen ______.',
      answer: 'leaves',
      distractors: ['crystals', 'stones', 'branches'],
      evidence:
        'It settles into a shallow hole under fallen leaves on the forest floor, and when the temperature drops below zero, it freezes.',
    },
    {
      kind: 'gapChoice',
      stem: 'As much as two-thirds of the water in the frog\'s body can turn to ______.',
      answer: 'ice',
      distractors: ['sugar', 'blood', 'stone'],
      evidence: 'In the end, as much as two-thirds of the water in its body can turn to ice.',
    },
    {
      kind: 'gapChoice',
      stem: 'Wood frogs are among the first frogs to lay their ______ each year.',
      answer: 'eggs',
      distractors: ['cells', 'organs', 'leaves'],
      evidence: 'Wood frogs are among the first frogs to lay their eggs each year, sometimes while there is still ice on the water.',
    },
    {
      kind: 'gapTyped',
      summary: true,
      marks: 2,
      stem: "The sugar from the frog's liver protects the frog because ______.",
      answer: 'it enters the cells and stops the water inside them from freezing, so the ice forms only in the spaces between the cells',
      evidence:
        'The sugar enters the cells and works rather like antifreeze, stopping the water inside them from freezing. The ice forms only in the spaces between the cells, such as under the skin and around the organs.',
      rubric:
        '两分：写出「糖进入细胞，让细胞里面的水不结冰（像防冻液一样）」给 1 分；写出「冰只结在细胞之间的空隙里（如皮下、器官周围）」再给 1 分。写成「细胞里不结冰、冰都在细胞外面」也给满分。写「糖给青蛙提供能量」「糖让青蛙暖和起来」不给分 —— 原文没这么说。',
    },
    {
      kind: 'short',
      marks: 2,
      stem: 'Using your own words, explain why some researchers are interested in the wood frog.',
      answer:
        'An organ given for a transplant can only stay outside the body for a short time, and freezing it would kill its cells. The researchers hope that the frog might one day show doctors how to keep organs for much longer.',
      evidence:
        'A human heart or kidney given for a transplant can be kept outside the body for only a limited time, and freezing it would destroy its cells.',
      rubric:
        '两分：写出「用来移植的器官（如心脏、肾）离开人体后只能保存有限的时间，冷冻又会毁掉细胞」给 1 分；写出「研究者希望林蛙有一天能帮医生把器官保存得久得多」再给 1 分。只写「因为林蛙很特别」「因为它能冻住」不给分 —— 没说出它对人有什么用。整句照抄原文只给 1 分。',
    },
    {
      kind: 'short',
      marks: 1,
      stem: 'Where does the wood frog go soon after the ice melts in spring?',
      answer: 'It hops off to a pond to breed.',
      evidence: 'Soon it is hopping off to a pond to breed.',
      rubric:
        '一分：答出「去水塘（去繁殖 / 产卵）」即给分；只写「去水塘」也给分。写「回到落叶下面」「回到地底下」不给分。',
    },
    {
      kind: 'short',
      marks: 2,
      stem: 'Why is freezing deadly for most animals?',
      answer: 'The water inside the tiny cells of the body freezes, and the sharp ice crystals can tear the cells apart.',
      evidence: "When the water inside the body's tiny cells freezes, sharp ice crystals can tear the cells apart.",
      rubric:
        '两分：写出「身体细胞里面的水结冰」给 1 分；写出「尖利的冰晶会把细胞撕破」再给 1 分。只写「因为太冷了」不给分 —— 题目问的就是为什么冷会致命。写「心跳停了」不给分 —— 林蛙心跳也停，却没死。',
    },
  ],
};

// ═══════════════════════════════════════════════════════════════
// 周二 —— 手机触屏为什么隔着手套不灵（technology）
// ═══════════════════════════════════════════════════════════════

const TOUCHSCREEN = {
  key: 'original-w8-touchscreen',
  title: 'Why Your Phone Ignores Your Gloves',
  passage: plain([
    'On a cold morning, you put on woollen gloves, take out your phone and tap the screen. Nothing happens. Touch the same spot with a bare finger, and the phone responds at once. The reason is that most modern touchscreens do not feel the push of a finger at all.',
    'Some older touchscreens did rely on pressure. They had two thin layers with a tiny gap between them. Pressing the screen pushed the top layer down until it touched the one below, and the device worked out where they had met. These screens could be used with a pen, a fingernail or a gloved hand, but they had to be pressed down.',
    'Most phones and tablets today work differently. Under the glass is a grid of extremely thin lines made of a material that carries electricity. A small electric charge is spread across this grid. The human body also carries electricity well, because it contains a great deal of salty water. When a finger comes close to the screen, it draws away a little of the charge at that point. The phone checks the grid many times a second, notices where the charge has changed and works out the position of the finger.',
    'This explains the gloves. Wool and leather do not carry electricity, so the screen cannot sense the finger inside them. A fingernail or an ordinary plastic pen fails for the same reason. Gloves made for phone users have special threads in the fingertips that carry electricity, and pens made for these screens have soft tips of a similar material.',
    'Because the grid can sense several fingers at the same time, users can spread two fingers apart to make a picture bigger. Water, however, causes problems. Drops of water can also change the charge on the grid, so a phone used in the rain may react to touches that nobody made.',
  ]),
  questions: [
    {
      kind: 'tfng',
      item: 'The human body carries electricity well because of the salty water it contains.',
      answer: 'TRUE',
      evidence: 'The human body also carries electricity well, because it contains a great deal of salty water.',
    },
    {
      kind: 'tfng',
      item: 'Gloves made for phone users cost more than ordinary gloves.',
      answer: 'NOT GIVEN',
    },
    {
      kind: 'tfng',
      item: 'Older touchscreens that relied on pressure could only be used with a bare finger.',
      answer: 'FALSE',
      evidence: 'These screens could be used with a pen, a fingernail or a gloved hand, but they had to be pressed down.',
    },
    {
      kind: 'gapChoice',
      stem: 'Older touchscreens had two thin ______ with a tiny gap between them.',
      answer: 'layers',
      distractors: ['lines', 'threads', 'tips'],
      evidence: 'They had two thin layers with a tiny gap between them.',
    },
    {
      kind: 'gapChoice',
      stem: 'Under the glass of a modern phone is a ______ of extremely thin lines.',
      answer: 'grid',
      distractors: ['spot', 'pair', 'drop'],
      evidence: 'Under the glass is a grid of extremely thin lines made of a material that carries electricity.',
    },
    {
      kind: 'gapChoice',
      stem: 'Wool and ______ do not carry electricity, so the screen cannot sense the finger inside them.',
      answer: 'leather',
      distractors: ['water', 'metal', 'skin'],
      evidence: 'Wool and leather do not carry electricity, so the screen cannot sense the finger inside them.',
    },
    {
      kind: 'gapTyped',
      summary: true,
      marks: 2,
      stem: 'A modern phone can tell where a finger is touching because ______.',
      answer:
        'the finger draws away a little of the charge at that point, and the phone checks the grid many times a second to find where the charge has changed',
      evidence:
        'When a finger comes close to the screen, it draws away a little of the charge at that point. The phone checks the grid many times a second, notices where the charge has changed and works out the position of the finger.',
      rubric:
        '两分：写出「手指靠近时，会带走那一点上的一点电荷（因为人体导电）」给 1 分；写出「手机每秒检查网格很多次，找到电荷变了的地方」再给 1 分。写「手指把屏幕压下去」不给分 —— 那是老式触屏的原理。',
    },
    {
      kind: 'short',
      marks: 2,
      stem: 'Using your own words, explain why a phone does not react to a finger inside a woollen glove.',
      answer:
        'The screen notices a finger only because the finger lets electricity through and takes away some of the charge. Wool does not let electricity through, so the screen cannot tell that the finger is there.',
      evidence: 'Wool and leather do not carry electricity, so the screen cannot sense the finger inside them.',
      rubric:
        '两分：写出「屏幕是靠手指导电（带走一点电荷）来发现手指的，不是靠按压」给 1 分；写出「毛线不导电，所以屏幕感觉不到手套里的手指」再给 1 分。只写「手套太厚了」「按得不够用力」不给分 —— 原文说现在的屏幕根本不靠按压。整句照抄原文只给 1 分。',
    },
    {
      kind: 'short',
      marks: 1,
      stem: 'Why can users make a picture bigger by spreading two fingers apart?',
      answer: 'Because the grid can sense several fingers at the same time.',
      evidence: 'Because the grid can sense several fingers at the same time, users can spread two fingers apart to make a picture bigger.',
      rubric:
        '一分：答出「网格能同时感觉到好几根手指」即给分。写「因为屏幕很大」「因为手指导电」不给分 —— 一根手指也导电，题目问的是为什么能用两根。',
    },
    {
      kind: 'short',
      marks: 2,
      stem: 'What problem can rain cause for a modern phone, and why?',
      answer: 'The phone may react to touches that nobody made, because drops of water can also change the charge on the grid.',
      evidence:
        'Drops of water can also change the charge on the grid, so a phone used in the rain may react to touches that nobody made.',
      rubric:
        '两分：写出「手机可能对没人碰过的地方做出反应（误触）」给 1 分；写出「原因是水滴也会改变网格上的电荷（像手指一样）」再给 1 分。写「雨水会让手机坏掉」「屏幕会变滑」不给分 —— 原文没这么说。',
    },
  ],
};

// ═══════════════════════════════════════════════════════════════
// 周三 —— 奥的斯的安全电梯（history）
// ═══════════════════════════════════════════════════════════════

const SAFE_LIFT = {
  key: 'original-w8-safety-lift',
  title: 'A Lift You Could Trust',
  passage: plain([
    'Machines for lifting heavy loads between floors were in use long before the 1850s, in factories, warehouses and mines. Most were simple platforms that hung from a rope. Their weakness was obvious: if the rope broke, the platform and everything on it fell to the bottom. Few people were willing to ride on one.',
    'In the early 1850s, an American mechanic named Elisha Otis designed a platform that would not fall. A strong steel spring was fixed above it, and the lifting rope was attached to the spring. While the rope was pulling, it held the spring in place. If the rope broke, the spring was suddenly released and pushed two metal catches outwards. These caught in rows of teeth along the rails on either side, and the platform stopped almost at once.',
    "People did not trust the idea at first, so Otis decided to show them. In 1854, at a large exhibition in New York, he stood on a platform high above a crowd and ordered the rope holding it to be cut. The platform dropped a few centimetres and then stopped. Otis is said to have called out, 'All safe, gentlemen, all safe.'",
    'Orders soon began to arrive. In 1857, the first passenger lift with his safety device was put into a five-storey shop in New York. Otis died in 1861, but his sons carried on the business.',
    'The safe lift changed the way cities grew. Before it, few buildings had more than five or six floors, and the top floors, with the most stairs to climb, were the least popular. Once people could ride up safely, buildings could rise much higher, and the top floors became some of the most desired. Modern lifts are far more advanced, but most still carry a safety brake that grips the rails if the lift moves too fast.',
  ]),
  questions: [
    {
      kind: 'tfng',
      item: "Otis's sons later built lifts that ran on electricity.",
      answer: 'NOT GIVEN',
    },
    {
      kind: 'tfng',
      item: 'Machines for lifting heavy loads were used in mines before the 1850s.',
      answer: 'TRUE',
      evidence: 'Machines for lifting heavy loads between floors were in use long before the 1850s, in factories, warehouses and mines.',
    },
    {
      kind: 'tfng',
      item: "Otis's business continued after he died.",
      answer: 'TRUE',
      evidence: 'Otis died in 1861, but his sons carried on the business.',
    },
    {
      kind: 'gapChoice',
      stem: 'Above the platform, Otis fixed a strong steel ______.',
      answer: 'spring',
      distractors: ['rail', 'hook', 'chain'],
      evidence: 'A strong steel spring was fixed above it, and the lifting rope was attached to the spring.',
    },
    {
      kind: 'gapChoice',
      stem: 'In 1857, the first passenger lift with the safety device was put into a five-storey ______ in New York.',
      answer: 'shop',
      distractors: ['factory', 'mine', 'exhibition'],
      evidence: 'In 1857, the first passenger lift with his safety device was put into a five-storey shop in New York.',
    },
    {
      kind: 'gapChoice',
      stem: 'Most modern lifts still carry a safety ______ that grips the rails if the lift moves too fast.',
      answer: 'brake',
      distractors: ['platform', 'rope', 'floor'],
      evidence:
        'Modern lifts are far more advanced, but most still carry a safety brake that grips the rails if the lift moves too fast.',
    },
    {
      kind: 'gapTyped',
      summary: true,
      marks: 2,
      stem: "If the lifting rope broke, Otis's platform stopped because ______.",
      answer: 'the spring was released and pushed two metal catches outwards, and these caught in the rows of teeth along the rails',
      evidence:
        'If the rope broke, the spring was suddenly released and pushed two metal catches outwards. These caught in rows of teeth along the rails on either side, and the platform stopped almost at once.',
      rubric:
        '两分：写出「弹簧突然松开，把两个金属卡子往外推」给 1 分；写出「卡子卡进两边导轨上的一排排齿里」再给 1 分。写「有人拉住了平台」「换了一根更结实的绳子」不给分 —— 原文没这么说。',
    },
    {
      kind: 'short',
      marks: 2,
      stem: 'Using your own words, describe what Otis did at the exhibition in 1854 and what happened.',
      answer:
        'He stood on a raised platform above the people watching and had its rope cut. The platform fell only a very short distance before it stopped.',
      evidence: 'The platform dropped a few centimetres and then stopped.',
      rubric:
        '两分：写出「他站在高出人群的平台上，叫人把吊着平台的绳子砍断」给 1 分；写出「平台只往下掉了几厘米就停住了」再给 1 分。只写「他展示了自己的发明」不给分 —— 没说做了什么。写「平台掉到了地上」不给分。整句照抄原文只给 1 分。',
    },
    {
      kind: 'short',
      marks: 1,
      stem: 'Why were few people willing to ride on the early lifting platforms?',
      answer: 'If the rope broke, the platform and everything on it fell to the bottom.',
      evidence:
        'Their weakness was obvious: if the rope broke, the platform and everything on it fell to the bottom.',
      rubric:
        '一分：答出「绳子一断，平台（连同上面的人和东西）就会掉到底」即给分。写「因为太慢」「因为太贵」不给分 —— 原文没说。',
    },
    {
      kind: 'short',
      marks: 2,
      stem: 'How did the safe lift change the way people felt about the top floors of buildings?',
      answer:
        'Before the safe lift, the top floors were the least popular because they had the most stairs to climb. Afterwards, they became some of the most desired.',
      evidence:
        'Once people could ride up safely, buildings could rise much higher, and the top floors became some of the most desired.',
      rubric:
        '两分：写出「以前顶层最不受欢迎（要爬的楼梯最多）」给 1 分；写出「有了安全电梯以后，顶层变成了最抢手的楼层之一」再给 1 分。只写「楼盖得更高了」不给分 —— 题目问的是人们对顶层的看法。',
    },
  ],
};

// ═══════════════════════════════════════════════════════════════
// 周四 —— 吃冰太快为什么脑门疼（health）
// ═══════════════════════════════════════════════════════════════

const BRAIN_FREEZE = {
  key: 'original-w8-brain-freeze',
  title: 'Too Cold, Too Fast',
  passage: plain([
    'Take a big bite of ice cream or drink something icy too quickly, and you may feel a sudden, sharp pain in your forehead. It usually goes away within a minute or two, as quickly as it came. Most people call it brain freeze, although nothing in the head actually freezes.',
    'The cause lies in the mouth. Many researchers believe that when something very cold touches the roof of the mouth or the back of the throat, the blood vessels there first narrow and then, in an effort to warm the area, suddenly widen again. This rapid change is picked up by a large nerve that also carries feelings from the face and forehead. Because the brain cannot tell exactly where the signal came from, the pain is felt in the forehead instead of the mouth.',
    'In 2012, a team of researchers in the United States looked at what happens inside the head. They asked a small group of adult volunteers to sip ice-cold water through a straw held against the roof of the mouth. Meanwhile, they used ultrasound to measure the flow of blood in the brain. As soon as the pain began, the flow through a blood vessel supplying the front of the brain increased sharply. When the vessel narrowed again, the pain went away.',
    'The researchers suggested that this sudden rush of blood may raise the pressure inside the skull, which has little room for extra blood, and that this causes the pain. They also hoped the results might help to explain other kinds of headache that may involve similar changes in blood flow.',
    'Brain freeze is harmless, and it is easy to stop. Pressing the tongue against the roof of the mouth helps to warm it, and so does a sip of warm water. Better still, eating cold food slowly gives the mouth time to adjust, and the pain may never start.',
  ]),
  questions: [
    {
      kind: 'tfng',
      item: 'Brain freeze usually lasts for at least ten minutes.',
      answer: 'FALSE',
      evidence: 'It usually goes away within a minute or two, as quickly as it came.',
    },
    {
      kind: 'tfng',
      item: 'People get brain freeze more often in hot weather.',
      answer: 'NOT GIVEN',
    },
    {
      kind: 'tfng',
      item: 'In the 2012 study, the volunteers drank warm water.',
      answer: 'FALSE',
      evidence:
        'They asked a small group of adult volunteers to sip ice-cold water through a straw held against the roof of the mouth.',
    },
    {
      kind: 'gapChoice',
      stem: 'When something very cold touches the roof of the mouth, the blood vessels there first ______ and then widen again.',
      answer: 'narrow',
      distractors: ['freeze', 'warm', 'burst'],
      evidence:
        'Many researchers believe that when something very cold touches the roof of the mouth or the back of the throat, the blood vessels there first narrow and then, in an effort to warm the area, suddenly widen again.',
    },
    {
      kind: 'gapChoice',
      stem: 'The researchers used ______ to measure the flow of blood in the brain.',
      answer: 'ultrasound',
      distractors: ['pressure', 'water', 'ice'],
      evidence: 'Meanwhile, they used ultrasound to measure the flow of blood in the brain.',
    },
    {
      kind: 'gapChoice',
      stem: 'Eating cold food slowly gives the mouth time to ______.',
      answer: 'adjust',
      distractors: ['freeze', 'narrow', 'escape'],
      evidence: 'Better still, eating cold food slowly gives the mouth time to adjust, and the pain may never start.',
    },
    {
      kind: 'gapTyped',
      summary: true,
      marks: 2,
      stem: 'The pain of brain freeze is felt in the forehead rather than in the mouth because ______.',
      answer:
        'the change in the mouth is picked up by a nerve that also carries feelings from the face and forehead, and the brain cannot tell exactly where the signal came from',
      evidence:
        'This rapid change is picked up by a large nerve that also carries feelings from the face and forehead. Because the brain cannot tell exactly where the signal came from, the pain is felt in the forehead instead of the mouth.',
      rubric:
        '两分：写出「嘴里的变化由一条神经接收，这条神经同时也管脸和额头的感觉」给 1 分；写出「大脑分不清信号到底是从哪里来的」再给 1 分。写「冷气从嘴里跑到了额头」「大脑被冻住了」不给分 —— 原文说头里其实没有东西结冰。',
    },
    {
      kind: 'short',
      marks: 2,
      stem: 'Using your own words, describe what the 2012 study found.',
      answer:
        'When the pain started, much more blood suddenly flowed through a blood vessel at the front of the brain. When that vessel became narrower again, the pain stopped.',
      evidence:
        'As soon as the pain began, the flow through a blood vessel supplying the front of the brain increased sharply. When the vessel narrowed again, the pain went away.',
      rubric:
        '两分：写出「一开始疼，通往大脑前部的一条血管里的血流就猛地增加」给 1 分；写出「这条血管重新变窄（收缩）时，疼就消失了」再给 1 分。只写「研究者用超声测了血流」不给分 —— 那是怎么做的，不是发现了什么。整句照抄原文只给 1 分。',
    },
    {
      kind: 'short',
      marks: 1,
      stem: 'According to the passage, why do the blood vessels in the roof of the mouth widen again?',
      answer: 'To warm the area.',
      evidence:
        'Many researchers believe that when something very cold touches the roof of the mouth or the back of the throat, the blood vessels there first narrow and then, in an effort to warm the area, suddenly widen again.',
      rubric:
        '一分：答出「为了让那块地方暖和起来」即给分；写「身体想给那里回暖」也给分。写「因为冷东西已经吞下去了」「因为压力太大」不给分 —— 原文没这么说。',
    },
    {
      kind: 'short',
      marks: 2,
      stem: 'Give TWO things a person can do to stop brain freeze once it has started.',
      answer: 'Press the tongue against the roof of the mouth; take a sip of warm water.',
      evidence: 'Pressing the tongue against the roof of the mouth helps to warm it, and so does a sip of warm water.',
      rubric:
        '两分：①用舌头顶住上颚（口腔顶部）；②喝一小口温水 —— 每答出一种给 1 分。写「慢慢吃冷的东西」不给分 —— 那是预防的办法，题目问的是已经疼了怎么止住。写「喝冰水」不给分。',
    },
  ],
};

// ═══════════════════════════════════════════════════════════════
// 周五 —— 斯特鲁普效应（psychology）
// ═══════════════════════════════════════════════════════════════

const STROOP = {
  key: 'original-w8-stroop',
  title: 'Say the Colour, Not the Word',
  passage: plain([
    "Here is a simple test. You are shown the word RED printed in green ink and asked to name the colour of the ink as quickly as you can. Most people hesitate for a moment, and some say 'red' by mistake. Give them a whole list of such words, each printed in a colour that does not match its meaning, and almost everyone slows down and makes errors.",
    'Psychologists noticed as early as the 1880s that people can read colour words aloud faster than they can name colours. However, the effect described above is named after the American psychologist John Ridley Stroop, who studied it carefully in a set of experiments published in 1935.',
    'In one experiment, Stroop asked people to read aloud colour words printed in conflicting colours, and compared their speed with reading the same words printed in black. The ink made almost no difference. In another, he asked people to name the ink colours of the conflicting words, and compared this with naming the colours of simple coloured shapes. This time the difference was large: naming the ink colours of the words took far longer.',
    'The usual explanation is that, for a practised reader, reading is automatic. We cannot look at a familiar word without understanding it, even when we are trying not to. When the word and the ink disagree, the meaning of the word gets in the way, and the brain must hold it back before giving the right answer. Children who have not yet learned to read are hardly affected by the words.',
    'The Stroop test has since become one of the best-known experiments in psychology. Because it shows how well a person can ignore a distraction and stay focused on a task, doctors and researchers use versions of it to study attention, for example in people who have had a brain injury.',
  ]),
  questions: [
    {
      kind: 'tfng',
      item: 'Stroop also tested the effect with words in other languages.',
      answer: 'NOT GIVEN',
    },
    {
      kind: 'tfng',
      item: 'When people read the colour words aloud, the colour of the ink hardly slowed them down.',
      answer: 'TRUE',
      evidence:
        'In one experiment, Stroop asked people to read aloud colour words printed in conflicting colours, and compared their speed with reading the same words printed in black. The ink made almost no difference.',
    },
    {
      kind: 'tfng',
      item: 'Stroop was the first to notice that people name colours more slowly than they read colour words.',
      answer: 'FALSE',
      evidence: 'Psychologists noticed as early as the 1880s that people can read colour words aloud faster than they can name colours.',
    },
    {
      kind: 'gapChoice',
      stem: "Most people ______ for a moment, and some say 'red' by mistake.",
      answer: 'hesitate',
      distractors: ['ignore', 'disagree', 'laugh'],
      evidence: "Most people hesitate for a moment, and some say 'red' by mistake.",
    },
    {
      kind: 'gapChoice',
      stem: 'For a practised reader, reading is ______.',
      answer: 'automatic',
      distractors: ['conflicting', 'slow', 'careful'],
      evidence: 'The usual explanation is that, for a practised reader, reading is automatic.',
    },
    {
      kind: 'gapChoice',
      stem: 'The Stroop test has become one of the best-known ______ in psychology.',
      answer: 'experiments',
      distractors: ['errors', 'shapes', 'lessons'],
      evidence: 'The Stroop test has since become one of the best-known experiments in psychology.',
    },
    {
      kind: 'gapTyped',
      summary: true,
      marks: 2,
      stem: 'When the word and the ink colour disagree, a reader is slowed down because ______.',
      answer: 'the meaning of the word gets in the way, and the brain must hold it back before giving the right answer',
      evidence:
        'When the word and the ink disagree, the meaning of the word gets in the way, and the brain must hold it back before giving the right answer.',
      rubric:
        '两分：写出「词的意思会跳出来捣乱（读词是自动的，挡都挡不住）」给 1 分；写出「大脑得先把这个意思压下去，才能说出正确的颜色」再给 1 分。写「墨水颜色太淡看不清」「颜色词太长」不给分 —— 原文没这么说。',
    },
    {
      kind: 'short',
      marks: 2,
      stem: 'Using your own words, describe what Stroop compared in the experiment where people named ink colours, and what he found.',
      answer:
        'He compared how fast people could say the ink colours of words that named a different colour with how fast they could say the colours of plain shapes. Saying the colours of the words was much slower.',
      evidence:
        'In another, he asked people to name the ink colours of the conflicting words, and compared this with naming the colours of simple coloured shapes.',
      rubric:
        '两分：写出「比的是：说出颜色不对的词的墨水颜色，和说出简单色块（图形）的颜色」给 1 分（两样都要提到）；写出「说词的墨水颜色要慢得多」再给 1 分。写成另一个实验（读词时墨色几乎没影响）不给分 —— 题目问的是说墨水颜色的那一个。整句照抄原文只给 1 分。',
    },
    {
      kind: 'short',
      marks: 1,
      stem: 'According to the passage, who is hardly affected by the words in the Stroop test?',
      answer: 'Children who have not yet learned to read.',
      evidence: 'Children who have not yet learned to read are hardly affected by the words.',
      rubric:
        '一分：答出「还没学会认字（读书）的小孩」即给分。只写「小孩」不给分 —— 会读书的孩子也受影响。写「脑损伤的人」不给分。',
    },
    {
      kind: 'short',
      marks: 2,
      stem: 'Why do doctors and researchers use versions of the Stroop test?',
      answer:
        'It shows how well a person can ignore a distraction and stay focused on a task, so they use it to study attention, for example in people who have had a brain injury.',
      evidence:
        'Because it shows how well a person can ignore a distraction and stay focused on a task, doctors and researchers use versions of it to study attention, for example in people who have had a brain injury.',
      rubric:
        '两分：写出「它能看出一个人能不能不理会干扰、专心做眼前的事」给 1 分；写出「所以用来研究注意力（比如脑部受过伤的人）」再给 1 分。只写「因为它很有名」不给分。写「用来测一个人读书快不快」不给分 —— 原文没这么说。',
    },
  ],
};

const SPECS = [WOOD_FROG, TOUCHSCREEN, SAFE_LIFT, BRAIN_FREEZE, STROOP];

module.exports = {
  LEVEL,
  SPECS,
  DAYS: DATES.slice(0, SPECS.length).map((date, i) => buildAuthoredDay(SPECS[i], date)),
};
