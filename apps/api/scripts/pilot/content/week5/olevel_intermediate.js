/**
 * 第五周 —— **olevel_intermediate（O-Level 中级）**档，全原创。
 *
 * 四百词上下的记叙文，八段。形状与第四周这一档一致：
 *   4 道情绪配对（共用八个词的词库） · 1 道短语理解四选一 · 1 道原文填空 ·
 *   4 道两分主观题 —— 满分 14。
 *
 * 情绪配对的四个时刻仍然挑「原文没有直接写出那个情绪词」的地方，并且每个
 * 时刻在本段内都有叙述者自己的反应（动作、表情、心里话）作依据。
 * 选题先对过学生已读的 225 个标题；本周偏学校生活、社团、比赛、朋友、网上的事，
 * 结局刻意不全是「犯错 — 被点破 — 学到教训」。
 */

'use strict';

const { buildAuthoredDay, numbered } = require('../authored');
const { DATES } = require('./dates');

const LEVEL = 'olevel_intermediate';

// ═══════════════════════════════════════════════════════════════
// 周一 —— The Orange Flame
// ═══════════════════════════════════════════════════════════════

const FLAME = {
  key: 'original-w5-orange-flame',
  title: 'The Orange Flame',
  passage: numbered([
    'In Secondary Two, my friend Kavya and I began learning Korean on an app that had something called a friend streak. Every day, both of us had to finish at least one short lesson before midnight, and the number beside a small orange flame went up by one. If either of us missed a single day, the flame would go out and the number would go back to zero.',
    'For almost a year, neither of us missed. We did lessons on buses, in the canteen queue and once in a hospital waiting room. I took a screenshot of the flame every hundred days and sent it to anyone who would look. The number became the first thing I checked every morning.',
    "Our number was at 364 on the day Kavya flew to Perth for her cousin's wedding. One more day would make it a full year. Before she left, she promised to do her lesson at the airport. At ten that night she still had not done it, and my messages to her were not being delivered. By eleven I had stopped pretending to do homework and was walking up and down my room, checking the app every few minutes.",
    "Then I remembered my old tablet. After Kavya's phone fell into a drain in March, she had borrowed it for a week and never logged out of the app. Her account was still there. I could finish a lesson in her name, and nobody would ever know. There was no way to ask her. I had the tablet in my hands before I had finished the thought.",
    'At 11.40 her lesson was open in front of me. My thumb stayed above the screen for a long time. I thought about the screenshot I would send when we reached 365, and I realised that every time I looked at that number, I would know that one of the days was mine twice. At 11.52 I put the tablet face down on my desk.',
    'At midnight the flame went out. The number beside it dropped from 364 to 0, and a cheerful message said that every great streak begins with day one. I switched off the light, lay on my bed and stared at the dark ceiling for a long time.',
    'Kavya\'s message arrived the next afternoon. The airport Wi-Fi had not worked, and her phone had no data. Then she wrote: "Wait, my account is still on your tablet. Why didn\'t you just do it for me? I would have done it for you." Of all the replies I had imagined, this was not one of them. I read the line three times, sure that I had misread it.',
    'I tried to explain, and I am still not sure she understood. She says it was a silly way to lose almost a year. We started again that evening, and our new flame is at 57 today. It is a much smaller number, but when I check it each morning, I know that every single day of it really happened.',
  ]),
  questions: [
    {
      kind: 'matchingFeelings',
      bank: ['proud', 'anxious', 'disappointed', 'surprised', 'jealous', 'bored', 'impressed', 'amused'],
      items: [
        { moment: 'Paragraph 2 — sending screenshots of the flame to anyone who would look', answer: 'proud', para: 2 },
        { moment: 'Paragraph 3 — walking up and down the room at eleven o\'clock', answer: 'anxious', para: 3 },
        { moment: 'Paragraph 6 — watching the number drop from 364 to 0', answer: 'disappointed', para: 6 },
        { moment: "Paragraph 7 — reading Kavya's question about the tablet", answer: 'surprised', para: 7 },
      ],
    },
    {
      kind: 'mcq',
      stem: 'In Paragraph 4, what does "I had the tablet in my hands before I had finished the thought" suggest?',
      answer: 'The writer acted almost without thinking.',
      distractors: [
        'The writer had planned this for a long time.',
        'The writer could not remember the password.',
        'The writer wanted to show the tablet to Kavya.',
      ],
      evidence: 'I had the tablet in my hands before I had finished the thought.',
    },
    {
      kind: 'gapChoice',
      stem: 'Before she left, Kavya promised to do her lesson at the ______.',
      answer: 'airport',
      distractors: ['wedding', 'hotel', 'hospital'],
      evidence: 'Before she left, she promised to do her lesson at the airport.',
    },
    {
      kind: 'short',
      marks: 2,
      stem: 'According to Paragraph 1, what did both friends have to do every day, and what would happen if one of them missed a day?',
      answer:
        'Each of them had to finish at least one short lesson before midnight; if either of them missed a day, the flame would go out and the number would go back to zero.',
      evidence: 'If either of us missed a single day, the flame would go out and the number would go back to zero.',
      rubric:
        '两分：写出「两人每天都要在午夜前完成至少一节短课」给 1 分；写出「只要有一人漏掉一天，火苗就会熄灭、数字归零」再给 1 分。',
    },
    {
      kind: 'short',
      marks: 2,
      stem: "According to Paragraph 4, why was it possible for the writer to do a lesson in Kavya's name?",
      answer:
        "Kavya had borrowed the writer's old tablet for a week after her phone fell into a drain, and she had never logged out of the app, so her account was still on it.",
      evidence:
        "After Kavya's phone fell into a drain in March, she had borrowed it for a week and never logged out of the app.",
      rubric:
        '两分：写出「Kavya 以前（手机掉进水沟后）借用过作者的旧平板」给 1 分（不要求写出水沟）；写出「她一直没有退出这个 app，账号还登录在平板上」再给 1 分。',
    },
    {
      kind: 'short',
      marks: 2,
      stem: 'Using your own words, explain why the writer put the tablet down instead of doing the lesson (Paragraph 5).',
      answer:
        "If the writer did it, one of the days would really be the writer's work for both of them, and every time the writer looked at the number, the writer would know that it was not completely true.",
      evidence:
        'I thought about the screenshot I would send when we reached 365, and I realised that every time I looked at that number, I would know that one of the days was mine twice.',
      rubric:
        '两分：写出「那一天两个人的课其实都是作者一个人做的（Kavya 并没有真的做）」给 1 分；写出「以后每次看到这个数字，作者都会知道它不完全是真的」再给 1 分。',
    },
    {
      kind: 'short',
      marks: 2,
      stem: 'In Paragraph 7, what did Kavya think the writer should have done, and what did she say she would have done herself?',
      answer:
        'She thought the writer should simply have done the lesson for her, and she said she would have done the same for the writer.',
      evidence: "Why didn't you just do it for me? I would have done it for you.",
      rubric:
        '两分：写出「她认为作者直接替她把那节课做了就好」给 1 分；写出「她说换成她，她也会替作者做」再给 1 分。',
    },
  ],
};

