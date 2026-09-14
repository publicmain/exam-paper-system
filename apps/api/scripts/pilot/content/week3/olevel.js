/**
 * 第三周 —— **olevel（O-Level 标准）**档，全原创。
 *
 * 比中级档长一截（四五百词、九段），人物心理更曲折，言外之意更多 ——
 * 主观题会问「这个动作说明他心里怎么想」「结尾他明白了什么」，这是标准档
 * 的问法。形状与首发周这一档一致：
 *   4 道情绪配对 · 1 道短语理解四选一 · 1 道原文填空 · 4 道两分主观题 —— 满分 14。
 */

'use strict';

const { buildAuthoredDay, numbered } = require('../authored');
const { DATES } = require('./dates');

const LEVEL = 'olevel';

// ═══════════════════════════════════════════════════════════════
// 周一 —— The Understudy
//
// 原来这一天写的是 The Piano Through the Wall，语义查重发现与 08-28 发给 G11
// 旧早测班的「The Piano Upstairs」是同一个桥段（邻居反复练同一段、每次卡在
// 同一处、主人公躺着等那个错音），那个班已迁到新 App —— 换掉。
// ═══════════════════════════════════════════════════════════════

const UNDERSTUDY = {
  key: 'original-w3-understudy',
  title: 'The Understudy',
  passage: numbered([
    "When the cast list for the school musical went up outside the hall, my name was there, but only just. Under Priya's name, in smaller letters, it said: understudy. It meant that I would learn every song and every line of the main part, and almost certainly never perform it.",
    'I did it anyway. For six weeks I sat at the side of the stage in the dark while Priya rehearsed, mouthing her words a moment after she said them. I knew where she breathed. I knew which step she always took too early in the second dance. My mother said I was wasting my evenings, and I said that I was not, although I could not have explained why.',
    'Two days before the opening, Priya came to rehearsal with a scarf round her neck and could only whisper. Ms Koh took me aside and told me to be ready. On the bus home I caught myself hoping, just for a second, that the whisper would not get better. I got off two stops early and walked the rest of the way, as if I could leave the thought on the bus.',
    'I practised until midnight both nights. I stood in front of the bathroom mirror and sang so quietly that my voice was barely more than breath, so as not to wake anyone.',
    'On the opening night Priya walked into the dressing room at six o\'clock, and when she said "Hello" her voice was perfectly clear. Everyone cheered. I cheered too. Then I went into the toilets, locked the door, and looked at the back of it for a long time.',
    "When I came out, Priya's costume would not fasten at the back, and I was the one who knew how the hooks went, because I had tried it on every week. My fingers were shaking slightly as I did them up.",
    'In the second half, halfway through her longest speech, Priya stopped. The hall went completely silent. From the dark at the side of the stage I could see her face searching for the next line, and I said it, just loud enough for her and nobody else: "But if the river keeps its promise—"',
    'She picked it up without a pause and went on, and I do not think a single person in the audience noticed.',
    'Afterwards, in the corridor, she found me and held on to my arm. "You were in it," she said. "The whole time. You were in it." I had thought I had wasted six weeks. It turned out I had been in the play every single night.',
  ]),
  questions: [
    {
      kind: 'matchingFeelings',
      bank: ['guilty', 'disappointed', 'alarmed', 'touched', 'bored', 'amused', 'indifferent', 'furious'],
      items: [
        { moment: 'Paragraph 3 — on the bus home after Ms Koh speaks to the writer', answer: 'guilty', para: 3 },
        { moment: 'Paragraph 5 — locked inside the toilets', answer: 'disappointed', para: 5 },
        { moment: 'Paragraph 7 — when Priya stops in the middle of her longest speech', answer: 'alarmed', para: 7 },
        { moment: 'Paragraph 9 — when Priya says "You were in it"', answer: 'touched', para: 9 },
      ],
    },
    {
      kind: 'mcq',
      stem: 'In Paragraph 3, why does the writer get off the bus "two stops early"?',
      answer: 'to escape a thought the writer felt ashamed of',
      distractors: [
        'to buy something to eat before going home',
        'because the bus was going the wrong way',
        'to practise the songs somewhere private',
      ],
      evidence: 'I got off two stops early and walked the rest of the way, as if I could leave the thought on the bus.',
    },
    {
      kind: 'gapChoice',
      stem: 'For six weeks the writer sat at the side of the stage in the ______ while Priya rehearsed.',
      answer: 'dark',
      distractors: ['morning', 'mirror', 'rain'],
      evidence:
        'For six weeks I sat at the side of the stage in the dark while Priya rehearsed, mouthing her words a moment after she said them.',
    },
    {
      kind: 'short',
      marks: 2,
      stem: 'According to Paragraph 1, what did being the "understudy" mean for the writer?',
      answer:
        'The writer had to learn every song and every line of the main part, even though they would almost certainly never perform it.',
      evidence: 'It meant that I would learn every song and every line of the main part, and almost certainly never perform it.',
      rubric: '两分：写出「要学会主角所有的歌和台词」给 1 分；点明「但几乎肯定不会真的上台（只是备着）」再给 1 分。',
    },
    {
      kind: 'short',
      marks: 2,
      stem: "Using your own words, explain what the writer does in Paragraph 5 after Priya arrives, and what this shows about the writer's feelings.",
      answer:
        'The writer cheers with everyone else but then hides alone in the toilets staring at the door, which shows they are covering deep disappointment with a show of happiness.',
      evidence: 'Everyone cheered. I cheered too. Then I went into the toilets, locked the door, and looked at the back of it for a long time.',
      rubric:
        '两分：写出「表面上跟着大家欢呼，转身一个人躲进厕所」给 1 分；点明「是在掩饰内心很大的失望」再给 1 分。',
    },
    {
      kind: 'short',
      marks: 2,
      stem: "Why was the writer the one who could fasten Priya's costume in Paragraph 6?",
      answer:
        'As the understudy, the writer had tried the costume on every week, so the writer knew exactly how the hooks at the back worked.',
      evidence:
        "When I came out, Priya's costume would not fasten at the back, and I was the one who knew how the hooks went, because I had tried it on every week.",
      rubric: '两分：写出「作者作为替补每周都试穿过这套戏服」给 1 分；因此「知道后面的扣子怎么扣」再给 1 分。',
    },
    {
      kind: 'short',
      marks: 2,
      stem: 'Explain what the writer realises at the end of the story.',
      answer:
        'The six weeks were not wasted: by learning every line, the writer had been part of the play every night, and was even able to save Priya when she forgot her words.',
      evidence: 'It turned out I had been in the play every single night.',
      rubric:
        '两分：写出「那六周没有白费」给 1 分；点明「自己一直是这出戏的一部分 / 关键时刻帮 Priya 接上了台词」再给 1 分。',
    },
  ],
};

