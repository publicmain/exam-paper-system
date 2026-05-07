import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import {
  AttendanceSource,
  AttendanceStatus,
  MorningQuizStatus,
} from '@prisma/client';
import { PrismaService } from '../common/prisma.service';

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

  constructor(private readonly prisma: PrismaService) {}

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

  private async lockOne(sessionId: string, paperAssignmentId: string, classId: string) {
    // Flip status — idempotent; subsequent ticks see status=locked and skip.
    await this.prisma.morningQuizSession.update({
      where: { id: sessionId },
      data: { status: MorningQuizStatus.locked },
    });

    // Force-submit any in-progress submissions for this assignment.
    const inProgress = await this.prisma.studentSubmission.findMany({
      where: {
        assignmentId: paperAssignmentId,
        status: 'in_progress',
      },
      include: {
        scripts: {
          include: {
            paperQuestion: {
              include: {
                question: { select: { questionType: true, options: true } },
              },
            },
          },
        },
      },
    });

    for (const sub of inProgress) {
      let autoScore = 0;
      const scriptUpdates: Array<{ id: string; autoCorrect: boolean; awardedMarks: number }> = [];
      for (const script of sub.scripts) {
        const q = script.paperQuestion.question;
        if (q.questionType !== 'mcq' && q.questionType !== 'short_answer') continue;
        if (q.questionType === 'mcq') {
          const opts = (script.paperQuestion.snapshotOptions ?? q.options ?? []) as Array<{
            key: string;
            correct: boolean;
          }>;
          const correctOpt = Array.isArray(opts) ? opts.find((o) => o.correct) : null;
          const isCorrect = correctOpt?.key === script.selectedOption;
          const awarded = isCorrect ? script.paperQuestion.marks : 0;
          autoScore += awarded;
          scriptUpdates.push({ id: script.id, autoCorrect: isCorrect, awardedMarks: awarded });
        }
        // short_answer auto-grading deferred (Phase 2) — leave awardedMarks null
        // for the marker workflow.
      }

      const claim = await this.prisma.studentSubmission.updateMany({
        where: { id: sub.id, status: 'in_progress' },
        data: {
          submittedAt: new Date(),
          status: 'submitted',
          autoScore,
        },
      });
      if (claim.count === 1 && scriptUpdates.length > 0) {
        for (const u of scriptUpdates) {
          await this.prisma.answerScript.update({
            where: { id: u.id },
            data: { autoCorrect: u.autoCorrect, awardedMarks: u.awardedMarks },
          });
        }
      }
    }

    // Mark roster no-shows as absent.
    const enrollments = await this.prisma.classEnrollment.findMany({
      where: { classId, role: 'student' },
      select: { userId: true },
    });
    for (const e of enrollments) {
      const exists = await this.prisma.attendance.findUnique({
        where: { sessionId_studentId: { sessionId, studentId: e.userId } },
      });
      if (!exists) {
        await this.prisma.attendance.create({
          data: {
            sessionId,
            studentId: e.userId,
            status: AttendanceStatus.absent,
            scanTime: null,
            source: AttendanceSource.qr_scan,
            sourceIp: null,
          },
        });
      }
    }

    this.logger.log(
      `locked session ${sessionId}: force-submitted ${inProgress.length} in-progress, marked roster no-shows absent`,
    );
  }
}
