import { describe, expect, it } from 'vitest';
import { newWordQuota, reviewBatchSize } from './vocab-review.service';

/**
 * 生词本的进出平衡。
 *
 * 2026-08-24 的生产数据：519 词，14 天新增 430、复习 156 次，
 * **352 词（68%）从未被复习过**。收集是自动的（答错就采），复习是固定
 * 配额，进出比常年 3:1 —— 生词本成了只涨不落的数字，学生直接放弃。
 *
 * 这两个纯函数就是修那个比例的。下面的断言把意图钉死：积压越深，
 * 每次给得越多、灌进去的新词越少。
 */

describe('reviewBatchSize —— 一次给几张卡', () => {
  it('积压很浅时保持 5 张，别把轻松的日子搞沉重', () => {
    expect(reviewBatchSize(0)).toBe(5);
    expect(reviewBatchSize(20)).toBe(5);
  });

  it('积压过 20 张开始加量', () => {
    expect(reviewBatchSize(21)).toBe(10);
    expect(reviewBatchSize(80)).toBe(12);
  });

  it('积压越深给得越多，但 20 张封顶 —— 再多学生会整个跳过', () => {
    expect(reviewBatchSize(101)).toBe(20);
    expect(reviewBatchSize(500)).toBe(20);
    expect(reviewBatchSize(5000)).toBe(20);
  });

  it('单调不减：积压增加，配额不能反而变小', () => {
    let prev = 0;
    for (const b of [0, 10, 20, 21, 40, 80, 100, 101, 200, 1000]) {
      const v = reviewBatchSize(b);
      expect(v, `backlog=${b}`).toBeGreaterThanOrEqual(prev);
      prev = v;
    }
  });

  it('按当前生产数据（积压约 352）应给满 20 张，是原来 10 张的两倍', () => {
    expect(reviewBatchSize(352)).toBe(20);
  });
});

describe('newWordQuota —— 一次放几个新词', () => {
  it('正常情况 3 个，趁热打铁', () => {
    expect(newWordQuota(0)).toBe(3);
    expect(newWordQuota(100)).toBe(3);
  });

  it('积压过百降到 1 —— 先消化存量，别让 68% 更难看', () => {
    expect(newWordQuota(101)).toBe(1);
    expect(newWordQuota(352)).toBe(1);
  });

  it('永远至少留 1 个新词，保住「今天学了点新东西」的感觉', () => {
    for (const b of [0, 50, 100, 101, 1000]) {
      expect(newWordQuota(b), `backlog=${b}`).toBeGreaterThanOrEqual(1);
    }
  });

  it('新词配额不会超过当次总配额', () => {
    for (const b of [0, 21, 101, 352]) {
      expect(newWordQuota(b)).toBeLessThanOrEqual(reviewBatchSize(b));
    }
  });
});
