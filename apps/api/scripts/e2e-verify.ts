import { PrismaClient } from '@prisma/client';

const p = new PrismaClient();

(async () => {
  const sessionId = process.env.SESSION_ID;
  if (!sessionId) { console.error('SESSION_ID required'); process.exit(1); }
  const TEST_NAME = '测试-AI';

  const session = await p.morningQuizSession.findUnique({
    where: { id: sessionId },
    select: { paperAssignmentId: true, quizEnd: true, date: true, level: true },
  });
  if (!session) { console.error('session not found'); process.exit(1); }

  const student = await p.user.findFirst({ where: { name: TEST_NAME }, select: { id: true, name: true } });
  if (!student) { console.error('test student not found'); process.exit(1); }
  console.log(`Student: ${student.name} (${student.id})`);
  console.log(`Session ${sessionId}  ${session.date.toISOString().slice(0,10)} ${session.level}  quizEnd=${session.quizEnd.toISOString()}\n`);

  // Attendance — feeds dashboard 扫码时间
  const att = await p.attendance.findUnique({
    where: { sessionId_studentId: { sessionId, studentId: student.id } },
    select: { status: true, scanTime: true, source: true, submissionId: true },
  });
  console.log('── Attendance (dashboard 扫码时间) ──');
  console.log(JSON.stringify(att, null, 2));

  // Submission — feeds dashboard 答题结束时间 + score
  const sub = await p.studentSubmission.findFirst({
    where: { assignmentId: session.paperAssignmentId, studentId: student.id, status: { not: 'practice' } },
    select: { id: true, submittedAt: true, status: true, autoScore: true, manualScore: true, totalScore: true, maxScore: true },
  });
  console.log('\n── Submission (dashboard 答题结束时间 + score) ──');
  console.log(JSON.stringify(sub, null, 2));

  if (sub) {
    const scripts = await p.answerScript.findMany({
      where: { submissionId: sub.id },
      select: {
        selectedOption: true, textAnswer: true, awardedMarks: true, autoCorrect: true, markedAt: true,
        paperQuestion: { select: { sortOrder: true, marks: true, question: { select: { questionType: true } } } },
      },
      orderBy: { paperQuestion: { sortOrder: 'asc' } },
    });
    console.log('\n── Per-question grading ──');
    let mcqMarks = 0, mcqMax = 0, mcqRight = 0, mcqN = 0, saPending = 0, saN = 0, saMax = 0;
    for (const a of scripts) {
      const qt = a.paperQuestion?.question?.questionType;
      const so = a.paperQuestion?.sortOrder;
      const mk = a.paperQuestion?.marks ?? 0;
      const ans = qt === 'mcq' ? `opt=${a.selectedOption} autoCorrect=${a.autoCorrect}` : `text="${String(a.textAnswer ?? '').slice(0,24)}" marked=${a.markedAt ? 'Y' : 'pending'}`;
      console.log(`  Q@${String(so).padStart(2)} ${String(qt).padEnd(12)} ${mk}m  awarded=${a.awardedMarks ?? '–'}  ${ans}`);
      if (qt === 'mcq') { mcqN++; mcqMax += mk; mcqMarks += a.awardedMarks ?? 0; if (a.autoCorrect) mcqRight++; }
      else { saN++; saMax += mk; if (a.awardedMarks == null && a.markedAt == null) saPending++; }
    }
    console.log(`\n  MCQ: ${mcqRight}/${mcqN} correct → ${mcqMarks}/${mcqMax} marks auto-graded`);
    console.log(`  Short-answer: ${saPending}/${saN} pending in marker queue (${saMax} marks awaiting human marking, NO AI)`);
    console.log(`  totalScore=${sub.totalScore}/${sub.maxScore}  (auto=${sub.autoScore} manual=${sub.manualScore})`);
  }

  await p.$disconnect();
})();
