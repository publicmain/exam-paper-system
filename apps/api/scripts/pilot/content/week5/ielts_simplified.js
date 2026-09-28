/**
 * 第五周 —— **ielts_simplified（O-Level 基础）**档，全原创。
 *
 * 形状与第四周这一档一致：两百词上下、八九个短段、一条线讲到底，
 *   3 道四选一 · 2 道判断 · 1 道原文填空（四选一） · 4 道主观题（1/1/2/2 分）。
 *
 * 选题前对过学生读过的 225 篇（.local/tmp/read-titles-0928.txt）。这一周偏
 * 动手做事、帮忙、运动、出行、天气、学校小事；外公外婆的老物件、组屋邻居、
 * 熟食中心、生日、新鞋、风筝、雨伞、坐错车、图书卡、仓鼠、拼字比赛、鹦鹉、
 * 戒指都已经有了，避开。
 *
 * 照旧：两分题的两个得分点都要能在原文里找到（不靠推断）；不出「他从没做过
 * 什么」这种否定问法；判断题改答案要改题干。
 *
 * 一天一天发布：`DAYS` 按 `dates.js` 取，写完一天、加一天日期。
 */

'use strict';

const { buildAuthoredDay, numbered } = require('../authored');
const { DATES } = require('./dates');

const LEVEL = 'ielts_simplified';

// ═══════════════════════════════════════════════════════════════
// 周一 —— The Flat Tyre
//
// 一个人照着视频补自行车内胎：没有撬胎棒就用两把旧勺子的柄，看不见漏气
// 就把内胎按进一大碗水里找气泡。一周后朋友的车胎也瘪了，发消息叫作者来修。
// 已读标题里骑车的只有「Teaching My Father to Ride」（教爸爸学骑车）和说明文
// 「Cycling in Singapore」，内核都不同。
// ═══════════════════════════════════════════════════════════════

const TYRE = {
  key: 'original-w5-flat-tyre',
  title: 'The Flat Tyre',
  passage: numbered([
    'On Saturday I planned to ride to the beach with my friend Daniel. But my bike had a flat tyre.',
    'The bike shop near us does not open until eleven, and I did not want to wait. So I watched a video about fixing a flat tyre.',
    'First I had to get the tube out of the tyre. I had no special tools, so I used the handles of two old spoons. After twenty minutes the tube was out, and my hands were black.',
    'Then I put some air into the tube. I looked and listened, but I could not find the hole.',
    'The video had a trick for this. I put the tube into a bowl of water, one part at a time. Soon I saw a line of little bubbles. There was the hole! It was smaller than a grain of rice.',
    'I dried the tube and used a pen to draw a circle round the hole. Then I opened the repair kit from my uncle. I put some glue round the hole, waited five minutes and pushed a patch down hard.',
    'I put the tube back and filled the tyre with air. Ten minutes later, it was still hard. It worked!',
    'I got to Daniel\'s house an hour late. "What happened to your hands?" he asked. I explained everything on the way to the beach.',
    'The next Friday, I got a message from Daniel: "My tyre is flat. Can you come and bring your spoons?" I helped him, and this time we needed only fifteen minutes.',
  ]),
  questions: [
    {
      kind: 'mcq',
      stem: 'Why did the writer not take the bike to the shop?',
      answer: 'The shop was not open until eleven.',
      distractors: [
        'The shop was closed on Saturdays.',
        'The shop was too far to walk to.',
        'The shop did not fix bike tyres.',
      ],
      evidence: 'The bike shop near us does not open until eleven, and I did not want to wait.',
    },
    {
      kind: 'mcq',
      stem: 'What did the writer use to get the tube out of the tyre?',
      answer: 'the handles of two old spoons',
      distractors: ['a knife from the kitchen', 'the tools in the repair kit', 'tools from the bike shop'],
      evidence: 'I had no special tools, so I used the handles of two old spoons.',
    },
    {
      kind: 'mcq',
      stem: 'How did the writer find the hole in the tube?',
      answer: 'by putting it into water',
      distractors: ['by listening to it carefully', 'by looking at it closely', 'by feeling it with a finger'],
      evidence: 'I put the tube into a bowl of water, one part at a time.',
    },
    {
      kind: 'tfng',
      item: "The writer's uncle gave the repair kit as a birthday present.",
      answer: 'NOT GIVEN',
    },
    {
      kind: 'tfng',
      item: "The writer arrived at Daniel's house later than planned.",
      answer: 'TRUE',
      evidence: "I got to Daniel's house an hour late.",
    },
    {
      kind: 'gapChoice',
      stem: 'The hole in the tube was smaller than a grain of ______.',
      answer: 'rice',
      distractors: ['sand', 'salt', 'sugar'],
      evidence: 'It was smaller than a grain of rice.',
    },
    {
      kind: 'short',
      marks: 1,
      stem: 'From Paragraph 1, where did the writer plan to go with Daniel?',
      answer: 'To the beach.',
      evidence: 'On Saturday I planned to ride to the beach with my friend Daniel.',
      rubric: '一分：答「海边 / the beach」即给分。',
    },
    {
      kind: 'short',
      marks: 1,
      stem: 'From Paragraph 3, how long did it take the writer to get the tube out?',
      answer: 'Twenty minutes.',
      evidence: 'After twenty minutes the tube was out, and my hands were black.',
      rubric: '一分：答「二十分钟 / 20 minutes」即给分。答第 9 段的「十五分钟」不给分。',
    },
    {
      kind: 'short',
      marks: 2,
      stem: 'From Paragraph 6, give TWO things the writer did to repair the hole.',
      answer: 'The writer drew a circle round the hole, put glue round it, waited five minutes and pushed a patch down hard.',
      evidence: 'I put some glue round the hole, waited five minutes and pushed a patch down hard.',
      rubric:
        '两分：以下任意两点各 1 分：把内胎擦干；用笔在洞的周围画圈；打开修补工具包；在洞的周围涂胶水；等五分钟；把补丁用力按上去。',
    },
    {
      kind: 'short',
      marks: 2,
      stem: 'Using your own words, explain why Daniel sent the writer a message the next Friday (Paragraph 9).',
      answer: "Daniel's own tyre was flat, and he wanted the writer to come and help him fix it.",
      evidence: '"My tyre is flat. Can you come and bring your spoons?"',
      rubric:
        '两分：写出「Daniel 自己的车胎也瘪了」给 1 分；写出「想请作者过来帮他修 / 叫作者带着勺子过来」再给 1 分。用自己的简单英文说对意思即可。',
    },
  ],
};

