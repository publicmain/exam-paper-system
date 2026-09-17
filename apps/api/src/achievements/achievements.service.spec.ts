import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
vi.mock('../common/roles', () => ({ canActOnClass: vi.fn(async () => true) }));
import { canActOnClass } from '../common/roles';
import { AchievementsService, mergeBadge } from './achievements.service';
import { BADGES as LEGACY_BADGES } from './badge-rules';
import { emptyTieredFacts, type TieredAchievementFacts } from './tiered-badge-rules';

const NOW = new Date('2026-09-15T04:00:00.000Z');
const TEACHER = { id: 't1', role: 'teacher', ip: null };
const READING = 'v3_reading_explorer_l1';
const FIRST = 'v3_first_chapter_l1';
function facts(over: Partial<TieredAchievementFacts> = {}): TieredAchievementFacts {
  return { ...emptyTieredFacts(),
    readings: Array.from({ length: 15 }, (_, i) => ({ key: 'paper-' + i, submissionId: 'sub-' + (i + 1), at: new Date('2026-09-01T02:00:00.000Z') })),
    fullDays: Array.from({ length: 15 }, (_, i) => ({ key: 'full-day-' + i, at: new Date('2026-09-03T02:00:00.000Z') })),
    ...over };
}
type Opts = { facts?: TieredAchievementFacts; rows?: any[]; createdCount?: number; updated?: number; existing?: any;
  enrollment?: any; studentClasses?: any[]; members?: any[]; assignments?: any[]; goals?: any[]; goalRow?: any };
function world(opts: Opts = {}) {
  const prisma: any = {
    studentAchievement: {
      findMany: vi.fn(async () => opts.rows ?? []),
      createMany: vi.fn(async () => ({ count: opts.createdCount ?? 1 })),
      updateMany: vi.fn(async () => ({ count: opts.updated ?? 1 })),
      findUnique: vi.fn(async () => opts.existing ?? null),
    },
    classEnrollment: {
      findMany: vi.fn(async ({ where }: any) => where.userId ? opts.studentClasses ?? [] : opts.members ?? []),
      findUnique: vi.fn(async () => opts.enrollment === undefined ? { role: 'student' } : opts.enrollment),
    },
    classWeeklyGoal: {
      findMany: vi.fn(async () => opts.goals ?? []), findUnique: vi.fn(async () => opts.goalRow ?? null),
      createMany: vi.fn(async () => ({ count: 1 })), updateMany: vi.fn(async () => ({ count: 1 })),
    },
    paperAssignment: { findMany: vi.fn(async () => opts.assignments ?? []) },
    studentLevelChange: { findMany: vi.fn(async () => []) },
    $queryRaw: vi.fn(async () => []),
  };
  prisma.$transaction = vi.fn(async (fn: any) => fn(prisma));
  const growth = { achievementFacts: vi.fn() };
  const audit = { log: vi.fn(async () => undefined) };
  const svc = new AchievementsService(prisma, audit as any);
  const load = vi.spyOn(svc as any, 'loadFacts').mockImplementation(async () => ({ ...facts(), learningBatches: [], tests: [], fullDays: [], activeDays: [], ...(opts.facts ?? {}) }));
  return { prisma, growth, audit, svc, load };
}
beforeEach(() => {
  vi.mocked(canActOnClass).mockReset().mockResolvedValue(true);
  process.env.PRODUCT_MODULES_ON = 'achievements,class_goal';
  delete process.env.PRODUCT_MODULES_OFF;
});
afterEach(() => { delete process.env.PRODUCT_MODULES_ON; delete process.env.PRODUCT_MODULES_OFF; });

describe('V5 replaces displayed awards without deleting history', () => {
  it('GET displays only the new 16 definitions, never unpersisted ownership or old keys', async () => {
    const w = world({ rows: [{ badgeKey: 'reading_5', earnedOn: '2026-09-01', evidence: {}, rulesVersion: 1, revokedAt: null }] });
    const result = await w.svc.forStudent('stu-1', NOW);
    expect(result.rulesVersion).toBe(5);
    expect(result.badges).toHaveLength(16);
    expect(result.badges.every((b) => b.key.startsWith('v5_') && !b.earned)).toBe(true);
    expect(result.legacyBadges).toEqual([]);
    expect(w.prisma.$transaction).not.toHaveBeenCalled();
    expect(w.prisma.studentAchievement.createMany).not.toHaveBeenCalled();
  });

  it('module off rejects before facts or database access', async () => {
    process.env.PRODUCT_MODULES_OFF = 'achievements';
    const w = world();
    await expect(w.svc.forStudent('stu-1', NOW)).rejects.toMatchObject({ status: 503 });
    await expect(w.svc.sync('stu-1', NOW)).rejects.toMatchObject({ status: 503 });
    expect(w.load).not.toHaveBeenCalled();
  });

  it('legacy evidence remains sanitized for archival teacher tools', () => {
    const b = { ...LEGACY_BADGES[0], current: 0, earned: false, earnedOn: null, evidence: { submissionIds: [], dates: [] } };
    expect(mergeBadge(b, { badgeKey: b.key, earnedOn: '2026-09-03', evidence: { submissionIds: [1, 'x', null], dates: 'bad' }, rulesVersion: 1, revokedAt: null, revokeReason: null }).evidence).toEqual({ submissionIds: ['x'], dates: [] });
  });
});

