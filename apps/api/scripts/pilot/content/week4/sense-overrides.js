/**
 * 第四周的**义项更正表**（build-week2-vocab.js 读到这份表才启用；前三周没有，重跑结果不变）。
 *
 * 生成器从 ECDICT 取「第一条义项」，这不是词义消歧：第四周第一次生成时，
 * 主词里出现了「a full glass bottle」的 full →「把衣服缝得宽松，漂洗」、
 * 豆芽的 shoot →「射击」、霉菌的 mould →「模子」、学期的 term →「术语」、
 * 食堂的 canteen →「水壶」、对勾的 tick →「滴答声」。
 *
 * 这里按本周文章里的用法手写一条释义；同一个词在本周两篇里用法不同时
 * （crack：瓶子裂开 / 嗓子破音）取两处都说得通的写法。
 *
 * 这些文章词目前不显示给学生（每日学词走新版词库；线上词典不归发布脚本改，
 * 第四周五天发布时词典全部「保留原样」），这份表修的是内容包本身。
 *
 * 规矩（内容测试会查）：中文释义里不能有分号；英文释义不能换行。
 */

'use strict';

module.exports = {
  // ── O-Level 基础 ──
  shoot: { pos: 'n.', translation: 'n. 嫩芽，新枝', definition: 'a new part of a plant that is just starting to grow' },
  seed: { pos: 'n.', translation: 'n. 种子', definition: 'the small hard part of a plant from which a new plant grows' },
  nobody: { pos: 'pron.', translation: 'pron. 没有人，谁也不', definition: 'no person; not anyone' },
  sink: { pos: 'n.', translation: 'n. （厨房的）水池，洗碗池', definition: 'a large bowl with taps, used for washing dishes or your hands' },
  used: { pos: 'v.', translation: 'v. 使用（use 的过去式）', definition: 'past tense of use: to do something with a thing for a purpose' },
  alarm: { pos: 'n.', translation: 'n. 闹钟，警报', definition: 'a clock or device that makes a noise to wake you or warn you' },
  proud: { pos: 'adj.', translation: 'adj. 自豪的，得意的', definition: 'pleased about something you or someone close to you has done' },

  // ── O-Level 中级 / 标准 ──
  tick: { pos: 'n.', translation: 'n. 对勾（✓）', definition: 'a small mark (✓) showing that something is correct or has been done' },
  term: { pos: 'n.', translation: 'n. 学期', definition: 'one of the periods into which a school year is divided' },
  rest: { pos: 'n.', translation: 'n. 其余，剩下的部分', definition: 'the part that is left, or the others' },
  cycle: { pos: 'v.', translation: 'v. 骑自行车', definition: 'to ride a bicycle' },
  total: { pos: 'n.', translation: 'n. 总数，合计', definition: 'the whole amount when everything is added together' },
  single: { pos: 'adj.', translation: 'adj. 每一个的（every single）', definition: 'used to emphasise that you mean each one' },
  connector: { pos: 'n.', translation: 'n. 连接道（park connector：公园连道）', definition: 'something that joins two places, such as a path between parks' },
  upside: { pos: 'n.', translation: 'n. 上面（upside down：颠倒）', definition: "the top side of something; 'upside down' means with the top at the bottom" },
  working: { pos: 'v.', translation: 'v. 运转，起作用', definition: 'functioning in the normal way' },
  checkpoint: { pos: 'n.', translation: 'n. 检查点，关卡', definition: 'a place you must reach and check in at during a race or course' },
  crash: { pos: 'n.', translation: 'n. 撞车事故', definition: 'an accident in which a vehicle hits something' },
  fold: { pos: 'v.', translation: 'v. 折叠', definition: 'to bend paper or cloth so that one part lies on top of another' },
  sensible: { pos: 'adj.', translation: 'adj. 明智的，合理的', definition: 'reasonable and showing good judgement' },
  presentation: { pos: 'n.', translation: 'n. 报告，展示', definition: 'a talk in which someone shows or explains something to a group' },
  switch: { pos: 'v.', translation: 'v. 关掉，打开（switch off / on）', definition: 'to turn a machine or light off or on' },
  stream: { pos: 'n.', translation: 'n. 一连串，源源不断', definition: 'a continuous series of things' },
  crack: { pos: 'v.', translation: 'v. 破裂，（嗓音）变调', definition: 'to break so that a line appears, or (of a voice) to change suddenly' },
  canteen: { pos: 'n.', translation: 'n. （学校、单位的）食堂', definition: 'a place in a school or workplace where meals are served' },
  profile: { pos: 'n.', translation: 'n. 人物简介', definition: "a short description of someone's life, work and character" },
  queue: { pos: 'n.', translation: 'n. 队，行列', definition: 'a line of people waiting for something' },
  squeak: { pos: 'v.', translation: 'v. 发出吱吱声', definition: 'to make a short, high sound' },
  dull: { pos: 'adj.', translation: 'adj. 乏味的，无聊的', definition: 'not interesting or exciting' },
  simultaneous: { pos: 'adj.', translation: 'adj. 同时的，联立的（方程）', definition: 'happening at the same time; simultaneous equations are solved together' },
  suppose: { pos: 'v.', translation: 'v. 应该（be supposed to）', definition: 'be supposed to: to be expected to do something' },
  season: { pos: 'n.', translation: 'n. （体育）赛季', definition: 'the part of the year when a sport is played' },
  tail: { pos: 'n.', translation: 'n. （硬币的）反面', definition: "the side of a coin that does not show a person's head" },

  therapist: { pos: 'n.', translation: 'n. 治疗师（speech therapist：言语治疗师）', definition: 'a person trained to help people with a particular problem, such as speech' },
  penalty: { pos: 'n.', translation: 'n. （足球的）点球', definition: 'in football, a free kick at the goal given because of a foul' },
  proudly: { pos: 'adv.', translation: 'adv. 自豪地，得意地', definition: 'in a way that shows you are pleased with yourself' },
  struggle: { pos: 'v.', translation: 'v. 费力，挣扎', definition: 'to try very hard to do something that is difficult' },
  ordinary: { pos: 'adj.', translation: 'adj. 普通的，平常的', definition: 'normal and not special' },
  press: { pos: 'v.', translation: 'v. 按，压', definition: 'to push something firmly' },
  rise: { pos: 'v.', translation: 'v. 升起，抬起', definition: 'to move upwards' },
  lighten: { pos: 'v.', translation: 'v. 变亮', definition: 'to become brighter' },
  snap: { pos: 'v.', translation: 'v. 厉声说话，发脾气', definition: 'to speak to someone suddenly in an angry way' },
  recess: { pos: 'n.', translation: 'n. 课间休息', definition: 'a short break between lessons at school' },

  // ── 雅思轻量 ──
  full: { pos: 'adj.', translation: 'adj. 满的，装满的', definition: 'containing as much as possible' },
  open: { pos: 'v.', translation: 'v. 打开，敞开', definition: 'to move something so it is no longer closed; also used to mean not closed or not filled' },
  carry: { pos: 'v.', translation: 'v. 携带，运送', definition: 'to take something from one place to another' },
  reach: { pos: 'v.', translation: 'v. 到达，抵达', definition: 'to arrive at a place' },
  dash: { pos: 'n.', translation: 'n. （摩斯电码的）划', definition: 'a long signal in Morse code' },
  rectangular: { pos: 'adj.', translation: 'adj. 长方形的', definition: 'shaped like a rectangle' },
  burr: { pos: 'n.', translation: 'n. （植物的）刺果', definition: 'a seed case covered in tiny hooks that sticks to clothes and fur' },
  crystal: { pos: 'n.', translation: 'n. 晶体', definition: 'a small, hard piece of a substance with a regular shape' },
  young: { pos: 'adj.', translation: 'adj. 幼小的', definition: 'having lived for only a short time' },
  muddy: { pos: 'adj.', translation: 'adj. 泥泞的，满是泥的', definition: 'covered in or full of mud' },

  // ── 备用词（同文替换时才出现）──
  international: { pos: 'adj.', translation: 'adj. 国际的', definition: 'involving more than one country' },
  recruit: { pos: 'v.', translation: 'v. 招募', definition: 'to find people to join an organisation or take part in a study' },
  estate: { pos: 'n.', translation: 'n. 住宅区（housing estate）', definition: 'an area with many houses or flats built together' },
  film: { pos: 'n.', translation: 'n. 电影', definition: 'a story shown on a screen' },
  like: { pos: 'prep.', translation: 'prep. 像，如同', definition: 'similar to; in the same way as' },
  final: { pos: 'adj.', translation: 'adj. 最后的，最终的', definition: 'coming at the end' },
  possible: { pos: 'adj.', translation: 'adj. 可能的', definition: 'able to happen or be done' },
  industry: { pos: 'n.', translation: 'n. 行业，工业', definition: 'the businesses that produce a particular kind of goods' },
  main: { pos: 'adj.', translation: 'adj. 主要的', definition: 'most important or largest' },
  label: { pos: 'v.', translation: 'v. 贴标签，标明', definition: 'to put a written note on something to show what it is' },

  // ── 雅思真题 ──
  mould: { pos: 'n.', translation: 'n. 霉，霉菌', definition: 'a soft green or grey growth on old food or damp surfaces' },
  churn: { pos: 'n.', translation: 'n. 大奶桶', definition: 'a large metal container for carrying milk' },
  resistant: { pos: 'adj.', translation: 'adj. 有抵抗力的，耐…的', definition: 'not harmed or affected by something' },
  breeder: { pos: 'n.', translation: 'n. 育种者', definition: 'a person who develops new kinds of plants or animals' },
  primate: { pos: 'n.', translation: 'n. 灵长类动物', definition: 'a member of the group of animals that includes humans, apes and monkeys' },
  reminder: { pos: 'n.', translation: 'n. 提醒（的事物）', definition: 'something that makes you remember something' },
  underlying: { pos: 'adj.', translation: 'adj. 根本的，潜在的', definition: 'real and basic, though not always obvious' },
  placebo: { pos: 'n.', translation: 'n. 安慰剂', definition: 'a substance with no medical effect, given instead of a real drug' },
  ethical: { pos: 'adj.', translation: 'adj. 道德上的，伦理的', definition: 'connected with what is morally right or wrong' },
  irritable: { pos: 'adj.', translation: 'adj. 易怒的，（器官）易激的', definition: 'easily annoyed, or (of a body part) easily made painful' },
  reproduction: { pos: 'n.', translation: 'n. 繁殖，生殖', definition: 'the process by which animals or plants produce young' },
  prevention: { pos: 'n.', translation: 'n. 预防', definition: 'the act of stopping something bad from happening' },
  outbreak: { pos: 'n.', translation: 'n. （疾病的）暴发', definition: 'a sudden start of a disease that affects many people' },
  spray: { pos: 'v.', translation: 'v. 喷，喷洒', definition: 'to cover something with very small drops of liquid' },
  pose: { pos: 'v.', translation: 'v. 造成（威胁、问题）', definition: 'to cause a problem or danger' },
  mate: { pos: 'v.', translation: 'v. 交配', definition: '(of animals) to come together to produce young' },
};
