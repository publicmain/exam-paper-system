/**
 * 课程学词的纯逻辑 —— 遮词、断点钳制、停留判定。
 *
 * 这三条各自都能单独毁掉这一屏：遮词漏一个变位 = 答案印在题面上；
 * 断点钳错 = 学生进度倒退；停留判错 = 服务端把诚实复习判成秒选。
 */
import { describe, it, expect } from 'vitest';
import {
  BLANK,
  MAX_ELAPSED_MS,
  MIN_DWELL_MS,
  advanceCursor,
  clampCursor,
  concealTarget,
  dwellSatisfied,
  elapsedFrom,
} from '../lib/vocab-card';

describe('遮词', () => {
  it('遮掉原形', () => {
    const r = concealTarget('The river runs north.', 'runs');
    expect(r.text).toBe(`The river ${BLANK} north.`);
    expect(r.masked).toBe(true);
  });

  it('**原文形式和原形都要遮** —— 只遮原形等于泄题', () => {
    const r = concealTarget('He was running fast.', 'run', 'running');
    expect(r.text).toBe(`He was ${BLANK} fast.`);
  });

  it('**先长后短**：running 不会被拆成 ___ning', () => {
    const r = concealTarget('running and run', 'run', 'running');
    expect(r.text).toBe(`${BLANK} and ${BLANK}`);
  });

  it('常见屈折后缀一并遮掉', () => {
    expect(concealTarget('Two cities burned.', 'city', 'cities').text).toBe(
      `Two ${BLANK} burned.`,
    );
    expect(concealTarget('He walked home.', 'walk').text).toBe(`He ${BLANK} home.`);
  });

  it('大小写不敏感', () => {
    expect(concealTarget('Nile is long.', 'nile').text).toBe(`${BLANK} is long.`);
  });

  it('**遮不干净就整句不给** —— 少一句例句，好过泄题', () => {
    // 复合词里的 run：\b 边界卡不住，兜底检查会发现残留
    const r = concealTarget('The runaway train.', 'run');
    expect(r.text).toBeNull();
    expect(r.masked).toBe(true);
  });

  it('没有例句 / 空句 → null，不假装有', () => {
    expect(concealTarget(null, 'x').text).toBeNull();
    expect(concealTarget('   ', 'x').text).toBeNull();
  });

  it('例句里根本没出现这个词 → 原样返回，masked=false', () => {
    const r = concealTarget('Nothing to see here.', 'nile');
    expect(r.text).toBe('Nothing to see here.');
    expect(r.masked).toBe(false);
  });

  it('**正则元字符不会炸**（词里带点号 / 括号）', () => {
    expect(() => concealTarget('a.b is here', 'a.b')).not.toThrow();
    expect(concealTarget('cost (approx) rose', 'approx').text).toContain(BLANK);
  });
});

describe('断点', () => {
  it('钳到 [0, total]', () => {
    expect(clampCursor(3, 5)).toBe(3);
    expect(clampCursor(-1, 5)).toBe(0);
    expect(clampCursor(99, 5)).toBe(5);
  });

  it('**脏值一律回 0，不让它进数组下标**', () => {
    for (const bad of [NaN, Infinity, -Infinity, undefined, null, 'x', {}]) {
      expect(clampCursor(bad, 5)).toBe(0);
    }
  });

  it('小数向下取整', () => {
    expect(clampCursor(2.9, 5)).toBe(2);
  });

  it('**只进不退** —— 落后的上报不能把进度拽回去', () => {
    expect(advanceCursor(4, 2, 10)).toBe(4);
    expect(advanceCursor(4, 7, 10)).toBe(7);
    // 服务端在「当日任务行不存在」时会回读到 0 —— 这个 0 也不许倒退
    expect(advanceCursor(4, 0, 10)).toBe(4);
  });
});

describe('停留', () => {
  it('1.5 秒是门槛，且与服务端同一个数', () => {
    expect(MIN_DWELL_MS).toBe(1500);
    expect(dwellSatisfied(1000, 1000 + 1499)).toBe(false);
    expect(dwellSatisfied(1000, 1000 + 1500)).toBe(true);
  });

  it('还没显示答案 → 永远不满足', () => {
    expect(dwellSatisfied(null, 9e9)).toBe(false);
  });

  it('耗时从显示答案算起，封顶 10 分钟', () => {
    expect(elapsedFrom(1000, 3000)).toBe(2000);
    expect(elapsedFrom(0, 9_999_999)).toBe(MAX_ELAPSED_MS);
    // 时钟倒退也不给负数
    expect(elapsedFrom(5000, 1000)).toBe(0);
  });
});
