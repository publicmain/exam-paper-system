import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { AuditService } from '../audit/audit.service';
import { PrismaService } from '../common/prisma.service';
import { canActOnClass } from '../common/roles';
import { sgtKey } from './badge-time';
import { demoRules, isDemoAccount } from '../product/demo-accounts';
import { assertModuleEnabled } from '../product/product-modules';
import { assertStaff, type TeacherActor } from '../common/staff-actor';
import { assignedReadingFor } from '../vocab-v2/level-timeline';
import {
  BADGES as LEGACY_BADGES,
  mondayOf,
  type BadgeProgress,
} from './badge-rules';
import { TIERED_BADGES, type TieredBadgeProgress, type BadgeEvidence } from './tiered-badge-rules';
import { loadCollectionV5Facts } from './collection-v5-facts';
import { COLLECTION_V5_BADGES, COLLECTION_V5_RULES_VERSION, evaluateCollectionV5Badges, type CollectionV5Facts } from './collection-v5-rules';
import { CLASS_GOAL_MIN_MEMBERS, classGoalProgress, type ClassGoalProgress, type MemberReadings } from './class-goal';

const DAY_MS = 86_400_000;
const addDays = (key: string, n: number) => new Date(Date.parse(`${key}T00:00:00.000Z`) + n * DAY_MS).toISOString().slice(0, 10);
const BADGE_KEYS = new Set<string>([...LEGACY_BADGES, ...TIERED_BADGES, ...COLLECTION_V5_BADGES].map((b) => b.key));
const V5_KEYS: string[] = COLLECTION_V5_BADGES.map((b) => b.key);
const NOTICE_SELECT = { badgeKey: true, noticeKind: true, notificationClaimedAt: true, viewedAt: true } as const;
const SAVED_SELECT = { badgeKey: true, earnedOn: true, evidence: true, rulesVersion: true, revokedAt: true,
  revokeReason: true, createdAt: true, viewedAt: true } as const;
/** 周目标里的「补做」往回看多少天的场次 */
const CATCH_UP_LOOKBACK_DAYS = 42;

type Evidence = BadgeEvidence;

function evidenceOf(raw: unknown): Evidence {
  const e = (raw ?? {}) as Record<string, unknown>;
  const strs = (v: unknown) => (Array.isArray(v) ? v.filter((x): x is string => typeof x === 'string').slice(0, 20) : []);
  return { submissionIds: strs(e.submissionIds), dates: strs(e.dates),
    ...(Array.isArray(e.sessionIds) ? { sessionIds: strs(e.sessionIds) } : {}),
    ...(Array.isArray(e.itemIds) ? { itemIds: strs(e.itemIds) } : {}),
    ...(Array.isArray(e.dependencyKeys) ? { dependencyKeys: strs(e.dependencyKeys) } : {}),
    ...(typeof e.metric === 'string' ? { metric: e.metric } : {}),
    ...(typeof e.total === 'number' && Number.isFinite(e.total) ? { total: e.total } : {}),
    ...(typeof e.countedThrough === 'string' ? { countedThrough: e.countedThrough } : {}),
  };
}

export interface SavedBadgeRow {
  badgeKey: string;
  earnedOn: string;
  evidence: unknown;
  rulesVersion: number;
  revokedAt: Date | null;
  revokeReason: string | null;
}

export interface BadgeView {
  key: string;
  themeId?: TieredBadgeProgress['themeId'];
  tier?: TieredBadgeProgress['tier'];
  difficulty?: TieredBadgeProgress['difficulty'];
  blockedBy?: string[];
  title: string;
  description: string;
  threshold: number;
  unit: string;
  current: number;
  earned: boolean;
  earnedOn: string | null;
  /** 已经落库（之后不会因数据变化自动收回） */
  saved: boolean;
  /** 老师以数据有误撤销；学生看得到理由 */
  revoked: { at: string; reason: string | null } | null;
  evidence: Evidence;
}

/**
 * 规则算出来的进度 + 库里已发的徽章 → 给人看的一枚徽章。
 *
 *   · 已发且没撤销：永远算得到，达成日与依据用发的那一刻记下的（数据后来变了也不收回）；
 *   · 已撤销：不算得到，带上理由；规则再判定达成也不自动恢复 —— 要老师恢复；
 *   · 没发过：照规则当前的判定。
 */
