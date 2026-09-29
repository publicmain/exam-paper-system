/**
 * 第六周 —— **olevel_intermediate（O-Level 中级）**档，全原创。
 *
 * 四百词上下的记叙文，八段。形状与第四、五周这一档一致：
 *   4 道情绪配对（共用八个词的词库） · 1 道短语理解四选一 · 1 道原文填空 ·
 *   4 道两分主观题 —— 满分 14。
 *
 * 五天五个领域：运动（校队）/ 兄弟 / 做视频（定格动画）/ 网上两难（家族群里的诈骗链接）/
 * 集体出游（拓展中心高空绳索）。选题先对过学生已读的 226 个标题和内容包全部 125 篇。
 * 结局刻意各不相同：荒诞喜剧 / 角色互换 / 反讽 / 各执一词 / 没有战胜恐惧的反高潮。
 *
 * 情绪配对的四个时刻挑「原文没有直接写出那个情绪词」的地方，每个时刻在本段内都有
 * 叙述者自己的反应（动作、表情、心里话）；每个词库避开上周盲做抓到的相邻词对
 * （doubtful/astonished、surprised/disappointed、anxious/determined 等）。
 *
 * 事实性内容只有两处，都是故事里人物的说法，不是说明文断言：
 *   · Frame by Frame：「一秒 12 张 × 90 秒 = 1,080 张」只是她们那个 app 的设置，数字自洽；
 *     第一周 8 秒 = 96 张，第三周周三到第 910 张，周日前拍满 1,080 张。
 *   · Forwarded Many Times：诈骗的三个信号（限时、陌生链接、要银行资料）是通行说法；
 *     「Forwarded many times」是常见聊天软件给多次转发消息打的标签，文中不点名软件。
 */

'use strict';

const { buildAuthoredDay, numbered } = require('../authored');
const { DATES } = require('./dates');

const LEVEL = 'olevel_intermediate';

// ═══════════════════════════════════════════════════════════════
// 周一 —— Lucky Socks
// ═══════════════════════════════════════════════════════════════

