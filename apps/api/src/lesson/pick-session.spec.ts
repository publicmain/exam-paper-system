import { describe, it, expect } from 'vitest';
import { pickTodaySession, type SessionCandidate } from './pick-session';

/**
 * P9 —— 账号制入口下「今天上哪一场」的规则。
 *
 * 最要命的一条是**确定性**：同一个学生同一天反复调用必须落到同一场。
 * 选错场次不是显示问题 —— 不同场次是不同 assignment，答卷唯一索引拦不住，
 * 学生会多出一份正式答卷。
 */

const s = (over: Partial<SessionCandidate> & { id: string; level: any }): SessionCandidate => ({
  hasPaper: true,
  windowOpen: true,
  ...over,
});

describe('pickTodaySession', () => {
  it('今天没排课 → no_content', () => {
    expect(pickTodaySession({ storedLevel: 'olevel' as any, candidates: [], isTestClass: false }))
      .toEqual({ kind: 'no_content' });
  });

  it('排了但没挂卷子 → no_content（不是「窗口关了」）', () => {
    const r = pickTodaySession({
      storedLevel: 'olevel' as any,
      candidates: [s({ id: 'a', level: 'olevel', hasPaper: false })],
      isTestClass: false,
    });
    expect(r).toEqual({ kind: 'no_content' });
  });

  it('**有内容但此刻不能作答 → window_closed，不谎称没有内容**', () => {
    const r = pickTodaySession({
      storedLevel: 'olevel' as any,
      candidates: [s({ id: 'a', level: 'olevel', windowOpen: false })],
      isTestClass: false,
    });
    expect(r).toEqual({ kind: 'window_closed' });
  });

  it('学生那层开着 → 进他那层', () => {
    const r = pickTodaySession({
      storedLevel: 'olevel' as any,
      candidates: [s({ id: 'ielts', level: 'ielts_authentic' }), s({ id: 'ol', level: 'olevel' })],
      isTestClass: false,
    });
    expect(r).toEqual({ kind: 'session', sessionId: 'ol', level: 'olevel', land: null });
  });

  it('**他那层没开 → 临时参加别的层，但不改写难度**（P4 既定规则）', () => {
    const r = pickTodaySession({
      storedLevel: 'olevel' as any,
      candidates: [s({ id: 'ielts', level: 'ielts_authentic' })],
      isTestClass: false,
    });
    expect(r).toEqual({
      kind: 'session', sessionId: 'ielts', level: 'ielts_authentic', land: null,
    });
  });

  it('还没定难度 + 今天只开一层 → 进它并落定（P4 首次落定）', () => {
    const r = pickTodaySession({
      storedLevel: null,
      candidates: [s({ id: 'ol', level: 'olevel' })],
      isTestClass: false,
    });
    expect(r).toEqual({ kind: 'session', sessionId: 'ol', level: 'olevel', land: 'olevel' });
  });

  it('**还没定难度 + 开了好几层 → 不替他猜**（猜错会被首次落定固化）', () => {
    const r = pickTodaySession({
      storedLevel: null,
      candidates: [s({ id: 'ielts', level: 'ielts_authentic' }), s({ id: 'ol', level: 'olevel' })],
      isTestClass: false,
    });
    expect(r).toEqual({ kind: 'level_not_set' });
  });

  it('【测试】班 → 取第一场，不落定难度', () => {
    const r = pickTodaySession({
      storedLevel: null,
      candidates: [s({ id: 'b', level: 'olevel' }), s({ id: 'a', level: 'ielts_authentic' })],
      isTestClass: true,
    });
    expect(r).toEqual({
      kind: 'session', sessionId: 'a', level: 'ielts_authentic', land: null,
    });
  });

  it('**确定性：候选顺序打乱，选出来的是同一场**（顺序不定 = 两份答卷）', () => {
    const cands = [
      s({ id: 'z', level: 'olevel' }),
      s({ id: 'a', level: 'ielts_simplified' }),
      s({ id: 'm', level: 'ielts_authentic' }),
    ];
    const first = pickTodaySession({ storedLevel: null as any, candidates: cands, isTestClass: true });
    for (const perm of [
      [cands[2], cands[0], cands[1]],
      [cands[1], cands[2], cands[0]],
      [...cands].reverse(),
    ]) {
      expect(pickTodaySession({ storedLevel: null as any, candidates: perm, isTestClass: true }))
        .toEqual(first);
    }
  });

  it('确定性：同层多场时按 id 稳定挑（不看数据库返回顺序）', () => {
    const a = s({ id: 'aaa', level: 'olevel' });
    const b = s({ id: 'bbb', level: 'olevel' });
    expect(pickTodaySession({ storedLevel: 'olevel' as any, candidates: [b, a], isTestClass: false }))
      .toEqual(pickTodaySession({ storedLevel: 'olevel' as any, candidates: [a, b], isTestClass: false }));
  });

  it('关着的场次不参与挑选 —— 他那层关了、别层开着就进别层', () => {
    const r = pickTodaySession({
      storedLevel: 'olevel' as any,
      candidates: [
        s({ id: 'ol', level: 'olevel', windowOpen: false }),
        s({ id: 'ielts', level: 'ielts_authentic' }),
      ],
      isTestClass: false,
    });
    expect(r).toEqual({
      kind: 'session', sessionId: 'ielts', level: 'ielts_authentic', land: null,
    });
  });
});
