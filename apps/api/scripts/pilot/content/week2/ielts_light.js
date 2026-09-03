/**
 * 首发周 —— **ielts_light（雅思轻量）**档。
 *
 * ## 这一档的五天从哪来
 *
 * 周一到周三改编自 `test-fixtures/ielts-light-2026` 的 07 / 08 / 09；
 * 周四周五是原创，因为库里其余几篇**已经发到过真实学生手上**。
 *
 * 挑文章的口径是「学生读没读过」，不是「题库里有没有」——
 * 见 `prepare-pilot-week.js` 的 `assertNoHistoricalNearDuplicates`。
 * light-06 在 2026-09-01 刚发给旧早测班，light-10 同理，所以都不能用；
 * 07 / 08 / 09 虽然也在题库里，但一份作业都没挂过，没有任何学生见过。
 *
 * ## 一天的形状（与库里的题型一致）
 *
 *   · 3 道 TRUE / FALSE / NOT GIVEN（自动判）
 *   · 3 道填空转四选一（自动判；干扰项只从**同一篇**的其它填空答案取，
 *     学生不会因为「只有一个词认得」而蒙对）
 *   · 4 道人工判主观题（本文件里人工出，每题写明按要点给分）
 *
 * 原创的两天写成与库文件相同的形状，因此走同一条适配代码 —— 内容来源
 * 不同不该带来第二套渲染路径。
 */

'use strict';

const fs = require('fs');
const path = require('path');
const { DATES, TFNG, TFNG_KEY, cleanPassage, bestEvidence, mcqOptions } = require('./adapters');

const LEVEL = 'ielts_light';
const DIR = path.resolve(__dirname, '..', '..', '..', '..', 'test-fixtures', 'ielts-light-2026');

const P = (...paras) => paras.join('\n\n');

// ═══════════════════════════════════════════════════════════════
// 原创：周四 —— 铁路如何逼出了标准时间
// ═══════════════════════════════════════════════════════════════

const RAIL = {
  key: 'original-rail-time',
  passageTitle: 'Keeping Time by Rail',
  passage: P(
    'Before railways, every town kept its own time, set by the sun. Noon in one town was several minutes later than noon thirty miles to the east. Nobody minded, because nobody could travel fast enough for the difference to matter.',
    'Trains changed that. A timetable that said a train left at ten o’clock was useless if ten o’clock meant something different at each station on the line. Worse, two trains sharing a single track could be given clearance by clocks that disagreed, and in the 1840s several collisions were traced to exactly that.',
    'British railway companies responded by adopting a single time, taken from Greenwich and carried down the line by telegraph. Some towns resisted for years: a clock in Bristol was fitted with two minute hands, one for railway time and one for local time. The law did not catch up until 1880.',
    'Elsewhere the problem was larger. The United States spanned more than fifty degrees of longitude, and by 1880 its railways were running on about eighty different local times. In 1883 the companies simply agreed among themselves to divide the country into four zones, and the public followed. Congress did not make the arrangement official for another thirty-five years.',
    'The pattern is familiar in the history of technology. A machine creates a problem that nobody had before, an industry invents a fix for its own convenience, and the fix ends up organising everyone’s daily life. Almost nobody now setting an alarm clock thinks of it as a railway invention.',
  ),
  wordlist: [{ word: 'timetable' }],
  questions: [
    { taskType: 'true_false_not_given', item: 'Before railways, differences between local times caused serious problems.', answer: 'FALSE', marks: 1 },
    { taskType: 'true_false_not_given', item: 'For a time, some British towns displayed railway time and local time together.', answer: 'TRUE', marks: 1 },
    { taskType: 'true_false_not_given', item: 'The Bristol clock described in the passage is still working today.', answer: 'NOT GIVEN', marks: 1 },
    { taskType: 'sentence_completion', item: 'A single railway time was taken from Greenwich and sent along the line by ______.', answer: 'telegraph', marks: 1 },
    { taskType: 'sentence_completion', item: 'In 1883 the American companies divided the country into four ______.', answer: 'zones', marks: 1 },
    { taskType: 'sentence_completion', item: 'Before the railways, each town set its own time by the ______.', answer: 'sun', marks: 1 },
  ],
};

