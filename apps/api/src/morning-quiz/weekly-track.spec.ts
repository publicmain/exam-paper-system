import { describe, expect, it } from 'vitest';
import { isoWeekOfYMD, isoWeekSGT } from './iso-week';
import { resolveWeeklyTrack } from './weekly-track';

describe('isoWeek — ISO 周标签', () => {
  it('2026-08-24（周一）是 2026-W35', () => {
    expect(isoWeekOfYMD(2026, 7, 24)).toBe('2026-W35');
  });
  it('同一 ISO 周内每天标签一致（周一到周日）', () => {
    for (let d = 24; d <= 30; d++) expect(isoWeekOfYMD(2026, 7, d)).toBe('2026-W35');
    expect(isoWeekOfYMD(2026, 7, 31)).toBe('2026-W36');
  });
  it('跨年：2025-12-29（周一）已属 2026-W01', () => {
    expect(isoWeekOfYMD(2025, 11, 29)).toBe('2026-W01');
  });
  it('isoWeekSGT：UTC 深夜 = SGT 已过午夜，按 SGT 日历算周', () => {
    // 2026-08-30(周日) 22:00 UTC = 8-31(周一) 06:00 SGT → 已进 W36
    expect(isoWeekSGT(new Date('2026-08-30T22:00:00Z'))).toBe('2026-W36');
  });
});

describe('resolveWeeklyTrack — 每周小主线解析', () => {
  const inW35 = new Date('2026-08-25T00:30:00Z'); // 周二 08:30 SGT，早测扫码时刻

  it('试点层拿到 15 词，story 带周标签', () => {
    for (const level of ['ielts_light', 'ielts_simplified']) {
      const r = resolveWeeklyTrack(level, inW35);
      expect(r, level).not.toBeNull();
      expect(r!.story).toBe('每周主线 2026-W35');
      expect(r!.items.length).toBe(15);
      // 每个词都带自撰例句，且例句里真的有这个词（拼写/挖空题的前提）
      for (const i of r!.items) {
        expect(i.word.length, i.word).toBeGreaterThan(2);
        expect(i.context.toLowerCase(), i.word).toContain(i.word.toLowerCase());
      }
    }
  });

  it('未配轨的层级返回 null（推送静默跳过）', () => {
    expect(resolveWeeklyTrack('ielts_authentic', inW35)).toBeNull();
    expect(resolveWeeklyTrack('olevel', inW35)).toBeNull();
  });

  it('没有词表文件的周返回 null（断供不炸扫码）', () => {
    expect(resolveWeeklyTrack('ielts_light', new Date('2027-03-01T01:00:00Z'))).toBeNull();
  });
});
