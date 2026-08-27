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
  availability: 'ready',
  opened: false,
  finalSubmitted: false,
  sessionId: 'sess1',
  submissionId: null,
  vocabTestAvailable: true,
  hasAnyTask: true,
  ...over,
});

describe('nextActionOf', () => {
  it('**P9：有课但还没开始 → 「开始今天的课程」**（不再让学生去扫码）', () => {
    const a = nextActionOf(f());
    expect(a.kind).toBe('ready_to_start');
    // href 为空是故意的 —— 开始是一次 POST，不是一个链接。答卷建好之后
    // 服务端才知道该去哪一场。
    expect(a.href).toBeNull();
  });

  it('今天没排课 / 没挂卷子 → no_content，**不提扫码**', () => {
    const a = nextActionOf(f({ availability: 'no_content' }));
    expect(a.kind).toBe('no_content');
    expect(a.label).toContain('还没有发布');
    expect(a.label).not.toContain('扫码');
  });

  it('有课但过了作答时间 → window_closed（不谎称没有内容）', () => {
    const a = nextActionOf(f({ availability: 'window_closed' }));
    expect(a.kind).toBe('window_closed');
  });

  it('难度没定且今天开着好几层 → level_not_set，指向老师', () => {
    const a = nextActionOf(f({ availability: 'level_not_set' }));
    expect(a.kind).toBe('level_not_set');
    expect(a.label).toContain('老师');
  });

  it('**没有任何一条下一步会写着「扫码」**（P9：扫码不再是必经入口）', () => {
    const all = [
      f(),
      f({ availability: 'no_content' }),
      f({ availability: 'window_closed' }),
      f({ availability: 'level_not_set' }),
      f({ opened: true }),
      f({ opened: true, finalSubmitted: true, submissionId: 'sub1' }),
      f({ stage: 'vocab_learn' }),
      f({ stage: 'vocab_test' }),
      f({ stage: 'done' }),
    ];
    for (const facts of all) {
      expect(nextActionOf(facts).label).not.toContain('扫码');
    }
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

  it('**今天一件事都没有 → 说没发布，不是「看今天的总结」**', () => {
    // 三段目标全 0 时 stage 直接落到 done —— 那是「没有任何目标」的
    // 副产物，不是他做完了。给他一份空总结是在骗人。
    const a = nextActionOf(f({ stage: 'done', availability: 'no_content', hasAnyTask: false }));
    expect(a.kind).toBe('no_content');
  });

  it('今天有任务且做完了 → 才是「看今天的总结」', () => {
    const a = nextActionOf(f({ stage: 'done', hasAnyTask: true }));
    expect(a.kind).toBe('summary');
    expect(a.href).toBe('/my-lesson/summary');
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
