import { ForbiddenException } from '@nestjs/common';

export interface TeacherActor {
  id: string;
  role: string;
  ip?: string | null;
}
const STAFF_ROLES = new Set(['teacher', 'head_teacher', 'admin']);
export function assertStaff(actor: TeacherActor | null | undefined): asserts actor is TeacherActor {
  if (!actor || !STAFF_ROLES.has(actor.role)) throw new ForbiddenException({ code: 'teacher_required' });
}
