import { api, type AchievementBadge, type AchievementsList } from './api';
import { readToken } from './identity';

export interface AchievementNotice { badge: AchievementBadge; kind: 'award' | 'backfill'; claimed: boolean }
let ownerToken: string | null = null;
let generation = 0;
let pending: Promise<void> | null = null;
let claiming: Promise<boolean> | null = null;
let retryRequested = false;
let queue: readonly AchievementNotice[] = [];
const consumed = new Set<string>();
const listeners = new Set<() => void>();
const collectionListeners = new Set<(token: string, list: AchievementsList) => void>();
const emit = () => listeners.forEach((listener) => listener());
export const subscribeAchievementNotices = (listener: () => void) => { listeners.add(listener); return () => { listeners.delete(listener); }; };
export const getAchievementNotices = () => queue;
/** Saved collection snapshots are separate from the ephemeral ceremony queue. */
export const subscribeAchievementCollection = (listener: (token: string, list: AchievementsList) => void) => {
  collectionListeners.add(listener);
  return () => { collectionListeners.delete(listener); };
};

/** No awards or tokens in localStorage. Server claim/viewed state survives devices and logout. */
export function resetAchievementNotices(token: string | null = readToken()) {
  if (ownerToken === token) return;
  ownerToken = token; generation++; pending = null; claiming = null; retryRequested = false; queue = []; consumed.clear(); emit();
}
export function dismissAchievementNotices(keys: string[] = queue.map((notice) => notice.badge.key)) {
  const remove = new Set(keys); keys.forEach((key) => consumed.add(key));
  const next = queue.filter((notice) => !remove.has(notice.badge.key));
  if (next.length === queue.length) return;
  queue = next; emit();
}
export const dismissAchievementNotice = (key: string) => dismissAchievementNotices([key]);

/** Claim the complete safe-page batch BEFORE any visual is mounted. Another tab may win. */
export function claimAchievementNotices(): Promise<boolean> {
  const token = readToken(); resetAchievementNotices(token);
  if (!token) return Promise.resolve(false);
  if (claiming) return claiming;
  const keys = queue.filter((notice) => !notice.claimed).map((notice) => notice.badge.key);
  if (!keys.length) return Promise.resolve(queue.some((notice) => notice.claimed));
  const mine = generation;
  const current = () => mine === generation && token === ownerToken && token === readToken();
  const work = (async () => {
    try {
      const result = await api.achievementNoticesClaim(token, keys);
      if (!current() || !Array.isArray(result?.claimedKeys)) return false;
      const claimed = new Set(result.claimedKeys), requested = new Set(keys);
      queue = queue.flatMap((notice) => {
        if (!requested.has(notice.badge.key)) return [notice];
        if (!claimed.has(notice.badge.key)) { consumed.add(notice.badge.key); return []; }
        return [{ ...notice, claimed: true }];
      });
      emit(); return queue.some((notice) => notice.claimed);
    } catch { return false; }
  })();
  claiming = work;
  void work.finally(() => { if (current()) claiming = null; });
  return work;
}

/** Viewing is separate from claiming: skip/interrupt must preserve the New marker. */
export async function markAchievementViewed(keys: string[]): Promise<boolean> {
  const token = readToken(); if (!token || !keys.length) return false;
  const mine = generation;
  try {
    await api.achievementNoticesViewed(token, keys);
    return mine === generation && readToken() === token;
  } catch { return false; }
}

/** Refresh from authoritative saved rows. Every level remains an independent collection item. */
export function syncAchievementNotices(): Promise<void> {
  const token = readToken(); resetAchievementNotices(token);
  if (!token) return Promise.resolve();
  if (pending) { retryRequested = true; return pending; }
  const mine = generation;
  const current = () => mine === generation && ownerToken === token && readToken() === token;
  const work = (async () => {
    try {
      await api.achievementsSync(token);
      if (!current()) return;
      const savedCollection = api.achievements(token).then((list) => {
        if (current() && list?.rulesVersion === 5 && Array.isArray(list.badges)) {
          // Hidden eligibility is deliberately absent from `unsaved`. Publish
          // the actual saved result even when the optional notice request fails.
          // Consumers never need to initiate another sync (or another GET).
          collectionListeners.forEach((listener) => listener(token, list));
        }
        return list;
      });
      // Keep this sync pending until its collection read settles, even when the
      // notice endpoint fails first. Otherwise a retry could overtake this read
      // and its late snapshot could replace a newer successful sync.
      const [list, notices] = await Promise.all([savedCollection, api.achievementNotices(token).catch(() => null)]);
      if (!current() || list?.rulesVersion !== 5 || !Array.isArray(list.badges) || !Array.isArray(notices?.ceremonyKeys) || !Array.isArray(notices?.backfillKeys)) return;
      const rows = new Map(list.badges.filter((badge) => badge.key.startsWith('v5_') && badge.earned && badge.saved && !badge.revoked && badge.assetId).map((badge) => [badge.key, badge]));
      const known = new Set([...consumed, ...queue.map((notice) => notice.badge.key)]);
      const additions: AchievementNotice[] = [];
      for (const [kind, keys] of [['backfill', notices.backfillKeys], ['award', notices.ceremonyKeys]] as const) {
        for (const key of keys) {
          const badge = rows.get(key);
          if (known.has(key) || !badge) continue;
          known.add(key); additions.push({ badge, kind, claimed: false });
        }
      }
      const order = new Map(list.badges.map((badge, index) => [badge.key, index]));
      additions.sort((a, b) => a.kind === b.kind ? (order.get(a.badge.key) ?? 0) - (order.get(b.badge.key) ?? 0) : a.kind === 'backfill' ? -1 : 1);
      queue = [...queue.filter((notice) => rows.has(notice.badge.key)), ...additions]; emit();
    } catch { /* Optional feature: outage never blocks learning, login, or navigation. */ }
  })();
  pending = work;
  void work.finally(() => {
    if (!current()) return;
    pending = null;
    if (retryRequested) { retryRequested = false; void syncAchievementNotices(); }
  });
  return work;
}

export function __resetAchievementNoticesForTest() { ownerToken = null; generation++; pending = null; claiming = null; retryRequested = false; queue = []; consumed.clear(); emit(); }
