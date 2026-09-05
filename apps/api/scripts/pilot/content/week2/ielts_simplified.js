/**
 * 首发周 —— **ielts_simplified（O-Level 基础）**档。
 *
 * 这一档面向基础最弱的学生：文章两百多词、句子短、故事一条线走到底。
 *
 * 周一到周三改编自 `singapore-olevel-1128` 的 basic 系列（06 / 08 / 09，
 * 都没发到过学生手上）；周四周五原创。
 *
 * ## 为什么这一档人工出的题最多
 *
 * basic 系列每篇只有 5 道题（2 道简答 + 3 道四选一），离一天十题差 5 道。
 * 而且题型只有两种，凑不满内容合同要求的四种。所以每天补：
 *
 *   · 2 道 TRUE / FALSE / NOT GIVEN
 *   · 1 道原文填空
 *   · 2 道两分主观题
 *
 * 补题时刻意贴着这一档的水平：判断句只考原文明说过的事实，主观题问
 * 「为什么」而不是「这个修辞有什么效果」—— 后者是标准档的问法。
 */

'use strict';

const fs = require('fs');
const path = require('path');
const { DATES, TFNG, TFNG_KEY, cleanPassage, mcqOptions, tidyStem } = require('./adapters');

const LEVEL = 'ielts_simplified';
const DIR = path.resolve(__dirname, '..', '..', '..', '..', 'test-fixtures', 'singapore-olevel-1128');

const P = (...paras) => paras.map((p, i) => `Paragraph ${i + 1}\n${p}`).join('\n\n');

const TFNG_INSTRUCTION =
  'Do the following statements agree with the information in the passage? Write TRUE if the statement agrees, FALSE if it contradicts the passage, or NOT GIVEN if the passage does not say.';

// ═══════════════════════════════════════════════════════════════
// 原创：周四 —— The Library Clock
// ═══════════════════════════════════════════════════════════════

const CLOCK_PASSAGE = P(
  'The clock in our school library is five minutes fast. Everybody knows this. Nobody fixes it.',
  'I noticed it in Secondary One. I checked it against my phone three times that week to be sure.',
  'For two years it annoyed me. A clock that is wrong is worse than no clock at all, I thought. Twice I nearly said something, and twice I did not.',
  'In March I finally told Mrs Rahim at the desk. I said it politely. I said I could bring a screwdriver.',
  'She put down her pen and smiled at me in a way I did not expect.',
  "'I set it five minutes fast,' she said. 'Fourteen years ago.'",
  'She told me that the library closes at six, and that students who start packing up at six are still in the building at ten past. Five minutes on the clock buys her ten minutes at the door.',
  'I asked why she did not simply tell people. She said that a clock nobody trusts is not much use either.',
  'I still check my phone. But I have stopped feeling annoyed, and last week I heard a Secondary One boy complain about the clock, and I did not tell him anything.',
);

// ═══════════════════════════════════════════════════════════════
// 原创：周五 —— The Long Way Round
// ═══════════════════════════════════════════════════════════════

const LONGWAY_PASSAGE = P(
  'There is a car park between my block and the school. For three years I walked through it every morning. It saved four minutes.',
  'In April they put up a fence. A sign said the ground was being repaired. It did not say for how long.',
  'The long way goes round the back of the market. I did not like it. It smelled of fish in the morning, and I had to leave home earlier.',
  'On the second day I noticed a man setting out plastic stools outside a coffee shop. He counted them twice.',
  'On the fourth day I noticed that he always put the wobbly one at his own table.',
  'On the ninth day it rained, and he waved me under his awning until it stopped. We did not talk. He gave me a paper cup of hot water.',
  'The fence came down in July. The car park was smooth and grey and four minutes shorter.',
  'I have not used it since. I am not sure I could explain why to my mother, who thinks I am wasting my time.',
  'I think it is this: the short way had nothing in it. I walked through it for three years and I could not tell you one thing about it.',
);

/**
 * 五天。`source` 是库文件名或原创的 key。
 *
 * `mcq` / `saq1` 只有原创天需要写 —— 改编天直接从库文件的 exercise 2 /
 * exercise 1 取，题目和答案都是原作者对着原文写的，比我重述可靠。
 */
