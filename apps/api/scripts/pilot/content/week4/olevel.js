/**
 * 第四周 —— **olevel（O-Level 标准）**档，全原创。
 *
 * 四五百词、九段，人物心理更曲折，言外之意更多。形状与第三周这一档一致：
 *   4 道情绪配对 · 1 道短语理解四选一 · 1 道原文填空 · 4 道两分主观题 —— 满分 14。
 *
 * 选题避开了学生读过的「最后一圈」「红包」「巴士上的手机」「信」等桥段；
 * 语义查重后又换掉两篇（见周一、周三上方的注释）。
 * 献血那篇的做法按新加坡血库的公开说明写：十六七岁要家长签同意书；
 * 献血者头晕时放平、抬高双腿、冷敷，这是通行的处理，不写具体数字。
 */

'use strict';

const { buildAuthoredDay, numbered } = require('../authored');
const { DATES } = require('./dates');

const LEVEL = 'olevel';

// ═══════════════════════════════════════════════════════════════
// 周一 —— Let Him Finish
//
// 原来这一天写的是 Standing Nowhere（班级群里发同学出糗的视频、一排笑脸、
// 作者在群里要求删掉），语义查重 0.68 指向第三周的 Just a Joke —— 同一个桥段，换掉。
// 口吃的应对按言语治疗的通行建议写：不替人说完、不叫人「放松 / 慢一点」、
// 看着对方、耐心等。
// ═══════════════════════════════════════════════════════════════

