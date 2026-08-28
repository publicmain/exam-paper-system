/**
 * AC-03 —— 存储命名空间与清理。
 *
 * 键里不放身份；坏 JSON 与写不进去的 storage 都要**安全失败**；
 * 登出 / 撤销 / 改密码 / 换账号都要在写新令牌**之前**清空 `sw:` 全部数据；
 * 而且**只清 `sw:`**，别人的键一个不动。
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import {
  READING_KEYS,
  FONT_SCALE_KEY,
  readJson,
  writeJson,
  removeKey,
} from '../lesson/storage';
import { clearIdentity, readToken, writeToken, OWNED_STORAGE_PREFIX } from '../lib/identity';
import { adoptSession, logout, afterPasswordChanged, handleAuthFailure, __resetForTest } from '../lib/auth-store';
import { ApiError } from '../lib/api';

const SID = 'sess-1';
const SUB = 'sub-1';

beforeEach(() => {
  localStorage.clear();
  __resetForTest();
});
afterEach(() => {
  vi.restoreAllMocks();
});

describe('AC-03 键的形状', () => {
  it('**四个作用域键 + 字号键，全部在 sw: 命名空间下**', () => {
    expect(READING_KEYS.answers(SID, SUB)).toBe('sw:reading:answers:sess-1:sub-1');
    expect(READING_KEYS.seqs(SID, SUB)).toBe('sw:reading:seqs:sess-1:sub-1');
    expect(READING_KEYS.flags(SID, SUB)).toBe('sw:reading:flags:sess-1:sub-1');
    expect(READING_KEYS.tabOwner(SID)).toBe('sw:reading:tab-owner:sess-1');
    expect(FONT_SCALE_KEY).toBe('sw:fontScale');
    const all = [
      READING_KEYS.answers(SID, SUB),
      READING_KEYS.seqs(SID, SUB),
      READING_KEYS.flags(SID, SUB),
      READING_KEYS.tabOwner(SID),
      FONT_SCALE_KEY,
    ];
    for (const k of all) {
      expect(k).not.toBeNull();
      expect(k!.startsWith(OWNED_STORAGE_PREFIX)).toBe(true);
    }
  });

  it('**键里没有姓名 / studentId** —— 分桶只用 sessionId + submissionId', () => {
    const keys = [
      READING_KEYS.answers(SID, SUB),
      READING_KEYS.seqs(SID, SUB),
      READING_KEYS.flags(SID, SUB),
      READING_KEYS.tabOwner(SID),
    ];
    for (const k of keys) expect(k).not.toMatch(/name|studentId/i);
  });

  it('**没有 submissionId 时不退化成只按 sessionId 分桶** —— 缺分桶依据就不落盘', () => {
    expect(READING_KEYS.answers(SID, null)).toBeNull();
    expect(READING_KEYS.seqs(SID, null)).toBeNull();
    expect(READING_KEYS.flags(SID, null)).toBeNull();
  });

  it('**绝不出现 mq: 键**', () => {
    writeJson(READING_KEYS.answers(SID, SUB), { q1: { textAnswer: 'a' } });
    for (const k of Object.keys(localStorage)) expect(k.startsWith('mq:')).toBe(false);
  });
});

describe('AC-03 安全失败', () => {
  it('坏 JSON → 返回兜底值，不抛', () => {
    localStorage.setItem(READING_KEYS.answers(SID, SUB)!, '{不是 json');
    expect(readJson(READING_KEYS.answers(SID, SUB), { fallback: true })).toEqual({ fallback: true });
  });

  it('键为 null（缺 submissionId）→ 读写都变成空操作', () => {
    expect(readJson(null, { fallback: 1 })).toEqual({ fallback: 1 });
    expect(() => writeJson(null, { a: 1 })).not.toThrow();
    expect(() => removeKey(null)).not.toThrow();
    expect(Object.keys(localStorage)).toEqual([]);
  });

  it('**配额爆了 → 吞掉，不让学生的输入流程崩在存储上**', () => {
    const spy = vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new DOMException('QuotaExceededError');
    });
    expect(() => writeJson(READING_KEYS.answers(SID, SUB), { q1: {} })).not.toThrow();
    spy.mockRestore();
  });

  it('storage 整个不可用 → 读回兜底值', () => {
    const spy = vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new DOMException('SecurityError');
    });
    expect(readJson(READING_KEYS.seqs(SID, SUB), {})).toEqual({});
    spy.mockRestore();
  });
});

describe('AC-03 生命周期清理', () => {
  function seedReadingData() {
    localStorage.setItem(READING_KEYS.answers(SID, SUB)!, JSON.stringify({ q1: { textAnswer: 'a' } }));
    localStorage.setItem(READING_KEYS.seqs(SID, SUB)!, JSON.stringify({ q1: 3 }));
    localStorage.setItem(READING_KEYS.flags(SID, SUB)!, JSON.stringify(['q1']));
    localStorage.setItem(READING_KEYS.tabOwner(SID), JSON.stringify({ tabId: 't', ts: 1 }));
    localStorage.setItem(FONT_SCALE_KEY, '1.2');
  }

  it('**clearIdentity 扫掉整个 sw: 前缀**，包括阅读缓存', () => {
    writeToken('TK');
    seedReadingData();
    clearIdentity();
    expect(Object.keys(localStorage).filter((k) => k.startsWith('sw:'))).toEqual([]);
    expect(readToken()).toBeNull();
  });

  it('**只清 sw:，别人的键一个不动**', () => {
    writeToken('TK');
    seedReadingData();
    localStorage.setItem('other-app:data', 'keep me');
    localStorage.setItem('mq:answers:legacy', 'not mine');
    clearIdentity();
    expect(localStorage.getItem('other-app:data')).toBe('keep me');
    expect(localStorage.getItem('mq:answers:legacy')).toBe('not mine');
  });

  it('**换账号：新令牌写进去之前，上一个学生的阅读缓存必须已经没了**', () => {
    writeToken('OLD');
    seedReadingData();
    const order: string[] = [];
    const realSet = Storage.prototype.setItem;
    const realRemove = Storage.prototype.removeItem;
    const set = vi.spyOn(Storage.prototype, 'setItem').mockImplementation(function (
      this: Storage,
      k: string,
      v: string,
    ) {
      order.push(`set:${k}`);
      realSet.call(this, k, v);
    });
    const rm = vi.spyOn(Storage.prototype, 'removeItem').mockImplementation(function (
      this: Storage,
      k: string,
    ) {
      order.push(`rm:${k}`);
      realRemove.call(this, k);
    });
    adoptSession('NEW', { id: 's', name: 'n', nickname: '', avatar: null });
    set.mockRestore();
    rm.mockRestore();
    const tokenWrite = order.findIndex((o) => o === 'set:sw:token');
    const lastRemove = order.map((o, i) => (o.startsWith('rm:sw:reading') ? i : -1)).filter((i) => i >= 0).pop() ?? -1;
    expect(tokenWrite).toBeGreaterThanOrEqual(0);
    expect(lastRemove).toBeGreaterThanOrEqual(0);
    expect(lastRemove).toBeLessThan(tokenWrite);
  });

  it('换账号后只剩新令牌', () => {
    writeToken('OLD');
    seedReadingData();
    adoptSession('NEW', { id: 's', name: 'n', nickname: '', avatar: null });
    expect(Object.keys(localStorage)).toEqual(['sw:token']);
    expect(readToken()).toBe('NEW');
  });

  it('登出 → sw: 全空', () => {
    writeToken('TK');
    seedReadingData();
    logout();
    expect(Object.keys(localStorage)).toEqual([]);
  });

  it('改密码 → sw: 全空', () => {
    writeToken('TK');
    seedReadingData();
    afterPasswordChanged();
    expect(Object.keys(localStorage)).toEqual([]);
  });

  it('**令牌被撤销 → 阅读缓存也一起清掉**（不能留给下一个人）', () => {
    writeToken('TK');
    seedReadingData();
    const handled = handleAuthFailure(new ApiError(401, { code: 'token_revoked' }));
    expect(handled).toBe(true);
    expect(Object.keys(localStorage)).toEqual([]);
  });
});
