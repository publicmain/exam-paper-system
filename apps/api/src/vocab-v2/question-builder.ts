export type V2QuestionType =
  | 'meaning_choice'
  | 'word_choice'
  | 'spelling'
  | 'cloze'
  | 'listening_spelling'
  | 'active_use'
  | 'collocation'
  | 'word_family';

export interface QuestionCapabilities {
  hasContext: boolean;
  hasAudio: boolean;
  hasCollocations: boolean;
  hasWordFamily: boolean;
  reasonableDistractorCount: number;
}

/**
 * Question type follows demonstrated mastery. Multiple choice is never forced:
 * without three reasonable distractors the planner moves to a productive task.
 */
export function questionTypeForStage(
  stage: number,
  capabilities: QuestionCapabilities,
  encounter: number,
): V2QuestionType {
  const level = Math.max(1, Math.min(8, Math.floor(stage)));
  if (level === 1) return capabilities.reasonableDistractorCount >= 3 ? 'meaning_choice' : 'spelling';
  if (level === 2) return capabilities.reasonableDistractorCount >= 3 ? 'word_choice' : 'spelling';
  if (level === 3 && capabilities.hasContext) return 'cloze';
  if (level === 4) return 'spelling';
  if (level === 5 && capabilities.hasAudio) return 'listening_spelling';
  if (level === 6 && capabilities.hasCollocations) return 'collocation';
  if (level === 7) return 'active_use';
  if (level === 8 && capabilities.hasWordFamily && encounter % 3 === 0) return 'word_family';
  if (capabilities.hasContext) return 'cloze';
  return 'spelling';
}

export interface DistractorCandidate {
  senseId: string;
  value: string;
  pos: string;
  difficulty: number;
  knownByStudent: boolean;
  grammaticallyValid: boolean;
}

export function reasonableDistractors(input: {
  answerSenseId: string;
  pos: string;
  difficulty: number;
  candidates: readonly DistractorCandidate[];
  limit?: number;
}): DistractorCandidate[] {
  const limit = Math.max(0, Math.min(3, input.limit ?? 3));
  const used = new Set<string>();
  return input.candidates
    .filter((candidate) =>
      candidate.senseId !== input.answerSenseId &&
      candidate.pos === input.pos &&
      candidate.knownByStudent &&
      candidate.grammaticallyValid &&
      Math.abs(candidate.difficulty - input.difficulty) <= 1 &&
      candidate.value.trim().length > 0,
    )
    .sort((a, b) => Math.abs(a.difficulty - input.difficulty) - Math.abs(b.difficulty - input.difficulty) || a.value.localeCompare(b.value))
    .filter((candidate) => {
      const key = candidate.value.trim().toLowerCase();
      if (used.has(key)) return false;
      used.add(key);
      return true;
    })
    .slice(0, limit);
}

export function clozeSentence(sentence: string, surfaceForm: string, headword: string): string | null {
  const escaped = [surfaceForm, headword]
    .filter(Boolean)
    .sort((a, b) => b.length - a.length)
    .map((word) => word.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'));
  if (!escaped.length) return null;
  const re = new RegExp(`\\b(?:${escaped.join('|')})\\b`, 'i');
  return re.test(sentence) ? sentence.replace(re, '_____') : null;
}
