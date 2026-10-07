/**
 * 第七周的**义项更正表**（build-week2-vocab.js 读到这份表才启用）。
 *
 * 生成器从 ECDICT 取「第一条义项」，不做词义消歧。第七周第一次生成时出现了
 * pole →「波兰人」、sticker →「屠夫」、full →「把衣服缝得宽松」、real →「实数」、
 * canteen →「水壶」、queue →「辫子」、asteroid →「海盘车」、default →「违约」、
 * figure →「数字」、music →「乐曲」（原文是乐谱）、data →「资料」（原文是手机流量）等。
 * 这里按本周文章里的用法手写一条释义；同一个词在本周几篇里用法不同时，
 * 取几处都说得通的写法（如 lying：说谎 / 躺着，crack：裂缝 / 破音，hard：困难的 / 用力地）。
 *
 * 这些文章词目前不显示给学生（每日学词走新版词库），这份表修的是内容包本身。
 * 规矩（内容测试会查）：中文释义里不能有分号；英文释义不能换行。
 */

'use strict';

module.exports = {
  // ── 多档共用的常用词：生成器取了名词义或冷僻义 ──
  last: { pos: 'a.', translation: 'a. 上一个的，最近的', definition: 'the one before this one, the most recent' },
  next: { pos: 'a.', translation: 'a. 紧挨着的，旁边的', definition: 'nearest in place, beside' },
  single: { pos: 'a.', translation: 'a. 单个的，一个的', definition: 'only one' },
  whole: { pos: 'a.', translation: 'a. 整个的，全部的', definition: 'complete, all of something' },
  rest: { pos: 'n.', translation: 'n. 其余部分，剩下的', definition: 'the part that is left' },
  stay: { pos: 'v.', translation: 'v. 停留，保持', definition: 'to remain in a place or in a state' },
  open: { pos: 'v.', translation: 'v. 打开，张开', definition: 'to move something so that it is no longer closed' },
  carry: { pos: 'v.', translation: 'v. 携带，带走', definition: 'to take something from one place to another' },
  keep: { pos: 'v.', translation: 'v. 保持，一直', definition: 'to stay in a particular state or position' },
  hit: { pos: 'v.', translation: 'v. 撞，打', definition: 'to touch something with force' },
  press: { pos: 'v.', translation: 'v. 按，压', definition: 'to push something firmly' },
  face: { pos: 'n.', translation: 'n. 脸（也作动词：面向）', definition: 'the front of the head, or to be turned towards something' },
  look: { pos: 'v.', translation: 'v. 看，看起来', definition: 'to turn your eyes towards something, or to seem' },
  like: { pos: 'prep.', translation: 'prep. 像', definition: 'similar to' },
  sound: { pos: 'v.', translation: 'v. 听起来，（使）发出声音', definition: 'to seem when heard about, or to make something produce a sound' },
  pass: { pos: 'v.', translation: 'v. 经过', definition: 'to go past something' },
  burn: { pos: 'v.', translation: 'v. 烧伤，晒伤', definition: 'to damage the skin with heat or sunlight' },
  young: { pos: 'a.', translation: 'a. 年轻的', definition: 'not old' },
  real: { pos: 'a.', translation: 'a. 真正的', definition: 'actual, true, not pretended' },
  within: { pos: 'prep.', translation: 'prep. 在……之内', definition: 'before a period of time has passed' },
  hard: { pos: 'a.', translation: 'a. 困难的（也作副词：用力地）', definition: 'difficult, or with a lot of force' },
  save: { pos: 'v.', translation: 'v. 节省，保存', definition: 'to use less of something, or to keep a copy of something' },
  rise: { pos: 'v.', translation: 'v. 上升', definition: 'to go up' },
  kill: { pos: 'v.', translation: 'v. 杀死，致死', definition: 'to cause the death of' },
  lift: { pos: 'v.', translation: 'v. 举起，抬起', definition: 'to move something up' },
  switch: { pos: 'v.', translation: 'v. 关掉（switch off）', definition: 'to turn off a light or machine' },
  pressure: { pos: 'n.', translation: 'n. 压力', definition: 'the force of a gas or liquid, or the feeling of being pushed to do something' },
  record: { pos: 'n.', translation: 'n. 记录，录制', definition: 'a written account of something, or the act of recording sound or pictures' },
  data: { pos: 'n.', translation: 'n. 数据，（手机）流量', definition: 'facts and information, or mobile internet use on a phone' },
  sign: { pos: 'n.', translation: 'n. 迹象，标志（也指告示牌）', definition: 'something that shows that something exists or is happening; also a notice giving information' },
  lying: { pos: 'v.', translation: 'v. 说谎，躺着（lie 的现在分词）', definition: 'not telling the truth, or being in a flat position' },
  crack: { pos: 'n.', translation: 'n. 裂缝（也指嗓音突然破音）', definition: 'a narrow break in something, or a sudden change in the sound of a voice' },
  pound: { pos: 'v.', translation: 'v. （心）怦怦直跳', definition: 'of the heart, to beat very strongly and quickly' },
  term: { pos: 'n.', translation: 'n. 学期', definition: 'one of the periods into which a school year is divided' },
  music: { pos: 'n.', translation: 'n. 音乐，乐谱', definition: 'sounds arranged in a pleasant way, or the written notes for a piece' },
  humming: { pos: 'v.', translation: 'v. 哼（歌）', definition: 'singing a tune with the lips closed' },
  final: { pos: 'a.', translation: 'a. 最后的', definition: 'coming at the end' },
  figure: { pos: 'n.', translation: 'n. 人影，身影', definition: 'the shape of a person seen from a distance or unclearly' },
  hollow: { pos: 'a.', translation: 'a. 空心的', definition: 'having an empty space inside' },
  empty: { pos: 'a.', translation: 'a. 空的', definition: 'containing nothing' },
  nobody: { pos: 'pron.', translation: 'pron. 没有人', definition: 'no person' },

  // ── 基础档 ──
  pole: { pos: 'n.', translation: 'n. 杆子，柱子', definition: 'a long thin stick or post' },
  horn: { pos: 'n.', translation: 'n. （汽车）喇叭', definition: 'the part of a car that makes a loud warning sound' },
  flash: { pos: 'v.', translation: 'v. 闪烁', definition: 'to shine on and off quickly' },
  cross: { pos: 'v.', translation: 'v. 穿过，横过', definition: 'to go from one side to the other' },
  notice: { pos: 'v.', translation: 'v. 注意到', definition: 'to see or become aware of something' },
  puzzle: { pos: 'n.', translation: 'n. 拼图，智力游戏', definition: 'a game or toy that you have to solve, such as a jigsaw' },
  full: { pos: 'a.', translation: 'a. 满的', definition: 'containing as much as possible' },
  spill: { pos: 'v.', translation: 'v. 洒出，溢出', definition: 'to let liquid fall out of a container by accident' },

  // ── 雅思轻量 ──
  grease: { pos: 'n.', translation: 'n. 油污，油脂', definition: 'a thick oily substance' },
  scrub: { pos: 'v.', translation: 'v. 用力擦洗', definition: 'to rub something hard to clean it' },
  rinsing: { pos: 'v.', translation: 'v. 冲洗，漂洗', definition: 'washing something quickly with clean water' },
  germ: { pos: 'n.', translation: 'n. 细菌，病菌', definition: 'a very small living thing that can cause disease' },
  force: { pos: 'v.', translation: 'v. 强行（挤进）', definition: 'to make something move by using strength' },
  cope: { pos: 'vi.', translation: 'vi. 应付，对付', definition: 'to deal successfully with something difficult' },
  eardrum: { pos: 'n.', translation: 'n. 鼓膜', definition: 'a thin piece of skin inside the ear that moves when sound reaches it' },
  chew: { pos: 'v.', translation: 'v. 咀嚼，嚼', definition: 'to bite food or gum many times' },
  squeeze: { pos: 'v.', translation: 'v. 挤压，压扁', definition: 'to press something firmly from the sides' },
  high: { pos: 'a.', translation: 'a. 高的', definition: 'large in amount or level' },
  stony: { pos: 'a.', translation: 'a. 石头的，像石头的', definition: 'made of stone or like stone' },
  torch: { pos: 'n.', translation: 'n. 手电筒', definition: 'a small electric light that you can carry' },
  soak: { pos: 'v.', translation: 'v. 渗透，浸透', definition: 'of a liquid, to pass slowly through something' },
  point: { pos: 'n.', translation: 'n. 尖端（也指小数点）', definition: 'the thin sharp end of something, or the dot in a decimal number' },

  // ── 中级 / 标准档 ──
  lump: { pos: 'n.', translation: 'n. 块，团', definition: 'a small piece of something solid with no particular shape' },
  dumplings: { pos: 'n.', translation: 'n. 饺子（dumpling 的复数）', definition: 'small pieces of dough filled with meat or vegetables and boiled or steamed' },
  saving: { pos: 'n.', translation: 'n. 积蓄，存款（常用复数 savings）', definition: 'money that you have kept and not spent' },
  salon: { pos: 'n.', translation: 'n. 美发店', definition: 'a shop where people have their hair cut' },
  plait: { pos: 'n.', translation: 'n. 辫子（也作动词：编辫子）', definition: 'a length of hair twisted together in three parts, or to make one' },
  chase: { pos: 'v.', translation: 'v. 追赶', definition: 'to run after someone to catch them' },
  dread: { pos: 'v.', translation: 'v. 害怕，畏惧', definition: 'to feel very worried about something that is going to happen' },
  offend: { pos: 'v.', translation: 'v. 冒犯，使不快', definition: 'to make someone feel upset or a little hurt' },
  skip: { pos: 'v.', translation: 'v. 不吃（饭），跳过', definition: 'to not have a meal or not do something you usually do' },
  noodle: { pos: 'n.', translation: 'n. 面条', definition: 'a long thin strip of food made from flour and water' },
  canteen: { pos: 'n.', translation: 'n. （学校的）食堂', definition: 'a place in a school where students buy and eat food' },
  queue: { pos: 'n.', translation: 'n. 队伍，（排）队', definition: 'a line of people waiting for something' },
  burst: { pos: 'v.', translation: 'v. 突然（笑 / 哭）出来', definition: 'to suddenly start laughing or crying' },
  verse: { pos: 'n.', translation: 'n. （歌曲的）主歌，段', definition: 'one of the parts of a song that come before the chorus' },
  stool: { pos: 'n.', translation: 'n. 凳子', definition: 'a seat with no back or arms' },
  drummer: { pos: 'n.', translation: 'n. 鼓手', definition: 'a person who plays a drum' },
  trumpet: { pos: 'n.', translation: 'n. 小号', definition: 'a brass musical instrument that you blow into' },
  slip: { pos: 'v.', translation: 'v. 滑落，滑脱', definition: 'to slide out of position by accident' },
  lower: { pos: 'a.', translation: 'a. 较低的', definition: 'less high in amount' },
  series: { pos: 'n.', translation: 'n. 系列（一套书）', definition: 'a set of books or programmes about the same characters' },
  carriage: { pos: 'n.', translation: 'n. （火车的）车厢', definition: 'one of the parts of a train where passengers sit' },
  interchange: { pos: 'n.', translation: 'n. （地铁）换乘站', definition: 'a station where passengers can change from one train line to another' },
  microwave: { pos: 'n.', translation: 'n. 微波炉', definition: 'an oven that cooks food very quickly' },
  dining: { pos: 'n.', translation: 'n. 用餐（dining table 餐桌）', definition: 'eating a meal' },
  fold: { pos: 'v.', translation: 'v. 折叠', definition: 'to bend paper so that one part lies on another' },
  sheet: { pos: 'n.', translation: 'n. （一）张（纸）', definition: 'a flat thin piece of paper' },
  sticker: { pos: 'n.', translation: 'n. 贴纸', definition: 'a small piece of paper with a picture or words that you can stick on something' },

  // ── 雅思真题 ──
  asteroid: { pos: 'n.', translation: 'n. 小行星', definition: 'a large rock that travels around the sun' },
  crust: { pos: 'n.', translation: 'n. 地壳', definition: 'the hard outer layer of the Earth' },
  physicist: { pos: 'n.', translation: 'n. 物理学家', definition: 'a scientist who studies physics' },
  clay: { pos: 'n.', translation: 'n. 黏土', definition: 'a type of heavy, sticky earth' },
  speculation: { pos: 'n.', translation: 'n. 推测，猜测', definition: 'ideas about something when there is not enough information to be certain' },
  industry: { pos: 'n.', translation: 'n. 工业，产业', definition: 'the production of goods in factories' },
  reconcile: { pos: 'vt.', translation: 'vt. 使一致，调和', definition: 'to show that two ideas or facts can both be true' },
  compelling: { pos: 'a.', translation: 'a. 令人信服的，引人入胜的', definition: 'so interesting or convincing that people believe it' },
  default: { pos: 'n.', translation: 'n. 默认选项，默认设置', definition: 'the option that is used if no other choice is made' },
};
