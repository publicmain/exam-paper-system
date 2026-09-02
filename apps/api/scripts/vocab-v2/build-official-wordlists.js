#!/usr/bin/env node

/**
 * Build the immutable vocabulary-source assets used by Vocabulary Coach V2.
 *
 * The source pages are the official NGSL Project learning dictionaries. They
 * include the authoritative frequency rank plus a learner-friendly definition,
 * part of speech and pronunciation.  The generated JSON is committed so a
 * production deploy never depends on a third-party website being online.
 */
const fs = require('node:fs/promises');
const path = require('node:path');

const SOURCES = {
  ngsl: {
    version: '1.2',
    expected: 2809,
    url: 'https://www.linguaeruditio.com/Glossary/NGSL/NGSL_gloss.html',
  },
  nawl: {
    version: '1.2',
    expected: 957,
    url: 'https://www.linguaeruditio.com/Glossary/NAWL/NAWL_gloss.html',
  },
};

function decode(value) {
  return String(value ?? '')
    .replace(/<[^>]*>/g, ' ')
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&quot;/gi, '"')
    .replace(/&#39;|&apos;/gi, "'")
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/\s+/g, ' ')
    .trim();
}

function parseRows(html, listName) {
  const rows = [];
  for (const match of html.matchAll(/<tr[^>]*>([\s\S]*?)<\/tr>/gi)) {
    const cells = [...match[1].matchAll(/<td[^>]*>([\s\S]*?)<\/td>/gi)].map((cell) => cell[1]);
    if (cells.length !== 5) continue;
    const rank = Number.parseInt(decode(cells[0]), 10);
    const headword = decode(cells[1]).toLowerCase();
    const phonetic = decode(cells[2]);
    const pos = decode(cells[3]).toLowerCase();
    // Dictionary links/icons precede the definition. Removing all tags leaves
    // only the actual learner definition because the image alt text is provider
    // names and is not included as visible text in these rows.
    const definition = decode(cells[4]);
    if (!Number.isInteger(rank) || !headword || !definition) continue;
    rows.push({ list: listName, rank, headword, phonetic, pos, definition });
  }
  rows.sort((a, b) => a.rank - b.rank || a.headword.localeCompare(b.headword));
  return rows;
}

async function main() {
  const generatedAt = new Date().toISOString();
  const payload = {
    schemaVersion: 1,
    generatedAt,
    license: 'CC BY-SA 4.0',
    attribution: 'Browne, C., Culligan, B., and Phillips, J. — New General Service List Project',
    sourceUrl: 'https://www.newgeneralservicelist.com',
    lists: {},
  };

  for (const [name, source] of Object.entries(SOURCES)) {
    const response = await fetch(source.url, { headers: { 'user-agent': 'exam-paper-system-wordlist-builder/1.0' } });
    if (!response.ok) throw new Error(`${name}: HTTP ${response.status}`);
    const rows = parseRows(await response.text(), name);
    if (rows.length !== source.expected) {
      throw new Error(`${name}: expected ${source.expected} rows, parsed ${rows.length}`);
    }
    const ranks = new Set(rows.map((row) => row.rank));
    if (ranks.size !== rows.length || Math.min(...ranks) !== 1 || Math.max(...ranks) !== source.expected) {
      throw new Error(`${name}: ranks are not a complete 1..${source.expected} sequence`);
    }
    payload.lists[name] = { version: source.version, source: source.url, words: rows };
  }

  const output = path.resolve(__dirname, '../../src/vocab-v2/data/official-wordlists.generated.json');
  await fs.mkdir(path.dirname(output), { recursive: true });
  await fs.writeFile(output, `${JSON.stringify(payload, null, 2)}\n`, 'utf8');
  process.stdout.write(`wrote ${output}: NGSL ${payload.lists.ngsl.words.length}, NAWL ${payload.lists.nawl.words.length}\n`);
}

main().catch((error) => {
  process.stderr.write(`${error.stack || error}\n`);
  process.exitCode = 1;
});
