'use strict';
/**
 * 造一个「QA 盲测班」（注册页看不见：classCode 不在自助注册白名单里）并给它
 * 一套日期 = 今天的阅读场次 —— 只为上线前的盲测。
 *
 * 复用内容包里某一天的五份卷（默认 2026-09-04，第一周最后一天，只发给过
 * 已归档的测试号）。同一份卷不能给同一个班发两次（PaperAssignment 的
 * paperId+classId 唯一），所以不能借内部冒烟班 p1_class，得另起一个班。
 * 真实班一个字不碰；id 全带 p1_ 前缀、带 qa 标记，事后可整套删除（--remove）。
 *
 *   railway run -s Postgres -e production -- node apps/api/scripts/pilot/smoke-session-today.js [--source=2026-09-04] [--day=2026-09-05] [--remove]
 */
const { PrismaClient } = require('@prisma/client');
const pilot = require('./prepare-pilot-week');

const argv = process.argv.slice(2);
const opt = (name, fallback) => {
  const hit = argv.find((a) => a.startsWith(`--${name}=`));
  return hit ? hit.slice(name.length + 3) : fallback;
};
const REMOVE = argv.includes('--remove');
const SOURCE = opt('source', '2026-09-04');
const DAY = opt('day', new Date(Date.now() + 8 * 3600 * 1000).toISOString().slice(0, 10));
const LEVELS = ['ielts_simplified', 'olevel_intermediate', 'olevel', 'ielts_light', 'ielts_authentic'];

const prisma = new PrismaClient({
  datasources: { db: { url: process.env.DATABASE_PUBLIC_URL || process.env.DATABASE_URL } },
});

const QA_CLASS = { id: `${pilot.PREFIX}class_qa`, name: 'QA 盲测班', classCode: 'QASMOKE' };

const smokeIds = (level) => {
  const base = `${pilot.PREFIX}${level}_${DAY.replace(/-/g, '')}_qa`;
  return { assignmentId: `${base}_asg`, sessionId: `${base}_sess` };
};

async function main() {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(DAY) || !/^\d{4}-\d{2}-\d{2}$/.test(SOURCE)) throw new Error('日期格式 YYYY-MM-DD');
  if (REMOVE) {
    for (const level of LEVELS) {
      const ids = smokeIds(level);
      const subs = await prisma.studentSubmission.count({ where: { assignmentId: ids.assignmentId } });
      await prisma.morningQuizSession.deleteMany({ where: { id: ids.sessionId } });
      await prisma.studentSubmission.deleteMany({ where: { assignmentId: ids.assignmentId } });
      await prisma.paperAssignment.deleteMany({ where: { id: ids.assignmentId } });
      console.log(`  ${level}: 删了场次 + 布置（含 ${subs} 份答卷）`);
    }
    const enrolled = await prisma.classEnrollment.count({ where: { classId: QA_CLASS.id } });
    console.log(`QA 班还有 ${enrolled} 个成员，班本身保留（要删先归档成员）。`);
    return;
  }

  const klass = await prisma.class.upsert({
    where: { id: QA_CLASS.id },
    update: {},
    create: { id: QA_CLASS.id, name: QA_CLASS.name, classCode: QA_CLASS.classCode },
    select: { id: true, name: true, classCode: true },
  });
  for (const level of LEVELS) {
    await prisma.classEnglishLevel.upsert({
      where: { classId_level: { classId: klass.id, level } },
      update: {},
      create: { classId: klass.id, level, effectiveFrom: pilot.sgtInstant(DAY, '00:00:00') },
    });
  }
  console.log(`QA 班：${klass.name}（${klass.classCode}）  日期：${DAY}  卷子来源：${SOURCE}`);

  for (const level of LEVELS) {
    const paperId = `${pilot.PREFIX}${level}_${SOURCE.replace(/-/g, '')}_paper`;
    const paper = await prisma.paper.findUnique({ where: { id: paperId }, select: { id: true, name: true } });
    if (!paper) throw new Error(`找不到卷子 ${paperId}`);
    const ids = smokeIds(level);
    await prisma.paperAssignment.upsert({
      where: { id: ids.assignmentId },
      update: { status: 'open' },
      create: {
        id: ids.assignmentId,
        paperId,
        classId: klass.id,
        assignedById: pilot.PUBLISHER.teacherId,
        assignedAt: pilot.sgtInstant(DAY, '00:01:00'),
        startAt: pilot.sgtInstant(DAY, '00:05:00'),
        dueAt: pilot.sgtInstant(DAY, '23:59:00'),
        status: 'open',
      },
    });
    await prisma.morningQuizSession.upsert({
      where: { id: ids.sessionId },
      update: { status: 'active' },
      create: {
        id: ids.sessionId,
        date: pilot.dayLabel(DAY),
        classId: klass.id,
        paperAssignmentId: ids.assignmentId,
        scheduledById: pilot.PUBLISHER.teacherId,
        status: 'active',
        level,
        attendanceStart: pilot.sgtInstant(DAY, '00:05:00'),
        attendanceEnd: pilot.sgtInstant(DAY, '23:59:00'),
        lateCutoff: pilot.sgtInstant(DAY, '23:59:00'),
        quizStart: pilot.sgtInstant(DAY, '00:05:00'),
        quizEnd: pilot.sgtInstant(DAY, '23:59:00'),
        qrSecret: `${pilot.PREFIX}not-used-account-login-only`,
      },
    });
    console.log(`  ${level}: ${paper.name} → ${DAY}`);
  }
}

main()
  .catch((e) => { console.error(e?.message ?? e); process.exitCode = 1; })
  .finally(() => prisma.$disconnect());
