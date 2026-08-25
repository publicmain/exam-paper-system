import { PrismaClient } from '@prisma/client';
import { resolveWeeklyTrack } from '../src/morning-quiz/weekly-track';
import { levelPushesWordlist } from '../src/morning-quiz/level-registry';
import {
  buildClozeQuestion,
  buildMeaningQuestion,
  pickMeaningDistractors,
  pickWordDistractors,
  pickWordsForDay,
  seedFor,
  type VocabQuestionSpec,
} from '../src/morning-quiz/vocab-question';

/**
 * 给**轻量两层**的早测卷追加 2 道本周词汇题（2026-08-25 教师定）。
 *
 * 背景与设计理由见 src/morning-quiz/vocab-question.ts 顶部注释。
 * 一句话：背单词此前没有回报，把它放进唯一 100% 生效的强制流程里。
 *
 * 只动这两层 —— 雅思真题 / O-Level 标准 / O-Level 进阶的学生时间已经
 * 很紧，教师明确要求不加：
 *   ielts_light        雅思轻量   6 题 → 8 题
 *   ielts_simplified   O-Level 基础 5 题 → 7 题
 *
 * 词源：该层本周主线词（扫码时已推给每个学生），按天轮转，一周内不重复。
 * 题型：4 选 1 mcq —— 交卷即确定性判分，零 AI，不进人工判分队列。
 *
 *   演练：DATABASE_URL=... npx ts-node apps/api/scripts/attach-vocab-questions.ts --date 2026-08-26
 *   执行：... --date 2026-08-26 --apply
 */

const prisma = new PrismaClient();

const TARGET_LEVELS = ['ielts_light', 'ielts_simplified'] as const;

function arg(name: string): string | undefined {
  const i = process.argv.indexOf(`--${name}`);
  return i >= 0 ? process.argv[i + 1] : undefined;
}

/** 本周第几天（周一=0）——主线词按它轮转。 */
function dayIndexOf(dateIso: string): number {
  const d = new Date(`${dateIso}T00:00:00Z`);
  return (d.getUTCDay() + 6) % 7;
}

