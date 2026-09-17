/**
 * 第四周 —— **ielts_simplified（O-Level 基础）**档，全原创。
 *
 * 形状与第三周这一档一致：两百词上下、八九个短段、一条线讲到底，
 *   3 道四选一 · 2 道判断 · 1 道原文填空（四选一） · 4 道主观题（1/1/2/2 分）。
 *
 * 选题前对过学生读过的 195 篇：新鞋、风筝、生日蛋糕、雨伞、坐错车、
 * 图书卡、仓鼠、拼字比赛都已经有了，这一周避开。
 *
 * 第三周盲做提出的两点这里照做：两分题的两个得分点都要能在原文里找到
 * （不靠推断）；不出「他从没做过什么」这种否定问法。
 */

'use strict';

const { buildAuthoredDay, numbered } = require('../authored');
const { DATES } = require('./dates');

const LEVEL = 'ielts_simplified';

// ═══════════════════════════════════════════════════════════════
// 周一 —— The Question I Did Not Ask
// ═══════════════════════════════════════════════════════════════

const QUESTION = {
  key: 'original-w4-question',
  title: 'The Question I Did Not Ask',
  passage: numbered([
    'In maths on Monday, Mr Lee put a long sum on the board and explained it very quickly. I did not understand the third step at all.',
    'I wanted to ask him to explain it again. But the room was very quiet, and everyone else was writing. I thought they all understood, and I did not want to be the only one.',
    'So I copied the sum into my book and said nothing. My face felt hot.',
    'Then Farah, who sits next to me, put up her hand. "Sorry, Mr Lee," she said. "Can you do the third step again? I am lost."',
    'Mr Lee smiled and did it again, more slowly. This time he used smaller numbers, and I understood it.',
    'Then something surprising happened. Six more people put up their hands and asked about the same step. I was not the only one after all.',
    'After the lesson I told Farah that I had not understood it either. She laughed. "I know," she said. "You were holding your pen, but you were not writing anything."',
    'Now I have a rule. If I am lost, I put up my hand in the first five minutes. Someone else is usually lost too.',
  ]),
  questions: [
    {
      kind: 'mcq',
      stem: 'Why did the writer not ask Mr Lee a question at first?',
      answer: 'The writer thought everyone else understood.',
      distractors: [
        'Mr Lee had told the class not to talk.',
        'The writer was busy copying the sum.',
        'The lesson was almost at its end.',
      ],
      evidence: 'I thought they all understood, and I did not want to be the only one.',
    },
    {
      kind: 'mcq',
      stem: 'What did Mr Lee do when he explained the step again?',
      answer: 'He used smaller numbers.',
      distractors: ['He asked Farah to explain it.', 'He gave the class a new sum.', 'He wrote it in a book.'],
      evidence: 'This time he used smaller numbers, and I understood it.',
    },
    {
      kind: 'mcq',
      stem: 'Where does Farah sit?',
      answer: 'next to the writer',
      distractors: ['behind the writer', 'at the front of the room', 'near the classroom door'],
      evidence: 'Then Farah, who sits next to me, put up her hand.',
    },
    {
      kind: 'tfng',
      item: "Mr Lee was angry when Farah asked her question.",
      answer: 'FALSE',
      evidence: 'Mr Lee smiled and did it again, more slowly.',
    },
    {
      kind: 'tfng',
      item: 'Farah asked Mr Lee to explain part of the sum again.',
      answer: 'TRUE',
      evidence: 'Can you do the third step again? I am lost.',
    },
    {
      kind: 'gapChoice',
      stem: 'Farah knew the writer was lost because the writer was holding a ______ but not writing.',
      answer: 'pen',
      distractors: ['pencil', 'book', 'ruler'],
      evidence: 'You were holding your pen, but you were not writing anything.',
    },
    {
      kind: 'short',
      marks: 1,
      stem: 'From Paragraph 1, which part of the sum did the writer not understand?',
      answer: 'The third step.',
      evidence: 'I did not understand the third step at all.',
      rubric: '一分：答「第三步 / the third step」即给分。',
    },
    {
      kind: 'short',
      marks: 1,
      stem: 'From Paragraph 3, what did the writer do with the sum on the board?',
      answer: 'Copied it into a book.',
      evidence: 'So I copied the sum into my book and said nothing.',
      rubric: '一分：答出「把它抄进本子里」即给分。',
    },
    {
      kind: 'short',
      marks: 2,
      stem: 'From Paragraph 6, what surprised the writer, and what did the writer learn from it?',
      answer: 'Six more people asked about the same step, so the writer learned that they were not the only one who was lost.',
      evidence: 'I was not the only one after all.',
      rubric: '两分：写出「又有六个人问同一步」给 1 分；写出「原来不懂的不只作者一个」再给 1 分。',
    },
    {
      kind: 'short',
      marks: 2,
      stem: "From Paragraph 8, what is the writer's rule now, and why does the writer think it is a good rule?",
      answer: 'If the writer is lost, they put up their hand in the first five minutes, because someone else is usually lost too.',
      evidence: 'If I am lost, I put up my hand in the first five minutes.',
      rubric: '两分：写出「不懂就在前五分钟举手」给 1 分；写出「因为通常别人也不懂」再给 1 分。',
    },
  ],
};

