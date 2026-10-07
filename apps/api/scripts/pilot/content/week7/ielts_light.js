/**
 * 第七周 —— **ielts_light（雅思轻量）**档，全原创说明文。
 *
 * 两三百词、五段，不编号。形状与第四、五、六周这一档一致：
 *   3 道判断 · 3 道填空转四选一 · 1 道两分概括填空 · 3 道主观题（2/1/2 分）—— 满分 13。
 * 每篇至少一道「Using your own words」。
 *
 * 本周选题（五个领域各一篇，与这一档已写的二十篇、各档已发文章、学生读过的旧题库都不撞）：
 *   周一 日常科学   肥皂为什么能洗掉油（What Soap Does That Water Cannot）
 *   周二 发明与历史 听诊器的发明（Listening Through a Tube）
 *   周三 动物       骆驼的驼峰里装的是什么（What Is in a Camel's Hump?）
 *   周四 人体       坐飞机耳朵为什么会「啵」一下（Why Ears Pop on a Plane）
 *   周五 地球       钟乳石怎么长出来（Icicles Made of Stone）
 * 选题前在 week2~week6 内容包和 test-fixtures 里搜过 soap / stethoscope / Laennec / camel /
 * Eustachian / ears pop / stalactite / stalagmite：没有同题。旁及的已有篇目 ——
 * 「Is That Really My Voice?」讲过外耳 / 中耳 / 内耳（骨传导），周四只借「中耳」一个词，讲的是气压；
 * 「Where the Salt Comes From」讲过「雨水带二氧化碳、微酸、溶解岩石」，周五只用两句带过，
 * 重点是滴水沉积；第七周 ielts_simplified「The Pink Shirts」是洗衣串色的故事，不讲肥皂原理。
 *
 * 判断题全周：周一 T / NG / F · 周二 F / T / F · 周三 NG / T / NG · 周四 T / F / NG · 周五 NG / F / T
 *   → TRUE 5 · FALSE 5 · NOT GIVEN 5。三天「各一」、两天不是；单天不全一样；
 *   NOT GIVEN 在第一位两次、第二位一次、第三位两次。
 * 选词题每道至少一个干扰项是「原文出现过、放这里不对」的词。
 *
 * 事实只写有把握的，拿不准的年份、数字、人名一律不写：
 *   · 肥皂 —— 肥皂分子细长，一头亲水、一头（尾）避水亲油；尾巴钻进油污、头留在水里，
 *     油被分成小油滴、外面裹一圈肥皂分子（胶束），头朝外，于是能被水冲走 —— 化学常识，
 *     NewYork-Presbyterian「How Soap Suds Kill the Coronavirus」、ScienceABC 同题文一致；
 *     流感病毒、新冠病毒外面包着一层脂质包膜，肥皂分子的尾巴插进去把包膜拆开，病毒散架 ——
 *     同上（NYT 2020-03 对悉尼化学家的采访也是这个说法，文中不写人名）。把握高。
 *     搓手产生摩擦、帮助把污垢和微生物从皮肤上带下来；搓洗至少 20 秒、约等于哼两遍
 *     「Happy Birthday」；水温似乎不影响去除多少细菌，温水反而可能更刺激皮肤 ——
 *     CDC「Clean Hands: About Handwashing」「Show Me the Science – Why Wash Your Hands?」原文。
 *     把握高。
 *     不写：肥皂的发明史（年代说法不一）、洗手液和香皂哪个好（周一第 2 题 NOT GIVEN 就考这个）、
 *     「热到能杀菌的水会烫伤手」（只见二手说法）、硬水与皂垢、免洗洗手液。
 *   · 听诊器 —— 1816 年 René Laennec 在巴黎 Necker 医院；病人是一位有心脏病症状的年轻女子，
 *     因为胖，叩诊、手摸都没用，因年龄和性别不便把耳朵贴到胸口；他想起「耳朵贴在木头一端，
 *     能清楚听到另一端针划的声音」，把一叠纸卷成筒，一端放心口、一端贴耳朵，听到的心跳比
 *     直接贴耳听过的都清楚 —— Laennec《De l'Auscultation Médiate》（1819）英译本自述
 *     （"the scratch of a pin at one end of a piece of wood"；"much more clear and distinct"）、
 *     Wikipedia「René Laennec」。把握高。
 *     随后改成约 25 厘米长的空心木筒；名字取自希腊语「胸」+「检查」；1819 年出书
 *     （描述心肺的声音）；1826 年死于肺结核，45 岁 —— Wikipedia「René Laennec」。
 *     单耳；1851 年爱尔兰医生 Arthur Leared、1852 年纽约医生 George Cammann 做出双耳听诊器
 *     （文中写「1850 年代初，爱尔兰和美国的医生」，不写人名）—— Wikipedia「Stethoscope」。
 *     在此之前医生靠叩诊或把耳朵直接贴在胸口（immediate auscultation）—— 同上。把握高。
 *     「He could …」用男性代词是照当时的医生写。「几年后（1819）出书前听了很多病人的胸口」——
 *     他用病人生前听到的声音对照死后解剖所见，Wikipedia 同条；文中只写「听了很多病人」。
 *     不写：「看见孩子们在院子里玩木头」（后人转述，Laennec 自述里只说想起这个声学常识）、
 *     病人姓名、木筒的直径和三段可拆结构、Rappaport-Sprague。
 *   · 骆驼 —— 驼峰主要是脂肪不是水；是缺食时的能量储备；脂肪用掉后驼峰变软、耷拉 ——
 *     Wikipedia「Camel」（"reservoirs of fatty tissue … not water"；"the hump becomes limp
 *     and droops"）、SeaWorld「Dromedary Camel」（"Camels store fat in the hump, not water"）。
 *     单峰驼一个峰、双峰驼（中亚）两个 —— Wikipedia 同条。把握高。
 *     粪便极干、尿稠；呼出的水汽被鼻孔截住重新吸收 —— Wikipedia「Camel」。把握高。
 *     体温从清晨约 34°C 升到傍晚约 40°C、夜里再降下来，靠这个少出汗省水 —— Wikipedia
 *     （34→40°C）、SeaWorld（34→41.7°C，"conserve water by not sweating"）。文中写 about 34 /
 *     around 40，两处来源都对得上。把握高。
 *     一次喝约 100 升、用时不到一刻钟 —— SeaWorld（100 L in 10 min）、San Diego Zoo /
 *     National Geographic（30 gal in 13 min）；文中写 about 100 litres in less than a quarter
 *     of an hour，两个来源都在范围内。把握高。
 *     红细胞椭圆、脱水时仍能流动 —— Wikipedia。能失去体重四分之一的水还活着，多数哺乳动物失去
 *     约一半（12–14%）就会死 —— Wikipedia（25% vs 12–14%）；SeaWorld 写 over 30%，文中写
 *     「can lose a quarter … and survive」，两边都不冲突。把握高。
 *     不写：驼峰能存多少公斤脂肪（说法不一）、「脂肪分解能产生水」（产水被呼吸失水抵消，有争议）、
 *     「脂肪集中在峰里有利散热」（来源只说「可能」）、几天不喝水的具体天数、
 *     骆驼能不能闻到远处的水（周三第 3 题 NOT GIVEN）。
 *   · 坐飞机耳朵「啵」一声 —— 鼓膜后面是充气的中耳，经咽鼓管（Eustachian tube，约 35 毫米，文中不写长度）
 *     通到鼻子后部（鼻咽）；平时是瘪合的，吞咽时张开，中耳气压正时也会被顶开 —— Wikipedia
 *     「Eustachian tube」（"Normally … collapsed, but it gapes open with swallowing and with
 *     positive pressure"）。把握高。
 *     机舱加压但不到地面气压（法规上限相当于 8,000 英尺 / 2,438 米高处）—— Wikipedia
 *     「Cabin pressurization」；文中只写「比外面高、比地面低」，不写数字。爬升时舱压下降、
 *     中耳空气膨胀把鼓膜往外顶，空气从管里出去、耳朵「啵」一下；下降时舱压回升、鼓膜被往里压、
 *     管子被压扁，必须主动打开才能进气，所以降落比起飞难受；感冒、婴幼儿（管子窄）更容易出问题 ——
 *     PMC6779601「'Airplane ear' — A neglected yet preventable problem」、Wikipedia「Eustachian
 *     tube」（儿童的管子更短更平更细）。把握高。
 *     吞咽、打哈欠、嚼口香糖；闭嘴捏鼻轻轻鼓气（Valsalva）；婴儿给奶瓶吸、让他吞咽；起降时别睡，
 *     好随时做这些动作 —— Mayo Clinic「Airplane ear」、PMC6779601。把握高。
 *     不写：舱压的具体数字、婴儿哭的「唯一」原因（文中只并列写「管子更窄、常哭」）、
 *     减充血剂、耳塞、大飞机小飞机有没有区别（周四第 3 题 NOT GIVEN）。
 *   · 钟乳石 —— 雨水吸收空气和土壤里的二氧化碳成弱酸，渗入石灰岩裂缝慢慢溶解岩石，久而成洞；
 *     含溶解岩石的水滴挂在洞顶时放出二氧化碳，水「拿不住」全部溶质，留下一圈矿物（方解石）；
 *     一圈圈叠成空心细管（soda straw，很脆）；管口堵住后水从外面流，变粗成锥形；滴到地上长
 *     石笋，久了与钟乳石连成石柱；名字来自希腊语「滴落」；平均每年约 0.13 毫米 ——
 *     Wikipedia「Stalactite」（"An average growth rate is 0.13 mm … a year"）。把握高。
 *     「长 1 厘米要七十多年」是 10 ÷ 0.13 ≈ 77 算出来的。c / g 记法（ceiling / ground）
 *     是通行的记法，文中自己写。
 *     皮肤上的油会让矿物附着不上、被摸过的地方可能停止生长，所以洞穴里请游客别摸 ——
 *     NPS 教师资料「Learn About Caves」、多家洞穴景区说明；文中用 can / may。把握中高。
 *     不写：最快生长速度（3 毫米 / 年，只出现在一处）、用石笋研究古气候（与已发的冰芯、
 *     碳测年题材太近）、具体洞穴名字、第一个研究钟乳石的人（周五第 1 题 NOT GIVEN）。
 */

