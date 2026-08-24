import { describe, expect, it } from 'vitest';
import { secondWindowAppliesTo, shouldAutoOpenSecondWindow } from './second-window';

/**
 * 第二作答窗（2026-08-20 校方新政）：16:00–17:30 SGT，自动开窗。
 *
 * 与它取代的「补考场」的区别：不再只服务早上无故缺席的学生，早上来
 * 了但没答完的一样能进，学生可任意选择在哪个窗作答、也能改早上写下
 * 的答案。所以开窗条件里**去掉了缺席人数**。
 *
 * 决策抽成纯函数 —— cron 只在整分钟跳，窗口逻辑错一个边界就是
 * 「窗口活不过一分钟」或「凌晨也开窗」级别的事故（参见 2026-08-13
 * debug-activate 事故链）。
 */

const base = {
  secondWindowEnv: undefined as string | undefined,
  dateIsoLocal: '2026-08-25', // 生效后首个有早测的日子（8/24 周一无早测）
  nowLocalHHMMSS: '16:00:00',
  weekdayLocal: 2, // Tuesday
  sessionStatus: 'locked',
  makeupStart: null as Date | null,
};

describe('shouldAutoOpenSecondWindow', () => {
  it('工作日 16:00、场次已锁 → 开', () => {
    expect(shouldAutoOpenSecondWindow({ ...base })).toBe(true);
  });

  it('时段边界：15:59:59 不开，17:29:59 开，17:30:00 不开', () => {
    expect(shouldAutoOpenSecondWindow({ ...base, nowLocalHHMMSS: '15:59:59' })).toBe(false);
    expect(shouldAutoOpenSecondWindow({ ...base, nowLocalHHMMSS: '17:29:59' })).toBe(true);
    expect(shouldAutoOpenSecondWindow({ ...base, nowLocalHHMMSS: '17:30:00' })).toBe(false);
  });

  it('旧补考窗的 16:30–17:00 仍落在新窗内 —— 放宽不是平移', () => {
    expect(shouldAutoOpenSecondWindow({ ...base, nowLocalHHMMSS: '16:30:00' })).toBe(true);
    expect(shouldAutoOpenSecondWindow({ ...base, nowLocalHHMMSS: '16:59:59' })).toBe(true);
  });

  it('周末不开（纵深防御，正常周末也不该有场次）', () => {
    expect(shouldAutoOpenSecondWindow({ ...base, weekdayLocal: 0 })).toBe(false);
    expect(shouldAutoOpenSecondWindow({ ...base, weekdayLocal: 6 })).toBe(false);
  });

  it('全班都到齐也照开 —— 这是常规窗口，不是缺席补救', () => {
    // 旧的 shouldAutoOpenMakeup 在 absentPendingCount=0 时返回 false。
    // 新语义下「早上答完但想再改」的学生同样要用这个窗，按缺席数决定
    // 开不开会把绝大多数该开的日子挡掉 —— 这条就是防回归的。
    expect(shouldAutoOpenSecondWindow({ ...base })).toBe(true);
  });

  it('今天已开过（老师手动开的）→ 不重复开，手动优先', () => {
    expect(
      shouldAutoOpenSecondWindow({ ...base, makeupStart: new Date('2026-08-25T07:00:00Z') }),
    ).toBe(false);
  });

  it('场次不是 locked（当天流程异常）→ 不叠加第二窗', () => {
    expect(shouldAutoOpenSecondWindow({ ...base, sessionStatus: 'active' })).toBe(false);
    expect(shouldAutoOpenSecondWindow({ ...base, sessionStatus: 'cancelled' })).toBe(false);
    expect(shouldAutoOpenSecondWindow({ ...base, sessionStatus: 'scheduled' })).toBe(false);
  });

  it('生效日（2026-08-24）之前一律不开 —— 本周是考试周，不中途切换', () => {
    expect(shouldAutoOpenSecondWindow({ ...base, dateIsoLocal: '2026-08-20', weekdayLocal: 4 })).toBe(false);
    expect(shouldAutoOpenSecondWindow({ ...base, dateIsoLocal: '2026-08-21', weekdayLocal: 5 })).toBe(false);
    expect(shouldAutoOpenSecondWindow({ ...base, dateIsoLocal: '2026-08-25', weekdayLocal: 2 })).toBe(true);
  });

  it('MORNING_QUIZ_SECOND_WINDOW=off 一键停用', () => {
    expect(shouldAutoOpenSecondWindow({ ...base, secondWindowEnv: 'off' })).toBe(false);
  });
});

describe('secondWindowAppliesTo — 决定 09:00 收卷是暂存还是最终', () => {
  const d = { secondWindowEnv: undefined as string | undefined, dateIsoLocal: '2026-08-25', weekdayLocal: 2 };

  it('适用的日子 → 早上收成暂存提交（答案扣住，下午还能改）', () => {
    expect(secondWindowAppliesTo({ ...d })).toBe(true);
  });

  it('停用 / 生效日前 / 周末 → 不适用，早上收卷即最终提交并公布答案', () => {
    // 这三条是同一个坑的三张脸：漏判就会让学生停在暂存状态，下午的窗
    // 又永远不开，答案一辈子看不到。
    expect(secondWindowAppliesTo({ ...d, secondWindowEnv: 'off' })).toBe(false);
    expect(secondWindowAppliesTo({ ...d, dateIsoLocal: '2026-08-20' })).toBe(false);
    expect(secondWindowAppliesTo({ ...d, weekdayLocal: 6 })).toBe(false);
  });
});
