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
 * ## 写失败不吞
 *
 * 判定照常显示（那是本地算的，跟网络无关），但下面明说「这一次还没记上」
 * 并给一个重试；重试**用同一个 `requestId`**，服务端据此去重。
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
import { Button, Card, Notice, Screen } from '../ui';

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
  | { s: 'loading' }
  | { s: 'error'; message: string }
  | { s: 'ready'; quiz: Quiz };

/** 这一题作答之后的本地判定。`graded` = 这一遍算不算 FSRS。 */
type Verdict = { correct: boolean; graded: boolean };

export default function VocabSelfTestPage() {
  const navigate = useNavigate();
  const [phase, setPhase] = useState<Phase>({ s: 'loading' });

  /** 第一遍的题号；`redo` 打开后走 `wrongQueue`。 */
  const [index, setIndex] = useState(0);
  const [redo, setRedo] = useState(false);
  const [wrong, setWrong] = useState<number[]>([]);
  const [verdict, setVerdict] = useState<Verdict | null>(null);
  const [typed, setTyped] = useState('');
  const [correctCount, setCorrectCount] = useState(0);
  const [writeError, setWriteError] = useState(false);

  const pending = useRef<PendingWrite<PracticeRating> | null>(null);
  const busy = useRef(false);
  const startedAt = useRef<number>(Date.now());
  const gen = useRef(0);

  const load = useCallback(async () => {
    const token = readToken();
    if (!token) return;
    const mine = ++gen.current;
    setPhase({ s: 'loading' });
    try {
      const data = await api.vocabSelfTestQuiz(token);
      if (mine !== gen.current) return;
      setIndex(0);
      setRedo(false);
      setWrong([]);
      setVerdict(null);
      setTyped('');
      setCorrectCount(0);
      setWriteError(false);
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

  useEffect(() => {
    void load();
    return () => {
      gen.current++;
    };
  }, [load]);

  const quiz = phase.s === 'ready' ? phase.quiz : null;
  const order = useMemo(
    () => (redo ? wrong : quiz ? quiz.questions.map((_, i) => i) : []),
    [quiz, redo, wrong],
  );
  const qIndex = order[index];
  const q = quiz && qIndex != null ? quiz.questions[qIndex] : null;

  /** 发出（或重发）这一题的 FSRS 写入。 */
  const send = useCallback(async () => {
    const write = pending.current;
    if (!write) return;
    const token = readToken();
    if (!token) return;
    if (busy.current) return;
    busy.current = true;
    setWriteError(false);
    try {
      await api.vocabPracticeReview(token, write);
      busy.current = false;
      pending.current = null;
    } catch (e) {
      busy.current = false;
      if (handleAuthFailure(e)) return;
      // `pending` 不清 —— 重试用同一个 requestId
      setWriteError(true);
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
    setVerdict(null);
    setTyped('');
    setWriteError(false);
    pending.current = null;
    startedAt.current = Date.now();
    setIndex((i) => i + 1);
  }, []);

  const startRedo = useCallback(() => {
    setRedo(true);
    setIndex(0);
    setVerdict(null);
    setTyped('');
    setWriteError(false);
    pending.current = null;
    startedAt.current = Date.now();
  }, []);

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
            {writeError ? (
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
            <Button onClick={next}>
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