// ═══════════════════════════════════════════════════════════════
// 周二 —— The Early Alarm
// ═══════════════════════════════════════════════════════════════

const ALARM = {
  key: 'original-w4-early-alarm',
  title: 'The Early Alarm',
  passage: numbered([
    'On Thursday my alarm rang, and I jumped out of bed. The room was dark, but it is often dark when I get up, so I did not think about it.',
    'I washed, put on my uniform and ate a banana in the kitchen. Nobody else was awake. I thought my family was just being lazy.',
    'I walked to school quickly. The streets were very quiet. There were no other students at the bus stop, and the shops were all closed.',
    'When I got to the school gate, it was locked. The guard, Mr Ramu, came out of his little office with a torch.',
    '"What are you doing here?" he asked. "It is half past five."',
    'I looked at the clock on the wall of his office. He was right. The night before, my little brother had played with my alarm clock, and he had changed the time.',
    'Mr Ramu let me sit in his office. He gave me a cup of hot tea and showed me photos of his grandchildren. At half past six, the first teacher arrived.',
    "By the time my friends came, I had finished all my homework and learned the names of Mr Ramu's six grandchildren.",
    'Now I check the time on my phone before I leave the house. And I say good morning to Mr Ramu every day.',
  ]),
  questions: [
    {
      kind: 'mcq',
      stem: 'Why did the writer not worry that the room was dark?',
      answer: 'It is often dark when the writer wakes up.',
      distractors: [
        'The writer thought it was going to rain.',
        'The light in the room was not working.',
        'The writer wanted to sleep a little more.',
      ],
      evidence: 'The room was dark, but it is often dark when I get up, so I did not think about it.',
    },
    {
      kind: 'mcq',
      stem: 'What time was it when the writer arrived at the school gate?',
      answer: 'half past five',
      distractors: ['half past six', 'six o\'clock', 'a quarter to six'],
      evidence: '"It is half past five."',
    },
    {
      kind: 'mcq',
      stem: "Why was the writer's clock wrong?",
      answer: "The writer's brother had changed the time.",
      distractors: [
        'The battery in the clock was very old.',
        'The writer had set it wrong at night.',
        'There was no electricity in the night.',
      ],
      evidence: 'The night before, my little brother had played with my alarm clock, and he had changed the time.',
    },
    {
      kind: 'tfng',
      item: 'Mr Ramu has worked at the school for more than ten years.',
      answer: 'NOT GIVEN',
    },
    {
      kind: 'tfng',
      item: 'The shops were open when the writer walked to school.',
      answer: 'FALSE',
      evidence: 'There were no other students at the bus stop, and the shops were all closed.',
    },
    {
      kind: 'gapChoice',
      stem: 'Before leaving home, the writer ate a ______ in the kitchen.',
      answer: 'banana',
      distractors: ['sandwich', 'biscuit', 'pear'],
      evidence: 'I washed, put on my uniform and ate a banana in the kitchen.',
    },
    {
      kind: 'short',
      marks: 1,
      stem: 'From Paragraph 4, what was Mr Ramu carrying when he came out?',
      answer: 'A torch.',
      evidence: 'The guard, Mr Ramu, came out of his little office with a torch.',
      rubric: '一分：答「手电筒 / torch」即给分。',
    },
    {
      kind: 'short',
      marks: 1,
      stem: 'From Paragraph 7, what did Mr Ramu give the writer to drink?',
      answer: 'A cup of hot tea.',
      evidence: 'He gave me a cup of hot tea and showed me photos of his grandchildren.',
      rubric: '一分：答「（一杯热）茶 / tea」即给分。',
    },
    {
      kind: 'short',
      marks: 2,
      stem: 'In Paragraph 2, what did the writer think about the family? Using Paragraphs 5–6, explain why the writer was wrong.',
      answer:
        'The writer thought the family was being lazy, but it was only half past five, so everyone was still asleep for a good reason.',
      evidence: 'I thought my family was just being lazy.',
      rubric: '两分：写出「以为家人在偷懒」给 1 分；点明「其实才五点半，时间太早，大家本来就在睡觉」再给 1 分。',
    },
    {
      kind: 'short',
      marks: 2,
      stem: 'From Paragraph 9, give TWO things the writer does now because of that morning.',
      answer: 'The writer checks the time on their phone before leaving home, and says good morning to Mr Ramu every day.',
      evidence: 'Now I check the time on my phone before I leave the house.',
      rubric: '两分：「出门前用手机看时间」「每天跟 Mr Ramu 说早上好」各 1 分。',
    },
  ],
};