// ═══════════════════════════════════════════════════════════════
// 周二 —— The Trophy on the Shelf
// ═══════════════════════════════════════════════════════════════

const TROPHY = {
  key: 'original-w3-trophy',
  title: 'The Trophy on the Shelf',
  passage: numbered([
    'My brother Wei Jie won the inter-school chess championship when he was fourteen, and the trophy has stood on the shelf above our television ever since: a silver king on a black base, about as tall as my forearm. Visitors pick it up. My father tells the story of the final game whether or not they ask.',
    'I was dusting the shelf on a Saturday afternoon, alone in the flat, when I knocked it with the back of my hand. It did not fall far. It hit the edge of the television cabinet, and the king\'s crown snapped off cleanly and rolled under the sofa.',
    'For about a minute I could not move. Then I did several things very fast. I found the crown. I found the superglue in the kitchen drawer. I glued the crown back on, held it for the full thirty seconds the tube recommended, and put the trophy back exactly where it had been, turned slightly so that the crack faced the wall.',
    'Nobody noticed that evening, or the next day. By Monday I had almost stopped looking at it every time I passed. Once I even caught myself admiring it, the way my father does, before I remembered. I found that if I did not think about it, it was as if it had not happened, and I was surprised how easy that was.',
    'On Wednesday my aunt came to dinner, picked up the trophy to read the words on its base, as visitors always do, and turned it round. The crown came off in her hand.',
    'In the silence that followed, I waited for my father to begin shouting. My aunt was holding the crown between two fingers, as if it might be hot. My father did not shout. He looked at Wei Jie, who was looking at me. I have never wanted so badly to be somewhere else.',
    '"I did it," I said. "On Saturday. I glued it."',
    'Wei Jie took the crown from my aunt and looked at the break for a while. Then he said something I have thought about many times since. "I don\'t care about the trophy," he said. "I stopped playing chess two years ago. I care that you turned it round."',
    'He glued it again that night, properly, with the crack facing the room. When I asked him why, he said that the trophy was more honest that way. It still stands above the television. My father still tells the story of the final game, and now, sometimes, Wei Jie tells the story of the crown.',
  ]),
  questions: [
    {
      kind: 'matchingFeelings',
      bank: ['panicked', 'relieved', 'apprehensive', 'ashamed', 'proud', 'jealous', 'bored', 'amused'],
      items: [
        { moment: 'Paragraph 3 — straight after the crown snaps off', answer: 'panicked', para: 3 },
        { moment: 'Paragraph 4 — by Monday, when nobody has noticed', answer: 'relieved', para: 4 },
        { moment: 'Paragraph 6 — waiting for the father to begin shouting', answer: 'apprehensive', para: 6 },
        { moment: 'Paragraph 8 — when Wei Jie says what he really cares about', answer: 'ashamed', para: 8 },
      ],
    },
    {
      kind: 'mcq',
      stem: 'In Paragraph 1, "whether or not they ask" suggests that the father',
      answer: 'tells the story to everyone because he is so proud.',
      distractors: [
        'finds it rude when visitors do not ask about it.',
        'can no longer remember the final game very well.',
        'would rather Wei Jie told the story instead.',
      ],
      evidence: 'My father tells the story of the final game whether or not they ask.',
    },
    {
      kind: 'gapChoice',
      stem: 'The writer held the glued crown in place for thirty ______.',
      answer: 'seconds',
      distractors: ['minutes', 'hours', 'days'],
      evidence:
        'I glued the crown back on, held it for the full thirty seconds the tube recommended, and put the trophy back exactly where it had been, turned slightly so that the crack faced the wall.',
    },
    {
      kind: 'short',
      marks: 2,
      stem: 'Using your own words, explain how the writer tried to hide the damage in Paragraph 3.',
      answer:
        'The writer quickly glued the crown back on and put the trophy back in exactly the same place, turned so that the crack could not be seen.',
      evidence:
        'I glued the crown back on, held it for the full thirty seconds the tube recommended, and put the trophy back exactly where it had been, turned slightly so that the crack faced the wall.',
      rubric: '两分：用胶水把王冠粘回去给 1 分；放回原处并把裂缝转向墙、让人看不见再给 1 分。',
    },
    {
      kind: 'short',
      marks: 2,
      stem: 'What surprised the writer in Paragraph 4, and why might this be worrying?',
      answer:
        'How easy it was to act as if nothing had happened — it shows how quickly hiding a mistake can start to feel normal.',
      evidence:
        'I found that if I did not think about it, it was as if it had not happened, and I was surprised how easy that was.',
      rubric:
        '两分：写出「竟然这么容易就当作没发生过」给 1 分；点明「说明隐瞒很快就会让人心安理得 / 作者在逃避责任」再给 1 分。',
    },
    {
      kind: 'short',
      marks: 2,
      stem: 'Why does Wei Jie care that the writer "turned it round" rather than about the broken trophy?',
      answer:
        'The trophy no longer matters to him because he stopped playing chess; what hurts him is that the writer tried to hide the damage and deceive the family.',
      evidence: '"I don\'t care about the trophy," he said. "I stopped playing chess two years ago. I care that you turned it round."',
      rubric: '两分：写出「他早就不下棋了，奖杯本身不重要」给 1 分；点明「在意的是作者想瞒着、不诚实」再给 1 分。',
    },
    {
      kind: 'short',
      marks: 2,
      stem: 'Explain what Wei Jie means when he says the trophy is "more honest" with the crack facing the room (Paragraph 9).',
      answer:
        'Showing the crack admits that the trophy was broken instead of pretending it is perfect, so the truth about what happened becomes part of the family\'s story.',
      evidence: 'When I asked him why, he said that the trophy was more honest that way.',
      rubric:
        '两分：写出「把裂缝露出来 = 不再假装它完好」给 1 分；点明「承认发生过的事 / 这件事也成了家里故事的一部分」再给 1 分。',
    },
  ],
};

