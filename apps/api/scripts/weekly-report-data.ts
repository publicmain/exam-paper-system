import { PrismaClient } from '@prisma/client';

/**
 * 周报数据汇总（2026-08-13 起）。
 *
 * 周报本来是每周手工整理的。老师 2026-08-13 提出要在周报里体现
 * 「判分之后到底有多少人回来看自己的成绩 / 错题 / 生词」—— 这个脚本
 * 把周报需要的全部数字一次性算好，避免每周重新拼 SQL 拼错。
 *
 * 输出四块：
 *   1. 成绩：每人得分率、参加场次（原有周报口径）
 *   2. **参与度**：交卷之后有多少人回来看（新增，老师的第二问）
 *   3. 迟到与放弃：按到达时间分组的空白率（支撑补做功能的效果验证）
 *   4. 错题本：收录量与题型分布
 *
 *   SINCE=2026-08-11 UNTIL=2026-08-14 \
 *     npx ts-node apps/api/scripts/weekly-report-data.ts
 */

const CLASS_ID = process.env.CLASS_ID ?? 'cmoux0jj900m9oc28r4sptjj0';
const SINCE = process.env.SINCE ?? '2026-08-11';
const UNTIL = process.env.UNTIL ?? '2026-08-14';

const prisma = new PrismaClient();
const pct = (a: number, b: number) => (b ? ((a / b) * 100).toFixed(1) + '%' : '—');

