import { describe, it, expect, afterEach } from 'vitest';
import { allDayConfigSummary, withinAllDay } from './all-day';
import { isQuizWindowOpen, effectiveEndsAt } from '../morning-quiz/morning-quiz.service';

/**
 * P9.5 —— 全天开放的**运行时**生效。
 *
 * `all-day.spec.ts` 测的是配置解析与 `windowTimesFor`（**建场次**时用哪套
 * 时刻）。这里测的是另一半：已经建好的场次，此刻还开不开着。
 *
 * 为什么需要另一半 —— `windowTimesFor` 只参与创建。打开开关那天，今天的
 * 场次早就建好了，身上写的还是 08:30 / 09:00，学生 09:01 打开 App 照样
 * 被拒。「改个环境变量就能全天」这句话，只有在 `isQuizWindowOpen` 也认
 * 这个开关之后才成立。
 */

const set = (v?: string) => {
  if (v === undefined) delete process.env.MORNING_QUIZ_ALL_DAY;
  else process.env.MORNING_QUIZ_ALL_DAY = v;
};
afterEach(() => set(undefined));

/** 一场 SGT 8/27 的课，正式窗 08:30–09:00（早就过了的那种） */
const session = {
  quizEnd: new Date('2026-08-27T01:00:00Z'), // 09:00 SGT
  makeupStart: null,
  makeupEnd: null,
  classId: 'c1',
  date: new Date('2026-08-27T00:00:00Z'),
};
/** 同一天 SGT 20:00 —— 正式窗与补考窗都关着 */
const evening = new Date('2026-08-27T12:00:00Z');

describe('allDayConfigSummary（启动日志与 /api/health 共用的口径）', () => {
  it('未设置 → off', () => {
    set(undefined);
    expect(allDayConfigSummary()).toEqual({ mode: 'off', raw: '', classIds: [] });
  });

  it('true → all', () => {
    set('true');
    expect(allDayConfigSummary().mode).toBe('all');
  });

  it('班级白名单 → per-class，并列出班级', () => {
    set('c1, c3');
    expect(allDayConfigSummary()).toEqual({ mode: 'per-class', raw: 'c1, c3', classIds: ['c1', 'c3'] });
  });

  it('**拼错的值行为上等于关，但原样回显**（ture ≠ true）', () => {
    set('ture');
    const sum = allDayConfigSummary();
    // 落进按班灰度分支，而没有哪个班叫 'ture'
    expect(sum.mode).toBe('per-class');
    expect(sum.raw).toBe('ture');
    expect(isQuizWindowOpen(session, evening)).toBe(false);
  });
});

describe('isQuizWindowOpen 认全天开关', () => {
  it('**开关关着 → 09:00 之后就是关的**（诚实返回，不偷偷放行）', () => {
    set(undefined);
    expect(isQuizWindowOpen(session, evening)).toBe(false);
  });

  it('**开关打开 → 同一天晚上仍然开着**（已建好的场次也生效）', () => {
    set('true');
    expect(isQuizWindowOpen(session, evening)).toBe(true);
  });

  it('时间矩阵：当天这几个时刻全部开着', () => {
    set('true');
    for (const hhmm of ['07:30', '08:30', '10:30', '13:00', '16:30', '20:00', '23:50']) {
      const [h, m] = hhmm.split(':').map(Number);
      // SGT → UTC
      const shifted = h - 8;
      const d = new Date(Date.UTC(2026, 7, shifted < 0 ? 26 : 27, (shifted + 24) % 24, m));
      expect({ hhmm, open: isQuizWindowOpen(session, d) }).toEqual({ hhmm, open: true });
    }
  });

  it('**历史欠交可补做** —— 第二天仍能打开昨天的卷子', () => {
    set('true');
    expect(isQuizWindowOpen(session, new Date('2026-08-28T04:00:00Z'))).toBe(true);
  });

  it('未来的卷子不能提前打开', () => {
    set('true');
    const futureSession = { ...session, date: new Date('2026-08-29T00:00:00Z') };
    expect(isQuizWindowOpen(futureSession, new Date('2026-08-28T04:00:00Z'))).toBe(false);
  });

  it('按班灰度：没开的班照旧按时刻判断', () => {
    set('c9');
    expect(isQuizWindowOpen(session, evening)).toBe(false);
    expect(isQuizWindowOpen({ ...session, classId: 'c9' }, evening)).toBe(true);
  });

  it('不带 classId 的调用方保持原行为（不因为开关而改变）', () => {
    set('true');
    expect(isQuizWindowOpen({ quizEnd: session.quizEnd, makeupStart: null, makeupEnd: null }, evening))
      .toBe(false);
  });
});

describe('effectiveEndsAt —— 倒计时绑的截止时刻', () => {
  it('**开关打开 → 截止时刻是当天 23:59，不是 09:00**', () => {
    // 不改这里的话全天开放是假的：学生 09:01 进得来，倒计时却是 00:00，
    // 1.5 秒后自动交卷（浏览器实测抓到）。
    set('true');
    const end = effectiveEndsAt(session, evening);
    expect(end.toISOString()).toBe('2026-08-27T15:59:00.000Z'); // 23:59 SGT
    expect(end.getTime()).toBeGreaterThan(evening.getTime());
  });

  it('开关关着 → 仍是场次自己的 quizEnd', () => {
    set(undefined);
    expect(effectiveEndsAt(session, evening).toISOString()).toBe(session.quizEnd.toISOString());
  });

  it('历史欠交返回不会触发自动交卷的截止时刻', () => {
    set('true');
    const tomorrow = new Date('2026-08-28T04:00:00Z');
    expect(effectiveEndsAt(session, tomorrow).toISOString()).toBe('9999-12-31T23:59:59.000Z');
  });
});

describe('withinAllDay', () => {
  it('跨午夜：23:58 在当天，00:02 已经是第二天', () => {
    const d = new Date('2026-08-27T00:00:00Z');
    expect(withinAllDay(d, new Date('2026-08-27T15:58:00Z'))).toBe(true);  // 23:58 SGT
    expect(withinAllDay(d, new Date('2026-08-27T16:02:00Z'))).toBe(false); // 次日 00:02 SGT
  });

  it('当天 00:01 与 23:58 都算「在当天」', () => {
    const d = new Date('2026-08-27T00:00:00Z');
    expect(withinAllDay(d, new Date('2026-08-26T16:01:00Z'))).toBe(true);  // 8/27 00:01 SGT
    expect(withinAllDay(d, new Date('2026-08-27T15:58:00Z'))).toBe(true);
  });
});