// ═══════════════════════════════════════════════════════════════
// 周二 —— The Tug of War
//
// 作者班上大多个子小，年年拔河垫底。作者去看常胜班练习，发现他们并不比自己壮，
// 靠的是身体后仰、脚在前、听队长口令一起拉。全班练了一周，运动会上还是
// 输了比赛，但三年来第一次赢下一局。不是「接力最后一棒 / 最后一圈」的桥段：
// 没有个人冲刺翻盘，结局是输了比赛、赢了一局。
// ═══════════════════════════════════════════════════════════════

const TUG = {
  key: 'original-w5-tug-of-war',
  title: 'The Tug of War',
  passage: numbered([
    'Every year at sports day, our class loses the tug of war. Most of us are small and thin.',
    'This year I watched 3A at their practice. They win every year, but they are not much bigger than us. I noticed three things.',
    'First, they leaned back, as if they were sitting on a chair. Second, their feet were in front of them. Third, nobody pulled until their captain shouted, "One, two, PULL!"',
    'I told my class. Some people laughed, but our PE teacher, Mr Rahman, liked the idea. He let us borrow an old rope from the store room.',
    'For a week, we practised at recess on the grass behind the canteen. We pulled against the football team, and they won every time. Our hands hurt.',
    'On sports day, we pulled against 3A. The first pull was over in ten seconds. We lost.',
    'Before the second pull, I turned to my class. "Sit back. Feet in front. Wait for the call." Then I shouted, "One, two, PULL!"',
    'Slowly, the rope moved towards us. The red flag on the rope went over our line, and we heard the whistle. We had won a pull for the first time in three years.',
    'But 3A won the third pull, so they won again. Our class still screamed and jumped as if we had won the cup. Mr Rahman says we can keep the rope.',
  ]),
  questions: [
    {
      kind: 'mcq',
      stem: 'According to Paragraph 3, when did 3A start to pull?',
      answer: 'when their captain shouted',
      distractors: ['when the whistle blew', 'when their teacher said "Go"', 'when the other team pulled'],
      evidence: 'Third, nobody pulled until their captain shouted, "One, two, PULL!"',
    },
    {
      kind: 'mcq',
      stem: 'Where did the class practise?',
      answer: 'on the grass behind the canteen',
      distractors: ['on the school football field', 'in the school hall', 'in the store room'],
      evidence: 'For a week, we practised at recess on the grass behind the canteen.',
    },
    {
      kind: 'mcq',
      stem: "What did some people in the class do when they heard the writer's idea?",
      answer: 'They laughed.',
      distractors: ['They clapped their hands.', 'They asked for a new rope.', 'They wanted to watch 3A too.'],
      evidence: 'Some people laughed, but our PE teacher, Mr Rahman, liked the idea.',
    },
    {
      kind: 'tfng',
      item: "The students in 3A are only a little bigger than the students in the writer's class.",
      answer: 'TRUE',
      evidence: 'They win every year, but they are not much bigger than us.',
    },
    {
      kind: 'tfng',
      item: 'The first pull on sports day went on for a long time.',
      answer: 'FALSE',
      evidence: 'The first pull was over in ten seconds.',
    },
    {
      kind: 'gapChoice',
      stem: 'Mr Rahman let the class borrow an old ______ from the store room.',
      answer: 'rope',
      distractors: ['flag', 'whistle', 'ball'],
      evidence: 'He let us borrow an old rope from the store room.',
    },
    {
      kind: 'short',
      marks: 1,
      stem: "From Paragraph 1, what happens to the writer's class every year at sports day?",
      answer: 'It loses the tug of war.',
      evidence: 'Every year at sports day, our class loses the tug of war.',
      rubric: '一分：答出「拔河总是输」即给分。',
    },
    {
      kind: 'short',
      marks: 1,
      stem: 'From Paragraph 5, who did the class pull against at practice?',
      answer: 'The football team.',
      evidence: 'We pulled against the football team, and they won every time.',
      rubric: '一分：答「足球队 / the football team」即给分。',
    },
    {
      kind: 'short',
      marks: 2,
      stem: 'From Paragraph 3, give TWO details about how 3A used their bodies and feet when they pulled.',
      answer: 'They leaned back as if they were sitting on a chair, and their feet were in front of them.',
      evidence: 'First, they leaned back, as if they were sitting on a chair. Second, their feet were in front of them.',
      rubric:
        '两分：「身体往后仰 / 像坐在椅子上一样」「脚放在身体前面」各 1 分。写「等队长喊口令才一起拉」不给分 —— 那是什么时候拉，不是身体和脚的姿势。',
    },
    {
      kind: 'short',
      marks: 2,
      stem: 'Using your own words, explain why the class was so happy even though 3A won (Paragraphs 8–9).',
      answer: 'They won one of the pulls, and it was the first time in three years that they had won a pull.',
      evidence: 'We had won a pull for the first time in three years.',
      rubric:
        '两分：写出「他们赢了一局（第二局）」给 1 分；写出「这是三年来第一次」再给 1 分。只写「他们赢了比赛」不给分 —— 最后赢的是 3A。用自己的简单英文说对意思即可。',
    },
  ],
};

