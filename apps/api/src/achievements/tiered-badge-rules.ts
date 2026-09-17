import { sgtKey } from './badge-time';

/** V3 medals celebrate recorded effort, never proficiency or a predicted exam score. */
export const TIERED_BADGE_RULES_VERSION = 3;
export const THEME_IDS = ['first-chapter', 'reading-explorer', 'word-collector', 'quiz-milestone', 'steady-effort', 'school-edition'] as const;
export type ThemeId = typeof THEME_IDS[number];
export type Tier = 1 | 2 | 3 | 4;
export type TieredBadgeKey = `v3_${string}_l${Tier}`;
export interface MetricEvent {
  key: string;
  at: Date;
  submissionId?: string;
  sessionId?: string;
  itemId?: string;
}
export interface TieredAchievementFacts {
  readings: MetricEvent[];
  words: MetricEvent[];
  tests: MetricEvent[];
  fullDays: MetricEvent[];
  activeDays: MetricEvent[];
}
export const emptyTieredFacts = (): TieredAchievementFacts => ({ readings: [], words: [], tests: [], fullDays: [], activeDays: [] });
export interface TieredBadgeDef {
  key: TieredBadgeKey;
  themeId: ThemeId;
  tier: Tier;
  difficulty: '简单' | '适中' | '难' | '非常难';
  title: string;
  description: string;
  threshold: number;
  unit: string;
}
export interface BadgeEvidence {
  submissionIds: string[];
  dates: string[];
  sessionIds?: string[];
  itemIds?: string[];
  dependencyKeys?: string[];
  metric?: string;
  total?: number;
  countedThrough?: string;
}
export interface TieredBadgeProgress extends TieredBadgeDef {
  current: number;
  earned: boolean;
  earnedOn: string | null;
  evidence: BadgeEvidence;
  blockedBy: string[];
}
export interface SavedTierBadge {
  badgeKey: string;
  earnedOn: string;
  revokedAt: Date | null;
}
const difficulties = ['简单', '适中', '难', '非常难'] as const;
const themes: Array<{ id: ThemeId; title: string; thresholds: number[]; unit: string; description: string; metric?: keyof TieredAchievementFacts }> = [
  { id: 'first-chapter', title: '初章启程', thresholds: [15, 30, 60, 100], unit: '天', metric: 'fullDays', description: '累计完成同一任务日的阅读、新词学习和正式词测；补做也算。全部稍后再学不算。' },
  { id: 'reading-explorer', title: '阅读探险家', thresholds: [15, 30, 60, 100], unit: '篇', metric: 'readings', description: '累计提交不同的正式阅读，至少有一题实际作答。同卷多班只算一次；练习、空卷、系统收尾不算。' },
  { id: 'word-collector', title: '词语收藏家', thresholds: [15, 50, 200, 1000], unit: '词', metric: 'words', description: '累计学完每日新词，按不同拼写计数；换掉、标会、稍后再学、移出再加回不会增加数量。不是词汇量或掌握程度证明。' },
  { id: 'quiz-milestone', title: '测验里程碑', thresholds: [15, 30, 60, 100], unit: '次', metric: 'tests', description: '累计完成正式单词测验，每题都有作答；同一次每日学习只计一次。自助抽查、重测不算，不以分数排名。' },
  { id: 'steady-effort', title: '步履不停', thresholds: [15, 30, 60, 100], unit: '天', metric: 'activeDays', description: '累计有真实学习行为的日子：提交阅读、学完新词或提交正式词测。按实际完成日期，一天一次，不要求连续。' },
  { id: 'school-edition', title: '同行纪念', thresholds: [5, 5, 5, 5], unit: '类', description: '集齐其余五个主题的同阶徽章。只看自己的努力，不依赖同学、排名或班级目标。' },
];
export const tieredBadgeKey = (themeId: ThemeId, tier: Tier): TieredBadgeKey => `v3_${themeId.replace(/-/g, '_')}_l${tier}`;
export const TIERED_BADGES: readonly TieredBadgeDef[] = themes.flatMap((theme) => ([1, 2, 3, 4] as Tier[]).map((tier) => ({
  key: tieredBadgeKey(theme.id, tier), themeId: theme.id, tier, difficulty: difficulties[tier - 1],
  title: `${theme.title} · 第${tier}阶`, description: theme.description,
  threshold: theme.thresholds[tier - 1], unit: theme.unit,
})));

