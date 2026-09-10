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

export function sayWord(text: string, opts: { lang?: string } = {}): void {
  const headword = text.trim();
  if (!headword) return;
  const fallback = () => speakWithSystemVoice(headword, opts.lang ?? 'en-GB');
  if (typeof Audio === 'undefined') {
    fallback();
    return;
  }
  try {
    current?.pause();
    const audio = new Audio(wordAudioUrl(headword));
    current = audio;
    let fellBack = false;
    const fail = () => {
      if (fellBack) return;
      fellBack = true;
      fallback();
    };
    audio.addEventListener('error', fail, { once: true });
    const playing = audio.play();
    if (playing && typeof playing.catch === 'function') void playing.catch(fail);
  } catch {
    fallback();
  }
}
