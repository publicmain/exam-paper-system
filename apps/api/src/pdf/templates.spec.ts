import { describe, it, expect } from 'vitest';
import { __testHooks } from './templates';

const { renderInline } = __testHooks;

/**
 * Regression: in a 2026-05-19 OL.4 weekly test PDF the hint line on Q1(c)
 * rendered as
 *
 *   Hint: Let K1 and use your answers to (a) and (b).
 *
 * The "K1" was a slot placeholder (K1) that never got
 * restored. Root cause was a forward-iterating restore loop that
 * couldn't see a placeholder hidden inside another slot's content.
 *
 * Reproduce by wrapping an inline-math span in italic markers, which
 * is the exact shape AI question-authors emit for "Hint: Let u = ..."
 * style guidance.
 */

describe('renderInline — nested slot restore (R17 PDF leak fix)', () => {
  it('restores an inline-math slot that is nested inside an italic slot', () => {
    const out = renderInline('*Hint: Let $u = 6x^2 - 13x - 5$ and use your answers to (a) and (b).*');
    // No SLOT_MARK characters (U+E000) should survive into the output.
    expect(out).not.toContain('');
    // No literal "K<digit>" placeholders inside SLOT_MARK pairs.
    expect(out).not.toMatch(/K\d+/);
    // Italic wrapper preserved.
    expect(out).toContain('<em>');
    expect(out).toContain('</em>');
    // KaTeX rendered the inline math (presence of katex root class is enough;
    // we don't pin the exact HTML so this stays robust across katex versions).
    expect(out).toContain('katex');
  });

  it('restores a bold slot containing inline math', () => {
    const out = renderInline('**Important:** factorise $6x^2 + 7x - 3$ completely.');
    expect(out).not.toContain('');
    expect(out).toContain('<strong>');
    expect(out).toContain('katex');
  });

  it('restores plain inline math without wrappers (smoke)', () => {
    const out = renderInline('Solve $x^2 - 5x + 6 = 0$.');
    expect(out).not.toContain('');
    expect(out).toContain('katex');
  });

  it('leaves plain prose alone', () => {
    const out = renderInline('No math here, just a sentence.');
    expect(out).toBe('No math here, just a sentence.');
  });

  it('escapes raw HTML in the body of an italic wrapper', () => {
    const out = renderInline('*Avoid <script>alert(1)</script> tricks.*');
    expect(out).not.toContain('<script>');
    expect(out).toContain('&lt;script&gt;');
  });
});
