// 与 scripts/pilot/gloss/tokens.js 保持逐字规则一致；25 篇正文的对照测试防止漂移。
export function glossKey(raw: unknown): string {
  let w = String(raw == null ? '' : raw).normalize('NFKC').replace(/[‘’ʼ]/g, "'").toLowerCase().trim();
  w = w.replace(/^[^a-z]+|[^a-z]+$/g, '');
  if (w.endsWith("'s")) w = w.slice(0, -2);
  else if (w.endsWith("s'")) w = w.slice(0, -1);
  return w;
}

export const WORD_RE = /[A-Za-z]+(?:['’][A-Za-z]+)*(?:-[A-Za-z]+(?:['’][A-Za-z]+)*)*/g;

export function articleTokens(passage: unknown): string[] {
  const text = String(passage == null ? '' : passage).replace(/^Paragraph \d+\s*$/gm, ' ');
  const seen = new Set<string>();
  const out: string[] = [];
  const add = (k: string) => { if (k && k.length >= 1 && !seen.has(k)) { seen.add(k); out.push(k); } };
  for (const m of text.matchAll(WORD_RE)) {
    const whole = glossKey(m[0]);
    add(whole);
    if (whole.includes('-')) for (const part of whole.split('-')) add(glossKey(part));
  }
  return out;
}

export interface WordGloss { pos: string; zh: string; lemma?: string }
export type WordGlosses = Record<string, WordGloss>;

export function normalizedPassage(text: string): string {
  return text.replace(/\s+/g, ' ').trim();
}
