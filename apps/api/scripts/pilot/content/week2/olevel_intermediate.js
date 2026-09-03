/**
 * 首发周 —— **olevel_intermediate（O-Level 进阶）**档。
 *
 * 周一到周四改编自库里四篇**从未发到学生手上**的 O-Level 1184 §B 记叙文；
 * 周五是原创（`The Wrong Name`），因为库里合规的篇目正好只剩四篇。
 *
 * 每天的十题怎么来见 `from-1128.js`。本文件只负责三件人工的事：
 *
 *   1. 哪一道 exercise 1 的词义题转成四选一，干扰项写什么；
 *   2. 那一道原文填空考哪个词（库里没有填空类，题型凑不满四种）；
 *   3. 每道题的证据落在第几段 —— 段号显式给出，不从题干里猜。
 *
 * 库里的判分要点直接当 rubric，一个字不改：那是原作者对着原文写的，
 * 比我重述一遍可靠。
 */

'use strict';

const { DATES } = require('./adapters');
const { buildDay } = require('./from-1128');

const LEVEL = 'olevel_intermediate';

const P = (...paras) => paras.map((p, i) => `Paragraph ${i + 1}\n${p}`).join('\n\n');

// ═══════════════════════════════════════════════════════════════
// 原创：周五 —— The Wrong Name
// ═══════════════════════════════════════════════════════════════

const WRONG_NAME_OPTIONS = [
  { key: 'A', text: 'indifferent' },
  { key: 'B', text: 'hesitant' },
  { key: 'C', text: 'resigned' },
  { key: 'D', text: 'envious' },
  { key: 'E', text: 'struck' },
  { key: 'F', text: 'amused' },
  { key: 'G', text: 'relieved' },
  { key: 'H', text: 'impatient' },
];

/** 每道配对题的选项独立打乱 —— 与库文件的做法一致，别让学生按位置背答案。 */
function shuffledOptions(order, correctText) {
  return order.map((text, i) => ({
    key: String.fromCharCode(65 + i),
    text,
    correct: text === correctText,
  }));
}

