/**
 * 第六周 —— **ielts_light（雅思轻量）**档，全原创说明文。
 *
 * 两三百词、五段，不编号。形状与第四、五周这一档一致：
 *   3 道判断 · 3 道填空转四选一 · 1 道两分概括填空 · 3 道主观题（2/1/2 分）—— 满分 13。
 * 每篇至少一道「Using your own words」。判断题整周 TRUE / FALSE / NOT GIVEN 各 5 道，
 * 只有周二是「各一」，单天不全一样，NOT GIVEN 不总放最后。
 * 选词题每道至少一个干扰项是「原文出现过、放这里不对」的词。
 *
 * 事实只写有把握的，拿不准的年份、数字、人名一律不写：
 *   · 手指泡水起皱 —— 起皱靠自主神经（交感）控制的指尖血管收缩：软组织体积变小、表皮被拉出褶皱，
 *     不是单纯吸水膨胀；Lewis & Pickering（1930 年代）最早描述正中神经麻痹的手指泡水不起皱；
 *     临床用「泡水起皱试验」查交感神经功能（常用约 40°C 温水泡 30 分钟）—— PLOS ONE 2014
 *     Haseleu 等「Water-Induced Finger Wrinkles Do Not Affect Touch Acuity or Dexterity」引言；
 *     自主神经也管心率、出汗 —— Newcastle University 新闻稿 2013-01「Get a grip」（原文列了
 *     breathing, heart rate and perspiration，文中只写心率和出汗）。把握高。
 *     2011 年 Changizi 等（美国 2AI Labs）提出「雨天轮胎纹」假说；2013 年 Newcastle 大学
 *     Kareklas、Nettle、Smulders（Biology Letters）：温水泡 30 分钟后搬弹珠，湿弹珠快约 12%，
 *     干弹珠没区别 —— Newcastle 新闻稿、PubMed 23302867；2014 年 Haseleu 等重复不出来：
 *     起皱对拿湿东西、触觉都没影响 —— 同上 PLOS ONE。把握高。
 *     按主编提醒：判断题和主观题只考「哪一年哪项研究发现了什么」「学界有分歧」，
 *     不出「起皱能不能抓得更稳」这种两种答法都说得通的题。
 *     不写：泡几分钟开始起皱（各处说法不一）、手掌脚掌是否也起皱、志愿者人数。
 *   · 射水鱼 —— 新加坡北岸红树林和码头下常见，双溪布洛湿地保护区主桥下常有一大群；舌头顶住
 *     上颚的槽形成细管，猛合鳃盖把水挤出，舌尖控制方向；可连射多次（原文 up to 7，文中写 several）；
 *     水柱能到 2–3 米、只在约 1–1.5 米内打得准（文中写「准的距离只有大约一半」）；几厘米长的小鱼
 *     已经会射、只射得很近；够得着时更爱跳出水面直接咬；光从空气进水会偏折，眼睛不会自动纠正、
 *     要靠学，猎物正下方偏差最小 —— wildsingapore「Archerfishes (Toxotidae) on Singapore shores」、
 *     NUS 红树林图鉴。把握高。
 *     2006 年 Schuster 等（德国 Erlangen-Nuremberg 大学，Current Biology）：原本只会打静止目标的鱼，
 *     旁观熟练同伴打快速移动的目标一段时间，自己一枪没练就学会了 —— American Scientist
 *     「Watch and Learn」、Current Biology 摘要。把握高。
 *     不写：射水鱼能认人脸（2016）、水柱在空中「追上前端」成团、鱼的颜色和种名。
 *   · 罐头与开罐器 —— 1800 年代初 Nicolas Appert 发现密封玻璃瓶再加热能长期保存食物，当时不知
 *     原因；几十年后 Pasteur 证明食物变坏是微生物所致 —— Wikipedia「Tin can」「Nicolas Appert」；
 *     1810 年英国商人 Peter Durand 取得专利（范围含金属容器），1812 年卖给 Bryan Donkin 和
 *     John Hall，二人在伦敦开了世界第一家罐头厂，1813 年供货英国皇家海军；罐子用镀锡铁皮，
 *     锡防锈 —— Wikipedia「Tin can」。把握高。
 *     早期罐子又厚又重，说明写着用锤子和凿子沿顶边切开（Cut round the top near the outer edge
 *     with a chisel and hammer），士兵用刀或刺刀 —— Wikipedia「Can opener」、Discover「They
 *     Invented It」；罐子后来改用更薄更轻的材料（1846 年前后已明显变轻），开罐器才有意义 ——
 *     Smithsonian「Why the Can Opener Wasn't Invented Until Almost 50 Years After the Can」、
 *     Tasting Table；1858 年 Ezra Warner 专利（镰刀状刀片插进罐顶沿边锯开），美军南北战争时用，
 *     家用太危险；1870 年 Lyman 滚轮式；1925 年 Star 公司加第二个带齿的轮子，至今常见 ——
 *     Wikipedia「Can opener」。把握高。
 *     「四十多年」：1810/1813 → 1855（Yeates 爪式）/1858，文中写 more than forty years。
 *     不写：拿破仑悬赏的金额与年份（说法不一）、「罐子比里面的食物还重」（只见二手来源）、
 *     Yeates 1855 与 Warner 谁算「第一个」（文中写 one of the first）、Philippe de Girard。
 *   · 洗澡玩具与洋流 —— 1992-01-10 货轮 Ever Laurel 从香港开往美国塔科马，在北太平洋国际日期
 *     变更线附近遇风暴，12 个集装箱落海，其中一个装 28,800 个洗澡玩具（黄鸭、红河狸、蓝乌龟、
 *     绿青蛙）；玩具装在硬纸板包装上，纸板在海水里很快分解，玩具漂出来；1992-11-16 阿拉斯加
 *     Sitka 附近有人捡到第一批 10 个，离落海处约 3,200 公里；Ebbesmeyer 与 Ingraham 联系海滩
 *     拾物者、沿岸工作者和居民，在约 850 公里海岸线上找到数百个；发现记录输入 Ingraham 的
 *     OSCURS 洋流模型；用模型正确预测了 1996 年华盛顿州还会有玩具上岸；二人此前追踪过 1990 年
 *     落海的约 61,000 只 Nike 跑鞋（文中写 tens of thousands）；鸭子和河狸被晒褪成白色，乌龟和
 *     青蛙保持原色 —— Wikipedia「Friendly Floatees spill」「Curtis Ebbesmeyer」。把握高。
 *     「靠已知的落水时间地点和发现时间地点推洋流走向」是漂流物研究的基本思路，文中写「大致」。
 *     按主编提醒不写：漂过北极到大西洋、2007 年英国那只（后证实不是）。也不写船名、品牌名。
 *   · 苹果切开变褐 —— 多酚氧化酶（PPO）在质体里、酚类在液泡里，完好细胞里碰不到；切开或碰伤
 *     细胞破裂后二者相遇，在氧气参与下把酚类变成醌、再连成褐色色素（文中只写「新物质连成褐色
 *     色素」，不出现 PPO、醌）—— Scientific American「Why do apple slices turn brown after
 *     being cut?」、PPO 定位综述（ResearchGate「Polyphenol oxidase: the chloroplast oxidase…」）；
 *     褐变无害；柠檬汁：酸让 PPO 不活跃、维生素 C 阻止褐色物质生成；低温减慢反应 —— 同上、
 *     Home Science Tools「Lemon Juice on Apples Experiment」。把握高。
 *     红茶揉捻破坏细胞、靠同类酶氧化变深色；绿茶采后很快加热（蒸 / 炒）让酶失活所以保持绿色 ——
 *     茶叶加工常识，Scientific American 同文提到茶的褐变是「想要的」。把握高。
 *     按主编提醒整条不写 Arctic apple。也不写：咖啡（咖啡的褐色主要来自烘焙，不是酶促）、
 *     盐水泡、开水烫苹果、植物为什么有这种酶（学界没定论 —— 周五第 3 题 NOT GIVEN 就考这个）。
 */

