export interface FrozenCard {
  headword: string;
  pos: string;
  translation: string;
  definition: string;
  audioText: string;
  sentence: string | null;
}

/**
 * 正式卷题目快照。
 *
 * VOC04（2026-09-11）：拼写题的 cue 不再存 `audioText` —— 它就是答案本身。
 * 类型上保留可选字段，只为读得动改之前生成的旧快照；下发给客户端一律走
 * `publicFormalQuestion` 白名单。
 */
export type FormalQuestion =
  | { type: 'spelling'; prompt: string; cue: { pos: string; translation: string; audioText?: string }; options: []; answer: string }
  | { type: 'meaning_choice'; prompt: string; cue: null; options: string[]; answer: number };

function stableOrder(values: string[], seed: string) {
  return [...values].sort((a, b) => {
    const score = (value: string) => [...`${seed}:${value}`].reduce((sum, char) => (sum * 33 + char.charCodeAt(0)) >>> 0, 5381);
    return score(a) - score(b) || a.localeCompare(b);
  });
}

// ─────────────────────────────────────────────────────────────
// VOC03：选项按「学生看到的释义」去重，而不是按词条
// ─────────────────────────────────────────────────────────────

const POS_LABEL = /^(?:(?:n|v|vt|vi|a|adj|ad|adv|prep|conj|pron|num|art|int|intj|interj|aux|abbr|det)\.\s*)+/i;

/** 一个释义片段的比较键：去词性前缀、空白、中英文标点，小写。 */
function glossPiece(text: string): string {
  return String(text ?? '')
    .trim()
    .replace(POS_LABEL, '')
    .toLowerCase()
    .replace(/[\s　.,;:!?'"()[\]{}<>~`@#$%^&*_+=|\\/\-，。；：！？、“”‘’（）【】《》…·]+/g, '');
}

/** 整条释义的比较键（「adj. 大的」「大的。」「 大的 」都是「大的」）。 */
export function glossKey(text: string): string {
  return glossPiece(text);
}

/** 释义拆成义项（按逗号、分号、顿号、斜杠、换行），每个义项一个比较键。 */
export function glossSet(text: string): Set<string> {
  const pieces = String(text ?? '')
    .split(/[,，;；、/|\n]+/)
    .map(glossPiece)
    .filter(Boolean);
  const whole = glossKey(text);
  return new Set(whole ? [whole, ...pieces] : pieces);
}

/**
 * 两条释义会不会让学生觉得「两个都对」：整条相同，或者共享任何一个义项。
 * （big「大的」/ large「大的；重大的」→ 撞车。）
 */
export function meaningsOverlap(a: string, b: string): boolean {
  const left = glossSet(a);
  const right = glossSet(b);
  if (!left.size || !right.size) return false;
  for (const key of left) if (right.has(key)) return true;
  return false;
}

/**
 * 从候选里挑最多 `limit` 个公平干扰项：和正确释义不撞车，彼此之间也不撞车。
 * 候选顺序即优先顺序；挑不够就少给，调用方据此退回拼写题。
 */
export function distinctDistractors<T>(
  correctTranslation: string,
  candidates: readonly T[],
  translationOf: (candidate: T) => string,
  limit = 3,
): T[] {
  const picked: T[] = [];
  for (const candidate of candidates) {
    const translation = String(translationOf(candidate) ?? '').trim();
    if (!translation || !glossKey(translation)) continue;
    if (meaningsOverlap(translation, correctTranslation)) continue;
    if (picked.some((other) => meaningsOverlap(translationOf(other), translation))) continue;
    picked.push(candidate);
    if (picked.length >= limit) break;
  }
  return picked;
}

function spellingQuestion(card: FrozenCard): FormalQuestion {
  return {
    type: 'spelling',
    prompt: '根据中文和词性，写出英文单词。',
    // 不带 audioText：普通中译英拼写题不提供目标词发音（念出来就是答案）。
    cue: { pos: card.pos, translation: card.translation },
    options: [],
    answer: card.headword,
  };
}

/** Formal teacher-list test: all frozen words, only fair same-session choices. */
export function buildFormalQuestion(card: FrozenCard, index: number, allCards: readonly FrozenCard[]): FormalQuestion {
  if (index % 2 === 0) return spellingQuestion(card);
  const target = String(card.headword ?? '').trim().toLowerCase();
  const pool = allCards.filter((candidate) =>
    String(candidate.headword ?? '').trim().toLowerCase() !== target && candidate.pos === card.pos,
  );
  const distractors = distinctDistractors(card.translation, pool, (candidate) => candidate.translation)
    .map((candidate) => candidate.translation.trim());
  if (distractors.length < 3) return spellingQuestion(card);
  const correct = card.translation.trim();
  const options = stableOrder([correct, ...distractors], card.headword);
  return {
    type: 'meaning_choice',
    prompt: card.headword,
    cue: null,
    options,
    answer: options.indexOf(correct),
  };
}

function normaliseSpelling(value: unknown): string {
  return String(value ?? '').trim().toLowerCase().replace(/[’‘`]/g, "'").replace(/\s+/g, ' ');
}

/** 选择题判分：选中的选项与正确选项显示相同（旧快照可能有重复选项）都算对。 */
export function choiceIsCorrect(options: readonly string[], answer: number, response: unknown): boolean {
  if (!Number.isInteger(response)) return false;
  const index = Number(response);
  if (index < 0 || index >= options.length) return false;
  if (index === answer) return true;
  const correct = options[answer];
  return correct != null && glossKey(options[index]) !== '' && glossKey(options[index]) === glossKey(correct);
}

export function answerFormalQuestion(question: FormalQuestion, response: unknown): boolean {
  if (question.type === 'meaning_choice') return choiceIsCorrect(question.options, question.answer, response);
  return normaliseSpelling(response) === normaliseSpelling(question.answer);
}

/**
 * 进行中下发给客户端的题面 —— **白名单**，不是「删掉 answer 其余照发」。
 * 拼写题只有词性和中文；旧快照里 cue 带的 audioText 在这里被丢掉（VOC04）。
 */
export function publicFormalQuestion(question: FormalQuestion) {
  if (question.type === 'meaning_choice') {
    return { type: question.type, prompt: question.prompt, cue: null, options: [...question.options] };
  }
  return {
    type: 'spelling' as const,
    prompt: question.prompt,
    cue: { pos: question.cue?.pos ?? '', translation: question.cue?.translation ?? '' },
    options: [] as [],
  };
}

/** 兼容旧名：等同于 `publicFormalQuestion`。 */
export function hideFormalAnswer(question: FormalQuestion) {
  return publicFormalQuestion(question);
}
