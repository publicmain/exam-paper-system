import { describe, expect, it } from 'vitest';
import { LEVEL_WORD_POLICY } from './level-policy';
import { OFFICIAL_WORDLIST_META, officialList, officialWordAt, searchOfficialWords } from './official-wordlists';

describe('official Vocabulary Coach V2 word lists', () => {
  it('ships the complete ranked NGSL 1.2 and NAWL 1.2 assets', () => {
    expect(officialList('ngsl')).toHaveLength(2809);
    expect(officialList('nawl')).toHaveLength(957);
    for (const name of ['ngsl', 'nawl'] as const) {
      officialList(name).forEach((word, index) => expect(word.rank).toBe(index + 1));
    }
  });

  it('preserves attribution and never overlaps the two published lists', () => {
    expect(OFFICIAL_WORDLIST_META.license).toBe('CC BY-SA 4.0');
    expect(OFFICIAL_WORDLIST_META.attribution).toContain('Browne');
    const ngsl = new Set(officialList('ngsl').map((word) => word.headword));
    expect(officialList('nawl').filter((word) => ngsl.has(word.headword))).toEqual([]);
  });

  it('supports exact ranked lookup and arbitrary search', () => {
    expect(officialWordAt('ngsl', 1)?.headword).toBe('the');
    expect(officialWordAt('nawl', 958)).toBeNull();
    expect(searchOfficialWords('authority')[0]).toMatchObject({ headword: 'authority', list: 'nawl' });
  });

  it('maps every one of the five selectable levels to an official source', () => {
    expect(Object.keys(LEVEL_WORD_POLICY).sort()).toEqual([
      'ielts_authentic', 'ielts_light', 'ielts_simplified', 'olevel', 'olevel_intermediate',
    ]);
  });
});
