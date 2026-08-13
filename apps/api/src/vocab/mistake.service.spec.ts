import { describe, expect, it } from 'vitest';
import { extractVocabWord, shouldCollect } from './mistake.service';

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