// ═══════════════════════════════════════════════════════════════
// 周三 —— Speaking for My Mother
// ═══════════════════════════════════════════════════════════════

const TRANSLATING = {
  key: 'original-w3-translating',
  title: 'Speaking for My Mother',
  passage: numbered([
    'Every year on Parent-Teacher Day, I sat between my mother and my form teacher and turned English into Mandarin. My mother knew enough English to go shopping and ask for directions, but she always said she was too slow for a conversation with a teacher. I had been doing the job since I was nine, and I was good at it.',
    'This year my form teacher was Mr Rahman, and I already knew what he was going to say. My homework had been late all term, and twice I had not handed it in at all. On the walk from the school gate, my mother asked me whether there would be any problems, and I told her that there would not be.',
    'Mr Rahman was kind but direct. "Jia Hui is clearly able," he said, "but she has been careless this term. If this continues, she will struggle next year." He looked at my mother, not at me, while he spoke, and then he waited.',
    'I turned to my mother and told her, in Mandarin, that the teacher thought I was clever and just needed to be a little more careful with my homework. It was not exactly a lie. I simply left out the parts that mattered. My mother nodded slowly and said "Thank you, teacher" in English, and Mr Rahman smiled at her.',
    'For the rest of the meeting I did the same thing. When he said "late", I said "sometimes a bit slow". When he mentioned the two missing pieces of work, I told her that he wanted me to check my bag more carefully in the mornings. Every time Mr Rahman opened his mouth, my heart began to beat faster, and I had to keep wiping my wet hands on my skirt.',
    'On the way home my mother was quiet. We stopped at the traffic lights, and when the green man appeared, she did not move. Then she said, in slow, careful English, "Careless this term. Will struggle next year." The green man began to flash and then disappeared, and I was still standing at the edge of the road with my mouth open.',
    'She told me, in Mandarin now, that for two years she had been going to English classes at the community centre on Wednesday evenings. She had not told anyone, because she wanted to be sure she was good enough first. "I did not understand every word," she said. "But I understood enough."',
    'She was not angry, and somehow that made it harder. She only asked why I had changed his words, and I said I had not wanted her to be disappointed. Then she said that she had let me carry on translating, the whole way through, because she wanted to see what I would choose to do. My face went hot. I looked down at the pavement and kept looking at it until the lights changed again.',
    'The following year, my mother spoke to my teacher herself, slowly and with mistakes, and I sat beside her and said nothing unless she turned to me for a word. Halfway through, I noticed that I was sitting up very straight, the way she does when I win a prize at school. For years I had believed that I was the one speaking for her. I had never once thought that she might be the one listening to me.',
  ]),
  questions: [
    {
      kind: 'matchingFeelings',
      bank: ['nervous', 'shocked', 'ashamed', 'proud', 'bored', 'curious', 'annoyed', 'amused'],
      items: [
        { moment: 'Paragraph 5 — each time Mr Rahman begins to speak again', answer: 'nervous', para: 5 },
        { moment: "Paragraph 6 — when the mother repeats the teacher's words at the traffic lights", answer: 'shocked', para: 6 },
        { moment: 'Paragraph 8 — when the mother explains why she let the writer carry on translating', answer: 'ashamed', para: 8 },
        { moment: 'Paragraph 9 — at the next Parent-Teacher Day, as the mother speaks to the teacher herself', answer: 'proud', para: 9 },
      ],
    },
    {
      kind: 'mcq',
      stem: 'In Paragraph 8, "somehow that made it harder" suggests that the writer',
      answer: 'felt worse because her mother stayed so calm.',
      distractors: [
        'had to work harder at school from then on.',
        'believed English classes must be very difficult.',
        "could not easily understand her mother's Mandarin.",
      ],
      evidence: 'She was not angry, and somehow that made it harder.',
    },
    {
      kind: 'gapChoice',
      stem: 'After her mother explained, the writer looked down at the ______ until the lights changed again.',
      answer: 'pavement',
      distractors: ['road', 'lights', 'gate'],
      evidence: 'I looked down at the pavement and kept looking at it until the lights changed again.',
    },
    {
      kind: 'short',
      marks: 2,
      stem: 'What did the writer tell her mother on the walk from the school gate in Paragraph 2, and why was this not true?',
      answer:
        'She said there would not be any problems, although she knew her homework had been late all term and twice had not been handed in.',
      evidence:
        'On the walk from the school gate, my mother asked me whether there would be any problems, and I told her that there would not be.',
      rubric:
        '两分：写出「她跟妈妈说不会有任何问题」给 1 分；点明「其实她知道自己整学期作业迟交、还有两次没交，老师一定会说」再给 1 分。',
    },
    {
      kind: 'short',
      marks: 2,
      stem: "Using your own words, explain what the writer did with Mr Rahman's words in Paragraph 5, and what this shows about her.",
      answer:
        'She made his criticisms sound much smaller than they really were, for example turning "late" into "sometimes a bit slow", which shows she was trying to hide how badly she was doing from her mother.',
      evidence: 'When he said "late", I said "sometimes a bit slow".',
      rubric:
        '两分：写出「把老师的批评说轻了（如把迟交说成有时慢一点、把没交作业说成要检查书包）」给 1 分；再点明这说明她是什么样的人或当时的心理，原文支持的任一点都给分（不诚实 / 想瞒住妈妈自己的真实表现 / 怕妈妈失望 / 心虚紧张），再给 1 分。',
    },
    {
      kind: 'short',
      marks: 2,
      stem: 'According to Paragraphs 7–8, why had the mother kept her English classes a secret, and why did she let the writer carry on translating?',
      answer:
        'She wanted to be sure her English was good enough before telling anyone, and she let the writer translate because she wanted to see what the writer would choose to do, that is, whether she would be honest.',
      evidence: 'She had not told anyone, because she wanted to be sure she was good enough first.',
      rubric:
        '两分：两个原因各 1 分——①她想等自己英语够好了再告诉别人，所以一直没说；②她让女儿继续翻译，是想看女儿会怎么选择、会不会如实翻译。只答出其中一个给 1 分。',
    },
    {
      kind: 'short',
      marks: 2,
      stem: 'In Paragraph 9, what had the writer always believed about translating for her mother, and what does she now realise?',
      answer:
        'She had always believed that she was the one speaking for her mother and that her mother needed her, but now she sees that her mother had really been listening to her and watching whether she was honest.',
      evidence: 'I had never once thought that she might be the one listening to me.',
      rubric:
        '两分：写出「以前一直以为是自己在替妈妈说话、妈妈离不开她」给 1 分；点明「现在明白其实是妈妈一直在听她、看她是否诚实」再给 1 分。只写「现在只在妈妈需要时帮忙说一个词」不给第二分。',
    },
  ],
};

