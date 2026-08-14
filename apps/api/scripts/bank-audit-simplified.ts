import { PrismaClient } from '@prisma/client';

/**
 * O-Level 题库分层盘点 —— 上架「O-Level 基础」层之前先看清家底。
 *
 * 只读。输出：按 provenanceTag × status 的题数/卷数，以及 simplified
 * 层每份卷的题数与文章长度（决定现有内容够不够「基础层」口径：
 * 短文精简、约 5 题）。
 */
const prisma = new PrismaClient();

(async () => {
  const byTag = await prisma.$queryRawUnsafe<any[]>(`
    SELECT "provenanceTag", status::text AS status,
           COUNT(*)::int AS questions,
           COUNT(DISTINCT substring("sourceRef" from '^OLEVEL/[^/]+/Paper[0-9]+'))::int AS papers
    FROM "Question"
    WHERE "sourceRef" LIKE 'OLEVEL/%'
    GROUP BY 1,2
    ORDER BY 1,2`);
  console.log('\n=== OLEVEL 题库：provenanceTag × status ===');
  console.table(byTag);

  const perPaper = await prisma.$queryRawUnsafe<any[]>(`
    SELECT substring("sourceRef" from '^OLEVEL/[^/]+/Paper[0-9]+') AS paper_key,
           COUNT(*)::int AS questions,
           MAX(length(content->>'passage'))::int AS passage_chars,
           MIN(status::text) AS status
    FROM "Question"
    WHERE "provenanceTag" = 'ai_authored_olevel_1128_simplified'
    GROUP BY 1
    ORDER BY 1`);
  console.log('\n=== simplified 层每卷规模 ===');
  console.table(perPaper);

  const served = await prisma.$queryRawUnsafe<any[]>(`
    SELECT s.level::text AS level, COUNT(*)::int AS sessions,
           MIN(s.date)::text AS first_date, MAX(s.date)::text AS last_date
    FROM "MorningQuizSession" s
    GROUP BY 1 ORDER BY 1`);
  console.log('\n=== 各难度层历史场次 ===');
  console.table(served);

  await prisma.$disconnect();
})().catch(async (e) => {
  console.error(e);
  await prisma.$disconnect();
  process.exit(1);
});
