import manifest from './verified-article-topics.manifest.json';

/** Stable broad subjects; this is a reviewed content index, never a tag classifier. */
export const VERIFIED_ARTICLE_TOPICS = ['nature', 'technology', 'culture', 'learning', 'community', 'health', 'history', 'psychology'] as const;
export type VerifiedArticleTopic = typeof VERIFIED_ARTICLE_TOPICS[number];

/**
 * Invalid rows are ignored. Conflicting classifications of the same frozen body
 * invalidate that body's topic, rather than allowing array order to decide it.
 * The published manifest is checked against the source content in unit tests.
 */
export function buildVerifiedArticleTopicIndex(rows: readonly unknown[]): ReadonlyMap<string, VerifiedArticleTopic> {
  const topics = new Set<string>(VERIFIED_ARTICLE_TOPICS);
  const result = new Map<string, VerifiedArticleTopic>();
  const conflicts = new Set<string>();
  for (const value of rows) {
    if (value == null || typeof value !== 'object' || Array.isArray(value)) continue;
    const row = value as Record<string, unknown>;
    if (typeof row.sha256 !== 'string' || !/^[a-f0-9]{64}$/.test(row.sha256)) continue;
    const key = `article:${row.sha256}`;
    const valid = typeof row.primaryTopicId === 'string' && topics.has(row.primaryTopicId)
      && typeof row.title === 'string' && !!row.title.trim()
      && typeof row.sourcePath === 'string' && row.sourcePath.startsWith('apps/api/scripts/pilot/content/')
      && !row.sourcePath.includes('..') && row.sourcePath.endsWith('.js')
      && typeof row.reviewedAt === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(row.reviewedAt)
      && row.reviewMethod === 'agent-full-text-topic-review'
      && typeof row.rationale === 'string' && !!row.rationale.trim()
      && typeof row.evidenceExcerpt === 'string' && !!row.evidenceExcerpt.trim();
    if (!valid || (result.has(key) && result.get(key) !== row.primaryTopicId)) {
      conflicts.add(key);
      result.delete(key);
      continue;
    }
    if (!conflicts.has(key)) result.set(key, row.primaryTopicId as VerifiedArticleTopic);
  }
  return result;
}

const verifiedTopics = buildVerifiedArticleTopicIndex(manifest.articles);

/** Exact normalized frozen-body SHA-256 lookup only; never consults titles/tags/the database. */
export function verifiedPrimaryTopicForArticleKey(key: string): VerifiedArticleTopic | undefined {
  if (!/^article:[a-f0-9]{64}$/.test(key)) return undefined;
  return verifiedTopics.get(key);
}