// ═══════════════════════════════════════════════════════════════
// 周三 —— The Bean That Did Not Grow
// ═══════════════════════════════════════════════════════════════

const BEAN = {
  key: 'original-w4-bean',
  title: 'The Bean That Did Not Grow',
  passage: numbered([
    'For science, everyone in my class had to grow a bean plant in a paper cup. Ms Ong gave each of us one bean, some soil and a cup with our name on it.',
    'We put the cups in a long line next to the window. Every morning we gave them a little water.',
    'After five days, small green shoots came up in almost every cup. Mine stayed brown and flat. After eight days, some plants were as tall as my finger. Mine still had nothing.',
    'So I gave it more water. I moved it to the sunniest place. I even talked to it quietly when nobody was looking.',
    'On the tenth day, Ms Ong helped me to dig up my bean with a spoon. It was soft and dark, and it smelled bad.',
    '"Too much water," she said. "A seed needs water, but it also needs air. This one could not breathe."',
    'I felt terrible. I had tried so hard, and my trying was the problem.',
    'Ms Ong gave me a new bean. This time I gave it only a little water every two days, and I did not move it at all.',
    "Six days later, a green shoot came up. It is shorter than everyone else's, but I like it the most.",
  ]),
  questions: [
    {
      kind: 'mcq',
      stem: 'Where did the class put their cups?',
      answer: 'next to the window',
      distractors: ["on the teacher's desk", 'in the school garden', 'on the classroom floor'],
      evidence: 'We put the cups in a long line next to the window.',
    },
    {
      kind: 'mcq',
      stem: 'What was the first bean like when it was dug up?',
      answer: 'soft and dark',
      distractors: ['dry and hard', 'green and tall', 'white and long'],
      evidence: 'It was soft and dark, and it smelled bad.',
    },
    {
      kind: 'mcq',
      stem: 'Why did the first bean not grow?',
      answer: 'It was given too much water.',
      distractors: ['It did not get enough sun.', 'The soil in the cup was too old.', 'It was put too deep in the soil.'],
      evidence: '"Too much water," she said.',
    },
    {
      kind: 'tfng',
      item: "The writer's second plant grew taller than the other plants in the class.",
      answer: 'FALSE',
      evidence: "It is shorter than everyone else's, but I like it the most.",
    },
    {
      kind: 'tfng',
      item: 'The writer spoke to the bean when other people were not watching.',
      answer: 'TRUE',
      evidence: 'I even talked to it quietly when nobody was looking.',
    },
    {
      kind: 'gapChoice',
      stem: 'Ms Ong said that a seed needs water, and it also needs ______.',
      answer: 'air',
      distractors: ['sun', 'soil', 'food'],
      evidence: 'A seed needs water, but it also needs air.',
    },
    {
      kind: 'short',
      marks: 1,
      stem: 'From Paragraph 1, what did each student grow the bean in?',
      answer: 'A paper cup.',
      evidence: 'For science, everyone in my class had to grow a bean plant in a paper cup.',
      rubric: '一分：答「纸杯 / paper cup」即给分；只写「杯子 / cup」也给分。',
    },
    {
      kind: 'short',
      marks: 1,
      stem: 'From Paragraph 3, how tall were some of the plants after eight days?',
      answer: "As tall as the writer's finger.",
      evidence: 'After eight days, some plants were as tall as my finger.',
      rubric: '一分：答「和作者的手指一样高」即给分。',
    },
    {
      kind: 'short',
      marks: 2,
      stem: 'From Paragraph 7, why did the writer feel terrible?',
      answer: 'The writer had worked very hard to help the bean, but the extra water was what stopped it from growing.',
      evidence: 'I had tried so hard, and my trying was the problem.',
      rubric: '两分：写出「作者非常努力地照顾它」给 1 分；点明「正是自己的努力（多浇的水）害了它」再给 1 分。',
    },
    {
      kind: 'short',
      marks: 2,
      stem: 'From Paragraph 8, give TWO things the writer did differently with the new bean.',
      answer: 'The writer gave it only a little water every two days, and did not move it at all.',
      evidence: 'This time I gave it only a little water every two days, and I did not move it at all.',
      rubric: '两分：以下任意两点各 1 分：只浇一点水；每两天才浇一次；一直不挪动它。',
    },
  ],
};

