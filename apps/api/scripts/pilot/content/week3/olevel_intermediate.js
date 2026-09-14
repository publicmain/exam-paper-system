/**
 * 第三周 —— **olevel_intermediate（O-Level 中级）**档，全原创。
 *
 * 四百词上下的记叙文，八段。形状与首发周这一档一致：
 *   4 道情绪配对（共用八个词的词库） · 1 道短语理解四选一 · 1 道原文填空 ·
 *   4 道两分主观题 —— 满分 14。
 *
 * 情绪配对的四个时刻刻意挑「原文没有直接写出那个情绪词」的地方：首发周
 * 题目体检里，全班都对的题两成是这种一眼就能从原文抄到答案的。
 */

'use strict';

const { buildAuthoredDay, numbered } = require('../authored');
const { DATES } = require('./dates');

const LEVEL = 'olevel_intermediate';

// ═══════════════════════════════════════════════════════════════
// 周一 —— The Group Project
// ═══════════════════════════════════════════════════════════════

const GROUP = {
  key: 'original-w3-group-project',
  title: 'The Group Project',
  passage: numbered([
    'When Ms Rajan read out the groups for the geography project, I was put with Mei Ling. I knew three things about Mei Ling: she sat by the window, she never put up her hand, and she had once handed in a worksheet with a drawing of a bird in the margin instead of the answers.',
    'We had two weeks to build a model of a river and present it to the class. On the first day I made a list of everything that needed doing and gave her half of it. She looked at the list for a long time and said, "Okay."',
    'For the next ten days, that was almost all she said. When I asked how her part was going, she said it was going. When I sent messages, she replied with a thumbs-up and nothing else. I started doing her half as well as mine, staying up late to paint the riverbanks and glue down the little paper trees. I told my mother that I was doing a group project by myself, and I enjoyed how unfair it sounded.',
    'On the morning of the presentation, Mei Ling was not at the school gate where we had agreed to meet. At five to eight she was still not there. My stomach tightened. I had the model, but I had not prepared to speak for both of us, and our talk was supposed to begin with her.',
    'She arrived at the classroom door just as Ms Rajan called our names, carrying a flat cardboard box. Inside was a set of drawings: the same river, from the mountain to the sea, in eight panels, each one labelled in tiny, careful handwriting. In the last one, a bird stood in the shallow water.',
    '"I thought the model could not show what happens over time," she said to the class, quietly, and then she explained the whole river, panel by panel, without looking at any notes.',
    'Nobody spoke for a moment when she finished. Then Ms Rajan asked who had done the drawings, and Mei Ling pointed at the model and said, "And that was all my partner."',
    'On the way home I read back through our messages. Every thumbs-up had been sent after midnight. I had been so busy being the only one working that I had never asked what she was working on.',
  ]),
  questions: [
    {
      kind: 'matchingFeelings',
      bank: ['resentful', 'anxious', 'astonished', 'ashamed', 'bored', 'jealous', 'proud', 'amused'],
      items: [
        { moment: 'Paragraph 3 — when the writer tells their mother about doing the project alone', answer: 'resentful', para: 3 },
        { moment: 'Paragraph 4 — waiting at the school gate at five to eight', answer: 'anxious', para: 4 },
        { moment: "Paragraph 5 — when Mei Ling's drawings come out of the box", answer: 'astonished', para: 5 },
        { moment: 'Paragraph 8 — reading back through the messages on the way home', answer: 'ashamed', para: 8 },
      ],
    },
    {
      kind: 'mcq',
      stem: 'In Paragraph 3, what does "she said it was going" suggest about Mei Ling\'s replies?',
      answer: 'They told the writer almost nothing.',
      distractors: [
        'They were rude and unfriendly.',
        'They showed her part was finished.',
        'They were full of excuses.',
      ],
      evidence: 'When I asked how her part was going, she said it was going.',
    },
    {
      kind: 'gapChoice',
      stem: "Every one of Mei Ling's thumbs-up messages had been sent after ______.",
      answer: 'midnight',
      distractors: ['school', 'dinner', 'eight'],
      evidence: 'Every thumbs-up had been sent after midnight.',
    },
    {
      kind: 'short',
      marks: 2,
      stem: 'What did the writer think of Mei Ling at the start of the story? Give ONE detail from Paragraph 1 that shows this.',
      answer:
        'The writer thought she was quiet and not a serious or reliable student — she never put up her hand, and she once drew a bird on a worksheet instead of answering.',
      evidence:
        'I knew three things about Mei Ling: she sat by the window, she never put up her hand, and she had once handed in a worksheet with a drawing of a bird in the margin instead of the answers.',
      rubric:
        '两分：写出作者当时的看法（她不起眼 / 不认真 / 靠不住）给 1 分；从第 1 段举出一个细节（从不举手 / 交的练习纸上画鸟不写答案）再给 1 分。',
    },
    {
      kind: 'short',
      marks: 2,
      stem: 'Why did the writer "enjoy how unfair it sounded" in Paragraph 3?',
      answer:
        'Saying they were doing a group project alone made the writer look hard-working and Mei Ling look lazy, so the writer felt they had a good reason to complain and get sympathy.',
      evidence: 'I told my mother that I was doing a group project by myself, and I enjoyed how unfair it sounded.',
      rubric:
        '两分：写出「这样说显得自己辛苦、占理 / 显得对方偷懒」给 1 分；点明「作者借此抱怨、博同情」再给 1 分。',
    },
    {
      kind: 'short',
      marks: 2,
      stem: "What does Mei Ling's remark in Paragraph 7 show about her?",
      answer:
        'She gives the writer full credit for the model instead of taking extra praise for herself — she is generous and fair, and does not hold it against the writer.',
      evidence:
        'Then Ms Rajan asked who had done the drawings, and Mei Ling pointed at the model and said, "And that was all my partner."',
      rubric:
        '两分：写出「她把模型的功劳如实归给同伴」给 1 分；点明她的品质（大方 / 不居功 / 不记仇）再给 1 分。',
    },
    {
      kind: 'short',
      marks: 2,
      stem: 'Using your own words, explain what the writer realises in Paragraph 8.',
      answer:
        'Mei Ling had been working late on her own part all along; the writer had been so busy feeling like the only one doing any work that they never asked her about it.',
      evidence: 'I had been so busy being the only one working that I had never asked what she was working on.',
      rubric:
        '两分：写出「她其实一直在熬夜做自己那部分」给 1 分；点明「自己只顾着觉得委屈，从没问过她」再给 1 分。',
    },
  ],
};

