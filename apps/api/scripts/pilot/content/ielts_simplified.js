/**
 * 试点第一周 —— **ielts_simplified（O-Level 基础）档**的每日课程内容。
 *
 * 这一档面向基础较弱、刚开始用这个 app 的学生：文章更短、句子更直、
 * 目标词更常见。规矩与 `olevel.js` 完全一样（六道自动判 + 四道人工判、
 * 二十一个目标词、证据句与语境句都必须是原文逐字子串），差别只在难度。
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
  'On a narrow street behind the market there is a shop with no sign. Inside, an old man called Uncle Poh repairs bicycles. He has done this for thirty-eight years, and the neighbours call him the bicycle doctor.',
  'The shop is small and always crowded. Wheels hang from the ceiling. Boxes of screws, chains and brake cables cover the floor, and there is one chair for customers. Uncle Poh works slowly. He listens to a bicycle before he touches it, and he says that most problems make a sound before they become serious.',
  'Three years ago something changed. A girl from the secondary school brought in a flat tyre and asked if she could watch. Uncle Poh gave her the tools and let her do it herself. She came back the next week with a friend. Now, every Saturday morning, six or seven students sit on the floor of the shop and learn to fix their own bicycles.',
  'Uncle Poh does not charge them. He says the lesson is not really about bicycles. A student who can mend a puncture understands that a broken thing is not always rubbish. That idea, he believes, is worth more than the two dollars he would have earned.',
  'His own children think he should rest. He is seventy-three, and his hands are stiff in the morning. But on Saturday the shop is noisy and full of young people, and Uncle Poh says he has never felt less like resting.',
);

const MON = {
  date: '2026-08-31',
  title: 'The Bicycle Doctor',
  passage: MON_PASSAGE,
  questions: [
    {
      taskType: 'true_false_not_given',
      questionType: 'mcq',
      marks: 1,
      options: TFNG,
      answer: 'A',
      stem:
        'Do the following statements agree with the information in the passage? Write TRUE, FALSE or NOT GIVEN.\nThe shop does not have a sign outside.',
      evidence: 'On a narrow street behind the market there is a shop with no sign.',
      explanation: '第一句就说这家店没有招牌。',
    },
    {
      taskType: 'true_false_not_given',
      questionType: 'mcq',
      marks: 1,
      options: TFNG,
      answer: 'B',
      stem: 'Uncle Poh takes money from the students on Saturday.',
      evidence: 'Uncle Poh does not charge them.',
      explanation: '原文明确说他不收他们的钱。',
    },
    {
      taskType: 'true_false_not_given',
      questionType: 'mcq',
      marks: 1,
      options: TFNG,
      answer: 'C',
      stem: 'Uncle Poh learned to repair bicycles from his father.',
      evidence: '',
      explanation: '原文从没说过他跟谁学的，所以是 NOT GIVEN。',
    },
    {
      taskType: 'matching_features',
      questionType: 'mcq',
      marks: 1,
      options: [
        { key: 'A', text: 'Uncle Poh' },
        { key: 'B', text: 'the girl from the secondary school' },
        { key: 'C', text: 'his own children' },
        { key: 'D', text: 'the neighbours' },
      ],
      answer: 'B',
      stem:
        'Match the statement with the correct person or group.\nThis person asked if she could watch a repair.',
      evidence:
        'A girl from the secondary school brought in a flat tyre and asked if she could watch.',
      explanation: '来问能不能看的是那个中学女生。',
    },
    {
      taskType: 'matching_features',
      questionType: 'mcq',
      marks: 1,
      options: [
        { key: 'A', text: 'Uncle Poh' },
        { key: 'B', text: 'the girl from the secondary school' },
        { key: 'C', text: 'his own children' },
        { key: 'D', text: 'the neighbours' },
      ],
      answer: 'C',
      stem: 'This group wants him to stop working.',
      evidence: 'His own children think he should rest.',
      explanation: '希望他休息的是他自己的孩子。',
    },
    {
      taskType: 'multiple_choice',
      questionType: 'mcq',
      marks: 1,
      options: [
        { key: 'A', text: 'A broken thing is not always rubbish.' },
        { key: 'B', text: 'Bicycles are cheaper than buses.' },
        { key: 'C', text: 'Students should choose a useful job.' },
        { key: 'D', text: 'Old tools work better than new ones.' },
      ],
      answer: 'A',
      stem:
        'Choose the correct letter.\nWhat does Uncle Poh think the Saturday lesson really teaches?',
      evidence:
        'A student who can mend a puncture understands that a broken thing is not always rubbish.',
      explanation: '第四段直接给出了他认为真正学到的东西。',
    },
    {
      taskType: 'sentence_completion',
      questionType: 'short_answer',
      marks: 1,
      options: null,
      answer: 'ceiling',
      accept: ['ceiling', 'the ceiling'],
      stem:
        'Complete the sentence with ONE WORD ONLY from the passage.\nIn the shop, wheels hang from the ______.',
      evidence: 'Wheels hang from the ceiling.',
      rubric: '只认 ceiling。写 roof / wall 不给分 —— 题干要求原文词。',
      explanation: '第二段第二句就是「轮子挂在天花板上」。',
    },
    {
      taskType: 'sentence_completion',
      questionType: 'short_answer',
      marks: 1,
      options: null,
      answer: 'sound',
      accept: ['sound', 'a sound'],
      stem: 'Uncle Poh says that most problems make a ______ before they become serious.',
      evidence: 'he says that most problems make a sound before they become serious',
      rubric: '只认 sound。写 noise 不给分 —— 题干要求原文里的那个词。',
      explanation: '第二段末句，也是他「先听后修」的理由。',
    },
    {
      taskType: 'summary_completion',
      questionType: 'short_answer',
      marks: 2,
      options: null,
      answer: 'six or seven',
      accept: ['six or seven', '6 or 7', 'six to seven'],
      stem:
        'Complete the summary with words or numbers from the passage.\nEvery Saturday morning ______ students sit on the floor of the shop.',
      evidence:
        'Now, every Saturday morning, six or seven students sit on the floor of the shop and learn to fix their own bicycles.',
      rubric:
        '两分：写出 six or seven（或 6 or 7）= 2 分；只写 six 或只写 seven = 1 分；写别的数字 = 0 分。',
      explanation: '第三段末句给了这个数字。',
    },
    {
      taskType: 'short_answer',
      questionType: 'short_answer',
      marks: 2,
      options: null,
      answer: 'because the shop is noisy and full of young people',
      accept: null,
      stem:
        'Answer in NO MORE THAN TEN WORDS.\nWhy does Uncle Poh not want to rest on Saturdays?',
      evidence:
        'But on Saturday the shop is noisy and full of young people, and Uncle Poh says he has never felt less like resting.',
      rubric:
        '两分：写出「店里热闹 / 满是年轻人」= 2 分；只写「他喜欢工作」= 1 分；写原文没说的（比如「他缺钱」）= 0 分。',
      explanation: '最后一段把理由与结论写在同一句里。',
    },
  ],
  words: [
    { headword: 'narrow', surfaceForm: 'narrow', phonetic: '/ˈnærəʊ/', pos: 'adj.', translation: 'adj. 狭窄的', definition: 'not wide; only a short distance from one side to the other', context: 'On a narrow street behind the market there is a shop with no sign.' },
    { headword: 'sign', surfaceForm: 'sign', phonetic: '/saɪn/', pos: 'n.', translation: 'n. 招牌，标志', definition: 'a board with words that tells people something', context: 'On a narrow street behind the market there is a shop with no sign.' },
    { headword: 'repair', surfaceForm: 'repairs', phonetic: '/rɪˈpeə/', pos: 'v.', translation: 'v. 修理', definition: 'to mend something that is broken', context: 'Inside, an old man called Uncle Poh repairs bicycles.' },
    { headword: 'neighbour', surfaceForm: 'neighbours', phonetic: '/ˈneɪbə/', pos: 'n.', translation: 'n. 邻居', definition: 'a person who lives near you', context: 'He has done this for thirty-eight years, and the neighbours call him the bicycle doctor.' },
    { headword: 'crowded', surfaceForm: 'crowded', phonetic: '/ˈkraʊdɪd/', pos: 'adj.', translation: 'adj. 拥挤的', definition: 'full of people or things', context: 'The shop is small and always crowded.' },
    { headword: 'ceiling', surfaceForm: 'ceiling', phonetic: '/ˈsiːlɪŋ/', pos: 'n.', translation: 'n. 天花板', definition: 'the top surface inside a room', context: 'Wheels hang from the ceiling.' },
    { headword: 'screw', surfaceForm: 'screws', phonetic: '/skruː/', pos: 'n.', translation: 'n. 螺丝', definition: 'a small metal piece that holds things together', context: 'Boxes of screws, chains and brake cables cover the floor, and there is one chair for customers.' },
    { headword: 'chain', surfaceForm: 'chains', phonetic: '/tʃeɪn/', pos: 'n.', translation: 'n. 链条', definition: 'a line of metal rings joined together', context: 'Boxes of screws, chains and brake cables cover the floor, and there is one chair for customers.' },
    { headword: 'cable', surfaceForm: 'cables', phonetic: '/ˈkeɪbl/', pos: 'n.', translation: 'n. 缆线', definition: 'a thick wire used to pull or carry something', context: 'Boxes of screws, chains and brake cables cover the floor, and there is one chair for customers.' },
    { headword: 'customer', surfaceForm: 'customers', phonetic: '/ˈkʌstəmə/', pos: 'n.', translation: 'n. 顾客', definition: 'a person who buys something from a shop', context: 'Boxes of screws, chains and brake cables cover the floor, and there is one chair for customers.' },
    { headword: 'serious', surfaceForm: 'serious', phonetic: '/ˈsɪəriəs/', pos: 'adj.', translation: 'adj. 严重的', definition: 'bad or dangerous', context: 'He listens to a bicycle before he touches it, and he says that most problems make a sound before they become serious.' },
    { headword: 'secondary', surfaceForm: 'secondary', phonetic: '/ˈsekəndri/', pos: 'adj.', translation: 'adj. 中学的', definition: 'connected with school for students aged about 12 to 17', context: 'A girl from the secondary school brought in a flat tyre and asked if she could watch.' },
    { headword: 'tyre', surfaceForm: 'tyre', phonetic: '/ˈtaɪə/', pos: 'n.', translation: 'n. 轮胎', definition: 'the rubber ring around a wheel', context: 'A girl from the secondary school brought in a flat tyre and asked if she could watch.' },
    { headword: 'tool', surfaceForm: 'tools', phonetic: '/tuːl/', pos: 'n.', translation: 'n. 工具', definition: 'a thing you hold in your hand to do a job', context: 'Uncle Poh gave her the tools and let her do it herself.' },
    { headword: 'charge', surfaceForm: 'charge', phonetic: '/tʃɑːdʒ/', pos: 'v.', translation: 'v. 收费', definition: 'to ask someone to pay money', context: 'Uncle Poh does not charge them.' },
    { headword: 'mend', surfaceForm: 'mend', phonetic: '/mend/', pos: 'v.', translation: 'v. 修补', definition: 'to repair something small', context: 'A student who can mend a puncture understands that a broken thing is not always rubbish.' },
    { headword: 'puncture', surfaceForm: 'puncture', phonetic: '/ˈpʌŋktʃə/', pos: 'n.', translation: 'n. 扎破的洞（爆胎）', definition: 'a small hole in a tyre that lets the air out', context: 'A student who can mend a puncture understands that a broken thing is not always rubbish.' },
    { headword: 'rubbish', surfaceForm: 'rubbish', phonetic: '/ˈrʌbɪʃ/', pos: 'n.', translation: 'n. 垃圾', definition: 'things people throw away', context: 'A student who can mend a puncture understands that a broken thing is not always rubbish.' },
    { headword: 'earn', surfaceForm: 'earned', phonetic: '/ɜːn/', pos: 'v.', translation: 'v. 挣（钱）', definition: 'to get money by working', context: 'That idea, he believes, is worth more than the two dollars he would have earned.' },
    { headword: 'stiff', surfaceForm: 'stiff', phonetic: '/stɪf/', pos: 'adj.', translation: 'adj. 僵硬的', definition: 'hard to bend or move', context: 'He is seventy-three, and his hands are stiff in the morning.' },
    { headword: 'noisy', surfaceForm: 'noisy', phonetic: '/ˈnɔɪzi/', pos: 'adj.', translation: 'adj. 吵闹的', definition: 'making a lot of sound', context: 'But on Saturday the shop is noisy and full of young people, and Uncle Poh says he has never felt less like resting.' },
  ],
};

// ═══════════════════════════════════════════════════════════════
// 周二 2026-09-01
// ═══════════════════════════════════════════════════════════════

const TUE_PASSAGE = P(
  'Amirah lives on the eleventh floor. From her kitchen window she can see three trees, a car park and a long strip of sky. For most of her life she thought there were no birds in her estate. Then her science teacher lent her a pair of old binoculars and asked her to count.',
  'In the first week she saw four kinds of bird. By the end of the month she had seen nineteen. The birds had always been there; she had simply never looked up at the right time. Most of them appear early, between six and eight in the morning, when the estate is still quiet.',
  'She keeps a list in a cheap exercise book. Beside each name she writes the date, the weather and the exact place. A sunbird, she found, prefers the flowering tree near the bin centre. Mynas walk on the grass. A kingfisher, bright blue and completely unexpected, sat on the railing of the multi-storey car park for eleven minutes in June.',
  'Her teacher sends the list to a national bird survey every three months. Amirah was surprised that anyone wanted it. The survey needs ordinary places, her teacher explained, not only parks and forests, because nobody else is standing at an eleventh-floor window at half past six.',
  'Amirah is now teaching her younger brother the four commonest birds. He is eight and he gets bored quickly, but he has learned to recognise a myna by its walk. She says that is enough to begin with.',
);

const TUE = {
  date: '2026-09-01',
  title: 'Birds on the Eleventh Floor',
  passage: TUE_PASSAGE,
  questions: [
    {
      taskType: 'true_false_not_given',
      questionType: 'mcq',
      marks: 1,
      options: TFNG,
      answer: 'B',
      stem:
        'Do the following statements agree with the information in the passage? Write TRUE, FALSE or NOT GIVEN.\nThere were no birds in Amirah’s estate before she started counting.',
      evidence: 'The birds had always been there; she had simply never looked up at the right time.',
      explanation:
        '原文说鸟一直都在，只是她没在对的时间抬头 —— 与题干相反，所以 FALSE。',
    },
    {
      taskType: 'true_false_not_given',
      questionType: 'mcq',
      marks: 1,
      options: TFNG,
      answer: 'A',
      stem: 'The binoculars did not belong to Amirah.',
      evidence: 'Then her science teacher lent her a pair of old binoculars and asked her to count.',
      explanation: '望远镜是科学老师借给她的，所以不是她自己的。',
    },
    {
      taskType: 'true_false_not_given',
      questionType: 'mcq',
      marks: 1,
      options: TFNG,
      answer: 'C',
      stem: 'Amirah wants to study birds at university.',
      evidence: '',
      explanation: '原文完全没提她将来想学什么，所以是 NOT GIVEN。',
    },
    {
      taskType: 'true_false_not_given',
      questionType: 'mcq',
      marks: 1,
      options: TFNG,
      answer: 'A',
      stem: 'Her brother can now tell a myna from the way it walks.',
      evidence: 'he has learned to recognise a myna by its walk',
      explanation: '最后一段说他学会了靠走路的样子认出八哥。',
    },
    {
      taskType: 'matching_features',
      questionType: 'mcq',
      marks: 1,
      options: [
        { key: 'A', text: 'the sunbird' },
        { key: 'B', text: 'the mynas' },
        { key: 'C', text: 'the kingfisher' },
        { key: 'D', text: 'her younger brother' },
      ],
      answer: 'C',
      stem:
        'Match the statement with the correct bird or person.\nThis one stayed on a car park railing for eleven minutes.',
      evidence:
        'A kingfisher, bright blue and completely unexpected, sat on the railing of the multi-storey car park for eleven minutes in June.',
      explanation: '在停车场栏杆上停了十一分钟的是翠鸟。',
    },
    {
      taskType: 'multiple_choice',
      questionType: 'mcq',
      marks: 1,
      options: [
        { key: 'A', text: 'Nobody else watches from an ordinary window at that hour.' },
        { key: 'B', text: 'Her list is longer than anyone else’s.' },
        { key: 'C', text: 'She uses better binoculars than most people.' },
        { key: 'D', text: 'Her estate has more birds than the parks.' },
      ],
      answer: 'A',
      stem: 'Choose the correct letter.\nWhy does the national survey want Amirah’s list?',
      evidence:
        'The survey needs ordinary places, her teacher explained, not only parks and forests, because nobody else is standing at an eleventh-floor window at half past six.',
      explanation: '老师给的理由就是「没有别人在那个时间站在那样的窗口」。',
    },
    {
      taskType: 'sentence_completion',
      questionType: 'short_answer',
      marks: 1,
      options: null,
      answer: 'nineteen',
      accept: ['nineteen', '19'],
      stem:
        'Complete the sentence with ONE WORD OR NUMBER from the passage.\nBy the end of the first month Amirah had seen ______ kinds of bird.',
      evidence: 'By the end of the month she had seen nineteen.',
      rubric: '写 nineteen 或 19 都算对。写 four 不对 —— 那是第一周的数字。',
      explanation: '第二段把两个数字放在相邻的两句里，容易看错。',
    },
    {
      taskType: 'sentence_completion',
      questionType: 'short_answer',
      marks: 1,
      options: null,
      answer: 'weather',
      accept: ['weather', 'the weather'],
      stem: 'Beside each bird’s name Amirah writes the date, the ______ and the exact place.',
      evidence: 'Beside each name she writes the date, the weather and the exact place.',
      rubric: '只认 weather。写 time / temperature 不给分。',
      explanation: '第三段第二句列出了她每次记的三样东西。',
    },
    {
      taskType: 'summary_completion',
      questionType: 'short_answer',
      marks: 2,
      options: null,
      answer: 'between six and eight in the morning',
      accept: null,
      stem:
        'Complete the summary with words from the passage.\nMost of the birds appear ______, when the estate is still quiet.',
      evidence:
        'Most of them appear early, between six and eight in the morning, when the estate is still quiet.',
      rubric:
        '两分：写出「早上六点到八点之间」= 2 分；只写「早上」= 1 分；写别的时间 = 0 分。',
      explanation: '第二段末句给了准确的时间段。',
    },
    {
      taskType: 'short_answer',
      questionType: 'short_answer',
      marks: 2,
      options: null,
      answer: 'she is teaching him the four commonest birds',
      accept: null,
      stem:
        'Answer in NO MORE THAN TEN WORDS.\nWhat is Amirah doing for her younger brother now?',
      evidence: 'Amirah is now teaching her younger brother the four commonest birds.',
      rubric:
        '两分：写出「教弟弟认最常见的四种鸟」= 2 分；只写「教弟弟看鸟」= 1 分；写原文没说的（比如「带他去公园」）= 0 分。',
      explanation: '最后一段第一句就写了她正在教弟弟认哪几种鸟。',
    },
  ],
  words: [
    { headword: 'strip', surfaceForm: 'strip', phonetic: '/strɪp/', pos: 'n.', translation: 'n. 长条', definition: 'a long narrow piece of something', context: 'From her kitchen window she can see three trees, a car park and a long strip of sky.' },
    { headword: 'estate', surfaceForm: 'estate', phonetic: '/ɪˈsteɪt/', pos: 'n.', translation: 'n. 住宅区，小区', definition: 'a group of flats or houses built together', context: 'For most of her life she thought there were no birds in her estate.' },
    { headword: 'lend', surfaceForm: 'lent', phonetic: '/lend/', pos: 'v.', translation: 'v. 借出', definition: 'to let someone use something for a time', context: 'Then her science teacher lent her a pair of old binoculars and asked her to count.' },
    { headword: 'binoculars', surfaceForm: 'binoculars', phonetic: '/bɪˈnɒkjələz/', pos: 'n.', translation: 'n. 双筒望远镜', definition: 'a device with two tubes for looking at distant things', context: 'Then her science teacher lent her a pair of old binoculars and asked her to count.' },
    { headword: 'simply', surfaceForm: 'simply', phonetic: '/ˈsɪmpli/', pos: 'adv.', translation: 'adv. 仅仅，只是', definition: 'only; nothing more than', context: 'The birds had always been there; she had simply never looked up at the right time.' },
    { headword: 'appear', surfaceForm: 'appear', phonetic: '/əˈpɪə/', pos: 'v.', translation: 'v. 出现', definition: 'to begin to be seen', context: 'Most of them appear early, between six and eight in the morning, when the estate is still quiet.' },
    { headword: 'quiet', surfaceForm: 'quiet', phonetic: '/ˈkwaɪət/', pos: 'adj.', translation: 'adj. 安静的', definition: 'with little or no noise', context: 'Most of them appear early, between six and eight in the morning, when the estate is still quiet.' },
    { headword: 'cheap', surfaceForm: 'cheap', phonetic: '/tʃiːp/', pos: 'adj.', translation: 'adj. 便宜的', definition: 'costing little money', context: 'She keeps a list in a cheap exercise book.' },
    { headword: 'exact', surfaceForm: 'exact', phonetic: '/ɪɡˈzækt/', pos: 'adj.', translation: 'adj. 确切的', definition: 'completely correct in every detail', context: 'Beside each name she writes the date, the weather and the exact place.' },
    { headword: 'prefer', surfaceForm: 'prefers', phonetic: '/prɪˈfɜː/', pos: 'v.', translation: 'v. 更喜欢', definition: 'to like one thing better than another', context: 'A sunbird, she found, prefers the flowering tree near the bin centre.' },
    { headword: 'flowering', surfaceForm: 'flowering', phonetic: '/ˈflaʊərɪŋ/', pos: 'adj.', translation: 'adj. 开花的', definition: 'having flowers', context: 'A sunbird, she found, prefers the flowering tree near the bin centre.' },
    { headword: 'unexpected', surfaceForm: 'unexpected', phonetic: '/ˌʌnɪkˈspektɪd/', pos: 'adj.', translation: 'adj. 出乎意料的', definition: 'surprising; not thought of before', context: 'A kingfisher, bright blue and completely unexpected, sat on the railing of the multi-storey car park for eleven minutes in June.' },
    { headword: 'railing', surfaceForm: 'railing', phonetic: '/ˈreɪlɪŋ/', pos: 'n.', translation: 'n. 栏杆', definition: 'a fence made of bars', context: 'A kingfisher, bright blue and completely unexpected, sat on the railing of the multi-storey car park for eleven minutes in June.' },
    { headword: 'survey', surfaceForm: 'survey', phonetic: '/ˈsɜːveɪ/', pos: 'n.', translation: 'n. 调查', definition: 'a study that collects information from many places', context: 'Her teacher sends the list to a national bird survey every three months.' },
    { headword: 'national', surfaceForm: 'national', phonetic: '/ˈnæʃnəl/', pos: 'adj.', translation: 'adj. 全国的', definition: 'connected with a whole country', context: 'Her teacher sends the list to a national bird survey every three months.' },
    { headword: 'surprised', surfaceForm: 'surprised', phonetic: '/səˈpraɪzd/', pos: 'adj.', translation: 'adj. 惊讶的', definition: 'feeling something is unexpected', context: 'Amirah was surprised that anyone wanted it.' },
    { headword: 'ordinary', surfaceForm: 'ordinary', phonetic: '/ˈɔːdnri/', pos: 'adj.', translation: 'adj. 普通的', definition: 'not special or unusual', context: 'The survey needs ordinary places, her teacher explained, not only parks and forests, because nobody else is standing at an eleventh-floor window at half past six.' },
    { headword: 'forest', surfaceForm: 'forests', phonetic: '/ˈfɒrɪst/', pos: 'n.', translation: 'n. 森林', definition: 'a large area covered with trees', context: 'The survey needs ordinary places, her teacher explained, not only parks and forests, because nobody else is standing at an eleventh-floor window at half past six.' },
    { headword: 'commonest', surfaceForm: 'commonest', phonetic: '/ˈkɒmənɪst/', pos: 'adj.', translation: 'adj. 最常见的', definition: 'seen more often than any others', context: 'Amirah is now teaching her younger brother the four commonest birds.' },
    { headword: 'bored', surfaceForm: 'bored', phonetic: '/bɔːd/', pos: 'adj.', translation: 'adj. 无聊的，厌倦的', definition: 'tired of something because it is not interesting', context: 'He is eight and he gets bored quickly, but he has learned to recognise a myna by its walk.' },
    { headword: 'recognise', surfaceForm: 'recognise', phonetic: '/ˈrekəɡnaɪz/', pos: 'v.', translation: 'v. 认出', definition: 'to know what or who something is when you see it', context: 'He is eight and he gets bored quickly, but he has learned to recognise a myna by its walk.' },
  ],
};

module.exports = { LEVEL: 'ielts_simplified', DAYS: [MON, TUE] };
