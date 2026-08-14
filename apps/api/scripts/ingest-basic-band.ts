import * as fs from 'fs';
import * as path from 'path';
import { PrismaClient } from '@prisma/client';
import { OlevelIngestService } from '../src/olevel-ingest/olevel-ingest.service';

/**
 * 把基础层 fixture 入库并 approve。
 *
 * 复用 OlevelIngestService 本身（而不是重写一份字段映射）—— 入库形状
 * 必须和既有 21 篇 simplified 完全一致，否则 picker 抽到基础层卷子时
 * 渲染器拿到的 content 形状不同，学生页会白屏。
 *
 * 幂等：sourceRef 已存在的题跳过。
 *
 *   演练：DATABASE_URL=... npx ts-node apps/api/scripts/ingest-basic-band.ts
 *   执行：... ingest-basic-band.ts --apply
 */

const DIR = path.join(__dirname, '..', 'test-fixtures', 'singapore-olevel-1128');
const APPLY = process.argv.includes('--apply');
const prisma = new PrismaClient();

(async () => {
  const files = fs
    .readdirSync(DIR)
    .filter((f) => f.startsWith('basic-') && f.endsWith('.json'))
    .sort();

  console.log(`\n=== 基础层入库 ${APPLY ? '(执行)' : '(演练)'} —— ${files.length} 篇 ===\n`);

  // 用一个真实 admin 作为 createdById（外键要求）。
  const admin = await prisma.user.findFirst({
    where: { role: 'admin', isActive: true },
    select: { id: true, email: true },
  });
  if (!admin) throw new Error('找不到 admin 用户，无法作为 createdById');
  console.log(`createdById = ${admin.email}\n`);

  const svc = new OlevelIngestService(prisma as any);

  for (const f of files) {
    const input = JSON.parse(fs.readFileSync(path.join(DIR, f), 'utf-8'));
    const prefix = `OLEVEL/${input.setCode}/Paper${input.paperNumber}`;

    const existing = await prisma.question.count({
      where: { sourceRef: { startsWith: `${prefix}/Q` } },
    });

    if (!APPLY) {
      const qs = input.sections.reduce((n: number, s: any) => n + s.questions.length, 0);
      console.log(`  ${f}: 将写入 ${qs} 题 → ${prefix}（库中已有 ${existing} 题）`);
      continue;
    }

    const r = await svc.ingestPaper(input, { id: admin.id });
    const a = await svc.approveByPrefix(r.sourceRefPrefix);
    console.log(
      `  ${f}: created=${r.created} skipped=${r.skipped} → approved=${a.promoted} (已 active ${a.alreadyActive})`,
    );
  }

  // 收尾校验：basic 桶的实际状态
  const rows = await prisma.$queryRawUnsafe<any[]>(`
    SELECT substring("sourceRef" from '^OLEVEL/[^/]+/Paper[0-9]+') AS paper_key,
           COUNT(*)::int AS questions,
           MIN(status::text) AS status,
           SUM(CASE WHEN "questionType"::text = 'mcq' THEN 1 ELSE 0 END)::int AS mcq
    FROM "Question"
    WHERE "provenanceTag" = 'ai_authored_olevel_1128_basic'
    GROUP BY 1 ORDER BY 1`);
  console.log('\n=== basic 桶现状 ===');
  console.table(rows);

  if (!APPLY) console.log('\n以上为演练，加 --apply 才写库。\n');
  await prisma.$disconnect();
})().catch(async (e) => {
  console.error(e);
  await prisma.$disconnect();
  process.exit(1);
});