const STAMMER = {
  key: 'original-w4-let-him-finish',
  title: 'Let Him Finish',
  passage: numbered([
    `My younger brother, Jun Hao, has a stammer. It is not there all the time. Some days he talks for an hour without any trouble, and some days a single word will not come out, however hard he pushes. When it gets stuck, his eyes close, his shoulders rise, and the first sound repeats again and again.`,
    `For years I did not let him get there. I finished his sentences for him. If he said, "Can I have the b-b-b—", I said, "The blue cup?" before he had got there. I thought I was helping. It was faster, and I told myself it saved him from the embarrassing part.`,
    `In March our parents took him to a speech therapist, Ms Pereira, and one Saturday I went along, because she had asked for the whole family to come.`,
    `Ms Pereira asked each of us what we did when Jun Hao got stuck. My father said he told him to slow down. My mother said she told him to take a deep breath. I said, a little proudly, that as his big sister I finished his words so that he did not have to struggle.`,
    `Ms Pereira turned to Jun Hao and asked him how that felt. He took a long time. Then he said, "L-like I am not there. Like you are t-talking and I am just w-watching." Nobody said anything for a while. My face felt hot, and I looked at the carpet.`,
    `She explained that finishing someone's sentence, or telling them to relax, shows them that the way they speak is a problem to be fixed quickly. What helps, she said, is ordinary listening: keep looking at the person, do not rush them, and let them say their own words, even if it takes longer.`,
    `It was much harder than it sounds. The next evening, Jun Hao was telling me about a game at school, and he got stuck on the word "goalkeeper". I could feel the word sitting in my own mouth, ready to jump out. I pressed my lips together and kept looking at him. It took perhaps eight seconds. It felt like a minute.`,
    `When the word finally came, he did not look embarrassed. He looked surprised, and then he carried on with the story, which turned out to be about how he had saved a penalty. It was a good story. I had never heard him tell one all the way through before.`,
    `I still have to stop myself. Sometimes I fail, and he gives me a look, and I say sorry and wait. I used to think I was saving him time. I understand now that I was saving myself from a few uncomfortable seconds, and taking his voice to do it.`,
  ]),
  questions: [
    {
      kind: 'matchingFeelings',
      bank: ['proud', 'ashamed', 'tense', 'delighted', 'bored', 'jealous', 'furious', 'amused'],
      items: [
        { moment: 'Paragraph 4 — telling Ms Pereira what she does when Jun Hao gets stuck', answer: 'proud', para: 4 },
        { moment: "Paragraph 5 — after hearing Jun Hao's answer", answer: 'ashamed', para: 5 },
        { moment: 'Paragraph 7 — pressing her lips together while he is stuck', answer: 'tense', para: 7 },
        { moment: 'Paragraph 8 — hearing the whole story for the first time', answer: 'delighted', para: 8 },
      ],
    },
    {
      kind: 'mcq',
      stem: 'In Paragraph 9, what does "taking his voice" mean?',
      answer: 'not letting him say his own words',
      distractors: ['making him speak more loudly', 'copying the way that he spoke', 'telling others about his stammer'],
      evidence:
        'I understand now that I was saving myself from a few uncomfortable seconds, and taking his voice to do it.',
    },
    {
      kind: 'gapChoice',
      stem: 'The next evening, Jun Hao got stuck on the word "______" while telling a story about a game.',
      answer: 'goalkeeper',
      distractors: ['penalty', 'football', 'teammate'],
      evidence:
        'The next evening, Jun Hao was telling me about a game at school, and he got stuck on the word "goalkeeper".',
    },
    {
      kind: 'short',
      marks: 2,
      stem: "According to Paragraph 2, why did the writer finish Jun Hao's sentences?",
      answer:
        'She believed she was helping him: it was quicker, and she thought it spared him the embarrassing part.',
      evidence: 'I thought I was helping.',
      rubric: '两分：写出「作者以为这样是在帮他」给 1 分；写出原因（更快 / 以为能让他免去尴尬）再给 1 分。',
    },
    {
      kind: 'short',
      marks: 2,
      stem: "Using your own words, explain what Jun Hao's answer in Paragraph 5 shows about how he felt.",
      answer:
        'When other people finished his sentences, he felt shut out of his own conversation, as if he did not count and could only watch others speak for him.',
      evidence: 'Like you are t-talking and I am just w-watching.',
      rubric:
        '两分：写出「别人替他把话说完时，他觉得自己好像不存在」给 1 分；点明「像被排除在自己的谈话之外，只能在旁边看」再给 1 分。',
    },
    {
      kind: 'short',
      marks: 2,
      stem: 'According to Paragraph 6, what really helps a person who stammers? Give TWO things.',
      answer: 'Keep looking at them, do not hurry them, and let them say their own words even if it takes longer.',
      evidence:
        'What helps, she said, is ordinary listening: keep looking at the person, do not rush them, and let them say their own words, even if it takes longer.',
      rubric: '两分：以下任意两点各 1 分：一直看着对方；不要催；让他自己把话说完（哪怕更久）。',
    },
    {
      kind: 'short',
      marks: 2,
      stem: 'What does the writer now understand about her old habit (Paragraph 9)?',
      answer:
        'She had not really been helping; she was avoiding her own discomfort at waiting, and by doing so she took away his chance to speak for himself.',
      evidence:
        'I understand now that I was saving myself from a few uncomfortable seconds, and taking his voice to do it.',
      rubric:
        '两分：写出「过去替他说完，其实是为了免去自己等待时的不自在」给 1 分；点明「这样做剥夺了他自己说话的机会」再给 1 分。',
    },
  ],
};

// ═══════════════════════════════════════════════════════════════
// 周二 —— The Armband
// ═══════════════════════════════════════════════════════════════

