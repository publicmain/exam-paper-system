/**
 * 第九周 —— **ielts_authentic（雅思真题难度）**档，全原创；周二学术说明文，周三至周五 GP 议论文。
 *
 * 形状与第八周这一档一致：八段、按 Paragraph A–H 编号；
 *   3 道段落信息配对 · 3 道判断 · 2 道原文单词填空（要拼写） ·
 *   2 道两分主观题 —— 满分 12。
 * 本周叶老师要求「整体难一点」：篇幅从第八周的约 600 词提到 750–800 词，长句、让步、
 * 限定更多（however / yet / nonetheless / few would claim …）；题目多考跨句指代、
 * 原因与推断，段落配对的干扰段落都谈到相近的话题。
 *
 * 本周选题（四天；括号里是徽章主题）：
 *   周二 health  碘与加碘盐（The Element in the Salt）
 *                —— 碘是甲状腺激素的原料、对早期脑发育必不可少；山区与冰川覆盖过的土壤缺碘、
 *                   甲状腺代偿性肿大成甲状腺肿；Courtois 1811 年从海藻灰
 *                   里发现碘，日内瓦医生 Coindet 1820 年前后用碘治甲状腺肿、剂量过大有副作用而
 *                   受冷落；1917–1922 年美国俄亥俄州 Akron 女学生预防试验；瑞士 1922、密歇根
 *                   1924 年推加碘盐，「甲状腺肿带」病例骤降；WHO / UNICEF 1993 年建议全民食盐
 *                   加碘、选盐的理由；缺碘国家从一百多个降到二十个左右；英国从没强制加碘、
 *                   碘「意外地」来自牛奶，2011 年少女调查过半轻度缺碘，饮食变化可能有关；
 *                   减盐运动与加碘的张力、加工食品多用非碘盐、碘过量也伤甲状腺。
 *   周三 technology  联网设备应否保留离线能力（The Case for an Offline Switch；GP 议论文）
 *                —— 联网的协调、诊断优势与服务依赖之间如何取舍；承认孤立设备也会失灵，
 *                   以本地基本功能、兼容协议及断网重启演示界定有条件的联网采购原则。
 *   周四 psychology  选择越多是否越自由（The Freedom to Choose Less；GP 议论文）
 *                —— 广泛选项能容纳不同偏好，却也增加比较和反复权衡的负担；区分选项数量、
 *                   信息质量与可撤回性，以可自行调整的筛选和重新选择回应「替人作主」的反对意见。
 *   周五 nature  校园花园应否清走所有落叶（What a Garden Owes Its Soil；GP 议论文）
 *                —— 通行与植物管理需要整理，但落叶也是土壤循环的原料；比较原地保留与堆肥，
 *                   主张依位置、厚度和植物需求决定，结尾以对土壤过程的长期观察取代表面整洁。
 *
 * 全周判断题：周二 F/NG/F · 周三 T/T/NG · 周四 NG/F/NG · 周五 T/F/T →
 * TRUE 4 · FALSE 4 · NOT GIVEN 4；每天只有两种答案，没有一天三种各一或全部相同。
 * 周二两道 FALSE 仍保留原判据；新增 FALSE 分别区分「可改筛选」与「隐藏选项」、
 * 「集中堆肥」与「原地分解」。NOT GIVEN 考未提供的时长、年龄比较及活动实际报名结果。
 *
 * 事实只按已有知识核对（本周写作环境不许上网），见下方注释的把握程度；
 * 「高」= 公认、多处出处一致；「中高」= 有把握但细节可能有出入，正文已写得更含糊。
 * 新增三篇事实核对：本地网络不等于互联网、云端控制会引入外部服务依赖、协议约定设备
 * 通讯规则 —— 高；比较需要时间、可撤回决定与不可撤回决定的代价不同 —— 高，属于
 * 论证的逻辑前提，不冒充心理实验结论；分解者参与落叶分解并释放养分、有机质有助于
 * 保水、厚叶层可能遮光、堆肥需要转运整理 —— 高，均为基础原理，正文限定适用条件。
 * 新文无研究人名、年份、统计数字；设备、工作坊、图书目录及校园花园均为明确设例，
 * 不是某校实测或真实项目报道。每篇按「论题—双方最强理由—让步权衡—条件结论」展开；
 * 两分题均含 GP 论证分析，评分逐点列出，证据保留连续的原文逐字片段。
 *
 * 查重：对过 `pack-titles-1023.txt`（内容包 1–8 周 199 篇）与 `read-titles-1023.txt`
 * （学生交过卷的 215 篇）。关键词 iodine / iodise / goitre / thyroid 在内容包各周文件与
 * test-fixtures 里搜过，无重合（test-fixtures 只命中 periodic / biodiversity 之类的子串）。
 * 需要说明的两处相近：
 *   · 第八周 ielts_light 有「Where the Salt Comes From」（盐从哪里来：海盐、岩盐的形成）。
 *     本篇讲的是碘缺乏与公共卫生政策，盐只是「载体」，不写盐的来源与制法。
 *   · 第七周本档周二「补液盐」、更早的「坏血病」也是公共卫生 / 营养史。本篇的骨架是
 *     「靠一种日常食品给全民补一种微量元素，成功后又在富裕国家回潮」，不写航海、腹泻，
 *     结尾落在减盐与加碘的张力，和那两篇的「发现疗法」骨架不同。
 * 人名：Courtois、Coindet 都没在第八周出现过。俄亥俄那项试验的两位医生故意不写名字 ——
 * 其中一位姓 Marine，会和常用词 marine 撞进词表。
 *
 * 校园内容安全：全文无疾病死亡、无身体隐私细节；「怀孕」相关只用 the earliest stages of
 * life / early development 带过，不写 pregnancy、birth；不写 brain damage，只写
 * lasting harm to the brain。
 * 新增查重：完整核对上述两份标题表，并检索内容包与 test-fixtures 的 offline / smart
 * building / interoperability / choice overload / too many choices / leaf litter /
 * fallen leaves / mulch 等关键词；未发现同主论题文章。相近处逐一核读：
 *   · The Root Network 是根与真菌的交换及证据争议；旧题库草原篇是深层土壤碳与恢复，
 *     Fire as a Management Tool 是火管理；周五讨论落叶去留，不写上述机制或论证骨架。
 *   · The Bus Stop Garden 是共同种植改善候车空间；周五不是造园故事，核心是清理标准。
 *   · 第八周木蛙篇仅以落叶作越冬场景；不是落叶分解及园艺管理的论题。
 *   · 第七周默认选项篇讨论预设造成的参与差异；周四讨论比较负担与自主筛选，刻意不写
 *     默认选项和相关实验。周三的 offline 不指旧题库睡眠篇的「离线记忆巩固」。
 * 三篇无人名，不复用第八周人物；不写政府政策评价或敏感争议。周二正文和题目原样保留。
 */

