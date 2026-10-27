/**
 * 第九周 —— **ielts_simplified（O-Level 基础）**档，全原创。
 *
 * 形状与第四到八周这一档一致：两百多词、九个短段、一条线讲到底，
 *   3 道四选一 · 2 道判断 · 1 道原文填空（四选一） · 4 道主观题（1/1/2/2 分）。
 *
 * 本周新要求（叶老师 10-23「内容可以整体难一点」）：篇幅取 240–260 词偏上段，
 * 超纲率往 A2 上限 7% 靠（目标 6.0–6.8%），超纲词尽量是值得学的正式词
 * （reluctant / assumed / gradually / evidence / certain / committee …），
 * 不靠人名凑；句子多用从句、被动、指代跨句；题目加了指代题、人物动机题、
 * 需要把两段信息合起来的题，四选一干扰项都是原文提到过、但不回答本题的内容。
 *
 * 周二已审定的文章、题目原样保留；本轮追加周三至周五，日期沿用 dates.js。
 * GP 追加要求只指定 authentic 三篇及 olevel 周五；本档仍写九段叙事文。
 *
 * 四天选题与徽章：周二 community（社区意见）；周三 nature（蝉蜕）；
 * 周四 learning（检验书面说明）；周五 culture（告别语的翻译）。
 *   · 周三 An Empty Coat：自然社找到树上的蝉蜕，从背上的开口看出里面已经没有昆虫，
 *     带回学校与活蝉图片并列展出；结尾展示的是一次成长留下的空壳。
 *   · 周四 The Longer Page：作者写的折纸说明自己读得懂，同桌却折不成；观察后补上
 *     折叠方向与小图，让没看过成品的读者也能完成，结尾保留原稿作为对照。
 *   · 周五 Two Lines at the Door：为校园语言展翻译家里的普通话告别语「慢走」，
 *     先只保留实用意思，后来把字面与用意并列；结尾是带有两行译文的出口卡片。
 * 四篇分别是问意见后少建设、观察自然留下的痕迹、通过读者试用修改文字、保留译文的
 * 两层意思；没有重复周二的社区改造结局，也没有学会窍门后成为全家能手的桥段。
 *
 * 新增三篇事实核对：周三「蝉在最后一次蜕皮时从旧外壳中出来，留下可附着在树上的
 * 空壳」把握高（基础昆虫学常识）；不写种类、周期、地点或具体羽化时长。
 * 周四全是虚构课堂情节，不声称某种教法必然有效。周五「慢走」可作告别时的关照语，
 * 字面与交际用意可以不同，把握高；只写叙述者家里的习惯，不推广为人人都这样说。
 * 本轮遵照要求离线核对常识，没有联网核验；日期、纸张、展览均为虚构情节。
 * 新增三篇不使用人物姓名，避开第八周各档出现过的人名。
 *
 * 查重：对过 .local/tmp/pack-titles-1023.txt（内容包 1–8 周）和 read-titles-1023.txt
 * （学生交过卷的全部标题），并在内容包各周文件里搜过 survey / questionnaire /
 * knocked on / bench / bus stop / badminton / Farhan：
 *   · 「做调查问居民」：内容包里 survey 只出现在学术文（雅思真题档）和第二周 olevel 的
 *     补习数据里，没有学生去问居民意见的故事；
 *   · 「公共空地要改造」：olevel 的 The Bus Stop Garden 是居民自己把车站种成花园，
 *     The Rooftop Garden / The Rise of Community Gardens 也都是「种起来」；本篇骨架
 *     正好相反 —— 大家以为要花园，调查后发现最多人要「别动它」，最后不建花园；
 *   · 第八周 olevel_intermediate 的 The Most Boring Bridge 是学生请愿要一座天桥
 *     （征签名 → 建成）；本篇不是请愿，是替居委会问意见，结论是「少建」；
 *   · 没有用叙事类老套路（台上卡住、走散、祖辈旧物、搬家、误会邻居、生病、作弊、
 *     宠物走丢、最后一刻反超、学会窍门成了全家能手）。
 * 人名只有一个 Farhan，1–8 周内容包里没出现过。背景是小区旁的草地，没写组屋 /
 * 熟食中心。
 *
 * 新增查重：完整对照 pack-titles-1023 / read-titles-1023 的合并标题，并在第二至八周
 * 五档正文检索 cicada / moult / exoskeleton / instruction / translat / caption 等：
 * 无蝉蜕、折纸说明试用、告别语双译文的同题材桥段。The Ant Road 是气味路线实验，
 * Where Have the Insects Gone? 是种群变化；本篇是蜕皮留下的自然物。
 * As Grey as My Mood 是作文套话与亲身观察，The Test That Teaches 是提取练习；
 * 本篇是给陌生读者补齐操作信息。Speaking for My Mother 是隐瞒老师评价，
 * Two Places at Once 有翻译软件的笑话；本篇没有隐瞒或软件误译，而是保留文化表达。
 * A World Without Left and Right 讨论空间语言与认知，本篇不涉及方向或认知实验。
 *
 * 全周判断题：FN / TN / FT / NT → TRUE 3、FALSE 2、NOT GIVEN 3。
 * 周二未提及水果树；周三未提及昆虫在地下待多久；周五未提及展览人数。
 * 每天两题的答案不同；所有 FALSE 均有直接反证，所有 evidence 均逐字取自原文。
 */

