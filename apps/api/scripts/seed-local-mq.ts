/**
 * Seed a local DB with everything required for the morning-quiz end-to-end test.
 *
 *   - 1 admin (admin@school.local / admin123)
 *   - 1 class (TEST_MQ) with englishLevel=ielts_authentic
 *   - 6 students (s001-s006) enrolled
 *   - 1 ExamBoard "IELTS" + Subject IELTS / component AUTH
 *   - 13 active questions sharing one passage (sourceRef IELTS/SEED/Test1/P1/Q1..Q13)
 *     covering all 8 IELTS Reading task types so the UI can be exercised
 *     against every render path.
 *
 * Idempotent — re-running cleans previous seed rows first.
 */
import { PrismaClient, EnglishLevel, QuestionType, QuestionStatus } from '@prisma/client';
import * as bcrypt from 'bcryptjs';

const p = new PrismaClient();

const PASSAGE = `Reading Passage 1: A Chronicle of Timekeeping

Our conception of time depends on the way we measure it.

A According to archaeological evidence, at least 5,000 years ago, and long before the advent of the Roman Empire, the Babylonians began to measure time, introducing calendars to coordinate communal activities, to plan the shipment of goods and, in particular, to regulate planting and harvesting. They based their calendars on three natural cycles: the solar day, marked by the successive periods of light and darkness as the earth rotates on its axis; the lunar month, following the phases of the moon as it orbits the earth; and the solar year, defined by the changing seasons that accompany our planet's revolution around the sun.

B Before the introduction of the Julian calendar in 46 BC, the Roman calendar was based on a system of "kalends", "nones" and "ides" — fixed reference points within each month from which other days were counted backwards. The system was so confusing that even the Romans themselves often struggled to know the date.

C Astronomical clocks, like the one created by Su Sung of China in 1090, used falling water to drive elaborate mechanisms. Su Sung's clock could measure time as accurately as half an hour, a feat unmatched in the West for several centuries.

D In 14th-century Europe, the desire to coordinate religious observances drove monks to invent ever more sophisticated mechanical clocks. Around 1330, a clock mechanism was developed in Italy that used an "escape wheel", which beat each second by releasing the gear train one tooth at a time. Without the escape wheel, modern timekeeping would not have been possible.

E The pendulum clock, perfected by the Dutch scientist Christiaan Huygens in 1656, was for two centuries the most accurate timepiece available. Its precision changed the way people thought about, and used, time.

F The discovery of the piezoelectric effect in 1880 paved the way for quartz clocks, which by the 1930s had displaced pendulum clocks for laboratory work. Today, atomic clocks regulated by the natural oscillations of caesium atoms achieve accuracies measured in nanoseconds per century.`;

async function tidy() {
  // Delete in dependency order. Use raw TRUNCATE CASCADE on the public schema
  // so we don't have to track every FK that's been added since this script
  // was written. Idempotent on a fresh DB too — TRUNCATE on empty tables is
  // a no-op. We list every model the prisma schema exports to avoid CASCADE
  // accidentally hitting tables we forgot.
  await p.$executeRawUnsafe(`
    TRUNCATE TABLE
      "AnswerScript", "StudentSubmission", "Attendance",
      "MorningQuizSession", "PaperVariantAssignment",
      "PaperAssignment", "WatermarkToken",
      "QuestionShuffleMap", "PaperQuestion", "PaperVersion",
      "QuestionUsageLog", "Paper", "PaperTemplate",
      "ClassEnglishLevel", "ClassEnrollment", "Class",
      "QuestionTopic", "QuestionVersion", "QuestionAsset",
      "QuestionItemTopic", "TeacherReview", "MarkSchemeItem",
      "QuestionPart", "IngestedAsset", "QuestionItem",
      "PdfPage", "SourceFile", "SourceRepository",
      "Question", "Topic", "SyllabusComponent", "Subject", "ExamBoard",
      "MarkerAssignment", "TutorMessage", "TutorSession",
      "CodeSubmissionResult", "CodeQuestionTestCase",
      "QuestionQualitySignal", "NotificationLog", "NotificationConfig",
      "AuditLog", "User"
    RESTART IDENTITY CASCADE
  `);
}

