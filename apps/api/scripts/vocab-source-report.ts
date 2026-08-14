import { PrismaClient } from '@prisma/client';

/**
 * 生词本词从哪来 —— 按来源和按学生看真实分布。
 *
 * 三个来源（VocabSource）：
 *   click        学生在文章里点词加入
 *   wrong_answer 判分后自动采集（词义题目标词 / 填空参考答案）
 *   teacher_push 老师推的词表
 *
 * 只读。
 */
const prisma = new PrismaClient();

(async () => {
  const bySource = await prisma.$queryRawUnsafe<any[]>(`
    SELECT "sourceType"::text AS source, COUNT(*)::int AS words,
           COUNT(DISTINCT "studentId")::int AS students
    FROM "StudentWord" GROUP BY 1 ORDER BY 2 DESC`);
  console.log('\n=== 全库：词的来源分布 ===');
  console.table(bySource);

  // 只看真实在读学生（排除测试班）
  const perStudent = await prisma.$queryRawUnsafe<any[]>(`
    SELECT u.name AS student,
           COUNT(*)::int AS total,
           SUM(CASE WHEN w."sourceType"::text='click' THEN 1 ELSE 0 END)::int AS click,
           SUM(CASE WHEN w."sourceType"::text='wrong_answer' THEN 1 ELSE 0 END)::int AS wrong,
           SUM(CASE WHEN w."sourceType"::text='teacher_push' THEN 1 ELSE 0 END)::int AS pushed,
           SUM(CASE WHEN w.due <= now() AND w.state::text <> 'known' THEN 1 ELSE 0 END)::int AS due_now
    FROM "StudentWord" w
    JOIN "User" u ON u.id = w."studentId"
    JOIN "ClassEnrollment" e ON e."userId" = u.id AND e.role='student'
    JOIN "Class" c ON c.id = e."classId"
    WHERE c.name NOT LIKE '【测试】%' AND c."archivedAt" IS NULL
    GROUP BY u.name ORDER BY total DESC`);
  console.log('\n=== 真实班级：每个学生的生词本 ===');
  console.table(perStudent);

  const rosterSize = await prisma.$queryRawUnsafe<any[]>(`
    SELECT COUNT(DISTINCT u.id)::int AS roster
    FROM "User" u
    JOIN "ClassEnrollment" e ON e."userId"=u.id AND e.role='student'
    JOIN "Class" c ON c.id=e."classId"
    WHERE c.name NOT LIKE '【测试】%' AND c."archivedAt" IS NULL AND u."isActive"`);
  const withWords = perStudent.length;
  console.log(
    `\n在册学生 ${rosterSize[0].roster} 人，其中 ${withWords} 人生词本非空，` +
      `${rosterSize[0].roster - withWords} 人一个词都没有。\n`,
  );

  // 考纲范围审查（2026-08-14 新规）：只带 toefl/gre 标签的词属超考纲
  const outOfScope = await prisma.$queryRawUnsafe<any[]>(`
    SELECT w.headword, d.tag, d.bnc, COUNT(*)::int AS students,
           MIN(w."sourceType"::text) AS src
    FROM "StudentWord" w
    JOIN "DictEntry" d ON d.word = w.headword
    JOIN "User" u ON u.id = w."studentId"
    JOIN "ClassEnrollment" e ON e."userId"=u.id AND e.role='student'
    JOIN "Class" c ON c.id=e."classId"
    WHERE c.name NOT LIKE '【测试】%' AND c."archivedAt" IS NULL
      AND NOT ('ielts' = ANY(d.tag))
      AND NOT EXISTS (
        SELECT 1 FROM unnest(d.tag) t WHERE t NOT IN ('toefl','gre'))
      AND array_length(d.tag,1) > 0
    GROUP BY 1,2,3 ORDER BY students DESC, 1`);
  console.log('');
  console.log('=== 超考纲的词（只带 toefl/gre，真实班级）===');
  if (outOfScope.length === 0) console.log('  无');
  else {
    console.table(outOfScope);
    const tot = outOfScope.reduce((n, r) => n + r.students, 0);
    console.log(`  ${outOfScope.length} 个词，共占 ${tot} 条学生记录`);
  }

  await prisma.$disconnect();
})().catch(async (e) => {
  console.error(e);
  await prisma.$disconnect();
  process.exit(1);
});