// ═══════════════════════════════════════════════════════════════
// 周二 —— Behind the Encyclopedias
// ═══════════════════════════════════════════════════════════════

const ENCYCLOPEDIAS = {
  key: 'original-w5-behind-encyclopedias',
  title: 'Behind the Encyclopedias',
  passage: numbered([
    'Every Monday, someone from the library council checks that every book is on the right shelf. It is the most boring job, so it always goes to the newest member. This year, that was me.',
    'In my second week, I found a thick novel lying behind the encyclopedias, where nobody ever goes. It was the last book of a popular fantasy series. An old bus ticket was inside it, about fifty pages from the start. I put it back in the fiction section.',
    'The next Monday it was behind the encyclopedias again, and the bus ticket had moved forward by about sixty pages. The Monday after that, it had moved another sixty. Someone was reading the book in the library, a little at a time. From then on, I checked behind the encyclopedias before I did anything else, and I kept trying to guess who it was.',
    'On Wednesday I spent lunchtime at a table with a clear view of that corner. After ten minutes, Hafiz from the class next door came in and looked around the room like someone in a spy film. He pulled the book out, read for exactly twenty minutes, slid the ticket back in and hid the book again. I had to cover my mouth to stop myself from laughing.',
    'The next day I was waiting for him. "You know you can just borrow it," I said. He went red. It was the last book in the series, he explained. If he took it home, he would finish it in one night, and then there would be nothing left to look forward to. So he read one chapter every lunchtime and hid the book so that nobody else could borrow it.',
    'I knew the rules. Every book belongs on its shelf. Instead, I heard myself telling him that the encyclopedias were a bad hiding place, because I checked there every Monday. The old atlases would be safer, I said. He stared at me, and then he grinned.',
    'A few weeks later, a Secondary One girl asked me for the same book. The computer said it was on the shelf. I walked slowly along the fiction section, pretending to search, while my face grew hotter and hotter. In the end I told her the truth: someone was reading it. I promised to keep it for her.',
    'On the last day of term, the book was back in the fiction section, with the bus ticket on the last page. On the back, Hafiz had written: "Thank you. Your turn." I read it twice and put it in my wallet, where it still is. The girl got the book first, as promised. Now I am reading the first book of the series, one chapter every lunchtime. There are four copies, so I do not need to hide it. I hide it behind the atlases anyway.',
  ]),
  questions: [
    {
      kind: 'matchingFeelings',
      bank: ['curious', 'amused', 'guilty', 'touched', 'jealous', 'furious', 'bored', 'frightened'],
      items: [
        { moment: 'Paragraph 3 — noticing that the bus ticket has moved forward again', answer: 'curious', para: 3 },
        { moment: 'Paragraph 4 — watching Hafiz hide the book again', answer: 'amused', para: 4 },
        { moment: 'Paragraph 7 — walking along the fiction section while the girl waits', answer: 'guilty', para: 7 },
        { moment: 'Paragraph 8 — reading the message on the back of the ticket', answer: 'touched', para: 8 },
      ],
    },
    {
      kind: 'mcq',
      stem: 'In Paragraph 4, what does "looked around the room like someone in a spy film" suggest about Hafiz?',
      answer: 'He did not want anyone to see what he did.',
      distractors: [
        'He was looking for his friends in the library.',
        'He had never been inside the library before.',
        'He enjoyed watching films about spies.',
      ],
      evidence: 'After ten minutes, Hafiz from the class next door came in and looked around the room like someone in a spy film.',
    },
    {
      kind: 'gapChoice',
      stem: 'Hafiz read the book for exactly ______ minutes before he hid it again.',
      answer: 'twenty',
      distractors: ['ten', 'sixty', 'fifty'],
      evidence: 'He pulled the book out, read for exactly twenty minutes, slid the ticket back in and hid the book again.',
    },
    {
      kind: 'short',
      marks: 2,
      stem: 'According to Paragraph 3, how could the writer tell that someone was reading the book a little at a time?',
      answer:
        'The book kept appearing behind the encyclopedias again every Monday, and each week the bus ticket inside it had moved forward by about sixty pages.',
      evidence:
        'The next Monday it was behind the encyclopedias again, and the bus ticket had moved forward by about sixty pages.',
      rubric:
        '两分：写出「每周一书又回到百科全书后面」给 1 分；写出「书里的车票每周往后挪了大约六十页」再给 1 分。两点各算一次：把「车票往后挪」换个说法写两遍，只给 1 分。',
    },
    {
      kind: 'short',
      marks: 2,
      stem: 'Using your own words, explain why Hafiz did not want to take the book home (Paragraph 5).',
      answer:
        'He knew he would read the whole book in a single night, and because it was the final book of the series, he would then have nothing more to enjoy.',
      evidence:
        'If he took it home, he would finish it in one night, and then there would be nothing left to look forward to.',
      rubric:
        '两分：写出「带回家他一个晚上就会读完」给 1 分；写出「这是系列最后一本，读完就再没有可期待的了」再给 1 分。',
    },
    {
      kind: 'short',
      marks: 2,
      stem: 'What does the advice the writer gives Hafiz in Paragraph 6 show about the writer?',
      answer:
        'Instead of telling Hafiz to follow the rules, the writer suggested a safer hiding place behind the old atlases, which shows that the writer understood him and was willing to help him keep his secret.',
      evidence:
        'Instead, I heard myself telling him that the encyclopedias were a bad hiding place, because I checked there every Monday.',
      rubric:
        '两分：写出「作者没有按规定让他把书放回书架，反而告诉他更安全的藏法（藏到旧地图册后面）」给 1 分；点明品质再给 1 分：写 kind / understanding / sympathetic / caring，或「体谅 Hafiz、愿意帮他保守秘密」等意思都给分。',
    },
    {
      kind: 'short',
      marks: 2,
      stem: 'In Paragraph 8, what does the writer now do that is the same as what Hafiz did?',
      answer:
        'The writer reads the first book of the series one chapter every lunchtime, and hides it behind the atlases, even though there is no need to.',
      evidence: 'Now I am reading the first book of the series, one chapter every lunchtime.',
      rubric:
        '两分：写出「每天午饭时间只读一章」给 1 分；写出「把书藏在旧地图册后面（虽然根本不需要藏）」再给 1 分。',
    },
  ],
};

