/**
 * 第五周的**义项更正表**（build-week2-vocab.js 读到这份表才启用）。
 *
 * 生成器从 ECDICT 取「第一条义项」，不做词义消歧。第五周周一第一次生成时出现了
 * footage →「英尺长度」、seizure →「捕获」、thinner →「稀释剂」、canteen →「水壶」、
 * streak →「条理，斑纹」、account →「报告」、international →「国别设定」、
 * trick →「诡计，欺诈」、draw →「拉，拖」、queue →「辫子」。
 * 这里按本周文章里的用法手写一条释义；同一个词在本周几篇里用法不同时，
 * 取几处都说得通的写法。每加一天，生成后把新词再过一遍。
 *
 * 这些文章词目前不显示给学生（每日学词走新版词库），这份表修的是内容包本身。
 *
 * 规矩（内容测试会查）：中文释义里不能有分号；英文释义不能换行。
 */

'use strict';

module.exports = {
  // ── 周一 · 雅思真题 Safety in Numbers? ──
  diffusion: { pos: 'n.', translation: 'n. 扩散，分散', definition: 'the spreading of something over a wider area or among more people' },
  intervention: { pos: 'n.', translation: 'n. 干预，介入', definition: 'the act of becoming involved in a situation to change what happens' },
  seizure: { pos: 'n.', translation: 'n. （疾病）发作，癫痫发作', definition: 'a sudden attack of an illness, especially one in which the body shakes' },
  footage: { pos: 'n.', translation: 'n. （一段）影片，录像片段', definition: 'film or video of a particular event' },
  international: { pos: 'adj.', translation: 'adj. 国际的，由多国组成的', definition: 'involving people or organisations from more than one country' },
  perceive: { pos: 'v.', translation: 'v. 察觉，感知', definition: 'to notice or become aware of something' },
  general: { pos: 'n.', translation: 'n. 一般，总体（in general 笼统地、泛泛地）', definition: 'used in in general to mean in a way that is not specific' },

  // ── 周一 · 雅思轻量 Is That Really My Voice? ──
  cord: { pos: 'n.', translation: 'n. 带状组织（vocal cords 声带）', definition: 'a long thin part of the body; vocal cords produce the sound of the voice' },
  thinner: { pos: 'adj.', translation: 'adj. 更单薄的，更细的（thin 的比较级）', definition: 'comparative of thin: having less depth or richness, especially of a sound' },
  humming: { pos: 'v.', translation: 'v. 哼（歌）（hum 的现在分词）', definition: 'present participle of hum: to sing with your lips closed' },
  faulty: { pos: 'adj.', translation: 'adj. 有毛病的，出故障的', definition: 'not working properly' },
  route: { pos: 'n.', translation: 'n. 路线，途径', definition: 'a way from one place to another' },
  record: { pos: 'v.', translation: 'v. 录制，录（音）', definition: 'to store sounds or pictures so that they can be played again' },
  press: { pos: 'v.', translation: 'v. 按，压', definition: 'to push something firmly against something else' },
  carry: { pos: 'v.', translation: 'v. 传送，传导', definition: 'to take something such as sound from one place to another' },
  pass: { pos: 'v.', translation: 'v. 穿过，通过', definition: 'to move through or across something' },

  // ── 周一 · O-Level 基础 The Flat Tyre ──
  trick: { pos: 'n.', translation: 'n. 窍门，诀窍', definition: 'a quick or clever way of doing something' },
  used: { pos: 'v.', translation: 'v. 使用（use 的过去式）', definition: 'past tense of use: to do something with a thing for a purpose' },
  round: { pos: 'prep.', translation: 'prep. 围绕，在……周围', definition: 'on every side of something; around' },
  special: { pos: 'adj.', translation: 'adj. 专门的，特别的', definition: 'made or used for one particular purpose' },
  draw: { pos: 'v.', translation: 'v. 画', definition: 'to make a picture or shape with a pen or pencil' },
  wait: { pos: 'v.', translation: 'v. 等，等待', definition: 'to stay where you are or delay doing something until something happens' },
  open: { pos: 'v.', translation: 'v. （商店）开门营业', definition: 'to start business for the day' },
  next: { pos: 'adj.', translation: 'adj. 下一个的，紧接着的', definition: 'coming straight after this one' },
  near: { pos: 'prep.', translation: 'prep. 在……附近，接近', definition: 'not far from a place or a time' },

  // ── 周一 · O-Level 标准 A Finger's Width ──
  lower: { pos: 'v.', translation: 'v. 放低，压低（声音）', definition: 'to make something go down or become quieter' },
  queue: { pos: 'n.', translation: 'n. 排的队，队伍（也作动词：排队）', definition: 'a line of people waiting for something; as a verb, to wait in such a line' },
  fold: { pos: 'v.', translation: 'v. 交叉（双臂），折叠', definition: 'to cross your arms over your chest; to bend something so one part covers another' },
  measure: { pos: 'v.', translation: 'v. 量，测量', definition: 'to find the size or height of something' },
  rest: { pos: 'n.', translation: 'n. 其余部分，剩下的', definition: 'the part of something that remains' },
  whole: { pos: 'adj.', translation: 'adj. 整个的，全部的', definition: 'all of something; complete' },
  reach: { pos: 'v.', translation: 'v. 达到，够到', definition: 'to get as far as a particular point or level' },

  // ── 周一 · O-Level 中级 The Orange Flame ──
  flame: { pos: 'n.', translation: 'n. 火焰，火苗', definition: 'the hot bright burning gas that you see when something is on fire' },
  streak: { pos: 'n.', translation: 'n. 连续记录（如连续打卡的天数）', definition: 'a period in which something happens every time or every day without a break' },
  canteen: { pos: 'n.', translation: 'n. （学校、单位的）食堂', definition: 'a place in a school or workplace where food is served' },
  data: { pos: 'n.', translation: 'n. 数据，（手机的）流量', definition: 'information; on a phone, the service that lets it use the internet' },
  tablet: { pos: 'n.', translation: 'n. 平板电脑', definition: 'a small flat computer that you use by touching the screen' },
  switch: { pos: 'v.', translation: 'v. 关（灯）（switch off）', definition: 'to turn a light or machine off or on' },
  account: { pos: 'n.', translation: 'n. 账号，账户', definition: 'the name and details you use to sign in to an app or website' },
  single: { pos: 'adj.', translation: 'adj. 单个的，仅仅一个的', definition: 'only one' },
  least: { pos: 'adv.', translation: 'adv. 至少（at least）', definition: 'used in at least to mean not less than' },

  // ── 周二到周五（2026-09-28 晚补；都不在周一词表里，不影响已发布的周一） ──
  // 雅思真题
  flourish: { pos: 'v.', translation: 'v. 繁茂，茁壮成长', definition: 'to grow well and be healthy' },
  removal: { pos: 'n.', translation: 'n. 移除，清除', definition: 'the act of taking something or someone away' },
  halving: { pos: 'v.', translation: 'v. 减半（halve 的现在分词）', definition: 'present participle of halve: to reduce something to half its size' },
  sobering: { pos: 'adj.', translation: 'adj. 发人深省的，令人清醒的', definition: 'making you think seriously about something' },
  cascade: { pos: 'n.', translation: 'n. 连锁反应（trophic cascade 营养级联）', definition: 'a process in which one change causes a series of other changes' },
  angular: { pos: 'adj.', translation: 'adj. 有棱角的，尖角的', definition: 'having sharp corners or points' },
  compile: { pos: 'v.', translation: 'v. 汇编，收集整理（资料）', definition: 'to collect information from different places and put it together' },
  neuroscientist: { pos: 'n.', translation: 'n. 神经科学家', definition: 'a scientist who studies the brain and nervous system' },
  earliest: { pos: 'adj.', translation: 'adj. 最早的（early 的最高级）', definition: 'superlative of early: happening before all others' },
  calibration: { pos: 'n.', translation: 'n. 校准，校正', definition: 'the process of checking and adjusting a measurement against a known standard' },
  emission: { pos: 'n.', translation: 'n. 排放，排放物', definition: 'gas or other substance sent into the air' },
  spectrometry: { pos: 'n.', translation: 'n. 质谱测定法，光谱测定法', definition: 'a method of measuring the amounts of different substances in a sample' },
  decay: { pos: 'v.', translation: 'v. （放射性物质）衰变', definition: 'of a radioactive substance: to change slowly into another substance' },
  endowment: { pos: 'n.', translation: 'n. 禀赋，所拥有的东西（endowment effect 禀赋效应）', definition: 'what a person already has; the endowment effect is valuing things more because you own them' },
  exposure: { pos: 'n.', translation: 'n. 接触，经历', definition: 'the experience of coming into contact with something' },
  identical: { pos: 'adj.', translation: 'adj. 完全相同的', definition: 'exactly the same' },
  // 雅思轻量
  stale: { pos: 'adj.', translation: 'adj. （面包等）不新鲜的，变硬的', definition: 'of bread or cake: no longer fresh and becoming hard' },
  seal: { pos: 'v.', translation: 'v. 密封，封住', definition: 'to close something so that nothing can get in or out' },
  crystal: { pos: 'n.', translation: 'n. 晶体，结晶', definition: 'a small solid piece with a regular shape, formed when a substance becomes solid' },
  start: { pos: 'v.', translation: 'v. 开始', definition: 'to begin doing something' },
  reverse: { pos: 'v.', translation: 'v. 逆转，使倒转', definition: 'to change something so that it goes back to how it was' },
  violet: { pos: 'n.', translation: 'n. 紫色，紫罗兰色', definition: 'a bluish purple colour' },
  look: { pos: 'v.', translation: 'v. 看起来，显得', definition: 'to seem to be something when you see it' },
  turn: { pos: 'v.', translation: 'v. 使变成（turn … brown 使变成褐色）', definition: 'to make something become a different colour or state' },
  weed: { pos: 'n.', translation: 'n. 杂草', definition: 'a wild plant growing where it is not wanted' },
  pressure: { pos: 'n.', translation: 'n. 压力', definition: 'the force produced when something presses against something else' },
  // O-Level 基础
  nobody: { pos: 'pron.', translation: 'pron. 没有人，谁也不', definition: 'no person; not anyone' },
  cup: { pos: 'n.', translation: 'n. 奖杯，杯子', definition: 'a prize, often shaped like a large cup, given to the winner of a competition' },
  full: { pos: 'adj.', translation: 'adj. 满的，全是……的', definition: 'containing a lot of something; filled' },
  keep: { pos: 'v.', translation: 'v. 一直（做某事）（keep walking 不停地走）', definition: 'to continue doing something' },
  count: { pos: 'v.', translation: 'v. 数，计数', definition: 'to say numbers in order, or to find the total number of things' },
  cross: { pos: 'v.', translation: 'v. 穿过，横过（马路）', definition: 'to go from one side of a road to the other' },
  stop: { pos: 'v.', translation: 'v. 阻止，使停下', definition: 'to prevent someone from doing something' },
  last: { pos: 'adj.', translation: 'adj. 上一个的，刚过去的（last month 上个月）', definition: 'the one just before this one' },
  // O-Level 标准 / 中级
  steer: { pos: 'v.', translation: 'v. 驾驶（steering wheel 方向盘）', definition: 'to control the direction of a vehicle; a steering wheel is what you turn to do this' },
  recess: { pos: 'n.', translation: 'n. 课间休息', definition: 'a short break between lessons at school' },
  term: { pos: 'n.', translation: 'n. 学期', definition: 'one of the periods into which a school year is divided' },
  stiff: { pos: 'adj.', translation: 'adj. 僵硬的，不灵活的', definition: 'difficult to bend or move' },
  bark: { pos: 'v.', translation: 'v. （狗）叫，吠', definition: 'of a dog: to make a short loud sound' },
  stinging: { pos: 'adj.', translation: 'adj. 刺痛的', definition: 'causing a sharp pain, like the feeling in your eyes before you cry' },
  lying: { pos: 'v.', translation: 'v. 平放，躺（lie 的现在分词）', definition: 'present participle of lie: to be in a flat position somewhere' },
  series: { pos: 'n.', translation: 'n. 系列（丛书）', definition: 'a set of books about the same characters or subject' },
  council: { pos: 'n.', translation: 'n. 理事会，委员会', definition: 'a group of people chosen to make decisions or do a job for an organisation' },
  film: { pos: 'n.', translation: 'n. 电影', definition: 'a story shown in moving pictures' },
  solver: { pos: 'n.', translation: 'n. 解题者（cube solver 玩魔方的人）', definition: 'a person who solves something, such as a puzzle' },
  primary: { pos: 'adj.', translation: 'adj. 小学的（primary school 小学）', definition: 'relating to the first stage of school, for young children' },
  plain: { pos: 'adj.', translation: 'adj. 原味的，不加东西的', definition: 'with nothing added' },
  figure: { pos: 'n.', translation: 'n. 身影，人影', definition: 'the shape of a person, especially one you cannot see clearly' },
  setting: { pos: 'n.', translation: 'n. （相机等的）设置', definition: 'one of the positions a machine or camera can be adjusted to' },
  // O-Level 标准 新周二 The Calculator Cover / 新周五 Dotted Letters（2026-09-28 晚换稿后补）
  spare: { pos: 'adj.', translation: 'adj. 备用的，多余的', definition: 'kept in case another one is needed' },
  rise: { pos: 'v.', translation: 'v. 抬起，举起（手）', definition: 'to move upwards' },
  business: { pos: 'n.', translation: 'n. 分内的事，该管的事', definition: 'something that concerns you and that you have a right to be involved in' },
  report: { pos: 'v.', translation: 'v. 举报，报告（老师）', definition: 'to tell someone in charge that another person has done something wrong' },
  cast: { pos: 'n.', translation: 'n. 石膏（固定骨折用）', definition: 'a hard cover put round a broken arm or leg to protect it while it heals' },
  particular: { pos: 'adj.', translation: 'adj. 特定的（in particular 特别地）', definition: 'used in in particular or nobody in particular to mean one specific thing or person' },
  trace: { pos: 'v.', translation: 'v. 描，描摹（字母）', definition: 'to copy letters or a picture by drawing over its lines' },
  slip: { pos: 'v.', translation: 'v. （从中）滑出，滑落', definition: 'to move or fall out smoothly and quietly' },
  sheet: { pos: 'n.', translation: 'n. （一）张（纸）', definition: 'a single piece of paper' },
  letter: { pos: 'n.', translation: 'n. 字母', definition: 'one of the signs used to write words, such as a, b or c' },
};
