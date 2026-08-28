/**
 * AC-04 —— 草稿合并（纯函数）。
 *
 * 前八条是从 `apps/web/src/components/exam/__tests__/draft-merge.test.ts`
 * 逐条搬过来的**同一批用例**（源码可证的既有行为），后面是本轮补的
 * null / 缺失 / 坏缓存边界。
 */
import { describe, it, expect } from 'vitest';
import { mergeDrafts } from '../lesson/draftMerge';

describe('AC-04 搬运过来的既有用例', () => {
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
    const r = mergeDrafts({ q2: { textAnswer: '弱网时写的' } }, { q2: 1 }, {}, {});
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

describe('AC-04 本轮补的边界', () => {
  it('**本地序号为 null → 信服务端**（不是当成 0 去比大小）', () => {
    const r = mergeDrafts(
      { q1: { textAnswer: '本地' } }, { q1: null as unknown as number },
      { q1: { textAnswer: '服务端' } }, { q1: 0 },
    );
    expect(r.answers.q1.textAnswer).toBe('服务端');
    expect(r.resend).toEqual([]);
  });

  it('**两边都是 0 → 信服务端**（0 是合法序号，不是「没有」）', () => {
    const r = mergeDrafts(
      { q1: { textAnswer: '本地' } }, { q1: 0 },
      { q1: { textAnswer: '服务端' } }, { q1: 0 },
    );
    expect(r.answers.q1.textAnswer).toBe('服务端');
  });

  it('**本地 1 > 服务端 0 → 本地赢**', () => {
    const r = mergeDrafts(
      { q1: { textAnswer: '本地' } }, { q1: 1 },
      { q1: { textAnswer: '服务端' } }, { q1: 0 },
    );
    expect(r.answers.q1.textAnswer).toBe('本地');
    expect(r.resend).toEqual(['q1']);
  });

  it('**空缓存不能抹掉服务端答案**', () => {
    const r = mergeDrafts({}, {}, { q1: { textAnswer: '服务端' } }, { q1: 2 });
    expect(r.answers.q1.textAnswer).toBe('服务端');
    expect(r.resend).toEqual([]);
  });

  it('**缓存里混进 undefined 值也不能抹掉服务端答案**', () => {
    const cached = { q1: undefined } as unknown as Record<string, { textAnswer?: string }>;
    const r = mergeDrafts(cached, {}, { q1: { textAnswer: '服务端' } }, { q1: 2 });
    expect(r.answers.q1.textAnswer).toBe('服务端');
  });

  it('**逐题独立**：一题走本地不影响另一题走服务端', () => {
    const r = mergeDrafts(
      { a: { textAnswer: 'LA' }, b: { textAnswer: 'LB' } }, { a: 9, b: 1 },
      { a: { textAnswer: 'SA' }, b: { textAnswer: 'SB' } }, { a: 1, b: 9 },
    );
    expect(r.answers.a.textAnswer).toBe('LA');
    expect(r.answers.b.textAnswer).toBe('SB');
  });

  it('**确定性**：同样的输入跑两次结果逐字节相同', () => {
    const cached = { a: { textAnswer: 'LA' }, c: { textAnswer: 'LC' } };
    const cachedSeqs = { a: 9, c: 1 };
    const server = { a: { textAnswer: 'SA' }, b: { textAnswer: 'SB' } };
    const serverSeqs = { a: 1, b: 2 };
    const r1 = mergeDrafts(cached, cachedSeqs, server, serverSeqs);
    const r2 = mergeDrafts(cached, cachedSeqs, server, serverSeqs);
    expect(JSON.stringify(r1)).toBe(JSON.stringify(r2));
  });

  it('**不改动入参**', () => {
    const cached = { q1: { textAnswer: 'L' } };
    const server = { q1: { textAnswer: 'S' } };
    mergeDrafts(cached, { q1: 9 }, server, { q1: 1 });
    expect(server.q1.textAnswer).toBe('S');
    expect(cached.q1.textAnswer).toBe('L');
  });
});
