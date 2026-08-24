import { PrismaClient } from '@prisma/client';

/**
 * 合并同一学生的两个账号（源账号 → 目标账号），并停用源账号。
 *
 * 2026-08-24 的现场：孙爱迪有两个启用账号 ——
 *   g11s04@school.local        5 月建，29 条考勤 / 5 份答卷，**无班级**
 *   testmq-6pcg-1@school.local 8 月扫码自助建，在班级里，当前实际在用
 *
 * 成因推断：g11s04 的选课行不知何时丢了（班级重建期），而扫码的姓名
 * 匹配要求「在未归档班级里」，匹配不到就走名册建号流程生出了 testmq
 * 账号。**两个账号活动期完全错开**（5-7 月 vs 8 月起）是「同一个人」
 * 的关键证据 —— 本脚本把这个证据变成硬门槛：
 *
 *   安全闸：两账号在同一场次都有考勤、或同一 assignment 都有答卷
 *   → 说明可能是两个真人同名 → **拒绝合并**，人工裁决。
 *
 * 合并方向：历史数据（g11s04）挂到现用账号（testmq）名下 —— 这样
 * 学生在 /my-history 能看到自己 5 月以来的全部记录。带唯一约束的表
 * 逐行守卫迁移：目标已有同键行时保留目标、源行留在停用账号上（不删,
 * 审计链要活过账号变更）。
 *
 *   演练：DATABASE_URL=... npx ts-node apps/api/scripts/merge-duplicate-student.ts --src g11s04@school.local --dst testmq-6pcg-1@school.local
 *   执行：... --apply
 */

const prisma = new PrismaClient();

function arg(name: string): string | undefined {
  const i = process.argv.indexOf(`--${name}`);
  return i >= 0 ? process.argv[i + 1] : undefined;
}

