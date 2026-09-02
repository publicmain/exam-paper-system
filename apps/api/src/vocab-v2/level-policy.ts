import type { EnglishLevel } from '@prisma/client';
import type { OfficialListName } from './official-wordlists';

/**
 * The five product levels remain student choices. Word-list provenance is an
 * internal policy and is not shown as a promise that a class equals a level.
 */
export interface LevelWordPolicy {
  primary: OfficialListName;
  fallback: OfficialListName | null;
  startRank: number;
  contextDifficulty: 1 | 2 | 3 | 4 | 5;
}

export const LEVEL_WORD_POLICY: Record<EnglishLevel, LevelWordPolicy> = {
  ielts_simplified: { primary: 'ngsl', fallback: null, startRank: 1001, contextDifficulty: 1 },
  olevel_intermediate: { primary: 'ngsl', fallback: null, startRank: 1401, contextDifficulty: 2 },
  olevel: { primary: 'ngsl', fallback: 'nawl', startRank: 1801, contextDifficulty: 3 },
  ielts_light: { primary: 'nawl', fallback: 'ngsl', startRank: 1, contextDifficulty: 4 },
  ielts_authentic: { primary: 'nawl', fallback: 'ngsl', startRank: 1, contextDifficulty: 5 },
};

export function wordPolicyFor(level: EnglishLevel | null | undefined): LevelWordPolicy {
  return LEVEL_WORD_POLICY[level ?? 'olevel'];
}
