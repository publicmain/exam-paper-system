/**
 * 课程评分的弱网队列（阶段 9A）。
 *
 * ## 为什么要有它
 *
 * 旧端的评分 POST 失败被 catch 静默吞掉：学生看到卡片翻过去了，其实
 * FSRS 什么都没记 —— 第二天同一个词又出现，学生的结论是「系统坏了」。
 * 这是 2026-08-24「学生十问」里的第 10 条。
 *
 * ## 与旧端 `reviewQueue` 的关系
 *
 * **行为等价，身份不等价。** 旧队列的每条记录里带 `studentName` /
 * `studentId` —— 那是「姓名即身份」时代的承重结构：补传时要靠它告诉
 * 服务端这是谁的评分。新端的记录里**一个身份字段都没有**：补传时带的是
 * 当时手里的令牌，身份由服务端解。
 *
 * 这个差别不是洁癖。旧记录留在 localStorage 里就是一份可读的学生名单，
 * 而且同一台设备换人登录后，上一个人的队列会顶着**他的名字**补传出去。
 *
 * ## 一条评分的完整生命周期
 *
 * ```
 * 分配 requestId → 先入队（落盘）→ POST /vocab/review
 *                                → POST /lesson/vocab-cursor
 *                                → 出队
 * ```
 *
 * **先入队再发**，不是「失败了才入队」。中间任何一步断掉（断网、杀进程、
 * 关标签页），这条评分都还在盘上，下次启动或 `online` 时接着走。
 *
 * `requestId` **在第一次尝试之前就分配好，重发一直用同一个**。服务端对
 * `WordReviewLog.requestId` 有唯一约束：「POST 到了但响应丢了」的重发会
 * 拿到 `duplicate: true`，绝不会被算成两次复习（算两次 FSRS 会缩短间隔，
 * 比漏算更糟）。
 *
 * ## 为什么记录里要带 cursor
 *
 * 评分和断点是两次写。只补评分不补断点，学生刷新后会从旧位置重来一遍
 * 已经评过的卡。所以每条记录都记住「这一评分之后该停在第几张」，补传时
 * 评分成功了紧接着落断点，**两件事都成了才出队**。
 *
 * 断点落库失败而评分成功时记录留着 —— 重放是安全的，因为 requestId 没变。
 */
import {
  ApiError,
  NetworkError,
  api,
  type CourseRating,
  type VocabCursorResult,
  type VocabReviewResult,
} from './api';

/** 本包命名空间下的唯一一个队列键。清理由 `identity.ts` 的前缀扫除负责。 */
export const QUEUE_KEY = 'sw:vocab:pending';

const MAX_QUEUE = 200;
const MAX_AGE_MS = 48 * 3600_000;
/** 与服务端 `MIN_HONEST_DWELL_MS` 同一个上限：超过 10 分钟按 10 分钟算。 */
export const MAX_ELAPSED_MS = 600_000;

/**
 * 一条待落地的课程评分。
 *
 * **这里不许出现姓名、studentId 或任何身份字段** —— 守卫会检查
 * （contract.test.ts 的 G-9A）。
 */
export interface PendingReview {
  headword: string;
  rating: CourseRating;
  elapsedMs: number;
  /** 第一次尝试之前就分配好；重发一直用它。 */
  requestId: string;
  /** 这条评分之后该停在第几张卡 —— 评分成功后要跟着落库。 */
  cursor: number;
  /** 入队时刻，用来丢弃 48 小时以上的陈旧记录。 */
  ts: number;
}

function safeStorage(): Storage | null {
  try {
    const s = window.localStorage;
    const probe = '__sw_q__';
    s.setItem(probe, '1');
    s.removeItem(probe);
    return s;
  } catch {
    return null;
  }
}

export function readQueue(): PendingReview[] {
  const s = safeStorage();
  if (!s) return [];
  try {
    const raw = s.getItem(QUEUE_KEY);
    const arr: unknown = raw ? JSON.parse(raw) : [];
    if (!Array.isArray(arr)) return [];
    return arr.filter(isRecord);
  } catch {
    return [];
  }
}

