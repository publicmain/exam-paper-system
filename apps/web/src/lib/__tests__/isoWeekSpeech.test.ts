import { describe, expect, it } from 'vitest';
import { currentIsoWeekLabel, isoWeekOfYMD, weeklyTrackTitle } from '../isoWeek';
import { pickVoiceFrom } from '../speech';

describe('isoWeek（web 镜像）', () => {
  it('2026-08-24（周一）是 2026-W35，周内一致', () => {
    expect(isoWeekOfYMD(2026, 7, 24)).toBe('2026-W35');
    expect(isoWeekOfYMD(2026, 7, 30)).toBe('2026-W35');
    expect(isoWeekOfYMD(2026, 7, 31)).toBe('2026-W36');
  });
  it('跨年：2025-12-29 属 2026-W01', () => {
    expect(isoWeekOfYMD(2025, 11, 29)).toBe('2026-W01');
  });
  it('weeklyTrackTitle 与后端 story 命名一致', () => {
    expect(weeklyTrackTitle(new Date(2026, 7, 25))).toBe('每周主线 2026-W35');
    expect(currentIsoWeekLabel(new Date(2026, 7, 25))).toBe('2026-W35');
  });
});

describe('pickVoiceFrom — 发音音色选择', () => {
  const v = (lang: string, localService: boolean) =>
    ({ lang, localService, name: lang } as unknown as SpeechSynthesisVoice);
  it('en-GB 本地音色最优先', () => {
    const picked = pickVoiceFrom([v('zh-CN', true), v('en-US', true), v('en-GB', false), v('en-GB', true)]);
    expect(picked?.lang).toBe('en-GB');
    expect((picked as any).localService).toBe(true);
  });
  it('没有 en-GB 时退到任意英语，优先本地', () => {
    expect(pickVoiceFrom([v('zh-CN', true), v('en-US', false), v('en-AU', true)])?.lang).toBe('en-AU');
  });
  it('一个英语音色都没有 → null（按钮层会隐藏/静默）', () => {
    expect(pickVoiceFrom([v('zh-CN', true)])).toBeNull();
  });
  it('en_GB 下划线写法也认（安卓真机见过）', () => {
    expect(pickVoiceFrom([v('en_GB', true)])?.lang).toBe('en_GB');
  });
});
