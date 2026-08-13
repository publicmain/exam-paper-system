import { PrismaClient } from '@prisma/client';
import { MistakeService } from '../src/vocab/mistake.service';

/**
 * 错题本回填（一次性）。
 *
 * 错题本从 2026-08-13 起在判分时自动采集（marker-apply.ts 末尾），
 * 但在此之前判过的卷子没有走过这条路径。这个脚本把已判分的历史提交
 * 补进去，让学生第一次打开错题本时不是空的 —— 空错题本对"这个功能
 * 有没有用"的判断是致命的。
 *
 * 幂等：MistakeEntry 有 (studentId, submissionId, paperQuestionId)
 * 唯一键，重复跑只会跳过。
 *
 *   railway run -- npx ts-node apps/api/scripts/backfill-mistakes.ts
 * 或本地带 DATABASE_URL（需 ?sslmode=require）直连 prod。
 */

const CLASS_ID = process.env.CLASS_ID ?? 'cmoux0jj900m9oc28r4sptjj0';
const SINCE = process.env.SINCE ?? '2026-07-28';

const prisma = new PrismaClient();

(async () => {
  const svc = new MistakeService(prisma as any);
  const subs = await prisma.$queryRaw<Array<{ id: string; day: string }>>`
    SELECT sub.id, to_char(s."date", 'YYYY-MM-DD') AS day
    FROM "MorningQuizSession" s
    JOIN "PaperAssignment" pa ON pa.id = s."paperAssignmentId"
    JOIN "StudentSubmission" sub ON sub."assignmentId" = pa.id
    WHERE s."classId" = ${CLASS_ID}
      AND s."date" >= ${SINCE}::date
      AND sub.status = 'marked'
    ORDER BY s."date"`;
  console.log(`待回填已判分提交: ${subs.length} 份（${SINCE} 起）`);

  let total = 0;
  for (const s of subs) {
    try {
      const r = await svc.collectFromSubmission(s.id, s.day);
      total += r.added;
    } catch (e: any) {
      console.warn(`  skip ${s.id}: ${e?.message ?? e}`);
    }
  }
  console.log(`\n错题本回填完成: 新增 ${total} 条`);

  const byReason = await prisma.mistakeEntry.groupBy({ by: ['reason'], _count: true });
  console.log('按收录规则:', byReason.map((r) => `${r.reason}=${r._count}`).join('  '));

  const byType = await prisma.mistakeEntry.groupBy({
    by: ['taskType'],
    _count: true,
    orderBy: { _count: { taskType: 'desc' } },
  });
  console.log('按题型:', byType.map((r) => `${r.taskType}=${r._count}`).join('  '));

  const perStu = await prisma.$queryRaw<Array<{ name: string; n: number }>>`
    SELECT u.name, COUNT(*)::int AS n
    FROM "MistakeEntry" m JOIN "User" u ON u.id = m."studentId"
    GROUP BY u.name ORDER BY n DESC`;
  console.log('\n每人条数:');
  for (const x of perStu) console.log('  ', x.name.padEnd(18), x.n);

  await prisma.$disconnect();
})().catch((e) => {
  console.error(e?.message ?? e);
  process.exit(1);
});
