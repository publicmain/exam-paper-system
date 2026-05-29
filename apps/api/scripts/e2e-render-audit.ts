import { PrismaClient } from '@prisma/client';

const CLASS_ID = 'cmoux0jj900m9oc28r4sptjj0';
const p = new PrismaClient();

(async () => {
  const from = new Date('2026-06-02T00:00:00.000Z');
  const to = new Date('2026-06-06T00:00:00.000Z');

  const sessions = await p.morningQuizSession.findMany({
    where: { classId: CLASS_ID, date: { gte: from, lt: to } },
    select: {
      id: true, date: true, level: true,
      paperAssignment: {
        select: {
          paper: {
            select: {
              name: true, totalMarksActual: true,
              questions: {
                orderBy: { sortOrder: 'asc' },
                select: {
                  sortOrder: true, marks: true,
                  snapshotContent: true, snapshotOptions: true, snapshotAnswer: true,
                  question: { select: { questionType: true } },
                },
              },
            },
          },
        },
      },
    },
    orderBy: [{ date: 'asc' }, { level: 'asc' }],
  });

  let totalIssues = 0;
  for (const s of sessions) {
    const paper = s.paperAssignment.paper;
    const tag = `${s.date.toISOString().slice(0, 10)} ${s.level}`;
    const types: Record<string, number> = {};
    const issues: string[] = [];
    let markSum = 0;

    for (const q of paper.questions) {
      const qt = q.question.questionType;
      types[qt] = (types[qt] ?? 0) + 1;
      markSum += q.marks ?? 0;
      const sc: any = q.snapshotContent ?? {};
      const stem = String(sc.stem ?? '').trim();
      if (!stem) issues.push(`Q@${q.sortOrder} ${qt}: EMPTY stem`);

      const opts = Array.isArray(q.snapshotOptions) ? (q.snapshotOptions as any[]) : null;
      if (qt === 'mcq') {
        if (!opts || opts.length < 2) issues.push(`Q@${q.sortOrder}: mcq has <2 options`);
        else {
          const nCorrect = opts.filter((o) => o?.correct === true).length;
          if (nCorrect !== 1) issues.push(`Q@${q.sortOrder}: mcq has ${nCorrect} correct flags (want 1)`);
          const blankOpt = opts.filter((o) => !String(o?.text ?? '').trim()).length;
          if (blankOpt) issues.push(`Q@${q.sortOrder}: mcq has ${blankOpt} blank option text`);
        }
      } else {
        const ans: any = q.snapshotAnswer ?? {};
        const has = ans && (ans.answer ?? ans.expected ?? ans.text ?? (typeof ans === 'string' ? ans : null));
        if (!has && Object.keys(ans).length === 0) issues.push(`Q@${q.sortOrder} ${qt}: no snapshotAnswer/mark-scheme`);
      }
    }

    const typeStr = Object.entries(types).map(([k, v]) => `${k}:${v}`).join(' ');
    const markOk = markSum === (paper.totalMarksActual ?? -1);
    console.log(`\n── ${tag} · "${paper.name}"`);
    console.log(`   Q=${paper.questions.length}  types[${typeStr}]  marks Σ${markSum}/${paper.totalMarksActual}${markOk ? ' ✓' : ' ✗MISMATCH'}`);
    if (!markOk) totalIssues++;
    if (issues.length) { totalIssues += issues.length; issues.forEach((i) => console.log(`   ⚠ ${i}`)); }
    else console.log(`   ✓ all stems present, MCQ keys valid, non-MCQ have mark-scheme`);
  }

  console.log(`\n═══ ${sessions.length} papers audited · ${totalIssues} issue(s) ═══`);
  await p.$disconnect();
})();