// ═══════════════════════════════════════════════════════════════
// 周三 —— Sub-Twenty
// ═══════════════════════════════════════════════════════════════

const SUB_TWENTY = {
  key: 'original-w5-sub-twenty',
  title: 'Sub-Twenty',
  passage: numbered([
    "Among people who solve Rubik's Cubes for speed, \"sub-twenty\" means finishing in less than twenty seconds. At home, I had done it hundreds of times. At competitions, I had never done it once. My best competition time was 24.6 seconds, because as soon as a judge stood next to me, my hands seemed to forget everything they knew.",
    'The rules give every competitor fifteen seconds to study the mixed-up cube before the timer starts. Most good solvers use all fifteen to plan their first moves. I never did. I always started after five or six, because I could not stand sitting there with everyone waiting.',
    'Last Saturday\'s competition was in a school hall in Jurong, and each of us had five solves. On my first, my heart was beating so loudly that I could hardly hear the cube, and I finished in 27 seconds. On my second, I turned too hard, and a corner piece flew off and rolled under a table. I had to crawl after it while the timer kept running. The time was 41 seconds.',
    'During the break, my friend Wei Ming sat down beside me. He has been competing for three years, and he said only one thing: "Use all fifteen seconds. Count them if you have to." I shrugged. I could not see how ten more seconds of looking would stop my hands from shaking. But I had nothing better to try.',
    'On my third solve, I made myself keep looking until the judge called, "Twelve seconds." By then I had planned my first four moves, and my hands did them without shaking. The time was 22.3. On the fourth, it was 21.1. Each time, I stared at the number and hit my knee with my fist. I was so close.',
    'Before my last solve, I breathed out slowly. I counted all fifteen seconds and never once looked at the judge. The solve felt slow, almost lazy, and when I slapped the timer to stop it, I did not dare to look down.',
    'The judge turned the timer towards me. It said 19.84. I stared at the screen with my mouth open and could not say anything. The judge smiled and wrote the time on my scorecard. Then Wei Ming, who was supposed to be waiting quietly for his own turn, jumped up and shouted my name across the hall.',
    'My average was just over 23 seconds, and I came twenty-sixth out of forty. On the way home, my mother asked why I kept smiling at a piece of paper that said twenty-sixth. I tried to explain that, for the first time, the person at the competition had been as fast as the person in my bedroom. The scorecard is now stuck to the wall above my desk.',
  ]),
  questions: [
    {
      kind: 'matchingFeelings',
      bank: ['nervous', 'doubtful', 'astonished', 'proud', 'disappointed', 'jealous', 'bored', 'guilty'],
      items: [
        { moment: 'Paragraph 3 — starting the first solve', answer: 'nervous', para: 3 },
        { moment: "Paragraph 4 — listening to Wei Ming's advice", answer: 'doubtful', para: 4 },
        { moment: 'Paragraph 7 — seeing 19.84 on the timer', answer: 'astonished', para: 7 },
        { moment: 'Paragraph 8 — smiling at the scorecard on the way home', answer: 'proud', para: 8 },
      ],
    },
    {
      kind: 'mcq',
      stem: 'In Paragraph 1, what does "my hands seemed to forget everything they knew" suggest?',
      answer: 'The writer could not do as well while being watched.',
      distractors: [
        'The writer had not practised enough at home.',
        'The writer had hurt both hands before the event.',
        'The judge asked the writer to use new moves.',
      ],
      evidence:
        'My best competition time was 24.6 seconds, because as soon as a judge stood next to me, my hands seemed to forget everything they knew.',
    },
    {
      kind: 'gapChoice',
      stem: "The writer's scorecard is now stuck to the wall above the writer's ______.",
      answer: 'desk',
      distractors: ['bed', 'door', 'window'],
      evidence: 'The scorecard is now stuck to the wall above my desk.',
    },
    {
      kind: 'short',
      marks: 2,
      stem: 'According to Paragraph 2, how did the writer use the fifteen seconds differently from most good solvers, and why?',
      answer:
        'Most good solvers use all fifteen seconds to plan their first moves, but the writer always started after only five or six, because the writer could not stand sitting there with everyone waiting.',
      evidence: 'I always started after five or six, because I could not stand sitting there with everyone waiting.',
      rubric:
        '两分：写出「别人用足十五秒计划开头几步，作者五六秒就开始」给 1 分；写出原因「受不了大家都等着、自己干坐在那里」再给 1 分。',
    },
    {
      kind: 'short',
      marks: 2,
      stem: "Give TWO things that went wrong in the writer's first two solves (Paragraph 3).",
      answer:
        "In the first solve, the writer's heart was beating so loudly that the time was only 27 seconds; in the second, a corner piece flew off and rolled under a table, and the writer had to crawl after it while the timer kept running.",
      evidence:
        'On my second, I turned too hard, and a corner piece flew off and rolled under a table.',
      rubric:
        '两分：两点必须分别来自两次失误 —— 第一把写出「心跳得太响 / 只做出 27 秒」给 1 分；第二把写出「拧得太用力，角块飞出去滚到桌子底下，只好爬过去捡、计时一直在走（41 秒）」再给 1 分。只写同一次失误、拆成两点的，只给 1 分。',
    },
    {
      kind: 'short',
      marks: 2,
      stem: 'According to Paragraph 5, what did the writer do differently in the third solve, and how did it help?',
      answer:
        'The writer kept looking at the cube until the judge called "Twelve seconds" and planned the first four moves, so the writer\'s hands did those moves without shaking.',
      evidence: 'By then I had planned my first four moves, and my hands did them without shaking.',
      rubric:
        '两分：写出「一直看到裁判喊 Twelve seconds（多用了观察时间），想好了前四步」给 1 分；写出「手做这几步时不再发抖（成绩提高到 22.3 秒）」再给 1 分。',
    },
    {
      kind: 'short',
      marks: 2,
      stem: 'Using your own words, explain what the writer means by "the person at the competition had been as fast as the person in my bedroom" (Paragraph 8).',
      answer:
        'At home the writer could already solve the cube in under twenty seconds; this was the first time the writer managed the same speed at a real competition, with a judge watching.',
      evidence:
        'I tried to explain that, for the first time, the person at the competition had been as fast as the person in my bedroom.',
      rubric:
        '两分：写出「在家练习时作者本来就能进 20 秒」给 1 分；写出「这是第一次在正式比赛、有人看着的时候也做到同样快」再给 1 分。',
    },
  ],
};

