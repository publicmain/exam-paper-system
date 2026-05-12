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
import { canActOnClass } from '../common/roles';
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
      select: { id: true, classId: true, date: true, level: true, status: true, class: { select: { name: true } } },
    });
    if (!session) throw new NotFoundException({ code: 'session_not_found' });
    // Gate: only roster-leak the names while the session is *active*. School
    // WiFi alone + a stale QR is not enough — without this, anyone in the
    // building during off-hours could harvest the class roster by replaying
    // yesterday's QR.
    if (session.status !== MorningQuizStatus.active) {
      throw new GoneException({ code: 'session_not_active', status: session.status });
    }
    const enrollments = await this.prisma.classEnrollment.findMany({
      // isActive=false users (deactivated by admin) must not appear in the
      // roster — otherwise an old account could be picked and signed in as.
      where: { classId: session.classId, role: 'student', user: { isActive: true } },
      include: { user: { select: { id: true, name: true } } },
    });
    const students = enrollments
      .map((e) => ({ id: e.user.id, name: e.user.name }))
      .sort((a, b) => a.name.localeCompare(b.name, 'zh-Hans-CN'));
    // R10 multi-level — when a class is running multiple difficulty bands
    // on the same day, every (classId, date, level) tuple has its own
    // session. The scan page uses this to render a level-picker before
    // the name input, so the operator only has to project ONE QR and
    // students self-select their band. Always includes the QR's own
    // session in the list so single-band classes still see one entry.
    const siblings = await this.prisma.morningQuizSession.findMany({
      where: {
        classId: session.classId,
        date: session.date,
        status: MorningQuizStatus.active,
      },
      select: { id: true, level: true },
      orderBy: { level: 'asc' },
    });
    return {
      sessionId: session.id,
      sessionStatus: session.status,
      className: session.class.name,
      level: session.level,
      siblingSessions: siblings.map((s) => ({ sessionId: s.id, level: s.level })),
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
    deviceUuid: string,
    userAgent: string | null,
    sessionIdOverride: string | null = null,
  ): Promise<ScanResult> {
    // Gate 2 — QR validity
    const decoded = await this.qr.verify(qrToken);

    // R10 multi-level — when the operator projects ONE QR per (class,day)
    // and the student picks their difficulty band on the scan page, the
    // chosen sessionId comes in as `sessionIdOverride`. The QR is still
    // the proof of "right place, right time" (HMAC + freshness via
    // qr.verify), but the sessionId we actually attach the attendance
    // row to may be a sibling of the QR's encoded session. We validate
    // the override is in the SAME (classId, date) family so a student
    // can't drop their attendance into another class.
    let resolvedSessionId = decoded.sessionId;
    if (sessionIdOverride && sessionIdOverride !== decoded.sessionId) {
      const qrSession = await this.prisma.morningQuizSession.findUnique({
        where: { id: decoded.sessionId },
        select: { classId: true, date: true },
      });
      if (!qrSession) throw new NotFoundException({ code: 'session_not_found' });
      const overrideSession = await this.prisma.morningQuizSession.findUnique({
        where: { id: sessionIdOverride },
        select: { classId: true, date: true, status: true },
      });
      if (!overrideSession) {
        throw new NotFoundException({ code: 'override_session_not_found' });
      }
      const sameClass = overrideSession.classId === qrSession.classId;
      const sameDay =
        overrideSession.date.toISOString().slice(0, 10) ===
        qrSession.date.toISOString().slice(0, 10);
      if (!sameClass || !sameDay) {
        throw new ForbiddenException({ code: 'override_class_or_date_mismatch' });
      }
      resolvedSessionId = sessionIdOverride;
    }

    // Gate 3 — session active
    const session = await this.prisma.morningQuizSession.findUnique({
      where: { id: resolvedSessionId },
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
        // isActive=false users are admin-deactivated; they must not be able
        // to sign in or be impersonated even if their name still matches.
        user: { name: trimmedName, role: 'student', isActive: true },
      },
      include: { user: { select: { id: true, email: true, name: true, role: true } } },
    });
    if (matches.length === 0) {
      // R10 demo bypass — when MORNING_QUIZ_DEMO=true, auto-create the
      // student + enroll into the session's class instead of 404. Only
      // intended for in-house testing where the operator wants to scan
      // with arbitrary names without pre-seeding the roster. Production
      // bootstrap (main.ts) hard-fails when this is set with NODE_ENV=
      // production unless an explicit ALLOW_DEMO env is also set.
      if (process.env.MORNING_QUIZ_DEMO === 'true') {
        const bcrypt = await import('bcryptjs');
        const slug = trimmedName.replace(/[^a-zA-Z0-9一-龥]/g, '').slice(0, 16) || 'demo';
        const email = `demo-${slug}-${Date.now().toString(36)}@demo.local`;
        const passwordHash = await bcrypt.hash('demo-no-password', 4);
        const user = await this.prisma.user.create({
          data: { email, name: trimmedName, role: 'student', passwordHash, isActive: true },
        });
        await this.prisma.classEnrollment.create({
          data: { classId: session.classId, userId: user.id, role: 'student' },
        });
        // Re-issue the match so downstream code is unchanged.
        matches.push({
          id: 'demo',
          classId: session.classId,
          userId: user.id,
          role: 'student' as any,
          createdAt: new Date(),
          updatedAt: new Date(),
          user: { id: user.id, email: user.email, name: user.name, role: user.role },
        } as any);
      } else {
        throw new NotFoundException({ code: 'student_not_found', typed: trimmedName });
      }
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
    // students in the same session. deviceUuid is required by the controller
    // schema so we always have a value here. If the same uuid was already
    // used by a *different* student in this session, reject hard. The
    // legitimate edge case (student A lent their phone to student B because
    // B's phone died) is handled by the existing manual_correction flow.
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
        // Promote absent → on_time/late if a pre-existing roster row exists
        // (e.g. lockPastSessions created an absent row before the session
        // was re-activated). For a normal re-scan within the same session,
        // status was already on_time/late and stays that way.
        status: attendanceStatus,
        sourceIp,
        scanTime: now,
        // Re-scans by the same student update fingerprint fields too
        // so the latest device info is what auditors see.
        deviceUuid: deviceUuid ?? undefined,
        userAgent: userAgent ?? undefined,
      },
    });

    const paperId = session.paperAssignment.paperId;
    // R10-fix: pull paper.totalMarksActual so maxScore is correct from the
    // start. Was hard-coded to 0, then never updated by finalSubmit, so the
    // result page rendered "3 / 1" (front-end ||1 fallback over a 0 max).
    const paperForMax = await this.prisma.paper.findUnique({
      where: { id: paperId },
      select: { totalMarksActual: true },
    });
    // R14 — upsert via findFirst+create/update since @@unique was dropped
    // for practice-mode coexistence. Non-practice subs are uniquely keyed
    // by (assignmentId, studentId, status!='practice') by service invariant.
    let submission = await this.prisma.studentSubmission.findFirst({
      where: {
        assignmentId: session.paperAssignmentId,
        studentId,
        status: { not: 'practice' },
      },
    });
    if (!submission) {
      submission = await this.prisma.studentSubmission.create({
        data: {
          assignmentId: session.paperAssignmentId,
          studentId,
          maxScore: paperForMax?.totalMarksActual ?? 0,
        },
      });
    }

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

    // Round 2 IDOR fix — a regular teacher must teach the target session's
    // class. Without this a teacher of any class could mutate any other
    // class's attendance by guessing sessionIds. Admin / head_teacher
    // are school-wide and always pass.
    if (!(await canActOnClass(this.prisma, actor, session.classId))) {
      throw new ForbiddenException({ code: 'not_your_class' });
    }

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
      // R10-fix: pull paper.totalMarksActual so the result page denominator
      // is right when this manually-corrected student eventually submits.
      const paperForMax = await this.prisma.paper.findUnique({
        where: { id: (await this.prisma.paperAssignment.findUnique({
          where: { id: session.paperAssignmentId }, select: { paperId: true },
        }))?.paperId ?? '' },
        select: { totalMarksActual: true },
      });
      // R14 — see attendance.service.ts:scanQr for the @@unique-drop note
      let submission = await this.prisma.studentSubmission.findFirst({
        where: {
          assignmentId: session.paperAssignmentId,
          studentId: body.studentId,
          status: { not: 'practice' },
        },
      });
      if (!submission) {
        submission = await this.prisma.studentSubmission.create({
          data: {
            assignmentId: session.paperAssignmentId,
            studentId: body.studentId,
            maxScore: paperForMax?.totalMarksActual ?? 0,
          },
        });
      }
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

  /**
   * F7 — bulk variant of `correct`. Iterates the same single-row logic
   * sequentially (not Promise.all) so a partial failure leaves a
   * deterministic prefix of successful rows and a per-row `errors[]`
   * for the failed ones. Returns `{ corrected: number, errors: [...] }`.
   * Each row reuses `correct()` (including its own audit log + class
   * ownership check) — duplicating that logic would risk drift.
   */
  async correctBulk(
    body: { sessionId: string; studentIds: string[]; status: AttendanceStatus; note: string },
    actor: ActorCtx,
  ) {
    let corrected = 0;
    const errors: Array<{ studentId: string; reason: string }> = [];
    for (const studentId of body.studentIds) {
      try {
        await this.correct(
          {
            sessionId: body.sessionId,
            studentId,
            status: body.status,
            note: body.note,
          },
          actor,
        );
        corrected += 1;
      } catch (e: any) {
        const reason =
          typeof e?.response === 'object' && e?.response?.code
            ? e.response.code
            : e?.message ?? 'unknown_error';
        errors.push({ studentId, reason });
      }
    }
    return { corrected, errors };
  }

  async historyForClass(actor: ActorCtx, classId: string, from?: Date, to?: Date) {
    // Round 2 IDOR fix — gate by class ownership. Without this a teacher
    // of class A could enumerate every attendance row of class B.
    if (!(await canActOnClass(this.prisma, actor, classId))) {
      throw new ForbiddenException({ code: 'not_your_class' });
    }
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