const ARMBAND = {
  key: 'original-w4-armband',
  title: 'The Armband',
  passage: numbered([
    `For two years, Arjun had been the captain of our under-sixteen football team, and nobody had ever questioned it. He was faster than the rest of us, he scored most of our goals, and he had worn the yellow armband since Secondary One as if it had been made for his arm.`,
    `So when Coach Salleh read out the captain for the new season and it was my name, I thought he had made a mistake. The team clapped. Arjun clapped too, a moment after everyone else, and then he looked at the grass.`,
    `After training I asked the coach why. He said that a captain is not the best player but the one the others listen to, and that he had noticed who the younger boys went to when they were upset. I said that Arjun would be hurt. He said, "Probably. That is not a reason to give him the armband."`,
    `For the next three weeks Arjun was polite to me, which was worse than if he had been angry. He passed the ball to me when he had to. He stopped waiting for me after training. When I sent him a message about the away match, he replied, "OK, captain." I read those two words many times, trying to decide how he had meant them.`,
    `Our first match of the season was against a school that had beaten us twice the year before. At half-time we were losing two-nil, and the younger boys sat with their heads down. I knew that I was supposed to say something, and that everyone, including Arjun, was waiting to hear what it would be.`,
    `I did not give a speech. I said that we had been passing to Arjun too quickly, before he had space, and that in the second half we should keep the ball longer and let him choose his moment. Then I turned to Arjun and asked him, in front of everyone, whether he agreed.`,
    `He looked at me for a long second. Then he said, "Yes. And watch their number four. He always goes left."`,
    `We drew two-all. Arjun scored both goals. On the bus home, he sat next to me for the first time in three weeks and fell asleep against the window before we had even left the car park.`,
    `I still wear the armband, and I still sometimes think it belongs to him. But I understand now what the coach meant. Leading the team did not mean being more important than Arjun. It meant making sure that everyone, including him, had a reason to keep playing.`,
  ]),
  questions: [
    {
      kind: 'matchingFeelings',
      bank: ['astonished', 'confused', 'nervous', 'relieved', 'bored', 'jealous', 'furious', 'amused'],
      items: [
        { moment: "Paragraph 2 — hearing the coach read out the writer's name", answer: 'astonished', para: 2 },
        { moment: 'Paragraph 4 — reading "OK, captain." again and again', answer: 'confused', para: 4 },
        { moment: 'Paragraph 5 — at half-time, with everyone waiting for him to speak', answer: 'nervous', para: 5 },
        { moment: 'Paragraph 8 — when Arjun falls asleep next to him on the bus', answer: 'relieved', para: 8 },
      ],
    },
    {
      kind: 'mcq',
      stem: 'In Paragraph 1, what does "as if it had been made for his arm" suggest?',
      answer: 'Everyone saw Arjun as the natural captain.',
      distractors: [
        'The armband was too small for the others.',
        'Arjun had made the armband himself.',
        'The armband had been a gift from the coach.',
      ],
      evidence:
        'He was faster than the rest of us, he scored most of our goals, and he had worn the yellow armband since Secondary One as if it had been made for his arm.',
    },
    {
      kind: 'gapChoice',
      stem: "Arjun warned that the other team's number ______ always goes left.",
      answer: 'four',
      distractors: ['two', 'six', 'ten'],
      evidence: 'And watch their number four. He always goes left.',
    },
    {
      kind: 'short',
      marks: 2,
      stem: 'According to Paragraph 3, what did Coach Salleh say a captain should be, and what had he noticed?',
      answer:
        'A captain is the person the others listen to rather than the best player, and he had noticed that the younger boys went to the writer when they were upset.',
      evidence:
        'He said that a captain is not the best player but the one the others listen to, and that he had noticed who the younger boys went to when they were upset.',
      rubric:
        '两分：写出「队长不是踢得最好的，而是大家愿意听的人」给 1 分；写出「教练注意到低年级队员难过时会去找作者」再给 1 分。',
    },
    {
      kind: 'short',
      marks: 2,
      stem: 'In Paragraph 4, why was it "worse" that Arjun was polite than if he had been angry?',
      answer:
        "Being polite put a distance between them and hid Arjun's real feelings, so the writer could not tell what he was thinking and their friendship felt cold.",
      evidence: 'For the next three weeks Arjun was polite to me, which was worse than if he had been angry.',
      rubric:
        '两分：写出「客气说明两人之间有了距离、不再像朋友」给 1 分；点明「作者看不出他真实的想法（如反复琢磨 OK, captain）」再给 1 分。',
    },
    {
      kind: 'short',
      marks: 2,
      stem: 'Using your own words, describe the TWO things the writer did at half-time instead of giving a speech (Paragraph 6).',
      answer:
        "He suggested a practical change that would help Arjun and asked Arjun's opinion in front of the team, which showed respect and brought Arjun back into the team.",
      evidence: 'Then I turned to Arjun and asked him, in front of everyone, whether he agreed.',
      rubric:
        '两分：写出「提出具体打法：多控球、让 Arjun 自己选出脚的时机」给 1 分；写出「当着全队问 Arjun 同不同意」再给 1 分。',
    },
    {
      kind: 'short',
      marks: 2,
      stem: 'Explain what the writer finally understands about being captain (Paragraph 9).',
      answer:
        'Being captain is not about being more important than others, but about making sure every player, even Arjun, still wants to play.',
      evidence: 'It meant making sure that everyone, including him, had a reason to keep playing.',
      rubric:
        '两分：写出「当队长不等于比别人（Arjun）更重要」给 1 分；点明「而是让每个人（包括 Arjun）都有继续踢下去的理由」再给 1 分。',
    },
  ],
};

