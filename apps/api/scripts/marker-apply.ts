import { PrismaClient } from '@prisma/client';

/**
 * Write back chat-graded marks for today's marker queue.
 *
 * Per [[ai-api-usage-policy]] — short-answer grading is done by Claude
 * in chat. marker-dump.ts surfaces the data, this script applies the
 * decisions. Zero Anthropic API calls.
 *
 * Embeds the grade decisions inline (`GRADES` map below) — re-edit
 * before each run. Idempotent if a script has already been graded
 * (skips it).
 *
 * Behaviour, mirroring marker.service.finalize:
 *   1. Look up an admin user to use as markedById.
 *   2. For each (scriptId, awardedMarks, reason):
 *        - update AnswerScript: awardedMarks, markerComment, markedById, markedAt
 *   3. For each affected submission (deduped):
 *        - recompute autoScore (MCQ + non-marker-graded SA) +
 *          manualScore (marker-graded SA) + totalScore = sum
 *        - if every structured script now has awardedMarks set,
 *          flip status: submitted → marked
 *
 * Skips the markerAssignment claim flow — we're acting as the admin
 * user directly, no concurrent marker.
 */

const GRADES: Record<string, { awardedMarks: number; reason: string }> = {
  // 2026-06-04 G11 morning-quiz — 3 papers / 3 levels:
  //   ielts_authentic  = cambridge_ielts_8/Test4/P3 (collecting ants · 图表标注 Q37/38/40)
  //   ielts_simplified = ai_authored_olevel_simplified_02_forgotten_promise (喂猫 · 忘记的承诺)
  //   olevel           = ai_authored_olevel_07_last_lap (4x100m 接力赛)
  // 5 submissions, 14 short-answer scripts, all maxMarks=1.

  // 李淳 (ielts_authentic · ant)
  cmpyrkfu900wwij0m4i0otl0o: { awardedMarks: 0, reason: 'Q40: "ethanol" — IELTS 图表填空须用原文词,原文是 "alcohol";ethanol 虽同义但非原文词,不接受。' },

  // 喻耀程 (ielts_simplified · 喂猫) — 4 题
  cmpyrhu3e00swij0mu3jigqfr: { awardedMarks: 0, reason: 'Q4: "she seudenly realread" — 残句/拼写错乱,没说出"突然想起忘了喂猫"。' },
  cmpyrkest00wuij0mgs95cvbx: { awardedMarks: 0, reason: 'Q3: "because she like cat" — 跑题,与"独自承担起被托付的责任"的成就感无关。' },
  cmpyrltmq00yhij0m4ozu0waq: { awardedMarks: 0, reason: 'Q5: "she thinks is good" — 无实质作答,未解释引语含义。' },
  cmpyrokyg011wij0mepov7ge8: { awardedMarks: 0, reason: 'Q6: "no" — 非有效答案。' },

  // HEIN HTET NAING (olevel · 接力赛) — 5 题
  cmpyrndsx00zxij0ma0g8ewlg: { awardedMarks: 0, reason: 'Q5: "他还没完全摔倒" — 仅字面复述,没答出"表现比赛之接近、那半步刚好够他反超"的效果。' },
  cmpyrnu52011aij0maizahspn: { awardedMarks: 0, reason: 'Q3: "声音很响" — 误读;原句是"杂音都退成心跳后的一个闷响"＝屏蔽外界、高度专注,与"很响"相反。' },
  cmpyrv5w30139ij0mb0pzcsix: { awardedMarks: 0, reason: 'Q7: "Mr Lim 为他们骄傲" — 跑题,没答"夺冠是四人团队铺垫的功劳、非个人"。' },
  cmpyrwxot013yij0m96kiqegp: { awardedMarks: 1, reason: 'Q2: "跑太快以致腿撑不住" — 命中"全力以赴、早早把体力耗尽到极限"。' },
  cmpyrxky2014mij0mhoxl4s7l: { awardedMarks: 0, reason: 'Q4: "跑得很快" — 泛泛,没答"身体凭本能/训练在跑、不再有意识控制"。' },

  // 郑稀瑜 (ielts_authentic · ant) — 3 题图表标注
  cmpys2lfs015zij0mzkt640xf: { awardedMarks: 0, reason: 'Q40: "pitfall trap" — 答的是方法名,不是漏斗底部保存蚂蚁的液体(alcohol)。' },
  cmpys3ct10165ij0mvefiiasn: { awardedMarks: 0, reason: 'Q38: "Baits" — 错,网上方放的是 "leaf litter"。' },
  cmpys4s5t016dij0mkzmaeb14: { awardedMarks: 0, reason: 'Q37: "leaf litter" — 搞反了;问"从上方施加什么使落叶层变干"＝heat,leaf litter 是被烘干的材料。' },

  // 牛星林 (ielts_authentic · ant)
  cmpysb8u80175ij0men49wwkv: { awardedMarks: 0, reason: 'Q37: "Large funnel" — 错,应为 "heat"。' },
};

