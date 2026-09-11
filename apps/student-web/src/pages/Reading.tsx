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
import type { ReactNode } from 'react';
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
import { Button } from '../design/Button';
import { Dialog } from '../design/Dialog';
import { FocusHeader } from '../design/Page';
import { StatusView } from '../design/Status';

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
      // 已经交过卷了（后退键 / 直接敲地址回到答题页）：不再摆一张空白卷让
      // 学生以为答案丢了，直接去看结果。
      if (session.finalSubmitted) {
        const sid = session.submissionId ?? submissionId;
        navigate(requestedSessionId && sid ? scoreDetailPath(sid) : ROUTES.readingResult, { replace: true });
        return;
      }
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
    return <StatusView kind="loading" title="载入中" />;
  }

  if (phase.s === 'error') {
    return (
      <main id="main" className="safe-x safe-top mx-auto flex min-h-[100dvh] max-w-md flex-col justify-center">
        <StatusView
          kind="error"
          title="这份阅读没打开"
          message={phase.message}
          onRetry={() => void load()}
          secondary={
            <Button variant="plain" block onClick={() => navigate(ROUTES.today)}>
              回到今日
            </Button>
          }
        />
      </main>
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
            // 4xx 说明服务端在、只是这次请求不对 —— 算通；5xx / 断网 / 超时算不通
            //（审计 UI09：不能把 HTTP 500 当成「服务健康」）。
            return e instanceof ApiError && e.status < 500;
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
  /**
   * 交卷面板的三种状态：
   *   · closed
   *   · confirm —— 确认交卷（写清还有几题空着、哪几题标着「标记」）
   *   · blocked —— 还有答案没上传：先重试保存，上传成功才能交（审计 UI09）
   */
  const [sheet, setSheet] = useState<'closed' | 'confirm' | 'blocked'>('closed');
  const [flushing, setFlushing] = useState(false);
  const [retrying, setRetrying] = useState(false);
  const [exiting, setExiting] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  /**
   * 连点守卫。光靠 `submitting` 这个 state 挡不住：同一个 tick 里连点三下，三次
   * 回调看到的都是上一帧的 `false`。真正的闸门必须是同步生效的 ref。
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
      mode: 'test', // 阅读页恒定 test，不读载荷里的 mode
      rendererKey: session.rendererKey ?? null,
      questions: session.questions,
    }),
    [session],
  );

  const blocked = isSubmitBlocked(r);
  /** 交卷确认要说清楚还有几题空着 —— 盲测时留空一题直接交，弹窗一声不吭。 */
  const unansweredCount = paper.questions.filter((q) => {
    const ans = r.answers[q.id];
    return !(ans?.selectedOption || (ans?.textAnswer && ans.textAnswer.trim()));
  }).length;
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
   * 浏览器返回键：SPA 里按返回是一次路由切换，`beforeunload` 一声不吭。进页面时压一条
   * 哨兵历史记录，返回时如果还有没保存好的东西就把哨兵压回去并弹确认；干净的话正常回首页。
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
  const focus = useMemo(() => ({ qid: focusedQid, request: (qid: string) => setFocusedQid(qid) }), [focusedQid]);

  /** 点「交卷」：先把没落盘的写冲出去；还有没上传的就进 blocked，不弹确认。 */
  const openSubmit = useCallback(async () => {
    setSubmitError(null);
    setFlushing(true);
    try {
      if (r.hasPendingSaves || r.saveError != null || r.hasUnverifiedAnswers) await r.retrySaves();
    } finally {
      setFlushing(false);
    }
    setSheet(isSubmitBlocked(r) ? 'blocked' : 'confirm');
  }, [r]);

  const retryFromSheet = useCallback(async () => {
    setRetrying(true);
    try {
      await r.retrySaves();
    } finally {
      setRetrying(false);
    }
  }, [r]);
  // blocked 面板里重试成功 → 自动换成确认面板
  useEffect(() => {
    if (sheet === 'blocked' && !blocked && !retrying) setSheet('confirm');
  }, [sheet, blocked, retrying]);

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
      // ② 仍有未落盘 / 报错 / 未证实的 → **不发交卷请求**，面板换成「还有答案没上传」
      if (isSubmitBlocked(r)) {
        setSheet('blocked');
        submittingRef.current = false;
        setSubmitting(false);
        return;
      }
      // ③ 交卷。服务端回的答卷 id 就是结果页要定位的那一份（审计 UI11）
      let submittedId = submissionId;
      try {
        const submitted = await api.submitReading(token, session.sessionId, { final: true });
        submittedId = submitted.id ?? submissionId;
      } catch (e) {
        if (!looksAlreadyDone(e)) throw e;
      }
      // ④ 交卷成功 → 固定去看**这一次**的结果。带上会话与答卷 id（路由状态，不进 URL）：
      //    跨午夜交卷时，结果页据此打开刚交的那一份，而不是「新的一天」的课。
      if (historical && submittedId) {
        navigate(scoreDetailPath(submittedId));
      } else {
        navigate(ROUTES.readingResult, {
          state: submittedId ? { justSubmitted: { sessionId: session.sessionId, submissionId: submittedId } } : undefined,
        });
      }
    } catch (e) {
      if (handleAuthFailure(e)) return;
      // 错误显示在交卷面板里 —— 学生正看着的那一层（审计 UI12）
      setSubmitError('交卷没成功 —— 你的答案都在，没有丢。可以再点一次「确认交卷」。');
      submittingRef.current = false;
      setSubmitting(false);
    }
  }, [historical, navigate, r, session.sessionId, submissionId]);

  // 交卷确认里点名是第几题（2026-09-06 第五轮盲测 9：只说「1 题」不说哪题）
  const flaggedNumbers = paper.questions
    .map((q, i) => (r.isFlagged(q.id) ? i + 1 : null))
    .filter((n): n is number => n != null)
    .join('、');

  const saveState = r.isSecondaryTab
    ? '这个标签不上传'
    : r.hasUnverifiedAnswers || r.saveError
      ? `${Math.max(1, r.unsyncedCount)} 题还没上传`
      : r.hasPendingSaves
        ? '正在保存…'
        : '已保存';
  const locked = r.saveError != null && /submission_locked|quiz_window_closed/.test(r.saveError);

  return (
    // 宽屏：整页锁在一屏高，只有两栏内部滚，交卷栏永远看得见（2026-09-06 第五轮盲测 1）。
    // 窄屏：整页滚 + 底部交卷栏。
    <div className="flex min-h-[100dvh] flex-col min-[900px]:h-[100dvh]" style={{ ['--focus-header-h' as string]: '57px' }}>
      <OfflineBadge />

      <FocusHeader
        testId="reading-header"
        backLabel="今日"
        onBack={() => (blocked ? setExiting(true) : navigate(ROUTES.today))}
        title={paper.questions[0] ? passageTitleOf(paper) : '阅读'}
        meta={
          <>
            <span data-testid="reading-level" aria-label={`本次难度：${displayLevel}`}>
              本次难度 · {displayLevel}
            </span>
            <span aria-hidden="true"> · </span>
            <span data-testid="save-state" role="status" aria-live="polite">
              {saveState}
            </span>
          </>
        }
        trailing={<FontSizeAdjuster />}
      />

      {r.isSecondaryTab && (
        <Banner testId="secondary-tab" tone="warning" action={{ label: '在这个标签继续', onClick: () => r.claimTabOwnership() }}>
          这场考试已经在另一个标签页里打开了 —— 这里写的答案不会上传。
        </Banner>
      )}

      {locked ? (
        <Banner
          testId="save-locked"
          tone="warning"
          action={{
            label: '看结果',
            onClick: () => navigate(historical && submissionId ? scoreDetailPath(submissionId) : ROUTES.readingResult),
          }}
        >
          这份卷子已经交了，答案不能再改。
        </Banner>
      ) : r.hasUnverifiedAnswers ? (
        <Banner testId="unverified" tone="danger" action={{ label: retrying ? '正在重试…' : '重试保存', onClick: () => void retryFromSheet(), busy: retrying }}>
          有 {Math.max(1, r.unsyncedCount)} 题的答案还没确认保存到服务器 —— 答案都在这台设备上。
          {r.autoRetryPending ? '稍后会自动重试。' : '点「重试保存」再试一次。'}
        </Banner>
      ) : r.saveError ? (
        <Banner testId="save-error" tone="warning" action={{ label: retrying ? '正在重试…' : '重试保存', onClick: () => void retryFromSheet(), busy: retrying }}>
          刚才有 {Math.max(1, r.unsyncedCount)} 题没保存成功 —— 答案还在这台设备上。
          {r.autoRetryPending ? '稍后会自动重试。' : '点「重试保存」再试一次。'}
        </Banner>
      ) : null}

      {r.conflictNotice && (
        <Banner testId="conflict-notice" tone="info" action={{ label: '知道了', onClick: () => r.dismissConflictNotice() }}>
          {r.conflictNotice}
        </Banner>
      )}

      <main id="main" className="flex-1 pb-4 min-[900px]:min-h-0 min-[900px]:overflow-hidden min-[900px]:pb-0">
        <ExamFocusProvider value={focus}>
          <ExamRenderer paper={paper} />
        </ExamFocusProvider>
      </main>

      <footer className="material-bar safe-bottom sticky bottom-0 z-20 border-t border-line">
        <QuestionNavBar questions={paper.questions} onJumpTo={(qid) => jumpTo(qid)} />
        <div className="safe-x flex items-center gap-3 py-2">
          <span data-testid="flag-count" className="text-footnote text-ink-3 tabular-nums">
            已标记 {r.flaggedCount}
          </span>
          <div className="flex-1" />
          <Button
            data-testid="submit"
            size="md"
            busy={flushing}
            // 保存失败时也能点：点了先重试保存，还不行就说清楚为什么交不了（UI09）。
            // 真正的闸门在 doSubmit 里：有没上传的答案，一个交卷请求都不发。
            disabled={submitting || flushing}
            onClick={() => void openSubmit()}
          >
            {flushing ? '保存中…' : '交卷'}
          </Button>
        </div>
      </footer>

      {/* 确认交卷 */}
      <Dialog
        open={sheet === 'confirm'}
        onClose={() => setSheet('closed')}
        title="确认交卷？"
        busy={submitting}
        size="sm"
        testId="submit-confirm"
        description={session.secondWindowToday ? '交卷之后，今天还有第二个作答时段可以再改。' : '交卷之后这份答卷就锁定了，不能再改。'}
        error={submitError ? <span data-testid="submit-error">{submitError}</span> : null}
        footer={
          <>
            <Button variant="neutral" onClick={() => setSheet('closed')} disabled={submitting}>
              继续答题
            </Button>
            <Button busy={submitting} onClick={() => void doSubmit()}>
              {submitting ? '正在交卷…' : '确认交卷'}
            </Button>
          </>
        }
      >
        {unansweredCount > 0 || r.flaggedCount > 0 ? (
          <p data-testid="submit-warning" className="mb-2 rounded-control bg-warning-soft px-3 py-2 text-callout font-medium text-warning">
            {[
              unansweredCount > 0 ? `还有 ${unansweredCount} 题没作答` : null,
              r.flaggedCount > 0 ? `第 ${flaggedNumbers} 题还标着「标记」` : null,
            ]
              .filter(Boolean)
              .join('，')}
            。
          </p>
        ) : null}
      </Dialog>

      {/* 还有答案没上传：先重试保存 */}
      <Dialog
        open={sheet === 'blocked'}
        onClose={() => setSheet('closed')}
        title="还有答案没上传"
        busy={retrying}
        size="sm"
        testId="submit-blocked"
        description={`有 ${Math.max(1, r.unsyncedCount)} 题只存在这台设备上，还没确认保存到服务器。上传成功才能交卷，答案不会丢。`}
        footer={
          <>
            <Button variant="neutral" onClick={() => setSheet('closed')} disabled={retrying}>
              继续答题
            </Button>
            <Button busy={retrying} onClick={() => void retryFromSheet()}>
              {retrying ? '正在重试…' : '重试保存'}
            </Button>
          </>
        }
      />

      {/* 离开：还有没保存好的答案 */}
      <Dialog
        open={exiting}
        onClose={() => setExiting(false)}
        title="还有答案没保存好"
        size="sm"
        testId="exit-confirm"
        description="现在离开，这些答案只留在这台设备上，回来还能接着上传。建议等保存完成再走。"
        footer={
          <>
            <Button variant="neutral" onClick={() => setExiting(false)}>
              留下继续答题
            </Button>
            <Button variant="destructive" onClick={() => navigate(ROUTES.today)}>
              仍然退出
            </Button>
          </>
        }
      />
    </div>
  );
}

