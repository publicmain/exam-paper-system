import { PrismaClient } from '@prisma/client';
import { StudentWordService } from '../src/vocab/student-word.service';
import { VocabService } from '../src/vocab/vocab.service';
import { MistakeService } from '../src/vocab/mistake.service';

/**
 * 收尾还卡在 `submitted` 但其实已经没有待判项的答卷。
 *
 * 典型场景是补考：学生长答题全部空白 → 交卷时就自动判了 0 分 →
 * marker 队列里没有它们的待判项 → marker-apply.ts 的 GRADES 表里
 * 自然也没有 → 状态永远停在 submitted，于是
 *   · 不计入班级统计（统计只认 marked）
 *   · 不进错题本、不进生词本
 * 2026-08-13 三份补考卷就是这么被漏掉的。
 *
 * 本脚本找出「零待判项 + 状态仍是 submitted」的答卷，重算分数、
 * 翻成 marked，并跑与 marker-apply 相同的两个采集。
 *
 *   SINCE=2026-08-13 npx ts-node apps/api/scripts/finalize-stragglers.ts [--apply]
 */

const prisma = new PrismaClient();
const APPLY = process.argv.includes('--apply');
const SINCE = process.env.SINCE ?? new Date(Date.now() + 8 * 3600_000).toISOString().slice(0, 10);

(async () => {
  console.log(`\n=== 收尾 ${SINCE} 起的零待判答卷 ${APPLY ? '(执行)' : '(演练)'} ===\n`);

  const subs = await prisma.studentSubmission.findMany({
    where: {
      status: 'submitted',
      submittedAt: { gte: new Date(`${SINCE}T00:00:00+08:00`) },
    },
    include: {
      student: { select: { name: true } },
      assignment: { select: { morningQuizSession: { select: { date: true } } } },
      scripts: {
        include: { paperQuestion: { include: { question: { select: { questionType: true } } } } },
      },
    },
  });

  const done: string[] = [];
  for (const sub of subs) {
    // 与 marker-apply 完全一致的口径：MCQ 归 auto，结构化题按有没有
    // markerById 分 manual/auto。
    let mcqScore = 0;
    let autoScore = 0;
    let manualScore = 0;
    let ungraded = 0;
    for (const s of sub.scripts) {
      if (s.paperQuestion.question.questionType === 'mcq') {
        mcqScore += s.awardedMarks ?? 0;
        continue;
      }
      if (s.awardedMarks == null) {
        ungraded++;
        continue;
      }
      if (s.markedById != null) manualScore += s.awardedMarks;
      else autoScore += s.awardedMarks;
    }
    autoScore += mcqScore;
    const totalScore = autoScore + manualScore;

    if (ungraded > 0) {
      console.log(`  跳过 ${sub.student.name}：还有 ${ungraded} 项待判，应走 marker-apply`);
      continue;
    }
    console.log(
      `  ${sub.student.name.padEnd(10)} ${totalScore}/${sub.maxScore} (auto=${autoScore} manual=${manualScore}) → marked`,
    );
    if (!APPLY) continue;
    await prisma.studentSubmission.updateMany({
      where: { id: sub.id, status: 'submitted' },
      data: { status: 'marked', autoScore, manualScore, totalScore },
    });
    done.push(sub.id);
  }

  if (APPLY && done.length) {
    const vocabSvc = new VocabService(prisma as any);
    const wordsSvc = new StudentWordService(prisma as any, vocabSvc);
    const mistakeSvc = new MistakeService(prisma as any);
    let words = 0;
    let mistakes = 0;
    for (const id of done) {
      const row = subs.find((s) => s.id === id);
      const d = row?.assignment?.morningQuizSession?.date;
      const quizDay = (d ?? new Date()).toISOString().slice(0, 10);
      try {
        words += (await wordsSvc.harvestFromSubmission(id)).added;
      } catch (e: any) {
        console.warn(`  vocab harvest failed ${id}: ${e?.message ?? e}`);
      }
      try {
        mistakes += (await mistakeSvc.collectFromSubmission(id, quizDay)).added;
      } catch (e: any) {
        console.warn(`  mistake harvest failed ${id}: ${e?.message ?? e}`);
      }
    }
    console.log(`\n生词本新增 ${words} 条，错题本新增 ${mistakes} 条`);
  }

  console.log(APPLY ? `\n完成，收尾 ${done.length} 份。` : '\n以上为演练结果，加 --apply 才写库。');
  await prisma.$disconnect();
})().catch((e) => {
  console.error(e?.message ?? e);
  process.exit(1);
});
