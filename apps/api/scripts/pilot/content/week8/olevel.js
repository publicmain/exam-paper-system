/**
 * 第八周 —— **olevel（O-Level 标准）**档，全原创。
 *
 * 四五百词、九段，人物心理更曲折，言外之意更多。形状与第三到七周这一档一致：
 *   4 道情绪配对 · 1 道短语理解四选一 · 1 道原文填空 · 4 道两分主观题 —— 满分 14。
 *
 * 选题思路：按主编分好的五个领域写，每个领域都避开第六、七周这一档用过的题材
 * （祖辈 / 朋友冲突 / 学新手艺 / 公共场合 / 两地探亲 / 母女编辫子 / 跑步宿敌 /
 * 聚光灯效应 / 假装追星）。五篇的结局刻意各不相同：
 *
 *   周一  learning     As Grey as My Mood   背了多年「好词好句」的作者被老师一句「你在哪儿？」
 *                      问住，改成只写亲眼看到的东西。结局：首尾呼应（天是灰的，心情却很好）。
 *   周二  psychology   The Best Bad Holiday  峰终定律：糟糕的马六甲之旅被记成「最好的假期」，
 *                      作者拿来改弟弟的数学辅导，结尾发现妈妈早就这样哄自己看牙医。结局：喜剧反转。
 *   周三  community    Better on Paper      家里出租的房间住进上夜班的护士，两人靠冰箱上的
 *                      便条做了九个月朋友，当面却说不上话。结局：反高潮——就这样也很好。
 *   周四  culture      Eleven Colours       华印混血的作者画自画像，调不出「肤色」，最后用了十一种
 *                      颜色；那支标着 SKIN 的铅笔被她添了一个词。结局：一个小动作收尾。
 *   周五  health       Nine Centimetres     一年长高九厘米，乒乓球突然打不准、被降到二队；教练说
 *                      是大脑还没认识新手臂。结局：仍在二队，没有反超，只是手臂和大脑「认识了」。
 *
 * 五篇没有打工 / 岗位，没有老物件、组屋邻居、熟食中心、生病去世、作弊、宠物、走散、
 * 搬家、台上卡壳、比赛最后反超；核心都不是「发现自己动机不纯」，也不是「看轻了一个
 * 安静的人」。选题前对过 pack-titles-1014（内容包 175 篇）和 read-titles-1014（学生读过的
 * 383 篇），读了第三到七周这一档全部、中级档第三到七周的开头与简化档第七周的梗概，
 * 并在内容包与 test-fixtures 里 grep 过 model composition / by heart / Kahneman / peak-end /
 * lodger / tenant / night shift / self-portrait / skin colour / growth spurt / table tennis：
 * 没有同题材、同骨架的旧文（第五周雅思真题档的 The Price of Owning 提到 Kahneman，
 * 那篇讲的是禀赋效应，不是峰终定律）。
 *
 * 人名都没在前几周出现过：Mrs Ong、Jayden、Maricel、Mr Tay、Aqilah、Coach Teo、Wei Lun
 * （Mrs Chandran 第五周用过，所以周一的老师改叫 Mrs Ong）。
 * 叙述者的性别：只有周三那篇在便条上自称 the girl，其余四篇原文都没写明（下面各篇注释里的
 * 「他 / 她」只是为了行文方便）；五篇的题干和参考答案一律用 the writer。
 *
 * 事实核对（把握程度）：
 *   · 周二 Kahneman 等人 1993 年的冷水实验：一次手泡冷水 60 秒，另一次 60 秒之后再泡
 *     30 秒、这 30 秒里水温略微升高；之后问愿意重做哪一次，多数人选了更长的那次。
 *     原文只写「一分钟」「一分半」「最后半分钟没那么冷」「most」，不写水温和比例 —— 把握高。
 *     「人记一段经历，主要记最强烈的时刻和结尾」是峰终定律的通行表述 —— 把握高。
 *     马六甲以 cendol 出名、学校假期新柔长堤堵车，都是常识 —— 把握高。
 *   · 周五 男生青春期身高增长最快的一年约九到十厘米，「一年长九厘米」说得通 —— 把握高；
 *     「长得太快的一段时间里动作会变笨，因为大脑对身体的『地图』还没更新」是运动科学里
 *     常见的通俗解释，原文写成教练的话、不带任何数字 —— 把握中高。
 *   · 其余三篇没有事实性内容（标着 SKIN 的铅笔是故事里的道具，不指任何品牌）。
 */

'use strict';

const { buildAuthoredDay, numbered } = require('../authored');
const { DATES } = require('./dates');

const LEVEL = 'olevel';

// ═══════════════════════════════════════════════════════════════
// 周一 —— As Grey as My Mood（徽章：learning）
//
// 作者从小学四年级起跟补习老师背「好词好句」，每篇作文塞五六句，分数一直不错。
// 中三新来的英文老师 Mrs Ong 发作文时不讲分数，只念了三篇的开头——三篇都是
// 「The sky was as grey as my mood」，第二篇就是作者的；作者卷末只有一句评语
// 「Where are you in this?」。老师给了个挑战：下一篇不许用任何读到过的句子，只写
// 亲眼看到的。作者对着题目「Waiting」坐了一小时，旧句子总抢着替他把话说完。
// 第二天在泳池边等弟弟下课，看到家长们都把毛巾搭在胳膊上、孩子游过时毛巾就抬一下，
// 像「没人点菜的餐馆里的服务员」。这篇分数反而低了，评语却说「服务员！二十年都没注意到」。
// 之后他改记一本只写「注意到的东西」的小本子；年中考试里「心跳像打鼓」又冒出来，
// 他停笔，写成「像别人包里震个不停的手机」。结尾：昨天天灰了一下午，他的心情却很好——
// 他把这句记了下来。
//
// 选题理由：学生大多是在新加坡学英文的中国孩子，「背好词好句、套范文」是他们自己的
// 习惯；言外之意多（三个一样的开头、「你在哪儿」、灰天好心情）。领域是「一门课的
// 学法转变」，不是学新手艺。
// 与旧文的区别：第五周 Dotted Letters（左手写字、慢下来学会想清楚再写）只是都碰到
// 「写」，那篇是受伤后的书写；旧题库 The Second-Hand Textbook 是二手课本里的旁注；
// 雅思真题档读过的 The architecture of memory 讲间隔重复，是记忆方法。这一篇的内核是
// 「借来的句子说不出你自己」，没有比赛、没有老物件。
// 时间线：小四开始背 → 中二本子写满 → 中三新老师 → 年中考试（五月）→ 现在。
// ═══════════════════════════════════════════════════════════════

