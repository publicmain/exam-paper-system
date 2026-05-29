import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { api } from '../lib/api';
import { useAuth } from '../lib/auth';
import { ExamProvider, useExam } from '../components/exam/ExamContext';
import { ExamRenderer } from '../components/exam/QuestionTypeRegistry';
import { Timer } from '../components/exam/shared/Timer';
import { FontSizeAdjuster } from '../components/exam/shared/FontSizeAdjuster';
import { QuestionNavBar } from '../components/exam/shared/QuestionNavBar';
import { OfflineBadge } from '../components/exam/shared/OfflineBadge';
import type { ExamPaper, EnglishLevel } from '../components/exam/types';

/**
 * The MorningQuizTake page.
 *
 * Thin host:
 *   - Fetches the session
 *   - Wires the ExamProvider (auto-save, font scale, flags, offline)
 *   - Picks a renderer through the registry
 *   - Owns the chrome (header timer, bottom palette, submit button)
 *
 * Practice vs test mode is read from `?mode=practice|test`. Default is
 * test (the original strict morning-quiz behaviour). Practice mode is
 * mostly used by /practice and student-self-study links.
 */

interface SessionView {
  sessionId: string;
  attendanceId: string;
  submissionId: string | null;
  quizEnd: string;
  level: EnglishLevel;
  paperMode: 'passage_pick' | 'standard' | null;
  /** Authoritative quiz mode from the server. Always 'test' for morning
   *  quizzes — the front-end ignores any `?mode=practice` URL trick.
   *  See round-3 SUMMARY C2. */
  mode?: 'test' | 'practice';
  paperQuestions: Array<{
    id: string;
    sortOrder: number;
    marks: number;
    questionType: 'mcq' | 'short_answer' | 'structured' | 'essay';
    snapshotContent: any;
    snapshotOptions: Array<{ key: string; text: string }> | null;
  }>;
  // F1 — resume-on-different-device. The server-side answer rows are now
  // included in the session GET so a student who switched from phone to
  // laptop mid-quiz (or refreshed and lost their localStorage cache) sees
  // their work waiting. Optional because backend roll-out is staged — old
  // payloads simply omit the field and we fall back to local cache only.
  existingAnswers?: Record<
    string,
    { content?: string; selectedOption?: string; textAnswer?: string; flagged?: boolean }
  >;
}

