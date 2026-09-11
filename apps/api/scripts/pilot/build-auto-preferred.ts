/**
 * 按档位自动挑「这篇文章值得教的词」—— 生成 `content/<week>/preferred-words.js`
 * （2026-09-11，第三周起替代手写偏好表）。
 *
 *   npx ts-node apps/api/scripts/pilot/build-auto-preferred.ts --week=week3 --csv <ecdict.csv>
 *
 * ## 为什么需要
 *
 * 词表生成器 `build-week2-vocab.js` 的 `choose` 按考试标签、柯林斯星级、牛津
 * 核心词打分 —— 这些分数最高的恰恰是 everything / difficult / working 这种
 * 学生早就会的大路词。首发周靠手写偏好表把专题词顶上去；第三周不再手写，
 * 第一次试跑出来的「主词」就是 grey / letter / hard / open，教了没有意义。
 *
 * ## 怎么挑
 *
 * 用 CEFR-J 判每个词的等级，按档位偏好的等级段排序 —— 教的是**比这一档
 * 上限高一点点**的词：
 *
 *   基础（上限 A2）     → B1 优先，其次 A2
 *   中级 / 标准（B1）   → B2 优先，其次词表外、B1
 *   雅思轻量（B2）      → 词表外优先，其次 B2
 *   雅思真题（不设限）  → 词表外优先，其次 B2
 *
 * 「词表外」= 不在 CEFR-J（只收到 B2）但在 ECDICT 里的词，基本都是 B2 以上
 * 的学术词和专题词。同等级内偏好带考试标签（CET4/6、IELTS、TOEFL）、词频
 * 适中的词 —— 太生僻的（词频排名五万开外）不教。
 *
 * 专有名词、数字词、月份星期、四个字母以下的词一律不要。
 */
import * as fs from 'fs';
import * as path from 'path';
import { tokenize } from '../../src/vocab-v2/cefr-difficulty';
import { cefrLevelOf } from '../../src/vocab-v2/cefr-wordlist';

// eslint-disable-next-line @typescript-eslint/no-var-requires
const { dictionary, STOP, lemmaCandidates } = require('./build-level-vocab');

const arg = (name: string) => {
  const eq = process.argv.find((a) => a.startsWith(`--${name}=`));
  if (eq) return eq.slice(name.length + 3);
  const i = process.argv.indexOf(`--${name}`);
  return i >= 0 ? process.argv[i + 1] : undefined;
};
const WEEK = arg('week') ?? 'week3';
const CSV = arg('csv') ?? '';
const DIR = path.join(__dirname, 'content', WEEK);
const OUT = path.join(DIR, 'preferred-words.js');
const PER_DAY = 16;

type Band = 'A1' | 'A2' | 'B1' | 'B2' | 'OFF';

/** 每档偏好的等级段，越靠前越优先；不在表里的等级不要。 */
const BANDS: Record<string, Band[]> = {
  ielts_simplified: ['B1', 'A2'],
  olevel_intermediate: ['B2', 'OFF', 'B1'],
  olevel: ['B2', 'OFF', 'B1'],
  ielts_light: ['OFF', 'B2'],
  ielts_authentic: ['OFF', 'B2'],
};

const NUMBER_WORDS = new Set(
  `one two three four five six seven eight nine ten eleven twelve thirteen fourteen fifteen sixteen seventeen
   eighteen nineteen twenty thirty forty fifty sixty seventy eighty ninety hundred thousand million billion
   first second third fourth fifth sixth seventh eighth ninth tenth eleventh twelfth sixteenth nineteenth
   monday tuesday wednesday thursday friday saturday sunday january february march april may june july
   august september october november december`.split(/\s+/),
);

/** ECDICT 里的变形词条：中文写着「tell 的过去式」这类。 */
const INFLECTED = /([a-z][a-z-]{1,})\s*的(?:过去式|过去分词|第三人称|复数|现在分词|比较级|最高级)/i;

/**
 * 词形还原。
 *
 * `lemmaCandidates` 只会按规则去词尾，第一版直接取「第一个在词典里的候选」，
 * 于是 changed → chang（一个姓）、routes → rout（溃败）。现在的顺序：
 *
 *   1. 候选里**有 CEFR 等级的**优先（change、route 都有）；
 *   2. 不规则变形（told / found / taken）ECDICT 自己标着「某某的过去式」，
 *      顺着它换回原形；
 *   3. 都不行才用词典里有的第一个候选。
 */
