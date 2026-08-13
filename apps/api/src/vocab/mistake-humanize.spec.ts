import { describe, expect, it } from 'vitest';
import {
  cleanMarkerComment,
  cleanStem,
  humanizeAnswer,
  translateAnswerLetter,
} from './mistake-humanize';

/**
 * 用真实入库数据当样本。老师 2026-08-13 的原话：
 * "只有题目没有文章，学生们根本不知道这是什么，并且 correct answer
 *  这么大一长串，学生根本不会细看"。
 */

describe('cleanStem —— 剥掉答题须知，只留真正在问的那句', () => {
  it('TFNG：整段 rubric 丢掉', () => {
    const raw =
      'Do the following statements agree with the information given in Reading Passage 2? ' +
      'In boxes 5–8 on your answer sheet, write TRUE if the statement agrees with the information, ' +
      'FALSE if the statement contradicts the information, NOT GIVEN if there is no information on this.\n\n' +
      'Kepler observed a large number of stars at the same time.';
    expect(cleanStem(raw)).toBe('Kepler observed a large number of stars at the same time.');
  });

  it('段落匹配：rubric 丢掉', () => {
    const raw =
      'Reading Passage 3 has eight paragraphs, A–H. Which paragraph contains the following ' +
      'information? Write the correct letter, A–H, in boxes 1–4 on your answer sheet. ' +
      'a description of the methods used to start a planned fire';
    expect(cleanStem(raw)).toBe('a description of the methods used to start a planned fire');
  });

  it('O-Level：取 Qn. 之后，section 说明不要', () => {
    const raw =
      'Read the narrative text below and answer the questions that follow. Section B, Part 1 ' +
      '[15 marks]. Answer in your own words as far as possible. ' +
      "Q6. Using your own words, explain why the narrator 'said nothing' when his mother called the cloth 'good' (Paragraph 2). [2]";
    expect(cleanStem(raw)).toContain('explain why the narrator');
    expect(cleanStem(raw)).not.toContain('Section B');
    expect(cleanStem(raw)).not.toContain('[15 marks]');
  });

  it('summary 题：保留真正的任务，不能只剩「Begin your summary」提示语', () => {
    const raw =
      'Read the non-narrative text below about how Singapore is responding to its ageing ' +
      'population, and answer the questions that follow. Section C [12 marks]. Answer in your ' +
      'own words as far as possible.\n\n' +
      'Q4. Using your own words as far as possible, summarise the ways in which Singapore is ' +
      'responding to its ageing population, as described in paragraphs 2 to 7. Your summary must ' +
      'be no more than 80 words.\n\n' +
      "Begin your summary: 'Singapore is responding to its ageing population by...' [8]";
    const out = cleanStem(raw);
    expect(out).toContain('summarise the ways in which Singapore');
    expect(out).not.toContain('Section C');
    expect(out).not.toMatch(/^Begin your summary/);
  });

  it('认不出格式时原样返回，绝不吞掉题目', () => {
    expect(cleanStem('What is the capital of France?')).toBe('What is the capital of France?');
    expect(cleanStem('')).toBe('');
  });
});

