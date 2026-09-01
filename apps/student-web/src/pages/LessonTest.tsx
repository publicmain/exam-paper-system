/**
 * `/lesson/test` —— 正式单词测试（阶段 9B1）。
 *
 * ## 它和「课程学词」不是一回事
 *
 * 学词那一屏是**练**：评错了可以撤销，弱网可以排队补传，怎么都不该丢。
 * 这一屏是**考**：每一次作答当场进成绩单，而且**改不了** —— 服务端第一次
 * 作答为准，重复提交是 no-op。所以这里的每条规矩都往「宁可慢、不可错」
 * 那一边倒：
 *
 *   · **回执没到就不说对错**。作答前服务端不下发答案（S9B0），本地手里
 *     根本没有可比的东西 —— 自己判出来的对错必然是编的。
 *   · **答案没存上就不许往下走**。往下走等于把学生真的选了的答案记成空白，
 *     交卷时按答错算进成绩。
 *   · **退出要二次确认**。半路走人不交卷，但已经存进服务端的答案不会丢。
 *
 * ## 绝不退回自由练习
 *
 * 考不了（`not_ready` / `insufficient_items`）就明说考不了，只给一条回
 * 今天的课的路。旧端在这里 fallback 到自由练习 —— 学生以为在考试，实际
 * 在刷一个不计分的题库，成绩单上什么都没有。
 *
 * ## 出口只有两个
 *
 * `/today` 和 `/lesson/summary`（守卫 G4）。后端下发的 `href` 一概不看。
 */
import { useCallback, useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ApiError, api, type QuizAttempt, type QuizItem } from '../lib/api';
import { handleAuthFailure } from '../lib/auth-store';
import { readToken } from '../lib/identity';
import { ROUTES } from '../routes.contract';

// ─────────────────────────────────────────────────────────────
// 纯逻辑（导出给测试直接驱动）
// ─────────────────────────────────────────────────────────────

/** 一道题**存下来了没有** —— 判据只有一个：服务端给了 `isCorrect`。 */
export function isAnswered(item: QuizItem): boolean {
  return item.isCorrect != null;
}

/**
 * 该从第几题开始。
 *
 * 恢复时落到**第一道还没作答的题**；全答完了返回 `items.length`，
 * 那时页面直接进交卷步骤。
 */
export function firstUnansweredIndex(items: QuizItem[]): number {
  const n = items.findIndex((it) => !isAnswered(it));
  return n < 0 ? items.length : n;
}

/** 作答载荷 —— 选择题和拼写题**二选一**，不许同时带。 */
export type AnswerPayload = { index: number; optionIndex: number } | { index: number; text: string };

// ─────────────────────────────────────────────────────────────
// 状态
// ─────────────────────────────────────────────────────────────

type Phase =
  | { s: 'loading' }
  /** 网络/服务端出错 —— 停在这一页，给重试。 */
  | { s: 'error' }
  /** 今天考不了（词不够 / 还没教过）—— 说清楚，只给回今天的课。 */
  | { s: 'unavailable'; code: string }
  | { s: 'quiz'; attempt: QuizAttempt }
  /** 交完卷的成绩页。 */
  | { s: 'done'; attempt: QuizAttempt };

type Busy = null | 'answer' | 'submit' | 'finish';

