import { PrismaClient } from '@prisma/client';

/**
 * Dump today's marker queue — all submissions with ungraded short_answer
 * / structured / essay scripts — to stdout in a Claude-friendly format.
 *
 * Read-only. No JWT needed. Run on Railway:
 *   railway run -- npx ts-node apps/api/scripts/marker-dump.ts
 *
 * Per the [[ai-api-usage-policy]] — short-answer grading is done by
 * Claude in chat, NEVER via the API's evaluateBatch. This script
 * surfaces the data; pair with marker-apply.ts to write back.
 */

const prisma = new PrismaClient();

(async () => {
  const tzOff = Number(process.env.MORNING_QUIZ_TZ_OFFSET_MIN ?? 8 * 60);
  const now = new Date();
  const localNow = new Date(now.getTime() + tzOff * 60_000);
  const today = new Date(
    Date.UTC(localNow.getUTCFullYear(), localNow.getUTCMonth(), localNow.getUTCDate()),
  );
  const tomorrow = new Date(today.getTime() + 86_400_000);
  const dateIso = today.toISOString().slice(0, 10);

  // All today's sessions → assignmentIds
  const sessions = await prisma.morningQuizSession.findMany({
    where: { date: { gte: today, lt: tomorrow } },
    select: {
      id: true,
      level: true,
      paperAssignmentId: true,
      class: { select: { name: true } },
    },
  });
  const assignmentIds = sessions.map((s) => s.paperAssignmentId);

  const submissions = await prisma.studentSubmission.findMany({
    where: {
      assignmentId: { in: assignmentIds },
      status: 'submitted',
      scripts: {
        some: {
          awardedMarks: null,
          paperQuestion: {
            question: {
              questionType: { in: ['structured', 'short_answer', 'essay'] },
            },
          },
        },
      },
    },
    include: {
      student: { select: { name: true } },
      assignment: { include: { paper: { select: { name: true } } } },
      scripts: {
        include: {
          paperQuestion: {
            include: {
              question: {
                select: {
                  questionType: true,
                  content: true,
                  answerContent: true,
                  options: true,
                },
              },
            },
          },
        },
      },
    },
    orderBy: { submittedAt: 'asc' },
  });

  console.log('═══════════════════════════════════════════════════════════');
  console.log(`MARKER QUEUE DUMP · ${dateIso} (SGT)`);
  console.log(`Sessions today: ${sessions.length}`);
  console.log(`Submissions awaiting marker: ${submissions.length}`);
  console.log('═══════════════════════════════════════════════════════════\n');

  for (const sub of submissions) {
    const sess = sessions.find((s) => s.paperAssignmentId === sub.assignmentId);
    const ungraded = sub.scripts.filter(
      (sc) =>
        sc.awardedMarks == null &&
        ['structured', 'short_answer', 'essay'].includes(sc.paperQuestion.question.questionType),
    );
    if (ungraded.length === 0) continue;

    console.log('─'.repeat(60));
    console.log(`SUBMISSION ${sub.id}`);
    console.log(`  Student: ${sub.student.name}`);
    console.log(`  Class:   ${sess?.class.name ?? '?'}  Level: ${sess?.level ?? '?'}`);
    console.log(`  Paper:   ${sub.assignment.paper.name}`);
    console.log(`  Auto score so far: ${sub.autoScore ?? 0} / ${sub.maxScore}`);
    console.log(`  Submitted at: ${sub.submittedAt?.toISOString() ?? '?'}`);
    console.log(`  Scripts to grade: ${ungraded.length}`);
    console.log('');

    for (const sc of ungraded) {
      const pq = sc.paperQuestion as any;
      const q = pq.question;
      const stem =
        // Prefer the snapshot (frozen at paper publication) for stability
        pq.snapshotContent?.stem ??
        q.content?.stem ??
        JSON.stringify(pq.snapshotContent ?? q.content ?? {}).slice(0, 200);
      const passage =
        pq.snapshotContent?.passage ??
        q.content?.passage ??
        null;
      const markScheme =
        pq.snapshotAnswer?.text ??
        pq.snapshotAnswer?.markScheme ??
        q.answerContent?.text ??
        q.answerContent?.markScheme ??
        JSON.stringify(pq.snapshotAnswer ?? q.answerContent ?? {}).slice(0, 200);
      const studentAns = sc.textAnswer ?? sc.selectedOption ?? '<blank>';

      console.log(`  ── Script ${sc.id}  [${q.questionType}]  maxMarks=${pq.marks}`);
      if (passage) {
        const trimmed = String(passage).replace(/\s+/g, ' ').trim();
        console.log(
          `    Passage: ${trimmed.length > 300 ? trimmed.slice(0, 300) + '…' : trimmed}`,
        );
      }
      console.log(`    Stem:        ${String(stem).replace(/\s+/g, ' ').trim()}`);
      console.log(`    Mark scheme: ${String(markScheme).replace(/\s+/g, ' ').trim()}`);
      console.log(`    Student ans: ${String(studentAns).replace(/\s+/g, ' ').trim()}`);
      console.log('');
    }
  }

  console.log('═══════════════════════════════════════════════════════════');
  console.log(`END DUMP — ${submissions.length} submission(s)`);
  await prisma.$disconnect();
})();
