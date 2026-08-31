/**
 * 试点第一周 —— **ielts_authentic 档**的每日课程内容。
 *
 * 真 IELTS 量级：更长的说明文、更复杂的句式、更抽象的词汇。规矩与另外
 * 两档完全一样（六道自动判 + 四道人工判、二十一个目标词、证据句与语境句
 * 都必须是原文逐字子串），差别只在难度。
 */

'use strict';

const P = (...paras) => paras.join('\n\n');

const TFNG = [
  { key: 'A', text: 'TRUE' },
  { key: 'B', text: 'FALSE' },
  { key: 'C', text: 'NOT GIVEN' },
];

// ═══════════════════════════════════════════════════════════════
// 周一 2026-08-31
// ═══════════════════════════════════════════════════════════════

const MON_PASSAGE = P(
  'Coral restoration has an image problem. The photographs that accompany it — divers cementing bright fragments onto a frame, a reef apparently reborn — suggest a technology that can be scaled up until the damage is undone. The scientists who run the nurseries are, almost without exception, more cautious than the photographs, and their caution is worth understanding.',
  'The method itself is not complicated. A healthy colony is broken into fragments, and because coral grows clonally, each fragment can become a colony of its own. Suspended on ropes or trays in clear water, sheltered from sediment and from the fish that graze on new growth, those fragments can reach transplantable size in under a year. A single nursery in the Caribbean has produced tens of thousands of them.',
  'The difficulty is arithmetic. A degraded reef is measured in square kilometres; a nursery output is measured in square metres. Even an optimistic estimate of global restoration capacity covers a fraction of one per cent of the reef that has been lost since 1980. Restoration cannot substitute for reducing the pressures that killed the reef in the first place, and every serious practitioner says so in print.',
  'What restoration can do is more specific, and arguably more interesting. It can preserve genetic diversity that would otherwise disappear when a rare colony dies. It can maintain a population above the density at which spawning succeeds, since corals release eggs into open water and a thinly scattered population fails to fertilise. And it can buy time in places where the underlying threat is expected to ease — a sewage outfall being rerouted, a harbour dredging programme ending.',
  'The most encouraging recent work is not about growing more coral but about growing better coral. Some colonies survive bleaching events that kill their neighbours, and that tolerance appears partly heritable. Nurseries that propagate deliberately from survivors are, in effect, running a selective breeding programme on a decadal timescale. Whether the reef will be given decades is the question nobody in the field can answer.',
);