/** 文章标题：卷子里第一题的快照带着。 */
function passageTitleOf(paper: ExamPaper): string {
  const c = paper.questions[0]?.snapshotContent as { passageTitle?: unknown } | undefined;
  return typeof c?.passageTitle === 'string' && c.passageTitle.trim() ? c.passageTitle : '阅读';
}

/** 答题页顶部的一条状态横幅：说清发生了什么、答案在哪、下一步能做什么。 */
function Banner({
  testId,
  tone,
  children,
  action,
}: {
  testId: string;
  tone: 'warning' | 'danger' | 'info';
  children: ReactNode;
  action?: { label: string; onClick: () => void; busy?: boolean };
}) {
  const cls = tone === 'danger' ? 'bg-danger-soft text-danger' : tone === 'warning' ? 'bg-warning-soft text-warning' : 'bg-accent-soft text-ink';
  return (
    <div data-testid={testId} role="alert" className={`border-b border-line ${cls}`}>
      <div className="safe-x mx-auto flex max-w-[1400px] flex-wrap items-center gap-x-3 gap-y-1 py-2 text-callout">
        <span className="min-w-0 flex-1">{children}</span>
        {action ? (
          <button
            type="button"
            onClick={action.onClick}
            disabled={action.busy}
            className="min-h-[44px] shrink-0 rounded-control px-3 font-semibold underline-offset-2 hover:underline"
          >
            {action.label}
          </button>
        ) : null}
      </div>
    </div>
  );
}
