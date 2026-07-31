import { describe, expect, it } from 'vitest';
import { candidateForms, normalizeWord } from './vocab.service';

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
