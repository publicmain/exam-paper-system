/**
 * 「找细节 / 原文填空」类题目的算法草稿（2026-09-11）。
 *
 *   npx ts-node apps/api/scripts/content/draft-gapfill.ts --week=week3 --level=olevel --date=2026-09-14 \
 *     [--csv <ecdict.csv>] [--count=6]
 *
 * 出的是**草稿**，不是题：每一条都要人读一遍再决定用不用、怎么改。它省掉的
 * 是「在文章里找一句合适的、挑一个该挖的词、配三个同词性干扰项」这段机械活；
 * 推理题、理解题它出不了，也不该让它出 —— 零 Anthropic 调用，这里没有任何
 * 模型参与，只有规则。
 *
 * ## 挑哪句、挖哪个词
 *
 *   · 句子 8–30 个词，不是段落第一句（第一句常是背景，挖掉了没有上下文）；
 *   · 挖的词：本档应该学的等级（与 build-auto-preferred 同一张等级表），
 *     全文**只出现一次**（出现两次学生能从另一处抄），不是专名、不是数字；
 *   · 干扰项：优先取同一篇里**同词性**的其它词（给了 ECDICT 才知道词性），
 *     没有就取同一篇里其它候选词。同义词是危险干扰项 —— 脚本不认得同义词，
 *     这一条靠人审。
 *
 * 输出可以直接粘进档位模块的 `questions` 数组（`kind: 'gapChoice'`）。
 */
import * as fs from 'fs';
import * as path from 'path';
import { tokenize } from '../../src/vocab-v2/cefr-difficulty';
import { cefrLevelOf } from '../../src/vocab-v2/cefr-wordlist';

const arg = (name: string) => {
  const eq = process.argv.find((a) => a.startsWith(`--${name}=`));
  if (eq) return eq.slice(name.length + 3);
  const i = process.argv.indexOf(`--${name}`);
  return i >= 0 ? process.argv[i + 1] : undefined;
};
const WEEK = arg('week') ?? 'week3';
const LEVEL = arg('level') ?? '';
const DATE = arg('date') ?? '';
const CSV = arg('csv');
const COUNT = Number(arg('count') ?? 6);

const BANDS: Record<string, Array<string | null>> = {
  ielts_simplified: ['A2', 'B1'],
  olevel_intermediate: ['B1', 'B2', null],
  olevel: ['B2', 'B1', null],
  ielts_light: [null, 'B2'],
  ielts_authentic: [null, 'B2'],
};

const STOP = new Set(
  'about above after again against along also although always among another around because before behind being below between both cannot could does doing during each either every from have having into itself might more most much must never other ought over same should since some such than that their them then there these they this those through under until upon very were what when where which while whom whose will with within without would your'.split(
    ' ',
  ),
);

type Day = { date: string; title: string; passage: string };