// ═══════════════════════════════════════════════════════════════
// 周四 —— The Parrot Next Door
// ═══════════════════════════════════════════════════════════════

const PARROT = {
  key: 'original-w4-parrot',
  title: 'The Parrot Next Door',
  passage: numbered([
    'Our new neighbours have a grey parrot called Coco. She lives in a big cage near their front door, so we see her every time we walk past.',
    'Coco can say about twenty words. She says "Hello" and "Bye bye", and she can copy the sound of a phone perfectly.',
    'Last month my mother kept running to answer her phone, but it was never ringing. It took her a week to understand that it was Coco.',
    'Then Coco learned a new word. Every afternoon, when I came home from school, she shouted "Jun Wei! Jun Wei!" That is my name.',
    'I did not teach her. I was confused, and a little proud.',
    'One Saturday I asked our neighbour, Mrs Das, how Coco knew my name. She laughed and pointed at our door.',
    'Every afternoon, my grandmother opens our door and calls "Jun Wei! Shoes!" to tell me to take off my shoes before I come in. Coco had heard it many times.',
    'Now Coco says my name, and then, in my grandmother\'s voice, "Shoes!"',
    'I still take them off. It is hard to say no to two people at once, even when one of them is a parrot.',
  ]),
  questions: [
    {
      kind: 'mcq',
      stem: 'Where does Coco live?',
      answer: "in a cage near the neighbours' door",
      distractors: ["in a room inside the writer's home", 'in a tree outside the building', 'in a pet shop near the school'],
      evidence: 'She lives in a big cage near their front door, so we see her every time we walk past.',
    },
    {
      kind: 'mcq',
      stem: "Why did the writer's mother keep running to answer her phone?",
      answer: 'She heard a phone sound that Coco made.',
      distractors: [
        'She was waiting for an important call.',
        'Her phone was ringing all the time.',
        'Her friends kept sending her messages.',
      ],
      evidence: 'Last month my mother kept running to answer her phone, but it was never ringing.',
    },
    {
      kind: 'mcq',
      stem: "How did Coco learn the writer's name?",
      answer: 'by hearing the grandmother call it',
      distractors: [
        'by listening to Mrs Das every day',
        "by hearing the writer's friends",
        "by watching the family's TV",
      ],
      evidence: 'Coco had heard it many times.',
    },
    {
      kind: 'tfng',
      item: 'The writer taught Coco to say his name.',
      answer: 'FALSE',
      evidence: 'I did not teach her.',
    },
    {
      kind: 'tfng',
      item: 'Mrs Das bought Coco when Coco was very young.',
      answer: 'NOT GIVEN',
    },
    {
      kind: 'gapChoice',
      stem: 'Coco can say about ______ words.',
      answer: 'twenty',
      distractors: ['ten', 'thirty', 'fifty'],
      evidence: 'Coco can say about twenty words.',
    },
    {
      kind: 'short',
      marks: 1,
      stem: 'From Paragraph 6, who did the writer ask about Coco?',
      answer: 'Mrs Das, the neighbour.',
      evidence: 'One Saturday I asked our neighbour, Mrs Das, how Coco knew my name.',
      rubric: '一分：答「邻居 Mrs Das」即给分；只写 Mrs Das 或「邻居」也给分。',
    },
    {
      kind: 'short',
      marks: 1,
      stem: "From Paragraph 7, why does the writer's grandmother call his name every afternoon?",
      answer: 'To tell him to take off his shoes before he comes in.',
      evidence:
        'Every afternoon, my grandmother opens our door and calls "Jun Wei! Shoes!" to tell me to take off my shoes before I come in.',
      rubric: '一分：答出「叫他进门前先脱鞋」即给分。',
    },
    {
      kind: 'short',
      marks: 2,
      stem: 'From Paragraph 5, give TWO feelings the writer had when Coco started saying his name.',
      answer: 'He was confused, and he was a little proud.',
      evidence: 'I was confused, and a little proud.',
      rubric: '两分：「疑惑 / 不明白」「有点得意 / 自豪」各 1 分。',
    },
    {
      kind: 'short',
      marks: 2,
      stem: 'From Paragraphs 8–9, why does the writer still take off his shoes?',
      answer:
        'Both his grandmother and Coco now tell him to take off his shoes, and it is hard to say no to two people at the same time.',
      evidence: 'It is hard to say no to two people at once, even when one of them is a parrot.',
      rubric: '两分：写出「奶奶和鹦鹉都在叫他脱鞋」给 1 分；写出「很难同时拒绝两个人」再给 1 分。',
    },
  ],
};

