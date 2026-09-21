/**
 * VOC16 · 校园内容闸门（2026-09-21）。
 *
 * 原症状：每日新词顺着 NGSL / NAWL 排名往后取，只过滤「学生见没见过」。
 * olevel 档游标走到 ngsl@1900，当天第一个词就是 breast，中文「n. 胸部, 乳房,
 * 胸怀」；ielts_simplified 档更早推过 sex「n. 性别, 性欲」。「我会了，换一个」
 * 挑替补词的循环同样没有闸门，学生点换词也可能换出被挡的词。
 *
 * 这里用真实官方词表的排名（夹具直接切 officialList），不是假词。
 */
import { describe, expect, it, vi } from 'vitest';
import { officialList, officialListVersion } from './official-wordlists';
import { SCHOOL_GLOSS_OVERRIDES } from './school-safe-words';
import { makeService, newDb, seedOfficialWords, seedStudent, sgtNoon } from './testing/vocab-fixtures';

vi.setConfig({ testTimeout: 30_000 });

const MON = sgtNoon('2026-09-21');
const ngsl = (rank: number) => officialList('ngsl')[rank - 1].headword;
const nawl = (rank: number) => officialList('nawl')[rank - 1].headword;

function setCursor(db: any, studentId: string, listName: 'ngsl' | 'nawl', nextRank: number) {
  db.seed('studentVocabularyCursor', { studentId, listName, listVersion: officialListVersion(listName), nextRank });
}

describe('VOC16 每日推送与换词绕开被挡的词', () => {
  it('前提：breast 就在 ngsl 第 1900 位（真实词表，不是夹具编的）', () => {
    expect(ngsl(1900)).toBe('breast');
    expect(ngsl(1063)).toBe('sex');
  });

  it('游标停在 breast 前面：当天 10 个词里没有 breast，名额由后面的词补足', async () => {
    const db = newDb();
    const stu = seedStudent(db, { level: 'olevel', dailyTarget: 10 });
    seedOfficialWords(db, 'ngsl', 1801, 120);
    setCursor(db, stu, 'ngsl', 1895);

    const session = await makeService(db).startDailySession(stu, MON);
    const headwords = session.items.map((row: any) => row.card.headword);

    expect(headwords).not.toContain('breast');
    expect(headwords).toHaveLength(10);
    expect(headwords).toEqual(expect.arrayContaining([ngsl(1899), ngsl(1901)]));
  });

  it('游标正好指着 breast：照样出满 10 个词，游标越过去不回头', async () => {
    const db = newDb();
    const stu = seedStudent(db, { level: 'olevel', dailyTarget: 10 });
    seedOfficialWords(db, 'ngsl', 1801, 120);
    setCursor(db, stu, 'ngsl', 1900);

    const session = await makeService(db).startDailySession(stu, MON);
    expect(session.items.map((row: any) => row.card.headword)).not.toContain('breast');
    expect(session.items).toHaveLength(10);
    const cursor = db.rows('studentVocabularyCursor', { studentId: stu, listName: 'ngsl' })[0];
    expect(cursor.nextRank).toBeGreaterThan(1900);
  });

  it('ielts_simplified 档走到 sex（ngsl@1063）也一样被跳过', async () => {
    const db = newDb();
    const stu = seedStudent(db, { level: 'ielts_simplified', dailyTarget: 10 });
    seedOfficialWords(db, 'ngsl', 1001, 120);
    setCursor(db, stu, 'ngsl', 1060);

    const session = await makeService(db).startDailySession(stu, MON);
    expect(session.items.map((row: any) => row.card.headword)).not.toContain('sex');
    expect(session.items).toHaveLength(10);
  });

  it('「我会了，换一个」的下一个候选是 breast 时跳过它', async () => {
    const db = newDb();
    const stu = seedStudent(db, { level: 'olevel', dailyTarget: 5 });
    seedOfficialWords(db, 'ngsl', 1801, 120);
    setCursor(db, stu, 'ngsl', 1895);
    const svc = makeService(db);

    const session = await svc.startDailySession(stu, MON);
    const before = session.items.map((row: any) => row.card.headword);
    expect(before).toEqual([ngsl(1895), ngsl(1896), ngsl(1897), ngsl(1898), ngsl(1899)]);

    const result = await svc.replaceDailyItem(stu, session.id, session.items[0].id);
    expect(result.replacement!.newHeadword).not.toBe('breast');
    expect(result.replacement!.newHeadword).toBe(ngsl(1901));
  });

  it('老师在词表里亲手指定的词不受闸门限制（那是老师的决定）', async () => {
    const db = newDb();
    const stu = seedStudent(db, { level: 'olevel', dailyTarget: 5 });
    const seeded = seedOfficialWords(db, 'ngsl', 1801, 120);
    const breast = seeded.find((row) => row.headword === 'breast')!;
    db.seed('vocabularyV2Assignment', { id: 'asg-1', classId: 'class-1', date: new Date('2026-09-21T00:00:00.000Z'), title: '老师词表', assignedById: 't1' });
    db.seed('vocabularyV2AssignmentItem', { assignmentId: 'asg-1', senseId: breast.senseId, position: 1, force: false });

    const session = await makeService(db).startDailySession(stu, MON);
    expect(session.items.map((row: any) => row.card.headword)).toContain('breast');
  });
});

describe('VOC16 学生查词', () => {
  it('搜 breast 不返回官方词条；同前缀的普通词照常返回', async () => {
    const db = newDb();
    const stu = seedStudent(db, { level: 'olevel' });
    const svc = makeService(db);

    const exact = await svc.search(stu, 'breast');
    expect(exact.items.map((item: any) => item.headword)).not.toContain('breast');

    const prefix = await svc.search(stu, 'brea', 50);
    const headwords = prefix.items.map((item: any) => item.headword);
    expect(headwords).not.toContain('breast');
    expect(headwords).toEqual(expect.arrayContaining(['bread', 'break']));
  });
});

describe('VOC16 人工释义覆盖词典堆砌', () => {
  it('hip（nawl@728）推送时用人工释义，已经建好的旧释义也被改正', async () => {
    expect(nawl(728)).toBe('hip');
    const db = newDb();
    const stu = seedStudent(db, { level: 'ielts_light', dailyTarget: 5 });
    seedOfficialWords(db, 'nawl', 720, 20, {
      translation: (headword) => (headword === 'hip' ? 'n. 臀部, 蔷薇果, 忧郁' : `n. 中文${headword}`),
    });
    setCursor(db, stu, 'nawl', 726);

    const session = await makeService(db).startDailySession(stu, MON);
    const hipCard = session.items.find((row: any) => row.card.headword === 'hip');
    expect(hipCard).toBeTruthy();
    expect(db.rows('vocabularySense', { id: 'sense-nawl-hip' })[0].translation).toBe(SCHOOL_GLOSS_OVERRIDES.hip);
    expect(JSON.stringify(hipCard.card)).not.toContain('忧郁');
  });
});