/** 只认形状对的记录 —— 被别的东西写坏时宁可丢，也不要拿脏值去发请求。 */
function isRecord(x: unknown): x is PendingReview {
  const r = x as Partial<PendingReview> | null;
  return (
    !!r &&
    typeof r.headword === 'string' &&
    (r.rating === 'again' || r.rating === 'good') &&
    typeof r.requestId === 'string' &&
    typeof r.cursor === 'number' &&
    typeof r.ts === 'number'
  );
}

/**
 * 落盘，**并如实报告成没成**。
 *
 * 原来这里把失败静默吞了 —— 于是「队列写不进去」和「队列写进去了」在调用
 * 方看来一模一样，学生会拿到一句「已经存下来了」，而盘上什么都没有。
 * 存储满、隐私模式、被扩展禁掉都会走到这里，它必须是可观测的。
 */
function writeQueue(q: PendingReview[]): boolean {
  const s = safeStorage();
  if (!s) return false;
  try {
    // 超长时丢**最旧的**：新的评分对调度更有价值，旧的多半已经过时。
    s.setItem(QUEUE_KEY, JSON.stringify(q.slice(-MAX_QUEUE)));
    return true;
  } catch {
    return false;
  }
}

/** 丢弃过期记录，顺手把清理后的结果落盘。 */
function liveQueue(now: number): PendingReview[] {
  const q = readQueue();
  const fresh = q.filter((p) => now - p.ts < MAX_AGE_MS);
  if (fresh.length !== q.length) writeQueue(fresh);
  return fresh;
}

export function pendingCount(now: number = Date.now()): number {
  return liveQueue(now).length;
}

