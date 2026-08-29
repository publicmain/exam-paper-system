/**
 * `/lesson/reading/result` —— 交完卷之后看成绩与逐题回顾。
 *
 * ## 资源从哪来
 *
 * 和阅读页同一条链：`GET /lesson/today` → `segments.read` 给出
 * `sessionId` / `submissionId`。**URL 的查询串、localStorage、令牌里解出来
 * 的东西、后端的 `href`、旧的历史 state —— 一个都不读。** 这条规矩的意义
 * 是「学生只能看到服务端认定属于他的那份答卷」——一旦资源标识可以从
 * URL 里指定，任何人都能翻别人的卷子。
 *
 * ## 放不放分数 / 答案，服务端说了算
 *
 * 响应里有两面旗子：
 *   · `scoresPending` —— 还没判分。此时 `totalScore` 等全是 null，
 *     页面显示「还在判分」，**绝不自己补一个 0 分**；
 *   · `answersPending` —— 还没最终提交（第二作答窗还开着）。此时
 *     `correctAnswer` / `referenceAnswer` / `explanation` 全是 null，
 *     页面**一个字的答案材料都不显示**。
 *
 * 前端不做第二套判断 —— 服务端的 `stripUnreleasedScores` 是权威，
 * 这里只按旗子决定措辞。
 *
 * ## 这一页是只读的
 *
 * 不存草稿、不保存答案、不交卷、不重做。唯一的写操作是**申诉**。
 */
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  ApiError,
  api,
  type LessonToday,
  type ReadingResult,
  type ReadingResultItem,
  type SegmentStatus,
} from '../lib/api';
import { handleAuthFailure } from '../lib/auth-store';
import { readToken } from '../lib/identity';
import { ROUTES } from '../routes.contract';

// ─────────────────────────────────────────────────────────────
// 纯逻辑（导出给测试直接驱动）
// ─────────────────────────────────────────────────────────────

export type QuestionOutcome =
  | 'correct'
  | 'incorrect'
  | 'partial'
  | 'pending' // 还没判分
  | 'unanswered';

/**
 * 一道题该显示成什么状态。
 *
 * 顺序有讲究：**没答过**优先于一切（哪怕判分下来是 0 分，学生更需要知道
 * 的是「这题空着」）；分数没放出来就是 `pending`，不是「错」。
 */
export function questionOutcome(item: ReadingResultItem, scoresPending: boolean): QuestionOutcome {
  const answered = item.studentAnswer != null && String(item.studentAnswer).trim() !== '';
  if (!answered) return 'unanswered';
  if (scoresPending) return 'pending';
  if (item.isCorrect === true) return 'correct';
  if (typeof item.awardedMarks === 'number' && item.awardedMarks > 0 && item.awardedMarks < item.marks) {
    return 'partial';
  }
  if (item.isCorrect === false) return 'incorrect';
  return 'pending';
}

/** 得分率。分数没放出来、或没有满分基数时**不算**，返回 null。 */
export function percentageOf(result: ReadingResult): number | null {
  if (result.scoresPending) return null;
  if (typeof result.totalScore !== 'number' || typeof result.maxScore !== 'number') return null;
  if (result.maxScore <= 0) return null;
  return Math.round((result.totalScore / result.maxScore) * 100);
}

/** 申诉正文的本地校验 —— 只挡住明显没写内容的，别替老师判断内容。 */
export function validateAppealMessage(raw: string): { ok: boolean; value: string; reason?: string } {
  const value = raw.trim();
  if (value.length === 0) return { ok: false, value, reason: '写一句话说明你想申诉什么。' };
  if (value.length < 4) return { ok: false, value, reason: '再多写几个字，老师才看得懂。' };
  if (value.length > 4000) return { ok: false, value, reason: '太长了，精简到 4000 字以内。' };
  return { ok: true, value };
}

const OUTCOME_LABEL: Record<QuestionOutcome, string> = {
  correct: '答对',
  incorrect: '答错',
  partial: '部分得分',
  pending: '还在判分',
  unanswered: '没有作答',
};

const OUTCOME_CLASS: Record<QuestionOutcome, string> = {
  correct: 'bg-green-100 text-green-800 border-green-300',
  incorrect: 'bg-rose-100 text-rose-800 border-rose-300',
  partial: 'bg-amber-100 text-amber-900 border-amber-300',
  pending: 'bg-slate-100 text-slate-700 border-slate-300',
  unanswered: 'bg-slate-100 text-slate-600 border-slate-300',
};

function stemOf(item: ReadingResultItem): string {
  const c = (item.snapshotContent ?? {}) as { stem?: unknown };
  return typeof c.stem === 'string' ? c.stem : '';
}

// ─────────────────────────────────────────────────────────────
// 页面
// ─────────────────────────────────────────────────────────────