const MON = {
  date: '2026-08-31',
  title: 'The Slow Science of Coral',
  passage: MON_PASSAGE,
  questions: [
    {
      taskType: 'true_false_not_given',
      questionType: 'mcq',
      marks: 1,
      options: TFNG,
      answer: 'B',
      stem:
        'Do the following statements agree with the information in the passage? Write TRUE, FALSE or NOT GIVEN.\nThe scientists running the nurseries share the optimism of the photographs.',
      evidence:
        'The scientists who run the nurseries are, almost without exception, more cautious than the photographs, and their caution is worth understanding.',
      explanation: '原文说他们几乎无一例外比照片更谨慎，与题干相反。',
    },
    {
      taskType: 'true_false_not_given',
      questionType: 'mcq',
      marks: 1,
      options: TFNG,
      answer: 'A',
      stem: 'Coral fragments can reach a size suitable for transplanting in less than twelve months.',
      evidence: 'those fragments can reach transplantable size in under a year',
      explanation: '「under a year」就是不到十二个月。',
    },
    {
      taskType: 'true_false_not_given',
      questionType: 'mcq',
      marks: 1,
      options: TFNG,
      answer: 'C',
      stem: 'Nurseries in the Pacific produce more fragments than those in the Caribbean.',
      evidence: '',
      explanation:
        '原文只提到加勒比海的一个苗圃，从没做过任何地区之间的比较，所以是 NOT GIVEN。',
    },
    {
      taskType: 'matching_features',
      questionType: 'mcq',
      marks: 1,
      options: [
        { key: 'A', text: 'preserving genetic diversity' },
        { key: 'B', text: 'keeping spawning density' },
        { key: 'C', text: 'buying time' },
        { key: 'D', text: 'selective breeding from survivors' },
      ],
      answer: 'B',
      stem:
        'Match the statement with the correct aim of restoration.\nThis matters because corals release eggs into open water.',
      evidence:
        'It can maintain a population above the density at which spawning succeeds, since corals release eggs into open water and a thinly scattered population fails to fertilise.',
      explanation: '把卵释放进开放水域，正是「密度」这一条的理由。',
    },
    {
      taskType: 'matching_features',
      questionType: 'mcq',
      marks: 1,
      options: [
        { key: 'A', text: 'preserving genetic diversity' },
        { key: 'B', text: 'keeping spawning density' },
        { key: 'C', text: 'buying time' },
        { key: 'D', text: 'selective breeding from survivors' },
      ],
      answer: 'C',
      stem: 'This applies where the underlying threat is expected to ease.',
      evidence:
        'And it can buy time in places where the underlying threat is expected to ease — a sewage outfall being rerouted, a harbour dredging programme ending.',
      explanation: '「威胁将会缓解」正是「争取时间」那一条的适用条件。',
    },
    {
      taskType: 'multiple_choice',
      questionType: 'mcq',
      marks: 1,
      options: [
        { key: 'A', text: 'Nursery output is tiny compared with the area that has been lost.' },
        { key: 'B', text: 'Transplanted fragments rarely survive their first year.' },
        { key: 'C', text: 'Nurseries are too expensive for most countries to run.' },
        { key: 'D', text: 'Divers cannot reach the deeper parts of a damaged reef.' },
      ],
      answer: 'A',
      stem:
        'Choose the correct letter.\nWhat does the writer mean by saying that “the difficulty is arithmetic”?',
      evidence:
        'A degraded reef is measured in square kilometres; a nursery output is measured in square metres.',
      explanation:
        '「算术问题」指的就是平方公里与平方米之间的量级差距，下一句直接给出了这个对比。',
    },
    {
      taskType: 'sentence_completion',
      questionType: 'short_answer',
      marks: 1,
      options: null,
      answer: 'sediment',
      accept: ['sediment', 'from sediment'],
      stem:
        'Complete the sentence with ONE WORD ONLY from the passage.\nIn the nursery, fragments are sheltered from ______ and from grazing fish.',
      evidence:
        'Suspended on ropes or trays in clear water, sheltered from sediment and from the fish that graze on new growth, those fragments can reach transplantable size in under a year.',
      rubric: '只认 sediment。写 mud / sand 不给分（题干要求原文词）。',
      explanation: '第二段把两种威胁并列写出。',
    },
    {
      taskType: 'sentence_completion',
      questionType: 'short_answer',
      marks: 1,
      options: null,
      answer: 'clonally',
      accept: ['clonally', 'clonal'],
      stem:
        'A single fragment can become a colony of its own because coral grows ______.',
      evidence:
        'A healthy colony is broken into fragments, and because coral grows clonally, each fragment can become a colony of its own.',
      rubric: '只认 clonally（clonal 也接受）。',
      explanation: '第二段直接给出了这个机制词。',
    },
    {
      taskType: 'summary_completion',
      questionType: 'short_answer',
      marks: 2,
      options: null,
      answer: 'a fraction of one per cent',
      accept: null,
      stem:
        'Complete the summary with words from the passage.\nEven an optimistic estimate of global restoration capacity covers only ______ of the reef lost since 1980.',
      evidence:
        'Even an optimistic estimate of global restoration capacity covers a fraction of one per cent of the reef that has been lost since 1980.',
      rubric:
        '两分：写出「不到百分之一的一小部分」= 2 分；只写「不到 1%」= 1 分；写别的比例 = 0 分。',
      explanation: '第三段给了这个量级，是全文最关键的一个数字。',
    },
    {
      taskType: 'short_answer',
      questionType: 'short_answer',
      marks: 2,
      options: null,
      answer: 'because tolerance to bleaching appears partly heritable',
      accept: null,
      stem:
        'Answer in NO MORE THAN TWELVE WORDS.\nWhy do some nurseries deliberately propagate from colonies that survived bleaching?',
      evidence:
        'Some colonies survive bleaching events that kill their neighbours, and that tolerance appears partly heritable.',
      rubric:
        '两分：写出「耐受性部分可遗传」= 2 分；只写「它们更强壮」= 1 分；写原文没说的（比如「它们长得更快」）= 0 分。',
      explanation: '最后一段说明了这是在做一场按十年计的选择育种。',
    },
  ],
  words: [
    { headword: 'restoration', surfaceForm: 'restoration', phonetic: '/ˌrestəˈreɪʃn/', pos: 'n.', translation: 'n. 修复，恢复', definition: 'the work of returning something to its former condition', context: 'Coral restoration has an image problem.' },
    { headword: 'accompany', surfaceForm: 'accompany', phonetic: '/əˈkʌmpəni/', pos: 'v.', translation: 'v. 伴随，配有', definition: 'to happen or appear together with something', context: 'The photographs that accompany it — divers cementing bright fragments onto a frame, a reef apparently reborn — suggest a technology that can be scaled up until the damage is undone.' },
    { headword: 'fragment', surfaceForm: 'fragments', phonetic: '/ˈfræɡmənt/', pos: 'n.', translation: 'n. 碎片，断枝', definition: 'a small piece broken off a larger thing', context: 'The photographs that accompany it — divers cementing bright fragments onto a frame, a reef apparently reborn — suggest a technology that can be scaled up until the damage is undone.' },
    { headword: 'reef', surfaceForm: 'reef', phonetic: '/riːf/', pos: 'n.', translation: 'n. 礁，珊瑚礁', definition: 'a line of rock or coral near the surface of the sea', context: 'The photographs that accompany it — divers cementing bright fragments onto a frame, a reef apparently reborn — suggest a technology that can be scaled up until the damage is undone.' },
    { headword: 'cautious', surfaceForm: 'cautious', phonetic: '/ˈkɔːʃəs/', pos: 'adj.', translation: 'adj. 谨慎的', definition: 'careful to avoid risk or error', context: 'The scientists who run the nurseries are, almost without exception, more cautious than the photographs, and their caution is worth understanding.' },
    { headword: 'colony', surfaceForm: 'colony', phonetic: '/ˈkɒləni/', pos: 'n.', translation: 'n. 群体，珊瑚群落', definition: 'a group of the same organism living together as one unit', context: 'A healthy colony is broken into fragments, and because coral grows clonally, each fragment can become a colony of its own.' },
    { headword: 'suspend', surfaceForm: 'Suspended', phonetic: '/səˈspend/', pos: 'v.', translation: 'v. 悬挂', definition: 'to hang something so that it does not touch the bottom', context: 'Suspended on ropes or trays in clear water, sheltered from sediment and from the fish that graze on new growth, those fragments can reach transplantable size in under a year.' },
    { headword: 'sediment', surfaceForm: 'sediment', phonetic: '/ˈsedɪmənt/', pos: 'n.', translation: 'n. 沉积物', definition: 'solid material that settles at the bottom of water', context: 'Suspended on ropes or trays in clear water, sheltered from sediment and from the fish that graze on new growth, those fragments can reach transplantable size in under a year.' },
    { headword: 'graze', surfaceForm: 'graze', phonetic: '/ɡreɪz/', pos: 'v.', translation: 'v. 啃食', definition: 'to eat growing plants or algae', context: 'Suspended on ropes or trays in clear water, sheltered from sediment and from the fish that graze on new growth, those fragments can reach transplantable size in under a year.' },
    { headword: 'degraded', surfaceForm: 'degraded', phonetic: '/dɪˈɡreɪdɪd/', pos: 'adj.', translation: 'adj. 退化的，受损的', definition: 'damaged and reduced in quality', context: 'A degraded reef is measured in square kilometres; a nursery output is measured in square metres.' },
    { headword: 'optimistic', surfaceForm: 'optimistic', phonetic: '/ˌɒptɪˈmɪstɪk/', pos: 'adj.', translation: 'adj. 乐观的', definition: 'expecting good things to happen', context: 'Even an optimistic estimate of global restoration capacity covers a fraction of one per cent of the reef that has been lost since 1980.' },
    { headword: 'capacity', surfaceForm: 'capacity', phonetic: '/kəˈpæsəti/', pos: 'n.', translation: 'n. 能力，产能', definition: 'the amount that something can produce or hold', context: 'Even an optimistic estimate of global restoration capacity covers a fraction of one per cent of the reef that has been lost since 1980.' },
    { headword: 'substitute', surfaceForm: 'substitute', phonetic: '/ˈsʌbstɪtjuːt/', pos: 'v.', translation: 'v. 替代', definition: 'to take the place of something else', context: 'Restoration cannot substitute for reducing the pressures that killed the reef in the first place, and every serious practitioner says so in print.' },
    { headword: 'practitioner', surfaceForm: 'practitioner', phonetic: '/prækˈtɪʃənə/', pos: 'n.', translation: 'n. 从业者', definition: 'a person who works in a particular field', context: 'Restoration cannot substitute for reducing the pressures that killed the reef in the first place, and every serious practitioner says so in print.' },
    { headword: 'diversity', surfaceForm: 'diversity', phonetic: '/daɪˈvɜːsəti/', pos: 'n.', translation: 'n. 多样性', definition: 'the range of different kinds within a group', context: 'It can preserve genetic diversity that would otherwise disappear when a rare colony dies.' },
    { headword: 'density', surfaceForm: 'density', phonetic: '/ˈdensəti/', pos: 'n.', translation: 'n. 密度', definition: 'how many of something there are in a given space', context: 'It can maintain a population above the density at which spawning succeeds, since corals release eggs into open water and a thinly scattered population fails to fertilise.' },
    { headword: 'fertilise', surfaceForm: 'fertilise', phonetic: '/ˈfɜːtəlaɪz/', pos: 'v.', translation: 'v. 受精', definition: 'to join a male and female cell so that a new life begins', context: 'It can maintain a population above the density at which spawning succeeds, since corals release eggs into open water and a thinly scattered population fails to fertilise.' },
    { headword: 'underlying', surfaceForm: 'underlying', phonetic: '/ˌʌndəˈlaɪɪŋ/', pos: 'adj.', translation: 'adj. 根本的，潜在的', definition: 'forming the real cause or basis of something', context: 'And it can buy time in places where the underlying threat is expected to ease — a sewage outfall being rerouted, a harbour dredging programme ending.', },
    { headword: 'sewage', surfaceForm: 'sewage', phonetic: '/ˈsuːɪdʒ/', pos: 'n.', translation: 'n. 污水', definition: 'waste water and waste from houses and factories', context: 'And it can buy time in places where the underlying threat is expected to ease — a sewage outfall being rerouted, a harbour dredging programme ending.' },
    { headword: 'tolerance', surfaceForm: 'tolerance', phonetic: '/ˈtɒlərəns/', pos: 'n.', translation: 'n. 耐受性', definition: 'the ability to survive difficult conditions', context: 'Some colonies survive bleaching events that kill their neighbours, and that tolerance appears partly heritable.' },
    { headword: 'heritable', surfaceForm: 'heritable', phonetic: '/ˈherɪtəbl/', pos: 'adj.', translation: 'adj. 可遗传的', definition: 'able to be passed from parent to offspring', context: 'Some colonies survive bleaching events that kill their neighbours, and that tolerance appears partly heritable.' },
  ],
};

