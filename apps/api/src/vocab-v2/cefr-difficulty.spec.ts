import { describe, expect, it } from 'vitest';
import { cefrEntryCount, cefrLevelOf } from './cefr-wordlist';
import { ceilingFor, difficultyProfile, hardWordsFor, sentenceFitsLevel } from './cefr-difficulty';

describe('CEFR-J 词表', () => {
  it('词表装进来了', () => {
    expect(cefrEntryCount()).toBeGreaterThan(6000);
    // 词组不收 —— 收了会在存储时被空格拆开，把 water 误标成 A2
    expect(cefrLevelOf('water')).toBe('A1');
  });

  it('常用词是低级，学术词是高级', () => {
    expect(cefrLevelOf('water')).toBe('A1');
    expect(cefrLevelOf('school')).toBe('A1');
    expect(cefrLevelOf('objective')).toBe('B1');
  });

  it('查不到的词返回 null —— 专有名词不能算难词', () => {
    expect(cefrLevelOf('Singapore')).toBeNull();
    expect(cefrLevelOf('Chandran')).toBeNull();
    expect(cefrLevelOf('')).toBeNull();
  });

  it('规则变化能还原：复数、过去式、进行时、副词', () => {
    expect(cefrLevelOf('books')).toBe(cefrLevelOf('book'));
    expect(cefrLevelOf('walked')).toBe(cefrLevelOf('walk'));
    // running 在词表里另有一条（A2），直查优先于还原 —— 这是对的
    expect(cefrLevelOf('studies')).toBe(cefrLevelOf('study'));
  });
});

describe('难度闸门', () => {
  it('档位对应的上限', () => {
    expect(ceilingFor(1)).toBe('A2');
    expect(ceilingFor(3)).toBe('B1');
    expect(ceilingFor(4)).toBe('B2');
    // 雅思真题档不设限 —— 超纲词正是要学的
    expect(ceilingFor(5)).toBeNull();
  });

  it('简单句子对基础档合格', () => {
    expect(sentenceFitsLevel('The girl opened her umbrella and walked to school.', 1)).toBe(true);
  });

  it('天文学例句挡在基础档外（2026-09-09 调研里真实出现过的那句）', () => {
    const s =
      'The alignment has to be nearly edge-on, and for most planetary systems it is not, so the great majority of planets can never transit as seen from here.';
    expect(sentenceFitsLevel(s, 1)).toBe(false);
    // 雅思真题档不拦
    expect(sentenceFitsLevel(s, 5)).toBe(true);
  });

  it('正在教的那个词自己超纲不算数', () => {
    const s = 'Her objective was to finish the book before Friday.';
    expect(hardWordsFor(s, 1)).toContain('objective');
    expect(hardWordsFor(s, 1, 'objective')).not.toContain('objective');
  });

  it('专有名词不当难词', () => {
    const s = 'Mr Chandran lived in Tampines for many years.';
    expect(hardWordsFor(s, 1)).toEqual([]);
  });

  it('空句子不报错', () => {
    expect(sentenceFitsLevel('', 1)).toBe(true);
    expect(hardWordsFor('', 1)).toEqual([]);
  });

  it('词表外的实词也算超纲（第一版漏掉的就是这个）', () => {
    // alignment / planetary / transit 都不在 CEFR-J 里，但对基础档显然超纲
    expect(hardWordsFor('The alignment of the planetary transit was measured.', 1))
      .toEqual(expect.arrayContaining(['alignment', 'planetary', 'transit']));
  });

  it('难度画像给出分级计数和超纲词', () => {
    const p = difficultyProfile('The objective analysis required substantial evidence.', 1);
    expect(p.words).toBe(6);
    expect(p.ceiling).toBe('A2');
    expect(p.hardWords.length).toBeGreaterThan(0);
    expect(p.hardRatio).toBeGreaterThan(0);
  });
});
