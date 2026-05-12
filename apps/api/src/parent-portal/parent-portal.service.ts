import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import * as crypto from 'crypto';
import { AuditService } from '../audit/audit.service';
import { PrismaService } from '../common/prisma.service';

interface ActorCtx {
  id: string;
  role: string;
  ip: string | null;
}

/**
 * F14 — Parent portal backend.
 *
 * Three surfaces:
 *   - Admin CRUD on ParentLink rows (create / list / revoke)
 *   - Public read-only portal payload keyed by a 32-char token
 *
 * The portal is the ONLY off-campus path in the system — IpAllowlistGuard
 * is intentionally bypassed for the portal endpoint. Compensating controls:
 *   - random 32-char token (192 bits of entropy)
 *   - server-side revoke flag (admin can kill any link)
 *   - rate-limit on the public endpoint
 *   - no write surface — parents can only read
 *
 * ParentLink is a new model added by Wave-2 Schema team — accessed via
 * `(this.prisma as any)` so this file typechecks even if the generated
 * Prisma client hasn't caught up on this branch.
 */
@Injectable()
export class ParentPortalService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  /**
   * Mint a fresh ParentLink for a student. Returns the raw token in
   * the response body — admin must capture it now because the table
   * stores the value as-is (no hash) and we don't re-display it.
   * (Future hardening: store a SHA-256 of the token and compare; the
   * UI is print-then-discard, so we accept the trade for v1.)
   */
  async createLink(
    body: { studentId: string; parentLabel?: string },
    baseUrl: string,
    actor: ActorCtx,
  ) {
    const student = await this.prisma.user.findUnique({
      where: { id: body.studentId },
    });
    if (!student) throw new NotFoundException({ code: 'student_not_found' });
    if (student.role !== 'student') {
      throw new BadRequestException({ code: 'target_not_a_student' });
    }
    // 24 bytes → 32 base64url chars. Cryptographically random.
    const token = crypto.randomBytes(24).toString('base64url');
    const prismaAny: any = this.prisma;
    const created = await prismaAny.parentLink.create({
      data: {
        studentId: body.studentId,
        token,
        parentLabel: body.parentLabel ?? null,
        createdById: actor.id,
      },
    });
    await this.audit.log({
      actorId: actor.id,
      actorRole: actor.role,
      action: 'parent_link.create',
      entityType: 'ParentLink',
      entityId: created.id,
      ip: actor.ip,
      metadata: { studentId: body.studentId, parentLabel: body.parentLabel ?? null },
    });
    const portalPath = `/parent/${token}`;
    return {
      id: created.id,
      token,
      url: portalPath,
      // qrPayload is the fully-qualified URL so the print sheet's QR
      // code resolves regardless of where the parent scans from. The
      // controller passes in baseUrl from the incoming request's host.
      qrPayload: baseUrl.replace(/\/+$/, '') + portalPath,
    };
  }

  /**
   * Admin list of ParentLinks. Filterable by studentId and whether to
   * surface revoked rows. Includes student name for the dashboard.
   */
  async listLinks(filter: { studentId?: string; includeRevoked?: boolean }) {
    const where: any = {};
    if (filter.studentId) where.studentId = filter.studentId;
    if (!filter.includeRevoked) where.revokedAt = null;
    const prismaAny: any = this.prisma;
    const rows = await prismaAny.parentLink.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      include: {
        student: { select: { id: true, name: true } },
      },
    });
    return rows;
  }

  /** Soft-revoke. Idempotent — revoking a revoked link is a no-op
   *  with the existing revokedAt preserved. */
  async revokeLink(id: string, actor: ActorCtx) {
    const prismaAny: any = this.prisma;
    const link = await prismaAny.parentLink.findUnique({ where: { id } });
    if (!link) throw new NotFoundException({ code: 'parent_link_not_found' });
    if (!link.revokedAt) {
      await prismaAny.parentLink.update({
        where: { id },
        data: { revokedAt: new Date(), revokedById: actor.id },
      });
    }
    await this.audit.log({
      actorId: actor.id,
      actorRole: actor.role,
      action: 'parent_link.revoke',
      entityType: 'ParentLink',
      entityId: id,
      ip: actor.ip,
      metadata: { studentId: link.studentId },
    });
    return { ok: true, id, revokedAt: link.revokedAt ?? new Date() };
  }

  /**
   * Public portal payload. Guard has already validated the token and
   * attached the link row. We just have to assemble the read-only
   * student summary: classes, recent attendance (last 30 days),
   * recent submissions (last 20 with scores), simple summary stats.
   *
   * NO teacher names, NO mark-scheme answer keys, NO IPs, NO emails
   * other than the student's own. Lock down the payload deliberately.
   */
  async portalPayload(parentLink: any) {
    const studentId: string = parentLink.studentId;
    const student = await (this.prisma.user as any).findUnique({
      where: { id: studentId },
      select: { id: true, name: true, archivedAt: true },
    });
    if (!student) throw new NotFoundException({ code: 'student_not_found' });

    const enrollments = await this.prisma.classEnrollment.findMany({
      where: { userId: studentId, role: 'student' },
      include: {
        class: { select: { id: true, name: true, classCode: true } },
      },
    });
    const classes = enrollments.map((e) => e.class);

    const since = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    const attendance = await this.prisma.attendance.findMany({
      where: {
        studentId,
        session: { date: { gte: since } },
      },
      include: {
        session: { select: { id: true, date: true, level: true, classId: true } },
      },
      orderBy: { scanTime: 'desc' },
      take: 60,
    });
    const recentAttendance = attendance.map((a) => ({
      id: a.id,
      status: a.status,
      scanTime: a.scanTime,
      sessionDate: a.session.date,
      level: a.session.level,
      classId: a.session.classId,
    }));

    const submissions = await this.prisma.studentSubmission.findMany({
      where: { studentId, status: { in: ['submitted', 'marked'] as any } },
      include: {
        assignment: {
          select: {
            paper: { select: { id: true, name: true } },
            class: { select: { id: true, name: true } },
          },
        },
      },
      orderBy: { submittedAt: 'desc' },
      take: 20,
    });
    const recentSubmissions = submissions.map((s) => ({
      id: s.id,
      submittedAt: s.submittedAt,
      autoScore: s.autoScore,
      manualScore: s.manualScore,
      totalScore: s.totalScore,
      maxScore: s.maxScore,
      paperId: s.assignment?.paper?.id ?? null,
      paperName: s.assignment?.paper?.name ?? null,
      className: s.assignment?.class?.name ?? null,
    }));

    const onTimeCount = attendance.filter((a) => a.status === 'on_time').length;
    const consideredCount = attendance.filter(
      (a) => a.status === 'on_time' || a.status === 'late',
    ).length;
    const onTimeRate = consideredCount
      ? Math.round((onTimeCount / consideredCount) * 100) / 100
      : null;
    const scored = submissions.filter(
      (s) => s.autoScore != null && s.maxScore && s.maxScore > 0,
    );
    const avgScore = scored.length
      ? Math.round(
          (scored.reduce((acc, s) => acc + (s.autoScore ?? 0) / s.maxScore, 0) /
            scored.length) *
            1000,
        ) / 1000
      : null;

    return {
      student,
      classes,
      recentAttendance,
      recentSubmissions,
      summary: { onTimeRate, avgScore },
    };
  }
}
