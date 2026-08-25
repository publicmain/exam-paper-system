import { describe, expect, it } from 'vitest';

/**
 * 学生看不到答案 —— 契约测试（2026-08-25 外部审查 P2-3 建议）。
 *
 * 审查担心 `snapshotOptions[].correct` 会随发卷接口流到前端，学生一开
 * F12 就知道答案。核查结果：服务端**确实**剥离了（`stripOptions` 是
 * 显式白名单，只保留 key/text）。但当时**没有任何测试锁住这个行为** ——
 * 白名单被改回黑名单、或有人加了新字段忘了过滤，都不会有人发现。
 *
 * 这里把「发给学生的选项只能有 key 和 text」钉死。逻辑与
 * morning-quiz.service 内的 stripOptions 保持同一份语义（那里有两处
 * 同款实现：发卷与练习模式）。
 */

/** 与生产同款：显式白名单，任何未列出的字段一律丢弃。 */
const stripOptions = (opts: unknown) => {
  if (!Array.isArray(opts)) return opts;
  return opts.map((o: any) => ({ key: o?.key, text: o?.text }));
};

describe('发给学生的选项必须剥掉答案', () => {
  const raw = [
    { key: 'A', text: 'TRUE', correct: true },
    { key: 'B', text: 'FALSE', correct: false },
    { key: 'C', text: 'NOT GIVEN', correct: false },
  ];

  it('correct 字段一律不出现', () => {
    const out = stripOptions(raw) as any[];
    for (const o of out) {
      expect(o).not.toHaveProperty('correct');
      expect(Object.keys(o).sort()).toEqual(['key', 'text']);
    }
  });

  it('序列化后整个 JSON 里搜不到 correct', () => {
    expect(JSON.stringify(stripOptions(raw))).not.toContain('correct');
  });

  it('未来新增的答案类字段自动被丢弃（白名单而非黑名单）', () => {
    const withFutureFields = [
      { key: 'A', text: 'TRUE', correct: true, explanation: '因为原文第2段', score: 1, isAnswer: true },
    ];
    const out = stripOptions(withFutureFields) as any[];
    expect(Object.keys(out[0]).sort()).toEqual(['key', 'text']);
    expect(JSON.stringify(out)).not.toContain('原文第2段');
  });

  it('保留学生答题必需的 key 和 text', () => {
    const out = stripOptions(raw) as any[];
    expect(out.map((o) => o.key)).toEqual(['A', 'B', 'C']);
    expect(out.map((o) => o.text)).toEqual(['TRUE', 'FALSE', 'NOT GIVEN']);
  });

  it('非数组原样返回，不炸', () => {
    expect(stripOptions(null)).toBeNull();
    expect(stripOptions(undefined)).toBeUndefined();
  });

  it('卷内词汇题的选项同样被剥（4 选 1 的 correct 不能漏）', () => {
    const vocab = [
      { key: 'A', text: 'vary', correct: false },
      { key: 'B', text: 'resource', correct: false },
      { key: 'C', text: 'trend', correct: false },
      { key: 'D', text: 'evidence', correct: true },
    ];
    expect(JSON.stringify(stripOptions(vocab))).not.toContain('correct');
  });
});
