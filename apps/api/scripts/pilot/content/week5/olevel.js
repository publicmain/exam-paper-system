/**
 * 第五周 —— **olevel（O-Level 标准）**档，全原创。
 *
 * 四五百词、九段，人物心理更曲折，言外之意更多。形状与第三、四周这一档一致：
 *   4 道情绪配对 · 1 道短语理解四选一 · 1 道原文填空 · 4 道两分主观题 —— 满分 14。
 *
 * 选题前把学生读过的 225 个标题逐个对过，避开「最后一圈」「红包」「巴士上的手机」
 * 「信」「献血」「集邮」「抛硬币」「外公外婆的老物件」「组屋」「熟食中心」等桥段。
 * 这一周偏向兼职 / 实习 / 志愿服务、家庭责任、公共场合的选择、和大人打交道，
 * 结局不全是「犯错—顿悟」，有开放式的。
 */

'use strict';

const { buildAuthoredDay, numbered } = require('../authored');
const { DATES } = require('./dates');

const LEVEL = 'olevel';

// ═══════════════════════════════════════════════════════════════
// 周一 —— A Finger's Width
//
// 假期在水上乐园当滑梯管理员，按身高线拦下一个差一指宽的孩子，孩子父亲当众施压，
// 一句「你很享受吧」戳中了作者。结局开放：作者不认为拦错了，却说不准自己为什么拦。
// 与读过的 The Rope at Pulau Ubin（矮个子女生过独木桥、教官跪地当台阶）只是都
// 涉及身高，内核不同：这里是「在岗位上执行规则 + 对自己动机的怀疑」。
// 身高线的来历只写「由造滑梯的人定的、乐园里谁也不能改」，这是通行做法，不写具体数字。
// ═══════════════════════════════════════════════════════════════

