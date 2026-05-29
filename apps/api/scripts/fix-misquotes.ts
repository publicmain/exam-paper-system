import { PrismaClient, Prisma } from '@prisma/client';

const p = new PrismaClient();
const APPLY = process.env.APPLY === '1';

// Exact-substring replacements to make question-stem quotes verbatim with the passage.
const REPL: [string, string][] = [
  ['on the kitchen counter with its lid replaced', 'on the counter with its lid replaced'],
  ['who, I hoped very much, was still alive', 'who, I hoped, was still alive'],
];

function fix(s: string): { out: string; changed: boolean } {
  let out = s;
  for (const [a, b] of REPL) out = out.split(a).join(b);
  return { out, changed: out !== s };
}

(async () => {
  const from = new Date('2026-06-03T00:00:00.000Z');
  const to = new Date('2026-06-04T00:00:00.000Z');

  const sess = await p.morningQuizSession.findFirst({
    where: { date: { gte: from, lt: to }, level: 'olevel', class: { archivedAt: null } },
    select: {
      paperAssignment: {
        select: {
          paper: {
            select: {
              name: true,
              questions: {
                select: { id: true, sortOrder: true, snapshotContent: true, questionId: true },
                orderBy: { sortOrder: 'asc' },
              },
            },
          },
        },
      },
    },
  });

  const paper = sess!.paperAssignment.paper;
  console.log(`Target paper: ${paper.name}`);

  const pqUpdates: { id: string; sortOrder: number; sc: any }[] = [];
  const srcQids: string[] = [];
  for (const pq of paper.questions) {
    const sc = JSON.parse(JSON.stringify(pq.snapshotContent ?? {}));
    const { out, changed } = fix(String(sc.stem ?? ''));
    if (changed) {
      sc.stem = out;
      pqUpdates.push({ id: pq.id, sortOrder: pq.sortOrder, sc });
      srcQids.push(pq.questionId);
    }
  }

  console.log(`\nPLAN: ${pqUpdates.length} snapshot stem(s), ${srcQids.length} source question(s)`);
  for (const u of pqUpdates) {
    const m = String(u.sc.stem).match(/Q\d+\.[^?]*\?/);
    console.log(`  Q${u.sortOrder}: ${m ? m[0].slice(0, 140) : '(stem fixed)'}`);
  }

  if (!APPLY) {
    console.log('\n(DRY RUN — set APPLY=1 to write)');
    await p.$disconnect();
    return;
  }

  let n = 0;
  for (const u of pqUpdates) {
    await p.paperQuestion.update({ where: { id: u.id }, data: { snapshotContent: u.sc as Prisma.InputJsonValue } });
    n++;
  }
  for (const qId of srcQids) {
    const q = await p.question.findUnique({ where: { id: qId }, select: { content: true } });
    if (!q) continue;
    const content = JSON.parse(JSON.stringify(q.content ?? {}));
    const { out, changed } = fix(String(content.stem ?? ''));
    if (changed) {
      content.stem = out;
      await p.question.update({ where: { id: qId }, data: { content: content as Prisma.InputJsonValue } });
      n++;
    }
  }
  console.log(`\n✓ done — ${n} row(s) written`);
  await p.$disconnect();
})();
