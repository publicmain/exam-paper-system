import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import {
  AttendanceSource,
  AttendanceStatus,
  MorningQuizStatus,
} from '@prisma/client';
import { PrismaService } from '../common/prisma.service';
import { autoGradeScripts } from '../student/student.service';
import { WechatNotifyService } from '../wechat-notify/wechat-notify.service';
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
    // F3 + F4 — WeChat notifier for `score_ready` (per-submission, after
    // each AI-grade tx commits) and `mass_absence` (per-session, when
    // >=90% of a >=5-student roster failed to scan in — projector likely
    // died, alert teacher). Both fires are best-effort: try/catch so a
    // notify outage cannot break the lock cron.
    private readonly notify: WechatNotifyService,
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
    // R15-Audit#2 Finding #3 — exclude sessions whose class has been
    // archived. Otherwise the lock cron would still fire mass_absence
    // notifications for a class admins already retired.
    const expired = await this.prisma.morningQuizSession.findMany({
      where: {
        status: { in: [MorningQuizStatus.active, MorningQuizStatus.scheduled] },
        quizEnd: { lte: now },
        class: { archivedAt: null },
      },
      include: {
        // F4: include class.name + paper.name so lockOne can populate the
        // mass_absence + score_ready payloads without an extra round-trip.
        paperAssignment: {
          select: {
            id: true,
            classId: true,
            class: { select: { name: true } },
            paper: { select: { name: true } },
          },
        },
      },
    });
    for (const session of expired) {
      await this.lockOne(
        session.id,
        session.paperAssignmentId,
        session.paperAssignment.classId,
        {
          dateIso: session.date.toISOString().slice(0, 10),
          className: session.paperAssignment.class?.name ?? '',
          paperName: session.paperAssignment.paper?.name ?? '',
        },
      );
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
  private async lockOne(
    sessionId: string,
    paperAssignmentId: string,
    classId: string,
    // F3 + F4 — display strings + the date used for the dashboard
    // deep-link in mass_absence. Optional so the legacy test harness
    // (which calls lockOne directly) keeps compiling; in production
    // lockPastSessions always supplies them.
    meta?: { dateIso: string; className: string; paperName: string },
  ) {
    // ── Phase 1: fast lock-and-flip tx ────────────────────────────────
    // Idempotent; subsequent ticks see status=locked and skip.
    // We pre-flip in_progress submissions to `submitted` with autoScore=0
    // so the session is in a consistent state immediately. The AI-grade
    // pass below upgrades autoScore in-place per submission.
    const { inProgressIds, totalRosterCount, claimedCount } = await this.prisma.$transaction(async (tx) => {
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
      //
      // R15-Audit#3 — a class with 3 levels (ielts_authentic, simplified,
      // olevel) has 3 sessions per day. A student picks ONE level when
      // scanning, so 1 student × 3 sessions = 1 scanned row + 2 absent
      // rows from this cron, EVERY DAY. The 47-student class above
      // produced 141 attendance rows/day and erroneously triggered
      // `mass_absence` on the 2 sibling levels (claimedCount=0 in
      // those sessions even though the student attended).
      //
      // Fix: only this-class-day's FIRST-to-lock session inserts absent
      // rows for the no-show roster. Sibling sessions that lock later
      // observe an already-locked sibling and skip the insert.
      // Dashboard dedupes by studentId so the single absent row covers
      // the whole day's no-show status correctly.
      const sessionRow = await tx.morningQuizSession.findUnique({
        where: { id: sessionId },
        select: { date: true },
      });
      let siblingAlreadyLocked = false;
      if (sessionRow) {
        const otherLocked = await tx.morningQuizSession.count({
          where: {
            classId,
            date: sessionRow.date,
            id: { not: sessionId },
            status: MorningQuizStatus.locked,
          },
        });
        siblingAlreadyLocked = otherLocked > 0;
      }
      const enrollments = await tx.classEnrollment.findMany({
        where: { classId, role: 'student', user: { isActive: true } },
        select: { userId: true },
      });
      if (enrollments.length > 0 && !siblingAlreadyLocked) {
        // Also: skip absent insert for students who already have a
        // non-absent attendance row TODAY in ANY of this class's
        // sessions (covers the "I scanned into level X first, then
        // the OTHER level's cron locked second" ordering).
        const sessionsToday = sessionRow
          ? await tx.morningQuizSession.findMany({
              where: { classId, date: sessionRow.date },
              select: { id: true },
            })
          : [{ id: sessionId }];
        const scannedToday = await tx.attendance.findMany({
          where: {
            sessionId: { in: sessionsToday.map((s) => s.id) },
            status: { not: AttendanceStatus.absent },
          },
          select: { studentId: true },
          distinct: ['studentId'],
        });
        const scannedSet = new Set(scannedToday.map((a) => a.studentId));
        const noShowEnrollments = enrollments.filter(
          (e) => !scannedSet.has(e.userId),
        );
        if (noShowEnrollments.length > 0) {
          await tx.attendance.createMany({
            data: noShowEnrollments.map((e) => ({
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
      }

      // F4 — measure the roster's claim ratio so the outer fn can decide
      // whether to fire `mass_absence`. R15-Audit#3: a multi-level
      // class has 3 sessions per day; a student scanning into ONE
      // level leaves the OTHER 2 sessions with claimedCount=0 →
      // mass_absence fired erroneously on the sibling levels every
      // morning. Count claims ACROSS the whole class-day, not just
      // this session. The "everyone absent" alarm should fire only
      // when NOBODY scanned anywhere today for this class.
      const claimedCount = sessionRow
        ? await tx.attendance.count({
            where: {
              session: { classId, date: sessionRow.date },
              status: { not: AttendanceStatus.absent },
            },
            // distinct by studentId would be more accurate but Prisma
            // doesn't support it in count(); the duplicate-scan
            // protection in scanQr keeps this approximately equal to
            // unique students.
          })
        : await tx.attendance.count({
            where: { sessionId, status: { not: AttendanceStatus.absent } },
          });

      return {
        inProgressIds: claimed.map((s) => s.id),
        totalRosterCount: enrollments.length,
        claimedCount,
      };
    });

    // F4 — projector-died guard. Fire BEFORE the (slow) AI-grade loop so
    // the teacher sees the WeChat ping immediately. Threshold: roster of
    // at least 5 and at least 90% of them no-shows. Try/catch isolates
    // notify failure from the cron's hot path.
    const absentCount = totalRosterCount - claimedCount;
    const absentRatio = totalRosterCount > 0 ? absentCount / totalRosterCount : 0;
    if (totalRosterCount >= 5 && absentRatio >= 0.9) {
      try {
        await this.notify.fire('mass_absence', {
          sessionId,
          classId,
          className: meta?.className ?? '',
          absentCount,
          rosterCount: totalRosterCount,
          paperName: meta?.paperName ?? '',
          dashboardUrl: meta?.dateIso
            ? `/morning-quiz/classes/${classId}/date/${meta.dateIso}/dashboard`
            : `/morning-quiz/sessions/${sessionId}/dashboard`,
        });
      } catch (e: any) {
        this.logger.warn(
          `mass_absence notify failed for session ${sessionId}: ${e?.message ?? e}`,
        );
      }
    }

    // ── Phase 2: AI-grade EVERY submission in the session, NO outer tx ─
    // R15-followup-20 — this is now the single batched AI-grading sweep.
    // The morning-quiz submit path (finalSubmit deferAi=true) scores MCQ
    // inline but parks short answers as pending, so the cohort that
    // submitted on time is sitting here un-AI-graded alongside the
    // stragglers this cron just force-submitted. Grade them all: one
    // batched Claude call per submission, drained sequentially — ~30
    // calls over a few minutes, comfortably under any rate limit.
    //
    // Re-grading an on-time submitter re-runs MCQ (idempotent, same
    // result) and fills in the short-answer scores. Load scripts outside
    // any tx; per submission: batched AI call (slow, no tx) → small
    // write tx. One failure logs + continues — never poison the cohort.
    const allSubs = await this.prisma.studentSubmission.findMany({
      where: { assignmentId: paperAssignmentId, status: { not: 'practice' } },
      select: { id: true },
    });
    let graded = 0;
    let gradeFailed = 0;
    for (const { id: subId } of allSubs) {
      try {
        const sub = await this.prisma.studentSubmission.findUnique({
          where: { id: subId },
          include: {
            // F3 — pull student name so the score_ready payload can build
            // the `/my-history?name=...` deeplink without an extra query.
            student: { select: { name: true } },
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
            // R15-followup-20 — also write totalScore. finalSubmit's
            // deferAi path left it at the MCQ-only partial; this sweep
            // produces the final number the marker/parent dashboards
            // read directly. manualScore is null pre-marking → equals
            // autoScore (mirrors finalSubmit / regradeSession).
            data: { autoScore, totalScore: autoScore },
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

        // F3 — score_ready fires AFTER the per-submission tx commits so a
        // notification can't beat the DB write. Dedup: a follow-up
        // teacher-regrade would re-enter this loop on the same submission
        // and we don't want the student to receive a second WeChat ping.
        // Lookup is per-submissionId on the NotificationLog payload JSON.
        try {
          const prismaAny = this.prisma as any;
          const already = await prismaAny.notificationLog.findFirst({
            where: {
              event: 'score_ready',
              payload: { path: ['submissionId'], equals: sub.id },
            },
            select: { id: true },
          });
          if (!already) {
            const studentName = sub.student?.name ?? '';
            await this.notify.fire('score_ready', {
              submissionId: sub.id,
              studentId: sub.studentId,
              studentName,
              paperName: meta?.paperName ?? '',
              autoScore,
              maxScore: sub.maxScore,
              submittedAt: (sub.submittedAt ?? new Date()).toISOString(),
              resultUrl: `/my-history?name=${encodeURIComponent(studentName)}`,
            });
          }
        } catch (e: any) {
          this.logger.warn(
            `score_ready notify failed for submission ${sub.id}: ${e?.message ?? e}`,
          );
        }
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