(async () => {
  console.log(`\n═══ G11 早测周报数据 · ${SINCE} — ${UNTIL} ═══\n`);

  // ── 1. 成绩 ──────────────────────────────────────────────
  const scores = await prisma.$queryRaw<
    Array<{ name: string; lvl: string; n: number; ts: number; ms: number }>
  >`
    SELECT u.name, s.level::text AS lvl, COUNT(*)::int AS n,
           SUM(sub."totalScore")::float AS ts, SUM(sub."maxScore")::float AS ms
    FROM "MorningQuizSession" s
    JOIN "PaperAssignment" pa ON pa.id = s."paperAssignmentId"
    JOIN "StudentSubmission" sub ON sub."assignmentId" = pa.id
    JOIN "User" u ON u.id = sub."studentId"
    WHERE s."classId" = ${CLASS_ID}
      AND s."date" BETWEEN ${SINCE}::date AND ${UNTIL}::date
      AND sub.status = 'marked'
    GROUP BY u.name, s.level
    ORDER BY (SUM(sub."totalScore") / NULLIF(SUM(sub."maxScore"), 0)) DESC NULLS LAST`;
  console.log('【1】成绩（按得分率）');
  for (const r of scores) {
    console.log(
      `  ${r.name.padEnd(18)} ${r.lvl.padEnd(16)} ${r.n}场  ${r.ts}/${r.ms}  ${pct(r.ts, r.ms)}`,
    );
  }

  // ── 2. 参与度：判分后有多少人回来看 ──────────────────────
  console.log('\n【2】判分后的回看情况（老师第二问）');
  const views = await prisma.$queryRaw<Array<{ kind: string; students: number; hits: number }>>`
    SELECT v.kind::text AS kind,
           COUNT(DISTINCT v."studentId")::int AS students,
           SUM(v.hits)::int AS hits
    FROM "StudentPageView" v
    WHERE v."day" BETWEEN ${SINCE} AND ${UNTIL}
      AND EXISTS (SELECT 1 FROM "ClassEnrollment" e
                  WHERE e."userId" = v."studentId" AND e."classId" = ${CLASS_ID})
    GROUP BY 1 ORDER BY 2 DESC`;
  const KIND_LABEL: Record<string, string> = {
    history: '打开成绩列表',
    submission_detail: '点进逐题详情（真在复盘）',
    vocab: '打开生词本',
    vocab_practice: '做了生词自测/复习',
    mistakes: '打开错题本',
  };
  const submitters = await prisma.$queryRaw<Array<{ n: number }>>`
    SELECT COUNT(DISTINCT sub."studentId")::int AS n
    FROM "MorningQuizSession" s
    JOIN "PaperAssignment" pa ON pa.id = s."paperAssignmentId"
    JOIN "StudentSubmission" sub ON sub."assignmentId" = pa.id
    WHERE s."classId" = ${CLASS_ID}
      AND s."date" BETWEEN ${SINCE}::date AND ${UNTIL}::date
      AND sub.status IN ('submitted', 'marked', 'locked')`;
  const denom = submitters[0]?.n ?? 0;
  console.log(`  本周交卷人数（分母）: ${denom}`);
  if (views.length === 0) {
    console.log('  （本周无埋点数据 —— 埋点 2026-08-13 才上线，下周起才有完整一周）');
  }
  for (const v of views) {
    console.log(
      `  ${(KIND_LABEL[v.kind] ?? v.kind).padEnd(26)} ${String(v.students).padStart(2)} 人 ` +
        `(${pct(v.students, denom)})  共 ${v.hits} 次`,
    );
  }

  const never = await prisma.$queryRaw<Array<{ name: string; subs: number; views: number }>>`
    SELECT u.name, COUNT(DISTINCT sub.id)::int AS subs,
           COALESCE((SELECT SUM(v.hits)::int FROM "StudentPageView" v
                     WHERE v."studentId" = u.id AND v."day" BETWEEN ${SINCE} AND ${UNTIL}
                       AND v.kind IN ('submission_detail','mistakes','vocab_practice')), 0) AS views
    FROM "ClassEnrollment" e
    JOIN "User" u ON u.id = e."userId"
    JOIN "MorningQuizSession" s ON s."classId" = e."classId"
    JOIN "PaperAssignment" pa ON pa.id = s."paperAssignmentId"
    JOIN "StudentSubmission" sub ON sub."assignmentId" = pa.id AND sub."studentId" = u.id
    WHERE e."classId" = ${CLASS_ID}
      AND s."date" BETWEEN ${SINCE}::date AND ${UNTIL}::date
      AND sub.status IN ('submitted','marked','locked')
    GROUP BY u.id, u.name
    HAVING COALESCE((SELECT SUM(v.hits)::int FROM "StudentPageView" v
                     WHERE v."studentId" = u.id AND v."day" BETWEEN ${SINCE} AND ${UNTIL}
                       AND v.kind IN ('submission_detail','mistakes','vocab_practice')), 0) = 0
    ORDER BY subs DESC`;
  if (never.length) {
    console.log(`\n  交了卷但一次都没回看的（${never.length} 人）:`);
    console.log('  ' + never.map((x) => `${x.name}(${x.subs}场)`).join('、'));
  }

  // ── 3. 迟到与放弃 ────────────────────────────────────────
  console.log('\n【3】到达时间 × 表现（补做功能的效果基线）');
  const late = await prisma.$queryRaw<
    Array<{ bucket: string; n: number; rate: number; blank: number }>
  >`
    WITH d AS (
      SELECT ROUND(EXTRACT(EPOCH FROM (a."scanTime" - s."quizStart")) / 60)::int AS mins,
             sub."totalScore"::float AS ts, sub."maxScore"::float AS ms,
             (SELECT COUNT(*)::int FROM "AnswerScript" x
              WHERE x."submissionId" = sub.id AND COALESCE(x."textAnswer", x."selectedOption", '') <> '') AS answered,
             (SELECT COUNT(*)::int FROM "PaperQuestion" pq WHERE pq."paperId" = pa."paperId") AS qtotal
      FROM "Attendance" a
      JOIN "MorningQuizSession" s ON s.id = a."sessionId"
      JOIN "PaperAssignment" pa ON pa.id = s."paperAssignmentId"
      JOIN "StudentSubmission" sub ON sub."assignmentId" = pa.id AND sub."studentId" = a."studentId"
      WHERE s."classId" = ${CLASS_ID}
        AND s."date" BETWEEN ${SINCE}::date AND ${UNTIL}::date
        AND a."scanTime" IS NOT NULL AND sub.status = 'marked' AND sub."maxScore" > 0
    )
    SELECT CASE WHEN mins <= 10 THEN '0-10分钟到'
                WHEN mins <= 20 THEN '11-20分钟到'
                ELSE '21分钟后到' END AS bucket,
           COUNT(*)::int AS n,
           AVG(ts / NULLIF(ms, 0))::float AS rate,
           AVG(1.0 - answered::float / NULLIF(qtotal, 0))::float AS blank
    FROM d GROUP BY 1 ORDER BY 1`;
  for (const r of late) {
    console.log(
      `  ${r.bucket.padEnd(14)} n=${String(r.n).padStart(3)}  ` +
        `平均得分率 ${(r.rate * 100).toFixed(1)}%   平均空白率 ${(r.blank * 100).toFixed(1)}%`,
    );
  }

  // ── 4. 错题本 ────────────────────────────────────────────
  console.log('\n【4】错题本');
  const mk = await prisma.$queryRaw<Array<{ reason: string; n: number }>>`
    SELECT m.reason::text AS reason, COUNT(*)::int AS n
    FROM "MistakeEntry" m
    WHERE m."quizDay" BETWEEN ${SINCE} AND ${UNTIL}
    GROUP BY 1 ORDER BY 2 DESC`;
  const REASON: Record<string, string> = {
    repeated_tasktype: '同题型反复错',
    vocabulary: '词义题',
    long_answer: '长答题（含老师评语）',
  };
  const mkTotal = mk.reduce((s, x) => s + x.n, 0);
  console.log(`  本周新增 ${mkTotal} 条`);
  for (const r of mk) console.log(`    ${(REASON[r.reason] ?? r.reason).padEnd(22)} ${r.n}`);
  const mkType = await prisma.$queryRaw<Array<{ t: string; n: number }>>`
    SELECT m."taskType" AS t, COUNT(*)::int AS n
    FROM "MistakeEntry" m WHERE m."quizDay" BETWEEN ${SINCE} AND ${UNTIL}
    GROUP BY 1 ORDER BY 2 DESC LIMIT 6`;
  if (mkType.length) {
    console.log('  全班最常错的题型: ' + mkType.map((x) => `${x.t}(${x.n})`).join('  '));
  }
  const resolved = await prisma.mistakeEntry.count({ where: { resolved: true } });
  console.log(`  学生已标记「已弄懂」: ${resolved} 条`);

  await prisma.$disconnect();
})().catch((e) => {
  console.error(e?.message ?? e);
  process.exit(1);
});
