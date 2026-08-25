/**
 * 题库耗尽时怎么办（2026-08-25 外部审查 P0-2 的修复）。
 *
 * ## 修之前的矛盾
 *
 * CLAUDE.md 和 SYSTEM-DESIGN.md 都把「任何班级绝不重复做同一个 story」
 * 写成铁律，并明确「题库不足时补充新内容，不做 LRU 回收」。
 * 但代码的两个抽题分支（passage_pick / olevel）在候选耗尽时都会
 * **静默挑一个最久未用的继续排课**，只写一条 warning。
 *
 * 也就是说：文档写的是政策，代码干的是相反的事。审查一眼看穿。
 *
 * ## 修之后
 *
 * 默认**硬失败**：抛 BankExhaustedError，该层该日排课失败。
 * 调用方（batchGenerateForWeek）的 try/catch 会把它记进 outcomes
 * （`ok:false, code:'bank_exhausted'`）且**不连累其他层** —— 这一点
 * 是安全的前提，已核对过调用方实现。
 *
 * 为什么硬失败是对的：抽题发生在**周日批量生成**时，离学生真正需要
 * 卷子还有一整周。这时候失败，我有七天时间补内容；静默回收则要等到
 * 学生第二次做到同一篇文章才会有人发现。
 *
 * ## 紧急出口
 *
 * `MORNING_QUIZ_ALLOW_REPEAT=on` 时退回旧的 LRU 行为。留这个开关是因为
 * 「学生明早没卷子做」比「重复做一篇」更糟 —— 但它必须是**显式决策**，
 * 不能是默认行为。
 */

export class BankExhaustedError extends Error {
  readonly code = 'bank_exhausted';
  constructor(
    readonly detail: {
      classId: string;
      bucket: string;
      bankSize: number;
      everServed: number;
    },
  ) {
    super(
      `题库耗尽：class=${detail.classId} bucket=${detail.bucket} ` +
        `(库存 ${detail.bankSize} 篇，已全部服务过 ${detail.everServed} 篇)。` +
        `补充新内容后重新生成，或临时设 MORNING_QUIZ_ALLOW_REPEAT=on 允许重复。`,
    );
    this.name = 'BankExhaustedError';
  }
}

export function repeatAllowed(env = process.env.MORNING_QUIZ_ALLOW_REPEAT): boolean {
  return env === 'on';
}

/**
 * 候选耗尽时的决策。纯函数，可测。
 *
 * @param all        题库全部候选（按 story 归一后的 key）
 * @param lastUsedAt story → 最近一次服务的时间戳
 * @returns 允许重复时返回最久未用的那个；否则抛 BankExhaustedError
 */
export function pickOnExhaustion(
  all: string[],
  lastUsedAt: Map<string, number>,
  storyKeyOf: (k: string) => string,
  detail: { classId: string; bucket: string; everServed: number },
  env?: string,
): string {
  if (!repeatAllowed(env)) {
    throw new BankExhaustedError({ ...detail, bankSize: all.length });
  }
  const sorted = [...all].sort(
    (a, b) => (lastUsedAt.get(storyKeyOf(a)) ?? 0) - (lastUsedAt.get(storyKeyOf(b)) ?? 0),
  );
  return sorted[0];
}