// ═══════════════════════════════════════════════════════════════
// 周三 —— The Snail Stop
//
// 作者所在的社团每周三去幼儿园帮忙，作者负责带五个小孩过马路去公园。
// 雨后路上全是蜗牛，一个男孩见一只停一只，大家只剩十分钟玩。第二周作者给
// 每个孩子派活：他当「数蜗牛员」，只准边走边数。没有走失、没有车站 ——
// 避开 The Boy by the Gates。
// ═══════════════════════════════════════════════════════════════

const SNAIL = {
  key: 'original-w5-snail-stop',
  title: 'The Snail Stop',
  passage: numbered([
    'Every Wednesday, my club helps at a kindergarten. My job is to walk five children to the park across the road.',
    'Last month, it rained in the morning, and by the afternoon the path to the park was full of snails.',
    'One boy, Jun Kai, stopped at every snail to look at it and say hello. The other children stopped too. At the traffic lights, we missed the green man three times.',
    'We got to the park late, and the children had only ten minutes to play. Teacher Aishah did not say anything, but she looked at her watch.',
    'That night I had an idea. I could not stop Jun Kai from loving snails. But maybe he could love them and keep walking.',
    'The next Wednesday, it rained again. This time, every child had a job. Jun Kai was the Snail Counter. He had to count every snail, but he had to keep walking. The others counted red cars.',
    'It worked. Jun Kai walked and counted at the same time, and we crossed the road at the first green man. He counted twenty-three snails on the way there.',
    'They played in the park for thirty minutes. On the way back, Jun Kai counted nineteen snails. "Four went home," he said.',
    'A week later, Jun Kai gave me a drawing of a tall boy and twenty-three snails. The tall boy was me.',
  ]),
  questions: [
    {
      kind: 'mcq',
      stem: 'What did Jun Kai do at every snail on the first walk?',
      answer: 'He stopped to say hello to it.',
      distractors: ['He counted it out loud.', 'He picked it up to show Teacher Aishah.', 'He put it on the grass.'],
      evidence: 'One boy, Jun Kai, stopped at every snail to look at it and say hello.',
    },
    {
      kind: 'mcq',
      stem: 'What did the other children do on the second walk?',
      answer: 'They counted red cars.',
      distractors: ['They held hands in a long line.', 'They looked for birds in the trees.', 'They sang a song as they walked.'],
      evidence: 'The others counted red cars.',
    },
    {
      kind: 'mcq',
      stem: 'How many snails did Jun Kai count on the way back?',
      answer: 'nineteen',
      distractors: ['twenty-three', 'four', 'thirty'],
      evidence: 'On the way back, Jun Kai counted nineteen snails.',
    },
    {
      kind: 'tfng',
      item: 'Jun Kai is the youngest child in the group.',
      answer: 'NOT GIVEN',
    },
    {
      kind: 'tfng',
      item: 'On the first walk, the children had thirty minutes to play in the park.',
      answer: 'FALSE',
      evidence: 'We got to the park late, and the children had only ten minutes to play.',
    },
    {
      kind: 'gapChoice',
      stem: 'At the traffic lights, the group missed the green ______ three times.',
      answer: 'man',
      distractors: ['light', 'car', 'sign'],
      evidence: 'At the traffic lights, we missed the green man three times.',
    },
    {
      kind: 'short',
      marks: 1,
      stem: 'From Paragraph 1, where does the writer walk the children to?',
      answer: 'The park across the road.',
      evidence: 'My job is to walk five children to the park across the road.',
      rubric: '一分：答「马路对面的公园 / the park」即给分。',
    },
    {
      kind: 'short',
      marks: 1,
      stem: 'From Paragraph 4, what did Teacher Aishah look at?',
      answer: 'Her watch.',
      evidence: 'Teacher Aishah did not say anything, but she looked at her watch.',
      rubric: '一分：答「她的手表 / her watch」即给分。',
    },
    {
      kind: 'short',
      marks: 2,
      stem: 'From Paragraph 6, give TWO things Jun Kai had to do as the Snail Counter.',
      answer: 'He had to count every snail, and he had to keep walking.',
      evidence: 'He had to count every snail, but he had to keep walking.',
      rubric:
        '两分：「数每一只蜗牛」「一直往前走、不能停下」各 1 分。本题问的是第 6 段的规则；答第 7、8 段的结果（第一次绿灯就过马路、在公园玩了三十分钟）不给分。',
    },
    {
      kind: 'short',
      marks: 2,
      stem: "Using your own words, explain how the writer's plan helped on the second walk (Paragraph 7).",
      answer: 'Jun Kai counted the snails without stopping, so the group crossed the road the first time the green man came on.',
      evidence: 'Jun Kai walked and counted at the same time, and we crossed the road at the first green man.',
      rubric:
        '两分：写出「Jun Kai 边走边数、没有再停下」给 1 分（与第 9 题的「不能停下」意思相同也照给 —— 第 9 题问规则，这里问结果，两题分开计分）；写出「第一次绿灯就过了马路」再给 1 分。第二点写第 8 段的「在公园玩了三十分钟（上次只有十分钟）」或「没有迟到 / 按时到了公园」也给这 1 分。两个得分点不能都是「边走边数」。用自己的简单英文说对意思即可。',
    },
  ],
};

