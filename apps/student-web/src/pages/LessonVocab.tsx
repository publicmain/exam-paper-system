/**
 * `/lesson/vocab` —— 学习本次单词（阶段 9A）。
 *
 * ## 这一屏只做「课程学词」
 *
 * 固定队列、首次教学、复习卡、断点恢复、弱网补传。**正式单词测试是
 * 另一条路由**（`/lesson/test`，阶段 9B），自由练习 / 自测 / 错题重练
 * 也都不在这里 —— 它们与课程线共用 FSRS，但队列来源完全不同。
 *
 * ## 队列从哪来：只有一个入口
 *
 * `GET /lesson/today`（必须是 `learn_vocab`）→ `GET /vocab/lesson-cards`
 * （必须 `lessonContext: true` 且有卡）。任何一条不满足就 replace 回
 * `/today`，**绝不退回 `/vocab/due` 的自由练习队列**。
 *
 * 这条是硬规矩。旧端的写法是「没有课程队列就 fallback 到自由练习」——
 * 学生以为在上今天的课，实际在刷一个完全不同的词表，课程完成度永远
 * 不动。新端宁可什么都不给，也不给错的东西。
 *
 * ## 顺序、张数、断点，服务端说了算
 *
 * `cards` 的数组顺序**就是**发卡顺序（服务端的 `lessonCardOrder` 已经排
 * 好），前端不按 due / reps / 时间戳重排，也不过滤。分母固定成进入这一屏
 * 时的张数 —— 中途变分母，进度条会往回跳。
 *
 * ## 两种卡
 *
 * `needsFirstTeaching: true` → **教学卡**：把词摊开给学生看（不遮、不猜、
 * 没有评分按钮、不写 FSRS），「下一个」只打 `/lesson/vocab-taught`。
 * `false` → **复习卡**：先给中文提示 + 挖空例句，「显示答案」之后才给
 * 两档评分。
 *
 * ## 评分一定落地
 *
 * 每一次评分先入队再发（见 `lib/review-queue.ts`）。还有没补传完的评分时，
 * 完成页**不放人进正式测试** —— 那会让一次没记上的复习变成永久丢失。
 */
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  api,
  type CourseRating,
  type LessonCard,
  type VocabReviewResult,
} from '../lib/api';
import { handleAuthFailure } from '../lib/auth-store';
import { readToken } from '../lib/identity';
import {
  advanceCursor,
  clampCursor,
  concealTarget,
  dwellSatisfied,
  elapsedFrom,
  MIN_DWELL_MS,
} from '../lib/vocab-card';
import { flushPending, pendingCount, submitCourseReview } from '../lib/review-queue';
import { ROUTES } from '../routes.contract';

// ─────────────────────────────────────────────────────────────
// 状态
// ─────────────────────────────────────────────────────────────

type Phase =
  | { s: 'loading' }
  | { s: 'error' }
  | { s: 'ready'; cards: LessonCard[] };

type Busy = null | 'teach' | 'review' | 'undo' | 'sync';

/** 一次评分之后给学生看的回执。 */
type Receipt =
  | { kind: 'ok'; headword: string; result: VocabReviewResult; canUndo: boolean }
  | { kind: 'queued'; headword: string }
  | { kind: 'tooFast'; headword: string }
  | { kind: 'failed' };

