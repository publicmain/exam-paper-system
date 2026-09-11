/**
 * VOC02 · 「我会了，换一个」：按规范化拼写全局去重、候选池可继续补足、
 * 耗尽时不先删原词不虚报（审计 2026-09-11 §5.3）。
 *
 * 原症状：
 *   · 排除只按 senseId —— 同拼写的另一个词义（阅读时加的 personal 词、别的词表）照样入选；
 *   · 只看游标后 100 个候选 —— 学生见过的词多了就「无可替换」，而更大的等级池还有词；
 *   · 老师词表那天（listName 是 personal/老师自带的词）直接报 source_unavailable；
 *   · 重试 / 双击会把刚换上来的新词也标成「会了」；两张卡同时换可能撞同一个词 → 500。
 */
import { describe, expect, it, vi } from 'vitest';
import { officialList } from './official-wordlists';
import { makeService, newDb, seedOfficialWords, seedStudent, sgtNoon } from './testing/vocab-fixtures';

// 内存假库逐语句让出事件循环，整套并行跑时单个用例可能超过默认 5 秒；这里只放宽超时，不改断言。
vi.setConfig({ testTimeout: 30_000 });

const MON = sgtNoon('2026-09-07');
const ngsl = (rank: number) => officialList('ngsl')[rank - 1].headword;

function personalWord(db: any, headword: string, opts: { publishable?: boolean } = {}) {
  const lexemeId = `lex-personal-${headword}`;
  const senseId = `sense-personal-${headword}`;
  db.seed('vocabularyLexeme', { id: lexemeId, listName: 'personal', listVersion: '1', rank: 0, headword });
  db.seed('vocabularySense', { id: senseId, lexemeId, senseKey: 'noun:01', pos: 'noun', definition: `a ${headword}`, translation: `n. 个人${headword}`, qualityStatus: 'ready' });
  if (opts.publishable !== false) {
    db.seed('vocabularyContext', { senseId, kind: 'short_same_meaning', position: 1, difficulty: 1, sentence: `We saw the ${headword} again today.`, translation: `我们今天又看到了${headword}。` });
  }
  return senseId;
}

async function setup(input: { target?: number; seedCount?: number } = {}) {
  const db = newDb();
  const stu = seedStudent(db, { level: 'olevel', dailyTarget: input.target ?? 5 });
  seedOfficialWords(db, 'ngsl', 1801, input.seedCount ?? 40);
  const svc = makeService(db);
  return { db, stu, svc };
}

function seedTeacherList(db: any, senseIds: string[], force: boolean[] = []) {
  db.seed('vocabularyV2Assignment', { id: 'asg-1', classId: 'class-1', date: new Date('2026-09-07T00:00:00.000Z'), title: '老师词表', assignedById: 't1' });
  senseIds.forEach((senseId, index) => db.seed('vocabularyV2AssignmentItem', { assignmentId: 'asg-1', senseId, position: index + 1, force: Boolean(force[index]) }));
}

describe('VOC02 换词按拼写全局去重', () => {
  it('同拼写的另一个词义（阅读时自己加过的 personal 词）不会被换进来', async () => {
    const { db, stu, svc } = await setup();
    const clash = ngsl(1806);
    db.seed('studentVocabularySense', { studentId: stu, senseId: personalWord(db, clash) });
    const session = await svc.startDailySession(stu, MON);
    expect(session.items.map((row: any) => row.card.headword)).not.toContain(clash);
    const result = await svc.replaceDailyItem(stu, session.id, session.items[0].id);
    expect(result.replacement!.newHeadword).not.toBe(clash);
    expect(result.replacement!.newHeadword).toBe(ngsl(1807));
  });

  it('游标后 100 个都见过：继续往后找，不谎称「没有词了」', async () => {
    const { db, stu, svc } = await setup({ seedCount: 140 });
    for (let rank = 1806; rank <= 1920; rank += 1) {
      db.seed('studentVocabularySense', { studentId: stu, senseId: `sense-ngsl-${ngsl(rank)}`, masteryStage: 8, inNotebook: false });
    }
    const session = await svc.startDailySession(stu, MON);
    const result = await svc.replaceDailyItem(stu, session.id, session.items[0].id);
    expect(result.replacement!.newHeadword).toBe(ngsl(1921));
  });

  it('老师词表那天（词表外的词）：从学生档位词表补，不报 source_unavailable', async () => {
    const { db, stu, svc } = await setup();
    const words = ['kopitiam', 'hawker', 'voiddeck', 'durian', 'mrt'];
    seedTeacherList(db, words.map((word) => personalWord(db, word)));
    const session = await svc.startDailySession(stu, MON);
    expect(session.mode).toBe('teacher_list');
    const result = await svc.replaceDailyItem(stu, session.id, session.items[0].id);
    expect(result.replacement!.oldHeadword).toBe('kopitiam');
    expect(result.replacement!.newHeadword).toBe(ngsl(1801));
    expect(result.items[0].source).toBe('level_gap');
  });
});

