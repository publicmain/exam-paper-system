import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { ExamProvider, useExam } from '../components/exam/ExamContext';
import { ExamRenderer } from '../components/exam/QuestionTypeRegistry';
import { FontSizeAdjuster } from '../components/exam/shared/FontSizeAdjuster';
import { OfflineBadge } from '../components/exam/shared/OfflineBadge';
import { Spinner } from '../components/AsyncState';
import { QuestionNavBar } from '../components/exam/shared/QuestionNavBar';
import type { EnglishLevel, ExamAnswer, ExamPaper } from '../components/exam/types';
import {
  createPracticeClone,
  fetchPracticeSubmission,
  submitPractice,
  type PracticeSubmissionView,
  type PracticeSubmitResult,
} from '../lib/api-student';
import { prettifyPaperName } from '../lib/paperName';

/**
 * Practice-mode replay of a past morning-quiz submission.
 *
 * Public route — no JWT (the student arrives via a button on /my-history),
 * IP-gated server-side. We pass studentName/studentId as query so the
 * backend can re-verify ownership of the cloned submission.
 *
 * UX:
 *   - Same `<ExamProvider>` + `<ExamRenderer>` machinery as the real
 *     morning-quiz page → identical look, font scaling, flag-for-review.
 *   - Big yellow banner across the top so students never mistake practice
 *     for a graded run.
 *   - On submit, we POST to /practice/:id/submit and replace the renderer
 *     with an inline result card (per-question correct/incorrect + score).
 *   - "再来一份" creates a fresh clone via createPracticeClone(originalSubId)
 *     — but the original submission id is only available if the backend
 *     bubbles it in the payload; we fall back to the current
 *     practiceSubmissionId which the backend can treat as the clone source.
 *
 * Graceful degrade: every API call goes through api-student which returns
 * null on 404. The page shows a "暂未开放" card instead of crashing.
 */