'use strict';

const { buildAuthoredDay, numbered } = require('../authored');
const { DATES } = require('./dates');

const LEVEL = 'ielts_simplified';

// ═══════════════════════════════════════════════════════════════
// 周二 —— Leave It as It Is（community · 社区意见）
//
// 小区后面有一块只长草的空地，居委会提出要改成花园，先想听听附近居民的意见。这件事
// 交给了作者的班。搭档 Farhan 一开始不情愿：「人人都想要花园，问什么？答案明摆着。」
// 大家也都这么以为。两周里每天早晚站在空地边，只问一个问题：你想让这块地变成什么？
// 慢慢发现空地很少是空的：早上六点一群老太太做操，晚饭后一家家打羽毛球。
// 一共问了 143 人，只有 31 人选花园，过半数（78 人）的答案出乎意料：「别动它」。一个
// 老人说：「花园好看，可没人能在花上玩。」原本最笃定的 Farhan 半天没说话，然后提议
// 别只报数字，把证据给居委会看 —— 做了一张海报，贴上不同钟点空地的照片。居委会仔细看过，
// 决定不建花园，只加两盏灯（天黑后也能用）和一个饮水龙头。上周五作者和 Farhan 在新灯下
// 打羽毛球，两人都打得不好，也没人在意。
// 选题理由：「我们以为 → 去问 → 发现正相反」，一个学生自己也可能参与的社区小事；
// 结局是「少做一点」，不说教。
// 事实：全是故事情节，没有需要核对的事实性内容；人数 143 / 31 / 78 是故事里的数字，
// 互不矛盾（其余 34 人是别的答案，文中不提）。居委会（residents' committee）、
// 班主任（form teacher）是新加坡常用说法。
// ═══════════════════════════════════════════════════════════════

