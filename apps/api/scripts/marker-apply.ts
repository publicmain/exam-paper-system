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
  // 2026-06-03 G11 morning-quiz — 2 papers / 3 levels:
  //   olevel           = ai_authored_olevel_20_unsent_letter_v1/Paper2 (Ah Ma · Bukit Merah 旧居 · 未寄出的信)
  //   ielts_simplified = ai_authored_olevel_simplified_13_spelling_bee_v1/Paper2 (拼字比赛 · "fastidious")
  // 23 short-answer scripts, all maxMarks=1.

  // 喻耀程 (olevel · unsent letter) — 3 题全填 "nb"，非有效作答
  cmpxbzkgt00tsz1nj79t5kles: { awardedMarks: 0, reason: 'Q1: "nb" — 非有效答案。' },
  cmpxbzixb00toz1njqz7z9ngb: { awardedMarks: 0, reason: 'Q10: "nb" — 非有效答案。' },
  cmpxbzm4400tyz1njokx87be0: { awardedMarks: 0, reason: 'Q3: "nb" — 非有效答案。' },

  // 王晨宇 (ielts_simplified · spelling bee)
  cmpxcmkqc0143z1njslo17ejb: { awardedMarks: 0, reason: 'Q6: 答的是"从失败中学到教训"，没解释引语本意（可避免的失误比能力不足之败更痛）。' },

  // HEIN HTET NAING (olevel · unsent letter) — 6 题
  cmpxctvo301abz1njxnjd1a1f: { awardedMarks: 0, reason: 'Q7: "她做完了该做的事" — 含糊，漏了短句 "That was all" 的效果＝决定已定、无需多言。' },
  cmpxcul5301arz1njpbsr82dd: { awardedMarks: 0, reason: 'Q6(b): "怕弄丢" — 纯实用理由，漏了"视若身份证般珍重＝信极重要"的推断。' },
  cmpxcuyd601bmz1njuhrzj0yj: { awardedMarks: 0, reason: 'Q2(b): "觉得物件重要" — 表层，漏了"无声哀悼、每件旧物承载对 Ah Ma 的记忆"。' },
  cmpxcx1r801e9z1njri07m7sp: { awardedMarks: 0, reason: 'Q1: "他觉得母亲不会做" — 含糊，漏了"母亲需要情感支持、不愿独自面对"。' },
  cmpxcxw6y01fhz1njsmtbqb8u: { awardedMarks: 0, reason: 'Q6(a): "又软又弱" — 只解释 fragile 词义，没答母亲"如何小心翼翼地拿"。' },
  cmpxcy1yi01fvz1nj6yj3wsa4: { awardedMarks: 0, reason: 'Q10: "珍惜与家人的时间" — 泛化说教，漏了温柔中带焦虑/迟到 37 年/盼妹妹仍在的具体效果。' },

  // 于琳晶 (olevel · unsent letter) — 5 题
  cmpxcmiab013xz1nj5g2x3o3h: { awardedMarks: 1, reason: 'Q2(b): "暗示母亲其实很思念外婆" — 命中无声哀悼/思念这一要点。' },
  cmpxcpk42016az1njcuiiing9: { awardedMarks: 0, reason: 'Q2(a): "她是个活泼的女人" — 与"日复一日的固定习惯"无关，错。' },
  cmpxcw3pm01d5z1nj9x6aq55o: { awardedMarks: 1, reason: 'Q4: "她不想生前被人发现" — 命中"刻意藏起、非遗忘"这一推断。' },
  cmpxcxfa401enz1njtpb6peja: { awardedMarks: 1, reason: 'Q6(b): "她非常看重这封信" — 命中"信极重要"的意义推断。' },
  cmpxcr0jv018fz1nj2hwrchu1: { awardedMarks: 1, reason: 'Q6(a): "非常小心" — 直接命中"小心翼翼地拿"。' },

  // 王晨旭 (ielts_simplified · spelling bee) — 7 题
  cmpxcsawe018sz1njw6pmsj7s: { awardedMarks: 1, reason: 'Q6: "本该拼对、因太急拼错，比根本不会拼更难过" — 准确解释引语本意。' },
  cmpxcu80i01adz1njeme5a8mj: { awardedMarks: 1, reason: 'Q2: "得意/自豪却保持谦虚、不外露喜悦" — 命中。' },
  cmpxcutxs01b9z1njvhce7axo: { awardedMarks: 0, reason: 'Q7: "忘不了今天" — 含糊，漏了"每天提醒自己吸取教训/别再犯同样的错"。' },
  cmpxcwllf01dpz1njgzpt39ii: { awardedMarks: 1, reason: 'Q1: "准备了六个月" — 有效细节，得分。' },
  cmpxcxrh501f9z1njwaubzn6k: { awardedMarks: 1, reason: 'Q5: "Mr Tan 对她的遭遇心生同情" — 命中无言的安慰/善意。' },
  cmpxczfn401i3z1njkbhcx7rq: { awardedMarks: 1, reason: 'Q4: "强烈震惊与深深失望" — 命中身体被冲击/震惊的效果。' },
  cmpxczrw601i5z1njwp7p6m9v: { awardedMarks: 1, reason: 'Q3: "太急、想快点赢" — 命中"操之过急、草率作答"。' },

  // 胡鑫瑜 (olevel · unsent letter)
  cmpxcnt1v015rz1njlwvnd0js: { awardedMarks: 0, reason: 'Q9: 误读为"母亲想回家私下拆信"，实则信属 Aunt Hooi、不该由他们拆 — 偏离要点。' },
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
