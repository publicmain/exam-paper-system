import { api } from './api';

/**
 * 复习评分的弱网队列（2026-08-24 学生十问修复 #10）。
 *
 * 原来评分 POST 失败被 catch 静默吞掉：学生看到卡片翻过去了，其实
 * FSRS 什么都没记 —— 第二天同一个词又出现，学生的结论是「系统坏了」。
 *
 * 现在：失败的评分进 localStorage 队列，下次打开任何词汇页面时自动
 * 补传。每次评分带 requestId（服务端唯一约束去重），「POST 成功但
 * 响应丢了」的重发不会被记成两次复习。
 *
 * 语义取舍：补传时 FSRS 用的是补传时刻，间隔会差几小时 —— 相比
 * 「整次复习凭空消失」，这是正确的一边。48 小时以上的旧评分丢弃
 * （那时该词多半已经又被复习过，补传反而搅浑调度）。
 */

const KEY = 'vocab:pendingReviews';
const MAX_QUEUE = 200;
const MAX_AGE_MS = 48 * 3600_000;

export interface PendingReview {
  studentName: string;
  studentId?: string;
  headword: string;
  rating: string;
  elapsedMs?: number;
  requestId: string;
  ts: number;
}

function readQueue(): PendingReview[] {
  try {
    const raw = localStorage.getItem(KEY);
    const arr = raw ? JSON.parse(raw) : [];
    return Array.isArray(arr) ? arr : [];
  } catch {
    return [];
  }
}

function writeQueue(q: PendingReview[]) {
  try {
    localStorage.setItem(KEY, JSON.stringify(q.slice(-MAX_QUEUE)));
  } catch {
    /* localStorage 满 / 禁用：只能放弃排队，行为退回从前 */
  }
}

export function newRequestId(): string {
  try {
    return crypto.randomUUID();
  } catch {
    return `rq-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
  }
}

/**
 * 提交一次评分；失败自动入队。
 * 返回：服务端响应（成功），或 { queued: true }（已入队，稍后补传）。
 */
export async function submitReview(input: Omit<PendingReview, 'requestId' | 'ts'>): Promise<
  | { queued: true }
  | { queued?: false; headword: string; state: string; intervalDays: number; reps: number }
> {
  const requestId = newRequestId();
  try {
    return await api.vocabReview({ ...input, requestId });
  } catch {
    writeQueue([...readQueue(), { ...input, requestId, ts: Date.now() }]);
    return { queued: true };
  }
}

let flushing = false;

/** 补传队列。词汇相关页面加载时调用；并发防抖，失败的留在队里。 */
export async function flushPending(): Promise<void> {
  if (flushing) return;
  const q = readQueue().filter((p) => Date.now() - p.ts < MAX_AGE_MS);
  if (!q.length) {
    writeQueue([]);
    return;
  }
  flushing = true;
  const remaining: PendingReview[] = [];
  try {
    for (const p of q) {
      try {
        await api.vocabReview({
          studentName: p.studentName,
          studentId: p.studentId,
          headword: p.headword,
          rating: p.rating,
          elapsedMs: p.elapsedMs,
          requestId: p.requestId,
        });
      } catch (e: any) {
        // 4xx = 这条本身不合法（词被删了 / 姓名解析不了），重试无意义，丢弃；
        // 网络错误 / 5xx / 429 留队里下次再试
        const status = e?.status;
        if (!(typeof status === 'number' && status >= 400 && status < 500)) {
          remaining.push(p);
        }
      }
    }
  } finally {
    writeQueue(remaining);
    flushing = false;
  }
}

/** 队列现存条数（给页面显示「有 N 条评分待补传」）。 */
export function pendingCount(): number {
  return readQueue().length;
}