/**
 * 「这一段阅读有结果可看」的状态。
 *
 * `todo` / `partial` 是还在做，`none` 是今天压根没有阅读 —— 这三种状态下
 * **没有可回顾的答卷**，来了也只能空手而归。真正做完的只有两种：学生自己
 * 交了卷（`done`），或者作答窗关闭时被系统收走（`auto_closed`）。
 *
 * 这个判断刻意**只认服务端下发的状态**，不去猜「有 submissionId 大概就是
 * 做完了」—— 阅读做到一半也有 submissionId。
 */
const RESULT_READY: ReadonlySet<SegmentStatus> = new Set<SegmentStatus>(['done', 'auto_closed']);

/** 从今天的课里取出这一屏需要的两个标识；任何一个缺就是「没有结果可看」。 */
export function readingResultRef(
  today: LessonToday,
): { sessionId: string; submissionId: string } | null {
  const read = today.segments.find((s) => s.key === 'read');
  if (!read || read.key !== 'read') return null;
  if (!RESULT_READY.has(read.status)) return null;
  if (!read.sessionId || !read.submissionId) return null;
  return { sessionId: read.sessionId, submissionId: read.submissionId };
}

type Phase =
  | { s: 'loading' }
  | { s: 'error'; message: string }
  | { s: 'locked' }
  /**
   * `submissionId` 单独带着，**不从 `result` 里读**。申诉是写操作，它认的那
   * 个 id 必须来自认证过的 `/lesson/today` 这条链，而不是结果响应自己说的
   * 那个 —— 否则「结果响应」就成了另一个可以指定写入目标的入口。
   */
  | { s: 'ready'; result: ReadingResult; submissionId: string };

export default function ReadingResultPage() {
  const navigate = useNavigate();
  const [phase, setPhase] = useState<Phase>({ s: 'loading' });

  const load = useCallback(async () => {
    const token = readToken();
    if (!token) return; // 没票不该在这一页，App 的路由守卫会送走
    setPhase({ s: 'loading' });
    try {
      const today = await api.lessonToday(token);
      const ref = readingResultRef(today);
      if (!ref) {
        // 今天没有可看的阅读结果 —— 回枢纽，由它决定下一步。
        navigate(ROUTES.today, { replace: true });
        return;
      }
      const result = await api.getReadingResult(token, ref.sessionId);
      // 拿回来的必须**就是**我们问的那一份。对不上就是链路错位（换了一天、
      // 卷子被换、响应串了）—— 一个字都不显示，更不能让申诉挂到别人的答卷上。
      if (result.sessionId !== ref.sessionId || result.submissionId !== ref.submissionId) {
        navigate(ROUTES.today, { replace: true });
        return;
      }
      setPhase({ s: 'ready', result, submissionId: ref.submissionId });
    } catch (e) {
      if (handleAuthFailure(e)) return;
      if (e instanceof ApiError && e.body.code === 'result_locked_until_submit') {
        setPhase({ s: 'locked' });
        return;
      }
      if (e instanceof ApiError && (e.body.code === 'no_submission' || e.body.code === 'session_not_found')) {
        // 课程状态与这一页对不上（换了一天、卷子被撤）—— 回枢纽，不是报错。
        navigate(ROUTES.today, { replace: true });
        return;
      }
      setPhase({ s: 'error', message: '没能打开这次的成绩 —— 网络不太好，重试一下。' });
    }
  }, [navigate]);

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

  if (phase.s === 'locked') {
    return (
      <Shell>
        <div role="alert" data-testid="locked" className="rounded-xl bg-amber-50 text-amber-900 px-4 py-3 text-sm mb-4">
          这次的答卷还没交，先把卷子做完再来看结果。
        </div>
        <BackToToday navigate={navigate} />
      </Shell>
    );
  }

  if (phase.s === 'error') {
    return (
      <Shell>
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
        <BackToToday navigate={navigate} />
      </Shell>
    );
  }

  return (
    <ResultView
      result={phase.result}
      submissionId={phase.submissionId}
      navigate={navigate}
      onReload={() => void load()}
    />
  );
}

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-[100dvh] bg-slate-50 px-4 py-6">
      <div className="mx-auto w-full max-w-2xl">{children}</div>
    </div>
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

