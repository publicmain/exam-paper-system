/**
 * `/vocab/selftest` —— 生词自测（阶段 12A）。
 *
 * ## 自测不是正式测试
 *
 * 这一屏吃 `GET /vocab/quiz`，**永远不碰** `/vocab/quiz/attempt/*` ——
 * 那三条是**正式单词测试**（`/lesson/test`）：开一次 attempt、逐题落库、
 * 交卷算分、进历史成绩。自测是自由练习：学生想练就练，练十遍也不该在
 * 成绩单上留下十条记录。两条线用路由和端点分开，是 D5 的原话。
 *
 * 一个能直接看出差别的细节：自测的题目**当场就带着 `correctIndex` /
 * `answer`**，判定在本地做；正式测试恰恰相反 —— 答案要等作答回执才逐题
 * 揭开（S9B0 的整个用意）。所以两边的类型也不共用。
 *
 * ## 每道题第一遍最多写一次 FSRS
 *
 * 第一遍对 → `good`，错 → `again`（与后端注释里的既定口径一致）。
 * **末尾重做错题不再写** —— 同一道题写两次，FSRS 会把间隔算歪；而重做的
 * 意义是「再看一眼」，不是「再评一次」。
 *
 * ## 写失败不吞，而且走不掉
 *
 * 判定照常显示（那是本地算的，跟网络无关），但下面明说「这一次还没记上」
 * 并给一个重试；重试**用同一个 `requestId`**，服务端据此去重。
 *
 * 而且这一题**闭锁**（返工 1/2 B-2）：写入还在路上、或者失败了，
 * 「下一题」一律不接受。否则那次写入就和界面脱了钩 —— 重试按钮挂在一道
 * 已经翻过去的题上，学生也无从知道自己刚才那题到底算没算。
 * 重做那一轮不写 FSRS，所以不受这条约束。
 */
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  api,
  type PracticeRating,
  type VocabSelfTestQuestion,
} from '../lib/api';
import { handleAuthFailure } from '../lib/auth-store';
import { readToken } from '../lib/identity';
import { ROUTES } from '../routes.contract';
import {
  elapsedSince,
  newRequestId,
  spellingMatches,
  type PendingWrite,
} from '../components/vocab/practice-write';
import { Button, Card, Notice, Screen, TopBar } from '../ui';

// ─────────────────────────────────────────────────────────────
// 纯逻辑（导出给测试直接驱动）
// ─────────────────────────────────────────────────────────────

/** 第一遍的判定 → FSRS 档位。**只有这两档**，中间没有灰色地带。 */
export function ratingFor(correct: boolean): PracticeRating {
  return correct ? 'good' : 'again';
}

/** 这道题的正确答案，用来在答错时显示。拼写题看 `answer`，其余看选项。 */
export function correctTextOf(q: VocabSelfTestQuestion): string {
  if (q.qtype === 'spelling') return q.answer ?? '';
  return q.options[q.correctIndex] ?? '';
}

/** 空态该说什么 —— **有词但没学过**和**一个词都没有**是两回事。 */
export function emptyReason(totalWords: number, seenWords: number): string {
  if (totalWords === 0) return '生词本还是空的 —— 做阅读答错的词会自动收进来。';
  if (seenWords === 0) return '生词本里的词**还没学过** —— 先去复习一遍，再来考自己。';
  return '现在还出不了题 —— 过一阵再来。';
}

// ─────────────────────────────────────────────────────────────
// 页面
// ─────────────────────────────────────────────────────────────

type Quiz = { streakDays: number; totalWords: number; seenWords: number; questions: VocabSelfTestQuestion[] };

type Phase =
  /**
   * S12L —— **先设置，后出题**。
   *
   * 以前进来直接就是第一题，题量由服务端拍板。学生想「只练 5 个」
   * 或者「今天到期的全做完」都做不到。现在第一屏是一个设置：选题量，
   * 然后才发 `/vocab/quiz`。
   *
   * 刻意**不做持久化会话** —— 刷新会重新开一份自测，这一点在设置页
   * 上明说。正式测试（`/lesson/test`）不受影响，它仍然断点续答。
   */
  | { s: 'setup' }
  | { s: 'loading' }
  | { s: 'error'; message: string }
  | { s: 'ready'; quiz: Quiz };

