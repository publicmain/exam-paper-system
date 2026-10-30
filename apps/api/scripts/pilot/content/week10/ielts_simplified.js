/**
 * 第十周 —— ielts_simplified（O-Level 基础）档，全原创，四个教学日。
 *
 * 严格沿用第九周结构：九个编号段落；3 道四选一、2 道判断、1 道原文填空
 * （四选一）、4 道主观题（1 / 1 / 2 / 2 分）；每天 10 题、12 分。
 * 篇幅目标 240–260 词，A2 以上超纲率目标 6.0–6.8%，硬上限 7%。
 * 本档不在 GP 指定范围内，四篇均为记叙文，不额外改题型。
 *
 * 选题、梗概、结局与徽章（按日期排列）：
 * · 11-03 history：Putting the Letters Back。在印刷博物馆用可拆字块排印短句，
 *   作者想保留排好的字，后来理解字块必须拆开供下一页使用。结尾亲手把字归盒，
 *   保存的是纸上的成果，空框意味着另一页可以开始；不是发现祖辈旧物。
 * · 11-04 health：A Break Between Jobs。模型社把绘图、剪纸、组装列为不同任务，
 *   却发现大家始终坐着；把休息明确写进安排后，未完工时也可以起身活动。
 *   结尾在胶水未干时共同离桌，不用成绩或步数证明健康效果。
 * · 11-05 technology：Two Icons, One File。作者把快捷方式改名，误以为保留了旧稿；
 *   修改通过两个图标打开的同一文件后，才用真正的独立副本做对照。
 *   结尾通过一改一留的验证确认差别，不涉及机器学习或保存媒介失效。
 * · 11-06 psychology：Before We Counted。课堂两组在估计同一瓶珠子前看到不同数字，
 *   估计的方向出现差别；教师强调小活动不能证明对每个人都成立。
 *   结尾作者保留自己不准确的答案，提醒自己追问最先看到的数字来自哪里。
 * 四篇骨架依次为历史工艺的拆解、活动安排调整、数字对象的对照验证、有限观察的反思；
 * 结局分别是归还材料、共同暂停、验证独立副本、保留个人问题，不用禁用叙事套路。
 *
 * 事实核对与把握程度：遵照 brief 不联网，仅使用有把握的基础知识和原创情节。
 * · 历史：可移动字块能排成页面、涂墨后印到纸上，拆开后可重新排印，把握高。
 *   博物馆、木字块、短句、活动用字数量及人物行动全部虚构；不写发明者、发明年代、
 *   首创地点或所有历史印刷作坊都只有一套字等未经核实的说法。
 * · 健康：社团安排和肩膀发僵为虚构人物的具体体验；没有医学剂量、治疗建议、
 *   疾病判断或普遍效果承诺。换任务仍坐着与真正离桌活动的区别可由情节直接检查。
 * · 技术：快捷方式指向原文件，改快捷方式名称不会创建独立内容；真正复制的文件
 *   可以分别编辑，把握高。仅写故事里本机上的普通文件，不泛化同步服务行为。
 * · 心理：先出现的数字可能影响后续估计，把握高；两组结果只是原创课堂情节，
 *   不冒充真实研究，不写研究者或效应量；正文明确小活动不能证明人人都会如此。
 * 四篇不用人物姓名，避开第八、九周各档人名；背景不用组屋或熟食中心。
 *
 * 查重：完整对照 pack-titles-1030.txt（1–9 周）与 read-titles-1030.txt，
 * 检索内容包中的 printing / movable type / letter blocks / shortcut / separate copy /
 * movement break / sitting / first number / anchoring / estimate 等，并核对相近旧文。
 * · The Slow Journey of Paper 写造纸方法与传播，提到廉价纸与印刷互相推动；本篇写
 *   排印后拆字复用，不写造纸、传播或纸张与印刷市场的关系。
 * · Ten Floors Up 写爬楼的进步记录；本篇不训练体能、不比较表现，处理的是连续久坐。
 * · The Longer Page / The Instructions on the Lid 写读者缺少操作信息；本篇技术文
 *   区分快捷方式与独立文件，不测试说明书，也不重复 The Gap in the Graph 的缺测数据。
 * · Paper Won Again 写旧软盘读取失败；本篇没有旧设备、时间胶囊或文件损坏。
 * · The Slipper Test 写机器学到背景特征；本周心理文讨论人的估计受先前数字影响，
 *   不训练或测试模型，也不重复记忆改写、注意盲区、选项过多或延迟满足等旧题。
 * 标题清单不能代替旧文全文；对上述可疑近邻核对本地可读正文及文件头，未发现同题高潮。
 *
 * 全周判断题：FN / TN / FT / NF → TRUE 2、FALSE 3、NOT GIVEN 3。
 * 每天两题答案不同；FALSE 均有直接反证；NOT GIVEN 分别问纸张颜色、
 * 改安排后的出勤变化、实际珠子数量，正文均不提供。证据均取原文连续逐字片段。
 * 简答题按意思给分；两分题两个信息点可独立核查；照抄但没有解释所问关系的层次不给分。
 */

