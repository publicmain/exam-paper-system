import { describe, expect, it } from 'vitest';
import { cleanDefinition, cleanTranslation, formatPhonetic, posLabel, posPrefixFor } from '../lib/word-display';

describe('formatPhonetic —— 2026-09-05 盲测 P2-9', () => {
  it('西里尔 ә 换成 ə，统一带斜杠', () => {
    expect(formatPhonetic("kә'tæstrәfi")).toBe('/kəˈtæstrəfi/');
    expect(formatPhonetic("/kә'tæstrәfi/")).toBe('/kəˈtæstrəfi/');
  });
  it("老式记号 'dʒә:mineit → 新式 IPA（2026-09-06 第五轮盲测 16）", () => {
    expect(formatPhonetic("'dʒә:mineit")).toBe('/ˈdʒɜːmɪneɪt/');
    expect(formatPhonetic("'hæpi")).toBe('/ˈhæpi/'); // 词尾 i 不动
    expect(formatPhonetic('put')).toBe('/put/'); // 没有老式标记的不碰
    expect(formatPhonetic("'æsid")).toBe('/ˈæsɪd/');
    // 没有 ә / : / ' 但有老式双元音的也要转（2026-09-06 第五轮复测 16：pale 显示成 /peil/）
    expect(formatPhonetic('peil')).toBe('/peɪl/');
    expect(formatPhonetic('haus')).toBe('/haʊs/');
  });
  it('剑桥式音节点去掉，两套词典数据风格一致（复测新发现 6）', () => {
    expect(formatPhonetic('ˈsɪl.vər')).toBe('/ˈsɪlvər/');
    expect(formatPhonetic('/ˈæs.ɪd/')).toBe('/ˈæsɪd/');
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
  it('a. / ad. 换成学生认识的 adj. / adv.（2026-09-06 第五轮盲测 15）', () => {
    expect(posLabel('a')).toBe('adj.');
    expect(cleanTranslation('a. 准时的, 守时的')).toBe('adj. 准时的, 守时的');
    expect(cleanTranslation('ad. 不典型地')).toBe('adv. 不典型地');
  });
  it('释义已经带 n. 开头 → 不重复', () => {
    expect(posPrefixFor('noun', 'n. 大灾难')).toBe('');
    expect(posPrefixFor('verb', 'vi. 发芽, 萌芽')).toBe('');
  });
});

describe('cleanDefinition —— 2026-09-06 第五轮复测 15', () => {
  it('每行开头的 a. / s. / n / v / r 换成学生认识的缩写，行保留', () => {
    expect(cleanDefinition('a. acting or arriving exactly at the time appointed')).toBe('adj. acting or arriving exactly at the time appointed');
    expect(cleanDefinition('n a piece of land\\nv have the quality of being\\ns. very light colored\\nr in a pale manner'))
      .toBe('n. a piece of land\nv. have the quality of being\nadj. very light colored\nadv. in a pale manner');
  });
  it('不认识的开头原样保留', () => {
    expect(cleanDefinition('to hit something')).toBe('to hit something');
  });
  it('人名 / 地名义项去掉；全是这种时保留原文（2026-09-06 上线验收）', () => {
    expect(cleanDefinition('n grains used as food\\nn English lyricist who frequently worked with Andrew Lloyd Webber (born in 1944)\\nn United States playwright (1892-1967)'))
      .toBe('n. grains used as food');
    expect(cleanDefinition('n a low-lying region in central France')).toBe('n. a low-lying region in central France');
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