'use strict';

const { buildAuthoredDay, plain } = require('../authored');
const { DATES } = require('./dates');

const LEVEL = 'ielts_light';

// ═══════════════════════════════════════════════════════════════
// 周一 —— 肥皂为什么能洗掉油
// ═══════════════════════════════════════════════════════════════

const SOAP = {
  key: 'original-w7-soap',
  title: 'What Soap Does That Water Cannot',
  passage: plain([
    'After eating fried chicken with your fingers, you can hold your hands under the tap for as long as you like, and they will still feel greasy. Water simply runs off the grease, because oil and water do not mix. Add a little soap, however, and the grease comes away in seconds.',
    'The secret lies in the shape of a soap molecule. Each one is long and thin, with two very different ends. One end, called the head, is attracted to water. The other end, the tail, avoids water but attaches easily to oil and fat.',
    'When you wash greasy hands, the tails push their way into the grease while the heads stay in the water. Rubbing your hands together breaks the grease into tiny drops, and each drop becomes covered in soap molecules, with their tails pointing in and their heads pointing out. Because the outside of each drop now faces the water, the drops no longer stick to the skin, and rinsing carries them away.',
    'Soap does more than remove dirt. Many viruses, including those that cause flu and COVID-19, are wrapped in a thin layer of fat. The tails of soap molecules can force their way into this layer and break it open, so that the virus falls apart. Rubbing helps here too, because it lifts dirt and germs off the skin. Health experts therefore advise people to scrub their hands with soap for at least 20 seconds, about as long as it takes to hum "Happy Birthday" twice.',
    'Many people believe that hot water is needed to get hands properly clean. However, according to the US Centers for Disease Control and Prevention, the temperature of the water does not seem to affect how many germs are removed, and warmer water may cause more irritation to the skin. What matters most is the soap, and the time you spend scrubbing.',
  ]),
  questions: [
    {
      kind: 'tfng',
      item: 'Rubbing the hands together helps to remove germs from the skin.',
      answer: 'TRUE',
      evidence: 'Rubbing helps here too, because it lifts dirt and germs off the skin.',
    },
    {
      kind: 'tfng',
      item: 'Liquid soap cleans the hands better than a bar of soap.',
      answer: 'NOT GIVEN',
    },
    {
      kind: 'tfng',
      item: 'Washing with warm water removes more germs than washing with cold water.',
      answer: 'FALSE',
      evidence:
        'However, according to the US Centers for Disease Control and Prevention, the temperature of the water does not seem to affect how many germs are removed, and warmer water may cause more irritation to the skin.',
    },
    {
      kind: 'gapChoice',
      stem: 'Water on its own runs off grease, because oil and water do not ______.',
      answer: 'mix',
      distractors: ['stick', 'move', 'last'],
      evidence: 'Water simply runs off the grease, because oil and water do not mix.',
    },
    {
      kind: 'gapChoice',
      stem: 'Rubbing your hands together breaks the grease into tiny ______.',
      answer: 'drops',
      distractors: ['layers', 'heads', 'spots'],
      evidence:
        'Rubbing your hands together breaks the grease into tiny drops, and each drop becomes covered in soap molecules, with their tails pointing in and their heads pointing out.',
    },
    {
      kind: 'gapChoice',
      stem: 'According to the writer, what matters most is the soap and the ______ you spend scrubbing.',
      answer: 'time',
      distractors: ['water', 'money', 'heat'],
      evidence: 'What matters most is the soap, and the time you spend scrubbing.',
    },
    {
      kind: 'gapTyped',
      summary: true,
      marks: 2,
      stem: 'A soap molecule has two very different ends: ______.',
      answer: 'a head that is attracted to water, and a tail that avoids water but attaches easily to oil and fat',
      evidence: 'One end, called the head, is attracted to water. The other end, the tail, avoids water but attaches easily to oil and fat.',
      rubric:
        '两分：写出「一头（头部）被水吸引」给 1 分；写出「另一头（尾部）避开水、容易附着在油和脂肪上」再给 1 分。写成「一头亲水、一头亲油」也给满分。写「两头都能抓住油」或只写「一头长一头短」不给分。',
    },
    {
      kind: 'short',
      marks: 2,
      stem: 'Using your own words, explain how soap can destroy some viruses.',
      answer:
        'Some viruses have a thin coat of fat around them. The oil-loving ends of the soap molecules push into this coat and break it, so the virus comes to pieces.',
      evidence: 'The tails of soap molecules can force their way into this layer and break it open, so that the virus falls apart.',
      rubric:
        '两分：写出「很多病毒外面包着一层薄薄的脂肪」给 1 分；写出「肥皂分子的尾部钻进这层脂肪、把它破开，病毒就散架了」再给 1 分。只写「肥皂能杀死病毒」不给分 —— 那只是把题目换个说法。写「热水把病毒烫死」不给分 —— 原文没这么说。整句照抄原文只给 1 分。',
    },
    {
      kind: 'short',
      marks: 1,
      stem: 'For how long do health experts advise people to scrub their hands with soap?',
      answer: 'For at least 20 seconds, about as long as it takes to hum "Happy Birthday" twice.',
      evidence:
        'Health experts therefore advise people to scrub their hands with soap for at least 20 seconds, about as long as it takes to hum "Happy Birthday" twice.',
      rubric:
        '一分：答出「至少 20 秒」即给分；写「大约哼两遍《生日快乐》那么久」也给分；只写「20 秒」、漏了「至少」也给分。写「直到洗干净为止」「两分钟」不给分。',
    },
    {
      kind: 'short',
      marks: 2,
      stem: 'Why can a drop of grease that is covered in soap molecules be rinsed away?',
      answer:
        'The heads of the soap molecules point outwards, so the outside of the drop faces the water. The drop no longer sticks to the skin, and the water carries it away.',
      evidence: 'Because the outside of each drop now faces the water, the drops no longer stick to the skin, and rinsing carries them away.',
      rubric:
        '两分：写出「肥皂分子的头朝外，油滴的外面现在朝着水（能被水吸引）」给 1 分；写出「油滴不再粘在皮肤上，冲水就把它带走了」再给 1 分。只写「因为肥皂能去油」不给分 —— 题目问的就是为什么。',
    },
  ],
};

