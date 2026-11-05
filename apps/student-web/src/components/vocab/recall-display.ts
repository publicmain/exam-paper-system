/**
 * Display normalization adapted from designfuchen/word-atlas, text.ts,
 * commit 19a9bd889d2f642fef1d8d0eef85a3f35e1a66ff, MIT.
 * Copyright (c) 2026 Word Atlas contributors. See THIRD_PARTY_NOTICES.md.
 * This is only for drawing slots; the API decides correctness.
 */
export function recallDisplay(value: string): string {
  return value.normalize('NFKC')
    .replace(/[‘’]/g, "'").replace(/[“”]/g, '"')
    .replace(/[‐‑‒–—―−]/g, '-').replace(/\s+/g, ' ').trim().toLowerCase();
}
