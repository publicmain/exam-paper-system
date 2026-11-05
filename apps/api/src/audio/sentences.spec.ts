import { describe, expect, it, vi } from 'vitest';
import { normalizeSentence, splitSentenceRanges, splitSentenceParagraphs } from './sentences';
import { readingSentenceAudio, sentenceHash } from './sentence-audio';

const split = (text: string) => splitSentenceRanges(text).map((s) => s.text);
describe('shared sentence rules', () => {
  it('honours titles and initials', () => {
    expect(split('Mr. Smith met Mrs. Brown and Dr. J. Jones. They left.'))
      .toEqual(['Mr. Smith met Mrs. Brown and Dr. J. Jones.', 'They left.']);
  });
  it('honours e.g., i.e., decimals and time abbreviations', () => {
    expect(split('Try fruit, e.g. apples, i.e. fresh food. It costs 3.50 at 4 p.m. today. Go!'))
      .toEqual(['Try fruit, e.g. apples, i.e. fresh food.', 'It costs 3.50 at 4 p.m. today.', 'Go!']);
  });
  it('keeps closing quotes and attribution together', () => {
    expect(split('“Stop!” she said. “Why?” Tom asked. He left.'))
      .toEqual(['“Stop!” she said.', '“Why?” Tom asked.', 'He left.']);
    expect(split('He said, "Go." Then left.')).toEqual(['He said, "Go."', 'Then left.']);
  });
  it('handles dialogue, line breaks, paragraphs and unpunctuated endings', () => {
    expect(split('Tom: Hello!\nAnn: Hi.\n\nAn unfinished ending'))
      .toEqual(['Tom: Hello!', 'Ann: Hi.', 'An unfinished ending']);
    expect(split('A line wraps\nwithout a full stop. Next?! Yes... Fine.'))
      .toEqual(['A line wraps\nwithout a full stop.', 'Next?!', 'Yes...', 'Fine.']);
    expect(splitSentenceParagraphs('One. Two.\n\nThree.').map((p) => p.map((s) => s.text)))
      .toEqual([['One.', 'Two.'], ['Three.']]);
  });
  it('preserves original offsets and handles empty/CRLF input', () => {
    const text = '  “Hello.”  Next.\r\n\r\nLast';
    for (const s of splitSentenceRanges(text)) expect(text.slice(s.start, s.end)).toBe(s.text);
    expect(split(' \n\t')).toEqual([]);
  });
  it('normalizes quotes and whitespace without losing case or punctuation', () => {
    expect(normalizeSentence('  “It’s\n  fine.” ')).toBe('"It\'s fine."');
    expect(sentenceHash('  “It’s\n fine.” ')).toBe(sentenceHash('"It\'s fine."'));
    expect(sentenceHash('Hi.', 'other')).not.toBe(sentenceHash('Hi.'));
    expect(sentenceHash('hi.')).not.toBe(sentenceHash('Hi.'));
    expect(sentenceHash('Hello.')).toBe('1faf1b64009e7a6fda62296bb0a3a3f5ceebeaa301367012d53a0b4d3fa3efc1');
  });
});

describe('reading sentence manifest', () => {
  it('only returns text and existing audio URLs, with paragraphs and no binary/answers', async () => {
    const findMany = vi.fn(async (_args: any) => [{ textHash: sentenceHash('One.') }]);
    const out = await readingSentenceAudio(['One. Two.\n\nThree.', 'One. Two.\n\nThree.'], { sentenceAudio: { findMany } });
    expect(out).toEqual([{ passage: 'One. Two.\n\nThree.', paragraphs: [
      [{ text: 'One.', audioUrl: `/api/audio/sentence/${sentenceHash('One.')}.mp3` }, { text: 'Two.', audioUrl: null }],
      [{ text: 'Three.', audioUrl: null }],
    ] }]);
    expect(findMany).toHaveBeenCalledTimes(1);
    expect(findMany.mock.calls[0][0].select).toEqual({ textHash: true });
  });
  it('does not query for empty passages or speak paragraph labels', async () => {
    const findMany = vi.fn(async (_args: any) => []);
    expect(await readingSentenceAudio(['', '  '], { sentenceAudio: { findMany } })).toEqual([]);
    expect(findMany).not.toHaveBeenCalled();
    const out = await readingSentenceAudio(['Paragraph 1\nHello.'], { sentenceAudio: { findMany } });
    expect(out[0].paragraphs.flat()).toEqual([{ text: 'Hello.', audioUrl: null }]);
  });
  it('deduplicates concurrent read inputs and bounds each lookup', async () => {
    const body = Array.from({ length: 503 }, (_, n) => `Sentence ${n}.`).join(' ');
    const findMany = vi.fn(async (_args: any) => []);
    await Promise.all([readingSentenceAudio([body], { sentenceAudio: { findMany } }), readingSentenceAudio([body], { sentenceAudio: { findMany } })]);
    expect(findMany).toHaveBeenCalledTimes(4);
    for (const [args] of findMany.mock.calls) expect(args.where.textHash.in.length).toBeLessThanOrEqual(500);
  });
});
