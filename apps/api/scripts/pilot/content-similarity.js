'use strict';

function tokens(text) {
  return String(text || '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim().split(' ').filter((word) => word.length > 2);
}

function shingles(text, size = 5) {
  const words = tokens(text);
  const out = new Set();
  for (let index = 0; index <= words.length - size; index += 1) out.add(words.slice(index, index + size).join(' '));
  return out;
}

/** Containment catches a copied section even when one passage is much longer. */
function containmentSimilarity(left, right, size = 5) {
  const a = shingles(left, size);
  const b = shingles(right, size);
  if (!a.size || !b.size) return 0;
  let overlap = 0;
  for (const value of a) if (b.has(value)) overlap += 1;
  return overlap / Math.min(a.size, b.size);
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

function findNearDuplicate(candidates, history, threshold, shingleSize = 5) {
  for (const candidate of candidates) {
    for (const previous of history) {
      if (!candidate.text || !previous.text || candidate.id === previous.id) continue;
      const similarity = containmentSimilarity(candidate.text, previous.text, shingleSize);
      if (similarity >= threshold) return { candidateId: candidate.id, previousId: previous.id, similarity };
    }
  }
  return null;
}

module.exports = { tokens, shingles, containmentSimilarity, findNearDuplicate, questionItem };