// ═══════════════════════════════════════════════════════════════
// 周二 —— 听诊器的发明
// ═══════════════════════════════════════════════════════════════

const STETHOSCOPE = {
  key: 'original-w7-stethoscope',
  title: 'Listening Through a Tube',
  passage: plain([
    "A little over two hundred years ago, a doctor who wanted to know what was happening inside a patient's chest had few ways of finding out. He could tap the chest and listen to the sound it made, or he could press his ear directly against the patient's body. The second method was often uncomfortable for both people, and it did not always work well.",
    'In 1816, a French doctor called René Laennec was working at a hospital in Paris when he was asked to examine a young woman with signs of heart disease. Because she was rather large, tapping her chest told him very little. Because of her age and sex, he felt that putting his ear to her chest would not be proper.',
    "Then he remembered a simple fact about sound. If you put your ear to one end of a piece of wood, you can clearly hear a pin scratching the other end. Laennec rolled some sheets of paper into a tight tube, placed one end on the woman's chest and put his ear to the other. To his surprise, he could hear her heart more clearly than he had ever heard one with his ear alone.",
    'Laennec soon replaced the paper with a hollow wooden tube about 25 centimetres long, and he called his invention a stethoscope, from two Greek words meaning "chest" and "to examine". For the next few years he listened carefully to the chests of many patients. In 1819, he published a book describing the sounds made by healthy and diseased hearts and lungs.',
    "Laennec's stethoscope had only one earpiece. In the early 1850s, doctors in Ireland and the United States developed versions with two earpieces, one for each ear, much like the ones doctors use today. Laennec did not live to see them. He died of tuberculosis, a disease of the lungs, in 1826, at the age of 45. Yet his simple idea is still used in hospitals and clinics every day.",
  ]),
  questions: [
    {
      kind: 'tfng',
      item: 'Before the stethoscope was invented, doctors had no way of examining what was inside the chest.',
      answer: 'FALSE',
      evidence: "He could tap the chest and listen to the sound it made, or he could press his ear directly against the patient's body.",
    },
    {
      kind: 'tfng',
      item: "Laennec studied the sounds of many patients' chests before he published his book.",
      answer: 'TRUE',
      evidence: 'For the next few years he listened carefully to the chests of many patients.',
    },
    {
      kind: 'tfng',
      item: 'The wooden tube that replaced the paper was more than half a metre long.',
      answer: 'FALSE',
      evidence:
        'Laennec soon replaced the paper with a hollow wooden tube about 25 centimetres long, and he called his invention a stethoscope, from two Greek words meaning "chest" and "to examine".',
    },
    {
      kind: 'gapChoice',
      stem: 'With your ear at one end of a piece of wood, you can clearly hear a pin ______ the other end.',
      answer: 'scratching',
      distractors: ['tapping', 'pressing', 'rolling'],
      evidence: 'If you put your ear to one end of a piece of wood, you can clearly hear a pin scratching the other end.',
    },
    {
      kind: 'gapChoice',
      stem: 'The word "stethoscope" comes from two Greek words meaning "chest" and "to ______".',
      answer: 'examine',
      distractors: ['listen', 'hear', 'tap'],
      evidence:
        'Laennec soon replaced the paper with a hollow wooden tube about 25 centimetres long, and he called his invention a stethoscope, from two Greek words meaning "chest" and "to examine".',
    },
    {
      kind: 'gapChoice',
      stem: 'Laennec died of tuberculosis, a disease of the ______.',
      answer: 'lungs',
      distractors: ['heart', 'blood', 'chest'],
      evidence: 'He died of tuberculosis, a disease of the lungs, in 1826, at the age of 45.',
    },
    {
      kind: 'gapTyped',
      summary: true,
      marks: 2,
      stem: 'Laennec could not examine the young woman in the usual ways because ______.',
      answer:
        'she was rather large, so tapping her chest told him very little, and because of her age and sex, putting his ear to her chest would not be proper',
      evidence:
        'Because she was rather large, tapping her chest told him very little. Because of her age and sex, he felt that putting his ear to her chest would not be proper.',
      rubric:
        '两分：写出「她比较胖，敲她的胸口听不出什么」给 1 分；写出「因为她的年龄和性别，把耳朵贴到她胸口不合适」再给 1 分。只写「她有心脏病」不给分 —— 那是要检查的原因，不是没法用老办法的原因。',
    },
    {
      kind: 'short',
      marks: 2,
      stem: 'Using your own words, describe what Laennec did with the paper and what he found.',
      answer:
        "He rolled the paper up into a tube, put one end on the patient's chest and listened at the other end. He found that he could hear her heart better than he had ever heard a heart by putting his ear on a chest.",
      evidence: 'To his surprise, he could hear her heart more clearly than he had ever heard one with his ear alone.',
      rubric:
        '两分：写出「把纸卷成一根筒，一头放在病人胸口、耳朵贴另一头」给 1 分；写出「听到的心跳比他以前直接用耳朵听到的都清楚」再给 1 分。只写「他发明了听诊器」不给分。整句照抄原文只给 1 分。',
    },
    {
      kind: 'short',
      marks: 1,
      stem: 'What did the book that Laennec published in 1819 describe?',
      answer: 'The sounds made by healthy and diseased hearts and lungs.',
      evidence: 'In 1819, he published a book describing the sounds made by healthy and diseased hearts and lungs.',
      rubric:
        '一分：答出「心脏和肺（健康的和有病的）发出的声音」即给分；只写「心和肺的声音」、没写健康 / 有病也给分。只写「他的发明」「听诊器怎么做」不给分。',
    },
    {
      kind: 'short',
      marks: 2,
      stem: 'What change was made to the stethoscope in the early 1850s, and by whom?',
      answer: 'Versions with two earpieces, one for each ear, were developed by doctors in Ireland and the United States.',
      evidence:
        'In the early 1850s, doctors in Ireland and the United States developed versions with two earpieces, one for each ear, much like the ones doctors use today.',
      rubric:
        '两分：写出「做成了两个耳塞（两只耳朵各一个）」给 1 分；写出「是爱尔兰和美国的医生做的」再给 1 分（两个国家都要写出）。写「Laennec 自己改的」不给分 —— 原文说他没活到那时候。',
    },
  ],
};

