/**
 * 一份阅读答卷的**成绩与逐题回顾**，以及挂在它上面的申诉。
 *
 * 这份组件是从 `pages/ReadingResult.tsx` 原样提出来的（阶段 11）——
 * 两个地方要显示同一份东西：
 *
 *   · `/lesson/reading/result` —— 今天刚交完卷；
 *   · `/scores/:submissionId` —— 历史成绩里翻开某一天的答卷。
 *
 * **两条链的区别只在「这份答卷是怎么定位到的」**：前者由 `/lesson/today`
 * 给出，后者由路由的路径参数给出。定位之后要显示什么、什么时候能显示，
 * 是一模一样的规则，所以那部分只能有一份实现 —— 复制一份出来，迟早会
 * 出现「历史页把还没公布的答案显示出来了」这种只在一边修好的洞。
 *
 * ## 两道门都是服务端的
 *
 *   · `scoresPending` —— 还没判分：`totalScore` / `awardedMarks` /
 *     `isCorrect` / `markerComment` 全是 null，页面说「还在判分」，
 *     **绝不自己补一个 0 分**；
 *   · `answersPending` —— 还没最终提交：`correctAnswer` /
 *     `referenceAnswer` / `explanation` 全是 null，**一个字的答案材料
 *     都不显示**。
 *
 * 服务端的 `stripUnreleasedScores` 是权威，这里只按旗子决定措辞，
 * 并且**再挡一道**（双保险）。
 *
 * ## `submissionId` 单独传，不从 `result` 里读
 *
 * 申诉是写操作。它认的那个 id 必须来自**调用方校验过的那条链**
 * （`/lesson/today` 的 read 段，或路由参数与响应核对过的结果），
 * 而不是结果响应自己说的那个 —— 否则「结果响应」就成了另一个可以指定
 * 写入目标的入口。
 *
 * ## 底部动作由调用方给
 *
 * 交完卷那一屏要的是「继续今天的课」，历史成绩那一屏要的是「回历史成绩」。
 * 这份组件不猜，`footer` 谁传谁负责。
 */
import { useCallback, useMemo, useRef, useState } from 'react';
import { api, type AnswerDisplay, type ReadingResult, type ReadingResultItem } from '../lib/api';
import { handleAuthFailure } from '../lib/auth-store';
import { readToken } from '../lib/identity';
import { dateTimeLabel, statusLabel } from '../lib/format';
import { DraggableSplit } from '../lesson/shared/DraggableSplit';

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

  // ── S12I —— **逐题状态以服务端为准** ──
  //
  // 旧写法是 `if (scoresPending) return 'pending'`，把**整卷**的旗子刷到每一题上。
  // 用户第一次真人验收的第一个报告就是它：一道有确定答案的选择题显示
  // 「还在判分」。现在服务端会逐题告诉我们到底判了没有。
  //
  // **不在浏览器里算对错**：下面只看 `isCorrect` / `awardedMarks`，
  // 那两个同样是服务端算好的。
  if (item.gradingStatus) {
    switch (item.gradingStatus) {
      case 'not_answered':
        return 'unanswered';
      case 'pending_marking':
        return 'pending';
      case 'auto_graded':
      case 'marked':
        if (item.isCorrect === true) return 'correct';
        if (
          typeof item.awardedMarks === 'number' &&
          item.awardedMarks > 0 &&
          item.awardedMarks < item.marks
        ) {
          return 'partial';
        }
        if (item.isCorrect === false) return 'incorrect';
        // 判了却既不对也不错（服务端只给了分）—— 按分数说话。
        if (item.awardedMarks === 0) return 'incorrect';
        if (typeof item.awardedMarks === 'number' && item.awardedMarks >= item.marks) return 'correct';
        return 'pending';
    }
  }

  // 旧服务端（不发 `gradingStatus`）的向后兼容路径 —— 原行为一字不改。
  if (!answered) return 'unanswered';
  if (scoresPending) return 'pending';
  if (item.isCorrect === true) return 'correct';
  if (typeof item.awardedMarks === 'number' && item.awardedMarks > 0 && item.awardedMarks < item.marks) {
    return 'partial';
  }
  if (item.isCorrect === false) return 'incorrect';
  return 'pending';
}

