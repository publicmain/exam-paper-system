import { describe, expect, it } from 'vitest';
import { cleanTranslation, formatPhonetic, posLabel, posPrefixFor } from '../lib/word-display';

describe('formatPhonetic —— 2026-09-05 盲测 P2-9', () => {
  it('西里尔 ә 换成 ə，统一带斜杠', () => {
    expect(formatPhonetic("kә'tæstrәfi")).toBe('/kəˈtæstrəfi/');
    expect(formatPhonetic("/kә'tæstrәfi/")).toBe('/kəˈtæstrəfi/');
  });
  it("老式记号 'dʒә:mineit 也能看", () => {
    expect(formatPhonetic("'dʒә:mineit")).toBe('/ˈdʒə:mineit/');
  });
  it('空的不显示', () => {
    expect(formatPhonetic('')).toBeNull();
    expect(formatPhonetic(null)).toBeNull();
    expect(formatPhonetic('  ')).toBeNull();
  });
});

describe('posLabel / posPrefixFor —— 2026-09-05 盲测 P2-10', () => {
  it('other 不显示', () => {
    expect(posLabel('other')).toBeNull();
    expect(posPrefixFor('other', 'n. 大灾难, 大祸')).toBe('');
  });
  it('认识的词性翻成缩写', () => {
    expect(posLabel('noun')).toBe('n.');
    expect(posLabel('adjective')).toBe('adj.');
    expect(posPrefixFor('verb', '发芽')).toBe('v. ');
  });
  it('释义已经带 n. 开头 → 不重复', () => {
    expect(posPrefixFor('noun', 'n. 大灾难')).toBe('');
    expect(posPrefixFor('verb', 'vi. 发芽, 萌芽')).toBe('');
  });
});

describe('cleanTranslation —— 2026-09-05 盲测 P2-11', () => {
  it('去掉 [化] [计] 这类专业义项行', () => {
    expect(cleanTranslation('n. 突变, 变化\\n[化] 突变\\n[计] 变异')).toBe('n. 突变, 变化');
  });
  it('全是专业行时保留原文', () => {
    expect(cleanTranslation('[化] 触媒')).toBe('[化] 触媒');
  });
  it('空的还是空', () => {
    expect(cleanTranslation(null)).toBe('');
  });
});