'use strict';

const { buildAuthoredDay, plain } = require('../authored');
const { DATES } = require('./dates');

const LEVEL = 'ielts_light';

// ═══════════════════════════════════════════════════════════════
// 周一 —— 手指泡水为什么起皱
// ═══════════════════════════════════════════════════════════════

const WRINKLES = {
  key: 'original-w6-wet-fingers',
  title: 'Why Wet Fingers Wrinkle',
  passage: plain([
    'After a long swim or bath, the tips of your fingers and toes become covered in wrinkles, like the skin of a raisin. Many people assume that the outer layer of skin simply soaks up water and swells, and because it is attached to the layers below, it has to fold.',
    'An old medical observation suggests otherwise. In the 1930s, doctors noticed that fingers with damaged nerves stayed smooth in water. If wrinkling were only about skin soaking up water, nerves would make no difference. In fact, wrinkling is controlled by the part of the nervous system that also controls heart rate and sweating. When a hand stays in water, this system makes the blood vessels under the fingertips narrow. The soft tissue there shrinks slightly, and the skin on top is pulled into folds.',
    'Because wrinkling depends on healthy nerves, doctors can use it as a simple test. A patient\'s hand is placed in warm water for about half an hour, and the doctor then checks which fingers have wrinkled.',
    'But why should the body wrinkle its fingers at all? In 2011, a group of American scientists suggested that wrinkles might work like the patterns on car tyres, carrying water away so that fingers grip better when wet. Two years later, researchers at Newcastle University in England tested the idea. Volunteers moved marbles from one container to another, with and without wrinkled fingers. With wrinkled fingers, they moved wet marbles about 12 per cent faster; with dry marbles, the wrinkles made no difference.',
    'The question is not settled. In 2014, another team carried out a similar test and found that wrinkles made no difference to how well people handled wet objects. Some researchers still support the grip idea, while others doubt it. What is certain is that a wrinkled fingertip is a sign that its nerves are doing their job.',
  ]),
  questions: [
    {
      kind: 'tfng',
      item: 'The part of the nervous system that controls finger wrinkling also controls sweating.',
      answer: 'TRUE',
      evidence: 'In fact, wrinkling is controlled by the part of the nervous system that also controls heart rate and sweating.',
    },
    {
      kind: 'tfng',
      item: 'Researchers at Newcastle University were the first to suggest that wrinkles might improve grip.',
      answer: 'FALSE',
      evidence:
        'In 2011, a group of American scientists suggested that wrinkles might work like the patterns on car tyres, carrying water away so that fingers grip better when wet.',
    },
    {
      kind: 'tfng',
      item: 'Researchers still disagree about what finger wrinkles are for.',
      answer: 'TRUE',
      evidence: 'Some researchers still support the grip idea, while others doubt it.',
    },
    {
      kind: 'gapChoice',
      stem: 'In the 1930s, doctors noticed that fingers with damaged ______ stayed smooth in water.',
      answer: 'nerves',
      distractors: ['tissue', 'skin', 'bones'],
      evidence: 'In the 1930s, doctors noticed that fingers with damaged nerves stayed smooth in water.',
    },
    {
      kind: 'gapChoice',
      stem: 'In the 2013 study, volunteers moved marbles from one ______ to another.',
      answer: 'container',
      distractors: ['hand', 'bath', 'cupboard'],
      evidence: 'Volunteers moved marbles from one container to another, with and without wrinkled fingers.',
    },
    {
      kind: 'gapChoice',
      stem: 'According to the writer, a wrinkled fingertip is a ______ that its nerves are doing their job.',
      answer: 'sign',
      distractors: ['warning', 'question', 'test'],
      evidence: 'What is certain is that a wrinkled fingertip is a sign that its nerves are doing their job.',
    },
    {
      kind: 'gapTyped',
      summary: true,
      marks: 2,
      stem: 'The 2013 study found that, when their fingers were wrinkled, the volunteers ______.',
      answer: 'moved wet marbles about 12 per cent faster, but were no faster with dry marbles',
      evidence: 'With wrinkled fingers, they moved wet marbles about 12 per cent faster; with dry marbles, the wrinkles made no difference.',
      rubric:
        '两分：写出「搬湿弹珠更快（快了约 12%）」给 1 分；写出「搬干弹珠没有区别」再给 1 分。写 2014 年那次研究的结果（起皱对拿湿东西没帮助）不给分 —— 题目问的是 2013 年的研究。',
    },
    {
      kind: 'short',
      marks: 2,
      stem: 'Using your own words, explain how staying in water makes the skin of the fingertips wrinkle.',
      answer:
        'The nervous system makes the blood vessels under the fingertips get narrower. The soft flesh of the fingertip becomes a little smaller, so the skin above it is pulled down into folds.',
      evidence: 'When a hand stays in water, this system makes the blood vessels under the fingertips narrow.',
      rubric:
        '两分：写出「神经系统让指尖下面的血管变窄（收缩）」给 1 分；写出「指尖的软组织因此稍微缩小，上面的皮肤被拉出褶皱」再给 1 分。写「皮肤吸水膨胀、只好起皱」不给分 —— 原文说那是很多人的误解。整句照抄原文只给 1 分。',
    },
    {
      kind: 'short',
      marks: 1,
      stem: 'What did the team in the 2014 study find?',
      answer: 'That wrinkles made no difference to how well people handled wet objects.',
      evidence: 'In 2014, another team carried out a similar test and found that wrinkles made no difference to how well people handled wet objects.',
      rubric: '一分：答出「起皱对拿湿东西没有帮助（没有区别）」即给分。写「起皱让人搬湿东西更快」不给分 —— 那是 2013 年那次研究的结果。',
    },
    {
      kind: 'short',
      marks: 2,
      stem: "How can doctors use finger wrinkling to check a patient's nerves?",
      answer: "They put the patient's hand in warm water for about half an hour, and then check which fingers have wrinkled.",
      evidence: "A patient's hand is placed in warm water for about half an hour, and the doctor then checks which fingers have wrinkled.",
      rubric:
        '两分：写出「把病人的手放进温水里泡（大约半小时）」给 1 分；写出「然后看哪些手指起了皱」再给 1 分（写成「没起皱的手指神经可能有问题」也给这一分）。',
    },
  ],
};

