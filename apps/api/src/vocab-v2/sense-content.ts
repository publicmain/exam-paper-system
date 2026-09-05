const POS_ALIASES: Record<string, string[]> = {
  noun: ['n', 'noun'], n: ['n', 'noun'],
  verb: ['v', 'vi', 'vt', 'verb'], v: ['v', 'vi', 'vt', 'verb'],
  adj: ['a', 'adj', 'adjective'], adjective: ['a', 'adj', 'adjective'],
  adv: ['ad', 'adv', 'adverb'], adverb: ['ad', 'adv', 'adverb'],
  prep: ['prep', 'preposition'], preposition: ['prep', 'preposition'],
  conj: ['conj', 'conjunction'], conjunction: ['conj', 'conjunction'],
};

export function canonicalPos(raw: string | null | undefined): string {
  const value = String(raw ?? '').trim().toLowerCase().replace(/\.$/, '');
  if (!value) return 'other';
  if (/^(n|noun)/.test(value)) return 'noun';
  if (/^(v|verb|vi|vt)/.test(value)) return 'verb';
  if (/^(a|adj|adjective)/.test(value) && !/^adv/.test(value)) return 'adjective';
  if (/^(ad|adv|adverb)/.test(value)) return 'adverb';
  if (/^(prep|preposition)/.test(value)) return 'preposition';
  if (/^(conj|conjunction)/.test(value)) return 'conjunction';
  return value.split(/[\s,/]/)[0] || 'other';
}

export function senseKey(pos: string, ordinal = 1): string {
  return `${canonicalPos(pos)}:${String(Math.max(1, Math.floor(ordinal))).padStart(2, '0')}`;
}

/** Select the POS-matching ECDICT line without pretending all meanings are one sense. */
export function translationForPos(translation: string | null | undefined, pos: string): string {
  const text = String(translation ?? '').replace(/\\n/g, '\n').trim();
  if (!text) return '';
  const aliases = POS_ALIASES[canonicalPos(pos)] ?? [canonicalPos(pos)];
  const lines = text.split(/\n+/).map((line) => line.trim()).filter(Boolean);
  const matching = lines.filter((line) => {
    const label = line.match(/^([a-z]+)\./i)?.[1]?.toLowerCase();
    return label ? aliases.includes(label) : false;
  });
  const selected = matching.length ? matching.join('；') : lines[0];
  return selected.replace(/\s+/g, ' ').slice(0, 500);
}

/**
 * ECDICT 很多词条 `pos` 字段是空的，但中文释义开头带着「n. / vt. / adj.」。
 * 词性拿不到时从释义第一行推一下，别让 `other` 落库再被当标签打出来
 * （2026-09-05 盲测 P2-10：「other. n. 大灾难」）。
 */
export function inferPosFromTranslation(translation: string | null | undefined): string | null {
  const text = String(translation ?? '').replace(/\\n/g, '\n').trim();
  const label = text.match(/^([a-z]{1,5})\.\s/i)?.[1]?.toLowerCase();
  if (!label) return null;
  const pos = canonicalPos(label);
  return pos === 'other' ? null : pos;
}
