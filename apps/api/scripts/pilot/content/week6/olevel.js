/**
 * 第六周 —— **olevel（O-Level 标准）**档，全原创。
 *
 * 四五百词、九段，人物心理更曲折，言外之意更多。形状与第三到五周这一档一致：
 *   4 道情绪配对 · 1 道短语理解四选一 · 1 道原文填空 · 4 道两分主观题 —— 满分 14。
 *
 * 上周这一档几篇都是「年轻人在岗位上碰到难缠的大人」，同档互相太像，这周五天
 * 按领域先分好：周一家里（祖辈）、周二朋友冲突、周三学新技能、周四公共场合的
 * 选择、周五幽默反转。五篇没有一篇写打工 / 岗位，也没有一篇的核心是「发现自己
 * 动机不纯」（前两周这一档已出现三次）。选题前对过学生交过卷的 226 个标题和
 * 内容包 125 篇，并读了 The Send-off、Heads or Tails、The Question Jar、
 * The Photograph on the MRT、The Phone on Bus 80 的原文确认不是同一个骨架。
 */

'use strict';

const { buildAuthoredDay, numbered } = require('../authored');
const { DATES } = require('./dates');

const LEVEL = 'olevel';

// ═══════════════════════════════════════════════════════════════
// 周一 —— How They Met
//
// 外公外婆（Atuk、Nenek）金婚，作者给家庭午餐做短片。两老当着镜头各说一套：
// 都说是对方先看上自己、对方故意撞上来。之后两人各自私下找作者，都说「用对方
// 的版本」。作者把两个版本并排剪进去；妈妈说她小时候单独问过两人，各讲的都是
// 对方的版本。结局开放：到现在也不知道哪个是真的。
// 与 The Question Jar（问题罐引出爸爸放弃的梦想）只是都有「听长辈讲往事」的外壳，
// 内核是「把好听的版本让给对方」。不写老物件、老照片、生病去世、年夜饭。
// 1975 年相识、2026 年金婚，时间对得上；没有其他事实性内容。
// ═══════════════════════════════════════════════════════════════