// ═══════════════════════════════════════════════════════════════
// 周二 —— 射水鱼
// ═══════════════════════════════════════════════════════════════

const ARCHERFISH = {
  key: 'original-w6-archerfish',
  title: 'A Fish With a Water Pistol',
  passage: plain([
    'Under the main bridge at Sungei Buloh Wetland Reserve, visitors can often see a crowd of fish just below the surface. These are archerfish, which hunt in an unusual way. When an insect lands on a leaf or branch above the water, an archerfish can knock the insect down with a jet of water and eat it when it falls in.',
    'To shoot, the fish presses its tongue against a groove in the roof of its mouth, forming a narrow tube. By snapping its gill covers shut, it forces water through the tube, while the tip of its tongue helps to aim the jet. It can fire several shots quickly, one after another.',
    'The jet can reach two or three metres, but it is accurate over only about half that distance. Even young fish just a few centimetres long can shoot, although their jets travel only a short way. And when an insect is close enough, an archerfish often prefers simply to leap out of the water and grab it.',
    'Aiming is harder than it sounds. Light bends as it passes from air into water, so to a fish below the surface, an insect seems to be in a slightly different place from where it really is. Archerfish are not born able to correct for this; they have to learn. Shooting from directly below the prey, where the error is smallest, makes the task easier.',
    'Archerfish can also learn by watching. In a study published in 2006, researchers in Germany let some fish, which could hit only targets that stayed still, watch a skilled group member shoot at moving ones. Afterwards, these fish could hit moving targets themselves, without having practised a single shot. So next time you stand on that bridge, remember that the fish below may be watching one another as closely as you are watching them.',
  ]),
  questions: [
    {
      kind: 'tfng',
      item: 'Archerfish shoot more often in the morning than later in the day.',
      answer: 'NOT GIVEN',
    },
    {
      kind: 'tfng',
      item: 'Archerfish are able to shoot only once they are fully grown.',
      answer: 'FALSE',
      evidence: 'Even young fish just a few centimetres long can shoot, although their jets travel only a short way.',
    },
    {
      kind: 'tfng',
      item: 'An archerfish can fire more than one shot in a short time.',
      answer: 'TRUE',
      evidence: 'It can fire several shots quickly, one after another.',
    },
    {
      kind: 'gapChoice',
      stem: 'An archerfish can knock an insect down with a jet of water and eat it when it ______ in.',
      answer: 'falls',
      distractors: ['leaps', 'dives', 'swims'],
      evidence:
        'When an insect lands on a leaf or branch above the water, an archerfish can knock the insect down with a jet of water and eat it when it falls in.',
    },
    {
      kind: 'gapChoice',
      stem: 'When an insect is close enough, an archerfish often prefers to leap out of the water and ______ it.',
      answer: 'grab',
      distractors: ['shoot', 'knock', 'follow'],
      evidence: 'And when an insect is close enough, an archerfish often prefers simply to leap out of the water and grab it.',
    },
    {
      kind: 'gapChoice',
      stem: 'Shooting from directly ______ the prey makes aiming easier.',
      answer: 'below',
      distractors: ['above', 'behind', 'beside'],
      evidence: 'Shooting from directly below the prey, where the error is smallest, makes the task easier.',
    },
    {
      kind: 'gapTyped',
      summary: true,
      marks: 2,
      stem: 'To produce its jet of water, an archerfish ______.',
      answer: 'presses its tongue against a groove in the roof of its mouth to form a tube, then snaps its gill covers shut to force water through it',
      evidence:
        'To shoot, the fish presses its tongue against a groove in the roof of its mouth, forming a narrow tube. By snapping its gill covers shut, it forces water through the tube, while the tip of its tongue helps to aim the jet.',
      rubric:
        '两分：写出「舌头顶住上颚的一道槽，形成一根细管」给 1 分；写出「猛地合上鳃盖，把水从管子里挤出去」再给 1 分。只写「用嘴喷水」不给分。',
    },
    {
      kind: 'short',
      marks: 2,
      stem: 'Using your own words, explain why an archerfish has to learn how to aim.',
      answer:
        'Light changes direction when it goes from the air into the water, so from under the water the insect looks as if it is in a different spot from where it actually is. The fish must learn to allow for this difference.',
      evidence:
        'Light bends as it passes from air into water, so to a fish below the surface, an insect seems to be in a slightly different place from where it really is.',
      rubric:
        '两分：写出「光从空气进到水里会拐弯（折射）」给 1 分；写出「所以鱼在水下看到的虫子位置，和虫子真正的位置不一样（照着看到的位置射会射偏）」再给 1 分。只写「因为它不是天生就会」不给分 —— 那只是把题目换个说法。整句照抄原文只给 1 分。',
    },
    {
      kind: 'short',
      marks: 1,
      stem: "Over what distance is an archerfish's jet accurate?",
      answer: 'Only about half as far as the jet can reach, that is, about one to one and a half metres.',
      evidence: 'The jet can reach two or three metres, but it is accurate over only about half that distance.',
      rubric:
        '一分：两种答法都给满分：①「大约是射程（水柱最远距离）的一半」（about half its range / about half as far as the jet can reach）；②「一米到一米半左右」（about 1–1.5 m，由两三米的一半算出）。只写「两三米」不给分 —— 那是水柱能射到的距离，不是射得准的距离。',
    },
    {
      kind: 'short',
      marks: 2,
      stem: 'What did the 2006 study show about archerfish?',
      answer:
        'Fish that had only watched a skilled fish shoot at moving targets were later able to hit moving targets themselves, without any practice.',
      evidence: 'Afterwards, these fish could hit moving targets themselves, without having practised a single shot.',
      rubric:
        '两分：写出「这些鱼只是在旁边看一条熟练的同伴射移动的目标」给 1 分；写出「之后自己一次都没练过，就能打中移动的目标」再给 1 分。只写「射水鱼会学习」不给分。',
    },
  ],
};

