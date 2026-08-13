import { describe, expect, it } from 'vitest';
import {
  extractVocabWord,
  nextPracticeState,
  practiceKindOf,
  shouldCollect,
} from './mistake.service';

/**
 * 错题本收录门槛。这是整张表唯一的设计难点：门槛错了，错题本要么
 * 变成没人看的流水账，要么漏掉真正该复盘的题。
 */

const base = { studentAnswer: 'B', awarded: 0, maxMarks: 1, stem: 'Which paragraph…' };

describe('shouldCollect（收录门槛）', () => {
  it('满分不收 —— 错题本只装错的', () => {
    expect(shouldCollect({ ...base, awarded: 1, maxMarks: 1 }, 5)).toBeNull();
    expect(shouldCollect({ ...base, awarded: 2, maxMarks: 2 }, 5)).toBeNull();
  });

  it('空白一律不收 —— 那是行为问题不是知识问题', () => {
    // 这条是最重要的：迟到 20 分钟以上的学生空白率 95.6%，
    // 全收进来会用一堆"你没写"淹掉真正值得复盘的那几道。
    expect(shouldCollect({ ...base, studentAnswer: '' }, 99)).toBeNull();
    expect(shouldCollect({ ...base, studentAnswer: '   ' }, 99)).toBeNull();
    // 连长答题空着也不收
    expect(shouldCollect({ ...base, studentAnswer: '', maxMarks: 2 }, 0)).toBeNull();
  });

  it('词义题一律收（可直接推进生词本）', () => {
    const s = { ...base, stem: "What does the word 'elusive' suggest about the plan?" };
    expect(shouldCollect(s, 0)).toBe('vocabulary');
  });

  it('长答题（≥2 分）一律收 —— 老师评语是最贵的资产', () => {
    expect(shouldCollect({ ...base, maxMarks: 2, awarded: 1 }, 0)).toBe('long_answer');
    expect(shouldCollect({ ...base, maxMarks: 8, awarded: 3 }, 0)).toBe('long_answer');
  });

  it('普通 1 分题：第一次错不收，同题型再错才收', () => {
    // repeatCount = 该题型此前的错题条数
    expect(shouldCollect(base, 0)).toBeNull(); // 0 + 1 = 1 < 2
    expect(shouldCollect(base, 1)).toBe('repeated_tasktype'); // 1 + 1 = 2 ≥ 2
    expect(shouldCollect(base, 7)).toBe('repeated_tasktype');
  });

  it('规则优先级：词义题 > 长答题 > 反复错', () => {
    const vocabLong = {
      ...base,
      maxMarks: 2,
      stem: "What does 'arithmetic' suggest about the narrator?",
    };
    expect(shouldCollect(vocabLong, 0)).toBe('vocabulary');
  });
});

describe('nextPracticeState —— 隔天两次做对才销账', () => {
  // SGT 时间构造：UTC+8。2026-08-13 10:00 SGT = 02:00 UTC
  const day1 = new Date('2026-08-13T02:00:00Z');
  const day1Later = new Date('2026-08-13T09:00:00Z'); // 同一天 17:00 SGT
  const day2 = new Date('2026-08-14T02:00:00Z');

  it('第一次做对：streak 0 → 1，不销账', () => {
    expect(nextPracticeState({ correctStreak: 0, lastPracticedAt: null }, true, day1))
      .toEqual({ correctStreak: 1, resolved: false });
  });

  it('同一天再做对：streak 不涨 —— 刚看完答案马上重做是短时记忆', () => {
    expect(nextPracticeState({ correctStreak: 1, lastPracticedAt: day1 }, true, day1Later))
      .toEqual({ correctStreak: 1, resolved: false });
  });

  it('隔天再做对：streak 1 → 2，自动销账', () => {
    expect(nextPracticeState({ correctStreak: 1, lastPracticedAt: day1 }, true, day2))
      .toEqual({ correctStreak: 2, resolved: true });
  });

  it('做错任何一次：streak 归零', () => {
    expect(nextPracticeState({ correctStreak: 1, lastPracticedAt: day1 }, false, day2))
      .toEqual({ correctStreak: 0, resolved: false });
  });

  it('SGT 日界：UTC 前一天 23:00（= SGT 当天 07:00）和 SGT 同天下午算同一天', () => {
    const sgtMorning = new Date('2026-08-12T23:00:00Z'); // SGT 8-13 07:00
    expect(nextPracticeState({ correctStreak: 1, lastPracticedAt: sgtMorning }, true, day1Later))
      .toEqual({ correctStreak: 1, resolved: false });
  });
});

describe('practiceKindOf —— 题型决定练习交互', () => {
  it('判断题：固定三键', () => {
    expect(practiceKindOf('true_false_not_given', '')).toEqual({
      kind: 'tfng',
      options: ['TRUE', 'FALSE', 'NOT GIVEN'],
    });
    expect(practiceKindOf('yes_no_not_given', '').options).toContain('YES');
  });

  it('段落匹配：从原文推段落字母', () => {
    const passage = 'Paragraph A\nfoo...\nParagraph B\nbar...\nParagraph C\nbaz...\nParagraph D\nqux';
    expect(practiceKindOf('matching_information', passage)).toEqual({
      kind: 'letters',
      options: ['A', 'B', 'C', 'D'],
    });
  });

  it('原文没有段落标记（推不出选项）→ 退回翻卡自评', () => {
    expect(practiceKindOf('matching_information', 'no markers here').kind).toBe('reveal');
  });

  it('标题配对不能用段落字母 —— 答案是 i–x 编号，不是 A–H', () => {
    const passage = 'Paragraph A\nfoo\nParagraph B\nbar\nParagraph C\nbaz';
    expect(practiceKindOf('matching_headings', passage).kind).toBe('reveal');
  });

  it('主观题：翻卡自评', () => {
    expect(practiceKindOf('short_answer', 'whatever').kind).toBe('reveal');
  });
});

describe('extractVocabWord', () => {
  it('只认明确在问词义的题干', () => {
    expect(extractVocabWord("What does the word 'postponing' mean?")).toBe('postponing');
    expect(extractVocabWord("What does 'arithmetic' suggest about the narrator?")).toBe('arithmetic');
    expect(extractVocabWord('What does the writer imply by “shadow”?')).toBe('shadow');
  });

  it('不是词义题就返回空 —— 绝不猜', () => {
    // 题干里带引号但问的不是词义
    expect(extractVocabWord("Which paragraph mentions 'prescribed fire'?")).toBe('');
    expect(extractVocabWord('Complete the sentence below.')).toBe('');
    expect(extractVocabWord('')).toBe('');
  });
});
