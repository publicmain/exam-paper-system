/**
 * 每周题目体检：拿学生的真实作答给每一道题「看病」（2026-09-11）。
 *
 *   railway run -s Postgres -e production -- npx ts-node apps/api/scripts/content/item-report.ts \
 *     --from=2026-09-07 --to=2026-09-11
 *
 * 只读。报告写到 `.local/reports/item-report-<from>-<to>.md`（已 gitignore，里面有
 * 题干，没有学生姓名），终端打一份摘要。
 *
 * ## 看什么
 *
 *   · **得分率**：≥95% 全班都对 = 这道题测不出东西；≤25% 几乎没人对 = 题太难、
 *     或者题 / 答案 / 评分标准本身有毛病。首发周 120 道里前者 25 道、后者 10 道。
 *   · **区分度**：这道题的得分和同卷其余题得分的相关。好题是正的 —— 读得懂的
 *     人更容易做对。**负的**是危险信号：学得好的反而错得多，多半是答案键错了
 *     或者题目有第二种合理读法。样本少时（< 8 人）只作参考。
 *   · **干扰项**（选择题）：每个选项被选了几次。一次都没人选的干扰项等于
 *     没有 —— 四选一实际成了三选一。
 *
 * 口径：只算学生自己交的卷（submitSource = student / teacher），排除测试账号。
 * 主观题按「得分 / 满分」算得分率，所以要等判完分再跑。
 */
import { PrismaClient } from '@prisma/client';
import * as fs from 'fs';
import * as path from 'path';

const arg = (name: string) => process.argv.find((a) => a.startsWith(`--${name}=`))?.slice(name.length + 3);
const FROM = arg('from') ?? '2026-09-07';
const TO = arg('to') ?? FROM;

/** 分析口径排除的账号 —— 与 memory 里的「分析必须排除测试账号」同一张表。 */
const EXCLUDE_SQL = `
  u.id <> 'cmtqgmjl200u6stuq31xrad59'
  AND u.id NOT LIKE 'p1_qa_acc_%'
  AND u.name NOT IN ('用户验收账号','Sammy','内部冒烟账号','老师测试号','测试学生','验收甲基础','验收乙中级','验收丙标准','验收丁轻量','验收戊真题')`;

type Row = {
  pq: string;
  sub: string;
  qt: string;
  task: string | null;
  marks: number;
  got: number;
  total: number;
  maxs: number;
  level: string;
  date: Date;
  paper: string;
  n: number;
  stem: string | null;
  chosen: string | null;
  options: Array<{ key: string; text: string; correct?: boolean }> | null;
};

function corr(x: number[], y: number[]): number | null {
  const n = x.length;
  if (n < 4) return null;
  const mx = x.reduce((a, b) => a + b) / n;
  const my = y.reduce((a, b) => a + b) / n;
  let sxy = 0;
  let sxx = 0;
  let syy = 0;
  for (let i = 0; i < n; i += 1) {
    sxy += (x[i] - mx) * (y[i] - my);
    sxx += (x[i] - mx) ** 2;
    syy += (y[i] - my) ** 2;
  }
  return sxx && syy ? sxy / Math.sqrt(sxx * syy) : null;
}

