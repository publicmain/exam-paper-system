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
  children: React.ReactNode;
}

const ANSWERS_KEY = (sid: string) => `mq:answers:${sid}`;
const FLAGS_KEY = (sid: string) => `mq:flags:${sid}`;
const FONT_KEY = 'mq:fontScale';
const SAVE_DEBOUNCE_MS = 600;

export function ExamProvider({
  sessionId,
  mode,
  onPersistAnswer,
  initialAnswers,
  children,
}: ProviderProps) {
  // Hydrate from localStorage so a refresh mid-quiz doesn't erase work.
  // Server-side answers (initialAnswers) win when there's a conflict —
  // they survived even without local cache (e.g. switched device).
  const [answers, setAnswers] = useState<Record<string, ExamAnswer>>(() => {
    let cached: Record<string, ExamAnswer> = {};
    try {
      const raw = localStorage.getItem(ANSWERS_KEY(sessionId));
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
      const raw = localStorage.getItem(FLAGS_KEY(sessionId));
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

  const setAnswer = useCallback((qid: string, ans: ExamAnswer) => {
    setAnswers((prev) => {
      const next = { ...prev, [qid]: ans };
      try {
        localStorage.setItem(ANSWERS_KEY(sessionId), JSON.stringify(next));
      } catch { /* quota — ignore */ }
      return next;
    });
    latestAnswerRef.current[qid] = ans;
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
  }, [sessionId, persistOne]);

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
        localStorage.setItem(FLAGS_KEY(sessionId), JSON.stringify([...next]));
      } catch { /* ignore */ }
      return next;
    });
  }, [sessionId]);

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
  }), [mode, fontScale, setFontScale, isFlagged, toggleFlag, flagged.size, answers, setAnswer, savingId, isOffline, flushPendingSaves, saveError, hasPendingSaves]);

  return <ExamContext.Provider value={value}>{children}</ExamContext.Provider>;
}
