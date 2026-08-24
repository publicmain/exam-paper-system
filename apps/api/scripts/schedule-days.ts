import { NestFactory } from '@nestjs/core';
import { AppModule } from '../src/app.module';
import { MorningQuizService } from '../src/morning-quiz/morning-quiz.service';
import { PrismaService } from '../src/common/prisma.service';
import { levelBucket } from '../src/morning-quiz/level-registry';

/**
 * 按天补排早测场次。
 *
 * 为什么不用 batchGenerateForWeek：它会把**本周所有周二至周五**都排上，
 * 包括已经过去的今天。给今天补一场的后果是 quizEnd（09:00）早已过期，
 * 下一轮 lock cron 立刻锁场并给全班插缺席行 —— 就是 2026-05-10 周日
 * 场次全班记缺席那个事故的形状。所以这里逐天建，日期由调用方显式给。
 *
 * 走真实的 pickPassageAndCreatePaper + createSession，终身去重、
 * 快照形状、审计留痕全部与周排课一致，不重写任何选卷逻辑。
 *
 *   演练： DATABASE_URL=... npx ts-node apps/api/scripts/schedule-days.ts --dates 2026-08-19,2026-08-20
 *   执行： ... --dates ... --apply
 *   指定层：--levels ielts_authentic （默认只排雅思层；逗号分隔可多层）
 */

function arg(name: string): string | undefined {
  const i = process.argv.indexOf(`--${name}`);
  return i >= 0 ? process.argv[i + 1] : undefined;
}

(async () => {
  const dates = (arg('dates') ?? '').split(',').map((s) => s.trim()).filter(Boolean);
  if (!dates.length) throw new Error('缺 --dates 2026-08-19,2026-08-20');
  const levels = (arg('levels') ?? 'ielts_authentic').split(',').map((s) => s.trim()).filter(Boolean);
  const APPLY = process.argv.includes('--apply');

  // 关掉启动时的题库幂等 seed —— 这里只排课，不需要它，且它很慢
  process.env.BOOTSTRAP_CONTENT_DISABLED = 'true';
  const app = await NestFactory.createApplicationContext(AppModule, { logger: ['error', 'warn'] });
  const svc = app.get(MorningQuizService);
  const prisma = app.get(PrismaService);

  const cls = await prisma.class.findFirst({
    where: { name: { contains: 'G11' }, archivedAt: null },
    select: { id: true, name: true },
  });
  if (!cls) throw new Error('找不到 G11 班级');
  const admin = await prisma.user.findFirst({
    where: { role: 'admin', isActive: true },
    select: { id: true, email: true },
  });
  if (!admin) throw new Error('找不到 admin');
  const actor = { id: admin.id, role: 'admin', ip: null };

  const today = new Date(Date.now() + 8 * 3600_000).toISOString().slice(0, 10);
  console.log(`\n=== 补排早测 ${APPLY ? '(执行)' : '(演练)'} ===`);
  console.log(`班级：${cls.name}   今天(SGT)：${today}\n`);

  for (const dateIso of dates) {
    if (dateIso <= today) {
      console.log(`  ⚠ ${dateIso} 跳过 —— 不是未来日期。给过去的日子补场会让 lock cron 立刻锁场并给全班插缺席行。`);
      continue;
    }
    const dow = new Date(`${dateIso}T00:00:00Z`).getUTCDay();
    if (dow === 0 || dow === 1 || dow === 6) {
      console.log(`  ⚠ ${dateIso} 跳过 —— 周${'日一二三四五六'[dow]}无早测`);
      continue;
    }
    for (const level of levels) {
      const exists = await prisma.morningQuizSession.findFirst({
        where: { classId: cls.id, date: new Date(`${dateIso}T00:00:00.000Z`), level: level as any },
        select: { id: true },
      });
      if (exists) {
        console.log(`  · ${dateIso} ${level}：已存在，跳过`);
        continue;
      }
      if (!APPLY) {
        console.log(`  · ${dateIso} ${level}：将生成`);
        continue;
      }
      try {
        // 私有方法 —— 刻意复用，避免在脚本里重写终身去重逻辑。
        // 层→桶的映射查 level-registry，与 batchGenerateForWeek 同一张表。
        // 不要在这里按枚举名 if/else 堆分支：枚举名和内容早就对不上
        // （ielts_simplified 装的是 O-Level 基础），2026-08-24 加两个新
        // 等级时这段旧分支就会把雅思轻量抽成 O-Level 标准。
        let paperId: string;
        const bucket = levelBucket(level as any);
        if (bucket === 'ielts_authentic' || bucket === 'ielts_light') {
          paperId = await (svc as any).pickPassageAndCreatePaper(
            'IELTS', 'AUTH', cls.id, dateIso, actor,
            { provenanceFilter: bucket === 'ielts_light' ? 'light' : 'authentic' },
          );
        } else {
          paperId = await (svc as any).pickOlevelPaperAndCreatePaper(
            cls.id, dateIso, actor,
            {
              provenanceFilter:
                bucket === 'olevel_basic' ? 'basic'
                : bucket === 'olevel_simplified' ? 'simplified'
                : 'standard',
            },
          );
        }
        const session = await svc.createSession(
          { date: new Date(`${dateIso}T00:00:00.000Z`), classId: cls.id, paperId, level: level as any },
          actor as any,
        );
        const paper = await prisma.paper.findUnique({
          where: { id: paperId },
          select: { name: true, totalMarksActual: true, config: true },
        });
        const qs = await prisma.paperQuestion.count({ where: { paperId } });
        console.log(`  ✓ ${dateIso} ${level}  ${qs} 题 / ${paper?.totalMarksActual} 分`);
        console.log(`      ${paper?.name}`);
        console.log(`      session=${session.id}`);
      } catch (e: any) {
        console.log(`  ✗ ${dateIso} ${level} 失败：${e?.response?.code ?? e?.message ?? e}`);
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