// ═══════════════════════════════════════════════════════════════
// 周三 —— The Longest Day
//
// 原来这一天写的是 The Teacher Who Cleans Our Corridor（低估了一位不起眼的
// 清洁工，后来发现她是数学老师），语义查重 0.75 / 0.72 指向学生读过的
// The Relief Teacher 与第三周的 The Group Project —— 同一个「看轻了一个安静的人」
// 的内核，换掉。
// 斋月的细节按新加坡的常见做法写：黎明前吃 sahur、日落时以椰枣开斋、
// 玫瑰糖水、手机上的祷告声；非穆斯林朋友陪着斋戒一天也是常见的做法。
// ═══════════════════════════════════════════════════════════════

const FAST = {
  key: 'original-w4-longest-day',
  title: 'The Longest Day',
  passage: numbered([
    `Every year during Ramadan, my best friend Irfan eats and drinks nothing from before sunrise until sunset. For most of my life I had thought of this the way I thought about his height: a fact about him, interesting for a moment and then forgotten. He still played football at recess. He still laughed at the same jokes. It did not seem to cost him very much.`,
    `This year, in Secondary Three, I asked if I could try it for one day. I expected him to be pleased. Instead he looked at me carefully and asked why. I said I wanted to understand. He said, "Then don't do it to prove something. Do it to see." I did not really know what he meant.`,
    `His mother invited me to sleep over on the Friday so that I could eat sahur with them, the meal before dawn. At half past four she woke us. I ate two eggs, a bowl of oats and a large glass of water, with the feeling that I was storing fuel for a long journey. Then, a little after half past five, the call to the dawn prayer sounded, and that was the end of eating until evening.`,
    `By ten o'clock I was thinking about lunch. By noon I could think about almost nothing else. The worst part was not hunger but thirst: my mouth felt like paper, and every shop selling cold drinks seemed to have its fridge door open. Irfan walked beside me as though nothing was happening.`,
    `In the afternoon we went to the library to do homework, and I read the same paragraph four times. I snapped at Irfan when he asked me a question about maths. He did not snap back. He only said, "The afternoon is the hardest. It gets easier after four." I asked how he could do this for a whole month. He said that your body gets used to it, but you still have to choose it every day.`,
    `Just after seven, the whole family sat around the table, with dates, a jug of rose syrup drink and plates of food that his grandmother had been cooking since the afternoon. Nobody ate. We waited, watching the clock, until the call to prayer sounded from a phone on the shelf. Then Irfan's father passed the dates to me first.`,
    `I have eaten a great many meals in my life. I cannot remember any of them as clearly as that single date, soft and very sweet, and the glass of cold water after it.`,
    `Irfan's mother asked me how I had found the day. I said it was harder than I had expected. She laughed and said that was the right answer, and that the first day is hard for everyone, even for people who have done it for forty years.`,
    `I understand now what Irfan meant by "to see". I had spent years assuming that something was easy for him because he never complained about it. One day was enough to show me how much effort can hide behind a person who simply carries on.`,
  ]),
  questions: [
    {
      kind: 'matchingFeelings',
      bank: ['puzzled', 'irritable', 'touched', 'admiring', 'bored', 'jealous', 'furious', 'amused'],
      items: [
        { moment: 'Paragraph 2 — when Irfan asks the writer why he wants to fast', answer: 'puzzled', para: 2 },
        { moment: 'Paragraph 5 — in the library in the afternoon', answer: 'irritable', para: 5 },
        { moment: "Paragraph 6 — when Irfan's father passes him the dates first", answer: 'touched', para: 6 },
        { moment: 'Paragraph 9 — thinking about what Irfan does every Ramadan', answer: 'admiring', para: 9 },
      ],
    },
    {
      kind: 'mcq',
      stem: 'In Paragraph 3, what does "storing fuel for a long journey" suggest?',
      answer: 'The writer was eating to get ready for many hours without food.',
      distractors: [
        'The writer was packing food to take on a trip.',
        'The writer was cooking for the whole family.',
        'The writer was too sleepy to eat very much.',
      ],
      evidence:
        'I ate two eggs, a bowl of oats and a large glass of water, with the feeling that I was storing fuel for a long journey.',
    },
    {
      kind: 'gapChoice',
      stem: 'Irfan told the writer that fasting gets easier after ______ in the afternoon.',
      answer: 'four',
      distractors: ['seven', 'ten', 'two'],
      evidence: 'It gets easier after four.',
    },
    {
      kind: 'short',
      marks: 2,
      stem: 'According to Paragraph 1, why had the writer believed that fasting did not cost Irfan much?',
      answer:
        'Irfan still played football at recess and laughed at the usual jokes, so the writer saw the fast as just a fact about him that did not seem to affect him.',
      evidence: 'He still played football at recess.',
      rubric:
        '两分：写出「Irfan 照样课间踢球、照样说笑」给 1 分；点明「所以作者以为斋戒对他没什么影响，只当成关于他的一个事实」再给 1 分。',
    },
    {
      kind: 'short',
      marks: 2,
      stem: 'In Paragraph 2, Irfan tells the writer not to fast "to prove something". Using Paragraph 9, explain what he meant.',
      answer:
        'He did not want the writer to fast just to show that he could manage it, but to experience it and understand what it is really like.',
      evidence: 'He said, "Then don\'t do it to prove something. Do it to see."',
      rubric:
        '两分：写出「不要为了证明自己做得到而斋戒」给 1 分；点明「而是为了亲身体会、真正理解斋戒是什么感受」再给 1 分。',
    },
    {
      kind: 'short',
      marks: 2,
      stem: 'According to Paragraphs 4–5, give TWO ways in which the fast affected the writer.',
      answer:
        'He could think of little except food, he was very thirsty, he could not concentrate on his homework, and he was short-tempered with Irfan.',
      evidence: 'By noon I could think about almost nothing else.',
      rubric:
        '两分：以下任意两点各 1 分：满脑子想着吃；口渴得厉害；没法专心（同一段读了四遍）；对 Irfan 发脾气。',
    },
    {
      kind: 'short',
      marks: 2,
      stem: 'What does the writer come to realise about Irfan by the end of the story? Answer in your own words.',
      answer:
        'Someone not complaining does not mean that something is easy for them; one day showed him how much effort Irfan quietly puts in.',
      evidence: 'One day was enough to show me how much effort can hide behind a person who simply carries on.',
      rubric:
        '两分：写出「一个人不抱怨，不代表这件事对他容易」给 1 分；点明「一天的体验让作者看到 Irfan 默默付出了多少努力」再给 1 分。',
    },
  ],
};