const HOW_THEY_MET = {
  key: 'original-w6-how-they-met',
  title: 'How They Met',
  passage: numbered([
    `For my grandparents' fiftieth wedding anniversary, my aunt asked me to make a short video for the family lunch. "Just ask them how they met," she said. "Ten minutes. Easy." After fifty years, I thought, Atuk and Nenek would at least agree about the first day.`,
    `On Saturday I sat them on the sofa and pressed record. Atuk went first. In 1975, at a friend's wedding, a girl in a green dress walked straight into him and spilled a glass of orange juice down his white shirt. "She had been watching me all evening," he told the camera. "It was not an accident."`,
    `Nenek let him finish. Then she said that he was the one who had been watching. He had waited beside the drinks table for an hour, and when she came for a drink, he stepped backwards into her on purpose. Afterwards he said the stain was her fault, so that she would have to wash the shirt and bring it back.`,
    `After that, they corrected each other every few seconds. "It was a Saturday." "Sunday." "Two hundred guests." "Three hundred at least." I stopped recording, took a deep breath and started again, three times, and I kept looking at the clock. When I asked which version was true, they pointed at each other at exactly the same moment.`,
    `That evening, Atuk found me washing cups in the kitchen. He checked over his shoulder first, the way he does when he is about to give me money my mother does not know about. "Use your Nenek's version," he said quietly. I stared at him, a wet cup in my hand. He had argued for his own story all afternoon. "Fifty years I have told it my way," he said. "She should win once."`,
    `The next morning, while Atuk was in the shower, Nenek sat down beside me. "About the video," she said. "Use his." I had to press my lips together to stop myself from laughing, because it was almost exactly what Atuk had said. "He has been proud of that story for fifty years," she went on. "Let him keep it."`,
    `So neither of them wanted to win. Each wanted the other one to, and whichever version I chose, one of them would be disappointed that the other had lost. In the end I used both, one straight after the other, and I finished with the moment when they pointed at each other.`,
    `At the lunch, the whole family watched it on my aunt's television. When it ended, Nenek said, "His is wrong," and Atuk said, "Hers is wrong," at the same time. Then he reached for her hand, and she let him take it, although neither of them looked at the other. My throat went tight, and I looked down at my plate.`,
    `I still do not know which version is true. My mother says she has heard the story all her life, told both ways. But she told me something that is not in my video. When she was a girl, she once asked each of them alone. Atuk told her Nenek's version, and Nenek told her Atuk's.`,
  ]),
  questions: [
    {
      kind: 'matchingFeelings',
      bank: ['impatient', 'confused', 'amused', 'touched', 'jealous', 'frightened', 'guilty', 'lonely'],
      items: [
        { moment: 'Paragraph 4 — trying to record while Atuk and Nenek keep correcting each other', answer: 'impatient', para: 4 },
        { moment: 'Paragraph 5 — hearing what Atuk asks for in the kitchen', answer: 'confused', para: 5 },
        { moment: 'Paragraph 6 — hearing what Nenek asks for the next morning', answer: 'amused', para: 6 },
        { moment: "Paragraph 8 — seeing Atuk reach for Nenek's hand", answer: 'touched', para: 8 },
      ],
    },
    {
      kind: 'mcq',
      stem: 'In Paragraph 6, what does Nenek mean by "Let him keep it"?',
      answer: 'Atuk should be allowed to go on telling his version.',
      distractors: [
        'Atuk should be given the video to keep.',
        'Atuk should keep the shirt from the wedding.',
        'Atuk should keep their plan a secret from the family.',
      ],
      evidence: '"He has been proud of that story for fifty years," she went on. "Let him keep it."',
    },
    {
      kind: 'gapChoice',
      stem: 'According to Atuk, the girl who walked into him at the wedding was wearing a ______ dress.',
      answer: 'green',
      distractors: ['white', 'pink', 'blue'],
      evidence:
        "In 1975, at a friend's wedding, a girl in a green dress walked straight into him and spilled a glass of orange juice down his white shirt.",
    },
    {
      kind: 'short',
      marks: 2,
      stem: 'According to Paragraphs 2–3, who do Atuk and Nenek each say was responsible for the spilled juice?',
      answer:
        'Atuk says the girl walked into him on purpose because she had been watching him all evening; Nenek says Atuk had been watching her and stepped backwards into her on purpose.',
      evidence:
        'He had waited beside the drinks table for an hour, and when she came for a drink, he stepped backwards into her on purpose.',
      rubric:
        '两分：两个版本各 1 分。①Atuk 的说法：是那个女孩撞上他的，而且不是意外 / 她整晚都在看他（写出「她撞他」并带出「故意」或「她一直在看他」之一即可）。②Nenek 的说法：是 Atuk 一直在看她、在饮料桌旁等了一个小时，故意往后退撞到她（写出「是他故意撞她」即可）。只写「橙汁洒了」「白衬衫弄脏了」这类两人都认的细节不给分。',
    },
    {
      kind: 'short',
      marks: 2,
      stem: 'Using your own words, explain what Atuk asked the writer to do in Paragraph 5, and the reason he gave.',
      answer:
        "He asked the writer to use Nenek's story in the video, because he had told it his own way for fifty years and felt that she deserved to win for once.",
      evidence: '"Fifty years I have told it my way," he said. "She should win once."',
      rubric:
        '两分：两问各 1 分。①请作者在短片里用 Nenek 的版本（「用她的说法」「让她的版本进短片」均可）。②理由：这个故事他按自己的说法讲了五十年，这一次该让她赢（写出「他已经讲了五十年」或「该让她赢一次」任一即可）。答「他怕 Nenek 生气」「他记错了」原文没有依据，不给分。',
    },
    {
      kind: 'short',
      marks: 2,
      stem: 'According to Paragraph 7, what did the writer finally do with the video? Give TWO details.',
      answer:
        "The writer used both versions, one straight after the other, and ended the video with the moment when Atuk and Nenek pointed at each other.",
      evidence:
        'In the end I used both, one straight after the other, and I finished with the moment when they pointed at each other.',
      rubric:
        '两分：两点各 1 分。①两个版本都用了，一个紧接着一个（「两个都放」「先放一个再放另一个」均可）。②短片最后停在两人同时指着对方的那一刻。只写理由「选哪个都有人会失望」是原因、不是做法，不给分。',
    },
    {
      kind: 'short',
      marks: 2,
      stem: "According to Paragraph 9, what happened when the writer's mother, as a girl, asked each grandparent alone about how they met?",
      answer: "Atuk told her Nenek's version of the story, and Nenek told her Atuk's version.",
      evidence: "Atuk told her Nenek's version, and Nenek told her Atuk's.",
      rubric:
        '两分：两点各 1 分。①Atuk 讲的是 Nenek 的版本。②Nenek 讲的是 Atuk 的版本。写「两个人讲的都是对方的版本」也给两分。只写「妈妈从小听过两种说法」不给分——那是她平时听到的，不是单独问时的结果。',
    },
  ],
};

// ═══════════════════════════════════════════════════════════════
// 周二 —— Come for Dinner
//
// 作者和 Charmaine 从中二开学起做好朋友，却从没请她到家里来：妈妈中二开学时只在巴士站
// 见过她一次（她笑得很大声），同一年作者数学从 A 掉到 C，妈妈就把两件事连在一起。
// Charmaine 察觉后，伤心的不是「你妈不喜欢我」，而是「你让她这样认定了两年」。
// 冷战一周后作者请她来吃晚饭；饭桌上很别扭，饭后妈妈只说了一句「她把鱼都吃完了」。
// 妈妈不写成反派：她工作很辛苦、担心成绩，从没说过不许来往，听说要来吃饭先问
// 对方爱吃什么。结局那句话留给读者判断。
// 不写群聊、语音、代写作业、作弊；和 The Cheapest Thing on the Menu（朋友背后
// 有隐情）、Two Places at Once（对老师说谎自己在哪）不是一个内核。
// 时间：中二开学认识、同时妈妈在巴士站见过她一次、中三八月（学期中，有课间）冲突，
// 相隔约一年七个月 —— 原文统一写「almost two years」。
// ═══════════════════════════════════════════════════════════════

