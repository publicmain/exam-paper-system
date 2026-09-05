import { describe, expect, it } from 'vitest';
import { canonicalPos, inferPosFromTranslation, senseKey, translationForPos } from './sense-content';

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

describe('inferPosFromTranslation —— 2026-09-05 盲测 P2-10', () => {
  it('从「n. 大灾难」推出 noun；「vi. 发芽」推出 verb', () => {
    expect(inferPosFromTranslation('n. 大灾难, 大祸')).toBe('noun');
    expect(inferPosFromTranslation('vi. 发芽, 萌芽\nn. 萌芽')).toBe('verb');
  });
  it('推不出来 → null（别再造一个 other）', () => {
    expect(inferPosFromTranslation('大灾难')).toBeNull();
    expect(inferPosFromTranslation('')).toBeNull();
    expect(inferPosFromTranslation(null)).toBeNull();
  });
});
