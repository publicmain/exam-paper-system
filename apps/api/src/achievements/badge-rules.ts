import { sgtKey } from './badge-time';

/**
 * 个人徽章的规则（F05，2026-09-15）—— 纯函数，可测。
 *
 * ## 目标
 *
 * 让学生看见自己的付出，不做公开排名、不刷分。徽章只从**服务端认可的真实学习事件**
 * 算出来：自己最终交的正式阅读、每日新词里真正学完的卡、交了的正式词测、首页连续学习
 * 同一口径的「三项全完成的日子」。浏览器传来的任何数字都不参与。
 *
 * ## 不刷分的几条
 *
 *   · 阅读按答卷去重（重复交、重开结果页不多算）；系统收尾、练习卷不算；
 *   · 学过的词按词义去重；延后的、「我会了，换一个」换掉的不算；移出再加回来不算新词；
 *   · 自助抽查（custom_test）根本不在输入里；
 *   · 名字只描述做了什么（「读完 5 篇」），**不叫「英语高手」「词汇大师」** —— 累计量不是能力证明。
 *
 * ## 取消 / 无课日 / 请假
 *
 *   · 取消的场次不算任务，也就不算「欠」（`assignedReadingFor` 的口径）；
 *   · 无课日没有任务，不影响任何徽章；「稳定三周」看的是有学习行为的天数，不要求每天；
 *   · 系统里没有请假记录；累计类徽章不会因为中断而清零，已经得到的徽章永远不收回
 *     （除非老师以「数据有误」为由撤销，并留下理由）。
 *
 * 规则改了要递增 `BADGE_RULES_VERSION`：已发的徽章记着当时的版本。
 */
export const BADGE_RULES_VERSION = 1;

export type BadgeKey =
  | 'first_full_day'
  | 'reading_5'
  | 'reading_20'
  | 'words_50'
  | 'words_200'
  | 'steady_3_weeks'
  | 'backlog_cleared';

export interface BadgeDef {
  key: BadgeKey;
  title: string;
  /** 给学生看的得到条件，说清楚算什么、不算什么 */
  description: string;
  threshold: number;
  unit: string;
}

export const BADGES: readonly BadgeDef[] = [
  {
    key: 'first_full_day',
    title: '第一个完整的学习日',
    description: '有一个教学日把当天的任务都做完：阅读自己交了卷，并交了当天的正式单词测验（当天没有测验时，学完新词即可）。',
    threshold: 1,
    unit: '天',
  },
  {
    key: 'reading_5',
    title: '读完 5 篇',
    description: '自己最终交卷的正式阅读累计 5 份。补做也算；系统收尾和练习卷不算。',
    threshold: 5,
    unit: '篇',
  },
  {
    key: 'reading_20',
    title: '读完 20 篇',
    description: '自己最终交卷的正式阅读累计 20 份。补做也算；系统收尾和练习卷不算。',
    threshold: 20,
    unit: '篇',
  },
  {
    key: 'words_50',
    title: '学过 50 个新词',
    description: '每日新词里真正学完的词累计 50 个。按词义去重；延后的、换掉的不算。',
    threshold: 50,
    unit: '个',
  },
  {
    key: 'words_200',
    title: '学过 200 个新词',
    description: '每日新词里真正学完的词累计 200 个。按词义去重；延后的、换掉的不算。',
    threshold: 200,
    unit: '个',
  },
  {
    key: 'steady_3_weeks',
    title: '稳定三周',
    description: '有 3 个不同的教学周，每周至少 3 天有学习行为（交阅读、学完新词或交正式词测，一天算一次）。不要求连续。',
    threshold: 3,
    unit: '周',
  },
  {
    key: 'backlog_cleared',
    title: '补齐待办',
    description: '补做过之前没完成的阅读，并且此刻没有欠着的阅读。',
    threshold: 1,
    unit: '次',
  },
];

export interface AchievementFacts {
  /** 正式阅读的最终提交（练习卷已排除）；只有 student / teacher 提交算 */
  readingCompletions: ReadonlyArray<{ submissionId: string; sessionDate: string; finalAt: Date; source: string | null }>;
  /** 每日新词里学完的卡 */
  learnedCards: ReadonlyArray<{ senseId: string; at: Date }>;
  /** 正式词测交卷 */
  testsSubmitted: ReadonlyArray<{ sessionId: string; at: Date }>;
  /** 三项全完成的日子（与首页连续学习同一口径），任意顺序 */
  allDoneDays: readonly string[];
  /** 此刻还欠着的阅读份数（今天以前、没取消、没完成） */
  owedReadingsNow: number;
}

export interface BadgeProgress extends BadgeDef {
  current: number;
  earned: boolean;
  /** 达成那一天（新加坡日期）；没达成为 null */
  earnedOn: string | null;
  /** 依据：能追到哪几份答卷 / 哪几天 */
  evidence: { submissionIds: string[]; dates: string[] };
}

