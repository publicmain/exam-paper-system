import { PrismaClient } from '@prisma/client';

/**
 * 一次性修复：2026-08-13 首次补考造成的两处数据损坏。
 *
 * 当天中午 13:22 用 debug-activate 打开补考窗口，那个调试端点会
 *   1. 把正式场次的时间窗整体挪到当前时刻 —— 当天 08:30/08:40/09:00
 *      被改写成 13:21/13:42/13:52，早上的真实时间从场次记录里消失；
 *   2. 删掉已生成的缺席行（本意是清理演练残留）。
 * 于是 13:22 扫码的三名补考学生（牟歌/于琳晶/胡鑫瑜）落在新的
 * lateCutoff 13:42 之前，被记成 **on_time**，早上的无故缺席一点痕迹
 * 都没留下 —— 而这正是学校新政策要管的行为。
 *
 * 本脚本：
 *   · 把两场的时间窗还原成标准 08:30 / 08:40 / 08:59:59 / 09:00
 *   · 把三人的考勤改回 absent，清掉误写的 scanTime，补上 makeupAt
 *   · 成绩与答卷一律不动（补考成绩照常有效）
 *
 * 幂等：已经修好的行不会被重复改。
 *
 *   npx ts-node apps/api/scripts/fix-2026-08-13-makeup.ts [--apply]
 * 不带 --apply 只打印将要做的改动（dry-run）。
 */

const prisma = new PrismaClient();
const APPLY = process.argv.includes('--apply');
const DAY = '2026-08-13';
const MAKEUP_NAMES = ['牟歌', '于琳晶', '胡鑫瑜'];

/** SGT 本地时刻 → UTC Date（数据库存的是 UTC 墙钟）。 */
const sgt = (hhmmss: string) => new Date(`${DAY}T${hhmmss}+08:00`);

const fmt = (d: Date | null) =>
  d ? new Date(d.getTime() + 8 * 3600_000).toISOString().slice(11, 19) : '—';

(async () => {
  console.log(`\n=== 修复 ${DAY} 补考数据 ${APPLY ? '(执行)' : '(演练，加 --apply 才写库)'} ===\n`);

  const sessions = await prisma.morningQuizSession.findMany({
    where: { date: new Date(`${DAY}T00:00:00.000Z`) },
    select: {
      id: true,
      level: true,
      classId: true,
      attendanceStart: true,
      attendanceEnd: true,
      lateCutoff: true,
      quizStart: true,
      quizEnd: true,
      makeupStart: true,
      class: { select: { name: true } },
    },
  });

  const want = {
    attendanceStart: sgt('08:30:00'),
    attendanceEnd: sgt('08:40:00'),
    lateCutoff: sgt('08:59:59'),
    quizStart: sgt('08:30:00'),
    quizEnd: sgt('09:00:00'),
  };

  console.log('【1】场次时间窗');
  for (const s of sessions) {
    // 测试班的演练场次不动
    if (s.class.name.includes('测试')) {
      console.log(`  跳过 ${s.class.name} / ${s.level}（测试班）`);
      continue;
    }
    const drifted = s.quizEnd.getTime() !== want.quizEnd.getTime();
    console.log(
      `  ${s.level.padEnd(16)} 现在 ${fmt(s.quizStart)}-${fmt(s.quizEnd)} 迟到线 ${fmt(s.lateCutoff)}` +
        (drifted ? `  →  还原为 08:30-09:00 迟到线 08:59:59` : '  （已正确，跳过）'),
    );
    if (!drifted || !APPLY) continue;
    await prisma.morningQuizSession.update({
      where: { id: s.id },
      data: {
        ...want,
        // 当天确实开过补考：把补考窗口按实际发生的时间补记上，
        // 这样周报的补考块和面板的「已补考」标记都有依据。
        makeupStart: s.makeupStart ?? sgt('13:21:50'),
        makeupEnd: sgt('13:52:22'),
      },
    });
  }

  console.log('\n【2】补考三人的考勤');
  const rows = await prisma.attendance.findMany({
    where: {
      session: { date: new Date(`${DAY}T00:00:00.000Z`) },
      student: { name: { in: MAKEUP_NAMES } },
    },
    select: {
      id: true,
      status: true,
      scanTime: true,
      makeupAt: true,
      submissionId: true,
      student: { select: { name: true } },
    },
  });

  for (const r of rows) {
    const needsFix = r.status !== 'absent' || r.scanTime !== null || r.makeupAt === null;
    console.log(
      `  ${r.student.name.padEnd(8)} ${String(r.status).padEnd(8)} 扫码${fmt(r.scanTime)} 补考${fmt(r.makeupAt)}` +
        (needsFix ? '  →  absent / 扫码清空 / 补考 13:22' : '  （已正确，跳过）'),
    );
    if (!needsFix || !APPLY) continue;
    await prisma.attendance.update({
      where: { id: r.id },
      data: {
        status: 'absent',
        // scanTime 的语义是「早上到场时刻」。他们早上没来，这一格必须空，
        // 否则迟到分析会把 13:22 当成到校时间算进去。
        scanTime: null,
        makeupAt: r.makeupAt ?? r.scanTime ?? sgt('13:22:43'),
        correctedNote:
          '2026-08-13 首次补考：debug-activate 覆写窗口导致误记为准时，' +
          '按学校新政还原为「早上缺席 + 中午补考」。成绩有效。',
      },
    });
  }

  // 成绩不动，只做个交代
  const subs = await prisma.studentSubmission.findMany({
    where: {
      student: { name: { in: MAKEUP_NAMES } },
      submittedAt: { gte: new Date(`${DAY}T00:00:00+08:00`), lt: new Date(`${DAY}T23:59:59+08:00`) },
    },
    select: { totalScore: true, maxScore: true, status: true, student: { select: { name: true } } },
  });
  console.log('\n【3】补考成绩（不改动）');
  for (const s of subs) {
    console.log(`  ${s.student.name.padEnd(8)} ${s.totalScore}/${s.maxScore}  ${s.status}`);
  }

  console.log(APPLY ? '\n完成。' : '\n以上为演练结果，加 --apply 才会写库。');
  await prisma.$disconnect();
})().catch((e) => {
  console.error(e?.message ?? e);
  process.exit(1);
});