'use strict';

const { buildAuthoredDay, lettered } = require('../authored');
const { DATES } = require('./dates');

const LEVEL = 'ielts_authentic';

// ═══════════════════════════════════════════════════════════════
// 周二 —— 盐里的元素：碘缺乏与加碘盐（health）
// 徽章主题：health
//
// 出处与把握：
// · 甲状腺位于颈前，用碘合成甲状腺激素，调节代谢、对胎儿和婴幼儿脑发育必不可少 —— 高。
// · 碘主要在海洋里；山区、冰川覆盖过的地区（冰融水、降雨长期淋洗）土壤缺碘，当地作物、
//   牲畜含碘少；缺碘时甲状腺代偿性增大成甲状腺肿 —— 高（WHO、Zimmermann 综述等通行说法）。
// · Bernard Courtois 1811 年处理海藻灰时看到紫色蒸气、发现碘 —— 高。
// · Jean-François Coindet（日内瓦）1820 年起用碘治甲状腺肿，效果不错；剂量偏大，有人出现
//   副作用（所谓「碘中毒」），此后几十年这一疗法受到怀疑 —— 中高（正文写 sometimes far
//   larger than necessary、regarded with suspicion for much of the century that followed）。
// · 1917–1922 年 David Marine 与 O. P. Kimball 在俄亥俄州 Akron 给女学生每年两次小剂量
//   碘化钠，服碘组新发甲状腺肿远少于对照组 —— 高（正文不写人数；不写人名，见文件头）。
// · 瑞士 1922 年开始加碘盐（先在部分州）—— 高；美国 1924 年密歇根州加碘盐上市，五大湖一带
//   被称为 goitre belt —— 高；密歇根学童甲状腺肿几年内大幅下降 —— 高（正文不写百分比）。
// · 重度缺碘损害儿童早期脑发育；中度缺碘可能拉低人群平均认知测验成绩 —— 高。
//   （WHO「最常见的可预防智力损害原因」那句为压篇幅删了，正文不写。）
// · 1993 年 WHO / UNICEF 建议全民食盐加碘（universal salt iodisation：供人和牲畜食用的盐都
//   加碘）—— 高（联合声明 1993–1994 年间）。选盐的理由：人人吃、每天吃得差不多、
//   加碘便宜且不改味道 —— 高。
// · 今天全球多数家庭用上加碘盐（UNICEF 约九成）—— 高，正文写 most；被列为缺碘的国家从
//   1993 年的一百一十多个降到 2020 年前后的二十个左右（Iodine Global Network 记分卡）——
//   中高（正文写 more than 100 … to around 20）。小规模制盐者难以稳定加碘 —— 高。
// · 英国从未强制食盐加碘；碘主要来自牛奶，因为饲料添加碘、乳品场用含碘消毒剂 —— 高。
//   Vanderpump et al. 2011（Lancet）：英国 14–15 岁女生，约 51% 轻度、16% 中度、1% 重度缺碘
//   —— 高（正文写 more than half showed signs of at least mild deficiency）。植物奶多数不强化碘、
//   海盐岩盐一般不加碘 —— 高。
// · 吃盐多升高血压、各国推减盐；WHO 认为减盐与加碘相容（盐少吃了就提高加碘浓度）—— 高。
//   不少国家吃进去的盐大多来自加工食品，生产商多数不必用加碘盐 —— 高。碘过量也会扰乱
//   甲状腺功能 —— 高。
// ═══════════════════════════════════════════════════════════════