'use strict';

const { buildAuthoredDay, numbered } = require('../authored');
const { DATES } = require('./dates');

const LEVEL = 'ielts_simplified';

// 周二 —— history：排印成果可以保留，字块需要拆开复用。
const LETTERS = {
  key: 'original-w10-letters-back',
  title: 'Putting the Letters Back',
  passage: numbered([
    'At a printing museum, our class was given small wooden blocks, each carrying a raised letter. Before computers, letters like these could be arranged to print a page that people would read at home.',
    'Together, we placed the blocks in a frame to make a short message. It was slow work to find each letter, although we had already agreed on every word. This part needed patience.',
    'The guide put ink on the raised surfaces and pressed paper against them. When she lifted it, our message appeared. Making another copy required no new arrangement.',
    'I was pleased with the result, but liked the neat rows inside the frame even more. They seemed worth keeping as a record of our effort.',
    'Then the guide started removing the blocks. I asked whether our arrangement could remain on display, so that later visitors would see how much work it required.',
    'She explained that the next group would need the same letters for a different message. Keeping our page arranged would prevent those blocks from being used again.',
    'For printers in the past, she added, this ability to reuse letters mattered. Once enough copies had been made, the blocks could return to their separate boxes.',
    'I helped put them back, checking each box carefully. Our sentence gradually disappeared from the frame, although the paper beside it still carried all our words.',
    'We left with the printed page. The empty frame was ready for something new, rather than a sign of wasted effort: taking our page apart was how another page could begin.',
  ]),
  questions: [
    {
      kind: 'mcq',
      stem: 'Why was making a second copy easier than preparing the first one?',
      answer: 'The letters were already arranged in the required order.',
      distractors: [
        'Each wooden block carried a raised letter on its surface.',
        'The class had chosen a short message for the activity.',
        'The writer wanted visitors to see the frame on display.',
      ],
      evidence: 'Making another copy required no new arrangement.',
      explanation: '结合第 2 段寻找和排列字块的工作可知，再印一张时已有排好的版，不必重新排字。字块上的凸字、短消息和作者的留展愿望都是文中细节，但不能解释第二次比第一次省下哪项工作。',
    },
    {
      kind: 'mcq',
      stem: 'What was the writer hoping to preserve by leaving the blocks in the frame?',
      answer: 'Visible evidence of the work behind the printed message.',
      distractors: [
        'A separate box ready to hold each wooden letter.',
        'A printed page that could be carried out of the museum.',
        'Enough loose blocks for the next group to make a page.',
      ],
      evidence: 'I asked whether our arrangement could remain on display, so that later visitors would see how much work it required.',
      explanation: '作者想让后来参观者看到排字所需的劳动，故要保留排版。纸张、分类盒和下一组要用的散字都在文中出现，但不是这项请求的目的。',
    },
    {
      kind: 'mcq',
      stem: 'What change in the writer\'s view is shown by the empty frame at the end?',
      answer: 'Clearing one page makes it possible to create the next.',
      distractors: [
        'The first printed message contained words agreed in advance.',
        'Later visitors could see the work if the arrangement stayed.',
        'The blocks belonged in separate boxes after the printing.',
      ],
      evidence: 'taking our page apart was how another page could begin.',
      explanation: '作者原来想保留排版，结尾却理解拆版能让字块重新用于下一页。事先商量用词、原来的留展理由和归盒操作都不能概括这种对拆版目的的新理解。',
    },
    {
      kind: 'tfng',
      item: 'The guide removed the blocks because the next group would print the same message.',
      answer: 'FALSE',
      evidence: 'She explained that the next group would need the same letters for a different message.',
      explanation: 'same letters 与 different message 要区分：下一组复用字块，但要排不同的内容，直接否定题干的 same message。',
    },
    {
      kind: 'tfng',
      item: 'The class printed its message on yellow paper.',
      answer: 'NOT GIVEN',
      explanation: '正文只说 paper 和 printed sheet，未提供纸张颜色；不能把木字块或墨水的情况补成纸色。',
    },
    {
      kind: 'gapChoice',
      stem: 'After printing, the blocks could return to their separate ______.',
      answer: 'boxes',
      distractors: ['surfaces', 'rows', 'copies'],
      evidence: 'Once enough copies had been made, the blocks could return to their separate boxes.',
    },
    {
      kind: 'short',
      marks: 1,
      stem: 'In Paragraph 8, what does "it" refer to in "the paper beside it"?',
      answer: 'The frame.',
      evidence: 'Our sentence gradually disappeared from the frame, although the paper beside it still carried all our words.',
      rubric: '一分：答「装字块的框 / the frame」给分，合理同义表达也给分。答「the paper / 纸」「the sentence / 句子」「a box / 盒子」不给分；纸放在框旁边。',
    },
    {
      kind: 'short',
      marks: 1,
      stem: 'Why did choosing every word in advance fail to remove the need for patience in Paragraph 2?',
      answer: 'The class still had to find the individual letter blocks.',
      evidence: 'It was slow work to find each letter, although we had already agreed on every word. This part needed patience.',
      rubric: '一分：答「决定用什么词之后仍得逐个找字块 / finding the separate letters still took time」给分，合理同义表达也给分。只写「已经决定每个词」「需要耐心」或照抄 agreed on every word 而没有说明找字的工作仍未完成，不给分。',
    },
    {
      kind: 'short',
      marks: 2,
      stem: 'Explain why keeping the arrangement would cause a problem for the next group, using Paragraph 6.',
      answer: 'The next group needed those same blocks. Its different message required the blocks to be rearranged.',
      evidence: 'She explained that the next group would need the same letters for a different message. Keeping our page arranged would prevent those blocks from being used again.',
      rubric: '两分：写出「下一组也需要这些字块 / 两组共用这一批字」给 1 分；写出「下一组要排不同内容，需要拆开重新排列 / 固定现有排版会妨碍新排版」再给 1 分。两点独立给分，合理同义表达也给分。只写「导览员拿走了字块」不给分；照抄 same letters 却没说明共同需要，不给第一点；只说「下一组来了」不给第二点。',
    },
    {
      kind: 'short',
      marks: 2,
      stem: 'Using your own words, explain what disappeared and what remained when the writer helped in Paragraph 8.',
      answer: 'The sentence made from blocks was taken apart. The printed message remained on the paper.',
      evidence: 'Our sentence gradually disappeared from the frame, although the paper beside it still carried all our words.',
      rubric: '两分：写出「框里由字块排出的句子被拆开 / 排好的版不再存在」给 1 分；写出「纸上的印刷文字仍保留下来」再给 1 分。合理同义表达也给分。只说「所有字都没了」不给第二点；只照抄 disappeared / carried 而没有区分排版与纸上的文字，不给相应层次的分。答字块被丢弃不给第一点，字块归盒复用。',
    },
  ],
};

