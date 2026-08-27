import { describe, it, expect } from 'vitest';
import { acceptsWrite, seqWhereClause, displayKeyOf } from './answer-seq';

/**
 * P8.5 —— 答案草稿的两条规则。
 *
 * 测的是 `answer-seq.ts` 里的真函数，saveAnswer / getStudentView 用的
 * 就是它们 —— 不是在测试里另抄一份判断。
 */

describe('条件写入：哪次写该落库', () => {
  it('更大的序号覆盖', () => {
    expect(acceptsWrite(3, 4)).toBe(true);
  });

  it('**更小的序号被拒** —— 迟到的旧请求不许覆盖新答案', () => {
    expect(acceptsWrite(6, 3)).toBe(false);
  });

  it('**相同序号被拒** —— 重试打的是同一次写，第一次已经落库了', () => {
    expect(acceptsWrite(2, 2)).toBe(false);
  });

  it('库里没有序号（历史行）时放行', () => {
    expect(acceptsWrite(null, 1)).toBe(true);
  });

  it('不带序号的老客户端照常写入 —— 升级期间不挡人', () => {
    expect(acceptsWrite(5, undefined)).toBe(true);
  });

  it('连续快改后，迟到的第一次重试改不动最终答案', () => {
    let stored: number | null = null;
    let text = '';
    for (const [seq, val] of [[1, '第 1 次'], [2, '第 2 次'], [3, '第 3 次']] as Array<[number, string]>) {
      if (acceptsWrite(stored, seq)) { stored = seq; text = val; }
    }
    if (acceptsWrite(stored, 1)) text = '第 1 次（迟到的）';
    expect(text).toBe('第 3 次');
    expect(stored).toBe(3);
  });

  it('乱序到达：先到 5 再到 4，留下的是 5', () => {
    let stored: number | null = null;
    const arrive = (seq: number) => { if (acceptsWrite(stored, seq)) stored = seq; };
    arrive(5);
    arrive(4);
    expect(stored).toBe(5);
  });

  it('where 子句与 acceptsWrite 表达同一个条件', () => {
    const w = seqWhereClause(4);
    // 两个分支：库里没序号，或库里的更小
    expect(w.OR).toEqual([{ clientSeq: null }, { clientSeq: { lt: 4 } }]);
    // 逐个核对：where 放行的，acceptsWrite 也放行
    for (const stored of [null, 0, 3, 4, 5] as Array<number | null>) {
      const byWhere = stored === null || stored < 4;
      expect(byWhere).toBe(acceptsWrite(stored, 4));
    }
  });
});

describe('恢复时的 MCQ 选项映射', () => {
  // 打乱表：显示位置 0 放的是原始第 1 个选项，以此类推
  const order = [1, 0, 3, 2];
  const keys = ['A', 'B', 'C', 'D'];

  it('**恢复的是学生点的那个选项**（实测：曾经亮的是另一个）', () => {
    // 学生点了显示的第 1 个 = 原始 index 1 = 存库 key 'B'
    expect(displayKeyOf(order, keys, 'B')).toBe('A');
  });

  it('每个原始 key 都翻回正确的显示字母', () => {
    expect(keys.map((k) => displayKeyOf(order, keys, k))).toEqual(['B', 'A', 'D', 'C']);
  });

  it('往返一致：显示字母 → 原始 key → 显示字母', () => {
    for (let shown = 0; shown < order.length; shown++) {
      const originalKey = keys[order[shown]];        // 保存时的反查
      const back = displayKeyOf(order, keys, originalKey); // 恢复时的正查
      expect(back).toBe(String.fromCharCode(65 + shown));
    }
  });

  it('这题没打乱 → null（照原样用）', () => {
    expect(displayKeyOf(undefined, keys, 'B')).toBeNull();
  });

  it('key 不在选项里 → null，不瞎猜', () => {
    expect(displayKeyOf(order, keys, 'Z')).toBeNull();
  });
});
