import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { PrismaClient } from '@prisma/client';
import { AuditService } from '../audit/audit.service';
import { AchievementsService } from './achievements.service';
import { emptyCollectionV5Facts, type CollectionV5Facts } from './collection-v5-rules';

/**
 * 徽章与班级周目标 · **隔离库集成测试**（F05，2026-09-15）。
 *
 * 假 prisma 证明不了「并发落库只有一行」「两位老师同时撤销只成功一个」—— 那靠真 Postgres 的
 * 唯一约束与条件更新。只在设了 `PRODUCT_IT_DATABASE_URL`（或 `COACH_IT_DATABASE_URL`）时运行，
 * 并且**只允许本机、库名以 _test 或 _it 结尾的专用测试库**（会清表，禁止演示库）。
 * 启动方式见 `docs/upgrade-2026-09-15/LEDGER.md`。
 *
 * 学习事实用桩（独立完整分页加载器已有单测）；这里只验证落库、撤销、恢复、周目标的并发语义。
 */

const IT_URL = process.env.PRODUCT_IT_DATABASE_URL ?? process.env.COACH_IT_DATABASE_URL ?? '';
const NOW = new Date('2026-09-15T04:00:00.000Z');

function assertLocal(raw: string) {
  const u = new URL(raw);
  if (!['127.0.0.1', 'localhost', '::1', '[::1]'].includes(u.hostname) || !/(?:_test|_it)$/.test(u.pathname.slice(1))) {
    throw new Error('集成测试只允许本机且库名以_test或_it结尾的专用测试库（禁止演示/开发库）—— 拒绝执行');
  }
}

const FACTS: CollectionV5Facts = {
  ...emptyCollectionV5Facts(),
  readings: Array.from({ length: 15 }, (_, i) => ({ key: 'paper-' + i, submissionId: 'it_sub_' + i, at: new Date('2026-09-01T02:00:00Z') })),
  fullDays: Array.from({ length: 15 }, (_, i) => ({ key: 'full-day-' + i, at: new Date('2026-09-03T02:00:00Z') })),
};

async function seed(p: PrismaClient) {
  await p.user.createMany({
    data: [
      { id: 'it_tch_a', email: 'a@example.invalid', name: 'Teacher A', passwordHash: 'x', role: 'teacher' },
      { id: 'it_tch_b', email: 'b@example.invalid', name: 'Teacher B', passwordHash: 'x', role: 'teacher' },
      { id: 'it_admin', email: 'adm@example.invalid', name: 'Admin', passwordHash: 'x', role: 'admin' },
      { id: 'it_stu', email: 's@example.invalid', name: 'Student', passwordHash: 'x', role: 'student' },
    ],
  });
  await p.class.createMany({
    data: [
      { id: 'it_class_a', name: 'A', classCode: 'ITCLASSA' },
      { id: 'it_class_b', name: 'B', classCode: 'ITCLASSB' },
    ],
  });
  await p.classEnrollment.createMany({
    data: [
      { id: 'it_e1', classId: 'it_class_a', userId: 'it_tch_a', role: 'teacher' },
      { id: 'it_e2', classId: 'it_class_b', userId: 'it_tch_b', role: 'teacher' },
      { id: 'it_e3', classId: 'it_class_a', userId: 'it_stu', role: 'student' },
    ],
  });
}