export default function MorningQuizTake() {
  const { sessionId } = useParams<{ sessionId: string }>();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  // Student's display name — used to redirect them to their portal
  // (/my-history) after submit. Same name string is what they typed on
  // the /scan page, so it round-trips cleanly through the lookup API.
  const studentName = useAuth((s) => s.user?.name) ?? '';
  // The URL hint is still read for backwards compatibility, but the
  // SERVER's `mode` field is authoritative — it's pinned to 'test' for
  // morning quizzes, so a `?mode=practice` URL trick can't unlock answers
  // even if a future bug re-introduces correctness data into the payload.
  // See round-3 SUMMARY C2 for the leak path this closes.
  const urlMode = searchParams.get('mode') === 'practice' ? 'practice' : 'test';

  const [view, setView] = useState<SessionView | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [submitted, setSubmitted] = useState(false);
  // Synchronous in-flight guard — round-7 C-E3. The `submitted` state
  // doesn't flip until React schedules the next render, but the second
  // click of a double-tap can fire its `await flushPendingSaves()` before
  // that render lands. A ref is set the moment we enter handleSubmit, so
  // any concurrent click bails out before reaching submitToServer.
  const submitInflightRef = useRef(false);

  useEffect(() => {
    if (!sessionId) return;
    // Round-7 H21 (agent-5 P1-7): if the student navigates away mid-fetch
    // (toggling visibility on iPad triggers route changes in some shells)
    // the .then setState used to fire on the unmounted component, leaking
    // state and occasionally surfacing a "can't update an unmounted
    // component" warning. The cancelled flag drops the result on unmount.
    let cancelled = false;
    api
      .morningQuizSession(sessionId)
      .then((v: SessionView) => { if (!cancelled) setView(v); })
      .catch((e: any) => { if (!cancelled) setError(e.message ?? String(e)); });
    return () => { cancelled = true; };
  }, [sessionId]);

  // Block accidental "browser back" while mid-quiz. The take-quiz route
  // is the destination of a window.location.replace from the scan page,
  // so the browser's back stack still contains /scan/:token — a single
  // tap on the back button drops the student out of the quiz onto a now-
  // expired QR landing page, losing their unsaved answers.
  //
  // Strategy: push a dummy history entry on mount. On popstate, if the
  // student hasn't submitted yet, push the dummy back so the URL never
  // actually leaves /morning-quiz/:id. Combined with the chrome-hidden
  // layout, the only way out of the take page is the Submit button or
  // closing the tab entirely.
  useEffect(() => {
    if (!sessionId) return;
    window.history.pushState({ mqGuard: true }, '', window.location.href);
    const onPop = (e: PopStateEvent) => {
      if (submitted) return; // submit completed → allow normal nav
      void e;
      // Re-push our guard so the URL doesn't change.
      window.history.pushState({ mqGuard: true }, '', window.location.href);
    };
    window.addEventListener('popstate', onPop);
    return () => window.removeEventListener('popstate', onPop);
  }, [sessionId, submitted]);

  // Also warn on tab close / refresh while mid-quiz. Browsers ignore the
  // returnValue text but still show a generic confirm dialog, which is
  // enough to stop accidental close mid-answer.
  useEffect(() => {
    const handler = (e: BeforeUnloadEvent) => {
      if (submitted) return;
      e.preventDefault();
      e.returnValue = '';
    };
    window.addEventListener('beforeunload', handler);
    return () => window.removeEventListener('beforeunload', handler);
  }, [submitted]);

  const persistAnswer = useCallback(
    async (qid: string, body: { selectedOption?: string | null; textAnswer?: string | null }) => {
      if (!sessionId) return;
      await api.morningQuizSaveAnswer(sessionId, { paperQuestionId: qid, ...body });
    },
    [sessionId],
  );

  // Submit handler also needs to flush in-flight autosaves first (round-3
  // H6) — the actual flush call lives inside PaperHost where useExam is
  // accessible. We pass this raw submit hook down; PaperHost wraps it.
  const submitToServer = useCallback(async () => {
    if (!sessionId) return;
    await api.morningQuizSubmit(sessionId);
    try {
      localStorage.removeItem(`mq:answers:${sessionId}`);
    } catch { /* ignore */ }
    // After submit, drop the student onto their portal (attendance +
    // history in one view). This replaces the older /student/result/:id
    // dead-end page — students kept asking "how do I check yesterday's
    // score?" because /student/result is bound to a single session +
    // requires login. /my-history is the single durable entry point.
    if (studentName) {
      navigate(`/my-history?name=${encodeURIComponent(studentName)}`, { replace: true });
    } else {
      // Fallback for edge cases where useAuth.user is somehow empty —
      // the portal page also reads localStorage 'mq:history:name', so
      // the student can still see their history if they typed it once.
      navigate('/my-history', { replace: true });
    }
  }, [sessionId, navigate, studentName]);

  async function handleSubmit() {
    // Compatibility shim — the real flush + submit happens inside
    // PaperHost via SubmitButton. Kept here so the existing Timer's
    // `onTimeUp={onSubmit}` path still works for time-up auto-submit.
    if (!sessionId || submitted) return;
    if (submitInflightRef.current) return;
    submitInflightRef.current = true;
    setSubmitted(true);
    try {
      await submitToServer();
    } catch (e: any) {
      setError(e.message ?? String(e));
      setSubmitted(false);
      submitInflightRef.current = false;
    }
  }

  if (error) {
    return (
      <div className="max-w-2xl mx-auto p-6 text-center">
        <div className="text-rose-600 text-lg mb-4">⚠️ {error}</div>
        <button className="text-sm text-blue-600 underline" onClick={() => navigate('/student')}>
          返回首页
        </button>
      </div>
    );
  }
  if (!view) return <div className="p-6 text-gray-500">Loading…</div>;

  // Server is the source of truth for mode. Falls back to URL only if the
  // server payload is from an older API that doesn't yet send `mode` (this
  // shouldn't happen with the same deploy, but stays graceful).
  const mode: 'practice' | 'test' = view.mode ?? urlMode;

  // F1 — normalise backend's `existingAnswers` (keyed by paperQuestionId,
  // value carries `content` for mcq/short_answer plus a `flagged` bool)
  // into the {selectedOption, textAnswer} shape ExamProvider expects. The
  // server might send `content` (legacy single-field) or already split
  // {selectedOption, textAnswer}; handle both.
  const initialAnswers: Record<string, { selectedOption?: string; textAnswer?: string }> = {};
  if (view.existingAnswers) {
    for (const [qid, raw] of Object.entries(view.existingAnswers)) {
      if (!raw) continue;
      const qMeta = view.paperQuestions.find((q) => q.id === qid);
      if (raw.selectedOption || raw.textAnswer) {
        initialAnswers[qid] = {
          selectedOption: raw.selectedOption,
          textAnswer: raw.textAnswer,
        };
      } else if (raw.content != null) {
        // Single-field `content` — route by questionType.
        if (qMeta?.questionType === 'mcq') {
          initialAnswers[qid] = { selectedOption: String(raw.content) };
        } else {
          initialAnswers[qid] = { textAnswer: String(raw.content) };
        }
      }
    }
  }

  return (
    <ExamProvider
      sessionId={view.sessionId}
      submissionId={view.submissionId}
      mode={mode}
      onPersistAnswer={persistAnswer}
      initialAnswers={initialAnswers}
    >
      <PaperHost view={view} mode={mode} submitted={submitted} onSubmit={handleSubmit} />
    </ExamProvider>
  );
}

