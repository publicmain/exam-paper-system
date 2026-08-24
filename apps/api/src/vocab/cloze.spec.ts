import { describe, expect, it } from 'vitest';
import { findClozeSpan } from './cloze';

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
