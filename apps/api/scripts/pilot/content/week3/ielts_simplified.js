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

// ═══════════════════════════════════════════════════════════════
// 周三 —— The Wrong List
// ═══════════════════════════════════════════════════════════════

const WRONG_LIST = {
  key: 'original-w3-wrong-list',
  title: 'The Wrong List',
  passage: numbered([
    'Two lists went up on the notice board outside the hall. To join a club, you wrote your name on one of them.',
    'I wanted to play football. On Monday morning I was late for class, so I wrote my name on the first list I saw and ran off.',
    'On Friday, Ms Lim stopped me in the corridor. "See you at singing club on Tuesday," she said with a smile.',
    'I did not understand. I went back and read the top of the list. It said "Singing Club" in big letters. My name was the last one on it.',
    'I told Ms Lim it was a mistake. She said the football list was full now, but the singing club needed more voices. "Just come for one week," she said.',
    'At the first meeting, I sat at the back and did not open my mouth. I just looked at the clock.',
    'In the second week, we each had to sing a short part alone. My legs were shaking. My voice was very small, but nobody laughed.',
    'After that, I looked at the clock less. I liked singing more every week. I even sang in the shower at home, until my sister told me to stop.',
    'In July we sang at the school concert, and my parents sat in the front row. Next year I will read the top of the list first. And I will write my name on the singing list again.',
  ]),
  questions: [
    {
      kind: 'mcq',
      stem: 'Why did the writer choose a list so quickly on Monday?',
      answer: 'The writer was late for class.',
      distractors: ["The writer's friend was waiting.", 'The board was too high to see.', 'Ms Lim told the writer to hurry.'],
      evidence: 'On Monday morning I was late for class, so I wrote my name on the first list I saw and ran off.',
    },
    {
      kind: 'mcq',
      stem: 'What did the writer do at the first meeting of the singing club?',
      answer: 'did not sing at all',
      distractors: ['sang a part alone', 'sat in the front row', 'clapped for the others'],
      evidence: 'At the first meeting, I sat at the back and did not open my mouth. I just looked at the clock.',
    },
    {
      kind: 'mcq',
      stem: 'How did the writer feel when it was time to sing alone?',
      answer: 'nervous',
      distractors: ['bored', 'angry', 'proud'],
      evidence: 'My legs were shaking.',
    },
    {
      kind: 'tfng',
      item: "The writer's name was at the bottom of the list.",
      answer: 'TRUE',
      evidence: 'My name was the last one on it.',
    },
    {
      kind: 'tfng',
      item: "The writer's parents watched the concert from the back.",
      answer: 'FALSE',
      evidence: 'In July we sang at the school concert, and my parents sat in the front row.',
    },
    {
      kind: 'gapChoice',
      stem: 'At home, the writer began to sing in the ______.',
      answer: 'shower',
      distractors: ['hall', 'corridor', 'kitchen'],
      evidence: 'I even sang in the shower at home, until my sister told me to stop.',
    },
    {
      kind: 'short',
      marks: 1,
      stem: 'From Paragraph 1, where were the two lists put up?',
      answer: 'On the notice board outside the hall.',
      evidence: 'Two lists went up on the notice board outside the hall.',
      rubric: '一分：答「礼堂外的布告栏」即给分；只写「布告栏 / notice board」也给分。',
    },
    {
      kind: 'short',
      marks: 1,
      stem: 'From Paragraph 3, on which day does the singing club meet?',
      answer: 'Tuesday.',
      evidence: '"See you at singing club on Tuesday," she said with a smile.',
      rubric: '一分：答「星期二 / Tuesday」即给分。',
    },
    {
      kind: 'short',
      marks: 2,
      stem: 'From Paragraph 5, why did the writer go to singing club and not football?',
      answer: 'The football list was already full, and Ms Lim asked the writer to come to singing club for one week.',
      evidence: 'She said the football list was full now, but the singing club needed more voices.',
      rubric:
        '两分：以下任意两点，每点 1 分：作者把名字写到了歌唱社的名单上；足球社的名单已经满了；歌唱社缺人；Lim 老师请作者先来试一周。用自己的简单英文说对意思即可。',
    },
    {
      kind: 'short',
      marks: 2,
      stem: 'From Paragraphs 8–9, which list will the writer choose next year, and why?',
      answer: 'The singing list again, because the writer now enjoys singing.',
      evidence: 'And I will write my name on the singing list again.',
      rubric:
        '两分：写出「明年还报歌唱社」给 1 分；写出「因为现在喜欢上唱歌了」再给 1 分（第 8 段「一周比一周喜欢唱」或「在家洗澡也唱」都可作依据）。只写「会先看清表头再写名字」不给分 —— 题目问的是选哪张表。',
    },
  ],
};

