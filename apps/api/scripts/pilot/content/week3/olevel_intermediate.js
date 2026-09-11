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

const SPECS = [GROUP, RUSH];

module.exports = {
  LEVEL,
  SPECS,
  DAYS: SPECS.map((spec, i) => buildAuthoredDay(spec, DATES[i])),
};