/** Wraps `view → ExamPaper` in a useMemo so the rebuilt paper isn't a
 *  fresh reference on every host re-render. Without it, every `setAnswer`
 *  cascades a Provider re-render that hands every memoised renderer a new
 *  `paper` instance, defeating their useMemo guards (round-3 SUMMARY H14
 *  — flagged as the highest-ROI fix). */
function PaperHost({
  view,
  mode,
  submitted,
  onSubmit,
}: {
  view: SessionView;
  mode: 'practice' | 'test';
  submitted: boolean;
  onSubmit: () => void;
}) {
  const paper: ExamPaper = useMemo(
    () => ({
      sessionId: view.sessionId,
      quizEnd: view.quizEnd,
      level: view.level ?? 'olevel',
      paperMode: view.paperMode ?? null,
      questions: view.paperQuestions.map((pq) => ({
        id: pq.id,
        sortOrder: pq.sortOrder,
        marks: pq.marks,
        questionType: pq.questionType,
        snapshotContent: pq.snapshotContent,
        snapshotOptions: pq.snapshotOptions,
      })),
    }),
    [
      view.sessionId,
      view.quizEnd,
      view.level,
      view.paperMode,
      view.paperQuestions,
    ],
  );
  return (
    <ExamShellChrome paper={paper} mode={mode} submitted={submitted} onSubmit={onSubmit} />
  );
}

/** R15-followup-11 — locked-state detection used by both the banner AND
 *  the confirm-modal auto-close path. Matches every server-side "this
 *  attempt is over" error code:
 *    - submission_locked (post-finalSubmit re-entry)
 *    - already submitted
 *    - session_ended / session_not_active (timer ran out while iPad slept)
 *    - quiz_ended / window_closed (admin manually closed the window)
 *    - attendance_window_closed (re-scan after 9:00)
 *  The previous regex only caught the first two, so a student whose iPad
 *  slept past quizEnd got a raw JSON dump and no auto-bounce. */
const LOCKED_ERROR_RE =
  /submission_locked|already submitted|session_ended|session_not_active|quiz_ended|window_closed|attendance_window_closed/i;

function isLockedError(saveError: string | null): boolean {
  return !!saveError && LOCKED_ERROR_RE.test(saveError);
}