const FINGER = {
  key: 'original-w5-finger-width',
  title: "A Finger's Width",
  passage: numbered([
    `In the June holidays I got my first job, at a water park. I worked at the top of the tallest slide, where I checked every child against a wooden board with a red line painted across it. A child whose head did not reach the line could not go down. On my first morning, my supervisor, Mr Hakim, tapped the board and said, "This line is not yours to move." I liked that. For once in my life, a rule was on my side.`,
    `When a child was too short, most parents simply looked at the line, looked at their child and led them to the smaller slides without a word. I would like to say that I did not enjoy the moment when a child stepped up to the board and waited for me to decide. But I did. I stood a little straighter every time.`,
    `On the second Saturday, a man came up the stairs with a boy of about seven. The boy stood against the board with his back very straight, and the top of his head stopped about a finger's width below the red line. I looked twice, to be sure. Then I told the man, as politely as I could, that his son was not tall enough.`,
    `He laughed, as if I had made a joke. He said they had queued for forty minutes, and that the boy had been measured at school and was tall enough. Behind them, the queue went all the way down the stairs, and people were starting to look up. The boy was looking at the water.`,
    `The man came closer and lowered his voice. "Nobody is going to know," he said. When I did not move, he looked at me and said, "You're enjoying this, aren't you?" My face went hot. I wanted to tell him that he was wrong. The trouble was that he was not completely wrong. Until that moment, I had been enjoying it.`,
    `I said no again. My voice shook, and I was holding the rail so tightly that my hand hurt. The man said something I will not repeat, took his son by the hand and walked back down the stairs, past a queue of people who all watched him go.`,
    `For the rest of the afternoon, the board stopped being fun. When a child was too short, I said sorry, which I had never bothered to do before. During my break, Mr Hakim, who had heard about the man, came to find me. I asked him whether a finger's width really mattered. He said that the line had been set by the people who built the slide, not by him and not by me. "It isn't there for the good days," he said. "It's there for the one bad day that nobody sees coming."`,
    `Near closing time, I saw the boy on a small slide at the far end of the park. He went down it again and again, laughing. His father stood at the bottom with his arms folded, watching him the whole time. I let out a long breath and realised that I had been looking for them all afternoon.`,
    `I still work at the water park in the holidays. I do not think I was wrong to stop the boy that Saturday. What I am less sure about is why I stopped him. These days, when I notice myself standing a little straighter beside the board, I remember the man's question, and I let my shoulders drop.`,
  ]),
  questions: [
    {
      kind: 'matchingFeelings',
      bank: ['powerful', 'ashamed', 'nervous', 'relieved', 'bored', 'amused', 'grateful', 'jealous'],
      items: [
        { moment: 'Paragraph 2 — each time a child steps up to the board and waits for the decision', answer: 'powerful', para: 2 },
        { moment: "Paragraph 5 — hearing the man's question", answer: 'ashamed', para: 5 },
        { moment: 'Paragraph 6 — saying no to the man again', answer: 'nervous', para: 6 },
        { moment: 'Paragraph 8 — seeing the boy on the small slide near closing time', answer: 'relieved', para: 8 },
      ],
    },
    {
      kind: 'mcq',
      stem: 'In Paragraph 1, what does "This line is not yours to move" mean?',
      answer: 'The writer was not allowed to change the rule.',
      distractors: [
        'The writer should not stand too close to the board.',
        'The line had been painted in the wrong place.',
        'The writer would soon be sent to a different slide.',
      ],
      evidence: 'On my first morning, my supervisor, Mr Hakim, tapped the board and said, "This line is not yours to move."',
    },
    {
      kind: 'gapChoice',
      stem: 'When the boy stood against the board, he kept his ______ very straight.',
      answer: 'back',
      distractors: ['head', 'shoulders', 'arms'],
      evidence:
        "The boy stood against the board with his back very straight, and the top of his head stopped about a finger's width below the red line.",
    },
    {
      kind: 'short',
      marks: 2,
      stem: 'According to Paragraphs 4–5, give TWO reasons the man used to try to get his son onto the slide.',
      answer:
        'They had queued for forty minutes, the boy had been measured at school and was tall enough, and nobody was going to know.',
      evidence:
        'He said they had queued for forty minutes, and that the boy had been measured at school and was tall enough.',
      rubric:
        '两分：以下任意两点各 1 分：已经排了四十分钟队；孩子在学校量过、身高够了（「量过」和「够高」是同一点，合计只给 1 分）；没有人会知道。',
    },
    {
      kind: 'short',
      marks: 2,
      stem: 'Using your own words, describe TWO ways in which the writer changed after the man left (Paragraph 7).',
      answer:
        'The writer no longer found checking the children enjoyable, and started to apologise to children who were too short, which the writer had never done before.',
      evidence: 'When a child was too short, I said sorry, which I had never bothered to do before.',
      rubric:
        '两分：写出「作者不再觉得量身高这件事有意思 / 不再享受它」给 1 分；写出「孩子不够高时，作者会向他们道歉（以前从来懒得道歉）」再给 1 分。',
    },
    {
      kind: 'short',
      marks: 2,
      stem: 'According to Paragraph 7, what TWO things did Mr Hakim tell the writer about the line?',
      answer:
        'The line was set by the people who built the slide, not by him or the writer, and it is there not for the good days but for the one bad day that nobody expects.',
      evidence: 'He said that the line had been set by the people who built the slide, not by him and not by me.',
      rubric:
        '两分：写出「这条线是造滑梯的人定的，不是他、也不是作者定的」给 1 分；写出「它不是为平常的好日子设的，而是为谁也料不到的那一个出事的日子」再给 1 分。「不是他定的」「不是作者定的」合起来只算第一点；「不为好日子」「为那一个坏日子」合起来只算第二点。',
    },
    {
      kind: 'short',
      marks: 2,
      stem: 'In Paragraph 9, what does the writer believe about stopping the boy, and what is the writer less sure about?',
      answer:
        'The writer believes that stopping the boy was not wrong, but is less sure about the real reason for stopping him.',
      evidence: 'What I am less sure about is why I stopped him.',
      rubric:
        '两分：写出「作者认为拦下那个男孩没有做错」给 1 分；写出「作者说不准自己当时为什么拦他」再给 1 分（答成「不知道是为了规则 / 安全，还是因为享受做决定的感觉」也给这一分）。',
    },
  ],
};

// ═══════════════════════════════════════════════════════════════
// 周二 —— The Calculator Cover（替换 Five Stars）
//
// 年终生物考试，作者看见坐在前面的 Darren 把写满定义的小纸片贴在计算器盖子里。
// 去年作者忘带计算器，是 Darren 一声不吭把备用的递过来。考场上作者几次想举手又放下；
// 考完 Darren 找来解释、说「没人受害」、又提起那台计算器。作者没有举报，只跟他讲了
// 三句话：不举报、有人问不说谎、再犯不会再沉默。下一场物理考试开考前，Darren 把空的
// 计算器盖翻过来放在桌角。结局两难、开放：作者说不清给他第二次机会对不对 ——
// 那两百个自己埋头答题的同学，这个机会是不是作者有权替他们给的。
// 不写学校的具体考试规定和处分，只写「监考老师在行间走」「计算器盖子」这类通行场景。
// ═══════════════════════════════════════════════════════════════

