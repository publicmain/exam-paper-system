/**
 * 第十周 —— olevel_intermediate（O-Level 中级），四天全原创记叙文。
 * 沿用第九周：每天八段，4 道情绪配对（八词共用词库）、1 道短语理解四选一、
 * 1 道原文填空四选一、4 道两分简答；每天 10 题、14 分。
 * 简答题逐分列出可独立检查的要点，接受合理改写；照抄但未解释题目要求的含义不给对应分。
 * 本档没有判断题：周二至周五各 0 道，全周 TRUE 0 / FALSE 0 / NOT GIVEN 0。
 * 保留同档题型优先，不为通用判断题分布要求另添题。GP 指定档位不含本档，四篇均非 GP 议论文。
 *
 * 11-03 nature｜An Island Until Lunchtime
 *   选题与梗概：自然观察活动中，作者把沙洲画成四面环水的小岛；潮水退去，露出的沙地
 *   将它接回海滩。作者从反复擦图的烦躁转为追问水下边界，用同一观察位置比较三次轮廓。
 *   结局：给原来的绝对名称加上时间条件，保留三张图；不是补数据、修设备或完成漂亮成品。
 *   事实核对：退潮会露出原本被水覆盖的沙地，把握高；虚构地点确有这样的地形是故事设定。
 *   不断言各地都有沙洲、不写潮汐时刻或高度，不解释天文成因；人物全程在固定步道观察。
 *
 * 11-04 culture｜Three Endings for One Hat
 *   选题与梗概：艺术节录音志愿者想保存一个标准故事，三位讲述者却把同一顶大纸帽讲成
 *   果篮、木偶小舞台和扇子。比较听众和结尾后，作者认识到改编本身就是活动的文化实践。
 *   结局：回家与妹妹合讲第四个版本，最后一句由听众接下去；以共同创作收束。
 *   事实核对：活动、往年安排、帽子故事及其四个版本全部虚构，把握高；不冒充任何族群的
 *   古老传说，不给真实文化起源、仪式或禁忌下结论；帽子仅为故事里的纸制道具。
 *
 * 11-05 psychology｜The Comment That Filled the Page
 *   选题与梗概：桌面游戏试玩后，作者只盯着等待太久的一条意见，把整体受欢迎的活动
 *   记成失败；为取消下一次活动而归纳反馈时，才发现自己的说法与整组卡片及现场表现相反。
 *   结局：保留那条有用的批评，先测试修改，再决定下一步；接纳有条件的希望。
 *   事实核对：人物反应、试玩、卡片、修改均虚构；只描述个人的选择性注意，不套诊断，
 *   不宣称普遍心理规律、因果效应、治疗效果或实验数据，把握高。
 *
 * 11-06 learning｜Before the First Line
 *   选题与梗概：设计课的作者误把精细的正面图当成可供重建模型的俯视图；伙伴重建失败后，
 *   作者移去模型屋顶，从上面看物体占地，并让伙伴凭新图重建，最后面对旋转图的迁移任务。
 *   结局：旧题完成后主动停笔思考新角度，尚未把迁移任务做完；不写一窍成能手。
 *   事实核对：上视与正面所呈现的信息不同，把握高；模型、课程和双方约定的符号均虚构。
 *   不把双方自定符号说成制图行业标准，不承诺某种练习法对所有学生的效果。
 *
 * 查重：已完整读 pack-titles-1030.txt（1–9 周标题）与 read-titles-1030.txt，完整读第九周
 *   同档及第八周同档文件头；在内容包和 test-fixtures 检索 shoreline / tide line /
 *   sandbar / sandbank / storytelling / oral tradition / oversized hat / feedback /
 *   top view / plan view / side view 等近邻词。
 *   周二不是 Lines in the Sand 的沙滩画线触发条码发明、海上导航或 The Gap in the Graph 的缺测纠正；
 *   周三不是 How They Met 的家人回忆分歧，也没有旧物、误会和好或真实文化禁忌；
 *   周四不是 The Group Project 的搭档误判，也不是药物安慰效应；
 *   周五不是 A Map Made from Sound 的声音地图、The Test That Teaches 的提取练习，
 *   也不是 Facing the Wardrobe 的抛接诀窍。四篇未发现同题材、同情节骨架或同高潮的旧文。
 *   不设专有人名，避开第八、九周重名；不写组屋、熟食中心及简报禁用的叙事桥段。
 * 情绪词库排除近义竞争项；每个时刻给出具体行为。每篇至少两道简答综合两段以上信息。
 * evidence 均为一段内连续逐字片段，跨段推理的另一处依据写在解析里。全文与题目按校园安全逐句自查。
 */

