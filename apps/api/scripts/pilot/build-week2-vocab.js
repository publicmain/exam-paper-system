/**
 * 生成**首发周**（2026-09-07 起）五档五天的教学词表。
 *
 * 词条元数据来自 ECDICT（MIT 许可）；生成结果提交进仓库，于是发布一天的
 * 课程既不依赖网络，也不依赖某台机器上恰好有那个 CSV。
 *
 * 与第一周的 `build-level-vocab.js` 有两点不同：
 *
 * 1. **五档全覆盖**。第一周只有两个改编档走这条路，另外三档手写词表；
 *    首发周五档都从这里出，口径一致。
 * 2. **每天取到 20 个词，而不是 12 个**。发布脚本把前 12 个当今日主词，
 *    其余留作同文备用词 —— 学生点「这个词我会了，换一个」时换进来的就是
 *    它们。第一周的两个改编档正好只有 12 个，于是那两档的「换一个」没有
 *    同文备用词可用；这次补上。
 *
 * 跑法：
 *   node apps/api/scripts/pilot/build-week2-vocab.js --csv C:/path/to/ecdict.csv
 */

'use strict';

const fs = require('fs');
const path = require('path');
const { dictionary, choose } = require('./build-level-vocab');

const WEEK2 = path.join(__dirname, 'content', 'week2');
const OUT = path.join(WEEK2, 'vocab.generated.json');

/** 目标词数与可以退让到的下限。短文章（O-Level 基础档只有两百多词）取不满 20。 */
const TARGET = 20;
const FLOOR = 12;

/**
 * 每篇文章希望优先教到的词。留空也能跑 —— `choose` 会按考试标签、
 * 柯林斯星级、牛津核心词和词频自己排序；给了偏好表只是把这一篇真正
 * 值得教的词顶到前面去（前 12 个才是当天主词）。
 */
const PREFERRED = require('./content/week2/preferred-words.js');

/**
 * 按偏好表重排选出来的词 —— **前 12 个才是学生当天的主词**，这一步决定
 * 他真正学到的是哪 12 个。
 *
 * 为什么不直接改 `choose` 的打分：那个函数第一周也在用，而第一周的词表
 * 已经生成、提交并发到学生手上了。改共用打分等于让已发布内容的重放结果
 * 漂移，所以偏好只在这里生效。
 *
 * 为什么必须重排：`choose` 的分数里有一项 `rarity`，取自 ECDICT 的词频
 * 排名；而 `barrage`、`estuary`、`tidal`、`mudflat` 这类专题词在 ECDICT
 * 里**没有词频数据**，rarity 直接记 0，于是一篇讲潮汐发电的文章，主词
 * 排出来是 current / commercial / generate，真正的专题词全掉进备用词。
 * 偏好表写了却不生效，等于没写。
 */
function orderByPreference(rows, preferred) {
  if (!preferred.length) return rows;
  const rank = new Map(preferred.map((w, i) => [w, i]));
  const inList = rows.filter((r) => rank.has(r.headword)).sort((a, b) => rank.get(a.headword) - rank.get(b.headword));
  const rest = rows.filter((r) => !rank.has(r.headword));
  return [...inList, ...rest];
}

/**
 * 选词时用的正文 —— 去掉文末括号里的词汇注释。
 *
 * 库里有几篇文末带 `(Glossary: quiescence: a period of inactivity; …)`。
 * 这段对学生有用，所以留在原文里；但它不能进选词范围 —— `choose` 会把
 * 整条注释当成一个句子，于是学习卡的例句变成一串分号堆起来的词表。
 * 只影响候选来源，选出来的例句仍是原文的逐字子串。
 */
function vocabText(passage) {
  return passage.replace(/\n\s*\n\([^)]*\)\s*$/, '').trim();
}

/**
 * 把 ECDICT 的**多义项堆叠**裁成一条，学习卡才用得了。
 *
 * ECDICT 一个词条会把所有义项、所有词性塞进同一个字段：
 *
 *   umbrella  definition = "n. a lightweight handheld collapsible canopy\n
 *                           n. a formation of military planes maintained over
 *                           ground operations or targets\n…"
 *   cleaning  translation = "n. 清洁, 扫除, 家畜的胞衣, 扫除出来的垃圾,
 *                            大败, 输得精光, 除伐, 巨额利润；[计] 清洗"
 *
 * 原样发出去，中一学生的生词卡上会写着「在地面作战上空维持的军用机编队」
 * 和「家畜的胞衣」。第一周手写的三个档位是一条干净释义（`narrow` →
 * 「adj. 狭窄的」/「not wide; only a short distance from one side to the
 * other」），这里把改编档也拉到同一水平。
 *
 * 挑哪一条：
 *
 *   · 原文里的词形以 -ing / -ed 结尾时优先取动词义项 —— 不然
 *     `sweeping`（正在扫地）会被解释成名词「清扫这件事」；
 *   · 其余取第一条，ECDICT 的排序就是按义项常用度来的；
 *   · 中文按选中义项的词性对齐，取不到就取第一条，并只留前三个词。
 *
 * 这仍是启发式，不是词义消歧：`still`、`charge` 这类高度多义的词仍可能
 * 挑错。所以偏好表尽量不把它们排进主词。
 */
