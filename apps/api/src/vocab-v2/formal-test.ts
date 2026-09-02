export interface FrozenCard {
  headword: string;
  pos: string;
  translation: string;
  definition: string;
  audioText: string;
  sentence: string | null;
}

export type FormalQuestion =
  | { type: 'spelling'; prompt: string; cue: { pos: string; translation: string; audioText: string }; options: []; answer: string }
  | { type: 'meaning_choice'; prompt: string; cue: null; options: string[]; answer: number };

function stableOrder(values: string[], seed: string) {
  return [...values].sort((a, b) => {
    const score = (value: string) => [...`${seed}:${value}`].reduce((sum, char) => (sum * 33 + char.charCodeAt(0)) >>> 0, 5381);
    return score(a) - score(b) || a.localeCompare(b);
  });
}

/** Formal teacher-list test: all frozen words, only fair same-session choices. */
export function buildFormalQuestion(card: FrozenCard, index: number, allCards: readonly FrozenCard[]): FormalQuestion {
  if (index % 2 === 0) {
    return {
      type: 'spelling',
      prompt: '根据中文、词性或发音，写出英文单词。',
      cue: { pos: card.pos, translation: card.translation, audioText: card.audioText },
      options: [],
      answer: card.headword,
    };
  }
  const distractors = allCards
    .filter((candidate) => candidate.headword !== card.headword && candidate.pos === card.pos)
    .map((candidate) => candidate.translation)
    .filter((value, position, values) => value && values.indexOf(value) === position)
    .slice(0, 3);
  if (distractors.length < 3) {
    return {
      type: 'spelling',
      prompt: '根据中文、词性或发音，写出英文单词。',
      cue: { pos: card.pos, translation: card.translation, audioText: card.audioText },
      options: [],
      answer: card.headword,
    };
  }
  const options = stableOrder([card.translation, ...distractors], card.headword);
  return {
    type: 'meaning_choice',
    prompt: card.headword,
    cue: null,
    options,
    answer: options.indexOf(card.translation),
  };
}

export function answerFormalQuestion(question: FormalQuestion, response: unknown): boolean {
  if (question.type === 'meaning_choice') {
    return Number.isInteger(response) && Number(response) === question.answer;
  }
  return String(response ?? '').trim().toLowerCase() === question.answer.trim().toLowerCase();
}

export function hideFormalAnswer(question: FormalQuestion) {
  const { answer: _answer, ...publicQuestion } = question;
  return publicQuestion;
}
