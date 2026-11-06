/**
 * 单词发音（2026-09-10）：先放服务端音频，放不了再退回系统语音。
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { playWord, sayWord, stopWord, wordAudioUrl } from '../lib/speak';

const played: string[] = [];
const spoken: string[] = [];
const instances: FakeAudio[] = [];
let playResult: 'ok' | 'reject';

class FakeAudio {
  src: string;
  handlers: Record<string, () => void> = {};
  constructor(src: string) {
    this.src = src;
    played.push(src);
    instances.push(this);
  }
  addEventListener(name: string, fn: () => void) {
    this.handlers[name] = fn;
  }
  pause = vi.fn();
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
  instances.length = 0;
  playResult = 'ok';
  vi.stubGlobal('Audio', FakeAudio);
  vi.stubGlobal('SpeechSynthesisUtterance', FakeUtterance);
  vi.stubGlobal('speechSynthesis', {
    cancel: vi.fn(),
    speak: (u: FakeUtterance) => spoken.push(`${u.lang}:${u.text}`),
  });
});
afterEach(() => { stopWord(); vi.unstubAllGlobals(); vi.restoreAllMocks(); });

const tick = () => new Promise((r) => setTimeout(r, 0));

describe('发音', () => {
  it('停止句柄可重复调用，停止后错误事件不会再触发系统发音', async () => {
    const stop = sayWord('care');
    stop(); stop(); instances[0].handlers.error();
    await tick();
    expect(instances[0].pause).toHaveBeenCalledOnce();
    expect(spoken).toEqual([]);
  });
  it('旧句柄与旧错误不会停止或覆盖新的发音', async () => {
    const oldStop = sayWord('care'); sayWord('next');
    oldStop(); instances[0].handlers.error();
    await tick();
    expect(instances[1].pause).not.toHaveBeenCalled(); expect(spoken).toEqual([]);
  });
  it('没有 Audio 时的系统发音也能停止', () => {
    vi.stubGlobal('Audio', undefined);
    const stop = sayWord('care');
    expect(spoken).toEqual(['en-GB:care']);
    vi.mocked(speechSynthesis.cancel).mockClear(); stop();
    expect(speechSynthesis.cancel).toHaveBeenCalledOnce();
  });
  it('停止后才到达的 playWord 失败也不再转系统发音', async () => {
    playResult = 'reject'; const playing = playWord('care'); stopWord();
    expect(await playing).toBe('failed'); expect(spoken).toEqual([]);
  });
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
