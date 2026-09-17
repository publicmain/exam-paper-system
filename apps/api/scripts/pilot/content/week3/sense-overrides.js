/**
 * 第三周的**义项更正表**（2026-09-17 补；build-week2-vocab.js 读到这份表才启用）。
 *
 * 第三周词表按 ECDICT 第一条义项生成，出现了人名当生词（Richardson、Dewar）、
 * 词形还原错（sometimes → sometime「改天」、stared → star「星」）和一批义项挑错
 * （sticker →「屠夫，尖刀」、hawker →「饲鹰者」、logger →「樵夫」……）。
 *
 * 这里**只改释义，不改选了哪些词**：第三周已经发布，学生名下的文章词行
 * （StudentWord p1_w_）按词头建好了，换词会让内容包和这些行对不上。
 * 人名和还原错的词就在释义里说清楚它到底是什么。
 *
 * 说明（2026-09-17 核实）：这些文章词**从没出现在学生的学习卡上** ——
 * 每日学词走新版词库（按档位词表推），文章词行的「教过 / 复习过」全是 0，
 * 旧版学词页也已不在路由里。所以这份表修的是内容包本身的准确性，线上不需要动。
 *
 * 规矩（内容测试会查）：中文释义里不能有分号；英文释义不能换行。
 */

'use strict';

