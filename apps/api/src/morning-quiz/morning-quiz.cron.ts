import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import {
  AttendanceSource,
  AttendanceStatus,
  MorningQuizStatus,
} from '@prisma/client';
import { PrismaService } from '../common/prisma.service';
import { autoGradeScripts } from '../student/student.service';
import { ShortAnswerEvaluatorService } from './short-answer-evaluator.service';

/**
 * Morning quiz lifecycle cron. Runs every minute and acts on three transitions:
 *
 *   T-30s before attendanceStart → status `scheduled` flips to `active` so
 *     /qr/current starts emitting a token and the gate at scan time sees
 *     the right status.
 *
 *   T == quizEnd → status `active` flips to `locked`. Any submission still in
 *     `in_progress` gets force-submitted with the auto-grade pass (mirrors
 *     student.service.finalSubmit). Enrolled students with no Attendance row
 *     get an `absent` row inserted so dashboards see a complete roster.
 *
 * The server-side time check inside attendance.service.scanQr is the hard
 * wall regardless — this cron is a convenience that prevents stale UI states.
 */
@Injectable()
export class MorningQuizCron {
  private readonly logger = new Logger('MorningQuizCron');

  constructor(
    private readonly prisma: PrismaService,
    // R10 — used so the 9:00 lockPastSessions auto-submit also runs the
    // Claude fallback for unsubmitted short_answer items, matching the
    // manual finalSubmit code path.
    private readonly evaluator: ShortAnswerEvaluatorService,
  ) {}

  @Cron(CronExpression.EVERY_MINUTE)
  async tick() {
    const now = new Date();
    await this.activateDueSessions(now);
    await this.lockPastSessions(now);
  }

  private async activateDueSessions(now: Date) {
    // Activate when we're within 30s of attendanceStart so the QR display
    // page can render a valid token a few seconds before students arrive.
    const upper = new Date(now.getTime() + 30_000);
    const due = await this.prisma.morningQuizSession.findMany({
      where: {
        status: MorningQuizStatus.scheduled,
        attendanceStart: { lte: upper },
        // Don't pre-activate sessions that are already past their quiz end —
        // those should fall through to the lock pass instead.
        quizEnd: { gt: now },
      },
      select: { id: true },
    });
    if (due.length === 0) return;
    await this.prisma.morningQuizSession.updateMany({
      where: { id: { in: due.map((s) => s.id) } },
      data: { status: MorningQuizStatus.active },
    });
    this.logger.log(`activated ${due.length} session(s)`);
  }

  private async lockPastSessions(now: Date) {
    const expired = await this.prisma.morningQuizSession.findMany({
      where: {
        status: { in: [MorningQuizStatus.active, MorningQuizStatus.scheduled] },
        quizEnd: { lte: now },
      },
      include: {
        paperAssignment: { select: { id: true, classId: true } },
      },
    });
    for (const session of expired) {
      await this.lockOne(session.id, session.paperAssignmentId, session.paperAssignment.classId);
    }
  }

  /**
   * Lock + force-submit + mark no-shows. Wrapped in a single transaction so
   * a partial failure (e.g. the answerScript update step throwing on row N)
   * cannot leave a session flagged `locked` while half its submissions are
   * still `in_progress`. Either every state transition lands or none do.
   *
   * Auto-grading uses the shared `autoGradeScripts` helper so this branch
   * and the on-time `student.service.finalSubmit` path apply byte-identical
   * grading rules — no chance of "force-submit at 9:00 ≠ self-submit at 8:59".
   */
  private async lockOne(sessionId: string, paperAssignmentId: string, classId: string) {
    const result = await this.prisma.$transaction(async (tx) => {
      // Flip status — idempotent; subsequent ticks see status=locked and skip.
      await tx.morningQuizSession.update({
        where: { id: sessionId },
        data: { status: MorningQuizStatus.locked },
      });

      // Pull paper.totalMarksActual once for the maxScore back-fill on the
      // updateMany below. Same fix as student.finalSubmit — pre-R10 scanQr
      // wrote maxScore=0 and lockPastSessions never corrected it.
      const paperRow = await tx.paperAssignment.findUnique({
        where: { id: paperAssignmentId },
        select: { paper: { select: { totalMarksActual: true } } },
      });
      const correctMax = paperRow?.paper?.totalMarksActual ?? 0;

      const inProgress = await tx.studentSubmission.findMany({
        where: { assignmentId: paperAssignmentId, status: 'in_progress' },
        include: {
          scripts: {
            include: {
              paperQuestion: {
                // R10: include answerContent so autoGradeScripts can grade
                // short_answer items against the canonical text answer.
                include: { question: { select: { questionType: true, options: true, answerContent: true, content: true } } },
              },
            },
          },
        },
      });

      for (const sub of inProgress) {
        const { autoScore, scriptUpdates } = await autoGradeScripts(sub.scripts, this.evaluator);
        const claim = await tx.studentSubmission.updateMany({
          where: { id: sub.id, status: 'in_progress' },
          data: { submittedAt: new Date(), status: 'submitted', autoScore, maxScore: correctMax },
        });
        if (claim.count === 1 && scriptUpdates.length > 0) {
          for (const u of scriptUpdates) {
            await tx.answerScript.update({
              where: { id: u.id },
              data: {
                autoCorrect: u.autoCorrect,
                awardedMarks: u.awardedMarks,
                ...(u.aiReason ? { markerComment: `[ai-grade] ${u.aiReason}` } : {}),
              },
            });
          }
        }
      }

      // Mark roster no-shows as absent. createMany + skipDuplicates leans on
      // the (sessionId, studentId) unique constraint to ignore students who
      // already scanned, instead of N round-trips.
      const enrollments = await tx.classEnrollment.findMany({
        where: { classId, role: 'student' },
        select: { userId: true },
      });
      if (enrollments.length > 0) {
        await tx.attendance.createMany({
          data: enrollments.map((e) => ({
            sessionId,
            studentId: e.userId,
            status: AttendanceStatus.absent,
            scanTime: null,
            source: AttendanceSource.qr_scan,
            sourceIp: null,
          })),
          skipDuplicates: true,
        });
      }

      return inProgress.length;
    });

    this.logger.log(
      `locked session ${sessionId}: force-submitted ${result} in-progress, marked roster no-shows absent`,
    );
  }
}
