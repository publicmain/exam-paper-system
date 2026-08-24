import { describe, expect, it } from 'vitest';
import { diffAnswer } from './answer-diff';

/**
 * 判分辅助的差异分析。
 *
 * 这个模块的边界必须钉死：它只回答「差在哪」，**永远不替人决定给几分**。
 * 雅思填空里 `culture` 写成 `cultures` 在真考就是错的 —— 如果哪天有人
 * 把它接进自动判分并按 kind 放行，就是在骗学生。下面每条断言都同时检查
 * `wrongInExam`，就是为了让这层语义显式可测。
 */

describe('diffAnswer —— 机械差异识别', () => {
  it('完全一致', () => {
    const d = diffAnswer('chemicals', 'chemicals');
    expect(d.kind).toBe('exact');
    expect(d.wrongInExam).toBe(false);
  });

  it('大小写不同 → 雅思不扣分', () => {
    const d = diffAnswer('Chemicals', 'chemicals');
    expect(d.kind).toBe('case');
    expect(d.wrongInExam).toBe(false);
  });

  it('单复数不同 → 真考照样扣分（2026-08-20 胡齐家那题）', () => {
    const d = diffAnswer('Culture', 'cultures');
    expect(d.kind).toBe('plural');
    expect(d.wrongInExam).toBe(true);
    expect(d.note).toContain('单复数');
  });

  it('y→ies 的复数也认得出来', () => {
    expect(diffAnswer('bodies', 'body').kind).toBe('plural');
  });

  it('词形变化（-ing / -ed）', () => {
    const d = diffAnswer('shading', 'shade');
    expect(['word_form', 'typo']).toContain(d.kind);
    expect(d.wrongInExam).toBe(true);
  });

  it('拼写错一两个字母 → 雅思拼写必须正确', () => {
    const d = diffAnswer('interferance', 'interference');
    expect(d.kind).toBe('typo');
    expect(d.wrongInExam).toBe(true);
  });

  it('把整句写进来但含正解 → 超出词数限制，仍算错', () => {
    const d = diffAnswer('the answer is chemicals', 'chemicals');
    expect(d.kind).toBe('extra_words');
    expect(d.wrongInExam).toBe(true);
  });

  it('空答', () => {
    expect(diffAnswer('', 'chemicals').kind).toBe('blank');
    expect(diffAnswer(null, 'chemicals').kind).toBe('blank');
    expect(diffAnswer(undefined, 'chemicals').wrongInExam).toBe(true);
  });

  it('内容完全不同', () => {
    const d = diffAnswer('Emotion', 'chemicals');
    expect(d.kind).toBe('different');
    expect(d.wrongInExam).toBe(true);
  });

  it('参考答案是长句 → 不做机械比对，交给人正常判', () => {
    const d = diffAnswer(
      '因为班级什么也没给她',
      'the class owed her the gratitude, given how they had treated her',
    );
    expect(d.kind).toBe('long_answer');
    // 关键：长答案不预设对错，wrongInExam 必须是 false，否则人会被误导
    expect(d.wrongInExam).toBe(false);
  });

  it('标点/空格差异归到 case —— 不扣分，但把学生原样写的标出来', () => {
    // 归到 exact 会丢掉信息：判分人看不到学生实际写的是「chemicals.」。
    // 归到 case 既表明「不扣分」，又把原文摆出来供判断。
    const d = diffAnswer('  chemicals.  ', 'chemicals');
    expect(d.kind).toBe('case');
    expect(d.wrongInExam).toBe(false);
    expect(d.note).toContain('chemicals.');
  });

  it('只有 case 和 exact 不算考试里的错 —— 其余一律要人定夺', () => {
    const cases: Array<[string, string]> = [
      ['cultures', 'culture'],
      ['interferance', 'interference'],
      ['the answer is chemicals', 'chemicals'],
      ['', 'chemicals'],
      ['Emotion', 'chemicals'],
    ];
    for (const [s, c] of cases) {
      expect(diffAnswer(s, c).wrongInExam, `${s} vs ${c}`).toBe(true);
    }
  });
});
