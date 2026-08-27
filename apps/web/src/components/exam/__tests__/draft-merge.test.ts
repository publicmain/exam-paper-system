import { describe, it, expect } from 'vitest';
import { mergeDrafts } from '../draftMerge';

/**
 * P8.5 —— 打开卷子时，本地缓存与服务端答案怎么合。
 *
 * 两个方向都会出事，所以只能按序号判断谁更新：
 *
 * - **服务端无条件优先** → 丢掉还没传上去的输入（弱网、次要标签、
 *   页面被直接关掉）。页面显示「已答」而服务端一无所知，交卷时那题是空的。
 * - **本地无条件优先** → 旧设备上的旧答案盖掉新设备刚写的。
 */

describe('草稿合并', () => {
  it('本地更新（序号更大）→ 用本地，并补传', () => {
    const r = mergeDrafts(
      { q1: { textAnswer: '本地新' } }, { q1: 5 },
      { q1: { textAnswer: '服务端旧' } }, { q1: 3 },
    );
    expect(r.answers.q1.textAnswer).toBe('本地新');
    expect(r.resend).toEqual(['q1']);
  });

  it('服务端更新（换设备回到旧机器）→ 用服务端，不补传', () => {
    const r = mergeDrafts(
      { q1: { textAnswer: '旧设备写的' } }, { q1: 2 },
      { q1: { textAnswer: '新设备写的' } }, { q1: 7 },
    );
    expect(r.answers.q1.textAnswer).toBe('新设备写的');
    expect(r.resend).toEqual([]);
  });

  it('**序号相同 → 信服务端**（同一次写，服务端那份确定存下来了）', () => {
    const r = mergeDrafts(
      { q1: { textAnswer: '本地' } }, { q1: 4 },
      { q1: { textAnswer: '服务端' } }, { q1: 4 },
    );
    expect(r.answers.q1.textAnswer).toBe('服务端');
    expect(r.resend).toEqual([]);
  });

  it('**只有本地有 → 必须补传**（这题服务端根本没收到过）', () => {
    const r = mergeDrafts(
      { q2: { textAnswer: '弱网时写的' } }, { q2: 1 },
      {}, {},
    );
    expect(r.answers.q2.textAnswer).toBe('弱网时写的');
    expect(r.resend).toEqual(['q2']);
  });

  it('只有服务端有 → 直接用，不补传', () => {
    const r = mergeDrafts({}, {}, { q3: { selectedOption: 'B' } }, { q3: 2 });
    expect(r.answers.q3.selectedOption).toBe('B');
    expect(r.resend).toEqual([]);
  });

  it('本地没有序号（老版本写的缓存）→ 信服务端', () => {
    const r = mergeDrafts(
      { q1: { textAnswer: '老缓存' } }, {},
      { q1: { textAnswer: '服务端' } }, { q1: 1 },
    );
    expect(r.answers.q1.textAnswer).toBe('服务端');
    expect(r.resend).toEqual([]);
  });

  it('服务端没有序号但本地有 → 本地更新，补传', () => {
    const r = mergeDrafts(
      { q1: { textAnswer: '本地' } }, { q1: 3 },
      { q1: { textAnswer: '没序号的历史行' } }, {},
    );
    expect(r.answers.q1.textAnswer).toBe('本地');
    expect(r.resend).toEqual(['q1']);
  });

  it('多题混合：各判各的', () => {
    const r = mergeDrafts(
      { a: { textAnswer: '本地 a' }, b: { textAnswer: '本地 b' }, c: { textAnswer: '只有本地 c' } },
      { a: 9, b: 1, c: 1 },
      { a: { textAnswer: '服务端 a' }, b: { textAnswer: '服务端 b' } },
      { a: 2, b: 8 },
    );
    expect(r.answers.a.textAnswer).toBe('本地 a');
    expect(r.answers.b.textAnswer).toBe('服务端 b');
    expect(r.answers.c.textAnswer).toBe('只有本地 c');
    expect(r.resend.sort()).toEqual(['a', 'c']);
  });
});
