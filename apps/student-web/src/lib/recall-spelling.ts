/**
 * Normalization adapted from designfuchen/word-atlas, text.ts,
 * commit 19a9bd889d2f642fef1d8d0eef85a3f35e1a66ff, MIT.
 * Copyright (c) 2026 Word Atlas contributors. See THIRD_PARTY_NOTICES.md.
 */
export function normalizeRecallSpelling(value: string): string {
  return value.normalize('NFKC')
    .replace(/[‘’]/g, "'")
    .replace(/[“”]/g, '"')
    .replace(/[‐‑‒–—―−]/g, '-')
    .replace(/\s+/g, ' ').trim().toLowerCase();
}

/** Only a usable English headword/phrase from the frozen card is eligible. */
export function recallExpected(card: unknown): string | null {
  const word = (card as { headword?: unknown } | null)?.headword;
  if (typeof word !== 'string') return null;
  const normalized = normalizeRecallSpelling(word);
  return normalized.length <= 120 && /^[a-z][a-z '".\-]*$/.test(normalized) ? normalized : null;
}

export function recallStepEnabled(): boolean {
  return process.env.VOCAB_RECALL_STEP?.trim().toLowerCase() !== 'off';
}

export interface RecallResult {
  enabled: true;
  attempt: number;
  wrongAttempts: number;
  isCorrect: boolean;
  firstWrongIndex: number | null;
  expectedLength: number;
  hintLevel: number;
  nextPrefix: string;
  answerRevealed: boolean;
  correctSpelling: string | null;
}

export function judgeRecall(expected: string, typed: string, attempt: number, previous?: RecallResult): RecallResult {
  const actual = normalizeRecallSpelling(typed);
  const isCorrect = actual === expected;
  let firstWrongIndex: number | null = null;
  if (!isCorrect) {
    let i = 0;
    while (i < actual.length && i < expected.length && actual[i] === expected[i]) i++;
    firstWrongIndex = i;
  }
  const wrongAttempts = (previous?.wrongAttempts ?? 0) + (isCorrect ? 0 : 1);
  const answerRevealed = Boolean(previous?.answerRevealed) || wrongAttempts >= 4;
  // Leave at least one *letter* hidden, even when punctuation ends the phrase.
  const maxPrefix = Math.max(0, expected.search(/[a-z][^a-z]*$/));
  let prefixLength = previous?.nextPrefix.length ?? 0;
  if (!isCorrect && !answerRevealed && prefixLength < maxPrefix) {
    prefixLength++;
    while (prefixLength < maxPrefix && !/[a-z]/.test(expected[prefixLength - 1])) prefixLength++;
  }
  return {
    enabled: true, attempt, wrongAttempts, isCorrect, firstWrongIndex,
    expectedLength: expected.length,
    hintLevel: answerRevealed ? expected.length : prefixLength,
    nextPrefix: expected.slice(0, prefixLength), answerRevealed,
    correctSpelling: answerRevealed ? expected : null,
  };
}

/** Replacement reuses a slot: retain its request sequence, reset the new word's hints. */
export function recallState(response: unknown, senseId: string): RecallResult | undefined {
  const saved = (response as { recall?: RecallResult & { senseId: string } } | null)?.recall;
  if (!saved) return undefined;
  return saved.senseId === senseId ? saved : {
    ...saved, wrongAttempts: 0, isCorrect: false, firstWrongIndex: null,
    hintLevel: 0, nextPrefix: '', answerRevealed: false, correctSpelling: null,
  };
}