'use strict';

const { buildAuthoredDay, numbered } = require('../authored');
const { DATES } = require('./dates');

const LEVEL = 'olevel_intermediate';

// 周二 —— nature
const ISLAND = {
  key: 'original-w10-island-until-lunchtime',
  title: 'An Island Until Lunchtime',
  passage: numbered([
    "On our nature club's coastal walk, I volunteered to draw the view from the wooden walkway. While the others unpacked their lunches, I held up my notebook so that everyone could admire its precise outlines. Having included every visible rock, I considered my map more useful than their photographs. Our task was to observe the beach throughout the morning, but my contribution already looked complete.",
    "Beyond the railing lay an island of pale sand, separated from the beach by a narrow stretch of water. I drew a firm line around it and wrote ISLAND in careful capitals. A notice beside the walkway mentioned the falling tide. I read it without connecting that information to the permanent boundary I had just placed on paper.",
    "When I looked up again, the island seemed wider. I rubbed out its edge and drew another, only to find that this too was wrong by the time I finished. After the third attempt, I pressed the eraser into the page and closed my notebook sharply. The landscape refused to cooperate with my neat arrangement of lines and labels.",
    "Yet the rocks had not changed position. Using a fork in a nearby tree to check my view, I realised that the water was withdrawing rather than the sand moving towards us. I kept my last outline and began a second drawing, placing the rocks in identical positions. These fixed points allowed a comparison which my repeated corrections had prevented.",
    "A darker strip now appeared beneath the shallow water between the island and the beach. I leaned against the railing, following it with my finger and asking what might emerge next. Lunch remained unopened beside me. Instead of trying to finish the picture, I wanted to discover how far that hidden strip continued and whether it reached the shore.",
    "Gradually, the strip became exposed. It joined the island to the beach without anyone carrying over a single grain of sand. The connection had been underwater when we arrived; the falling tide had revealed it. I recorded a third outline. Our teacher reminded us that all our drawings showed the same place. What differed was how much of its surface the water allowed us to see.",
    "I turned rapidly between my pages, then stared with my mouth open at the unbroken stretch of sand. Something I had confidently drawn as separate was attached to the shore. Its isolation had been temporary; my interpretation depended on the height of the water. Beside my original label, I added UNTIL LUNCHTIME. The words were no longer a permanent description of the land, but an account of how it had appeared during our visit.",
    "Before leaving, I put the eraser away and kept all three drawings. Together they showed a transformation which none could explain alone. The next person might arrive when water surrounded the sand again and find my last picture equally puzzling. Below the title, I therefore wrote when each drawing had been made. My island had acquired a condition: it depended on the sea.",
  ]),
  questions: [
    {
      kind: 'matchingFeelings',
      bank: ['proud', 'frustrated', 'curious', 'astonished', 'guilty', 'lonely', 'grateful', 'bored'],
      items: [
        { moment: 'Paragraph 1 — holding up the notebook for everyone to admire its outlines', answer: 'proud', para: 1 },
        { moment: 'Paragraph 3 — pressing the eraser into the page and closing the notebook sharply', answer: 'frustrated', para: 3 },
        { moment: 'Paragraph 5 — following the dark strip with a finger and asking what might emerge next', answer: 'curious', para: 5 },
        { moment: 'Paragraph 7 — turning between pages and staring open-mouthed at the connected sand', answer: 'astonished', para: 7 },
      ],
    },
    {
      kind: 'mcq',
      stem: "In Paragraph 8, what does 'My island had acquired a condition' mean?",
      answer: 'Calling the sand an island was accurate only when water separated it from the beach.',
      distractors: [
        'Drawing the sand as an island was possible only when the rocks were left out of the view.',
        'Keeping the sand as an island required visitors to remove the strip leading to the beach.',
        'Finding the sand as an island required visitors to stand beside the fork in the same tree.',
      ],
      evidence: 'My island had acquired a condition: it depended on the sea.',
      explanation: '第 6 段露出连接海滩的沙地，第 7 段把标签限定为某段时间；condition 指称为岛的条件是水把它与海滩隔开。固定观察点用于比较，不是成岛条件。',
    },
    {
      kind: 'gapChoice',
      stem: 'The writer checked the viewing position by using a ______ in a nearby tree.',
      answer: 'fork',
      distractors: ['leaf', 'root', 'flower'],
      evidence: 'Using a fork in a nearby tree to check my view, I realised that the water was withdrawing rather than the sand moving towards us.',
    },
    {
      kind: 'short', marks: 2,
      stem: 'Using Paragraphs 1–3, explain why the writer initially thought the work was complete, and why that judgement soon failed.',
      answer: 'The writer thought a precise drawing of all the visible features was enough; the changing water level altered the visible edge, so one fixed outline could not describe the whole morning.',
      evidence: 'Our task was to observe the beach throughout the morning, but my contribution already looked complete.',
      rubric: '两分：说明「作者把画全眼前可见景物 / 轮廓精确当作完成任务」给 1 分；说明「水退后可见边界改变，固定的一张轮廓不能代表整个上午」再给 1 分。合理变体给分。只照抄画得整齐、带午餐等句子而未解释完成标准不给第一分；只写画错了而不解释变化不给第二分。',
      explanation: '第 1 段将任务的持续观察与作者的静态完成标准对照；第 2 段潮退提示与第 3 段反复变化说明为什么标准失效。',
    },
    {
      kind: 'short', marks: 2,
      stem: 'Read Paragraphs 3–4. Why were separate drawings from one viewing position more useful than repeatedly correcting the first drawing? Give TWO reasons.',
      answer: 'Separate pages preserved the earlier outlines for comparison; keeping the rocks in the same positions made changes in the visible sand distinguishable from a change of viewpoint.',
      evidence: 'These fixed points allowed a comparison which my repeated corrections had prevented.',
      rubric: '两分：说明「分开画保留了以前的轮廓，不会擦掉供比较的记录」给 1 分；说明「固定岩石 / 观察位置，能排除换角度造成的差异」再给 1 分。合理变体给分。只抄画了三张、看树杈等动作而未说明作用不给对应分；把同一个保留记录的理由重复两遍最多 1 分。',
      explanation: '第 3 段擦掉旧轮廓，失去比较材料；第 4 段保留上一幅轮廓，并在固定参照点下开始第二幅画，第三幅轮廓到第 6 段才记录。分开记录保留时间变化，固定岩石和观察位置则排除视角变化，是独立的两个理由。',
    },
    {
      kind: 'short', marks: 2,
      stem: 'Using Paragraphs 5–6, explain what happened to the dark strip and what this showed about the apparent island.',
      answer: 'The falling water exposed the strip joining the sand to the beach; the land connection had already existed underwater rather than being newly created during the visit.',
      evidence: 'The connection had been underwater when we arrived; the falling tide had revealed it.',
      rubric: '两分：写出「水退后暗色带露出并连接海滩」给 1 分；说明「连接原先就在水下，并非上午才新长出 / 搬沙堆成」再给 1 分。合理变体给分。只写沙变多了不给第二分；只照抄没有搬一粒沙但不解释原有连接不给第二分。',
      explanation: '第 5 段暗带仍在浅水下，第 6 段逐渐露出，证明变化的是可见范围，不是刚刚制造了一条连接。',
    },
    {
      kind: 'short', marks: 2,
      stem: 'Read Paragraphs 7–8. Why did the writer qualify the island label, and why were the times of the drawings important for a later viewer?',
      answer: 'The land could be called an island only while water separated it from the beach; recording the times helped a later viewer understand why drawings of the same place showed different boundaries.',
      evidence: 'Below the title, I therefore wrote when each drawing had been made.',
      rubric: '两分：说明「岛这个名称只在被水隔开时成立，不是永久身份」给 1 分；说明「标时间让后来的人理解同一地点的边界为何不一样」再给 1 分。合理变体给分。只抄 UNTIL LUNCHTIME 而未解释条件不给第一分；只写老师要求记时间、方便安排午餐等无依据理由不给第二分。',
      explanation: '第 7 段标签由永久描述变成当时所见，第 8 段设想后来水又环绕沙地的读者，需要时间信息才能理解图与眼前不同。',
    },
  ],
};

