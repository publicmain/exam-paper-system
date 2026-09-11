/**
 * VOC13 · 「重新学习」实际只恢复生词本成员关系 → 改成准确的「重新加入」（审计 2026-09-11 §5.3）。
 *
 * 原症状：按钮叫「重新学习」，接口 `notebook/relearn` 只把 inNotebook 改回 true、
 * 阶段降到 7，事件记 `relearn` —— 并没有开始任何教学，名字承诺的比做的多。更糟的是
 * 阶段降到 7 后，一个曾经「稍后再学」过的词会被每日任务当成延后词捞回来，变成
 * 「重复每日新词」。
 */
import { describe, expect, it, vi } from 'vitest';
import { countActuallyLearned } from './unified-vocabulary-rules';
import { makeService, newDb, seedOfficialWords, seedStudent, sgtNoon } from './testing/vocab-fixtures';

// 内存假库逐语句让出事件循环，整套并行跑时单个用例可能超过默认 5 秒；这里只放宽超时，不改断言。
vi.setConfig({ testTimeout: 30_000 });

const MON = sgtNoon('2026-09-07');
const TUE = sgtNoon('2026-09-08');

async function setup() {
  const db = newDb();
  const stu = seedStudent(db, { level: 'olevel', dailyTarget: 5 });
  seedOfficialWords(db, 'ngsl', 1801, 40);
  const svc = makeService(db);
  return { db, stu, svc };
}

describe('VOC13 移出 → 重新加入', () => {
  it('收藏数回来、历史都在、学习次数和累计学词不变，返回里说清楚没有开始学习', async () => {
    const { db, stu, svc } = await setup();
    const mon = await svc.startDailySession(stu, MON);
    for (const item of mon.items) await svc.actOnLearningItem(stu, mon.id, item.id, 'normal');
    const target = mon.items[0].senseId;
    const before = await svc.vocabularyCenter(stu, {});
    const learnedBefore = countActuallyLearned(db.rows('studentVocabularySense', { studentId: stu }) as Array<{ reps: number }>);
    const repsBefore = db.rows('studentVocabularySense', { studentId: stu, senseId: target })[0].reps;

    await svc.setNotebookMembership(stu, target, false);
    const removed = await svc.vocabularyCenter(stu, {});
    expect(removed.stats.total).toBe(before.stats.total - 1);

    const restored = await svc.restoreToNotebook(stu, target);
    expect(restored).toEqual(expect.objectContaining({ ok: true, inNotebook: true, action: 'restored', startsLearning: false, countsAsNewWord: false }));
    const after = await svc.vocabularyCenter(stu, {});
    expect(after.stats.total).toBe(before.stats.total);
    expect(after.stats.totalLearned).toBe(before.stats.totalLearned);
    expect(countActuallyLearned(db.rows('studentVocabularySense', { studentId: stu }) as Array<{ reps: number }>)).toBe(learnedBefore);
    expect(db.rows('studentVocabularySense', { studentId: stu, senseId: target })[0].reps).toBe(repsBefore);
    const actions = db.rows('vocabularyCollectionEvent', { studentId: stu, senseId: target }).map((row: any) => row.action);
    expect(actions).toEqual(expect.arrayContaining(['normal', 'removed_mastered', 'restored']));
    expect(actions).not.toContain('relearn');
  });

  it('曾经「稍后再学」过的词：移出再重新加入后，不会被当成延后词塞回每日任务', async () => {
    const { stu, svc } = await setup();
    const mon = await svc.startDailySession(stu, MON);
    await svc.actOnLearningItem(stu, mon.id, mon.items[0].id, 'skip');
    for (const item of mon.items.slice(1)) await svc.actOnLearningItem(stu, mon.id, item.id, 'normal');
    const deferred = mon.items[0];
    await svc.setNotebookMembership(stu, deferred.senseId, false);
    await svc.restoreToNotebook(stu, deferred.senseId);
    const tue = await svc.startDailySession(stu, TUE);
    expect(tue.items.map((row: any) => row.card.headword)).not.toContain(deferred.card.headword);
  });

  it('旧接口名 relearn 仍可用，但做的就是「重新加入」', async () => {
    const { db, stu, svc } = await setup();
    const mon = await svc.startDailySession(stu, MON);
    const target = mon.items[0].senseId;
    await svc.setNotebookMembership(stu, target, false);
    const result = await svc.setNotebookMembership(stu, target, true);
    expect(result).toEqual(expect.objectContaining({ action: 'restored', startsLearning: false }));
    expect(db.rows('vocabularyCollectionEvent', { studentId: stu, senseId: target, action: 'restored' })).toHaveLength(1);
  });
});