const GREY_MOOD = {
  key: 'original-w8-as-grey-as-my-mood',
  title: 'As Grey as My Mood',
  passage: numbered([
    `Since Primary Four I have kept a notebook of good phrases. Every week my tutor gave me ten sentences from a book of model compositions, and I learned them by heart: "The sky was as grey as my mood." "My heart was beating like a drum." By Secondary Two I could fit five or six of them into any story, the way you fit pieces into a jigsaw, and my marks were always good.`,
    `In Secondary Three we had a new English teacher, Mrs Ong. When she gave back our first compositions, she said nothing about marks. Instead she read out the first lines of three of them, without saying whose they were. All three began: "The sky was as grey as my mood." The class laughed. I laughed too, a moment late, because the second one was mine.`,
    `At the bottom of my last page she had written one line: "Where are you in this?" I did not understand the question. I was in every sentence; I had chosen them all. After the lesson I asked her what was wrong with my phrases. Nothing, she said, except that they belonged to everybody, so they told her nothing about me. Then she gave me a challenge. In my next composition I could not use any sentence that I had read somewhere before. I could only write about things I had seen for myself.`,
    `The title was "Waiting". I sat at my desk for an hour. Every time I began a sentence, one of my old phrases arrived to finish it, like a classmate who always answers the teacher's questions before you can open your mouth. I crossed out more than I wrote. By eleven o'clock I had three lines, and I hated all of them.`,
    `The next evening I sat outside the pool during my younger brother's swimming lesson, as I do every Thursday. Because I had nothing to write about, I watched. Along the bench, every parent held a towel the same way, folded over one arm, and whenever a child swam past, the towels rose a little. They looked like waiters in a restaurant where nobody ever orders anything. I typed that into my phone before I could lose it.`,
    `My composition was about the bench and the towels. It had no grey skies in it, and no hearts like drums. My mark was lower than usual, because, Mrs Ong wrote, my paragraphs were in a strange order. But under the mark she had added: "The waiters! I have sat beside pools for twenty years and never noticed. More of this, please." I have read that comment more times than I have ever read a mark.`,
    `Since then I have kept a second notebook, small enough for my pocket. There are no good phrases in it, only things I have noticed: the woman on the bus who peels an orange in one long piece, the way my father says "OK, OK, OK" faster and faster when he is not listening. Without meaning to, I have started to look at things more slowly, as if someone might ask me about them later.`,
    `It has not been easy. In the mid-year exam, when I was nervous, an old phrase arrived at once: "My heart was beating like a drum." My pen had already started. I stopped and asked myself what my heart was really doing. It was not beating like a drum. It was more like a phone buzzing in somebody else's bag: impossible to ignore, and impossible to answer. I wrote that instead.`,
    `I still have the first notebook, and I still know every sentence in it by heart. But yesterday the sky was grey all afternoon, and when I looked up from my homework, I noticed that my mood was fine. I wrote that down.`,
  ]),
  questions: [
    {
      kind: 'matchingFeelings',
      bank: ['embarrassed', 'puzzled', 'frustrated', 'delighted', 'jealous', 'homesick', 'suspicious', 'terrified'],
      items: [
        { moment: 'Paragraph 2 — laughing a moment late as the second opening line is read out', answer: 'embarrassed', para: 2 },
        { moment: 'Paragraph 3 — reading the one line Mrs Ong has written at the bottom of the last page', answer: 'puzzled', para: 3 },
        { moment: 'Paragraph 4 — crossing out line after line at the desk until eleven o\'clock', answer: 'frustrated', para: 4 },
        { moment: 'Paragraph 6 — reading what Mrs Ong has added under the mark', answer: 'delighted', para: 6 },
      ],
    },
    {
      kind: 'mcq',
      stem: 'In Paragraph 4, what does the comparison with "a classmate who always answers the teacher\'s questions" suggest?',
      answer: "The old phrases came into the writer's head before any new words could.",
      distractors: [
        'A classmate had been helping the writer with the composition.',
        'The old phrases were the right answers to the title.',
        'The writer wanted to answer more questions in class.',
      ],
      evidence:
        "Every time I began a sentence, one of my old phrases arrived to finish it, like a classmate who always answers the teacher's questions before you can open your mouth.",
    },
    {
      kind: 'gapChoice',
      stem: "In the mid-year exam, the writer's heart felt like a ______ buzzing in somebody else's bag.",
      answer: 'phone',
      distractors: ['drum', 'bell', 'clock'],
      evidence: "It was more like a phone buzzing in somebody else's bag: impossible to ignore, and impossible to answer.",
    },
    {
      kind: 'short',
      marks: 2,
      stem: "According to Paragraph 1, where did the sentences in the writer's first notebook come from, and how did the writer use them?",
      answer:
        "The writer's tutor gave ten sentences a week from a book of model compositions; the writer learned them by heart and fitted five or six of them into every story.",
      evidence:
        'Every week my tutor gave me ten sentences from a book of model compositions, and I learned them by heart: "The sky was as grey as my mood."',
      rubric:
        '两分：两问各 1 分。①来源：补习老师每周从一本范文书里挑十个句子给作者（写出「补习老师给的」或「范文书里的」任一即可）。②用法：每篇作文都塞进五六句，像拼拼图一样拼进去（写出「放进 / 塞进作文里」即可）。只写「背下来」不给第二分——背是记住，题目问的是怎么用。只写「分数一直很好」不给分——那是结果。',
    },
    {
      kind: 'short',
      marks: 2,
      stem: 'According to Paragraph 3, what were the TWO rules of the challenge that Mrs Ong gave the writer?',
      answer:
        'The writer could not use any sentence that had been read somewhere before, and could write only about things the writer had seen in person.',
      evidence:
        'In my next composition I could not use any sentence that I had read somewhere before. I could only write about things I had seen for myself.',
      rubric:
        '两分：两条规则各 1 分。①不能用任何以前在别处读到过的句子（写出「不能用背过的好词好句」也给分）。②只能写自己亲眼看到的东西。只写「再写一篇作文」不给分——那是任务，不是规则。答「这些句子属于所有人，说明不了作者」不给分——那是 Mrs Ong 给的理由，不是挑战的规则。',
    },
    {
      kind: 'short',
      marks: 2,
      stem: 'Using your own words, describe what the writer noticed about the parents on the bench, and what they reminded the writer of (Paragraph 5).',
      answer:
        'They all held a towel in the same way, over one arm, and lifted it a little whenever a child swam past; they reminded the writer of waiters in a restaurant where nobody ever orders anything.',
      evidence: 'They looked like waiters in a restaurant where nobody ever orders anything.',
      rubric:
        '两分：两问各 1 分。①注意到的：每个家长都用同一种方式拿毛巾——搭在一条胳膊上，孩子游过时毛巾就微微抬起（写出「都把毛巾搭在胳膊上」或「孩子游过时毛巾会抬一下」任一即可）。②像什么：像一家从来没人点菜的餐馆里的服务员（写出「服务员」即可）。只写「弟弟在上游泳课」不给分——那是背景。',
    },
    {
      kind: 'short',
      marks: 2,
      stem: 'According to Paragraph 7, what does the writer put in the second notebook, and how has it changed the way the writer looks at things?',
      answer:
        'Only things the writer has noticed, such as the woman who peels an orange in one long piece or the father saying "OK, OK, OK"; the writer now looks at things more slowly, as if someone might ask about them later.',
      evidence: 'Without meaning to, I have started to look at things more slowly, as if someone might ask me about them later.',
      rubric:
        '两分：两问各 1 分。①本子里记的：只记自己注意到的事（写出「自己观察到的东西」，或举出任一例子——公交上把橘子皮剥成一整条的女人 / 爸爸没在听时越说越快的「OK, OK, OK」——即可）。②变化：现在看东西更慢、更仔细了，好像以后会有人问起（写出「看得更慢 / 更仔细」即可）。只写「本子小到能放进口袋」不给第一分——那是本子的大小。只写「里面没有好词好句」不给第一分——那只说了没有什么，题目问的是记了什么。',
    },
  ],
};

