/**
 * RC1.1 —— staging 人工测试抓到的那几条边界，收成纯函数（无 IO）。
 *
 * 每一条都对应一个实测到的错误行为，注释里写着它长什么样。放在这里而不是
 * 散在服务里，是为了让它们能被**直接**测到 —— 在测试文件里另抄一份判断，
 * 改回旧口径也不会红。
 */

// ─────────────────────────────────────────────────────────────
// B —— 自由练习不得改变正式课程的目标与范围
// ─────────────────────────────────────────────────────────────

/**
 * 词段的目标数。
 *
 * 旧口径是「此刻仍到期的词数」。学生在开始今天的课之前先去自由练习做掉
 * 一张，那张的 due 被 FSRS 推到明天 —— 分母当场少一个。人工测试实测：
 * 「背 · 今日词汇」从 0/4 变成 1/3，随后冻结出来的正式考试范围也只剩
 * 3 个词。
 *
 * 现在：任务已冻结就认队列；没冻结就算「今天到期过的」（把今天已经复习
 * 掉的加回来），复习不会让它缩水。
 */
export function vocabTargetOf(input: {
  frozenQueue: readonly string[] | null;
  dueNow: number;
  reviewedTodayCount: number;
}): number {
  if (input.frozenQueue) return input.frozenQueue.length;
  return input.dueNow + input.reviewedTodayCount;
}

/**
 * 词段的进度 —— **只认当前任务队列里的词**。
 *
 * 旧口径数的是这个学生今天所有的复习流水，不管那张卡属不属于今天的任务、
 * 是不是在课程里做的。于是自由练习一张，正式进度就 +1。
 *
 * 没有冻结队列 = 还没开始今天的课，谈不上正式进度。
 */
export function vocabProgressOf(input: {
  frozenQueue: readonly string[] | null;
  reviewedTodayWords: readonly string[];
}): number {
  if (!input.frozenQueue) return 0;
  const q = new Set(input.frozenQueue);
  return input.reviewedTodayWords.filter((w) => q.has(w)).length;
}

// ─────────────────────────────────────────────────────────────
// C —— 课程词卡来自固定队列
// ─────────────────────────────────────────────────────────────

/**
 * 课程发卡顺序：**队列顺序就是发卡顺序**。
 *
 * 旧口径走 \`/vocab/due\`（实时到期 + 配额 + 新旧配比）。实测三种后果：
 * 发卡顺序与任务队列相反（教完第 1 张刷新"回到第 1 张"其实是另一张）、
 * 教过的词 firstTaughtAt 一写就从教学卡变成挖空复习卡、复习掉一张分母
 * 从 3 缩成 2。
 *
 * 队列里有而生词本里没有的词（被移除过）跳过，但绝不改动其余的顺序。
 */
export function lessonCardOrder(
  queue: readonly string[],
  ownedHeadwords: readonly string[],
): string[] {
  const owned = new Set(ownedHeadwords);
  return queue.filter((w) => owned.has(w));
}

// ─────────────────────────────────────────────────────────────
// D —— 正式测试的答案下发
// ─────────────────────────────────────────────────────────────

/**
 * 这一题该不该下发正确答案。
 *
 * 作答前不下发（下发了等于把答案放进 devtools）；**已作答的那一题要下发**
 * —— 前端得靠它标出正确项。实测：学生选对了却全被标成 ✗，因为前端拿
 * correctIndex 判对错，而它在作答前是 null，没有一个选项能"等于正确答案"。
 *
 * 已答的题下发不构成作弊：作答是一次性的（服务端幂等挡住改答案）。
 */
export function shouldRevealAnswer(input: { submitted: boolean; answered: boolean }): boolean {
  return input.submitted || input.answered;
}

// ─────────────────────────────────────────────────────────────
// E —— 正式提交后的阶段推进
// ─────────────────────────────────────────────────────────────

/**
 * 提交这一下之后，阶段应该是什么。
 *
 * 实测：attempt 已经 submitted、成绩 4/4，DailyLessonCompletion.stage
 * 还停在 vocab_test —— 展示层说完成了，持久化层说没有。
 *
 * 单调：只从 vocab_test 往前走。已经是 done 的不动（重复提交幂等），
 * 还没走到 vocab_test 的也不越级（那说明前面的步骤没完成，阶段门会先拦）。
 */
export function stageAfterSubmit(currentStage: string, applied: boolean): string {
  if (!applied) return currentStage;
  return currentStage === 'vocab_test' ? 'done' : currentStage;
}

// ─────────────────────────────────────────────────────────────
// F —— 无内容日
// ─────────────────────────────────────────────────────────────

/**
 * 今天有没有事情要做。
 *
 * 三段目标全是 0 时，deriveStage 会认为三段都 settled → done，连续天数
 * 也把这种行算作学习日。实测：无内容账号进课程页看到「🎉 今天的课完成了 ·
 * 连续 1 天」，库里留下一条 stage=done —— 一个没有内容的日子被算成了
 * 学习日。
 *
 * 没有内容就没有任务：不建任务行、不报完成度、不进连续天数。
 */
export function hasAnyTask(input: {
  hasSession: boolean;
  vocabTarget: number;
  drillTarget: number;
}): boolean {
  return input.hasSession || input.vocabTarget > 0 || input.drillTarget > 0;
}

/** 无任务时完成度报 0 —— 「三段都完成」是没有目标的副产物，不是他做完了。 */
export function progressForDisplay(
  raw: { completed: number; total: number },
  anyTask: boolean,
): { completed: number; total: number } {
  return anyTask ? raw : { completed: 0, total: raw.total };
}