const COME_FOR_DINNER = {
  key: 'original-w6-come-for-dinner',
  title: 'Come for Dinner',
  passage: numbered([
    `Charmaine and I have been best friends since the start of Secondary Two. I have been to her flat more times than I can count, and her grandmother keeps a packet of my favourite biscuits in the cupboard. In all that time, Charmaine has never once been to mine.`,
    `That is because of my mother. She met Charmaine only once, at a bus stop at the beginning of Secondary Two, when Charmaine was laughing so loudly that people turned to look. That same year, my Maths grade dropped from an A to a C. My mother decided that these two facts were connected. She never told me to stop seeing Charmaine. She only asked, whenever Charmaine's name came up, "Is that the loud one?"`,
    `My mother works long hours and worries about my grades the way other people worry about the weather. I did not want to give her anything else to worry about, so I never invited Charmaine home. We studied at her flat or at the library, and I told myself I was keeping things simple.`,
    `In August, on the way home from a classmate's birthday party, Charmaine asked the question I had been avoiding for almost two years. "Why have I never been to your house?" I said something about our flat being small and messy. She stopped walking. "Your mum doesn't like me, does she?" I opened my mouth, and nothing came out. My cheeks went red, and I looked down at my shoes. That was answer enough.`,
    `I expected her to be upset with my mother. She was not. "She decided about me in five minutes at a bus stop," she said. "And you let her keep deciding for almost two years." Then she crossed the road to her block without saying goodbye.`,
    `For a week she answered my messages with one word and sat with other people at recess. I spent that week slamming my locker door and telling myself that none of it was my fault.`,
    `On Friday I asked Charmaine to come for dinner the next day. She took a moment before she said yes. That evening I told my mother. She put down her pen. "The loud one?" "Her name is Charmaine," I said. My voice came out higher than usual, and I kept my hands in my pockets so that she would not see them shaking. My mother looked at me for a long time. Then she asked what Charmaine liked to eat.`,
    `The dinner was not easy. My mother asked about Charmaine's grades before we had even started eating, and Charmaine answered every question politely, in a voice so quiet that I hardly recognised it. Nobody laughed once. When my mother offered her more steamed fish, Charmaine said, "Yes, please, Auntie," and I kicked her gently under the table. She kicked me back, and for the first time all evening, I could breathe properly.`,
    `After I had walked her to the lift, I found my mother washing the dishes. I waited. For a long time she said nothing. Then she said, "She finished all the fish," and went on washing. I still do not know exactly what she meant. Charmaine says it is the nicest thing anyone's mother has ever said about her.`,
  ]),
  questions: [
    {
      kind: 'matchingFeelings',
      bank: ['embarrassed', 'annoyed', 'nervous', 'relieved', 'bored', 'curious', 'proud', 'grateful'],
      items: [
        { moment: "Paragraph 4 — when Charmaine asks whether the writer's mum likes her", answer: 'embarrassed', para: 4 },
        { moment: 'Paragraph 6 — during the week after Charmaine walks off', answer: 'annoyed', para: 6 },
        { moment: "Paragraph 7 — telling the writer's mother about the dinner", answer: 'nervous', para: 7 },
        { moment: 'Paragraph 8 — when Charmaine kicks the writer back under the table', answer: 'relieved', para: 8 },
      ],
    },
    {
      kind: 'mcq',
      stem: 'In Paragraph 5, what does Charmaine mean by "you let her keep deciding for almost two years"?',
      answer: 'The writer never gave the mother a chance to change her opinion.',
      distractors: [
        'The writer let the mother choose all of her friends.',
        'The writer had agreed with the mother for two years.',
        'The mother had spent two years trying to decide.',
      ],
      evidence: '"And you let her keep deciding for almost two years."',
    },
    {
      kind: 'gapChoice',
      stem: "Charmaine's grandmother keeps a packet of the writer's favourite ______ in the cupboard.",
      answer: 'biscuits',
      distractors: ['fish', 'sweets', 'cakes'],
      evidence:
        'I have been to her flat more times than I can count, and her grandmother keeps a packet of my favourite biscuits in the cupboard.',
    },
    {
      kind: 'short',
      marks: 2,
      stem: "According to Paragraph 2, give TWO reasons why the writer's mother had a poor opinion of Charmaine.",
      answer:
        "The only time she met Charmaine, at a bus stop, Charmaine was laughing so loudly that people turned to look; and in the same year the writer's Maths grade fell from an A to a C, which the mother linked to Charmaine.",
      evidence: 'That same year, my Maths grade dropped from an A to a C. My mother decided that these two facts were connected.',
      rubric:
        '两分：两点各 1 分。①唯一一次见面（在巴士站）时，Charmaine 笑得太大声，路人都回头看（答「妈妈叫她 the loud one / 觉得她太吵」也算这一点）。②同一年作者数学从 A 掉到 C，妈妈认为跟 Charmaine 有关（只写「成绩下降」而没有和 Charmaine 连起来，也给这 1 分）。第 3 段「妈妈工作辛苦、担心成绩」不是她对 Charmaine 有看法的原因，不给分。',
    },
    {
      kind: 'short',
      marks: 2,
      stem: 'Using your own words, explain why the writer never invited Charmaine home (Paragraph 3).',
      answer:
        'The writer\'s mother already works very long hours and is always anxious about the writer\'s results, and the writer did not want to add another worry for her.',
      evidence: 'I did not want to give her anything else to worry about, so I never invited Charmaine home.',
      rubric:
        '两分：第 3 段只有一条因果链，拆成前因、后果两点，各 1 分。①前因：妈妈工作时间很长、本来就一直为作者的成绩操心（写出「工作辛苦」或「总担心成绩」任一即可）。②后果：所以作者不想再给妈妈添一件要担心的事。只写①没写②、或只写②没写①，都只给 1 分。只答第 2 段的「妈妈对 Charmaine 印象不好 / 觉得她是 the loud one」不给分——本题限定第 3 段、问的是作者自己的理由。只写「为了简单省事」也不给分——那是作者对自己说的话，不是原因。',
    },
    {
      kind: 'short',
      marks: 2,
      stem: "How did the writer's mother react when she heard about the dinner (Paragraph 7)? Give TWO details.",
      answer:
        'She put down her pen, asked "The loud one?", looked at the writer for a long time and then asked what Charmaine liked to eat.',
      evidence: 'My mother looked at me for a long time. Then she asked what Charmaine liked to eat.',
      rubric:
        '两分：以下四点任答两点，各 1 分：①放下了笔；②问「是那个吵的吗？」；③盯着作者看了很久；④问 Charmaine 爱吃什么。作者自己「声音变高、手在发抖」是作者的反应，不给分。',
    },
    {
      kind: 'short',
      marks: 2,
      stem: "According to Paragraph 9, what did the writer's mother say after dinner, and what does Charmaine think of it?",
      answer:
        'She said, "She finished all the fish," and Charmaine thinks it is the nicest thing anyone\'s mother has ever said about her.',
      evidence: "Charmaine says it is the nicest thing anyone's mother has ever said about her.",
      rubric:
        '两分：两问各 1 分。①妈妈说「她把鱼都吃完了」。②Charmaine 认为这是别人的妈妈对她说过的最好听的话。只写「作者不知道妈妈是什么意思」不给第二分——题目问的是 Charmaine 的看法。',
    },
  ],
};