// ═══════════════════════════════════════════════════════════════
// 周二 —— The Best Bad Holiday（徽章：psychology）
//
// 六月假期全家开车去马六甲三天，样样不顺：长堤堵两小时、酒店房间一股旧烟味、第二天
// 下了大半天雨；最后一晚躲雨进小店吃 cendol，爸爸讲第一次约会掉进鱼池，全家笑到
// 老板多送纸巾。几个月后妈妈跟姨妈说那是「最好的一次假期」，九岁的弟弟 Jayden 也同意，
// 作者想不通。班主任在讲考试压力的课上讲了 Kahneman 的冷水实验（多泡半分钟但结尾
// 没那么冷，多数人反而愿意重做长的那次）：人记一段经历，记的是最强烈的时刻和结尾。
// 作者拿来做实验：每晚半小时教弟弟数学总是以叹气、扔铅笔、妈妈在厨房吼收场，弟弟一听
// 翻练习册就钻桌底。前二十七分钟照旧，最后三分钟留给一道他肯定会的题和一张「作者
// 变恐龙」的丑画让他涂。第二周弟弟没叫就自己来、周五主动要「做恐龙那个」。作者得意地
// 在饭桌上比划着讲给妈妈听，妈妈只是递菜。他忽然想起小时候怕牙医、哭一路，可每次看完
// 都去诊所旁边的咖喱角店——问妈妈听没听过 Kahneman。没听过。「那为什么每次都去咖喱角
// 店？」「因为下一次你哭得少一点。」作者笑得停不下来。
//
// 选题理由：一个心理现象在家里的小实验，有可操作的结论（结尾很重要），又有反转：
// 心理学家花大力气证明的事，妈妈凭经验早就在用。不写聚光灯效应（上周写过）。
// 与旧文的区别：雅思真题档 The Trouble with the Marshmallow Test 是延迟满足、The Pill
// With Nothing in It 是安慰剂、When Memory Rewrites Itself 是记忆重构、The Price of Owning
// 是禀赋效应；第四周 Let Him Finish 有弟弟，但内核是口吃时别替人把话说完。这一篇
// 没有比赛、没有老物件，看牙医不是生病。上周 The Jellyfish Badge 是「五天、每天改一处、
// 记次数」的自我实验，这一篇只改一处（结尾），骨架不同。
// 事实见文件头：冷水实验把握高；cendol 是马六甲名吃、学校假期长堤堵车，常识。
// 时间线：六月假期出游 → 几个月后妈妈说「最好的一次」→ 班会课 → 两周实验 → 晚饭。
// ═══════════════════════════════════════════════════════════════

