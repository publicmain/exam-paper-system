import { BadRequestException, Body, Controller, Delete, ForbiddenException, Get, Param, Patch, Post, Req } from '@nestjs/common';
import { Request } from 'express';
import { z } from 'zod';
import { CurrentUser } from '../common/current-user.decorator';
import { PrismaService } from '../common/prisma.service';
import { canActOnClass } from '../common/roles';
import { ClassesService } from './classes.service';

const CreateClassSchema = z.object({
  name: z.string().min(1).max(120),
  classCode: z.string().min(2).max(40).regex(/^[A-Z0-9_-]+$/i),
  // B3-H4 removed: legacy `level` field. Use ClassEnglishLevel for the
  // morning-quiz proficiency mapping.
});

const UpdateClassSchema = z.object({
  weeklyFocus: z.string().max(2000).nullable().optional(),
});

const EnrollSchema = z.object({
  userId: z.string(),
  role: z.enum(['student', 'class_teacher', 'subject_teacher']).default('student'),
});

const RosterSchema = z.object({
  students: z.array(z.object({
    email: z.string().email(),
    name: z.string().min(1).max(120),
    password: z.string().min(6).max(120).optional(),
  })).min(1).max(200),
});

const ROLES_TEACHER = new Set(['admin', 'head_teacher', 'teacher']);

@Controller('classes')
export class ClassesController {
  constructor(
    private readonly classes: ClassesService,
    private readonly prisma: PrismaService,
  ) {}

  /** IDOR gate: a regular teacher must be enrolled in classId (non-student
   *  role). admin / head_teacher always pass. Use this BEFORE any read/write
   *  scoped to a single class. */
  private async assertClassAccess(user: { id: string; role: string }, classId: string) {
    const ok = await canActOnClass(this.prisma, user, classId);
    if (!ok) throw new ForbiddenException({ code: 'not_your_class' });
  }

  /** Teachers + students see classes they belong to. Admins / heads
   *  see all. */
  @Get()
  list(@CurrentUser() user: any) {
    if (user.role === 'admin' || user.role === 'head_teacher') {
      return this.classes.list();
    }
    return this.classes.myClasses(user.id);
  }

  @Get(':id')
  async get(@Param('id') id: string, @CurrentUser() user: any) {
    // Students may read their own class (roster + assignments — they're in it).
    // Teacher / head / admin go through canActOnClass.
    if (user.role === 'student') {
      const enrollment = await this.prisma.classEnrollment.findUnique({
        where: { classId_userId: { classId: id, userId: user.id } },
        select: { role: true },
      });
      if (!enrollment) throw new ForbiddenException({ code: 'not_your_class' });
    } else {
      await this.assertClassAccess(user, id);
    }
    return this.classes.get(id);
  }

  @Post()
  create(@Body() body: unknown, @CurrentUser() user: any) {
    if (!ROLES_TEACHER.has(user.role)) {
      throw new ForbiddenException('teacher / head_teacher / admin only');
    }
    const parsed = CreateClassSchema.safeParse(body);
    if (!parsed.success) throw new BadRequestException(parsed.error.flatten());
    return this.classes.create(parsed.data);
  }

  @Post(':id/enrollments')
  async enroll(@Param('id') id: string, @Body() body: unknown, @CurrentUser() user: any) {
    if (!ROLES_TEACHER.has(user.role)) {
      throw new ForbiddenException('teacher / head_teacher / admin only');
    }
    await this.assertClassAccess(user, id);
    const parsed = EnrollSchema.safeParse(body);
    if (!parsed.success) throw new BadRequestException(parsed.error.flatten());
    return this.classes.addEnrollment(id, parsed.data);
  }

  @Post(':id/roster')
  async roster(@Param('id') id: string, @Body() body: unknown, @CurrentUser() user: any, @Req() req: Request) {
    if (!ROLES_TEACHER.has(user.role)) {
      throw new ForbiddenException('teacher / head_teacher / admin only');
    }
    await this.assertClassAccess(user, id);
    const parsed = RosterSchema.safeParse(body);
    if (!parsed.success) throw new BadRequestException(parsed.error.flatten());
    return this.classes.bulkRoster(id, parsed.data.students,
      { id: user.id, role: user.role, ip: req.ip ?? null });
  }

  @Delete(':id/enrollments/:userId')
  async unenroll(@Param('id') id: string, @Param('userId') userId: string, @CurrentUser() user: any) {
    if (!ROLES_TEACHER.has(user.role)) {
      throw new ForbiddenException('teacher / head_teacher / admin only');
    }
    await this.assertClassAccess(user, id);
    return this.classes.removeEnrollment(id, userId);
  }

  /** F5 — set or clear the per-class weeklyFocus string the AI quick-paper
   *  generator includes in its prompt to bias output toward this week's
   *  teacher-stated emphasis areas. Pass {weeklyFocus: null} to clear. */
  @Patch(':id')
  async update(@Param('id') id: string, @Body() body: unknown, @CurrentUser() user: any) {
    if (!ROLES_TEACHER.has(user.role)) {
      throw new ForbiddenException('teacher / head_teacher / admin only');
    }
    await this.assertClassAccess(user, id);
    const parsed = UpdateClassSchema.safeParse(body);
    if (!parsed.success) throw new BadRequestException(parsed.error.flatten());
    return this.classes.update(id, parsed.data);
  }

  /** Delete a class and (via FK ON DELETE CASCADE) all its enrollments,
   *  paper assignments, morning-quiz sessions, and english-level row.
   *  Admin/head-only — irreversible and wipes attendance history. */
  @Delete(':id')
  async remove(@Param('id') id: string, @CurrentUser() user: any) {
    if (user.role !== 'admin' && user.role !== 'head_teacher') {
      throw new ForbiddenException({ code: 'admin_only' });
    }
    return this.classes.remove(id);
  }
}
