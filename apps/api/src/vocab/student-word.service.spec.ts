import { describe, expect, it } from 'vitest';
import { extractQuotedWord, firstSentenceWith } from './student-word.service';

/**
 * 自动采集的抽词逻辑回归测试。
 *
 * 用例全部取自 2026-07-29 ~ 07-31 真实早测题干 —— 这几周判分时学生
 * 答错的正是这些词义题（coax / crumpled / slick / frail / sparse）。
 */
describe('extractQuotedWord — 从词义题题干里抽目标词', () => {
  it('抓 O-Level §B 词义题的单引号目标词', () => {
    expect(
      extractQuotedWord(
        "Q3. What does the word 'coax' in 'coax a station out of the static' (Paragraph 1) suggest about how the grandfather tuned the radio? [1]",
      ),
    ).toBe('coax');
  });

  it('弯引号同样识别（学生端与 PDF 常见）', () => {
    expect(extractQuotedWord('What does ‘crumpled’ suggest about the note?')).toBe('crumpled');
  });

  it('取第一个单词而不是被引用的整句', () => {
    // 'slick' 是目标词；后面那段是引用原句，不能被当成目标词
    const stem =
      "Q4. What does the word 'slick' in 'His skin was slick with rain' (Paragraph 5) suggest?";
    expect(extractQuotedWord(stem)).toBe('slick');
  });

  it('没有引号目标词时返回 null（不瞎猜）', () => {
    expect(extractQuotedWord('Q1. From Paragraph 2, how did Gu Po travel to the flat? [1]')).toBeNull();
    expect(extractQuotedWord('')).toBeNull();
  });

  it('不把多词短语当成目标词', () => {
    // 引号里是短语，正则要求 [A-Za-z'’-]+ 单词，空格不匹配 → 跳过
    expect(extractQuotedWord("the phrase 'picked their way' means")).toBeNull();
  });
});

describe('firstSentenceWith — 取含该词的原句作为卡片上下文', () => {
  it('返回包含目标词的那一句', () => {
    const stem =
      "Read the narrative. Section B. Q3. What does the word 'coax' suggest? It is worth 1 mark.";
    expect(firstSentenceWith(stem, 'coax')).toContain('coax');
  });

  it('大小写不敏感', () => {
    expect(firstSentenceWith('The Radio sat there. Coax was used.', 'coax')).toBe('Coax was used.');
  });

  it('找不到时退回题干开头，不返回空', () => {
    const out = firstSentenceWith('No target here at all.', 'zzz');
    expect(out.length).toBeGreaterThan(0);
  });
});