// ═══════════════════════════════════════════════════════════════
// 周三 —— The Wobble
//
// 作者做什么都图快，表哥送了十节社区中心拉坯课，卡片上写「慢一点」。第一课
// 「定中心」怎么都做不好：越用力泥越晃，还甩飞过一次。同班退休巴士司机 Uncle Siva
// 的碗永远是歪的，他却不在乎——开了三十一年巴士，这是第一件没有人在等他的事。
// 第五周作者把手肘抵住膝盖、不再跟泥较劲，第一次定正；老师随手把它压平说「再来」，
// 作者笑了。结尾不说「我学到了」，只写他现在周六总是最后一个走。
// 不写跑步、深水区、左手写字、魔方；没有要克服的恐惧，不送礼物，家长不出场。
// 拉坯技术只写通行的入门要点：手沾水、双手压住旋转的泥、手肘抵住身体 / 膝盖、
// 让转盘带着走，泥不在正中间做出来的东西就会晃。
// ═══════════════════════════════════════════════════════════════

const WOBBLE = {
  key: 'original-w6-the-wobble',
  title: 'The Wobble',
  passage: numbered([
    `I do everything fast. I finish tests early, I eat faster than my father, and I walk so quickly that my friends have stopped trying to keep up. So when my cousin gave me a pottery course for my birthday, with a card that said "Slow down", I thought it was a joke. It was ten Saturday mornings at the community centre.`,
    `There were seven of us, and I was the only one under forty. The oldest was a retired bus driver called Uncle Siva. Our teacher, Madam Koh, dropped a lump of wet clay onto the middle of each wheel and told us that before we could make anything, we had to centre it. "If the clay is not in the centre," she said, "everything you make will wobble."`,
    `It looked easy. You wet your hands, press the spinning clay with both palms and keep pressing until it runs smoothly under them. I pressed hard. The clay leaned one way, then the other, and then it flew off the wheel and hit the wall behind me. Everyone turned round. My ears burned, and I picked it up and said, "One more time," before anyone could say anything.`,
    `The next two Saturdays were the same. The harder I pressed, the more the clay jumped. Once Madam Koh put her hands over mine and said, "You are pushing it as if you want to win. It is not playing against you." I nodded. By the end of the third class I was gripping so hard that my wrists ached, and I wanted to hit the wheel.`,
    `Uncle Siva was not much better than me. His bowls leaned, and one had a thumbprint right in the middle of the bottom. He hummed while he worked, and when a pot fell over, he laughed and squashed it back into a ball. What was the point of coming every week if you never got better?`,
    `In the fourth week, I asked him. He thought about it while his wheel went round. He said that for thirty-one years he had driven a bus to a timetable, and that this was the first thing in his life where nobody was waiting for him to arrive.`,
    `The next Saturday, I pressed my elbows against my knees, the way Madam Koh had shown us on the first day, and I stopped fighting. I let the wheel do the work. Slowly the clay stopped jumping. It turned smooth and quiet under my hands, like a stone at the bottom of a river. My shoulders came down, and my breathing slowed until I could hear the wheel.`,
    `Madam Koh came over and watched the clay spin for a while. Then she nodded, pressed it flat with the side of her hand and said, "Good. Now do it once more." A month earlier, I would have been furious. Instead I laughed out loud, and Uncle Siva laughed too, although he had not seen what happened.`,
    `I have finished nine classes now. I have made two bowls, and both of them lean. I still walk fast, and I still finish tests early. But on Saturday mornings I am usually the last person to leave, and last week Uncle Siva had to remind me that the community centre was closing.`,
  ]),
  questions: [
    {
      kind: 'matchingFeelings',
      bank: ['embarrassed', 'frustrated', 'calm', 'amused', 'jealous', 'lonely', 'guilty', 'bored'],
      items: [
        { moment: 'Paragraph 3 — when the clay hits the wall and everyone turns round', answer: 'embarrassed', para: 3 },
        { moment: 'Paragraph 4 — at the end of the third class', answer: 'frustrated', para: 4 },
        { moment: "Paragraph 7 — when the clay turns smooth under the writer's hands", answer: 'calm', para: 7 },
        { moment: 'Paragraph 8 — after Madam Koh presses the clay flat', answer: 'amused', para: 8 },
      ],
    },
    {
      kind: 'mcq',
      stem: 'In Paragraph 4, what does Madam Koh mean when she says, "You are pushing it as if you want to win"?',
      answer: 'The writer was fighting the clay as if it were an opponent.',
      distractors: [
        'The writer was trying to finish before the other students.',
        'The writer was pressing too gently to move the clay.',
        'The writer wanted to enter a pottery competition.',
      ],
      evidence: '"You are pushing it as if you want to win. It is not playing against you."',
    },
    {
      kind: 'gapChoice',
      stem: "One of Uncle Siva's bowls had a ______ right in the middle of the bottom.",
      answer: 'thumbprint',
      distractors: ['crack', 'hole', 'stone'],
      evidence: 'His bowls leaned, and one had a thumbprint right in the middle of the bottom.',
    },
    {
      kind: 'short',
      marks: 2,
      stem: 'According to Paragraph 1, give TWO examples of the writer doing things fast.',
      answer:
        'The writer finishes tests early, eats faster than the writer\'s father, and walks so quickly that friends have stopped trying to keep up.',
      evidence: 'I finish tests early, I eat faster than my father, and I walk so quickly that my friends have stopped trying to keep up.',
      rubric:
        '两分：以下三点任答两点，各 1 分：①考试总是早早做完；②吃饭比爸爸还快；③走路快到朋友都不再想跟上。表哥卡片上写的「慢一点」不是作者做事快的例子，不给分。',
    },
    {
      kind: 'short',
      marks: 2,
      stem: 'Using your own words, explain why Uncle Siva came to the class every week (Paragraph 6).',
      answer:
        'For over thirty years his job had been driving a bus that always had to keep to a schedule, and pottery was the first thing in his life where nobody was waiting for him and he did not have to hurry.',
      evidence:
        'He said that for thirty-one years he had driven a bus to a timetable, and that this was the first thing in his life where nobody was waiting for him to arrive.',
      rubric:
        '两分：两点各 1 分。①他开了三十一年巴士，一直要按时刻表赶时间。②拉坯是他这辈子第一件没有人在等他、不用赶的事。只写「他喜欢哼歌 / 喜欢做陶」不给分。第 5 段「他不在乎碗歪」是作者看到的样子，不是他说的原因，不给分。',
    },
    {
      kind: 'short',
      marks: 2,
      stem: 'According to Paragraph 7, what TWO things did the writer do differently the next Saturday?',
      answer: 'The writer pressed both elbows against the knees, as Madam Koh had shown the class, and stopped fighting the clay and let the wheel do the work.',
      evidence: 'I let the wheel do the work.',
      rubric:
        '两分：两点各 1 分。①把手肘抵在膝盖上（照老师第一天教的做）—— 这一分必须写出「手肘抵住膝盖」才给。②不再跟泥较劲 / 让转盘带着走：stopped fighting 和 let the wheel do the work 是同一个做法，合起来只算这 1 分；只写这两句、没写手肘，最多 1 分。「泥变得平滑安静」是结果，不是作者的做法，不给分。',
    },
    {
      kind: 'short',
      marks: 2,
      stem: 'According to Paragraph 9, what has stayed the same for the writer, and what has changed?',
      answer:
        'The writer still walks fast and finishes tests early, but on Saturday mornings is now usually the last person to leave the class.',
      evidence: 'But on Saturday mornings I am usually the last person to leave, and last week Uncle Siva had to remind me that the community centre was closing.',
      rubric:
        '两分：两问各 1 分。①没变的：还是走路快、考试早交（答「做的两个碗都是歪的」也给这 1 分）。②变了的：周六上课他通常是最后一个走的（答「上周 Uncle Siva 还得提醒他社区中心要关门了」也给这 1 分）。',
    },
  ],
};

