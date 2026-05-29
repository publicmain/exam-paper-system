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
  // 2026-05-29 G11 IELTS Test — 3 levels:
  //   ielts_authentic = Cambridge IELTS 8 Test3 P1 (lightning/lasers)
  //   ielts_simplified = AI hawker-auntie narrative
  //   olevel = AI window-seat narrative

  // 郑瑞尚 (cmpq6t1xf00qsatyrlkqeooxg) — ielts_authentic
  cmpq6tn0n00rmatyrtzbvw11m: { awardedMarks: 0, reason: 'Q4: "cksnxjsk" — 乱码，非有效答案。答案应为 "power companies"。' },
  cmpq6tp5k00roatyrddmnwdcw: { awardedMarks: 0, reason: 'Q5: "fjsixiksd" — 乱码。答案应为 "safely"。' },
  cmpq6tr0000rqatyrfjal5pfc: { awardedMarks: 0, reason: 'Q6: "djshfd" — 乱码。答案应为 "size"。' },

  // 喻耀程 (cmpq73v4l00wjatyrpaxb3ay5) — ielts_simplified · 全部 "nb" 非答案
  cmpq758oy00xbatyrnu9vbpaq: { awardedMarks: 0, reason: 'Q3: "nb" — 非有效答案。' },
  cmpq75af000xfatyrqrlcuu6c: { awardedMarks: 0, reason: 'Q1: "nb" — 非有效答案。' },
  cmpq75bw700xhatyr8xh66e80: { awardedMarks: 0, reason: 'Q7: "nb" — 非有效答案。' },
  cmpq75fix00xlatyrvpjnhs1e: { awardedMarks: 0, reason: 'Q4: "nb" — 非有效答案。' },
  cmpq751zj00wzatyr9g46mw1y: { awardedMarks: 0, reason: 'Q2: "nb" — 非有效答案。' },
  cmpq754h300x3atyrnd3jyxwe: { awardedMarks: 0, reason: 'Q6: "nb" — 非有效答案。' },

  // HEIN HTET NAING (cmpq6y66100ubatyrea1sb2f6) — olevel
  cmpq70vta00v6atyr3356ek7d: { awardedMarks: 0, reason: 'Q2: "Disappointed" 错 — 该句体现父亲细心/可靠，不是失望。' },

  // 李永轩 (cmpq71c8a00vcatyrxcbazyv2) — ielts_simplified · 答案与题号错位，均不对应
  cmpq7b8io0137atyrlh6wsgy2: { awardedMarks: 0, reason: 'Q1: 答的内容与题无关（像是 Q4 的答案）。' },
  cmpq77wid00zdatyrtwc0yy2u: { awardedMarks: 0, reason: 'Q7: 答的是 Q1 的内容（她记得他的常点），未答"承诺"题。' },
  cmpq78fe000zratyrvxcwu79f: { awardedMarks: 0, reason: 'Q3: 答的是早餐内容（Q2），不是"不爱说话"的细节。' },
  cmpq7aiy30125atyr5fnfh5lc: { awardedMarks: 0, reason: 'Q5: "他承诺回来" — 没解释 Auntie Lim 为何加鱼丸。' },
  cmpq7asmp012patyrqpd6ua7j: { awardedMarks: 0, reason: 'Q2: 答的是情绪（Q6），不是早餐订单。' },

  // 王耀星 (cmpq73h0y00vzatyrtguudgx2) — ielts_authentic
  cmpq7cbam014oatyrqiz76j3s: { awardedMarks: 0, reason: 'Q6: "safety" 错 — 难点是 size（激光太大），不是安全。' },
  cmpq7c87s014katyrwchwhf3g: { awardedMarks: 0, reason: 'Q5: "extract electrons" 错 — 答案为 "safely"。' },

  // 郑稀瑜 (cmpq6ues100rxatyri71jthji) — ielts_authentic
  cmpq78afg00zjatyrdvod8l9l: { awardedMarks: 0, reason: 'Q5: "discharge lightning" 不填入句意，答案为 "safely"。' },
  cmpq7avwq012tatyr2b6kycwx: { awardedMarks: 0, reason: 'Q6: "commercial system" 错 — 答案为 "size"。' },

  // 王晨宇 (cmpq74vbn00wuatyrntgizjdy) — ielts_simplified
  cmpq7e39o0184atyrc4bfalrs: { awardedMarks: 0, reason: 'Q4: "不在乎转学" — 未抓住要点（最想念的是 bee hoon 代表的日常）。' },
  cmpq7em2v018oatyrgpmkzgct: { awardedMarks: 1, reason: 'Q3: "Simply nod" — 抓住了"只点头不说话"这一关键细节。' },
  cmpq7g58201b0atyr0cab5mlk: { awardedMarks: 1, reason: 'Q1: "她不用点单就把饭递出来" — 抓住了她记得他常点。' },
  cmpq7fm03019watyrtmygmeta: { awardedMarks: 0, reason: 'Q5: "可能是最后一次吃" — 是学生视角，没答她为何加鱼丸。' },
  cmpq79brw0109atyra0xt2u1z: { awardedMarks: 1, reason: 'Q2: "friedbeehoon fish cake no chili morespring" — 订单要素齐全，仅拼写/空格问题。' },
  cmpq7cwpj015datyr75zi22rk: { awardedMarks: 0, reason: 'Q7: 只答"她想他回来"，漏了"我的承诺也是"（双向承诺）。' },

  // 于琳晶 (cmpq6xfvd00t6atyrni5gppbs) — olevel
  cmpq7epeo018uatyr764g5rsc: { awardedMarks: 0, reason: 'Q8: "她很想念房间" — 漏了母亲也在与家告别这一共有情感。' },
  cmpq7fdt8019iatyr1cy0bhwg: { awardedMarks: 0, reason: 'Q3: 表述不通，未答"为何房间显得更小"。' },
  cmpq7ideo01e3atyrew1q5phy: { awardedMarks: 1, reason: 'Q1: "18 years" = eighteen years，正确。' },
  cmpq7k8ny01gbatyrz52lt2hq: { awardedMarks: 0, reason: 'Q9: 表述不通，未答该意象的作用。' },
  cmpq7let401isatyrryhb7nce: { awardedMarks: 0, reason: 'Q2: "父亲不细心" — 与原意相反。' },
  cmpq7bikz013katyrwcdo9s51: { awardedMarks: 0, reason: 'Q6: "因为她难过" — 太笼统，漏了"想再多待一会儿告别"。' },
  cmpq7cboo014qatyrjg0n5nj5: { awardedMarks: 1, reason: 'Q10: "爱旧房间但已准备好去新房间" — 抓住了"不舍+接受"并存。' },
  cmpq7io1401ejatyru5ug8r4l: { awardedMarks: 0, reason: 'Q4: 表述不通，未答三段记忆的作用。' },
  cmpq7jj4v01fdatyr9bzypd26: { awardedMarks: 0, reason: 'Q5: "不想她难过" — 漏了"担心她熬夜过度用功"的要点。' },

  // 王晨旭 (cmpq765cy00y8atyrosg76qy2) — ielts_simplified
  cmpq7e1e3017yatyrx4zcue1e: { awardedMarks: 1, reason: 'Q5: "是个承诺，她在乎他、希望他长大后回来" — 抓住了告别的用意。' },
  cmpq7jyky01fxatyryw9qo4vd: { awardedMarks: 1, reason: 'Q4: "最重要的是 bee hoon" — 抓住了他最想念的是这日常。' },
  cmpq7ljga01j2atyrgjtzqf64: { awardedMarks: 0, reason: 'Q1: "他每天在这吃" — 是背景，不是"她记得他常点"这个关键事实。' },
  cmpq7g9ah01b6atyrinlbo8co: { awardedMarks: 0, reason: 'Q6: 只答了他难过/不愿答，漏了"她提高音量=告别意义重大"那半。' },
  cmpq77k4f00yzatyrbtldbno2: { awardedMarks: 1, reason: 'Q2: "Fried been hoon, one fish cake, no chilli, more spring onion" — 订单正确（小拼写）。' },
  cmpq7bx960140atyrqu07gyl9: { awardedMarks: 0, reason: 'Q7: 只答她的承诺，漏了"我的也是"（双向）。' },
  cmpq7mx3c01l0atyrafma50gb: { awardedMarks: 0, reason: 'Q3: 答的是她的外貌（蓝围裙/发髻），不是"不爱说话"的证据。' },

  // 孔凡今 (cmpq6vblf00s4atyr6vshwmku) — ielts_authentic
  cmpq7e3ji0186atyrd8z7fsp7: { awardedMarks: 0, reason: 'Q6: "portable" 错 — 激光恰恰"不便携"，难点是 size。' },
  cmpq7ajwy0127atyrn765kwcd: { awardedMarks: 0, reason: 'Q5: "discharge lightning" 错 — 答案为 "safely"。' },

  // 李明阳 (cmpq6zdta00uyatyr4cwvxhug) — ielts_authentic
  cmpq7ocx001ljatyrbj3y2z2s: { awardedMarks: 0, reason: 'Q4: "Promising system" 错 — 答案为 "power companies"。' },

  // 胡鑫瑜 (cmpq6xgmr00tdatyrz1jy9a0u) — olevel
  cmpq7foxt01a4atyrkq2ombgg: { awardedMarks: 1, reason: 'Q3: 没有家具参照 + 记忆放大 → 空房显小，答得准确完整。' },
  cmpq7p5hf01m3atyr54m5rmq8: { awardedMarks: 0, reason: 'Q5: "Because" — 未完成，无内容。' },
  cmpq7k25r01g1atyrlph9odcb: { awardedMarks: 0, reason: 'Q8: "住得久、对他们打击大" — 太笼统，漏了"母亲也在与亲手营造的家告别"。' },
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