// ═══════════════════════════════════════════════════════════════
// 周五 —— The Ring in the Rice
// ═══════════════════════════════════════════════════════════════

const RING = {
  key: 'original-w4-ring-in-the-rice',
  title: 'The Ring in the Rice',
  passage: numbered([
    'On Sunday my mother washed the rice for dinner, as she does every day. When she finished, she looked at her hand and went very quiet.',
    'Her gold ring was gone. It was the ring my father gave her before they were married.',
    'We looked everywhere. My sister checked the sink. I looked under the table and the fridge. My father took everything out of the rubbish bag and put it back again.',
    'We did not find it. My mother said it did not matter, but she did not eat much, and she kept looking at her hand.',
    'We had the rice for dinner anyway, with egg and vegetables. Halfway through, my little brother Kai stopped eating. He put his fingers in his mouth and took something out.',
    'It was the ring. It had been in the rice pot the whole time.',
    'My mother laughed so much that she cried. My father said Kai was the best finder in the family. Kai said his tooth hurt.',
    'Now my mother takes off her ring before she washes the rice. She puts it in a small blue bowl next to the cooker.',
    'And Kai looks carefully at every spoon of rice before he eats it. Just in case.',
  ]),
  questions: [
    {
      kind: 'mcq',
      stem: "What did the writer's mother lose?",
      answer: 'her gold ring',
      distractors: ['her gold watch', 'her kitchen key', 'her silver bracelet'],
      evidence: 'Her gold ring was gone.',
    },
    {
      kind: 'mcq',
      stem: 'Where did the writer look for it?',
      answer: 'under the table and the fridge',
      distractors: ['in the sink and the cupboard', 'in the rubbish bag outside', 'behind the cooker and the door'],
      evidence: 'I looked under the table and the fridge.',
    },
    {
      kind: 'mcq',
      stem: 'Who found the ring?',
      answer: "the writer's little brother",
      distractors: ["the writer's sister", "the writer's father", "the writer's mother"],
      evidence: 'Halfway through, my little brother Kai stopped eating.',
    },
    {
      kind: 'tfng',
      item: "The ring was a present from the writer's grandmother.",
      answer: 'FALSE',
      evidence: 'It was the ring my father gave her before they were married.',
    },
    {
      kind: 'tfng',
      item: 'Kai said that his tooth hurt after he found the ring.',
      answer: 'TRUE',
      evidence: 'Kai said his tooth hurt.',
    },
    {
      kind: 'gapChoice',
      stem: 'Now the mother keeps her ring in a small blue ______ while she washes the rice.',
      answer: 'bowl',
      distractors: ['box', 'bag', 'cup'],
      evidence: 'She puts it in a small blue bowl next to the cooker.',
    },
    {
      kind: 'short',
      marks: 1,
      stem: "From Paragraph 3, what did the writer's sister check?",
      answer: 'The sink.',
      evidence: 'My sister checked the sink.',
      rubric: '一分：答「水池 / 洗碗池（sink）」即给分。',
    },
    {
      kind: 'short',
      marks: 1,
      stem: 'From Paragraph 6, where had the ring been all along?',
      answer: 'In the rice pot.',
      evidence: 'It had been in the rice pot the whole time.',
      rubric: '一分：答「在煮饭的锅里 / rice pot」即给分。',
    },
    {
      kind: 'short',
      marks: 2,
      stem: 'In Paragraph 4, the mother said it did not matter. Give TWO details that show she was still upset.',
      answer: 'She did not eat much, and she kept looking at her hand.',
      evidence: 'My mother said it did not matter, but she did not eat much, and she kept looking at her hand.',
      rubric: '两分：「没怎么吃饭」「一直看自己的手」各 1 分。',
    },
    {
      kind: 'short',
      marks: 2,
      stem: 'Using Paragraphs 5–9, explain why Kai now looks carefully at his rice before eating it.',
      answer: 'He once found the ring in his rice and it hurt his tooth, so he checks in case something is in it again.',
      evidence: 'And Kai looks carefully at every spoon of rice before he eats it.',
      rubric: '两分：写出「上次饭里吃到了戒指 / 硌了牙」给 1 分；点明「怕饭里又有东西，以防万一」再给 1 分。',
    },
  ],
};

const SPECS = [QUESTION, ALARM, BEAN, PARROT, RING];

module.exports = {
  LEVEL,
  SPECS,
  DAYS: SPECS.map((spec, i) => buildAuthoredDay(spec, DATES[i])),
};