/** R15-followup-9 — autosave error banner with submission_locked handling.
 *  R15-followup-11 — extended to cover session_ended et al.; banner now
 *  shows a 5-second countdown so students can read the explanation, and
 *  uses an aria-live region for assistive-tech audibility. */
function SaveErrorBanner({
  saveError,
  hasPendingSaves,
}: {
  saveError: string | null;
  hasPendingSaves: boolean;
}) {
  const navigate = useNavigate();
  const isLocked = isLockedError(saveError);
  const [countdown, setCountdown] = useState(5);
  const studentName = useAuth((s) => s.user?.name) ?? '';
  useEffect(() => {
    if (!isLocked) return;
    setCountdown(5);
    const tick = setInterval(() => {
      setCountdown((c) => (c > 0 ? c - 1 : 0));
    }, 1000);
    const t = setTimeout(() => {
      const target = studentName
        ? `/my-history?name=${encodeURIComponent(studentName)}`
        : '/my-history';
      navigate(target, { replace: true });
    }, 5000);
    return () => {
      clearTimeout(t);
      clearInterval(tick);
    };
  }, [isLocked, navigate, studentName]);

  if (!saveError) return null;
  if (isLocked) {
    return (
      <div
        role="alert"
        aria-live="assertive"
        className="bg-amber-50 border-b-2 border-amber-300 text-amber-900 text-sm px-4 py-3 text-center font-medium"
      >
        ⚠️ 这次早测已经结束或你已提交过 · 正在跳转到我的记录 ({countdown}s)…
      </div>
    );
  }
  return (
    <div
      role="alert"
      className="bg-rose-50 border-b border-rose-200 text-rose-800 text-sm px-4 py-2 text-center"
    >
      ⚠️ 保存失败 / Save failed: {saveError}.{' '}
      {hasPendingSaves ? '系统将自动重试 / will retry on reconnect.' : ''}
    </div>
  );
}

/** The chrome (header, footer, palette overlay) lives inside the provider
 *  so it can read flagged + answered counts via useExam. Splitting this
 *  out from the page-level orchestrator keeps the data-fetching code
 *  separate from the layout shell. */
