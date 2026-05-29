import { PrismaClient } from '@prisma/client';
const p = new PrismaClient();

(async () => {
  const sessionId = process.env.SESSION_ID!;
  const sess = await p.morningQuizSession.findUnique({
    where: { id: sessionId },
    select: { paperAssignment: { select: { paper: { select: { name: true, questions: {
      orderBy: { sortOrder: 'asc' },
      select: { sortOrder: true, marks: true, snapshotContent: true, snapshotOptions: true,
        question: { select: { questionType: true, answerContent: true } } },
    } } } } } },
  });
  const qs = sess!.paperAssignment.paper.questions;
  console.log(`PAPER ${sess!.paperAssignment.paper.name}\n`);
  for (const q of qs) {
    if (q.question.questionType !== 'mcq') continue;
    const sc: any = q.snapshotContent ?? {};
    const opts: any[] = Array.isArray(q.snapshotOptions) ? (q.snapshotOptions as any[]) : [];
    const correctFlags = opts.filter((o) => o?.correct === true).map((o) => o.key);
    // mirror grader logic (student.service.ts:201-272)
    let accepted: string[] | null = null;
    for (const f of ['acceptedKeys', 'acceptableOptionKeys', 'acceptOptions']) {
      const v = sc[f];
      if (Array.isArray(v) && v.every((x: any) => typeof x === 'string')) { accepted = v; break; }
    }
    const correctOpt = opts.find((o) => o?.correct);
    let canonical: string | null = correctOpt?.key ?? null;
    if (!canonical) for (const f of ['correctOption', 'correctAnswer']) {
      const v = sc[f]; if (typeof v === 'string' && v.length > 0 && v.length <= 8) { canonical = v; break; }
    }
    if (!canonical) { const ac: any = q.question.answerContent; if (typeof ac?.text === 'string' && ac.text.length <= 8) canonical = ac.text; }
    const graderAccepts = accepted && accepted.length > 0 ? `ACCEPTED[${accepted.join(',')}]` : `single canonical='${canonical}'`;
    const flag = correctFlags.length > 1 && !(accepted && accepted.length > 1) ? '  ⚠ MULTI-CORRECT but grader single!' : '';
    console.log(`Q@${String(q.sortOrder).padStart(2)} correctFlags=[${correctFlags.join(',')}] → grader ${graderAccepts}${flag}`);
  }
  await p.$disconnect();
})();