// ═══════════════════════════════════════════════════════════════
// 周三 —— 先有罐头，后有开罐器
// ═══════════════════════════════════════════════════════════════

const CAN_OPENER = {
  key: 'original-w6-can-opener',
  title: 'Waiting for the Can Opener',
  passage: plain([
    'Today, opening a can of beans takes a few seconds. Yet for more than forty years after canned food was invented, there was no such thing as a can opener. People who wanted their dinner had to break into the can with whatever tools they had.',
    'The story begins in France. In the early 1800s, a cook named Nicolas Appert found that food sealed in glass bottles and then heated would stay good for a long time. He did not know why this worked. Decades later, the French scientist Louis Pasteur showed that food goes bad because of tiny living things called microbes. Heating kills them, and a tight seal keeps new ones out.',
    "Glass, however, breaks easily. In 1810, a British merchant named Peter Durand obtained a patent that included storing food in metal cans. These were made of iron coated with tin, which stopped the iron from rusting. Two years later, Durand sold the patent to two Englishmen, Bryan Donkin and John Hall, who opened the world's first canning factory in London. By 1813 they were supplying canned food to the Royal Navy.",
    'These early cans were thick and heavy, and opening them was hard work. The instructions on some of them told users to cut round the top near the outer edge with a hammer and chisel. Soldiers used their knives.',
    'Only when cans began to be made from thinner, lighter metal did a special tool make sense. In 1858, the American inventor Ezra Warner patented one of the first can openers. It had a curved blade that was pushed into the lid and worked round the edge. The US Army used it, but it was too dangerous for most homes. Openers with a turning wheel came later, and a design with a second, toothed wheel, introduced in 1925, is still common today.',
  ]),
  questions: [
    {
      kind: 'tfng',
      item: 'Appert understood why his way of keeping food worked.',
      answer: 'FALSE',
      evidence: 'He did not know why this worked.',
    },
    {
      kind: 'tfng',
      item: 'Donkin and Hall had worked together before they bought the patent.',
      answer: 'NOT GIVEN',
    },
    {
      kind: 'tfng',
      item: 'The first cans were more expensive than glass bottles.',
      answer: 'NOT GIVEN',
    },
    {
      kind: 'gapChoice',
      stem: 'The early metal cans were made of iron coated with tin, which stopped the iron from ______.',
      answer: 'rusting',
      distractors: ['breaking', 'bending', 'melting'],
      evidence: 'These were made of iron coated with tin, which stopped the iron from rusting.',
    },
    {
      kind: 'gapChoice',
      stem: 'By 1813, Donkin and Hall were supplying canned food to the Royal ______.',
      answer: 'Navy',
      distractors: ['Army', 'Family', 'Mail'],
      evidence: 'By 1813 they were supplying canned food to the Royal Navy.',
    },
    {
      kind: 'gapChoice',
      stem: "Warner's can opener had a curved ______ that was pushed into the lid.",
      answer: 'blade',
      distractors: ['wheel', 'handle', 'hook'],
      evidence: 'It had a curved blade that was pushed into the lid and worked round the edge.',
    },
    {
      kind: 'gapTyped',
      summary: true,
      marks: 2,
      stem: "Appert's method kept food good for a long time because ______.",
      answer: 'heating killed the microbes that make food go bad, and the tight seal kept new ones out',
      evidence: 'Heating kills them, and a tight seal keeps new ones out.',
      rubric:
        '两分：写出「加热杀死了让食物变坏的微生物」给 1 分；写出「封得严严实实，新的微生物进不去」再给 1 分。只写「因为装在玻璃瓶里」不给分。',
    },
    {
      kind: 'short',
      marks: 2,
      stem: 'Using your own words, explain why the can opener came more than forty years after canned food.',
      answer:
        'The first cans were very thick and heavy, so they were hard to open. A special opener only became useful once cans were made of thinner, lighter metal.',
      evidence: 'Only when cans began to be made from thinner, lighter metal did a special tool make sense.',
      rubric:
        '两分：写出「最早的罐头又厚又重，很难打开」给 1 分；写出「后来罐子改用更薄、更轻的金属，专门的开罐工具才用得上」再给 1 分。整句照抄原文只给 1 分。',
    },
    {
      kind: 'short',
      marks: 1,
      stem: "What was the problem with Warner's can opener for use at home?",
      answer: 'It was too dangerous.',
      evidence: 'The US Army used it, but it was too dangerous for most homes.',
      rubric: '一分：答出「太危险」即给分。写「太贵」「太大」不给分 —— 原文没说。',
    },
    {
      kind: 'short',
      marks: 2,
      stem: 'Give TWO ways in which people opened the first cans.',
      answer: 'With a hammer and chisel; with knives.',
      evidence: 'The instructions on some of them told users to cut round the top near the outer edge with a hammer and chisel.',
      rubric:
        '两分：每答出一种给 1 分：①用锤子和凿子（沿顶盖边缘切开）；②（士兵）用刀。只写「锤子」或只写「凿子」也算第①种；「锤子」「凿子」分开写只算一种。写「用开罐器」不给分。',
    },
  ],
};

