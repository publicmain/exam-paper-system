import { PrismaClient } from '@prisma/client';

/**
 * One-off content re-grade for 李永轩 (submission cmpq71c8a00vcatyrxcbazyv2).
 * He answered the shuffled boxes positionally, so his (mostly correct)
 * answers landed in the wrong question boxes. Per teacher decision, we
 * credit the boxes that actually contain a correct answer:
 *   - cmpq77wid (Q7 box) holds the Q1-correct answer → 1
 *   - cmpq7b8io (Q1 box) holds the Q4 answer (bee-hoon focus) → 1
 * The other three stay 0. Then recompute the submission total.
 */
const SUBMISSION_ID = 'cmpq71c8a00vcatyrxcbazyv2';
const OVERRIDES: Record<string, { awardedMarks: number; reason: string }> = {
  cmpq77wid00zdatyrtwc0yy2u: {
    awardedMarks: 1,
    reason: '内容重评：此框虽是 Q7，但你填的"她记得我的常点、不用问就备好"正确回答了 Q1（她很了解你）→ 给分。注意题目是随机顺序，请认准题号作答。',
  },
  cmpq7b8io0137atyrlh6wsgy2: {
    awardedMarks: 1,
    reason: '内容重评：此框虽是 Q1，但你填的"专注吃早餐/不去想搬家"回答了 Q4（满脑子 bee hoon 的暗示）→ 给分。题目随机顺序，请认准题号。',
  },
};

const prisma = new PrismaClient();
(async () => {
  const admin = await prisma.user.findFirst({
    where: { role: 'admin' },
    orderBy: { createdAt: 'asc' },
    select: { id: true, name: true },
  });
  if (!admin) {
    console.error('no admin');
    process.exit(1);
  }

  for (const [scriptId, { awardedMarks, reason }] of Object.entries(OVERRIDES)) {
    await prisma.answerScript.update({
      where: { id: scriptId },
      data: { awardedMarks, markerComment: reason, markedById: admin.id, markedAt: new Date() },
    });
    console.log(`override ${scriptId} → ${awardedMarks}`);
  }

  // Recompute submission totals (mirror marker.service.finalize).
  const sub = await prisma.studentSubmission.findUnique({
    where: { id: SUBMISSION_ID },
    include: {
      student: { select: { name: true } },
      scripts: {
        include: { paperQuestion: { include: { question: { select: { questionType: true } } } } },
      },
    },
  });
  if (!sub) {
    console.error('submission gone');
    process.exit(1);
  }
  let mcq = 0;
  let auto = 0;
  let manual = 0;
  for (const s of sub.scripts) {
    const t = s.paperQuestion.question.questionType;
    if (t === 'mcq') {
      mcq += s.awardedMarks ?? 0;
      continue;
    }
    if (s.awardedMarks == null) continue;
    if (s.markedById != null) manual += s.awardedMarks;
    else auto += s.awardedMarks;
  }
  auto += mcq;
  const total = auto + manual;
  await prisma.studentSubmission.update({
    where: { id: SUBMISSION_ID },
    data: { autoScore: auto, manualScore: manual, totalScore: total },
  });
  console.log(`\n${sub.student.name}: auto=${auto} manual=${manual} total=${total}/${sub.maxScore}`);
  await prisma.$disconnect();
})();
