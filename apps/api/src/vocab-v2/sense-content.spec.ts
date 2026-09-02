import { describe, expect, it } from 'vitest';
import { canonicalPos, senseKey, translationForPos } from './sense-content';

describe('sense-level content helpers', () => {
  it('normalises dictionary POS labels into stable sense identities', () => {
    expect(canonicalPos('n.')).toBe('noun');
    expect(canonicalPos('vt')).toBe('verb');
    expect(canonicalPos('adv')).toBe('adverb');
    expect(senseKey('adj')).toBe('adjective:01');
  });

  it('selects the matching Chinese meaning instead of merging unrelated senses', () => {
    const translation = 'adv. 仍然；还\nadj. 静止的；平静的\nn. 静物照片';
    expect(translationForPos(translation, 'adv')).toBe('adv. 仍然；还');
    expect(translationForPos(translation, 'adj')).toBe('adj. 静止的；平静的');
    expect(translationForPos(translation, 'noun')).toBe('n. 静物照片');
  });
});
