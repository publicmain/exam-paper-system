import { describe, it, expect } from 'vitest';
import { clean, reflowPassage, splitStem } from '../shared/textUtils';

describe('clean', () => {
  it('replaces U+FFFD with en-dash', () => {
    expect(clean('1990�2000')).toBe('1990–2000');
  });
  it('handles null and empty', () => {
    expect(clean(null)).toBe('');
    expect(clean(undefined)).toBe('');
    expect(clean('')).toBe('');
  });
  it('normalises CRLF to LF', () => {
    expect(clean('a\r\nb')).toBe('a\nb');
  });
});

describe('reflowPassage', () => {
  it('keeps paragraph breaks', () => {
    const out = reflowPassage('First para\n\nSecond para');
    expect(out).toBe('First para\n\nSecond para');
  });
  it('folds single newlines into spaces', () => {
    const out = reflowPassage('one\ntwo\nthree');
    expect(out).toBe('one two three');
  });
  it('separates an IELTS paragraph label after sentence-ending punctuation', () => {
    // R15-Audit#1: the conservative reflow only injects a paragraph break
    // when the lone capital is at block-start or right after [.!?] — never
    // mid-sentence (which used to corrupt "the U S Senate").
    const out = reflowPassage('Writing began early. B The Greeks borrowed it');
    expect(out).toContain('\n\nB The Greeks');
  });
  it('keeps a leading paragraph label without a leading blank line', () => {
    const out = reflowPassage('A The Babylonians invented writing');
    expect(out.startsWith('A The Babylonians')).toBe(true);
  });
  it('does NOT split mid-sentence initials (R15-Audit#1 false-positive guard)', () => {
    const out = reflowPassage('a base run by the U S Senate today');
    expect(out).toBe('a base run by the U S Senate today');
  });
  it('returns empty for empty input', () => {
    expect(reflowPassage('')).toBe('');
  });
});

describe('splitStem', () => {
  it('splits on the LAST blank line', () => {
    const stem = 'Read this list:\nA Apple\nB Banana\n\nWhich fruit is yellow?';
    const { instruction, item } = splitStem(stem);
    expect(instruction).toContain('Read this list');
    expect(instruction).toContain('B Banana');
    expect(item).toBe('Which fruit is yellow?');
  });
  it('returns empty instruction when no blank line', () => {
    const { instruction, item } = splitStem('Just one line');
    expect(instruction).toBe('');
    expect(item).toBe('Just one line');
  });
});