(async () => {
  const dateIso = arg('date');
  const APPLY = process.argv.includes('--apply');
  if (!dateIso || !/^\d{4}-\d{2}-\d{2}$/.test(dateIso)) {
    throw new Error('需要 --date YYYY-MM-DD');
  }
  const at = new Date(`${dateIso}T00:30:00Z`); // 早测挂钟时刻（08:30 SGT）
  const dayIdx = dayIndexOf(dateIso);
  console.log(`\n=== 词汇题 · ${dateIso}（本周第 ${dayIdx + 1} 天）${APPLY ? '执行' : '演练'} ===`);

  const sessions = await prisma.morningQuizSession.findMany({
    where: {
      date: {
        gte: new Date(`${dateIso}T00:00:00.000Z`),
        lt: new Date(new Date(`${dateIso}T00:00:00.000Z`).getTime() + 86_400_000),
      },
    },
    select: { id: true, level: true, paperAssignment: { select: { paperId: true } } },
  });

  let problems = 0;
  for (const s of sessions) {
    if (!TARGET_LEVELS.includes(s.level as any)) continue;
    if (!levelPushesWordlist(s.level)) {
      console.log(`  ⚠️ ${s.level} 没开词表推送，跳过（学生名下不会有这些词）`);
      problems++;
      continue;
    }
    const paperId = s.paperAssignment.paperId;
    const track = resolveWeeklyTrack(s.level, at);
    if (!track?.items.length) {
      console.log(`  ⚠️ ${s.level} 本周没有主线词表，跳过`);
      problems++;
      continue;
    }

    // 幂等：已经挂过当天词汇题的卷子不再挂第二次
    const existing = await prisma.paperQuestion.findMany({
      where: { paperId },
      select: { id: true, sortOrder: true, marks: true, snapshotContent: true },
      orderBy: { sortOrder: 'asc' },
    });
    const already = existing.filter(
      (q) => (q.snapshotContent as any)?.vocabTrack === true,
    );
    if (already.length) {
      console.log(`  ${s.level}: 已挂 ${already.length} 道词汇题，跳过`);
      continue;
    }

    const picked = pickWordsForDay(track.items, dayIdx, 2);
    // 释义 + 干扰项池：本周主线词表内部互相做干扰项（同档、且学生都见过）
    const allWords = track.items.map((i) => i.word.toLowerCase());
    const entries = await prisma.dictEntry.findMany({
      where: { word: { in: allWords } },
      select: { word: true, translation: true },
    });
    const byWord = new Map(entries.map((e) => [e.word.toLowerCase(), e.translation ?? '']));
    const pool = entries
      .map((e) => ({ word: e.word, translation: e.translation ?? '' }))
      .filter((e) => e.translation);

    const specs: VocabQuestionSpec[] = [];
    const seed = seedFor(dateIso, s.level);
    // 题 1：原句填空（给语境，没背过也能推）
    const w1 = picked[0];
    if (w1) {
      const t1 = { word: w1.word, context: w1.context, translation: byWord.get(w1.word.toLowerCase()) ?? '' };
      const q1 = buildClozeQuestion(t1, pickWordDistractors(t1.word, t1.translation, pool, seed), seed);
      if (q1) specs.push(q1);
      else console.log(`  ⚠️ ${s.level}: ${w1.word} 出不了填空题（例句里定位不到）`);
    }
    // 题 2：看词选义（纯记忆）
    const w2 = picked[1] ?? picked[0];
    if (w2) {
      const t2 = { word: w2.word, context: w2.context, translation: byWord.get(w2.word.toLowerCase()) ?? '' };
      if (!t2.translation) {
        console.log(`  ⚠️ ${s.level}: ${w2.word} 词典无释义`);
        problems++;
      } else {
        const q2 = buildMeaningQuestion(t2, pickMeaningDistractors(t2, pool, seed * 3), seed * 3);
        if (q2) specs.push(q2);
      }
    }
    if (!specs.length) {
      console.log(`  ⚠️ ${s.level}: 一道也没出成`);
      problems++;
      continue;
    }

    const maxOrder = existing.reduce((m, q) => Math.max(m, q.sortOrder), 0);
    const oldTotal = existing.reduce((m, q) => m + q.marks, 0);
    console.log(`\n  ── ${s.level} · paper ${paperId.slice(-6)} · 原 ${existing.length} 题 ${oldTotal} 分 ──`);
    for (const [i, spec] of specs.entries()) {
      console.log(`\n   Q${maxOrder + i + 1} [${spec.qtype}] 词=${spec.headword} 答案=${spec.answerKey}`);
      console.log(`   题干: ${spec.stem.replace(/\n+/g, ' ⏎ ')}`);
      for (const o of spec.options) console.log(`     ${o.key}. ${o.text}${o.correct ? '  ← 正解' : ''}`);
    }

    if (!APPLY) continue;

    // 落库：先建 Question（题库主记录），再挂 PaperQuestion
    const sample = await prisma.paperQuestion.findFirst({
      where: { paperId },
      select: { question: { select: { subjectId: true, componentId: true, createdById: true } } },
    });
    if (!sample) {
      console.log('   ✗ 找不到同卷题目，无法确定 subject，跳过');
      problems++;
      continue;
    }
    for (const [i, spec] of specs.entries()) {
      const q = await prisma.question.create({
        data: {
          subjectId: sample.question.subjectId,
          componentId: sample.question.componentId,
          // 作者沿用同卷其它题的作者，保持题库归属一致
          createdById: sample.question.createdById,
          questionType: 'mcq',
          marks: 1,
          estimatedTimeMin: 0.5,
          difficulty: 2,
          // 自撰词汇题，不是过去卷 —— 版权铁律
          sourceType: 'original_school',
          status: 'active',
          content: { stem: spec.stem, taskType: spec.taskType, vocabTrack: true, headword: spec.headword },
          answerContent: { text: spec.answerKey },
          options: spec.options,
        },
        select: { id: true },
      });
      await prisma.paperQuestion.create({
        data: {
          paperId,
          questionId: q.id,
          sortOrder: maxOrder + i + 1,
          marks: 1,
          snapshotContent: {
            stem: spec.stem,
            taskType: spec.taskType,
            // 标记位：幂等判定 + 日后统计词汇题正确率靠它
            vocabTrack: true,
            headword: spec.headword,
            vocabQtype: spec.qtype,
          },
          snapshotAnswer: { text: spec.answerKey },
          snapshotOptions: spec.options,
        },
      });
    }
    // 卷面总分随之变化（maxScore 由 PaperQuestion.marks 求和推导的地方会自动跟上）
    console.log(`   → 已挂 ${specs.length} 道，卷面 ${oldTotal} → ${oldTotal + specs.length} 分`);
  }

  console.log(`\n${APPLY ? '写入完成' : '演练结束'}；问题数: ${problems}\n`);
  await prisma.$disconnect();
})().catch(async (e) => {
  console.error(e?.message ?? e);
  await prisma.$disconnect();
  process.exit(1);
});
