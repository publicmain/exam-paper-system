/**
 * VOC01 · 学完操作幂等，并发最后两词也能结束（审计 2026-09-11 §5.3）。
 *
 * 原症状：`actOnLearningItem` 用事务外读到的旧 `session.items` 算「还剩几张」，
 * 两个标签页同时点最后两张卡时，各自都看见另一张还没学 → 会话永远停在
 * in_progress、正式卷不生成；重复请求（双击 / 重试）还会把 reps 再加一次。
 *
 * 全部跑在内存假库上（READ COMMITTED + 行锁近似，见 testing/memory-prisma.ts）。
 */
import { describe, expect, it } from 'vitest';
import { makeService, newDb, seedOfficialWords, seedStudent, sgtNoon } from './testing/vocab-fixtures';

const NOW = sgtNoon('2026-09-10');

async function setup(target = 5) {
  const db = newDb();
  const stu = seedStudent(db, { level: 'olevel', dailyTarget: target });
  seedOfficialWords(db, 'ngsl', 1801, 30);
  const svc = makeService(db);
  const session = await svc.startDailySession(stu, NOW);
  return { db, svc, stu, session };
}

describe('VOC01 学完操作幂等', () => {
  it('同一张卡重复点「学完」（重试 / 双击）：学习次数只加一次，事件只记一次', async () => {
    const { db, svc, stu, session } = await setup();
    const item = session.items[0];
    await svc.actOnLearningItem(stu, session.id, item.id, 'normal');
    const second = await svc.actOnLearningItem(stu, session.id, item.id, 'normal');
    const senseId = db.rows('vocabularyV2SessionItem', { id: item.id })[0].senseId;
    const owned = db.rows('studentVocabularySense', { studentId: stu, senseId })[0];
    expect(owned.reps).toBe(1);
    expect(db.rows('vocabularyCollectionEvent', { studentId: stu, senseId, action: 'normal' })).toHaveLength(1);
    expect(db.rows('vocabularyV2SessionItem', { id: item.id })[0].attempts).toBe(1);
    // 第二次调用照常返回最新会话，不报错（前端重试不该看到失败）
    expect(second.items.find((row: any) => row.id === item.id)?.status).toBe('completed');
  });

  it('两个请求同时点同一张卡：只有一个生效', async () => {
    const { db, svc, stu, session } = await setup();
    const item = session.items[0];
    await Promise.all([
      svc.actOnLearningItem(stu, session.id, item.id, 'normal'),
      svc.actOnLearningItem(stu, session.id, item.id, 'normal'),
    ]);
    const senseId = db.rows('vocabularyV2SessionItem', { id: item.id })[0].senseId;
    expect(db.rows('studentVocabularySense', { studentId: stu, senseId })[0].reps).toBe(1);
    expect(db.rows('vocabularyCollectionEvent', { studentId: stu, senseId, action: 'normal' })).toHaveLength(1);
  });

  it('两个标签页同时学完最后两张：会话结束，且只生成一份正式卷', async () => {
    const { db, svc, stu, session } = await setup(5);
    const items = session.items;
    for (const item of items.slice(0, 3)) await svc.actOnLearningItem(stu, session.id, item.id, 'normal');
    const [a, b] = await Promise.all([
      svc.actOnLearningItem(stu, session.id, items[3].id, 'normal'),
      svc.actOnLearningItem(stu, session.id, items[4].id, 'hard'),
    ]);
    const daily = db.rows('vocabularyV2Session', { id: session.id })[0];
    expect(daily.status).toBe('completed');
    const formal = db.rows('vocabularyV2Session', { studentId: stu, sessionType: 'formal_test' });
    expect(formal).toHaveLength(1);
    // 两个响应里至少一个带出了这份卷；带出的都是同一份
    const ids = [a.generatedTestId, b.generatedTestId].filter(Boolean);
    expect(ids.length).toBeGreaterThan(0);
    expect(new Set(ids)).toEqual(new Set([formal[0].id]));
  });

  it('正式卷并发生成（学完回调 + 首页「开始测试」同时到）：同一份，不报 500', async () => {
    const { db, svc, stu, session } = await setup(5);
    for (const item of session.items) await svc.actOnLearningItem(stu, session.id, item.id, 'normal');
    // 模拟学完回调没来得及生成：删掉已生成的卷，再让两个请求同时去建
    for (const row of db.rows('vocabularyV2Session', { sessionType: 'formal_test' })) {
      await db.vocabularyV2Session.delete({ where: { id: row.id } });
    }
    const [x, y] = await Promise.all([
      svc.startFormalTest(stu, session.id),
      svc.startFormalTest(stu, session.id),
    ]);
    expect(x.id).toBe(y.id);
    expect(db.rows('vocabularyV2Session', { sessionType: 'formal_test' })).toHaveLength(1);
  });

  it('旧回调不能把进度往回拨：先到的第 5 张、后到的第 2 张，cursor 停在 5', async () => {
    const { db, svc, stu, session } = await setup(5);
    await Promise.all([
      svc.actOnLearningItem(stu, session.id, session.items[4].id, 'normal'),
      svc.actOnLearningItem(stu, session.id, session.items[1].id, 'normal'),
    ]);
    expect(db.rows('vocabularyV2Session', { id: session.id })[0].cursor).toBe(5);
  });

  it('全部学完后再点任何一张（旧页面迟到的请求）：不改学习次数、不重开会话', async () => {
    const { db, svc, stu, session } = await setup(5);
    for (const item of session.items) await svc.actOnLearningItem(stu, session.id, item.id, 'normal');
    const before = db.rows('studentVocabularySense', { studentId: stu }).map((row) => row.reps);
    const late = await svc.actOnLearningItem(stu, session.id, session.items[0].id, 'normal');
    expect(late.status).toBe('completed');
    expect(db.rows('studentVocabularySense', { studentId: stu }).map((row) => row.reps)).toEqual(before);
    expect(db.rows('vocabularyV2Session', { sessionType: 'formal_test' })).toHaveLength(1);
  });
});
