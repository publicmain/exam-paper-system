import { PrismaClient, MorningQuizStatus } from '@prisma/client';

/**
 * Pair script for e2e-prepare.ts. Wipes the test student's data on
 * the given session and restores the session's original timings +
 * scheduled status from the snapshot audit row.
 *
 * Usage:
 *   DATABASE_URL=<prod-public> SESSION_ID=<sessId> \
 *     npx ts-node apps/api/scripts/e2e-cleanup.ts
 *
 * Set DELETE_USER=true to also drop the "测试-AI" user + enrollment
 * (only do this on the LAST level after all 3 are tested).
 */

const TEST_NAME = '测试-AI';

const prisma = new PrismaClient();

(async () => {
  const sessionId = process.env.SESSION_ID;
  if (!sessionId) {
    console.error('SESSION_ID env var required');
    process.exit(1);
  }

  const sess = await prisma.morningQuizSession.findUnique({
    where: { id: sessionId },
    select: { id: true, paperAssignmentId: true, classId: true, level: true },
  });
  if (!sess) {
    console.error('Session not found');
    process.exit(1);
  }

  const user = await prisma.user.findFirst({ where: { name: TEST_NAME, role: 'student' } });
  if (!user) {
    console.log('No test user — nothing to clean.');
  } else {
    // Delete this student's attendance + submission + cascaded scripts
    const subDel = await prisma.studentSubmission.deleteMany({
      where: { assignmentId: sess.paperAssignmentId, studentId: user.id },
    });
    const attDel = await prisma.attendance.deleteMany({
      where: { sessionId, studentId: user.id },
    });
    console.log(
      `Cleaned test student data on session: deleted ${subDel.count} submission(s), ${attDel.count} attendance row(s)`,
    );
  }

  // Restore session timing windows from the snapshot we wrote in prepare
  const snap = await prisma.auditLog.findFirst({
    where: {
      action: 'e2e.session_snapshot',
      entityType: 'MorningQuizSession',
      entityId: sessionId,
    },
    orderBy: { createdAt: 'desc' },
  });
  if (!snap) {
    console.warn(`No snapshot found for session ${sessionId}; falling back to canonical 08:30 windows.`);
    // Fallback: rebuild from session.date using the canonical constants.
    const sessFull = await prisma.morningQuizSession.findUnique({
      where: { id: sessionId },
      select: { date: true },
    });
    if (!sessFull) {
      console.error('Session vanished');
      process.exit(1);
    }
    const tzOff = Number(process.env.MORNING_QUIZ_TZ_OFFSET_MIN ?? 8 * 60);
    const dateIso = sessFull.date.toISOString().slice(0, 10);
    const [y, mo, d] = dateIso.split('-').map(Number);
    const mk = (h: number, m: number, s = 0) =>
      new Date(Date.UTC(y, mo - 1, d, h, m, s) - tzOff * 60_000);
    await prisma.morningQuizSession.update({
      where: { id: sessionId },
      data: {
        status: MorningQuizStatus.scheduled,
        attendanceStart: mk(8, 30, 0),
        attendanceEnd: mk(8, 40, 0),
        lateCutoff: mk(8, 59, 59),
        quizStart: mk(8, 30, 0),
        quizEnd: mk(9, 0, 0),
      },
    });
    console.log(`Restored to canonical 08:30 SGT windows.`);
  } else {
    const meta = snap.metadata as any;
    await prisma.morningQuizSession.update({
      where: { id: sessionId },
      data: {
        status: (meta?.originalStatus as any) ?? MorningQuizStatus.scheduled,
        attendanceStart: new Date(meta.originalAttendanceStart),
        attendanceEnd: new Date(meta.originalAttendanceEnd),
        lateCutoff: new Date(meta.originalLateCutoff),
        quizStart: new Date(meta.originalQuizStart),
        quizEnd: new Date(meta.originalQuizEnd),
      },
    });
    console.log(`Restored session ${sessionId} (level=${sess.level}) to original timings.`);
    // Mark snapshot as consumed so a subsequent cleanup doesn't double-restore
    await prisma.auditLog.update({
      where: { id: snap.id },
      data: {
        action: 'e2e.session_snapshot.consumed',
      },
    });
  }

  if (process.env.DELETE_USER === 'true' && user) {
    await prisma.classEnrollment.deleteMany({
      where: { userId: user.id },
    });
    await prisma.user.delete({ where: { id: user.id } });
    console.log(`Deleted test user ${user.id}.`);
  }

  await prisma.$disconnect();
})();
