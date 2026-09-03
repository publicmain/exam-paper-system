/**
 * 例句中文的**人工复核结果（第二批）** —— 除雅思轻量档以外的四个档位。
 * key 是英文原句，逐字。第一批在 `context-translation-overrides.js`。
 *
 * 这一批复核了 264 句机翻，改动约六十句。生成脚本自带的可疑度检查只标出
 * 一条，说明**机器查不出机器的错**：语义错、指代错、专有名词错都读起来
 * 很通顺。下面是实际抓到的：
 *
 *   · 专有名词被当成普通词 —— 植物学家 Robert `Fortune` 译成「财富」；
 *   · 术语错义 —— 火山的 `plume`（烟柱）译成「岩流」、`reservoir`
 *     （岩浆房）译成「水库」、`void deck`（组屋底层架空层）译成
 *     「空洞甲板」、`stall`（摊位）译成「隔间」；
 *   · 逻辑译反 —— “disagree about much …, but not about the underlying
 *     arithmetic” 译成「对基本的算术并不一致」，正好说反；
 *     “I understood without being told why he had not” 同样反了；
 *   · 指代跑偏 —— “She opened it”（钱包）译成「她打开信」；
 *     “the sound of it”（守灵的动静）译成「跳棋的声音」；
 *   · 数字与货币 —— 六点十分译成「十点十分」；新加坡故事里的
 *     dollars 一律被译成「美元」；
 *   · 惯用语直译 —— “I could not trust my voice” 译成「我无法相信自己的
 *     声音」；“that is not nothing” 译成「这绝非无能」。
 *
 * 学生在学习卡第二屏看到的就是这一句，翻错等于教错。
 */

'use strict';

