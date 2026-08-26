import { describe, it, expect } from 'vitest';
import { hasFormalVocabScore, vocabScoreView } from './vocab-score';

/**
 * P7 —— 正式词汇成绩的状态机。
 *
 * 最要紧的两条：**0 分不是没成绩**，**没有 attempt 不是 0 分**。这两个
 * 一旦被混起来，学生看到的数字就在撒谎 —— 一个考了得 0 分的人和一个
 * 根本没考的人在页面上长得一样。
 */

const submitted = (correct: number, total: number, score: number) => ({
  status: 'submitted',
  submittedAt: new Date('2026-08-28T06:00:00.000Z'),
  total,
  correct,
  score,
  items: [],
});

describe('vocabScoreView', () => {
  it('旧任务（vocabWords=NULL）→ legacy_no_queue，与「还没考」分开', () => {
    expect(vocabScoreView(false, null)).toEqual({ status: 'legacy_no_queue' });
  });

  it('有队列但没开考 → not_started', () => {
    expect(vocabScoreView(true, null)).toEqual({ status: 'not_started' });
  });

  it('开考了没交卷 → in_progress，带已答题数', () => {
    const v = vocabScoreView(true, {
      status: 'in_progress',
      submittedAt: null,
      total: 4,
      correct: 0,
      score: 0,
      items: [{ isCorrect: true }, { isCorrect: false }, { isCorrect: null }, {}],
    });
    expect(v).toEqual({ status: 'in_progress', answered: 2, total: 4 });
  });

  it('交卷 → submitted，percentage **读落库值不重算**', () => {
    // 故意让 correct/total 与 score 对不上：证明这里不做除法
    const v = vocabScoreView(true, submitted(3, 4, 42.5));
    expect(v).toEqual({
      status: 'submitted',
      correct: 3,
      total: 4,
      percentage: 42.5,
      submittedAt: '2026-08-28T06:00:00.000Z',
    });
  });

  it('**0 分是有成绩**：submitted + correct=0 + percentage=0', () => {
    const v = vocabScoreView(true, submitted(0, 8, 0));
    expect(v.status).toBe('submitted');
    expect(hasFormalVocabScore(v)).toBe(true);
    if (v.status === 'submitted') {
      expect(v.correct).toBe(0);
      expect(v.percentage).toBe(0);
    }
  });

  it('**没有 attempt 不是 0 分**：not_started 不算有成绩', () => {
    expect(hasFormalVocabScore(vocabScoreView(true, null))).toBe(false);
    expect(hasFormalVocabScore(vocabScoreView(false, null))).toBe(false);
  });

  it('进行中也不算有正式成绩', () => {
    const v = vocabScoreView(true, {
      status: 'in_progress', submittedAt: null, total: 4, correct: 2, score: 0, items: [],
    });
    expect(hasFormalVocabScore(v)).toBe(false);
  });

  it('items 不是数组（脏数据）时不崩', () => {
    const v = vocabScoreView(true, {
      status: 'in_progress', submittedAt: null, total: 0, correct: 0, score: 0, items: null,
    });
    expect(v).toEqual({ status: 'in_progress', answered: 0, total: 0 });
  });
});
