import { describe, expect, it } from 'vitest';
import { nextTeachingDays } from '../daily-ops-check';

describe('nextTeachingDays（OPS03/OPS04 巡检脚本的纯函数部分）', () => {
  it('从周一起连续 5 天，含起始日，跳过周末', () => {
    expect(nextTeachingDays('2026-09-14', 5)).toEqual([
      '2026-09-14',
      '2026-09-15',
      '2026-09-16',
      '2026-09-17',
      '2026-09-18',
    ]);
  });

  it('从周五起，第二天起跳过周末落到下周一', () => {
    expect(nextTeachingDays('2026-09-11', 3)).toEqual(['2026-09-11', '2026-09-14', '2026-09-15']);
  });

  it('从周六 / 周日起，第一天就是下一个工作日', () => {
    expect(nextTeachingDays('2026-09-12', 2)).toEqual(['2026-09-14', '2026-09-15']);
    expect(nextTeachingDays('2026-09-13', 2)).toEqual(['2026-09-14', '2026-09-15']);
  });

  it('n=0 返回空数组', () => {
    expect(nextTeachingDays('2026-09-14', 0)).toEqual([]);
  });
});