// ═══════════════════════════════════════════════════════════════
// 周二 —— The Lunch Rush
// ═══════════════════════════════════════════════════════════════

const RUSH = {
  key: 'original-w3-lunch-rush',
  title: 'The Lunch Rush',
  passage: numbered([
    'My uncle has sold chicken rice at the same hawker centre in Toa Payoh for twenty-two years. When I asked if I could help at his stall during the holidays, he looked at my hands, as if he were checking whether they were ready, and said I could start on Saturday at ten.',
    'The first hour was easy. I wiped the counter, filled the chilli containers and folded the takeaway boxes into shape. I was secretly disappointed. I had imagined something more exciting, like the cooking shows where people shout and flames jump out of pans. Instead I learned that the chilli containers had to be filled to one finger below the top, because, my uncle said, people trust a container that looks full but not greedy.',
    'At twelve o\'clock the office workers arrived, and the queue went from two people to twenty in the time it took me to fold one box. My uncle began calling out orders — "one roasted, no cucumber, extra chilli" — and I was supposed to pack them. The orders came faster than I could remember them. I put cucumber in the box that said no cucumber. I gave a man his change twice.',
    'Then I dropped a whole plate of rice. It landed face down on the floor, and for a second the whole stall seemed to go quiet, although I think only I went quiet. My face was burning. I was certain everybody in the queue was looking at me.',
    'My uncle did not look at me at all. He put a new plate on the counter, said "Again," and went on chopping. Later I understood that this was the kindest thing he could have done.',
    'At two, the queue disappeared as suddenly as it had come. My uncle gave me a plate of rice and sat down opposite me. He told me that in his first week, forty years ago at his own father\'s stall, he had dropped a pot of soup on a customer\'s shoe. His father had not said a word to him for the rest of the afternoon, and that night he had very nearly decided never to go back.',
    '"The shoe was fine," he said. "I was not fine for a month."',
    'On Sunday I made eleven mistakes instead of thirty. On Monday I made four. On the last day of the holidays, a woman in the queue said "You\'re quick," and I pretended I had not heard, so that I could go on hearing it.',
  ]),
  questions: [
    {
      kind: 'matchingFeelings',
      bank: ['overwhelmed', 'embarrassed', 'reassured', 'proud', 'bored', 'jealous', 'angry', 'curious'],
      items: [
        { moment: 'Paragraph 3 — when the orders come faster than the writer can remember them', answer: 'overwhelmed', para: 3 },
        { moment: 'Paragraph 4 — when the plate of rice lands on the floor', answer: 'embarrassed', para: 4 },
        { moment: "Paragraph 6 — listening to the uncle's story about the pot of soup", answer: 'reassured', para: 6 },
        { moment: 'Paragraph 8 — when the woman in the queue says "You\'re quick"', answer: 'proud', para: 8 },
      ],
    },
    {
      kind: 'mcq',
      stem: 'In Paragraph 4, "although I think only I went quiet" suggests that',
      answer: 'the silence was only in the writer\'s mind.',
      distractors: [
        'the uncle stopped work to stare.',
        'the customers were shocked into silence.',
        'the writer refused to speak to anyone.',
      ],
      evidence:
        'It landed face down on the floor, and for a second the whole stall seemed to go quiet, although I think only I went quiet.',
    },
    {
      kind: 'gapChoice',
      stem: 'On Sunday, the writer made eleven mistakes instead of ______.',
      answer: 'thirty',
      distractors: ['twenty', 'forty', 'four'],
      evidence: 'On Sunday I made eleven mistakes instead of thirty.',
    },
    {
      kind: 'short',
      marks: 2,
      stem: 'Using your own words, explain why the writer was "secretly disappointed" in Paragraph 2.',
      answer:
        'The work was simple and dull — wiping, filling and folding — when the writer had expected something exciting and dramatic, like a cooking show.',
      evidence:
        'I had imagined something more exciting, like the cooking shows where people shout and flames jump out of pans.',
      rubric:
        '两分：写出「活很简单、很闷（擦桌子、装辣椒、折盒子）」给 1 分；对照「原本以为会像烹饪节目那样热闹刺激」再给 1 分。',
    },
    {
      kind: 'short',
      marks: 2,
      stem: 'Apart from dropping the plate, give TWO mistakes the writer made during the lunch rush.',
      answer: 'The writer put cucumber in a box that said no cucumber, and gave a man his change twice.',
      evidence: 'I put cucumber in the box that said no cucumber. I gave a man his change twice.',
      rubric: '两分：放错黄瓜、多找了一次零钱，每点 1 分。写「掉了盘子」不给分。',
    },
    {
      kind: 'short',
      marks: 2,
      stem: 'Why does the writer later think that the uncle\'s reaction in Paragraph 5 was "the kindest thing he could have done"?',
      answer:
        'By not looking at the writer or making a fuss, he treated the mistake as ordinary, so the writer was not embarrassed further and could simply carry on.',
      evidence: 'He put a new plate on the counter, said "Again," and went on chopping.',
      rubric:
        '两分：写出「他不看、不责备，只说一句再来」给 1 分；点明「这样作者不会更难堪 / 把错误当平常事，让作者能接着干」再给 1 分。',
    },
    {
      kind: 'short',
      marks: 2,
      stem: 'In Paragraph 7, the uncle says the shoe was fine but he "was not fine for a month". What does he mean?',
      answer:
        'The accident itself did no real harm, but he felt bad about it for a long time — he is telling the writer that such feelings are normal and they pass.',
      evidence: '"The shoe was fine," he said. "I was not fine for a month."',
      rubric:
        '两分：写出「鞋子没事 / 事故本身不严重」给 1 分；点明「但他自己难受了很久 —— 他是在告诉作者这种感觉很正常、会过去」再给 1 分。',
    },
  ],
};

