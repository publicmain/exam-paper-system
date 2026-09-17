import { sgtKey } from './badge-time';

/**
 * 班级周目标（F05，2026-09-15）—— 纯函数，可测。
 *
 * 首版只有一种：「本周全班一起完成已分配的阅读」。老师开启，学生只看班级汇总。
 *
 * 规矩（提示词 §8.2）：
 *   · 按**有效成员 × 实际分配**归一化，不按班级人数堆总量：分母是本周（到今天为止）实际分配
 *     给每个人、没取消的阅读份数之和；
 *   · 新生从加入之后算、改档按那天的档位 —— 这些都已经在 `assignedReadingFor` 的产物里；
 *   · 补做（本周交了以前的卷）**单独数**，不混进本周完成率；
 *   · 不暴露谁欠了几篇、谁拉低全班：只给汇总；有效成员不足 `CLASS_GOAL_MIN_MEMBERS` 人时
 *     连汇总数字都不给（小班能从数字反推出个人），只说「进行中」；
 *   · 不写进任何人的必做清单，不锁任何功能 —— 这里只是一个读出来的数。
 */
export const CLASS_GOAL_MIN_MEMBERS = 5;
export const CLASS_GOAL_KINDS = ['assigned_reading'] as const;
export type ClassGoalKind = (typeof CLASS_GOAL_KINDS)[number];

const DAY_MS = 86_400_000;
const addDays = (key: string, n: number) => new Date(Date.parse(`${key}T00:00:00.000Z`) + n * DAY_MS).toISOString().slice(0, 10);

export interface MemberReadings {
  studentId: string;
  readings: ReadonlyArray<{ date: string; completed: boolean; cancelled: boolean; finalSubmittedAt: Date | null }>;
}

export type ClassGoalProgress =
  | { visible: false; reason: 'small_group' | 'no_assignments'; weekStart: string; weekEnd: string }
  | {
      visible: true;
      weekStart: string;
      weekEnd: string;
      /** 本周（到今天为止）有分配的成员数 */
      activeMembers: number;
      assigned: number;
      completed: number;
      pct: number;
      /** 本周里补交的以前的阅读份数（不进完成率） */
      catchUp: number;
    };

export function classGoalProgress(input: {
  weekStart: string;
  todayKey: string;
  members: readonly MemberReadings[];
  minMembers?: number;
}): ClassGoalProgress {
  const weekEnd = addDays(input.weekStart, 6);
  const upTo = input.todayKey < weekEnd ? input.todayKey : weekEnd;
  const minMembers = input.minMembers ?? CLASS_GOAL_MIN_MEMBERS;
  let assigned = 0;
  let completed = 0;
  let catchUp = 0;
  let activeMembers = 0;
  for (const m of input.members) {
    let mine = 0;
    for (const r of m.readings) {
      if (r.date >= input.weekStart && r.date <= upTo) {
        if (r.cancelled) continue;
        mine += 1;
        if (r.completed) completed += 1;
      } else if (r.date < input.weekStart && r.completed && r.finalSubmittedAt) {
        const handedIn = sgtKey(r.finalSubmittedAt);
        if (handedIn >= input.weekStart && handedIn <= upTo) catchUp += 1;
      }
    }
    assigned += mine;
    if (mine > 0) activeMembers += 1;
  }
  if (activeMembers < minMembers) return { visible: false, reason: 'small_group', weekStart: input.weekStart, weekEnd };
  if (assigned === 0) return { visible: false, reason: 'no_assignments', weekStart: input.weekStart, weekEnd };
  return {
    visible: true,
    weekStart: input.weekStart,
    weekEnd,
    activeMembers,
    assigned,
    completed,
    pct: Math.round((completed / assigned) * 100),
    catchUp,
  };
}
