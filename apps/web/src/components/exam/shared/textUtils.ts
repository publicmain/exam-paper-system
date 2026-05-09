/** Shared text-cleaning utilities used by every passage-based renderer.
 *  Lifted out of MorningQuizTake so we can unit-test in isolation. */

/** Replace U+FFFD (replacement char) with en-dash. The PDF ingest pipeline
 *  loses dashes when CIE PDFs use a font we don't have. */
export function clean(s: string | null | undefined): string {
  if (!s) return '';
  return s.replace(/�/g, '–').replace(/\r\n/g, '\n');
}

/** Reflow a column-broken PDF passage. PyMuPDF places a newline at every
 *  visual line; we fold single newlines into spaces, preserve double
 *  newlines as paragraph breaks, then bump capital-letter paragraph
 *  markers ("A The Babylonians…") onto fresh lines. */
export function reflowPassage(s: string): string {
  if (!s) return '';
  const blocks = s.replace(/\r\n/g, '\n').split(/\n\s*\n/);
  const out = blocks
    .map((b) => b.replace(/\n+/g, ' ').replace(/\s{2,}/g, ' ').trim())
    .filter(Boolean)
    .join('\n\n');
  return out.replace(/(^|[^\n])\s+([A-Z])\s+(?=[A-Z][a-z])/g, '$1\n\n$2 ');
}

/** Split an IELTS task stem into a shared instruction (block above the
 *  blank line) and the per-question item. Splits on the LAST blank-line
 *  break so the bank-of-headings stays attached to the instruction. */
export function splitStem(stem: string): { instruction: string; item: string } {
  const trimmed = stem.trim();
  const matches = [...trimmed.matchAll(/\n\s*\n/g)];
  if (matches.length === 0) return { instruction: '', item: trimmed };
  const last = matches[matches.length - 1];
  const splitAt = last.index ?? 0;
  return {
    instruction: trimmed.slice(0, splitAt).trim(),
    item: trimmed.slice(splitAt + last[0].length).trim(),
  };
}