// ═══════════════════════════════════════════════════════════════
// 周二 2026-09-01
// ═══════════════════════════════════════════════════════════════

const TUE_PASSAGE = P(
  'An ice core is a cylinder of frozen time. Drilled from a glacier or an ice sheet, it preserves, layer by layer, the snow that fell in a particular year, and with the snow whatever the atmosphere happened to be carrying. Dust from a distant desert, ash from an eruption, the isotopic signature of the temperature at which the snow crystallised — all of it is trapped, and none of it moves once the layer is buried.',
  'The counting of layers is the oldest technique and still the most convincing. In places where enough snow falls each winter, the boundary between one year and the next can be seen with the naked eye, and a core can be dated by counting downwards in the same way that one counts the rings of a tree. Where accumulation is slow, layers thin and merge, and the count must be supported by chemical markers whose dates are known independently — a volcanic ash layer, for instance, that appears in cores on both sides of the planet.',
  'What the ice does not record is easier to overlook. It is a record of the atmosphere above a particular ice sheet, not of the world. Interpreting a Greenland core as a global thermometer requires an argument, and the arguments have grown more careful as more cores have been drilled. Where two distant records disagree, the disagreement is often the interesting result rather than an error to be reconciled away.',
  'The bubbles are a separate archive. Air becomes sealed into the ice as the snow compacts, and each bubble is a small sample of the atmosphere of its year. Because the air continues to circulate in the porous upper layers before sealing, the gas in a bubble is always somewhat younger than the ice around it, and the offset must be modelled rather than measured. This is the sort of correction that non-specialists find alarming and specialists find routine.',
  'Drilling is slow, expensive and destructive: a core can be measured only once, and the deepest sections are the scarcest material in the discipline. Laboratories therefore ration their samples, and increasingly they publish the raw measurements rather than only the conclusions, so that a later technique can be applied to the same numbers without cutting more ice.',
);