const FIELD = {
  key: 'original-w9-leave-it',
  title: 'Leave It as It Is',
  passage: numbered([
    "Behind our estate is a field with nothing on it but grass. In September, the residents' committee announced a proposal to turn it into a garden, but first it wanted to hear from people nearby.",
    'Our class was given the job of asking. My partner, Farhan, was reluctant at first. "Everyone wants a garden," he said. "Why ask? The answer is obvious." Most of us assumed the same.',
    'For two weeks, we stood by the field each morning and evening, asking everyone one question: "What would you like this field to become?"',
    'Gradually, we saw something we had never noticed: the field was rarely empty. At six in the morning, a group of old ladies did exercises there. After dinner, families played badminton.',
    'By the end, we had spoken to 143 people, and only 31 chose a garden. The majority, 78 people, gave an answer that we had not expected: "Leave it as it is."',
    'An old man explained why. "A garden is nice to look at," he said, "but nobody can play games on flowers."',
    'Farhan, who had been so certain, was quiet for a long time. Then he suggested showing the committee the evidence, not just the numbers. So we made a poster with photographs of the field at different hours.',
    'The committee studied it carefully. In the end, it decided not to build the garden. Instead, it added two lights, so that the field could be used after dark, and a water tap.',
    'Last Friday, Farhan and I played badminton there under the new lights. We are both bad at it, but nobody seemed to mind.',
  ]),
  questions: [
    {
      kind: 'mcq',
      stem: 'Why did Farhan think that asking people was not needed?',
      answer: 'He believed that everyone wanted a garden.',
      distractors: [
        'He thought that the field was always empty.',
        'He knew that the committee had already decided.',
        'He thought that people would not stop to answer.',
      ],
      evidence: '"Everyone wants a garden," he said. "Why ask? The answer is obvious."',
    },
    {
      kind: 'mcq',
      stem: 'What did the old man mean when he talked about flowers?',
      answer: 'A garden would take away the space people used for games.',
      distractors: [
        'Flowers in a garden would be hard to look after.',
        'The garden should have more flowers than grass.',
        'Walking in the evening is better than playing games.',
      ],
      evidence: '"A garden is nice to look at," he said, "but nobody can play games on flowers."',
    },
    {
      kind: 'mcq',
      stem: 'Why did the committee add two lights to the field?',
      answer: 'so that the field could be used after dark',
      distractors: [
        'so that the photographs could be taken at night',
        'so that the old man could walk there safely',
        'so that the old ladies could exercise at six',
      ],
      evidence: 'Instead, it added two lights, so that the field could be used after dark, and a water tap.',
    },
    {
      kind: 'tfng',
      item: 'Farhan agreed from the beginning that the class should ask people what they wanted.',
      answer: 'FALSE',
      evidence: 'My partner, Farhan, was reluctant at first. "Everyone wants a garden," he said. "Why ask? The answer is obvious."',
    },
    {
      kind: 'tfng',
      item: 'The committee had planned to plant fruit trees in the garden.',
      answer: 'NOT GIVEN',
    },
    {
      kind: 'gapChoice',
      stem: 'The class made a poster with ______ of the field at different hours.',
      answer: 'photographs',
      distractors: ['numbers', 'lights', 'flowers'],
      evidence: 'So we made a poster with photographs of the field at different hours.',
    },
    {
      kind: 'short',
      marks: 1,
      stem: 'From Paragraph 5, what answer did the majority of people give?',
      answer: '"Leave it as it is."',
      evidence: 'The majority, 78 people, gave an answer that we had not expected: "Leave it as it is."',
      rubric:
        '一分：答「Leave it as it is / 保持原样 / 不要改动这块地 / 让它保持现在的样子」即给分，意思对就行。答「a garden / 花园」不给分 —— 只有 31 人选花园，不是最多的。只写数字「78」没写答案内容不给分。',
    },
    {
      kind: 'short',
      marks: 1,
      stem: 'In Paragraph 8, who or what does the word "it" refer to in "it decided not to build the garden"?',
      answer: "The residents' committee.",
      evidence: 'The committee studied it carefully. In the end, it decided not to build the garden.',
      rubric:
        "一分：答「the (residents') committee / 居委会 / 委员会」即给分。答「the poster / 海报」不给分 —— 前一句「studied it」里的 it 才是海报，做决定的是委员会。答「the field」「the class」也不给分。",
    },
    {
      kind: 'short',
      marks: 2,
      stem: 'Read Paragraph 7, and look back at Paragraph 2 and Paragraph 5. Why was Farhan quiet for a long time, and what did he suggest after that?',
      answer:
        'He had been sure that everyone wanted a garden, but the answers showed he was wrong (only 31 of 143 people chose a garden). He suggested showing the committee the evidence instead of only telling them the numbers.',
      evidence:
        'Farhan, who had been so certain, was quiet for a long time. Then he suggested showing the committee the evidence, not just the numbers.',
      rubric:
        '两分：写出「他原来很确定人人都想要花园，结果发现自己错了 / 大多数人并不想要花园」给 1 分（写出「结果和他想的不一样 / 他想错了」即可；只写「他很惊讶」「他很难过」而没说出想错了什么，不给这 1 分）；写出「建议把证据拿给委员会看，而不只是报数字」再给 1 分（写「做一张有照片的海报给委员会看」也给分）。答「他建议建花园」不给分 —— 原文没有这样说。用自己的简单英文说对意思即可。',
    },
    {
      kind: 'short',
      marks: 2,
      stem: 'Using your own words, explain what people did on the field in the morning and after dinner (Paragraph 4).',
      answer:
        'In the morning, a group of old ladies did exercises there. After dinner, families played badminton there.',
      evidence:
        'At six in the morning, a group of old ladies did exercises there. After dinner, families played badminton.',
      rubric:
        '两分：写出「早上（六点）一群老太太 / 年纪大的女士在那里做运动 / 做操」给 1 分；写出「晚饭后一家家人在那里打羽毛球」再给 1 分（只写「有人打羽毛球」也给分）。早上和晚饭后写反了只给 1 分。答「作者和 Farhan 在新灯下打羽毛球」不给晚饭后这 1 分 —— 那是第 9 段装灯以后的事，不是第 4 段调查时看到的。用自己的简单英文说对意思即可。',
    },
  ],
};