const SOCKS = {
  key: 'original-w6-lucky-socks',
  title: 'Lucky Socks',
  passage: numbered([
    'On the morning of our first match of the season, I got dressed in the dark. At the sports hall, I looked down and saw one white sock and one pale yellow one. There was no time to change them. That afternoon I scored sixteen points, my best ever in a real game, and our under-fifteen basketball team won by two.',
    'After that, I wore the same two socks to every match, and I never washed them. Between games they lived in a plastic bag on our balcony, because my mother would not let them into the flat. We won the next five matches. Before the fifth, Kenneth, our captain, got down on one knee and bowed to my feet. I laughed so hard that I missed my first two shots.',
    'The night before the semi-final, the bag on the balcony was empty. I found my socks in the laundry basket, clean, soft and bright pink. My mother had washed them with my new red jersey. She said sorry three times, but she also said that it was about time. I held the socks up to the light and could not say a single word.',
    "The next morning I showed them to the team. Nobody laughed. Vikram said that the luck had been in the dirt, so now it was gone. Kenneth said that they were still the same socks, and washing could not change that. They argued about it for the whole bus journey, as if it were a question in a science test. In the end Kenneth decided. 'You wear them,' he said. 'Pink or not.'",
    "During the warm-up, the other team noticed at once. Two of their players pointed at my feet, and one called out, 'Nice socks!' Their whole bench laughed. My face turned hot, and for a moment I thought about playing in bare feet. Instead, I pulled the socks up as high as they would go.",
    'I still do not really know what happened in that game. Every time I got the ball, I thought about the boy who had shouted, and I ran a little faster. I scored twenty-one points. We won by nine, and when the final buzzer went, Vikram and I jumped up and down together, shouting something that was not really words.',
    'For the final, Kenneth arrived with thirteen pairs of pink socks: one pair for every player and one for our coach, Mr Yusof, who put his on too. We walked onto the court in a bright pink line. The other team did not laugh at all. They beat us by twenty points.',
    'Nobody blamed the socks. On the bus home, Vikram said that pink socks only worked when one person wore them. Kenneth said that they only worked against teams who laughed at them. They are still arguing. We have lost more games than we have won since then, but we all still wear pink socks, and every school in our zone knows exactly who we are.',
  ]),
  questions: [
    {
      kind: 'matchingFeelings',
      bank: ['amused', 'shocked', 'embarrassed', 'delighted', 'jealous', 'bored', 'lonely', 'guilty'],
      items: [
        { moment: "Paragraph 2 — when Kenneth gets down on one knee before the fifth match", answer: 'amused', para: 2 },
        { moment: 'Paragraph 3 — holding the socks up to the light', answer: 'shocked', para: 3 },
        { moment: "Paragraph 5 — hearing the other team's bench laugh", answer: 'embarrassed', para: 5 },
        { moment: 'Paragraph 6 — when the final buzzer goes', answer: 'delighted', para: 6 },
      ],
    },
    {
      kind: 'mcq',
      stem: 'In Paragraph 4, what does "as if it were a question in a science test" suggest about the argument?',
      answer: 'They treated a silly question very seriously.',
      distractors: [
        'They had a science test later that day.',
        'They were only pretending to disagree.',
        'Their teacher had asked them the question.',
      ],
      evidence: 'They argued about it for the whole bus journey, as if it were a question in a science test.',
    },
    {
      kind: 'gapChoice',
      stem: 'Between games, the writer kept the socks in a plastic bag on the ______.',
      answer: 'balcony',
      distractors: ['court', 'bench', 'bus'],
      evidence: 'Between games they lived in a plastic bag on our balcony, because my mother would not let them into the flat.',
    },
    {
      kind: 'short',
      marks: 2,
      stem: 'According to Paragraph 1, why was the writer wearing two different socks, and what happened in that first match?',
      answer:
        'The writer got dressed in the dark and only noticed at the sports hall, when there was no time to change; in the match, the writer scored sixteen points, a personal best, and the team won by two.',
      evidence: 'On the morning of our first match of the season, I got dressed in the dark.',
      rubric:
        '两分：写出原因「摸黑穿衣服（没看清颜色）」或「到了体育馆才发现，已经来不及换」给 1 分（两者写一个即可，两个都写也只算这 1 分）；写出比赛结果「作者得了十六分，是正式比赛里最好的一次」或「球队赢了两分」再给 1 分（两者写一个即可）。',
    },
    {
      kind: 'short',
      marks: 2,
      stem: 'According to Paragraph 4, what did Vikram and Kenneth each believe about the washed socks?',
      answer:
        'Vikram believed that the luck had been in the dirt, so washing had taken it away; Kenneth believed that they were still the same socks, and washing could not change that.',
      evidence: 'Vikram said that the luck had been in the dirt, so now it was gone.',
      rubric:
        '两分：写出 Vikram 的看法「运气在脏东西里，洗掉了运气就没了」给 1 分；写出 Kenneth 的看法「还是同一双袜子，洗一洗改变不了这一点」再给 1 分。只写「两人在车上争论」、没写各自的看法，不给分。',
    },
    {
      kind: 'short',
      marks: 2,
      stem: 'Using your own words, explain how being laughed at by the other team affected the way the writer played (Paragraph 6).',
      answer:
        'Whenever the writer had the ball, the writer remembered the boy who had made fun of the socks, and this pushed the writer to move more quickly and play harder.',
      evidence: 'Every time I got the ball, I thought about the boy who had shouted, and I ran a little faster.',
      rubric:
        '两分：写出「一拿到球，就想起那个嘲笑袜子的对方男孩」给 1 分；写出「跑得更快 / 打得更拼」再给 1 分。写「得了二十一分」「球队赢了九分」不给分 —— 那是打法带来的结果，不是打法本身的变化；写第 5 段「把袜子拉到最高」也不给分 —— 那是热身时的动作。',
    },
    {
      kind: 'short',
      marks: 2,
      stem: 'According to Paragraph 7, what did Kenneth and Mr Yusof do before the final?',
      answer:
        'Kenneth brought thirteen pairs of pink socks, one pair for every player and one for Mr Yusof, and Mr Yusof put his pair on as well.',
      evidence:
        'For the final, Kenneth arrived with thirteen pairs of pink socks: one pair for every player and one for our coach, Mr Yusof, who put his on too.',
      rubric:
        '两分：写出「Kenneth 带来十三双粉色袜子，每个球员一双、教练一双」给 1 分（写「给全队买了粉袜」也给）；写出「教练 Mr Yusof 自己也穿上了」再给 1 分。写「他们输了二十分」不给分 —— 题目问的是赛前做了什么。',
    },
  ],
};

// ═══════════════════════════════════════════════════════════════
// 周二 —— The Copycat
// ═══════════════════════════════════════════════════════════════

