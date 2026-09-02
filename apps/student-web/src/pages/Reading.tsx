/**
 * `/lesson/reading` —— 学生每天真正作答的那一页。
 *
 * ## 这一页只负责三件事
 *
 * 1. **拿资源**：`GET /lesson/today` → `segments.read` 给出 `sessionId` /
 *    `submissionId`，再按 `sessionId` 取会话。**URL、查询串、hash 里
 *    一个字都不读** —— 身份只有令牌，资源只有服务端说了算。
 * 2. **摆外壳**：本次难度、字号、离线角标、题号条、交卷。
 * 3. **交卷序列**：二次确认 → 强刷 → 交卷 → 去阅读结果页。
 *
 * ## 这一页**不**负责的事
 *
 * 自动保存、逐题写入序号、离线队列、过期写对账、多标签所有权
 * —— 全部在 S7B 的 `ReadingProvider` 里，这里只消费它的公共契约。
 * 页面再实现一遍就会出现第二套真相。
 *
 * ## 后端的 href
 *
 * `/lesson/today` 的 `nextAction.href` 指向旧端。这一页**永远不读它**。
 *
 * ## 交卷之后去哪（S9D2B）
 *
 * **固定去 `/lesson/reading/result`**，不问 `nextAction`。
 *
 * 原来这里是「交完卷再刷一次 today，按 `kind` 跳」。看着更「服从服务端」，
 * 实际上把阅读结果页从正常流程里整个抹掉了：有词汇任务的日子，交卷那一刻
 * 服务端就把阶段推到了 `vocab_learn`，紧接着的 today 回的是 `learn_vocab`
 * —— 于是学生从「确认交卷」直接被送去背单词，**永远看不到自己刚交的那份
 * 卷子**（2026-08-30 staging 实测；`read_result` 那个 kind 只在「交了卷但
 * 阶段没推进」的收尾场景里才出现，正常日子根本轮不到它）。
 *
 * 所以出口在这里定死：交卷成功 = 去看这次的结果。**「接下来做什么」由结果
 * 页自己的主行动再问一次 today** —— 那时学生已经看过成绩了，往下走才有意义。
 * 结果页若发现今天没有可看的结果（被撤卷、换了一天），它自己会回枢纽。
 */
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { api, ApiError, type ReadingSessionPayload } from '../lib/api';
import { handleAuthFailure } from '../lib/auth-store';
import { readToken } from '../lib/identity';
import { ROUTES, scoreDetailPath } from '../routes.contract';
import { ReadingProvider, isSubmitBlocked, useReading } from '../lesson/ReadingProvider';
import { ExamFocusProvider, ExamModeProvider } from '../lesson/ExamContext';
import { ExamRenderer } from '../lesson/QuestionTypeRegistry';
import type { ExamAnswer, ExamPaper } from '../lesson/examTypes';
import type { ReadingExistingAnswer } from '../lib/api';
import { FontSizeAdjuster } from '../lesson/shared/FontSizeAdjuster';
import { OfflineBadge } from '../lesson/shared/OfflineBadge';
import { QuestionNavBar } from '../lesson/shared/QuestionNavBar';
import { levelLabel } from '../lib/levels';

type Phase =
  | { s: 'loading' }
  | { s: 'error'; message: string }
  | { s: 'ready'; session: ReadingSessionPayload; submissionId: string | null };

/**
 * 服务端说「这份答卷已经不在作答中了」的那几种 400。
 *
 * 后端的重复交卷**不是幂等的**（`student.service.ts:639-641` 直接抛
 * `submission already <status>`）。对学生而言那就是「已经交过了」，
 * 不该弹一个红色报错 —— 但**只有这几种**算已完成，别的 400
 * （比如 `quiz_window_closed`）必须照实报出来。
 */
