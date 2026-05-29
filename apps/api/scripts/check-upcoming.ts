import { PrismaClient } from '@prisma/client';
const p = new PrismaClient();
(async () => {
  const now = new Date();
  // From tomorrow (SGT) onward, look 21 days ahead.
  const tzOff = Number(process.env.MORNING_QUIZ_TZ_OFFSET_MIN ?? 8 * 60);
  const localNow = new Date(now.getTime() + tzOff * 60_000);
  const today = new Date(Date.UTC(localNow.getUTCFullYear(), localNow.getUTCMonth(), localNow.getUTCDate()));
  const from = new Date(today.getTime() + 86_400_000); // tomorrow onward
  const to = new Date(today.getTime() + 21 * 86_400_000);

  const sessions = await p.morningQuizSession.findMany({
    where: { date: { gte: from, lt: to }, class: { archivedAt: null } },
    select: {
      date: true,
      level: true,
      status: true,
      class: { select: { name: true } },
      paperAssignment: {
        select: {
          paper: {
            select: { id: true, name: true, qaReviewVerdict: true, qaTeacherAction: true, totalMarksActual: true },
          },
        },
      },
    },
    orderBy: [{ date: 'asc' }, { classId: 'asc' }, { level: 'asc' }],
  });

  console.log(`Today (SGT): ${today.toISOString().slice(0, 10)}`);
  console.log(`Upcoming sessions (next 21d): ${sessions.length}\n`);

  const DOW = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  // Group by date
  const byDate = new Map<string, typeof sessions>();
  for (const s of sessions) {
    const d = s.date.toISOString().slice(0, 10);
    const arr = byDate.get(d) ?? [];
    arr.push(s);
    byDate.set(d, arr);
  }
  for (const [d, arr] of byDate) {
    const dow = DOW[new Date(d + 'T00:00:00Z').getUTCDay()];
    console.log(`── ${d} ${dow} — ${arr.length} session(s)`);
    for (const s of arr) {
      const paper = s.paperAssignment?.paper;
      console.log(
        `     ${s.class.name} / ${s.level} [${s.status}] | paper=${paper?.name ?? '(none)'} ` +
          `marks=${paper?.totalMarksActual ?? '?'} qa=${paper?.qaReviewVerdict ?? 'pending'}/${paper?.qaTeacherAction ?? 'none'}`,
      );
    }
  }
  if (sessions.length === 0) {
    console.log('(no upcoming sessions generated yet)');
  }
  await p.$disconnect();
})();