// ═══════════════════════════════════════════════════════════════
// 周四 —— The Microphone
//
// 轮到作者在早会广播念新闻。紧张得手抖，一字不错念完，回班才知道麦克风
// 没开 —— 黑色按钮忘了按。只好重念一遍，这次反而不紧张。
// ═══════════════════════════════════════════════════════════════

const MIC = {
  key: 'original-w5-microphone',
  title: 'The Microphone',
  passage: numbered([
    'Every week, one student reads the morning news to our whole school from a microphone in the office. Last Monday it was my turn.',
    'I was very nervous. On Sunday night I practised ten times in front of my little brother. He was asleep after the fourth time.',
    'On Monday, Mrs Goh in the office showed me the microphone. "Press the black button, and wait for the red light," she said. Then her phone rang, and she walked away.',
    'At seven thirty I started to read. My hands were shaking, and my voice was very small. But I read everything without one mistake.',
    'There were three pieces of news. The library would close early on Friday, the football team had won, and someone had lost a green water bottle.',
    'I walked back to class with a big smile. When I opened the door, my form teacher, Mr Pillai, looked up. "Are you going to the office now?" he asked. "The news is late today."',
    'I ran back to the office. The red light was off. I had not pressed the black button.',
    'So I read the news again, and this time the whole school heard it. I was not nervous at all. I had read it once already, and nothing bad had happened. My voice was loud and clear.',
    'Now, when a younger student is nervous about the morning news, I tell them to practise once with the microphone off.',
  ]),
  questions: [
    {
      kind: 'mcq',
      stem: 'Who did the writer practise in front of on Sunday night?',
      answer: "the writer's little brother",
      distractors: ['Mrs Goh in the office', "the writer's mother", "the writer's form teacher"],
      evidence: 'On Sunday night I practised ten times in front of my little brother.',
    },
    {
      kind: 'mcq',
      stem: "How did the writer's voice sound the first time?",
      answer: 'very small',
      distractors: ['loud and clear', 'fast and angry', 'high and funny'],
      evidence: 'My hands were shaking, and my voice was very small.',
    },
    {
      kind: 'mcq',
      stem: 'Why did Mr Pillai ask if the writer was going to the office?',
      answer: 'He thought the news had not started.',
      distractors: ['He wanted the writer to read it again.', 'He needed something from Mrs Goh.', 'He thought the writer was ill.'],
      evidence: '"The news is late today."',
    },
    {
      kind: 'tfng',
      item: 'The news said that the football team had lost.',
      answer: 'FALSE',
      evidence: 'The library would close early on Friday, the football team had won, and someone had lost a green water bottle.',
    },
    {
      kind: 'tfng',
      item: 'The whole school heard the writer the second time.',
      answer: 'TRUE',
      evidence: 'So I read the news again, and this time the whole school heard it.',
    },
    {
      kind: 'gapChoice',
      stem: 'One piece of news was that the library would close early on ______.',
      answer: 'Friday',
      distractors: ['Monday', 'Saturday', 'Sunday'],
      evidence: 'The library would close early on Friday, the football team had won, and someone had lost a green water bottle.',
    },
    {
      kind: 'short',
      marks: 1,
      stem: 'From Paragraph 1, where is the microphone for the morning news?',
      answer: 'In the office.',
      evidence: 'Every week, one student reads the morning news to our whole school from a microphone in the office.',
      rubric: '一分：答「在办公室 / in the office」即给分。',
    },
    {
      kind: 'short',
      marks: 1,
      stem: 'From Paragraph 2, how many times did the writer practise on Sunday night?',
      answer: 'Ten times.',
      evidence: 'On Sunday night I practised ten times in front of my little brother.',
      rubric: '一分：答「十次 / 10 times」即给分。答「四次」不给分 —— 那是弟弟睡着的时候。',
    },
    {
      kind: 'short',
      marks: 2,
      stem: 'From Paragraph 7, what did the writer see in the office, and what had the writer done wrong?',
      answer: 'The red light was off, because the writer had not pressed the black button.',
      evidence: 'The red light was off. I had not pressed the black button.',
      rubric: '两分：写出「红灯没亮」给 1 分；写出「没有按黑色按钮」再给 1 分。',
    },
    {
      kind: 'short',
      marks: 2,
      stem: 'Using your own words, explain why the writer was not nervous the second time (Paragraph 8).',
      answer: 'The writer had already read the news once, and nothing bad had happened.',
      evidence: 'I had read it once already, and nothing bad had happened.',
      rubric:
        '两分：写出「已经念过一遍了」给 1 分；写出「上一次也没出什么坏事」再给 1 分。用自己的简单英文说对意思即可。',
    },
  ],
};

