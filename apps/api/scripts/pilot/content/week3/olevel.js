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

const SPECS = [UNDERSTUDY, TROPHY];

module.exports = {
  LEVEL,
  SPECS,
  DAYS: SPECS.map((spec, i) => buildAuthoredDay(spec, DATES[i])),
};