module.exports = {
  // ══ O-Level 基础 ══════════════════════════════════════════
  'I found that I missed small things.':
    '我发现自己会想念一些小事。',
  'Ryan opened his pencil case and gave me one before I asked.':
    '我还没开口，Ryan 就打开笔袋递了一支给我。',
  'The teacher did not move anyone.':
    '老师没有给任何人调座位。',
  'We talked about football and nothing else.':
    '我们只聊足球，别的什么都不聊。',
  'Only one, and always from the same stall.':
    '只买一个，而且总是在同一个摊位买。',
  'He promised himself that when he had money he would buy one every year.':
    '他对自己许诺：等有了钱，每年都要买一个。',
  'He has known my father since they were boys in the same village school.':
    '他和我父亲从小在同一所乡下学校念书，那时候就认识了。',
  'This year the durian cost sixty dollars.':
    '今年这个榴莲花了六十块。',
  'The man at the stall is called Uncle Teo.':
    '看摊的人大家叫他 Teo 叔。',
  'My sister would not touch it.':
    '我姐姐碰都不肯碰。',
  'He takes one small piece and then watches the rest of us.':
    '他只拿一小块，然后看着我们其余人吃。',
  'She told me that the library closes at six, and that students who start packing up at six are still in the building at ten past.':
    '她告诉我，图书馆六点关门，而六点才开始收拾东西的学生，六点十分还在馆里。',
  'But I have stopped feeling annoyed, and last week I heard a Secondary One boy complain about the clock, and I did not tell him anything.':
    '但我已经不再觉得烦了。上周我听见一个中一男生抱怨那个钟，我什么也没告诉他。',
  'Twice I nearly said something, and twice I did not.':
    '有两次我差点开口，两次都没说出来。',
  'On the ninth day it rained, and he waved me under his awning until it stopped.':
    '第九天下雨，他招手让我到他的遮阳篷下躲着，直到雨停。',
  'On the fourth day I noticed that he always put the wobbly one at his own table.':
    '第四天我发现，他总是把那张晃的凳子放在自己那桌。',
  'The car park was smooth and grey and four minutes shorter.':
    '停车场铺得平整、灰扑扑的，还是那条近四分钟的路。',
  'The long way goes round the back of the market.':
    '那条远路要绕到市场后面去。',
  'It smelled of fish in the morning, and I had to leave home earlier.':
    '早上一股鱼腥味，我还得提早出门。',

  // ══ O-Level 进阶 ══════════════════════════════════════════
  "Inside were three things: eighty dollars in cash, a few NTUC vouchers, and an identity card with the photograph of a thin old uncle.":
    '里面有三样东西：八十块现金、几张 NTUC 代金券，还有一张身份证，照片上是个瘦瘦的老伯。',
  'He wanted you to know that the eighty dollars was meant for his medicine this week.':
    '他想让你知道，那八十块是他这一周买药的钱。',
  'She opened it, counted the cash, and wrote everything down in a small notebook.':
    '她打开钱包，点了点现金，把每一样都记进一个小本子。',
  'The owner was nowhere to be seen.':
    '失主不见踪影。',
  'The name on the card was Lim Chin Hock.':
    '证件上的名字是 Lim Chin Hock。',
  'After school, Wei went to the hawker centre at Block 165 with the five-dollar note his mother had given him that morning.':
    '放学后，Wei 揣着母亲早上给他的那张五块钱，去了 165 座的小贩中心。',
  'He bought a plate of chicken rice for three dollars and a cup of iced water for fifty cents.':
    '他花三块钱买了一盘鸡饭，又花五毛买了一杯冰水。',
  'With eighty dollars he could buy the limited-edition football boots he had wanted for six months.':
    '有了八十块，他就能买下那双惦记了半年的限量版足球鞋。',
  'Wei thought about his own grandfather, who had once lost his wallet at Tampines MRT and not slept for two whole days.':
    'Wei 想起自己的爷爷——有一次在淡滨尼地铁站丢了钱包，整整两天没睡着。',
  'He stood up, took the wallet in both hands, and walked to the hawker centre management office.':
    '他站起来，双手捧着钱包，走向小贩中心的管理处。',
  'I told my mother I could see the board perfectly well.':
    '我告诉妈妈，我看白板看得清清楚楚。',
  'It was a thousand separate leaves, every one of them edged and sharp, moving on their own in the wind.':
    '那是一千片各自分开的叶子，每一片边缘都清晰锐利，在风里各动各的。',
  'I pictured myself walking into the classroom with two circles of glass on my face and everybody turning to look.':
    '我想象自己脸上架着两片圆玻璃走进教室，所有人都转过头来看。',
  'At recess I stood at the corridor window and looked out at the big rain tree in the field.':
    '课间我站在走廊的窗边，望着操场上那棵大雨树。',
  'For most of Primary Five I had been squinting at the whiteboard, screwing up my eyes until the words swam into something I could almost read, and copying the rest from the girl beside me.':
    '小学五年级大半时间，我都眯着眼看白板，把眼睛挤成一条缝，直到字迹晃成我勉强认得出的样子，剩下的就抄旁边那个女生的。',
  'Then my teacher began writing on the board, and I read every word of it from where I sat, without leaning forward once.':
    '接着老师开始在黑板上写字，我坐在原位就把每一个字都读了下来，一次都没往前凑。',
  'I stared down at my desk and pretended to hunt for something in my bag, wishing the floor would open.':
    '我盯着桌面，假装在书包里翻东西，恨不得地板裂开把我吞下去。',
  'Every year at the Mid-Autumn Festival the corridors of our block were hung with lanterns, and every year I carried a cheap plastic one that played a tinny song.':
    '每年中秋，我们这栋楼的走廊都挂满灯笼，而我每年提的都是一个会放尖细小曲的廉价塑料灯笼。',
  "My father had bought me a red paper carp from the market in Chinatown, with black paper fins and a real candle inside, and I had kept it on top of my cupboard all week, waiting for the night of the lantern walk.":
    '父亲在牛车水的市场给我买了一条红纸鲤鱼，配着黑纸做的鳍，肚子里点一支真蜡烛。整整一周我都把它搁在柜顶，等着提灯游行那一晚。',
  "I'll take it back at the playground.":
    '到了游乐场我再拿回来。',
  'We paraded along the path between the blocks, a slow line of small lights, and I walked near the front with both hands around the handle, holding it as steadily as I could.':
    '我们沿着楼与楼之间的小路列队走，组成一条缓缓移动的小灯队伍；我走在靠前的位置，双手扶着提手，尽量端稳。',
  'My father lit my candle for me and then went back up to our flat to watch from the corridor, and the carp glowed from the inside like something alive.':
    '父亲替我点上蜡烛，然后回楼上从走廊往下看；那条鲤鱼从里面透出光来，像活的一样。',
  "She simply held out her white rabbit lantern by the stick and said, 'You hold it first.":
    '她只是提着灯杆，把自己那盏白兔灯递过来，说：「你先拿着。',
  'My eyes filled and I could not trust my voice.':
    '我眼睛一下就湿了，怕一开口声音就会发抖。',
  'Ahead of me the line of lanterns moved on without stopping, and I stood at the edge of the path with a handle and nothing else.':
    '前头那队灯笼没停下来，继续往前走；我站在路边，手里只剩一个提手，别的什么都没有。',
  'I spluttered and grabbed wildly for the rail, coughing and blinking, my heart pounding against my ribs.':
    '我呛得直咳，胡乱去抓池边的扶手，一边咳一边眨眼，心撞得肋骨发疼。',
  "'I will not let you sink.":
    '「我不会让你沉下去。',
  'By the end of the lesson I could float on my own and had even managed a few clumsy strokes across the shallow end.':
    '一课下来，我已经能自己浮着，甚至在浅水区笨拙地划了几下。',
  'With his hand holding me up, I lay back again and stared at the wide morning sky, breathing slowly, waiting for the fear to pass.':
    '他的手托着我，我又躺了回去，望着开阔的晨空，慢慢呼吸，等着那阵怕劲过去。',
  'Every Saturday morning my father took me to the public swimming pool near our flat.':
    '每个星期六早上，父亲都带我去我们家附近的公共游泳池。',
  'I answered to it in the corridor, on the class list outside the staff room, and once on a certificate for the inter-class quiz, where it was printed in gold.':
    '走廊上有人这么叫我，我应；教员室外的班级名单上是这个名字；还有一次印在班际测验的奖状上，烫着金字。',
  'I sat there with my pen in my hand and understood that the enormous act I had been avoiding since September was, for everyone else in that room, four seconds long.':
    '我握着笔坐在那儿，忽然明白：从九月起我一直躲着不做的那件天大的事，在这屋里其他人看来只有四秒钟。',
  'Putting up my hand to say “Actually, miss” felt enormous, as though I would be making a scene about four syllables.':
    '举手说一句「老师，其实……」在我心里是件天大的事，好像我要为四个音节大闹一场。',
  'What ended it was completely ordinary.':
    '让这件事收场的，是一件再平常不过的小事。',
  'Our relief form teacher, Miss Chandra, read it off the register on the first morning as “Nur-ha-LEE-za”, with the stress in the wrong place, and thirty-one other people learnt it from her.':
    '第一天早上，代课班主任 Chandra 老师照着点名簿念成「Nur-ha-LEE-za」，重音落错了地方，另外三十一个人就跟着她这么念。',
  'My name is Nurhaliza, and for the whole of Secondary Two nobody at school said it properly.':
    '我叫 Nurhaliza。整个中二这一年，学校里没有一个人把它念对过。',
  'She was new, and flustered, and she had forty-five minutes in which to finish the register, read out a fire drill notice and collect two forms.':
    '她是新来的，手忙脚乱，四十五分钟里要点完名、念完消防演习通知，还要收两份表格。',
  'I said I had not wanted to make a fuss.':
    '我说我不想小题大做。',

  // ══ O-Level 标准 ══════════════════════════════════════════
  'Mr Ng wrote out the working, line by line, in his small neat handwriting.':
    '吴老师用他那手工整的小字，一行一行写出演算过程。',
  "'Eh, your Mr Ng very punctual one,' she had said, and then the doorbell rang, and her words turned out to be a small lie that she did not know she was telling.":
    '「哎，你那个吴老师很准时的哦，」她这么说过；接着门铃就响了，而她这句话其实是个她自己也不知道的小小谎言。',
  'On the third line, where he had subtracted vector OA from vector OB, he had written a plus sign instead of a minus.':
    '第三行，本该是向量 OB 减去向量 OA 的地方，他写成了加号，而不是减号。',
  'He simply drew a careful line through the plus sign, wrote a minus above it, and continued without comment.':
    '他只是仔细地在加号上划了一道，在上面写了个减号，然后一句话没说，接着往下讲。',
  'The pale band of skin where it had sat for thirty-something years stood out like a small white scar.':
    '戒指戴了三十多年，留下的那圈发白的皮肤格外显眼，像一道细小的白色疤痕。',
  'He wrote a clean heading at the top of a fresh sheet of foolscap and explained the dot product the way he always did — patiently, building from the simplest case, never rushing me.':
    '他在一张新的横线纸顶上写下工整的标题，像往常一样讲点积——很有耐心，从最简单的情形一步步搭上来，从不催我。',
  'He always wore the same grey shirt, ironed flat, and carried the same worn leather briefcase.':
    '他永远是那件熨得平平整整的灰衬衫，提着那个磨旧了的皮公文包。',
  'He looked at me with a small surprised expression, then picked up his pen and began again from line one.':
    '他略带意外地看了我一眼，然后拿起笔，从第一行重新写起。',
  'Two weeks earlier, my mother had told me, in a low voice in the kitchen, that Mrs Ng had passed away after a long illness.':
    '两周前，母亲在厨房里压低声音告诉我，吴太太久病之后过世了。',
  'Mr Ng accepted it with both hands and bowed slightly.':
    '吴老师双手接过，微微欠身。',
  'When Uncle Chandran died, they set up the wake in the void deck directly below our flat.':
    'Chandran 叔去世后，守灵就设在我们家正下方那层组屋架空层里。',
  'For three nights the white tent stood where the old men usually played checkers, and the sound of it came up through our floor like weather.':
    '一连三个晚上，白色的帐篷就搭在老人们平时下跳棋的地方；守灵的动静像天气一样，从地板底下透上来。',
  'He nodded as though this were a real answer and told me that in 1988 Uncle Chandran had lent him four hundred dollars and refused, for thirty-six years, to let him repay it.':
    '他点点头，像是这真算个答案，然后告诉我：1988 年 Chandran 叔借给他四百块，三十六年来一直不肯让他还。',
  'I had spoken to Uncle Chandran perhaps twice in my life — once when I kicked a ball into his corridor, and once when he asked me, in the lift, whether I was the one who played the guitar badly at night.':
    '我这辈子和 Chandran 叔大概只说过两次话——一次是我把球踢进了他家走廊，另一次是在电梯里，他问我晚上把吉他弹得那么难听的是不是我。',
  'I stood at the edge and listened to a man describe how Uncle Chandran had taught his son to ride a bicycle in the very space where the tent now stood, and I thought about the lift, and the guitar, and the fact that he had not minded.':
    '我站在边上，听一个人讲 Chandran 叔当年就在如今搭着帐篷的这块地方教他儿子骑自行车；我想起电梯、吉他，还有他说他不介意。',
  'She had flown in from Perth that morning; you could see the flight still on her.':
    '她当天早上才从珀斯飞回来，那趟飞行还明明白白写在她脸上。',
  'Each time somebody arrived she said the same three sentences, and each time she said them as though it were the first.':
    '每来一个人，她都说同样那三句话；而每一次，她都说得像是第一次说。',
  'He had, on one occasion, driven a woman to Johor at four in the morning and never explained why.':
    '有一回，他凌晨四点开车送一位女士去柔佛，从没解释过为什么。',
  'Under the list, in her slanting hand, were four instructions.':
    '清单下面，是她那手斜斜的字写下的四条做法。',
  'Everything else was divided in the careful, exhausting way that families divide things, but nobody wanted a piece of yellowed paper with my grandmother’s curry recipe on it, so it came to me without argument.':
    '别的东西都按家里分家当那种小心翼翼、让人筋疲力尽的方式分掉了；可那张写着外婆咖喱做法的泛黄纸片没人要，于是它没经过任何争执就归了我。',
  'The first attempt was thin and sour.':
    '第一次做出来又稀又酸。',
  'By the third I had stopped measuring and started smelling, which was, I began to suspect, the actual instruction all along.':
    '到第三次，我不再量分量，改成闻味道——我开始怀疑，这从一开始就是那条真正的做法。',
  'Halfway through, my mother told me a thing I had not known: that my grandmother had learnt this dish from her own mother-in-law, who had disliked her, and who had deliberately left out one ingredient when teaching her.':
    '吃到一半，母亲告诉我一件我从不知道的事：外婆这道菜是跟她婆婆学的，而那位婆婆并不喜欢她，教的时候故意漏掉了一味料。',
  'Watching is not the same as learning, as I discovered at eleven o’clock that morning, standing in front of nine open jars with no idea how much of anything went in.':
    '看会了不等于学会了——那天上午十一点，我站在九个打开的罐子前，完全不知道每样该放多少，才明白这件事。',
  'It arrived in a brown envelope with the address written in capitals, as though he did not trust his own handwriting to survive the journey.':
    '信装在一个棕色信封里，地址是用大写字母写的，好像他不放心自己的字迹能撑过这一路。',
  'He wrote that on the third night he had been so tired that he had cried, quietly, in a room with eleven other men, and that nobody had noticed, and that he had been grateful for that and ashamed of it at the same time.':
    '他写道，第三天晚上他累得哭了，在一间还睡着另外十一个人的房间里，很轻很轻，没有人发现；他说他为此庆幸，同时也为此羞愧。',
  'I understood that it had been given to me, not offered for discussion.':
    '我明白这是他交给我的，不是拿出来讨论的。',
  "He wrote that a boy in his section named Faizal had, without being asked, packed Yong Han's field pack for him one morning when Yong Han's hands were shaking too badly to do it.":
    '他写道，同班有个叫 Faizal 的男生，在某天早上永汉手抖得实在打不了包时，没等人开口就替他把野战背囊打好了。',
  'Then I put it in my drawer and did not tell our mother, because he had not written to her, and I understood without being told why he had not.':
    '然后我把信收进抽屉，没有告诉母亲——因为他没写给她；不用谁说，我也明白他为什么没写。',
  'I thought, for one flat moment, that the letter had been a mistake, or a fever, or someone else.':
    '有那么干巴巴的一瞬间，我以为那封信是个误会，是发烧说的胡话，或者根本是别人写的。',
  'At dinner he answered our mother in the same three-syllable way he always had.':
    '吃饭时，他还是用一贯那种三个字就打发掉的方式回答母亲。',
  'I learnt that in one survey four in five secondary students had received paid tuition, and that families in the bottom fifth of household income spent a larger share of what they had on it than families in the top fifth.':
    '我查到，有一项调查显示五分之四的中学生上过收费补习；而收入最低那五分之一的家庭，把收入中更大的比例花在了补习上，比最高那五分之一还高。',
  'The opposing team knew the details better than we did and the shape of things rather worse, and about eight minutes in I could feel the room begin to tilt towards us.':
    '对方队伍比我们更熟细节，却更不会把整场辩论的架子搭起来；大约第八分钟，我能感觉到全场开始倒向我们这边。',
  'What she left out is that you cannot spend three days assembling the strongest possible case against something and then walk away exactly where you were.':
    '她没说的是：你不可能花三天把反对一件事的理由搭到最强，然后还站在原来的位置上。',
  'I am better at Chemistry because of it, and I know that is not nothing.':
    '我的化学因此确实更好了，我也知道这不是小事。',
  'When I sat down after my reply speech there was that particular quality of silence which means you have done well.':
    '我作完总结发言坐下时，场上是那种特别的安静——那种安静的意思就是「你讲得好」。',
  'A debater argues the side she is given; the skill lies in the argument, not in the belief.':
    '辩手为分到的那一方辩护；本事在于论证本身，不在于你信不信。',
  'I was given the motion three days before the final: “This House would ban private tuition.':
    '决赛前三天我拿到辩题：「本院主张禁止私人补习。',
  'But I no longer describe it, as I used to, as something my family simply does.':
    '但我不再像从前那样，把它说成我们家本来就会做的一件事。',
  'She said it in the tone of someone stating a rule of arithmetic.':
    '她说这话的语气，像是在陈述一条算术规则。',

  // ══ 雅思 · 真题型 ═════════════════════════════════════════
  'Historians disagree about much of this period, but not about the underlying arithmetic: a commodity that a country cannot produce and will not stop buying must be paid for somehow.':
    '史学界对这段时期的许多事各执一词，但对底下那笔账没有分歧：一样自己产不出、又停不下来买的商品，总得用某种方式付账。',
  'Consumption per head rose roughly two hundredfold within a century.':
    '一个世纪之内，人均消费量增长了大约两百倍。',
  'What made Indian tea viable was something Fortune also brought: eighty experienced Chinese growers and manufacturers, who understood the processing that turns a leaf into tea.':
    '真正让印度茶站住脚的，是福琼一并带去的另一样东西：八十名经验丰富的中国茶农与制茶师傅，他们懂得把叶子变成茶的那套工艺。',
  'Leaves for black tea are bruised and left exposed to air, during which enzymes convert the compounds that give green tea its character into darker, less astringent ones.':
    '做红茶的叶子要先揉捻碰伤，再摊开接触空气；这期间酶会把赋予绿茶风味的化合物转化成颜色更深、涩味更轻的成分。',
  'Tea is drunk more widely than any manufactured beverage on earth, and for most of its history it came from a single country.':
    '茶是地球上饮用最广的加工饮料，而在它历史的大部分时间里，只产自一个国家。',
  'Tea arrived as a curiosity in the middle of the seventeenth century and by the end of the eighteenth was consumed by labourers as well as by the wealthy.':
    '茶在十七世纪中叶作为一种新奇物传入，到十八世纪末，从富人到做工的人都在喝。',
  'It emerged besides that a variety already growing wild in Assam, long dismissed by British botanists as inferior, was better suited to the Indian climate than the Chinese plant.':
    '后来还发现，阿萨姆本来就有一个野生品种，长期被英国植物学家看作次等货，其实比中国茶树更适应印度的气候。',
  'He shipped some twenty thousand plants to India in sealed glass cases that allowed light in while retaining moisture — a recent invention without which the seedlings would not have survived the voyage.':
    '他把约两万株茶苗装进密封的玻璃箱运往印度；这种箱子透光又保湿，是当时的新发明——没有它，这些幼苗撑不过那趟航程。',
  'The consequences of that monopoly, and of the effort to break it, reshaped agriculture on three continents.':
    '这种垄断，以及打破它的那番努力，重塑了三大洲的农业。',
  'Workers were recruited from distant districts, transported at the employer’s expense, and bound by contracts that made leaving before the term expired a criminal rather than a civil matter.':
    '工人从远地招来，路费由雇主出，再被合同捆住：期满前离开算刑事案，而不是民事纠纷。',
  'A rising output of sulphur dioxide is a particularly useful indicator of magma moving underground, and it is measured by pointing an ultraviolet spectrometer at the plume and calculating how much of the sunlight passing through it has been absorbed.':
    '二氧化硫排放量上升，是岩浆在地下移动的一个特别有用的指标；测量办法是把紫外光谱仪对准火山烟柱，算出穿过烟柱的阳光被吸收了多少。',
  'Magma accumulating in a reservoir takes up room, and the ground above it swells — sometimes by a few millimetres, occasionally by a great deal more.':
    '岩浆在岩浆房里聚积会占地方，上方的地面因此隆起——有时只鼓起几毫米，偶尔会大得多。',
  'This turns out to be a harder requirement than it sounds, because it means the interesting measurements are not the ones taken during a crisis but the ones taken during years in which nothing at all appears to be happening.':
    '这个要求比听上去难得多，因为它意味着：真正有价值的测量不是危机当中做的，而是在那些看上去什么都没发生的年头里做的。',
  'Magma at depth holds dissolved gases, and as it rises and the pressure falls those gases come out of solution and escape through the ground and the summit vents.':
    '深处的岩浆里溶着气体；随着岩浆上升、压力下降，这些气体从溶液中析出，经由地面和山顶火山口逸散出去。',
  'Seismologists watch not only for the number of events but for their character: a swarm of ordinary brittle-failure earthquakes means one thing, while a continuous low-frequency tremor, produced by fluid moving through cracks, means something rather different and usually more urgent.':
    '地震学家看的不只是地震次数，还有它们的性质：一群普通的脆性破裂型地震说明一回事；而由流体在裂隙中流动引起的持续低频震颤，说明的是另一回事，而且通常更紧急。',
  'It has to be measured during quiescence, over long unglamorous stretches when the instruments record nothing remarkable, so that when a change does occur there is something to compare it against.':
    '它必须在平静期测出来，在仪器什么异常都记不到的漫长而枯燥的时段里测；这样等真出现变化时，才有东西可以对照。',
};
