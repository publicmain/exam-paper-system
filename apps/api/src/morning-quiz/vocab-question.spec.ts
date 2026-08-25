import { describe, expect, it } from 'vitest';
import {
  buildClozeQuestion,
  buildMeaningQuestion,
  pickMeaningDistractors,
  pickWordDistractors,
  pickWordsForDay,
  seedFor,
} from './vocab-question';

/**
 * 卷内词汇题的出题器（2026-08-25，只给轻量两层）。
 *
 * 最要紧的两条契约：
 *   · 四个选项里**有且只有一个** correct（否则自动判分会错判）；
 *   · 填空题的干扰项不能与正解近义 —— 首次出题就撞上 empty/tidy
 *     两个都填得通的坏例。
 */

const POOL = [
  { word: 'empty', translation: 'a. 空的, 空虚的' },
  { word: 'tidy', translation: 'a. 整齐的, 整洁的' },
  { word: 'notice', translation: 'vt. 注意到, 通知' },
  { word: 'familiar', translation: 'a. 熟悉的, 常见的' },
  { word: 'polite', translation: 'a. 有礼貌的, 文雅的' },
  { word: 'method', translation: 'n. 方法, 办法' },
  { word: 'approach', translation: 'n. 方法, 途径' },
];

describe('pickWordsForDay — 主线词按天轮转', () => {
  const words = ['a', 'b', 'c', 'd', 'e', 'f'];
  it('每天取接着的两个，一周内不重复', () => {
    expect(pickWordsForDay(words, 0, 2)).toEqual(['a', 'b']);
    expect(pickWordsForDay(words, 1, 2)).toEqual(['c', 'd']);
    expect(pickWordsForDay(words, 2, 2)).toEqual(['e', 'f']);
  });
  it('转满一圈回到开头，不越界', () => {
    expect(pickWordsForDay(words, 3, 2)).toEqual(['a', 'b']);
  });
  it('词表比配额短也不炸', () => {
    expect(pickWordsForDay(['x'], 0, 2)).toEqual(['x']);
    expect(pickWordsForDay([], 0, 2)).toEqual([]);
  });
});

describe('seedFor — 同天同层稳定、跨天跨层不同', () => {
  it('同输入恒等（可重跑、可对账）', () => {
    expect(seedFor('2026-08-26', 'ielts_light')).toBe(seedFor('2026-08-26', 'ielts_light'));
  });
  it('换天或换层就变', () => {
    expect(seedFor('2026-08-26', 'ielts_light')).not.toBe(seedFor('2026-08-27', 'ielts_light'));
    expect(seedFor('2026-08-26', 'ielts_light')).not.toBe(seedFor('2026-08-26', 'ielts_simplified'));
  });
});

describe('pickWordDistractors — 填空干扰项', () => {
  it('剔掉与正解近义的词（approach/method 共享「方法」）', () => {
    const out = pickWordDistractors('method', 'n. 方法, 办法', POOL, 12345);
    expect(out).not.toContain('approach');
  });
  it('不选正解自己，也不选同词根变形', () => {
    const out = pickWordDistractors('empty', 'a. 空的, 空虚的', POOL, 999);
    expect(out).not.toContain('empty');
    expect(out.length).toBeLessThanOrEqual(3);
  });
});

describe('buildClozeQuestion', () => {
  const target = { word: 'empty', context: 'The classroom was empty when I arrived.', translation: 'a. 空的' };

  it('挖空 + 四选项，有且只有一个正解', () => {
    const q = buildClozeQuestion(target, ['notice', 'polite', 'familiar'], 42)!;
    expect(q).not.toBeNull();
    expect(q.stem).toContain('＿＿＿');
    expect(q.stem).not.toContain('empty'); // 答案不能留在题干里
    expect(q.options).toHaveLength(4);
    expect(q.options.filter((o) => o.correct)).toHaveLength(1);
    expect(q.options.find((o) => o.correct)!.text).toBe('empty');
    expect(q.answerKey).toBe(q.options.find((o) => o.correct)!.key);
    expect(['A', 'B', 'C', 'D']).toContain(q.answerKey);
  });

  it('选项键恒为 A-D 且不重复', () => {
    const q = buildClozeQuestion(target, ['notice', 'polite', 'familiar'], 7)!;
    expect(q.options.map((o) => o.key)).toEqual(['A', 'B', 'C', 'D']);
    expect(new Set(q.options.map((o) => o.text)).size).toBe(4);
  });

  it('例句里定位不到该词 → 返回 null（绝不硬挖）', () => {
    const bad = { word: 'zzz', context: 'No such word here.', translation: 'x' };
    expect(buildClozeQuestion(bad, ['a', 'b', 'c'], 1)).toBeNull();
  });

  it('干扰项不足 3 个 → 返回 null，不出残题', () => {
    expect(buildClozeQuestion(target, ['notice'], 1)).toBeNull();
  });
});

describe('buildMeaningQuestion', () => {
  const target = { word: 'expand', context: 'They expand the shop.', translation: 'vt. 使膨胀, 扩张' };

  it('词进题干、释义做选项，有且只有一个正解', () => {
    const q = buildMeaningQuestion(target, ['a. 重要的', 'vt. 改变', 'n. 过程'], 42)!;
    expect(q.stem).toContain('expand');
    expect(q.options).toHaveLength(4);
    expect(q.options.filter((o) => o.correct)).toHaveLength(1);
    expect(q.options.find((o) => o.correct)!.text).toContain('膨胀');
  });

  it('释义为空 → null（词典查不到的词不出题）', () => {
    expect(buildMeaningQuestion({ ...target, translation: '' }, ['a', 'b', 'c'], 1)).toBeNull();
  });
});

describe('pickMeaningDistractors', () => {
  it('不与正解近义、彼此也不近义', () => {
    const out = pickMeaningDistractors({ word: 'method', translation: 'n. 方法, 办法' }, POOL, 5);
    expect(out.every((t) => !t.includes('方法'))).toBe(true);
    expect(new Set(out).size).toBe(out.length);
  });
});