const COPYCAT = {
  key: 'original-w6-copycat',
  title: 'The Copycat',
  passage: numbered([
    "My brother Rohan is ten, and for most of this year he has copied everything I do. When I had my hair cut short at the sides, he asked the barber for the same and pointed at me, in case the barber did not understand. At the hawker centre, he waits for me to order and then says, 'Same as him.' He even says 'Seriously?' in exactly my voice.",
    'At first my parents thought it was sweet. I did not. When I did my homework at the dining table, he brought his homework and sat opposite me, holding his pen the way I hold mine. Soon I was doing my homework in my room with the door shut.',
    'So I decided to find something he could not copy. At a food court one evening, I ordered bitter gourd soup, which I have always hated. Rohan ordered it too. He finished his with tears running down his face, and he never once took his eyes off me. I had to bite the inside of my cheek to stop myself from laughing.',
    "The next Saturday, two friends came over to play video games. Rohan sat down next to me with a controller that was not even switched on, pressing the same buttons as me. My friends laughed. I had had enough. 'Get your own life!' I shouted. 'Stop trying to be me!' He put the controller down very carefully and went to his room. Nobody laughed after that. I spent the evening walking up and down outside his door, practising how to say sorry.",
    'After that, he stopped. At the hawker centre, he ordered first, and he chose something different. For the first few days, I enjoyed having the dining table to myself. By the second week, the flat felt strangely quiet. I kept looking up from my homework at the empty chair opposite me, and once I began to tell a joke before I remembered that nobody was there.',
    "Then I noticed that Rohan had a new notebook. He carried it everywhere, and every morning he stood at the window for a long time before school. One evening he left it on the sofa, and I opened it. It was full of birds: small drawings, names, dates and times. 'Sunbird, 7.05 a.m., lamp post.' I had never known that so many kinds of birds lived around our block.",
    'I wanted to ask him about it, but we had hardly spoken since that Saturday. So on Monday I borrowed a book about the birds of Singapore from the school library. I read it in bed every night, and I hid it under my pillow whenever anyone knocked.',
    "On Saturday morning, I stood at the window beside him. A tiny bird with a bright yellow front landed on the railing. 'Olive-backed sunbird,' I said. Rohan turned slowly and looked at me very carefully. 'Are you copying me?' he asked. I thought about it. 'Yes,' I said. He looked back at the bird, and then he moved over a little to make room for me.",
  ]),
  questions: [
    {
      kind: 'matchingFeelings',
      bank: ['annoyed', 'amused', 'guilty', 'lonely', 'frightened', 'proud', 'jealous', 'grateful'],
      items: [
        { moment: 'Paragraph 2 — when Rohan sits opposite the writer at the dining table', answer: 'annoyed', para: 2 },
        { moment: 'Paragraph 3 — watching Rohan finish his soup', answer: 'amused', para: 3 },
        { moment: 'Paragraph 4 — after Rohan goes to his room', answer: 'guilty', para: 4 },
        { moment: 'Paragraph 5 — looking up at the empty chair in the second week', answer: 'lonely', para: 5 },
      ],
    },
    {
      kind: 'mcq',
      stem: 'In Paragraph 1, what does "pointed at me, in case the barber did not understand" suggest about Rohan?',
      answer: "He wanted a haircut exactly like his brother's.",
      distractors: [
        'He was too shy to speak to the barber.',
        'He wanted his brother to pay for the haircut.',
        'He did not trust the barber with scissors.',
      ],
      evidence: 'When I had my hair cut short at the sides, he asked the barber for the same and pointed at me, in case the barber did not understand.',
    },
    {
      kind: 'gapChoice',
      stem: 'One evening, Rohan left his notebook on the ______.',
      answer: 'sofa',
      distractors: ['table', 'railing', 'pillow'],
      evidence: 'One evening he left it on the sofa, and I opened it.',
    },
    {
      kind: 'short',
      marks: 2,
      stem: 'According to Paragraph 1, give TWO examples of how Rohan copied the writer.',
      answer:
        "He asked the barber for the same haircut as the writer; at the hawker centre he waited for the writer to order and then said 'Same as him'; he started saying 'Seriously?' in exactly the writer's voice.",
      evidence: "At the hawker centre, he waits for me to order and then says, 'Same as him.'",
      rubric:
        '两分：任答两点，每点 1 分：① 理发时要和作者一样的发型（还指着作者给理发师看）；② 在熟食中心等作者点完，再说「和他一样」；③ 用和作者一模一样的语气说 "Seriously?"。只算第 1 段的例子；写第 2 段「坐在对面学作者握笔」不给分。',
    },
    {
      kind: 'short',
      marks: 2,
      stem: 'According to Paragraph 3, how did the writer try to find something Rohan could not copy, and how did Rohan respond?',
      answer:
        'The writer ordered bitter gourd soup, which the writer had always hated; Rohan ordered it too and finished it, crying the whole time and watching the writer.',
      evidence:
        'He finished his with tears running down his face, and he never once took his eyes off me.',
      rubric:
        '两分：写出「作者点了自己一直讨厌的苦瓜汤」给 1 分（只写「点了苦瓜汤」也给）；写出「Rohan 也点了，并且流着眼泪喝完（眼睛一直盯着作者）」再给 1 分（只写「他也点了」也给这 1 分）。写作者「咬住腮帮子忍笑」不给分 —— 那是作者的反应，不是 Rohan 的。',
    },
    {
      kind: 'short',
      marks: 2,
      stem: "According to Paragraph 6, what did the writer find inside Rohan's notebook, and what did the writer realise about the area around their block?",
      answer:
        'The notebook was full of birds — small drawings, names, dates and times; the writer realised that far more kinds of birds lived around their block than the writer had known.',
      evidence: 'I had never known that so many kinds of birds lived around our block.',
      rubric:
        '两分：写出「本子里记的全是鸟：小画、鸟名、日期和时间」给 1 分（写出「记的是鸟」即可）；写出「作者这才知道自己住的楼附近有这么多种鸟」再给 1 分。写「Rohan 每天早上在窗边站很久」不给分 —— 那不是本子里的内容。',
    },
    {
      kind: 'short',
      marks: 2,
      stem: 'Using your own words, explain why Rohan asks "Are you copying me?" and what he does after the writer answers (Paragraph 8).',
      answer:
        "The writer has just named the bird correctly, which shows that the writer has been learning about birds — Rohan's own interest; after the writer admits it, Rohan moves aside to give the writer space at the window.",
      evidence: "'Olive-backed sunbird,' I said.",
      rubric:
        '两分：写出「作者一下子叫出了那只鸟的名字 / 也站到窗边看鸟 —— 做的正是 Rohan 的爱好（作者也在学认鸟）」给 1 分（叫鸟名、站窗边看鸟写一个即可，两个都写也只算这 1 分）；写出「作者承认后，Rohan 挪开一点，在窗边给作者让出位置」再给 1 分。只写「他转过头仔细看作者」不给第二分。',
    },
  ],
};