const BEST_BAD_HOLIDAY = {
  key: 'original-w8-the-best-bad-holiday',
  title: 'The Best Bad Holiday',
  passage: numbered([
    `In the June holidays my family drove up to Malacca for three days, and almost everything went wrong. We sat in a jam at the Causeway for two hours. Our hotel room smelled of old cigarettes. It rained for most of the second day. On the last evening, we ran into a tiny shop to escape the rain and ordered cendol, and my father told us how he had once fallen into a fish pond on his first date with my mother. We laughed until the owner brought us extra napkins.`,
    `A few months later, I heard my mother tell my aunt that it had been our best holiday ever. My little brother, Jayden, agreed. I nearly agreed too, before I remembered the jam, the smoky room and the rain. How could three bad days and one good hour add up to "best ever"?`,
    `The answer came in a lesson about exam stress, when our form teacher told us about an experiment by the psychologist Daniel Kahneman and his colleagues. People put one hand into very cold water for a minute. In another trial, they kept it in for a minute and a half, but during the last half-minute the water was made a little less cold. Asked later which trial they would rather repeat, most people chose the longer one: more pain in total, but a better ending. We do not remember an experience minute by minute, our teacher said. We remember its worst or best moment, and how it ended.`,
    `I thought at once of the cendol, and then of Jayden. Every evening I helped him with his maths for half an hour, and every evening it ended badly. He got a question wrong, I sighed loudly and tapped the page, he threw his pencil, and our mother shouted at both of us from the kitchen. He was nine, and he had started hiding under the table when he heard me open his workbook.`,
    `So I tried an experiment. I changed nothing about the first twenty-seven minutes: I was just as strict, and the questions were just as hard. But I kept the last three minutes for something easy: one question I was sure he could answer, and then a terrible drawing of me as a dinosaur for him to colour in. Every night I wrote down how the session had ended.`,
    `For a week nothing changed. Then, in the second week, Jayden came to the table before I had called him. On Friday he asked whether we could "do the dinosaur thing" again. He still threw his pencil sometimes, in the middle. But he no longer remembered our evenings as a fight, and neither, I noticed, did I.`,
    `I was very pleased with myself. At dinner I explained the whole experiment to my mother, with the cold water and the famous psychologist and the dinosaurs, drawing graphs in the air with my chopsticks. She listened, nodded and passed me the vegetables.`,
    `Then I remembered something. When I was small, I was so afraid of the dentist that I cried in the car all the way there. But every visit, without exception, ended at the curry puff shop next to the clinic, and even today the word "dentist" makes me think of curry puffs. I put down my chopsticks and asked my mother whether she had ever heard of Daniel Kahneman.`,
    `She had not. "Then why," I asked, "did every trip to the dentist end at the curry puff shop?" She looked at me as if I had asked why rain was wet. "Because the next time, you cried less," she said, and went on eating. I started to laugh, and I could not stop.`,
  ]),
  questions: [
    {
      kind: 'matchingFeelings',
      bank: ['puzzled', 'impatient', 'proud', 'amused', 'homesick', 'jealous', 'terrified', 'lonely'],
      items: [
        { moment: 'Paragraph 2 — hearing the mother call the trip "our best holiday ever"', answer: 'puzzled', para: 2 },
        { moment: 'Paragraph 4 — sighing loudly and tapping the page when Jayden gets a question wrong', answer: 'impatient', para: 4 },
        { moment: 'Paragraph 7 — explaining the experiment at dinner, drawing graphs in the air', answer: 'proud', para: 7 },
        { moment: 'Paragraph 9 — after hearing why every trip to the dentist ended at the curry puff shop', answer: 'amused', para: 9 },
      ],
    },
    {
      kind: 'mcq',
      stem: 'In Paragraph 9, what does the mother\'s answer, "Because the next time, you cried less," suggest?',
      answer: 'She had used the same idea for years without knowing its name.',
      distractors: [
        'She did not believe that the experiment was real.',
        'She had forgotten about the trips to the curry puff shop.',
        'She had read about the experiment before the writer did.',
      ],
      evidence: `"Because the next time, you cried less," she said, and went on eating.`,
    },
    {
      kind: 'gapChoice',
      stem: 'Every visit to the dentist ended at the curry puff shop next to the ______.',
      answer: 'clinic',
      distractors: ['school', 'station', 'market'],
      evidence: 'But every visit, without exception, ended at the curry puff shop next to the clinic,',
    },
    {
      kind: 'short',
      marks: 2,
      stem: 'According to Paragraph 1, give TWO things that went wrong on the trip to Malacca.',
      answer:
        'They sat in a jam at the Causeway for two hours, their hotel room smelled of old cigarettes, and it rained for most of the second day.',
      evidence: 'We sat in a jam at the Causeway for two hours. Our hotel room smelled of old cigarettes. It rained for most of the second day.',
      rubric:
        '两分：以下三点任答两点，各 1 分：①在长堤（Causeway）上堵了两个小时；②酒店房间一股旧烟味；③第二天大半天都在下雨。只写「最后一晚躲雨进了小店」「吃了 cendol」不给分——那是这趟旅行里好的部分。',
    },
    {
      kind: 'short',
      marks: 2,
      stem: 'Using your own words, explain which trial most people in the experiment chose to repeat, and why this choice seems strange (Paragraph 3).',
      answer:
        'Most chose the longer trial, even though it meant keeping a hand in cold water for longer and suffering more pain overall; only its last part was a little less cold.',
      evidence: 'Asked later which trial they would rather repeat, most people chose the longer one: more pain in total, but a better ending.',
      rubric:
        '两分：两问各 1 分。①选了哪次：时间更长的那一次（写出「一分半那次 / 更长的那次」即可）。②为什么奇怪：那一次手在冷水里泡得更久、总的痛苦更多（写出「更久」或「更痛」即可）。只写「最后半分钟水没那么冷」而没有说出那一次更长 / 更痛，不给第二分——那是人们选它的原因，不是这个选择奇怪的地方。只写「人们把手放进很冷的水里」是实验做法，不给分。',
    },
    {
      kind: 'short',
      marks: 2,
      stem: 'According to Paragraph 5, what did the writer keep the same in the homework sessions, and what did the writer change?',
      answer:
        'The first twenty-seven minutes stayed the same, just as strict and just as hard; the last three minutes became something easy, with a question Jayden could answer and a drawing to colour in.',
      evidence: 'I changed nothing about the first twenty-seven minutes: I was just as strict, and the questions were just as hard.',
      rubric:
        '两分：两问各 1 分。①不变的：前二十七分钟照旧——一样严格、题目一样难（写出「前面的时间照旧」或「一样严 / 一样难」任一即可）。②改了的：最后三分钟留给容易的事——一道他肯定会做的题，再给他涂一张作者画成恐龙的丑画（写出「最后三分钟做容易的事」或举出两项之一即可）。只写「每晚记下这次怎么结束的」不给分——那是记录，不是改了什么。',
    },
    {
      kind: 'short',
      marks: 2,
      stem: 'According to Paragraph 6, give TWO signs in the second week that Jayden felt differently about the sessions.',
      answer:
        'He came to the table before the writer had called him, and on Friday he asked whether they could "do the dinosaur thing" again.',
      evidence: 'Then, in the second week, Jayden came to the table before I had called him.',
      rubric:
        '两分：以下三点任答两点，各 1 分：①还没叫他，他就自己来到桌边；②周五他问能不能再「做恐龙那个」；③他不再把这些晚上记成一场架。只写「他有时还是会在中间扔铅笔」不给分——那是没变的地方。',
    },
  ],
};

// ═══════════════════════════════════════════════════════════════
// 周三 —— Better on Paper（徽章：community）
//
// 一月家里把空房间租出去，作者本想把它改成自己的书房（台灯都挑好了），所以护士
// Maricel 带着两个箱子和一个电饭煲搬进来时，作者没笑着打招呼。Maricel 来自菲律宾、
// 在医院产房上夜班，晚八点出门、作者上学后才回来、白天睡觉，第一个月只在走廊擦身
// 两次。二月作者迷迷糊糊吃了她冰箱格子里的芒果酸奶，像抢了银行一样盯着空杯子，留了
// 张道歉便条。第二天牛奶盒上贴着回信：「没关系，芒果的最好吃。昨晚凌晨三点生了个满头
// 黑发的宝宝，像个小老头」，还画了个皱眉的婴儿。从此便条没停过：双胞胎差七分钟、
// 哭得比孩子还响的爸爸、作者数学老师的冷笑话；年中考第一天牛奶上一张「Good luck.
// Breathe.」。五月一个周日两人在厨房同时去拿水壶，当面却只会「累吗—嗯」「学校呢—还好」，
// 聊新加坡天天一样的天气，各端各的茶回房，作者脸发烫。第二天便条：「好奇怪！我们还是
// 写在纸上比较好」，画了两杯离得远远、冒着汗的茶。结尾：作者仍然没有书房；有些晚上
// 两人在她出门前那一小时同坐一张餐桌，几乎不说话。九个月出声说话加起来大概十五分钟，
// 却是作者最好的友谊之一。
//
// 选题理由：兄弟姐妹、邻居之外的一段关系——和家里的房客。新加坡家庭出租空房很常见，
// 外籍护士上夜班也常见；写的是「有的友谊只活在某种形式里」，结局不强行让两人变成
// 能聊天的朋友。
// 与旧文的区别：没有人搬走、没有告别（避开 The Send-off、The Window 的搬家 / 离家骨架），
// 不是邻居（The Blackout、Between Floors、The Rooftop Garden 都是组屋邻居），不是
// 「看轻了一个安静的人」。旧题库 The Unsent Letter 是在过世祖母家里清东西，只有
// 「纸上的话」这一点外壳相近。上周母女那篇有一张「Gone walking」的字条，只是道具，
// 这一篇的便条是整段关系本身。
// 时间线：一月搬进 → 二月第一张便条 → 五月（写了三个月）周日厨房 → 现在十月，
// 前后九个月。年中考在五月前后，排在「五月之前的便条」里说得通。
// ═══════════════════════════════════════════════════════════════

