import { BadRequestException, Body, Controller, Get, Param, Post, Query } from '@nestjs/common';
import { z } from 'zod';
import { CurrentUser } from '../common/current-user.decorator';
import { Roles } from '../common/auth.guard';
import { VocabularyV2Service } from './vocabulary-v2.service';
import { MAX_PER_DAY } from './word-list-plan';

@Controller('vocab-v2/teacher')
@Roles('admin', 'head_teacher', 'teacher')
export class VocabularyV2TeacherController {
  constructor(private readonly service: VocabularyV2Service) {}

  @Get('class/:classId/assignments')
  assignments(
    @CurrentUser() user: { id: string; role: string },
    @Param('classId') classId: string,
    @Query('dateFrom') dateFrom?: string,
    @Query('dateTo') dateTo?: string,
  ) {
    return this.service.teacherAssignments(user, classId, dateFrom, dateTo);
  }

  @Get('class/:classId/progress')
  progress(
    @CurrentUser() user: { id: string; role: string },
    @Param('classId') classId: string,
  ) {
    return this.service.teacherClassProgress(user, classId);
  }

  @Post('assignments')
  publish(@CurrentUser() user: { id: string; role: string }, @Body() body: unknown) {
    const parsed = z.object({
      classId: z.string().min(1).max(80),
      date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
      title: z.string().min(1).max(120).optional(),
      // 1–MAX_PER_DAY 个（2026-09-29 早读课每天 30 个左右，上限 20 → 40，与 service / 老师后台同一个数）；
      // 每个词可以是字符串，也可以带 force（见过的学生也照推）。
      words: z.array(z.union([
        z.string().min(1).max(80),
        z.object({ headword: z.string().min(1).max(80), force: z.boolean().optional() }).strict(),
      ])).min(1).max(MAX_PER_DAY),
    }).strict().safeParse(body);
    if (!parsed.success) throw new BadRequestException(parsed.error.flatten());
    return this.service.publishTeacherAssignment(user, parsed.data);
  }
}
