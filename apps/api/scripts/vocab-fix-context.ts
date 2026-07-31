/**
 * 修复生词条目的上下文句：把「取自题干」的旧数据改成「取自文章原文」。
 *
 * 背景：P4 上线后拿真实数据做端到端验证时发现，早先回填的条目把**题干**
 * 存成了上下文，导致复习卡挖空挖的是题目里的引用词
 *   "What does the word '___' in 'frail now, her back curved…' suggest?"
 * 学生看到的是一道题而不是自然语境。修复逻辑见 contextFor()。
 *
 * 幂等：只更新「当前上下文明显是题干」的行（含 "What does the word" /
 * "From Paragraph" / 以 Qn. 开头等特征），已经是原文句的不动。
 *
 * 用法：DATABASE_URL=... npx ts-node scripts/vocab-fix-context.ts [--dry]
 */
import { PrismaClient } from '@prisma/client';
import { contextFor } from '../src/vocab/student-word.service';

const prisma = new PrismaClient();

// 需要修的两类脏数据：
//   ① 上下文其实是题干（"What does the word…"）
//   ② 上下文夹带段落标记或换行（旧切分器的缺陷，会把 "Paragraph 1" 带进卡片）
const NEEDS_FIX =
  /what does the word|what does the phrase|from paragraph|^q\d+[.(]|\[\d+\]|using your own words|paragraph\s+[0-9]|\n/i;

(async () => {
  const dry = process.argv.includes('--dry');
  const rows = await prisma.studentWord.findMany({
    where: { sourcePaperQuestionId: { not: null } },
    select: {
      id: true,
      headword: true,
      surfaceForm: true,
      contextSentence: true,
      sourcePaperQuestionId: true,
    },
  });
  console.log(`候选条目: ${rows.length}${dry ? ' [DRY RUN]' : ''}`);

  let fixed = 0;
  let skipped = 0;
  for (const r of rows) {
    if (!NEEDS_FIX.test(r.contextSentence)) {
      skipped++;
      continue;
    }
    const pq = await prisma.paperQuestion.findUnique({
      where: { id: r.sourcePaperQuestionId! },
      select: { snapshotContent: true },
    });
    const sc = (pq?.snapshotContent ?? {}) as Record<string, unknown>;
    const passage = typeof sc.passage === 'string' ? sc.passage : '';
    const stem = typeof sc.stem === 'string' ? sc.stem : '';
    const next = contextFor(passage, stem, r.surfaceForm || r.headword);
    if (!next || next === r.contextSentence) {
      skipped++;
      continue;
    }
    console.log(`  ${r.headword.padEnd(12)} → ${next.slice(0, 72)}`);
    if (!dry) {
      await prisma.studentWord.update({
        where: { id: r.id },
        data: { contextSentence: next.slice(0, 500) },
      });
    }
    fixed++;
  }
  console.log(`\n修复 ${fixed} 条，跳过 ${skipped} 条`);
  await prisma.$disconnect();
})().catch(async (e) => {
  console.error('ERR', e?.message ?? e);
  await prisma.$disconnect();
  process.exit(1);
});
