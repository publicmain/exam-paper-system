import { describe, it, expect } from 'vitest';
import {
  isProductionLike,
  assertAccessKeyConfigured,
  checkClassOwnership,
  checkSubmissionGradable,
  checkNotMcq,
  checkAwardedMarksRange,
  checkClaimNotHeldByOther,
  checkMarkerAccount,
  computeSubmissionTotals,
} from '../grading.js';

/**
 * 审计 S05 —— ops-dashboard `/api/grade` 缺少正式判分约束。
 * 这里单测抽出来的纯函数（不碰 Postgres），覆盖台账里点名的每一条：
 * 班级归属、提交状态、题型、认领、真实操作人、生产必须有 ACCESS_KEY。
 */

describe('isProductionLike / assertAccessKeyConfigured', () => {
  it('本地开发（没有 Railway 变量、NODE_ENV 非 production）不算生产', () => {
    expect(isProductionLike({})).toBe(false);
    expect(isProductionLike({ NODE_ENV: 'development' })).toBe(false);
  });

  it.each([
    ['NODE_ENV=production', { NODE_ENV: 'production' }],
    ['RAILWAY_ENVIRONMENT_NAME', { RAILWAY_ENVIRONMENT_NAME: 'production' }],
    ['RAILWAY_PROJECT_ID', { RAILWAY_PROJECT_ID: 'abc' }],
    ['RAILWAY_SERVICE_ID', { RAILWAY_SERVICE_ID: 'svc' }],
  ])('%s 视为生产', (_label, env) => {
    expect(isProductionLike(env)).toBe(true);
  });

  it('生产缺 ACCESS_KEY：拒绝启动', () => {
    const r = assertAccessKeyConfigured({ RAILWAY_PROJECT_ID: 'abc' });
    expect(r.ok).toBe(false);
    expect(r.error).toMatch(/ACCESS_KEY/);
  });

  it('生产配了 ACCESS_KEY：允许启动', () => {
    expect(assertAccessKeyConfigured({ RAILWAY_PROJECT_ID: 'abc', ACCESS_KEY: 'secret' }).ok).toBe(true);
  });

  it('本地没配 key：仍允许启动（保留开发便利）', () => {
    expect(assertAccessKeyConfigured({}).ok).toBe(true);
  });
});

describe('checkClassOwnership', () => {
  it('不属于配置的班级：拒绝', () => {
    expect(checkClassOwnership('other-class', 'c1').ok).toBe(false);
  });
  it('属于配置的班级：放行', () => {
    expect(checkClassOwnership('c1', 'c1').ok).toBe(true);
  });
});

describe('checkSubmissionGradable', () => {
  it.each(['in_progress', 'marked', 'returned'])('status=%s：拒绝', (status) => {
    const r = checkSubmissionGradable(status);
    expect(r.ok).toBe(false);
    expect(r.error).toMatch(new RegExp(status));
  });
  it('status=submitted：放行', () => {
    expect(checkSubmissionGradable('submitted').ok).toBe(true);
  });
});

describe('checkNotMcq', () => {
  it('mcq：拒绝（自动判分，不许人工覆写）', () => {
    expect(checkNotMcq('mcq').ok).toBe(false);
  });
  it.each(['structured', 'short_answer', 'essay'])('%s：放行', (t) => {
    expect(checkNotMcq(t).ok).toBe(true);
  });
});

describe('checkAwardedMarksRange', () => {
  it('负数：拒绝', () => {
    expect(checkAwardedMarksRange(-1, 5).ok).toBe(false);
  });
  it('超过满分：拒绝', () => {
    expect(checkAwardedMarksRange(6, 5).ok).toBe(false);
  });
  it('非数字：拒绝', () => {
    expect(checkAwardedMarksRange('abc', 5).ok).toBe(false);
    expect(checkAwardedMarksRange(NaN, 5).ok).toBe(false);
  });
  it('0 和满分：放行（边界值）', () => {
    expect(checkAwardedMarksRange(0, 5)).toMatchObject({ ok: true, value: 0 });
    expect(checkAwardedMarksRange(5, 5)).toMatchObject({ ok: true, value: 5 });
  });
});

describe('checkClaimNotHeldByOther', () => {
  it('没人认领：放行', () => {
    expect(checkClaimNotHeldByOther(null, 'm1').ok).toBe(true);
  });
  it('认领已释放（status=released）：放行', () => {
    expect(checkClaimNotHeldByOther({ markerId: 'other', status: 'released' }, 'm1').ok).toBe(true);
  });
  it('被别人认领且认领中：拒绝', () => {
    const r = checkClaimNotHeldByOther({ markerId: 'other', status: 'active' }, 'm1');
    expect(r.ok).toBe(false);
    expect(r.error).toMatch(/other/);
  });
  it('认领人正是本次判分人：放行（自己补写自己认领的答卷）', () => {
    expect(checkClaimNotHeldByOther({ markerId: 'm1', status: 'active' }, 'm1').ok).toBe(true);
  });
});

describe('checkMarkerAccount —— 真实操作人，不能拿"最早的管理员"顶替', () => {
  it('查无此人：拒绝', () => {
    expect(checkMarkerAccount(null).ok).toBe(false);
  });
  it('账号已停用：拒绝', () => {
    expect(checkMarkerAccount({ email: 'a@x.com', role: 'teacher', isActive: false }).ok).toBe(false);
  });
  it('学生账号：拒绝（没有判分权限）', () => {
    expect(checkMarkerAccount({ email: 's@x.com', role: 'student', isActive: true }).ok).toBe(false);
  });
  it.each(['admin', 'head_teacher', 'teacher'])('%s 且启用中：放行', (role) => {
    expect(checkMarkerAccount({ email: 't@x.com', role, isActive: true }).ok).toBe(true);
  });
});

describe('computeSubmissionTotals —— 与 marker.service.finalize 同一套口径', () => {
  it('mcq + 自动判分主观题都算自动分；人工覆写的算人工分，不重复计分', () => {
    const totals = computeSubmissionTotals([
      { qtype: 'mcq', awarded: 3, markedById: null },
      { qtype: 'short_answer', awarded: 2, markedById: null }, // 自动判（Path-1 精确匹配）
      { qtype: 'structured', awarded: 4, markedById: 'teacher-1' }, // 老师人工判
    ]);
    expect(totals).toEqual({ auto: 5, manual: 4, total: 9, ungraded: 0 });
  });

  it('还有没判的主观题：ungraded 计数，不影响已判部分的 auto/manual', () => {
    const totals = computeSubmissionTotals([
      { qtype: 'mcq', awarded: 3, markedById: null },
      { qtype: 'structured', awarded: null, markedById: null },
    ]);
    expect(totals).toEqual({ auto: 3, manual: 0, total: 3, ungraded: 1 });
  });

  it('空答卷（没有任何 script 行）：全 0，不报错', () => {
    expect(computeSubmissionTotals([])).toEqual({ auto: 0, manual: 0, total: 0, ungraded: 0 });
  });
});
