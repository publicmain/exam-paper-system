import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import * as bcrypt from 'bcryptjs';
import { PrismaService } from '../common/prisma.service';
import { AuditService } from '../audit/audit.service';
import { canActOnClass } from '../common/roles';
import { UserRole } from '@prisma/client';
import type { EnglishLevel } from '@prisma/client';
import { LEVEL_REGISTRY } from '../morning-quiz/level-registry';

@Injectable()
export class UsersService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  list() {
    return this.prisma.user.findMany({
      select: { id: true, email: true, name: true, role: true, createdAt: true, lastLogin: true },
      orderBy: { createdAt: 'desc' },
    });
  }

  async create(input: { email: string; name: string; password: string; role: UserRole }) {
    const passwordHash = await bcrypt.hash(input.password, 10);
    return this.prisma.user.create({
      data: { email: input.email, name: input.name, passwordHash, role: input.role },
      select: { id: true, email: true, name: true, role: true },
    });
  }

  /** Update name and/or email. Used by the Classes UI for inline rename. */
  async updateProfile(id: string, patch: { name?: string; email?: string }) {
    const data: { name?: string; email?: string } = {};
    if (typeof patch.name === 'string' && patch.name.trim()) data.name = patch.name.trim();
    if (typeof patch.email === 'string' && patch.email.trim()) data.email = patch.email.trim();
    if (Object.keys(data).length === 0) {
      // Nothing to update — return current row instead of erroring so the
      // UI can treat this as a no-op save.
      return this.prisma.user.findUnique({
        where: { id },
        select: { id: true, email: true, name: true, role: true },
      });
    }
    return this.prisma.user.update({
      where: { id },
      data,
      select: { id: true, email: true, name: true, role: true },
    });
  }

  /**
   * P4 —— 教师改学生的英语难度。**唯一**能改写已落定难度的合法路径
   * （另一条是学生首扫落定，且只在当前为 null 时生效）。
   *
   * 授权走既有的 canActOnClass：admin / head_teacher 全校，普通教师只能
   * 改自己带的班里的学生。学生自己没有任何接口能走到这里。
   *
   * **只影响后续内容选择**：这里只写 User 一行。历史答卷
   * （StudentSubmission）、历史成绩、已建的场次（MorningQuizSession.level
   * 是当时的快照）、已生成的当日任务（DailyLessonCompletion）一律不碰
   * —— 改难度是「他明天在哪一层」，不是「他上周考的是什么」。
   */
  async setEnglishLevel(
    actor: { id: string; role: string },
    studentId: string,
    level: EnglishLevel | null,
  ) {
    if (level !== null && !(level in LEVEL_REGISTRY)) {
      throw new BadRequestException({ code: 'unknown_level', level });
    }
    const student = await this.prisma.user.findUnique({
      where: { id: studentId },
      select: { id: true, role: true, name: true, englishLevel: true },
    });
    if (!student || student.role !== 'student') {
      throw new NotFoundException({ code: 'student_not_found' });
    }

    // 班级归属：学生可能在多个班（转班历史），任一在读班有权限即可。
    const enrollments = await this.prisma.classEnrollment.findMany({
      where: { userId: studentId, role: 'student', class: { archivedAt: null } },
      select: { classId: true },
    });
    let allowed = false;
    for (const e of enrollments) {
      if (await canActOnClass(this.prisma, actor, e.classId)) {
        allowed = true;
        break;
      }
    }
    if (!allowed) throw new ForbiddenException({ code: 'not_your_class' });

    const before = student.englishLevel ?? null;
    const updated = await this.prisma.user.update({
      where: { id: studentId },
      data: { englishLevel: level },
      select: { id: true, name: true, englishLevel: true },
    });
    await this.audit.log({
      actorId: actor.id,
      actorRole: actor.role,
      action: 'user.english_level_set',
      entityType: 'User',
      entityId: studentId,
      diff: { englishLevel: { from: before, to: level } },
    });
    return { ok: true as const, id: updated.id, englishLevel: updated.englishLevel };
  }
}