// ═══════════════════════════════════════════════════════════════
// 周四 —— Properly This Time
// ═══════════════════════════════════════════════════════════════

const BADMINTON = {
  key: 'original-w3-badminton',
  title: 'Properly This Time',
  passage: numbered([
    'Every Sunday morning since I was seven, my father and I have played badminton at the sports hall near our block. For years he won every single game. He never let me win, not even on my birthday, and when I complained, he said, "A point that someone gives you is not worth anything." I hated that answer more than losing.',
    'When I was sixteen, things began to change. I had joined the school team, I was training three afternoons a week, and I had grown taller than him. One Sunday in March, halfway through the first game, I stopped and looked at the score as if somebody else had written it. I was winning 15-4.',
    'I found that I did not want to beat him, and I still cannot explain why. He was breathing hard at the end of every rally, and there was grey in his hair that I had never noticed before. So I began to lose, carefully. I let easy shots land a few centimetres outside the line, and I moved a little too late for the ones in the corners, so that it all looked like bad luck.',
    'It worked for weeks. My father would win 21-18 or 21-19, and afterwards he would buy us both a cold drink from the machine by the door and tell me which shots I needed to practise. Every time, he said I had nearly got him. Every time, I said, "Next week," and looked at my drink instead of at him.',
    'Then, one Sunday in May, with the score at 20-19 to him, he hit a gentle shot towards the corner that I had left open on purpose. I watched it land. My father did not pick it up. He stood on his side of the net for a long moment, looking down at it.',
    '"Play that point again," he said. I asked him what he meant. "The last point," he said. "Properly this time." His voice was quiet, which was somehow worse than if he had shouted. My mouth went dry, and when I bent down to pick up the shuttle, I dropped it twice.',
    'I pretended not to understand. He said that he had watched me play for nine years, and he knew the difference between a shot I could not reach and a shot I did not want to reach. Then he asked, "Do you think I can\'t lose?" I had no answer to that.',
    'So we played the point again, and this time I did not hold back. I hit the shuttle past him so fast that his feet did not even move, and then I won the next two points as well. My father walked up to the net, shook my hand and laughed, a real laugh, loud enough that the people on the next court turned round. My shoulders, which had been up near my ears since March, finally came down.',
    'On the way home he bought the drinks as usual, but this time he asked me which shots he should practise. I had thought that by losing I was protecting him. But every game he had won since March had been made of points that someone gave him, and he had told me years ago what those were worth.',
  ]),
  questions: [
    {
      kind: 'matchingFeelings',
      bank: ['surprised', 'protective', 'nervous', 'relieved', 'bored', 'jealous', 'furious', 'impatient'],
      items: [
        { moment: 'Paragraph 2 — looking at the score halfway through the first game in March', answer: 'surprised', para: 2 },
        { moment: 'Paragraph 3 — noticing how hard the father is breathing', answer: 'protective', para: 3 },
        { moment: 'Paragraph 6 — bending down to pick up the shuttle after the father speaks', answer: 'nervous', para: 6 },
        { moment: 'Paragraph 8 — when the father shakes hands and laughs', answer: 'relieved', para: 8 },
      ],
    },
    {
      kind: 'mcq',
      stem: 'In Paragraph 7, "Do you think I can\'t lose?" suggests that the father',
      answer: 'is upset that the writer thought he could not take losing.',
      distractors: [
        'is joking that he has never lost a single game in his life.',
        'is confident that he will win when they play the point again.',
        'wants to find out if the writer is afraid of losing to him.',
      ],
      evidence: 'Then he asked, "Do you think I can\'t lose?"',
    },
    {
      kind: 'gapChoice',
      stem: 'After each game at the sports hall, the father bought them both a cold drink from the ______ by the door.',
      answer: 'machine',
      distractors: ['counter', 'shop', 'fridge'],
      evidence:
        'My father would win 21-18 or 21-19, and afterwards he would buy us both a cold drink from the machine by the door and tell me which shots I needed to practise.',
    },
    {
      kind: 'short',
      marks: 2,
      stem: 'What did the father say in Paragraph 1 when the writer complained, and what does this show about him?',
      answer:
        'He said that a point someone gives you is worth nothing, which shows that he believes a win only counts if you earn it fairly.',
      evidence:
        'He never let me win, not even on my birthday, and when I complained, he said, "A point that someone gives you is not worth anything."',
      rubric: '两分：写出「别人让给你的分一文不值」给 1 分；再点明他的为人，原文支持的任一点都给分（看重公平 / 认为赢要靠真本事 / 对孩子要求严格、不迁就），再给 1 分。',
    },
    {
      kind: 'short',
      marks: 2,
      stem: 'Using your own words, explain how the writer lost on purpose in Paragraph 3, and why the writer did this.',
      answer:
        'The writer let easy shots land just outside the line and moved too late for corner shots so that it looked like bad luck, because the father seemed older and tired, and the writer did not want to beat him.',
      evidence:
        'I let easy shots land a few centimetres outside the line, and I moved a little too late for the ones in the corners, so that it all looked like bad luck.',
      rubric:
        '两分：写出「故意让容易的球落在线外 / 故意慢一步去接角落的球，装成运气不好」给 1 分；再写出原因，原文支持的任一点都给分（不想赢爸爸 / 看到爸爸打得很喘、有了从没注意过的白头发，不忍心赢他 / 想保护他），再给 1 分。只写「作者自己也说不清为什么」不给第二分。',
    },
    {
      kind: 'short',
      marks: 2,
      stem: 'Look at Paragraphs 5–7. What did the writer do when the father hit a gentle shot into the corner, and how did the father know that this was not bad luck?',
      answer:
        'The writer just watched it land without trying to reach it; the father had watched the writer play for nine years, so he knew the difference between a shot the writer could not reach and one the writer did not want to reach.',
      evidence:
        'He said that he had watched me play for nine years, and he knew the difference between a shot I could not reach and a shot I did not want to reach.',
      rubric:
        '两分：写出「作者只是看着球落地，根本没去接（那个角是故意空出来的）」给 1 分；写出「爸爸看作者打了九年球，分得清够不着的球和不想接的球」再给 1 分。',
    },
    {
      kind: 'short',
      marks: 2,
      stem: 'In Paragraph 9, what does the writer finally realise about losing on purpose?',
      answer:
        'Losing on purpose did not protect the father: it only gave him wins made of points he had not earned, which by his own rule were worth nothing, and what he really wanted was a fair game.',
      evidence:
        'But every game he had won since March had been made of points that someone gave him, and he had told me years ago what those were worth.',
      rubric:
        '两分：写出「故意输并没有保护到爸爸 / 爸爸并不需要这种保护」给 1 分；点明「那些胜利都是别人送的分，按他自己的话一文不值——他要的是公平地真打」再给 1 分。',
    },
  ],
};