function ExamShellChrome({
  paper,
  mode,
  submitted,
  onSubmit,
}: {
  paper: ExamPaper;
  mode: 'practice' | 'test';
  submitted: boolean;
  onSubmit: () => void;
}) {
  const [paletteOpen, setPaletteOpen] = useState(false);
  const { answers, flaggedCount, isFlagged, flushPendingSaves, saveError, hasPendingSaves, isSecondaryTab, claimTabOwnership } = useExam();

  // R10 — explicit confirm dialog before submit. Round-3 H6 still applies:
  // every confirmed-submit path flushes autosaves first so the last 600ms
  // of input never gets dropped on the server-side `submission_locked`
  // race. Time-up auto-submit bypasses the confirm (the student is out
  // of time and we don't want a modal blocking the lock).
  const [confirmOpen, setConfirmOpen] = useState(false);
  // R15-followup-11 — close the confirm modal AND disable Submit the
  // moment a locked-state error surfaces. Before: SaveErrorBanner showed
  // at top + confirm modal stayed open in middle, student tapped 确定 →
  // a second locked POST → banner blinked again. Modal stole attention
  // and students missed the 3-second auto-bounce countdown.
  const locked = isLockedError(saveError);
  useEffect(() => {
    if (locked) setConfirmOpen(false);
  }, [locked]);
  const doSubmit = useCallback(async () => {
    // R15-followup-11 — three-step submit insurance:
    //   1. Blur the active element. On iOS the soft keyboard's enter-
    //      blur path is what fires the last React state update for a
    //      mid-typed textarea. Without this, a student who taps Submit
    //      while the cursor is in the textarea has the latest keystroke
    //      sitting in the DOM but not in React state, so the next
    //      flushPendingSaves writes the stale value.
    //   2. await a microtask + a 50ms tick so React has time to commit
    //      the pending setState from step 1.
    //   3. flushPendingSaves — cancel any 600ms debounce timers and
    //      synchronously POST the latest answers.
    //
    // Step 1+2 close the "typed but never blurred → Submit" race
    // that was the most plausible cause of the 0/16 senior_sister
    // submission on 2026-05-13 where every textarea was empty.
    try {
      const ae = (typeof document !== 'undefined' ? document.activeElement : null) as
        | HTMLElement
        | null;
      if (ae && typeof ae.blur === 'function') ae.blur();
      await new Promise((r) => setTimeout(r, 50));
      await flushPendingSaves();
    } catch { /* surfaced via saveError, still proceed */ }
    onSubmit();
  }, [flushPendingSaves, onSubmit]);
  const onSubmitClick = useCallback(() => {
    // R15-followup-11 — don't re-open the modal on a locked attempt;
    // the SaveErrorBanner is already handling that state.
    if (locked) return;
    setConfirmOpen(true);
  }, [locked]);
  const onTimeUpSubmit = doSubmit; // bypass confirm

  // Round-3 H17 — when the iOS soft keyboard pops up, fixed-bottom UI
  // (palette button + Submit) gets covered. visualViewport lets us see
  // how much vertical space remains and offset the footer accordingly.
  // Falls back to safe-area when visualViewport is unsupported.
  const [keyboardOffset, setKeyboardOffset] = useState(0);
  useEffect(() => {
    if (typeof window === 'undefined' || !window.visualViewport) return;
    const vv = window.visualViewport;
    function onChange() {
      // window.innerHeight includes keyboard area; visualViewport.height
      // is just what's visible above the keyboard. Diff = keyboard height.
      const diff = window.innerHeight - vv.height - vv.offsetTop;
      setKeyboardOffset(diff > 50 ? diff : 0);
    }
    vv.addEventListener('resize', onChange);
    vv.addEventListener('scroll', onChange);
    return () => {
      vv.removeEventListener('resize', onChange);
      vv.removeEventListener('scroll', onChange);
    };
  }, []);

  const total = paper.questions.length;
  const answeredCount = useMemo(
    () =>
      paper.questions.filter((q) => {
        const a = answers[q.id];
        return !!(a?.selectedOption || (a?.textAnswer && a.textAnswer.trim()));
      }).length,
    [paper.questions, answers],
  );

  const handleJump = useCallback((qid: string, _idx: number) => {
    // Best-effort scroll. The IELTS shell sets id=q-<id> on each <li>;
    // O-Level shells set the same on the article. Both work here.
    const el = document.getElementById(`q-${qid}`);
    if (el) {
      const top = window.scrollY + el.getBoundingClientRect().top - 80;
      window.scrollTo({ top, behavior: 'smooth' });
      el.classList.add('mq-jump-flash');
      setTimeout(() => el.classList.remove('mq-jump-flash'), 1100);
    }
    setPaletteOpen(false);
  }, []);

  return (
    <div
      className={`min-h-screen pb-24 ${mode === 'practice' ? 'bg-emerald-50/40' : 'bg-gray-50'} mq-shell-root`}
    >
      <style>{`
        /* H19 — '100dvh' is unsupported by iOS Safari < 15.4. Tailwind's
         * min-h-screen already gives us 100vh as a base; we layer 100dvh
         * on top for newer browsers via @supports so the keyboard-aware
         * height is used when available without breaking the older
         * iPads in deployment. */
        .mq-shell-root { min-height: 100vh; }
        @supports (min-height: 100dvh) {
          .mq-shell-root { min-height: 100dvh; }
        }
        @keyframes mq-flash {
          0% { background-color: rgb(254 240 138 / 0.7); }
          100% { background-color: transparent; }
        }
        .mq-jump-flash { animation: mq-flash 1.1s ease-out; }
      `}</style>

      <OfflineBadge />
      {saveError && (
        // Round-3 H22: surfacing autosave errors instead of swallowing
        // them silently. Auto-dismisses on the next successful save.
        // R15-followup-9: when the error code is `submission_locked` the
        // student has already submitted this quiz (often: they re-scanned
        // the QR by accident). Don't show a misleading "will retry on
        // reconnect" — it never will. Render a clear message + auto-bounce
        // them to /my-history after 3s so they end up on their own portal
        // instead of mashing Submit on a locked attempt.
        <SaveErrorBanner saveError={saveError} hasPendingSaves={hasPendingSaves} />
      )}
      {isSecondaryTab && (
        // R15-followup-11 — multi-tab guard. Another tab on this device
        // already owns this session; autosave is blocked here. Tell the
        // student to close that other one so their answers in this tab
        // can be saved. R15-followup-12 — added a "切回此标签" takeover
        // button: if the other tab is unreachable (closed, frozen, in a
        // different Chrome window, etc.) the student can forcefully claim
        // ownership on this tab and unblock autosave without waiting the
        // 10s stale window.
        <div
          role="alert"
          aria-live="polite"
          className="bg-amber-100 border-b-2 border-amber-400 text-amber-900 text-sm px-4 py-3 text-center font-medium flex flex-wrap items-center justify-center gap-3"
        >
          <span>
            ⚠️ 这次早测已经在另一个标签页打开 · 请关闭那个标签页继续答题（这里的输入不会被保存）
          </span>
          <button
            type="button"
            onClick={claimTabOwnership}
            className="px-3 py-1 rounded bg-amber-600 hover:bg-amber-700 text-white text-xs font-semibold"
          >
            切回此标签 · Use this tab
          </button>
        </div>
      )}

      <div
        className="sticky top-0 z-20 px-3 lg:px-5 py-2 backdrop-blur bg-white/95 border-b flex items-center gap-3"
        style={{ paddingTop: 'max(0.5rem, env(safe-area-inset-top))' }}
      >
        <div className="font-semibold text-base lg:text-lg">
          {mode === 'practice' ? '练习 · Practice' : '早测 · Morning Quiz'}
          {mode === 'practice' && (
            <span className="ml-2 text-xs bg-emerald-100 text-emerald-700 px-1.5 py-0.5 rounded font-medium uppercase tracking-wide">
              Friendly
            </span>
          )}
        </div>
        <div className="hidden lg:block text-sm text-gray-500">
          {answeredCount} / {total} 已答
        </div>
        <div className="flex-1" />
        <FontSizeAdjuster />
        {/* Time-up auto-submit must also flush pending autosaves —
            round-7 C-E3 / agent-7 F6. Without this, the last 600ms of
            student input never reaches the server before the row is
            flipped to `submitted`. */}
        <Timer endsAt={paper.quizEnd} onTimeUp={onTimeUpSubmit} />
      </div>

      {/* r15-followup-32 — questions are shuffled per student (anti-cheat).
          The stems still carry their original "Qn." labels, so a student
          who fills boxes top-to-bottom in their own numeric order lands
          answers in the wrong boxes (the 2026-05-29 李永轩 case). A loud
          banner tells them to read each box's question number. */}
      <div
        className="px-4 py-2 bg-amber-50 border-b border-amber-200 text-amber-800 text-sm text-center"
        role="note"
      >
        ⚠️ 本试卷题目为<strong>随机顺序</strong>,请认准每题的题号 (Q1、Q2…) 再作答
        <span className="hidden lg:inline"> · Questions are in random order — check each question's number before answering.</span>
      </div>

      <main>
        <ExamRenderer paper={paper} />
      </main>

      {paletteOpen && (
        <div
          className="fixed inset-0 z-30 bg-slate-900/50 backdrop-blur-sm flex items-end lg:items-center justify-center p-4"
          onClick={() => setPaletteOpen(false)}
        >
          <div
            className="bg-white rounded-2xl w-full max-w-md shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <header className="px-5 py-4 border-b border-gray-100 flex items-center justify-between">
              <div>
                <div className="font-semibold text-base">题号导航 · Question Palette</div>
                <div className="text-xs text-gray-500 mt-0.5">点击数字跳到对应题目</div>
              </div>
              <button
                type="button"
                onClick={() => setPaletteOpen(false)}
                className="w-10 h-10 rounded-full hover:bg-gray-50 active:bg-gray-100 flex items-center justify-center text-gray-500"
                aria-label="关闭"
              >
                ✕
              </button>
            </header>
            <div className="px-3 py-3">
              <QuestionNavBar questions={paper.questions} onJumpTo={handleJump} />
              <div className="mt-3 px-2 flex items-center gap-3 text-xs text-gray-500 flex-wrap">
                <span className="inline-flex items-center gap-1.5">
                  <span className="w-3 h-3 rounded-sm bg-blue-600" /> 已答
                </span>
                <span className="inline-flex items-center gap-1.5">
                  <span className="w-3 h-3 rounded-sm bg-gray-100 border border-gray-200" /> 未答
                </span>
                <span className="inline-flex items-center gap-1.5">
                  <span className="w-3 h-3 rounded-sm border-2 border-orange-400" /> 待复查
                </span>
              </div>
            </div>
          </div>
        </div>
      )}

      <div
        className="fixed bottom-0 inset-x-0 bg-white border-t shadow-lg z-20 transition-transform"
        style={{
          paddingBottom: 'env(safe-area-inset-bottom)',
          // H17 — lift footer above iOS soft keyboard when it's visible.
          transform: keyboardOffset > 0 ? `translateY(-${keyboardOffset}px)` : undefined,
        }}
      >
        <div className="max-w-7xl mx-auto px-3 lg:px-5 py-2.5 lg:py-3 flex items-center gap-2">
          <button
            type="button"
            onClick={() => setPaletteOpen(true)}
            className="flex items-center gap-2 px-3.5 py-2.5 rounded-lg border border-gray-300 hover:bg-gray-50 active:bg-gray-100 touch-manipulation min-h-[48px] font-medium text-sm"
          >
            <svg className="w-5 h-5" viewBox="0 0 20 20" fill="currentColor" aria-hidden>
              <rect x="2.5" y="2.5" width="5" height="5" rx="1" />
              <rect x="12.5" y="2.5" width="5" height="5" rx="1" />
              <rect x="2.5" y="12.5" width="5" height="5" rx="1" />
              <rect x="12.5" y="12.5" width="5" height="5" rx="1" />
            </svg>
            <span>题号</span>
            <span className="text-xs tabular-nums text-gray-500">
              {answeredCount}/{total}
            </span>
          </button>
          {flaggedCount > 0 && (
            <span className="hidden sm:inline-flex items-center gap-1.5 text-sm text-orange-700 px-2 py-1.5 bg-orange-50 border border-orange-200 rounded-md">
              <svg className="w-4 h-4" viewBox="0 0 20 20" fill="currentColor" aria-hidden>
                <path d="M4 3a1 1 0 011-1h11l-2 4 2 4H5v8H3V3a0 0 0 011 0z" />
              </svg>
              {flaggedCount} 已标记
            </span>
          )}
          <div className="flex-1" />
          {mode === 'practice' && (
            <span className="text-xs text-emerald-700 mr-2 hidden sm:inline">
              Practice mode — answers saved locally
            </span>
          )}
          <button
            disabled={submitted || locked}
            onClick={onSubmitClick}
            data-testid="submit-button"
            className={`px-6 lg:px-7 py-3 text-white rounded-lg font-semibold text-base touch-manipulation min-h-[48px] ${
              submitted || locked
                ? 'bg-gray-300'
                : mode === 'practice'
                ? 'bg-emerald-600 hover:bg-emerald-700 active:bg-emerald-800'
                : 'bg-blue-600 hover:bg-blue-700 active:bg-blue-800'
            }`}
          >
            {locked ? '已结束' : submitted ? '提交中…' : mode === 'practice' ? '完成 · Done' : '交卷 · Submit'}
          </button>
        </div>
      </div>

      {/* R10 — pre-submit confirmation dialog. Required because tapping
          "交卷" on a touch device is too easy to do by accident, and the
          system has no un-submit path (the autoGrade fires immediately).
          Shows answered/total + the un-answered question numbers, plus a
          jump-to-question affordance for each missed question. ESC and
          backdrop-click close (cancel). */}
      {confirmOpen && !submitted && (
        <SubmitConfirmDialog
          paper={paper}
          answers={answers}
          onCancel={() => setConfirmOpen(false)}
          onConfirm={() => { setConfirmOpen(false); doSubmit(); }}
          onJumpTo={(qid) => { setConfirmOpen(false); handleJump(qid, 0); }}
        />
      )}
    </div>
  );
}