(async () => {
  const prisma = new PrismaClient({ datasources: { db: { url: process.env.DATABASE_PUBLIC_URL || process.env.DATABASE_URL } } });
  const rows = (await prisma.$queryRawUnsafe(`
    SELECT pq.id AS pq, s.id AS sub, q."questionType" AS qt, pq."snapshotContent"->>'taskType' AS task,
           pq.marks, COALESCE(a."awardedMarks", 0) AS got, s."totalScore" AS total, s."maxScore" AS maxs,
           m.level::text AS level, m.date, p.name AS paper, pq."sortOrder" AS n,
           pq."snapshotContent"->>'stem' AS stem, a."selectedOption" AS chosen, pq."snapshotOptions" AS options
    FROM "AnswerScript" a
    JOIN "StudentSubmission" s ON s.id = a."submissionId"
    JOIN "User" u ON u.id = s."studentId"
    JOIN "PaperQuestion" pq ON pq.id = a."paperQuestionId"
    JOIN "Question" q ON q.id = pq."questionId"
    JOIN "Paper" p ON p.id = pq."paperId"
    JOIN "PaperAssignment" pa ON pa.id = s."assignmentId"
    JOIN "MorningQuizSession" m ON m."paperAssignmentId" = pa.id
    WHERE m.date BETWEEN '${FROM}' AND '${TO}'
      AND s.status = 'marked' AND s."submitSource" IN ('student','teacher')
      AND a."awardedMarks" IS NOT NULL
      AND ${EXCLUDE_SQL}`)) as Row[];
  await prisma.$disconnect();

  type Item = {
    key: string; level: string; date: string; paper: string; n: number; qt: string; task: string;
    stem: string; marks: number; xs: number[]; ys: number[]; picks: Map<string, number>;
    options: Row['options'];
  };
  const items = new Map<string, Item>();
  for (const r of rows) {
    if (!items.has(r.pq)) {
      items.set(r.pq, {
        key: r.pq, level: r.level, date: r.date.toISOString().slice(0, 10), paper: r.paper, n: Number(r.n),
        qt: r.qt, task: r.task ?? r.qt, stem: String(r.stem ?? '').split('\n').pop() ?? '', marks: Number(r.marks),
        xs: [], ys: [], picks: new Map(), options: r.options,
      });
    }
    const it = items.get(r.pq)!;
    it.xs.push(Number(r.got) / Number(r.marks));
    it.ys.push((Number(r.total) - Number(r.got)) / Math.max(1, Number(r.maxs) - Number(r.marks)));
    if (r.chosen) it.picks.set(r.chosen, (it.picks.get(r.chosen) ?? 0) + 1);
  }

  const all = [...items.values()].map((it) => ({
    ...it,
    count: it.xs.length,
    p: it.xs.reduce((a, b) => a + b, 0) / it.xs.length,
    d: corr(it.xs, it.ys),
  }));
  const enough = all.filter((i) => i.count >= 3);
  const easy = enough.filter((i) => i.p >= 0.95);
  const hard = enough.filter((i) => i.p <= 0.25);
  const negative = enough.filter((i) => i.d !== null && i.d < 0 && i.count >= 4).sort((a, b) => a.d! - b.d!);
  const deadDistractors = enough
    .filter((i) => i.qt === 'mcq' && i.options && i.task !== 'true_false_not_given' && i.task !== 'matching_features')
    .map((i) => ({
      i,
      dead: (i.options ?? []).filter((o) => !o.correct && !i.picks.get(o.key)).map((o) => o.text),
    }))
    .filter((x) => x.dead.length > 0 && x.i.count >= 5);

  const byLevel = new Map<string, number[]>();
  const byTask = new Map<string, number[]>();
  for (const i of enough) {
    byLevel.set(i.level, [...(byLevel.get(i.level) ?? []), i.p]);
    byTask.set(i.task, [...(byTask.get(i.task) ?? []), i.p]);
  }
  const avg = (xs: number[]) => `${((xs.reduce((a, b) => a + b, 0) / xs.length) * 100).toFixed(0)}%`;
  const tag = (i: (typeof all)[number]) => `${i.date} ${i.level} 第${i.n}题 [${i.task}] ${i.paper}`;

  const md: string[] = [
    `# 题目体检 ${FROM} ~ ${TO}`,
    '',
    `作答满 3 人的题 ${enough.length} 道（共 ${all.length} 道有作答）。`,
    '',
    '## 按档位的平均得分率',
    ...[...byLevel.entries()].sort().map(([k, v]) => `- ${k}：${avg(v)}（${v.length} 道）`),
    '',
    '## 按题型的平均得分率',
    ...[...byTask.entries()].sort().map(([k, v]) => `- ${k}：${avg(v)}（${v.length} 道）`),
    '',
    `## 全班都对（≥95%）—— ${easy.length} 道，测不出东西`,
    ...easy.map((i) => `- ${tag(i)}：${(i.p * 100).toFixed(0)}%（${i.count} 人）— ${i.stem.slice(0, 90)}`),
    '',
    `## 几乎没人对（≤25%）—— ${hard.length} 道，先查题再查学生`,
    ...hard.map((i) => `- ${tag(i)}：${(i.p * 100).toFixed(0)}%（${i.count} 人）— ${i.stem.slice(0, 90)}`),
    '',
    `## 区分度为负 —— ${negative.length} 道，学得好的反而错得多`,
    ...negative.map(
      (i) => `- ${tag(i)}：区分度 ${i.d!.toFixed(2)}，得分率 ${(i.p * 100).toFixed(0)}%（${i.count} 人${i.count < 8 ? '，样本少，仅参考' : ''}）— ${i.stem.slice(0, 90)}`,
    ),
    '',
    `## 没人选的干扰项 —— ${deadDistractors.length} 道`,
    ...deadDistractors.map(({ i, dead }) => `- ${tag(i)}：${dead.map((t) => `「${t}」`).join(' ')}`),
    '',
  ];
  const outDir = path.resolve(process.cwd(), '.local', 'reports');
  fs.mkdirSync(outDir, { recursive: true });
  const file = path.join(outDir, `item-report-${FROM}-${TO}.md`);
  fs.writeFileSync(file, md.join('\n'), 'utf8');

  console.log(`题目体检 ${FROM} ~ ${TO}：作答满 3 人的 ${enough.length} 道`);
  console.log(`  全班都对 ${easy.length} · 几乎没人对 ${hard.length} · 区分度为负 ${negative.length} · 有死干扰项 ${deadDistractors.length}`);
  for (const [k, v] of [...byLevel.entries()].sort()) console.log(`  ${k.padEnd(20)} ${avg(v)}`);
  console.log(`\n完整报告：${file}`);
})().catch((e) => {
  console.error('ERR', e.message);
  process.exit(1);
});
