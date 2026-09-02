import { describe, expect, it } from 'vitest';
import { availableScreens, initialStageForAction } from './learning-card';

describe('progressive V2 learning card', () => {
  const base = {
    headword: 'steal', phonetic: '/stiːl/', pos: 'verb', translation: '偷；窃取', definition: 'take something without permission',
    sentence: 'We must not steal from its home.', sentenceTranslation: '我们不能从它的家里偷东西。',
    collocations: [], wordFamily: [], confusionWords: [], memoryHint: null, imageUrl: null,
  };

  it('never dumps empty enrichment sections onto the first screen', () => {
    expect(availableScreens(base)).toEqual(['understand', 'retrieve']);
    expect(availableScreens({ ...base, collocations: ['steal a glance'] })).toEqual(['understand', 'connections', 'retrieve']);
  });

  it('supports direct mastery and extra-practice choices', () => {
    expect(initialStageForAction('mastered', 1)).toBe(8);
    expect(initialStageForAction('normal', 1)).toBe(2);
    expect(initialStageForAction('hard', 5)).toBe(2);
    expect(initialStageForAction('skip', 3)).toBe(3);
  });
});