// ═══════════════════════════════════════════════════════════════
// 周三 —— An Empty Coat（nature · 蝉蜕留下的痕迹）
// 观察开口与空壳，再与活蝉图片比较；不把没有看到的羽化过程写成亲眼观察。
// ═══════════════════════════════════════════════════════════════

const SHELL = {
  key: 'original-w9-empty-coat',
  title: 'An Empty Coat',
  passage: numbered([
    'On our nature club walk, my partner noticed a small brown insect on a tree. Its legs were holding the wood, although nothing else moved.',
    'We waited, reluctant to disturb it. Even when the wind shook the leaves above us, it remained still. I wondered whether it was simply asleep.',
    'When I looked from the side, however, I noticed a small opening along its back. Through this, I could see that the inside was empty. Gradually, our interest changed: we now wanted to understand what had happened before we arrived.',
    'Our club leader explained that it was the old outer covering of a cicada. This covering cannot expand as the insect grows, so it must be replaced.',
    'At the final change, the insect comes out through the back, leaving its old shell behind. What we had found was evidence of this change, rather than an insect waiting to move.',
    'Since nothing was living inside, we were allowed to take the shell to school. It was so delicate that we carried it in a container, protected by soft paper.',
    'At school, we compared it with a picture of an adult cicada. The picture showed wings, whereas the shell had none. Yet both had six legs.',
    'We put the picture beside the shell on our nature table. Under them was a card: "An empty coat." My partner added, "Its owner has already left."',
    'By the next morning, people were stopping to look into our box. We had started the walk wanting to find something alive; now everyone wanted to examine something empty.',
  ]),
  questions: [
    {
      kind: 'mcq',
      stem: 'Which observation showed the writer that there was no insect inside?',
      answer: 'The opening gave a view of the empty inside.',
      distractors: [
        'The legs were still holding onto the wood.',
        'The wind was shaking the leaves above it.',
        'The shell stayed still while they waited.',
      ],
      evidence: 'I noticed a small opening along its back. Through this, I could see that the inside was empty.',
      explanation: '背上的开口让作者直接看到内部是空的。脚抓着树、叶子摇动和外壳不动都不能单独证明里面没有昆虫。',
    },
    {
      kind: 'mcq',
      stem: 'Why does the writer describe the shell as evidence of a change?',
      answer: 'It was left behind when the insect came out.',
      distractors: [
        'It was carried to school in soft paper.',
        'It had six legs like the insect in the picture.',
        'It was found while leaves moved in the wind.',
      ],
      evidence: 'At the final change, the insect comes out through the back, leaving its old shell behind.',
      explanation: '外壳是昆虫从背部出来后留下的痕迹，因此能证明发生过一次变化；包装、腿数和风中的树叶不是这个变化的证据。',
    },
    {
      kind: 'mcq',
      stem: 'What contrast does the writer point out at the end?',
      answer: 'They sought living things, but an empty shell attracted attention.',
      distractors: [
        'They saw leaves move, but the shell on the tree stayed still.',
        'They found wings in the picture, but none on the shell.',
        'They carried the shell in paper, but displayed it beside a picture.',
      ],
      evidence: 'We had started the walk wanting to find something alive; now everyone wanted to examine something empty.',
      explanation: '结尾将出发时寻找活物的愿望与空壳后来受到关注并置；其他选项描述了前文的观察或展出细节，没有回答结尾强调的反差。',
    },
    {
      kind: 'tfng',
      item: 'The club leader explained a change that the writer had not watched happening.',
      answer: 'TRUE',
      evidence: 'What we had found was evidence of this change, rather than an insect waiting to move.',
      explanation: '作者看到的是变化之后留下的空壳，领队解释了先前发生的过程；作者没有看到昆虫从外壳中出来。',
    },
    {
      kind: 'tfng',
      item: 'The insect had spent several years underground before leaving this shell.',
      answer: 'NOT GIVEN',
      explanation: '全文没有交代这只昆虫曾在地下待多久，也没有给出蝉的种类或生长周期，不能用课外知识替原文回答。',
    },
    {
      kind: 'gapChoice',
      stem: 'The shell was carried in a ______, protected by soft paper.',
      answer: 'container',
      distractors: ['picture', 'covering', 'tree'],
      evidence: 'It was so delicate that we carried it in a container, protected by soft paper.',
    },
    {
      kind: 'short',
      marks: 1,
      stem: 'In Paragraph 3, what does "this" refer to in "Through this"?',
      answer: 'The small opening along the back of the shell.',
      evidence: 'I noticed a small opening along its back. Through this, I could see that the inside was empty.',
      rubric: '一分：答「背上的小开口 / the opening / the gap in its back」即给分，合理同义表达也给分。答「the tree / 树」「the inside / 内部」不给分；作者是通过开口看到内部。',
    },
    {
      kind: 'short',
      marks: 1,
      stem: 'From Paragraph 6, why did the pair use soft paper when carrying the shell?',
      answer: 'To protect the delicate shell from being broken.',
      evidence: 'It was so delicate that we carried it in a container, protected by soft paper.',
      rubric: '一分：答「保护容易损坏的外壳 / 怕弄破 / because it could break easily」即给分，合理同义表达也给分。只答「因为它是空的」不给分；空与需要软纸保护不是同一个原因。',
    },
    {
      kind: 'short',
      marks: 2,
      stem: 'From Paragraph 4, why must the insect replace its outer covering as it grows?',
      answer: 'The insect grows, but its outer covering cannot expand with it.',
      evidence: 'This covering cannot expand as the insect grows, so it must be replaced.',
      rubric: '两分：写出「昆虫在长大 / 需要更大的空间」给 1 分；写出「旧的外壳不能随之变大 / cannot expand」再给 1 分。合理同义表达也给分。只说「旧外壳很轻 / 容易破」不给分；没有说明生长与外壳之间的关系。',
    },
    {
      kind: 'short',
      marks: 2,
      stem: 'Using your own words, give one difference and one similarity found in the comparison in Paragraph 7.',
      answer: 'The adult in the picture had wings while the shell had none; both had six legs.',
      evidence: 'The picture showed wings, whereas the shell had none. Yet both had six legs.',
      rubric: '两分：写出「图片里的成蝉有翅膀、空壳没有」给 1 分；写出「两者都有六条腿」再给 1 分。合理同义表达也给分。只写「一个是图片、一个是壳」不给不同点这 1 分；只写「都一样」不给相同点这 1 分。',
    },
  ],
};

