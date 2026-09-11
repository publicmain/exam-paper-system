/**
 * 内存假 Prisma 自检：并发回归测试要靠它近似 Postgres READ COMMITTED，
 * 这里先钉住它自己的语义，免得「测试绿」其实是假库太宽松。
 */
import { describe, expect, it } from 'vitest';
import { memoryPrisma } from './memory-prisma';

describe('memory-prisma 自检', () => {
  it('事务内写入提交前别人看不见（READ COMMITTED）', async () => {
    const db = memoryPrisma();
    db.seed('vocabularyV2Session', { id: 's1', sessionKey: 'k1', studentId: 'u1', date: new Date('2026-09-10'), sessionType: 'daily_learning', mode: 'x', version: 'v', target: 1, settingsSnapshot: {}, sourceSummary: {} });
    let seenInside: string | undefined;
    let seenOutside: string | undefined;
    await db.$transaction(async (tx: any) => {
      await tx.vocabularyV2Session.update({ where: { id: 's1' }, data: { status: 'completed' } });
      seenInside = (await tx.vocabularyV2Session.findUnique({ where: { id: 's1' } })).status;
      seenOutside = (await db.vocabularyV2Session.findUnique({ where: { id: 's1' } })).status;
    });
    expect(seenInside).toBe('completed');
    expect(seenOutside).toBe('in_progress');
    expect(db.rows('vocabularyV2Session')[0].status).toBe('completed');
  });

  it('条件更新是原子的：同一行只有一个请求能从 pending 改成 completed', async () => {
    const db = memoryPrisma();
    db.seed('vocabularyV2SessionItem', { id: 'i1', sessionId: 's1', senseId: 'x', position: 1, source: 'level_gap', masteryBefore: 1, contentVersion: 1, contentSnapshot: {} });
    const claim = () => db.$transaction(async (tx: any) =>
      tx.vocabularyV2SessionItem.updateMany({ where: { id: 'i1', status: 'pending' }, data: { status: 'completed', attempts: { increment: 1 } } }));
    const results = await Promise.all([claim(), claim(), claim()]);
    expect(results.map((r: any) => r.count).sort()).toEqual([0, 0, 1]);
    expect(db.rows('vocabularyV2SessionItem')[0].attempts).toBe(1);
  });

  it('唯一键：并发插入同一 sessionKey，只有一个成功，另一个 P2002', async () => {
    const db = memoryPrisma();
    const create = () => db.vocabularyV2Session.create({ data: { sessionKey: 'same', studentId: 'u1', date: new Date('2026-09-10'), sessionType: 'formal_test', mode: 'x', version: 'v', target: 1, settingsSnapshot: {}, sourceSummary: {} } });
    const settled = await Promise.allSettled([create(), create()]);
    expect(settled.filter((r) => r.status === 'fulfilled')).toHaveLength(1);
    const rejected = settled.find((r) => r.status === 'rejected') as PromiseRejectedResult;
    expect(rejected.reason.code).toBe('P2002');
  });

  it('回滚的事务不留下任何写入，也不占着唯一键', async () => {
    const db = memoryPrisma();
    await expect(db.$transaction(async (tx: any) => {
      await tx.vocabularyV2Session.create({ data: { sessionKey: 'k', studentId: 'u1', date: new Date('2026-09-10'), sessionType: 'x', mode: 'x', version: 'v', target: 1, settingsSnapshot: {}, sourceSummary: {} } });
      throw new Error('boom');
    })).rejects.toThrow('boom');
    expect(db.rows('vocabularyV2Session')).toHaveLength(0);
    await db.vocabularyV2Session.create({ data: { sessionKey: 'k', studentId: 'u1', date: new Date('2026-09-10'), sessionType: 'x', mode: 'x', version: 'v', target: 1, settingsSnapshot: {}, sourceSummary: {} } });
    expect(db.rows('vocabularyV2Session')).toHaveLength(1);
  });

  it('嵌套 create / include / 关系过滤 / 级联删除', async () => {
    const db = memoryPrisma();
    const created = await db.vocabularyV2Session.create({
      data: {
        sessionKey: 'k', studentId: 'u1', date: new Date('2026-09-10'), sessionType: 'daily_learning', mode: 'x', version: 'v', target: 2, settingsSnapshot: {}, sourceSummary: {},
        items: { create: [
          { senseId: 'a', position: 2, source: 'level_gap', masteryBefore: 1, contentVersion: 1, contentSnapshot: {} },
          { senseId: 'b', position: 1, source: 'level_gap', masteryBefore: 1, contentVersion: 1, contentSnapshot: {} },
        ] },
      },
      include: { items: { orderBy: { position: 'asc' } } },
    });
    expect(created.items.map((item: any) => item.senseId)).toEqual(['b', 'a']);
    const pending = await db.vocabularyV2SessionItem.findMany({ where: { session: { studentId: 'u1', sessionType: 'daily_learning' }, status: { in: ['pending'] } } });
    expect(pending).toHaveLength(2);
    await db.vocabularyV2Session.delete({ where: { id: created.id } });
    expect(db.rows('vocabularyV2SessionItem')).toHaveLength(0);
  });

  it('写日志：只读查询不记录写入', async () => {
    const db = memoryPrisma();
    await db.vocabularyV2Session.findMany({ where: { studentId: 'u1' } });
    expect(db.writes).toHaveLength(0);
    await db.studentVocabularyProfile.upsert({ where: { studentId: 'u1' }, create: { studentId: 'u1' }, update: {} });
    expect(db.writes).toEqual([{ model: 'studentVocabularyProfile', op: 'upsert' }]);
  });

  it('不认识的过滤写法直接报错，不会悄悄当成匹配', async () => {
    const db = memoryPrisma();
    db.seed('vocabularyV2Session', { id: 's1', sessionKey: 'k1', studentId: 'u1', date: new Date('2026-09-10'), sessionType: 'daily_learning', mode: 'x', version: 'v', target: 1, settingsSnapshot: {}, sourceSummary: {} });
    await expect(db.vocabularyV2Session.findMany({ where: { status: { weird: 1 } } })).rejects.toThrow(/unsupported/);
  });
});
