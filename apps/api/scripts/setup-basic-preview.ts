import { PrismaClient } from '@prisma/client';

/**
 * 基础层试读通道 —— 给老师用手机实测这 5 篇卷子。
 *
 * 走公开的 /practice/:id 路由：不用登录、不用扫码、不占用真实场次、
 * 不进班级成绩，交卷即时判分。这是本项目验 UI 的既定做法。
 *
 * 建的东西（全部挂在【测试】班上，绝不碰 G11）：
 *   Paper + PaperQuestion   ← 快照形状与 picker 完全一致
 *   PaperAssignment
 *   StudentSubmission(status='practice')
 *
 * 用完务必清：`--drop` 删掉本脚本建的全部行。
 *
 *   建：  DATABASE_URL=... npx ts-node apps/api/scripts/setup-basic-preview.ts --apply
 *   清：  DATABASE_URL=... npx ts-node apps/api/scripts/setup-basic-preview.ts --drop
 */

const prisma = new PrismaClient();
const APPLY = process.argv.includes('--apply');
const DROP = process.argv.includes('--drop');
const TAG = 'ai_authored_olevel_1128_basic';
/** 本脚本建的 Paper 都打这个标记，方便精确回收 */
const MARKER = 'basic_band_preview';

async function pickTestClass() {
  const cls = await prisma.class.findFirst({
    where: { name: { startsWith: '【测试】' }, archivedAt: null },
    select: { id: true, name: true },
  });
  if (!cls) throw new Error('找不到【测试】开头的班级');
  return cls;
}

async function drop() {
  const papers = await prisma.paper.findMany({
    where: { config: { path: ['marker'], equals: MARKER } },
    select: { id: true, name: true },
  });
  if (papers.length === 0) {
    console.log('没有试读通道需要清理。');
    return;
  }
  console.log(`\n清理 ${papers.length} 份试读卷：`);
  for (const p of papers) console.log(`  - ${p.name}`);
  // Paper 删除会 cascade 掉 PaperQuestion / PaperAssignment /
  // StudentSubmission / AnswerScript（schema 上都是 Cascade）。
  const r = await prisma.paper.deleteMany({
    where: { id: { in: papers.map((p) => p.id) } },
  });
  console.log(`\n已删除 ${r.count} 份卷子及其级联数据。\n`);
}

(async () => {
  if (DROP) {
    await drop();
    await prisma.$disconnect();
    return;
  }

  const cls = await pickTestClass();
  const admin = await prisma.user.findFirst({
    where: { role: 'admin', isActive: true },
    select: { id: true },
  });
  if (!admin) throw new Error('找不到 admin');

  // 试读用的学生：测试班里任意一个在册学生
  const enrol = await prisma.classEnrollment.findFirst({
    where: { classId: cls.id, role: 'student', user: { isActive: true } },
    select: { userId: true, user: { select: { name: true } } },
  });
  if (!enrol) throw new Error(`测试班 ${cls.name} 里没有在册学生`);

  const subject = await prisma.subject.findFirst({
    where: { code: '1123' },
    include: { components: true },
  });
  if (!subject) throw new Error('1123 subject 未 seed');

  const bank = await prisma.question.findMany({
    where: {
      provenanceTag: TAG,
      status: 'active',
      sourceRef: { startsWith: 'OLEVEL/' },
    },
    orderBy: { sourceRef: 'asc' },
  });
  const byPaperKey = new Map<string, typeof bank>();
  for (const q of bank) {
    const m = q.sourceRef?.match(/^(OLEVEL\/[^/]+\/Paper\d+)\//);
    if (!m) continue;
    if (!byPaperKey.has(m[1])) byPaperKey.set(m[1], []);
    byPaperKey.get(m[1])!.push(q);
  }

  console.log(`\n=== 基础层试读通道 ${APPLY ? '(执行)' : '(演练)'} ===`);
  console.log(`班级：${cls.name}   试读身份：${enrol.user.name}`);
  console.log(`basic 桶：${byPaperKey.size} 份卷\n`);

  if (!APPLY) {
    for (const k of byPaperKey.keys()) console.log(`  将建试读卷：${k}`);
    console.log('\n加 --apply 才写库。\n');
    await prisma.$disconnect();
    return;
  }

  const links: string[] = [];
  for (const [key, rawItems] of byPaperKey) {
    const items = rawItems
      .slice()
      .sort(
        (a, b) =>
          parseInt(a.sourceRef?.match(/\/Q(\d+)$/)?.[1] ?? '0', 10) -
          parseInt(b.sourceRef?.match(/\/Q(\d+)$/)?.[1] ?? '0', 10),
      );
    const totalMarks = items.reduce((s, q) => s + q.marks, 0);
    const title = (items[0].content as any)?.passageTitle ?? key;

    const paper = await prisma.paper.create({
      data: {
        name: `【试读】${title}`,
        ownerId: admin.id,
        subjectId: subject.id,
        componentId: subject.components[0].id,
        durationMin: 30,
        totalMarksTarget: totalMarks,
        totalMarksActual: totalMarks,
        status: 'draft',
        generatedSeed: Math.floor(Math.random() * 1e9),
        // marker 字段是本脚本的回收凭据；其余键与 picker 产出的一致，
        // 这样渲染/判分路径走的是同一条。
        config: {
          marker: MARKER,
          mode: 'olevel_curated',
          paperKey: key,
          provenanceFilter: 'basic',
          questionCount: items.length,
        },
      },
    });
    for (let i = 0; i < items.length; i++) {
      await prisma.paperQuestion.create({
        data: {
          paperId: paper.id,
          questionId: items[i].id,
          sortOrder: i + 1,
          snapshotContent: items[i].content as any,
          snapshotAnswer: items[i].answerContent as any,
          snapshotOptions: items[i].options as any,
          marks: items[i].marks,
        },
      });
    }
    const assignment = await prisma.paperAssignment.create({
      data: { paperId: paper.id, classId: cls.id, assignedById: admin.id },
    });
    const sub = await prisma.studentSubmission.create({
      data: {
        assignmentId: assignment.id,
        studentId: enrol.userId,
        status: 'practice',
        maxScore: totalMarks,
      },
    });
    links.push(`${title}|${sub.id}`);
    console.log(`  ✓ ${title.padEnd(24)} ${items.length} 题 / ${totalMarks} 分`);
  }

  console.log('\n=== 试读链接（手机直接打开，无需登录）===\n');
  for (const l of links) {
    const [title, id] = l.split('|');
    console.log(`  ${title}`);
    console.log(`  https://nurturing-radiance-production.up.railway.app/practice/${id}?name=${encodeURIComponent(enrol.user.name)}\n`);
  }
  console.log('测完请务必清理：npx ts-node apps/api/scripts/setup-basic-preview.ts --drop\n');

  await prisma.$disconnect();
})().catch(async (e) => {
  console.error(e);
  await prisma.$disconnect();
  process.exit(1);
});