const TUE = {
  date: '2026-09-01',
  title: 'What the Ice Remembers',
  passage: TUE_PASSAGE,
  questions: [
    {
      taskType: 'true_false_not_given',
      questionType: 'mcq',
      marks: 1,
      options: TFNG,
      answer: 'A',
      stem:
        'Do the following statements agree with the information in the passage? Write TRUE, FALSE or NOT GIVEN.\nIn some places the boundary between two years can be seen without instruments.',
      evidence:
        'In places where enough snow falls each winter, the boundary between one year and the next can be seen with the naked eye, and a core can be dated by counting downwards in the same way that one counts the rings of a tree.',
      explanation: '「with the naked eye」就是不用仪器直接看得见。',
    },
    {
      taskType: 'true_false_not_given',
      questionType: 'mcq',
      marks: 1,
      options: TFNG,
      answer: 'B',
      stem: 'The air trapped in a bubble is the same age as the ice surrounding it.',
      evidence:
        'Because the air continues to circulate in the porous upper layers before sealing, the gas in a bubble is always somewhat younger than the ice around it, and the offset must be modelled rather than measured.',
      explanation: '原文说气泡里的气体总是比周围的冰**年轻一些**，与题干相反。',
    },
    {
      taskType: 'true_false_not_given',
      questionType: 'mcq',
      marks: 1,
      options: TFNG,
      answer: 'C',
      stem: 'Most ice cores are drilled in Antarctica rather than Greenland.',
      evidence: '',
      explanation: '原文两地都提到过，但从没比较过数量，所以是 NOT GIVEN。',
    },
    {
      taskType: 'matching_features',
      questionType: 'mcq',
      marks: 1,
      options: [
        { key: 'A', text: 'counting visible layers' },
        { key: 'B', text: 'chemical markers' },
        { key: 'C', text: 'the bubbles' },
        { key: 'D', text: 'publishing raw measurements' },
      ],
      answer: 'B',
      stem:
        'Match the statement with the correct method or practice.\nThis is needed where accumulation is slow and layers merge.',
      evidence:
        'Where accumulation is slow, layers thin and merge, and the count must be supported by chemical markers whose dates are known independently — a volcanic ash layer, for instance, that appears in cores on both sides of the planet.',
      explanation: '积累慢、层次合并时，靠的是日期独立已知的化学标志层。',
    },
    {
      taskType: 'matching_features',
      questionType: 'mcq',
      marks: 1,
      options: [
        { key: 'A', text: 'counting visible layers' },
        { key: 'B', text: 'chemical markers' },
        { key: 'C', text: 'the bubbles' },
        { key: 'D', text: 'publishing raw measurements' },
      ],
      answer: 'D',
      stem: 'This lets a later technique be applied without destroying more material.',
      evidence:
        'Laboratories therefore ration their samples, and increasingly they publish the raw measurements rather than only the conclusions, so that a later technique can be applied to the same numbers without cutting more ice.',
      explanation: '公开原始测量值，正是为了让后来的方法不必再切冰。',
    },
    {
      taskType: 'multiple_choice',
      questionType: 'mcq',
      marks: 1,
      options: [
        { key: 'A', text: 'It is a record of one place, not of the whole world.' },
        { key: 'B', text: 'Its layers are destroyed by the drilling process.' },
        { key: 'C', text: 'It cannot record temperature at all.' },
        { key: 'D', text: 'It only preserves the last two thousand years.' },
      ],
      answer: 'A',
      stem:
        'Choose the correct letter.\nWhat limitation of an ice core does the writer say is easily overlooked?',
      evidence:
        'It is a record of the atmosphere above a particular ice sheet, not of the world.',
      explanation: '第三段第二句就是那条「容易被忽略」的局限。',
    },
    {
      taskType: 'sentence_completion',
      questionType: 'short_answer',
      marks: 1,
      options: null,
      answer: 'rings',
      accept: ['rings', 'tree rings', 'the rings'],
      stem:
        'Complete the sentence with ONE WORD ONLY from the passage.\nDating a core by counting downwards is compared to counting the ______ of a tree.',
      evidence:
        'the boundary between one year and the next can be seen with the naked eye, and a core can be dated by counting downwards in the same way that one counts the rings of a tree',
      rubric: '只认 rings。写 layers 不给分 —— 题目问的是树的那一半比喻。',
      explanation: '第二段用树的年轮作比。',
    },
    {
      taskType: 'sentence_completion',
      questionType: 'short_answer',
      marks: 1,
      options: null,
      answer: 'modelled',
      accept: ['modelled', 'modeled'],
      stem: 'The age offset between the gas and the surrounding ice must be ______ rather than measured.',
      evidence: 'the gas in a bubble is always somewhat younger than the ice around it, and the offset must be modelled rather than measured',
      rubric: '写 modelled 或美式 modeled 都算对。',
      explanation: '第四段把「建模」与「测量」明确对立起来。',
    },
    {
      taskType: 'summary_completion',
      questionType: 'short_answer',
      marks: 2,
      options: null,
      answer: 'the interesting result rather than an error',
      accept: null,
      stem:
        'Complete the summary with words from the passage.\nWhen two distant records disagree, the disagreement is often ______ to be reconciled away.',
      evidence:
        'Where two distant records disagree, the disagreement is often the interesting result rather than an error to be reconciled away.',
      rubric:
        '两分：写出「有意思的结果，而不是要抹平的错误」= 2 分；只写「不是错误」= 1 分；写「说明其中一个测错了」= 0 分（与原文相反）。',
      explanation: '第三段末句是全文态度最鲜明的一句。',
    },
    {
      taskType: 'short_answer',
      questionType: 'short_answer',
      marks: 2,
      options: null,
      answer: 'because a core can be measured only once',
      accept: null,
      stem:
        'Answer in NO MORE THAN TWELVE WORDS.\nWhy do laboratories ration their ice-core samples?',
      evidence:
        'Drilling is slow, expensive and destructive: a core can be measured only once, and the deepest sections are the scarcest material in the discipline.',
      rubric:
        '两分：写出「取样是破坏性的 / 一段岩芯只能测一次」= 2 分；只写「钻探很贵」= 1 分；写原文没说的（比如「实验室缺人手」）= 0 分。',
      explanation: '最后一段把三个理由并列，「只能测一次」是核心那条。',
    },
  ],
  words: [
    { headword: 'cylinder', surfaceForm: 'cylinder', phonetic: '/ˈsɪlɪndə/', pos: 'n.', translation: 'n. 圆柱体', definition: 'a solid or hollow shape with straight sides and circular ends', context: 'An ice core is a cylinder of frozen time.' },
    { headword: 'glacier', surfaceForm: 'glacier', phonetic: '/ˈɡlæsiə/', pos: 'n.', translation: 'n. 冰川', definition: 'a very large mass of ice that moves slowly', context: 'Drilled from a glacier or an ice sheet, it preserves, layer by layer, the snow that fell in a particular year, and with the snow whatever the atmosphere happened to be carrying.' },
    { headword: 'atmosphere', surfaceForm: 'atmosphere', phonetic: '/ˈætməsfɪə/', pos: 'n.', translation: 'n. 大气', definition: 'the layer of gases surrounding the earth', context: 'Drilled from a glacier or an ice sheet, it preserves, layer by layer, the snow that fell in a particular year, and with the snow whatever the atmosphere happened to be carrying.' },
    { headword: 'eruption', surfaceForm: 'eruption', phonetic: '/ɪˈrʌpʃn/', pos: 'n.', translation: 'n. 火山喷发', definition: 'an occasion when a volcano throws out rock and gas', context: 'Dust from a distant desert, ash from an eruption, the isotopic signature of the temperature at which the snow crystallised — all of it is trapped, and none of it moves once the layer is buried.' },
    { headword: 'crystallise', surfaceForm: 'crystallised', phonetic: '/ˈkrɪstəlaɪz/', pos: 'v.', translation: 'v. 结晶', definition: 'to form into crystals', context: 'Dust from a distant desert, ash from an eruption, the isotopic signature of the temperature at which the snow crystallised — all of it is trapped, and none of it moves once the layer is buried.' },
    { headword: 'boundary', surfaceForm: 'boundary', phonetic: '/ˈbaʊndri/', pos: 'n.', translation: 'n. 界线', definition: 'a line that divides one area or period from another', context: 'In places where enough snow falls each winter, the boundary between one year and the next can be seen with the naked eye, and a core can be dated by counting downwards in the same way that one counts the rings of a tree.' },
    { headword: 'accumulation', surfaceForm: 'accumulation', phonetic: '/əˌkjuːmjəˈleɪʃn/', pos: 'n.', translation: 'n. 积累', definition: 'the process of gradually collecting more and more', context: 'Where accumulation is slow, layers thin and merge, and the count must be supported by chemical markers whose dates are known independently — a volcanic ash layer, for instance, that appears in cores on both sides of the planet.' },
    { headword: 'merge', surfaceForm: 'merge', phonetic: '/mɜːdʒ/', pos: 'v.', translation: 'v. 合并', definition: 'to join together into one', context: 'Where accumulation is slow, layers thin and merge, and the count must be supported by chemical markers whose dates are known independently — a volcanic ash layer, for instance, that appears in cores on both sides of the planet.' },
    { headword: 'independently', surfaceForm: 'independently', phonetic: '/ˌɪndɪˈpendəntli/', pos: 'adv.', translation: 'adv. 独立地', definition: 'without depending on anything else', context: 'Where accumulation is slow, layers thin and merge, and the count must be supported by chemical markers whose dates are known independently — a volcanic ash layer, for instance, that appears in cores on both sides of the planet.' },
    { headword: 'volcanic', surfaceForm: 'volcanic', phonetic: '/vɒlˈkænɪk/', pos: 'adj.', translation: 'adj. 火山的', definition: 'connected with a volcano', context: 'Where accumulation is slow, layers thin and merge, and the count must be supported by chemical markers whose dates are known independently — a volcanic ash layer, for instance, that appears in cores on both sides of the planet.' },
    { headword: 'overlook', surfaceForm: 'overlook', phonetic: '/ˌəʊvəˈlʊk/', pos: 'v.', translation: 'v. 忽略', definition: 'to fail to notice something', context: 'What the ice does not record is easier to overlook.' },
    { headword: 'interpret', surfaceForm: 'Interpreting', phonetic: '/ɪnˈtɜːprɪt/', pos: 'v.', translation: 'v. 解读', definition: 'to explain the meaning of something', context: 'Interpreting a Greenland core as a global thermometer requires an argument, and the arguments have grown more careful as more cores have been drilled.' },
    { headword: 'reconcile', surfaceForm: 'reconciled', phonetic: '/ˈrekənsaɪl/', pos: 'v.', translation: 'v. 调和，使一致', definition: 'to make two different things agree with each other', context: 'Where two distant records disagree, the disagreement is often the interesting result rather than an error to be reconciled away.' },
    { headword: 'archive', surfaceForm: 'archive', phonetic: '/ˈɑːkaɪv/', pos: 'n.', translation: 'n. 档案，记录库', definition: 'a store of records kept for future study', context: 'The bubbles are a separate archive.' },
    { headword: 'compact', surfaceForm: 'compacts', phonetic: '/kəmˈpækt/', pos: 'v.', translation: 'v. 压实', definition: 'to press something into a smaller, harder mass', context: 'Air becomes sealed into the ice as the snow compacts, and each bubble is a small sample of the atmosphere of its year.' },
    { headword: 'circulate', surfaceForm: 'circulate', phonetic: '/ˈsɜːkjəleɪt/', pos: 'v.', translation: 'v. 流通，循环', definition: 'to move continuously around a system', context: 'Because the air continues to circulate in the porous upper layers before sealing, the gas in a bubble is always somewhat younger than the ice around it, and the offset must be modelled rather than measured.' },
    { headword: 'porous', surfaceForm: 'porous', phonetic: '/ˈpɔːrəs/', pos: 'adj.', translation: 'adj. 多孔的', definition: 'having many small holes that let air or liquid through', context: 'Because the air continues to circulate in the porous upper layers before sealing, the gas in a bubble is always somewhat younger than the ice around it, and the offset must be modelled rather than measured.' },
    { headword: 'alarming', surfaceForm: 'alarming', phonetic: '/əˈlɑːmɪŋ/', pos: 'adj.', translation: 'adj. 令人担忧的', definition: 'causing worry or fear', context: 'This is the sort of correction that non-specialists find alarming and specialists find routine.' },
    { headword: 'destructive', surfaceForm: 'destructive', phonetic: '/dɪˈstrʌktɪv/', pos: 'adj.', translation: 'adj. 破坏性的', definition: 'causing damage that cannot be repaired', context: 'Drilling is slow, expensive and destructive: a core can be measured only once, and the deepest sections are the scarcest material in the discipline.' },
    { headword: 'scarce', surfaceForm: 'scarcest', phonetic: '/skeəs/', pos: 'adj.', translation: 'adj. 稀缺的', definition: 'available only in small amounts', context: 'Drilling is slow, expensive and destructive: a core can be measured only once, and the deepest sections are the scarcest material in the discipline.' },
    { headword: 'ration', surfaceForm: 'ration', phonetic: '/ˈræʃn/', pos: 'v.', translation: 'v. 限量供应', definition: 'to allow only a limited amount of something to be used', context: 'Laboratories therefore ration their samples, and increasingly they publish the raw measurements rather than only the conclusions, so that a later technique can be applied to the same numbers without cutting more ice.' },
  ],
};

module.exports = { LEVEL: 'ielts_authentic', DAYS: [MON, TUE] };
