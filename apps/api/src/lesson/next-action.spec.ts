import { describe, it, expect } from 'vitest';
import { nextActionOf, type NextActionFacts } from './next-action';

/**
 * P8 —— 阶段到下一步的映射。
 *
 * 每个阶段**只给一个**主要动作。这些测试同时钉住修复前的两处断裂：
 * 没开始的学生必须有「开始阅读」的入口；走到该考的阶段必须指向正式测试
 * 而不是翻卡页。
 */

const f = (over: Partial<NextActionFacts> = {}): NextActionFacts => ({
  stage: 'reading',
  hasSession: true,
  opened: false,
  finalSubmitted: false,
  sessionId: 'sess1',
  submissionId: null,
  vocabTestAvailable: true,
  ...over,
});

describe('nextActionOf', () => {
  it('**卷子还没开出来 → 说「去扫码」，不给一个打不开的链接**', () => {
    // 浏览器实测：答卷是扫码时建的。没有它，/morning-quiz/:id 看得到题
    // 却存不下答案（no_submission）—— 比没有入口更糟。
    const a = nextActionOf(f());
    expect(a.kind).toBe('scan_required');
    expect(a.href).toBeNull();
  });

  it('做了一半 → 继续做题，回同一场', () => {
    const a = nextActionOf(f({ opened: true }));
    expect(a.kind).toBe('resume_reading');
    expect(a.href).toBe('/morning-quiz/sess1');
  });

  it('交了卷但阶段没往前 → 先看阅读结果', () => {
    const a = nextActionOf(f({ opened: true, finalSubmitted: true, submissionId: 'sub1' }));
    expect(a.kind).toBe('read_result');
    expect(a.href).toBe('/my-history/submission/sub1');
  });

  it('今天没排文章 → 不给一个点了会失望的按钮', () => {
    const a = nextActionOf(f({ hasSession: false }));
    expect(a.kind).toBe('none');
    expect(a.href).toBeNull();
  });

  it('vocab_learn → 学新词（翻卡）', () => {
    const a = nextActionOf(f({ stage: 'vocab_learn' }));
    expect(a.kind).toBe('learn_vocab');
    expect(a.href).toBe('/my-vocab/review');
  });

  it('**vocab_test → 正式测试**，不是翻卡页', () => {
    const a = nextActionOf(f({ stage: 'vocab_test' }));
    expect(a.kind).toBe('vocab_test');
    expect(a.href).toBe('/my-vocab/quiz');
    expect(a.href).not.toBe('/my-vocab/review');
  });

  it('**旧任务：stage=vocab_test 但开不出测试 → 给总结，不给死按钮**', () => {
    const a = nextActionOf(f({ stage: 'vocab_test', vocabTestAvailable: false }));
    expect(a.kind).toBe('summary');
    expect(a.href).toBe('/my-lesson/summary');
  });

  it('done → 任务总结', () => {
    const a = nextActionOf(f({ stage: 'done' }));
    expect(a.kind).toBe('summary');
    expect(a.href).toBe('/my-lesson/summary');
  });

  it('每个阶段的动作两两不同 —— 学生不会在两个入口之间犹豫', () => {
    const kinds = (['reading', 'vocab_learn', 'vocab_test', 'done'] as const).map(
      (stage) => nextActionOf(f({ stage })).kind,
    );
    expect(new Set(kinds).size).toBe(kinds.length);
  });

  it('缺 sessionId 时不给一个断链（href 为 null 而不是 /morning-quiz/null）', () => {
    const a = nextActionOf(f({ sessionId: null }));
    expect(a.href).toBeNull();
  });
});
