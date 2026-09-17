import { describe, expect, it } from 'vitest';
import { BADGES, evaluateBadges, mondayOf, type AchievementFacts } from './badge-rules';

const at = (iso: string) => new Date(iso);
const base = (over: Partial<AchievementFacts> = {}): AchievementFacts => ({
  readingCompletions: [],
  learnedCards: [],
  testsSubmitted: [],
  allDoneDays: [],
  owedReadingsNow: 0,
  ...over,
});
const badge = (f: AchievementFacts, key: string) => evaluateBadges(f).find((b) => b.key === key)!;

describe('徽章目录', () => {
  it('**名字只描述做了什么，不叫高手 / 大师**；每个都说清楚算什么不算什么', () => {
    for (const b of BADGES) {
      expect(b.title).not.toMatch(/高手|大师|学霸|天才|master|expert/i);
      expect(b.description.length).toBeGreaterThan(10);
      expect(b.threshold).toBeGreaterThan(0);
    }
  });
});

describe('阅读类', () => {
  const read = (i: number, over: Record<string, unknown> = {}) => ({
    submissionId: `sub-${i}`,
    sessionDate: `2026-09-${String(i).padStart(2, '0')}`,
    finalAt: at(`2026-09-${String(i).padStart(2, '0')}T08:00:00.000Z`),
    source: 'student',
    ...over,
  });

  it('第 5 份自己交的阅读那天得到「读完 5 篇」；依据是这 5 份答卷', () => {
    const b = badge(base({ readingCompletions: [1, 2, 3, 4, 5, 6].map((i) => read(i)) }), 'reading_5');
    expect(b).toMatchObject({ current: 5, earned: true, earnedOn: '2026-09-05' });
    expect(b.evidence.submissionIds).toEqual(['sub-1', 'sub-2', 'sub-3', 'sub-4', 'sub-5']);
  });

  it('**同一份答卷出现 100 次只算一次**；系统收尾不算', () => {
    const dup = Array.from({ length: 100 }, () => read(1));
    const b = badge(base({ readingCompletions: [...dup, read(2), read(3), read(4, { source: 'system_eod' })] }), 'reading_5');
    expect(b).toMatchObject({ current: 3, earned: false, earnedOn: null });
  });

  it('补齐待办：补做过、而且此刻不欠 → 得到；此刻还欠 → 没得到', () => {
    const late = read(3, { finalAt: at('2026-09-06T08:00:00.000Z') }); // 3 日的卷 6 日才交
    expect(badge(base({ readingCompletions: [read(1), late], owedReadingsNow: 0 }), 'backlog_cleared')).toMatchObject({ earned: true, earnedOn: '2026-09-06' });
    expect(badge(base({ readingCompletions: [read(1), late], owedReadingsNow: 2 }), 'backlog_cleared')).toMatchObject({ earned: false });
    expect(badge(base({ readingCompletions: [read(1)], owedReadingsNow: 0 }), 'backlog_cleared')).toMatchObject({ earned: false });
  });

  it('跨午夜补交（新加坡 23:59 前算当天，00:00 之后算第二天）', () => {
    const justInTime = read(3, { finalAt: at('2026-09-03T15:59:00.000Z') });
    const afterMidnight = read(4, { finalAt: at('2026-09-04T16:01:00.000Z') });
    const b = badge(base({ readingCompletions: [justInTime, afterMidnight] }), 'backlog_cleared');
    expect(b.evidence.submissionIds).toEqual(['sub-4']);
  });
});

describe('词汇类', () => {
  it('按词义去重：同一个词学两次、移出再加回来都只算一次；第 50 个词那天得到', () => {
    const cards = Array.from({ length: 50 }, (_, i) => ({ senseId: `s${i}`, at: at(`2026-09-${String(1 + (i % 20)).padStart(2, '0')}T02:00:00.000Z`) }));
    const again = cards.slice(0, 10).map((c) => ({ ...c, at: at('2026-09-25T02:00:00.000Z') }));
    const b = badge(base({ learnedCards: [...again, ...cards.slice(0, 49)] }), 'words_50');
    expect(b).toMatchObject({ current: 49, earned: false });
    const b2 = badge(base({ learnedCards: [...again, ...cards] }), 'words_50');
    expect(b2.earned).toBe(true);
  });
});

describe('稳定三周', () => {
  it('3 个不同教学周各有 ≥3 天学习行为才得到；达成日是第三周的第 3 个学习日', () => {
    const days = (week: string[]) => week.map((d) => ({ senseId: `x${d}`, at: at(`${d}T02:00:00.000Z`) }));
    const w1 = days(['2026-08-31', '2026-09-01', '2026-09-02']);
    const w2 = days(['2026-09-07', '2026-09-09', '2026-09-11']);
    const w3 = days(['2026-09-14', '2026-09-15']);
    expect(badge(base({ learnedCards: [...w1, ...w2, ...w3] }), 'steady_3_weeks')).toMatchObject({ current: 2, earned: false });
    const w3b = [...w3, ...days(['2026-09-17'])];
    expect(badge(base({ learnedCards: [...w1, ...w2, ...w3b] }), 'steady_3_weeks')).toMatchObject({ current: 3, earned: true, earnedOn: '2026-09-17' });
  });

  it('同一天做很多事只算一天', () => {
    const sameDay = Array.from({ length: 30 }, (_, i) => ({ senseId: `s${i}`, at: at('2026-09-14T02:00:00.000Z') }));
    expect(badge(base({ learnedCards: sameDay }), 'steady_3_weeks').current).toBe(0);
  });

  it('周一是一周的开始（新加坡日期）', () => {
    expect(mondayOf('2026-09-14')).toBe('2026-09-14');
    expect(mondayOf('2026-09-20')).toBe('2026-09-14');
    expect(mondayOf('2026-09-13')).toBe('2026-09-07');
  });
});

describe('第一个完整的学习日', () => {
  it('没有完整的日子 → 没得到；有 → 最早那天得到', () => {
    expect(badge(base(), 'first_full_day')).toMatchObject({ earned: false, current: 0 });
    expect(badge(base({ allDoneDays: ['2026-09-12', '2026-09-08'] }), 'first_full_day')).toMatchObject({ earned: true, earnedOn: '2026-09-08' });
  });
});
