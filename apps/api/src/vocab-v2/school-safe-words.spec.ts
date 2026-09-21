import { describe, expect, it } from 'vitest';
import {
  SCHOOL_BLOCKED_HEADWORDS,
  SCHOOL_GLOSS_OVERRIDES,
  isSchoolBlockedHeadword,
  locateInOfficialLists,
  schoolGlossOverride,
  withoutBlockedWords,
} from './school-safe-words';
import { collectUnseenFromList } from './unified-vocabulary-rules';

describe('校园内容闸门', () => {
  it('名单里的每个拼写都真的在官方词表里（拼错 = 名单形同虚设）', () => {
    const missing = [...SCHOOL_BLOCKED_HEADWORDS, ...Object.keys(SCHOOL_GLOSS_OVERRIDES)].filter(
      (headword) => locateInOfficialLists(headword).length === 0,
    );
    expect(missing).toEqual([]);
  });

  it('两张表不重叠：一个词要么不推，要么留着并换释义', () => {
    const overlap = Object.keys(SCHOOL_GLOSS_OVERRIDES).filter((word) => isSchoolBlockedHeadword(word));
    expect(overlap).toEqual([]);
  });

  it('人工释义都非空，且没有留下词典里的脏义项', () => {
    for (const [word, gloss] of Object.entries(SCHOOL_GLOSS_OVERRIDES)) {
      expect(gloss.trim(), word).not.toBe('');
    }
    expect(SCHOOL_GLOSS_OVERRIDES.drug).not.toMatch(/吸毒|麻醉药/);
    expect(SCHOOL_GLOSS_OVERRIDES.hip).not.toMatch(/忧郁/);
  });

  it('2026-09-21 实际推出去的两个词被挡住', () => {
    expect(isSchoolBlockedHeadword('breast')).toBe(true);
    expect(isSchoolBlockedHeadword('sex')).toBe(true);
  });

  it('射程内的后续词也被挡住（sperm nawl@164 / sexual ngsl@1609 / naked nawl@843）', () => {
    for (const word of ['sperm', 'sexual', 'naked']) expect(isSchoolBlockedHeadword(word), word).toBe(true);
    expect(locateInOfficialLists('sperm')).toContainEqual({ list: 'nawl', rank: 164 });
    expect(locateInOfficialLists('sexual')).toContainEqual({ list: 'ngsl', rank: 1609 });
  });

  it('正经学术词不受牵连', () => {
    for (const word of ['blood', 'kill', 'weapon', 'murder', 'war', 'alcohol', 'drug', 'abuse']) {
      expect(isSchoolBlockedHeadword(word), word).toBe(false);
    }
  });

  it('拼写归一：大小写和空白不影响判断', () => {
    expect(isSchoolBlockedHeadword(' Breast ')).toBe(true);
    expect(schoolGlossOverride('DRUG')).toBe(SCHOOL_GLOSS_OVERRIDES.drug);
    expect(schoolGlossOverride('blood')).toBeNull();
  });

  it('withoutBlockedWords 只删不改，顺序和字段原样', () => {
    const words = [
      { headword: 'bread', rank: 1 },
      { headword: 'breast', rank: 2 },
      { headword: 'breathe', rank: 3 },
    ];
    expect(withoutBlockedWords(words)).toEqual([
      { headword: 'bread', rank: 1 },
      { headword: 'breathe', rank: 3 },
    ]);
  });
});

describe('每日推送选词绕开被挡的词', () => {
  const list = [
    { headword: 'alpha', rank: 1 },
    { headword: 'breast', rank: 2 },
    { headword: 'sex', rank: 3 },
    { headword: 'gamma', rank: 4 },
    { headword: 'delta', rank: 5 },
  ];

  it('挡住的词不进当日任务，名额由后面的词补上', () => {
    const picked = collectUnseenFromList(list, 1, new Set(), 3).picked.map((word) => word.headword);
    expect(picked).toEqual(['alpha', 'gamma', 'delta']);
  });

  it('游标停在被挡词上也能往后走，不会推不出词', () => {
    const picked = collectUnseenFromList(list, 2, new Set(), 2).picked.map((word) => word.headword);
    expect(picked).toEqual(['gamma', 'delta']);
  });

  it('被挡的词不占名额也不让当天少词', () => {
    const { picked, exhausted } = collectUnseenFromList(list, 1, new Set(['alpha']), 2);
    expect(picked.map((word) => word.headword)).toEqual(['gamma', 'delta']);
    expect(exhausted).toBe(false);
  });
});