// ═══════════════════════════════════════════════════════════════
// 原创：周五 —— 雨的气味
// ═══════════════════════════════════════════════════════════════

const RAIN = {
  key: 'original-smell-of-rain',
  passageTitle: 'The Smell of Rain',
  passage: P(
    'Most people can describe the smell that arrives just before rain, and many claim they can tell a storm is coming by it. The claim is not fanciful. The smell is real, it has been chemically identified, and it does travel ahead of the weather that produces it.',
    'Two substances are mainly responsible. The first is geosmin, produced by bacteria that live in soil. Human beings are extraordinarily sensitive to it: a concentration of five parts per trillion is enough to notice, which makes the nose better at detecting geosmin than at detecting almost anything else.',
    'The second is petrichor, an oily mixture that plants release onto dry ground during long spells without rain. When the first drops land, they trap tiny bubbles of air beneath them. The bubbles burst upwards, throwing the oils and any bacteria into the air as a fine spray, and the wind carries the spray forward.',
    'That last detail explains the prediction. Because the wind arrives before the rain cloud does, the smell reaches a person some minutes ahead of the first drop falling on them. Nobody is sensing the weather; they are smelling rain that has already fallen somewhere upwind.',
    'The sensitivity may not be an accident. Some researchers argue that an animal able to smell where rain has fallen has an advantage in dry country, and that the response is inherited rather than learned. Others point out that geosmin also warns of water that has stood too long, and that the same nose may simply be avoiding a bad drink.',
  ),
  wordlist: [{ word: 'concentration' }],
  questions: [
    { taskType: 'true_false_not_given', item: 'The smell people notice before rain has been identified chemically.', answer: 'TRUE', marks: 1 },
    { taskType: 'true_false_not_given', item: 'People smell the rain before it has fallen anywhere at all.', answer: 'FALSE', marks: 1 },
    { taskType: 'true_false_not_given', item: 'Dogs detect geosmin at lower concentrations than humans do.', answer: 'NOT GIVEN', marks: 1 },
    { taskType: 'sentence_completion', item: 'Geosmin is produced by ______ that live in soil.', answer: 'bacteria', marks: 1 },
    { taskType: 'sentence_completion', item: 'Trapped under the first drops, tiny ______ burst upwards and throw the oils into the air.', answer: 'bubbles', marks: 1 },
    { taskType: 'sentence_completion', item: 'Petrichor is an oily mixture released by ______ onto dry ground.', answer: 'plants', marks: 1 },
  ],
};

const TFNG_INSTRUCTION =
  'Do the following statements agree with the information given in the passage? Write TRUE if the statement agrees with the information, FALSE if the statement contradicts the information, or NOT GIVEN if there is no information on this.';
const COMPLETION_INSTRUCTION = 'Complete the sentence with ONE WORD ONLY from the passage.';

/** 五个教学日：字符串 = 从库里读，对象 = 原创（形状与库文件一致）。 */
const PLAN = [
  'light-07-tidal-power.json',
  'light-08-libraries.json',
  'light-09-salt.json',
  RAIL,
  RAIN,
];

/**
 * TRUE / FALSE 题的证据句 —— **人工指定**，顺序与该篇的 TFNG 题一致。
 *
 * 一开始是拿题干里最长的实词去原文里自动匹配的，五天里错了五道。判断题的
 * 证据正是学生对答案时要看的那一句，靠启发式挑不合格；十几个字符串手写
 * 一遍便宜得多。NOT GIVEN 一律留空 —— 原文里本来就没有这句话。
 */
