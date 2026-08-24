import { describe, expect, it } from 'vitest';
import { findClozeSpan, trimSentence, windowAroundSpan } from './cloze';

/**
 * 挖空定位。全部用 2026-08-24 审计时从生产库抽出来的真实坏例 ——
 * 764 条（26%）的词形只以子串出现，旧的 indexOf 会挖进别的词里。
 */

const blank = (s: string, sf: string) => {
  const span = findClozeSpan(s, sf);
  if (!span) return null;
  return s.slice(0, span.start) + '___' + s.slice(span.end);
};

describe('findClozeSpan', () => {
  it('完整词形：挖那个词', () => {
    expect(blank('More often the shift is gradual and voluntary.', 'gradual'))
      .toBe('More often the shift is ___ and voluntary.');
  });

  it('大小写不敏感', () => {
    expect(blank('Rotating shifts forward suits the body better.', 'rotating'))
      .toBe('___ shifts forward suits the body better.');
  });

  it('agree ⊂ agreed：挖整个 token，不留后缀提示（生产坏例）', () => {
    expect(blank('We all agreed. Then we all did nothing.', 'agree'))
      .toBe('We all ___. Then we all did nothing.');
  });

  it('squeeze ⊂ squeezed（生产坏例）', () => {
    expect(blank('Everyone had squeezed to the front.', 'squeeze'))
      .toBe('Everyone had ___ to the front.');
  });

  it('rotate → rotating：词干去 e 后前缀命中（生产坏例）', () => {
    expect(blank('Rotating shifts forward — morning, then night.', 'rotate'))
      .toBe('___ shifts forward — morning, then night.');
  });

  it('shake → shaking', () => {
    expect(blank('When I climbed out my arms were shaking.', 'shake'))
      .toBe('When I climbed out my arms were ___.');
  });

  it('rag → rags：3 字母词只允许 +s/+es，不会挖进 paragraph', () => {
    expect(blank('Paper was made from old rags in the mill.', 'rag'))
      .toBe('Paper was made from old ___ in the mill.');
    // paragraph 含 "rag" 子串，但既非完整词也非 rags/rages —— 不挖
    expect(findClozeSpan('The paragraph explains the cause.', 'rag')).toBeNull();
  });

  it('at ⊂ attainments：短词绝不做前缀匹配', () => {
    expect(findClozeSpan("comparisons of pupils' attainments since then", 'at')).toBeNull();
  });

  it('例句里根本没有该词 → null，调用方退化成学习卡/换题型', () => {
    expect(findClozeSpan('By dating and measuring the deposits.', 'avalanches')).toBeNull();
  });

  it('完整词形优先于前缀命中', () => {
    // 句子里同时有 rot（完整）和 rotting —— 挖完整词形那个
    expect(blank('The rot spread while the wood kept rotting.', 'rot'))
      .toBe('The ___ spread while the wood kept rotting.');
  });

  it('rot → rotting：本批词表的真实坏例（light-09）', () => {
    expect(blank('It was the main way of keeping food from rotting.', 'rot'))
      .toBe('It was the main way of keeping food from ___.');
  });

  it('空入参不炸', () => {
    expect(findClozeSpan('', 'word')).toBeNull();
    expect(findClozeSpan('sentence', '')).toBeNull();
  });
});

describe('windowAroundSpan — 长句围绕挖空处开窗（修复 #5）', () => {
  const LONG =
    'The researchers concluded that the accumulation of fine sediment on the reef flat, ' +
    'driven largely by coastal construction and the clearing of mangrove forests upstream, ' +
    'had reduced the light available to symbiotic algae to a level at which calcification ' +
    'could no longer keep pace with natural erosion.';

  it('短句原样返回，span 不动', () => {
    const s = 'The axis tilts.';
    const span = findClozeSpan(s, 'axis')!;
    const win = windowAroundSpan(s, span, 180);
    expect(win.text).toBe(s);
    expect(win.span).toEqual(span);
  });

  it('长句开窗：挖空词仍在窗内且偏移正确', () => {
    const span = findClozeSpan(LONG, 'sediment')!;
    const win = windowAroundSpan(LONG, span, 180);
    expect(win.text.length).toBeLessThan(LONG.length);
    expect(win.text.slice(win.span.start, win.span.end)).toBe('sediment');
  });

  it('窗口边缘带省略号且不把单词拦腰切断', () => {
    const span = findClozeSpan(LONG, 'calcification')!;
    const win = windowAroundSpan(LONG, span, 160);
    expect(win.text.startsWith('…')).toBe(true);
    // 去掉省略号后的首个词应是原句里的完整 token
    const firstWord = win.text.replace(/^…/, '').split(' ')[0];
    expect(LONG.includes(` ${firstWord} `) || LONG.startsWith(firstWord)).toBe(true);
  });

  it('挖空词在句首：窗口从头开始，无前省略号', () => {
    const s = 'Sediment accumulates slowly over decades, ' + 'x'.repeat(200) + ' end.';
    const span = findClozeSpan(s, 'sediment')!;
    const win = windowAroundSpan(s, span, 120);
    expect(win.text.startsWith('…')).toBe(false);
    expect(win.text.slice(win.span.start, win.span.end)).toBe('Sediment');
  });
});

describe('trimSentence — 学习卡长句截断', () => {
  it('短句不动', () => {
    expect(trimSentence('short one.')).toBe('short one.');
  });
  it('长句在词边界截断并加省略号', () => {
    const long = ('word '.repeat(80)).trim() + '.';
    const out = trimSentence(long, 100);
    expect(out.length).toBeLessThanOrEqual(101);
    expect(out.endsWith('…')).toBe(true);
    expect(out.includes('word wor…')).toBe(false); // 不拦腰切
  });
});
