import { existsSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { frozenCollectionArticle } from './collection-v5-facts';
import manifest from './verified-article-topics.manifest.json';
import { buildVerifiedArticleTopicIndex, VERIFIED_ARTICLE_TOPICS, verifiedPrimaryTopicForArticleKey } from './verified-article-topics';

const { LEVELS } = require('../../scripts/pilot/content');
const root = path.resolve(__dirname, '../../../..');
const first = manifest.articles[0];
const key = (hash: string) => `article:${hash}`;

describe('reviewed frozen article topic manifest', () => {
  it('covers exactly the reviewed source set and uses the actual frozen body normalization', () => {
    const all = Object.entries(LEVELS).flatMap(([level, days]: [string, any]) => days.map((day: any) => ({ level, ...day })));
    expect(manifest.articles).toHaveLength(100);
    expect(all).toHaveLength(manifest.articles.length);
    expect(new Set(manifest.articles.map((row) => row.sha256)).size).toBe(manifest.articles.length);
    for (const day of all) {
      const record = manifest.articles.find((row) => row.level === day.level && row.date === day.date);
      expect(record, `Unreviewed article: ${day.level}/${day.date}/${day.title}`).toBeDefined();
      expect(record!.title).toBe(day.title);
      const frozen = frozenCollectionArticle({ passage: day.passage });
      expect(frozen?.key, day.title).toBe(key(record!.sha256));
      expect(verifiedPrimaryTopicForArticleKey(frozen!.key), day.title).toBe(record!.primaryTopicId);
      expect(day.passage, `Review evidence changed: ${day.title}`).toContain(record!.evidenceExcerpt);
      expect(record!.reviewedAt).toBe('2026-09-17');
      expect(record!.reviewMethod).toBe('agent-full-text-topic-review');
      expect(record!.rationale.length).toBeGreaterThan(20);
    }
  });

  it('every recorded relative source really exports its reviewed title and body', () => {
    for (const record of manifest.articles) {
      const source = path.resolve(root, record.sourcePath);
      expect(source.startsWith(`${root}${path.sep}`)).toBe(true);
      expect(existsSync(source), record.sourcePath).toBe(true);
      const module = require(source);
      const sourceDays = Object.values(module).filter(Array.isArray).flat() as any[];
      expect(sourceDays.some((day) => day && day.title === record.title &&
        frozenCollectionArticle({ passage: day.passage })?.key === key(record.sha256)),
      `Wrong provenance: ${record.title} in ${record.sourcePath}`).toBe(true);
    }
  });

  it('does not guess by title, article id, unverified labels or a modified body', () => {
    expect(verifiedPrimaryTopicForArticleKey(first.title)).toBeUndefined();
    expect(verifiedPrimaryTopicForArticleKey(first.sha256)).toBeUndefined();
    expect(verifiedPrimaryTopicForArticleKey(key(first.sha256.toUpperCase()))).toBeUndefined();
    expect(verifiedPrimaryTopicForArticleKey(` ${key(first.sha256)}`)).toBeUndefined();
    expect(verifiedPrimaryTopicForArticleKey(`article:${'f'.repeat(64)}`)).toBeUndefined();
    const original = LEVELS[first.level].find((day: any) => day.date === first.date);
    const changed = frozenCollectionArticle({ passage: `${original.passage} A substantive new ending.`,
      title: first.title, achievementArticle: { primaryTopicId: first.primaryTopicId, primaryTopicVerified: false } });
    expect(verifiedPrimaryTopicForArticleKey(changed!.key)).toBeUndefined();
  });

  it('quarantines contradictory or incomplete reviews, independent of ordering', () => {
    const conflict = { ...first, primaryTopicId: first.primaryTopicId === 'nature' ? 'culture' : 'nature' };
    for (const rows of [[first, conflict], [conflict, first], [first, conflict, first]]) {
      expect(buildVerifiedArticleTopicIndex(rows).has(key(first.sha256))).toBe(false);
    }
    expect(buildVerifiedArticleTopicIndex([first, first]).get(key(first.sha256))).toBe(first.primaryTopicId);
    for (const invalid of [
      { ...first, primaryTopicId: 'guessed-tag' }, { ...first, evidenceExcerpt: '' },
      { ...first, rationale: '' }, { ...first, title: '' }, { ...first, reviewedAt: '' },
      { ...first, reviewMethod: 'automatic-title-classification' },
      { ...first, sourcePath: 'apps/api/scripts/pilot/content/../secret.js' },
    ]) {
      expect(buildVerifiedArticleTopicIndex([invalid, first]).has(key(first.sha256))).toBe(false);
      expect(buildVerifiedArticleTopicIndex([first, invalid]).has(key(first.sha256))).toBe(false);
    }
    expect(buildVerifiedArticleTopicIndex([null, [], {}, { ...first, sha256: 'bad' }]).size).toBe(0);
  });

  it('has a finite coarse taxonomy; future prepared content is not proof of published student achievement', () => {
    expect(VERIFIED_ARTICLE_TOPICS).toHaveLength(8);
    expect(buildVerifiedArticleTopicIndex(manifest.articles).size).toBe(100);
    expect(manifest.articles.filter((row) => row.date <= '2026-09-17')).toHaveLength(70);
    const counts = Object.fromEntries(VERIFIED_ARTICLE_TOPICS.map((topic) => [topic,
      manifest.articles.filter((row) => row.primaryTopicId === topic).length]));
    expect(Object.values(counts).filter((count) => count >= 3)).toHaveLength(7);
    // Honest coverage: this rare category has only two prepared readings, not an invented third.
    expect(counts.psychology).toBe(2);
  });
});