export default function LessonTestPage() {
  const navigate = useNavigate();
  const [phase, setPhase] = useState<Phase>({ s: 'loading' });
  const [cursor, setCursor] = useState(0);
  /** 这一题学生选了哪个 / 打了什么 —— 还没送出去的本地输入。 */
  const [chosen, setChosen] = useState<number | null>(null);
  const [typed, setTyped] = useState('');
  const [saveFailed, setSaveFailed] = useState(false);
  const [submitFailed, setSubmitFailed] = useState(false);
  const [busy, setBusy] = useState<Busy>(null);
  const [exitOpen, setExitOpen] = useState(false);
  const [submitOpen, setSubmitOpen] = useState(false);

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

  /** 上一次作答的载荷 —— 重试**原样重发**，不重新拼一遍。 */
  const lastPayload = useRef<AnswerPayload | null>(null);

  // ── 载入：today → 开考 ──
  const load = useCallback(async () => {
    const token = readToken();
    if (!token) return; // 没票不该在这一页，App 的路由守卫会送走
    setPhase({ s: 'loading' });
    try {
      const today = await api.lessonToday(token);
      // **只认 kind，不看 href。**
      const kind = today.nextAction.kind;
      if (kind === 'summary') {
        navigate(ROUTES.summary, { replace: true });
        return;
      }
      if (kind !== 'vocab_test') {
        navigate(ROUTES.today, { replace: true });
        return;
      }
      // 开考是幂等的：已有就原样返回（`resumed: true`）。
      const attempt = await api.quizStart(token);
      setCursor(firstUnansweredIndex(attempt.items));
      setChosen(null);
      setTyped('');
      setSaveFailed(false);
      setSubmitFailed(false);
      setPhase(
        attempt.status === 'submitted' ? { s: 'done', attempt } : { s: 'quiz', attempt },
      );
    } catch (e) {
      if (handleAuthFailure(e)) return;
      if (e instanceof ApiError) {
        const code = String(e.body.code ?? '');
        if (code === 'no_task' || code === 'stage_not_ready') {
          // 这一天还没走到该考的地方 —— 回枢纽，由它决定下一步。
          navigate(ROUTES.today, { replace: true });
          return;
        }
        if (code === 'not_ready' || code === 'insufficient_items') {
          // 今天**考不了**。说清楚，不退回自由练习。
          setPhase({ s: 'unavailable', code });
          return;
        }
      }
      setPhase({ s: 'error' });
    }
  }, [navigate]);

  useEffect(() => {
    void load();
  }, [load]);

  const attempt = phase.s === 'quiz' || phase.s === 'done' ? phase.attempt : null;
  const items = attempt?.items ?? [];
  const inProgress = phase.s === 'quiz';
  const item: QuizItem | null = cursor < items.length ? items[cursor] : null;
  const answered = item != null && isAnswered(item);
  const allAnswered = items.length > 0 && items.every(isAnswered);

  // ── 考试中不许悄悄走人 ──
  //
  // 两条出口各堵一条：关标签页 / 刷新走 `beforeunload`（浏览器自己的
  // 提示），浏览器返回键走 `popstate`（我们自己的确认框）。它们是两个
  // 不同的动作，不是同一个动作弹两次。
  useEffect(() => {
    if (!inProgress) return;
    const onBeforeUnload = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      // 老浏览器要这个返回值才弹
      e.returnValue = '';
      return '';
    };
    // `pushState` 的第三个参数**省略**就是「地址不变」。刻意不写
    // `window.location.href` —— 守卫禁止读任何 `.href`，而这一屏的出口
    // 只由 ROUTES 决定，连当前地址都不需要知道。
    const onPopState = () => {
      // 把这一格历史再推回去，人就还留在考试页上，然后问他确不确定。
      window.history.pushState(null, '');
      setExitOpen(true);
    };
    window.history.pushState(null, '');
    window.addEventListener('beforeunload', onBeforeUnload);
    window.addEventListener('popstate', onPopState);
    return () => {
      window.removeEventListener('beforeunload', onBeforeUnload);
      window.removeEventListener('popstate', onPopState);
    };
  }, [inProgress]);

  // ── 作答 ──
  const sendAnswer = useCallback(
    async (payload: AnswerPayload) => {
      const token = readToken();
      if (!token || !gate('answer')) return;
      lastPayload.current = payload;
      setSaveFailed(false);
      try {
        const res = await api.quizAnswer(token, payload);
        // **整份 items 换成回执里的那份。**
        //
        // 回执里这一题是揭开的（音标 / 释义 / 原句 / 正确项都在），其余
        // 仍然遮着；`accepted: false / already_answered` 时它带的是**第一次
        // 存下来的那个答案** —— 照样按它显示，这正是我们要的。
        setPhase((p) =>
          p.s === 'quiz' ? { s: 'quiz', attempt: { ...p.attempt, items: res.items } } : p,
        );
      } catch (e) {
        if (handleAuthFailure(e)) return;
        // **不自己判对错**：停在这一题，选择留着，给重试。
        setSaveFailed(true);
      } finally {
        release();
      }
    },
    [],
  );

  const onPick = useCallback(
    (optionIndex: number) => {
      if (!item || answered || busyRef.current) return;
      setChosen(optionIndex);
      void sendAnswer({ index: item.index, optionIndex });
    },
    [answered, item, sendAnswer],
  );

  const onSpell = useCallback(() => {
    if (!item || answered || busyRef.current) return;
    const text = typed.trim();
    if (!text) return;
    void sendAnswer({ index: item.index, text });
  }, [answered, item, sendAnswer, typed]);

  const onRetryAnswer = useCallback(() => {
    const p = lastPayload.current;
    if (p) void sendAnswer(p);
  }, [sendAnswer]);

  const onNext = useCallback(() => {
    if (!answered) return; // 没有服务端回执就没有「下一题」
    setCursor((c) => c + 1);
    setChosen(null);
    setTyped('');
    setSaveFailed(false);
  }, [answered]);

  // ── 交卷 ──
  const onSubmit = useCallback(async () => {
    const token = readToken();
    if (!token || !gate('submit')) return;
    setSubmitFailed(false);
    try {
      const res = await api.quizSubmit(token);
      setSubmitOpen(false);
      setPhase({ s: 'done', attempt: res });
    } catch (e) {
      if (handleAuthFailure(e)) return;
      setSubmitOpen(false);
      setSubmitFailed(true);
    } finally {
      release();
    }
  }, []);

  // ── 交完卷之后去哪：**按 kind，不看 href** ──
  const onFinish = useCallback(async () => {
    const token = readToken();
    if (!token || !gate('finish')) return;
    try {
      const today = await api.lessonToday(token);
      navigate(today.nextAction.kind === 'summary' ? ROUTES.summary : ROUTES.today, {
        replace: true,
      });
    } catch (e) {
      if (handleAuthFailure(e)) return;
      // 问不到下一步就回枢纽 —— 它自己会算。**出口仍然只有这两个。**
      navigate(ROUTES.today, { replace: true });
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
          没能打开今天的测试 —— 网络不太好，重试一下。
        </div>
        <Primary testId="retry-load" onClick={() => void load()}>重试</Primary>
        <BackToToday navigate={navigate} />
      </Shell>
    );
  }

  if (phase.s === 'unavailable') {
    return (
      <Shell>
        <div
          role="alert"
          data-testid="unavailable"
          className="rounded-2xl bg-white border border-slate-200 p-6 text-center"
        >
          <p className="text-lg font-medium mb-2">今天还不能考</p>
          <p className="text-sm text-slate-600">
            {phase.code === 'not_ready'
              ? '这次任务的单词还没学过，先去把单词过一遍。'
              : '这次任务能考的单词还不够，明天再看看。'}
          </p>
        </div>
        <BackToToday navigate={navigate} />
      </Shell>
    );
  }

  if (phase.s === 'done') {
    const a = phase.attempt;
    return (
      <Shell>
        <section className="rounded-2xl bg-white border border-slate-200 p-6 text-center">
          <p className="text-sm text-slate-500 mb-1">正式单词测试</p>
          <p data-testid="score" className="text-4xl font-semibold tabular-nums">
            {a.score ?? 0}
            <span className="text-base text-slate-400 ml-1">分</span>
          </p>
          <p data-testid="score-detail" className="mt-2 text-sm text-slate-500 tabular-nums">
            答对 {a.correct} / {a.total}
          </p>
        </section>
        <div className="mt-6">
          <Primary testId="finish" disabled={busy != null} onClick={() => void onFinish()}>
            {busy === 'finish' ? '稍等…' : '下一步'}
          </Primary>
        </div>
      </Shell>
    );
  }

  // ── 考试中 ──
  return (
    <Shell>
      <header className="flex items-center gap-3 mb-4">
        <button
          type="button"
          data-testid="exit"
          onClick={() => setExitOpen(true)}
          className="text-slate-400 text-xl px-1 min-h-[44px]"
          aria-label="退出测试"
        >
          ✕
        </button>
        {/* 旧 testid 保留（既有测试认它）；`quiz-progress` 是 S12L 的新名字。 */}
        <p data-testid="progress" className="text-sm text-slate-500 tabular-nums">
          <span data-testid="quiz-progress">
            {/* 分母用服务端的 `total` —— 与开考那句话是同一个数 */}
            {Math.min(cursor + 1, items.length)} / {attempt?.total ?? items.length}
          </span>
        </p>
        <div className="flex-1" />
        <span data-testid="scored-badge" className="text-xs text-blue-700 bg-blue-50 rounded-md px-2 py-1">
          计入成绩
        </span>
      </header>

      {/*
        S12L —— **开考前就把题数说清楚**。
        以前学了 21 个词、考出来 10 道，界面上一个字都没提；现在题数恒等于
        今天学的词数，那就把这句话摆在最上面，学生不用自己数。
      */}
      <p data-testid="quiz-intro" className="mb-3 text-sm text-slate-600">
        {/* 题数照服务端的 `total`（= 今天学的词数），不自己数手里有几道 */}
        今天学习 {attempt?.total ?? items.length} 个词，本次测试{' '}
        {attempt?.total ?? items.length} 题。
      </p>

      {item ? (
        <Question
          item={item}
          answered={answered}
          busy={busy}
          chosen={chosen}
          typed={typed}
          onPick={onPick}
          onTyped={setTyped}
          onSpell={onSpell}
        />
      ) : (
        <section className="rounded-2xl bg-white border border-slate-200 p-6 text-center">
          {/* S12I —— 题数取自服务端的那份卷子。以前这里写死着「四道题」，
              而头部的进度早就是 `items.length` —— 十题的卷子头上写 10 / 10，
              下面却说「四道题都答完了」。 */}
          <p className="text-lg font-medium">{items.length} 道题都答完了。</p>
          <p className="mt-1 text-sm text-slate-500">交卷之后答案就不能再改了。</p>
        </section>
      )}

      {saveFailed && (
        <div data-testid="answer-failed" className="mt-4">
          <p role="alert" className="text-sm text-rose-700 text-center mb-2">
            这一题还没存上 —— 你的答案还在，点下面重试。
          </p>
          <Primary testId="answer-retry" disabled={busy != null} onClick={onRetryAnswer} tone="rose">
            {busy === 'answer' ? '重试中…' : '重试保存'}
          </Primary>
        </div>
      )}

      {/* 「下一题」**只在服务端回执到了之后**出现。 */}
      {answered && !saveFailed && (
        <div className="mt-4">
          <Primary testId="next" onClick={onNext}>下一题</Primary>
        </div>
      )}

      {!item && allAnswered && (
        <div className="mt-4">
          <Primary testId="submit" disabled={busy != null} onClick={() => setSubmitOpen(true)}>
            交卷
          </Primary>
        </div>
      )}

      {submitFailed && (
        <div data-testid="submit-failed" className="mt-4">
          <p role="alert" className="text-sm text-rose-700 text-center mb-2">
            没能交卷 —— 你的答案都还在，再试一次。
          </p>
          <Primary testId="submit-retry" disabled={busy != null} onClick={() => setSubmitOpen(true)} tone="rose">
            重试交卷
          </Primary>
        </div>
      )}

      {exitOpen && (
        <Dialog title="现在退出？">
          <p className="text-sm text-slate-600">
            已经答过的题都存好了，回来还能接着做。**这次不会交卷。**
          </p>
          <div className="mt-4 grid grid-cols-2 gap-3">
            <Secondary testId="exit-cancel" onClick={() => setExitOpen(false)}>继续考试</Secondary>
            <Primary
              testId="exit-confirm"
              tone="rose"
              onClick={() => {
                setExitOpen(false);
                navigate(ROUTES.today);
              }}
            >
              退出
            </Primary>
          </div>
        </Dialog>
      )}

      {submitOpen && (
        <Dialog title="确认交卷？">
          <p className="text-sm text-slate-600">交完之后答案就改不了了。</p>
          <div className="mt-4 grid grid-cols-2 gap-3">
            <Secondary testId="submit-cancel" onClick={() => setSubmitOpen(false)}>再看看</Secondary>
            <Primary testId="submit-confirm" disabled={busy != null} onClick={() => void onSubmit()}>
              {busy === 'submit' ? '交卷中…' : '确认交卷'}
            </Primary>
          </div>
        </Dialog>
      )}
    </Shell>
  );
}

