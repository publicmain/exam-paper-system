import { PrismaClient } from '@prisma/client';
/**
 * Diagnose "早测已结束" reports — run on prod with the production
 * DATABASE_URL pointed at Railway:
 *
 *   railway run -- npx ts-node apps/api/scripts/diag-todays-sessions.ts
 *
 * Output covers (1) every today-or-yesterday session and its status +
 * window timestamps, (2) recent cancel / create audit logs, (3) every
 * attendance scan for today so we can correlate what status a session
 * was in at scan time.
 */
const p = new PrismaClient();
(async () => {
  const now = new Date();
  console.log('Server UTC now:  ', now.toISOString());
  console.log('SGT now (UTC+8): ', new Date(now.getTime() + 8 * 3600_000).toISOString());

  const since = new Date(now.getTime() - 2 * 86400_000);
  const tomorrow = new Date(now.getTime() + 86400_000);

  // ── Sessions
  const sessions = await p.morningQuizSession.findMany({
    where: { date: { gte: since, lt: tomorrow } },
    select: {
      id: true,
      date: true,
      level: true,
      status: true,
      attendanceStart: true,
      attendanceEnd: true,
      lateCutoff: true,
      quizEnd: true,
      classId: true,
      class: { select: { name: true } },
    },
    orderBy: { date: 'desc' },
  });
  console.log(`\n=== Sessions in last 2 days (${sessions.length}) ===`);
  for (const s of sessions) {
    console.log(
      `\n  [${s.status.toUpperCase()}] ${s.date.toISOString().slice(0, 10)} ${s.level} cls=${s.class.name}`,
    );
    console.log(`    sessionId   = ${s.id}`);
    console.log(`    attStart    = ${s.attendanceStart.toISOString()}`);
    console.log(`    attEnd      = ${s.attendanceEnd.toISOString()}`);
    console.log(`    lateCutoff  = ${s.lateCutoff.toISOString()}`);
    console.log(`    quizEnd     = ${s.quizEnd.toISOString()}`);
    const att = await p.attendance.findMany({
      where: { sessionId: s.id },
      orderBy: { scanTime: 'asc' },
      select: {
        status: true,
        scanTime: true,
        source: true,
        student: { select: { name: true } },
      },
    });
    console.log(`    attendance rows: ${att.length}`);
    for (const a of att.slice(0, 200)) {
      console.log(
        `      ${(a.scanTime ? a.scanTime.toISOString() : 'null'.padEnd(24))} ${a.status.padEnd(8)} ${a.source.padEnd(20)} ${a.student.name}`,
      );
    }
  }

  // ── Audit logs that could explain a status change
  const audits = await p.auditLog.findMany({
    where: {
      createdAt: { gte: since },
      action: {
        in: [
          'morning_quiz.session.cancel',
          'morning_quiz.session.create',
          'morning_quiz.session.update',
          'morning_quiz.revert_to_scheduled',
          'morning_quiz.debug_activate',
          'attendance.scan',
          'attendance.scan_denied',
        ],
      },
    },
    orderBy: { createdAt: 'desc' },
    take: 50,
    select: {
      createdAt: true,
      action: true,
      entityType: true,
      entityId: true,
      actorRole: true,
      metadata: true,
    },
  });
  console.log(`\n=== Recent relevant audit logs (${audits.length}) ===`);
  for (const a of audits) {
    console.log(
      `  ${a.createdAt.toISOString()} ${a.action.padEnd(35)} ${a.actorRole.padEnd(8)} ${a.entityId.slice(0, 12)} meta=${JSON.stringify(a.metadata)}`,
    );
  }

  // ── Server-time sanity vs SGT
  console.log('\n=== Process tz ===');
  console.log('  process.env.TZ:', process.env.TZ ?? '(unset)');
  console.log('  Date.toLocaleString:', new Date().toLocaleString());
  console.log('  Hours diff vs UTC:', new Date().getTimezoneOffset(), 'min');

  await p.$disconnect();
})();
