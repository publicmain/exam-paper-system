/**
 * 首发周 —— **olevel（O-Level 标准）**档。
 *
 * 周一到周四改编自库里四篇从未发到学生手上的 O-Level 1184 §B 完整卷；
 * 周五是原创（`Taking the Other Side`）。
 *
 * 与进阶档同用 `from-1128.js`，差别只在文章更长、主观题问得更深。四道
 * 情绪配对题的选项库由适配器统一并确定性打乱 —— 这四份库文件里有三份的
 * 答案原样就是 A、B、C、D，不打乱等于送分。
 */

'use strict';

const { DATES } = require('./adapters');
const { buildDay } = require('./from-1128');

const LEVEL = 'olevel';

const P = (...paras) => paras.map((p, i) => `Paragraph ${i + 1}\n${p}`).join('\n\n');

// ═══════════════════════════════════════════════════════════════
// 原创：周五 —— Taking the Other Side
// ═══════════════════════════════════════════════════════════════

const BANK = ['dutiful', 'absorbed', 'exposed', 'unsettled', 'triumphant', 'indifferent', 'defiant', 'nostalgic'];

/** 选项按 A–H 原序给出，答案键由 `correct` 决定；适配器会再确定性打乱一次。 */
function bankOptions(correctText) {
  return BANK.map((text, i) => ({ key: String.fromCharCode(65 + i), text, correct: text === correctText }));
}

function bankKey(correctText) {
  return String.fromCharCode(65 + BANK.indexOf(correctText));
}