// ═══════════════════════════════════════════════════════════════
// 周四 —— Four Numbers
//
// 作者训练后坐巴士回家，旁边一个穿衬衫、挂工作证的年轻上班族正对着电话一位一位
// 念验证码，电话那头说是银行在做安全检查。车窗上方正好有张看过一百遍却没读过的
// 防骗海报。全车人都各看各的；作者犹豫再三，在手机上打「银行从不要验证码」举给他看，
// 被他皱眉转身挡开；过了两站他却问起对方姓名、放下电话、下一站一声不吭下了车。
// 结局开放：作者不知道那是不是骗局，也不知道自己的举动有没有用。
// 受骗人不写成拿手机的老人（避开 The Photograph on the MRT），也不是捡手机 / 钱包；
// 不是在岗的大人，也没有正面对峙。
// 防骗只写通行说法：「银行不会问你要发到你手机上的验证码」（新加坡银行和警方的
// 公开宣传都这样说，把握很大）；不写验证码几位数、不写具体诈骗手法和数字。
// ═══════════════════════════════════════════════════════════════

const FOUR_NUMBERS = {
  key: 'original-w6-four-numbers',
  title: 'Four Numbers',
  passage: numbered([
    `The bus was almost full when I got on after netball training, so I took the last seat, next to a young man in an office shirt with a card on a string round his neck. He was on the phone. He spoke quietly, but the bus was so quiet that everyone near him could hear.`,
    `"Yes, speaking," he was saying. "Yes, I received it." Then, slowly, as if he were reading from his screen: "Four... seven... one..." Above the window in front of us there was a poster I had seen a hundred times without reading. It said that banks will never ask you for the code they send to your phone. I looked at the poster, then at him, then at the poster again.`,
    `He stopped after three numbers, because the person on the other end was talking. "Yes, from the bank," he repeated, nodding. "A security check. OK." I looked round. The auntie across the aisle was asleep. The boy behind us had his headphones on. A woman near the door was staring at her phone so hard that I was sure she had heard every word.`,
    `It was none of my business. He was an adult with a job and a card round his neck, and he probably knew much more about banks than I did. If I was wrong, I would be the strange schoolgirl who had listened to a stranger's phone call and then told him how to live. My heart was beating so hard that I could feel it in my ears.`,
    `He said, "Nine," and I did something I had never done before. I took out my phone, typed BANKS NEVER ASK FOR THE CODE in capital letters and held the screen up where he could see it.`,
    `He frowned at me as if I had interrupted him in an important meeting. Then he turned his shoulder away and said into the phone, "Sorry, go on." My face went hot. I put my phone back in my bag and looked out of the window, and for two stops I wished I were somewhere else.`,
    `Then, without looking at me, he stopped reading out the numbers. He asked the caller, "What is your name?" After a moment, he asked again. Then he took the phone away from his ear and stared at it, and I could not tell whether the call had ended or whether he had ended it. He sat very still.`,
    `At the next stop he got off without a word. Through the window I watched him standing on the pavement with the phone in his hand, not calling anyone, not walking anywhere. I wanted to get off too, but the doors had already closed. I twisted round in my seat as the bus pulled away, and there was nothing I could do except watch him get smaller.`,
    `I still do not know whether I did the right thing, or whether it was really the bank. I do not know whether the four numbers he had already read out were enough, or whether my phone screen made any difference at all. I take the same bus every Thursday, and I have not seen him again. But I have read the poster now, all the way to the bottom.`,
  ]),
  questions: [
    {
      kind: 'matchingFeelings',
      bank: ['suspicious', 'nervous', 'embarrassed', 'helpless', 'jealous', 'bored', 'proud', 'amused'],
      items: [
        { moment: 'Paragraph 2 — looking from the poster to the young man', answer: 'suspicious', para: 2 },
        { moment: 'Paragraph 4 — deciding whether to get involved', answer: 'nervous', para: 4 },
        { moment: 'Paragraph 6 — for the next two stops', answer: 'embarrassed', para: 6 },
        { moment: 'Paragraph 8 — as the bus pulls away from the young man', answer: 'helpless', para: 8 },
      ],
    },
    {
      kind: 'mcq',
      stem: 'In Paragraph 9, what does "I have read the poster now, all the way to the bottom" suggest?',
      answer: 'She now pays attention to a warning she used to ignore.',
      distractors: [
        'She has learned every poster on the bus by heart.',
        'She now takes a different bus to avoid the man.',
        "She is looking for the young man's face on it.",
      ],
      evidence: 'But I have read the poster now, all the way to the bottom.',
    },
    {
      kind: 'gapChoice',
      stem: 'On the bus, the auntie across the aisle was ______.',
      answer: 'asleep',
      distractors: ['nodding', 'reading', 'eating'],
      evidence: 'The auntie across the aisle was asleep.',
    },
    {
      kind: 'short',
      marks: 2,
      stem: 'According to Paragraph 2, what was the young man doing on the phone, and what did the poster say?',
      answer:
        'He was slowly reading out numbers, as if from his screen, and the poster said that banks will never ask you for the code they send to your phone.',
      evidence: 'It said that banks will never ask you for the code they send to your phone.',
      rubric:
        '两分：两问各 1 分。①他在一个一个地念数字（写「念一串号码 / 念验证码」也算；只写「在打电话」不给分）。②海报说银行从来不会问你要它发到你手机上的验证码。',
    },
    {
      kind: 'short',
      marks: 2,
      stem: 'Using your own words, give TWO reasons from Paragraph 4 why the writer felt she should stay out of it.',
      answer:
        "It was not her concern; he was a grown-up with a job who probably understood banks better than she did; and if she was mistaken, she would look like an odd schoolgirl who had listened to a stranger's call and then told him what to do.",
      evidence: 'He was an adult with a job and a card round his neck, and he probably knew much more about banks than I did.',
      rubric:
        '两分：以下三点任答两点，各 1 分：①这不关她的事；②他是有工作的大人，大概比她更懂银行 —— 原文 an adult with a job 和 knew much more about banks 说的是同一个理由（他是大人、比她懂），两样都写也只算这 1 分，不能拆成两点；③万一她弄错了，她就成了偷听陌生人电话、还教人家怎么做事的怪学生。只写「她心跳得很厉害」是她的感受，不是理由，不给分。',
    },
    {
      kind: 'short',
      marks: 2,
      stem: 'How did the young man react when the writer held up her phone (Paragraph 6)? Give TWO details.',
      answer:
        'He frowned at her as if she had interrupted an important meeting, turned his shoulder away and said "Sorry, go on" into the phone.',
      evidence: 'He frowned at me as if I had interrupted him in an important meeting.',
      rubric:
        '两分：以下三点任答两点，各 1 分：①冲她皱眉，像是开重要会议被打断一样；②把肩膀转过去背对她；③对着电话说「抱歉，你继续」。第 7 段他后来问对方姓名、放下电话，不是这一刻的反应，不给分。',
    },
    {
      kind: 'short',
      marks: 2,
      stem: 'According to Paragraph 7, what did the young man do after he stopped reading out the numbers? Give TWO details.',
      answer:
        "He asked the caller's name twice, then took the phone away from his ear, stared at it and sat very still.",
      evidence: 'Then he took the phone away from his ear and stared at it, and I could not tell whether the call had ended or whether he had ended it.',
      rubric:
        '两分：以下三点任答两点，各 1 分：①问对方叫什么名字（问了两次，算一点）；②把手机从耳边拿开、盯着看（「拿开」「盯着看」合起来算一点）；③一动不动地坐着。「通话结束了」原文说作者看不出是谁挂的，不能当作他做的事，不给分。',
    },
  ],
};

