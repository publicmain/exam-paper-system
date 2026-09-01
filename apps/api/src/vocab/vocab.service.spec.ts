import { describe, expect, it } from 'vitest';
import { VocabService, candidateForms, normalizeWord, verbLemmaForms } from './vocab.service';

/**
 * 解析链的回归测试。
 *
 * 这些用例直接来自 P0 实测（docs/PRD/vocabulary-notebook-p0-report.md）里
 * 真实语料中出现过的词形 —— 尤其是「不能自造后缀规则」那条教训：
 * mother 不能被剥成 moth、class 不能被剥成 clas。
 */
describe('normalizeWord', () => {
  it('小写化并统一弯撇号', () => {
    expect(normalizeWord('Singapore’s')).toBe("singapore's");
    expect(normalizeWord('  Coaxed ')).toBe('coaxed');
  });
});

describe('candidateForms', () => {
  it('普通词只产生直查一种形式', () => {
    expect(candidateForms('shattered')).toEqual([{ form: 'shattered', via: 'direct' }]);
  });

  it("剥离所有格 's（真实语料：Singapore's / mother's / sun's）", () => {
    expect(candidateForms("Singapore's")).toEqual([
      { form: "singapore's", via: 'direct' },
      { form: 'singapore', via: 'possessive' },
    ]);
    expect(candidateForms("mother's").map((c) => c.form)).toContain('mother');
    expect(candidateForms("sun's").map((c) => c.form)).toContain('sun');
  });

  it('剥离复数所有格 s’', () => {
    expect(candidateForms("students'").map((c) => c.form)).toContain("students");
  });

  it('绝不自造后缀规则 —— mother/class/this 必须原样直查', () => {
    // P0 实测：naive 后缀剥离会把这些词错拆成 moth / clas / thi
    for (const w of ['mother', 'class', 'this', 'water', 'morning', 'across', 'never']) {
      const forms = candidateForms(w).map((c) => c.form);
      expect(forms).toEqual([w]);
    }
  });

  it('剥掉首尾标点，保留词内撇号', () => {
    expect(candidateForms('"hood,')[0].form).toBe('hood');
    expect(candidateForms("don't")[0].form).toBe("don't");
  });

  it('空输入返回空数组', () => {
    expect(candidateForms('')).toEqual([]);
    expect(candidateForms('123')).toEqual([]);
    expect(candidateForms('—')).toEqual([]);
  });

  it('过短的所有格不再剥离（避免把 a’s 之类拆成单字母）', () => {
    expect(candidateForms("a's").length).toBe(1);
  });
});

describe('verbLemmaForms', () => {
  it('常见过去式可回退原形（bumped → bump）', () => {
    expect(verbLemmaForms('bumped')).toEqual(['bump', 'bumpe']);
    expect(verbLemmaForms('stopped')).toContain('stop');
    expect(verbLemmaForms('studied')).toEqual(['study']);
  });

  it('不把普通名词和 -ing 名词乱拆成另一个词', () => {
    for (const word of ['mother', 'class', 'this', 'morning', 'axis']) {
      expect(verbLemmaForms(word)).toEqual([]);
    }
  });
});

describe('VocabService.lookup', () => {
  const row = {
    word: 'bump',
    phonetic: '/bʌmp/',
    translation: 'v. 碰，撞',
    definition: 'to hit something by accident',
    pos: 'v.',
    collins: 2,
    oxford: true,
    tag: ['zk'],
  };

  it('直查没有 bumped 时会命中词典里的 bump，而不是误报未收录', async () => {
    const prisma = {
      dictEntry: {
        findMany: async ({ where }: any) =>
          where.word.in.includes('bump') ? [row] : [],
      },
    };
    const svc = new VocabService(prisma as any);

    await expect(svc.lookup('bumped')).resolves.toMatchObject({
      word: 'bump',
      query: 'bumped',
      translation: 'v. 碰，撞',
      via: 'lemma',
    });
  });

  it('若词典本身有 bumped，必须优先显示它自己的释义', async () => {
    const inflected = { ...row, word: 'bumped', translation: 'adj. 被撞到的' };
    const prisma = {
      dictEntry: { findMany: async () => [row, inflected] },
    };
    const svc = new VocabService(prisma as any);

    await expect(svc.lookup('bumped')).resolves.toMatchObject({
      word: 'bumped',
      translation: 'adj. 被撞到的',
      via: 'direct',
    });
  });

  it('低质量 bumped 变形条目不盖过可靠的 bump 释义', async () => {
    const weakInflected = {
      ...row,
      word: 'bumped',
      translation: 'a. 凸起的；凸状的',
      collins: null,
      oxford: false,
      tag: [],
      bnc: null,
      frq: null,
    };
    const prisma = {
      dictEntry: {
        findMany: async ({ where }: any) =>
          where.word.in.includes('bumped') ? [weakInflected] : [row],
      },
    };
    const svc = new VocabService(prisma as any);

    await expect(svc.lookup('bumped')).resolves.toMatchObject({
      word: 'bump',
      translation: 'v. 碰，撞',
      via: 'lemma',
    });
  });
});
