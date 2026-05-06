// Shared scrubber for CIE past-paper text extracted by PyMuPDF.
//
// Three call sites use this:
//   1. question-splitter — to trim per-question body before storing in DB
//      (so the rawExtractedText column doesn't carry the next question or
//      the legal footer of the paper).
//   2. rule-classifier — to score against clean text so the keyword rules
//      don't get fooled by "copyright" / "international" / etc. living
//      in the boilerplate trailer.
//   3. practice.service — to apply the same cuts on the way out, so any
//      questions ingested before this code shipped still display cleanly
//      until they get re-ingested.

// Earliest occurrence of any of these markers ends the question body —
// every CIE QP appends a verbatim copyright statement plus blank-page
// runs after the last question, and that footer is what poisons both
// display and topic classification when the splitter overshoots.
const FOOTER_MARKERS: RegExp[] = [
  /Permission to reproduce items where third[- ]party/i,
  /Cambridge Assessment International Education Copyright Acknowledgements/i,
  /Local Examinations Syndicate \(UCLES\)/i,
  /©\s*UCLES\s+\d{4}/i,
  /\bBLANK\s+PAGE\b/,
  /\bThis document has \d+ pages\b/i,
  /To avoid the issue of disclosure of answer[- ]related information/i,
  /www\.cambridgeinternational\.org/i,
];

export function truncateAtFooter(text: string): string {
  if (!text) return '';
  let cut = text.length;
  for (const re of FOOTER_MARKERS) {
    const idx = text.search(re);
    if (idx >= 0 && idx < cut) cut = idx;
  }
  return text.slice(0, cut).trimEnd();
}

// Lines that are pure noise — page barcodes, margin watermarks, paper
// reference codes, ascii mojibake from font-stripped strokes.
const DROP_LINE_PATTERNS: RegExp[] = [
  /DO\s*NOT\s*WRITE\s*IN\s*THIS\s*MARGIN/i,
  /^\s*\*\s*\d{10,}\s*\*\s*$/,                  // page barcode tokens
  /^\s*[\s,.\-]+\s*$/,                          // pure punctuation/whitespace
  /^\s*DFD\s*$/i,                               // page corner code
  /^\s*©\s*UCLES\s+\d{4}\s*$/i,                 // copyright line by itself
  /^\s*9618\/\d{2}\/[A-Z]\/[A-Z]\/\d{2}\s*$/i,  // CIE paper ref code
  /^\s*\[?Turn\s*over\]?\s*$/i,
  /^\s*\d+\s*$/,                                // bare page numbers
  // ASCII mojibake the font-stripper leaves behind: lines made of
  // commas, spaces, and runs of zeros. Q9 of 9618_w25_qp_11 carried
  // ",0000  00000000," as its tail — none of that is content.
  /^\s*,?\s*0{2,}(?:\s+0{2,})*\s*,?\s*$/,
  /^\s*0{2,}(?:\s+0{2,}){2,}\s*$/,
];

// Lines that are mostly non-ASCII (mojibake from font-stripped strokes).
function looksLikeMojibake(line: string): boolean {
  if (!line) return false;
  const total = line.length;
  if (total < 4) return false;
  let weird = 0;
  for (const ch of line) {
    const c = ch.codePointAt(0)!;
    if (c > 0x7e && (c < 0x2010 || c > 0x2122)) weird++;
  }
  return weird / total > 0.35;
}

export function stripBoilerplateLines(text: string): string {
  if (!text) return '';
  const lines = text.split(/\r?\n/);
  const out: string[] = [];
  let blanks = 0;
  for (const line of lines) {
    const trimmed = line.replace(/\s+$/, '');
    if (DROP_LINE_PATTERNS.some((re) => re.test(trimmed))) continue;
    if (looksLikeMojibake(trimmed)) continue;
    if (trimmed === '') {
      // Collapse runs of blank lines so cleaned text doesn't look stretched.
      if (blanks++ < 1) out.push('');
      continue;
    }
    blanks = 0;
    out.push(trimmed);
  }
  return out.join('\n').trim();
}

/**
 * Single entry point used by splitter / classifier / display layer:
 *  1. Cut at the earliest copyright/license footer marker.
 *  2. Drop boilerplate lines (margin watermarks, barcodes, mojibake).
 *
 * Idempotent — safe to run on already-clean text.
 */
export function cleanCieQuestionText(raw: string): string {
  return stripBoilerplateLines(truncateAtFooter(raw));
}