const DAYS_SPEC = [
  {
    source: 'basic-06-the-umbrella.json',
    // 库里的题只给答案不给证据句；证据是学生对完答案要看的那一句，
    // 逐条对着原文写，key 就是库里的题号。
    saqEvidence: {
      1: 'Then he walked to a corner, picked up a blue umbrella, and held it out to me.',
      2: 'A woman cleaning the toilets told me he only worked until the end of the month.',
    },
    mcqEvidence: {
      3: 'I never brought an umbrella, because the sky was always blue at seven in the morning.',
      4: "'Take it,' he said. 'Someone left it here in May. Nobody came back for it.'",
      5: 'I still have the blue umbrella. It is in my bag every day now, even when the sky is clear.',
    },
    tfng: [
      {
        item: 'Most of the students waiting under the walkway had left within ten minutes.',
        answer: 'TRUE',
        evidence: 'After ten minutes most of them had gone.',
      },
      {
        item: 'The old man found another job after he stopped working at the school.',
        answer: 'NOT GIVEN',
        evidence: '',
      },
    ],
    gapFill: {
      stem: 'The old man said that somebody had left the umbrella at the school back in ______.',
      answer: 'May',
      distractors: ['June', 'March', 'July'],
      evidence: "'Take it,' he said. 'Someone left it here in May. Nobody came back for it.'",
    },
    extraShortAnswers: [
      {
        stem: 'Using your own words, explain why the writer never brought an umbrella to school that week.',
        answer: 'The sky was always clear and blue when she left home at seven, so she did not expect the afternoon rain.',
        evidence:
          'It rained every afternoon that week. I never brought an umbrella, because the sky was always blue at seven in the morning.',
        rubric: '两分：写出「早上出门时天是晴的」给 1 分，补充「所以没料到下午会下雨」再给 1 分。只写「她忘了带」给 0 分。',
      },
      {
        stem: 'What does the last paragraph show about how the writer feels towards the old man?',
        answer: 'She keeps the umbrella with her every day even when it will not rain, which shows she values his kindness and wants the reminder.',
        evidence: 'I still have the blue umbrella. It is in my bag every day now, even when the sky is clear.',
        rubric: '两分：指出「晴天也带着」这个行为给 1 分，说明这代表她珍视那份好意 / 留作纪念再给 1 分。',
      },
    ],
  },
  {
    source: 'basic-08-the-empty-seat.json',
    saqEvidence: {
      1: 'In March his family moved to Johor.',
      2: 'He knows a lot about birds, which I did not care about in May and do care about now.',
    },
    mcqEvidence: {
      3: 'He always had two pens and would lend me one without being asked.',
      4: 'Then one morning I forgot my pen. Ryan opened his pencil case and gave me one before I asked.',
      5: 'He knows a lot about birds, which I did not care about in May and do care about now.',
    },
    tfng: [
      {
        item: 'The teacher left the seat beside the writer empty for the rest of the term.',
        answer: 'TRUE',
        evidence: 'The teacher did not move anyone. The seat beside me stayed empty for the rest of the term.',
      },
      {
        item: 'Faizal wrote to the writer after his family moved away.',
        answer: 'NOT GIVEN',
        evidence: '',
      },
    ],
    gapFill: {
      stem: 'In May a new boy named ______ was given the empty seat.',
      answer: 'Ryan',
      distractors: ['Faizal', 'Johor', 'March'],
      evidence: 'In May a new boy came. His name was Ryan.',
    },
    extraShortAnswers: [
      {
        stem: 'Using your own words, describe TWO things the writer missed about Faizal.',
        answer: 'Faizal always carried two pens and lent him one without being asked, and he laughed at weak jokes in a way that set other people laughing.',
        evidence:
          'He always had two pens and would lend me one without being asked. He laughed at jokes that were not funny, which made other people laugh.',
        rubric: '两分：借笔、笑话两点各 1 分。写「他们是好朋友」不给分 —— 原文说他们并不熟。',
      },
      {
        stem: 'Explain how the writer’s new interest in birds shows that he has changed.',
        answer: 'In May he did not care about birds at all and now he does, so getting to know Ryan has changed what he pays attention to.',
        evidence: 'He knows a lot about birds, which I did not care about in May and do care about now.',
        rubric: '两分：写出「以前不在乎、现在在乎」的对比给 1 分，点明这是因为认识了 Ryan 再给 1 分。',
      },
    ],
  },
  {
    source: 'basic-09-the-durian.json',
    saqEvidence: {
      1: 'This year the durian cost sixty dollars.',
      2: 'She says it smells like gas.',
    },
    mcqEvidence: {
      3: 'He takes one small piece and then watches the rest of us.',
      4: 'He promised himself that when he had money he would buy one every year.',
      5: 'Next June I will pay for it. I have already told Uncle Teo.',
    },
    tfng: [
      {
        item: 'The writer’s father has bought a durian every June for more than thirty years.',
        answer: 'TRUE',
        evidence: 'He has kept that promise for thirty-one years.',
      },
      {
        item: 'Uncle Teo charges the writer’s father less than he charges other customers.',
        answer: 'NOT GIVEN',
        evidence: '',
      },
    ],
    gapFill: {
      stem: 'The family ate the durian at the table with ______ spread out.',
      answer: 'newspaper',
      distractors: ['plates', 'cloth', 'plastic'],
      evidence: 'We ate it at the table with newspaper spread out.',
    },
    extraShortAnswers: [
      {
        stem: 'Using your own words, explain why the father made his promise about durian.',
        answer: 'When he was nine his family could not afford durian, so he had to stand outside the shop and only smell it, and he decided that once he had money he would buy one every year.',
        evidence:
          'He said that when he was nine, his family could not afford durian. He would stand outside the shop and smell it. He promised himself that when he had money he would buy one every year.',
        rubric: '两分：小时候买不起、只能站在店外闻，给 1 分；长大后要每年买一个的决心，再给 1 分。',
      },
      {
        stem: 'Explain what the writer means by ‘I think he is right, and I think I will win’.',
        answer: 'He expects his father to argue about who should pay, but he intends to insist and take the yearly custom over himself.',
        evidence: 'He laughed and said my father would argue about it. I think he is right, and I think I will win.',
        rubric: '两分：预料父亲会争着付钱，给 1 分；他打算坚持、把这个习惯接过来，再给 1 分。',
      },
    ],
  },
  {
    source: 'original-library-clock',
    title: 'The Library Clock',
    passage: CLOCK_PASSAGE,
    mcq: [
      {
        stem: 'Why is the library clock five minutes fast?',
        answer: 'Mrs Rahim set it that way on purpose.',
        distractors: ['It has never been repaired.', 'Its batteries are old and weak.', 'Students changed it as a joke.'],
        evidence: "'I set it five minutes fast,' she said. 'Fourteen years ago.'",
        explanation: '第六段她自己说的：是她十四年前故意调快的。',
      },
      {
        stem: 'What does Mrs Rahim gain from the clock being fast?',
        answer: 'Students are out of the library closer to closing time.',
        distractors: ['She can lock up the library an hour earlier.', 'Students arrive five minutes before she opens.', 'The clock needs repairing less often.'],
        evidence:
          'She told me that the library closes at six, and that students who start packing up at six are still in the building at ten past. Five minutes on the clock buys her ten minutes at the door.',
        explanation: '学生按快了的钟开始收拾，实际提前了五分钟，所以走出大门的时间也提前了。',
      },
      {
        stem: 'Why does Mrs Rahim not simply explain the trick to everyone?',
        answer: 'A clock that nobody trusts would be no use either.',
        distractors: ['She has forgotten why she first did it.', 'The principal told her to keep it a secret.', 'She thinks the students would not understand.'],
        evidence: 'She said that a clock nobody trusts is not much use either.',
        explanation: '第八段直接给了理由：说破了，钟就没人信，那还不如没有。',
      },
    ],
    tfng: [
      {
        item: 'The writer checked the clock against a phone more than once.',
        answer: 'TRUE',
        evidence: 'I checked it against my phone three times that week to be sure.',
      },
      {
        item: 'Mrs Rahim has worked in the school library for longer than fourteen years.',
        answer: 'NOT GIVEN',
        evidence: '',
      },
    ],
    gapFill: {
      stem: 'Mrs Rahim set the clock five minutes fast ______ years ago.',
      answer: 'fourteen',
      distractors: ['five', 'ten', 'two'],
      evidence: "'I set it five minutes fast,' she said. 'Fourteen years ago.'",
    },
    shortAnswers: [
      {
        stem: 'From Paragraph 4, what did the writer offer to do about the clock?',
        marks: 1,
        answer: 'Bring a screwdriver so that it could be fixed.',
        evidence: 'I said I could bring a screwdriver.',
        rubric: '一分：答出「带螺丝刀（来修钟）」即给分。',
      },
      {
        stem: 'From Paragraph 7, at what time does the library close?',
        marks: 1,
        answer: 'At six o’clock.',
        evidence:
          'She told me that the library closes at six, and that students who start packing up at six are still in the building at ten past. Five minutes on the clock buys her ten minutes at the door.',
        rubric: '一分：答「六点」即给分。',
      },
      {
        stem: 'Using your own words, explain how a clock that is five minutes fast gets students out of the library sooner.',
        marks: 2,
        answer: 'Students start packing up when the clock shows six, which is really five to six, so they are through the door about five minutes earlier than they otherwise would be.',
        evidence:
          'She told me that the library closes at six, and that students who start packing up at six are still in the building at ten past. Five minutes on the clock buys her ten minutes at the door.',
        rubric: '两分：说明「学生看到六点就开始收」给 1 分，指出实际时间还早五分钟、于是提前出门再给 1 分。',
      },
      {
        stem: 'Why does the writer say nothing when a younger student complains about the clock?',
        marks: 2,
        answer: 'He now knows the reason and thinks the arrangement is worth keeping, so he leaves it alone as Mrs Rahim did.',
        evidence:
          'I still check my phone. But I have stopped feeling annoyed, and last week I heard a Secondary One boy complain about the clock, and I did not tell him anything.',
        rubric: '两分：写出「他已经知道原因」给 1 分，点明他认同这个安排、选择不说破再给 1 分。',
      },
    ],
  },
  {
    source: 'original-long-way',
    title: 'The Long Way Round',
    passage: LONGWAY_PASSAGE,
    mcq: [
      {
        stem: 'Why does the writer no longer use the car park?',
        answer: 'The long way turned out to have more in it.',
        distractors: ['The fence was never taken down.', 'The car park is still being repaired.', 'His mother told him not to go that way.'],
        evidence: 'I think it is this: the short way had nothing in it.',
        explanation: '最后两段说明：绕路让他看到了东西，而近路三年下来什么也没留下。',
      },
      {
        stem: 'What did the writer notice about the man and the wobbly stool?',
        answer: 'He always kept it for his own table.',
        distractors: ['He threw it away each evening.', 'He gave it to his customers.', 'He repaired it every morning.'],
        evidence: 'On the fourth day I noticed that he always put the wobbly one at his own table.',
        explanation: '第五段：晃的那张他留给自己坐。',
      },
      {
        stem: 'What does the writer mean by ‘the short way had nothing in it’?',
        answer: 'There was nothing there worth noticing or remembering.',
        distractors: ['It was too narrow to walk along.', 'There were never any cars parked in it.', 'It was closed for most of the year.'],
        evidence: 'I walked through it for three years and I could not tell you one thing about it.',
        explanation: '下一句就是解释：走了三年，一件事都说不出来。',
      },
    ],
    tfng: [
      {
        item: 'The writer had to leave home earlier once the car park was fenced off.',
        answer: 'TRUE',
        evidence: 'It smelled of fish in the morning, and I had to leave home earlier.',
      },
      {
        item: 'The man at the coffee shop knew the writer’s mother.',
        answer: 'NOT GIVEN',
        evidence: '',
      },
    ],
    gapFill: {
      stem: 'When it rained, the man waved the writer in under his ______.',
      answer: 'awning',
      distractors: ['umbrella', 'table', 'stool'],
      evidence: 'On the ninth day it rained, and he waved me under his awning until it stopped.',
    },
    shortAnswers: [
      {
        stem: 'From Paragraph 1, how much time did walking through the car park save?',
        marks: 1,
        answer: 'Four minutes.',
        evidence: 'There is a car park between my block and the school. For three years I walked through it every morning. It saved four minutes.',
        rubric: '一分：答「四分钟」即给分。',
      },
      {
        stem: 'From Paragraph 2, what reason did the sign give for the fence?',
        marks: 1,
        answer: 'That the ground was being repaired.',
        evidence: 'A sign said the ground was being repaired.',
        rubric: '一分：答「地面在施工 / 修整」即给分。',
      },
      {
        stem: 'Using your own words, explain why the writer disliked the long way at first.',
        marks: 2,
        answer: 'It went past the back of the market and smelled of fish in the mornings, and it forced him to leave home earlier.',
        evidence: 'The long way goes round the back of the market. I did not like it. It smelled of fish in the morning, and I had to leave home earlier.',
        rubric: '两分：鱼腥味、必须早起两点各 1 分。',
      },
      {
        stem: 'Explain what the writer has come to value about the long way.',
        marks: 2,
        answer: 'It gave him things to notice and a small kindness from the coffee-shop man, whereas the shortcut left him nothing he can even remember.',
        evidence: 'I have not used it since. I am not sure I could explain why to my mother, who thinks I am wasting my time.',
        rubric: '两分：写出「绕路上有可看、可记的东西 / 有人的善意」给 1 分，与近路的空白做对比再给 1 分。',
      },
    ],
  },
];