// ═══════════════════════════════════════════════════════════════
// 周四 —— The Longer Page（learning · 给没有看过成品的人写说明）
// 情节、折纸任务及课堂安排虚构；重点是补齐读者缺少的信息，不是学会折纸诀窍。
// ═══════════════════════════════════════════════════════════════

const INSTRUCTIONS = {
  key: 'original-w9-longer-page',
  title: 'The Longer Page',
  passage: numbered([
    'In English class, we were asked to write instructions for making a paper pocket. I already knew how, and finished four short lines before anyone else.',
    'Feeling confident, I folded another pocket while reading my page. Every step seemed obvious. I placed the finished pocket behind my book, ready for the next part.',
    'Then we exchanged instructions. Our partners were given fresh paper, but they could not see the pockets we had made. We were allowed to watch without speaking.',
    'My partner reached "Fold it again" and stopped. After looking at both sides, she folded the paper across the middle. I wanted to point, but kept my hands still.',
    'Her paper was now the wrong shape. She read my words again, carefully. I had assumed that she would know which side I meant, although the page never said.',
    'Our teacher asked us to mark the exact place where each reader had become puzzled. I marked my third line, rather than changing everything or blaming my partner. Her careful reading helped me find a problem I could not see alone.',
    'When we were allowed to change our pages, I added which side to fold towards the centre. Beside the words, I added small diagrams showing the paper before and after.',
    'With a new piece of paper, my partner followed the revised instructions and made a pocket. This time, my explanation had done the work that my own knowledge had done before.',
    'My page was longer now. I kept the first version under it, with the third line marked. Four short lines had looked complete until someone else tried using them.',
  ]),
  questions: [
    {
      kind: 'mcq',
      stem: 'Why did testing the first page by making another pocket fail to reveal its problem?',
      answer: 'The writer already knew details missing from the page.',
      distractors: [
        'The writer had placed the finished pocket behind a book.',
        'The writer had completed four lines before anyone else.',
        'The writer had been given a fresh sheet of paper.',
      ],
      evidence: 'This time, my explanation had done the work that my own knowledge had done before.',
      explanation: '结合开头的 already knew how 与第 8 段可知，作者第一次靠已有知识补上了文字没有说清的步骤，因此自测没有暴露问题；速度、摆放位置与纸张不是原因。',
    },
    {
      kind: 'mcq',
      stem: 'What did the writer identify as the cause of the wrong fold?',
      answer: 'The instruction failed to identify the required side.',
      distractors: [
        'The partner read the same line more than once.',
        'The partner examined both sides before folding.',
        'The finished pocket was placed behind a book.',
      ],
      evidence: 'I had assumed that she would know which side I meant, although the page never said.',
      explanation: '作者明确把问题定位为说明漏写了该折哪条边。重读和观察两边是读者面对信息不足时的动作；遮住成品是任务条件，不能代替对缺失信息的判断。',
    },
    {
      kind: 'mcq',
      stem: 'What does the final sentence suggest about a complete set of instructions?',
      answer: 'Its clarity needs to be checked by another reader.',
      distractors: [
        'Its first version should be kept under the new page.',
        'Its steps should fit into four short written lines.',
        'Its writer should finish before the other students.',
      ],
      evidence: 'Four short lines had looked complete until someone else tried using them.',
      explanation: '结尾的 looked complete 与 until someone else tried 对照，说明作者以为写全了仍需由别的读者试用；保存原稿、四行字和先写完都是文中细节，不是清楚完整的标准。',
    },
    {
      kind: 'tfng',
      item: 'The partner could see the finished pocket while trying the first instructions.',
      answer: 'FALSE',
      evidence: 'Our partners were given fresh paper, but they could not see the pockets we had made.',
      explanation: '原文明说搭档看不到已做好的成品，与题干 could see 直接相反。',
    },
    {
      kind: 'tfng',
      item: 'The writer marked a difficulty after watching the partner use the instructions.',
      answer: 'TRUE',
      evidence: 'I marked my third line, rather than changing everything or blaming my partner.',
      explanation: '作者先观察搭档试读、试折，再依照老师的要求标出卡住的第 3 行，顺序与题干一致。',
    },
    {
      kind: 'gapChoice',
      stem: 'The writer added small ______ showing the paper before and after.',
      answer: 'diagrams',
      distractors: ['instructions', 'edges', 'objects'],
      evidence: 'Beside the words, I added small diagrams showing the paper before and after.',
    },
    {
      kind: 'short',
      marks: 1,
      stem: 'In Paragraph 8, what does "This time" refer to?',
      answer: 'The attempt when the partner used the revised instructions with a new piece of paper.',
      evidence: 'With a new piece of paper, my partner followed the revised instructions and made a pocket. This time, my explanation had done the work that my own knowledge had done before.',
      rubric: '一分：答「搭档用修改后的说明重新折纸那一次 / when the partner used the revised instructions」即给分，合理同义表达也给分。答「作者第一次照自己的四行字折纸」不给分；那次有作者已有知识补充。',
    },
    {
      kind: 'short',
      marks: 1,
      stem: 'From Paragraph 6, how did the writer record the location of the difficulty?',
      answer: 'By marking the third line of the instructions.',
      evidence: 'I marked my third line, rather than changing everything or blaming my partner.',
      rubric: '一分：答「标出第 3 行 / marked the third line / marked the line where the partner got stuck」即给分，合理同义表达也给分。只答「改了说明」「怪搭档」不给分；题目问如何标记问题的位置。',
    },
    {
      kind: 'short',
      marks: 2,
      stem: 'From Paragraph 7, what TWO changes did the writer make to the page?',
      answer: 'The writer specified which side to fold towards the centre and added diagrams showing the paper before and after.',
      evidence: 'I added which side to fold towards the centre. Beside the words, I added small diagrams showing the paper before and after.',
      rubric: '两分：写出「补上哪条边要往中心折 / 说明折叠方向」给 1 分；写出「加上显示折叠前后的图 / diagrams」再给 1 分。合理同义表达也给分。只写「写得更长」不算具体修改；答「把成品给搭档看」不给分，原文没有这样做。',
    },
    {
      kind: 'short',
      marks: 2,
      stem: 'Using your own words, explain the missing information and the assumption behind it in Paragraph 5.',
      answer: 'The page did not say which side to fold, because the writer assumed the partner would already know the intended side.',
      evidence: 'I had assumed that she would know which side I meant, although the page never said.',
      rubric: '两分：写出「页面没说该折哪条边」给 1 分；写出「作者以为搭档已经知道自己指哪条边」再给 1 分。合理同义表达也给分。只答「搭档折错了」没有指出缺失信息，不给第一点；答「搭档没有认真读」不给第二点，原文明说她又仔细读过。',
    },
  ],
};

