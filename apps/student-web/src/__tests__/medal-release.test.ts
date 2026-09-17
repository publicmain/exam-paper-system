import { describe, expect, it } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { ROUTES } from '../routes.contract';
import { V5_MEDALS } from '../lib/medal-catalog';
const root = path.resolve(__dirname, '../..');
describe('minimal production medal release', () => {
  it('only the collection is added, not unreleased growth, coaching or sandbox pages', () => {
    expect(Object.values(ROUTES).filter(value => value.startsWith('/growth'))).toEqual(['/growth/badges']);
    const app = fs.readFileSync(path.join(root, 'src/App.tsx'), 'utf8');
    expect(app).not.toMatch(/GrowthReportPage|PortfolioPage|SuggestionsPage/);
    expect(fs.existsSync(path.join(root, 'public/medals/atelier'))).toBe(false);
  });
  it('all 16 offline-hosted artifacts are real binary models and PNG images', () => {
    const assets = path.join(root, 'public/medals/v5');
    for (const medal of V5_MEDALS) {
      const model = fs.readFileSync(path.join(assets, 'models', medal.assetId + '.glb'));
      expect(model.subarray(0, 4).toString()).toBe('glTF'); expect(model.readUInt32LE(4)).toBe(2);
      expect(model.readUInt32LE(8)).toBe(model.length);
      for (const folder of ['images', 'thumbs']) expect(fs.readFileSync(path.join(assets, folder, medal.assetId + '.png')).subarray(1, 4).toString()).toBe('PNG');
    }
    expect(fs.readFileSync(path.join(assets, 'viewer.html'), 'utf8')).not.toMatch(/localhost|127\.0\.0\.1|__fx|https?:\/\//);
    expect(fs.readdirSync(path.join(assets, 'licenses')).length).toBeGreaterThan(0);
  });
  it('daily-batch rule syncs only completion, never individual learned cards', () => {
    const source = fs.readFileSync(path.join(root, 'src/pages/VocabularyCoachLearn.tsx'), 'utf8');
    expect(source).toContain("if (next.status === 'completed') void syncAchievementNotices()");
    expect(source).not.toContain("action === 'normal' || next.status === 'completed'");
  });
});
