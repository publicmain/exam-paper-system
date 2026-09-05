import { describe, expect, it } from 'vitest';
import { referenceOf } from '../MarkerScript';

/**
 * 老师批卷页的「参考答案 · 评分标准」从哪里取 —— 2026-09-05 首发前补的。
 * 快照（snapshotAnswer）优先于题库现值（question.answerContent）；
 * 旧 fixture 的 markScheme / exampleAnswer 也要能显示。
 */
describe('referenceOf', () => {
  it('首发周内容包：text / accept / rubric / evidence 全部取到', () => {
    const r = referenceOf({
      snapshotAnswer: {
        text: 'boiled',
        accept: ['boiled', 'Boiled'],
        rubric: '一分：只认原文里的 “boiled”（大小写不计）。',
        evidence: 'Tea is made with boiled water.',
      },
      question: { answerContent: { text: '题库改过的值' } },
    });
    expect(r.text).toBe('boiled');
    // 只差大小写的可接受写法不单列
    expect(r.accept).toEqual([]);
    expect(r.rubric).toContain('只认原文');
    expect(r.evidence).toBe('Tea is made with boiled water.');
    expect(r.example).toBeNull();
  });

  it('accept 里真正不同的写法要列出来', () => {
    const r = referenceOf({
      snapshotAnswer: { text: 'glass cases', accept: ['glass cases', 'sealed glass cases', 'Glass Cases'] },
    });
    expect(r.accept).toEqual(['sealed glass cases']);
  });

  it('快照没有 → 回退到 question.answerContent；旧字段 markScheme / exampleAnswer 也认', () => {
    const r = referenceOf({
      snapshotAnswer: null,
      question: {
        answerContent: {
          correctAnswer: 'ii',
          markScheme: '1 分：答出 ii 或 heading (ii)。',
          exampleAnswer: 'ii',
        },
      },
    });
    expect(r.text).toBe('ii');
    expect(r.rubric).toContain('1 分');
    expect(r.example).toBe('ii');
  });

  it('什么都没有 → 全空，不抛', () => {
    expect(referenceOf({})).toEqual({ text: null, accept: [], rubric: null, evidence: null, example: null });
    expect(referenceOf({ snapshotAnswer: 'oops', question: { answerContent: [] } })).toEqual({
      text: null, accept: [], rubric: null, evidence: null, example: null,
    });
  });
});
