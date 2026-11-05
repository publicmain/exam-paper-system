/** Browser-safe, dependency-free sentence rules, also used by the offline tools.
 * Offsets always refer to the ORIGINAL string: highlights must not move.
 */
export const SENTENCE_VOICE = 'en_GB-alba-medium';

export function normalizeSentence(text: string): string {
  return text.replace(/[‘’]/g, "'").replace(/[“”]/g, '"').replace(/\s+/g, ' ').trim();
}

export interface SentenceRange { text: string; start: number; end: number }

function abbreviated(text: string, at: number): boolean {
  if (/\d/.test(text[at - 1] ?? '') && /\d/.test(text[at + 1] ?? '')) return true;
  // First dots inside e.g., i.e., U.K., etc.
  if (/[A-Za-z]/.test(text[at - 1] ?? '') && /[A-Za-z]/.test(text[at + 1] ?? '')) return true;
  const token = text.slice(0, at + 1).match(/([A-Za-z.]+)\.$/)?.[1]?.toLowerCase() ?? '';
  if (/^(mr|mrs|ms|dr|prof|sr|jr|st|e\.g|i\.e)$/.test(token)) return true;
  const next = text.slice(at + 1).trimStart();
  if (/^[a-z]$/.test(token) && /^[A-Z]/.test(next)) return true; // J. Smith
  if (/^(a\.m|p\.m|u\.s|u\.k|etc)$/.test(token) && /^[a-z]/.test(next)) return true;
  return false;
}

export function splitSentenceRanges(body: string): SentenceRange[] {
  const out: SentenceRange[] = [];
  let start = 0;
  const emit = (end: number) => {
    let lo = start;
    let hi = end;
    while (lo < hi && /\s/.test(body[lo])) lo++;
    while (hi > lo && /\s/.test(body[hi - 1])) hi--;
    if (lo < hi) out.push({ text: body.slice(lo, hi), start: lo, end: hi });
    start = end;
  };
  for (let i = 0; i < body.length; i++) {
    if (body[i] === '\n') {
      const tail = body.slice(i + 1);
      // Blank lines, paragraph labels, and a new speaker are hard boundaries.
      if (/^\s*\n/.test(tail) || /^\s*(?:["“—-]|[A-Z][a-z]+:)/.test(tail)
        || /^\s*Paragraph\s+[0-9A-H]+\s*$/i.test(body.slice(start, i))) emit(i + 1);
      continue;
    }
    if (!/[.!?]/.test(body[i]) || (body[i] === '.' && abbreviated(body, i))) continue;
    let end = i + 1;
    while (/[.!?]/.test(body[end] ?? '') && end < body.length) end++;
    let quoted = false;
    while (/["'”’\])]/.test(body[end] ?? '') && end < body.length) { quoted = true; end++; }
    if (end < body.length && !/\s/.test(body[end])) continue;
    // "Really?" she asked. / "Stop!" said Tom.
    if (quoted && (/^[ \t]+[a-z]/.test(body.slice(end))
      || /^[ \t]+[A-Z][a-z]+\s+(?:said|asked|replied|whispered|shouted|answered)\b/.test(body.slice(end)))) {
      i = end - 1; continue;
    }
    emit(end);
    i = end - 1;
  }
  emit(body.length);
  return out;
}

export function splitSentenceParagraphs(body: string): SentenceRange[][] {
  const paragraphs: SentenceRange[][] = [];
  for (const sentence of splitSentenceRanges(body)) {
    const last = paragraphs[paragraphs.length - 1];
    const prev = last?.[last.length - 1];
    if (!prev || /\n/.test(body.slice(prev.end, sentence.start))) paragraphs.push([sentence]);
    else last.push(sentence);
  }
  return paragraphs;
}