const TF_EVIDENCE = {
  'light-07-tidal-power.json': [
    'They are produced by the pull of the moon, and their timing can be calculated centuries in advance.',
    'Tidal electricity remains more expensive than wind or solar, and only a handful of commercial sites exist.',
    '',
  ],
  'light-08-libraries.json': [
    'In most countries the number of books lent each year has indeed fallen.',
    'Not everyone welcomes the change.',
    '',
  ],
  'light-09-salt.json': [
    'Without water, the bacteria cannot grow.',
    'What ended all this was not a discovery about salt but one about cold.',
    '',
  ],
  'original-rail-time': [
    'Nobody minded, because nobody could travel fast enough for the difference to matter.',
    'Some towns resisted for years: a clock in Bristol was fitted with two minute hands, one for railway time and one for local time.',
    '',
  ],
  'original-smell-of-rain': [
    'The smell is real, it has been chemically identified, and it does travel ahead of the weather that produces it.',
    'Nobody is sensing the weather; they are smelling rain that has already fallen somewhere upwind.',
    '',
  ],
};

/** 人工出的四道主观题：`[taskType, 题干, 参考答案, 证据句, 评分标准]`。 */
const HUMAN = {
  'light-07-tidal-power.json': [
    [
      'summary_completion',
      'Complete the sentence with information from the passage.\nTides are caused by ______, which is why their timing can be worked out centuries ahead.',
      'the pull of the moon',
      'They are produced by the pull of the moon, and their timing can be calculated centuries in advance.',
      '两分：写出「月球引力」给 2 分；只写「月亮」给 1 分。',
    ],
    [
      'short_answer',
      'Describe how a barrage produces electricity.',
      'water is held back at high tide and let out through turbines as the tide falls',
      'Water is trapped behind it at high tide and released through turbines as the tide falls.',
      '两分：涨潮蓄水、落潮放水推动涡轮，两个环节都写到给 2 分；只写一个环节给 1 分。',
    ],
    [
      'short_answer',
      'Give ONE reason why barrages are now rarely built.',
      'they keep mudflats permanently underwater and the birds lose their food',
      'Mudflats that are normally uncovered twice a day stay submerged, and the birds that feed on them lose their food supply.',
      '一分：泥滩被长期淹没 / 鸟类失去食物 / 鱼类必须穿过涡轮，任一点写清楚即给分。',
    ],
    [
      'short_answer',
      'Why is maintaining an underwater turbine so expensive?',
      'salt water wrecks the machinery and repairs ten metres down are very difficult',
      'Salt water destroys machinery, and repairing a turbine ten metres below the surface is far harder than climbing a tower on land.',
      '两分：海水腐蚀、水下维修困难两点都写到给 2 分；只写一点给 1 分。',
    ],
  ],
  'light-08-libraries.json': [
    [
      'summary_completion',
      'Complete the sentence with information from the passage.\nThe prediction about libraries was wrong even though the number of books lent each year has ______.',
      'fallen in most countries',
      'In most countries the number of books lent each year has indeed fallen.',
      '两分：写出「大多数国家借书量确实下降」给 2 分；只写「下降」给 1 分。',
    ],
    [
      'short_answer',
      'Which service did users name most often, and who mainly used it?',
      'free internet access, used mainly by people with no connection at home',
      'The service users named most often was free internet access, used mainly by those without a connection at home — job seekers filling in applications, older residents managing pensions, new arrivals dealing with paperwork in an unfamiliar language.',
      '两分：服务名称与使用人群各 1 分。举出求职者 / 老年人 / 新移民任一例也算说清人群。',
    ],
    [
      'short_answer',
      'Why do some libraries now employ social workers?',
      'the people who most need help already come through the door',
      'A few employ social workers, having found that the people who most need help are already walking through the door.',
      '一分：指出最需要帮助的人本来就已经在馆里即给分。',
    ],
    [
      'short_answer',
      'State the criticism made of libraries taking on these new roles.',
      'a library is for books, and doing many extra jobs means none is done well',
      'Critics argue that a library is for books, and that asking it to absorb work the state has stopped doing elsewhere leaves it doing many things adequately and none of them well.',
      '两分：写出「图书馆本职是书」和「样样都做、样样不精」两层给 2 分；只写一层给 1 分。',
    ],
  ],
  'light-09-salt.json': [
    [
      'summary_completion',
      'Complete the sentence with information from the passage.\nSalt preserves meat and fish by pulling water out of their cells and out of the ______.',
      'bacteria that would otherwise multiply in them',
      'Salt draws water out of the cells of meat and fish, and out of the bacteria that would otherwise multiply in them.',
      '两分：写出「细菌」并说明细菌因此无法繁殖给 2 分；只写「细菌」给 1 分。',
    ],
    [
      'short_answer',
      'Why was this substance so easy for governments to tax?',
      'everyone needed it and only a few places produced it',
      'Because everyone needed salt and few places produced it, it was easy to tax.',
      '两分：需求普遍、产地稀少两点都写到给 2 分；只写一点给 1 分。',
    ],
    [
      'short_answer',
      'What did Gandhi do in 1930, and why was it against the law?',
      'he walked to the sea and made salt, breaking the British monopoly on producing it',
      'In India, a British monopoly on salt production led Gandhi to walk to the sea in 1930 and make some himself, an act of deliberate lawbreaking that drew worldwide attention.',
      '两分：行为（走到海边自制盐）与违法原因（英国垄断制盐）各 1 分。',
    ],
    [
      'short_answer',
      'What ended the strategic value of salt?',
      'mechanical refrigeration, which let food be kept without any chemical',
      'Mechanical refrigeration spread through the late nineteenth century, and food could be kept without any chemical at all.',
      '两分：写出「机械制冷」给 1 分，补充「食物不再需要化学物质保存」再给 1 分。',
    ],
  ],
  'original-rail-time': [
    [
      'summary_completion',
      'Complete the sentence with information from the passage.\nTwo trains on a single track could be cleared by clocks that ______, and several crashes in the 1840s were traced to this.',
      'disagreed with each other',
      'Worse, two trains sharing a single track could be given clearance by clocks that disagreed, and in the 1840s several collisions were traced to exactly that.',
      '两分：写出「两地时钟不一致」给 2 分；只写「时钟不准」给 1 分。',
    ],
    [
      'short_answer',
      'How did the Bristol clock show that the town had not fully accepted the new system?',
      'it carried two minute hands, one for railway time and one for local time',
      'Some towns resisted for years: a clock in Bristol was fitted with two minute hands, one for railway time and one for local time.',
      '两分：写出「两根分针」并说明分别代表铁路时间与本地时间给 2 分；只写「两根分针」给 1 分。',
    ],
    [
      'short_answer',
      'Who decided to divide the United States into four zones, and in what year?',
      'the railway companies themselves, in 1883',
      'In 1883 the companies simply agreed among themselves to divide the country into four zones, and the public followed.',
      '一分：答出「铁路公司自己（不是国会）」即给分；年份写错不倒扣。',
    ],
    [
      'short_answer',
      'What general pattern in the history of technology does the writer say this illustrates?',
      'an industry invents a fix for its own convenience and it ends up organising everyone’s life',
      'A machine creates a problem that nobody had before, an industry invents a fix for its own convenience, and the fix ends up organising everyone’s daily life.',
      '两分：写出「行业为自己方便而发明的办法，最后规范了所有人的生活」给 2 分；只写「技术改变生活」这种泛泛而谈给 0 分。',
    ],
  ],
  'original-smell-of-rain': [
    [
      'summary_completion',
      'Complete the sentence with information from the passage.\nHuman sensitivity to geosmin is remarkable: a concentration of ______ is enough for a person to notice it.',
      'five parts per trillion',
      'Human beings are extraordinarily sensitive to it: a concentration of five parts per trillion is enough to notice, which makes the nose better at detecting geosmin than at detecting almost anything else.',
      '两分：写出「万亿分之五 / five parts per trillion」给 2 分；只写「极低浓度」给 1 分。',
    ],
    [
      'short_answer',
      'Explain how the first falling drops send the oils up into the air.',
      'they trap tiny air bubbles underneath, and the bubbles burst upwards as a fine spray',
      'When the first drops land, they trap tiny bubbles of air beneath them. The bubbles burst upwards, throwing the oils and any bacteria into the air as a fine spray, and the wind carries the spray forward.',
      '两分：困住气泡、气泡向上破裂形成细雾，两个环节都写到给 2 分；只写一个环节给 1 分。',
    ],
    [
      'short_answer',
      'Why does the smell reach a person before the rain does?',
      'the wind gets there ahead of the rain cloud',
      'Because the wind arrives before the rain cloud does, the smell reaches a person some minutes ahead of the first drop falling on them.',
      '一分：指出「风比雨云先到」即给分。',
    ],
    [
      'short_answer',
      'Give the TWO explanations offered for why humans are so sensitive to geosmin.',
      'it helps find water in dry country, and it warns of water that has stood too long',
      'Some researchers argue that an animal able to smell where rain has fallen has an advantage in dry country, and that the response is inherited rather than learned. Others point out that geosmin also warns of water that has stood too long, and that the same nose may simply be avoiding a bad drink.',
      '两分：两种解释各 1 分（旱地找水的优势 / 警告久置的水不能喝）。',
    ],
  ],
};

