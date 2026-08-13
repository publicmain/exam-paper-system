import { PrismaClient } from '@prisma/client';
import { cleanStem } from '../src/vocab/mistake-humanize';

/**
 * 修已入库错题的题干和正确答案（一次性，幂等）。
 *
 * 2026-08-13 收录时把原始题干直接截断到 400 字存下，而 IELTS/O-Level
 * 的题干前面拖着一整段答题须知 —— 结果学生看到的全是"In boxes 5–8 on
 * your answer sheet, write TRUE if…"，真正问什么反而被截没了
 * （8 分 summary 题实测正好断在 "…ageing popul"）。
 *
 * 同日第二处：correctAnswer 存的时候截到 1000 字，而 8 分 summary 的
 * mark scheme 是 CONTENT POINTS + STYLE + MODEL 三段，1000 正好切在
 * 末尾的 MODEL 范文上 —— 学生看到的范文断成
 * "Singapore is responding to its ageing population by"。范文恰恰是
 * 长答题里最该照着看的东西。上限提到 2000，这里把已入库的重取一遍。
 *
 * 两处都回到 PaperQuestion 取原文重新处理。
 *
 *   npx ts-node apps/api/scripts/fix-mistake-stems.ts
 */

const prisma = new PrismaClient();

(async () => {
  const rows = await prisma.mistakeEntry.findMany({
    where: { paperQuestionId: { not: null } },
    select: { id: true, paperQuestionId: true, stem: true, correctAnswer: true },
  });
  console.log(`待检查 ${rows.length} 条`);

  let fixedStem = 0;
  let fixedAnswer = 0;
  for (const r of rows) {
    const pq = await prisma.paperQuestion.findUnique({
      where: { id: r.paperQuestionId! },
      select: {
        snapshotContent: true,
        overrideContent: true,
        snapshotAnswer: true,
        overrideAnswer: true,
      },
    });
    if (!pq) continue;

    const data: { stem?: string; correctAnswer?: string } = {};

    const content = (pq.overrideContent ?? pq.snapshotContent) as any;
    const full = String(content?.stem ?? '');
    if (full) {
      const cleaned = (cleanStem(full) || full).slice(0, 600);
      if (cleaned && cleaned !== r.stem) data.stem = cleaned;
    }

    const answerObj = (pq.overrideAnswer ?? pq.snapshotAnswer) as any;
    const answer = typeof answerObj === 'string' ? answerObj : String(answerObj?.text ?? '');
    if (answer) {
      const next = answer.slice(0, 2000);
      if (next !== r.correctAnswer) data.correctAnswer = next;
    }

    if (!data.stem && !data.correctAnswer) continue;
    await prisma.mistakeEntry.update({ where: { id: r.id }, data });
    if (data.stem) fixedStem++;
    if (data.correctAnswer) fixedAnswer++;
  }
  console.log(`题干已修复 ${fixedStem} 条，正确答案已修复 ${fixedAnswer} 条`);

  const sample = await prisma.mistakeEntry.findMany({
    select: { stem: true },
    take: 3,
    orderBy: { createdAt: 'desc' },
  });
  console.log('\n修复后样本：');
  for (const s of sample) console.log(' •', s.stem.slice(0, 110));

  await prisma.$disconnect();
})().catch((e) => {
  console.error(e?.message ?? e);
  process.exit(1);
});