// ═══════════════════════════════════════════════════════════════
// 周三 —— The Question Jar
// ═══════════════════════════════════════════════════════════════

const JAR = {
  key: 'original-w3-question-jar',
  title: 'The Question Jar',
  passage: numbered([
    'In June my mother put an empty jam jar in the middle of the dinner table and filled it with small folded pieces of paper. "One question every night," she said. "And phones go in the basket by the door." My brother, who is twelve, groaned as if he had been given extra homework. I did not groan, because I was sixteen and above groaning, but I made sure she saw me roll my eyes.',
    'The first questions were as bad as I had expected. "What is your favourite colour?" "If you were an animal, what would you be?" My father said "a tortoise", my brother said "a shark", and I said "whatever gets me out of this fastest", which I thought was quite clever. Nobody laughed. My face went warm, and I became very interested in the pattern on the tablecloth.',
    'On the second Thursday, my father unfolded a question in my brother\'s handwriting: "What did you want to be when you were a teenager?" He was quiet for a long time. Then he said that at sixteen he had wanted to play the drums in a band, and that he had practised on biscuit tins in his bedroom until the neighbours complained.',
    'I had never imagined my father doing anything louder than reading the newspaper. I put down my chopsticks and stared at him. He told us about the band, which had played exactly one concert in a school hall, and about the day he sold his drum set to pay for his first year at polytechnic. He laughed while he told us, but he kept rubbing his thumb along the edge of the table.',
    'After that, I stopped rolling my eyes. I never said I liked the jar, but I noticed that I always came to dinner on time. We found out that my mother had once cut her own hair the night before a job interview, and that my brother was afraid of butterflies.',
    'Then, one evening in August, my brother put his hand into the jar and found nothing. My mother turned it upside down and shook it, but nothing fell out. I realised that I had been looking forward to the next question all day.',
    'After dinner I sat at my desk and wrote twenty new questions. Most were silly, like "Which food would you never eat again, even for a thousand dollars?" One was not. It said, "What is something you gave up that you still think about?" I folded it carefully and put it near the top of the jar, where my father\'s hand usually went first.',
    'My father picked that question on Sunday and did not answer it. But the next Saturday he came home with a pair of drumsticks, and he says they are only for tapping on the table when he is thinking. He seems to do a lot of thinking at dinner now, usually while he waits for someone to pick a question.',
  ]),
  questions: [
    {
      kind: 'matchingFeelings',
      bank: ['annoyed', 'embarrassed', 'surprised', 'disappointed', 'proud', 'jealous', 'frightened', 'relieved'],
      items: [
        { moment: 'Paragraph 1 — when the writer rolls their eyes at the jar', answer: 'annoyed', para: 1 },
        { moment: "Paragraph 2 — when nobody laughs at the writer's answer", answer: 'embarrassed', para: 2 },
        { moment: 'Paragraph 4 — when the writer puts down the chopsticks and stares at the father', answer: 'surprised', para: 4 },
        { moment: 'Paragraph 6 — when the jar turns out to be empty', answer: 'disappointed', para: 6 },
      ],
    },
    {
      kind: 'mcq',
      stem: 'In Paragraph 1, "I was sixteen and above groaning" suggests that the writer',
      answer: 'felt too grown-up to complain out loud.',
      distractors: [
        'secretly liked the idea of the jar.',
        'was sitting too far away to be heard.',
        'was too tired to make any noise.',
      ],
      evidence: 'I did not groan, because I was sixteen and above groaning, but I made sure she saw me roll my eyes.',
    },
    {
      kind: 'gapChoice',
      stem: 'When the jar was empty, the mother turned it upside down and ______ it, but nothing fell out.',
      answer: 'shook',
      distractors: ['washed', 'filled', 'hid'],
      evidence: 'My mother turned it upside down and shook it, but nothing fell out.',
    },
    {
      kind: 'short',
      marks: 2,
      stem: 'In Paragraph 2, what does the writer\'s answer "whatever gets me out of this fastest" show about how the writer felt about the jar at first?',
      answer:
        'The writer just wanted dinner to be over as quickly as possible, and thought the jar and its questions were silly and a waste of time.',
      evidence:
        'My father said "a tortoise", my brother said "a shark", and I said "whatever gets me out of this fastest", which I thought was quite clever.',
      rubric:
        '两分：写出「作者只想赶快离开饭桌 / 让晚饭快点结束」给 1 分；写出「觉得这个问题罐子无聊、幼稚，不当回事」再给 1 分。',
    },
    {
      kind: 'short',
      marks: 2,
      stem: 'In Paragraph 4, what did the father give up, and why?',
      answer: 'He gave up playing the drums — he sold his drum set to pay for his first year at polytechnic.',
      evidence:
        'He told us about the band, which had played exactly one concert in a school hall, and about the day he sold his drum set to pay for his first year at polytechnic.',
      rubric:
        '两分：写出「放弃了打鼓 / 卖掉了架子鼓」给 1 分；写出「为了付理工学院（polytechnic）第一年的学费」再给 1 分。',
    },
    {
      kind: 'short',
      marks: 2,
      stem: 'Give TWO things the writer does in Paragraph 5 that show the writer has started to enjoy the jar.',
      answer: 'The writer stops rolling their eyes, and always comes to dinner on time.',
      evidence: 'After that, I stopped rolling my eyes. I never said I liked the jar, but I noticed that I always came to dinner on time.',
      rubric:
        '两分：不再翻白眼、每天准时来吃晚饭，每点 1 分。只写「知道了妈妈 / 弟弟的趣事」不给分。',
    },
    {
      kind: 'short',
      marks: 2,
      stem: "In Paragraph 8, what does the father come home with after picking the writer's question, and what does this suggest about him?",
      answer:
        'A pair of drumsticks; the question has brought back his old love of drumming, and he now enjoys the question time at dinner.',
      evidence:
        'But the next Saturday he came home with a pair of drumsticks, and he says they are only for tapping on the table when he is thinking.',
      rubric:
        '两分：写出「带回一副鼓槌」给 1 分；点明「他还惦记着当年放弃的打鼓 / 那个问题让他重新拾起这份爱好 / 他现在很享受饭桌上的问答」（答出任一）再给 1 分。',
    },
  ],
};

