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
 *  markers ("A The Babylonians…") onto fresh lines.
 *
 *  R15-Audit#1 — the old regex `(^|[^\n])\s+([A-Z])\s+(?=[A-Z][a-z])`
 *  misfired on common English patterns: "the U S Senate", "J K Rowling",
 *  "Mr P Smith", "a U S military base" — every "lone capital between
 *  spaces followed by a Title-cased word" got split into a new
 *  paragraph, silently corrupting OLEVEL passages with named initials.
 *
 *  The new pattern is conservative: only inject a paragraph break if
 *  the lone capital appears at the START of a line (or right after a
 *  sentence-ending punctuation `[.!?]`) — i.e. the structural cue that
 *  a paragraph label would carry in a real IELTS PDF — AND the
 *  following word is capitalised AND there's no other capital between
 *  them. Initials in mid-sentence text no longer trigger. */
export function reflowPassage(s: string): string {
  if (!s) return '';
  const blocks = s.replace(/\r\n/g, '\n').split(/\n\s*\n/);
  const out = blocks
    .map((b) => {
      // 内容包每段第一行是「Paragraph 1」这类标签，单换行会被下面折成空格、
      // 和正文粘成一行（2026-09-06 复测）。标签留在自己那一行。
      const m = b.match(/^\s*(Paragraph\s+[0-9A-H]+)\s*\n([\s\S]*)$/i);
      const label = m ? m[1] : null;
      const body = (m ? m[2] : b).replace(/\n+/g, ' ').replace(/\s{2,}/g, ' ').trim();
      return label ? `${label}\n${body}` : body;
    })
    .filter(Boolean)
    .join('\n\n');
  // Conservative re-injection of IELTS paragraph labels: ONLY when the
  // lone capital is the first token of a block or immediately after a
  // sentence-ending punctuation followed by a space. Initials in
  // mid-sentence text ("the U S Senate") no longer get split.
  return out
    .replace(
      /(^|[.!?]\s)([A-Z])\s+(?=[A-Z][a-z])/g,
      (_, prefix, label) => `${prefix.trimEnd()}\n\n${label} `,
    )
    // The `^` alternation injects a leading `\n\n` at position 0 when
    // the passage starts with a paragraph label ("A The Babylonians…").
    // Strip it so the first paragraph isn't preceded by a blank line.
    .replace(/^\n+/, '');
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
