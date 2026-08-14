import { describe, expect, it } from 'vitest';
import { scoresReleased, stripUnreleasedScores } from './morning-quiz.service';

/**
 * 2026-08-14 新政：交卷即见答案，分数评语等老师人工判分定稿后才下发。
 *
 * 剥离必须发生在服务端 —— 前端藏起来挡不住 devtools。history-detail
 * 复用 getStudentResult，所以这一个纯函数覆盖两个学生入口。
 */

const item = (over: Partial<Record<string, unknown>> = {}) => ({
  awardedMarks: 1,
  autoCorrect: true,
  isCorrect: true,
  markerComment: '定位到第 3 段末句。',
  commentSource: 'teacher',
  correctAnswer: 'B',
  referenceAnswer: null,
  ...over,
});

const payload = (status: string) => ({
  status,
  autoScore: 5,
  manualScore: 4,
  totalScore: 9,
  maxScore: 13,
  items: [item(), item({ awardedMarks: 0, autoCorrect: false, isCorrect: false })],
});

describe('scoresReleased —— 分数发布口径', () => {
  it('marked / graded / returned 已定稿 → 发布', () => {
    expect(scoresReleased('marked')).toBe(true);
    expect(scoresReleased('graded')).toBe(true);
    expect(scoresReleased('returned')).toBe(true);
  });
  it('practice 是即时判分的自发重做，不适用晚发布', () => {
    expect(scoresReleased('practice')).toBe(true);
  });
  it('submitted / in_progress 未定稿 → 不发布', () => {
    expect(scoresReleased('submitted')).toBe(false);
    expect(scoresReleased('in_progress')).toBe(false);
  });
});

describe('stripUnreleasedScores', () => {
  it('未定稿：三个分数字段和每题的判分信息全部置空', () => {
    const r = stripUnreleasedScores(payload('submitted') as any);
    expect(r.scoresPending).toBe(true);
    expect(r.autoScore).toBeNull();
    expect(r.manualScore).toBeNull();
    expect(r.totalScore).toBeNull();
    for (const it2 of r.items) {
      expect(it2.awardedMarks).toBeNull();
      expect(it2.autoCorrect).toBeNull();
      expect(it2.isCorrect).toBeNull();
      expect(it2.markerComment).toBeNull();
      expect(it2.commentSource).toBeNull();
    }
  });

  it('未定稿：答案字段原样保留 —— 即时反馈的核心就是它', () => {
    const r = stripUnreleasedScores(payload('submitted') as any);
    expect((r.items[0] as any).correctAnswer).toBe('B');
  });

  it('已定稿：原样透传，scoresPending=false', () => {
    const r = stripUnreleasedScores(payload('marked') as any);
    expect(r.scoresPending).toBe(false);
    expect(r.totalScore).toBe(9);
    expect(r.items[0].awardedMarks).toBe(1);
    expect(r.items[0].markerComment).toBe('定位到第 3 段末句。');
  });

  it('不改动输入对象（纯函数）', () => {
    const p = payload('submitted');
    stripUnreleasedScores(p as any);
    expect(p.totalScore).toBe(9);
    expect(p.items[0].awardedMarks).toBe(1);
  });
});