// 周三 —— culture
const HAT = {
  key: 'original-w10-three-endings-one-hat',
  title: 'Three Endings for One Hat',
  passage: numbered([
    "As the recording volunteer at our neighbourhood arts festival, I intended to preserve its annual storytelling session properly. I created a folder called FINAL VERSION before the first visitor arrived, certain that one clear recording would settle the task. The organisers had asked for a record of this year's tellings. I assumed that this meant identifying the most accurate one and removing unnecessary repetition.",
    "The first storyteller described a traveller who made an enormous paper hat, then discovered that it slipped over the wearer's eyes. Eventually, the hat became a basket for fruit. Around her sat volunteers from the festival cafe, who laughed at the description of oranges rolling across its wide surface. I carefully noted the ending, expecting to hear it repeated later.",
    "Instead, the next teller turned the hat into a tiny theatre for paper figures. Children sitting near his chair supplied the figures' voices. I stopped my recording and replayed the opening, checking whether I had confused two different stories. The traveller, the paper and the oversized hat were all there. I could not understand why the basket had disappeared completely.",
    "The third teller folded the hat into a fan. Her listeners, gardeners resting after arranging the outdoor plants, waved their programmes as she described the afternoon heat. Although the opening remained recognisable, this ending made the earlier two unnecessary. My notebook now contained three conclusions and a growing list of corrections which somebody would apparently have to make before anything could be saved.",
    "When the coordinator came over, I asked which teller had got the story wrong. She explained that the festival had introduced the shared opening several years earlier, inviting people to invent suitable endings. There was no official conclusion. I covered my list of corrections as she glanced towards it. I had been preparing to correct people for doing exactly what they had been invited to do.",
    "Listening again, I noticed connections which my search for errors had concealed. The fruit basket suited the cafe helpers; the little theatre gave the children parts to perform. The fan belonged to that warm afternoon with the gardeners. These were deliberate adaptations to particular listeners, rather than failures to remember a single approved text. What stayed constant was the traveller finding another use for an awkward object.",
    "I asked whether submitting three recordings would fulfil my assignment. When the coordinator agreed, I let out the breath I had been holding and opened the folder again. Beside each recording, I described its audience. The differences that I had planned to delete were now the reason for preserving all three: they showed the relationship between the telling and the people listening.",
    "At home, my younger sister asked about the hat. In my telling, it became a roof over a station for toy trains. She interrupted to add a waiting room inside. I left the next sentence to her. The festival's record was finished, but the story was already travelling beyond it, with a passenger whose ideas I had not recorded yet.",
  ]),
  questions: [
    {
      kind: 'matchingFeelings',
      bank: ['confident', 'puzzled', 'embarrassed', 'relieved', 'jealous', 'lonely', 'angry', 'bored'],
      items: [
        { moment: 'Paragraph 1 — creating the FINAL VERSION folder before any visitor arrives', answer: 'confident', para: 1 },
        { moment: 'Paragraph 3 — stopping the recording and replaying the opening to check the story', answer: 'puzzled', para: 3 },
        { moment: 'Paragraph 5 — covering the list of corrections when the coordinator looks towards it', answer: 'embarrassed', para: 5 },
        { moment: 'Paragraph 7 — releasing a held breath after the coordinator accepts three recordings', answer: 'relieved', para: 7 },
      ],
    },
    {
      kind: 'mcq',
      stem: "In Paragraph 8, who is the 'passenger whose ideas I had not recorded yet'?",
      answer: 'The sister, who is joining the story by adding ideas of her own.',
      distractors: [
        'The traveller, who is carrying fruit across the festival in a hat.',
        'The coordinator, who is approving the final festival recordings.',
        'The storyteller, who is giving voices to the paper theatre figures.',
      ],
      evidence: 'She interrupted to add a waiting room inside. I left the next sentence to her.',
      explanation: 'passenger 承接故事里的玩具车站，同时指妹妹成为故事的新参与者；她开始加候车室，并接着讲下一句。其余人物或情节出现过，但不是这个尚在贡献新点子的人。',
    },
    {
      kind: 'gapChoice',
      stem: 'The writer added a description of the ______ beside each saved recording.',
      answer: 'audience',
      distractors: ['traveller', 'basket', 'station'],
      evidence: 'Beside each recording, I described its audience.',
    },
    {
      kind: 'short', marks: 2,
      stem: 'Using Paragraphs 1 and 5, explain the difference between the organisers\' task and the task the writer had assumed.',
      answer: 'The organisers wanted a record of that year\'s different tellings; the writer assumed that one correct version had to be selected and the other versions treated as repetition or errors.',
      evidence: 'The organisers had asked for a record of this year\'s tellings.',
      rubric: '两分：写出「主办方要记录当年的讲述 / 不同版本」给 1 分；写出「作者却以为要挑一个标准版本，排除其他重复或错误」再给 1 分。合理变体给分。只抄保存故事但不区分多种讲述与唯一标准最多 1 分；写主办方要求统一结局不给第一分。',
      explanation: '第 1 段把主办方的 tellings 与作者假定的 most accurate one 对照；第 5 段明确没有官方结局。',
    },
    {
      kind: 'short', marks: 2,
      stem: 'Read Paragraphs 2–6. Why do the fruit basket and the little theatre support the writer\'s new interpretation of the different endings? Explain each example.',
      answer: 'The basket ending connected with the cafe volunteers who were listening; the theatre ending allowed the children in that audience to participate by providing voices.',
      evidence: 'The fruit basket suited the cafe helpers; the little theatre gave the children parts to perform.',
      rubric: '两分：解释「果篮适合在场的咖啡区帮手 / 与这群听众的工作相连」给 1 分；解释「小剧场让在场儿童用配音参与」再给 1 分。合理变体给分。只列两个结尾、不说明各自怎样照顾听众不给分；只抄橙子滚动或纸人等细节而未回答适应听众这一层不给对应分。',
      explanation: '第 2、3 段给出听众身份与反应，第 6 段指出这是面向特定听众的有意改编；每个例子独立支持该解释。',
    },
    {
      kind: 'short', marks: 2,
      stem: 'Using Paragraphs 5–7, explain why the writer kept all three recordings and why the added audience notes were useful.',
      answer: 'All three were valid responses to the invitation to invent endings, so there was no single official conclusion to replace them; the audience notes explained how each telling was shaped for its particular listeners.',
      evidence: 'they showed the relationship between the telling and the people listening.',
      rubric: '两分：说明「活动本来允许自编结尾，没有唯一官方结局，三种都有保存价值」给 1 分；说明「听众备注能解释每种改编为什么适合当时的人」再给 1 分。合理变体给分。只写协调员同意而不解释保留理由不给第一分；只抄记录了听众而不说明理解版本差异的作用不给第二分。',
      explanation: '第 5 段交代创作规则，第 6 段对应不同听众，第 7 段把原以为需要删掉的差异变成保存重点。',
    },
    {
      kind: 'short', marks: 2,
      stem: 'Read Paragraphs 6–8. How did the writer both continue the shared story and give up complete control over its new version?',
      answer: 'The writer invented another use for the hat, as a toy station roof, preserving the story\'s central pattern; the writer let the sister add the waiting room and continue the next sentence.',
      evidence: 'In my telling, it became a roof over a station for toy trains.',
      rubric: '两分：说明「把帽子改成玩具车站屋顶，延续给帽子另找用途的主线」给 1 分；写出「让妹妹添加内容 / 接着讲下一句，将部分创作交给听众」再给 1 分。合理变体给分。只抄车站而未说明新用途与共同主线的关系不给第一分；只说妹妹打断了而未说明作者接纳参与不给第二分。',
      explanation: '第 6 段概括不变的故事骨架，第 8 段给出新用途，并把接下来的话留给妹妹，延续了现场随听众共同创作的做法。',
    },
  ],
};

