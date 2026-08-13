import { PrismaClient } from '@prisma/client';
import { cleanStem } from '../src/vocab/mistake-humanize';

/**
 * 修已入库错题的题干（一次性）。
 *
 * 2026-08-13 收录时把原始题干直接截断到 400 字存下，而 IELTS/O-Level
 * 的题干前面拖着一整段答题须知 —— 结果学生看到的全是"In boxes 5–8 on
 * your answer sheet, write TRUE if…"，真正问什么反而被截没了
 * （8 分 summary 题实测正好断在 "…ageing popul"）。
 *
 * 这个脚本回到 PaperQuestion 取完整题干，清洗后写回。幂等。
 *
 *   npx ts-node apps/api/scripts/fix-mistake-stems.ts
 */

const prisma = new PrismaClient();

(async () => {
  const rows = await prisma.mistakeEntry.findMany({
    where: { paperQuestionId: { not: null } },
    select: { id: true, paperQuestionId: true, stem: true },
  });
  console.log(`待检查 ${rows.length} 条`);

  let fixed = 0;
  for (const r of rows) {
    const pq = await prisma.paperQuestion.findUnique({
      where: { id: r.paperQuestionId! },
      select: { snapshotContent: true, overrideContent: true },
    });
    if (!pq) continue;
    const content = (pq.overrideContent ?? pq.snapshotContent) as any;
    const full = String(content?.stem ?? '');
    if (!full) continue;
    const cleaned = (cleanStem(full) || full).slice(0, 600);
    if (cleaned && cleaned !== r.stem) {
      await prisma.mistakeEntry.update({ where: { id: r.id }, data: { stem: cleaned } });
      fixed++;
    }
  }
  console.log(`题干已修复 ${fixed} 条`);

  const sample = await prisma.mistakeEntry.findMany({
    select: { stem: true }, take: 3, orderBy: { createdAt: 'desc' },
  });
  console.log('\n修复后样本：');
  for (const s of sample) console.log(' •', s.stem.slice(0, 110));

  await prisma.$disconnect();
})().catch((e) => { console.error(e?.message ?? e); process.exit(1); });