const CALCULATOR = {
  key: 'original-w5-calculator-cover',
  title: 'The Calculator Cover',
  passage: numbered([
    `Darren has sat in front of me in every exam since Secondary One, because our names come one after the other on the class list. We are not close friends. But last year, before the Maths exam, he saw me searching my bag for the calculator I had left at home. Without a word, he passed me his spare one.`,
    `Twenty minutes into this year's Biology exam, I noticed Darren kept picking up his calculator. There are almost no sums in Biology. The fourth time, he turned the cover over, and over his shoulder I saw a small square of paper stuck inside it, covered in tiny blue writing. My pen stopped in the middle of a word, and I could not remember what the word was.`,
    `Mrs Chandran, the teacher in charge, walked slowly between the rows. Each time she came towards us, my hand started to rise. Each time she walked past, it was back on the desk. It was not my business, I told myself. Then I looked at the two hundred heads bent over their papers, and it felt very much like my business.`,
    `After the exam, Darren was waiting at the bottom of the stairs. "You saw," he said. It was not a question. It was only a few definitions, he told me quickly, and he knew everything else. But in exams his mind sometimes went blank, and he had been afraid of that happening again.`,
    `"Everybody does it," he said. "Nobody gets hurt." I thought of all the people in that hall, trying to remember the same definitions on their own, and I heard myself say, much louder than I meant to, "That's not true." Then, more quietly, he said, "I lent you my calculator last year." I did remember. That was the problem.`,
    `That night I lay awake making two lists in my head: reasons to tell and reasons not to. They were exactly the same length. On Monday I went as far as the staff room door and saw Mrs Chandran through the glass, behind a pile of exam papers. I stood there until a teacher asked if I needed something. I said no.`,
    `At recess that day I found Darren and told him three things. I would not report him. If anyone asked me, I would not lie. And if he ever did it again, I would not keep quiet a second time. He looked at me for a long moment, said, "Fair," and walked off. He did not speak to me for the rest of the week.`,
    `Before the Physics exam the next week, Darren took the cover off his calculator and laid it on the corner of his desk, inside facing up. It was empty. He did not turn round. Something in my chest that had been tight all week let go, and I picked up my pen.`,
    `I never told Mrs Chandran. Darren and I talk again now, though never about Biology. Some days I think I gave him a second chance, the way he once gave me his calculator without being asked. Other days I remember those two hundred heads bent over their papers, and I wonder whether I had any right to give it.`,
  ]),
  questions: [
    {
      kind: 'matchingFeelings',
      bank: ['shocked', 'hesitant', 'angry', 'relieved', 'bored', 'jealous', 'amused', 'proud'],
      items: [
        { moment: 'Paragraph 2 — the fourth time Darren picks up his calculator', answer: 'shocked', para: 2 },
        { moment: 'Paragraph 3 — each time Mrs Chandran comes towards their row', answer: 'hesitant', para: 3 },
        { moment: 'Paragraph 5 — answering Darren when he says that nobody gets hurt', answer: 'angry', para: 5 },
        { moment: 'Paragraph 8 — seeing what Darren does before the Physics exam', answer: 'relieved', para: 8 },
      ],
    },
    {
      kind: 'mcq',
      stem: 'In Paragraph 6, what does "They were exactly the same length" suggest?',
      answer: 'The reasons for and against telling felt equally strong.',
      distractors: [
        'The writer had written both lists on one page.',
        'The writer could think of only a few reasons.',
        'The writer had already decided to tell Mrs Chandran.',
      ],
      evidence: 'They were exactly the same length.',
    },
    {
      kind: 'gapChoice',
      stem: 'The square of paper inside the calculator cover was covered in tiny ______ writing.',
      answer: 'blue',
      distractors: ['black', 'red', 'green'],
      evidence: 'The fourth time, he turned the cover over, and over his shoulder I saw a small square of paper stuck inside it, covered in tiny blue writing.',
    },
    {
      kind: 'short',
      marks: 2,
      stem: 'According to Paragraph 4, what did Darren say to explain what he had done? Give TWO details.',
      answer:
        'It was only a few definitions, he knew everything else, and his mind sometimes went blank in exams, so he had been afraid of that happening again.',
      evidence: 'It was only a few definitions, he told me quickly, and he knew everything else.',
      rubric:
        '两分：以下三点任答两点，各 1 分：①（纸片上）只是几条定义；②其余的内容他都会；③考试时他的脑子有时会一片空白，他怕再出现这种情况（「脑子空白」和「怕再这样」合起来只算这一点）。第 5 段的「大家都这么做」「没人受害」「去年借过你计算器」不在本题范围内，不给分。',
    },
    {
      kind: 'short',
      marks: 2,
      stem: 'In Paragraph 5, why did the writer disagree when Darren said that nobody gets hurt?',
      answer:
        'Everyone else in the hall was trying to remember the same definitions without any help, so the cheating was unfair to them; they were the people being hurt.',
      evidence: 'I thought of all the people in that hall, trying to remember the same definitions on their own',
      rubric:
        '两分：写出「考场里的其他同学都在靠自己记同样的定义」给 1 分；写出「Darren 却有纸片帮忙，这对那些同学不公平 / 他们其实吃了亏，并不是没人受害」再给 1 分（「不公平」「他有帮助而别人没有」「别人吃亏」任一说法都算这一点）。只写「作弊不对 / 违反规定」而没有落到其他同学身上，不给分。',
    },
    {
      kind: 'short',
      marks: 2,
      stem: 'According to Paragraph 7, what did the writer tell Darren at recess? Give TWO of the three things.',
      answer:
        'The writer would not report him, would not lie if anyone asked, and would not keep quiet if he ever did it again.',
      evidence: 'If anyone asked me, I would not lie.',
      rubric:
        '两分：以下三点任答两点，各 1 分：①不会去举报他；②如果有人问起，作者不会说谎；③如果他再作弊，作者不会再保持沉默。只写 Darren 的回答「Fair」不给分。',
    },
    {
      kind: 'short',
      marks: 2,
      stem: 'Using your own words, describe the TWO different ways in which the writer now thinks about not reporting Darren (Paragraph 9).',
      answer:
        'On some days the writer feels that Darren was given another chance, just as Darren once helped the writer without being asked; on other days, remembering all the other students in the hall, the writer doubts having the right to let him off.',
      evidence: 'Other days I remember those two hundred heads bent over their papers, and I wonder whether I had any right to give it.',
      rubric:
        '两分：两种想法各 1 分。①有时觉得自己是给了 Darren 第二次机会，就像当年他没等作者开口就把计算器借出来一样（写出「给了他第二次机会」或「是在回报他当年的帮忙」任一即可）。②有时想到考场里那两百个埋头答题的同学，怀疑自己有没有权利放过他 / 给他这个机会（必须写出「怀疑自己有没有这个权利」；只写「想起考场里的同学」不给这 1 分）。',
    },
  ],
};