function sentencesWithParagraph(passage: string) {
  const out: Array<{ sentence: string; first: boolean }> = [];
  for (const block of passage.split(/\n\s*\n/)) {
    const body = block.replace(/^Paragraph \S+\s*/, '').trim();
    const parts = body.match(/[^.!?]+[.!?]["”']?/g) ?? [body];
    parts.forEach((s, i) => out.push({ sentence: s.trim(), first: i === 0 }));
  }
  return out;
}

/** 粗词形还原，只为查词性：shredded → shred、printers → printer。 */
function lemmas(word: string): string[] {
  const w = word.toLowerCase();
  const out = [w];
  if (w.endsWith('ied')) out.push(`${w.slice(0, -3)}y`);
  if (w.endsWith('ed')) out.push(w.slice(0, -2), w.slice(0, -1), w.slice(0, -3));
  if (w.endsWith('ing')) out.push(w.slice(0, -3), `${w.slice(0, -3)}e`, w.slice(0, -4));
  if (w.endsWith('ies')) out.push(`${w.slice(0, -3)}y`);
  if (w.endsWith('es')) out.push(w.slice(0, -2));
  if (w.endsWith('s')) out.push(w.slice(0, -1));
  return out;
}

function posOf(word: string, dict: Map<string, string> | null): string | null {
  if (!dict) return null;
  const hit = lemmas(word).find((l) => dict.has(l));
  const tr = hit ? dict.get(hit) : undefined;
  return tr?.match(/^(n|v|vt|vi|adj|a|adv|ad)\./)?.[1]?.replace(/^(vt|vi)$/, 'v').replace(/^a$/, 'adj').replace(/^ad$/, 'adv') ?? null;
}

function loadDict(csv: string): Map<string, string> {
  const text = fs.readFileSync(csv, 'utf8');
  const lines = text.split(/\r?\n/);
  const header = lines[0].split(',');
  const wi = header.indexOf('word');
  const ti = header.indexOf('translation');
  const out = new Map<string, string>();
  for (const line of lines.slice(1)) {
    // ECDICT 的逗号分隔里有引号字段；这里只要前几列，粗切够用
    const cells = line.match(/("([^"]|"")*"|[^,]*)(,|$)/g)?.map((c) => c.replace(/,$/, '').replace(/^"|"$/g, '')) ?? [];
    const w = (cells[wi] ?? '').toLowerCase();
    if (/^[a-z][a-z-]{2,}$/.test(w)) out.set(w, (cells[ti] ?? '').replace(/\\n/g, ' '));
  }
  return out;
}

(() => {
  if (!LEVEL || !DATE) throw new Error('用法：--week=week3 --level=<档位> --date=YYYY-MM-DD [--csv <ecdict.csv>]');
  const bands = BANDS[LEVEL];
  if (!bands) throw new Error(`不认识的档位：${LEVEL}`);
  const file = path.resolve(__dirname, '..', 'pilot', 'content', WEEK, `${LEVEL}.js`);
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const day = (require(file).DAYS as Day[]).find((d) => d.date === DATE);
  if (!day) throw new Error(`${LEVEL} 没有 ${DATE}`);
  const dict = CSV ? loadDict(CSV) : null;

  const text = day.passage.replace(/^Paragraph \S+\s*/gm, '');
  const counts = new Map<string, number>();
  const proper = new Set<string>();
  for (const t of tokenize(text)) {
    counts.set(t.word, (counts.get(t.word) ?? 0) + 1);
    if (t.properNoun) proper.add(t.word);
  }
  // 句首大写的专名（Singapore 只出现在句首）tokenize 认不出：全文从没以小写出现过的，一律当专名
  for (const w of counts.keys()) {
    if (!new RegExp(`\\b${w}\\b`).test(text)) proper.add(w);
  }
  const candidates: Array<{ word: string; sentence: string; band: number }> = [];
  for (const { sentence, first } of sentencesWithParagraph(day.passage)) {
    const n = sentence.split(/\s+/).length;
    if (first || n < 8 || n > 30) continue;
    for (const t of tokenize(sentence)) {
      const w = t.word;
      if (t.properNoun || proper.has(w) || w.length < 4 || /\d|'|-/.test(w) || STOP.has(w)) continue;
      if ((counts.get(w) ?? 0) !== 1) continue;
      const band = bands.indexOf(cefrLevelOf(w));
      if (band < 0) continue;
      candidates.push({ word: w, sentence, band });
    }
  }
  candidates.sort((a, b) => a.band - b.band || b.word.length - a.word.length);
  const usedSentences = new Set<string>();
  const drafts = [];
  for (const c of candidates) {
    if (usedSentences.has(c.sentence)) continue;
    const pos = posOf(c.word, dict);
    const pool = candidates.filter((o) => o.word !== c.word).map((o) => o.word);
    const samePos = pos ? pool.filter((w) => posOf(w, dict) === pos) : [];
    // 本档候选词里同词性的不够，就放宽到全文任意同词性实词（等级不限）
    const anySamePos = pos
      ? [...counts.keys()].filter(
          (w) => w !== c.word && !proper.has(w) && w.length >= 4 && !/\d|'|-/.test(w) && !STOP.has(w) && posOf(w, dict) === pos,
        )
      : [];
    const distractors = [...new Set([...samePos, ...anySamePos, ...pool])].slice(0, 3);
    if (distractors.length < 3) continue;
    usedSentences.add(c.sentence);
    const stem = c.sentence.replace(new RegExp(`\\b${c.word}\\b`, 'i'), '______');
    drafts.push({ kind: 'gapChoice', stem, answer: c.word, distractors, evidence: c.sentence });
    if (drafts.length >= COUNT) break;
  }
  console.log(`// ${LEVEL} ${DATE} ${day.title} —— ${drafts.length} 条草稿（${dict ? '干扰项按词性配' : '没给 ECDICT，干扰项未按词性配'}）`);
  console.log('// 逐条审：挖掉的词值不值得考？干扰项里有没有同义词？题干要不要改写成不照抄原句？');
  console.log(JSON.stringify(drafts, null, 2));
})();
