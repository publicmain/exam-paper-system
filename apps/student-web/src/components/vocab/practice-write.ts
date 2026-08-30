/**
 * 自由练习那一侧的**写入小工具**（阶段 12A）。
 *
 * ## 为什么不复用 `lib/review-queue.ts`
 *
 * 那是**课程线**的队列：它每记一次评分，紧接着还要落一次
 * `/lesson/vocab-cursor`（课程断点），两件事都成了才出队。自由练习
 * **不该推进课程断点** —— 学生自己来刷生词本，把「今天的课」刷掉一格，
 * 是最难解释也最难撤回的一种数据污染。
 *
 * 所以这一侧不共用那条队列，只共用**同一条服务端去重协议**：
 *
 *   `requestId` 在第一次尝试之前就分配好，重发一直用同一个。
 *
 * 服务端对 `WordReviewLog.requestId` 有唯一约束 —— 「POST 到了但响应丢了」
 * 的重发会拿到 `duplicate: true`，绝不会被算成两次复习（算两次 FSRS 会
 * 缩短间隔，比漏算更糟）。
 *
 * ## 为什么不落盘
 *
 * 课程线要落盘是因为它有「今天必须完成」的语义：关掉标签页第二天回来，
 * 那一格得补上。自由练习没有这层语义 —— 没评上就是没评上，那张卡下次
 * 还在到期队列里。少一个 localStorage 键，就少一处可能残留在共用设备上
 * 的学习痕迹。
 */

/** 与服务端 `MIN_HONEST_DWELL_MS` 同一个上限：超过 10 分钟按 10 分钟算。 */
export const MAX_ELAPSED_MS = 600_000;

/**
 * 一次评分的去重标识。
 *
 * `crypto.randomUUID` 在 jsdom / 老 WebView 上不一定有，退化成
 * 时间戳 + 随机串 —— 唯一性只需要在**这一个学生的这一条流水**上成立。
 */
export function newRequestId(): string {
  const c = (globalThis as { crypto?: { randomUUID?: () => string } }).crypto;
  if (typeof c?.randomUUID === 'function') return c.randomUUID();
  return `fp-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}

/** 停留时长。服务端会自己再夹一次，这里先夹住是为了别发不合法的数。 */
export function elapsedSince(startedAt: number, now: number): number {
  return Math.max(0, Math.min(now - startedAt, MAX_ELAPSED_MS));
}

/**
 * 一次待写入的评分 —— **`requestId` 属于这次评分，不属于这次网络请求**。
 * 重试时整个对象原样再发一遍，所以 id 不会变。
 */
export interface PendingWrite<R extends string> {
  headword: string;
  rating: R;
  elapsedMs: number;
  requestId: string;
}

/**
 * 拼写题的判定 —— 只抹掉首尾空白与大小写差异。
 *
 * **不做**近似匹配：拼写题考的就是拼写，`recieve` 判成对，学生下次还是
 * 那么拼。服务端不参与判定（自测是自由练习），所以这条规则只写在这里。
 */
export function spellingMatches(input: string, answer: string): boolean {
  return input.trim().toLowerCase() === answer.trim().toLowerCase();
}
