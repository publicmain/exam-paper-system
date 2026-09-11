/**
 * 第三周 —— **ielts_simplified（O-Level 基础）**档，全原创。
 *
 * 这一档面向基础最弱的学生：两百词上下、九个短段、句子短、一条线讲到底。
 * 词汇卡在 CEFR A2 以内（`content-difficulty.ts` 与内容测试会查）。
 *
 * 一天的形状与首发周这一档一致，学生不用重新适应：
 *   3 道四选一 · 2 道判断 · 1 道原文填空（四选一） · 4 道主观题（1/1/2/2 分）
 *
 * 判断题两道答案必须不同；主观题的「Paragraph N」必须与证据句所在段一致。
 */

'use strict';

const { buildAuthoredDay, numbered } = require('../authored');
const { DATES } = require('./dates');

const LEVEL = 'ielts_simplified';

// ═══════════════════════════════════════════════════════════════
// 周一 —— The Fish That Went Missing
// ═══════════════════════════════════════════════════════════════

const FISH = {
  key: 'original-w3-fish',
  title: 'The Fish That Went Missing',
  passage: numbered([
    'Our class has a fish tank at the back of the room. There are five fish in it: three small orange ones, one black one and one fat grey one that we call Captain.',
    'In September the school closed for a week. Mr Tan asked who could come in on Monday, Wednesday and Friday to feed them. I put up my hand before I had really thought about it.',
    'On Monday everything was fine. I gave them a little food and watched them eat. It took two minutes.',
    'On Wednesday I counted four fish. I counted again. Still four. The black one was gone.',
    'I looked behind the plants and under the stones. I looked on the floor, in case it had jumped out. I even checked the bin. My hands were cold.',
    'I did not want to tell Mr Tan, but I did. I sent him a message with a photo of the tank and the words "I am so sorry."',
    'He answered ten minutes later. He sent a photo too. It was the same tank, taken last year, and there was a small black tail coming out of the little stone castle in the corner.',
    'Under the photo he wrote: "It does this. Look inside the castle."',
    'I did. The black fish was inside the castle, asleep, or doing whatever fish do instead of sleeping. Now, when I count them, I always start with the castle.',
  ]),
  questions: [
    {
      kind: 'mcq',
      stem: 'Why did the writer go to school during the holiday?',
      answer: 'to feed the fish',
      distractors: ['to clean the fish tank', 'to help Mr Tan tidy up', 'to take photos of the class'],
      evidence: 'Mr Tan asked who could come in on Monday, Wednesday and Friday to feed them.',
    },
    {
      kind: 'mcq',
      stem: 'What did the writer do first after seeing only four fish?',
      answer: 'counted the fish again',
      distractors: ['sent a message to Mr Tan', 'looked inside the bin', 'gave the fish more food'],
      evidence: 'On Wednesday I counted four fish. I counted again. Still four.',
    },
    {
      kind: 'mcq',
      stem: "What could be seen in Mr Tan's photo?",
      answer: 'a black tail in the castle',
      distractors: ['a tank with four fish', 'the writer feeding the fish', 'a black fish on the floor'],
      evidence:
        'It was the same tank, taken last year, and there was a small black tail coming out of the little stone castle in the corner.',
    },
    {
      kind: 'tfng',
      item: 'Feeding the fish on Monday took the writer only a short time.',
      answer: 'TRUE',
      evidence: 'It took two minutes.',
    },
    {
      kind: 'tfng',
      item: 'The writer found the black fish under the stones.',
      answer: 'FALSE',
      evidence: 'The black fish was inside the castle, asleep, or doing whatever fish do instead of sleeping.',
    },
    {
      kind: 'gapChoice',
      stem: 'When the writer came in on Wednesday, the ______ fish could not be seen.',
      answer: 'black',
      distractors: ['grey', 'orange', 'white'],
      evidence: 'The black one was gone.',
    },
    {
      kind: 'short',
      marks: 1,
      stem: 'From Paragraph 1, what does the class call the fat grey fish?',
      answer: 'Captain.',
      evidence:
        'There are five fish in it: three small orange ones, one black one and one fat grey one that we call Captain.',
      rubric: '一分：答「Captain」即给分。',
    },
    {
      kind: 'short',
      marks: 1,
      stem: 'From Paragraph 6, what did the writer send to Mr Tan together with the message?',
      answer: 'A photo of the tank.',
      evidence: 'I sent him a message with a photo of the tank and the words "I am so sorry."',
      rubric: '一分：答「鱼缸的照片」即给分；只写「照片」也给分。',
    },
    {
      kind: 'short',
      marks: 2,
      stem: 'How did the writer feel while looking for the black fish? Give ONE detail from Paragraph 5 that shows this.',
      answer: 'Worried and afraid — the writer looked everywhere, even in the bin, and their hands were cold.',
      evidence: 'I even checked the bin. My hands were cold.',
      rubric:
        '两分：写出「担心 / 害怕 / 慌」给 1 分；从第 5 段举出一个细节（到处找、连垃圾桶都看了、手发冷）再给 1 分。只写感受没有细节给 1 分。',
    },
    {
      kind: 'short',
      marks: 2,
      stem: 'Why does the writer now always start counting with the castle?',
      answer:
        'Because the black fish likes to hide inside the castle, so looking there first stops the writer from thinking a fish is missing again.',
      evidence: 'Under the photo he wrote: "It does this. Look inside the castle."',
      rubric:
        '两分：写出「黑鱼常躲进城堡里」给 1 分，点明「先看城堡就不会再误以为鱼丢了 / 不会再白慌一场」再给 1 分。',
    },
  ],
};

