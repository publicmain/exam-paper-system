#!/usr/bin/env node
'use strict';

const { loadWeekGlosses, CONTENT_ROOT } = require('./bundle');
const { idsFor } = require('../prepare-pilot-week');
const { reviewProblem } = require('../visible-fingerprint');

function connectionUrl(env = process.env) {
  const raw = env.DATABASE_PUBLIC_URL || env.DATABASE_URL;
  if (!raw) throw new Error('缺少 DATABASE_PUBLIC_URL / DATABASE_URL');
  const url = new URL(raw);
  url.searchParams.set('connection_limit', '1');
  return url.toString();
}

/** 默认真的执行更新后抛出专用异常，让 Prisma 回滚；从不把其他失败当作演练成功。 */
async function applyGlosses(prisma, week, { commit = false, root = CONTENT_ROOT, log = console.log } = {}) {
  const bundle = loadWeekGlosses(week, root);
  if (!bundle) throw new Error(`${week} 没有 glosses 目录，拒绝补写`);
  const plans = Object.entries(bundle.levels).flatMap(([level, days]) => days.map((day) => ({
    level, day, paperId: idsFor(level, day.date).paperId, glosses: bundle.data[level][day.source].glosses,
  }))).sort((a, b) => a.paperId.localeCompare(b.paperId));
  if (!plans.length) throw new Error(`${week} 没有文章，拒绝补写`);
  if (commit) {
    // 演练可以在审查前进行；真正补写同样不能绕过周五审核。
    for (const date of new Set(plans.map((plan) => plan.day.date))) {
      const problem = reviewProblem(date, { root });
      if (problem) throw new Error(problem);
    }
  }
  const report = plans.map((plan) => ({ paperId: plan.paperId, count: Object.keys(plan.glosses).length }));
  const rollback = new Error('apply-glosses dry-run rollback');
  try {
    await prisma.$transaction(async (tx) => {
      // 先锁定并核对整周，再开始任何更新。锁住卷子及正文快照，防止核对后被并发修改。
      for (const plan of plans) {
        await tx.$queryRaw`SELECT "id" FROM "Paper" WHERE "id" = ${plan.paperId} FOR UPDATE`;
        await tx.$queryRaw`SELECT "id" FROM "PaperQuestion" WHERE "paperId" = ${plan.paperId} FOR SHARE`;
        const paper = await tx.paper.findUnique({
          where: { id: plan.paperId },
          select: { id: true, name: true, status: true, archivedAt: true, config: true,
            questions: { select: { snapshotContent: true, overrideContent: true } } },
        });
        if (!paper) throw new Error(`${plan.paperId}：已发布卷子不存在（${plan.day.source}）`);
        if (paper.status !== 'published' || paper.archivedAt) throw new Error(`${plan.paperId}：未发布或已归档，拒绝补写`);
        if (paper.name !== plan.day.title || paper.config?.level !== plan.level) throw new Error(`${plan.paperId}：标题 / 档位与内容包不符`);
        if (!paper.config || typeof paper.config !== 'object' || Array.isArray(paper.config)) throw new Error(`${plan.paperId}：config 不是对象`);
        if (!paper.questions.length) throw new Error(`${plan.paperId}：没有正文快照`);
        for (const question of paper.questions) {
          if (question.snapshotContent?.passage !== plan.day.passage ||
              (question.overrideContent?.passage != null && question.overrideContent.passage !== plan.day.passage)) {
            throw new Error(`${plan.paperId}：正文与内容包 ${plan.day.source} 不一致，整批回滚`);
          }
        }
      }
      for (const plan of plans) {
        // 不经 Prisma update（避免顺手改 updatedAt）；在数据库中只替换 config 的这一个键。
        const changed = await tx.$executeRaw`UPDATE "Paper" SET "config" = jsonb_set("config"::jsonb, '{wordGlosses}', ${JSON.stringify(plan.glosses)}::jsonb, true) WHERE "id" = ${plan.paperId}`;
        if (changed !== 1) throw new Error(`${plan.paperId}：更新数量不是 1，整批回滚`);
      }
      if (!commit) throw rollback;
    }, { maxWait: 30_000, timeout: 120_000 });
  } catch (error) {
    if (error !== rollback) throw error;
  }
  for (const row of report) log(`${row.paperId}：${commit ? '已写入' : '将写入'} ${row.count} 个点词释义`);
  log(commit ? `已提交 ${report.length} 张卷子。` : `演练完成：${report.length} 张卷子的事务已回滚，没有持久写入。加 --commit 才提交。`);
  return { committed: commit, papers: report };
}

async function main() {
  const [week, ...flags] = process.argv.slice(2);
  if (!week || !/^week\d+$/.test(week) || flags.some((flag) => flag !== '--commit') || flags.length > 1) {
    throw new Error('用法：node apps/api/scripts/pilot/gloss/apply-glosses.js <week> [--commit]');
  }
  // 在创建客户端以前完成文件门禁，缺文件时连连接都不建立。
  if (!loadWeekGlosses(week)) throw new Error(`${week} 没有 glosses 目录`);
  process.env.DATABASE_URL = connectionUrl();
  const { PrismaClient } = require('@prisma/client');
  const prisma = new PrismaClient();
  try { await applyGlosses(prisma, week, { commit: flags.includes('--commit') }); }
  finally { await prisma.$disconnect(); }
}

module.exports = { applyGlosses, connectionUrl };
if (require.main === module) main().catch((error) => {
  console.error(String(error.message).replace(/postgres(?:ql)?:\/\/\S+/gi, '[redacted-connection-string]'));
  process.exitCode = 1;
});
