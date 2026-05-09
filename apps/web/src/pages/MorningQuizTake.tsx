import { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { api } from '../lib/api';
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
}

export default function MorningQuizTake() {
  const { sessionId } = useParams<{ sessionId: string }>();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  // The URL hint is still read for backwards compatibility, but the
  // SERVER's `mode` field is authoritative — it's pinned to 'test' for
  // morning quizzes, so a `?mode=practice` URL trick can't unlock answers
  // even if a future bug re-introduces correctness data into the payload.
  // See round-3 SUMMARY C2 for the leak path this closes.
  const urlMode = searchParams.get('mode') === 'practice' ? 'practice' : 'test';

  const [view, setView] = useState<SessionView | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [submitted, setSubmitted] = useState(false);

  useEffect(() => {
    if (!sessionId) return;
    api
      .morningQuizSession(sessionId)
      .then((v: SessionView) => setView(v))
      .catch((e: any) => setError(e.message ?? String(e)));
  }, [sessionId]);

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
    // F3 — go to per-session result page instead of dropping back to the
    // student home. The result page surfaces score + per-question
    // correct/wrong + brief explanation.
    navigate(`/student/result/${sessionId}`, { replace: true });
  }, [sessionId, navigate]);

  async function handleSubmit() {
    // Compatibility shim — the real flush + submit happens inside
    // PaperHost via SubmitButton. Kept here so the existing Timer's
    // `onTimeUp={onSubmit}` path still works for time-up auto-submit
    // (which can't await flush, but the local cache + reconnect replay
    // covers the remaining loss window).
    if (!sessionId || submitted) return;
    setSubmitted(true);
    try {
      await submitToServer();
    } catch (e: any) {
      setError(e.message ?? String(e));
      setSubmitted(false);
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

  return (
    <ExamProvider sessionId={view.sessionId} mode={mode} onPersistAnswer={persistAnswer}>
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
  const { answers, flaggedCount, isFlagged, flushPendingSaves, saveError, hasPendingSaves } = useExam();

  // Round-3 H6 — wrap submit so it flushes every pending autosave before
  // calling the server's submit endpoint. Without this, the last 600 ms
  // of typing can land *after* the server has flipped the submission to
  // `submitted`, causing the autosave to error with `submission_locked`
  // and the answer to vanish silently.
  const onSubmitClick = useCallback(async () => {
    try {
      await flushPendingSaves();
    } catch { /* surfaced via saveError, still proceed */ }
    onSubmit();
  }, [flushPendingSaves, onSubmit]);

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
        <div
          role="alert"
          className="bg-rose-50 border-b border-rose-200 text-rose-800 text-sm px-4 py-2 text-center"
        >
          ⚠️ 保存失败 / Save failed: {saveError}.{' '}
          {hasPendingSaves ? '系统将自动重试 / will retry on reconnect.' : ''}
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
        <Timer endsAt={paper.quizEnd} onTimeUp={onSubmit} />
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
            disabled={submitted}
            onClick={onSubmitClick}
            className={`px-6 lg:px-7 py-3 text-white rounded-lg font-semibold text-base touch-manipulation min-h-[48px] ${
              submitted
                ? 'bg-gray-300'
                : mode === 'practice'
                ? 'bg-emerald-600 hover:bg-emerald-700 active:bg-emerald-800'
                : 'bg-blue-600 hover:bg-blue-700 active:bg-blue-800'
            }`}
          >
            {submitted ? '提交中…' : mode === 'practice' ? '完成 · Done' : '交卷 · Submit'}
          </button>
        </div>
      </div>
    </div>
  );
}
