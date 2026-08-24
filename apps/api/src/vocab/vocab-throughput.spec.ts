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

describe('newWordQuota —— 判据是复习债，不是总积压', () => {
  // 2026-08-24 第一版按总积压算，结果锁死了：新词一进本子 due 就是
  // now()、也计入积压，于是「新词多 → 少给新词 → 新词更多」。生产库
  // 2959 词里 2798 个（95%）是从没碰过的，真复习债只有 161。

  it('没有复习债时放开学 —— 一次 8 个，短文层的正常节奏', () => {
    expect(newWordQuota(0, 20)).toBe(8);
    expect(newWordQuota(20, 20)).toBe(8);
  });

  it('复习债重才压新词，但不清零 —— 保住「今天学了新东西」', () => {
    expect(newWordQuota(21, 20)).toBe(2);
    expect(newWordQuota(200, 20)).toBe(2);
  });

  it('批量小时不超过批量本身', () => {
    expect(newWordQuota(0, 5)).toBe(5);
    expect(newWordQuota(0, 3)).toBe(3);
  });

  it('永远至少 1 个新词', () => {
    for (const [debt, batch] of [[0, 1], [100, 5], [500, 20]] as Array<[number, number]>) {
      expect(newWordQuota(debt, batch), `debt=${debt} batch=${batch}`).toBeGreaterThanOrEqual(1);
    }
  });

  it('新词配额不超过当次总配额', () => {
    for (const debt of [0, 21, 200]) {
      const batch = reviewBatchSize(debt);
      expect(newWordQuota(debt, batch)).toBeLessThanOrEqual(batch);
    }
  });

  it('回归：全是新词、零复习债的学生每次能学 8 个，而不是 1 个', () => {
    // 这正是生产库里绝大多数学生的样子。旧实现在这种情况下返回 1，
    // 2798 个新词永远排不上队。
    const batch = reviewBatchSize(219); // 某学生的实际积压
    expect(newWordQuota(0, batch)).toBe(8);
  });
});