// 周三 —— health：任务的名称改变，不代表身体已经得到活动机会。
const BREAKS = {
  key: 'original-w10-break-between-jobs',
  title: 'A Break Between Jobs',
  passage: numbered([
    'Our model club met on Wednesday afternoons to make a cardboard town. We wanted to finish before the school exhibition, so our plan filled every minute with a useful job.',
    'After drawing roads, we cut roofs and then joined walls. These seemed like different activities, yet by the end my shoulders were stiff. My partner could not sit still in her chair.',
    'Our teacher asked us to examine the plan. We proudly showed her the variety of jobs, expecting her to praise the way we had avoided doing one thing all afternoon.',
    'Instead, she asked where we would be during each activity. Every answer was the same: at our table. Changing what our hands were doing had hardly changed how we sat.',
    'We had allowed ourselves a break after finishing a building. However, each building took longer than expected, and there was always one more wall that seemed nearly ready.',
    'Together, we added short breaks between stages, whether a building was complete or not. During these, we could leave the table and walk around the room without rushing.',
    'The following Wednesday, I suggested discussing our next roof while we walked. My partner refused politely: that would turn the pause into another job. We left the plans behind.',
    'Our teacher did not promise that breaks would make the town better or help us finish sooner. Their purpose was to give us chances to move during a seated afternoon.',
    'When we returned, one wall still needed glue. It could wait. This time, an unfinished building had not kept everyone in their chairs until the end of the club.',
  ]),
  questions: [
    {
      kind: 'mcq',
      stem: 'What did the teacher reveal by asking where each activity would happen?',
      answer: 'Different jobs still kept the students sitting at one table.',
      distractors: [
        'Drawing roads came before cutting roofs and joining walls.',
        'The exhibition required a completed cardboard town.',
        'The students had written a useful job into every minute.',
      ],
      evidence: 'Changing what our hands were doing had hardly changed how we sat.',
      explanation: '第 3 段强调任务名称多样，第 4 段却指出身体一直坐在桌边；教师的问题揭示的是多种任务与活动身体之间的差别。其他选项是制作顺序或项目背景。',
    },
    {
      kind: 'mcq',
      stem: 'Why did the original rule often delay a break?',
      answer: 'A building took longer than expected to reach completion.',
      distractors: [
        'The writer wanted to discuss a roof while walking.',
        'A plan showed several kinds of work for the afternoon.',
        'An exhibition gave the students a reason to make a town.',
      ],
      evidence: 'We had allowed ourselves a break after finishing a building. However, each building took longer than expected, and there was always one more wall that seemed nearly ready.',
      explanation: '原规则把休息绑定在完工之后，而完工不断延后，于是休息也延后。边走边讨论是后来提出但被拒绝的建议；任务多样和展览背景没有解释这个规则为何失效。',
    },
    {
      kind: 'mcq',
      stem: 'Why did the partner refuse to discuss the roof during the walk?',
      answer: 'The pause would become a further period of work.',
      distractors: [
        'Drawing roads had been followed by cutting roofs.',
        'The model still needed some glue when they returned.',
        'The plan allowed them to walk around the room.',
      ],
      evidence: 'My partner refused politely: that would turn the pause into another job.',
      explanation: '搭档想保留真正的暂停，边走边讨论仍是在工作。制作顺序、回来后仍需胶水和计划允许散步都是文中细节，但都不能解释她为何拒绝继续讨论。',
    },
    {
      kind: 'tfng',
      item: 'Under the new plan, students could take a break before a building was finished.',
      answer: 'TRUE',
      evidence: 'Together, we added short breaks between stages, whether a building was complete or not.',
      explanation: '新安排明确说 whether a building was complete or not，故未完工也能休息。',
    },
    {
      kind: 'tfng',
      item: 'More students attended the club after the new breaks were introduced.',
      answer: 'NOT GIVEN',
      explanation: '正文写了下一次社团活动中的变化，但没有提供改动前后出勤人数，不能由学生一起离桌推断成员增加。',
    },
    {
      kind: 'gapChoice',
      stem: 'The new plan placed short breaks between ______.',
      answer: 'stages',
      distractors: ['buildings', 'shoulders', 'chairs'],
      evidence: 'Together, we added short breaks between stages, whether a building was complete or not.',
    },
    {
      kind: 'short',
      marks: 1,
      stem: 'In Paragraph 6, what does "these" refer to in "During these"?',
      answer: 'The short breaks between stages.',
      evidence: 'Together, we added short breaks between stages, whether a building was complete or not. During these, we could leave the table and walk around the room without rushing.',
      rubric: '一分：答「阶段之间的短暂休息 / the breaks / short pauses」给分，合理同义表达也给分。答「building / 建筑」「table / 桌子」「the jobs / 工作任务」不给分；these 指可以离桌的休息时段。',
    },
    {
      kind: 'short',
      marks: 1,
      stem: 'Why does the writer mention the wall still needing glue in Paragraph 9?',
      answer: 'To show that unfinished work no longer prevented a break.',
      evidence: 'This time, an unfinished building had not kept everyone in their chairs until the end of the club.',
      rubric: '一分：答「说明工作没做完也能休息 / 未完工不再把大家留在座位上」给分，合理同义表达也给分。只写「墙还要胶水」「墙没完成」或照抄制作细节却没解释它说明了什么，不给分。答「休息让工作全部提前完成」不给分。',
    },
    {
      kind: 'short',
      marks: 2,
      stem: 'Using Paragraphs 3–4, explain what the students counted as variety and what their plan failed to vary.',
      answer: 'They counted different model-making jobs as variety. Their plan left their seated position largely unchanged.',
      evidence: 'Changing what our hands were doing had hardly changed how we sat.',
      rubric: '两分：写出「学生把绘图、剪纸、组装等不同制作任务算作变化 / 多样性在工作内容上」给 1 分；写出「身体仍一直坐着 / 姿势或坐的位置几乎没变」再给 1 分。两点独立给分，合理同义表达也给分。只抄一串工作名称却未说明这是他们认为的变化，不给第一点；只说「安排不好」不给第二点。不能把两点合并为必须全部写对才给 1 分。',
    },
    {
      kind: 'short',
      marks: 2,
      stem: 'From Paragraph 8, explain the intended benefit of the breaks and one result the teacher did not guarantee.',
      answer: 'The breaks offered chances to move. The teacher did not guarantee either better models or earlier completion.',
      evidence: 'Our teacher did not promise that breaks would make the town better or help us finish sooner. Their purpose was to give us chances to move during a seated afternoon.',
      rubric: '两分：写出「给久坐中的学生活动身体的机会」给 1 分；写出「不保证模型更好」或「不保证更早完成」任一项，再给 1 分，不要求两项都写。合理同义表达也给分。只抄 make the town better / finish sooner 而没说明这是未保证的结果，不给第二点；答「提高分数」「治好肩膀」不给分，正文没有这些承诺。',
    },
  ],
};

