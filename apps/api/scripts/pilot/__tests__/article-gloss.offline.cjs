// 沙箱不能启动 Vitest 子进程时：node apps/api/scripts/pilot/__tests__/article-gloss.offline.cjs
// Node 内置测试运行器 + 实际服务（TypeScript 仅在内存转译），不连库、不调用翻译服务。
'use strict';
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const ts = require('typescript');
const apiRoot = path.resolve(__dirname, '../../..');
const originalLoader = require.extensions['.ts'];
require.extensions['.ts'] = (module, filename) => {
  if (!filename.startsWith(path.join(apiRoot, 'src', 'vocab') + path.sep)) throw new Error(`Unexpected TypeScript import: ${filename}`);
  module._compile(ts.transpileModule(fs.readFileSync(filename, 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, experimentalDecorators: true },
    fileName: filename,
  }).outputText, filename);
};
const { VocabService } = require(path.join(apiRoot, 'src/vocab/vocab.service.ts'));
const tokens = require(path.join(apiRoot, 'src/vocab/article-gloss.ts'));
if (originalLoader) require.extensions['.ts'] = originalLoader;
else delete require.extensions['.ts'];
const bundle = require('../gloss/bundle');
const prep = require('../prepare-pilot-week');
const fp = require('../visible-fingerprint');
const { applyGlosses, connectionUrl } = require('../gloss/apply-glosses');
const jsTokens = require('../gloss/tokens');
const sentence = 'We felt ready.';
const glosses = { we: { pos: 'pron.', zh: '我们' }, felt: { pos: 'v.', zh: '感到', lemma: 'feel' }, ready: { pos: 'adj.', zh: '准备好的' } };

function lookupFixture(config = { wordGlosses: glosses }) {
  const calls = { papers: [], dict: [], wordTranslation: [], sentenceTranslation: [] };
  const row = { word: 'felt', phonetic: 'felt', translation: '词典中文', definition: 'dictionary definition', pos: 'v.', tag: ['zk'] };
  const prisma = {
    paper: { async findMany(args) { calls.papers.push(args); return [{ config, questions: [{ snapshotContent: { passage: sentence }, overrideContent: null }] }]; } },
    dictEntry: {
      async findMany(args) { calls.dict.push(args); return [row]; },
      async findUnique(args) { calls.dict.push(args); return row; },
    },
  };
  const realtime = {
    async translate(text) { calls.wordTranslation.push(text); return '远程中文'; },
    async translateDetailed(text) { calls.sentenceTranslation.push(text); return { text: '我们准备好了。', status: 'ok', retryable: false }; },
  };
  return { svc: new VocabService(prisma, realtime), calls, prisma };
}

test('gloss lookup uses reviewed text; dictionary access selects phonetics only', async () => {
  const { svc, calls } = lookupFixture();
  const hit = await svc.lookup('Felt,', 'We\n felt ready.');
  assert.deepEqual(hit, { word: 'feel', query: 'Felt,', translation: '感到', pos: 'v.', definition: null,
    phonetic: 'felt', collins: null, oxford: false, tag: [], via: 'gloss', contextTranslation: '我们准备好了。' });
  assert.deepEqual(calls.dict[0].select, { word: true, phonetic: true });
  assert.deepEqual(calls.wordTranslation, []);
});

test('missing word, empty table and malformed table never fall back', async () => {
  for (const wordGlosses of [{}, { felt: { pos: 'v.', zh: '' } }, null, []]) {
    const { svc, calls } = lookupFixture({ wordGlosses });
    assert.equal(await svc.lookup('felt', sentence), null);
    assert.deepEqual(calls.dict, []);
    assert.deepEqual(calls.wordTranslation, []);
    assert.deepEqual(calls.sentenceTranslation, []);
  }
});

test('old articles, unmatched sentences and no-context lookups retain dictionary behavior', async () => {
  for (const [config, context] of [[{}, sentence], [{ wordGlosses: glosses }, 'Another text.'], [{ wordGlosses: glosses }, undefined]]) {
    const { svc } = lookupFixture(config);
    const hit = await svc.lookup('felt', context);
    assert.equal(hit.via, 'direct');
    assert.equal(hit.translation, '词典中文');
  }
});

test('cache refreshes after ten minutes and only queries recent published unarchived papers', async () => {
  const { svc, calls } = lookupFixture({ wordGlosses: {} });
  const now = Date.now();
  const originalNow = Date.now;
  try {
    Date.now = () => now;
    await svc.lookup('felt', sentence);
    await svc.lookup('felt', sentence);
    assert.equal(calls.papers.length, 1);
    assert.deepEqual(calls.papers[0].where, { status: 'published', archivedAt: null, createdAt: { gte: new Date(now - 60 * 86_400_000) } });
    Date.now = () => now + 600_001;
    await svc.lookup('felt', sentence);
    assert.equal(calls.papers.length, 2);
  } finally { Date.now = originalNow; }
});