// ═══════════════════════════════════════════════════════════════
// 周四 —— The Boy by the Gates
// ═══════════════════════════════════════════════════════════════

const BOY_AT_GATES = {
  key: 'original-w3-boy-by-the-gates',
  title: 'The Boy by the Gates',
  passage: numbered([
    'Last Saturday I was on my way to art class. The class starts at ten, and our teacher does not like it when we are late. I had fifteen minutes.',
    'At the train station, I saw a small boy near the gates. He was about five, and he was crying. Many people walked past him, but nobody stopped.',
    'I looked at the clock on the wall. Then I looked at the boy again. I stopped and asked, "Where is your mum?"',
    'He pointed at a train that was just leaving. "Mummy is inside," he said. "The door closed. I was too slow."',
    'I did not know what to do. But I knew the people in the station office could help, so I took his hand and walked him there. A station worker came out and listened to us.',
    'He made a phone call. Then he smiled. "His mother is at the next station. She is coming back now. Please wait here with him."',
    'We sat on a bench to wait. His name was Ravi. I showed him the map of the train line, and we counted the stations together. Soon he stopped crying.',
    'A few minutes later, a woman ran off the next train. She held Ravi very tight and said "Thank you" to me again and again.',
    'I was twenty minutes late for art class. I told my teacher what happened. She did not say anything for a moment. Then she said I could stay ten minutes after class to finish my picture.',
  ]),
  questions: [
    {
      kind: 'mcq',
      stem: 'Why was the boy alone at the station?',
      answer: 'The train door closed before he got on.',
      distractors: ['His mother went to buy a drink.', 'He ran away from his mother.', 'He was waiting for his father.'],
      evidence: 'The door closed. I was too slow.',
    },
    {
      kind: 'mcq',
      stem: 'What did the station worker ask the writer to do?',
      answer: 'wait with the boy',
      distractors: ['take the boy to the next station', "call the boy's mother", 'go on to art class'],
      evidence: 'Please wait here with him.',
    },
    {
      kind: 'mcq',
      stem: 'What helped the boy to stop crying?',
      answer: 'counting stations on a map',
      distractors: ['a drink from the station worker', 'a phone call with his mother', 'a paper plane from the writer'],
      evidence: 'I showed him the map of the train line, and we counted the stations together.',
    },
    {
      kind: 'tfng',
      item: 'Many people stopped to help the boy before the writer did.',
      answer: 'FALSE',
      evidence: 'Many people walked past him, but nobody stopped.',
    },
    {
      kind: 'tfng',
      item: 'The writer had helped a lost child before.',
      answer: 'NOT GIVEN',
    },
    {
      kind: 'gapChoice',
      stem: 'While they waited, the writer and the boy sat on a ______.',
      answer: 'bench',
      distractors: ['train', 'wall', 'floor'],
      evidence: 'We sat on a bench to wait.',
    },
    {
      kind: 'short',
      marks: 1,
      stem: 'From Paragraph 1, what time does the art class start?',
      answer: 'At ten.',
      evidence: 'The class starts at ten, and our teacher does not like it when we are late.',
      rubric: '一分：答「十点 / ten / 10 / 10 a.m.」都给分。',
    },
    {
      kind: 'short',
      marks: 1,
      stem: "From Paragraph 7, what was the boy's name?",
      answer: 'Ravi.',
      evidence: 'His name was Ravi.',
      rubric: '一分：答「Ravi」即给分，拼写小错不扣。',
    },
    {
      kind: 'short',
      marks: 2,
      stem: 'From Paragraph 5, why did the writer take the boy to the station office?',
      answer: 'The writer did not know what to do, but knew that the people in the office could help.',
      evidence: 'But I knew the people in the station office could help, so I took his hand and walked him there.',
      rubric:
        '两分：写出「作者自己不知道该怎么办」给 1 分；写出「作者知道车站办公室的人能帮忙」再给 1 分。用自己的简单英文说对意思即可。',
    },
    {
      kind: 'short',
      marks: 2,
      stem: 'From Paragraph 9, why did the teacher let the writer stay after class?',
      answer:
        'The writer was late because they had helped a lost boy, so the teacher let them stay to finish their picture.',
      evidence: 'Then she said I could stay ten minutes after class to finish my picture.',
      rubric:
        '两分：写出「作者迟到是因为帮了走失的小男孩 / 老师知道了迟到的原因」给 1 分；写出「让作者把画画完 / 补上迟到少画的时间」再给 1 分。只答出其中一点给 1 分。',
    },
  ],
};

// ═══════════════════════════════════════════════════════════════
// 周五 —— The Tin Under the Bed
// ═══════════════════════════════════════════════════════════════