// 周四 —— technology：图标数量不等于独立内容的数量。
const FILES = {
  key: 'original-w10-two-icons',
  title: 'Two Icons, One File',
  passage: numbered([
    'Before changing our club poster on a school computer, I wanted to keep the first version. I chose the command to create a shortcut and renamed the new icon "First Version".',
    'There were now two icons on the screen. Feeling confident, I opened the new one, changed the heading and saved my work. The picture and the meeting details stayed the same.',
    'Later, my partner asked to compare the old heading with the new one. I opened the other icon, expecting the earlier words. It showed the change I had just made.',
    'I thought the computer had copied my changes automatically. Our teacher suggested checking what each icon opened before making any more guesses about what had happened.',
    'Both led to the same file in our club folder. The shortcut was only a link to that file; giving the link a different name had not produced separate contents.',
    'To make the difference visible, we created another poster file by copying the original. We gave this copy its own name and opened it beside the original.',
    'Then we changed the heading in the copy and saved it. When we opened the original again, its heading had stayed unchanged. This time, we really had two separate files.',
    'My partner pointed at the first shortcut. It was useful for reaching the poster quickly, but it could not keep an earlier version safe while we edited that same poster.',
    'Before continuing, I checked our new copy once more. Counting icons had seemed enough; now I wanted evidence that changing one file would leave the other alone.',
  ]),
  questions: [
    {
      kind: 'mcq',
      stem: 'Why did the other icon fail to show the earlier heading?',
      answer: 'Both icons opened the same file that had been edited.',
      distractors: [
        'Both headings had been put beside the meeting details.',
        'The partner had asked to compare the two headings.',
        'The picture had remained the same after the first edit.',
      ],
      evidence: 'Both led to the same file in our club folder.',
      explanation: '结合第 2–3 段的修改和再次打开可知，两个图标都通往已经改过的同一文件，因此没有保留旧标题。其他选项只是页面内容或比较的背景。',
    },
    {
      kind: 'mcq',
      stem: 'What assumption was behind naming the shortcut "First Version"?',
      answer: 'A new icon would preserve a separate set of contents.',
      distractors: [
        'A new heading would leave the meeting details unchanged.',
        'The first poster contained a picture and meeting details.',
        'The new files could be opened beside one another.',
      ],
      evidence: 'giving the link a different name had not produced separate contents.',
      explanation: '作者的目标是保留初稿，却把新图标当成独立内容。第 5 段直接解释了这一误解；改标题未动会议细节是真实操作结果，但不是命名的假设。',
    },
    {
      kind: 'mcq',
      stem: 'Which observation supported the conclusion that the new copy was separate?',
      answer: 'Editing its heading left the original heading unchanged.',
      distractors: [
        'Renaming the shortcut added another icon to the screen.',
        'Opening the shortcut made the poster easy to reach.',
        'Saving the first edit left the meeting details in place.',
      ],
      evidence: 'When we opened the original again, its heading had stayed unchanged.',
      explanation: '第 7 段先修改副本，再检查原件不变，用内容是否相互影响验证独立性。图标变多、打开方便以及其他内容没改都不能完成这个验证。',
    },
    {
      kind: 'tfng',
      item: 'Renaming the shortcut created a poster with separate contents.',
      answer: 'FALSE',
      evidence: 'giving the link a different name had not produced separate contents.',
      explanation: '原文明说改链接名称没有产生独立内容，直接否定题干。',
    },
    {
      kind: 'tfng',
      item: 'The shortcut remained useful even though it did not preserve the earlier version.',
      answer: 'TRUE',
      evidence: 'It was useful for reaching the poster quickly, but it could not keep an earlier version safe while we edited that same poster.',
      explanation: '快捷方式仍让人快速打开海报；它的用途与保留旧稿是两件不同的事，题干与原文一致。',
    },
    {
      kind: 'gapChoice',
      stem: 'The shortcut was only a ______ to the file in the club folder.',
      answer: 'link',
      distractors: ['picture', 'heading', 'command'],
      evidence: 'The shortcut was only a link to that file;',
    },
    {
      kind: 'short',
      marks: 1,
      stem: 'In Paragraph 8, what does "It" refer to in "It was useful"?',
      answer: 'The first shortcut.',
      evidence: 'My partner pointed at the first shortcut. It was useful for reaching the poster quickly,',
      rubric: '一分：答「最初建立的快捷方式 / the first shortcut / 指向原海报的链接」给分，合理同义表达也给分。答「the new copy / 新的独立副本」「the heading / 标题」「the partner / 搭档」不给分；搭档指的是那个可快速打开原海报的快捷方式。',
    },
    {
      kind: 'short',
      marks: 1,
      stem: 'Why did the teacher ask the pair to check what the icons opened in Paragraph 4?',
      answer: 'To establish what had happened before accepting an explanation.',
      evidence: 'Our teacher suggested checking what each icon opened before making any more guesses about what had happened.',
      rubric: '一分：答「先核对实际打开的文件，再判断原因 / 用事实检验作者的猜测 / find evidence before deciding why」给分，合理同义表达也给分。只照抄「check what each icon opened」而没说明用来核实猜测，不给分；答「为了让电脑自动复制修改」不给分。',
    },
    {
      kind: 'short',
      marks: 2,
      stem: 'Using Paragraph 8, explain what the shortcut could help with and why it could not meet the writer\'s original aim.',
      answer: 'It helped open the poster quickly. It could not preserve an earlier version because it still opened the poster being edited.',
      evidence: 'It was useful for reaching the poster quickly, but it could not keep an earlier version safe while we edited that same poster.',
      rubric: '两分：写出「方便快速打开海报 / 提供便捷入口」给 1 分；写出「仍通向正在修改的同一海报，所以无法保留旧稿」再给 1 分。两点独立给分，合理同义表达也给分。只说「没有用」不给第一点；只抄 keep an earlier version safe 而没说明为何达不到目标，不给第二点。答「快捷方式损坏了文件」不给分。',
    },
    {
      kind: 'short',
      marks: 2,
      stem: 'From Paragraph 7, identify the change made during the test and the result checked in the original.',
      answer: 'They changed the heading in the copy. The heading in the original stayed unchanged.',
      evidence: 'Then we changed the heading in the copy and saved it. When we opened the original again, its heading had stayed unchanged.',
      rubric: '两分：写出「改动副本的标题 / changed the heading in the copy」给 1 分，不额外要求写保存动作；写出「原文件标题仍保持原样」再给 1 分。合理同义表达也给分。只说「有两个图标」没有报告测试操作，不给第一点；把副本与原件的变化写反不给相应分。照抄局部文字但没有区分操作对象和核查对象，不给对应层次的分。',
    },
  ],
};