test('database error fails closed, with no dictionary or translation fallback', async () => {
  const { svc, calls, prisma } = lookupFixture();
  prisma.paper.findMany = async () => { throw new Error('offline'); };
  await assert.rejects(svc.lookup('felt', sentence), /offline/);
  assert.deepEqual(calls.dict, []);
  assert.deepEqual(calls.wordTranslation, []);
});

test('TypeScript and canonical JS agree for all 25 week11 passages and every raw token', () => {
  const { LEVELS } = require('../content/week11');
  let count = 0;
  for (const days of Object.values(LEVELS)) for (const day of days) {
    count++;
    assert.deepEqual(tokens.articleTokens(day.passage), jsTokens.articleTokens(day.passage));
    for (const match of day.passage.matchAll(jsTokens.WORD_RE)) assert.equal(tokens.glossKey(match[0]), jsTokens.glossKey(match[0]));
    for (const raw of day.passage.split(/\s+/)) assert.equal(tokens.glossKey(raw), jsTokens.glossKey(raw));
  }
  assert.equal(count, 25);
  for (const raw of [null, undefined, '', 'Ｓｉｎｇａｐｏｒｅ’s', '‘Teacher’s’', "students'", 'time-saving', 'ʼwordʼ']) {
    assert.equal(tokens.glossKey(raw), jsTokens.glossKey(raw));
  }
});

function weekFixture() {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'article-gloss-offline-'));
  const dir = path.join(root, 'week99');
  fs.mkdirSync(path.join(dir, 'glosses'), { recursive: true });
  const realLesson = require('../content').lessonFor('olevel', '2026-11-09');
  const levelData = { [realLesson.source]: { title: realLesson.title,
    glosses: Object.fromEntries(jsTokens.articleTokens(realLesson.passage).map((key) => [key, { pos: 'n.', zh: '释义' }])) } };
  const index = path.join(dir, 'index.js');
  const file = path.join(dir, 'glosses', 'olevel.json');
  fs.writeFileSync(index, `module.exports={LEVELS:${JSON.stringify({ olevel: [realLesson] })}};`);
  fs.writeFileSync(path.join(dir, 'dates.js'), `module.exports={DATES:['2026-11-09']};`);
  fs.writeFileSync(file, JSON.stringify(levelData));
  return { root, dir, index, file, levelData, realLesson, cleanup: () => fs.rmSync(root, { recursive: true, force: true }) };
}

test('publish includes glosses; missing words, articles and files reject; old weeks stay unchanged', () => {
  const f = weekFixture();
  try {
    const plan = () => prep.lessonRows('olevel', '2026-11-09', { glossRoot: f.root });
    assert.deepEqual(plan().paper.config.wordGlosses, f.levelData[f.realLesson.source].glosses);
    assert.equal(plan().paper.config.lessonWords.length, 12);
    const first = jsTokens.articleTokens(f.realLesson.passage)[0];
    delete f.levelData[f.realLesson.source].glosses[first];
    fs.writeFileSync(f.file, JSON.stringify(f.levelData));
    assert.throws(plan, new RegExp(`${f.realLesson.source}.*${first}`));
    fs.writeFileSync(f.file, '{}');
    assert.throws(plan, /没有 glosses/);
    fs.rmSync(f.file);
    assert.throws(plan, /olevel.json/);
    fs.rmSync(path.join(f.dir, 'glosses'), { recursive: true });
    assert.equal(Object.hasOwn(plan().paper.config, 'wordGlosses'), false);
  } finally { f.cleanup(); }
});

test('another article missing glosses blocks publication of the whole week', () => {
  const f = weekFixture();
  try {
    fs.writeFileSync(f.index, `module.exports={LEVELS:${JSON.stringify({ olevel: [f.realLesson, { ...f.realLesson, source: 'missing-second' }] })}};`);
    delete require.cache[require.resolve(f.index)];
    assert.throws(() => bundle.loadWeekGlosses('week99', f.root), /missing-second/);
  } finally { f.cleanup(); }
});

test('changing any gloss field or adding a gloss file invalidates review approval', () => {
  const f = weekFixture();
  try {
    const before = fp.weekFingerprint('week99', f.root);
    fs.writeFileSync(fp.approvalPath('week99', f.root), JSON.stringify({ fingerprint: before }));
    for (const field of ['zh', 'pos', 'lemma']) {
      const copy = structuredClone(f.levelData);
      copy[f.realLesson.source].glosses[jsTokens.articleTokens(f.realLesson.passage)[0]][field] = 'changed';
      fs.writeFileSync(f.file, JSON.stringify(copy));
      assert.match(fp.reviewProblem('2026-11-09', { root: f.root }), /审核之后内容又改过/);
    }
    fs.writeFileSync(f.file, JSON.stringify(f.levelData));
    assert.equal(fp.weekFingerprint('week99', f.root), before);
    fs.writeFileSync(path.join(f.dir, 'glosses', 'extra.json'), '{}');
    assert.notEqual(fp.weekFingerprint('week99', f.root), before);
    assert.deepEqual(bundle.articleGlossReviewLines({ felt: glosses.felt }), ['--- 文章点词释义（1 个）', 'felt → v. 感到（lemma: feel）']);
  } finally { f.cleanup(); }
});

