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
   * Lock + force-submit + mark no-shows.
   *
   * Structure (BUG 7 fix — mirrors `morning-quiz.service.regradeSession`):
   *   1. ONE small fast tx: flip session→locked, flip in_progress→submitted
   *      with autoScore=0 placeholder, insert roster `absent` rows.
   *   2. Load each just-flipped submission's scripts OUTSIDE any tx.
   *   3. Per-submission: run `autoGradeScripts` (slow Claude call,
   *      no tx held), then a tiny per-submission tx to write the
   *      autoScore + per-script awardedMarks. One failure logs + continues.
   *
   * Why — `autoGradeScripts` issues Claude API calls (~2-3s per short_answer
   * item). 30 students × 10 SA items easily exceeds Prisma's 5s interactive-tx
   * timeout, rolling back the entire lock and leaving sessions stuck `active`
   * past their quizEnd. Splitting the AI loop out of the tx eliminates that
   * failure mode.
   *
   * Auto-grading still uses the shared `autoGradeScripts` helper so this
   * branch and the on-time `student.service.finalSubmit` path apply
   * byte-identical grading rules.
   */
  private async lockOne(sessionId: string, paperAssignmentId: string, classId: string) {
    // ── Phase 1: fast lock-and-flip tx ────────────────────────────────
    // Idempotent; subsequent ticks see status=locked and skip.
    // We pre-flip in_progress submissions to `submitted` with autoScore=0
    // so the session is in a consistent state immediately. The AI-grade
    // pass below upgrades autoScore in-place per submission.
    const { inProgressIds } = await this.prisma.$transaction(async (tx) => {
      await tx.morningQuizSession.update({
        where: { id: sessionId },
        data: { status: MorningQuizStatus.locked },
      });

      // Pull paper.totalMarksActual once for the maxScore back-fill below.
      // Same fix as student.finalSubmit — pre-R10 scanQr wrote maxScore=0
      // and lockPastSessions never corrected it.
      const paperRow = await tx.paperAssignment.findUnique({
        where: { id: paperAssignmentId },
        select: { paper: { select: { totalMarksActual: true } } },
      });
      const correctMax = paperRow?.paper?.totalMarksActual ?? 0;

      // Claim every still-in-progress submission atomically. We capture
      // their ids before flipping so the AI loop below operates only on
      // rows this cron actually transitioned (avoids racing with a
      // student that finalSubmits at the very same tick).
      const claimed = await tx.studentSubmission.findMany({
        where: { assignmentId: paperAssignmentId, status: 'in_progress' },
        select: { id: true },
      });
      if (claimed.length > 0) {
        await tx.studentSubmission.updateMany({
          where: { id: { in: claimed.map((s) => s.id) }, status: 'in_progress' },
          data: {
            submittedAt: new Date(),
            status: 'submitted',
            autoScore: 0,
            maxScore: correctMax,
          },
        });
      }

      // Mark roster no-shows as absent. createMany + skipDuplicates leans on
      // the (sessionId, studentId) unique constraint to ignore students who
      // already scanned, instead of N round-trips.
      // BUG 9 fix — exclude isActive=false (withdrawn) students, matching
      // attendance.service:71 so a deactivated account doesn't get a stale
      // `absent` row inserted on every morning-cron lock pass.
      const enrollments = await tx.classEnrollment.findMany({
        where: { classId, role: 'student', user: { isActive: true } },
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

      return { inProgressIds: claimed.map((s) => s.id) };
    });

    // ── Phase 2: AI-grade each claimed submission, NO outer tx ────────
    // Load scripts outside any tx (reads don't need one). Then per
    // submission: AI call (slow, no tx) → small write tx. If one
    // submission's AI call or write fails, log and continue — don't
    // poison the rest of the cohort.
    let graded = 0;
    let gradeFailed = 0;
    for (const subId of inProgressIds) {
      try {
        const sub = await this.prisma.studentSubmission.findUnique({
          where: { id: subId },
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
        if (!sub) continue;

        const { autoScore, scriptUpdates } = await autoGradeScripts(sub.scripts, this.evaluator);

        // Tiny atomic write — well under 5s even with N=20 scripts.
        await this.prisma.$transaction(async (tx) => {
          await tx.studentSubmission.update({
            where: { id: sub.id },
            data: { autoScore },
          });
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
        });
        graded++;
      } catch (e: any) {
        gradeFailed++;
        this.logger.error(
          `auto-grade failed for submission ${subId} in session ${sessionId}: ${e?.message ?? e}`,
        );
        // Continue — submission stays as 'submitted' with autoScore=0
        // placeholder. An admin can regradeSession() to retry.
      }
    }

    this.logger.log(
      `locked session ${sessionId}: force-submitted ${inProgressIds.length} in-progress` +
        ` (auto-graded ${graded}, grade-failed ${gradeFailed}), marked roster no-shows absent`,
    );
  }
}