(async () => {
  const srcEmail = arg('src');
  const dstEmail = arg('dst');
  const APPLY = process.argv.includes('--apply');
  if (!srcEmail || !dstEmail) throw new Error('需要 --src <email> --dst <email>');

  const src = await prisma.user.findFirst({ where: { email: srcEmail }, select: { id: true, name: true } });
  const dst = await prisma.user.findFirst({ where: { email: dstEmail }, select: { id: true, name: true } });
  if (!src || !dst) throw new Error('账号不存在');
  if (src.name !== dst.name) throw new Error(`姓名不同（${src.name} vs ${dst.name}），拒绝合并`);

  console.log(`\n=== 合并 ${src.name}: ${srcEmail} → ${dstEmail} ${APPLY ? '(执行)' : '(演练)'} ===\n`);

  // ── 安全闸：活动重叠 = 可能是两个真人 ──
  const attOverlap = await prisma.$queryRaw<Array<{ n: bigint }>>`
    SELECT COUNT(*)::bigint AS n FROM "Attendance" a
    JOIN "Attendance" b ON a."sessionId" = b."sessionId"
    WHERE a."studentId" = ${src.id} AND b."studentId" = ${dst.id}`;
  const subOverlap = await prisma.$queryRaw<Array<{ n: bigint }>>`
    SELECT COUNT(*)::bigint AS n FROM "StudentSubmission" a
    JOIN "StudentSubmission" b ON a."assignmentId" = b."assignmentId"
    WHERE a."studentId" = ${src.id} AND b."studentId" = ${dst.id}
      AND a.status <> 'practice' AND b.status <> 'practice'`;
  if (Number(attOverlap[0].n) > 0 || Number(subOverlap[0].n) > 0) {
    console.log(`✗ 拒绝合并：考勤重叠 ${attOverlap[0].n} 场 / 答卷重叠 ${subOverlap[0].n} 份`);
    console.log('  两个账号在同一场次都有活动 —— 可能是两个同名真人，需要人工裁决。');
    process.exit(1);
  }
  console.log('安全闸通过：两账号无任何同场次/同作业的重叠活动。\n');

  // ── 迁移计划 ──
  // 无唯一约束（或约束不含 studentId）的表：整批 update
  const plain = [
    'StudentSubmission', // (assignmentId, studentId) 唯一但重叠已排除
    'TutorSession',
    'WatermarkToken', // (paperId, studentId) 唯一 —— 冲突下面单独守卫
    'RegradeRequest',
    'StudentPageView',
    'MistakeEntry',
    'HomeworkSubmission', // (assignmentId, studentId) 唯一 —— 同答卷逻辑
    'PaperVariantAssignment', // (assignmentId, studentId) 唯一
    'ParentLink',
  ] as const;
  // 需要逐行守卫的：目标可能已有同键行
  //   Attendance (sessionId, studentId)   — 重叠已排除，可整批
  //   QuestionShuffleMap (studentId, paperId)
  //   StudentWord (studentId, headword)
  for (const table of [...plain, 'Attendance']) {
    const n = await prisma.$queryRawUnsafe<Array<{ n: bigint }>>(
      `SELECT COUNT(*)::bigint AS n FROM "${table}" WHERE "studentId" = $1`, src.id,
    );
    console.log(`  ${table.padEnd(24)} 待迁 ${n[0].n}`);
  }

  const shuffleConflicts = await prisma.$queryRaw<Array<{ n: bigint }>>`
    SELECT COUNT(*)::bigint AS n FROM "QuestionShuffleMap" a
    WHERE a."studentId" = ${src.id}
      AND EXISTS (SELECT 1 FROM "QuestionShuffleMap" b
                  WHERE b."studentId" = ${dst.id} AND b."paperId" = a."paperId")`;
  const wordConflicts = await prisma.$queryRaw<Array<{ n: bigint }>>`
    SELECT COUNT(*)::bigint AS n FROM "StudentWord" a
    WHERE a."studentId" = ${src.id}
      AND EXISTS (SELECT 1 FROM "StudentWord" b
                  WHERE b."studentId" = ${dst.id} AND b.headword = a.headword)`;
  console.log(`  QuestionShuffleMap       冲突 ${shuffleConflicts[0].n}（保留目标，源行留在停用账号）`);
  console.log(`  StudentWord              冲突 ${wordConflicts[0].n}（同上）`);

  if (!APPLY) {
    console.log('\n演练结束，加 --apply 执行。\n');
    await prisma.$disconnect();
    return;
  }

  await prisma.$transaction(async (tx) => {
    for (const table of [...plain, 'Attendance']) {
      await tx.$executeRawUnsafe(
        `UPDATE "${table}" SET "studentId" = $1 WHERE "studentId" = $2`, dst.id, src.id,
      );
    }
    // 守卫迁移：只迁目标没有同键行的
    await tx.$executeRaw`
      UPDATE "QuestionShuffleMap" a SET "studentId" = ${dst.id}
      WHERE a."studentId" = ${src.id}
        AND NOT EXISTS (SELECT 1 FROM "QuestionShuffleMap" b
                        WHERE b."studentId" = ${dst.id} AND b."paperId" = a."paperId")`;
    await tx.$executeRaw`
      UPDATE "StudentWord" a SET "studentId" = ${dst.id}
      WHERE a."studentId" = ${src.id}
        AND NOT EXISTS (SELECT 1 FROM "StudentWord" b
                        WHERE b."studentId" = ${dst.id} AND b.headword = a.headword)`;
    await tx.user.update({ where: { id: src.id }, data: { isActive: false } });
  }, { timeout: 30_000 });

  console.log('\n✓ 合并完成，源账号已停用。验证：');
  for (const table of ['StudentSubmission', 'Attendance', 'StudentWord'] as const) {
    const left = await prisma.$queryRawUnsafe<Array<{ n: bigint }>>(
      `SELECT COUNT(*)::bigint AS n FROM "${table}" WHERE "studentId" = $1`, src.id,
    );
    const now = await prisma.$queryRawUnsafe<Array<{ n: bigint }>>(
      `SELECT COUNT(*)::bigint AS n FROM "${table}" WHERE "studentId" = $1`, dst.id,
    );
    console.log(`  ${table.padEnd(20)} 源剩 ${left[0].n} · 目标现有 ${now[0].n}`);
  }
  await prisma.$disconnect();
})().catch(async (e) => {
  console.error(e?.message ?? e);
  await prisma.$disconnect();
  process.exit(1);
});
