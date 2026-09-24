import 'reflect-metadata';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
vi.mock('../common/roles', () => ({ canActOnClass: vi.fn(async () => true) }));
import { canActOnClass } from '../common/roles';
import { REQUIRE_STUDENT_TOKEN } from '../common/student-access';
import { AchievementsService } from './achievements.service';
import { AchievementsController } from './achievements.controller';
import { emptyCollectionV5Facts, type CollectionV5Facts } from './collection-v5-rules';

const NOW = new Date('2026-09-17T04:00:00.000Z');
const OLD = new Date('2026-08-01T04:00:00.000Z');
const events = (n: number) => Array.from({ length: n }, (_, i) => ({ key: `event-${i}`, at: OLD, submissionId: `answer-${i}` }));
const learned = (count = 15): CollectionV5Facts => ({ ...emptyCollectionV5Facts(), readings: events(count) });
function matches(row: any, where: any): boolean {
  return Object.entries(where).every(([key, value]: any) => {
    if (value && typeof value === 'object' && !(value instanceof Date)) {
      if ('in' in value) return value.in.includes(row[key]);
      if ('not' in value) return row[key] !== value.not;
    }
    return (row[key] ?? null) === value;
  });
}
function world(options: { facts?: CollectionV5Facts; rows?: any[]; initialized?: boolean; classes?: any[]; peers?: any[] } = {}) {
  const rows = options.rows ?? [];
  let state: any = options.initialized ? { studentId: 's1', rulesVersion: 5, initializedAt: OLD } : null;
  let serial: Promise<unknown> = Promise.resolve();
  const prisma: any = {
    $queryRaw: vi.fn(async () => [{ id: 's1' }]),
    studentAchievement: {
      findMany: vi.fn(async ({ where }: any) => rows.filter((row) => matches(row, where))),
      findUnique: vi.fn(async ({ where }: any) => rows.find((row) => matches(row, where.studentId_badgeKey)) ?? null),
      createMany: vi.fn(async ({ data }: any) => {
        let count = 0;
        for (const row of data) if (!rows.some((old) => old.studentId === row.studentId && old.badgeKey === row.badgeKey)) {
          rows.push({ revokedAt: null, revokeReason: null, notificationClaimedAt: null, viewedAt: null, ...row }); count++;
        }
        return { count };
      }),
      updateMany: vi.fn(async ({ where, data }: any) => {
        let count = 0;
        for (const row of rows) if (matches(row, where)) { Object.assign(row, data); count++; }
        return { count };
      }),
    },
    studentAchievementCollection: {
      findUnique: vi.fn(async () => state),
      create: vi.fn(async ({ data }: any) => { state = data; return state; }),
    },
    classEnrollment: {
      findMany: vi.fn(async ({ where }: any) => where.userId ? options.classes ?? [] : options.peers ?? []),
      findUnique: vi.fn(async () => ({ role: 'student' })),
    },
  };
  prisma.$transaction = vi.fn((fn: any) => {
    const result = serial.then(() => fn(prisma));
    serial = result.catch(() => {});
    return result;
  });
  const audit = { log: vi.fn(async () => {}) };
  const svc = new AchievementsService(prisma, audit as any);
  const facts = vi.spyOn(svc as any, 'loadFacts').mockImplementation(async () => options.facts ?? learned());
  return { svc, rows, prisma, facts, audit };
}
function saved(key = 'v5_reading_1', over: any = {}) {
  return { studentId: 's1', badgeKey: key, earnedOn: '2026-08-01', evidence: { submissionIds: ['private-answer'], dates: [] },
    rulesVersion: 5, revokedAt: null, revokeReason: null, noticeKind: 'ceremony', notificationClaimedAt: null,
    viewedAt: null, createdAt: NOW, ...over };
}
beforeEach(() => { process.env.PRODUCT_MODULES_ON = 'achievements'; delete process.env.PRODUCT_MODULES_OFF; vi.mocked(canActOnClass).mockResolvedValue(true); });
afterEach(() => { delete process.env.PRODUCT_MODULES_ON; delete process.env.PRODUCT_MODULES_OFF; });