describe('VOC02 换词成功 / 失败的事实', () => {
  it('成功：位置和总数不变，原词标会，新词入我的单词，事件带归属行，游标只前进', async () => {
    const { db, stu, svc } = await setup();
    const session = await svc.startDailySession(stu, MON);
    const original = session.items[2];
    const oldSense = db.rows('vocabularyV2SessionItem', { id: original.id })[0].senseId;
    const result = await svc.replaceDailyItem(stu, session.id, original.id, { expectedSenseId: oldSense });
    expect(result.target).toBe(session.target);
    expect(result.items).toHaveLength(session.items.length);
    expect(result.items[2].id).toBe(original.id);
    expect(result.items[2].card.headword).toBe(result.replacement!.newHeadword);
    const oldOwned = db.rows('studentVocabularySense', { studentId: stu, senseId: oldSense })[0];
    expect(oldOwned).toEqual(expect.objectContaining({ masteryStage: 8, inNotebook: false, reps: 0 }));
    const event = db.rows('vocabularyCollectionEvent', { studentId: stu, action: 'known_replaced' })[0];
    expect(event.studentSenseId).toBe(oldOwned.id);
    const item = db.rows('vocabularyV2SessionItem', { id: original.id })[0];
    expect(item.response.replacedFrom).toEqual([expect.objectContaining({ senseId: oldSense, headword: original.card.headword })]);
    const newOwned = db.rows('studentVocabularySense', { studentId: stu, senseId: item.senseId })[0];
    expect(newOwned).toEqual(expect.objectContaining({ inNotebook: true, masteryStage: 1, reps: 0 }));
    const cursor = db.rows('studentVocabularyCursor', { studentId: stu, listName: 'ngsl' })[0];
    expect(cursor.nextRank).toBe(1807);
  });

  it('真的耗尽：原词原样留着（不标会、不移出），不写事件，错误里说清楚还能怎么做', async () => {
    const { db, stu, svc } = await setup({ seedCount: 5 });
    const session = await svc.startDailySession(stu, MON);
    const before = db.rows('studentVocabularySense', { studentId: stu });
    await expect(svc.replaceDailyItem(stu, session.id, session.items[0].id)).rejects.toMatchObject({
      response: expect.objectContaining({ code: 'v2_replacement_exhausted', kept: true, options: ['learn', 'later'] }),
    });
    expect(db.rows('studentVocabularySense', { studentId: stu })).toEqual(before);
    expect(db.rows('vocabularyCollectionEvent', { studentId: stu, action: 'known_replaced' })).toHaveLength(0);
    expect(db.rows('vocabularyV2SessionItem', { id: session.items[0].id })[0].status).toBe('pending');
  });

  it('重试（响应丢了再点一次）：带上看到的词义 → 原样返回，不把刚换上来的新词也标会', async () => {
    const { db, stu, svc } = await setup();
    const session = await svc.startDailySession(stu, MON);
    const itemId = session.items[0].id;
    const seenSense = db.rows('vocabularyV2SessionItem', { id: itemId })[0].senseId;
    const first = await svc.replaceDailyItem(stu, session.id, itemId, { expectedSenseId: seenSense });
    const retry = await svc.replaceDailyItem(stu, session.id, itemId, { expectedSenseId: seenSense });
    expect(retry.replayed).toBe(true);
    expect(retry.replacement!.newHeadword).toBe(first.replacement!.newHeadword);
    expect(db.rows('vocabularyCollectionEvent', { studentId: stu, action: 'known_replaced' })).toHaveLength(1);
    const newOwned = db.rows('studentVocabularySense', { studentId: stu, senseId: `sense-ngsl-${first.replacement!.newHeadword}` })[0];
    expect(newOwned.masteryStage).toBe(1);
    expect(newOwned.inNotebook).toBe(true);
  });

  it('同一张卡两个请求同时换：只换一次；两张卡同时换：各换到不同的新词，不 500', async () => {
    const { db, stu, svc } = await setup();
    const session = await svc.startDailySession(stu, MON);
    const [a, b] = await Promise.all([
      svc.replaceDailyItem(stu, session.id, session.items[0].id),
      svc.replaceDailyItem(stu, session.id, session.items[0].id),
    ]);
    expect(db.rows('vocabularyCollectionEvent', { studentId: stu, action: 'known_replaced' })).toHaveLength(1);
    expect([a.replayed, b.replayed].filter(Boolean)).toHaveLength(1);
    const [c, d] = await Promise.all([
      svc.replaceDailyItem(stu, session.id, session.items[1].id),
      svc.replaceDailyItem(stu, session.id, session.items[2].id),
    ]);
    expect(c.replacement!.newHeadword).not.toBe(d.replacement!.newHeadword);
    const headwords = db.rows('vocabularyV2SessionItem', { sessionId: session.id }).map((row: any) => row.contentSnapshot.headword);
    expect(new Set(headwords).size).toBe(headwords.length);
  });

  it('老师强制重学的词：有标记（settings.forcedSeen），与按拼写跳过的分开记', async () => {
    const { db, stu, svc } = await setup();
    const seenSense = personalWord(db, 'kopitiam');
    db.seed('studentVocabularySense', { studentId: stu, senseId: seenSense, masteryStage: 8, inNotebook: false });
    seedTeacherList(db, [seenSense, personalWord(db, 'hawker')], [true, false]);
    const session = await svc.startDailySession(stu, MON);
    expect(session.settings.forcedSeen).toEqual(['kopitiam']);
    expect(session.settings.skippedSeen).toEqual([]);
  });
});
