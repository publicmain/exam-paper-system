import { sgtKey } from './badge-time';

/** Approved collectible medals. Independent of the archived V1/V3 reward catalog. */
export const COLLECTION_V5_RULES_VERSION = 5;
export type CollectionV5Series = 'reading' | 'vocabulary' | 'mastery' | 'hidden' | 'legendary';
export type CollectionV5Tier = 1 | 2 | 3 | 4;
export type CollectionV5BadgeKey = `v5_${string}`;
export interface CollectionV5Event {
  key: string;
  at: Date;
  submissionId?: string;
  sessionId?: string;
  itemIds?: string[];
  sourceDate?: string;
  /** Only a verified primary topic frozen into the article snapshot. */
  topic?: string;
}
export interface CollectionV5Facts {
  readings: CollectionV5Event[];
  learningBatches: CollectionV5Event[];
  /** First formal attempts only, with stored authoritative score >= 80%. */
  tests: CollectionV5Event[];
  /** Source task date; `at` is when all three tasks actually became complete. */
  fullDays: CollectionV5Event[];
  /** Actual SGT day of completing a whole official task, never card/login events. */
  activeDays: CollectionV5Event[];
}
export const emptyCollectionV5Facts = (): CollectionV5Facts => ({ readings: [], learningBatches: [], tests: [], fullDays: [], activeDays: [] });

export interface CollectionV5BadgeDef {
  key: CollectionV5BadgeKey;
  assetId: string;
  series: CollectionV5Series;
  tier: CollectionV5Tier | null;
  hidden: boolean;
  clue: string | null;
  title: string;
  description: string;
  threshold: number;
  unit: string;
}
export interface CollectionV5Evidence {
  metric: string;
  total: number;
  submissionIds: string[];
  dates: string[];
  sessionIds: string[];
  itemIds?: string[];
  dependencyKeys?: string[];
  countedThrough?: string;
  articleKeys?: string[];
  topics?: string[];
  months?: string[];
}
export interface CollectionV5BadgeProgress extends CollectionV5BadgeDef {
  current: number;
  earned: boolean;
  earnedOn: string | null;
  evidence: CollectionV5Evidence;
  blockedBy: string[];
}
export interface SavedCollectionV5Badge { badgeKey: string; earnedOn: string; revokedAt: Date | null }

const thresholds = [15, 50, 150, 300] as const;
const tierNames = ['启程', '进阶', '远航', '典藏'];
const mainSeries = [
  { series: 'reading', title: '阅读探索者', unit: '篇', description: '完成不同的正式阅读文章；不要求分数，补做也算。同一文章重复提交不重复计数。' },
  { series: 'vocabulary', title: '词汇积累者', unit: '份', description: '完整学完每日新词任务，按任务份数累计。只计算最终实际学过的词；换掉、稍后再学不算学会，空任务不计。' },
  { series: 'mastery', title: '词汇挑战者', unit: '份', description: '正式每日词测的第一次作答达到 80%。同一任务只算一次，自主练习和重测不计。' },
] as const;
const keyFor = (assetId: string): CollectionV5BadgeKey => `v5_${assetId.replace(/-/g, '_')}`;
export const COLLECTION_V5_BADGES: readonly CollectionV5BadgeDef[] = [
  ...mainSeries.flatMap((entry) => thresholds.map((threshold, index): CollectionV5BadgeDef => {
    const assetId = `${entry.series === 'vocabulary' ? 'vocabulary' : entry.series}-${index + 1}`;
    return { ...entry, key: keyFor(assetId), assetId, tier: (index + 1) as CollectionV5Tier, hidden: false, clue: null,
      title: `${entry.title} · ${tierNames[index]}`, threshold };
  })),
  { key: 'v5_hidden_triad', assetId: 'hidden-triad', series: 'hidden', tier: null, hidden: true,
    clue: '让阅读、词汇与测验，在同一片叶脉上相遇。', title: '三叶同辉',
    description: '15 个任务日期的阅读、新词和正式词测全部完成；可以补做，词测不要求 80%。', threshold: 15, unit: '天' },
  { key: 'v5_hidden_worlds', assetId: 'hidden-worlds', series: 'hidden', tier: null, hidden: true,
    clue: '打开不同的窗，世界不止一种模样。', title: '万象之窗',
    description: '在 5 个不同的已核实阅读主题中，各完成至少 3 篇不同文章。缺失或未经核实的主题不会被猜测补算。', threshold: 5, unit: '类' },
  { key: 'v5_hidden_starlight', assetId: 'hidden-starlight', series: 'hidden', tier: null, hidden: true,
    clue: '不必日夜追赶，让星光在不同的月份相连。', title: '星光长存',
    description: '4 个不同自然月，各有至少 15 个实际完成正式任务的日子。按新加坡时间，不要求月份连续；补做不会倒填活跃日期。', threshold: 4, unit: '月' },
  { key: 'v5_crown', assetId: 'crown', series: 'legendary', tier: null, hidden: false, clue: null, title: '群星之冠',
    description: '集齐阅读探索者、词汇积累者和词汇挑战者的第四级徽章。', threshold: 3, unit: '枚' },
];