// ═══════════════════════════════════════════════════════════════
// 周四 —— The Fifty-First Stamp
// ═══════════════════════════════════════════════════════════════

const DONATION = {
  key: 'original-w4-blood-donation',
  title: 'The Fifty-First Stamp',
  passage: numbered([
    `In Singapore you can give blood at sixteen if a parent signs the form, and I had been counting down to it for a year. My father has given blood every six months for as long as I can remember. There is a small card in his wallet with a row of stamps on it, and when I was little I used to count them while he was driving.`,
    `On the Saturday after my sixteenth birthday, we went to the blood bank together. I had eaten a big breakfast and drunk three glasses of water, as the website said. My father had eaten a slice of toast and said he was fine, because he had done this fifty times.`,
    `The nurse checked my weight, tested a drop of blood from my finger and asked me a long list of questions, some of which made me go red. Then she led me to a chair next to my father's. He gave me a thumbs-up and told me not to look at the needle.`,
    `I looked at the needle. It was larger than I had expected, and for a moment the room seemed to tilt. Then it was in, and it did not hurt much, and I watched my blood move slowly along the tube into the bag, darker than I had imagined. I squeezed the rubber ball in my hand, as I had been told, and counted.`,
    `Beside me, my father had gone very quiet. When I looked across, his face was the colour of the wall. "I don't feel great," he said, in a voice I had never heard him use. Then his eyes closed.`,
    `Two nurses were beside him in seconds. They lowered the back of his chair until his feet were higher than his head, put a cold towel on his neck and spoke to him calmly until he opened his eyes again. It took about two minutes. I could not get up, because my needle was still in, so I kept squeezing the ball and kept watching him.`,
    `Afterwards, we sat together with orange juice and biscuits. He was embarrassed. He said it had never happened before, that it was because of the toast, and that I was not to tell my mother. I said I would not.`,
    `The nurse came over and stamped two cards. Mine had one stamp on it. His had fifty-one. "Next time," she told him, "eat a proper breakfast, like your son."`,
    `I told my mother anyway, that evening. I wanted her to know that he had been brave fifty times before, and that the fifty-first time had shown me it was never as easy for him as he made it look. He pretended to be annoyed. Then he asked me when I wanted to go again.`,
  ]),
  questions: [
    {
      kind: 'matchingFeelings',
      bank: ['eager', 'alarmed', 'helpless', 'amused', 'bored', 'jealous', 'furious', 'guilty'],
      items: [
        { moment: 'Paragraph 1 — waiting to turn sixteen', answer: 'eager', para: 1 },
        { moment: "Paragraph 5 — seeing his father's face", answer: 'alarmed', para: 5 },
        { moment: 'Paragraph 6 — unable to get up while the nurses help his father', answer: 'helpless', para: 6 },
        { moment: "Paragraph 8 — hearing the nurse's advice to his father", answer: 'amused', para: 8 },
      ],
    },
    {
      kind: 'mcq',
      stem: 'In Paragraph 5, what does "his face was the colour of the wall" suggest?',
      answer: 'The father had suddenly become very pale.',
      distractors: [
        'The father was hiding behind the wall.',
        'The father was angry with the nurse.',
        'The father had become hot and red.',
      ],
      evidence: 'When I looked across, his face was the colour of the wall.',
    },
    {
      kind: 'gapChoice',
      stem: "After that Saturday, the father's card had ______ stamps on it.",
      answer: 'fifty-one',
      distractors: ['fifty', 'sixteen', 'six'],
      evidence: 'His had fifty-one.',
    },
    {
      kind: 'short',
      marks: 2,
      stem: 'According to Paragraph 2, how did the writer and his father prepare differently?',
      answer:
        'The writer ate a big breakfast and drank three glasses of water, while the father only had a slice of toast because he thought he was used to it.',
      evidence: 'My father had eaten a slice of toast and said he was fine, because he had done this fifty times.',
      rubric:
        '两分：写出作者的准备（吃了丰盛的早餐、喝了三杯水）给 1 分；写出「爸爸只吃了一片吐司，觉得献过五十次没问题」再给 1 分。',
    },
    {
      kind: 'short',
      marks: 2,
      stem: 'According to Paragraph 6, give TWO things the nurses did to help the father.',
      answer:
        'They lowered his chair so that his feet were higher than his head, put a cold towel on his neck and talked to him calmly.',
      evidence:
        'They lowered the back of his chair until his feet were higher than his head, put a cold towel on his neck and spoke to him calmly until he opened his eyes again.',
      rubric: '两分：以下任意两点各 1 分：把椅背放低、让脚比头高；在脖子上放冷毛巾；平静地跟他说话。',
    },
    {
      kind: 'short',
      marks: 2,
      stem: 'In Paragraph 7, why do you think the father blamed the toast and asked the writer not to tell the mother?',
      answer:
        'He was embarrassed to have fainted in front of his son after so many donations, so he made an excuse and wanted to keep it secret.',
      evidence: 'He was embarrassed.',
      rubric:
        '两分：写出「他觉得丢脸（献了那么多次，却当着儿子晕倒）」给 1 分；点明「所以找借口、想瞒着妈妈」（答「不想让妈妈担心 / 笑话他」也给分）再给 1 分。',
    },
    {
      kind: 'short',
      marks: 2,
      stem: 'Using your own words, explain why the writer told his mother anyway (Paragraph 9).',
      answer:
        'He wanted her to know how brave the father had been all those times, because the fainting showed that giving blood had never been as easy for him as it seemed.',
      evidence: 'I wanted her to know that he had been brave fifty times before, and that the fifty-first time had shown me it was never as easy for him as he made it look.',
      rubric:
        '两分：写出「想让妈妈知道爸爸之前五十次都很勇敢」给 1 分；点明「这次晕倒说明献血对他从来不像看上去那么轻松」再给 1 分。',
    },
  ],
};

