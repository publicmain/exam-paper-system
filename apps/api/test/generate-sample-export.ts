// One-shot helper: generate a sample .xlsx workbook and write it under
// docs/qa-reports/round-4-self-verification/sample-export.xlsx so a
// reviewer can open it without spinning up the API. Mirrors the test
// fixture in morning-quiz.spec.ts.
//
// Usage from repo root:
//   cd apps/api && npx tsx test/generate-sample-export.ts

import { writeFileSync } from 'fs';
import { resolve } from 'path';
import { MorningQuizExportService } from '../src/morning-quiz/morning-quiz-export.service';

async function main() {
  const sessions = [
    {
      id: 's1',
      date: new Date('2026-05-04T00:00:00Z'),
      classId: 'P5A',
      class: { id: 'P5A', name: 'P5A — IELTS Authentic' },
      paperAssignment: { paperId: 'paper-mon' },
    },
    {
      id: 's2',
      date: new Date('2026-05-05T00:00:00Z'),
      classId: 'P5A',
      class: { id: 'P5A', name: 'P5A — IELTS Authentic' },
      paperAssignment: { paperId: 'paper-tue' },
    },
    {
      id: 's3',
      date: new Date('2026-05-06T00:00:00Z'),
      classId: 'P5A',
      class: { id: 'P5A', name: 'P5A — IELTS Authentic' },
      paperAssignment: { paperId: 'paper-wed' },
    },
    {
      id: 's4',
      date: new Date('2026-05-04T00:00:00Z'),
      classId: 'P4B',
      class: { id: 'P4B', name: 'P4B — O Level' },
      paperAssignment: { paperId: 'paper-mon-ol' },
    },
  ];
  const students: Array<{ id: string; name: string }> = [
    { id: 'stu-1', name: '张三 Alice' },
    { id: 'stu-2', name: '李四 Bob' },
    { id: 'stu-3', name: '王五 Carol' },
    { id: 'stu-4', name: '赵六 David' },
  ];
  const attendances: any[] = [];
  for (const sess of sessions) {
    for (const stu of students) {
      const onTime = Math.random() < 0.7;
      const late = !onTime && Math.random() < 0.5;
      attendances.push({
        id: `att-${sess.id}-${stu.id}`,
        sessionId: sess.id,
        studentId: stu.id,
        student: stu,
        status: onTime ? 'on_time' : late ? 'late' : 'absent',
        scanTime: onTime || late
          ? new Date(sess.date.getTime() + 30 * 60_000 + Math.random() * 600_000)
          : null,
        submissionId: onTime || late ? `sub-${sess.id}-${stu.id}` : null,
      });
    }
  }
  const submissions = attendances
    .filter((a) => a.submissionId)
    .map((a) => ({
      id: a.submissionId,
      submittedAt: new Date(a.scanTime.getTime() + 25 * 60_000),
      scripts: Array.from({ length: 12 }).map((_, i) => ({
        paperQuestionId: `pq-${a.sessionId}-${i}`,
        selectedOption: ['A', 'B', 'C', 'D'][Math.floor(Math.random() * 4)],
        autoCorrect: Math.random() < 0.65,
        awardedMarks: Math.random() < 0.65 ? 1 : 0,
      })),
    }));

  const prismaStub = {
    morningQuizSession: { findMany: async () => sessions },
    attendance: { findMany: async () => attendances },
    studentSubmission: { findMany: async () => submissions },
  } as any;
  const auditStub = { log: async () => {} } as any;
  const svc = new MorningQuizExportService(prismaStub, auditStub);
  const buf = await svc.generateAttendanceWorkbook(
    { from: '2026-05-04', to: '2026-05-08' },
    { id: 'admin-sample', role: 'admin', ip: null },
  );
  const out = resolve(__dirname, '../../../docs/qa-reports/round-4-self-verification/sample-export.xlsx');
  writeFileSync(out, buf);
  // eslint-disable-next-line no-console
  console.log(`wrote ${buf.length} bytes → ${out}`);
}

main().catch((e) => {
  // eslint-disable-next-line no-console
  console.error(e);
  process.exit(1);
});
