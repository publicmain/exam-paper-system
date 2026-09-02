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

module.exports = { tokens, shingles, containmentSimilarity, findNearDuplicate };
