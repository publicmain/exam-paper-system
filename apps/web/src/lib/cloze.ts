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