/** R10 — submit confirmation. Lists un-answered questions by their
 *  paper sortOrder so the student can choose to go back and finish them
 *  before locking in the submission. */
function SubmitConfirmDialog({
  paper,
  answers,
  onCancel,
  onConfirm,
  onJumpTo,
}: {
  paper: ExamPaper;
  answers: Record<string, { selectedOption?: string; textAnswer?: string }>;
  onCancel: () => void;
  onConfirm: () => void;
  onJumpTo: (questionId: string) => void;
}) {
  // ESC to cancel.
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') onCancel();
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onCancel]);

  const total = paper.questions.length;
  const unanswered = paper.questions
    .map((q, idx) => {
      const a = answers[q.id];
      const has = !!(a?.selectedOption || (a?.textAnswer && a.textAnswer.trim()));
      return has ? null : { id: q.id, n: idx + 1 };
    })
    .filter((x): x is { id: string; n: number } => x !== null);
  const answered = total - unanswered.length;
  const allAnswered = unanswered.length === 0;

  return (
    <div
      className="fixed inset-0 bg-black/50 z-50 flex items-end sm:items-center justify-center p-4"
      onClick={onCancel}
      role="dialog"
      aria-modal="true"
      aria-labelledby="submit-confirm-title"
      data-testid="submit-confirm-dialog"
    >
      <div
        className="bg-white rounded-xl shadow-xl w-full max-w-md p-5 space-y-4 max-h-[80vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="space-y-1">
          <h2 id="submit-confirm-title" className="text-lg font-bold text-gray-900">
            确认交卷？
          </h2>
          <p className={`text-sm ${allAnswered ? 'text-emerald-700' : 'text-amber-700'}`}>
            {allAnswered
              ? `已答完 ${answered} / ${total} 题`
              : `已答 ${answered} / ${total} 题,还有 ${unanswered.length} 题未答`}
          </p>
        </div>

        {!allAnswered && (
          <div className="space-y-2">
            <div className="text-xs uppercase tracking-wide text-gray-500">未答题号</div>
            <div className="flex flex-wrap gap-2" data-testid="unanswered-list">
              {unanswered.map((u) => (
                <button
                  key={u.id}
                  type="button"
                  onClick={() => onJumpTo(u.id)}
                  data-testid={`unanswered-${u.n}`}
                  className="px-3 py-1.5 text-sm bg-amber-50 hover:bg-amber-100 border border-amber-200 text-amber-800 rounded font-mono"
                  title="点击跳转到该题"
                >
                  Q{u.n}
                </button>
              ))}
            </div>
            <p className="text-xs text-gray-500">
              点击题号回去补答,或继续按"确定交卷"提交。一旦交卷将立即批改,无法撤销。
            </p>
          </div>
        )}

        {allAnswered && (
          <p className="text-sm text-gray-600">
            确认后立即批改,无法撤销。
          </p>
        )}

        <div className="flex gap-2 justify-end pt-2">
          <button
            type="button"
            onClick={onCancel}
            data-testid="submit-cancel"
            className="px-4 py-2 text-sm bg-gray-100 hover:bg-gray-200 text-gray-800 rounded-lg font-medium"
          >
            {allAnswered ? '再检查' : '继续答题'}
          </button>
          <button
            type="button"
            onClick={onConfirm}
            data-testid="submit-confirm"
            className={`px-4 py-2 text-sm text-white rounded-lg font-semibold ${
              allAnswered
                ? 'bg-blue-600 hover:bg-blue-700'
                : 'bg-amber-600 hover:bg-amber-700'
            }`}
          >
            确定交卷 · Submit
          </button>
        </div>
      </div>
    </div>
  );
}
