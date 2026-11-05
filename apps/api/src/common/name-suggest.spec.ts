import { describe, expect, it } from 'vitest';
import { closeNames, editDistance } from './name-suggest';

describe('editDistance', () => {
  it('相同为 0，空串为对方长度', () => {
    expect(editDistance('吴佳宁', '吴佳宁')).toBe(0);
    expect(editDistance('', '吴佳宁')).toBe(3);
  });
  it('替换/插入/删除各计 1', () => {
    expect(editDistance('吴佳宁', '吴佳柠')).toBe(1); // 替换
    expect(editDistance('吴佳宁', '吴宁')).toBe(1); // 删除
    expect(editDistance('吴佳宁', '吴佳宁儿')).toBe(1); // 插入
  });
});

describe('closeNames — 相近姓名建议', () => {
  const roster = ['吴佳宁', '方舟', '钱宇航', '陈思远', '陈思达', 'Alice Wong'];

  it('差一个字的三字名 → 命中', () => {
    expect(closeNames('吴佳柠', roster)).toEqual(['吴佳宁']);
  });

  it('两字名差一个字 → 命中', () => {
    expect(closeNames('方洲', roster)).toEqual(['方舟']);
  });

  it('忽略空白差异（全形输入常见）', () => {
    expect(closeNames('孙 爱迪', roster)).toEqual([]); // 归一后完全相同 → 不算建议
    expect(closeNames('吴 佳柠', roster)).toEqual(['吴佳宁']);
  });

  it('完全对不上的名字 → 无建议（不能变成名册枚举通道）', () => {
    expect(closeNames('王小明', roster)).toEqual([]);
  });

  it('多个候选按距离排序、最多 3 个', () => {
    const out = closeNames('陈思遠', roster);
    expect(out[0]).toBe('陈思远');
    expect(out.length).toBeLessThanOrEqual(3);
  });

  it('拼音名允许距离 2', () => {
    expect(closeNames('Alice Wang', roster)).toEqual(['Alice Wong']);
  });
});
