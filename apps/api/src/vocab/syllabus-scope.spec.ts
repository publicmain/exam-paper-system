import { describe, expect, it } from 'vitest';
import { isInSyllabus, isWorthLearning } from './student-word.service';

/**
 * 考纲范围（2026-08-14 教师定）：**只考雅思 / O-Level 范围内的词**。
 * 只出现在托福或 GRE 里的词一律不学 —— 本校两条通道都不考那两个试，
 * 背它们对学生没有回报。
 *
 * 上线前线上实测：34 人的班里有 19 个超考纲词、41 条学生记录，
 * 其中 geomagnetic（bnc 31271，7 人）、thermodynamics（25741）是
 * 自动采集塞进去的。已清理 28 条 wrong_answer 来源的；click 与
 * teacher_push 来源保留 —— 学生自己点的代表主动求知，老师推的就是
 * 老师要的，都不该被系统悄悄删掉。
 */

describe('isInSyllabus —— 考纲范围判定', () => {
  it('带 ielts 的一律在范围内', () => {
    expect(isInSyllabus(['ielts'])).toBe(true);
    expect(isInSyllabus(['toefl', 'ielts', 'gre'])).toBe(true);
  });

  it('中学 / 四六级 / 考研标签都算 O-Level 难度带', () => {
    for (const t of ['zk', 'gk', 'cet4', 'cet6', 'ky']) {
      expect(isInSyllabus([t])).toBe(true);
    }
  });

  it('只有 toefl 和/或 gre → 超考纲', () => {
    expect(isInSyllabus(['toefl'])).toBe(false);
    expect(isInSyllabus(['gre'])).toBe(false);
    expect(isInSyllabus(['toefl', 'gre'])).toBe(false);
  });

  it('线上实测的几个词：判定与清理结果一致', () => {
    expect(isInSyllabus(['toefl'])).toBe(false);          // geomagnetic
    expect(isInSyllabus(['toefl', 'gre'])).toBe(false);   // tremor / resin / coax
    expect(isInSyllabus(['gre'])).toBe(false);            // slick
    expect(isInSyllabus(['cet4', 'cet6', 'ky', 'toefl', 'ielts'])).toBe(true); // rack
    expect(isInSyllabus(['gk', 'cet4', 'cet6', 'ky'])).toBe(true);             // lorry / wipe
  });

  it('没有任何标签 → 不收（词频信号不足，无法判断难度）', () => {
    expect(isInSyllabus([])).toBe(false);
    expect(isInSyllabus(null)).toBe(false);
    expect(isInSyllabus(undefined)).toBe(false);
  });
});

describe('isWorthLearning —— 考纲范围是第一道闸', () => {
  const rare = { bnc: 12000, oxford: false };

  it('超考纲的词即使够生僻也不收', () => {
    expect(isWorthLearning({ tag: ['toefl', 'gre'], ...rare })).toBe(false);
    expect(isWorthLearning({ tag: ['gre'], ...rare })).toBe(false);
  });

  it('考纲内 + 进阶标签 + 够生僻 → 收', () => {
    expect(isWorthLearning({ tag: ['ielts'], ...rare })).toBe(true);
    expect(isWorthLearning({ tag: ['cet6'], ...rare })).toBe(true);
  });

  it('原有三条规则不受影响：核心词 / 高频词仍然不收', () => {
    expect(isWorthLearning({ tag: ['ielts'], bnc: 12000, oxford: true })).toBe(false);
    expect(isWorthLearning({ tag: ['ielts'], bnc: 1200, oxford: false })).toBe(false);
  });

  it('只有中学标签、没有进阶标签 → 仍然不收（学生多半已认识）', () => {
    expect(isWorthLearning({ tag: ['zk', 'gk'], ...rare })).toBe(false);
  });
});
