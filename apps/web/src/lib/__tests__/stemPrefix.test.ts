import { describe, expect, it } from 'vitest';
import { commonStemPrefix, stripStemPrefix } from '../paperName';

/**
 * 题干里那段重复的说明必须被抽走（2026-08-14 修）。
 *
 * 入库时题干是「说明 + 空行 + 问题」拼出来的，每道题都顶着同一段
 * instruction。练习结果页原来直接渲染 + line-clamp-3 —— 三行全被说明
 * 占满，**真正的问题被截在可视区外**，老师试读时只看得到
 * 「Read the story below…」，看不到「what hit the puddle?」。
 * 复盘页一直有这套处理，练习页漏了；现在两处同源。
 */

const INTRO =
  'Read the story below and answer the questions that follow. [2 marks]. ' +
  'Write short answers. One or two words are enough.';

const stems = [
  `${INTRO}\n\nQ1. From Paragraph 3, what hit the puddle? [1]`,
  `${INTRO}\n\nQ2. From Paragraph 6, what did Mei give the writer? [1]`,
];

describe('题干公共说明抽取', () => {
  it('抽得出这段公共说明', () => {
    const intro = commonStemPrefix(stems);
    expect(intro.length).toBeGreaterThan(40);
    expect(intro).toContain('Read the story below');
  });

  it('剥离后每题只剩自己的问题 —— 这是复盘的全部意义', () => {
    const intro = commonStemPrefix(stems);
    expect(stripStemPrefix(stems[0], intro)).toContain('what hit the puddle');
    expect(stripStemPrefix(stems[1], intro)).toContain('what did Mei give');
    expect(stripStemPrefix(stems[0], intro)).not.toContain('Read the story below');
  });

  it('只有一道题时不硬抽 —— 没有「公共」前缀可言', () => {
    expect(commonStemPrefix([stems[0]])).toBe('');
  });

  it('题干不以该前缀开头时原样返回，绝不吞掉内容', () => {
    expect(stripStemPrefix('Q9. 另一种题干', INTRO)).toBe('Q9. 另一种题干');
  });

  it('剥完会变空的情况下保留原文 —— 宁可冗余也不能空白', () => {
    expect(stripStemPrefix(INTRO, INTRO)).toBe(INTRO);
  });

  it('各题说明不同时不误抽（公共前缀太短则放弃）', () => {
    const intro = commonStemPrefix([
      'Q1. 短题干一',
      'Q2. 短题干二',
    ]);
    expect(intro).toBe('');
  });
});
