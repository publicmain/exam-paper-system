'use strict';

/**
 * 词面近似重复（发布查重门用）。
 *
 * 版本号跟着拒绝原因一起打出来，事后能对回「当时是用哪一版规则拦的 / 放的」。
 *
 *   v1  5 词（文章）/ 4 词（题干）片段的 containment；不足一个片段的短文本恒为 0
 *   v2  2026-09-11：不足一个片段的短文本改为「归一化后逐词相同」判重
 *       （原来两道一模一样的短题干永远查不出来）；片段集合每条文本只算一次
 *       （历史全量分页之后比较次数上万，原来每一对都重算两遍）。判定结果
 *       对 ≥ 一个片段的文本与 v1 完全相同。
 */
const ALGORITHM_VERSION = 'shingle-containment/v2';

function tokens(text) {
  return String(text || '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim().split(' ').filter((word) => word.length > 2);
}

function shingles(text, size = 5) {
  const words = tokens(text);
  const out = new Set();
  for (let index = 0; index <= words.length - size; index += 1) out.add(words.slice(index, index + size).join(' '));
  return out;
}

/** 一条文本的比较用指纹：片段集合 + 归一化词串（短文本兜底用）。 */
function fingerprint(text, size) {
  const words = tokens(text);
  return { shingles: shingles(text, size), normalized: words.join(' '), short: words.length > 0 && words.length < size };
}

function similarityOf(a, b) {
  if (a.shingles.size && b.shingles.size) {
    let overlap = 0;
    const [small, large] = a.shingles.size <= b.shingles.size ? [a.shingles, b.shingles] : [b.shingles, a.shingles];
    for (const value of small) if (large.has(value)) overlap += 1;
    return overlap / small.size;
  }
  // 两边都短于一个片段：只认逐词相同（"Why?" 与 "Why?"），不做模糊比较
  if (a.short && b.short) return a.normalized === b.normalized ? 1 : 0;
  return 0;
}

/** Containment catches a copied section even when one passage is much longer. */
function containmentSimilarity(left, right, size = 5) {
  return similarityOf(fingerprint(left, size), fingerprint(right, size));
}

/**
 * 题干里**真正属于这道题**的那一段。
 *
 * 题干的形状是「指令 + 换行 + 题目」，而同一个题组里的指令是**故意完全相同**的
 * ——「Do the following statements agree with…」这段雅思标准指令，一天里
 * 三道判断题共用一份，这是题型格式，不是抄袭。
 *
 * 拿整条题干去查重，量到的其实是这段模板：实测第一周的判断题两两相似度
 * 0.788，首发周 0.818，一个刚好在 0.8 阈值下、一个刚好在上 —— 通没通过
 * 取决于题面长了几个词，与内容是否重复无关。而真正该拦的「同一道题换个
 * 指令再发一次」反倒量不出来。
 *
 * 所以查重只看指令之后的部分。没有换行的题干原样返回。
 */
function questionItem(stem) {
  const text = String(stem || '');
  const cut = text.lastIndexOf('\n');
  return cut >= 0 ? text.slice(cut + 1).trim() : text.trim();
}

/**
 * 第一对 ≥ 阈值的（候选, 历史）。返回值带上相似度、阈值、片段长度和算法
 * 版本 —— 拒绝原因要能说清「为什么拦」。
 */
function findNearDuplicate(candidates, history, threshold, shingleSize = 5) {
  const prints = history
    .filter((previous) => previous.text)
    .map((previous) => ({ previous, print: fingerprint(previous.text, shingleSize) }));
  for (const candidate of candidates) {
    if (!candidate.text) continue;
    const mine = fingerprint(candidate.text, shingleSize);
    for (const { previous, print } of prints) {
      if (candidate.id === previous.id) continue;
      const similarity = similarityOf(mine, print);
      if (similarity >= threshold) {
        return {
          candidateId: candidate.id,
          previousId: previous.id,
          similarity,
          threshold,
          shingleSize,
          algorithm: ALGORITHM_VERSION,
        };
      }
    }
  }
  return null;
}

module.exports = { ALGORITHM_VERSION, tokens, shingles, containmentSimilarity, findNearDuplicate, questionItem };