const WRONG_NAME = {
  key: 'original-wrong-name',
  sections: [
    {
      exercise: 1,
      passageTitle: 'The Wrong Name',
      instruction:
        'Read the narrative text below and answer the questions that follow. Section B, Part 1 [11 marks]. Answer in your own words as far as possible.',
      passage: P(
        'My name is Nurhaliza, and for the whole of Secondary Two nobody at school said it properly. Our relief form teacher, Miss Chandra, read it off the register on the first morning as “Nur-ha-LEE-za”, with the stress in the wrong place, and thirty-one other people learnt it from her. By the second week even my own friends were saying it that way.',
        'I did not correct her. I am not sure I could explain why. She was new, and flustered, and she had forty-five minutes in which to finish the register, read out a fire drill notice and collect two forms. Putting up my hand to say “Actually, miss” felt enormous, as though I would be making a scene about four syllables.',
        'So I answered to the wrong name for eight months. I answered to it in the corridor, on the class list outside the staff room, and once on a certificate for the inter-class quiz, where it was printed in gold. My mother held that certificate for a long time, turning it towards the light, and then put it in the drawer without saying anything, which was worse than if she had.',
        'The trouble with a small wrong is that it does not stay small. Every month I let it pass, correcting it became a larger act, because by then I would also have to explain why I had said nothing for so long. Somewhere around March the wrong name had grown roots.',
        'What ended it was completely ordinary. A new girl joined our class in April, and on her first morning Miss Chandra read her name off the register as “Ah-NAN-ya”. The girl put her hand up straight away and said, quite pleasantly, “It is Ananya, miss.” Miss Chandra said, “Ananya. Sorry,” corrected it in her book, and carried on down the list.',
        'The whole thing had taken four seconds. Nobody turned round. Nobody laughed. I sat there with my pen in my hand and understood that the enormous act I had been avoiding since September was, for everyone else in that room, four seconds long.',
        'I waited until the end of the lesson and told Miss Chandra how my name is said. She repeated it twice, got it right the second time, and thanked me. Then she asked, kindly enough, why I had not told her in September. I said I had not wanted to make a fuss. She looked at me for a moment and said that a name is not a fuss. I have thought about that sentence a great deal more often than I expected to.',
      ),
      questions: [
        {
          n: 1,
          stem: 'Q1. From Paragraph 1, how did the rest of the class come to say the narrator’s name wrongly? [1]',
          answer:
            'the relief teacher read it off the register wrongly on the first morning, and the other thirty-one pupils learnt the wrong pronunciation from her. One mark.',
          marks: 1,
        },
        {
          n: 2,
          stem: 'Q2. What does the word ‘flustered’ (Paragraph 2) suggest about Miss Chandra on that first morning? [1]',
          answer:
            'that she was confused and under pressure, with too much to get through in the time available. REJECT a bare ‘she was new’ — that is stated separately and does not gloss the word.',
          marks: 1,
        },
        {
          n: 3,
          stem: 'Q3. From Paragraph 3, where was the wrong name printed in gold? [1]',
          answer: 'on a certificate for the inter-class quiz. One mark.',
          marks: 1,
        },
        {
          n: 4,
          stem: 'Q4. Using your own words, explain why correcting the mistake became harder as the months passed. (Paragraph 4) [2]',
          answer:
            'MP1 (an extra thing to explain): by then she would have had to account for her own long silence as well as the mistake itself; MP2 (the error had spread and settled): the wrong name was now on lists, certificates and in her friends’ mouths, so undoing it meant undoing all of that. Award one mark per distinct point.',
          marks: 2,
        },
        {
          n: 5,
          stem: 'Q5. Using your own words, explain what the narrator understood while watching Ananya. (Paragraphs 5–6) [2]',
          answer:
            'MP1 (the act is tiny): putting someone right about a name took only a few seconds and was dealt with immediately; MP2 (the audience does not care): nobody turned round or laughed, so the enormous scene she had feared existed only in her own head. Award one mark per distinct point.',
          marks: 2,
        },
        {
          n: 6,
          stem: 'Q6. What is the effect of saying that the wrong name ‘had grown roots’ (Paragraph 4)? [2]',
          answer:
            'MP1 (image of a plant taking hold): roots suggest something that has fixed itself in place and spread underground, so the mistake is no longer on the surface and easily brushed off; MP2 (implies effort to remove): pulling up something rooted is difficult and disruptive, which matches how large correcting it now felt. Award one mark per distinct point.',
          marks: 2,
        },
        {
          n: 7,
          stem: 'Q7. Using your own words, explain what Miss Chandra means by ‘a name is not a fuss’. (Paragraph 7) [2]',
          answer:
            'MP1 (not trouble-making): asking to be called by your own name is not being difficult or demanding attention; MP2 (it is owed to you): a name belongs to the person, so getting it right is a reasonable and important thing rather than a favour. Award one mark per distinct point.',
          marks: 2,
        },
      ],
    },
    {
      exercise: 2,
      instruction:
        'Q8. The narrator’s dominant feeling shifts across the year. For each part of the text below, choose the option that best describes it. Each option may be used once only.',
      questions: [
        {
          n: 8,
          stem: 'Q8(i). Paragraph 2 — deciding on the first morning whether to put up her hand. [1]',
          options: shuffledOptions(
            ['impatient', 'hesitant', 'amused', 'envious', 'relieved', 'indifferent', 'struck', 'resigned'],
            'hesitant',
          ),
          answer: 'B',
          marks: 1,
        },
        {
          n: 9,
          stem: 'Q9. Paragraphs 3–4 — through the months of answering to the wrong name. [1]',
          options: shuffledOptions(
            ['struck', 'relieved', 'resigned', 'amused', 'hesitant', 'envious', 'impatient', 'indifferent'],
            'resigned',
          ),
          answer: 'C',
          marks: 1,
        },
        {
          n: 10,
          stem: 'Q10. Paragraphs 5–6 — watching Ananya put the teacher right. [1]',
          options: shuffledOptions(
            ['envious', 'indifferent', 'impatient', 'struck', 'resigned', 'relieved', 'hesitant', 'amused'],
            'struck',
          ),
          answer: 'D',
          marks: 1,
        },
        {
          n: 11,
          stem: 'Q11. Paragraph 7 — after speaking to Miss Chandra at the end of the lesson. [1]',
          options: shuffledOptions(
            ['amused', 'hesitant', 'indifferent', 'envious', 'impatient', 'relieved', 'struck', 'resigned'],
            'relieved',
          ),
          answer: 'F',
          marks: 1,
        },
      ],
    },
  ],
};

