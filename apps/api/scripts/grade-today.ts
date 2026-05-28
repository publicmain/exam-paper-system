import { PrismaClient } from '@prisma/client';
import { autoGradeScripts, applyRetractionCredits } from '../src/student/student.service';
import { ShortAnswerEvaluatorService } from '../src/morning-quiz/short-answer-evaluator.service';

/**
 * Manual bulk-regrade for today's morning-quiz sessions. Run on Railway:
 *
 *   railway run -- npx ts-node apps/api/scripts/grade-today.ts
 *
 * The 09:00 lockPastSessions cron already auto-grades every submission;
 * this script is for the cases where it didn't (cron skipped, Claude API
 * was down at lock time, ANTHROPIC_API_KEY wasn't set, a single submission
 * errored). Idempotent — re-running gives the same result.
 *
 * Mirrors the exact grading code path of morning-quiz.service.regradeSession
 * (slow Claude calls outside the tx, tiny per-submission write tx, retraction
 * sweep, totalScore=autoScore+manualScore) so the output is byte-identical
 * with the cron's grading.
 */

const prisma = new PrismaClient();
const evaluator = new ShortAnswerEvaluatorService();

(async () => {
  const tzOff = Number(process.env.MORNING_QUIZ_TZ_OFFSET_MIN ?? 8 * 60);
  const now = new Date();
  const localNow = new Date(now.getTime() + tzOff * 60_000);
  const todayDate = new Date(
    Date.UTC(localNow.getUTCFullYear(), localNow.getUTCMonth(), localNow.getUTCDate()),
  );
  const tomorrowDate = new Date(todayDate.getTime() + 86_400_000);
  const todayIso = todayDate.toISOString().slice(0, 10);
  console.log(`Server UTC: ${now.toISOString()}  SGT today: ${todayIso}`);

  const sessions = await prisma.morningQuizSession.findMany({
    where: { date: { gte: todayDate, lt: tomorrowDate } },
    select: {
      id: true,
      level: true,
      status: true,
      paperAssignmentId: true,
      class: { select: { name: true } },
    },
    orderBy: [{ classId: 'asc' }, { level: 'asc' }],
  });

  console.log(`\nFound ${sessions.length} session(s) for ${todayIso}.`);
  if (sessions.length === 0) {
    await prisma.$disconnect();
    return;
  }

  let grandGraded = 0;
  let grandFailed = 0;
  let grandSkipped = 0;
  const errors: Array<{ subId: string; err: string }> = [];

  for (const session of sessions) {
    console.log(
      `\n— ${session.class.name} / ${session.level} (status=${session.status}) sid=${session.id}`,
    );

    const submissions = await prisma.studentSubmission.findMany({
      where: {
        assignmentId: session.paperAssignmentId,
        // Same filter as regradeSession — skip in_progress (cron handles
        // those) and practice (never graded). Submitted + locked is the
        // real cohort.
        status: { in: ['submitted', 'locked'] },
      },
      include: {
        scripts: {
          include: {
            paperQuestion: {
              include: {
                question: {
                  select: {
                    questionType: true,
                    options: true,
                    answerContent: true,
                    content: true,
                  },
                },
              },
            },
          },
        },
        student: { select: { name: true } },
      },
    });
    console.log(`  ${submissions.length} submission(s) to grade`);

    let graded = 0;
    let failed = 0;
    let skipped = 0;

    for (const sub of submissions) {
      try {
        if (sub.scripts.length === 0) {
          skipped++;
          continue;
        }
        const rawGrade = await autoGradeScripts(sub.scripts as any, evaluator);
        const { autoScore, scriptUpdates } = await applyRetractionCredits(
          prisma,
          sub.scripts as any,
          rawGrade,
        );
        const manualScore = sub.manualScore ?? 0;
        const totalScore = autoScore + manualScore;
        const before = sub.autoScore ?? 0;

        await prisma.$transaction(async (tx) => {
          await tx.studentSubmission.update({
            where: { id: sub.id },
            data: { autoScore, totalScore },
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
        const delta = autoScore - before;
        const sign = delta > 0 ? '+' : '';
        console.log(
          `    ✓ ${sub.student.name}: ${autoScore}/${sub.maxScore} (${sign}${delta} vs prior ${before})`,
        );
      } catch (e: any) {
        failed++;
        const msg = e?.message ?? String(e);
        console.error(`    ✗ ${sub.student.name} sub=${sub.id}: ${msg}`);
        errors.push({ subId: sub.id, err: msg });
      }
    }

    console.log(`  → graded=${graded} skipped=${skipped} failed=${failed}`);
    grandGraded += graded;
    grandFailed += failed;
    grandSkipped += skipped;
  }

  console.log(
    `\n=== Done ===\n  sessions=${sessions.length}\n  graded=${grandGraded}\n  skipped=${grandSkipped}\n  failed=${grandFailed}`,
  );
  if (errors.length > 0) {
    console.log(`\nErrors:`);
    for (const e of errors.slice(0, 20)) {
      console.log(`  sub=${e.subId}: ${e.err}`);
    }
  }

  await prisma.$disconnect();
})();