const BETTER_ON_PAPER = {
  key: 'original-w8-better-on-paper',
  title: 'Better on Paper',
  passage: numbered([
    `In January my parents decided to rent out our spare room. I had been planning to turn it into a study room for myself, and I had even chosen a lamp. So when Maricel moved in, with two suitcases and a rice cooker, I said hello without smiling and went back to my own room.`,
    `Maricel was a nurse from the Philippines who worked nights in the ward where babies are born. She left at eight in the evening, came back after I had gone to school and slept for most of the day. In the first month I saw her only twice, both times in the corridor, both times saying sorry as we squeezed past each other. She had one shelf in our fridge, with a label on it in neat capitals: MARICEL, THANK YOU!`,
    `One morning in February, half asleep, I took a mango yoghurt from the fridge and had eaten most of it before I saw which shelf it had come from. I stood in the kitchen staring at the empty cup as if I had robbed a bank. Then I wrote on a sticky note: "Sorry, I ate your yoghurt by mistake. I will buy you a new one today. From the girl in the next room."`,
    `The next morning there was a reply stuck to the milk, in small round handwriting. "No problem! Mango is the best one, so I understand. Last night a baby was born at 3 a.m. with a full head of black hair, like a tiny old man. M." Underneath she had drawn the baby, frowning at the world.`,
    `I laughed out loud at the kitchen table. That afternoon I bought two mango yoghurts, one for each of us, and left a question: what was the strangest thing that had ever happened at work? After that the notes never stopped. She told me about twins born seven minutes apart, and a father who cried louder than his baby. I told her about my maths teacher's terrible jokes. On the morning of my first mid-year paper, there was a note on the milk that said only: "Good luck. Breathe. M."`,
    `By May we had been writing to each other for three months, and we had still never had a real conversation. When the notes fell off the fridge, I kept them in an envelope in my desk drawer. There were thirty-eight of them.`,
    `Then, one Sunday, she was off work, and we met in the kitchen, both reaching for the kettle at the same moment. "Hi," I said. "Hi," she said. There was a long silence. I asked if she was tired. She said yes. She asked how school was. I said fine. We talked about the weather, although in Singapore the weather is the same every day. Then she took her tea to her room and I took mine to mine, and I sat on my bed with my face burning.`,
    `The next morning there was a note on the milk: "That was so strange! I think we are better on paper. M." Below it she had drawn two cups of tea, standing very far apart and sweating. I was still smiling on the bus to school, and that evening I wrote her the longest note yet.`,
    `I still do not have a study room. But some evenings, in the hour before Maricel leaves for work, we sit at the kitchen table together, she with her dinner and I with my homework, and we hardly say a word. In nine months we have probably spoken out loud for about fifteen minutes in total. It is one of the best friendships I have.`,
  ]),
  questions: [
    {
      kind: 'matchingFeelings',
      bank: ['annoyed', 'guilty', 'amused', 'awkward', 'hopeful', 'confident', 'bored', 'proud'],
      items: [
        { moment: 'Paragraph 1 — saying hello to Maricel without smiling', answer: 'annoyed', para: 1 },
        { moment: 'Paragraph 3 — staring at the empty yoghurt cup in the kitchen', answer: 'guilty', para: 3 },
        { moment: "Paragraph 5 — at the kitchen table after reading Maricel's first reply", answer: 'amused', para: 5 },
        { moment: 'Paragraph 7 — sitting on the bed after the meeting by the kettle', answer: 'awkward', para: 7 },
      ],
    },
    {
      kind: 'mcq',
      stem: 'In Paragraph 8, what does Maricel mean when she writes, "I think we are better on paper"?',
      answer: 'They find it easier to talk in notes than face to face.',
      distractors: [
        'She would like the writer to stop leaving notes.',
        'She thinks they should practise talking more often.',
        'She prefers drawing pictures to writing words.',
      ],
      evidence: 'The next morning there was a note on the milk: "That was so strange! I think we are better on paper. M."',
    },
    {
      kind: 'gapChoice',
      stem: 'Half asleep, the writer ate most of a mango ______ before seeing which shelf it had come from.',
      answer: 'yoghurt',
      distractors: ['pudding', 'cake', 'jelly'],
      evidence:
        'One morning in February, half asleep, I took a mango yoghurt from the fridge and had eaten most of it before I saw which shelf it had come from.',
    },
    {
      kind: 'short',
      marks: 2,
      stem: 'According to Paragraph 2, give TWO reasons why the writer hardly ever saw Maricel.',
      answer: 'She worked nights and left at eight in the evening, she came back after the writer had gone to school, and she slept for most of the day.',
      evidence: 'She left at eight in the evening, came back after I had gone to school and slept for most of the day.',
      rubric:
        '两分：以下三点任答两点，各 1 分：①她上夜班 / 晚上八点就出门；②她回来时作者已经去上学了；③她白天大部分时间在睡觉。只写「她是从菲律宾来的护士」不给分——那是她是谁，不是见不到的原因。只写「在走廊里互相说对不起」不给分——那是见到的时候。',
    },
    {
      kind: 'short',
      marks: 2,
      stem: 'Give TWO things that Maricel wrote about in her notes to the writer.',
      answer:
        'A baby born at 3 a.m. with a full head of black hair, twins born seven minutes apart, a father who cried louder than his baby, and "Good luck. Breathe." before the writer\'s exam.',
      evidence: 'She told me about twins born seven minutes apart, and a father who cried louder than his baby.',
      rubric:
        '两分：以下任答两点，各 1 分：①凌晨三点出生、满头黑发、像个小老头的婴儿；②相差七分钟出生的双胞胎；③哭得比自己孩子还响的爸爸；④作者年中考第一天早上的「Good luck. Breathe.」（写出「祝作者考试好运」即可）；⑤酸奶没关系、芒果味最好吃。只写「作者数学老师的冷笑话」不给分——那是作者写给她的，不是她写的。',
    },
    {
      kind: 'short',
      marks: 2,
      stem: 'According to Paragraph 7, give TWO details which show that the meeting in the kitchen did not go well.',
      answer:
        'There was a long silence, their answers were only one word long, they talked about the weather although it is the same every day, and they each took their tea back to their own rooms.',
      evidence: 'We talked about the weather, although in Singapore the weather is the same every day.',
      rubric:
        '两分：以下四点任答两点，各 1 分：①有一阵很长的沉默；②一问一答都只有一个词（「累吗—嗯」「学校怎样—还好」）；③只能聊天气，可新加坡的天气天天都一样；④各自端着茶回了自己房间（答「作者坐在床上脸发烫」也给这 1 分）。只写「两人同时去拿水壶」不给分——那是怎么碰上的，不是谈得不好的地方。',
    },
    {
      kind: 'short',
      marks: 2,
      stem: 'According to Paragraph 9, what do the writer and Maricel sometimes do in the hour before Maricel leaves for work, and how much have they spoken out loud?',
      answer:
        'They sit at the kitchen table together, Maricel with her dinner and the writer with homework, hardly saying a word; in nine months they have spoken out loud for only about fifteen minutes in total.',
      evidence: 'In nine months we have probably spoken out loud for about fifteen minutes in total.',
      rubric:
        '两分：两问各 1 分。①一起坐在厨房餐桌边——她吃晚饭，作者写作业，几乎不说话（写出「一起坐在餐桌边」即可）。②九个月里出声说的话加起来大概只有十五分钟（写出「十五分钟左右」即可）。只写「这是作者最好的友谊之一」不给第二分——题目问的是说了多少话。',
    },
  ],
};

