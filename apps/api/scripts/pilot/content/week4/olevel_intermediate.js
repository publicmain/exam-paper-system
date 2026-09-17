/**
 * 第四周 —— **olevel_intermediate（O-Level 中级）**档，全原创。
 *
 * 四百词上下的记叙文，八段。形状与第三周这一档一致：
 *   4 道情绪配对（共用八个词的词库） · 1 道短语理解四选一 · 1 道原文填空 ·
 *   4 道两分主观题 —— 满分 14。
 *
 * 情绪配对的四个时刻仍然挑「原文没有直接写出那个情绪词」的地方。
 * 选题避开了学生读过的「深水区」「代课老师」「新同学」等桥段。
 */

'use strict';

const { buildAuthoredDay, numbered } = require('../authored');
const { DATES } = require('./dates');

const LEVEL = 'olevel_intermediate';

// ═══════════════════════════════════════════════════════════════
// 周一 —— The Voice Message
// ═══════════════════════════════════════════════════════════════

const VOICE = {
  key: 'original-w4-voice-message',
  title: 'The Voice Message',
  passage: numbered([
    'On Tuesday night I was annoyed with Hui Min. She had promised to help me practise for the speaking part of our French exam, and then she had cancelled an hour before, saying she had too much homework. Twenty minutes later, she posted a photo from the cinema.',
    'I pressed the microphone button to send a voice message to Aisha, and I said exactly what I thought. I said that Hui Min only cared about herself, that she always did this, and that I was tired of being the friend she used when she was bored. It felt good to say it out loud. I let go of the button and dropped my phone on the bed.',
    'Then I saw the name at the top of the screen. It was not Aisha. It was Hui Min. Their chats were next to each other in my list, and I had tapped the wrong one.',
    'I stared at the small grey tick beside the message. One tick meant it had been sent. Two ticks meant it had arrived. I held the phone so tightly that my thumb went white, and I watched the second tick appear.',
    'There is a way to delete a message for everyone, and I did it, but the words "This message was deleted" stayed there in its place, like a sign pointing at what I had done. I typed "Sorry, wrong chat" and deleted that too. I did not sleep much.',
    'In the morning, Hui Min was waiting at the school gate. I was ready to explain, or to apologise, or to pretend that I did not know what she meant. Before I could do any of those things, she said, "I heard it before you deleted it."',
    'Then she told me something I did not know. The photo from the cinema was old; she had posted it because her cousin asked her to. She had cancelled because her father was in hospital, and she had not wanted to talk about it with anyone. "You could have asked me," she said, "instead of telling Aisha."',
    'She was right. I had been ready to believe the worst about her in the time it takes to press a button. We still practise French together on Tuesdays. When I am angry with someone now, I wait until the morning, and then I say it to their face or not at all.',
  ]),
  questions: [
    {
      kind: 'matchingFeelings',
      bank: ['resentful', 'anxious', 'horrified', 'ashamed', 'bored', 'grateful', 'amused', 'curious'],
      items: [
        { moment: "Paragraph 1 — seeing Hui Min's photo from the cinema", answer: 'resentful', para: 1 },
        { moment: 'Paragraph 6 — seeing Hui Min waiting at the school gate', answer: 'anxious', para: 6 },
        { moment: 'Paragraph 4 — watching the second tick appear', answer: 'horrified', para: 4 },
        { moment: 'Paragraph 7 — hearing why Hui Min had really cancelled', answer: 'ashamed', para: 7 },
      ],
    },
    {
      kind: 'mcq',
      stem: 'In Paragraph 5, what does "like a sign pointing at what I had done" suggest?',
      answer: 'The deleted message still showed something had been sent.',
      distractors: [
        'The writer had made a sign to show Hui Min.',
        'The message could now be read again easily.',
        'Aisha could see the message as well as Hui Min.',
      ],
      evidence:
        'There is a way to delete a message for everyone, and I did it, but the words "This message was deleted" stayed there in its place, like a sign pointing at what I had done.',
    },
    {
      kind: 'gapChoice',
      stem: 'Hui Min had cancelled because her ______ was in hospital.',
      answer: 'father',
      distractors: ['cousin', 'mother', 'brother'],
      evidence: 'She had cancelled because her father was in hospital, and she had not wanted to talk about it with anyone.',
    },
    {
      kind: 'short',
      marks: 2,
      stem: 'According to Paragraph 3, why did the voice message go to Hui Min instead of Aisha?',
      answer: "Hui Min's chat and Aisha's chat were next to each other in the list, and the writer tapped the wrong one.",
      evidence: 'Their chats were next to each other in my list, and I had tapped the wrong one.',
      rubric: '两分：写出「两人的聊天在列表里挨着」给 1 分；写出「作者点错了」再给 1 分。',
    },
    {
      kind: 'short',
      marks: 2,
      stem: 'In Paragraph 6, what was the writer ready to do at the school gate, and why did the writer not do it?',
      answer:
        'The writer was ready to explain, apologise or pretend not to understand, but Hui Min spoke first and said she had already heard the message.',
      evidence: 'Before I could do any of those things, she said, "I heard it before you deleted it."',
      rubric:
        '两分：写出作者准备好的做法（解释 / 道歉 / 装作不知道，答出任意两种即可）给 1 分；写出「Hui Min 先开口，说删之前她已经听到了」再给 1 分。',
    },
    {
      kind: 'short',
      marks: 2,
      stem: 'According to Paragraph 7, why had Hui Min posted the cinema photo, and what does this show about the night she cancelled?',
      answer:
        'It was an old photo that she posted because her cousin asked her to, so she had not really gone to the cinema that night or lied to the writer.',
      evidence: 'The photo from the cinema was old; she had posted it because her cousin asked her to.',
      rubric:
        '两分：写出「那是旧照片，是表亲让她发的」给 1 分；点明「所以她那晚并没有去看电影、没有骗作者」再给 1 分。',
    },
    {
      kind: 'short',
      marks: 2,
      stem: 'Using your own words, explain what the writer has learned in Paragraph 8.',
      answer:
        'The writer was too quick to think badly of a friend; now, when angry, the writer waits until the next day and then speaks to the person directly or says nothing.',
      evidence: 'I had been ready to believe the worst about her in the time it takes to press a button.',
      rubric:
        '两分：写出「自己一下子就把朋友往坏处想」给 1 分；写出「现在生气时等到第二天，要么当面说、要么不说」再给 1 分。',
    },
  ],
};