function ResultView({
  result,
  submissionId,
  navigate,
  onReload,
}: {
  result: ReadingResult;
  /** 来自 `/lesson/today` 且与响应核对过的那一个 —— 申诉只认它。 */
  submissionId: string;
  navigate: ReturnType<typeof useNavigate>;
  onReload: () => void;
}) {
  const pct = useMemo(() => percentageOf(result), [result]);
  return (
    <Shell>
      <h1 className="text-xl font-semibold mb-1">{result.paperName}</h1>

      <section
        data-testid="summary"
        className="rounded-2xl bg-white border border-slate-200 p-5 mb-5"
      >
        {result.scoresPending ? (
          <p data-testid="scores-pending" className="text-base text-slate-700">
            这份卷子还在判分，分数出来之后就能在这里看到。
          </p>
        ) : (
          <p className="text-base">
            <span data-testid="score" className="text-3xl font-semibold tabular-nums">
              {result.totalScore ?? '—'}
            </span>
            <span className="text-slate-500"> / {result.maxScore ?? '—'} 分</span>
            {pct != null && (
              <span data-testid="percentage" className="ml-3 text-slate-500 tabular-nums">
                {pct}%
              </span>
            )}
          </p>
        )}

        {result.answersPending && (
          <p data-testid="answers-pending" className="mt-3 text-sm text-amber-800 bg-amber-50 rounded-xl px-3 py-2">
            答案还没有公布 —— 你还可以回去修改这份卷子；最终交卷之后才会显示答案。
          </p>
        )}

        <dl className="mt-4 text-sm text-slate-500 flex flex-wrap gap-x-6 gap-y-1">
          <div>
            <dt className="inline">状态：</dt>
            <dd data-testid="status" className="inline">{result.status}</dd>
          </div>
          {result.submittedAt && (
            <div>
              <dt className="inline">交卷时间：</dt>
              <dd data-testid="submitted-at" className="inline">{result.submittedAt}</dd>
            </div>
          )}
        </dl>
      </section>

      <ol data-testid="items" className="flex flex-col gap-4">
        {result.items.map((item, i) => (
          <ResultItemCard
            key={item.paperQuestionId}
            item={item}
            index={i + 1}
            scoresPending={result.scoresPending}
            answersPending={result.answersPending}
            submissionId={submissionId}
            onAuthLost={onReload}
          />
        ))}
      </ol>

      <WholeAppeal submissionId={submissionId} onAuthLost={onReload} />
      <BackToToday navigate={navigate} />
    </Shell>
  );
}

function ResultItemCard({
  item,
  index,
  scoresPending,
  answersPending,
  submissionId,
  onAuthLost,
}: {
  item: ReadingResultItem;
  index: number;
  scoresPending: boolean;
  answersPending: boolean;
  submissionId: string;
  onAuthLost: () => void;
}) {
  const outcome = questionOutcome(item, scoresPending);
  const appealable = outcome === 'incorrect' || outcome === 'partial';
  return (
    <li
      data-testid={`item-${item.paperQuestionId}`}
      data-outcome={outcome}
      className="rounded-2xl bg-white border border-slate-200 p-5"
    >
      <header className="flex items-center gap-3 mb-2">
        <span className="inline-flex items-center justify-center min-w-[28px] h-7 px-2 rounded-md bg-slate-100 font-mono text-sm tabular-nums">
          {index}
        </span>
        <span className={`text-xs px-2 py-1 rounded-md border ${OUTCOME_CLASS[outcome]}`}>
          {OUTCOME_LABEL[outcome]}
        </span>
        <div className="flex-1" />
        {!scoresPending && (
          <span data-testid={`marks-${item.paperQuestionId}`} className="text-sm text-slate-500 tabular-nums">
            {item.awardedMarks == null ? '—' : item.awardedMarks} / {item.marks} 分
          </span>
        )}
      </header>

      {stemOf(item) && (
        <p className="text-base text-slate-900 whitespace-pre-wrap leading-relaxed mb-3">{stemOf(item)}</p>
      )}

      {item.snapshotOptions && item.snapshotOptions.length > 0 && (
        <ul data-testid={`options-${item.paperQuestionId}`} className="mb-3 flex flex-col gap-1 text-sm">
          {item.snapshotOptions.map((o) => (
            <li key={o.key} className="text-slate-700">
              <span className="font-mono text-slate-500 mr-2">{o.key}.</span>
              {o.text}
            </li>
          ))}
        </ul>
      )}

      <p className="text-sm mb-1">
        <span className="text-slate-500">你的答案：</span>
        <span data-testid={`student-answer-${item.paperQuestionId}`} className="font-medium">
          {item.studentAnswer && String(item.studentAnswer).trim() !== ''
            ? item.studentAnswer
            : '（空着）'}
        </span>
      </p>

      {/* 答案门未开时，服务端已经把这三样置空；这里再挡一道，双保险。 */}
      {!answersPending && item.correctAnswer && (
        <p className="text-sm mb-1">
          <span className="text-slate-500">正确答案：</span>
          <span data-testid={`correct-answer-${item.paperQuestionId}`} className="font-medium">
            {item.correctAnswer}
          </span>
        </p>
      )}
      {!answersPending && item.referenceAnswer && (
        <p data-testid={`reference-${item.paperQuestionId}`} className="text-sm text-slate-700 mb-1">
          <span className="text-slate-500">参考答案：</span>
          {item.referenceAnswer}
        </p>
      )}
      {!answersPending && item.explanation && (
        <p data-testid={`explanation-${item.paperQuestionId}`} className="text-sm text-slate-600 mb-1">
          {item.explanation}
        </p>
      )}

      {!scoresPending && item.markerComment && (
        <p data-testid={`comment-${item.paperQuestionId}`} className="mt-2 text-sm bg-slate-50 rounded-xl px-3 py-2">
          <span className="text-slate-500">
            {item.commentSource === 'ai' ? '自动判分说明：' : '老师评语：'}
          </span>
          {item.markerComment}
        </p>
      )}

      {appealable && (
        <AppealForm
          testId={`appeal-q-${item.paperQuestionId}`}
          submissionId={submissionId}
          paperQuestionId={item.paperQuestionId}
          label="这题判得不对？"
          onAuthLost={onAuthLost}
        />
      )}
    </li>
  );
}