// ═══════════════════════════════════════════════════════════════
// 周五 —— Heads or Tails
// ═══════════════════════════════════════════════════════════════

const COIN = {
  key: 'original-w4-coin-toss',
  title: 'Heads or Tails',
  passage: numbered([
    `My twin sister, Lynn, and I have shared almost everything for fifteen years: a bedroom, a birthday, most of our clothes and, for one bad month in Primary Four, chickenpox. So when our school offered a two-week exchange trip to Kyoto and our parents said they could afford to send only one of us, we both knew there was no fair way to decide.`,
    `Our grades were almost the same. We both wanted to go. Our mother suggested that we talk it over, which we did, for a whole evening, until we were no longer really talking, only repeating ourselves more loudly. In the end our father took a coin out of his pocket and said that sometimes the fairest way is the simplest one.`,
    `Lynn chose heads. Our father tossed the coin, caught it and turned it onto the back of his hand. It had landed on tails, which meant that I had won.`,
    `I expected to feel wonderful, and I did, for about ten seconds. Then I looked at Lynn, who was smiling in the careful way she smiles at the dentist, and who said "Well done" as if she were reading it off a card. She went to our room and shut the door very quietly, which in our family is much louder than slamming it.`,
    `For a week I filled in the forms and read about temples. Lynn helped me choose which clothes to pack. She was kind about it, and I could not bear it.`,
    `Then, looking for a charger, I opened the drawer under her bed. Inside was a sketchbook I had never seen. It was full of drawings of Japanese gardens: stone paths, maple trees, a small wooden bridge drawn again and again from different sides. On the first page she had written the date, and it was a year earlier, long before anyone had mentioned a trip.`,
    `I had wanted to go to Japan because it would be exciting. Lynn had wanted to go because she had been going there, in her head, for a year.`,
    `That evening I told our parents that I wanted Lynn to go instead. My mother asked if I was sure. My father asked why. I did not mention the sketchbook, because Lynn did not know I had seen it, and I thought it belonged to her in a way the trip did not. I said only that I had changed my mind.`,
    `Lynn went to Kyoto in June. She sent me forty photographs of gardens, and one of a small wooden bridge with the message: "I drew this before I saw it. I nearly got it right." I still do not know whether she guessed. I have decided that the coin was not wrong. It just did not know everything.`,
  ]),
  questions: [
    {
      kind: 'matchingFeelings',
      bank: ['guilty', 'surprised', 'determined', 'touched', 'bored', 'jealous', 'furious', 'amused'],
      items: [
        { moment: 'Paragraph 5 — while Lynn helps her pack', answer: 'guilty', para: 5 },
        { moment: 'Paragraph 6 — opening the sketchbook in the drawer', answer: 'surprised', para: 6 },
        { moment: 'Paragraph 8 — telling the parents that Lynn should go', answer: 'determined', para: 8 },
        { moment: "Paragraph 9 — reading Lynn's message about the bridge", answer: 'touched', para: 9 },
      ],
    },
    {
      kind: 'mcq',
      stem: 'In Paragraph 4, what does "much louder than slamming it" suggest?',
      answer: "Lynn's quiet exit showed how upset she was.",
      distractors: [
        'Lynn had broken the door while closing it.',
        'The family could not hear Lynn at all.',
        'Lynn wanted to be left alone to sleep.',
      ],
      evidence: 'She went to our room and shut the door very quietly, which in our family is much louder than slamming it.',
    },
    {
      kind: 'gapChoice',
      stem: "The first page of Lynn's sketchbook was dated a ______ before anyone mentioned the trip.",
      answer: 'year',
      distractors: ['week', 'month', 'day'],
      evidence: 'On the first page she had written the date, and it was a year earlier, long before anyone had mentioned a trip.',
    },
    {
      kind: 'short',
      marks: 2,
      stem: 'According to Paragraphs 1–2, why was it hard to decide which twin should go? Give TWO reasons.',
      answer: 'Their parents could pay for only one of them, their grades were almost the same, and they both wanted to go.',
      evidence: 'Our grades were almost the same.',
      rubric: '两分：以下任意两点各 1 分：父母只负担得起一个人；两人成绩几乎一样；两个人都想去。',
    },
    {
      kind: 'short',
      marks: 2,
      stem: 'What does Paragraph 4 show about how Lynn really felt? Support your answer with ONE detail.',
      answer:
        'She was deeply disappointed but tried to hide it — for example, her smile was forced, like at the dentist, and she shut the door very quietly.',
      evidence:
        'Then I looked at Lynn, who was smiling in the careful way she smiles at the dentist, and who said "Well done" as if she were reading it off a card.',
      rubric:
        '两分：写出「她其实很失落，却在掩饰」给 1 分；从第 4 段举出一个细节（像在牙医那里那样勉强地笑 / 像照着卡片念一样说 Well done / 轻轻关上房门）再给 1 分。',
    },
    {
      kind: 'short',
      marks: 2,
      stem: "Using your own words, explain the difference between the twins' reasons for wanting to go (Paragraph 7).",
      answer:
        'The writer only wanted an exciting trip, but Lynn had been dreaming about and drawing Japanese gardens for a whole year.',
      evidence: 'Lynn had wanted to go because she had been going there, in her head, for a year.',
      rubric:
        '两分：写出「作者想去只是因为好玩、刺激」给 1 分；写出「Lynn 一年来一直在心里向往、画日本庭园」再给 1 分。',
    },
    {
      kind: 'short',
      marks: 2,
      stem: 'In Paragraph 8, why did the writer not mention the sketchbook to her parents?',
      answer:
        'Lynn did not know that the writer had seen it, and the writer felt it was something private that belonged only to Lynn.',
      evidence:
        'I did not mention the sketchbook, because Lynn did not know I had seen it, and I thought it belonged to her in a way the trip did not.',
      rubric: '两分：写出「Lynn 不知道作者看过」给 1 分；点明「作者觉得画本是她私人的东西，应该尊重」再给 1 分。',
    },
  ],
};

const SPECS = [STAMMER, ARMBAND, FAST, DONATION, COIN];

module.exports = {
  LEVEL,
  SPECS,
  DAYS: SPECS.map((spec, i) => buildAuthoredDay(spec, DATES[i])),
};
