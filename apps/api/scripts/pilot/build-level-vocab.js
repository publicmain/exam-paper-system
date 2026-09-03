/**
 * Build the committed teaching-word metadata for the two restored pilot levels.
 *
 * Source text is the repository's own original fixture bank. Dictionary metadata
 * comes from ECDICT (MIT); the generated JSON is committed so publishing a lesson
 * never depends on the network or on a developer machine having the CSV.
 *
 * Usage:
 *   node scripts/pilot/build-level-vocab.js --csv C:/path/to/ecdict.csv
 */
'use strict';

const fs = require('fs');
const path = require('path');

const API_ROOT = path.resolve(__dirname, '..', '..');
const LIGHT_DIR = path.join(API_ROOT, 'test-fixtures', 'ielts-light-2026');
const INTERMEDIATE_DIR = path.join(API_ROOT, 'test-fixtures', 'singapore-olevel-1128');
const OUT = path.join(__dirname, 'content', 'fixture-vocab.generated.json');

const LIGHT = [
  'light-01-city-bees.json',
  'light-02-night-shift-sleep.json',
  'light-03-plastic-roads.json',
  'light-04-lost-languages.json',
  'light-05-vertical-farms.json',
];
const INTERMEDIATE = [
  'ai-authored-25-hawker-auntie-simplified.json',
  'ai-authored-22-macritchie-frog-simplified.json',
  'ai-authored-21-drawing-simplified.json',
  'ai-authored-18-library-card-simplified.json',
  'ai-authored-17-relay-simplified.json',
];

const LIGHT_PREFERRED = {
  'light-01-city-bees.json': ['orchard', 'overturn', 'hive', 'farmland', 'patchwork', 'bloom', 'absorb', 'nectar', 'pesticide', 'weaken', 'inspect', 'urban', 'pavement', 'emerge', 'species'],
  'light-02-night-shift-sleep.json': ['cluster', 'internal', 'alert', 'rhythm', 'hormone', 'melatonin', 'conflict', 'digestive', 'minority', 'adjust', 'rotate', 'nudge', 'colleague', 'curtain', 'illness'],
  'light-03-plastic-roads.json': ['asphalt', 'mixture', 'refine', 'gravel', 'dispose', 'waste', 'engineer', 'combine', 'shred', 'flake', 'binder', 'pothole', 'resistance', 'objection', 'fragment'],
  'light-04-lost-languages.json': ['linguist', 'estimate', 'generation', 'chain', 'vanish', 'abandon', 'gradual', 'voluntary', 'sensible', 'vocabulary', 'botanist', 'revive', 'preserve', 'fluency', 'endanger'],
  'light-05-vertical-farms.json': ['warehouse', 'lettuce', 'tray', 'stack', 'dissolve', 'nutrient', 'wavelength', 'vertical', 'footprint', 'absorb', 'consume', 'fraction', 'fossil', 'conventional', 'supplement'],
};

const INTERMEDIATE_PREFERRED = {
  'ai-authored-25-hawker-auntie-simplified.json': ['hawker', 'weekday', 'stall', 'signboard', 'peel', 'recite', 'memory', 'faded', 'apron', 'scoop', 'container', 'quietly', 'promise', 'counter', 'realise'],
  'ai-authored-22-macritchie-frog-simplified.json': ['reservoir', 'fieldwork', 'gather', 'forest', 'visitor', 'suspension', 'sway', 'railing', 'thumbnail', 'whisper', 'steal', 'gently', 'nudge', 'bush'],
  'ai-authored-21-drawing-simplified.json': ['painting', 'announce', 'mural', 'exhibition', 'choose', 'mailbox', 'corridor', 'neat', 'beneath', 'label', 'clipboard', 'swap', 'smooth', 'chopstick'],
  'ai-authored-18-library-card-simplified.json': ['ordinary', 'borrow', 'crowded', 'wallet', 'slip', 'realise', 'cushion', 'due', 'interchange', 'drawer', 'shrug', 'briefly', 'stranger', 'invisible', 'embarrass'],
  'ai-authored-17-relay-simplified.json': ['sport', 'relay', 'overseas', 'runner', 'kindly', 'refuse', 'politely', 'ceiling', 'awake', 'baton', 'grip', 'breathe', 'overtake', 'effort', 'impossible'],
};

