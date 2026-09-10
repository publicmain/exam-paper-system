/**
 * 单词发音（2026-09-10）：先放服务端音频，放不了再退回系统语音。
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { sayWord, wordAudioUrl } from '../lib/speak';

const played: string[] = [];
const spoken: string[] = [];
let playResult: 'ok' | 'reject';

class FakeAudio {
  src: string;
  private handlers: Record<string, () => void> = {};
  constructor(src: string) {
    this.src = src;
    played.push(src);
  }
  addEventListener(name: string, fn: () => void) {
    this.handlers[name] = fn;
  }
  pause() {}
  play() {
    return playResult === 'ok' ? Promise.resolve() : Promise.reject(new Error('NotSupportedError'));
  }
}

class FakeUtterance {
  lang = '';
  constructor(public text: string) {}
}

beforeEach(() => {
  played.length = 0;
  spoken.length = 0;
  playResult = 'ok';
  vi.stubGlobal('Audio', FakeAudio);
  vi.stubGlobal('SpeechSynthesisUtterance', FakeUtterance);
  vi.stubGlobal('speechSynthesis', {
    cancel: vi.fn(),
    speak: (u: FakeUtterance) => spoken.push(`${u.lang}:${u.text}`),
  });
});
afterEach(() => vi.unstubAllGlobals());

const tick = () => new Promise((r) => setTimeout(r, 0));

describe('发音', () => {
  it('URL：小写、编码，落在 /api/audio/word/', () => {
    expect(wordAudioUrl('Abandon')).toMatch(/\/api\/audio\/word\/abandon$/);
    expect(wordAudioUrl('ice cream')).toMatch(/\/api\/audio\/word\/ice%20cream$/);
  });

  it('服务端音频能放 → 不碰系统语音', async () => {
    sayWord('abandon', { lang: 'en-GB' });
    await tick();
    expect(played).toHaveLength(1);
    expect(spoken).toEqual([]);
  });

  it('放不了（404 / 网络 / 浏览器拒绝）→ 退回系统语音，且只退一次', async () => {
    playResult = 'reject';
    sayWord('abandon', { lang: 'en-GB' });
    await tick();
    expect(spoken).toEqual(['en-GB:abandon']);
  });

  it('没有 Audio 这个东西的环境 → 直接系统语音', async () => {
    vi.stubGlobal('Audio', undefined);
    sayWord('abandon');
    await tick();
    expect(spoken).toEqual(['en-GB:abandon']);
  });

  it('空字符串什么都不做', async () => {
    sayWord('   ');
    await tick();
    expect(played).toEqual([]);
    expect(spoken).toEqual([]);
  });
});
