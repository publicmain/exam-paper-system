/**
 * 从 CEFR-J Wordlist 1.5 生成 src/vocab-v2/cefr-wordlist.ts。
 *
 *   curl -sL -o .local/vendor/cefrj-1.5.csv \
 *     https://raw.githubusercontent.com/openlanguageprofiles/olp-en-cefrj/master/cefrj-vocabulary-profile-1.5.csv
 *   node apps/api/scripts/vendor/build-cefr.js
 *
 * 词表本身不进仓库（.local/ 已 gitignore），进仓库的是生成出来的 ts。
 * 数据来源 Open Language Profiles，编者 Yukio Tono（东京外国语大学）。
 */
const fs = require('fs');
const path = require('path');

const SRC = path.resolve(__dirname, '../../../../.local/vendor/cefrj-1.5.csv');
const OUT = path.resolve(__dirname, '../../src/vocab-v2/cefr-wordlist.ts');
const RANK = { A1: 1, A2: 2, B1: 3, B2: 4 };

function parseLine(line) {
  const out = [];
  let cur = '';
  let quoted = false;
  for (const ch of line) {
    if (ch === '"') { quoted = !quoted; continue; }
    if (ch === ',' && !quoted) { out.push(cur); cur = ''; continue; }
    cur += ch;
  }
  out.push(cur);
  return out;
}

const rows = fs.readFileSync(SRC, 'utf8').split(/\r?\n/).filter(Boolean).slice(1).map(parseLine);
const map = new Map();
for (const r of rows) {
  const level = String(r[2] || '').trim();
  if (!RANK[level]) continue;
  // 「a.m./A.M./am/AM」这种一格里塞多个写法的，拆开各存一份
  for (const variant of String(r[0] || '').split('/')) {
    const w = variant.trim().toLowerCase().replace(/[^a-z'\s-]/g, '').trim();
    // 只收单词。词表里还有「hot water」「get up」这类词组，它们对逐词判级没用；
    // 更要命的是下面用空格拼接存储，词组会被拆开，把 water 误标成 A2（实际 A1）。
    if (!w || w.includes(' ') || w.length > 28) continue;
    const prev = map.get(w);
    if (prev === undefined || RANK[level] < RANK[prev]) map.set(w, level);
  }
}

const byLevel = { A1: [], A2: [], B1: [], B2: [] };
for (const [w, l] of [...map.entries()].sort((a, b) => (a[0] < b[0] ? -1 : 1))) byLevel[l].push(w);

const header = `/**
 * CEFR-J Wordlist 1.5（东京外国语大学 Yukio Tono 等编）。
 *
 * 来源：https://github.com/openlanguageprofiles/olp-en-cefrj（Open Language Profiles）
 * 用途：判断一个词对某个档位是不是超纲 —— 给例句做难度闸门、给文章出难度报告。
 * 生成脚本 scripts/vendor/build-cefr.js，改词表请重跑，不要手改本文件。
 *
 * 一个词有多个词性 / 多条记录时取**最低**等级（= 最早被引入的那一级）。
 */

export type CefrLevel = 'A1' | 'A2' | 'B1' | 'B2';

export const CEFR_RANK: Readonly<Record<CefrLevel, number>> = { A1: 1, A2: 2, B1: 3, B2: 4 };

`;
const body = Object.entries(byLevel)
  .map(([l, ws]) => `const ${l} = ${JSON.stringify(ws.join(' '))}.split(' ');`)
  .join('\n\n');
const tail = `

const LEVELS: ReadonlyArray<readonly [CefrLevel, readonly string[]]> = [['A1', A1], ['A2', A2], ['B1', B1], ['B2', B2]];

const INDEX: ReadonlyMap<string, CefrLevel> = new Map(LEVELS.flatMap(([lvl, ws]) => ws.map((w) => [w, lvl] as const)));

/** 词表里有多少个词 —— 给测试和排查用。 */
export function cefrEntryCount(): number {
  return INDEX.size;
}

/**
 * 一个词的 CEFR 等级。查不到返回 null —— **查不到不等于难**：
 * 专有名词、人名地名、以及 CEFR-J 没收的词都会落到这里。
 */
export function cefrLevelOf(word: string): CefrLevel | null {
  const w = String(word ?? '').toLowerCase().replace(/[^a-z'-]/g, '');
  if (!w) return null;
  const direct = INDEX.get(w);
  if (direct) return direct;
  // 保守的形态还原：只处理最常见的规则变化，够不着的宁可返回 null。
  for (const stem of stems(w)) {
    const hit = INDEX.get(stem);
    if (hit) return hit;
  }
  return null;
}

function stems(w: string): string[] {
  const out: string[] = [];
  const add = (s: string) => { if (s.length >= 2 && s !== w) out.push(s); };
  if (w.endsWith('ies') && w.length > 4) add(w.slice(0, -3) + 'y');
  if (w.endsWith('es') && w.length > 3) add(w.slice(0, -2));
  if (w.endsWith('s') && !w.endsWith('ss')) add(w.slice(0, -1));
  if (w.endsWith('ied') && w.length > 4) add(w.slice(0, -3) + 'y');
  if (w.endsWith('ed') && w.length > 3) { add(w.slice(0, -2)); add(w.slice(0, -1)); }
  if (w.endsWith('ing') && w.length > 4) { add(w.slice(0, -3)); add(w.slice(0, -3) + 'e'); }
  if (w.endsWith('ly') && w.length > 3) add(w.slice(0, -2));
  const dbl = new RegExp('(.)' + String.fromCharCode(92) + '1(ed|ing)$');
  if (dbl.test(w)) add(w.replace(dbl, '$1'));
  return out;
}
`;
fs.writeFileSync(OUT, header + body + tail);
console.log(`写了 ${path.relative(process.cwd(), OUT)}：${map.size} 个词`);
for (const [l, ws] of Object.entries(byLevel)) console.log(`  ${l} ${ws.length}`);
