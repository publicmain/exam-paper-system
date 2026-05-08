import { PrismaClient } from '@prisma/client';
const p = new PrismaClient();
(async () => {
  const sid = process.argv[2];
  const sess = await p.morningQuizSession.findUnique({ where: { id: sid } });
  console.log('session:', {
    status: sess?.status,
    attStart: sess?.attendanceStart,
    attEnd: sess?.attendanceEnd,
    lateCutoff: sess?.lateCutoff,
    quizEnd: sess?.quizEnd,
  });
  const atts = await p.attendance.findMany({
    where: { sessionId: sid },
    include: { student: { select: { name: true } } },
  });
  console.log('attendances:', atts.length);
  for (const a of atts)
    console.log(' ', a.student.name, a.status, a.scanTime, 'studentId=', a.studentId);
  console.log('now:', new Date());
  await p.$disconnect();
})();
