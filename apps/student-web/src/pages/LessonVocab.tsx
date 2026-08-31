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
 * ## S12L —— 课程内**只有教学卡**
 *
 * 每一张都是把词摊开给学生看（不遮、不猜、没有评分按钮、不写 FSRS），
 * 「下一个」只打 `/lesson/vocab-taught`（幂等，教过的词再点也不写第二次）。
 *
 * 以前 `needsFirstTeaching: false` 的词会发挖空复习卡 + 两档评分。一个
 * 用了两周的学生，二十一张里有十五张因此变成突击测验 —— 他还没被教
 * 今天这批词，就先被考了。主动回忆搬去了**自由复习**
 * （`/vocab/practice`），那里是他自己选着去练的。
 *
 * ## 评分一定落地
 *
 * 每一次评分先入队再发（见 `lib/review-queue.ts`）。还有没补传完的评分时，
 * 完成页**不放人进正式测试** —— 那会让一次没记上的复习变成永久丢失。
 */
import { useCallback, useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api, type LessonCard } from '../lib/api';
import { handleAuthFailure } from '../lib/auth-store';
import { readToken } from '../lib/identity';
import { advanceCursor, clampCursor } from '../lib/vocab-card';
import { flushPending, pendingCount } from '../lib/review-queue';
import { ROUTES } from '../routes.contract';

// ─────────────────────────────────────────────────────────────
// 状态
// ─────────────────────────────────────────────────────────────

type Phase =
  | { s: 'loading' }
  | { s: 'error' }
  | { s: 'ready'; cards: LessonCard[] };

type Busy = null | 'teach' | 'sync';

export default function LessonVocabPage() {
  const navigate = useNavigate();
  const [phase, setPhase] = useState<Phase>({ s: 'loading' });
  const [cursor, setCursor] = useState(0);
  const [busy, setBusy] = useState<Busy>(null);
  const [stepError, setStepError] = useState<string | null>(null);
  const [pending, setPending] = useState(0);

  /**
   * 同步闸门。`busy` 是 React 状态，同一帧里连点两下时第二下看到的还是
   * 上一帧的 `null` —— 两个请求就都发出去了。闸必须同步生效。
   */
  //
  // 顺序也重要：**先取令牌再上闸**。反过来的话，令牌恰好读不到时（比如
  // localStorage 整个不可用）闸已经上了却直接 return，`release()` 在 try 的
  // finally 里永远走不到 —— 这一屏从此谁也点不动。
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

  const cards = phase.s === 'ready' ? phase.cards : [];
  /** 分母**固定**成进入这一屏时的张数 —— 中途变分母进度条会往回跳。 */
  const total = cards.length;
  const card = cursor < total ? cards[cursor] : null;

  const goNext = useCallback(
    (serverCursor: number) => {
      setCursor((c) => advanceCursor(c, serverCursor, total));
      setStepError(null);
    },
    [total],
  );

  // ── 教学卡「下一个」 ──
  const onTaught = useCallback(async () => {
    const token = readToken();
    if (!card || !token || !gate('teach')) return;
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

  // S12L —— 课程内的**评分与撤销已经移走**（见文件头）。主动回忆现在只
  // 发生在自由复习 `/vocab/practice`；那里的评分、撤销、弱网补传一条
  // 都没删，覆盖它们的是 `__tests__/vocab-practice.test.tsx`。

  // ── 完成页的「继续同步」 ──
  const onSync = useCallback(async () => {
    const token = readToken();
    if (!token || !gate('sync')) return;
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
    const token = readToken();
    if (!token || !gate('sync')) return;
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

      {/*
        S12L —— 课程内**每一张都是教学卡**，包括以前见过的词。

        旧行为：`needsFirstTeaching: false` 的词发挖空复习卡 + 两档评分。
        于是「学习本次单词」这一步对一个用了两周的学生来说，二十一张里
        有十五张是突击测验 —— 他还没被教今天这批词，就先被考了。

        主动回忆没有被删掉，它搬去了**自由复习**（`/vocab/practice`），
        那里学生是自己选着去练的。课程内这一段只负责「认识它」。

        代价是老实的：`onRate` / `ReviewCard` / 停留计时这些仍然编译在
        文件里但课程内走不到（弱网补传队列还要用 `onRate` 的那条路）。
        恢复时把这一行改回条件分支即可。
      */}
      <TeachingCard card={card} busy={busy} onNext={() => void onTaught()} />

      {stepError && (
        <p role="alert" data-testid="step-error" className="mt-3 text-sm text-rose-700">
          {stepError}
        </p>
      )}
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
      {/* S12L —— 卡片式的一屏一题：宽屏适度放宽，但不铺满（读起来会太长） */}
      <div className="mx-auto w-full max-w-xl lg:max-w-3xl">{children}</div>
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
