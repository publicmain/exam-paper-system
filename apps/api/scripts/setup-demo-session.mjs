// One-shot setup for the morning-assembly demo:
//   - Creates a "演示班 / Demo Class" if missing
//   - Creates one question (今天是星期几？ — answer 星期一)
//   - Creates a 1-question Paper + PaperAssignment + MorningQuizSession
//   - Time window: tomorrow morning 6:00–12:00 SGT (broad so the demo
//     works whenever the assembly happens)
//
// Re-run safe: detects existing demo rows by sourceRef+name and reuses
// them instead of creating duplicates. Prints the session id, QR
// display URL, and a one-line activate command at the end.
//
// USAGE:
//   cd apps/api && node --env-file=../../.env scripts/setup-demo-session.mjs

import { PrismaClient } from '@prisma/client';

const p = new PrismaClient();

// Singapore time helpers — school local clock.
const SGT_OFFSET_MIN = 8 * 60;
function sgtToUtc(y, mo, d, h, m) {
  return new Date(Date.UTC(y, mo - 1, d, h, m) - SGT_OFFSET_MIN * 60_000);
}

// Always target the next calendar day (in SGT) so re-runs after midnight
// still land on a future demo, not a stale one.
const now = new Date();
const sgtNow = new Date(now.getTime() + SGT_OFFSET_MIN * 60_000);
const targetSgt = new Date(sgtNow);
targetSgt.setUTCDate(sgtNow.getUTCDate() + 1);
const Y = targetSgt.getUTCFullYear();
const MO = targetSgt.getUTCMonth() + 1;
const D = targetSgt.getUTCDate();

// Helper to compute Chinese day-of-week from a SGT date.
const ZH_DAYS = ['星期日', '星期一', '星期二', '星期三', '星期四', '星期五', '星期六'];
const EN_DAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
const targetDay = targetSgt.getUTCDay(); // 0 = Sunday
const correctZh = ZH_DAYS[targetDay];
const correctEn = EN_DAYS[targetDay];

console.log(`Demo target: ${Y}-${String(MO).padStart(2, '0')}-${String(D).padStart(2, '0')} (${correctEn} / ${correctZh})`);

// Window is generous so demo runs at any time the user feels like:
// open from NOW through tomorrow noon SGT. That way the
// presenter (or anyone testing) can scan tonight to verify the flow,
// and the assembly tomorrow morning still hits an open window.
const attendanceStart = new Date(Date.now() - 60_000); // 1 min ago
const attendanceEnd = sgtToUtc(Y, MO, D, 11, 30);
const lateCutoff = sgtToUtc(Y, MO, D, 11, 45);
const quizStart = new Date(Date.now() - 60_000);
const quizEnd = sgtToUtc(Y, MO, D, 12, 0);