// 周四 —— psychology
const COMMENT = {
  key: 'original-w10-comment-filled-page',
  title: 'The Comment That Filled the Page',
  passage: numbered([
    "For our school's games afternoon, I designed a board game in which players planned paths through an imaginary garden. After testing it, each group wrote what had worked and what needed changing. Several players requested another round before leaving. I collected their cards, expecting constructive suggestions rather than an assessment of whether I should ever design anything again. At least, that was what I told myself.",
    "Most cards mentioned clear rules or interesting choices. One said that the wait between turns was too long. I read that sentence twice, then copied it across the top of my notebook. Beneath it, I wrote AFTERNOON FAILED and put my game away without arranging the pieces for tomorrow. The request for another round no longer seemed worth remembering.",
    "When my friend mentioned the cheerful comments, I examined them for signs of politeness. Perhaps the players had praised the rules only because they knew I had spent time writing them. I held one positive card towards the light, looking for some hidden qualification. The critical sentence, however, needed no such inspection. I accepted it immediately as the only reliable perspective on the afternoon.",
    "I began a message to our teacher asking to cancel the next session. Before sending it, I summarised the feedback as she had requested: what should remain, what should change, and why. This required the whole pile of cards, which I had left underneath the game board. Reading them in order, I found that my notebook heading offered neither a balanced assessment nor an accurate summary.",
    "The writer of the waiting comment had also praised the choices available on each turn. Another group had asked whether the game could be borrowed for lunchtime. My face warmed as I compared these details with the cancellation message. My disproportionate reaction had turned a constructive suggestion into a rejection of everything. I had also dismissed the evidence which contradicted that assumption.",
    "That did not make the waiting problem imaginary. The comment identified a weakness which the positive cards did not remove. Equally, that weakness did not cancel the players' enjoyment. To evaluate the feedback more fairly, I wrote two separate headings: KEEP and CHANGE. Putting a card under one heading no longer prevented me from using another part of the same card under the other.",
    "For the next trial, players would consider their next move while waiting for a turn. I pencilled in another session and began setting out the pieces again, imagining that the change might help. Whether it actually shortened the pauses remained to be tested. I could look forward to finding out without pretending that the first version had been perfect or that success was certain.",
    "I kept the critical comment beside the new plan. It still deserved a response; it simply no longer deserved the whole page. Before closing my notebook, I added the request for another round. There was room for both now. Tomorrow's players would decide whether my revision worked, and I would have to read everything they wrote before deciding what their afternoon had meant.",
  ]),
  questions: [
    {
      kind: 'matchingFeelings',
      bank: ['disappointed', 'suspicious', 'embarrassed', 'hopeful', 'jealous', 'grateful', 'lonely', 'bored'],
      items: [
        { moment: 'Paragraph 2 — writing AFTERNOON FAILED and putting the game away', answer: 'disappointed', para: 2 },
        { moment: 'Paragraph 3 — holding a positive card to the light to look for a hidden qualification', answer: 'suspicious', para: 3 },
        { moment: 'Paragraph 5 — feeling the face warm when comparing the cards with the cancellation message', answer: 'embarrassed', para: 5 },
        { moment: 'Paragraph 7 — pencilling in another session and setting out the pieces while imagining an improvement', answer: 'hopeful', para: 7 },
      ],
    },
    {
      kind: 'mcq',
      stem: "In Paragraph 8, what does 'it simply no longer deserved the whole page' suggest?",
      answer: 'One useful criticism should be considered alongside the rest of the feedback.',
      distractors: [
        'One useful criticism should be rewritten more briefly to save space for rules.',
        'One useful criticism should be removed because players had asked to borrow the game.',
        'One useful criticism should be copied onto every card before the next trial begins.',
      ],
      evidence: 'It still deserved a response; it simply no longer deserved the whole page.',
      explanation: 'whole page 呼应第 2 段负面意见占据整页及总评；第 8 段同时补入再玩一轮的请求，指批评应保留但不再替代全部反馈。',
    },
    {
      kind: 'gapChoice',
      stem: 'Before sending the cancellation message, the writer ______ the feedback as the teacher had requested.',
      answer: 'summarised',
      distractors: ['collected', 'designed', 'tested'],
      evidence: 'Before sending it, I summarised the feedback as she had requested: what should remain, what should change, and why.',
    },
    {
      kind: 'short', marks: 2,
      stem: 'Using Paragraphs 1–3, explain TWO different ways in which the writer gave the waiting comment more importance than the favourable evidence.',
      answer: 'The writer let a comment about one feature stand for the whole afternoon while dismissing requests to play again; the writer treated criticism as honest without question but searched positive comments for reasons to disbelieve them.',
      evidence: 'The critical sentence, however, needed no such inspection. I accepted it immediately as the only reliable perspective on the afternoon.',
      rubric: '两分：说明「把一项等待问题当成整场失败，忽略想再玩的表现」给 1 分；说明「对批评直接相信，对好评却找客套或保留意见，采用不同的可信标准」再给 1 分。合理变体给分。只照抄读了两遍、对光看等行为而未解释失衡不给对应分；同一个忽视好评的意思重复两遍最多 1 分。',
      explanation: '第 1 段有再玩请求，第 2 段将单项问题扩大为总评；第 3 段又对正负意见采用不对称的怀疑标准。',
    },
    {
      kind: 'short', marks: 2,
      stem: 'Read Paragraphs 4–5. Why did preparing the requested summary undermine the writer\'s reason for cancelling? Give TWO points.',
      answer: 'The task required reading the whole set of feedback rather than the single copied sentence; the cards showed continuing interest in the game, including praise from the same person who criticised the waiting.',
      evidence: 'The writer of the waiting comment had also praised the choices available on each turn.',
      rubric: '两分：说明「归纳任务让作者重读整组卡片，不再只看已抄的那一句」给 1 分；说明「整组显示玩家仍喜欢 / 想借游戏，连提批评的人也肯定部分设计，因此不能说全盘被否定」再给 1 分。合理变体给分。只写老师不让取消无依据不给分；只抄正面原句但不说明其反驳全盘失败这一层不给第二分。',
      explanation: '第 4 段按保留、修改与原因归纳，必须看全组；第 5 段同一评论兼有肯定与建议，直接动摇全盘被拒绝的解释。',
    },
    {
      kind: 'short', marks: 2,
      stem: 'Using Paragraphs 5–6, explain why both ignoring the waiting comment and cancelling the whole game would misrepresent the feedback.',
      answer: 'Ignoring the comment would overlook a genuine weakness in the waiting time; cancelling the whole game would overlook the enjoyment and interest that remained despite that weakness.',
      evidence: 'Equally, that weakness did not cancel the players\' enjoyment.',
      rubric: '两分：说明「不理批评会漏掉等待时间这个真实待改问题」给 1 分；说明「取消全部游戏会无视玩家仍喜欢、有兴趣的部分」再给 1 分。合理变体给分。只照抄 KEEP 和 CHANGE 而不解释两类证据不给分；说好评证明等待问题不存在不给第一分；说有缺点就等于无人喜欢不给第二分。',
      explanation: '第 5 段同一卡片包含好评与批评，第 6 段说明两者可以同时成立，不能用一方抵消另一方。',
    },
    {
      kind: 'short', marks: 2,
      stem: 'Read Paragraphs 7–8. What remained uncertain about the revision, and how would the writer make the next judgement more fairly?',
      answer: 'It was uncertain whether planning moves in advance would actually reduce the pauses; the writer would read all the new feedback before judging the next session.',
      evidence: 'Whether it actually shortened the pauses remained to be tested.',
      rubric: '两分：写出「提前想下一步是否真能缩短等待仍要试验」给 1 分；写出「下次先读完所有反馈，再判断整场情况」再给 1 分。合理变体给分。只写还没成功而未指明等待效果不给第一分；写只听好评、删除批评或保证修改成功均不给对应分。',
      explanation: '第 7 段区分希望与已经证实的效果，第 8 段规定先读全部意见再作判断，与先前单句定论相反。',
    },
  ],
};