// ═══════════════════════════════════════════════════════════════
// 周三 —— Inside the Bear
//
// 上学期周末在商场穿熊玩偶服，规定不能开口。同班一个几乎没说过话的女生独自过来合影，
// 说今天是她生日。作者没摘头套，用一支很烂的舞把她逗笑；周一课间去图书馆坐到她旁边，
// 听她讲「那只熊」。与读过的「看轻了一个安静的人、后来发现对方很厉害」不是一个内核：
// 作者从头到尾没有看轻她，写的是「匿名时听到的真心话，怎么接住又不点破」。
// ═══════════════════════════════════════════════════════════════

const BEAR = {
  key: 'original-w5-inside-the-bear',
  title: 'Inside the Bear',
  passage: numbered([
    `Last term I got a weekend job at a shopping centre, wearing a bear costume. My supervisor, Mr Lau, gave me three rules. The bear never speaks. The bear never takes off its head where people can see. "And the bear," he said, "never has a bad day."`,
    `Inside, it was hot and dark and smelled of other people's sweat. I could see out only through a small net in the bear's mouth, so the world came to me in pieces: a hand, a shoe, a face coming close. After the first hour my shirt was wet through, but nobody could tell. The bear kept smiling.`,
    `I learned a lot about people that first weekend. Small children ran up to me and hugged my legs while their parents took photos. Boys my own age were the worst. They pulled my tail and punched my stomach to see if I would fall over, and one of them kicked me hard. Inside my paws, my hands closed into fists. The bear waved.`,
    `On Sunday afternoon I saw Shalini. She had been in my class since Secondary One, but we had never really talked. She sat at the back and spent recess in the library. She was walking alone, carrying a small cake box, and she came straight towards me.`,
    `For a moment I was sure she knew it was me. I stood very still and held my breath, as if she could hear it through the fur. But she only asked, a little shyly, whether she could take a photo with me. I nodded my big head.`,
    `After the photo we sat down together on a bench, and she looked at the cake box on her knees. "It's my birthday," she said quietly. "You're the first one who's taken a photo with me today." She laughed, but it was not really a laugh.`,
    `I wanted to take off the head and say, "Happy birthday, Shalini." But she had said it to a bear, not to me, and I thought she might feel embarrassed if she knew who had heard. The bear could not speak, so the bear would have to do something else. I made up my mind, stood up and did the worst dance of my life, right there in front of the escalators.`,
    `Shalini stared at me. Then she put her hand over her mouth and laughed, properly this time, until people turned to look. When she left, she waved at me all the way down the escalator.`,
    `On Monday, at recess, I went to the library and sat down next to her. I asked about her weekend. She showed me the photo and said that her birthday had been strange, but the best part had been a bear. I asked what the bear was like. "Kind," she said. "And a terrible dancer." I looked down at my book so that she would not see me smiling. "Sounds like a terrible dancer," I agreed.`,
  ]),
  questions: [
    {
      kind: 'matchingFeelings',
      bank: ['annoyed', 'anxious', 'determined', 'pleased', 'jealous', 'bored', 'lonely', 'disappointed'],
      items: [
        { moment: "Paragraph 3 — dealing with boys of the writer's own age", answer: 'annoyed', para: 3 },
        { moment: 'Paragraph 5 — when Shalini comes up to the bear', answer: 'anxious', para: 5 },
        { moment: 'Paragraph 7 — standing up in front of the escalators', answer: 'determined', para: 7 },
        { moment: 'Paragraph 9 — hearing what Shalini says about the bear', answer: 'pleased', para: 9 },
      ],
    },
    {
      kind: 'mcq',
      stem: 'In Paragraph 1, what does "the bear never has a bad day" mean?',
      answer: 'The bear must always seem happy, whatever the person inside feels.',
      distractors: [
        'The bear only works on days when the weather is good.',
        'Nothing bad ever happens inside the shopping centre.',
        'The costume must never be allowed to get dirty or torn.',
      ],
      evidence: '"And the bear," he said, "never has a bad day."',
    },
    {
      kind: 'gapChoice',
      stem: "Inside the costume, the writer could see out only through a small ______ in the bear's mouth.",
      answer: 'net',
      distractors: ['hole', 'window', 'gap'],
      evidence:
        "I could see out only through a small net in the bear's mouth, so the world came to me in pieces: a hand, a shoe, a face coming close.",
    },
    {
      kind: 'short',
      marks: 2,
      stem: "According to Paragraph 3, how did small children and boys of the writer's age treat the bear differently?",
      answer:
        "Small children ran up to the bear and hugged its legs, while boys of the writer's age pulled its tail, punched its stomach and kicked it.",
      evidence: 'Small children ran up to me and hugged my legs while their parents took photos.',
      rubric:
        '两分：写出「小孩子跑过来抱住熊的腿」给 1 分；写出「同龄男生扯尾巴、打肚子、踢它」（答出其中任一动作即可）再给 1 分。只写「家长在拍照」不给分。',
    },
    {
      kind: 'short',
      marks: 2,
      stem: 'What did Shalini tell the bear in Paragraph 6, and how can you tell that she was unhappy?',
      answer:
        'She said it was her birthday and the bear was the first to take a photo with her that day; she said it quietly, and her laugh afterwards was not a real laugh.',
      evidence: '"You\'re the first one who\'s taken a photo with me today." She laughed, but it was not really a laugh.',
      rubric:
        '两分：第 1 分：写出「今天是她生日」（可以连带「熊是今天第一个跟她合影的」，不另加分）。第 2 分：必须写出「她说得很轻（quietly）」或「她笑了，但不是真的在笑」，其中一点即可。只写「她一个人来的」「她拿着蛋糕盒」不给第 2 分。',
    },
    {
      kind: 'short',
      marks: 2,
      stem: "Using your own words, explain the reason given in Paragraph 7 for keeping the bear's head on.",
      answer:
        'Shalini had told her secret to a bear, not to a classmate, and the writer thought she might be embarrassed to find out who had been listening.',
      evidence: 'But she had said it to a bear, not to me, and I thought she might feel embarrassed if she knew who had heard.',
      rubric:
        '两分：写出「她是对一只熊说的，并不知道里面是作者」给 1 分；写出「作者怕她知道是谁听到了会难为情」再给 1 分。只写 she would be embarrassed（她会难为情）给 1 分。答第 1 段 Mr Lau 的规矩（熊不能摘头套 / 不能说话）不给分。',
    },
    {
      kind: 'short',
      marks: 2,
      stem: 'According to Paragraph 9, what did the writer do on Monday, and what did Shalini say the bear was like?',
      answer:
        'The writer went to the library at recess, sat down next to Shalini and asked about her weekend, and she said the bear was kind and a terrible dancer.',
      evidence: '"Kind," she said. "And a terrible dancer."',
      rubric:
        '两分：两问各 1 分。第一问：写出「课间去图书馆」「坐到她旁边」「问她周末过得怎样」其中任一点即给 1 分。第二问：kind 和 terrible dancer 两个都写出才给 1 分，只写一个不给分。',
    },
  ],
};