// ═══════════════════════════════════════════════════════════════
// 周三 —— Frame by Frame
// ═══════════════════════════════════════════════════════════════

const FRAMES = {
  key: 'original-w6-frame-by-frame',
  title: 'Frame by Frame',
  passage: numbered([
    'When our school announced a short-film competition, my friend Nurul and I decided to make a stop-motion film. In stop-motion, nothing really moves. You take a photo, move your characters a tiny bit, take another photo, and repeat. When the photos are played quickly one after another, the characters seem to come alive.',
    "Our film was about a toy dinosaur trying to cross a busy road, which was really my desk. We borrowed my cousin's old dinosaurs, made the road from black paper and set up Nurul's phone on a pile of books. Our app played twelve photos every second, and our film was going to be ninety seconds long. Nurul worked it out on her calculator and showed me the screen without a word: 1,080.",
    'We worked on it every afternoon. Between photos, the dinosaur could move only about a millimetre, and if anyone touched the desk, the whole scene jumped. At the end of the first week, we had eight seconds of film. I kept checking the clock, and I asked Nurul four times whether we could move the dinosaur two millimetres instead of one. Each time she said no.',
    'By the third week we were much faster, and on Wednesday we reached photo 910. Then my little brother ran into my room and knocked into the desk. Three dinosaurs fell over, and the road slid sideways. For a long time, neither of us said anything. I felt sick. Then Nurul picked up a dinosaur and asked quietly where its foot had been.',
    "It took us two whole evenings to put everything back in the right place, checking each position against the last photo. By Sunday night we had all 1,080 photos. We played the film to my mother, who said it was wonderful. Then she asked, 'Where is the sound?' We had forgotten about sound completely, and the film had to be handed in the next morning.",
    "So at ten o'clock that night, we recorded everything in my kitchen. The dinosaur's footsteps were me hitting a pillow. The traffic was Nurul saying 'vroom' in six different voices. The rain was a cup of rice poured slowly onto a metal tray. We had to record the car horn nine times, because every time Nurul started, I began to laugh, and then she did too.",
    'The sound took us ten minutes. At the prize-giving two weeks later, our film did not win Best Film or Best Story. Then the teacher read out one more prize: Best Sound. I was sure she had made a mistake, and I did not stand up until Nurul pulled me out of my seat.',
    "Three weeks of pictures, and the prize went to ten minutes in a kitchen. Nurul says that our next film will be the other way round: three weeks on the sound and ten minutes on the pictures. I am almost sure she is joking.",
  ]),
  questions: [
    {
      kind: 'matchingFeelings',
      bank: ['impatient', 'horrified', 'amused', 'astonished', 'jealous', 'lonely', 'guilty', 'calm'],
      items: [
        { moment: 'Paragraph 3 — at the end of the first week of filming', answer: 'impatient', para: 3 },
        { moment: 'Paragraph 4 — after the little brother knocks into the desk', answer: 'horrified', para: 4 },
        { moment: 'Paragraph 6 — recording the car horn', answer: 'amused', para: 6 },
        { moment: 'Paragraph 7 — when the teacher reads out the last prize', answer: 'astonished', para: 7 },
      ],
    },
    {
      kind: 'mcq',
      stem: 'In Paragraph 3, what does "the whole scene jumped" mean?',
      answer: 'Everything moved a little out of position.',
      distractors: [
        'The film suddenly played too fast.',
        'The camera stopped working for a moment.',
        'The characters seemed to come alive.',
      ],
      evidence: 'Between photos, the dinosaur could move only about a millimetre, and if anyone touched the desk, the whole scene jumped.',
    },
    {
      kind: 'gapChoice',
      stem: "The writer and Nurul set up Nurul's phone on a pile of ______.",
      answer: 'books',
      distractors: ['paper', 'photos', 'dinosaurs'],
      evidence: "We borrowed my cousin's old dinosaurs, made the road from black paper and set up Nurul's phone on a pile of books.",
    },
    {
      kind: 'short',
      marks: 2,
      stem: 'According to Paragraph 1, how is a stop-motion film made, and why do the characters seem to move?',
      answer:
        'You take a photo, move the characters a tiny bit, take another photo and keep repeating this; when the photos are played quickly one after another, the characters seem to come alive.',
      evidence: 'When the photos are played quickly one after another, the characters seem to come alive.',
      rubric:
        '两分：写出做法「拍一张，把角色挪一点点，再拍一张，如此反复」给 1 分；写出「把照片一张接一张快速播放，角色就像活了一样」再给 1 分。只写「其实什么都没动」不给分 —— 要写出怎么拍、怎么放。',
    },
    {
      kind: 'short',
      marks: 2,
      stem: "Using your own words, explain what the number 1,080 on Nurul's calculator meant (Paragraph 2).",
      answer:
        'It was the total number of photos they would need to take, because the app showed twelve photos each second and the film was going to last ninety seconds.',
      evidence: 'Our app played twelve photos every second, and our film was going to be ninety seconds long.',
      rubric:
        '两分：写出「这是她们总共要拍的照片张数」给 1 分；写出算法「每秒放十二张，片长九十秒（十二乘九十）」再给 1 分（「每秒十二张」和「九十秒」两个条件都写出才给这 1 分）。只写「这个数字很大」不给分。',
    },
    {
      kind: 'short',
      marks: 2,
      stem: "According to Paragraph 4, what TWO things happened on the desk when the writer's little brother knocked into it?",
      answer: 'Three dinosaurs fell over, and the road slid sideways.',
      evidence: 'Three dinosaurs fell over, and the road slid sideways.',
      rubric:
        '两分：写出「三只恐龙倒了」给 1 分；写出「（黑纸做的）马路滑到一边去了」再给 1 分。写「弟弟跑进房间撞到桌子」不给分 —— 那是原因，不是桌上发生的事。',
    },
    {
      kind: 'short',
      marks: 2,
      stem: 'Give TWO of the ways in which the writer and Nurul made the sounds for their film (Paragraph 6).',
      answer:
        "The dinosaur's footsteps were the writer hitting a pillow; the traffic was Nurul saying 'vroom' in six different voices; the rain was a cup of rice poured slowly onto a metal tray.",
      evidence: 'The rain was a cup of rice poured slowly onto a metal tray.',
      rubric:
        '两分：任答两点，每点 1 分：① 恐龙的脚步声 = 作者拍打枕头；② 车流声 = Nurul 用六种不同的声音说 "vroom"；③ 雨声 = 把一杯米慢慢倒在金属托盘上。只写物品（枕头、米）、没写出对应哪种声音的，两样合起来只给 1 分。只写「晚上在厨房录的」不给分。',
    },
  ],
};

