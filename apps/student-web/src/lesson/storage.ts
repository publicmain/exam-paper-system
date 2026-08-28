/**
 * 阅读页的本地存储 —— **全部在 `sw:` 命名空间下**。
 *
 * ## 键的形状（S7A §5.3 冻结）
 *
 * ```
 * sw:reading:answers:<sessionId>:<submissionId>
 * sw:reading:seqs:<sessionId>:<submissionId>
 * sw:reading:flags:<sessionId>:<submissionId>
 * sw:reading:tab-owner:<sessionId>
 * sw:fontScale
 * ```
 *
 * **分桶只用 sessionId + submissionId，不用姓名、不用 studentId。**
 * 答卷 id 已经隐含了学生，而且它来自服务端，不是本地推断出来的。
 *
 * 缺 `submissionId` 时**不退化成只按 sessionId 分桶** —— 那正是旧端
 * 「同一台设备上两个学生互相看见草稿」的成因。宁可不落盘。
 *
 * 清理不在这里：整个 `sw:` 前缀由 `lib/identity.ts` 的 `clearIdentity()`
 * 扫除，登出 / 撤销 / 改密码 / 换账号都会经过它。
 *
 * **绝不读写 `mq:*` 任何键。**
 */

export const FONT_SCALE_KEY = 'sw:fontScale';

const scoped = (kind: string, sessionId: string, submissionId: string | null | undefined) =>
  submissionId ? `sw:reading:${kind}:${sessionId}:${submissionId}` : null;

export const READING_KEYS = {
  answers: (sessionId: string, submissionId: string | null | undefined) =>
    scoped('answers', sessionId, submissionId),
  seqs: (sessionId: string, submissionId: string | null | undefined) =>
    scoped('seqs', sessionId, submissionId),
  flags: (sessionId: string, submissionId: string | null | undefined) =>
    scoped('flags', sessionId, submissionId),
  /** 标签所有权只按会话分 —— 同一台设备上同一场考试只该有一个主标签。 */
  tabOwner: (sessionId: string) => `sw:reading:tab-owner:${sessionId}`,
};

/**
 * 读一个 JSON 键。
 *
 * 三种情况都返回兜底值而不是抛：键是 null（缺分桶依据）、storage 不可用
 * （Safari 隐私模式）、内容不是合法 JSON（被别的东西写坏了）。
 * 学生正在答题，任何一条都不该让页面崩掉。
 */
export function readJson<T>(key: string | null, fallback: T): T {
  if (!key) return fallback;
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return fallback;
    const parsed = JSON.parse(raw) as T;
    return parsed ?? fallback;
  } catch {
    return fallback;
  }
}

/** 写一个 JSON 键。配额爆了就当没写 —— 内存里的状态仍然是对的。 */
export function writeJson(key: string | null, value: unknown): void {
  if (!key) return;
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    /* quota / 隐私模式 —— 忽略 */
  }
}

export function readRaw(key: string | null): string | null {
  if (!key) return null;
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}

export function writeRaw(key: string | null, value: string): void {
  if (!key) return;
  try {
    localStorage.setItem(key, value);
  } catch {
    /* 同上 */
  }
}

export function removeKey(key: string | null): void {
  if (!key) return;
  try {
    localStorage.removeItem(key);
  } catch {
    /* 同上 */
  }
}