// ═══════════════════════════════════════════════════════════════
// 周四 —— Everything About Bruno
//
// 在动物收容所做义工，作者每周六遛一只没人要的老狗。有一家人看中它，作者一度只挑
// 缺点讲、想把人劝走，停下来把好的也讲了；狗被领走，结局苦乐参半。
// 「领养前把好坏都告诉对方、退回来的狗更可怜」是收容所的通行说法，不写具体规定。
// ═══════════════════════════════════════════════════════════════

const BRUNO = {
  key: 'original-w5-everything-about-bruno',
  title: 'Everything About Bruno',
  passage: numbered([
    `Bruno had been at the animal shelter longer than any other dog. He was nine, with a grey face, and he had been adopted twice and brought back twice. Most families who visited walked straight past his kennel to the puppies. I had been walking him every Saturday for eight months.`,
    `I knew everything about him. He snored. He pulled on the lead at first and then walked as slowly as an old man. He took medicine for his stiff knees, he was afraid of thunder and he hated cats. My mother is allergic to dogs, so I could not take him home. I told myself that this was fine, because every Saturday he was mine anyway.`,
    `Then, one Saturday in March, a couple came in with their son, Adam, who was about ten. They walked past the puppies and stopped at Bruno's kennel. Bruno got up, which he never did for visitors, and pushed his nose through the bars. I did not like the way he looked at the boy. That look was supposed to be for me.`,
    `The shelter manager, Mr Fernandez, let Bruno out to meet them. Mr Fernandez was busy with a sick cat, so he asked me to talk to the family. "Tell them everything," he said. "The good and the bad. A dog who is brought back is worse off than a dog who is never chosen."`,
    `So I told them everything bad. I told them about the snoring, the pulling and the thunder. I told them about the cats and the medicine. I told them he had been brought back twice. I watched the mother's face grow more and more doubtful, and I kept going.`,
    `Then I looked down. Adam was sitting on the floor with Bruno's head on his knee, and he had not heard a word. I heard my own voice, fast and cheerful, listing one bad thing after another, and I understood what I was doing. I was not telling them everything. I was telling them only the half that would make them leave. For a moment I could not look at any of them.`,
    `"He also sleeps through anything except thunder," I said, more slowly. "He never barks at children. And when he likes you, he leans against your legs so hard that you have to stand firmly or fall over." Adam laughed, because Bruno was doing exactly that. The parents looked at each other and nodded.`,
    `They took Bruno home two weeks later. I walked him to their car for the last time. He climbed into the back seat without looking round. I stood in the car park and waved until the car had turned the corner, although I knew he could not see me. By then, everything had gone blurry.`,
    `A month later, Mr Fernandez showed me a photo the family had sent. Bruno was asleep on a sofa with his head on Adam's knee. Underneath they had written: "He still pulls. We don't mind." I laughed out loud. Then I went to meet the new dog in Bruno's old kennel. He is young and barks at everything. I have not learned everything about him yet. I am not ready to.`,
  ]),
  questions: [
    {
      kind: 'matchingFeelings',
      bank: ['jealous', 'guilty', 'sad', 'happy', 'furious', 'bored', 'frightened', 'curious'],
      items: [
        { moment: 'Paragraph 3 — watching Bruno look at Adam', answer: 'jealous', para: 3 },
        { moment: 'Paragraph 6 — understanding what the family had been told so far', answer: 'guilty', para: 6 },
        { moment: 'Paragraph 8 — as the car drives away with Bruno', answer: 'sad', para: 8 },
        { moment: 'Paragraph 9 — reading the message under the photo', answer: 'happy', para: 9 },
      ],
    },
    {
      kind: 'mcq',
      stem: 'In Paragraph 4, what does Mr Fernandez mean by "A dog who is brought back is worse off than a dog who is never chosen"?',
      answer: 'Being returned hurts a dog more than staying at the shelter.',
      distractors: [
        'Dogs that are chosen quickly are usually the healthiest.',
        'Families should always choose the youngest dog they see.',
        'A family should bring a dog back if they are unhappy.',
      ],
      evidence: 'A dog who is brought back is worse off than a dog who is never chosen.',
    },
    {
      kind: 'gapChoice',
      stem: 'Bruno took medicine for his stiff knees, was afraid of ______ and hated cats.',
      answer: 'thunder',
      distractors: ['children', 'cars', 'rain'],
      evidence: 'He took medicine for his stiff knees, he was afraid of thunder and he hated cats.',
    },
    {
      kind: 'short',
      marks: 2,
      stem: 'According to Paragraph 1, give TWO reasons why it was hard for Bruno to find a home.',
      answer:
        'He had already been adopted and brought back twice, and he was old, at nine with a grey face, while most visiting families went straight to the puppies.',
      evidence: 'He was nine, with a grey face, and he had been adopted twice and brought back twice.',
      rubric:
        '两分：两点各 1 分。①「被领养过两次、又被送回来两次」算一点。②年纪大算一点：九岁、脸都灰了、来参观的家庭大多直接去看小狗，答出其中任一处即给这 1 分，写好几处也只算这一点。',
    },
    {
      kind: 'short',
      marks: 2,
      stem: 'According to Paragraph 2, why could the writer not take Bruno home, and why did the writer think that this was fine?',
      answer:
        "The writer's mother is allergic to dogs, and the writer thought it did not matter because every Saturday Bruno was the writer's dog anyway.",
      evidence: 'I told myself that this was fine, because every Saturday he was mine anyway.',
      rubric:
        '两分：两问各 1 分。第一问：写出「妈妈对狗过敏」给 1 分。第二问：写出「每个星期六它反正都是作者的」给 1 分。',
    },
    {
      kind: 'short',
      marks: 2,
      stem: 'Using your own words, explain what the writer realised in Paragraph 6.',
      answer:
        "The writer had been describing only Bruno's faults instead of the whole truth, and had been doing it so that the family would decide not to take him.",
      evidence: 'I was telling them only the half that would make them leave.',
      rubric:
        '两分：两点各 1 分。①「作者只讲了 Bruno 的坏处，没有好坏都讲」算一点（「只讲坏处」和「没有把全部告诉他们」是同一个意思，两句都写也只算 1 分）。②「作者这样讲，是想让这家人走掉、不领养它」算一点。答「想把 Bruno 留给自己」（要回第 3 段才推得出）也可以给这一分，但不是必须写的。',
    },
    {
      kind: 'short',
      marks: 2,
      stem: 'According to Paragraph 7, what TWO good things did the writer tell the family about Bruno?',
      answer:
        'He sleeps through everything except thunder, he never barks at children, and when he likes someone he leans against their legs very hard.',
      evidence: 'He never barks at children.',
      rubric:
        '两分：以下三点任答两点，各 1 分：①除了打雷什么都吵不醒它；②从不冲小孩叫；③喜欢一个人时会使劲靠在对方腿上。',
    },
  ],
};

