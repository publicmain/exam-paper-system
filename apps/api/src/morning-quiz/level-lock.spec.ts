import { describe, it, expect } from 'vitest';
import { decideLevel } from './level-lock';

/**
 * P4 —— 难度单一事实来源的规则测试。
 *
 * 这些是纯函数测试，不需要数据库。它们钉死的是**判断**本身：谁能改
 * 难度、什么时候落定、什么时候拒绝。扫码链路的其余部分（考勤、答卷、
 * 词表）与这里无关。
 */

const SIBS = [
  { id: 's_authentic', level: 'ielts_authentic' as const },
  { id: 's_olevel', level: 'olevel' as const },
  { id: 's_basic', level: 'ielts_simplified' as const },
];

describe('decideLevel — 首次落定', () => {
  it('englishLevel=null 的新学生：这次进哪层，哪层就是他的难度', () => {
    const d = decideLevel({
      storedLevel: null,
      session: { id: 's_olevel', level: 'olevel' },
      activeSiblings: SIBS,
      isTestClass: false,
    });
    expect(d).toEqual({ kind: 'land', level: 'olevel' });
  });

  it('undefined（老代码路径没 select 到这列）等同 null，不会误判成已落定', () => {
    const d = decideLevel({
      storedLevel: undefined,
      session: { id: 's_basic', level: 'ielts_simplified' },
      activeSiblings: SIBS,
      isTestClass: false,
    });
    expect(d).toEqual({ kind: 'land', level: 'ielts_simplified' });
  });
});

describe('decideLevel — 已落定的学生', () => {
  it('本场就是他那层 → 放行，不重复写库', () => {
    const d = decideLevel({
      storedLevel: 'olevel',
      session: { id: 's_olevel', level: 'olevel' },
      activeSiblings: SIBS,
      isTestClass: false,
    });
    expect(d).toEqual({ kind: 'proceed' });
  });

  it('**要进别的层、而他那层今天开着 → 拒绝**，并给出正确场次', () => {
    const d = decideLevel({
      storedLevel: 'ielts_authentic',
      session: { id: 's_basic', level: 'ielts_simplified' },
      activeSiblings: SIBS,
      isTestClass: false,
    });
    expect(d).toEqual({
      kind: 'locked',
      lockedLevel: 'ielts_authentic',
      correctSessionId: 's_authentic',
    });
  });

  it('要进别的层、但他那层今天**没开** → 放行（不能把人挡在早测门外），且不改写难度', () => {
    const d = decideLevel({
      storedLevel: 'ielts_light', // 今天没排这层
      session: { id: 's_olevel', level: 'olevel' },
      activeSiblings: SIBS,
      isTestClass: false,
    });
    // proceed 而不是 land —— land 会把他改成 olevel，那就是「无意覆盖」
    expect(d).toEqual({ kind: 'proceed' });
  });

  it('放行的分支绝不返回 land —— 已落定的难度不能被扫码改写', () => {
    for (const sess of SIBS) {
      const d = decideLevel({
        storedLevel: 'ielts_light',
        session: { id: sess.id, level: sess.level },
        activeSiblings: SIBS,
        isTestClass: false,
      });
      expect(d.kind).not.toBe('land');
    }
  });
});

describe('decideLevel — 【测试】班旋转门', () => {
  it('测试班永远 proceed：既不落定也不拒绝（教师要「随意测试随意进入」）', () => {
    const asNew = decideLevel({
      storedLevel: null,
      session: { id: 's_olevel', level: 'olevel' },
      activeSiblings: SIBS,
      isTestClass: true,
    });
    expect(asNew).toEqual({ kind: 'proceed' });

    const asLocked = decideLevel({
      storedLevel: 'ielts_authentic',
      session: { id: 's_basic', level: 'ielts_simplified' },
      activeSiblings: SIBS,
      isTestClass: true,
    });
    expect(asLocked).toEqual({ kind: 'proceed' });
  });
});

describe('decideLevel — 边界', () => {
  it('siblings 为空（数据异常）时不崩，按放行处理', () => {
    const d = decideLevel({
      storedLevel: 'ielts_authentic',
      session: { id: 's_olevel', level: 'olevel' },
      activeSiblings: [],
      isTestClass: false,
    });
    expect(d).toEqual({ kind: 'proceed' });
  });

  it('本场就在 siblings 里且等于 stored 时，不会把自己当成「要去别层」', () => {
    const d = decideLevel({
      storedLevel: 'ielts_simplified',
      session: { id: 's_basic', level: 'ielts_simplified' },
      activeSiblings: SIBS,
      isTestClass: false,
    });
    expect(d.kind).toBe('proceed');
  });
});
