import { PrismaClient } from '@prisma/client';

/**
 * 「补做落地页」体验用的一次性测试场次。
 *
 * 补做页只在**超时自动收卷**的那一刻出现，正常流程里要等到 9:00 才
 * 碰得到。这个脚本在测试班开一场 N 分钟后就结束的早测，让老师能在
 * 几分钟内完整走一遍：扫码 → 只答两三题 → 等时间到 → 看到补做页。
 *
 * 用测试班（【测试】作业功能测试班），不碰 G11 的真实数据。
 * 卷子复用 G11 今天那份，省得再造题。
 *
 *   MINUTES=3 npx ts-node apps/api/scripts/setup-makeup-demo.ts
 *
 * 跑完会打印扫码链接。用完请跑 --drop 清掉：
 *   npx ts-node apps/api/scripts/setup-makeup-demo.ts --drop
 */

const TEST_CLASS = process.env.TEST_CLASS ?? 'cmryb32yf00t5d0pa2t4iy6tm';
const MINUTES = Number(process.env.MINUTES ?? 3);
const ORIGIN = process.env.ORIGIN ?? 'https://nurturing-radiance-production.up.railway.app';

const prisma = new PrismaClient();

(async () => {
  const drop = process.argv.includes('--drop');

  if (drop) {
    const sessions = await prisma.morningQuizSession.findMany({
      where: { classId: TEST_CLASS },
      select: { id: true, paperAssignmentId: true },
    });
    for (const s of sessions) {
      await prisma.studentSubmission.deleteMany({ where: { assignmentId: s.paperAssignmentId } });
      await prisma.attendance.deleteMany({ where: { sessionId: s.id } });
      await prisma.morningQuizSession.delete({ where: { id: s.id } });
      await prisma.paperAssignment.delete({ where: { id: s.paperAssignmentId } }).catch(() => {});
    }
    console.log(`已清理测试班 ${sessions.length} 场演示场次`);
    await prisma.$disconnect();
    return;
  }

  // 复用 G11 今天的卷子，省得造题
  const src = await prisma.$queryRaw<Array<{ paperId: string; title: string }>>`
    SELECT pa."paperId", p.name AS title
    FROM "MorningQuizSession" s
    JOIN "PaperAssignment" pa ON pa.id = s."paperAssignmentId"
    JOIN "Paper" p ON p.id = pa."paperId"
    WHERE s."classId" = 'cmoux0jj900m9oc28r4sptjj0'
      AND s.level = 'ielts_authentic'
    ORDER BY s."date" DESC LIMIT 1`;
  if (!src.length) throw new Error('找不到可复用的卷子');
  const { paperId, title } = src[0];

  const now = new Date();
  const quizEnd = new Date(now.getTime() + MINUTES * 60_000);
  // 考勤窗口现在就开，晚点截止；lateCutoff 必须 < quizEnd
  const attendanceStart = new Date(now.getTime() - 60_000);
  const lateCutoff = new Date(now.getTime() + (MINUTES - 1) * 60_000);

  const paper = await prisma.paper.findUnique({
    where: { id: paperId },
    select: { totalMarksActual: true },
  });

  const assignment = await prisma.paperAssignment.create({
    data: {
      paperId,
      classId: TEST_CLASS,
      startAt: attendanceStart,
      dueAt: quizEnd,
      durationMin: MINUTES,
      status: 'active',
      assignedById: (await prisma.user.findFirst({ where: { role: 'admin' }, select: { id: true } }))!.id,
    },
  });

  const session = await prisma.morningQuizSession.create({
    data: {
      date: new Date(new Date(now.getTime() + 8 * 3600_000).toISOString().slice(0, 10)),
      classId: TEST_CLASS,
      paperAssignmentId: assignment.id,
      attendanceStart,
      attendanceEnd: lateCutoff,
      lateCutoff,
      quizStart: attendanceStart,
      quizEnd,
      qrSecret: 'demo-' + Math.random().toString(36).slice(2, 10),
      qrRotationSeconds: 3600,
      status: 'active',
      level: 'ielts_authentic',
      scheduledById: assignment.assignedById,
    },
  });

  console.log('\n═══ 补做落地页 · 体验场次已开 ═══');
  console.log(`卷子      : ${title}（满分 ${paper?.totalMarksActual}）`);
  console.log(`班级      : 【测试】作业功能测试班（不影响 G11 数据）`);
  console.log(`现在      : ${new Date(now.getTime() + 8 * 3600_000).toISOString().slice(11, 19)} SGT`);
  console.log(`自动收卷  : ${new Date(quizEnd.getTime() + 8 * 3600_000).toISOString().slice(11, 19)} SGT（${MINUTES} 分钟后）`);
  console.log(`sessionId : ${session.id}`);
  // 静态 v2 二维码 token = v2.<classId>.<hmac16>，签名口径与
  // qr.service.staticTokenForClass 一致，这里直接算出来省得手工拼。
  const { createHmac } = await import('node:crypto');
  const sig = createHmac('sha256', process.env.JWT_SECRET ?? '')
    .update(`qr-static.v2.${TEST_CLASS}`)
    .digest('hex')
    .slice(0, 16);
  console.log(`\n📱 用手机打开这个链接：`);
  console.log(`   ${ORIGIN}/scan/v2.${TEST_CLASS}.${sig}`);
  console.log(`\n姓名填「测试学生」。进去后随便答两三题，然后等时间到 —— 会看到补做页。`);
  console.log(`\n用完清理： npx ts-node apps/api/scripts/setup-makeup-demo.ts --drop\n`);

  await prisma.$disconnect();
})().catch((e) => {
  console.error(e?.message ?? e);
  process.exit(1);
});
