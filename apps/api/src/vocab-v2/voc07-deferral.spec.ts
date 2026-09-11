/**
 * VOC07 · 延后词只有一个有效待处理归属（审计 2026-09-11 §5.3）。
 *
 * 原症状：「稍后再学」的词会被捞回下一天任务的最前面（这是对的），但过滤只看
 * skipped/completed —— 周一延后 → 周二已安排、没做 → 周三又安排一次，同一个词
 * 同时挂在两天的待学里；两天的任务并发生成时也会各塞一份。
 */
import { describe, expect, it } from 'vitest';
import { makeService, newDb, seedOfficialWords, seedStudent, sgtNoon } from './testing/vocab-fixtures';

const MON = sgtNoon('2026-09-07');
const TUE = sgtNoon('2026-09-08');
const WED = sgtNoon('2026-09-09');
const FRI = sgtNoon('2026-09-11');
const NEXT_MON = sgtNoon('2026-09-14');

async function setup() {
  const db = newDb();
  const stu = seedStudent(db, { level: 'olevel', dailyTarget: 5 });
  seedOfficialWords(db, 'ngsl', 1801, 60);
  const svc = makeService(db);
  return { db, stu, svc };
}

const headwords = (session: any) => session.items.map((row: any) => row.card.headword);

/** 某个词义此刻挂在几天的「待学」里。 */
function pendingCount(db: any, stu: string, senseId: string) {
  const sessions = new Set(db.rows('vocabularyV2Session', { studentId: stu, sessionType: 'daily_learning' }).map((row: any) => row.id));
  return db.rows('vocabularyV2SessionItem', { senseId, status: 'pending' }).filter((row: any) => sessions.has(row.sessionId)).length;
}

async function deferFirstOnMonday(svc: any, stu: string) {
  const mon = await svc.startDailySession(stu, MON);
  await svc.actOnLearningItem(stu, mon.id, mon.items[0].id, 'skip');
  for (const item of mon.items.slice(1)) await svc.actOnLearningItem(stu, mon.id, item.id, 'normal');
  return { mon, deferred: mon.items[0] };
}

describe('VOC07 延后词只挂在一天的待学里', () => {
  it('周一延后 → 周二已安排但没做 → 周三不再安排第二次', async () => {
    const { db, stu, svc } = await setup();
    const { deferred } = await deferFirstOnMonday(svc, stu);
    const tue = await svc.startDailySession(stu, TUE);
    expect(headwords(tue)[0]).toBe(deferred.card.headword);
    const wed = await svc.startDailySession(stu, WED);
    expect(headwords(wed)).not.toContain(deferred.card.headword);
    expect(pendingCount(db, stu, deferred.senseId)).toBe(1);
  });

  it('周二又明确「稍后再学」一次 → 按新状态迁到周三，仍只有一条待学', async () => {
    const { db, stu, svc } = await setup();
    const { deferred } = await deferFirstOnMonday(svc, stu);
    const tue = await svc.startDailySession(stu, TUE);
    await svc.actOnLearningItem(stu, tue.id, tue.items[0].id, 'skip');
    const wed = await svc.startDailySession(stu, WED);
    expect(headwords(wed).filter((word: string) => word === deferred.card.headword)).toHaveLength(1);
    expect(pendingCount(db, stu, deferred.senseId)).toBe(1);
  });

  it('周二、周三两天的任务同时生成：延后词只进其中一天；新词也不在两天重复', async () => {
    const { db, stu, svc } = await setup();
    const { deferred } = await deferFirstOnMonday(svc, stu);
    db.yieldsPerStatement = 3;
    const [tue, wed] = await Promise.all([
      svc.startDailySession(stu, TUE),
      svc.startDailySession(stu, WED),
    ]);
    const all = [...headwords(tue), ...headwords(wed)];
    expect(all.filter((word) => word === deferred.card.headword)).toHaveLength(1);
    expect(new Set(all).size).toBe(all.length);
    expect(pendingCount(db, stu, deferred.senseId)).toBe(1);
  });

  it('跨周：周五延后，下周一回来一次', async () => {
    const { stu, svc } = await setup();
    const fri = await svc.startDailySession(stu, FRI);
    await svc.actOnLearningItem(stu, fri.id, fri.items[0].id, 'skip');
    const mon = await svc.startDailySession(stu, NEXT_MON);
    expect(headwords(mon)[0]).toBe(fri.items[0].card.headword);
  });

  it('延后之后自己在「我的单词」里移出（=我会了）：不再回到每日任务', async () => {
    const { stu, svc } = await setup();
    const { deferred } = await deferFirstOnMonday(svc, stu);
    await svc.setNotebookMembership(stu, deferred.senseId, false);
    const tue = await svc.startDailySession(stu, TUE);
    expect(headwords(tue)).not.toContain(deferred.card.headword);
  });
});
