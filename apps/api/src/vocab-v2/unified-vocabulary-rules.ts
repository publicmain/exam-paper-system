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

// ─────────────────────────────────────────────────────────────
// 按拼写去重（2026-09-05）
//
// 词的身份原来是「词表名 + 版本 + 拼写」（VocabularyLexeme 的唯一键）：
// 换词表、升版本、或者学生阅读时自己加过的 personal 词，都会生出另一个
// lexeme / sense，于是同一个拼写会被当成「新词」再推一遍。叶老师的要求是
// 一个学生这学期学的词不重复 —— 判「见没见过」只看拼写。
// ─────────────────────────────────────────────────────────────

/** 拼写归一：小写、去首尾空白；比较用，不改数据。 */
export function headwordKey(headword: string): string {
  return String(headword ?? '').trim().toLowerCase();
}

/** 学生名下所有归属行的拼写集合 —— 学过、加过、移出过、会了的全算「见过」。 */
export function seenHeadwordSet(rows: readonly { headword: string }[]): Set<string> {
  return new Set(rows.map((row) => headwordKey(row.headword)).filter(Boolean));
}

/**
 * 顺着词表从 `startRank` 往后走，凑够 `want` 个没见过的词就停。
 *
 * 原来是「读前 100 个再去掉见过的」：学生学到词表后半段、或者阅读时自己
 * 加过很多词之后，100 个里可能剩不下 10 个，那天就少推。现在读到凑够为止，
 * 表尾读完还不够就 `exhausted`，由调用方去下一张表接着凑。
 */
export function collectUnseenFromList<T extends { headword: string; rank: number }>(
  list: readonly T[],
  startRank: number,
  seen: ReadonlySet<string>,
  want: number,
): { picked: T[]; exhausted: boolean } {
  const picked: T[] = [];
  const from = Math.max(1, Math.floor(startRank));
  for (let index = from - 1; index < list.length && picked.length < want; index += 1) {
    const word = list[index];
    if (!word || seen.has(headwordKey(word.headword))) continue;
    picked.push(word);
  }
  return { picked, exhausted: from > list.length || picked.length < want };
}

/**
 * 老师词表落到一个学生头上时：见过的拼写跳过，除非老师给这个词打了
 * `force`（明确要求全班重学）。返回空数组 = 这天老师的词他全学过，
 * 调用方回到档位词表照常推。
 */
export function teacherItemsForStudent<T extends { headword: string; force?: boolean | null }>(
  items: readonly T[],
  seen: ReadonlySet<string>,
): { kept: T[]; skipped: T[] } {
  const kept: T[] = [];
  const skipped: T[] = [];
  for (const item of items) {
    if (item.force || !seen.has(headwordKey(item.headword))) kept.push(item);
    else skipped.push(item);
  }
  return { kept, skipped };
}
