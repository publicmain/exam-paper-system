import type { AchievementBadge } from './api';
export type MedalTier = 1 | 2 | 3 | 4;
export type MedalSeries = 'reading' | 'vocabulary' | 'mastery' | 'hidden' | 'legendary';
export const MEDAL_TIERS = [1, 2, 3, 4] as const;
export const MEDAL_TIER_NAMES = ['启程', '进阶', '远航', '典藏'] as const;
export const MEDAL_DIFFICULTIES = ['起步', '积累', '挑战', '典藏'] as const;
export type V5Medal = { assetId: string; id: string; name: string; title: string; series: MedalSeries; tier: MedalTier | null; threshold: number; unit: string; rule: string; hidden: boolean; clue: string | null };
const mainSeries = [
  { series:'reading', name:'阅读探索者', unit:'篇', rule:'完成不同文章的正式阅读任务；补做有效，不要求高分。' },
  { series:'vocabulary', name:'词汇积累者', unit:'份', rule:'完整学完每日新词任务，以最终实际学习清单为准；不是单个词的数量。' },
  { series:'mastery', name:'词汇挑战者', unit:'份', rule:'不同正式每日单词测验的首次提交达到 80%；自助抽查和重做不计入。' },
] as const;
export const V5_MEDALS: readonly V5Medal[] = [
  ...mainSeries.flatMap(s => MEDAL_TIERS.map(tier => ({ assetId:s.series+'-'+tier, id:s.series+'-'+tier, name:s.name+' · '+MEDAL_TIER_NAMES[tier-1], title:s.name+' · '+MEDAL_TIER_NAMES[tier-1], series:s.series, tier, threshold:[15,50,150,300][tier-1], unit:s.unit, rule:s.rule, hidden:false, clue:null }))),
  { assetId:'hidden-triad', id:'hidden-triad', name:'三叶同辉', title:'三叶同辉', series:'hidden', tier:null, threshold:15, unit:'天', rule:'累计 15 个任务日期的阅读、新词、正式测验全部完成，补做有效。', hidden:true, clue:'当三种努力在同一天相逢，光芒会慢慢汇聚。' },
  { assetId:'hidden-worlds', id:'hidden-worlds', name:'万象之窗', title:'万象之窗', series:'hidden', tier:null, threshold:5, unit:'类', rule:'完成 5 个已核验主题的阅读，每个主题至少 3 篇不同文章。', hidden:true, clue:'把目光投向不同的世界，新的窗会为你打开。' },
  { assetId:'hidden-starlight', id:'hidden-starlight', name:'星光长存', title:'星光长存', series:'hidden', tier:null, threshold:4, unit:'月', rule:'4 个不同自然月，各有至少 15 天完成一项正式学习任务；月份不必连续。', hidden:true, clue:'时间会记得，那些持续亮起的日子。' },
  { assetId:'crown', id:'crown', name:'群星之冠', title:'群星之冠', series:'legendary', tier:null, threshold:3, unit:'枚', rule:'三个主系列全部集齐四级；不是英语能力证书。', hidden:false, clue:null },
];
export const medalKey = (assetId: string) => 'v5_'+assetId.replace(/-/g,'_');
export const medalByAssetId = (assetId: string) => V5_MEDALS.find(m => m.assetId === assetId);
export const medalImage = (assetId: string, thumbnail = false) => medalByAssetId(assetId) ? '/medals/v5/'+(thumbnail ? 'thumbs' : 'images')+'/'+assetId+'.png' : '';
export const medalName = (assetId: string) => medalByAssetId(assetId)?.name ?? '神秘徽章';
/** Short celebration copy; full eligibility rules remain in the collection. */
export function medalAwardReason(assetId: string): string {
  const medal = medalByAssetId(assetId);
  if (!medal) return '每一份努力，都值得珍藏';
  if (medal.series === 'reading') return `累计完成 ${medal.threshold} 篇阅读`;
  if (medal.series === 'vocabulary') return `累计学完 ${medal.threshold} 份每日新词`;
  if (medal.series === 'mastery') return `${medal.threshold} 份正式测验首次达到 80%`;
  if (assetId === 'hidden-triad') return '15 个任务日，三项任务全部完成';
  if (assetId === 'hidden-worlds') return '探索 5 类主题，每类完成 3 篇阅读';
  if (assetId === 'hidden-starlight') return '4 个自然月，每月至少 15 天正式学习';
  return '集齐三大系列的全部四级徽章';
}
/** Presentation fallback after a confirmed server grant; never used to award. */
export function confirmedMedal(key: string): AchievementBadge | null {
  const m = V5_MEDALS.find(item => medalKey(item.assetId) === key);
  if (!m) return null;
  return { key, assetId:m.assetId, series:m.series, tier:m.tier, title:m.title, description:m.rule, threshold:m.threshold, current:m.threshold, unit:m.unit, earned:true, earnedOn:null, saved:true, revoked:null, evidence:{submissionIds:[],dates:[]}, hidden:m.hidden, clue:m.clue, isNew:true };
}