// 周五 —— psychology：不同的起始数字与估计方向，保留观察的限度。
const ESTIMATES = {
  key: 'original-w10-before-counted',
  title: 'Before We Counted',
  passage: numbered([
    'Our teacher placed a clear jar of beads on the desk and put us into two groups. We were asked to estimate how many were inside just by looking through the glass.',
    'Each group received a different question first. Mine asked if there were more than twenty beads in the jar. The other group was asked about eighty instead.',
    'After answering that question, we each put down our own estimate. We could look at the jar, but we were not allowed to discuss answers before handing them in.',
    'When the estimates were compared, the group given eighty generally chose larger numbers. Yet we had all looked at the same jar. Its contents had not changed between groups.',
    'Our teacher explained that an earlier number can influence a later judgement, even when it offers no useful evidence. We may move away from it without moving far enough.',
    'I had noticed that twenty looked too low, so I thought I was being independent when I chose a number above it. Now I wondered if that first figure had still shaped my answer.',
    'The teacher was careful about the conclusion. This small activity could not prove that every person was influenced, or that any particular answer had been caused by the first question.',
    'She asked us to consider where a starting number comes from before trusting it. A number placed in a question is not automatically a reliable clue to the answer.',
    'I put my first estimate beside the explanation. It was not correct, but I did not want to lose a useful question: why had that particular number seemed reasonable to me?',
  ]),
  questions: [
    {
      kind: 'mcq',
      stem: 'Why does the writer emphasise that both groups saw the same jar?',
      answer: 'Their different estimates were not explained by different contents.',
      distractors: [
        'Their answers had been handed in before the comparison.',
        'Their estimates were written without discussion.',
        'Their teacher had placed a clear jar on the desk.',
      ],
      evidence: 'Yet we had all looked at the same jar. Its contents had not changed between groups.',
      explanation: '同一瓶且内容未变，说明两组估计的方向差别不能归因于珠子本身不同。交卷顺序、禁止讨论和瓶子摆在桌上都是原文细节，但没有说明强调同一瓶的用意。',
    },
    {
      kind: 'mcq',
      stem: 'Why might choosing a number above twenty still fail to show independence?',
      answer: 'The first number might still have shaped how far the estimate moved.',
      distractors: [
        'The students could look through the glass at the beads.',
        'The groups were not allowed to discuss their answers.',
        'Both groups later had their estimates compared.',
      ],
      evidence: 'We may move away from it without moving far enough.',
      explanation: '结合第 6 段，作者虽然没有直接选二十，仍可能以它为起点、调整不足。不能把「不同于起始数字」等同于「完全不受其影响」。看珠子、禁止讨论和比较答案都是活动条件，不能解释为什么高于二十仍可能受它影响。',
    },
    {
      kind: 'mcq',
      stem: 'What is the main reason the writer keeps the original estimate?',
      answer: 'To examine why an uncertain answer had seemed reasonable.',
      distractors: [
        'To record which group had first been given eighty.',
        'To answer the original question about more than twenty.',
        'To list the larger estimates made by the other group.',
      ],
      evidence: 'I did not want to lose a useful question: why had that particular number seemed reasonable to me?',
      explanation: '作者保留错误估计是为了追问自己如何形成判断。八十属于哪一组、最初的比较题和另一组的较大估计都在前文，但不是保留个人估计的原因。',
    },
    {
      kind: 'tfng',
      item: 'There were sixty beads in the jar.',
      answer: 'NOT GIVEN',
      explanation: '二十和八十是预先给的比较数字；原文没有公布实际数量，也不能用两数的平均值猜实际答案。',
    },
    {
      kind: 'tfng',
      item: 'The teacher said that the activity proved every student had been influenced by the first number.',
      answer: 'FALSE',
      evidence: 'This small activity could not prove that every person was influenced,',
      explanation: '教师明确说小活动不能证明每个人都受影响，与题干 proved every student 直接相反。',
    },
    {
      kind: 'gapChoice',
      stem: 'An earlier number can influence a later ______.',
      answer: 'judgement',
      distractors: ['question', 'jar', 'group'],
      evidence: 'an earlier number can influence a later judgement, even when it offers no useful evidence.',
    },
    {
      kind: 'short',
      marks: 1,
      stem: 'In Paragraph 5, what does "it" refer to in "even when it offers no useful evidence"?',
      answer: 'The earlier number.',
      evidence: 'Our teacher explained that an earlier number can influence a later judgement, even when it offers no useful evidence.',
      rubric: '一分：答「先前出现的数字 / the earlier number / the starting number」给分，合理同义表达也给分。只答「the judgement / 判断」「the jar / 瓶子」「the teacher / 老师」不给分；it 是那个可能没有证据价值的起始数字。',
    },
    {
      kind: 'short',
      marks: 1,
      stem: 'Why is the word "generally" important when describing the results in Paragraph 4?',
      answer: 'It describes a group tendency without claiming that every estimate followed it.',
      evidence: 'When the estimates were compared, the group given eighty generally chose larger numbers.',
      rubric: '一分：答「表示整体倾向，不保证每个人或每个估计都更大 / usually rather than every time」给分，合理同义表达也给分。只抄「选了更大的数字」没有解释 generally 的限制作用，不给分；答「证明每个答案都更大」不给分。',
    },
    {
      kind: 'short',
      marks: 2,
      stem: 'From Paragraphs 2–4, explain what differed before the estimates and the pattern found afterwards.',
      answer: 'The groups first compared the contents with different numbers, twenty and eighty. The group given eighty generally made higher estimates.',
      evidence: 'When the estimates were compared, the group given eighty generally chose larger numbers.',
      rubric: '两分：写出「两组先看到不同的比较数字，分别为二十和八十 / 先给的数字不同」给 1 分；写出「先看到八十的一组总体估计更高」再给 1 分。两点独立给分，合理同义表达也给分。只列二十、八十却没有说明是预先给两组的数字，不给第一点；只说「答案不同」未说明高低方向，不给第二点。答实际瓶内数目不同不给分。',
    },
    {
      kind: 'short',
      marks: 2,
      stem: 'From Paragraph 7, give the TWO claims that the teacher said the activity could not prove.',
      answer: 'It could not prove that every person was influenced. It could not prove that the first question caused a particular answer.',
      evidence: 'This small activity could not prove that every person was influenced, or that any particular answer had been caused by the first question.',
      rubric: '两分：写出「不能证明每个人都受影响」给 1 分；写出「不能证明某个具体答案就是由第一个问题造成的」再给 1 分。合理同义表达也给分。两点分别考查对所有人的概括与对个别答案的因果判断。只抄 every person / particular answer 而没表明这些是不能证明的主张，不给相应分；答「没有人受影响」「第一个问题绝无作用」不给分，原文没有作这种断言。',
    },
  ],
};

const SPECS = [LETTERS, BREAKS, FILES, ESTIMATES];

module.exports = {
  LEVEL,
  SPECS,
  DAYS: DATES.slice(0, SPECS.length).map((date, i) => buildAuthoredDay(SPECS[i], date)),
};
