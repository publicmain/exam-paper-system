/**
 * S12J —— 验收账号的**阅读内容**（夹具专用，不参与任何运行时路径）。
 *
 * ## 为什么单独一个文件
 *
 * S12F 建账号时，十二份历史卷子的「原文」是一句占位符：
 * `【S12F 合成阅读 · <标题>】学生在这一天读到的就是这段文字。`
 * 当时够用 —— 那一轮验的是账号建得出来。可 S12I 之后不行了：
 *
 *   · 「查看原文」点开是一句话，学生看不出这个功能对不对；
 *   · 没有一道题存过证据句，于是错题重练**永远**走「定位没有存下来」
 *     那一支，刚做好的精确高亮一次都验不到。
 *
 * 所以这里放**真的文章**：每篇四段左右的原创说明文，题目答得出来，
 * 证据句是原文里**逐字**存在的一句话。
 *
 * ## 三条硬规矩
 *
 *   1. **全部原创**。不抄任何真实报刊或考卷 —— 版权铁律在
 *      `CLAUDE.md` 里写着，夹具也不例外。
 *   2. **证据句必须是本篇原文的逐字子串**。客户端的高亮用的是
 *      `indexOf`，对不上就退回「完整原文 + 如实说明」。宁可留空，
 *      也不许写一句「差不多是这个意思」的话。
 *   3. **故意留一条空证据句**（最后一篇的第 6 题）—— 那条正好会进错题本，
 *      用来验客户端的诚实兜底那一支。
 *
 * ## 题型形状是冻结的
 *
 * 六道题的题型、分值、选项形状与 S12F 一致（`[1,1,1,2,2,1]`，
 * 第 1/2/6 题是 mcq，第 3/4/5 题是 short_answer）—— 分数分布与逐题记账
 * 都建立在这个形状上，内容换了但账不能乱。
 */

'use strict';

const TFNG = [
  { key: 'A', text: 'TRUE' },
  { key: 'B', text: 'FALSE' },
  { key: 'C', text: 'NOT GIVEN' },
];

/** 每篇的第 2 题（特征配对）与第 6 题（选择题）各有自己的选项。 */
const P = (...paras) => paras.join('\n\n');