// 上面 shuffledOptions 的顺序是手排的，答案键必须与之对上；这里当场自检，
// 排错了立刻炸，而不是等到学生答了一整天才发现一道题永远判错。
for (const q of WRONG_NAME.sections[1].questions) {
  const flagged = q.options.filter((o) => o.correct);
  if (flagged.length !== 1 || flagged[0].key !== q.answer) {
    throw new Error(`original-wrong-name：第 ${q.n} 题答案键 ${q.answer} 与 correct 标记不一致`);
  }
}

// ═══════════════════════════════════════════════════════════════
// 五天
// ═══════════════════════════════════════════════════════════════

const SPECS = [
  {
    source: 'ai-authored-05-lost-wallet-simplified.json',
    dir: 'singapore-olevel-1128',
    matchingParas: [4, 5, 6, 8],
    multipleChoice: {
      index: 3, // Q4 —— 'given up the wallet for lost' 的意思
      para: 4,
      answer: 'He had stopped hoping that it would ever be returned.',
      distractors: [
        'He had reported the missing wallet to the police.',
        'He had thrown the wallet away himself.',
        'He had forgotten how much money was inside it.',
      ],
      explanation: '“give something up for lost” 是「认定它找不回来了、不再抱希望」，不是真的丢弃或报案。',
    },
    gapFill: {
      stem: 'Besides the cash and the vouchers, the wallet held an identity ______ with an old man’s photograph.',
      answer: 'card',
      distractors: ['note', 'photograph', 'notebook'],
      evidence:
        'Inside were three things: eighty dollars in cash, a few NTUC vouchers, and an identity card with the photograph of a thin old uncle.',
    },
    shortAnswers: [
      { index: 2, marks: 2, para: 4, answer: 'He could finally buy the football boots he had wanted for six months, and he believed nobody had seen him pick the wallet up.' },
      { index: 4, marks: 2, para: 5, answer: 'He remembered how badly his own grandfather had taken losing a wallet, and realised the old man would feel the same, so he handed it in.' },
      { index: 5, marks: 2, para: 6, answer: 'It shows the auntie treated handing in the wallet as routine paperwork, so Wei got no praise or reward for doing the right thing.' },
      { index: 6, marks: 2, para: 8, answer: 'He still wants the boots, but they matter less to him now that he knows the money was somebody’s medicine — helping a person in real need has come to weigh more.' },
    ],
  },
  {
    source: 'simplified-new-glasses.json',
    dir: 'ielts-authored-2026-v2',
    matchingParas: [2, 4, 5, 6],
    multipleChoice: {
      index: 1, // Q2 —— 'the words swam'
      para: 1,
      answer: 'The writing looked blurred and seemed to shift about.',
      distractors: [
        'The whiteboard was wet and the ink was running.',
        'The teacher wrote far too quickly to follow.',
        'The words were in a language she did not know.',
      ],
      explanation: '“swam” 写的是视线里字迹模糊、晃动，不是白板真的湿了或老师写得快。',
    },
    gapFill: {
      stem: 'On the first morning the narrator kept the glasses zipped inside her ______ case until the bell had gone.',
      answer: 'pencil',
      distractors: ['glasses', 'school', 'lunch'],
      evidence:
        'On the first morning I kept them zipped inside my pencil case until the bell had gone and everyone was seated.',
    },
    shortAnswers: [
      { index: 3, marks: 2, para: 2, answer: 'The only boy in her class who wore glasses had been given an unkind nickname, and she dreaded walking in and having the whole class turn to look at her.' },
      { index: 4, marks: 2, para: 3, answer: 'They felt strange and heavy sitting on her nose, and for a second the whole room seemed to tip before it settled.' },
      { index: 5, marks: 2, para: 6, answer: 'Being able to read the board and see the leaves on the rain tree mattered far more to her than the teasing, and she no longer needed to check her answers with the girl beside her.' },
      { index: 6, marks: 2, para: 5, answer: 'The contrast between a vague green mass and a thousand sharply edged leaves shows how much detail her poor eyesight had been hiding, making seeing clearly feel like a discovery.' },
    ],
  },
  {
    source: 'simplified-paper-lantern.json',
    dir: 'ielts-authored-2026-v2',
    matchingParas: [1, 4, 5, 6],
    multipleChoice: {
      index: 1, // Q2 —— 'paraded'
      para: 2,
      answer: 'They walked in a procession, showing their lanterns off.',
      distractors: [
        'They marched quickly to keep themselves warm.',
        'They walked in silence so as not to wake the neighbours.',
        'They ran between the blocks in no particular order.',
      ],
      explanation: '“paraded” 的重点是「列队、展示给人看」，而不是走得快或走得安静。',
    },
    gapFill: {
      stem: 'When the narrator was left with only a bare frame, Mei held out her white ______ lantern.',
      answer: 'rabbit',
      distractors: ['carp', 'paper', 'plastic'],
      evidence:
        "She simply held out her white rabbit lantern by the stick and said, 'You hold it first. I'll take it back at the playground.'",
    },
    shortAnswers: [
      { index: 3, marks: 2, para: 4, answer: 'The lantern she had waited for all week was destroyed and only a burnt frame was left, and the other children walked on without stopping, leaving her alone at the edge of the path.' },
      { index: 4, marks: 2, para: 5, answer: 'The burnt frame and her face already told Mei what had happened, and mentioning it would only have drawn attention to the accident and made her feel worse.' },
      { index: 5, marks: 2, para: 7, answer: 'The lanterns themselves have been forgotten — she cannot even say what became of the frame — but Mei turning back and sharing hers has stayed with her for eight years.' },
      { index: 6, marks: 2, para: 4, answer: 'The bright red carp that had “glowed like something alive” is reduced to a small, dull, colourless scrap, showing that the loss is total and nothing is left to save.' },
    ],
  },
  {
    source: 'simplified-swimming-lesson.json',
    dir: 'ielts-authored-2026-v2',
    matchingParas: [2, 3, 4, 7],
    multipleChoice: {
      index: 1, // Q2 —— 'clung'
      para: 2,
      answer: 'He held on very tightly, out of fear.',
      distractors: [
        'He touched the side lightly with one hand.',
        'He pushed himself away from the side.',
        'He leaned on the side to get his breath back.',
      ],
      explanation: '“clung” 是死死抓住不放，原文还写了「指节发白」，可见是害怕。',
    },
    gapFill: {
      stem: 'After Mr Tan quietly took his hand away, the narrator ______ all by himself for three whole seconds.',
      answer: 'floated',
      distractors: ['swam', 'sank', 'waited'],
      evidence: 'For three whole seconds I floated all by myself.',
    },
    shortAnswers: [
      { index: 3, marks: 2, para: 3, answer: 'Water rushed into his nose so that he could not breathe and panicked, and he was sure he was about to sink, so he reached desperately for something solid.' },
      { index: 4, marks: 2, para: 4, answer: 'The hand physically stopped him from sinking, and the words reassured him, so that he relaxed enough to lie back and try.' },
      { index: 5, marks: 2, para: 5, answer: 'He realised he could stay up without anyone holding him, and that the water itself would support him — his fear had never been necessary.' },
      { index: 6, marks: 2, para: 6, answer: 'It shows how completely his feelings reversed: what had been a threat waiting to swallow him now feels like something safe that had been waiting to hold him up.' },
    ],
  },
  {
    key: 'original-wrong-name',
    inline: WRONG_NAME,
    matchingParas: [2, 4, 6, 7],
    multipleChoice: {
      index: 1, // Q2 —— 'flustered'
      para: 2,
      answer: 'She was confused and under pressure.',
      distractors: [
        'She was strict and easily annoyed.',
        'She was bored by reading out the register.',
        'She was embarrassed about being new to the school.',
      ],
      explanation: '“flustered” 说的是手忙脚乱、压力之下的慌乱，原文用「四十五分钟里要做完三件事」来支撑。',
    },
    gapFill: {
      stem: 'The narrator answered to the wrong name for eight ______ before she said anything.',
      answer: 'months',
      distractors: ['weeks', 'years', 'days'],
      evidence: 'So I answered to the wrong name for eight months.',
    },
    shortAnswers: [
      { index: 3, marks: 2, para: 4, answer: 'She would have had to explain her own long silence as well as the mistake, and by then the wrong name was on lists and certificates and in her friends’ mouths.' },
      { index: 4, marks: 2, para: 6, answer: 'Putting someone right about a name takes only a few seconds, and nobody in the room treats it as a scene — the size of the act existed only in her own head.' },
      { index: 5, marks: 2, para: 4, answer: 'Roots suggest something that has fixed itself in place and spread out of sight, so the mistake is no longer easy to brush off and removing it would be difficult.' },
      { index: 6, marks: 2, para: 7, answer: 'Asking to be called by your own name is not being difficult or demanding attention; a name belongs to the person, so getting it right is reasonable rather than a favour.' },
    ],
  },
];

module.exports = {
  LEVEL,
  SPECS,
  DAYS: SPECS.map((spec, i) => buildDay(spec, DATES[i])),
};