// ═══════════════════════════════════════════════════════════════
// 周四 —— Just a Joke
// ═══════════════════════════════════════════════════════════════

const JOKE = {
  key: 'original-w3-just-a-joke',
  title: 'Just a Joke',
  passage: numbered([
    'After football training on Tuesday, Jun fell asleep on the train home with his mouth wide open and his head against the window. I had to bite my lip to keep quiet while I took a photo. I typed "Sleeping Beauty" underneath it and sent it to our class group chat before the train had even left the station.',
    'By the time we reached our station, the photo had forty-three replies. People sent rows of laughing faces, and someone turned the picture into a sticker with a pig\'s nose on it. When Jun woke up, I read the best replies out to him. He looked at my screen for a second, gave a small laugh, and did not say another word all the way home.',
    'That evening he left the group chat. I sent him a private message — "Haha, it\'s just a joke, don\'t be so serious" — and watched it change to "Seen". He did not reply.',
    'The next morning he sat at a different table in the canteen, with some other boys. I carried my tray over and sat down opposite him anyway. "You\'re still upset about one photo?" I said, loudly enough for the others to hear. I wanted them to think he was the one being difficult.',
    'He put down his spoon. "My cousin goes to another school," he said quietly. "She sent me the sticker last night. Her whole class has it. Someone asked her if the pig was her cousin." He picked up his tray and walked away, and I sat there with my own mouth open. This time nobody took a photo.',
    'For the rest of the day I kept opening the chat and closing it again. The photo was still at the top, surrounded by laughing faces, and every one of them now looked different to me. I deleted it, but I knew that the copies on everyone else\'s phones were still there.',
    'I could have sent another message. It would have been quicker, and I would not have had to see his face. Instead I waited for him at the school gate after training, with my hands going in and out of my pockets. When he came, I did not say "just a joke". I said I was sorry. I told him I had wanted people to laugh and had not thought about who they were laughing at, and I asked what I could do.',
    'He thought about it for a long time. Then he said I could start by asking the class to delete the sticker, so that night I did, in the group chat, using my own name. On Friday, Jun joined the chat again. He sent me one message, "Training tomorrow?", and I read it three times before I let out a long breath.',
  ]),
  questions: [
    {
      kind: 'matchingFeelings',
      bank: ['amused', 'shocked', 'ashamed', 'relieved', 'jealous', 'bored', 'proud', 'lonely'],
      items: [
        { moment: 'Paragraph 1 — when the writer takes the photo on the train', answer: 'amused', para: 1 },
        { moment: 'Paragraph 5 — on hearing that the sticker has reached a whole class at another school', answer: 'shocked', para: 5 },
        { moment: 'Paragraph 6 — opening and closing the chat for the rest of the day', answer: 'ashamed', para: 6 },
        { moment: "Paragraph 8 — when Jun's message arrives on Friday", answer: 'relieved', para: 8 },
      ],
    },
    {
      kind: 'mcq',
      stem: 'In Paragraph 6, "every one of them now looked different to me" suggests that',
      answer: 'the writer now saw the laughter as unkind.',
      distractors: [
        'the replies had been changed by others.',
        'the writer could not read them clearly.',
        'more people had added new laughing faces.',
      ],
      evidence:
        'The photo was still at the top, surrounded by laughing faces, and every one of them now looked different to me.',
    },
    {
      kind: 'gapChoice',
      stem: 'By the time they reached their station, the photo had forty-three ______.',
      answer: 'replies',
      distractors: ['stops', 'members', 'stickers'],
      evidence: 'By the time we reached our station, the photo had forty-three replies.',
    },
    {
      kind: 'short',
      marks: 2,
      stem: 'In Paragraph 4, why did the writer speak "loudly enough for the others to hear"?',
      answer:
        'The writer wanted the other boys to see Jun as the one making a fuss, so that the writer would not look like the person in the wrong.',
      evidence: 'I wanted them to think he was the one being difficult.',
      rubric:
        '两分：写出「想让旁边的人觉得 Jun 小题大做 / 难相处」给 1 分；点明「这样作者自己就不像做错事的人 / 想拉别人站到自己这边」再给 1 分。',
    },
    {
      kind: 'short',
      marks: 2,
      stem: "In Paragraph 5, how far has the sticker spread, and how has it affected Jun's cousin?",
      answer:
        'It has reached a whole class at another school, and someone there asked his cousin whether the pig was her cousin.',
      evidence: 'Her whole class has it. Someone asked her if the pig was her cousin.',
      rubric:
        '两分：写出「传到了别的学校、表妹的整个班都有」给 1 分；写出「有人拿这件事问 / 取笑他表妹，连累到家人」再给 1 分。',
    },
    {
      kind: 'short',
      marks: 2,
      stem: 'Why did the writer wait at the school gate instead of sending another message?',
      answer:
        'A message would have been easier because the writer would not have to face Jun, but the writer wanted to say sorry properly, face to face, to show they meant it.',
      evidence: 'It would have been quicker, and I would not have had to see his face.',
      rubric:
        '两分：写出「发消息更省事、不用面对他」给 1 分；点明「当面道歉更真诚 / 表示作者是认真的，不再躲」再给 1 分。',
    },
    {
      kind: 'short',
      marks: 2,
      stem: 'In Paragraph 8, why does the writer ask the class to delete the sticker "using my own name"?',
      answer:
        'The writer openly admits in front of the class that the photo was their doing, which shows they are taking responsibility and not hiding.',
      evidence:
        'Then he said I could start by asking the class to delete the sticker, so that night I did, in the group chat, using my own name.',
      rubric:
        '两分：写出「当着全班承认照片是自己发的」给 1 分；点明「说明作者在承担责任 / 不躲、道歉是认真的」再给 1 分。',
    },
  ],
};

