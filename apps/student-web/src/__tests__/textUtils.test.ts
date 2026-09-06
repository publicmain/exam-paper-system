import { describe, expect, it } from 'vitest';
import { reflowPassage } from '../lesson/shared/textUtils';
describe('reflowPassage —— 段落标签独占一行（2026-09-06 复测）', () => {
  it('「Paragraph 1」不和正文粘成一行', () => {
    const out = reflowPassage('Paragraph 1\nOnce a week he came.\nAlways on Thursday.\n\nParagraph 2\nThe end.');
    expect(out).toBe('Paragraph 1\nOnce a week he came. Always on Thursday.\n\nParagraph 2\nThe end.');
  });
});