const IODINE = {
  key: 'original-w9-iodised-salt',
  title: 'The Element in the Salt',
  passage: lettered([
    `For most people in wealthy countries, iodine is the kind of nutrient that is easy to overlook. Yet this trace element is indispensable: the thyroid gland, which sits at the front of the neck, uses it to manufacture hormones that regulate the body's metabolism and that are essential for the normal development of the brain, particularly in the earliest stages of life. The way in which iodine deficiency was largely brought under control, through a measure as modest as adding a chemical to table salt, is often cited as one of the most cost-effective achievements in public health. That achievement, however, is not yet complete.`,
    `Most of the world's iodine is found in the oceans, and its concentration in soil varies widely. In mountainous regions, and in areas that were once covered by glaciers, melting ice and heavy rainfall have gradually washed much of it away. Crops grown in such soils, and animals that graze on them, contain correspondingly little, so communities that depend on local food may consume far less than they need. When this happens, the thyroid gland enlarges in an attempt to capture more of the element from the blood, producing a visible swelling known as a goitre.`,
    `The connection was not understood until the nineteenth century. Iodine itself was identified in 1811 by the French chemist Bernard Courtois, who noticed a violet vapour rising from the seaweed ash he was processing. Within a decade, Jean-François Coindet, a physician in Geneva, had begun treating patients with goitre using iodine, often with encouraging results. Because the doses he and his followers prescribed were sometimes far larger than necessary, however, a number of patients suffered unpleasant side effects, and the treatment was regarded with suspicion for much of the century that followed.`,
    `What eventually changed medical opinion was evidence from prevention rather than cure. Between 1917 and 1922, two American physicians gave small doses of iodine twice a year to schoolgirls in Akron, Ohio, a city where goitre was widespread. Compared with girls who had not received it, those who took part developed far fewer new goitres. Switzerland began adding iodine to salt in 1922, and in 1924 iodised salt went on sale in the American state of Michigan, part of a region so badly affected that it was known as the "goitre belt". Within a few years, surveys of schoolchildren there recorded a dramatic decline in the condition.`,
    `Goitre, however, turned out to be merely the most visible consequence. Researchers came to recognise that severe deficiency during a child's early development can cause lasting harm to the brain, and that even moderate deficiency across a whole population may lower average performance in tests of thinking and learning. In 1993, the World Health Organization (WHO) and UNICEF recommended that all salt for people and farm animals be iodised. Salt was chosen for several reasons: almost everyone eats it, the amount consumed varies relatively little from day to day, and adding iodine costs very little and does not noticeably alter its taste.`,
    `The results have been striking. Today most of the world's households use iodised salt, and the number of countries classified as iodine-deficient has fallen from more than 100 in the early 1990s to around 20. Few experts would claim, though, that the problem has been solved: national averages can conceal considerable differences between regions and social groups, and in some poorer rural areas salt is still made by small producers who lack the equipment to iodise it consistently.`,
    `Nor are wealthy countries immune. In Britain, where iodising salt has never been compulsory, iodine has come mainly from milk, and largely by accident: cattle feed is often supplemented with it, and iodine-based disinfectants have been used to clean equipment on dairy farms. A survey of schoolgirls aged 14 and 15 in the United Kingdom, published in 2011, nonetheless found that more than half showed signs of at least mild deficiency. Changes in diet may help to explain such findings. Many people now drink less milk, or replace it with plant-based alternatives that are not always supplemented with iodine, and sea salts and rock salts are generally sold without any added iodine.`,
    `A further complication is that, because eating too much salt raises blood pressure, health authorities in many countries urge people to consume less of it, which might appear to weaken the case for relying on salt to deliver iodine. The WHO argues that the two policies are compatible, since the concentration of iodine in salt can be increased as consumption falls. Yet in many countries most of the salt that people eat is not added at the table but is already present in processed food, and manufacturers are frequently not required to use the iodised kind. Getting the balance right matters in both directions, as too much iodine can also disturb the thyroid. A remedy that once seemed simple therefore depends on continuing attention to what people actually eat.`,
  ]),
  questions: [
    {
      kind: 'matchingParagraphs',
      items: [
        { item: 'a study carried out in a country that has never required salt to be iodised', letter: 'G' },
        { item: 'a reason why an early remedy fell out of favour', letter: 'C' },
        { item: 'a natural process that has left some communities short of a nutrient', letter: 'B' },
      ],
    },
    {
      kind: 'tfng',
      item: "Coindet's use of iodine was viewed with suspicion because it failed to reduce goitres.",
      answer: 'FALSE',
      evidence:
        'Within a decade, Jean-François Coindet, a physician in Geneva, had begun treating patients with goitre using iodine, often with encouraging results.',
      explanation:
        '原文说 Coindet 的治疗「often with encouraging results」（效果常常不错），受到怀疑是因为剂量过大、有人出现副作用（Because the doses … were sometimes far larger than necessary … side effects），不是因为没效果。题干把原因说成「没能让甲状腺肿变小」，与原文相反，所以选 FALSE。',
    },
    {
      kind: 'tfng',
      item: 'The 2011 survey found that girls who drank plant-based alternatives to milk were more likely to be iodine-deficient.',
      answer: 'NOT GIVEN',
      explanation:
        '原文只说那次调查发现过半女生至少轻度缺碘，接着作者自己推测「饮食变化可能有助于解释」（may help to explain），并列举少喝牛奶、改喝植物奶等。原文没有说调查本身比较过喝不喝植物奶的女生，既不能证实也不能否定，所以选 NOT GIVEN。',
    },
    {
      kind: 'tfng',
      item: 'According to the WHO, encouraging people to eat less salt makes it impossible to rely on salt as a source of iodine.',
      answer: 'FALSE',
      evidence:
        'The WHO argues that the two policies are compatible, since the concentration of iodine in salt can be increased as consumption falls.',
      explanation:
        '原文前一句说减盐「might appear to」（看起来似乎）削弱了靠盐补碘的理由，但紧接着说 WHO 认为两项政策相容 —— 少吃盐时可以提高盐里的碘浓度。题干说 WHO 认为「不可能」再靠盐补碘，与原文相反，所以选 FALSE。',
    },
    {
      kind: 'gapTyped',
      stem: 'When a person does not get enough iodine, the thyroid gland ______ in an attempt to capture more of the element from the blood.',
      answer: 'enlarges',
      evidence:
        'When this happens, the thyroid gland enlarges in an attempt to capture more of the element from the blood, producing a visible swelling known as a goitre.',
    },
    {
      kind: 'gapTyped',
      stem: 'In some poorer rural areas, salt is still made by small ______ who lack the equipment to iodise it consistently.',
      answer: 'producers',
      evidence:
        'national averages can conceal considerable differences between regions and social groups, and in some poorer rural areas salt is still made by small producers who lack the equipment to iodise it consistently.',
    },
    {
      kind: 'short',
      marks: 2,
      stem: "According to Paragraph G, why does the writer say that milk has supplied iodine in Britain 'largely by accident', and what changes in people's habits may now be reducing their iodine intake?",
      answer:
        'The iodine gets into milk because cattle feed is often supplemented with it and iodine-based disinfectants are used to clean dairy equipment, not because anyone set out to add iodine to people\'s diet. Today many people drink less milk or switch to plant-based drinks that are not always supplemented with iodine, and sea salts and rock salts usually contain no added iodine.',
      evidence:
        'In Britain, where iodising salt has never been compulsory, iodine has come mainly from milk, and largely by accident: cattle feed is often supplemented with it, and iodine-based disinfectants have been used to clean equipment on dairy farms.',
      rubric:
        '两分：写出「牛奶里的碘是因为牛饲料常添加碘、乳品场用含碘消毒剂清洗设备而带进去的 —— 并不是有意给人补碘」给 1 分（写出饲料或消毒剂其中一项来源并说到「不是有意的 / 本来不是为了给人补碘」即可；只写「来自牛奶」不给这一分）；写出「现在很多人少喝牛奶或改喝不一定加碘的植物奶，或改用一般不加碘的海盐 / 岩盐」再给 1 分（三项写出任一项即可）。只写「英国从没强制食盐加碘」给 0 分（那是背景，不是「意外」的原因，也不是习惯的变化）；只写「过半女生缺碘」给 0 分（那是调查结果）。',
    },
    {
      kind: 'short',
      marks: 2,
      stem: 'According to Paragraph H, why might campaigns to reduce salt intake seem to conflict with salt iodisation, and why might raising the amount of iodine in salt still not fully solve the problem?',
      answer:
        'If people eat less salt, they also take in less of the iodine that is added to it, so cutting salt seems to undermine salt as a way of delivering iodine. Raising the iodine content of salt may not be enough because in many countries most of the salt people eat is already in processed food, and manufacturers often do not have to use iodised salt.',
      evidence:
        'Yet in many countries most of the salt that people eat is not added at the table but is already present in processed food, and manufacturers are frequently not required to use the iodised kind.',
      rubric:
        '两分：写出「碘是加在盐里的，人们少吃盐就会同时少摄入碘，所以减盐看起来削弱了靠盐补碘」给 1 分（要说到「少吃盐 → 少摄入碘」这层因果；只写「吃盐太多会升高血压」不给这一分）；写出「很多国家人们吃的盐大多已经在加工食品里，而食品生产商常常不必用加碘盐，所以只提高食盐里的碘未必能送到人们口中」再给 1 分（写出「盐大多来自加工食品」并说到「加工食品不一定用加碘盐」即可）。只写「碘过多也会扰乱甲状腺」给 0 分（那是另一个问题，不回答本题）；只写「WHO 认为两者相容」给 0 分（那是对冲突的回应，不是冲突本身或剩下的问题）。',
    },
  ],
};