const POS_ALIAS = { n: ['n'], v: ['v', 'vt', 'vi'], s: ['a', 'adj'], a: ['a', 'adj'], r: ['ad', 'adv'] };

/**
 * 去掉行首的词性标记。
 *
 * 带句点的（`n.` / `adj.`）直接剥。少数条目漏写句点（`n the mother of
 * your father`），也要剥 —— 但**只剥 n / v / s / r**：`a` 不能剥，否则
 * 「a place off to the side of an area」会被砍掉冠词。
 */
function stripPosTag(text) {
  return text.replace(/^[a-z]+\.\s*/, '').replace(/^[nvsr]\s+(?=[a-z])/, '').trim();
}

/** 学科限定词。`(computer science) a line of code` 对这里的语文课没用。 */
const DOMAIN_TAG = /^\([a-z][a-z\s]+\)\s*/;

/**
 * ECDICT 里「过去式 / 过去分词 / 复数」这类**变形词条**。
 *
 * `traced` 在词典里自成一条，释义是「& p. p. of Trace」，中文是
 * 「v. 描绘( trace 的过去式和过去分词 )」—— 当生词卡发出去，学生看到的
 * 「今日新词」是 traced，释义是一句语法说明。这类词条要换回原形。
 */
const INFLECTED_ZH = /(的过去式|的过去分词|的第三人称|的复数|的现在分词)/;
const INFLECTED_EN = /^(&\s*)?(imp\.|p\.\s*p\.|pl\.|3d)\b/i;

function baseFormOf(row) {
  const m = String(row.translation).match(/([a-z][a-z-]{2,})\s*的(?:过去式|过去分词|第三人称|复数|现在分词)/i);
  if (m) return m[1].toLowerCase();
  const en = String(row.definition).match(/\bof\s+([A-Za-z][a-z-]{2,})\b/);
  return en ? en[1].toLowerCase() : null;
}

/**
 * 挑一条义项。顺序：词性对得上 → 没有学科限定 → **原顺序的第一条**。
 *
 * ECDICT 的义项是按常用度排的，所以同一词性里取第一条最稳。
 *
 * 一度改成「取最短的一条」，因为长义项往往拖着一串补充说明。结果适得其反：
 * `repair` 挑到最短的动词义「move, travel, or proceed toward some place」
 * （古义「前往」），`earthquake` 挑到「a disturbance that is extremely
 * disruptive」（比喻义）。短不等于核心。
 *
 * 只有第一条实在太长（超过 110 字，卡片上是一整块墙）时才退而取同组最短的。
 */
const DEFINITION_WALL = 110;

function pickDefinition(lines, wantTag) {
  const clean = (l) => stripPosTag(l).replace(DOMAIN_TAG, '').split(/\s*;\s*/)[0].trim();
  const usable = lines.filter((l) => clean(l).length >= 12 && !INFLECTED_EN.test(clean(l)));
  const pool = usable.length ? usable : lines;
  const posMatch = wantTag ? pool.filter((l) => new RegExp(`^${wantTag}\\.`).test(l)) : [];
  const noDomain = (arr) => arr.filter((l) => !DOMAIN_TAG.test(stripPosTag(l)));
  for (const group of [noDomain(posMatch), posMatch, noDomain(pool), pool]) {
    if (!group.length) continue;
    if (clean(group[0]).length <= DEFINITION_WALL) return group[0];
    return [...group].sort((a, b) => clean(a).length - clean(b).length)[0];
  }
  return lines[0];
}