const DEBATE = {
  key: 'original-other-side',
  sections: [
    {
      exercise: 1,
      passageTitle: 'Taking the Other Side',
      instruction:
        'Read the narrative text below and answer the questions that follow. Section B, Part 1 [14 marks]. Answer in your own words as far as possible.',
      passage: P(
        'I was given the motion three days before the final: “This House would ban private tuition.” I was told I would be arguing for it. I have had private tuition since Primary Four, and my parents have gone without a good many things in order to pay for it.',
        'Mrs Iyer, who ran the debating society, said this was perfectly normal. A debater argues the side she is given; the skill lies in the argument, not in the belief. She said it in the tone of someone stating a rule of arithmetic.',
        'So I built the case. I found the studies. I learnt that in one survey four in five secondary students had received paid tuition, and that families in the bottom fifth of household income spent a larger share of what they had on it than families in the top fifth. I learnt to say “an arms race that nobody can leave” without stumbling, and to pause for half a second before the phrase, so that it landed.',
        'The final was in the school hall on a Saturday morning. The opposing team knew the details better than we did and the shape of things rather worse, and about eight minutes in I could feel the room begin to tilt towards us. When I sat down after my reply speech there was that particular quality of silence which means you have done well.',
        'We won. The adjudicator singled out my third argument: that tuition quietly converts a parent’s income into a child’s grade, and that a system which permits this cannot honestly go on calling itself a ladder.',
        'My mother was in the third row. She had taken the morning off work. She clapped with everybody else, and afterwards she said I had spoken very clearly, and we went for lunch, and neither of us said anything at all about the third argument.',
        'It was not that she was hurt. I do not think she was. It was that I had stood in a hall and made, with some skill, an argument that ended at her — and that I had enjoyed making it. That was the part I had not planned for. Somewhere around the fourth minute I had stopped performing the belief and started holding it.',
        'I have thought since about what Mrs Iyer said. She is right that a debater argues the side she is given. What she left out is that you cannot spend three days assembling the strongest possible case against something and then walk away exactly where you were. The argument does not stay on the paper. Some of it comes home with you.',
        'I still go to tuition on Tuesdays. I am better at Chemistry because of it, and I know that is not nothing. But I no longer describe it, as I used to, as something my family simply does. I describe it as something my family can afford, which is a different sentence, and a truer one.',
      ),
      questions: [
        {
          n: 1,
          stem: 'Q1. From Paragraph 1, what was the motion, and which side was the narrator told to argue? [1]',
          answer:
            'the motion was “This House would ban private tuition”, and she was told to argue in favour of the ban. Both halves needed for the mark.',
          marks: 1,
        },
        {
          n: 2,
          stem: 'Q2. What does Mrs Iyer mean by saying that the skill lies ‘in the argument, not in the belief’? (Paragraph 2) [1]',
          answer:
            'a debater is judged on how well she builds and delivers the case she is handed, not on whether she personally agrees with it.',
          marks: 1,
        },
        {
          n: 3,
          stem: 'Q3. From Paragraph 3, give ONE finding the narrator used in building her case. [1]',
          answer:
            'either: four in five secondary students had received paid tuition; OR poorer families spent a larger share of their income on tuition than richer families. Either one earns the mark.',
          marks: 1,
        },
        {
          n: 4,
          stem: 'Q4. What is the effect of the phrase ‘an arms race that nobody can leave’ (Paragraph 3)? [2]',
          answer:
            'MP1 (escalation): an arms race is a contest in which each side must keep spending simply because the others are, so tuition is presented as spiralling upward without anyone choosing it; MP2 (no way out): “nobody can leave” makes the point that a family cannot opt out without falling behind, so the pressure is a trap rather than a free choice. Award one mark per distinct point.',
          marks: 2,
        },
        {
          n: 5,
          stem: 'Q5. Using your own words, explain why the narrator trained herself to pause ‘for half a second’ before that phrase. (Paragraph 3) [2]',
          answer:
            'MP1 (deliberate technique): the pause was rehearsed so that the line would carry more weight when it arrived; MP2 (performance, not conviction): at this stage she is stage-managing an effect rather than saying something she believes, which is what makes the later change matter. Award one mark per distinct point.',
          marks: 2,
        },
        {
          n: 6,
          stem: 'Q6. From Paragraph 4, what told the narrator that her reply speech had gone well? [1]',
          answer: 'the particular quality of the silence in the hall after she sat down. One mark.',
          marks: 1,
        },
        {
          n: 7,
          stem: 'Q7. Using your own words, explain why neither the narrator nor her mother mentioned the third argument at lunch. (Paragraph 6) [2]',
          answer:
            'MP1 (it pointed at her mother): the argument was precisely about parents buying grades, and her mother had given things up to pay for exactly that; MP2 (naming it would force the issue): to raise it would have obliged them both to acknowledge the awkwardness, so silence was easier and kinder. Award one mark per distinct point.',
          marks: 2,
        },
        {
          n: 8,
          stem: 'Q8. Using your own words, explain what the narrator means by ‘I had stopped performing the belief and started holding it’. (Paragraph 7) [2]',
          answer:
            'MP1 (it began as an act): at first she was only presenting a position assigned to her; MP2 (it became genuine): partway through the speech she found she actually agreed with what she was saying, so the pretence turned into conviction. Award one mark per distinct point.',
          marks: 2,
        },
        {
          n: 9,
          stem: 'Q9. Using your own words, explain what the narrator says Mrs Iyer ‘left out’. (Paragraph 8) [2]',
          answer:
            'MP1 (the arguer is changed): spending days building the strongest case against something alters what the builder herself thinks; MP2 (it does not stay in the hall): the position follows her into her own life instead of ending when the debate does. Award one mark per distinct point.',
          marks: 2,
        },
        {
          n: 10,
          stem: 'Q10. Using your own words, explain why the narrator calls ‘something my family can afford’ a truer sentence. (Paragraph 9) [2]',
          answer:
            'MP1 (names the money): it admits that tuition depends on what her family is able to pay, rather than treating it as a neutral habit; MP2 (accepts what she argued): it keeps in view the inequality her own speech identified, instead of letting her go back to not noticing it. Award one mark per distinct point.',
          marks: 2,
        },
      ],
    },
    {
      exercise: 2,
      instruction:
        'Q11. [4 marks in total] The narrator’s dominant feeling shifts across the three days and after. For each part of the text below, choose the option that best describes it. Each option may be used once only.',
      questions: [
        { n: 11, stem: 'Q11(i). Paragraph 3 — the three days spent assembling the case. [1]', options: bankOptions('absorbed'), answer: bankKey('absorbed'), marks: 1 },
        { n: 12, stem: 'Q11(ii). Paragraphs 4–5 — the reply speech and the adjudicator’s verdict. [1]', options: bankOptions('triumphant'), answer: bankKey('triumphant'), marks: 1 },
        { n: 13, stem: 'Q11(iii). Paragraphs 6–7 — lunch with her mother afterwards. [1]', options: bankOptions('exposed'), answer: bankKey('exposed'), marks: 1 },
        { n: 14, stem: 'Q11(iv). Paragraphs 8–9 — looking back on what the debate did to her. [1]', options: bankOptions('unsettled'), answer: bankKey('unsettled'), marks: 1 },
      ],
    },
  ],
};

