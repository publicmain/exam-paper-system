import { afterEach, describe, expect, it } from 'vitest';
import { allDayConfigured, allDayEnabled, windowTimesFor } from './all-day';

/**
 * 阶段 B 的开关（PRD §7）。默认关 = 零行为变化，这是最重要的一条：
 * 机制先建好、跑满两个教学周再谈打开。
 */

const set = (v?: string) => {
  if (v === undefined) delete process.env.MORNING_QUIZ_ALL_DAY;
  else process.env.MORNING_QUIZ_ALL_DAY = v;
};

afterEach(() => set(undefined));

describe('allDayEnabled', () => {
  it('**没配 → 关**（部署这段代码不改变任何现有行为）', () => {
    set(undefined);
    expect(allDayEnabled('c1')).toBe(false);
    expect(allDayConfigured()).toBe(false);
  });

  it('显式 off 也是关', () => {
    for (const v of ['off', 'false', '0', 'OFF']) {
      set(v);
      expect(allDayEnabled('c1')).toBe(false);
      expect(allDayConfigured()).toBe(false);
    }
  });

  it('on/true/all/1 → 全班开', () => {
    for (const v of ['on', 'true', 'all', '1', 'ON']) {
      set(v);
      expect(allDayEnabled('c1')).toBe(true);
      expect(allDayEnabled('随便哪个班')).toBe(true);
    }
  });

  it('班级白名单 → 只有名单里的班开（灰度）', () => {
    set('classA, classB');
    expect(allDayEnabled('classA')).toBe(true);
    expect(allDayEnabled('classB')).toBe(true);
    expect(allDayEnabled('classC')).toBe(false);
    // 灰度模式下没给 classId 一律按关处理，不能误开
    expect(allDayEnabled(null)).toBe(false);
    expect(allDayConfigured()).toBe(true);
  });
});

describe('windowTimesFor', () => {
  it('关着 → 现状 08:30–09:00', () => {
    set(undefined);
    expect(windowTimesFor('c1')).toEqual({
      attendanceStartLocal: '08:30:00',
      quizEndLocal: '09:00:00',
      allDay: false,
    });
  });

  it('开着 → 00:00–23:59', () => {
    set('on');
    expect(windowTimesFor('c1')).toEqual({
      attendanceStartLocal: '00:00:00',
      quizEndLocal: '23:59:00',
      allDay: true,
    });
  });
});