async function main() {
  // 1. Find an admin to own everything.
  const admin = await p.user.findFirst({ where: { role: 'admin' }, orderBy: { createdAt: 'asc' } });
  if (!admin) throw new Error('No admin user in DB — run seed first.');

  // 2. Find or create "演示班 / Demo Class".
  let cls = await p.class.findFirst({ where: { classCode: 'DEMO-2026' } });
  if (!cls) {
    cls = await p.class.create({
      data: {
        name: '演示班 · Demo Class',
        classCode: 'DEMO-2026',
        // gradeLevel is optional in some schemas; leave default.
      },
    });
    console.log(`  created class: ${cls.id} (${cls.name})`);
  } else {
    console.log(`  reusing class: ${cls.id} (${cls.name})`);
  }

  // 3. Find or create the demo question. We use a stable sourceRef so
  //    re-runs upsert instead of duplicating.
  const sourceRef = 'DEMO/morning-assembly/Q1';
  let question = await p.question.findFirst({ where: { sourceType: 'past_paper_reference', sourceRef } });
  // Always re-stamp the answer key so reusing across days yields the
  // right correct option for whatever weekday tomorrow is.
  const options = ZH_DAYS.map((zh, i) => ({
    key: String.fromCharCode(65 + i), // A..G
    text: `${zh} · ${EN_DAYS[i]}`,
    correct: i === targetDay,
  }));
  // Find a subject and component to attach the question to. Any
  // English/CIE row works; the demo is content-neutral.
  const subject = await p.subject.findFirst({
    where: { code: 'IELTS' },
    include: { components: true },
  });
  if (!subject) throw new Error('IELTS subject not seeded.');
  const component = subject.components[0];
  if (!component) throw new Error('No component on IELTS subject.');

  if (!question) {
    question = await p.question.create({
      data: {
        subjectId: subject.id,
        componentId: component.id,
        questionType: 'mcq',
        marks: 1,
        estimatedTimeMin: 1,
        difficulty: 1,
        sourceType: 'past_paper_reference',
        sourceRef,
        content: {
          stem: '今天是星期几？\nWhat day of the week is today?',
          // Intentionally NO taskType field. pickRenderer's IELTS path
          // matches taskType='multiple_choice' and routes to the
          // passage+questions split shell, which leaves a "Reading
          // Passage" placeholder on the left for our single-MCQ demo.
          // Falling through to OLevelMcqList gives a clean centred
          // single-question card instead.
        },
        answerContent: { text: String.fromCharCode(65 + targetDay) },
        options,
        status: 'active',
        createdById: admin.id,
        provenanceTag: 'demo_assembly',
      },
    });
    console.log(`  created question: ${question.id}`);
  } else {
    // Capture the updated row so the in-memory `question` mirror is
    // fresh — earlier versions threw away the update return and used
    // the stale findFirst snapshot when building paperQuestion below,
    // which left the old taskType in place.
    question = await p.question.update({
      where: { id: question.id },
      data: {
        options,
        answerContent: { text: String.fromCharCode(65 + targetDay) },
        // Refresh content on every run so older runs that wrote
        // taskType=multiple_choice (which routes to the IELTS shell
        // and renders an empty "Reading Passage" left panel) get
        // cleaned out. The single-MCQ demo wants to fall through to
        // OLevelMcqList for a centred, calm card layout.
        content: {
          stem: '今天是星期几？\nWhat day of the week is today?',
        },
      },
    });
    console.log(`  reusing question: ${question.id} (key refreshed for ${correctEn})`);
  }

  // 4. Create a fresh Paper for this run (cheap; one row + one PaperQuestion).
  const paper = await p.paper.create({
    data: {
      name: `演示 · Morning Assembly Demo (${Y}-${String(MO).padStart(2, '0')}-${String(D).padStart(2, '0')})`,
      ownerId: admin.id,
      subjectId: subject.id,
      componentId: component.id,
      durationMin: 5,
      totalMarksTarget: 1,
      totalMarksActual: 1,
      status: 'published',
      generatedSeed: Math.floor(Math.random() * 1e9),
      config: { mode: 'demo_assembly' },
    },
  });
  await p.paperQuestion.create({
    data: {
      paperId: paper.id,
      questionId: question.id,
      sortOrder: 1,
      snapshotContent: question.content,
      snapshotAnswer: question.answerContent,
      snapshotOptions: options,
      marks: 1,
    },
  });
  console.log(`  paper: ${paper.id}`);

  // 5. PaperAssignment + MorningQuizSession.
  const assignment = await p.paperAssignment.create({
    data: {
      paperId: paper.id,
      classId: cls.id,
      assignedById: admin.id,
      startAt: quizStart,
      dueAt: quizEnd,
      durationMin: 5,
      status: 'open',
    },
  });

  // Make sure no stale demo session exists for the same date+class, then
  // create a fresh active one with a generous attendance window.
  const dateOnly = new Date(Date.UTC(Y, MO - 1, D));
  await p.morningQuizSession.deleteMany({
    where: { date: dateOnly, classId: cls.id },
  });
  // Generate a fresh QR secret (32 hex chars, matches existing format).
  const qrSecret = Array.from({ length: 32 }, () => Math.floor(Math.random() * 16).toString(16)).join('');
  const session = await p.morningQuizSession.create({
    data: {
      date: dateOnly,
      classId: cls.id,
      paperAssignmentId: assignment.id,
      attendanceStart,
      attendanceEnd,
      lateCutoff,
      quizStart,
      quizEnd,
      qrSecret,
      qrRotationSeconds: 30,
      status: 'active',
      scheduledById: admin.id,
      level: 'olevel',
    },
  });
  console.log(`\n✓ DEMO SESSION READY`);
  console.log(`  sessionId:        ${session.id}`);
  console.log(`  date:             ${Y}-${String(MO).padStart(2, '0')}-${String(D).padStart(2, '0')} (${correctEn})`);
  console.log(`  active window:    NOW → 12:00 PM SGT tomorrow`);
  console.log(`  question:         今天是星期几？`);
  console.log(`  correct answer:   ${String.fromCharCode(65 + targetDay)}. ${correctZh} · ${correctEn}`);
  console.log(``);
  console.log(`  ⏵ QR display URL (open on projector):`);
  console.log(`    http://localhost:5173/display/${session.id}`);
  console.log(``);
  console.log(`  ⏵ Direct take-quiz URL (for scan-flow testing):`);
  console.log(`    http://localhost:5173/scan/<qr-token>`);
  console.log(`    (the /display page renders the QR token, students scan with phones)`);
  console.log(``);
  console.log(`  Students need to be on school WiFi (SCHOOL_IP_BYPASS=true is set`);
  console.log(`  in dev). MORNING_QUIZ_DEMO=true is set so any typed name auto-`);
  console.log(`  creates a student account.`);
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(() => p.$disconnect());