/** 可选题量。`all` = 全部可用（仍受服务端上限约束）。 */
export const SELF_TEST_COUNTS = [5, 10, 20] as const;
/** 与服务端 `SELF_TEST_MAX_ITEMS` 同一个数：安全封顶，不出成马拉松。 */
export const SELF_TEST_MAX = 30;

/** 这一题作答之后的本地判定。`graded` = 这一遍算不算 FSRS。 */
type Verdict = { correct: boolean; graded: boolean };

export default function VocabSelfTestPage() {
  const navigate = useNavigate();
  const [phase, setPhase] = useState<Phase>({ s: 'setup' });
  /** 生词本统计 —— 只用来在设置页显示「今天有几个到期」，取不到就不显示。 */
  const [available, setAvailable] = useState<{ total: number; due: number } | null>(null);

  /** 第一遍的题号；`redo` 打开后走 `wrongQueue`。 */
  const [index, setIndex] = useState(0);
  const [redo, setRedo] = useState(false);
  const [wrong, setWrong] = useState<number[]>([]);
  const [verdict, setVerdict] = useState<Verdict | null>(null);
  const [typed, setTyped] = useState('');
  const [correctCount, setCorrectCount] = useState(0);
  /**
   * 这一题的写入走到哪一步了。`idle` 之外**闭锁这一题**。
   * 状态那份是给按钮变灰用的；同步判据看 `settled()`。
   */
  const [writeState, setWriteState] = useState<'idle' | 'sending' | 'failed'>('idle');

  const pending = useRef<PendingWrite<PracticeRating> | null>(null);
  const busy = useRef(false);
  const startedAt = useRef<number>(Date.now());
  const gen = useRef(0);

  const load = useCallback(async (limit?: number) => {
    const token = readToken();
    if (!token) return;
    const mine = ++gen.current;
    setPhase({ s: 'loading' });
    try {
      const data = await api.vocabSelfTestQuiz(token, limit);
      if (mine !== gen.current) return;
      setIndex(0);
      setRedo(false);
      setWrong([]);
      setVerdict(null);
      setTyped('');
      setCorrectCount(0);
      setWriteState('idle');
      startedAt.current = Date.now();
      setPhase({
        s: 'ready',
        quiz: {
          streakDays: data.streakDays,
          totalWords: data.totalWords,
          seenWords: data.seenWords,
          questions: data.questions ?? [],
        },
      });
    } catch (e) {
      if (mine !== gen.current) return;
      if (handleAuthFailure(e)) return;
      setPhase({ s: 'error', message: '没能出题 —— 网络不太好，重试一下。' });
    }
  }, []);

  // 设置页只取一次统计（可用词数）。**不出题** —— 出题要等学生选完。
  useEffect(() => {
    const token = readToken();
    if (!token) return;
    let alive = true;
    void api
      .vocabStats(token)
      .then((st) => {
        if (!alive) return;
        setAvailable({ total: Number(st.total ?? 0), due: Number(st.totalDue ?? 0) });
      })
      .catch(() => {
        // 统计取不到不影响出题 —— 设置页少显示两个数字而已
      });
    return () => {
      alive = false;
      gen.current++;
    };
  }, []);

  const quiz = phase.s === 'ready' ? phase.quiz : null;
  const order = useMemo(
    () => (redo ? wrong : quiz ? quiz.questions.map((_, i) => i) : []),
    [quiz, redo, wrong],
  );
  const qIndex = order[index];
  const q = quiz && qIndex != null ? quiz.questions[qIndex] : null;

  /**
   * 这一题还能不能往下走。
   *
   * 判据用 **`pending` 这个 ref**（同步生效），不是 `writeState` 那个状态：
   * 同一个 tick 里连点两下时，第二次回调看到的状态还是上一帧的。
   */
  const settled = () => pending.current == null && !busy.current;

  /** 发出（或重发）这一题的 FSRS 写入。 */
  const send = useCallback(async () => {
    const write = pending.current;
    if (!write) return;
    const token = readToken();
    if (!token) return;
    if (busy.current) return;
    busy.current = true;
    setWriteState('sending');
    try {
      await api.vocabPracticeReview(token, write);
      busy.current = false;
      pending.current = null;
      // **成功不自己翻页** —— 翻页仍然是学生点出来的
      setWriteState('idle');
    } catch (e) {
      busy.current = false;
      if (handleAuthFailure(e)) return;
      // `pending` 不清 —— 重试用同一个 requestId，这一题仍然闭锁
      setWriteState('failed');
    }
  }, []);

  /** 答一题。**第一遍才写 FSRS**，重做那一轮只判对错。 */
  const answer = useCallback(
    (correct: boolean) => {
      if (!q || verdict) return; // 一题只算一次，连点无效
      const graded = !redo;
      setVerdict({ correct, graded });
      if (correct) setCorrectCount((n) => n + 1);
      if (!correct && !redo && qIndex != null) setWrong((w) => (w.includes(qIndex) ? w : [...w, qIndex]));
      if (!graded) return;
      pending.current = {
        headword: q.headword,
        rating: ratingFor(correct),
        elapsedMs: elapsedSince(startedAt.current, Date.now()),
        requestId: newRequestId(),
      };
      void send();
    },
    [q, qIndex, redo, send, verdict],
  );

  const next = useCallback(() => {
    // **写入没落定就走不掉**（重做轮没有写入，`settled()` 恒真）
    if (!settled()) return;
    setVerdict(null);
    setTyped('');
    setWriteState('idle');
    pending.current = null;
    startedAt.current = Date.now();
    setIndex((i) => i + 1);
  }, []);

  const startRedo = useCallback(() => {
    setRedo(true);
    setIndex(0);
    setVerdict(null);
    setTyped('');
    setWriteState('idle');
    pending.current = null;
    startedAt.current = Date.now();
  }, []);

  if (phase.s === 'setup') {
    const cap = available ? Math.min(available.total, SELF_TEST_MAX) : SELF_TEST_MAX;
    return (
      <Screen>
        <Card>
          <TopBar title="考考自己" onBack={() => navigate(ROUTES.vocab)} backLabel="生词本" />
          <div data-testid="selftest-setup">
            {available ? (
              <p data-testid="selftest-available" className="text-sm text-slate-600">
                生词本里有 {available.total} 个词，今天到期 {available.due} 个。
              </p>
            ) : null}
            <p className="mt-4 text-sm font-medium">这次考几题？</p>
            <div role="group" aria-label="选择题量" className="mt-2 grid grid-cols-2 gap-2 sm:grid-cols-4">
              {SELF_TEST_COUNTS.map((n) => (
                <button
                  key={n}
                  type="button"
                  data-testid={`selftest-count-${n}`}
                  disabled={available != null && available.total < n}
                  onClick={() => void load(n)}
                  className="min-h-[44px] rounded-xl border border-slate-300 px-3 py-3 text-base disabled:opacity-40"
                >
                  {n} 题
                </button>
              ))}
              <button
                type="button"
                data-testid="selftest-count-all"
                onClick={() => void load(cap)}
                className="min-h-[44px] rounded-xl border border-slate-300 px-3 py-3 text-base"
              >
                全部{available ? `（${cap}）` : ''}
              </button>
            </div>
            {available != null && available.total < 5 ? (
              <p data-testid="selftest-few" className="mt-3 text-sm text-amber-800">
                生词本里只有 {available.total} 个词，这次最多考这么多。
              </p>
            ) : null}
            <p className="mt-4 text-xs text-slate-500">
              自测不计成绩。<strong>刷新会重新开一份</strong> —— 想要记成绩的那一份在
              「今天的课」里。
            </p>
          </div>
          <BackToVocab navigate={navigate} />
        </Card>
      </Screen>
    );
  }

  if (phase.s === 'loading') {
    return (
      <Screen>
        <p className="text-center text-slate-400">载入中…</p>
      </Screen>
    );
  }

  if (phase.s === 'error') {
    return (
      <Screen>
        <Card>
          <Notice kind="error">{phase.message}</Notice>
          <Button onClick={() => void load()}>
            <span data-testid="retry">重试</span>
          </Button>
          <BackToVocab navigate={navigate} />
        </Card>
      </Screen>
    );
  }

  if (!quiz || quiz.questions.length === 0) {
    return (
      <Screen>
        <Card>
          <h1 className="text-xl font-semibold mb-2">考考自己</h1>
          <p data-testid="selftest-empty" className="rounded-xl bg-slate-50 px-4 py-3 text-sm text-slate-600">
            {emptyReason(quiz?.totalWords ?? 0, quiz?.seenWords ?? 0)}
          </p>
          <BackToVocab navigate={navigate} />
        </Card>
      </Screen>
    );
  }

  // 这一轮做完了
  if (!q) {
    return (
      <Screen>
        <Card>
          <h1 className="text-xl font-semibold mb-2">{redo ? '错题过了一遍' : '自测做完了'}</h1>
          <p data-testid="selftest-done" className="text-sm text-slate-600 tabular-nums">
            答对 {correctCount} / {quiz.questions.length}
          </p>
          {!redo && wrong.length > 0 ? (
            <button
              type="button"
              data-testid="redo-wrong"
              onClick={startRedo}
              className="mt-3 min-h-[44px] w-full rounded-xl border border-slate-300 py-3 text-base"
            >
              再看一遍答错的 {wrong.length} 个（不再计入复习）
            </button>
          ) : null}
          <BackToVocab navigate={navigate} />
        </Card>
      </Screen>
    );
  }

  return (
    <Screen>
      <Card>
        <p data-testid="selftest-progress" className="text-sm text-slate-500 mb-2 tabular-nums">
          {index + 1} / {order.length}
          {redo ? ' · 重做（不计入复习）' : ''}
        </p>

        <p data-testid="question-prompt" className="text-lg text-slate-900 leading-relaxed">
          {q.prompt}
        </p>

        {q.qtype === 'spelling' ? (
          <div className="mt-4">
            <label htmlFor="spelling" className="block text-sm text-slate-600 mb-1">
              把这个词拼出来
            </label>
            <input
              id="spelling"
              data-testid="spelling-input"
              value={typed}
              disabled={!!verdict}
              onChange={(e) => setTyped(e.target.value)}
              className="w-full rounded-xl border border-slate-300 px-3 py-2 text-base"
            />
            <button
              type="button"
              data-testid="spelling-submit"
              disabled={!!verdict}
              onClick={() => answer(spellingMatches(typed, q.answer ?? ''))}
              className="mt-2 min-h-[44px] px-4 rounded-xl bg-blue-600 text-white text-base disabled:bg-slate-300"
            >
              提交
            </button>
          </div>
        ) : (
          <ul className="mt-4 flex flex-col gap-2">
            {q.options.map((o, i) => (
              <li key={`${o}-${i}`}>
                <button
                  type="button"
                  data-testid={`option-${i}`}
                  disabled={!!verdict}
                  onClick={() => answer(i === q.correctIndex)}
                  className="w-full min-h-[44px] rounded-xl border border-slate-300 px-4 py-3 text-left text-base disabled:opacity-60"
                >
                  {o}
                </button>
              </li>
            ))}
          </ul>
        )}

        {verdict ? (
          <>
            <p data-testid="verdict" className="mt-4 text-base font-medium">
              {verdict.correct ? '答对了' : '答错了'}
            </p>
            {!verdict.correct ? (
              <p data-testid="correct-answer" className="mt-1 text-sm text-slate-700">
                正确答案：{correctTextOf(q)}
              </p>
            ) : null}
            {q.contextSentence ? (
              <p className="mt-1 text-sm text-slate-600">{q.contextSentence}</p>
            ) : null}
            {writeState === 'failed' ? (
              <>
                <p role="alert" data-testid="write-error" className="mt-2 text-sm text-rose-700">
                  这一次还没记进复习计划 —— 网络不太好。
                </p>
                <button
                  type="button"
                  data-testid="retry-write"
                  onClick={() => void send()}
                  className="mt-1 min-h-[44px] px-4 rounded-xl bg-blue-600 text-white text-sm"
                >
                  重试
                </button>
              </>
            ) : null}
            <Button disabled={writeState !== 'idle'} onClick={next}>
              <span data-testid="next">下一题</span>
            </Button>
          </>
        ) : null}

        <BackToVocab navigate={navigate} />
      </Card>
    </Screen>
  );
}

function BackToVocab({ navigate }: { navigate: ReturnType<typeof useNavigate> }) {
  return (
    <button
      type="button"
      data-testid="back-to-vocab"
      onClick={() => navigate(ROUTES.vocab)}
      className="mt-6 w-full rounded-xl border border-slate-300 py-3 text-base min-h-[44px]"
    >
      回到生词本
    </button>
  );
}
