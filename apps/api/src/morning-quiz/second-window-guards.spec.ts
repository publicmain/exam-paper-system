import { describe, expect, it } from 'vitest';
import { effectiveEndsAt, isQuizWindowOpen } from './morning-quiz.service';

/**
 * 第二作答窗上线后暴露出来的两类「时间绑错了」的坑。
 *
 * 都不是假想 —— 2026-08-24 用浏览器实测时真的踩到了：学生下午打开
 * 答题页，倒计时是 00:00，1.5 秒后卷子被自动收走。
 */

const base = (over: Partial<{ quizEnd: Date; makeupStart: Date | null; makeupEnd: Date | null }> = {}) => ({
  quizEnd: new Date('2026-08-25T01:00:00Z'), // 09:00 SGT
  makeupStart: null as Date | null,
  makeupEnd: null as Date | null,
  ...over,
});

describe('effectiveEndsAt —— 学生端倒计时必须绑它，不是 quizEnd', () => {
  it('正式窗内：就是 quizEnd', () => {
    const s = base();
    const now = new Date('2026-08-25T00:45:00Z'); // 08:45 SGT
    expect(effectiveEndsAt(s, now).toISOString()).toBe(s.quizEnd.toISOString());
  });

  it('第二窗开着：给 makeupEnd —— 否则 Timer 一挂载就判过期并自动交卷', () => {
    const s = base({
      makeupStart: new Date('2026-08-25T08:00:00Z'), // 16:00 SGT
      makeupEnd: new Date('2026-08-25T09:30:00Z'), // 17:30 SGT
    });
    const now = new Date('2026-08-25T08:10:00Z'); // 16:10 SGT，正在第二窗里
    expect(effectiveEndsAt(s, now).toISOString()).toBe(s.makeupEnd!.toISOString());
    // 这一条就是事故本身：拿 quizEnd 当截止时间的话，此刻已经过期 3 小时
    expect(s.quizEnd.getTime()).toBeLessThan(now.getTime());
  });

  it('两个窗之间（09:00-16:00）：回到 quizEnd，答题页本来就该是关的', () => {
    const s = base({
      makeupStart: new Date('2026-08-25T08:00:00Z'),
      makeupEnd: new Date('2026-08-25T09:30:00Z'),
    });
    const now = new Date('2026-08-25T05:00:00Z'); // 13:00 SGT
    expect(effectiveEndsAt(s, now).toISOString()).toBe(s.quizEnd.toISOString());
    expect(isQuizWindowOpen(s, now)).toBe(false);
  });

  it('第二窗已过：回到 quizEnd，窗判定为关', () => {
    const s = base({
      makeupStart: new Date('2026-08-25T08:00:00Z'),
      makeupEnd: new Date('2026-08-25T09:30:00Z'),
    });
    const now = new Date('2026-08-25T10:00:00Z'); // 18:00 SGT
    expect(effectiveEndsAt(s, now).toISOString()).toBe(s.quizEnd.toISOString());
    expect(isQuizWindowOpen(s, now)).toBe(false);
  });

  it('第二窗边界：16:00:00 已开、17:30:00 仍算开、17:30:01 关', () => {
    const s = base({
      makeupStart: new Date('2026-08-25T08:00:00Z'),
      makeupEnd: new Date('2026-08-25T09:30:00Z'),
    });
    expect(isQuizWindowOpen(s, new Date('2026-08-25T08:00:00Z'))).toBe(true);
    expect(isQuizWindowOpen(s, new Date('2026-08-25T09:30:00Z'))).toBe(true);
    expect(isQuizWindowOpen(s, new Date('2026-08-25T09:30:01Z'))).toBe(false);
  });

  it('从没开过第二窗：任何时刻都只认 quizEnd', () => {
    const s = base();
    for (const iso of ['2026-08-25T00:30:00Z', '2026-08-25T08:10:00Z', '2026-08-25T12:00:00Z']) {
      expect(effectiveEndsAt(s, new Date(iso)).toISOString()).toBe(s.quizEnd.toISOString());
    }
  });
});

/**
 * 答题页的准入闸：谁算「扫过码」。
 *
 * 这条纯逻辑单拎出来测，是因为它曾经把整个补考/第二作答窗堵死 ——
 * 出勤开着时第二窗扫码记 absent + makeupAt，而原判据是「absent 就
 * 拒绝」，于是学生拿着有效令牌站在教室里进不了答题页。
 */
function admitted(att: { status: string; scanTime: Date | null; makeupAt: Date | null } | null): boolean {
  const everScanned = !!att && (att.scanTime != null || att.makeupAt != null);
  if (!att || (att.status === 'absent' && !everScanned)) return false;
  return true;
}

describe('答题页准入 —— 判据是「扫过码没有」，不是「算不算缺席」', () => {
  const t = new Date('2026-08-25T08:10:00Z');

  it('准时 / 迟到 → 放行', () => {
    expect(admitted({ status: 'on_time', scanTime: t, makeupAt: null })).toBe(true);
    expect(admitted({ status: 'late', scanTime: t, makeupAt: null })).toBe(true);
  });

  it('absent 但盖了 makeupAt（第二窗真的扫了码）→ 放行', () => {
    // 这一条就是 2026-08-13 事故的根因：出勤开着时第二窗扫码走的正是
    // 这条路，原判据把他们全挡在门外。
    expect(admitted({ status: 'absent', scanTime: null, makeupAt: t })).toBe(true);
  });

  it('absent 且有 scanTime（早上扫了但过了迟到线）→ 放行', () => {
    expect(admitted({ status: 'absent', scanTime: t, makeupAt: null })).toBe(true);
  });

  it('absent 且两个时间都没有（cron 按名册插的缺席行）→ 拒绝', () => {
    expect(admitted({ status: 'absent', scanTime: null, makeupAt: null })).toBe(false);
  });

  it('压根没有考勤行 → 拒绝', () => {
    expect(admitted(null)).toBe(false);
  });
});