const HISTORICAL_PAPERS = [
  // ── 1 ────────────────────────────────────────────────────────
  {
    title: 'The Rooftop Garden Project',
    passage: P(
      'The flat roof above the science block had been locked for eleven years when a geography teacher asked whether her class might borrow it for a single term. She wanted somewhere to measure wind speed. What she got, four terms later, was a working garden of forty raised beds, three water tanks and a weather station that reports to a screen in the entrance hall.',
      'The first beds went up in a week, built from timber salvaged from a stage the drama club had stopped using. They were deliberately shallow, because the engineers who inspected the roof set a strict limit on weight. Soil went up in buckets, one class at a time. The first crop was radishes, chosen because they grow fast enough to hold a twelve-year-old’s attention, and they appeared before the end of term.',
      'The second crop failed completely. The roof turned out to be several degrees warmer than the ground and far windier, and the seedlings dried out within days. That failure is now the part of the story the teachers tell most often, because it turned a gardening club into something closer to a laboratory. The science club began recording the roof temperature every hour for a whole term, and found the gap was widest on clear afternoons in the middle of the year.',
      'The garden now waters early in the morning, when less is lost to evaporation, and a row of hedges along the north wall breaks the worst of the wind. In a good season the roof supplies the school kitchen for about two weeks. Its more useful output is written rather than edible: every class keeps a record of what it plants and what survives, and those notebooks are read by classes who have not yet set foot on the roof.',
    ),
    questions: [
      {
        stem: 'Do the following statements agree with the information in the passage? Write TRUE, FALSE or NOT GIVEN.\nThe roof was unused for more than a decade before the garden began.',
        answer: 'A',
        evidence: 'The flat roof above the science block had been locked for eleven years',
      },
      {
        stem: 'Match the statement with the correct group.\nThey measured the temperature on the roof every hour for a whole term.',
        answer: 'B',
        evidence: 'The science club began recording the roof temperature every hour for a whole term',
      },
      {
        stem: 'Complete the sentence with ONE WORD ONLY from the passage.\nThe first raised beds were built from timber taken from an old ______.',
        answer: 'stage',
        evidence: 'built from timber salvaged from a stage the drama club had stopped using',
        /** 写错：一个真实学生会犯的错，不是乱码。 */
        wrong: 'bucket',
      },
      {
        stem: 'Complete the summary with words from the passage.\nThe second crop died because the roof was both warmer and ______ than the ground.',
        answer: 'windier',
        evidence: 'several degrees warmer than the ground and far windier',
        /** 半对：写对了一半（这两道是 2 分题）。 */
        partial: 'windy',
        /** 写错：一个真实学生会犯的错，不是乱码。 */
        wrong: 'wetter',
      },
      {
        stem: 'Answer in NO MORE THAN FIVE WORDS.\nWhat does the writer say is the garden’s more useful output?',
        answer: 'the written records classes keep',
        evidence: 'Its more useful output is written rather than edible',
        /** 半对：写对了一半（这两道是 2 分题）。 */
        partial: 'the records',
        /** 写错：一个真实学生会犯的错，不是乱码。 */
        wrong: 'the radishes it grows',
      },
      {
        stem: 'Choose the correct letter.\nWhy does the writer say the failed second crop mattered?',
        answer: 'C',
        evidence: 'it turned a gardening club into something closer to a laboratory',
      },
    ],
    features: ['the rooftop team', 'the science club', 'the city council', 'the drama club'],
    choices: [
      'It saved the school a large amount of money.',
      'It proved the roof was unsafe for planting.',
      'It changed the project into something more scientific.',
      'It persuaded the council to fund the tanks.',
    ],
  },
  // ── 2 ────────────────────────────────────────────────────────
  {
    title: 'How Cities Cool Themselves',
    passage: P(
      'A city is almost always warmer than the countryside around it, and on a still summer night the difference can reach seven degrees. The cause is not mysterious. Brick, asphalt and concrete absorb heat all day and release it slowly after dark, while the countryside sheds its heat quickly through soil and leaves. Planners call the effect an urban heat island, and for most of the twentieth century they treated it as an unavoidable cost of building densely.',
      'That view has changed, mainly because the cost turned out to be measurable in hospital admissions. During a heatwave the number of people treated for heat-related illness rises fastest in districts with the least greenery, and those districts are usually the poorest. Cooling a city is therefore no longer discussed as a comfort question. It is discussed as a public health question, and it is funded from different budgets as a result.',
      'The cheapest intervention is paint. A pale roof reflects far more sunlight than a dark one, and cities from Athens to Ahmedabad have run programmes that whitewash roofs in dense neighbourhoods before summer. The effect on the building beneath is immediate and large; the effect on the street outside is smaller, because a single reflective roof cools mainly the rooms under it.',
      'Trees work more slowly and cost far more, but they cool the street rather than the building. A mature street tree shades the pavement and releases water vapour through its leaves, and a continuous canopy can hold an avenue several degrees below an identical treeless one nearby. The difficulty is time. A newly planted tree delivers almost nothing for a decade, which makes tree planting a policy that rewards the councillor who follows rather than the one who plants.',
    ),
    questions: [
      {
        stem: 'Do the following statements agree with the information in the passage? Write TRUE, FALSE or NOT GIVEN.\nThe urban heat island effect is strongest during the middle of the day.',
        answer: 'B',
        evidence: 'on a still summer night the difference can reach seven degrees',
      },
      {
        stem: 'Match the statement with the correct group.\nThey are most affected when a heatwave arrives.',
        answer: 'D',
        evidence: 'rises fastest in districts with the least greenery, and those districts are usually the poorest',
      },
      {
        stem: 'Complete the sentence with ONE WORD ONLY from the passage.\nThe cheapest way to cool a building is to use pale ______.',
        answer: 'paint',
        evidence: 'The cheapest intervention is paint.',
        /** 写错：一个真实学生会犯的错，不是乱码。 */
        wrong: 'concrete',
      },
      {
        stem: 'Complete the summary with words from the passage.\nCooling a city is now treated as a ______ question rather than a comfort one.',
        answer: 'public health',
        evidence: 'It is discussed as a public health question',
        /** 半对：写对了一半（这两道是 2 分题）。 */
        partial: 'health',
        /** 写错：一个真实学生会犯的错，不是乱码。 */
        wrong: 'comfort',
      },
      {
        stem: 'Answer in NO MORE THAN FIVE WORDS.\nWhat is the main drawback of planting street trees?',
        answer: 'they take a decade',
        evidence: 'A newly planted tree delivers almost nothing for a decade',
        /** 半对：写对了一半（这两道是 2 分题）。 */
        partial: 'they are slow',
        /** 写错：一个真实学生会犯的错，不是乱码。 */
        wrong: 'they need too much water',
      },
      {
        stem: 'Choose the correct letter.\nWhat difference does the writer draw between pale roofs and street trees?',
        answer: 'B',
        evidence: 'they cool the street rather than the building',
      },
    ],
    features: ['city planners', 'hospital staff', 'roof painters', 'residents of poorer districts'],
    choices: [
      'Roofs are cheaper but illegal in some cities.',
      'Roofs cool the building; trees cool the street.',
      'Trees are cheaper over a twenty-year period.',
      'Only trees have been tested in hot countries.',
    ],
  },
  // ── 3 ────────────────────────────────────────────────────────
  {
    title: 'Reading the Night Sky',
    passage: P(
      'Long before anyone drew a map of the ocean, sailors crossed it by watching the sky. The method sounds impossible until you notice how little it actually requires. A navigator needs to know the date, the time, and the angle between a known star and the horizon. From those three numbers a position can be calculated, and the calculation has not changed in two centuries.',
      'The instrument that made this practical was the sextant, which measures the angle between two objects by bringing their images together in a single eyepiece. Because it compares two things rather than measuring against the instrument itself, a sextant works on a moving deck, where a fixed telescope would be useless. That single design decision is why the tool survived from wooden ships into the age of steel.',
      'The harder problem was time. A navigator can find latitude from the height of the noon sun with nothing but a sextant and a table, but longitude requires knowing what time it is somewhere else at the same moment. For most of the eighteenth century no clock could keep that time at sea, and ships were routinely lost because their crews knew how far north they were and only guessed how far east.',
      'Satellite navigation has made all of this optional, and most merchant officers now go a whole career without taking a sight. Training academies nonetheless still teach it, and the reason they give is not nostalgia. A sextant needs no power, no signal and no permission, and a navigator who can use one can check the electronics against the sky.',
    ),
    questions: [
      {
        stem: 'Do the following statements agree with the information in the passage? Write TRUE, FALSE or NOT GIVEN.\nCelestial navigation requires the navigator to know the current date.',
        answer: 'A',
        evidence: 'A navigator needs to know the date, the time, and the angle between a known star and the horizon.',
      },
      {
        stem: 'Match the statement with the correct group.\nThey still learn to take sights even though they may never need to.',
        answer: 'C',
        evidence: 'Training academies nonetheless still teach it',
      },
      {
        stem: 'Complete the sentence with ONE WORD ONLY from the passage.\nFinding ______ at sea required knowing the time in another place.',
        answer: 'longitude',
        evidence: 'longitude requires knowing what time it is somewhere else at the same moment',
        /** 写错：一个真实学生会犯的错，不是乱码。 */
        wrong: 'latitude',
      },
      {
        stem: 'Complete the summary with words from the passage.\nA sextant works on a rolling ship because it compares ______ rather than measuring against itself.',
        answer: 'two objects',
        evidence: 'Because it compares two things rather than measuring against the instrument itself, a sextant works on a moving deck',
        /** 半对：写对了一半（这两道是 2 分题）。 */
        partial: 'two things',
        /** 写错：一个真实学生会犯的错，不是乱码。 */
        wrong: 'the horizon line',
      },
      {
        stem: 'Answer in NO MORE THAN FIVE WORDS.\nGive TWO reasons the academies give for still teaching the sextant.',
        answer: 'no power needed; checks electronics',
        evidence: 'A sextant needs no power, no signal and no permission',
        /** 半对：写对了一半（这两道是 2 分题）。 */
        partial: 'it needs no power',
        /** 写错：一个真实学生会犯的错，不是乱码。 */
        wrong: 'it is cheaper than a computer',
      },
      {
        stem: 'Choose the correct letter.\nWhy were ships lost in the eighteenth century?',
        answer: 'A',
        evidence: 'ships were routinely lost because their crews knew how far north they were and only guessed how far east',
      },
    ],
    features: ['eighteenth-century sailors', 'sextant makers', 'merchant officers today', 'clockmakers'],
    choices: [
      'They could measure latitude but not longitude.',
      'Their sextants were too heavy to use at sea.',
      'They refused to carry navigational tables.',
      'Their charts showed the wrong coastline.',
    ],
  },
  // ── 4 ────────────────────────────────────────────────────────
  {
    title: 'The Return of the Wetland',
    passage: P(
      'The marsh east of the town was drained in 1954 and farmed for barley for the next fifty years. It was never very good barley. The soil was peat, and peat that has been drained does not simply become field: it oxidises, shrinks and blows away, so that by the end the surface had dropped almost a metre below the road that once ran level with it.',
      'Rewetting the land was proposed first as flood defence rather than as conservation. A wet marsh holds water during a storm and releases it slowly, and the town downstream had flooded twice in a decade. The argument that finally moved the council was not about birds at all; it was a comparison between the cost of the scheme and the cost of a concrete wall along two kilometres of river.',
      'The engineering was modest. Ditches were blocked, a pumping station was switched off, and the water table was allowed to rise through a single winter. What surprised everyone was the speed of the response. Reed returned within two seasons, and with the reed came the birds that had last bred there in the 1950s, arriving without being introduced and apparently without being invited.',
      'The scheme is now cited in planning documents across the region, usually with a caution attached. Peat that has already oxidised cannot be replaced, and the marsh that came back is not the marsh that was lost. It is shallower, smaller and younger, and it will take a very long time to store the carbon that fifty years of barley released.',
    ),
    questions: [
      {
        stem: 'Do the following statements agree with the information in the passage? Write TRUE, FALSE or NOT GIVEN.\nThe drained land produced high yields of barley.',
        answer: 'B',
        evidence: 'It was never very good barley.',
      },
      {
        stem: 'Match the statement with the correct group.\nThey were persuaded by a comparison of costs.',
        answer: 'A',
        evidence: 'a comparison between the cost of the scheme and the cost of a concrete wall',
      },
      {
        stem: 'Complete the sentence with ONE WORD ONLY from the passage.\nThe surface of the drained marsh sank by nearly one ______.',
        answer: 'metre',
        evidence: 'the surface had dropped almost a metre below the road',
        /** 写错：一个真实学生会犯的错，不是乱码。 */
        wrong: 'kilometre',
      },
      {
        stem: 'Complete the summary with words from the passage.\nThe scheme was first proposed as ______ rather than as conservation.',
        answer: 'flood defence',
        evidence: 'Rewetting the land was proposed first as flood defence rather than as conservation.',
        /** 半对：写对了一半（这两道是 2 分题）。 */
        partial: 'flooding',
        /** 写错：一个真实学生会犯的错，不是乱码。 */
        wrong: 'bird conservation',
      },
      {
        stem: 'Answer in NO MORE THAN FIVE WORDS.\nWhat caution is attached when the scheme is cited elsewhere?',
        answer: 'oxidised peat cannot be replaced',
        evidence: 'Peat that has already oxidised cannot be replaced',
        /** 半对：写对了一半（这两道是 2 分题）。 */
        partial: 'the peat is gone',
        /** 写错：一个真实学生会犯的错，不是乱码。 */
        wrong: 'the birds may not return',
      },
      {
        stem: 'Choose the correct letter.\nWhat surprised those involved in the project?',
        answer: 'D',
        evidence: 'What surprised everyone was the speed of the response.',
      },
    ],
    features: ['the council', 'the farmers', 'the town downstream', 'the returning birds'],
    choices: [
      'The cost of blocking the ditches.',
      'The refusal of the farmers to sell.',
      'The failure of the reed to establish.',
      'How quickly the marsh recovered.',
    ],
  },
  // ── 5 ────────────────────────────────────────────────────────
  {
    title: 'Paper, Ink and Memory',
    passage: P(
      'A sheet of good paper can last five hundred years, and a great deal of what we know about the medieval world survives because somebody once chose the right sheet. The choice was not usually deliberate. Paper made from linen rags happens to be close to chemically neutral, and neutral paper ages slowly; paper made from wood pulp is acidic, and acid attacks the fibres that hold the sheet together.',
      'The change from rag to pulp happened in the middle of the nineteenth century, and it happened because reading spread faster than rags could be collected. Wood was abundant and cheap, and the newspapers of the period were printed on it in enormous quantities. Those newspapers are now the most fragile objects in many national collections, more fragile than manuscripts four times their age.',
      'Librarians describe the problem as slow fire. A brittle page does not announce itself; it simply loses a corner, then a margin, then a column, and by the time anyone notices, the text that mattered has usually gone with it. Deacidification can arrest the process, but it is expensive per volume and it cannot restore what has already crumbled.',
      'The modern response is to accept that some objects will be lost and to decide in advance which ones. Collections are surveyed, items are ranked, and the fragile and irreplaceable are copied before they fail. It is an uncomfortable kind of planning, because ranking is a way of saying out loud that most of the shelf will not be saved.',
    ),
    questions: [
      {
        stem: 'Do the following statements agree with the information in the passage? Write TRUE, FALSE or NOT GIVEN.\nNineteenth-century newspapers survive better than older manuscripts.',
        answer: 'B',
        evidence: 'more fragile than manuscripts four times their age',
      },
      {
        stem: 'Match the statement with the correct group.\nThey decide in advance which items will be copied.',
        answer: 'B',
        evidence: 'Collections are surveyed, items are ranked, and the fragile and irreplaceable are copied before they fail.',
      },
      {
        stem: 'Complete the sentence with ONE WORD ONLY from the passage.\nPaper made from wood pulp is ______, which attacks its own fibres.',
        answer: 'acidic',
        evidence: 'paper made from wood pulp is acidic',
        /** 写错：一个真实学生会犯的错，不是乱码。 */
        wrong: 'brittle',
      },
      {
        stem: 'Complete the summary with words from the passage.\nLibrarians call the gradual destruction of brittle paper ______.',
        answer: 'slow fire',
        evidence: 'Librarians describe the problem as slow fire.',
        /** 半对：写对了一半（这两道是 2 分题）。 */
        partial: 'fire',
        /** 写错：一个真实学生会犯的错，不是乱码。 */
        wrong: 'slow rot',
      },
      {
        stem: 'Answer in NO MORE THAN FIVE WORDS.\nWhy did papermakers move from rags to wood pulp?',
        answer: 'reading spread faster than rags',
        evidence: 'it happened because reading spread faster than rags could be collected',
        /** 半对：写对了一半（这两道是 2 分题）。 */
        partial: 'rags ran short',
        /** 写错：一个真实学生会犯的错，不是乱码。 */
        wrong: 'wood pulp lasted longer',
      },
      {
        stem: 'Choose the correct letter.\nWhy does the writer call the planning uncomfortable?',
        answer: 'C',
        evidence: 'ranking is a way of saying out loud that most of the shelf will not be saved',
      },
    ],
    features: ['medieval scribes', 'modern librarians', 'newspaper printers', 'rag collectors'],
    choices: [
      'It requires expensive new buildings.',
      'It depends on untested chemistry.',
      'It admits that most items will not be saved.',
      'It slows down access for readers.',
    ],
  },
  // ── 6 ────────────────────────────────────────────────────────
  {
    title: 'Why Bridges Sing in the Wind',
    passage: P(
      'Every structure has a frequency at which it prefers to move. Strike a wine glass and it rings at that frequency; push a child on a swing at exactly the right moment and the swing goes higher for no extra effort. Bridges are no different, and the whole discipline of wind engineering exists because a bridge that meets the wrong wind can be pushed at exactly the right moment, over and over, for hours.',
      'The famous failure at Tacoma Narrows in 1940 is usually explained badly. The bridge did not simply resonate with a gusting wind. Its deck was a solid plate girder, and as the wind passed it the deck began to twist; the twisting changed the angle the wind met, which drove the twisting harder. The energy came from the steady wind itself rather than from any rhythm in it, and that self-feeding motion is called flutter.',
      'The cure was found in the shape of the deck rather than in its strength. A deck shaped like an aircraft wing, or one with gaps that let air pass through, does not build up the same twisting force. Modern long-span bridges are tested as models in wind tunnels for months before any steel is ordered, and the tunnel usually decides the cross-section.',
      'Pedestrian bridges have their own version of the problem, and it is people rather than wind. A crowd on a slightly swaying deck adjusts its footsteps to keep balance, and by adjusting together it pushes in time with the sway. One London bridge closed two days after opening for exactly this reason and reopened with dampers fitted underneath.',
    ),
    questions: [
      {
        stem: 'Do the following statements agree with the information in the passage? Write TRUE, FALSE or NOT GIVEN.\nThe Tacoma Narrows deck failed because gusts matched its natural rhythm.',
        answer: 'B',
        evidence: 'The energy came from the steady wind itself rather than from any rhythm in it',
      },
      {
        stem: 'Match the statement with the correct group.\nThey unintentionally push a bridge in time with its own movement.',
        answer: 'D',
        evidence: 'by adjusting together it pushes in time with the sway',
      },
      {
        stem: 'Complete the sentence with ONE WORD ONLY from the passage.\nThe self-feeding twisting motion of a bridge deck is called ______.',
        answer: 'flutter',
        evidence: 'that self-feeding motion is called flutter',
        /** 写错：一个真实学生会犯的错，不是乱码。 */
        wrong: 'resonance',
      },
      {
        stem: 'Complete the summary with words from the passage.\nThe cure was found in the ______ of the deck rather than in its strength.',
        answer: 'shape',
        evidence: 'The cure was found in the shape of the deck rather than in its strength.',
        /** 半对：写对了一半（这两道是 2 分题）。 */
        partial: 'the deck',
        /** 写错：一个真实学生会犯的错，不是乱码。 */
        wrong: 'strength',
      },
      {
        stem: 'Answer in NO MORE THAN FIVE WORDS.\nWhat usually decides the cross-section of a long-span bridge?',
        answer: 'the wind tunnel',
        evidence: 'the tunnel usually decides the cross-section',
        /** 半对：写对了一半（这两道是 2 分题）。 */
        partial: 'a tunnel',
        /** 写错：一个真实学生会犯的错，不是乱码。 */
        wrong: 'the weight of the cables',
      },
      {
        stem: 'Choose the correct letter.\nWhat was done to the London pedestrian bridge?',
        answer: 'A',
        evidence: 'reopened with dampers fitted underneath',
      },
    ],
    features: ['wind engineers', 'the Tacoma designers', 'model testers', 'pedestrians'],
    choices: [
      'Dampers were fitted beneath it.',
      'Its deck was replaced with a solid girder.',
      'It was permanently closed to crowds.',
      'Its towers were raised by two metres.',
    ],
  },
  // ── 7 ────────────────────────────────────────────────────────
  {
    title: 'The Quiet Work of Bees',
    passage: P(
      'A honeybee colony is often described as a single organism, and the description is more than a metaphor when it comes to deciding where to live. A swarm that has left its old nest hangs in a cluster while a few hundred scouts fly out to search. Each scout that finds a possible cavity returns and dances, and the length of the dance reflects how good she judges the site to be.',
      'What makes the process work is that a scout does not simply advertise. She also stops. A bee dancing for a mediocre site gives up sooner than a bee dancing for an excellent one, so support drains away from weak candidates without anyone comparing them directly. The colony reaches agreement not by argument but by unequal persistence.',
      'Navigation to the site relies mainly on the sun, and on a cloudy day on the pattern of polarised light in the sky, which a bee can read even when the sun itself is hidden. Scent matters for the last few metres, and for recognising the entrance of a hive among identical ones, but it is not how a bee finds a field two kilometres away.',
      'Colonies that swarm early in the season usually choose better cavities than colonies that swarm late, and the reason appears to be time rather than skill. Late swarms accept the first tolerable site because a swarm hanging in the open cannot feed itself for long. Under pressure, in other words, the same process that produces careful decisions produces hurried ones.',
    ),
    questions: [
      {
        stem: 'Do the following statements agree with the information in the passage? Write TRUE, FALSE or NOT GIVEN.\nBees navigate mainly by scent.',
        answer: 'B',
        evidence: 'Navigation to the site relies mainly on the sun',
      },
      {
        stem: 'Match the statement with the correct group.\nThey search for possible new homes while the swarm waits.',
        answer: 'C',
        evidence: 'a few hundred scouts fly out to search',
      },
      {
        stem: 'Complete the sentence with ONE WORD ONLY from the passage.\nOn a cloudy day bees read the pattern of ______ light in the sky.',
        answer: 'polarised',
        evidence: 'the pattern of polarised light in the sky',
        /** 写错：一个真实学生会犯的错，不是乱码。 */
        wrong: 'ultraviolet',
      },
      {
        stem: 'Complete the summary with words from the passage.\nThe colony reaches agreement not by argument but by ______.',
        answer: 'unequal persistence',
        evidence: 'The colony reaches agreement not by argument but by unequal persistence.',
        /** 半对：写对了一半（这两道是 2 分题）。 */
        partial: 'persistence',
        /** 写错：一个真实学生会犯的错，不是乱码。 */
        wrong: 'a majority vote',
      },
      {
        stem: 'Answer in NO MORE THAN FIVE WORDS.\nWhy do late swarms choose worse sites?',
        answer: 'they cannot feed themselves long',
        evidence: 'a swarm hanging in the open cannot feed itself for long',
        /** 半对：写对了一半（这两道是 2 分题）。 */
        partial: 'they run out of food',
        /** 写错：一个真实学生会犯的错，不是乱码。 */
        wrong: 'the best sites are taken',
      },
      {
        stem: 'Choose the correct letter.\nWhat does the length of a scout’s dance indicate?',
        answer: 'B',
        evidence: 'the length of the dance reflects how good she judges the site to be',
      },
    ],
    features: ['the queen', 'the waiting swarm', 'the scout bees', 'late-season colonies'],
    choices: [
      'How far away the site lies.',
      'How good she judges the site to be.',
      'How long she has been flying.',
      'How many other scouts agree.',
    ],
  },
  // ── 8 ────────────────────────────────────────────────────────
  {
    title: 'Maps Before Satellites',
    passage: P(
      'The first accurate national map of any country was made by walking. Surveyors laid out a baseline on flat ground, measured it with rods to within a few centimetres, and then built a chain of triangles outward from it across the whole territory. Every subsequent distance was calculated from angles rather than paced out, which is why a triangulation survey is accurate over hundreds of kilometres while a measured road is not.',
      'The method demanded visibility, and visibility demanded height. Survey teams built towers, climbed cathedral spires and cut sight lines through forests, and in flat country they sometimes waited weeks for the air to clear enough to see the next station. A single obstructed line could stall a season’s work, because the network only closes if every triangle can be measured from both ends.',
      'Errors in such a network do not simply add up; they distribute. Because each triangle is checked against its neighbours, a small mistake at one station is caught when the figures refuse to close, and the survey can be adjusted rather than repeated. That property is what made the technique worth its enormous cost, and it is also why the resulting maps were trusted for military planning.',
      'Satellite positioning replaced the towers within a single generation, and the old stations now stand unused on hilltops across Europe. Surveyors still visit some of them, because a station whose position was measured by triangulation and again by satellite gives a direct comparison between the two methods, and the agreement is usually closer than the public expects.',
    ),
    questions: [
      {
        stem: 'Do the following statements agree with the information in the passage? Write TRUE, FALSE or NOT GIVEN.\nA triangulation survey is more accurate over long distances than a measured road.',
        answer: 'A',
        evidence: 'a triangulation survey is accurate over hundreds of kilometres while a measured road is not',
      },
      {
        stem: 'Match the statement with the correct group.\nThey still visit the old stations today.',
        answer: 'A',
        evidence: 'Surveyors still visit some of them',
      },
      {
        stem: 'Complete the sentence with ONE WORD ONLY from the passage.\nThe survey began by laying out a ______ on flat ground.',
        answer: 'baseline',
        evidence: 'Surveyors laid out a baseline on flat ground',
        /** 写错：一个真实学生会犯的错，不是乱码。 */
        wrong: 'triangle',
      },
      {
        stem: 'Complete the summary with words from the passage.\nErrors in the network do not add up; instead they ______.',
        answer: 'distribute',
        evidence: 'Errors in such a network do not simply add up; they distribute.',
        /** 半对：写对了一半（这两道是 2 分题）。 */
        partial: 'spread',
        /** 写错：一个真实学生会犯的错，不是乱码。 */
        wrong: 'cancel',
      },
      {
        stem: 'Answer in NO MORE THAN FIVE WORDS.\nWhy could one blocked sight line stall a season’s work?',
        answer: 'triangles need both ends',
        evidence: 'the network only closes if every triangle can be measured from both ends',
        /** 半对：写对了一半（这两道是 2 分题）。 */
        partial: 'a triangle needs two ends',
        /** 写错：一个真实学生会犯的错，不是乱码。 */
        wrong: 'the weather stopped the work',
      },
      {
        stem: 'Choose the correct letter.\nWhy do surveyors compare old stations with satellite readings?',
        answer: 'D',
        evidence: 'gives a direct comparison between the two methods',
      },
    ],
    features: ['modern surveyors', 'military planners', 'tower builders', 'forest cutters'],
    choices: [
      'To decide which towers to demolish.',
      'To train new students in climbing.',
      'To recover lost historical records.',
      'To compare the two measuring methods.',
    ],
  },
  // ── 9 ────────────────────────────────────────────────────────
  {
    title: 'The School That Grew a Forest',
    passage: P(
      'In 1998 a rural secondary school was given four hectares of exhausted grazing land on the condition that it did something useful with it. The staff decided to plant a forest, mostly because it was the only option that did not require a budget. Every pupil in the first year planted twenty saplings, and the practice continued each September for the next twenty-five years.',
      'The early results were discouraging. Roughly half the first planting died, partly from drought and partly because the soil had been compacted by decades of cattle. The school kept records anyway, and those records eventually became the most valuable thing on the site: they show, year by year, which species survived on which slope, and they are now consulted by farms across the district.',
      'What the staff did not anticipate was how the forest would change the timetable. Once the canopy closed, the site became usable for teaching in a way that a field never was. Biology moved outdoors for part of the year, and a geography class that had studied erosion from a textbook could stand in a gully and measure it.',
      'The school now harvests a small amount of timber, but the head teacher is careful about how she describes the value of the project. Asked at a conference what the forest was worth, she said that the honest answer was a set of notebooks and a generation of pupils who assume that land can be improved rather than merely used.',
    ),
    questions: [
      {
        stem: 'Do the following statements agree with the information in the passage? Write TRUE, FALSE or NOT GIVEN.\nThe school chose to plant a forest because it was inexpensive.',
        answer: 'A',
        evidence: 'mostly because it was the only option that did not require a budget',
      },
      {
        stem: 'Match the statement with the correct group.\nThey now consult the school’s planting records.',
        answer: 'C',
        evidence: 'they are now consulted by farms across the district',
      },
      {
        stem: 'Complete the sentence with ONE WORD ONLY from the passage.\nThe soil had been ______ by decades of cattle.',
        answer: 'compacted',
        evidence: 'the soil had been compacted by decades of cattle',
        /** 写错：一个真实学生会犯的错，不是乱码。 */
        wrong: 'flooded',
      },
      {
        stem: 'Complete the summary with words from the passage.\nOnce the ______ closed, the site could be used for teaching.',
        answer: 'canopy',
        evidence: 'Once the canopy closed, the site became usable for teaching',
        /** 半对：写对了一半（这两道是 2 分题）。 */
        partial: 'the trees',
        /** 写错：一个真实学生会犯的错，不是乱码。 */
        wrong: 'fence',
      },
      {
        stem: 'Answer in NO MORE THAN SIX WORDS.\nHow did the head teacher describe the forest’s worth?',
        answer: 'notebooks and a changed generation',
        evidence: 'a set of notebooks and a generation of pupils',
        /** 半对：写对了一半（这两道是 2 分题）。 */
        partial: 'the notebooks',
        /** 写错：一个真实学生会犯的错，不是乱码。 */
        wrong: 'the timber it will produce',
      },
      {
        stem: 'Choose the correct letter.\nWhat unexpected effect did the forest have?',
        answer: 'B',
        evidence: 'how the forest would change the timetable',
      },
    ],
    features: ['the first-year pupils', 'the head teacher', 'neighbouring farms', 'the cattle owners'],
    choices: [
      'It produced timber sooner than expected.',
      'It changed how lessons were timetabled.',
      'It attracted funding from the district.',
      'It reduced the size of the school roll.',
    ],
  },
  // ── 10 ───────────────────────────────────────────────────────
  {
    title: 'Rain, Rivers and Rice',
    passage: P(
      'Terraced rice farming looks like an ancient solution to a shortage of flat land, and it is, but the more interesting problem it solves is timing. Rain arrives in bursts. A rice plant needs water steadily for months. A terrace is essentially a shallow reservoir with a floor of puddled clay, and a hillside of terraces stores a season of rain and releases it downhill at the speed the crop can use.',
      'Because water passes from one terrace to the next, no farmer on such a hillside can act alone. Opening a channel early takes water from a neighbour below; closing it late floods the field above. Systems of this kind therefore develop rules, and the rules are usually older than any written law in the district and enforced by people who will meet each other again next season.',
      'The engineering is deceptively demanding. The floor of each terrace must be level to within a few centimetres or the crop will drown at one end and dry at the other, and the retaining walls must be maintained every year because a single breach drains the terrace above and undercuts the one below. Abandoned terraces collapse quickly, which is why a hillside that looks timeless is in fact continuously rebuilt.',
      'Where labour has moved to the cities, terraces have been abandoned faster than they can be maintained, and the loss is not only agricultural. A collapsed terrace releases in an hour the water it was designed to release over weeks, and villages below have discovered that the flood control they never paid for had been provided all along by the fields above them.',
    ),
    questions: [
      {
        stem: 'Do the following statements agree with the information in the passage? Write TRUE, FALSE or NOT GIVEN.\nA farmer on a terraced hillside can manage water independently of neighbours.',
        answer: 'B',
        evidence: 'no farmer on such a hillside can act alone',
      },
      {
        stem: 'Match the statement with the correct group.\nThey discovered they had been receiving flood protection for free.',
        answer: 'D',
        evidence: 'villages below have discovered that the flood control they never paid for',
      },
      {
        stem: 'Complete the sentence with ONE WORD ONLY from the passage.\nEach terrace has a floor of puddled ______.',
        answer: 'clay',
        evidence: 'a shallow reservoir with a floor of puddled clay',
        /** 写错：一个真实学生会犯的错，不是乱码。 */
        wrong: 'stone',
      },
      {
        stem: 'Complete the summary with words from the passage.\nThe deeper problem that terraces solve is not flat land but ______.',
        answer: 'timing',
        evidence: 'the more interesting problem it solves is timing',
        /** 半对：写对了一半（这两道是 2 分题）。 */
        partial: 'time',
        /** 写错：一个真实学生会犯的错，不是乱码。 */
        wrong: 'rainfall',
      },
      {
        stem: 'Answer in NO MORE THAN SIX WORDS.\nWhy must terrace floors be level to within a few centimetres?',
        answer: 'or the crop drowns and dries',
        evidence: 'the crop will drown at one end and dry at the other',
        /** 半对：写对了一半（这两道是 2 分题）。 */
        partial: 'so the water is even',
        /** 写错：一个真实学生会犯的错，不是乱码。 */
        wrong: 'so the walls do not fall',
      },
      {
        stem: 'Choose the correct letter.\nWhy does the writer say a timeless-looking hillside is misleading?',
        answer: 'A',
        evidence: 'a hillside that looks timeless is in fact continuously rebuilt',
      },
    ],
    features: ['upstream farmers', 'village elders', 'city employers', 'downstream villages'],
    choices: [
      'It is rebuilt continuously by hand.',
      'It was constructed within living memory.',
      'It has never produced a usable crop.',
      'It is maintained by the national government.',
    ],
  },
  // ── 11 ───────────────────────────────────────────────────────
  {
    title: 'Small Machines, Long Journeys',
    passage: P(
      'The bicycle is the most efficient machine ever built for moving a human being, and the claim is not sentimental. Measured in energy used per kilometre travelled, a person on a bicycle beats a person walking, a horse, a car and every animal that has been tested. The reason is that the machine removes almost all the wasted motion of walking while adding very little weight of its own.',
      'Its history is stranger than its design suggests. The first two-wheelers had no pedals; the rider pushed along the ground, and the machine was treated as a novelty for wealthy young men. Pedals arrived decades later, the chain drive decades after that, and the shape settled into something a modern rider would recognise only in the 1890s, by which time the bicycle had already changed who could travel alone.',
      'That social effect is the part most often understated. A bicycle was affordable to people who could never keep a horse, needed no fuel and no stabling, and could be stored in a hallway. For women in particular it removed a set of practical objections to travelling unaccompanied, and the clothing reform that followed was argued about in newspapers for twenty years.',
      'Cities that treat cycling as transport rather than recreation tend to make the same set of unglamorous decisions: separated lanes on busy roads, secure parking at stations, and junction designs that do not require a cyclist to cross three lanes of turning traffic. None of these is technically difficult. What they require is a willingness to take space from something else.',
    ),
    questions: [
      {
        stem: 'Do the following statements agree with the information in the passage? Write TRUE, FALSE or NOT GIVEN.\nA cyclist uses less energy per kilometre than a walking person.',
        answer: 'A',
        evidence: 'a person on a bicycle beats a person walking',
      },
      {
        stem: 'Match the statement with the correct group.\nThey gained the ability to travel unaccompanied.',
        answer: 'B',
        evidence: 'For women in particular it removed a set of practical objections to travelling unaccompanied',
      },
      {
        stem: 'Complete the sentence with ONE WORD ONLY from the passage.\nThe earliest two-wheelers had no ______ at all.',
        answer: 'pedals',
        evidence: 'The first two-wheelers had no pedals',
        /** 写错：一个真实学生会犯的错，不是乱码。 */
        wrong: 'brakes',
      },
      {
        stem: 'Complete the summary with words from the passage.\nCycling cities need a willingness to take ______ from something else.',
        answer: 'space',
        evidence: 'a willingness to take space from something else',
        /** 半对：写对了一半（这两道是 2 分题）。 */
        partial: 'road space',
        /** 写错：一个真实学生会犯的错，不是乱码。 */
        wrong: 'money',
      },
      {
        stem: 'Answer in NO MORE THAN SIX WORDS.\nName TWO of the unglamorous decisions cycling cities make.',
        answer: 'separated lanes; secure station parking',
        evidence: 'separated lanes on busy roads, secure parking at stations',
        /** 半对：写对了一半（这两道是 2 分题）。 */
        partial: 'separated lanes',
        /** 写错：一个真实学生会犯的错，不是乱码。 */
        wrong: 'free bicycles for students',
      },
      {
        stem: 'Choose the correct letter.\nWhen did the bicycle take a shape a modern rider would recognise?',
        answer: 'C',
        evidence: 'the shape settled into something a modern rider would recognise only in the 1890s',
      },
    ],
    features: ['wealthy young men', 'women in the 1890s', 'modern city planners', 'horse owners'],
    choices: [
      'As soon as pedals were invented.',
      'During the first decade of the century.',
      'In the 1890s.',
      'Only after separated lanes appeared.',
    ],
  },
  // ── 12 ───────────────────────────────────────────────────────
  {
    title: 'When the Library Moved House',
    passage: P(
      'Moving a library of two million volumes across a city is not a large version of moving a bookshelf. The difficulty is not weight but order. A library is useful only because every item can be found from its position, and a move destroys position on the first morning and restores it on the last, with weeks of uselessness in between.',
      'The team that planned the move at one northern university began by refusing to move the books first. They moved the catalogue, then the shelving, then the staff, and only then the collection, in a sequence designed so that at every point somebody could answer the question of where a given volume currently was. Boxes were numbered by shelf run rather than by subject, which felt wrong to the librarians and turned out to be correct.',
      'The hardest category was the material that had never been catalogued at all. Every large library has some, usually donated collections that arrived faster than they could be processed, and a move forces a decision about them that can otherwise be postponed for decades. Roughly nine thousand items were listed for the first time during the move, and about four hundred were found to be duplicates of things already held.',
      'The move finished eleven days late, which the university considered a success, and the report afterwards recommended one change above all others. Next time, it said, plan the reopening rather than the closing. The staff had rehearsed emptying the old building in detail and had given almost no thought to the first week in which readers would arrive expecting everything to work.',
    ),
    questions: [
      {
        stem: 'Do the following statements agree with the information in the passage? Write TRUE, FALSE or NOT GIVEN.\nThe books were the first thing to be moved.',
        answer: 'B',
        evidence: 'They moved the catalogue, then the shelving, then the staff, and only then the collection',
      },
      {
        stem: 'Match the statement with the correct group.\nThey felt the numbering scheme was wrong at first.',
        answer: 'B',
        evidence: 'which felt wrong to the librarians and turned out to be correct',
      },
      {
        stem: 'Complete the sentence with ONE WORD ONLY from the passage.\nThe real difficulty of the move was not weight but ______.',
        answer: 'order',
        evidence: 'The difficulty is not weight but order.',
        /** 写错：一个真实学生会犯的错，不是乱码。 */
        wrong: 'distance',
      },
      {
        stem: 'Complete the summary with words from the passage.\nAbout ______ items were catalogued for the first time during the move.',
        answer: 'nine thousand',
        evidence: 'Roughly nine thousand items were listed for the first time during the move',
        /** 半对：写对了一半（这两道是 2 分题）。 */
        partial: 'thousands',
        /** 写错：一个真实学生会犯的错，不是乱码。 */
        wrong: 'ninety thousand',
      },
      {
        stem: 'Answer in NO MORE THAN SIX WORDS.\nWhat did the report recommend above all else?',
        answer: 'plan the reopening, not the closing',
        evidence: 'plan the reopening rather than the closing',
        /** 半对：写对了一半（这两道是 2 分题）。 */
        partial: 'plan the reopening',
        /** 写错：一个真实学生会犯的错，不是乱码。 */
        wrong: 'hire more staff for the move',
      },
      {
        // **故意留空的证据句** —— 客户端「定位没有存下来」那一支要靠它验。
        // 这一题会进错题本（第 12 份卷子的第 6 题），所以用户在重练时
        // 一定会遇到它。
        stem: 'Choose the correct letter.\nHow did the university regard an eleven-day overrun?',
        answer: 'D',
        evidence: '',
      },
    ],
    features: ['the planning team', 'the librarians', 'the readers', 'the donors'],
    choices: [
      'As a serious failure of planning.',
      'As proof that the catalogue was wrong.',
      'As grounds for replacing the contractor.',
      'As a success.',
    ],
  },
];

module.exports = { HISTORICAL_PAPERS, TFNG };
