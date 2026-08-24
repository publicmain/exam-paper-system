import { describe, expect, it } from 'vitest';
import { displayTranslation } from '../dictDisplay';

describe('displayTranslation — 专业义项过滤', () => {
  it('滤掉 [计]/[医] 等专业行（borrow 实测坏例）', () => {
    expect(displayTranslation('vt. 借, 借入, 借用\nvi. 借\n[计] 借位; 借位数'))
      .toBe('vt. 借, 借入, 借用\nvi. 借');
  });
  it('限行数', () => {
    expect(displayTranslation('a\nb\nc\nd', 2)).toBe('a\nb');
  });
  it('全是专业行的纯术语词条：保底放回原始行', () => {
    expect(displayTranslation('[计] 借位', 2)).toBe('[计] 借位');
  });
  it('普通释义原样通过', () => {
    expect(displayTranslation('n. 门闩')).toBe('n. 门闩');
  });
});
