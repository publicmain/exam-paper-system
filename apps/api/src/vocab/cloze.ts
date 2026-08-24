/**
 * 例句挖空的定位算法 —— 翻卡正面和自测 cloze 题共用的规格。
 *
 * 2026-08-24 审计发现的真数据：2958 条带例句的生词里，**764 条（26%）**
 * 的词形只以子串形式出现在例句里 —— `agree` ⊂ "agreed"、`squeeze` ⊂
 * "squeezed"、`rag` ⊂ "rags"。旧实现用 `indexOf` 定位，会把 "agreed"
 * 挖成「＿＿＿d」：显示是坏的，残留的后缀还把答案提示了一半。
 * 另有 72 条例句里根本没有那个词（连子串都不是），旧实现原样显示整句，
 * 答案直接可见。
 *
 * 规则（按优先级）：
 *   1. 完整词形命中 → 挖那个词
 *   2. 词干前缀命中 → 挖**整个 token**（agree → 把 "agreed" 全挖掉）。
 *      词干 = 词形去掉结尾的 e（rotate → rotat ⊂ rotating）。
 *      词干至少 4 个字母才启用，避免 at/rag 这类短词大面积误挖。
 *   3. 都不命中 → 返回 null。调用方自己决定：翻卡退化成「高亮学习卡」，
 *      自测放弃 cloze 题型改出词义题 —— 都不能硬挖。
 *
 * 纯函数，前后端各有一份实现（apps/web/src/lib/cloze.ts），规格必须
 * 一致，两边的测试互为镜像。
 */

export interface ClozeSpan {
  /** 挖空起点（含） */
  start: number;
  /** 挖空终点（不含） */
  end: number;
  /** 实际被挖掉的原文片段 */
  token: string;
}

const escapeRe = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

export function findClozeSpan(sentence: string, surface: string): ClozeSpan | null {
  const sf = (surface ?? '').trim();
  if (!sentence || !sf) return null;

  // 1. 完整词形（大小写不敏感，词边界）
  const whole = new RegExp(`\\b${escapeRe(sf)}\\b`, 'i').exec(sentence);
  if (whole) {
    return { start: whole.index, end: whole.index + whole[0].length, token: whole[0] };
  }

  // 2. 词干前缀 → 挖整个 token。词干太短会误伤（rag ⊂ rags 想要，但
  //    at ⊂ attainments 绝对不要），限 ≥4 字母；3 字母词允许「词形+s/es」
  //    这一种最保守的变形。
  const stem = sf.toLowerCase().replace(/e$/, '');
  const tokenRe = /[A-Za-z][A-Za-z'’-]*/g;
  let m: RegExpExecArray | null;
  while ((m = tokenRe.exec(sentence))) {
    const tok = m[0].toLowerCase();
    if (stem.length >= 4 && tok.startsWith(stem)) {
      return { start: m.index, end: m.index + m[0].length, token: m[0] };
    }
    if (stem.length === 3) {
      // 3 字母词不能用宽前缀（car ⊂ carrying 会误挖），只认白名单变形：
      // +s/+es/+ed，以及双写末辅音的 +ing/+ed（rot → rotting/rotted）。
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