export default function PracticeMode() {
  const { practiceSubmissionId } = useParams<{ practiceSubmissionId: string }>();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const studentName = searchParams.get('name') ?? '';
  const studentIdParam = searchParams.get('studentId') ?? '';

  const [view, setView] = useState<PracticeSubmissionView | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [unavailable, setUnavailable] = useState(false);
  const [result, setResult] = useState<PracticeSubmitResult | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [cloning, setCloning] = useState(false);
  const submitInflightRef = useRef(false);

  useEffect(() => {
    if (!practiceSubmissionId || !studentName) return;
    let cancelled = false;
    fetchPracticeSubmission(practiceSubmissionId, {
      studentName,
      studentId: studentIdParam || undefined,
    })
      .then((v) => {
        if (cancelled) return;
        if (v === null) setUnavailable(true);
        else {
          setView(v);
          // R15-followup-7: revisit-after-submit shortcut. If the student
          // already submitted this practice, the backend returns the
          // grading payload up-front so we can render PracticeResultView
          // immediately without making them re-submit. Without this,
          // /my-history → 「查看练习卷」 dumps the student back into an
          // editable form that LOOKS unsubmitted — confusing UX.
          if (v.alreadySubmitted && v.perQuestion && v.maxScore != null) {
            setResult({
              autoScore: v.autoScore ?? 0,
              maxScore: v.maxScore,
              perQuestion: v.perQuestion,
            });
          }
        }
      })
      .catch((e: any) => {
        if (cancelled) return;
        const msg = String(e?.message ?? e);
        if (msg.includes('not_found') || msg.includes('Not Found')) {
          setError('找不到练习记录 — Practice not found.');
        } else if (msg.includes('Forbidden') || msg.includes('name_mismatch')) {
          setError('姓名不匹配 — Name does not match.');
        } else {
          setError(msg);
        }
      });
    return () => { cancelled = true; };
  }, [practiceSubmissionId, studentName, studentIdParam]);

  // Mirror MorningQuizTake's beforeunload guard so accidental close mid-
  // practice still prompts. Skipped once `result` exists (student is done).
  useEffect(() => {
    function handler(e: BeforeUnloadEvent) {
      if (result) return;
      // Also skip if there's no view yet (nothing to lose).
      if (!view) return;
      e.preventDefault();
      e.returnValue = '';
    }
    window.addEventListener('beforeunload', handler);
    return () => window.removeEventListener('beforeunload', handler);
  }, [result, view]);

  // Browser-back guard — same pattern as MorningQuizTake. Once result is
  // shown, we release the guard so the student can navigate normally.
  useEffect(() => {
    if (!practiceSubmissionId || !view) return;
    window.history.pushState({ practiceGuard: true }, '', window.location.href);
    function onPop() {
      if (result) return;
      window.history.pushState({ practiceGuard: true }, '', window.location.href);
    }
    window.addEventListener('popstate', onPop);
    return () => window.removeEventListener('popstate', onPop);
  }, [practiceSubmissionId, view, result]);

  // No real autosave endpoint for practice — keep answers in client state
  // only and POST the whole bundle on submit. The Provider's debounced
  // path still fires for localStorage continuity within this session.
  const noopPersist = useCallback(
    async (_qid: string, _body: { selectedOption?: string | null; textAnswer?: string | null }) => {
      void _qid; void _body;
      return;
    },
    [],
  );

  const handleSubmit = useCallback(
    async (answers: Record<string, ExamAnswer>) => {
      if (!practiceSubmissionId) return;
      if (submitInflightRef.current) return;
      submitInflightRef.current = true;
      setSubmitting(true);
      try {
        // R15-followup — submitPractice now requires studentName for
        // backend re-verification of submission ownership; wrapper
        // converts the keyed Record into the array shape Zod expects.
        const body = {
          studentName,
          studentId: studentIdParam || undefined,
          answers: Object.fromEntries(
            Object.entries(answers).map(([qid, a]) => [
              qid,
              {
                selectedOption: a.selectedOption ?? null,
                textAnswer: a.textAnswer ?? null,
              },
            ]),
          ),
        };
        const r = await submitPractice(practiceSubmissionId, body);
        if (r === null) {
          setError('练习提交功能暂未开放 · Practice submit not yet available.');
          return;
        }
        setResult(r);
        try {
          localStorage.removeItem(`mq:answers:${practiceSubmissionId}`);
        } catch { /* ignore */ }
      } catch (e: any) {
        setError(String(e?.message ?? e));
      } finally {
        setSubmitting(false);
        submitInflightRef.current = false;
      }
    },
    [practiceSubmissionId, studentName, studentIdParam],
  );

  const handleTryAgain = useCallback(async () => {
    if (!practiceSubmissionId || cloning) return;
    setCloning(true);
    try {
      // Backend may accept the current practice id as the clone source
      // (it knows which original submission spawned this clone).
      const r = await createPracticeClone(practiceSubmissionId, {
        studentName,
        studentId: studentIdParam || undefined,
      });
      if (r === null) {
        setError('暂未开放重做 · Try-again not available yet.');
        return;
      }
      const qs =
        '?name=' + encodeURIComponent(studentName) +
        (studentIdParam ? '&studentId=' + encodeURIComponent(studentIdParam) : '');
      navigate(`/practice/${r.practiceSubmissionId}${qs}`, { replace: true });
      // Reset local state so the new id remounts cleanly.
      setView(null);
      setResult(null);
    } catch (e: any) {
      setError(String(e?.message ?? e));
    } finally {
      setCloning(false);
    }
  }, [practiceSubmissionId, cloning, navigate, studentName, studentIdParam]);

  const backToHistory = `/my-history${studentName ? `?name=${encodeURIComponent(studentName)}` : ''}`;

  if (!studentName) {
    return (
      <div className="min-h-screen bg-gray-50 p-6 text-center text-gray-600">
        <p className="mb-4">缺少姓名参数 — 请从「我的记录」页重新打开练习。</p>
        <a href="/my-history" className="text-blue-600 underline">→ 回到我的记录</a>
      </div>
    );
  }
  if (unavailable) {
    return (
      <div className="min-h-screen bg-gray-50">
        <div className="max-w-2xl mx-auto py-12 px-6 text-center">
          <div className="bg-amber-50 border border-amber-200 rounded-xl p-8">
            <div className="text-3xl mb-3">📚</div>
            <h1 className="text-lg font-semibold text-amber-900 mb-2">
              练习模式暂未开放 · Practice mode not yet available
            </h1>
            <p className="text-sm text-amber-800">
              该功能正在部署, 稍后再试。
            </p>
            <a href={backToHistory} className="inline-block mt-4 text-sm text-blue-600 underline">
              ← 返回我的记录
            </a>
          </div>
        </div>
      </div>
    );
  }
  if (error) {
    return (
      <div className="min-h-screen bg-gray-50">
        <div className="max-w-2xl mx-auto py-12 px-6 text-center">
          <div className="text-rose-700 text-lg mb-4" role="alert">⚠️ {error}</div>
          <a className="text-sm text-blue-600 underline" href={backToHistory}>← 返回我的记录</a>
        </div>
      </div>
    );
  }
  if (!view) {
    return (
      <div className="min-h-screen bg-gray-50">
        <Spinner label="加载练习…" />
      </div>
    );
  }

  // Results screen — replace the active renderer.
  if (result) {
    return (
      <PracticeResultView
        result={result}
        view={view}
        backToHistory={backToHistory}
        onTryAgain={handleTryAgain}
        cloning={cloning}
      />
    );
  }

  return (
    <ExamProvider
      sessionId={view.practiceSubmissionId}
      mode="practice"
      onPersistAnswer={noopPersist}
    >
      <PracticeHost
        view={view}
        onSubmit={handleSubmit}
        submitting={submitting}
        backToHistory={backToHistory}
      />
    </ExamProvider>
  );
}