// ═══════════════════════════════════════════════════════════════
// 周三 —— 驼峰里装的是什么
// ═══════════════════════════════════════════════════════════════

const CAMEL = {
  key: 'original-w7-camel-hump',
  title: "What Is in a Camel's Hump?",
  passage: plain([
    'Ask people what a camel keeps in its hump, and many will say water. It is an easy mistake to make. Camels can cross hot deserts for days without a drink, and the hump looks like a store of something. The Arabian camel has one hump and the Bactrian camel of Central Asia has two, but in both, the hump is made mostly of fat.',
    'The fat is a supply of energy for times when food is hard to find. If a camel goes a long time without eating, it uses up the fat, and the hump becomes smaller and droops.',
    'So how do camels manage without water? Much of the answer lies in how little water they lose. A camel produces very dry droppings and thick urine. When it breathes out, much of the water in its breath is caught in its nose and taken back into the body.',
    'Camels also save water in the way they deal with heat. Instead of sweating to stay cool, a camel allows its body temperature to rise during the day, from about 34°C in the early morning to around 40°C. It then loses the extra heat during the cool desert night.',
    'When a camel does find water, it can make up for lost time. It can drink about 100 litres in less than a quarter of an hour. Its body can also cope with conditions that would kill most other mammals. Its red blood cells are oval rather than round, which helps them keep flowing when the body is short of water, and a camel can lose a quarter of its body weight in water and survive. Most other mammals would die after losing about half as much.',
  ]),
  questions: [
    {
      kind: 'tfng',
      item: 'Bactrian camels can go without water for longer than Arabian camels.',
      answer: 'NOT GIVEN',
    },
    {
      kind: 'tfng',
      item: 'A camel that has not eaten for a long time has a smaller hump.',
      answer: 'TRUE',
      evidence: 'If a camel goes a long time without eating, it uses up the fat, and the hump becomes smaller and droops.',
    },
    {
      kind: 'tfng',
      item: 'Camels are able to smell water from a long way off.',
      answer: 'NOT GIVEN',
    },
    {
      kind: 'gapChoice',
      stem: 'The hump is a supply of ______ for times when food is hard to find.',
      answer: 'energy',
      distractors: ['water', 'heat', 'blood'],
      evidence: 'The fat is a supply of energy for times when food is hard to find.',
    },
    {
      kind: 'gapChoice',
      stem: 'When a camel does find water, it can make up for lost ______.',
      answer: 'time',
      distractors: ['weight', 'heat', 'sleep'],
      evidence: 'When a camel does find water, it can make up for lost time.',
    },
    {
      kind: 'gapChoice',
      stem: "A camel's red blood cells are ______ rather than round.",
      answer: 'oval',
      distractors: ['thick', 'dry', 'small'],
      evidence:
        'Its red blood cells are oval rather than round, which helps them keep flowing when the body is short of water, and a camel can lose a quarter of its body weight in water and survive.',
    },
    {
      kind: 'gapTyped',
      summary: true,
      marks: 2,
      stem: 'Instead of sweating to stay cool, a camel ______.',
      answer: 'lets its body temperature rise during the day, and then loses the extra heat during the cool desert night',
      evidence:
        'Instead of sweating to stay cool, a camel allows its body temperature to rise during the day, from about 34°C in the early morning to around 40°C. It then loses the extra heat during the cool desert night.',
      rubric:
        '两分：写出「白天让体温升高（从清晨约 34°C 升到约 40°C）」给 1 分；写出「到凉爽的夜里再把多出来的热量散掉」再给 1 分。写「躲在阴凉处」「多喝水」不给分 —— 原文没说。',
    },
    {
      kind: 'short',
      marks: 2,
      stem: "Using your own words, explain why many people think a camel's hump holds water, and say what it really contains.",
      answer:
        'Camels can travel through hot deserts for days without drinking, and the hump looks as if it is storing something, so people guess it is water. In fact, it is mostly fat.',
      evidence: 'Camels can cross hot deserts for days without a drink, and the hump looks like a store of something.',
      rubric:
        '两分：写出「骆驼能在炎热的沙漠里好几天不喝水（驼峰看上去像在储存什么东西）」给 1 分；写出「驼峰里其实主要是脂肪」再给 1 分。写「驼峰里是水」不给分 —— 那正是原文说的误解。整句照抄原文只给 1 分。',
    },
    {
      kind: 'short',
      marks: 1,
      stem: 'How much water can a camel drink in less than a quarter of an hour?',
      answer: 'About 100 litres.',
      evidence: 'It can drink about 100 litres in less than a quarter of an hour.',
      rubric: '一分：答出「大约 100 升」即给分。写「一刻钟」「一个驼峰那么多」不给分。',
    },
    {
      kind: 'short',
      marks: 2,
      stem: "How does a camel's breathing help it to save water?",
      answer: 'When it breathes out, much of the water in its breath is caught in its nose and then taken back into its body.',
      evidence: 'When it breathes out, much of the water in its breath is caught in its nose and taken back into the body.',
      rubric:
        '两分：写出「呼气时，气里的很多水分被鼻子截住」给 1 分；写出「这些水分又被重新吸收回身体」再给 1 分。写「骆驼很少呼吸」「骆驼用鼻子喝水」不给分 —— 原文没这么说。',
    },
  ],
};

