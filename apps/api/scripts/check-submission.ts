import { PrismaClient } from '@prisma/client';
const p = new PrismaClient();
(async () => {
  const sub = await p.studentSubmission.findFirst({
    where: { student: { name: '王小明' } },
    include: {
      student: { select: { name: true } },
      assignment: { include: { paper: { select: { name: true } } } },
      scripts: {
        include: {
          paperQuestion: {
            select: { sortOrder: true, snapshotContent: true, snapshotAnswer: true },
          },
        },
        orderBy: { paperQuestion: { sortOrder: 'asc' } },
      },
    },
  });
  if (!sub) {
    console.log('no submission');
    return;
  }
  console.log('submission:', {
    student: sub.student.name,
    paper: sub.assignment.paper.name,
    status: sub.status,
    submittedAt: sub.submittedAt,
    autoScore: sub.autoScore,
  });
  console.log('answers:');
  for (const s of sub.scripts) {
    const pq: any = s.paperQuestion;
    const tt = (pq.snapshotContent as any)?.taskType;
    const ans = (pq.snapshotAnswer as any)?.text;
    const studentAns = s.selectedOption ?? s.textAnswer;
    const correct = String(studentAns ?? '').trim().toLowerCase() === String(ans ?? '').trim().toLowerCase();
    console.log(
      `  Q${pq.sortOrder} [${tt}] expected=${ans} got=${studentAns} ${correct ? '✓' : '✗'} autoCorrect=${s.autoCorrect}`,
    );
  }
  await p.$disconnect();
})();