// ═══════════════════════════════════════════════════════════════
// 周二 —— Two Blue Lunch Boxes
//
// 原来这一天写的是 Grandpa's Radio，语义查重发现与 07-31 发给 G11 旧早测班的
// 「The Old Radio」撞了一整套细节（外公、棕色收音机、银色旋钮、华语老歌、
// 「比我妈妈还老」），那个班六个人做过、已迁到新 App —— 换掉。
// ═══════════════════════════════════════════════════════════════

const LUNCHBOX = {
  key: 'original-w3-lunch-boxes',
  title: 'Two Blue Lunch Boxes',
  passage: numbered([
    'Every day I bring my lunch to school in a blue box with a white lid. So does a boy called Arif in the other class. We did not know this until last Tuesday.',
    'At lunch I opened my box and found noodles. I do not like noodles, and my mother knows this. I looked at the lid. It was the same blue and the same white, but there was a small sticker of a rocket on it.',
    'Under the noodles there was a small note. It said: "Eat everything today, you have football after school. Love, Mum."',
    'I was very hungry, so I ate the noodles. They were better than I thought.',
    'Then I went to find the owner. I walked along the corridor holding the box high in the air, like a sign.',
    'Arif was sitting alone in the canteen with my box. He had eaten my sandwiches already. He looked very worried when he saw me coming.',
    '"I\'m sorry," he said. "I was hungry." I told him I had eaten his noodles too, and he laughed so hard that he had to put his head down on the table.',
    'Now, every Tuesday, we swap lunch boxes on purpose. His mother makes the best noodles in Singapore. My mother does not know.',
  ]),
  questions: [
    {
      kind: 'mcq',
      stem: 'How did the writer know that the box was not theirs?',
      answer: 'It had a rocket sticker on the lid.',
      distractors: ['It was a different colour.', 'Its lid was broken.', "Arif's name was on it."],
      evidence: 'It was the same blue and the same white, but there was a small sticker of a rocket on it.',
    },
    {
      kind: 'mcq',
      stem: 'Why did the writer eat the noodles?',
      answer: 'The writer was very hungry.',
      distractors: ['The note said to eat everything.', 'The writer loves noodles.', 'Arif asked the writer to.'],
      evidence: 'I was very hungry, so I ate the noodles.',
    },
    {
      kind: 'mcq',
      stem: 'How did the writer carry the box along the corridor?',
      answer: 'high in the air',
      distractors: ['under one arm', 'inside a school bag', 'in a plastic bag'],
      evidence: 'I walked along the corridor holding the box high in the air, like a sign.',
    },
    {
      kind: 'tfng',
      item: 'The writer and Arif are in the same class.',
      answer: 'FALSE',
      evidence: 'So does a boy called Arif in the other class.',
    },
    {
      kind: 'tfng',
      item: "Arif's mother knows about the Tuesday swap.",
      answer: 'NOT GIVEN',
    },
    {
      kind: 'gapChoice',
      stem: "Arif's mother wrote in the note that he had ______ after school.",
      answer: 'football',
      distractors: ['swimming', 'tuition', 'music'],
      evidence: 'It said: "Eat everything today, you have football after school. Love, Mum."',
    },
    {
      kind: 'short',
      marks: 1,
      stem: 'From Paragraph 2, what food was inside the box the writer opened?',
      answer: 'Noodles.',
      evidence: 'At lunch I opened my box and found noodles.',
      rubric: '一分：答「面 / noodles」即给分。',
    },
    {
      kind: 'short',
      marks: 1,
      stem: 'From Paragraph 6, what had Arif already eaten?',
      answer: "The writer's sandwiches.",
      evidence: 'He had eaten my sandwiches already.',
      rubric: '一分：答「作者的三明治」即给分。',
    },
    {
      kind: 'short',
      marks: 2,
      stem: 'Why did Arif look worried when he saw the writer coming?',
      answer: "He had already eaten the writer's lunch, so he thought the writer would be angry with him.",
      evidence: 'He had eaten my sandwiches already. He looked very worried when he saw me coming.',
      rubric: '两分：写出「他已经把作者的午饭吃了」给 1 分；点明「怕作者生气 / 怕挨骂」再给 1 分。',
    },
    {
      kind: 'short',
      marks: 2,
      stem: 'Why do the writer and Arif now swap lunch boxes on purpose every Tuesday?',
      answer:
        "The mix-up made them friends and they enjoy it, and the writer likes the noodles Arif's mother makes.",
      evidence: 'Now, every Tuesday, we swap lunch boxes on purpose. His mother makes the best noodles in Singapore.',
      rubric:
        '两分：写出「那次拿错之后两人成了朋友 / 觉得好玩」给 1 分；写出「作者喜欢 Arif 妈妈做的面」再给 1 分。',
    },
  ],
};

const SPECS = [FISH, LUNCHBOX];

module.exports = {
  LEVEL,
  SPECS,
  DAYS: SPECS.map((spec, i) => buildAuthoredDay(spec, DATES[i])),
};