describe.skipIf(!IT_URL)('徽章与班级周目标 · 隔离库（真 Postgres 语义）', () => {
  let prisma: PrismaClient;
  let svc: AchievementsService;
  const A = { id: 'it_tch_a', role: 'teacher' };
  const ADMIN = { id: 'it_admin', role: 'admin' };
  const originalOn = process.env.PRODUCT_MODULES_ON;
  const originalOff = process.env.PRODUCT_MODULES_OFF;

  beforeAll(async () => {
    assertLocal(IT_URL);
    process.env.PRODUCT_MODULES_ON = 'achievements,class_goal';
    delete process.env.PRODUCT_MODULES_OFF;
    prisma = new PrismaClient({ datasources: { db: { url: IT_URL } } });
    const growth = { achievementFacts: async () => FACTS };
    svc = new AchievementsService(prisma as any, new AuditService(prisma as any));
    (svc as any).loadFacts = async () => FACTS;
  });
  afterAll(async () => {
    await prisma?.$disconnect();
    if (originalOn === undefined) delete process.env.PRODUCT_MODULES_ON; else process.env.PRODUCT_MODULES_ON = originalOn;
    if (originalOff === undefined) delete process.env.PRODUCT_MODULES_OFF; else process.env.PRODUCT_MODULES_OFF = originalOff;
  });
  beforeEach(async () => {
    assertLocal(IT_URL);
    await prisma.$executeRawUnsafe('TRUNCATE "User", "Class", "AuditLog" RESTART IDENTITY CASCADE');
    await seed(prisma);
  });

  it('**并发落库 10 次 → 每枚徽章只有 1 行**；读接口不写库', async () => {
    const before = await svc.forStudent('it_stu', NOW);
    expect(before.unsaved).toEqual(['v5_reading_1']);
    expect(await prisma.studentAchievement.count()).toBe(0);

    const grants = await Promise.all(Array.from({ length: 10 }, () => svc.sync('it_stu', NOW)));
    expect(grants.flatMap((result) => result.newlyEarned).sort()).toEqual(['v5_hidden_triad', 'v5_reading_1']);
    const rows = await prisma.studentAchievement.findMany({ where: { studentId: 'it_stu' }, orderBy: { badgeKey: 'asc' } });
    expect(rows.map((r) => r.badgeKey)).toEqual(['v5_hidden_triad', 'v5_reading_1']);
    expect(rows.find((r) => r.badgeKey === 'v5_reading_1')).toMatchObject({ earnedOn: '2026-09-01', rulesVersion: 5, revokedAt: null });

    const after = await svc.forStudent('it_stu', NOW);
    expect(after.unsaved).toEqual([]);
  });

  it('**两位老师同时撤销同一枚 → 只成功一个，另一个 409；审计一条**；撤销后再落库不会复活', async () => {
    await svc.sync('it_stu', NOW);
    const settled = await Promise.allSettled([
      svc.revokeBadge(A, 'it_class_a', 'it_stu', 'v5_reading_1', '重复导入的答卷', NOW),
      svc.revokeBadge(ADMIN, 'it_class_a', 'it_stu', 'v5_reading_1', '数据有误', NOW),
    ]);
    expect(settled.filter((s) => s.status === 'fulfilled')).toHaveLength(1);
    const rejected = settled.filter((s): s is PromiseRejectedResult => s.status === 'rejected');
    expect((rejected[0].reason as any).getResponse()).toMatchObject({ code: 'badge_already_revoked' });
    expect(await prisma.auditLog.count({ where: { action: 'achievement.revoke', entityId: 'it_stu' } })).toBe(1);

    await svc.sync('it_stu', NOW);
    const view = await svc.forStudent('it_stu', NOW);
    expect(view.badges.find((b) => b.key === 'v5_reading_1')).toMatchObject({ earned: false, revoked: { reason: expect.any(String) } });
    expect(await prisma.studentAchievement.count({ where: { studentId: 'it_stu', badgeKey: 'v5_reading_1' } })).toBe(1);
  });

  it('B 班老师撤销 A 班学生的徽章 → 403，行不变', async () => {
    await svc.sync('it_stu', NOW);
    await expect(svc.revokeBadge({ id: 'it_tch_b', role: 'teacher' }, 'it_class_a', 'it_stu', 'v5_reading_1', '理由理由', NOW)).rejects.toMatchObject({ status: 403 });
    // 换成自己的班也不行：学生不在 B 班
    await expect(svc.revokeBadge({ id: 'it_tch_b', role: 'teacher' }, 'it_class_b', 'it_stu', 'v5_reading_1', '理由理由', NOW)).rejects.toMatchObject({ status: 404 });
    const row = await prisma.studentAchievement.findUnique({ where: { studentId_badgeKey: { studentId: 'it_stu', badgeKey: 'v5_reading_1' } } });
    expect(row?.revokedAt).toBeNull();
  });

  it('恢复：徽章回来，达成日不变；再恢复一次 → 409；审计各一条', async () => {
    await svc.sync('it_stu', NOW);
    await svc.revokeBadge(A, 'it_class_a', 'it_stu', 'v5_reading_1', '先撤销', NOW);
    const restored = await svc.restoreBadge(A, 'it_class_a', 'it_stu', 'v5_reading_1', '核对后没问题', NOW);
    expect(restored.badges.find((b) => b.key === 'v5_reading_1')).toMatchObject({ earned: true, earnedOn: '2026-09-01', revoked: null });
    await expect(svc.restoreBadge(A, 'it_class_a', 'it_stu', 'v5_reading_1', null, NOW)).rejects.toMatchObject({ status: 409 });
    expect(await prisma.auditLog.count({ where: { action: 'achievement.restore' } })).toBe(1);
  });

  it('**两位老师同时开启本周目标 → 只有 1 行**；关闭、再开启都在同一行上；每次都留审计', async () => {
    await Promise.all([svc.setWeeklyGoal(A, 'it_class_a', true, NOW), svc.setWeeklyGoal(ADMIN, 'it_class_a', true, NOW)]);
    expect(await prisma.classWeeklyGoal.count({ where: { classId: 'it_class_a' } })).toBe(1);

    const off = await svc.setWeeklyGoal(A, 'it_class_a', false, NOW);
    expect(off.enabled).toBe(false);
    const on = await svc.setWeeklyGoal(A, 'it_class_a', true, NOW);
    expect(on).toMatchObject({ enabled: true, weekStart: '2026-09-14', progress: { visible: false, reason: 'small_group' } });
    expect(await prisma.classWeeklyGoal.count({ where: { classId: 'it_class_a' } })).toBe(1);
    expect(await prisma.auditLog.count({ where: { entityId: 'it_class_a', action: { in: ['class_goal.enable', 'class_goal.disable'] } } })).toBe(4);

    const goals = await svc.classGoalsForStudent('it_stu', NOW);
    expect(goals.goals.map((g) => g.classId)).toEqual(['it_class_a']);
  });

  it('学生账号删除 → 徽章跟着删（级联）', async () => {
    await svc.sync('it_stu', NOW);
    await prisma.user.delete({ where: { id: 'it_stu' } });
    expect(await prisma.studentAchievement.count()).toBe(0);
  });

  it('first sync initializes exactly once; two tabs claim one persisted notification only', async () => {
    await Promise.all([svc.sync('it_stu', NOW), svc.sync('it_stu', NOW)]);
    expect(await prisma.studentAchievementCollection.count({ where: { studentId: 'it_stu', rulesVersion: 5 } })).toBe(1);
    expect((await svc.notices('it_stu')).backfillKeys).toHaveLength(2);
    const claims = await Promise.all(Array.from({ length: 8 }, () => svc.claimNotices('it_stu', ['v5_reading_1'], NOW)));
    expect(claims.flatMap((c) => c.claimedKeys)).toEqual(['v5_reading_1']);
    expect((await svc.notices('it_stu')).newKeys).toContain('v5_reading_1');
    expect((await svc.notices('it_stu')).backfillKeys).not.toContain('v5_reading_1');
    await svc.viewNotices('it_stu', ['v5_reading_1'], NOW);
    expect((await svc.notices('it_stu')).newKeys).not.toContain('v5_reading_1');
  });
});