/**
 * 只用于**比较**的归一化（NFKC → 去首尾 → 折叠空白 → casefold）。
 * 与服务端 `normalizeForAnswerCompare` 同一口径，**不改展示值**。
 */
export function normalizeAnswerForCompare(raw: unknown): string {
  return String(raw ?? '').normalize('NFKC').trim().replace(/\s+/g, ' ').toLowerCase();
}

/**
 * 这一题该显示哪几行答案。
 *
 * 优先用服务端的语义 `answerDisplay`；旧服务端没有时用
 * `correctAnswer` / `referenceAnswer` 自己拼一份 —— **并且同样去重**。
 * 用户看到的「两行一模一样」就是这里以前没比过。
 */
export function answerRowsOf(item: ReadingResultItem): Array<{
  kind: 'correct' | 'reference' | 'rubric';
  value: string;
}> {
  const d: AnswerDisplay | null | undefined = item.answerDisplay;
  if (d && typeof d.primaryValue === 'string' && d.primaryValue.trim() !== '') {
    const rows: Array<{ kind: 'correct' | 'reference' | 'rubric'; value: string }> = [
      { kind: d.primaryKind, value: d.primaryValue },
    ];
    if (
      typeof d.rubricValue === 'string' &&
      d.rubricValue.trim() !== '' &&
      normalizeAnswerForCompare(d.rubricValue) !== normalizeAnswerForCompare(d.primaryValue)
    ) {
      rows.push({ kind: 'rubric', value: d.rubricValue });
    }
    return rows;
  }
  if (d === null) return [];

  // 兜底：旧服务端。
  const pick = (v: unknown) => (typeof v === 'string' && v.trim() !== '' ? v : null);
  const correct = pick(item.correctAnswer);
  const reference = pick(item.referenceAnswer);
  if (!correct && !reference) return [];
  const primary = (correct ?? reference) as string;
  const rows: Array<{ kind: 'correct' | 'reference' | 'rubric'; value: string }> = [
    { kind: item.questionType === 'mcq' ? 'correct' : 'reference', value: primary },
  ];
  if (
    correct &&
    reference &&
    normalizeAnswerForCompare(reference) !== normalizeAnswerForCompare(primary)
  ) {
    rows.push({ kind: 'rubric', value: reference });
  }
  return rows;
}

/**
 * 判分摘要的文案段 —— **四件事分开说**。
 *
 * 返工 1/2 修的就是这里：第一版把 `autoGraded + marked` 加起来说成
 * 「已自动判分 N 题」。只要 `marked > 0`，那句话就是假的 ——
 * **老师亲手批的题被说成了机器判的**。服务端把它们分开发，展示就不该合并。
 * （原来的用例恰好用 `marked: 0`，所以照不出这个缺陷。）
 *
 * 计数为 0 的整段不出现；分隔符由调用方按下标加，所以**开头与结尾都不会
 * 挂一个孤零零的点**（第一版的「没作答」那一段是无条件加前缀的）。
 *
 * 这里只排版：**不算判分状态、不算对错、不算分数、不算总数。**
 */
export function gradingSummaryParts(s: {
  autoGraded: number;
  marked: number;
  pendingMarking: number;
  notAnswered: number;
}): Array<{ key: string; text: string }> {
  const parts: Array<{ key: string; text: string }> = [];
  if (s.autoGraded > 0) parts.push({ key: 'auto', text: `已自动判分 ${s.autoGraded} 题` });
  if (s.marked > 0) parts.push({ key: 'marked', text: `老师已批改 ${s.marked} 题` });
  if (s.pendingMarking > 0) parts.push({ key: 'pending', text: `${s.pendingMarking} 题等老师批改` });
  if (s.notAnswered > 0) parts.push({ key: 'unanswered', text: `${s.notAnswered} 题没作答` });
  return parts;
}

const ANSWER_ROW_LABEL: Record<'correct' | 'reference' | 'rubric', string> = {
  correct: '正确答案',
  reference: '参考答案',
  rubric: '评分要点',
};

