import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { AuditService } from '../audit/audit.service';
import { PrismaService } from '../common/prisma.service';

interface ActorCtx { id: string; role: string; ip?: string | null }

@Injectable()
export class ClassesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  async list(opts: { archived?: boolean } = {}) {
    // F6 — when archived=true the caller wants the soft-delete bin (the
    // ArchivedClasses page); when false (default) the caller wants the
    // active roster (the Classes page). archivedAt is a Round-14 column.
    const where = opts.archived ? { archivedAt: { not: null } } : { archivedAt: null };
    return this.prisma.class.findMany({
      where,
      orderBy: { name: 'asc' },
      // R10 multi-level: englishLevel was 1:1; now englishLevels is N:1 (a
      // class can register multiple bands at once). The schedule UI needs
      // the full list to render one row per (class, level) pair.
      include: {
        _count: { select: { enrollments: true, assignments: true } },
        englishLevels: { select: { level: true }, orderBy: { level: 'asc' } },
      },
    });
  }

  async get(id: string, opts: { includeArchived?: boolean } = {}) {
    // F12 — hide enrollments whose User.archivedAt is non-null by
    // default. Teacher-side callers (admin dashboard) can opt in to see
    // the archived ones via opts.includeArchived. The Class row itself
    // is never auto-hidden here; F6 soft-delete is admin-cleanup's
    // problem, not ours.
    const includeArchived = !!opts.includeArchived;
    const enrollmentUserFilter: any = includeArchived ? {} : { archivedAt: null };
    const cls = await this.prisma.class.findUnique({
      where: { id },
      // R10-Bug1 + R10 multi-level: detail modal renders the full set
      // of registered bands so admin can add / remove a band per class.
      include: {
        englishLevels: { select: { id: true, level: true }, orderBy: { level: 'asc' } },
        enrollments: {
          where: { user: enrollmentUserFilter },
          include: { user: { select: { id: true, name: true, email: true, role: true, archivedAt: true } as any } },
        } as any,
        assignments: {
          include: { paper: { select: { id: true, name: true, subjectId: true } } },
          orderBy: { assignedAt: 'desc' },
        },
      },
    });
    if (!cls) throw new NotFoundException('class not found');
    return cls;
  }

  async create(data: { name: string; classCode: string }) {
    if (!/^[A-Z0-9_-]{2,40}$/i.test(data.classCode)) {
      throw new BadRequestException('classCode must be 2-40 alphanumeric / dash / underscore');
    }
    return this.prisma.class.create({ data });
  }

  /** F5 — partial update. Today only weeklyFocus is mutable here; other
   *  attributes still flow through the create + roster endpoints. */
  async update(classId: string, data: { weeklyFocus?: string | null }) {
    const cls = await this.prisma.class.findUnique({ where: { id: classId } });
    if (!cls) throw new NotFoundException('class not found');
    return this.prisma.class.update({
      where: { id: classId },
      data: {
        ...(data.weeklyFocus !== undefined ? { weeklyFocus: data.weeklyFocus } : {}),
      },
    });
  }

  async addEnrollment(classId: string, opts: { userId: string; role?: string }) {
    const role = opts.role ?? 'student';
    if (!['student', 'class_teacher', 'subject_teacher'].includes(role)) {
      throw new BadRequestException(`invalid enrollment role: ${role}`);
    }
    const user = await this.prisma.user.findUnique({ where: { id: opts.userId } });
    if (!user) throw new NotFoundException('user not found');
    return this.prisma.classEnrollment.create({
      data: { classId, userId: opts.userId, role },
    });
  }

  async removeEnrollment(classId: string, userId: string) {
    return this.prisma.classEnrollment.deleteMany({ where: { classId, userId } });
  }

  /** Bulk-create student users by email + name list, then enroll all in
   *  one class. Used by the admin to onboard a roster from CSV without
   *  per-user clicks. Idempotent: already-enrolled users are skipped. */
  async bulkRoster(
    classId: string,
    students: Array<{ email: string; name: string; password?: string }>,
    actor: ActorCtx,
  ) {
    const cls = await this.prisma.class.findUnique({ where: { id: classId } });
    if (!cls) throw new NotFoundException('class not found');

    const bcrypt = await import('bcryptjs');
    const created: string[] = [];
    const enrolled: string[] = [];
    const skipped: string[] = [];
    for (const s of students) {
      let user = await this.prisma.user.findUnique({ where: { email: s.email } });
      if (!user) {
        const passwordHash = await bcrypt.hash(s.password ?? 'student123', 10);
        user = await this.prisma.user.create({
          data: { email: s.email, name: s.name, role: 'student' as any, passwordHash },
        });
        created.push(user.id);
      }
      const existing = await this.prisma.classEnrollment.findFirst({
        where: { classId, userId: user.id },
      });
      if (existing) {
        skipped.push(user.id);
        continue;
      }
      await this.prisma.classEnrollment.create({
        data: { classId, userId: user.id, role: 'student' },
      });
      enrolled.push(user.id);
    }
    void actor;
    return { createdUsers: created.length, enrolled: enrolled.length, alreadyIn: skipped.length };
  }

  /** Permanent delete. All FK references to Class (enrollments, paper
   *  assignments, morning-quiz sessions, english-level row) cascade per
   *  the baseline migration. Use with care: also wipes the class's
   *  attendance/submission history. */
  async remove(classId: string) {
    const cls = await this.prisma.class.findUnique({ where: { id: classId } });
    if (!cls) throw new NotFoundException('class not found');
    await this.prisma.class.delete({ where: { id: classId } });
    return { deleted: classId, name: cls.name };
  }

  /** List classes the current user belongs to (any role). */
  async myClasses(userId: string) {
    return this.prisma.class.findMany({
      where: { enrollments: { some: { userId } } },
      include: {
        enrollments: { where: { userId }, select: { role: true } },
        _count: { select: { enrollments: true } },
      },
      orderBy: { name: 'asc' },
    });
  }

  /**
   * F12 — atomic student transfer between classes. Verifies the user is
   * currently enrolled in `fromClassId` as a student and NOT already in
   * `toClassId`, then in one transaction:
   *   1. deletes the source ClassEnrollment,
   *   2. creates the destination ClassEnrollment (role='student'),
   *   3. inserts a ClassTransferLog row,
   *   4. audit-logs the action.
   * On any partial failure the tx rolls back and the audit row doesn't
   * land — matches AuditService's tx-aware contract.
   *
   * NOTE: ClassTransferLog is a new model added by Wave-2 Schema team
   * — accessed via `(this.prisma as any)` so this file typechecks even
   * if the generated Prisma client hasn't caught up yet on this branch.
   */
  async transfer(
    body: { userId: string; fromClassId: string; toClassId: string; reason?: string },
    actor: ActorCtx,
  ) {
    if (body.fromClassId === body.toClassId) {
      throw new BadRequestException({ code: 'same_class_transfer' });
    }
    const [fromCls, toCls, user] = await Promise.all([
      this.prisma.class.findUnique({ where: { id: body.fromClassId } }),
      this.prisma.class.findUnique({ where: { id: body.toClassId } }),
      this.prisma.user.findUnique({ where: { id: body.userId } }),
    ]);
    if (!fromCls) throw new NotFoundException({ code: 'from_class_not_found' });
    if (!toCls) throw new NotFoundException({ code: 'to_class_not_found' });
    if (!user) throw new NotFoundException({ code: 'user_not_found' });

    const fromEnrollment = await this.prisma.classEnrollment.findUnique({
      where: {
        classId_userId: { classId: body.fromClassId, userId: body.userId },
      },
    });
    if (!fromEnrollment || fromEnrollment.role !== 'student') {
      throw new BadRequestException({ code: 'not_enrolled_in_from_class' });
    }
    const toExisting = await this.prisma.classEnrollment.findUnique({
      where: { classId_userId: { classId: body.toClassId, userId: body.userId } },
    });
    if (toExisting) {
      throw new ConflictException({ code: 'already_in_to_class' });
    }

    const prismaAny: any = this.prisma;
    return this.prisma.$transaction(async (tx) => {
      const txAny: any = tx;
      await tx.classEnrollment.delete({
        where: {
          classId_userId: { classId: body.fromClassId, userId: body.userId },
        },
      });
      await tx.classEnrollment.create({
        data: {
          classId: body.toClassId,
          userId: body.userId,
          role: 'student',
        },
      });
      // ClassTransferLog: new in Wave-2 Schema. Best-effort — if the
      // model isn't on the client yet, swallow the missing-model error
      // so the transfer itself still commits. This is intentional:
      // Schema team will land the model + a forward backfill; until
      // then the audit row below carries the same record.
      try {
        await txAny.classTransferLog.create({
          data: {
            userId: body.userId,
            fromClassId: body.fromClassId,
            toClassId: body.toClassId,
            reason: body.reason ?? null,
            actorId: actor.id,
          },
        });
      } catch (e: any) {
        if (!String(e?.message ?? '').match(/classTransferLog|Unknown arg|does not exist/i)) {
          throw e;
        }
      }
      await this.audit.log(
        {
          actorId: actor.id,
          actorRole: actor.role,
          action: 'class.transfer',
          entityType: 'User',
          entityId: body.userId,
          ip: actor.ip ?? null,
          metadata: {
            fromClassId: body.fromClassId,
            toClassId: body.toClassId,
            fromClassName: fromCls.name,
            toClassName: toCls.name,
            reason: body.reason ?? null,
          },
        },
        txAny,
      );
      // Surface fresh state so caller can confirm the move landed.
      return {
        ok: true,
        userId: body.userId,
        fromClassId: body.fromClassId,
        toClassId: body.toClassId,
      };
      // Suppress unused-var warning on the outer reference (kept for
      // possible future use of the broader client inside the tx).
      void prismaAny;
    });
  }

  /**
   * F12 — soft-archive a User. Sets `archivedAt = now()`; reversible
   * via `unarchiveUser`. Archived users:
   *   - cannot be picked in the morning-quiz scan page (their User row
   *     is still isActive but the roster query excludes archivedAt!=null)
   *   - are hidden from class.get() rosters by default
   *   - keep their attendance / submission history for audit
   */
  async archiveUser(userId: string, reason: string, actor: ActorCtx) {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) throw new NotFoundException({ code: 'user_not_found' });
    const userAny: any = user;
    if (userAny.archivedAt) {
      throw new ConflictException({ code: 'already_archived' });
    }
    const updated = await (this.prisma.user as any).update({
      where: { id: userId },
      data: { archivedAt: new Date() },
    });
    await this.audit.log({
      actorId: actor.id,
      actorRole: actor.role,
      action: 'user.archive',
      entityType: 'User',
      entityId: userId,
      ip: actor.ip ?? null,
      metadata: { reason, previousName: user.name, previousEmail: user.email },
    });
    return updated;
  }

  /** F12 — admin-only un-archive. Pairs with archiveUser. */
  async unarchiveUser(userId: string, actor: ActorCtx) {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) throw new NotFoundException({ code: 'user_not_found' });
    const userAny: any = user;
    if (!userAny.archivedAt) {
      throw new ConflictException({ code: 'not_archived' });
    }
    const updated = await (this.prisma.user as any).update({
      where: { id: userId },
      data: { archivedAt: null },
    });
    await this.audit.log({
      actorId: actor.id,
      actorRole: actor.role,
      action: 'user.unarchive',
      entityType: 'User',
      entityId: userId,
      ip: actor.ip ?? null,
      metadata: { previouslyArchivedAt: userAny.archivedAt },
    });
    return updated;
  }
}