// ═══════════════════════════════════════════════════════════════
// 周三 —— 联网的收益是否值得付出依赖的代价？（GP 议论文）
// 徽章主题：technology；基础技术事实把握高；所有采购场景都是设例。
// ═══════════════════════════════════════════════════════════════

const OFFLINE = {
  key: 'original-w9-offline-switch',
  title: 'The Case for an Offline Switch',
  passage: lettered([
    `When a school replaces an ordinary lamp with one controlled through an online service, it acquires more than a convenient switch. It also acquires a relationship with a network, a supplier and software that someone must maintain. Supporters regard such connections as the foundation of efficient buildings; sceptics see an unnecessary dependence being attached to ordinary objects. Should institutions therefore prefer equipment that remains offline? The more defensible position is conditional: connection should earn its place through useful coordination, while essential functions should remain available when the external service cannot be reached.`,
    `The strongest argument for connected equipment concerns coordination rather than novelty. Consider a school with rooms whose timetables change throughout the week. A connected system could adjust lighting to the current schedule, report a faulty fitting and allow a technician to inspect its status without visiting every classroom. Separate controls might perform each individual task adequately, yet leave staff to reconcile conflicting schedules themselves. Where equipment must work together, communication can reduce duplication and make faults visible earlier. Dismissing these gains as mere convenience overlooks the labour required to achieve the same result by repeated manual inspection. Its value lies in enabling a shared response to changing circumstances, rather than merely allowing the same button to be pressed from farther away.`,
    `Nevertheless, equipment can be connected in substantially different ways. A controller communicating within a local network need not send every instruction across the internet. By contrast, a lamp that accepts commands only through a supplier's external server depends on that server even when the person requesting light is standing beside it. If the internet connection fails, the first arrangement may continue operating while the second cannot receive commands. The relevant distinction is therefore where control resides. A physical switch that directly operates the lamp preserves an ordinary capability which an elaborate interface, however attractive, may fail to provide.`,
    `Granted, advocates of fully networked buildings have a legitimate objection: isolated equipment is not automatically dependable. A local sensor can produce an incorrect reading, and without remote diagnostics a technician may need longer to identify the problem. This objection limits the case for independence but does not eliminate it. Requiring a device to retain basic local functions is compatible with using a network for diagnosis and coordination. The choice is not between communicating objects and permanently isolated ones. It is between communication that extends a working device and communication whose absence prevents that device from fulfilling its primary purpose.`,
    `Independence also concerns what happens when a supplier changes its products. Two controllers may both offer scheduling, yet be unable to exchange instructions because they use incompatible protocols, the agreed rules by which devices communicate. If replacing one component requires replacing an otherwise serviceable system, apparent efficiency has concealed a longer obligation. Accessible documentation and compatible interfaces can make a later change of supplier more practical. Neither guarantees that every replacement will work without adjustment; they do, however, allow purchasers to examine whether continued use depends on cooperation from a single company rather than on the condition of the equipment itself. A purchasing price that excludes this later dependence may therefore be a poor guide to the actual commitment.`,
    `There is a serious economic objection to demanding alternatives for everything. Maintaining a complete second control system would require money, training and regular checks; an unused backup might itself become unreliable. While it is true that resilience has value, its price must be proportionate to the function being protected. A fallback for a classroom lamp could be a direct manual switch, rather than a duplicate application reproducing every scheduling feature. Distinguishing essential operation from optional convenience allows a purchaser to preserve what matters without paying to reproduce the entire online experience under every conceivable circumstance.`,
    `Purchasing decisions should therefore include a demonstration rather than rely entirely on a list of features. Imagine asking a supplier to disconnect the internet and then restart the equipment, showing which essential functions remain available after both events. Restarting matters because a device may preserve an existing state during an interruption yet require an external service to initialise again. Staff should also demonstrate that they can operate the remaining controls without assistance from the supplier. Such an exercise cannot establish permanent reliability, but it can reveal dependencies that a demonstration conducted under ideal conditions would leave concealed.`,
    `An offline switch is consequently a principle of design, not a rejection of technical progress. Institutions should accept connectivity where its coordination benefits are substantial, provided that essential operation survives the loss of an external service and that future maintenance remains practical. Equipment whose primary purpose is communication may justify different requirements from equipment whose purpose is simply to illuminate a room. Applying that distinction requires judgement rather than a universal prohibition. The strongest system is not necessarily the one with the fewest connections, but one whose users understand what those connections add and what their absence would remove.`,
  ]),
  questions: [
    {
      kind: 'matchingParagraphs',
      items: [
        { item: 'an explanation of how communication rules can affect the freedom to change suppliers', letter: 'E' },
        { item: 'an argument that separate devices can transfer the work of coordination to employees', letter: 'B' },
        { item: 'a concession to supporters of networking followed by a distinction that preserves the main argument', letter: 'D' },
      ],
    },
    {
      kind: 'tfng',
      item: 'The passage distinguishes loss of internet access from loss of all communication between devices.',
      answer: 'TRUE',
      evidence:
        "A controller communicating within a local network need not send every instruction across the internet. By contrast, a lamp that accepts commands only through a supplier's external server depends on that server even when the person requesting light is standing beside it. If the internet connection fails, the first arrangement may continue operating while the second cannot receive commands.",
      explanation:
        'C 段区分本地网络通信和经互联网访问外部服务器：断网时前者仍可能工作，后者收不到指令。因此失去互联网不等于设备间一切通信都消失，选 TRUE；may 表示可能，不是保证所有本地系统都正常。',
    },
    {
      kind: 'tfng',
      item: 'The writer accepts that the cost of preserving independent operation should be judged against the importance of the function concerned.',
      answer: 'TRUE',
      evidence:
        'While it is true that resilience has value, its price must be proportionate to the function being protected.',
      explanation:
        'F 段承认完整备用系统要花钱、培训和检查，接着要求成本与所保护功能相称；不是不计代价追求离线，所以选 TRUE。',
    },
    {
      kind: 'tfng',
      item: 'The proposed purchasing demonstration would take less than an hour to complete.',
      answer: 'NOT GIVEN',
      explanation:
        'G 段交代断网、重启和工作人员操作的演示内容，没有交代完成演示所需时长，无法判定是否少于一小时，选 NOT GIVEN。',
    },
    {
      kind: 'gapTyped',
      stem: 'The agreed rules governing communication between devices are called ______.',
      answer: 'protocols',
      evidence:
        'Two controllers may both offer scheduling, yet be unable to exchange instructions because they use incompatible protocols, the agreed rules by which devices communicate.',
    },
    {
      kind: 'gapTyped',
      stem: 'The writer proposes a purchasing ______ to expose requirements that an ideal presentation might hide.',
      answer: 'demonstration',
      evidence:
        'Purchasing decisions should therefore include a demonstration rather than rely entirely on a list of features.',
    },
    {
      kind: 'short',
      marks: 2,
      stem: 'According to Paragraph D, what objection does the writer accept, and how is it reconciled with the argument for local independence?',
      answer:
        'Local equipment can also fail, and the absence of remote diagnostics can delay diagnosis. However, retaining basic local operation does not prevent a device from also using a network for diagnosis and coordination.',
      evidence:
        'A local sensor can produce an incorrect reading, and without remote diagnostics a technician may need longer to identify the problem. This objection limits the case for independence but does not eliminate it. Requiring a device to retain basic local functions is compatible with using a network for diagnosis and coordination.',
      rubric:
        '两分：写出让步「本地设备也会失灵；没有远程诊断可能更难 / 更慢查明问题」给 1 分（写出其中一项具体局限即可；只写「联网有好处」不给）；写出回应「保留本地基本功能，同时仍可联网进行诊断或协调，两者相容」再给 1 分（须说清并存关系）。同义改写均可；只写「应该禁止联网」或「本地设备永远可靠」给 0 分；只复述灯的用途而未回答让步与回应不给分。',
    },
    {
      kind: 'short',
      marks: 2,
      stem: 'According to Paragraph G, why does the proposed test include restarting, and what additional ability should staff demonstrate?',
      answer:
        'A device might keep its current state while disconnected but need the external service to initialise after a restart. Staff should show that they can use the remaining controls without help from the supplier.',
      evidence:
        'Restarting matters because a device may preserve an existing state during an interruption yet require an external service to initialise again. Staff should also demonstrate that they can operate the remaining controls without assistance from the supplier.',
      rubric:
        '两分：写出「设备断网时可能只保持原状态，重启初始化仍可能依赖外部服务」给 1 分（须区分保持状态与重新启动；只写「检查是否可靠」不给）；写出「工作人员能不依靠供应商协助操作剩余的控制功能」再给 1 分。同义改写均可；只写「切断互联网」不给分，那是测试步骤而不是重启的理由或人员能力；只写「演示不能保证永久可靠」不给分。',
    },
  ],
};