// ─────────────────────────────────────────────────────────────
// 片段
// ─────────────────────────────────────────────────────────────

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <div className="ui-ios min-h-[100dvh] px-4 py-6 safe-top safe-bottom">
      {/* S12L —— 卡片式的一屏一题：宽屏适度放宽，但不铺满（读起来会太长） */}
      <div className="mx-auto w-full max-w-xl lg:max-w-3xl">{children}</div>
    </div>
  );
}

function Primary({
  testId, children, onClick, disabled, tone,
}: {
  testId: string;
  children: React.ReactNode;
  onClick: () => void;
  disabled?: boolean;
  tone?: 'rose';
}) {
  return (
    <button
      type="button"
      data-testid={testId}
      disabled={disabled}
      onClick={onClick}
      className={`w-full rounded-xl py-3 text-base font-medium min-h-[44px] text-white disabled:bg-slate-300 ${
        tone === 'rose' ? 'bg-rose-600' : 'bg-blue-600'
      }`}
    >
      {children}
    </button>
  );
}

function Secondary({
  testId, children, onClick,
}: {
  testId: string;
  children: React.ReactNode;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      data-testid={testId}
      onClick={onClick}
      className="w-full rounded-xl border border-slate-300 py-3 text-base min-h-[44px]"
    >
      {children}
    </button>
  );
}