// ═══════════════════════════════════════════════════════════════
// 周四 —— Forwarded Many Times
// ═══════════════════════════════════════════════════════════════

const FORWARDED = {
  key: 'original-w6-forwarded-many-times',
  title: 'Forwarded Many Times',
  passage: numbered([
    "Our family chat has forty-three people in it, and the most active member is my grandmother, Nenek. Every morning at about half past six, she sends a picture of flowers with 'Good morning' written across it in gold. Most of us reply with a heart. It takes one second, and it makes her happy all day.",
    "One Tuesday evening, Nenek sent a different kind of message. It said that the government was giving every family a three-hundred-dollar supermarket voucher. To get it, you only had to click on a link and fill in your bank details before midnight. Above the message was a small grey label: 'Forwarded many times'.",
    "Only a week before, a speaker at school had given us three warning signs of an online scam: a deadline, a strange link and a request for bank details. This message had all three. Then I saw the replies. Two uncles had written 'Thank you!' and Auntie Salmah had written 'Done!' I sat up so quickly that my phone fell onto the floor.",
    'I knew what I had to say. The hard part was where to say it. If I wrote in the family chat that the message was a scam, all forty-three people would see that Nenek had been fooled. If I called her instead, she might not answer, because she always put her phone away after dinner, and more people could click the link while I waited. I typed a message, deleted it, and typed it again.',
    "In the end, I wrote to everyone: 'Sorry, everyone, I think this message is a scam. Please do not click the link. Auntie Salmah, please call your bank now.' I read it three times to make sure it sounded polite, and then I pressed send before I could change my mind. Auntie Salmah called her bank that night, and they stopped her card before anyone could use it.",
    "Nenek did not reply. The next morning, for the first time in three years, there was no flower picture. There was none on Thursday or Friday either. I kept picturing her reading it in front of forty-three people, and I wished I could take it back. On Thursday I bought her favourite kuih after school and asked my mother to give it to her from me. My mother said I had done the right thing in the wrong way. 'You could have called her first,' she said. 'Now everyone knows.' I said that Auntie Salmah had already clicked, and there had been no time. We did not agree, so we stopped talking about it.",
    'On Saturday morning, at 6.32, the flowers came back, as if nothing had happened. Nobody mentioned the voucher. I sent a heart, then a second one, and sat back against my pillow with my eyes closed.',
    "I still think I was right. Everyone's money is safe. My mother still thinks I was wrong. Nenek has never said which of us she agrees with. But last week, for the first time, she sent a message to me alone: a link about a free mobile phone, and underneath it, 'Scam or not?'",
  ]),
  questions: [
    {
      kind: 'matchingFeelings',
      bank: ['alarmed', 'unsure', 'guilty', 'relieved', 'jealous', 'amused', 'bored', 'proud'],
      items: [
        { moment: "Paragraph 3 — reading Auntie Salmah's reply", answer: 'alarmed', para: 3 },
        { moment: 'Paragraph 4 — typing a message and then deleting it', answer: 'unsure', para: 4 },
        { moment: 'Paragraph 6 — during the three mornings without a flower picture', answer: 'guilty', para: 6 },
        { moment: 'Paragraph 7 — when the flower picture arrives on Saturday', answer: 'relieved', para: 7 },
      ],
    },
    {
      kind: 'mcq',
      stem: 'In Paragraph 5, what does "I pressed send before I could change my mind" suggest?',
      answer: 'The writer was afraid of losing courage.',
      distractors: [
        'The writer had not read the message first.',
        'The writer wanted to reply before anyone else.',
        "The writer's phone was about to run out of battery.",
      ],
      evidence: 'I read it three times to make sure it sounded polite, and then I pressed send before I could change my mind.',
    },
    {
      kind: 'gapChoice',
      stem: "Most people in the family chat reply to Nenek's morning picture with a ______.",
      answer: 'heart',
      distractors: ['link', 'flower', 'voucher'],
      evidence: 'Most of us reply with a heart.',
    },
    {
      kind: 'short',
      marks: 2,
      stem: 'According to Paragraph 2, what did the message promise, and what did people have to do to get it?',
      answer:
        'It promised every family a three-hundred-dollar supermarket voucher from the government; to get it, people had to click a link and fill in their bank details before midnight.',
      evidence: 'To get it, you only had to click on a link and fill in your bank details before midnight.',
      rubric:
        '两分：写出「政府给每个家庭三百元超市购物券」给 1 分；写出「在午夜前点链接、填银行资料」再给 1 分（写出「点链接」或「填银行资料」其中之一即可给这 1 分）。只写「这是诈骗」不给分 —— 题目问的是消息本身说了什么。',
    },
    {
      kind: 'short',
      marks: 2,
      stem: 'Using your own words, explain why it was difficult for the writer to decide where to warn the family (Paragraph 4).',
      answer:
        'Writing in the family chat would let all forty-three relatives see that Nenek had been tricked; but phoning her privately might not work, because she usually put her phone away after dinner, and in the meantime more relatives might click the link.',
      evidence:
        'If I wrote in the family chat that the message was a scam, all forty-three people would see that Nenek had been fooled.',
      rubric:
        '两分：写出公开说的坏处「在群里说，四十三个人都会看到 Nenek 被骗了（让她丢脸）」给 1 分；写出私下说的坏处「打电话她可能不接（晚饭后手机收起来了），等的时候可能有更多人点链接」再给 1 分（写出「她可能不接」或「更多人会点」其中之一即可）。只写「不知道该说什么」不给分 —— 原文说作者知道该说什么，难在在哪里说。',
    },
    {
      kind: 'short',
      marks: 2,
      stem: "In Paragraph 6, what did the writer's mother think the writer should have done, and how did the writer answer her?",
      answer:
        'She thought the writer should have called Nenek first; the writer answered that Auntie Salmah had already clicked, so there had been no time.',
      evidence: "'You could have called her first,' she said.",
      rubric:
        '两分：写出妈妈的看法「应该先给 Nenek 打电话（私下说）」给 1 分；写出作者的回答「Salmah 阿姨已经点了链接，没有时间了」再给 1 分。只写妈妈说的「现在大家都知道了」不给第一分 —— 那是妈妈的理由，不是她认为该怎么做。',
    },
    {
      kind: 'short',
      marks: 2,
      stem: 'According to Paragraph 8, what was different about the message Nenek sent last week?',
      answer:
        'For the first time, she sent it to the writer alone instead of to the family chat, and under the link she asked the writer whether it was a scam.',
      evidence: "But last week, for the first time, she sent a message to me alone: a link about a free mobile phone, and underneath it, 'Scam or not?'",
      rubric:
        '两分：写出「这是她第一次只发给作者一个人（不是发到家族群）」给 1 分；写出「她在链接下面问作者『是不是诈骗』」再给 1 分。只写「是一个免费手机的链接」不给分。',
    },
  ],
};