function WholeAppeal({ submissionId, onAuthLost }: { submissionId: string; onAuthLost: () => void }) {
  return (
    <section className="mt-6 rounded-2xl bg-white border border-slate-200 p-5">
      <AppealForm
        testId="appeal-whole"
        submissionId={submissionId}
        label="对这次的判分有疑问？"
        onAuthLost={onAuthLost}
      />
    </section>
  );
}

type AppealPhase =
  | { s: 'idle' }
  | { s: 'sending' }
  | { s: 'sent' }
  | { s: 'failed'; message: string };

function AppealForm({
  testId,
  submissionId,
  paperQuestionId,
  label,
  onAuthLost,
}: {
  testId: string;
  submissionId: string;
  paperQuestionId?: string;
  label: string;
  onAuthLost: () => void;
}) {
  const [open, setOpen] = useState(false);
  const [text, setText] = useState('');
  const [phase, setPhase] = useState<AppealPhase>({ s: 'idle' });
  const [invalid, setInvalid] = useState<string | null>(null);
  /**
   * 连点守卫。光靠 `phase` 挡不住：同一个 tick 里连点两下，两次回调看到的
   * 都是上一帧的 `idle`，两条申诉就都发出去了。闸门必须同步生效。
   */
  const sendingRef = useRef(false);

  const send = useCallback(async () => {
    if (sendingRef.current || phase.s === 'sent') return;
    const check = validateAppealMessage(text);
    if (!check.ok) {
      setInvalid(check.reason ?? '写点内容再提交。');
      return;
    }
    setInvalid(null);
    const token = readToken();
    if (!token) return;
    sendingRef.current = true;
    setPhase({ s: 'sending' });
    try {
      await api.createAppeal(token, {
        submissionId,
        ...(paperQuestionId ? { paperQuestionId } : {}),
        message: check.value,
      });
      setPhase({ s: 'sent' });
    } catch (e) {
      sendingRef.current = false;
      if (handleAuthFailure(e)) {
        onAuthLost();
        return;
      }
      setPhase({ s: 'failed', message: '没能提交申诉 —— 再试一次。' });
    }
  }, [onAuthLost, paperQuestionId, phase.s, submissionId, text]);

  if (phase.s === 'sent') {
    return (
      <p data-testid={`${testId}-sent`} className="mt-3 text-sm text-green-800 bg-green-50 rounded-xl px-3 py-2">
        申诉已提交，老师看过之后会回复你。
      </p>
    );
  }

  if (!open) {
    return (
      <button
        type="button"
        data-testid={`${testId}-open`}
        onClick={() => setOpen(true)}
        className="mt-3 min-h-[44px] px-3 rounded-lg border border-slate-300 text-sm"
      >
        {label}
      </button>
    );
  }

  const id = `${testId}-input`;
  return (
    <div className="mt-3">
      <label htmlFor={id} className="block text-sm text-slate-600 mb-1">
        说说你的理由
      </label>
      <textarea
        id={id}
        data-testid={id}
        rows={3}
        value={text}
        onChange={(e) => setText(e.target.value)}
        className="w-full rounded-xl border border-slate-300 px-3 py-2 text-base"
      />
      {invalid && (
        <p role="alert" data-testid={`${testId}-invalid`} className="mt-1 text-sm text-rose-700">
          {invalid}
        </p>
      )}
      {phase.s === 'failed' && (
        <p role="alert" data-testid={`${testId}-error`} className="mt-1 text-sm text-rose-700">
          {phase.message}
        </p>
      )}
      <button
        type="button"
        data-testid={`${testId}-submit`}
        disabled={phase.s === 'sending'}
        onClick={() => void send()}
        className="mt-2 min-h-[44px] px-4 rounded-xl bg-blue-600 text-white text-sm font-medium disabled:bg-slate-300"
      >
        {phase.s === 'sending' ? '提交中…' : '提交申诉'}
      </button>
    </div>
  );
}