// ═══════════════════════════════════════════════════════════════
// 周四 —— The Cheapest Thing on the Menu
// ═══════════════════════════════════════════════════════════════

const CHEAPEST = {
  key: 'original-w5-cheapest-thing',
  title: 'The Cheapest Thing on the Menu',
  passage: numbered([
    'Every Friday after school, Aisyah, Deepa, Shu Ting and I went to the bubble tea shop in the mall across the road. We always took the same corner table and stayed until the sky outside turned orange. It was the best hour of my week.',
    'In July, Shu Ting started ordering plain green tea, the cheapest thing on the menu. She said she was cutting down on sugar. The next week she had the same, and the week after that she said she was not thirsty and only asked for a cup of water. Nobody cuts down on sugar in a bubble tea shop, I thought, and I watched her over the top of my cup.',
    'Then I remembered something she had said at the start of term, very quickly, before she changed the subject: her father was "between jobs". I did the sums. Six dollars every Friday was twenty-four dollars a month. I thought of her standing in front of the menu, doing the same sums, every single week. My own drink suddenly tasted far too sweet.',
    'I could not offer to pay for her. She would hate that, and the others would notice. I could not tell Aisyah and Deepa either. Whatever I did, it had to look as if it had nothing to do with Shu Ting.',
    'So the next Friday, I told everyone that my mother said I was spending too much, and asked whether we could meet at the park instead and bring food from home. I had practised the sentence in front of the mirror, but I still said it too fast, and I kept my eyes on the table. Deepa groaned. Aisyah said it would be like primary school. Shu Ting said nothing at all.',
    'The first Friday in the park felt strange. Then Aisyah opened a box of her mother\'s kuih, Deepa brought a bag of rambutans, and Shu Ting arrived with a big bottle of iced lemon tea that she had made herself. Nobody had to keep buying drinks to keep our seats, so we stayed until it was too dark to see each other\'s faces.',
    'A few weeks later, while the others were arguing about a film, Shu Ting poured me some of her lemon tea and said quietly, "Your mother, huh?" I looked up. She was smiling. "My mother," I said. She nodded, and that was all.',
    'Her father has found a new job since then. We could go back to the bubble tea shop now, but nobody has suggested it. On Fridays we still sit in the park, and Shu Ting still pours my cup first. Neither of us has ever said why, and I hope we never do.',
  ]),
  questions: [
    {
      kind: 'matchingFeelings',
      bank: ['puzzled', 'sympathetic', 'nervous', 'content', 'jealous', 'furious', 'bored', 'lonely'],
      items: [
        { moment: 'Paragraph 2 — hearing Shu Ting ask for a cup of water', answer: 'puzzled', para: 2 },
        { moment: "Paragraph 3 — when the writer's own drink suddenly tastes too sweet", answer: 'sympathetic', para: 3 },
        { moment: 'Paragraph 5 — suggesting the park to the group', answer: 'nervous', para: 5 },
        { moment: 'Paragraph 8 — sitting in the park on Fridays now', answer: 'content', para: 8 },
      ],
    },
    {
      kind: 'mcq',
      stem: 'In Paragraph 7, what does Shu Ting\'s question "Your mother, huh?" suggest?',
      answer: 'She had guessed the real reason for the change.',
      distractors: [
        "She wanted to meet the writer's mother.",
        "She thought the writer's mother was too strict.",
        'She was angry that the writer had lied to her.',
      ],
      evidence: 'Shu Ting poured me some of her lemon tea and said quietly, "Your mother, huh?"',
    },
    {
      kind: 'gapChoice',
      stem: 'At the bubble tea shop, the friends always took the same ______ table.',
      answer: 'corner',
      distractors: ['round', 'window', 'back'],
      evidence: 'We always took the same corner table and stayed until the sky outside turned orange.',
    },
    {
      kind: 'short',
      marks: 2,
      stem: 'According to Paragraph 2, what TWO different reasons did Shu Ting give, one after the other, for ordering so little?',
      answer:
        'First she said she was cutting down on sugar, when she ordered plain green tea; later she said she was not thirsty, when she asked only for a cup of water.',
      evidence: 'She said she was cutting down on sugar.',
      rubric:
        '两分：写出第一个理由「在少吃糖（所以点清绿茶）」给 1 分；写出后来的理由「不渴（所以只要一杯水）」再给 1 分。只写她点了什么、没写理由，不给分。',
    },
    {
      kind: 'short',
      marks: 2,
      stem: 'According to Paragraph 4, why could the writer not simply offer to pay for Shu Ting?',
      answer: 'Shu Ting would hate it, and the others would notice.',
      evidence: 'She would hate that, and the others would notice.',
      rubric: '两分：写出「Shu Ting 会很讨厌这样」给 1 分；写出「其他人会注意到」再给 1 分。',
    },
    {
      kind: 'short',
      marks: 2,
      stem: 'Using your own words, explain why the writer blamed the writer\'s mother when suggesting the park (Paragraphs 4–5).',
      answer:
        'By saying that the writer\'s mother thought the writer was spending too much, the writer made the change seem like the writer\'s own problem, so that it did not look connected to Shu Ting and nobody would guess that she was short of money.',
      evidence: 'Whatever I did, it had to look as if it had nothing to do with Shu Ting.',
      rubric:
        '两分：写出「搬出妈妈嫌作者花钱多，让这个改变看起来是作者自己的原因」给 1 分；写出「这样就看不出和 Shu Ting 有关 / 不会让大家注意到她缺钱」再给 1 分。',
    },
    {
      kind: 'short',
      marks: 2,
      stem: 'Give TWO things from Paragraph 6 that made the first Friday in the park a success.',
      answer:
        'Everyone brought something, including Shu Ting, who made her own iced lemon tea; and because nobody had to keep buying drinks to keep their seats, they could stay until it was dark.',
      evidence:
        "Nobody had to keep buying drinks to keep our seats, so we stayed until it was too dark to see each other's faces.",
      rubric:
        '两分：写出「每个人都带了吃的喝的」（Aisyah 的糕点 / Deepa 的红毛丹 / Shu Ting 自己做的冰柠檬茶，合起来只算一点，写出其中一样即可）给 1 分；写出「不用一直花钱买饮料才能占着座位，大家一直待到天黑」再给 1 分。',
    },
  ],
};

