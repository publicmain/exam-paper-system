import { PrismaClient } from '@prisma/client';
import { isInSyllabus } from '../src/vocab/student-word.service';

/**
 * 清理生词本里超考纲的词（2026-08-14 教师定：只考雅思 / O-Level，
 * 只带 toefl / gre 标签的词不学）。
 *
 * ⚠️ 只删 `wrong_answer` 来源的 —— 那是系统自动塞进去的，塞错了该由
 * 系统收回。`click` 来源的**一律保留**：学生自己点进去的词代表他的
 * 主动求知，哪怕超考纲也不该被系统悄悄删掉（geomagnetic 是我们的
 * 采集规则塞的，magma 是学生自己想学的，性质完全不同）。
 * `teacher_push` 同样保留 —— 老师推的就是老师要的。
 *
 * 关联的 WordReviewLog 由外键级联删除。
 *
 *   演练： DATABASE_URL=... npx ts-node apps/api/scripts/prune-out-of-syllabus-words.ts
 *   执行： ... --apply
 */
const prisma = new PrismaClient();
const APPLY = process.argv.includes('--apply');

(async () => {
  const rows = await prisma.studentWord.findMany({
    where: { sourceType: 'wrong_answer' },
    select: {
      id: true,
      headword: true,
      sourceType: true,
      student: { select: { name: true } },
    },
  });
  const heads = [...new Set(rows.map((r) => r.headword))];
  const entries = await prisma.dictEntry.findMany({
    where: { word: { in: heads } },
    select: { word: true, tag: true, bnc: true },
  });
  const byWord = new Map(entries.map((e) => [e.word, e]));

  const doomed = rows.filter((r) => {
    const e = byWord.get(r.headword);
    // 词典里查不到的不动（可能是屈折形式，另有问题，不在本次范围）
    if (!e || (e.tag ?? []).length === 0) return false;
    return !isInSyllabus(e.tag);
  });

  console.log(`\n=== 超考纲词清理 ${APPLY ? '(执行)' : '(演练)'} ===`);
  console.log(`扫描 wrong_answer 来源 ${rows.length} 条，命中 ${doomed.length} 条\n`);

  const byHead = new Map<string, string[]>();
  for (const d of doomed) {
    if (!byHead.has(d.headword)) byHead.set(d.headword, []);
    byHead.get(d.headword)!.push(d.student.name);
  }
  for (const [w, names] of [...byHead.entries()].sort((a, b) => b[1].length - a[1].length)) {
    const e = byWord.get(w)!;
    console.log(
      `  ${w.padEnd(16)} [${(e.tag ?? []).join(',')}] bnc=${e.bnc ?? '-'} ` +
        `→ ${names.length} 人: ${names.slice(0, 4).join(' ')}${names.length > 4 ? ' …' : ''}`,
    );
  }

  const kept = await prisma.studentWord.count({
    where: { sourceType: { in: ['click', 'teacher_push'] } },
  });
  console.log(`\n保留：click / teacher_push 来源共 ${kept} 条（学生自己点的、老师推的，不动）`);

  if (!APPLY) {
    console.log('\n以上为演练，加 --apply 才写库。\n');
    await prisma.$disconnect();
    return;
  }
  const r = await prisma.studentWord.deleteMany({ where: { id: { in: doomed.map((d) => d.id) } } });
  console.log(`\n已删除 ${r.count} 条。\n`);
  await prisma.$disconnect();
})().catch(async (e) => {
  console.error(e);
  await prisma.$disconnect();
  process.exit(1);
});