// 周五 —— learning
const FIRST_LINE = {
  key: 'original-w10-before-first-line',
  title: 'Before the First Line',
  passage: numbered([
    "At a weekend design course, we were given a model reading room and asked to draw a plan from above. Our partners would use the plans to rebuild the room behind a screen. Having won praise for my detailed drawings at school, I selected a clean sheet and sharpened every pencil. I expected the difficult part to be making the furniture look convincing.",
    "I drew the room as though I were standing in its doorway. Each chair had legs, each cupboard had handles, and the windows reflected imaginary clouds. When my partner asked where the tables belonged, I pointed at the tidy row across my page. She asked whether this meant they stood beside one another or whether some were further back. My picture offered no answer.",
    "I turned the paper sideways, then turned it back, studying the row with a frown. From where I sat, the arrangement had seemed obvious. Now I could see several possible rooms hiding inside the same drawing. Adding finer details to the chair legs would not tell my partner what she needed. The problem concerned the position of the furniture, rather than its appearance.",
    "We lifted the model's removable roof and looked directly down into it. The chair legs disappeared beneath their seats; the tops of the cupboards became plain rectangles. Objects which had overlapped from the doorway now occupied separate spaces. I drew rough shapes on scrap paper, recording the floor space each object occupied instead of trying to show every surface it possessed.",
    "Meanwhile, my partner showed me what she had built from my first drawing. The tables formed a line against one wall, leaving the centre empty. In the original, they surrounded a reading area. I lowered my eyes when she placed the two models together. My careful work had looked informative while leaving her to invent the most important relationships for herself.",
    "For the new plan, we agreed that a rectangle would represent a table and a gap would mark a doorway. I used a grid to compare distances and added a small key explaining our symbols. These marks looked less like furniture, yet provided clearer information about its arrangement. We then covered the original model so that my partner could test the drawing without seeing what she was meant to copy.",
    "This time, her rebuilt room matched the arrangement. I began putting away my pencils, but the instructor rotated my plan and asked which doorway would now appear on the left. I reached towards the model, then stopped. Rather than uncovering it, I opened a fresh page and began working through the change, prepared to stay after the others had packed their bags.",
    "The first task had been completed; the new question had not. I still needed to imagine the room from a position I had not drawn. Before making another line, I marked where the observer would stand and considered what could be seen from there. Earlier, I had started with the sharpest pencil. Now I started by deciding what the drawing had to communicate.",
  ]),
  questions: [
    {
      kind: 'matchingFeelings',
      bank: ['confident', 'puzzled', 'embarrassed', 'determined', 'jealous', 'lonely', 'grateful', 'bored'],
      items: [
        { moment: 'Paragraph 1 — selecting clean paper and sharpening pencils while expecting only a drawing challenge', answer: 'confident', para: 1 },
        { moment: 'Paragraph 3 — turning the page sideways and back while studying the row with a frown', answer: 'puzzled', para: 3 },
        { moment: 'Paragraph 5 — lowering the eyes when the partner places the two different models together', answer: 'embarrassed', para: 5 },
        { moment: 'Paragraph 7 — opening a fresh page and continuing despite the others packing their bags', answer: 'determined', para: 7 },
      ],
    },
    {
      kind: 'mcq',
      stem: "In Paragraph 3, what does 'several possible rooms hiding inside the same drawing' mean?",
      answer: 'The drawing left positions unclear, so it could lead to several different arrangements.',
      distractors: [
        'The drawing included several detailed rooms, so a partner could choose a favourite design.',
        'The drawing used several symbols, so each item could stand for a different kind of furniture.',
        'The drawing showed several viewpoints, so a partner could see through each cupboard and wall.',
      ],
      evidence: 'Now I could see several possible rooms hiding inside the same drawing.',
      explanation: '第 2 段看不出桌子是并排还是前后，第 3 段说位置而非外观是问题；同一张含糊图可以被重建成多种布局，并非真画了多间房。',
    },
    {
      kind: 'gapChoice',
      stem: 'To compare distances in the new plan, the writer used a ______.',
      answer: 'grid',
      distractors: ['screen', 'roof', 'cupboard'],
      evidence: 'I used a grid to compare distances and added a small key explaining our symbols.',
    },
    {
      kind: 'short', marks: 2,
      stem: 'Using Paragraphs 1–3, explain why the writer\'s previous success did not ensure a useful plan. Give TWO points.',
      answer: 'Previous praise had been for detailed appearances, which led the writer to focus on convincing furniture; this task required clear positions for rebuilding the room, which those details did not provide.',
      evidence: 'The problem concerned the position of the furniture, rather than its appearance.',
      rubric: '两分：说明「过去因细致外观获赞，作者因此重视把家具画得逼真」给 1 分；说明「本任务要凭位置重建布局，细致外观没有提供这些空间信息」再给 1 分。合理变体给分。只抄曾获好评而未解释关注点不给第一分；只写画得不好不给第二分；说之前从未会画画与原文相反。',
      explanation: '第 1 段先前经验形成外观标准，第 2、3 段伙伴不能确定位置，说明任务需要的能力与先前标准不同。',
    },
    {
      kind: 'short', marks: 2,
      stem: 'Read Paragraphs 2–4. Why did looking down into the roofless model help, and why would drawing more detail on the chair legs not solve the problem?',
      answer: 'The view from above separated the objects and made their floor positions clear; extra detail on the legs would improve appearance without specifying the missing spatial arrangement.',
      evidence: 'Objects which had overlapped from the doorway now occupied separate spaces.',
      rubric: '两分：说明「从上面看使原本遮挡的物体位置分开、占地更清楚」给 1 分；说明「椅腿细节只增加外观，不补桌椅前后或占地关系」再给 1 分。合理变体给分。只抄移去屋顶但不解释视角作用不给第一分；只抄椅腿消失而未说明信息需要不给第二分。',
      explanation: '第 2 段缺少前后位置，第 3 段指出细节无法补足，第 4 段从上面看到分开的占地；两个理由分别对应改变视角与无效细化。',
    },
    {
      kind: 'short', marks: 2,
      stem: 'Using Paragraphs 5–7, explain what the two rebuilding attempts revealed about the first and second drawings.',
      answer: 'The first attempt showed that the attractive drawing left essential positions for the partner to invent; the second attempt matched the model, showing that the simpler plan communicated the arrangement sufficiently.',
      evidence: 'This time, her rebuilt room matched the arrangement.',
      rubric: '两分：说明「第一次摆成另一种布局，证明漂亮图仍漏了必要位置关系」给 1 分；说明「第二次重建吻合，证明较简图传达了足够的布局信息」再给 1 分。合理变体给分。只列桌子在墙边或第一次失败、第二次成功而不解释各自证明什么，不给对应分；把失败归因于伙伴不认真没有依据。',
      explanation: '第 5 段并列两模型暴露图的信息缺口，第 6 段遮住原模型防止照着摆，第 7 段重建吻合因此能验证新图的沟通作用。',
    },
    {
      kind: 'short', marks: 2,
      stem: 'Read Paragraphs 7–8. Why did matching the original arrangement not finish the learning challenge, and how did the writer\'s starting procedure change?',
      answer: 'The rotated plan required imagining another viewpoint, which had not yet been solved; the writer now considered the observer\'s position and the information needed before beginning to draw.',
      evidence: 'Before making another line, I marked where the observer would stand and considered what could be seen from there.',
      rubric: '两分：说明「转过的图带来新观察角度，重建原布局成功并未解决这个新问题」给 1 分；说明「下笔前先确定观察位置 / 需要传达的信息，再画图」再给 1 分。合理变体给分。只抄新问题还没完成而未说角度变化不给第一分；只写换纸或削铅笔不给第二分；说已解决所有视角与原文相反。',
      explanation: '第 7 段把完成原任务与旋转图的新任务分开，第 8 段明确新题未解，并用观察者位置与沟通目的取代先追求画工的起点。',
    },
  ],
};

const SPECS = [ISLAND, HAT, COMMENT, FIRST_LINE];

module.exports = {
  LEVEL,
  SPECS,
  DAYS: DATES.slice(0, SPECS.length).map((date, i) => buildAuthoredDay(SPECS[i], date)),
};