export function newRequestId(): string {
  try {
    return crypto.randomUUID();
  } catch {
    // 没有 crypto.randomUUID 的旧 WebView：唯一性只需要在一台设备的
    // 队列范围内成立，服务端那边有唯一约束兜底。
    return `rq-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
  }
}

/**
 * 入队，**并回读确认这条真的在盘上**。
 *
 * 只看 `setItem` 有没有抛是不够的：有的环境（隐私模式、被扩展劫持的
 * storage）写了不抛也不存。这条评分的全部保障就是「它在盘上」，所以
 * 这里必须亲眼看见它才算数。
 */
function enqueue(rec: PendingReview): boolean {
  if (!writeQueue([...readQueue(), rec])) return false;
  return readQueue().some((p) => p.requestId === rec.requestId);
}

function dequeue(requestId: string): void {
  writeQueue(readQueue().filter((p) => p.requestId !== requestId));
}

/**
 * 这类失败**重试没有意义**：记录本身不合法（词被删了、评分值非法）。
 * 留在队里只会攒垃圾，每次启动都白发一遍。
 *
 * 401 / 令牌撤销**不算**这一类 —— 那是身份问题，换一张票之后这条评分
 * 依然有效，所以交给调用方走既有登出，记录留着。
 * 429 也不算：那是「慢一点」，不是「不行」。
 */
function isPermanentlyInvalid(e: unknown): boolean {
  if (!(e instanceof ApiError)) return false;
  if (e.isAuthFailure) return false;
  if (e.status === 429) return false;
  return e.status >= 400 && e.status < 500;
}

export type ReviewOutcome =
  /** 评分与断点都落库了。`result` 是服务端的回答。 */
  | { status: 'ok'; result: VocabReviewResult }
  /** 还在队里 —— 已经落盘，会补传，但**不能说服务端已经记下了**。 */
  | { status: 'queued' }
  /** 这条评分本身不合法，已经丢弃。 */
  | { status: 'invalid'; error: unknown }
  /**
   * **没能落盘，所以一个请求都没发。**
   *
   * 这是「存不下」，不是「存下了等补传」—— 两者对学生的意思完全相反，
   * 绝不能合并成一个状态。
   */
  | { status: 'unstored' };

/**
 * 走完一条记录：评分 → 断点 → 出队。
 *
 * 顺序是冻结的：**断点落库之前不出队**。反过来（先出队再落断点）会在
 * 断点这一步失败时把「学生评过这张卡」的证据一起弄丢。
 */
async function drive(token: string, rec: PendingReview): Promise<ReviewOutcome> {
  let result: VocabReviewResult;
  try {
    result = await api.vocabReview(token, {
      headword: rec.headword,
      rating: rec.rating,
      elapsedMs: rec.elapsedMs,
      requestId: rec.requestId,
    });
  } catch (e) {
    if (isPermanentlyInvalid(e)) {
      dequeue(rec.requestId);
      return { status: 'invalid', error: e };
    }
    // 网络错误 / 5xx / 429 / 认证失败 —— 都留在队里。
    if (e instanceof ApiError && e.isAuthFailure) throw e;
    return { status: 'queued' };
  }

  if (result.tooFast) {
    // 服务端**没有写调度** —— 这一张根本没算数，断点自然也不能落。
    //
    // 而且必须**出队**：那条 tooFast 流水同样带着 requestId，留在队里的话
    // 下次补传会拿到 `duplicate: true`，于是一路走到落断点那一步 ——
    // 把一张学生根本没学会的卡永久地推过去。
    dequeue(rec.requestId);
    return { status: 'ok', result };
  }

  let cursorRes: VocabCursorResult;
  try {
    cursorRes = await api.vocabCursor(token, { cursor: rec.cursor });
  } catch (e) {
    if (e instanceof ApiError && e.isAuthFailure) throw e;
    if (isPermanentlyInvalid(e)) {
      // 这个断点本身服务端就不收，重试多少次都一样。
      dequeue(rec.requestId);
      return { status: 'invalid', error: e };
    }
    // 评分成了、断点没成 —— **记录留着**。重放评分是安全的（requestId 没变，
    // 服务端会回 duplicate），而断点必须补上，否则刷新后重做已评过的卡。
    return { status: 'queued' };
  }

  if (!cursorRes.stored) {
    // `stored: false` = 当日任务行不存在，**断点没有落库**。响应是 200，
    // 但这件事没成 —— 当成完成就等于把进度丢了。记录留着，requestId 不变。
    return { status: 'queued' };
  }

  dequeue(rec.requestId);
  return { status: 'ok', result };
}

/**
 * 提交一次课程评分。
 *
 * **落盘成功之前一个请求都不发。** 这条评分的全部保障就是「它在盘上」——
 * 盘上没有它却把请求发出去，失败时就真的凭空消失了，而学生已经看到
 * 「存下来了」。存不下就如实说存不下，让学生再点一次。
 */
export async function submitCourseReview(
  token: string,
  input: { headword: string; rating: CourseRating; elapsedMs: number; cursor: number },
): Promise<ReviewOutcome> {
  const rec: PendingReview = {
    headword: input.headword,
    rating: input.rating,
    elapsedMs: Math.max(0, Math.min(Math.floor(input.elapsedMs), MAX_ELAPSED_MS)),
    requestId: newRequestId(),
    cursor: input.cursor,
    ts: Date.now(),
  };
  if (!enqueue(rec)) return { status: 'unstored' };
  return drive(token, rec);
}

/**
 * 补传。**串行**，一条走完再走下一条。
 *
 * 并行补传会让同一个词的多条评分乱序到达，FSRS 的调度就变成了不确定的；
 * 断点也会互相覆盖（服务端是单调钳制，落后的写入直接 no-op，但顺序仍然
 * 影响最终值）。
 */
let flushing = false;

export async function flushPending(token: string): Promise<{ flushed: number; remaining: number }> {
  if (flushing) return { flushed: 0, remaining: pendingCount() };
  flushing = true;
  let flushed = 0;
  try {
    for (const rec of liveQueue(Date.now())) {
      const out = await drive(token, rec);
      if (out.status === 'queued') break; // 网络还没好，别把剩下的也白发一遍
      flushed += 1;
    }
  } finally {
    flushing = false;
  }
  return { flushed, remaining: pendingCount() };
}

/** 仅供测试重置模块级的并发闸。 */
export function __resetFlushGuardForTest(): void {
  flushing = false;
}

/** 网络错误也算「留在队里」的一种 —— 这里只是把判断集中在一处。 */
export function isRetryable(e: unknown): boolean {
  if (e instanceof NetworkError) return true;
  return !isPermanentlyInvalid(e);
}