const STOP = new Set(`about above after again against almost along already also although always among another
around because before being below between both could country day does doing down each either enough even every
first from further have having here herself himself into itself just many might more most much must neither never
other otherwise ourselves over rather really same should since some still such than that their theirs them themselves
then there these they this those through too under until very what when where which while who whom why will with would
year years your yours people said says only once one two three four five six seven eight nine ten school students
teacher class paragraph answer question singapore`.split(/\s+/));

// Grammatically useful, but too common to spend one of a short teaching queue on.
for (const word of `something different available without nothing produce several security problem morning system
during little building whether suggest number serious appear better national decision however process century second
small power water anything central thought think house large today father centre across change paper probably remember
mother outside moment ground leave bring yesterday student person behind thing education actually though result public`
  .split(/\s+/)) STOP.add(word);

for (const word of `back black blue break cause clear come east event find friend future government great green help
human less level matter middle night past quick race raise remain release speak staff support week white worker world`
  .split(/\s+/)) STOP.add(word);

function parseCsv(text) {
  const rows = [];
  let field = '';
  let row = [];
  let quoted = false;
  for (let i = 0; i < text.length; i += 1) {
    const ch = text[i];
    if (quoted) {
      if (ch === '"') {
        if (text[i + 1] === '"') { field += '"'; i += 1; }
        else quoted = false;
      } else field += ch;
      continue;
    }
    if (ch === '"') { quoted = true; continue; }
    if (ch === ',') { row.push(field); field = ''; continue; }
    if (ch === '\n') { row.push(field); rows.push(row); row = []; field = ''; continue; }
    if (ch !== '\r') field += ch;
  }
  if (field || row.length) { row.push(field); rows.push(row); }
  return rows;
}

function dictionary(csvPath) {
  const rows = parseCsv(fs.readFileSync(csvPath, 'utf8'));
  const header = rows.shift();
  const at = Object.fromEntries(header.map((v, i) => [v, i]));
  const out = new Map();
  for (const row of rows) {
    const word = String(row[at.word] || '').toLowerCase();
    const phonetic = String(row[at.phonetic] || '').trim();
    const definition = String(row[at.definition] || '').trim();
    const translation = String(row[at.translation] || '').replace(/\\n/g, '；').trim();
    if (!/^[a-z][a-z-]{2,19}$/.test(word) || !phonetic || definition.length < 11 || !/[一-鿿]/.test(translation)) continue;
    out.set(word, {
      word,
      phonetic: `/${phonetic.replace(/^\/+|\/+$/g, '')}/`,
      definition,
      translation,
      pos: String(row[at.pos] || '').trim(),
      bnc: Number(row[at.bnc] || 999999) || 999999,
      frq: Number(row[at.frq] || 999999) || 999999,
      tag: String(row[at.tag] || ''),
      collins: Number(row[at.collins] || 0),
      oxford: String(row[at.oxford] || ''),
    });
  }
  return out;
}

function sentences(passage) {
  return passage
    .replace(/^Paragraph \d+\s*/gm, '')
    .split(/\n\s*\n/)
    .flatMap((p) => p.match(/[^.!?]+[.!?]/g) || [p])
    .map((s) => s.trim())
    .filter(Boolean);
}

function surfaceIn(sentence, word) {
  const m = sentence.match(new RegExp(`\\b${word.replace(/-/g, '[- ]')}\\b`, 'i'));
  return m ? m[0] : null;
}

function lemmaCandidates(surface) {
  const word = surface.toLowerCase();
  const out = [word];
  if (word.endsWith('ies') && word.length > 4) out.push(`${word.slice(0, -3)}y`);
  if (word.endsWith('ves') && word.length > 4) out.push(`${word.slice(0, -3)}f`, `${word.slice(0, -3)}fe`);
  if (word.endsWith('ing') && word.length > 5) {
    const root = word.slice(0, -3);
    out.push(root, `${root}e`);
    if (root.length > 2 && root.at(-1) === root.at(-2)) out.push(root.slice(0, -1));
  }
  if (word.endsWith('ied') && word.length > 4) out.push(`${word.slice(0, -3)}y`);
  if (word.endsWith('ed') && word.length > 4) {
    const root = word.slice(0, -2);
    out.push(root, `${root}e`);
    if (root.length > 2 && root.at(-1) === root.at(-2)) out.push(root.slice(0, -1));
  }
  if (word.endsWith('es') && word.length > 4) out.push(word.slice(0, -2), word.slice(0, -1));
  if (word.endsWith('s') && word.length > 3) out.push(word.slice(0, -1));
  return [...new Set(out)];
}

