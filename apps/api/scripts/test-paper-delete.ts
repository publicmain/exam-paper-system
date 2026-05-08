import { PrismaClient } from '@prisma/client';
const p = new PrismaClient();
async function tidy() {
  // Order matters because of RESTRICT FKs that aren't auto-cascaded:
  //   Question.createdById -> User
  //   Question.subjectId -> Subject
  //   Subject.examBoardId -> ExamBoard (cascade ok, but we go explicit)
  //   StudentSubmission.studentId -> User (RESTRICT)
  //   PaperAssignment.assignedById -> User (RESTRICT)
  // Strategy: delete the data ROWS bottom-up, then their owners.
  await p.answerScript.deleteMany({});
  await p.studentSubmission.deleteMany({});
  await p.paperAssignment.deleteMany({});
  await p.paperQuestion.deleteMany({});
  await p.paper.deleteMany({ where: { name: { contains: 'fk-test' } } });
  await p.question.deleteMany({});
  await p.subject.deleteMany({ where: { code: 'FKT' } });
  await p.examBoard.deleteMany({ where: { code: 'FK-TEST' } });
  await p.class.deleteMany({ where: { classCode: 'FKT_CLS' } });
  await p.user.deleteMany({
    where: {
      email: { in: ['fk-test-admin@local.test', 'fk-test-stu@local.test'] },
    },
  });
}

(async () => {
  await tidy();
  // Set up fixture mirroring the prod morning-quiz shape.
  const admin = await p.user.create({
    data: {
      email: 'fk-test-admin@local.test',
      name: 'fk-test',
      passwordHash: 'x',
      role: 'admin',
    },
  });
  const student = await p.user.create({
    data: {
      email: 'fk-test-stu@local.test',
      name: 'fk-test-stu',
      passwordHash: 'x',
      role: 'student',
    },
  });
  const board = await p.examBoard.create({ data: { code: 'FK-TEST', name: 'fk-test' } });
  const subject = await p.subject.create({
    data: { examBoardId: board.id, code: 'FKT', name: 'fk-test-subj', level: 'A_LEVEL' },
  });
  const cls = await p.class.create({ data: { name: 'fk-test', classCode: 'FKT_CLS' } });
  const question = await p.question.create({
    data: {
      subjectId: subject.id,
      questionType: 'mcq',
      marks: 1,
      estimatedTimeMin: 1,
      difficulty: 1,
      content: { stem: 'q' },
      answerContent: { text: 'a' },
      options: [{ key: 'A', text: 'a', correct: true }],
      createdById: admin.id,
    },
  });
  const paper = await p.paper.create({
    data: {
      ownerId: admin.id,
      name: 'fk-test paper',
      subjectId: subject.id,
      durationMin: 30,
      totalMarksTarget: 1,
      totalMarksActual: 1,
      generatedSeed: 1,
      config: {},
    },
  });
  const pq = await p.paperQuestion.create({
    data: {
      paperId: paper.id,
      questionId: question.id,
      sortOrder: 1,
      snapshotContent: { stem: 'q' },
      snapshotAnswer: { text: 'a' },
      snapshotOptions: [{ key: 'A', text: 'a', correct: true }],
      marks: 1,
    },
  });
  const assignment = await p.paperAssignment.create({
    data: { paperId: paper.id, classId: cls.id, assignedById: admin.id },
  });
  const submission = await p.studentSubmission.create({
    data: { assignmentId: assignment.id, studentId: student.id, maxScore: 1 },
  });
  const script = await p.answerScript.create({
    data: { submissionId: submission.id, paperQuestionId: pq.id, selectedOption: 'A' },
  });
  console.log('seeded:', { paper: paper.id, pq: pq.id, script: script.id });

  try {
    const r = await p.paper.delete({ where: { id: paper.id } });
    console.log('paper.delete OK:', r.id);
  } catch (e: any) {
    console.log('paper.delete FAILED:', e?.message?.slice(0, 300));
    process.exit(1);
  }
  const remaining = await p.answerScript.count({ where: { id: script.id } });
  console.log('answerScript remaining:', remaining, '(expect 0)');

  await tidy();
  console.log('cleanup OK');
  await p.$disconnect();
})();
