import { PrismaClient, Prisma } from '@prisma/client';

const p = new PrismaClient();

const FROM = process.env.FROM || '2026-06-02';
const TO = process.env.TO || '2026-06-06'; // exclusive
const APPLY = process.env.APPLY === '1';

const OLD_OPT = 'confident-still';
const NEW_OPT = 'still confident';

// Replace "Section B [N marks]" → "Section B [<target> marks]". Idempotent.
function fixStem(stem: string, target: number): { out: string; changed: boolean; matched: boolean } {
  const re = /Section\s+B\s+\[\s*\d+\s*marks?\s*\]/gi;
  const matched = re.test(stem);
  re.lastIndex = 0;
  const out = stem.replace(re, `Section B [${target} marks]`);
  return { out, changed: out !== stem, matched };
}

(async () => {
  const from = new Date(`${FROM}T00:00:00.000Z`);
  const to = new Date(`${TO}T00:00:00.000Z`);

  const sessions = await p.morningQuizSession.findMany({
    where: { date: { gte: from, lt: to }, class: { archivedAt: null } },
    select: {
      date: true,
      level: true,
      paperAssignment: {
        select: {
          paper: {
            select: {
              id: true,
              name: true,
              totalMarksActual: true,
              questions: {
                select: {
                  id: true,
                  sortOrder: true,
                  snapshotContent: true,
                  snapshotOptions: true,
                  questionId: true,
                },
                orderBy: { sortOrder: 'asc' },
              },
            },
          },
        },
      },
    },
    orderBy: [{ date: 'asc' }, { level: 'asc' }],
  });

  // plan accumulators
  const pqStemUpdates: { id: string; tag: string; sc: any }[] = [];
  const srcStemTargets = new Map<string, number>(); // qId -> target marks
  const pqOptUpdates: { id: string; tag: string; opts: any[] }[] = [];
  const srcOptQids = new Set<string>();

  for (const s of sessions) {
    const paper = s.paperAssignment.paper;
    const total = paper.totalMarksActual ?? 0;
    const tag = `${s.date.toISOString().slice(0, 10)} ${s.level}`;

    // ── Nit #1: mark-label ──
    for (const pq of paper.questions) {
      const sc = JSON.parse(JSON.stringify(pq.snapshotContent ?? {}));
      const stem = String(sc.stem ?? '');
      const { out, changed, matched } = fixStem(stem, total);
      if (changed) {
        sc.stem = out;
        pqStemUpdates.push({ id: pq.id, tag: `${tag} Q${pq.sortOrder}`, sc });
        srcStemTargets.set(pq.questionId, total); // source needs same target
      } else if (!matched) {
        // only worry if this paper is one we expect to fix and there is a stale token
        const tok = stem.match(/\[\s*\d+\s*marks?\s*\]/i);
        if (tok && parseInt(tok[0].replace(/[^\d]/g, ''), 10) !== total) {
          console.warn(`  ⚠ ${tag} Q${pq.sortOrder}: stale token ${tok[0]} but no "Section B [..]" anchor — NOT auto-fixed`);
        }
      }
    }

    // ── Nit #2: confident-still rename (spelling_bee) ──
    for (const pq of paper.questions) {
      const opts = Array.isArray(pq.snapshotOptions) ? JSON.parse(JSON.stringify(pq.snapshotOptions)) : null;
      if (!opts) continue;
      let hit = false;
      for (const o of opts) {
        if (String(o?.text) === OLD_OPT) {
          o.text = NEW_OPT;
          hit = true;
        }
      }
      if (hit) {
        pqOptUpdates.push({ id: pq.id, tag: `${tag} Q${pq.sortOrder}`, opts });
        srcOptQids.add(pq.questionId);
      }
    }
  }

  // ── report ──
  console.log('═══ PLAN ═══');
  console.log(`Nit#1 mark-label: ${pqStemUpdates.length} PaperQuestion snapshot(s), ${srcStemTargets.size} source Question(s)`);
  for (const u of pqStemUpdates) {
    const m = String(u.sc.stem).match(/Section\s+B\s+\[\s*\d+\s*marks?\s*\]/i);
    console.log(`   ${u.tag} → ${m?.[0]}`);
  }
  console.log(`Nit#2 option rename "${OLD_OPT}"→"${NEW_OPT}": ${pqOptUpdates.length} PaperQuestion snapshot(s), ${srcOptQids.size} source Question(s)`);
  for (const u of pqOptUpdates) console.log(`   ${u.tag}`);

  if (!APPLY) {
    console.log('\n(DRY RUN — set APPLY=1 to write)');
    await p.$disconnect();
    return;
  }

  // ── apply (sequential, no transaction; all ops idempotent so safe to re-run) ──
  console.log('\n═══ APPLYING ═══');
  let n = 0;
  // Nit#1 snapshots
  for (const u of pqStemUpdates) {
    await p.paperQuestion.update({ where: { id: u.id }, data: { snapshotContent: u.sc as Prisma.InputJsonValue } });
    n++;
  }
  // Nit#1 source bank
  for (const [qId, target] of srcStemTargets) {
    const q = await p.question.findUnique({ where: { id: qId }, select: { content: true } });
    if (!q) continue;
    const content = JSON.parse(JSON.stringify(q.content ?? {}));
    const { out, changed } = fixStem(String(content.stem ?? ''), target);
    if (changed) {
      content.stem = out;
      await p.question.update({ where: { id: qId }, data: { content: content as Prisma.InputJsonValue } });
      n++;
    }
  }
  // Nit#2 snapshots
  for (const u of pqOptUpdates) {
    await p.paperQuestion.update({ where: { id: u.id }, data: { snapshotOptions: u.opts as Prisma.InputJsonValue } });
    n++;
  }
  // Nit#2 source bank
  for (const qId of srcOptQids) {
    const q = await p.question.findUnique({ where: { id: qId }, select: { options: true } });
    if (!q || !Array.isArray(q.options)) continue;
    const opts = JSON.parse(JSON.stringify(q.options));
    let changed = false;
    for (const o of opts) if (String(o?.text) === OLD_OPT) { o.text = NEW_OPT; changed = true; }
    if (changed) { await p.question.update({ where: { id: qId }, data: { options: opts as Prisma.InputJsonValue } }); n++; }
  }
  console.log(`✓ done — ${n} row(s) written`);
  await p.$disconnect();
})();
