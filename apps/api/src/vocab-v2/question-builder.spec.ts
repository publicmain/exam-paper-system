import { describe, expect, it } from 'vitest';
import { clozeSentence, questionTypeForStage, reasonableDistractors } from './question-builder';

const caps = {
  hasContext: true,
  hasAudio: true,
  hasCollocations: true,
  hasWordFamily: true,
  reasonableDistractorCount: 3,
};

describe('V2 mastery-aware question builder', () => {
  it('moves from recognition to context, spelling, listening and active use', () => {
    expect(questionTypeForStage(1, caps, 1)).toBe('meaning_choice');
    expect(questionTypeForStage(2, caps, 2)).toBe('word_choice');
    expect(questionTypeForStage(3, caps, 3)).toBe('cloze');
    expect(questionTypeForStage(4, caps, 4)).toBe('spelling');
    expect(questionTypeForStage(5, caps, 5)).toBe('listening_spelling');
    expect(questionTypeForStage(6, caps, 6)).toBe('collocation');
    expect(questionTypeForStage(7, caps, 7)).toBe('active_use');
  });

  it('does not force multiple choice when three fair distractors do not exist', () => {
    expect(questionTypeForStage(1, { ...caps, reasonableDistractorCount: 2 }, 1)).toBe('spelling');
  });

  it('admits only same-POS, nearby, known and grammatical distractors', () => {
    const selected = reasonableDistractors({
      answerSenseId: 'answer', pos: 'verb', difficulty: 3,
      candidates: [
        { senseId: 'a', value: 'borrow', pos: 'verb', difficulty: 3, knownByStudent: true, grammaticallyValid: true },
        { senseId: 'b', value: 'lend', pos: 'verb', difficulty: 4, knownByStudent: true, grammaticallyValid: true },
        { senseId: 'c', value: 'money', pos: 'noun', difficulty: 3, knownByStudent: true, grammaticallyValid: true },
        { senseId: 'd', value: 'oppress', pos: 'verb', difficulty: 5, knownByStudent: false, grammaticallyValid: true },
        { senseId: 'e', value: 'carry', pos: 'verb', difficulty: 3, knownByStudent: true, grammaticallyValid: false },
      ],
    });
    expect(selected.map((item) => item.value)).toEqual(['borrow', 'lend']);
  });

  it('creates a short cloze from the target occurrence only', () => {
    expect(clozeSentence('We are stealing from its house.', 'stealing', 'steal')).toBe('We are _____ from its house.');
    expect(clozeSentence('Nothing matches.', 'stealing', 'steal')).toBeNull();
  });
});
