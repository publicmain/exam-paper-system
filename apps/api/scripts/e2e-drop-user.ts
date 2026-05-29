import { PrismaClient } from '@prisma/client';

/**
 * Finishes user teardown after e2e-cleanup restored the session.
 * Deletes ALL dependent rows for the 测试-AI test student (across the
 * RESTRICT-guarded relations) then drops the user. Does NOT touch any
 * MorningQuizSession timings (cleanup already restored those).
 */
const TEST_NAME = '测试-AI';
const prisma = new PrismaClient();

(async () => {
  const user = await prisma.user.findFirst({ where: { name: TEST_NAME, role: 'student' }, select: { id: true } });
  if (!user) { console.log('No test user — nothing to drop.'); await prisma.$disconnect(); return; }
  const studentId = user.id;
  console.log(`Dropping dependents for test user ${studentId}`);

  const r1 = await prisma.questionShuffleMap.deleteMany({ where: { studentId } });
  const r2 = await prisma.paperVariantAssignment.deleteMany({ where: { studentId } });
  const r3 = await prisma.watermarkToken.deleteMany({ where: { studentId } });
  const r4 = await prisma.tutorSession.deleteMany({ where: { studentId } });
  const r5 = await prisma.classEnrollment.deleteMany({ where: { userId: studentId } });
  // safety: any stray submissions/attendance from other sessions
  const r6 = await prisma.studentSubmission.deleteMany({ where: { studentId } });
  const r7 = await prisma.attendance.deleteMany({ where: { studentId } });

  console.log(`  shuffleMap=${r1.count} paperVariant=${r2.count} watermark=${r3.count} tutorSession=${r4.count} enrollment=${r5.count} stray4Sub=${r6.count} strayAtt=${r7.count}`);

  await prisma.user.delete({ where: { id: studentId } });
  console.log(`✓ Deleted test user ${studentId}.`);
  await prisma.$disconnect();
})().catch(async (e) => { console.error(e); await prisma.$disconnect(); process.exit(1); });
