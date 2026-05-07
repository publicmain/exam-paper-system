import {
  BadRequestException,
  ForbiddenException,
  GoneException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { AttendanceSource, AttendanceStatus, MorningQuizStatus } from '@prisma/client';
import { AuditService } from '../audit/audit.service';
import { PrismaService } from '../common/prisma.service';
import { QrService } from '../qr/qr.service';
import { ShuffleService } from '../shuffle/shuffle.service';

export interface ActorCtx {
  id: string;
  role: string;
  ip: string | null;
}

export interface ScanResult {
  attendance: {
    id: string;
    status: AttendanceStatus;
    scanTime: Date | null;
  };
  quizUrl: string;
  remainingMinutes: number;
}

@Injectable()
export class AttendanceService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly qr: QrService,
    private readonly shuffle: ShuffleService,
    private readonly audit: AuditService,
  ) {}

  /**
   * Five-gate scan. Caller MUST have already passed IpAllowlistGuard (gate 1).
   * Remaining gates run inside this method:
   *   2. QR token verify (HMAC + freshness)
   *   3. Session is today and `status=active`
   *   4. Student is enrolled in the session's class
   *   5. Current time is within attendance window (on_time | late | absent)
   * On success: upserts Attendance + StudentSubmission + ShuffleMap, returns
   * the URL to the quiz page.
   */
  async scanQr(token: string, student: ActorCtx): Promise<ScanResult> {
    if (student.role !== 'student') {
      throw new ForbiddenException({ code: 'student_role_required' });
    }

    // Gate 2 — QR validity
    const decoded = await this.qr.verify(token);

    // Gate 3 — session is today + active
    const session = await this.prisma.morningQuizSession.findUnique({
      where: { id: decoded.sessionId },
      include: { paperAssignment: { select: { id: true, paperId: true } } },
    });
    if (!session) throw new NotFoundException({ code: 'session_not_found' });
    if (session.status !== MorningQuizStatus.active) {
      throw new GoneException({ code: 'session_not_active', status: session.status });
    }

    // Gate 4 — student enrolled in this class
    const enrollment = await this.prisma.classEnrollment.findUnique({
      where: { classId_userId: { classId: session.classId, userId: student.id } },
    });
    if (!enrollment || enrollment.role !== 'student') {
      throw new ForbiddenException({ code: 'not_enrolled', classId: session.classId });
    }

    // Gate 5 — time window: on_time | late | absent
    const now = new Date();
    let attendanceStatus: AttendanceStatus;
    if (now < session.attendanceStart) {
      // QR was generated but window not yet open. Cron should have prevented
      // this by leaving status=scheduled, but be defensive.
      throw new GoneException({ code: 'attendance_window_not_open' });
    } else if (now <= session.attendanceEnd) {
      attendanceStatus = AttendanceStatus.on_time;
    } else if (now <= session.lateCutoff) {
      attendanceStatus = AttendanceStatus.late;
    } else {
      // Past lateCutoff — record absent so future dashboard sees a row, but
      // no submission is opened.
      const existing = await this.prisma.attendance.findUnique({
        where: { sessionId_studentId: { sessionId: session.id, studentId: student.id } },
      });
      if (!existing) {
        await this.prisma.attendance.create({
          data: {
            sessionId: session.id,
            studentId: student.id,
            status: AttendanceStatus.absent,
            scanTime: now,
            sourceIp: student.ip,
            source: AttendanceSource.qr_scan,
          },
        });
      }
      throw new GoneException({ code: 'attendance_window_closed' });
    }

    // All five gates passed — upsert attendance idempotently.
    const attendance = await this.prisma.attendance.upsert({
      where: { sessionId_studentId: { sessionId: session.id, studentId: student.id } },
      create: {
        sessionId: session.id,
        studentId: student.id,
        status: attendanceStatus,
        scanTime: now,
        sourceIp: student.ip,
        source: AttendanceSource.qr_scan,
      },
      update: {
        // Re-scans don't change a recorded on_time to late, but they do update
        // sourceIp + scanTime (most recent wins) for forensics.
        sourceIp: student.ip,
        scanTime: now,
      },
    });

    // Open / resume the StudentSubmission for this paper.
    const paperId = session.paperAssignment.paperId;
    const submission = await this.prisma.studentSubmission.upsert({
      where: {
        assignmentId_studentId: {
          assignmentId: session.paperAssignmentId,
          studentId: student.id,
        },
      },
      create: {
        assignmentId: session.paperAssignmentId,
        studentId: student.id,
        maxScore: 0, // backfilled by morning-quiz controller after first fetch
      },
      update: {},
    });

    // Link Attendance ↔ Submission so dashboards can join.
    if (attendance.submissionId !== submission.id) {
      await this.prisma.attendance.update({
        where: { id: attendance.id },
        data: { submissionId: submission.id },
      });
    }

    // Pre-warm the shuffle map so student sees stable order on first load.
    await this.shuffle.getOrCreate(student.id, paperId);

    // Audit
    await this.audit.log({
      actorId: student.id,
      actorRole: student.role,
      action: 'attendance.scan',
      entityType: 'MorningQuizSession',
      entityId: session.id,
      ip: student.ip,
      metadata: { attendanceStatus, paperId },
    });

    const remainingMs = session.quizEnd.getTime() - now.getTime();
    return {
      attendance: { id: attendance.id, status: attendanceStatus, scanTime: now },
      quizUrl: `/morning-quiz/${session.id}`,
      remainingMinutes: Math.max(0, Math.floor(remainingMs / 60_000)),
    };
  }

  /**
   * Admin manual override. Allows class teachers to mark a student
   * present/late/absent outside the QR flow (forgot phone, dead battery,
   * arrived after late cutoff, etc.). Audit-logged with reason.
   */
  async correct(
    body: { sessionId: string; studentId: string; status: AttendanceStatus; note?: string },
    actor: ActorCtx,
  ) {
    if (!['admin', 'head_teacher'].includes(actor.role) && actor.role !== 'teacher') {
      throw new ForbiddenException({ code: 'admin_or_teacher_required' });
    }
    const session = await this.prisma.morningQuizSession.findUnique({
      where: { id: body.sessionId },
      include: { paperAssignment: { select: { id: true } } },
    });
    if (!session) throw new NotFoundException({ code: 'session_not_found' });

    const enrollment = await this.prisma.classEnrollment.findUnique({
      where: { classId_userId: { classId: session.classId, userId: body.studentId } },
    });
    if (!enrollment || enrollment.role !== 'student') {
      throw new BadRequestException({ code: 'student_not_in_session_class' });
    }

    const before = await this.prisma.attendance.findUnique({
      where: { sessionId_studentId: { sessionId: session.id, studentId: body.studentId } },
    });

    const after = await this.prisma.attendance.upsert({
      where: { sessionId_studentId: { sessionId: session.id, studentId: body.studentId } },
      create: {
        sessionId: session.id,
        studentId: body.studentId,
        status: body.status,
        scanTime: null,
        source: AttendanceSource.manual_correction,
        correctedById: actor.id,
        correctedNote: body.note ?? null,
        sourceIp: actor.ip,
      },
      update: {
        status: body.status,
        source: AttendanceSource.manual_correction,
        correctedById: actor.id,
        correctedNote: body.note ?? null,
      },
    });

    // If the override marks the student present (on_time | late) and they have
    // no submission yet, open one so they can still take the quiz.
    if (after.status !== AttendanceStatus.absent && !after.submissionId) {
      const submission = await this.prisma.studentSubmission.upsert({
        where: {
          assignmentId_studentId: {
            assignmentId: session.paperAssignmentId,
            studentId: body.studentId,
          },
        },
        create: {
          assignmentId: session.paperAssignmentId,
          studentId: body.studentId,
          maxScore: 0,
        },
        update: {},
      });
      await this.prisma.attendance.update({
        where: { id: after.id },
        data: { submissionId: submission.id },
      });
    }

    await this.audit.log({
      actorId: actor.id,
      actorRole: actor.role,
      action: 'attendance.correct',
      entityType: 'Attendance',
      entityId: after.id,
      ip: actor.ip,
      diff: { before, after },
      metadata: { sessionId: session.id, studentId: body.studentId, note: body.note ?? null },
    });

    return after;
  }

  async historyForClass(classId: string, from?: Date, to?: Date) {
    return this.prisma.attendance.findMany({
      where: {
        session: {
          classId,
          ...(from || to
            ? {
                date: {
                  ...(from ? { gte: from } : {}),
                  ...(to ? { lte: to } : {}),
                },
              }
            : {}),
        },
      },
      include: {
        student: { select: { id: true, name: true, email: true } },
        session: { select: { id: true, date: true, status: true } },
      },
      orderBy: [{ session: { date: 'desc' } }, { status: 'asc' }],
    });
  }
}