// ═══════════════════════════════════════════════════════════════
// 周五 —— The Third Rung
// ═══════════════════════════════════════════════════════════════

const THIRD_RUNG = {
  key: 'original-w6-third-rung',
  title: 'The Third Rung',
  passage: numbered([
    'After the end-of-year exams, the whole of Secondary Two spent a day at an adventure centre, where the main event was a high ropes course. You climbed a wooden pole with metal rungs, like a ladder, to a platform twelve metres up. Then you walked across a wire to a second platform and came down on a zip line. I have always been afraid of heights. I do not even like standing near the railing of our corridor on the ninth floor.',
    "Our instructor, Mr Pereira, had only one rule. 'You go as high as you choose. When you want to come down, say \"Down\", and I'll bring you down.' I decided that I would go to the top anyway. Everyone else would, and I did not want to be the only one who didn't.",
    "I climbed the first rung, then the second, then the third. Then I looked down. My legs began to shake, and I held on with both hands. Below me, my group was shouting, 'You can do it!' I could not. 'Down,' I said, so quietly that Mr Pereira had to ask me to say it again.",
    'Back on the ground, I took off my helmet and walked away from my group without looking at any of them. I sat down under a tree. Someone was already there: a boy from another class called Wen Jie. He was not even wearing a harness.',
    "'Heights?' he asked. I nodded. 'Same,' he said. 'I didn't even put the harness on. I've been sitting here since ten.' He said it so calmly, as if he were telling me the time, that I laughed for the first time that morning.",
    "We spent the rest of the day as the ground team. We held people's water bottles and glasses, and we told every climber that the view from the top was probably very nice. When a girl stopped in the middle of the wire and could not go on, Wen Jie counted her steps out loud with her until she reached the other side. By then I had begun to think that somebody had to be on the ground, and it might as well be us.",
    "At four o'clock, Mr Pereira asked whether either of us wanted one more try. Wen Jie put on a harness, climbed to the second rung and came down again, grinning. 'New record,' he said. Then it was my turn. I reached the third rung and looked at the fourth one for a long time. This time my legs did not shake. I said 'Down' clearly, and I was smiling when my feet touched the grass.",
    "At the end of the day, Mr Pereira asked my group and Wen Jie's how high each of us had gone. Most people said, 'The top.' I said, 'The third rung.' Wen Jie said, 'The second.' Both groups clapped as loudly as if we had won something. We have still not been any higher. But whenever we pass each other in the corridor, he says, 'Second,' and I say, 'Third.'",
  ]),
  questions: [
    {
      kind: 'matchingFeelings',
      bank: ['determined', 'terrified', 'ashamed', 'calm', 'jealous', 'bored', 'furious', 'grateful'],
      items: [
        { moment: "Paragraph 2 — after hearing Mr Pereira's rule", answer: 'determined', para: 2 },
        { moment: 'Paragraph 3 — looking down from the third rung', answer: 'terrified', para: 3 },
        { moment: 'Paragraph 4 — walking away from the group after coming down', answer: 'ashamed', para: 4 },
        { moment: 'Paragraph 7 — reaching the third rung on the second try', answer: 'calm', para: 7 },
      ],
    },
    {
      kind: 'mcq',
      stem: 'In Paragraph 6, what does "it might as well be us" suggest?',
      answer: 'The two of them were happy to be the ones on the ground.',
      distractors: [
        'Mr Pereira had told them to stay on the ground.',
        'Nobody else had been chosen for the job.',
        'They were too tired to climb any more.',
      ],
      evidence: 'By then I had begun to think that somebody had to be on the ground, and it might as well be us.',
    },
    {
      kind: 'gapChoice',
      stem: "The writer's family lives on the ______ floor.",
      answer: 'ninth',
      distractors: ['second', 'third', 'fourth'],
      evidence: 'I do not even like standing near the railing of our corridor on the ninth floor.',
    },
    {
      kind: 'short',
      marks: 2,
      stem: 'According to Paragraph 1, what did climbers have to do after reaching the first platform?',
      answer: 'They had to walk across a wire to a second platform, and then come down on a zip line.',
      evidence: 'Then you walked across a wire to a second platform and came down on a zip line.',
      rubric:
        '两分：写出「走过一根钢索到第二个平台」给 1 分；写出「坐滑索下来」再给 1 分。写「顺着金属踏杆爬到十二米高的平台」不给分 —— 题目问的是到了平台以后。',
    },
    {
      kind: 'short',
      marks: 2,
      stem: 'Using your own words, explain why the writer laughed for the first time that morning (Paragraph 5).',
      answer:
        'Wen Jie turned out to be afraid of heights too and had not even put on a harness, and he admitted this in a completely relaxed way, as if it were nothing special.',
      evidence: 'He said it so calmly, as if he were telling me the time, that I laughed for the first time that morning.',
      rubric:
        '两分：写出「Wen Jie 也怕高，连安全带都没穿（从十点就坐在这儿）」给 1 分；写出「他说得那么平静，像报时间一样平常」再给 1 分。只写「作者觉得丢脸 / 走到树下」不给分 —— 题目问的是作者为什么笑。',
    },
    {
      kind: 'short',
      marks: 2,
      stem: 'Give TWO things that the writer and Wen Jie did as the ground team (Paragraph 6).',
      answer:
        "They held people's water bottles and glasses, and they told every climber that the view from the top was probably very nice.",
      evidence:
        "We held people's water bottles and glasses, and we told every climber that the view from the top was probably very nice.",
      rubric:
        '两分：写出「帮大家拿水壶和眼镜」给 1 分（水壶和眼镜是同一个动作，两样合起来只算这 1 分）；写出「跟每个要爬的人说上面的风景大概很好」再给 1 分。写「陪卡在钢索中间的女生大声数步子」不给分 —— 那是 Wen Jie 一个人做的，题目问的是两人一起做的事。',
    },
    {
      kind: 'short',
      marks: 2,
      stem: 'According to Paragraph 8, how did the two groups react to the answers of the writer and Wen Jie, and what do the two of them now say to each other in the corridor?',
      answer:
        "Both groups clapped as loudly as if the two of them had won something; now, whenever they pass each other, Wen Jie says 'Second' and the writer says 'Third'.",
      evidence: 'Both groups clapped as loudly as if we had won something.',
      rubric:
        '两分：写出「两组人使劲鼓掌，好像他俩赢了什么」给 1 分；写出「在走廊碰见时，Wen Jie 说 "Second"，作者说 "Third"」再给 1 分。只写「大多数人说爬到了顶」不给分 —— 那是别人的回答，不是对他俩的反应。',
    },
  ],
};

const SPECS = [SOCKS, COPYCAT, FRAMES, FORWARDED, THIRD_RUNG];

module.exports = {
  LEVEL,
  SPECS,
  DAYS: DATES.slice(0, SPECS.length).map((date, i) => buildAuthoredDay(SPECS[i], date)),
};
