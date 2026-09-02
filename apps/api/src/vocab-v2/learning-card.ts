export type LearningCardScreen = 'understand' | 'connections' | 'retrieve';
export type LearningCardAction = 'mastered' | 'normal' | 'hard' | 'skip' | 'replace';

export interface LearningCardContent {
  headword: string;
  phonetic: string | null;
  pos: string;
  translation: string;
  definition: string;
  sentence: string | null;
  sentenceTranslation: string | null;
  collocations: string[];
  wordFamily: string[];
  confusionWords: string[];
  memoryHint: string | null;
  imageUrl: string | null;
}

export function availableScreens(card: LearningCardContent): LearningCardScreen[] {
  const connections = card.collocations.length > 0 || card.wordFamily.length > 0 || card.confusionWords.length > 0 || !!card.memoryHint || !!card.imageUrl;
  return connections ? ['understand', 'connections', 'retrieve'] : ['understand', 'retrieve'];
}

export function initialStageForAction(action: LearningCardAction, currentStage: number): number {
  const stage = Math.max(1, Math.min(8, Math.floor(currentStage)));
  if (action === 'mastered') return 8;
  if (action === 'normal') return Math.max(stage, 2);
  if (action === 'hard') return Math.min(stage, 2);
  return stage;
}
