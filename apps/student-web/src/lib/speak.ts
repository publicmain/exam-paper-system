/**
 * 单词发音（2026-09-10）。
 *
 * 先放服务端的 Piper 音频（`/api/audio/word/:headword`，英式，全库一个
 * 音色），放不了 —— 没这个词、网络不通、浏览器拒绝 —— 再退回系统语音。
 *
 * 为什么不直接用系统语音：音色由设备决定，iPad 一个声音、安卓另一个，
 * 有些手机根本没装英式语音包，退成美音甚至不发声，而我们完全不知道。
 */
import { BASE } from './api';

export function wordAudioUrl(headword: string): string {
  return `${BASE}/api/audio/word/${encodeURIComponent(headword.trim().toLowerCase())}`;
}

export function speakWithSystemVoice(text: string, lang = 'en-GB'): void {
  if (typeof window === 'undefined' || !('speechSynthesis' in window)) return;
  speechSynthesis.cancel();
  const utterance = new SpeechSynthesisUtterance(text);
  utterance.lang = lang;
  speechSynthesis.speak(utterance);
}

let current: HTMLAudioElement | null = null;
let request = 0;

/** Invalidates pending fallbacks as well as stopping audio/system speech. */
export function stopWord(): void {
  request++;
  current?.pause();
  current = null;
  if (typeof window !== 'undefined' && 'speechSynthesis' in window) speechSynthesis.cancel();
}

/** The returned stop handle only owns this playback, never a newer caller's. */
export function sayWord(text: string, opts: { lang?: string } = {}): () => void {
  const headword = text.trim();
  if (!headword) return () => {};
  stopWord();
  const id = request;
  const stop = () => { if (request === id) stopWord(); };
  const fallback = () => { if (request === id) speakWithSystemVoice(headword, opts.lang ?? 'en-GB'); };
  if (typeof Audio === 'undefined') {
    fallback();
    return stop;
  }
  try {
    const audio = new Audio(wordAudioUrl(headword));
    current = audio;
    let fellBack = false;
    const fail = () => {
      if (fellBack || request !== id) return;
      fellBack = true;
      fallback();
    };
    audio.addEventListener('error', fail, { once: true });
    const playing = audio.play();
    if (playing && typeof playing.catch === 'function') void playing.catch(fail);
  } catch {
    fallback();
  }
  return stop;
}

/**
 * 和 `sayWord` 一样先放服务端音频、放不了退回系统语音，但把结果告诉调用方，
 * 让发音按钮能显示「正在加载 / 正在播放 / 放不出来」（审计 IOS-06）。
 *   · 'audio'    —— 服务端音频播起来了
 *   · 'fallback' —— 用了系统语音（设备有英语语音包时有声音）
 *   · 'failed'   —— 两条路都不行
 */
export async function playWord(text: string, opts: { lang?: string } = {}): Promise<'audio' | 'fallback' | 'failed'> {
  const headword = text.trim();
  if (!headword) return 'failed';
  stopWord();
  const id = request;
  const systemVoice = (): 'fallback' | 'failed' => {
    if (request !== id) return 'failed';
    if (typeof window === 'undefined' || !('speechSynthesis' in window)) return 'failed';
    speakWithSystemVoice(headword, opts.lang ?? 'en-GB');
    return 'fallback';
  };
  if (typeof Audio === 'undefined') return systemVoice();
  try {
    const audio = new Audio(wordAudioUrl(headword));
    current = audio;
    const ok = await new Promise<boolean>((resolve) => {
      audio.addEventListener('error', () => resolve(false), { once: true });
      const p = audio.play();
      if (p && typeof p.then === 'function') p.then(() => resolve(true), () => resolve(false));
      else resolve(true);
    });
    return request !== id ? 'failed' : ok ? 'audio' : systemVoice();
  } catch {
    return systemVoice();
  }
}

/**
 * 放一段已经取回的音频（听写题，VOC04）。放不了就说放不了 ——
 * **不退回系统语音**：那需要把目标词念出来，而题面本来就不该有它。
 */
export async function playBlob(blob: Blob): Promise<'audio' | 'failed'> {
  if (typeof Audio === 'undefined' || typeof URL === 'undefined' || !URL.createObjectURL) return 'failed';
  stopWord();
  const url = URL.createObjectURL(blob);
  try {
    current?.pause();
    const audio = new Audio(url);
    current = audio;
    const release = () => URL.revokeObjectURL(url);
    audio.addEventListener('ended', release, { once: true });
    const ok = await new Promise<boolean>((resolve) => {
      audio.addEventListener('error', () => resolve(false), { once: true });
      const p = audio.play();
      if (p && typeof p.then === 'function') p.then(() => resolve(true), () => resolve(false));
      else resolve(true);
    });
    if (!ok) release();
    return ok ? 'audio' : 'failed';
  } catch {
    URL.revokeObjectURL(url);
    return 'failed';
  }
}
