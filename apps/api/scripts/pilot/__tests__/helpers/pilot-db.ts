/**
 * 发布脚本的**隔离库**夹具（PUB01 / PUB02 / PUB03，2026-09-11）。
 *
 * 只给 `pilot-publish.db.spec.ts` 用。它会 TRUNCATE 整个库，所以第一件事
 * 就是确认连接串指向本机 —— 指向任何别的主机（尤其是 Railway）一律拒绝，
 * 连一条查询都不发。
 *
 * 本机怎么起库见 docs/audit-2026-09-11/ledger-pub.md「隔离库集成测试」：
 * Docker 在这台机器上坏了，用的是 PGlite + pglite-socket（真 Postgres 语义，
 * 包括事务回滚、触发器、唯一约束），装在仓库外的独立目录里。
 *
 * 两个连接串坑（踩过才知道，见 ledger）：
 *   1. 连接串必须带 `pgbouncer=true`，否则同一个 PGlite 后端服务多条 TCP 连接
 *      共享 prepared statement 命名空间，第二个连接一建立就报
 *      `prepared statement "s0" already exists`（42P05）；
 *   2. `PGLiteSocketServer` 的 `maxConnections` 默认是 1——上一条连接进程退出到
 *      服务端把它从活跃连接表里摘除之间有个异步窗口，紧接着来的下一条连接会
 *      被服务端当「连接数超限」直接拒绝，Prisma 把这个错误包装成语焉不详的
 *      `Can't reach database server`。起服务端时要把它调大（见
 *      `.local/tools/pglite/server.mjs`）。
 */
import type { PrismaClient } from '@prisma/client';

export const IT_URL = process.env.PILOT_IT_DATABASE_URL ?? '';

/** 只允许本机库。返回解析后的 URL，给 CLI 子进程拼环境变量用。 */
export function assertLocalDatabase(raw: string): URL {
  const url = new URL(raw);
  if (!['127.0.0.1', 'localhost', '::1'].includes(url.hostname)) {
    throw new Error('集成测试只允许连本机隔离库（127.0.0.1 / localhost）—— 拒绝执行');
  }
  if (!url.port) throw new Error('集成测试的连接串必须写明端口');
  return url;
}

export async function resetDb(prisma: PrismaClient): Promise<void> {
  assertLocalDatabase(IT_URL);
  await prisma.$executeRawUnsafe('DROP TRIGGER IF EXISTS it_tamper_on_paper ON "Paper"');
  await prisma.$executeRawUnsafe('DROP TRIGGER IF EXISTS it_drop_word ON "StudentWord"');
  const tables = (await prisma.$queryRawUnsafe(
    `SELECT tablename FROM pg_tables WHERE schemaname = 'public' AND tablename <> '_prisma_migrations'`,
  )) as Array<{ tablename: string }>;
  if (tables.length === 0) throw new Error('隔离库里没有表 —— 先跑 prisma migrate deploy');
  await prisma.$executeRawUnsafe(
    `TRUNCATE ${tables.map((t) => `"${t.tablename}"`).join(', ')} RESTART IDENTITY CASCADE`,
  );
}

export const STUDENTS = [
  // id 不能以 t 或 s12f 开头 —— 发布脚本把那两种当夹具账号拒绝执行
  { id: 'stu_ol_1', level: 'olevel', classId: 'p1_class_sec27w' },
  { id: 'stu_ol_2', level: 'olevel', classId: 'p1_class_sec27w' },
  { id: 'stu_sim_1', level: 'ielts_simplified', classId: 'p1_class_ol26w' },
  { id: 'stu_nolevel', level: null, classId: 'p1_class_ol26w' },
] as const;

/**
 * 一个「已经装着别人数据」的库：别的班、别人的卷子与答卷、学生自己查的词。
 * 这些都在发布脚本「绝不碰」的范围里，指纹一变就必须整笔回滚。
 */
