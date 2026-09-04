/** Business rules shared by the unified notebook, daily learning and tests. */

export type DailyItemState = { status: string };

/** A formal daily test contains exactly words the student explicitly finished. */
export function testableDailyItems<T extends DailyItemState>(items: readonly T[]): T[] {
  return items.filter((item) => item.status === 'completed');
}

/** A "new" push may never recycle a sense the student has encountered before. */
export function unseenCandidates<T extends { senseId: string }>(
  candidates: readonly T[],
  previouslySeenSenseIds: ReadonlySet<string>,
): T[] {
  return candidates.filter((candidate) => !previouslySeenSenseIds.has(candidate.senseId));
}

/** Merely looking up, receiving or removing a word is not the same as learning it. */
export function countActuallyLearned(rows: readonly { reps: number }[]): number {
  return rows.filter((row) => row.reps > 0).length;
}

/** Submitted tests disappear; every older unfinished date remains independently pending. */
export function pendingDailySessions<T extends { sessionKey: string; items?: readonly DailyItemState[] }>(
  completedDailySessions: readonly T[],
  formalStatusByKey: ReadonlyMap<string, string>,
): T[] {
  return completedDailySessions.filter((session) => {
    // A day on which the student finished no word has nothing to test.  Listing
    // it produced a "0 个词" todo whose button could only fail.
    if (session.items && testableDailyItems(session.items).length === 0) return false;
    return formalStatusByKey.get(`${session.sessionKey}:formal`) !== 'submitted';
  });
}

/** `YYYY-MM-DD` of `now` in Singapore time (the product's only calendar). */
export function sgtDateKey(now: Date): string {
  return new Date(now.getTime() + 8 * 60 * 60 * 1000).toISOString().slice(0, 10);
}

/**
 * Daily word tasks exist on school days only (Monday–Friday, Singapore time).
 *
 * The provisioning cron runs every ten minutes all week; without this rule it
 * created a Saturday and a Sunday task for every active student, and on Monday
 * the home page listed both as unfinished backlog for days school was closed.
 */
export function isTeachingDay(dateKey: string): boolean {
  const [y, m, d] = dateKey.split('-').map(Number);
  const weekday = new Date(Date.UTC(y, m - 1, d)).getUTCDay();
  return weekday >= 1 && weekday <= 5;
}

/**
 * Senses the student explicitly deferred ("稍后再学") and never finished.
 *
 * A skipped card leaves the item `skipped` and the session completes without
 * it.  Nothing else ever re-queued those senses, and the ownership row created
 * by the push kept them out of every later daily task — so "later" silently
 * meant "never".  They come back to the front of the next daily task instead.
 *
 * Excluded: senses later completed in any session (learned), and senses whose
 * ownership row says the student removed or already knows them.
 */
export function deferredSenseIds(
  items: readonly { senseId: string; status: string }[],
): string[] {
  const completed = new Set(items.filter((item) => item.status === 'completed').map((item) => item.senseId));
  const deferred = new Set<string>();
  for (const item of items) {
    if (item.status === 'skipped' && !completed.has(item.senseId)) deferred.add(item.senseId);
  }
  return [...deferred];
}
