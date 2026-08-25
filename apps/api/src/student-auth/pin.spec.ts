import { describe, expect, it } from 'vitest';
import {
  MAX_FAILED_ATTEMPTS,
  afterFailure,
  afterSuccess,
  isLocked,
  isWeakPin,
  lockRemainingSec,
  validatePinFormat,
  type LockState,
} from './pin';

describe('validatePinFormat', () => {
  it('必须是 6 位纯数字', () => {
    expect(validatePinFormat('12345')).toBe('pin_must_be_6_digits');
    expect(validatePinFormat('1234567')).toBe('pin_must_be_6_digits');
    expect(validatePinFormat('12a456')).toBe('pin_must_be_6_digits');
    expect(validatePinFormat('')).toBe('pin_must_be_6_digits');
  });
  it('弱 PIN 拒绝', () => {
    expect(validatePinFormat('000000')).toBe('pin_too_weak');
    expect(validatePinFormat('999999')).toBe('pin_too_weak');
    expect(validatePinFormat('123456')).toBe('pin_too_weak');
    expect(validatePinFormat('654321')).toBe('pin_too_weak');
    expect(validatePinFormat('890123')).toBe('pin_too_weak'); // 回绕顺子
  });
  it('正常 PIN 通过', () => {
    expect(validatePinFormat('280519')).toBeNull();
    expect(validatePinFormat('730214')).toBeNull();
  });
});

describe('isWeakPin', () => {
  it('生日样式不在黑名单（挡形态不挡语义 —— 黑名单保持克制）', () => {
    expect(isWeakPin('200812')).toBe(false);
    expect(isWeakPin('091103')).toBe(false);
  });
});

describe('锁定状态机', () => {
  const now = new Date('2026-08-25T04:00:00Z');
  // 显式注解：字面量会把 pinLockedUntil 推断成 null 类型，
  // 后续赋值 LockState 会炸 nest build（本地 tsc --noEmit 抓不到 ——
  // 两者配置不同，2026-08-25 部署失败的教训：提交前要跑 nest build）
  const fresh: LockState = { pinFailedCount: 0, pinLockedUntil: null };

  it('前 4 次失败只计数，不锁', () => {
    let s = fresh;
    for (let i = 1; i < MAX_FAILED_ATTEMPTS; i++) {
      s = afterFailure(s, now);
      expect(s.pinFailedCount).toBe(i);
      expect(s.pinLockedUntil).toBeNull();
    }
  });

  it('第 5 次失败：锁 15 分钟并清零计数（锁到期后重新拥有整额尝试）', () => {
    let s = fresh;
    for (let i = 0; i < MAX_FAILED_ATTEMPTS; i++) s = afterFailure(s, now);
    expect(s.pinLockedUntil!.getTime()).toBe(now.getTime() + 15 * 60_000);
    expect(s.pinFailedCount).toBe(0);
    expect(isLocked(s, now)).toBe(true);
    expect(lockRemainingSec(s, now)).toBe(900);
  });

  it('锁过期后自动解锁', () => {
    const locked = { pinFailedCount: 0, pinLockedUntil: new Date(now.getTime() + 60_000) };
    expect(isLocked(locked, now)).toBe(true);
    expect(isLocked(locked, new Date(now.getTime() + 61_000))).toBe(false);
    expect(lockRemainingSec(locked, new Date(now.getTime() + 61_000))).toBe(0);
  });

  it('成功登录清零一切', () => {
    expect(afterSuccess()).toEqual({ pinFailedCount: 0, pinLockedUntil: null });
  });
});
