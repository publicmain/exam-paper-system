/**
 * 把试点第一周的例句中文补进已发布卷与现有学生词条。
 *
 * 写入范围只有：
 *   1. id 为 p1_* 的 25 份 Paper.config.lessonWords；
 *   2. contextSentence 与本周内容逐字相同的 StudentWord.contextTranslation。
 *
 * 不改题目、答卷、进度、FSRS、到期日或任何历史记录。环境闸门复用
 * prepare-pilot-week.js；只有 staging 的 Postgres 服务和逐字确认串能执行。
 */

'use strict';

const { PrismaClient } = require('@prisma/client');
const content = require('./content');
const { assertEnvGates, idsFor, PREFIX } = require('./prepare-pilot-week');

async function main() {
  assertEnvGates(process.env);
  const prisma = new PrismaClient({ datasources: { db: { url: process.env.DATABASE_PUBLIC_URL } } });
  try {
    const result = await prisma.$transaction(async (tx) => {
      let papers = 0;
      let words = 0;
      for (const [level, days] of Object.entries(content.LEVELS)) {
        for (const day of days) {
          const paperId = idsFor(level, day.date).paperId;
          if (!paperId.startsWith(PREFIX)) throw new Error('unsafe_paper_id');
          const paper = await tx.paper.findUnique({ where: { id: paperId }, select: { config: true } });
          if (!paper) throw new Error(`missing_pilot_paper:${level}:${day.date}`);
          const config = paper.config && typeof paper.config === 'object' && !Array.isArray(paper.config)
            ? paper.config
            : {};
          await tx.paper.update({
            where: { id: paperId },
            data: { config: { ...config, lessonWords: day.words } },
          });
          papers += 1;
        }
      }

      const unique = new Map();
      for (const days of Object.values(content.LEVELS)) {
        for (const day of days) {
          for (const word of day.words) unique.set(word.context, word.contextTranslation);
        }
      }
      for (const [contextSentence, contextTranslation] of unique) {
        const changed = await tx.studentWord.updateMany({
          where: { contextSentence, contextTranslation: { not: contextTranslation } },
          data: { contextTranslation },
        });
        words += changed.count;
      }
      return { papers, words, uniqueSentences: unique.size };
    }, { maxWait: 30_000, timeout: 300_000 });
    console.log(`context translations backfilled: papers=${result.papers}, words=${result.words}, unique=${result.uniqueSentences}`);
  } finally {
    await prisma.$disconnect();
  }
}

if (require.main === module) {
  main().catch((error) => {
    const safe = String(error?.message ?? error).replace(/postgres(ql)?:\/\/\S*/gi, '[redacted]');
    console.error(`context translation backfill failed: ${safe.slice(0, 500)}`);
    process.exit(1);
  });
}
