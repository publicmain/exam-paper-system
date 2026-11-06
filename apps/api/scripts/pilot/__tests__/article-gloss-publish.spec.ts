import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';

const { articleTokens } = require('../gloss/tokens');
const fp = require('../visible-fingerprint');
const prep = require('../prepare-pilot-week');
const lesson = require('../content').lessonFor('olevel', '2026-11-09');
let root: string;
let file: string;
let data: any;
beforeEach(() => {
  root = mkdtempSync(join(tmpdir(), 'article-gloss-'));
  const dir = join(root, 'week99');
  mkdirSync(join(dir, 'glosses'), { recursive: true });
  writeFileSync(join(dir, 'dates.js'), `module.exports={DATES:['2026-11-09']};`);
  writeFileSync(join(dir, 'index.js'), `module.exports={LEVELS:${JSON.stringify({ olevel: [lesson] })}};`);
  writeFileSync(join(dir, 'olevel.js'), `module.exports={DAYS:${JSON.stringify([lesson])}};`);
  data = { [lesson.source]: { title: lesson.title, glosses: Object.fromEntries(articleTokens(lesson.passage).map((key: string) => [key, { pos: 'n.', zh: '释义' }])) } };
  file = join(dir, 'glosses', 'olevel.json');
  writeFileSync(file, JSON.stringify(data));
});
afterEach(() => rmSync(root, { recursive: true, force: true }));

describe('发布释义门禁与存储', () => {
  it('发布配置含对应 source 的释义，保留 lessonWords', () => {
    const row = prep.lessonRows('olevel', lesson.date, { glossRoot: root });
    expect(row.paper.config.wordGlosses).toEqual(data[lesson.source].glosses);
    expect(row.paper.config.lessonWords).toHaveLength(12);
  });
  it('缺词拒绝生成发布卷，清楚列出档位、文章和词', () => {
    const key = articleTokens(lesson.passage)[0];
    delete data[lesson.source].glosses[key];
    writeFileSync(file, JSON.stringify(data));
    expect(() => prep.lessonRows('olevel', lesson.date, { glossRoot: root })).toThrow(new RegExp(`olevel.*${lesson.source}.*${key}`));
  });
  it('缺整篇或缺文件拒绝，不能发布时悄悄省略', () => {
    writeFileSync(file, '{}');
    expect(() => prep.lessonRows('olevel', lesson.date, { glossRoot: root })).toThrow(/没有 glosses/);
    rmSync(file);
    expect(() => prep.lessonRows('olevel', lesson.date, { glossRoot: root })).toThrow(/olevel.json/);
  });
  it('同周的另一篇缺释义也拒绝发布', () => {
    const other = { ...lesson, date: '2026-11-10', source: 'missing-other-article' };
    const index = join(root, 'week99', 'index.js');
    writeFileSync(index, `module.exports={LEVELS:${JSON.stringify({ olevel: [lesson, other] })}};`);
    delete require.cache[require.resolve(index)];
    expect(() => prep.lessonRows('olevel', lesson.date, { glossRoot: root })).toThrow(/missing-other-article/);
  });
  it('没有 glosses 目录的旧周保持原有配置', () => {
    rmSync(join(root, 'week99', 'glosses'), { recursive: true });
    expect(prep.lessonRows('olevel', lesson.date, { glossRoot: root }).paper.config).not.toHaveProperty('wordGlosses');
  });
});

describe('审查指纹包含所有 glosses JSON 文件', () => {
  it('审后改中文、词性、lemma 或新增文件都作废', () => {
    const original = fp.weekFingerprint('week99', root);
    writeFileSync(fp.approvalPath('week99', root), JSON.stringify({ fingerprint: original }));
    for (const field of ['zh', 'pos', 'lemma']) {
      const copy = JSON.parse(JSON.stringify(data));
      copy[lesson.source].glosses[articleTokens(lesson.passage)[0]][field] = 'changed';
      writeFileSync(file, JSON.stringify(copy));
      expect(fp.reviewProblem(lesson.date, { root })).toMatch(/审核之后内容又改过/);
    }
    writeFileSync(file, JSON.stringify(data));
    expect(fp.weekFingerprint('week99', root)).toBe(original);
    writeFileSync(join(root, 'week99', 'glosses', 'extra.json'), '{}');
    expect(fp.weekFingerprint('week99', root)).not.toBe(original);
  });
});

it('审查包逐条显示点词键、词性、中文与 lemma', () => {
  const { articleGlossReviewLines } = require('../gloss/bundle');
  expect(articleGlossReviewLines({ felt: { pos: 'v.', zh: '感到', lemma: 'feel' } })).toEqual([
    '--- 文章点词释义（1 个）', 'felt → v. 感到（lemma: feel）',
  ]);
});
