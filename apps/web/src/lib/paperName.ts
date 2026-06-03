/**
 * Student-facing presentation helpers for the morning-quiz result/history
 * pages. Pure functions, no side effects — safe to share across
 * MyHistory, MyHistoryDetail and StudentResult.
 */

/**
 * Morning-quiz papers are stored with an internal slug name, e.g.
 *   "Morning Quiz OLEVEL/ai_authored_olevel_20_unsent_letter_v1/Paper2 (2026-06-03)"
 * which leaks file-path-style internals (and the word "ai_authored") to
 * students. Map it to a friendly label: "早测 · O-Level 英语 · 2026-06-03".
 *
 * Conservative: anything that doesn't look like a morning-quiz slug is
 * returned verbatim, so non-quiz paper names (or future formats) are never
 * mangled.
 */
export function prettifyPaperName(raw: string | null | undefined): string {
  if (!raw) return raw ?? '';
  const head = raw.match(/^Morning Quiz\s+([A-Za-z_]+)\//);
  if (!head) return raw; // not a morning-quiz slug — leave untouched
  const levelRaw = head[1].toUpperCase();
  const levelCN =
    levelRaw === 'OLEVEL'
      ? 'O-Level 英语'
      : levelRaw.includes('IELTS')
      ? '雅思'
      : head[1];
  const dateM = raw.match(/\((\d{4}-\d{2}-\d{2})\)\s*$/);
  const date = dateM ? dateM[1] : '';
  return date ? `早测 · ${levelCN} · ${date}` : `早测 · ${levelCN}`;
}

/**
 * Section-B style morning-quiz questions repeat the same long
 * "Read the narrative text below… not from a past exam paper. Qn." preamble
 * at the start of every question's stem. Rendering it once per question
 * buries the actual question text (especially on phones). This computes the
 * longest common prefix across all stems so the caller can show it once at
 * the top and strip it from each per-question stem.
 *
 * Returns '' when there's no meaningful shared preamble (fewer than 2
 * stems, or the common prefix is too short to be worth extracting). The
 * cut is pulled back to a sentence/clause boundary so we never slice a word
 * in half — if no clean boundary exists past the threshold, returns ''.
 */
export function commonStemPrefix(stems: string[]): string {
  const nonEmpty = stems.filter((s) => typeof s === 'string' && s.length > 0);
  if (nonEmpty.length < 2) return '';

  // Quiz papers mix a short-answer group (every stem sharing a long
  // "Read the narrative… Qn." preamble) with an MCQ/flowchart group (a
  // different shared stem). A whole-set common prefix is therefore almost
  // always empty. Instead, find the longest ≥40-char prefix shared by at
  // least half the stems: that captures the dominant group's repeated
  // preamble, while staying empty on papers where questions genuinely
  // differ (e.g. mixed IELTS task types) so nothing is wrongly hidden.
  const need = Math.max(2, Math.ceil(nonEmpty.length / 2));
  let best = '';
  for (const anchor of nonEmpty) {
    let good = '';
    // Prefix match-count is monotonic in length, so grow until too few
    // stems still share it, then stop.
    for (let len = 40; len <= anchor.length; len++) {
      const pre = anchor.slice(0, len);
      let cnt = 0;
      for (const s of nonEmpty) if (s.startsWith(pre)) cnt++;
      if (cnt >= need) good = pre;
      else break;
    }
    if (good.length > best.length) best = good;
  }
  if (best.length < 40) return '';

  // Drop a trailing partial word, then pull back to the last sentence /
  // clause boundary so the extracted intro reads as a complete unit and
  // never slices a word in half.
  const noPartialWord = best.replace(/\s+\S*$/, '');
  const boundary = Math.max(
    noPartialWord.lastIndexOf('. '),
    noPartialWord.lastIndexOf('? '),
    noPartialWord.lastIndexOf('! '),
    noPartialWord.lastIndexOf('。'),
    noPartialWord.lastIndexOf('\n'),
  );
  if (boundary < 40) return '';
  return noPartialWord.slice(0, boundary + 1).trim();
}

/**
 * Strip a known common-prefix intro from one stem. Falls back to the
 * original stem if it doesn't actually start with the intro (defensive —
 * e.g. a stem shorter than the prefix, or whitespace drift).
 */
export function stripStemPrefix(stem: string, intro: string): string {
  if (!intro || !stem) return stem;
  // Compare on a whitespace-normalised basis is overkill here; the intro
  // came from these very stems, so a direct startsWith is reliable.
  if (stem.startsWith(intro)) {
    const rest = stem.slice(intro.length).replace(/^\s+/, '');
    return rest.length > 0 ? rest : stem; // never blank out the whole stem
  }
  return stem;
}
