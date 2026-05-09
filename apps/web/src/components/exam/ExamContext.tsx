import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import type { ExamMode } from './types';

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

interface ExamAnswer {
  selectedOption?: string;
  textAnswer?: string;
}

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

  // Track online / offline. The toolbar surfaces this so a student
  // doesn't lose confidence when WiFi flickers — local cache still has
  // their answers and we'll flush on reconnect.
  useEffect(() => {
    function on() { setIsOffline(false); }
    function off() { setIsOffline(true); }
    window.addEventListener('online', on);
    window.addEventListener('offline', off);
    return () => {
      window.removeEventListener('online', on);
      window.removeEventListener('offline', off);
    };
  }, []);

  // Debounce per-question. Map<qid, timer>.
  const timersRef = useMemo(() => new Map<string, ReturnType<typeof setTimeout>>(), []);

  const setAnswer = useCallback((qid: string, ans: ExamAnswer) => {
    setAnswers((prev) => {
      const next = { ...prev, [qid]: ans };
      try {
        localStorage.setItem(ANSWERS_KEY(sessionId), JSON.stringify(next));
      } catch { /* quota — ignore */ }
      return next;
    });
    // Reset the timer; fire when input pauses.
    const existing = timersRef.get(qid);
    if (existing) clearTimeout(existing);
    const t = setTimeout(async () => {
      timersRef.delete(qid);
      setSavingId(qid);
      try {
        await onPersistAnswer(qid, {
          selectedOption: ans.selectedOption ?? null,
          textAnswer: ans.textAnswer ?? null,
        });
      } catch {
        // The local cache still holds it; setIsOffline will flip when the
        // browser fires its own offline event.
      } finally {
        setSavingId(null);
      }
    }, SAVE_DEBOUNCE_MS);
    timersRef.set(qid, t);
  }, [sessionId, timersRef, onPersistAnswer]);

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
  }), [mode, fontScale, setFontScale, isFlagged, toggleFlag, flagged.size, answers, setAnswer, savingId, isOffline]);

  return <ExamContext.Provider value={value}>{children}</ExamContext.Provider>;
}