/** 新加坡日期所在教学周的周一。 */
export function mondayOf(dateKey: string): string {
  const t = Date.parse(`${dateKey}T00:00:00.000Z`);
  const weekday = new Date(t).getUTCDay(); // 0 = 周日
  const back = (weekday + 6) % 7;
  return new Date(t - back * 86_400_000).toISOString().slice(0, 10);
}

function countingReads(f: AchievementFacts) {
  const seen = new Set<string>();
  return [...f.readingCompletions]
    .filter((r) => r.source === 'student' || r.source === 'teacher')
    .sort((a, b) => a.finalAt.getTime() - b.finalAt.getTime())
    .filter((r) => (seen.has(r.submissionId) ? false : (seen.add(r.submissionId), true)));
}

function firstLearned(f: AchievementFacts) {
  const first = new Map<string, Date>();
  for (const c of f.learnedCards) {
    const prev = first.get(c.senseId);
    if (!prev || c.at < prev) first.set(c.senseId, c.at);
  }
  return [...first.entries()].sort((a, b) => a[1].getTime() - b[1].getTime());
}

export function evaluateBadges(f: AchievementFacts): BadgeProgress[] {
  const reads = countingReads(f);
  const words = firstLearned(f);
  const doneDays = [...new Set(f.allDoneDays)].sort();

  const activeDays = new Set<string>();
  for (const r of reads) activeDays.add(sgtKey(r.finalAt));
  for (const c of f.learnedCards) activeDays.add(sgtKey(c.at));
  for (const t of f.testsSubmitted) activeDays.add(sgtKey(t.at));
  const byWeek = new Map<string, string[]>();
  for (const day of [...activeDays].sort()) {
    const w = mondayOf(day);
    byWeek.set(w, [...(byWeek.get(w) ?? []), day]);
  }
  /** 每个达标周「达标的那一天」= 这周第 3 个有学习行为的日子 */
  const steadyWeeks = [...byWeek.entries()]
    .filter(([, days]) => days.length >= 3)
    .map(([week, days]) => ({ week, qualifiedOn: days[2] }))
    .sort((a, b) => a.qualifiedOn.localeCompare(b.qualifiedOn));

  const late = reads.filter((r) => sgtKey(r.finalAt) > r.sessionDate);
  const backlogCleared = late.length > 0 && f.owedReadingsNow === 0;

  return BADGES.map((def): BadgeProgress => {
    switch (def.key) {
      case 'first_full_day':
        return {
          ...def,
          current: Math.min(doneDays.length, def.threshold),
          earned: doneDays.length >= def.threshold,
          earnedOn: doneDays.length >= def.threshold ? doneDays[def.threshold - 1] : null,
          evidence: { submissionIds: [], dates: doneDays.slice(0, def.threshold) },
        };
      case 'reading_5':
      case 'reading_20': {
        const hit = reads.length >= def.threshold ? reads[def.threshold - 1] : null;
        return {
          ...def,
          current: Math.min(reads.length, def.threshold),
          earned: hit != null,
          earnedOn: hit ? sgtKey(hit.finalAt) : null,
          evidence: { submissionIds: reads.slice(0, def.threshold).map((r) => r.submissionId), dates: [] },
        };
      }
      case 'words_50':
      case 'words_200': {
        const hit = words.length >= def.threshold ? words[def.threshold - 1] : null;
        return {
          ...def,
          current: Math.min(words.length, def.threshold),
          earned: hit != null,
          earnedOn: hit ? sgtKey(hit[1]) : null,
          evidence: { submissionIds: [], dates: hit ? [sgtKey(hit[1])] : [] },
        };
      }
      case 'steady_3_weeks': {
        const hit = steadyWeeks.length >= def.threshold ? steadyWeeks[def.threshold - 1] : null;
        return {
          ...def,
          current: Math.min(steadyWeeks.length, def.threshold),
          earned: hit != null,
          earnedOn: hit ? hit.qualifiedOn : null,
          evidence: { submissionIds: [], dates: steadyWeeks.slice(0, def.threshold).map((w) => w.week) },
        };
      }
      case 'backlog_cleared': {
        const lastLate = late.length ? late[late.length - 1] : null;
        return {
          ...def,
          current: backlogCleared ? 1 : 0,
          earned: backlogCleared,
          earnedOn: backlogCleared && lastLate ? sgtKey(lastLate.finalAt) : null,
          evidence: { submissionIds: late.slice(-5).map((r) => r.submissionId), dates: [] },
        };
      }
      default:
        return { ...def, current: 0, earned: false, earnedOn: null, evidence: { submissionIds: [], dates: [] } };
    }
  });
}
