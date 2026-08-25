import { describe, expect, it } from 'vitest';
import {
  DEFAULT_CLAIM_WINDOW_MINUTES,
  MAX_CLAIM_WINDOW_MINUTES,
  claimWindowOpen,
  claimWindowRemainingSec,
  normalizeWindowMinutes,
  windowEndsAt,
} from './claim-window';

/**
 * 认领窗口（2026-08-25）。这一层是抢注防线的全部 —— 「扫到码 + 点自己
 * 名字」证明不了身份，能证明的只有「当着老师和全班的面、在十几分钟里
 * 领走」。窗口逻辑错了，防线就是零。
 */

const T0 = new Date('2026-08-26T01:00:00Z');
const later = (min: number) => new Date(T0.getTime() + min * 60_000);

describe('claimWindowOpen', () => {
  it('两个窗都没开 → 关闭（这是默认状态，也是最重要的一条）', () => {
    expect(claimWindowOpen({ classOpenUntil: null, studentOpenUntil: null }, T0)).toBe(false);
  });

  it('班级窗开着 → 开', () => {
    expect(
      claimWindowOpen({ classOpenUntil: later(10), studentOpenUntil: null }, T0),
    ).toBe(true);
  });

  it('只有个人补注册窗开着 → 开（请假的学生不必重开全班窗）', () => {
    expect(
      claimWindowOpen({ classOpenUntil: null, studentOpenUntil: later(5) }, T0),
    ).toBe(true);
  });

  it('窗口过期即关 —— 边界上「正好到点」算关', () => {
    expect(claimWindowOpen({ classOpenUntil: T0, studentOpenUntil: null }, T0)).toBe(false);
    expect(
      claimWindowOpen({ classOpenUntil: later(-1), studentOpenUntil: null }, T0),
    ).toBe(false);
  });

  it('班级窗过期但个人窗还开 → 开', () => {
    expect(
      claimWindowOpen({ classOpenUntil: later(-30), studentOpenUntil: later(3) }, T0),
    ).toBe(true);
  });
});

describe('claimWindowRemainingSec', () => {
  it('取两个窗里较晚的那个', () => {
    expect(
      claimWindowRemainingSec({ classOpenUntil: later(2), studentOpenUntil: later(7) }, T0),
    ).toBe(7 * 60);
  });

  it('全关 → 0，不返回负数', () => {
    expect(
      claimWindowRemainingSec({ classOpenUntil: later(-10), studentOpenUntil: null }, T0),
    ).toBe(0);
    expect(claimWindowRemainingSec({ classOpenUntil: null, studentOpenUntil: null }, T0)).toBe(0);
  });
});

describe('normalizeWindowMinutes', () => {
  it('不传 → 默认 20 分钟', () => {
    expect(normalizeWindowMinutes()).toBe(DEFAULT_CLAIM_WINDOW_MINUTES);
  });

  it('超上限 → 抛错而不是静默截断', () => {
    // 静默截断的后果：教师以为开了 8 小时，学生说设不了 PIN，
    // 白白排查一轮
    expect(() => normalizeWindowMinutes(MAX_CLAIM_WINDOW_MINUTES + 1)).toThrow(
      'window_minutes_too_long',
    );
  });

  it('0 / 负数 / 小数 → 拒绝', () => {
    for (const bad of [0, -5, 1.5]) {
      expect(() => normalizeWindowMinutes(bad)).toThrow('window_minutes_invalid');
    }
  });
});

describe('windowEndsAt', () => {
  it('从现在起算', () => {
    expect(windowEndsAt(T0, 20).toISOString()).toBe(later(20).toISOString());
  });
});
