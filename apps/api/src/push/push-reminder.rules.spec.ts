import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  DEFAULT_REMINDER_TIME,
  reminderCronExpression,
  reminderTargets,
  reminderTime,
  sgtDayStart,
  sgtDayStartInstant,
} from './push-reminder.rules';

afterEach(() => vi.unstubAllEnvs());

describe('每日提醒推给谁', () => {
  const S = (...ids: string[]) => new Set(ids);

  it('订阅了、今天有课、没交卷、没提醒过 → 推', () => {
    expect(
      reminderTargets({ subscribed: ['a'], hasSessionToday: S('a'), doneToday: S(), sentToday: S() }),
    ).toEqual(['a']);
  });

  it('今天没课的不推 —— 「课没做完」会是说谎', () => {
    expect(
      reminderTargets({ subscribed: ['a'], hasSessionToday: S(), doneToday: S(), sentToday: S() }),
    ).toEqual([]);
  });

  it('交了阅读卷的不打扰', () => {
    expect(
      reminderTargets({ subscribed: ['a'], hasSessionToday: S('a'), doneToday: S('a'), sentToday: S() }),
    ).toEqual([]);
  });

  it('今天已经提醒过一次的不再推', () => {
    expect(
      reminderTargets({ subscribed: ['a'], hasSessionToday: S('a'), doneToday: S(), sentToday: S('a') }),
    ).toEqual([]);
  });

  it('同一个学生几台设备只算一个人', () => {
    expect(
      reminderTargets({ subscribed: ['a', 'a', 'b'], hasSessionToday: S('a', 'b'), doneToday: S(), sentToday: S() }),
    ).toEqual(['a', 'b']);
  });
});

describe('提醒时刻', () => {
  it('默认 16:30', () => {
    expect(reminderTime(undefined)).toBe(DEFAULT_REMINDER_TIME);
    expect(reminderCronExpression(undefined)).toBe('30 16 * * 1-5');
  });

  it('从环境变量读，补零', () => {
    expect(reminderTime('9:05')).toBe('09:05');
    expect(reminderCronExpression('17:00')).toBe('0 17 * * 1-5');
  });

  it('写错了退回默认，不抛 —— 提醒时刻写错不该让 API 起不来', () => {
    for (const bad of ['', 'abc', '25:00', '16:60', '16.30']) {
      expect(reminderTime(bad)).toBe(DEFAULT_REMINDER_TIME);
    }
  });

  it('只在工作日跑', () => {
    expect(reminderCronExpression('16:30')).toMatch(/ 1-5$/);
  });
});

describe('新加坡日历日', () => {
  it('SGT 00:30 仍是当天；UTC 看是前一天 16:30', () => {
    // 2026-09-10 00:30 SGT = 2026-09-09 16:30 UTC
    const now = new Date('2026-09-09T16:30:00.000Z');
    expect(sgtDayStart(now).toISOString()).toBe('2026-09-10T00:00:00.000Z');
    expect(sgtDayStartInstant(now).toISOString()).toBe('2026-09-09T16:00:00.000Z');
  });
});