// ═══════════════════════════════════════════════════════════════
// 周五 —— Counting the Thunder
//
// 七岁的弟弟怕打雷。作者教他数闪电到雷声之间的秒数：约三秒一公里。全程在
// 家里、在床上，不是「突然下暴雨被困」的桥段（已读 The Sudden Storm）。
// 结尾不圆满：只隔一秒的那声雷，弟弟还是缩回了被子。
// 科学点：光比声音快得多；声速约 343 米/秒，三秒约一公里。
// ═══════════════════════════════════════════════════════════════

const THUNDER = {
  key: 'original-w5-counting-thunder',
  title: 'Counting the Thunder',
  passage: numbered([
    'My little brother Hakim is seven, and he is afraid of thunder. When a storm comes, he hides under his blanket and puts his hands over his ears.',
    'Last month, I learned a trick in science. Light travels much faster than sound, so we see lightning before we hear thunder.',
    'If you count the seconds between the flash and the thunder, you know how far away the storm is. Every three seconds is about one kilometre.',
    'One evening there was a big storm. Hakim was under his blanket as usual. I sat on his bed and said, "Let\'s play a game. When the room goes white, start counting."',
    'At first he did not want to. Then the room went white. "One, two, three, four, five, six," we counted, and the thunder came. "Two kilometres away," I said.',
    'We counted again and again. First it was six seconds, then nine, then twelve. Hakim put his head out from the blanket. "It is going away," he said.',
    'By the end of the storm, he was sitting up in bed and counting on his own. He even wrote the numbers in his notebook.',
    'Now Hakim almost likes storms.',
    'Last night there was only one second between the flash and the thunder. Hakim looked at me. "That one is close," he said, and he went back under his blanket.',
  ]),
  questions: [
    {
      kind: 'mcq',
      stem: 'What does Hakim usually do in a storm?',
      answer: 'He hides under his blanket.',
      distractors: ['He runs to his parents.', 'He turns on the TV loudly.', 'He looks out of the window.'],
      evidence: 'When a storm comes, he hides under his blanket and puts his hands over his ears.',
    },
    {
      kind: 'mcq',
      stem: 'Why do we see lightning before we hear thunder?',
      answer: 'Light travels faster than sound.',
      distractors: ['Our eyes work faster than our ears.', 'The storm is always very far away.', 'Rain makes the sound of thunder slow.'],
      evidence: 'Light travels much faster than sound, so we see lightning before we hear thunder.',
    },
    {
      kind: 'mcq',
      stem: 'What did Hakim understand when the numbers got bigger?',
      answer: 'The storm was going away.',
      distractors: ['The storm was coming closer.', 'The storm was getting stronger.', 'The game was too easy for him.'],
      evidence: '"It is going away," he said.',
    },
    {
      kind: 'tfng',
      item: 'Hakim wanted to play the counting game straight away.',
      answer: 'FALSE',
      evidence: 'At first he did not want to.',
    },
    {
      kind: 'tfng',
      item: "Hakim's parents were at home during the big storm.",
      answer: 'NOT GIVEN',
    },
    {
      kind: 'gapChoice',
      stem: 'Hakim had to start counting when the room went ______.',
      answer: 'white',
      distractors: ['dark', 'quiet', 'cold'],
      evidence: 'When the room goes white, start counting.',
    },
    {
      kind: 'short',
      marks: 1,
      stem: 'From Paragraph 1, how old is Hakim?',
      answer: 'Seven.',
      evidence: 'My little brother Hakim is seven, and he is afraid of thunder.',
      rubric: '一分：答「七岁 / 7」即给分。',
    },
    {
      kind: 'short',
      marks: 1,
      stem: 'From Paragraph 3, how many seconds of counting tell you that the storm is about one kilometre away?',
      answer: 'About three seconds.',
      evidence: 'Every three seconds is about one kilometre.',
      rubric: '一分：答「（大约）三秒 / 3 seconds」即给分。',
    },
    {
      kind: 'short',
      marks: 2,
      stem: 'From Paragraph 7, give TWO things Hakim did by the end of the storm.',
      answer: 'He sat up in bed and counted on his own, and he wrote the numbers in his notebook.',
      evidence: 'He even wrote the numbers in his notebook.',
      rubric: '两分：以下三点任答两点，每点 1 分：在床上坐了起来；自己数秒；把数字写在本子上。',
    },
    {
      kind: 'short',
      marks: 2,
      stem: 'Using your own words, explain what Hakim did last night and why (Paragraph 9).',
      answer: 'He went back under his blanket, because there was only one second between the flash and the thunder, so the storm was close.',
      evidence: '"That one is close," he said, and he went back under his blanket.',
      rubric:
        '两分：写出「他又钻回被子里」给 1 分；写出「因为这次雷离得很近（闪电和雷声只隔一秒）」再给 1 分。用自己的简单英文说对意思即可。',
    },
  ],
};

const SPECS = [TYRE, TUG, SNAIL, MIC, THUNDER];

module.exports = {
  LEVEL,
  SPECS,
  DAYS: DATES.slice(0, SPECS.length).map((date, i) => buildAuthoredDay(SPECS[i], date)),
};
