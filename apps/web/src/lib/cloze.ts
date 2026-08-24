/**
 * 例句挖空定位 —— apps/api/src/vocab/cloze.ts 的前端镜像，规格必须一致。
 *
 * 为什么要有这个：2026-08-24 审计发现 26% 的生词卡例句里，词形只以子串
 * 出现（agree ⊂ agreed、rot ⊂ rotting），旧的 indexOf 挖空会挖出
 * 「＿＿＿d」这种残缺提示；另有 72 条例句里根本没有那个词，旧实现原样
 * 显示整句 —— 答案直接可见。
 *
 * 规则：完整词形优先 → 词干前缀命中时挖整个 token（词干 ≥4 字母）→
 * 3 字母词只认白名单变形（+s/+es/+ed/双写辅音+ing/ed）→ 都不中返回
 * null，由调用方退化成「高亮学习卡」。
 */

export interface ClozeSpan {
  start: number;
  end: number;
  token: string;
}

const escapeRe = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

export function findClozeSpan(sentence: string, surface: string): ClozeSpan | null {
  const sf = (surface ?? '').trim();
  if (!sentence || !sf) return null;

  const whole = new RegExp(`\\b${escapeRe(sf)}\\b`, 'i').exec(sentence);
  if (whole) {
    return { start: whole.index, end: whole.index + whole[0].length, token: whole[0] };
  }

  const stem = sf.toLowerCase().replace(/e$/, '');
  const tokenRe = /[A-Za-z][A-Za-z'’-]*/g;
  let m: RegExpExecArray | null;
  while ((m = tokenRe.exec(sentence))) {
    const tok = m[0].toLowerCase();
    if (stem.length >= 4 && tok.startsWith(stem)) {
      return { start: m.index, end: m.index + m[0].length, token: m[0] };
    }
    if (stem.length === 3) {
      const w = sf.toLowerCase();
      const doubled = w + w[w.length - 1];
      const allowed = [`${w}s`, `${w}es`, `${w}ed`, `${doubled}ing`, `${doubled}ed`];
      if (allowed.includes(tok)) {
        return { start: m.index, end: m.index + m[0].length, token: m[0] };
      }
    }
  }
  return null;
}

/**
 * 长句围绕挖空处开窗（学生十问修复 #5）。
 *
 * wrong_answer 收录的词带着雅思学术长句作语境 —— 卡片/题干上 300 字符
 * 的句子对轻量层学生是墙，不是提示。超过 maxLen 时以挖空处为中心取窗，
 * 两端在词边界收口并加省略号；span 偏移同步平移，调用方照常挖空。
 */
export function windowAroundSpan(
  sentence: string,
  span: ClozeSpan,
  maxLen = 180,
): { text: string; span: ClozeSpan } {
  if (sentence.length <= maxLen) return { text: sentence, span };
  const radius = Math.max(20, Math.floor((maxLen - (span.end - span.start)) / 2));
  let start = Math.max(0, span.start - radius);
  let end = Math.min(sentence.length, span.end + radius);
  // 词边界收口：绝不把窗口边缘的单词拦腰切断
  if (start > 0) {
    const sp = sentence.indexOf(' ', start);
    if (sp >= 0 && sp < span.start) start = sp + 1;
  }
  if (end < sentence.length) {
    const sp = sentence.lastIndexOf(' ', end);
    if (sp > span.end) end = sp;
  }
  const prefix = start > 0 ? '…' : '';
  const suffix = end < sentence.length ? '…' : '';
  const shift = start - prefix.length;
  return {
    text: prefix + sentence.slice(start, end) + suffix,
    span: { start: span.start - shift, end: span.end - shift, token: span.token },
  };
}

/** 无挖空处可对齐时的朴素截断（学习卡显示用）。 */
export function trimSentence(sentence: string, maxLen = 220): string {
  if (sentence.length <= maxLen) return sentence;
  const cut = sentence.lastIndexOf(' ', maxLen);
  return sentence.slice(0, cut > maxLen / 2 ? cut : maxLen) + '…';
}
