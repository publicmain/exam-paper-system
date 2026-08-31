/**
 * 试点第一周 —— **O-Level 档**的每日课程内容。
 *
 * ## 这是给真学生用的
 *
 * 与 `s12f-reading-content.js`（验收夹具）不是一回事：那一份是为了验
 * 「账号建得出来」，这一份是**真学生要读的东西**。所以：
 *
 *   · 全部原创，不抄任何真实报刊或考卷（版权铁律见 `CLAUDE.md`）；
 *   · 题目全部答得出来，答案只依赖原文，不依赖课外知识；
 *   · 每一句 `evidence` 都是原文里**逐字**存在的一段；
 *   · 每一个目标词都**真的出现在当天那篇原文里**，语境句是原文原句。
 *
 * ## 一天的形状
 *
 * 十道题 = **六道客观题**（`questionType: 'mcq'`，服务端当场判）
 *        + **四道主观题**（`short_answer`，诚实地等老师批改）。
 *
 * 这个比例不是随手定的：`GradeService` 在零 AI 模式下只对 mcq 有确定性
 * 判定，其余一律 `needsHumanReview`。六道自动判分保证学生交卷立刻看得到
 * 东西，四道人工判分保证老师每天的批改量是可控的（每人 4 题）。
 *
 * 二十一个目标词 = 当天的词汇队列。数字来自引擎：课程队列就是「今天到期
 * 的词」，我们按天把 21 个词的 `due` 设成当天，于是学习卡 21 张、正式
 * 测试 21 题。
 */

'use strict';

const P = (...paras) => paras.join('\n\n');

/** 判断题的三个选项 —— 每一天、每一档都一样。 */
const TFNG = [
  { key: 'A', text: 'TRUE' },
  { key: 'B', text: 'FALSE' },
  { key: 'C', text: 'NOT GIVEN' },
];

// ═══════════════════════════════════════════════════════════════
// 周一 2026-08-31
// ═══════════════════════════════════════════════════════════════

const MON_PASSAGE = P(
  'For thirty years the Thursday night market on Jalan Serai left the same picture behind it: a street of flattened cartons, spilled ice and plastic cups drifting towards the drain. The stallholders were not careless people. They simply had nowhere to put anything, and the lorry that collected the rubbish arrived at six in the morning, long after the wind had done its work.',
  'The change began with a complaint that nobody expected. A retired teacher who lived above the noodle stall wrote to the town council, not about the noise, but about the drain. She had watched a blocked drain flood her void deck twice in one monsoon season, and she was certain the two problems were connected. The council sent an officer to look. He agreed with her, and then admitted that there was no budget for a second lorry.',
  'What the market got instead was an experiment. Each stall was given two crates, one for food waste and one for cardboard, and a volunteer was paid a small allowance to wheel them to a collection point at eleven. The scheme was voluntary, and in the first month only nine of the forty stalls took part. The volunteer, a student named Rafi, kept a notebook of who joined and who did not.',
  'The turning point was economic rather than moral. A recycling firm offered to buy clean cardboard by weight, and the money was divided among the stalls that had separated it properly. Within a term, thirty-four stalls were sorting their waste. The drain stopped blocking. Rafi’s notebook, which had begun as a way of keeping himself organised, became the evidence the council used when it applied for a proper grant.',
  'The market is not spotless now, and Rafi is careful to say so. Glass still breaks, and there are Thursdays when nobody can find the second crate. But the difference is visible from the flats above, and the retired teacher who started it all has stopped writing letters.',
);

