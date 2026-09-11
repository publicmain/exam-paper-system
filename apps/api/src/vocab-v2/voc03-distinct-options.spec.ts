/**
 * VOC03 · 选项不能出现两个同样正确的释义（审计 2026-09-11 §5.3）。
 *
 * 原症状：选项按「词条」去重而不是按展示出来的释义去重 —— big / large 都显示
 * 「大的」时，四个选项里有两个「大的」，服务端只认其中一个下标。线上当时重复
 * 选项数为 0，这里是模拟复现，不代表真实学生被错判过。
 */
import { describe, expect, it } from 'vitest';
import { answerFormalQuestion, buildFormalQuestion, meaningsOverlap, type FrozenCard } from './formal-test';
import { answerAdaptiveQuestion, buildAdaptiveQuestion, type AdaptiveCard } from './adaptive-test';

const card = (headword: string, translation: string, pos = 'adjective'): FrozenCard => ({
  headword, pos, translation, definition: '', audioText: headword, sentence: null,
});

describe('VOC03 释义等价判断', () => {
  it('大小写 / 空格 / 标点 / 词性前缀的变体算同一个释义', () => {
    expect(meaningsOverlap('adj. 大的', '大的。')).toBe(true);
    expect(meaningsOverlap(' 大的 ', 'a. 大的')).toBe(true);
    expect(meaningsOverlap('Big', 'big!')).toBe(true);
  });
  it('共享一个义项（大的，巨大的 / 大的；重大的）也算撞车', () => {
    expect(meaningsOverlap('adj. 大的，巨大的', 'adj. 大的；重大的')).toBe(true);
  });
  it('真正不同的释义不算', () => {
    expect(meaningsOverlap('adj. 大的', 'adj. 快的')).toBe(false);
  });
});

describe('VOC03 正式卷选择题', () => {
  it('big / large 同为「大的」：large 不能当 big 的干扰项，选项里没有重复释义', () => {
    const cards = [
      card('fast', 'adj. 快的'),
      card('big', 'adj. 大的'),
      card('large', '大的。'),
      card('cold', 'adj. 冷的'),
      card('empty', 'adj. 空的'),
    ];
    const question = buildFormalQuestion(cards[1], 1, cards);
    expect(question.type).toBe('meaning_choice');
    if (question.type !== 'meaning_choice') return;
    const keys = question.options.map((option) => option.replace(/^[a-z]+\.\s*/i, '').replace(/[。.\s]/g, ''));
    expect(new Set(keys).size).toBe(question.options.length);
    expect(question.options.some((option) => option.includes('大的') && option !== question.options[question.answer])).toBe(false);
  });

  it('去掉等价释义后凑不够 3 个公平干扰项 → 改拼写题，不硬塞', () => {
    const cards = [card('fast', 'adj. 快的'), card('big', 'adj. 大的'), card('large', 'adj. 大的'), card('huge', '大的，巨大的')];
    expect(buildFormalQuestion(cards[1], 1, cards).type).toBe('spelling');
  });

  it('只从同词性的冻结词里选干扰项', () => {
    const cards = [
      card('fast', 'adj. 快的'), card('run', 'v. 跑', 'verb'), card('eat', 'v. 吃', 'verb'), card('sleep', 'v. 睡', 'verb'),
      card('cold', 'adj. 冷的'),
    ];
    expect(buildFormalQuestion(cards[1], 1, cards).type).toBe('spelling');
  });

  it('旧快照里已经有两个显示相同的选项：两个都判对（展示与判分一致）', () => {
    const legacy = { type: 'meaning_choice' as const, prompt: 'big', cue: null, options: ['大的', '冷的', '大的。', '快的'], answer: 0 };
    expect(answerFormalQuestion(legacy, 0)).toBe(true);
    expect(answerFormalQuestion(legacy, 2)).toBe(true);
    expect(answerFormalQuestion(legacy, 1)).toBe(false);
    expect(answerFormalQuestion(legacy, 9)).toBe(false);
  });
});

describe('VOC03 自助练习的选择题', () => {
  const adaptive = (headword: string, translation: string, stage = 1): AdaptiveCard => ({
    ...card(headword, translation), masteryStage: stage, list: 'ngsl', rank: 100,
  });

  it('词义选择：同义词不当干扰项、选项不重复', () => {
    const cards = [adaptive('big', 'adj. 大的'), adaptive('large', 'adj. 大的'), adaptive('fast', 'adj. 快的'), adaptive('cold', 'adj. 冷的'), adaptive('empty', 'adj. 空的')];
    const question = buildAdaptiveQuestion(cards[0], 0, cards);
    expect(question.type).toBe('meaning_choice');
    if (question.type !== 'meaning_choice') return;
    expect(question.options.filter((option) => option.includes('大的'))).toHaveLength(1);
  });

  it('选英文单词：意思一样的 large 不能和 big 同时出现（否则两个都对）', () => {
    const cards = [adaptive('big', 'adj. 大的', 2), adaptive('large', 'adj. 大的', 2), adaptive('fast', 'adj. 快的', 2), adaptive('cold', 'adj. 冷的', 2), adaptive('empty', 'adj. 空的', 2)];
    const question = buildAdaptiveQuestion(cards[0], 0, cards);
    expect(question.type).toBe('word_choice');
    if (question.type !== 'word_choice') return;
    expect(question.options).toContain('big');
    expect(question.options).not.toContain('large');
    expect(answerAdaptiveQuestion(question, question.options.indexOf('big'))).toBe(true);
  });

  it('候选不足时退回拼写，不拿乱码或远词凑数', () => {
    const cards = [adaptive('big', 'adj. 大的'), adaptive('large', 'adj. 大的'), adaptive('fast', 'adj. 快的')];
    expect(buildAdaptiveQuestion(cards[0], 0, cards).type).toBe('spelling');
  });
});