function distinctEvents(events: readonly MetricEvent[]): MetricEvent[] {
  const first = new Map<string, MetricEvent>();
  for (const event of events) {
    if (!event.key || !Number.isFinite(event.at.getTime())) continue;
    if (!first.has(event.key) || first.get(event.key)!.at > event.at) first.set(event.key, event);
  }
  return [...first.values()].sort((a, b) => a.at.getTime() - b.at.getTime() || a.key.localeCompare(b.key));
}

/** Existing awards persist; a revoked prerequisite cannot generate a new higher/composite award. */
export function evaluateTieredBadges(facts: TieredAchievementFacts, rows: readonly SavedTierBadge[] = []): TieredBadgeProgress[] {
  const saved = new Map(rows.map((row) => [row.badgeKey, row]));
  const result: TieredBadgeProgress[] = [];
  for (const def of TIERED_BADGES) {
    const blockedBy: string[] = ([1, 2, 3, 4] as Tier[]).filter((tier) => tier <= def.tier)
      .map((tier) => tieredBadgeKey(def.themeId, tier)).filter((key) => saved.get(key)?.revokedAt != null);
    const row = saved.get(def.key);
    const theme = themes.find((entry) => entry.id === def.themeId)!;
    let current = 0, earnedOn: string | null = null, evidence: BadgeEvidence;
    if (theme.metric) {
      const events = distinctEvents(facts[theme.metric]);
      current = Math.min(events.length, def.threshold);
      const hit = events[def.threshold - 1];
      earnedOn = hit ? sgtKey(hit.at) : null;
      const witnesses = events.slice(0, def.threshold);
      evidence = { metric: theme.metric, total: events.length,
        // Preserve every threshold witness in the award row. Public views cap
        // their lists separately; a 1000-word milestone must not lose its proof.
        submissionIds: witnesses.flatMap((event) => event.submissionId ? [event.submissionId] : []),
        sessionIds: [...new Set(witnesses.flatMap((event) => event.sessionId ? [event.sessionId] : []))],
        itemIds: witnesses.flatMap((event) => event.itemId ? [event.itemId] : []),
        dates: [...new Set(witnesses.map((event) => sgtKey(event.at)))],
        countedThrough: hit?.at.toISOString(),
      };
    } else {
      const dependencies = THEME_IDS.filter((id) => id !== 'school-edition').map((id) => tieredBadgeKey(id, def.tier));
      const qualified = dependencies.map((key) => result.find((badge) => badge.key === key)!)
        .filter((badge) => badge.earned && badge.blockedBy.length === 0);
      current = qualified.length;
      blockedBy.push(...dependencies.flatMap((key) => result.find((badge) => badge.key === key)?.blockedBy ?? []));
      earnedOn = current === 5 ? qualified.map((badge) => badge.earnedOn!).sort().at(-1)! : null;
      evidence = { metric: 'same_tier_collection', total: current, dependencyKeys: dependencies, submissionIds: [], dates: qualified.map((badge) => badge.earnedOn!).filter(Boolean) };
    }
    const earned = row ? row.revokedAt == null : earnedOn != null && blockedBy.length === 0;
    result.push({ ...def, current: earned ? def.threshold : current, earned,
      earnedOn: earned ? row?.earnedOn ?? earnedOn : null, evidence, blockedBy: [...new Set(blockedBy)] });
  }
  return result;
}
