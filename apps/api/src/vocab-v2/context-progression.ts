export interface ContextCandidate {
  id: string;
  kind: string;
  position: number;
  sentence: string;
  translation: string;
  difficulty: number;
}

const ENCOUNTER_KIND: Record<number, string> = {
  1: 'article_original',
  2: 'short_same_meaning',
  3: 'alternate_topic',
  4: 'listening',
  5: 'active_use',
};

export function contextForEncounter(
  contexts: readonly ContextCandidate[],
  encounter: number,
  maximumDifficulty: number,
): ContextCandidate | null {
  const available = contexts.filter((row) => row.difficulty <= maximumDifficulty);
  if (!available.length) return null;
  const wanted = ENCOUNTER_KIND[Math.max(1, Math.min(5, Math.floor(encounter)))];
  return available
    .filter((row) => row.kind === wanted)
    .sort((a, b) => a.position - b.position)[0]
    ?? available.sort((a, b) => a.difficulty - b.difficulty || a.position - b.position)[(Math.max(1, encounter) - 1) % available.length]
    ?? null;
}
