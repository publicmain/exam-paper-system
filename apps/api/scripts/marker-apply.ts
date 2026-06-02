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
  // 2026-06-02 G11 IELTS Test — 3 levels / 3 papers:
  //   ielts_authentic   = ielts_authored_2026_v1 Test3 P3 (Linear B / Knossos)
  //   olevel            = ai_authored_olevel_03_empty_seat (reunion-dinner chair)
  //   ielts_simplified  = ai_authored_olevel_simplified_21_drawing (void-deck mural)
  // 14 short-answer scripts, all maxMarks=1.

  // 喻耀程 (cmpvwkxrw00rsx68na02eekbn) — ielts_simplified · drawing
  cmpvwl70m00skx68ndzjd73k7: { awardedMarks: 0, reason: 'Q5: "nb" — 非有效答案。' },

  // 杨钧皓 (cmpvwkwgs00rlx68n135zwfjj) — ielts_authentic · Linear B
  cmpvwq8bg00v2x68nqmac1xa0: { awardedMarks: 0, reason: 'Sentence completion: "index card" 单数 — 答案为 "index cards"（复数），IELTS 须与原文完全一致。' },
  cmpvwqe8x00v6x68nrvh4tqxp: { awardedMarks: 0, reason: 'Sentence completion: "john" — 填的是题干已给的名 John，空格要填姓 Chadwick。' },

  // 孙爱迪 (cmpvwnx1400u0x68nxy0fkhq9) — olevel · empty seat
  cmpvx0dup00yzx68nq92o3h55: { awardedMarks: 1, reason: 'Q10: "It feels like he is still there" — 抓住了"他仍在场→不需实物纪念"这一核心。' },

  // HEIN HTET NAING (cmpvwk3m100r7x68nzqil4p0s) — olevel · empty seat
  cmpvwt1op00wfx68nyw8412ii: { awardedMarks: 0, reason: 'Q7: "To mock Ah Gong" — 与"以欢笑/幽默缅怀"相反。' },
  cmpvww9og00x4x68n0qoxr3mz: { awardedMarks: 0, reason: 'Q6: "mother could not stop the outburst" — 漏了"too late=话已被众人听见、打破沉默"。' },
  cmpvwxpcf00y7x68njjm3nnks: { awardedMarks: 0, reason: 'Q10: "放回原处免得弄丢" — 纯实用理由，漏了情感推断。' },
  cmpvx3tpb011bx68n8r943dz3: { awardedMarks: 0, reason: 'Q8: "too happy and excited" — 漏了悲伤那一半（哭中带笑=悲喜交织）。' },
  cmpvx1ytp010px68nj5ywytup: { awardedMarks: 1, reason: 'Q5: "气氛紧张、无人愿打破沉默" — 抓住了尴尬不适这一要点。' },

  // 王晨宇 (cmpvx6ujq012hx68nylw0hny6) — ielts_simplified · drawing
  cmpvxbba2015hx68n75ph8wek: { awardedMarks: 0, reason: 'Q1: "waiting for his dinner" — 太单薄，漏了"每天在此等婆婆送饭/熟悉亲近"。' },

  // 郑稀瑜 (cmpvwwlnu00y0x68nef667g0w) — ielts_authentic · Linear B
  cmpvxebt7017mx68naw2utiqy: { awardedMarks: 0, reason: 'Sentence completion: "handmade index card" — 超过两词上限，且 "handmade" 非原文，答案为 "index cards"。' },

  // 王晨旭 (cmpvx7dms012wx68nq0swmfmy) — ielts_simplified · drawing
  cmpvxah9u0151x68n9ia92chl: { awardedMarks: 1, reason: 'Q2: 指出"用身体感受细节表现紧张" — 抓住了该细节的效果。' },
  cmpvxdio30173x68n8mhv4qch: { awardedMarks: 1, reason: 'Q1: "每天在此等婆婆送晚饭" — 命中要点。' },
  cmpvxhpur019jx68nn40z5s6a: { awardedMarks: 1, reason: 'Q4: "画作本身属于他，名牌不重要" — 命中要点。' },
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
