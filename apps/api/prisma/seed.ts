import { PrismaClient, UserRole, QuestionType, QuestionStatus, SourceType } from '@prisma/client';
import * as bcrypt from 'bcryptjs';
import { SYLLABUS_9709 } from './seed-data/topics-9709';
import { SYLLABUS_9702 } from './seed-data/topics-9702';
import { SYLLABUS_9618 } from './seed-data/topics-9618';
import { SYLLABUS_9608 } from '../src/reference/syllabi/topics-9608';
import { DEMO_QUESTIONS_9709, DEMO_QUESTIONS_9702, DemoQuestion } from './seed-data/demo-questions';

const prisma = new PrismaClient();

async function ensureUser(email: string, name: string, role: UserRole, password: string) {
  const passwordHash = await bcrypt.hash(password, 10);
  return prisma.user.upsert({
    where: { email },
    update: { name, role },
    create: { email, name, role, passwordHash },
  });
}

async function ensureBoard(code: string, name: string) {
  return prisma.examBoard.upsert({
    where: { code },
    update: { name },
    create: { code, name },
  });
}

async function ensureSubject(boardId: string, code: string, name: string, level: string) {
  return prisma.subject.upsert({
    where: { examBoardId_code_level: { examBoardId: boardId, code, level } },
    update: { name },
    create: { examBoardId: boardId, code, name, level },
  });
}

async function ensureComponent(subjectId: string, code: string, name: string) {
  return prisma.syllabusComponent.upsert({
    where: { subjectId_code: { subjectId, code } },
    update: { name },
    create: { subjectId, code, name },
  });
}

async function ensureTopic(componentId: string, parentTopicId: string | null, code: string, name: string, sortOrder: number) {
  return prisma.topic.upsert({
    where: { componentId_code: { componentId, code } },
    update: { name, sortOrder, parentTopicId },
    create: { componentId, parentTopicId, code, name, sortOrder },
  });
}

async function seedSyllabus(syllabus: typeof SYLLABUS_9709) {
  const board = await ensureBoard(syllabus.examBoardCode, syllabus.examBoardCode === 'CIE' ? 'Cambridge International' : syllabus.examBoardCode);
  const subject = await ensureSubject(board.id, syllabus.subjectCode, syllabus.subjectName, syllabus.level);

  const topicByCode = new Map<string, string>();
  for (const comp of syllabus.components) {
    const component = await ensureComponent(subject.id, comp.code, comp.name);
    let order = 0;
    for (const t of comp.topics) {
      const top = await ensureTopic(component.id, null, t.code, t.name, order++);
      topicByCode.set(t.code, top.id);
      let childOrder = 0;
      for (const c of t.children || []) {
        const child = await ensureTopic(component.id, top.id, c.code, c.name, childOrder++);
        topicByCode.set(c.code, child.id);
      }
    }
  }
  return { board, subject, topicByCode };
}

async function seedDemoQuestions(
  q: DemoQuestion,
  subjectId: string,
  componentMap: Map<string, string>,
  topicMap: Map<string, string>,
  authorId: string,
) {
  const componentId = componentMap.get(q.componentCode);
  const topicId = topicMap.get(q.topicCode);
  if (!componentId || !topicId) {
    console.warn(`Missing component/topic: ${q.componentCode} / ${q.topicCode}`);
    return;
  }

  // Estimated time: ~1 min per mark (math), 1.25 for physics
  const timePerMark = q.subjectCode === '9702' ? 1.25 : 1.0;

  const created = await prisma.question.create({
    data: {
      subjectId,
      componentId,
      primaryTopicId: topicId,
      questionType: q.questionType as QuestionType,
      marks: q.marks,
      estimatedTimeMin: q.marks * timePerMark,
      difficulty: q.difficulty,
      sourceType: SourceType.original_school,
      content: q.content as any,
      answerContent: q.answerContent as any,
      options: q.options as any,
      markScheme: q.markScheme as any,
      status: QuestionStatus.active,
      createdById: authorId,
      topics: {
        create: [{ topicId }],
      },
    },
  });

  await prisma.questionVersion.create({
    data: {
      questionId: created.id,
      versionNumber: 1,
      snapshot: { ...q } as any,
      changedById: authorId,
      changeNote: 'initial seed',
    },
  });
}

async function main() {
  console.log('Seeding database…');

  // Users
  const admin = await ensureUser('admin@school.local', 'Admin', UserRole.admin, 'admin123');
  const teacher = await ensureUser('teacher@school.local', 'Demo Teacher', UserRole.teacher, 'teacher123');
  console.log('  users ok');

  // Syllabuses
  const math = await seedSyllabus(SYLLABUS_9709);
  const phys = await seedSyllabus(SYLLABUS_9702);
  await seedSyllabus(SYLLABUS_9608);
  await seedSyllabus(SYLLABUS_9618);
  console.log('  syllabus ok');

  const mathComponents = await prisma.syllabusComponent.findMany({ where: { subjectId: math.subject.id } });
  const physComponents = await prisma.syllabusComponent.findMany({ where: { subjectId: phys.subject.id } });
  const mathCompMap = new Map(mathComponents.map(c => [c.code, c.id]));
  const physCompMap = new Map(physComponents.map(c => [c.code, c.id]));

  // Demo questions
  const existingMathCount = await prisma.question.count({ where: { subjectId: math.subject.id } });
  if (existingMathCount === 0) {
    for (const q of DEMO_QUESTIONS_9709) {
      await seedDemoQuestions(q, math.subject.id, mathCompMap, math.topicByCode, teacher.id);
    }
  }

  const existingPhysCount = await prisma.question.count({ where: { subjectId: phys.subject.id } });
  if (existingPhysCount === 0) {
    for (const q of DEMO_QUESTIONS_9702) {
      await seedDemoQuestions(q, phys.subject.id, physCompMap, phys.topicByCode, teacher.id);
    }
  }
  console.log('  demo questions ok');

  // A default paper template
  const existingTpl = await prisma.paperTemplate.findFirst({
    where: { ownerId: teacher.id, name: 'Weekly Quiz — Math P1' },
  });
  if (!existingTpl) {
    await prisma.paperTemplate.create({
      data: {
        ownerId: teacher.id,
        name: 'Weekly Quiz — Math P1',
        subjectId: math.subject.id,
        componentId: mathComponents.find(c => c.code === 'P1')!.id,
        durationMin: 60,
        totalMarks: 50,
        config: {
          questionMix: [
            { type: 'mcq', count: 10, marksEach: 1 },
            { type: 'structured', targetMarks: 40 },
          ],
          difficultyDist: { easy: 0.4, medium: 0.4, hard: 0.2 },
          topicFilter: [],
          excludeRecentDays: 60,
        },
        isSchoolDefault: true,
      },
    });
  }
  console.log('  template ok');

  console.log('Seed complete.');
  console.log(`  admin login:   admin@school.local / admin123`);
  console.log(`  teacher login: teacher@school.local / teacher123`);
}

main()
  .catch(e => { console.error(e); process.exit(1); })
  .finally(async () => { await prisma.$disconnect(); });