function load(entry) {
  if (typeof entry !== 'string') return entry;
  const raw = JSON.parse(fs.readFileSync(path.join(DIR, entry), 'utf8'));
  return { ...raw, key: entry };
}

function buildDay(entry, dayIndex) {
  const raw = load(entry);
  const key = raw.key;
  const passage = cleanPassage(raw.passage);

  const completionAnswers = raw.questions
    .filter((q) => q.taskType === 'sentence_completion')
    .map((q) => String(q.answer));
  // 补一个同篇的词做第四个干扰项 —— 三选一对这一档太容易。
  const spare = raw.wordlist?.[0]?.word ? [String(raw.wordlist[0].word)] : [];

  let tfIndex = 0;
  const auto = raw.questions.map((q) => {
    const instruction = q.instruction
      ?? (q.taskType === 'true_false_not_given' ? TFNG_INSTRUCTION : COMPLETION_INSTRUCTION);
    const stem = `${instruction}\n${q.item}`;
    if (q.taskType === 'true_false_not_given') {
      const evidence = q.answer === 'NOT GIVEN' ? '' : TF_EVIDENCE[key][tfIndex];
      tfIndex += 1;
      return {
        taskType: 'true_false_not_given',
        questionType: 'mcq',
        marks: q.marks,
        options: TFNG,
        answer: TFNG_KEY[q.answer],
        stem,
        evidence,
        explanation:
          q.answer === 'NOT GIVEN'
            ? '原文自始至终没有提到这件事，既不能证实也不能证伪，所以选 NOT GIVEN。'
            : `原文的对应句与题干${q.answer === 'TRUE' ? '一致' : '相反'}，所以选 ${q.answer}。`,
      };
    }
    const distractors = [...completionAnswers, ...spare].filter(
      (a) => a.toLowerCase() !== String(q.answer).toLowerCase(),
    );
    const choice = mcqOptions(q.answer, distractors);
    return {
      taskType: 'sentence_completion',
      questionType: 'mcq',
      marks: q.marks,
      options: choice.options,
      answer: choice.answer,
      stem,
      evidence: bestEvidence(passage, q.answer, q.item),
      explanation: `原文在这个位置用的词是 “${q.answer}”。`,
    };
  });

  const human = HUMAN[key].map(([taskType, stem, answer, evidence, rubric], i) => ({
    taskType,
    questionType: 'short_answer',
    marks: i === 2 ? 1 : 2,
    options: null,
    answer,
    accept: null,
    stem,
    evidence,
    rubric,
    explanation: `答案依据原文这一句：${evidence}`,
  }));

  return {
    date: DATES[dayIndex],
    title: raw.passageTitle,
    passage,
    questions: [...auto, ...human],
    words: [],
    source: key,
  };
}

module.exports = { LEVEL, PLAN, DIR, load, DAYS: PLAN.map(buildDay) };