function posOf(entry) {
  if (entry.pos) return entry.pos.endsWith('.') ? entry.pos : `${entry.pos}.`;
  const m = entry.translation.match(/^(n|v|vi|vt|adj|adv|prep|conj|pron|num)\./i);
  return m ? `${m[1].toLowerCase()}.` : 'word.';
}

function choose(passage, dict, preferred, count) {
  const ss = sentences(passage);
  const seen = new Set();
  const rows = [];
  const candidates = [];
  for (const sentence of ss) {
    for (const match of sentence.matchAll(/[A-Za-z][A-Za-z-]{2,19}/g)) {
      const surface = match[0];
      const lemmas = lemmaCandidates(surface).filter((candidate) => dict.has(candidate));
      const word = lemmas.find((candidate) => preferred.includes(candidate)) ?? lemmas[0];
      if (!word || STOP.has(word) || seen.has(word)) continue;
      seen.add(word);
      const d = dict.get(word);
      const preferredIndex = preferred.indexOf(word);
      const examTag = /ielts|toefl|cet4|cet6|zk|gk/.test(d.tag) ? 1 : 0;
      const rank = Math.min(d.bnc, d.frq);
      const rarity = Number.isFinite(rank) && rank < 999999 ? Math.min(rank, 50_000) : 0;
      const score = (preferredIndex >= 0 ? 1_000_000 - preferredIndex : 0)
        + examTag * 100_000 + d.collins * 10_000 + (d.oxford ? 50_000 : 0)
        + Math.min(word.length, 12) * 500 + rarity;
      candidates.push({ word, sentence, surface, d, score });
    }
  }
  candidates.sort((a, b) => b.score - a.score || a.word.localeCompare(b.word));
  for (const c of candidates.slice(0, count)) {
    rows.push({
      headword: c.word,
      surfaceForm: c.surface,
      phonetic: c.d.phonetic,
      pos: posOf(c.d),
      translation: c.d.translation,
      definition: c.d.definition,
      context: c.sentence,
    });
  }
  if (rows.length !== count) throw new Error(`Only found ${rows.length}/${count} words`);
  return rows;
}

function loadIntermediate(file) {
  const raw = JSON.parse(fs.readFileSync(path.join(INTERMEDIATE_DIR, file), 'utf8'));
  return { passage: raw.sections[0].passage, preferred: INTERMEDIATE_PREFERRED[file] };
}

function loadLight(file) {
  const raw = JSON.parse(fs.readFileSync(path.join(LIGHT_DIR, file), 'utf8'));
  return { passage: raw.passage, preferred: LIGHT_PREFERRED[file] };
}

/**
 * 命令行入口。**只在直接执行本文件时跑** —— 首发周的
 * `build-week2-vocab.js` 要复用上面的 `dictionary` / `choose`，
 * 而 require 一个会顺手写文件的模块是不能接受的。
 */
function main() {
  const arg = process.argv.find((a) => a.startsWith('--csv='));
  const split = process.argv.indexOf('--csv');
  const csv = arg ? arg.slice(6) : split >= 0 ? process.argv[split + 1] : '';
  if (!csv || !fs.existsSync(csv)) throw new Error('Pass --csv <ecdict.csv>');
  const dict = dictionary(csv);
  const output = { ielts_light: {}, olevel_intermediate: {} };
  for (const file of LIGHT) {
    const x = loadLight(file);
    output.ielts_light[file] = choose(x.passage, dict, x.preferred, 12);
  }
  for (const file of INTERMEDIATE) {
    const x = loadIntermediate(file);
    output.olevel_intermediate[file] = choose(x.passage, dict, x.preferred, 12);
  }
  fs.writeFileSync(OUT, `${JSON.stringify(output, null, 2)}\n`, 'utf8');
  console.log(`wrote ${OUT}: ${LIGHT.length + INTERMEDIATE.length} lessons / 120 teaching words`);
}

if (require.main === module) main();

module.exports = { dictionary, choose, sentences, posOf, STOP, parseCsv };