// ═══════════════════════════════════════════════════════════════
// 周四 —— Eleven Colours（徽章：culture）
//
// 作者妈妈是华人、爸爸是印度人，从小总被问「你是什么人」，有人还问「华人多一点还是
// 印度人多一点」，像在问一杯调出来的饮料；作者总说「都是」然后岔开话题。中三美术课
// 的学期作业是对着镜子画颜料自画像，老师 Mr Tay 说「不许看照片，我要你们真的看看
// 自己」，作者胃里一凉——从没盯着自己的脸看过。美术室旧彩铅里有一支标着 SKIN 的，
// 是草莓牛奶那种淡粉；朋友 Aqilah 往自己胳膊上一比笑了，往作者胳膊上一比，两人都
// 不笑了——谁也不像。作者自己调色：棕加白像泥、加黄像淡咖啡，四十分钟一盘失败的
// 棕色，纸上的脸谁也不像，想把纸撕了。同桌 Aqilah 不告诉她用哪个颜色，只让她比手背和
// 手心：手心更粉、指节更深、眼下发紫、运动会晒过的脸颊是暖橙棕；她把手翻来翻去，
// 像第一次见。「没有人是一种颜色。画你看到的，不是你以为自己是的。」三周后她用了
// 十一种颜色。家长日爸爸说她画的是他的鼻子，妈妈说明明是她的，一路吵到停车场，
// 作者走在后面偷笑。上周手机店的人又问「你到底是什么人」，她说「大概十一种颜色」，
// 还给人家讲了颜料，没再岔开话题。结尾：那支 SKIN 铅笔还在盒子里，她削好它，在
// SKIN 前面写了一个小词：SOME。
//
// 选题理由：艺术 + 身份认同。新加坡多元种族、混血孩子常被问「你是什么」，「肤色」
// 这个词本身就值得想一想；用画画写出来，不说教，结尾一个词收住。
// 与旧文的区别：上周 Over There 是「两地之间不敢属于任何一边」，靠回乡探亲写出来；
// 这一篇没有出行，内核是「看清自己本来就不是一种颜色」。第五周中级档 The Class Photo
// 是拍照总闭眼，旧题库 The New Glasses 是新眼镜，The Drawing on the Wall 是墙上的画——
// 都只碰到「外表 / 画」的边。不写节日、传统乐器（避开 The Kompang、The Wayang）。
// 没有事实性内容；SKIN 铅笔是故事道具，不写品牌。
// ═══════════════════════════════════════════════════════════════

const ELEVEN_COLOURS = {
  key: 'original-w8-eleven-colours',
  title: 'Eleven Colours',
  passage: numbered([
    `My mother is Chinese and my father is Indian, and for as long as I can remember, people have asked me what I am. Shopkeepers ask. Taxi drivers ask. Once a girl at a birthday party asked whether I was more Chinese or more Indian, as if I were a drink that someone had mixed. I usually say "both" and change the subject.`,
    `In Secondary Three, our art teacher, Mr Tay, gave us the project for the term: a self-portrait in paint, done from a mirror. "No photos," he said. "I want you to really look at yourselves." Most of the class groaned. I did not groan, but I felt something cold settle in my stomach. I had never looked at my own face for longer than it takes to brush my hair.`,
    `The first problem was colour. In the old box of colour pencils at the back of the art room, there was one pencil labelled SKIN. It was the pale pink of strawberry milk. My friend Aqilah held it against her arm and laughed. Then she held it against mine, and we both stopped laughing. It did not match either of us, or anyone else at our table.`,
    `So I mixed my own. I started with brown and white, and it looked like mud. I added yellow, and it looked like weak coffee. Each time I held the brush beside my face in the mirror, the colour was wrong in a different way. After forty minutes I had a palette full of failed browns, a face on the paper that looked like nobody I knew, and a strong wish to tear the paper in half.`,
    `Aqilah leaned over from the next easel. She did not tell me which colour to use. Instead she told me to look at the back of my hand and then at my palm, and to tell her whether they were the same colour. They were not. My palm was pinker and my knuckles were darker. Under my eyes there was something almost purple, and across my cheeks, where the sun had caught me on sports day, a warm orange-brown. I turned my hand over and over, as if it belonged to somebody else. "Nobody is one colour," Aqilah said. "Just paint what's actually there."`,
    `For the next three weeks I painted my face in small patches. I stopped looking for the one right brown. Some patches were yellow, some were almost green in the shadows, and one, beside my nose, was a colour I can only call milky tea. By the end I had used eleven colours on a single face, and I had looked at myself for longer than in all my life before.`,
    `On Parents' Day the portraits were hung in the corridor. My father stood in front of mine for a long time and then said that I had painted his nose. My mother said it was obviously her nose. They argued about it all the way to the car park, and I walked behind them, grinning.`,
    `The question still comes. Last week the man at the phone shop asked me what I was, actually. Before, I would have said "both" and looked away. This time I thought of the portrait. "About eleven colours," I said. He looked confused, so I told him about the paint, and for once I did not change the subject.`,
    `The pencil labelled SKIN is still in the box at the back of the art room. Yesterday I took it out, sharpened it, and wrote one small word on the label, just in front of SKIN, before I put it back: SOME.`,
  ]),
  questions: [
    {
      kind: 'matchingFeelings',
      bank: ['nervous', 'frustrated', 'fascinated', 'amused', 'jealous', 'guilty', 'homesick', 'relieved'],
      items: [
        { moment: 'Paragraph 2 — hearing Mr Tay say "No photos"', answer: 'nervous', para: 2 },
        { moment: 'Paragraph 4 — looking at the palette full of failed browns after forty minutes', answer: 'frustrated', para: 4 },
        { moment: 'Paragraph 5 — turning a hand over and over to look at its colours', answer: 'fascinated', para: 5 },
        { moment: 'Paragraph 7 — walking behind the parents to the car park', answer: 'amused', para: 7 },
      ],
    },
    {
      kind: 'mcq',
      stem: 'In Paragraph 9, what does the writer suggest by writing SOME on the label of the pencil?',
      answer: 'The pencil shows only one of the many colours that skin can be.',
      distractors: [
        'The pencil should be used only now and then.',
        'Only some students may borrow the pencil.',
        "The pencil matches part of the writer's face.",
      ],
      evidence:
        'Yesterday I took it out, sharpened it, and wrote one small word on the label, just in front of SKIN, before I put it back: SOME.',
    },
    {
      kind: 'gapChoice',
      stem: 'When the writer first mixed brown and white, the colour looked like ______.',
      answer: 'mud',
      distractors: ['sand', 'rust', 'chalk'],
      evidence: 'I started with brown and white, and it looked like mud.',
    },
    {
      kind: 'short',
      marks: 2,
      stem: "According to Paragraph 2, what was the term's art project, and why did Mr Tay say that photos were not allowed?",
      answer: 'A self-portrait in paint, done from a mirror; he wanted the students to really look at themselves.',
      evidence: '"No photos," he said. "I want you to really look at yourselves."',
      rubric:
        '两分：两问各 1 分。①作业：对着镜子画一幅颜料自画像（写出「自画像」即可）。②原因：他要学生真正好好看看自己。只写「全班都在抱怨」或「作者胃里一凉」不给分——那是大家的反应，不是作业或原因。',
    },
    {
      kind: 'short',
      marks: 2,
      stem: "According to Paragraph 3, what happened when Aqilah held the SKIN pencil against her own arm, and then against the writer's?",
      answer:
        "Against her own arm, she laughed; against the writer's arm, they both stopped laughing, because it did not match either of them.",
      evidence: 'Then she held it against mine, and we both stopped laughing. It did not match either of us, or anyone else at our table.',
      rubric:
        '两分：两问各 1 分。①比自己的胳膊：她笑了（写出「笑了」或「和她的肤色不一样」即可）。②比作者的胳膊：两人都不笑了——它跟她们谁的肤色都不一样（写出「两人不笑了」或「也对不上 / 谁都不像」任一即可）。只写「这支铅笔是草莓牛奶那种淡粉色」不给分——那是铅笔的样子，不是比的结果。',
    },
    {
      kind: 'short',
      marks: 2,
      stem: "According to Paragraph 5, give TWO differences that the writer noticed in the colour of the writer's own skin.",
      answer:
        'The palm was pinker than the back of the hand, the knuckles were darker, there was something almost purple under the eyes, and the cheeks were a warm orange-brown from the sun.',
      evidence: 'My palm was pinker and my knuckles were darker.',
      rubric:
        '两分：以下四点任答两点，各 1 分：①手心比手背更粉；②指节颜色更深；③眼睛下面几乎是紫色的；④运动会晒过的脸颊是暖暖的橙棕色。只写「Aqilah 说没有人是一种颜色」不给分——那是同桌的话，不是作者看到的差别。',
    },
    {
      kind: 'short',
      marks: 2,
      stem: 'According to Paragraph 8, how did the writer answer the man at the phone shop, and how was this different from before?',
      answer:
        'The writer said "About eleven colours" and told him about the paint; before, the writer would have said "both", looked away and changed the subject.',
      evidence: 'Before, I would have said "both" and looked away.',
      rubric:
        '两分：两问各 1 分。①这次的回答：「大概十一种颜色」（写出「十一种颜色」即可）。②不同在哪：以前会说「都是」然后把目光移开 / 岔开话题，这次没有岔开，还跟他讲了画画的事（写出以前怎么做，或「这次讲了颜料、没岔开话题」任一即可）。只写「那人一脸困惑」不给分——那是对方的反应。',
    },
  ],
};