// ═══════════════════════════════════════════════════════════════
// 周二 —— Upside Down
// ═══════════════════════════════════════════════════════════════

const ORIENTEERING = {
  key: 'original-w4-orienteering',
  title: 'Upside Down',
  passage: numbered([
    'On the second day of our school camp, each group of four was given a map, a compass and a list of six checkpoints hidden in the park. The first group to find all six and return to the hall would win a box of chocolates and, more importantly, the right to choose the film on the last night.',
    "I was the group leader. I had been chosen because I had done orienteering once before, at my cousin's birthday, and I had told everyone about it in some detail. The other three were Dev, Sarah and a quiet boy called Marcus, who had joined our class that term.",
    'We found the first two checkpoints quickly. At the third, the path split in two. Marcus looked at the compass and said, quietly, that we should go left. I looked at the map, turned it round twice, and said we should go right. Nobody argued. I was the leader, and I sounded very sure.',
    'The right-hand path went down a hill, across a small bridge and into a part of the park that did not seem to be on the map at all. After twenty minutes, we came out at a car park. It was not a checkpoint. It was the car park where the bus had dropped us the day before.',
    'Dev sat down on the ground and said his legs had stopped working. Sarah said nothing, which was worse. I kept looking at the map as if it had changed while I was not watching it. My face was burning.',
    'Marcus waited until I lowered the map. Then he pointed out that I had been holding it upside down since the third checkpoint. He did not say it in a mean way. He said it the way you tell someone that their shoelace is undone.',
    'I could have argued. Instead, I gave him the map and the compass and said, "You lead." He took us back up the hill without saying a word about my mistake, and we found the last three checkpoints in forty minutes.',
    'We came fourth out of nine groups, so we did not choose the film. But on the bus home, Dev asked Marcus to sit with us, and he did. I have kept my orienteering stories to myself since then. Being in charge, I found out, is not the same as being right.',
  ]),
  questions: [
    {
      kind: 'matchingFeelings',
      bank: ['confident', 'embarrassed', 'grateful', 'content', 'jealous', 'terrified', 'bored', 'furious'],
      items: [
        { moment: 'Paragraph 3 — telling the group to go right', answer: 'confident', para: 3 },
        { moment: 'Paragraph 5 — staring at the map in the car park', answer: 'embarrassed', para: 5 },
        { moment: 'Paragraph 6 — realising that Marcus is pointing out the mistake kindly', answer: 'grateful', para: 6 },
        { moment: 'Paragraph 8 — on the bus home, even though the group did not win', answer: 'content', para: 8 },
      ],
    },
    {
      kind: 'mcq',
      stem: 'In Paragraph 6, what does "the way you tell someone that their shoelace is undone" suggest about how Marcus spoke?',
      answer: 'He pointed out the mistake kindly and simply.',
      distractors: [
        "He was laughing at the writer's mistake.",
        'He was too shy to say it clearly.',
        'He was worried the writer would fall.',
      ],
      evidence: 'He did not say it in a mean way.',
    },
    {
      kind: 'gapChoice',
      stem: 'At the third checkpoint, Marcus looked at the ______ and said the group should go left.',
      answer: 'compass',
      distractors: ['map', 'path', 'sign'],
      evidence: 'Marcus looked at the compass and said, quietly, that we should go left.',
    },
    {
      kind: 'short',
      marks: 2,
      stem: 'According to Paragraph 2, why was the writer chosen as group leader?',
      answer: 'The writer had done orienteering once before and had told everyone about it in detail.',
      evidence:
        "I had been chosen because I had done orienteering once before, at my cousin's birthday, and I had told everyone about it in some detail.",
      rubric: '两分：写出「作者以前玩过一次定向越野」给 1 分；写出「还跟大家详细讲过这件事」再给 1 分。',
    },
    {
      kind: 'short',
      marks: 2,
      stem: 'Using your own words, explain where the right-hand path took the group (Paragraph 4) and why this happened (Paragraph 6).',
      answer:
        'It took them away from the checkpoints to the car park where the bus had dropped them, because the writer had been holding the map upside down.',
      evidence: 'It was the car park where the bus had dropped us the day before.',
      rubric:
        '两分：写出「走到了前一天下车的停车场，不是检查点」给 1 分；写出「因为作者从第三个检查点起就把地图拿倒了」再给 1 分。',
    },
    {
      kind: 'short',
      marks: 2,
      stem: "What does the writer's decision in Paragraph 7 show about the writer?",
      answer:
        'The writer did not argue but handed the map and compass to Marcus, which shows the writer could admit being wrong and put the group first.',
      evidence: 'Instead, I gave him the map and the compass and said, "You lead."',
      rubric:
        '两分：写出「没有争辩，把地图和指南针交给 Marcus 让他带队」给 1 分；点明品质（肯认错 / 放下面子 / 以团队为重）再给 1 分。',
    },
    {
      kind: 'short',
      marks: 2,
      stem: 'In Paragraph 8, the writer says that being in charge "is not the same as being right". Explain what this means.',
      answer:
        "Being the leader did not make the writer's decisions correct; a leader should listen to people like Marcus who may know better.",
      evidence: 'Being in charge, I found out, is not the same as being right.',
      rubric: '两分：写出「当了组长不代表判断就对」给 1 分；点明「应该听取别人（如 Marcus）的意见」再给 1 分。',
    },
  ],
};

