export type AnswerLocation = { start: number; end: number };

// Match only frozen, visible text. The map preserves offsets after whitespace
// and typographic punctuation are folded; no fuzzy matching or HTML injection.
function fold(text: string) {
  let value = '';
  const offsets: number[] = [];
  for (let i = 0; i < text.length; i++) {
    let c = text[i].replace(/[‘’]/g, "'").replace(/[“”]/g, '"').replace(/[–—]/g, '-');
    const lower = c.toLowerCase();
    if (lower.length === 1) c = lower;
    if (/\s/.test(c)) {
      if (value.endsWith(' ')) continue;
      value += ' ';
    } else value += c;
    offsets.push(i);
  }
  return { value, offsets };
}

/** Only a single, whole phrase match may become a source sentence. */
export function locateAnswer(passage: string, quote: string): AnswerLocation | null {
  const needle = fold(quote).value.trim();
  if (needle.length < 4 || /^(true|false|not given)$/i.test(needle)) return null;
  const text = fold(passage);
  const hits: number[] = [];
  for (let from = 0; from < text.value.length;) {
    const at = text.value.indexOf(needle, from);
    if (at < 0) break;
    // A substring inside a different word is not an answer location.
    if (!(/[a-z0-9]/.test(needle[0]) && /[a-z0-9]/.test(text.value[at - 1] ?? '')) &&
      !(/[a-z0-9]/.test(needle.at(-1)!) && /[a-z0-9]/.test(text.value[at + needle.length] ?? ''))) hits.push(at);
    from = at + 1;
  }
  if (hits.length !== 1) return null;
  let start = text.offsets[hits[0]];
  let end = text.offsets[hits[0] + needle.length - 1] + 1;
  // Expand the match to its sentence, never across a paragraph/line boundary.
  while (start > 0 && !/[.!?\n]/.test(passage[start - 1])) start--;
  while (end < passage.length && !/[.!?\n]/.test(passage[end - 1])) end++;
  while (start < end && /\s/.test(passage[start])) start++;
  return { start, end };
}
