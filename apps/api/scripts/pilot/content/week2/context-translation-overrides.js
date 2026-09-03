/**
 * 例句中文句意的**人工复核结果**。key 是英文原句，逐字。
 *
 * `build-week2-context-translations.js` 先用 Azure Translator 出一版草稿，
 * 再把这里的句子覆盖上去 —— 覆盖永远赢，所以重跑生成器不会把审过的译文
 * 冲掉。这一步不是可选的：机翻在这批句子上的实测错误率约三分之一，而且
 * 错得最狠的恰恰是**当天要教的那个词**。
 *
 * 实际抓到的几类错：
 *
 *   · 术语按错误词义翻 —— `barrage` 译成「拦截」（应为拦河坝，而它正是
 *     当天主词）、`borrowing held up` 译成「借款站得住脚」（说的是借书量）；
 *   · 同一个词两处译法不一致 —— `geosmin` 一处「土工松」、一处「美地素」；
 *   · 数量级译反 —— `five parts per trillion` 译成「五万亿分之一」
 *     （应为万亿分之五）；
 *   · 句子结构塌掉 —— 「被时钟不一致的时钟批准」「由太阳所落」。
 *
 * 学生在学习卡第二屏看到的就是这一句，翻错等于教错。
 */

'use strict';

module.exports = {
  // ── Power from the Tide ────────────────────────────────────
  'Tides do neither.':
    '潮汐这两样都不会。',
  'Tidal electricity remains more expensive than wind or solar, and only a handful of commercial sites exist.':
    '潮汐发电至今仍比风电和光伏贵，商业化的场址只有寥寥数处。',
  'The simplest way to use a tide is a barrage — a dam built across the mouth of an estuary.':
    '利用潮汐最简单的办法是拦河坝——一道横跨河口修建的堤坝。',
  'Water is trapped behind it at high tide and released through turbines as the tide falls.':
    '涨潮时把水拦在坝后，落潮时再放水冲过涡轮机。',
  'For an electricity grid, which must match supply to demand minute by minute, that predictability is worth a great deal.':
    '对一个必须分分钟让供给匹配需求的电网来说，这种可预测性非常值钱。',
  'The largest example, in France, has been generating since 1966 and still works well.':
    '最大的一座在法国，从 1966 年起一直发电，至今运转良好。',
  'Mudflats that are normally uncovered twice a day stay submerged, and the birds that feed on them lose their food supply.':
    '本来每天两次露出水面的泥滩会一直被淹着，靠它们觅食的鸟也就断了食物来源。',
  'Engineers have therefore turned to underwater turbines, which sit on the seabed in a fast current and turn as the water flows past.':
    '于是工程师转向了水下涡轮机：它们坐落在急流中的海床上，随着水流经过而转动。',
  'They look like wind turbines and work on the same principle, but water is roughly eight hundred times denser than air, so a much smaller blade produces the same power.':
    '它们看上去像风力发电机，原理也一样；但水的密度大约是空气的八百倍，所以小得多的叶片就能发出同样的功率。',
  'Nothing is dammed and the estuary is left intact.':
    '没有筑坝，河口原样保留。',
  'Salt water destroys machinery, and repairing a turbine ten metres below the surface is far harder than climbing a tower on land.':
    '海水会腐蚀机械，而修理水面以下十米处的涡轮机，远比爬上陆地上的塔架困难。',
  'Its supporters argue that the price will fall as it did for wind, and that a grid full of unpredictable sources will eventually pay well for one it can rely on.':
    '支持者认为，它的价格会像当年的风电那样降下来；而一个充满不可预测电源的电网，最终会愿意为一个靠得住的电源付高价。',

  // ── What Libraries Became ──────────────────────────────────
  'When the internet arrived, a good many people predicted that public libraries would close.':
    '互联网刚出现时，相当多人预言公共图书馆会关门。',
  'The prediction was wrong, but not because borrowing held up.':
    '这个预测错了，但并不是因为借书量保住了。',
  'Some lend tools, musical instruments or seeds.':
    '有些图书馆还外借工具、乐器或种子。',
  'Surveys in several cities found the same pattern.':
    '好几个城市的调查都发现了同一个规律。',
  'The service users named most often was free internet access, used mainly by those without a connection at home — job seekers filling in applications, older residents managing pensions, new arrivals dealing with paperwork in an unfamiliar language.':
    '用户最常提到的服务是免费上网，主要是家里没有网络的人在用——填申请表的求职者、办养老金的老人、用不熟悉的语言处理各种文件的新移民。',
  'Libraries have adapted accordingly.':
    '图书馆也相应做出了调整。',
  'A few employ social workers, having found that the people who most need help are already walking through the door.':
    '少数图书馆聘了社工，因为他们发现最需要帮助的人本来就已经走进了门。',
  'Critics argue that a library is for books, and that asking it to absorb work the state has stopped doing elsewhere leaves it doing many things adequately and none of them well.':
    '批评者认为，图书馆是为书而设的；让它去接手国家在别处不再做的事，结果是样样都做得过得去，却没有一样做得好。',
  'Librarians tend to answer that they did not choose the role; it arrived, in the form of people who had nowhere else to go, and turning them away was never a serious option.':
    '图书馆员往往回答说，这个角色不是他们选的；它是以那些无处可去的人的形式找上门来的，而把他们赶走从来就不是一个真正的选项。',
  'Not everyone welcomes the change.':
    '并不是所有人都欢迎这种变化。',

  // ── The Most Valuable Rock ─────────────────────────────────
  'For most of human history it was among the most valuable substances traded, and the reason is straightforward: before refrigeration, it was the main way of keeping food from rotting.':
    '在人类历史的大部分时间里，它都属于最贵重的交易品之一，原因很直接：在制冷出现之前，它是让食物不腐坏的主要办法。',
  'Fleets sailed to distant waters because the catch could be preserved before it came home.':
    '船队之所以远航到遥远的海域，是因为渔获在运回来之前就能保存住。',
  'Salt draws water out of the cells of meat and fish, and out of the bacteria that would otherwise multiply in them.':
    '盐会把水分从肉和鱼的细胞里抽出来，也从那些本来会在里面繁殖的细菌里抽出来。',
  'Whole economies were built on this single fact.':
    '一个又一个经济体都建立在这一个事实之上。',
  'In India, a British monopoly on salt production led Gandhi to walk to the sea in 1930 and make some himself, an act of deliberate lawbreaking that drew worldwide attention.':
    '在印度，英国对制盐的垄断促使甘地在 1930 年走到海边亲手制盐；这是一次蓄意的违法行为，引来了全世界的关注。',
  'In France the salt tax was among the grievances that preceded the revolution of 1789.':
    '在法国，盐税是 1789 年革命之前诸多民怨中的一条。',
  'Caravans crossed the Sahara carrying slabs of salt southwards and returning with gold, and several cities grew wealthy simply because a salt road passed through them.':
    '商队穿越撒哈拉，把一块块盐运往南方，再带着黄金回来；有好几座城市仅仅因为一条盐路经过而富裕起来。',
  'Mechanical refrigeration spread through the late nineteenth century, and food could be kept without any chemical at all.':
    '机械制冷在十九世纪后期普及开来，食物不用任何化学物质也能保存了。',
  'Salt lost its strategic value within a few decades and became what it is today: the cheapest thing on the shelf, and the only rock most people eat.':
    '盐在几十年间失去了战略价值，变成了今天的样子：货架上最便宜的东西，也是大多数人唯一会吃的石头。',
  'Because everyone needed salt and few places produced it, it was easy to tax.':
    '因为人人都需要盐，产盐的地方却很少，所以它很容易征税。',

  // ── Keeping Time by Rail ───────────────────────────────────
  'Before railways, every town kept its own time, set by the sun.':
    '在铁路出现之前，每个城镇都用自己的时间，由太阳来定。',
  'A timetable that said a train left at ten o’clock was useless if ten o’clock meant something different at each station on the line.':
    '如果「十点」在这条线上每个车站的含义都不一样，那么写着列车十点开的时刻表就毫无用处。',
  'Worse, two trains sharing a single track could be given clearance by clocks that disagreed, and in the 1840s several collisions were traced to exactly that.':
    '更糟的是，共用一条轨道的两列火车，可能是由两只走得不一致的钟放行的；1840 年代有好几起相撞事故正是这么来的。',
  'British railway companies responded by adopting a single time, taken from Greenwich and carried down the line by telegraph.':
    '英国的铁路公司于是统一采用一个时间，取自格林尼治，再通过电报沿线路传下去。',
  'Some towns resisted for years: a clock in Bristol was fitted with two minute hands, one for railway time and one for local time.':
    '有些城镇抵制了好多年：布里斯托尔的一座钟装了两根分针，一根走铁路时间，一根走本地时间。',
  'The United States spanned more than fifty degrees of longitude, and by 1880 its railways were running on about eighty different local times.':
    '美国横跨五十多个经度，到 1880 年，全国铁路大约在按八十种不同的地方时间运行。',
  'In 1883 the companies simply agreed among themselves to divide the country into four zones, and the public followed.':
    '1883 年，这些公司干脆自己商量好，把全国划成四个时区，公众也就跟着用了。',
  'Congress did not make the arrangement official for another thirty-five years.':
    '又过了三十五年，国会才把这个安排正式确认下来。',
  'Almost nobody now setting an alarm clock thinks of it as a railway invention.':
    '如今几乎没有人在定闹钟的时候，会想到这是铁路带来的发明。',
  'A machine creates a problem that nobody had before, an industry invents a fix for its own convenience, and the fix ends up organising everyone’s daily life.':
    '一台机器制造出一个以前没人遇到过的问题，一个行业为自己方便发明了对策，而这个对策最后安排了所有人的日常生活。',
  'The pattern is familiar in the history of technology.':
    '这种模式在技术史上并不陌生。',

  // ── The Smell of Rain ──────────────────────────────────────
  'The claim is not fanciful.':
    '这个说法并不离谱。',
  'The smell is real, it has been chemically identified, and it does travel ahead of the weather that produces it.':
    '这种气味是真实的，已经被化学方法辨认出来，而且它确实比产生它的那场天气更早到达。',
  'Two substances are mainly responsible.':
    '主要是两种物质在起作用。',
  'The first is geosmin, produced by bacteria that live in soil.':
    '第一种是土臭素，由生活在土壤里的细菌产生。',
  'Human beings are extraordinarily sensitive to it: a concentration of five parts per trillion is enough to notice, which makes the nose better at detecting geosmin than at detecting almost anything else.':
    '人对它极其敏感：浓度只要万亿分之五就能闻出来，这让鼻子对土臭素的灵敏度高过几乎其他任何东西。',
  'The second is petrichor, an oily mixture that plants release onto dry ground during long spells without rain.':
    '第二种是潮土油，一种油性混合物，植物在长期无雨时把它释放到干燥的地面上。',
  'When the first drops land, they trap tiny bubbles of air beneath them.':
    '第一批雨滴落下时，会在自己下面困住微小的气泡。',
  'The bubbles burst upwards, throwing the oils and any bacteria into the air as a fine spray, and the wind carries the spray forward.':
    '气泡向上破裂，把油质和其中的细菌抛成一层细雾送进空气，再由风把这层细雾带向前方。',
  'Nobody is sensing the weather; they are smelling rain that has already fallen somewhere upwind.':
    '没有人是在感知天气；他们闻到的是上风处已经下过的雨。',
  'Some researchers argue that an animal able to smell where rain has fallen has an advantage in dry country, and that the response is inherited rather than learned.':
    '有研究者认为，能闻出哪里下过雨的动物在干旱地区更有优势，而且这种反应是遗传来的，不是学来的。',
  'Most people can describe the smell that arrives just before rain, and many claim they can tell a storm is coming by it.':
    '大多数人都能描述雨来之前那股气味，很多人还说自己能凭它判断暴风雨要来了。',
};
