import { describe, it, expect } from 'vitest';
import { normalizeWord, candidateForms } from './vocab.service';

/**
 * P6 最终核查 —— headword 能不能当作稳定身份。
 *
 * 任务队列（DailyLessonCompletion.vocabWords）存的是 headword。要让它
 * 可靠，headword 必须：唯一、规范化、不可变、一词一条。这里钉住**规范化**
 * 那一面（唯一性由 DB 的 @@unique([studentId, headword]) 保证，不可变性
 * 由「四个创建路径写完就不再改」保证 —— 两者在进度文档里有证据）。
 */

describe('headword 规范化', () => {
  it('大小写、首尾空白一律归一', () => {
    expect(normalizeWord('  Harbour ')).toBe('harbour');
    expect(normalizeWord('HARBOUR')).toBe('harbour');
    expect(normalizeWord('harbour')).toBe('harbour');
  });

  it('弯引号与直引号归一 —— 同一个词不会因为撇号写法分裂成两条', () => {
    expect(normalizeWord('don’t')).toBe(normalizeWord("don't"));
  });

  it('空值不会变成一个叫空字符串的「词」', () => {
    expect(normalizeWord('')).toBe('');
    expect(normalizeWord('   ')).toBe('');
    expect(normalizeWord(undefined as any)).toBe('');
  });

  it('词形变化收敛到词典词元：查询用的候选形式都是规范化的', () => {
    // 所有创建路径写入的 headword 都是 DictEntry.word（词典主键），
    // 而查词典用的候选形式一律先过 normalizeWord —— 所以 headword
    // 不可能带大写或空白。
    for (const raw of ['  Ships’ ', "SHIPS'", 'ships']) {
      for (const c of candidateForms(raw)) {
        expect(c.form).toBe(c.form.toLowerCase().trim());
        expect(c.form).not.toMatch(/[’]/);
      }
    }
  });

  it('规范化是幂等的 —— 反复规范化不会漂移', () => {
    for (const raw of ['  Harbour ', 'don’t', "SHIPS'"]) {
      const once = normalizeWord(raw);
      expect(normalizeWord(once)).toBe(once);
    }
  });
});