async function main() {
  console.log('tidying...');
  await tidy();

  const passwordHash = await bcrypt.hash('admin123', 10);
  const studentPwHash = await bcrypt.hash('student', 10);

  console.log('users...');
  const admin = await p.user.create({
    data: {
      email: 'admin@school.local',
      name: 'Admin',
      passwordHash,
      role: 'admin',
    },
  });
  const students: Array<{ id: string; name: string }> = [];
  const studentNames = [
    '王小明', '李小红', '张大伟', '陈雪琪', '刘子豪', '赵婧怡',
  ];
  for (let i = 0; i < studentNames.length; i++) {
    const name = studentNames[i];
    const u = await p.user.create({
      data: {
        email: `s${String(i + 1).padStart(3, '0')}@esic.local`,
        name,
        passwordHash: studentPwHash,
        role: 'student',
      },
    });
    students.push({ id: u.id, name });
  }

  console.log('class + level...');
  const cls = await p.class.create({
    data: { name: 'G11 IELTS Test', classCode: 'TEST_MQ' },
  });
  await p.classEnglishLevel.create({
    data: { classId: cls.id, level: EnglishLevel.ielts_authentic, effectiveFrom: new Date() },
  });
  for (const s of students) {
    await p.classEnrollment.create({
      data: { classId: cls.id, userId: s.id, role: 'student' },
    });
  }

  console.log('board + subject + component...');
  const board = await p.examBoard.create({ data: { code: 'IELTS', name: 'IELTS' } });
  const subject = await p.subject.create({
    data: { examBoardId: board.id, code: 'IELTS', name: 'IELTS Academic Reading', level: 'CEFR' },
  });
  const comp = await p.syllabusComponent.create({
    data: { subjectId: subject.id, code: 'AUTH', name: 'Cambridge IELTS authentic' },
  });

  console.log('13 questions across 8 taskTypes...');
  // Question 1-4: matching_information (paragraph A-F)
  const headerInstrInfo =
    'Reading Passage 1 has six paragraphs, A–F. Which paragraph contains the following information? Write the correct letter, A–F, in boxes 1–4 on your answer sheet.';
  const qsSeed: Array<{
    n: number;
    qType: QuestionType;
    taskType: string;
    instruction: string;
    item: string;
    options: any;
    answer: any;
  }> = [
    { n: 1, qType: 'short_answer', taskType: 'matching_information', instruction: headerInstrInfo, item: 'a description of an early timekeeping invention affected by cold temperatures', options: null, answer: { text: 'D' } },
    { n: 2, qType: 'short_answer', taskType: 'matching_information', instruction: headerInstrInfo, item: 'a mention of the very first method humans used to measure time', options: null, answer: { text: 'A' } },
    // 3-5: matching_headings (Roman numerals)
    {
      n: 3, qType: 'short_answer', taskType: 'matching_headings',
      instruction: 'Choose the correct heading for paragraphs B–D from the list of headings below. Write the correct number, i–v, in boxes 3–5 on your answer sheet.\n\nList of Headings\ni. The first reliable mechanical clocks\nii. A confusing dating system\niii. Modern atomic precision\niv. Hydraulic ingenuity in ancient China\nv. The pendulum revolution',
      item: 'Paragraph B', options: null, answer: { text: 'ii' },
    },
    {
      n: 4, qType: 'short_answer', taskType: 'matching_headings',
      instruction: 'Choose the correct heading for paragraphs B–D from the list of headings below. Write the correct number, i–v, in boxes 3–5 on your answer sheet.\n\nList of Headings\ni. The first reliable mechanical clocks\nii. A confusing dating system\niii. Modern atomic precision\niv. Hydraulic ingenuity in ancient China\nv. The pendulum revolution',
      item: 'Paragraph C', options: null, answer: { text: 'iv' },
    },
    {
      n: 5, qType: 'short_answer', taskType: 'matching_headings',
      instruction: 'Choose the correct heading for paragraphs B–D from the list of headings below. Write the correct number, i–v, in boxes 3–5 on your answer sheet.\n\nList of Headings\ni. The first reliable mechanical clocks\nii. A confusing dating system\niii. Modern atomic precision\niv. Hydraulic ingenuity in ancient China\nv. The pendulum revolution',
      item: 'Paragraph D', options: null, answer: { text: 'i' },
    },
    // 6-7: matching_features (bank A-F)
    {
      n: 6, qType: 'mcq', taskType: 'matching_features',
      instruction: 'Look at the following events (Questions 6–7) and the list of nationalities below. Match each event with the correct nationality, A–F.',
      item: 'They were the first to use calendars to plan harvests.',
      options: [
        { key: 'A', text: 'Babylonians', correct: true },
        { key: 'B', text: 'Egyptians', correct: false },
        { key: 'C', text: 'Romans', correct: false },
        { key: 'D', text: 'Chinese', correct: false },
        { key: 'E', text: 'Italians', correct: false },
        { key: 'F', text: 'Dutch', correct: false },
      ],
      answer: { text: 'A' },
    },
    {
      n: 7, qType: 'mcq', taskType: 'matching_features',
      instruction: 'Look at the following events (Questions 6–7) and the list of nationalities below. Match each event with the correct nationality, A–F.',
      item: 'They built water clocks that surpassed Western precision for centuries.',
      options: [
        { key: 'A', text: 'Babylonians', correct: false },
        { key: 'B', text: 'Egyptians', correct: false },
        { key: 'C', text: 'Romans', correct: false },
        { key: 'D', text: 'Chinese', correct: true },
        { key: 'E', text: 'Italians', correct: false },
        { key: 'F', text: 'Dutch', correct: false },
      ],
      answer: { text: 'D' },
    },
    // 8: multiple_choice (4 distinct options)
    {
      n: 8, qType: 'mcq', taskType: 'multiple_choice',
      instruction: 'Choose the correct letter, A, B, C or D.',
      item: 'According to paragraph A, the Babylonians used calendars mainly for',
      options: [
        { key: 'A', text: 'religious ceremonies.', correct: false },
        { key: 'B', text: 'planting and harvesting.', correct: true },
        { key: 'C', text: 'astronomy.', correct: false },
        { key: 'D', text: 'literature.', correct: false },
      ],
      answer: { text: 'B' },
    },
    // 9-10: yes_no_not_given
    {
      n: 9, qType: 'mcq', taskType: 'yes_no_not_given',
      instruction: 'Do the following statements agree with the views of the writer in Reading Passage 1? Write YES, NO, or NOT GIVEN.',
      item: 'The escape wheel mechanism made modern timekeeping possible.',
      options: [
        { key: 'A', text: 'YES', correct: true },
        { key: 'B', text: 'NO', correct: false },
        { key: 'C', text: 'NOT GIVEN', correct: false },
      ],
      answer: { text: 'A' },
    },
    {
      n: 10, qType: 'mcq', taskType: 'yes_no_not_given',
      instruction: 'Do the following statements agree with the views of the writer in Reading Passage 1? Write YES, NO, or NOT GIVEN.',
      item: 'Atomic clocks have been adopted by every country worldwide.',
      options: [
        { key: 'A', text: 'YES', correct: false },
        { key: 'B', text: 'NO', correct: false },
        { key: 'C', text: 'NOT GIVEN', correct: true },
      ],
      answer: { text: 'C' },
    },
    // 11: sentence_completion
    {
      n: 11, qType: 'short_answer', taskType: 'sentence_completion',
      instruction: 'Complete the sentence below. Choose NO MORE THAN TWO WORDS from the passage for each answer.',
      item: 'Christiaan Huygens perfected the [BLANK] in 1656.',
      options: null,
      answer: { text: 'pendulum clock' },
    },
    // 12: summary_completion
    {
      n: 12, qType: 'short_answer', taskType: 'summary_completion',
      instruction: 'Complete the summary below. Choose NO MORE THAN TWO WORDS from the passage for each answer.',
      item: 'Quartz clocks gained their accuracy thanks to the [BLANK] effect.',
      options: null,
      answer: { text: 'piezoelectric' },
    },
    // 13: diagram_label_completion
    {
      n: 13, qType: 'short_answer', taskType: 'diagram_label_completion',
      instruction: 'Label the diagram below. Choose NO MORE THAN TWO WORDS from the passage for each answer.',
      item: 'a [BLANK] that beats each second',
      options: null,
      answer: { text: 'escape wheel' },
    },
  ];

  const passageMeta = {
    passage: PASSAGE,
    passageTitle: 'A Chronicle of Timekeeping',
  };

  const created: Array<{ id: string; n: number; marks: number }> = [];
  for (const s of qsSeed) {
    const q = await p.question.create({
      data: {
        subjectId: subject.id,
        componentId: comp.id,
        questionType: s.qType,
        marks: 1,
        estimatedTimeMin: 1.5,
        difficulty: 3,
        sourceType: 'past_paper_reference',
        sourceRef: `IELTS/SEED/Test1/P1/Q${s.n}`,
        content: {
          ...passageMeta,
          taskType: s.taskType,
          stem: s.instruction + '\n\n' + s.item,
        },
        answerContent: s.answer,
        options: s.options ?? undefined,
        status: QuestionStatus.active,
        createdById: admin.id,
        provenanceTag: 'cambridge_ielts_seed',
      },
    });
    created.push({ id: q.id, n: s.n, marks: 1 });
  }

  console.log(`seeded admin=${admin.email}  class=${cls.classCode}  students=${students.length}  questions=${created.length}`);
  console.log('local API can now be started. Login: admin@school.local / admin123');
  console.log('  also: any of', students.map((s) => s.name).join(','));

  await p.$disconnect();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
