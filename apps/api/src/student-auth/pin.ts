/**
 * 学生 PIN 的纯逻辑（2026-08-25，docs/PRD/student-auth-and-home.md §3）。
 *
 * 格式校验、弱 PIN 黑名单、锁定状态机全部是纯函数 —— service 只做 IO。
 */

export const PIN_LENGTH = 6;
export const MAX_FAILED_ATTEMPTS = 5;
export const LOCK_MINUTES = 15;

/**
 * 弱 PIN 判定。挡住最常见的那 5%：
 *   · 全同（000000 / 111111 …）
 *   · 顺子与倒顺子（123456 / 654321 / 234567 …）
 *   · 年份样式（19xx xx / 20xx xx 太宽会误伤，只挡 1900–2099 开头的
 *     「年份+重复」不现实 —— 实际只挡整段 19xxxx/20xxxx 中的连续年份
 *     常见形：出生年+月日近似难判，放过；黑名单保持克制，挡形态不挡语义）
 */
export function isWeakPin(pin: string): boolean {
  if (/^(\d)\1{5}$/.test(pin)) return true; // 全同
  const digits = [...pin].map(Number);
  const ascending = digits.every((d, i) => i === 0 || d === (digits[i - 1] + 1) % 10);
  const descending = digits.every((d, i) => i === 0 || d === (digits[i - 1] + 9) % 10);
  if (ascending || descending) return true; // 顺子（含 890123 这种回绕）
  return false;
}

export type PinFormatError = 'pin_must_be_6_digits' | 'pin_too_weak' | null;

export function validatePinFormat(pin: string): PinFormatError {
  if (!/^\d{6}$/.test(pin)) return 'pin_must_be_6_digits';
  if (isWeakPin(pin)) return 'pin_too_weak';
  return null;
}

export interface LockState {
  pinFailedCount: number;
  pinLockedUntil: Date | null;
}

/** 现在还锁着吗。 */
export function isLocked(state: LockState, now: Date): boolean {
  return state.pinLockedUntil != null && state.pinLockedUntil.getTime() > now.getTime();
}

/** 剩余锁定秒数（给前端显示「XX 分钟后再试」）。 */
export function lockRemainingSec(state: LockState, now: Date): number {
  if (!isLocked(state, now)) return 0;
  return Math.ceil((state.pinLockedUntil!.getTime() - now.getTime()) / 1000);
}

/**
 * 一次失败后的新状态。到第 MAX 次时上锁并**清零计数** ——
 * 锁到期后学生重新拥有整额尝试，而不是一错就再锁。
 */
export function afterFailure(state: LockState, now: Date): LockState {
  const n = state.pinFailedCount + 1;
  if (n >= MAX_FAILED_ATTEMPTS) {
    return {
      pinFailedCount: 0,
      pinLockedUntil: new Date(now.getTime() + LOCK_MINUTES * 60_000),
    };
  }
  return { pinFailedCount: n, pinLockedUntil: null };
}

/** 成功登录后清零。 */
export function afterSuccess(): LockState {
  return { pinFailedCount: 0, pinLockedUntil: null };
}