// ═══════════════════════════════════════════════════════════════
// 周五 —— Nine Centimetres（徽章：health）
//
// 作者十四到十五岁之间长了九厘米：妈妈在厨房墙上画的铅笔线隔得像楼梯，校裤短到
// 脚踝。中一起就是校乒乓球队最好的选手，现在打了上千遍的球不是出界就是下网，还碰翻
// 水瓶。二月教练 Coach Teo 把他降到二队，校际赛的位置给了中一起就是他
// 的双打搭档 Wei Lun（同届，10-14 查重后改，避开旧文 Twelve Moves「被低年级新人顶替」）；回家巴士上他折着长腿一路看窗外。一周后教练看他一个人
// 对墙打球，讲了一件他从没听过的事：长得快时骨头先长，大脑要时间追上，它还在用旧地图，
// 「你的手臂比你大脑以为的长，你没有忘了怎么打」——他第一次松开了攥紧的拳头。好心情只撑
// 一天：他照老办法「多练」，每晚三小时越打越狠、越打越差，肩膀发酸；一晚连丢五个
// 简单球，把球拍往桌上一放、一句话不说走了。教练改派任务：每晚十分钟对着镜子慢动作
// 空挥，「把新手臂介绍给你的大脑」；妹妹坐沙发上举分数，他每次都脸红，还是练完了二三月。
// 比赛那天他坐看台看 Wei Lun 替他上场赢了两场，他鼓掌，大体上是真心的。四月妈妈碰掉
// 一只玻璃杯，他没多想伸手在离地不远处接住了，盯着自己的手发愣。结尾：他还在二队，
// 发球也没回到从前，墙上的铅笔线还在往上爬；但上周他打完一整场，一次也没被自己
// 手臂的长度吓到——手臂和大脑总算「认识了」。
//
// 选题理由：身体的一次经历，青春期学生自己正经历的「突然变笨」；结局不是反超，
// 而是接受、慢慢适应——没有回到一队，也没有赢下比赛。
// 与旧文的区别：本档 The Armband 是队长袖标给了别人（内核是什么才配当队长）、
// Properly This Time 是和爸爸打羽毛球让球、The Back of Her Head 是八百米的宿敌；
// 中级档 Sub-Twenty 是魔方比赛怯场、Lucky Socks 是迷信袜子；第六周 The Wobble 是
// 学拉坯慢下来——这一篇没有要克服的恐惧，也没有「终于做成了」的高潮，核心是身体
// 变了、要重新认识它。没有受伤、生病（避开 Dotted Letters 的骨折）。
// 事实见文件头：一年长九厘米说得通；「长太快的一段时间里会变笨」写成教练的通俗
// 解释，不写数字。时间线：十四岁生日到十五岁生日之间长高、十二月线最开、二月降队、
// 二三月练镜子、比赛在其后、四月接杯子、现在（十月）。
// ═══════════════════════════════════════════════════════════════