// ═══════════════════════════════════════════════════════════════
// 周五 —— Two Places at Once
// ═══════════════════════════════════════════════════════════════

const TWO_PLACES = {
  key: 'original-w5-two-places',
  title: 'Two Places at Once',
  passage: numbered([
    'At the start of Secondary Three, I could not decide between Drama Club and Photography Club. Both met on Wednesdays from three to five, and each teacher wanted an answer by Friday. So I did something that seemed very clever at the time. I joined both, and I told neither teacher about the other.',
    'Drama met in the hall and Photography met in the art room, at opposite ends of the school. I stayed for the drama warm-up, told Mr Rahman I had a meeting, ran across the courtyard to the art room, and ran back for the last half hour. For three weeks it worked. I began to think I could keep it up for the whole year, and I grinned all the way home every Wednesday.',
    'Then Mr Rahman gave me the part of the king in the school play, and Ms Tan gave us a photo project that was due every week. I learned my lines on the bus and read about camera settings in bed. Every Wednesday night I lay awake, going through the list of everything I had not done.',
    "On the sixth Wednesday, we rehearsed in costume for the first time. Halfway through, I remembered that my photos had to be handed in before the end of Ms Tan's session. There was no time to change, so I ran across the courtyard in a paper crown and a long red cape. Everyone in the art room stared.",
    'The next Wednesday, Ms Tan put the best photo of the week on the screen. The topic was "movement". It showed a blurred figure in a crown and a cape, running across the courtyard, taken from a window by a Secondary One girl. Everyone clapped. Then, one by one, they turned to look at me. I slid so far down in my chair that my knees hit the desk in front of me.',
    'Ms Tan looked at the screen, then at me. After class, she and Mr Rahman were waiting for me together. I had prepared a long speech, but neither of them seemed angry. Mr Rahman said that I could not be in two places at once, however fast I ran, and that I had until next Wednesday to choose. I let out a breath I had been holding for weeks.',
    'I spent the week making lists. Drama had the king, the stage and most of my friends. Photography had the camera, the quiet and the art room. Both lists were exactly the same length. In the end, I chose by looking at the Secondary One girl\'s photo again. I wanted to be the person at the window, not the person running past it.',
    'In November, I sat in the front row at the school play with the club\'s camera and took pictures of the new king. The best one is a little blurred. I have decided that this is my style.',
  ]),
  questions: [
    {
      kind: 'matchingFeelings',
      bank: ['confident', 'overwhelmed', 'embarrassed', 'relieved', 'jealous', 'bored', 'furious', 'lonely'],
      items: [
        { moment: 'Paragraph 2 — going home after the first three Wednesdays', answer: 'confident', para: 2 },
        { moment: 'Paragraph 3 — lying awake on Wednesday nights', answer: 'overwhelmed', para: 3 },
        { moment: 'Paragraph 5 — when the best photo of the week appears on the screen', answer: 'embarrassed', para: 5 },
        { moment: 'Paragraph 6 — finding out what the two teachers have decided', answer: 'relieved', para: 6 },
      ],
    },
    {
      kind: 'mcq',
      stem: 'In Paragraph 7, what does "Both lists were exactly the same length" suggest?',
      answer: 'The writer liked the two clubs equally.',
      distractors: [
        'The writer had not thought about it carefully.',
        'Each club had the same number of members.',
        'The teachers had asked for two lists.',
      ],
      evidence: 'Both lists were exactly the same length.',
    },
    {
      kind: 'gapChoice',
      stem: 'The writer ran across the courtyard in a paper crown and a long red ______.',
      answer: 'cape',
      distractors: ['coat', 'scarf', 'shirt'],
      evidence: 'There was no time to change, so I ran across the courtyard in a paper crown and a long red cape.',
    },
    {
      kind: 'short',
      marks: 2,
      stem: 'According to Paragraph 2, how did the writer manage to go to both clubs, and what did the writer tell Mr Rahman?',
      answer:
        'After the drama warm-up, the writer ran across the courtyard to the art room and ran back for the last half hour; the writer told Mr Rahman that the writer had a meeting.',
      evidence:
        'I stayed for the drama warm-up, told Mr Rahman I had a meeting, ran across the courtyard to the art room, and ran back for the last half hour.',
      rubric:
        '两分：写出做法「戏剧社热身后跑去美术室，最后半小时再跑回礼堂」给 1 分；写出对 Mr Rahman 的借口「说自己要去开会」再给 1 分。',
    },
    {
      kind: 'short',
      marks: 2,
      stem: 'According to Paragraph 3, what TWO things made being in both clubs harder?',
      answer:
        'Mr Rahman gave the writer the part of the king in the school play, and Ms Tan gave a photo project that was due every week.',
      evidence:
        'Then Mr Rahman gave me the part of the king in the school play, and Ms Tan gave us a photo project that was due every week.',
      rubric: '两分：写出「在校园剧里演国王、要背台词」给 1 分；写出「摄影社每周都要交一次作业」再给 1 分。',
    },
    {
      kind: 'short',
      marks: 2,
      stem: 'According to Paragraph 4, why did the writer run across the courtyard still wearing the costume?',
      answer: "The writer suddenly remembered that the photos had to be handed in before the end of Ms Tan's session, and there was no time to change.",
      evidence: "Halfway through, I remembered that my photos had to be handed in before the end of Ms Tan's session.",
      rubric: '两分：写出「突然想起照片要在 Ms Tan 这节课结束前交」给 1 分；写出「来不及换衣服」再给 1 分。',
    },
    {
      kind: 'short',
      marks: 2,
      stem: 'Using your own words, explain how the writer finally made the choice between the two clubs (Paragraph 7).',
      answer:
        'The writer looked at the Secondary One girl\'s photo again and realised that the writer would rather be the one watching and taking the picture than the one in it, rushing about.',
      evidence: 'I wanted to be the person at the window, not the person running past it.',
      rubric:
        '两分：写出「又看了一遍那个初一女生拍的照片」给 1 分；写出「作者更想当窗边拍照的人，而不是照片里跑来跑去的人（所以选了摄影社）」再给 1 分。',
    },
  ],
};

const SPECS = [FLAME, ENCYCLOPEDIAS, SUB_TWENTY, CHEAPEST, TWO_PLACES];

module.exports = {
  LEVEL,
  SPECS,
  DAYS: DATES.slice(0, SPECS.length).map((date, i) => buildAuthoredDay(SPECS[i], date)),
};
