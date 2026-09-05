import { describe, expect, it } from 'vitest';
import { resolveResultExplanation, stripUnreleasedScores } from './morning-quiz.service';

/**
 * 结果页的解析从哪里来 —— 2026-09-05 首发前复核时发现的洞。
 *
 * 发布脚本把 `explanation` / `evidence` 写在 `answerContent`（Question）
 * 和 `snapshotAnswer`（PaperQuestion）里，`snapshotContent` 只有题干与
 * 原文。结果接口原来只读 `snapshotContent.explanation`，于是首发周 250
 * 道题在学生的结果页一条解析都没有。这里钉死三级回退，以及「答案门
 * 没开就一起置空」。
 */

describe('resolveResultExplanation —— 三级回退', () => {
  it('snapshotContent 有就用 snapshotContent（旧 fixture 的写法）', () => {
    const r = resolveResultExplanation({
      snapshotContent: { explanation: '旧写法', evidence: '旧证据' },
      snapshotAnswer: { explanation: '新写法' },
      question: { answerContent: { explanation: '题库写法' } },
    });
    expect(r.explanation).toBe('旧写法');
    expect(r.evidence).toBe('旧证据');
  });

  it('snapshotContent 没有 → 读 snapshotAnswer（发布脚本的写法）', () => {
    const r = resolveResultExplanation({
      snapshotContent: { stem: 'Q1', passage: '…' },
      snapshotAnswer: { text: 'B', explanation: '原文的对应句与题干一致，所以选 TRUE。', evidence: 'Tea is made with boiled water.' },
      question: { answerContent: { explanation: '题库写法' } },
    });
    expect(r.explanation).toBe('原文的对应句与题干一致，所以选 TRUE。');
    expect(r.evidence).toBe('Tea is made with boiled water.');
  });

  it('前两处都没有 → 读 question.answerContent', () => {
    const r = resolveResultExplanation({
      snapshotContent: {},
      snapshotAnswer: null,
      question: { answerContent: { explanation: '题库写法', evidence: 'E' } },
    });
    expect(r).toEqual({ explanation: '题库写法', evidence: 'E' });
  });

  it('三处都没有 → 两项都是 null，不抛', () => {
    expect(resolveResultExplanation({ snapshotContent: null })).toEqual({ explanation: null, evidence: null });
    expect(resolveResultExplanation({ snapshotContent: 'oops', snapshotAnswer: [], question: null })).toEqual({
      explanation: null,
      evidence: null,
    });
  });

  it('解析已经把证据句写进去了 → 不再重复给 evidence', () => {
    const evidence = 'Most of those plants died anyway.';
    const r = resolveResultExplanation({
      snapshotAnswer: { explanation: `答案依据原文这一句：${evidence}`, evidence },
    });
    expect(r.explanation).toContain(evidence);
    expect(r.evidence).toBeNull();
  });

  it('解析超长截到 600 字并加省略号', () => {
    const r = resolveResultExplanation({ snapshotAnswer: { explanation: 'x'.repeat(1000) } });
    expect(r.explanation).toHaveLength(601);
    expect(r.explanation!.endsWith('…')).toBe(true);
  });

  it('证据是整段原文（>320 字）→ 不给，而不是截一半', () => {
    const paragraph = 'The plantations that resulted were built on a labour system. '.repeat(8);
    expect(paragraph.length).toBeGreaterThan(320);
    const r = resolveResultExplanation({
      snapshotAnswer: { explanation: '这条信息出现在 Paragraph F。', evidence: paragraph },
    });
    expect(r.explanation).toBe('这条信息出现在 Paragraph F。');
    expect(r.evidence).toBeNull();
  });

  it('空字符串视同没有，继续往下找', () => {
    const r = resolveResultExplanation({
      snapshotContent: { explanation: '   ' },
      snapshotAnswer: { explanation: '', evidence: '' },
      question: { answerContent: { explanation: '兜底' } },
    });
    expect(r.explanation).toBe('兜底');
    expect(r.evidence).toBeNull();
  });
});

describe('evidence 与 explanation 走同一道答案门', () => {
  const base = {
    status: 'submitted',
    autoScore: 1,
    manualScore: null,
    totalScore: null,
    maxScore: 10,
    items: [
      {
        studentAnswer: 'B',
        questionType: 'mcq',
        awardedMarks: 1,
        autoCorrect: true,
        isCorrect: true,
        markerComment: null,
        commentSource: null,
        correctAnswer: 'B',
        referenceAnswer: null,
        explanation: '解析',
        evidence: '证据句',
      },
    ],
  };

  it('暂存提交（还能改）→ evidence 也置空', () => {
    const r = stripUnreleasedScores({ ...base, finalSubmittedAt: null } as any);
    expect(r.answersPending).toBe(true);
    expect((r.items[0] as any).explanation).toBeNull();
    expect((r.items[0] as any).evidence).toBeNull();
  });

  it('最终提交 → evidence 与 explanation 一起放行', () => {
    const r = stripUnreleasedScores({ ...base, finalSubmittedAt: new Date() } as any);
    expect(r.answersPending).toBe(false);
    expect((r.items[0] as any).explanation).toBe('解析');
    expect((r.items[0] as any).evidence).toBe('证据句');
  });
});