const MON = {
  date: '2026-08-31',
  title: 'The Night Market Cleans Up',
  passage: MON_PASSAGE,
  questions: [
    // ── 六道客观题（服务端当场判）──
    {
      taskType: 'true_false_not_given',
      questionType: 'mcq',
      marks: 1,
      options: TFNG,
      answer: 'B',
      stem:
        'Do the following statements agree with the information in the passage? Write TRUE, FALSE or NOT GIVEN.\nThe stallholders were blamed for not caring about the mess.',
      evidence: 'The stallholders were not careless people.',
      explanation:
        '原文直说摊贩们「不是不在乎的人」，与题干相反，所以是 FALSE。',
    },
    {
      taskType: 'true_false_not_given',
      questionType: 'mcq',
      marks: 1,
      options: TFNG,
      answer: 'A',
      stem: 'The retired teacher’s letter was about the drain, not the noise.',
      evidence: 'wrote to the town council, not about the noise, but about the drain',
      explanation: '原文逐字写了「不是关于噪音，而是关于那条沟」。',
    },
    {
      taskType: 'true_false_not_given',
      questionType: 'mcq',
      marks: 1,
      options: TFNG,
      answer: 'C',
      stem: 'Rafi was paid more after the recycling firm arrived.',
      evidence: '',
      explanation:
        '原文只说 Rafi 拿一笔小额津贴，**从头到尾没提过后来有没有涨**，所以是 NOT GIVEN。',
    },
    {
      taskType: 'matching_features',
      questionType: 'mcq',
      marks: 1,
      options: [
        { key: 'A', text: 'the retired teacher' },
        { key: 'B', text: 'the council officer' },
        { key: 'C', text: 'Rafi' },
        { key: 'D', text: 'the recycling firm' },
      ],
      answer: 'B',
      stem:
        'Match the statement with the correct person or group.\nThis person agreed with the complaint but said there was no money.',
      evidence: 'He agreed with her, and then admitted that there was no budget for a second lorry.',
      explanation: '原文里同意却说没预算的是市政厅派来的那位官员。',
    },
    {
      taskType: 'matching_features',
      questionType: 'mcq',
      marks: 1,
      options: [
        { key: 'A', text: 'the retired teacher' },
        { key: 'B', text: 'the council officer' },
        { key: 'C', text: 'Rafi' },
        { key: 'D', text: 'the recycling firm' },
      ],
      answer: 'D',
      stem: 'This group made sorting the waste worth money.',
      evidence: 'A recycling firm offered to buy clean cardboard by weight',
      explanation: '回收公司按重量收干净纸板，分类才变成一件有钱可赚的事。',
    },
    {
      taskType: 'multiple_choice',
      questionType: 'mcq',
      marks: 1,
      options: [
        { key: 'A', text: 'The council finally bought a second lorry.' },
        { key: 'B', text: 'Sorting the waste began to pay the stalls.' },
        { key: 'C', text: 'The stallholders were fined for blocking the drain.' },
        { key: 'D', text: 'The night market was moved to another street.' },
      ],
      answer: 'B',
      stem: 'Choose the correct letter.\nWhy did the number of stalls taking part rise so quickly?',
      evidence: 'The turning point was economic rather than moral.',
      explanation:
        '原文明说转折点是「经济的而不是道德的」，接着解释回收公司付钱收纸板。',
    },
    // ── 四道主观题（老师批改）──
    {
      taskType: 'sentence_completion',
      questionType: 'short_answer',
      marks: 1,
      options: null,
      answer: 'crates',
      accept: ['crates', 'two crates'],
      stem:
        'Complete the sentence with ONE WORD ONLY from the passage.\nEvery stall in the experiment received two ______, one for food waste and one for cardboard.',
      evidence: 'Each stall was given two crates, one for food waste and one for cardboard',
      rubric:
        '只认原文里的 crates（单复数均可）。写 boxes / baskets 不给分 —— 题干要求 ONE WORD ONLY FROM THE PASSAGE。',
      explanation: '第三段逐字写了每个摊位得到两个 crates。',
    },
    {
      taskType: 'sentence_completion',
      questionType: 'short_answer',
      marks: 1,
      options: null,
      answer: 'notebook',
      accept: ['notebook', 'his notebook', "Rafi's notebook"],
      stem: 'The council used Rafi’s ______ as evidence when it applied for a grant.',
      evidence:
        'became the evidence the council used when it applied for a proper grant',
      rubric: '只认 notebook。写 record / diary 不给分（题干要求原文词）。',
      explanation: '第四段：Rafi 的本子后来成了市政厅申请拨款时用的证据。',
    },
    {
      taskType: 'summary_completion',
      questionType: 'short_answer',
      marks: 2,
      options: null,
      answer: 'thirty-four',
      accept: ['thirty-four', '34', 'thirty four'],
      stem:
        'Complete the summary with a number or words from the passage.\nIn the first month only nine stalls joined, but within a term ______ stalls were sorting their waste.',
      evidence: 'Within a term, thirty-four stalls were sorting their waste.',
      rubric:
        '写 thirty-four 或 34 都算对（全分）。只写 nine 或其他数字不给分。拼写错但数目对（thirtyfour）给一半。',
      explanation: '第四段直接给了这个数字。',
    },
    {
      taskType: 'short_answer',
      questionType: 'short_answer',
      marks: 2,
      options: null,
      answer: 'because glass still breaks and a crate is sometimes missing',
      accept: null,
      stem:
        'Answer in NO MORE THAN TEN WORDS.\nGive ONE reason why Rafi says the market is still not spotless.',
      evidence:
        'Glass still breaks, and there are Thursdays when nobody can find the second crate.',
      rubric:
        '两分：给出原文里的任一条理由（玻璃仍会碎 / 有时找不到第二个筐）并表达清楚 = 2 分；意思对但表达含糊 = 1 分；写原文没说的理由（比如「学生懒」）= 0 分。',
      explanation: '最后一段给了两条具体理由，任一条即可。',
    },
  ],
  words: [
    { headword: 'flatten', surfaceForm: 'flattened', phonetic: '/ˈflætn/', pos: 'v.', translation: 'v. 压平，压扁', definition: 'to make something flat, especially by pressing it', context: 'For thirty years the Thursday night market on Jalan Serai left the same picture behind it: a street of flattened cartons, spilled ice and plastic cups drifting towards the drain.' },
    { headword: 'carton', surfaceForm: 'cartons', phonetic: '/ˈkɑːtn/', pos: 'n.', translation: 'n. 纸盒，纸板箱', definition: 'a light box made of cardboard', context: 'For thirty years the Thursday night market on Jalan Serai left the same picture behind it: a street of flattened cartons, spilled ice and plastic cups drifting towards the drain.' },
    { headword: 'drift', surfaceForm: 'drifting', phonetic: '/drɪft/', pos: 'v.', translation: 'v. 漂流，随风飘动', definition: 'to be carried slowly by wind or water', context: 'For thirty years the Thursday night market on Jalan Serai left the same picture behind it: a street of flattened cartons, spilled ice and plastic cups drifting towards the drain.' },
    { headword: 'careless', surfaceForm: 'careless', phonetic: '/ˈkeələs/', pos: 'adj.', translation: 'adj. 粗心的，不在乎的', definition: 'not giving enough attention to what you are doing', context: 'The stallholders were not careless people.' },
    { headword: 'rubbish', surfaceForm: 'rubbish', phonetic: '/ˈrʌbɪʃ/', pos: 'n.', translation: 'n. 垃圾，废物', definition: 'things that are thrown away because they are not wanted', context: 'They simply had nowhere to put anything, and the lorry that collected the rubbish arrived at six in the morning, long after the wind had done its work.' },
    { headword: 'complaint', surfaceForm: 'complaint', phonetic: '/kəmˈpleɪnt/', pos: 'n.', translation: 'n. 投诉，抱怨', definition: 'a written or spoken statement that you are not satisfied', context: 'The change began with a complaint that nobody expected.' },
    { headword: 'retired', surfaceForm: 'retired', phonetic: '/rɪˈtaɪəd/', pos: 'adj.', translation: 'adj. 退休的', definition: 'having stopped working because of age', context: 'A retired teacher who lived above the noodle stall wrote to the town council, not about the noise, but about the drain.' },
    { headword: 'council', surfaceForm: 'council', phonetic: '/ˈkaʊnsl/', pos: 'n.', translation: 'n. 市政厅，议会', definition: 'a group of people elected to manage a town or area', context: 'A retired teacher who lived above the noodle stall wrote to the town council, not about the noise, but about the drain.' },
    { headword: 'monsoon', surfaceForm: 'monsoon', phonetic: '/mɒnˈsuːn/', pos: 'n.', translation: 'n. 季风；雨季', definition: 'the season of heavy rain in southern Asia', context: 'She had watched a blocked drain flood her void deck twice in one monsoon season, and she was certain the two problems were connected.' },
    { headword: 'admit', surfaceForm: 'admitted', phonetic: '/ədˈmɪt/', pos: 'v.', translation: 'v. 承认', definition: 'to agree that something is true, often unwillingly', context: 'He agreed with her, and then admitted that there was no budget for a second lorry.' },
    { headword: 'budget', surfaceForm: 'budget', phonetic: '/ˈbʌdʒɪt/', pos: 'n.', translation: 'n. 预算', definition: 'the money that is available to spend on something', context: 'He agreed with her, and then admitted that there was no budget for a second lorry.' },
    { headword: 'experiment', surfaceForm: 'experiment', phonetic: '/ɪkˈsperɪmənt/', pos: 'n.', translation: 'n. 实验，尝试', definition: 'a test done to find out whether an idea works', context: 'What the market got instead was an experiment.' },
    { headword: 'crate', surfaceForm: 'crates', phonetic: '/kreɪt/', pos: 'n.', translation: 'n. 箱，筐', definition: 'a large box used for carrying things', context: 'Each stall was given two crates, one for food waste and one for cardboard, and a volunteer was paid a small allowance to wheel them to a collection point at eleven.' },
    { headword: 'volunteer', surfaceForm: 'volunteer', phonetic: '/ˌvɒlənˈtɪə/', pos: 'n.', translation: 'n. 志愿者', definition: 'a person who offers to do something without being forced', context: 'Each stall was given two crates, one for food waste and one for cardboard, and a volunteer was paid a small allowance to wheel them to a collection point at eleven.' },
    { headword: 'allowance', surfaceForm: 'allowance', phonetic: '/əˈlaʊəns/', pos: 'n.', translation: 'n. 津贴，零用钱', definition: 'an amount of money given regularly for a purpose', context: 'Each stall was given two crates, one for food waste and one for cardboard, and a volunteer was paid a small allowance to wheel them to a collection point at eleven.' },
    { headword: 'voluntary', surfaceForm: 'voluntary', phonetic: '/ˈvɒləntri/', pos: 'adj.', translation: 'adj. 自愿的，非强制的', definition: 'done by choice, not because you must', context: 'The scheme was voluntary, and in the first month only nine of the forty stalls took part.' },
    { headword: 'economic', surfaceForm: 'economic', phonetic: '/ˌiːkəˈnɒmɪk/', pos: 'adj.', translation: 'adj. 经济上的', definition: 'connected with money and trade', context: 'The turning point was economic rather than moral.' },
    { headword: 'moral', surfaceForm: 'moral', phonetic: '/ˈmɒrəl/', pos: 'adj.', translation: 'adj. 道德的', definition: 'connected with what is right and wrong', context: 'The turning point was economic rather than moral.' },
    { headword: 'separate', surfaceForm: 'separated', phonetic: '/ˈsepəreɪt/', pos: 'v.', translation: 'v. 分开，分类', definition: 'to divide things into different groups', context: 'A recycling firm offered to buy clean cardboard by weight, and the money was divided among the stalls that had separated it properly.' },
    { headword: 'evidence', surfaceForm: 'evidence', phonetic: '/ˈevɪdəns/', pos: 'n.', translation: 'n. 证据', definition: 'facts that show something is true', context: 'Rafi’s notebook, which had begun as a way of keeping himself organised, became the evidence the council used when it applied for a proper grant.' },
    { headword: 'spotless', surfaceForm: 'spotless', phonetic: '/ˈspɒtləs/', pos: 'adj.', translation: 'adj. 一尘不染的', definition: 'completely clean', context: 'The market is not spotless now, and Rafi is careful to say so.' },
  ],
};