// ═══════════════════════════════════════════════════════════════
// 周四 —— 更多选项必然带来更大自主权吗？（GP 议论文）
// 徽章主题：psychology；不引用实验或给出普遍心理效应的数值。
// ═══════════════════════════════════════════════════════════════

const CHOICE = {
  key: 'original-w9-choice-and-autonomy',
  title: 'The Freedom to Choose Less',
  passage: lettered([
    `Schools, clubs and businesses often advertise an expanding range of options as evidence that they respect individual preferences. A workshop programme with more subjects appears more generous; a catalogue with more titles appears more useful. Yet the ability to select from a list should not be confused with the ability to make a decision one can understand and endorse. Is the widest possible choice always desirable? Neither unlimited expansion nor compulsory simplicity offers a satisfactory answer. What matters is whether the available information, the time allowed and the possibility of reconsideration make those options genuinely usable.`,
    `The strongest defence of extensive choice begins with differences between people. A short programme may suit its typical participant while offering nothing to someone with an unusual interest or an inconvenient timetable. Adding an evening ceramics session, for example, could make participation possible for a learner who cannot attend during the afternoon. Removing it because few people select it would mistake popularity for usefulness. Furthermore, discovering an unfamiliar possibility can help people develop preferences they could not have stated beforehand. The value of a broad range therefore includes opportunities which a prediction based on past selections might overlook.`,
    `The opposing argument concerns the work of comparison. Imagine choosing a workshop when descriptions differ in length, prices exclude different materials and the required experience is unclear. Every additional entry creates another set of questions before any useful comparison can be made. Even after selecting one, a participant may keep reconsidering alternatives whose advantages remain visible but whose limitations have not been explored. Such counterfactual comparison can make commitment difficult. This is a reason to question how options are presented, however, rather than proof that a particular number of alternatives will necessarily overwhelm everyone in every setting.`,
    `While it is true that reducing a confusing list can make a decision easier, reducing it may address the wrong difficulty. In the workshop example, consistent descriptions of duration, materials and prior knowledge would allow comparisons that a shorter but equally inconsistent list would not. Someone experienced in ceramics may distinguish techniques quickly, whereas a newcomer needs those distinctions explained. The same catalogue can therefore support one person's judgement while frustrating another's. Claims about the burden of choice should attend to relevant knowledge and the comparability of information instead of treating the size of the list as a complete explanation.`,
    `A more serious objection is that simplifying choice can become a polite way of choosing for other people. Whoever constructs a shortlist determines which possibilities receive attention. The answer should be transparent, adjustable curation rather than concealed exclusion. A library catalogue illustrates the distinction: a reader can narrow a search by subject or language while retaining access to the wider collection. In the arrangement proposed here, readers can change or remove every filter themselves. The resulting smaller selection reflects a criterion they can inspect and revise, rather than a judgement that some books are unsuitable for their consideration.`,
    `Guidance nevertheless consumes resources, and an explanation attached to every option can create another catalogue to navigate. Nor should users have to become experts before selecting a short afternoon activity. A workable system would identify the few differences that actually alter the experience and explain those clearly. For a workshop, these might be the necessary prior skills and whether materials are included, rather than an elaborate account of every possible technique. This approach accepts the critic's concern about complexity while declining the assumption that the only remedy is to remove opportunities. Useful guidance reduces irrelevant work without requiring identical preferences. Such guidance would also make an organisation's priorities visible: explaining why prior experience matters is more informative than offering a recommendation whose underlying criteria cannot be examined by the person expected to follow it.`,
    `The opportunity to revise a decision matters as well. Suppose a club allows participants to attend an introductory session before committing to a longer course. Direct experience can then replace guesses about what a description means, and a mistaken initial selection need not determine the whole term. Where such revision is impractical, more support may be justified before a commitment is made. Reversibility does not make every decision effortless, but it changes what is at stake. A choice that can be explored and revised should not require the same precautions as one that fixes an entire programme in advance.`,
    `The proper ambition is therefore meaningful agency, not the largest catalogue or the shortest menu. Organisations should preserve alternatives that serve distinct needs while making comparison manageable through consistent information and user-controlled filters. Where possible, opportunities to reconsider should accompany the initial selection. This is not to say that every option deserves permanent inclusion regardless of cost; it means that selection figures alone cannot establish whether an unusual option has value. A narrower view should remain connected to a wider field of possibility, and people should understand both how that view was created and how they can alter it.`,
  ]),
  questions: [
    {
      kind: 'matchingParagraphs',
      items: [
        { item: 'a proposal to replace predictions about an activity with experience before a longer commitment', letter: 'G' },
        { item: 'an argument that an unpopular option can still provide an important opportunity', letter: 'B' },
        { item: 'a response to the objection that a shorter selection allows its designer to decide for others', letter: 'E' },
      ],
    },
    {
      kind: 'tfng',
      item: 'Younger workshop participants spend more time comparing alternatives than older participants.',
      answer: 'NOT GIVEN',
      explanation:
        'D 段比较的是有相关经验的人和新手，并未比较年龄组，也没有报告各年龄组比较选项的用时，选 NOT GIVEN；不能把经验差异替换成年龄差异。',
    },
    {
      kind: 'tfng',
      item: 'In the proposed library arrangement, a reader who applies a filter loses the ability to reopen the full range of choices.',
      answer: 'FALSE',
      evidence:
        'In the arrangement proposed here, readers can change or remove every filter themselves.',
      explanation:
        'E 段明确说读者可以自行更改或移除每一个筛选条件，前一句也说仍保留对完整馆藏的访问；并非筛选后就无法重新查看全部选择，选 FALSE。',
    },
    {
      kind: 'tfng',
      item: 'The introductory session described in the passage resulted in more participants enrolling for a full course.',
      answer: 'NOT GIVEN',
      explanation:
        'G 段以 Suppose 提出可先体验再决定的设例，没有真实报名数据，也未说最终报名人数增加或减少，选 NOT GIVEN；作者说明的可能用途不等于测得的成效。',
    },
    {
      kind: 'gapTyped',
      stem: 'Continued evaluation of unselected possibilities is described as counterfactual ______.',
      answer: 'comparison',
      evidence:
        'Such counterfactual comparison can make commitment difficult.',
    },
    {
      kind: 'gapTyped',
      stem: 'The term used for the ability to undo or change a selection is ______.',
      answer: 'reversibility',
      evidence:
        'Reversibility does not make every decision effortless, but it changes what is at stake.',
    },
    {
      kind: 'short',
      marks: 2,
      stem: 'According to Paragraph D, why might shortening the workshop list fail to solve the problem, and how does the contrast between experienced users and newcomers support this argument?',
      answer:
        'A shorter list can still be hard to compare if its descriptions remain inconsistent. Experienced users can distinguish techniques quickly, while newcomers need explanations, showing that the difficulty depends on knowledge and information as well as the number of options.',
      evidence:
        "In the workshop example, consistent descriptions of duration, materials and prior knowledge would allow comparisons that a shorter but equally inconsistent list would not. Someone experienced in ceramics may distinguish techniques quickly, whereas a newcomer needs those distinctions explained. The same catalogue can therefore support one person's judgement while frustrating another's.",
      rubric:
        '两分：写出「即使列表缩短，说明仍不一致就仍难以比较；统一时长、材料或先备知识等说明才解决这一障碍」给 1 分（说明缩短未解决信息不可比即可）；写出「有经验的人能迅速辨别，新手需要解释，因此同样多的选项对不同知识水平的人难度不同」再给 1 分（须有经验 / 新手的对比及其论证作用）。合理同义改写均可；只写「选项太多」不给分；把差异说成年龄或智力高低不给分。',
    },
    {
      kind: 'short',
      marks: 2,
      stem: 'According to Paragraph H, what two safeguards make a narrower selection consistent with meaningful agency?',
      answer:
        'Alternatives meeting distinct needs should remain available within the wider range. Users should also be able to understand and control how the visible selection is narrowed, through consistent information and adjustable filters.',
      evidence:
        'Organisations should preserve alternatives that serve distinct needs while making comparison manageable through consistent information and user-controlled filters.',
      rubric:
        '两分：写出「保留能满足不同需求的选项 / 让较窄视图仍可通向更广范围」给 1 分；写出「用户能够理解并自行调整筛选，依据一致的信息决定怎样缩小范围」再给 1 分（写出用户可控制 / 修改筛选，或能理解视图形成方式并改变它，均可）。合理改写均可，两点各计一次；只写「减少选项」或「保留最受欢迎的活动」给 0 分；只写「所有选项无论成本都永久保留」不给分。',
    },
  ],
};