/**
 * 服务端已存答案 → 引擎初值。
 *
 * 只取两个可编辑字段；`content` 是给老客户端的兼容字段，不读。
 * 序号原样递进去 —— 它是引擎的概念，页面不对它做任何运算。
 */
function initialAnswersOf(
  existing: Record<string, ReadingExistingAnswer>,
): Record<string, ExamAnswer> {
  const out: Record<string, ExamAnswer> = {};
  for (const [qid, a] of Object.entries(existing ?? {})) {
    const ans: ExamAnswer = {};
    if (a?.selectedOption != null) ans.selectedOption = a.selectedOption;
    if (a?.textAnswer != null) ans.textAnswer = a.textAnswer;
    out[qid] = ans;
  }
  return out;
}

function initialSeqsOf(existing: Record<string, ReadingExistingAnswer>): Record<string, number> {
  const out: Record<string, number> = {};
  for (const [qid, a] of Object.entries(existing ?? {})) {
    if (typeof a?.clientSeq === 'number') out[qid] = a.clientSeq;
  }
  return out;
}

function looksAlreadyDone(e: unknown): boolean {
  if (!(e instanceof ApiError) || e.status !== 400) return false;
  const text = `${e.body.code ?? ''} ${e.body.message ?? ''}`.toLowerCase();
  return /already\s+(submitted|graded|locked)/.test(text);
}

export default function ReadingPage() {
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const requestedSessionId = params.get('sessionId');
  const [phase, setPhase] = useState<Phase>({ s: 'loading' });

  const load = useCallback(async () => {
    const token = readToken();
    if (!token) return;
    setPhase({ s: 'loading' });
    try {
      const today = requestedSessionId ? null : await api.lessonToday(token);
      const read = today?.segments.find((s) => s.key === 'read');
      const sessionId = requestedSessionId ?? (read && read.key === 'read' ? read.sessionId : null);
      const submissionId = read && read.key === 'read' ? read.submissionId : null;
      if (!sessionId) {
        // 今天没有可作答的卷子 —— 回枢纽，由它决定下一步。
        navigate(ROUTES.today, { replace: true });
        return;
      }
      const session = await api.getReadingSession(token, sessionId);
      setPhase({ s: 'ready', session, submissionId: session.submissionId ?? submissionId });
    } catch (e) {
      if (handleAuthFailure(e)) return;
      setPhase({ s: 'error', message: '没能打开这份阅读 —— 网络不太好，重试一下。' });
    }
  }, [navigate, requestedSessionId]);

  useEffect(() => {
    void load();
  }, [load]);

  if (phase.s === 'loading') {
    return (
      <div className="min-h-[100dvh] grid place-items-center bg-slate-50">
        <p className="text-slate-400">载入中…</p>
      </div>
    );
  }

  if (phase.s === 'error') {
    return (
      <div className="min-h-[100dvh] grid place-items-center bg-slate-50 px-6">
        <div className="w-full max-w-sm bg-white rounded-2xl border border-slate-200 p-6">
          <div role="alert" className="rounded-xl bg-rose-50 text-rose-700 px-4 py-3 text-sm mb-4">
            {phase.message}
          </div>
          <button
            type="button"
            onClick={() => void load()}
            className="w-full rounded-xl bg-blue-600 text-white py-3 text-base font-medium min-h-[44px]"
          >
            重试
          </button>
        </div>
      </div>
    );
  }

  const { session, submissionId } = phase;
  const token = readToken() ?? '';

  return (
    <ReadingProvider
      sessionId={session.sessionId}
      submissionId={submissionId}
      initialAnswers={initialAnswersOf(session.existingAnswers)}
      initialSeqs={initialSeqsOf(session.existingAnswers)}
      deps={{
        saveAnswer: (qid, body) =>
          api.saveReadingAnswer(token, session.sessionId, { paperQuestionId: qid, ...body }),
        loadSession: () => api.getReadingSession(token, session.sessionId),
        healthProbe: async () => {
          try {
            await api.lessonToday(token);
            return true;
          } catch (e) {
            return e instanceof ApiError; // 服务端答了话就算通
          }
        },
        onAuthFailure: handleAuthFailure,
      }}
    >
      {/*
        **恒定 test。**
        载荷里的 `mode` 只是如实描述服务端返回了什么；阅读是正式考试，
        一份畸形（或被篡改）的 `mode:'practice'` 不该让答案键与解析当场
        露出来。这里不读它 —— 服务端的白名单脱敏是第一道闸，这行是第二道。
      */}
      <ExamModeProvider mode="test">
        <ReadingShell session={session} submissionId={submissionId} historical={Boolean(requestedSessionId)} />
      </ExamModeProvider>
    </ReadingProvider>
  );
}