function transactionalFixture(f, badBody = false, failSecondUpdate = false) {
  const days = [f.realLesson, { ...f.realLesson, date: '2026-11-10', source: 'article-two' }];
  fs.writeFileSync(f.index, `module.exports={LEVELS:${JSON.stringify({ olevel: days })}};`);
  delete require.cache[require.resolve(f.index)];
  fs.writeFileSync(f.file, JSON.stringify({ ...f.levelData, 'article-two': f.levelData[f.realLesson.source] }));
  // 与真实发布相同的指纹门禁；测试从不修改真实周的审核记录。
  fs.writeFileSync(path.join(f.dir, 'dates.js'), `module.exports={DATES:['2026-11-09','2026-11-10']};`);
  fs.writeFileSync(fp.approvalPath('week99', f.root), JSON.stringify({ fingerprint: fp.weekFingerprint('week99', f.root) }));
  const rows = days.map((day, i) => ({ id: prep.idsFor('olevel', day.date).paperId, name: day.title, status: 'published',
    config: { level: 'olevel', lessonWords: [{ keep: true }], custom: 'keep' },
    questions: [{ snapshotContent: { passage: badBody && i === 1 ? 'Wrong text.' : day.passage }, overrideContent: null }],
  }));
  const before = structuredClone(rows);
  const updates = [];
  let committed = false;
  const prisma = { async $transaction(callback) {
    const snapshot = structuredClone(rows);
    try {
      const result = await callback({
        async $queryRaw() { return []; },
        paper: { async findUnique({ where }) { return rows.find((row) => row.id === where.id); } },
        async $executeRaw(strings, json, id) {
          updates.push(strings.join('?'));
          if (failSecondUpdate && updates.length === 2) throw new Error('second update failed');
          rows.find((row) => row.id === id).config.wordGlosses = JSON.parse(json);
          return 1;
        },
      });
      committed = true;
      return result;
    } catch (error) { rows.splice(0, rows.length, ...snapshot); throw error; }
  } };
  return { prisma, rows, before, updates, isCommitted: () => committed };
}

test('default apply runs writes then rolls back, prints every paper and preserves all data', async () => {
  const f = weekFixture();
  try {
    const db = transactionalFixture(f);
    const logs = [];
    const result = await applyGlosses(db.prisma, 'week99', { root: f.root, log: (s) => logs.push(s) });
    assert.equal(result.committed, false);
    assert.equal(db.isCommitted(), false);
    assert.equal(db.updates.length, 2);
    assert.deepEqual(db.rows, db.before);
    for (const paper of db.rows) assert.ok(logs.some((line) => line.includes(paper.id) && line.includes('个点词释义')));
  } finally { f.cleanup(); }
});

test('commit only replaces wordGlosses; no updatedAt, titles, questions or other config changes', async () => {
  const f = weekFixture();
  try {
    const db = transactionalFixture(f);
    const result = await applyGlosses(db.prisma, 'week99', { root: f.root, commit: true, log: () => {} });
    assert.equal(result.committed, true);
    assert.equal(db.isCommitted(), true);
    db.rows.forEach((row, i) => assert.deepEqual(row, { ...db.before[i], config: { ...db.before[i].config, wordGlosses: f.levelData[f.realLesson.source].glosses } }));
    for (const sql of db.updates) { assert.match(sql, /SET "config" = jsonb_set/); assert.doesNotMatch(sql, /updatedAt|"name"\s*=/); }
  } finally { f.cleanup(); }
});

test('mismatched body refuses the batch before writing; a later write failure rolls the batch back', async () => {
  for (const badBody of [true, false]) {
    const f = weekFixture();
    try {
      const db = transactionalFixture(f, badBody, !badBody);
      await assert.rejects(applyGlosses(db.prisma, 'week99', { root: f.root, commit: true, log: () => {} }), badBody ? /正文/ : /second update failed/);
      assert.deepEqual(db.rows, db.before);
      assert.equal(db.isCommitted(), false);
      assert.equal(db.updates.length, badBody ? 0 : 2);
    } finally { f.cleanup(); }
  }
});

test('unreviewed glosses cannot commit; connection uses PUBLIC_URL and forces one connection', async () => {
  const f = weekFixture();
  try {
    const db = transactionalFixture(f);
    fs.writeFileSync(f.file, JSON.stringify({ ...f.levelData, 'article-two': f.levelData[f.realLesson.source], 'unreviewed': {} }));
    await assert.rejects(applyGlosses(db.prisma, 'week99', { root: f.root, commit: true, log: () => {} }), /多出来/);
    assert.equal(db.updates.length, 0);
    const url = new URL(connectionUrl({ DATABASE_PUBLIC_URL: 'postgresql://local/test?connection_limit=99', DATABASE_URL: 'postgresql://other/test' }));
    assert.equal(url.hostname, 'local');
    assert.equal(url.searchParams.get('connection_limit'), '1');
  } finally { f.cleanup(); }
});