export async function seedWorld(prisma: PrismaClient, opts: { historyPassage?: string } = {}): Promise<void> {
  await prisma.examBoard.create({ data: { id: 'it_board', code: 'ITB', name: 'IT Board' } });
  await prisma.subject.create({
    data: { id: 'it_subject', examBoardId: 'it_board', code: 'X', name: 'X', level: 'O_LEVEL' },
  });
  await prisma.user.create({
    data: { id: 'it_teacher', email: 'it.teacher@example.invalid', name: 'IT Teacher', passwordHash: 'x', role: 'teacher' },
  });
  await prisma.class.create({ data: { id: 'it_class', name: 'IT Class', classCode: 'ITCLASS' } });
  for (const code of ['SEC27W', 'OL26W']) {
    await prisma.class.create({ data: { id: `p1_class_${code.toLowerCase()}`, name: code, classCode: code } });
  }
  for (const s of STUDENTS) {
    await prisma.user.create({
      data: {
        id: s.id,
        email: `${s.id}@example.invalid`,
        name: s.id,
        passwordHash: 'x',
        role: 'student',
        englishLevel: s.level ?? undefined,
      },
    });
    await prisma.classEnrollment.create({
      data: { id: `it_enr_${s.id}`, classId: s.classId, userId: s.id, role: 'student' },
    });
  }
  await prisma.studentWord.create({
    data: { id: 'it_personal_word', studentId: 'stu_ol_1', headword: 'serendipity', surfaceForm: 'serendipity' },
  });

  // 一份别人发过、有学生答过的卷子：既是「绝不碰」的答卷，也是查重历史
  await prisma.paper.create({
    data: {
      id: 'it_paper',
      name: 'Someone else’s paper',
      subjectId: 'it_subject',
      ownerId: 'it_teacher',
      status: 'published',
      durationMin: 30,
      totalMarksTarget: 1,
      totalMarksActual: 1,
      generatedSeed: 1,
      config: {},
    },
  });
  const passage =
    opts.historyPassage ??
    'Lighthouse keepers once lived on remote rocks for months at a time, trimming wicks and winding clockwork so that the lamp turned through the night.';
  await prisma.question.create({
    data: {
      id: 'it_q1',
      subjectId: 'it_subject',
      createdById: 'it_teacher',
      questionType: 'short_answer',
      content: { passage, stem: 'Why did keepers wind the clockwork every few hours during the night?' },
      answerContent: { text: 'so that the lamp kept turning' },
      marks: 1,
      estimatedTimeMin: 1,
      difficulty: 3,
    },
  });
  await prisma.paperQuestion.create({
    data: {
      id: 'it_pq1',
      paperId: 'it_paper',
      questionId: 'it_q1',
      sortOrder: 1,
      snapshotContent: { passage, stem: 'Why did keepers wind the clockwork every few hours during the night?' },
      snapshotAnswer: { text: 'so that the lamp kept turning' },
      marks: 1,
    },
  });
  await prisma.paperAssignment.create({
    data: { id: 'it_asg', paperId: 'it_paper', classId: 'it_class', assignedById: 'it_teacher', status: 'closed' },
  });
  await prisma.studentSubmission.create({
    data: { id: 'it_sub', assignmentId: 'it_asg', studentId: 'stu_ol_2', maxScore: 1, status: 'marked' },
  });
}

/**
 * 触发器式故障注入：发布脚本一写 p1 卷子，就「顺手」改一份别人的答卷。
 * 用触发器而不是在测试里包一层假事务 —— 这样新旧两版脚本、CLI 与函数
 * 调用走的是**同一条真实写入路径**，红绿对比才有意义。
 */
export async function installTamperTrigger(prisma: PrismaClient): Promise<void> {
  await prisma.$executeRawUnsafe(`
    CREATE OR REPLACE FUNCTION it_tamper() RETURNS trigger AS $$
    BEGIN
      UPDATE "StudentSubmission" SET status = 'returned' WHERE id = 'it_sub';
      RETURN NEW;
    END $$ LANGUAGE plpgsql`);
  await prisma.$executeRawUnsafe(`
    CREATE TRIGGER it_tamper_on_paper AFTER INSERT OR UPDATE ON "Paper"
    FOR EACH ROW WHEN (NEW.id LIKE 'p1_%') EXECUTE FUNCTION it_tamper()`);
}

/**
 * 触发器式故障注入：某个学生今天的某个词**悄悄没建上**（插入被吞掉）。
 * 模拟「缺词」—— 发布只剩后置约束能发现它。
 */
export async function installDropWordTrigger(prisma: PrismaClient, studentId: string): Promise<void> {
  await prisma.$executeRawUnsafe(`
    CREATE OR REPLACE FUNCTION it_drop_word() RETURNS trigger AS $$
    BEGIN
      IF NEW."studentId" = '${studentId.replace(/'/g, "''")}' AND NEW.id LIKE 'p1_w_%' THEN
        RETURN NULL;
      END IF;
      RETURN NEW;
    END $$ LANGUAGE plpgsql`);
  await prisma.$executeRawUnsafe(`
    CREATE TRIGGER it_drop_word BEFORE INSERT ON "StudentWord"
    FOR EACH ROW EXECUTE FUNCTION it_drop_word()`);
}

/** 这一天发布脚本造出来的东西各有几行。 */
export async function dayFootprint(prisma: PrismaClient, dayIso: string) {
  const d = dayIso.replace(/-/g, '');
  const one = async (sql: string) => Number(((await prisma.$queryRawUnsafe(sql)) as Array<{ n: number | bigint }>)[0].n);
  return {
    papers: await one(`SELECT count(*)::int AS n FROM "Paper" WHERE id LIKE 'p1\\_%\\_${d}\\_paper'`),
    paperQuestions: await one(`SELECT count(*)::int AS n FROM "PaperQuestion" WHERE id LIKE 'p1\\_%\\_${d}\\_pq%'`),
    sessions: await one(`SELECT count(*)::int AS n FROM "MorningQuizSession" WHERE date = '${dayIso}'::date AND id LIKE 'p1\\_%'`),
    assignments: await one(`SELECT count(*)::int AS n FROM "PaperAssignment" WHERE id LIKE 'p1\\_%\\_${d}\\_asg%'`),
    words: await one(`SELECT count(*)::int AS n FROM "StudentWord" WHERE id LIKE 'p1\\_w\\_%'`),
  };
}
