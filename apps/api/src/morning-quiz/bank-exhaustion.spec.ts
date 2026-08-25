import { describe, expect, it } from 'vitest';
import { BankExhaustedError, pickOnExhaustion, repeatAllowed } from './bank-exhaustion';

/**
 * 题库耗尽的处置（2026-08-25 外部审查 P0-2）。
 *
 * 修之前：文档说「绝不重复、题库不足就补内容」，代码却在耗尽时静默
 * 挑最久未用的继续排课。两套相反的规则同时存在，审查一眼看穿。
 *
 * 修之后：默认硬失败（周日生成时失败，我有一周时间补内容），
 * 只有显式设 MORNING_QUIZ_ALLOW_REPEAT=on 才退回 LRU。
 */

const storyKeyOf = (k: string) => k.replace(/_v\d+$/, '');
const detail = { classId: 'c1', bucket: 'IELTS/light', everServed: 10 };

describe('repeatAllowed', () => {
  it('默认不允许重复', () => {
    expect(repeatAllowed(undefined)).toBe(false);
    expect(repeatAllowed('off')).toBe(false);
    expect(repeatAllowed('')).toBe(false);
  });
  it('只有显式 on 才允许', () => {
    expect(repeatAllowed('on')).toBe(true);
    expect(repeatAllowed('true')).toBe(false); // 必须是 'on'，不接受近似值
  });
});

describe('pickOnExhaustion', () => {
  const all = ['a_v1', 'b_v1', 'c_v1'];
  const lastUsed = new Map([['a', 300], ['b', 100], ['c', 200]]);

  it('默认抛 BankExhaustedError，不返回任何卷子', () => {
    expect(() => pickOnExhaustion(all, lastUsed, storyKeyOf, detail)).toThrow(BankExhaustedError);
  });

  it('错误信息含班级、桶、库存量和已服务数 —— 教师据此知道要补多少', () => {
    try {
      pickOnExhaustion(all, lastUsed, storyKeyOf, detail);
      throw new Error('应该抛错');
    } catch (e: any) {
      expect(e.code).toBe('bank_exhausted');
      expect(e.detail).toEqual({ classId: 'c1', bucket: 'IELTS/light', bankSize: 3, everServed: 10 });
      expect(e.message).toContain('库存 3 篇');
      expect(e.message).toContain('MORNING_QUIZ_ALLOW_REPEAT');
    }
  });

  it('开关打开时退回 LRU：挑最久未用的', () => {
    expect(pickOnExhaustion(all, lastUsed, storyKeyOf, detail, 'on')).toBe('b_v1');
  });

  it('LRU 按 storyKey 归一后的时间戳排序（版本无关）', () => {
    const withVersions = ['x_v2', 'y_v1'];
    const used = new Map([['x', 500], ['y', 50]]);
    expect(pickOnExhaustion(withVersions, used, storyKeyOf, detail, 'on')).toBe('y_v1');
  });

  it('从未用过的（无时间戳）排最前 —— 视作最久未用', () => {
    const used = new Map([['a', 300]]);
    expect(pickOnExhaustion(all, used, storyKeyOf, detail, 'on')).not.toBe('a_v1');
  });
});