// ═══════════════════════════════════════════════════════════════
// 周四 —— 坐飞机耳朵为什么会「啵」一下
// ═══════════════════════════════════════════════════════════════

const EARS = {
  key: 'original-w7-ears-pop',
  title: 'Why Ears Pop on a Plane',
  passage: plain([
    'Most people who have flown know the feeling. As the plane climbs or comes down, your ears feel blocked, sounds seem far away, and then, with a small pop, everything returns to normal. The cause is a change in air pressure.',
    'Behind each eardrum is a small space filled with air, called the middle ear. It is connected to the back of the nose by a narrow passage called the Eustachian tube. Most of the time this tube stays closed, but it opens briefly when we swallow or yawn. This lets air in or out, so that the pressure on both sides of the eardrum stays the same.',
    'The air inside a plane is kept at a higher pressure than the thin air outside, but not as high as on the ground. As the plane climbs, the pressure in the cabin falls. The air in the middle ear expands and pushes the eardrum outwards, until some of it escapes through the tube and the ear pops. This happens fairly easily, because the extra pressure itself helps to push the tube open.',
    'Coming down is usually harder. As the pressure in the cabin rises again, the eardrum is pushed inwards, and the tube tends to be squeezed shut. Air can only get back into the middle ear if the tube is opened, which is why landing is often more uncomfortable than take-off. A cold can make things worse by blocking the tube, and babies, whose tubes are narrower, often cry as a plane comes down.',
    'Doctors suggest some simple ways to help. Swallowing, yawning and chewing gum all help to open the tube. Another method is to close your mouth, pinch your nose and blow gently. Babies can be given a bottle to suck, since sucking makes them swallow. Doctors also advise passengers not to sleep during take-off and landing, so that they can use these methods as soon as they feel the pressure building.',
  ]),
  questions: [
    {
      kind: 'tfng',
      item: 'The Eustachian tube opens for a short time when a person swallows.',
      answer: 'TRUE',
      evidence: 'Most of the time this tube stays closed, but it opens briefly when we swallow or yawn.',
    },
    {
      kind: 'tfng',
      item: 'The air pressure inside a plane is kept the same as on the ground.',
      answer: 'FALSE',
      evidence: 'The air inside a plane is kept at a higher pressure than the thin air outside, but not as high as on the ground.',
    },
    {
      kind: 'tfng',
      item: 'Ear problems are more common on small planes than on large ones.',
      answer: 'NOT GIVEN',
    },
    {
      kind: 'gapChoice',
      stem: 'The middle ear is connected to the back of the ______ by a narrow passage.',
      answer: 'nose',
      distractors: ['mouth', 'eardrum', 'neck'],
      evidence:
        'It is connected to the back of the nose by a narrow passage called the Eustachian tube.',
    },
    {
      kind: 'gapChoice',
      stem: 'A cold can make things worse by ______ the tube.',
      answer: 'blocking',
      distractors: ['opening', 'squeezing', 'pinching'],
      evidence:
        'A cold can make things worse by blocking the tube, and babies, whose tubes are narrower, often cry as a plane comes down.',
    },
    {
      kind: 'gapChoice',
      stem: 'Babies can be given a bottle to ______, since this makes them swallow.',
      answer: 'suck',
      distractors: ['chew', 'blow', 'hold'],
      evidence: 'Babies can be given a bottle to suck, since sucking makes them swallow.',
    },
    {
      kind: 'gapTyped',
      summary: true,
      marks: 2,
      stem: 'As a plane climbs, the air in the middle ear ______.',
      answer: 'expands and pushes the eardrum outwards, until some of it escapes through the tube and the ear pops',
      evidence:
        'The air in the middle ear expands and pushes the eardrum outwards, until some of it escapes through the tube and the ear pops.',
      rubric:
        '两分：写出「中耳里的空气膨胀，把鼓膜往外顶」给 1 分；写出「一部分空气从咽鼓管跑出去，耳朵就「啵」一下」再给 1 分。写「鼓膜被往里压」不给分 —— 那是飞机下降时的情况。',
    },
    {
      kind: 'short',
      marks: 2,
      stem: 'Using your own words, explain why landing is often more uncomfortable than take-off.',
      answer:
        'On the way down, the cabin pressure goes up, so the eardrum is pressed inwards and the tube gets squashed closed. Air cannot get back into the middle ear unless the tube is made to open.',
      evidence:
        'Air can only get back into the middle ear if the tube is opened, which is why landing is often more uncomfortable than take-off.',
      rubric:
        '两分：写出「下降时舱内气压回升，鼓膜被往里压，咽鼓管被压扁、合上」给 1 分；写出「只有把咽鼓管打开，空气才能回到中耳（不像起飞时空气自己就能跑出去）」再给 1 分。只写「因为气压变化」不给分 —— 起飞时气压也在变。整句照抄原文只给 1 分。',
    },
    {
      kind: 'short',
      marks: 1,
      stem: 'Why do doctors advise passengers not to sleep during take-off and landing?',
      answer: 'So that they can use these methods, such as swallowing or yawning, as soon as they feel the pressure building.',
      evidence:
        'Doctors also advise passengers not to sleep during take-off and landing, so that they can use these methods as soon as they feel the pressure building.',
      rubric:
        '一分：答出「醒着才能一感觉到耳朵发胀，就马上用吞咽、打哈欠等办法」即给分。写「睡着了会错过飞机餐」「睡着了更容易感冒」不给分 —— 原文没说。',
    },
    {
      kind: 'short',
      marks: 2,
      stem: 'Give TWO ways suggested by doctors to help an adult passenger open the tube.',
      answer: 'Any two of: swallow; yawn; chew gum; close the mouth, pinch the nose and blow gently.',
      evidence: 'Swallowing, yawning and chewing gum all help to open the tube.',
      rubric:
        '两分：以下任答两种，每种 1 分：①吞咽；②打哈欠；③嚼口香糖；④闭上嘴、捏住鼻子、轻轻往外鼓气（只写「捏鼻子」也算这一种）。写「起降时别睡觉」不给分 —— 那是为了能随时用这些办法，本身不能打开咽鼓管。写「给奶瓶吸」不给分 —— 那是给婴儿的办法。',
    },
  ],
};

