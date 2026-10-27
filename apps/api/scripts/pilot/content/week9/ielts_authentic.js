/**
 * 第九周 —— **ielts_authentic（雅思真题难度）**档，全原创学术说明文。
 *
 * 形状与第八周这一档一致：八段、按 Paragraph A–H 编号；
 *   3 道段落信息配对 · 3 道判断 · 2 道原文单词填空（要拼写） ·
 *   2 道两分主观题 —— 满分 12。
 * 本周叶老师要求「整体难一点」：篇幅从第八周的约 600 词提到 750–800 词，长句、让步、
 * 限定更多（however / yet / nonetheless / few would claim …）；题目多考跨句指代、
 * 原因与推断，段落配对的干扰段落都谈到相近的话题。
 *
 * 本周选题（这一轮只写周二，后三天审完再往 SPECS 里追加；括号里是徽章主题）：
 *   周二 health  碘与加碘盐（The Element in the Salt）
 *                —— 碘是甲状腺激素的原料、对早期脑发育必不可少；山区与冰川覆盖过的土壤缺碘、
 *                   甲状腺代偿性肿大成甲状腺肿；Courtois 1811 年从海藻灰
 *                   里发现碘，日内瓦医生 Coindet 1820 年前后用碘治甲状腺肿、剂量过大有副作用而
 *                   受冷落；1917–1922 年美国俄亥俄州 Akron 女学生预防试验；瑞士 1922、密歇根
 *                   1924 年推加碘盐，「甲状腺肿带」病例骤降；WHO / UNICEF 1993 年建议全民食盐
 *                   加碘、选盐的理由；缺碘国家从一百多个降到二十个左右；英国从没强制加碘、
 *                   碘「意外地」来自牛奶，2011 年少女调查过半轻度缺碘，饮食变化可能有关；
 *                   减盐运动与加碘的张力、加工食品多用非碘盐、碘过量也伤甲状腺。
 *
 * 判断题：F / NG / F（不是「真 / 假 / 未提及各一道」；FALSE 两道都要细读才推得翻：
 *   一道要分清「疗效好但因副作用受冷落」，一道要读懂 WHO「两项政策不冲突」）。
 *
 * 事实只按已有知识核对（本周写作环境不许上网），见下方注释的把握程度；
 * 「高」= 公认、多处出处一致；「中高」= 有把握但细节可能有出入，正文已写得更含糊。
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

const SPECS = [IODINE];

module.exports = {
  LEVEL,
  SPECS,
  DAYS: DATES.slice(0, SPECS.length).map((date, i) => buildAuthoredDay(SPECS[i], date)),
};
