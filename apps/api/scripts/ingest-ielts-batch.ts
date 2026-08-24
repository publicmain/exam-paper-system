import * as fs from 'fs';
import * as path from 'path';
import { PrismaClient } from '@prisma/client';
import { IeltsIngestService } from '../src/ielts-ingest/ielts-ingest.service';

/**
 * 把自撰的雅思内容批量入库。
 *
 * 两批共用一套逻辑，靠 --batch 区分：
 *   light   → ielts-light-2026（雅思轻量层，250-350 词 + 6 题 + 词表）
 *   authored→ ielts-authored-2026-v6（标准层补料，620-900 词 + 13 题）
 *
 * 复用 IeltsIngestService 而不是自己写字段映射 —— 入库形状必须与既有
 * 剑桥内容完全一致，否则 picker 抽到时渲染器拿到的 content 形状不同，
 * 学生页会白屏（2026-05-26 的 TFNG 事故就是这么来的）。
 *
 * 每篇 fixture 占一个 (testNumber, passageNumber) 坑位：picker 按
 * `IELTS/<book>/Test<n>/P<m>` 前缀把一篇文章聚成一个可抽单元，所以
 * 一篇文章 = 一个 Test 的一个 Passage，序号按文件顺序分配。
 *
 * 幂等：sourceRef 已存在的题跳过。
 *
 *   演练：DATABASE_URL=... npx ts-node apps/api/scripts/ingest-ielts-batch.ts --batch light
 *   执行：... --batch light --apply
 */

const BATCHES = {
  light: {
    dir: 'ielts-light-2026',
    bookCode: 'ielts_light_2026',
    tag: 'ai_authored_ielts_light',
    label: '雅思轻量层',
  },
  authored: {
    dir: 'ielts-authored-2026-v6',
    bookCode: 'ielts_authored_2026_v6',
    tag: 'ai_authored_ielts_2026',
    label: '雅思标准层补料',
  },
} as const;

function arg(name: string): string | undefined {
  const i = process.argv.indexOf(`--${name}`);
  return i >= 0 ? process.argv[i + 1] : undefined;
}

(async () => {
  const key = (arg('batch') ?? '') as keyof typeof BATCHES;
  if (!BATCHES[key]) throw new Error(`--batch 必须是 ${Object.keys(BATCHES).join(' / ')}`);
  const CFG = BATCHES[key];
  const APPLY = process.argv.includes('--apply');

  // 直接实例化而不是起整个 Nest app context —— 后者会把所有模块的
  // 依赖一并初始化并各开一份连接，跑脚本时很容易顶到 Railway Postgres
  // 的连接上限（2026-08-24 就是这么连不上的）。IeltsIngestService 只
  // 依赖 PrismaService，new 一个就够。与 ingest-basic-band.ts 同一路子。
  const prisma = new PrismaClient();
  const ingest = new IeltsIngestService(prisma as any);

  const dir = path.join(__dirname, '..', 'test-fixtures', CFG.dir);
  const files = fs.readdirSync(dir).filter((f) => f.endsWith('.json')).sort();

  const admin = await prisma.user.findFirst({
    where: { role: 'admin', isActive: true },
    select: { id: true, email: true },
  });
  if (!admin) throw new Error('找不到 admin');

  console.log(`\n=== ${CFG.label}入库 ${APPLY ? '(执行)' : '(演练)'} —— ${files.length} 篇 ===\n`);

  let n = 0;
  for (const f of files) {
    n++;
    const d = JSON.parse(fs.readFileSync(path.join(dir, f), 'utf-8'));
    // 一篇文章 = 一个 Test 的 P1。用 Test 序号区分篇目，让每篇都成为
    // picker 眼里独立的可抽单元。
    const testNumber = n;
    const passageNumber = 1;
    const prefix = `IELTS/${CFG.bookCode}/Test${testNumber}/P${passageNumber}`;
    const existing = await prisma.question.count({ where: { sourceRef: { startsWith: `${prefix}/Q` } } });

    if (!APPLY) {
      console.log(`  ${f.padEnd(30)} → ${prefix}  ${d.questions.length} 题（库中已有 ${existing}）`);
      continue;
    }

    const r = await ingest.ingestPassage(
      {
        bookCode: CFG.bookCode,
        provenanceTag: CFG.tag,
        testNumber,
        passageNumber,
        passage: { title: d.passageTitle, body: d.passage },
        questions: d.questions.map((q: any) => ({
          n: q.n,
          questionType: q.questionType,
          taskType: q.taskType,
          instruction: q.instruction,
          // fixture 里字段叫 item（题干条目），ingest 接口要 stem
          stem: q.item,
          options: null,
          answer: String(q.answer),
        })),
      },
      { id: admin.id },
    );
    // 入库是 draft —— picker 只抽 active，不 approve 等于白入。
    const a = await ingest.approveBySourceRefPrefix(r.sourceRefPrefix);
    console.log(
      `  ${f.padEnd(30)} → ${prefix}  created=${r.created} skipped=${r.skipped} approved=${a.promoted}(已active ${a.alreadyActive})`,
    );
  }

  if (APPLY) {
    const rows = await prisma.$queryRawUnsafe<any[]>(
      `SELECT substring("sourceRef" from '^IELTS/[^/]+/Test[0-9]+/P[0-9]+') AS passage_key,
              COUNT(*)::int AS questions, MIN(status::text) AS status
       FROM "Question" WHERE "provenanceTag" = $1
       GROUP BY 1 ORDER BY 1`,
      CFG.tag,
    );
    console.log(`\n=== ${CFG.tag} 桶现状 ===`);
    console.table(rows);
  } else {
    console.log('\n以上为演练，加 --apply 才写库。\n');
  }

  await prisma.$disconnect();
  process.exit(0);
})().catch((e) => {
  console.error(e?.message ?? e);
  process.exit(1);
});
