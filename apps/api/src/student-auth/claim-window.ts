/**
 * PIN 认领窗口 —— 纯函数，可测（2026-08-25）。
 *
 * ## 这一层解决的是什么
 *
 * 认领 PIN 的信任根是「扫到二维码 + 在花名册里点自己的名字」。这只证明
 * **拿到了二维码**，不证明是本人 —— 同班任何人都能抢先给别人设 PIN。
 *
 * 关键在于：这个风险的大小不取决于机制有多"像注册流程"，而取决于
 * **认领窗口有多长、有没有人看着**。原设计的窗口是无限长的：任何一个
 * 未认领的名字，学期里任何一天、任何同学都能领走，而且被领走的人可能
 * 几周之后才发现。
 *
 * 改成教师控制的短窗后：
 *   · 全班在一节课里同时注册，教师在场
 *   · 谁的名字被人领了，**当场**就会发现（"这个名字已经被认领"）
 *   · 窗口一关，剩下的未认领名字谁也动不了
 *
 * 抢注从「学期里随时可做、事后难以察觉」变成「必须当着老师和同学的面、
 * 在十几分钟里做、且当场暴露」。这不是密码学意义上的关闭，但它把攻击
 * 成本抬到了远高于收益的位置 —— 对一个班 35 人的日常学习系统，这是
 * 正确的性价比。
 *
 * ## 两个窗是「或」的关系
 *
 * 班级窗（集体注册课）和个人窗（请假的、换手机的、被抢注要重来的）
 * 任一开着即可认领。个人窗的存在是为了**不必为一个学生重开全班的窗** ——
 * 重开全班窗会把所有未认领的名字重新暴露一次。
 */

/** 默认开窗时长。一节课里做完注册够用，又不会忘了关。 */
export const DEFAULT_CLAIM_WINDOW_MINUTES = 20;

/** 上限。防止手滑开出一个「到下学期」的窗，那等于没关。 */
export const MAX_CLAIM_WINDOW_MINUTES = 120;

export interface ClaimWindowState {
  /** 班级窗关闭时刻；null = 从未开过 */
  classOpenUntil: Date | null;
  /** 个人补注册窗关闭时刻；null = 没开 */
  studentOpenUntil: Date | null;
}

/** 窗口是否开着。两个窗任一有效即可。 */
export function claimWindowOpen(s: ClaimWindowState, now: Date): boolean {
  return (
    (s.classOpenUntil != null && s.classOpenUntil.getTime() > now.getTime()) ||
    (s.studentOpenUntil != null && s.studentOpenUntil.getTime() > now.getTime())
  );
}

/** 还剩多少秒。两个窗取较晚者；已关返回 0。 */
export function claimWindowRemainingSec(s: ClaimWindowState, now: Date): number {
  const ends = [s.classOpenUntil, s.studentOpenUntil]
    .filter((d): d is Date => d != null)
    .map((d) => d.getTime());
  if (!ends.length) return 0;
  const latest = Math.max(...ends);
  return Math.max(0, Math.ceil((latest - now.getTime()) / 1000));
}

/**
 * 校验并归一化教师请求的开窗时长。
 *
 * 拒绝而不是静默截断 —— 教师以为开了 8 小时、实际只有 2 小时，会在
 * 「学生说设不了 PIN」时浪费一轮排查。
 */
export function normalizeWindowMinutes(minutes?: number): number {
  if (minutes == null) return DEFAULT_CLAIM_WINDOW_MINUTES;
  if (!Number.isInteger(minutes) || minutes < 1) {
    throw new Error('window_minutes_invalid');
  }
  if (minutes > MAX_CLAIM_WINDOW_MINUTES) {
    throw new Error('window_minutes_too_long');
  }
  return minutes;
}

/** 从现在起开 n 分钟的窗。 */
export function windowEndsAt(now: Date, minutes: number): Date {
  return new Date(now.getTime() + minutes * 60_000);
}