function loadFixture(file) {
  return JSON.parse(fs.readFileSync(path.join(DIR, file), 'utf8'));
}

function buildDay(spec, date) {
  const original = spec.source.startsWith('original-');
  const raw = original ? null : loadFixture(spec.source);
  const passage = original ? spec.passage : cleanPassage(raw.sections[0].passage);
  const title = original ? spec.title : raw.sections[0].passageTitle;

  // ── 3 道四选一 ────────────────────────────────────────────
  const mcq = original
    ? spec.mcq.map((q) => {
        const choice = mcqOptions(q.answer, q.distractors);
        return {
          taskType: 'multiple_choice',
          questionType: 'mcq',
          marks: 1,
          options: choice.options,
          answer: choice.answer,
          stem: `Choose the correct letter.\n\n${q.stem}`,
          evidence: q.evidence,
          explanation: q.explanation,
        };
      })
    : raw.sections[1].questions.map((q) => ({
        taskType: 'multiple_choice',
        questionType: 'mcq',
        marks: q.marks ?? 1,
        options: q.options.map((o) => ({ key: o.key, text: o.text })),
        answer: q.answer,
        stem: `Choose the correct letter.\n\n${tidyStem(q.stem)}`,
        evidence: spec.mcqEvidence?.[q.n] ?? '',
        explanation: `原文支持选项 ${q.answer}：“${q.options.find((o) => o.key === q.answer).text}”。`,
      }));

  // ── 2 道判断题（一律人工出） ───────────────────────────────
  const tfng = spec.tfng.map((q) => ({
    taskType: 'true_false_not_given',
    questionType: 'mcq',
    marks: 1,
    options: TFNG,
    answer: TFNG_KEY[q.answer],
    stem: `${TFNG_INSTRUCTION}\n\n${q.item}`,
    evidence: q.evidence,
    explanation:
      q.answer === 'NOT GIVEN'
        ? '原文从头到尾没有提过这件事，既不能证实也不能否定，所以选 NOT GIVEN。'
        : `原文的对应句与题干${q.answer === 'TRUE' ? '一致' : '相反'}，所以选 ${q.answer}。`,
  }));

  // ── 1 道原文填空 ──────────────────────────────────────────
  const gap = mcqOptions(spec.gapFill.answer, spec.gapFill.distractors);
  const gapFill = {
    taskType: 'sentence_completion',
    questionType: 'mcq',
    marks: 1,
    options: gap.options,
    answer: gap.answer,
    stem: `Complete the sentence with ONE WORD ONLY from the passage.\n\n${spec.gapFill.stem}`,
    evidence: spec.gapFill.evidence,
    explanation: `原文在这个位置用的词是 “${spec.gapFill.answer}”。`,
  };

  // ── 4 道主观题 ────────────────────────────────────────────
  const fromFixture = original
    ? []
    : raw.sections[0].questions.map((q) => ({
        taskType: 'short_answer',
        questionType: 'short_answer',
        marks: q.marks ?? 1,
        options: null,
        answer: String(q.answer),
        accept: null,
        stem: tidyStem(q.stem),
        evidence: spec.saqEvidence?.[q.n] ?? '',
        rubric: `一分：答出「${q.answer}」即给分；措辞不同但意思对不扣分。`,
        explanation: `答案直接来自原文。`,
      }));
  const authored = (original ? spec.shortAnswers : spec.extraShortAnswers).map((q) => ({
    taskType: 'short_answer',
    questionType: 'short_answer',
    marks: q.marks ?? 2,
    options: null,
    answer: q.answer,
    accept: null,
    stem: q.stem,
    evidence: q.evidence,
    rubric: q.rubric,
    explanation: `答案依据原文这一句：${q.evidence}`,
  }));

  return {
    date,
    title,
    passage,
    questions: [...mcq, ...tfng, gapFill, ...fromFixture, ...authored],
    words: [],
    source: spec.source,
  };
}

module.exports = {
  LEVEL,
  DAYS_SPEC,
  DAYS: DAYS_SPEC.map((spec, i) => buildDay(spec, DATES[i])),
};