// ═══════════════════════════════════════════════════════════════
// 周四 —— 落海的洗澡玩具与洋流
// ═══════════════════════════════════════════════════════════════

const DUCKS = {
  key: 'original-w6-bath-toys-currents',
  title: 'Ducks Overboard',
  passage: plain([
    'On 10 January 1992, a container ship travelling from Hong Kong to the United States ran into a storm in the North Pacific, and twelve containers were washed into the sea. One of them held 28,800 plastic bath toys: yellow ducks, red beavers, blue turtles and green frogs. Each toy was fixed to a piece of cardboard, but the cardboard soon broke down in the seawater, and the toys floated free.',
    'The first of the toys to be found turned up ten months later on the coast near Sitka, Alaska, about 3,200 kilometres from where they had fallen in. The toys caught the attention of Curtis Ebbesmeyer, an American scientist who studied ocean currents by following objects that drift in the sea. He had already tracked tens of thousands of running shoes lost from another ship in 1990.',
    'Ebbesmeyer and his colleague James Ingraham asked people who lived or worked along the coast to report any toys they found, and hundreds were collected along about 850 kilometres of shoreline. The date and place of each find were added to Ingraham\'s computer model of ocean currents, so that the scientists could compare where the toys had really gone with what the model calculated.',
    'Using the model, they later predicted correctly that more toys would come ashore in Washington State in 1996. Objects like these are useful because scientists cannot easily watch water move across an ocean. But if something goes into the sea at a known time and place and is found later somewhere else, it shows roughly where the currents have carried it.',
    'The sea also changed the toys. Bleached by the sun and salt water, the ducks and beavers faded to white, while the turtles and frogs kept their original colours. It was an unexpected career for a box of bath toys.',
  ]),
  questions: [
    {
      kind: 'tfng',
      item: 'The ship was sailing towards Asia when the storm hit.',
      answer: 'FALSE',
      evidence:
        'On 10 January 1992, a container ship travelling from Hong Kong to the United States ran into a storm in the North Pacific, and twelve containers were washed into the sea.',
    },
    {
      kind: 'tfng',
      item: 'The first toys were found within a month of the storm.',
      answer: 'FALSE',
      evidence: 'The first of the toys to be found turned up ten months later on the coast near Sitka, Alaska, about 3,200 kilometres from where they had fallen in.',
    },
    {
      kind: 'tfng',
      item: 'People who lived or worked on the coast helped the scientists to find the toys.',
      answer: 'TRUE',
      evidence:
        'Ebbesmeyer and his colleague James Ingraham asked people who lived or worked along the coast to report any toys they found, and hundreds were collected along about 850 kilometres of shoreline.',
    },
    {
      kind: 'gapChoice',
      stem: 'Each toy was fixed to a piece of ______, which soon broke down in the seawater.',
      answer: 'cardboard',
      distractors: ['plastic', 'wood', 'metal'],
      evidence: 'Each toy was fixed to a piece of cardboard, but the cardboard soon broke down in the seawater, and the toys floated free.',
    },
    {
      kind: 'gapChoice',
      stem: 'Ebbesmeyer studied ocean currents by following objects that ______ in the sea.',
      answer: 'drift',
      distractors: ['sink', 'swim', 'break'],
      evidence:
        'The toys caught the attention of Curtis Ebbesmeyer, an American scientist who studied ocean currents by following objects that drift in the sea.',
    },
    {
      kind: 'gapChoice',
      stem: 'Before the toys, Ebbesmeyer had already tracked tens of thousands of running ______ lost from another ship.',
      answer: 'shoes',
      distractors: ['toys', 'ducks', 'bottles'],
      evidence: 'He had already tracked tens of thousands of running shoes lost from another ship in 1990.',
    },
    {
      kind: 'gapTyped',
      summary: true,
      marks: 2,
      stem: 'A drifting object can show scientists roughly where the currents have carried it if they know ______.',
      answer: 'when and where it went into the sea, and when and where it was found later',
      evidence:
        'But if something goes into the sea at a known time and place and is found later somewhere else, it shows roughly where the currents have carried it.',
      rubric:
        '两分：两个得分点各 1 分。①知道它何时、何地进入海里（入海的时间和地点；只写地点也给这一分）；②知道它之后在别的地方被找到（被发现的地点，写不写时间都行）。只写「知道它漂了多远」「知道洋流的速度」不给分。',
    },
    {
      kind: 'short',
      marks: 2,
      stem: 'Using your own words, explain how the scientists used the toys to check their computer model.',
      answer:
        'Every time a toy was found, they put the date and the place into the model. Then they could see whether the route the model worked out matched the place the toy had actually reached.',
      evidence:
        "The date and place of each find were added to Ingraham's computer model of ocean currents, so that the scientists could compare where the toys had really gone with what the model calculated.",
      rubric:
        '两分：写出「把每个玩具被发现的日期和地点输入计算机模型」给 1 分；写出「拿模型算出来的结果和玩具真正到达的地方比较（看模型准不准）」再给 1 分。整句照抄原文只给 1 分。',
    },
    {
      kind: 'short',
      marks: 1,
      stem: 'What did the scientists correctly predict with the help of the model?',
      answer: 'That more toys would come ashore in Washington State in 1996.',
      evidence: 'Using the model, they later predicted correctly that more toys would come ashore in Washington State in 1996.',
      rubric: '一分：答出「会有更多玩具在华盛顿州上岸」即给分，写不写 1996 年都行。只写「玩具会上岸」、没说地点不给分。',
    },
    {
      kind: 'short',
      marks: 2,
      stem: 'Which of the toys lost their colour in the sea, and which kept their original colours?',
      answer: 'The ducks and beavers were bleached white by the sun and salt water, but the turtles and frogs kept their original colours.',
      evidence: 'Bleached by the sun and salt water, the ducks and beavers faded to white, while the turtles and frogs kept their original colours.',
      rubric:
        '两分：写出「鸭子和河狸被阳光和海水漂成了白色」给 1 分；写出「乌龟和青蛙保持了原来的颜色」再给 1 分。写「所有玩具都褪成白色」只给 1 分。',
    },
  ],
};

