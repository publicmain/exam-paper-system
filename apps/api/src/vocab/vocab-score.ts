/**
 * P7 —— 正式词汇成绩的**统一 DTO**（纯函数，无 IO）。
 *
 * ## 为什么必须只有一处
 *
 * 旧 P7 计划是「按 `snapshotContent.vocabTrack` 现算」：把卷内词汇题的
 * 分数从阅读总分里拆出来当词汇成绩。P6 之后这条口径作废了 ——
 *
 * - 卷内词汇题是**阅读卷的一部分**，它的分本来就在 `totalScore` 里；
 *   把它拆出来叫「词汇成绩」，等于凭展示层的一次减法造出一个数据库里
 *   不存在的分数
 * - 正式词汇成绩现在有实体了：\`VocabQuizAttempt\`。它有题目快照、有
 *   提交时刻、算过一次分就冻结
 *
 * 所以：**正式词汇成绩只有一个来源** —— 当前任务（DLC）名下
 * \`status='submitted'\` 的那一份 attempt。自由练习、\`WordReviewLog\`、
 * 卷内词汇题一律不计入。
 *
 * 各页面不再各算各的：服务端给出这一个形状，前端只负责显示。
 */

export type VocabScoreView =
  /**
   * 这次任务没有词汇队列快照（P6 收尾之前建的旧任务行，`vocabWords`
   * 为 NULL）。它**开不出**正式词汇测试 —— 与「还没开始考」是两回事，
   * 文案必须分开，否则学生会一直等一个永远不会出现的入口。
   */
  | { status: 'legacy_no_queue' }
  /** 有队列，但还没开考 */
  | { status: 'not_started' }
  /** 开考了还没交卷 */
  | { status: 'in_progress'; answered: number; total: number }
  /**
   * 交卷了。`percentage` 直接读落库的值，**不重算** —— 改词库、改释义
   * 都不会让历史成绩变化。
   */
  | {
      status: 'submitted';
      correct: number;
      total: number;
      percentage: number;
      submittedAt: string;
    };

export interface AttemptRow {
  status: string;
  submittedAt: Date | string | null;
  total: number;
  correct: number;
  score: number;
  items: unknown;
}

/**
 * @param hasQueue  这次任务有没有词汇队列快照（DLC.vocabWords 非 null）
 * @param attempt   这次任务名下的 attempt（没有就传 null）
 */
export function vocabScoreView(
  hasQueue: boolean,
  attempt: AttemptRow | null | undefined,
): VocabScoreView {
  if (!attempt) {
    // 没有 attempt 时，先分清「开不出」和「还没开」——
    // 都显示「没有正式成绩」，但原因不同，文案也不同。
    return hasQueue ? { status: 'not_started' } : { status: 'legacy_no_queue' };
  }

  if (attempt.status !== 'submitted') {
    const items = Array.isArray(attempt.items) ? (attempt.items as any[]) : [];
    return {
      status: 'in_progress',
      answered: items.filter((it) => it?.isCorrect != null).length,
      total: items.length,
    };
  }

  return {
    status: 'submitted',
    correct: attempt.correct,
    total: attempt.total,
    // 落库值，不是这里除出来的 —— 「不重新计算历史分数」的字面意思
    percentage: attempt.score,
    submittedAt:
      attempt.submittedAt instanceof Date
        ? attempt.submittedAt.toISOString()
        : String(attempt.submittedAt ?? ''),
  };
}

/**
 * 有没有一个**可展示的正式成绩**。
 *
 * 注意 0 分是有成绩（`submitted` + `correct=0`），不是没成绩 —— 前端
 * 拿这个函数区分「0 / 8」和「—」，不要用 `!percentage` 之类的真值判断，
 * 那会把 0 分显示成没考。
 */
export function hasFormalVocabScore(v: VocabScoreView): boolean {
  return v.status === 'submitted';
}