function distinct(events: readonly CollectionV5Event[]): CollectionV5Event[] {
  const first = new Map<string, CollectionV5Event>();
  for (const event of events) {
    if (!event.key.trim() || !(event.at instanceof Date) || !Number.isFinite(event.at.getTime())) continue;
    const old = first.get(event.key);
    if (!old || event.at < old.at || (event.at.getTime() === old.at.getTime() && witnessKey(event) < witnessKey(old))) first.set(event.key, event);
  }
  return [...first.values()].sort((a, b) => a.at.getTime() - b.at.getTime() || a.key.localeCompare(b.key));
}
const witnessKey = (event: CollectionV5Event) => `${event.submissionId ?? ''}:${event.sessionId ?? ''}`;
const uniq = (values: string[]) => [...new Set(values)];
function proof(metric: string, total: number, events: CollectionV5Event[], hit?: CollectionV5Event): CollectionV5Evidence {
  return { metric, total,
    submissionIds: uniq(events.flatMap((e) => e.submissionId ? [e.submissionId] : [])),
    sessionIds: uniq(events.flatMap((e) => e.sessionId ? [e.sessionId] : [])),
    itemIds: uniq(events.flatMap((e) => e.itemIds ?? [])),
    dates: uniq(events.map((e) => e.sourceDate ?? sgtKey(e.at))),
    ...(hit ? { countedThrough: hit.at.toISOString() } : {}),
  };
}

