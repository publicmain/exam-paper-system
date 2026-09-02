import { describe, expect, it } from 'vitest';
import { answerFormalQuestion, buildFormalQuestion, hideFormalAnswer } from './formal-test';

const cards = ['borrow', 'lend', 'carry', 'take'].map((headword, index) => ({
  headword,
  pos: 'verb',
  translation: ['借入', '借出', '携带', '拿走'][index],
  definition: '',
  audioText: headword,
  sentence: null,
}));

describe('frozen formal V2 test', () => {
  it('alternates spelling and same-session meaning questions', () => {
    expect(buildFormalQuestion(cards[0], 0, cards).type).toBe('spelling');
    const choice = buildFormalQuestion(cards[1], 1, cards);
    expect(choice.type).toBe('meaning_choice');
    if (choice.type === 'meaning_choice') {
      expect(choice.options).toHaveLength(4);
      expect(choice.options).toContain('借出');
    }
  });

  it('falls back to spelling instead of inventing unfair distractors', () => {
    expect(buildFormalQuestion(cards[0], 1, cards.slice(0, 2)).type).toBe('spelling');
  });

  it('grades server-side and strips answers from the public payload', () => {
    const spelling = buildFormalQuestion(cards[0], 0, cards);
    expect(answerFormalQuestion(spelling, ' Borrow ')).toBe(true);
    expect(hideFormalAnswer(spelling)).not.toHaveProperty('answer');
  });
});
