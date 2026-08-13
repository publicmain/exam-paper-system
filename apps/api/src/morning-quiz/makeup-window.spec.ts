import { describe, expect, it } from 'vitest';
import { isMakeupWindowOpen, isQuizWindowOpen } from './morning-quiz.service';

/**
 * 补考窗口（学校 2026-08 新政：早上无故缺席 → 中午补考）。
 *
 * 这几条锁的是 2026-08-13 那次事故的教训：当天补考是拿 debug-activate
 * 开的，它把正式窗口 08:30/08:40/09:00 原地改写成 13:21/13:42/13:52，
 * 早上的真实时间没了、9 点生成的缺席行被删了，三名补考学生最后被记成
 * 「准时出勤」。补考窗口必须与正式窗口完全独立。
 */

const d = (iso: string) => new Date(iso);
// SGT = UTC+8：08:30 SGT = 00:30Z，09:00 SGT = 01:00Z，13:21 SGT = 05:21Z
const session = {
  quizEnd: d('2026-08-13T01:00:00Z'),      // 09:00 SGT
  makeupStart: d('2026-08-13T05:21:00Z'),  // 13:21 SGT
  makeupEnd: d('2026-08-13T05:51:00Z'),    // 13:51 SGT
};

describe('isQuizWindowOpen', () => {
  it('正式窗口内：开着', () => {
    expect(isQuizWindowOpen(session, d('2026-08-13T00:45:00Z'))).toBe(true);
  });

  it('正式窗口刚过、补考还没开：关着', () => {
    expect(isQuizWindowOpen(session, d('2026-08-13T02:00:00Z'))).toBe(false);
  });

  it('补考窗口内：又开着', () => {
    expect(isQuizWindowOpen(session, d('2026-08-13T05:30:00Z'))).toBe(true);
  });

  it('补考窗口过后：关着', () => {
    expect(isQuizWindowOpen(session, d('2026-08-13T06:00:00Z'))).toBe(false);
  });

  it('没开过补考的场次：只认正式窗口', () => {
    const plain = { quizEnd: session.quizEnd, makeupStart: null, makeupEnd: null };
    expect(isQuizWindowOpen(plain, d('2026-08-13T00:45:00Z'))).toBe(true);
    expect(isQuizWindowOpen(plain, d('2026-08-13T05:30:00Z'))).toBe(false);
  });
});

describe('isMakeupWindowOpen', () => {
  it('只有补考窗口内才为真 —— 早上正式考试期间不算补考', () => {
    expect(isMakeupWindowOpen(session, d('2026-08-13T00:45:00Z'))).toBe(false);
    expect(isMakeupWindowOpen(session, d('2026-08-13T05:30:00Z'))).toBe(true);
  });

  it('边界闭区间：开窗那一秒和关窗那一秒都算', () => {
    expect(isMakeupWindowOpen(session, session.makeupStart)).toBe(true);
    expect(isMakeupWindowOpen(session, session.makeupEnd)).toBe(true);
  });

  it('窗口字段缺一不可 —— 半个窗口不能让考试开着', () => {
    expect(isMakeupWindowOpen({ makeupStart: session.makeupStart, makeupEnd: null }, d('2026-08-13T05:30:00Z'))).toBe(false);
    expect(isMakeupWindowOpen({ makeupStart: null, makeupEnd: session.makeupEnd }, d('2026-08-13T05:30:00Z'))).toBe(false);
    expect(isMakeupWindowOpen({}, d('2026-08-13T05:30:00Z'))).toBe(false);
  });
});
