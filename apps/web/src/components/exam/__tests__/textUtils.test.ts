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
  it('separates ABC paragraph markers', () => {
    const out = reflowPassage('intro A The Babylonians invented');
    expect(out).toContain('\n\nA The Babylonians');
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