function BackToToday({ navigate }: { navigate: ReturnType<typeof useNavigate> }) {
  return (
    <button
      type="button"
      data-testid="back-to-today"
      onClick={() => navigate(ROUTES.today)}
      className="mt-4 w-full rounded-xl border border-slate-300 py-3 text-base min-h-[44px]"
    >
      回到今天的课
    </button>
  );
}

function Dialog({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-black/40 px-4">
      <div role="dialog" aria-modal="true" className="w-full max-w-sm rounded-2xl bg-white p-5">
        <h2 className="text-lg font-semibold mb-2">{title}</h2>
        {children}
      </div>
    </div>
  );
}

/**
 * 一道题。
 *
 * **只用服务端给的材料。** 作答前 `headword` / `phonetic` / `translation` /
 * `contextSentence` / `correctIndex` / `answer` 全是 null，这里一个都不去
 * 推断、不去重建 —— 拼写题连首字母、字数、释义提示都不给（那些都要靠
 * 答案才能算出来）。
 */
function Question({
  item, answered, busy, chosen, typed, onPick, onTyped, onSpell,
}: {
  item: QuizItem;
  answered: boolean;
  busy: Busy;
  chosen: number | null;
  typed: string;
  onPick: (i: number) => void;
  onTyped: (v: string) => void;
  onSpell: () => void;
}) {
  const isSpelling = item.qtype === 'spelling';
  const locked = answered || busy != null;
  const picked = item.studentIndex ?? chosen;

  return (
    <>
      <section
        data-testid="question"
        data-qtype={item.qtype}
        className="rounded-2xl bg-white border border-slate-200 p-6"
      >
        {/*
          S12L —— 拼写 / 填空题的**安全线索**。
          没有它，学生看到的只是一句挖了空的英文。服务端保证线索里不含
          答案；这里原样显示，不推断、不拼接。
        */}
        {item.cue ? (
          <div data-testid="question-cue" className="mb-3 rounded-xl bg-slate-50 px-4 py-3">
            <p className="text-xs text-slate-500">{item.cue.instruction}</p>
            <p className="mt-1 text-base text-slate-800">
              {item.cue.pos ? <span className="text-slate-500 mr-2">{item.cue.pos}</span> : null}
              {item.cue.translation}
            </p>
            {item.cue.definition ? (
              <p className="mt-1 text-sm text-slate-500">{item.cue.definition}</p>
            ) : null}
          </div>
        ) : null}
        <p
          className={
            item.qtype === 'word_to_meaning'
              ? 'text-3xl font-semibold tracking-tight break-words'
              : item.qtype === 'meaning_to_word'
                ? 'text-2xl font-semibold leading-snug'
                : 'text-base leading-relaxed font-serif text-slate-800'
          }
        >
          {item.prompt}
        </p>
      </section>

      {isSpelling ? (
        !answered && (
          <form
            className="mt-4"
            onSubmit={(e) => {
              e.preventDefault();
              onSpell();
            }}
          >
            <input
              data-testid="spelling-input"
              type="text"
              value={typed}
              onChange={(e) => onTyped(e.target.value)}
              disabled={locked}
              autoCapitalize="off"
              autoCorrect="off"
              autoComplete="off"
              spellCheck={false}
              aria-label="输入这个单词"
              className="w-full rounded-xl border-2 border-slate-300 px-4 py-3 text-lg tracking-wide"
            />
            <button
              type="submit"
              data-testid="spelling-submit"
              disabled={locked || !typed.trim()}
              className="mt-3 w-full rounded-xl bg-blue-600 text-white py-3 text-base font-medium min-h-[44px] disabled:bg-slate-300"
            >
              提交这一题
            </button>
          </form>
        )
      ) : (
        <div className="mt-4 flex flex-col gap-3" role="group" aria-label="选项">
          {item.options.map((opt, idx) => {
            let cls = 'bg-white border-slate-200';
            if (answered) {
              if (item.correctIndex === idx) cls = 'bg-green-50 border-green-500 text-green-900';
              else if (item.studentIndex === idx) cls = 'bg-rose-50 border-rose-400 text-rose-900';
              else cls = 'bg-white border-slate-200 text-slate-400';
            } else if (picked === idx) {
              // 还在等回执：**只显示他选了哪个**，一个字的对错都不说。
              cls = 'bg-blue-50 border-blue-400 text-blue-900';
            }
            return (
              <button
                key={idx}
                type="button"
                data-testid={`option-${idx}`}
                data-chosen={picked === idx ? 'true' : 'false'}
                disabled={locked}
                onClick={() => onPick(idx)}
                className={`w-full rounded-xl border-2 px-4 py-3 text-left text-base min-h-[44px] ${cls}`}
              >
                {opt}
                {answered && item.correctIndex === idx && <span className="float-right">✓</span>}
                {answered && item.studentIndex === idx && item.correctIndex !== idx && (
                  <span className="float-right">✗</span>
                )}
              </button>
            );
          })}
        </div>
      )}

      {/* 判定卡 —— **只在服务端回执到了之后**出现，内容全部来自回执。 */}
      {answered && (
        <section
          data-testid="feedback"
          className={`mt-4 rounded-2xl px-4 py-3 border ${
            item.isCorrect ? 'bg-green-50 border-green-200' : 'bg-rose-50 border-rose-200'
          }`}
        >
          <p className={`font-semibold ${item.isCorrect ? 'text-green-800' : 'text-rose-800'}`}>
            {item.isCorrect ? '答对了' : '答错了'}
          </p>
          {isSpelling && item.answer && (
            <p className="mt-1 text-lg font-semibold tracking-wide">
              {item.answer}
              {!item.isCorrect && item.studentAnswer && (
                <span className="ml-3 text-sm font-normal text-rose-700 line-through">
                  {item.studentAnswer}
                </span>
              )}
            </p>
          )}
          <p className="mt-1 text-sm text-slate-700">
            {item.headword && <span className="font-semibold">{item.headword}</span>}
            {item.phonetic && <span className="text-slate-500 ml-2">/{item.phonetic}/</span>}
            {item.translation && <span className="ml-2">{item.translation}</span>}
          </p>
          {!item.isCorrect && item.contextSentence && (
            <p className="mt-1 text-sm text-slate-600 font-serif leading-relaxed">
              {item.contextSentence}
            </p>
          )}
        </section>
      )}
    </>
  );
}
