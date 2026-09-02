import { describe, expect, it } from 'vitest';
import { answerAdaptiveQuestion, buildAdaptiveQuestion, hideAdaptiveAnswer, type AdaptiveCard } from './adaptive-test';

const card = (over: Partial<AdaptiveCard> = {}): AdaptiveCard => ({
  headword: 'decline', pos: 'verb', translation: '下降', definition: 'become smaller', audioText: 'decline',
  sentence: 'Sales may decline this year.', sentenceTranslation: '今年销量可能下降。', masteryStage: 3,
  collocations: ['decline sharply'], wordFamily: ['declining'], ...over,
});

describe('adaptive frozen questions', () => {
  it('uses a cloze for contextual mastery and grades on the server', () => {
    const question = buildAdaptiveQuestion(card(), 0, [card()]);
    expect(question.type).toBe('cloze');
    expect(answerAdaptiveQuestion(question, 'decline')).toBe(true);
    expect(hideAdaptiveAnswer(question)).not.toHaveProperty('answer');
  });

  it('does not force multiple choice without three fair same-POS candidates', () => {
    const question = buildAdaptiveQuestion(card({ masteryStage: 1 }), 0, [card({ masteryStage: 1 })]);
    expect(question.type).toBe('spelling');
  });

  it('rejects same-POS distractors outside the frozen difficulty band', () => {
    const target = card({ masteryStage: 1, list: 'ngsl', rank: 100 });
    const remote = [1, 2, 3].map((offset) => card({ headword: `remote-${offset}`, translation: `远词${offset}`, masteryStage: 1, list: 'ngsl', rank: 1200 + offset }));
    expect(buildAdaptiveQuestion(target, 0, [target, ...remote]).type).toBe('spelling');
  });

  it('accepts active use only when the target occurs in a real sentence', () => {
    const question = buildAdaptiveQuestion(card({ masteryStage: 7 }), 0, [card({ masteryStage: 7 })]);
    expect(question.type).toBe('active_use');
    expect(answerAdaptiveQuestion(question, 'Sales declined sharply.')).toBe(true);
    expect(answerAdaptiveQuestion(question, 'It went down.')).toBe(false);
  });
});
