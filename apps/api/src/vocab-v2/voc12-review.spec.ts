/**
 * VOC12 · 已完成的学习任务可按日期只读重新打开（审计 2026-09-11 §5.3，后端部分）。
 *
 * 原症状：学完后「背一背」只在刚学完那一刻出现；刷新或次日回来，已完成的学习会话被
 * 送回首页，没有稳定入口回看当天那批教学卡。
 *
 * 后端给两个只读 GET：
 *   · daily/review?date= —— 那天冻结的教学卡（背一背只列学完的词；稍后再学的单独列出去向），
 *     以及那天正式卷的指针（有就给，没有也**不生成**）；
 *   · daily/history —— 按日期列出做过的学习任务，供「按日期回看」入口。
 * 反复打开不加学习量、不改进度、不建卷。
 */
import { describe, expect, it } from 'vitest';
import { makeService, newDb, seedOfficialWords, seedStudent, sgtNoon } from './testing/vocab-fixtures';

const MON = sgtNoon('2026-09-07');
const TUE = sgtNoon('2026-09-08');

async function setup() {
  const db = newDb();
  const stu = seedStudent(db, { level: 'olevel', dailyTarget: 5 });
  seedOfficialWords(db, 'ngsl', 1801, 40);
  const svc = makeService(db);
  const mon = await svc.startDailySession(stu, MON);
  for (const [index, item] of mon.items.entries()) await svc.actOnLearningItem(stu, mon.id, item.id, index === 4 ? 'skip' : index === 0 ? 'hard' : 'normal');
  return { db, stu, svc, mon };
}

describe('VOC12 按日期只读回看', () => {
  it('次日回看周一：原冻结的卡片、背一背只列学完的 4 个（有点难的排前面），稍后再学的单独列出', async () => {
    const { stu, svc, mon } = await setup();
    const review = await svc.reviewDailySession(stu, TUE, '2026-09-07');
    expect(review).toEqual(expect.objectContaining({ readOnly: true, date: '2026-09-07', sessionId: mon.id, learned: 4, deferred: 1 }));
    expect(review!.recite.map((row: any) => row.card.headword)).toEqual([mon.items[0], mon.items[1], mon.items[2], mon.items[3]].map((row: any) => row.card.headword));
    expect(review!.recite[0].action).toBe('hard');
    expect(review!.deferredWords).toEqual([mon.items[4].card.headword]);
    expect(review!.test).toEqual(expect.objectContaining({ generated: true, total: 4 }));
  });

  it('反复打开 / 看历史列表：零写库，不加学习量、不建卷', async () => {
    const { db, stu, svc } = await setup();
    for (const row of db.rows('vocabularyV2Session', { sessionType: 'formal_test' })) await db.vocabularyV2Session.delete({ where: { id: row.id } });
    db.resetWrites();
    const first = await svc.reviewDailySession(stu, TUE, '2026-09-07');
    await svc.reviewDailySession(stu, TUE, '2026-09-07');
    const history = await svc.dailyHistory(stu, TUE);
    expect(db.writes).toEqual([]);
    expect(first!.test).toEqual(expect.objectContaining({ generated: false, total: null }));
    expect(history.days).toEqual([expect.objectContaining({ date: '2026-09-07', status: 'completed', learned: 4, deferred: 1, test: expect.objectContaining({ generated: false }) })]);
  });

  it('没有那天的任务 → null；未来日期 → bad_task_date', async () => {
    const { stu, svc } = await setup();
    await expect(svc.reviewDailySession(stu, TUE, '2026-09-04')).resolves.toBeNull();
    await expect(svc.reviewDailySession(stu, TUE, '2026-09-09')).rejects.toMatchObject({ response: expect.objectContaining({ code: 'bad_task_date' }) });
  });
});