// ═══════════════════════════════════════════════════════════════
// 周五 —— Dotted Letters
//
// 原来这一天写的是 Line Three（冷气公司接投诉、打来的是自己爸爸），语义查重与本周
// Five Stars 0.77、A Finger's Width 0.68 —— 都是「年轻人 + 岗位 + 难缠的大人」，整篇换掉。
// 主编首选的「名字被念错」没有用：第二周中级档 09-11 已发过原创 The Wrong Name
// （班主任念错重音、全班跟着叫、拖了八个月才纠正），同一个内核。
// 现在这篇只在学校和自己身上：右手骨折、用左手写字，一个几乎没说过话的同学在复印的
// 笔记里夹了一页描红字母；慢下来反而让作者学会了想清楚再写。结局开放：日记还用左手写，
// 还没告诉他。打石膏只写「六个星期」这一通行说法，不写医疗细节。
// ═══════════════════════════════════════════════════════════════

const DOTTED = {
  key: 'original-w5-dotted-letters',
  title: 'Dotted Letters',
  passage: numbered([
    `Two weeks before the mid-year exams, I slipped on the wet stairs outside the science lab and broke my right wrist. My arm went into a cast for six weeks. When I heard "six weeks", I thought only about the exams. I had always done things properly, and I had always done them alone. Now I could not even hold a pen.`,
    `The next morning I tried to take notes with my left hand. The letters came out large and shaky, like a Primary One child's, and by the time I had finished one line, the teacher was already on the next slide. My friends offered to share their notes. I said no, a little too quickly, and kept going. By the end of the day, even I could not read what I had written.`,
    `It was not only the writing. I could not open my water bottle, tie my hair or cut up my lunch. Every time someone did it for me, I said "Thanks" and smiled, and then wanted to shout at nobody in particular.`,
    `On Thursday there were three photocopied pages on my desk: the history notes I had missed. The name on the top page was Farid's. He sat behind me, and we had spoken perhaps twice. I put the pages in my bag without reading them, because reading them felt like admitting that I needed them.`,
    `That night a fourth sheet slipped out from between them onto the floor. It was a page of dotted letters from a to z to trace over, like the ones in a Primary One exercise book. At the top he had written: "Left hand. Ten minutes a day." I sat on the floor and read the words again and again, and my throat went tight. For the first time that week, I did not want to shout at anyone.`,
    `I did it that night, and every night after that. My a's stopped falling over. My e's closed. By the second week I could write a sentence that another person could read, and by the exams I could write a whole page, slowly.`,
    `Writing slowly turned out to matter. When one sentence took me a full minute, I stopped writing sentences that did not matter. In the history paper I wrote less than I had ever written, but I thought harder about every line. When the papers came back, I had my best mark of the year, and I kept that paper on top of my desk for a week, where I could see it.`,
    `The cast came off during the June holidays. On the first day back at school, I had a whole speech ready for Farid about the dotted letters, but what came out was "Thanks for the notes." He said, "They were only notes," and went back to his drawing. My ears went hot, and I walked back to my seat hoping that nobody had heard.`,
    `I write with my right hand again at school. But at night I write my diary with my left hand, one slow line at a time. It is the only place where I have enough time to find out what I actually think. I have not told Farid this yet. One day, I think, I might show him a page.`,
  ]),
  questions: [
    {
      kind: 'matchingFeelings',
      bank: ['frustrated', 'touched', 'proud', 'embarrassed', 'jealous', 'bored', 'frightened', 'lonely'],
      items: [
        { moment: 'Paragraph 3 — each time someone does something for the writer', answer: 'frustrated', para: 3 },
        { moment: 'Paragraph 5 — reading the words at the top of the fourth sheet', answer: 'touched', para: 5 },
        { moment: 'Paragraph 7 — when the history paper comes back', answer: 'proud', para: 7 },
        { moment: 'Paragraph 8 — after Farid says "They were only notes"', answer: 'embarrassed', para: 8 },
      ],
    },
    {
      kind: 'mcq',
      stem: 'In Paragraph 2, what does "I said no, a little too quickly" suggest?',
      answer: 'The writer did not want to seem to need any help.',
      distractors: [
        "The writer did not trust the friends' notes.",
        'The writer had not heard the question clearly.',
        'The writer wanted to leave before the lesson ended.',
      ],
      evidence: 'I said no, a little too quickly, and kept going.',
    },
    {
      kind: 'gapChoice',
      stem: 'The writer slipped on the wet stairs outside the science ______.',
      answer: 'lab',
      distractors: ['block', 'hall', 'room'],
      evidence:
        'Two weeks before the mid-year exams, I slipped on the wet stairs outside the science lab and broke my right wrist.',
    },
    {
      kind: 'short',
      marks: 2,
      stem: 'According to Paragraph 2, what problems did the writer have when taking notes with the left hand? Give TWO.',
      answer:
        'The letters were large and shaky like a small child\'s, the writing was so slow that the teacher had moved on after one line, and by the end of the day even the writer could not read the notes.',
      evidence:
        "The letters came out large and shaky, like a Primary One child's, and by the time I had finished one line, the teacher was already on the next slide.",
      rubric:
        '两分：以下三点任答两点，各 1 分：①字写得又大又歪，像小学一年级学生的字（large 和 shaky 算同一点，分开写也只给 1 分）；②写得太慢，一行还没写完老师已经讲到下一张幻灯片；③到放学时连作者自己都认不出写了什么。「朋友要借笔记、作者拒绝了」不是记笔记时遇到的问题，不给分。',
    },
    {
      kind: 'short',
      marks: 2,
      stem: 'Using your own words, describe the TWO things that were on the fourth sheet (Paragraph 5).',
      answer:
        'It was a practice page of dotted letters from a to z for the writer to trace, like a Primary One exercise, with a note telling the writer to practise with the left hand for ten minutes every day.',
      evidence: 'It was a page of dotted letters from a to z to trace over, like the ones in a Primary One exercise book.',
      rubric:
        '两分：两点各 1 分。①「一页从 a 到 z 的虚线字母，让人照着描（像小学一年级的练习本）」算一点。②「Farid 在顶上写的练习要求：每天用左手练十分钟」算一点。同一点里的内容拆开写不重复给分（如「虚线字母」「从 a 到 z」「像一年级练习本」合起来只算第一点）。dotted、trace 这类词可以直接用原词，不因没有改写而扣分。',
    },
    {
      kind: 'short',
      marks: 2,
      stem: 'According to Paragraph 7, how did writing slowly change the way the writer answered the history paper?',
      answer:
        'The writer stopped writing sentences that did not matter and so wrote less, but thought harder about every line.',
      evidence: 'In the history paper I wrote less than I had ever written, but I thought harder about every line.',
      rubric:
        '两分：两点各 1 分。①「写得比以前都少 / 不再写不要紧的句子」算一点（两种说法是同一点，都写也只给 1 分）。②「每一行都想得更认真」算一点。「拿到了全年最好的分数」是结果，不是答题方式的变化，不给分。',
    },
    {
      kind: 'short',
      marks: 2,
      stem: 'According to Paragraph 9, what does the writer do at night, and why?',
      answer:
        'The writer still writes the diary with the left hand, one slow line at a time, because it is the only place where there is enough time to find out what the writer really thinks.',
      evidence: 'It is the only place where I have enough time to find out what I actually think.',
      rubric:
        '两分：两问各 1 分。第一问：写出「晚上还用左手写日记（一行一行慢慢写）」给 1 分。第二问：写出「只有在那里才有足够的时间弄清楚自己真正在想什么」给 1 分。',
    },
  ],
};

const SPECS = [FINGER, CALCULATOR, BEAR, BRUNO, DOTTED];

module.exports = {
  LEVEL,
  SPECS,
  DAYS: DATES.slice(0, SPECS.length).map((date, i) => buildAuthoredDay(SPECS[i], date)),
};