function lemmaOf(surface: string, dict: Map<string, any>): string | null {
  const w = surface.toLowerCase();
  // 比较级 / 最高级：lemmaCandidates 不管这两种，longer 会被当成「渴望者」教出去
  // 只在原词自己不在 CEFR 词表里时才试：honest 去掉 -est 会变成 hone，
  // counter 去掉 -er 会变成 count —— 它们本身就是词。
  const comparative = cefrLevelOf(w)
    ? []
    : [
        ...(w.endsWith('ier') ? [`${w.slice(0, -3)}y`] : []),
        ...(w.endsWith('er') ? [w.slice(0, -2), w.slice(0, -1)] : []),
        ...(w.endsWith('est') ? [w.slice(0, -3), w.slice(0, -2)] : []),
      ];
  const candidates = [...new Set([...(lemmaCandidates(surface) as string[]), ...comparative])].filter((c) => dict.has(c));
  if (!candidates.length) return null;
  // 去掉词尾后的候选若有 CEFR 等级，优先于原形本身：times → time、learning → learn、
  // crossing → cross —— 这些原形本身也在词表里，但要教的是词根。
  const stripped = candidates.filter((c) => c !== w).find((c) => cefrLevelOf(c));
  const withLevel = stripped ?? candidates.find((c) => cefrLevelOf(c));
  let word = withLevel ?? candidates[0];
  const base = String(dict.get(word)?.translation ?? '').match(INFLECTED)?.[1]?.toLowerCase();
  if (base && base !== word && dict.has(base)) word = base;
  return word;
}

function pick(passage: string, level: string, dict: Map<string, any>): string[] {
  const bands = BANDS[level];
  if (!bands) throw new Error(`没有 ${level} 的等级偏好`);
  const text = passage.replace(/^Paragraph (?:\d+|[A-Z])\s*/gm, '');
  const seen = new Set<string>();
  const scored: Array<{ word: string; score: number }> = [];
  for (const t of tokenize(text)) {
    if (t.properNoun) continue;
    if (/\d/.test(t.word) || t.word.includes("'")) continue;
    // 连字符复合词（twenty-two、thumbs-up）拆开后各自已经出现过，整体不教
    if (t.word.includes('-')) continue;
    const lemma = lemmaOf(t.word, dict);
    if (!lemma || lemma.length < 4 || seen.has(lemma)) continue;
    if (STOP.has(lemma) || NUMBER_WORDS.has(lemma)) continue;
    seen.add(lemma);
    const band: Band = (cefrLevelOf(lemma) as Band | null) ?? 'OFF';
    const bandIndex = bands.indexOf(band);
    if (bandIndex < 0) continue;
    const d = dict.get(lemma);
    const rank = Math.min(d.bnc, d.frq);
    // 太生僻的不教：词频排名五万开外、或 ECDICT 根本没有词频
    if (!Number.isFinite(rank) || rank >= 50_000) continue;
    const exam = /ielts|toefl|cet6|cet4|ky/.test(d.tag) ? 1 : 0;
    // 等级段压倒一切；同段内考试词优先；再按词频取「中等偏难」—— 排名越靠后越值得教，但封顶
    const score = (bands.length - bandIndex) * 1_000_000 + exam * 100_000 + Math.min(rank, 30_000);
    scored.push({ word: lemma, score });
  }
  scored.sort((a, b) => b.score - a.score || a.word.localeCompare(b.word));
  return scored.slice(0, PER_DAY).map((s) => s.word);
}

function main() {
  if (!CSV || !fs.existsSync(CSV)) throw new Error('用法：--week=week3 --csv <ecdict.csv>');
  const dict: Map<string, any> = dictionary(CSV);
  const modules = fs
    .readdirSync(DIR)
    .filter((f) => f.endsWith('.js') && !['index.js', 'preferred-words.js', 'dates.js'].includes(f))
    .sort()
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    .map((f) => require(path.join(DIR, f)))
    .filter((m) => typeof m.LEVEL === 'string' && Array.isArray(m.DAYS));

  const out: Record<string, string[]> = {};
  for (const mod of modules) {
    for (const day of mod.DAYS) {
      out[day.source] = pick(day.passage, mod.LEVEL, dict);
      console.log(`${mod.LEVEL.padEnd(20)} ${day.source.padEnd(28)} ${out[day.source].join(' ')}`);
    }
  }
  const body = Object.entries(out)
    .map(([k, words]) => `  ${JSON.stringify(k)}: ${JSON.stringify(words)},`)
    .join('\n');
  fs.writeFileSync(
    OUT,
    `'use strict';\n\n// 由 build-auto-preferred.ts 按档位 CEFR 等级自动生成，不要手改 —— 改文章后重跑。\nmodule.exports = {\n${body}\n};\n`,
    'utf8',
  );
  console.log(`\n已写入 ${OUT}`);
}

main();
