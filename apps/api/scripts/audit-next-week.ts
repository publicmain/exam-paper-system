import { PrismaClient } from '@prisma/client';
import { validatePaperStructure } from '../src/morning-quiz/paper-structure-validator';

const p = new PrismaClient();

const FROM = process.env.FROM || '2026-06-02';
const TO = process.env.TO || '2026-06-06'; // exclusive

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
                  sortOrder: true,
                  marks: true,
                  snapshotContent: true,
                  snapshotAnswer: true,
                  snapshotOptions: true,
                  question: { select: { questionType: true } },
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

  // ── PASS 1: structural validator across all 12 ──
  console.log('═══════════════ STRUCTURE CHECK (all 12) ═══════════════');
  let totalViol = 0;
  for (const s of sessions) {
    const paper = s.paperAssignment.paper;
    const viol = validatePaperStructure(paper.questions as any);
    totalViol += viol.length;
    const tag = `${s.date.toISOString().slice(0, 10)} ${s.level}`;
    if (viol.length === 0) {
      console.log(`  ✓ ${tag} — ${paper.questions.length} Q, no structural issues`);
    } else {
      console.log(`  ✗ ${tag} — ${viol.length} issue(s):`);
      for (const v of viol) console.log(`      Q${v.sortOrder} [${v.taskType}] ${v.code}: ${v.detail}`);
    }
  }
  console.log(`\nTotal structural violations: ${totalViol}\n`);

  // ── PASS 2: full content dump for answer-key eyeballing ──
  console.log('═══════════════ FULL CONTENT ═══════════════');
  for (const s of sessions) {
    const paper = s.paperAssignment.paper;
    console.log('\n' + '█'.repeat(64));
    console.log(`${s.date.toISOString().slice(0, 10)} · ${s.level} · ${paper.name} · ${paper.totalMarksActual} marks`);
    console.log('█'.repeat(64));
    let passagePrinted = false;
    for (const pq of paper.questions) {
      const sc = (pq.snapshotContent ?? {}) as any;
      const q = pq.question;
      if (!passagePrinted && sc.passage) {
        const psg = String(sc.passage).replace(/\s+/g, ' ').trim();
        console.log(`\n[PASSAGE${sc.passageTitle ? ' · ' + sc.passageTitle : ''}] ${psg}\n`);
        passagePrinted = true;
      }
      const stem = String(sc.stem ?? '').replace(/\s+/g, ' ').trim();
      const ans =
        (pq.snapshotAnswer as any)?.text ??
        (pq.snapshotAnswer as any)?.markScheme ??
        JSON.stringify(pq.snapshotAnswer ?? {});
      console.log(`Q${pq.sortOrder} [${q?.questionType}/${sc.taskType ?? '?'}] (${pq.marks}m)  ${stem}`);
      const opts = Array.isArray(pq.snapshotOptions) ? (pq.snapshotOptions as any[]) : [];
      if (opts.length) {
        for (const o of opts) console.log(`     ${o?.correct ? '●' : '○'} ${o?.key}: ${o?.text}`);
      }
      console.log(`     ANSWER: ${ans}`);
    }
  }
  await p.$disconnect();
})();