describe('V5 server collection and durable award notices', () => {
  it('eligible is not owned until committed; locked hidden never exposes rule/name/progress/model', async () => {
    const w = world({ facts: { ...learned(), fullDays: events(15) } });
    const list = await w.svc.forStudent('s1', NOW);
    expect(list.badges).toHaveLength(16);
    expect(list.badges.find((b) => b.key === 'v5_reading_1')).toMatchObject({ current: 15, earned: false, saved: false, earnedOn: null, grantedAt: null });
    expect(list.badges.find((b) => b.key === 'v5_hidden_triad')).toMatchObject({ title: '神秘徽章', description: null, assetId: null, current: null, threshold: null, unit: null, evidence: null, earned: false });
    expect(list.unsaved).not.toContain('v5_hidden_triad');
    expect(w.prisma.$transaction).not.toHaveBeenCalled();
  });

  it('first sync backfills historical awards, records actual grant time and initializes once', async () => {
    const w = world();
    expect(await w.svc.sync('s1', NOW)).toEqual({ newlyEarned: ['v5_reading_1'], historical: true });
    expect(w.rows[0]).toMatchObject({ noticeKind: 'backfill', createdAt: NOW, earnedOn: '2026-08-01', rulesVersion: 5 });
    expect(await w.svc.notices('s1')).toEqual({ ceremonyKeys: [], backfillKeys: ['v5_reading_1'], newKeys: ['v5_reading_1'] });
    expect(await w.svc.sync('s1', NOW)).toEqual({ newlyEarned: [], historical: false });
    expect(w.prisma.studentAchievementCollection.create).toHaveBeenCalledTimes(1);
  });

  it('zero-progress first visit still initializes; later real achievement gets ceremony', async () => {
    const w = world({ facts: emptyCollectionV5Facts() });
    await w.svc.sync('s1', NOW);
    expect(w.prisma.studentAchievementCollection.create).toHaveBeenCalledTimes(1);
    w.facts.mockResolvedValue(learned());
    await w.svc.sync('s1', NOW);
    expect(w.rows[0].noticeKind).toBe('ceremony');
  });

  it('retains every newly attained tier rather than collapsing to the highest', async () => {
    const w = world({ initialized: true, facts: learned(300) });
    expect((await w.svc.sync('s1', NOW)).newlyEarned).toEqual(['v5_reading_1', 'v5_reading_2', 'v5_reading_3', 'v5_reading_4']);
    expect((await w.svc.notices('s1')).ceremonyKeys).toHaveLength(4);
  });

  it('concurrent sync initializes once and inserts exactly one copy per medal', async () => {
    const w = world({ facts: learned(50) });
    const result = await Promise.all(Array.from({ length: 6 }, () => w.svc.sync('s1', NOW)));
    expect(result.flatMap((r) => r.newlyEarned)).toEqual(['v5_reading_1', 'v5_reading_2']);
    expect(result.filter((r) => r.historical)).toHaveLength(1);
    expect(w.rows).toHaveLength(2);
    expect(w.prisma.$queryRaw).toHaveBeenCalledTimes(6);
  });

  it('atomic notice claim allows only one tab, survives reload but keeps New marker', async () => {
    const w = world({ rows: [saved()] });
    const answers = await Promise.all([w.svc.claimNotices('s1', ['v5_reading_1'], NOW), w.svc.claimNotices('s1', ['v5_reading_1'], NOW)]);
    expect(answers.flatMap((a) => a.claimedKeys)).toEqual(['v5_reading_1']);
    expect(await w.svc.notices('s1')).toEqual({ ceremonyKeys: [], backfillKeys: [], newKeys: ['v5_reading_1'] });
    expect((await w.svc.forStudent('s1', NOW)).badges[0]).toMatchObject({ earned: true, isNew: true });
    await w.svc.viewNotices('s1', ['v5_reading_1'], NOW);
    expect((await w.svc.notices('s1')).newKeys).toEqual([]);
  });

  it('explicit viewing before playback prevents future auto celebration', async () => {
    const w = world({ rows: [saved()] });
    await w.svc.viewNotices('s1', ['v5_reading_1'], NOW);
    expect((await w.svc.notices('s1')).ceremonyKeys).toEqual([]);
    expect(await w.svc.claimNotices('s1', ['v5_reading_1'], NOW)).toEqual({ claimedKeys: [] });
  });

  it('cannot claim/view another account, revoked, unearned, or legacy awards', async () => {
    const other = saved('v5_reading_1', { studentId: 'other' });
    const revoked = saved('v5_reading_2', { revokedAt: NOW });
    const w = world({ rows: [other, revoked] });
    expect(await w.svc.claimNotices('s1', ['v5_reading_1', 'v5_reading_2', 'v5_reading_3'], NOW)).toEqual({ claimedKeys: [] });
    await w.svc.viewNotices('s1', ['v5_reading_1', 'v5_reading_2'], NOW);
    expect(other.viewedAt).toBeNull(); expect(revoked.viewedAt).toBeNull();
    await expect(w.svc.claimNotices('s1', ['reading_5'], NOW)).rejects.toMatchObject({ status: 400 });
    await expect(w.svc.viewNotices('s1', Array(17).fill('v5_reading_1'), NOW)).rejects.toMatchObject({ status: 400 });
  });

  it('saved awards survive later data changes while old keys are neither shown nor regranted', async () => {
    const legacy = saved('v3_reading_explorer_l1', { rulesVersion: 3 });
    const w = world({ facts: emptyCollectionV5Facts(), rows: [legacy, saved()] });
    const list = await w.svc.forStudent('s1', NOW);
    expect(list.badges[0]).toMatchObject({ earned: true, grantedAt: NOW.toISOString() });
    expect(list.badges.some((b) => b.key.startsWith('v3'))).toBe(false);
    await w.svc.sync('s1', NOW);
    expect(w.rows).toHaveLength(2); expect(legacy.rulesVersion).toBe(3);
  });

  it('previously saved starlight survives stricter activity qualification without revocation or regrant', async () => {
    const starlight = saved('v5_hidden_starlight');
    const before = structuredClone(starlight);
    const w = world({ initialized: true, facts: emptyCollectionV5Facts(), rows: [starlight] });
    expect((await w.svc.forStudent('s1', NOW)).badges.find((badge) => badge.key === starlight.badgeKey))
      .toMatchObject({ earned: true, saved: true, earnedOn: starlight.earnedOn, current: 4 });
    expect((await w.svc.sync('s1', NOW)).newlyEarned).toEqual([]);
    expect(w.rows).toEqual([before]);
    expect(w.prisma.studentAchievement.updateMany).not.toHaveBeenCalled();
    expect(w.prisma.studentAchievement.createMany).not.toHaveBeenCalled();
  });

  it('revoked prerequisite blocks new dependent tiers and never auto-restores', async () => {
    const w = world({ facts: learned(300), initialized: true, rows: [saved('v5_reading_1', { revokedAt: NOW })] });
    expect((await w.svc.sync('s1', NOW)).newlyEarned).toEqual([]);
    expect(w.rows[0].revokedAt).toEqual(NOW);
  });

  it('missing student does not initialize, grant, or load facts', async () => {
    const w = world(); w.prisma.$queryRaw.mockResolvedValue([]);
    await expect(w.svc.sync('unknown', NOW)).rejects.toMatchObject({ status: 404 });
    expect(w.facts).not.toHaveBeenCalled();
    expect(w.prisma.studentAchievementCollection.create).not.toHaveBeenCalled();
  });
});

