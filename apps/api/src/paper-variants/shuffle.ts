/**
 * Deterministic seeded shuffle utilities.
 *
 * Why our own PRNG instead of Math.random?
 *   The whole point of variants is that a student who refreshes
 *   mid-exam sees the SAME form. Math.random isn't seedable, so we
 *   use mulberry32 — a tiny, well-tested 32-bit PRNG. Same seed →
 *   same sequence → same shuffle.
 *
 * Why one seed per (student, assignment) instead of per-student?
 *   So the same student gets a different form for different papers
 *   (and so re-using a paper for a new class doesn't replay the same
 *   variant assignments).
 */

/** Tiny seedable PRNG. Returns a function that emits floats in [0,1). */
export function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return function () {
    a = (a + 0x6D2B79F5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/**
 * In-place Fisher-Yates against a seeded PRNG. Returns the input
 * (mutated) for ergonomic chaining.
 */
export function shuffleInPlace<T>(arr: T[], rand: () => number): T[] {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    const tmp = arr[i];
    arr[i] = arr[j];
    arr[j] = tmp;
  }
  return arr;
}

/**
 * Build a per-pq option shuffle map.
 *   originalKeys is the list of option keys on the question
 *   (typically ['A','B','C','D']).
 * Returns an object mapping originalKey → displayLetter. The
 * take-paper UI relabels options using this map at render time so
 * the underlying answer (still keyed by originalKey) lines up with
 * the stored mark scheme.
 */
export function buildOptionMap(
  originalKeys: string[],
  rand: () => number,
): Record<string, string> {
  const targets = [...originalKeys];
  shuffleInPlace(targets, rand);
  const map: Record<string, string> = {};
  for (let i = 0; i < originalKeys.length; i++) {
    map[originalKeys[i]] = targets[i];
  }
  return map;
}

/**
 * Pick a per-student seed deterministic from (studentId, assignmentId).
 * String hashing is FNV-1a 32-bit — fast, deterministic, fine for
 * non-cryptographic seeding. We deliberately don't use a randomly
 * generated number here so re-running generate-for-class produces
 * the same seeds (idempotency).
 */
export function deriveSeed(assignmentId: string, studentId: string): number {
  const s = `${assignmentId}::${studentId}`;
  let h = 0x811C9DC5;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  // Coerce to SIGNED 32-bit so Prisma's Int column accepts it. The
  // original `>>> 0` returned an unsigned 32-bit value up to 4.29e9
  // which overflowed Prisma `Int` (max 2.14e9) ~half the time and
  // surfaced as 500 from generateForClass. The PRNG (mulberry32)
  // immediately re-uses `seed >>> 0` internally, so the bit pattern
  // is identical to the previous behaviour — only the SQL persistence
  // path differs.
  return h | 0;
}
