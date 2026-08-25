import { describe, expect, it } from 'vitest';
import { anonId } from './anon-id';

describe('anonId — 导出给外部对话时的匿名代号', () => {
  it('稳定：同一 studentId 永远得到同一个代号', () => {
    const a = anonId('cmryaoif200skd0pap1ku9163');
    expect(anonId('cmryaoif200skd0pap1ku9163')).toBe(a);
    expect(anonId('cmryaoif200skd0pap1ku9163')).toBe(a);
  });

  it('不同学生得到不同代号（35 人规模下无碰撞）', () => {
    const ids = Array.from({ length: 35 }, (_, i) => `cm-student-${i}-xyz`);
    const codes = new Set(ids.map(anonId));
    expect(codes.size).toBe(35);
  });

  it('格式固定 S-NNNN —— 一眼看出是代号而不是姓名', () => {
    for (const id of ['a', 'cmt7xj0hb00mhmg6b59zfzcm6', '中文id']) {
      expect(anonId(id)).toMatch(/^S-\d{4}$/);
    }
  });

  it('代号里不含原始 id 的任何片段（不可逆）', () => {
    const id = 'cmt7xj0hb00mhmg6b59zfzcm6';
    const code = anonId(id);
    expect(id).not.toContain(code.slice(2));
    expect(code).not.toContain(id.slice(0, 6));
  });

  it('空串不炸', () => {
    expect(anonId('')).toMatch(/^S-\d{4}$/);
  });
});