// ═══════════════════════════════════════════════════════════════
// 周五 —— The Leak
//
// 中三，作者负责全班的愚人节整蛊：趁班主任 Mrs Menon 来之前把课桌全转向后墙。
// 第二周她下课时随口一句「这里的课桌很重，而且是朝前的」。作者认定有内奸，挑出
// 三个嫌疑人，给每人讲一个不同的假计划（把钟调快、全班换座位互报名字、藏白板笔），
// 看哪个传到她耳朵里。第二天她一口气把三个全点了。反转：没有内奸 —— 教了二十二年，
// 每届学生都玩这四样；看到全班三月里窃窃私语就先提醒课桌，一周后还在窃窃私语就提醒
// 其余三样。结果全班那天什么也没干，她说这是这些年最好的愚人节。
// 伏笔（前文不说破）：计划四分钟就定了、作者吹「全校史上没人想到过」、老师在校
// 二十来年、Bryan 听了说「哦，那个啊」、Pei Shan 听完有点失望。
// 不写魔术失手、名字被念错；和 The Early Alarm / The Wrong List（主人公自己搞错）
// 不是一个笑点。新加坡四月初是第二学期上课时间。「在校二十年 + 带他们两年多」
// = 「二十二年」，前后对得上。
// ═══════════════════════════════════════════════════════════════

