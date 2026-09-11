/**
 * VOC05 · 普通学生的查词 / 收词不能写共享的 ready 教学内容（审计 2026-09-11 §5.3）。
 *
 * 原症状：`collect` 把客户端传来的句子和译文直接写成全局 `VocabularyContext`
 *（kind=article_original、qualityStatus=ready），而下一个学生的教学卡第一次
 * 见面优先用的正是 article_original；同时每次收词都用词典/机翻覆盖共享 sense 的
 * 释义并把状态改回 ready；连「只查一下」也会建共享词条、写事件。
 */
import { describe, expect, it } from 'vitest';
import { fakeTranslator, makeService, newDb, seedOfficialWords, seedStudent } from './testing/vocab-fixtures';

function setup() {
  const db = newDb();
  const stu = seedStudent(db, { id: 'stu-a', level: 'olevel', classId: 'class-a' });
  const other = seedStudent(db, { id: 'stu-b', level: 'olevel', classId: 'class-b' });
  const [injury] = seedOfficialWords(db, 'ngsl', 1801, 1, { translation: () => 'n. 伤害（老师核过）' });
  db.seed('dictEntry', { word: 'injury', translation: 'n. 损伤，伤害\nn. 不公正', definition: 'harm', pos: 'n' });
  db.seed('dictEntry', { word: 'kopitiam', translation: 'n. 咖啡店', definition: 'a coffee shop', pos: 'n' });
  const translator = fakeTranslator();
  const svc = makeService(db, translator);
  return { db, stu, other, injury, svc, translator };
}

function seedArticle(db: any, input: { id: string; classId: string; passage: string; date?: string; level?: string }) {
  db.seed('paper', { id: `paper-${input.id}`, name: `Paper ${input.id}` });
  db.seed('question', { id: `q-${input.id}`, content: { stem: 'Q1', passage: input.passage } });
  db.seed('paperQuestion', { id: `pq-${input.id}`, paperId: `paper-${input.id}`, questionId: `q-${input.id}` });
  db.seed('paperAssignment', { id: input.id, paperId: `paper-${input.id}`, classId: input.classId, assignedById: 't1' });
  db.seed('morningQuizSession', { id: `mqs-${input.id}`, paperAssignmentId: input.id, classId: input.classId, date: new Date(`${input.date ?? '2026-09-10'}T00:00:00.000Z`), level: input.level ?? 'olevel', status: 'active' });
}

describe('VOC05 只查一下 = 零写入', () => {
  it('lookup_only 不建词条、不建归属、不写事件', async () => {
    const { db, stu, svc } = setup();
    db.resetWrites();
    const result = await svc.collect(stu, { headword: 'kopitiam', action: 'lookup_only', source: 'search' });
    expect(result.sense.translation).toContain('咖啡店');
    expect(result.added).toBe(false);
    expect(db.writes).toEqual([]);
    expect(db.rows('vocabularyLexeme', { headword: 'kopitiam' })).toHaveLength(0);
  });

  it('官方词只查一下：也不改共享 sense', async () => {
    const { db, stu, svc } = setup();
    db.resetWrites();
    const result = await svc.collect(stu, { headword: 'injury', action: 'lookup_only' });
    expect(result.sense.translation).toBe('n. 伤害（老师核过）');
    expect(db.writes).toEqual([]);
  });
});

