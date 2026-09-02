import { clozeSentence, questionTypeForStage } from './question-builder';
import type { FrozenCard, FormalQuestion } from './formal-test';

export type AdaptiveQuestion =
  | FormalQuestion
  | { type: 'word_choice'; prompt: string; cue: { pos: string; translation: string }; options: string[]; answer: number }
  | { type: 'cloze'; prompt: string; cue: { sentence: string; translation: string }; options: []; answer: string }
  | { type: 'listening_spelling'; prompt: string; cue: { audioText: string; pos: string }; options: []; answer: string }
  | { type: 'active_use'; prompt: string; cue: { headword: string; translation: string }; options: []; answer: string }
  | { type: 'collocation'; prompt: string; cue: { headword: string }; options: string[]; answer: number }
  | { type: 'word_family'; prompt: string; cue: { headword: string; pos: string }; options: []; answer: string[] };

export interface AdaptiveCard extends FrozenCard {
  masteryStage: number;
  list?: string;
  rank?: number;
  sentenceTranslation?: string | null;
  collocations?: string[];
  wordFamily?: string[];
}

function stable(values: string[], seed: string) {
  return [...values].sort((a, b) => {
    const score = (value: string) => [...`${seed}:${value}`].reduce((sum, char) => (sum * 33 + char.charCodeAt(0)) >>> 0, 5381);
    return score(a) - score(b) || a.localeCompare(b);
  });
}

function spelling(card: AdaptiveCard): AdaptiveQuestion {
  return { type: 'spelling', prompt: '根据中文和词性写出英文单词。', cue: { pos: card.pos, translation: card.translation, audioText: card.audioText }, options: [], answer: card.headword };
}

/** Custom practice chooses a task from demonstrated mastery and available, frozen content. */
export function buildAdaptiveQuestion(card: AdaptiveCard, index: number, cards: readonly AdaptiveCard[]): AdaptiveQuestion {
  const samePos = cards.filter((item) => {
    if (item.headword === card.headword || item.pos !== card.pos) return false;
    if (item.list && card.list && item.list !== card.list) return false;
    if (item.rank && card.rank && Math.abs(item.rank - card.rank) > 500) return false;
    return Math.abs(item.masteryStage - card.masteryStage) <= 2;
  });
  const type = questionTypeForStage(card.masteryStage, {
    hasContext: Boolean(card.sentence),
    hasAudio: Boolean(card.audioText),
    hasCollocations: Boolean(card.collocations?.length),
    hasWordFamily: Boolean(card.wordFamily?.length),
    reasonableDistractorCount: samePos.length,
  }, index + 1);

  if (type === 'meaning_choice' && samePos.length >= 3) {
    const options = stable([card.translation, ...samePos.slice(0, 3).map((item) => item.translation)], `${card.headword}:meaning`);
    return { type, prompt: card.headword, cue: null, options, answer: options.indexOf(card.translation) };
  }
  if (type === 'word_choice' && samePos.length >= 3) {
    const options = stable([card.headword, ...samePos.slice(0, 3).map((item) => item.headword)], `${card.headword}:word`);
    return { type, prompt: '选择符合这个词义的英文单词。', cue: { pos: card.pos, translation: card.translation }, options, answer: options.indexOf(card.headword) };
  }
  if (type === 'cloze' && card.sentence) {
    const sentence = clozeSentence(card.sentence, card.headword, card.headword);
    if (sentence) return { type, prompt: '补全短句。', cue: { sentence, translation: card.sentenceTranslation ?? '' }, options: [], answer: card.headword };
  }
  if (type === 'listening_spelling') return { type, prompt: '听发音，写出单词。', cue: { audioText: card.audioText, pos: card.pos }, options: [], answer: card.headword };
  if (type === 'collocation' && card.collocations?.length && samePos.flatMap((item) => item.collocations ?? []).length >= 3) {
    const correct = card.collocations[0];
    const distractors = samePos.flatMap((item) => item.collocations ?? []).filter((item) => item !== correct).slice(0, 3);
    if (distractors.length === 3) {
      const options = stable([correct, ...distractors], `${card.headword}:collocation`);
      return { type, prompt: '选择最自然的常见搭配。', cue: { headword: card.headword }, options, answer: options.indexOf(correct) };
    }
  }
  if (type === 'active_use') return { type, prompt: '用目标词写一个完整英文句子。', cue: { headword: card.headword, translation: card.translation }, options: [], answer: card.headword };
  if (type === 'word_family' && card.wordFamily?.length) return { type, prompt: '写出这个词族中的另一个词。', cue: { headword: card.headword, pos: card.pos }, options: [], answer: card.wordFamily };
  return spelling(card);
}

export function answerAdaptiveQuestion(question: AdaptiveQuestion, response: unknown): boolean {
  if (['meaning_choice', 'word_choice', 'collocation'].includes(question.type)) {
    return Number.isInteger(response) && Number(response) === (question as { answer: number }).answer;
  }
  const text = String(response ?? '').trim().toLowerCase();
  if (question.type === 'word_family') return question.answer.some((answer) => answer.toLowerCase() === text);
  if (question.type === 'active_use') {
    const base = question.answer.toLowerCase();
    const forms = new Set([base, `${base}s`, `${base}es`, `${base}ed`, `${base}ing`]);
    if (base.endsWith('e')) {
      forms.add(`${base}d`);
      forms.add(`${base.slice(0, -1)}ing`);
    }
    const escaped = [...forms].sort((a, b) => b.length - a.length).map((word) => word.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'));
    return new RegExp(`\\b(?:${escaped.join('|')})\\b`, 'i').test(text) && text.split(/\s+/).length >= 3;
  }
  return text === (question as { answer: string }).answer.toLowerCase();
}

export function hideAdaptiveAnswer(question: AdaptiveQuestion) {
  const { answer: _answer, ...publicQuestion } = question;
  return publicQuestion;
}
