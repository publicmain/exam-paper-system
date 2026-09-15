/**
 * 学习周报快照（2026-09-15）—— 用生产数据在**只读事务**里算一遍周报，存成 JSON。
 *
 * 用途：上线前在本机看新页面的真实效果、核对数字（和每周手工出的 PDF 对得上），
 * 而不在本机启动连生产库的 API（API 一启动定时任务就会往库里写）。
 *
 *   railway run -s Postgres -e production -- node node_modules/ts-node/dist/bin.js --transpile-only \
 *     apps/api/scripts/learning-report-snapshot.ts --weeks=2026-09-07,2026-09-14 --out=.local/reports/learning-report-snapshot.json
 *
 * 每一周算「全部班级」加每个班各一份，键是 `<周一>|<classId 或 all>`。
 * 整个过程包在 `SET TRANSACTION READ ONLY` 里：任何写操作都会被数据库直接拒绝。
 * 输出含学生姓名和成绩，只放本机 `.local/`（不进仓库）。
 */
import { writeFileSync } from 'node:fs';
import { PrismaClient } from '@prisma/client';
import { LearningReportService } from '../src/learning-report/learning-report.service';

if (process.env.DATABASE_PUBLIC_URL) {
  const u = new URL(process.env.DATABASE_PUBLIC_URL);
  u.searchParams.set('connect_timeout', '30');
  u.searchParams.set('socket_timeout', '60');
  u.searchParams.set('connection_limit', '1');
  u.searchParams.set('application_name', 'learning-report-snapshot-readonly');
  process.env.DATABASE_URL = u.toString();
}

const arg = (name: string) => process.argv.find((a) => a.startsWith(`--${name}=`))?.slice(name.length + 3);
const weeks = (arg('weeks') ?? '').split(',').map((s) => s.trim()).filter(Boolean);
const out = arg('out') ?? '.local/reports/learning-report-snapshot.json';
if (!weeks.length) throw new Error('--weeks=YYYY-MM-DD[,YYYY-MM-DD] 必填');

const ADMIN = { id: 'snapshot-readonly', role: 'admin' };

(async () => {
  const prisma = new PrismaClient();
  const result: Record<string, unknown> = {};
  try {
    for (const week of weeks) {
      await prisma.$transaction(
        async (tx) => {
          await tx.$executeRawUnsafe('SET TRANSACTION READ ONLY');
          const svc = new LearningReportService(tx as never);
          const all = await svc.weekly(ADMIN, { weekStart: week, classId: null });
          result[`${all.weekStart}|all`] = all;
          for (const c of all.classes) {
            result[`${all.weekStart}|${c.id}`] = await svc.weekly(ADMIN, { weekStart: week, classId: c.id });
          }
          console.log(`${all.weekStart}：${all.classes.length} 个班，全部 ${all.totals.students} 人，整周没做 ${all.totals.none}，阅读完成率 ${all.totals.readRate ?? '—'}%`);
        },
        { timeout: 180_000, maxWait: 30_000 },
      );
    }
  } finally {
    await prisma.$disconnect();
  }
  writeFileSync(out, JSON.stringify(result));
  console.log(`写到 ${out}（${Object.keys(result).length} 份）`);
})().catch((e) => {
  console.error(String((e as Error)?.message ?? e).split('\n').slice(-3).join('\n'));
  process.exit(1);
});