describe('humanizeAnswer —— 把判分指令翻译成学生看得懂的要点', () => {
  it('拆 MP1/MP2，删掉「Award one mark per distinct point」', () => {
    const raw =
      'MP1 (goodwill/trust): he trusted his neighbours and let them have what they needed even ' +
      'when they could not pay straight away; MP2 (practical timing): he knew they were paid only ' +
      'once a month, so he let them settle the bill when their salary came in. ' +
      'Award one mark per distinct point.';
    const { points } = humanizeAnswer(raw);
    expect(points).toHaveLength(2);
    expect(points[0]).toContain('he trusted his neighbours');
    expect(points[1]).toContain('paid only once a month');
    expect(points.join(' ')).not.toContain('Award one mark');
    expect(points.join(' ')).not.toContain('MP1');
  });

  it('summary 题：抽出范文，删掉 STYLE/SEAB 那套评分band', () => {
    const raw =
      'CONTENT POINTS (award ~1 each; 7 distinct ideas spread over paragraphs 2-7): ' +
      '① raising retirement and re-employment ages so older staff may keep working; ' +
      '② retraining older workers through subsidised courses; ' +
      '③ turning compulsory savings into a lifelong monthly income. ' +
      'STYLE / OWN-WORDS (the 8th mark; mirrors the SEAB 7-mark summary band): reward sustained ' +
      'own words + structures; penalise lifting / note form / exceeding 80 words. ' +
      "MODEL (~79 words): 'Singapore is responding to its ageing population by letting people work later.'";
    const { points, model } = humanizeAnswer(raw);
    expect(model).toBe('Singapore is responding to its ageing population by letting people work later.');
    expect(points.length).toBeGreaterThanOrEqual(3);
    const joined = points.join(' | ');
    expect(joined).toContain('raising retirement');
    // 判分指令全部清掉
    expect(joined).not.toMatch(/SEAB|8th mark|penalise|reward sustained|CONTENT POINTS|award/i);
    // 范文不该重复出现在要点里
    expect(joined).not.toContain('MODEL');
  });

  it('单句答案原样保留，不强行拆', () => {
    const { points, model } = humanizeAnswer('delaying / putting off until later');
    expect(points).toEqual(['delaying / putting off until later']);
    expect(model).toBe('');
  });

  it('单字母答案不能被吃掉（段落匹配题的答案就是一个字母）', () => {
    expect(humanizeAnswer('F').points).toEqual(['F']);
    expect(humanizeAnswer('B').points).toEqual(['B']);
    expect(humanizeAnswer('TRUE').points).toEqual(['TRUE']);
  });

  it('空输入不炸', () => {
    expect(humanizeAnswer('')).toEqual({ points: [], model: '' });
  });
});

describe('translateAnswerLetter —— 判断题字母翻译回学生看得懂的词', () => {
  // 上线首日实测：学生写 FALSE，参考答案显示 "C"，160 条全是这样
  it('TFNG: A/B/C → TRUE/FALSE/NOT GIVEN', () => {
    expect(translateAnswerLetter('true_false_not_given', 'A')).toBe('TRUE');
    expect(translateAnswerLetter('true_false_not_given', 'B')).toBe('FALSE');
    expect(translateAnswerLetter('true_false_not_given', 'C')).toBe('NOT GIVEN');
  });
  it('YNG: A/B/C → YES/NO/NOT GIVEN', () => {
    expect(translateAnswerLetter('yes_no_not_given', 'B')).toBe('NO');
  });
  it('段落匹配的字母就是答案本身，不翻译', () => {
    expect(translateAnswerLetter('matching_information', 'F')).toBe('F');
    expect(translateAnswerLetter('multi_match', 'B')).toBe('B');
  });
  it('已经是词的不受影响', () => {
    expect(translateAnswerLetter('true_false_not_given', 'TRUE')).toBe('TRUE');
  });
});

describe('cleanMarkerComment —— 客观题的判分流水不给学生看', () => {
  it('纯流水（"段3:B,正解 F。0。同上。"）整条隐藏', () => {
    expect(cleanMarkerComment('段3:B,正解 F。0。同上。', 1)).toBe('');
    expect(cleanMarkerComment('Q5: FALSE, 正解 C。0。', 1)).toBe('');
  });
  it('流水后面跟着真讲解：剥掉记账前缀，讲解保留', () => {
    expect(
      cleanMarkerComment('段3:B,正解 F。0。F 段开头那句 drip torches 就是在讲点火方法。', 1),
    ).toBe('F 段开头那句 drip torches 就是在讲点火方法。');
    expect(
      cleanMarkerComment('段2:B,正解 H。0。同上,找 incentives 这个词就直接落在 H 段。', 1),
    ).toBe('找 incentives 这个词就直接落在 H 段。');
  });
  it('长答题评语永远保留 —— 哪怕很短', () => {
    expect(cleanMarkerComment('同上。', 2)).toBe('同上。');
  });
  it('空评语返回空', () => {
    expect(cleanMarkerComment('', 1)).toBe('');
  });
});