describe('class collection privacy and teacher permissions', () => {
  it('whitelists only names and earned V5 metadata, never evidence/scores/progress', async () => {
    const w = world({ classes: [{ classId: 'c1', class: { id: 'c1', name: '班一' } }], peers: [
      { user: { id: 's1', name: 'A', achievements: [] } },
      { user: { id: 's2', name: 'B', email: 'private@example.test', score: 99, achievements: [{ badgeKey: 'v5_hidden_triad', evidence: 'secret' }, { badgeKey: 'reading_5' }] } },
    ] });
    const list = await w.svc.classmates('s1');
    expect(list.classes[0].students[1]).toEqual({ id: 's2', name: 'B', badges: [{ key: 'v5_hidden_triad', assetId: 'hidden-triad', title: '三叶同辉', series: 'hidden', tier: null }] });
    const calls = w.prisma.classEnrollment.findMany.mock.calls;
    expect(calls[0][0].where).toMatchObject({ userId: 's1', role: 'student', user: { isActive: true, archivedAt: null }, class: { archivedAt: null } });
    expect(calls[1][0].where).toMatchObject({ user: { isActive: true, archivedAt: null } });
    expect(calls[1][0].where.class.enrollments.some).toMatchObject({ userId: 's1', role: 'student', user: { isActive: true, archivedAt: null } });
    expect(calls[1][0].orderBy).toEqual([{ user: { name: 'asc' } }, { userId: 'asc' }]);
    expect(w.prisma.studentAchievement.createMany).not.toHaveBeenCalled();
    expect(w.facts).not.toHaveBeenCalled();
  });

  it('no enrollment means no classmates; transfer mid-request omits the old class', async () => {
    expect(await world().svc.classmates('s1')).toEqual({ classes: [] });
    const w = world({ classes: [{ classId: 'old', class: { id: 'old', name: '旧班' } }], peers: [{ user: { id: 's2', name: 'B', achievements: [] } }] });
    expect(await w.svc.classmates('s1')).toEqual({ classes: [] });
  });

  it('inactive peers are excluded and caller deactivation between queries cannot expose classmates', async () => {
    const w = world();
    let callerActive = true;
    const peers = [
      { user: { id: 's1', name: 'Active caller', isActive: true, archivedAt: null, achievements: [] } },
      { user: { id: 's2', name: 'Inactive peer', isActive: false, archivedAt: null, achievements: [{ badgeKey: 'v5_reading_1' }] } },
    ];
    w.prisma.classEnrollment.findMany.mockImplementation(async ({ where }: any) => {
      if (where.userId) return [{ classId: 'c1', class: { id: 'c1', name: '班一' } }];
      if (where.class.enrollments.some.user.isActive === true && !callerActive) return [];
      return peers.filter((row) => where.user.isActive !== true || row.user.isActive);
    });
    expect((await w.svc.classmates('s1')).classes[0].students.map((student) => student.id)).toEqual(['s1']);
    callerActive = false;
    expect(await w.svc.classmates('s1')).toEqual({ classes: [] });
  });

  it('staff cannot view a student outside their class scope', async () => {
    const w = world(); vi.mocked(canActOnClass).mockResolvedValue(false);
    await expect(w.svc.studentBadgesForTeacher({ id: 't1', role: 'teacher' }, 'c2', 's1', NOW)).rejects.toMatchObject({ status: 403 });
    expect(w.facts).not.toHaveBeenCalled();
  });
});