/** Pure evaluator. Redaction of locked hidden medals belongs to the API boundary. */
export function evaluateCollectionV5Badges(facts: CollectionV5Facts, rows: readonly SavedCollectionV5Badge[] = []): CollectionV5BadgeProgress[] {
  const saved = new Map(rows.map((row) => [row.badgeKey, row]));
  const metrics = { readings: distinct(facts.readings), learningBatches: distinct(facts.learningBatches), tests: distinct(facts.tests), fullDays: distinct(facts.fullDays) };
  const result: CollectionV5BadgeProgress[] = [];
  for (const def of COLLECTION_V5_BADGES) {
    let current = 0, earnedOn: string | null = null;
    let evidence = proof('unknown', 0, []);
    let blockedBy: string[] = saved.get(def.key)?.revokedAt ? [def.key] : [];
    if (def.tier) {
      blockedBy = ([1, 2, 3, 4] as const).filter((tier) => tier <= def.tier!)
        .map((tier) => keyFor(`${def.series}-${tier}`)).filter((key) => saved.get(key)?.revokedAt != null);
      const metric = def.series === 'reading' ? 'readings' : def.series === 'vocabulary' ? 'learningBatches' : 'tests';
      const events = metrics[metric], hit = events[def.threshold - 1];
      current = Math.min(events.length, def.threshold);
      earnedOn = hit ? sgtKey(hit.at) : null;
      evidence = proof(metric, events.length, events.slice(0, def.threshold), hit);
      if (metric === 'readings') evidence.articleKeys = events.slice(0, def.threshold).map((e) => e.key);
    } else if (def.key === 'v5_hidden_triad') {
      const events = metrics.fullDays, hit = events[def.threshold - 1];
      current = Math.min(events.length, def.threshold); earnedOn = hit ? sgtKey(hit.at) : null;
      evidence = proof('complete_source_dates', events.length, events.slice(0, def.threshold), hit);
    } else if (def.key === 'v5_hidden_worlds') {
      const byTopic = new Map<string, CollectionV5Event[]>();
      for (const event of metrics.readings) if (event.topic?.trim()) byTopic.set(event.topic, [...(byTopic.get(event.topic) ?? []), event]);
      const qualified = [...byTopic.entries()].filter(([, events]) => events.length >= 3)
        .sort((a, b) => a[1][2].at.getTime() - b[1][2].at.getTime() || a[0].localeCompare(b[0]));
      const hit = qualified[def.threshold - 1]?.[1][2], witnesses = qualified.slice(0, def.threshold).flatMap(([, events]) => events.slice(0, 3));
      current = Math.min(qualified.length, def.threshold); earnedOn = hit ? sgtKey(hit.at) : null;
      evidence = { ...proof('verified_reading_topics', qualified.length, witnesses, hit),
        articleKeys: witnesses.map((event) => event.key), topics: qualified.slice(0, def.threshold).map(([topic]) => topic) };
    } else if (def.key === 'v5_hidden_starlight') {
      // Derive actual dates ourselves: callers cannot turn a late makeup into a backdated active day.
      const days = distinct(facts.activeDays.map((event) => ({ ...event, key: event.at instanceof Date && Number.isFinite(event.at.getTime()) ? sgtKey(event.at) : '' })));
      const months = new Map<string, CollectionV5Event[]>();
      for (const day of days) { const month = day.key.slice(0, 7); months.set(month, [...(months.get(month) ?? []), day]); }
      const qualified = [...months.entries()].filter(([, events]) => events.length >= 15).sort(([a], [b]) => a.localeCompare(b));
      const hit = qualified[def.threshold - 1]?.[1][14], witnesses = qualified.slice(0, def.threshold).flatMap(([, events]) => events.slice(0, 15));
      current = Math.min(qualified.length, def.threshold); earnedOn = hit ? sgtKey(hit.at) : null;
      evidence = { ...proof('active_sgt_months', qualified.length, witnesses, hit), dates: witnesses.map((event) => event.key), months: qualified.slice(0, def.threshold).map(([month]) => month) };
    } else if (def.key === 'v5_crown') {
      const dependencies = ['v5_reading_4', 'v5_vocabulary_4', 'v5_mastery_4'];
      const candidates = result.filter((badge) => dependencies.includes(badge.key));
      const qualified = candidates.filter((badge) => badge.earned && badge.blockedBy.length === 0);
      current = qualified.length;
      blockedBy.push(...candidates.flatMap((badge) => badge.blockedBy));
      earnedOn = current === 3 ? qualified.map((badge) => badge.earnedOn!).sort().at(-1)! : null;
      evidence = { ...proof('three_main_series_tier_four', current, []), dependencyKeys: dependencies, dates: qualified.flatMap((badge) => badge.earnedOn ? [badge.earnedOn] : []) };
    }
    const row = saved.get(def.key);
    // Preserved earned medals do not disappear when source records are later archived.
    const earned = row ? row.revokedAt == null : earnedOn != null && blockedBy.length === 0;
    result.push({ ...def, current: earned ? def.threshold : current, earned,
      earnedOn: earned ? row?.earnedOn ?? earnedOn : null, evidence, blockedBy: uniq(blockedBy) });
  }
  return result;
}