// ═══════════════════════════════════════════════════════════════
// 周三 —— Teaching My Father to Ride
// ═══════════════════════════════════════════════════════════════

const BICYCLE = {
  key: 'original-w4-teaching-father',
  title: 'Teaching My Father to Ride',
  passage: numbered([
    "My father never learned to ride a bicycle. He grew up in a flat above his parents' shop, on a busy road, and there was nowhere safe to learn. By the time he could have learned, he said, he was too busy and too old, and people would laugh.",
    'I found this out in March, when I asked if our family could ride along the park connector on Sundays. I had always thought he simply did not like cycling. My mother said yes at once. My father said he would walk beside us. When I asked why, he told me, and then he looked at the table for a long time.',
    "I decided to teach him. I had learned when I was six, so I thought it would take one afternoon. I borrowed my uncle's old bicycle, lowered the seat as far as it would go, and took my father to an empty basketball court early on a Saturday morning, before anyone else was awake.",
    'It did not take one afternoon. My father held the handlebars as if the bicycle might run away. Every time I let go of the seat, he put both feet down at once. After an hour he had travelled about ten metres in total, and he looked more tired than I have ever seen him after work.',
    'On the third Saturday, an old man stopped at the edge of the court to watch. My father saw him and got off the bicycle immediately. He said we should go home. I wanted to tell the man to go away. Instead, I told my father that the man was probably just remembering his own first ride.',
    'My father looked at me, then at the man, and got back on. The man clapped once, slowly, and walked on.',
    'Two Saturdays later, I let go of the seat near the middle of the court, and my father did not notice. He rode all the way to the far end on his own, shouting that I must not let go, while I stood behind him, waving.',
    'Now we ride along the park connector every Sunday as a family. My father is the slowest, and he rings his bell at every single person we pass. I used to think that parents already knew how to do everything. I did not know that you could watch your father being brave.',
  ]),
  questions: [
    {
      kind: 'matchingFeelings',
      bank: ['surprised', 'protective', 'amused', 'proud', 'bored', 'jealous', 'guilty', 'lonely'],
      items: [
        { moment: 'Paragraph 2 — hearing why the father would only walk', answer: 'surprised', para: 2 },
        { moment: 'Paragraph 5 — when the father gets off because an old man is watching', answer: 'protective', para: 5 },
        { moment: 'Paragraph 7 — hearing the father shout "do not let go" when the writer already has', answer: 'amused', para: 7 },
        { moment: 'Paragraph 8 — realising that the father had been brave', answer: 'proud', para: 8 },
      ],
    },
    {
      kind: 'mcq',
      stem: 'In Paragraph 4, what does "as if the bicycle might run away" suggest about the father?',
      answer: 'He was nervous and held on too tightly.',
      distractors: [
        'He thought the bicycle was too fast.',
        'He wanted to ride away from the court.',
        'He was angry with the old bicycle.',
      ],
      evidence: 'My father held the handlebars as if the bicycle might run away.',
    },
    {
      kind: 'gapChoice',
      stem: 'To make the bicycle easier for the father, the writer ______ the seat as far as it would go.',
      answer: 'lowered',
      distractors: ['raised', 'cleaned', 'fixed'],
      evidence:
        "I borrowed my uncle's old bicycle, lowered the seat as far as it would go, and took my father to an empty basketball court early on a Saturday morning, before anyone else was awake.",
    },
    {
      kind: 'short',
      marks: 2,
      stem: 'According to Paragraph 1, give TWO reasons why the father never learned to ride a bicycle.',
      answer:
        'There was nowhere safe to learn where he grew up, on a busy road; later he felt too busy and too old, and he thought people would laugh.',
      evidence:
        "He grew up in a flat above his parents' shop, on a busy road, and there was nowhere safe to learn.",
      rubric:
        '两分：以下任意两点各 1 分：小时候住在大马路边，没有安全的地方学；后来太忙；觉得年纪太大；怕别人笑话。',
    },
    {
      kind: 'short',
      marks: 2,
      stem: 'In Paragraph 3, why do you think the writer chose to go early on a Saturday morning?',
      answer:
        'So that nobody would be there to watch, because the father was afraid that people would laugh at him learning.',
      evidence:
        "I borrowed my uncle's old bicycle, lowered the seat as far as it would go, and took my father to an empty basketball court early on a Saturday morning, before anyone else was awake.",
      rubric: '两分：写出「那时没有人会看见」给 1 分；联系「爸爸怕被人笑话」再给 1 分。',
    },
    {
      kind: 'short',
      marks: 2,
      stem: 'In Paragraph 5, what did the writer say to the father, and why did it help?',
      answer:
        'The writer said the old man was probably just remembering his own first ride, so the father stopped feeling that he was being laughed at and got back on.',
      evidence: 'Instead, I told my father that the man was probably just remembering his own first ride.',
      rubric:
        '两分：写出作者的话（老人大概只是想起了自己第一次骑车）给 1 分；点明「这让爸爸不再觉得被人笑话，于是重新上车」再给 1 分。',
    },
    {
      kind: 'short',
      marks: 2,
      stem: 'Using your own words, explain how the writer now sees the father (Paragraph 8).',
      answer:
        'The writer used to think that parents could already do everything; now the writer sees that it took courage for the father to learn something new.',
      evidence: 'I did not know that you could watch your father being brave.',
      rubric: '两分：写出「以前以为父母什么都会」给 1 分；点明「现在看到爸爸学骑车需要勇气 / 很勇敢」再给 1 分。',
    },
  ],
};