export default function LessonVocabPage() {
  const navigate = useNavigate();
  const [phase, setPhase] = useState<Phase>({ s: 'loading' });
  const [cursor, setCursor] = useState(0);
  const [revealedAt, setRevealedAt] = useState<number | null>(null);
  const [dwellOk, setDwellOk] = useState(false);
  const [busy, setBusy] = useState<Busy>(null);
  const [receipt, setReceipt] = useState<Receipt | null>(null);
  const [stepError, setStepError] = useState<string | null>(null);
  const [pending, setPending] = useState(0);

  /**
   * 同步闸门。`busy` 是 React 状态，同一帧里连点两下时第二下看到的还是
   * 上一帧的 `null` —— 两个请求就都发出去了。闸必须同步生效。
   */
  const busyRef = useRef<Busy>(null);
  const gate = (kind: Exclude<Busy, null>): boolean => {
    if (busyRef.current) return false;
    busyRef.current = kind;
    setBusy(kind);
    return true;
  };
  const release = () => {
    busyRef.current = null;
    setBusy(null);
  };

  const syncPending = useCallback(() => setPending(pendingCount()), []);

  // ── 载入：today → lesson-cards ──
  const load = useCallback(async () => {
    const token = readToken();
    if (!token) return; // 没票不该在这一页，App 的路由守卫会送走
    setPhase({ s: 'loading' });
    try {
      const today = await api.lessonToday(token);
      if (today.nextAction.kind !== 'learn_vocab') {
        // 今天这一段不该在这里 —— 回枢纽，由它决定下一步。**不看 href。**
        navigate(ROUTES.today, { replace: true });
        return;
      }
      const res = await api.lessonCards(token);
      if (!res.lessonContext || !Array.isArray(res.cards) || res.cards.length === 0) {
        // 没有冻结的课程队列。**不退回自由练习** —— 见文件头。
        navigate(ROUTES.today, { replace: true });
        return;
      }
      setPhase({ s: 'ready', cards: res.cards });
      setCursor(clampCursor(res.cursor, res.cards.length));
      setRevealedAt(null);
      setDwellOk(false);
      setReceipt(null);
      setStepError(null);
      syncPending();
    } catch (e) {
      if (handleAuthFailure(e)) return;
      setPhase({ s: 'error' });
    }
  }, [navigate, syncPending]);

  useEffect(() => {
    void load();
  }, [load]);

  // ── 启动补传 + 回到线上时补传 ──
  useEffect(() => {
    const run = async () => {
      const token = readToken();
      if (!token) return;
      try {
        await flushPending(token);
      } catch (e) {
        if (handleAuthFailure(e)) return;
      }
      syncPending();
    };
    void run();
    const onOnline = () => void run();
    window.addEventListener('online', onOnline);
    return () => window.removeEventListener('online', onOnline);
  }, [syncPending]);

  // ── 停留计时：答案露出 1.5 秒后才解锁评分 ──
  useEffect(() => {
    if (revealedAt == null) {
      setDwellOk(false);
      return;
    }
    if (dwellSatisfied(revealedAt, Date.now())) {
      setDwellOk(true);
      return;
    }
    const t = setTimeout(() => setDwellOk(true), MIN_DWELL_MS);
    return () => clearTimeout(t);
  }, [revealedAt]);

  const cards = phase.s === 'ready' ? phase.cards : [];
  /** 分母**固定**成进入这一屏时的张数 —— 中途变分母进度条会往回跳。 */
  const total = cards.length;
  const card = cursor < total ? cards[cursor] : null;

  const goNext = useCallback(
    (serverCursor: number) => {
      setCursor((c) => advanceCursor(c, serverCursor, total));
      setRevealedAt(null);
      setDwellOk(false);
      setStepError(null);
    },
    [total],
  );

  // ── 教学卡「下一个」 ──
  const onTaught = useCallback(async () => {
    if (!card || !gate('teach')) return;
    const token = readToken();
    if (!token) return;
    setStepError(null);
    try {
      const res = await api.vocabTaught(token, { headword: card.headword, cursor: cursor + 1 });
      if (!res.stored) {
        // 断点没落库 —— **不假装成功**，也不推进。学生重试即可。
        setStepError('进度没有保存下来，再点一次。');
        return;
      }
      goNext(res.cursor);
    } catch (e) {
      if (handleAuthFailure(e)) return;
      setStepError('没能保存 —— 网络不太好，再点一次。');
    } finally {
      release();
    }
  }, [card, cursor, goNext]);

  // ── 复习卡评分 ──
  const onRate = useCallback(
    async (rating: CourseRating) => {
      if (!card || revealedAt == null || !dwellOk || !gate('review')) return;
      const token = readToken();
      if (!token) return;
      setStepError(null);
      const elapsedMs = elapsedFrom(revealedAt, Date.now());
      try {
        const out = await submitCourseReview(token, {
          headword: card.headword,
          rating,
          elapsedMs,
          cursor: cursor + 1,
        });
        syncPending();
        if (out.status === 'invalid') {
          setStepError('这个词现在评不了分 —— 先跳过，回头找老师看看。');
          return;
        }
        if (out.status === 'queued') {
          // 已经落盘，一定会补传 —— 但**不能说服务端已经记下了**。
          setReceipt({ kind: 'queued', headword: card.headword });
          goNext(cursor + 1);
          return;
        }
        if (out.result.tooFast) {
          // 服务端没写调度，这张卡下次还会回来 —— **不推进、不算学过**。
          setReceipt({ kind: 'tooFast', headword: card.headword });
          setRevealedAt(Date.now());
          setDwellOk(false);
          return;
        }
        setReceipt({
          kind: 'ok',
          headword: card.headword,
          result: out.result,
          // 重发命中去重的那一条不给撤销 —— 撤的会是**原来那次**评分。
          canUndo: out.result.duplicate !== true,
        });
        goNext(cursor + 1);
      } catch (e) {
        if (handleAuthFailure(e)) return;
        setReceipt({ kind: 'failed' });
        setStepError('没能提交这次评分，再试一次。');
      } finally {
        release();
      }
    },
    [card, cursor, dwellOk, goNext, revealedAt, syncPending],
  );

  // ── 撤销 ──
  const onUndo = useCallback(async () => {
    if (!receipt || receipt.kind !== 'ok' || !receipt.canUndo || !gate('undo')) return;
    const token = readToken();
    if (!token) return;
    try {
      await api.vocabReviewUndo(token, { headword: receipt.headword });
      // 回到那张卡。**不跳转、不离开课程路由。**
      setCursor((c) => Math.max(0, c - 1));
      setRevealedAt(null);
      setDwellOk(false);
      setReceipt(null);
    } catch (e) {
      if (handleAuthFailure(e)) return;
      setStepError('撤销没成功，再试一次。');
    } finally {
      release();
    }
  }, [receipt]);

  // ── 完成页的「继续同步」 ──
  const onSync = useCallback(async () => {
    if (!gate('sync')) return;
    const token = readToken();
    if (!token) return;
    try {
      await flushPending(token);
    } catch (e) {
      if (handleAuthFailure(e)) return;
    } finally {
      syncPending();
      release();
    }
  }, [syncPending]);

  // ── 全部处理完之后去哪：**按 kind，不看 href** ──
  const onFinish = useCallback(async () => {
    if (!gate('sync')) return;
    const token = readToken();
    if (!token) return;
    try {
      const today = await api.lessonToday(token);
      const kind = today.nextAction.kind;
      if (kind === 'vocab_test') navigate(ROUTES.lessonTest);
      else if (kind === 'summary') navigate(ROUTES.summary);
      else navigate(ROUTES.today);
    } catch (e) {
      if (handleAuthFailure(e)) return;
      setStepError('没能确认下一步 —— 再试一次。');
    } finally {
      release();
    }
  }, [navigate]);

  // ─────────────────────────────────────────────────────────
  // 渲染
  // ─────────────────────────────────────────────────────────

  if (phase.s === 'loading') {
    return (
      <div className="min-h-[100dvh] grid place-items-center bg-slate-50">
        <p className="text-slate-400">载入中…</p>
      </div>
    );
  }

  if (phase.s === 'error') {
    return (
      <Shell>
        <div role="alert" className="rounded-xl bg-rose-50 text-rose-700 px-4 py-3 text-sm mb-4">
          没能打开今天的单词 —— 网络不太好，重试一下。
        </div>
        <button
          type="button"
          data-testid="retry-load"
          onClick={() => void load()}
          className="w-full rounded-xl bg-blue-600 text-white py-3 text-base font-medium min-h-[44px]"
        >
          重试
        </button>
        <LaterButton navigate={navigate} />
      </Shell>
    );
  }

  if (!card) {
    return (
      <Shell>
        <Progress done={total} total={total} />
        <section
          data-testid="complete"
          className="rounded-2xl bg-white border border-slate-200 p-6 text-center"
        >
          <p className="text-lg font-medium mb-2">这一课的单词都过完了。</p>
          {pending > 0 ? (
            <>
              <p data-testid="pending-sync" className="text-sm text-amber-800 bg-amber-50 rounded-xl px-3 py-2 mb-3">
                还有 {pending} 条评分没同步上去 —— 同步完才能进正式测试，别关掉这一页。
              </p>
              <button
                type="button"
                data-testid="sync-now"
                disabled={busy != null}
                onClick={() => void onSync()}
                className="w-full rounded-xl bg-blue-600 text-white py-3 text-base font-medium min-h-[44px] disabled:bg-slate-300"
              >
                {busy === 'sync' ? '同步中…' : '现在同步'}
              </button>
            </>
          ) : (
            <button
              type="button"
              data-testid="finish"
              disabled={busy != null}
              onClick={() => void onFinish()}
              className="w-full rounded-xl bg-blue-600 text-white py-3 text-base font-medium min-h-[44px] disabled:bg-slate-300"
            >
              下一步
            </button>
          )}
          {stepError && (
            <p role="alert" data-testid="step-error" className="mt-3 text-sm text-rose-700">
              {stepError}
            </p>
          )}
        </section>
        <LaterButton navigate={navigate} />
      </Shell>
    );
  }

  return (
    <Shell>
      <Progress done={cursor} total={total} />
      {pending > 0 && (
        <p data-testid="pending-badge" className="mb-3 text-xs text-amber-800 bg-amber-50 rounded-lg px-3 py-2">
          有 {pending} 条评分排队等着同步 —— 网络恢复后会自动补上。
        </p>
      )}

      {card.needsFirstTeaching ? (
        <TeachingCard card={card} busy={busy} onNext={() => void onTaught()} />
      ) : (
        <ReviewCard
          card={card}
          busy={busy}
          revealed={revealedAt != null}
          dwellOk={dwellOk}
          onReveal={() => setRevealedAt(Date.now())}
          onRate={(r) => void onRate(r)}
        />
      )}

      {stepError && (
        <p role="alert" data-testid="step-error" className="mt-3 text-sm text-rose-700">
          {stepError}
        </p>
      )}
      <ReceiptBar receipt={receipt} busy={busy} onUndo={() => void onUndo()} />
      <LaterButton navigate={navigate} />
    </Shell>
  );
}