describe('班级周目标', () => {
  const member = (id: string) => ({ userId: id, joinedAt: new Date('2026-09-01T00:00:00.000Z'), user: { englishLevel: 'olevel' } });
  const sub = (studentId: string, done: boolean) => ({
    id: `sub-${studentId}`,
    studentId,
    status: done ? 'marked' : 'draft',
    finalSubmittedAt: done ? new Date('2026-09-14T03:00:00.000Z') : null,
    submitSource: done ? 'student' : null,
    _count: { scripts: done ? 8 : 0 },
  });
  const assignment = (subs: any[]) => ({
    id: 'as-1',
    classId: 'c1',
    paper: { name: 'Queue' },
    morningQuizSession: { id: 'mq-1', date: new Date('2026-09-14T00:00:00.000Z'), level: 'olevel', status: 'published' },
    submissions: subs,
  });

  it('**演示 / QA 账号不算成员**；有效成员不足 5 人 → 不给数字，也不去查答卷', async () => {
    const { prisma, svc } = world({ members: ['s1', 's2', 's3', 's4', 'p1_qa_acc_1', 'p1_qa_acc_2'].map(member) });
    const p = await svc.classProgress('c1', '2026-09-14', '2026-09-15');
    expect(p).toMatchObject({ visible: false, reason: 'small_group' });
    expect(prisma.paperAssignment.findMany).not.toHaveBeenCalled();
  });

  it('5 个有效成员：按实际分配归一化；演示账号交的卷不进分子', async () => {
    const ids = ['s1', 's2', 's3', 's4', 's5'];
    const { svc } = world({
      members: [...ids.map(member), member('p1_qa_acc_1')],
      assignments: [assignment([sub('s1', true), sub('s2', true), sub('s3', true), sub('s4', false), sub('p1_qa_acc_1', true)])],
    });
    const p = await svc.classProgress('c1', '2026-09-14', '2026-09-15');
    expect(p).toEqual({ visible: true, weekStart: '2026-09-14', weekEnd: '2026-09-20', activeMembers: 5, assigned: 5, completed: 3, pct: 60, catchUp: 0 });
  });

  it('学生：只返回自己所在班、本周开启着的目标', async () => {
    const { prisma, svc } = world({ studentClasses: [{ classId: 'c1' }], goals: [], members: [] });
    const r = await svc.classGoalsForStudent('stu-1', NOW);
    expect(r).toEqual({ weekStart: '2026-09-14', weekEnd: '2026-09-20', goals: [] });
    expect((prisma.classWeeklyGoal.findMany.mock.calls[0] as unknown[])[0]).toMatchObject({ where: { classId: { in: ['c1'] }, weekStart: '2026-09-14', disabledAt: null } });
  });

  it('老师开启：唯一键 + skipDuplicates，重开清掉 disabledAt，留审计；关闭只写 disabledAt', async () => {
    const on = world({ members: [] });
    await on.svc.setWeeklyGoal(TEACHER, 'c1', true, NOW);
    expect(on.prisma.classWeeklyGoal.createMany).toHaveBeenCalledWith({
      data: [{ classId: 'c1', weekStart: '2026-09-14', kind: 'assigned_reading', enabledById: 't1' }],
      skipDuplicates: true,
    });
    expect(on.prisma.classWeeklyGoal.updateMany).toHaveBeenCalledWith({
      where: { classId: 'c1', weekStart: '2026-09-14', disabledAt: { not: null } },
      data: { disabledAt: null, enabledById: 't1' },
    });
    expect(on.audit.log).toHaveBeenCalledWith(expect.objectContaining({ action: 'class_goal.enable', entityId: 'c1' }));

    const off = world({ members: [] });
    await off.svc.setWeeklyGoal(TEACHER, 'c1', false, NOW);
    expect(off.prisma.classWeeklyGoal.createMany).not.toHaveBeenCalled();
    expect(off.prisma.classWeeklyGoal.updateMany).toHaveBeenCalledWith({ where: { classId: 'c1', weekStart: '2026-09-14', disabledAt: null }, data: { disabledAt: NOW } });
    expect(off.audit.log).toHaveBeenCalledWith(expect.objectContaining({ action: 'class_goal.disable' }));
  });

  it('**不是自己的班 → 403，什么都不写**；学生身份 → 403', async () => {
    vi.mocked(canActOnClass).mockResolvedValue(false);
    const w = world();
    await expect(w.svc.setWeeklyGoal(TEACHER, 'c2', true, NOW)).rejects.toMatchObject({ status: 403 });
    expect(w.prisma.classWeeklyGoal.createMany).not.toHaveBeenCalled();
    await expect(w.svc.weeklyGoalForTeacher({ id: 's1', role: 'student' }, 'c1', NOW)).rejects.toMatchObject({ status: 403 });
  });
});