function ReadingShell({ session, submissionId, historical }: { session: ReadingSessionPayload; submissionId: string | null; historical: boolean }) {
  const navigate = useNavigate();
  const r = useReading();
  const [confirming, setConfirming] = useState(false);
  const [exiting, setExiting] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  /**
   * 连点守卫。
   *
   * 光靠 `submitting` 这个 state 挡不住：同一个 tick 里连点三下，三次
   * 回调看到的都是**上一帧**的 `false`，三个请求就都发出去了。
   * 真正的闸门必须是同步生效的 ref。
   */
  const submittingRef = useRef(false);
  const [focusedQid, setFocusedQid] = useState<string | null>(null);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const displayLevel = levelLabel(session.level) ?? '难度未设置';

  const paper: ExamPaper = useMemo(
    () => ({
      sessionId: session.sessionId,
      quizEnd: session.quizEnd,
      level: session.level ?? 'olevel',
      paperMode: session.paperMode ?? null,
      mode: 'test', // 见上：阅读页恒定 test，不读载荷里的 mode
      rendererKey: session.rendererKey ?? null,
      questions: session.questions,
    }),
    [session],
  );

  const blocked = isSubmitBlocked(r);
  /** 供事件监听器同步读取 —— 监听器只注册一次，不能靠闭包里的旧值判断。 */
  const blockedRef = useRef(blocked);
  blockedRef.current = blocked;

  // 有没保存 / 没证实的东西时，关标签页要拦一下。
  useEffect(() => {
    if (!blocked) return;
    const onBeforeUnload = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      e.returnValue = '';
    };
    window.addEventListener('beforeunload', onBeforeUnload);
    return () => window.removeEventListener('beforeunload', onBeforeUnload);
  }, [blocked]);

  /**
   * 点题号条 → 跳到那一题。
   *
   * 分页的渲染器（一屏一题）需要先翻页，所以先把题号广播下去，
   * 再滚 —— 只滚不广播的话，目标元素根本不在 DOM 里。
   */
  /**
   * 浏览器返回键。
   *
   * `beforeunload` 只管**页面卸载**，SPA 里按返回是一次路由切换，它一声不吭。
   * 学生用返回键退出考试是最常见的动作之一，判据必须和「退出」按钮同一套。
   *
   * 做法：进页面时压一条哨兵历史记录，返回时先落到它上面 —— 这时如果还有
   * 没保存好的东西，就把哨兵再压回去（人留在阅读页）并弹确认；干净的话
   * 就正常回 `/today`。卸载时把监听器摘干净。
   */
  useEffect(() => {
    window.history.pushState({ swReadingGuard: true }, '');
    const onPop = () => {
      if (blockedRef.current) {
        window.history.pushState({ swReadingGuard: true }, '');
        setExiting(true);
        return;
      }
      navigate(ROUTES.today);
    };
    window.addEventListener('popstate', onPop);
    return () => window.removeEventListener('popstate', onPop);
  }, [navigate]);

  const jumpTo = useCallback((qid: string) => {
    setFocusedQid(qid);
    document.getElementById(`q-${qid}`)?.scrollIntoView({ block: 'center' });
  }, []);
  const focus = useMemo(
    () => ({ qid: focusedQid, request: (qid: string) => setFocusedQid(qid) }),
    [focusedQid],
  );

  const doSubmit = useCallback(async () => {
    if (submittingRef.current) return; // 连点只算一次
    submittingRef.current = true;
    const token = readToken();
    if (!token) return;
    setSubmitting(true);
    setSubmitError(null);
    try {
      // ① 先把还没落盘的写强制发出去，并等在途的对账结束
      await r.flushPendingSaves();
      // ② 仍有未落盘 / 报错 / 未证实的 → **不发交卷请求**
      if (isSubmitBlocked(r)) {
        setSubmitError('还有答案没保存好 —— 等它保存完，或先处理上面的提示。');
        submittingRef.current = false;
        setSubmitting(false);
        return;
      }
      // ③ 交卷。**不**用它的返回值决定去哪。
      let submittedId = submissionId;
      try {
        const submitted = await api.submitReading(token, session.sessionId, { final: true });
        submittedId = submitted.id ?? submissionId;
      } catch (e) {
        if (!looksAlreadyDone(e)) throw e;
      }
      // ④ 交卷成功 → **固定**去看这次的结果（理由见文件头「交卷之后去哪」）。
      //    不再问 today：那一问的答案此刻已经是「去背单词」，会把结果页跳过去。
      navigate(historical && submittedId ? scoreDetailPath(submittedId) : ROUTES.readingResult);
    } catch (e) {
      if (handleAuthFailure(e)) return;
      setSubmitError('交卷没成功 —— 再试一次；答案还在本机上，不会丢。');
      submittingRef.current = false;
      setSubmitting(false);
    }
  }, [historical, navigate, r, session.sessionId, submissionId]);

  return (
    <div className="ui-ios min-h-[100dvh] flex flex-col">
      <OfflineBadge />

      <header className="app-glass safe-top sticky top-0 z-20 border-x-0 border-t-0 px-3 py-2 grid grid-cols-[auto_1fr_auto] items-center gap-2 sm:gap-3">
        <button
          type="button"
          onClick={() => (blocked ? setExiting(true) : navigate(ROUTES.today))}
          className="min-h-[44px] px-3 rounded-lg text-slate-600 hover:bg-slate-50 text-sm"
        >
          ← 退出
        </button>
        <div className="min-w-0 flex justify-center px-1">
          <span
            data-testid="reading-level"
            aria-label={`本次难度：${displayLevel}`}
            className="max-w-full truncate rounded-full border border-blue-100 bg-blue-50 px-3 py-1.5 text-[13px] sm:text-sm font-medium text-blue-700"
          >
            <span className="hidden sm:inline text-blue-500">本次难度 · </span>
            {displayLevel}
          </span>
        </div>
        <FontSizeAdjuster />
      </header>

      {r.isSecondaryTab && (
        <div
          data-testid="secondary-tab"
          role="alert"
          className="bg-amber-50 border-b border-amber-200 px-4 py-2.5 text-sm text-amber-900 flex flex-wrap items-center gap-3"
        >
          <span>这场考试已经在另一个标签页里打开了 —— 这里写的答案不会上传。</span>
          <button
            type="button"
            onClick={() => r.claimTabOwnership()}
            className="min-h-[44px] px-3 rounded-lg border border-amber-400 bg-white font-medium"
          >
            在这个标签继续
          </button>
        </div>
      )}

      {r.hasUnverifiedAnswers && (
        <div
          data-testid="unverified"
          role="alert"
          className="bg-rose-50 border-b border-rose-200 px-4 py-2.5 text-sm text-rose-800"
        >
          有一道题的答案还没跟服务器对上 —— 网络恢复后会自动重试，这之前不能交卷。
        </div>
      )}

      {r.saveError && (
        <div
          data-testid="save-error"
          role="alert"
          className="bg-amber-50 border-b border-amber-200 px-4 py-2.5 text-sm text-amber-900"
        >
          刚才有一次保存没成功 —— 答案还在本机上，联网后会自动补传。
        </div>
      )}

      {r.conflictNotice && (
        <div
          data-testid="conflict-notice"
          role="alert"
          className="bg-blue-50 border-b border-blue-200 px-4 py-2.5 text-sm text-blue-900 flex flex-wrap items-center gap-3"
        >
          <span>{r.conflictNotice}</span>
          <button
            type="button"
            onClick={() => r.dismissConflictNotice()}
            className="min-h-[44px] px-3 rounded-lg border border-blue-300 bg-white font-medium"
          >
            知道了
          </button>
        </div>
      )}

      <main className="flex-1 pb-28">
        <ExamFocusProvider value={focus}>
          <ExamRenderer paper={paper} />
        </ExamFocusProvider>
      </main>

      <footer className="app-glass safe-bottom sticky bottom-0 z-20 border-x-0 border-b-0">
        <QuestionNavBar questions={paper.questions} onJumpTo={(qid) => jumpTo(qid)} />
        <div className="px-3 py-2 flex items-center gap-3">
          <span data-testid="flag-count" className="text-sm text-slate-500 tabular-nums">
            已标记 {r.flaggedCount}
          </span>
          <div className="flex-1" />
          {submitError && (
            <span data-testid="submit-error" role="alert" className="text-sm text-rose-700">
              {submitError}
            </span>
          )}
          <button
            type="button"
            data-testid="submit"
            disabled={blocked || submitting}
            onClick={() => setConfirming(true)}
            className="app-primary min-h-[44px] px-5 disabled:bg-slate-300 disabled:shadow-none"
          >
            交卷
          </button>
        </div>
      </footer>

      {confirming && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label="确认交卷"
          className="fixed inset-0 z-40 bg-black/30 backdrop-blur-sm grid place-items-center px-6"
        >
          <div className="app-glass w-full max-w-sm rounded-[22px] p-6">
            <h2 className="text-lg font-semibold mb-2">确定要交卷吗？</h2>
            <p className="text-sm text-slate-600 mb-5">
              {session.secondWindowToday
                ? '交卷之后，今天还有第二个作答时段可以再改。'
                : '交卷之后这份答卷就锁定了，不能再改。'}
            </p>
            <div className="flex gap-3">
              <button
                type="button"
                onClick={() => setConfirming(false)}
                className="flex-1 min-h-[44px] rounded-xl border border-slate-300"
              >
                再想想
              </button>
              <button
                type="button"
                disabled={submitting}
                onClick={() => void doSubmit()}
                className="flex-1 min-h-[44px] rounded-xl bg-blue-600 text-white font-medium disabled:bg-slate-300"
              >
                确认交卷
              </button>
            </div>
          </div>
        </div>
      )}

      {exiting && (
        <div
          data-testid="exit-confirm"
          role="dialog"
          aria-modal="true"
          aria-label="确认退出"
          className="fixed inset-0 z-40 bg-black/30 backdrop-blur-sm grid place-items-center px-6"
        >
          <div className="app-glass w-full max-w-sm rounded-[22px] p-6">
            <h2 className="text-lg font-semibold mb-2">还有答案没保存好</h2>
            <p className="text-sm text-slate-600 mb-5">
              现在离开，这些答案只留在这台设备上。建议等网络恢复、保存完成再走。
            </p>
            <div className="flex gap-3">
              <button
                type="button"
                onClick={() => setExiting(false)}
                className="flex-1 min-h-[44px] rounded-xl border border-slate-300"
              >
                留下
              </button>
              <button
                type="button"
                onClick={() => navigate(ROUTES.today)}
                className="flex-1 min-h-[44px] rounded-xl bg-slate-700 text-white font-medium"
              >
                仍然退出
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