// 手排的选项与答案键必须对得上；对不上立刻炸，别等学生答完才发现判错。
for (const q of DEBATE.sections[1].questions) {
  const flagged = q.options.filter((o) => o.correct);
  if (flagged.length !== 1 || flagged[0].key !== q.answer) {
    throw new Error(`original-other-side：第 ${q.n} 题答案键 ${q.answer} 与 correct 标记不一致`);
  }
}

// ═══════════════════════════════════════════════════════════════
// 五天
// ═══════════════════════════════════════════════════════════════

const DIR = 'singapore-olevel-1128';

const SPECS = [
  {
    source: 'ai-authored-15-the-tutor.json',
    dir: DIR,
    matchingParas: [3, 4, 6, 8],
    multipleChoice: {
      index: 3, // Q4 —— 'a small white scar'
      para: 4,
      answer: 'A lasting hurt that still shows.',
      distractors: [
        'A fresh cut made earlier that morning.',
        'A mark left by a ring that was too tight.',
        'A sign that he had recently been unwell.',
      ],
      explanation: '“scar” 的重点不是皮肤上的痕迹本身，而是它代表一道久久不去的伤——这里指丧妻。',
    },
    gapFill: {
      stem: 'Every Thursday Mr Ng arrived in the same ironed grey shirt, carrying the same worn leather ______.',
      answer: 'briefcase',
      distractors: ['notebook', 'umbrella', 'folder'],
      evidence: 'He always wore the same grey shirt, ironed flat, and carried the same worn leather briefcase.',
    },
    shortAnswers: [
      { index: 4, marks: 2, para: 4, answer: 'The scar image ties the missing ring to a deep and lasting wound, so a bare patch of skin is made to stand for the loss of his wife rather than a mere physical mark.' },
      { index: 5, marks: 2, para: 4, answer: 'He chose to keep his grief private and carry on with his ordinary routine, and he did not want to burden his student with it.' },
      { index: 7, marks: 2, para: 6, answer: 'He wanted Mr Ng to find and correct the slip himself, so that his teacher would not be embarrassed or lose dignity in front of him.' },
      { index: 9, marks: 2, para: 8, answer: 'Even a small kindness done quietly is noticed — his mother had heard the whole thing, so being thoughtful is not as invisible as he had assumed.' },
    ],
  },
  {
    source: 'ai-authored-45-void-deck-wake.json',
    dir: DIR,
    matchingParas: [2, 5, 6, 9],
    multipleChoice: {
      index: 4, // Q5 —— 老太太笑完捂嘴
      para: 3,
      answer: 'She felt that laughing was not allowed at a wake.',
      distractors: [
        'She was trying to stop herself coughing.',
        'She had not meant anyone to overhear her speak.',
        'She was hiding that she did not know the family.',
      ],
      explanation: '捂嘴是「察觉自己失礼」的动作 —— 她意识到守灵场合不该笑出声。',
    },
    gapFill: {
      stem: 'For three nights a white ______ stood in the space where the old men usually played checkers.',
      answer: 'tent',
      distractors: ['table', 'chair', 'banner'],
      evidence:
        'For three nights the white tent stood where the old men usually played checkers, and the sound of it came up through our floor like weather.',
    },
    shortAnswers: [
      { index: 3, marks: 2, para: 3, answer: 'He had braced himself for open, unbearable grief, but found plastic chairs, snacks and forty people who knew each other — an ordinary, almost social gathering.' },
      { index: 5, marks: 2, para: 4, answer: 'Repeating the same three sentences as though each were the first shows both how exhausting the receiving line is and how determined she is to give every mourner their due.' },
      { index: 6, marks: 2, para: 5, answer: 'He helped without expecting anything back, and refusing repayment for thirty-six years shows the generosity was settled character rather than a single gesture.' },
      { index: 7, marks: 2, para: 6, answer: 'A life is remembered through small ordinary kindnesses rather than achievements, and those acts had reached people the narrator never knew were connected to his neighbour.' },
    ],
  },
  {
    source: 'ai-authored-46-recipe-card.json',
    dir: DIR,
    matchingParas: [3, 4, 7, 10],
    multipleChoice: {
      index: 6, // Q7 —— 母亲关于肉桂的那句话
      para: 6,
      answer: 'The “mistake” is exactly what the grandmother always did.',
      distractors: [
        'She is pleased that the narrator followed the card exactly.',
        'She prefers her curry milder than her mother made it.',
        'She is teasing the narrator for being a poor cook.',
      ],
      explanation: '“She always used too much cinnamon” 是在说：你做出来的，正是外婆那一口味道。',
    },
    gapFill: {
      stem: 'The card was not really a recipe: it listed nine ingredients and no ______.',
      answer: 'quantities',
      distractors: ['instructions', 'names', 'pictures'],
      evidence: 'It listed nine ingredients and no quantities.',
    },
    shortAnswers: [
      { index: 2, marks: 2, para: 3, answer: 'Being present while someone cooks does not transfer their skill; real knowledge needs deliberate attention and practice, which she had never given the dish.' },
      { index: 4, marks: 2, para: 4, answer: 'She learnt that the dish could not be produced by measuring, and that judging it by smell was not a vague hint but the actual method her grandmother meant.' },
      { index: 5, marks: 2, para: 5, answer: 'The deliberate slowness shows she was overwhelmed by the familiar smell and was holding herself in check, as though a sudden movement would break the moment.' },
      { index: 8, marks: 2, para: 9, answer: 'She believed the searching was the point; handing over the answer would rob the next person of the understanding that only comes from working it out.' },
    ],
  },
  {
    source: 'ai-authored-47-letter-from-tekong.json',
    dir: DIR,
    matchingParas: [5, 6, 7, 11],
    multipleChoice: {
      index: 2, // Q3 —— 地址写成大写字母
      para: 3,
      answer: 'He took unusual care to make sure it arrived.',
      distractors: [
        'He was in a great hurry when he wrote it.',
        'He had been ordered to address letters that way.',
        'He wanted to disguise his own handwriting.',
      ],
      explanation: '原文说他「不放心自己的字迹能撑过这趟路」，所以大写是格外用心，不是匆忙或规定。',
    },
    gapFill: {
      stem: 'The letter arrived in a brown ______ with the address written in capitals.',
      answer: 'envelope',
      distractors: ['parcel', 'folder', 'box'],
      evidence:
        'It arrived in a brown envelope with the address written in capitals, as though he did not trust his own handwriting to survive the journey.',
    },
    shortAnswers: [
      { index: 1, marks: 2, para: 1, answer: 'There had been no argument or bad feeling; the distance came simply from him growing older and more private, which she wants understood as ordinary rather than hostile.' },
      { index: 3, marks: 2, para: 3, answer: 'The abrupt short sentence marks the point where the letter turns serious and warns the reader that something harder is coming, sharpening the contrast with the harmless first page.' },
      { index: 4, marks: 2, para: 4, answer: 'He was relieved that his distress had stayed private among strangers, but humiliated that he had broken down at all — the same fact both protected and shamed him.' },
      { index: 6, marks: 2, para: 5, answer: 'He had chosen to write to her alone, so passing it on would betray that choice, and she understood he could not let their mother see him that vulnerable.' },
    ],
  },
  {
    key: 'original-other-side',
    inline: DEBATE,
    matchingParas: [3, 5, 7, 9],
    multipleChoice: {
      index: 1, // Q2 —— Mrs Iyer 那句话的意思
      para: 2,
      answer: 'A debater is judged on how well she builds the case she is handed.',
      distractors: [
        'A debater should only accept motions she already agrees with.',
        'A debater must hide her real opinion from the audience.',
        'A debater wins by speaking more confidently than her opponent.',
      ],
      explanation: '这句话讲的是评判标准 —— 看论证做得好不好，与她本人信不信无关。',
    },
    gapFill: {
      stem: 'After three days of practice the narrator could deliver her key phrase without ______.',
      answer: 'stumbling',
      distractors: ['pausing', 'shouting', 'reading'],
      evidence:
        'I learnt to say “an arms race that nobody can leave” without stumbling, and to pause for half a second before the phrase, so that it landed.',
    },
    shortAnswers: [
      { index: 3, marks: 2, para: 3, answer: 'An arms race is a contest in which each side must keep spending because the others are, and “nobody can leave” makes it a trap rather than a choice — a family cannot opt out without falling behind.' },
      { index: 6, marks: 2, para: 6, answer: 'The argument was about parents buying grades, and her mother had gone without in order to pay for exactly that; raising it would have forced them both to acknowledge it.' },
      { index: 7, marks: 2, para: 7, answer: 'She began by presenting a position assigned to her, and partway through found that she actually agreed with it, so the performance turned into genuine conviction.' },
      { index: 8, marks: 2, para: 8, answer: 'Building the strongest possible case against something changes the person who built it, and the position follows her home instead of ending when the debate does.' },
    ],
  },
];

module.exports = {
  LEVEL,
  SPECS,
  DAYS: SPECS.map((spec, i) => buildDay(spec, DATES[i])),
};
