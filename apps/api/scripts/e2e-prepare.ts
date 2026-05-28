import { PrismaClient, MorningQuizStatus, AttendanceStatus } from '@prisma/client';

/**
 * Prepare for end-to-end testing of tomorrow's morning quiz before it
 * goes live:
 *   1. Ensure a "测试-AI" student exists, enrolled in the test class
 *   2. Force the given session into status=active with timing windows
 *      anchored around NOW, so we can scan + answer + submit immediately
 *
 * Usage:
 *   DATABASE_URL=<prod-public> SESSION_ID=<sessId> \
 *     npx ts-node apps/api/scripts/e2e-prepare.ts
 *
 * Restore later with e2e-cleanup.ts.
 */

const TEST_NAME = '测试-AI';
const CLASS_ID = 'cmoux0jj900m9oc28r4sptjj0'; // G11 IELTS Test (morning-quiz)

const prisma = new PrismaClient();

(async () => {
  const sessionId = process.env.SESSION_ID;
  if (!sessionId) {
    console.error('SESSION_ID env var required');
    process.exit(1);
  }

  // 1. Find or create test student
  let user = await prisma.user.findFirst({ where: { name: TEST_NAME, role: 'student' } });
  if (!user) {
    const bcrypt = await import('bcryptjs');
    const passwordHash = await bcrypt.hash('e2e-test-no-password', 4);
    user = await prisma.user.create({
      data: {
        email: `e2e-test-ai-${Date.now().toString(36)}@e2e.local`,
        name: TEST_NAME,
        role: 'student',
        passwordHash,
        isActive: true,
      },
    });
    console.log(`Created test user: ${user.id} (${user.name})`);
  } else {
    console.log(`Reusing test user: ${user.id} (${user.name})`);
  }

  // 2. Ensure enrollment
  const enr = await prisma.classEnrollment.findUnique({
    where: { classId_userId: { classId: CLASS_ID, userId: user.id } },
  });
  if (!enr) {
    await prisma.classEnrollment.create({
      data: { classId: CLASS_ID, userId: user.id, role: 'student' },
    });
    console.log(`Enrolled in class ${CLASS_ID}`);
  } else {
    console.log(`Already enrolled`);
  }

  // 3. debug-activate the session: anchor windows around NOW
  const now = new Date();
  const anchor = now;
  const attendanceStart = new Date(anchor.getTime() - 30_000);
  const attendanceEnd = new Date(anchor.getTime() + 2 * 60_000);
  const lateCutoff = new Date(anchor.getTime() + 20 * 60_000);
  const quizEnd = new Date(anchor.getTime() + 30 * 60_000);

  // Save the ORIGINAL timings to a small audit row so cleanup can
  // restore them (we use auditLog as a free-form key/value store
  // with a sentinel action name).
  const before = await prisma.morningQuizSession.findUnique({
    where: { id: sessionId },
    select: {
      id: true,
      status: true,
      attendanceStart: true,
      attendanceEnd: true,
      lateCutoff: true,
      quizStart: true,
      quizEnd: true,
      classId: true,
      level: true,
      date: true,
    },
  });
  if (!before) {
    console.error('Session not found');
    process.exit(1);
  }

  // Sanity check: refuse to mutate a session that already has real
  // (non-test-student) attendance on it.
  const realAtt = await prisma.attendance.count({
    where: {
      sessionId,
      student: { name: { not: TEST_NAME } },
      status: { not: AttendanceStatus.absent },
    },
  });
  if (realAtt > 0) {
    console.error(`Refusing — session has ${realAtt} real student attendance row(s) already.`);
    process.exit(1);
  }

  // Save original state as a JSON audit entry
  await prisma.auditLog.create({
    data: {
      actorId: 'e2e-prepare',
      actorRole: 'system',
      action: 'e2e.session_snapshot',
      entityType: 'MorningQuizSession',
      entityId: sessionId,
      metadata: {
        originalStatus: before.status,
        originalAttendanceStart: before.attendanceStart.toISOString(),
        originalAttendanceEnd: before.attendanceEnd.toISOString(),
        originalLateCutoff: before.lateCutoff.toISOString(),
        originalQuizStart: before.quizStart.toISOString(),
        originalQuizEnd: before.quizEnd.toISOString(),
      },
    },
  });

  await prisma.morningQuizSession.update({
    where: { id: sessionId },
    data: {
      status: MorningQuizStatus.active,
      attendanceStart,
      attendanceEnd,
      lateCutoff,
      quizStart: attendanceStart,
      quizEnd,
    },
  });

  // Clear any absent rows the lock cron may have seeded
  await prisma.attendance.deleteMany({
    where: { sessionId, status: AttendanceStatus.absent, scanTime: null },
  });

  console.log(`\nSession ${sessionId} activated:`);
  console.log(`  classId: ${before.classId}  level: ${before.level}  date: ${before.date.toISOString().slice(0, 10)}`);
  console.log(`  attendanceStart: ${attendanceStart.toISOString()}  (= now-30s)`);
  console.log(`  attendanceEnd:   ${attendanceEnd.toISOString()}    (= now+2m)`);
  console.log(`  lateCutoff:      ${lateCutoff.toISOString()}    (= now+20m)`);
  console.log(`  quizEnd:         ${quizEnd.toISOString()}    (= now+30m)`);
  console.log(`\nTest student: "${TEST_NAME}" (${user.id})`);
  console.log(`\nNext: hit /api/qr/static?classId=${before.classId} for the v2 token,`);
  console.log(`then navigate browser to /scan/<token>.`);

  await prisma.$disconnect();
})();
