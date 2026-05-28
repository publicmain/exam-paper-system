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
  // 2026-05-28 G11 IELTS Test Cambridge IELTS 8 Test 1 P3 TELEPATHY
  // Note: Q34/Q35 are interchangeable per the official key (the paper's
  // snapshotContent says "IN EITHER ORDER per official key").

  // 杨钧皓 (cmporciai00qvg1grx4xx8ws6)
  cmporhjmf00tzg1grlk92zs0l: { awardedMarks: 0, reason: 'Q34: "leakage" alone misses the required "sensory" — passage says "sensory leakage".' },
  cmporixnd00vcg1grxnekd3px: { awardedMarks: 0, reason: 'Q39: word-form error — passage has noun "lack of consistency"; student wrote adjective "consistent".' },
  cmporkjzv00wzg1gr0dy5i3zy: { awardedMarks: 0, reason: 'Q38: "analysis" alone misses the "meta-" prefix — passage answer is "meta-analysis".' },

  // 王耀星 (cmporhj5w00tug1grkxnv563z)
  cmporompy0104g1grj3qtfphp: { awardedMarks: 0, reason: 'Q34: "Leakage" alone misses "sensory" — passage says "sensory leakage".' },

  // 李明阳 (cmporgk2b00sqg1grj86ifu3l)
  cmporoyjd010cg1grl62nkurk: { awardedMarks: 0, reason: 'Q34: "Leakage" alone misses "sensory" — passage says "sensory leakage".' },
  cmporqdhn011hg1gr4l2jb5yo: { awardedMarks: 1, reason: 'Q36: singular "Computer" vs passage\'s plural "computers" — minor grammatical variation; correct word, meaning clear.' },
  cmporqz54011tg1grat0nuege: { awardedMarks: 0, reason: 'Q38: "Meter-analysis" is a different word — passage says "meta-analysis".' },
  cmporrxnz012og1grnmq2eske: { awardedMarks: 0, reason: 'Q40: instruction is "from the passage" — passage uses "big enough", not "Large enough" (synonym not accepted).' },

  // 孔凡今 (cmporfyxf00s2g1grdveh6ig0)
  cmportxx90145g1gr9403jc1d: { awardedMarks: 1, reason: 'Q35: "outright fraud" is exactly from the passage (2 words ≤ 3) and identifies the second flaw — correct.' },
  cmporw1ce0165g1grnmt7gli5: { awardedMarks: 0, reason: 'Q40: "large enough" is a synonym not present in the passage — passage uses "big enough".' },

  // 牛星林 (cmporfgy300rng1grq5ncn18f)
  cmporvhxf015ng1grcmxqtg4v: { awardedMarks: 1, reason: 'Q35: "outright fraud" is exactly from the passage and identifies the second flaw — correct.' },
  cmporz25w017lg1grtayxtlo7: { awardedMarks: 0, reason: 'Q39: "consistency" alone inverts the meaning — the flaw is "lack of consistency".' },
  cmporzizq017vg1grmgq8ckml: { awardedMarks: 0, reason: 'Q40: "large" alone is incomplete — passage answer is "big enough".' },

  // 郑稀瑜 (cmporiz7v00vig1grc7d8l9vu)
  cmpos01dl0185g1grkncpts1y: { awardedMarks: 0, reason: 'Q34: "Routinely overlooked" is off-topic — not one of the two flaws (sensory leakage / fraud).' },
  cmpos2r1s018lg1grg9zvt4h7: { awardedMarks: 1, reason: 'Q35: "sensory leakage" is a valid flaw answer; Q34/Q35 either order per the official key — accepted in the Q35 slot.' },
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
