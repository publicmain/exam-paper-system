/**
 * VOC04 · 进行中的拼写题不能把答案送到客户端（审计 2026-09-11 §5.3）。
 *
 * 原症状：正式拼写题的 `cue.audioText` 就是目标词本身；前端虽然不显示，打开
 * 网络面板就能看到答案。修法按白名单下发：进行中只给题面，已答 / 已交才给完整
 * 题目与卡片；听写题只给「去服务端取这道题的音频」的标识，不给能解码出单词的东西。
 */
import { describe, expect, it } from 'vitest';
import { makeService, newDb, seedOfficialWords, seedStudent, sgtNoon } from './testing/vocab-fixtures';

const NOW = sgtNoon('2026-09-10');
let seq = 0;
const neutralTranslation = () => `n. 释义${++seq}号`;

function containsDeep(value: unknown, needle: string): boolean {
  return JSON.stringify(value).toLowerCase().includes(needle.toLowerCase());
}

async function formalTestInProgress() {
  const db = newDb();
  const stu = seedStudent(db, { level: 'olevel', dailyTarget: 5 });
  seedOfficialWords(db, 'ngsl', 1801, 20, { translation: neutralTranslation });
  const svc = makeService(db);
  const daily = await svc.startDailySession(stu, NOW);
  let last: any;
  for (const item of daily.items) last = await svc.actOnLearningItem(stu, daily.id, item.id, 'normal');
  const test = await svc.testSession(stu, last.generatedTestId);
  return { db, svc, stu, daily, test };
}

describe('VOC04 正式拼写题不泄题', () => {
  it('进行中：拼写题 payload 里没有 audioText，也找不到目标词的拼写', async () => {
    const { db, test } = await formalTestInProgress();
    const spelling = test.items.filter((item: any) => item.question.type === 'spelling');
    expect(spelling.length).toBeGreaterThan(0);
    for (const item of spelling) {
      const row = db.rows('vocabularyV2SessionItem', { id: item.id })[0];
      const headword = row.contentSnapshot.headword;
      expect(containsDeep(item, 'audioText')).toBe(false);
      expect(containsDeep(item, headword)).toBe(false);
      expect(item.card).toBeNull();
      expect(item.question).not.toHaveProperty('answer');
    }
  });

  it('新生成的拼写题快照本身就不再存 audioText', async () => {
    const { db, test } = await formalTestInProgress();
    for (const item of test.items) {
      const row = db.rows('vocabularyV2SessionItem', { id: item.id })[0];
      if (row.questionSnapshot.type === 'spelling') expect(row.questionSnapshot.cue).not.toHaveProperty('audioText');
    }
  });

  it('旧快照（改之前生成、cue 里带 audioText）也按白名单下发', async () => {
    const { db, svc, stu, test } = await formalTestInProgress();
    const target = test.items.find((item: any) => item.question.type === 'spelling')!;
    const row = db.rows('vocabularyV2SessionItem', { id: target.id })[0];
    await db.vocabularyV2SessionItem.update({
      where: { id: target.id },
      data: { questionSnapshot: { ...row.questionSnapshot, cue: { ...row.questionSnapshot.cue, audioText: row.contentSnapshot.headword } } },
    });
    const view = await svc.testSession(stu, test.id);
    const item = view.items.find((candidate: any) => candidate.id === target.id);
    expect(containsDeep(item, row.contentSnapshot.headword)).toBe(false);
  });

  it('答完这一题 / 交卷后：回顾里才给完整题目和卡片', async () => {
    const { db, svc, stu, test } = await formalTestInProgress();
    const target = test.items.find((item: any) => item.question.type === 'spelling')!;
    const row = db.rows('vocabularyV2SessionItem', { id: target.id })[0];
    const answered = await svc.answerTestItem(stu, test.id, target.id, row.contentSnapshot.headword);
    const reviewed = answered.items.find((item: any) => item.id === target.id);
    expect(reviewed.question.answer).toBe(row.contentSnapshot.headword);
    expect(reviewed.isCorrect).toBe(true);
    expect(reviewed.card.headword).toBe(row.contentSnapshot.headword);
  });
});

describe('VOC04 自助练习的听写 / 拼写', () => {
  async function customTest(withAudio: boolean) {
    const db = newDb();
    const stu = seedStudent(db, { level: 'olevel' });
    const words = seedOfficialWords(db, 'ngsl', 1801, 6, { translation: neutralTranslation });
    for (const word of words) {
      // 第 5 阶 = 听写阶段
      db.seed('studentVocabularySense', { studentId: stu, senseId: word.senseId, masteryStage: 5, reps: 2 });
      if (withAudio) db.seed('wordAudio', { headword: word.headword, bytes: new Uint8Array([1, 2, 3]) });
    }
    const svc = makeService(db);
    const test = await svc.startCustomTest(stu, { count: 'all', scope: 'all' });
    return { db, svc, stu, test, words };
  }

  it('有服务端音频才出听写题；payload 里只有取音频的标识，没有单词', async () => {
    const { db, svc, stu, test } = await customTest(true);
    const listening = test.items.filter((item: any) => item.question.type === 'listening_spelling');
    expect(listening.length).toBeGreaterThan(0);
    for (const item of listening) {
      const headword = db.rows('vocabularyV2SessionItem', { id: item.id })[0].contentSnapshot.headword;
      expect(containsDeep(item, headword)).toBe(false);
      expect(item.question.cue).toEqual(expect.objectContaining({ audio: 'item' }));
      const audio = await svc.testItemAudio(stu, test.id, item.id);
      expect(audio.contentType).toBe('audio/mpeg');
      expect(audio.bytes.length).toBe(3);
    }
  });

  it('没有服务端音频的词不出听写题（否则只能用系统朗读 = 把单词明文交给客户端）', async () => {
    const { test } = await customTest(false);
    expect(test.items.some((item: any) => item.question.type === 'listening_spelling')).toBe(false);
    for (const item of test.items) expect(containsDeep(item.question, 'audioText')).toBe(false);
  });

  it('非听写题取不到音频', async () => {
    const { svc, stu, test } = await customTest(false);
    await expect(svc.testItemAudio(stu, test.id, test.items[0].id)).rejects.toThrow();
  });
});
