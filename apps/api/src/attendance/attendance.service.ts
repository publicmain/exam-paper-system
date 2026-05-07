import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  GoneException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
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
  student: { id: string; name: string };
  /** Short-lived JWT scoped to this session — frontend stores it as
   *  auth_token so /morning-quiz/* calls authenticate via the existing
   *  AuthGuard with role='student'. Expires at session.quizEnd. */
  scanToken: string;
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
    private readonly jwt: JwtService,
  ) {}

  /**
   * Public roster lookup for the scan page. Caller has already passed
   * IpAllowlistGuard (gate 1: school WiFi). We re-verify the QR token to
   * limit exposure of the student-name list to the brief active session
   * window, then return enrolled students sorted by name.
   */
  async fetchRoster(qrToken: string) {
    const decoded = await this.qr.verify(qrToken);
    const session = await this.prisma.morningQuizSession.findUnique({
      where: { id: decoded.sessionId },
      select: { id: true, classId: true, status: true, class: { select: { name: true } } },
    });
    if (!session) throw new NotFoundException({ code: 'session_not_found' });
    const enrollments = await this.prisma.classEnrollment.findMany({
      where: { classId: session.classId, role: 'student' },
      include: { user: { select: { id: true, name: true } } },
    });
    const students = enrollments
      .map((e) => ({ id: e.user.id, name: e.user.name }))
      .sort((a, b) => a.name.localeCompare(b.name, 'zh-Hans-CN'));
    return {
      sessionId: session.id,
      sessionStatus: session.status,
      className: session.class.name,
      students,
    };
  }

  /**
   * Public five-gate scan. Caller has passed IpAllowlistGuard (gate 1) at
   * the controller. Remaining gates run here:
   *   2. QR token verify (HMAC + freshness)
   *   3. Session is `status=active`
   *   4. studentId belongs to a real student enrolled in the session's class
   *   5. Current time is within the attendance window (on_time | late | absent)
   *
   * On success: upserts Attendance + StudentSubmission + ShuffleMap and
   * mints a short-lived "scan token" JWT carrying role='student' so the
   * frontend can drop it into auth_token and let the existing AuthGuard
   * authenticate the take/answer/submit calls.
   */
  async scanQr(
    qrToken: string,
    studentName: string,
    sourceIp: string | null,
    deviceUuid: string | null,
    userAgent: string | null,
  ): Promise<ScanResult> {
    // Gate 2 — QR validity
    const decoded = await this.qr.verify(qrToken);

    // Gate 3 — session active
    const session = await this.prisma.morningQuizSession.findUnique({
      where: { id: decoded.sessionId },
      include: { paperAssignment: { select: { id: true, paperId: true } } },
    });
    if (!session) throw new NotFoundException({ code: 'session_not_found' });
    if (session.status !== MorningQuizStatus.active) {
      throw new GoneException({ code: 'session_not_active', status: session.status });
    }

    // Gate 4 — resolve student by typed name within the session's class.
    // Roster lookup + enrollment check are folded into a single query: we
    // pull every ClassEnrollment for this session's class where the linked
    // user is a student matching the trimmed input. Exact match — no
    // partial / case fuzz so the student must type their full real name.
    const trimmedName = studentName.trim();
    const matches = await this.prisma.classEnrollment.findMany({
      where: {
        classId: session.classId,
        role: 'student',
        user: { name: trimmedName, role: 'student' },
      },
      include: { user: { select: { id: true, email: true, name: true, role: true } } },
    });
    if (matches.length === 0) {
      throw new NotFoundException({ code: 'student_not_found', typed: trimmedName });
    }
    if (matches.length > 1) {
      // Two students in the same class share an exact name — rare but
      // possible. Bail out and ask admin to disambiguate via the manual-
      // correction path; resolving it client-side would expose the dupe.
      throw new ForbiddenException({ code: 'multiple_students_with_same_name' });
    }
    const student = matches[0].user;
    const studentId = student.id;

    // Gate 5 — time window: on_time | late | absent
    const now = new Date();
    let attendanceStatus: AttendanceStatus;
    if (now < session.attendanceStart) {
      throw new GoneException({ code: 'attendance_window_not_open' });
    } else if (now <= session.attendanceEnd) {
      attendanceStatus = AttendanceStatus.on_time;
    } else if (now <= session.lateCutoff) {
      attendanceStatus = AttendanceStatus.late;
    } else {
      const existing = await this.prisma.attendance.findUnique({
        where: { sessionId_studentId: { sessionId: session.id, studentId } },
      });
      if (!existing) {
        await this.prisma.attendance.create({
          data: {
            sessionId: session.id,
            studentId,
            status: AttendanceStatus.absent,
            scanTime: now,
            sourceIp,
            deviceUuid,
            userAgent,
            source: AttendanceSource.qr_scan,
          },
        });
      }
      throw new GoneException({ code: 'attendance_window_closed' });
    }

    // Anti-fraud: same physical device must not sign in as multiple
    // students in the same session. We compare the localStorage UUID the
    // frontend sent. If the same uuid was already used by a *different*
    // student in this session, reject hard. The legitimate edge case
    // (student A lent their phone to student B because B's phone died)
    // is handled by the existing manual_correction flow.
    if (deviceUuid) {
      const conflict = await this.prisma.attendance.findFirst({
        where: {
          sessionId: session.id,
          deviceUuid,
          studentId: { not: studentId },
        },
        include: { student: { select: { name: true } } },
      });
      if (conflict) {
        throw new ConflictException({
          code: 'device_already_used',
          conflictStudent: conflict.student.name,
        });
      }
    }

    const attendance = await this.prisma.attendance.upsert({
      where: { sessionId_studentId: { sessionId: session.id, studentId } },
      create: {
        sessionId: session.id,
        studentId,
        status: attendanceStatus,
        scanTime: now,
        sourceIp,
        deviceUuid,
        userAgent,
        source: AttendanceSource.qr_scan,
      },
      update: {
        sourceIp,
        scanTime: now,
        // Re-scans by the same student update fingerprint fields too
        // so the latest device info is what auditors see.
        deviceUuid: deviceUuid ?? undefined,
        userAgent: userAgent ?? undefined,
      },
    });

    const paperId = session.paperAssignment.paperId;
    const submission = await this.prisma.studentSubmission.upsert({
      where: {
        assignmentId_studentId: {
          assignmentId: session.paperAssignmentId,
          studentId,
        },
      },
      create: {
        assignmentId: session.paperAssignmentId,
        studentId,
        maxScore: 0,
      },
      update: {},
    });

    if (attendance.submissionId !== submission.id) {
      await this.prisma.attendance.update({
        where: { id: attendance.id },
        data: { submissionId: submission.id },
      });
    }

    await this.shuffle.getOrCreate(studentId, paperId);

    // Mint scan token — same shape as the login JWT (so existing AuthGuard
    // accepts it without changes), but expiry tied to the session's quizEnd
    // so the token is useless after 9:00.
    const expSeconds = Math.max(60, Math.floor((session.quizEnd.getTime() - Date.now()) / 1000));
    const scanToken = await this.jwt.signAsync(
      {
        id: student.id,
        email: student.email,
        role: 'student',
        name: student.name,
      },
      { expiresIn: expSeconds },
    );

    await this.audit.log({
      actorId: studentId,
      actorRole: 'student',
      action: 'attendance.scan',
      entityType: 'MorningQuizSession',
      entityId: session.id,
      ip: sourceIp,
      metadata: { attendanceStatus, paperId, source: 'roster_pick' },
    });

    const remainingMs = session.quizEnd.getTime() - now.getTime();
    return {
      attendance: { id: attendance.id, status: attendanceStatus, scanTime: now },
      student: { id: student.id, name: student.name },
      scanToken,
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