function trimSense(row, dict) {
  // 变形词条先换回原形，换不到就原样留着（下面仍会挑一条能用的释义）。
  if (INFLECTED_ZH.test(row.translation) || INFLECTED_EN.test(stripPosTag(String(row.definition).split(/\\n|\n/)[0] ?? ''))) {
    const base = baseFormOf(row);
    const entry = base && dict.get(base);
    if (entry) {
      row = { ...row, headword: base, phonetic: entry.phonetic, translation: entry.translation, definition: entry.definition };
    }
  }

  const lines = String(row.definition)
    .split(/\\n|\n/)
    .map((s) => s.trim())
    .filter(Boolean);
  // 原文里的词形以 -ing / -ed 结尾时，动词义项优先。
  const wantTag = /(ing|ed)$/i.test(row.surfaceForm) && lines.some((l) => /^v\./.test(l))
    ? 'v'
    : (String(row.pos).match(/^([a-z]+)\./) ?? [])[1]?.replace(/^(vt|vi)$/, 'v')?.replace(/^adj$/, 'a');
  const chosen = pickDefinition(lines, wantTag) ?? row.definition;
  const tag = (chosen.match(/^([a-z]+)\./) ?? [])[1];
  // 释义只留分号前的第一句：ECDICT 常把补充说明接在后面，卡片放不下。
  const definition = stripPosTag(chosen).replace(DOMAIN_TAG, '').split(/\s*;\s*/)[0].trim();

  const zhParts = String(row.translation)
    .split(/[；;]/)
    .map((s) => s.trim())
    .filter(Boolean)
    .filter((s) => !s.startsWith('[')); // 「[计] 清洗」这类学科标注对学生没用
  const wanted = POS_ALIAS[tag] ?? [];
  const zhChosen =
    zhParts.find((p) => wanted.some((w) => p.toLowerCase().startsWith(w + '.'))) ?? zhParts[0] ?? row.translation;
  // 「n. 清洁, 扫除, 家畜的胞衣, …」→ 只留前两个。留三个时 `cleaning` 的
  // 第三项正是「家畜的胞衣」，`consumption` 的第三项是「痨病」。
  const zhMatch = zhChosen.match(/^([a-z]+\.)\s*(.*)$/i);
  const zhBody = (zhMatch ? zhMatch[2] : zhChosen)
    .split(/[,，]/)
    .map((s) => s.trim())
    .filter(Boolean)
    .slice(0, 2)
    .join('，');
  const translation = zhMatch ? `${zhMatch[1]} ${zhBody}` : zhBody;

  return {
    ...row,
    pos: zhMatch ? zhMatch[1] : row.pos,
    translation,
    definition: definition.length > 10 ? definition : stripPosTag(lines[0] ?? row.definition),
  };
}

/** 档位模块按接口认：导出了 `LEVEL` 和 `DAYS` 的才是。 */
function levelModules() {
  return fs
    .readdirSync(WEEK2)
    .filter((f) => f.endsWith('.js') && f !== 'index.js')
    .sort()
    .map((f) => require(path.join(WEEK2, f)))
    .filter((mod) => typeof mod.LEVEL === 'string' && Array.isArray(mod.DAYS));
}

function main() {
  const arg = process.argv.find((a) => a.startsWith('--csv='));
  const split = process.argv.indexOf('--csv');
  const csv = arg ? arg.slice(6) : split >= 0 ? process.argv[split + 1] : '';
  if (!csv || !fs.existsSync(csv)) throw new Error('用法：--csv <ecdict.csv>');
  const dict = dictionary(csv);

  const output = {};
  let lessons = 0;
  let words = 0;
  const thin = [];

  for (const mod of levelModules()) {
    output[mod.LEVEL] = {};
    for (const day of mod.DAYS) {
      let rows = null;
      // 取不满就一格一格退，退到 12 还取不满才算失败 —— 内容包的下限是 12。
      for (let want = TARGET; want >= FLOOR; want -= 1) {
        try {
          rows = choose(vocabText(day.passage), dict, PREFERRED[day.source] ?? [], want);
          break;
        } catch {
          /* 继续退 */
        }
      }
      if (!rows) throw new Error(`选不出 ${FLOOR} 个词：${mod.LEVEL} / ${day.source}`);
      if (rows.length < TARGET) thin.push(`${mod.LEVEL}/${day.source} 只有 ${rows.length} 个`);
      output[mod.LEVEL][day.source] = orderByPreference(rows, PREFERRED[day.source] ?? []).map((r) => trimSense(r, dict));
      lessons += 1;
      words += rows.length;
    }
  }

  fs.writeFileSync(OUT, `${JSON.stringify(output, null, 2)}\n`, 'utf8');
  console.log(`已写入 ${OUT}`);
  console.log(`${lessons} 天 / ${words} 个词条`);
  if (thin.length) {
    console.log(`\n没取满 ${TARGET} 个的（备用词会少，「换一个」的余量随之变小）：`);
    for (const line of thin) console.log('  · ' + line);
  }
}

if (require.main === module) main();

module.exports = { TARGET, FLOOR, OUT };
