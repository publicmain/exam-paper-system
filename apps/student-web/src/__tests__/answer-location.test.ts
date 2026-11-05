import { describe, expect, it } from 'vitest';
import { locateAnswer } from '../lib/answer-location';

describe('出处只在唯一命中时出现', () => {
  it('匹配唯一的词组后高亮整句，空白与弯引号不改变偏移', () => {
    const body = 'First sentence. It’s made with\nboiled water. Last sentence.';
    const location = locateAnswer(body, "it's made with boiled water");
    expect(location).not.toBeNull();
    expect(body.slice(location!.start, location!.end)).toBe('It’s made with\nboiled water.');
  });
  it.each(['Tea is made with water. Tea is made with water.', 'No matching sentence.'])('重复或不存在不定位：%s', (body) => {
    expect(locateAnswer(body, 'Tea is made with water.')).toBeNull();
  });
  it('不匹配单词内部或答案字母、真假判断；跨段不扩大高亮', () => {
    expect(locateAnswer('Mistaken identity.', 'take')).toBeNull();
    expect(locateAnswer('Answer A. This is true.', 'A')).toBeNull();
    expect(locateAnswer('This is true.', 'true')).toBeNull();
    const body = 'Paragraph A\nThe answer is a row of hedges. More text.';
    const hit = locateAnswer(body, 'a row of hedges')!;
    expect(body.slice(hit.start, hit.end)).toBe('The answer is a row of hedges.');
  });
});