// ═══════════════════════════════════════════════════════════════
// 周五 —— 切开的苹果为什么变褐
// ═══════════════════════════════════════════════════════════════

const APPLE = {
  key: 'original-w6-apple-browning',
  title: 'Why a Cut Apple Turns Brown',
  passage: plain([
    'Cut an apple in half and leave it on the table, and within minutes the pale flesh starts to turn brown. The same happens where an apple has been dropped and bruised. Yet an apple with unbroken skin can sit in a fruit bowl for days and stay pale inside. The difference lies in what happens when its cells are damaged.',
    'The cells of an apple contain two things that are normally kept apart. One is an enzyme, a substance that speeds up a chemical reaction. The other is a group of chemicals called phenols. In a healthy cell, they are stored in different parts, so they never meet. Cutting or bruising breaks the cells open, and the two mix.',
    'Once they mix, oxygen from the air joins in. The enzyme uses this oxygen to change the phenols into new substances, which then link together to form brown pigments. This is why browning starts on the cut surface, where the air can reach. Browning is not a sign that the fruit has gone bad: a brown apple is safe to eat, even if it looks less appealing.',
    'Cooks have several ways of slowing the process. Lemon juice helps in two ways: its acid makes the enzyme less active, and its vitamin C stops the new substances from forming brown pigments. Keeping cut fruit cold also helps, because the reaction runs more slowly at low temperatures.',
    'Sometimes, though, browning is exactly what people want. To make black tea, workers roll and crush the leaves so that their cells break, and the same kind of enzyme turns them dark. Green tea stays green because its leaves are heated soon after picking, which stops the enzyme from working.',
  ]),
  questions: [
    {
      kind: 'tfng',
      item: 'Most people throw away apples once they have turned brown.',
      answer: 'NOT GIVEN',
    },
    {
      kind: 'tfng',
      item: 'Apples that have turned brown can still be eaten safely.',
      answer: 'TRUE',
      evidence: 'Browning is not a sign that the fruit has gone bad: a brown apple is safe to eat, even if it looks less appealing.',
    },
    {
      kind: 'tfng',
      item: 'The enzyme in apples also helps the fruit to grow.',
      answer: 'NOT GIVEN',
    },
    {
      kind: 'gapChoice',
      stem: 'Browning also happens where an apple has been dropped and ______.',
      answer: 'bruised',
      distractors: ['picked', 'stored', 'polished'],
      evidence: 'The same happens where an apple has been dropped and bruised.',
    },
    {
      kind: 'gapChoice',
      stem: 'An enzyme is a substance that ______ up a chemical reaction.',
      answer: 'speeds',
      distractors: ['slows', 'breaks', 'links'],
      evidence: 'One is an enzyme, a substance that speeds up a chemical reaction.',
    },
    {
      kind: 'gapChoice',
      stem: 'To make black tea, workers roll and ______ the leaves so that their cells break.',
      answer: 'crush',
      distractors: ['mix', 'dry', 'wash'],
      evidence: 'To make black tea, workers roll and crush the leaves so that their cells break, and the same kind of enzyme turns them dark.',
    },
    {
      kind: 'gapTyped',
      summary: true,
      marks: 2,
      stem: 'Lemon juice slows browning because ______.',
      answer: 'its acid makes the enzyme less active, and its vitamin C stops the new substances from forming brown pigments',
      evidence:
        'Lemon juice helps in two ways: its acid makes the enzyme less active, and its vitamin C stops the new substances from forming brown pigments.',
      rubric:
        '两分：写出「柠檬汁里的酸让酶不那么活跃」给 1 分；写出「柠檬汁里的维生素 C 阻止新生成的物质变成褐色色素」再给 1 分。',
    },
    {
      kind: 'short',
      marks: 2,
      stem: 'Using your own words, explain why cutting an apple makes its flesh turn brown.',
      answer:
        'Cutting breaks open the cells, so the enzyme and the phenols, which are normally kept apart, come together. Using oxygen from the air, the enzyme turns the phenols into substances that join up to make a brown colour.',
      evidence: 'Cutting or bruising breaks the cells open, and the two mix.',
      rubric:
        '两分：写出「切开把细胞弄破，原本分开存放的酶和酚类混到了一起」给 1 分；写出「空气里的氧气参与进来，酶把酚类变成新物质，再连成褐色的色素」再给 1 分。只写「接触空气就变褐」、没提细胞破裂和酶，最多给 1 分。整句照抄原文只给 1 分。',
    },
    {
      kind: 'short',
      marks: 1,
      stem: 'Why does keeping cut fruit cold slow down browning?',
      answer: 'Because the reaction runs more slowly at low temperatures.',
      evidence: 'Keeping cut fruit cold also helps, because the reaction runs more slowly at low temperatures.',
      rubric: '一分：答出「温度低时这个反应进行得慢」即给分。只写「冷的东西不容易坏」不给分。',
    },
    {
      kind: 'short',
      marks: 2,
      stem: 'Why do green tea leaves stay green?',
      answer: 'Because they are heated soon after they are picked, and the heat stops the enzyme from working.',
      evidence: 'Green tea stays green because its leaves are heated soon after picking, which stops the enzyme from working.',
      rubric:
        '两分：写出「叶子摘下来后很快就被加热」给 1 分；写出「加热让酶不再起作用（叶子就不会变深色）」再给 1 分。写「绿茶叶子没被揉碎」不给分 —— 原文没说。',
    },
  ],
};

const SPECS = [WRINKLES, ARCHERFISH, CAN_OPENER, DUCKS, APPLE];

module.exports = {
  LEVEL,
  SPECS,
  DAYS: DATES.slice(0, SPECS.length).map((date, i) => buildAuthoredDay(SPECS[i], date)),
};
