import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';

let root: string;
const day = { date: '2026-09-01', source: 'article-one', title: 'Ready', passage: 'We felt ready.' };
const second = { ...day, date: '2026-09-02', source: 'article-two', title: 'Again' };
const glosses = { we: { pos: 'pron.', zh: '我们' }, felt: { pos: 'v.', zh: '感到', lemma: 'feel' }, ready: { pos: 'adj.', zh: '准备好的' } };
beforeEach(() => {
  root = mkdtempSync(join(tmpdir(), 'apply-glosses-'));
  mkdirSync(join(root, 'week99', 'glosses'), { recursive: true });
  writeFileSync(join(root, 'week99', 'index.js'), `module.exports={LEVELS:{olevel:${JSON.stringify([day, second])}}};`);
  writeFileSync(join(root, 'week99', 'glosses', 'olevel.json'), JSON.stringify({
    [day.source]: { title: day.title, glosses }, [second.source]: { title: second.title, glosses },
  }));
});
afterEach(() => rmSync(root, { recursive: true, force: true }));

/** 事务替身实际执行更新并在异常时恢复数据，验证演练靠回滚而非忽略写入。 */
function database(badPassage = false) {
  const papers = [day, second].map((lesson, i) => ({
    id: `p1_olevel_${lesson.date.replace(/-/g, '')}_paper`, name: lesson.title, status: 'published',
    config: { level: 'olevel', lessonWords: [{ headword: 'old' }], custom: { keep: true } },
    questions: [{ snapshotContent: { passage: badPassage && i === 1 ? 'Different text.' : lesson.passage }, overrideContent: null }],
  }));
  const original = structuredClone(papers);
  const updates: any[] = [];
  let committed = false;
  const prisma = {
    async $transaction(callback: any) {
      const before = structuredClone(papers);
      const tx = {
        async $queryRaw(_strings: TemplateStringsArray, id: string) { return papers.filter((p) => p.id === id).map((p) => ({ id: p.id })); },
        paper: { async findUnique({ where }: any) { return papers.find((p) => p.id === where.id) ?? null; } },
        async $executeRaw(strings: TemplateStringsArray, json: string, id: string) {
          updates.push({ sql: strings.join('?'), json, id });
          const paper = papers.find((p) => p.id === id)!;
          (paper.config as any).wordGlosses = JSON.parse(json);
          return 1;
        },
      };
      try { const result = await callback(tx); committed = true; return result; }
      catch (error) { papers.splice(0, papers.length, ...before); throw error; }
    },
  };
  return { prisma, papers, original, updates, isCommitted: () => committed };
}

describe('apply-glosses', () => {
  it('默认在事务内演练并回滚：每张卷子打印数量，库内没有持久变更', async () => {
    const { applyGlosses } = require('../gloss/apply-glosses');
    const db = database();
    const lines: string[] = [];
    const result = await applyGlosses(db.prisma, 'week99', { root, log: (line: string) => lines.push(line) });
    expect(result.committed).toBe(false);
    expect(db.isCommitted()).toBe(false);
    expect(db.updates).toHaveLength(2);
    expect(db.papers).toEqual(db.original);
    expect(lines.join('\n')).toMatch(/p1_olevel_20260901_paper.*3/);
    expect(lines.join('\n')).toMatch(/p1_olevel_20260902_paper.*3/);
  });
  it('--commit 才提交，更新语句只设 config.wordGlosses，保留所有其他配置', async () => {
    const { applyGlosses } = require('../gloss/apply-glosses');
    const db = database();
    expect((await applyGlosses(db.prisma, 'week99', { root, commit: true, log: () => {} })).committed).toBe(true);
    expect(db.isCommitted()).toBe(true);
    db.papers.forEach((p, i) => expect(p).toEqual({ ...db.original[i], config: { ...db.original[i].config, wordGlosses: glosses } }));
    for (const update of db.updates) {
      expect(update.sql).toMatch(/SET "config" = jsonb_set/);
      expect(update.sql).not.toMatch(/updatedAt|"name"\s*=/);
    }
  });
  it('后一张卷子正文不符：整批回滚，任何更新都不开始', async () => {
    const { applyGlosses } = require('../gloss/apply-glosses');
    const db = database(true);
    await expect(applyGlosses(db.prisma, 'week99', { root, commit: true, log: () => {} })).rejects.toThrow(/p1_olevel_20260902_paper.*正文/);
    expect(db.papers).toEqual(db.original);
    expect(db.isCommitted()).toBe(false);
    expect(db.updates).toHaveLength(0);
  });
  it('卷子缺失或未发布时拒绝整批', async () => {
    const { applyGlosses } = require('../gloss/apply-glosses');
    const db = database();
    db.papers[1].status = 'draft';
    await expect(applyGlosses(db.prisma, 'week99', { root, commit: true, log: () => {} })).rejects.toThrow(/未发布/);
    expect(db.updates).toHaveLength(0);
  });
  it('连接优先 PUBLIC_URL，强制单连接', () => {
    const { connectionUrl } = require('../gloss/apply-glosses');
    const result = new URL(connectionUrl({ DATABASE_PUBLIC_URL: 'postgresql://local/test?connection_limit=9', DATABASE_URL: 'postgresql://other/test' }));
    expect(result.hostname).toBe('local');
    expect(result.searchParams.get('connection_limit')).toBe('1');
  });
});