describe('老师撤销 / 恢复徽章', () => {
  it('撤销：必须是这个班的学生；只改没撤销过的那一行；留审计（带理由）', async () => {
    const { prisma, audit, svc } = world();
    await svc.revokeBadge(TEACHER, 'c1', 'stu-1', 'reading_5', '重复导入的答卷', NOW);
    expect(prisma.studentAchievement.updateMany).toHaveBeenCalledWith({
      where: { studentId: 'stu-1', badgeKey: 'reading_5', revokedAt: null },
      data: { revokedAt: NOW, revokedById: 't1', revokeReason: '重复导入的答卷' },
    });
    expect(audit.log).toHaveBeenCalledWith(expect.objectContaining({ action: 'achievement.revoke', entityId: 'stu-1', metadata: { classId: 'c1', badgeKey: 'reading_5', reason: '重复导入的答卷' } }), prisma);
  });

  it('**学生不在这个班 → 404，不改**；不认识的徽章 → 400；别的班 → 403', async () => {
    const notIn = world({ enrollment: null });
    await expect(notIn.svc.revokeBadge(TEACHER, 'c1', 'stu-x', 'reading_5', '理由理由', NOW)).rejects.toMatchObject({ status: 404 });
    expect(notIn.prisma.studentAchievement.updateMany).not.toHaveBeenCalled();

    const bad = world();
    await expect(bad.svc.revokeBadge(TEACHER, 'c1', 'stu-1', 'english_master', '理由理由', NOW)).rejects.toMatchObject({ status: 400 });

    vi.mocked(canActOnClass).mockResolvedValue(false);
    const other = world();
    await expect(other.svc.revokeBadge(TEACHER, 'c2', 'stu-1', 'reading_5', '理由理由', NOW)).rejects.toMatchObject({ status: 403 });
    expect(other.prisma.studentAchievement.updateMany).not.toHaveBeenCalled();
  });

  it('没发过 → 404 badge_not_earned；已经撤销过 → 409；两种都不写审计', async () => {
    const never = world({ updated: 0, existing: null });
    await expect(never.svc.revokeBadge(TEACHER, 'c1', 'stu-1', 'reading_5', '理由理由', NOW)).rejects.toMatchObject({ status: 404 });
    const twice = world({ updated: 0, existing: { revokedAt: new Date() } });
    await expect(twice.svc.revokeBadge(TEACHER, 'c1', 'stu-1', 'reading_5', '理由理由', NOW)).rejects.toMatchObject({ status: 409 });
    expect(never.audit.log).not.toHaveBeenCalled();
    expect(twice.audit.log).not.toHaveBeenCalled();
  });

  it('恢复：只改撤销过的；没撤销过 → 409；成功留审计', async () => {
    const ok = world();
    await ok.svc.restoreBadge(TEACHER, 'c1', 'stu-1', 'reading_5', '核对后数据没问题', NOW);
    expect(ok.prisma.studentAchievement.updateMany).toHaveBeenCalledWith({
      where: { studentId: 'stu-1', badgeKey: 'reading_5', revokedAt: { not: null } },
      data: { revokedAt: null, revokedById: null, revokeReason: null },
    });
    expect(ok.audit.log).toHaveBeenCalledWith(expect.objectContaining({ action: 'achievement.restore' }), ok.prisma);
    const no = world({ updated: 0 });
    await expect(no.svc.restoreBadge(TEACHER, 'c1', 'stu-1', 'reading_5', null, NOW)).rejects.toMatchObject({ status: 409 });
  });
});