export function mergeBadge(b: BadgeProgress | TieredBadgeProgress, row: SavedBadgeRow | null): BadgeView {
  const base = { key: b.key, title: b.title, description: b.description, threshold: b.threshold, unit: b.unit,
    ...('themeId' in b ? { themeId: b.themeId, tier: b.tier, difficulty: b.difficulty, blockedBy: b.blockedBy } : {}) };
  if (row && !row.revokedAt) {
    return { ...base, current: b.threshold, earned: true, earnedOn: row.earnedOn, saved: true, revoked: null, evidence: evidenceOf(row.evidence) };
  }
  if (row && row.revokedAt) {
    return {
      ...base,
      current: b.current,
      earned: false,
      earnedOn: null,
      saved: true,
      revoked: { at: row.revokedAt.toISOString(), reason: row.revokeReason },
      evidence: evidenceOf(b.evidence),
    };
  }
  return { ...base, current: b.current, earned: b.earned, earnedOn: b.earnedOn, saved: false, revoked: null, evidence: evidenceOf(b.evidence) };
}

/**
 * 个人徽章与班级周目标（F05，2026-09-15）。
 *
 * ## 读写分开
 *
 * `GET /achievements` **零写库**（教师「以学生视角查看」的只读令牌也能调）：规则现算 + 读已发的。
 * 规则判定达成但还没落库的，学生端再调一次 `POST /achievements/sync`（本人令牌）落库 ——
 * 唯一键 `(studentId, badgeKey)` + `createMany skipDuplicates`，并发、重放都只落一行。
 *
 * ## 事实从哪来
 *
 * V5 comes from complete verified server facts; bounded report display budgets never cap lifetime awards.
 * 浏览器传来的数字、客户端时间与任意等级参数不参与。
 *
 * ## 班级周目标
 *
 * 老师按周开启；学生只看汇总。成员里的演示 / QA 账号不计（`demo-accounts.ts`）；有效成员不足
 * `CLASS_GOAL_MIN_MEMBERS` 人时连数字都不给。周目标不写进任何人的必做清单、不锁任何功能。
 */
