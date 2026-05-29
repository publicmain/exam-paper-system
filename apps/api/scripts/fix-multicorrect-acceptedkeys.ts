import { PrismaClient, Prisma } from '@prisma/client';

/**
 * Fix multi-correct IELTS "choose FIVE letters" MCQs whose snapshotOptions
 * flag >1 option `correct:true` but whose snapshotContent has no
 * acceptedKeys[] — the grader (student.service.ts) then only honours the
 * FIRST correct option, mis-grading every other correct letter as wrong.
 *
 * Writes snapshotContent.acceptedKeys = [<all correct keys>] on each such
 * PaperQuestion snapshot AND its source Question.content. Idempotent.
 *
 * Usage: SESSION_ID=<id> [APPLY=1] DATABASE_URL=<prod> npx ts-node ...
 */
const p = new PrismaClient();
const APPLY = process.env.APPLY === '1';

function correctKeys(opts: any[]): string[] {
  return opts.filter((o) => o?.correct === true).map((o) => String(o.key));
}
function hasAccepted(sc: any): boolean {
  return ['acceptedKeys', 'acceptableOptionKeys', 'acceptOptions'].some(
    (f) => Array.isArray(sc?.[f]) && sc[f].length > 0,
  );
}

(async () => {
  const sessionId = process.env.SESSION_ID;
  if (!sessionId) { console.error('SESSION_ID required'); process.exit(1); }

  const sess = await p.morningQuizSession.findUnique({
    where: { id: sessionId },
    select: {
      paperAssignment: { select: { paper: { select: { name: true, questions: {
        orderBy: { sortOrder: 'asc' },
        select: { id: true, sortOrder: true, questionId: true, snapshotContent: true, snapshotOptions: true,
          question: { select: { questionType: true } } },
      } } } } },
    },
  });
  const paper = sess!.paperAssignment.paper;
  console.log(`Paper: ${paper.name}\n`);

  const pqUpdates: { id: string; sortOrder: number; sc: any; keys: string[] }[] = [];
  const srcTargets = new Map<string, string[]>(); // questionId -> keys

  for (const pq of paper.questions) {
    if (pq.question.questionType !== 'mcq') continue;
    const opts = Array.isArray(pq.snapshotOptions) ? (pq.snapshotOptions as any[]) : [];
    const keys = correctKeys(opts);
    const sc = JSON.parse(JSON.stringify(pq.snapshotContent ?? {}));
    if (keys.length > 1 && !hasAccepted(sc)) {
      sc.acceptedKeys = keys;
      pqUpdates.push({ id: pq.id, sortOrder: pq.sortOrder, sc, keys });
      srcTargets.set(pq.questionId, keys);
    }
  }

  console.log(`PLAN: ${pqUpdates.length} snapshot(s), ${srcTargets.size} source question(s)`);
  for (const u of pqUpdates) console.log(`  Q@${u.sortOrder}: acceptedKeys=[${u.keys.join(',')}]`);

  if (!APPLY) { console.log('\n(DRY RUN — set APPLY=1 to write)'); await p.$disconnect(); return; }

  let n = 0;
  for (const u of pqUpdates) {
    await p.paperQuestion.update({ where: { id: u.id }, data: { snapshotContent: u.sc as Prisma.InputJsonValue } });
    n++;
  }
  for (const [qId, keys] of srcTargets) {
    const q = await p.question.findUnique({ where: { id: qId }, select: { content: true } });
    if (!q) continue;
    const content = JSON.parse(JSON.stringify(q.content ?? {}));
    if (!hasAccepted(content)) {
      content.acceptedKeys = keys;
      await p.question.update({ where: { id: qId }, data: { content: content as Prisma.InputJsonValue } });
      n++;
    }
  }
  console.log(`\n✓ done — ${n} row(s) written`);
  await p.$disconnect();
})();