// ═══════════════════════════════════════════════════════════════
// 周五 —— 整洁是否应当成为清走全部落叶的充分理由？（GP 议论文）
// 徽章主题：nature；基础分解与园艺原理把握高，不给出分解速度或碳储量数字。
// ═══════════════════════════════════════════════════════════════

const LEAVES = {
  key: 'original-w9-garden-leaf-cycle',
  title: 'What a Garden Owes Its Soil',
  passage: lettered([
    `A school garden is usually praised when its paths are clear, its borders distinct and its surface apparently free of untidy material. Fallen leaves complicate that ideal. To one observer they indicate overdue maintenance; to another they are the beginning of the soil's next cycle. Should a garden remove them all, or allow them to remain? The question cannot be settled by declaring either tidiness or naturalness an absolute virtue. A shared garden must accommodate people, but the standard by which it is cared for should also recognise processes that continue beneath a temporarily untidy surface.`,
    `The strongest argument for clearing leaves is practical rather than merely decorative. Wet leaves can make a paved path slippery, while accumulated material can obscure an edge or cover a small plant. Someone responsible for keeping a garden usable cannot simply assume that every visitor will recognise those difficulties. A thick layer over a low-growing plant may also restrict the light it receives. Removing leaves from these locations can therefore be an act of appropriate care, serving both people and plants. Advocates of retention should answer this argument rather than dismiss all clearing as a preference for appearances.`,
    `Yet treating every fallen leaf as waste overlooks where its materials will go next. Fungi, bacteria and small soil organisms contribute to decomposition, through which nutrients contained in leaves can become available again. The resulting organic matter also contributes to the soil's ability to retain water. These processes are ordinary features of the cycling of matter, not a special property acquired when a garden is labelled ecological. If leaves are continually exported and replacement soil material is then brought in, the garden may be purchasing something while discarding part of the material from which it could have been produced.`,
    `This does not establish that every leaf should remain exactly where it lands. Different leaves break down at different rates, and a dense layer may form a covering quite unlike the loose material beneath a tree. The needs of the plants and the position of the material matter more than a general instruction to intervene less. Moving leaves from a path into a suitable planted bed, for instance, can retain material within the garden while preserving access. Retention is therefore a question of placement and quantity, not an obligation to accept every arrangement produced by the wind.`,
    `A supporter of comprehensive clearing might reply that composting already reconciles tidiness with nutrient recycling. Collected leaves can be managed elsewhere and returned later as a soil amendment; a garden need not look untidy to participate in a material cycle. This is a substantial objection to any claim that removal necessarily wastes resources. However, centralised composting requires collection, space and subsequent redistribution, whereas suitable leaves left in a bed can decompose there. The alternatives should be compared by the work and ecological functions each performs, rather than by assuming that moving material always improves it or always makes it useless.`,
    `The visible boundary between a path and a retained leaf layer can itself communicate care. Consider a school garden with regularly cleared walking routes and a marked bed in which leaves are allowed to accumulate modestly. The contrast makes a deliberate arrangement legible: visitors can see where access is protected and where decomposition is being accommodated. Such a boundary does not prove that the bed is functioning well, and a sign cannot compensate for inappropriate conditions. It can, nevertheless, distinguish an intentional practice from forgotten maintenance, giving staff a specific arrangement to inspect rather than an undefined instruction to leave nature alone.`,
    `There is also an educational argument, although it should not be used to excuse an unusable garden. Students could follow marked leaves as their texture changes, compare material in a retained bed with finished compost and record how the surface changes after rain. These observations would not establish how much carbon the garden stores or prove that one approach benefits every species. They would make a normally concealed process available for examination. An institution that presents environmental responsibility only through immediate visual order may miss this opportunity to show that useful change can involve gradual transformation rather than constant replacement.`,
    `Gardens should consequently clear leaves where access or plant needs require it, while retaining or composting suitable material where conditions permit. That conclusion neither treats all tidiness as superficial nor grants every untouched surface ecological value. It requires continuing observation, because a sensible arrangement can become unsuitable as material accumulates or plants grow. The measure of care is then whether people can use the space and whether its soil processes are being supported, not whether every visible fragment has disappeared. This standard asks gardeners to justify both intervention and restraint, since either can become an unexamined habit when its consequences are judged only at a glance. A garden can be orderly enough to welcome visitors while allowing some of its most important work to remain unfinished.`,
  ]),
  questions: [
    {
      kind: 'matchingParagraphs',
      items: [
        { item: 'a suggestion that disposing of material and buying replacements may interrupt a useful cycle', letter: 'C' },
        { item: 'an example in which a visible contrast helps observers recognise deliberate management', letter: 'F' },
        { item: 'a counterargument that resource recycling does not require leaves to remain where they fell', letter: 'E' },
      ],
    },
    {
      kind: 'tfng',
      item: 'The writer accepts that clearing leaves can sometimes protect plants as well as maintain access for visitors.',
      answer: 'TRUE',
      evidence:
        'A thick layer over a low-growing plant may also restrict the light it receives. Removing leaves from these locations can therefore be an act of appropriate care, serving both people and plants.',
      explanation:
        'B 段先讲道路通行，又指出厚叶层会限制矮小植物受光，明确承认适当清理同时照顾人和植物；不能把作者支持保留落叶理解成反对一切清理，选 TRUE。',
    },
    {
      kind: 'tfng',
      item: 'The passage argues that leaves left in a suitable bed require collection and redistribution in the same way as centrally composted leaves.',
      answer: 'FALSE',
      evidence:
        'However, centralised composting requires collection, space and subsequent redistribution, whereas suitable leaves left in a bed can decompose there.',
      explanation:
        'E 段明确对比：集中堆肥需要收集及再分配，合适的落叶留在花床里可以原地分解。题干抹掉了这一区别，选 FALSE；不是因为堆肥不能循环养分。',
    },
    {
      kind: 'tfng',
      item: 'According to the writer, the suitability of a leaf-retention arrangement can change after it has been established.',
      answer: 'TRUE',
      evidence:
        'It requires continuing observation, because a sensible arrangement can become unsuitable as material accumulates or plants grow.',
      explanation:
        'H 段指出原先合理的安排会因材料积累或植物生长而不再适用，所以需要持续观察；作者给出的不是一次确定就永久正确的方案，选 TRUE。',
    },
    {
      kind: 'gapTyped',
      stem: 'Leaf nutrients can become available again through the process of ______.',
      answer: 'decomposition',
      evidence:
        'Fungi, bacteria and small soil organisms contribute to decomposition, through which nutrients contained in leaves can become available again.',
    },
    {
      kind: 'gapTyped',
      stem: 'Collected leaves can eventually be returned to the garden as a soil ______.',
      answer: 'amendment',
      evidence:
        'Collected leaves can be managed elsewhere and returned later as a soil amendment; a garden need not look untidy to participate in a material cycle.',
    },
    {
      kind: 'short',
      marks: 2,
      stem: 'According to Paragraph E, what does the composting counterargument force the writer to concede, and what distinction is then used to qualify it?',
      answer:
        'Removing leaves need not waste their resources, because compost can be returned and recycle their nutrients. However, centralised composting entails collection, space and redistribution, while suitable leaves retained in a bed can decompose in place.',
      evidence:
        'This is a substantial objection to any claim that removal necessarily wastes resources. However, centralised composting requires collection, space and subsequent redistribution, whereas suitable leaves left in a bed can decompose there.',
      rubric:
        '两分：写出让步「清走落叶不一定浪费资源，可以堆肥后归还土壤 / 循环养分」给 1 分（须说明移走也能循环，不是只写「可以整理花园」）；写出限定「集中堆肥须收集、占用场地或再分配，而合适的叶子留在花床可原地分解」再给 1 分（须有集中处理与原地分解的对比，收集 / 空间 / 再分配任举一项即可）。合理同义改写均可；说「堆肥不能循环」或「移动总是没有价值」不给分；只写「作者同意反方」不给分。',
    },
    {
      kind: 'short',
      marks: 2,
      stem: 'According to Paragraph G, what educational value could the proposed observations have, and what broad ecological conclusion would they not justify?',
      answer:
        'They could make gradual decomposition visible so that students can examine it. They would not establish the amount of carbon stored, or prove that one approach benefits every species.',
      evidence:
        'These observations would not establish how much carbon the garden stores or prove that one approach benefits every species. They would make a normally concealed process available for examination.',
      rubric:
        '两分：写出「让平时不易看见的缓慢分解 / 物质转化过程可供学生观察研究」给 1 分（举跟踪叶片质地等例子须说明是在观察分解或转化；只写「学环保」不给）；写出局限「不能据此确定碳储量」或「不能证明某方法使每个物种都受益」再给 1 分，两项任一即可。合理同义改写均可；只写「园子会更整齐」不给分；声称这些观察能证明普遍生态成效，对应局限分不给。',
    },
  ],
};

// 周二那篇（10-27 未发）挪到下周一 11-02，所以排在最后（叶老师 10-27 晚）。
const SPECS = [OFFLINE, CHOICE, LEAVES, IODINE];

module.exports = {
  LEVEL,
  SPECS,
  DAYS: DATES.slice(0, SPECS.length).map((date, i) => buildAuthoredDay(SPECS[i], date)),
};
