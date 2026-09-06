import { describe, expect, it } from 'vitest';
import { contextForEncounter } from './context-progression';

const contexts = [
  { id: 'original', kind: 'article_original', position: 1, sentence: 'Original.', translation: '原句。', difficulty: 2 },
  { id: 'short', kind: 'short_same_meaning', position: 1, sentence: 'Short.', translation: '短句。', difficulty: 1 },
  { id: 'other', kind: 'alternate_topic', position: 1, sentence: 'Other.', translation: '不同主题。', difficulty: 3 },
];

describe('难度上限内没有例句时（2026-09-06 上线验收）', () => {
  const generatedOnly = [
    { id: 'short', kind: 'short_same_meaning', position: 1, sentence: 'Short.', translation: '短句。', difficulty: 2 },
    { id: 'other', kind: 'alternate_topic', position: 1, sentence: 'Other.', translation: '不同主题。', difficulty: 3 },
  ];
  it('退到最容易的一条，不返回 null', () => {
    expect(contextForEncounter(generatedOnly, 1, 1)?.id).toBe('short');
  });
  it('有翻译的优先：needs_translation 的原句让位给 ready 的生成句', () => {
    const mixed = [
      { id: 'orig', kind: 'article_original', position: 1, sentence: 'Orig.', translation: '', difficulty: 1, qualityStatus: 'needs_translation' },
      ...generatedOnly.map((c) => ({ ...c, qualityStatus: 'ready' })),
    ];
    expect(contextForEncounter(mixed, 1, 1)?.id).toBe('short');
  });
  it('真句优先于释义模板句', () => {
    const mixed = [
      { id: 'tpl', kind: 'short_same_meaning', position: 1, sentence: 'The word "x" refers to y.', translation: 'x', difficulty: 2, provider: 'definition_template+azure_translator' },
      { id: 'real', kind: 'alternate_topic', position: 1, sentence: 'A real sentence.', translation: '真句。', difficulty: 3, provider: 'tatoeba+azure_translator' },
    ];
    expect(contextForEncounter(mixed, 2, 5)?.id).toBe('real');
  });

  it('一条都没有才是 null', () => {
    expect(contextForEncounter([], 1, 1)).toBeNull();
  });
});

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