describe('notice controllers never accept a caller-supplied student identity', () => {
  const request = { studentAuth: { id: 's1' } } as any;
  it('strict DTO rejects extra identities and malformed/bulk keys', () => {
    const controller = new AchievementsController({ claimNotices: vi.fn(), viewNotices: vi.fn() } as any);
    expect(() => controller.claim(request, { keys: [], studentId: 'other' })).toThrow();
    expect(() => controller.claim(request, { keys: [42] })).toThrow();
    expect(() => controller.viewed(request, { keys: Array(17).fill('v5_reading_1') })).toThrow();
  });
  it('claim/view/classmates require full student identity; teacher read token remains read-only', () => {
    for (const method of ['claim', 'viewed', 'classmates', 'sync'] as const) {
      expect(Reflect.getMetadata(REQUIRE_STUDENT_TOKEN, AchievementsController.prototype[method])).toBe(true);
    }
    expect(Reflect.getMetadata(REQUIRE_STUDENT_TOKEN, AchievementsController.prototype.notices)).toBe('read');
  });
  it('forwards only verified token owner and valid keys', async () => {
    const svc = { claimNotices: vi.fn(async () => ({ claimedKeys: [] })) };
    const controller = new AchievementsController(svc as any);
    await controller.claim(request, { keys: ['v5_reading_1'] });
    expect(svc.claimNotices).toHaveBeenCalledWith('s1', ['v5_reading_1']);
    expect(() => controller.notices({} as any)).toThrow();
  });
});