// ─────────────────────────────────────────────────────────────
// 片段
// ─────────────────────────────────────────────────────────────

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-[100dvh] bg-slate-50 px-4 py-6">
      <div className="mx-auto w-full max-w-xl">{children}</div>
    </div>
  );
}

function Progress({ done, total }: { done: number; total: number }) {
  return (
    <p data-testid="progress" className="mb-4 text-sm text-slate-500 tabular-nums">
      {Math.min(done, total)} / {total}
    </p>
  );
}

/** 次要出口。**不写任何教学 / 评分 / 断点**，就是走人。 */
function LaterButton({ navigate }: { navigate: ReturnType<typeof useNavigate> }) {
  return (
    <button
      type="button"
      data-testid="later"
      onClick={() => navigate(ROUTES.today)}
      className="mt-6 w-full rounded-xl border border-slate-300 py-3 text-base min-h-[44px]"
    >
      稍后再学
    </button>
  );
}

/**
 * 教学卡 —— **摊开给人看**。
 *
 * 不遮词、不让猜、没有评分按钮、没有跳过。第一次见这个词的人被要求
 * 「评价自己记得多牢」是没有意义的，那正是旧端把新词直接扔进 FSRS
 * 造成的问题。
 */
function TeachingCard({
  card,
  busy,
  onNext,
}: {
  card: LessonCard;
  busy: Busy;
  onNext: () => void;
}) {
  return (
    <section
      data-testid="teaching-card"
      data-headword={card.headword}
      className="rounded-2xl bg-white border border-slate-200 p-6"
    >
      <p className="text-xs text-blue-700 bg-blue-50 rounded-md px-2 py-1 inline-block mb-3">
        新词 · 先认识一下
      </p>
      <h1 data-testid="headword" className="text-3xl font-semibold tracking-tight">
        {card.headword}
      </h1>
      <p className="mt-1 text-slate-500">
        {card.phonetic && <span data-testid="phonetic">/{card.phonetic}/</span>}
        {card.pos && <span data-testid="pos" className="ml-2 italic">{card.pos}</span>}
      </p>
      {card.translation && (
        <p data-testid="translation" className="mt-3 text-lg">
          {card.translation}
        </p>
      )}
      {card.definition && (
        <p data-testid="definition" className="mt-2 text-sm text-slate-600">
          {card.definition}
        </p>
      )}
      {card.contextSentence && (
        // 教学卡**不挖空** —— 看见词在句子里怎么用，才是这张卡的意义。
        <p data-testid="context" className="mt-4 text-sm bg-slate-50 rounded-xl px-3 py-2 leading-relaxed">
          {card.contextSentence}
        </p>
      )}
      {card.sourcePassageTitle && (
        <p data-testid="source" className="mt-2 text-xs text-slate-400">
          来自：{card.sourcePassageTitle}
        </p>
      )}
      <button
        type="button"
        data-testid="taught-next"
        disabled={busy != null}
        onClick={onNext}
        className="mt-6 w-full rounded-xl bg-blue-600 text-white py-3 text-base font-medium min-h-[44px] disabled:bg-slate-300"
      >
        {busy === 'teach' ? '保存中…' : '下一个'}
      </button>
    </section>
  );
}

