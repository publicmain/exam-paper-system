export interface ContextCandidate {
  id: string;
  kind: string;
  position: number;
  sentence: string;
  translation: string;
  difficulty: number;
  /** 有翻译的才是 ready；没带这个字段的当 ready。 */
  qualityStatus?: string;
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
  // 有翻译的优先（article_original 里 544 条 needs_translation 会把没翻译的天文句推给基础档）
  const ready = contexts.filter((row) => !row.qualityStatus || row.qualityStatus === 'ready');
  const pool = ready.length ? ready : [...contexts];
  if (!pool.length) return null;
  // 难度上限内优先；一条都没有（基础档策略只放难度 1，生成的例句是 2 / 3）就退到
  // 最容易的那条 —— 空框比略难的句子更糟（2026-09-06 上线验收：10 个词 8 个空框）。
  const within = pool.filter((row) => row.difficulty <= maximumDifficulty);
  const available = within.length
    ? within
    : [...pool].sort((a, b) => a.difficulty - b.difficulty || a.position - b.position).slice(0, 1);
  const wanted = ENCOUNTER_KIND[Math.max(1, Math.min(5, Math.floor(encounter)))];
  return available
    .filter((row) => row.kind === wanted)
    .sort((a, b) => a.position - b.position)[0]
    ?? available.sort((a, b) => a.difficulty - b.difficulty || a.position - b.position)[(Math.max(1, encounter) - 1) % available.length]
    ?? null;
}
