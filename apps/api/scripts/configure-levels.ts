import { PrismaClient } from '@prisma/client';

/**
 * 给班级配置英语等级（ClassEnglishLevel 行）。
 *
 * 等级本身在枚举和 level-registry 里已经定义好，但**没有这张表的行，
 * 这个等级就永远不会排课** —— O-Level 基础层的 5 篇卷子和 50 词词表
 * 从 2026-08-14 备好到 08-24 一场没开过，原因就是这个。
 *
 *   查看：DATABASE_URL=... npx ts-node apps/api/scripts/configure-levels.ts
 *   添加：... --add ielts_light,olevel_intermediate --apply
 *   移除：... --remove olevel_intermediate --apply
 *   指定班级：--class <classId>（默认取名字含 G11 的活跃班）
 *
 * 幂等：已存在的等级不重复添加。
 */

const prisma = new PrismaClient();

function arg(name: string): string | undefined {
  const i = process.argv.indexOf(`--${name}`);
  return i >= 0 ? process.argv[i + 1] : undefined;
}

const LABELS: Record<string, string> = {
  ielts_authentic: '雅思真题',
  ielts_light: '雅思轻量',
  olevel: 'O-Level 标准',
  olevel_intermediate: 'O-Level 进阶',
  ielts_simplified: 'O-Level 基础',
};

(async () => {
  const APPLY = process.argv.includes('--apply');
  const classId = arg('class');
  const cls = classId
    ? await prisma.class.findUnique({ where: { id: classId }, select: { id: true, name: true } })
    : await prisma.class.findFirst({
        where: { name: { contains: 'G11' }, archivedAt: null },
        select: { id: true, name: true },
      });
  if (!cls) throw new Error('找不到班级');

  const current = await prisma.classEnglishLevel.findMany({
    where: { classId: cls.id },
    select: { level: true },
  });
  const have = new Set(current.map((r) => String(r.level)));

  console.log(`\n班级：${cls.name}`);
  console.log('当前启用的等级：');
  for (const l of Object.keys(LABELS)) {
    console.log(`  ${have.has(l) ? '✓' : '·'} ${l.padEnd(20)} ${LABELS[l]}`);
  }

  const toAdd = (arg('add') ?? '').split(',').map((s) => s.trim()).filter(Boolean);
  const toRemove = (arg('remove') ?? '').split(',').map((s) => s.trim()).filter(Boolean);

  for (const l of [...toAdd, ...toRemove]) {
    if (!LABELS[l]) throw new Error(`未知等级 ${l}，可选：${Object.keys(LABELS).join(' / ')}`);
  }

  if (toAdd.length === 0 && toRemove.length === 0) {
    console.log('\n未指定 --add / --remove，仅查看。\n');
    await prisma.$disconnect();
    return;
  }

  console.log('');
  for (const l of toAdd) {
    if (have.has(l)) { console.log(`  · ${l} 已启用，跳过`); continue; }
    if (!APPLY) { console.log(`  + 将启用 ${l}（${LABELS[l]}）`); continue; }
    await prisma.classEnglishLevel.create({
      // effectiveFrom 是必填。用今天：这一行的作用是「从现在起这个班有
      // 这个等级」，排课 cron 只看行在不在，不回溯历史。
      data: { classId: cls.id, level: l as any, effectiveFrom: new Date() },
    });
    console.log(`  ✓ 已启用 ${l}（${LABELS[l]}）`);
  }
  for (const l of toRemove) {
    if (!have.has(l)) { console.log(`  · ${l} 本来就没启用，跳过`); continue; }
    if (!APPLY) { console.log(`  - 将停用 ${l}（${LABELS[l]}）`); continue; }
    await prisma.classEnglishLevel.deleteMany({ where: { classId: cls.id, level: l as any } });
    console.log(`  ✓ 已停用 ${l}（${LABELS[l]}）—— 历史场次不受影响`);
  }

  if (!APPLY) console.log('\n加 --apply 才写库。\n');
  await prisma.$disconnect();
})().catch(async (e) => {
  console.error(e?.message ?? e);
  await prisma.$disconnect();
  process.exit(1);
});