// ═══════════════════════════════════════════════════════════════
// 周四 —— Is This Yours?
// ═══════════════════════════════════════════════════════════════

const TRICK = {
  key: 'original-w4-magic-trick',
  title: 'Is This Yours?',
  passage: numbered([
    'For the class talent show, I decided to do a magic trick. I had practised it for three weeks in front of the bathroom mirror: a coin held in my left hand disappears, and then comes out of the ear of someone in the audience. My younger sister had watched it forty times and still could not see how it worked.',
    'The show was in the school hall, and the whole of Secondary Two was there. I was sixth on the list, after a girl who played the violin beautifully and before a group of boys who had spent a month on a dance. My hands were cold, and I kept checking my pocket for the coin.',
    'When my turn came, I asked for a helper. Mr Chua, the art teacher, came up on stage, which I had not planned for. He was very tall. I would have to reach up to his ear, and my arm would be in the light the whole time.',
    "I showed the coin to the hall and pretended to close my left hand around it, while secretly dropping it into my right sleeve, which is how the trick works. Then I reached towards Mr Chua's ear. As I did, the coin slipped out of my sleeve, fell onto the stage and rolled, very slowly, all the way to the front, where it dropped off the edge and landed at the feet of the principal.",
    'For a moment nobody made a sound. I could hear the coin still turning on the floor. Then the principal picked it up, held it high above her head and said, "Is this yours?"',
    'The whole hall laughed. I could have run off the stage. Instead, I bowed. I said, "Thank you. For my next trick, I will make a coin appear at the feet of the principal." The hall laughed again, but this time it was a different kind of laugh.',
    'Mr Chua shook my hand as if I had planned the whole thing. The boys in the dance group told me afterwards that it was the best act of the afternoon, and I could not tell whether they were joking.',
    'I did not win. The girl with the violin won, as she deserved to. But for the rest of the term, people I did not know said "Is this yours?" when they passed me in the corridor, and I found that I did not mind at all. A trick that goes wrong, I learned, can still work, if you are the first person to laugh.',
  ]),
  questions: [
    {
      kind: 'matchingFeelings',
      bank: ['nervous', 'horrified', 'puzzled', 'content', 'jealous', 'bored', 'guilty', 'furious'],
      items: [
        { moment: "Paragraph 2 — waiting for the writer's turn in the hall", answer: 'nervous', para: 2 },
        { moment: 'Paragraph 5 — hearing the coin turning on the floor', answer: 'horrified', para: 5 },
        { moment: 'Paragraph 7 — listening to the boys from the dance group', answer: 'puzzled', para: 7 },
        { moment: 'Paragraph 8 — when strangers say "Is this yours?" in the corridor', answer: 'content', para: 8 },
      ],
    },
    {
      kind: 'mcq',
      stem: 'In Paragraph 6, what does "a different kind of laugh" suggest?',
      answer: 'The audience was now laughing with the writer, not at the writer.',
      distractors: [
        'The audience was laughing more quietly than before.',
        'The principal had started laughing at the writer.',
        'The dance group was laughing at the violin player.',
      ],
      evidence: 'The hall laughed again, but this time it was a different kind of laugh.',
    },
    {
      kind: 'gapChoice',
      stem: "The coin fell out of the writer's ______ and rolled to the front of the stage.",
      answer: 'sleeve',
      distractors: ['pocket', 'hand', 'shoe'],
      evidence:
        'As I did, the coin slipped out of my sleeve, fell onto the stage and rolled, very slowly, all the way to the front, where it dropped off the edge and landed at the feet of the principal.',
    },
    {
      kind: 'short',
      marks: 2,
      stem: 'According to Paragraph 3, why was it a problem that Mr Chua came up on stage?',
      answer:
        'He was very tall, so the writer would have to reach up to his ear with his arm in the light the whole time, and the trick would be easier to see through.',
      evidence: 'I would have to reach up to his ear, and my arm would be in the light the whole time.',
      rubric:
        '两分：写出「Mr Chua 个子很高」给 1 分；写出「作者得伸手去够他的耳朵，手臂一直在灯光下（容易露馅）」再给 1 分。',
    },
    {
      kind: 'short',
      marks: 2,
      stem: "What does the writer's reaction in Paragraph 6 show about the writer?",
      answer:
        'Instead of running away, he bowed and made a joke about the mistake, which shows he could stay calm and turn an embarrassing moment into something funny.',
      evidence: 'Instead, I bowed.',
      rubric:
        '两分：写出「没有跑下台，而是鞠躬、拿这次失误开玩笑」给 1 分；点明品质（临场镇定 / 有幽默感 / 能化解尴尬）再给 1 分。',
    },
    {
      kind: 'short',
      marks: 2,
      stem: "According to Paragraph 8, what shows that people remembered the writer's act, and how did the writer feel about it?",
      answer:
        'For the rest of the term, students he did not know repeated the question the principal had asked when they passed him, and he did not mind at all.',
      evidence:
        'But for the rest of the term, people I did not know said "Is this yours?" when they passed me in the corridor, and I found that I did not mind at all.',
      rubric:
        '两分：写出「整个学期都有不认识的人在走廊上对他说 Is this yours?」给 1 分；写出「他一点也不介意」再给 1 分。',
    },
    {
      kind: 'short',
      marks: 2,
      stem: 'Using your own words, explain the lesson the writer learned at the end of the story.',
      answer:
        'Even when something goes wrong in front of other people, it can still turn out well, as long as you laugh at yourself first.',
      evidence: 'A trick that goes wrong, I learned, can still work, if you are the first person to laugh.',
      rubric: '两分：写出「当众出了差错也可能变成好事」给 1 分；点明「前提是自己先笑出来 / 先自嘲」再给 1 分。',
    },
  ],
};