describe('VOC05 收词不污染共享教学内容', () => {
  it('学生传来的整段垃圾例句和伪译文：不进共享 VocabularyContext', async () => {
    const { db, stu, injury, svc } = setup();
    const before = db.rows('vocabularyContext', { senseId: injury.senseId }).length;
    await svc.collect(stu, {
      headword: 'injury',
      action: 'learn',
      source: 'reading_lookup',
      contextSentence: 'Visit evil.example now!!! injury injury buy buy buy. '.repeat(20),
      contextTranslation: '这是伪造的翻译',
      sourceTitle: 'Whatever',
    });
    const contexts = db.rows('vocabularyContext', { senseId: injury.senseId });
    expect(contexts).toHaveLength(before);
    expect(contexts.some((row) => row.translation === '这是伪造的翻译')).toBe(false);
  });

  it('收词不覆盖共享 sense 的释义，也不把被拒的 sense 改回 ready', async () => {
    const { db, stu, injury, svc } = setup();
    await db.vocabularySense.update({ where: { id: injury.senseId }, data: { qualityStatus: 'rejected' } });
    await svc.collect(stu, { headword: 'injury', action: 'learn' });
    const sense = db.rows('vocabularySense', { id: injury.senseId })[0];
    expect(sense.translation).toBe('n. 伤害（老师核过）');
    expect(sense.qualityStatus).toBe('rejected');
  });

  it('拿别班文章的 ID：验证不过，不写共享例句', async () => {
    const { db, stu, injury, svc } = setup();
    seedArticle(db, { id: 'pa-b', classId: 'class-b', passage: 'The runner hid his injury from the coach. Nobody knew.' });
    await svc.collect(stu, {
      headword: 'injury', action: 'learn', source: 'reading_lookup',
      contextSentence: 'The runner hid his injury from the coach.', sourceRef: 'assignment:pa-b',
    });
    expect(db.rows('vocabularyContext', { senseId: injury.senseId, kind: 'article_original' })).toHaveLength(0);
  });

  it('本班已发布文章里真有这句：才写共享例句，译文由服务端出，不信客户端', async () => {
    const { db, stu, injury, svc } = setup();
    seedArticle(db, { id: 'pa-a', classId: 'class-a', passage: 'It rained all day.  The runner hid his injury from the coach.   Nobody knew.' });
    await svc.collect(stu, {
      headword: 'injury', action: 'learn', source: 'reading_lookup',
      contextSentence: 'The runner hid his injury from the coach.',
      contextTranslation: '客户端随便写的',
      sourceRef: 'assignment:pa-a',
    });
    const shared = db.rows('vocabularyContext', { senseId: injury.senseId, kind: 'article_original' });
    expect(shared).toHaveLength(1);
    expect(shared[0].sentence).toBe('The runner hid his injury from the coach.');
    expect(shared[0].translation).toBe('译:The runner hid his injury from the coach.');
    expect(shared[0].provider).toBe('article_verified');
  });

  it('同班别档、自己没打开过的文章：不算他有权读的，不写共享例句', async () => {
    const { db, stu, injury, svc } = setup();
    seedArticle(db, { id: 'pa-hard', classId: 'class-a', level: 'ielts_authentic', passage: 'The runner hid his injury from the coach.' });
    await svc.collect(stu, {
      headword: 'injury', action: 'learn', contextSentence: 'The runner hid his injury from the coach.', sourceRef: 'assignment:pa-hard',
    });
    expect(db.rows('vocabularyContext', { senseId: injury.senseId, kind: 'article_original' })).toHaveLength(0);
  });

  it('同班别档、但他确实打开过（有答卷，比如改档前做的那份）：算，写共享例句', async () => {
    const { db, stu, injury, svc } = setup();
    seedArticle(db, { id: 'pa-hard', classId: 'class-a', level: 'ielts_authentic', passage: 'The runner hid his injury from the coach.' });
    db.seed('studentSubmission', { assignmentId: 'pa-hard', studentId: stu, status: 'in_progress' });
    await svc.collect(stu, {
      headword: 'injury', action: 'learn', contextSentence: 'The runner hid his injury from the coach.', sourceRef: 'session:mqs-pa-hard',
    });
    expect(db.rows('vocabularyContext', { senseId: injury.senseId, kind: 'article_original' })).toHaveLength(1);
  });

  it('还没到日子的本档文章（提前拿到 ID）：不写共享例句', async () => {
    const { db, stu, injury, svc } = setup();
    seedArticle(db, { id: 'pa-future', classId: 'class-a', date: '2099-01-05', passage: 'The runner hid his injury from the coach.' });
    await svc.collect(stu, {
      headword: 'injury', action: 'learn', contextSentence: 'The runner hid his injury from the coach.', sourceRef: 'assignment:pa-future',
    });
    expect(db.rows('vocabularyContext', { senseId: injury.senseId, kind: 'article_original' })).toHaveLength(0);
  });

  it('文章里找不到这句（学生改过的句子）：不写共享例句', async () => {
    const { db, stu, injury, svc } = setup();
    seedArticle(db, { id: 'pa-a', classId: 'class-a', passage: 'The runner hid his injury from the coach.' });
    await svc.collect(stu, {
      headword: 'injury', action: 'learn', contextSentence: 'The runner proudly showed his injury to everyone.', sourceRef: 'assignment:pa-a',
    });
    expect(db.rows('vocabularyContext', { senseId: injury.senseId, kind: 'article_original' })).toHaveLength(0);
  });
});

describe('VOC05 合法的自加词和个人上下文照常可用', () => {
  it('词表外的词可加入；个人例句只截取含目标词的那一句，存在自己的记录里', async () => {
    const { db, stu, svc } = setup();
    const paragraph = 'We walked for an hour. My uncle runs a kopitiam near the market. It opens at six.';
    const result = await svc.collect(stu, { headword: 'kopitiam', action: 'learn', source: 'reading_lookup', contextSentence: paragraph, contextTranslation: '我叔叔在市场附近开了一家咖啡店。' });
    expect(result.added).toBe(true);
    const event = db.rows('vocabularyCollectionEvent', { studentId: stu, action: 'learn' })[0];
    expect(event.contextText).toBe('My uncle runs a kopitiam near the market.');
    const center = await svc.vocabularyCenter(stu, {});
    const item = center.items.find((row: any) => row.headword === 'kopitiam');
    expect(item?.context).toEqual(expect.objectContaining({ sentence: 'My uncle runs a kopitiam near the market.', personal: true }));
  });

  it('按钮绑定显示中的词条：senseId 与 headword 对不上 → 拒绝，不改错对象（配合 UI02）', async () => {
    const { stu, injury, svc } = setup();
    await expect(svc.collect(stu, { headword: 'kopitiam', action: 'learn', senseId: injury.senseId })).rejects.toMatchObject({
      response: expect.objectContaining({ code: 'sense_headword_mismatch' }),
    });
  });

  it('只查不改个人状态：查一个已经在我的单词里的词，掌握阶段不动', async () => {
    const { db, stu, injury, svc } = setup();
    db.seed('studentVocabularySense', { studentId: stu, senseId: injury.senseId, masteryStage: 5, reps: 2 });
    await svc.collect(stu, { headword: 'injury', action: 'lookup_only' });
    expect(db.rows('studentVocabularySense', { studentId: stu })[0].masteryStage).toBe(5);
  });
});
