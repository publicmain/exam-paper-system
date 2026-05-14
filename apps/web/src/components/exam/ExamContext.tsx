import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import type { ExamAnswer, ExamMode } from './types';

/**
 * Top-level context for an in-progress exam attempt.
 *
 * Owns the cross-cutting state every renderer reads:
 *  - mode (practice vs test) — drives feedback intensity
 *  - fontScale — A- / A+ buttons in the toolbar
 *  - flagged-for-review set, persisted per session in localStorage
 *  - answers cache, debounced auto-save to backend, mirrored to localStorage
 *
 * Why one provider instead of N hooks: every shell variant (IELTS / O-Level
 * Comprehension / etc.) needs the same scaffolding. Centralising avoids
 * three almost-identical re-implementations and lets us share the offline
 * recovery logic.
 */

// ExamAnswer now comes from ./types so the shape stays single-sourced
// (round-3 H1 — eliminates the schema-drift risk of two parallel decls).
interface ExamContextValue {
  mode: ExamMode;
  fontScale: number;          // 0.85 .. 1.4, default 1.0
  setFontScale: (n: number) => void;

  // Flag for review — students mark questions to revisit.
  isFlagged: (qid: string) => boolean;
  toggleFlag: (qid: string) => void;
  flaggedCount: number;

  // Answer cache. Local state first, then debounced server save.
  answers: Record<string, ExamAnswer>;
  setAnswer: (qid: string, ans: ExamAnswer) => void;

  // Save / submit hooks supplied by the host page.
  savingId: string | null;

  /** Round-3 H6 — Flush every pending debounce timer + replay every dirty
   *  answer that hasn't yet round-tripped to the server. Returns a promise
   *  that resolves when ALL pending saves have settled (success or
   *  failure). Call this before final-submit so a 600 ms unflushed write
   *  doesn't get silently dropped under the `submission_locked` race. */
  flushPendingSaves: () => Promise<void>;

  /** Round-3 H22 — Last save error surface. Cleared when a subsequent
   *  save succeeds. Host pages should render this to the student so they
   *  know their answer didn't reach the server (vs the legacy silent
   *  `// ignore` that hid every failure). */
  saveError: string | null;
  /** True iff at least one answer hasn't been confirmed by the server. */
  hasPendingSaves: boolean;

  // Connectivity surface.
  isOffline: boolean;

  /** R15-followup-11 — true when another tab on this device claimed
   *  ownership of this sessionId first. Autosave is blocked while in
   *  secondary mode; host pages should render a banner asking the
   *  student to close this tab and use the other one. */
  isSecondaryTab: boolean;

  /** R15-followup-12 — explicit takeover. The 10-second stale window
   *  doesn't expire while a phantom tab in another Chrome window is
   *  still heartbeating (e.g. forgotten background tab on a shared
   *  iPad). The banner exposes this as a button so the student can
   *  forcefully claim ownership and unblock autosave on the tab they
   *  ACTUALLY want to use. */
  claimTabOwnership: () => void;
}

const ExamContext = createContext<ExamContextValue | null>(null);

export function useExam(): ExamContextValue {
  const v = useContext(ExamContext);
  if (!v) throw new Error('useExam must be used inside <ExamProvider>');
  return v;
}

interface ProviderProps {
  sessionId: string;
  mode: ExamMode;
  /** Server-side save fn — debounced inside the provider so callers can
   *  fire setAnswer on every keystroke without spamming the API. */
  onPersistAnswer: (
    qid: string,
    ans: { selectedOption?: string | null; textAnswer?: string | null },
  ) => Promise<void>;
  initialAnswers?: Record<string, ExamAnswer>;
  /** R15-followup-12 — used to scope the localStorage answer/flag caches
   *  per student so a shared device (e.g. school iPad two students take
   *  turns on) doesn't show student A's draft to student B when B scans
   *  the same session. When unset (e.g. practice mode where sessionId
   *  is already the practiceSubmissionId), caches stay sessionId-only. */
  submissionId?: string | null;
  children: React.ReactNode;
}

// R15-followup-12 — bucket the answer/flag caches by (sessionId, submissionId)
// so two students who scan into the same session on the same device don't
// see each other's drafts. Practice mode passes no submissionId — its
// `sessionId` is already the practiceSubmissionId, so suffixing isn't needed.
const ANSWERS_KEY = (sid: string, submissionId?: string | null) =>
  submissionId ? `mq:answers:${sid}:${submissionId}` : `mq:answers:${sid}`;