const prisma = new PrismaClient();

(async () => {
  const admin = await prisma.user.findFirst({
    where: { role: 'admin' },
    orderBy: { createdAt: 'asc' },
    select: { id: true, name: true },
  });
  if (!admin) {
    console.error('No admin user found — cannot record markedById.');
    process.exit(1);
  }
  console.log(`Acting as admin: ${admin.name} (${admin.id})`);

  const submissionIds = new Set<string>();
  let scriptsWritten = 0;
  let scriptsSkipped = 0;

  for (const [scriptId, { awardedMarks, reason }] of Object.entries(GRADES)) {
    const script = await prisma.answerScript.findUnique({
      where: { id: scriptId },
      select: {
        id: true,
        awardedMarks: true,
        markedById: true,
        submissionId: true,
        paperQuestion: { select: { marks: true } },
      },
    });
    if (!script) {
      console.warn(`  skip ${scriptId} — not found`);
      scriptsSkipped++;
      continue;
    }
    if (awardedMarks > script.paperQuestion.marks) {
      console.warn(
        `  skip ${scriptId} — awardedMarks ${awardedMarks} > maxMarks ${script.paperQuestion.marks}`,
      );
      scriptsSkipped++;
      continue;
    }
    if (script.markedById && script.awardedMarks != null) {
      console.log(`  skip ${scriptId} — already graded (markedById set)`);
      scriptsSkipped++;
      submissionIds.add(script.submissionId);
      continue;
    }
    await prisma.answerScript.update({
      where: { id: scriptId },
      data: {
        awardedMarks,
        markerComment: reason,
        markedById: admin.id,
        markedAt: new Date(),
      },
    });
    scriptsWritten++;
    submissionIds.add(script.submissionId);
  }

  console.log(`\nWrote ${scriptsWritten} script(s), skipped ${scriptsSkipped}.\n`);

  // Per-submission recompute + finalize. Mirrors marker.service.finalize:
  // mcq + non-marker-graded structured → autoScore, marker-graded → manualScore.
  let finalized = 0;
  let partial = 0;
  for (const submissionId of submissionIds) {
    const sub = await prisma.studentSubmission.findUnique({
      where: { id: submissionId },
      include: {
        student: { select: { name: true } },
        scripts: {
          include: {
            paperQuestion: { include: { question: { select: { questionType: true } } } },
          },
        },
      },
    });
    if (!sub) continue;

    let mcqScore = 0;
    let autoScore = 0;
    let manualScore = 0;
    let structuredTotal = 0;
    let structuredUngraded = 0;
    for (const s of sub.scripts) {
      const t = s.paperQuestion.question.questionType;
      if (t === 'mcq') {
        mcqScore += s.awardedMarks ?? 0;
        continue;
      }
      structuredTotal++;
      if (s.awardedMarks == null) {
        structuredUngraded++;
        continue;
      }
      if (s.markedById != null) manualScore += s.awardedMarks;
      else autoScore += s.awardedMarks;
    }
    autoScore += mcqScore;
    const totalScore = autoScore + manualScore;

    if (structuredUngraded > 0) {
      // Still has ungraded scripts — write recomputed totals but keep
      // status='submitted'. The dashboard will reflect the partial.
      await prisma.studentSubmission.update({
        where: { id: submissionId },
        data: { autoScore, manualScore, totalScore },
      });
      console.log(
        `  ${sub.student.name}: partial — autoScore=${autoScore} manualScore=${manualScore} total=${totalScore}/${sub.maxScore} (still ${structuredUngraded} ungraded)`,
      );
      partial++;
      continue;
    }

    const updated = await prisma.studentSubmission.updateMany({
      where: { id: submissionId, status: 'submitted' },
      data: { status: 'marked', autoScore, manualScore, totalScore },
    });
    if (updated.count === 0) {
      // Already marked, or wrong starting status. Still write the totals.
      await prisma.studentSubmission.update({
        where: { id: submissionId },
        data: { autoScore, manualScore, totalScore },
      });
      console.log(
        `  ${sub.student.name}: scores updated (no status flip — was already marked) total=${totalScore}/${sub.maxScore}`,
      );
    } else {
      finalized++;
      console.log(
        `  ${sub.student.name}: FINALIZED  total=${totalScore}/${sub.maxScore} (auto=${autoScore} manual=${manualScore})`,
      );
    }
  }

  console.log(`\n=== Done ===\n  scripts written: ${scriptsWritten}\n  submissions finalized: ${finalized}\n  partial: ${partial}\n`);
  await prisma.$disconnect();
})();