@Injectable()
export class AchievementsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  // ─────────────────────────── 学生：个人徽章 ───────────────────────────

  /** Independent lifetime facts: the intentionally bounded growth report is not an award ledger. */
  private loadFacts(studentId: string, now: Date, db: Parameters<typeof loadCollectionV5Facts>[0] = this.prisma): Promise<CollectionV5Facts> {
    return loadCollectionV5Facts(db, studentId, now);
  }

  async forStudent(studentId: string, now = new Date()) {
    assertModuleEnabled('achievements');
    const [facts, rows] = await Promise.all([
      this.loadFacts(studentId, now),
      this.prisma.studentAchievement.findMany({
        where: { studentId, badgeKey: { in: V5_KEYS } },
        select: SAVED_SELECT,
      }),
    ]);
    const byKey = new Map(rows.map((r) => [r.badgeKey, r]));
    const evaluated = evaluateCollectionV5Badges(facts, rows);
    const badges = evaluated.map((b) => {
      const row = byKey.get(b.key);
      const earned = Boolean(row && !row.revokedAt);
      const lockedHidden = b.hidden && !earned;
      return {
        key: b.key, assetId: lockedHidden ? null : b.assetId, series: b.series, tier: b.tier,
        hidden: b.hidden, clue: b.clue,
        title: lockedHidden ? '神秘徽章' : b.title,
        description: lockedHidden ? null : b.description,
        threshold: lockedHidden ? null : b.threshold,
        unit: lockedHidden ? null : b.unit,
        current: lockedHidden ? null : earned ? b.threshold : b.current,
        blockedBy: lockedHidden ? [] : b.blockedBy,
        earned, earnedOn: earned ? row!.earnedOn : null,
        grantedAt: earned ? row!.createdAt.toISOString() : null,
        saved: Boolean(row), isNew: earned && !row!.viewedAt,
        revoked: row?.revokedAt ? { at: row.revokedAt.toISOString(), reason: row.revokeReason } : null,
        evidence: lockedHidden ? null : evidenceOf(row?.evidence ?? b.evidence),
      };
    });
    return {
      rulesVersion: COLLECTION_V5_RULES_VERSION,
      badges,
      legacyBadges: [],
      // Compatibility hint only, not ownership. Hidden eligibility is not leaked by GET.
      unsaved: evaluated.filter((b) => !b.hidden && b.earned && !byKey.has(b.key)).map((b) => b.key),
    };
  }

  /** 把规则判定已达成、还没发过的徽章落库。幂等；返回这次新发的。 */
  async sync(studentId: string, now = new Date()) {
    assertModuleEnabled('achievements');
    const newlyEarned: string[] = [];
    let historical = false;
    await this.prisma.$transaction(async (tx) => {
      const students = await tx.$queryRaw<Array<{ id: string }>>`SELECT id FROM "User" WHERE id = ${studentId} FOR UPDATE`;
      if (!students.length) throw new NotFoundException({ code: 'student_not_found' });
      const state = await tx.studentAchievementCollection.findUnique({ where: { studentId_rulesVersion: { studentId, rulesVersion: COLLECTION_V5_RULES_VERSION } } });
      historical = !state;
      const facts = await this.loadFacts(studentId, now, tx);
      const current = await tx.studentAchievement.findMany({ where: { studentId, badgeKey: { in: V5_KEYS } }, select: { badgeKey: true, earnedOn: true, revokedAt: true } });
      const existing = new Set(current.map((row) => row.badgeKey));
      for (const badge of evaluateCollectionV5Badges(facts, current)) {
        if (!badge.earned || !badge.earnedOn || existing.has(badge.key)) continue;
        const inserted = await tx.studentAchievement.createMany({ data: [{ studentId, badgeKey: badge.key,
          earnedOn: badge.earnedOn, evidence: badge.evidence as any, rulesVersion: COLLECTION_V5_RULES_VERSION,
          noticeKind: historical ? 'backfill' : 'ceremony', createdAt: now }], skipDuplicates: true });
        if (inserted.count === 1) newlyEarned.push(badge.key);
      }
      if (!state) await tx.studentAchievementCollection.create({ data: { studentId, rulesVersion: COLLECTION_V5_RULES_VERSION, initializedAt: now } });
    }, { timeout: 30_000 });
    return { newlyEarned, historical };
  }

  async notices(studentId: string) {
    assertModuleEnabled('achievements');
    const rows = await this.prisma.studentAchievement.findMany({
      where: { studentId, badgeKey: { in: V5_KEYS }, revokedAt: null }, select: NOTICE_SELECT,
    });
    const pending = rows.filter((row) => !row.notificationClaimedAt && !row.viewedAt);
    const ordered = (items: typeof rows) => V5_KEYS.filter((key) => items.some((row) => row.badgeKey === key));
    return {
      ceremonyKeys: ordered(pending.filter((row) => row.noticeKind === 'ceremony')),
      backfillKeys: ordered(pending.filter((row) => row.noticeKind === 'backfill')),
      newKeys: ordered(rows.filter((row) => !row.viewedAt)),
    };
  }

  private noticeKeys(keys: string[]) {
    if (!Array.isArray(keys) || keys.length > 16 || keys.some((key) => !V5_KEYS.includes(key))) {
      throw new BadRequestException({ code: 'invalid_badge_keys' });
    }
    return V5_KEYS.filter((key) => keys.includes(key));
  }

  async claimNotices(studentId: string, keys: string[], now = new Date()) {
    assertModuleEnabled('achievements');
    const requested = this.noticeKeys(keys);
    const claimedKeys: string[] = [];
    if (!requested.length) return { claimedKeys };
    await this.prisma.$transaction(async (tx) => {
      await tx.$queryRaw`SELECT id FROM "User" WHERE id = ${studentId} FOR UPDATE`;
      for (const key of requested) {
        const result = await tx.studentAchievement.updateMany({
          where: { studentId, badgeKey: key, revokedAt: null, viewedAt: null, notificationClaimedAt: null, noticeKind: { in: ['ceremony', 'backfill'] } },
          data: { notificationClaimedAt: now },
        });
        if (result.count) claimedKeys.push(key);
      }
    });
    return { claimedKeys };
  }

  async viewNotices(studentId: string, keys: string[], now = new Date()) {
    assertModuleEnabled('achievements');
    const requested = this.noticeKeys(keys);
    if (requested.length) await this.prisma.studentAchievement.updateMany({
      where: { studentId, badgeKey: { in: requested }, revokedAt: null, viewedAt: null },
      data: { viewedAt: now },
    });
    return { ok: true };
  }

  /** A dedicated public-to-class DTO, never the student's private award/progress DTO. */
  async classmates(studentId: string) {
    assertModuleEnabled('achievements');
    const enrolled = await this.prisma.classEnrollment.findMany({
      where: { userId: studentId, role: 'student', user: { isActive: true, archivedAt: null }, class: { archivedAt: null } },
      select: { classId: true, class: { select: { id: true, name: true } } },
    });
    const classes: Array<{ id: string; name: string; students: Array<{ id: string; name: string; badges: Array<{
      key: string; assetId: string; title: string; series: string; tier: number | null;
    }> }> }> = [];
    for (const membership of enrolled) {
      // Recheck caller membership in the same query as peers (transfers cannot expose the old class).
      const students = await this.prisma.classEnrollment.findMany({
        where: { classId: membership.classId, role: 'student', user: { isActive: true, archivedAt: null },
          class: { archivedAt: null, enrollments: { some: { userId: studentId, role: 'student', user: { isActive: true, archivedAt: null } } } } },
        select: { user: { select: { id: true, name: true, achievements: {
          where: { badgeKey: { in: V5_KEYS }, revokedAt: null }, select: { badgeKey: true },
        } } } },
        orderBy: [{ user: { name: 'asc' } }, { userId: 'asc' }],
      });
      if (!students.some((row) => row.user.id === studentId)) continue;
      classes.push({ id: membership.class.id, name: membership.class.name, students: students.map(({ user }) => ({
        id: user.id, name: user.name, badges: COLLECTION_V5_BADGES.filter((badge) => user.achievements.some((row) => row.badgeKey === badge.key)).map((badge) => ({
          key: badge.key, assetId: badge.assetId, title: badge.title, series: badge.series, tier: badge.tier,
        })),
      })) });
    }
    return { classes };
  }

  // ─────────────────────────── 学生：班级周目标 ───────────────────────────

  async classGoalsForStudent(studentId: string, now = new Date()) {
    assertModuleEnabled('class_goal');
    const todayKey = sgtKey(now);
    const weekStart = mondayOf(todayKey);
    const enrollments = await this.prisma.classEnrollment.findMany({
      where: { userId: studentId, role: 'student', class: { archivedAt: null } },
      select: { classId: true },
    });
    if (enrollments.length === 0) return { weekStart, weekEnd: addDays(weekStart, 6), goals: [] };
    const goals = await this.prisma.classWeeklyGoal.findMany({
      where: { classId: { in: enrollments.map((e) => e.classId) }, weekStart, disabledAt: null },
      orderBy: { createdAt: 'asc' },
      select: { classId: true, kind: true, class: { select: { name: true } } },
    });
    const out: Array<{ classId: string; className: string; kind: string; progress: ClassGoalProgress }> = [];
    for (const g of goals) {
      out.push({ classId: g.classId, className: g.class.name, kind: g.kind, progress: await this.classProgress(g.classId, weekStart, todayKey) });
    }
    return { weekStart, weekEnd: addDays(weekStart, 6), goals: out };
  }

  /**
   * 一个班本周的汇总。分母 = 每个有效成员本周（到今天为止）实际被分配、没取消的阅读 ——
   * 与首页、成长报告同一个 `assignedReadingFor`，所以新生入班前的、改档前后的都按事实算。
   */
  async classProgress(classId: string, weekStart: string, todayKey: string): Promise<ClassGoalProgress> {
    const weekEnd = addDays(weekStart, 6);
    const upTo = todayKey < weekEnd ? todayKey : weekEnd;
    const rules = demoRules();
    const enrolled = await this.prisma.classEnrollment.findMany({
      where: { classId, role: 'student', user: { archivedAt: null } },
      select: { userId: true, joinedAt: true, user: { select: { englishLevel: true } } },
    });
    const members = enrolled.filter((m) => !isDemoAccount(m.userId, rules));
    // 人太少就不查了 —— 结果只会是「不显示数字」
    if (members.length < CLASS_GOAL_MIN_MEMBERS) {
      return classGoalProgress({ weekStart, todayKey, members: [] });
    }
    const ids = members.map((m) => m.userId);
    const [rows, changes] = await Promise.all([
      this.prisma.paperAssignment.findMany({
        where: {
          classId,
          morningQuizSession: {
            is: {
              date: {
                gte: new Date(`${addDays(weekStart, -CATCH_UP_LOOKBACK_DAYS)}T00:00:00.000Z`),
                lte: new Date(`${upTo}T00:00:00.000Z`),
              },
            },
          },
        },
        select: {
          id: true,
          classId: true,
          paper: { select: { name: true } },
          morningQuizSession: { select: { id: true, date: true, level: true, status: true } },
          submissions: {
            where: { studentId: { in: ids }, status: { not: 'practice' } },
            select: { id: true, studentId: true, status: true, finalSubmittedAt: true, submitSource: true, _count: { select: { scripts: true } } },
          },
        },
      }),
      this.prisma.studentLevelChange.findMany({
        where: { studentId: { in: ids } },
        orderBy: { changedAt: 'asc' },
        select: { studentId: true, fromLevel: true, toLevel: true, changedAt: true, source: true },
      }),
    ]);

    const memberReadings: MemberReadings[] = members.map((m) => {
      const assigned = assignedReadingFor({
        rows: rows
          .filter((row) => row.morningQuizSession)
          .map((row) => {
            const sub = row.submissions.find((s) => s.studentId === m.userId) ?? null;
            return {
              assignmentId: row.id,
              classId: row.classId,
              title: row.paper?.name ?? null,
              session: row.morningQuizSession!,
              submission: sub
                ? { id: sub.id, status: sub.status, finalSubmittedAt: sub.finalSubmittedAt, submitSource: sub.submitSource, scripts: sub._count.scripts }
                : null,
            };
          }),
        joinedAtByClass: new Map([[classId, m.joinedAt]]),
        changes: changes.filter((c) => c.studentId === m.userId),
        currentLevel: m.user.englishLevel ?? null,
        todayKey: upTo,
      });
      return {
        studentId: m.userId,
        readings: assigned.map((a) => ({
          date: a.date,
          completed: a.completed,
          cancelled: a.cancelled,
          finalSubmittedAt: a.submission?.finalSubmittedAt ?? null,
        })),
      };
    });
    return classGoalProgress({ weekStart, todayKey, members: memberReadings });
  }

  // ─────────────────────────── 老师 ───────────────────────────

  private async assertClass(actor: TeacherActor, classId: string) {
    assertStaff(actor);
    if (!(await canActOnClass(this.prisma, actor, classId))) {
      throw new ForbiddenException({ code: 'not_your_class' });
    }
  }

  /** 两道闸都在读学生数据之前：老师能管这个班，且学生确实是这个班的学生。 */
  private async assertStudentOfClass(actor: TeacherActor, classId: string, studentId: string) {
    await this.assertClass(actor, classId);
    const e = await this.prisma.classEnrollment.findUnique({
      where: { classId_userId: { classId, userId: studentId } },
      select: { role: true },
    });
    if (!e || e.role !== 'student') throw new NotFoundException({ code: 'student_not_in_class' });
  }

  async weeklyGoalForTeacher(actor: TeacherActor, classId: string, now = new Date()) {
    assertModuleEnabled('class_goal');
    await this.assertClass(actor, classId);
    const todayKey = sgtKey(now);
    const weekStart = mondayOf(todayKey);
    const row = await this.prisma.classWeeklyGoal.findUnique({
      where: { classId_weekStart: { classId, weekStart } },
      select: { kind: true, disabledAt: true },
    });
    return {
      classId,
      weekStart,
      weekEnd: addDays(weekStart, 6),
      kind: row?.kind ?? 'assigned_reading',
      enabled: row != null && row.disabledAt == null,
      minMembers: CLASS_GOAL_MIN_MEMBERS,
      progress: await this.classProgress(classId, weekStart, todayKey),
    };
  }

  /** 开 / 关本周目标。唯一键 `(classId, weekStart)`，两位老师同时点也只有一行。 */
  async setWeeklyGoal(actor: TeacherActor, classId: string, enabled: boolean, now = new Date()) {
    assertModuleEnabled('class_goal');
    await this.assertClass(actor, classId);
    const weekStart = mondayOf(sgtKey(now));
    if (enabled) {
      await this.prisma.classWeeklyGoal.createMany({
        data: [{ classId, weekStart, kind: 'assigned_reading', enabledById: actor.id }],
        skipDuplicates: true,
      });
      await this.prisma.classWeeklyGoal.updateMany({
        where: { classId, weekStart, disabledAt: { not: null } },
        data: { disabledAt: null, enabledById: actor.id },
      });
    } else {
      await this.prisma.classWeeklyGoal.updateMany({
        where: { classId, weekStart, disabledAt: null },
        data: { disabledAt: now },
      });
    }
    await this.audit.log({
      actorId: actor.id,
      actorRole: actor.role,
      action: enabled ? 'class_goal.enable' : 'class_goal.disable',
      entityType: 'Class',
      entityId: classId,
      ip: actor.ip ?? null,
      metadata: { weekStart, kind: 'assigned_reading' },
    });
    return this.weeklyGoalForTeacher(actor, classId, now);
  }

  async studentBadgesForTeacher(actor: TeacherActor, classId: string, studentId: string, now = new Date()) {
    assertModuleEnabled('achievements');
    await this.assertStudentOfClass(actor, classId, studentId);
    return this.forStudent(studentId, now);
  }

  private badgeKeyOf(raw: string): string {
    if (!BADGE_KEYS.has(raw)) throw new BadRequestException({ code: 'unknown_badge' });
    return raw;
  }

  /** 以「数据有误」撤销一枚已发的徽章。必须写理由；写审计；可恢复。 */
  async revokeBadge(actor: TeacherActor, classId: string, studentId: string, rawKey: string, reason: string, now = new Date()) {
    assertModuleEnabled('achievements');
    const badgeKey = this.badgeKeyOf(rawKey);
    await this.assertStudentOfClass(actor, classId, studentId);
    await this.prisma.$transaction(async (tx) => {
      await tx.$queryRaw`SELECT id FROM "User" WHERE id = ${studentId} FOR UPDATE`;
      const res = await tx.studentAchievement.updateMany({
        where: { studentId, badgeKey, revokedAt: null },
        data: { revokedAt: now, revokedById: actor.id, revokeReason: reason },
      });
      if (res.count === 0) {
        const row = await tx.studentAchievement.findUnique({
          where: { studentId_badgeKey: { studentId, badgeKey } },
          select: { revokedAt: true },
        });
        if (!row) throw new NotFoundException({ code: 'badge_not_earned' });
        throw new ConflictException({ code: 'badge_already_revoked' });
      }
      await this.audit.log({
        actorId: actor.id,
        actorRole: actor.role,
        action: 'achievement.revoke',
        entityType: 'User',
        entityId: studentId,
        ip: actor.ip ?? null,
        metadata: { classId, badgeKey, reason },
      }, tx);
    });
    return this.forStudent(studentId, now);
  }

  async restoreBadge(actor: TeacherActor, classId: string, studentId: string, rawKey: string, note: string | null, now = new Date()) {
    assertModuleEnabled('achievements');
    const badgeKey = this.badgeKeyOf(rawKey);
    await this.assertStudentOfClass(actor, classId, studentId);
    await this.prisma.$transaction(async (tx) => {
      await tx.$queryRaw`SELECT id FROM "User" WHERE id = ${studentId} FOR UPDATE`;
      const res = await tx.studentAchievement.updateMany({
        where: { studentId, badgeKey, revokedAt: { not: null } },
        data: { revokedAt: null, revokedById: null, revokeReason: null },
      });
      if (res.count === 0) throw new ConflictException({ code: 'badge_not_revoked' });
      await this.audit.log({
        actorId: actor.id,
        actorRole: actor.role,
        action: 'achievement.restore',
        entityType: 'User',
        entityId: studentId,
        ip: actor.ip ?? null,
        metadata: { classId, badgeKey, note },
      }, tx);
    });
    return this.forStudent(studentId, now);
  }
}
