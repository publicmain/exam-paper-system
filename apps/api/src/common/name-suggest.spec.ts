import { describe, expect, it } from 'vitest';
import { closeNames, editDistance } from './name-suggest';

describe('editDistance', () => {
  it('相同为 0，空串为对方长度', () => {
    expect(editDistance('孙爱迪', '孙爱迪')).toBe(0);
    expect(editDistance('', '孙爱迪')).toBe(3);
  });
  it('替换/插入/删除各计 1', () => {
    expect(editDistance('孙爱迪', '孙爱笛')).toBe(1); // 替换
    expect(editDistance('孙爱迪', '孙迪')).toBe(1); // 删除
    expect(editDistance('孙爱迪', '孙爱迪儿')).toBe(1); // 插入
  });
});

describe('closeNames — 相近姓名建议', () => {
  const roster = ['孙爱迪', '牟歌', '李永轩', '陈思远', '陈思达', 'Alice Wong'];

  it('差一个字的三字名 → 命中', () => {
    expect(closeNames('孙爱笛', roster)).toEqual(['孙爱迪']);
  });

  it('两字名差一个字 → 命中', () => {
    expect(closeNames('牟哥', roster)).toEqual(['牟歌']);
  });

  it('忽略空白差异（全形输入常见）', () => {
    expect(closeNames('孙 爱迪', roster)).toEqual([]); // 归一后完全相同 → 不算建议
    expect(closeNames('孙 爱笛', roster)).toEqual(['孙爱迪']);
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
