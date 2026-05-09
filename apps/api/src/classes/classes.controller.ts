import { BadRequestException, Body, Controller, Delete, ForbiddenException, Get, Param, Patch, Post, Req } from '@nestjs/common';
import { Request } from 'express';
import { z } from 'zod';
import { CurrentUser } from '../common/current-user.decorator';
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
  constructor(private readonly classes: ClassesService) {}

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
  get(@Param('id') id: string) {
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
  enroll(@Param('id') id: string, @Body() body: unknown, @CurrentUser() user: any) {
    if (!ROLES_TEACHER.has(user.role)) {
      throw new ForbiddenException('teacher / head_teacher / admin only');
    }
    const parsed = EnrollSchema.safeParse(body);
    if (!parsed.success) throw new BadRequestException(parsed.error.flatten());
    return this.classes.addEnrollment(id, parsed.data);
  }

  @Post(':id/roster')
  roster(@Param('id') id: string, @Body() body: unknown, @CurrentUser() user: any, @Req() req: Request) {
    if (!ROLES_TEACHER.has(user.role)) {
      throw new ForbiddenException('teacher / head_teacher / admin only');
    }
    const parsed = RosterSchema.safeParse(body);
    if (!parsed.success) throw new BadRequestException(parsed.error.flatten());
    return this.classes.bulkRoster(id, parsed.data.students,
      { id: user.id, role: user.role, ip: req.ip ?? null });
  }

  @Delete(':id/enrollments/:userId')
  unenroll(@Param('id') id: string, @Param('userId') userId: string, @CurrentUser() user: any) {
    if (!ROLES_TEACHER.has(user.role)) {
      throw new ForbiddenException('teacher / head_teacher / admin only');
    }
    return this.classes.removeEnrollment(id, userId);
  }

  /** F5 — set or clear the per-class weeklyFocus string the AI quick-paper
   *  generator includes in its prompt to bias output toward this week's
   *  teacher-stated emphasis areas. Pass {weeklyFocus: null} to clear. */
  @Patch(':id')
  update(@Param('id') id: string, @Body() body: unknown, @CurrentUser() user: any) {
    if (!ROLES_TEACHER.has(user.role)) {
      throw new ForbiddenException('teacher / head_teacher / admin only');
    }
    const parsed = UpdateClassSchema.safeParse(body);
    if (!parsed.success) throw new BadRequestException(parsed.error.flatten());
    return this.classes.update(id, parsed.data);
  }
}