// ═══════════════════════════════════════════════════════════════
// 周二 2026-09-01
// ═══════════════════════════════════════════════════════════════

const TUE_PASSAGE = P(
  'Mrs Tan learned to swim at forty-one. She had grown up ten minutes from the sea and had never once put her face in it. Her parents could not swim either, and the lesson she had absorbed as a child was simple and unspoken: water is something you look at.',
  'The class she joined was designed for adults who were frightened. There were eight of them, all older than thirty, and the first two lessons never went deeper than the waist. The instructor, a patient man called Danny, spent most of the first hour teaching them to blow bubbles. Nobody laughed. Several of them admitted afterwards that they had been dreading the moment when their feet would leave the floor.',
  'What made the difference, Mrs Tan says, was that Danny never used the word relax. He told them instead exactly what their bodies would do. Air in the lungs makes a person float; a stiff neck sinks the hips; kicking hard achieves almost nothing if the head is lifted. Each instruction could be tested in the shallow end within a minute, and each one turned out to be true. Trust in the coach was built out of small, checkable facts rather than encouragement.',
  'Progress was uneven. Mrs Tan could float on her back in the third week but could not swim a length until the ninth. One classmate gave up entirely. Another, a taxi driver in his fifties, went on to swim across a reservoir the following year, which Danny insists was never the point of the course.',
  'The point, he says, is narrower and more useful. An adult who can float and turn onto their back is very unlikely to drown in calm water. Everything after that — speed, style, distance — is a hobby. Mrs Tan still swims slowly, and she still does not like the sea. But she takes her grandchildren to the pool on Sundays, and she gets in with them.',
);

