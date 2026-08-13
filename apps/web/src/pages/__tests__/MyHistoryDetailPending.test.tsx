import { describe, expect, it } from 'vitest';
import { hasWrittenAnswer } from '../MyHistoryDetail';

/**
 * 「待老师批改」的判定（2026-08-13 修）。
 *
 * 坑在于：**没作答的题在数据库里根本没有答题记录行**，接口是拿试卷
 * 题目补出来的，awardedMarks 因此是 null —— 和「写了但还没判」完全
 * 一样。原来只看 awardedMarks，于是每一道留空的简答题都被显示成
 * 「⏳ 待老师批改」，顶部还挂一条「批改完成后总分会更新，请稍后再来
 * 查看」的横幅。这个班空白率 26%–95%，等于绝大多数复盘页永久挂着
 * 一条假提示，学生会一直等一个永远不会来的分数。
 *
 * 2026-08-12 叶雅滋 Q12 就是实例：13 题只有 12 条答题记录。
 */

describe('hasWrittenAnswer —— 分清「没写」和「写了没判」', () => {
  it('没有答题记录的题：studentAnswer 为 null → 判为未作答', () => {
    expect(hasWrittenAnswer({ studentAnswer: null })).toBe(false);
    expect(hasWrittenAnswer({})).toBe(false);
    expect(hasWrittenAnswer({ studentAnswer: undefined })).toBe(false);
  });

  it('空串和纯空白也算未作答', () => {
    expect(hasWrittenAnswer({ studentAnswer: '' })).toBe(false);
    expect(hasWrittenAnswer({ studentAnswer: '   ' })).toBe(false);
    expect(hasWrittenAnswer({ studentAnswer: '\n\t ' })).toBe(false);
  });

  it('写了东西就算作答 —— 哪怕只写一个字母', () => {
    expect(hasWrittenAnswer({ studentAnswer: 'B' })).toBe(true);
    expect(hasWrittenAnswer({ studentAnswer: ' light curve ' })).toBe(true);
  });

  it('非字符串的作答（选项对象等）也算作答，不误判成空白', () => {
    expect(hasWrittenAnswer({ studentAnswer: 0 as unknown })).toBe(true);
    expect(hasWrittenAnswer({ studentAnswer: { key: 'A' } as unknown })).toBe(true);
  });
});

describe('横幅与逐题徽标的组合判定', () => {
  // 复现页面里的两个表达式，确保它们对四种状态给出正确结果
  const banner = (items: Array<{ questionType: string; awardedMarks: number | null; studentAnswer?: unknown }>) =>
    items.some((it) => it.questionType !== 'mcq' && it.awardedMarks == null && hasWrittenAnswer(it));
  const rowPending = (it: { questionType: string; awardedMarks: number | null; studentAnswer?: unknown }) => {
    const isMcq = it.questionType === 'mcq';
    const isBlank = !isMcq && !hasWrittenAnswer(it);
    return !isMcq && it.awardedMarks == null && !isBlank;
  };

  const blank = { questionType: 'short_answer', awardedMarks: null, studentAnswer: null };
  const written_ungraded = { questionType: 'short_answer', awardedMarks: null, studentAnswer: 'my answer' };
  const graded = { questionType: 'short_answer', awardedMarks: 1, studentAnswer: 'my answer' };
  const mcq = { questionType: 'mcq', awardedMarks: null, studentAnswer: 'B' };

  it('全部已判分：不显示横幅', () => {
    expect(banner([graded, mcq])).toBe(false);
  });

  it('只有空白题未判：不显示横幅 —— 这正是修掉的假提示', () => {
    expect(banner([graded, blank])).toBe(false);
    expect(rowPending(blank)).toBe(false);
  });

  it('确有写了但没判的题：照常提示', () => {
    expect(banner([graded, written_ungraded])).toBe(true);
    expect(rowPending(written_ungraded)).toBe(true);
  });

  it('选择题永远不触发人工批改提示', () => {
    expect(banner([mcq])).toBe(false);
    expect(rowPending(mcq)).toBe(false);
  });
});
