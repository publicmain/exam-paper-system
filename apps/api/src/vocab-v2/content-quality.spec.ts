import { describe, expect, it } from 'vitest';
import { learningAssetQuality, validateContentCandidate, type ContentCandidate } from './content-quality';

const good: ContentCandidate = {
  definition: 'to become smaller, fewer, or weaker',
  shortExample: 'The road will decline after the bridge.',
  shortTranslation: '过桥后道路会向下倾斜。',
  alternateExample: 'Sales may decline when customers lose confidence.',
  alternateTranslation: '顾客失去信心时，销量可能下降。',
  alternateTopic: 'business',
  collocations: ['decline sharply', 'a steady decline'],
  wordFamily: ['decline', 'declining'],
  confusionWords: ['decrease'],
  memoryHint: null,
};

describe('background content publication gate', () => {
  it('accepts two short, translated and distinct contexts', () => {
    expect(validateContentCandidate('decline', good)).toMatchObject({ publishable: true, errors: [] });
  });

  it('does not require optional enrichment fields to publish a safe core card', () => {
    expect(validateContentCandidate('decline', {
      ...good,
      collocations: [],
      wordFamily: [],
      confusionWords: [],
    })).toMatchObject({ publishable: true, errors: [] });
  });

  it('rejects duplicated long paragraphs and missing target words', () => {
    const same = 'This sentence repeats unrelated material for far too many words and gives the student no focused encounter with the vocabulary item at all.';
    const result = validateContentCandidate('decline', {
      ...good,
      shortExample: same,
      alternateExample: same,
      shortTranslation: '',
    });
    expect(result.publishable).toBe(false);
    expect(result.errors).toEqual(expect.arrayContaining([
      'short_example_length',
      'short_example_missing_target',
      'alternate_example_missing_target',
      'duplicate_examples',
      'missing_translation',
    ]));
  });
});

describe('student-facing learning asset gate', () => {
  it('requires a focused translated context, not merely a dictionary meaning', () => {
    expect(learningAssetQuality({
      headword: 'volcanic',
      translation: '火山的',
      definition: 'connected with a volcano',
      contexts: [{ sentence: 'A volcanic ash layer covered the town.', translation: '一层火山灰覆盖了小镇。' }],
    }).publishable).toBe(true);
    expect(learningAssetQuality({
      headword: 'volcanic',
      translation: '火山的',
      definition: 'connected with a volcano',
      contexts: [{ sentence: 'A long unrelated paragraph is stored here for the whole article.', translation: '' }],
    })).toMatchObject({ publishable: false, errors: ['missing_focused_translated_context'] });
  });
});
