import { describe, expect, it } from 'vitest';

/**
 * 复习吞吐与配额（2026-08-14 调研缺陷一的修复）。
 *
 * 背景数据：采集不限量、复习固定 5 张，两周积出 307 词欠账（22 人）。
 * 纯「欠最久优先」让新词永远等不到第二面 —— 间隔重复最关键的第 2 天
 * 复习点全部错过。
 *
 * 规则（对应 vocab-review.service.due 的实现，这里锁纯逻辑）：
 *   上限：积压 > 20 → 10 张，否则 5 张；显式 limit 可覆盖但硬顶 20
 *   配额：新词（reps=0）最多 3 个、最新加入优先；其余还旧债（欠最久优先）
 */

function dynamicCap(backlog: number, explicit?: number): number {
  const cap = backlog > 20 ? 10 : 5;
  return Math.min(Math.max(explicit ?? cap, 1), 20);
}

type W = { id: string; reps: number; due: number; createdAt: number };

function pickQuota(words: W[], limit: number): W[] {
  const NEW_QUOTA = Math.min(3, limit);
  const fresh = words
    .filter((w) => w.reps === 0)
    .sort((a, b) => b.createdAt - a.createdAt)
    .slice(0, NEW_QUOTA);
  const freshIds = new Set(fresh.map((w) => w.id));
  const old = words
    .filter((w) => !freshIds.has(w.id))
    .sort((a, b) => a.due - b.due || a.createdAt - b.createdAt)
    .slice(0, limit - fresh.length);
  return [...fresh, ...old];
}

describe('dynamicCap —— 上限随积压走', () => {
  it('积压 ≤20：维持 5 张（词少时一次塞多了学生直接跳过）', () => {
    expect(dynamicCap(0)).toBe(5);
    expect(dynamicCap(20)).toBe(5);
  });
  it('积压 >20：提到 10 张，开始还得动本金', () => {
    expect(dynamicCap(21)).toBe(10);
    expect(dynamicCap(307)).toBe(10);
  });
  it('显式 limit 可覆盖，但硬顶 20', () => {
    expect(dynamicCap(300, 15)).toBe(15);
    expect(dynamicCap(300, 99)).toBe(20);
    expect(dynamicCap(0, 0)).toBe(1);
  });
});

describe('pickQuota —— 新词保底，旧债还欠最久的', () => {
  const mk = (id: string, reps: number, due: number, createdAt: number): W => ({ id, reps, due, createdAt });

  it('有新有旧：先给最多 3 个新词（最新加入优先），其余还旧债', () => {
    const words = [
      mk('old1', 3, 1, 1), mk('old2', 2, 2, 2), mk('old3', 5, 3, 3), mk('old4', 1, 4, 4),
      mk('new1', 0, 9, 10), mk('new2', 0, 9, 11), mk('new3', 0, 9, 12), mk('new4', 0, 9, 13),
    ];
    const r = pickQuota(words, 5);
    expect(r).toHaveLength(5);
    // 新词配额 3：createdAt 最大的三个（new4/new3/new2）
    expect(r.slice(0, 3).map((w) => w.id)).toEqual(['new4', 'new3', 'new2']);
    // 剩余 2 个名额给欠最久的旧债
    expect(r.slice(3).map((w) => w.id)).toEqual(['old1', 'old2']);
  });

  it('没有新词：全部名额还旧债 —— 不硬凑', () => {
    const words = [mk('a', 2, 3, 1), mk('b', 1, 1, 2), mk('c', 4, 2, 3)];
    const r = pickQuota(words, 5);
    expect(r.map((w) => w.id)).toEqual(['b', 'c', 'a']);
  });

  it('全是新词：吃满上限，不受 3 个配额限制（旧债名额空出来了）', () => {
    const words = Array.from({ length: 8 }, (_, i) => mk(`n${i}`, 0, 1, i));
    const r = pickQuota(words, 5);
    expect(r).toHaveLength(5);
  });

  it('307 词积压的实际场景：10 张 = 3 新 + 7 最老旧债', () => {
    const olds = Array.from({ length: 300 }, (_, i) => mk(`o${i}`, 1, i, i));
    const news = Array.from({ length: 7 }, (_, i) => mk(`n${i}`, 0, 900 + i, 900 + i));
    const r = pickQuota([...olds, ...news], dynamicCap(307));
    expect(r).toHaveLength(10);
    expect(r.filter((w) => w.reps === 0)).toHaveLength(3);
    expect(r.filter((w) => w.reps > 0).map((w) => w.id)).toEqual(
      ['o0', 'o1', 'o2', 'o3', 'o4', 'o5', 'o6'],
    );
  });
});