const FLAGS_KEY = (sid: string, submissionId?: string | null) =>
  submissionId ? `mq:flags:${sid}:${submissionId}` : `mq:flags:${sid}`;
// Legacy (pre-R15-followup-12) keys — written by older builds. We strip
// these on mount so a stale draft from a previous student never bleeds
// into the next student's take page.
const LEGACY_ANSWERS_KEY = (sid: string) => `mq:answers:${sid}`;
const LEGACY_FLAGS_KEY = (sid: string) => `mq:flags:${sid}`;
const FONT_KEY = 'mq:fontScale';
const SAVE_DEBOUNCE_MS = 600;

export function ExamProvider({
  sessionId,
  mode,
  onPersistAnswer,
  initialAnswers,
  submissionId,
  children,
}: ProviderProps) {
  // R15-followup-12 — purge any cache rows for this session that belong
  // to a DIFFERENT submission (different student previously took the quiz
  // on this device). Runs synchronously before we hydrate so the next
  // state read can't see a stale draft. The current-submission key is
  // preserved so a page reload mid-quiz still recovers in-progress
  // answers. Only runs when submissionId is set — in practice mode the
  // caller passes the practiceSubmissionId as `sessionId` and skips this
  // prop, so the cache is already per-submission by another name.
  if (typeof window !== 'undefined' && submissionId) {
    try {
      const myAns = ANSWERS_KEY(sessionId, submissionId);
      const myFlags = FLAGS_KEY(sessionId, submissionId);
      const ansPrefix = `mq:answers:${sessionId}`;
      const flagsPrefix = `mq:flags:${sessionId}`;
      for (const k of Object.keys(localStorage)) {
        if (k === myAns || k === myFlags) continue;
        if (k === ansPrefix || k.startsWith(ansPrefix + ':')) localStorage.removeItem(k);
        else if (k === flagsPrefix || k.startsWith(flagsPrefix + ':')) localStorage.removeItem(k);
      }
      // Belt-and-braces: drop the legacy unscoped keys too. Anything
      // under those names belongs to a previous student's draft (the
      // current student gets the scoped key) so it must not survive
      // the device handoff.
      localStorage.removeItem(LEGACY_ANSWERS_KEY(sessionId));
      localStorage.removeItem(LEGACY_FLAGS_KEY(sessionId));
    } catch { /* quota / private-mode — ignore, fall through to normal load */ }
  }

  // Hydrate from localStorage so a refresh mid-quiz doesn't erase work.
  // Server-side answers (initialAnswers) win when there's a conflict —
  // they survived even without local cache (e.g. switched device).
  const [answers, setAnswers] = useState<Record<string, ExamAnswer>>(() => {
    let cached: Record<string, ExamAnswer> = {};
    try {
      const raw = localStorage.getItem(ANSWERS_KEY(sessionId, submissionId));
      if (raw) cached = JSON.parse(raw);
    } catch { /* ignore */ }
    return { ...cached, ...(initialAnswers ?? {}) };
  });

  const [savingId, setSavingId] = useState<string | null>(null);
  const [isOffline, setIsOffline] = useState<boolean>(
    typeof navigator !== 'undefined' && !navigator.onLine,
  );

  const [flagged, setFlagged] = useState<Set<string>>(() => {
    try {
      const raw = localStorage.getItem(FLAGS_KEY(sessionId, submissionId));
      return raw ? new Set(JSON.parse(raw) as string[]) : new Set();
    } catch {
      return new Set();
    }
  });

  const [fontScale, setFontScaleRaw] = useState<number>(() => {
    try {
      const raw = localStorage.getItem(FONT_KEY);
      const n = raw ? Number(raw) : 1;
      if (Number.isFinite(n) && n >= 0.7 && n <= 1.6) return n;
    } catch { /* ignore */ }
    return 1;
  });

  const setFontScale = useCallback((n: number) => {
    const clamped = Math.max(0.7, Math.min(1.6, n));
    setFontScaleRaw(clamped);
    try { localStorage.setItem(FONT_KEY, String(clamped)); } catch { /* ignore */ }
  }, []);

  // Round-3 H22 — surface save errors (used by SaveErrorBadge / the
  // OfflineBadge twin). Reset to null on the next successful save.
  const [saveError, setSaveError] = useState<string | null>(null);

  // R15-followup-11 — multi-tab guard. iPad users have a habit of long-
  // tapping a link and "open in new tab", or the QR scan can fire a
  // window.location.replace that leaves the old tab around. If both tabs
  // are live, they BOTH autosave, and the empty-state tab clobbers the
  // populated one's answers seconds before submit.
  //
  // Strategy:
  //   1. Mint a tab UUID on mount, write { tabId, ts } to localStorage
  //      under `mq:tab-owner:<sessionId>`.
  //   2. Heartbeat every 2s — refresh `ts` so a stale claim from a
  //      crashed tab expires after ~10s and the next tab can take over.
  //   3. Listen for `storage` events. If the owner key changes to a
  //      different tabId, this tab becomes "secondary" → autosave is
  //      blocked and a banner is shown.
  //
  // setAnswer below checks `isSecondaryTab` and refuses to persist
  // (the localStorage cache still updates so the student doesn't lose
  // their work visually, they're just told to switch back to the
  // primary tab). The primary tab keeps autosaving normally.
  const tabIdRef = useRef<string>(
    typeof crypto !== 'undefined' && typeof (crypto as any).randomUUID === 'function'
      ? (crypto as any).randomUUID()
      : `tab-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`,
  );
  const TAB_OWNER_KEY = `mq:tab-owner:${sessionId}`;
  const TAB_HEARTBEAT_MS = 2_000;
  const TAB_STALE_MS = 10_000;
  const [isSecondaryTab, setIsSecondaryTab] = useState<boolean>(false);

  // R15-followup-12 — explicit ownership claim. Used by the multi-tab
  // banner when a phantom tab in another Chrome window keeps heartbeating
  // past the 10s stale window. Forces ownership transfer to THIS tab,
  // flips isSecondaryTab → false immediately so autosave resumes; the
  // other tab will flip to secondary on its next storage event.
  const claimTabOwnership = useCallback(() => {
    if (typeof window === 'undefined') return;
    try {
      localStorage.setItem(
        TAB_OWNER_KEY,
        JSON.stringify({ tabId: tabIdRef.current, ts: Date.now() }),
      );
    } catch { /* quota — ignore */ }
    setIsSecondaryTab(false);
  }, [TAB_OWNER_KEY]);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const myTabId = tabIdRef.current;
    // On mount, decide who's the owner.
    const readCurrent = (): { tabId: string; ts: number } | null => {
      try {
        const raw = localStorage.getItem(TAB_OWNER_KEY);
        if (!raw) return null;
        const parsed = JSON.parse(raw) as { tabId?: string; ts?: number };
        if (typeof parsed?.tabId === 'string' && typeof parsed?.ts === 'number') {
          return { tabId: parsed.tabId, ts: parsed.ts };
        }
      } catch { /* ignore */ }
      return null;
    };
    const writeOwner = (tabId: string) => {
      try {
        localStorage.setItem(TAB_OWNER_KEY, JSON.stringify({ tabId, ts: Date.now() }));
      } catch { /* quota — ignore, fall back to autosave-as-primary */ }
    };
    // Claim if empty / stale.
    const cur = readCurrent();
    if (!cur || Date.now() - cur.ts > TAB_STALE_MS) {
      writeOwner(myTabId);
      setIsSecondaryTab(false);
    } else if (cur.tabId !== myTabId) {
      // Someone else holds the claim and it's fresh.
      setIsSecondaryTab(true);
    } else {
      setIsSecondaryTab(false);
    }
    // Heartbeat — only if we believe we're the primary tab.
    const heartbeat = setInterval(() => {
      const c = readCurrent();
      if (!c || Date.now() - c.ts > TAB_STALE_MS) {
        // Stale or missing → grab it.
        writeOwner(myTabId);
        setIsSecondaryTab(false);
      } else if (c.tabId === myTabId) {
        // Refresh our own claim.
        writeOwner(myTabId);
      } else {
        // Someone else owns it.
        setIsSecondaryTab(true);
      }
    }, TAB_HEARTBEAT_MS);
    // Cross-tab storage events for instant flip.
    const onStorage = (e: StorageEvent) => {
      if (e.key !== TAB_OWNER_KEY) return;
      const c = readCurrent();
      setIsSecondaryTab(!!c && c.tabId !== myTabId);
    };
    window.addEventListener('storage', onStorage);
    // Release the claim on unmount IF we still hold it (best-effort —
    // a crash skips this and the next tab waits TAB_STALE_MS).
    return () => {
      clearInterval(heartbeat);
      window.removeEventListener('storage', onStorage);
      const c = readCurrent();
      if (c && c.tabId === myTabId) {
        try { localStorage.removeItem(TAB_OWNER_KEY); } catch { /* ignore */ }
      }
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sessionId]);

  // Round-3 H3 — timers + dirty set live in refs (NOT useMemo([])): a
  // future re-run of the callback dependency array would otherwise drop
  // the in-flight Map and lose every queued save.
  const timersRef = useRef<Map<string, ReturnType<typeof setTimeout>>>(new Map());
  // Round-3 H5 — questions whose latest write hasn't been confirmed by the
  // server yet. We replay this on reconnect AND on flushPendingSaves().
  const dirtyRef = useRef<Set<string>>(new Set());
  // Latest answer values keyed by qid — used by replay after a delay or
  // a reconnect, since the closure-captured `ans` in the timer may be
  // stale by the time we actually fire (especially on submit-flush).
  const latestAnswerRef = useRef<Record<string, ExamAnswer>>({});

  // Track online / offline. The toolbar surfaces this so a student
  // doesn't lose confidence when WiFi flickers — local cache still has
  // their answers and we'll flush on reconnect.
  useEffect(() => {
    function on() {
      setIsOffline(false);
      // Round-3 H5 — reconnect replay. Fire-and-forget; failures will be
      // surfaced via saveError + the dirty answer stays dirty for the
      // next attempt.
      if (dirtyRef.current.size > 0) {
        flushPendingSavesRef.current?.().catch(() => { /* surfaced via saveError */ });
      }
    }
    function off() { setIsOffline(true); }
    window.addEventListener('online', on);
    window.addEventListener('offline', off);
    return () => {
      window.removeEventListener('online', on);
      window.removeEventListener('offline', off);
    };
  }, []);

  // Round-7: navigator.onLine returns true on captive-portal WiFi (the
  // device IS connected to a network — just not the internet) and stays
  // true if the API itself is down. Both produce the same UX failure:
  // the student doesn't know their answers aren't reaching the server.
  // Heartbeat every 60s to /api/health; flip isOffline=true after two
  // consecutive failures and back to false on the next success.
  useEffect(() => {
    let cancelled = false;
    let consecutiveFailures = 0;
    async function probe() {
      if (cancelled) return;
      try {
        const ctl = new AbortController();
        const t = setTimeout(() => ctl.abort(), 5000);
        const res = await fetch('/api/health', {
          method: 'GET',
          cache: 'no-store',
          signal: ctl.signal,
        });
        clearTimeout(t);
        if (cancelled) return;
        if (res.ok) {
          consecutiveFailures = 0;
          // Heartbeat success — only flip to online if navigator agrees
          // (avoids fighting the OS-level event when the laptop suspends).
          if (typeof navigator !== 'undefined' && navigator.onLine) {
            setIsOffline(false);
          }
        } else {
          consecutiveFailures += 1;
          if (consecutiveFailures >= 2) setIsOffline(true);
        }
      } catch {
        if (cancelled) return;
        consecutiveFailures += 1;
        if (consecutiveFailures >= 2) setIsOffline(true);
      }
    }
    // First probe runs after 30s so we don't add an extra request to the
    // initial paint; thereafter every 60s.
    const initial = setTimeout(probe, 30_000);
    const interval = setInterval(probe, 60_000);
    return () => {
      cancelled = true;
      clearTimeout(initial);
      clearInterval(interval);
    };
  }, []);

  /** Persist ONE answer immediately, mark dirty cleared on success.
   *  Errors propagate so flushPendingSaves can collect a final status. */
  const persistOne = useCallback(
    async (qid: string, ans: ExamAnswer) => {
      setSavingId(qid);
      try {
        await onPersistAnswer(qid, {
          selectedOption: ans.selectedOption ?? null,
          textAnswer: ans.textAnswer ?? null,
        });
        dirtyRef.current.delete(qid);
        setSaveError(null);
      } catch (e: any) {
        // dirty stays; will be retried on reconnect or on submit flush
        const msg = e?.message ?? String(e ?? 'save_failed');
        setSaveError(msg);
        throw e;
      } finally {
        setSavingId((cur) => (cur === qid ? null : cur));
      }
    },
    [onPersistAnswer],
  );

  const isSecondaryTabRef = useRef(false);
  isSecondaryTabRef.current = isSecondaryTab;
  const setAnswer = useCallback((qid: string, ans: ExamAnswer) => {
    setAnswers((prev) => {
      const next = { ...prev, [qid]: ans };
      try {
        localStorage.setItem(ANSWERS_KEY(sessionId, submissionId), JSON.stringify(next));
      } catch { /* quota — ignore */ }
      return next;
    });
    latestAnswerRef.current[qid] = ans;
    // R15-followup-11 — secondary tabs must NOT autosave: a second tab
    // sitting on the same session with no answers typed yet would
    // otherwise clobber the primary tab's progress with empty payloads.
    // Local state + localStorage still update so the student can SEE
    // their input, but no server round-trip happens until they close
    // this tab and become primary again.
    if (isSecondaryTabRef.current) return;
    dirtyRef.current.add(qid);
    // Reset the timer; fire when input pauses.
    const existing = timersRef.current.get(qid);
    if (existing) clearTimeout(existing);
    const t = setTimeout(() => {
      timersRef.current.delete(qid);
      // Use the LATEST answer at fire time, not the closure-captured one
      // — critical when the timer races with another setAnswer call.
      const latest = latestAnswerRef.current[qid] ?? ans;
      persistOne(qid, latest).catch(() => { /* dirty stays; saveError set */ });
    }, SAVE_DEBOUNCE_MS);
    timersRef.current.set(qid, t);
  }, [sessionId, submissionId, persistOne]);

  // Round-3 H6 — flush every queued / dirty save right now, return a
  // promise that resolves after each settles. Used by the submit handler
  // so a 600 ms-debounce write doesn't drop on the floor under the
  // `submission_locked` race.
  const flushPendingSaves = useCallback(async () => {
    // 1. Cancel debounce timers — anything waiting will be flushed now.
    for (const [qid, timer] of timersRef.current.entries()) {
      clearTimeout(timer);
      timersRef.current.delete(qid);
    }
    // 2. Persist every dirty answer's latest value, in parallel.
    const todo = Array.from(dirtyRef.current);
    if (todo.length === 0) return;
    await Promise.allSettled(
      todo.map((qid) => {
        const ans = latestAnswerRef.current[qid];
        if (!ans) return Promise.resolve();
        return persistOne(qid, ans);
      }),
    );
  }, [persistOne]);

  const flushPendingSavesRef = useRef<typeof flushPendingSaves | null>(null);
  flushPendingSavesRef.current = flushPendingSaves;

  // Cleanup: clearTimeout every still-pending timer when the provider
  // unmounts so a stale fire doesn't run after navigation.
  useEffect(() => {
    return () => {
      for (const t of timersRef.current.values()) clearTimeout(t);
      timersRef.current.clear();
    };
  }, []);

  const toggleFlag = useCallback((qid: string) => {
    setFlagged((prev) => {
      const next = new Set(prev);
      if (next.has(qid)) next.delete(qid);
      else next.add(qid);
      try {
        localStorage.setItem(FLAGS_KEY(sessionId, submissionId), JSON.stringify([...next]));
      } catch { /* ignore */ }
      return next;
    });
  }, [sessionId, submissionId]);

  const isFlagged = useCallback((qid: string) => flagged.has(qid), [flagged]);

  const hasPendingSaves = !!savingId || timersRef.current.size > 0 || dirtyRef.current.size > 0;

  const value = useMemo<ExamContextValue>(() => ({
    mode,
    fontScale,
    setFontScale,
    isFlagged,
    toggleFlag,
    flaggedCount: flagged.size,
    answers,
    setAnswer,
    savingId,
    isOffline,
    flushPendingSaves,
    saveError,
    hasPendingSaves,
    isSecondaryTab,
    claimTabOwnership,
  }), [mode, fontScale, setFontScale, isFlagged, toggleFlag, flagged.size, answers, setAnswer, savingId, isOffline, flushPendingSaves, saveError, hasPendingSaves, isSecondaryTab, claimTabOwnership]);

  return <ExamContext.Provider value={value}>{children}</ExamContext.Provider>;
}
