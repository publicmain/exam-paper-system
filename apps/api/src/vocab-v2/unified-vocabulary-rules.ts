/** Business rules shared by the unified notebook, daily learning and tests. */

export type DailyItemState = { status: string; senseId: string };

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
export function pendingDailySessions<T extends { sessionKey: string }>(
  completedDailySessions: readonly T[],
  formalStatusByKey: ReadonlyMap<string, string>,
): T[] {
  return completedDailySessions.filter(
    (session) => formalStatusByKey.get(`${session.sessionKey}:formal`) !== 'submitted',
  );
}
