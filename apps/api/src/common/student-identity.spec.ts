import { describe, expect, it } from 'vitest';
import { claimedIdentity, identityConflicts } from './student-identity.guard';

/**
 * 学生越权阻断（2026-08-25 外部审查 P0-1）。
 *
 * 修之前：身份 = 请求里的姓名字符串。知道同学姓名就能替他加词、删词、
 * 提交/撤销复习、销账错题（OWASP API1:2023 BOLA）。
 */

const me = { id: 'stu-1', name: '张三' };

describe('claimedIdentity — 从请求里取声明身份', () => {
  it('query 上的 name / studentId', () => {
    expect(claimedIdentity({ query: { name: '李四', studentId: 'x' }, body: {} } as any))
      .toEqual({ name: '李四', studentId: 'x' });
  });
  it('body 上的 studentName（vocab 写接口用这个字段名）', () => {
    expect(claimedIdentity({ query: {}, body: { studentName: '李四' } } as any).name).toBe('李四');
  });
  it('query 优先于 body', () => {
    expect(claimedIdentity({ query: { name: 'A' }, body: { name: 'B' } } as any).name).toBe('A');
  });
  it('空白与缺失都归一成 undefined', () => {
    expect(claimedIdentity({ query: { name: '   ' }, body: {} } as any).name).toBeUndefined();
    expect(claimedIdentity({ query: {}, body: {} } as any)).toEqual({ name: undefined, studentId: undefined });
  });
});

describe('identityConflicts — 拿自己的 token 操作别人必须被拦', () => {
  it('姓名不符 → 冲突', () => {
    expect(identityConflicts(me, { name: '李四' })).toBe(true);
  });
  it('studentId 不符 → 冲突', () => {
    expect(identityConflicts(me, { name: '张三', studentId: 'stu-2' })).toBe(true);
  });
  it('两者都符 → 放行', () => {
    expect(identityConflicts(me, { name: '张三', studentId: 'stu-1' })).toBe(false);
  });
  it('请求没声明身份 → 不算冲突（后端会用 token 的身份）', () => {
    expect(identityConflicts(me, {})).toBe(false);
  });
  it('姓名首尾空白不算冲突', () => {
    expect(identityConflicts(me, { name: '  张三  ' })).toBe(false);
  });
  it('同名不同人靠 studentId 区分 —— 姓名相同但 id 不同仍是冲突', () => {
    expect(identityConflicts({ id: 'stu-1', name: '孙爱迪' }, { name: '孙爱迪', studentId: 'stu-9' })).toBe(true);
  });
  it('不做模糊匹配 —— 差一个字也是冲突', () => {
    expect(identityConflicts(me, { name: '张三丰' })).toBe(true);
  });
});