// ═══════════════════════════════════════════════════════════════
// 周五 —— Twelve Moves
// ═══════════════════════════════════════════════════════════════

const MOVES = {
  key: 'original-w3-twelve-moves',
  title: 'Twelve Moves',
  passage: numbered([
    'I had not lost a game of chess at school for two years. My name was at the top of the club list, and the younger members called me "Captain", partly as a joke and partly not. On Wednesdays I walked slowly around the room with my hands behind my back, stopping at each board to point out mistakes.',
    'In the first week of term, a Secondary One boy called Irfan joined the club. He talked the whole time he played — about his cat, about a film he had watched — and he moved his pieces so fast that I decided he was not thinking at all. When Mr Das suggested that I give him a practice game, I agreed, mainly so that I could teach him to be quiet.',
    'Twelve moves later, my king was trapped in a corner. Irfan was still talking about his cat. I stared at the board, sure that I had missed something, and it took me a long moment to understand that the game was over.',
    '"Again," I said, and I began setting up the pieces before he could answer. I told him, and everyone who had come to watch, that I was tired, that I had not been trying, and that the sun from the window was in my eyes. He lost the second game, but only just, and winning it did not make me feel any better. For the next two Wednesdays, I told Mr Das I had too much homework.',
    'At home, though, I set up the first game on my own board every night and played it through again until my eyes hurt. By the third night I could see exactly what had happened. It was a simple trap, and I had walked straight into it because I had never believed he was able to set one.',
    'When I finally went back, Irfan was playing three younger students at once and losing to all of them on purpose, loudly, so that they would laugh. I watched him from the door for a while. When the others had gone home, I sat down at his table.',
    'I had to clear my throat twice before I could ask, "Can you show me what you did in that first game?" He did not make a joke of it. He just showed me, and then two more traps he had learned from puzzles he did every night, talking about his cat the whole time.',
    'At the inter-school competition in October, Mr Das put Irfan on the first board and me on the second. A month ago I would have argued. This time I only asked if we could sit next to each other. I won my game and Irfan lost his, and on the bus home he talked about it without stopping. For once, I listened to every word.',
  ]),
  questions: [
    {
      kind: 'matchingFeelings',
      bank: ['proud', 'shocked', 'embarrassed', 'determined', 'bored', 'jealous', 'relieved', 'grateful'],
      items: [
        { moment: 'Paragraph 1 — walking around the room with hands behind the back', answer: 'proud', para: 1 },
        { moment: 'Paragraph 3 — staring at the board after the twelfth move', answer: 'shocked', para: 3 },
        { moment: 'Paragraph 4 — when the writer tells everyone why the first game was lost', answer: 'embarrassed', para: 4 },
        { moment: 'Paragraph 5 — playing the game through again every night at home', answer: 'determined', para: 5 },
      ],
    },
    {
      kind: 'mcq',
      stem: 'In Paragraph 7, "I had to clear my throat twice before I could ask" suggests that',
      answer: 'the writer found it hard to ask for help.',
      distractors: [
        'the writer did not want the others to hear.',
        'the writer had forgotten what to ask.',
        'the writer had a cold and a sore throat.',
      ],
      evidence: 'I had to clear my throat twice before I could ask, "Can you show me what you did in that first game?"',
    },
    {
      kind: 'gapChoice',
      stem: 'The writer finally saw that Irfan had used a simple ______.',
      answer: 'trap',
      distractors: ['rule', 'mistake', 'joke'],
      evidence:
        'It was a simple trap, and I had walked straight into it because I had never believed he was able to set one.',
    },
    {
      kind: 'short',
      marks: 2,
      stem: "Why did the writer agree to play a practice game against Irfan, and what does this show about the writer's opinion of him?",
      answer:
        'The writer wanted to teach Irfan to stop talking; this shows the writer thought he was noisy and not a serious or skilful player.',
      evidence:
        'When Mr Das suggested that I give him a practice game, I agreed, mainly so that I could teach him to be quiet.',
      rubric:
        '两分：写出「想让他闭嘴 / 教他安静」给 1 分；点明「作者看不起他，觉得他吵、不认真、不会下棋」再给 1 分。',
    },
    {
      kind: 'short',
      marks: 2,
      stem: 'In Paragraph 4, why did winning the second game not make the writer feel any better?',
      answer:
        'The writer had only just won, and it could not change the fact that Irfan had clearly beaten them in the first game.',
      evidence: 'He lost the second game, but only just, and winning it did not make me feel any better.',
      rubric:
        '两分：写出「第二盘也只是险胜」或「第一盘已经当着大家输了、改变不了」给 1 分；点明「这说明 Irfan 确实很强 / 作者的面子和骄傲还是受了伤」再给 1 分。',
    },
    {
      kind: 'short',
      marks: 2,
      stem: 'In Paragraph 6, why was Irfan losing to the younger students on purpose, and what does this show about him?',
      answer:
        'He wanted the younger students to laugh and enjoy the game; this shows he is kind and cares more about others having fun than about winning.',
      evidence:
        'When I finally went back, Irfan was playing three younger students at once and losing to all of them on purpose, loudly, so that they would laugh.',
      rubric:
        '两分：写出「为了让低年级同学开心、笑出来」给 1 分；点明他的品质（善良 / 不在乎输赢 / 照顾别人）再给 1 分。',
    },
    {
      kind: 'short',
      marks: 2,
      stem: 'In Paragraph 8, the writer says, "A month ago I would have argued." What would the writer have argued about, and what does this show about how the writer has changed?',
      answer:
        'About being put on the second board, below Irfan; the writer is now less proud and accepts that Irfan is the stronger player.',
      evidence: 'At the inter-school competition in October, Mr Das put Irfan on the first board and me on the second.',
      rubric:
        '两分：写出「会为被排在第二台、排在 Irfan 后面而争」给 1 分；点明变化（放下面子 / 不再骄傲，承认 Irfan 更强、愿意向他学习）再给 1 分。',
    },
  ],
};

const SPECS = [GROUP, RUSH, JAR, JOKE, MOVES];

module.exports = {
  LEVEL,
  SPECS,
  DAYS: SPECS.map((spec, i) => buildAuthoredDay(spec, DATES[i])),
};