// ═══════════════════════════════════════════════════════════════
// 周五 —— The Spare Motor
//
// 原来这一天写的是 The Heaviest Suitcase，语义审读发现与学生读过的旧文
// 「The Send-off」同一个故事（合住的兄弟姐妹离家、全家忙了几周、送别时父亲
// 先握手再拥抱、那晚房间太大太静）—— 整篇换掉。
// ═══════════════════════════════════════════════════════════════

const SPARE_MOTOR = {
  key: 'original-w3-spare-motor',
  title: 'The Spare Motor',
  passage: numbered([
    'For a whole term, Nadia, Ethan and I spent every Tuesday evening in the science lab, building a robot about the size of a shoebox. At the robot challenge for schools, it would have two minutes to pick up coloured blocks and drop each one into the right box. I wrote the program, so I was the captain, and I took that more seriously than anything I had ever done.',
    'The team we most wanted to beat was Bukit Rise Secondary, who had won the year before. On the morning of the competition, their captain, a tall girl called Anjali, walked slowly round the hall with a notebook, looking at everyone\'s robots and writing things down. Ethan said she was checking on the competition. I believed him.',
    'Twenty minutes before our first round, during a practice run, our robot made a small click and began to turn in slow circles. There was a smell of burnt plastic. The left motor had died. We had no spare, because in March I had decided that a spare motor was a waste of our money.',
    'I took the robot apart on the floor. My hands were shaking so badly that I dropped two of the tiny screws, and Nadia had to find them under the next table. When Ethan asked what we were going to do, I told him to stop asking stupid questions. That was not fair, and he went very quiet.',
    'Then a pair of trainers stopped next to me. Anjali bent down, looked at the motor for a few seconds and walked away without a word. She came back with a small motor in a plastic bag and held it out. I did not take it straight away. I turned it over and over in my hands, looking for something wrong with it, and asked her what she wanted in return.',
    '"Nothing," she said. "Just give it back after the final." One of her teammates called her name in an unhappy voice, and she waved at him without turning round. Then she showed Nadia which screws went where, as if she had done this many times before.',
    'We fitted the new motor with three minutes to spare. When our robot dropped its first block into the right box, I noticed that I had been holding the edge of the table so hard that my fingers had gone white. I let go of it and sat down on the floor.',
    'We finished third, and Bukit Rise won, as everyone had expected. When Anjali went up to collect the cup, I stood and clapped until my hands hurt, long after everyone else had sat down. Afterwards, when I gave the motor back, she told me that at her first competition a boy from another school had lent her team a battery. She had been waiting two years to do the same for someone.',
    'On the bus back to school, I started a list for next year in my notebook. At the top, underlined twice, I wrote: two spare motors. Ethan read it over my shoulder and asked why we needed two. "One is for us," I said, and then I said sorry for how I had spoken to him in the hall. I had spent the whole day seeing Anjali as someone to beat. She had spent it seeing us as people worth helping, and she had still won.',
  ]),
  questions: [
    {
      kind: 'matchingFeelings',
      bank: ['panicked', 'suspicious', 'relieved', 'grateful', 'jealous', 'bored', 'proud', 'lonely'],
      items: [
        { moment: 'Paragraph 4 — taking the robot apart on the floor of the hall', answer: 'panicked', para: 4 },
        { moment: 'Paragraph 5 — turning the motor over before accepting it', answer: 'suspicious', para: 5 },
        { moment: 'Paragraph 7 — when the robot drops its first block into the right box', answer: 'relieved', para: 7 },
        { moment: 'Paragraph 8 — clapping as Anjali goes up to collect the cup', answer: 'grateful', para: 8 },
      ],
    },
    {
      kind: 'mcq',
      stem: 'In Paragraph 6, Anjali "waved at him without turning round". This suggests that she',
      answer: 'had made up her mind and did not want to argue.',
      distractors: [
        'did not hear her teammate calling her name.',
        'was saying goodbye because her team had to leave.',
        'wanted her teammate to come and help her too.',
      ],
      evidence: 'One of her teammates called her name in an unhappy voice, and she waved at him without turning round.',
    },
    {
      kind: 'gapChoice',
      stem: 'When the left motor died, there was a smell of burnt ______.',
      answer: 'plastic',
      distractors: ['rubber', 'paper', 'wood'],
      evidence: 'There was a smell of burnt plastic.',
    },
    {
      kind: 'short',
      marks: 2,
      stem: 'What went wrong with the robot in Paragraph 3, and why could the team not simply replace the broken part?',
      answer:
        'Its left motor died, so it turned in slow circles, and there was no spare motor because the writer had decided in March that a spare was a waste of money.',
      evidence: 'We had no spare, because in March I had decided that a spare motor was a waste of our money.',
      rubric:
        '两分：写出「左边的马达坏了（机器人原地慢慢转圈）」给 1 分；写出「没有备用马达，因为作者三月时认为买备用的是浪费钱」再给 1 分。',
    },
    {
      kind: 'short',
      marks: 2,
      stem: 'In Paragraph 4, what did the writer say to Ethan, and what do the words "That was not fair" show about the writer?',
      answer:
        'The writer told Ethan to stop asking stupid questions, and the words show that the writer now knows Ethan had done nothing wrong and was only being shouted at because the writer was panicking.',
      evidence: 'When Ethan asked what we were going to do, I told him to stop asking stupid questions.',
      rubric:
        '两分：写出「作者叫 Ethan 别再问蠢问题」给 1 分；点明「作者承认自己说错了 / 后悔：Ethan 没做错什么，是自己慌了拿他撒气」再给 1 分。只写「作者对 Ethan 很粗鲁」而没说出承认或后悔，不给第二分。',
    },
    {
      kind: 'short',
      marks: 2,
      stem: 'According to Paragraph 8, why had Anjali been waiting two years to lend something to another team?',
      answer:
        'At her first competition, a boy from another school had lent her team a battery, and ever since she had wanted to do the same kind thing for someone else.',
      evidence:
        'Afterwards, when I gave the motor back, she told me that at her first competition a boy from another school had lent her team a battery.',
      rubric:
        '两分：写出「她第一次比赛时，别校一个男生借给她们队一块电池」给 1 分；点明「她一直想把这份帮助传下去、也帮别人一次」再给 1 分。',
    },
    {
      kind: 'short',
      marks: 2,
      stem: 'In Paragraph 9, what does the writer realise about the different ways the writer and Anjali had seen each other that day?',
      answer:
        'The writer had seen Anjali only as a rival to beat, while Anjali had seen the writer\'s team as people worth helping, and she had still managed to win.',
      evidence: 'She had spent it seeing us as people worth helping, and she had still won.',
      rubric:
        '两分：写出「作者一整天只把 Anjali 当成要打败的对手」给 1 分；点明「Anjali 却把他们当成值得帮助的人」再给 1 分（「她照样赢了」可写可不写）。',
    },
  ],
};

const SPECS = [UNDERSTUDY, TROPHY, TRANSLATING, BADMINTON, SPARE_MOTOR];

module.exports = {
  LEVEL,
  SPECS,
  DAYS: SPECS.map((spec, i) => buildAuthoredDay(spec, DATES[i])),
};