const TUE = {
  date: '2026-09-01',
  title: 'Learning to Swim at Forty',
  passage: TUE_PASSAGE,
  questions: [
    {
      taskType: 'true_false_not_given',
      questionType: 'mcq',
      marks: 1,
      options: TFNG,
      answer: 'A',
      stem:
        'Do the following statements agree with the information in the passage? Write TRUE, FALSE or NOT GIVEN.\nMrs Tan grew up close to the sea.',
      evidence: 'She had grown up ten minutes from the sea and had never once put her face in it.',
      explanation: '原文说她长大的地方离海只有十分钟。',
    },
    {
      taskType: 'true_false_not_given',
      questionType: 'mcq',
      marks: 1,
      options: TFNG,
      answer: 'B',
      stem: 'Danny often told the class to relax.',
      evidence: 'What made the difference, Mrs Tan says, was that Danny never used the word relax.',
      explanation: '原文说他**从来不用**「relax」这个词，与题干相反。',
    },
    {
      taskType: 'true_false_not_given',
      questionType: 'mcq',
      marks: 1,
      options: TFNG,
      answer: 'C',
      stem: 'The class was held in the early morning.',
      evidence: '',
      explanation: '原文从没提过上课的时间，所以是 NOT GIVEN。',
    },
    {
      taskType: 'true_false_not_given',
      questionType: 'mcq',
      marks: 1,
      options: TFNG,
      answer: 'B',
      stem: 'Everyone in the class finished the course.',
      evidence: 'One classmate gave up entirely.',
      explanation: '原文明确说有一位同学彻底放弃了。',
    },
    {
      taskType: 'matching_features',
      questionType: 'mcq',
      marks: 1,
      options: [
        { key: 'A', text: 'Mrs Tan' },
        { key: 'B', text: 'Danny' },
        { key: 'C', text: 'the taxi driver' },
        { key: 'D', text: "Mrs Tan's parents" },
      ],
      answer: 'C',
      stem:
        'Match the statement with the correct person.\nThis person later swam across a reservoir.',
      evidence:
        'Another, a taxi driver in his fifties, went on to swim across a reservoir the following year, which Danny insists was never the point of the course.',
      explanation: '游过水库的是那位五十多岁的出租车司机。',
    },
    {
      taskType: 'multiple_choice',
      questionType: 'mcq',
      marks: 1,
      options: [
        { key: 'A', text: 'He gave them facts they could test for themselves.' },
        { key: 'B', text: 'He praised them after every attempt.' },
        { key: 'C', text: 'He had swum competitively when he was younger.' },
        { key: 'D', text: 'He took them into deep water on the first day.' },
      ],
      answer: 'A',
      stem: 'Choose the correct letter.\nWhy did the class come to trust Danny?',
      evidence:
        'Trust in the coach was built out of small, checkable facts rather than encouragement.',
      explanation:
        '原文直说信任是由「可以当场验证的小事实」堆出来的，而不是鼓励。',
    },
    {
      taskType: 'sentence_completion',
      questionType: 'short_answer',
      marks: 1,
      options: null,
      answer: 'bubbles',
      accept: ['bubbles', 'blow bubbles'],
      stem:
        'Complete the sentence with ONE WORD ONLY from the passage.\nIn the first hour Danny taught the class to blow ______.',
      evidence:
        'The instructor, a patient man called Danny, spent most of the first hour teaching them to blow bubbles.',
      rubric: '只认 bubbles。',
      explanation: '第二段逐字写了第一个小时在学吐泡泡。',
    },
    {
      taskType: 'sentence_completion',
      questionType: 'short_answer',
      marks: 1,
      options: null,
      answer: 'ninth',
      accept: ['ninth', '9th', 'the ninth week'],
      stem: 'Mrs Tan could not swim a full length until the ______ week.',
      evidence:
        'Mrs Tan could float on her back in the third week but could not swim a length until the ninth.',
      rubric: '写 ninth 或 9th 都算对。写 third 不对 —— 那是学会仰浮的那一周。',
      explanation: '第四段把两个时间点写在同一句里，很容易看错。',
    },
    {
      taskType: 'summary_completion',
      questionType: 'short_answer',
      marks: 2,
      options: null,
      answer: 'float and turn onto their back',
      accept: null,
      stem:
        'Complete the summary with words from the passage.\nAccording to Danny, an adult who can ______ is very unlikely to drown in calm water.',
      evidence:
        'An adult who can float and turn onto their back is very unlikely to drown in calm water.',
      rubric:
        '两分：同时写出「漂浮」与「翻身仰卧」两件事 = 2 分；只写其中一件 = 1 分；写「游得快」之类 = 0 分。',
      explanation: '最后一段将“不会溺水”的条件说得很具体。',
    },
    {
      taskType: 'short_answer',
      questionType: 'short_answer',
      marks: 2,
      options: null,
      answer: 'that water is only something to look at',
      accept: null,
      stem:
        'Answer in NO MORE THAN TEN WORDS.\nWhat lesson had Mrs Tan absorbed from her parents as a child?',
      evidence: 'water is something you look at',
      rubric:
        '两分：写出「水只是用来看的 / 不是用来下的」= 2 分；写「父母不会游泳」只算背景，给 1 分；写「水很危险」不给分（原文没这么说）。',
      explanation: '第一段末句就是那句「没人说出口的课」。',
    },
  ],
  words: [
    { headword: 'absorb', surfaceForm: 'absorbed', phonetic: '/əbˈzɔːb/', pos: 'v.', translation: 'v. 吸收；领会', definition: 'to take something in, especially an idea or lesson', context: 'Her parents could not swim either, and the lesson she had absorbed as a child was simple and unspoken: water is something you look at.' },
    { headword: 'unspoken', surfaceForm: 'unspoken', phonetic: '/ʌnˈspəʊkən/', pos: 'adj.', translation: 'adj. 没说出口的', definition: 'understood without being said', context: 'Her parents could not swim either, and the lesson she had absorbed as a child was simple and unspoken: water is something you look at.' },
    { headword: 'frighten', surfaceForm: 'frightened', phonetic: '/ˈfraɪtn/', pos: 'v.', translation: 'v. 使害怕', definition: 'to make someone afraid', context: 'The class she joined was designed for adults who were frightened.' },
    { headword: 'waist', surfaceForm: 'waist', phonetic: '/weɪst/', pos: 'n.', translation: 'n. 腰，腰部', definition: 'the middle part of the body, above the hips', context: 'There were eight of them, all older than thirty, and the first two lessons never went deeper than the waist.' },
    { headword: 'instructor', surfaceForm: 'instructor', phonetic: '/ɪnˈstrʌktə/', pos: 'n.', translation: 'n. 教练，指导者', definition: 'a person who teaches a practical skill', context: 'The instructor, a patient man called Danny, spent most of the first hour teaching them to blow bubbles.' },
    { headword: 'patient', surfaceForm: 'patient', phonetic: '/ˈpeɪʃnt/', pos: 'adj.', translation: 'adj. 有耐心的', definition: 'able to wait calmly without getting angry', context: 'The instructor, a patient man called Danny, spent most of the first hour teaching them to blow bubbles.' },
    { headword: 'dread', surfaceForm: 'dreading', phonetic: '/dred/', pos: 'v.', translation: 'v. 恐惧，害怕', definition: 'to feel very worried about something that will happen', context: 'Several of them admitted afterwards that they had been dreading the moment when their feet would leave the floor.' },
    { headword: 'float', surfaceForm: 'float', phonetic: '/fləʊt/', pos: 'v.', translation: 'v. 漂浮', definition: 'to stay on the surface of water without sinking', context: 'Air in the lungs makes a person float; a stiff neck sinks the hips; kicking hard achieves almost nothing if the head is lifted.' },
    { headword: 'lung', surfaceForm: 'lungs', phonetic: '/lʌŋ/', pos: 'n.', translation: 'n. 肺', definition: 'one of the two organs used for breathing', context: 'Air in the lungs makes a person float; a stiff neck sinks the hips; kicking hard achieves almost nothing if the head is lifted.' },
    { headword: 'stiff', surfaceForm: 'stiff', phonetic: '/stɪf/', pos: 'adj.', translation: 'adj. 僵硬的', definition: 'not able to bend or move easily', context: 'Air in the lungs makes a person float; a stiff neck sinks the hips; kicking hard achieves almost nothing if the head is lifted.' },
    { headword: 'sink', surfaceForm: 'sinks', phonetic: '/sɪŋk/', pos: 'v.', translation: 'v. 下沉', definition: 'to go down below the surface of water', context: 'Air in the lungs makes a person float; a stiff neck sinks the hips; kicking hard achieves almost nothing if the head is lifted.' },
    { headword: 'achieve', surfaceForm: 'achieves', phonetic: '/əˈtʃiːv/', pos: 'v.', translation: 'v. 达到，实现', definition: 'to succeed in doing something after effort', context: 'Air in the lungs makes a person float; a stiff neck sinks the hips; kicking hard achieves almost nothing if the head is lifted.' },
    { headword: 'shallow', surfaceForm: 'shallow', phonetic: '/ˈʃæləʊ/', pos: 'adj.', translation: 'adj. 浅的', definition: 'not deep; the water reaches only a short way down', context: 'Each instruction could be tested in the shallow end within a minute, and each one turned out to be true.' },
    { headword: 'instruction', surfaceForm: 'instruction', phonetic: '/ɪnˈstrʌkʃn/', pos: 'n.', translation: 'n. 指令，说明', definition: 'a statement telling you what to do', context: 'Each instruction could be tested in the shallow end within a minute, and each one turned out to be true.' },
    { headword: 'checkable', surfaceForm: 'checkable', phonetic: '/ˈtʃekəbl/', pos: 'adj.', translation: 'adj. 可验证的', definition: 'able to be tested or confirmed', context: 'Trust in the coach was built out of small, checkable facts rather than encouragement.' },
    { headword: 'encouragement', surfaceForm: 'encouragement', phonetic: '/ɪnˈkʌrɪdʒmənt/', pos: 'n.', translation: 'n. 鼓励', definition: 'words or actions that give someone confidence', context: 'Trust in the coach was built out of small, checkable facts rather than encouragement.' },
    { headword: 'uneven', surfaceForm: 'uneven', phonetic: '/ʌnˈiːvn/', pos: 'adj.', translation: 'adj. 不均匀的，时快时慢的', definition: 'not regular or steady', context: 'Progress was uneven.' },
    { headword: 'reservoir', surfaceForm: 'reservoir', phonetic: '/ˈrezəvwɑː/', pos: 'n.', translation: 'n. 水库', definition: 'a lake used for storing water', context: 'Another, a taxi driver in his fifties, went on to swim across a reservoir the following year, which Danny insists was never the point of the course.' },
    { headword: 'insist', surfaceForm: 'insists', phonetic: '/ɪnˈsɪst/', pos: 'v.', translation: 'v. 坚持说', definition: 'to say firmly that something is true', context: 'Another, a taxi driver in his fifties, went on to swim across a reservoir the following year, which Danny insists was never the point of the course.' },
    { headword: 'drown', surfaceForm: 'drown', phonetic: '/draʊn/', pos: 'v.', translation: 'v. 溺水，淹死', definition: 'to die under water because you cannot breathe', context: 'An adult who can float and turn onto their back is very unlikely to drown in calm water.' },
    { headword: 'hobby', surfaceForm: 'hobby', phonetic: '/ˈhɒbi/', pos: 'n.', translation: 'n. 爱好', definition: 'an activity you do for pleasure in your free time', context: 'Everything after that — speed, style, distance — is a hobby.' },
  ],
};

module.exports = { LEVEL: 'olevel', DAYS: [MON, TUE] };
