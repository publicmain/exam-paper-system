import type { PrismaService } from './prisma.service';

export const singaporeDate = (now: Date) => new Date(now.getTime() + 8 * 3600_000).toISOString().slice(0, 10);
export const dateOnly = (key: string) => new Date(`${key}T00:00:00.000Z`);
export function validDate(key: unknown): key is string {
  return typeof key === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(key)
    && Number.isFinite(dateOnly(key).getTime()) && dateOnly(key).toISOString().slice(0, 10) === key;
}
export function nextDate(key: string, offset: number): string {
  return new Date(dateOnly(key).getTime() + offset * 86400_000).toISOString().slice(0, 10);
}
/** The shared teaching-day rule. Explicit closures do not count as learning days. */
export function isTeachingDay(key: string, noSchool = false): boolean {
  const dow = dateOnly(key).getUTCDay();
  return dow >= 1 && dow <= 5 && !noSchool;
}

/** Current, unarchived memberships; a multi-class student is off only if ALL
 * classes they had joined on that date are off. Never disclose other rosters. */
export async function loadSchoolCalendar(prisma: Pick<PrismaService, 'classEnrollment' | 'classNoSchoolDay'>, studentIds: string[], from?: string, to?: string) {
  const enrollments = studentIds.length ? await prisma.classEnrollment.findMany({
    where: { userId: { in: studentIds }, role: 'student', class: { archivedAt: null } },
    select: { userId: true, classId: true, joinedAt: true },
  }) : [];
  const classIds = [...new Set(enrollments.map((e) => e.classId))];
  const rows = classIds.length ? await prisma.classNoSchoolDay.findMany({
    where: { classId: { in: classIds }, date: { ...(from ? { gte: dateOnly(from) } : {}), ...(to ? { lte: dateOnly(to) } : {}) } },
    select: { classId: true, date: true },
  }) : [];
  const closed = new Set(rows.map((r) => `${r.classId}|${r.date.toISOString().slice(0, 10)}`));
  const isNoSchoolDay = (studentId: string, date: string) => {
    const mine = enrollments.filter((e) => e.userId === studentId && singaporeDate(e.joinedAt) <= date);
    return mine.length > 0 && mine.every((e) => closed.has(`${e.classId}|${date}`));
  };
  const noSchoolDates = (studentId: string) => new Set(rows.map((r) => r.date.toISOString().slice(0, 10)).filter((date) => isNoSchoolDay(studentId, date)));
  return { isNoSchoolDay, noSchoolDates, isTeachingDay: (studentId: string, date: string) => isTeachingDay(date, isNoSchoolDay(studentId, date)) };
}