module.exports = {
  // ── 人名与词形还原错误 ──
  richardson: {
    pos: 'n.',
    translation: 'n. 理查森（人名：英国科学家 Lewis Fry Richardson）',
    definition: 'a surname; here Lewis Fry Richardson, who first tried to forecast the weather by calculation',
  },
  dewar: {
    pos: 'n.',
    translation: 'n. 杜瓦瓶（真空保温瓶，以发明者 James Dewar 命名）',
    definition: 'a vacuum flask, named after the Scottish scientist James Dewar',
  },
  sometime: {
    pos: 'adv.',
    translation: 'adv. 某个时候（原文是 sometimes，意思是「有时」）',
    definition: 'at a time that is not stated; the passage uses sometimes, meaning on some occasions',
  },
  star: {
    pos: 'n.',
    translation: 'n. 星星（原文 stared 来自 stare，意思是「盯着看」）',
    definition: 'a bright point in the night sky; the passage uses stared, from stare, to look at something for a long time',
  },
  tire: { pos: 'v.', translation: 'v. 使疲倦（tired：疲倦的）', definition: 'to make someone feel that they need rest' },

  // ── 雅思真题 ──
  reciprocal: { pos: 'adj.', translation: 'adj. 相互的，互惠的', definition: 'given or done in return, so that both sides share it' },
  logger: { pos: 'n.', translation: 'n. 记录仪（data logger）', definition: 'a small device that records information over time' },
  lightweight: { pos: 'adj.', translation: 'adj. 轻便的，重量轻的', definition: 'not heavy' },
  tanker: { pos: 'n.', translation: 'n. 油轮，罐车', definition: 'a ship or lorry that carries oil or other liquids' },
  tariff: { pos: 'n.', translation: 'n. 关税', definition: 'a tax on goods coming into or going out of a country' },
  sling: { pos: 'n.', translation: 'n. （起吊货物的）吊索', definition: 'a loop of rope or chain used to lift heavy things' },
  sack: { pos: 'n.', translation: 'n. 麻袋，大袋子', definition: 'a large bag made of strong material' },
  marshmallow: { pos: 'n.', translation: 'n. 棉花糖', definition: 'a soft, sweet, white or pink food made from sugar' },
  pretzel: { pos: 'n.', translation: 'n. 椒盐卷饼', definition: 'a hard, salty snack, often shaped like a knot or a stick' },
  token: { pos: 'n.', translation: 'n. 代币，小筹码', definition: 'a small object used instead of money or as a reward' },
  reverse: { pos: 'n.', translation: 'n. 相反的情况', definition: 'the opposite of what has just been said' },
  sensible: { pos: 'adj.', translation: 'adj. 明智的，合理的', definition: 'reasonable and showing good judgement' },
  sterile: { pos: 'adj.', translation: 'adj. 无菌的', definition: 'completely clean and free from germs' },
  drip: { pos: 'n.', translation: 'n. 静脉输液（装置）', definition: "equipment that slowly puts liquid into a patient's vein" },
  ensemble: { pos: 'n.', translation: 'n. 集合预报（同时运行的一组预报）', definition: 'a group of things taken together, such as many forecasts run at once' },
  according: { pos: 'prep.', translation: 'prep. 根据（according to）', definition: 'as stated or reported by someone or something' },

  // ── 雅思轻量 ──
  paste: { pos: 'n.', translation: 'n. 糊状物，膏', definition: 'a soft, wet mixture that can be spread or shaped' },
  clay: { pos: 'n.', translation: 'n. 黏土', definition: 'heavy, sticky earth that becomes hard when it is baked' },
  core: { pos: 'n.', translation: 'n. 芯，核心', definition: 'the central part of something, such as the thin rod inside a pencil' },
  energy: { pos: 'n.', translation: 'n. 能源，能量', definition: 'power from electricity, fuel and so on, used to do work' },
  flask: { pos: 'n.', translation: 'n. 保温瓶，烧瓶', definition: 'a container that keeps drinks hot or cold, or a glass bottle used in science' },
  stopper: { pos: 'n.', translation: 'n. 瓶塞', definition: 'a piece of material that closes the top of a bottle' },
  convert: { pos: 'v.', translation: 'v. 转换，换算', definition: 'to change something into a different form or unit' },
  extract: { pos: 'n.', translation: 'n. 提取物', definition: 'a substance taken out of a plant or other material' },
  panel: {
    pos: 'n.',
    translation: 'n. （评审）小组，（组画中的）一幅',
    definition: 'a small group of people chosen to judge something; also one picture in a series',
  },
  estate: { pos: 'n.', translation: 'n. 住宅区（housing estate）', definition: 'an area with many houses or flats built together' },

  // ── O-Level 基础 ──
  tank: { pos: 'n.', translation: 'n. 鱼缸，水箱', definition: 'a large container for holding liquid or keeping fish' },
  start: { pos: 'v.', translation: 'v. 开始', definition: 'to begin doing something' },
  sticker: { pos: 'n.', translation: 'n. 贴纸', definition: 'a small piece of paper with a picture or words that sticks to things' },
  canteen: { pos: 'n.', translation: 'n. （学校、单位的）食堂', definition: 'a place in a school or workplace where meals are served' },
  high: { pos: 'adv.', translation: 'adv. 高高地', definition: 'at or to a height well above the ground' },
  sign: { pos: 'n.', translation: 'n. 牌子，标志', definition: 'a board with words or a picture on it' },
  nobody: { pos: 'pron.', translation: 'pron. 没有人，谁也不', definition: 'no person; not anyone' },
  count: { pos: 'v.', translation: 'v. 数，点数', definition: 'to find the number of things' },
  cost: { pos: 'v.', translation: 'v. 价钱是，花费', definition: 'to have a particular price' },

  // ── O-Level 标准 ──
  trophy: { pos: 'n.', translation: 'n. 奖杯，奖品', definition: 'a cup or other object given as a prize' },
  snap: { pos: 'v.', translation: 'v. 啪地折断', definition: 'to break suddenly with a sharp sound' },
  struggle: { pos: 'v.', translation: 'v. 吃力，难以应付', definition: 'to find it very hard to do something' },
  flash: { pos: 'v.', translation: 'v. 闪烁', definition: 'to shine on and off' },
  rally: { pos: 'n.', translation: 'n. （羽毛球等的）来回对打', definition: 'a long series of hits back and forth in a game such as badminton' },
  shuttle: { pos: 'n.', translation: 'n. 羽毛球（shuttlecock）', definition: 'the small object that players hit back and forth in badminton' },
  beat: { pos: 'v.', translation: 'v. 打败，（心脏）跳动', definition: 'to defeat someone in a game, or (of the heart) to make regular movements' },
  trainer: { pos: 'n.', translation: 'n. 运动鞋（trainers）', definition: 'a shoe worn for running or sport' },

  // ── O-Level 中级 ──
  shallow: { pos: 'adj.', translation: 'adj. 浅的', definition: 'not deep' },
  presentation: { pos: 'n.', translation: 'n. 报告，展示', definition: 'a talk in which someone shows or explains something to a group' },
  chop: { pos: 'v.', translation: 'v. 切，剁', definition: 'to cut something into pieces with a knife' },
  flame: { pos: 'n.', translation: 'n. 火焰', definition: 'the hot, bright burning gas that you see in a fire' },
  hawker: { pos: 'n.', translation: 'n. 小贩（hawker centre：小贩中心）', definition: 'a person who sells food or goods from a stall' },
  stall: { pos: 'n.', translation: 'n. 摊位', definition: 'a small shop or table from which things are sold' },
  counter: { pos: 'n.', translation: 'n. 柜台', definition: 'a long flat surface in a shop or stall where customers are served' },
  queue: { pos: 'n.', translation: 'n. 队，行列', definition: 'a line of people waiting for something' },
  fold: { pos: 'v.', translation: 'v. 折叠', definition: 'to bend paper or cloth so that one part lies on top of another' },
  polytechnic: { pos: 'n.', translation: 'n. 理工学院', definition: 'a college that teaches practical and technical subjects' },
  upside: { pos: 'n.', translation: 'n. 上面（upside down：颠倒）', definition: "the top side of something; 'upside down' means with the top at the bottom" },
  rest: { pos: 'n.', translation: 'n. 其余，剩下的部分', definition: 'the part that is left, or the others' },
  term: { pos: 'n.', translation: 'n. 学期', definition: 'one of the periods into which a school year is divided' },
};
