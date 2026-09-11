/**
 * 只读运维体检（OPS03 / OPS04，2026-09-11）：
 *
 *   1. 卡住的内容任务 —— VocabularyContentJob 停在 running 超过阈值，
 *      多半是 worker 崩了、状态没收尾。
 *   2. 未来几个教学日的内容覆盖 —— 从今天起 N 个教学日（跳过周末），
 *      五档卷子是不是都已经发布、每个试点班当天是不是都有一场。
 *
 * 只做 SELECT，不写库。不打印学生姓名或作答原文。
 *
 *   railway run -s Postgres -e production -- \
 *     npx ts-node apps/api/scripts/ops/daily-ops-check.ts --days=5 --stuck-min=30
 *
 * 退出码：发现问题时非零（给值班脚本/cron 判断用），发现纯粹的「今天还没发」
 * 不算问题（当天可能还没到发布时间）。
 */
// `railway run` only injects the *internal* DATABASE_URL (postgres.railway.internal),
// which this machine can't reach — same fix as the other read-only audit scripts
// and prepare-pilot-week.js's publishConnectionUrl: read from DATABASE_PUBLIC_URL
// (the TCP proxy) instead, before Prisma ever resolves its datasource url. Falls
// through to DATABASE_URL unchanged for local/PGlite runs where it's already public.
if (process.env.DATABASE_PUBLIC_URL) {
  const u = new URL(process.env.DATABASE_PUBLIC_URL);
  u.searchParams.set('connect_timeout', '30');
  u.searchParams.set('socket_timeout', '60');
  u.searchParams.set('application_name', 'ops-daily-check');
  process.env.DATABASE_URL = u.toString();
}

import { PrismaClient } from '@prisma/client';

// eslint-disable-next-line @typescript-eslint/no-var-requires
const prep = require('../pilot/prepare-pilot-week');
// eslint-disable-next-line @typescript-eslint/no-var-requires
const content = require('../pilot/content');

const arg = (name: string, fallback: string) => process.argv.find((a) => a.startsWith(`--${name}=`))?.slice(name.length + 3) ?? fallback;
const DAYS = Number(arg('days', '5'));
const STUCK_MIN = Number(arg('stuck-min', '30'));

/** 今天起 N 个教学日（周一到周五；今天算第一天）。与发布脚本的 SGT 口径一致——这里用日历日期字符串，不涉及时区换算。 */
export function nextTeachingDays(fromIso: string, n: number): string[] {
  const out: string[] = [];
  const d = new Date(`${fromIso}T00:00:00Z`);
  while (out.length < n) {
    const dow = d.getUTCDay(); // 0=Sun .. 6=Sat
    if (dow !== 0 && dow !== 6) out.push(d.toISOString().slice(0, 10));
    d.setUTCDate(d.getUTCDate() + 1);
  }
  return out;
}

function todaySgtIso(): string {
  // SGT = UTC+8，足够这个巡检脚本用；不追求和发布脚本的 sgtInstant 逐毫秒一致。
  const now = new Date(Date.now() + 8 * 3600 * 1000);
  return now.toISOString().slice(0, 10);
}

async function checkStuckJobs(prisma: PrismaClient) {
  const cutoff = new Date(Date.now() - STUCK_MIN * 60 * 1000);
  const stuck = await prisma.vocabularyContentJob.findMany({
    where: { status: 'running', startedAt: { lt: cutoff } },
    select: { id: true, senseId: true, provider: true, startedAt: true, attempts: true },
    orderBy: { startedAt: 'asc' },
    take: 50,
  });
  return stuck.map((j) => ({
    id: j.id,
    senseId: j.senseId,
    provider: j.provider,
    attempts: j.attempts,
    runningForMin: j.startedAt ? Math.round((Date.now() - j.startedAt.getTime()) / 60000) : null,
  }));
}

async function checkContentCoverage(prisma: PrismaClient, days: string[]) {
  const levels = Object.keys(content.LEVELS);
  const classIds: string[] = prep.ALL_CLASSES.map((c: { id: string }) => c.id);
  const out: Array<{
    day: string;
    hasLocalContent: boolean;
    publishedLevels: string[];
    missingLevels: string[];
    sessionsExpected: number;
    sessionsFound: number;
    classesMissingASession: string[];
  }> = [];

  for (const day of days) {
    const hasLocalContent = levels.every((lv) => Boolean(content.lessonFor(lv, day)));
    const paperIds = levels.map((lv) => `${prep.PREFIX}${lv}_${day.replace(/-/g, '')}_paper`);
    const papers = await prisma.paper.findMany({ where: { id: { in: paperIds } }, select: { id: true } });
    const publishedIds = new Set(papers.map((p) => p.id));
    const publishedLevels = levels.filter((lv, i) => publishedIds.has(paperIds[i]));
    const missingLevels = levels.filter((lv, i) => !publishedIds.has(paperIds[i]));

    const sessions = await prisma.morningQuizSession.findMany({
      where: { date: new Date(`${day}T00:00:00.000Z`), classId: { in: classIds }, id: { startsWith: prep.PREFIX } },
      select: { classId: true, level: true },
    });
    const have = new Set(sessions.map((s) => `${s.classId}/${s.level}`));
    const classesMissingASession = classIds.filter((cid) => !levels.some((lv) => have.has(`${cid}/${lv}`)));

    out.push({
      day,
      hasLocalContent,
      publishedLevels,
      missingLevels,
      sessionsExpected: classIds.length * levels.length,
      sessionsFound: sessions.length,
      classesMissingASession,
    });
  }
  return out;
}

async function main() {
  const prisma = new PrismaClient();
  try {
    await prisma.$executeRawUnsafe('SET SESSION CHARACTERISTICS AS TRANSACTION READ ONLY');
    const today = todaySgtIso();
    const days = nextTeachingDays(today, DAYS);

    const stuck = await checkStuckJobs(prisma);
    const coverage = await checkContentCoverage(prisma, days);

    console.log(`\n== 卡住的内容任务（running 超过 ${STUCK_MIN} 分钟） ==`);
    if (!stuck.length) console.log('  无');
    else for (const j of stuck) console.log(`  ${j.id}  sense=${j.senseId}  provider=${j.provider}  跑了 ${j.runningForMin} 分钟  attempts=${j.attempts}`);

    console.log(`\n== 未来 ${DAYS} 个教学日内容覆盖（今天起，跳过周末）==`);
    let hasGap = false;
    for (const c of coverage) {
      const isToday = c.day === today;
      const status = c.missingLevels.length === 0 ? '已发布 ✓' : c.hasLocalContent ? '本地有内容、还没发布' : '本地也没有内容 ✗';
      if (c.missingLevels.length && (!isToday || c.hasLocalContent)) hasGap = true;
      console.log(`  ${c.day}${isToday ? '（今天）' : ''}: ${status}`);
      if (c.missingLevels.length) console.log(`      缺档位：${c.missingLevels.join('、')}`);
      console.log(`      场次：${c.sessionsFound} / ${c.sessionsExpected}${c.classesMissingASession.length ? `（缺场次的班：${c.classesMissingASession.join('、')}）` : ''}`);
    }

    if (stuck.length || hasGap) {
      console.log('\n发现问题（退出码非零）。');
      process.exitCode = 1;
    } else {
      console.log('\n一切正常。');
    }
  } finally {
    await prisma.$disconnect();
  }
}

if (require.main === module) {
  main().catch((e) => {
    console.error('FAILED', e && e.message);
    process.exit(2);
  });
}