function ReviewCard({
  card,
  busy,
  revealed,
  dwellOk,
  onReveal,
  onRate,
}: {
  card: LessonCard;
  busy: Busy;
  revealed: boolean;
  dwellOk: boolean;
  onReveal: () => void;
  onRate: (r: CourseRating) => void;
}) {
  const cloze = useMemo(
    () => concealTarget(card.contextSentence, card.headword, card.surfaceForm),
    [card.contextSentence, card.headword, card.surfaceForm],
  );

  return (
    <section
      data-testid="review-card"
      data-headword={card.headword}
      className="rounded-2xl bg-white border border-slate-200 p-6"
    >
      {!revealed ? (
        <>
          {card.translation ? (
            <p data-testid="hint" className="text-xl font-medium">
              {card.translation}
            </p>
          ) : (
            <p data-testid="hint-missing" className="text-slate-400">
              想想这个词
            </p>
          )}
          {cloze.text ? (
            <p data-testid="cloze" className="mt-4 text-sm bg-slate-50 rounded-xl px-3 py-2 leading-relaxed">
              {cloze.text}
            </p>
          ) : (
            // 遮不干净就整句不给 —— 少一句例句，好过把答案印在题面上。
            <p data-testid="cloze-withheld" className="mt-4 text-xs text-slate-400">
              （这句例句里藏不住答案，先不显示）
            </p>
          )}
          {card.sourcePassageTitle && (
            <p data-testid="source" className="mt-2 text-xs text-slate-400">
              来自：{card.sourcePassageTitle}
            </p>
          )}
          <button
            type="button"
            data-testid="reveal"
            onClick={onReveal}
            className="mt-6 w-full rounded-xl bg-slate-900 text-white py-3 text-base font-medium min-h-[44px]"
          >
            显示答案
          </button>
        </>
      ) : (
        <>
          <h1 data-testid="headword" className="text-3xl font-semibold tracking-tight">
            {card.headword}
          </h1>
          <p className="mt-1 text-slate-500">
            {card.phonetic && <span data-testid="phonetic">/{card.phonetic}/</span>}
            {card.pos && <span data-testid="pos" className="ml-2 italic">{card.pos}</span>}
          </p>
          {card.translation && (
            <p data-testid="translation" className="mt-3 text-lg">
              {card.translation}
            </p>
          )}
          {card.sourcePassageTitle && (
            <p data-testid="source" className="mt-2 text-xs text-slate-400">
              来自：{card.sourcePassageTitle}
            </p>
          )}

          {!dwellOk && (
            <p data-testid="dwell-lock" className="mt-4 text-xs text-slate-400">
              再看一眼…
            </p>
          )}
          {/* 课程线只有两档。四档在手机上挨得太近，误触是常态。 */}
          <div className="mt-4 grid grid-cols-2 gap-3">
            <button
              type="button"
              data-testid="rate-again"
              disabled={!dwellOk || busy != null}
              onClick={() => onRate('again')}
              className="rounded-xl border border-rose-300 text-rose-700 py-3 text-base font-medium min-h-[44px] disabled:opacity-40"
            >
              还不会
            </button>
            <button
              type="button"
              data-testid="rate-good"
              disabled={!dwellOk || busy != null}
              onClick={() => onRate('good')}
              className="rounded-xl bg-green-600 text-white py-3 text-base font-medium min-h-[44px] disabled:bg-slate-300"
            >
              记住了
            </button>
          </div>
        </>
      )}
    </section>
  );
}

