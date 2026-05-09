// Centralised role-string constants. The DB enum is `UserRole` (Prisma) but
// most controllers compare role strings inline; that historically led to
// tiny drift bugs ('teacher' vs 'teach', or one endpoint accepting
// head_teacher and a sibling not). One source of truth here, importable
// from any controller / service.

export const ROLE_ADMIN = 'admin';
export const ROLE_HEAD_TEACHER = 'head_teacher';
export const ROLE_TEACHER = 'teacher';
export const ROLE_STUDENT = 'student';

/** Privileged operators: full read/write across the school. */
export const ROLES_ADMIN_ONLY: ReadonlySet<string> = new Set([ROLE_ADMIN]);

/** Admin or head teacher — class-level authorisation, not single-classroom. */
export const ROLES_ADMIN_OR_HEAD: ReadonlySet<string> = new Set([
  ROLE_ADMIN,
  ROLE_HEAD_TEACHER,
]);

/** Any teacher-side role: schedules quizzes, marks scripts, generates papers. */
export const ROLES_TEACHER_OR_ABOVE: ReadonlySet<string> = new Set([
  ROLE_ADMIN,
  ROLE_HEAD_TEACHER,
  ROLE_TEACHER,
]);

export function isTeacherOrAbove(role: string | undefined | null): boolean {
  return !!role && ROLES_TEACHER_OR_ABOVE.has(role);
}

export function isAdminOrHead(role: string | undefined | null): boolean {
  return !!role && ROLES_ADMIN_OR_HEAD.has(role);
}

/**
 * Class-ownership check for teacher actions. admin / head_teacher have
 * school-wide access; a regular teacher must be enrolled in the target
 * class with role !== 'student'. Throws nothing — returns boolean so the
 * caller can pick the error code.
 *
 * Usage:
 *   if (!(await canActOnClass(prisma, user, classId)))
 *     throw new ForbiddenException({ code: 'not_your_class' });
 */
export async function canActOnClass(
  prisma: { classEnrollment: { findUnique: Function } },
  actor: { id: string; role: string },
  classId: string,
): Promise<boolean> {
  if (isAdminOrHead(actor.role)) return true;
  if (actor.role !== ROLE_TEACHER) return false;
  const enrollment = await prisma.classEnrollment.findUnique({
    where: { classId_userId: { classId, userId: actor.id } },
    select: { role: true },
  });
  return !!enrollment && enrollment.role !== ROLE_STUDENT;
}