function PracticeHost({
  view,
  onSubmit,
  submitting,
  backToHistory,
}: {
  view: PracticeSubmissionView;
  onSubmit: (answers: Record<string, ExamAnswer>) => void;
  submitting: boolean;
  backToHistory: string;
}) {
  const { answers, flushPendingSaves } = useExam();
  const [paletteOpen, setPaletteOpen] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);

  // Build the same ExamPaper shape MorningQuizTake builds, but with a
  // synthetic quizEnd (no time limit in practice — set it to +24h so the
  // <Timer> wouldn't auto-submit even if we mounted one; we don't).
  const paper: ExamPaper = useMemo(
    () => ({
      sessionId: view.practiceSubmissionId,
      quizEnd:
        view.quizEnd ??
        new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
      level: (view.level ?? 'olevel') as EnglishLevel,
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
    [view],
  );

  const total = paper.questions.length;
  const answeredCount = useMemo(
    () =>
      paper.questions.filter((q) => {
        const a = answers[q.id];
        return !!(a?.selectedOption || (a?.textAnswer && a.textAnswer.trim()));
      }).length,
    [paper.questions, answers],
  );

  const handleJump = useCallback((qid: string) => {
    const el = document.getElementById(`q-${qid}`);
    if (el) {
      const top = window.scrollY + el.getBoundingClientRect().top - 80;
      window.scrollTo({ top, behavior: 'smooth' });
    }
    setPaletteOpen(false);
  }, []);

  const doSubmit = useCallback(async () => {
    try { await flushPendingSaves(); } catch { /* practice: persist is noop */ }
    onSubmit(answers);
  }, [answers, flushPendingSaves, onSubmit]);

  return (
    <div className="min-h-screen pb-24 bg-emerald-50/40">
      <OfflineBadge />

      {/* Big yellow banner — required by spec so students can't confuse
          a practice run with a graded morning quiz. */}
      <div className="bg-yellow-300/80 border-b border-yellow-500 text-yellow-900 px-4 py-3 text-center font-semibold">
        📚 Practice Mode · 练习模式 (不计入成绩 · NOT counted)
      </div>

      <div
        className="sticky top-0 z-20 px-3 lg:px-5 py-2 backdrop-blur bg-white/95 border-b flex items-center gap-3"
      >
        <a
          href={backToHistory}
          className="text-sm text-blue-600 hover:underline"
        >
          ← 退出练习
        </a>
        <div className="font-semibold text-base lg:text-lg">{prettifyPaperName(view.paperName)}</div>
        <div className="hidden lg:block text-sm text-gray-500">
          {answeredCount} / {total} 已答
        </div>
        <div className="flex-1" />
        <FontSizeAdjuster />
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
              <div className="font-semibold text-base">题号导航</div>
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
            </div>
          </div>
        </div>
      )}

      <div
        className="fixed bottom-0 inset-x-0 bg-white border-t shadow-lg z-20"
        style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}
      >
        <div className="max-w-7xl mx-auto px-3 lg:px-5 py-2.5 lg:py-3 flex items-center gap-2">
          <button
            type="button"
            onClick={() => setPaletteOpen(true)}
            className="flex items-center gap-2 px-3.5 py-2.5 rounded-lg border border-gray-300 hover:bg-gray-50 active:bg-gray-100 min-h-[48px] font-medium text-sm"
          >
            <span>题号</span>
            <span className="text-xs tabular-nums text-gray-500">
              {answeredCount}/{total}
            </span>
          </button>
          <div className="flex-1" />
          <button
            disabled={submitting}
            onClick={() => setConfirmOpen(true)}
            className={`px-6 lg:px-7 py-3 text-white rounded-lg font-semibold text-base min-h-[48px] ${
              submitting
                ? 'bg-gray-300'
                : 'bg-emerald-600 hover:bg-emerald-700 active:bg-emerald-800'
            }`}
          >
            {submitting ? '提交中…' : '完成 · Done'}
          </button>
        </div>
      </div>

      {confirmOpen && (
        <div
          className="fixed inset-0 bg-black/50 z-50 flex items-end sm:items-center justify-center p-4"
          onClick={() => setConfirmOpen(false)}
          role="dialog"
          aria-modal="true"
        >
          <div
            className="bg-white rounded-xl shadow-xl w-full max-w-sm p-5 space-y-3"
            onClick={(e) => e.stopPropagation()}
          >
            <h2 className="text-lg font-bold">完成练习?</h2>
            <p className="text-sm text-gray-600">
              已答 {answeredCount} / {total} 题。提交后查看每题对错。
            </p>
            <div className="flex justify-end gap-2 pt-1">
              <button
                type="button"
                onClick={() => setConfirmOpen(false)}
                className="px-4 py-2 text-sm bg-gray-100 hover:bg-gray-200 text-gray-800 rounded-lg font-medium"
              >
                继续答题
              </button>
              <button
                type="button"
                onClick={() => { setConfirmOpen(false); doSubmit(); }}
                className="px-4 py-2 text-sm text-white rounded-lg font-semibold bg-emerald-600 hover:bg-emerald-700"
              >
                完成 · Done
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function PracticeResultView({
  result,
  view,
  backToHistory,
  onTryAgain,
  cloning,
}: {
  result: PracticeSubmitResult;
  view: PracticeSubmissionView;
  backToHistory: string;
  onTryAgain: () => void;
  cloning: boolean;
}) {
  const pct = result.maxScore > 0
    ? Math.round((result.autoScore / result.maxScore) * 100)
    : 0;
  const pctColor =
    pct >= 80 ? 'text-emerald-700' :
    pct >= 60 ? 'text-blue-700' :
    pct >= 40 ? 'text-amber-700' : 'text-rose-700';

  // index questions by id so per-question result rows can show stems.
  const qById = new Map(view.paperQuestions.map((q) => [q.id, q]));

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="bg-yellow-300/80 border-b border-yellow-500 text-yellow-900 px-4 py-3 text-center font-semibold">
        📚 Practice Mode · 练习模式 (不计入成绩)
      </div>
      <main className="max-w-3xl mx-auto px-6 py-6 space-y-4">
        <div>
          <a href={backToHistory} className="text-sm text-blue-600 hover:underline">
            ← 返回我的记录
          </a>
        </div>

        <header className="bg-white rounded-xl border shadow-sm p-5">
          <div className="text-sm text-gray-500">{prettifyPaperName(view.paperName)} (练习)</div>
          <div className={`text-4xl font-bold mt-2 ${pctColor}`}>
            {result.autoScore}<span className="text-2xl text-gray-400 font-normal"> / {result.maxScore}</span>
            <span className={`text-base ml-2 ${pctColor}`}>({pct}%)</span>
          </div>
          <div className="mt-4 flex flex-wrap gap-2">
            <button
              type="button"
              onClick={onTryAgain}
              disabled={cloning}
              className="px-4 py-2 text-sm bg-emerald-600 hover:bg-emerald-700 disabled:bg-gray-300 text-white rounded-lg font-medium"
            >
              {cloning ? '创建中…' : '🔄 再来一份 · Try again'}
            </button>
            <a
              href={backToHistory}
              className="px-4 py-2 text-sm bg-gray-100 hover:bg-gray-200 text-gray-800 rounded-lg font-medium"
            >
              回到我的记录
            </a>
          </div>
        </header>

        <section className="space-y-3">
          <h2 className="text-lg font-semibold text-gray-800 px-1">逐题回顾</h2>
          {result.perQuestion.map((it) => {
            const q = qById.get(it.paperQuestionId);
            const sc = q?.snapshotContent ?? {};
            const stem: string =
              typeof sc.stem === 'string' ? sc.stem :
              typeof sc.text === 'string' ? sc.text : '';
            const correctTone =
              it.isCorrect === true ? 'border-emerald-300 bg-emerald-50' :
              it.isCorrect === false ? 'border-rose-300 bg-rose-50' :
              'border-gray-200 bg-white';
            const icon = it.isCorrect === true ? '✓' : it.isCorrect === false ? '✗' : '—';
            const iconColor =
              it.isCorrect === true ? 'text-emerald-700' :
              it.isCorrect === false ? 'text-rose-700' : 'text-gray-400';
            const sortOrder = it.sortOrder ?? q?.sortOrder ?? '?';
            return (
              <div key={it.paperQuestionId} className={`border rounded-lg p-4 ${correctTone}`}>
                <div className="flex items-start gap-3">
                  <div className={`text-2xl font-bold ${iconColor} shrink-0`}>{icon}</div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 text-xs text-gray-500 mb-2">
                      <span>Q{sortOrder}</span>
                      <span className="font-mono">得分:{it.awardedMarks ?? 0} / {it.marks}</span>
                    </div>
                    {stem && (
                      <div className="text-sm text-gray-800 whitespace-pre-wrap mb-2 line-clamp-3">
                        {stem}
                      </div>
                    )}
                    <div className="text-xs text-gray-600 space-y-1">
                      <div>
                        <span className="text-gray-400">我的答案:</span>{' '}
                        {it.studentAnswer ? <span className="text-gray-800">{it.studentAnswer}</span> : <em className="text-gray-400">(空答)</em>}
                      </div>
                      {it.correctAnswer && (
                        <div>
                          <span className="text-gray-400">参考答案:</span> <span className="text-gray-800">{it.correctAnswer}</span>
                        </div>
                      )}
                      {it.explanation && (
                        <div className="mt-1 italic text-gray-600">{it.explanation}</div>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </section>
      </main>
    </div>
  );
}