function ReceiptBar({
  receipt,
  busy,
  onUndo,
}: {
  receipt: Receipt | null;
  busy: Busy;
  onUndo: () => void;
}) {
  if (!receipt) return null;
  if (receipt.kind === 'queued') {
    return (
      <p data-testid="receipt-queued" className="mt-3 text-sm text-amber-800 bg-amber-50 rounded-xl px-3 py-2">
        「{receipt.headword}」已经存下来了，等网络好了自动同步。
      </p>
    );
  }
  if (receipt.kind === 'tooFast') {
    return (
      <p data-testid="receipt-too-fast" className="mt-3 text-sm text-amber-800 bg-amber-50 rounded-xl px-3 py-2">
        这次太快了，这一张先不算 —— 再看一眼「{receipt.headword}」。
      </p>
    );
  }
  if (receipt.kind === 'failed') return null;
  return (
    <div data-testid="receipt-ok" className="mt-3 flex items-center gap-3 text-sm bg-slate-50 rounded-xl px-3 py-2">
      <span className="text-slate-600">
        「{receipt.headword}」下次 {receipt.result.intervalDays} 天后再见。
      </span>
      {receipt.canUndo && (
        <button
          type="button"
          data-testid="undo"
          disabled={busy != null}
          onClick={onUndo}
          className="ml-auto underline text-slate-500 min-h-[44px] px-2"
        >
          点错了，撤销
        </button>
      )}
    </div>
  );
}
