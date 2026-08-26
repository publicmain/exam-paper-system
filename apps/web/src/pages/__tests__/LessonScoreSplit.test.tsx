import { describe, it, expect } from 'vitest';
import {
  submittedAtLabel,
  vocabScoreLabel,
  vocabScoreShort,
  type VocabScoreView,
} from '../../lib/vocabScore';

/**
 * P7 —— 阅读成绩与正式词汇成绩分开展示的文案口径。
 *
 * 钉住的是最容易出事的那一处：**0 分和没成绩不能长一样**。
 * 用 `!percentage` 之类的真值判断就会把 0 分显示成「—」。
 */

const submitted = (correct: number, total: number, percentage: number): VocabScoreView => ({
  status: 'submitted',
  correct,
  total,
  percentage,
  submittedAt: '2026-08-28T06:00:00.000Z',
});

describe('正式词汇成绩文案', () => {
  it('**0 分显示 0/8，不是「—」**', () => {
    expect(vocabScoreLabel(submitted(0, 8, 0))).toBe('0/8 · 0 分');
    expect(vocabScoreShort(submitted(0, 8, 0))).toBe('0/8');
  });

  it('有成绩显示 correct/total + 百分数', () => {
    expect(vocabScoreLabel(submitted(3, 4, 75))).toBe('3/4 · 75 分');
  });

  it('没开考 → 「还没考」，不是 0', () => {
    expect(vocabScoreLabel({ status: 'not_started' })).toBe('还没考');
    expect(vocabScoreShort({ status: 'not_started' })).toBe('未考');
  });

  it('进行中带已答题数', () => {
    expect(vocabScoreLabel({ status: 'in_progress', answered: 2, total: 5 })).toBe(
      '考试进行中 · 2/5 题',
    );
  });

  it('**旧任务有专门文案**，不与「还没考」混同', () => {
    expect(vocabScoreLabel({ status: 'legacy_no_queue' })).toBe('这一天没有正式单词测试');
    expect(vocabScoreShort({ status: 'legacy_no_queue' })).toBe('无测试');
    expect(vocabScoreLabel({ status: 'legacy_no_queue' })).not.toBe(
      vocabScoreLabel({ status: 'not_started' }),
    );
  });

  it('字段缺失（旧构建的服务端）→ 「—」，不崩', () => {
    expect(vocabScoreLabel(null)).toBe('—');
    expect(vocabScoreLabel(undefined)).toBe('—');
    expect(vocabScoreShort(null)).toBe('—');
  });

  it('交卷时刻只在 submitted 时出现', () => {
    expect(submittedAtLabel(submitted(1, 4, 25))).toMatch(/交卷$/);
    expect(submittedAtLabel({ status: 'not_started' })).toBeNull();
    expect(submittedAtLabel({ status: 'in_progress', answered: 1, total: 4 })).toBeNull();
  });

  it('每个状态的文案两两不同 —— 学生能分辨自己处在哪一种', () => {
    const all = [
      vocabScoreLabel({ status: 'legacy_no_queue' }),
      vocabScoreLabel({ status: 'not_started' }),
      vocabScoreLabel({ status: 'in_progress', answered: 1, total: 4 }),
      vocabScoreLabel(submitted(0, 4, 0)),
      vocabScoreLabel(submitted(4, 4, 100)),
    ];
    expect(new Set(all).size).toBe(all.length);
  });
});
