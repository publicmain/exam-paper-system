import * as fs from 'fs';
import * as path from 'path';
import { PrismaClient } from '@prisma/client';
import { OlevelIngestService } from '../src/olevel-ingest/olevel-ingest.service';

/**
 * 把 O-Level fixture 入库并 approve。
 *
 * 复用 OlevelIngestService 本身（而不是重写一份字段映射）—— 入库形状
 * 必须和既有题库完全一致，否则 picker 抽到新卷子时渲染器拿到的 content
 * 形状不同，学生页会白屏。
 *
 * 幂等：sourceRef 已存在的题跳过。
 *
 *   演练：DATABASE_URL=... npx ts-node apps/api/scripts/ingest-basic-band.ts
 *   执行：... ingest-basic-band.ts --apply
 *   标准层：... ingest-basic-band.ts --band standard --apply
 */

const DIR = path.join(__dirname, '..', 'test-fixtures', 'singapore-olevel-1128');
const APPLY = process.argv.includes('--apply');
const bandIdx = process.argv.indexOf('--band');
const BAND = (bandIdx >= 0 ? process.argv[bandIdx + 1] : 'basic') as 'basic' | 'standard';
if (BAND !== 'basic' && BAND !== 'standard') throw new Error(`--band 只能是 basic / standard，收到 ${BAND}`);

const BANDS = {
  basic: {
    label: '基础层',
    tag: 'ai_authored_olevel_1128_basic',
    match: (f: string) => f.startsWith('basic-'),
  },
  standard: {
    label: '标准层',
    tag: 'ai_authored_olevel_1128',
    // 本批新增的 43–50；既有 1–42 早已入库，不重扫（幂等也会跳过，但没必要跑）
    match: (f: string) => /^ai-authored-(4[3-9]|50)-/.test(f),
  },
} as const;
const CFG = BANDS[BAND];
const prisma = new PrismaClient();

(async () => {
  const files = fs
    .readdirSync(DIR)
    .filter((f) => f.endsWith('.json') && !f.includes('wordlist') && CFG.match(f))
    .sort();

  console.log(`\n=== ${CFG.label}入库 ${APPLY ? '(执行)' : '(演练)'} —— ${files.length} 篇 ===\n`);

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

  // 收尾校验：只看本批 fixture 落库后的实际状态（标准层桶里已有 42 篇，全列没意义）
  const setCodes = files.map((f) => JSON.parse(fs.readFileSync(path.join(DIR, f), 'utf-8')).setCode);
  const rows = await prisma.$queryRawUnsafe<any[]>(
    `SELECT substring("sourceRef" from '^OLEVEL/[^/]+/Paper[0-9]+') AS paper_key,
            COUNT(*)::int AS questions,
            MIN(status::text) AS status,
            SUM(CASE WHEN "questionType"::text = 'mcq' THEN 1 ELSE 0 END)::int AS mcq
     FROM "Question"
     WHERE "provenanceTag" = $1
       AND substring("sourceRef" from '^OLEVEL/([^/]+)/') = ANY($2::text[])
     GROUP BY 1 ORDER BY 1`,
    CFG.tag,
    setCodes,
  );
  console.log(`\n=== 本批 ${CFG.label}（${CFG.tag}）落库情况 ===`);
  console.table(rows);
  const bucketTotal = await prisma.question.count({ where: { provenanceTag: CFG.tag, status: 'active' as any } });
  console.log(`${CFG.tag} 桶 active 题目合计：${bucketTotal}`);

  if (!APPLY) console.log('\n以上为演练，加 --apply 才写库。\n');
  await prisma.$disconnect();
})().catch(async (e) => {
  console.error(e);
  await prisma.$disconnect();
  process.exit(1);
});
