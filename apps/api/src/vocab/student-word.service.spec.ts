import { describe, expect, it } from 'vitest';
import { contextFor, extractQuotedWord, firstSentenceWith } from './student-word.service';

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

describe('contextFor — 卡片上下文必须来自原文，不能是题干', () => {
  const stem =
    "Q3. What does the word 'frail' in 'frail now, her back curved like a question mark' (Paragraph 2) suggest about Gu Po? [1]";
  const passage =
    'Paragraph 2\nGu Po came late, as she always did. She was my grandmother’s younger sister, frail now, her back curved like a question mark, and she held the doorframe for a moment.';

  it('优先返回文章原文里含该词的句子', () => {
    const out = contextFor(passage, stem, 'frail');
    expect(out).toContain('frail now, her back curved');
    // 关键：绝不能把题干当上下文，否则挖空挖的是题目里的引用词
    expect(out).not.toContain('What does the word');
  });

  it('没有原文时退回题干里的引文摘录，而不是整句题干', () => {
    const out = contextFor('', stem, 'frail');
    expect(out).toBe('frail now, her back curved like a question mark');
    expect(out).not.toContain('Q3.');
  });

  it('原文里没有该词时不硬套原文开头', () => {
    const out = contextFor('A totally unrelated passage about drains.', stem, 'frail');
    expect(out.toLowerCase()).toContain('frail');
  });

  it('原文与题干都没有时也返回非空', () => {
    expect(contextFor('', 'no quotes here', 'zzz').length).toBeGreaterThan(0);
  });

  // 以下三条来自真实数据实测发现的切分缺陷
  it('不把「Paragraph N」段落标记带进上下文', () => {
    const p = 'Paragraph 4\nThen the water surged. A wall of churning brown water came sweeping down.';
    expect(contextFor(p, '', 'surged')).toBe('Then the water surged.');
  });

  it('句末是「句号+引号」时也能正确断句，不跨句粘连', () => {
    const p =
      "'This one your grandmother liked.'\n\nParagraph 3\nAs I grew older the radio became background, then nuisance.";
    const out = contextFor(p, '', 'nuisance');
    expect(out).toBe('As I grew older the radio became background, then nuisance.');
    expect(out).not.toContain('grandmother');
    expect(out).not.toContain('Paragraph');
  });

  it('段首句也能干净取出（不带段落标记前缀）', () => {
    const p = "Paragraph 1\nAh Seng's provision shop sat wedged between the coffee shop and the lift.";
    expect(contextFor(p, '', 'wedged')).toBe(
      "Ah Seng's provision shop sat wedged between the coffee shop and the lift.",
    );
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
