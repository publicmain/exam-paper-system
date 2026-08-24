import { describe, expect, it } from 'vitest';
import {
  LEVEL_REGISTRY,
  levelBucket,
  levelLabel,
  levelPushesWordlist,
  levelsByOrder,
} from './level-registry';

/**
 * 等级注册表是「枚举名 → 显示名 / 题库桶」的唯一事实来源。
 *
 * 这张表存在的原因是枚举名和实际含义早就对不上：`ielts_simplified`
 * 这个位置原本是「轻雅思」，2026-08-14 起装的是「O-Level 基础」的内容。
 * 库里挂着几个月的历史数据，重命名的风险远大于收益，所以枚举名冻结、
 * 语义由这张表表达。
 *
 * 下面的断言等于把这份约定钉死：谁再加等级、改桶、调顺序，跑一遍就知道
 * 有没有踩到既有语义。
 */

describe('LEVEL_REGISTRY', () => {
  it('五个等级全部登记', () => {
    expect(Object.keys(LEVEL_REGISTRY).sort()).toEqual(
      ['ielts_authentic', 'ielts_light', 'ielts_simplified', 'olevel', 'olevel_intermediate'].sort(),
    );
  });

  it('ielts_simplified 显示成「O-Level 基础」—— 枚举名是历史包袱，别照着它显示', () => {
    expect(levelLabel('ielts_simplified')).toBe('O-Level 基础');
    expect(levelBucket('ielts_simplified')).toBe('olevel_basic');
  });

  it('olevel_intermediate 读的是那 21 篇一直闲置的 simplified 桶', () => {
    expect(levelBucket('olevel_intermediate')).toBe('olevel_simplified');
    expect(levelLabel('olevel_intermediate')).toBe('O-Level 进阶');
  });

  it('雅思轻量有自己的桶，绝不与真题混', () => {
    expect(levelBucket('ielts_light')).toBe('ielts_light');
    expect(levelBucket('ielts_authentic')).toBe('ielts_authentic');
    expect(levelBucket('ielts_light')).not.toBe(levelBucket('ielts_authentic'));
  });

  it('每个等级的桶互不相同 —— 两个等级共用一个桶就会互相抽走对方的卷子', () => {
    const buckets = Object.values(LEVEL_REGISTRY).map((m) => m.bucket);
    expect(new Set(buckets).size).toBe(buckets.length);
  });

  it('order 唯一且由难到易', () => {
    const orders = Object.values(LEVEL_REGISTRY).map((m) => m.order);
    expect(new Set(orders).size).toBe(orders.length);
    expect(levelsByOrder()).toEqual([
      'ielts_authentic',
      'ielts_light',
      'olevel',
      'olevel_intermediate',
      'ielts_simplified',
    ]);
  });

  it('只有短文层推送配套词表', () => {
    // 推词表的判据必须走注册表。写死判 ielts_simplified 的老代码在加
    // 雅思轻量时必然漏掉，这条就是防那个回归的。
    expect(levelPushesWordlist('ielts_light')).toBe(true);
    expect(levelPushesWordlist('ielts_simplified')).toBe(true);
    expect(levelPushesWordlist('ielts_authentic')).toBe(false);
    expect(levelPushesWordlist('olevel')).toBe(false);
    expect(levelPushesWordlist('olevel_intermediate')).toBe(false);
  });

  it('每个等级都有非空的显示名和说明', () => {
    for (const [level, meta] of Object.entries(LEVEL_REGISTRY)) {
      expect(meta.label, level).toBeTruthy();
      expect(meta.hint, level).toBeTruthy();
    }
  });

  it('未登记的等级回落到原名，不抛异常 —— 面板不能因此白屏', () => {
    expect(levelLabel('something_new')).toBe('something_new');
  });
});