/**
 * 这份卷子的原文—— **整份只有一段**，从第一道带原文的题里取。
 *
 * `passage_pick` 的卷子把同一段原文存在**每一道题**的快照里，所以这里
 * 取第一份就够了；拿不到就**不显示**，绝不造一段出来。
 */
export function passageOf(result: ReadingResult): { title: string; body: string } | null {
  for (const it of result.items ?? []) {
    const c = (it.snapshotContent ?? {}) as { passage?: unknown; passageTitle?: unknown };
    const body = typeof c.passage === 'string' ? c.passage.trim() : '';
    if (body.length === 0) continue;
    const title = typeof c.passageTitle === 'string' && c.passageTitle.trim() !== ''
      ? c.passageTitle.trim()
      : result.paperName;
    return { title, body };
  }
  return null;
}

/**
 * 得分率 —— **前端自己除出来的数**。
 *
 * ⚠️ 服务端**不下发**这个字段。所以它只能显示在「产品明确要求、而且大家
 * 都知道它是派生值」的地方；换个页面就照抄，等于凭空多出一份服务端从没
 * 说过的成绩。渲染与否由 `ResultView` 的 `showDerivedPercentage` 决定，
 * 而那个开关**默认关**（见组件注释）。
 *
 * 分数没放出来、或没有满分基数时**不算**，返回 null。
 */
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
// 组件
// ─────────────────────────────────────────────────────────────