// ═══════════════════════════════════════════════════════════════
// 周五 —— The Egg Drop
// ═══════════════════════════════════════════════════════════════

const EGG = {
  key: 'original-w4-egg-drop',
  title: 'The Egg Drop',
  passage: numbered([
    'Our physics teacher, Mrs Wong, gave us a challenge: protect a raw egg so that it could be dropped from the third floor of the science block without breaking. We could use only paper, string, tape and two plastic bags. We had one week.',
    'I took it very seriously. I read about how cars are designed to protect people in crashes, and I drew plans. My final design had a paper cage inside a paper cage, with the egg hanging in the middle on eight pieces of string, and a parachute made from both bags. It took me four evenings to build. It was beautiful.',
    'Nadia, who sits next to me, said she had her own idea, but she did not seem to be working very hard on it. On the day before the test, she was still sitting at her desk, calmly folding paper into long, thin strips.',
    'On the morning of the test, a Tuesday, the whole class stood in the car park and looked up. Mrs Wong dropped the designs one by one from the third-floor corridor. The first four eggs broke. Some people covered their eyes.',
    'Mine was sixth. The parachute opened beautifully, and for two seconds it floated down exactly as I had planned. Then a light wind caught it and carried it sideways, into the branches of a tree, where it stayed. Mrs Wong had to get it down with a broom. The egg was fine, but it had not landed, so it did not count.',
    "Nadia's was ninth. It was a ball of folded paper strips about the size of a football, with the egg somewhere in the middle. It had no parachute. It fell straight down, hit the ground hard, bounced twice and rolled against the wall. When Mrs Wong opened it, the egg was perfect.",
    'I asked Nadia how she had thought of it. She said the strips would bend when it landed and take the force instead of the egg, and that she had not used a parachute because it was always windy on Tuesdays. I had not once thought about the weather.',
    'Mrs Wong gave Nadia full marks, and she gave me a mark for the design and a note: "Beautiful. Now test it outside." I kept the note. My designs are less beautiful these days, but I test them in the real world before I believe in them.',
  ]),
  questions: [
    {
      kind: 'matchingFeelings',
      bank: ['proud', 'doubtful', 'frustrated', 'impressed', 'bored', 'terrified', 'guilty', 'furious'],
      items: [
        { moment: 'Paragraph 2 — looking at the finished design', answer: 'proud', para: 2 },
        { moment: 'Paragraph 3 — watching Nadia fold paper the day before the test', answer: 'doubtful', para: 3 },
        { moment: 'Paragraph 5 — seeing the design stuck in the tree', answer: 'frustrated', para: 5 },
        { moment: "Paragraph 7 — hearing Nadia's reasons for her design", answer: 'impressed', para: 7 },
      ],
    },
    {
      kind: 'mcq',
      stem: 'In Paragraph 8, what does Mrs Wong mean by "Now test it outside"?',
      answer: 'The design should be tried in real conditions.',
      distractors: [
        'The design should be built again outside.',
        'The writer should do the test again tomorrow.',
        'The writer should take the design home.',
      ],
      evidence: 'My designs are less beautiful these days, but I test them in the real world before I believe in them.',
    },
    {
      kind: 'gapChoice',
      stem: "Nadia's design was a ball of folded paper strips about the size of a ______.",
      answer: 'football',
      distractors: ['basketball', 'tennis ball', 'watermelon'],
      evidence: 'It was a ball of folded paper strips about the size of a football, with the egg somewhere in the middle.',
    },
    {
      kind: 'short',
      marks: 2,
      stem: 'According to Paragraph 1, what did the students have to do, and what were they allowed to use?',
      answer:
        'They had to protect a raw egg so that it would not break when dropped from the third floor, using only paper, string, tape and two plastic bags.',
      evidence: 'We could use only paper, string, tape and two plastic bags.',
      rubric:
        '两分：写出任务（保护生鸡蛋从三楼落下不碎）给 1 分；写出可用的材料（纸、绳子、胶带、两个塑料袋，答出其中三样即可）再给 1 分。',
    },
    {
      kind: 'short',
      marks: 2,
      stem: "According to Paragraph 5, why did the writer's egg not count, even though it did not break?",
      answer: 'The wind blew the design into a tree, so it never landed on the ground.',
      evidence: 'The egg was fine, but it had not landed, so it did not count.',
      rubric: '两分：写出「风把它吹到了树上」给 1 分；写出「没有落到地上，所以不算」再给 1 分。',
    },
    {
      kind: 'short',
      marks: 2,
      stem: "Using your own words, explain why Nadia's design worked (Paragraph 7).",
      answer:
        'The paper strips bent when the ball hit the ground and took the force instead of the egg, and she used no parachute because the wind would have blown it away.',
      evidence:
        'She said the strips would bend when it landed and take the force instead of the egg, and that she had not used a parachute because it was always windy on Tuesdays.',
      rubric:
        '两分：写出「纸条落地时弯折、替鸡蛋吸收了冲击」给 1 分；写出「不用降落伞，因为那天总是有风」再给 1 分。',
    },
    {
      kind: 'short',
      marks: 2,
      stem: 'How has the writer changed since the test (Paragraph 8), and why?',
      answer:
        'The writer now tries designs out in real conditions before trusting them, because the beautiful design failed when the real weather was ignored.',
      evidence: 'My designs are less beautiful these days, but I test them in the real world before I believe in them.',
      rubric:
        '两分：写出「现在先在真实环境里试过，才相信自己的设计」给 1 分；点明原因（上次只顾好看、没考虑天气 / 老师那张纸条的提醒）再给 1 分。',
    },
  ],
};

const SPECS = [VOICE, ORIENTEERING, BICYCLE, TRICK, EGG];

module.exports = {
  LEVEL,
  SPECS,
  DAYS: SPECS.map((spec, i) => buildAuthoredDay(spec, DATES[i])),
};