// ═══════════════════════════════════════════════════════════════
// 周五 —— 钟乳石怎么长出来
// ═══════════════════════════════════════════════════════════════

const STALACTITES = {
  key: 'original-w7-stalactites',
  title: 'Icicles Made of Stone',
  passage: plain([
    'Shine a torch into a limestone cave and you may see hundreds of stony points hanging from the ceiling like icicles. These are stalactites, and their name comes from a Greek word meaning "dripping". It is a good name, because each one is built almost drop by drop.',
    'The story starts above ground. Rainwater picks up carbon dioxide from the air and the soil, which turns it into a weak acid. As it soaks down through cracks in limestone, it slowly dissolves some of the rock. Over a very long time, this can widen the cracks into caves.',
    'The water now carries dissolved rock with it. When a drop hangs from the ceiling of a cave, some of its carbon dioxide escapes into the cave air, and the water can no longer hold all the rock it is carrying. A tiny ring of mineral is left behind. Drop after drop, these rings build up into a thin, hollow tube known as a soda straw. If the inside of the straw becomes blocked, water starts to run down the outside instead, and the stalactite slowly thickens into a cone.',
    'Drops that fall to the floor leave mineral there too, building stalagmites that grow upwards. There is an easy way to remember which is which: stalactites, with a c, hang from the ceiling, while stalagmites, with a g, rise from the ground. Given enough time, a stalactite and the stalagmite below it can meet and join to form a column.',
    'All of this happens extremely slowly. On average, a stalactite grows by only about 0.13 millimetres a year, so adding a single centimetre can take more than seventy years. Because they grow so slowly, any damage lasts for a very long time, and visitors to caves are usually asked not to touch them. Oil from human skin can stop the mineral from sticking, so the part that was touched may stop growing.',
  ]),
  questions: [
    {
      kind: 'tfng',
      item: 'The first stalactites to be studied by scientists were in Greece.',
      answer: 'NOT GIVEN',
    },
    {
      kind: 'tfng',
      item: 'A stalactite usually grows several centimetres in a year.',
      answer: 'FALSE',
      evidence: 'On average, a stalactite grows by only about 0.13 millimetres a year, so adding a single centimetre can take more than seventy years.',
    },
    {
      kind: 'tfng',
      item: 'A stalactite and a stalagmite can grow into a single piece.',
      answer: 'TRUE',
      evidence: 'Given enough time, a stalactite and the stalagmite below it can meet and join to form a column.',
    },
    {
      kind: 'gapChoice',
      stem: 'The name "stalactite" comes from a Greek word meaning "______".',
      answer: 'dripping',
      distractors: ['hanging', 'growing', 'rising'],
      evidence: 'These are stalactites, and their name comes from a Greek word meaning "dripping".',
    },
    {
      kind: 'gapChoice',
      stem: 'Carbon dioxide from the air and the soil turns rainwater into a weak ______.',
      answer: 'acid',
      distractors: ['mineral', 'rock', 'drop'],
      evidence: 'Rainwater picks up carbon dioxide from the air and the soil, which turns it into a weak acid.',
    },
    {
      kind: 'gapChoice',
      stem: 'Drop after drop, the rings build up into a thin, hollow tube known as a soda ______.',
      answer: 'straw',
      distractors: ['column', 'cone', 'ring'],
      evidence: 'Drop after drop, these rings build up into a thin, hollow tube known as a soda straw.',
    },
    {
      kind: 'gapTyped',
      summary: true,
      marks: 2,
      stem: 'A tiny ring of mineral is left on the cave ceiling because ______.',
      answer: 'some carbon dioxide escapes from the hanging drop into the cave air, so the water can no longer hold all the rock it is carrying',
      evidence:
        'When a drop hangs from the ceiling of a cave, some of its carbon dioxide escapes into the cave air, and the water can no longer hold all the rock it is carrying.',
      rubric:
        '两分：写出「挂在洞顶的水滴里有一部分二氧化碳跑到洞里的空气中」给 1 分；写出「水就拿不住它带着的全部溶解岩石（只好留下一些）」再给 1 分。写「水滴结冰了」「水被晒干了」不给分 —— 原文没这么说。',
    },
    {
      kind: 'short',
      marks: 2,
      stem: 'Using your own words, explain how a soda straw changes into a cone-shaped stalactite.',
      answer:
        'The hole in the middle of the straw gets blocked up. The water then has to flow down the outside, so the stalactite gradually gets fatter and becomes a cone.',
      evidence:
        'If the inside of the straw becomes blocked, water starts to run down the outside instead, and the stalactite slowly thickens into a cone.',
      rubric:
        '两分：写出「细管里面（中间的孔）被堵住了」给 1 分；写出「水只好顺着外面往下流，钟乳石慢慢变粗、成了锥形」再给 1 分。写「两根细管长到一起」不给分。整句照抄原文只给 1 分。',
    },
    {
      kind: 'short',
      marks: 1,
      stem: 'Where do stalagmites form?',
      answer: 'On the floor of the cave, where the drops fall.',
      evidence: 'Drops that fall to the floor leave mineral there too, building stalagmites that grow upwards.',
      rubric:
        '一分：答出「在洞底（地上），水滴落下的地方」即给分；写「在钟乳石正下方的地上」也给分。写「挂在洞顶」不给分 —— 那是钟乳石。',
    },
    {
      kind: 'short',
      marks: 2,
      stem: 'Why are visitors to caves usually asked not to touch stalactites?',
      answer:
        'Oil from their skin can stop the mineral from sticking, so the part they touched may stop growing, and because stalactites grow so slowly, the damage lasts a very long time.',
      evidence: 'Oil from human skin can stop the mineral from sticking, so the part that was touched may stop growing.',
      rubric:
        '两分：写出「人手皮肤上的油会让矿物粘不上去」给 1 分；写出「被摸过的地方可能就不再长了（钟乳石长得极慢，损坏要很久才恢复）」再给 1 分。只写「会把它碰断」不给分 —— 原文说的是皮肤上的油。',
    },
  ],
};

const SPECS = [SOAP, STETHOSCOPE, CAMEL, EARS, STALACTITES];

module.exports = {
  LEVEL,
  SPECS,
  DAYS: DATES.slice(0, SPECS.length).map((date, i) => buildAuthoredDay(SPECS[i], date)),
};
