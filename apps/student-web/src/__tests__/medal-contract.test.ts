import { describe, expect, it } from 'vitest';
import { COLLECTION_V5_BADGES, emptyCollectionV5Facts, evaluateCollectionV5Badges } from '../../../api/src/achievements/collection-v5-rules';
import { V5_MEDALS, confirmedMedal, medalByAssetId, medalImage, medalKey } from '../lib/medal-catalog';

/** Compare actual backend pure rules with rendering metadata, not two frontend copies. */
describe('V5 medal asset / server contract', () => {
  it('all 16 IDs, series, tiers, names, thresholds, hidden flags and units match', () => {
    expect(V5_MEDALS.map((medal) => medalKey(medal.assetId))).toEqual(COLLECTION_V5_BADGES.map((badge) => badge.key));
    expect(V5_MEDALS).toHaveLength(16);
    for (const server of COLLECTION_V5_BADGES) {
      const local = medalByAssetId(server.assetId)!;
      for (const field of ['assetId', 'series', 'tier', 'title', 'threshold', 'unit', 'hidden'] as const) expect(local[field], `${server.key}.${field}`).toEqual(server[field]);
      expect(medalImage(server.assetId)).toBe(`/medals/v5/images/${server.assetId}.png`);
    }
  });
  it('three series have four independent levels, three hidden badges and one separate crown', () => {
    for (const series of ['reading', 'vocabulary', 'mastery']) expect(V5_MEDALS.filter((badge) => badge.series === series).map((badge) => badge.threshold)).toEqual([15, 50, 150, 300]);
    expect(V5_MEDALS.filter((badge) => badge.hidden)).toHaveLength(3);
    expect(V5_MEDALS.find((badge) => badge.assetId === 'crown')?.tier).toBeNull();
  });
  it('zero official facts unlock nothing; archival or unknown keys have no fallback', () => {
    const result = evaluateCollectionV5Badges(emptyCollectionV5Facts());
    expect(result).toHaveLength(16); expect(result.every((badge) => !badge.earned && badge.current === 0)).toBe(true);
    expect(confirmedMedal('v3_reading_explorer_l4')).toBeNull(); expect(confirmedMedal('v5_missing')).toBeNull();
    expect(medalImage('../../anything')).toBe('');
  });
});
