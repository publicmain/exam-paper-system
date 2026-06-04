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
  // 2026-05-26 G11 morning-quiz BACKLOG — 8 submissions, 29 scripts.
  //   ielts_authentic  = ielts_authored_2026_v1/Test2/P1 (段落匹配,答案 A-H 字母)
  //   ielts_simplified = ai_authored_olevel_simplified_17_relay (接力赛 Aaron)
  //   olevel           = singapore_olevel_1128_bedokview (the dying deer)

  // 闫雯涵 (ielts_simplified · relay) — 4 题全填 "yes"
  cmplwnz5x00v0ju0pk50mm7ir: { awardedMarks: 0, reason: '"yes" — 非有效答案。' },
  cmplwo6p300vaju0ptu9d7b1k: { awardedMarks: 0, reason: '"yes" — 非有效答案。' },
  cmplwoemn00vqju0p523uysel: { awardedMarks: 0, reason: '"yes" — 非有效答案。' },
  cmplwoigk00w8ju0pyzin825h: { awardedMarks: 0, reason: '"yes" — 非有效答案。' },

  // 喻耀程 (ielts_authentic · 段落匹配) — 5 题字母全错
  cmplwmy8r00ukju0puk8s5j0x: { awardedMarks: 0, reason: '段落匹配:答 A,正确 C。' },
  cmplwou6b00wpju0phv1ee8s7: { awardedMarks: 0, reason: '段落匹配:答 BC(应填单个字母),正确 B。' },
  cmplwp1b200wvju0pduyujsfq: { awardedMarks: 0, reason: '段落匹配:答 c,正确 F。' },
  cmplwp53m00x3ju0pasn29l1a: { awardedMarks: 0, reason: '段落匹配:答 b,正确 A。' },
  cmplwp7xq00x7ju0pq9wm5izi: { awardedMarks: 0, reason: '段落匹配:答 A,正确 D。' },

  // 毛思琳 (ielts_simplified · relay) — 5 题
  cmplwq42100xpju0pa4010n4x: { awardedMarks: 1, reason: '"紧张" — 命中(紧张/压力大)。' },
  cmplwqdzt00y4ju0p6mxoa2yc: { awardedMarks: 0, reason: '"放松" — 与"认识到自己能力更强、眼界被拓宽"相反。' },
  cmplwqlwc00yeju0pwawi2ciy: { awardedMarks: 0, reason: '"其他人受伤" — 原因不符,原文是两人发烧+一人出国导致人手不够。' },
  cmplwr08u00yyju0p07euk0xd: { awardedMarks: 0, reason: '"要求不高" — 跑题,应为"想让他明白价值在尽力而非输赢"。' },
  cmplwr7gt00z0ju0p1olps66i: { awardedMarks: 1, reason: '"专注" — 命中(完全专注)。' },

  // 牟歌 (olevel · deer)
  cmplwpedm00xdju0pn8ft8km7: { awardedMarks: 0, reason: '"He felt regretful" — 没答出"努力控制汹涌的情绪"这一核心。' },

  // 刘钇村 (ielts_authentic · 段落匹配) — 3 题
  cmplwty8p00zkju0pnje7lkhz: { awardedMarks: 0, reason: '段落匹配:答 G,正确 B。' },
  cmplwwb8s0108ju0plllt7r2r: { awardedMarks: 0, reason: '段落匹配:答 H,正确 A。' },
  cmplwyp61011cju0peskrl7rf: { awardedMarks: 0, reason: '段落匹配:答 E,正确 D。' },

  // 叶书瑞 (ielts_simplified · relay) — 6 题(几处把答案填到了错的题号)
  cmplwwwtk010aju0p47zds42a: { awardedMarks: 0, reason: '答的是"过去不擅长运动"(填错题),本题要"完全专注"。' },
  cmplwx6l8010cju0pva9j9v21: { awardedMarks: 0, reason: '答的是"人手不够的原因"(填错题),本题要"认识到自己更有能力"。' },
  cmplwxiku010gju0puqd1fkx1: { awardedMarks: 1, reason: '"nervous and anxious" — 命中(紧张/压力大)。' },
  cmplx1e1s013fju0p3w2ikg96: { awardedMarks: 0, reason: '答的是"专注、屏蔽干扰"(填错题),本题要"过去不擅长运动"。' },
  cmplx1pvs013hju0pjer057un: { awardedMarks: 0, reason: '答的是"认为自己勇敢有能力"(填错题),本题要"人手不够的原因(发烧/出国)"。' },
  cmplwxv21010kju0paeaooenv: { awardedMarks: 1, reason: '"trying his best matters as much as winning" — 命中(价值在尽力而非输赢)。' },

  // 郑稀瑜 (ielts_authentic · 段落匹配) — 3 题
  cmplwhpib00siju0pvirzhq27: { awardedMarks: 0, reason: '段落匹配:答 a,正确 C。' },
  cmplwmslt00u2ju0p089icogm: { awardedMarks: 0, reason: '段落匹配:答 e,正确 F。' },
  cmplx3drg0172ju0perk11cfo: { awardedMarks: 0, reason: '段落匹配:答 f,正确 A。' },

  // 孔凡今 (ielts_authentic · 段落匹配) — 2 题
  cmplwkxen00t2ju0p9v7mz8zj: { awardedMarks: 0, reason: '段落匹配:答 A,正确 C。' },
  cmplx1ccf013dju0pum96s06y: { awardedMarks: 0, reason: '段落匹配:答 H,正确 A。' },
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
