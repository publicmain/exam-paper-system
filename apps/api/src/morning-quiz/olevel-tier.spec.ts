import { describe, expect, it } from 'vitest';
import {
  OLEVEL_BASIC_TAG,
  OLEVEL_SIMPLIFIED_TAG,
  olevelTierCondition,
} from './morning-quiz.service';

/**
 * OLEVEL 题库三层分桶（2026-08-14）。
 *
 * 关键不变量：**standard 层必须排除所有非标准 tag**。这是排除法定义，
 * 加新层时最容易漏 —— 一旦漏了，基础层的 5 题短卷会被抽进标准 O-Level
 * 层，最强的学生拿到最简单的卷子且当天成绩不可比。
 */

describe('olevelTierCondition', () => {
  it('basic 层：只取 basic tag', () => {
    expect(olevelTierCondition('basic')).toEqual({ provenanceTag: OLEVEL_BASIC_TAG });
  });

  it('simplified 层：只取 simplified tag（中间层内容原地保留）', () => {
    expect(olevelTierCondition('simplified')).toEqual({
      provenanceTag: OLEVEL_SIMPLIFIED_TAG,
    });
  });

  it('standard 层：排除 basic 和 simplified 两个 tag', () => {
    const c = olevelTierCondition('standard') as { NOT: { provenanceTag: { in: string[] } } };
    expect(c.NOT.provenanceTag.in).toContain(OLEVEL_SIMPLIFIED_TAG);
    expect(c.NOT.provenanceTag.in).toContain(OLEVEL_BASIC_TAG);
  });

  it('三个桶两两互斥 —— 同一份卷不可能同时属于两层', () => {
    const basic = olevelTierCondition('basic') as any;
    const simplified = olevelTierCondition('simplified') as any;
    const standardExcluded = (olevelTierCondition('standard') as any).NOT.provenanceTag.in;
    expect(basic.provenanceTag).not.toBe(simplified.provenanceTag);
    expect(standardExcluded).toContain(basic.provenanceTag);
    expect(standardExcluded).toContain(simplified.provenanceTag);
  });

  it('标准层的真题 provenance 不被排除', () => {
    const excluded = (olevelTierCondition('standard') as any).NOT.provenanceTag.in;
    expect(excluded).not.toContain('singapore_olevel_1128');
    expect(excluded).not.toContain('ai_authored_olevel_1128');
  });
});
