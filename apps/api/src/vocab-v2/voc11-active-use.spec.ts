/**
 * VOC11 · 造句题不能把 `apple apple apple` 判成「句子正确」（审计 2026-09-11 §5.3）。
 *
 * 原症状：active_use 只查「≥3 个词 + 正则里出现目标词」，重复目标词、只含子串
 * 都能过，而界面据此显示句子正确。服务端判不了语法/语义，也不为此开付费 AI：
 * 只做能确定的检查（完整单词、词形含不规则变化、除目标词外至少两个别的词），
 * 并在结果里如实写「检测到目标词，未评估句子质量」。
 */
import { describe, expect, it } from 'vitest';
import { answerAdaptiveQuestion, buildAdaptiveQuestion, checkActiveUse, type AdaptiveCard } from './adaptive-test';
import { makeService, newDb, seedOfficialWords, seedStudent } from './testing/vocab-fixtures';

describe('VOC11 造句题的确定性检查', () => {
  it('只重复目标词不算', () => {
    expect(checkActiveUse('apple', 'apple apple apple').targetDetected).toBe(false);
    expect(checkActiveUse('apple', 'Apple, apple... APPLE!').reason).toBe('only_target_repeated');
  });

  it('只包含子串不算（pineapple ≠ apple）', () => {
    expect(checkActiveUse('apple', 'The pineapple pie is sweet.').targetDetected).toBe(false);
  });

  it('规则 / 不规则变形都认', () => {
    expect(checkActiveUse('decline', 'Sales declined sharply.').targetDetected).toBe(true);
    expect(checkActiveUse('go', 'She went home early.').targetDetected).toBe(true);
    expect(checkActiveUse('child', 'The children are playing outside.').targetDetected).toBe(true);
    expect(checkActiveUse('stop', 'The bus stopped here.').targetDetected).toBe(true);
    expect(checkActiveUse('study', 'He studied all night.').targetDetected).toBe(true);
  });

  it('无论过没过，句子质量一律「未评估」—— 不冒充语法判断', () => {
    expect(checkActiveUse('apple', 'I ate an apple.').sentenceQuality).toBe('not_evaluated');
    expect(checkActiveUse('apple', 'apple banana car').sentenceQuality).toBe('not_evaluated');
  });

  it('判分函数与检查一致：apple apple apple 判错', () => {
    const card: AdaptiveCard = { headword: 'apple', pos: 'noun', translation: 'n. 苹果', definition: '', audioText: 'apple', sentence: null, masteryStage: 7 };
    const question = buildAdaptiveQuestion(card, 0, [card]);
    expect(question.type).toBe('active_use');
    expect(answerAdaptiveQuestion(question, 'apple apple apple')).toBe(false);
    expect(answerAdaptiveQuestion(question, 'I ate an apple.')).toBe(true);
  });
});

describe('VOC11 练习结果如实说明', () => {
  it('造句题的回顾带「检测到目标词，未评估句子质量」，没有「句子正确」', async () => {
    const db = newDb();
    const stu = seedStudent(db, { level: 'olevel' });
    const [word] = seedOfficialWords(db, 'ngsl', 1801, 1);
    db.seed('studentVocabularySense', { studentId: stu, senseId: word.senseId, masteryStage: 7, reps: 3 });
    const svc = makeService(db);
    const test = await svc.startCustomTest(stu, { count: 'all', scope: 'all' });
    const item = test.items[0];
    expect(item.question.type).toBe('active_use');
    expect(item.question.grading).toBe('target_word_only');

    const bad = await svc.answerTestItem(stu, test.id, item.id, `${word.headword} ${word.headword} ${word.headword}`);
    const reviewed = bad.items[0];
    expect(reviewed.isCorrect).toBe(false);
    expect(reviewed.check).toEqual(expect.objectContaining({ targetDetected: false, reason: 'only_target_repeated', sentenceQuality: 'not_evaluated' }));
    expect(JSON.stringify(reviewed.check)).not.toContain('正确');
  });

  it('用对了目标词：结果是「检测到目标词」，同样标明未评估句子质量', async () => {
    const db = newDb();
    const stu = seedStudent(db, { level: 'olevel' });
    const [word] = seedOfficialWords(db, 'ngsl', 1801, 1);
    db.seed('studentVocabularySense', { studentId: stu, senseId: word.senseId, masteryStage: 7, reps: 3 });
    const svc = makeService(db);
    const test = await svc.startCustomTest(stu, { count: 'all', scope: 'all' });
    const answered = await svc.answerTestItem(stu, test.id, test.items[0].id, `My friend had an ${word.headword} last year.`);
    expect(answered.items[0].isCorrect).toBe(true);
    expect(answered.items[0].check.label).toBe('检测到目标词，未评估句子质量');
  });
});
