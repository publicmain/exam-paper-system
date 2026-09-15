import { BadRequestException, ConflictException, NotFoundException } from '@nestjs/common';
import * as crypto from 'node:crypto';
import { displayName, normalizeName } from './pilot-levels';

/** 与注册页同一个上限。 */
export const STUDENT_NAME_MAX = 50;

/**
 * 自助注册账号的内部邮箱：按「班级 + 归一化姓名」算出来的哈希。学生登录不用它，
 * 它只保证 `User.email` 唯一 —— 所以改名时要按新名重算，否则以后有人用旧名字在
 * 同一个班注册会撞唯一键。
 */
export function selfRegisterEmail(classId: string, nameKey: string): string {
  const h = crypto.createHash('sha256').update(`${classId}|${nameKey}`).digest('hex');
  return `selfreg-${h.slice(0, 32)}@pilot.invalid`;
}

export type StudentRenameSource = 'student_self' | 'teacher_roster';

export interface StudentRenameInput {
  studentId: string;
  newName: string;
  actor: { id: string | null; role: string };
  source: StudentRenameSource;
  ip?: string | null;
}

/**
 * 改学生的登录名（2026-09-15）—— 学生在账号页自己改、老师在班级名单里改，**走同一个函数**。
 *
 * 登录按姓名一字不差地匹配（`StudentAuthService.login`），所以这里改的是登录凭据的一部分：
 *
 *   · `name`：登录名，也是老师名单、成绩、判分队列上显示的名字；
 *   · `nickname`：学生端首页 / 账号页优先显示它。**原来等于旧名（或为空）才跟着改** ——
 *     否则学生登录要用新名字、页面上却还挂着旧名字；学生自己另起的昵称不动；
 *   · `email`：若是自助注册按「班级 + 旧名」算出来的，按新名重算；
 *   · 同一个在读班里已经有人叫这个名字（归一化后相同）→ 409，不改；
 *   · 条件更新（`where name = 读到的旧名`）：两处同时改只成功一个；
 *   · 同一个事务里写一条审计 `student.rename`（谁、从什么改成什么、从哪里改的）。
 *
 * 必须在 `prisma.$transaction(async (tx) => …)` 里调用。
 */
export async function renameStudentAccount(tx: any, input: StudentRenameInput) {
  const shown = displayName(input.newName);
  if (!shown) throw new BadRequestException({ code: 'name_required' });
  if (shown.length > STUDENT_NAME_MAX) {
    throw new BadRequestException({ code: 'name_too_long', max: STUDENT_NAME_MAX });
  }

  const user = await tx.user.findUnique({
    where: { id: input.studentId },
    select: { id: true, role: true, name: true, nickname: true, email: true, avatar: true, studentAuthVersion: true },
  });
  if (!user || user.role !== 'student') throw new NotFoundException({ code: 'student_not_found' });
  if (shown === user.name) throw new BadRequestException({ code: 'name_unchanged' });

  const key = normalizeName(shown);
  const oldKey = normalizeName(user.name);
  const enrollments: Array<{ classId: string; class: { archivedAt: Date | null } }> = await tx.classEnrollment.findMany({
    where: { userId: user.id, role: 'student' },
    select: { classId: true, class: { select: { archivedAt: true } } },
  });
  const activeClassIds = enrollments.filter((e) => !e.class.archivedAt).map((e) => e.classId);

  // 只改大小写 / 空格（归一化相同）不算换人名，不查重
  if (key !== oldKey && activeClassIds.length) {
    const classmates: Array<{ name: string }> = await tx.user.findMany({
      where: { id: { not: user.id }, classEnrollments: { some: { classId: { in: activeClassIds } } } },
      select: { name: true },
    });
    if (classmates.some((c) => normalizeName(c.name) === key)) {
      throw new ConflictException({ code: 'name_taken_in_class' });
    }
  }

  // 注册邮箱按注册时的那个班算的 —— 那个班后来归档了也要认得出来
  const registeredIn = enrollments.find((e) => selfRegisterEmail(e.classId, oldKey) === user.email)?.classId ?? null;
  const newEmail = registeredIn && key !== oldKey ? selfRegisterEmail(registeredIn, key) : null;
  if (newEmail) {
    const taken = await tx.user.findFirst({ where: { email: newEmail, NOT: { id: user.id } }, select: { id: true } });
    if (taken) throw new ConflictException({ code: 'name_taken_in_class' });
  }

  const syncNickname = user.nickname == null || normalizeName(user.nickname) === oldKey;
  const res = await tx.user.updateMany({
    where: { id: user.id, name: user.name },
    data: { name: shown, ...(syncNickname ? { nickname: shown } : {}), ...(newEmail ? { email: newEmail } : {}) },
  });
  if (res.count !== 1) throw new ConflictException({ code: 'rename_conflict' });

  await tx.auditLog.create({
    data: {
      actorId: input.actor.id,
      actorRole: input.actor.role,
      action: 'student.rename',
      entityType: 'User',
      entityId: user.id,
      ip: input.ip ?? null,
      diff: {
        name: [user.name, shown],
        ...(syncNickname ? { nickname: [user.nickname, shown] } : {}),
        selfRegEmailRederived: Boolean(newEmail),
      },
      metadata: { source: input.source },
    },
  });

  return {
    id: user.id as string,
    name: shown,
    nickname: (syncNickname ? shown : user.nickname) as string | null,
    avatar: user.avatar as string | null,
    email: (newEmail ?? user.email) as string,
    studentAuthVersion: user.studentAuthVersion as number,
    previousName: user.name as string,
  };
}