const LEAK = {
  key: 'original-w6-the-leak',
  title: 'The Leak',
  passage: numbered([
    `Mrs Menon has been our form teacher since Secondary One, and she taught at our school for twenty years before that. She is small and calm, and she always seems to know what we are going to do before we do it. In Secondary Three, I decided to find out how.`,
    `In March our class began planning something for April Fool's Day, and I was in charge. It took us about four minutes to agree: early on the first of April, before she arrived, we would turn every desk to face the back wall. Nobody in the history of the school, I told the class, had ever thought of anything like it.`,
    `The next Monday, Mrs Menon closed her book at the end of the lesson and said, to nobody in particular, "By the way, the desks in this room are very heavy, and they face the front." Then she walked out. I narrowed my eyes and looked slowly round the room, wondering which of them had told her.`,
    `I spent the next week making a list of suspects, and cut it down to three. Bryan, our class chairman, talks to teachers more than anyone else. Nabilah helps Mrs Menon carry her books every morning. Pei Shan has never kept a secret for more than an hour in her life.`,
    `Then I had my best idea of the year: I would tell each of them a different secret plan. Bryan would hear that we were going to set the classroom clock ten minutes fast, Nabilah that we were all going to swap seats, and Pei Shan that we were going to hide every whiteboard marker. Whichever plan reached Mrs Menon would show me the spy. That night I lay grinning at the ceiling.`,
    `The next day I told each of them separately, in a whisper, and made each one promise to keep it secret. Bryan said, "Oh, that one," which I thought was a strange thing to say. Nabilah only nodded. Pei Shan looked a little disappointed.`,
    `The following morning, Mrs Menon began her lesson by saying that she would like the clock left alone, everyone in their own seats and all her markers where she could find them. Then she opened her book as if nothing had happened. My mouth fell open. That was impossible. I had told each plan to only one person.`,
    `After the lesson I followed her to the staff room and asked how she knew. In twenty-two years, she said, every class had tried the same four things: the desks, the clock, the seats and the markers. When a class started whispering in March, she warned them about the desks. If they were still whispering a week later, she warned them about the rest. "Nobody told me anything," she said. I thought about my list of suspects, and my face began to burn.`,
    `Before I left, I asked whether any class had ever thought of something new. "Not yet," she said. "I will let you know." In the end we did nothing on the first of April. We sat at our desks, facing the front, under a clock that was exactly right. Mrs Menon said it was the best April Fool's Day she had had in years.`,
  ]),
  questions: [
    {
      kind: 'matchingFeelings',
      bank: ['suspicious', 'proud', 'astonished', 'foolish', 'lonely', 'jealous', 'bored', 'grateful'],
      items: [
        { moment: "Paragraph 3 — after Mrs Menon's remark about the desks", answer: 'suspicious', para: 3 },
        { moment: 'Paragraph 5 — the night after thinking of the new plan', answer: 'proud', para: 5 },
        { moment: 'Paragraph 7 — hearing how Mrs Menon begins the lesson', answer: 'astonished', para: 7 },
        { moment: 'Paragraph 8 — listening to Mrs Menon in the staff room', answer: 'foolish', para: 8 },
      ],
    },
    {
      kind: 'mcq',
      stem: 'In Paragraph 6, what does Bryan\'s reply "Oh, that one" suggest?',
      answer: 'He had heard of this plan before.',
      distractors: [
        'He liked this plan more than the others.',
        'He had not been listening to the writer.',
        'He did not want to take part in the plan.',
      ],
      evidence: 'Bryan said, "Oh, that one," which I thought was a strange thing to say.',
    },
    {
      kind: 'gapChoice',
      stem: 'Nabilah helps Mrs Menon carry her ______ every morning.',
      answer: 'books',
      distractors: ['markers', 'bags', 'papers'],
      evidence: 'Nabilah helps Mrs Menon carry her books every morning.',
    },
    {
      kind: 'short',
      marks: 2,
      stem: "According to Paragraph 2, what was the class's first plan for April Fool's Day, and how did the writer describe it to the class?",
      answer:
        'Early on the first of April, before Mrs Menon arrived, they would turn every desk to face the back wall; the writer told the class that nobody in the history of the school had ever thought of anything like it.',
      evidence:
        'Nobody in the history of the school, I told the class, had ever thought of anything like it.',
      rubric:
        '两分：两问各 1 分。①计划：四月一日一早、老师来之前，把所有课桌转过去朝着后墙（写出「把课桌转向后面」即可）。②作者对全班说：全校有史以来从没有人想到过这样的点子。只写「花了四分钟就定下来」不给第二分——那是定计划用的时间，不是作者对计划的说法。',
    },
    {
      kind: 'short',
      marks: 2,
      stem: 'According to Paragraph 4, why did the writer suspect these students? Give the reasons for any TWO of them.',
      answer:
        'Bryan, the class chairman, talks to teachers more than anyone else; Nabilah helps Mrs Menon carry her books every morning; and Pei Shan has never kept a secret for more than an hour.',
      evidence: 'Pei Shan has never kept a secret for more than an hour in her life.',
      rubric:
        '两分：任答两个人的理由，各 1 分：①Bryan 是班长，比谁都爱跟老师说话；②Nabilah 每天早上帮 Mrs Menon 搬书；③Pei Shan 保守秘密从没超过一个小时。只写名字、不写理由不给分；同一个人的理由写两遍只算 1 分。',
    },
    {
      kind: 'short',
      marks: 2,
      stem: 'Using your own words, explain how the writer planned to find out who the spy was (Paragraph 5).',
      answer:
        'The writer would give each suspect a different made-up plan, and whichever plan Mrs Menon later mentioned would show which of the three had told her.',
      evidence: 'Whichever plan reached Mrs Menon would show me the spy.',
      rubric:
        '两分：两点各 1 分。①给三个嫌疑人每人讲一个不同的假计划。②之后看老师提到的是哪一个计划，就知道是谁告的密。只罗列三个计划的内容（调钟、换座位、藏白板笔）而没有说出「每人不同」这个做法，最多给第一分。',
    },
    {
      kind: 'short',
      marks: 2,
      stem: 'According to Paragraph 8, how did Mrs Menon really know about the plans?',
      answer:
        'In twenty-two years every class had tried the same four tricks, and when a class started whispering in March she warned them about the desks, then about the other three if they were still whispering a week later.',
      evidence: 'In twenty-two years, she said, every class had tried the same four things: the desks, the clock, the seats and the markers.',
      rubric:
        '两分：两点各 1 分。①经验：教了二十二年，每个班都试过同样的四样（课桌、钟、座位、白板笔）。②观察：看到班上三月里开始窃窃私语，就先提醒课桌；一周后还在窃窃私语，就提醒另外三样（写出其中一步即可）。只写「没有人告诉她」不给分——这只说明不是谁告的密，没有说她是怎么知道的。',
    },
  ],
};

const SPECS = [HOW_THEY_MET, COME_FOR_DINNER, WOBBLE, FOUR_NUMBERS, LEAK];

module.exports = {
  LEVEL,
  SPECS,
  DAYS: DATES.slice(0, SPECS.length).map((date, i) => buildAuthoredDay(SPECS[i], date)),
};