const NINE_CENTIMETRES = {
  key: 'original-w8-nine-centimetres',
  title: 'Nine Centimetres',
  passage: numbered([
    `Between my fourteenth and fifteenth birthdays, I grew nine centimetres. Every few months my mother stood me against the kitchen wall and drew a line in pencil above my head, and by December the lines were so far apart that my little sister said they looked like stairs. My school trousers stopped at my ankles. My feet seemed to arrive everywhere a moment before the rest of me.`,
    `Since Secondary One I had been the best player in the school table tennis team. Table tennis is a game of millimetres, and for two years my hands had always known where the ball would land. Now they did not. Shots I had played a thousand times flew off the end of the table or into the net. I knocked over water bottles.`,
    `In February, Coach Teo moved me down to the second team for the inter-school competition. He told me kindly, after everyone else had gone home. My place in the first team went to Wei Lun, who had been my doubles partner since Secondary One. I nodded and said I understood. On the bus home I sat with my long legs folded against the seat in front and stared out of the window the whole way.`,
    `A week later, Coach Teo found me hitting balls alone against the wall of the hall. He watched for a while, then explained something new to me. When you grow fast, he said, your bones grow first, and your brain takes time to catch up. For years it has known exactly how long your arms are, and now it is working from an old map. "Your arm is longer than your brain thinks it is," he said. "You haven't forgotten how to play." For the first time in weeks, I unclenched my fists.`,
    `The feeling lasted about a day. Then I tried to fix the problem the way I fix everything: by doing more. I played for three hours every evening, harder and faster, and I got worse. My shoulder ached. One evening I missed five easy shots in a row, put my racket down on the table and walked out without a word, leaving the balls rolling round the hall.`,
    `So Coach Teo gave me a different job. Every evening, for ten minutes, I was to stand in front of the mirror at home and play my shots in slow motion, with no ball, watching my arm the whole time. "You need to introduce your brain to your new arms," he said. My sister sat on the sofa holding up marks out of ten, and my face went hot every time. But I did it, every evening, through February and March.`,
    `On the day of the competition, I sat in the stands and watched Wei Lun play in my place. He won his first two matches. I clapped for him, and I meant it, mostly.`,
    `In April, my mother knocked a glass off the kitchen counter. Without thinking, I reached out and caught it just above the floor. Nobody moved. My mother looked at the glass and then at me. "Since when can you do that?" she asked. I did not know. I stood staring at my own hand, which had gone to the right place all by itself.`,
    `I am still in the second team. My serve is still not what it was, and the pencil lines on the kitchen wall have not stopped climbing. But last week, for the first time in months, I played a whole match without once being surprised by the length of my own arm. I think my brain and my arms have finally been introduced.`,
  ]),
  questions: [
    {
      kind: 'matchingFeelings',
      bank: ['relieved', 'frustrated', 'embarrassed', 'astonished', 'homesick', 'guilty', 'terrified', 'lonely'],
      items: [
        { moment: "Paragraph 4 — hearing Coach Teo say \"You haven't forgotten how to play\"", answer: 'relieved', para: 4 },
        { moment: 'Paragraph 5 — putting the racket down and walking out, leaving the balls rolling', answer: 'frustrated', para: 5 },
        { moment: 'Paragraph 6 — practising in front of the mirror while the sister holds up marks', answer: 'embarrassed', para: 6 },
        { moment: "Paragraph 8 — unable to answer the mother's question, staring at the hand that caught the glass", answer: 'astonished', para: 8 },
      ],
    },
    {
      kind: 'mcq',
      stem: 'In Paragraph 6, what does Coach Teo mean by "You need to introduce your brain to your new arms"?',
      answer: "The writer's brain had to learn how long the writer's arms now were.",
      distractors: [
        'The writer should show the team how tall the writer had become.',
        'The writer needed to build stronger muscles in both arms.',
        'The writer should stop thinking so much during real matches.',
      ],
      evidence: '"You need to introduce your brain to your new arms," he said.',
    },
    {
      kind: 'gapChoice',
      stem: "In April, the writer's mother knocked a ______ off the kitchen counter.",
      answer: 'glass',
      distractors: ['plate', 'bowl', 'bottle'],
      evidence: 'In April, my mother knocked a glass off the kitchen counter.',
    },
    {
      kind: 'short',
      marks: 2,
      stem: 'According to Paragraph 3, what did Coach Teo decide in February, and what did the writer do on the bus home?',
      answer:
        'He moved the writer down to the second team for the inter-school competition, giving the place to Wei Lun; on the bus the writer sat with long legs folded against the seat and stared out of the window the whole way.',
      evidence: 'In February, Coach Teo moved me down to the second team for the inter-school competition.',
      rubric:
        '两分：两问各 1 分。①教练的决定：把作者降到二队，校际赛的位置给了 Wei Lun（写出「降到二队」或「让 Wei Lun 替他上」任一即可）。②巴士上：折着长腿抵着前座，一路盯着窗外（写出「一路看窗外」即可）。只写「作者点头说他明白」不给第二分——那是在教练面前，不是在巴士上。',
    },
    {
      kind: 'short',
      marks: 2,
      stem: "Using your own words, explain what Coach Teo said was causing the writer's problems, and what he said it did NOT mean (Paragraph 4).",
      answer:
        "The writer had grown so fast that the brain had not caught up and still thought the writer's arms were shorter; it did not mean that the writer had forgotten how to play.",
      evidence: '"Your arm is longer than your brain thinks it is," he said. "You haven\'t forgotten how to play."',
      rubric:
        '两分：两问各 1 分。①原因：长得太快，骨头先长、大脑还没追上——大脑还按原来的手臂长度在算（写出「大脑以为手臂还是原来那么长」或「大脑没跟上长个子」任一即可）。②不代表：不是作者忘了怎么打球。只写「作者一个人对着墙打球」不给分——那是教练看到的场景。',
    },
    {
      kind: 'short',
      marks: 2,
      stem: 'According to Paragraph 5, how did the writer first try to fix the problem, and what was the result?',
      answer: 'By doing more: playing for three hours every evening, harder and faster; but the writer got worse, and the writer\'s shoulder ached.',
      evidence: 'I played for three hours every evening, harder and faster, and I got worse.',
      rubric:
        '两分：两问各 1 分。①办法：多练——每晚打三个小时，打得更狠、更快（写出「练得更多 / 每晚三小时」即可）。②结果：反而打得更差，肩膀也酸痛（任一即可）。只写「有一晚把球拍放下走了」不给第二分——那是某一晚的事，题目问的是多练的结果。',
    },
    {
      kind: 'short',
      marks: 2,
      stem: 'According to Paragraph 9, give ONE thing that is still the same for the writer, and say what happened for the first time last week.',
      answer:
        'The writer is still in the second team (and the serve is still not what it was); last week the writer played a whole match without once being surprised by the length of the writer\'s own arm.',
      evidence: 'But last week, for the first time in months, I played a whole match without once being surprised by the length of my own arm.',
      rubric:
        '两分：两问各 1 分。①没变的（任答一项）：还在二队；发球还没回到从前的水平；墙上的铅笔线还在往上爬（他还在长）。②上周第一次：打完一整场，一次也没被自己手臂的长度吓到（写出「整场都没被手臂长度弄得意外」即可；只写「打了一场比赛」不给分）。',
    },
  ],
};

const SPECS = [GREY_MOOD, BEST_BAD_HOLIDAY, BETTER_ON_PAPER, ELEVEN_COLOURS, NINE_CENTIMETRES];

module.exports = {
  LEVEL,
  SPECS,
  DAYS: DATES.slice(0, SPECS.length).map((date, i) => buildAuthoredDay(SPECS[i], date)),
};
