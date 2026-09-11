import { describe, it, expect, beforeEach } from 'vitest';
import {
  isDraftDirty,
  previewTotals,
  readStoredDrafts,
  stageOfSubmission,
  validateMarks,
  writeStoredDrafts,
} from '../markerStages';

/** 审计 M01 / M02 —— 判分工作台的纯规则。 */

describe('stageOfSubmission —— 四个阶段互斥', () => {
  it('已发布 / 已评分待发布 / 批改中 / 待批', () => {
    expect(stageOfSubmission({ status: 'marked', ungradedCount: 0, claimActive: false })).toBe('published');
    expect(stageOfSubmission({ status: 'returned', ungradedCount: 0, claimActive: false })).toBe('published');
    expect(stageOfSubmission({ status: 'submitted', ungradedCount: 0, claimActive: true })).toBe('ready');
    expect(stageOfSubmission({ status: 'submitted', ungradedCount: 0, claimActive: false })).toBe('ready');
    expect(stageOfSubmission({ status: 'submitted', ungradedCount: 2, claimActive: true })).toBe('in_progress');
    expect(stageOfSubmission({ status: 'submitted', ungradedCount: 2, claimActive: false })).toBe('awaiting');
    expect(stageOfSubmission({ status: 'in_progress', ungradedCount: 2, claimActive: false })).toBeNull();
  });
});

describe('isDraftDirty', () => {
  const saved = { awardedMarks: '2', markerComment: '' };
  it('分数按数值比较，评语按原文比较', () => {
    expect(isDraftDirty({ awardedMarks: '2.0', markerComment: '' }, saved)).toBe(false);
    expect(isDraftDirty({ awardedMarks: '1.5', markerComment: '' }, saved)).toBe(true);
    expect(isDraftDirty({ awardedMarks: '2', markerComment: '好' }, saved)).toBe(true);
    expect(isDraftDirty({ awardedMarks: '', markerComment: '' }, saved)).toBe(true);
    expect(isDraftDirty({ awardedMarks: '', markerComment: '' }, { awardedMarks: '', markerComment: '' })).toBe(false);
    expect(isDraftDirty(undefined, saved)).toBe(false);
  });
});

describe('validateMarks', () => {
  it('空、非数字、越界、非 0.5 步长都给出准确提示；合法返回 null', () => {
    expect(validateMarks('', 2)).toMatch(/先填/);
    expect(validateMarks('abc', 2)).toMatch(/数字/);
    expect(validateMarks('-1', 2)).toMatch('0–2');
    expect(validateMarks('2.5', 2)).toMatch('0–2');
    expect(validateMarks('0.3', 2)).toMatch(/0\.5/);
    expect(validateMarks('0', 2)).toBeNull();
    expect(validateMarks('1.5', 2)).toBeNull();
    expect(validateMarks('2', 2)).toBeNull();
  });
});

describe('previewTotals —— 与后端 finalize 同一算法', () => {
  it('客观题 + 自动判的主观题算自动分，老师判的主观题算人工分', () => {
    const q = (t: string) => ({ question: { questionType: t } });
    expect(
      previewTotals([
        { awardedMarks: 1, markedById: null, paperQuestion: q('mcq') },
        { awardedMarks: 1, markedById: null, paperQuestion: q('short_answer') },
        { awardedMarks: 2, markedById: 't', paperQuestion: q('short_answer') },
        { awardedMarks: null, markedById: null, paperQuestion: q('short_answer') },
      ]),
    ).toEqual({ auto: 2, manual: 2, total: 4 });
  });
});

describe('本标签页草稿', () => {
  beforeEach(() => sessionStorage.clear());
  it('写入、读回、清空；坏数据安全忽略', () => {
    writeStoredDrafts('sub-1', { a: { awardedMarks: '1', markerComment: 'x' } });
    expect(readStoredDrafts('sub-1')).toEqual({ a: { awardedMarks: '1', markerComment: 'x' } });
    writeStoredDrafts('sub-1', {});
    expect(readStoredDrafts('sub-1')).toEqual({});
    sessionStorage.setItem('marker-draft:sub-2', '{not json');
    expect(readStoredDrafts('sub-2')).toEqual({});
    sessionStorage.setItem('marker-draft:sub-3', JSON.stringify({ a: { awardedMarks: 1 } }));
    expect(readStoredDrafts('sub-3')).toEqual({});
  });
});
