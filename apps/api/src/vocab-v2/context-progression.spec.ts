import { describe, expect, it } from 'vitest';
import { contextForEncounter } from './context-progression';

const contexts = [
  { id: 'original', kind: 'article_original', position: 1, sentence: 'Original.', translation: '原句。', difficulty: 2 },
  { id: 'short', kind: 'short_same_meaning', position: 1, sentence: 'Short.', translation: '短句。', difficulty: 1 },
  { id: 'other', kind: 'alternate_topic', position: 1, sentence: 'Other.', translation: '不同主题。', difficulty: 3 },
];

describe('progressive context selection', () => {
  it('moves from original to shorter and then another topic', () => {
    expect(contextForEncounter(contexts, 1, 5)?.id).toBe('original');
    expect(contextForEncounter(contexts, 2, 5)?.id).toBe('short');
    expect(contextForEncounter(contexts, 3, 5)?.id).toBe('other');
  });

  it('does not jump beyond the student level difficulty', () => {
    expect(contextForEncounter(contexts, 3, 1)?.id).toBe('short');
    expect(contextForEncounter([], 1, 5)).toBeNull();
  });
});