export function ResultView({
  result,
  submissionId,
  onAuthLost,
  footer,
  showDerivedPercentage = false,
}: {
  result: ReadingResult;
  /** 调用方校验过的那一个 —— 申诉只认它。 */
  submissionId: string;
  onAuthLost: () => void;
  /** 底部动作。交完卷那一屏与历史成绩那一屏要的不是同一个。 */
  footer?: React.ReactNode;
  /**
   * 显不显示得分率。**默认不显示，必须显式打开。**
   *
   * 服务端在这份响应里**没有**百分比字段 —— 显示出来的那个数是
   * `percentageOf()` 除出来的。交完卷那一屏历史上一直显示它（既有行为，
   * 冻结不动），历史成绩详情页**不显示**：翻旧账时凭空多一个服务端没说过
   * 的数字，学生分不清哪个是真成绩。
   *
   * 默认关是**故意的**：将来第三个调用方接进来，只会少一个派生数字，
   * 不会悄悄多一个。要显示就得在调用点写明白，那一行就是决定本身。
   */
  showDerivedPercentage?: boolean;
}) {
  const pct = useMemo(
    () => (showDerivedPercentage ? percentageOf(result) : null),
    [result, showDerivedPercentage],
  );
  return (
    <>
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

        {result.gradingSummary && result.gradingSummary.total > 0 && (
          <p data-testid="grading-summary" className="mt-2 text-sm text-slate-600 tabular-nums">
            {gradingSummaryParts(result.gradingSummary).map((part, i) => (
              <span key={part.key} data-testid={`grading-part-${part.key}`}>
                {i > 0 ? ' · ' : ''}
                {part.text}
              </span>
            ))}
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
            {/* S12L —— 学生不该看到 `marked` / `submitted` 这类内部枚举 */}
            <dd data-testid="status" className="inline">{statusLabel(result.status)}</dd>
          </div>
          {result.submittedAt && (
            <div>
              <dt className="inline">交卷时间：</dt>
              {/* S12L —— ISO 串换成新加坡本地时间 */}
              <dd data-testid="submitted-at" className="inline">
                {dateTimeLabel(result.submittedAt)}
              </dd>
            </div>
          )}
        </dl>
      </section>

      <div
        data-testid="result-split"
        className="ui-ios lg:h-[calc(100dvh-15rem)] lg:min-h-[34rem]"
      >
        <DraggableSplit
          storageKey="sw:reading:result-split"
          initial={0.46}
          left={<PassageReview result={result} />}
          right={(
            <ol data-testid="items" className="flex flex-col gap-4 lg:h-full lg:overflow-y-auto lg:px-4 lg:pb-4 [scrollbar-gutter:stable]">
              {result.items.map((item, i) => (
                <ResultItemCard
                  key={item.paperQuestionId}
                  item={item}
                  index={i + 1}
                  scoresPending={result.scoresPending}
                  answersPending={result.answersPending}
                  submissionId={submissionId}
                  onAuthLost={onAuthLost}
                />
              ))}
            </ol>
          )}
        />
      </div>

      <WholeAppeal submissionId={submissionId} onAuthLost={onAuthLost} />
      {footer}
    </>
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
      className="app-glass rounded-[20px] p-5"
    >
      <header className="flex items-center gap-3 mb-2">
        <span className="inline-flex items-center justify-center min-w-[28px] h-7 px-2 rounded-md bg-slate-100 font-mono text-sm tabular-nums">
          {index}
        </span>
        <span className={`text-xs px-2 py-1 rounded-md border ${OUTCOME_CLASS[outcome]}`}>
          {OUTCOME_LABEL[outcome]}
        </span>
        <div className="flex-1" />
        {/* S12I —— 分数跟着**这一题**的判分状态走，不再跟整卷的旗子。
            已经确定性判完的选择题在整卷还在等老师时也该显示自己的分。 */}
        {item.awardedMarks != null && (
          <span data-testid={`marks-${item.paperQuestionId}`} className="text-sm text-slate-500 tabular-nums">
            {item.awardedMarks} / {item.marks} 分
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

      {/* 答案门未开时，服务端已经把这几样置空；这里再挡一道，双保险。

          S12I —— 行数由 `answerRowsOf` 决定。服务端说一行就一行：
          以前「正确答案」与「参考答案」是两个独立的 `<p>`，
          而两者都取自 `answerContent.text`，于是同一句话挂了两个名字。 */}
      {!answersPending &&
        answerRowsOf(item).map((row) => (
          <p
            key={row.kind}
            data-testid={`answer-row-${row.kind}-${item.paperQuestionId}`}
            className="text-sm mb-1"
          >
            <span className="text-slate-500">{ANSWER_ROW_LABEL[row.kind]}：</span>
            <span className="font-medium">{row.value}</span>
          </p>
        ))}
      {!answersPending && item.explanation && (
        <p data-testid={`explanation-${item.paperQuestionId}`} className="text-sm text-slate-600 mb-1">
          {item.explanation}
        </p>
      )}
      {!answersPending && item.evidence && (
        <p
          data-testid={`evidence-${item.paperQuestionId}`}
          className="text-sm text-slate-600 mb-1 pl-3 border-l-2 border-slate-200 italic"
        >
          <span className="not-italic text-slate-500">原文依据：</span>
          {item.evidence}
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

/**
 * 原文回看 —— 与作答页保持同一结构：窄屏原文在题目上方，iPad/桌面左文右题。
 *
 * 用户验收的第三条：历史成绩点得进去，但没有原文，题目脱离上下文读不懂。
 * 数据一直都在（`snapshotContent.passage` 早就随响应发过来了），只是从来
 * 没有渲染过。
 *
 * 规矩：
 *   · 只从服务端的快照取，**没有就不显示**，绝不造一段；
 *   · 纯文本渲染，不用 `dangerouslySetInnerHTML`；
 *   · 自己的滚动容器 + 高度上限 —— 手机上不能把整页顶出横向滚动。
 */
function PassageReview({ result }: { result: ReadingResult }) {
  const [open, setOpen] = useState(true);
  const passage = useMemo(() => passageOf(result), [result]);
  if (!passage) return null;
  return (
    <section className="app-glass rounded-[20px] p-4 mb-5 lg:mb-0 lg:h-full lg:overflow-y-auto [scrollbar-gutter:stable]">
      <button
        type="button"
        data-testid="passage-toggle"
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
        className="sticky top-0 z-10 w-full min-h-[44px] rounded-xl bg-white/90 px-2 text-left text-sm font-medium text-[#007aff] backdrop-blur"
      >
        {open ? '收起原文' : '查看原文'}
        <span className="ml-2 text-slate-400 font-normal">{passage.title}</span>
      </button>
      {open && (
        <div
          data-testid="passage-body"
          className="mt-3 overflow-x-hidden break-words whitespace-pre-wrap font-serif text-[1.05rem] leading-[1.75] text-slate-800"
        >
          {passage.body}
        </div>
      )}
    </section>
  );
}
