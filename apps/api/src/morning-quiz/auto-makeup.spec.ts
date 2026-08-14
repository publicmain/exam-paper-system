import { describe, expect, it } from 'vitest';
import { shouldAutoOpenMakeup } from './morning-quiz.cron';

/**
 * 每日固定补考场（2026-08-14 校方新政）：16:30–17:00 SGT，自动开窗。
 *
 * 决策抽成纯函数 —— cron 只在整分钟跳，窗口逻辑错一个边界就是
 * 「补考窗活不过一分钟」或「凌晨也开窗」级别的事故（参见 2026-08-13
 * debug-activate 事故链）。
 */

const base = {
  autoMakeupEnv: undefined as string | undefined,
  nowLocalHHMMSS: '16:30:00',
  weekdayLocal: 5, // Friday
  sessionStatus: 'locked',
  makeupStart: null as Date | null,
  absentPendingCount: 3,
};

describe('shouldAutoOpenMakeup', () => {
  it('工作日 16:30、有缺席未补考、场次已锁 → 开', () => {
    expect(shouldAutoOpenMakeup({ ...base })).toBe(true);
  });

  it('时段边界：16:29:59 不开，16:59:59 开，17:00:00 不开', () => {
    expect(shouldAutoOpenMakeup({ ...base, nowLocalHHMMSS: '16:29:59' })).toBe(false);
    expect(shouldAutoOpenMakeup({ ...base, nowLocalHHMMSS: '16:59:59' })).toBe(true);
    expect(shouldAutoOpenMakeup({ ...base, nowLocalHHMMSS: '17:00:00' })).toBe(false);
  });

  it('周末不开（纵深防御，正常周末也不该有场次）', () => {
    expect(shouldAutoOpenMakeup({ ...base, weekdayLocal: 0 })).toBe(false);
    expect(shouldAutoOpenMakeup({ ...base, weekdayLocal: 6 })).toBe(false);
  });

  it('没有缺席未补考的学生 → 不开一扇没人走的门', () => {
    expect(shouldAutoOpenMakeup({ ...base, absentPendingCount: 0 })).toBe(false);
  });

  it('今天已开过补考窗（老师中午手动开的）→ 不重复开，手动优先', () => {
    expect(
      shouldAutoOpenMakeup({ ...base, makeupStart: new Date('2026-08-14T04:00:00Z') }),
    ).toBe(false);
  });

  it('场次不是 locked（当天流程异常）→ 不叠加补考', () => {
    expect(shouldAutoOpenMakeup({ ...base, sessionStatus: 'active' })).toBe(false);
    expect(shouldAutoOpenMakeup({ ...base, sessionStatus: 'cancelled' })).toBe(false);
    expect(shouldAutoOpenMakeup({ ...base, sessionStatus: 'scheduled' })).toBe(false);
  });

  it('MORNING_QUIZ_AUTO_MAKEUP=off 一键停用', () => {
    expect(shouldAutoOpenMakeup({ ...base, autoMakeupEnv: 'off' })).toBe(false);
  });
});