const TIN = {
  key: 'original-w3-tin-under-the-bed',
  title: 'The Tin Under the Bed',
  passage: numbered([
    'My watch broke in June. It fell on the floor at school, and the glass broke. After that, I always had to ask people for the time.',
    'Soon after that, my little sister Lina started to keep a secret. She is eight. Every day after school, she went into her room and shut the door.',
    'One evening I opened her door without knocking. Lina was on the floor, putting coins into an old tin. She pushed it under the bed very fast. "Go away!" she shouted.',
    'Mum told me that Lina had stopped buying snacks at school. She was keeping all her pocket money.',
    'I thought she wanted a new toy or a game. I did not ask her about it again.',
    'One day, Lina asked me, "Do you like blue or green?" I said blue, and she ran back to her room.',
    'My birthday was in August. At breakfast, Lina put a small box next to my plate. Inside was a blue watch.',
    'It was made of plastic. It cost twelve dollars. "I saved for six weeks," Lina said. "No snacks for six weeks."',
    'On the back of the watch, Lina wrote "Happy birthday" with a pen. The words are almost gone now, but I wear the watch every day. When I look at it, I think of her six weeks without snacks, and I smile.',
  ]),
  questions: [
    {
      kind: 'mcq',
      stem: "How did the writer's old watch get broken?",
      answer: 'It fell on the floor at school.',
      distractors: ['Lina played with it at home.', 'It got wet in the shower.', 'Someone sat on it in class.'],
      evidence: 'It fell on the floor at school, and the glass broke.',
    },
    {
      kind: 'mcq',
      stem: 'What did Lina do when the writer came into her room?',
      answer: 'She pushed a tin under the bed.',
      distractors: ['She gave the writer a small box.', 'She asked the writer for money.', 'She started to cry very loudly.'],
      evidence: 'Lina was on the floor, putting coins into an old tin. She pushed it under the bed very fast.',
    },
    {
      kind: 'mcq',
      stem: 'What did the writer think Lina wanted?',
      answer: 'something to play with',
      distractors: ['new school shoes', 'a trip to the zoo', 'a birthday cake'],
      evidence: 'I thought she wanted a new toy or a game.',
    },
    {
      kind: 'tfng',
      item: 'Lina is younger than the writer.',
      answer: 'TRUE',
      evidence: 'Soon after that, my little sister Lina started to keep a secret.',
    },
    {
      kind: 'tfng',
      item: 'The writer chose green when Lina asked about colours.',
      answer: 'FALSE',
      evidence: 'I said blue, and she ran back to her room.',
    },
    {
      kind: 'gapChoice',
      stem: 'The watch from Lina was made of ______.',
      answer: 'plastic',
      distractors: ['glass', 'metal', 'paper'],
      evidence: 'It was made of plastic.',
    },
    {
      kind: 'short',
      marks: 1,
      stem: 'From Paragraph 2, how old is Lina?',
      answer: 'Eight.',
      evidence: 'She is eight.',
      rubric: '一分：答「八岁 / 8」即给分。',
    },
    {
      kind: 'short',
      marks: 1,
      stem: 'From Paragraph 8, how much did the watch cost?',
      answer: 'Twelve dollars.',
      evidence: 'It cost twelve dollars.',
      rubric: '一分：答「十二元 / 12 dollars / $12」即给分。',
    },
    {
      kind: 'short',
      marks: 2,
      stem: 'From Paragraphs 7–8, why did Lina stop buying snacks at school?',
      answer: "She was saving her money to buy the writer a watch for the writer's birthday.",
      evidence: '"I saved for six weeks," Lina said.',
      rubric:
        '两分：写出「为了存钱 / 省下零花钱」给 1 分；写出「给作者买手表 / 买生日礼物」再给 1 分。用自己的简单英文说对意思即可。',
    },
    {
      kind: 'short',
      marks: 2,
      stem: 'From Paragraph 9, why does the writer smile when looking at the watch?',
      answer: 'It makes the writer think of Lina and the six weeks she went without snacks to buy it.',
      evidence: 'When I look at it, I think of her six weeks without snacks, and I smile.',
      rubric:
        '两分：写出「想起妹妹 Lina」给 1 分；写出「想起她为了买这块表六周没买零食」再给 1 分。只写「表很好看 / 喜欢蓝色」不给分。',
    },
  ],
};

const SPECS = [FISH, LUNCHBOX, WRONG_LIST, BOY_AT_GATES, TIN];

module.exports = {
  LEVEL,
  SPECS,
  DAYS: SPECS.map((spec, i) => buildAuthoredDay(spec, DATES[i])),
};