// ═══════════════════════════════════════════════════════════════
// 周五 —— Two Lines at the Door（culture · 告别语的字面与用意）
// 普通话「慢走」在本故事家庭中表达关照，不把单一家习当作所有人的固定习俗。
// ═══════════════════════════════════════════════════════════════

const FAREWELL = {
  key: 'original-w9-two-lines-door',
  title: 'Two Lines at the Door',
  passage: numbered([
    'For our school language exhibition, each student brought an expression used at home. I chose the Mandarin words my mother says when visitors leave: "Walk slowly."',
    'I had translated the words directly, but my partner thought the card belonged beside a picture of a walking lesson. She asked if our guests usually moved too fast.',
    'That evening, I asked my mother what she actually wanted to say. "I am wishing them a safe journey," she explained. "I say it even when they leave by car."',
    'Her answer revealed a difference between the words and their purpose. I replaced my translation with "Take care" and was pleased. At least nobody would imagine a walking lesson now.',
    'However, when I showed her the changed card, she stopped for a moment. The meaning was accurate, she said, but the familiar picture of someone walking had disappeared. I read it again, trying to hear her voice in the English words.',
    'I had assumed that a translation needed only to explain the message. For this exhibition, however, the original image mattered too: it showed visitors how an ordinary farewell sounded in our family.',
    'On a large card, I wrote two English lines. One gave the direct meaning, "Walk slowly"; the other explained the intention, "Take care." A small note joined them.',
    'At the exhibition, we placed it by the exit instead of beside the walking picture. Visitors could read both lines at the very moment when someone might say them.',
    'My mother visited to see our work. Before leaving, she read the card aloud, then smiled and said the Mandarin words to us. This time, nobody looked down at their feet.',
  ]),
  questions: [
    {
      kind: 'mcq',
      stem: 'Why does the mother mention people leaving by car?',
      answer: 'To show that her words express care beyond their direct meaning.',
      distractors: [
        'To explain why guests should leave through the school exit.',
        'To show why the partner chose a picture of a walking lesson.',
        'To explain why the card needed a larger space for two lines.',
      ],
      evidence: '"I am wishing them a safe journey," she explained. "I say it even when they leave by car."',
      explanation: '离开时坐车也用这句话，说明母亲是在祝一路平安，而不是要求客人改变走路速度；出口、图片和卡片大小都不是这个例子要解释的内容。',
    },
    {
      kind: 'mcq',
      stem: 'What was missing from "Take care", according to the mother?',
      answer: 'The image of someone walking in the original expression.',
      distractors: [
        'The wish for visitors to have a safe journey.',
        'The example of visitors leaving the house by car.',
        'The place where visitors should read the card.',
      ],
      evidence: 'The meaning was accurate, she said, but the familiar picture of someone walking had disappeared.',
      explanation: '母亲认可意思准确，但指出原话中走路的画面丢失了；结合下一段可知，语言展也要保留这个表达特点。',
    },
    {
      kind: 'mcq',
      stem: 'Why did the writer choose the exit for the final card?',
      answer: 'It let people read the farewell as they were leaving.',
      distractors: [
        'It let the partner put the card beside the walking lesson.',
        'It let the mother show visitors where the cars were waiting.',
        'It let each student bring a larger card from home.',
      ],
      evidence: 'Visitors could read both lines at the very moment when someone might say them.',
      explanation: '结合前一句 placed it by the exit，出口让读者正在离开时读到告别语，使用场合与表达相符；其余选项借用了文中细节但不是摆放的原因。',
    },
    {
      kind: 'tfng',
      item: 'More students attended the exhibition than parents.',
      answer: 'NOT GIVEN',
      explanation: '原文提到学生准备展品和母亲来参观，但没有提供两类参观者的人数或比较。',
    },
    {
      kind: 'tfng',
      item: 'The final card explained both the wording and the intended message of the farewell.',
      answer: 'TRUE',
      evidence: 'One gave the direct meaning, "Walk slowly"; the other explained the intention, "Take care."',
      explanation: '最终两行分别呈现原话的字面意思和说话者的关照用意，与题干 both 一致。',
    },
    {
      kind: 'gapChoice',
      stem: 'The writer placed the final card by the ______.',
      answer: 'exit',
      distractors: ['picture', 'car', 'home'],
      evidence: 'At the exhibition, we placed it by the exit instead of beside the walking picture.',
    },
    {
      kind: 'short',
      marks: 1,
      stem: 'In Paragraph 8, what does "it" refer to in "we placed it"?',
      answer: 'The large card with two English lines and a small note.',
      evidence: 'At the exhibition, we placed it by the exit instead of beside the walking picture.',
      rubric: '一分：答「最后那张有两行译文的卡片 / the final card / the large card」即给分，合理同义表达也给分。答「walking picture / 走路图片」「exhibition / 展览」不给分；被摆到出口的是卡片。',
    },
    {
      kind: 'short',
      marks: 1,
      stem: 'From Paragraph 3, what does the mother wish for her visitors?',
      answer: 'A safe journey.',
      evidence: '"I am wishing them a safe journey," she explained.',
      rubric: '一分：答「一路平安 / a safe journey / that they travel safely」即给分，合理同义表达也给分。答「走慢一点」「学会走路」不给分；题目问母亲的实际祝愿。',
    },
    {
      kind: 'short',
      marks: 2,
      stem: 'Using your own words, explain the writer\'s earlier assumption about translation and the additional aim in Paragraph 6.',
      answer: 'The writer first thought translation only needed to explain the message; the exhibition also needed the original image to show how the family expressed a farewell.',
      evidence: 'I had assumed that a translation needed only to explain the message. For this exhibition, however, the original image mattered too: it showed visitors how an ordinary farewell sounded in our family.',
      rubric: '两分：写出「作者原以为只要解释清楚用意 / 传达意思就够了」给 1 分；写出「展览还要保留原话的形象 / 展示家里告别时表达的方式」再给 1 分。合理同义表达也给分。答「所有翻译必须逐字翻」不给分，原文只讨论本次展览的额外目的；只答「换大卡片」不给第二点。',
    },
    {
      kind: 'short',
      marks: 2,
      stem: 'From Paragraph 7, what information did each of the two English lines give?',
      answer: 'One gave the direct meaning, "Walk slowly"; the other gave the intention, "Take care."',
      evidence: 'One gave the direct meaning, "Walk slowly"; the other explained the intention, "Take care."',
      rubric: '两分：写出「一行给字面意思 Walk slowly / 慢慢走」给 1 分；写出「另一行解释实际用意 Take care / 保重」再给 1 分。合理同义表达也给分；按原文顺序写出两句英文、不加术语，也给两分。只写一句给对应的 1 分；明确将字面意思与实际用意完全写反不给分。答「一行英文、一行普通话」不给分，两行都是英文。',
    },
  ],
};

// 周二那篇（10-27 未发）挪到下周一 11-02，所以排在最后（叶老师 10-27 晚）。
const SPECS = [SHELL, INSTRUCTIONS, FAREWELL, FIELD];

module.exports = {
  LEVEL,
  SPECS,
  DAYS: DATES.slice(0, SPECS.length).map((date, i) => buildAuthoredDay(SPECS[i], date)),
};
