import { NestFactory } from '@nestjs/core';
import { AppModule } from '../src/app.module';
import { MorningQuizService } from '../src/morning-quiz/morning-quiz.service';
import { PrismaService } from '../src/common/prisma.service';

/**
 * 给未来的某几场早测换一份卷子。
 *
 * 用途：题库耗尽时排的课会走 LRU 回收，抽到学生做过的旧卷（违反
 * 「绝不给一个班重复同一个故事」的硬规则，只是当时无卷可用）。等新卷
 * 入库后，用这个脚本把还没开考的场次换成全新的。
 *
 * 做法是「删旧场 → 重跑 picker → 建新场」而不是原地改 paperAssignmentId：
 *   · picker 的终身去重读 Paper.config.paperKey，删掉那条 Paper 才能把
 *     这次并未真正使用的 paperKey 释放回候选池（service 第 1274 行注释
 *     明确保证了这个语义）。
 *   · 删 Paper 会级联 PaperAssignment → MorningQuizSession → Attendance，
 *     所以留不下孤儿 assignment（否则学生作业列表会看到一份没有 session
 *     的卷子）。
 *   · createSession 撞 (date, class, level) 唯一键会抛 session_already_exists，
 *     所以必须先删后建。
 *
 * 安全闸（任一不满足就跳过该场，不做部分删除）：
 *   · 日期必须严格晚于今天 —— 给过去的日子重建场次会让 lock cron 立刻
 *     锁场并给全班插缺席行（2026-05-10 事故的形状）。
 *   · status 必须是 scheduled。
 *   · 不能已有 Attendance / StudentSubmission / WatermarkToken。
 *
 *   演练：DATABASE_URL=... npx ts-node apps/api/scripts/reswap-session-paper.ts --dates 2026-08-19,2026-08-20 --levels olevel
 *   执行：... --apply
 */

function arg(name: string): string | undefined {
  const i = process.argv.indexOf(`--${name}`);
  return i >= 0 ? process.argv[i + 1] : undefined;
}

(async () => {
  const dates = (arg('dates') ?? '').split(',').map((s) => s.trim()).filter(Boolean);
  if (!dates.length) throw new Error('缺 --dates 2026-08-19,2026-08-20');
  const levels = (arg('levels') ?? 'olevel').split(',').map((s) => s.trim()).filter(Boolean);
  const APPLY = process.argv.includes('--apply');

  process.env.BOOTSTRAP_CONTENT_DISABLED = 'true';
  const app = await NestFactory.createApplicationContext(AppModule, { logger: ['error', 'warn'] });
  const svc = app.get(MorningQuizService);
  const prisma = app.get(PrismaService);

  const admin = await prisma.user.findFirst({
    where: { role: 'admin', isActive: true },
    select: { id: true, email: true },
  });
  if (!admin) throw new Error('找不到 admin');
  const actor = { id: admin.id, role: 'admin', ip: null };

  const today = new Date(Date.now() + 8 * 3600_000).toISOString().slice(0, 10);
  console.log(`\n=== 换卷 ${APPLY ? '(执行)' : '(演练)'} —— 今天(SGT) ${today} ===\n`);

  for (const dateIso of dates) {
    if (dateIso <= today) {
      console.log(`  ⚠ ${dateIso} 跳过 —— 不是未来日期，重建场次会触发锁场+全班缺席。`);
      continue;
    }
    for (const level of levels) {
      const session = await prisma.morningQuizSession.findFirst({
        where: { date: new Date(`${dateIso}T00:00:00.000Z`), level: level as any },
        select: {
          id: true,
          classId: true,
          status: true,
          paperAssignment: {
            select: {
              id: true,
              paperId: true,
              paper: { select: { name: true, config: true } },
            },
          },
        },
      });
      if (!session) {
        console.log(`  · ${dateIso} ${level}：没有场次，跳过`);
        continue;
      }
      const paperId = session.paperAssignment?.paperId;
      const oldKey = (session.paperAssignment?.paper?.config as any)?.paperKey ?? '(未知)';

      // ── 安全闸 ──
      const blockers: string[] = [];
      if (session.status !== 'scheduled') blockers.push(`status=${session.status}`);
      const att = await prisma.attendance.count({ where: { sessionId: session.id } });
      if (att) blockers.push(`已有 ${att} 条考勤`);
      if (session.paperAssignment) {
        const sub = await prisma.studentSubmission.count({
          where: { assignmentId: session.paperAssignment.id },
        });
        if (sub) blockers.push(`已有 ${sub} 份答卷`);
      }
      if (paperId) {
        const wm = await prisma.watermarkToken.count({ where: { paperId } });
        if (wm) blockers.push(`已有 ${wm} 个水印令牌（RESTRICT 外键，删不掉）`);
      }
      if (blockers.length) {
        console.log(`  ✗ ${dateIso} ${level} 跳过 —— ${blockers.join(' / ')}`);
        continue;
      }

      if (!APPLY) {
        console.log(`  · ${dateIso} ${level}：将删场重排（当前卷 ${oldKey}）`);
        continue;
      }

      try {
        // 删 Paper 即级联 assignment → session → attendance，一步清干净；
        // 同时把这次并未真正使用的 paperKey 释放回候选池。
        if (paperId) await prisma.paper.delete({ where: { id: paperId } });
        else await prisma.morningQuizSession.delete({ where: { id: session.id } });

        const newPaperId = await (svc as any).pickOlevelPaperAndCreatePaper(
          session.classId,
          dateIso,
          actor,
          { provenanceFilter: level === 'ielts_simplified' ? 'basic' : 'standard' },
        );
        const created = await svc.createSession(
          {
            date: new Date(`${dateIso}T00:00:00.000Z`),
            classId: session.classId,
            paperId: newPaperId,
            level: level as any,
          },
          actor as any,
        );
        const np = await prisma.paper.findUnique({
          where: { id: newPaperId },
          select: { name: true, totalMarksActual: true },
        });
        const qn = await prisma.paperQuestion.count({ where: { paperId: newPaperId } });
        console.log(`  ✓ ${dateIso} ${level}  ${oldKey}`);
        console.log(`        → ${np?.name}  (${qn} 题 / ${np?.totalMarksActual} 分, session=${created.id})`);
      } catch (e: any) {
        console.log(`  ✗ ${dateIso} ${level} 失败：${e?.response?.code ?? e?.message ?? e}`);
        console.log('      注意：旧场可能已删除但新场未建 —— 用 schedule-days.ts 补一场。');
      }
    }
  }

  if (!APPLY) console.log('\n加 --apply 才写库。\n');
  await app.close();
  process.exit(0);
})().catch((e) => {
  console.error(e?.message ?? e);
  process.exit(1);
});
